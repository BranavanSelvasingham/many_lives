import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME_BIN =
  process.env.MANY_LIVES_CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BROWSER_DRIVER = (process.env.MANY_LIVES_BROWSER_DRIVER ?? "probe")
  .trim()
  .toLowerCase();
const DEFAULT_WEB_BASE =
  process.env.MANY_LIVES_WEB_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR =
  process.env.MANY_LIVES_BROWSER_PLAYTEST_DIR ??
  path.join(tmpdir(), `manylives-rowan-browser-${Date.now()}`);
const WINDOW_SIZE = process.env.MANY_LIVES_BROWSER_WINDOW ?? "1365,768";
const DEVTOOLS_PORT = Number(process.env.MANY_LIVES_BROWSER_DEVTOOLS_PORT ?? "9222");
const CDP_WAIT_TIMEOUT_MS = 12_000;
const SIM_WAIT_TIMEOUT_MS = 15_000;
const WEB_START_TIMEOUT_MS = 20_000;
const PROBE_POLL_INTERVAL_MS = 250;
const FALLBACK_WEB_PORT = Number(
  process.env.MANY_LIVES_BROWSER_WEB_FALLBACK_PORT ?? "3101",
);

let activeWebBase = DEFAULT_WEB_BASE;

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

function buildFallbackWebBase(baseUrl) {
  const url = new URL(baseUrl);
  url.port = String(FALLBACK_WEB_PORT);
  return url.toString().replace(/\/$/, "");
}

