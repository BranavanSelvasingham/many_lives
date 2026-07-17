import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { inflateSync } from "node:zlib";

function findChromeBin() {
  const candidates = [
    process.env.MANY_LIVES_CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  const chromeBin = candidates.find((candidate) => {
    if (!path.isAbsolute(candidate)) {
      return true;
    }

    return existsSync(candidate);
  });

  if (!chromeBin) {
    throw new Error(
      "Could not find Chrome. Set MANY_LIVES_CHROME_BIN to run the browser regression.",
    );
  }

  return chromeBin;
}

const FFMPEG_BIN = process.env.MANY_LIVES_FFMPEG_BIN ?? "ffmpeg";
const BROWSER_DRIVER = (process.env.MANY_LIVES_BROWSER_DRIVER ?? "probe")
  .trim()
  .toLowerCase();
const USE_CHROME_DRIVER = BROWSER_DRIVER === "chrome";
const CHROME_BIN = USE_CHROME_DRIVER ? findChromeBin() : null;
const CAPTURE_ALL_CHROME_STEPS =
  USE_CHROME_DRIVER && process.env.MANY_LIVES_BROWSER_CAPTURE_ALL !== "0";
const REQUIRE_SCREENSHOTS =
  USE_CHROME_DRIVER &&
  process.env.MANY_LIVES_BROWSER_REQUIRE_SCREENSHOTS !== "0";
const REQUIRE_RECORDING =
  USE_CHROME_DRIVER && process.env.MANY_LIVES_BROWSER_REQUIRE_RECORDING !== "0";
const TRACE_REGRESSION = process.env.MANY_LIVES_BROWSER_TRACE === "1";
const DEFAULT_WEB_BASE =
  process.env.MANY_LIVES_WEB_BASE_URL ?? "http://127.0.0.1:3001";
const FORCE_LOCAL_WEB = process.env.MANY_LIVES_BROWSER_FORCE_LOCAL_WEB !== "0";
const OUTPUT_DIR =
  process.env.MANY_LIVES_BROWSER_PLAYTEST_DIR ??
  path.join(tmpdir(), `manylives-rowan-browser-${Date.now()}`);
const WINDOW_SIZE = process.env.MANY_LIVES_BROWSER_WINDOW ?? "1365,768";
const FIXED_DEVTOOLS_PORT = process.env.MANY_LIVES_BROWSER_DEVTOOLS_PORT
  ? Number(process.env.MANY_LIVES_BROWSER_DEVTOOLS_PORT)
  : null;
const CDP_WAIT_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_CDP_WAIT_TIMEOUT_MS ?? "30000",
);
const CHROME_START_ATTEMPTS = Number(
  process.env.MANY_LIVES_BROWSER_START_ATTEMPTS ?? "2",
);
const CHROME_START_RETRY_DELAY_MS = 1_000;
const CHILD_PROCESS_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_CHILD_PROCESS_TIMEOUT_MS ?? "120000",
);
const CLEANUP_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_CLEANUP_TIMEOUT_MS ?? "10000",
);
const PROCESS_EXIT_DIAGNOSTICS_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_PROCESS_EXIT_DIAGNOSTICS_TIMEOUT_MS ?? "5000",
);
const AUTOPLAY_OBSERVATION_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_OBSERVATION_TIMEOUT_MS ?? "300000",
);
const OBSERVE_CARRY_FORWARD_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_OBSERVE_CARRY_FORWARD_TIMEOUT_MS ?? "90000",
);
const AUTOPLAY_PACING_SAMPLE_INTERVAL_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_PACING_SAMPLE_INTERVAL_MS ?? "1250",
);
const AUTOPLAY_DOM_AUDIT_INTERVAL_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_DOM_AUDIT_INTERVAL_MS ?? "5000",
);
const AUTOPLAY_PACING_OPENING_DECISION_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_PACING_OPENING_DECISION_TIMEOUT_MS ??
    "12000",
);
const AUTOPLAY_PACING_ACTION_FOLLOWTHROUGH_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_PACING_ACTION_FOLLOWTHROUGH_TIMEOUT_MS ??
    "12000",
);
const AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS ?? "15000",
);
const AUTOPLAY_PACING_MIN_MEANINGFUL_BEATS = Number(
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_PACING_MIN_MEANINGFUL_BEATS ?? "6",
);
const INHABIT_GAMEPLAY_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_INHABIT_GAMEPLAY_TIMEOUT_MS ?? "540000",
);
const APP_READY_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_APP_READY_TIMEOUT_MS ?? "120000",
);
const BROWSER_PHASE_HEARTBEAT_MS = Number(
  process.env.MANY_LIVES_BROWSER_PHASE_HEARTBEAT_MS ?? "30000",
);
const CDP_READ_RETRY_COUNT = Number(
  process.env.MANY_LIVES_BROWSER_CDP_READ_RETRY_COUNT ?? "1",
);
const CDP_READ_RETRY_DELAY_MS = Number(
  process.env.MANY_LIVES_BROWSER_CDP_READ_RETRY_DELAY_MS ?? "250",
);
const SIM_WAIT_TIMEOUT_MS = 15_000;
const SIM_CONVERSATION_PLAYBACK_EXTRA_WAIT_MS = 15_000;
const SIM_WORK_PLAYBACK_EXTRA_WAIT_MS = 15_000;
const SIM_WORK_PLAYBACK_STALL_GRACE_MS = 5_000;
const SIM_WORK_PLAYBACK_VISUAL_ACTIVE_GRACE_MS = 2_000;
const SIM_WORK_PLAYBACK_PROGRESS_EPSILON = 0.002;
const RUN_SIM_WAIT_GUARD_ONLY =
  process.env.MANY_LIVES_BROWSER_SIM_WAIT_GUARD_ONLY === "1";
const MAP_AGENCY_PROBE_SETTLE_TIMEOUT_MS = 2_000;
const WEB_START_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_WEB_START_TIMEOUT_MS ?? "45000",
);
const PROBE_POLL_INTERVAL_MS = 250;
const SCAFFOLD_ONLY_TRACE_PROVENANCES = new Set([
  "route-scaffold",
  "stale-predicate",
  "stale-trail",
]);
const FALLBACK_WEB_PORT = Number(
  process.env.MANY_LIVES_BROWSER_WEB_FALLBACK_PORT ?? "3101",
);
const REQUIRED_NPC_PATROL_LOCATION_IDS = [
  "boarding-house",
  "tea-house",
  "market-square",
  "freight-yard",
];
const OPENING_CTA_PATTERN = /Watch Rowan begin|Rowan starts by asking Mara\./i;
const GENERIC_WATCH_CTA_COPY_PATTERN =
  /Rowan will keep going when this beat lands/i;
const OPENING_PLAYER_LOCATION_MAX_DISTANCE = 72;
const OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS = {
  maxX: 260,
  maxY: 630,
  minX: 180,
  minY: 550,
};
const AUTHORED_LANDMARK_ARRIVAL_MAX_DISTANCE = 8;
const MORROW_SIDE_WORLD_MAX_X = 700;
const KETTLE_SIDE_WORLD_MIN_X = 900;
const MAP_AGENCY_TARGET_LABEL_MAX_OFFSET = 120;
const OUTDOOR_ROUTE_ARRIVAL_CONTINUITY_MAX_DISTANCE = 8;
const INHABIT_CAMERA_MEANINGFUL_PAN_RANGE_PX = 24;
const POST_FIRST_AFTERNOON_RECOVERY_ENERGY = 35;
const FIRST_AFTERNOON_READABILITY_CHECKPOINT_MS = 5_500;
const FIRST_AFTERNOON_MIN_VISIBLE_DWELL_MS = 7_000;
const INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES = 10;
const ROUTE_PHASE_ORDER = {
  start: 0,
  mid: 1,
  close: 2,
};
const REQUIRED_PLAYER_ROUTE_COVERAGE = [
  {
    baseLabel: "stage-cafe-move",
    label: "first-kettle-route",
  },
  {
    baseLabel: "stage-home-move",
    label: "return-home-route",
  },
  {
    baseLabel: "post-first-afternoon-live-route",
    label: "post-first-afternoon-live-route",
  },
  {
    baseLabel: "post-first-afternoon-yard-follow-through",
    label: "yard-follow-through",
  },
  {
    baseLabel: "post-first-afternoon-yard-outcome",
    label: "yard-outcome",
    requiredInEveryAudit: false,
  },
];

let activeWebBase = DEFAULT_WEB_BASE;

function traceRegression(message) {
  if (TRACE_REGRESSION) {
    process.stderr.write(`[many-lives:trace] ${message}\n`);
  }
}

function pointDistance(left, right) {
  if (!left || !right) {
    return 0;
  }

  return Math.hypot(
    (right.x ?? 0) - (left.x ?? 0),
    (right.y ?? 0) - (left.y ?? 0),
  );
}

function pointInsideRect(point, rect) {
  return Boolean(
    point &&
      rect &&
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom,
  );
}

function pointInsideBounds(point, bounds) {
  return Boolean(
    point &&
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY,
  );
}

function roundAuditNumber(value) {
  return Math.round(value * 1000) / 1000;
}

function getWebBase() {
  return activeWebBase;
}

function getWebSimBase() {
  return `${getWebBase()}/sim`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }

  return response.json();
}

async function readWebStackHealth(baseUrl) {
  const [webHealth, proxyHealth] = await Promise.all([
    fetch(baseUrl, { signal: AbortSignal.timeout(8_000) }),
    fetchJson(`${baseUrl}/sim/health`),
  ]);

  assert.equal(webHealth.ok, true);
  assert.equal(proxyHealth.status, "ok");

  return {
    proxyHealth,
    webHealth,
  };
}

function buildFallbackWebBase(baseUrl, port = FALLBACK_WEB_PORT) {
  const url = new URL(baseUrl);
  url.port = String(port);
  return url.toString().replace(/\/$/, "");
}

async function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a browser regression port."));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function buildAvailableFallbackWebBase(baseUrl) {
  const port = (await canListenOnPort(FALLBACK_WEB_PORT))
    ? FALLBACK_WEB_PORT
    : await reserveAvailablePort();
  return buildFallbackWebBase(baseUrl, port);
}

async function closeChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return {
      exitCode: child?.exitCode ?? null,
      signalCode: child?.signalCode ?? null,
      status: "already-closed",
    };
  }

  const pid = child.pid ?? null;
  signalChildProcess(child, "SIGTERM");
  await Promise.race([
    once(child, "close").catch(() => undefined),
    sleep(1_500),
  ]);

  if (child.exitCode === null) {
    const closed = once(child, "close").catch(() => undefined);
    signalChildProcess(child, "SIGKILL");
    await Promise.race([closed, sleep(1_500)]);
  }

  const status =
    child.exitCode !== null || child.signalCode !== null ? "closed" : "detached";

  if (child.exitCode === null && child.signalCode === null) {
    destroyChildProcessStreams(child);
    child.unref?.();
  }

  return {
    exitCode: child.exitCode,
    pid,
    signalCode: child.signalCode,
    status,
  };
}

function signalChildProcess(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (child.manyLivesKillGroup && child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {}
  }

  child.kill(signal);
}

function destroyChildProcessStreams(child) {
  for (const stream of [child.stdin, child.stdout, child.stderr, ...(child.stdio ?? [])]) {
    try {
      stream?.destroy?.();
    } catch {}
  }
}

async function runProcess(command, args, errorPrefix) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";

  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 12_000) {
      stderr = stderr.slice(-12_000);
    }
  });

  const exitPromise = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  let exitCode;
  try {
    exitCode = await withTimeout(
      exitPromise,
      CHILD_PROCESS_TIMEOUT_MS,
      `${errorPrefix} timed out after ${CHILD_PROCESS_TIMEOUT_MS}ms.`,
    );
  } catch (error) {
    await closeChildProcess(child);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${stderr}`,
    );
  }

  if (exitCode !== 0) {
    throw new Error(`${errorPrefix} exited with ${exitCode}.\n${stderr}`);
  }
}

async function startWebServer(baseUrl) {
  const url = new URL(baseUrl);
  const port = url.port === "" ? 80 : Number(url.port);
  const server = spawn(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@many-lives/many-lives-web",
      "exec",
      "next",
      "dev",
      "--port",
      String(port),
      "--webpack",
    ],
    {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        MANY_LIVES_API_BASE_URL:
          process.env.MANY_LIVES_BROWSER_SIM_BASE_URL ?? "http://127.0.0.1:9",
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.manyLivesKillGroup = process.platform !== "win32";

  let logs = "";
  let exitCode = null;
  const appendLogs = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 12_000) {
      logs = logs.slice(-12_000);
    }
  };
  server.stdout?.on("data", appendLogs);
  server.stderr?.on("data", appendLogs);

  server.on("exit", (code) => {
    exitCode = code;
    if (code !== 0) {
      logs += `\n[next-exit:${code}]`;
    }
  });

  try {
    await waitFor(
      async () => {
        if (exitCode !== null) {
          throw new Error(
            `The local web stack exited before it became healthy at ${baseUrl}.\n${logs}`,
          );
        }

        try {
          await readWebStackHealth(baseUrl);
          return true;
        } catch {
          return false;
        }
      },
      WEB_START_TIMEOUT_MS,
      `Timed out waiting for the local web stack at ${baseUrl}.\n${logs}`,
    );
  } catch (error) {
    await closeChildProcess(server);
    throw error;
  }

  return server;
}

async function ensureStack() {
  if (!FORCE_LOCAL_WEB) {
    try {
      await readWebStackHealth(getWebBase());
      return {
        webBase: getWebBase(),
        webServer: null,
      };
    } catch {
      // Fall through to a controlled local stack.
    }
  }

  activeWebBase = await buildAvailableFallbackWebBase(DEFAULT_WEB_BASE);
  const webServer = await startWebServer(activeWebBase);
  await readWebStackHealth(activeWebBase);

  return {
    webBase: activeWebBase,
    webServer,
  };
}

async function createGame() {
  const payload = await fetchJson(`${getWebSimBase()}/game/new`, {
    body: JSON.stringify({}),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  return payload.game;
}

async function advanceObjective(
  gameId,
  allowTimeSkip = false,
  confirmMove = false,
) {
  const payload = await fetchJson(`${getWebSimBase()}/game/${gameId}/command`, {
    body: JSON.stringify({
      type: "advance_objective",
      allowTimeSkip,
      confirmMove,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  return payload.game;
}

async function runGameCommand(gameId, command) {
  const payload = await fetchJson(`${getWebSimBase()}/game/${gameId}/command`, {
    body: JSON.stringify(command),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  return payload.game;
}

async function waitForIndependentProblemResolution(gameId, options = {}) {
  const maxWaitMinutes = options.maxWaitMinutes ?? 180;
  const waitChunkMinutes = options.waitChunkMinutes ?? 65;
  let remainingMinutes = maxWaitMinutes;
  let game = null;

  while (remainingMinutes > 0) {
    const minutes = Math.min(waitChunkMinutes, remainingMinutes);
    game = await runGameCommand(gameId, {
      minutes,
      silent: remainingMinutes !== maxWaitMinutes,
      type: "wait",
    });

    if (independentNpcActionsFromGame(game).length > 0) {
      return game;
    }

    remainingMinutes -= minutes;
  }

  const problems = game ? worldPressureFromGame(game).problems : [];
  assert.fail(
    `Timed out waiting for an independent local action. Last state: ${JSON.stringify(
      {
        clock: game?.currentTime ?? null,
        independentNpcActions: game ? independentNpcActionsFromGame(game) : [],
        problems,
      },
      null,
      2,
    )}`,
  );
}

function browserUrl(gameId) {
  return `${getWebBase()}?gameId=${encodeURIComponent(gameId)}&autoplay=0&observe=1&freezeAutoplay=1`;
}

function slug(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

async function writeStream(stream, message, label) {
  await withTimeout(
    new Promise((resolve, reject) => {
      stream.write(message, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
    PROCESS_EXIT_DIAGNOSTICS_TIMEOUT_MS,
    `Timed out flushing ${label} after ${PROCESS_EXIT_DIAGNOSTICS_TIMEOUT_MS}ms.`,
  );
}

function describeActiveHandles() {
  if (typeof process._getActiveHandles !== "function") {
    return [];
  }

  return process._getActiveHandles().map((handle) => {
    const details = {};
    if (typeof handle.fd === "number") {
      details.fd = handle.fd;
    }
    if (typeof handle.pid === "number") {
      details.pid = handle.pid;
    }
    if (typeof handle.spawnfile === "string") {
      details.spawnfile = handle.spawnfile;
    }
    if (typeof handle.localAddress === "string") {
      details.localAddress = handle.localAddress;
    }
    if (typeof handle.localPort === "number") {
      details.localPort = handle.localPort;
    }
    if (typeof handle.remoteAddress === "string") {
      details.remoteAddress = handle.remoteAddress;
    }
    if (typeof handle.remotePort === "number") {
      details.remotePort = handle.remotePort;
    }
    if (typeof handle.destroyed === "boolean") {
      details.destroyed = handle.destroyed;
    }

    return {
      details,
      type: handle?.constructor?.name ?? typeof handle,
    };
  });
}

async function writeProcessExitDiagnostics(status) {
  await writeFile(
    path.join(OUTPUT_DIR, "process-exit-diagnostics.json"),
    `${JSON.stringify(
      {
        activeHandles: describeActiveHandles(),
        at: new Date().toISOString(),
        status,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function waitFor(
  condition,
  timeoutMs,
  errorMessage,
  pollIntervalMs = PROBE_POLL_INTERVAL_MS,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await condition();
    if (result) {
      return result;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(errorMessage);
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodePngPixels(buffer) {
  assert.equal(
    buffer.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    "Screenshot is not a PNG.",
  );
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const compressedChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert.ok(dataEnd + 4 <= buffer.length, `Malformed PNG ${type} chunk.`);
    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === "IDAT") {
      compressedChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8, `Unsupported PNG bit depth ${bitDepth}.`);
  assert.equal(interlace, 0, "Interlaced screenshots are not supported.");
  const channels = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]).get(colorType);
  assert.ok(channels, `Unsupported PNG color type ${colorType}.`);
  const inflated = inflateSync(Buffer.concat(compressedChunks));
  const stride = width * channels;
  assert.equal(
    inflated.length,
    height * (stride + 1),
    "Unexpected PNG scanline length.",
  );
  const pixels = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * (stride + 1);
    const filter = inflated[sourceRow];
    const targetRow = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceRow + 1 + x];
      const left = x >= channels ? pixels[targetRow + x - channels] : 0;
      const up = y > 0 ? pixels[targetRow - stride + x] : 0;
      const upLeft =
        y > 0 && x >= channels
          ? pixels[targetRow - stride + x - channels]
          : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : filter === 4
                  ? paethPredictor(left, up, upLeft)
                  : null;
      assert.notEqual(predictor, null, `Unsupported PNG filter ${filter}.`);
      pixels[targetRow + x] = (raw + predictor) & 0xff;
    }
  }

  return { channels, height, pixels, width };
}

function assertNoLargeNearBlackDropout(buffer, label) {
  const { channels, height, pixels, width } = decodePngPixels(buffer);
  const nearBlack = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);

  for (let index = 0; index < nearBlack.length; index += 1) {
    const pixelOffset = index * channels;
    const red = pixels[pixelOffset];
    const green = pixels[pixelOffset + 1] ?? red;
    const blue = pixels[pixelOffset + 2] ?? red;
    nearBlack[index] = Math.max(red, green, blue) <= 6 ? 1 : 0;
  }

  let largest = { area: 0, bottom: 0, left: 0, right: 0, top: 0 };
  for (let index = 0; index < nearBlack.length; index += 1) {
    if (!nearBlack[index] || visited[index]) {
      continue;
    }
    let head = 0;
    let tail = 0;
    queue[tail++] = index;
    visited[index] = 1;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && nearBlack[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    if (area > largest.area) {
      largest = { area, bottom, left, right, top };
    }
  }

  const componentWidth = largest.right - largest.left;
  const componentHeight = largest.bottom - largest.top;
  const maximumArea = Math.max(1_600, width * height * 0.006);
  assert.ok(
    largest.area < maximumArea || componentWidth < 24 || componentHeight < 16,
    `${label}: screenshot contains a large connected near-black dropout: ${JSON.stringify({
      ...largest,
      componentHeight,
      componentWidth,
      maximumArea: Number(maximumArea.toFixed(1)),
    })}.`,
  );
}

function assertVisibleScreenshotTextPaint(buffer, probe, label) {
  const { channels, height, pixels, width } = decodePngPixels(buffer);
  const scaleX = width / probe.viewport.width;
  const scaleY = height / probe.viewport.height;
  assert.ok(
    probe.regions.length >= 8,
    `${label}: expected visible HUD, dock, and rail text geometry.`,
  );

  for (const region of probe.regions) {
    const left = Math.max(0, Math.floor(region.rect.left * scaleX));
    const right = Math.min(width, Math.ceil(region.rect.right * scaleX));
    const top = Math.max(0, Math.floor(region.rect.top * scaleY));
    const bottom = Math.min(height, Math.ceil(region.rect.bottom * scaleY));
    const characters = region.text.replace(/\s+/g, "").length;
    const horizontalBinCount = Math.max(
      2,
      Math.min(6, Math.ceil(characters / 3)),
    );
    const horizontalBins = new Uint16Array(horizontalBinCount);
    let brightPixels = 0;
    let sampledPixels = 0;

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const pixelOffset = (y * width + x) * channels;
        const red = pixels[pixelOffset];
        const green = pixels[pixelOffset + 1] ?? red;
        const blue = pixels[pixelOffset + 2] ?? red;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        if (luminance >= 70) {
          brightPixels += 1;
          const relativeX = right > left ? (x - left) / (right - left) : 0;
          const bin = Math.min(
            horizontalBinCount - 1,
            Math.floor(relativeX * horizontalBinCount),
          );
          horizontalBins[bin] += 1;
        }
        sampledPixels += 1;
      }
    }

    const minimumBrightPixels = Math.max(
      4,
      1.5 * characters * scaleX * scaleY,
      sampledPixels * 0.008,
    );
    const activeBins = [...horizontalBins].filter((count) => count >= 2).length;
    const minimumActiveBins = Math.ceil(horizontalBinCount * 0.6);
    assert.ok(
      brightPixels >= minimumBrightPixels && activeBins >= minimumActiveBins,
      `${label}: visible ${region.surface} text "${region.text.slice(0, 48)}" was not completely painted (${brightPixels} bright pixels, ${activeBins}/${horizontalBinCount} horizontal bins) at ${JSON.stringify(region.rect)}.`,
    );
  }
}

function shouldValidateGameplayScreenshotPaint(targetPath) {
  const label = path.basename(targetPath);
  return !/(?:overlay|panel|camera|rowan-click)/i.test(label);
}

function mergeScreenshotPaintProbes(before, after, label) {
  assert.deepEqual(
    after.viewport,
    before.viewport,
    `${label}: viewport changed during screenshot capture.`,
  );
  const unmatchedAfter = [...after.regions];
  const sharedRegions = [];

  for (const beforeRegion of before.regions) {
    const matchingIndex = unmatchedAfter.findIndex(
      (afterRegion) =>
        afterRegion.surface === beforeRegion.surface &&
        afterRegion.text === beforeRegion.text,
    );
    if (matchingIndex < 0) {
      continue;
    }
    const [afterRegion] = unmatchedAfter.splice(matchingIndex, 1);
    sharedRegions.push({
      ...beforeRegion,
      rect: {
        bottom: Math.max(beforeRegion.rect.bottom, afterRegion.rect.bottom),
        left: Math.min(beforeRegion.rect.left, afterRegion.rect.left),
        right: Math.max(beforeRegion.rect.right, afterRegion.rect.right),
        top: Math.min(beforeRegion.rect.top, afterRegion.rect.top),
      },
    });
  }

  assert.ok(
    sharedRegions.length >= 8,
    `${label}: too few stable visible text runs remained during screenshot capture (${sharedRegions.length}).`,
  );

  return {
    regions: sharedRegions,
    viewport: before.viewport,
  };
}

function isCdpRuntimeEvaluateTimeout(error) {
  return Boolean(
    error instanceof Error &&
      /Timed out waiting for Chrome DevTools response for Runtime\.evaluate\./.test(
        error.message,
      ),
  );
}

class CdpSession {
  constructor({ browser, outputDir, pageWsUrl, url }) {
    this.browser = browser;
    this.outputDir = outputDir;
    this.pageWsUrl = new URL(pageWsUrl);
    this.url = url;
    this.messageId = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.pageErrors = [];
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;
  }

  async connect() {
    const port = this.pageWsUrl.port === "" ? 80 : Number(this.pageWsUrl.port);
    this.socket = createConnection({
      host: this.pageWsUrl.hostname,
      port,
    });

    this.socket.on("data", (chunk) => {
      this.handleData(chunk);
    });
    this.socket.on("error", (error) => {
      for (const deferred of this.pending.values()) {
        deferred.reject(error);
      }
      this.pending.clear();
    });

    await once(this.socket, "connect");
    this.writeHandshake();
    await waitFor(
      () => this.handshakeComplete,
      CDP_WAIT_TIMEOUT_MS,
      "Timed out waiting for the Chrome DevTools handshake.",
    );

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Log.enable");
    await this.send("Page.setLifecycleEventsEnabled", { enabled: true });
    await this.navigate(this.url);
  }

  async navigate(url) {
    const loadEvent = withTimeout(
      this.waitForEvent("Page.loadEventFired"),
      APP_READY_TIMEOUT_MS,
      `Timed out waiting for Chrome load event after navigating to ${url}.`,
    );
    await this.send("Page.navigate", { url });
    await loadEvent;
    await this.waitForProbe();
  }

  async close() {
    try {
      this.socket?.destroy();
    } catch {}

    return closeChildProcess(this.browser);
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });

    if (response?.result?.exceptionDetails) {
      throw new Error(
        `Runtime.evaluate failed: ${JSON.stringify(
          response.result.exceptionDetails,
        )}`,
      );
    }

    return response?.result?.result?.value;
  }

  async evaluateForRead(expression, label = "runtime-evaluate-read") {
    return this.runReadWithRetry(label, () => this.evaluate(expression));
  }

  async runReadWithRetry(label, operation) {
    let lastError = null;
    let lastDiagnosticsPath = null;

    for (
      let attempt = 1;
      attempt <= CDP_READ_RETRY_COUNT + 1;
      attempt += 1
    ) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!isCdpRuntimeEvaluateTimeout(lastError)) {
          throw lastError;
        }

        lastDiagnosticsPath = await this.writeReadTimeoutDiagnostics({
          attempt,
          error: lastError,
          label,
        });

        if (attempt > CDP_READ_RETRY_COUNT) {
          throw new Error(
            `${label} failed after ${attempt} timed out Chrome probe read attempt(s). Diagnostics: ${lastDiagnosticsPath}. ${lastError.message}`,
          );
        }

        traceRegression(
          `cdp-read-retry:${label}:attempt-${attempt}:diagnostics=${lastDiagnosticsPath}`,
        );
        await sleep(CDP_READ_RETRY_DELAY_MS);
      }
    }

    throw lastError ?? new Error(`${label} failed without an error.`);
  }

  async writeReadTimeoutDiagnostics({ attempt, error, label }) {
    const diagnosticsPath = path.join(
      OUTPUT_DIR,
      `cdp-read-timeout-${slug(label)}-attempt-${attempt}.json`,
    );
    const socket = this.socket;
    const browser = this.browser;

    await writeFile(
      diagnosticsPath,
      `${JSON.stringify(
        {
          at: new Date().toISOString(),
          browser: {
            exitCode: browser?.exitCode ?? null,
            pid: browser?.pid ?? null,
            signalCode: browser?.signalCode ?? null,
          },
          error: error.stack ?? error.message,
          label,
          pendingRequestCount: this.pending.size,
          pendingRequestIds: [...this.pending.keys()],
          retryDelayMs: CDP_READ_RETRY_DELAY_MS,
          socket: {
            bytesRead: socket?.bytesRead ?? null,
            bytesWritten: socket?.bytesWritten ?? null,
            destroyed: socket?.destroyed ?? null,
            localAddress: socket?.localAddress ?? null,
            localPort: socket?.localPort ?? null,
            readyState: socket?.readyState ?? null,
            remoteAddress: socket?.remoteAddress ?? null,
            remotePort: socket?.remotePort ?? null,
          },
          url: this.url,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    return diagnosticsPath;
  }

  async readBrowserProbe(label = "browser-probe") {
    const probe = await this.evaluateForRead(`(() => {
      if (typeof window.__manyLivesStreetProbe === "function") {
        return window.__manyLivesStreetProbe();
      }
      const script = document.querySelector("#ml-browser-probe");
      if (!script) {
        return null;
      }
      try {
        return JSON.parse(script.textContent || "null");
      } catch (error) {
        return { parseError: String(error) };
      }
    })()`, label);

    if (probe?.parseError) {
      throw new Error(`Could not parse #ml-browser-probe: ${probe.parseError}`);
    }

    return probe;
  }

  async readAutoplayPacingProbe(label = "autoplay-pacing-probe") {
    const probe = await this.evaluateForRead(`(() => {
      const parseProbe = (selector) => {
        const script = document.querySelector(selector);
        if (!script) {
          return null;
        }
        try {
          return JSON.parse(script.textContent || "null");
        } catch (error) {
          return { parseError: String(error), selector };
        }
      };
      const payload = parseProbe("#ml-browser-probe");
      if (!payload || payload.parseError) {
        return payload;
      }
      const movement = parseProbe("#ml-browser-movement-probe");
      if (movement?.parseError) {
        return movement;
      }
      payload.movement = movement ?? payload.movement;
      return payload;
    })()`, label);

    if (probe?.parseError) {
      throw new Error(
        `Could not parse ${probe.selector ?? "autoplay pacing probe"}: ${probe.parseError}`,
      );
    }

    return probe;
  }

  async readAutoplayDomAudit(label = "autoplay-dom-audit") {
    return this.evaluateForRead(`(() => {
      const compactText = (element) =>
        element?.textContent?.replace(/\\s+/g, " ").trim() ?? "";
      const progressionSelectors = [
        "[data-advance-objective]:not([disabled])",
        "[data-action-id]:not([disabled])",
        "[data-wait-minutes]:not([disabled])"
      ];
      const visibleProgressionControls = progressionSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector)).map((element) => ({
          actionId: element.getAttribute("data-action-id"),
          advancesObjective: element.hasAttribute("data-advance-objective"),
          selector,
          text: compactText(element),
          waitMinutes: element.getAttribute("data-wait-minutes")
        }))
      );
      const watchModeReplyAffordances = document.querySelector(".ml-root.is-watch-mode")
        ? Array.from(
            document.querySelectorAll(
              "[data-conversation-panel] .ml-chat-bubble.is-player"
            )
          )
            .filter((element) => {
              const passiveTranscript =
                element.getAttribute("data-watch-mode-transcript-line") === "rowan";
              const clickableAncestor = element.closest(
                "button,[role='button'],a[href],[data-action-id],[data-advance-objective],[data-wait-minutes]"
              );
              return !passiveTranscript || Boolean(clickableAncestor);
            })
            .map((element) => ({
              passiveTranscript:
                element.getAttribute("data-watch-mode-transcript-line") === "rowan",
              text: compactText(element)
            }))
        : [];
      const bodyText = compactText(document.body);
      return {
        bodyText,
        bodyTextSample: bodyText.slice(0, 1600),
        visibleProgressionControls,
        watchModeReplyAffordances
      };
    })()`, label);
  }

  async readMapAgencyProbe(label = "map-agency-probe") {
    const probe = await this.evaluateForRead(`(() => {
      const script = document.querySelector("#ml-browser-map-agency-probe");
      if (!script) {
        return null;
      }
      try {
        return JSON.parse(script.textContent || "null");
      } catch (error) {
        return { parseError: String(error) };
      }
    })()`, label);

    if (probe?.parseError) {
      throw new Error(
        `Could not parse #ml-browser-map-agency-probe: ${probe.parseError}`,
      );
    }

    return probe;
  }

  async waitForAnimationFrames(frameCount = 2) {
    const safeFrameCount = Math.max(1, Math.min(6, Math.ceil(frameCount)));
    await this.evaluate(`new Promise((resolve) => {
      let remaining = ${safeFrameCount};
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve(true);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })`);
  }

  async waitForMapAgencyProbe({
    currentLocationId = null,
    targetLocationId = null,
    timeoutMs = MAP_AGENCY_PROBE_SETTLE_TIMEOUT_MS,
  } = {}) {
    return waitFor(
      async () => {
        try {
          await this.waitForAnimationFrames(1);
          const probe = await this.readMapAgencyProbe("map-agency-probe");
          if (!probe) {
            return null;
          }

          if (
            currentLocationId &&
            probe.currentLocation?.id !== currentLocationId
          ) {
            return null;
          }

          if (
            targetLocationId &&
            probe.target?.locationId !== targetLocationId
          ) {
            return null;
          }

          return probe;
        } catch {
          return null;
        }
      },
      timeoutMs,
      `Timed out waiting for map-agency probe current=${
        currentLocationId ?? "*"
      } target=${targetLocationId ?? "*"}.`,
    );
  }

  async readCameraProbe(label = "camera-probe") {
    const probe = await this.evaluateForRead(`(() => {
      const script = document.querySelector("#ml-browser-camera-probe");
      if (!script) {
        return null;
      }
      try {
        return JSON.parse(script.textContent || "null");
      } catch (error) {
        return { parseError: String(error) };
      }
    })()`, label);

    if (probe?.parseError) {
      throw new Error(
        `Could not parse #ml-browser-camera-probe: ${probe.parseError}`,
      );
    }

    return probe;
  }

  async readVisibleElementRect(selector, label = `visible-rect:${selector}`) {
    return this.evaluateForRead(`(() => {
      const elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled;
        if (!visible) {
          continue;
        }

        return {
          rect: {
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          },
          text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
        };
      }

      return null;
    })()`, label);
  }

  async readPlayerControlCandidate(label = "player-control-candidate") {
    return this.evaluateForRead(`(() => {
      const selectors = [
        "[data-advance-objective]:not([disabled])",
        "[data-action-id]:not([disabled])",
        "[data-wait-minutes]:not([disabled])"
      ];
      const isVisibleControl = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled
        );
      };

      for (const selector of selectors) {
        const element = Array.from(document.querySelectorAll(selector)).find(isVisibleControl);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        return {
          actionId: element.getAttribute("data-action-id"),
          advancesObjective: element.hasAttribute("data-advance-objective"),
          rect: {
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          },
          selector,
          text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          waitMinutes: element.getAttribute("data-wait-minutes")
        };
      }

      return null;
    })()`, label);
  }

  async clickVisibleSelector(selector) {
    const target = await this.readVisibleElementRect(selector);
    assert.ok(
      target,
      `Expected visible clickable element for selector ${selector}.`,
    );
    await this.dispatchMouseClick(target.rect.centerX, target.rect.centerY);
    return target;
  }

  async clickPlayerControl() {
    const candidate = await this.readPlayerControlCandidate();
    assert.ok(
      candidate,
      "Expected a visible player control: next-step, action, or time button.",
    );
    await this.dispatchMouseClick(
      candidate.rect.centerX,
      candidate.rect.centerY,
    );
    return candidate;
  }

  async dispatchMouseClick(x, y) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
    });
    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      type: "mousePressed",
      x,
      y,
    });
    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      type: "mouseReleased",
      x,
      y,
    });
  }

  async dispatchMouseDrag(start, end, steps = 8) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: start.x,
      y: start.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      type: "mousePressed",
      x: start.x,
      y: start.y,
    });

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await this.send("Input.dispatchMouseEvent", {
        buttons: 1,
        type: "mouseMoved",
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      });
      await sleep(16);
    }

    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      type: "mouseReleased",
      x: end.x,
      y: end.y,
    });
  }

  async readDomSnapshot(label = "dom-snapshot") {
    return this.evaluateForRead(`(() => {
      const rectFromElement = (element) => {
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      };
      const rectFor = (selector) => rectFromElement(document.querySelector(selector));
      const isVisibleEnabled = (element) => {
        if (!element) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled
        );
      };
      const elementLabel = (element) => {
        if (!element) {
          return null;
        }
        const id = element.id ? "#" + element.id : "";
        const className =
          typeof element.className === "string" && element.className.trim()
            ? "." + element.className.trim().replace(/\\s+/g, ".")
            : "";
        return element.tagName.toLowerCase() + id + className;
      };
      const clippingAncestorsFor = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return [];
        }
        const rect = element.getBoundingClientRect();
        const clippedBy = [];

        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = window.getComputedStyle(ancestor);
          const clips = [style.overflow, style.overflowX, style.overflowY]
            .some((value) => ["hidden", "clip", "scroll", "auto"].includes(value));
          if (!clips) {
            continue;
          }

          const ancestorRect = ancestor.getBoundingClientRect();
          const isClipped =
            rect.left < ancestorRect.left - 1 ||
            rect.right > ancestorRect.right + 1 ||
            rect.top < ancestorRect.top - 1 ||
            rect.bottom > ancestorRect.bottom + 1;
          if (isClipped) {
            clippedBy.push({
              element: elementLabel(ancestor),
              overflow: {
                x: style.overflowX,
                y: style.overflowY,
              },
              rect: {
                bottom: Math.round(ancestorRect.bottom),
                height: Math.round(ancestorRect.height),
                left: Math.round(ancestorRect.left),
                right: Math.round(ancestorRect.right),
                top: Math.round(ancestorRect.top),
                width: Math.round(ancestorRect.width),
              },
            });
          }
        }

        return clippedBy;
      };
      const bodyText = document.body?.innerText ?? "";
      const canvas = document.querySelector("canvas");
      const canvasRect = canvas?.getBoundingClientRect();
      const rail = document.querySelector('[data-rail-root="rowan"]');
      const frameworkErrorText = [
        document.body?.textContent ?? "",
        ...Array.from(document.querySelectorAll("nextjs-portal")).map(
          (element) => element.shadowRoot?.textContent ?? element.textContent ?? ""
        ),
      ].join(" ");
      const activeTab = Array.from(document.querySelectorAll("[data-tab]"))
        .find((element) =>
          element.classList.contains("is-active") ||
          element.getAttribute("aria-pressed") === "true" ||
          element.getAttribute("aria-selected") === "true"
        );
      const fieldNotes = Array.from(document.querySelectorAll("[data-field-note]"));
      const fieldNote = document.querySelector('[data-field-note="first-afternoon"]');
      const nearbyNpcElements = Array.from(
        document.querySelectorAll('[data-locals-nearby] [data-select-npc]'),
      );
      const activeConversation = document.querySelector("[data-conversation-panel]");
      const commandRail = document.querySelector('[data-preserve-scroll="command-rail"]');
      const rowanDirective = document.querySelector('[data-rowan-directive="true"]');
      const decisionArtifact = document.querySelector("[data-visible-decision-artifact='true']");
      const rightStack = document.querySelector(".ml-right-stack");
      const chatBubbles = Array.from(document.querySelectorAll(".ml-chat-bubble"));
      const latestChatBubble = chatBubbles.at(-1) ?? null;
      const chatRows = Array.from(document.querySelectorAll(".ml-chat-row"));
      const latestChatRow = chatRows.at(-1) ?? null;
      const visibleProgressionControls = [
        "[data-advance-objective]:not([disabled])",
        "[data-action-id]:not([disabled])",
        "[data-wait-minutes]:not([disabled])"
      ].flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
          .filter(isVisibleEnabled)
          .map((element) => ({
            actionId: element.getAttribute("data-action-id"),
            advancesObjective: element.hasAttribute("data-advance-objective"),
            selector,
            text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
            waitMinutes: element.getAttribute("data-wait-minutes")
          }))
      );
      const watchModeReplyAffordances = (() => {
        if (!document.querySelector(".ml-root.is-watch-mode")) {
          return [];
        }

        const looksLikeBlueReplyAction = (element) => {
          const style = window.getComputedStyle(element);
          const paint = [style.backgroundImage, style.backgroundColor].join(" ");
          return /(?:#2f95ff|#0a84ff|rgb\\(47,\\s*149,\\s*255\\)|rgb\\(10,\\s*132,\\s*255\\))/i.test(paint);
        };

        return Array.from(
          document.querySelectorAll("[data-conversation-panel] .ml-chat-bubble.is-player"),
        )
          .filter(isVisibleEnabled)
          .filter((element) => {
            const passiveTranscript =
              element.getAttribute("data-watch-mode-transcript-line") === "rowan";
            const clickableAncestor = element.closest(
              "button,[role='button'],a[href],[data-action-id],[data-advance-objective],[data-wait-minutes]",
            );
            return !passiveTranscript || Boolean(clickableAncestor) || looksLikeBlueReplyAction(element);
          })
          .map((element) => ({
            passiveTranscript:
              element.getAttribute("data-watch-mode-transcript-line") === "rowan",
            rect: rectFromElement(element),
            text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          }));
      })();
      const rectForElements = (elements) => {
        const rects = elements
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        if (rects.length === 0) {
          return null;
        }

        const rect = {
          bottom: Math.round(Math.max(...rects.map((entry) => entry.bottom))),
          left: Math.round(Math.min(...rects.map((entry) => entry.left))),
          right: Math.round(Math.max(...rects.map((entry) => entry.right))),
          top: Math.round(Math.min(...rects.map((entry) => entry.top))),
        };
        rect.height = Math.round(rect.bottom - rect.top);
        rect.width = Math.round(rect.right - rect.left);
        return rect;
      };
      const latestChatExchange = (() => {
        if (!latestChatRow) {
          return null;
        }

        const textFor = (element) =>
          element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const bubbleTextForRow = (row) =>
          row
            .querySelector(".ml-chat-bubble")
            ?.textContent?.replace(/\\s+/g, " ")
            .trim() ?? "";
        const meaningfulRows = chatRows.filter((row) =>
          bubbleTextForRow(row),
        );
        const latestMeaningfulRow = meaningfulRows.at(-1) ?? latestChatRow;
        const latestRowIsTyping = latestChatRow !== latestMeaningfulRow;
        const preferredExchange = latestRowIsTyping
          ? [...meaningfulRows.slice(-2), latestChatRow]
          : meaningfulRows.slice(-2);
        const latestMeaningfulExchange =
          latestRowIsTyping && latestMeaningfulRow
            ? [latestMeaningfulRow, latestChatRow]
            : [latestMeaningfulRow];
        const railRect = commandRail?.getBoundingClientRect();
        const preferredElements =
          preferredExchange.length > 0 ? preferredExchange : [latestChatRow];
        const preferredRect = rectForElements(preferredElements);
        const meaningfulRect = rectForElements(latestMeaningfulExchange);
        const preferredFits = Boolean(
          preferredRect &&
            railRect &&
            preferredRect.height + 24 <= railRect.height,
        );
        const meaningfulFits = Boolean(
          meaningfulRect &&
            railRect &&
            meaningfulRect.height + 24 <= railRect.height,
        );
        const exchangeBubbles =
          preferredFits || !meaningfulFits
            ? preferredElements
            : latestMeaningfulExchange;
        const rect =
          preferredFits || !meaningfulFits ? preferredRect : meaningfulRect;
        if (!rect) {
          return null;
        }

        return {
          fitsCommandRail: railRect
            ? rect.height + 24 <= railRect.height
            : false,
          rect,
          texts: exchangeBubbles.map(textFor),
        };
      })();
      const readableDirectiveVisible = (() => {
        if (!commandRail || !rowanDirective) {
          return null;
        }
        const railRect = commandRail.getBoundingClientRect();
        const directiveRect = rowanDirective.getBoundingClientRect();
        const visibleHeight =
          Math.min(directiveRect.bottom, railRect.bottom) -
          Math.max(directiveRect.top, railRect.top);
        const minimumReadableHeight = Math.min(
          directiveRect.height,
          railRect.height,
          120
        );
        return (
          directiveRect.top >= railRect.top - 1 &&
          visibleHeight >= minimumReadableHeight - 1
        );
      })();
      const railSummaryElement = (selector) => {
        const element = document.querySelector(selector);
        return element
          ? {
              ariaExpanded: element.getAttribute("aria-expanded"),
              clippedBy: clippingAncestorsFor(selector),
              rect: rectFromElement(element),
              text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
              visible: isVisibleEnabled(element),
            }
          : null;
      };

      return {
        actionLabels: Array.from(document.querySelectorAll("[data-action-id]"))
          .map((element) => element.textContent?.replace(/\\s+/g, " ").trim() ?? "")
          .filter(Boolean),
        activeTab: activeTab?.getAttribute("data-tab") ?? null,
        bodyText,
        bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 1600),
        canvasRect: canvasRect
          ? {
              height: Math.round(canvasRect.height),
              width: Math.round(canvasRect.width),
            }
          : null,
        conversationText: activeConversation?.textContent?.replace(/\\s+/g, " ").trim() ?? null,
        fieldNoteText: fieldNote?.textContent?.replace(/\\s+/g, " ").trim() ?? null,
        fieldNotes: fieldNotes.map((element) => ({
          key: element.getAttribute("data-field-note"),
          text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
        })),
        nearbyNpcIds: nearbyNpcElements
          .map((element) => element.getAttribute("data-select-npc"))
          .filter(Boolean),
        nearbyText:
          document
            .querySelector("[data-locals-nearby]")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ?? "",
        visibleDecisionArtifact: decisionArtifact
          ? {
              source: decisionArtifact.getAttribute("data-decision-source"),
              text: decisionArtifact.textContent?.replace(/\\s+/g, " ").trim() ?? "",
              visible: isVisibleEnabled(decisionArtifact),
            }
          : null,
        hasCanvas: Boolean(canvas),
        hasFieldNote: Boolean(fieldNote),
        hasFrameworkErrorOverlay: /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(
          frameworkErrorText
        ),
        hasRail: Boolean(rail),
        watchModeReplyAffordances,
        visibleProgressionControls,
        layout: {
          chatBubbles: chatBubbles.map((element) => ({
            rect: rectFromElement(element),
            text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          })),
          clippingAncestors: {
            dockPanel: clippingAncestorsFor(".ml-dock-panel"),
            focusWindow: clippingAncestorsFor(".ml-inline-focus-window"),
            latestChatBubble: clippingAncestorsFor(".ml-chat-bubble:last-of-type"),
            rowanDirective: clippingAncestorsFor('[data-rowan-directive="true"]'),
            rightStack: clippingAncestorsFor(".ml-right-stack"),
            timePill: clippingAncestorsFor(".ml-time-pill"),
          },
          commandRail: commandRail
            ? {
                anchorVisible: readableDirectiveVisible,
                rect: rectFromElement(commandRail),
                scrollTop: Math.round(commandRail.scrollTop),
              }
            : null,
          dock: rectFor(".ml-dock"),
          dockPanel: rectFor(".ml-dock-panel"),
          fieldNotes: fieldNotes.map((element) => ({
            key: element.getAttribute("data-field-note"),
            rect: rectFromElement(element),
          })),
          focusBody: rectFor(".ml-focus-body"),
          focusWindow: rectFor(".ml-inline-focus-window"),
          latestChatExchange,
          latestChatBubble: rectFromElement(latestChatBubble),
          railSummary: rightStack
            ? {
                name: railSummaryElement(".ml-rail-name"),
                peek: railSummaryElement(".ml-rail-peek-label"),
                rect: rectFromElement(rightStack),
                state: rightStack.getAttribute("data-rail-state"),
                status: railSummaryElement(".ml-rail-status"),
                thought: railSummaryElement(".ml-rail-thought"),
                toggle: railSummaryElement(".ml-rail-toggle"),
                viewport: rightStack.getAttribute("data-rail-viewport"),
              }
            : null,
          rowanDirective: rectFromElement(rowanDirective),
          document: {
            clientHeight: document.documentElement.clientHeight,
            clientWidth: document.documentElement.clientWidth,
            scrollHeight: document.documentElement.scrollHeight,
            scrollWidth: document.documentElement.scrollWidth,
          },
          rightStack: rectFor(".ml-right-stack"),
          timePill: rectFor(".ml-time-pill"),
          viewport: {
            height: window.innerHeight,
            width: window.innerWidth,
          },
        },
        tabLabels: Array.from(document.querySelectorAll("[data-tab]"))
          .map((element) => element.textContent?.replace(/\\s+/g, " ").trim() ?? "")
          .filter(Boolean),
      };
    })()`, label);
  }

  async clickSelector(selector) {
    return this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        return false;
      }
      element.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      return true;
    })()`);
  }

  async inspectAppReadiness() {
    return this.evaluateForRead(`(() => {
      const bodyText = document.body?.innerText ?? "";
      const bodyContent = document.body?.textContent ?? "";
      const textFor = (element, limit = 1000) =>
        element?.textContent?.replace(/\\s+/g, " ").trim().slice(0, limit) ?? "";
      const rectFor = (element) => {
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        };
      };
      const isVisible = (element) => {
        if (!element) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };
      const canvases = Array.from(document.querySelectorAll("canvas"));
      const probe = document.querySelector("#ml-browser-probe");
      const rail = document.querySelector(".ml-rail-shell");
      const root = document.querySelector(".ml-root");
      const overlaySelectors = [
        "nextjs-portal",
        "[data-nextjs-dialog-overlay]",
        "[data-nextjs-toast]",
        "[data-nextjs-errors-dialog-left-right]",
        "#webpack-dev-server-client-overlay"
      ];
      const overlays = overlaySelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector)).map((element) => ({
          rect: rectFor(element),
          selector,
          textSample: textFor(element, 1000),
          visible: isVisible(element)
        }))
      );
      const overlayText = overlays
        .map((overlay) => overlay.textSample)
        .filter(Boolean)
        .join(" ");
      const frameworkText = overlayText + " " + bodyContent;
      return {
        bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 1600),
        canvasCount: canvases.length,
        canvasRects: canvases.slice(0, 4).map((canvas) => ({
          rect: rectFor(canvas),
          visible: isVisible(canvas)
        })),
        document: {
          clientHeight: document.documentElement.clientHeight,
          clientWidth: document.documentElement.clientWidth,
          readyState: document.readyState,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
        },
        frameworkOverlayTextSample: overlayText.slice(0, 1200),
        hasCanvas: canvases.length > 0,
        hasFrameworkOverlay: /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(frameworkText),
        hasMapAgencyProbe: Boolean(document.querySelector("#ml-browser-map-agency-probe")),
        hasProbe: Boolean(probe),
        hasProbeFunction: typeof window.__manyLivesStreetProbe === "function",
        hasRail: Boolean(rail),
        hasRightStack: Boolean(document.querySelector(".ml-right-stack")),
        hasRoot: Boolean(root),
        hasRowanText: bodyText.includes("Rowan"),
        hasTimePill: Boolean(document.querySelector(".ml-time-pill")),
        looksLikeNotFound: /404|This page could not be found|Not Found/i.test(bodyText),
        looksLikeStillCompiling: /Compiling|Loading|webpack|Turbopack|building/i.test(frameworkText),
        overlayCount: overlays.length,
        overlays,
        probeTextLength: probe?.textContent?.length ?? 0,
        probeTextSample: probe?.textContent?.replace(/\\s+/g, " ").trim().slice(0, 600) ?? "",
        railRect: rectFor(rail),
        railTextSample: textFor(rail, 1200),
        rootClass: root?.className ?? "",
        title: document.title,
        url: location.href,
        visibleCanvasCount: canvases.filter(isVisible).length,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth,
        }
      };
    })()`, "app-readiness");
  }

  async writeProbeTimeoutDiagnostics({ lastError, lastState, timeoutMs }) {
    await mkdir(this.outputDir, { recursive: true });
    const timestamp = Date.now();
    const screenshotPath = path.join(
      this.outputDir,
      `probe-timeout-${timestamp}.png`,
    );
    const diagnosticsPath = path.join(
      this.outputDir,
      `probe-timeout-${timestamp}.json`,
    );
    let screenshot = screenshotPath;
    let screenshotError = null;

    try {
      await this.captureScreenshot(screenshotPath);
    } catch (error) {
      screenshot = null;
      screenshotError = error instanceof Error ? error.message : String(error);
    }

    const diagnostics = {
      currentUrl: lastState?.url ?? null,
      lastError,
      lastState,
      pageErrors: this.pageErrors.slice(-20),
      requestedUrl: this.url,
      screenshot,
      screenshotError,
      timedOutAt: new Date().toISOString(),
      timeoutMs,
    };

    await writeFile(
      diagnosticsPath,
      `${JSON.stringify(diagnostics, null, 2)}\n`,
      "utf8",
    );

    return {
      diagnostics,
      diagnosticsPath,
      screenshot,
    };
  }

  async waitForProbe() {
    const startedAt = Date.now();
    let lastError = null;
    let lastState = null;

    while (Date.now() - startedAt < APP_READY_TIMEOUT_MS) {
      try {
        const probe = await this.readBrowserProbe();
        if (probe) {
          return probe;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      try {
        lastState = await this.inspectAppReadiness();
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        lastState = {
          error: lastError,
        };
      }

      await sleep(PROBE_POLL_INTERVAL_MS);
    }

    const { diagnostics, diagnosticsPath, screenshot } =
      await this.writeProbeTimeoutDiagnostics({
        lastError,
        lastState,
        timeoutMs: APP_READY_TIMEOUT_MS,
      });
    const screenshotDetail = screenshot
      ? ` Screenshot: ${screenshot}.`
      : ` Screenshot capture failed: ${diagnostics.screenshotError}.`;

    throw new Error(
      `Timed out after ${APP_READY_TIMEOUT_MS}ms waiting for the browser probe ` +
        `(#ml-browser-probe or window.__manyLivesStreetProbe) to appear. ` +
        `Diagnostics: ${diagnosticsPath}.${screenshotDetail} Last state: ${JSON.stringify(
          diagnostics.lastState,
        )}`,
    );
  }

  async waitForGame(game) {
    const startedAt = Date.now();
    let lastMismatch = null;
    let lastProbe = null;
    let playbackProgress = createStagedWorkPlaybackWaitProgress();

    while (
      shouldContinueGameWait({
        elapsedMs: Date.now() - startedAt,
        playbackProgress,
      })
    ) {
      try {
        const probe = await this.readBrowserProbe();
        if (probe) {
          lastProbe = probe;
        }
        playbackProgress = recordStagedWorkPlaybackWaitProgress({
          elapsedMs: Date.now() - startedAt,
          game,
          playbackProgress,
          probe,
        });
        if (
          browserProbeMatchesGameSnapshot(probe, game) ||
          browserProbeMatchesProgressiveSnapshot(probe, game)
        ) {
          return probe;
        }
        if (browserProbeMatchesGameCoreSnapshot(probe, game)) {
          try {
            assertBrowserProbeMatchesGame("browser-settle", game, probe, {
              allowPendingPlayback: true,
            });
          } catch (error) {
            lastMismatch =
              error instanceof Error ? error.message : String(error);
          }
        }
      } catch (error) {
        lastMismatch = error instanceof Error ? error.message : String(error);
      }

      await sleep(PROBE_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for browser session to catch up to ${game.currentTime} / ${game.rowanAutonomy.label}. Last probe: ${JSON.stringify(
        compactBrowserProbeForWait(lastProbe),
        null,
        2,
      )} Playback progress: ${JSON.stringify(
        compactStagedWorkPlaybackWaitProgress(
          playbackProgress,
          Date.now() - startedAt,
        ),
      )}${lastMismatch ? ` Last mismatch: ${lastMismatch}` : ""}`,
    );
  }

  async waitForVisualMove(previousGame, nextGame) {
    const startedAt = Date.now();
    let lastProbe = null;

    while (Date.now() - startedAt < SIM_WAIT_TIMEOUT_MS) {
      try {
        const probe = await this.readBrowserProbe();
        if (probe) {
          lastProbe = probe;
        }

        const matchingGame = matchingGameSnapshotForProbe(
          probe,
          previousGame,
          nextGame,
        );
        if (
          matchingGame &&
          probe.movement?.playerRoute?.active === true &&
          probe.movement?.playerRoute?.worldPath?.length >= 2
        ) {
          return probe;
        }
      } catch {}

      await sleep(PROBE_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for browser session to stage visual movement from ${previousGame.player.x},${previousGame.player.y} to ${nextGame.player.x},${nextGame.player.y}. Last probe: ${JSON.stringify(
        lastProbe
          ? compactBrowserProbeForWait(lastProbe)
          : null,
        null,
        2,
      )}`,
    );
  }

  async waitForVisualRouteProgress(
    previousGame,
    nextGame,
    minimumProgress,
    options = {},
  ) {
    const startedAt = Date.now();
    let lastProbe = null;
    let bestRouteProbe = options.fallbackProbe ?? null;

    while (Date.now() - startedAt < SIM_WAIT_TIMEOUT_MS) {
      try {
        const probe = await this.readBrowserProbe();
        if (probe) {
          lastProbe = probe;
        }
        const route = probe?.movement?.playerRoute;
        const matchingGame = matchingGameSnapshotForProbe(
          probe,
          previousGame,
          nextGame,
        );
        if (matchingGame && route?.active === true) {
          const bestProgress =
            bestRouteProbe?.movement?.playerRoute?.progress ?? -1;
          if (route.progress >= bestProgress) {
            bestRouteProbe = probe;
          }
          if (route.progress >= minimumProgress) {
            return probe;
          }
        }
        const routeSnapshotSettled =
          bestRouteProbe &&
          route?.active !== true &&
          (browserProbeMatchesGameCoreSnapshot(probe, previousGame) ||
            browserProbeMatchesGameCoreSnapshot(probe, nextGame));
        if (
          routeSnapshotSettled ||
          (browserProbeMatchesGameSnapshot(probe, nextGame) && bestRouteProbe)
        ) {
          return bestRouteProbe;
        }
      } catch {}

      await sleep(PROBE_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for visual route progress >= ${minimumProgress} from ${previousGame.player.x},${previousGame.player.y} to ${nextGame.player.x},${nextGame.player.y}. Last probe: ${JSON.stringify(
        compactBrowserProbeForWait(lastProbe),
        null,
        2,
      )}`,
    );
  }

  async waitForVisualMoveSettlement(previousGame, nextGame) {
    const startedAt = Date.now();
    let lastProbe = null;

    while (Date.now() - startedAt < SIM_WAIT_TIMEOUT_MS) {
      try {
        const probe = await this.readBrowserProbe();
        if (probe) {
          lastProbe = probe;
        }
        if (
          browserProbeMatchesGameCoreSnapshot(probe, nextGame) &&
          probe?.movement?.playerRoute?.active !== true &&
          probe?.visualPlayer?.isMovingToServerState !== true
        ) {
          return probe;
        }
      } catch {}

      await sleep(PROBE_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for visual movement to settle from ${previousGame.player.x},${previousGame.player.y} to ${nextGame.player.x},${nextGame.player.y}. Last probe: ${JSON.stringify(
        compactBrowserProbeForWait(lastProbe),
        null,
        2,
      )}`,
    );
  }

  async captureScreenshot(targetPath) {
    const validateTextPaint = shouldValidateGameplayScreenshotPaint(targetPath);
    const readPaintProbe = validateTextPaint
      ? () => this.evaluateForRead(`(() => {
          const selectors = [
            ["hud", ".ml-time-chip"],
            ["dock", ".ml-dock-button"],
            ["rail", ".ml-rail-name"],
            ["rail", ".ml-rail-thought"],
            ["rail", ".ml-command-rail .ml-kicker"]
          ];
          const regions = selectors.flatMap(([surface, selector]) =>
            Array.from(document.querySelectorAll(selector)).flatMap((element) => {
              const style = window.getComputedStyle(element);
              if (
                style.visibility === "hidden" ||
                style.display === "none"
              ) {
                return [];
              }
              const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
              const textRegions = [];
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const text = node.textContent?.replace(/\\s+/g, " ").trim() ?? "";
                if (!text) {
                  continue;
                }
                const range = document.createRange();
                range.selectNodeContents(node);
                const rect = range.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                  continue;
                }
                const insideViewport =
                  rect.left >= 0 &&
                  rect.right <= window.innerWidth &&
                  rect.top >= 0 &&
                  rect.bottom <= window.innerHeight;
                const insideClippingAncestors = (() => {
                  for (
                    let ancestor = element.parentElement;
                    ancestor;
                    ancestor = ancestor.parentElement
                  ) {
                    const ancestorStyle = window.getComputedStyle(ancestor);
                    const clips = [
                      ancestorStyle.overflow,
                      ancestorStyle.overflowX,
                      ancestorStyle.overflowY
                    ].some((value) =>
                      ["hidden", "clip", "scroll", "auto"].includes(value)
                    );
                    if (!clips) {
                      continue;
                    }
                    const ancestorRect = ancestor.getBoundingClientRect();
                    if (
                      rect.left < ancestorRect.left ||
                      rect.right > ancestorRect.right ||
                      rect.top < ancestorRect.top ||
                      rect.bottom > ancestorRect.bottom
                    ) {
                      return false;
                    }
                  }
                  return true;
                })();
                if (!insideViewport || !insideClippingAncestors) {
                  continue;
                }
                textRegions.push({
                  rect: {
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top
                  },
                  surface,
                  text
                });
              }
              return textRegions;
            })
          );
          return {
            regions,
            viewport: { height: window.innerHeight, width: window.innerWidth }
          };
        })()`, `screenshot-paint-probe:${path.basename(targetPath)}`)
      : async () => null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const paintProbeBefore = await readPaintProbe();
      const response = await this.send("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
        fromSurface: true,
      });
      const data = response?.result?.data;
      if (!data) {
        throw new Error("Chrome did not return screenshot data.");
      }

      const buffer = Buffer.from(data, "base64");
      await writeFile(targetPath, buffer);
      const paintProbeAfter = await readPaintProbe();
      try {
        assertNoLargeNearBlackDropout(buffer, path.basename(targetPath));
        if (paintProbeBefore && paintProbeAfter) {
          const paintProbe = mergeScreenshotPaintProbes(
            paintProbeBefore,
            paintProbeAfter,
            path.basename(targetPath),
          );
          assertVisibleScreenshotTextPaint(
            buffer,
            paintProbe,
            path.basename(targetPath),
          );
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          process.stdout.write(
            `[many-lives] Retrying incomplete browser screenshot ${path.basename(targetPath)} (${attempt}/3).\n`,
          );
          await sleep(180);
        }
      }
    }

    throw lastError;
  }

  waitForEvent(method) {
    return new Promise((resolve) => {
      const listeners = this.eventListeners.get(method) ?? [];
      listeners.push(resolve);
      this.eventListeners.set(method, listeners);
    });
  }

  async send(method, params = {}) {
    this.messageId += 1;
    const id = this.messageId;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });

    this.writeFrame(payload);
    return withTimeout(
      promise.finally(() => {
        this.pending.delete(id);
      }),
      CDP_WAIT_TIMEOUT_MS,
      `Timed out waiting for Chrome DevTools response for ${method}.`,
    );
  }

  writeHandshake() {
    const websocketKey = randomBytes(16).toString("base64");
    const pathWithQuery = `${this.pageWsUrl.pathname}${this.pageWsUrl.search}`;

    this.socket.write(
      [
        `GET ${pathWithQuery} HTTP/1.1`,
        `Host: ${this.pageWsUrl.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${websocketKey}`,
        "Sec-WebSocket-Version: 13",
        "\r\n",
      ].join("\r\n"),
    );
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.handshakeComplete) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.buffer.slice(0, headerEnd).toString("utf8");
      if (!/^HTTP\/1\.1 101\b/i.test(headerText)) {
        throw new Error(`Chrome DevTools handshake failed: ${headerText}`);
      }

      this.handshakeComplete = true;
      this.buffer = this.buffer.slice(headerEnd + 4);
    }

    while (true) {
      const frame = this.readFrame();
      if (!frame) {
        return;
      }

      if (frame.opcode === 0x9) {
        this.writeControlFrame(0xa, frame.payload);
        continue;
      }

      if (frame.opcode === 0x8) {
        return;
      }

      if (frame.opcode !== 0x1) {
        continue;
      }

      const message = JSON.parse(frame.payload.toString("utf8"));
      if (message.method === "Runtime.exceptionThrown") {
        this.recordPageError({
          method: message.method,
          text:
            message.params?.exceptionDetails?.exception?.description ??
            message.params?.exceptionDetails?.text ??
            "Runtime exception",
        });
      } else if (
        message.method === "Log.entryAdded" &&
        message.params?.entry?.level === "error"
      ) {
        this.recordPageError({
          method: message.method,
          text: message.params.entry.text ?? "Browser log error",
        });
      } else if (
        message.method === "Runtime.consoleAPICalled" &&
        ["assert", "error"].includes(message.params?.type)
      ) {
        this.recordPageError({
          method: message.method,
          stack: (message.params?.stackTrace?.callFrames ?? [])
            .slice(0, 12)
            .map(
              (frame) =>
                `${frame.functionName || "(anonymous)"}@${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`,
            ),
          text: (message.params?.args ?? [])
            .map((argument) => {
              if (typeof argument.value === "string") {
                return argument.value;
              }
              return (
                argument.description ?? JSON.stringify(argument.value ?? null)
              );
            })
            .join(" ")
            .trim(),
        });
      }

      if (message.id) {
        const deferred = this.pending.get(message.id);
        if (deferred) {
          this.pending.delete(message.id);
          deferred.resolve(message);
        }
        continue;
      }

      const listeners = this.eventListeners.get(message.method);
      if (listeners?.length) {
        const nextListener = listeners.shift();
        if (listeners.length === 0) {
          this.eventListeners.delete(message.method);
        }
        nextListener?.(message);
      }
    }
  }

  readFrame() {
    if (this.buffer.length < 2) {
      return null;
    }

    const firstByte = this.buffer[0];
    const secondByte = this.buffer[1];
    let offset = 2;
    let payloadLength = secondByte & 0x7f;

    if (payloadLength === 126) {
      if (this.buffer.length < offset + 2) {
        return null;
      }
      payloadLength = this.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (this.buffer.length < offset + 8) {
        return null;
      }
      const high = this.buffer.readUInt32BE(offset);
      const low = this.buffer.readUInt32BE(offset + 4);
      payloadLength = high * 2 ** 32 + low;
      offset += 8;
    }

    const masked = (secondByte & 0x80) !== 0;
    let mask;
    if (masked) {
      if (this.buffer.length < offset + 4) {
        return null;
      }
      mask = this.buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (this.buffer.length < offset + payloadLength) {
      return null;
    }

    const payload = this.buffer.slice(offset, offset + payloadLength);
    this.buffer = this.buffer.slice(offset + payloadLength);

    if (masked && mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    return {
      fin: (firstByte & 0x80) !== 0,
      opcode: firstByte & 0x0f,
      payload,
    };
  }

  writeControlFrame(opcode, payload = Buffer.alloc(0)) {
    this.socket.write(
      Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]),
    );
  }

  recordPageError(error) {
    this.pageErrors.push({
      recordedAt: new Date().toISOString(),
      ...error,
    });
    if (this.pageErrors.length > 40) {
      this.pageErrors.splice(0, this.pageErrors.length - 40);
    }
  }

  writeFrame(text) {
    const payload = Buffer.from(text, "utf8");
    const mask = randomBytes(4);
    let header;

    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
    }

    const maskedPayload = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 1) {
      maskedPayload[index] = payload[index] ^ mask[index % 4];
    }

    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
  }
}

async function launchBrowserSession(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= CHROME_START_ATTEMPTS; attempt += 1) {
    try {
      return await launchBrowserSessionAttempt(url, attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= CHROME_START_ATTEMPTS) {
        break;
      }

      process.stderr.write(
        `[many-lives] Chrome DevTools startup attempt ${attempt}/${CHROME_START_ATTEMPTS} failed; retrying with a fresh profile.\n`,
      );
      await sleep(CHROME_START_RETRY_DELAY_MS);
    }
  }

  throw (
    lastError ??
    new Error(
      `Chrome DevTools did not start after ${CHROME_START_ATTEMPTS} attempts.`,
    )
  );
}

async function launchBrowserSessionAttempt(url, attempt) {
  const userDataDir = path.join(
    OUTPUT_DIR,
    attempt === 1 ? "chrome-session" : `chrome-session-retry-${attempt}`,
  );
  const devtoolsPort = FIXED_DEVTOOLS_PORT ?? (await reserveAvailablePort());
  const browser = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,MediaRouter,Translate",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-pings",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${WINDOW_SIZE}`,
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${devtoolsPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  browser.manyLivesKillGroup = process.platform !== "win32";

  let browserStderr = "";
  let browserStartError = null;
  let browserExit = null;
  browser.once("error", (error) => {
    browserStartError = error;
  });
  browser.once("exit", (code, signal) => {
    browserExit = { code, signal };
  });
  browser.stderr?.on("data", (chunk) => {
    browserStderr += chunk.toString();
    if (browserStderr.length > 12_000) {
      browserStderr = browserStderr.slice(-12_000);
    }
  });

  let pageWsUrl;
  try {
    pageWsUrl = await waitFor(
      async () => {
        if (browserStartError) {
          throw browserStartError;
        }

        try {
          const targets = await fetchJson(
            `http://127.0.0.1:${devtoolsPort}/json/list`,
          );
          const page = targets.find((target) => target.type === "page");
          return page?.webSocketDebuggerUrl ?? null;
        } catch {
          return null;
        }
      },
      CDP_WAIT_TIMEOUT_MS,
      `Timed out waiting for Chrome DevTools on port ${devtoolsPort}.`,
    );
  } catch (error) {
    await closeChildProcess(browser);
    const diagnostic = {
      attempt,
      attempts: CHROME_START_ATTEMPTS,
      chromeBin: CHROME_BIN,
      devtoolsPort,
      exit: browserExit,
      spawnError: browserStartError
        ? {
            code: browserStartError.code ?? null,
            message: browserStartError.message,
            name: browserStartError.name,
          }
        : null,
      stderr: browserStderr.trim() || null,
    };
    await writeFile(
      path.join(OUTPUT_DIR, `chrome-startup-attempt-${attempt}.json`),
      `${JSON.stringify(diagnostic, null, 2)}\n`,
      "utf8",
    ).catch(() => {});
    throw new Error(
      `Chrome DevTools startup attempt ${attempt}/${CHROME_START_ATTEMPTS} failed: ${
        error instanceof Error ? error.message : String(error)
      } Diagnostic: ${JSON.stringify(diagnostic)}`,
      { cause: error },
    );
  }

  const session = new CdpSession({
    browser,
    outputDir: OUTPUT_DIR,
    pageWsUrl,
    url,
  });
  await session.connect();
  return session;
}

function shouldCaptureScreenshot(label) {
  if (CAPTURE_ALL_CHROME_STEPS) {
    return true;
  }

  if (/-route-(start|mid|close)$/.test(label)) {
    return true;
  }

  return new Set([
    "initial-morrow-exterior",
    "enter-morrow-house",
    "mara-live-thread",
    "head-to-cafe-plan",
    "exit-morrow-house",
    "stage-cafe-move",
    "arrive-cafe-door",
    "enter-cafe-interior",
    "ada-live-thread",
    "ada-thread-landed",
    "hold-for-shift",
    "lunch-rush",
    "finish-shift",
    "head-home",
    "exit-cafe-interior",
    "arrive-home",
    "enter-morrow-return",
    "first-afternoon-complete",
    "post-first-afternoon-handoff",
    "post-first-afternoon-rest",
    "post-first-afternoon-live-route",
  ]).has(label);
}

function shouldCaptureCloseConversationRoute(label) {
  return new Set(["mara-live-thread", "ada-live-thread"]).has(label);
}

function normalizeNullable(value) {
  return value ?? null;
}

function locationForGame(game) {
  return game.locations.find(
    (location) => location.id === game.player.currentLocationId,
  );
}

function playerPositionChanged(previousGame, nextGame) {
  return (
    previousGame.id === nextGame.id &&
    (previousGame.activeSpaceId ?? previousGame.player.spaceId ?? null) ===
      (nextGame.activeSpaceId ?? nextGame.player.spaceId ?? null) &&
    (previousGame.player.x !== nextGame.player.x ||
      previousGame.player.y !== nextGame.player.y)
  );
}

function buildProbeFromGame(game) {
  const currentLocation = locationForGame(game);
  const activeConversation = game.activeConversation;

  return {
    activeConversation: activeConversation
      ? {
          lines: activeConversation.lines.length,
          npcId: activeConversation.npcId,
          npcName:
            game.npcs.find((npc) => npc.id === activeConversation.npcId)
              ?.name ?? null,
          updatedAt: activeConversation.updatedAt,
        }
      : null,
    aiRuntime: aiRuntimeProbeFromGame(game),
    autonomy: {
      actionId: game.rowanAutonomy.actionId ?? null,
      autoContinue: game.rowanAutonomy.autoContinue,
      effects: game.rowanAutonomy.effects ?? [],
      intent: game.rowanAutonomy.intent
        ? {
            reason: game.rowanAutonomy.intent.reason,
            signals: game.rowanAutonomy.intent.signals,
          }
        : null,
      key: game.rowanAutonomy.key,
      label: game.rowanAutonomy.label,
      layer: game.rowanAutonomy.layer ?? null,
      mode: game.rowanAutonomy.mode,
      npcId: game.rowanAutonomy.npcId ?? null,
      planningTrace: planningTraceProbeFromGame(game),
      stepKind: game.rowanAutonomy.stepKind,
      targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
      travelPhase: game.rowanAutonomy.travelPhase ?? null,
      visibleDecisionArtifact: visibleDecisionArtifactFromGame(game),
    },
    cityEvents: activeCityEvents(game),
    clock: {
      iso: game.currentTime,
      label: game.clock.label,
      totalMinutes: game.clock.totalMinutes,
    },
    feedTail: (game.feed ?? []).slice(0, 8).map((entry) => ({
      id: entry.id,
      text: entry.text,
      time: entry.time,
      tone: entry.tone,
    })),
    gameId: game.id,
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      spaceId: game.activeSpaceId ?? game.player.spaceId ?? null,
      x: game.player.x,
      y: game.player.y,
    },
    memoriesTail: (game.player.memories ?? []).slice(0, 8).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      text: entry.text,
      time: entry.time,
    })),
    objective: objectiveProbeFromGame(game),
    worldPressure: worldPressureFromGame(game),
    visualPlayer: {
      isMovingToServerState: false,
      targetX: game.player.x,
      targetY: game.player.y,
    },
    playback: {
      activeKind: null,
      activeTitle: null,
      justHappened: null,
      queuedCount: 0,
    },
    rail: {
      justHappened: null,
      next: null,
      now: game.rowanAutonomy.label,
      status: game.rowanAutonomy.autoContinue
        ? "Autoplay"
        : game.currentScene.title,
      thought:
        game.rowanAutonomy.detail ??
        game.summary ??
        game.player.objective?.text ??
        "",
      useConversationTranscript: Boolean(activeConversation),
      visibleDecisionArtifact: visibleDecisionArtifactFromGame(game),
    },
  };
}

function aiRuntimeProbeFromGame(game) {
  return game.aiRuntime
    ? {
        fallbackReasons: game.aiRuntime.fallbackReasons,
        lastLiveCallAt: game.aiRuntime.lastLiveCallAt ?? null,
        lastUpdatedAt: game.aiRuntime.lastUpdatedAt ?? null,
        model: game.aiRuntime.model,
        provider: game.aiRuntime.provider,
        status: game.aiRuntime.status,
        tasks: game.aiRuntime.tasks,
        totalFallbacks: game.aiRuntime.totalFallbacks,
        totalSkips: game.aiRuntime.totalSkips,
        totalSuccesses: game.aiRuntime.totalSuccesses,
      }
    : null;
}

function objectiveProbeFromGame(game) {
  const objective = game.player.objective;
  return {
    focus: objective?.focus ?? null,
    outcomes:
      objective?.outcomes.map((outcome) => ({
        actionId: outcome.actionId ?? null,
        authority: outcome.authority ?? null,
        blockers: outcome.blockers ?? [],
        evidence: outcome.evidence ?? null,
        id: outcome.id,
        label: outcome.label,
        npcId: outcome.npcId ?? null,
        status: outcome.status,
        targetLocationId: outcome.targetLocationId ?? null,
        urgency: outcome.urgency,
      })) ?? [],
    progress: objective?.progress ?? null,
    routeKey: objective?.routeKey ?? null,
    source: objective?.source ?? null,
    text: objective?.text ?? null,
    trailHints:
      objective?.trail.map((hint) => ({
        actionId: hint.actionId ?? null,
        done: Boolean(hint.done),
        id: hint.id,
        npcId: hint.npcId ?? null,
        targetLocationId: hint.targetLocationId ?? null,
        title: hint.title,
      })) ?? [],
  };
}

function planningTraceProbeFromGame(game) {
  const trace = game.rowanAutonomy.planningTrace;
  if (!trace) {
    return null;
  }

  const optionPayload = (option) => ({
    actionId: option.actionId ?? null,
    label: option.label,
    legalBacking: option.legalBacking
      ? {
          actionId: option.legalBacking.actionId ?? null,
          locationId: option.legalBacking.locationId ?? null,
          source: option.legalBacking.source ?? null,
        }
      : null,
    matchedOutcomeId: option.matchedOutcomeId ?? null,
    npcId: option.npcId ?? null,
    planKey: option.planKey ?? null,
    pressureId: option.pressureId ?? null,
    pressureKind: option.pressureKind ?? null,
    pressureLabel: option.pressureLabel ?? null,
    provenance: option.provenance ?? null,
    rationale: option.rationale,
    reason: option.reason ?? null,
    score: option.score,
    status: option.status,
    targetLocationId: option.targetLocationId ?? null,
  });
  const stepPayload = (step) => ({
    actionId: step.actionId ?? null,
    kind: step.kind,
    label: step.label,
    legal: step.legal,
    legalBacking: step.legalBacking
      ? {
          actionId: step.legalBacking.actionId ?? null,
          locationId: step.legalBacking.locationId ?? null,
          source: step.legalBacking.source ?? null,
        }
      : null,
    npcId: step.npcId ?? null,
    rationale: step.rationale,
    targetLocationId: step.targetLocationId ?? null,
    validation: step.validation,
  });

  return {
    blockers: trace.blockers,
    considered: trace.considered.map(optionPayload),
    immediateAction: trace.immediateAction
      ? stepPayload(trace.immediateAction)
      : null,
    intendedFollowUp: trace.intendedFollowUp
      ? stepPayload(trace.intendedFollowUp)
      : null,
    nextSteps: (trace.nextSteps ?? []).map(stepPayload),
    outcomes: trace.outcomes.map((outcome) => ({
      authority: outcome.authority ?? null,
      blockers: outcome.blockers ?? [],
      evidence: outcome.evidence ?? null,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      urgency: outcome.urgency,
    })),
    plannerIntent: trace.plannerIntent
      ? {
          actionId: trace.plannerIntent.actionId ?? null,
          label: trace.plannerIntent.label,
          matchedOutcomeId: trace.plannerIntent.matchedOutcomeId ?? null,
          npcId: trace.plannerIntent.npcId ?? null,
          planKey: trace.plannerIntent.planKey ?? null,
          pressureId: trace.plannerIntent.pressureId ?? null,
          pressureKind: trace.plannerIntent.pressureKind ?? null,
          pressureLabel: trace.plannerIntent.pressureLabel ?? null,
          rationale: trace.plannerIntent.rationale,
          targetLocationId: trace.plannerIntent.targetLocationId ?? null,
        }
      : null,
    providerAttempt: trace.providerAttempt
      ? {
          model: trace.providerAttempt.model,
          outcome: trace.providerAttempt.outcome,
          provider: trace.providerAttempt.provider,
          reasonCode: trace.providerAttempt.reasonCode ?? null,
          task: trace.providerAttempt.task,
        }
      : null,
    rejected: trace.rejected.map(optionPayload),
    selectedActionId: trace.selectedActionId ?? null,
    selectedLabel: trace.selectedLabel ?? null,
    selectedLegalBacking: trace.selectedLegalBacking
      ? {
          actionId: trace.selectedLegalBacking.actionId ?? null,
          locationId: trace.selectedLegalBacking.locationId ?? null,
          source: trace.selectedLegalBacking.source ?? null,
        }
      : null,
    selectedMatchedOutcomeId: trace.selectedMatchedOutcomeId ?? null,
    selectedPlanKey: trace.selectedPlanKey ?? null,
    selectedPressureId: trace.selectedPressureId ?? null,
    selectedPressureKind: trace.selectedPressureKind ?? null,
    selectedPressureLabel: trace.selectedPressureLabel ?? null,
    selectedRecommendation: trace.selectedRecommendation
      ? {
          accepted: trace.selectedRecommendation.accepted,
          advisory: trace.selectedRecommendation.advisory,
          confidence: trace.selectedRecommendation.confidence ?? null,
          legalBackingSource:
            trace.selectedRecommendation.legalBackingSource ?? null,
          model: trace.selectedRecommendation.model ?? null,
          provider: trace.selectedRecommendation.provider ?? null,
          rationale: trace.selectedRecommendation.rationale ?? null,
          sourceKind: trace.selectedRecommendation.sourceKind,
          validationSource:
            trace.selectedRecommendation.validationSource ?? null,
          validationStatus: trace.selectedRecommendation.validationStatus,
        }
      : null,
    sourceLabel:
      trace.selectedRecommendation?.sourceKind === "live-llm"
        ? "live"
        : trace.selectedRecommendation?.sourceKind ===
            "deterministic-fallback"
          ? "deterministic fallback"
          : "deterministic",
    selectedTargetLocationId: trace.selectedTargetLocationId ?? null,
  };
}

function visibleDecisionArtifactFromGame(game) {
  const trace = game.rowanAutonomy?.planningTrace ?? null;
  const conversationDecision = game.activeConversation?.decision ?? null;
  const autonomyReason = game.rowanAutonomy?.intent?.reason ?? null;
  const travelPhase = game.rowanAutonomy?.travelPhase ?? null;

  if (!trace && !conversationDecision) {
    return null;
  }

  const selectedOption = selectedPlanningTraceOption(trace);
  const selectedStep =
    trace?.nextSteps?.find(
      (step) =>
        trace.selectedActionId && step.actionId === trace.selectedActionId,
    ) ??
    trace?.nextSteps?.[0] ??
    null;
  const selectedRuntimeActionLabel =
    trace?.selectedActionId &&
    game.rowanAutonomy?.actionId === trace.selectedActionId
      ? game.rowanAutonomy?.label
      : undefined;
  const backingSummary = visibleDecisionBackingSummary(
    trace?.selectedLegalBacking ??
      selectedOption?.legalBacking ??
      selectedStep?.legalBacking ??
      null,
    Boolean(trace),
  );
  const objective = compactVisibleDecisionText(
    trace?.selectedPressureLabel ??
      trace?.outcomes?.find((outcome) => outcome.status !== "met")?.label ??
      game.player.objective?.text ??
      conversationDecision ??
      game.rowanAutonomy?.label,
    112,
  );
  const selectedActionBase = compactVisibleDecisionText(
    selectedRuntimeActionLabel ??
      selectedStep?.label ??
      trace?.selectedLabel ??
      selectedOption?.label ??
      game.rowanAutonomy?.label,
    72,
  );
  const selectedAction =
    travelPhase === "route-progress" && selectedActionBase
      ? compactVisibleDecisionText(
          `Following through: ${selectedActionBase}`,
          72,
        )
      : selectedActionBase;
  const selectedFollowUpLabel = compactVisibleDecisionText(
    selectedRuntimeActionLabel &&
      selectedStep?.label &&
      selectedStep.label !== selectedRuntimeActionLabel
      ? selectedStep.label
      : selectedRuntimeActionLabel &&
          selectedOption?.label &&
          selectedOption.label !== selectedRuntimeActionLabel
        ? selectedOption.label
        : undefined,
    44,
  );
  const rationaleBase = compactVisibleDecisionText(
    selectedFollowUpLabel
      ? `${selectedFollowUpLabel}: ${
          selectedOption?.rationale ??
          selectedStep?.rationale ??
          autonomyReason ??
          conversationDecision
        }`
      : (selectedOption?.rationale ??
          selectedStep?.rationale ??
          autonomyReason ??
          conversationDecision),
    132,
  );
  const rationale =
    travelPhase === "route-progress"
      ? compactVisibleDecisionText(
          autonomyReason ??
            "Rowan is carrying out the route he already validated.",
          132,
        )
      : rationaleBase;
  const nextCheck = visibleDecisionNextCheck(
    trace,
    selectedStep,
    selectedAction,
  );

  if (!objective || !selectedAction || !rationale) {
    return null;
  }

  return {
    backingSummary,
    considered: uniqueVisibleDecisionTexts(
      [
        ...(trace?.considered ?? []).map(visibleConsideredOptionText),
        ...(trace?.nextSteps ?? []).map((step) => step.label),
        trace ? undefined : selectedAction,
      ],
      3,
      64,
    ),
    constraints: uniqueVisibleDecisionTexts(
      [
        ...(game.rowanAutonomy?.intent?.signals ?? []),
        selectedOption?.pressureLabel,
        selectedStep?.validation,
        conversationDecision,
        backingSummary,
      ],
      3,
      78,
    ),
    ...(nextCheck ? { nextCheck } : {}),
    objective,
    passedOver: uniqueVisibleDecisionTexts(
      [...(trace?.rejected ?? []).map(visibleRejectedOptionText)],
      2,
      72,
    ),
    rationale,
    selectedAction,
    sourceSummary:
      travelPhase === "route-progress"
        ? "Validated route progress"
        : trace?.selectedRecommendation?.sourceKind === "live-llm"
          ? "Live planner recommendation, checked before acting"
          : trace
            ? "Planner recommendation, checked before acting"
            : conversationDecision
              ? "Conversation result"
              : "Rowan's current intent",
  };
}

function visibleDecisionNextCheck(trace, selectedStep, selectedAction) {
  if (!trace) {
    return "";
  }

  if ((trace.nextSteps?.length ?? 0) >= 2) {
    const selectedIndex = selectedStep
      ? trace.nextSteps.findIndex((step) => step === selectedStep)
      : -1;
    const candidates = trace.nextSteps.slice(
      selectedIndex >= 0 ? selectedIndex + 1 : 1,
    );
    const selectedKey = String(selectedAction ?? "").toLowerCase();

    for (const step of candidates) {
      if (!step.legal) {
        continue;
      }

      const label = compactVisibleDecisionText(step.label, 60);
      if (!label || label.toLowerCase() === selectedKey) {
        continue;
      }

      const rationale = compactVisibleDecisionText(step.rationale, 92);
      const text = compactVisibleDecisionText(
        rationale ? `${label}: ${rationale}` : label,
        118,
      );
      if (!text || text.toLowerCase() === selectedKey) {
        continue;
      }

      return text;
    }
  }

  return visibleDecisionNextCheckForOutcome(trace);
}

function visibleDecisionNextCheckForOutcome(trace) {
  const selectedOutcomeIndex = trace.selectedMatchedOutcomeId
    ? trace.outcomes.findIndex(
        (outcome) => outcome.id === trace.selectedMatchedOutcomeId,
      )
    : -1;
  const candidates = [
    ...(selectedOutcomeIndex >= 0
      ? trace.outcomes.slice(selectedOutcomeIndex + 1)
      : []),
    ...trace.outcomes,
  ].filter(
    (outcome) =>
      outcome.status !== "met" &&
      (!trace.selectedMatchedOutcomeId ||
        outcome.id !== trace.selectedMatchedOutcomeId) &&
      !isCurrentOrMetaTraceOutcome(trace, outcome),
  );
  const outcome = candidates[0];
  const label = compactVisibleDecisionText(outcome?.label, 58);
  if (!label) {
    return "";
  }

  const signal = uniqueVisibleDecisionTexts(
    [...(outcome?.blockers ?? []), outcome?.evidence],
    1,
    70,
  )[0];

  const lead = visibleDecisionNextCheckLead(outcome, label, signal);
  return compactVisibleDecisionText(signal ? `${lead}: ${signal}` : label, 118);
}

function visibleDecisionNextCheckLead(outcome, label, signal) {
  if (signal && outcome?.status === "blocked") {
    if (
      /^Yard work lead confirmed$/i.test(label) &&
      /\bnot confirmed\b/i.test(signal)
    ) {
      return "Confirm yard work lead";
    }

    if (
      /^Tea-house work lead confirmed$/i.test(label) &&
      /\bnot confirmed\b/i.test(signal)
    ) {
      return "Confirm tea-house work lead";
    }
  }

  return stripTrailingVisibleDecisionPunctuation(label);
}

function isCurrentOrMetaTraceOutcome(trace, outcome) {
  const label = compactVisibleDecisionText(outcome.label, 80).toLowerCase();
  const current = compactVisibleDecisionText(
    trace.selectedPressureLabel,
    80,
  ).toLowerCase();
  const blockerText = (outcome.blockers ?? []).join(" ");
  return (
    (current && label === current) ||
    /\buseful first move\b/i.test(`${outcome.label} ${blockerText}`)
  );
}

function stripTrailingVisibleDecisionPunctuation(value) {
  return String(value ?? "")
    .replace(/[.:;,]+\s*$/u, "")
    .trim();
}

function visibleConsideredOptionText(option) {
  if (!isRouteCommandOptionLabel(option.label)) {
    return option.label;
  }

  return (
    visibleReasonFirstOptionText(option.label, option.rationale, 92) ??
    option.label
  );
}

function visibleRejectedOptionText(option) {
  const reason = playerFacingRejectedReason(option);
  if (reason === null) {
    return undefined;
  }

  return visibleReasonFirstOptionText(option.label, reason, 92) ?? option.label;
}

function playerFacingRejectedReason(option) {
  const reason =
    typeof option?.reason === "string" ? option.reason.trim() : "";
  const rationale =
    typeof option?.rationale === "string" ? option.rationale.trim() : "";

  if (reason) {
    if (isNonPlayerFacingRejectedReason(reason)) {
      return null;
    }

    return reason;
  }

  if (rationale && isNonPlayerFacingRejectedReason(rationale)) {
    return null;
  }

  return rationale;
}

function isStaleIllegalPlanningReason(reason) {
  return /\b(?:Rejected because\s+)?this\s+(?:objective action|route hint action|suggested move)\s+is\s+no\s+longer\s+legal\s+in\s+the\s+current\s+world\s+state\.?/i.test(
    String(reason ?? ""),
  );
}

function isNonPlayerFacingRejectedReason(reason) {
  return (
    isStaleIllegalPlanningReason(reason) ||
    /\bis\s+the\s+dominant\s+live\s+pressure\s+right\s+now\.?/i.test(
      String(reason ?? ""),
    ) ||
    /\bdoes\s+not\s+target\s+the\s+open\s+objective\s+predicate\b/i.test(
      String(reason ?? ""),
    )
  );
}

function visibleReasonFirstOptionText(label, reason, max) {
  const compactReason = compactVisibleDecisionText(reason, max);
  if (!compactReason) {
    return undefined;
  }

  const compactLabel = stripTrailingVisibleDecisionPunctuation(
    compactVisibleDecisionText(label, 72),
  );
  if (!compactLabel) {
    return compactReason;
  }

  const reasonWithoutLabel = compactReason
    .replace(
      new RegExp(
        `^${escapeVisibleDecisionRegExp(compactLabel)}\\s*[:\\-]\\s*`,
        "i",
      ),
      "",
    )
    .trim();
  return reasonWithoutLabel || compactReason;
}

function isRouteCommandOptionLabel(label) {
  return /^(?:head|walk|go|move|return|enter|cross|follow)\s+(?:to|toward|into|through|back\b)/i.test(
    String(label ?? "").trim(),
  );
}

function escapeVisibleDecisionRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visibleDecisionBackingSummary(backing, hasTrace) {
  switch (backing?.source) {
    case "conversation-resolution":
      return "Grounded in the conversation result.";
    case "current-legal-action-surface":
      return "Available from the current choices.";
    case "destination-preview-legal-action":
      return "The destination was checked before committing.";
    case "projected-follow-up-legal-action":
      return "The follow-up was checked before committing.";
    case "simulator-validated-move":
      return "The move was validated before Rowan carries it out.";
    case "simulator-validated-wait":
      return "The wait was validated before Rowan spends the time.";
    default:
      return hasTrace
        ? "Checked against the current choices."
        : "Grounded in Rowan's current situation.";
  }
}

function uniqueVisibleDecisionTexts(values, limit, max) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const compact = compactVisibleDecisionText(value, max);
    if (!compact) {
      continue;
    }
    const key = compact.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(compact);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

function compactVisibleDecisionText(value, max) {
  if (!value) {
    return "";
  }
  let text = String(value).replace(/\s+/g, " ").trim();
  text = text
    .replace(
      /\b(?:Rejected because\s+)?this\s+(?:objective action|route hint action|suggested move)\s+is\s+no\s+longer\s+legal\s+in\s+the\s+current\s+world\s+state\.?/gi,
      "",
    )
    .replace(/\badvance_objective\b/gi, "")
    .replace(/\bplanningTrace\b/gi, "")
    .replace(/\brouteKey\b/gi, "")
    .replace(/\bworldPressure\b/gi, "")
    .replace(/\bcityEvents\b/gi, "")
    .replace(/\bjobWindows\b/gi, "")
    .replace(/\bnpcSchedules\b/gi, "")
    .replace(/\bnpcPressureMoves\b/gi, "")
    .replace(/\bselectedPlanKey\b/gi, "")
    .replace(/\bplanKey\b/gi, "")
    .replace(/\btargetLocationId\b/gi, "")
    .replace(/\bactionId\b/gi, "")
    .replace(/^Action:\s*/i, "")
    .replace(/\bcurrent objective\b/gi, "current aim")
    .replace(/\bcurrent world state\b/gi, "current situation")
    .replace(/\bplanner trace\b/gi, "Rowan weighs")
    .replace(/\bis an open desired-state predicate\b/gi, "")
    .replace(/\bdesired-state predicate\b/gi, "aim")
    .replace(/\bstale predicate\b/gi, "stale lead")
    .replace(/\bpredicate\b/gi, "aim")
    .replace(/\bRejected because\b/gi, "")
    .replace(/\bno longer legal\b/gi, "not available now")
    .replace(/\bdominant live pressure\b/gi, "strongest current reason")
    .replace(/\blive pressure\b/gi, "current reason")
    .replace(/\b(?:objective action|route hint action)\b/gi, "opening")
    .replace(/\bsuggested move\b/gi, "option")
    .replace(/\broute hint\b/gi, "suggested path")
    .replace(
      /\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function npcPressureMovesFromSchedules(npcSchedules) {
  return (npcSchedules ?? [])
    .filter(
      (npc) =>
        npc.currentScheduleLocationId &&
        npc.currentLocationId !== npc.currentScheduleLocationId,
    )
    .map((npc) => ({
      currentConcern: npc.currentConcern ?? "",
      currentLocationId: npc.currentLocationId ?? null,
      currentScheduleLocationId: npc.currentScheduleLocationId ?? null,
      id: npc.id,
      mood: npc.mood ?? null,
    }));
}

function sortedNpcPressureMoves(npcPressureMoves) {
  return (npcPressureMoves ?? [])
    .map((npc) => ({
      currentConcern: npc.currentConcern ?? "",
      currentLocationId: npc.currentLocationId ?? null,
      currentScheduleLocationId: npc.currentScheduleLocationId ?? null,
      id: npc.id,
      mood: npc.mood ?? null,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function resolveDailyNpcSchedule(schedule, totalMinutes) {
  const minutesPerDay = 24 * 60;
  const now = Math.max(0, Math.round(totalMinutes));
  const dayIndex = Math.floor(now / minutesPerDay);
  const occurrences = [];

  for (let day = Math.max(0, dayIndex - 1); day <= dayIndex + 2; day += 1) {
    for (const stop of schedule ?? []) {
      const fromMinute = Math.round(stop.fromHour * 60);
      const toMinute = Math.round(stop.toHour * 60);
      if (
        !Number.isFinite(fromMinute) ||
        !Number.isFinite(toMinute) ||
        fromMinute < 0 ||
        fromMinute >= minutesPerDay ||
        toMinute < 0 ||
        toMinute > minutesPerDay
      ) {
        continue;
      }

      const startTotalMinutes = day * minutesPerDay + fromMinute;
      const durationMinutes =
        toMinute === fromMinute
          ? minutesPerDay
          : toMinute > fromMinute
            ? toMinute - fromMinute
            : minutesPerDay - fromMinute + toMinute;
      occurrences.push({
        endTotalMinutes: startTotalMinutes + durationMinutes,
        startTotalMinutes,
        stop,
      });
    }
  }

  occurrences.sort(
    (left, right) => left.startTotalMinutes - right.startTotalMinutes,
  );
  const active = occurrences.find(
    (occurrence) =>
      now >= occurrence.startTotalMinutes && now < occurrence.endTotalMinutes,
  );
  return {
    active,
    nextOpening: occurrences.find(
      (occurrence) => occurrence.startTotalMinutes > now,
    ),
    status:
      occurrences.length === 0
        ? "unscheduled"
        : active
          ? "active"
          : "unavailable",
  };
}

function worldPressureFromGame(game) {
  const currentTotalMinutes = game.clock.totalMinutes;
  const dayOffsetMinutes = Math.max(0, game.clock.day - 1) * 24 * 60;
  const npcSchedules = (game.npcs ?? []).map((npc) => {
    const schedule = resolveDailyNpcSchedule(
      npc.schedule,
      currentTotalMinutes,
    );
    return {
      activeWindowEndsAtMinutes: schedule.active?.endTotalMinutes ?? null,
      availability: schedule.status,
      currentLocationId: npc.currentLocationId,
      currentConcern: npc.currentConcern,
      currentScheduleLocationId: schedule.active?.stop.locationId ?? null,
      id: npc.id,
      mood: npc.mood,
      nextOpeningAtMinutes: schedule.nextOpening?.startTotalMinutes ?? null,
      nextScheduleLocationId:
        schedule.nextOpening?.stop.locationId ?? null,
      nextScheduleStartsInMinutes: schedule.nextOpening
        ? Math.max(
            0,
            schedule.nextOpening.startTotalMinutes - currentTotalMinutes,
          )
        : null,
    };
  });

  return {
    cityEvents: (game.cityEvents ?? []).map((event) => {
      const startTotal = dayOffsetMinutes + event.startMinute;
      const endTotal = dayOffsetMinutes + event.endMinute;
      return {
        endsInMinutes:
          event.status === "active"
            ? Math.max(0, endTotal - currentTotalMinutes)
            : null,
        id: event.id,
        locationId: event.locationId,
        outcome: event.outcome ?? null,
        progress: event.progress ?? null,
        resolvedAt: event.resolvedAt ?? null,
        startsInMinutes:
          event.status === "upcoming"
            ? Math.max(0, startTotal - currentTotalMinutes)
            : null,
        status: event.status,
        tone: event.tone,
        visibleLabel: event.visibleLabel,
      };
    }),
    jobWindows: (game.jobs ?? []).map((job) => {
      const startTotal = dayOffsetMinutes + Math.round(job.startHour * 60);
      const endTotal = dayOffsetMinutes + Math.round(job.endHour * 60);
      const inWindow =
        currentTotalMinutes >= startTotal && currentTotalMinutes < endTotal;
      return {
        accepted: job.accepted,
        completed: job.completed,
        consequenceAppliedAt: job.consequenceAppliedAt ?? null,
        deferredUntilMinutes: job.deferredUntilMinutes ?? null,
        discovered: job.discovered,
        endsInMinutes: inWindow
          ? Math.max(0, endTotal - currentTotalMinutes)
          : null,
        id: job.id,
        inWindow,
        locationId: job.locationId,
        missed: job.missed,
        missedAt: job.missedAt ?? null,
        startsInMinutes:
          currentTotalMinutes < startTotal
            ? Math.max(0, startTotal - currentTotalMinutes)
            : null,
        title: job.title,
      };
    }),
    npcPressureMoves: npcPressureMovesFromSchedules(npcSchedules),
    npcSchedules,
    problems: (game.problems ?? []).map((problem) => ({
      discovered: problem.discovered,
      consequenceAppliedAt: problem.consequenceAppliedAt ?? null,
      escalatedAt: problem.escalatedAt ?? null,
      escalationLevel: problem.escalationLevel ?? 0,
      expiredAt: problem.expiredAt ?? null,
      id: problem.id,
      locationId: problem.locationId,
      requiredItemId: problem.requiredItemId ?? null,
      resolvedAt: problem.resolvedAt ?? null,
      resolvedByNpcId: problem.resolvedByNpcId ?? null,
      status: problem.status,
      title: problem.title,
      urgency: problem.urgency,
    })),
  };
}

function activeCityEvents(game) {
  return (game.cityEvents ?? [])
    .filter((event) => event.status === "active")
    .map((event) => ({
      id: event.id,
      locationId: event.locationId,
      outcome: event.outcome ?? null,
      progress: event.progress ?? null,
      resolvedAt: event.resolvedAt ?? null,
      visibleLabel: event.visibleLabel,
    }));
}

function simCityEventSnapshot(game) {
  return (game.cityEvents ?? []).map((event) => ({
    id: event.id,
    locationId: event.locationId,
    outcome: event.outcome ?? null,
    progress: event.progress ?? null,
    resolvedAt: event.resolvedAt ?? null,
    status: event.status,
    visibleLabel: event.visibleLabel,
  }));
}

function independentNpcActionSummary({
  problemId,
  problemTitle,
  resolverName,
}) {
  if (problemId === "problem-pump") {
    return `${resolverName} contained the ${problemTitle.toLowerCase()} before it became evening house strain.`;
  }
  if (problemId === "problem-cart") {
    return `${resolverName} cleared the ${problemTitle.toLowerCase()} before Quay Square spent the afternoon bent around it.`;
  }
  return `${resolverName} resolved the ${problemTitle.toLowerCase()} without Rowan taking the work.`;
}

function independentJobClosureSummary({ actorName }) {
  return `${actorName} got the North Crane Yard load out with his own crew; Rowan gets no pay or credit from that work.`;
}

function independentNpcActionsFromGame(game) {
  const npcsById = new Map((game.npcs ?? []).map((npc) => [npc.id, npc]));
  const problemRecords = (game.problems ?? [])
    .filter(
      (problem) => problem.status === "resolved" && problem.resolvedByNpcId,
    )
    .map((problem) => {
      const resolver = npcsById.get(problem.resolvedByNpcId);
      const resolverName =
        resolver?.name ?? problem.resolvedByNpcId ?? "A local";
      return {
        actionKind: "problem_resolution",
        actorConcern: resolver?.currentConcern ?? null,
        actorMood: resolver?.mood ?? null,
        actorName: resolverName,
        actorNpcId: problem.resolvedByNpcId,
        afterStatus: problem.status,
        beforeStatus: "active",
        locationId: problem.locationId,
        occurredAt: problem.resolvedAt ?? null,
        playerFacingSummary: independentNpcActionSummary({
          problemId: problem.id,
          problemTitle: problem.title,
          resolverName,
        }),
        problemId: problem.id,
        problemTitle: problem.title,
        resolvedAt: problem.resolvedAt ?? null,
        resolverConcern: resolver?.currentConcern ?? null,
        resolverMood: resolver?.mood ?? null,
        resolverName,
        resolverNpcId: problem.resolvedByNpcId,
        subjectId: problem.id,
        subjectTitle: problem.title,
      };
    });
  const jobRecords = (game.jobs ?? [])
    .filter(
      (job) =>
        job.id === "job-yard-shift" &&
        job.missed &&
        Boolean(job.consequenceAppliedAt),
    )
    .map((job) => {
      const actorNpcId = job.giverNpcId || "npc-tomas";
      const actor = npcsById.get(actorNpcId);
      const actorName = actor?.name ?? "Tomas";
      return {
        actionKind: "job_closure",
        actorConcern: actor?.currentConcern ?? null,
        actorMood: actor?.mood ?? null,
        actorName,
        actorNpcId,
        afterStatus: "closed",
        beforeStatus: "open",
        closedAt: job.consequenceAppliedAt ?? null,
        jobId: job.id,
        jobTitle: job.title,
        locationId: job.locationId,
        occurredAt: job.consequenceAppliedAt ?? null,
        playerFacingSummary: independentJobClosureSummary({ actorName }),
        resolverConcern: actor?.currentConcern ?? null,
        resolverMood: actor?.mood ?? null,
        resolverName: actorName,
        resolverNpcId: actorNpcId,
        subjectId: job.id,
        subjectTitle: job.title,
      };
    });

  return [...problemRecords, ...jobRecords]
    .sort((left, right) => {
      const leftTime = left.occurredAt
        ? Date.parse(left.occurredAt)
        : Number.NEGATIVE_INFINITY;
      const rightTime = right.occurredAt
        ? Date.parse(right.occurredAt)
        : Number.NEGATIVE_INFINITY;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.subjectId.localeCompare(right.subjectId);
    });
}

function independentNpcActionKey(action) {
  return [
    action.actionKind ?? "problem_resolution",
    action.subjectId ?? action.problemId ?? action.jobId ?? "unknown",
    action.actorNpcId ?? action.resolverNpcId ?? "unknown",
    independentNpcActionOccurredAt(action) ?? "none",
  ].join("|");
}

function independentNpcActionOccurredAt(action) {
  return action.occurredAt ?? action.resolvedAt ?? action.closedAt ?? null;
}

function independentNpcActionVisibleText(action) {
  return [
    action.title,
    action.detail,
    action.playerFacingSummary,
    action.resolverName,
    action.actorName,
  ]
    .filter(Boolean)
    .join(" ");
}

function independentNpcActionTextIsPlayerFacing(text) {
  return !/\bjob-yard-shift|resolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId|jobId|actorNpcId|subjectId|actionKind\b/i.test(
    text ?? "",
  );
}

function isProblemResolutionAction(action) {
  return Boolean(
    action &&
      (action.actionKind === "problem_resolution" || action.problemId) &&
      ["problem-pump", "problem-cart"].includes(action.problemId) &&
      action.problemTitle &&
      action.resolverNpcId &&
      action.resolverName &&
      action.beforeStatus === "active" &&
      action.afterStatus === "resolved" &&
      independentNpcActionOccurredAt(action) &&
      action.playerFacingSummary &&
      independentNpcActionTextIsPlayerFacing(action.playerFacingSummary),
  );
}

function isJobClosureAction(action) {
  return Boolean(
    action &&
      action.actionKind === "job_closure" &&
      action.jobId &&
      action.jobTitle &&
      action.actorNpcId &&
      action.actorName &&
      action.beforeStatus === "open" &&
      action.afterStatus === "closed" &&
      independentNpcActionOccurredAt(action) &&
      action.locationId === "freight-yard" &&
      action.playerFacingSummary &&
      independentNpcActionTextIsPlayerFacing(action.playerFacingSummary),
  );
}

function isIndependentLocalAction(action) {
  return isProblemResolutionAction(action) || isJobClosureAction(action);
}

function findCityEvent(game, id) {
  return (game.cityEvents ?? []).find((event) => event.id === id) ?? null;
}

function assertBrowserProbeMatchesGame(label, game, probe, options = {}) {
  const allowPendingPlayback =
    options.allowPendingPlayback &&
    browserProbeMatchesProgressiveSnapshot(probe, game);

  assert.equal(
    probe.gameId,
    game.id,
    `${label}: browser loaded the wrong game id.`,
  );
  assert.equal(
    probe.clock.iso,
    game.currentTime,
    `${label}: browser clock diverged from sim clock.`,
  );
  assert.equal(
    probe.location.id,
    normalizeNullable(game.player.currentLocationId),
    `${label}: browser location diverged from sim location.`,
  );
  assert.equal(
    probe.location.spaceId,
    normalizeNullable(game.activeSpaceId ?? game.player.spaceId),
    `${label}: browser active space diverged from sim active space.`,
  );
  assert.equal(
    probe.location.x,
    game.player.x,
    `${label}: browser player x diverged from sim position.`,
  );
  assert.equal(
    probe.location.y,
    game.player.y,
    `${label}: browser player y diverged from sim position.`,
  );
  assert.equal(
    probe.autonomy.label,
    game.rowanAutonomy.label,
    `${label}: browser autonomy label diverged from sim.`,
  );
  assert.equal(
    probe.autonomy.stepKind,
    game.rowanAutonomy.stepKind,
    `${label}: browser autonomy step diverged from sim.`,
  );
  assert.equal(
    probe.autonomy.targetLocationId,
    normalizeNullable(game.rowanAutonomy.targetLocationId),
    `${label}: browser autonomy target diverged from sim.`,
  );
  assert.equal(
    probe.activeConversation?.npcId ?? null,
    game.activeConversation?.npcId ?? null,
    `${label}: browser conversation target diverged from sim.`,
  );
  assert.deepEqual(
    probe.cityEvents ?? [],
    activeCityEvents(game),
    `${label}: browser active city events diverged from sim.`,
  );
  assert.deepEqual(
    probe.independentNpcActions ?? [],
    independentNpcActionsFromGame(game),
    `${label}: browser independent NPC action evidence diverged from sim.`,
  );
  if (allowPendingPlayback) {
    assertObjectiveIdentityMatches(label, game, probe);
  } else {
    assert.deepEqual(
      probe.objective,
      objectiveProbeFromGame(game),
      `${label}: browser objective predicates diverged from sim.`,
    );
  }
  const expectedPlanningTrace = planningTraceProbeFromGame(game);
  if (expectedPlanningTrace && !allowPendingPlayback) {
    if (
      !isDeepStrictEqual(probe.autonomy.planningTrace, expectedPlanningTrace)
    ) {
      assert.deepEqual(
        planningTraceDecisionProjection(probe.autonomy.planningTrace),
        planningTraceDecisionProjection(expectedPlanningTrace),
        `${label}: browser planner decision identity diverged from sim.`,
      );
      assertPlanningTracePayload(label, probe.autonomy.planningTrace);
    }
  } else if (probe.autonomy.planningTrace) {
    assertPlanningTracePayload(label, probe.autonomy.planningTrace);
  }
  assert.deepEqual(
    probe.worldPressure,
    worldPressureFromGame(game),
    `${label}: browser world pressure diverged from sim.`,
  );
  assert.deepEqual(
    probe.aiRuntime ?? null,
    aiRuntimeProbeFromGame(game),
    `${label}: browser AI runtime diverged from sim.`,
  );
  assertProbeAuditability(label, game, probe);
  if (!options.allowVisualMove) {
    assert.equal(
      probe.visualPlayer?.isMovingToServerState ?? false,
      false,
      `${label}: browser still thinks the player is in a staged visual move.`,
    );
  }
}

function browserProbeMatchesGameSnapshot(probe, game) {
  if (!probe || !game) {
    return false;
  }

  const expectedPlanningTrace = planningTraceProbeFromGame(game);

  return (
    browserProbeMatchesGameCoreSnapshot(probe, game) &&
    isDeepStrictEqual(probe.cityEvents ?? [], activeCityEvents(game)) &&
    isDeepStrictEqual(
      probe.independentNpcActions ?? [],
      independentNpcActionsFromGame(game),
    ) &&
    isDeepStrictEqual(probe.objective, objectiveProbeFromGame(game)) &&
    (!expectedPlanningTrace ||
      planningTraceMatchesExpectedDecision(
        probe.autonomy?.planningTrace,
        expectedPlanningTrace,
      )) &&
    isDeepStrictEqual(probe.worldPressure, worldPressureFromGame(game)) &&
    isDeepStrictEqual(probe.aiRuntime ?? null, aiRuntimeProbeFromGame(game))
  );
}

function planningTraceMatchesExpectedDecision(actual, expected) {
  return Boolean(
    actual &&
      expected &&
      (isDeepStrictEqual(actual, expected) ||
        isDeepStrictEqual(
          planningTraceDecisionProjection(actual),
          planningTraceDecisionProjection(expected),
        )),
  );
}

function planningTraceDecisionProjection(trace) {
  if (!trace) {
    return null;
  }

  return {
    immediateAction: trace.immediateAction ?? null,
    intendedFollowUp: trace.intendedFollowUp ?? null,
    nextSteps: trace.nextSteps ?? [],
    plannerIntent: trace.plannerIntent ?? null,
    providerAttempt: trace.providerAttempt ?? null,
    selectedActionId: trace.selectedActionId ?? null,
    selectedLabel: trace.selectedLabel ?? null,
    selectedLegalBacking: trace.selectedLegalBacking ?? null,
    selectedMatchedOutcomeId: trace.selectedMatchedOutcomeId ?? null,
    selectedPlanKey: trace.selectedPlanKey ?? null,
    selectedPressureId: trace.selectedPressureId ?? null,
    selectedPressureKind: trace.selectedPressureKind ?? null,
    selectedPressureLabel: trace.selectedPressureLabel ?? null,
    selectedRecommendation: trace.selectedRecommendation ?? null,
    selectedTargetLocationId: trace.selectedTargetLocationId ?? null,
    sourceLabel: trace.sourceLabel ?? null,
  };
}

function browserProbeMatchesProgressiveSnapshot(probe, game) {
  return Boolean(
    browserProbeHasPendingPlayback(probe) &&
      browserProbeMatchesGameCoreSnapshot(probe, game) &&
      objectiveIdentityMatches(probe, game) &&
      isDeepStrictEqual(probe.cityEvents ?? [], activeCityEvents(game)) &&
      isDeepStrictEqual(
        probe.independentNpcActions ?? [],
        independentNpcActionsFromGame(game),
      ) &&
      isDeepStrictEqual(probe.worldPressure, worldPressureFromGame(game)) &&
      isDeepStrictEqual(
        probe.aiRuntime ?? null,
        aiRuntimeProbeFromGame(game),
      ),
  );
}

function browserProbeHasPendingPlayback(probe) {
  return Boolean(
    probe?.watchMode?.pendingPlayback ||
      probe?.playback?.activeKind ||
      (probe?.playback?.queuedCount ?? 0) > 0,
  );
}

function createStagedWorkPlaybackWaitProgress() {
  return {
    advanceCount: 0,
    bestProgress: null,
    firstSampleElapsedMs: null,
    lastProgressElapsedMs: null,
    routeIdentity: null,
    sampleCount: 0,
    visualActiveFirstSampleElapsedMs: null,
    visualActiveIdentity: null,
    visualActiveLastSampleElapsedMs: null,
    visualActiveNow: false,
    visualActiveSampleCount: 0,
  };
}

function stagedWorkPlaybackCatchUpIdentity(probe, game) {
  const actionId = game?.rowanAutonomy?.actionId ?? null;
  const expectedLocationId = game?.player?.currentLocationId ?? null;
  const expectedSpaceId = game?.activeSpaceId ?? game?.player?.spaceId ?? null;
  const visualPlayer = probe?.visualPlayer;
  const playerStillAtPriorPosition =
    probe?.location?.x !== game?.player?.x ||
    probe?.location?.y !== game?.player?.y;
  const probeTimeMs = Date.parse(probe?.clock?.iso ?? "");
  const targetTimeMs = Date.parse(game?.currentTime ?? "");

  if (
    !actionId?.startsWith("work:") ||
    probe?.gameId !== game?.id ||
    !Number.isFinite(probeTimeMs) ||
    !Number.isFinite(targetTimeMs) ||
    probeTimeMs >= targetTimeMs ||
    probe?.autonomy?.actionId !== actionId ||
    probe?.autonomy?.stepKind !== game?.rowanAutonomy?.stepKind ||
    (probe?.autonomy?.targetLocationId ?? null) !==
      normalizeNullable(game?.rowanAutonomy?.targetLocationId) ||
    (probe?.activeConversation?.npcId ?? null) !==
      (game?.activeConversation?.npcId ?? null) ||
    probe?.location?.id !== expectedLocationId ||
    probe?.location?.spaceId !== expectedSpaceId ||
    !playerStillAtPriorPosition ||
    visualPlayer?.isMovingToServerState !== true ||
    visualPlayer.targetX !== game?.player?.x ||
    visualPlayer.targetY !== game?.player?.y ||
    !objectiveIdentityMatches(probe, game)
  ) {
    return null;
  }

  return {
    actionId,
    expectedLocationId,
    expectedSpaceId,
    identity: JSON.stringify({
      actionId,
      clock: game.currentTime,
      gameId: game.id,
      locationId: expectedLocationId,
      objectiveOutcomeIds: (game.player.objective?.outcomes ?? []).map(
        (outcome) => outcome.id,
      ),
      objectiveRouteKey: game.player.objective?.routeKey ?? null,
      spaceId: expectedSpaceId,
      target: { x: game.player.x, y: game.player.y },
    }),
  };
}

function stagedWorkPlaybackCatchUpSample(probe, game) {
  const catchUpIdentity = stagedWorkPlaybackCatchUpIdentity(probe, game);
  const route = probe?.movement?.playerRoute;
  const target = route?.target;

  if (
    !catchUpIdentity ||
    route?.active !== true ||
    route.legal !== true ||
    route.reachesDestination !== true ||
    route.sampledPointsLegal !== true ||
    route.visualObstaclesClear !== true ||
    route.spaceId !== catchUpIdentity.expectedSpaceId ||
    route.targetLocationId !== catchUpIdentity.expectedLocationId ||
    target?.x !== game?.player?.x ||
    target?.y !== game?.player?.y ||
    typeof route.progress !== "number" ||
    !Number.isFinite(route.progress) ||
    route.progress < 0 ||
    route.progress > 1
  ) {
    return null;
  }

  return {
    progress: route.progress,
    routeIdentity: catchUpIdentity.identity,
  };
}

function stagedWorkVisualActiveCatchUpSample(probe, game) {
  const catchUpIdentity = stagedWorkPlaybackCatchUpIdentity(probe, game);
  if (!catchUpIdentity || probe?.movement?.playerRoute != null) {
    return null;
  }

  return {
    visualActiveIdentity: catchUpIdentity.identity,
  };
}

function recordStagedWorkPlaybackWaitProgress({
  elapsedMs,
  game,
  playbackProgress,
  probe,
}) {
  const routeSample = stagedWorkPlaybackCatchUpSample(probe, game);

  if (routeSample?.routeIdentity !== undefined) {
    if (routeSample.routeIdentity !== playbackProgress.routeIdentity) {
      return {
        ...playbackProgress,
        advanceCount: 0,
        bestProgress: routeSample.progress,
        firstSampleElapsedMs: elapsedMs,
        lastProgressElapsedMs: null,
        routeIdentity: routeSample.routeIdentity,
        sampleCount: 1,
        visualActiveNow: false,
      };
    }

    const advanced =
      routeSample.progress >=
      (playbackProgress.bestProgress ?? routeSample.progress) +
        SIM_WORK_PLAYBACK_PROGRESS_EPSILON;
    return {
      ...playbackProgress,
      advanceCount: playbackProgress.advanceCount + (advanced ? 1 : 0),
      bestProgress: advanced
        ? routeSample.progress
        : playbackProgress.bestProgress,
      lastProgressElapsedMs: advanced
        ? elapsedMs
        : playbackProgress.lastProgressElapsedMs,
      sampleCount: playbackProgress.sampleCount + 1,
      visualActiveNow: false,
    };
  }

  const visualActiveSample = stagedWorkVisualActiveCatchUpSample(probe, game);
  if (!visualActiveSample) {
    return probe && playbackProgress.visualActiveNow
      ? { ...playbackProgress, visualActiveNow: false }
      : playbackProgress;
  }

  const newIdentity =
    visualActiveSample.visualActiveIdentity !==
    playbackProgress.visualActiveIdentity;
  return {
    ...playbackProgress,
    visualActiveFirstSampleElapsedMs: newIdentity
      ? elapsedMs
      : playbackProgress.visualActiveFirstSampleElapsedMs,
    visualActiveIdentity: visualActiveSample.visualActiveIdentity,
    visualActiveLastSampleElapsedMs: elapsedMs,
    visualActiveNow: true,
    visualActiveSampleCount: newIdentity
      ? 1
      : playbackProgress.visualActiveSampleCount + 1,
  };
}

function stagedWorkPlaybackWaitExtensionKind({ elapsedMs, playbackProgress }) {
  const routeProgressRecentlyObserved = Boolean(
    playbackProgress.advanceCount > 0 &&
      playbackProgress.lastProgressElapsedMs !== null &&
      elapsedMs >= playbackProgress.lastProgressElapsedMs &&
      elapsedMs - playbackProgress.lastProgressElapsedMs <=
        SIM_WORK_PLAYBACK_STALL_GRACE_MS,
  );
  if (routeProgressRecentlyObserved) {
    return "route-progress";
  }

  const visualCatchUpRecentlyActive = Boolean(
    playbackProgress.visualActiveNow &&
      playbackProgress.visualActiveLastSampleElapsedMs !== null &&
      elapsedMs >= playbackProgress.visualActiveLastSampleElapsedMs &&
      elapsedMs - playbackProgress.visualActiveLastSampleElapsedMs <=
        SIM_WORK_PLAYBACK_VISUAL_ACTIVE_GRACE_MS,
  );
  return visualCatchUpRecentlyActive ? "visual-active" : null;
}

function shouldContinueGameWait({ elapsedMs, playbackProgress }) {
  if (elapsedMs < SIM_WAIT_TIMEOUT_MS) {
    return true;
  }

  const hardDeadlineMs =
    SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS;
  return Boolean(
    elapsedMs < hardDeadlineMs &&
      stagedWorkPlaybackWaitExtensionKind({
        elapsedMs,
        playbackProgress,
      }) !== null,
  );
}

function compactStagedWorkPlaybackWaitProgress(
  playbackProgress,
  elapsedMs,
) {
  const activeExtensionKind = stagedWorkPlaybackWaitExtensionKind({
    elapsedMs,
    playbackProgress,
  });
  return {
    ...playbackProgress,
    activeExtensionKind,
    elapsedMs,
    extendedBeyondBaseDeadline:
      elapsedMs > SIM_WAIT_TIMEOUT_MS &&
      (playbackProgress.advanceCount > 0 ||
        playbackProgress.visualActiveSampleCount > 0),
    extensionEligibleWithinHardDeadline:
      elapsedMs < SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS &&
      activeExtensionKind !== null,
    hardDeadlineMs: SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS,
    stallGraceMs: SIM_WORK_PLAYBACK_STALL_GRACE_MS,
    visualActiveGraceMs: SIM_WORK_PLAYBACK_VISUAL_ACTIVE_GRACE_MS,
  };
}

function buildStagedWorkPlaybackWaitFixture(progress = 0.24) {
  const objective = {
    focus: "Complete Ada's lunch shift",
    outcomes: ["room", "approaches", "consequence", "take-stock"].map(
      (suffix) => ({
        id: `first-afternoon-${suffix}`,
        label: suffix,
        status: "open",
        urgency: 6,
      }),
    ),
    progress: { completed: 2, label: "Lunch rush", total: 4 },
    routeKey: "first-afternoon",
    source: "objective-scaffold",
    text:
      "Make Rowan's first afternoon count: understand the room, learn multiple live approaches, achieve one consequential foothold through work or useful local help, then take stock.",
    trail: [],
  };
  const game = {
    activeSpaceId: "interior:tea-house",
    cityEvents: [],
    clock: { day: 1, totalMinutes: 12 * 60 + 46 },
    currentTime: "2026-03-21T12:46:00.000Z",
    id: "game-staged-work-wait",
    jobs: [],
    npcs: [],
    player: {
      currentLocationId: "tea-house",
      objective,
      spaceId: "interior:tea-house",
      x: 7,
      y: 5,
    },
    problems: [],
    rowanAutonomy: {
      actionId: "work:job-tea-shift",
      label: "Finish the cup-and-counter shift",
      stepKind: "work",
      targetLocationId: "tea-house",
    },
  };
  const probe = {
    autonomy: {
      actionId: "work:job-tea-shift",
      label: "Keep the lunch rush moving",
      stepKind: "work",
      targetLocationId: "tea-house",
    },
    clock: { iso: "2026-03-21T12:21:00.000Z" },
    gameId: game.id,
    location: {
      id: "tea-house",
      spaceId: "interior:tea-house",
      x: 8,
      y: 3,
    },
    movement: {
      playerRoute: {
        active: true,
        legal: true,
        progress,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "interior:tea-house",
        target: { x: 7, y: 5 },
        targetLocationId: "tea-house",
        visualObstaclesClear: true,
      },
    },
    objective: objectiveProbeFromGame(game),
    visualPlayer: {
      isMovingToServerState: true,
      targetX: 7,
      targetY: 5,
    },
  };

  return { game, probe };
}

function assertProgressAwareStagedWorkWaitRegression() {
  const { game, probe } = buildStagedWorkPlaybackWaitFixture();
  let frozenProgress = createStagedWorkPlaybackWaitProgress();
  frozenProgress = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: 1_000,
    game,
    playbackProgress: frozenProgress,
    probe,
  });
  frozenProgress = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: 14_000,
    game,
    playbackProgress: frozenProgress,
    probe,
  });
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS,
      playbackProgress: frozenProgress,
    }),
    false,
    "A frozen staged work route must not extend the simulator wait deadline.",
  );

  let progressing = createStagedWorkPlaybackWaitProgress();
  progressing = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: 1_000,
    game,
    playbackProgress: progressing,
    probe,
  });
  const advancedProbe = {
    ...probe,
    movement: {
      playerRoute: {
        ...probe.movement.playerRoute,
        progress: 0.68,
      },
    },
  };
  progressing = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: 14_000,
    game,
    playbackProgress: progressing,
    probe: advancedProbe,
  });
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS,
      playbackProgress: progressing,
    }),
    true,
    "A valid advancing tea-house work route should receive bounded catch-up time.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: 18_500,
      playbackProgress: progressing,
    }),
    true,
    "A recently progressing work route should retain a short settle grace.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: 19_001,
      playbackProgress: progressing,
    }),
    false,
    "A work route that stops progressing must fail after the settle grace.",
  );
  assert.equal(
    compactStagedWorkPlaybackWaitProgress(
      progressing,
      SIM_WAIT_TIMEOUT_MS,
    ).activeExtensionKind,
    "route-progress",
    "Route-progress extension authority should be explicit in diagnostics.",
  );

  const noRouteProbe = {
    ...advancedProbe,
    movement: { playerRoute: null },
    watchMode: { pendingPlayback: true },
  };
  let visualActive = createStagedWorkPlaybackWaitProgress();
  visualActive = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: SIM_WAIT_TIMEOUT_MS - 500,
    game,
    playbackProgress: visualActive,
    probe: noRouteProbe,
  });
  assert.equal(
    visualActive.sampleCount,
    0,
    "A route-free visual catch-up must not fabricate route progress.",
  );
  assert.equal(
    visualActive.visualActiveSampleCount,
    1,
    "A valid route-free visual catch-up should record active evidence.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS,
      playbackProgress: visualActive,
    }),
    true,
    "An active same-work visual catch-up should receive bounded catch-up time without a route.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs:
        SIM_WAIT_TIMEOUT_MS - 500 +
        SIM_WORK_PLAYBACK_VISUAL_ACTIVE_GRACE_MS,
      playbackProgress: visualActive,
    }),
    true,
    "A recent visual-active sample should retain only its short observation grace.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs:
        SIM_WAIT_TIMEOUT_MS - 499 +
        SIM_WORK_PLAYBACK_VISUAL_ACTIVE_GRACE_MS,
      playbackProgress: visualActive,
    }),
    false,
    "Visual-active catch-up must fail when active evidence goes stale.",
  );
  const visualDiagnostics = compactStagedWorkPlaybackWaitProgress(
    visualActive,
    SIM_WAIT_TIMEOUT_MS,
  );
  assert.equal(
    visualDiagnostics.activeExtensionKind,
    "visual-active",
    "Visual-active extension authority should be distinct in diagnostics.",
  );
  assert.equal(
    visualDiagnostics.extensionEligibleWithinHardDeadline,
    true,
    "Visual-active diagnostics should report bounded extension eligibility.",
  );

  assert.equal(
    browserProbeMatchesGameCoreSnapshot(noRouteProbe, game),
    false,
    "Visual-active evidence must not make a stale core snapshot authoritative.",
  );
  assert.equal(
    browserProbeMatchesProgressiveSnapshot(noRouteProbe, game),
    false,
    "Visual-active evidence must not accept stale state as progressive target state.",
  );
  const exactTargetProbe = {
    ...noRouteProbe,
    aiRuntime: null,
    autonomy: {
      ...noRouteProbe.autonomy,
      label: game.rowanAutonomy.label,
    },
    cityEvents: [],
    clock: { iso: game.currentTime },
    independentNpcActions: [],
    location: {
      id: game.player.currentLocationId,
      spaceId: game.activeSpaceId,
      x: game.player.x,
      y: game.player.y,
    },
    visualPlayer: {
      isMovingToServerState: false,
      targetX: game.player.x,
      targetY: game.player.y,
    },
    worldPressure: worldPressureFromGame(game),
  };
  assert.equal(
    browserProbeMatchesGameSnapshot(exactTargetProbe, game),
    true,
    "The exact target snapshot must still be required before the wait succeeds.",
  );

  const invalidVisualCatchUps = [
    [
      "inactive",
      game,
      {
        ...noRouteProbe,
        visualPlayer: {
          ...noRouteProbe.visualPlayer,
          isMovingToServerState: false,
        },
      },
    ],
    [
      "target-time state",
      game,
      { ...noRouteProbe, clock: { iso: game.currentTime } },
    ],
    [
      "non-work action",
      {
        ...game,
        rowanAutonomy: {
          ...game.rowanAutonomy,
          actionId: "wait:short",
        },
      },
      {
        ...noRouteProbe,
        autonomy: { ...noRouteProbe.autonomy, actionId: "wait:short" },
      },
    ],
    ["wrong game", game, { ...noRouteProbe, gameId: "game-other" }],
    [
      "wrong action",
      game,
      {
        ...noRouteProbe,
        autonomy: { ...noRouteProbe.autonomy, actionId: "work:job-yard-shift" },
      },
    ],
    [
      "wrong objective",
      game,
      {
        ...noRouteProbe,
        objective: { ...noRouteProbe.objective, routeKey: "other-objective" },
      },
    ],
    [
      "wrong location",
      game,
      {
        ...noRouteProbe,
        location: { ...noRouteProbe.location, id: "freight-yard" },
      },
    ],
    [
      "wrong space",
      game,
      {
        ...noRouteProbe,
        location: { ...noRouteProbe.location, spaceId: "exterior" },
      },
    ],
    [
      "wrong target",
      game,
      {
        ...noRouteProbe,
        visualPlayer: { ...noRouteProbe.visualPlayer, targetX: 8 },
      },
    ],
    [
      "present inactive route",
      game,
      { ...noRouteProbe, movement: { playerRoute: { active: false } } },
    ],
  ];
  for (const [label, candidateGame, candidateProbe] of invalidVisualCatchUps) {
    assert.equal(
      stagedWorkVisualActiveCatchUpSample(candidateProbe, candidateGame),
      null,
      `A ${label} visual state must not qualify for route-free catch-up.`,
    );
    const invalidProgress = recordStagedWorkPlaybackWaitProgress({
      elapsedMs: SIM_WAIT_TIMEOUT_MS - 1,
      game: candidateGame,
      playbackProgress: createStagedWorkPlaybackWaitProgress(),
      probe: candidateProbe,
    });
    assert.equal(
      shouldContinueGameWait({
        elapsedMs: SIM_WAIT_TIMEOUT_MS,
        playbackProgress: invalidProgress,
      }),
      false,
      `A ${label} visual state must not earn extra wait time.`,
    );
  }

  const inactiveAfterActive = recordStagedWorkPlaybackWaitProgress({
    elapsedMs: SIM_WAIT_TIMEOUT_MS,
    game,
    playbackProgress: visualActive,
    probe: invalidVisualCatchUps[0][2],
  });
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS,
      playbackProgress: inactiveAfterActive,
    }),
    false,
    "An observed inactive visual state must revoke active catch-up authority.",
  );

  const wrongTargetProbe = {
    ...advancedProbe,
    visualPlayer: { ...advancedProbe.visualPlayer, targetX: 8 },
  };
  assert.equal(
    stagedWorkPlaybackCatchUpSample(wrongTargetProbe, game),
    null,
    "A staged route with the wrong simulator target must not extend the wait.",
  );
  const wrongActionProbe = {
    ...advancedProbe,
    autonomy: { ...advancedProbe.autonomy, actionId: "wait:short" },
  };
  assert.equal(
    stagedWorkPlaybackCatchUpSample(wrongActionProbe, game),
    null,
    "A staged route with a different action identity must not extend the wait.",
  );
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS,
      playbackProgress: {
        ...progressing,
        lastProgressElapsedMs:
          SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS - 1,
      },
    }),
    false,
    "Continuous work-route progress must still stop at the hard catch-up cap.",
  );
  const visualActiveAtHardCap = recordStagedWorkPlaybackWaitProgress({
    elapsedMs:
      SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS - 1,
    game,
    playbackProgress: visualActive,
    probe: noRouteProbe,
  });
  assert.equal(
    shouldContinueGameWait({
      elapsedMs: SIM_WAIT_TIMEOUT_MS + SIM_WORK_PLAYBACK_EXTRA_WAIT_MS,
      playbackProgress: visualActiveAtHardCap,
    }),
    false,
    "Continuous visual-active catch-up must still stop at the hard catch-up cap.",
  );
}

function objectiveIdentityMatches(probe, game) {
  const expected = objectiveProbeFromGame(game);
  return Boolean(
    probe?.objective &&
      expected &&
      probe.objective.text === expected.text &&
      probe.objective.routeKey === expected.routeKey &&
      isDeepStrictEqual(
        (probe.objective.outcomes ?? []).map((outcome) => outcome.id),
        (expected.outcomes ?? []).map((outcome) => outcome.id),
      ),
  );
}

function assertObjectiveIdentityMatches(label, game, probe) {
  assert.ok(
    objectiveIdentityMatches(probe, game),
    `${label}: progressive browser playback changed the objective identity or predicate set.`,
  );
}

function browserProbeMatchesGameCoreSnapshot(probe, game) {
  return Boolean(
    probe &&
      game &&
      probe.gameId === game.id &&
      probe.clock?.iso === game.currentTime &&
      probe.location?.id === normalizeNullable(game.player.currentLocationId) &&
      probe.location?.spaceId ===
        normalizeNullable(game.activeSpaceId ?? game.player.spaceId) &&
      probe.location?.x === game.player.x &&
      probe.location?.y === game.player.y &&
      probe.autonomy?.label === game.rowanAutonomy.label &&
      probe.autonomy?.stepKind === game.rowanAutonomy.stepKind &&
      (probe.autonomy?.targetLocationId ?? null) ===
        normalizeNullable(game.rowanAutonomy.targetLocationId) &&
      (probe.activeConversation?.npcId ?? null) ===
        (game.activeConversation?.npcId ?? null),
  );
}

function matchingGameSnapshotForProbe(probe, ...games) {
  return (
    games.find((game) => browserProbeMatchesGameSnapshot(probe, game)) ?? null
  );
}

function compactBrowserProbeForWait(probe) {
  if (!probe) {
    return null;
  }

  return {
    autonomy: probe.autonomy
      ? {
          actionId: probe.autonomy.actionId ?? null,
          label: probe.autonomy.label ?? null,
          stepKind: probe.autonomy.stepKind ?? null,
          targetLocationId: probe.autonomy.targetLocationId ?? null,
        }
      : null,
    clock: probe.clock?.iso ?? null,
    gameId: probe.gameId ?? null,
    location: probe.location
      ? {
          id: probe.location.id ?? null,
          spaceId: probe.location.spaceId ?? null,
          x: probe.location.x ?? null,
          y: probe.location.y ?? null,
        }
      : null,
    movement: probe.movement
      ? {
          playerRoute: probe.movement.playerRoute
            ? {
                active: probe.movement.playerRoute.active ?? null,
                progress: probe.movement.playerRoute.progress ?? null,
                legal: probe.movement.playerRoute.legal ?? null,
                reachesDestination:
                  probe.movement.playerRoute.reachesDestination ?? null,
                targetLocationId:
                  probe.movement.playerRoute.targetLocationId ?? null,
              }
            : null,
        }
      : null,
    objective: probe.objective
      ? {
          outcomeIds: (probe.objective.outcomes ?? []).map(
            (outcome) => outcome.id,
          ),
          routeKey: probe.objective.routeKey ?? null,
          text: probe.objective.text ?? null,
        }
      : null,
    visualPlayer: probe.visualPlayer
      ? {
          isMovingToServerState:
            probe.visualPlayer.isMovingToServerState ?? null,
          targetX: probe.visualPlayer.targetX ?? null,
          targetY: probe.visualPlayer.targetY ?? null,
        }
      : null,
  };
}

function assertPlanningTracePayload(label, planningTrace) {
  const legalBackingSources = new Set([
    "conversation-resolution",
    "current-legal-action-surface",
    "destination-preview-legal-action",
    "projected-follow-up-legal-action",
    "simulator-validated-move",
    "simulator-validated-wait",
  ]);
  const recommendationSourceKinds = new Set([
    "deterministic-planner",
    "live-llm",
  ]);
  const validationStatuses = new Set([
    "conversation-resolution",
    "legal-action-surface-validated",
    "projected-legal-action",
    "simulator-validated",
    "unvalidated",
  ]);
  assert.ok(
    Array.isArray(planningTrace.outcomes),
    `${label}: planner trace is missing outcome predicates.`,
  );
  assert.ok(
    Array.isArray(planningTrace.nextSteps),
    `${label}: planner trace is missing short-horizon next steps.`,
  );
  assert.ok(
    planningTrace.nextSteps.every(
      (step) =>
        step.label &&
        step.rationale &&
        typeof step.legal === "boolean" &&
        step.kind &&
        step.validation &&
        Object.prototype.hasOwnProperty.call(step, "legalBacking") &&
        Object.prototype.hasOwnProperty.call(step, "targetLocationId") &&
        Object.prototype.hasOwnProperty.call(step, "npcId"),
    ),
    `${label}: planner trace next steps must expose kind, legality, backing, validation, target, and npc.`,
  );
  assert.ok(
    planningTrace.considered.every(
      (option) =>
        typeof option.score === "number" &&
        typeof option.planKey === "string" &&
        option.planKey.length > 0 &&
        option.rationale &&
        Object.prototype.hasOwnProperty.call(option, "targetLocationId") &&
        Object.prototype.hasOwnProperty.call(option, "npcId") &&
        Object.prototype.hasOwnProperty.call(option, "matchedOutcomeId") &&
        Object.prototype.hasOwnProperty.call(option, "pressureId") &&
        Object.prototype.hasOwnProperty.call(option, "pressureKind") &&
        Object.prototype.hasOwnProperty.call(option, "pressureLabel") &&
        Object.prototype.hasOwnProperty.call(option, "legalBacking") &&
        Object.prototype.hasOwnProperty.call(option, "provenance"),
    ),
    `${label}: planner trace considered options must expose plan key, score, rationale, target, npc, outcome, pressure, legal backing, and provenance metadata.`,
  );
  const selectedTraceOption = planningTrace.considered.find(
    (option) => option.status === "selected",
  );
  const selectedActionId =
    planningTrace.selectedActionId ?? selectedTraceOption?.actionId ?? null;
  const selectedStep = selectedPlanningTraceStep(planningTrace);
  const selectedLegalBacking =
    planningTrace.selectedLegalBacking ??
    selectedTraceOption?.legalBacking ??
    null;
  assert.ok(
    planningTrace.selectedPlanKey &&
      selectedTraceOption?.planKey === planningTrace.selectedPlanKey,
    `${label}: planner trace selectedPlanKey must match the selected considered option.`,
  );
  assert.ok(
    selectedTraceOption &&
      !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(selectedTraceOption.provenance),
    `${label}: selected planner option must not have stale predicate, stale trail, or route scaffold provenance.`,
  );
  assert.ok(
    selectedLegalBacking?.source &&
      legalBackingSources.has(selectedLegalBacking.source),
    `${label}: selected planner option must expose a concrete legal backing source.`,
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(planningTrace, "selectedPressureId") &&
      Object.prototype.hasOwnProperty.call(
        planningTrace,
        "selectedPressureKind",
      ) &&
      Object.prototype.hasOwnProperty.call(
        planningTrace,
        "selectedMatchedOutcomeId",
      ) &&
      Object.prototype.hasOwnProperty.call(
        planningTrace,
        "selectedLegalBacking",
      ) &&
      Object.prototype.hasOwnProperty.call(
        planningTrace,
        "selectedRecommendation",
      ) &&
      Object.prototype.hasOwnProperty.call(
        planningTrace,
        "selectedTargetLocationId",
      ),
    `${label}: planner trace must expose selected pressure, selected outcome, selected legal backing, selected recommendation provenance, and selected target metadata.`,
  );
  const selectedRecommendation = planningTrace.selectedRecommendation ?? null;
  const selectedHasAction = Boolean(selectedActionId);
  assert.ok(
    selectedRecommendation &&
      recommendationSourceKinds.has(selectedRecommendation.sourceKind) &&
      typeof selectedRecommendation.accepted === "boolean" &&
      typeof selectedRecommendation.advisory === "boolean" &&
      validationStatuses.has(selectedRecommendation.validationStatus),
    `${label}: planner trace selected recommendation must expose source kind, accepted/advisory flags, and validation status.`,
  );
  if (selectedHasAction) {
    assert.ok(
      selectedRecommendation.validationSource &&
        legalBackingSources.has(selectedRecommendation.validationSource) &&
        selectedRecommendation.legalBackingSource &&
        legalBackingSources.has(selectedRecommendation.legalBackingSource),
      `${label}: selected action recommendation must expose legal backing and validation sources.`,
    );
  }
  if (selectedActionId) {
    assert.ok(
      planningTrace.immediateAction &&
        planningTrace.immediateAction.actionId === selectedActionId &&
        typeof planningTrace.immediateAction.label === "string" &&
        planningTrace.immediateAction.label.length >= 4 &&
        planningTrace.immediateAction.legal === true,
      `${label}: planner trace must expose the immediate simulator-selected action for ${selectedActionId}.`,
    );
    assert.equal(
      planningTrace.selectedLabel,
      planningTrace.immediateAction.label,
      `${label}: selectedLabel must describe the immediate simulator-selected action, not only planner follow-up intent.`,
    );
    assert.equal(
      selectedStep?.label,
      planningTrace.immediateAction.label,
      `${label}: selected next step label must match the immediate action label.`,
    );
    assert.ok(
      planningTrace.plannerIntent &&
        typeof planningTrace.plannerIntent.label === "string" &&
        planningTrace.plannerIntent.label.length >= 4,
      `${label}: planner trace must preserve planner/follow-up intent separately from the immediate action.`,
    );
    if (
      /^(enter|exit|move|talk):/.test(selectedActionId) &&
      planningTrace.intendedFollowUp?.actionId &&
      planningTrace.intendedFollowUp.actionId !== selectedActionId
    ) {
      assert.notEqual(
        normalizeVisibleActionText(planningTrace.selectedLabel),
        normalizeVisibleActionText(planningTrace.intendedFollowUp.label),
        `${label}: selectedLabel still collapses the immediate action into projected follow-up intent.`,
      );
    }
    if (planningTrace.intendedFollowUp) {
      assert.notEqual(
        planningTrace.intendedFollowUp.actionId,
        selectedActionId,
        `${label}: intendedFollowUp must be a distinct follow-up step, not the immediate action repeated.`,
      );
    }
  }
  assert.ok(
    !selectedHasAction ||
      selectedRecommendation.validationStatus !== "unvalidated",
    `${label}: selected action recommendation cannot remain unvalidated.`,
  );
  if (selectedRecommendation.sourceKind === "live-llm") {
    assert.ok(
      selectedRecommendation.accepted === true &&
        selectedRecommendation.advisory === true &&
        typeof selectedRecommendation.provider === "string" &&
        selectedRecommendation.provider.length > 0 &&
        typeof selectedRecommendation.model === "string" &&
        selectedRecommendation.model.length > 0 &&
        typeof selectedRecommendation.confidence === "number" &&
        selectedRecommendation.confidence >= 0 &&
        selectedRecommendation.confidence <= 1 &&
        typeof selectedRecommendation.rationale === "string" &&
        selectedRecommendation.rationale.length >= 8,
      `${label}: accepted live-LLM planner recommendation must expose provider, model, confidence, rationale, and advisory acceptance.`,
    );
  }
  assert.ok(
    planningTrace.rejected.every(
      (option) =>
        Object.prototype.hasOwnProperty.call(option, "reason") &&
        Object.prototype.hasOwnProperty.call(option, "provenance"),
    ),
    `${label}: planner trace rejected options must expose rejection reasons and provenance.`,
  );
}

function assertVisibleDecisionArtifactPayload(label, artifact) {
  assert.ok(artifact, `${label}: missing visible decision artifact payload.`);
  assert.ok(
    typeof artifact.objective === "string" && artifact.objective.length >= 8,
    `${label}: decision artifact objective is missing or too thin.`,
  );
  assert.ok(
    Array.isArray(artifact.constraints) && artifact.constraints.length >= 1,
    `${label}: decision artifact must expose at least one constraint or signal.`,
  );
  assert.ok(
    Array.isArray(artifact.considered) && artifact.considered.length >= 1,
    `${label}: decision artifact must expose considered options.`,
  );
  assert.ok(
    typeof artifact.selectedAction === "string" &&
      artifact.selectedAction.length >= 4,
    `${label}: decision artifact selected action is missing.`,
  );
  assert.ok(
    typeof artifact.rationale === "string" && artifact.rationale.length >= 12,
    `${label}: decision artifact rationale is missing.`,
  );
  assert.ok(
    typeof artifact.backingSummary === "string" &&
      artifact.backingSummary.length >= 10,
    `${label}: decision artifact backing summary is missing.`,
  );
  assert.ok(
    typeof artifact.sourceSummary === "string" &&
      artifact.sourceSummary.length >= 8,
    `${label}: decision artifact source summary is missing.`,
  );
  if (artifact.nextCheck !== undefined) {
    assert.ok(
      typeof artifact.nextCheck === "string" && artifact.nextCheck.length >= 8,
      `${label}: decision artifact next check is too thin.`,
    );
  }

  const playerText = [
    artifact.objective,
    ...(artifact.constraints ?? []),
    ...(artifact.considered ?? []),
    artifact.nextCheck,
    ...(artifact.passedOver ?? []),
    artifact.selectedAction,
    artifact.rationale,
    artifact.backingSummary,
    artifact.sourceSummary,
  ].join(" ");
  assert.doesNotMatch(
    playerText,
    /(?:\b(routeKey|advance_objective|planningTrace|worldPressure|cityEvents|jobWindows|npcSchedules|npcPressureMoves|planKey|actionId|targetLocationId|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate)\b|That opening has closed|keeps to the confirmed choice)/i,
    `${label}: decision artifact leaked backend-shaped labels.`,
  );
  assert.doesNotMatch(
    playerText,
    /\b(?:Rowan is at [^,.]+,\s*so\b|useful next move|has a reason to get to [^,.]+ before deciding again)\b/i,
    `${label}: decision artifact fell back to generic route-playback wording.`,
  );
  assert.doesNotMatch(
    playerText,
    /\b(?:Yard|Tea-house) work lead confirmed\b[^.]{0,90}\bnot confirmed\b/i,
    `${label}: decision artifact contradicts a confirmed work-lead outcome with an unmet blocker.`,
  );
}

function assertVisibleDecisionNextCheckForTrace(
  label,
  planningTrace,
  artifact,
) {
  if (!planningTrace || !artifact) {
    return;
  }

  const expected = visibleDecisionNextCheck(
    planningTrace,
    selectedPlanningTraceStep(planningTrace),
    artifact.selectedAction ?? planningTrace.selectedLabel ?? "",
  );
  if (!expected) {
    return;
  }

  assert.equal(
    artifact.nextCheck,
    expected,
    `${label}: trace-backed next check is missing from the visible decision artifact.`,
  );
}

function assertVisibleDecisionSelectedActionMatchesImmediateStep(
  label,
  planningTrace,
  artifact,
  runtimeAction = null,
) {
  if (!planningTrace || !artifact) {
    return;
  }

  const selectedActionId = planningTrace.selectedActionId ?? "";
  if (!/^(enter|exit|move|talk):/.test(selectedActionId)) {
    return;
  }

  const selectedStep = selectedPlanningTraceStep(planningTrace);
  if (!selectedStep?.legal || selectedStep.actionId !== selectedActionId) {
    return;
  }

  const immediateActionLabel =
    runtimeAction?.actionId === selectedActionId
      ? runtimeAction.label
      : selectedStep.label;
  const expected = normalizeVisibleActionText(
    compactVisibleDecisionText(immediateActionLabel, 72),
  );
  const actual = normalizeVisibleActionText(artifact.selectedAction);
  if (!expected || !actual) {
    return;
  }

  assert.ok(
    actual.includes(expected),
    `${label}: visible selected action should include the immediate simulator-validated step "${immediateActionLabel}" for ${selectedActionId}, got "${artifact.selectedAction}".`,
  );
}

function normalizeVisibleActionText(value) {
  return String(value ?? "")
    .replace(/^following through:\s*/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function visibleDecisionArtifactMatchesDom(dom, artifactPayload = null) {
  if (!artifactPayload) {
    return true;
  }

  const artifact = dom?.visibleDecisionArtifact ?? null;
  if (!artifact?.visible) {
    return false;
  }
  if (
    artifactPayload.sourceSummary &&
    artifact.source !== artifactPayload.sourceSummary
  ) {
    return false;
  }

  const visibleText = normalizeVisibleActionText(artifact.text);
  return [
    artifactPayload.objective,
    artifactPayload.selectedAction,
    artifactPayload.rationale,
    artifactPayload.nextCheck,
  ]
    .filter(Boolean)
    .every((value) => {
      const expected = normalizeVisibleActionText(value);
      const prefix = expected.slice(0, Math.min(expected.length, 24)).trim();
      return prefix.length > 0 && visibleText.includes(prefix);
    });
}

function assertVisibleDecisionArtifactDom(label, dom, artifactPayload = null) {
  const artifact = dom?.visibleDecisionArtifact ?? null;
  assert.ok(artifact, `${label}: missing player-facing decision callback.`);
  assert.equal(
    artifact.visible,
    true,
    `${label}: decision callback exists but is not visible.`,
  );
  assert.match(
    artifact.text,
    /Rowan weighs/i,
    `${label}: decision callback should read as Rowan weighing a choice.`,
  );
  assert.match(
    artifact.text,
    /Aim/i,
    `${label}: decision callback should show Rowan's current aim.`,
  );
  assert.match(
    artifact.text,
    /Choice/i,
    `${label}: decision callback should show Rowan's selected choice.`,
  );
  assert.match(
    artifact.text,
    /Why this/i,
    `${label}: decision callback should show a concise rationale.`,
  );
  if (artifactPayload?.nextCheck) {
    assert.match(
      artifact.text,
      /Next check/i,
      `${label}: decision callback should show Rowan's short-horizon check.`,
    );
  }
  const passedOverOptionVisible = (artifactPayload?.passedOver ?? []).some(
    (entry) =>
      typeof entry === "string" &&
      entry.length > 0 &&
      artifact.text.includes(entry.slice(0, Math.min(entry.length, 24))),
  );
  if (passedOverOptionVisible) {
    assert.match(
      artifact.text,
      /Not now/i,
      `${label}: decision callback should show rejected options with a player-facing label.`,
    );
  }
  if (artifactPayload?.passedOver?.length) {
    assert.doesNotMatch(
      artifact.text,
      /Passed over/i,
      `${label}: decision callback should not use the old rejected-option label.`,
    );
  }
  assert.doesNotMatch(
    artifact.text,
    /Planner trace|Rejected:|Blocked:|Action:|routeKey|advance_objective|planningTrace|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate|That opening has closed|keeps to the confirmed choice/i,
    `${label}: decision callback leaked debug/planner language.`,
  );
  assert.doesNotMatch(
    artifact.text,
    /\b(?:Rowan is at [^,.]+,\s*so\b|useful next move|has a reason to get to [^,.]+ before deciding again)\b/i,
    `${label}: decision callback fell back to generic route-playback wording.`,
  );
}

function assertProbeAuditability(label, game, probe) {
  if (game.player.objective?.outcomes?.length) {
    assert.ok(
      probe.objective?.progress?.label,
      `${label}: objective probe is missing progress.`,
    );
    assert.ok(
      probe.objective.outcomes.every(
        (outcome) =>
          outcome.label &&
          Array.isArray(outcome.blockers) &&
          Object.prototype.hasOwnProperty.call(outcome, "actionId") &&
          Object.prototype.hasOwnProperty.call(outcome, "authority") &&
          Object.prototype.hasOwnProperty.call(outcome, "evidence") &&
          Object.prototype.hasOwnProperty.call(outcome, "npcId") &&
          Object.prototype.hasOwnProperty.call(outcome, "targetLocationId"),
      ),
      `${label}: objective probe must expose labels, authority, blockers, evidence, and predicate intent targets.`,
    );
  }

  if (game.player.objective?.routeKey === "first-afternoon") {
    assert.ok(
      probe.objective.outcomes.every(
        (outcome) => outcome.authority === "predicate",
      ),
      `${label}: first-afternoon outcomes must be explicit predicates, not trail-derived authority.`,
    );
  }

  if (probe.autonomy.planningTrace) {
    assertPlanningTracePayload(label, probe.autonomy.planningTrace);
    assertVisibleDecisionArtifactPayload(
      label,
      probe.autonomy.visibleDecisionArtifact,
    );
    assertVisibleDecisionNextCheckForTrace(
      label,
      probe.autonomy.planningTrace,
      probe.autonomy.visibleDecisionArtifact,
    );
    assertVisibleDecisionSelectedActionMatchesImmediateStep(
      label,
      probe.autonomy.planningTrace,
      probe.autonomy.visibleDecisionArtifact,
      probe.autonomy,
    );
    assertVisibleDecisionArtifactPayload(
      `${label} rail`,
      probe.rail.visibleDecisionArtifact,
    );
    assertVisibleDecisionNextCheckForTrace(
      `${label} rail`,
      probe.autonomy.planningTrace,
      probe.rail.visibleDecisionArtifact,
    );
    assertVisibleDecisionSelectedActionMatchesImmediateStep(
      `${label} rail`,
      probe.autonomy.planningTrace,
      probe.rail.visibleDecisionArtifact,
      probe.autonomy,
    );
  }

  assert.ok(
    (probe.worldPressure?.cityEvents ?? []).length >=
      (game.cityEvents ?? []).length,
    `${label}: world pressure probe is missing city events.`,
  );
  assert.ok(
    (probe.worldPressure?.cityEvents ?? []).every(
      (event) =>
        Object.prototype.hasOwnProperty.call(event, "outcome") &&
        Object.prototype.hasOwnProperty.call(event, "resolvedAt"),
    ),
    `${label}: world pressure city events must expose outcome and resolvedAt.`,
  );
  assert.ok(
    (probe.worldPressure?.jobWindows ?? []).length >= (game.jobs ?? []).length,
    `${label}: world pressure probe is missing job windows.`,
  );
  assert.ok(
    (probe.worldPressure?.problems ?? []).length >=
      (game.problems ?? []).length,
    `${label}: world pressure probe is missing problems.`,
  );
  assert.ok(
    (probe.worldPressure?.npcSchedules ?? []).length >=
      (game.npcs ?? []).length,
    `${label}: world pressure probe is missing NPC schedules.`,
  );
  const expectedNpcPressureMoves = sortedNpcPressureMoves(
    npcPressureMovesFromSchedules(probe.worldPressure?.npcSchedules ?? []),
  );
  if (expectedNpcPressureMoves.length > 0) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        probe.worldPressure ?? {},
        "npcPressureMoves",
      ),
      `${label}: world pressure probe must expose direct npcPressureMoves when NPCs are away from schedule due live pressure.`,
    );
    assert.ok(
      Array.isArray(probe.worldPressure?.npcPressureMoves),
      `${label}: world pressure npcPressureMoves must be an array.`,
    );
    assert.deepEqual(
      sortedNpcPressureMoves(probe.worldPressure.npcPressureMoves),
      expectedNpcPressureMoves,
      `${label}: world pressure npcPressureMoves must directly match schedule/current pressure mismatches.`,
    );
  }
  assert.ok(
    (probe.independentNpcActions ?? []).every(
      (action) => isIndependentLocalAction(action),
    ),
    `${label}: independent local action probe must expose compact actor, before/after, time, and player-facing summary evidence.`,
  );

  if (probe.independentNpcSurface) {
    const surface = probe.independentNpcSurface;
    assert.ok(
      surface.slot === "just_happened",
      `${label}: independent NPC surface must stay outside Rowan's current Now rail beat.`,
    );
    assert.ok(
      isIndependentLocalAction(surface) &&
        surface.title &&
        surface.detail,
      `${label}: independent local action surface must stay backed by subject, actor, time, title, and visible copy.`,
    );
    assert.ok(
      independentNpcActionTextIsPlayerFacing(`${surface.title} ${surface.detail}`),
      `${label}: independent local action surface leaked debug fields into the visible rail copy.`,
    );
  }
}

function renderedConversationLinePrefixLength(bodyText, expectedLine) {
  const normalizedBodyText = (bodyText ?? "").replace(/\s+/g, " ").trim();
  const normalizedExpectedLine = (expectedLine ?? "")
    .replace(/\s+/g, " ")
    .trim();
  for (let length = normalizedExpectedLine.length; length >= 8; length -= 1) {
    if (normalizedBodyText.includes(normalizedExpectedLine.slice(0, length))) {
      return length;
    }
  }
  return 0;
}

function updateConversationPlaybackProgress({
  bodyText,
  elapsedMs,
  expectedLine,
  progress,
}) {
  const prefixLength = renderedConversationLinePrefixLength(
    bodyText,
    expectedLine,
  );
  if (prefixLength <= progress.maxPrefixLength) {
    return progress;
  }
  return {
    advanceCount: progress.advanceCount + 1,
    lastProgressElapsedMs: elapsedMs,
    maxPrefixLength: prefixLength,
  };
}

function shouldContinueConversationDomWait({ elapsedMs, progress }) {
  if (elapsedMs < SIM_WAIT_TIMEOUT_MS) {
    return true;
  }
  return Boolean(
    elapsedMs <
      SIM_WAIT_TIMEOUT_MS + SIM_CONVERSATION_PLAYBACK_EXTRA_WAIT_MS &&
      progress.advanceCount >= 2,
  );
}

function assertConversationPlaybackWaitRegression() {
  const expectedLine = "Do you still need hands, or should Rowan move on?";
  let progress = {
    advanceCount: 0,
    lastProgressElapsedMs: null,
    maxPrefixLength: 0,
  };
  progress = updateConversationPlaybackProgress({
    bodyText: "Do you still",
    elapsedMs: 13_500,
    expectedLine,
    progress,
  });
  progress = updateConversationPlaybackProgress({
    bodyText: "Do you still need hands, or",
    elapsedMs: 14_750,
    expectedLine,
    progress,
  });
  assert.equal(
    shouldContinueConversationDomWait({ elapsedMs: 15_000, progress }),
    true,
    "recent visible conversation progress should extend the DOM settlement wait",
  );
  assert.equal(
    shouldContinueConversationDomWait({ elapsedMs: 20_000, progress }),
    true,
    "proven type-on playback should retain its bounded settlement window through hosted-runner pauses",
  );
  assert.equal(
    shouldContinueConversationDomWait({
      elapsedMs: 15_000,
      progress: {
        advanceCount: 1,
        lastProgressElapsedMs: 14_750,
        maxPrefixLength: 28,
      },
    }),
    false,
    "a single partial transcript sample must not extend the DOM wait",
  );
  assert.equal(
    shouldContinueConversationDomWait({
      elapsedMs:
        SIM_WAIT_TIMEOUT_MS + SIM_CONVERSATION_PLAYBACK_EXTRA_WAIT_MS,
      progress: updateConversationPlaybackProgress({
        bodyText: expectedLine.slice(0, -1),
        elapsedMs:
          SIM_WAIT_TIMEOUT_MS +
          SIM_CONVERSATION_PLAYBACK_EXTRA_WAIT_MS -
          1,
        expectedLine,
        progress,
      }),
    }),
    false,
    "conversation playback settlement must retain a hard deadline",
  );
  assert.equal(
    renderedConversationLinePrefixLength(
      "Unrelated transcript copy changed while waiting.",
      expectedLine,
    ),
    0,
    "unrelated transcript growth must not count as final-line progress",
  );
}

async function waitForGameplayDom(label, session, probe, game) {
  const expectedLabel = probe.autonomy.label.slice(0, 28);
  const expectedPattern = new RegExp(escapeRegExp(expectedLabel), "i");
  const expectedConversationLine = game.activeConversation?.lines
    .at(-1)
    ?.text.replace(/\s+/g, " ")
    .trim();
  const startedAt = Date.now();
  let lastDom = null;
  let lastReadableSignature = null;
  let lastReadabilityError = null;
  let readableStableSamples = 0;
  let conversationPlaybackProgress = {
    advanceCount: 0,
    lastProgressElapsedMs: null,
    maxPrefixLength: 0,
  };

  while (
    shouldContinueConversationDomWait({
      elapsedMs: Date.now() - startedAt,
      progress: conversationPlaybackProgress,
    })
  ) {
    try {
      await session.waitForAnimationFrames(2);
      lastDom = await session.readDomSnapshot();
      if (lastDom?.hasFrameworkErrorOverlay) {
        return lastDom;
      }
      const normalizedBodyText = (lastDom?.bodyText ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (expectedConversationLine) {
        conversationPlaybackProgress = updateConversationPlaybackProgress({
          bodyText: normalizedBodyText,
          elapsedMs: Date.now() - startedAt,
          expectedLine: expectedConversationLine,
          progress: conversationPlaybackProgress,
        });
      }
      const conversationFullyRendered =
        !expectedConversationLine ||
        normalizedBodyText.includes(expectedConversationLine);
      if (
        expectedPattern.test(normalizedBodyText) &&
        conversationFullyRendered
      ) {
        try {
          assertRailReadability(label, game, probe, lastDom);
          if (!expectedConversationLine) {
            return lastDom;
          }

          const readableSignature = JSON.stringify({
            conversationText: lastDom.conversationText,
            exchange: lastDom.layout?.latestChatExchange,
            latestBubble: lastDom.layout?.latestChatBubble,
            scrollTop: lastDom.layout?.commandRail?.scrollTop,
          });
          readableStableSamples =
            readableSignature === lastReadableSignature
              ? readableStableSamples + 1
              : 1;
          lastReadableSignature = readableSignature;
          if (readableStableSamples >= 2) {
            return lastDom;
          }
        } catch (error) {
          lastReadabilityError =
            error instanceof Error ? error.message : String(error);
        }
      } else if (expectedConversationLine) {
        lastReadabilityError = "final conversation line is still streaming";
      }
    } catch {}

    await sleep(PROBE_POLL_INTERVAL_MS);
  }

  assert.fail(
    `${label}: rendered UI did not catch up to the current Rowan beat "${expectedLabel}". Last DOM: ${
      lastDom?.bodyTextSample ?? "missing"
    }. Conversation playback: ${JSON.stringify(
      conversationPlaybackProgress,
    )}. Last readability error: ${lastReadabilityError ?? "none"}`,
  );
}

async function refreshProbeForVisibleIndependentNpcSurface({
  label,
  probe,
  session,
}) {
  if (!shouldRefreshVisibleIndependentNpcSurface({ label, probe })) {
    return probe;
  }

  const domShowsIndependentSurface = (candidateDom) =>
    /city beat|steadied|contained|closed|load out/i.test(
      candidateDom?.bodyText ?? "",
    );
  return waitFor(
    async () => {
      const refreshedProbe = await session.readBrowserProbe();
      if (refreshedProbe.independentNpcSurface) {
        return refreshedProbe;
      }
      const refreshedDom = await session
        .readDomSnapshot(`${label}:independent-npc-surface-refresh-dom`)
        .catch(() => null);
      if (!domShowsIndependentSurface(refreshedDom)) {
        return null;
      }

      const surfaceProbe = await session
        .readBrowserProbe(`${label}:independent-npc-surface-refresh-probe`)
        .catch(() => null);
      if (surfaceProbe?.independentNpcSurface) {
        return surfaceProbe;
      }
      return null;
    },
    5_000,
    `${label}: visible independent NPC city beat did not reach the browser probe before capture.`,
  );
}

function shouldRefreshVisibleIndependentNpcSurface({ label, probe }) {
  return Boolean(
    label === "independent-npc-resolution" &&
      !probe.independentNpcSurface &&
      (probe.independentNpcActions ?? []).length > 0,
  );
}

function unavailableApproachAdviceFailures(probe, text) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return [];
  }

  const failures = [];
  const jobWindows = probe?.worldPressure?.jobWindows ?? [];
  const teaJob = jobWindows.find((job) => job.id === "job-tea-shift");
  const teaUnavailable = Boolean(
    teaJob &&
      (teaJob.completed ||
        teaJob.missed ||
        (!teaJob.inWindow && teaJob.startsInMinutes === null)),
  );
  const mentionsTeaWork =
    /\b(?:ada|cup-and-counter|lunch (?:hands|rush|shift|work)|tea(?:-house)? shift)\b/.test(
      normalized,
    );
  const teaClosure =
    /\b(?:ada|kettle\s*&?\s*lamp|cup-and-counter|lunch|shift)\b[^.!?;]{0,72}\b(?:already|cannot|can't|closed|complete|completed|done|finished|gone|missed|moved on|no longer|old|over|settled)\b/.test(
      normalized,
    );
  const prescribesTea =
    /\b(?:ask|choose|go|head|take|try|work)\b[^.!?;]{0,32}\b(?:ada|kettle\s*&?\s*lamp|cup-and-counter|lunch|shift)\b/.test(
      normalized,
    );
  const rejectsTea =
    /\b(?:do not|don't|leave|stop)\b[^.!?;]{0,72}\b(?:ada|kettle\s*&?\s*lamp|cup-and-counter|lunch|shift)\b/.test(
      normalized,
    );
  if (
    teaUnavailable &&
    ((mentionsTeaWork && !teaClosure) || (prescribesTea && !rejectsTea))
  ) {
    failures.push("completed-or-closed-tea-work-presented-as-current");
  }

  const pump = (probe?.worldPressure?.problems ?? []).find(
    (problem) => problem.id === "problem-pump",
  );
  const pumpUnavailable = Boolean(pump && pump.status !== "active");
  const mentionsPump = /\b(?:leaking pump|morrow yard pump|pump|wrench)\b/.test(
    normalized,
  );
  const pumpClosure =
    /\b(?:pump|morrow yard)\b[^.!?;]{0,72}\b(?:already|contained|fixed|resolved|settled|solved|stopped)\b/.test(
      normalized,
    );
  const prescribesPump =
    /\b(?:choose|deal with|fix|go|head|help|inspect|take|try)\b[^.!?;]{0,32}\b(?:pump|morrow yard|wrench)\b/.test(
      normalized,
    );
  const rejectsPump =
    /\b(?:do not|don't|leave|stop)\b[^.!?;]{0,72}\b(?:pump|morrow yard|wrench)\b/.test(
      normalized,
    );
  if (
    pumpUnavailable &&
    mentionsPump &&
    (!pumpClosure || (prescribesPump && !rejectsPump))
  ) {
    failures.push("resolved-pump-presented-as-current");
  }

  return failures;
}

const CURRENT_ADVICE_PLAYBACK_KINDS = new Set([
  "action_start",
  "move",
  "objective_shift",
  "thread_line",
  "thread_open",
]);

function currentApproachAdviceAuthorities(probe, dom) {
  const authorities = [];
  const add = (source, text) => {
    const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
    if (normalized) {
      authorities.push({ source, text: normalized });
    }
  };
  const autonomy = probe?.autonomy;
  const objective = probe?.objective;
  const decisionArtifact =
    autonomy?.visibleDecisionArtifact ??
    probe?.rail?.visibleDecisionArtifact ??
    null;

  add("autonomy.label", autonomy?.label);
  add("autonomy.detail", autonomy?.detail);
  add("autonomy.intent.reason", autonomy?.intent?.reason);
  add("objective.text", objective?.text);
  for (const outcome of objective?.outcomes ?? []) {
    if (outcome.status !== "met") {
      add(`objective.outcome.${outcome.id}`, outcome.label);
    }
  }
  for (const hint of objective?.trailHints ?? []) {
    if (!hint.done) {
      add(`objective.trail.${hint.id}`, hint.title);
    }
  }

  add("decision.selectedAction", decisionArtifact?.selectedAction);
  add("decision.objective", decisionArtifact?.objective);
  add("decision.rationale", decisionArtifact?.rationale);
  add("decision.nextCheck", decisionArtifact?.nextCheck);
  add("rail.next", probe?.rail?.next);

  const activePlaybackKind = probe?.playback?.activeKind ?? null;
  if (
    !activePlaybackKind ||
    CURRENT_ADVICE_PLAYBACK_KINDS.has(activePlaybackKind)
  ) {
    add("rail.now", probe?.rail?.now);
    add("rail.thought", probe?.rail?.thought);
  }

  if (
    probe?.activeConversation ||
    probe?.rail?.useConversationTranscript
  ) {
    add("conversation.current", dom?.conversationText);
  }

  return authorities;
}

function unavailableApproachAdviceFailureDetails(probe, authorities) {
  return authorities.flatMap((authority) =>
    unavailableApproachAdviceFailures(probe, authority.text).map((reason) => ({
      reason,
      source: authority.source,
      text: authority.text,
    })),
  );
}

function assertNoUnavailableApproachAdvice(label, probe, dom) {
  const authorities = currentApproachAdviceAuthorities(probe, dom);
  const failures = unavailableApproachAdviceFailureDetails(
    probe,
    authorities,
  );
  assert.deepEqual(
    failures,
    [],
    `${label}: visible advice reused a completed or closed approach: ${JSON.stringify(
      { authorities, failures },
      null,
      2,
    )}`,
  );
}

function assertUnavailableApproachAdviceAuthorityRegression() {
  const completedTeaJob = {
    completed: true,
    id: "job-tea-shift",
    inWindow: false,
    missed: false,
    startsInMinutes: null,
  };
  const historicalCompletionProbe = {
    activeConversation: null,
    autonomy: {
      detail: "Return to Morrow House to take stock.",
      intent: {
        reason:
          "One durable consequence landed, and Morrow House is the right place to record what changed.",
      },
      label: "Exit to South Quay",
      visibleDecisionArtifact: {
        nextCheck: "First afternoon taken stock: Rowan is not home yet.",
        objective: "Return to Morrow House",
        rationale: "Return to Morrow House to take stock.",
        selectedAction: "Exit to South Quay",
      },
    },
    objective: {
      outcomes: [
        {
          id: "first-afternoon-consequence",
          label: "Cup-and-counter shift completed for $14",
          status: "met",
        },
        {
          id: "first-afternoon-take-stock",
          label: "First afternoon taken stock",
          status: "blocked",
        },
      ],
      text: "Return to Morrow House and take stock.",
      trailHints: [
        {
          done: true,
          id: "tea-shift",
          title: "Complete the Cup-and-counter shift.",
        },
        {
          done: false,
          id: "take-stock",
          title: "Head back to Morrow House and take stock.",
        },
      ],
    },
    playback: {
      activeKind: "action_complete",
      activeTitle: "Cup-and-counter shift complete",
    },
    rail: {
      next: "Exit to South Quay",
      now: "Cup-and-counter shift complete",
      thought:
        "Rowan made it through Kettle & Lamp and came away with +$14.",
      useConversationTranscript: false,
    },
    worldPressure: { jobWindows: [completedTeaJob], problems: [] },
  };
  const historicalAuthorities = currentApproachAdviceAuthorities(
    historicalCompletionProbe,
    {},
  );
  assert.deepEqual(
    unavailableApproachAdviceFailureDetails(
      historicalCompletionProbe,
      historicalAuthorities,
    ),
    [],
    "Completed tea work may remain visible as outcome/history while the current recommendation points home.",
  );
  assert.ok(
    historicalAuthorities.every(
      (authority) =>
        authority.source !== "rail.now" && authority.source !== "rail.thought",
    ),
    "Action-complete playback must not be classified as current advice.",
  );

  const staleCurrentProbe = {
    ...historicalCompletionProbe,
    autonomy: {
      ...historicalCompletionProbe.autonomy,
      label: "Take the Cup-and-counter shift",
    },
  };
  assert.ok(
    unavailableApproachAdviceFailureDetails(
      staleCurrentProbe,
      currentApproachAdviceAuthorities(staleCurrentProbe, {}),
    ).some(
      (failure) =>
        failure.reason ===
          "completed-or-closed-tea-work-presented-as-current" &&
        failure.source === "autonomy.label",
    ),
    "Completed tea work must still fail when current autonomy genuinely recommends it.",
  );
}

function assertGameplayDom(label, game, probe, dom) {
  assert.ok(dom, `${label}: expected a browser DOM snapshot.`);
  assert.equal(
    dom.hasFrameworkErrorOverlay,
    false,
    `${label}: browser rendered a framework/runtime error overlay.`,
  );
  assert.equal(dom.hasCanvas, true, `${label}: game canvas is missing.`);
  assert.ok(
    (dom.canvasRect?.width ?? 0) >= 900,
    `${label}: game canvas width is unexpectedly small (${dom.canvasRect?.width ?? "missing"}).`,
  );
  assert.ok(
    (dom.canvasRect?.height ?? 0) >= 500,
    `${label}: game canvas height is unexpectedly small (${dom.canvasRect?.height ?? "missing"}).`,
  );
  assert.equal(dom.hasRail, true, `${label}: Rowan rail is missing.`);
  assert.match(
    dom.bodyText,
    /Rowan/i,
    `${label}: rendered UI does not mention Rowan.`,
  );
  assert.match(
    dom.bodyText,
    new RegExp(escapeRegExp(probe.autonomy.label.slice(0, 28)), "i"),
    `${label}: rendered UI does not show the current Rowan beat.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /Planner trace|Rejected:|Blocked:|fits the current objective|current objective|Action:/i,
    `${label}: default Rowan rail leaked debug/planner language.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /Nudge Rowan|Do this step|This step is ready now|A next step is ready|Advance now|Autoplay is on; this skips|skip the (?:wait|pause)|confirm and commit/i,
    `${label}: default Rowan rail leaked stale stepper or scaffold copy.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /belongs here/i,
    `${label}: default Rowan rail leaked mechanical location language.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /already (?:picked|chose)|confirms? the route|confirmation of (?:the )?route|instead of changing course|preselected route|route-control|needs the street route|street route from|street route before asking/i,
    `${label}: default Rowan rail leaked route-control copy instead of Rowan's situated reason.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /Ask Ada.*at Morrow House|Ada(?:'s)?[^.\n]{0,100}at Morrow House|Ada work at Morrow House/i,
    `${label}: default Rowan rail described Ada's cafe lead as happening at Morrow House.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /is not here right now|Rowan heads to [A-Z][^.\n]+ to [A-Z][^.\n]+ is the next stop|to morrow House/,
    `${label}: default Rowan rail/feed leaked stale movement or wrong-space copy.`,
  );
  if (probe.autonomy?.planningTrace) {
    assertVisibleDecisionArtifactDom(
      label,
      dom,
      probe.autonomy.visibleDecisionArtifact,
    );
  }
  assert.doesNotMatch(
    dom.bodyText,
    /\{"message":|"message"\s*:\s*"Game\s+game-|Game\s+game-[A-Za-z0-9-]+\s+was not found/i,
    `${label}: default Rowan rail leaked a raw missing-game backend error.`,
  );

  if (game.activeConversation) {
    const npcName =
      game.npcs.find((npc) => npc.id === game.activeConversation.npcId)?.name ??
      game.activeConversation.npcId;
    assert.match(
      dom.bodyText,
      new RegExp(escapeRegExp(npcName), "i"),
      `${label}: rendered UI does not show the active conversation NPC.`,
    );
  }

  assertPlayerFacingObjectiveSequenceCoherence(label, probe, dom);
  assertNoUnavailableApproachAdvice(label, probe, dom);
  assertNoVisibleWatchModeProgressionControls(label, probe, dom);
  assertRailReadability(label, game, probe, dom);

  if (label === "lunch-rush") {
    assert.match(
      dom.bodyText,
      /lunch rush|cup-and-counter|counter/i,
      `${label}: rendered UI does not surface the cafe shift context.`,
    );
  }

  if (label === "first-afternoon-complete") {
    assert.ok(
      game.firstAfternoon?.fieldNote,
      `${label}: first-afternoon field note was not persisted by the sim.`,
    );
    const leadNote = dom.fieldNotes.find(
      (note) => note.key === "mara-ada-lead",
    );
    assert.doesNotMatch(
      leadNote?.text ?? "",
      /Choose whether to take the cup-and-counter shift now/i,
      `${label}: completed run still shows stale lead-note next-step copy.`,
    );
    assert.match(
      leadNote?.text ?? "",
      /first afternoon is settled|shift paid|Return to Morrow House|take stock/i,
      `${label}: completed run does not show state-derived lead-note next-step copy.`,
    );
  }

  assertCriticalVisualCoherence(label, dom);
}

function assertNoVisibleWatchModeProgressionControls(label, probe, dom) {
  if (!probe?.watchMode?.enabled || probe.watchMode.frozen) {
    return;
  }

  assert.deepEqual(
    dom.visibleProgressionControls ?? [],
    [],
    `${label}: watch mode exposed visible progression/action controls: ${JSON.stringify(
      dom.visibleProgressionControls ?? [],
      null,
      2,
    )}`,
  );

  assert.deepEqual(
    dom.watchModeReplyAffordances ?? [],
    [],
    `${label}: watch mode exposed reply/action-looking conversation affordances: ${JSON.stringify(
      dom.watchModeReplyAffordances ?? [],
      null,
      2,
    )}`,
  );

  if (probe.activeConversation) {
    assert.match(
      visibleWatchModeConversationCopy(dom),
      /Rowan (?:replies automatically|is replying automatically|will answer automatically|will keep the conversation moving|is carrying the conversation)/i,
      `${label}: watch-mode conversation does not expose passive carry-forward copy.`,
    );
  }
}

function visibleWatchModeConversationCopy(dom) {
  return [dom?.conversationText, dom?.bodyText].filter(Boolean).join(" ");
}

function hasVisibleWatchModeConversationCopy(dom) {
  return /Rowan (?:replies automatically|is replying automatically|will answer automatically|will keep the conversation moving|is carrying the conversation)/i.test(
    visibleWatchModeConversationCopy(dom),
  );
}

function assertPlayerFacingObjectiveSequenceCoherence(label, probe, dom) {
  const visibleText = [
    dom.bodyText,
    probe.rail?.now,
    probe.rail?.next,
    probe.rail?.thought,
    probe.autonomy?.label,
    probe.autonomy?.intent?.reason,
    ...(probe.autonomy?.intent?.signals ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const visibleKettleIntent =
    /\b(?:Ada|Kettle\s*&?\s*Lamp|cafe|lunch work|cup-and-counter)\b/i.test(
      visibleText,
    );
  if (!visibleKettleIntent) {
    return;
  }

  const selectedActionId =
    probe.autonomy?.planningTrace?.selectedActionId ?? null;
  const selectedTargetLocationId =
    probe.autonomy?.planningTrace?.selectedTargetLocationId ??
    probe.autonomy?.targetLocationId ??
    null;
  const genericPrimaryCopy = /\bDo this step\b/i.test(dom.bodyText);
  const explainedLocalPrerequisite =
    /\b(?:before leaving|before Rowan leaves|local prerequisite|commit(?:s|ted)? to leaving|settle(?:s|d)? the plan|weigh(?:s|ed)? the first move)\b/i.test(
      visibleText,
    );

  assert.ok(
    !(
      selectedActionId === "reflect:first-afternoon-plan" &&
      selectedTargetLocationId === "boarding-house" &&
      (genericPrimaryCopy || !explainedLocalPrerequisite)
    ),
    `${label}: visible Ada/Kettle intent was backed by an unexplained Morrow House reflection micro-step.`,
  );
}

function compactObjectiveSequenceText(text, maxLength = 240) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function classifyObjectiveSequenceIntent(visibleText, probe) {
  const families = [];
  const objectiveText = [
    visibleText,
    probe.objective?.routeKey,
    probe.objective?.text,
    probe.objective?.focus,
    probe.objective?.progress?.label,
    probe.autonomy?.actionId,
    probe.autonomy?.label,
    probe.autonomy?.targetLocationId,
  ]
    .filter(Boolean)
    .join(" ");

  const postFirstAfternoonCommitted = Boolean(
    probe.firstAfternoon?.completionAcknowledgedAt,
  );
  const yardAuthorityText = [
    probe.objective?.routeKey,
    probe.autonomy?.actionId,
    probe.autonomy?.label,
    probe.autonomy?.targetLocationId,
    probe.location?.id,
  ]
    .filter(Boolean)
    .join(" ");

  if (
    postFirstAfternoonCommitted &&
    /\b(?:work-yard|freight yard|freight-yard|Tomas|yard lift|job-yard-shift)\b/i.test(
      yardAuthorityText,
    )
  ) {
    families.push("yard_work");
  }

  if (
    /\b(?:Ada|Kettle\s*&?\s*Lamp|cafe|lunch work|cup-and-counter)\b/i.test(
      objectiveText,
    )
  ) {
    families.push("ada_kettle_lead");
  }

  if (
    /\b(?:lunch rush|cup-and-counter|shift|counter|paid)\b/i.test(objectiveText)
  ) {
    families.push("cafe_shift");
  }

  if (
    /\b(?:Morrow House|return home|head back|room|take stock)\b/i.test(
      objectiveText,
    )
  ) {
    families.push("return_home");
  }

  if (
    /\b(?:take stock|field note|settled|first afternoon complete)\b/i.test(
      objectiveText,
    )
  ) {
    families.push("take_stock");
  }

  return [...new Set(families)];
}

function classifyObjectiveSequenceRouteRole({
  activeConversationNpcId,
  label,
  mode,
  selectedActionId,
  visibleText,
}) {
  const normalizedLabel = String(label ?? "");
  const actionId = String(selectedActionId ?? "");

  if (activeConversationNpcId || /^With\s+/i.test(normalizedLabel)) {
    return "conversation-resolution";
  }

  if (/^Talk\s+/i.test(normalizedLabel) || /^talk:/i.test(actionId)) {
    return "conversation-start";
  }

  if (
    /^exit:/i.test(actionId) ||
    /\bExit to South Quay\b/i.test(normalizedLabel)
  ) {
    return "portal-exit";
  }

  if (/^enter:/i.test(actionId) || /^Enter\s+/i.test(normalizedLabel)) {
    return "portal-enter";
  }

  if (
    /^move:/i.test(actionId) ||
    mode === "moving" ||
    /^Head\s+/i.test(normalizedLabel)
  ) {
    return "route-move";
  }

  if (
    /^work:/i.test(actionId) ||
    /\b(?:shift|lunch rush|counter)\b/i.test(normalizedLabel)
  ) {
    return "work";
  }

  if (/^reflect:/i.test(actionId)) {
    return /\b(?:take stock|choose|decide|weigh|record|note|settle)\b/i.test(
      visibleText,
    )
      ? "framed-reflection"
      : "internal-reflection";
  }

  if (mode === "waiting") {
    return "wait";
  }

  return "objective-action";
}

function compactPlanningTraceOption(option) {
  if (!option) {
    return null;
  }

  return {
    actionId: option.actionId ?? null,
    label: compactObjectiveSequenceText(option.label ?? "", 120),
    legalBacking: option.legalBacking
      ? {
          actionId: option.legalBacking.actionId ?? null,
          locationId: option.legalBacking.locationId ?? null,
          source: option.legalBacking.source ?? null,
        }
      : null,
    matchedOutcomeId: option.matchedOutcomeId ?? null,
    planKey: option.planKey ?? null,
    pressureId: option.pressureId ?? null,
    pressureKind: option.pressureKind ?? null,
    pressureLabel: compactObjectiveSequenceText(
      option.pressureLabel ?? "",
      120,
    ),
    provenance: option.provenance ?? null,
    reason: option.reason ?? null,
    status: option.status ?? null,
    targetLocationId: option.targetLocationId ?? null,
  };
}

function compactPlanningTraceStep(step) {
  if (!step) {
    return null;
  }

  return {
    actionId: step.actionId ?? null,
    kind: step.kind ?? null,
    label: compactObjectiveSequenceText(step.label ?? "", 120),
    legalBacking: step.legalBacking
      ? {
          actionId: step.legalBacking.actionId ?? null,
          locationId: step.legalBacking.locationId ?? null,
          source: step.legalBacking.source ?? null,
        }
      : null,
    legal: Boolean(step.legal),
    npcId: step.npcId ?? null,
    targetLocationId: step.targetLocationId ?? null,
    validation: compactObjectiveSequenceText(step.validation ?? "", 180),
  };
}

function compactPlanningTracePlannerIntent(intent) {
  if (!intent) {
    return null;
  }

  return {
    actionId: intent.actionId ?? null,
    label: compactObjectiveSequenceText(intent.label ?? "", 120),
    matchedOutcomeId: intent.matchedOutcomeId ?? null,
    npcId: intent.npcId ?? null,
    planKey: intent.planKey ?? null,
    pressureId: intent.pressureId ?? null,
    pressureKind: intent.pressureKind ?? null,
    pressureLabel: compactObjectiveSequenceText(
      intent.pressureLabel ?? "",
      120,
    ),
    rationale: compactObjectiveSequenceText(intent.rationale ?? "", 160),
    targetLocationId: intent.targetLocationId ?? null,
  };
}

function compactPlanningTraceRecommendation(recommendation) {
  if (!recommendation) {
    return null;
  }

  return {
    accepted: Boolean(recommendation.accepted),
    advisory: Boolean(recommendation.advisory),
    confidence:
      typeof recommendation.confidence === "number"
        ? recommendation.confidence
        : null,
    legalBackingSource: recommendation.legalBackingSource ?? null,
    model: recommendation.model ?? null,
    provider: recommendation.provider ?? null,
    rationale: compactObjectiveSequenceText(
      recommendation.rationale ?? "",
      160,
    ),
    sourceKind: recommendation.sourceKind ?? null,
    validationSource: recommendation.validationSource ?? null,
    validationStatus: recommendation.validationStatus ?? null,
  };
}

function compactVisibleDecisionArtifact(artifact) {
  if (!artifact) {
    return null;
  }

  return {
    backingSummary: compactObjectiveSequenceText(
      artifact.backingSummary ?? "",
      140,
    ),
    considered: (artifact.considered ?? []).map((entry) =>
      compactObjectiveSequenceText(entry, 120),
    ),
    constraints: (artifact.constraints ?? []).map((entry) =>
      compactObjectiveSequenceText(entry, 120),
    ),
    nextCheck: artifact.nextCheck
      ? compactObjectiveSequenceText(artifact.nextCheck, 160)
      : null,
    objective: compactObjectiveSequenceText(artifact.objective ?? "", 160),
    passedOver: (artifact.passedOver ?? []).map((entry) =>
      compactObjectiveSequenceText(entry, 140),
    ),
    rationale: compactObjectiveSequenceText(artifact.rationale ?? "", 180),
    selectedAction: compactObjectiveSequenceText(
      artifact.selectedAction ?? "",
      140,
    ),
    sourceSummary: compactObjectiveSequenceText(
      artifact.sourceSummary ?? "",
      140,
    ),
  };
}

function buildObjectiveSequenceAuthorityEvidence({
  autonomy,
  planningTrace,
  routeRole,
  selectedActionId,
}) {
  if (!planningTrace) {
    const nonActionResolution = routeRole === "conversation-resolution";
    const commitmentAction =
      routeRole === "work" &&
      Boolean(selectedActionId) &&
      autonomy?.layer === "commitment";
    return {
      authorityKinds: [
        ...(nonActionResolution ? ["conversation-resolution"] : []),
        ...(commitmentAction
          ? ["live-pressure:commitment", "autonomy-action"]
          : []),
      ],
      hasAutonomyAction: commitmentAction,
      hasLegalSelectedStep: false,
      hasPlannerTrace: false,
      nonActionResolution,
      rejectedStaleOptionCount: 0,
      rejectedStaleOptions: [],
      immediateAction: null,
      intendedFollowUp: null,
      plannerIntent: null,
      selectedConsideredOption: null,
      selectedLegalBacking: nonActionResolution
        ? {
            actionId: null,
            locationId: autonomy?.targetLocationId ?? null,
            source: "conversation-resolution",
          }
        : null,
      selectedLegalBackingSource: nonActionResolution
        ? "conversation-resolution"
        : null,
      selectedMatchedOutcomeId: null,
      selectedPressureId: commitmentAction
        ? `commitment:${selectedActionId}`
        : null,
      selectedPressureKind: commitmentAction ? "commitment" : null,
      selectedPressureLabel: null,
      selectedLabel: compactObjectiveSequenceText(autonomy?.label ?? "", 120),
      selectedStep: commitmentAction
        ? {
            actionId: selectedActionId,
            kind: autonomy?.stepKind ?? null,
            label: compactObjectiveSequenceText(autonomy?.label ?? "", 120),
            legalBacking: null,
            legal: null,
            targetLocationId: autonomy?.targetLocationId ?? null,
            validation:
              "Commitment loop action; simulator validates execution when the command is applied.",
          }
        : null,
      selectedRecommendation: null,
    };
  }

  const selectedConsideredOption =
    planningTrace.considered?.find(
      (option) =>
        option.status === "selected" &&
        (!planningTrace.selectedPlanKey ||
          option.planKey === planningTrace.selectedPlanKey),
    ) ??
    planningTrace.considered?.find((option) => option.status === "selected") ??
    null;
  const selectedStep =
    planningTrace.nextSteps?.find(
      (step) => selectedActionId && step.actionId === selectedActionId,
    ) ??
    planningTrace.nextSteps?.[0] ??
    null;
  const selectedPressureKind =
    planningTrace.selectedPressureKind ??
    selectedConsideredOption?.pressureKind ??
    null;
  const selectedMatchedOutcomeId =
    planningTrace.selectedMatchedOutcomeId ??
    selectedConsideredOption?.matchedOutcomeId ??
    null;
  const selectedPressureId =
    planningTrace.selectedPressureId ??
    selectedConsideredOption?.pressureId ??
    null;
  const selectedPressureLabel =
    planningTrace.selectedPressureLabel ??
    selectedConsideredOption?.pressureLabel ??
    null;
  const selectedLegalBacking =
    planningTrace.selectedLegalBacking ??
    selectedConsideredOption?.legalBacking ??
    selectedStep?.legalBacking ??
    null;
  const selectedRecommendation = compactPlanningTraceRecommendation(
    planningTrace.selectedRecommendation ?? null,
  );
  const authorityKinds = [];
  const selectedProvenance = selectedConsideredOption?.provenance ?? null;

  if (selectedMatchedOutcomeId || selectedPressureKind === "predicate") {
    authorityKinds.push("objective-predicate");
  }
  if (selectedPressureKind && selectedPressureKind !== "predicate") {
    authorityKinds.push(`live-pressure:${selectedPressureKind}`);
  }
  if (selectedStep?.legal && selectedLegalBacking?.source) {
    authorityKinds.push("legal-action");
    authorityKinds.push(`legal-action:${selectedLegalBacking.source}`);
  }
  if (selectedProvenance) {
    authorityKinds.push(`provenance:${selectedProvenance}`);
  }
  if (selectedRecommendation?.sourceKind) {
    authorityKinds.push(`planner-source:${selectedRecommendation.sourceKind}`);
  }
  if (selectedRecommendation?.advisory) {
    authorityKinds.push("planner-advisory");
  }
  if (selectedRecommendation?.validationStatus) {
    authorityKinds.push(
      `planner-validation:${selectedRecommendation.validationStatus}`,
    );
  }
  if (autonomy?.layer === "commitment") {
    authorityKinds.push("autonomy-action");
  }
  if (routeRole === "conversation-resolution" && !selectedActionId) {
    authorityKinds.push("conversation-resolution");
  }

  const rejectedStaleOptions = (planningTrace.rejected ?? [])
    .filter((option) =>
      SCAFFOLD_ONLY_TRACE_PROVENANCES.has(option.provenance),
    )
    .slice(0, 4)
    .map(compactPlanningTraceOption);

  return {
    authorityKinds: [...new Set(authorityKinds)],
    hasAutonomyAction: false,
    hasLegalSelectedStep: Boolean(
      selectedStep?.legal && selectedLegalBacking?.source,
    ),
    hasPlannerTrace: true,
    immediateAction: compactPlanningTraceStep(
      planningTrace.immediateAction ?? selectedStep,
    ),
    intendedFollowUp: compactPlanningTraceStep(planningTrace.intendedFollowUp),
    nonActionResolution:
      routeRole === "conversation-resolution" && !selectedActionId,
    plannerIntent: compactPlanningTracePlannerIntent(
      planningTrace.plannerIntent,
    ),
    rejectedStaleOptionCount: rejectedStaleOptions.length,
    rejectedStaleOptions,
    selectedConsideredOption: compactPlanningTraceOption(
      selectedConsideredOption,
    ),
    selectedLegalBacking: selectedLegalBacking
      ? {
          actionId: selectedLegalBacking.actionId ?? null,
          locationId: selectedLegalBacking.locationId ?? null,
          source: selectedLegalBacking.source ?? null,
        }
      : null,
    selectedLegalBackingSource: selectedLegalBacking?.source ?? null,
    selectedMatchedOutcomeId,
    selectedPressureId,
    selectedPressureKind,
    selectedPressureLabel: compactObjectiveSequenceText(
      selectedPressureLabel ?? "",
      120,
    ),
    selectedLabel: compactObjectiveSequenceText(
      planningTrace.selectedLabel ?? "",
      120,
    ),
    selectedProvenance,
    selectedRecommendation,
    selectedStep: compactPlanningTraceStep(selectedStep),
  };
}

function objectiveSequenceEntryNeedsPlannerAuthority(entry) {
  if (entry.routeRole === "conversation-resolution") {
    return false;
  }

  return Boolean(entry.selectedActionId);
}

function buildObjectiveSequenceAuditEntry({
  control,
  dom,
  kind,
  milestone,
  probe,
}) {
  const planningTrace = probe.autonomy?.planningTrace ?? null;
  const selectedActionId =
    planningTrace?.selectedActionId ??
    probe.autonomy?.actionId ??
    control?.actionId ??
    null;
  const selectedTargetLocationId =
    planningTrace?.selectedTargetLocationId ??
    probe.autonomy?.targetLocationId ??
    null;
  const visibleText = [
    control?.text,
    probe.rail?.now,
    probe.rail?.next,
    probe.rail?.thought,
    probe.autonomy?.label,
    probe.autonomy?.intent?.reason,
    ...(probe.autonomy?.intent?.signals ?? []),
    dom?.bodyTextSample,
  ]
    .filter(Boolean)
    .join(" ");
  const intentFamilies = classifyObjectiveSequenceIntent(visibleText, probe);
  const routeRole = classifyObjectiveSequenceRouteRole({
    activeConversationNpcId: probe.activeConversation?.npcId ?? null,
    label: probe.autonomy?.label ?? null,
    mode: probe.autonomy?.mode ?? null,
    selectedActionId,
    visibleText,
  });
  const currentLocationId = probe.location?.id ?? null;
  const genericCopy = /\bDo this step\b/i.test(visibleText);
  const sourceConversation =
    probe.activeConversation?.npcId === "npc-mara" &&
    intentFamilies.includes("ada_kettle_lead");
  const localPrerequisite =
    /\b(?:before leaving|before Rowan leaves|local prerequisite|commit(?:s|ted)? to leaving|settle(?:s|d)? the plan|weigh(?:s|ed)? the first move)\b/i.test(
      visibleText,
    );
  const failureReasons = [];

  if (genericCopy) {
    failureReasons.push("generic-primary-copy");
  }

  if (
    intentFamilies.includes("ada_kettle_lead") &&
    selectedActionId === "reflect:first-afternoon-plan" &&
    selectedTargetLocationId === "boarding-house" &&
    !sourceConversation &&
    !localPrerequisite
  ) {
    failureReasons.push("kettle-intent-backed-by-morrow-reflection");
  }

  const activeBeatText = [
    control?.text,
    probe.rail?.now,
    probe.rail?.next,
    probe.autonomy?.label,
    probe.autonomy?.intent?.reason,
  ]
    .filter(Boolean)
    .join(" ");
  const expectedTargetLocationId =
    /\b(?:North Crane Yard|freight yard|freight-yard|Tomas|yard lift|job-yard-shift)\b/i.test(
      activeBeatText,
    )
      ? "freight-yard"
      : /\b(?:toward Morrow House|Head to Morrow House|Return to Morrow House|Enter Morrow House|return home|head back|take stock|room)\b/i.test(
      activeBeatText,
    )
      ? "boarding-house"
      : /\b(?:Ada|Kettle\s*&?\s*Lamp|cafe|lunch work|cup-and-counter|shift|lunch rush|counter)\b/i.test(
            activeBeatText,
          )
        ? "tea-house"
        : intentFamilies.includes("yard_work")
            ? "freight-yard"
            : intentFamilies.includes("take_stock") ||
                intentFamilies.includes("return_home")
              ? "boarding-house"
              : intentFamilies.includes("ada_kettle_lead") ||
                  intentFamilies.includes("cafe_shift")
                ? "tea-house"
                : null;
  const authorityEvidence = buildObjectiveSequenceAuthorityEvidence({
    autonomy: probe.autonomy ?? null,
    planningTrace,
    routeRole,
    selectedActionId,
  });
  const visibleDecisionArtifact =
    probe.autonomy?.visibleDecisionArtifact ??
    probe.rail?.visibleDecisionArtifact ??
    null;
  const atExpectedLocation =
    expectedTargetLocationId && currentLocationId === expectedTargetLocationId;
  if (
    expectedTargetLocationId &&
    selectedTargetLocationId &&
    selectedTargetLocationId !== expectedTargetLocationId &&
    !atExpectedLocation &&
    !sourceConversation &&
    !localPrerequisite
  ) {
    failureReasons.push(
      `intent-target-mismatch:${expectedTargetLocationId}:${selectedTargetLocationId}`,
    );
  }

  if (routeRole === "internal-reflection") {
    failureReasons.push("unframed-internal-reflection");
  }

  if (
    routeRole === "portal-exit" &&
    !/\b(?:exit|step into|south quay|toward)\b/i.test(visibleText)
  ) {
    failureReasons.push("unframed-exit-prerequisite");
  }

  if (
    routeRole === "portal-enter" &&
    !/\b(?:enter|step into|inside)\b/i.test(visibleText)
  ) {
    failureReasons.push("unframed-enter-prerequisite");
  }

  if (
    /^Talk\s+/i.test(probe.autonomy?.label ?? "") &&
    !/\b(?:talk|ask|conversation|in person)\b/i.test(visibleText)
  ) {
    failureReasons.push("unframed-conversation-start");
  }

  if (
    routeRole === "work" &&
    !/\b(?:work|shift|lunch rush|counter|paid)\b/i.test(visibleText)
  ) {
    failureReasons.push("unframed-work-action");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    !authorityEvidence.hasPlannerTrace &&
    !authorityEvidence.hasAutonomyAction
  ) {
    failureReasons.push("missing-planner-authority-trace");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    !authorityEvidence.hasLegalSelectedStep &&
    !authorityEvidence.hasAutonomyAction
  ) {
    failureReasons.push("missing-legal-selected-step");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    authorityEvidence.selectedProvenance === "legal-action" &&
    !authorityEvidence.selectedLegalBackingSource
  ) {
    failureReasons.push("selected-legal-action-missing-backing-source");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    routeRole === "work" &&
    !authorityEvidence.hasLegalSelectedStep &&
    !authorityEvidence.hasAutonomyAction
  ) {
    failureReasons.push("missing-work-commitment-authority");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    SCAFFOLD_ONLY_TRACE_PROVENANCES.has(authorityEvidence.selectedProvenance)
  ) {
    failureReasons.push("selected-trace-provenance-is-scaffold-only");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    /^(enter|exit|move|talk):/.test(String(selectedActionId ?? "")) &&
    authorityEvidence.intendedFollowUp?.actionId &&
    authorityEvidence.intendedFollowUp.actionId !== selectedActionId &&
    normalizeVisibleActionText(authorityEvidence.selectedLabel) ===
      normalizeVisibleActionText(authorityEvidence.intendedFollowUp.label)
  ) {
    failureReasons.push("selected-label-collapses-follow-up-intent");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    !authorityEvidence.selectedMatchedOutcomeId &&
    !authorityEvidence.selectedPressureKind &&
    !(
      authorityEvidence.selectedProvenance === "legal-action" &&
      authorityEvidence.selectedLegalBackingSource
    )
  ) {
    failureReasons.push("missing-outcome-or-live-pressure-authority");
  }

  if (
    objectiveSequenceEntryNeedsPlannerAuthority({
      routeRole,
      selectedActionId,
    }) &&
    visibleDecisionArtifact &&
    authorityEvidence.hasPlannerTrace
  ) {
    const recommendation = authorityEvidence.selectedRecommendation;
    if (!recommendation?.sourceKind) {
      failureReasons.push("missing-advisory-vs-validated-provenance");
    }
    if (recommendation?.accepted !== true) {
      failureReasons.push("selected-recommendation-not-accepted");
    }
    if (
      !recommendation?.validationStatus ||
      recommendation.validationStatus === "unvalidated" ||
      !recommendation.validationSource
    ) {
      failureReasons.push("selected-recommendation-not-validated");
    }
    if (!recommendation?.legalBackingSource) {
      failureReasons.push("selected-recommendation-missing-legal-backing");
    }
    if (
      recommendation?.sourceKind === "live-llm" &&
      (!recommendation.advisory ||
        !recommendation.provider ||
        !recommendation.model ||
        typeof recommendation.confidence !== "number" ||
        !recommendation.rationale)
    ) {
      failureReasons.push("live-llm-recommendation-missing-diagnostics");
    }
  }

  return {
    activeConversationNpcId: probe.activeConversation?.npcId ?? null,
    authorityEvidence,
    autonomyLabel: probe.autonomy?.label ?? null,
    clock: probe.clock,
    controlText: compactObjectiveSequenceText(control?.text ?? kind),
    currentLocationId,
    currentSpaceId: probe.location?.spaceId ?? null,
    expectedTargetLocationId,
    failureReasons,
    firstAfternoonCompletionAcknowledgedAt:
      probe.firstAfternoon?.completionAcknowledgedAt ?? null,
    intentFamilies,
    kind,
    milestone,
    mode: probe.autonomy?.mode ?? null,
    objectiveRouteKey: probe.objective?.routeKey ?? null,
    objectiveText: compactObjectiveSequenceText(probe.objective?.text ?? ""),
    railNow: compactObjectiveSequenceText(probe.rail?.now ?? ""),
    railNext: compactObjectiveSequenceText(probe.rail?.next ?? ""),
    routeRole,
    selectedActionId,
    selectedPlanKey: planningTrace?.selectedPlanKey ?? null,
    selectedTargetLocationId,
    stepKind: probe.autonomy?.stepKind ?? null,
    targetLocationId: probe.autonomy?.targetLocationId ?? null,
    travelPhase: probe.autonomy?.travelPhase ?? null,
    visibleDecisionArtifact: compactVisibleDecisionArtifact(
      visibleDecisionArtifact,
    ),
    visibleTextSample: compactObjectiveSequenceText(visibleText, 360),
  };
}

function assertObjectiveSequenceAudit(objectiveSequenceAudit) {
  assert.ok(
    Array.isArray(objectiveSequenceAudit),
    "Objective sequence audit must be recorded as an array.",
  );
  assert.ok(
    objectiveSequenceAudit.length >= 10,
    `Objective sequence audit is too short to cover the first-afternoon path: ${objectiveSequenceAudit.length}.`,
  );

  const failingEntries = objectiveSequenceAudit.filter(
    (entry) => (entry.failureReasons ?? []).length > 0,
  );
  assert.equal(
    failingEntries.length,
    0,
    `Objective sequence audit found player-facing intent/target/micro-step failures: ${JSON.stringify(
      failingEntries,
      null,
      2,
    )}`,
  );

  const familySet = new Set(
    objectiveSequenceAudit.flatMap((entry) => entry.intentFamilies ?? []),
  );
  for (const requiredFamily of [
    "ada_kettle_lead",
    "cafe_shift",
    "return_home",
    "take_stock",
  ]) {
    assert.ok(
      familySet.has(requiredFamily),
      `Objective sequence audit did not cover the ${requiredFamily} segment.`,
    );
  }

  const routeRoleSet = new Set(
    objectiveSequenceAudit.map((entry) => entry.routeRole).filter(Boolean),
  );
  for (const requiredRole of [
    "conversation-resolution",
    "portal-enter",
    "portal-exit",
    "route-move",
    "work",
  ]) {
    assert.ok(
      routeRoleSet.has(requiredRole),
      `Objective sequence audit did not observe a ${requiredRole} beat.`,
    );
  }

  const entriesNeedingAuthority = objectiveSequenceAudit.filter(
    objectiveSequenceEntryNeedsPlannerAuthority,
  );
  assert.ok(
    entriesNeedingAuthority.length >= 8,
    `Objective sequence audit did not record enough planner-backed action beats: ${entriesNeedingAuthority.length}.`,
  );
  const missingAuthority = entriesNeedingAuthority.filter((entry) => {
    const evidence = entry.authorityEvidence ?? {};
    return (
      (!evidence.hasPlannerTrace && !evidence.hasAutonomyAction) ||
      (!evidence.hasLegalSelectedStep && !evidence.hasAutonomyAction) ||
      (!evidence.selectedMatchedOutcomeId && !evidence.selectedPressureKind)
    );
  });
  assert.equal(
    missingAuthority.length,
    0,
    `Objective sequence audit found action beats without predicate/live-pressure/concrete legal-action authority: ${JSON.stringify(
      missingAuthority,
      null,
      2,
    )}`,
  );
  const conversationResolutions = objectiveSequenceAudit.filter(
    (entry) => entry.routeRole === "conversation-resolution",
  );
  assert.ok(
    conversationResolutions.every(
      (entry) =>
        (entry.authorityEvidence?.nonActionResolution &&
          entry.authorityEvidence?.authorityKinds?.includes(
            "conversation-resolution",
          )) ||
        (entry.authorityEvidence?.hasLegalSelectedStep &&
          Boolean(
            entry.authorityEvidence?.selectedMatchedOutcomeId ||
            entry.authorityEvidence?.selectedPressureKind,
          )),
    ),
    "Objective sequence audit must classify conversation-resolution beats as non-action authority or planner-backed follow-through.",
  );
  const authorityKinds = new Set(
    objectiveSequenceAudit.flatMap(
      (entry) => entry.authorityEvidence?.authorityKinds ?? [],
    ),
  );
  for (const requiredAuthorityKind of [
    "objective-predicate",
    "legal-action",
    "conversation-resolution",
  ]) {
    assert.ok(
      authorityKinds.has(requiredAuthorityKind),
      `Objective sequence audit did not expose ${requiredAuthorityKind} authority.`,
    );
  }
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("legal-action:")),
    "Objective sequence audit did not expose a concrete legal-action backing source.",
  );
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("planner-source:")),
    "Objective sequence audit did not expose planner source-kind provenance.",
  );
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("planner-validation:")),
    "Objective sequence audit did not expose selected recommendation validation status.",
  );
}

function objectiveSequenceGroupIdForEntry(entry) {
  const label = entry.autonomyLabel ?? "";

  if (
    /^(?:Enter Morrow House|Talk to Mara|With Mara)$/i.test(label) &&
    entry.clock?.totalMinutes < 720
  ) {
    return "establish-room-and-mara-lead";
  }

  if (
    /^(?:Exit to South Quay|Head to Kettle & Lamp|Follow Mara's lead to Kettle & Lamp|On the way to Kettle & Lamp|Enter Kettle & Lamp|Talk to Ada)$/i.test(
      label,
    ) &&
    (entry.selectedTargetLocationId === "tea-house" ||
      entry.expectedTargetLocationId === "tea-house")
  ) {
    return "follow-mara-lead-to-kettle-lamp";
  }

  if (/^(?:With Ada|Take Cup-and-counter shift)$/i.test(label)) {
    return "verify-ada-lead-and-accept-shift";
  }

  if (
    /\b(?:Cup-and-counter shift|lunch rush|counter)\b/i.test(label) &&
    entry.routeRole === "work"
  ) {
    return "work-cup-and-counter-shift";
  }

  if (
    /^(?:Exit to South Quay|Head to Morrow House|Return to Morrow House to take stock|On the way to Morrow House|Enter Morrow House|Take stock)$/i.test(
      label,
    ) &&
    !entry.firstAfternoonCompletionAcknowledgedAt &&
    (entry.selectedTargetLocationId === "boarding-house" ||
      entry.expectedTargetLocationId === "boarding-house")
  ) {
    return "return-to-morrow-house-and-take-stock";
  }

  return "other-objective-beat";
}

const OBJECTIVE_SEQUENCE_GROUP_LABELS = {
  "establish-room-and-mara-lead": "Ask Mara for the room terms and first lead",
  "follow-mara-lead-to-kettle-lamp": "Follow Mara's lead to Kettle & Lamp",
  "verify-ada-lead-and-accept-shift": "Verify Ada's lunch-work lead",
  "work-cup-and-counter-shift": "Work the cup-and-counter shift",
  "return-to-morrow-house-and-take-stock":
    "Return to Morrow House and take stock",
  "other-objective-beat": "Other objective beat",
};

function buildObjectiveSequenceRuns(objectiveSequenceAudit) {
  const runs = [];
  for (const entry of objectiveSequenceAudit) {
    const groupId = objectiveSequenceGroupIdForEntry(entry);
    const previousRun = runs.at(-1);
    const run =
      previousRun?.id === groupId
        ? previousRun
        : {
            id: groupId,
            label: OBJECTIVE_SEQUENCE_GROUP_LABELS[groupId] ?? groupId,
            auditIndexes: [],
            entries: 0,
            failureReasons: [],
            authorityKinds: [],
            intentFamilies: [],
            matchedOutcomeIds: [],
            pressureIds: [],
            pressureKinds: [],
            routeRoles: [],
            selectedActions: [],
            selectedTargets: [],
            validationResult: "passed",
            visibleControlClicks: 0,
            watchedAutoContinueBeats: 0,
          };

    if (run !== previousRun) {
      runs.push(run);
    }

    const auditIndex = objectiveSequenceAudit.indexOf(entry);
    run.auditIndexes.push(auditIndex);
    run.entries += 1;
    run.failureReasons.push(...(entry.failureReasons ?? []));
    run.authorityKinds = [
      ...new Set([
        ...run.authorityKinds,
        ...(entry.authorityEvidence?.authorityKinds ?? []),
      ]),
    ];
    if (entry.authorityEvidence?.selectedMatchedOutcomeId) {
      run.matchedOutcomeIds = [
        ...new Set([
          ...run.matchedOutcomeIds,
          entry.authorityEvidence.selectedMatchedOutcomeId,
        ]),
      ];
    }
    if (entry.authorityEvidence?.selectedPressureId) {
      run.pressureIds = [
        ...new Set([
          ...run.pressureIds,
          entry.authorityEvidence.selectedPressureId,
        ]),
      ];
    }
    if (entry.authorityEvidence?.selectedPressureKind) {
      run.pressureKinds = [
        ...new Set([
          ...run.pressureKinds,
          entry.authorityEvidence.selectedPressureKind,
        ]),
      ];
    }
    run.intentFamilies = [
      ...new Set([...run.intentFamilies, ...(entry.intentFamilies ?? [])]),
    ];
    run.routeRoles = [
      ...new Set([...run.routeRoles, entry.routeRole].filter(Boolean)),
    ];
    if (entry.selectedActionId) {
      run.selectedActions = [
        ...new Set([...run.selectedActions, entry.selectedActionId]),
      ];
    }
    if (entry.selectedTargetLocationId) {
      run.selectedTargets = [
        ...new Set([...run.selectedTargets, entry.selectedTargetLocationId]),
      ];
    }
    if (entry.kind === "visible-control-click") {
      run.visibleControlClicks += 1;
    }
    if (entry.kind === "watched-auto-continue") {
      run.watchedAutoContinueBeats += 1;
    }
    if (run.failureReasons.length > 0) {
      run.validationResult = "failed";
    }
  }

  return runs;
}

function assertObjectiveSequenceRuns(objectiveSequenceRuns) {
  assert.ok(
    Array.isArray(objectiveSequenceRuns),
    "Objective sequence runs must be recorded as an array.",
  );

  const runById = new Map(objectiveSequenceRuns.map((run) => [run.id, run]));
  for (const requiredRunId of [
    "establish-room-and-mara-lead",
    "follow-mara-lead-to-kettle-lamp",
    "verify-ada-lead-and-accept-shift",
    "work-cup-and-counter-shift",
    "return-to-morrow-house-and-take-stock",
  ]) {
    assert.ok(
      runById.has(requiredRunId),
      `Objective sequence runs did not include ${requiredRunId}.`,
    );
  }

  const failingRuns = objectiveSequenceRuns.filter(
    (run) => run.validationResult !== "passed",
  );
  assert.equal(
    failingRuns.length,
    0,
    `Objective sequence runs found failed grouped sequences: ${JSON.stringify(
      failingRuns,
      null,
      2,
    )}`,
  );

  const kettleRun = runById.get("follow-mara-lead-to-kettle-lamp");
  assert.ok(
    kettleRun?.selectedTargets.includes("tea-house"),
    "Kettle sequence must target Kettle & Lamp.",
  );
  assert.ok(
    kettleRun?.authorityKinds.includes("objective-predicate") &&
      kettleRun?.authorityKinds.includes("legal-action") &&
      kettleRun?.authorityKinds.some((kind) =>
        kind.startsWith("legal-action:"),
      ),
    "Kettle sequence must expose objective-predicate and concrete legal-action authority.",
  );
  for (const expectedRole of [
    "portal-exit",
    "route-move",
    "portal-enter",
    "conversation-start",
  ]) {
    assert.ok(
      kettleRun?.routeRoles.includes(expectedRole),
      `Kettle sequence did not carry ${expectedRole}.`,
    );
  }

  const workRun = runById.get("work-cup-and-counter-shift");
  assert.ok(
    workRun?.authorityKinds.includes("live-pressure:commitment") &&
      workRun?.authorityKinds.includes("autonomy-action"),
    "Cafe work sequence must expose live commitment and autonomy-action authority.",
  );

  const returnRun = runById.get("return-to-morrow-house-and-take-stock");
  assert.ok(
    returnRun?.selectedTargets.includes("boarding-house"),
    "Return-home sequence must target Morrow House.",
  );
  assert.ok(
    returnRun?.authorityKinds.includes("legal-action") &&
      returnRun?.authorityKinds.some((kind) =>
        kind.startsWith("legal-action:"),
      ) &&
      (returnRun?.authorityKinds.includes("objective-predicate") ||
        returnRun?.authorityKinds.some((kind) =>
          kind.startsWith("live-pressure:"),
        )),
    "Return-home sequence must expose concrete legal-action plus predicate or live-pressure authority.",
  );
  assert.ok(
    returnRun?.routeRoles.includes("framed-reflection"),
    "Return-home sequence must end with framed take-stock reflection.",
  );
}

const EARLY_AGENCY_SEQUENCE_RUN_IDS = [
  "establish-room-and-mara-lead",
  "follow-mara-lead-to-kettle-lamp",
  "verify-ada-lead-and-accept-shift",
];

function compactEarlyAgencyDecisionEntry(entry, index) {
  const evidence = entry.authorityEvidence ?? {};

  return {
    authorityKinds: evidence.authorityKinds ?? [],
    clock: entry.clock ?? null,
    currentLocationId: entry.currentLocationId ?? null,
    index,
    milestone: entry.milestone,
    objectiveRouteKey: entry.objectiveRouteKey ?? null,
    objectiveText: compactObjectiveSequenceText(entry.objectiveText ?? "", 180),
    rejectedStaleOptionCount: evidence.rejectedStaleOptionCount ?? 0,
    rejectedStaleOptions: evidence.rejectedStaleOptions ?? [],
    routeRole: entry.routeRole ?? null,
    selectedActionId: entry.selectedActionId ?? null,
    selectedLegalBacking: evidence.selectedLegalBacking ?? null,
    selectedMatchedOutcomeId: evidence.selectedMatchedOutcomeId ?? null,
    selectedPressureId: evidence.selectedPressureId ?? null,
    selectedPressureKind: evidence.selectedPressureKind ?? null,
    selectedPressureLabel: evidence.selectedPressureLabel ?? null,
    selectedProvenance: evidence.selectedProvenance ?? null,
    selectedRecommendation: evidence.selectedRecommendation ?? null,
    selectedStep: evidence.selectedStep ?? null,
    selectedTargetLocationId: entry.selectedTargetLocationId ?? null,
    sequenceRunId: objectiveSequenceGroupIdForEntry(entry),
    travelPhase: entry.travelPhase ?? null,
    visibleDecisionArtifact: entry.visibleDecisionArtifact ?? null,
  };
}

function buildEarlyAgencyAuthorityLedger({
  moments,
  objectiveSequenceAudit,
  objectiveSequenceRuns,
}) {
  const runById = new Map(objectiveSequenceRuns.map((run) => [run.id, run]));
  const earlyEntries = objectiveSequenceAudit
    .map((entry, index) => ({
      entry,
      index,
      sequenceRunId: objectiveSequenceGroupIdForEntry(entry),
    }))
    .filter(({ sequenceRunId }) =>
      EARLY_AGENCY_SEQUENCE_RUN_IDS.includes(sequenceRunId),
    );
  const decisionEntries = earlyEntries
    .filter(({ entry }) => objectiveSequenceEntryNeedsPlannerAuthority(entry))
    .map(({ entry, index }) => compactEarlyAgencyDecisionEntry(entry, index));
  const selectedRouteScaffoldEntries = decisionEntries.filter((entry) =>
    SCAFFOLD_ONLY_TRACE_PROVENANCES.has(entry.selectedProvenance ?? ""),
  );
  const missingLegalBackingEntries = decisionEntries.filter(
    (entry) =>
      !entry.selectedLegalBacking?.source &&
      !entry.authorityKinds.includes("autonomy-action"),
  );
  const missingRecommendationEntries = decisionEntries.filter(
    (entry) =>
      !entry.selectedRecommendation?.sourceKind &&
      !entry.authorityKinds.includes("autonomy-action"),
  );
  const unvalidatedRecommendationEntries = decisionEntries.filter(
    (entry) =>
      entry.selectedRecommendation &&
      (entry.selectedRecommendation.validationStatus === "unvalidated" ||
        !entry.selectedRecommendation.validationSource ||
        !entry.selectedRecommendation.legalBackingSource),
  );
  const missingVisibleArtifactEntries = decisionEntries.filter(
    (entry) =>
      !entry.visibleDecisionArtifact &&
      !entry.authorityKinds.includes("autonomy-action"),
  );
  const earlyMomentLabels = new Set([
    "first-actionable-screen",
    "entered-morrow-house",
    "mara-conversation",
    "mara-lead-landed",
    "arrived-kettle-lamp",
    "ada-conversation",
    "shift-in-motion",
  ]);
  const earlyMomentArtifacts = moments
    .filter(
      (moment) =>
        earlyMomentLabels.has(moment.label) && moment.visibleDecisionArtifact,
    )
    .map((moment) => ({
      clock: moment.clock ?? null,
      label: moment.label,
      selected: selectedPlanningEvidence(moment),
      visibleDecisionArtifact: compactVisibleDecisionArtifact(
        moment.visibleDecisionArtifact,
      ),
    }));

  return {
    assertionSemantics:
      "Early South Quay autonomous decisions are selected from simulator-visible legal actions or objective predicates, with route hints only allowed as scaffold/rejected evidence.",
    decisionEntries,
    missingLegalBackingEntries,
    missingRecommendationEntries,
    missingVisibleArtifactEntries,
    runSummaries: EARLY_AGENCY_SEQUENCE_RUN_IDS.map((id) => {
      const run = runById.get(id);
      return {
        authorityKinds: run?.authorityKinds ?? [],
        entries: run?.entries ?? 0,
        id,
        label: run?.label ?? OBJECTIVE_SEQUENCE_GROUP_LABELS[id] ?? id,
        matchedOutcomeIds: run?.matchedOutcomeIds ?? [],
        pressureKinds: run?.pressureKinds ?? [],
        routeRoles: run?.routeRoles ?? [],
        selectedActions: run?.selectedActions ?? [],
        selectedTargets: run?.selectedTargets ?? [],
        validationResult: run?.validationResult ?? "missing",
        visibleControlClicks: run?.visibleControlClicks ?? 0,
        watchedAutoContinueBeats: run?.watchedAutoContinueBeats ?? 0,
      };
    }),
    selectedRouteScaffoldEntries,
    status: "passed",
    unvalidatedRecommendationEntries,
    visibleDecisionArtifactSamples: earlyMomentArtifacts.slice(0, 4),
    visibleDecisionArtifactSampleCount: earlyMomentArtifacts.length,
  };
}

function assertEarlyAgencyAuthorityLedger(ledger) {
  assert.ok(
    ledger,
    "Early agency authority ledger must be recorded in the inhabit gameplay report.",
  );

  const missingRuns = ledger.runSummaries.filter(
    (run) => run.validationResult === "missing",
  );
  assert.equal(
    missingRuns.length,
    0,
    `Early agency ledger is missing required run summaries: ${JSON.stringify(
      missingRuns,
      null,
      2,
    )}`,
  );

  const failingRuns = ledger.runSummaries.filter(
    (run) => run.validationResult !== "passed",
  );
  assert.equal(
    failingRuns.length,
    0,
    `Early agency ledger found failing run summaries: ${JSON.stringify(
      failingRuns,
      null,
      2,
    )}`,
  );

  assert.ok(
    ledger.decisionEntries.length >= 3,
    `Early agency ledger captured too few meaningful decision beats: ${ledger.decisionEntries.length}.`,
  );
  assert.equal(
    ledger.selectedRouteScaffoldEntries.length,
    0,
    `Early agency selected route-scaffold/stale-predicate/stale-trail authority: ${JSON.stringify(
      ledger.selectedRouteScaffoldEntries,
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.missingLegalBackingEntries.length,
    0,
    `Early agency decisions are missing concrete legal backing: ${JSON.stringify(
      ledger.missingLegalBackingEntries,
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.missingRecommendationEntries.length,
    0,
    `Early agency decisions are missing planner source/advisory provenance: ${JSON.stringify(
      ledger.missingRecommendationEntries,
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.unvalidatedRecommendationEntries.length,
    0,
    `Early agency decisions expose unvalidated planner recommendations: ${JSON.stringify(
      ledger.unvalidatedRecommendationEntries,
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.missingVisibleArtifactEntries.length,
    0,
    `Early agency decisions are missing visible decision artifacts: ${JSON.stringify(
      ledger.missingVisibleArtifactEntries,
      null,
      2,
    )}`,
  );

  const authorityKinds = new Set(
    ledger.decisionEntries.flatMap((entry) => entry.authorityKinds ?? []),
  );
  for (const requiredAuthority of ["objective-predicate", "legal-action"]) {
    assert.ok(
      authorityKinds.has(requiredAuthority),
      `Early agency ledger did not expose ${requiredAuthority} authority.`,
    );
  }
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("legal-action:")),
    "Early agency ledger did not expose a concrete legal-action backing source.",
  );
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("planner-source:")),
    "Early agency ledger did not expose planner source-kind provenance.",
  );
  assert.ok(
    [...authorityKinds].some((kind) => kind.startsWith("planner-validation:")),
    "Early agency ledger did not expose planner validation status.",
  );
  assert.ok(
    ledger.visibleDecisionArtifactSampleCount >= 2,
    `Early agency ledger captured too few visible decision artifact samples: ${ledger.visibleDecisionArtifactSampleCount}.`,
  );
  assert.ok(
    ledger.visibleDecisionArtifactSamples.some(
      (sample) => sample.visibleDecisionArtifact?.nextCheck,
    ),
    "Early agency ledger did not capture a visible next uncertainty/check.",
  );
}

function buildTrajectoryNeutralAgencyLedger({ moments, objectiveSequenceAudit }) {
  const meaningfulActions = objectiveSequenceAudit.filter((entry) =>
    objectiveSequenceEntryNeedsPlannerAuthority(entry),
  );
  const incompleteProvenanceEntries = meaningfulActions.filter((entry) => {
    const evidence = entry.authorityEvidence ?? {};
    const recommendation = evidence.selectedRecommendation;
    return !(
      entry.selectedActionId &&
      evidence.selectedLegalBacking?.source &&
      recommendation?.sourceKind &&
      recommendation.validationStatus !== "unvalidated" &&
      recommendation.validationSource &&
      recommendation.legalBackingSource &&
      entry.visibleDecisionArtifact
    );
  });
  const interaction = moments.find((moment) => moment.label === "first-interaction");
  const approaches = moments.find((moment) => moment.label === "approaches-known");
  const consequence = moments.find((moment) => moment.label === "durable-consequence");
  const completion = moments.find((moment) => moment.label === "first-afternoon-complete");

  return {
    approachesKnownAt: approaches?.firstAfternoon?.approachesKnownAt ?? null,
    completion: completion?.firstAfternoon?.completedAt ?? null,
    consequence:
      consequence?.firstAfternoon?.consequence ??
      consequence?.objective?.outcomes?.find(
        (outcome) =>
          outcome.id === "first-afternoon-consequence" &&
          outcome.status === "met",
      ) ??
      null,
    incompleteProvenanceEntries,
    interactionNpcId: interaction?.activeConversation ?? null,
    meaningfulActionCount: meaningfulActions.length,
    sourceKinds: [
      ...new Set(
        meaningfulActions
          .map(
            (entry) =>
              entry.authorityEvidence?.selectedRecommendation?.sourceKind,
          )
          .filter(Boolean),
      ),
    ],
    status: "passed",
  };
}

function assertTrajectoryNeutralAgencyLedger(ledger) {
  assert.ok(ledger.interactionNpcId, "First afternoon did not include an interaction.");
  assert.ok(ledger.approachesKnownAt, "First afternoon never grounded two live approaches.");
  assert.ok(ledger.consequence, "First afternoon did not produce a durable consequence.");
  assert.ok(ledger.completion, "First afternoon did not reach a natural completion.");
  assert.ok(
    ledger.meaningfulActionCount > 0,
    "First afternoon did not expose any meaningful autonomous actions.",
  );
  assert.equal(
    ledger.incompleteProvenanceEntries.length,
    0,
    `Meaningful first-afternoon actions had incomplete or unvalidated provenance: ${JSON.stringify(ledger.incompleteProvenanceEntries, null, 2)}`,
  );
}

function compactWorldPressureSnapshot(worldPressure) {
  if (!worldPressure) {
    return null;
  }
  const directNpcPressureMoves = Object.prototype.hasOwnProperty.call(
    worldPressure,
    "npcPressureMoves",
  )
    ? (Array.isArray(worldPressure.npcPressureMoves)
        ? worldPressure.npcPressureMoves
        : [])
    : npcPressureMovesFromSchedules(worldPressure.npcSchedules ?? []);

  return {
    cityEvents: (worldPressure.cityEvents ?? []).map((event) => ({
      id: event.id,
      locationId: event.locationId,
      outcome: event.outcome ?? null,
      progress: event.progress ?? null,
      status: event.status,
      visibleLabel: event.visibleLabel ?? null,
    })),
    jobWindows: (worldPressure.jobWindows ?? []).map((job) => ({
      accepted: Boolean(job.accepted),
      completed: Boolean(job.completed),
      discovered: Boolean(job.discovered),
      id: job.id,
      inWindow: Boolean(job.inWindow),
      locationId: job.locationId,
      missed: Boolean(job.missed),
      title: job.title,
    })),
    npcPressureMoves: directNpcPressureMoves.map((npc) => ({
      currentConcern: compactObjectiveSequenceText(
        npc.currentConcern ?? "",
        120,
      ),
      currentLocationId: npc.currentLocationId,
      currentScheduleLocationId: npc.currentScheduleLocationId,
      id: npc.id,
      mood: npc.mood ?? null,
    })),
    npcSchedules: (worldPressure.npcSchedules ?? []).map((npc) => ({
      availability: npc.availability ?? null,
      currentConcern: compactObjectiveSequenceText(
        npc.currentConcern ?? "",
        120,
      ),
      currentLocationId: npc.currentLocationId,
      currentScheduleLocationId: npc.currentScheduleLocationId ?? null,
      id: npc.id,
      mood: npc.mood ?? null,
      nextScheduleLocationId: npc.nextScheduleLocationId ?? null,
    })),
    problems: (worldPressure.problems ?? []).map((problem) => ({
      discovered: Boolean(problem.discovered),
      escalationLevel: problem.escalationLevel ?? 0,
      id: problem.id,
      locationId: problem.locationId,
      resolvedByNpcId: problem.resolvedByNpcId ?? null,
      status: problem.status,
      title: problem.title,
      urgency: problem.urgency,
    })),
  };
}

function collectPressureTransitions(snapshots, collectionName, stateForEntry) {
  const statesById = new Map();

  for (const snapshot of snapshots) {
    for (const entry of snapshot?.[collectionName] ?? []) {
      const states = statesById.get(entry.id) ?? new Set();
      states.add(stateForEntry(entry));
      statesById.set(entry.id, states);
    }
  }

  return [...statesById.entries()]
    .map(([id, states]) => ({
      id,
      states: [...states].filter(Boolean),
    }))
    .filter((entry) => entry.states.length > 1);
}

function pressureEntriesById(snapshot, collectionName) {
  return new Map(
    (snapshot?.[collectionName] ?? []).map((entry) => [entry.id, entry]),
  );
}

function pressureValue(value) {
  if (value === undefined) {
    return null;
  }
  return value;
}

function addPressureTimelineChange(changes, context, change) {
  if (Object.is(change.from, change.to)) {
    return;
  }
  changes.push({
    ...change,
    fromClock: context.from.clock,
    fromLabel: context.from.label,
    meaningful: change.meaningful ?? true,
    toClock: context.to.clock,
    toLabel: context.to.label,
  });
}

function collectFieldChanges(changes, context, options) {
  const before = pressureEntriesById(
    context.from.worldPressure,
    options.collectionName,
  );
  const after = pressureEntriesById(
    context.to.worldPressure,
    options.collectionName,
  );
  const ids = new Set([...before.keys(), ...after.keys()]);

  for (const id of ids) {
    if (!before.has(id) || !after.has(id)) {
      continue;
    }
    const previous = before.get(id) ?? {};
    const next = after.get(id) ?? {};
    for (const field of options.fields) {
      const from = pressureValue(previous[field.name]);
      const to = pressureValue(next[field.name]);
      if (Object.is(from, to)) {
        continue;
      }
      addPressureTimelineChange(changes, context, {
        cause: field.cause(previous, next),
        field: field.name,
        from,
        id,
        kind: options.kind,
        summary: field.summary(id, from, to, previous, next),
        to,
      });
    }
  }
}

function buildWorldPressureTimeline(snapshots) {
  const changes = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const context = {
      from: snapshots[index - 1],
      to: snapshots[index],
    };

    collectFieldChanges(changes, context, {
      collectionName: "cityEvents",
      fields: ["status", "progress", "outcome"].map((name) => ({
        cause: () => "independent",
        name,
        summary: (id, from, to) =>
          `City event ${id} ${name} changed from ${from ?? "none"} to ${
            to ?? "none"
          }.`,
      })),
      kind: "city-event",
    });
    collectFieldChanges(changes, context, {
      collectionName: "jobWindows",
      fields: [
        {
          cause: () => "rowan-caused",
          name: "accepted",
          summary: (id, from, to) =>
            `Job ${id} accepted changed from ${from} to ${to}.`,
        },
        {
          cause: () => "rowan-caused",
          name: "completed",
          summary: (id, from, to) =>
            `Job ${id} completed changed from ${from} to ${to}.`,
        },
        {
          cause: () => "independent",
          name: "consequenceAppliedAt",
          summary: (id, from, to) =>
            `Job ${id} closure timestamp changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
        {
          cause: () => "rowan-caused",
          name: "discovered",
          summary: (id, from, to) =>
            `Job ${id} discovery changed from ${from} to ${to}.`,
        },
        {
          cause: () => "independent",
          name: "inWindow",
          summary: (id, from, to) =>
            `Job ${id} window changed from ${from ? "open" : "closed"} to ${
              to ? "open" : "closed"
            }.`,
        },
        {
          cause: () => "independent",
          name: "missed",
          summary: (id, from, to) =>
            `Job ${id} missed state changed from ${from} to ${to}.`,
        },
      ],
      kind: "job-window",
    });
    collectFieldChanges(changes, context, {
      collectionName: "npcSchedules",
      fields: [
        {
          cause: () => "independent",
          name: "currentScheduleLocationId",
          summary: (id, from, to) =>
            `NPC ${id} schedule target changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
        {
          cause: () => "independent",
          name: "currentLocationId",
          summary: (id, from, to) =>
            `NPC ${id} current stop changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
        {
          cause: () => "independent",
          name: "nextScheduleLocationId",
          summary: (id, from, to) =>
            `NPC ${id} next scheduled stop changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
      ],
      kind: "npc-schedule",
    });
    collectFieldChanges(changes, context, {
      collectionName: "problems",
      fields: [
        {
          cause: () => "rowan-caused",
          name: "discovered",
          summary: (id, from, to) =>
            `Problem ${id} discovery changed from ${from} to ${to}.`,
        },
        {
          cause: () => "independent",
          name: "escalationLevel",
          summary: (id, from, to) =>
            `Problem ${id} escalation changed from ${from} to ${to}.`,
        },
        {
          cause: () => "independent",
          name: "resolvedByNpcId",
          summary: (id, from, to) =>
            `Problem ${id} NPC resolver changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
        {
          cause: (previous, next) =>
            next.resolvedByNpcId ? "independent" : "mixed",
          name: "status",
          summary: (id, from, to) =>
            `Problem ${id} status changed from ${from ?? "none"} to ${
              to ?? "none"
            }.`,
        },
        {
          cause: () => "independent",
          name: "urgency",
          summary: (id, from, to) =>
            `Problem ${id} urgency changed from ${from} to ${to}.`,
        },
      ],
      kind: "problem",
    });
  }
  return changes;
}

function buildWorldPressureAudit({ moments, objectiveSequenceAudit }) {
  const snapshots = moments
    .map((moment) => ({
      clock: moment.clock ?? null,
      label: moment.label,
      worldPressure: moment.worldPressure ?? null,
    }))
    .filter((snapshot) => snapshot.worldPressure);
  const pressureSnapshots = snapshots.map((snapshot) => snapshot.worldPressure);
  const worldPressureTimeline = buildWorldPressureTimeline(snapshots);
  const independentTimelineChanges = worldPressureTimeline.filter(
    (change) => change.cause === "independent" && change.meaningful,
  );
  const independentPressureKeys = [
    ...new Set(
      independentTimelineChanges.map((change) => `${change.kind}:${change.id}`),
    ),
  ];
  const cityEventTransitions = collectPressureTransitions(
    pressureSnapshots,
    "cityEvents",
    (event) =>
      [event.status, event.progress, event.outcome].filter(Boolean).join(":"),
  );
  const jobWindowTransitions = collectPressureTransitions(
    pressureSnapshots,
    "jobWindows",
    (job) =>
      [
        job.discovered ? "discovered" : "hidden",
        job.inWindow ? "in-window" : "outside-window",
        job.accepted ? "accepted" : "unaccepted",
        job.completed ? "completed" : "incomplete",
        job.missed ? "missed" : "available",
      ].join(":"),
  );
  const problemTransitions = collectPressureTransitions(
    pressureSnapshots,
    "problems",
    (problem) =>
      [
        problem.status,
        `level-${problem.escalationLevel ?? 0}`,
        `urgency-${problem.urgency ?? 0}`,
        problem.discovered ? "discovered" : "hidden",
      ].join(":"),
  );
  const liveAuthorityKinds = [
    ...new Set(
      objectiveSequenceAudit
        .flatMap((entry) => entry.authorityEvidence?.authorityKinds ?? [])
        .filter((kind) => /^live-pressure:/.test(kind)),
    ),
  ];
  const selectedPressureKinds = [
    ...new Set(
      objectiveSequenceAudit
        .map((entry) => entry.authorityEvidence?.selectedPressureKind)
        .filter(Boolean),
    ),
  ];
  const pressureBackedEntries = objectiveSequenceAudit
    .filter((entry) => entry.authorityEvidence?.selectedPressureKind)
    .map((entry) => ({
      authorityKinds: entry.authorityEvidence?.authorityKinds ?? [],
      clock: entry.clock ?? null,
      label: entry.autonomyLabel ?? entry.controlText ?? null,
      pressureId: entry.authorityEvidence?.selectedPressureId ?? null,
      pressureKind: entry.authorityEvidence?.selectedPressureKind ?? null,
      selectedActionId: entry.selectedActionId ?? null,
      targetLocationId: entry.selectedTargetLocationId ?? null,
    }));

  return {
    cityEventTransitions,
    independentPressureChangeCount: independentTimelineChanges.length,
    independentPressureKeys,
    jobWindowTransitions,
    liveAuthorityKinds,
    npcPressureMoveCount: pressureSnapshots.reduce(
      (count, snapshot) => count + (snapshot.npcPressureMoves?.length ?? 0),
      0,
    ),
    pressureBackedEntries,
    problemTransitions,
    selectedPressureKinds,
    snapshotCount: snapshots.length,
    snapshots,
    worldPressureTimeline,
  };
}

function assertWorldPressureAudit(worldPressureAudit) {
  assert.ok(
    worldPressureAudit,
    "World pressure audit must be recorded in the inhabit gameplay report.",
  );
  assert.ok(
    worldPressureAudit.snapshotCount >= 4,
    `World pressure audit did not capture enough player-POV snapshots: ${worldPressureAudit.snapshotCount}.`,
  );
  assert.ok(
    worldPressureAudit.cityEventTransitions.length > 0 ||
      worldPressureAudit.jobWindowTransitions.length > 0 ||
      worldPressureAudit.problemTransitions.length > 0 ||
      worldPressureAudit.npcPressureMoveCount > 0,
    `World pressure audit did not observe any pressure mutation across the player-POV run: ${JSON.stringify(
      worldPressureAudit,
      null,
      2,
    )}`,
  );
  assert.ok(
    worldPressureAudit.worldPressureTimeline.length > 0,
    "World pressure audit must include a timeline of pressure changes across observe moments.",
  );
  assert.ok(
    worldPressureAudit.independentPressureChangeCount >= 2 &&
      worldPressureAudit.independentPressureKeys.length >= 2,
    `World pressure audit must observe at least two independent/passive pressure changes during zero-click observe. Observed: ${JSON.stringify(
      {
        independentPressureChangeCount:
          worldPressureAudit.independentPressureChangeCount,
        independentPressureKeys: worldPressureAudit.independentPressureKeys,
        worldPressureTimeline: worldPressureAudit.worldPressureTimeline,
      },
      null,
      2,
    )}`,
  );
  assert.ok(
    worldPressureAudit.liveAuthorityKinds.length > 0,
    "World pressure audit did not observe any live-pressure-backed objective sequence.",
  );
  assert.ok(
    worldPressureAudit.pressureBackedEntries.some(
      (entry) =>
        entry.pressureKind &&
        (entry.selectedActionId ||
          entry.authorityKinds.includes("autonomy-action")),
    ),
    "World pressure audit must connect live pressure to a selected action or autonomy action.",
  );
}

function buildIndependentNpcActionEvidence(moments, worldPressureAudit = null) {
  const actionsByKey = new Map();
  const surfacedByKey = new Map();
  for (const moment of moments ?? []) {
    for (const action of moment.independentNpcActions ?? []) {
      const key = independentNpcActionKey(action);
      if (actionsByKey.has(key)) {
        continue;
      }
      actionsByKey.set(key, {
        ...action,
        observedDelayMinutes: minutesBetweenIso(
          independentNpcActionOccurredAt(action),
          moment.clock?.iso,
        ),
        firstObservedClock: moment.clock ?? null,
        firstObservedLabel: moment.label ?? null,
        firstObservedScreenshot: moment.screenshot ?? null,
      });
    }

    const surfaced = moment.independentNpcSurface;
    if (!surfaced) {
      continue;
    }

    const key = independentNpcActionKey(surfaced);
    if (surfacedByKey.has(key)) {
      continue;
    }
    const firstObservedAction = actionsByKey.get(key);
    surfacedByKey.set(key, {
      ...surfaced,
      surfaceDelayMinutes: minutesBetweenIso(
        independentNpcActionOccurredAt(surfaced),
        moment.clock?.iso,
      ),
      surfacedAtFirstObservedMoment: Boolean(
        firstObservedAction &&
          firstObservedAction.firstObservedLabel === moment.label &&
          firstObservedAction.firstObservedClock?.iso === moment.clock?.iso
      ),
      firstSurfacedClock: moment.clock ?? null,
      firstSurfacedLabel: moment.label ?? null,
      firstSurfacedScreenshot: moment.screenshot ?? null,
    });
  }

  const resolverTimelineChanges = (
    worldPressureAudit?.worldPressureTimeline ?? []
  ).filter((change) => {
    if (
      change.kind === "problem" &&
      change.cause === "independent" &&
      ["resolvedByNpcId", "status"].includes(change.field) &&
      (change.field !== "status" || change.to === "resolved")
    ) {
      return true;
    }

    return (
      change.kind === "job-window" &&
      change.cause === "independent" &&
      ((change.field === "missed" && change.to === true) ||
        (change.field === "consequenceAppliedAt" && Boolean(change.to)))
    );
  });

  return {
    actions: [...actionsByKey.values()],
    observedActionCount: actionsByKey.size,
    resolverTimelineChanges,
    surfacedActionCount: surfacedByKey.size,
    surfacedActions: [...surfacedByKey.values()],
  };
}

function minutesBetweenIso(fromIso, toIso) {
  const fromTime = fromIso ? Date.parse(fromIso) : NaN;
  const toTime = toIso ? Date.parse(toIso) : NaN;
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return null;
  }

  return Math.round((toTime - fromTime) / 60_000);
}

function independentNpcSurfaceIsTimely(action) {
  return Boolean(
    isIndependentLocalAction(action) &&
      action.surfaceDelayMinutes !== null &&
      action.surfaceDelayMinutes >= 0 &&
      (action.surfaceDelayMinutes <=
        INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES ||
        action.surfacedAtFirstObservedMoment === true),
  );
}

function assertIndependentNpcActionEvidence(evidence) {
  assert.ok(
    evidence,
    "Independent NPC action evidence must be recorded in the browser report.",
  );
  assert.ok(
    evidence.observedActionCount > 0,
    `Browser report must capture at least one independent local action. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.actions.some(
      (action) =>
        isIndependentLocalAction(action) &&
        action.firstObservedLabel &&
        independentNpcActionTextIsPlayerFacing(action.playerFacingSummary),
    ),
    `Independent local action evidence must connect subject, actor, before/after state, time, report moment, and player-facing summary. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActionCount > 0,
    `Browser report must capture at least one rail-visible independent local city beat. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActions.some(
      (action) =>
        action.slot === "just_happened" &&
        isIndependentLocalAction(action) &&
        action.title &&
        action.detail &&
        action.firstSurfacedLabel &&
        action.firstSurfacedScreenshot &&
        independentNpcActionTextIsPlayerFacing(
          independentNpcActionVisibleText(action),
        ),
    ),
    `Independent local rail beats must stay player-facing and screenshot-backed in the browser report. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActions.some(independentNpcSurfaceIsTimely),
    `Independent local rail beats must surface within ${INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES} sim minutes of their action timestamp or at the first observable moment after a sim-time jump. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
}

function assertIndependentResolutionDecisionArtifact(moments) {
  const surfacedProblemMoments = (moments ?? []).filter(
    (entry) =>
      entry.independentNpcSurface &&
      isProblemResolutionAction(entry.independentNpcSurface),
  );

  if (surfacedProblemMoments.length === 0) {
    const jobMoment = (moments ?? []).find(
      (entry) =>
        entry.independentNpcSurface &&
        isJobClosureAction(entry.independentNpcSurface),
    );
    assert.ok(
      jobMoment,
      "Independent local action moment must include either a problem resolution or job/opportunity closure.",
    );
    assert.ok(
      independentNpcActionTextIsPlayerFacing(
        independentNpcActionVisibleText(jobMoment.independentNpcSurface),
      ),
      "Independent local action surface leaked backend-shaped fields.",
    );
    return;
  }

  const moment = (moments ?? []).find(
    (entry) =>
      entry.independentNpcSurface &&
      entry.visibleDecisionArtifact &&
      isProblemResolutionAction(entry.independentNpcSurface),
  );
  assert.ok(
    moment,
    "Independent NPC resolution moment must include Rowan's adjacent visible decision artifact.",
  );

  const surface = moment.independentNpcSurface;
  const artifactText = [
    moment.visibleDecisionArtifact.objective,
    ...(moment.visibleDecisionArtifact.constraints ?? []),
    ...(moment.visibleDecisionArtifact.considered ?? []),
    moment.visibleDecisionArtifact.selectedAction,
    moment.visibleDecisionArtifact.rationale,
    moment.visibleDecisionArtifact.nextCheck,
  ]
    .filter(Boolean)
    .join(" ");

  assert.match(
    artifactText,
    new RegExp(
      `${escapeRegExp(surface.resolverName)}.*(?:contained|cleared|resolved)|(?:contained|cleared|resolved).*${escapeRegExp(
        surface.problemTitle.replace(/^Leaking /i, ""),
      )}`,
      "i",
    ),
    `Rowan's decision artifact after the independent resolution must account for the removed pressure. Artifact: ${JSON.stringify(
      moment.visibleDecisionArtifact,
      null,
      2,
    )}`,
  );
  assert.doesNotMatch(
    artifactText,
    /\bjob-yard-shift|resolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId|jobId|actorNpcId|subjectId|actionKind\b/i,
    "Independent resolution decision artifact leaked backend-shaped fields.",
  );
}

const REQUIRED_CITY_EVENT_VISUAL_CUES = [
  {
    cue: "warm cafe prep",
    requiredBackingId: "event-cafe-prep",
  },
  {
    cue: "square crossing bustle",
    requiredBackingId: "event-market-crossing",
  },
];

function cityEventBackingMatchesPressure(backing, pressureEvent) {
  return Boolean(
    pressureEvent &&
    pressureEvent.locationId === backing.locationId &&
    pressureEvent.status === backing.status &&
    (pressureEvent.progress ?? null) === (backing.progress ?? null) &&
    (pressureEvent.outcome ?? null) === (backing.outcome ?? null),
  );
}

function buildCityEventVisualEvidence(moments) {
  const samples = [];
  const missingBacking = [];

  for (const moment of moments) {
    const cityEventsById = new Map(
      (moment.worldPressure?.cityEvents ?? []).map((event) => [
        event.id,
        event,
      ]),
    );

    for (const cue of moment.visualEventCues ?? []) {
      const backingEvents = cue.backingEvents ?? [];
      const matchedPressureEventIds = backingEvents
        .filter((backing) =>
          cityEventBackingMatchesPressure(
            backing,
            cityEventsById.get(backing.id),
          ),
        )
        .map((backing) => backing.id);
      const backed =
        backingEvents.length > 0 &&
        matchedPressureEventIds.length === backingEvents.length;
      const playerFacingText = [
        cue.cue,
        cue.locationName,
        cue.signal,
        cue.visibleLabel,
      ].join(" ");
      const playerFacing =
        !/\b(cityEvents|worldPressure|routeKey|advance_objective)\b/i.test(
          playerFacingText,
        );
      const sample = {
        backed,
        backingEvents,
        clock: moment.clock?.label ?? null,
        cue: cue.cue,
        label: moment.label,
        locationId: cue.locationId,
        locationName: cue.locationName,
        matchedPressureEventIds,
        playerFacing,
        signal: cue.signal,
        visibleLabel: cue.visibleLabel ?? null,
      };
      samples.push(sample);
      if (!backed || !playerFacing) {
        missingBacking.push(sample);
      }
    }
  }

  const requiredCues = REQUIRED_CITY_EVENT_VISUAL_CUES.map((requirement) => {
    const matches = samples.filter((sample) => sample.cue === requirement.cue);
    const backedMatches = matches.filter(
      (sample) =>
        sample.backed &&
        sample.backingEvents.some(
          (event) => event.id === requirement.requiredBackingId,
        ),
    );
    return {
      cue: requirement.cue,
      requiredBackingId: requirement.requiredBackingId,
      sampleCount: matches.length,
      backedSampleCount: backedMatches.length,
      labels: backedMatches.map((sample) => sample.label),
    };
  });

  return {
    backedCueCount: samples.filter((sample) => sample.backed).length,
    missingBacking,
    requiredCues,
    sampleCount: samples.length,
    samples: samples.slice(0, 16),
    status:
      missingBacking.length === 0 &&
      requiredCues.every((cue) => cue.backedSampleCount > 0)
        ? "passed"
        : "failed",
  };
}

function assertCityEventVisualEvidence(evidence) {
  assert.ok(
    evidence,
    "City event visual evidence must be recorded in the inhabit gameplay report.",
  );
  assert.ok(
    evidence.sampleCount >= 2,
    `Expected at least two player-facing city event visual cue samples: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.equal(
    evidence.missingBacking.length,
    0,
    `Every city event visual cue must be backed by current world pressure and player-facing text: ${JSON.stringify(
      evidence.missingBacking,
      null,
      2,
    )}`,
  );
  assert.equal(
    evidence.status,
    "passed",
    `City event visual evidence did not pass required cue backing: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
}

function rectIsInside(inner, outer, tolerance = 2) {
  if (!inner || !outer) {
    return true;
  }

  return (
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance
  );
}

function assertRailReadability(label, game, probe, dom) {
  const commandRail = dom.layout?.commandRail;
  const railSummary = dom.layout?.railSummary;
  const collapsed = railSummary?.state === "collapsed";

  if (collapsed) {
    assertCollapsedRailSummaryReadability(label, game, railSummary);
    assert.ok(
      (commandRail?.rect?.height ?? 0) <= 2,
      `${label}: collapsed compact rail exposed the full command body instead of preserving map primacy (${JSON.stringify(
        commandRail,
      )}).`,
    );
  }

  if (!collapsed && commandRail && !game.activeConversation) {
    assert.ok(
      commandRail.rect?.height >= 120,
      `${label}: expanded Rowan command rail collapsed below a readable height (${JSON.stringify(
        commandRail,
      )}).`,
    );
    assert.notEqual(
      commandRail.anchorVisible,
      false,
      `${label}: active Rowan rail card is clipped or scrolled out of view (${JSON.stringify(
        {
          commandRail,
          directive: dom.layout?.rowanDirective,
        },
      )}).`,
    );
  }

  if (!collapsed && !game.activeConversation) {
    assert.notEqual(
      probe.railVisibility?.commandRailAnchorVisible,
      false,
      `${label}: browser probe reports active Rowan rail card is not fully visible.`,
    );
  }

  if (collapsed || !game.activeConversation) {
    return;
  }

  assert.ok(
    rectIsInside(dom.layout?.latestChatBubble, commandRail?.rect, 3),
    `${label}: latest conversation bubble is clipped outside the command rail (${JSON.stringify(
      {
        bubble: dom.layout?.latestChatBubble,
        commandRail: commandRail?.rect,
      },
    )}).`,
  );
  if (dom.layout?.latestChatExchange?.fitsCommandRail) {
    assert.ok(
      rectIsInside(dom.layout.latestChatExchange.rect, commandRail?.rect, 3),
      `${label}: latest conversation exchange is clipped outside the command rail (${JSON.stringify(
        {
          commandRail: commandRail?.rect,
          exchange: dom.layout.latestChatExchange,
        },
      )}).`,
    );
  }
}

function assertCollapsedRailSummaryReadability(label, game, summary) {
  assert.notEqual(
    summary.viewport,
    "desktop",
    `${label}: desktop rail must not use the collapsed summary contract.`,
  );
  assert.ok(summary.rect, `${label}: collapsed Rowan summary has no rail rectangle.`);

  for (const [key, element] of Object.entries({
    name: summary.name,
    peek: summary.peek,
    status: summary.status,
    thought: summary.thought,
    toggle: summary.toggle,
  })) {
    assert.ok(
      element?.visible && element.rect && element.text,
      `${label}: collapsed Rowan ${key} is missing or not visibly readable (${JSON.stringify(
        element,
      )}).`,
    );
    assert.ok(
      rectIsInside(element.rect, summary.rect, 2),
      `${label}: collapsed Rowan ${key} is clipped outside the summary rail (${JSON.stringify(
        { element, rail: summary.rect },
      )}).`,
    );
    assert.deepEqual(
      element.clippedBy,
      [],
      `${label}: collapsed Rowan ${key} is clipped by an overflow ancestor (${JSON.stringify(
        element.clippedBy,
      )}).`,
    );
  }

  assert.equal(
    summary.name.text,
    game.player.name,
    `${label}: collapsed rail does not identify the active player.`,
  );
  assert.doesNotMatch(
    summary.status.text,
    /\b(?:null|undefined)\b/i,
    `${label}: collapsed rail status leaked an unresolved value.`,
  );
  assert.ok(
    summary.peek.text.length >= 8,
    `${label}: collapsed Rowan context is too short to identify the active beat.`,
  );
  assert.ok(
    summary.thought.text.length >= 8,
    `${label}: collapsed Rowan thought is too short to communicate the active beat.`,
  );
  assert.equal(
    normalizeVisibleActionText(summary.toggle.text),
    "open",
    `${label}: collapsed rail toggle must visibly offer OPEN.`,
  );
  assert.equal(
    summary.toggle.ariaExpanded,
    "false",
    `${label}: collapsed rail toggle must expose aria-expanded=false.`,
  );
}

function assertRailReadabilityStateRegression() {
  const rect = (top, bottom, left = 565, right = 943) => ({
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  });
  const element = (text, top, bottom, extra = {}) => ({
    ariaExpanded: null,
    clippedBy: [],
    rect: rect(top, bottom, 579, 929),
    text,
    visible: true,
    ...extra,
  });
  const summary = {
    name: element("Rowan", 530, 554),
    peek: element("First morning in South Quay", 580, 596),
    rect: rect(510, 666),
    state: "collapsed",
    status: element("Watching Rowan", 558, 578),
    thought: element("Rowan is stepping inside Morrow House to ask Mara.", 600, 632),
    toggle: element("Open", 528, 566, { ariaExpanded: "false" }),
    viewport: "compact",
  };
  const game = { activeConversation: null, player: { name: "Rowan" } };
  const probe = {
    rail: { status: "Watching Rowan" },
    railVisibility: { commandRailAnchorVisible: false },
  };
  const collapsedDom = {
    layout: {
      commandRail: { anchorVisible: false, rect: rect(665, 666), scrollTop: 5 },
      railSummary: summary,
      rowanDirective: rect(675, 1041, 579, 929),
    },
  };

  assert.doesNotThrow(
    () => assertRailReadability("collapsed-regression", game, probe, collapsedDom),
    "An intentional one-pixel collapsed command body must defer to its readable summary.",
  );
  assert.throws(
    () =>
      assertRailReadability("collapsed-clipped-regression", game, probe, {
        layout: {
          ...collapsedDom.layout,
          railSummary: {
            ...summary,
            thought: { ...summary.thought, clippedBy: [{ element: ".ml-rail-shell" }] },
          },
        },
      }),
    /thought is clipped/,
    "A clipped collapsed Rowan thought must fail readability.",
  );
  assert.throws(
    () =>
      assertRailReadability("expanded-regression", game, probe, {
        layout: {
          ...collapsedDom.layout,
          commandRail: { anchorVisible: true, rect: rect(665, 666), scrollTop: 0 },
          railSummary: { ...summary, state: "expanded" },
        },
      }),
    /collapsed below a readable height/,
    "A one-pixel expanded command rail must fail readability.",
  );
}

function assertPlayerRouteDiagnostics(label, probe) {
  const route = probe.movement?.playerRoute;
  assert.ok(route, `${label}: expected an active player route diagnostic.`);
  assert.equal(route.active, true, `${label}: expected route to be active.`);
  assert.equal(
    route.spaceId,
    probe.location?.spaceId ?? probe.movement?.activeSpaceId ?? null,
    `${label}: player route should belong to the active space.`,
  );
  assert.equal(
    route.legal,
    true,
    `${label}: expected route to be legal. ${JSON.stringify(route)}`,
  );
  assert.equal(
    route.reachesDestination,
    true,
    `${label}: expected route to reach its destination.`,
  );
  assert.equal(
    route.sampledPointsLegal,
    true,
    `${label}: expected route world points to stay on walkable map points.`,
  );
  assert.equal(
    route.visualObstaclesClear ?? route.diagnostics?.visualObstaclesClear,
    true,
    `${label}: expected route to avoid rendered visual obstacles.`,
  );
  assert.ok(
    route.tilePath.length >= 2,
    `${label}: expected at least a two-point tile path, got ${route.tilePath.length}.`,
  );
  assert.ok(
    route.worldPath.length >= 2,
    `${label}: expected at least a two-point world path, got ${route.worldPath.length}.`,
  );

  for (const point of route.worldPath) {
    assert.equal(
      Number.isFinite(point.x) && Number.isFinite(point.y),
      true,
      `${label}: route world path contains a non-finite point.`,
    );
  }
}

function assertRequiredNpcPatrolDiagnostics(label, probe) {
  const patrols = probe.movement?.npcPatrols ?? [];
  const patrolByLocationId = new Map(
    patrols.map((patrol) => [patrol.locationId, patrol]),
  );

  for (const locationId of REQUIRED_NPC_PATROL_LOCATION_IDS) {
    const patrol = patrolByLocationId.get(locationId);
    assert.ok(
      patrol,
      `${label}: missing NPC patrol diagnostics for ${locationId}.`,
    );
    assert.equal(
      patrol.routed,
      true,
      `${label}: expected ${locationId} patrol to be routed.`,
    );
    assert.ok(
      patrol.pathLength > 1,
      `${label}: expected ${locationId} patrol to have a non-empty path.`,
    );
    assert.equal(
      patrol.unreachableSegments,
      0,
      `${label}: expected ${locationId} patrol to avoid unreachable shortcuts.`,
    );
  }
}

function assertTimelineRoute(byLabel, label, routeName, options = {}) {
  const minPathPoints = options.minPathPoints ?? 3;
  const route = byLabel[label]?.movement?.playerRoute;
  assert.ok(route, `Expected route diagnostics for ${routeName}.`);
  assert.equal(route.legal, true, `${routeName}: route should be legal.`);
  assert.equal(
    route.reachesDestination,
    true,
    `${routeName}: route should reach destination.`,
  );
  assert.equal(
    route.sampledPointsLegal,
    true,
    `${routeName}: route points should remain on the walkable map graph.`,
  );
  assert.equal(
    route.visualObstaclesClear ?? route.diagnostics?.visualObstaclesClear,
    true,
    `${routeName}: route should avoid rendered visual obstacles.`,
  );
  assert.ok(
    route.tilePath.length >= minPathPoints,
    `${routeName}: expected at least ${minPathPoints} tile path points.`,
  );
  assert.ok(
    route.worldPath.length >= minPathPoints,
    `${routeName}: expected at least ${minPathPoints} world path points.`,
  );

  if (options.spaceId) {
    assert.equal(
      route.spaceId,
      options.spaceId,
      `${routeName}: route should stay in ${options.spaceId}.`,
    );
  }
}

function assertCleanSettledInteriorFrame(byLabel, label, spaceId) {
  const entry = byLabel[label];
  assert.ok(entry, `Expected settled interior timeline entry ${label}.`);
  assert.equal(
    entry.location?.spaceId,
    spaceId,
    `${label}: expected settled frame to be inside ${spaceId}.`,
  );
  assert.equal(
    entry.movement?.playerRoute?.active ?? false,
    false,
    `${label}: settled interior frame should not keep an active route diagnostic.`,
  );
  assert.equal(
    entry.mapAgency,
    null,
    `${label}: settled interior frame should not retain a floating route/agency cue.`,
  );
}

function assertCloseConversationLabelSuppressed(byLabel, label) {
  const entry = byLabel[label];
  assert.ok(entry, `Expected close conversation timeline entry ${label}.`);
  assert.equal(
    entry.mapAgency?.target?.isNpc,
    true,
    `${label}: expected the map agency target to be the conversation NPC.`,
  );
  assert.equal(
    entry.mapAgency?.labels?.closeInteractionSuppressed,
    true,
    `${label}: close interior conversation did not suppress the floating agency label.`,
  );
  assert.equal(
    entry.mapAgency?.labels?.intentVisible,
    false,
    `${label}: close interior conversation kept the floating intent label visible.`,
  );
}

function assertKettleTargetCueMapAgency(mapAgency, label) {
  assert.ok(mapAgency, `${label}: missing map-agency probe.`);
  assert.equal(
    mapAgency.currentLocation?.id,
    "boarding-house",
    `${label}: map-agency probe must expose the current simulated location.`,
  );
  assert.equal(
    mapAgency.target?.locationId,
    "tea-house",
    `${label}: map-agency probe must expose the Kettle & Lamp target location.`,
  );
  assert.ok(
    mapAgency.playerWorldPoint,
    `${label}: map-agency probe must expose Rowan's rendered world point.`,
  );
  assert.ok(
    mapAgency.target,
    `${label}: map-agency probe must expose the target world point.`,
  );
  assert.ok(
    mapAgency.cameraVisibleWorldRect,
    `${label}: map-agency probe must expose the camera visible world rect.`,
  );

  const labels = mapAgency.labels ?? {};
  if (
    mapAgency.playerWorldPoint.x <= MORROW_SIDE_WORLD_MAX_X &&
    labels.intentVisible
  ) {
    assert.ok(
      !/\bKettle\s*&?\s*Lamp\b/i.test(labels.intentText ?? ""),
      `${label}: Kettle intent text rendered over Rowan while Rowan was still on the Morrow side: ${JSON.stringify({
        intent: labels.intentText,
        intentPoint: labels.intentWorldPoint,
        player: mapAgency.playerWorldPoint,
        target: mapAgency.target,
      })}.`,
    );
  }

  if (labels.targetVisible) {
    assert.ok(
      labels.targetWorldPoint,
      `${label}: visible target label must expose its rendered world point.`,
    );
    assert.ok(
      pointDistance(labels.targetWorldPoint, mapAgency.target) <=
        MAP_AGENCY_TARGET_LABEL_MAX_OFFSET,
      `${label}: visible Kettle target label drifted away from its target point: ${JSON.stringify({
        label: labels.targetWorldPoint,
        target: mapAgency.target,
      })}.`,
    );
    if (mapAgency.playerWorldPoint.x <= MORROW_SIDE_WORLD_MAX_X) {
      assert.ok(
        labels.targetWorldPoint.x >= KETTLE_SIDE_WORLD_MIN_X,
        `${label}: NEXT: KETTLE & LAMP rendered near the Morrow-side anchor while Rowan was still there: ${JSON.stringify({
          label: labels.targetWorldPoint,
          player: mapAgency.playerWorldPoint,
          target: mapAgency.target,
        })}.`,
      );
    }
  }

  if (!pointInsideRect(mapAgency.target, mapAgency.cameraVisibleWorldRect)) {
    assert.equal(
      labels.targetVisible,
      false,
      `${label}: Kettle target label must hide when the target is outside the visible camera rect.`,
    );
  }
}

function assertKettleTargetCueSpatialAuthority(byLabel, label) {
  const entry = byLabel[label];
  assert.ok(entry, `Expected Kettle target timeline entry ${label}.`);
  assert.equal(
    entry.location?.id,
    "boarding-house",
    `${label}: expected route-start evidence while Rowan is still leaving Morrow House.`,
  );
  assert.equal(
    entry.autonomy?.targetLocationId,
    "tea-house",
    `${label}: expected Kettle & Lamp to be the selected target.`,
  );

  let mapAgency = entry.mapAgency;
  let evidenceLabel = label;
  if (!mapAgency) {
    const nearbyLabel = label.replace(/-route-start$/, "-route-mid");
    const nearbyEntry = byLabel[nearbyLabel];
    assert.ok(
      nearbyEntry?.mapAgency,
      `${label}: missing map-agency probe and no nearby route-mid probe was captured.`,
    );
    assert.equal(
      nearbyEntry.location?.id,
      "boarding-house",
      `${label}: nearby map-agency evidence must still be captured while Rowan is leaving Morrow House.`,
    );
    assert.equal(
      nearbyEntry.autonomy?.targetLocationId,
      "tea-house",
      `${label}: nearby map-agency evidence must stay on the Kettle & Lamp target.`,
    );
    assert.equal(
      nearbyEntry.movement?.playerRoute?.active,
      true,
      `${label}: nearby map-agency evidence must come from the active route.`,
    );
    assert.ok(
      (nearbyEntry.movement?.playerRoute?.progress ?? 1) <= 0.5,
      `${label}: nearby map-agency evidence must be early enough to prove Rowan is still Morrow-side.`,
    );
    mapAgency = nearbyEntry.mapAgency;
    evidenceLabel = `${label} via ${nearbyLabel}`;
  }

  assertKettleTargetCueMapAgency(mapAgency, evidenceLabel);
}

function assertSettledOutdoorPlayerLocationCorrelation({
  entry,
  label,
  locationId,
  locationName,
}) {
  assert.ok(entry, `Expected settled outdoor entry ${label}.`);
  assert.equal(
    entry.location?.id,
    locationId,
    `${label}: expected the simulated location to be ${locationName}.`,
  );
  assert.equal(
    entry.location?.spaceId,
    "street:south-quay",
    `${label}: expected an outdoor South Quay frame before entering ${locationName}.`,
  );
  assert.equal(
    entry.visualPlayer?.isMovingToServerState,
    false,
    `${label}: expected the visual player to be settled at ${locationName}.`,
  );
  const movementGeometry = entry.movement?.playerLocationGeometry ?? null;
  assert.equal(
    movementGeometry?.currentLocationId,
    locationId,
    `${label}: movement geometry current location must agree with ${locationName}.`,
  );
  assertSettledPointUsesAuthoredLandmarkArrival({
    movementGeometry,
    point: movementGeometry?.playerWorldPoint,
    pointSource: "movement geometry",
    label,
    locationId,
    locationName,
  });

  if (entry.camera?.playerWorldPoint) {
    assertSettledPointUsesAuthoredLandmarkArrival({
      movementGeometry,
      point: entry.camera.playerWorldPoint,
      pointSource: "camera/player geometry",
      label,
      locationId,
      locationName,
    });
  }

  if (!entry.mapAgency) {
    return;
  }

  assert.equal(
    entry.mapAgency.currentLocation?.id,
    locationId,
    `${label}: map-agency current location must agree with ${locationName}.`,
  );
  assertSettledPointUsesAuthoredLandmarkArrival({
    movementGeometry,
    point: entry.mapAgency.playerWorldPoint,
    pointSource: "map-agency geometry",
    label,
    locationId,
    locationName,
  });
}

function assertSettledPointUsesAuthoredLandmarkArrival({
  movementGeometry,
  point,
  pointSource,
  label,
  locationId,
  locationName,
}) {
  assert.ok(
    point,
    `${label}: ${pointSource} must expose Rowan's settled world point.`,
  );
  const authoredArrivalPoints = movementGeometry?.authoredArrivalPoints ?? [];
  assert.ok(
    authoredArrivalPoints.length > 0,
    `${label}: ${locationName} must expose authored door/frontage/approach coordinates.`,
  );
  assert.ok(
    authoredArrivalPoints.some(
      (arrival) =>
        pointDistance(point, arrival) <= AUTHORED_LANDMARK_ARRIVAL_MAX_DISTANCE,
    ),
    `${label}: settled ${pointSource} point is not at an authored ${locationName} door/frontage/approach: ${JSON.stringify({
      authoredArrivalPoints,
      point,
    })}.`,
  );

  const competingLandmarkFootprints =
    movementGeometry?.competingLandmarkFootprints ?? [];
  assert.ok(
    competingLandmarkFootprints.length > 0,
    `${label}: ${locationName} must expose competing authored landmark footprints.`,
  );
  const overlappingLandmarks = competingLandmarkFootprints
    .filter(({ bounds }) => pointInsideBounds(point, bounds))
    .map(({ locationId: competingLocationId }) => competingLocationId);
  assert.deepEqual(
    overlappingLandmarks,
    [],
    `${label}: settled ${pointSource} point for ${locationId} overlaps a competing landmark footprint: ${JSON.stringify({
      competingLandmarkFootprints,
      overlappingLandmarks,
      point,
    })}.`,
  );
}

function assertOutdoorRouteArrivalContinuity(
  byLabel,
  routeLabel,
  arrivalLabel,
  routeName,
) {
  const routeEntry = byLabel[routeLabel];
  const arrivalEntry = byLabel[arrivalLabel];
  assert.ok(routeEntry, `Expected route evidence for ${routeName}.`);
  assert.ok(arrivalEntry, `Expected arrival evidence for ${routeName}.`);

  const routeWorldPath = routeEntry.movement?.playerRoute?.worldPath ?? [];
  const routeEndpoint = routeWorldPath.at(-1) ?? null;
  const settledPlayerPoint =
    arrivalEntry.movement?.playerLocationGeometry?.playerWorldPoint ?? null;
  assert.ok(
    routeEndpoint && settledPlayerPoint,
    `${routeName}: missing route endpoint or settled arrival point. ${JSON.stringify({
      arrivalLabel,
      routeLabel,
      routeWorldPath,
      settledPlayerPoint,
    })}`,
  );

  const arrivalDistance = pointDistance(routeEndpoint, settledPlayerPoint);
  assert.ok(
    arrivalDistance <= OUTDOOR_ROUTE_ARRIVAL_CONTINUITY_MAX_DISTANCE,
    `${routeName}: route endpoint and settled arrival diverged, which would read as a sudden hop. ${JSON.stringify({
      arrivalDistance,
      arrivalLabel,
      routeEndpoint,
      routeLabel,
      settledPlayerPoint,
    })}`,
  );
}

function parseRoutePhaseLabel(label) {
  const match = /^(?<baseLabel>.+)-route-(?<phase>start|mid|close)$/.exec(
    label,
  );
  if (!match?.groups) {
    return null;
  }

  return {
    baseLabel: match.groups.baseLabel,
    phase: match.groups.phase,
  };
}

function compactAuditPoint(point) {
  if (!point) {
    return null;
  }

  return {
    x: roundAuditNumber(point.x ?? 0),
    y: roundAuditNumber(point.y ?? 0),
  };
}

function routeEndpointDistance(left, right) {
  if (!left || !right) {
    return null;
  }

  return roundAuditNumber(pointDistance(left, right));
}

function collectPlayerRouteContinuityGaps(entry) {
  const gaps = [];

  if (!entry.allLegal) {
    gaps.push("illegal-route-diagnostic");
  }
  if (!entry.progressMonotonic) {
    gaps.push("non-monotonic-route-progress");
  }
  if (!entry.sameSpace) {
    gaps.push("route-space-changed-without-transition");
  }
  if (!entry.spaceMatchesProbe) {
    gaps.push("route-space-probe-mismatch");
  }
  if (!entry.endpointStable) {
    gaps.push("route-endpoint-drift");
  }
  if (!entry.targetLocationKnown) {
    gaps.push("route-target-location-missing");
  }
  if (!entry.targetLocationStable) {
    gaps.push("route-target-location-changed");
  }
  if (!entry.targetLocationAgreement) {
    gaps.push("target-location-arrival-mismatch");
  }
  if (!entry.targetLabelAttached) {
    gaps.push("target-label-detached");
  }
  if (entry.arrivalContinuity?.required) {
    if (entry.arrivalContinuity.status === "failed") {
      gaps.push("route-endpoint-arrival-diverged");
    } else if (entry.arrivalContinuity.status !== "passed") {
      gaps.push("route-arrival-pair-missing");
    }
  }

  return gaps;
}

function buildPlayerRouteContinuityLedger(timeline, options = {}) {
  const explainedMissingCoverage =
    options.explainedMissingCoverage ?? {};
  const byLabel = new Map(timeline.map((entry) => [entry.label, entry]));
  const groups = new Map();

  for (const [timelineIndex, entry] of timeline.entries()) {
    const parsed = parseRoutePhaseLabel(entry.label);
    const route = entry.movement?.playerRoute;
    if (!parsed || !route?.active) {
      continue;
    }

    const targetLabelDistance =
      entry.mapAgency?.labels?.targetVisible &&
      entry.mapAgency?.labels?.targetWorldPoint &&
      entry.mapAgency?.target
        ? routeEndpointDistance(
            entry.mapAgency.labels.targetWorldPoint,
            entry.mapAgency.target,
          )
        : null;
    const phaseEntry = {
      allDiagnosticsLegal:
        Boolean(route.legal) &&
        Boolean(route.reachesDestination) &&
        Boolean(route.sampledPointsLegal) &&
        Boolean(
          route.visualObstaclesClear ?? route.diagnostics?.visualObstaclesClear,
        ),
      endpoint: route.worldPath.at(-1) ?? null,
      label: entry.label,
      phase: parsed.phase,
      progress: route.progress,
      routeTarget: route.target ?? null,
      spaceId: route.spaceId ?? null,
      autonomyTargetLocationId: entry.autonomy?.targetLocationId ?? null,
      targetLabelDistance,
      targetLocationId: route.targetLocationId ?? null,
      tilePathLength: route.tilePath.length,
      timelineIndex,
      worldPathLength: route.worldPath.length,
    };
    const group = groups.get(parsed.baseLabel) ?? {
      baseLabel: parsed.baseLabel,
      phases: [],
    };
    group.phases.push(phaseEntry);
    groups.set(parsed.baseLabel, group);
  }

  const entries = [...groups.values()]
    .map((group) => {
      const phases = group.phases
        .sort(
          (left, right) =>
            ROUTE_PHASE_ORDER[left.phase] - ROUTE_PHASE_ORDER[right.phase],
        )
        .map((phase) => ({
          ...phase,
          endpoint: compactAuditPoint(phase.endpoint),
          routeTarget: compactAuditPoint(phase.routeTarget),
        }));
      const rawPhases = group.phases.sort(
        (left, right) =>
          ROUTE_PHASE_ORDER[left.phase] - ROUTE_PHASE_ORDER[right.phase],
      );
      const firstPhase = rawPhases[0] ?? null;
      const lastPhase = rawPhases.at(-1) ?? null;
      const arrivalEntry = byLabel.get(group.baseLabel) ?? null;
      const routeSpaceIds = [
        ...new Set(rawPhases.map((phase) => phase.spaceId ?? null)),
      ];
      const targetLocationKnown = rawPhases.every(
        (phase) => Boolean(phase.targetLocationId),
      );
      const targetLocationIds = [
        ...new Set(
          rawPhases
            .map((phase) => phase.targetLocationId)
            .filter(Boolean),
        ),
      ];
      const targetLocationId = targetLocationIds[0] ?? null;
      const targetLocationStable =
        targetLocationKnown && targetLocationIds.length === 1;
      const sameSpace = routeSpaceIds.length <= 1;
      const spaceMatchesProbe = rawPhases.every((phase) => {
        const phaseEntry = byLabel.get(phase.label);
        return (
          phase.spaceId ===
          (phaseEntry?.location?.spaceId ??
            phaseEntry?.movement?.activeSpaceId ??
            null)
        );
      });
      let maxEndpointDelta = 0;
      for (let leftIndex = 0; leftIndex < rawPhases.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < rawPhases.length;
          rightIndex += 1
        ) {
          maxEndpointDelta = Math.max(
            maxEndpointDelta,
            pointDistance(
              rawPhases[leftIndex].endpoint,
              rawPhases[rightIndex].endpoint,
            ),
          );
        }
      }
      const progressMonotonic = rawPhases.every(
        (phase, index) =>
          index === 0 || phase.progress + 0.02 >= rawPhases[index - 1].progress,
      );
      const allLegal = rawPhases.every(
        (phase) =>
          phase.allDiagnosticsLegal &&
          phase.tilePathLength >= 2 &&
          phase.worldPathLength >= 2,
      );
      const targetLabelAttached = rawPhases.every(
        (phase) =>
          phase.targetLabelDistance === null ||
          phase.targetLabelDistance <= MAP_AGENCY_TARGET_LABEL_MAX_OFFSET,
      );
      const endpointStable =
        maxEndpointDelta <= OUTDOOR_ROUTE_ARRIVAL_CONTINUITY_MAX_DISTANCE;
      const arrivalPoint =
        arrivalEntry?.movement?.playerLocationGeometry?.playerWorldPoint ?? null;
      const arrivalDistance = routeEndpointDistance(
        lastPhase?.endpoint ?? null,
        arrivalPoint,
      );
      const arrivalRequired =
        Boolean(arrivalEntry) && firstPhase?.spaceId === "street:south-quay";
      const arrivalContinuity = {
        arrivalLabel: arrivalEntry?.label ?? null,
        arrivalLocationId: arrivalEntry?.location?.id ?? null,
        distance: arrivalDistance,
        required: arrivalRequired,
        routeEndpoint: compactAuditPoint(lastPhase?.endpoint ?? null),
        settledPlayerPoint: compactAuditPoint(arrivalPoint),
        status: !arrivalEntry
          ? "missing-arrival-frame"
          : !arrivalRequired
            ? "not-required-for-non-street-route"
            : !lastPhase?.endpoint || !arrivalPoint
              ? "missing-settled-geometry"
              : arrivalDistance <= OUTDOOR_ROUTE_ARRIVAL_CONTINUITY_MAX_DISTANCE
                ? "passed"
                : "failed",
      };
      const targetLocationAgreement =
        targetLocationStable &&
        Boolean(arrivalEntry?.location?.id) &&
        arrivalEntry.location.id === targetLocationId;
      const entry = {
        allLegal,
        arrivalContinuity,
        baseLabel: group.baseLabel,
        endpointStable,
        maxEndpointDelta: roundAuditNumber(maxEndpointDelta),
        phaseCount: phases.length,
        phases,
        progressMonotonic,
        sameSpace,
        spaceMatchesProbe,
        targetLabelAttached,
        targetLocationAgreement,
        targetLocationId,
        targetLocationKnown,
        targetLocationStable,
      };

      return {
        ...entry,
        gaps: collectPlayerRouteContinuityGaps(entry),
      };
    })
    .sort((left, right) => {
      const leftIndex = left.phases[0]?.timelineIndex ?? 0;
      const rightIndex = right.phases[0]?.timelineIndex ?? 0;
      return leftIndex - rightIndex;
    });

  const entryByBaseLabel = new Map(
    entries.map((entry) => [entry.baseLabel, entry]),
  );
  const requiredCoverage = REQUIRED_PLAYER_ROUTE_COVERAGE.map(
    ({ baseLabel, label, requiredInEveryAudit = true }) => {
      const ledgerEntry = entryByBaseLabel.get(baseLabel) ?? null;
      const settledEntry = byLabel.get(baseLabel) ?? null;
      const coveredByRoute = Boolean(ledgerEntry);
      const coveredAsSettledPhase =
        !coveredByRoute && Boolean(settledEntry) &&
        !settledEntry?.movement?.playerRoute?.active;
      const externalExplanation = explainedMissingCoverage[baseLabel] ?? null;
      const explainedMissing =
        !coveredByRoute &&
        !coveredAsSettledPhase &&
        (!requiredInEveryAudit || Boolean(externalExplanation));
      return {
        baseLabel,
        explanation: coveredByRoute
          ? "captured-route-ledger"
          : coveredAsSettledPhase
            ? "non-route-or-settled-phase"
            : explainedMissing
              ? externalExplanation ?? "not-required-in-this-movement-audit"
              : "missing-evidence",
        label,
        locationId: settledEntry?.location?.id ?? null,
        requiredInEveryAudit,
        routeGapCount: ledgerEntry?.gaps.length ?? 0,
        status:
          coveredByRoute || coveredAsSettledPhase
            ? "covered"
            : explainedMissing
              ? "explained"
              : "missing",
      };
    },
  );

  return {
    entries,
    gaps: entries.flatMap((entry) =>
      entry.gaps.map((reason) => ({
        baseLabel: entry.baseLabel,
        reason,
      })),
    ),
    requiredCoverage,
  };
}

function buildActiveRouteTargetAuthorityFixture({
  rewriteRouteTarget = false,
} = {}) {
  const endpoint = { x: 316, y: 276 };
  const phases = [
    {
      autonomyTargetLocationId: "boarding-house",
      phase: "start",
      progress: 0.1,
    },
    { autonomyTargetLocationId: "tea-house", phase: "mid", progress: 0.5 },
    {
      autonomyTargetLocationId: "tea-house",
      phase: "close",
      progress: 0.9,
    },
  ];
  const timeline = phases.map((phase, index) => ({
    autonomy: { targetLocationId: phase.autonomyTargetLocationId },
    label: `mara-live-thread-route-${phase.phase}`,
    location: {
      id: "boarding-house",
      spaceId: "interior:boarding-house",
    },
    movement: {
      activeSpaceId: "interior:boarding-house",
      playerRoute: {
        active: true,
        diagnostics: { visualObstaclesClear: true },
        legal: true,
        progress: phase.progress,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "interior:boarding-house",
        target: { x: 5, y: 5 },
        targetLocationId:
          rewriteRouteTarget && index > 0 ? "tea-house" : "boarding-house",
        tilePath: [
          { x: 6, y: 8 },
          { x: 5, y: 5 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 356, y: 396 },
          endpoint,
        ],
      },
    },
  }));

  timeline.push({
    label: "mara-live-thread",
    location: {
      id: "boarding-house",
      spaceId: "interior:boarding-house",
    },
    movement: {
      playerLocationGeometry: { playerWorldPoint: endpoint },
    },
  });
  return timeline;
}

function assertActiveRouteTargetAuthorityRegression() {
  const preservedLedger = buildPlayerRouteContinuityLedger(
    buildActiveRouteTargetAuthorityFixture(),
  );
  const preserved = preservedLedger.entries.find(
    (entry) => entry.baseLabel === "mara-live-thread",
  );
  assert.ok(
    preserved,
    "Expected active-route target authority fixture coverage.",
  );
  assert.deepEqual(
    preserved.gaps,
    [],
    "A newer autonomy target must not rewrite the active visual route target.",
  );
  assert.deepEqual(
    preserved.phases.map((phase) => phase.targetLocationId),
    ["boarding-house", "boarding-house", "boarding-house"],
    "The active Mara route must retain Morrow House target identity through playback.",
  );
  assert.ok(
    preserved.phases.some(
      (phase) => phase.autonomyTargetLocationId === "tea-house",
    ),
    "The fixture must prove planning can advance to Kettle & Lamp during the active Mara route.",
  );

  const rewrittenLedger = buildPlayerRouteContinuityLedger(
    buildActiveRouteTargetAuthorityFixture({ rewriteRouteTarget: true }),
  );
  assert.ok(
    rewrittenLedger.gaps.some(
      (gap) =>
        gap.baseLabel === "mara-live-thread" &&
        gap.reason === "route-target-location-changed",
    ),
    "Route continuity must fail when active route target identity changes mid-playback.",
  );
  assert.ok(
    rewrittenLedger.gaps.some(
      (gap) =>
        gap.baseLabel === "mara-live-thread" &&
        gap.reason === "target-location-arrival-mismatch",
    ),
    "Route continuity must retain strict target-to-arrival agreement.",
  );
}

function buildMovementAuditSummary(timeline, options = {}) {
  const scheduledNpcObservationTimeline =
    options.scheduledNpcObservationTimeline ?? [];
  const timelineIndexByLabel = new Map(
    timeline.map((entry, index) => [entry.label, index]),
  );
  const scheduledNpcEvidenceTimeline = [
    ...timeline.map((entry, timelineIndex) => ({ entry, timelineIndex })),
    ...scheduledNpcObservationTimeline.map((entry, observationIndex) => {
      const milestoneIndex = timelineIndexByLabel.get(
        entry.evidenceForMilestone,
      );
      return {
        entry,
        timelineIndex:
          typeof milestoneIndex === "number"
            ? milestoneIndex - 0.5
            : timeline.length + observationIndex,
      };
    }),
  ];
  const playerRoutes = timeline
    .filter((entry) => entry.movement?.playerRoute?.active)
    .map((entry) => {
      const route = entry.movement.playerRoute;
      return {
        blockedByVisualScene: route.diagnostics?.blockedByVisualScene ?? 0,
        label: entry.label,
        legal: Boolean(route.legal),
        progress: route.progress,
        reachesDestination: Boolean(route.reachesDestination),
        sampledPointsLegal: Boolean(route.sampledPointsLegal),
        snappedEnd: Boolean(route.diagnostics?.snappedEnd),
        snappedStart: Boolean(route.diagnostics?.snappedStart),
        target: route.target,
        targetLocationId: route.targetLocationId ?? null,
        tilePathLength: route.tilePath.length,
        visualObstaclesClear: Boolean(
          route.visualObstaclesClear ?? route.diagnostics?.visualObstaclesClear,
        ),
        worldPathLength: route.worldPath.length,
      };
    });

  const scheduledNpcMarkerSamples = [];
  const playerLocationGeometrySamples = [];
  const scheduledNpcRouteSamples = [];
  const scheduledNpcVisualCueSamples = [];
  const scheduledNpcRoutesByKey = new Map();
  for (const [timelineIndex, entry] of timeline.entries()) {
    if (entry.movement?.playerLocationGeometry) {
      playerLocationGeometrySamples.push({
        ...entry.movement.playerLocationGeometry,
        label: entry.label,
        timelineIndex,
      });
    }
  }

  for (const { entry, timelineIndex } of scheduledNpcEvidenceTimeline) {
    for (const marker of entry.movement?.scheduledNpcMarkerSamples ?? []) {
      scheduledNpcMarkerSamples.push({
        activeSpaceId: marker.activeSpaceId ?? null,
        currentLocationId: marker.currentLocationId ?? null,
        currentScheduleLocationId: marker.currentScheduleLocationId ?? null,
        distanceToRoute: marker.distanceToRoute ?? null,
        key: marker.key,
        label: entry.label,
        markerSource: marker.markerSource ?? null,
        nextScheduleLocationId: marker.nextScheduleLocationId ?? null,
        npcId: marker.npcId,
        onRoute: Boolean(marker.onRoute),
        position: marker.position ?? null,
        routePathLength: marker.routePathLength ?? 0,
        routeProgress: marker.routeProgress ?? null,
        timelineIndex,
        toLocationId: marker.toLocationId ?? null,
        visible: Boolean(marker.visible),
      });
    }

    for (const cue of entry.movement?.scheduledNpcVisualCues ?? []) {
      scheduledNpcVisualCueSamples.push({
        activeSpaceId: cue.activeSpaceId ?? null,
        cueKind: cue.cueKind,
        cueLabel: cue.cueLabel,
        cueSignal: cue.cueSignal,
        currentLocationId: cue.currentLocationId ?? null,
        currentScheduleLocationId: cue.currentScheduleLocationId ?? null,
        distanceToRoute: cue.distanceToRoute ?? null,
        fromLocationId: cue.fromLocationId ?? null,
        key: cue.key,
        label: entry.label,
        markerSource: cue.markerSource ?? null,
        nextScheduleLocationId: cue.nextScheduleLocationId ?? null,
        nextScheduleStartsInMinutes: cue.nextScheduleStartsInMinutes ?? null,
        npcId: cue.npcId,
        npcName: cue.npcName ?? cue.npcId,
        onRoute: Boolean(cue.onRoute),
        position: cue.position ?? null,
        routeLegal: Boolean(cue.routeLegal),
        routePathLength: cue.routePathLength ?? 0,
        routeProgress: cue.routeProgress ?? null,
        timelineIndex,
        toLocationId: cue.toLocationId ?? null,
        visible: Boolean(cue.visible),
      });
    }

    for (const route of entry.movement?.scheduledNpcRoutes ?? []) {
      const sample = {
        acceptedNoRouteReason: route.acceptedNoRouteReason ?? null,
        currentScheduleLocationId: route.currentScheduleLocationId ?? null,
        fromLocationId: route.fromLocationId,
        key: route.key,
        label: entry.label,
        legal: Boolean(route.legal),
        nextScheduleLocationId: route.nextScheduleLocationId ?? null,
        npcId: route.npcId,
        pathLength: route.pathLength ?? 0,
        reachesTarget: Boolean(route.reachesTarget),
        routeKind: route.routeKind,
        routed: Boolean(route.routed),
        sampledPointsLegal: Boolean(route.sampledPointsLegal),
        timelineIndex,
        toLocationId: route.toLocationId,
        unreachableSegments: route.unreachableSegments ?? 0,
        visualObstaclesClear: Boolean(route.visualObstaclesClear),
      };
      scheduledNpcRouteSamples.push(sample);

      const aggregate = scheduledNpcRoutesByKey.get(route.key) ?? {
        acceptedNoRouteReason: route.acceptedNoRouteReason ?? null,
        allLegal: true,
        allRoutedOrAccepted: true,
        fromLocationId: route.fromLocationId,
        labels: [],
        maxUnreachableSegments: 0,
        minPathLength: Number.POSITIVE_INFINITY,
        npcId: route.npcId,
        routeKind: route.routeKind,
        sampleCount: 0,
        toLocationId: route.toLocationId,
      };
      aggregate.allLegal =
        aggregate.allLegal &&
        (Boolean(route.acceptedNoRouteReason) || Boolean(route.legal));
      aggregate.allRoutedOrAccepted =
        aggregate.allRoutedOrAccepted &&
        (Boolean(route.acceptedNoRouteReason) || Boolean(route.routed));
      aggregate.labels.push(entry.label);
      aggregate.maxUnreachableSegments = Math.max(
        aggregate.maxUnreachableSegments,
        route.unreachableSegments ?? 0,
      );
      aggregate.minPathLength = Math.min(
        aggregate.minPathLength,
        route.pathLength ?? 0,
      );
      aggregate.sampleCount += 1;
      scheduledNpcRoutesByKey.set(route.key, aggregate);
    }
  }

  const scheduledNpcLocationChanges = buildScheduledNpcLocationChangeAudit({
    markerSamples: scheduledNpcMarkerSamples,
    routeSamples: scheduledNpcRouteSamples,
    timeline,
    visualCueSamples: scheduledNpcVisualCueSamples,
  });
  const playerRouteContinuityLedger =
    buildPlayerRouteContinuityLedger(
      timeline,
      options.playerRouteContinuityLedgerOptions,
    );

  const patrolsByLocation = new Map();
  for (const entry of timeline) {
    if (entry.movement?.activeSpaceId !== "street:south-quay") {
      continue;
    }

    for (const patrol of entry.movement?.npcPatrols ?? []) {
      const current = patrolsByLocation.get(patrol.locationId) ?? {
        allRouted: true,
        labels: [],
        locationId: patrol.locationId,
        maxDroppedWaypoints: 0,
        maxUnreachableSegments: 0,
        minPathLength: Number.POSITIVE_INFINITY,
        sampleCount: 0,
        usedVisualHints: false,
      };
      current.allRouted = current.allRouted && Boolean(patrol.routed);
      current.labels.push(entry.label);
      current.maxDroppedWaypoints = Math.max(
        current.maxDroppedWaypoints,
        patrol.droppedWaypoints ?? 0,
      );
      current.maxUnreachableSegments = Math.max(
        current.maxUnreachableSegments,
        patrol.unreachableSegments ?? 0,
      );
      current.minPathLength = Math.min(
        current.minPathLength,
        patrol.pathLength,
      );
      current.sampleCount += 1;
      current.usedVisualHints =
        current.usedVisualHints || Boolean(patrol.usedVisualHints);
      patrolsByLocation.set(patrol.locationId, current);
    }
  }

  const npcPatrols = [...patrolsByLocation.values()]
    .map((patrol) => ({
      ...patrol,
      minPathLength: Number.isFinite(patrol.minPathLength)
        ? patrol.minPathLength
        : 0,
    }))
    .sort((left, right) => left.locationId.localeCompare(right.locationId));

  return {
    npcPatrols,
    playerLocationGeometrySamples,
    playerRouteContinuityLedger,
    playerRoutes,
    scheduledNpcContinuityGaps: scheduledNpcLocationChanges.filter(
      (change) => change.continuityGapReason,
    ),
    scheduledNpcMarkerSamples,
    scheduledNpcLocationChanges,
    scheduledNpcRouteSamples,
    scheduledNpcVisualCueSamples,
    scheduledNpcRoutes: [...scheduledNpcRoutesByKey.values()]
      .map((route) => ({
        ...route,
        minPathLength: Number.isFinite(route.minPathLength)
          ? route.minPathLength
          : 0,
      }))
      .sort((left, right) => left.npcId.localeCompare(right.npcId)),
  };
}

function isLegalScheduledNpcRouteSample(route) {
  return (
    !route.acceptedNoRouteReason &&
    route.legal &&
    route.reachesTarget &&
    route.routed &&
    route.sampledPointsLegal &&
    route.visualObstaclesClear &&
    route.unreachableSegments === 0 &&
    route.pathLength > 1
  );
}

function isValidVisibleScheduledNpcMarkerSample(marker) {
  return (
    marker.visible &&
    marker.onRoute &&
    marker.routePathLength > 1 &&
    typeof marker.routeProgress === "number" &&
    marker.position
  );
}

function isValidScheduledNpcVisualCueSample(cue) {
  return (
    cue.visible &&
    cue.onRoute &&
    cue.routeLegal &&
    cue.routePathLength > 1 &&
    typeof cue.routeProgress === "number" &&
    cue.position &&
    typeof cue.cueLabel === "string" &&
    cue.cueLabel.length > 0 &&
    !/\b(cityEvents|worldPressure|routeKey|advance_objective)\b/i.test(
      `${cue.cueLabel} ${cue.cueSignal}`,
    )
  );
}

function isUsableScheduledNpcSpatialSample(sample) {
  return (
    isValidVisibleScheduledNpcMarkerSample(sample) ||
    isValidScheduledNpcVisualCueSample(sample)
  );
}

function assertOpeningPlayerLocationGeometrySample(movementAudit, label) {
  const sample = movementAudit.playerLocationGeometrySamples.find(
    (candidate) => candidate.label === label,
  );
  assert.ok(
    sample,
    `${label}: expected opening player location geometry evidence.`,
  );
  assert.equal(
    sample.currentLocationId,
    "boarding-house",
    `${label}: Rowan should be located at Morrow House in the opening geometry sample.`,
  );
  assert.equal(
    sample.actionId,
    "enter:boarding-house",
    `${label}: opening geometry should reflect the Enter Morrow House action.`,
  );
  assert.equal(
    sample.anchorLocationId,
    "boarding-house",
    `${label}: opening geometry should target the Morrow House anchor.`,
  );
  assert.equal(
    sample.anchorKind,
    "door",
    `${label}: opening geometry should measure Rowan against the Morrow House door anchor.`,
  );
  assert.ok(
    sample.anchorWorldPoint &&
      sample.anchorWorldPoint.x >=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.minX &&
      sample.anchorWorldPoint.x <=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.maxX &&
      sample.anchorWorldPoint.y >=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.minY &&
      sample.anchorWorldPoint.y <= OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.maxY,
    `${label}: Morrow House door anchor is detached from the visible entrance: ${JSON.stringify(sample)}.`,
  );
  assert.equal(
    sample.nearActionLocation,
    true,
    `${label}: Rowan marker is not near the opening action location: ${JSON.stringify(sample)}.`,
  );
  assert.ok(
    sample.playerWorldPoint && sample.anchorWorldPoint,
    `${label}: opening geometry must include player and anchor world points: ${JSON.stringify(sample)}.`,
  );
  assert.ok(
    typeof sample.distanceToAnchor === "number" &&
      sample.distanceToAnchor <= OPENING_PLAYER_LOCATION_MAX_DISTANCE,
    `${label}: Rowan marker is too far from the Morrow House entrance: ${JSON.stringify(sample)}.`,
  );
}

function compactScheduledNpcRouteSample(route) {
  return {
    currentScheduleLocationId: route.currentScheduleLocationId ?? null,
    fromLocationId: route.fromLocationId,
    key: route.key,
    label: route.label,
    legal: Boolean(route.legal),
    nextScheduleLocationId: route.nextScheduleLocationId ?? null,
    npcId: route.npcId,
    pathLength: route.pathLength ?? 0,
    reachesTarget: Boolean(route.reachesTarget),
    routeKind: route.routeKind,
    routed: Boolean(route.routed),
    sampledPointsLegal: Boolean(route.sampledPointsLegal),
    toLocationId: route.toLocationId,
    unreachableSegments: route.unreachableSegments ?? 0,
    visualObstaclesClear: Boolean(route.visualObstaclesClear),
  };
}

function compactScheduledNpcMarkerSample(marker) {
  return {
    activeSpaceId: marker.activeSpaceId ?? null,
    currentLocationId: marker.currentLocationId ?? null,
    currentScheduleLocationId: marker.currentScheduleLocationId ?? null,
    distanceToRoute: marker.distanceToRoute ?? null,
    key: marker.key,
    label: marker.label,
    markerSource: marker.markerSource ?? null,
    nextScheduleLocationId: marker.nextScheduleLocationId ?? null,
    npcId: marker.npcId,
    onRoute: Boolean(marker.onRoute),
    position: marker.position ?? null,
    routePathLength: marker.routePathLength ?? 0,
    routeProgress: marker.routeProgress ?? null,
    timelineIndex: marker.timelineIndex,
    toLocationId: marker.toLocationId ?? null,
    visible: Boolean(marker.visible),
  };
}

function compactScheduledNpcVisualCueSample(cue) {
  return {
    activeSpaceId: cue.activeSpaceId ?? null,
    cueKind: cue.cueKind,
    cueLabel: cue.cueLabel,
    cueSignal: cue.cueSignal,
    currentLocationId: cue.currentLocationId ?? null,
    currentScheduleLocationId: cue.currentScheduleLocationId ?? null,
    distanceToRoute: cue.distanceToRoute ?? null,
    fromLocationId: cue.fromLocationId ?? null,
    key: cue.key,
    label: cue.label,
    markerSource: cue.markerSource ?? null,
    nextScheduleLocationId: cue.nextScheduleLocationId ?? null,
    nextScheduleStartsInMinutes: cue.nextScheduleStartsInMinutes ?? null,
    npcId: cue.npcId,
    npcName: cue.npcName ?? cue.npcId,
    onRoute: Boolean(cue.onRoute),
    position: cue.position ?? null,
    routeLegal: Boolean(cue.routeLegal),
    routePathLength: cue.routePathLength ?? 0,
    routeProgress: cue.routeProgress ?? null,
    timelineIndex: cue.timelineIndex,
    toLocationId: cue.toLocationId ?? null,
    visible: Boolean(cue.visible),
  };
}

function buildScheduledNpcSpatialEvidence({
  movementAudit,
  worldPressureAudit,
}) {
  const legalRouteSamples = movementAudit.scheduledNpcRouteSamples
    .filter(isLegalScheduledNpcRouteSample)
    .slice(0, 8)
    .map(compactScheduledNpcRouteSample);
  const validVisibleMarkerSamples = movementAudit.scheduledNpcMarkerSamples
    .filter(isValidVisibleScheduledNpcMarkerSample)
    .slice(0, 8)
    .map(compactScheduledNpcMarkerSample);
  const visibleCueSamples = movementAudit.scheduledNpcVisualCueSamples
    .filter(isValidScheduledNpcVisualCueSample)
    .slice(0, 8)
    .map(compactScheduledNpcVisualCueSample);
  const routeSampleByKey = new Map(
    movementAudit.scheduledNpcRouteSamples.map((route) => [route.key, route]),
  );
  const markerSamplesForChange = ({ fromLocationId, npcId, toLocationId }) =>
    movementAudit.scheduledNpcMarkerSamples
      .filter(
        (marker) =>
          marker.npcId === npcId &&
          marker.currentLocationId === fromLocationId &&
          marker.toLocationId === toLocationId,
      )
      .filter(isValidVisibleScheduledNpcMarkerSample)
      .slice(0, 3)
      .map(compactScheduledNpcMarkerSample);
  const npcSchedulePressureChanges =
    worldPressureAudit.worldPressureTimeline.filter(
      (change) =>
        change.kind === "npc-schedule" && change.cause === "independent",
    );
  const currentLocationPressureChanges = npcSchedulePressureChanges.filter(
    (change) => change.field === "currentLocationId",
  );

  const locationChanges = movementAudit.scheduledNpcLocationChanges.map(
    (change) => {
      const route =
        (change.routeEvidenceKey &&
          routeSampleByKey.get(change.routeEvidenceKey)) ??
        null;
      const pressureFields = npcSchedulePressureChanges
        .filter(
          (pressureChange) =>
            pressureChange.id === change.npcId &&
            pressureChange.fromLabel === change.fromLabel &&
            pressureChange.toLabel === change.toLabel,
        )
        .map((pressureChange) => pressureChange.field);

      return {
        acceptedNoRouteReason: change.acceptedNoRouteReason,
        continuityGapReason: change.continuityGapReason,
        currentScheduleChanged: Boolean(change.currentScheduleChanged),
        currentStopChanged: Boolean(change.currentStopChanged),
        fromLabel: change.fromLabel,
        fromLocationId: change.fromLocationId,
        markerEvidence: change.markerEvidence,
        markerSamples: markerSamplesForChange(change),
        npcId: change.npcId,
        pressureFields,
        routeEvidence: route ? compactScheduledNpcRouteSample(route) : null,
        routeEvidenceKey: change.routeEvidenceKey,
        toLabel: change.toLabel,
        toLocationId: change.toLocationId,
        valid: Boolean(change.valid),
      };
    },
  );

  return {
    continuityGaps: locationChanges.filter(
      (change) => change.continuityGapReason,
    ),
    counts: {
      currentLocationPressureChangeCount: currentLocationPressureChanges.length,
      currentStopChangeCount: movementAudit.scheduledNpcLocationChanges.filter(
        (change) => change.currentStopChanged,
      ).length,
      legalRouteSampleCount: movementAudit.scheduledNpcRouteSamples.filter(
        isLegalScheduledNpcRouteSample,
      ).length,
      locationChangeCount: movementAudit.scheduledNpcLocationChanges.length,
      npcSchedulePressureChangeCount: npcSchedulePressureChanges.length,
      pressureMoveSnapshotCount: worldPressureAudit.npcPressureMoveCount,
      routeSampleCount: movementAudit.scheduledNpcRouteSamples.length,
      validVisibleMarkerSampleCount:
        movementAudit.scheduledNpcMarkerSamples.filter(
          isValidVisibleScheduledNpcMarkerSample,
        ).length,
      visibleMarkerSampleCount: movementAudit.scheduledNpcMarkerSamples.filter(
        (marker) => marker.visible,
      ).length,
      visibleScheduleCueSampleCount:
        movementAudit.scheduledNpcVisualCueSamples.filter(
          isValidScheduledNpcVisualCueSample,
        ).length,
      visibleScheduleCueNpcCount: new Set(
        movementAudit.scheduledNpcVisualCueSamples
          .filter(isValidScheduledNpcVisualCueSample)
          .map((cue) => cue.npcId),
      ).size,
    },
    legalRouteSamples,
    locationChanges,
    pressureChanges: npcSchedulePressureChanges.slice(0, 12).map((change) => ({
      field: change.field,
      from: change.from ?? null,
      fromClock: change.fromClock ?? null,
      fromLabel: change.fromLabel,
      id: change.id,
      to: change.to ?? null,
      toClock: change.toClock ?? null,
      toLabel: change.toLabel,
    })),
    validVisibleMarkerSamples,
    visibleCueSamples,
  };
}

function assertScheduledNpcSpatialEvidence(scheduledNpcSpatialEvidence) {
  assert.ok(
    scheduledNpcSpatialEvidence,
    "Scheduled NPC spatial evidence must be recorded in the inhabit gameplay report.",
  );

  const observedSchedulePressure =
    scheduledNpcSpatialEvidence.counts.pressureMoveSnapshotCount > 0 ||
    scheduledNpcSpatialEvidence.counts.currentLocationPressureChangeCount > 0;
  if (!observedSchedulePressure) {
    return;
  }

  assert.ok(
    scheduledNpcSpatialEvidence.legalRouteSamples.length > 0 ||
      scheduledNpcSpatialEvidence.validVisibleMarkerSamples.length > 0 ||
      scheduledNpcSpatialEvidence.visibleCueSamples.length > 0,
    `World pressure observed NPC schedule movement, but the inhabit report did not include legal route or valid visible marker evidence: ${JSON.stringify(
      scheduledNpcSpatialEvidence.counts,
      null,
      2,
    )}`,
  );
  assert.ok(
    scheduledNpcSpatialEvidence.visibleCueSamples.length > 0,
    `Expected at least one player-visible scheduled NPC movement cue in the browser report: ${JSON.stringify(
      scheduledNpcSpatialEvidence.counts,
      null,
      2,
    )}`,
  );
  assert.deepEqual(
    scheduledNpcSpatialEvidence.continuityGaps,
    [],
    `Scheduled NPC current-stop changes must include visible marker movement before the stop changes: ${JSON.stringify(
      scheduledNpcSpatialEvidence.continuityGaps.map((gap) => ({
        continuityGapReason: gap.continuityGapReason,
        fromLabel: gap.fromLabel,
        fromLocationId: gap.fromLocationId,
        markerEvidence: gap.markerEvidence,
        npcId: gap.npcId,
        routeEvidenceKey: gap.routeEvidenceKey,
        toLabel: gap.toLabel,
        toLocationId: gap.toLocationId,
      })),
      null,
      2,
    )}`,
  );
}

function buildScheduledNpcLocationChangeAudit({
  markerSamples,
  routeSamples,
  timeline,
  visualCueSamples,
}) {
  const routeSampleMatches = ({
    fromLocationId,
    npcId,
    timelineIndex,
    toLocationId,
  }) =>
    routeSamples.filter(
      (route) =>
        route.npcId === npcId &&
        route.fromLocationId === fromLocationId &&
        route.toLocationId === toLocationId &&
        route.timelineIndex <= timelineIndex,
    );
  const markerSampleMatches = ({
    fromLocationId,
    npcId,
    timelineIndex,
    toLocationId,
  }) =>
    markerSamples.filter(
      (marker) =>
        marker.npcId === npcId &&
        marker.currentLocationId === fromLocationId &&
        marker.toLocationId === toLocationId &&
        marker.timelineIndex <= timelineIndex,
    );
  const visualCueSampleMatches = ({
    fromLocationId,
    npcId,
    timelineIndex,
    toLocationId,
  }) =>
    visualCueSamples.filter(
      (cue) =>
        cue.npcId === npcId &&
        cue.fromLocationId === fromLocationId &&
        cue.toLocationId === toLocationId &&
        (cue.cueKind === "current-schedule-stop" ||
          cue.cueKind === "next-scheduled-stop") &&
        cue.timelineIndex <= timelineIndex,
    );
  const changes = [];

  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const next = timeline[index];
    const previousSchedules = new Map(
      (previous.worldPressure?.npcSchedules ?? []).map((npc) => [npc.id, npc]),
    );
    const nextSchedules = new Map(
      (next.worldPressure?.npcSchedules ?? []).map((npc) => [npc.id, npc]),
    );
    const npcIds = new Set([
      ...previousSchedules.keys(),
      ...nextSchedules.keys(),
    ]);

    for (const npcId of npcIds) {
      const previousNpc = previousSchedules.get(npcId);
      const nextNpc = nextSchedules.get(npcId);
      if (!previousNpc || !nextNpc) {
        continue;
      }

      const fromLocationId = previousNpc.currentLocationId ?? null;
      const toLocationId = nextNpc.currentLocationId ?? null;
      const currentStopChanged =
        fromLocationId && toLocationId && fromLocationId !== toLocationId;
      const currentScheduleChanged =
        (previousNpc.currentScheduleLocationId ?? null) !==
        (nextNpc.currentScheduleLocationId ?? null);

      if (!currentStopChanged && !currentScheduleChanged) {
        continue;
      }

      const matchingRoutes = currentStopChanged
        ? routeSampleMatches({
          fromLocationId,
          npcId,
          timelineIndex: index,
          toLocationId,
        })
        : [];
      const matchingMarkers = currentStopChanged
        ? markerSampleMatches({
          fromLocationId,
          npcId,
          timelineIndex: index,
          toLocationId,
        })
        : [];
      const matchingVisualCues = currentStopChanged
        ? visualCueSampleMatches({
          fromLocationId,
          npcId,
          timelineIndex: index,
          toLocationId,
        })
        : [];
      const legalRouteEvidence = matchingRoutes.find(
        (route) =>
          route.legal &&
          route.reachesTarget &&
          route.sampledPointsLegal &&
          route.visualObstaclesClear &&
          route.unreachableSegments === 0,
      );
      const acceptedNoRouteReason =
        !currentStopChanged && fromLocationId === toLocationId
          ? "same-current-stop/no-route-needed"
          : null;
      const markerEvidence =
        summarizeScheduledNpcMarkerEvidence([
          ...matchingMarkers,
          ...matchingVisualCues,
        ]);
      const continuityGapReason = currentStopChanged
        ? !legalRouteEvidence
          ? "legal-route-not-observed-before-stop-change"
          : !markerEvidence.valid
            ? "marker-not-visible-before-stop-change"
            : null
        : null;

      changes.push({
        acceptedNoRouteReason,
        continuityGapReason,
        currentScheduleChanged,
        currentStopChanged,
        fromLabel: previous.label,
        fromLocationId,
        matchingRouteKeys: matchingRoutes.map((route) => route.key),
        markerEvidence,
        npcId,
        routeEvidenceLabel: legalRouteEvidence?.label ?? null,
        routeEvidenceKey: legalRouteEvidence?.key ?? null,
        toLabel: next.label,
        toLocationId,
        valid:
          Boolean(acceptedNoRouteReason) ||
          (Boolean(legalRouteEvidence) && markerEvidence.valid),
      });
    }
  }

  return changes;
}

function assertScheduledNpcLocationChangeAuditRegression() {
  const timeline = [
    {
      label: "before-nia-stop-change",
      worldPressure: {
        npcSchedules: [
          {
            currentLocationId: "market-square",
            currentScheduleLocationId: "market-square",
            id: "npc-nia",
          },
        ],
      },
    },
    {
      label: "after-nia-stop-change",
      worldPressure: {
        npcSchedules: [
          {
            currentLocationId: "moss-pier",
            currentScheduleLocationId: "moss-pier",
            id: "npc-nia",
          },
        ],
      },
    },
  ];
  const routeSample = {
    acceptedNoRouteReason: null,
    fromLocationId: "market-square",
    key: "npc-nia:next-scheduled-stop:market-square->moss-pier",
    legal: true,
    npcId: "npc-nia",
    pathLength: 11,
    reachesTarget: true,
    routed: true,
    sampledPointsLegal: true,
    timelineIndex: 0,
    toLocationId: "moss-pier",
    unreachableSegments: 0,
    visualObstaclesClear: true,
  };
  const visualCueSample = {
    cueKind: "next-scheduled-stop",
    cueLabel: "Nia: to Pilgrim Slip",
    cueSignal: "footfall trace and small intent notch",
    fromLocationId: "market-square",
    npcId: "npc-nia",
    onRoute: true,
    position: { x: 900, y: 720 },
    routeLegal: true,
    routePathLength: 11,
    routeProgress: 0.45,
    timelineIndex: 0.5,
    toLocationId: "moss-pier",
    visible: true,
  };
  const audit = ({ cue = visualCueSample, route = routeSample } = {}) =>
    buildScheduledNpcLocationChangeAudit({
      markerSamples: [],
      routeSamples: [route],
      timeline,
      visualCueSamples: [cue],
    })[0];

  assert.equal(
    audit().continuityGapReason,
    null,
    "A legal pre-transition next-stop cue must prove visible scheduled NPC continuity.",
  );
  assert.equal(
    audit({ cue: { ...visualCueSample, cueKind: "local-schedule-round" } })
      .continuityGapReason,
    "marker-not-visible-before-stop-change",
    "A local patrol cue must not stand in for cross-location NPC movement.",
  );
  assert.equal(
    audit({ cue: { ...visualCueSample, timelineIndex: 1.5 } })
      .continuityGapReason,
    "marker-not-visible-before-stop-change",
    "A cue first observed after the location change must not prove continuity.",
  );
  assert.equal(
    audit({ cue: { ...visualCueSample, onRoute: false } })
      .continuityGapReason,
    "marker-not-visible-before-stop-change",
    "An off-route cue must not prove continuity.",
  );
  assert.equal(
    audit({ route: { ...routeSample, legal: false } }).continuityGapReason,
    "legal-route-not-observed-before-stop-change",
    "An illegal route must remain a scheduled NPC continuity gap.",
  );
}

function summarizeScheduledNpcMarkerEvidence(samples) {
  const usableSamples = samples.filter(isUsableScheduledNpcSpatialSample);
  const hasValidVisualCue = usableSamples.some(
    isValidScheduledNpcVisualCueSample,
  );
  const progressValues = usableSamples.map((sample) => sample.routeProgress);
  const progressRange =
    progressValues.length > 0
      ? Math.max(...progressValues) - Math.min(...progressValues)
      : 0;
  let maxPositionDelta = 0;

  for (let leftIndex = 0; leftIndex < usableSamples.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < usableSamples.length;
      rightIndex += 1
    ) {
      maxPositionDelta = Math.max(
        maxPositionDelta,
        pointDistance(
          usableSamples[leftIndex].position,
          usableSamples[rightIndex].position,
        ),
      );
    }
  }

  return {
    labels: usableSamples.map((sample) => sample.label),
    maxDistanceToRoute:
      usableSamples.length > 0
        ? Math.max(
            ...usableSamples.map((sample) => sample.distanceToRoute ?? 0),
          )
        : null,
    maxPositionDelta: roundAuditNumber(maxPositionDelta),
    progressRange: roundAuditNumber(progressRange),
    sampleCount: usableSamples.length,
    valid:
      (hasValidVisualCue && usableSamples.length >= 1) ||
      (usableSamples.length >= 2 &&
        (progressRange >= 0.015 || maxPositionDelta >= 12)),
  };
}

function assertMovementAuditSummary(movementAudit) {
  assert.ok(
    movementAudit.playerRoutes.length >= 4,
    "Expected summary route diagnostics for route start and mid-route frames.",
  );
  assert.ok(
    movementAudit.playerRoutes.every(
      (route) =>
        route.legal &&
        route.reachesDestination &&
        route.sampledPointsLegal &&
        route.visualObstaclesClear &&
        route.tilePathLength >= 2 &&
        route.worldPathLength >= 2,
    ),
    "Expected every exported player route diagnostic to be legal, obstacle-clear, and at least two points.",
  );
  assertOpeningPlayerLocationGeometrySample(
    movementAudit,
    "initial-morrow-exterior",
  );
  assertPlayerRouteContinuityLedger(
    movementAudit.playerRouteContinuityLedger,
  );

  const patrolByLocationId = new Map(
    movementAudit.npcPatrols.map((patrol) => [patrol.locationId, patrol]),
  );
  for (const locationId of REQUIRED_NPC_PATROL_LOCATION_IDS) {
    const patrol = patrolByLocationId.get(locationId);
    assert.ok(patrol, `Expected summary NPC diagnostics for ${locationId}.`);
    assert.equal(
      patrol.allRouted,
      true,
      `Expected summary NPC diagnostics for ${locationId} to be routed.`,
    );
    assert.equal(
      patrol.maxUnreachableSegments,
      0,
      `Expected summary NPC diagnostics for ${locationId} to avoid unreachable shortcuts.`,
    );
    assert.ok(
      patrol.minPathLength > 1,
      `Expected summary NPC diagnostics for ${locationId} to have a non-empty route.`,
    );
  }

  const actionableScheduledRoutes = movementAudit.scheduledNpcRoutes.filter(
    (route) => !route.acceptedNoRouteReason,
  );
  assert.ok(
    actionableScheduledRoutes.length >= 2,
    `Expected at least two named scheduled NPC route samples, got ${actionableScheduledRoutes.length}.`,
  );
  assert.ok(
    actionableScheduledRoutes.every(
      (route) =>
        route.allLegal &&
        route.allRoutedOrAccepted &&
        route.maxUnreachableSegments === 0 &&
        route.minPathLength > 1,
    ),
    `Expected named scheduled NPC route samples to be legal, routed, and obstacle-clear: ${JSON.stringify(
      actionableScheduledRoutes,
      null,
      2,
    )}`,
  );

  const stopChanges = movementAudit.scheduledNpcLocationChanges.filter(
    (change) => change.currentStopChanged,
  );
  assert.ok(
    stopChanges.length >= 1,
    "Expected browser evidence for at least one named NPC current-stop change during the run.",
  );
  assert.ok(
    stopChanges.some((change) => change.markerEvidence?.valid),
    `Expected at least one scheduled NPC current-stop transition to include visible marker movement along the scheduled route: ${JSON.stringify(
      stopChanges,
      null,
      2,
    )}`,
  );
  assert.ok(
    movementAudit.scheduledNpcVisualCueSamples.some(
      isValidScheduledNpcVisualCueSample,
    ),
    `Expected at least one scheduled NPC movement cue to be visible in player-facing browser evidence: ${JSON.stringify(
      movementAudit.scheduledNpcVisualCueSamples.slice(0, 8),
      null,
      2,
    )}`,
  );
  assert.ok(
    movementAudit.scheduledNpcLocationChanges.every((change) => change.valid),
    `A scheduled NPC current-stop/schedule change lacked route evidence, visible marker movement evidence, or an accepted no-route explanation: ${JSON.stringify(
      movementAudit.scheduledNpcLocationChanges.filter(
        (change) => !change.valid,
      ),
      null,
      2,
    )}`,
  );
}

function assertPlayerRouteContinuityLedger(ledger) {
  assert.ok(
    ledger,
    "Expected a reusable player route continuity ledger in movement audit output.",
  );
  assert.ok(
    ledger.entries.length >= 2,
    `Expected the player route continuity ledger to capture route phase groups, got ${ledger.entries.length}.`,
  );
  assert.deepEqual(
    ledger.gaps,
    [],
    `Player route continuity ledger found route gaps: ${JSON.stringify(
      ledger.gaps,
      null,
      2,
    )}`,
  );

  const missingRequiredCoverage = ledger.requiredCoverage.filter(
    (entry) => entry.status === "missing",
  );
  assert.deepEqual(
    missingRequiredCoverage,
    [],
    `Player route continuity ledger is missing required route or settled-phase coverage: ${JSON.stringify(
      missingRequiredCoverage,
      null,
      2,
    )}`,
  );
}

function assertCityEventState(label, game) {
  const cafePrep = findCityEvent(game, "event-cafe-prep");
  const lunchRush = findCityEvent(game, "event-lunch-rush");
  const marketCrossing = findCityEvent(game, "event-market-crossing");

  assert.ok(cafePrep, `${label}: missing cafe-prep city event.`);
  assert.ok(lunchRush, `${label}: missing lunch-rush city event.`);
  assert.ok(marketCrossing, `${label}: missing market-crossing city event.`);

  if (label === "initial-morrow-exterior") {
    assert.equal(
      cafePrep.status,
      "active",
      `${label}: cafe-prep event should be active at the start.`,
    );
    assert.equal(
      marketCrossing.status,
      "active",
      `${label}: market-crossing event should be active at the start.`,
    );
  }

  if (label === "hold-for-shift") {
    assert.equal(
      lunchRush.status,
      "active",
      `${label}: lunch-rush event should be active as Rowan waits for the rush.`,
    );
    assert.equal(
      lunchRush.progress,
      "rush",
      `${label}: lunch-rush event should be at the rush progress marker.`,
    );
  }

  if (label === "lunch-rush") {
    assert.equal(
      lunchRush.status,
      "active",
      `${label}: lunch-rush event should stay active through counter work.`,
    );
    assert.equal(
      lunchRush.progress,
      "counter",
      `${label}: lunch-rush event should reach the counter progress marker.`,
    );
  }

  if (label === "first-afternoon-complete") {
    assert.equal(
      lunchRush.status,
      "resolved",
      `${label}: lunch-rush event should resolve by the end of the regression.`,
    );
    assert.equal(
      lunchRush.progress,
      "paid",
      `${label}: lunch-rush event should end at the paid progress marker.`,
    );
  }
}

function assertRectsDoNotOverlap(
  label,
  firstRect,
  secondRect,
  firstName,
  secondName,
) {
  assert.ok(firstRect, `${label}: missing ${firstName} layout bounds.`);
  assert.ok(secondRect, `${label}: missing ${secondName} layout bounds.`);

  const overlaps =
    firstRect.left < secondRect.right &&
    firstRect.right > secondRect.left &&
    firstRect.top < secondRect.bottom &&
    firstRect.bottom > secondRect.top;

  assert.equal(
    overlaps,
    false,
    `${label}: ${firstName} overlaps ${secondName}. ${firstName}=${JSON.stringify(
      firstRect,
    )} ${secondName}=${JSON.stringify(secondRect)}`,
  );
}

function assertRectInsideViewport(label, rect, name, viewport) {
  assert.ok(rect, `${label}: missing ${name} layout bounds.`);
  assert.ok(viewport, `${label}: missing viewport bounds.`);

  assert.ok(
    rect.left >= -1 &&
      rect.top >= -1 &&
      rect.right <= viewport.width + 1 &&
      rect.bottom <= viewport.height + 1,
    `${label}: ${name} is cut off by the viewport. ${name}=${JSON.stringify(
      rect,
    )} viewport=${JSON.stringify(viewport)}`,
  );
}

function assertRectInsideRect(label, rect, containerRect, name, containerName) {
  assert.ok(rect, `${label}: missing ${name} layout bounds.`);
  assert.ok(containerRect, `${label}: missing ${containerName} layout bounds.`);

  assert.ok(
    rect.left >= containerRect.left - 1 &&
      rect.top >= containerRect.top - 1 &&
      rect.right <= containerRect.right + 1 &&
      rect.bottom <= containerRect.bottom + 1,
    `${label}: ${name} is cut off by ${containerName}. ${name}=${JSON.stringify(
      rect,
    )} ${containerName}=${JSON.stringify(containerRect)}`,
  );
}

function assertRectHorizontallyInsideRect(
  label,
  rect,
  containerRect,
  name,
  containerName,
) {
  assert.ok(rect, `${label}: missing ${name} layout bounds.`);
  assert.ok(containerRect, `${label}: missing ${containerName} layout bounds.`);

  assert.ok(
    rect.left >= containerRect.left - 1 &&
      rect.right <= containerRect.right + 1,
    `${label}: ${name} overflows ${containerName} horizontally. ${name}=${JSON.stringify(
      rect,
    )} ${containerName}=${JSON.stringify(containerRect)}`,
  );
}

function assertNoAncestorClipping(label, clippedBy, name) {
  assert.deepEqual(
    clippedBy ?? [],
    [],
    `${label}: ${name} is cut off by an ancestor container: ${JSON.stringify(
      clippedBy,
    )}`,
  );
}

function assertNoDocumentOverflow(label, documentLayout) {
  assert.ok(documentLayout, `${label}: missing document layout bounds.`);
  assert.ok(
    documentLayout.scrollWidth <= documentLayout.clientWidth + 1,
    `${label}: document has horizontal overflow (${documentLayout.scrollWidth} > ${documentLayout.clientWidth}).`,
  );
  assert.ok(
    documentLayout.scrollHeight <= documentLayout.clientHeight + 1,
    `${label}: document has vertical overflow (${documentLayout.scrollHeight} > ${documentLayout.clientHeight}).`,
  );
}

function assertCriticalVisualCoherence(label, dom, options = {}) {
  const layout = dom.layout ?? {};
  const viewport = layout.viewport;

  assertNoDocumentOverflow(label, layout.document);
  assertRectInsideViewport(label, layout.timePill, "time HUD", viewport);
  assertRectInsideViewport(label, layout.dockPanel, "dock panel", viewport);
  assertRectInsideViewport(label, layout.rightStack, "right rail", viewport);
  assertNoAncestorClipping(
    label,
    layout.clippingAncestors?.timePill,
    "time HUD",
  );
  assertNoAncestorClipping(
    label,
    layout.clippingAncestors?.dockPanel,
    "dock panel",
  );
  assertNoAncestorClipping(
    label,
    layout.clippingAncestors?.rightStack,
    "right rail",
  );
  assertRectsDoNotOverlap(
    label,
    layout.timePill,
    layout.dockPanel,
    "time HUD",
    "dock panel",
  );

  if (options.expectFocusWindow) {
    assertRectInsideViewport(
      label,
      layout.focusWindow,
      "focus panel",
      viewport,
    );
    assertNoAncestorClipping(
      label,
      layout.clippingAncestors?.focusWindow,
      "focus panel",
    );
    assertRectsDoNotOverlap(
      label,
      layout.timePill,
      layout.focusWindow,
      "time HUD",
      "focus panel",
    );
    assertRectsDoNotOverlap(
      label,
      layout.focusWindow,
      layout.dockPanel,
      "focus panel",
      "dock panel",
    );
    assertRectsDoNotOverlap(
      label,
      layout.focusWindow,
      layout.rightStack,
      "focus panel",
      "right rail",
    );

    assertRectInsideRect(
      label,
      layout.focusBody,
      layout.focusWindow,
      "focus body",
      "focus panel",
    );
    const fieldNotes = layout.fieldNotes ?? [];
    for (const fieldNote of fieldNotes) {
      assertRectHorizontallyInsideRect(
        label,
        fieldNote.rect,
        layout.focusBody,
        `field note ${fieldNote.key ?? "unknown"}`,
        "focus body",
      );
    }
    if (fieldNotes.length > 0) {
      assert.ok(
        fieldNotes.some(
          (fieldNote) =>
            fieldNote.rect?.bottom > layout.focusBody.top + 1 &&
            fieldNote.rect?.top < layout.focusBody.bottom - 1,
        ),
        `${label}: scrollable focus body does not expose any field note in its visible viewport.`,
      );
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNotebookUsesCognitionAuthority(label, dom, probe) {
  const notebook = probe?.rowanCognition?.notebook;
  assert.ok(
    notebook,
    `${label}: expected browser probe to expose Rowan cognition Notebook authority.`,
  );

  const normalizedBody = dom.bodyText.replace(/\s+/g, " ");
  const fields = [
    ["belief", notebook.belief],
    ["plan", notebook.plan],
    ["confidence", notebook.confidence],
    ["uncertainty", notebook.uncertainty],
  ];

  for (const [field, value] of fields) {
    const snippet = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 72);
    assert.ok(
      snippet.length >= 12,
      `${label}: cognition Notebook ${field} should be meaningful.`,
    );
    assert.match(
      normalizedBody,
      new RegExp(escapeRegExp(snippet), "i"),
      `${label}: visible Notebook ${field} did not match Rowan cognition authority.`,
    );
  }

  assert.ok(
    notebook.authority?.primaryNeedKey ||
      notebook.authority?.beliefId ||
      notebook.authority?.nextMoveRationale,
    `${label}: cognition Notebook authority should identify the need, belief, or next move source.`,
  );
  assert.doesNotMatch(
    normalizedBody,
    /\b(worldPressure|cityEvents|jobWindows|npcSchedules|npcPressureMoves|planningTrace|routeKey)\b/i,
    `${label}: player-facing Notebook should not leak backend-shaped debug labels.`,
  );
  assertNotebookFreshForLateObjective(label, normalizedBody, notebook, probe);
}

const STALE_LATE_NOTEBOOK_AUTHORITY_PATTERN =
  /Keep a stable room|Mara is the person most likely|Enter Morrow House|tonight's bed|bed feel less temporary|turning temporary again/i;

function assertNotebookFreshForLateObjective(
  label,
  normalizedBody,
  notebook,
  probe,
) {
  const lateNiaLeadVisible =
    /Talk to Nia next while there is still time/i.test(normalizedBody) ||
    /Ask Nia where the block is about to jam/i.test(normalizedBody) ||
    /Jo's clue points toward Nia/i.test(normalizedBody);
  const postFirstAfternoonShiftVisible =
    Boolean(probe?.firstAfternoon?.completionAcknowledgedAt) ||
    (Boolean(probe?.firstAfternoon?.completedAt) &&
      /rest|recover|yard work|Morrow Yard pump|live pressure|Ask Nia|block is about to jam/i.test(
        normalizedBody,
      ));
  if (!lateNiaLeadVisible && !postFirstAfternoonShiftVisible) {
    return;
  }

  const notebookText = [
    notebook.title,
    notebook.belief,
    notebook.clue,
    notebook.plan,
    notebook.uncertainty,
  ]
    .filter(Boolean)
    .join(" ");

  assert.doesNotMatch(
    notebookText,
    STALE_LATE_NOTEBOOK_AUTHORITY_PATTERN,
    `${label}: late Notebook stayed anchored to stale opening room/shelter authority after the objective shifted.`,
  );
  assert.doesNotMatch(
    normalizedBody,
    /Morrow House is where Rowan can let today's standing settle|runs himself flat|tonight's bed|room stays mine/i,
    `${label}: late rail/body mixed the objective shift with stale Morrow House standing rationale.`,
  );
  assertLateNotebookMatchesCurrentPressure(label, notebook, probe);
  assert.notEqual(
    notebook.authority?.notebookNeedKey,
    "shelter",
    `${label}: late Notebook should not keep shelter as the active need after the objective shifted to rest/live pressure.`,
  );
  assert.notEqual(
    notebook.authority?.primaryNeedKey,
    "shelter",
    `${label}: late Notebook should not keep shelter as the hidden primary need after the objective shifted to rest/live pressure.`,
  );
}

function assertLateNotebookMatchesCurrentPressure(label, notebook, probe) {
  const notebookText = compactNotebookText(notebook);
  assert.match(
    notebookText,
    /Evidence|Confirmed|Promising|Possible|field note|Tomas|pump|Nia|Jo|Ada/i,
    `${label}: late Notebook should expose evidence and confidence, got ${JSON.stringify(notebook)}.`,
  );
  const routeKey = probe?.objective?.routeKey ?? "";
  const focus = probe?.objective?.focus ?? "";
  const objectiveText = probe?.objective?.text ?? "";
  const selectedText = [
    probe?.autonomy?.label,
    probe?.autonomy?.detail,
    probe?.autonomy?.planningTrace?.selectedPressureKind,
    probe?.autonomy?.planningTrace?.selectedPressureLabel,
    probe?.autonomy?.planningTrace?.selectedMatchedOutcomeId,
  ]
    .filter(Boolean)
    .join(" ");
  const currentPressureText = [
    routeKey,
    focus,
    objectiveText,
    selectedText,
    notebookText,
  ].join(" ");

  if (routeKey === "rest-home" || focus === "rest") {
    assert.match(
      notebookText,
      /rest|recover|energy|field note|yard work|pump|live pressure/i,
      `${label}: post-first-afternoon rest Notebook should explain recovery and the next live pressure, got ${JSON.stringify(notebook)}.`,
    );
    assert.doesNotMatch(
      notebook.plan ?? "",
      /^Enter Morrow House$/i,
      `${label}: rest Notebook plan should not expose the low-level entry action as Rowan's current plan.`,
    );
    return;
  }

  if (/work-yard|yard|freight|Tomas/i.test(currentPressureText)) {
    assert.match(
      notebookText,
      /yard|work|Tomas|freight|income|paid/i,
      `${label}: late Notebook should reflect the current yard-work pressure, got ${JSON.stringify(notebook)}.`,
    );
    assert.doesNotMatch(
      notebook?.plan ?? "",
      /^Exit to South Quay$/i,
      `${label}: yard-work Notebook plan should name the yard plan, not the low-level street exit.`,
    );
    assert.doesNotMatch(
      notebook?.plan ?? "",
      /^Head to North Crane Yard\b/i,
      `${label}: yard-work Notebook plan should name Tomas/freight-window obligation, not just a route command.`,
    );
    assert.equal(
      yardNotebookPlanNamesCommitment(notebook?.plan),
      true,
      `${label}: yard-work Notebook plan should name Tomas, the freight window, or the accepted freight job, got ${JSON.stringify(notebook)}.`,
    );
    return;
  }

  if (
    /help-pump|tool-pump|pump|wrench|Morrow Yard/i.test(currentPressureText)
  ) {
    assert.match(
      notebookText,
      /pump|wrench|tool|Morrow Yard|house problem/i,
      `${label}: late Notebook should reflect the current pump/tool pressure, got ${JSON.stringify(notebook)}.`,
    );
    return;
  }

  if (/Nia|block|jam|cart|square/i.test(currentPressureText)) {
    assert.match(
      notebookText,
      /Nia|Jo|block|jam|square/i,
      `${label}: late Notebook should reflect the current Nia/block-jam lead, got ${JSON.stringify(notebook)}.`,
    );
    return;
  }

  assert.match(
    notebookText,
    /field note|rest|recover|yard|pump|work|Nia|block|live pressure|current/i,
    `${label}: late Notebook should explain the current post-first-afternoon pressure, got ${JSON.stringify(notebook)}.`,
  );
}

function yardNotebookPlanNamesCommitment(plan) {
  return /Tomas|freight(?:\s|-)?window|freight yard lift/i.test(plan ?? "");
}

function compactNotebookText(notebook) {
  return [
    notebook?.title,
    notebook?.belief,
    notebook?.clue,
    notebook?.confidence,
    notebook?.plan,
    notebook?.uncertainty,
  ]
    .filter(Boolean)
    .join(" ");
}

async function closeInhabitFocusPanel(session, label) {
  const before = await session.readDomSnapshot();
  const closeTarget =
    await session.readVisibleElementRect("[data-close-focus]");
  if (!closeTarget) {
    return {
      activeTab: before.activeTab,
      clicked: false,
    };
  }

  await session.dispatchMouseClick(
    closeTarget.rect.centerX,
    closeTarget.rect.centerY,
  );
  const closed = await waitFor(
    async () => {
      const target = await session.readVisibleElementRect("[data-close-focus]");
      if (target) {
        return null;
      }
      return session.readDomSnapshot();
    },
    5_000,
    `${label}: focus panel did not close before map interaction.`,
  );

  return {
    activeTab: closed.activeTab,
    clicked: true,
  };
}

function buildTimelineEntry({
  camera,
  dom,
  game,
  label,
  mapAgency,
  probe,
  screenshot,
  screenshotError,
}) {
  return {
    activeConversation: probe.activeConversation,
    autonomy: probe.autonomy,
    cityEvents: {
      active: probe.cityEvents ?? [],
      sim: simCityEventSnapshot(game),
    },
    camera: camera ?? null,
    clock: probe.clock,
    dom: dom
      ? {
          activeTab: dom.activeTab,
          actionLabels: dom.actionLabels,
          bodyTextSample: dom.bodyTextSample,
          canvasRect: dom.canvasRect,
          fieldNotes: dom.fieldNotes,
          fieldNoteText: dom.fieldNoteText,
          hasFieldNote: dom.hasFieldNote,
          layout: dom.layout,
          tabLabels: dom.tabLabels,
          visibleProgressionControls: dom.visibleProgressionControls,
        }
      : null,
    label,
    location: probe.location,
    mapAgency: mapAgency ?? null,
    movement: probe.movement ?? null,
    objective: probe.objective,
    rail: probe.rail,
    screenshot,
    screenshotError: screenshotError ?? null,
    firstAfternoon: probe.firstAfternoon ?? null,
    independentNpcActions: probe.independentNpcActions ?? [],
    independentNpcSurface: probe.independentNpcSurface ?? null,
    visualEventCues: probe.visualEventCues ?? [],
    visualPlayer: probe.visualPlayer,
    watchMode: probe.watchMode ?? null,
    aiRuntime: probe.aiRuntime ?? null,
    worldPressure: probe.worldPressure ?? null,
    sim: {
      currentTime: game.currentTime,
      energy: game.player.energy,
      fieldNote: game.firstAfternoon?.fieldNote ?? null,
      inventory: game.player.inventory.map((item) => ({
        id: item.id,
        name: item.name,
      })),
      leadFieldNote: game.firstAfternoon?.leadFieldNote ?? null,
      locationId: game.player.currentLocationId,
      money: game.player.money,
      teaShiftStage: game.firstAfternoon?.teaShiftStage ?? null,
    },
  };
}

async function captureBrowserState({ game, index, label, session }) {
  const initialProbe = await session.waitForGame(game);
  assertBrowserProbeMatchesGame(label, game, initialProbe, {
    allowPendingPlayback: true,
  });
  assertCityEventState(label, game);
  const dom = await waitForGameplayDom(label, session, initialProbe, game);
  const probe = await refreshProbeForVisibleIndependentNpcSurface({
    label,
    probe: initialProbe,
    session,
  });
  assertBrowserProbeMatchesGame(label, game, probe, {
    allowPendingPlayback: true,
  });
  const mapAgency = await session.readMapAgencyProbe();
  const camera = await session.readCameraProbe();
  assertGameplayDom(label, game, probe, dom);

  const key = `${String(index).padStart(2, "0")}-${slug(label)}`;
  const screenshotPath = path.join(OUTPUT_DIR, `${key}.png`);
  let screenshot = null;
  let screenshotError = null;

  if (shouldCaptureScreenshot(label)) {
    try {
      await session.captureScreenshot(screenshotPath);
      screenshot = screenshotPath;
    } catch (error) {
      screenshotError =
        error instanceof Error ? error.message : "Screenshot capture failed.";
      await writeFile(
        path.join(OUTPUT_DIR, `${key}.screenshot-error.txt`),
        `${screenshotError}\n`,
        "utf8",
      );
      if (REQUIRE_SCREENSHOTS) {
        throw error;
      }
    }
  }

  return {
    camera,
    dom,
    mapAgency,
    probe,
    screenshot,
    screenshotError,
  };
}

async function captureBrowserMovementState({
  captureScreenshot = true,
  game,
  index,
  label,
  probe,
  session,
}) {
  assertBrowserProbeMatchesGame(label, game, probe, {
    allowVisualMove: true,
  });
  assertCityEventState(label, game);
  assertPlayerRouteDiagnostics(label, probe);
  if ((game.activeSpaceId ?? game.player.spaceId) === "street:south-quay") {
    assertRequiredNpcPatrolDiagnostics(label, probe);
  }
  const expectedTargetLocationId = game.rowanAutonomy?.targetLocationId ?? null;
  let mapAgency = null;
  if (expectedTargetLocationId) {
    try {
      mapAgency = await session.waitForMapAgencyProbe({
        currentLocationId: game.player.currentLocationId ?? null,
        targetLocationId: expectedTargetLocationId,
      });
    } catch {
      mapAgency = await session.readMapAgencyProbe();
    }
  } else {
    mapAgency = await session.readMapAgencyProbe();
  }
  const camera = await session.readCameraProbe();

  const key = `${String(index).padStart(2, "0")}-${slug(label)}`;
  const screenshotPath = path.join(OUTPUT_DIR, `${key}.png`);
  let screenshot = null;
  let screenshotError = null;

  if (captureScreenshot && shouldCaptureScreenshot(label)) {
    try {
      await session.captureScreenshot(screenshotPath);
      screenshot = screenshotPath;
    } catch (error) {
      screenshotError =
        error instanceof Error ? error.message : "Screenshot capture failed.";
      await writeFile(
        path.join(OUTPUT_DIR, `${key}.screenshot-error.txt`),
        `${screenshotError}\n`,
        "utf8",
      );
      if (REQUIRE_SCREENSHOTS) {
        throw error;
      }
    }
  }

  return {
    camera,
    dom: null,
    mapAgency,
    probe,
    screenshot,
    screenshotError,
  };
}

async function captureProbeState({ game, label }) {
  const probe = buildProbeFromGame(game);
  assertBrowserProbeMatchesGame(label, game, probe);
  assertCityEventState(label, game);

  return {
    camera: null,
    dom: null,
    mapAgency: null,
    probe,
    screenshot: null,
    screenshotError: null,
  };
}

async function runAutoplayObservation(session) {
  const url = `${getWebBase()}?new=1&autoplayRegression=${Date.now()}`;
  const pacingLedgerPath = path.join(
    OUTPUT_DIR,
    "autoplay-observation-pacing-ledger.json",
  );
  const pacingSamples = [];
  let pacingCompleted = false;
  let pacingFailure = null;
  let lastSampleAt = 0;
  let lastDomAuditAt = 0;
  let lastProbeSignature = null;
  const pacingStartedAt = Date.now();
  await session.navigate(url);
  const startProbe = await session.readAutoplayPacingProbe();
  const startDom = await session
    .readAutoplayDomAudit("fresh-autoplay-observation:start-dom")
    .catch(() => null);
  assert.equal(
    startProbe.watchMode?.enabled,
    true,
    "Fresh autoplay observation did not start in watch mode.",
  );
  assert.notEqual(
    startProbe.watchMode?.status,
    "frozen",
    "Fresh autoplay observation unexpectedly started frozen.",
  );
  pacingSamples.push(
    sampleAutoplayObservationSample({
      dom: startDom,
      elapsedMs: Date.now() - pacingStartedAt,
      probe: startProbe,
    }),
  );
  lastSampleAt = Date.now();
  lastDomAuditAt = lastSampleAt;
  lastProbeSignature = autoplayObservationSignature(pacingSamples.at(-1));

  const screenshotPath = path.join(
    OUTPUT_DIR,
    "autoplay-observation-complete.png",
  );
  let completedProbe = null;
  let dom = null;

  try {
    const completion = await waitFor(
      async () => {
        const probe = await session.readAutoplayPacingProbe();
        let sampleDom = null;
        const now = Date.now();
        const probeSample = sampleAutoplayObservationSample({
          dom: null,
          elapsedMs: now - pacingStartedAt,
          probe,
        });
        const probeSignature = autoplayObservationSignature(probeSample);
        const probeChanged = probeSignature !== lastProbeSignature;
        const shouldAuditDom =
          probeChanged ||
          now - lastDomAuditAt >= AUTOPLAY_DOM_AUDIT_INTERVAL_MS;
        const shouldSample =
          probeChanged ||
          (shouldAuditDom &&
            now - lastSampleAt >= AUTOPLAY_PACING_SAMPLE_INTERVAL_MS);

        if (shouldSample) {
          if (shouldAuditDom) {
            sampleDom = await session
              .readAutoplayDomAudit("fresh-autoplay-observation:dom-audit")
              .catch(() => null);
            lastDomAuditAt = now;
          }
          pacingSamples.push(
            sampleAutoplayObservationSample({
              dom: sampleDom,
              elapsedMs: now - pacingStartedAt,
              probe,
            }),
          );
          lastSampleAt = now;
          lastProbeSignature = probeSignature;
        }

        if (
          probe?.firstAfternoon?.completedAt ||
          /first afternoon complete/i.test(probe?.autonomy?.label ?? "")
        ) {
          return { probe };
        }
        return null;
      },
      AUTOPLAY_OBSERVATION_TIMEOUT_MS,
      "Autoplay did not reach first-afternoon completion without manual advance clicks.",
      AUTOPLAY_PACING_SAMPLE_INTERVAL_MS,
    );
    completedProbe = completion.probe;
    dom = await session.readDomSnapshot(
      "fresh-autoplay-observation:final-dom",
    );
    const completedSample = sampleAutoplayObservationSample({
      dom,
      elapsedMs: Date.now() - pacingStartedAt,
      probe: completedProbe,
    });
    if (
      pacingSamples.length === 0 ||
      pacingSamples.at(-1)?.clock?.iso !== completedSample.clock?.iso ||
      pacingSamples.at(-1)?.autonomy?.label !== completedSample.autonomy?.label
    ) {
      pacingSamples.push(completedSample);
    }

    assertNoVisibleWatchModeProgressionControls(
      "fresh-autoplay-observation",
      completedProbe,
      dom,
    );
    assert.doesNotMatch(
      dom.bodyText,
      /Nudge Rowan/i,
      "Fresh autoplay observation still exposes Nudge Rowan copy.",
    );
    assert.doesNotMatch(
      dom.bodyText,
      /\{"message":|"message"\s*:\s*"Game\s+game-|Game\s+game-[A-Za-z0-9-]+\s+was not found/i,
      "Fresh autoplay observation exposed a raw missing-game backend error.",
    );
    assert.equal(
      completedProbe.watchMode?.enabled,
      true,
      "Completed autoplay observation lost watch-mode diagnostics.",
    );
    if (completedProbe.autonomy?.planningTrace) {
      assertVisibleDecisionArtifactPayload(
        "fresh-autoplay-observation",
        completedProbe.autonomy.visibleDecisionArtifact,
      );
      assertVisibleDecisionNextCheckForTrace(
        "fresh-autoplay-observation",
        completedProbe.autonomy.planningTrace,
        completedProbe.autonomy.visibleDecisionArtifact,
      );
      assertVisibleDecisionSelectedActionMatchesImmediateStep(
        "fresh-autoplay-observation",
        completedProbe.autonomy.planningTrace,
        completedProbe.autonomy.visibleDecisionArtifact,
        completedProbe.autonomy,
      );
      assertVisibleDecisionArtifactDom(
        "fresh-autoplay-observation",
        dom,
        completedProbe.autonomy.visibleDecisionArtifact,
      );
    }
    assert.ok(
      completedProbe.clock.totalMinutes > startProbe.clock.totalMinutes,
      "Autoplay observation did not advance game time.",
    );

    const pacingLedger = buildAutoplayObservationPacingLedger(pacingSamples);
    await session.captureScreenshot(screenshotPath);
    await writeFile(
      pacingLedgerPath,
      `${JSON.stringify(
        {
          ...pacingLedger,
          screenshot: screenshotPath,
          status: "passed",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    assertAutoplayObservationPacingLedger(pacingLedger, pacingLedgerPath);
    pacingCompleted = true;

    return {
      completed: {
        autonomyLabel: completedProbe.autonomy?.label ?? null,
        clock: completedProbe.clock,
        firstAfternoon: completedProbe.firstAfternoon,
        gameId: completedProbe.gameId,
        location: completedProbe.location,
        visibleDecisionArtifact:
          completedProbe.autonomy?.visibleDecisionArtifact ?? null,
        watchMode: completedProbe.watchMode,
      },
      pacingLedger: {
        approaches: pacingLedger.approachSamples.find(
          (sample) => sample.approaches.length >= 2,
        )?.approaches ?? [],
        diagnosticsPath: pacingLedgerPath,
        firstDecisionAppElapsedMs: pacingLedger.firstDecisionAppElapsedMs,
        firstDecisionElapsedMs: pacingLedger.firstDecisionElapsedMs,
        firstInteractionElapsedMs: pacingLedger.firstInteractionElapsedMs,
        idleGapLimitMs: AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS,
        maxInAppGapMs: pacingLedger.maxInAppGapMs,
        maxObserverGapMs: pacingLedger.maxIdleGapMs,
        meaningfulBeatCount: pacingLedger.meaningfulBeatCount,
        meaningfulProvenanceCount:
          pacingLedger.meaningfulActionSamples.length,
        naturalStop: pacingLedger.naturalStop,
        progressKinds: pacingLedger.progressKinds,
        progressionClicks: 0,
        trajectory: {
          consequence: completedProbe.firstAfternoon?.consequence ?? null,
          interactionNpcIds: [
            ...new Set(
              pacingLedger.samples
                .map((sample) => sample.activeConversation?.npcId)
                .filter(Boolean),
            ),
          ],
          selectedTargets: [
            ...new Set(
              pacingLedger.meaningfulActionSamples
                .map((sample) => sample.autonomy?.targetLocationId)
                .filter(Boolean),
            ),
          ],
        },
      },
      screenshot: screenshotPath,
      start: {
        autonomyLabel: startProbe.autonomy?.label ?? null,
        clock: startProbe.clock,
        gameId: startProbe.gameId,
        watchMode: startProbe.watchMode,
      },
    };
  } catch (error) {
    pacingFailure = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    if (!pacingCompleted) {
      const partialLedger = buildAutoplayObservationPacingLedger(pacingSamples);
      await writeFile(
        pacingLedgerPath,
        `${JSON.stringify(
          {
            ...partialLedger,
            failure: pacingFailure,
            screenshot: completedProbe ? screenshotPath : null,
            status: "failed",
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      if (completedProbe) {
        await session.captureScreenshot(screenshotPath).catch(() => undefined);
      }
    }
  }
}

async function runUnavailableNpcCrossLayerCheck(session) {
  let game = await createGame();
  game = await runGameCommand(game.id, { type: "move_to", x: 16, y: 9 });
  const targetMinutes = 18 * 60 + 30;
  for (let attempt = 0; attempt < 12 && game.clock.totalMinutes < targetMinutes; attempt += 1) {
    game = await runGameCommand(game.id, {
      minutes: Math.max(1, targetMinutes - game.clock.totalMinutes),
      silent: true,
      type: "wait",
    });
  }
  assert.ok(
    game.clock.totalMinutes >= targetMinutes,
    `Controlled Jo schedule state stopped before 18:30: ${JSON.stringify(game.clock)}`,
  );
  await session.navigate(browserUrl(game.id));
  const probe = await waitForInhabitSettled(
    session,
    "unavailable-jo-cross-layer",
  );
  const dom = await session.readDomSnapshot("unavailable-jo-cross-layer-dom");
  const joSchedule = (probe.worldPressure?.npcSchedules ?? []).find(
    (npc) => npc.id === "npc-jo",
  );
  const sceneNpcIds = (probe.scene?.people ?? []).map((npc) => npc.id);
  const visibleMarkerNpcIds = (
    probe.scene?.visibleScheduledNpcMarkers ?? []
  ).map((marker) => marker.npcId);

  assert.equal(
    joSchedule?.availability,
    "unavailable",
    `Jo must be schedule-unavailable after 18:00: ${JSON.stringify(joSchedule)}`,
  );
  assert.equal(
    joSchedule?.currentLocationId,
    "repair-stall",
    "Controlled F1 state must retain Jo's stale repair-stall location while schedule availability is unavailable.",
  );
  assert.equal(
    probe.location?.id,
    "repair-stall",
    "Controlled F1 state must place Rowan at Mercer Repairs so stale location equality is exercised.",
  );
  assert.equal(sceneNpcIds.includes("npc-jo"), false);
  assert.equal(visibleMarkerNpcIds.includes("npc-jo"), false);
  assert.equal((dom.nearbyNpcIds ?? []).includes("npc-jo"), false);
  assert.doesNotMatch(dom.nearbyText ?? "", /\bJo\b/i);

  const screenshot = path.join(OUTPUT_DIR, "unavailable-jo-cross-layer.png");
  await session.captureScreenshot(screenshot);
  const evidence = {
    clock: probe.clock,
    joSchedule,
    nearbyNpcIds: dom.nearbyNpcIds ?? [],
    playerLocation: probe.location,
    sceneNpcIds,
    screenshot,
    visibleMarkerNpcIds,
  };
  const evidencePath = path.join(
    OUTPUT_DIR,
    "unavailable-jo-cross-layer.json",
  );
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { ...evidence, evidencePath };
}

async function runObserveOnlyCarryForwardObservation(session) {
  const url = `${getWebBase()}?new=1&autoplay=0&observe=1&observeCarryForward=${Date.now()}`;
  await session.navigate(url);
  const startProbe = await session.readBrowserProbe();
  const carryForward = startProbe.openingActionCarryForward;
  assert.equal(
    startProbe.watchMode?.enabled,
    true,
    "Observe-only run did not enter watch mode.",
  );
  assert.equal(
    carryForward?.watchMode?.autoplayEnabled,
    false,
    "Observe-only run unexpectedly reported autoplay enabled.",
  );
  assert.equal(
    carryForward?.requiredVisibleInput,
    false,
    "Observe-only run reported watch mode but still required visible input.",
  );
  assert.ok(
    startProbe.autonomy?.autoContinue || carryForward?.selectedActionId,
    "Observe-only run did not expose a selected Rowan carry-forward action.",
  );

  const startSignature = playerProbeSignature(startProbe);
  const progressedProbe = await waitFor(
    async () => {
      const probe = await session.readBrowserProbe();
      if (!probe || probe.gameId !== startProbe.gameId) {
        return null;
      }
      const nextCarryForward = probe.openingActionCarryForward;
      const signatureChanged = playerProbeSignature(probe) !== startSignature;
      const progressionStarted =
        probe.visualPlayer?.isMovingToServerState ||
        probe.movement?.playerRoute?.active ||
        probe.activeConversation ||
        probe.clock?.totalMinutes > startProbe.clock.totalMinutes ||
        nextCarryForward?.status === "in_progress" ||
        nextCarryForward?.status === "completed";
      return signatureChanged && progressionStarted ? probe : null;
    },
    35_000,
    "Observe-only watch mode exposed a recommended action but did not carry it forward.",
  );
  const dom = await session.readDomSnapshot();
  assertNoVisibleWatchModeProgressionControls(
    "observe-only-carry-forward",
    progressedProbe,
    dom,
  );

  const screenshotPath = path.join(
    OUTPUT_DIR,
    "observe-only-carry-forward.png",
  );
  await session.captureScreenshot(screenshotPath);

  return {
    progressed: {
      activeConversation: progressedProbe.activeConversation ?? null,
      autonomyLabel: progressedProbe.autonomy?.label ?? null,
      clock: progressedProbe.clock,
      gameId: progressedProbe.gameId,
      location: progressedProbe.location,
      openingActionCarryForward:
        progressedProbe.openingActionCarryForward ?? null,
      visualPlayer: progressedProbe.visualPlayer ?? null,
      watchMode: progressedProbe.watchMode,
    },
    screenshot: screenshotPath,
    start: {
      autonomyLabel: startProbe.autonomy?.label ?? null,
      clock: startProbe.clock,
      gameId: startProbe.gameId,
      openingActionCarryForward: carryForward ?? null,
      watchMode: startProbe.watchMode,
    },
  };
}

const STALE_HISTORICAL_FIELD_NOTE_NEXT_PATTERNS = [
  /NEXT\s+The first afternoon is settled; rest at Morrow House and decide which lead deserves tomorrow morning\./i,
  /NEXT\s+Sleep on the first foothold, then decide whether tomorrow starts with Ada's lead or the dock board\./i,
];

function assertHistoricalFieldNoteNextDemoted(label, dom) {
  const bodyText = dom.bodyText?.replace(/\s+/g, " ").trim() ?? "";

  for (const stalePattern of STALE_HISTORICAL_FIELD_NOTE_NEXT_PATTERNS) {
    assert.doesNotMatch(
      bodyText,
      stalePattern,
      `${label}: historical field-note guidance should not be presented under a live-looking NEXT label.`,
    );
  }

  if (
    /Ask Nia where the block is about to jam|Talk to Nia next while there is still time|Jo's clue points toward Nia/i.test(
      bodyText,
    )
  ) {
    assert.match(
      bodyText,
      /AT THE TIME\s+The first afternoon is settled; rest at Morrow House and decide which lead deserves tomorrow morning\./i,
      `${label}: historical lead field-note guidance should be labeled as recorded-at-the-time context in the late Nia state.`,
    );
    if (label === "overlay-debug") {
      assert.match(
        bodyText,
        /AT THE TIME\s+Rest on the first foothold, then choose between the yard work window and the Morrow Yard pump before the city moves on without Rowan\./i,
        `${label}: final first-afternoon field-note guidance should be demoted in the late Nia debug view.`,
      );
    }
  }
}

async function runOverlayPanelChecks(session) {
  const checks = [];

  const panels = [
    {
      label: "overlay-notebook",
      selector: '[data-tab="mind"]',
      expectedTab: "mind",
      expectedText: [
        /Rowan's Notebook/i,
        /Current Belief/i,
        /Current Plan/i,
        /City Pulse/i,
        /South Quay is moving/i,
      ],
      rejectedText: [
        /worldPressure/i,
        /cityEvents/i,
        /jobWindows/i,
        /npcSchedules|npcPressureMoves/i,
      ],
    },
    {
      label: "overlay-journal",
      selector: '[data-tab="journal"]',
      expectedTab: "journal",
      expectedText: [
        /Journal/i,
        /Field Note/i,
        /Mara's lead verified/i,
        /First afternoon settled/i,
      ],
      rejectedText: [
        /Make the rounds and talk to everyone\./i,
        /Buy a wrench and fix the pump\./i,
        /Figure out where I can stay beyond tonight\./i,
        /Learn the lanes and meet people\./i,
        /Meet people who could become friends in South Quay\./i,
      ],
    },
  ];

  for (const panel of panels) {
    const clicked = await session.clickSelector(panel.selector);
    assert.equal(
      clicked,
      true,
      `${panel.label}: expected ${panel.selector} to be clickable.`,
    );
    await sleep(300);

    const dom = await session.readDomSnapshot();
    assert.equal(
      dom.activeTab,
      panel.expectedTab,
      `${panel.label}: expected ${panel.expectedTab} tab to be active.`,
    );
    for (const expectedText of panel.expectedText) {
      assert.match(
        dom.bodyText,
        expectedText,
        `${panel.label}: expected panel content was not rendered.`,
      );
    }
    for (const rejectedText of panel.rejectedText ?? []) {
      assert.doesNotMatch(
        dom.bodyText,
        rejectedText,
        `${panel.label}: manual objective seeds should not be presented as live objective outcomes.`,
      );
    }
    if (panel.expectedTab === "journal") {
      assertHistoricalFieldNoteNextDemoted(panel.label, dom);
    }
    assertCriticalVisualCoherence(panel.label, dom, {
      expectFocusWindow: true,
    });

    if (panel.expectedTab === "mind") {
      const probe = await session.readBrowserProbe();
      assertNotebookUsesCognitionAuthority(panel.label, dom, probe);
    }

    const screenshot = path.join(OUTPUT_DIR, `${panel.label}.png`);
    await session.captureScreenshot(screenshot);
    checks.push({
      activeTab: dom.activeTab,
      bodyTextSample: dom.bodyTextSample,
      label: panel.label,
      layout: dom.layout,
      screenshot,
    });
  }

  await session.clickSelector("[data-close-focus]");
  await sleep(150);
  const openedDebug = await session.clickSelector("[data-toggle-support]");
  assert.equal(
    openedDebug,
    true,
    "overlay-debug: expected More debug toggle to be clickable.",
  );
  await sleep(300);
  await session.evaluate(`(() => {
    document.querySelector('.ml-debug-panel')?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    });
  })()`);
  await sleep(200);
  const debugDom = await session.readDomSnapshot();
  assert.match(
    debugDom.bodyText,
    /Debug/i,
    "overlay-debug: expected debug section in More panel.",
  );
  assert.match(
    debugDom.bodyText,
    /AI: (Live|Fallback|Not called)/i,
    "overlay-debug: expected AI runtime status in More panel.",
  );
  assert.match(
    debugDom.bodyText,
    /Planner trace/i,
    "overlay-debug: expected planner trace to be available only in More panel.",
  );
  assert.doesNotMatch(
    debugDom.bodyText,
    /already (?:picked|chose)|confirms? the route|confirmation of (?:the )?route|instead of changing course|preselected route|route-control|needs the street route|street route from|street route before asking/i,
    "overlay-debug: default rail copy behind More leaked route-control wording.",
  );
  if (
    /Talk to Nia next while there is still time|Ask Nia where the block is about to jam|Jo's clue points toward Nia/i.test(
      debugDom.bodyText,
    )
  ) {
    assert.doesNotMatch(
      debugDom.bodyText,
      /Build standing at Morrow House so the room stays mine|room stays mine|Morrow House standing built|Rest for an hour at Morrow House|Head to Morrow House|tonight's bed/i,
      "overlay-debug: late Nia objective leaked stale Morrow House standing directive text.",
    );
  }
  assertHistoricalFieldNoteNextDemoted("overlay-debug", debugDom);
  const debugScreenshot = path.join(OUTPUT_DIR, "overlay-debug.png");
  await session.captureScreenshot(debugScreenshot);
  checks.push({
    activeTab: debugDom.activeTab,
    bodyTextSample: debugDom.bodyTextSample,
    label: "overlay-debug",
    layout: debugDom.layout,
    screenshot: debugScreenshot,
  });

  return checks;
}

function playerGameProgressSignature(probe) {
  return JSON.stringify({
    activeConversation: probe.activeConversation
      ? {
          lines: probe.activeConversation.lines,
          npcId: probe.activeConversation.npcId,
        }
      : null,
    autonomy: {
      key: probe.autonomy?.key ?? null,
      label: probe.autonomy?.label ?? null,
      mode: probe.autonomy?.mode ?? null,
      stepKind: probe.autonomy?.stepKind ?? null,
      targetLocationId: probe.autonomy?.targetLocationId ?? null,
    },
    clock: probe.clock?.iso ?? null,
    firstAfternoon: probe.firstAfternoon ?? null,
    location: probe.location ?? null,
  });
}

function playerProbeSignature(probe) {
  return JSON.stringify({
    gameProgress: playerGameProgressSignature(probe),
    playback: probe.playback ?? null,
    visualPlayer: probe.visualPlayer ?? null,
  });
}

function assertWatchPacingTransitionSignatureGuard() {
  const gameProbe = {
    activeConversation: null,
    autonomy: {
      key: "return-home",
      label: "Return to Morrow House to take stock",
      mode: "acting",
      stepKind: "move",
      targetLocationId: "boarding-house",
    },
    clock: { iso: "2026-03-21T15:03:00.000Z" },
    firstAfternoon: { completedAt: null },
    location: { id: "tea-house", spaceId: "street:south-quay" },
    playback: { activeKind: "move", queuedCount: 0 },
    visualPlayer: { isMovingToServerState: true, waypointNonce: 4 },
  };
  const visuallySettledProbe = {
    ...gameProbe,
    playback: { activeKind: null, queuedCount: 0 },
    visualPlayer: { isMovingToServerState: false, waypointNonce: 5 },
  };

  assert.equal(
    playerGameProgressSignature(visuallySettledProbe),
    playerGameProgressSignature(gameProbe),
    "Visual route settlement must not count as autonomous game progress.",
  );
  assert.notEqual(
    playerProbeSignature(visuallySettledProbe),
    playerProbeSignature(gameProbe),
    "The full browser signature must still detect visual route settlement.",
  );
}

function assertAutoplayProgressGapGuard() {
  const samples = [
    {
      appMonotonicMs: 1_000,
      autonomy: { label: "Choose a route" },
      elapsedMs: 1_000,
    },
    {
      appMonotonicMs: 6_000,
      autonomy: { label: "Choose a route" },
      elapsedMs: 7_000,
    },
    {
      appMonotonicMs: 15_000,
      autonomy: { label: "On the way" },
      elapsedMs: 17_000,
    },
  ];
  const gaps = buildAutoplayObservationProgressGaps(samples, [
    {
      progressKinds: ["decision-artifact"],
      toElapsedMs: 7_000,
    },
    {
      progressKinds: ["route-progress"],
      toElapsedMs: 17_000,
    },
  ]);

  assert.deepEqual(
    gaps.map((gap) => ({
      appDurationMs: gap.appDurationMs,
      durationMs: gap.durationMs,
    })),
    [{ appDurationMs: 14_000, durationMs: 16_000 }],
    "Autoplay pacing must accumulate non-progress transitions and keep observer latency out of the product-visible clock.",
  );
  assert.ok(
    gaps[0].appDurationMs <= AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS,
    "An app-visible gap inside the pacing budget must pass even when observer latency crosses the budget.",
  );
  assert.ok(
    gaps[0].durationMs > AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS,
    "The observer fixture must exercise latency beyond the product-visible pacing budget.",
  );

  const overBudgetGaps = buildAutoplayObservationProgressGaps(
    [
      { appMonotonicMs: 0, autonomy: { label: "Choose" }, elapsedMs: 0 },
      {
        appMonotonicMs: AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS + 1,
        autonomy: { label: "Move" },
        elapsedMs: AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS - 1,
      },
    ],
    [
      {
        progressKinds: ["route-progress"],
        toElapsedMs: AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS - 1,
      },
    ],
  );
  assert.ok(
    overBudgetGaps[0].appDurationMs > AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS,
    "An over-budget app-visible gap must remain a product pacing failure even when observer time is shorter.",
  );
}

function inhabitCameraDelta(before, after) {
  return {
    x:
      Math.round(((after?.scroll?.x ?? 0) - (before?.scroll?.x ?? 0)) * 100) /
      100,
    y:
      Math.round(((after?.scroll?.y ?? 0) - (before?.scroll?.y ?? 0)) * 100) /
      100,
  };
}

function inhabitCameraPanRange(probe) {
  const range = probe?.scrollRange;
  if (
    !range ||
    typeof range.minX !== "number" ||
    typeof range.maxX !== "number" ||
    typeof range.minY !== "number" ||
    typeof range.maxY !== "number"
  ) {
    return null;
  }

  return {
    x: Math.max(0, Number((range.maxX - range.minX).toFixed(2))),
    y: Math.max(0, Number((range.maxY - range.minY).toFixed(2))),
  };
}

function inhabitCameraHasMeaningfulPanRange(probe) {
  const range = inhabitCameraPanRange(probe);
  if (!range) {
    return true;
  }

  return (
    range.x >= INHABIT_CAMERA_MEANINGFUL_PAN_RANGE_PX ||
    range.y >= INHABIT_CAMERA_MEANINGFUL_PAN_RANGE_PX
  );
}

function buildWatchPacingAudit(clickLog) {
  const watchedBeats = clickLog
    .filter((entry) => entry.kind === "watched-auto-continue")
    .map((entry) => ({
      appDurationMs: entry.appDurationMs ?? null,
      autoContinueElapsedAtProbeMs:
        entry.autoContinueElapsedAtProbeMs ?? null,
      autoContinueIntendedDelayMs:
        entry.autoContinueIntendedDelayMs ?? null,
      autoContinueKey: entry.autoContinueKey ?? null,
      beforeAutonomyLabel: entry.beforeAutonomyLabel ?? null,
      completionAutoContinue: Boolean(entry.completionAutoContinue),
      durationMs: entry.durationMs ?? null,
      fullAppDurationMs: entry.fullAppDurationMs ?? null,
      milestone: entry.milestone,
      sequenceRunId: entry.sequenceRunId ?? null,
    }));
  const openingFirstActionBeats = watchedBeats.filter(
    (entry) =>
      entry.milestone === "entered-morrow-house" &&
      /enter morrow house/i.test(entry.beforeAutonomyLabel ?? ""),
  );
  const ordinaryBeats = watchedBeats.filter(
    (entry) =>
      !entry.completionAutoContinue && !openingFirstActionBeats.includes(entry),
  );
  const ordinaryDurations = ordinaryBeats
    .map((entry) => entry.fullAppDurationMs)
    .filter((duration) => typeof duration === "number");
  const ordinaryIntendedDelays = ordinaryBeats
    .map((entry) => entry.autoContinueIntendedDelayMs)
    .filter((duration) => typeof duration === "number");
  const readableFloorMs = 2_600;
  const measurementToleranceMs = 150;
  const measuredReadableFloorMs = readableFloorMs - measurementToleranceMs;
  const missingOrdinaryTimingBeats = ordinaryBeats.filter(
    (entry) =>
      typeof entry.fullAppDurationMs !== "number" ||
      typeof entry.autoContinueIntendedDelayMs !== "number",
  );
  const shortOrdinaryBeats = ordinaryBeats.filter(
    (entry) =>
      (typeof entry.fullAppDurationMs === "number" &&
        entry.fullAppDurationMs < measuredReadableFloorMs) ||
      (typeof entry.autoContinueIntendedDelayMs === "number" &&
        entry.autoContinueIntendedDelayMs < measuredReadableFloorMs),
  );

  return {
    missingOrdinaryTimingBeats,
    openingFirstActionBeats,
    ordinaryBeatCount: ordinaryBeats.length,
    ordinaryMinIntendedDelayMs:
      ordinaryIntendedDelays.length > 0
        ? Math.min(...ordinaryIntendedDelays)
        : null,
    ordinaryMinDurationMs:
      ordinaryDurations.length > 0 ? Math.min(...ordinaryDurations) : null,
    measuredReadableFloorMs,
    measurementToleranceMs,
    readableFloorMs,
    shortOrdinaryBeats,
    watchedBeats,
  };
}

function assertReadableFirstAfternoonDwell(entry, label) {
  assert.equal(
    typeof entry.autoContinueIntendedDelayMs,
    "number",
    `${label} did not expose its configured autoplay dwell.`,
  );
  assert.ok(
    entry.autoContinueIntendedDelayMs >= FIRST_AFTERNOON_MIN_VISIBLE_DWELL_MS,
    `${label} configured autoplay dwell was too short: ${entry.autoContinueIntendedDelayMs}ms.`,
  );
  assert.equal(
    typeof entry.fullAppDurationMs,
    "number",
    `${label} did not expose a full app-visible dwell measurement.`,
  );
  assert.ok(
    entry.fullAppDurationMs >= FIRST_AFTERNOON_MIN_VISIBLE_DWELL_MS,
    `${label} was too fast to read: ${entry.fullAppDurationMs}ms app-visible dwell (${entry.durationMs ?? 0}ms observed after the harness attached).`,
  );
}

function remainingFirstAfternoonReadabilityCheckpointMs(elapsedMs) {
  const observedElapsedMs =
    typeof elapsedMs === "number" && Number.isFinite(elapsedMs)
      ? Math.max(0, elapsedMs)
      : 0;
  return Math.max(
    0,
    FIRST_AFTERNOON_READABILITY_CHECKPOINT_MS - observedElapsedMs,
  );
}

function sampleAutoplayObservationSample({ dom, elapsedMs, probe }) {
  const visibleDecisionArtifact =
    probe?.autonomy?.visibleDecisionArtifact ??
    probe?.rail?.visibleDecisionArtifact ??
    null;
  return {
    activity: {
      autoContinue: probe?.timing?.autoContinue
        ? {
            elapsedMs: probe.timing.autoContinue.elapsedMs ?? null,
            intendedDelayMs:
              probe.timing.autoContinue.intendedDelayMs ?? null,
            key: probe.timing.autoContinue.key ?? null,
          }
        : null,
      busyLabel: probe?.busyLabel ?? null,
    },
    appMonotonicMs: probe?.timing?.appMonotonicMs ?? null,
    activeConversation: probe?.activeConversation
      ? {
          lines: probe.activeConversation.lines ?? null,
          npcId: probe.activeConversation.npcId ?? null,
          npcName: probe.activeConversation.npcName ?? null,
        }
      : null,
    autonomy: probe?.autonomy
      ? {
          actionId: probe.autonomy.actionId ?? null,
          autoContinue: Boolean(probe.autonomy.autoContinue),
          label: probe.autonomy.label ?? null,
          mode: probe.autonomy.mode ?? null,
          stepKind: probe.autonomy.stepKind ?? null,
          targetLocationId: probe.autonomy.targetLocationId ?? null,
        }
      : null,
    bodyTextSample: compactObjectiveSequenceText(
      dom?.bodyTextSample ?? dom?.bodyText ?? "",
      260,
    ),
    clock: probe?.clock ?? null,
    elapsedMs,
    firstAfternoon: {
      approachesKnownAt: probe?.firstAfternoon?.approachesKnownAt ?? null,
      completedAt: probe?.firstAfternoon?.completedAt ?? null,
      completionAcknowledgedAt:
        probe?.firstAfternoon?.completionAcknowledgedAt ?? null,
      hasFieldNote: Boolean(probe?.firstAfternoon?.hasFieldNote),
      hasLeadFieldNote: Boolean(probe?.firstAfternoon?.hasLeadFieldNote),
      consequence: probe?.firstAfternoon?.consequence ?? null,
      teaShiftStage: probe?.firstAfternoon?.teaShiftStage ?? null,
    },
    genericCarryForwardCopyVisible: GENERIC_WATCH_CTA_COPY_PATTERN.test(
      dom?.bodyText ?? "",
    ),
    location: probe?.location ?? null,
    movement: {
      routeActive: Boolean(probe?.movement?.playerRoute?.active),
      routeProgress:
        typeof probe?.movement?.playerRoute?.progress === "number"
          ? roundAuditNumber(probe.movement.playerRoute.progress)
          : null,
    },
    objective: {
      focus: probe?.objective?.focus ?? null,
      progressLabel: probe?.objective?.progress?.label ?? null,
      routeKey: probe?.objective?.routeKey ?? null,
      text: compactObjectiveSequenceText(probe?.objective?.text ?? "", 140),
    },
    planningTrace: probe?.autonomy?.planningTrace ?? null,
    playback: {
      activeKey: probe?.playback?.activeKey ?? null,
      activeKind: probe?.playback?.activeKind ?? null,
      activeTitle: probe?.playback?.activeTitle ?? null,
      justHappened: probe?.playback?.justHappened ?? null,
      queuedCount: probe?.playback?.queuedCount ?? 0,
    },
    progressControls: dom?.visibleProgressionControls ?? [],
    replyAffordances: dom?.watchModeReplyAffordances ?? [],
    visibleDecisionArtifact: compactVisibleDecisionArtifact(
      visibleDecisionArtifact,
    ),
    watchMode: probe?.watchMode ?? null,
    worldPressure: compactWorldPressureSnapshot(probe?.worldPressure ?? null),
  };
}

function autoplayObservationSignature(sample) {
  return JSON.stringify({
    activeConversation: sample.activeConversation,
    activity: {
      autoContinue: sample.activity?.autoContinue
        ? {
            intendedDelayMs:
              sample.activity.autoContinue.intendedDelayMs ?? null,
            key: sample.activity.autoContinue.key ?? null,
          }
        : null,
      busyLabel: sample.activity?.busyLabel ?? null,
    },
    autonomy: sample.autonomy,
    firstAfternoon: sample.firstAfternoon,
    location: sample.location,
    movement: sample.movement,
    objective: sample.objective,
    playback: sample.playback,
    visibleDecisionArtifact: sample.visibleDecisionArtifact,
    worldPressure: sample.worldPressure,
  });
}

function buildAutoplayObservationPacingLedger(samples) {
  const normalizedSamples = [];
  let previousSignature = null;

  for (const sample of samples ?? []) {
    const signature = autoplayObservationSignature(sample);
    if (signature === previousSignature) {
      continue;
    }
    normalizedSamples.push(sample);
    previousSignature = signature;
  }

  const transitions = [];
  for (let index = 1; index < normalizedSamples.length; index += 1) {
    const previous = normalizedSamples[index - 1];
    const next = normalizedSamples[index];
    const progressKinds = classifyAutoplayObservationProgress(previous, next);
    const appDurationMs =
      typeof previous.appMonotonicMs === "number" &&
      typeof next.appMonotonicMs === "number"
        ? Math.max(0, next.appMonotonicMs - previous.appMonotonicMs)
        : null;
    const observerDurationMs = Math.max(0, next.elapsedMs - previous.elapsedMs);
    transitions.push({
      appDurationMs,
      durationMs: observerDurationMs,
      fromAutonomyLabel: previous.autonomy?.label ?? null,
      fromClock: previous.clock ?? null,
      fromElapsedMs: previous.elapsedMs,
      fromLocationId: previous.location?.id ?? null,
      progressKinds,
      observerLatencyMs:
        appDurationMs === null
          ? null
          : Math.max(0, observerDurationMs - appDurationMs),
      toAutonomyLabel: next.autonomy?.label ?? null,
      toClock: next.clock ?? null,
      toElapsedMs: next.elapsedMs,
      toLocationId: next.location?.id ?? null,
    });
  }

  const decisionSample = normalizedSamples.find(
    (sample) => sample.visibleDecisionArtifact,
  );
  const nonDecisionTransitions = transitions.filter((transition) =>
    transition.progressKinds.some((kind) => kind !== "decision-artifact"),
  );
  const firstPostDecisionTransition =
    decisionSample === undefined
      ? null
      : nonDecisionTransitions.find(
          (transition) => transition.toElapsedMs > decisionSample.elapsedMs,
        ) ?? null;
  const progressKinds = [
    ...new Set(
      nonDecisionTransitions.flatMap((transition) => transition.progressKinds),
    ),
  ];
  const progressGaps = buildAutoplayObservationProgressGaps(
    normalizedSamples,
    transitions,
  );
  const idleGapMs = progressGaps.map((gap) => gap.durationMs);
  const appIdleGapMs = progressGaps
    .map((gap) => gap.appDurationMs)
    .filter((duration) => typeof duration === "number");
  const firstAppMonotonicMs = normalizedSamples.find(
    (sample) => typeof sample.appMonotonicMs === "number",
  )?.appMonotonicMs;
  const meaningfulActionSamples = uniqueMeaningfulAutonomousActionSamples(
    normalizedSamples,
  );
  const incompleteProvenanceSamples = meaningfulActionSamples.filter(
    (sample) => !hasCompleteValidatedPlannerProvenance(sample),
  );
  const approachSamples = normalizedSamples.map((sample) => ({
    approaches: viableFirstAfternoonApproaches(sample),
    elapsedMs: sample.elapsedMs,
  }));
  const finalSample = normalizedSamples.at(-1) ?? null;

  return {
    approachSamples,
    firstDecisionAppElapsedMs:
      decisionSample && typeof firstAppMonotonicMs === "number" &&
      typeof decisionSample.appMonotonicMs === "number"
        ? Math.max(0, decisionSample.appMonotonicMs - firstAppMonotonicMs)
        : null,
    firstDecisionElapsedMs: decisionSample?.elapsedMs ?? null,
    firstInteractionElapsedMs:
      normalizedSamples.find((sample) => sample.activeConversation)?.elapsedMs ??
      null,
    firstMeaningfulProgressAfterDecisionMs:
      decisionSample && firstPostDecisionTransition
        ? Math.max(0, firstPostDecisionTransition.toElapsedMs - decisionSample.elapsedMs)
        : null,
    genericCarryForwardSamples: (samples ?? []).filter(
      (sample) => sample.genericCarryForwardCopyVisible,
    ),
    incompleteProvenanceSamples,
    meaningfulActionSamples,
    maxInAppGapMs:
      appIdleGapMs.length > 0 ? Math.max(...appIdleGapMs) : null,
    maxIdleGapMs: idleGapMs.length > 0 ? Math.max(...idleGapMs) : null,
    naturalStop: Boolean(
      finalSample?.firstAfternoon?.completedAt &&
        finalSample?.firstAfternoon?.consequence &&
        finalSample?.autonomy?.autoContinue === false,
    ),
    meaningfulBeatCount: nonDecisionTransitions.length,
    progressKinds,
    progressGaps,
    repeatedPeopleRecoveryCycles:
      findRepeatedPeopleRecoveryCycles(normalizedSamples),
    samples: normalizedSamples,
    transitions,
    visibleProgressionControlSamples: (samples ?? []).filter(
      (sample) => (sample.progressControls?.length ?? 0) > 0,
    ),
    watchModeReplyAffordanceSamples: (samples ?? []).filter(
      (sample) => (sample.replyAffordances?.length ?? 0) > 0,
    ),
  };
}

function buildAutoplayObservationProgressGaps(samples, transitions) {
  if ((samples?.length ?? 0) === 0) {
    return [];
  }

  const gaps = [];
  let previousProgressSample = samples[0];
  for (let index = 0; index < transitions.length; index += 1) {
    const transition = transitions[index];
    if (!transition.progressKinds.some((kind) => kind !== "decision-artifact")) {
      continue;
    }

    const nextSample = samples[index + 1];
    const appDurationMs =
      typeof previousProgressSample.appMonotonicMs === "number" &&
      typeof nextSample?.appMonotonicMs === "number"
        ? Math.max(
            0,
            nextSample.appMonotonicMs - previousProgressSample.appMonotonicMs,
          )
        : null;
    gaps.push({
      appDurationMs,
      durationMs: Math.max(
        0,
        (nextSample?.elapsedMs ?? transition.toElapsedMs) -
          previousProgressSample.elapsedMs,
      ),
      fromAutonomyLabel: previousProgressSample.autonomy?.label ?? null,
      fromElapsedMs: previousProgressSample.elapsedMs,
      progressKinds: transition.progressKinds,
      toAutonomyLabel: nextSample?.autonomy?.label ?? null,
      toElapsedMs: nextSample?.elapsedMs ?? transition.toElapsedMs,
    });
    previousProgressSample = nextSample;
  }

  return gaps;
}

function viableFirstAfternoonApproaches(sample) {
  const jobs = (sample.worldPressure?.jobWindows ?? [])
    .filter(
      (job) =>
        job.discovered && !job.completed && !job.missed,
    )
    .map((job) => job.id);
  const problems = (sample.worldPressure?.problems ?? [])
    .filter((problem) => problem.discovered && problem.status === "active")
    .map((problem) => problem.id);
  return [...new Set([...jobs, ...problems])];
}

function uniqueMeaningfulAutonomousActionSamples(samples) {
  const byKey = new Map();
  for (const sample of samples ?? []) {
    const trace = sample.planningTrace;
    const actionId = trace?.selectedActionId ?? sample.autonomy?.actionId;
    if (!actionId || sample.autonomy?.mode === "idle") {
      continue;
    }
    const key = [
      trace?.selectedPlanKey,
      actionId,
      sample.activeConversation?.npcId,
      sample.autonomy?.targetLocationId,
    ].join("|");
    if (!byKey.has(key)) {
      byKey.set(key, sample);
    }
  }
  return [...byKey.values()];
}

function hasCompleteValidatedPlannerProvenance(sample) {
  const trace = sample.planningTrace;
  const recommendation = trace?.selectedRecommendation;
  const selected = selectedPlanningTraceOption(trace);
  const legalBacking = trace?.selectedLegalBacking ?? selected?.legalBacking;
  const sourceKind = recommendation?.sourceKind;
  return Boolean(
    trace &&
      sample.objective?.text &&
      Array.isArray(trace.blockers) &&
      Array.isArray(trace.considered) &&
      trace.considered.length > 0 &&
      Array.isArray(trace.rejected) &&
      trace.selectedActionId &&
      (selected?.rationale || recommendation?.rationale) &&
      legalBacking?.source &&
      recommendation &&
      ["live-llm", "deterministic-planner", "deterministic-fallback"].includes(
        sourceKind,
      ) &&
      recommendation.validationStatus !== "unvalidated" &&
      recommendation.validationSource &&
      recommendation.legalBackingSource,
  );
}

function findRepeatedPeopleRecoveryCycles(samples) {
  const phases = [];
  for (const sample of samples ?? []) {
    const isPeopleObjective =
      sample.objective?.focus === "people" ||
      sample.objective?.routeKey?.startsWith("people-");
    const isRecovery =
      sample.autonomy?.actionId === "rest:home" ||
      sample.objective?.routeKey === "rest-home" ||
      /\b(rest|recover|recovery)\b/i.test(sample.autonomy?.label ?? "");
    const phase = isRecovery
      ? {
          kind: "recovery",
          clock: sample.clock,
          elapsedMs: sample.elapsedMs,
        }
      : isPeopleObjective
        ? {
            kind: "people",
            clock: sample.clock,
            elapsedMs: sample.elapsedMs,
            signature: JSON.stringify({
              progressLabel: sample.objective?.progressLabel ?? null,
              routeKey: sample.objective?.routeKey ?? null,
              text: sample.objective?.text ?? null,
            }),
          }
        : null;
    if (!phase) {
      continue;
    }

    const previous = phases.at(-1);
    if (
      previous?.kind === phase.kind &&
      (phase.kind !== "people" || previous.signature === phase.signature)
    ) {
      continue;
    }
    phases.push(phase);
  }

  const returnsBySignature = new Map();
  const repeated = [];
  for (let index = 2; index < phases.length; index += 1) {
    const before = phases[index - 2];
    const recovery = phases[index - 1];
    const after = phases[index];
    if (
      before.kind !== "people" ||
      recovery.kind !== "recovery" ||
      after.kind !== "people" ||
      before.signature !== after.signature
    ) {
      continue;
    }

    const returnCount = (returnsBySignature.get(after.signature) ?? 0) + 1;
    returnsBySignature.set(after.signature, returnCount);
    if (returnCount >= 2) {
      repeated.push({ after, before, recovery, returnCount });
    }
  }

  return repeated;
}

function classifyAutoplayObservationProgress(previous, next) {
  const progressKinds = [];
  const previousRouteProgress = previous.movement?.routeProgress ?? null;
  const nextRouteProgress = next.movement?.routeProgress ?? null;
  if (
    (!previous.visibleDecisionArtifact && next.visibleDecisionArtifact) ||
    previous.visibleDecisionArtifact?.selectedAction !==
      next.visibleDecisionArtifact?.selectedAction ||
    previous.visibleDecisionArtifact?.objective !==
      next.visibleDecisionArtifact?.objective
  ) {
    progressKinds.push("decision-artifact");
  }
  if (
    previous.playback?.activeKey !== next.playback?.activeKey ||
    previous.playback?.activeTitle !== next.playback?.activeTitle ||
    previous.playback?.justHappened !== next.playback?.justHappened
  ) {
    progressKinds.push("playback-progress");
  }
  if (
    previous.location?.id !== next.location?.id ||
    previous.location?.spaceId !== next.location?.spaceId ||
    (typeof previousRouteProgress === "number" &&
      typeof nextRouteProgress === "number" &&
      nextRouteProgress - previousRouteProgress >= 0.12)
  ) {
    progressKinds.push("route-progress");
  }
  if (
    (previous.activeConversation?.npcId ?? null) !==
      (next.activeConversation?.npcId ?? null) ||
    (previous.activeConversation?.lines ?? null) !==
      (next.activeConversation?.lines ?? null)
  ) {
    progressKinds.push("conversation-progress");
  }
  if (
    previous.objective?.routeKey !== next.objective?.routeKey ||
    previous.objective?.progressLabel !== next.objective?.progressLabel ||
    previous.objective?.text !== next.objective?.text ||
    previous.firstAfternoon?.teaShiftStage !== next.firstAfternoon?.teaShiftStage
  ) {
    progressKinds.push("objective-progress");
  }
  if (
    previous.firstAfternoon?.hasLeadFieldNote !==
      next.firstAfternoon?.hasLeadFieldNote ||
    previous.firstAfternoon?.hasFieldNote !==
      next.firstAfternoon?.hasFieldNote ||
    previous.firstAfternoon?.completedAt !== next.firstAfternoon?.completedAt ||
    previous.firstAfternoon?.completionAcknowledgedAt !==
      next.firstAfternoon?.completionAcknowledgedAt
  ) {
    progressKinds.push("memory-progress");
  }
  if (
    JSON.stringify(previous.worldPressure) !== JSON.stringify(next.worldPressure)
  ) {
    progressKinds.push("world-pressure-progress");
  }
  if (
    previous.clock?.totalMinutes !== next.clock?.totalMinutes &&
    !progressKinds.some((kind) =>
      [
        "route-progress",
        "conversation-progress",
        "objective-progress",
        "memory-progress",
        "world-pressure-progress",
      ].includes(kind),
    )
  ) {
    progressKinds.push("reasoned-time-jump");
  }
  return [...new Set(progressKinds)];
}

function assertAutoplayObservationPacingLedger(ledger, diagnosticsPath) {
  assert.ok(
    ledger.firstDecisionElapsedMs !== null &&
      ledger.firstDecisionElapsedMs <= AUTOPLAY_PACING_OPENING_DECISION_TIMEOUT_MS,
    `Fresh autoplay did not show a visible decision artifact quickly enough. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      {
        firstDecisionElapsedMs: ledger.firstDecisionElapsedMs,
        sampleCount: ledger.samples.length,
      },
      null,
      2,
    )}`,
  );
  assert.ok(
    ledger.firstDecisionAppElapsedMs === null ||
      ledger.firstDecisionAppElapsedMs <=
        AUTOPLAY_PACING_OPENING_DECISION_TIMEOUT_MS,
    `Fresh autoplay app timing did not show a decision within ${AUTOPLAY_PACING_OPENING_DECISION_TIMEOUT_MS}ms. Diagnostics: ${diagnosticsPath}.`,
  );
  assert.ok(
    ledger.firstMeaningfulProgressAfterDecisionMs !== null &&
      ledger.firstMeaningfulProgressAfterDecisionMs <=
        AUTOPLAY_PACING_ACTION_FOLLOWTHROUGH_TIMEOUT_MS,
    `Fresh autoplay did not turn the opening decision into visible follow-through quickly enough. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      {
        firstMeaningfulProgressAfterDecisionMs:
          ledger.firstMeaningfulProgressAfterDecisionMs,
        transitions: ledger.transitions.slice(0, 6),
      },
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.genericCarryForwardSamples.length,
    0,
    `Fresh autoplay surfaced generic carry-forward copy during momentum sampling. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.genericCarryForwardSamples,
      null,
      2,
    )}`,
  );
  assert.ok(
    ledger.approachSamples.some((sample) => sample.approaches.length >= 2),
    `Fresh autoplay never exposed two viable first-afternoon approaches at once. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(ledger.approachSamples, null, 2)}`,
  );
  assert.ok(
    ledger.firstInteractionElapsedMs !== null,
    `Fresh autoplay completed without a visible NPC interaction. Diagnostics: ${diagnosticsPath}.`,
  );
  assert.equal(
    ledger.incompleteProvenanceSamples.length,
    0,
    `Fresh autoplay meaningful actions had missing or unvalidated planner provenance. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(ledger.incompleteProvenanceSamples, null, 2)}`,
  );
  assert.equal(
    ledger.naturalStop,
    true,
    `Fresh autoplay did not end at a natural completed stop with a durable consequence. Diagnostics: ${diagnosticsPath}.`,
  );
  assert.equal(
    ledger.visibleProgressionControlSamples.length,
    0,
    `Fresh autoplay exposed visible progression/action controls during momentum sampling. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.visibleProgressionControlSamples,
      null,
      2,
    )}`,
  );
  assert.equal(
    ledger.watchModeReplyAffordanceSamples.length,
    0,
    `Fresh autoplay exposed reply/action-looking conversation affordances during momentum sampling. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.watchModeReplyAffordanceSamples,
      null,
      2,
    )}`,
  );
  assert.deepEqual(
    ledger.repeatedPeopleRecoveryCycles,
    [],
    `Fresh autoplay repeated an unchanged people -> recovery -> same people cycle. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.repeatedPeopleRecoveryCycles,
      null,
      2,
    )}`,
  );
  assert.ok(
    ledger.meaningfulBeatCount >= AUTOPLAY_PACING_MIN_MEANINGFUL_BEATS,
    `Fresh autoplay did not record enough meaningful zero-click progress beats. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      {
        meaningfulBeatCount: ledger.meaningfulBeatCount,
        progressKinds: ledger.progressKinds,
        transitions: ledger.transitions,
      },
      null,
      2,
    )}`,
  );
  assert.ok(
    typeof ledger.maxInAppGapMs === "number" &&
      ledger.maxInAppGapMs <= AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS,
    `Fresh autoplay app progression exceeded the ${AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS}ms product-visible gap. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(ledger.progressGaps, null, 2)}`,
  );
  assert.ok(
    ledger.progressKinds.includes("route-progress"),
    `Fresh autoplay did not record any route progress beat. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.progressKinds,
      null,
      2,
    )}`,
  );
  assert.ok(
    ledger.progressKinds.includes("conversation-progress"),
    `Fresh autoplay did not record any conversation progress beat. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.progressKinds,
      null,
      2,
    )}`,
  );
  assert.ok(
    ledger.progressKinds.some((kind) =>
      [
        "objective-progress",
        "memory-progress",
        "world-pressure-progress",
        "reasoned-time-jump",
      ].includes(kind),
    ),
    `Fresh autoplay did not record any later-state progress beyond route and conversation beats. Diagnostics: ${diagnosticsPath}. ${JSON.stringify(
      ledger.progressKinds,
      null,
      2,
    )}`,
  );
}

function assertWatchPacingAudit(watchPacingAudit) {
  assert.ok(
    watchPacingAudit.openingFirstActionBeats.every(
      (entry) =>
        (entry.appDurationMs ?? entry.durationMs ?? Infinity) <= 1_600,
    ),
    `Opening first-action watch beat should carry forward promptly: ${JSON.stringify(
      watchPacingAudit.openingFirstActionBeats,
      null,
      2,
    )}`,
  );
  assert.ok(
    watchPacingAudit.ordinaryBeatCount >= 6,
    `Expected enough ordinary watch beats to judge pacing: ${watchPacingAudit.ordinaryBeatCount}.`,
  );
  assert.equal(
    watchPacingAudit.missingOrdinaryTimingBeats.length,
    0,
    `Ordinary watch beats did not expose complete autoplay timing: ${JSON.stringify(
      watchPacingAudit.missingOrdinaryTimingBeats,
      null,
      2,
    )}`,
  );
  assert.equal(
    watchPacingAudit.shortOrdinaryBeats.length,
    0,
    `Ordinary watch beats advanced too quickly: ${JSON.stringify(
      watchPacingAudit.shortOrdinaryBeats,
      null,
      2,
    )}`,
  );
  assert.ok(
    (watchPacingAudit.ordinaryMinDurationMs ?? 0) >=
      watchPacingAudit.measuredReadableFloorMs,
    `Ordinary watch-beat minimum full dwell was below the ${watchPacingAudit.readableFloorMs}ms floor after ${watchPacingAudit.measurementToleranceMs}ms measurement tolerance: ${watchPacingAudit.ordinaryMinDurationMs}ms.`,
  );
  assert.ok(
    (watchPacingAudit.ordinaryMinIntendedDelayMs ?? 0) >=
      watchPacingAudit.measuredReadableFloorMs,
    `Ordinary watch-beat minimum intended delay was below the ${watchPacingAudit.readableFloorMs}ms floor after ${watchPacingAudit.measurementToleranceMs}ms measurement tolerance: ${watchPacingAudit.ordinaryMinIntendedDelayMs}ms.`,
  );
}

function selectedPlanningTraceOption(planningTrace) {
  if (!planningTrace) {
    return null;
  }

  return (
    planningTrace.considered?.find(
      (option) =>
        option.status === "selected" &&
        (!planningTrace.selectedPlanKey ||
          option.planKey === planningTrace.selectedPlanKey),
    ) ??
    planningTrace.considered?.find((option) => option.status === "selected") ??
    null
  );
}

function selectedPlanningTraceStep(planningTrace) {
  if (!planningTrace) {
    return null;
  }

  return (
    planningTrace.nextSteps?.find(
      (step) =>
        planningTrace.selectedActionId &&
        step.actionId === planningTrace.selectedActionId,
    ) ??
    planningTrace.nextSteps?.[0] ??
    null
  );
}

function selectedPlanningEvidence(moment) {
  const planningTrace = moment?.autonomy?.planningTrace ?? null;
  const selectedOption = selectedPlanningTraceOption(planningTrace);
  const selectedLegalBacking =
    planningTrace?.selectedLegalBacking ??
    selectedOption?.legalBacking ??
    planningTrace?.nextSteps?.[0]?.legalBacking ??
    null;

  return {
    actionId:
      planningTrace?.selectedActionId ??
      selectedOption?.actionId ??
      moment?.autonomy?.actionId ??
      null,
    immediateAction: compactPlanningTraceStep(planningTrace?.immediateAction),
    intendedFollowUp: compactPlanningTraceStep(planningTrace?.intendedFollowUp),
    label:
      planningTrace?.selectedLabel ??
      selectedOption?.label ??
      moment?.autonomy?.label ??
      null,
    legalBacking: selectedLegalBacking
      ? {
          actionId: selectedLegalBacking.actionId ?? null,
          locationId: selectedLegalBacking.locationId ?? null,
          source: selectedLegalBacking.source ?? null,
        }
      : null,
    matchedOutcomeId:
      planningTrace?.selectedMatchedOutcomeId ??
      selectedOption?.matchedOutcomeId ??
      null,
    planKey: planningTrace?.selectedPlanKey ?? selectedOption?.planKey ?? null,
    pressureId:
      planningTrace?.selectedPressureId ?? selectedOption?.pressureId ?? null,
    pressureKind:
      planningTrace?.selectedPressureKind ??
      selectedOption?.pressureKind ??
      null,
    pressureLabel: compactObjectiveSequenceText(
      planningTrace?.selectedPressureLabel ??
        selectedOption?.pressureLabel ??
        "",
      160,
    ),
    plannerIntent: compactPlanningTracePlannerIntent(
      planningTrace?.plannerIntent,
    ),
    provenance: selectedOption?.provenance ?? null,
    targetLocationId:
      planningTrace?.selectedTargetLocationId ??
      selectedOption?.targetLocationId ??
      moment?.autonomy?.targetLocationId ??
      null,
  };
}

function compactPostFirstAfternoonMoment(moment) {
  if (!moment) {
    return null;
  }

  const selected = selectedPlanningEvidence(moment);
  return {
    activeConversation: moment.activeConversation
      ? {
          lines: moment.activeConversation.lines ?? null,
          npcId: moment.activeConversation.npcId ?? null,
          npcName: moment.activeConversation.npcName ?? null,
        }
      : null,
    clock: moment.clock ?? null,
    firstAfternoon: {
      completedAt: moment.firstAfternoon?.completedAt ?? null,
      completionAcknowledgedAt:
        moment.firstAfternoon?.completionAcknowledgedAt ?? null,
      hasFieldNote: Boolean(moment.firstAfternoon?.hasFieldNote),
      hasLeadFieldNote: Boolean(moment.firstAfternoon?.hasLeadFieldNote),
      teaShiftStage: moment.firstAfternoon?.teaShiftStage ?? null,
    },
    feedTail: moment.feedTail ?? [],
    independentNpcActions: moment.independentNpcActions ?? [],
    independentNpcSurface: moment.independentNpcSurface ?? null,
    label: moment.label,
    location: moment.location ?? null,
    memoriesTail: moment.memoriesTail ?? [],
    notebook: moment.notebook ?? null,
    objective: {
      focus: moment.objective?.focus ?? null,
      progress: moment.objective?.progress ?? null,
      routeKey: moment.objective?.routeKey ?? null,
      source: moment.objective?.source ?? null,
      text: moment.objective?.text ?? null,
    },
    outcomes: (moment.objective?.outcomes ?? []).map((outcome) => ({
      actionId: outcome.actionId ?? null,
      blockers: outcome.blockers ?? [],
      evidence: outcome.evidence ?? null,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      targetLocationId: outcome.targetLocationId ?? null,
      urgency: outcome.urgency ?? null,
    })),
    player: moment.player ?? null,
    screenshot: moment.screenshot ?? null,
    selected,
    visibleDecisionArtifact: compactVisibleDecisionArtifact(
      moment.visibleDecisionArtifact ??
        moment.autonomy?.visibleDecisionArtifact ??
        moment.rail?.visibleDecisionArtifact ??
        null,
    ),
    yardOutcome: postFirstAfternoonYardOutcomeEvidence(moment),
  };
}

function postFirstAfternoonLivePressureFacts(moment) {
  const worldPressure = moment?.worldPressure ?? {};
  return {
    activeProblems: (worldPressure.problems ?? [])
      .filter((problem) => problem.discovered && problem.status === "active")
      .map((problem) => ({
        escalationLevel: problem.escalationLevel ?? 0,
        id: problem.id,
        locationId: problem.locationId,
        requiredItemId: problem.requiredItemId ?? null,
        title: problem.title,
        urgency: problem.urgency,
      })),
    discoveredJobs: (worldPressure.jobWindows ?? [])
      .filter((job) => job.discovered)
      .map((job) => ({
        accepted: Boolean(job.accepted),
        completed: Boolean(job.completed),
        id: job.id,
        inWindow: Boolean(job.inWindow),
        locationId: job.locationId,
        missed: Boolean(job.missed),
        title: job.title,
      })),
    npcPressureMoves: (worldPressure.npcPressureMoves ?? []).map((npc) => ({
      currentConcern: npc.currentConcern ?? "",
      currentLocationId: npc.currentLocationId ?? null,
      currentScheduleLocationId: npc.currentScheduleLocationId ?? null,
      id: npc.id,
    })),
  };
}

function livePressurePlannerOptions(moment) {
  const trace = moment?.autonomy?.planningTrace ?? null;
  if (!trace) {
    return [];
  }

  const optionsByKey = new Map();
  for (const option of [
    ...(trace.considered ?? []),
    ...(trace.rejected ?? []),
  ]) {
    const searchableText = [
      option.pressureId,
      option.pressureKind,
      option.pressureLabel,
      option.label,
      option.rationale,
      option.targetLocationId,
    ]
      .filter(Boolean)
      .join(" ");
    const isLiveProblemOrJob =
      /^(?:job|problem)$/.test(option.pressureKind ?? "") ||
      /(?:^|:)job-|(?:^|:)problem-|pump|yard|work|tool|wrench/i.test(
        searchableText,
      );
    if (!isLiveProblemOrJob) {
      continue;
    }
    const key =
      option.planKey ??
      `${option.status}:${option.actionId}:${option.targetLocationId}:${option.pressureId}`;
    optionsByKey.set(key, compactPlanningTraceOption(option));
  }

  return [...optionsByKey.values()];
}

function staleRoutePlannerOptions(moment) {
  const trace = moment?.autonomy?.planningTrace ?? null;
  if (!trace) {
    return [];
  }

  return [...(trace.considered ?? []), ...(trace.rejected ?? [])]
    .filter((option) =>
      SCAFFOLD_ONLY_TRACE_PROVENANCES.has(option.provenance),
    )
    .map(compactPlanningTraceOption);
}

function restHourEnergyFromObjective(objective) {
  const restOutcome = (objective?.outcomes ?? []).find(
    (outcome) => outcome.id === "rest-hour",
  );
  const match = /(\d+)\s+energy/i.exec(restOutcome?.evidence ?? "");
  return match ? Number(match[1]) : null;
}

function restHourEnergyFromMoment(moment) {
  return (
    restHourEnergyFromObjective(moment?.objective) ??
    moment?.player?.energy ??
    moment?.sim?.energy ??
    null
  );
}

function postFirstAfternoonRestAdvancedProbe(probe) {
  const energyAfterRest =
    restHourEnergyFromObjective(probe.objective) ??
    probe.player?.energy ??
    probe.sim?.energy ??
    0;
  return (
    Boolean(probe.firstAfternoon?.completionAcknowledgedAt) &&
    probe.objective?.source === "dynamic" &&
    energyAfterRest >= POST_FIRST_AFTERNOON_RECOVERY_ENERGY &&
    probe.autonomy?.actionId !== "rest:home"
  );
}

function postFirstAfternoonLiveRouteProbe(probe) {
  const selected = selectedPlanningEvidence(probe);
  return (
    Boolean(probe.firstAfternoon?.completionAcknowledgedAt) &&
    probe.objective?.source === "dynamic" &&
    !["first-afternoon", "rest-home"].includes(
      probe.objective?.routeKey ?? "",
    ) &&
    Boolean(selected.actionId) &&
    Boolean(selected.legalBacking?.source) &&
    Boolean(
      selected.pressureId || selected.pressureKind || selected.matchedOutcomeId,
    ) &&
    !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(selected.provenance) &&
    !(
      selected.actionId === "exit:boarding-house" &&
      probe.location?.spaceId === "interior:boarding-house"
    )
  );
}

function postFirstAfternoonYardFollowThroughProbe(probe) {
  if (!probe) {
    return false;
  }

  const selected = selectedPlanningEvidence(probe);
  const yardJob = (probe.worldPressure?.jobWindows ?? []).find(
    (job) => job.id === "job-yard-shift",
  );
  const atYard = probe.location?.id === "freight-yard";
  const yardActionIds = new Set([
    "accept:job-yard-shift",
    "work:job-yard-shift",
    "talk:npc-tomas",
  ]);
  const yardAction = yardActionIds.has(probe.autonomy?.actionId ?? "");
  const tomasSetup = probe.activeConversation?.npcId === "npc-tomas";
  const yardJobProgressed = Boolean(
    yardJob?.accepted || yardJob?.completed || yardJob?.missed,
  );
  const yardJobClosed = Boolean(yardJob?.completed || yardJob?.missed);
  const yardText = [
    probe.objective?.routeKey,
    probe.objective?.text,
    probe.autonomy?.label,
    probe.autonomy?.detail,
    selected.pressureLabel,
  ]
    .filter(Boolean)
    .join(" ");
  const activeYardObjective =
    ["dynamic", "conversation"].includes(probe.objective?.source ?? "") &&
    /\b(?:work-yard|yard|freight|Tomas)\b/i.test(yardText);

  return (
    Boolean(probe.firstAfternoon?.completionAcknowledgedAt) &&
    ((activeYardObjective &&
      (atYard || yardJobProgressed) &&
      (tomasSetup || yardAction || yardJobProgressed)) ||
      (atYard && yardJobClosed))
  );
}

function postFirstAfternoonYardOutcomeEvidence(probe) {
  const yardJob = (probe?.worldPressure?.jobWindows ?? []).find(
    (job) => job.id === "job-yard-shift",
  );
  const pumpProblem = (probe?.worldPressure?.problems ?? []).find(
    (problem) => problem.id === "problem-pump",
  );
  const feedTail = probe?.feedTail ?? [];
  const memoriesTail = probe?.memoriesTail ?? [];
  const independentNpcActions = probe?.independentNpcActions ?? [];
  const independentNpcSurface = probe?.independentNpcSurface ?? null;
  const objectiveOutcomeText = (probe?.objective?.outcomes ?? [])
    .map((outcome) =>
      [
        outcome.label,
        outcome.evidence,
        ...(outcome.blockers ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
  const visibleDecisionArtifact =
    probe?.visibleDecisionArtifact ??
    probe?.autonomy?.visibleDecisionArtifact ??
    probe?.rail?.visibleDecisionArtifact ??
    null;
  const decisionText = visibleDecisionArtifact
    ? [
        visibleDecisionArtifact.objective,
        visibleDecisionArtifact.selectedAction,
        visibleDecisionArtifact.rationale,
        visibleDecisionArtifact.sourceSummary,
        visibleDecisionArtifact.backingSummary,
        ...(visibleDecisionArtifact.constraints ?? []),
        ...(visibleDecisionArtifact.considered ?? []),
        ...(visibleDecisionArtifact.passedOver ?? []),
      ]
    : [];
  const playerFacingTextParts = [
    ...feedTail.map((entry) => entry.text),
    ...memoriesTail.map((entry) => entry.text),
    ...objectiveOutcomeText,
    ...decisionText,
    independentNpcSurface?.title,
    independentNpcSurface?.detail,
    independentNpcSurface?.playerFacingSummary,
  ].filter(Boolean);
  const playerFacingText = playerFacingTextParts.join(" ");
  const completed = Boolean(yardJob?.completed);
  const closed = Boolean(yardJob?.missed);
  const pumpResolvedByMara =
    pumpProblem?.status === "resolved" &&
    pumpProblem.resolvedByNpcId === "npc-mara";
  const maraPumpActionVisible = independentNpcActions.some(
    (action) =>
      action.problemId === "problem-pump" &&
      action.resolverNpcId === "npc-mara",
  );
  const maraPumpTextVisible =
    /\bMara\b/i.test(playerFacingText) &&
    /\bpump|Morrow Yard|house strain|without Rowan|contained\b/i.test(
      playerFacingText,
    );
  const pumpConsequenceVisible =
    !pumpResolvedByMara || maraPumpActionVisible || maraPumpTextVisible;
  const yardPayTextVisible = playerFacingTextParts.some(
    (text) =>
      /\b(?:freight[- ]yard|yard|lift|load|Tomas)\b/i.test(text) &&
      /\b(?:finished|earned|paid|pay|\$24|took your pay)\b/i.test(text),
  );
  const yardCreditTextVisible = playerFacingTextParts.some((text) =>
    /\b(?:yard will remember|stayed until the load was done|Tomas.*(?:credit|trust|reason)|load was done)\b/i.test(
      text,
    ),
  );
  const paySurfaced =
    completed &&
    (probe?.player?.money ?? 0) >= 50 &&
    yardPayTextVisible;
  const yardTrustSurfaced = completed && yardCreditTextVisible;
  const closedSurfaced =
    closed &&
    /\b(?:Tomas|load|yard|no pay|no credit|closed|moved without Rowan|missed|walked away)\b/i.test(
      playerFacingText,
    );
  const completedOutcome = completed && paySurfaced && yardTrustSurfaced;
  const closedOutcome = closed && closedSurfaced;

  return {
    closed,
    closedSurfaced,
    completed,
    completedOutcome,
    feedTail,
    memoriesTail,
    outcomeReached: Boolean(
      probe?.firstAfternoon?.completionAcknowledgedAt &&
        (completedOutcome || closedOutcome) &&
        pumpConsequenceVisible,
    ),
    paySurfaced,
    playerMoney: probe?.player?.money ?? null,
    pumpConsequenceVisible,
    pumpResolvedByMara,
    yardJob: yardJob ?? null,
    yardTrustSurfaced,
  };
}

function postFirstAfternoonYardOutcomeProbe(probe) {
  return postFirstAfternoonYardOutcomeEvidence(probe).outcomeReached;
}

function isRestOrShelterSelection(summary) {
  const selectedText = [
    summary?.objective?.focus,
    summary?.objective?.routeKey,
    summary?.objective?.text,
    summary?.selected?.matchedOutcomeId,
    summary?.selected?.pressureId,
    summary?.selected?.pressureKind,
    summary?.selected?.pressureLabel,
    summary?.selected?.label,
  ]
    .filter(Boolean)
    .join(" ");
  return /\b(?:rest|shelter|home|room)\b/i.test(selectedText);
}

function buildPostFirstAfternoonLivePressureEvidence({
  clickLog,
  moments,
  visibleControlClickCount,
  watchedAutoContinueCount,
}) {
  const byLabel = Object.fromEntries(
    moments.map((moment) => [moment.label, moment]),
  );
  const handoff = byLabel["post-first-afternoon-handoff"] ?? null;
  const recoveryReady = byLabel["post-first-afternoon-rest"] ?? null;
  const liveRoute = byLabel["post-first-afternoon-live-route"] ?? null;
  const followThrough =
    byLabel["post-first-afternoon-yard-follow-through"] ?? null;
  const yardOutcome =
    byLabel["post-first-afternoon-yard-outcome"] ?? null;
  const handoffSummary = compactPostFirstAfternoonMoment(handoff);
  const recoveryReadySummary =
    compactPostFirstAfternoonMoment(recoveryReady);
  const liveRouteSummary = compactPostFirstAfternoonMoment(liveRoute);
  const followThroughSummary = compactPostFirstAfternoonMoment(followThrough);
  const yardOutcomeSummary = compactPostFirstAfternoonMoment(yardOutcome);
  const handoffLivePressureOptions = livePressurePlannerOptions(handoff);
  const recoveryReadyLivePressureOptions =
    livePressurePlannerOptions(recoveryReady);
  const liveRoutePressureOptions = livePressurePlannerOptions(liveRoute);
  const followThroughPressureOptions =
    livePressurePlannerOptions(followThrough);

  return {
    assertionSemantics:
      "Player-POV zero-click follow-through from first-afternoon completion acknowledgement, through state-derived recovery readiness, into the next dynamic current-state route/action.",
    directSimCommandsUsed: false,
    handoff: handoffSummary,
    livePressure: {
      atHandoff: postFirstAfternoonLivePressureFacts(handoff),
      afterRest: postFirstAfternoonLivePressureFacts(recoveryReady),
      atFollowThrough: postFirstAfternoonLivePressureFacts(followThrough),
      atLiveRoute: postFirstAfternoonLivePressureFacts(liveRoute),
      atYardOutcome: postFirstAfternoonLivePressureFacts(yardOutcome),
      plannerOptionsAtFollowThrough: followThroughPressureOptions,
      plannerOptionsAtHandoff: handoffLivePressureOptions,
      plannerOptionsAfterRest: recoveryReadyLivePressureOptions,
      plannerOptionsAtLiveRoute: liveRoutePressureOptions,
    },
    followThrough: followThroughSummary,
    liveRoute: liveRouteSummary,
    notebookFreshness: {
      afterRest: recoveryReadySummary?.notebook ?? null,
      atFollowThrough: followThroughSummary?.notebook ?? null,
      atHandoff: handoffSummary?.notebook ?? null,
      atLiveRoute: liveRouteSummary?.notebook ?? null,
    },
    progressionBeats: clickLog
      .filter((entry) =>
        [
          "post-first-afternoon-handoff",
          "post-first-afternoon-rest",
          "post-first-afternoon-live-route",
          "post-first-afternoon-yard-follow-through",
          "post-first-afternoon-yard-outcome",
        ].includes(entry.milestone),
      )
      .map((entry) => ({
        beforeAutonomyLabel: entry.beforeAutonomyLabel ?? null,
        beforeObjectiveRouteKey: entry.beforeObjectiveRouteKey ?? null,
        completionAutoContinue: Boolean(entry.completionAutoContinue),
        durationMs: entry.durationMs ?? null,
        fullAppDurationMs: entry.fullAppDurationMs ?? null,
        handoffReorientation: Boolean(entry.handoffReorientation),
        kind: entry.kind,
        milestone: entry.milestone,
        autoContinueIntendedDelayMs:
          entry.autoContinueIntendedDelayMs ?? null,
        readabilityCheckpointMs: entry.readabilityCheckpointMs ?? null,
        readabilityStateStable: entry.readabilityStateStable ?? null,
        sequenceRunId: entry.sequenceRunId ?? null,
      })),
    rest: {
      ...recoveryReadySummary,
      restHourEnergy: restHourEnergyFromMoment(recoveryReady),
    },
    staleRouteEvidence: {
      atHandoff: staleRoutePlannerOptions(handoff),
      afterRest: staleRoutePlannerOptions(recoveryReady),
      atLiveRoute: staleRoutePlannerOptions(liveRoute),
    },
    status: "passed",
    yardOutcome: yardOutcomeSummary,
    zeroClick: {
      visibleControlClickCount,
      watchedAutoContinueCount,
    },
  };
}

function assertPostFirstAfternoonNotebookSummary(summary) {
  const notebook = summary?.notebook;
  assert.ok(
    notebook,
    `${summary?.label ?? "post-first-afternoon"}: missing late Notebook cognition evidence.`,
  );
  const notebookText = compactNotebookText(notebook);
  assert.doesNotMatch(
    notebookText,
    STALE_LATE_NOTEBOOK_AUTHORITY_PATTERN,
    `${summary.label}: late Notebook kept stale opening shelter authority: ${JSON.stringify(notebook)}.`,
  );
  assert.notEqual(
    notebook.authority?.notebookNeedKey,
    "shelter",
    `${summary.label}: late Notebook authority still names shelter as the active need.`,
  );
  assert.notEqual(
    notebook.authority?.primaryNeedKey,
    "shelter",
    `${summary.label}: late Notebook authority still names shelter as the hidden primary need.`,
  );
  assertLateNotebookMatchesCurrentPressure(summary.label, notebook, {
    autonomy: {
      detail: summary.selected?.pressureLabel ?? null,
      label: summary.selected?.label ?? null,
      planningTrace: {
        selectedMatchedOutcomeId: summary.selected?.matchedOutcomeId ?? null,
        selectedPressureKind: summary.selected?.pressureKind ?? null,
        selectedPressureLabel: summary.selected?.pressureLabel ?? null,
      },
    },
    objective: summary.objective,
  });
}

function assertPostFirstAfternoonHandoffSelection(handoff) {
  assert.ok(
    handoff?.firstAfternoon?.completionAcknowledgedAt,
    "Post-first-afternoon handoff must acknowledge the completed field-note beat.",
  );
  assert.equal(
    handoff.objective?.source,
    "dynamic",
    "Post-first-afternoon handoff must come from a dynamic current-state objective.",
  );
  assert.notEqual(
    handoff.objective?.routeKey,
    "first-afternoon",
    "Post-first-afternoon handoff must leave completed first-afternoon authority.",
  );
  assert.ok(
    handoff.selected?.actionId,
    "Post-first-afternoon handoff must expose a selected action.",
  );
  assert.equal(
    handoff.selected?.legalBacking?.source,
    "current-legal-action-surface",
    "Post-first-afternoon handoff must expose simulator legal-action backing.",
  );
  assert.ok(
    handoff.selected?.pressureId ||
      handoff.selected?.pressureKind ||
      handoff.selected?.matchedOutcomeId,
    "Post-first-afternoon handoff must expose current pressure or predicate authority.",
  );
  assert.ok(
    handoff.selected?.provenance,
    "Post-first-afternoon handoff must expose selected-action provenance.",
  );
  assert.ok(
    !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(handoff.selected.provenance),
    `Post-first-afternoon handoff selected scaffold-only authority: ${handoff.selected.provenance}.`,
  );
  assert.ok(
    handoff.visibleDecisionArtifact,
    "Post-first-afternoon handoff must preserve a visible decision artifact.",
  );

  const energy = restHourEnergyFromMoment(handoff) ?? 0;
  if (handoff.selected.actionId === "rest:home") {
    assert.ok(
      energy < POST_FIRST_AFTERNOON_RECOVERY_ENERGY,
      `Post-first-afternoon rest may be selected only while recovery is still needed: ${energy} energy.`,
    );
    assert.equal(
      handoff.selected.targetLocationId,
      "boarding-house",
      "Low-energy post-first-afternoon rest must target Morrow House.",
    );
    assert.equal(
      handoff.selected.pressureKind,
      "predicate",
      "Low-energy post-first-afternoon rest must be backed by a desired-state predicate.",
    );
    assert.equal(
      handoff.selected.matchedOutcomeId,
      "rest-hour",
      "Low-energy post-first-afternoon rest must match the rest-hour outcome.",
    );
    assert.equal(
      handoff.selected.provenance,
      "objective-predicate",
      "Low-energy post-first-afternoon rest must use objective-predicate authority.",
    );
    return "low-energy-rest";
  }

  assert.ok(
    energy >= POST_FIRST_AFTERNOON_RECOVERY_ENERGY,
    `Direct post-first-afternoon live-pressure action requires recovery-ready energy: ${energy}.`,
  );
  return "already-recovered-direct-live";
}

function assertPostFirstAfternoonLivePressureEvidence(evidence) {
  assert.ok(
    evidence?.handoff,
    "Post-first-afternoon follow-through evidence is missing the handoff moment.",
  );
  assert.ok(
    evidence?.rest,
    "Post-first-afternoon follow-through evidence is missing the recovery-ready moment.",
  );
  assert.ok(
    evidence?.liveRoute,
    "Post-first-afternoon follow-through evidence is missing the live-route moment.",
  );
  assert.ok(
    evidence?.followThrough,
    "Post-first-afternoon follow-through evidence is missing the yard/Tomas follow-through moment.",
  );
  assert.ok(
    evidence?.yardOutcome,
    "Post-first-afternoon follow-through evidence is missing the yard outcome moment.",
  );
  assert.equal(
    evidence.directSimCommandsUsed,
    false,
    "Post-first-afternoon follow-through evidence must come from the player-POV browser pass.",
  );
  assert.equal(
    evidence.zeroClick?.visibleControlClickCount,
    0,
    `Post-first-afternoon follow-through must remain zero-click: ${evidence.zeroClick?.visibleControlClickCount}.`,
  );
  assert.ok(
    (evidence.zeroClick?.watchedAutoContinueCount ?? 0) >= 8,
    `Post-first-afternoon follow-through did not include enough watch-mode beats: ${evidence.zeroClick?.watchedAutoContinueCount}.`,
  );

  for (const summary of [
    evidence.handoff,
    evidence.rest,
    evidence.liveRoute,
  ]) {
    assert.notEqual(
      summary.objective?.routeKey,
      "first-afternoon",
      `${summary.label}: post-first-afternoon evidence stayed on first-afternoon route authority.`,
    );
    assertPostFirstAfternoonNotebookSummary(summary);
  }

  assertPostFirstAfternoonHandoffSelection(evidence.handoff);

  const livePressureBeforeLiveRoute = [
    ...(evidence.livePressure?.plannerOptionsAtHandoff ?? []),
    ...(evidence.livePressure?.plannerOptionsAfterRest ?? []),
  ];
  assert.ok(
    livePressureBeforeLiveRoute.length > 0,
    "Post-first-afternoon handoff/recovery-ready evidence did not expose current job or problem pressure.",
  );
  const unexplainedLivePressure = livePressureBeforeLiveRoute.filter(
    (option) => option.status !== "selected" && !option.reason,
  );
  assert.equal(
    unexplainedLivePressure.length,
    0,
    `Rejected post-first-afternoon job/problem pressure needs a current-state reason: ${JSON.stringify(
      unexplainedLivePressure,
      null,
      2,
    )}`,
  );
  assert.ok(
    (evidence.livePressure?.atHandoff?.activeProblems ?? []).some(
      (problem) =>
        problem.id === "problem-pump" && problem.locationId === "courtyard",
    ) ||
      (evidence.livePressure?.afterRest?.activeProblems ?? []).some(
        (problem) =>
          problem.id === "problem-pump" && problem.locationId === "courtyard",
      ),
    "Post-first-afternoon evidence must keep the live pump pressure visible at Morrow Yard.",
  );
  assert.ok(
    (evidence.livePressure?.atHandoff?.discoveredJobs ?? []).some(
      (job) => job.id === "job-yard-shift",
    ) ||
      (evidence.livePressure?.afterRest?.discoveredJobs ?? []).some(
        (job) => job.id === "job-yard-shift",
      ),
    "Post-first-afternoon evidence must keep the live yard-work pressure visible.",
  );

  assert.ok(
    (evidence.rest.restHourEnergy ?? 0) >=
      POST_FIRST_AFTERNOON_RECOVERY_ENERGY,
    `Post-first-afternoon recovery-ready evidence has insufficient energy for a live commitment: ${evidence.rest.restHourEnergy}.`,
  );
  assert.equal(
    evidence.rest.objective?.source,
    "dynamic",
    "Post-first-afternoon recovery-ready evidence must keep a dynamic current-state objective.",
  );
  assert.notEqual(
    evidence.rest.objective?.routeKey,
    "rest-home",
    "Post-first-afternoon recovery-ready evidence must leave rest-home authority.",
  );
  assert.notEqual(
    evidence.rest.selected?.actionId,
    "rest:home",
    "Post-first-afternoon recovery-ready evidence must select a non-rest live-pressure action.",
  );
  assert.ok(
    evidence.rest.selected?.legalBacking?.source,
    "Post-first-afternoon recovery-ready evidence must expose legal backing for its non-rest action.",
  );
  assert.ok(
    evidence.rest.selected?.pressureId ||
      evidence.rest.selected?.matchedOutcomeId ||
      evidence.rest.selected?.pressureKind,
    "Post-first-afternoon recovery-ready evidence must expose current pressure or predicate authority.",
  );
  assert.ok(
    evidence.rest.selected?.provenance &&
      !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(
        evidence.rest.selected.provenance,
      ),
    `Post-first-afternoon recovery-ready evidence selected missing or scaffold-only provenance: ${evidence.rest.selected?.provenance}.`,
  );
  const liveRouteProgressedBeyondRecoveryReady =
    (evidence.liveRoute.clock?.totalMinutes ?? 0) >
      (evidence.rest.clock?.totalMinutes ?? 0) ||
    evidence.liveRoute.location?.spaceId !==
      evidence.rest.location?.spaceId ||
    evidence.liveRoute.location?.id !== evidence.rest.location?.id ||
    evidence.liveRoute.selected?.actionId !==
      evidence.rest.selected?.actionId;
  assert.ok(
    liveRouteProgressedBeyondRecoveryReady,
    "Post-first-afternoon live-route evidence must progress beyond the recovery-ready selection.",
  );
  assert.equal(
    evidence.liveRoute.objective?.source,
    "dynamic",
    "Post-first-afternoon live route must come from a dynamic current-state objective.",
  );
  assert.notEqual(
    evidence.liveRoute.objective?.routeKey,
    "rest-home",
    "Post-first-afternoon live route must stay beyond rest authority once recovery opens a live route.",
  );
  assert.ok(
    evidence.liveRoute.selected?.actionId,
    "Post-first-afternoon live route must expose the next selected action.",
  );
  assert.ok(
    evidence.liveRoute.selected?.legalBacking?.source,
    "Post-first-afternoon live route must expose an explicit legal backing source.",
  );
  assert.ok(
    evidence.liveRoute.selected?.pressureId ||
      evidence.liveRoute.selected?.matchedOutcomeId ||
      evidence.liveRoute.selected?.pressureKind,
    "Post-first-afternoon live route must expose current-state predicate or live-pressure authority.",
  );
  assert.ok(
    !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(
      evidence.liveRoute.selected?.provenance,
    ),
    `Post-first-afternoon live route selected stale route authority: ${evidence.liveRoute.selected?.provenance}.`,
  );

  const liveRouteTarget = evidence.liveRoute.selected?.targetLocationId ?? null;
  if (evidence.liveRoute.objective?.routeKey === "work-yard") {
    assert.equal(
      liveRouteTarget,
      "freight-yard",
      "Post-rest yard-work route must target the freight yard.",
    );
    const followThrough = evidence.followThrough;
    const followThroughTarget = followThrough.selected?.targetLocationId ?? null;
    const followThroughAction = followThrough.selected?.actionId ?? null;
    const followThroughYardJob = (
      evidence.livePressure?.atFollowThrough?.discoveredJobs ?? []
    ).find((job) => job.id === "job-yard-shift");
    const hasTomasSetup =
      followThrough.activeConversation?.npcId === "npc-tomas" ||
      followThroughAction === "talk:npc-tomas";
    const hasLegalYardAction =
      followThroughAction === "accept:job-yard-shift" ||
      followThroughAction === "work:job-yard-shift" ||
      Boolean(
        followThroughYardJob?.accepted ||
          followThroughYardJob?.completed ||
          followThroughYardJob?.missed,
      );

    assert.ok(
      followThrough.location?.id === "freight-yard" ||
        followThroughTarget === "freight-yard",
      `Post-rest yard follow-through must reach or remain aimed at North Crane Yard, got ${JSON.stringify(
        {
          location: followThrough.location,
          selected: followThrough.selected,
        },
      )}.`,
    );
    assert.ok(
      hasTomasSetup || hasLegalYardAction,
      `Post-rest yard follow-through must become Tomas setup, legal yard action, or closed/completed yard state: ${JSON.stringify(
        {
          activeConversation: followThrough.activeConversation,
          selected: followThrough.selected,
          yardJob: followThroughYardJob,
        },
        null,
        2,
      )}`,
    );

    const yardOutcome = evidence.yardOutcome?.yardOutcome ?? null;
    assert.ok(
      yardOutcome?.outcomeReached,
      `Post-rest yard follow-through must continue into a visible completed or closed yard outcome, not stop at setup/action selection: ${JSON.stringify(
        {
          yardOutcome,
          moment: evidence.yardOutcome,
        },
        null,
        2,
      )}`,
    );
    assert.ok(
      yardOutcome.completed || yardOutcome.closed,
      `Yard outcome must complete or close job-yard-shift: ${JSON.stringify(yardOutcome, null, 2)}`,
    );
    if (yardOutcome.completed) {
      assert.ok(
        yardOutcome.paySurfaced,
        `Completed yard work must surface pay in player-facing feed/memory/objective copy: ${JSON.stringify(yardOutcome, null, 2)}`,
      );
      assert.ok(
        yardOutcome.yardTrustSurfaced,
        `Completed yard work must surface yard/Tomas trust or credit in player-facing copy: ${JSON.stringify(yardOutcome, null, 2)}`,
      );
    }
    assert.ok(
      yardOutcome.pumpConsequenceVisible,
      `Yard outcome must keep the Mara/Morrow Yard pump consequence visible when Rowan prioritized paid work: ${JSON.stringify(yardOutcome, null, 2)}`,
    );
    assert.ok(
      (evidence.yardOutcome.clock?.totalMinutes ?? 0) >=
        (followThrough.clock?.totalMinutes ?? 0),
      "Yard outcome evidence must be captured after the yard follow-through setup moment.",
    );
  }
  const liveRouteText = [
    evidence.liveRoute.objective?.routeKey,
    evidence.liveRoute.objective?.focus,
    evidence.liveRoute.objective?.text,
    evidence.liveRoute.selected?.pressureId,
    evidence.liveRoute.selected?.pressureLabel,
    evidence.liveRoute.selected?.matchedOutcomeId,
  ]
    .filter(Boolean)
    .join(" ");
  if (/\b(?:pump|tool|wrench|help|repair)\b/i.test(liveRouteText)) {
    assert.ok(
      ["courtyard", "repair-stall"].includes(liveRouteTarget),
      `Post-rest pump/tool/help route must target the live problem/tool location, got ${liveRouteTarget}.`,
    );
  }
  if (liveRouteTarget === "boarding-house") {
    assert.ok(
      isRestOrShelterSelection(evidence.liveRoute),
      "Post-rest live route backtracked to Morrow House without explicit rest/shelter pressure.",
    );
    assert.notEqual(
      evidence.liveRoute.objective?.routeKey,
      "first-afternoon",
      "Post-rest Morrow House target must not be stale first-afternoon authority.",
    );
  }
}

function buildPostFirstAfternoonHandoffGuardFixture({ restSelected }) {
  const actionId = restSelected ? "rest:home" : "exit:boarding-house";
  const routeKey = restSelected ? "rest-home" : "work-yard";
  const targetLocationId = restSelected
    ? "boarding-house"
    : "freight-yard";
  const pressureKind = restSelected ? "predicate" : "job";
  const pressureId = restSelected ? null : "job-yard-shift";
  const matchedOutcomeId = restSelected ? "rest-hour" : "yard-shift";
  const provenance = restSelected ? "objective-predicate" : "world-pressure";
  const legalBacking = {
    actionId,
    locationId: "boarding-house",
    source: "current-legal-action-surface",
  };
  const selectedOption = {
    actionId,
    legalBacking,
    matchedOutcomeId,
    planKey: `${routeKey}:${actionId}`,
    pressureId,
    pressureKind,
    provenance,
    status: "selected",
    targetLocationId,
  };

  return {
    autonomy: {
      actionId,
      label: restSelected ? "Recover at Morrow House" : "Head for yard work",
      planningTrace: {
        considered: [selectedOption],
        selectedActionId: actionId,
        selectedLegalBacking: legalBacking,
        selectedMatchedOutcomeId: matchedOutcomeId,
        selectedPlanKey: selectedOption.planKey,
        selectedPressureId: pressureId,
        selectedPressureKind: pressureKind,
        selectedTargetLocationId: targetLocationId,
      },
      targetLocationId,
      visibleDecisionArtifact: {
        backingSummary: "Validated against the current legal action surface.",
        considered: ["Current yard work", "Morrow Yard pump pressure"],
        constraints: [restSelected ? "12 energy" : "68 energy"],
        nextCheck: "Check the live commitment after this action.",
        objective: restSelected ? "Recover before committing" : "Take live work",
        passedOver: [],
        rationale: restSelected
          ? "Low energy makes recovery the legal predicate-backed priority."
          : "Current energy supports acting on live yard pressure now.",
        selectedAction: actionId,
        sourceSummary: restSelected
          ? "Dynamic recovery predicate"
          : "Dynamic yard-job pressure",
      },
    },
    firstAfternoon: {
      completedAt: "2026-03-21T15:24:00.000Z",
      completionAcknowledgedAt: "2026-03-21T15:24:08.000Z",
    },
    objective: {
      focus: restSelected ? "rest" : "work",
      outcomes: restSelected
        ? [
            {
              evidence: "Rowan currently has 12 energy.",
              id: "rest-hour",
              status: "unmet",
            },
          ]
        : [
            {
              id: "yard-shift",
              status: "unmet",
            },
          ],
      progress: { completed: 0, total: 1 },
      routeKey,
      source: "dynamic",
      text: restSelected
        ? "Recover at Morrow House before the next commitment."
        : "Use the open yard shift while the window is live.",
    },
    player: { energy: restSelected ? 12 : 68 },
  };
}

function assertPostFirstAfternoonTrajectoryNeutralGuard() {
  const lowEnergyRest = buildPostFirstAfternoonHandoffGuardFixture({
    restSelected: true,
  });
  const recoveredDirectLive = buildPostFirstAfternoonHandoffGuardFixture({
    restSelected: false,
  });

  assert.equal(
    isPostFirstAfternoonHandoffPendingProbe(lowEnergyRest),
    true,
    "Low-energy predicate-backed rest must qualify as a post-afternoon reorientation dwell.",
  );
  assert.equal(
    isPostFirstAfternoonHandoffPendingProbe(recoveredDirectLive),
    true,
    "Already-recovered direct live pressure must qualify as a post-afternoon reorientation dwell.",
  );
  assert.equal(
    assertPostFirstAfternoonHandoffSelection(
      compactPostFirstAfternoonMoment(lowEnergyRest),
    ),
    "low-energy-rest",
    "The deterministic low-energy branch must retain exact legal rest semantics.",
  );
  assert.equal(
    assertPostFirstAfternoonHandoffSelection(
      compactPostFirstAfternoonMoment(recoveredDirectLive),
    ),
    "already-recovered-direct-live",
    "The deterministic recovered branch must accept an immediate legal non-rest action.",
  );
  assert.equal(
    postFirstAfternoonRestAdvancedProbe(lowEnergyRest),
    false,
    "Low-energy rest must not be recovery-ready before the selected rest action lands.",
  );
  assert.equal(
    postFirstAfternoonRestAdvancedProbe(recoveredDirectLive),
    true,
    "Already-recovered direct live pressure must satisfy the existing recovery-ready milestone without forced rest.",
  );

  const invalidProbes = [
    {
      ...recoveredDirectLive,
      objective: {
        ...recoveredDirectLive.objective,
        progress: { completed: 1, total: 1 },
      },
    },
    {
      ...recoveredDirectLive,
      objective: {
        ...recoveredDirectLive.objective,
        routeKey: "first-afternoon",
      },
    },
    {
      ...recoveredDirectLive,
      objective: {
        ...recoveredDirectLive.objective,
        progress: null,
      },
    },
    {
      ...recoveredDirectLive,
      autonomy: {
        ...recoveredDirectLive.autonomy,
        planningTrace: {
          ...recoveredDirectLive.autonomy.planningTrace,
          considered: recoveredDirectLive.autonomy.planningTrace.considered.map(
            (option) => ({ ...option, provenance: "route-scaffold" }),
          ),
        },
      },
    },
  ];
  for (const probe of invalidProbes) {
    assert.equal(
      isPostFirstAfternoonHandoffPendingProbe(probe),
      false,
      "Completed, stale, incomplete, or scaffold-only state must not qualify as a post-afternoon reorientation dwell.",
    );
  }
}

function assertYardNotebookCommitmentGuard() {
  assert.equal(
    yardNotebookPlanNamesCommitment("Take Freight yard lift"),
    true,
    "An accepted named freight job must remain valid yard-work Notebook evidence.",
  );
  assert.equal(
    yardNotebookPlanNamesCommitment(
      "Ask Tomas before the North Crane Yard freight window closes.",
    ),
    true,
    "A person- and deadline-grounded yard plan must remain valid Notebook evidence.",
  );
  assert.equal(
    yardNotebookPlanNamesCommitment("Head to North Crane Yard"),
    false,
    "A route-only yard plan must not satisfy the Notebook commitment evidence gate.",
  );
}

function assertIndependentNpcSurfaceRefreshGuard() {
  assert.equal(
    shouldRefreshVisibleIndependentNpcSurface({
      label: "independent-npc-resolution",
      probe: {
        independentNpcActions: [{ subjectId: "job-yard-shift" }],
        independentNpcSurface: null,
        playback: { activeKind: null, queuedCount: 0 },
      },
    }),
    true,
    "A settled browser probe with a new independent action must still wait for its player-facing rail beat.",
  );
  assert.equal(
    shouldRefreshVisibleIndependentNpcSurface({
      label: "independent-npc-resolution",
      probe: {
        independentNpcActions: [{ subjectId: "job-yard-shift" }],
        independentNpcSurface: { title: "Tomas closed the yard load" },
      },
    }),
    false,
    "A captured independent-action rail beat must not trigger a redundant refresh wait.",
  );
  const jumpedAction = {
    actionKind: "problem_resolution",
    actorNpcId: "npc-mara",
    afterStatus: "resolved",
    beforeStatus: "active",
    locationId: "courtyard",
    occurredAt: "2026-03-21T17:33:00.000Z",
    playerFacingSummary: "Mara contained the leaking hand pump.",
    problemId: "problem-pump",
    problemTitle: "Leaking hand pump",
    resolverName: "Mara",
    resolverNpcId: "npc-mara",
    subjectId: "problem-pump",
  };
  const jumpedEvidence = buildIndependentNpcActionEvidence([
    {
      clock: { iso: "2026-03-21T18:23:00.000Z" },
      independentNpcActions: [jumpedAction],
      independentNpcSurface: jumpedAction,
      label: "independent-npc-resolution",
      screenshot: "independent-npc-resolution.png",
    },
  ]);
  assert.equal(
    jumpedEvidence.surfacedActions[0]?.surfacedAtFirstObservedMoment,
    true,
    "Independent-action evidence must record a rail beat shown at its first observable moment.",
  );
  assert.equal(
    independentNpcSurfaceIsTimely(jumpedEvidence.surfacedActions[0]),
    true,
    "An independent action created during a sim-time jump may surface at the first browser-observable moment after that jump.",
  );
  assert.equal(
    independentNpcSurfaceIsTimely({
      ...jumpedAction,
      surfaceDelayMinutes: 50,
      surfacedAtFirstObservedMoment: false,
    }),
    false,
    "A genuinely late independent-action surface must still fail the browser evidence gate.",
  );
}

function assertInhabitPlayerDom(
  label,
  dom,
  controlCandidate = null,
  probe = null,
) {
  assert.ok(dom, `${label}: expected a browser DOM snapshot.`);
  assert.equal(
    dom.hasFrameworkErrorOverlay,
    false,
    `${label}: browser rendered a framework/runtime error overlay.`,
  );
  assert.equal(dom.hasCanvas, true, `${label}: game canvas is missing.`);
  assert.equal(dom.hasRail, true, `${label}: Rowan rail is missing.`);
  assert.match(
    dom.bodyText,
    /Rowan/i,
    `${label}: player-facing UI does not identify Rowan.`,
  );
  assert.ok(
    dom.tabLabels.some((tab) => /World/i.test(tab)) &&
      dom.tabLabels.some((tab) => /Locals/i.test(tab)) &&
      dom.tabLabels.some((tab) => /Journal/i.test(tab)) &&
      dom.tabLabels.some((tab) => /Notebook/i.test(tab)),
    `${label}: player-facing tabs are not all reachable.`,
  );
  assert.doesNotMatch(
    dom.bodyText,
    /Planner trace|Rejected:|Blocked:|Action:/i,
    `${label}: default player view leaked debug/planner language.`,
  );
  if (probe?.autonomy?.planningTrace) {
    assertVisibleDecisionArtifactPayload(
      `${label} probe`,
      probe.autonomy.visibleDecisionArtifact,
    );
    assertVisibleDecisionNextCheckForTrace(
      `${label} probe`,
      probe.autonomy.planningTrace,
      probe.autonomy.visibleDecisionArtifact,
    );
    assertVisibleDecisionSelectedActionMatchesImmediateStep(
      `${label} probe`,
      probe.autonomy.planningTrace,
      probe.autonomy.visibleDecisionArtifact,
      probe.autonomy,
    );
    assertVisibleDecisionArtifactDom(
      label,
      dom,
      probe.autonomy.visibleDecisionArtifact,
    );
  }
  assertNoUnavailableApproachAdvice(label, probe, dom);
  assertNoVisibleWatchModeProgressionControls(label, probe, dom);

  const complete = /first afternoon complete/i.test(dom.bodyText);
  const autoContinuing = Boolean(probe?.autonomy?.autoContinue);
  if (!complete && !autoContinuing) {
    assert.ok(
      controlCandidate,
      `${label}: expected a visible next player control before completion.`,
    );
    assert.ok(
      controlCandidate.text.length > 0,
      `${label}: visible player control has no readable label.`,
    );
  }

  assertCriticalVisualCoherence(label, dom);
}

async function waitForInhabitSettled(session, label) {
  return waitFor(
    async () => {
      const probe = await session.readBrowserProbe(`${label}:browser-probe`);
      if (!probe) {
        return null;
      }
      if (probe.visualPlayer?.isMovingToServerState) {
        return null;
      }
      if (
        probe.playback?.activeKind ||
        (probe.playback?.queuedCount ?? 0) > 0
      ) {
        return null;
      }
      if (
        probe.watchMode?.enabled &&
        !probe.watchMode?.frozen &&
        (probe.autonomy?.autoContinue ||
          isFirstAfternoonCompletionPendingProbe(probe)) &&
        !probe.timing?.autoContinue
      ) {
        return null;
      }
      return probe;
    },
    75_000,
    `${label}: timed out waiting for the player-facing run to settle.`,
  );
}

async function waitForInhabitTransition(
  session,
  beforeProgressSignature,
  label,
) {
  return waitFor(
    async () => {
      const probe = await session.readBrowserProbe(`${label}:browser-probe`);
      if (
        !probe ||
        playerGameProgressSignature(probe) === beforeProgressSignature
      ) {
        return null;
      }
      if (probe.visualPlayer?.isMovingToServerState) {
        return null;
      }
      if (
        probe.playback?.activeKind ||
        (probe.playback?.queuedCount ?? 0) > 0
      ) {
        return null;
      }
      return probe;
    },
    75_000,
    `${label}: visible player control did not advance the run.`,
  );
}

function isFirstAfternoonCompletionPendingProbe(probe) {
  return Boolean(
    probe?.firstAfternoon?.completedAt &&
    !probe?.firstAfternoon?.completionAcknowledgedAt &&
    /first afternoon complete/i.test(probe?.autonomy?.label ?? ""),
  );
}

function isPostFirstAfternoonHandoffPendingProbe(probe) {
  const progressCompleted = probe?.objective?.progress?.completed;
  const progressTotal = probe?.objective?.progress?.total;
  const selected = selectedPlanningEvidence(probe);
  return Boolean(
    probe?.firstAfternoon?.completionAcknowledgedAt &&
      probe?.objective?.source === "dynamic" &&
      probe?.objective?.routeKey &&
      probe.objective.routeKey !== "first-afternoon" &&
      !/first afternoon complete/i.test(probe?.autonomy?.label ?? "") &&
      Number.isFinite(progressCompleted) &&
      Number.isFinite(progressTotal) &&
      progressTotal > 0 &&
      progressCompleted >= 0 &&
      progressCompleted < progressTotal &&
      Boolean(selected.actionId) &&
      selected.legalBacking?.source === "current-legal-action-surface" &&
      Boolean(
        selected.pressureId ||
          selected.pressureKind ||
          selected.matchedOutcomeId,
      ) &&
      Boolean(selected.provenance) &&
      !SCAFFOLD_ONLY_TRACE_PROVENANCES.has(selected.provenance),
  );
}

async function waitForInhabitCameraProbe(session, label) {
  return waitFor(
    async () => {
      const probe = await session.readCameraProbe(`${label}:camera-probe`);
      if (probe?.scroll && probe?.sceneViewportCss) {
        return probe;
      }
      return null;
    },
    20_000,
    `${label}: camera probe never exposed player camera state.`,
  );
}

function worldPointToViewportPoint(camera, worldPoint, label) {
  assert.ok(
    camera?.sceneViewportCss,
    `${label}: missing scene viewport bounds.`,
  );
  assert.ok(
    camera?.visibleWorldRect,
    `${label}: missing visible world bounds.`,
  );
  assert.ok(worldPoint, `${label}: missing Rowan world point.`);

  const viewport = camera.sceneViewportCss;
  const visible = camera.visibleWorldRect;
  assert.ok(
    visible.width > 0 && visible.height > 0,
    `${label}: visible world bounds are empty.`,
  );

  const point = {
    x:
      viewport.x +
      ((worldPoint.x - visible.left) / visible.width) * viewport.width,
    y:
      viewport.y +
      ((worldPoint.y - visible.top) / visible.height) * viewport.height,
  };

  assert.ok(
    point.x >= viewport.x &&
      point.x <= viewport.x + viewport.width &&
      point.y >= viewport.y &&
      point.y <= viewport.y + viewport.height,
    `${label}: Rowan click point is outside the scene viewport: ${JSON.stringify(
      { point, viewport, visible, worldPoint },
    )}`,
  );

  return point;
}

function chooseInhabitCameraDragCenter(camera) {
  const viewport = camera.sceneViewportCss;
  const playerPoint = camera.playerWorldPoint
    ? worldPointToViewportPoint(
        camera,
        camera.playerWorldPoint,
        "inhabit-camera-drag-origin",
      )
    : null;
  const candidates = [
    {
      x: viewport.x + viewport.width * 0.72,
      y: viewport.y + viewport.height * 0.34,
    },
    {
      x: viewport.x + viewport.width * 0.28,
      y: viewport.y + viewport.height * 0.34,
    },
    {
      x: viewport.x + viewport.width * 0.72,
      y: viewport.y + viewport.height * 0.64,
    },
    {
      x: viewport.x + viewport.width * 0.28,
      y: viewport.y + viewport.height * 0.64,
    },
    {
      x: viewport.x + viewport.width * 0.5,
      y: viewport.y + viewport.height * 0.28,
    },
  ];

  return (
    candidates.find(
      (candidate) =>
        !playerPoint || pointDistance(candidate, playerPoint) >= 140,
    ) ?? candidates[0]
  );
}

async function closeInhabitSupportPanel(session) {
  const openToggle = await session.readVisibleElementRect(
    '[data-toggle-support][aria-expanded="true"]',
    "inhabit-support-open-toggle",
  );
  if (!openToggle) {
    const clicked = await session.evaluate(`(() => {
      const toggle = document.querySelector('[data-toggle-support][aria-expanded="true"]');
      if (!toggle) {
        return false;
      }
      toggle.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      return true;
    })()`);
    if (clicked) {
      await sleep(200);
    }
    return clicked;
  }

  await session.dispatchMouseClick(
    openToggle.rect.centerX,
    openToggle.rect.centerY,
  );
  await sleep(200);
  return true;
}

async function captureInhabitMoment({
  index,
  label,
  moments,
  probeOverride,
  session,
  userQuestion,
}) {
  await closeInhabitSupportPanel(session);
  let probe = probeOverride ?? (await waitForInhabitSettled(session, label));
  let dom = probe.independentNpcSurface
    ? await waitForInhabitIndependentNpcSurfaceDom(session, label, probe)
    : await session.readDomSnapshot(`${label}:dom-snapshot`);
  const isCoherentMoment = (candidateProbe, candidateDom) => {
    const missingWatchConversationCopy =
      candidateProbe.watchMode?.enabled &&
      !candidateProbe.watchMode.frozen &&
      candidateProbe.activeConversation &&
      !hasVisibleWatchModeConversationCopy(candidateDom);
    const decisionPayload = candidateProbe.autonomy?.planningTrace
      ? candidateProbe.autonomy.visibleDecisionArtifact
      : null;
    return (
      !missingWatchConversationCopy &&
      visibleDecisionArtifactMatchesDom(candidateDom, decisionPayload)
    );
  };
  if (!isCoherentMoment(probe, dom)) {
    const coherentMoment = await waitFor(
      async () => {
        const latestProbe = await session.readBrowserProbe(
          `${label}:coherent-browser-probe`,
        );
        if (
          !latestProbe ||
          latestProbe.visualPlayer?.isMovingToServerState ||
          latestProbe.playback?.activeKind ||
          (latestProbe.playback?.queuedCount ?? 0) > 0
        ) {
          return null;
        }

        const latestDom = await session.readDomSnapshot(
          `${label}:coherent-dom-snapshot`,
        );
        if (!isCoherentMoment(latestProbe, latestDom)) {
          return null;
        }

        return { dom: latestDom, probe: latestProbe };
      },
      15_000,
      `${label}: timed out waiting for coherent player-facing evidence.`,
    );
    probe = coherentMoment.probe;
    dom = coherentMoment.dom;
  }
  const latestProbeForArtifact =
    probe.autonomy?.visibleDecisionArtifact || probe.rail?.visibleDecisionArtifact
      ? null
      : probe.independentNpcSurface
        ? await session
            .readBrowserProbe(`${label}:artifact-browser-probe`)
            .catch(() => null)
        : null;
  const controlCandidate = await session.readPlayerControlCandidate(
    `${label}:player-control-candidate`,
  );
  assertInhabitPlayerDom(label, dom, controlCandidate, probe);
  const camera = await session
    .readCameraProbe(`${label}:camera-probe`)
    .catch(() => null);
  const screenshot = path.join(
    OUTPUT_DIR,
    `inhabit-${String(index).padStart(2, "0")}-${slug(label)}.png`,
  );
  await session.captureScreenshot(screenshot);
  const moment = {
    activeConversation: probe.activeConversation?.npcId ?? null,
    autonomy: probe.autonomy ?? null,
    autonomyLabel: probe.autonomy?.label ?? null,
    clock: probe.clock,
    control: controlCandidate
      ? {
          actionId: controlCandidate.actionId ?? null,
          advancesObjective: Boolean(controlCandidate.advancesObjective),
          selector: controlCandidate.selector,
          text: controlCandidate.text,
          waitMinutes: controlCandidate.waitMinutes ?? null,
        }
      : null,
    firstAfternoon: probe.firstAfternoon,
    feedTail: probe.feedTail ?? [],
    independentNpcActions: probe.independentNpcActions ?? [],
    independentNpcSurface: probe.independentNpcSurface ?? null,
    label,
    location: probe.location,
    memoriesTail: probe.memoriesTail ?? [],
    movement: probe.movement ?? null,
    notebook: compactCognitionNotebook(probe),
    objective: probe.objective ?? null,
    openingActionCarryForward: probe.openingActionCarryForward ?? null,
    player: probe.player ?? null,
    screenshot,
    userQuestion,
    visibleDecisionArtifact:
      probe.autonomy?.visibleDecisionArtifact ??
      probe.rail?.visibleDecisionArtifact ??
      latestProbeForArtifact?.autonomy?.visibleDecisionArtifact ??
      latestProbeForArtifact?.rail?.visibleDecisionArtifact ??
      null,
    visualEventCues: probe.visualEventCues ?? [],
    worldPressure: compactWorldPressureSnapshot(probe.worldPressure),
    camera: camera
      ? {
          scroll: camera.scroll ?? null,
          scrollRange: camera.scrollRange ?? null,
          visibleWorldRect: camera.visibleWorldRect ?? null,
        }
      : null,
  };
  moments.push(moment);
  return moment;
}

async function waitForInhabitIndependentNpcSurfaceDom(session, label, probe) {
  const surface = probe.independentNpcSurface;
  return waitFor(
    async () => {
      const dom = await session.readDomSnapshot(
        `${label}:independent-npc-surface-dom`,
      );
      if (domContainsIndependentNpcSurface(dom, surface)) {
        return dom;
      }
      return null;
    },
    5_000,
    `${label}: independent NPC surface reached the probe but not the visible browser text.`,
  );
}

function domContainsIndependentNpcSurface(dom, surface) {
  const bodyText = dom?.bodyText ?? "";
  if (!surface || !bodyText) {
    return false;
  }

  const title = surface.title ?? "";
  const detail = surface.detail ?? "";
  return [title, detail]
    .filter((text) => text.length >= 12)
    .some((text) => bodyText.includes(text.slice(0, 48)));
}

function compactInhabitReportMoment(moment) {
  const reportMoment = { ...moment };
  delete reportMoment.movement;
  return reportMoment;
}

function compactCognitionNotebook(probe) {
  const notebook = probe?.rowanCognition?.notebook;
  if (!notebook) {
    return null;
  }

  return {
    authority: {
      beliefId: notebook.authority?.beliefId ?? null,
      beliefSource: notebook.authority?.beliefSource ?? null,
      nextMoveActionId: notebook.authority?.nextMoveActionId ?? null,
      notebookNeedKey: notebook.authority?.notebookNeedKey ?? null,
      primaryNeedKey: notebook.authority?.primaryNeedKey ?? null,
    },
    belief: notebook.belief ?? null,
    clue: notebook.clue ?? null,
    confidence: notebook.confidence ?? null,
    plan: notebook.plan ?? null,
    title: notebook.title ?? null,
    uncertainty: notebook.uncertainty ?? null,
  };
}

function assertInhabitOpeningCtaProgression(moments) {
  const byLabel = Object.fromEntries(
    moments.map((moment) => [moment.label, moment]),
  );
  const firstActionable = byLabel["first-actionable-screen"];
  const enteredMorrowHouse = byLabel["entered-morrow-house"];

  const firstActionCarryForward = firstActionable?.openingActionCarryForward;
  assert.ok(
    firstActionCarryForward,
    "first-actionable-screen: expected opening carry-forward probe evidence.",
  );
  assert.equal(
    firstActionCarryForward.selectedActionId,
    "enter:boarding-house",
    `first-actionable-screen: expected the selected opening action to be Enter Morrow House: ${JSON.stringify(firstActionCarryForward)}.`,
  );
  assert.equal(
    firstActionCarryForward.selectedActionLabel,
    "Enter Morrow House",
    `first-actionable-screen: opening carry-forward label should describe the immediate enter action: ${JSON.stringify(firstActionCarryForward)}.`,
  );
  assert.equal(
    firstActionCarryForward.status,
    "queued",
    `first-actionable-screen: expected the exterior opening action to be queued for watch carry-forward: ${JSON.stringify(firstActionCarryForward)}.`,
  );
  assert.equal(
    firstActionCarryForward.requiredVisibleInput,
    false,
    `first-actionable-screen: watch-mode opening action should not require visible input: ${JSON.stringify(firstActionCarryForward)}.`,
  );
  assert.equal(
    firstActionable.control,
    null,
    `first-actionable-screen: watch mode should show carry-forward status, not an opening CTA control: ${JSON.stringify(firstActionable.control)}.`,
  );
  assert.equal(
    firstActionable.location?.spaceId,
    "street:south-quay",
    "first-actionable-screen: opening CTA evidence must come from the exterior street space.",
  );

  const enteredMorrowHouseWatchText =
    enteredMorrowHouse?.control?.text ??
    enteredMorrowHouse?.autonomyLabel ??
    "";
  assert.ok(
    enteredMorrowHouseWatchText,
    "entered-morrow-house: expected continued-watch or autonomy text.",
  );
  assert.equal(
    enteredMorrowHouse.location?.spaceId,
    "interior:boarding-house",
    "entered-morrow-house: CTA regression evidence must be captured inside Morrow House.",
  );
  assert.equal(
    enteredMorrowHouse?.openingActionCarryForward?.status,
    "completed",
    `entered-morrow-house: opening carry-forward should be completed after entering: ${JSON.stringify(enteredMorrowHouse?.openingActionCarryForward)}.`,
  );
  assert.equal(
    enteredMorrowHouse?.openingActionCarryForward?.selectedActionId,
    "enter:boarding-house",
    `entered-morrow-house: completed opening carry-forward should keep the immediate enter action id: ${JSON.stringify(enteredMorrowHouse?.openingActionCarryForward)}.`,
  );
  assert.equal(
    enteredMorrowHouse?.openingActionCarryForward?.selectedActionLabel,
    "Enter Morrow House",
    `entered-morrow-house: completed opening carry-forward should not relabel the enter action as Mara follow-up intent: ${JSON.stringify(enteredMorrowHouse?.openingActionCarryForward)}.`,
  );
  assert.doesNotMatch(
    enteredMorrowHouseWatchText,
    OPENING_CTA_PATTERN,
    "entered-morrow-house: opening CTA text must not persist after Rowan enters Morrow House.",
  );
  assert.match(
    enteredMorrowHouseWatchText,
    /Continue watching|Talk to Mara|Mara/i,
    "entered-morrow-house: expected established continued-watch or Mara objective copy after the opening beat.",
  );
}

function assertInhabitSituatedWatchCtaCopy(moments) {
  const byLabel = Object.fromEntries(
    moments.map((moment) => [moment.label, moment]),
  );
  const expectations = [
    {
      label: "entered-morrow-house",
      pattern: /Mara|talk|ask/i,
      reason:
        "entered-morrow-house: continued-watch copy should describe asking or talking to Mara.",
    },
    {
      label: "approaches-known",
      reason:
        "approaches-known: continued-watch copy should remain situated and non-generic.",
    },
    {
      label: "durable-consequence",
      reason:
        "durable-consequence: continued-watch copy should remain situated and non-generic.",
    },
  ];

  for (const expectation of expectations) {
    const moment = byLabel[expectation.label];
    const visibleWatchText =
      moment?.control?.text ?? moment?.autonomyLabel ?? "";
    assert.ok(
      visibleWatchText,
      `${expectation.label}: expected continued-watch or autonomy text.`,
    );
    assert.doesNotMatch(
      visibleWatchText,
      GENERIC_WATCH_CTA_COPY_PATTERN,
      `${expectation.label}: continued-watch copy regressed to generic beat-landing copy.`,
    );
    if (expectation.pattern) {
      assert.match(visibleWatchText, expectation.pattern, expectation.reason);
    }
  }
}

function assertInhabitLocalsPanelSemantics(label, localsPanel) {
  assert.ok(localsPanel, `${label}: missing Locals panel section probe.`);
  assert.match(
    localsPanel.nearbyText,
    /Mara/i,
    `${label}: nearby Locals section should keep Mara visible at the opening.`,
  );
  assert.doesNotMatch(
    localsPanel.nearbyText,
    /Ada|Jo|Tomas|Nia/i,
    `${label}: nearby Locals section listed remote NPCs as in-reach people.`,
  );
  assert.match(
    localsPanel.rosterText,
    /South Quay Roster|heard about|moving through the district/i,
    `${label}: remote Locals section should be framed as a wider South Quay roster.`,
  );
  assert.doesNotMatch(
    localsPanel.bodyText,
    /People Rowan can approach in Morrow House/i,
    `${label}: Locals panel used stale in-reach copy for the broader roster.`,
  );
  assert.ok(
    localsPanel.nearbyMaraVisible,
    `${label}: Mara's nearby person card should be visible in the initial Locals screenshot. ${JSON.stringify(
      localsPanel.nearbyMaraRect,
    )}`,
  );
  assert.equal(
    localsPanel.placeholderCardText,
    "",
    `${label}: opening Locals panel should not render a blank character-card placeholder when a nearby person is available.`,
  );
  assert.match(
    localsPanel.focusedPersonCardText,
    /Mara/i,
    `${label}: opening Locals panel should default the focused character card to nearby Mara.`,
  );
  assert.match(
    localsPanel.focusedPersonCardText,
    /Current Objective/i,
    `${label}: focused Mara card should expose her current objective.`,
  );
  assert.match(
    localsPanel.focusedPersonCardText,
    /Current Concern/i,
    `${label}: focused Mara card should expose her current concern.`,
  );
}

async function runInhabitPanelChecks(session) {
  const checks = [];
  const panels = [
    {
      expectedTab: "people",
      label: "inhabit-panel-locals",
      selector: '[data-tab="people"]',
      text: /Mara|South Quay Roster|Rowan/i,
    },
    {
      expectedTab: "journal",
      label: "inhabit-panel-journal",
      selector: '[data-tab="journal"]',
      text: /Journal|Objectives|Field/i,
    },
    {
      expectedTab: "mind",
      label: "inhabit-panel-notebook",
      selector: '[data-tab="mind"]',
      text: /(?=.*Notebook)(?=.*City Pulse)(?=.*South Quay is moving)/is,
    },
  ];

  for (const panel of panels) {
    await session.clickVisibleSelector(panel.selector);
    await sleep(250);
    const dom = await session.readDomSnapshot(`${panel.label}:dom-snapshot`);
    assert.equal(
      dom.activeTab,
      panel.expectedTab,
      `${panel.label}: expected ${panel.expectedTab} tab to become active.`,
    );
    assert.match(
      dom.bodyText,
      panel.text,
      `${panel.label}: expected player-readable panel content.`,
    );
    const localsPanel =
      panel.label === "inhabit-panel-locals"
        ? await session.evaluate(`(() => {
            const textFor = (selector) =>
              document
                .querySelector(selector)
                ?.textContent
                ?.replace(/\\s+/g, " ")
                .trim() ?? "";
            const rectFor = (selector) => {
              const element = document.querySelector(selector);
              if (!element) {
                return null;
              }
              const rect = element.getBoundingClientRect();
              return {
                bottom: Math.round(rect.bottom),
                height: Math.round(rect.height),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
              };
            };
            const nearbyMaraRect = rectFor('[data-locals-nearby] [data-select-npc="npc-mara"]');
            const visibleHeight = nearbyMaraRect
              ? Math.min(nearbyMaraRect.bottom, window.innerHeight) -
                Math.max(nearbyMaraRect.top, 0)
              : 0;
            return {
              bodyText: document.body?.innerText?.replace(/\\s+/g, " ").trim() ?? "",
              focusedPersonCardText: textFor("[data-locals-person-card]"),
              nearbyMaraRect,
              nearbyMaraVisible:
                Boolean(nearbyMaraRect) &&
                nearbyMaraRect.width > 0 &&
                nearbyMaraRect.height > 0 &&
                visibleHeight >= Math.min(nearbyMaraRect.height, 72),
              nearbyText: textFor("[data-locals-nearby]"),
              placeholderCardText: textFor("[data-locals-placeholder-card]"),
              rosterText: textFor("[data-locals-roster]"),
            };
          })()`)
        : null;
    if (localsPanel) {
      assertInhabitLocalsPanelSemantics(panel.label, localsPanel);
    }
    assertCriticalVisualCoherence(panel.label, dom, {
      expectFocusWindow: true,
    });
    const screenshot = path.join(OUTPUT_DIR, `${panel.label}.png`);
    await session.captureScreenshot(screenshot);
    checks.push({
      activeTab: dom.activeTab,
      bodyTextSample: dom.bodyTextSample,
      label: panel.label,
      localsPanel,
      screenshot,
    });
  }

  await closeInhabitFocusPanel(session, "inhabit-panel-close");

  return checks;
}

async function runInhabitRowanNotebookClickCheck(session) {
  const label = "inhabit-rowan-click-notebook";
  const camera = await waitForInhabitCameraProbe(session, label);
  const avatarWorldPoint = {
    x: camera.playerWorldPoint.x,
    y: camera.playerWorldPoint.y + 96,
  };
  const clickPoint = worldPointToViewportPoint(camera, avatarWorldPoint, label);

  await session.evaluate(`(() => {
    window.__manyLivesRowanClickEvents = [];
    const record = (event) => {
      window.__manyLivesRowanClickEvents.push({
        button: "button" in event ? event.button : null,
        buttons: "buttons" in event ? event.buttons : null,
        clientX: "clientX" in event ? Math.round(event.clientX) : null,
        clientY: "clientY" in event ? Math.round(event.clientY) : null,
        defaultPrevented: event.defaultPrevented,
        path: typeof event.composedPath === "function"
          ? event.composedPath().slice(0, 6).map((target) => {
              if (!(target instanceof Element)) {
                return target === window ? "WINDOW" : target === document ? "DOCUMENT" : String(target);
              }
              const id = target.id ? \`#\${target.id}\` : "";
              const className = typeof target.className === "string" && target.className
                ? \`.\${target.className.trim().replace(/\\s+/g, ".")}\`
                : "";
              return \`\${target.tagName}\${id}\${className}\`;
            })
          : [],
        target: event.target instanceof Element ? event.target.tagName : String(event.target),
        type: event.type,
      });
    };
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click"]) {
      document.addEventListener(type, record, { capture: true });
    }
  })()`);
  await session.dispatchMouseClick(clickPoint.x, clickPoint.y);
  await sleep(300);

  const dom = await session.readDomSnapshot(`${label}:dom-snapshot`);
  const clickDebug = await session.evaluate(`(() => {
    const target = document.elementFromPoint(${JSON.stringify(
      Math.round(clickPoint.x),
    )}, ${JSON.stringify(Math.round(clickPoint.y))});
    return {
      activeTab: ${JSON.stringify(dom.activeTab)},
      bodyTextSample: ${JSON.stringify(dom.bodyTextSample)},
      camera: ${JSON.stringify({
        playerWorldPoint: camera.playerWorldPoint,
        sceneViewportCss: camera.sceneViewportCss,
        visibleWorldRect: camera.visibleWorldRect,
      })},
      clickPoint: ${JSON.stringify({
        x: Math.round(clickPoint.x),
        y: Math.round(clickPoint.y),
      })},
      recordedEvents: window.__manyLivesRowanClickEvents ?? [],
      elementFromPoint: target
        ? {
            className: target.className || null,
            id: target.id || null,
            tagName: target.tagName,
            text: target.textContent?.replace(/\\s+/g, " ").trim().slice(0, 160) ?? "",
          }
        : null
    };
  })()`);
  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await session.captureScreenshot(screenshot);
  assert.equal(
    dom.activeTab,
    "mind",
    `${label}: clicking Rowan should open the Notebook tab. ${JSON.stringify({
      clickDebug,
      screenshot,
    })}`,
  );

  for (const expectedText of [
    /Rowan's Notebook/i,
    /Current Belief/i,
    /Current Plan/i,
    /Confidence/i,
    /Next Uncertainty/i,
  ]) {
    assert.match(
      dom.bodyText,
      expectedText,
      `${label}: Rowan click did not reveal the expected Notebook content.`,
    );
  }
  const probe = await session.readBrowserProbe(`${label}:browser-probe`);
  assertNotebookUsesCognitionAuthority(label, dom, probe);

  assertCriticalVisualCoherence(label, dom, {
    expectFocusWindow: true,
  });

  const focusClose = await closeInhabitFocusPanel(session, `${label}-close`);

  return {
    activeTab: dom.activeTab,
    bodyTextSample: dom.bodyTextSample,
    clickPoint: {
      x: Math.round(clickPoint.x),
      y: Math.round(clickPoint.y),
    },
    focusClose,
    label,
    screenshot,
  };
}

async function runInhabitCameraCheck(session) {
  const focusClose = await closeInhabitFocusPanel(
    session,
    "inhabit-camera-precheck",
  );
  const before = await waitForInhabitCameraProbe(session, "inhabit-camera");
  const viewport = before.sceneViewportCss;
  const center = chooseInhabitCameraDragCenter(before);
  const drags = [
    {
      from: center,
      label: "west-look",
      to: { x: center.x - viewport.width * 0.18, y: center.y },
    },
    {
      from: center,
      label: "east-look",
      to: { x: center.x + viewport.width * 0.18, y: center.y },
    },
    {
      from: center,
      label: "north-look",
      to: { x: center.x, y: center.y - viewport.height * 0.14 },
    },
    {
      from: center,
      label: "south-look",
      to: { x: center.x, y: center.y + viewport.height * 0.14 },
    },
  ];
  const observations = [];
  let previous = before;

  for (const drag of drags) {
    await session.dispatchMouseDrag(drag.from, drag.to);
    await sleep(350);
    const after = await waitForInhabitCameraProbe(
      session,
      `inhabit-camera-${drag.label}`,
    );
    const delta = inhabitCameraDelta(previous, after);
    observations.push({
      delta,
      label: drag.label,
      scroll: after.scroll,
      scrollRange: after.scrollRange,
      visibleWorldRect: after.visibleWorldRect,
    });
    previous = after;
  }

  const screenshot = path.join(OUTPUT_DIR, "inhabit-camera-after-drags.png");
  await session.captureScreenshot(screenshot);

  const moved = observations.some(
    (entry) => Math.abs(entry.delta.x) >= 8 || Math.abs(entry.delta.y) >= 8,
  );
  const panRange = inhabitCameraPanRange(before);
  const movementRequired = inhabitCameraHasMeaningfulPanRange(before);
  if (movementRequired) {
    assert.equal(
      moved,
      true,
      `inhabit-camera: player drags did not visibly move the camera despite available pan range. ${JSON.stringify(
        {
          before: {
            dragCenter: center,
            scroll: before.scroll,
            scrollRange: before.scrollRange,
            visibleWorldRect: before.visibleWorldRect,
          },
          observations,
          panRange,
          screenshot,
        },
      )}`,
    );
  }

  return {
    before: {
      dragCenter: center,
      scroll: before.scroll,
      scrollRange: before.scrollRange,
      visibleWorldRect: before.visibleWorldRect,
    },
    moved,
    movementRequired,
    focusClose,
    observations,
    panRange,
    screenshot,
  };
}

async function clickUntilInhabitMilestone({
  clickLog,
  maxClicks,
  milestone,
  scheduledNpcObservations,
  objectiveSequenceAudit,
  session,
}) {
  for (let attempt = 0; attempt <= maxClicks; attempt += 1) {
    const probe = await waitForInhabitSettled(
      session,
      `${milestone.label}-settled-${attempt}`,
    );
    recordInhabitScheduledNpcObservation({
      attempt,
      milestoneLabel: milestone.label,
      observations: scheduledNpcObservations,
      probe,
    });
    if (milestone.reached(probe)) {
      return probe;
    }

    if (attempt === maxClicks) {
      break;
    }

    const beforeProgressSignature = playerGameProgressSignature(probe);
    const completionAutoContinue =
      isFirstAfternoonCompletionPendingProbe(probe);
    const handoffReorientation =
      isPostFirstAfternoonHandoffPendingProbe(probe);
    if (
      probe.watchMode?.enabled &&
      !probe.watchMode?.frozen &&
      (probe.autonomy?.autoContinue || completionAutoContinue)
    ) {
      const dom = await session
        .readDomSnapshot(`${milestone.label}:watch-dom-snapshot`)
        .catch(() => null);
      const auditEntry = buildObjectiveSequenceAuditEntry({
        control: null,
        dom,
        kind: "watched-auto-continue",
        milestone: milestone.label,
        probe,
      });
      objectiveSequenceAudit.push(auditEntry);
      assert.equal(
        auditEntry.failureReasons.length,
        0,
        `${milestone.label}: objective-sequence audit failed before watch beat: ${JSON.stringify(
          auditEntry,
          null,
          2,
        )}`,
      );
      const logEntry = {
        autoContinueElapsedAtProbeMs:
          probe.timing?.autoContinue?.elapsedMs ?? null,
        autoContinueIntendedDelayMs:
          probe.timing?.autoContinue?.intendedDelayMs ?? null,
        autoContinueKey: probe.timing?.autoContinue?.key ?? null,
        autoContinueStartedAtMs:
          probe.timing?.autoContinue?.startedAtMs ?? null,
        beforeAutonomyLabel: probe.autonomy?.label ?? null,
        beforeClock: probe.clock,
        beforeLocation: probe.location,
        beforeObjectiveRouteKey: probe.objective?.routeKey ?? null,
        beforeObjectiveText: probe.objective?.text ?? null,
        completionAutoContinue,
        handoffReorientation,
        objectiveSequenceAuditIndex: objectiveSequenceAudit.length - 1,
        kind: "watched-auto-continue",
        milestone: milestone.label,
        sequenceRunId: objectiveSequenceGroupIdForEntry(auditEntry),
        text: completionAutoContinue
          ? "Watched autoplay dwell on the completion field note, then open the next live objective."
          : handoffReorientation
            ? "Watched autoplay dwell on the first state-derived post-afternoon objective before acting."
            : "Watched autoplay carry the beat.",
      };
      clickLog.push(logEntry);
      const startedAt = Date.now();
      if (completionAutoContinue || handoffReorientation) {
        logEntry.readabilityWaitMs =
          remainingFirstAfternoonReadabilityCheckpointMs(
            logEntry.autoContinueElapsedAtProbeMs,
          );
        await sleep(logEntry.readabilityWaitMs);
        const readabilityProbe = await session.readBrowserProbe(
          `${milestone.label}-readability-checkpoint-${attempt + 1}`,
        );
        logEntry.readabilityCheckpointMs = Date.now() - startedAt;
        logEntry.readabilityCheckpointFromBeatStartMs =
          typeof logEntry.autoContinueElapsedAtProbeMs === "number"
            ? logEntry.autoContinueElapsedAtProbeMs +
              logEntry.readabilityCheckpointMs
            : logEntry.readabilityCheckpointMs;
        logEntry.readabilityStateStable =
          playerGameProgressSignature(readabilityProbe) ===
          beforeProgressSignature;
        logEntry.readabilityObjectiveRouteKey =
          readabilityProbe?.objective?.routeKey ?? null;
        assert.equal(
          logEntry.readabilityStateStable,
          true,
          `${milestone.label}: ${
            completionAutoContinue
              ? "first-afternoon completion"
              : "post-first-afternoon reorientation"
          } changed before a human-readable checkpoint: ${JSON.stringify(
            {
              before: {
                autonomy: probe.autonomy,
                clock: probe.clock,
                objective: probe.objective,
              },
              checkpoint: {
                autonomy: readabilityProbe?.autonomy,
                clock: readabilityProbe?.clock,
                objective: readabilityProbe?.objective,
              },
              checkpointMs: logEntry.readabilityCheckpointMs,
            },
            null,
            2,
          )}`,
        );
      }
      const transitionedProbe = await waitForInhabitTransition(
        session,
        beforeProgressSignature,
        `${milestone.label}-watch-${attempt + 1}`,
      );
      logEntry.durationMs = Date.now() - startedAt;
      const beforeAppMonotonicMs = probe.timing?.appMonotonicMs;
      const afterAppMonotonicMs = transitionedProbe.timing?.appMonotonicMs;
      logEntry.beforeAppMonotonicMs = beforeAppMonotonicMs ?? null;
      logEntry.afterAppMonotonicMs = afterAppMonotonicMs ?? null;
      logEntry.appDurationMs =
        typeof beforeAppMonotonicMs === "number" &&
        typeof afterAppMonotonicMs === "number"
          ? Math.max(0, afterAppMonotonicMs - beforeAppMonotonicMs)
          : null;
      logEntry.fullAppDurationMs =
        typeof logEntry.autoContinueStartedAtMs === "number" &&
        typeof afterAppMonotonicMs === "number"
          ? Math.max(
              0,
              afterAppMonotonicMs - logEntry.autoContinueStartedAtMs,
            )
          : typeof logEntry.autoContinueElapsedAtProbeMs === "number" &&
              typeof logEntry.appDurationMs === "number"
            ? logEntry.autoContinueElapsedAtProbeMs + logEntry.appDurationMs
            : null;
      await closeInhabitSupportPanel(session);
      continue;
    }

    let control = await session.readPlayerControlCandidate(
      `${milestone.label}:player-control-candidate`,
    );
    let openedSupportForControl = false;
    if (!control) {
      const supportToggle = await session.readVisibleElementRect(
        "[data-toggle-support]",
        `${milestone.label}:support-toggle`,
      );
      if (supportToggle) {
        await session.dispatchMouseClick(
          supportToggle.rect.centerX,
          supportToggle.rect.centerY,
        );
        openedSupportForControl = true;
      } else {
        openedSupportForControl = await session.clickSelector(
          "[data-toggle-support]",
        );
      }
      if (openedSupportForControl) {
        openedSupportForControl = true;
        await sleep(250);
        control = await session.readPlayerControlCandidate(
          `${milestone.label}:player-control-candidate-opened-support`,
        );
      }
    }
    if (!control) {
      const dom = await session
        .readDomSnapshot(`${milestone.label}:missing-control-dom-snapshot`)
        .catch(() => null);
      assert.fail(
        `${milestone.label}: expected a visible player control before clicking. State: ${JSON.stringify(
          {
            activeConversation: probe.activeConversation ?? null,
            autonomy: probe.autonomy ?? null,
            clock: probe.clock ?? null,
            firstAfternoon: probe.firstAfternoon ?? null,
            location: probe.location ?? null,
            text: dom?.bodyTextSample ?? null,
          },
          null,
          2,
        )}`,
      );
    }
    const dom = await session
      .readDomSnapshot(`${milestone.label}:pre-click-dom-snapshot`)
      .catch(() => null);
    const auditEntry = buildObjectiveSequenceAuditEntry({
      control,
      dom,
      kind: "visible-control-click",
      milestone: milestone.label,
      probe,
    });
    objectiveSequenceAudit.push(auditEntry);
    assert.equal(
      auditEntry.failureReasons.length,
      0,
      `${milestone.label}: objective-sequence audit failed before visible click: ${JSON.stringify(
        auditEntry,
        null,
        2,
      )}`,
    );
    await session.dispatchMouseClick(
      control.rect.centerX,
      control.rect.centerY,
    );
    clickLog.push({
      actionId: control.actionId ?? null,
      advancesObjective: Boolean(control.advancesObjective),
      beforeAutonomyLabel: probe.autonomy?.label ?? null,
      beforeClock: probe.clock,
      beforeLocation: probe.location,
      kind: "visible-control-click",
      objectiveSequenceAuditIndex: objectiveSequenceAudit.length - 1,
      openedSupportForControl,
      milestone: milestone.label,
      sequenceRunId: objectiveSequenceGroupIdForEntry(auditEntry),
      text: control.text,
      waitMinutes: control.waitMinutes ?? null,
    });
    await waitForInhabitTransition(
      session,
      beforeSignature,
      `${milestone.label}-click-${attempt + 1}`,
    );
    await closeInhabitSupportPanel(session);
  }

  const finalProbe = await session.readBrowserProbe(
    `${milestone.label}:final-browser-probe`,
  );
  assert.fail(
    `${milestone.label}: player-POV run did not reach milestone after ${maxClicks} visible clicks. Last state: ${JSON.stringify(
      {
        activeConversation: finalProbe?.activeConversation ?? null,
        autonomy: finalProbe?.autonomy ?? null,
        clock: finalProbe?.clock ?? null,
        firstAfternoon: finalProbe?.firstAfternoon ?? null,
        location: finalProbe?.location ?? null,
      },
      null,
      2,
    )}`,
  );
}

function recordInhabitScheduledNpcObservation({
  attempt,
  milestoneLabel,
  observations,
  probe,
}) {
  const movement = probe?.movement;
  if (
    !movement ||
    ((movement.scheduledNpcMarkerSamples?.length ?? 0) === 0 &&
      (movement.scheduledNpcVisualCues?.length ?? 0) === 0 &&
      (movement.scheduledNpcRoutes?.length ?? 0) === 0)
  ) {
    return;
  }

  observations.push({
    clock: probe.clock ?? null,
    evidenceForMilestone: milestoneLabel,
    label: `${milestoneLabel}-settled-${attempt}`,
    movement,
  });
}

async function watchUntilIndependentNpcResolution({
  maxWaitMs,
  session,
}) {
  const milestoneLabel = "independent-npc-resolution";
  let lastProbe = null;

  return waitFor(
    async () => {
      const probe = await session.readBrowserProbe(
        `${milestoneLabel}:browser-probe`,
      );
      if (!probe) {
        return null;
      }
      lastProbe = probe;

      if (
        (probe.independentNpcActions ?? []).length > 0 &&
        probe.independentNpcSurface
      ) {
        return probe;
      }

      const playbackPending = Boolean(
        probe.playback?.activeKind || (probe.playback?.queuedCount ?? 0) > 0,
      );
      if (
        !(
          probe.watchMode?.enabled &&
          (probe.autonomy?.autoContinue || playbackPending)
        )
      ) {
        const control = await session.readPlayerControlCandidate(
          `${milestoneLabel}:player-control-candidate`,
        );
        assert.fail(
          `${milestoneLabel}: observe/autoplay stopped before an independent NPC resolution surfaced. State: ${JSON.stringify(
            {
              autonomy: probe.autonomy ?? null,
              clock: probe.clock ?? null,
              control: control
                ? {
                    actionId: control.actionId ?? null,
                    text: control.text,
                    waitMinutes: control.waitMinutes ?? null,
                  }
                : null,
              independentNpcActions: probe.independentNpcActions ?? [],
              independentNpcSurface: probe.independentNpcSurface ?? null,
              location: probe.location ?? null,
              watchMode: probe.watchMode ?? null,
            },
            null,
            2,
          )}`,
        );
      }

      return null;
    },
    maxWaitMs,
    `${milestoneLabel}: player-POV run did not observe a surfaced independent NPC resolution. Last state: ${JSON.stringify(
      {
        autonomy: lastProbe?.autonomy ?? null,
        clock: lastProbe?.clock ?? null,
        independentNpcActions: lastProbe?.independentNpcActions ?? [],
        independentNpcSurface: lastProbe?.independentNpcSurface ?? null,
        location: lastProbe?.location ?? null,
        worldPressure: lastProbe?.worldPressure ?? null,
      },
      null,
      2,
    )}`,
  );
}

async function runInhabitGameplayPass(session) {
  const url = `${getWebBase()}?new=1&freezeAutoplay=1&inhabitGameplay=${Date.now()}`;
  await session.navigate(url);
  const moments = [];
  const clickLog = [];
  const objectiveSequenceAudit = [];
  const scheduledNpcObservations = [];
  const milestonesReached = [];
  let momentIndex = 0;

  await captureInhabitMoment({
    index: momentIndex++,
    label: "first-actionable-screen",
    moments,
    session,
    userQuestion:
      "As a new player, can I tell who Rowan is, where he is, and what I can do first?",
  });

  const rowanNotebookClick = await runInhabitRowanNotebookClickCheck(session);
  const panelChecks = await runInhabitPanelChecks(session);
  const cameraCheck = await runInhabitCameraCheck(session);
  const frozenProbe = await session.readBrowserProbe(
    "inhabit-frozen-browser-probe",
  );
  const watchUrl = `${getWebBase()}?gameId=${encodeURIComponent(
    frozenProbe.gameId,
  )}&inhabitGameplay=${Date.now()}`;
  await session.navigate(watchUrl);
  await waitForInhabitSettled(session, "inhabit-watch-mode-resumed");

  const milestones = [
    {
      label: "entered-morrow-house",
      maxClicks: 3,
      reached: (probe) => probe.location?.spaceId === "interior:boarding-house",
      userQuestion: "Does the first visible control take Rowan into the house?",
    },
    {
      label: "first-interaction",
      maxClicks: 4,
      reached: (probe) => Boolean(probe.activeConversation?.npcId),
      userQuestion: "Does the game clearly start a grounded human interaction?",
    },
    {
      label: "approaches-known",
      maxClicks: 6,
      reached: (probe) =>
        Boolean(probe.firstAfternoon?.approachesKnownAt) &&
        (probe.objective?.outcomes ?? []).some(
          (outcome) =>
            outcome.id === "first-afternoon-approaches" &&
            outcome.status === "met",
        ),
      userQuestion:
        "Does Rowan leave the opening interaction knowing more than one live approach?",
    },
    {
      label: "durable-consequence",
      maxClicks: 12,
      reached: (probe) =>
        Boolean(probe.firstAfternoon?.consequence) ||
        (probe.objective?.outcomes ?? []).some(
          (outcome) =>
            outcome.id === "first-afternoon-consequence" &&
            outcome.status === "met",
        ),
      userQuestion:
        "Does one chosen approach produce a durable work or local-help consequence?",
    },
    {
      label: "first-afternoon-complete",
      maxClicks: 18,
      reached: (probe) =>
        Boolean(probe.firstAfternoon?.completedAt) ||
        /first afternoon complete/i.test(probe.autonomy?.label ?? ""),
      userQuestion:
        "Can a player-driven session reach a natural stopping point without direct sim commands?",
    },
    {
      label: "post-first-afternoon-handoff",
      maxClicks: 4,
      reached: (probe) =>
        Boolean(probe.firstAfternoon?.completionAcknowledgedAt) &&
        probe.objective?.routeKey !== "first-afternoon" &&
        !/first afternoon complete/i.test(probe.autonomy?.label ?? ""),
      userQuestion:
        "After the field note, does Rowan open a fresh next objective from live state instead of staying on the completed first-afternoon route?",
    },
    {
      label: "post-first-afternoon-rest",
      maxClicks: 4,
      reached: postFirstAfternoonRestAdvancedProbe,
      userQuestion:
        "Does watch mode carry Rowan through the selected rest action without clicks and update the recovery state?",
    },
    {
      label: "post-first-afternoon-live-route",
      maxClicks: 4,
      reached: postFirstAfternoonLiveRouteProbe,
      userQuestion:
        "After resting, does Rowan choose a current-state live pressure route instead of looping on Morrow House or the first-afternoon scaffold?",
    },
    {
      label: "post-first-afternoon-yard-follow-through",
      maxClicks: 6,
      reached: postFirstAfternoonYardFollowThroughProbe,
      userQuestion:
        "Does the selected North Crane Yard pressure turn into a Tomas setup or legal yard-work action instead of stopping at a route target?",
    },
  ];

  for (const milestone of milestones) {
    const milestoneProbe = await clickUntilInhabitMilestone({
      clickLog,
      maxClicks: milestone.maxClicks,
      milestone,
      objectiveSequenceAudit,
      scheduledNpcObservations,
      session,
    });
    milestonesReached.push(milestone.label);
    await captureInhabitMoment({
      index: momentIndex++,
      label: milestone.label,
      moments,
      probeOverride: milestoneProbe,
      session,
      userQuestion: milestone.userQuestion,
    });
  }

  const independentNpcResolutionProbe = await watchUntilIndependentNpcResolution({
    maxWaitMs: 240_000,
    session,
  });
  milestonesReached.push("independent-npc-resolution");
  await captureInhabitMoment({
    index: momentIndex++,
    label: "independent-npc-resolution",
    moments,
    probeOverride: independentNpcResolutionProbe,
    session,
    userQuestion:
      "Can I see that another South Quay local solved a live problem without Rowan?",
  });

  const yardOutcomeMilestone = {
    label: "post-first-afternoon-yard-outcome",
    maxClicks: 8,
    reached: postFirstAfternoonYardOutcomeProbe,
    userQuestion:
      "Does Rowan's North Crane Yard commitment land as completed or explicitly closed, with pay/credit/consequence visible?",
  };
  await clickUntilInhabitMilestone({
    clickLog,
    maxClicks: yardOutcomeMilestone.maxClicks,
    milestone: yardOutcomeMilestone,
    objectiveSequenceAudit,
    scheduledNpcObservations,
    session,
  });
  milestonesReached.push(yardOutcomeMilestone.label);
  await captureInhabitMoment({
    index: momentIndex++,
    label: yardOutcomeMilestone.label,
    moments,
    session,
    userQuestion: yardOutcomeMilestone.userQuestion,
  });

  const visibleControlClickCount = clickLog.filter(
    (entry) => entry.kind === "visible-control-click",
  ).length;
  const watchedAutoContinueCount = clickLog.filter(
    (entry) => entry.kind === "watched-auto-continue",
  ).length;
  assert.equal(
    visibleControlClickCount,
    0,
    `Observe/autoplay gameplay must be zero-click, but the pass exposed ${visibleControlClickCount} visible control clicks.`,
  );
  assert.ok(
    watchedAutoContinueCount >= 6,
    `Inhabit gameplay pass did not carry enough objective beats through watch mode: ${watchedAutoContinueCount}.`,
  );
  const watchPacingAudit = buildWatchPacingAudit(clickLog);
  assertWatchPacingAudit(watchPacingAudit);
  const completionDwell = clickLog.find(
    (entry) =>
      entry.kind === "watched-auto-continue" &&
      entry.milestone === "post-first-afternoon-handoff" &&
      entry.completionAutoContinue,
  );
  assert.ok(
    completionDwell,
    "Observe/autoplay did not auto-acknowledge the first-afternoon completion field note as a watched beat.",
  );
  assertReadableFirstAfternoonDwell(
    completionDwell,
    "First-afternoon completion auto-acknowledgement",
  );
  assert.equal(
    completionDwell.readabilityStateStable,
    true,
    "First-afternoon completion did not remain stable through the browser readability checkpoint.",
  );
  const handoffDwell = clickLog.find(
    (entry) =>
      entry.kind === "watched-auto-continue" &&
      entry.handoffReorientation,
  );
  assert.ok(
    handoffDwell,
    "Observe/autoplay did not expose the first state-derived post-afternoon objective as a dedicated reorientation beat.",
  );
  assertReadableFirstAfternoonDwell(
    handoffDwell,
    "Post-first-afternoon objective reorientation",
  );
  assert.equal(
    handoffDwell.readabilityStateStable,
    true,
    "Post-first-afternoon objective changed before the browser readability checkpoint.",
  );
  assert.ok(
    handoffDwell.beforeObjectiveRouteKey &&
      handoffDwell.beforeObjectiveRouteKey !== "first-afternoon",
    `Post-first-afternoon readability check did not capture a fresh dynamic route: ${handoffDwell.beforeObjectiveRouteKey}.`,
  );
  assert.equal(
    handoffDwell.readabilityObjectiveRouteKey,
    handoffDwell.beforeObjectiveRouteKey,
    "Post-first-afternoon readability checkpoint did not hold the captured dynamic route stable.",
  );
  assert.ok(
    clickLog.length >= 10,
    `Inhabit gameplay pass had too few player-facing interactions/watch beats: ${clickLog.length}.`,
  );
  assert.ok(
    milestonesReached.includes("post-first-afternoon-live-route"),
    `Inhabit gameplay pass did not prove the post-rest live-pressure route before independent NPC resolution: ${JSON.stringify(
      milestonesReached,
    )}.`,
  );
  assert.ok(
    milestonesReached.includes("post-first-afternoon-yard-follow-through"),
    `Inhabit gameplay pass did not prove a yard/Tomas follow-through after the selected live route: ${JSON.stringify(
      milestonesReached,
    )}.`,
  );
  assert.ok(
    milestonesReached.includes("post-first-afternoon-yard-outcome"),
    `Inhabit gameplay pass did not prove a completed or closed yard outcome after follow-through: ${JSON.stringify(
      milestonesReached,
    )}.`,
  );
  const handoffMoment = moments.find(
    (moment) => moment.label === "post-first-afternoon-handoff",
  );
  assert.ok(
    handoffMoment,
    "Inhabit gameplay pass did not capture browser evidence for the post-first-afternoon handoff.",
  );
  assert.ok(
    handoffMoment.firstAfternoon?.completionAcknowledgedAt,
    "Post-first-afternoon handoff did not acknowledge the completed field-note beat.",
  );
  assert.notEqual(
    handoffMoment.objective?.routeKey,
    "first-afternoon",
    "Post-first-afternoon handoff stayed pinned to the completed first-afternoon objective.",
  );
  assert.match(
    [
      handoffMoment.objective?.text,
      handoffMoment.autonomy?.label,
      handoffMoment.autonomy?.detail,
      handoffMoment.autonomy?.planningTrace?.selectedPressureKind,
      handoffMoment.autonomy?.planningTrace?.selectedMatchedOutcomeId,
    ]
      .filter(Boolean)
      .join(" "),
    /rest|yard|work|pump|tool|wrench|energy|predicate|commitment/i,
    "Post-first-afternoon handoff did not expose a state-derived next objective or pressure.",
  );
  const restMoment = moments.find(
    (moment) => moment.label === "post-first-afternoon-rest",
  );
  assert.ok(
    restMoment,
    "Inhabit gameplay pass did not capture browser evidence for post-first-afternoon rest.",
  );
  assert.ok(
    postFirstAfternoonRestAdvancedProbe(restMoment),
    "Post-first-afternoon rest evidence did not show the browser pass carrying through the selected rest action.",
  );
  const liveRouteMoment = moments.find(
    (moment) => moment.label === "post-first-afternoon-live-route",
  );
  assert.ok(
    liveRouteMoment,
    "Inhabit gameplay pass did not capture browser evidence for the post-rest live route.",
  );
  assert.ok(
    postFirstAfternoonLiveRouteProbe(liveRouteMoment),
    "Post-rest browser evidence did not expose a dynamic legal-backed live-pressure route.",
  );
  const yardFollowThroughMoment = moments.find(
    (moment) => moment.label === "post-first-afternoon-yard-follow-through",
  );
  assert.ok(
    yardFollowThroughMoment,
    "Inhabit gameplay pass did not capture browser evidence for the yard/Tomas follow-through.",
  );
  assert.ok(
    postFirstAfternoonYardFollowThroughProbe(yardFollowThroughMoment),
    "Post-rest browser evidence did not show the selected yard pressure becoming a Tomas setup or legal yard-work action.",
  );
  const yardOutcomeMoment = moments.find(
    (moment) => moment.label === "post-first-afternoon-yard-outcome",
  );
  assert.ok(
    yardOutcomeMoment,
    "Inhabit gameplay pass did not capture browser evidence for the yard outcome.",
  );
  assert.ok(
    postFirstAfternoonYardOutcomeProbe(yardOutcomeMoment),
    "Post-rest browser evidence did not show the yard commitment resolving into completed or closed player-facing outcome.",
  );
  const postFirstAfternoonLivePressureEvidence =
    buildPostFirstAfternoonLivePressureEvidence({
      clickLog,
      moments,
      visibleControlClickCount,
      watchedAutoContinueCount,
    });
  assertPostFirstAfternoonLivePressureEvidence(
    postFirstAfternoonLivePressureEvidence,
  );
  assert.ok(
    moments.every((moment) => moment.screenshot),
    "Inhabit gameplay pass must capture screenshot evidence for every player milestone.",
  );
  assertInhabitOpeningCtaProgression(moments);
  assertInhabitSituatedWatchCtaCopy(moments);
  const objectiveSequenceRuns = buildObjectiveSequenceRuns(
    objectiveSequenceAudit,
  );
  const earlyAgencyAuthorityLedger = buildTrajectoryNeutralAgencyLedger({
    moments,
    objectiveSequenceAudit,
  });
  assertTrajectoryNeutralAgencyLedger(earlyAgencyAuthorityLedger);
  const worldPressureAudit = buildWorldPressureAudit({
    moments,
    objectiveSequenceAudit,
  });
  assertWorldPressureAudit(worldPressureAudit);
  const independentNpcActionEvidence = buildIndependentNpcActionEvidence(
    moments,
    worldPressureAudit,
  );
  assertIndependentNpcActionEvidence(independentNpcActionEvidence);
  assertIndependentResolutionDecisionArtifact(moments);
  const cityEventVisualEvidence = buildCityEventVisualEvidence(moments);
  assertCityEventVisualEvidence(cityEventVisualEvidence);
  const movementAuditMoments = moments.filter(
    (moment) => moment.label !== "independent-npc-resolution",
  );
  const movementAudit = buildMovementAuditSummary(movementAuditMoments, {
    playerRouteContinuityLedgerOptions: {
      explainedMissingCoverage: {
        "stage-cafe-move": "covered-by-route-timeline-report",
        "stage-home-move": "covered-by-route-timeline-report",
      },
    },
    scheduledNpcObservationTimeline: scheduledNpcObservations,
  });
  assertOpeningPlayerLocationGeometrySample(
    movementAudit,
    "first-actionable-screen",
  );
  const scheduledNpcSpatialEvidence = buildScheduledNpcSpatialEvidence({
    movementAudit,
    worldPressureAudit,
  });
  assertScheduledNpcSpatialEvidence(scheduledNpcSpatialEvidence);
  const decisionArtifactCoverage = buildDecisionArtifactCoverage(moments);
  assertDecisionArtifactCoverage(decisionArtifactCoverage);

  const reportPath = path.join(OUTPUT_DIR, "inhabit-gameplay-report.json");
  const report = {
    cameraCheck,
    cityEventVisualEvidence,
    clickCount: clickLog.length,
    directSimCommandsUsed: false,
    decisionArtifactCoverage,
    earlyAgencyAuthorityLedger,
    evidenceStandard:
      "Progression is driven by visible browser controls, pointer drags, and normal watch-mode beats; sim probes are read only for assertions.",
    independentNpcActionEvidence,
    moments: moments.map(compactInhabitReportMoment),
    milestonesReached,
    objectiveSequenceAudit,
    objectiveSequenceRuns,
    panelChecks,
    playerLocationGeometryEvidence: movementAudit.playerLocationGeometrySamples,
    playerRouteContinuityLedger:
      movementAudit.playerRouteContinuityLedger,
    postFirstAfternoonLivePressureEvidence,
    progressionClicks: clickLog,
    reportPath,
    rowanNotebookClick,
    scheduledNpcObservationCount: scheduledNpcObservations.length,
    scheduledNpcSpatialEvidence,
    status: "passed",
    url,
    visibleControlClickCount,
    watchPacingAudit,
    watchUrl,
    watchedAutoContinueCount,
    worldPressureAudit,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

function buildDecisionArtifactCoverage(moments) {
  const withArtifact = moments
    .filter((moment) => moment.visibleDecisionArtifact)
    .map((moment) => ({
      constraints: moment.visibleDecisionArtifact.constraints?.length ?? 0,
      considered: moment.visibleDecisionArtifact.considered?.length ?? 0,
      label: moment.label,
      nextCheck: moment.visibleDecisionArtifact.nextCheck ?? null,
      objective: moment.visibleDecisionArtifact.objective ?? null,
      rationale: moment.visibleDecisionArtifact.rationale ?? null,
      selectedAction: moment.visibleDecisionArtifact.selectedAction ?? null,
      sourceSummary: moment.visibleDecisionArtifact.sourceSummary ?? null,
    }));

  return {
    count: withArtifact.length,
    earlyDecision:
      withArtifact.find((entry) =>
        /first-interaction|approaches-known|durable-consequence/i.test(
          entry.label,
        ),
      ) ?? null,
    earlyNextCheckDecision:
      withArtifact.find(
        (entry) =>
          entry.nextCheck &&
          /first-interaction|approaches-known|durable-consequence/i.test(
            entry.label,
          ),
      ) ?? null,
    laterDecision:
      withArtifact.find((entry) =>
        /post-first-afternoon-handoff|post-first-afternoon-rest|post-first-afternoon-live-route/i.test(
          entry.label,
        ),
      ) ?? null,
    commitmentFollowThroughDecision:
      withArtifact.find((entry) =>
        /post-first-afternoon-yard-follow-through|post-first-afternoon-yard-outcome|durable-consequence/i.test(
          entry.label,
        ) && Boolean(entry.sourceSummary),
      ) ?? null,
    laterNextCheckDecision:
      withArtifact.find(
        (entry) =>
          entry.nextCheck &&
          /post-first-afternoon-handoff|post-first-afternoon-rest|post-first-afternoon-live-route/i.test(
            entry.label,
          ),
      ) ?? null,
    labels: withArtifact.map((entry) => entry.label),
    nextCheckCount: withArtifact.filter((entry) => entry.nextCheck).length,
    samples: withArtifact.slice(0, 5),
  };
}

function assertDecisionArtifactCoverage(coverage) {
  assert.ok(
    coverage.count >= 2,
    `Inhabit gameplay pass captured too few visible decision artifacts: ${JSON.stringify(coverage)}`,
  );
  assert.ok(
    coverage.earlyDecision,
    `Inhabit gameplay pass did not capture visible reasoning for the first meaningful route/conversation decision: ${JSON.stringify(coverage)}`,
  );
  assert.ok(
    coverage.laterDecision,
    `Inhabit gameplay pass did not capture visible reasoning for a later live-pressure decision: ${JSON.stringify(coverage)}`,
  );
  assert.ok(
    coverage.commitmentFollowThroughDecision,
    `Inhabit gameplay pass did not expose sourced reasoning for a durable consequence or follow-through action: ${JSON.stringify(coverage)}`,
  );
  assert.ok(
    coverage.earlyNextCheckDecision,
    `Inhabit gameplay pass did not capture a short-horizon decision line for an early meaningful decision: ${JSON.stringify(coverage)}`,
  );
  assert.ok(
    coverage.laterNextCheckDecision,
    `Inhabit gameplay pass did not capture a short-horizon decision line for a later live-pressure decision: ${JSON.stringify(coverage)}`,
  );
}

async function createVisualEvidence({ overlayChecks, timeline }) {
  const screenshots = timeline
    .filter((entry) => entry.screenshot)
    .map((entry) => ({
      label: entry.label,
      path: entry.screenshot,
      type: "gameplay",
    }));
  const overlays = overlayChecks.map((entry) => ({
    label: entry.label,
    path: entry.screenshot,
    type: "overlay",
  }));
  const frames = [...screenshots, ...overlays];

  if (!USE_CHROME_DRIVER) {
    return {
      manifestPath: null,
      recordingPath: null,
      screenshots,
      overlays,
    };
  }

  assert.ok(
    screenshots.length >= 16,
    `Expected at least 16 gameplay screenshots including route start/mid/arrival frames, got ${screenshots.length}.`,
  );
  assert.ok(
    overlays.length >= 2,
    `Expected notebook and journal overlay screenshots for visual evidence, got ${overlays.length}.`,
  );

  const recordingPath = path.join(OUTPUT_DIR, "rowan-gameplay-regression.mp4");
  const frameListPath = path.join(
    OUTPUT_DIR,
    "rowan-gameplay-regression.frames.txt",
  );
  const manifestPath = path.join(OUTPUT_DIR, "visual-evidence.json");
  const concatLines = [];

  for (const frame of frames) {
    concatLines.push(`file '${escapeFfmpegConcatPath(frame.path)}'`);
    concatLines.push(`duration ${frame.type === "overlay" ? "1.4" : "0.8"}`);
  }
  concatLines.push(`file '${escapeFfmpegConcatPath(frames.at(-1).path)}'`);
  await writeFile(frameListPath, `${concatLines.join("\n")}\n`, "utf8");

  try {
    await runProcess(
      FFMPEG_BIN,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        frameListPath,
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=2,format=yuv420p",
        "-movflags",
        "+faststart",
        recordingPath,
      ],
      "ffmpeg visual evidence recording",
    );
  } catch (error) {
    if (REQUIRE_RECORDING) {
      throw error;
    }
    await writeFile(
      path.join(OUTPUT_DIR, "rowan-gameplay-regression.recording-error.txt"),
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      "utf8",
    );
  }

  const evidence = {
    createdAt: new Date().toISOString(),
    frameListPath,
    overlays,
    recordingPath,
    screenshots,
  };
  await writeFile(
    manifestPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  return {
    manifestPath,
    recordingPath,
    screenshots,
    overlays,
  };
}

function escapeFfmpegConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildInterimVisualEvidence({ overlayChecks, timeline }) {
  return {
    manifestPath: null,
    recordingPath: null,
    screenshots: timeline
      .filter((entry) => entry.screenshot)
      .map((entry) => ({
        label: entry.label,
        path: entry.screenshot,
        type: "gameplay",
      })),
    overlays: overlayChecks.map((entry) => ({
      label: entry.label,
      path: entry.screenshot,
      type: "overlay",
    })),
  };
}

function buildRegressionSummary({
  autoplayObservation,
  evidence,
  game,
  inhabitGameplay,
  independentNpcActionEvidence,
  movementAudit,
  observeOnlyCarryForward,
  outputStatus,
  overlayChecks,
  phaseDiagnostics = null,
  screenshotCount,
  timeline,
  timelinePath,
  unavailableNpcCrossLayer,
}) {
  return {
    browserDriver: BROWSER_DRIVER,
    autoplayObservation,
    evidence,
    finalGameId: game.id,
    finalizationStatus: outputStatus,
    finalState: {
      clock: game.currentTime,
      energy: game.player.energy,
      fieldNote: game.firstAfternoon?.fieldNote ?? null,
      leadFieldNote: game.firstAfternoon?.leadFieldNote ?? null,
      locationId: game.player.currentLocationId,
      money: game.player.money,
      objective: game.player.objective?.text ?? null,
    },
    inhabitGameplay,
    independentNpcActionEvidence,
    observeOnlyCarryForward,
    npcDiagnostics: movementAudit.npcPatrols,
    outputDir: OUTPUT_DIR,
    overlayChecks,
    phaseDiagnostics,
    playerLocationGeometryEvidence: movementAudit.playerLocationGeometrySamples,
    playerRouteContinuityLedger: movementAudit.playerRouteContinuityLedger,
    routeDiagnostics: movementAudit.playerRoutes,
    scheduledNpcContinuityGaps: movementAudit.scheduledNpcContinuityGaps,
    scheduledNpcDiagnostics: movementAudit.scheduledNpcRoutes,
    scheduledNpcLocationChanges: movementAudit.scheduledNpcLocationChanges,
    scheduledNpcMarkerSamples: movementAudit.scheduledNpcMarkerSamples,
    scheduledNpcVisualCues: movementAudit.scheduledNpcVisualCueSamples,
    screenshotCount,
    steps: timeline.map((entry) => ({
      activeConversation: entry.activeConversation?.npcId ?? null,
      activeEvents: entry.cityEvents.active.map((event) => event.id),
      clock: entry.clock.label,
      label: entry.label,
      locationId: entry.location.id,
      screenshot: entry.screenshot,
    })),
    timelinePath,
    unavailableNpcCrossLayer,
  };
}

async function writeRegressionSummary(summaryPath, summary) {
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function buildRegressionSteps(gameRef) {
  return [
    {
      label: "initial-morrow-exterior",
      mutate: async () => gameRef.current,
    },
    {
      label: "enter-morrow-house",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "mara-live-thread",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "mara-thread-landed",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "head-to-cafe-plan",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "exit-morrow-house",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "stage-cafe-move",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "arrive-cafe-door",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "enter-cafe-interior",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "ada-live-thread",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "ada-thread-landed",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "hold-for-shift",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "lunch-rush",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "finish-shift",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "head-home",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "exit-cafe-interior",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "stage-home-move",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "arrive-home",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "enter-morrow-return",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "post-first-afternoon-handoff",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "post-first-afternoon-rest",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "post-first-afternoon-live-route",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "post-first-afternoon-yard-follow-through",
      mutate: async () => {
        const routeProgress = await advanceObjective(gameRef.current.id, true);
        gameRef.current = routeProgress;
        return advanceObjective(routeProgress.id, true);
      },
    },
    {
      label: "post-first-afternoon-yard-outcome",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "independent-npc-resolution",
      mutate: async () =>
        waitForIndependentProblemResolution(gameRef.current.id),
    },
  ];
}

async function main() {
  assertRailReadabilityStateRegression();
  assertUnavailableApproachAdviceAuthorityRegression();
  assertActiveRouteTargetAuthorityRegression();
  assertScheduledNpcLocationChangeAuditRegression();
  assertProgressAwareStagedWorkWaitRegression();
  assertConversationPlaybackWaitRegression();
  assertPostFirstAfternoonTrajectoryNeutralGuard();
  assertYardNotebookCommitmentGuard();
  assertIndependentNpcSurfaceRefreshGuard();
  assertWatchPacingTransitionSignatureGuard();
  assertAutoplayProgressGapGuard();
  if (RUN_SIM_WAIT_GUARD_ONLY) {
    process.stdout.write(
      "[many-lives] Simulator wait deterministic guard passed.\n",
    );
    return;
  }
  await mkdir(OUTPUT_DIR, { recursive: true });
  const { webServer } = await ensureStack();

  const summaryPath = path.join(OUTPUT_DIR, "summary.json");
  const timelinePath = path.join(OUTPUT_DIR, "timeline.json");
  const timeline = [];
  let game = await createGame();
  const gameRef = { current: game };
  let overlayChecks = [];
  let autoplayObservation = null;
  let observeOnlyCarryForward = null;
  let unavailableNpcCrossLayer = null;
  let inhabitGameplay = null;
  let browserChecksCompleted = false;
  let cleanupError = null;
  const phaseDiagnostics = {
    checkpoints: [],
    completedPhases: [],
    currentPhase: "startup",
    failedPhase: null,
    cleanup: {
      browserSession: null,
      errors: [],
      webServer: null,
    },
    timeouts: {
      autoplayObservationMs: AUTOPLAY_OBSERVATION_TIMEOUT_MS,
      cleanupMs: CLEANUP_TIMEOUT_MS,
      inhabitGameplayMs: INHABIT_GAMEPLAY_TIMEOUT_MS,
      observeCarryForwardMs: OBSERVE_CARRY_FORWARD_TIMEOUT_MS,
    },
  };
  let session = USE_CHROME_DRIVER
    ? await launchBrowserSession(browserUrl(game.id))
    : null;
  const browserPageErrors = [];

  const recycleBrowserSession = async (label) => {
    if (!USE_CHROME_DRIVER || !session) {
      return;
    }

    traceRegression(`recycle-session:${label}:closing`);
    browserPageErrors.push(...session.pageErrors);
    const previousSession = session;
    session = null;
    await withTimeout(
      Promise.resolve(previousSession.close()),
      CLEANUP_TIMEOUT_MS,
      `Timed out recycling Chrome before ${label}.`,
    );
    session = await launchBrowserSession(browserUrl(game.id));
    traceRegression(`recycle-session:${label}:ready`);
  };

  const writeCheckpointSummary = async (outputStatus, extraDiagnostics = {}) => {
    const checkpoint = {
      at: new Date().toISOString(),
      outputStatus,
      screenshotCount: timeline.filter((entry) => entry.screenshot).length,
      timelineEntries: timeline.length,
    };
    phaseDiagnostics.checkpoints.push(checkpoint);
    Object.assign(phaseDiagnostics, extraDiagnostics);

    const checkpointTimeline = timeline.filter(
      (entry) => entry.label !== "independent-npc-resolution",
    );
    const checkpointMovementAudit =
      buildMovementAuditSummary(checkpointTimeline);
    const checkpointSummary = buildRegressionSummary({
      autoplayObservation,
      evidence: buildInterimVisualEvidence({ overlayChecks, timeline }),
      game,
      inhabitGameplay,
      independentNpcActionEvidence: buildIndependentNpcActionEvidence(timeline),
      movementAudit: checkpointMovementAudit,
      observeOnlyCarryForward,
      outputStatus,
      overlayChecks,
      phaseDiagnostics,
      screenshotCount: checkpoint.screenshotCount,
      timeline,
      timelinePath,
      unavailableNpcCrossLayer,
    });
    await writeRegressionSummary(summaryPath, checkpointSummary);
    traceRegression(`summary-written:${outputStatus}`);
  };

  const runBrowserPhase = async (label, timeoutMs, action) => {
    const startedAt = new Date();
    phaseDiagnostics.currentPhase = label;
    phaseDiagnostics.currentPhaseStartedAt = startedAt.toISOString();
    traceRegression(`${label}-start`);
    await writeCheckpointSummary(`${slug(label)}-started`, {
      currentPhase: label,
    });
    const heartbeat = setInterval(() => {
      const elapsedSeconds = Math.round(
        (Date.now() - startedAt.getTime()) / 1000,
      );
      process.stderr.write(
        `[many-lives] ${label} still running after ${elapsedSeconds}s.\n`,
      );
    }, BROWSER_PHASE_HEARTBEAT_MS);
    heartbeat.unref?.();

    try {
      const result = await withTimeout(
        Promise.resolve().then(action),
        timeoutMs,
        `${label} timed out after ${timeoutMs}ms.`,
      );
      phaseDiagnostics.completedPhases.push({
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date().toISOString(),
        label,
      });
      phaseDiagnostics.currentPhase = null;
      traceRegression(`${label}-done`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      phaseDiagnostics.failedPhase = {
        durationMs: Date.now() - startedAt.getTime(),
        failedAt: new Date().toISOString(),
        label,
        message,
        timeoutMs,
      };
      phaseDiagnostics.currentPhase = label;
      await writeFile(
        path.join(OUTPUT_DIR, `${slug(label)}-error.txt`),
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
        "utf8",
      );
      await writeCheckpointSummary(`failed:${slug(label)}`, {
        currentPhase: label,
      });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  };

  try {
    if (session !== null) {
      autoplayObservation = await runBrowserPhase(
        "autoplay-observation",
        AUTOPLAY_OBSERVATION_TIMEOUT_MS,
        () => runAutoplayObservation(session),
      );
      await writeCheckpointSummary("autoplay-observation-complete");
      await recycleBrowserSession("scripted-timeline");
    }

    const steps = buildRegressionSteps(gameRef);
    traceRegression(`steps:${steps.map((step) => step.label).join(",")}`);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      traceRegression(`step-start:${index}:${step.label}`);
      const previousGame = gameRef.current;
      game = await step.mutate();
      traceRegression(
        `step-mutated:${index}:${step.label}:${game.currentTime}:${game.rowanAutonomy.label}`,
      );
      if (
        session !== null &&
        previousGame &&
        playerPositionChanged(previousGame, game)
      ) {
        traceRegression(`step-visual-move:${index}:${step.label}`);
        const routeStartProbe = await session.waitForVisualMove(
          previousGame,
          game,
        );
        const routeStartGame = matchingGameSnapshotForProbe(
          routeStartProbe,
          previousGame,
          game,
        );
        assert.ok(
          routeStartGame,
          `${step.label}: route start did not match its departure or arrival snapshot.`,
        );
        const routeStartLabel = `${step.label}-route-start`;
        const routeStartCapture = await captureBrowserMovementState({
          game: routeStartGame,
          index: `${index}a`,
          label: routeStartLabel,
          probe: routeStartProbe,
          session,
        });
        timeline.push(
          buildTimelineEntry({
            camera: routeStartCapture.camera,
            dom: routeStartCapture.dom,
            game: routeStartGame,
            label: routeStartLabel,
            mapAgency: routeStartCapture.mapAgency,
            probe: routeStartCapture.probe,
            screenshot: routeStartCapture.screenshot,
            screenshotError: routeStartCapture.screenshotError,
          }),
        );
        await writeFile(
          timelinePath,
          `${JSON.stringify(timeline, null, 2)}\n`,
          "utf8",
        );

        const routeMidProbe = await session.waitForVisualRouteProgress(
          previousGame,
          game,
          0.35,
          { fallbackProbe: routeStartProbe },
        );
        const routeMidGame = matchingGameSnapshotForProbe(
          routeMidProbe,
          previousGame,
          game,
        );
        assert.ok(
          routeMidGame,
          `${step.label}: route midpoint did not match its departure or arrival snapshot.`,
        );
        const routeMidLabel = `${step.label}-route-mid`;
        const routeMidCapture = await captureBrowserMovementState({
          game: routeMidGame,
          index: `${index}b`,
          label: routeMidLabel,
          probe: routeMidProbe,
          session,
        });
        timeline.push(
          buildTimelineEntry({
            camera: routeMidCapture.camera,
            dom: routeMidCapture.dom,
            game: routeMidGame,
            label: routeMidLabel,
            mapAgency: routeMidCapture.mapAgency,
            probe: routeMidCapture.probe,
            screenshot: routeMidCapture.screenshot,
            screenshotError: routeMidCapture.screenshotError,
          }),
        );
        await writeFile(
          timelinePath,
          `${JSON.stringify(timeline, null, 2)}\n`,
          "utf8",
        );

        if (shouldCaptureCloseConversationRoute(step.label)) {
          const routeCloseProbe = await session.waitForVisualRouteProgress(
            previousGame,
            game,
            0.82,
            { fallbackProbe: routeMidProbe },
          );
          const routeCloseGame = matchingGameSnapshotForProbe(
            routeCloseProbe,
            previousGame,
            game,
          );
          assert.ok(
            routeCloseGame,
            `${step.label}: route close did not match its departure or arrival snapshot.`,
          );
          const routeCloseLabel = `${step.label}-route-close`;
          const routeCloseCapture = await captureBrowserMovementState({
            game: routeCloseGame,
            index: `${index}c`,
            label: routeCloseLabel,
            probe: routeCloseProbe,
            session,
          });
          timeline.push(
            buildTimelineEntry({
              camera: routeCloseCapture.camera,
              dom: routeCloseCapture.dom,
              game: routeCloseGame,
              label: routeCloseLabel,
              mapAgency: routeCloseCapture.mapAgency,
              probe: routeCloseCapture.probe,
              screenshot: routeCloseCapture.screenshot,
              screenshotError: routeCloseCapture.screenshotError,
            }),
          );
          await writeFile(
            timelinePath,
            `${JSON.stringify(timeline, null, 2)}\n`,
            "utf8",
          );
        }
        await session.waitForVisualMoveSettlement(previousGame, game);
      }
      gameRef.current = game;
      const capture =
        session !== null
          ? await captureBrowserState({
              game,
              index,
              label: step.label,
              session,
            })
          : await captureProbeState({
              game,
              label: step.label,
            });
      timeline.push(
        buildTimelineEntry({
          camera: capture.camera,
          dom: capture.dom,
          game,
          label: step.label,
          mapAgency: capture.mapAgency,
          probe: capture.probe,
          screenshot: capture.screenshot,
          screenshotError: capture.screenshotError,
        }),
      );
      await writeFile(
        timelinePath,
        `${JSON.stringify(timeline, null, 2)}\n`,
        "utf8",
      );
      traceRegression(`step-written:${index}:${step.label}`);
    }
    browserChecksCompleted = timeline.some((entry) => entry.screenshot);
    await writeCheckpointSummary("timeline-complete");

    if (session !== null) {
      overlayChecks = await runBrowserPhase(
        "overlay-panel-checks",
        90_000,
        () => runOverlayPanelChecks(session),
      );
      await writeCheckpointSummary("overlay-checks-complete");
      unavailableNpcCrossLayer = await runBrowserPhase(
        "unavailable-npc-cross-layer",
        60_000,
        () => runUnavailableNpcCrossLayerCheck(session),
      );
      await writeCheckpointSummary("unavailable-npc-cross-layer-complete");
      observeOnlyCarryForward = await runBrowserPhase(
        "observe-only-carry-forward",
        OBSERVE_CARRY_FORWARD_TIMEOUT_MS,
        () => runObserveOnlyCarryForwardObservation(session),
      );
      await writeCheckpointSummary("observe-only-carry-forward-complete");
      await recycleBrowserSession("inhabit-gameplay");
      inhabitGameplay = await runBrowserPhase(
        "inhabit-gameplay",
        INHABIT_GAMEPLAY_TIMEOUT_MS,
        () => runInhabitGameplayPass(session),
      );
      await writeCheckpointSummary("inhabit-gameplay-complete");
      const allPageErrors = [...browserPageErrors, ...session.pageErrors];
      assert.deepEqual(
        allPageErrors,
        [],
        `Browser emitted runtime/log errors: ${JSON.stringify(allPageErrors, null, 2)}`,
      );
      browserChecksCompleted = true;
    }
  } finally {
    if (browserChecksCompleted) {
      try {
        const interimMovementAuditTimeline = timeline.filter(
          (entry) => entry.label !== "independent-npc-resolution",
        );
        const interimMovementAudit = buildMovementAuditSummary(
          interimMovementAuditTimeline,
        );
        const interimSummary = buildRegressionSummary({
          autoplayObservation,
          evidence: buildInterimVisualEvidence({ overlayChecks, timeline }),
          game,
          inhabitGameplay,
          independentNpcActionEvidence: buildIndependentNpcActionEvidence(timeline),
          movementAudit: interimMovementAudit,
          observeOnlyCarryForward,
          outputStatus: phaseDiagnostics.failedPhase
            ? "browser-checks-failed-cleanup-pending"
            : "browser-checks-complete-cleanup-pending",
          overlayChecks,
          phaseDiagnostics,
          screenshotCount: timeline.filter((entry) => entry.screenshot).length,
          timeline,
          timelinePath,
          unavailableNpcCrossLayer,
        });
        await writeRegressionSummary(summaryPath, interimSummary);
        traceRegression(
          phaseDiagnostics.failedPhase
            ? "summary-written:browser-checks-failed-cleanup-pending"
            : "summary-written:browser-checks-complete-cleanup-pending",
        );
      } catch (error) {
        await writeFile(
          path.join(OUTPUT_DIR, "summary-finalization-error.txt"),
          `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
          "utf8",
        );
      }
    }

    traceRegression("closing-session");
    try {
      phaseDiagnostics.cleanup.browserSession = await withTimeout(
        Promise.resolve(session?.close()),
        CLEANUP_TIMEOUT_MS,
        `Timed out closing Chrome after ${CLEANUP_TIMEOUT_MS}ms.`,
      );
    } catch (error) {
      cleanupError = error;
      phaseDiagnostics.cleanup.errors.push({
        message: error instanceof Error ? error.message : String(error),
        phase: "browser-session",
      });
    }
    traceRegression("closing-web-server");
    try {
      phaseDiagnostics.cleanup.webServer = await withTimeout(
        closeChildProcess(webServer),
        CLEANUP_TIMEOUT_MS,
        `Timed out closing local web server after ${CLEANUP_TIMEOUT_MS}ms.`,
      );
    } catch (error) {
      cleanupError ??= error;
      phaseDiagnostics.cleanup.errors.push({
        message: error instanceof Error ? error.message : String(error),
        phase: "web-server",
      });
    }
    traceRegression("closed");
  }

  if (cleanupError) {
    await writeFile(
      path.join(OUTPUT_DIR, "cleanup-error.txt"),
      `${cleanupError instanceof Error ? (cleanupError.stack ?? cleanupError.message) : String(cleanupError)}\n`,
      "utf8",
    );
    throw cleanupError;
  }

  const byLabel = Object.fromEntries(
    timeline.map((entry) => [entry.label, entry]),
  );

  if (!inhabitGameplay) {
  assertTimelineRoute(
    byLabel,
    "stage-cafe-move-route-start",
    "Morrow House to Kettle & Lamp",
  );
  assertKettleTargetCueSpatialAuthority(byLabel, "stage-cafe-move-route-start");
  assertTimelineRoute(
    byLabel,
    "stage-home-move-route-start",
    "Kettle & Lamp to Morrow House",
  );
  assertTimelineRoute(
    byLabel,
    "mara-live-thread-route-start",
    "Morrow House entry to Mara",
    { spaceId: "interior:boarding-house" },
  );
  assertTimelineRoute(
    byLabel,
    "enter-cafe-interior-route-start",
    "Kettle & Lamp entry to Ada",
    { spaceId: "interior:tea-house" },
  );
  assertCloseConversationLabelSuppressed(
    byLabel,
    "mara-live-thread-route-close",
  );
  assertTimelineRoute(
    byLabel,
    "lunch-rush-route-start",
    "Ada to Kettle & Lamp counter",
    { minPathPoints: 2, spaceId: "interior:tea-house" },
  );
  assertTimelineRoute(
    byLabel,
    "enter-morrow-return-route-start",
    "Morrow House entry to room",
    { spaceId: "interior:boarding-house" },
  );
  assert.ok(
    byLabel["enter-morrow-return"],
    "Expected browser evidence for first-afternoon completion after the room route.",
  );
  assert.equal(
    byLabel["enter-morrow-return"]?.autonomy?.label,
    "First afternoon complete",
    "Expected first-afternoon completion to resolve after Rowan reaches the room/take-stock anchor.",
  );
  assert.equal(
    byLabel["enter-morrow-return"]?.autonomy?.mode,
    "idle",
    "Expected first-afternoon completion to be a settled in-place completion, not another movement route.",
  );

  assertCleanSettledInteriorFrame(
    byLabel,
    "enter-morrow-house",
    "interior:boarding-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "mara-live-thread",
    "interior:boarding-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "enter-cafe-interior",
    "interior:tea-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "ada-live-thread",
    "interior:tea-house",
  );
  assertCleanSettledInteriorFrame(byLabel, "lunch-rush", "interior:tea-house");
  assertCleanSettledInteriorFrame(
    byLabel,
    "enter-morrow-return",
    "interior:boarding-house",
  );

  assert.equal(
    byLabel["mara-live-thread"]?.activeConversation?.npcId,
    "npc-mara",
    "Expected the browser run to show a live Mara thread.",
  );
  assert.equal(
    byLabel["mara-thread-landed"]?.location?.id,
    "boarding-house",
    "Expected Rowan to still be at Morrow House when the Mara thread lands.",
  );
  assert.match(
    byLabel["mara-thread-landed"]?.autonomy?.label ?? "",
    /Exit to South Quay|Kettle & Lamp|Ada/i,
    "Expected Mara's thread to leave Rowan on the Kettle & Lamp route sequence.",
  );
  assert.equal(
    byLabel["mara-thread-landed"]?.autonomy?.targetLocationId,
    "tea-house",
    "Expected Mara's thread to target Kettle & Lamp instead of a Morrow House reflection step.",
  );
  assert.equal(
    byLabel["head-to-cafe-plan"]?.autonomy?.targetLocationId,
    "tea-house",
    "Expected Mara's thread to point Rowan toward Kettle & Lamp.",
  );
  assert.equal(
    byLabel["stage-cafe-move-route-start"]?.location?.id,
    "boarding-house",
    "Expected the Kettle & Lamp move to stage before the visual arrival.",
  );
  assert.equal(
    byLabel["stage-cafe-move"]?.location?.id,
    "tea-house",
    "Expected the staged Kettle & Lamp move to arrive at the cafe.",
  );
  assert.equal(
    byLabel["stage-cafe-move"]?.autonomy?.targetLocationId,
    "tea-house",
    "Expected the staged move to keep Kettle & Lamp as the target.",
  );
  assertSettledOutdoorPlayerLocationCorrelation({
    entry: byLabel["stage-cafe-move"],
    label: "stage-cafe-move",
    locationId: "tea-house",
    locationName: "Kettle & Lamp",
  });
  assertOutdoorRouteArrivalContinuity(
    byLabel,
    "stage-cafe-move-route-mid",
    "stage-cafe-move",
    "Morrow House to Kettle & Lamp",
  );
  assert.equal(
    byLabel["enter-cafe-interior"]?.activeConversation?.npcId,
    "npc-ada",
    "Expected Rowan to reach Ada at Kettle & Lamp.",
  );
  const leadFieldNote =
    byLabel["ada-live-thread"]?.sim?.leadFieldNote ??
    byLabel["ada-thread-landed"]?.sim?.leadFieldNote;
  assert.ok(
    leadFieldNote,
    "Expected Rowan to record Mara's Ada lead as grounded knowledge before choosing the next action.",
  );
  assert.match(
    [
      leadFieldNote.learned,
      leadFieldNote.evidence,
      leadFieldNote.next,
      leadFieldNote.memory,
    ].join(" "),
    /Mara|Ada|Kettle & Lamp|choose/i,
    "Expected the lead field note to connect Mara's lead, Ada's answer, and the unlocked next choice.",
  );
  assert.equal(
    byLabel["hold-for-shift"]?.location?.id,
    "tea-house",
    "Expected Rowan to visibly hold at Kettle & Lamp for the shift.",
  );
  assert.match(
    byLabel["hold-for-shift"]?.autonomy?.label ?? "",
    /hold for|lunch rush/i,
    "Expected Rowan to visibly hold for or begin the tea-house shift.",
  );
  assert.equal(
    byLabel["hold-for-shift"]?.clock?.totalMinutes,
    741,
    "Expected the shift-start beat to land at 12:21 after Rowan reaches the counter anchor.",
  );
  assert.equal(
    byLabel["lunch-rush"]?.clock?.totalMinutes,
    766,
    "Expected the lunch rush counter beat to land at 12:46 after Rowan works the first rush stage.",
  );
  assert.equal(
    byLabel["lunch-rush"]?.sim?.teaShiftStage,
    "counter",
    "Expected the cafe rush screenshot to show the counter work sim stage after Rowan moves through the rush.",
  );
  assert.match(
    byLabel["lunch-rush"]?.autonomy?.label ?? "",
    /finish|lunch rush/i,
    "Expected Rowan to stay on the cafe shift sequence once the rush begins.",
  );
  assert.equal(
    byLabel["finish-shift"]?.sim?.teaShiftStage,
    "paid",
    "Expected the finish-shift screenshot to show the paid sim stage.",
  );
  assert.match(
    byLabel["finish-shift"]?.autonomy?.label ?? "",
    /home|Morrow|South Quay|exit/i,
    "Expected Rowan to head home after finishing the cafe shift.",
  );
  assert.equal(
    byLabel["head-home"]?.sim?.teaShiftStage,
    "paid",
    "Expected the head-home screenshot to show the paid cafe sim stage.",
  );
  for (const label of ["lunch-rush", "finish-shift", "head-home"]) {
    assert.ok(
      byLabel[label]?.screenshot,
      `Expected browser screenshot evidence for ${label}.`,
    );
  }
  assert.equal(
    byLabel["head-home"]?.autonomy?.targetLocationId,
    "boarding-house",
    "Expected Rowan to point back to Morrow House after the paid shift.",
  );
  assert.equal(
    byLabel["exit-cafe-interior"]?.location?.spaceId,
    "street:south-quay",
    "Expected Rowan to exit the cafe interior before walking home.",
  );
  assert.equal(
    byLabel["arrive-home"]?.location?.id,
    "boarding-house",
    "Expected Rowan to visibly arrive back at Morrow House.",
  );
  assertSettledOutdoorPlayerLocationCorrelation({
    entry: byLabel["stage-home-move"],
    label: "stage-home-move",
    locationId: "boarding-house",
    locationName: "Morrow House",
  });
  assertOutdoorRouteArrivalContinuity(
    byLabel,
    "stage-home-move-route-mid",
    "stage-home-move",
    "Kettle & Lamp to Morrow House",
  );
  assert.match(
    byLabel["stage-home-move"]?.autonomy?.label ?? "",
    /enter/i,
    "Expected Rowan to enter Morrow House after arriving home before resolving the take-stock action.",
  );
  assert.equal(
    byLabel["enter-morrow-return"]?.location?.spaceId,
    "interior:boarding-house",
    "Expected Rowan to switch back into the Morrow House interior after arriving home.",
  );
  assert.equal(
    byLabel["enter-morrow-return"]?.location?.id,
    "boarding-house",
    "Expected Rowan to end the first-afternoon loop at Morrow House.",
  );
  assert.match(
    byLabel["enter-morrow-return"]?.autonomy?.label ?? "",
    /first afternoon complete/i,
    "Expected the browser run to land the complete first-afternoon state.",
  );
  const finalFieldNote = byLabel["enter-morrow-return"]?.sim?.fieldNote;
  assert.ok(
    finalFieldNote,
    "Expected the sim to persist the first-afternoon field note.",
  );
  assert.match(
    [
      finalFieldNote.learned,
      finalFieldNote.evidence,
      finalFieldNote.next,
      finalFieldNote.memory,
    ].join(" "),
    /Ada|Kettle & Lamp|rush/i,
    "Expected the persisted field note to describe the resolved cafe thread.",
  );
  assert.ok(
    byLabel["post-first-afternoon-handoff"]?.firstAfternoon
      ?.completionAcknowledgedAt,
    "Expected the browser regression to acknowledge the first-afternoon field-note beat before opening the next objective.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-handoff"]?.objective?.routeKey,
    "first-afternoon",
    "Expected the post-first-afternoon handoff to leave the completed first-afternoon route.",
  );
  assert.match(
    [
      byLabel["post-first-afternoon-handoff"]?.objective?.text,
      byLabel["post-first-afternoon-handoff"]?.autonomy?.label,
      byLabel["post-first-afternoon-handoff"]?.autonomy?.detail,
      byLabel["post-first-afternoon-handoff"]?.autonomy?.planningTrace
        ?.selectedPressureKind,
      byLabel["post-first-afternoon-handoff"]?.autonomy?.planningTrace
        ?.selectedMatchedOutcomeId,
    ]
      .filter(Boolean)
      .join(" "),
    /rest|yard|work|pump|tool|wrench|energy|predicate|commitment/i,
    "Expected the post-first-afternoon handoff to expose rest, live work, or pump pressure instead of stale route authority.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-rest"]?.objective?.routeKey,
    "first-afternoon",
    "Expected the first legal post-completion follow-up to stay off the completed first-afternoon route.",
  );
  assert.ok(
    (byLabel["post-first-afternoon-rest"]?.sim?.energy ?? 0) >=
      POST_FIRST_AFTERNOON_RECOVERY_ENERGY,
    "Expected the post-first-afternoon rest beat to recover enough energy for the next grounded commitment.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-rest"]?.objective?.routeKey,
    "rest-home",
    "Expected the post-first-afternoon rest beat to leave rest-home once Rowan recovered enough energy.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-rest"]?.autonomy?.actionId,
    "rest:home",
    "Expected the post-first-afternoon rest beat not to select rest:home again once Rowan recovered enough energy.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-live-route"]?.objective?.routeKey,
    "first-afternoon",
    "Expected the live post-completion sequence to remain state-derived after the first follow-up beat.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-live-route"]?.autonomy?.actionId,
    "enter:boarding-house",
    "Expected the live post-completion route not to backtrack into Morrow House after a dynamic work/tool/help objective opens.",
  );
  assert.notEqual(
    byLabel["post-first-afternoon-live-route"]?.autonomy?.targetLocationId,
    "boarding-house",
    "Expected the live post-completion route target to stay aligned with the new state-derived objective, not Morrow House.",
  );
  if (
    byLabel["post-first-afternoon-live-route"]?.objective?.routeKey ===
    "work-yard"
  ) {
    assert.equal(
      byLabel["post-first-afternoon-live-route"]?.autonomy?.targetLocationId,
      "freight-yard",
      "Expected a post-completion work-yard objective to keep freight yard as the selected live-route target.",
    );
    assert.ok(
      postFirstAfternoonYardFollowThroughProbe(
        byLabel["post-first-afternoon-yard-follow-through"],
      ),
      "Expected the post-completion work-yard sequence to progress into a Tomas setup or legal yard-work action.",
    );
    assertOutdoorRouteArrivalContinuity(
      byLabel,
      "post-first-afternoon-yard-follow-through-route-mid",
      "post-first-afternoon-yard-follow-through",
      "Morrow House to North Crane Yard",
    );
  }
  }

  const screenshotCount = timeline.filter((entry) => entry.screenshot).length;
  const movementAuditTimeline = timeline.filter(
    (entry) => entry.label !== "independent-npc-resolution",
  );
  const movementAudit = buildMovementAuditSummary(movementAuditTimeline);
  assertMovementAuditSummary(movementAudit);
  const independentNpcActionEvidence =
    buildIndependentNpcActionEvidence(timeline);
  assertIndependentNpcActionEvidence(independentNpcActionEvidence);
  const evidence = await createVisualEvidence({
    overlayChecks,
    timeline,
  });
  const summary = buildRegressionSummary({
    autoplayObservation,
    evidence,
    game,
    inhabitGameplay,
    independentNpcActionEvidence,
    movementAudit,
    observeOnlyCarryForward,
    outputStatus: "passed",
    overlayChecks,
    phaseDiagnostics,
    screenshotCount,
    timeline,
    timelinePath,
    unavailableNpcCrossLayer,
  });
  await writeRegressionSummary(summaryPath, summary);

  await writeProcessExitDiagnostics("success");
  await writeStream(
    process.stdout,
    `[many-lives] Rowan ${USE_CHROME_DRIVER ? "Chrome" : "in-app probe"} regression passed.\n[many-lives] Web base: ${getWebBase()}\n[many-lives] Game URL: ${browserUrl(game.id)}\n[many-lives] Output: ${OUTPUT_DIR}\n[many-lives] Timeline: ${timelinePath}\n[many-lives] Summary: ${summaryPath}\n${evidence.recordingPath ? `[many-lives] Recording: ${evidence.recordingPath}\n` : ""}`,
    "stdout",
  );
}

main()
  .then(() => {
    traceRegression("process-exit:success");
    process.exit(0);
  })
  .catch((error) => {
    process.stderr.write(
      `[many-lives] Rowan browser regression failed: ${error.stack ?? error.message}\n`,
    );
    process.exit(1);
  });
