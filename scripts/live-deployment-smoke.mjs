#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const LIVE_URL = readOption("--live-url") ?? process.env.MANY_LIVES_APP_HARNESS_LIVE_URL;
const OUTPUT_DIR =
  process.env.MANY_LIVES_LIVE_SMOKE_DIR ??
  path.join(os.tmpdir(), `manylives-live-smoke-${Date.now()}`);
const CDP_WAIT_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_LIVE_SMOKE_CDP_WAIT_TIMEOUT_MS ?? "30000",
);
const CDP_COMMAND_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_LIVE_SMOKE_CDP_COMMAND_TIMEOUT_MS ?? "15000",
);
const APP_READY_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_LIVE_SMOKE_READY_TIMEOUT_MS ?? "30000",
);
const POLL_INTERVAL_MS = 250;
const WINDOW_SIZE = process.env.MANY_LIVES_LIVE_SMOKE_WINDOW ?? "1365,768";
const SUMMARY_PATH = path.join(OUTPUT_DIR, "summary.json");

if (!LIVE_URL) {
  console.error("[many-lives:live-smoke] Missing --live-url.");
  process.exit(2);
}

const liveBase = LIVE_URL.replace(/\/+$/, "");
const chromeBin = findChromeBin();

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const session = await launchBrowserSession();
  const summary = {
    liveUrl: liveBase,
    outputDir: OUTPUT_DIR,
    screenshot: null,
    startedAt: new Date().toISOString(),
    status: "running",
  };

  try {
    summary.health = await readLiveHealth(liveBase);
    console.log(
      `[many-lives:live-smoke] /sim/health ok: provider=${summary.health.aiProvider ?? "unknown"} source=${summary.health.source ?? "unknown"}`,
    );

    const firstUrl = `${liveBase}/?new=1&autoplay=1&releaseLiveSmoke=${Date.now()}`;
    await session.setViewport(parseWindowSize(WINDOW_SIZE));
    await session.navigate(firstUrl);
    await session.waitForAppReady();
    await session.waitForWatchModeUi();
    await sleep(1_000);

    const firstPage = await session.inspectPage();
    const firstProbe = await session.readBrowserProbe();
    assertFreshAutoplayPage(firstPage, firstProbe, liveBase);

    const screenshotPath = path.join(OUTPUT_DIR, "fresh-autoplay.png");
    await session.captureScreenshot(screenshotPath);
    const screenshot = await readFile(screenshotPath);
    assert.ok(
      screenshot.length >= 120_000,
      `Live screenshot is too small to prove a rendered game surface (${screenshot.length} bytes).`,
    );
    summary.screenshot = screenshotPath;

    const seededGameId = await session.evaluate(
      `window.localStorage.getItem("many-lives:street-game-id")`,
    );
    assert.ok(seededGameId, "Fresh live run did not persist a street game id.");

    const promptUrl = `${liveBase}/?autoplay=1&releaseLiveSmokePrompt=${Date.now()}`;
    await session.navigate(promptUrl);
    const prompt = await session.waitForStoredGameChoice();
    assert.equal(prompt.hasResumeButton, true, "Stored-run prompt is missing Resume.");
    assert.equal(prompt.hasStartNewButton, true, "Stored-run prompt is missing Start New.");
    assert.equal(
      new URL(prompt.url).searchParams.has("gameId"),
      false,
      "Stored-run prompt should not bind a game id before the user chooses.",
    );
    assert.equal(
      prompt.hasFrameworkOverlay,
      false,
      "Stored-run prompt rendered a framework error overlay.",
    );
    assert.equal(
      prompt.hasRawBackendError,
      false,
      "Stored-run prompt leaked a raw backend error.",
    );

    await session.clickSelector("[data-resume-stored-game]");
    await session.waitForAppReady();
    await sleep(500);
    const resumedProbe = await session.readBrowserProbe();
    assert.equal(
      resumedProbe?.gameId,
      seededGameId,
      "Resume stored run did not reopen the stored game id.",
    );

    await session.navigate(`${liveBase}/?autoplay=1&releaseLiveSmokeStartNew=${Date.now()}`);
    await session.waitForStoredGameChoice();
    await session.clickSelector("[data-start-new-game]");
    await session.waitForAppReady();
    await sleep(500);
    const freshProbe = await session.readBrowserProbe();
    assert.ok(freshProbe?.gameId, "Start new run did not create a live game id.");
    assert.notEqual(
      freshProbe.gameId,
      seededGameId,
      "Start new run reused the stored game id.",
    );

    assert.deepEqual(
      session.pageIssues,
      [],
      `Live browser emitted console/runtime issues:\n${session.pageIssues
        .map((issue) => `${issue.method}: ${issue.text}`)
        .join("\n")}`,
    );

    Object.assign(summary, {
      finishedAt: new Date().toISOString(),
      firstGameId: firstProbe.gameId,
      freshGameId: freshProbe.gameId,
      prompt,
      resumedGameId: resumedProbe.gameId,
      seededGameId,
      status: "passed",
    });
    await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);

    console.log(
      `[many-lives:live-smoke] passed: first=${firstProbe.gameId} resumed=${resumedProbe.gameId} fresh=${freshProbe.gameId}`,
    );
    console.log(`[many-lives:live-smoke] screenshot: ${screenshotPath}`);
    console.log(`[many-lives:live-smoke] summary: ${SUMMARY_PATH}`);
  } catch (error) {
    Object.assign(summary, {
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      finishedAt: new Date().toISOString(),
      status: "failed",
    });
    await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    throw error;
  } finally {
    await session.close();
  }
}

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

  const candidate = candidates.find((value) => {
    if (!path.isAbsolute(value)) {
      return true;
    }

    return existsSync(value);
  });

  if (!candidate) {
    throw new Error(
      "Could not find Chrome. Set MANY_LIVES_CHROME_BIN to run the live smoke.",
    );
  }

  return candidate;
}

