#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const ROOT = process.cwd();
const STARTED_AT = new Date();
const OUTPUT_DIR =
  readOption("--output") ??
  process.env.MANY_LIVES_APP_HARNESS_DIR ??
  path.join(os.tmpdir(), `manylives-app-harness-${Date.now()}`);
const PROFILE =
  readOption("--profile") ?? process.env.MANY_LIVES_APP_HARNESS_PROFILE ?? "full";
const LIVE_URL = readOption("--live-url") ?? process.env.MANY_LIVES_APP_HARNESS_LIVE_URL;
const SKIP_VISUAL = readFlag("--skip-visual");
const SKIP_BROWSER_PLAYTEST = readFlag("--skip-browser-playtest");

const LOG_DIR = path.join(OUTPUT_DIR, "logs");
const VISUAL_DIR = path.join(OUTPUT_DIR, "visual-game");
const BROWSER_PLAYTEST_DIR = path.join(OUTPUT_DIR, "rowan-browser");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "summary.json");

const profiles = new Set(["quick", "full", "ci"]);

if (!profiles.has(PROFILE)) {
  console.error(
    `[many-lives:harness] Unknown profile "${PROFILE}". Use quick, full, or ci.`,
  );
  process.exit(2);
}

const summary = {
  profile: PROFILE,
  startedAt: STARTED_AT.toISOString(),
  outputDir: OUTPUT_DIR,
  artifacts: {
    logs: LOG_DIR,
    visualGame: SKIP_VISUAL ? null : VISUAL_DIR,
    rowanBrowser: SKIP_BROWSER_PLAYTEST ? null : BROWSER_PLAYTEST_DIR,
  },
  liveUrl: LIVE_URL ?? null,
  steps: [],
};

await mkdir(LOG_DIR, { recursive: true });
await mkdir(VISUAL_DIR, { recursive: true });
await mkdir(BROWSER_PLAYTEST_DIR, { recursive: true });

console.log(`[many-lives:harness] Profile: ${PROFILE}`);
console.log(`[many-lives:harness] Output: ${OUTPUT_DIR}`);

const steps = buildSteps();
let failed = false;

for (const step of steps) {
  const result =
    step.kind === "inline" ? await runInlineStep(step) : await runCommandStep(step);
  summary.steps.push(result);
  await writeSummary();

  if (result.status !== "passed") {
    failed = true;
    break;
  }
}

summary.finishedAt = new Date().toISOString();
summary.durationMs = Date.now() - STARTED_AT.getTime();
summary.status = failed ? "failed" : "passed";
await writeSummary();

if (failed) {
  const failingStep = summary.steps.find((step) => step.status !== "passed");
  console.error(
    `[many-lives:harness] FAILED: ${failingStep?.name ?? "unknown step"}`,
  );
  console.error(`[many-lives:harness] Summary: ${SUMMARY_PATH}`);
  process.exit(1);
}

console.log(`[many-lives:harness] Passed ${summary.steps.length} steps.`);
console.log(`[many-lives:harness] Summary: ${SUMMARY_PATH}`);

