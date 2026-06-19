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
const WEB_START_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_WEB_START_TIMEOUT_MS ?? "90000",
);
const CDP_WAIT_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_CDP_WAIT_TIMEOUT_MS ?? "60000",
);
const APP_READY_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_APP_READY_TIMEOUT_MS ?? "120000",
);
const AUTOPLAY_START_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_AUTOPLAY_START_TIMEOUT_MS ?? "20000",
);
const CDP_COMMAND_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 250;
const ROOT = process.cwd();
const STREET_APP_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx",
);
const STREET_VISUAL_SCENE_RENDERER_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/components/street/streetVisualSceneRenderer.ts",
);
const RUNTIME_CAMERA_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/lib/street/runtimeCamera.ts",
);
const RUNTIME_GEOMETRY_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/lib/street/runtimeGeometry.ts",
);
const RUNTIME_VIEWPORT_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/lib/street/runtimeViewport.ts",
);
const VISUAL_SMOKE_PATH = path.join(ROOT, "scripts/visual-game-smoke.mjs");
const HIGH_DPR_NORTH_VISIBLE_WORLD_TOP_MAX = -660;
const GENERIC_AUTOPLAY_NOTE = "Rowan is carrying this beat forward";
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
const CONTEXTUAL_WATCH_MODE_COPY_PATTERN =
  /Rowan is (?:about to|stepping|turning|heading|keeping|letting|taking|choosing|starting|weighing|continuing|carrying the conversation)/i;

let activeWebBase = DEFAULT_WEB_BASE;

const VIEWPORTS = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 900, name: "compact-boundary", width: 960 },
  { height: 1024, name: "tablet-portrait", width: 768 },
  { height: 998, name: "codex-compact", width: 662 },
  {
    deviceScaleFactor: 2,
    height: 998,
    name: "codex-retina-compact",
    width: 662,
  },
  {
    deviceScaleFactor: 2,
    height: 1006,
    name: "codex-retina-reported",
    width: 673,
  },
  { height: 1041, name: "codex-screenshot-tall", width: 669 },
  {
    deviceScaleFactor: 2,
    height: 1041,
    name: "codex-retina-tall",
    width: 669,
  },
  { height: 900, name: "phone-boundary", width: 560 },
  { height: 844, name: "mobile", width: 390 },
];
const INTERIOR_CAMERA_VIEWPORT = {
  deviceScaleFactor: 2,
  height: 998,
  minimumUsefulBytesRatio: 0.04,
  name: "interior-camera",
  width: 810,
};
const INTERIOR_CAMERA_MIN_PAN_DELTA = 20;