async function readLiveHealth(base) {
  for (const url of [base, `${base}/sim/health`]) {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[many-lives:live-smoke] ${url} -> ${response.status}`);

    if (!response.ok) {
      throw new Error(`Live smoke failed for ${url}: HTTP ${response.status}`);
    }

    if (url.endsWith("/sim/health")) {
      return response.json();
    }
  }

  return null;
}

function assertFreshAutoplayPage(page, probe, base) {
  assert.equal(page.title, "Many Lives", "Live app title is wrong.");
  assert.equal(
    new URL(page.url).origin,
    new URL(base).origin,
    "Live app navigated away from the deployment origin.",
  );
  assert.ok(page.canvas, "Live app is missing the game canvas.");
  assert.ok(page.rail, "Live app is missing the Rowan rail.");
  assert.ok(page.canvas.width >= 520, `Live canvas is too narrow: ${page.canvas.width}px.`);
  assert.ok(page.canvas.height >= 420, `Live canvas is too short: ${page.canvas.height}px.`);
  assert.ok(page.rail.width >= 280, `Live Rowan rail is too narrow: ${page.rail.width}px.`);
  assert.equal(page.hasFrameworkOverlay, false, "Live app rendered a framework error overlay.");
  assert.equal(page.hasRawBackendError, false, "Live app leaked a raw backend error.");
  assert.ok(page.rootClass.includes("is-watch-mode"), "Live app did not enter watch mode.");
  assert.ok(
    page.bodyText.includes("Rowan") &&
      (page.bodyText.includes("Continue watching") ||
        page.bodyText.includes("Watch Rowan begin")),
    "Live app is missing Rowan watch-mode action text.",
  );
  assert.ok(
    !/Advance now|A next step is ready|Autoplay is on; this skips/i.test(
      page.bodyText,
    ),
    "Live app leaked watch-mode stepper copy.",
  );
  assert.ok(!page.bodyText.includes("Nudge Rowan"), "Live app still contains Nudge Rowan copy.");
  assert.ok(probe?.gameId, "Live browser probe is missing a game id.");
  assert.equal(probe.watchMode?.enabled, true, "Live browser probe did not report watch mode.");
  assert.ok(probe.objective?.text, "Live browser probe is missing Rowan's objective.");
  assert.ok(probe.rail?.now, "Live browser probe is missing Rowan's current rail beat.");
}

async function launchBrowserSession() {
  const userDataDir = path.join(OUTPUT_DIR, "chrome-session");
  const devtoolsPort = await reserveAvailablePort();
  const [width, height] = WINDOW_SIZE.split(",").map((part) => Number(part.trim()));
  const browser = spawn(
    chromeBin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${Number.isFinite(width) ? width : 1365},${Number.isFinite(height) ? height : 768}`,
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
        try {
          const targets = await fetchJson(`http://127.0.0.1:${devtoolsPort}/json/list`);
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
    pageWsUrl,
  });
  await session.connect();
  return session;
}

