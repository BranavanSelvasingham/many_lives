import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  mergeDotEnvValues,
  parseDotEnvText,
  shouldFallbackToPlain,
} from "./run-sim-dev-lib.mjs";

const WATCH_ARGS = ["--watch", "--import", "tsx", "src/index.ts"];
const PLAIN_ARGS = ["--import", "tsx", "src/index.ts"];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_ENV_PATH = resolve(SCRIPT_DIR, "..", ".env");
const CHILD_ENV = loadChildEnv();
let activeChild = null;
let shuttingDown = false;

function loadChildEnv() {
  if (!existsSync(ROOT_ENV_PATH)) {
    return process.env;
  }

  return mergeDotEnvValues(
    process.env,
    parseDotEnvText(readFileSync(ROOT_ENV_PATH, "utf8")),
  );
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    shuttingDown = true;
    if (activeChild && !activeChild.killed) {
      activeChild.kill(signal);
      return;
    }

    process.exit(0);
  });
}

function runServer(mode) {
  return new Promise((resolve) => {
    const args = mode === "watch" ? WATCH_ARGS : PLAIN_ARGS;
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: CHILD_ENV,
      stdio: ["inherit", "pipe", "pipe"],
    });

    activeChild = child;
    let stderrText = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrText = `${stderrText}${text}`.slice(-8000);
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      stderrText = `${stderrText}\n${error.stack ?? error.message}`;
    });

    child.on("exit", (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
      }

      resolve({
        code,
        signal,
        stderrText,
      });
    });
  });
}

async function main() {
  if (process.env.SIM_SERVER_DISABLE_WATCH === "1") {
    process.stderr.write(
      "[many-lives] Starting sim server without watch (SIM_SERVER_DISABLE_WATCH=1).\n",
    );
    const result = await runServer("plain");
    process.exit(result.code ?? 0);
  }

  const watchResult = await runServer("watch");
  if (shouldFallbackToPlain(watchResult, { shuttingDown })) {
    process.stderr.write(
      "[many-lives] Watch mode hit the local file-watch limit. Falling back to non-watch sim startup.\n",
    );
    const plainResult = await runServer("plain");
    process.exit(plainResult.code ?? 0);
  }

  if (watchResult.signal || shuttingDown) {
    return;
  }

  process.exit(watchResult.code ?? 0);
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Sim dev launcher failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
