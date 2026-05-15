import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

const DEFAULT_WEB_BASE =
  process.env.MANY_LIVES_WEB_BASE_URL ?? "http://127.0.0.1:3001";
const OUTPUT_DIR =
  process.env.MANY_LIVES_VISUAL_CHECK_DIR ??
  path.join(tmpdir(), `manylives-visual-check-${Date.now()}`);
const WEB_START_TIMEOUT_MS = 25_000;
const CDP_WAIT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 250;
const ROOT = process.cwd();
const STREET_APP_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx",
);
const RUNTIME_CAMERA_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/lib/street/runtimeCamera.ts",
);

let activeWebBase = DEFAULT_WEB_BASE;

const VIEWPORTS = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function waitFor(condition, timeoutMs, message) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await condition();
    if (result) {
      return result;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(message);
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function readWebHealth(baseUrl) {
  const [webResponse, health] = await Promise.all([
    fetch(baseUrl, { signal: AbortSignal.timeout(8_000) }),
    fetchJson(`${baseUrl}/sim/health`),
  ]);

  assert.equal(webResponse.ok, true, "Web app did not respond.");
  assert.equal(health.status, "ok", "Sim health endpoint is not ok.");
}

function buildFallbackBase(baseUrl, port) {
  const url = new URL(baseUrl);
  url.hostname = "127.0.0.1";
  url.port = String(port);
  return url.toString().replace(/\/$/, "");
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));

  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a local port.");
  }

  return address.port;
}

async function closeChildProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([once(child, "close").catch(() => undefined), sleep(1_500)]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "close").catch(() => undefined);
  }
}