function hasWatchModeProgressText(bodyText) {
  return (
    bodyText.includes("Continue watching") ||
    bodyText.includes("Watch Rowan begin") ||
    CONTEXTUAL_WATCH_MODE_COPY_PATTERN.test(bodyText)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function requiresComputedCompactEdge(viewport) {
  return (viewport.deviceScaleFactor ?? 1) > 1;
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
    this.socketClosed = false;
    this.pageErrors = [];
  }

  async connect() {
    this.socket = createConnection({
      host: this.pageWsUrl.hostname,
      port: Number(this.pageWsUrl.port),
    });

    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("error", (error) => {
      this.rejectPending(error);
    });
    this.socket.on("end", () => this.handleSocketClosed("ended"));
    this.socket.on("close", () => this.handleSocketClosed("closed"));

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
    this.rejectPending(
      new Error("Chrome DevTools session closed before the command completed."),
    );
    this.eventListeners.clear();

    try {
      this.socket?.end();
      this.socket?.destroy();
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
    const startedAt = Date.now();
    let lastState = null;

    while (Date.now() - startedAt < APP_READY_TIMEOUT_MS) {
      try {
        lastState = await this.evaluate(`(() => {
          const probe = document.querySelector("#ml-browser-probe");
          const canvas = document.querySelector("canvas");
          const rail = document.querySelector(".ml-rail-shell");
          const bodyText = document.body?.innerText ?? "";
          return {
            bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 500),
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

        if (lastState?.ready) {
          return true;
        }
      } catch (error) {
        lastState = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Timed out waiting for the game canvas, rail, and browser probe. Last state: ${JSON.stringify(
        lastState,
      )}`,
    );
  }

  async waitForWatchModeUi(viewport) {
    let lastState = null;

    await waitFor(
      async () => {
        try {
          lastState = await this.evaluate(`(() => {
            const bodyText = document.body?.innerText ?? "";
            const root = document.querySelector(".ml-root");
            const compactPrimaryAction = document.querySelector(".ml-compact-primary-action");
            return {
              bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 900),
              compactPrimaryActionText: compactPrimaryAction?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
              hasRowanText: bodyText.includes("Rowan"),
              hasWatchAction:
                bodyText.includes("Continue watching") ||
                bodyText.includes("Watch Rowan begin") ||
                /Rowan is (?:about to|stepping|turning|heading|keeping|letting|taking|choosing|carrying the conversation)/i.test(bodyText),
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
          lastState = {
            error: error instanceof Error ? error.message : String(error),
          };
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `${viewport.name}: timed out waiting for Rowan watch-mode UI. Last state: ${JSON.stringify(
        lastState,
      )}`,
    );
  }

  async inspectPage() {
    return this.evaluate(`(() => {
      const canvas = document.querySelector("canvas");
      const compactPrimaryAction = document.querySelector(".ml-compact-primary-action");
      const dock = document.querySelector(".ml-dock-panel");
      const rail = document.querySelector(".ml-rail-shell");
      const rightStack = document.querySelector(".ml-right-stack");
      const root = document.querySelector(".ml-root");
      const timePill = document.querySelector(".ml-time-pill");
      const whyNow = document.querySelector(".ml-rowan-story-card-reason");
      const decisionArtifact = document.querySelector("[data-visible-decision-artifact='true']");
      const text = document.body.innerText || "";
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
        if (!root?.classList.contains("is-watch-mode")) {
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
            text: element.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          }));
      })();
      const canvasRect = canvas?.getBoundingClientRect();
      const compactPrimaryActionRect =
        compactPrimaryAction?.getBoundingClientRect();
      const dockRect = dock?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      const rightStackRect = rightStack?.getBoundingClientRect();
      const timePillRect = timePill?.getBoundingClientRect();
      const whyNowRect = whyNow?.getBoundingClientRect();
      const decisionArtifactRect = decisionArtifact?.getBoundingClientRect();
      const whyNowVisible = Boolean(
        whyNowRect &&
          railRect &&
          whyNowRect.top >= railRect.top &&
          whyNowRect.bottom <= railRect.bottom &&
          whyNowRect.bottom <= window.innerHeight
      );
      const decisionArtifactVisible = (() => {
        if (!decisionArtifactRect || !railRect) {
          return false;
        }

        const visibleBottom = Math.min(
          decisionArtifactRect.bottom,
          railRect.bottom,
          window.innerHeight
        );
        const visibleTop = Math.max(decisionArtifactRect.top, railRect.top, 0);
        const visibleHeight = visibleBottom - visibleTop;
        const minimumReadableHeight = Math.min(
          decisionArtifactRect.height,
          railRect.height,
          140
        );
        return (
          decisionArtifactRect.width > 0 &&
          decisionArtifactRect.height > 0 &&
          visibleHeight >= minimumReadableHeight - 1
        );
      })();
      return {
        bodyText: text.slice(0, 4000),
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
        decisionArtifact: decisionArtifactRect ? {
          height: Math.round(decisionArtifactRect.height),
          source: decisionArtifact.getAttribute("data-decision-source"),
          text: decisionArtifact.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          visible: decisionArtifactVisible,
          width: Math.round(decisionArtifactRect.width),
          x: Math.round(decisionArtifactRect.x),
          y: Math.round(decisionArtifactRect.y)
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
        railState: rightStack?.getAttribute("data-rail-state") ?? null,
        rightStack: rightStackRect ? {
          height: Math.round(rightStackRect.height),
          width: Math.round(rightStackRect.width),
          x: Math.round(rightStackRect.x),
          y: Math.round(rightStackRect.y)
        } : null,
        rootClass: root?.className ?? "",
        timePill: timePillRect ? {
          bottom: Math.round(timePillRect.bottom),
          height: Math.round(timePillRect.height),
          width: Math.round(timePillRect.width),
          x: Math.round(timePillRect.x),
          y: Math.round(timePillRect.y)
        } : null,
        title: document.title,
        url: location.href,
        watchModeReplyAffordances,
        visibleProgressionControls,
        whyNowVisible
      };
    })()`);
  }

  async readCameraProbe() {
    return waitFor(
      async () => {
        const cameraProbe = await this.evaluate(`(() => {
          const probe = document.querySelector("#ml-browser-camera-probe");
          if (!probe?.textContent) {
            return null;
          }
          const parsed = JSON.parse(probe.textContent);
          return Number.isFinite(parsed?.scroll?.x) &&
            Number.isFinite(parsed?.scroll?.y)
            ? parsed
            : null;
        })()`);
        return cameraProbe || false;
      },
      CDP_WAIT_TIMEOUT_MS,
      "Timed out waiting for a populated camera probe.",
    );
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

  async waitForMapAgencyProbe(viewport) {
    return waitFor(
      async () => {
        try {
          const probe = await this.readMapAgencyProbe();
          return probe?.intent ? probe : false;
        } catch {
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `${viewport.name}: timed out waiting for a populated in-map agency probe.`,
    );
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
    const missingMessage = JSON.stringify(`Missing clickable selector: ${selector}`);
    await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!(element instanceof HTMLElement)) {
        throw new Error(${missingMessage});
      }
      element.click();
      return true;
    })()`);
  }

  async closeFocusPanelIfOpen() {
    const closed = await this.evaluate(`(() => {
      const closeButton = document.querySelector("[data-close-focus='true']");
      if (!(closeButton instanceof HTMLElement)) {
        return false;
      }

      closeButton.click();
      return true;
    })()`);
    if (closed) {
      await sleep(80);
    }
    return Boolean(closed);
  }

  async dragMouse({ from, steps = 5, to }) {
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

  async dragTouch({ from, steps = 5, to }) {
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

  async panCameraToEdge(edge) {
    return this.evaluate(`(() => {
      const panCameraToEdge = window.__manyLivesPanCameraToEdge;
      if (typeof panCameraToEdge !== "function") {
        throw new Error("Missing __manyLivesPanCameraToEdge browser hook.");
      }
      return panCameraToEdge(${JSON.stringify(edge)});
    })()`);
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
    if (this.socketClosed || !this.socket || this.socket.destroyed || !this.socket.writable) {
      throw new Error(
        `Cannot send ${method}; Chrome DevTools connection is already closed.`,
      );
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

  handleSocketClosed(verb) {
    this.socketClosed = true;
    this.rejectPending(
      new Error(`Chrome DevTools connection ${verb} before the visual check finished.`),
    );
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
  const deviceScaleFactor = viewport.deviceScaleFactor ?? 1;
  const expectedWidth = Math.round(viewport.width * deviceScaleFactor);
  const expectedHeight = Math.round(viewport.height * deviceScaleFactor);
  const minimumUsefulBytesRatio = viewport.minimumUsefulBytesRatio ?? 0.08;
  assert.equal(width, expectedWidth, `${viewport.name} screenshot width mismatch.`);
  assert.equal(height, expectedHeight, `${viewport.name} screenshot height mismatch.`);
  const minimumUsefulBytes = Math.max(
    40_000,
    expectedWidth * expectedHeight * minimumUsefulBytesRatio,
  );
  assert.ok(
    buffer.length > minimumUsefulBytes,
    `${viewport.name} screenshot is suspiciously small (${buffer.length} bytes); the canvas may be blank.`,
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
  const teaHouseRouteMatch = routesMatch[0].match(
    /id:\s*"tea-house-front"[\s\S]*?path:\s*\[([\s\S]*?)\]\s*,\s*phase:/,
  );
  assert.ok(teaHouseRouteMatch, "Could not find the tea-house-front ambient route.");
  const teaHousePoints = [
    ...teaHouseRouteMatch[1].matchAll(/\{\s*x:\s*([0-9.]+),\s*y:\s*([0-9.]+)\s*\}/g),
  ].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
  assert.ok(
    teaHousePoints.length >= 4,
    `Expected the tea-house-front route to have a real frontage loop: ${JSON.stringify(teaHousePoints)}.`,
  );
  assert.ok(
    teaHousePoints.every((point) => point.x >= 1100 && point.x <= 1560),
    `tea-house-front ambient route drifted away from Kettle & Lamp: ${JSON.stringify(teaHousePoints)}.`,
  );
  assert.ok(
    teaHousePoints.every((point) => point.y >= 560 && point.y <= 720),
    `tea-house-front ambient route is no longer on the cafe frontage band: ${JSON.stringify(teaHousePoints)}.`,
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

  const openingDelay = readNumericConst(
    streetSource,
    "AUTOPLAY_OPENING_AUTOSTART_DELAY_MS",
  );
  const completionDelay = readNumericConst(
    streetSource,
    "FIRST_AFTERNOON_COMPLETION_DWELL_MS",
  );
  const readableDelayRanges = {
    acting: [2_600, 3_400],
    conversation: [2_800, 3_800],
    moving: [2_600, 3_400],
    opening: [600, 1_400],
    waiting: [2_600, 3_600],
  };
  for (const [key, [min, max]] of Object.entries(readableDelayRanges)) {
    const value = key === "opening" ? openingDelay : delayValues[key];
    assert.ok(
      value >= min && value <= max,
      `Watch-mode ${key} dwell should be readable but bounded (${min}-${max}ms): ${value}ms.`,
    );
  }
  assert.ok(
    completionDelay >= 3_400 && completionDelay <= 4_500,
    `First-afternoon completion dwell should remain readable but bounded: ${completionDelay}ms.`,
  );
  assert.ok(
    !streetSource.includes("Nudge Rowan"),
    "Watch-mode primary action must not depend on Nudge Rowan copy.",
  );
  assert.ok(
    !streetSource.includes("click the street to move"),
    "Street runtime must not invite users to click the street to move Rowan.",
  );
  assert.ok(
    !streetSource.includes("moveStreetPlayer") &&
      !streetSource.includes("onMoveTo") &&
      !streetSource.includes("onMoveBy") &&
      !streetSource.includes("finishRuntimePointerTap"),
    "Active street runtime must not expose direct Rowan movement controls.",
  );
  assert.ok(
    streetSource.includes("? \"Continue watching\"") ||
      streetSource.includes("? \"Watch Rowan begin\""),
    "Watch-mode primary action should expose optional watch language.",
  );
  assert.ok(
    streetSource.includes("buildWatchModeAdvanceKey") &&
      streetSource.includes("AUTOPLAY_OPENING_AUTOSTART_DELAY_MS"),
    "Fresh watch mode must auto-start the opening Rowan beat instead of requiring the Watch Rowan begin button.",
  );
  assert.ok(
    !streetSource.includes("return `Talk: ${targetNpc.name}`;"),
    "Conversation target labels should not duplicate NPC name tags.",
  );

  const dragMultiplier = readNumericConst(
    cameraSource,
    "CAMERA_DRAG_PAN_MULTIPLIER",
  );
  const compactVerticalDragMultiplier = readNumericConst(
    cameraSource,
    "CAMERA_DRAG_PAN_COMPACT_VERTICAL_MULTIPLIER",
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
    compactVerticalDragMultiplier >= 2.5,
    `Compact portrait vertical drag multiplier is too low to reliably reach the north/south edges on phone viewports: ${compactVerticalDragMultiplier}`,
  );
  assert.ok(
    returnDelay >= 8_000,
    `Camera recenters too quickly after panning: ${returnDelay}`,
  );
}

async function assertCameraPanContractGuard() {
  const [
    streetSource,
    visualSceneRendererSource,
    cameraSource,
    geometrySource,
    viewportSource,
    smokeSource,
  ] = await Promise.all([
      readFile(STREET_APP_PATH, "utf8"),
      readFile(STREET_VISUAL_SCENE_RENDERER_PATH, "utf8"),
      readFile(RUNTIME_CAMERA_PATH, "utf8"),
      readFile(RUNTIME_GEOMETRY_PATH, "utf8"),
      readFile(RUNTIME_VIEWPORT_PATH, "utf8"),
      readFile(VISUAL_SMOKE_PATH, "utf8"),
    ]);

  assert.ok(
    geometrySource.includes("function getCompactCameraScrollRange"),
    "Compact camera panning must use one X/Y scroll range helper.",
  );
  assert.ok(
    geometrySource.includes("COMPACT_CAMERA_VERTICAL_OVERSCAN_MAX"),
    "Compact camera panning must keep explicit vertical overscan.",
  );
  assert.ok(
    geometrySource.includes("function getCompactCameraNorthOverscan"),
    "Compact camera panning must keep extra north clearance for the top HUD.",
  );
  assert.ok(
    viewportSource.includes("function getCompactSceneTopSafeHeight"),
    "Compact camera viewport must reserve a top safe band below the HUD.",
  );
  assert.ok(
    cameraSource.includes("getCompactCameraScrollRange"),
    "Runtime camera update must clamp through the shared X/Y compact scroll range.",
  );
  assert.ok(
    cameraSource.includes("COMPACT_CAMERA_OFFSET_VERTICAL_WORLD_RATIO"),
    "Runtime camera offset must keep a compact vertical budget large enough to clear the north edge.",
  );
  const compactWatchAnchorY = readNumericConst(
    cameraSource,
    "COMPACT_CAMERA_ANCHOR_Y_WATCH_RATIO",
  );
  const compactInteractiveAnchorY = readNumericConst(
    cameraSource,
    "COMPACT_CAMERA_ANCHOR_Y_INTERACTIVE_RATIO",
  );
  assert.ok(
    compactWatchAnchorY >= 0.46,
    `Compact watch camera anchor is too high to read north under the HUD: ${compactWatchAnchorY}.`,
  );
  assert.ok(
    compactInteractiveAnchorY >= 0.48,
    `Compact interactive camera anchor is too high to read north under the HUD: ${compactInteractiveAnchorY}.`,
  );
  assert.ok(
    streetSource.includes("getCompactCameraScrollRange"),
    "Runtime camera reset must clamp through the shared X/Y compact scroll range.",
  );
  assert.ok(
    !cameraSource.includes("targetScrollY = clamp(targetScrollY, 0, maxScrollY)"),
    "Runtime camera update must not hard-clamp compact north panning to scrollY >= 0.",
  );
  assert.ok(
    !streetSource.includes(
      "visibleHeight * getRuntimeCameraAnchorYRatio(runtimeState),\n        0,\n        maxScrollY",
    ),
    "Runtime camera reset must not hard-clamp compact north panning to scrollY >= 0.",
  );
  assert.ok(
    smokeSource.includes('name: "codex-compact"'),
    "Visual smoke must include the Codex-sized compact viewport.",
  );
  assert.ok(
    smokeSource.includes('name: "codex-screenshot-tall"'),
    "Visual smoke must include the tall Codex screenshot viewport.",
  );
  assert.ok(
    smokeSource.includes('name: "codex-retina-reported"'),
    "Visual smoke must include the reported DPR 2 Codex viewport.",
  );
  assert.ok(
    smokeSource.includes('name: "compact-boundary"') &&
      smokeSource.includes('name: "tablet-portrait"') &&
      smokeSource.includes('name: "phone-boundary"'),
    "Visual smoke must include compact, tablet, and phone breakpoint viewports.",
  );
  assert.ok(
    smokeSource.includes("west map overscan") &&
      smokeSource.includes("north map overscan"),
    "Visual smoke must assert west and north compact overscan.",
  );
  assert.ok(
    streetSource.includes("freezeAutoplay") &&
      smokeSource.includes("freezeAutoplay=1"),
    "Visual smoke must freeze autoplay while measuring camera edge traversal.",
  );
  assert.ok(
    streetSource.includes("__manyLivesPanCameraToEdge") &&
      smokeSource.includes("__manyLivesPanCameraToEdge"),
    "Visual smoke must use the runtime camera edge hook for deterministic edge settlement.",
  );
  assert.ok(
    streetSource.includes(
      "cue.targetLocationId && !cue.targetIsNpc && distance > CELL * 1.1",
    ),
    "NPC map-agency targets must not draw full location footprint halos that read as blue rectangle artifacts.",
  );
  assert.ok(
    !streetSource.includes("drawFootprintHalo(layer, selectedFootprint"),
    "Selected NPC focus must stay actor-attached instead of drawing a full location footprint halo.",
  );
  assert.ok(
    streetSource.includes("target-outside-safe-rect") &&
      streetSource.includes("label-would-clamp-away-from-target") &&
      streetSource.includes("pointInsideVisualRect(cue.targetWorld, labelSafeRect)"),
    "Map-agency target labels must hide instead of clamping distant landmark labels into the wrong camera region.",
  );
  assert.ok(
    visualSceneRendererSource.includes("drawHarborBuoy("),
    "Harbor ambient life must render the east-water cue as an authored buoy, not a stray bright dot.",
  );
  assert.ok(
    streetSource.includes("function drawInteriorPlayerRouteLane") &&
      !streetSource.includes("function drawInteriorPlayerRouteBreadcrumb"),
    "Interior player route progress must render as a connected lane instead of dot breadcrumbs.",
  );
  assert.ok(
    !streetSource.includes("positiveModulo(now / 2600, 1)") &&
      !streetSource.includes("fillCircle(point.x + 1.2, point.y + 1.4"),
    "Map-agency guidance must not render moving dot breadcrumbs that read as route residue.",
  );
}

async function assertBoardingHouseInteriorVisualGuard() {
  const [streetSource, smokeSource] = await Promise.all([
    readFile(STREET_APP_PATH, "utf8"),
    readFile(VISUAL_SMOKE_PATH, "utf8"),
  ]);

  assert.ok(
    streetSource.includes("function drawBoardingHouseInteriorAtmosphere") &&
      streetSource.includes('space.id !== "interior:boarding-house"'),
    "Morrow House must keep a boarding-house-specific interior atmosphere pass.",
  );
  assert.ok(
    streetSource.includes("function drawBoardingHouseInteriorObjectDetail") &&
      streetSource.includes('object.id.startsWith("boarding-house-")'),
    "Morrow House furniture must keep boarding-house-specific readable object details.",
  );
  assert.match(
    streetSource,
    /space\.id === "interior:boarding-house"[\s\S]*?fontSize:[\s\S]*?"14px"[\s\S]*?setOrigin\([\s\S]*?0\.5/,
    "The Morrow House title must stay smaller and centered so it does not crop at first interior framing.",
  );
  assert.ok(
    smokeSource.includes("runInteriorCameraCheck") &&
      smokeSource.includes("interior-camera.png") &&
      smokeSource.includes("assertBoardingHouseInteriorVisualGuard"),
    "Visual smoke must keep a screenshot-backed interior camera check plus the Morrow House visual guard.",
  );
}

function readNumericConst(source, name) {
  const match = source.match(
    new RegExp(`const ${name} = ([0-9_.]+);`),
  );
  assert.ok(match, `Could not find ${name}.`);
  return Number(match[1].replaceAll("_", ""));
}

function cameraProbeReachedEdge(probe, edge) {
  if (!probe?.scroll || !probe?.scrollRange) {
    return false;
  }

  if (edge === "west") {
    return probe.scroll.x <= probe.scrollRange.minX + 52;
  }
  if (edge === "east") {
    return probe.scroll.x >= probe.scrollRange.maxX - 52;
  }
  if (edge === "north") {
    return probe.scroll.y <= probe.scrollRange.minY + 52;
  }
  if (edge === "south") {
    return probe.scroll.y >= probe.scrollRange.maxY - 52;
  }

  return false;
}

function cameraProbeInRange(probe, tolerance = 0.5) {
  return Boolean(
    probe?.scroll &&
      probe?.scrollRange &&
      probe.scroll.x >= probe.scrollRange.minX - tolerance &&
      probe.scroll.x <= probe.scrollRange.maxX + tolerance &&
      probe.scroll.y >= probe.scrollRange.minY - tolerance &&
      probe.scroll.y <= probe.scrollRange.maxY + tolerance,
  );
}

function assertVisualEventCueBackedByCurrentPressure(cue, browserProbe, viewportName) {
  const cityEventsById = new Map(
    (browserProbe?.worldPressure?.cityEvents ?? []).map((event) => [
      event.id,
      event,
    ]),
  );
  const backingEvents = cue?.backingEvents ?? [];
  assert.ok(
    backingEvents.length > 0,
    `${viewportName}: visual event cue has no current event backing: ${JSON.stringify(cue)}.`,
  );
  for (const backing of backingEvents) {
    const pressureEvent = cityEventsById.get(backing.id);
    assert.ok(
      pressureEvent,
      `${viewportName}: visual cue backing does not exist in current world pressure: ${JSON.stringify(
        cue,
      )}.`,
    );
    assert.equal(
      pressureEvent.locationId,
      backing.locationId,
      `${viewportName}: visual cue backing location diverged from current pressure for ${backing.id}.`,
    );
    assert.equal(
      pressureEvent.status,
      backing.status,
      `${viewportName}: visual cue backing status diverged from current pressure for ${backing.id}.`,
    );
    assert.equal(
      pressureEvent.progress ?? null,
      backing.progress ?? null,
      `${viewportName}: visual cue backing progress diverged from current pressure for ${backing.id}.`,
    );
    assert.equal(
      pressureEvent.outcome ?? null,
      backing.outcome ?? null,
      `${viewportName}: visual cue backing outcome diverged from current pressure for ${backing.id}.`,
    );
  }
}

function assertFirstRouteEventCues(browserProbe, viewportName) {
  const cues = browserProbe?.visualEventCues ?? [];
  const cueNames = new Set(cues.map((cue) => cue.cue));
  const cueByName = new Map(cues.map((cue) => [cue.cue, cue]));
  assert.ok(
    cues.length >= 2,
    `${viewportName}: expected at least two visible city event cues in the first-route probe, got ${JSON.stringify(cues)}.`,
  );
  assert.ok(
    cueNames.has("warm cafe prep"),
    `${viewportName}: missing warm cafe prep cue evidence in the first-route probe.`,
  );
  assert.ok(
    cueNames.has("square crossing bustle"),
    `${viewportName}: missing square crossing bustle cue evidence in the first-route probe.`,
  );
  assert.ok(
    cueByName
      .get("warm cafe prep")
      ?.backingEvents?.some((event) => event.id === "event-cafe-prep"),
    `${viewportName}: warm cafe prep cue is not backed by the current cafe prep event.`,
  );
  assert.ok(
    cueByName
      .get("square crossing bustle")
      ?.backingEvents?.some((event) => event.id === "event-market-crossing"),
    `${viewportName}: square crossing bustle cue is not backed by the current square crossing event.`,
  );
  for (const cue of cues) {
    assertVisualEventCueBackedByCurrentPressure(cue, browserProbe, viewportName);
  }
  assert.ok(
    cues.every(
      (cue) =>
        cue.locationName &&
        cue.signal &&
        !/\b(cityEvents|worldPressure|routeKey|advance_objective)\b/i.test(
          `${cue.cue} ${cue.locationName} ${cue.signal}`,
        ),
    ),
    `${viewportName}: event cue evidence must use player-facing cue names, got ${JSON.stringify(cues)}.`,
  );
}

function assertScheduledNpcVisualCues(browserProbe, viewportName) {
  const cues = browserProbe?.movement?.scheduledNpcVisualCues ?? [];
  assert.ok(
    cues.length >= 1,
    `${viewportName}: expected at least one visible scheduled NPC movement cue in the first-route probe.`,
  );
  assert.ok(
    cues.some(
      (cue) =>
        cue.visible &&
        cue.onRoute &&
        cue.routeLegal &&
        cue.routePathLength > 1 &&
        typeof cue.routeProgress === "number" &&
        cue.cueLabel &&
        cue.npcId &&
        cue.fromLocationId &&
        cue.toLocationId,
    ),
    `${viewportName}: scheduled NPC movement cue did not include visible route/progress evidence: ${JSON.stringify(cues)}.`,
  );
  assert.ok(
    cues.every(
      (cue) =>
        !/\b(cityEvents|worldPressure|routeKey|advance_objective)\b/i.test(
          `${cue.cueLabel ?? ""} ${cue.cueSignal ?? ""}`,
        ),
    ),
    `${viewportName}: scheduled NPC cue evidence must use player-facing labels, got ${JSON.stringify(cues)}.`,
  );
}

function assertOpeningPlayerLocationGeometry(browserProbe, viewportName) {
  const geometry = browserProbe?.movement?.playerLocationGeometry;
  assert.ok(
    geometry,
    `${viewportName}: missing opening player location geometry evidence.`,
  );
  assert.equal(
    geometry.currentLocationId,
    "boarding-house",
    `${viewportName}: opening player geometry should start at Morrow House.`,
  );
  assert.equal(
    geometry.actionId,
    "enter:boarding-house",
    `${viewportName}: opening player geometry should target Enter Morrow House.`,
  );
  assert.equal(
    geometry.anchorLocationId,
    "boarding-house",
    `${viewportName}: opening player geometry should use the Morrow House anchor.`,
  );
  assert.equal(
    geometry.anchorKind,
    "door",
    `${viewportName}: opening player geometry should measure against the Morrow House door.`,
  );
  assert.ok(
    geometry.anchorWorldPoint &&
      geometry.anchorWorldPoint.x >=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.minX &&
      geometry.anchorWorldPoint.x <=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.maxX &&
      geometry.anchorWorldPoint.y >=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.minY &&
      geometry.anchorWorldPoint.y <=
        OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS.maxY,
    `${viewportName}: Morrow House door anchor is detached from the visible entrance: ${JSON.stringify(geometry)}.`,
  );
  assert.equal(
    geometry.nearActionLocation,
    true,
    `${viewportName}: Rowan marker is not near the opening action location: ${JSON.stringify(geometry)}.`,
  );
  assert.ok(
    typeof geometry.distanceToAnchor === "number" &&
      geometry.distanceToAnchor <= OPENING_PLAYER_LOCATION_MAX_DISTANCE,
    `${viewportName}: Rowan marker is too far from the Morrow House entrance: ${JSON.stringify(geometry)}.`,
  );
}

function assertOpeningActionCarryForward(
  browserProbe,
  label,
  expectedStatuses = ["queued", "in_progress", "completed"],
) {
  const carryForward = browserProbe?.openingActionCarryForward;
  assert.ok(
    carryForward,
    `${label}: missing opening action carry-forward evidence.`,
  );
  assert.equal(
    carryForward.selectedActionId,
    "enter:boarding-house",
    `${label}: opening carry-forward should select Enter Morrow House: ${JSON.stringify(carryForward)}.`,
  );
  assert.equal(
    carryForward.targetLocationId,
    "boarding-house",
    `${label}: opening carry-forward should target Morrow House: ${JSON.stringify(carryForward)}.`,
  );
  assert.ok(
    expectedStatuses.includes(carryForward.status),
    `${label}: opening carry-forward has the wrong status: ${JSON.stringify(carryForward)}.`,
  );
  assert.equal(
    carryForward.watchMode?.enabled,
    true,
    `${label}: opening carry-forward should be watch-mode evidence: ${JSON.stringify(carryForward)}.`,
  );
  assert.equal(
    carryForward.requiredVisibleInput,
    false,
    `${label}: watch-mode opening carry-forward should not require visible input: ${JSON.stringify(carryForward)}.`,
  );
  if (carryForward.status !== "completed") {
    assert.equal(
      carryForward.geometry?.nearActionLocation,
      true,
      `${label}: queued opening action should keep Rowan near the Morrow House door: ${JSON.stringify(carryForward)}.`,
    );
  }
}

function pointInsideBounds(point, bounds) {
  return (
    point &&
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

function assertMorrowMapAgencyTargetCorrelation(mapAgency, label) {
  const target = mapAgency?.target;
  assert.ok(target, `${label}: missing map-agency target.`);
  assert.equal(
    target.locationId,
    "boarding-house",
    `${label}: Rowan is at the Morrow opening but map-agency targets a different location: ${JSON.stringify(mapAgency)}.`,
  );
  assert.equal(
    target.actionId,
    "enter:boarding-house",
    `${label}: Morrow opening map-agency target must carry the Enter Morrow House action: ${JSON.stringify(mapAgency)}.`,
  );
  assert.ok(
    target.source === "autonomy" || target.source === "pending-move",
    `${label}: Morrow opening map-agency target should come from the current action authority, not a future location fallback: ${JSON.stringify(mapAgency)}.`,
  );
  assert.match(
    target.label ?? "",
    /Morrow House/i,
    `${label}: Morrow opening map-agency target label is not player-facing Morrow copy: ${JSON.stringify(mapAgency)}.`,
  );
  assert.ok(
    pointInsideBounds(target, OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS),
    `${label}: Morrow opening map-agency target world point is detached from the Morrow House door: ${JSON.stringify(mapAgency)}.`,
  );
  if (target.label && /Kettle|Lamp/i.test(target.label)) {
    assert.fail(
      `${label}: Morrow-side map-agency target must not label Kettle & Lamp: ${JSON.stringify(mapAgency)}.`,
    );
  }
}

function assertKettleMapAgencyTargetCorrelation(mapAgency, label) {
  const target = mapAgency?.target;
  if (target?.locationId !== "tea-house") {
    return false;
  }

  if (!target.isNpc) {
    assert.match(
      target.label ?? "",
      /Kettle & Lamp/i,
      `${label}: Kettle map-agency target label is not player-facing Kettle copy: ${JSON.stringify(mapAgency)}.`,
    );
  }
  assert.ok(
    pointInsideBounds(target, KETTLE_LAMP_LANDMARK_BOUNDS),
    `${label}: Kettle map-agency target world point is detached from the authored Kettle & Lamp landmark: ${JSON.stringify(mapAgency)}.`,
  );
  assert.ok(
    target.actionId === "move:tea-house" ||
      target.actionId === "enter:tea-house" ||
      target.actionId === null ||
      target.actionId?.startsWith("talk:"),
    `${label}: Kettle target should carry a Kettle move/enter action or a conversation-safe action: ${JSON.stringify(mapAgency)}.`,
  );
  if (
    mapAgency.playerWorldPoint?.x <= MORROW_SIDE_WORLD_MAX_X &&
    mapAgency.labels?.intentVisible
  ) {
    assert.ok(
      !/\bKettle\s*&?\s*Lamp\b/i.test(mapAgency.labels.intentText ?? ""),
      `${label}: Kettle intent text rendered over Rowan while Rowan was still on the Morrow side: ${JSON.stringify(mapAgency)}.`,
    );
  }
  return true;
}

function assertVisibleDecisionArtifactPayload(artifact, label, planningTrace = null) {
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
  if (artifact.nextCheck !== undefined) {
    assert.ok(
      typeof artifact.nextCheck === "string" && artifact.nextCheck.length >= 8,
      `${label}: decision artifact next check is too thin.`,
    );
  }
  assertVisibleDecisionNextCheckForTrace(label, planningTrace, artifact);
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
  assert.ok(
    !/\b(routeKey|advance_objective|planningTrace|worldPressure|cityEvents|jobWindows|npcSchedules|npcPressureMoves|planKey|actionId|targetLocationId|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate)\b/i.test(
      playerText,
    ),
    `${label}: decision artifact leaked backend-shaped labels: ${playerText}`,
  );
}

function assertVisibleDecisionNextCheckForTrace(label, planningTrace, artifact) {
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

function visibleDecisionNextCheck(planningTrace, selectedStep, selectedAction) {
  if (!planningTrace) {
    return "";
  }

  if ((planningTrace.nextSteps?.length ?? 0) >= 2) {
    const selectedIndex = selectedStep
      ? planningTrace.nextSteps.findIndex((step) => step === selectedStep)
      : -1;
    const candidates = planningTrace.nextSteps.slice(
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

  return visibleDecisionNextCheckForOutcome(planningTrace);
}

function visibleDecisionNextCheckForOutcome(planningTrace) {
  const selectedOutcomeIndex = planningTrace.selectedMatchedOutcomeId
    ? planningTrace.outcomes.findIndex(
        (outcome) => outcome.id === planningTrace.selectedMatchedOutcomeId,
      )
    : -1;
  const candidates = [
    ...(selectedOutcomeIndex >= 0
      ? planningTrace.outcomes.slice(selectedOutcomeIndex + 1)
      : []),
    ...planningTrace.outcomes,
  ].filter(
    (outcome) =>
      outcome.status !== "met" &&
      (!planningTrace.selectedMatchedOutcomeId ||
        outcome.id !== planningTrace.selectedMatchedOutcomeId) &&
      !isCurrentOrMetaTraceOutcome(planningTrace, outcome),
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

  const lead = stripTrailingVisibleDecisionPunctuation(label);
  return compactVisibleDecisionText(signal ? `${lead}: ${signal}` : label, 118);
}

function isCurrentOrMetaTraceOutcome(planningTrace, outcome) {
  const label = compactVisibleDecisionText(outcome.label, 80).toLowerCase();
  const current = compactVisibleDecisionText(
    planningTrace.selectedPressureLabel,
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
      "That opening has closed for now.",
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
    .replace(/\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}...`;
}

function assertVisibleDecisionArtifactDom(
  decisionArtifact,
  label,
  artifactPayload = null,
) {
  assert.ok(decisionArtifact, `${label}: missing visible decision artifact DOM.`);
  assert.equal(
    decisionArtifact.visible,
    true,
    `${label}: decision artifact exists but is not readable in the rail viewport.`,
  );
  assert.match(
    decisionArtifact.text,
    /Rowan weighs/i,
    `${label}: decision artifact should read as Rowan's decision callback.`,
  );
  assert.match(
    decisionArtifact.text,
    /Aim/i,
    `${label}: decision artifact should show Rowan's aim.`,
  );
  assert.match(
    decisionArtifact.text,
    /Signals/i,
    `${label}: decision artifact should show relevant constraints or signals.`,
  );
  assert.match(
    decisionArtifact.text,
    /Choice/i,
    `${label}: decision artifact should show the selected choice.`,
  );
  assert.match(
    decisionArtifact.text,
    /Why this/i,
    `${label}: decision artifact should show a concise rationale.`,
  );
  if (artifactPayload?.nextCheck) {
    assert.match(
      decisionArtifact.text,
      /Next check/i,
      `${label}: decision artifact should show Rowan's short-horizon check.`,
    );
  }
  const passedOverOptionVisible = (artifactPayload?.passedOver ?? []).some(
    (entry) =>
      typeof entry === "string" &&
      entry.length > 0 &&
      decisionArtifact.text.includes(
        entry.slice(0, Math.min(entry.length, 24)),
      ),
  );
  if (passedOverOptionVisible) {
    assert.match(
      decisionArtifact.text,
      /Not now/i,
      `${label}: decision artifact should show rejected options with a player-facing label.`,
    );
  }
  if (artifactPayload?.passedOver?.length) {
    assert.doesNotMatch(
      decisionArtifact.text,
      /Passed over/i,
      `${label}: decision artifact should not use the old rejected-option label.`,
    );
  }
  assert.match(
    decisionArtifact.text,
    /Options/i,
    `${label}: decision artifact should show considered options.`,
  );
  assert.doesNotMatch(
    decisionArtifact.text,
    /Planner trace|Rejected:|Blocked:|Action:|routeKey|advance_objective|planningTrace|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate/i,
    `${label}: decision artifact leaked debug/planner language.`,
  );
}

function selectedVisibleDecisionArtifactPayload(probe) {
  return (
    probe?.rail?.visibleDecisionArtifact ??
    probe?.autonomy?.visibleDecisionArtifact ??
    null
  );
}

function compactDecisionArtifactDiagnostic(artifact) {
  if (!artifact) {
    return null;
  }

  return {
    backingSummary: artifact.backingSummary ?? null,
    considered: artifact.considered ?? [],
    constraints: artifact.constraints ?? [],
    hasNextCheck: Boolean(artifact.nextCheck),
    nextCheck: artifact.nextCheck ?? null,
    objective: artifact.objective ?? null,
    rationale: artifact.rationale ?? null,
    selectedAction: artifact.selectedAction ?? null,
    sourceSummary: artifact.sourceSummary ?? null,
  };
}

function compactDecisionArtifactProbeDiagnostic(probe) {
  if (!probe) {
    return null;
  }

  return {
    activeConversation: probe.activeConversation ?? null,
    autonomy: probe.autonomy
      ? {
          key: probe.autonomy.key,
          label: probe.autonomy.label,
          mode: probe.autonomy.mode,
          planningTraceSelectedActionId:
            probe.autonomy.planningTrace?.selectedActionId ?? null,
          visibleDecisionArtifact: compactDecisionArtifactDiagnostic(
            probe.autonomy.visibleDecisionArtifact,
          ),
        }
      : null,
    clock: probe.clock ?? null,
    gameId: probe.gameId ?? null,
    rail: probe.rail
      ? {
          next: probe.rail.next,
          now: probe.rail.now,
          status: probe.rail.status,
          visibleDecisionArtifact: compactDecisionArtifactDiagnostic(
            probe.rail.visibleDecisionArtifact,
          ),
        }
      : null,
    watchMode: probe.watchMode ?? null,
  };
}

function safeArtifactName(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function captureDecisionArtifactMismatch(session, label, mismatch) {
  const basename = safeArtifactName(`${label}-decision-artifact-mismatch`);
  const diagnosticsPath = path.join(OUTPUT_DIR, `${basename}.json`);
  const screenshotPath = path.join(OUTPUT_DIR, `${basename}.png`);

  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        label,
        ...mismatch,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await session.captureScreenshot(screenshotPath);

  return { diagnosticsPath, screenshotPath };
}

async function waitForVisibleDecisionArtifactDom(session, label, options = {}) {
  const timeoutMs = options.timeoutMs ?? AUTOPLAY_START_TIMEOUT_MS;
  const startedAt = Date.now();
  let lastMismatch = null;

  while (Date.now() - startedAt < timeoutMs) {
    const probe = await session.readBrowserProbe();
    const page = await session.inspectPage();
    const payload = selectedVisibleDecisionArtifactPayload(probe);
    const accepted =
      typeof options.accept === "function" ? options.accept({ page, probe }) : true;

    if (!accepted) {
      lastMismatch = {
        bodyText: page.bodyText,
        decisionArtifactDom: page.decisionArtifact,
        error: "Page/probe state did not satisfy the caller's readiness predicate.",
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        selectedPayload: compactDecisionArtifactDiagnostic(payload),
        url: page.url,
      };
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    try {
      assert.ok(payload, `${label}: missing visible decision artifact payload.`);
      assertVisibleDecisionArtifactDom(page.decisionArtifact, label, payload);
      return { page, payload, probe };
    } catch (error) {
      lastMismatch = {
        bodyText: page.bodyText,
        decisionArtifactDom: page.decisionArtifact,
        error: error instanceof Error ? error.message : String(error),
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        selectedPayload: compactDecisionArtifactDiagnostic(payload),
        url: page.url,
      };
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const artifacts = await captureDecisionArtifactMismatch(
    session,
    label,
    lastMismatch,
  );
  throw new Error(
    [
      `${label}: rendered decision artifact did not match the browser probe payload within ${timeoutMs}ms.`,
      `Diagnostics: ${artifacts.diagnosticsPath}`,
      `Screenshot: ${artifacts.screenshotPath}`,
      `Last mismatch: ${JSON.stringify(lastMismatch, null, 2)}`,
    ].join("\n"),
  );
}

async function waitForOpeningActionCarryForward(
  session,
  label,
  expectedStatuses = ["queued", "in_progress", "completed"],
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? AUTOPLAY_START_TIMEOUT_MS;
  const startedAt = Date.now();
  let lastMismatch = null;

  while (Date.now() - startedAt < timeoutMs) {
    const probe = await session.readBrowserProbe();

    try {
      assertOpeningActionCarryForward(probe, label, expectedStatuses);
      return probe;
    } catch (error) {
      const page = await session.inspectPage().catch((pageError) => ({
        error: pageError instanceof Error ? pageError.message : String(pageError),
      }));
      lastMismatch = {
        bodyText: page.bodyText ?? null,
        error: error instanceof Error ? error.message : String(error),
        openingActionCarryForward: probe?.openingActionCarryForward ?? null,
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        url: page.url ?? null,
      };
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const basename = safeArtifactName(`${label}-opening-carry-forward-mismatch`);
  const diagnosticsPath = path.join(OUTPUT_DIR, `${basename}.json`);
  const screenshotPath = path.join(OUTPUT_DIR, `${basename}.png`);
  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        expectedStatuses,
        label,
        ...lastMismatch,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await session.captureScreenshot(screenshotPath);

  throw new Error(
    [
      `${label}: opening action carry-forward evidence did not stabilize within ${timeoutMs}ms.`,
      `Diagnostics: ${diagnosticsPath}`,
      `Screenshot: ${screenshotPath}`,
      `Last mismatch: ${JSON.stringify(lastMismatch, null, 2)}`,
    ].join("\n"),
  );
}

function assertNoWatchModeReplyAffordances(page, label) {
  assert.deepEqual(
    page.watchModeReplyAffordances ?? [],
    [],
    `${label}: watch mode exposed reply/action-looking conversation affordances: ${JSON.stringify(
      page.watchModeReplyAffordances ?? [],
      null,
      2,
    )}`,
  );
}

function cameraScrollDistance(first, second) {
  return Math.hypot(
    (second?.scroll?.x ?? 0) - (first?.scroll?.x ?? 0),
    (second?.scroll?.y ?? 0) - (first?.scroll?.y ?? 0),
  );
}

function cameraPointDistance(first, second) {
  return Math.hypot(
    (second?.x ?? 0) - (first?.x ?? 0),
    (second?.y ?? 0) - (first?.y ?? 0),
  );
}

async function settleCameraAtEdge(
  session,
  edge,
  currentProbe,
  options = {},
) {
  const attempts = options.attempts ?? 4;
  const settleMs = options.settleMs ?? 40;
  let probe = currentProbe;
  if (cameraProbeReachedEdge(probe, edge)) {
    return probe;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await session.panCameraToEdge(edge);
    await sleep(settleMs);
    probe = await session.readCameraProbe();
    if (cameraProbeReachedEdge(probe, edge)) {
      return probe;
    }
  }

  return probe;
}

function assertSameCameraSpace(viewport, first, second, description) {
  assert.equal(
    second.activeSpaceId,
    first.activeSpaceId,
    `${viewport.name}: ${description} changed active space from ${first.activeSpaceId} to ${second.activeSpaceId}; camera traversal must be measured within one stable scene.`,
  );
  assert.equal(
    second.activeSpaceKind,
    first.activeSpaceKind,
    `${viewport.name}: ${description} changed active space kind from ${first.activeSpaceKind} to ${second.activeSpaceKind}; camera traversal must be measured within one stable scene.`,
  );
}

async function waitForFreshAutoplayAdvance(session, openingProbe, label) {
  assert.ok(openingProbe?.gameId, `${label}: opening probe is missing a game id.`);
  assert.equal(
    openingProbe.watchMode?.enabled,
    true,
    `${label}: opening probe is not in watch mode.`,
  );

  return waitFor(
    async () => {
      const probe = await session.readBrowserProbe();
      if (!probe?.watchMode?.enabled || probe.watchMode?.frozen) {
        return false;
      }

      const advanced =
        probe.clock?.totalMinutes > openingProbe.clock?.totalMinutes ||
        probe.autonomy?.key !== openingProbe.autonomy?.key ||
        probe.location?.id !== openingProbe.location?.id ||
        Boolean(probe.activeConversation?.npcId);

      return advanced ? probe : false;
    },
    AUTOPLAY_START_TIMEOUT_MS,
    `${label} did not leave the opening Watch Rowan begin state within ${AUTOPLAY_START_TIMEOUT_MS}ms.`,
  );
}

async function runFreshAutoplayStartCheck(session) {
  const viewport = VIEWPORTS[0];
  const url = `${activeWebBase}/?new=1&autoplayStart=${Date.now()}`;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();
  await session.waitForWatchModeUi(viewport);

  const openingProbe = await session.readBrowserProbe();
  const openingMapAgency = await session.waitForMapAgencyProbe(viewport);
  assertMorrowMapAgencyTargetCorrelation(
    openingMapAgency,
    "fresh autoplay opening",
  );
  assertKettleMapAgencyTargetCorrelation(
    openingMapAgency,
    "fresh autoplay opening",
  );
  assertOpeningActionCarryForward(openingProbe, "fresh autoplay opening", [
    "queued",
    "in_progress",
    "completed",
  ]);
  const advancedProbe = await waitForFreshAutoplayAdvance(
    session,
    openingProbe,
    "fresh autoplay",
  );
  assertOpeningActionCarryForward(advancedProbe, "fresh autoplay advanced", [
    "completed",
  ]);
  const continued = await waitForVisibleDecisionArtifactDom(
    session,
    "fresh autoplay",
    {
      accept: ({ page, probe }) => {
        const continuedText =
          hasWatchModeProgressText(page.bodyText) ||
          Boolean(probe?.activeConversation?.npcId);
        const stillOpeningCta = page.bodyText.includes("Watch Rowan begin");

        return continuedText && !stillOpeningCta;
      },
      timeoutMs: AUTOPLAY_START_TIMEOUT_MS,
    },
  );
  const page = continued.page;
  const continuedProbe = continued.probe;
  const continuedMapAgency = await session.readMapAgencyProbe();
  assertKettleMapAgencyTargetCorrelation(
    continuedMapAgency,
    "fresh autoplay continued",
  );
  assert.ok(
    !page.bodyText.includes("Watch Rowan begin"),
    "fresh autoplay remained stuck on Watch Rowan begin after the start delay.",
  );
  assert.ok(
    hasWatchModeProgressText(page.bodyText) ||
      Boolean(continuedProbe.activeConversation?.npcId),
    "fresh autoplay did not present a continued watch-mode state after starting.",
  );
  assert.ok(
    !page.bodyText.includes(GENERIC_AUTOPLAY_NOTE),
    "fresh autoplay exposed the generic carry-forward note instead of contextual watch-mode copy.",
  );
  assert.deepEqual(
    page.visibleProgressionControls,
    [],
    `fresh autoplay exposed visible progression/action controls: ${JSON.stringify(
      page.visibleProgressionControls,
    )}`,
  );
  assertNoWatchModeReplyAffordances(page, "fresh autoplay");
  if (continuedProbe.activeConversation?.npcId) {
    assert.match(
      page.bodyText,
      /Rowan (?:replies automatically|is replying automatically|will answer automatically|is carrying the conversation)/i,
      "fresh autoplay conversation did not expose passive carry-forward copy.",
    );
  }
  assertVisibleDecisionArtifactPayload(
    continuedProbe.autonomy?.visibleDecisionArtifact,
    "fresh autoplay",
    continuedProbe.autonomy?.planningTrace,
  );
  assertVisibleDecisionArtifactPayload(
    continuedProbe.rail?.visibleDecisionArtifact,
    "fresh autoplay rail",
    continuedProbe.autonomy?.planningTrace,
  );
  assertVisibleDecisionArtifactDom(
    page.decisionArtifact,
    "fresh autoplay",
    continued.payload,
  );

  const screenshotPath = path.join(OUTPUT_DIR, "fresh-autoplay-started.png");
  await session.captureScreenshot(screenshotPath);
  const screenshot = await readFile(screenshotPath);
  assertPngScreenshot(screenshot, viewport);

  return {
    advanced: {
      activeConversation: continuedProbe.activeConversation,
      autonomy: continuedProbe.autonomy,
      clock: continuedProbe.clock,
      location: continuedProbe.location,
      mapAgency: continuedMapAgency,
      openingActionCarryForward: continuedProbe.openingActionCarryForward,
      rail: continuedProbe.rail,
      visibleDecisionArtifact: continuedProbe.autonomy?.visibleDecisionArtifact,
      watchMode: continuedProbe.watchMode,
      watchModeReplyAffordances: page.watchModeReplyAffordances,
    },
    firstActionTransition: {
      activeConversation: advancedProbe.activeConversation,
      autonomy: advancedProbe.autonomy,
      clock: advancedProbe.clock,
      location: advancedProbe.location,
      openingActionCarryForward: advancedProbe.openingActionCarryForward,
      rail: advancedProbe.rail,
      watchMode: advancedProbe.watchMode,
    },
    opening: {
      autonomy: openingProbe.autonomy,
      clock: openingProbe.clock,
      location: openingProbe.location,
      mapAgency: openingMapAgency,
      openingActionCarryForward: openingProbe.openingActionCarryForward,
      rail: openingProbe.rail,
      watchMode: openingProbe.watchMode,
    },
    screenshotPath,
  };
}

async function runFreshAutoplayOptOutCheck(session) {
  const viewport = VIEWPORTS[0];
  const url = `${activeWebBase}/?new=1&autoplay=0&autoplayOptOut=${Date.now()}`;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();

  const openingProbe = await session.readBrowserProbe();
  assert.equal(
    openingProbe.watchMode?.enabled,
    false,
    "autoplay=0 should leave a fresh run outside watch mode.",
  );
  assert.equal(
    openingProbe.openingActionCarryForward?.watchMode?.autoplayEnabled,
    false,
    "autoplay=0 should report autoplay disabled.",
  );
  assert.equal(
    openingProbe.openingActionCarryForward?.requiredVisibleInput,
    true,
    "autoplay=0 should require an explicit visible input on the opening action.",
  );

  const page = await session.inspectPage();
  assert.ok(
    page.visibleProgressionControls.length > 0,
    "autoplay=0 should keep visible progression/action controls available.",
  );
  assert.ok(
    !page.rootClass.includes("is-watch-mode"),
    "autoplay=0 should not mark the UI as watch mode.",
  );

  return {
    gameId: openingProbe.gameId,
    openingActionCarryForward:
      openingProbe.openingActionCarryForward ?? null,
    visibleProgressionControls: page.visibleProgressionControls,
    watchMode: openingProbe.watchMode,
  };
}

async function runResponsiveDecisionArtifactCheck(session) {
  const viewport =
    VIEWPORTS.find((candidate) => candidate.name === "codex-compact") ??
    VIEWPORTS.find((candidate) => candidate.width <= 960) ??
    VIEWPORTS[0];
  const url = `${activeWebBase}/?new=1&responsiveDecision=${viewport.name}-${Date.now()}`;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();
  await session.waitForWatchModeUi(viewport);

  const openingProbe = await waitForOpeningActionCarryForward(
    session,
    `${viewport.name} responsive decision opening`,
  );
  const advancedProbe = await waitForFreshAutoplayAdvance(
    session,
    openingProbe,
    `${viewport.name} responsive decision`,
  );
  assertVisibleDecisionArtifactPayload(
    advancedProbe.autonomy?.visibleDecisionArtifact,
    `${viewport.name} responsive decision probe`,
    advancedProbe.autonomy?.planningTrace,
  );
  assertVisibleDecisionArtifactPayload(
    advancedProbe.rail?.visibleDecisionArtifact,
    `${viewport.name} responsive decision rail probe`,
    advancedProbe.autonomy?.planningTrace,
  );

  let page = await session.inspectPage();
  if (page.railState !== "expanded") {
    await session.clickSelector(".ml-rail-toggle");
    await sleep(160);
    page = await session.inspectPage();
  }
  assert.equal(
    page.railState,
    "expanded",
    `${viewport.name}: responsive decision check could not expand the rail.`,
  );
  assertVisibleDecisionArtifactDom(
    page.decisionArtifact,
    `${viewport.name} responsive decision rail`,
    advancedProbe.rail?.visibleDecisionArtifact ??
      advancedProbe.autonomy?.visibleDecisionArtifact,
  );

  const screenshotPath = path.join(
    OUTPUT_DIR,
    `${viewport.name}-decision-artifact.png`,
  );
  await session.captureScreenshot(screenshotPath);
  const screenshot = await readFile(screenshotPath);
  assertPngScreenshot(screenshot, viewport);

  return {
    advanced: {
      autonomy: advancedProbe.autonomy,
      clock: advancedProbe.clock,
      location: advancedProbe.location,
      rail: advancedProbe.rail,
      visibleDecisionArtifact: advancedProbe.autonomy?.visibleDecisionArtifact,
      watchMode: advancedProbe.watchMode,
    },
    expandedDecisionArtifact: page.decisionArtifact,
    screenshotPath,
    viewport,
  };
}

async function runViewportCheck(session, viewport) {
  const url = `${activeWebBase}/?new=1&readyCheck=${viewport.name}-${Date.now()}&freezeAutoplay=1`;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();
  await session.waitForWatchModeUi(viewport);
  await sleep(250);

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
    page.bodyText.includes("Rowan") && hasWatchModeProgressText(page.bodyText),
    `${viewport.name}: expected Rowan watch-mode UI text was missing.`,
  );
  assert.ok(
    !page.bodyText.includes(GENERIC_AUTOPLAY_NOTE),
    `${viewport.name}: watch-mode UI exposed the generic carry-forward note.`,
  );
  assert.ok(
    !/Advance now|A next step is ready|Autoplay is on; this skips|skip the (?:wait|pause)/i.test(
      page.bodyText,
    ),
    `${viewport.name}: watch-mode UI leaked stepper copy.`,
  );
  assert.ok(
    !page.bodyText.includes("Nudge Rowan"),
    `${viewport.name}: watch-mode UI still contains Nudge Rowan copy.`,
  );
  assert.ok(
    !/\{"message":|"message"\s*:\s*"Game\s+game-|Game\s+game-[A-Za-z0-9-]+\s+was not found/i.test(
      page.bodyText,
    ),
    `${viewport.name}: watch-mode UI leaked a raw missing-game backend error.`,
  );
  assert.ok(
    page.rootClass.includes("is-watch-mode"),
    `${viewport.name}: autoplay run did not mark the overlay as watch mode.`,
  );
  assertNoWatchModeReplyAffordances(page, viewport.name);
  assert.deepEqual(
    page.visibleProgressionControls,
    [],
    `${viewport.name}: watch mode exposed visible progression/action controls: ${JSON.stringify(
      page.visibleProgressionControls,
    )}`,
  );
  if (viewport.width <= 960) {
    assert.ok(
      !page.compactPrimaryAction,
      `${viewport.name}: compact watch mode should show carry-forward status, not a visible primary action: ${JSON.stringify(page.compactPrimaryAction)}.`,
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

  const mapAgency = await session.waitForMapAgencyProbe(viewport);
  assert.ok(mapAgency?.intent, `${viewport.name}: missing in-map agency cue.`);
  assert.ok(
    mapAgency.target?.label || mapAgency.detail,
    `${viewport.name}: in-map agency cue has no target or reason.`,
  );
  assertMorrowMapAgencyTargetCorrelation(mapAgency, viewport.name);
  assertKettleMapAgencyTargetCorrelation(mapAgency, viewport.name);
  const browserProbe = await session.readBrowserProbe();
  assert.ok(browserProbe, `${viewport.name}: missing browser probe.`);
  assertFirstRouteEventCues(browserProbe, viewport.name);
  assertOpeningPlayerLocationGeometry(browserProbe, viewport.name);
  assertOpeningActionCarryForward(browserProbe, viewport.name, ["queued"]);
  assertScheduledNpcVisualCues(browserProbe, viewport.name);
  assert.ok(
    browserProbe.autonomy?.intent?.reason,
    `${viewport.name}: autonomy probe is missing a state-based reason.`,
  );
  assert.ok(
    browserProbe.autonomy.intent.signals.length >= 2,
    `${viewport.name}: autonomy reason needs at least two state signals.`,
  );
  assert.ok(
    !/choosing the next step|do this step/i.test(
      browserProbe.autonomy.intent.reason,
    ),
    `${viewport.name}: autonomy reason is still generic: ${browserProbe.autonomy.intent.reason}`,
  );
  const railShowsWhyNow =
    /why now/i.test(page.bodyText) ||
    (await session.evaluate(
      `(/why now/i).test(document.body.innerText || "")`,
    ));
  assert.ok(
    railShowsWhyNow,
    `${viewport.name}: Rowan rail does not show why the next step is happening.`,
  );
  if (browserProbe.autonomy?.visibleDecisionArtifact) {
    assertVisibleDecisionArtifactPayload(
      browserProbe.autonomy.visibleDecisionArtifact,
      `${viewport.name} probe`,
      browserProbe.autonomy?.planningTrace,
    );
  }
  if (browserProbe.rail?.visibleDecisionArtifact) {
    assertVisibleDecisionArtifactPayload(
      browserProbe.rail.visibleDecisionArtifact,
      `${viewport.name} rail probe`,
      browserProbe.autonomy?.planningTrace,
    );
    if (viewport.width > 960) {
      assertVisibleDecisionArtifactDom(
        page.decisionArtifact,
        `${viewport.name} rail`,
        browserProbe.rail.visibleDecisionArtifact,
      );
    }
  }

  let expandedRailScreenshotPath = null;
  let expandedDecisionArtifact = null;
  if (viewport.width <= 960) {
    const collapsedRailHeight = page.rail?.height ?? 0;
    await session.clickSelector(".ml-rail-toggle");
    await sleep(120);
    const expandedPage = await session.inspectPage();
    const minimumExpandedHeight = Math.min(360, viewport.height - 260);
    assert.equal(
      expandedPage.railState,
      "expanded",
      `${viewport.name}: rail toggle did not enter expanded state.`,
    );
    assert.ok(
      expandedPage.rail?.height >=
        Math.max(collapsedRailHeight + 80, minimumExpandedHeight),
      `${viewport.name}: expanded rail is still too short (${expandedPage.rail?.height}px from ${collapsedRailHeight}px).`,
    );
    assert.equal(
      expandedPage.whyNowVisible,
      true,
      `${viewport.name}: expanded rail does not visibly reveal the Why Now context.`,
    );
    if (browserProbe.rail?.visibleDecisionArtifact) {
      assertVisibleDecisionArtifactDom(
        expandedPage.decisionArtifact,
        `${viewport.name} expanded rail`,
        browserProbe.rail.visibleDecisionArtifact,
      );
      expandedDecisionArtifact = expandedPage.decisionArtifact;
    }
    expandedRailScreenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-rail-expanded.png`,
    );
    await session.captureScreenshot(expandedRailScreenshotPath);
    const expandedRailScreenshot = await readFile(expandedRailScreenshotPath);
    assertPngScreenshot(expandedRailScreenshot, viewport);
    await session.clickSelector(".ml-rail-toggle");
    await sleep(80);
    await session.closeFocusPanelIfOpen();
  }

  const panBefore = await session.readCameraProbe();
  assert.ok(panBefore, `${viewport.name}: missing camera probe.`);
  if (viewport.width <= 960) {
    assert.ok(
      page.timePill,
      `${viewport.name}: missing top HUD metrics for camera safe-area check.`,
    );
    assert.ok(
      panBefore.sceneViewportCss?.y >= page.timePill.bottom + 4,
      `${viewport.name}: camera viewport starts under the top HUD (${panBefore.sceneViewportCss?.y ?? "missing"}px, HUD bottom ${page.timePill.bottom}px).`,
    );
  }
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
  await sleep(120);
  if (viewport.width <= 960) {
    await session.closeFocusPanelIfOpen();
  }
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
    await sleep(120);
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
  await sleep(120);
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
    panAtWestEdge = await settleCameraAtEdge(
      session,
      "west",
      panAtWestEdge,
    );
    const westScrollThreshold =
      viewport.width >= 900 ? -200 : viewport.width >= 600 ? -280 : -120;
    assert.ok(
      panAtWestEdge.scroll.x <= westScrollThreshold,
      `${viewport.name}: west map overscan is still clamped too far inward (scroll x ${panAtWestEdge.scroll.x.toFixed(
        1,
      )}, expected <= ${westScrollThreshold}, min ${panAtWestEdge.scrollRange.minX.toFixed(
        1,
      )}, offset x ${panAtWestEdge.cameraOffset.x.toFixed(
        1,
      )}, zoom ${panAtWestEdge.zoom.toFixed(3)}).`,
    );
    if (requiresComputedCompactEdge(viewport)) {
      assert.ok(
        panAtWestEdge.scroll.x <= panAtWestEdge.scrollRange.minX + 52,
        `${viewport.name}: west map did not reach the computed edge range (scroll x ${panAtWestEdge.scroll.x.toFixed(
          1,
        )}, min ${panAtWestEdge.scrollRange.minX.toFixed(
          1,
        )}, offset x ${panAtWestEdge.cameraOffset.x.toFixed(
          1,
        )}, zoom ${panAtWestEdge.zoom.toFixed(3)}).`,
      );
    }
  }

  const westPanScreenshotPath = path.join(
    OUTPUT_DIR,
    `${viewport.name}-after-pan-west.png`,
  );
  await session.captureScreenshot(westPanScreenshotPath);
  const westPanScreenshot = await readFile(westPanScreenshotPath);
  assertPngScreenshot(westPanScreenshot, viewport);

  let northEdge = null;
  let eastEdge = null;
  let southEdge = null;
  let northPanScreenshotPath = null;
  let eastPanScreenshotPath = null;
  let southPanScreenshotPath = null;
  if (viewport.width <= 960) {
    northEdge = await settleCameraAtEdge(session, "north", panAtWestEdge);
    const northScrollThreshold = viewport.width >= 600 ? -380 : -360;
    const activeSpaceKind = northEdge.activeSpaceKind ?? "street";
    const activeSpaceId = northEdge.activeSpaceId ?? "unknown";
    const isStreetScene = activeSpaceKind === "street";
    const northRangeCanClearHud =
      northEdge.scrollRange.minY <= northScrollThreshold;
    assert.ok(
      !isStreetScene || northRangeCanClearHud,
      `${viewport.name}: street north map range is too shallow under the HUD (active space ${activeSpaceId}, min scroll ${northEdge.scrollRange.minY.toFixed(
        1,
      )}, expected <= ${northScrollThreshold}).`,
    );
    const requiredNorthScroll = northRangeCanClearHud
      ? northScrollThreshold
      : northEdge.scrollRange.minY + 52;
    assert.ok(
      northEdge.scroll.y <= requiredNorthScroll,
      `${viewport.name}: north map framing is still too shallow for active space ${activeSpaceId} (${activeSpaceKind}; scroll y ${northEdge.scroll.y.toFixed(
        1,
      )}, expected <= ${requiredNorthScroll.toFixed(1)}, min ${northEdge.scrollRange.minY.toFixed(
        1,
      )}).`,
    );
    if (requiresComputedCompactEdge(viewport)) {
      assert.ok(
        northEdge.scroll.y <= northEdge.scrollRange.minY + 52,
        `${viewport.name}: north map did not reach the computed edge range (scroll y ${northEdge.scroll.y.toFixed(
          1,
        )}, min ${northEdge.scrollRange.minY.toFixed(1)}).`,
      );
      if (isStreetScene) {
        assert.ok(
          northEdge.visibleWorldRect.top <= HIGH_DPR_NORTH_VISIBLE_WORLD_TOP_MAX,
          `${viewport.name}: north visual clearance is still too shallow (visible world top ${northEdge.visibleWorldRect.top.toFixed(
            1,
          )}, expected <= ${HIGH_DPR_NORTH_VISIBLE_WORLD_TOP_MAX}).`,
        );
      }
    }
    northPanScreenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-after-pan-north.png`,
    );
    await session.captureScreenshot(northPanScreenshotPath);
    const northPanScreenshot = await readFile(northPanScreenshotPath);
    assertPngScreenshot(northPanScreenshot, viewport);

    eastEdge = await settleCameraAtEdge(session, "east", northEdge);
    assertSameCameraSpace(
      viewport,
      panAtWestEdge,
      eastEdge,
      "east/west traversal",
    );
    const horizontalTraversal =
      eastEdge.scroll.x - panAtWestEdge.scroll.x;
    const horizontalTraversalThreshold = Math.min(
      400,
      Math.max(260, eastEdge.sceneViewport.width * 0.32),
    );
    assert.ok(
      horizontalTraversal >= horizontalTraversalThreshold,
      `${viewport.name}: east/west map traversal is too small (${horizontalTraversal.toFixed(
        1,
      )}, expected >= ${horizontalTraversalThreshold.toFixed(
        1,
      )}; west ${panAtWestEdge.scroll.x.toFixed(
        1,
      )}, east ${eastEdge.scroll.x.toFixed(
        1,
      )}, min ${eastEdge.scrollRange.minX.toFixed(
        1,
      )}, max ${eastEdge.scrollRange.maxX.toFixed(1)}).`,
    );
    eastPanScreenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-after-pan-east.png`,
    );
    await session.captureScreenshot(eastPanScreenshotPath);
    const eastPanScreenshot = await readFile(eastPanScreenshotPath);
    assertPngScreenshot(eastPanScreenshot, viewport);

    southEdge = await settleCameraAtEdge(session, "south", eastEdge);
    assertSameCameraSpace(
      viewport,
      northEdge,
      southEdge,
      "north/south traversal",
    );
    const verticalTraversal = southEdge.scroll.y - northEdge.scroll.y;
    const verticalTraversalThreshold = Math.min(
      560,
      Math.max(320, southEdge.sceneViewport.height * 0.36),
    );
    assert.ok(
      verticalTraversal >= verticalTraversalThreshold,
      `${viewport.name}: north/south map traversal is too small (${verticalTraversal.toFixed(
        1,
      )}, expected >= ${verticalTraversalThreshold.toFixed(
        1,
      )}; north ${northEdge.scroll.y.toFixed(
        1,
      )}, south ${southEdge.scroll.y.toFixed(
        1,
      )}, min ${southEdge.scrollRange.minY.toFixed(
        1,
      )}, max ${southEdge.scrollRange.maxY.toFixed(1)}).`,
    );
    southPanScreenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-after-pan-south.png`,
    );
    await session.captureScreenshot(southPanScreenshotPath);
    const southPanScreenshot = await readFile(southPanScreenshotPath);
    assertPngScreenshot(southPanScreenshot, viewport);
  }

  return {
    eventCues: browserProbe.visualEventCues ?? [],
    mapAgency,
    page,
    playerLocationGeometry:
      browserProbe.movement?.playerLocationGeometry ?? null,
    scheduledNpcVisualCues:
      browserProbe.movement?.scheduledNpcVisualCues ?? [],
    visibleDecisionArtifact:
      browserProbe.autonomy?.visibleDecisionArtifact ?? null,
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
      eastEdge,
      northEdge,
      southEdge,
      wheel: compactWheelPan,
      westEdge: panAtWestEdge,
    },
    eastPanScreenshotPath,
    northPanScreenshotPath,
    panScreenshotPath,
    screenshotPath,
    southPanScreenshotPath,
    expandedRailScreenshotPath,
    expandedDecisionArtifact,
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
    const rawBackendError =
      /\\{"message":|"message"\\s*:\\s*"Game\\s+game-|Game\\s+game-[A-Za-z0-9-]+\\s+was not found/i.test(text);
    return {
      bodyText: text.slice(0, 800),
      hasCompleteState: text.includes("COMPLETE") || text.includes("First afternoon complete"),
      hasRawBackendError: rawBackendError,
      hasResumeButton: Boolean(document.querySelector("[data-resume-stored-game]")),
      hasStartNewButton: Boolean(document.querySelector("[data-start-new-game]")),
      localStorageGameId: window.localStorage.getItem("many-lives:street-game-id"),
      url: location.href
    };
  })()`);
}

async function createSmokeGame(baseUrl, label) {
  const created = await fetchJson(`${baseUrl}/sim/game/new`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const gameId = created?.game?.id;
  assert.ok(gameId, `${label} could not create a game id.`);
  return gameId;
}

async function driftStoredGameIdAfterPrompt(session, promptedGameId) {
  const driftGameId = await createSmokeGame(
    activeWebBase,
    "Stored-game prompt drift check",
  );
  assert.notEqual(
    driftGameId,
    promptedGameId,
    "Stored-game prompt drift check reused the prompted game id.",
  );

  await session.evaluate(`(() => {
    window.localStorage.setItem(
      "many-lives:street-game-id",
      ${JSON.stringify(driftGameId)}
    );
    return true;
  })()`);

  const driftedStorageGameId = await session.evaluate(
    `window.localStorage.getItem("many-lives:street-game-id")`,
  );
  assert.equal(
    driftedStorageGameId,
    driftGameId,
    "Stored-game prompt drift check did not update localStorage.",
  );

  return driftGameId;
}

async function waitForStoredGameUnavailable(session) {
  return waitFor(
    async () => {
      try {
        return await session.evaluate(`(() => {
          const text = document.body.innerText || "";
          return Boolean(
            text.includes("That run is no longer available") &&
              document.querySelector("[data-start-new-game]") &&
              !document.querySelector("[data-resume-stored-game]")
          );
        })()`);
      } catch {
        return false;
      }
    },
    CDP_WAIT_TIMEOUT_MS,
    "Timed out waiting for the missing stored-game message.",
  );
}

async function runMissingStoredGameCheck(session) {
  const missingGameId = `game-missing-${Date.now()}`;
  await session.evaluate(`(() => {
    window.localStorage.setItem(
      "many-lives:street-game-id",
      ${JSON.stringify(missingGameId)}
    );
    return true;
  })()`);

  await session.navigate(
    `${activeWebBase}/?missingStoredPrompt=${Date.now()}`,
  );
  await waitForStoredGameChoice(session);
  const prompt = await inspectStoredGameChoice(session);
  assert.equal(
    prompt.localStorageGameId,
    missingGameId,
    "Missing stored-game check did not prompt for the seeded missing id.",
  );

  await session.clickSelector("[data-resume-stored-game]");
  await waitForStoredGameUnavailable(session);
  const unavailable = await inspectStoredGameChoice(session);
  assert.equal(
    unavailable.hasRawBackendError,
    false,
    "Missing stored-game prompt leaked a raw backend error.",
  );
  assert.equal(
    unavailable.hasResumeButton,
    false,
    "Missing stored-game prompt should not offer Resume again.",
  );
  assert.equal(
    unavailable.hasStartNewButton,
    true,
    "Missing stored-game prompt should offer Start New.",
  );
  const storedAfterMissing = await session.evaluate(
    `window.localStorage.getItem("many-lives:street-game-id")`,
  );
  assert.notEqual(
    storedAfterMissing,
    missingGameId,
    "Missing stored-game id was not removed from localStorage.",
  );
  const probe = await session.readBrowserProbe();
  assert.equal(
    probe,
    null,
    "Missing stored-game resume should not silently load a replacement game.",
  );

  return {
    missingGameId,
    prompt,
    unavailable,
  };
}

function filterExpectedStoredGamePageErrors(pageErrors, storedGameChoice) {
  const missingGameId = storedGameChoice?.missingStoredGame?.missingGameId;
  if (!missingGameId) {
    return pageErrors;
  }

  return pageErrors.filter((error) => {
    return !(
      error.includes("Failed to load resource") &&
      error.includes(`/sim/game/${missingGameId}/state`)
    );
  });
}

async function runStoredGameChoiceCheck(session) {
  await session.setViewport(VIEWPORTS[0]);
  const seededGameId = await session.evaluate(
    `window.localStorage.getItem("many-lives:street-game-id")`,
  );
  assert.ok(seededGameId, "Visual check did not seed a stored street game id.");

  await session.navigate(`${activeWebBase}/?storagePrompt=${Date.now()}`);
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
  assert.equal(
    prompt.localStorageGameId,
    seededGameId,
    "Stored-game prompt did not capture the seeded storage id.",
  );

  const driftGameId = await driftStoredGameIdAfterPrompt(session, seededGameId);

  await session.clickSelector("[data-resume-stored-game]");
  await session.waitForAppReady();
  await sleep(500);
  const resumedProbe = await session.readBrowserProbe();
  assert.equal(
    resumedProbe?.gameId,
    seededGameId,
    "Resume stored run did not reopen the stored game id.",
  );

  await session.navigate(`${activeWebBase}/?storagePrompt=${Date.now()}`);
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

  const missingStoredGame = await runMissingStoredGameCheck(session);

  return {
    driftGameId,
    freshGameId: freshProbe.gameId,
    missingStoredGame,
    prompt,
    resumedGameId: resumedProbe.gameId,
    seededGameId,
  };
}

async function createInteriorCameraGame() {
  const gameId = await createSmokeGame(
    activeWebBase,
    "Interior camera check",
  );

  const entered = await fetchJson(`${activeWebBase}/sim/game/${gameId}/command`, {
    body: JSON.stringify({ actionId: "enter:boarding-house", type: "act" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(
    entered?.game?.activeSpaceId,
    "interior:boarding-house",
    "Interior camera check could not enter Morrow House.",
  );

  return gameId;
}

async function waitForInteriorCameraProbe(session) {
  return waitFor(
    async () => {
      try {
        const probe = await session.readCameraProbe();
        return probe?.activeSpaceKind === "interior" ? probe : false;
      } catch {
        return false;
      }
    },
    APP_READY_TIMEOUT_MS,
    "Timed out waiting for an interior camera probe.",
  );
}

async function runInteriorCameraCheck(session) {
  const gameId = await createInteriorCameraGame();
  await session.setViewport(INTERIOR_CAMERA_VIEWPORT);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=interior-camera-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  const initial = await waitForInteriorCameraProbe(session);
  await sleep(800);
  const settled = await session.readCameraProbe();
  await sleep(800);
  const settledAgain = await session.readCameraProbe();

  assert.equal(
    settled.activeSpaceId,
    "interior:boarding-house",
    "Interior camera check loaded the wrong active space.",
  );
  assert.ok(
    cameraProbeInRange(settled),
    `Interior camera settled outside its range: scroll ${JSON.stringify(
      settled.scroll,
    )}, range ${JSON.stringify(settled.scrollRange)}.`,
  );
  assert.ok(
    cameraProbeInRange(settledAgain),
    `Interior camera drifted outside its range: scroll ${JSON.stringify(
      settledAgain.scroll,
    )}, range ${JSON.stringify(settledAgain.scrollRange)}.`,
  );
  assert.ok(
    cameraScrollDistance(settled, settledAgain) <= 2,
    `Interior camera drifted after settling by ${cameraScrollDistance(
      settled,
      settledAgain,
    ).toFixed(1)} world pixels.`,
  );
  assert.ok(
    cameraPointDistance(settled.playerWorldPoint, settled.followWorldPoint) <= 100,
    `Interior camera follow target jumped away from Rowan's room coordinate: player ${JSON.stringify(
      settled.playerWorldPoint,
    )}, follow ${JSON.stringify(settled.followWorldPoint)}.`,
  );

  const screenshotPath = path.join(OUTPUT_DIR, "interior-camera.png");
  await session.captureScreenshot(screenshotPath);
  const screenshot = await readFile(screenshotPath);
  assertPngScreenshot(screenshot, INTERIOR_CAMERA_VIEWPORT);

  const interiorSettleOptions = { attempts: 8, settleMs: 90 };
  const eastEdge = await settleCameraAtEdge(
    session,
    "east",
    settledAgain,
    interiorSettleOptions,
  );
  assertSameCameraSpace(INTERIOR_CAMERA_VIEWPORT, settledAgain, eastEdge, "interior east pan");
  assert.ok(cameraProbeInRange(eastEdge), "Interior east pan left the camera out of range.");
  assert.ok(
    eastEdge.scroll.x >= settledAgain.scroll.x + INTERIOR_CAMERA_MIN_PAN_DELTA ||
      cameraProbeReachedEdge(eastEdge, "east"),
    `Interior east pan did not move enough: before ${settledAgain.scroll.x.toFixed(
      1,
    )}, after ${eastEdge.scroll.x.toFixed(1)}.`,
  );

  const westEdge = await settleCameraAtEdge(
    session,
    "west",
    eastEdge,
    interiorSettleOptions,
  );
  assertSameCameraSpace(INTERIOR_CAMERA_VIEWPORT, eastEdge, westEdge, "interior west pan");
  assert.ok(cameraProbeInRange(westEdge), "Interior west pan left the camera out of range.");
  assert.ok(
    westEdge.scroll.x <= eastEdge.scroll.x - INTERIOR_CAMERA_MIN_PAN_DELTA ||
      cameraProbeReachedEdge(westEdge, "west"),
    `Interior west pan did not move enough: east ${eastEdge.scroll.x.toFixed(
      1,
    )}, west ${westEdge.scroll.x.toFixed(1)}.`,
  );

  const southEdge = await settleCameraAtEdge(
    session,
    "south",
    westEdge,
    interiorSettleOptions,
  );
  assertSameCameraSpace(INTERIOR_CAMERA_VIEWPORT, westEdge, southEdge, "interior south pan");
  assert.ok(cameraProbeInRange(southEdge), "Interior south pan left the camera out of range.");
  assert.ok(
    southEdge.scroll.y >= westEdge.scroll.y + INTERIOR_CAMERA_MIN_PAN_DELTA ||
      cameraProbeReachedEdge(southEdge, "south"),
    `Interior south pan did not move enough: before ${westEdge.scroll.y.toFixed(
      1,
    )}, after ${southEdge.scroll.y.toFixed(1)}.`,
  );

  const northEdge = await settleCameraAtEdge(
    session,
    "north",
    southEdge,
    interiorSettleOptions,
  );
  assertSameCameraSpace(INTERIOR_CAMERA_VIEWPORT, southEdge, northEdge, "interior north pan");
  assert.ok(cameraProbeInRange(northEdge), "Interior north pan left the camera out of range.");
  assert.ok(
    northEdge.scroll.y <= southEdge.scroll.y - INTERIOR_CAMERA_MIN_PAN_DELTA ||
      cameraProbeReachedEdge(northEdge, "north"),
    `Interior north pan did not move enough: south ${southEdge.scroll.y.toFixed(
      1,
    )}, north ${northEdge.scroll.y.toFixed(1)}.`,
  );

  return {
    eastEdge,
    gameId,
    initial,
    northEdge,
    screenshotPath,
    settled,
    southEdge,
    westEdge,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await assertAmbientScaleGuard();
  await assertWatchModeFeelGuard();
  await assertCameraPanContractGuard();
  await assertBoardingHouseInteriorVisualGuard();
  const webServer = await ensureStack();
  const devtoolsPort = await findFreePort();
  const session = await launchBrowser(devtoolsPort);
  const results = [];
  let freshAutoplayStart = null;
  let freshAutoplayOptOut = null;
  let interiorCamera = null;
  let responsiveDecisionArtifact = null;
  let storedGameChoice = null;
  const summaryPath = path.join(OUTPUT_DIR, "summary.json");
  let visualError = null;

  try {
    process.stdout.write("[many-lives] Checking fresh autoplay start behavior...\n");
    freshAutoplayStart = await runFreshAutoplayStartCheck(session);
    process.stdout.write("[many-lives] Finished fresh autoplay start behavior.\n");
    process.stdout.write("[many-lives] Checking fresh autoplay opt-out behavior...\n");
    freshAutoplayOptOut = await runFreshAutoplayOptOutCheck(session);
    process.stdout.write("[many-lives] Finished fresh autoplay opt-out behavior.\n");
    process.stdout.write("[many-lives] Checking responsive decision callback...\n");
    responsiveDecisionArtifact =
      await runResponsiveDecisionArtifactCheck(session);
    process.stdout.write("[many-lives] Finished responsive decision callback.\n");
    for (const viewport of VIEWPORTS) {
      process.stdout.write(`[many-lives] Checking ${viewport.name} viewport...\n`);
      results.push({
        viewport,
        ...(await runViewportCheck(session, viewport)),
      });
      process.stdout.write(`[many-lives] Finished ${viewport.name} viewport.\n`);
    }
    process.stdout.write("[many-lives] Checking stored-run prompt behavior...\n");
    storedGameChoice = await runStoredGameChoiceCheck(session);
    process.stdout.write("[many-lives] Finished stored-run prompt behavior.\n");
    process.stdout.write("[many-lives] Checking interior camera behavior...\n");
    interiorCamera = await runInteriorCameraCheck(session);
    process.stdout.write("[many-lives] Finished interior camera behavior.\n");

    const unexpectedPageErrors = filterExpectedStoredGamePageErrors(
      session.pageErrors,
      storedGameChoice,
    );
    assert.deepEqual(
      unexpectedPageErrors,
      [],
      `Page logged runtime errors:\n${unexpectedPageErrors.join("\n")}`,
    );

    await writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          freshAutoplayStart,
          freshAutoplayOptOut,
          outputDir: OUTPUT_DIR,
          interiorCamera,
          responsiveDecisionArtifact,
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
        `[many-lives] Fresh autoplay started: ${path.join(OUTPUT_DIR, "fresh-autoplay-started.png")}`,
        `[many-lives] Mobile: ${path.join(OUTPUT_DIR, "mobile.png")}`,
        `[many-lives] Mobile after pan: ${path.join(OUTPUT_DIR, "mobile-after-pan.png")}`,
        `[many-lives] Mobile after west pan: ${path.join(OUTPUT_DIR, "mobile-after-pan-west.png")}`,
        `[many-lives] Interior camera: ${path.join(OUTPUT_DIR, "interior-camera.png")}`,
        `[many-lives] Summary: ${summaryPath}`,
        "",
      ].join("\n"),
    );
  } catch (error) {
    visualError = error;
    process.exitCode = 1;
    process.stderr.write(
      `[many-lives] Visual game smoke failed: ${error.stack ?? error.message}\n`,
    );
  } finally {
    await session.close();
    await closeChildProcess(webServer);
  }

  if (visualError) {
    return;
  }
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Visual game smoke failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