class CdpSession {
  constructor({ browser, pageWsUrl }) {
    this.browser = browser;
    this.pageWsUrl = new URL(pageWsUrl);
    this.messageId = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.pageIssues = [];
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;
    this.socketClosed = false;
  }

  async connect() {
    this.socket = createConnection({
      host: this.pageWsUrl.hostname,
      port: Number(this.pageWsUrl.port || 80),
    });
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("error", (error) => this.rejectPending(error));
    this.socket.on("close", () => {
      this.socketClosed = true;
      this.rejectPending(new Error("Chrome DevTools connection closed."));
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
  }

  async close() {
    try {
      this.socket?.destroy();
    } catch {}

    await closeChildProcess(this.browser);
  }

  async navigate(url) {
    const loadEvent = withTimeout(
      this.waitForEvent("Page.loadEventFired"),
      CDP_WAIT_TIMEOUT_MS,
      `Timed out waiting for Chrome load event after navigating to ${url}.`,
    );
    await this.send("Page.navigate", { url });
    await loadEvent;
  }

  async setViewport({ deviceScaleFactor = 1, height, width }) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor,
      height,
      mobile: width < 600,
      width,
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });

    if (response?.result?.exceptionDetails) {
      throw new Error(
        `Runtime.evaluate failed: ${JSON.stringify(response.result.exceptionDetails)}`,
      );
    }

