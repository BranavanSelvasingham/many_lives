import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

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
  process.env.MANY_LIVES_BROWSER_AUTOPLAY_OBSERVATION_TIMEOUT_MS ?? "180000",
);
const OBSERVE_CARRY_FORWARD_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_OBSERVE_CARRY_FORWARD_TIMEOUT_MS ?? "90000",
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
const MAP_AGENCY_PROBE_SETTLE_TIMEOUT_MS = 2_000;
const WEB_START_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_BROWSER_WEB_START_TIMEOUT_MS ?? "45000",
);
const PROBE_POLL_INTERVAL_MS = 250;
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
const KETTLE_LAMP_LANDMARK_BOUNDS = {
  maxX: 1550,
  maxY: 700,
  minX: 1138,
  minY: 324,
};
const MORROW_SIDE_WORLD_MAX_X = 700;
const KETTLE_SIDE_WORLD_MIN_X = 900;
const MAP_AGENCY_TARGET_LABEL_MAX_OFFSET = 120;
const OUTDOOR_ROUTE_ARRIVAL_CONTINUITY_MAX_DISTANCE = 8;
const POST_FIRST_AFTERNOON_RECOVERY_ENERGY = 35;
const INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES = 10;

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

async function waitFor(condition, timeoutMs, errorMessage) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await condition();
    if (result) {
      return result;
    }
    await sleep(PROBE_POLL_INTERVAL_MS);
  }

  throw new Error(errorMessage);
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
      const activeConversation = document.querySelector("[data-conversation-panel]");
      const commandRail = document.querySelector('[data-preserve-scroll="command-rail"]');
      const rowanDirective = document.querySelector('[data-rowan-directive="true"]');
      const decisionArtifact = document.querySelector("[data-visible-decision-artifact='true']");
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
            ?.textContent?.replace(/\s+/g, " ")
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
    return waitFor(
      async () => {
        try {
          const probe = await this.readBrowserProbe();
          if (!probe) {
            return null;
          }

          if (
            probe.gameId === game.id &&
            probe.clock?.iso === game.currentTime &&
            probe.location?.id === (game.player.currentLocationId ?? null) &&
            probe.location?.x === game.player.x &&
            probe.location?.y === game.player.y &&
            probe.autonomy?.label === game.rowanAutonomy.label &&
            probe.autonomy?.stepKind === game.rowanAutonomy.stepKind &&
            (probe.autonomy?.targetLocationId ?? null) ===
              (game.rowanAutonomy.targetLocationId ?? null) &&
            (probe.activeConversation?.npcId ?? null) ===
              (game.activeConversation?.npcId ?? null)
          ) {
            return probe;
          }
        } catch {}

        return null;
      },
      SIM_WAIT_TIMEOUT_MS,
      `Timed out waiting for browser session to catch up to ${game.currentTime} / ${game.rowanAutonomy.label}.`,
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

        if (
          probe?.gameId === previousGame.id &&
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
          ? {
              autonomy: lastProbe.autonomy,
              location: lastProbe.location,
              movement: lastProbe.movement,
              visualPlayer: lastProbe.visualPlayer,
              watchMode: lastProbe.watchMode,
            }
          : null,
        null,
        2,
      )}`,
    );
  }

  async waitForVisualRouteProgress(previousGame, nextGame, minimumProgress) {
    return waitFor(
      async () => {
        try {
          const probe = await this.readBrowserProbe();
          const route = probe?.movement?.playerRoute;
          if (!probe || !route) {
            return null;
          }

          if (
            probe.gameId === previousGame.id &&
            route.active === true &&
            route.progress >= minimumProgress
          ) {
            return probe;
          }
        } catch {}

        return null;
      },
      SIM_WAIT_TIMEOUT_MS,
      `Timed out waiting for visual route progress >= ${minimumProgress} from ${previousGame.player.x},${previousGame.player.y} to ${nextGame.player.x},${nextGame.player.y}.`,
    );
  }

  async captureScreenshot(targetPath) {
    const response = await this.send("Page.captureScreenshot", {
      captureBeyondViewport: false,
      format: "png",
      fromSurface: true,
    });

    const data = response?.result?.data;
    if (!data) {
      throw new Error("Chrome did not return screenshot data.");
    }

    await writeFile(targetPath, Buffer.from(data, "base64"));
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
    this.pageErrors.push(error);
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
  const userDataDir = path.join(OUTPUT_DIR, "chrome-session");
  const devtoolsPort = FIXED_DEVTOOLS_PORT ?? (await reserveAvailablePort());
  const browser = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
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
  browser.once("error", (error) => {
    browserStartError = error;
  });
  browser.stderr?.on("data", (chunk) => {
    browserStderr += chunk.toString();
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
      `Timed out waiting for Chrome DevTools on port ${devtoolsPort}. ${browserStderr}`,
    );
  } catch (error) {
    await closeChildProcess(browser);
    throw error;
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
    gameId: game.id,
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      spaceId: game.activeSpaceId ?? game.player.spaceId ?? null,
      x: game.player.x,
      y: game.player.y,
    },
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
        ...(trace?.considered ?? []).map((option) => option.label),
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
      [
        ...(trace?.rejected ?? []).map((option) =>
          option.reason ? `${option.label}: ${option.reason}` : option.label,
        ),
        ...(trace?.blockers ?? []),
      ],
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
    .replace(/\badvance_objective\b/gi, "")
    .replace(/\bplanningTrace\b/gi, "")
    .replace(/\brouteKey\b/gi, "")
    .replace(/\bworldPressure\b/gi, "")
    .replace(/\bcityEvents\b/gi, "")
    .replace(/\bjobWindows\b/gi, "")
    .replace(/\bnpcSchedules\b/gi, "")
    .replace(/\bselectedPlanKey\b/gi, "")
    .replace(/\bplanKey\b/gi, "")
    .replace(/\btargetLocationId\b/gi, "")
    .replace(/\bactionId\b/gi, "")
    .replace(/^Action:\s*/i, "")
    .replace(/\bcurrent objective\b/gi, "current aim")
    .replace(/\bplanner trace\b/gi, "Rowan weighs")
    .replace(/\bis an open desired-state predicate\b/gi, "")
    .replace(/\bdesired-state predicate\b/gi, "aim")
    .replace(/\bstale predicate\b/gi, "stale lead")
    .replace(/\bpredicate\b/gi, "aim")
    .replace(/\bRejected because\b/gi, "")
    .replace(/\bdominant live pressure\b/gi, "strongest current reason")
    .replace(/\blive pressure\b/gi, "current reason")
    .replace(/\broute hint action\b/gi, "suggested move")
    .replace(/\broute hint\b/gi, "suggested path")
    .replace(
      /\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function worldPressureFromGame(game) {
  const currentTotalMinutes = game.clock.totalMinutes;
  const dayOffsetMinutes = Math.max(0, game.clock.day - 1) * 24 * 60;
  const currentHour = game.clock.hour + game.clock.minute / 60;
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
    npcSchedules: (game.npcs ?? []).map((npc) => {
      const currentSchedule =
        npc.schedule.find(
          (entry) =>
            currentHour >= entry.fromHour && currentHour < entry.toHour,
        ) ?? null;
      const nextSchedule =
        npc.schedule
          .filter((entry) => entry.fromHour > currentHour)
          .sort((left, right) => left.fromHour - right.fromHour)[0] ?? null;
      return {
        currentLocationId: npc.currentLocationId,
        currentConcern: npc.currentConcern,
        currentScheduleLocationId: currentSchedule?.locationId ?? null,
        id: npc.id,
        mood: npc.mood,
        nextScheduleLocationId: nextSchedule?.locationId ?? null,
        nextScheduleStartsInMinutes: nextSchedule
          ? Math.max(0, Math.round((nextSchedule.fromHour - currentHour) * 60))
          : null,
      };
    }),
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

function independentNpcActionsFromGame(game) {
  const npcsById = new Map((game.npcs ?? []).map((npc) => [npc.id, npc]));
  return (game.problems ?? [])
    .filter(
      (problem) => problem.status === "resolved" && problem.resolvedByNpcId,
    )
    .map((problem) => {
      const resolver = npcsById.get(problem.resolvedByNpcId);
      const resolverName =
        resolver?.name ?? problem.resolvedByNpcId ?? "A local";
      return {
        afterStatus: problem.status,
        beforeStatus: "active",
        locationId: problem.locationId,
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
      };
    })
    .sort((left, right) => {
      const leftTime = left.resolvedAt
        ? Date.parse(left.resolvedAt)
        : Number.NEGATIVE_INFINITY;
      const rightTime = right.resolvedAt
        ? Date.parse(right.resolvedAt)
        : Number.NEGATIVE_INFINITY;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.problemId.localeCompare(right.problemId);
    });
}

function findCityEvent(game, id) {
  return (game.cityEvents ?? []).find((event) => event.id === id) ?? null;
}

function assertBrowserProbeMatchesGame(label, game, probe, options = {}) {
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
  assert.deepEqual(
    probe.objective,
    objectiveProbeFromGame(game),
    `${label}: browser objective predicates diverged from sim.`,
  );
  const expectedPlanningTrace = planningTraceProbeFromGame(game);
  if (expectedPlanningTrace) {
    assert.deepEqual(
      probe.autonomy.planningTrace,
      expectedPlanningTrace,
      `${label}: browser planner trace diverged from sim.`,
    );
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
  assert.equal(
    probe.visualPlayer?.isMovingToServerState ?? false,
    Boolean(options.allowVisualMove),
    `${label}: browser still thinks the player is in a staged visual move.`,
  );
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
      !["route-scaffold", "stale-predicate"].includes(
        selectedTraceOption.provenance,
      ),
    `${label}: selected planner option must not have stale predicate or route scaffold provenance.`,
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
    /\b(routeKey|advance_objective|planningTrace|worldPressure|cityEvents|jobWindows|npcSchedules|planKey|actionId|targetLocationId|desired-state predicate|stale predicate|route hint action|Rejected because|live pressure|predicate)\b/i,
    `${label}: decision artifact leaked backend-shaped labels.`,
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
  assert.doesNotMatch(
    artifact.text,
    /Planner trace|Rejected:|Blocked:|Action:|routeKey|advance_objective|planningTrace|desired-state predicate|stale predicate|route hint action|Rejected because|live pressure|predicate/i,
    `${label}: decision callback leaked debug/planner language.`,
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
  assert.ok(
    (probe.independentNpcActions ?? []).every(
      (action) =>
        action.problemId &&
        action.problemTitle &&
        action.resolverNpcId &&
        action.resolverName &&
        action.beforeStatus === "active" &&
        action.afterStatus === "resolved" &&
        action.resolvedAt &&
        action.playerFacingSummary &&
        !/\bresolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId\b/i.test(
          action.playerFacingSummary,
        ),
    ),
    `${label}: independent NPC action probe must expose compact resolver, before/after, time, and player-facing summary evidence.`,
  );

  if (probe.independentNpcSurface) {
    const surface = probe.independentNpcSurface;
    assert.ok(
      ["now", "just_happened"].includes(surface.slot),
      `${label}: independent NPC surface must say whether it is the current or just-happened rail beat.`,
    );
    assert.ok(
      surface.problemId &&
        surface.problemTitle &&
        surface.resolverNpcId &&
        surface.resolverName &&
        surface.resolvedAt &&
        surface.title &&
        surface.detail,
      `${label}: independent NPC surface must stay backed by problem, resolver, time, title, and visible copy.`,
    );
    assert.ok(
      !/\bresolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId\b/i.test(
        `${surface.title} ${surface.detail}`,
      ),
      `${label}: independent NPC surface leaked debug fields into the visible rail copy.`,
    );
  }
}

async function waitForGameplayDom(label, session, probe) {
  const expectedLabel = probe.autonomy.label.slice(0, 28);
  const expectedPattern = new RegExp(escapeRegExp(expectedLabel), "i");
  const startedAt = Date.now();
  let lastDom = null;

  while (Date.now() - startedAt < SIM_WAIT_TIMEOUT_MS) {
    try {
      lastDom = await session.readDomSnapshot();
      if (
        lastDom?.hasFrameworkErrorOverlay ||
        expectedPattern.test(lastDom?.bodyText ?? "")
      ) {
        return lastDom;
      }
    } catch {}

    await sleep(PROBE_POLL_INTERVAL_MS);
  }

  assert.fail(
    `${label}: rendered UI did not catch up to the current Rowan beat "${expectedLabel}". Last DOM: ${
      lastDom?.bodyTextSample ?? "missing"
    }`,
  );
}

async function refreshProbeForVisibleIndependentNpcSurface({
  dom,
  label,
  probe,
  session,
}) {
  if (
    label !== "independent-npc-resolution" ||
    probe.independentNpcSurface ||
    (probe.independentNpcActions ?? []).length === 0
  ) {
    return probe;
  }

  if (!/city beat|steadied|contained/i.test(dom.bodyText ?? "")) {
    return probe;
  }

  return waitFor(
    async () => {
      const refreshedProbe = await session.readBrowserProbe();
      if (refreshedProbe.independentNpcSurface) {
        return refreshedProbe;
      }
      return null;
    },
    5_000,
    `${label}: visible independent NPC city beat did not reach the browser probe before capture.`,
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
    const visibleConversationCopy = [dom.conversationText, dom.bodyText]
      .filter(Boolean)
      .join(" ");
    assert.match(
      visibleConversationCopy,
      /Rowan (?:replies automatically|is replying automatically|will answer automatically|will keep the conversation moving|is carrying the conversation)/i,
      `${label}: watch-mode conversation does not expose passive carry-forward copy.`,
    );
  }
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
  if (routeRole === "conversation-resolution" && !selectedActionId) {
    authorityKinds.push("conversation-resolution");
  }

  const rejectedStaleOptions = (planningTrace.rejected ?? [])
    .filter((option) =>
      ["route-scaffold", "stale-predicate"].includes(option.provenance),
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
      : /\b(?:toward Morrow House|Head to Morrow House|Enter Morrow House|return home|head back|take stock|room)\b/i.test(
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
    ["route-scaffold", "stale-predicate"].includes(
      authorityEvidence.selectedProvenance,
    )
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
    !authorityEvidence.selectedPressureKind
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
    /^(?:Exit to South Quay|Head to Kettle & Lamp|On the way to Kettle & Lamp|Enter Kettle & Lamp|Talk to Ada)$/i.test(
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
    /^(?:Exit to South Quay|Head to Morrow House|On the way to Morrow House|Enter Morrow House|Take stock)$/i.test(
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
    ["route-scaffold", "stale-predicate"].includes(
      entry.selectedProvenance ?? "",
    ),
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
    `Early agency selected route-scaffold/stale authority: ${JSON.stringify(
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

function compactWorldPressureSnapshot(worldPressure) {
  if (!worldPressure) {
    return null;
  }

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
    npcPressureMoves: (worldPressure.npcSchedules ?? [])
      .filter(
        (npc) =>
          npc.currentScheduleLocationId &&
          npc.currentLocationId !== npc.currentScheduleLocationId,
      )
      .map((npc) => ({
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
      const key = [
        action.problemId,
        action.resolverNpcId,
        action.resolvedAt,
      ].join("|");
      if (actionsByKey.has(key)) {
        continue;
      }
      actionsByKey.set(key, {
        ...action,
        observedDelayMinutes: minutesBetweenIso(
          action.resolvedAt,
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

    const key = [
      surfaced.problemId,
      surfaced.resolverNpcId,
      surfaced.resolvedAt,
    ].join("|");
    if (surfacedByKey.has(key)) {
      continue;
    }
    surfacedByKey.set(key, {
      ...surfaced,
      surfaceDelayMinutes: minutesBetweenIso(
        surfaced.resolvedAt,
        moment.clock?.iso,
      ),
      firstSurfacedClock: moment.clock ?? null,
      firstSurfacedLabel: moment.label ?? null,
      firstSurfacedScreenshot: moment.screenshot ?? null,
    });
  }

  const resolverTimelineChanges = (
    worldPressureAudit?.worldPressureTimeline ?? []
  ).filter(
    (change) =>
      change.kind === "problem" &&
      change.cause === "independent" &&
      ["resolvedByNpcId", "status"].includes(change.field) &&
      (change.field !== "status" || change.to === "resolved"),
  );

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

function assertIndependentNpcActionEvidence(evidence) {
  assert.ok(
    evidence,
    "Independent NPC action evidence must be recorded in the browser report.",
  );
  assert.ok(
    evidence.observedActionCount > 0,
    `Browser report must capture at least one independent NPC-owned problem resolution. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.actions.some(
      (action) =>
        ["problem-pump", "problem-cart"].includes(action.problemId) &&
        action.problemTitle &&
        action.resolverNpcId &&
        action.resolverName &&
        action.beforeStatus === "active" &&
        action.afterStatus === "resolved" &&
        action.resolvedAt &&
        action.firstObservedLabel &&
        action.playerFacingSummary &&
        !/\bresolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId\b/i.test(
          action.playerFacingSummary,
        ),
    ),
    `Independent NPC action evidence must connect problem, resolver, before/after state, time, report moment, and player-facing summary. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActionCount > 0,
    `Browser report must capture at least one rail-visible independent city beat. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActions.some(
      (action) =>
        ["now", "just_happened"].includes(action.slot) &&
        action.problemId &&
        action.resolverNpcId &&
        action.resolvedAt &&
        action.title &&
        action.detail &&
        action.firstSurfacedLabel &&
        action.firstSurfacedScreenshot &&
        !/\bresolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId\b/i.test(
          `${action.title} ${action.detail}`,
        ),
    ),
    `Independent NPC rail beats must stay player-facing and screenshot-backed in the browser report. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
  assert.ok(
    evidence.surfacedActions.some(
      (action) =>
        ["problem-pump", "problem-cart"].includes(action.problemId) &&
        action.surfaceDelayMinutes !== null &&
        action.surfaceDelayMinutes >= 0 &&
        action.surfaceDelayMinutes <=
          INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES,
    ),
    `Independent NPC rail beats must surface within ${INDEPENDENT_NPC_SURFACE_MAX_DELAY_MINUTES} sim minutes of resolvedAt. Evidence: ${JSON.stringify(
      evidence,
      null,
      2,
    )}`,
  );
}

function assertIndependentResolutionDecisionArtifact(moments) {
  const moment = (moments ?? []).find(
    (entry) =>
      entry.independentNpcSurface &&
      entry.visibleDecisionArtifact &&
      ["problem-pump", "problem-cart"].includes(
        entry.independentNpcSurface.problemId,
      ),
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
    /\bresolvedByNpcId|worldPressure|cityEvents|problemId|resolverNpcId\b/i,
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
  if (commandRail && !game.activeConversation) {
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

  if (!game.activeConversation) {
    assert.notEqual(
      probe.railVisibility?.commandRailAnchorVisible,
      false,
      `${label}: browser probe reports active Rowan rail card is not fully visible.`,
    );
  }

  if (!game.activeConversation) {
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
  bounds,
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
  assert.ok(
    pointInsideBounds(movementGeometry?.playerWorldPoint, bounds),
    `${label}: settled movement geometry point is outside the authored ${locationName} region: ${JSON.stringify({
      point: movementGeometry?.playerWorldPoint,
      bounds,
      movement: movementGeometry,
    })}.`,
  );

  if (entry.camera?.playerWorldPoint) {
    assert.ok(
      pointInsideBounds(entry.camera.playerWorldPoint, bounds),
      `${label}: settled camera/player point is outside the authored ${locationName} region: ${JSON.stringify({
        point: entry.camera.playerWorldPoint,
        bounds,
        movement: movementGeometry,
      })}.`,
    );
  }

  if (!entry.mapAgency) {
    return;
  }

  assert.equal(
    entry.mapAgency.currentLocation?.id,
    locationId,
    `${label}: map-agency current location must agree with ${locationName}.`,
  );
  assert.ok(
    pointInsideBounds(entry.mapAgency.playerWorldPoint, bounds),
    `${label}: settled player map-agency point is outside the authored ${locationName} region: ${JSON.stringify({
      point: entry.mapAgency.playerWorldPoint,
      bounds,
      movement: movementGeometry,
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

function buildMovementAuditSummary(timeline) {
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
  const routeSampleMatches = ({ fromLocationId, npcId, toLocationId }) =>
    routeSamples.filter(
      (route) =>
        route.npcId === npcId &&
        route.fromLocationId === fromLocationId &&
        route.toLocationId === toLocationId,
    );
  const markerSampleMatches = ({ fromLocationId, npcId, toLocationId }) =>
    markerSamples.filter(
      (marker) =>
        marker.npcId === npcId &&
        marker.currentLocationId === fromLocationId &&
        marker.toLocationId === toLocationId,
    );
  const visualCueSampleMatches = ({ fromLocationId, npcId, toLocationId }) =>
    visualCueSamples.filter(
      (cue) =>
        cue.npcId === npcId &&
        cue.fromLocationId === fromLocationId &&
        cue.toLocationId === toLocationId &&
        cue.cueKind === "current-schedule-stop",
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
            toLocationId,
          })
        : [];
      const matchingMarkers = currentStopChanged
        ? markerSampleMatches({
            fromLocationId,
            npcId,
            toLocationId,
          })
        : [];
      const matchingVisualCues = currentStopChanged
        ? visualCueSampleMatches({
            fromLocationId,
            npcId,
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
      const continuityGapReason =
        currentStopChanged && legalRouteEvidence && !markerEvidence.valid
          ? "marker-not-visible-before-stop-change"
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

    for (const fieldNote of layout.fieldNotes ?? []) {
      assertRectInsideRect(
        label,
        fieldNote.rect,
        layout.focusWindow,
        `field note ${fieldNote.key ?? "unknown"}`,
        "focus panel",
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
    /\b(worldPressure|cityEvents|jobWindows|npcSchedules|planningTrace|routeKey)\b/i,
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

function compactNotebookText(notebook) {
  return [
    notebook?.title,
    notebook?.belief,
    notebook?.clue,
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
  assertBrowserProbeMatchesGame(label, game, initialProbe);
  assertCityEventState(label, game);
  const dom = await waitForGameplayDom(label, session, initialProbe);
  const probe = await refreshProbeForVisibleIndependentNpcSurface({
    dom,
    label,
    probe: initialProbe,
    session,
  });
  assertBrowserProbeMatchesGame(label, game, probe);
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
  await session.navigate(url);
  const startProbe = await session.readBrowserProbe();
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

  const completedProbe = await waitFor(
    async () => {
      const probe = await session.readBrowserProbe();
      if (
        probe?.firstAfternoon?.completedAt ||
        /first afternoon complete/i.test(probe?.autonomy?.label ?? "")
      ) {
        return probe;
      }
      return null;
    },
    140_000,
    "Autoplay did not reach first-afternoon completion without manual advance clicks.",
  );
  const dom = await session.readDomSnapshot();
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

  const screenshotPath = path.join(
    OUTPUT_DIR,
    "autoplay-observation-complete.png",
  );
  await session.captureScreenshot(screenshotPath);

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
    screenshot: screenshotPath,
    start: {
      autonomyLabel: startProbe.autonomy?.label ?? null,
      clock: startProbe.clock,
      gameId: startProbe.gameId,
      watchMode: startProbe.watchMode,
    },
  };
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
        /npcSchedules/i,
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

function playerProbeSignature(probe) {
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
    playback: probe.playback ?? null,
    visualPlayer: probe.visualPlayer ?? null,
  });
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

  return range.x >= 8 || range.y >= 8;
}

function buildWatchPacingAudit(clickLog) {
  const watchedBeats = clickLog
    .filter((entry) => entry.kind === "watched-auto-continue")
    .map((entry) => ({
      beforeAutonomyLabel: entry.beforeAutonomyLabel ?? null,
      completionAutoContinue: Boolean(entry.completionAutoContinue),
      durationMs: entry.durationMs ?? null,
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
    .map((entry) => entry.durationMs)
    .filter((duration) => typeof duration === "number");
  const shortOrdinaryBeats = ordinaryBeats.filter(
    (entry) => (entry.durationMs ?? 0) < 2_600,
  );

  return {
    openingFirstActionBeats,
    ordinaryBeatCount: ordinaryBeats.length,
    ordinaryMinDurationMs:
      ordinaryDurations.length > 0 ? Math.min(...ordinaryDurations) : null,
    readableFloorMs: 2_600,
    shortOrdinaryBeats,
    watchedBeats,
  };
}

function assertWatchPacingAudit(watchPacingAudit) {
  assert.ok(
    watchPacingAudit.openingFirstActionBeats.every(
      (entry) => (entry.durationMs ?? Infinity) <= 1_600,
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
      watchPacingAudit.readableFloorMs,
    `Ordinary watch-beat minimum dwell was below ${watchPacingAudit.readableFloorMs}ms: ${watchPacingAudit.ordinaryMinDurationMs}ms.`,
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
    label: moment.label,
    location: moment.location ?? null,
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
    screenshot: moment.screenshot ?? null,
    selected,
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
      ["route-scaffold", "stale-predicate"].includes(option.provenance),
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
    !["route-scaffold", "stale-predicate"].includes(selected.provenance) &&
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
  const rest = byLabel["post-first-afternoon-rest"] ?? null;
  const liveRoute = byLabel["post-first-afternoon-live-route"] ?? null;
  const followThrough =
    byLabel["post-first-afternoon-yard-follow-through"] ?? null;
  const handoffSummary = compactPostFirstAfternoonMoment(handoff);
  const restSummary = compactPostFirstAfternoonMoment(rest);
  const liveRouteSummary = compactPostFirstAfternoonMoment(liveRoute);
  const followThroughSummary = compactPostFirstAfternoonMoment(followThrough);
  const handoffLivePressureOptions = livePressurePlannerOptions(handoff);
  const restLivePressureOptions = livePressurePlannerOptions(rest);
  const liveRoutePressureOptions = livePressurePlannerOptions(liveRoute);
  const followThroughPressureOptions =
    livePressurePlannerOptions(followThrough);

  return {
    assertionSemantics:
      "Player-POV zero-click follow-through from first-afternoon completion acknowledgement, through rest, into the next dynamic current-state route/action.",
    directSimCommandsUsed: false,
    handoff: handoffSummary,
    livePressure: {
      atHandoff: postFirstAfternoonLivePressureFacts(handoff),
      afterRest: postFirstAfternoonLivePressureFacts(rest),
      atFollowThrough: postFirstAfternoonLivePressureFacts(followThrough),
      atLiveRoute: postFirstAfternoonLivePressureFacts(liveRoute),
      plannerOptionsAtFollowThrough: followThroughPressureOptions,
      plannerOptionsAtHandoff: handoffLivePressureOptions,
      plannerOptionsAfterRest: restLivePressureOptions,
      plannerOptionsAtLiveRoute: liveRoutePressureOptions,
    },
    followThrough: followThroughSummary,
    liveRoute: liveRouteSummary,
    notebookFreshness: {
      afterRest: restSummary?.notebook ?? null,
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
        ].includes(entry.milestone),
      )
      .map((entry) => ({
        beforeAutonomyLabel: entry.beforeAutonomyLabel ?? null,
        completionAutoContinue: Boolean(entry.completionAutoContinue),
        durationMs: entry.durationMs ?? null,
        kind: entry.kind,
        milestone: entry.milestone,
        sequenceRunId: entry.sequenceRunId ?? null,
      })),
    rest: {
      ...restSummary,
      restHourEnergy: restHourEnergyFromMoment(rest),
    },
    staleRouteEvidence: {
      atHandoff: staleRoutePlannerOptions(handoff),
      afterRest: staleRoutePlannerOptions(rest),
      atLiveRoute: staleRoutePlannerOptions(liveRoute),
    },
    status: "passed",
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

function assertPostFirstAfternoonLivePressureEvidence(evidence) {
  assert.ok(
    evidence?.handoff,
    "Post-first-afternoon follow-through evidence is missing the handoff moment.",
  );
  assert.ok(
    evidence?.rest,
    "Post-first-afternoon follow-through evidence is missing the rest moment.",
  );
  assert.ok(
    evidence?.liveRoute,
    "Post-first-afternoon follow-through evidence is missing the live-route moment.",
  );
  assert.ok(
    evidence?.followThrough,
    "Post-first-afternoon follow-through evidence is missing the yard/Tomas follow-through moment.",
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

  for (const summary of [evidence.handoff, evidence.rest, evidence.liveRoute]) {
    assert.notEqual(
      summary.objective?.routeKey,
      "first-afternoon",
      `${summary.label}: post-first-afternoon evidence stayed on first-afternoon route authority.`,
    );
    assertPostFirstAfternoonNotebookSummary(summary);
  }

  assert.equal(
    evidence.handoff.selected?.actionId,
    "rest:home",
    "Post-first-afternoon handoff must select the legal home-rest action.",
  );
  assert.equal(
    evidence.handoff.selected?.targetLocationId,
    "boarding-house",
    "Post-first-afternoon rest handoff should target Morrow House.",
  );
  assert.equal(
    evidence.handoff.selected?.legalBacking?.source,
    "current-legal-action-surface",
    "Post-first-afternoon rest handoff must expose current legal-action backing.",
  );
  assert.equal(
    evidence.handoff.selected?.pressureKind,
    "predicate",
    "Post-first-afternoon rest handoff must be backed by a desired-state predicate.",
  );
  assert.equal(
    evidence.handoff.selected?.matchedOutcomeId,
    "rest-hour",
    "Post-first-afternoon rest handoff must match the rest-hour outcome.",
  );
  assert.equal(
    evidence.handoff.selected?.provenance,
    "objective-predicate",
    "Post-first-afternoon rest handoff must not be route-scaffold authority.",
  );
  assert.ok(
    evidence.handoff.firstAfternoon?.completionAcknowledgedAt,
    "Post-first-afternoon handoff must acknowledge the completed field-note beat.",
  );

  const livePressureBeforeLiveRoute = [
    ...(evidence.livePressure?.plannerOptionsAtHandoff ?? []),
    ...(evidence.livePressure?.plannerOptionsAfterRest ?? []),
  ];
  assert.ok(
    livePressureBeforeLiveRoute.length > 0,
    "Post-first-afternoon handoff/rest evidence did not expose current job or problem pressure.",
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
    (evidence.rest.restHourEnergy ?? 0) >= POST_FIRST_AFTERNOON_RECOVERY_ENERGY,
    `Post-first-afternoon rest evidence did not show rest advancing Rowan's recovery state: ${evidence.rest.restHourEnergy}.`,
  );
  assert.notEqual(
    evidence.rest.objective?.routeKey,
    "rest-home",
    "Post-first-afternoon rest evidence must leave rest-home once Rowan has recovered enough energy.",
  );
  assert.notEqual(
    evidence.rest.selected?.actionId,
    "rest:home",
    "Post-first-afternoon rest evidence must not select another rest:home after Rowan has recovered enough energy.",
  );
  assert.ok(
    evidence.rest.selected?.legalBacking?.source,
    "Post-first-afternoon rest follow-through must expose legal backing for the next non-rest action.",
  );
  const liveRouteProgressedBeyondRest =
    (evidence.liveRoute.clock?.totalMinutes ?? 0) >
      (evidence.rest.clock?.totalMinutes ?? 0) ||
    evidence.liveRoute.location?.spaceId !== evidence.rest.location?.spaceId ||
    evidence.liveRoute.location?.id !== evidence.rest.location?.id ||
    evidence.liveRoute.selected?.actionId !== evidence.rest.selected?.actionId;
  assert.ok(
    liveRouteProgressedBeyondRest,
    "Post-first-afternoon live-route evidence must progress beyond the first non-rest post-recovery selection.",
  );
  assert.equal(
    evidence.liveRoute.objective?.source,
    "dynamic",
    "Post-rest live route must come from a dynamic current-state objective.",
  );
  assert.notEqual(
    evidence.liveRoute.objective?.routeKey,
    "rest-home",
    "Post-rest live route must leave the rest objective once recovery opens the next route.",
  );
  assert.ok(
    evidence.liveRoute.selected?.actionId,
    "Post-rest live route must expose the next selected action.",
  );
  assert.ok(
    evidence.liveRoute.selected?.legalBacking?.source,
    "Post-rest live route must expose an explicit legal backing source.",
  );
  assert.ok(
    evidence.liveRoute.selected?.pressureId ||
      evidence.liveRoute.selected?.matchedOutcomeId ||
      evidence.liveRoute.selected?.pressureKind,
    "Post-rest live route must expose current-state predicate or live-pressure authority.",
  );
  assert.ok(
    !["route-scaffold", "stale-predicate"].includes(
      evidence.liveRoute.selected?.provenance,
    ),
    `Post-rest live route selected stale route authority: ${evidence.liveRoute.selected?.provenance}.`,
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
      return probe;
    },
    75_000,
    `${label}: timed out waiting for the player-facing run to settle.`,
  );
}

async function waitForInhabitTransition(session, beforeSignature, label) {
  return waitFor(
    async () => {
      const probe = await session.readBrowserProbe(`${label}:browser-probe`);
      if (!probe || playerProbeSignature(probe) === beforeSignature) {
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
  const probe = probeOverride ?? (await waitForInhabitSettled(session, label));
  const dom = probe.independentNpcSurface
    ? await waitForInhabitIndependentNpcSurfaceDom(session, label, probe)
    : await session.readDomSnapshot(`${label}:dom-snapshot`);
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
    independentNpcActions: probe.independentNpcActions ?? [],
    independentNpcSurface: probe.independentNpcSurface ?? null,
    label,
    location: probe.location,
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
      label: "mara-lead-landed",
      pattern: /South Quay|Kettle & Lamp|cafe|leav|stepping back|heading/i,
      reason:
        "mara-lead-landed: continued-watch copy should describe leaving Morrow House or moving toward Kettle & Lamp.",
    },
    {
      label: "arrived-kettle-lamp",
      pattern: /Kettle & Lamp|cafe|enter|stepping into/i,
      reason:
        "arrived-kettle-lamp: continued-watch copy should describe entering Kettle & Lamp.",
    },
    {
      label: "shift-in-motion",
      pattern: /lunch rush|work|shift|counter/i,
      reason:
        "shift-in-motion: continued-watch copy should describe working or keeping the lunch rush moving.",
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
    assert.match(visibleWatchText, expectation.pattern, expectation.reason);
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
  objectiveSequenceAudit,
  session,
}) {
  for (let attempt = 0; attempt <= maxClicks; attempt += 1) {
    const probe = await waitForInhabitSettled(
      session,
      `${milestone.label}-settled-${attempt}`,
    );
    if (milestone.reached(probe)) {
      return probe;
    }

    if (attempt === maxClicks) {
      break;
    }

    const beforeSignature = playerProbeSignature(probe);
    const completionAutoContinue =
      isFirstAfternoonCompletionPendingProbe(probe);
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
        beforeAutonomyLabel: probe.autonomy?.label ?? null,
        beforeClock: probe.clock,
        beforeLocation: probe.location,
        completionAutoContinue,
        objectiveSequenceAuditIndex: objectiveSequenceAudit.length - 1,
        kind: "watched-auto-continue",
        milestone: milestone.label,
        sequenceRunId: objectiveSequenceGroupIdForEntry(auditEntry),
        text: completionAutoContinue
          ? "Watched autoplay dwell on the completion field note, then open the next live objective."
          : "Watched autoplay carry the beat.",
      };
      clickLog.push(logEntry);
      const startedAt = Date.now();
      await waitForInhabitTransition(
        session,
        beforeSignature,
        `${milestone.label}-watch-${attempt + 1}`,
      );
      logEntry.durationMs = Date.now() - startedAt;
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
      label: "mara-conversation",
      maxClicks: 4,
      reached: (probe) => probe.activeConversation?.npcId === "npc-mara",
      userQuestion: "Does the game clearly start the first human interaction?",
    },
    {
      label: "mara-lead-landed",
      maxClicks: 6,
      reached: (probe) =>
        Boolean(probe.firstAfternoon?.hasLeadFieldNote) ||
        probe.autonomy?.targetLocationId === "tea-house",
      userQuestion:
        "Does Mara's conversation produce an understandable lead instead of dead air?",
    },
    {
      label: "arrived-kettle-lamp",
      maxClicks: 8,
      reached: (probe) =>
        probe.location?.id === "tea-house" ||
        probe.location?.spaceId === "interior:tea-house",
      userQuestion: "Can I follow Rowan from the house to Kettle & Lamp?",
    },
    {
      label: "ada-conversation",
      maxClicks: 8,
      reached: (probe) => probe.activeConversation?.npcId === "npc-ada",
      userQuestion: "Does the lead resolve into the right person and place?",
    },
    {
      label: "shift-in-motion",
      maxClicks: 12,
      reached: (probe) =>
        ["rush", "counter", "paid"].includes(
          probe.firstAfternoon?.teaShiftStage,
        ) || /lunch rush|finish/i.test(probe.autonomy?.label ?? ""),
      userQuestion:
        "Does accepting work turn into a visible, readable gameplay beat?",
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
    await clickUntilInhabitMilestone({
      clickLog,
      maxClicks: milestone.maxClicks,
      milestone,
      objectiveSequenceAudit,
      session,
    });
    milestonesReached.push(milestone.label);
    await captureInhabitMoment({
      index: momentIndex++,
      label: milestone.label,
      moments,
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
  assert.ok(
    (completionDwell.durationMs ?? 0) >= 3000,
    `First-afternoon completion auto-acknowledgement was too fast to read: ${completionDwell.durationMs ?? 0}ms.`,
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
  assertObjectiveSequenceAudit(objectiveSequenceAudit);
  const objectiveSequenceRuns = buildObjectiveSequenceRuns(
    objectiveSequenceAudit,
  );
  assertObjectiveSequenceRuns(objectiveSequenceRuns);
  const earlyAgencyAuthorityLedger = buildEarlyAgencyAuthorityLedger({
    moments,
    objectiveSequenceAudit,
    objectiveSequenceRuns,
  });
  assertEarlyAgencyAuthorityLedger(earlyAgencyAuthorityLedger);
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
  const movementAudit = buildMovementAuditSummary(movementAuditMoments);
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
    postFirstAfternoonLivePressureEvidence,
    progressionClicks: clickLog,
    reportPath,
    rowanNotebookClick,
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
        /mara-lead-landed|arrived-kettle-lamp|ada-conversation|shift-in-motion/i.test(
          entry.label,
        ),
      ) ?? null,
    earlyNextCheckDecision:
      withArtifact.find(
        (entry) =>
          entry.nextCheck &&
          /mara-lead-landed|arrived-kettle-lamp|ada-conversation|shift-in-motion/i.test(
            entry.label,
          ),
      ) ?? null,
    laterDecision:
      withArtifact.find((entry) =>
        /post-first-afternoon-handoff|post-first-afternoon-rest|post-first-afternoon-live-route/i.test(
          entry.label,
        ),
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
        const arrival = await advanceObjective(routeProgress.id, true);
        gameRef.current = arrival;
        return advanceObjective(arrival.id, true);
      },
    },
    {
      label: "independent-npc-resolution",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          minutes: 65,
          silent: false,
          type: "wait",
        }),
    },
  ];
}

async function main() {
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
  const session = USE_CHROME_DRIVER
    ? await launchBrowserSession(browserUrl(game.id))
    : null;

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
        const routeStartLabel = `${step.label}-route-start`;
        const routeStartCapture = await captureBrowserMovementState({
          game: previousGame,
          index: `${index}a`,
          label: routeStartLabel,
          probe: routeStartProbe,
          session,
        });
        timeline.push(
          buildTimelineEntry({
            camera: routeStartCapture.camera,
            dom: routeStartCapture.dom,
            game: previousGame,
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
        );
        const routeMidLabel = `${step.label}-route-mid`;
        const routeMidCapture = await captureBrowserMovementState({
          game: previousGame,
          index: `${index}b`,
          label: routeMidLabel,
          probe: routeMidProbe,
          session,
        });
        timeline.push(
          buildTimelineEntry({
            camera: routeMidCapture.camera,
            dom: routeMidCapture.dom,
            game: previousGame,
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
          );
          const routeCloseLabel = `${step.label}-route-close`;
          const routeCloseCapture = await captureBrowserMovementState({
            game: previousGame,
            index: `${index}c`,
            label: routeCloseLabel,
            probe: routeCloseProbe,
            session,
          });
          timeline.push(
            buildTimelineEntry({
              camera: routeCloseCapture.camera,
              dom: routeCloseCapture.dom,
              game: previousGame,
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
      autoplayObservation = await runBrowserPhase(
        "autoplay-observation",
        AUTOPLAY_OBSERVATION_TIMEOUT_MS,
        () => runAutoplayObservation(session),
      );
      await writeCheckpointSummary("autoplay-observation-complete");
      observeOnlyCarryForward = await runBrowserPhase(
        "observe-only-carry-forward",
        OBSERVE_CARRY_FORWARD_TIMEOUT_MS,
        () => runObserveOnlyCarryForwardObservation(session),
      );
      await writeCheckpointSummary("observe-only-carry-forward-complete");
      inhabitGameplay = await runBrowserPhase(
        "inhabit-gameplay",
        INHABIT_GAMEPLAY_TIMEOUT_MS,
        () => runInhabitGameplayPass(session),
      );
      await writeCheckpointSummary("inhabit-gameplay-complete");
      assert.deepEqual(
        session.pageErrors,
        [],
        `Browser emitted runtime/log errors: ${JSON.stringify(session.pageErrors, null, 2)}`,
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
    bounds: KETTLE_LAMP_LANDMARK_BOUNDS,
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
    bounds: OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS,
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

  const screenshotCount = timeline.filter((entry) => entry.screenshot).length;
  const movementAuditTimeline = timeline.filter(
    (entry) => entry.label !== "independent-npc-resolution",
  );
  const movementAudit = buildMovementAuditSummary(movementAuditTimeline);
  assertMovementAuditSummary(movementAudit);
  const independentNpcActionEvidence =
    buildIndependentNpcActionEvidence(timeline);
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