async function startWebServer(baseUrl) {
  const port = Number(new URL(baseUrl).port);
  const child = spawn(
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
      cwd: ROOT,
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
  child.stdout?.on("data", appendLogs);
  child.stderr?.on("data", appendLogs);

  try {
    await waitFor(
      async () => {
        try {
          await readWebHealth(baseUrl);
          return true;
        } catch {
          return false;
        }
      },
      WEB_START_TIMEOUT_MS,
      `Timed out waiting for local web app at ${baseUrl}.\n${logs}`,
    );
  } catch (error) {
    await closeChildProcess(child);
    throw error;
  }

  return child;
}

async function ensureStack() {
  try {
    await readWebHealth(activeWebBase);
    return null;
  } catch {
    const port = await findFreePort();
    activeWebBase = buildFallbackBase(DEFAULT_WEB_BASE, port);
    const webServer = await startWebServer(activeWebBase);
    await readWebHealth(activeWebBase);
    return webServer;
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

  const chromeBin = candidates.find((candidate) => existsSync(candidate));
  if (!chromeBin) {
    throw new Error(
      `Could not find Chrome. Set MANY_LIVES_CHROME_BIN to run visual checks.`,
    );
  }

  return chromeBin;
}

class CdpSession {
  constructor({ browser, pageWsUrl }) {
    this.browser = browser;
    this.pageWsUrl = new URL(pageWsUrl);
    this.messageId = 0;
    this.pending = new Map();
    this.eventListeners = new Map();
    this.buffer = Buffer.alloc(0);
    this.handshakeComplete = false;
    this.pageErrors = [];
  }

  async connect() {
    this.socket = createConnection({
      host: this.pageWsUrl.hostname,
      port: Number(this.pageWsUrl.port),
    });

    this.socket.on("data", (chunk) => this.handleData(chunk));
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
      "Timed out waiting for Chrome DevTools handshake.",
    );

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Log.enable");
    await this.send("Page.setLifecycleEventsEnabled", { enabled: true });
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

  async navigate(url) {
    const loadEvent = this.waitForEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loadEvent;
  }

  async setViewport({ height, width }) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height,
      mobile: width < 600,
      width,
    });
    await this.send("Emulation.setTouchEmulationEnabled", {
      enabled: width < 600,
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
        `Runtime.evaluate failed: ${JSON.stringify(
          response.result.exceptionDetails,
        )}`,
      );
    }

    return response?.result?.result?.value;
  }

  async waitForAppReady() {
    return waitFor(
      async () => {
        try {
          return await this.evaluate(`(() => {
            const probe = document.querySelector("#ml-browser-probe");
            const canvas = document.querySelector("canvas");
            const rail = document.querySelector(".ml-rail-shell");
            return Boolean(probe && canvas && rail && document.body.innerText.includes("Rowan"));
          })()`);
        } catch {
          return false;
        }
      },
      CDP_WAIT_TIMEOUT_MS,
      "Timed out waiting for the game canvas, rail, and browser probe.",
    );
  }

  async inspectPage() {
    return this.evaluate(`(() => {
      const canvas = document.querySelector("canvas");
      const compactPrimaryAction = document.querySelector(".ml-compact-primary-action");
      const dock = document.querySelector(".ml-dock-panel");
      const rail = document.querySelector(".ml-rail-shell");
      const root = document.querySelector(".ml-root");
      const text = document.body.innerText || "";
      const canvasRect = canvas?.getBoundingClientRect();
      const compactPrimaryActionRect =
        compactPrimaryAction?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      return {
        bodyText: text.slice(0, 1200),
        canvas: canvasRect ? {
          height: Math.round(canvasRect.height),
          width: Math.round(canvasRect.width),
          x: Math.round(canvasRect.x),
          y: Math.round(canvasRect.y)
        } : null,
        compactPrimaryAction: compactPrimaryActionRect ? {
          height: Math.round(compactPrimaryActionRect.height),
          text: compactPrimaryAction.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          width: Math.round(compactPrimaryActionRect.width),
          x: Math.round(compactPrimaryActionRect.x),
          y: Math.round(compactPrimaryActionRect.y)
        } : null,
        dock: dockRect ? {
          height: Math.round(dockRect.height),
          width: Math.round(dockRect.width),
          x: Math.round(dockRect.x),
          y: Math.round(dockRect.y)
        } : null,
        hasFrameworkOverlay:
          text.includes("Unhandled Runtime Error") ||
          text.includes("Application error") ||
          text.includes("Next.js") && text.includes("Error"),
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

  async readCameraProbe() {
    return this.evaluate(`(() => {
      const probe = document.querySelector("#ml-browser-camera-probe");
      if (!probe?.textContent) {
        return null;
      }
      return JSON.parse(probe.textContent);
    })()`);
  }

  async readMapAgencyProbe() {
    return this.evaluate(`(() => {
      const probe = document.querySelector("#ml-browser-map-agency-probe");
      if (!probe?.textContent) {
        return null;
      }
      return JSON.parse(probe.textContent);
    })()`);
  }

  async readBrowserProbe() {
    return this.evaluate(`(() => {
      const probe = document.querySelector("#ml-browser-probe");
      if (!probe?.textContent) {
        return null;
      }
      return JSON.parse(probe.textContent);
    })()`);
  }

  async clickSelector(selector) {
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!(element instanceof HTMLElement)) {
        throw new Error("Missing clickable selector: ${selector}");
      }
      element.click();
      return true;
    })()`);
  }

  async dragMouse({ from, steps = 8, to }) {
    await this.send("Input.dispatchMouseEvent", {
      button: "none",
      type: "mouseMoved",
      x: from.x,
      y: from.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      type: "mousePressed",
      x: from.x,
      y: from.y,
    });

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      await this.send("Input.dispatchMouseEvent", {
        button: "left",
        buttons: 1,
        type: "mouseMoved",
        x: Math.round(from.x + (to.x - from.x) * progress),
        y: Math.round(from.y + (to.y - from.y) * progress),
      });
      await sleep(16);
    }

    await this.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      type: "mouseReleased",
      x: to.x,
      y: to.y,
    });
  }

  async dragTouch({ from, steps = 8, to }) {
    await this.send("Input.dispatchTouchEvent", {
      touchPoints: [{ id: 1, x: from.x, y: from.y }],
      type: "touchStart",
    });

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      await this.send("Input.dispatchTouchEvent", {
        touchPoints: [
          {
            id: 1,
            x: Math.round(from.x + (to.x - from.x) * progress),
            y: Math.round(from.y + (to.y - from.y) * progress),
          },
        ],
        type: "touchMove",
      });
      await sleep(16);
    }

    await this.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
  }

  async dragMap(options) {
    if (options.touch) {
      await this.dragTouch(options);
      return;
    }

    await this.dragMouse(options);
  }

  async wheelMap({ at, deltaX = 0, deltaY = 0 }) {
    await this.send("Input.dispatchMouseEvent", {
      button: "none",
      type: "mouseMoved",
      x: at.x,
      y: at.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      deltaX,
      deltaY,
      type: "mouseWheel",
      x: at.x,
      y: at.y,
    });
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
      if (message.id) {
        const deferred = this.pending.get(message.id);
        if (deferred) {
          this.pending.delete(message.id);
          deferred.resolve(message);
        }
        continue;
      }

      if (message.method === "Runtime.exceptionThrown") {
        this.pageErrors.push(message.params?.exceptionDetails?.text ?? "Runtime exception");
      }
      if (
        message.method === "Log.entryAdded" &&
        message.params?.entry?.level === "error"
      ) {
        const entry = message.params.entry;
        this.pageErrors.push(
          [entry.text ?? "Page log error", entry.url].filter(Boolean).join(" "),
        );
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
      if (this.buffer.length < offset + 2) return null;
      payloadLength = this.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (this.buffer.length < offset + 8) return null;
      payloadLength =
        this.buffer.readUInt32BE(offset) * 2 ** 32 +
        this.buffer.readUInt32BE(offset + 4);
      offset += 8;
    }

    const masked = (secondByte & 0x80) !== 0;
    let mask;
    if (masked) {
      if (this.buffer.length < offset + 4) return null;
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

    return { opcode: firstByte & 0x0f, payload };
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

async function launchBrowser(devtoolsPort) {
  const chromeBin = findChromeBin();
  const userDataDir = path.join(OUTPUT_DIR, "chrome-profile");
  const browser = spawn(
    chromeBin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--window-size=1280,720",
      `--remote-debugging-port=${devtoolsPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  let stderr = "";
  browser.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const pageWsUrl = await waitFor(
    async () => {
      try {
        const targets = await fetchJson(`http://127.0.0.1:${devtoolsPort}/json/list`);
        return targets.find((target) => target.type === "page")
          ?.webSocketDebuggerUrl;
      } catch {
        return null;
      }
    },
    CDP_WAIT_TIMEOUT_MS,
    `Timed out waiting for Chrome DevTools on ${devtoolsPort}.\n${stderr}`,
  );

  const session = new CdpSession({ browser, pageWsUrl });
  await session.connect();
  return session;
}