async function closeChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    once(child, "close").catch(() => undefined),
    sleep(1_500),
  ]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "close").catch(() => undefined);
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
      env: {
        ...process.env,
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let logs = "";
  const appendLogs = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 12_000) {
      logs = logs.slice(-12_000);
    }
  };
  server.stdout?.on("data", appendLogs);
  server.stderr?.on("data", appendLogs);

  server.on("exit", (code) => {
    if (code !== 0) {
      logs += `\n[next-exit:${code}]`;
    }
  });

  try {
    await waitFor(
      async () => {
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
  try {
    await readWebStackHealth(getWebBase());
    return {
      webBase: getWebBase(),
      webServer: null,
    };
  } catch {
    activeWebBase = buildFallbackWebBase(DEFAULT_WEB_BASE);
    const webServer = await startWebServer(activeWebBase);
    await readWebStackHealth(activeWebBase);

    return {
      webBase: activeWebBase,
      webServer,
    };
  }
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

function browserUrl(gameId) {
  return `${getWebBase()}?gameId=${encodeURIComponent(gameId)}&autoplay=0&observe=1`;
}

function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

class CdpSession {
  constructor({
    browser,
    outputDir,
    pageWsUrl,
    url,
  }) {
    this.browser = browser;
    this.outputDir = outputDir;
    this.pageWsUrl = new URL(pageWsUrl);
    this.url = url;
    this.messageId = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;
  }

  async connect() {
    const port =
      this.pageWsUrl.port === ""
        ? 80
        : Number(this.pageWsUrl.port);
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
    await this.send("Page.setLifecycleEventsEnabled", { enabled: true });
    await this.navigate(this.url);
  }

  async navigate(url) {
    const loadEvent = this.waitForEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loadEvent;
    await this.waitForProbe();
  }

  async close() {
    try {
      this.socket?.end();
    } catch {}

    if (this.browser) {
      const closed = once(this.browser, "close").catch(() => undefined);
      if (this.browser.exitCode === null && this.browser.signalCode === null) {
        this.browser.kill("SIGKILL");
      }
      await Promise.race([closed, sleep(1_500)]);
    }
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

  async readBrowserProbe() {
    const probe = await this.evaluate(`(() => {
      const script = document.querySelector("#ml-browser-probe");
      if (!script) {
        return null;
      }
      try {
        return JSON.parse(script.textContent || "null");
      } catch (error) {
        return { parseError: String(error) };
      }
    })()`);

    if (probe?.parseError) {
      throw new Error(`Could not parse #ml-browser-probe: ${probe.parseError}`);
    }

    return probe;
  }

  async waitForProbe() {
    return waitFor(
      async () => {
        try {
          return await this.readBrowserProbe();
        } catch {
          return null;
        }
      },
      CDP_WAIT_TIMEOUT_MS,
      "Timed out waiting for #ml-browser-probe to appear in the browser.",
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
    return waitFor(
      async () => {
        try {
          const probe = await this.readBrowserProbe();
          if (!probe) {
            return null;
          }

          if (
            probe.gameId === previousGame.id &&
            probe.location?.id ===
              (previousGame.player.currentLocationId ?? null) &&
            probe.location?.x === previousGame.player.x &&
            probe.location?.y === previousGame.player.y &&
            probe.visualPlayer?.isMovingToServerState === true &&
            probe.visualPlayer?.targetX === nextGame.player.x &&
            probe.visualPlayer?.targetY === nextGame.player.y
          ) {
            return probe;
          }
        } catch {}

        return null;
      },
      SIM_WAIT_TIMEOUT_MS,
      `Timed out waiting for browser session to stage visual movement from ${previousGame.player.x},${previousGame.player.y} to ${nextGame.player.x},${nextGame.player.y}.`,
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
    return promise;
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
        this.writeControlFrame(0xA, frame.payload);
        continue;
      }

      if (frame.opcode === 0x8) {
        return;
      }

      if (frame.opcode !== 0x1) {
        continue;
      }

      const message = JSON.parse(frame.payload.toString("utf8"));
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
    this.socket.write(Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]));
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
  const browser = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${WINDOW_SIZE}`,
      `--remote-debugging-port=${DEVTOOLS_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  let browserStderr = "";
  browser.stderr?.on("data", (chunk) => {
    browserStderr += chunk.toString();
  });

  const pageWsUrl = await waitFor(async () => {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${DEVTOOLS_PORT}/json/list`);
      const page = targets.find((target) => target.type === "page");
      return page?.webSocketDebuggerUrl ?? null;
    } catch {
      return null;
    }
  }, CDP_WAIT_TIMEOUT_MS, `Timed out waiting for Chrome DevTools on port ${DEVTOOLS_PORT}. ${browserStderr}`);

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
  return new Set([
    "initial-mara-open",
    "mara-live-thread",
    "ada-live-thread",
    "hold-for-shift",
    "arrive-home",
    "post-rest-next-beat",
  ]).has(label);
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
            game.npcs.find((npc) => npc.id === activeConversation.npcId)?.name ??
            null,
          updatedAt: activeConversation.updatedAt,
        }
      : null,
    autonomy: {
      autoContinue: game.rowanAutonomy.autoContinue,
      key: game.rowanAutonomy.key,
      label: game.rowanAutonomy.label,
      mode: game.rowanAutonomy.mode,
      stepKind: game.rowanAutonomy.stepKind,
      targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
    },
    clock: {
      iso: game.currentTime,
      label: game.clock.label,
      totalMinutes: game.clock.totalMinutes,
    },
    gameId: game.id,
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      x: game.player.x,
      y: game.player.y,
    },
    objective: {
      routeKey: game.player.objective?.routeKey ?? null,
      text: game.player.objective?.text ?? null,
    },
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
      status: game.rowanAutonomy.autoContinue ? "Autoplay" : game.currentScene.title,
      thought:
        game.rowanAutonomy.detail ??
        game.summary ??
        game.player.objective?.text ??
        "",
      useConversationTranscript: Boolean(activeConversation),
    },
  };
}

function assertBrowserProbeMatchesGame(label, game, probe) {
  assert.equal(probe.gameId, game.id, `${label}: browser loaded the wrong game id.`);
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
  assert.equal(
    probe.visualPlayer?.isMovingToServerState ?? false,
    false,
    `${label}: browser still thinks the player is in a staged visual move.`,
  );
}

function buildTimelineEntry({
  game,
  label,
  probe,
  screenshot,
  screenshotError,
}) {
  return {
    activeConversation: probe.activeConversation,
    autonomy: probe.autonomy,
    clock: probe.clock,
    label,
    location: probe.location,
    objective: probe.objective,
    rail: probe.rail,
    screenshot,
    screenshotError: screenshotError ?? null,
    visualPlayer: probe.visualPlayer,
    sim: {
      currentTime: game.currentTime,
      energy: game.player.energy,
      locationId: game.player.currentLocationId,
      money: game.player.money,
    },
  };
}

async function captureBrowserState({ game, index, label, session }) {
  const probe = await session.waitForGame(game);
  assertBrowserProbeMatchesGame(label, game, probe);

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
    }
  }

  return {
    probe,
    screenshot,
    screenshotError,
  };
}

async function captureProbeState({ game, label }) {
  const probe = buildProbeFromGame(game);
  assertBrowserProbeMatchesGame(label, game, probe);

  return {
    probe,
    screenshot: null,
    screenshotError: null,
  };
}

function buildRegressionSteps(gameRef) {
  return [
    {
      label: "initial-mara-open",
      mutate: async () => gameRef.current,
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
      label: "stage-cafe-move",
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
      label: "stage-home-move",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "arrive-home",
      mutate: async () => advanceObjective(gameRef.current.id, false),
    },
    {
      label: "first-afternoon-complete",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
  ];
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const { webServer } = await ensureStack();

  const timelinePath = path.join(OUTPUT_DIR, "timeline.json");
  const timeline = [];
  let game = await createGame();
  const gameRef = { current: game };
  const useChromeDriver = BROWSER_DRIVER === "chrome";
  const session = useChromeDriver
    ? await launchBrowserSession(browserUrl(game.id))
    : null;

  try {
    const steps = buildRegressionSteps(gameRef);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const previousGame = gameRef.current;
      game = await step.mutate();
      if (
        session !== null &&
        previousGame &&
        playerPositionChanged(previousGame, game)
      ) {
        await session.waitForVisualMove(previousGame, game);
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
          game,
          label: step.label,
          probe: capture.probe,
          screenshot: capture.screenshot,
          screenshotError: capture.screenshotError,
        }),
      );
      await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");
    }
  } finally {
    await session?.close();
    await closeChildProcess(webServer);
  }

  const byLabel = Object.fromEntries(
    timeline.map((entry) => [entry.label, entry]),
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
    /first useful move/i,
    "Expected Mara's thread to leave Rowan choosing a useful first move.",
  );
  assert.equal(
    byLabel["head-to-cafe-plan"]?.autonomy?.targetLocationId,
    "tea-house",
    "Expected Mara's thread to point Rowan toward Kettle & Lamp.",
  );
  assert.equal(
    byLabel["stage-cafe-move"]?.location?.id,
    "boarding-house",
    "Expected the Kettle & Lamp move to stage before the visual arrival.",
  );
  assert.equal(
    byLabel["stage-cafe-move"]?.autonomy?.targetLocationId,
    "tea-house",
    "Expected the staged move to keep Kettle & Lamp as the target.",
  );
  assert.equal(
    byLabel["ada-live-thread"]?.activeConversation?.npcId,
    "npc-ada",
    "Expected Rowan to reach Ada at Kettle & Lamp.",
  );
  assert.equal(
    byLabel["hold-for-shift"]?.location?.id,
    "tea-house",
    "Expected Rowan to visibly hold at Kettle & Lamp for the shift.",
  );
  assert.match(
    byLabel["hold-for-shift"]?.autonomy?.label ?? "",
    /hold for/i,
    "Expected Rowan to visibly hold for the tea-house shift.",
  );
  assert.equal(
    byLabel["lunch-rush"]?.clock?.totalMinutes,
    740,
    "Expected the lunch rush beat to land at 12:20.",
  );
  assert.match(
    byLabel["lunch-rush"]?.autonomy?.label ?? "",
    /lunch rush/i,
    "Expected Rowan to keep the lunch rush moving once the shift begins.",
  );
  assert.match(
    byLabel["finish-shift"]?.autonomy?.label ?? "",
    /finish/i,
    "Expected Rowan to finish the cafe shift before heading home.",
  );
  assert.equal(
    byLabel["head-home"]?.autonomy?.targetLocationId,
    "boarding-house",
    "Expected Rowan to point back to Morrow House after the paid shift.",
  );
  assert.equal(
    byLabel["arrive-home"]?.location?.id,
    "boarding-house",
    "Expected Rowan to visibly arrive back at Morrow House.",
  );
  assert.match(
    byLabel["arrive-home"]?.autonomy?.label ?? "",
    /take stock/i,
    "Expected Rowan to take stock once he gets home.",
  );
  assert.equal(
    byLabel["first-afternoon-complete"]?.location?.id,
    "boarding-house",
    "Expected Rowan to end the first-afternoon loop at Morrow House.",
  );
  assert.match(
    byLabel["first-afternoon-complete"]?.autonomy?.label ?? "",
    /first afternoon complete/i,
    "Expected the browser run to land the complete first-afternoon state.",
  );

  process.stdout.write(
    `[many-lives] Rowan ${useChromeDriver ? "Chrome" : "in-app probe"} regression passed.\n[many-lives] Web base: ${getWebBase()}\n[many-lives] Game URL: ${browserUrl(game.id)}\n[many-lives] Output: ${OUTPUT_DIR}\n[many-lives] Timeline: ${timelinePath}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Rowan browser regression failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