function buildSteps() {
  const allSteps = [
    commandStep("sim lint", "corepack", [
      "pnpm",
      "--filter",
      "@many-lives/sim-server",
      "lint",
    ]),
    commandStep("web lint", "corepack", [
      "pnpm",
      "--filter",
      "@many-lives/many-lives-web",
      "lint",
    ]),
    commandStep("sim unit tests", "corepack", [
      "pnpm",
      "--filter",
      "@many-lives/sim-server",
      "test",
    ]),
    commandStep("repo node tests", "node", [
      "--test",
      "scripts/run-sim-dev.test.mjs",
      "scripts/visual-scene-anchor-regression.test.mjs",
    ]),
    commandStep("web sim fallback test", "corepack", [
      "pnpm",
      "--filter",
      "@many-lives/sim-server",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "../../scripts/web-sim-fallback.test.ts",
    ]),
    commandStep("web production build", "corepack", [
      "pnpm",
      "--filter",
      "@many-lives/many-lives-web",
      "build",
    ]),
    inlineStep("public secret exposure scan", scanPublicArtifacts),
  ];

  if (PROFILE !== "quick") {
    allSteps.push(
      commandStep("rowan sim playtest", "corepack", [
        "pnpm",
        "playtest:rowan",
      ]),
    );

    if (!SKIP_BROWSER_PLAYTEST) {
      allSteps.push(
        commandStep("rowan browser playtest", "corepack", [
          "pnpm",
          "playtest:rowan:browser",
        ], {
          MANY_LIVES_BROWSER_PLAYTEST_DIR: BROWSER_PLAYTEST_DIR,
        }),
        inlineStep("rowan browser artifact check", (logLine) =>
          assertArtifacts(logLine, [
            {
              filePath: path.join(BROWSER_PLAYTEST_DIR, "timeline.json"),
              minBytes: 1_000,
              parseJson: true,
            },
          ]),
        ),
      );
    }

    if (!SKIP_VISUAL) {
      allSteps.push(
        commandStep("visual game smoke", "corepack", ["pnpm", "visual:game"], {
          MANY_LIVES_VISUAL_CHECK_DIR: VISUAL_DIR,
        }),
        inlineStep("visual game artifact check", (logLine) =>
          assertArtifacts(logLine, [
            {
              filePath: path.join(VISUAL_DIR, "desktop.png"),
              minBytes: 120_000,
            },
            {
              filePath: path.join(VISUAL_DIR, "desktop-after-pan.png"),
              minBytes: 120_000,
            },
            {
              filePath: path.join(VISUAL_DIR, "mobile.png"),
              minBytes: 70_000,
            },
            {
              filePath: path.join(VISUAL_DIR, "mobile-after-pan.png"),
              minBytes: 70_000,
            },
            {
              filePath: path.join(VISUAL_DIR, "summary.json"),
              minBytes: 1_000,
              parseJson: true,
            },
          ]),
        ),
      );
    }
  }

  if (LIVE_URL) {
    allSteps.push(
      inlineStep("live deployment smoke", (logLine) =>
        smokeLiveUrl(LIVE_URL, logLine),
      ),
    );
  }

  return allSteps;
}

function commandStep(name, command, args, env = {}) {
  return { kind: "command", name, command, args, env };
}

function inlineStep(name, action) {
  return { kind: "inline", name, action };
}