function assertPngScreenshot(buffer, viewport) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", `${viewport.name} screenshot is not a PNG.`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(width, viewport.width, `${viewport.name} screenshot width mismatch.`);
  assert.equal(height, viewport.height, `${viewport.name} screenshot height mismatch.`);
  assert.ok(
    buffer.length > (viewport.name === "mobile" ? 70_000 : 120_000),
    `${viewport.name} screenshot is suspiciously small; the canvas may be blank.`,
  );
}

async function assertAmbientScaleGuard() {
  const source = await readFile(STREET_APP_PATH, "utf8");
  const routesMatch = source.match(/const AMBIENT_CITY_ROUTES:[\s\S]*?];/);
  assert.ok(routesMatch, "Could not find AMBIENT_CITY_ROUTES.");
  const scaleValues = [...routesMatch[0].matchAll(/scale:\s*([0-9.]+)/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(scaleValues.length >= 4, "Expected ambient city routes to declare scales.");
  assert.ok(
    Math.min(...scaleValues) >= 0.84,
    `Ambient pedestrian scale is too small: ${scaleValues.join(", ")}`,
  );
  assert.ok(
    !source.includes("function drawAmbientWorkPulse"),
    "Tiny ambient work pulse markers should not return; use character-scale silhouettes.",
  );
}

async function assertWatchModeFeelGuard() {
  const [streetSource, cameraSource] = await Promise.all([
    readFile(STREET_APP_PATH, "utf8"),
    readFile(RUNTIME_CAMERA_PATH, "utf8"),
  ]);
  const delayBlock = streetSource.match(
    /const AUTONOMY_BEAT_DELAY_MS = \{([\s\S]*?)\} as const;/,
  );
  assert.ok(delayBlock, "Could not find AUTONOMY_BEAT_DELAY_MS.");
  const delayValues = Object.fromEntries(
    [...delayBlock[1].matchAll(/(\w+):\s*([0-9_]+)/g)].map((match) => [
      match[1],
      Number(match[2].replaceAll("_", "")),
    ]),
  );

  assert.ok(
    delayValues.acting >= 24_000 &&
      delayValues.conversation >= 40_000 &&
      delayValues.moving >= 18_000 &&
      delayValues.waiting >= 28_000,
    `Watch-mode autoplay is paced too tightly: ${JSON.stringify(delayValues)}`,
  );
  assert.ok(
    streetSource.includes('"? "Nudge Rowan"') ||
      streetSource.includes('? "Nudge Rowan"') ||
      streetSource.includes('? "Watch Rowan begin"'),
    "Watch-mode primary action should be a soft nudge, not a command.",
  );
  assert.ok(
    !streetSource.includes("return `Talk: ${targetNpc.name}`;"),
    "Conversation target labels should not duplicate NPC name tags.",
  );

  const dragMultiplier = readNumericConst(
    cameraSource,
    "CAMERA_DRAG_PAN_MULTIPLIER",
  );
  const returnDelay = readNumericConst(
    cameraSource,
    "CAMERA_OFFSET_RETURN_DELAY_MS",
  );
  assert.ok(
    dragMultiplier >= 2,
    `Camera drag multiplier is too low for organic panning: ${dragMultiplier}`,
  );
  assert.ok(
    returnDelay >= 8_000,
    `Camera recenters too quickly after panning: ${returnDelay}`,
  );
}

function readNumericConst(source, name) {
  const match = source.match(
    new RegExp(`const ${name} = ([0-9_.]+);`),
  );
  assert.ok(match, `Could not find ${name}.`);
  return Number(match[1].replaceAll("_", ""));
}

async function runViewportCheck(session, viewport) {
  const url = `${activeWebBase}/?new=1&readyCheck=${viewport.name}-${Date.now()}&autoplay=1`;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();
  await sleep(750);

  const page = await session.inspectPage();
  assert.equal(page.title, "Many Lives", `${viewport.name}: wrong page title.`);
  assert.equal(
    new URL(page.url).origin,
    new URL(activeWebBase).origin,
    `${viewport.name}: wrong app origin.`,
  );
  assert.ok(page.canvas, `${viewport.name}: missing game canvas.`);
  assert.ok(page.rail, `${viewport.name}: missing Rowan rail.`);
  assert.ok(
    page.canvas.width >= Math.min(320, viewport.width * 0.45),
    `${viewport.name}: canvas width is too small.`,
  );
  assert.ok(
    page.canvas.height >= Math.min(320, viewport.height * 0.45),
    `${viewport.name}: canvas height is too small.`,
  );
  assert.ok(
    page.bodyText.includes("Rowan") &&
      (page.bodyText.includes("Nudge Rowan") ||
        page.bodyText.includes("Watch Rowan begin")),
    `${viewport.name}: expected Rowan watch-mode UI text was missing.`,
  );
  assert.ok(
    page.rootClass.includes("is-watch-mode"),
    `${viewport.name}: autoplay run did not mark the overlay as watch mode.`,
  );
  if (viewport.width <= 960) {
    assert.ok(
      page.compactPrimaryAction,
      `${viewport.name}: compact collapsed rail is missing its primary action.`,
    );
    assert.ok(
      page.compactPrimaryAction.width >= Math.min(240, viewport.width * 0.56) &&
        page.compactPrimaryAction.height >= 36,
      `${viewport.name}: compact primary action is too small (${page.compactPrimaryAction.width}x${page.compactPrimaryAction.height}).`,
    );
    assert.ok(
      page.compactPrimaryAction.text.includes("Watch Rowan begin") ||
        page.compactPrimaryAction.text.includes("Nudge Rowan"),
      `${viewport.name}: compact primary action text is not the current Rowan action: ${page.compactPrimaryAction.text}`,
    );
  }
  if (viewport.name === "desktop") {
    assert.ok(page.dock, "desktop: missing map controls dock.");
    assert.ok(
      page.dock.height <= 118,
      `desktop: watch-mode controls dock is too tall (${page.dock.height}px) and may cover playfield targets.`,
    );
  }
  assert.equal(
    page.hasFrameworkOverlay,
    false,
    `${viewport.name}: framework error overlay detected.`,
  );

  const screenshotPath = path.join(OUTPUT_DIR, `${viewport.name}.png`);
  await session.captureScreenshot(screenshotPath);
  const screenshot = await readFile(screenshotPath);
  assertPngScreenshot(screenshot, viewport);

  const mapAgency = await session.readMapAgencyProbe();
  assert.ok(mapAgency?.intent, `${viewport.name}: missing in-map agency cue.`);
  assert.ok(
    mapAgency.target?.label || mapAgency.detail,
    `${viewport.name}: in-map agency cue has no target or reason.`,
  );

  const panBefore = await session.readCameraProbe();
  assert.ok(panBefore, `${viewport.name}: missing camera probe.`);
  const railLeft =
    page.rail && page.rail.x > viewport.width * 0.52
      ? page.rail.x
      : viewport.width;
  const dragFromX = Math.round(
    clamp(
      Math.min(viewport.width * 0.62, railLeft - 72),
      84,
      viewport.width - 72,
    ),
  );
  const dragToX = Math.round(
    Math.max(42, dragFromX - Math.min(360, viewport.width * 0.42)),
  );
  const dragY = Math.round(
    Math.min(viewport.height - 190, Math.max(170, viewport.height * 0.44)),
  );
  await session.dragMap({
    from: { x: dragFromX, y: dragY },
    touch: viewport.width < 600,
    to: { x: dragToX, y: dragY },
  });
  await sleep(350);
  const panAfter = await session.readCameraProbe();
  assert.ok(panAfter, `${viewport.name}: missing camera probe after eastward drag.`);
  const offsetDelta =
    Math.abs(panAfter.cameraOffset.x - panBefore.cameraOffset.x) +
    Math.abs(panAfter.cameraOffset.y - panBefore.cameraOffset.y);
  const scrollDelta =
    Math.abs(panAfter.scroll.x - panBefore.scroll.x) +
    Math.abs(panAfter.scroll.y - panBefore.scroll.y);
  assert.ok(
    offsetDelta > 80 || scrollDelta > 32,
    `${viewport.name}: map drag did not move the camera enough. Offset delta ${offsetDelta.toFixed(
      1,
    )}, scroll delta ${scrollDelta.toFixed(1)}.`,
  );
  assert.equal(
    panAfter.dragging,
    false,
    `${viewport.name}: camera still reports dragging after mouse/touch release.`,
  );
  const panScreenshotPath = path.join(
    OUTPUT_DIR,
    `${viewport.name}-after-pan.png`,
  );
  await session.captureScreenshot(panScreenshotPath);
  const panScreenshot = await readFile(panScreenshotPath);
  assertPngScreenshot(panScreenshot, viewport);

  let compactWheelPan = null;
  if (viewport.width <= 960) {
    await session.wheelMap({
      at: { x: dragFromX, y: dragY },
      deltaX: -260,
    });
    await sleep(300);
    compactWheelPan = await session.readCameraProbe();
    assert.ok(
      compactWheelPan,
      `${viewport.name}: missing camera probe after compact wheel pan.`,
    );
    const wheelOffsetDelta =
      compactWheelPan.cameraOffset.x - panAfter.cameraOffset.x;
    const wheelScrollDelta = panAfter.scroll.x - compactWheelPan.scroll.x;
    assert.ok(
      wheelOffsetDelta > 40 || wheelScrollDelta > 24,
      `${viewport.name}: scroll/trackpad pan did not move back toward the left edge. Offset delta ${wheelOffsetDelta.toFixed(
        1,
      )}, scroll delta ${wheelScrollDelta.toFixed(1)}.`,
    );
  }

  await session.dragMap({
    from: { x: dragToX, y: dragY },
    touch: viewport.width < 600,
    to: { x: dragFromX, y: dragY },
  });
  await sleep(350);
  const panAfterReverse = await session.readCameraProbe();
  assert.ok(
    panAfterReverse,
    `${viewport.name}: missing camera probe after westward drag.`,
  );
  const reverseOffsetDelta =
    panAfterReverse.cameraOffset.x - panAfter.cameraOffset.x;
  const reverseScrollDelta = panAfter.scroll.x - panAfterReverse.scroll.x;
  assert.ok(
    reverseOffsetDelta > 80 || reverseScrollDelta > 32,
    `${viewport.name}: map drag back toward the left edge did not move the camera enough. Offset delta ${reverseOffsetDelta.toFixed(
      1,
    )}, scroll delta ${reverseScrollDelta.toFixed(1)}.`,
  );
  assert.equal(
    panAfterReverse.dragging,
    false,
    `${viewport.name}: camera still reports dragging after reverse drag release.`,
  );

  let panAtWestEdge = panAfterReverse;
  if (viewport.width <= 960) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await session.dragMap({
        from: { x: dragToX, y: dragY },
        touch: viewport.width < 600,
        to: { x: dragFromX, y: dragY },
      });
      await sleep(220);
    }
    panAtWestEdge = await session.readCameraProbe();
    assert.ok(
      panAtWestEdge,
      `${viewport.name}: missing camera probe at west edge.`,
    );
    assert.ok(
      panAtWestEdge.scroll.x <= 48,
      `${viewport.name}: left map edge is still clamped too far inward (scroll x ${panAtWestEdge.scroll.x.toFixed(
        1,
      )}).`,
    );
  }

  const westPanScreenshotPath = path.join(
    OUTPUT_DIR,
    `${viewport.name}-after-pan-west.png`,
  );
  await session.captureScreenshot(westPanScreenshotPath);
  const westPanScreenshot = await readFile(westPanScreenshotPath);
  assertPngScreenshot(westPanScreenshot, viewport);

  return {
    mapAgency,
    page,
    pan: {
      after: panAfter,
      before: panBefore,
      drag: {
        from: { x: dragFromX, y: dragY },
        to: { x: dragToX, y: dragY },
      },
      offsetDelta: Number(offsetDelta.toFixed(2)),
      reverseOffsetDelta: Number(reverseOffsetDelta.toFixed(2)),
      reverseScrollDelta: Number(reverseScrollDelta.toFixed(2)),
      scrollDelta: Number(scrollDelta.toFixed(2)),
      wheel: compactWheelPan,
      westEdge: panAtWestEdge,
    },
    panScreenshotPath,
    screenshotPath,
    westPanScreenshotPath,
  };
}