    return response?.result?.result?.value;
  }

  async waitForAppReady() {
    let lastState = null;

    await waitFor(
      async () => {
        try {
          lastState = await this.evaluate(`(() => {
            const probe = document.querySelector("#ml-browser-probe");
            const canvas = document.querySelector("canvas");
            const rail = document.querySelector(".ml-rail-shell");
            const bodyText = document.body?.innerText ?? "";
            return {
              bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 700),
              hasCanvas: Boolean(canvas),
              hasFrameworkOverlay: /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(document.body?.textContent ?? ""),
              hasProbe: Boolean(probe),
              hasRail: Boolean(rail),
              hasRowanText: bodyText.includes("Rowan"),
              ready: Boolean(probe && canvas && rail && bodyText.includes("Rowan")),
              title: document.title,
              url: location.href
            };
          })()`);
          return Boolean(lastState?.ready);
        } catch (error) {
          lastState = { error: error instanceof Error ? error.message : String(error) };
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `Timed out waiting for live canvas, rail, and browser probe. Last state: ${JSON.stringify(lastState)}`,
    );
  }

  async waitForWatchModeUi() {
    let lastState = null;

    await waitFor(
      async () => {
        try {
          lastState = await this.evaluate(`(() => {
            const bodyText = document.body?.innerText ?? "";
            const root = document.querySelector(".ml-root");
            return {
              bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 900),
              hasRowanText: bodyText.includes("Rowan"),
              hasWatchAction:
                bodyText.includes("Continue watching") ||
                bodyText.includes("Watch Rowan begin"),
              rootClass: root?.className ?? "",
              url: location.href
            };
          })()`);

          return Boolean(
            lastState?.hasRowanText &&
              lastState.hasWatchAction &&
              lastState.rootClass.includes("is-watch-mode"),
          );
        } catch (error) {
          lastState = { error: error instanceof Error ? error.message : String(error) };
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `Timed out waiting for live watch-mode UI. Last state: ${JSON.stringify(lastState)}`,
    );
  }

  async waitForStoredGameChoice() {
    let lastState = null;

    await waitFor(
      async () => {
        try {
          lastState = await this.inspectPage();
          return Boolean(
            lastState.bodyText.includes("Continue Rowan's run?") &&
              lastState.hasResumeButton &&
              lastState.hasStartNewButton,
          );
        } catch (error) {
          lastState = { error: error instanceof Error ? error.message : String(error) };
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `Timed out waiting for stored-run prompt. Last state: ${JSON.stringify(lastState)}`,
    );

    return lastState;
  }

  async inspectPage() {
    return this.evaluate(`(() => {
      const canvas = document.querySelector("canvas");
      const rail = document.querySelector(".ml-rail-shell");
      const root = document.querySelector(".ml-root");
      const bodyText = document.body?.innerText ?? "";
      const canvasRect = canvas?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      const rawBackendError =
        /\\{"message":|"message"\\s*:\\s*"Game\\s+game-|Game\\s+game-[A-Za-z0-9-]+\\s+was not found/i.test(bodyText);
      return {
        bodyText: bodyText.slice(0, 5000),
        canvas: canvasRect ? {
          height: Math.round(canvasRect.height),
          width: Math.round(canvasRect.width),
          x: Math.round(canvasRect.x),
          y: Math.round(canvasRect.y)
        } : null,
        hasFrameworkOverlay:
          /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(bodyText),
        hasRawBackendError: rawBackendError,
        hasResumeButton: Boolean(document.querySelector("[data-resume-stored-game]")),
        hasStartNewButton: Boolean(document.querySelector("[data-start-new-game]")),
        rail: railRect ? {
          height: Math.round(railRect.height),
          width: Math.round(railRect.width),
          x: Math.round(railRect.x),
          y: Math.round(railRect.y)
        } : null,
        rootClass: root?.className ?? "",
        title: document.title,
        url: location.href
      };
    })()`);
  }

  async readBrowserProbe() {
    return this.evaluate(`(() => {
      if (typeof window.__manyLivesStreetProbe === "function") {
        return window.__manyLivesStreetProbe();
      }
      const probe = document.querySelector("#ml-browser-probe");
      if (!probe?.textContent) {
        return null;
      }
      return JSON.parse(probe.textContent);
    })()`);
  }

  async clickSelector(selector) {
    const selectorJson = JSON.stringify(selector);
    await this.evaluate(`(() => {
      const element = document.querySelector(${selectorJson});
      if (!(element instanceof HTMLElement)) {
        throw new Error("Missing clickable selector: " + ${selectorJson});
      }
      element.click();
      return true;
    })()`);
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
    if (this.socketClosed || !this.socket || this.socket.destroyed || !this.socket.writable) {
      throw new Error(`Cannot send ${method}; Chrome DevTools connection is closed.`);
    }

    this.messageId += 1;
    const id = this.messageId;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
    this.writeFrame(payload);

    return withTimeout(
      promise,
      CDP_COMMAND_TIMEOUT_MS,
      `Timed out waiting for Chrome DevTools response to ${method}.`,
    ).catch((error) => {
      this.pending.delete(id);
      throw error;
    });
  }

  rejectPending(error) {
    for (const deferred of this.pending.values()) {
      deferred.reject(error);
    }
    this.pending.clear();
  }

  writeHandshake() {
    const websocketKey = randomBytes(16).toString("base64");
    this.socket.write(
      [
        `GET ${this.pageWsUrl.pathname}${this.pageWsUrl.search} HTTP/1.1`,
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

      if (frame.opcode === 0x8 || frame.opcode !== 0x1) {
        continue;
      }

      const message = JSON.parse(frame.payload.toString("utf8"));
      this.capturePageIssue(message);

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

  capturePageIssue(message) {
    if (message.method === "Runtime.exceptionThrown") {
      this.pageIssues.push({
        method: message.method,
        text:
          message.params?.exceptionDetails?.exception?.description ??
          message.params?.exceptionDetails?.text ??
          "Runtime exception",
      });
      return;
    }

    if (
      message.method === "Runtime.consoleAPICalled" &&
      ["assert", "error", "warning"].includes(message.params?.type)
    ) {
      this.pageIssues.push({
        method: message.method,
        text:
          message.params?.args
            ?.map((arg) => arg.value ?? arg.description ?? arg.type ?? "")
            .join(" ")
            .trim() || `console.${message.params.type}`,
      });
      return;
    }

    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      this.pageIssues.push({
        method: message.method,
        text: message.params.entry.text ?? "Browser log error",
      });
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

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }

  return response.json();
}

async function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a Chrome DevTools port."));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function closeChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  signalChildProcess(child, "SIGTERM");
  await Promise.race([once(child, "close").catch(() => undefined), sleep(1_500)]);

  if (child.exitCode === null) {
    const closed = once(child, "close").catch(() => undefined);
    signalChildProcess(child, "SIGKILL");
    await Promise.race([closed, sleep(1_500)]);
  }
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

async function waitFor(condition, timeoutMs, errorMessage) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await condition();
    if (result) {
      return result;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(errorMessage);
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function parseWindowSize(value) {
  const [rawWidth, rawHeight] = value.split(",");
  const width = Number(rawWidth);
  const height = Number(rawHeight);

  return {
    height: Number.isFinite(height) ? height : 768,
    width: Number.isFinite(width) ? width : 1365,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

await main();