async function runCommandStep(step) {
  const started = performance.now();
  const logPath = path.join(LOG_DIR, `${slug(step.name)}.log`);
  const log = createWriteStream(logPath, { flags: "w" });

  console.log(`\n[many-lives:harness] -> ${step.name}`);
  console.log(
    `[many-lives:harness] $ ${[step.command, ...step.args].join(" ")}`,
  );

  const child = spawn(step.command, step.args, {
    cwd: ROOT,
    env: {
      ...process.env,
      ...step.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    log.write(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  }).finally(() => {
    log.end();
  });

  const durationMs = Math.round(performance.now() - started);
  const result = {
    name: step.name,
    kind: step.kind,
    command: [step.command, ...step.args],
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
    durationMs,
    logPath,
  };

  console.log(
    `[many-lives:harness] <- ${step.name}: ${result.status} (${durationMs}ms)`,
  );

  return result;
}

async function runInlineStep(step) {
  const started = performance.now();
  const logPath = path.join(LOG_DIR, `${slug(step.name)}.log`);
  const lines = [];
  const logLine = (line) => {
    const text = String(line);
    lines.push(text);
    console.log(text);
  };

  console.log(`\n[many-lives:harness] -> ${step.name}`);

  try {
    await step.action(logLine);
    const durationMs = Math.round(performance.now() - started);
    await writeFile(logPath, `${lines.join("\n")}\n`);
    console.log(
      `[many-lives:harness] <- ${step.name}: passed (${durationMs}ms)`,
    );
    return {
      name: step.name,
      kind: step.kind,
      status: "passed",
      durationMs,
      logPath,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    lines.push(message);
    await writeFile(logPath, `${lines.join("\n")}\n`);
    console.error(message);
    console.log(
      `[many-lives:harness] <- ${step.name}: failed (${durationMs}ms)`,
    );
    return {
      name: step.name,
      kind: step.kind,
      status: "failed",
      durationMs,
      logPath,
      error: message,
    };
  }
}

async function scanPublicArtifacts(logLine) {
  const scanRoots = [
    "apps/many-lives-web/.next/static",
    "apps/many-lives-web/public",
  ];
  const detectorPatterns = [
    { label: "OpenAI secret key pattern", regex: /sk-[A-Za-z0-9_-]{20,}/g },
    { label: "GitHub token pattern", regex: /gh[oprsu]_[A-Za-z0-9_]{20,}/g },
    { label: "OpenAI API env name", regex: /OPENAI_API_KEY/g },
    { label: "public secret-like env name", regex: /NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)[A-Z0-9_]*/g },
  ];
  const envSecrets = [
    "OPENAI_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "GITHUB_TOKEN",
    "AZUREAPPSERVICE_PUBLISHPROFILE_A77D3379C9B14869BF3DD99DD46DFC99",
  ]
    .map((name) => ({ name, value: process.env[name] }))
    .filter(({ value }) => typeof value === "string" && value.length >= 12);
  const findings = [];
  let scannedFiles = 0;

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.join(ROOT, scanRoot);
    if (!existsSync(absoluteRoot)) {
      logLine(`[many-lives:harness] skipped missing public artifact: ${scanRoot}`);
      continue;
    }

    for await (const filePath of walkTextFiles(absoluteRoot)) {
      scannedFiles += 1;
      const body = await readFile(filePath, "utf8");
      const relativePath = path.relative(ROOT, filePath);

      for (const detector of detectorPatterns) {
        detector.regex.lastIndex = 0;
        if (detector.regex.test(body)) {
          findings.push(`${detector.label} in ${relativePath}`);
        }
      }

      for (const secret of envSecrets) {
        if (body.includes(secret.value)) {
          findings.push(`${secret.name} value in ${relativePath}`);
        }
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `Public secret exposure scan failed:\n${findings
        .map((finding) => `- ${finding}`)
        .join("\n")}`,
    );
  }

  logLine(
    `[many-lives:harness] scanned ${scannedFiles} public artifact text files; no secret patterns found.`,
  );
}

async function assertArtifacts(logLine, artifacts) {
  for (const artifact of artifacts) {
    const fileStat = await stat(artifact.filePath).catch(() => null);
    const relativePath = path.relative(ROOT, artifact.filePath);

    if (!fileStat?.isFile()) {
      throw new Error(`Missing harness artifact: ${artifact.filePath}`);
    }

    if (fileStat.size < artifact.minBytes) {
      throw new Error(
        `Harness artifact is too small: ${artifact.filePath} (${fileStat.size} bytes)`,
      );
    }

    if (artifact.parseJson) {
      JSON.parse(await readFile(artifact.filePath, "utf8"));
    }

    logLine(
      `[many-lives:harness] artifact ok: ${relativePath} (${fileStat.size} bytes)`,
    );
  }
}

async function* walkTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walkTextFiles(fullPath);
      continue;
    }

    if (!entry.isFile() || !looksTextual(entry.name)) {
      continue;
    }

    const fileStat = await stat(fullPath);
    if (fileStat.size > 5 * 1024 * 1024) {
      continue;
    }

    yield fullPath;
  }
}

function looksTextual(fileName) {
  return /\.(css|html|js|json|map|mjs|svg|txt|xml)$/i.test(fileName);
}

async function smokeLiveUrl(liveUrl, logLine) {
  const base = liveUrl.replace(/\/+$/, "");
  const urls = [base, `${base}/sim/health`];

  for (const url of urls) {
    const response = await fetch(url, { redirect: "follow" });
    logLine(`[many-lives:harness] ${url} -> ${response.status}`);

    if (!response.ok) {
      throw new Error(`Live smoke failed for ${url}: HTTP ${response.status}`);
    }
  }
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function readFlag(name) {
  return process.argv.includes(name);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function writeSummary() {
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}