async function waitForStoredGameChoice(session) {
  return waitFor(
    async () => {
      try {
        return await session.evaluate(`(() => {
          return Boolean(
            document.body.innerText.includes("Continue Rowan's run?") &&
              document.querySelector("[data-resume-stored-game]") &&
              document.querySelector("[data-start-new-game]")
          );
        })()`);
      } catch {
        return false;
      }
    },
    CDP_WAIT_TIMEOUT_MS,
    "Timed out waiting for the stored-game resume choice.",
  );
}

async function inspectStoredGameChoice(session) {
  return session.evaluate(`(() => {
    const text = document.body.innerText || "";
    return {
      bodyText: text.slice(0, 800),
      hasCompleteState: text.includes("COMPLETE") || text.includes("First afternoon complete"),
      hasResumeButton: Boolean(document.querySelector("[data-resume-stored-game]")),
      hasStartNewButton: Boolean(document.querySelector("[data-start-new-game]")),
      localStorageGameId: window.localStorage.getItem("many-lives:street-game-id"),
      url: location.href
    };
  })()`);
}

async function runStoredGameChoiceCheck(session) {
  await session.setViewport(VIEWPORTS[0]);
  const seededGameId = await session.evaluate(
    `window.localStorage.getItem("many-lives:street-game-id")`,
  );
  assert.ok(seededGameId, "Visual check did not seed a stored street game id.");

  await session.navigate(`${activeWebBase}/?autoplay=1&storagePrompt=${Date.now()}`);
  await waitForStoredGameChoice(session);
  const prompt = await inspectStoredGameChoice(session);
  assert.equal(
    prompt.hasCompleteState,
    false,
    "Stored-game prompt should not silently show the previous completed run.",
  );
  assert.equal(prompt.hasResumeButton, true, "Stored-game prompt is missing Resume.");
  assert.equal(prompt.hasStartNewButton, true, "Stored-game prompt is missing Start New.");
  assert.equal(
    new URL(prompt.url).searchParams.has("gameId"),
    false,
    "Stored-game prompt should not bind a game id before the user chooses.",
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

  await session.navigate(`${activeWebBase}/?autoplay=1&storagePrompt=${Date.now()}`);
  await waitForStoredGameChoice(session);
  await session.clickSelector("[data-start-new-game]");
  await session.waitForAppReady();
  await sleep(500);
  const freshProbe = await session.readBrowserProbe();
  assert.ok(freshProbe?.gameId, "Start new run did not create a game id.");
  assert.notEqual(
    freshProbe.gameId,
    seededGameId,
    "Start new run reused the stored game id.",
  );

  return {
    freshGameId: freshProbe.gameId,
    prompt,
    resumedGameId: resumedProbe.gameId,
    seededGameId,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await assertAmbientScaleGuard();
  await assertWatchModeFeelGuard();
  const webServer = await ensureStack();
  const devtoolsPort = await findFreePort();
  const session = await launchBrowser(devtoolsPort);
  const results = [];
  let storedGameChoice = null;
  const summaryPath = path.join(OUTPUT_DIR, "summary.json");

  try {
    for (const viewport of VIEWPORTS) {
      results.push({
        viewport,
        ...(await runViewportCheck(session, viewport)),
      });
    }
    storedGameChoice = await runStoredGameChoiceCheck(session);

    assert.deepEqual(
      session.pageErrors,
      [],
      `Page logged runtime errors:\n${session.pageErrors.join("\n")}`,
    );

    await writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          outputDir: OUTPUT_DIR,
          results,
          storedGameChoice,
          webBase: activeWebBase,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    process.stdout.write(
      [
        "[many-lives] Visual game smoke passed.",
        `[many-lives] Web base: ${activeWebBase}`,
        `[many-lives] Output: ${OUTPUT_DIR}`,
        `[many-lives] Desktop: ${path.join(OUTPUT_DIR, "desktop.png")}`,
        `[many-lives] Desktop after pan: ${path.join(OUTPUT_DIR, "desktop-after-pan.png")}`,
        `[many-lives] Desktop after west pan: ${path.join(OUTPUT_DIR, "desktop-after-pan-west.png")}`,
        `[many-lives] Mobile: ${path.join(OUTPUT_DIR, "mobile.png")}`,
        `[many-lives] Mobile after pan: ${path.join(OUTPUT_DIR, "mobile-after-pan.png")}`,
        `[many-lives] Mobile after west pan: ${path.join(OUTPUT_DIR, "mobile-after-pan-west.png")}`,
        `[many-lives] Summary: ${summaryPath}`,
        "",
      ].join("\n"),
    );
  } finally {
    await session.close();
    await closeChildProcess(webServer);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Visual game smoke failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
