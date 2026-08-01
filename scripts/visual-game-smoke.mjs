import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { inflateSync } from "node:zlib";

import {
  closeChildProcess,
  waitForChildProcessReady,
} from "./visual-game-smoke-startup.mjs";
import {
  cameraScrollDistance,
  waitForStableCameraProbes,
} from "./visual-game-camera-settle.mjs";
import {
  assertVisualQualityRegressionEvidence,
  createVisualQualityRegressionEvidence,
} from "./visual-quality-regression.mjs";

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
const AUTOPLAY_NEAR_ARRIVAL_GRACE_MS = Number(
  process.env.MANY_LIVES_VISUAL_AUTOPLAY_NEAR_ARRIVAL_GRACE_MS ?? "8000",
);
const AUTOPLAY_NEAR_ARRIVAL_MIN_PROGRESS = 0.95;
const RESPONSIVE_DECISION_READABILITY_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_DECISION_READABILITY_TIMEOUT_MS ?? "30000",
);
const RESPONSIVE_DECISION_REPLAY_COMPLETION_TIMEOUT_MS = Number(
  process.env.MANY_LIVES_VISUAL_DECISION_REPLAY_COMPLETION_TIMEOUT_MS ?? "60000",
);
const RESPONSIVE_DECISION_REPLAY_PROGRESS_STALL_GRACE_MS = 15_000;
const RESPONSIVE_DECISION_REPLAY_COMPLETION_MAX_MS = Math.max(
  RESPONSIVE_DECISION_REPLAY_COMPLETION_TIMEOUT_MS,
  120_000,
);
const RESPONSIVE_DECISION_STABILITY_GRACE_MS = Number(
  process.env.MANY_LIVES_VISUAL_DECISION_STABILITY_GRACE_MS ?? "45000",
);
const RESPONSIVE_DECISION_STABILITY_MAX_MS = Number(
  process.env.MANY_LIVES_VISUAL_DECISION_STABILITY_MAX_MS ?? "120000",
);
const RESPONSIVE_DECISION_CAMERA_RECOVERY_GRACE_MS = 1_500;
const RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT = 3;
const RUN_RESPONSIVE_DECISION_GUARD_ONLY =
  process.env.MANY_LIVES_VISUAL_DECISION_GUARD_ONLY === "1";
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
const SOUTH_QUAY_V2_DOCUMENT_PATH = path.join(
  ROOT,
  "apps/many-lives-web/src/lib/street/visual-scene-documents/southQuayV2Document.ts",
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
const OPENING_AUTOPLAY_PROGRESS_EVIDENCE = new Set([
  "first-afternoon-approaches-known",
  "first-afternoon-plan-settled",
  "first-afternoon-lead-recorded",
  "first-afternoon-completed",
  "ada-conversation-active",
  "rowan-at-tea-house",
  "kettle-lamp-next-action",
  "route-progress-to-tea-house",
]);
const KETTLE_LAMP_LANDMARK_BOUNDS = {
  maxX: 1550,
  maxY: 700,
  minX: 1138,
  minY: 324,
};
const EAST_WATERFRONT_MOORING_BAYS = [
  {
    anchorX: 1718,
    anchorY: 488,
    bottom: 530,
    id: "north",
    left: 1592,
    right: 1768,
    top: 446,
  },
  {
    anchorX: 1718,
    anchorY: 765,
    bottom: 800,
    id: "middle",
    left: 1624,
    right: 1768,
    top: 730,
  },
  {
    anchorX: 1718,
    anchorY: 1014,
    bottom: 1056,
    id: "south",
    left: 1576,
    right: 1768,
    top: 976,
  },
];
const EAST_WATERFRONT_VIEWPORT_NAMES = new Set([
  "mobile",
  "compact-boundary",
  "codex-retina-tall",
]);
const NORTH_FRINGE_WORLD_REGION = {
  bottom: 190,
  left: 96,
  right: 680,
  top: 18,
};
const WEST_OPEN_LOT_WORLD_REGION = {
  bottom: 1094,
  left: 150,
  right: 500,
  top: 862,
};
const MORROW_YARD_WORLD_REGION = {
  bottom: 1104,
  left: 146,
  right: 506,
  top: 858,
};
const PILGRIM_SLIP_WORLD_REGION = {
  bottom: 1227,
  left: 1013,
  right: 1673,
  top: 1007,
};
const MORROW_SIDE_WORLD_MAX_X = 700;
const CONTEXTUAL_WATCH_MODE_COPY_PATTERN =
  /Rowan is (?:about to|stepping|turning|heading|keeping|letting|taking|choosing|starting|weighing|continuing|carrying the conversation)/i;

let activeWebBase = DEFAULT_WEB_BASE;
const screenshotCaptureRetries = [];
const screenshotPixelDiagnostics = [];
const eastWaterfrontCompositionDiagnostics = [];
const fringeCompositionDiagnostics = [];
const interiorActorVisibilityDiagnostics = [];
const interiorIdentityDiagnostics = [];
const secondaryLandmarkCompositionDiagnostics = [];

const VIEWPORTS = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
  { height: 900, name: "phone-boundary", width: 560 },
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
];
const RESPONSIVE_DECISION_VIEWPORT_NAMES = new Set([
  "desktop",
  "mobile",
  "tablet-portrait",
  "codex-compact",
  "codex-retina-compact",
  "codex-screenshot-tall",
  "codex-retina-tall",
]);
const NORTH_FRINGE_VIEWPORT_NAMES = new Set([
  "mobile",
  "codex-compact",
  "codex-retina-compact",
]);
const WEST_OPEN_LOT_VIEWPORT_NAMES = new Set([
  "codex-compact",
  "codex-retina-compact",
]);
const INTERIOR_CAMERA_VIEWPORT = {
  deviceScaleFactor: 2,
  height: 998,
  minimumUsefulBytesRatio: 0.04,
  name: "interior-camera",
  width: 810,
};
const MORROW_HOUSE_MARA_WORLD_POINT = { x: 276, y: 276 };
const MORROW_HOUSE_MARA_INTERACTION_WORLD_POINT = { x: 316, y: 276 };
const MORROW_HOUSE_PORTAL_WORLD_POINT = { x: 356, y: 396 };
const MORROW_HOUSE_MARA_WORLD_EXTENTS = {
  halfHeight: 23,
  halfWidth: 17,
};
const ROWAN_WORLD_EXTENTS = {
  halfHeight: 26.5,
  halfWidth: 19.5,
};
const INTERIOR_ACTOR_EDGE_MARGIN_PX = 20;
const INTERIOR_PORTAL_EDGE_MARGIN_PX = 24;
const requestedViewportName = process.env.MANY_LIVES_VISUAL_VIEWPORT ?? null;
const ACTIVE_VIEWPORTS = requestedViewportName
  ? VIEWPORTS.filter((viewport) => viewport.name === requestedViewportName)
  : VIEWPORTS;
if (requestedViewportName && ACTIVE_VIEWPORTS.length === 0) {
  throw new Error(`Unknown MANY_LIVES_VISUAL_VIEWPORT ${requestedViewportName}.`);
}
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

function isLoopbackWebBase(baseUrl) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function shouldRunResponsiveDecisionArtifactCheck(baseUrl) {
  return isLoopbackWebBase(baseUrl);
}

function responsiveDecisionArtifactSkipSummary(baseUrl) {
  return {
    reason: "external-web-base",
    skipped: true,
    webBase: baseUrl,
  };
}

function assertResponsiveDecisionArtifactModeContract() {
  for (const baseUrl of [
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    "http://[::1]:3001",
  ]) {
    assert.equal(
      shouldRunResponsiveDecisionArtifactCheck(baseUrl),
      true,
      `${baseUrl} must retain the deterministic responsive decision regression.`,
    );
  }

  for (const baseUrl of [
    "https://manylives-sim.branavan.com",
    "https://preview.example.test",
  ]) {
    assert.equal(
      shouldRunResponsiveDecisionArtifactCheck(baseUrl),
      false,
      `${baseUrl} must not couple remote visual capture to deterministic decision copy.`,
    );
    assert.deepEqual(responsiveDecisionArtifactSkipSummary(baseUrl), {
      reason: "external-web-base",
      skipped: true,
      webBase: baseUrl,
    });
  }
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

async function fetchJson(url, init, timeoutMs = 8_000) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
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

async function disableLocalNextDevelopmentIndicator(baseUrl) {
  const url = new URL(baseUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    return false;
  }

  const response = await fetch(
    new URL("/__nextjs_disable_dev_indicator", url),
    {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (response.status === 404) {
    return false;
  }
  assert.equal(
    response.status,
    204,
    `Could not disable the local Next.js development indicator (${response.status} ${response.statusText}).`,
  );
  return true;
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

async function startWebServer(baseUrl) {
  const port = Number(new URL(baseUrl).port);
  const logPath = path.join(OUTPUT_DIR, "web-server.log");
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
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        AI_PROVIDER: "mock",
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.manyLivesKillGroup = process.platform !== "win32";

  process.stdout.write(
    `[many-lives] Starting local web app at ${baseUrl}. Child log: ${logPath}\n`,
  );

  try {
    await waitForChildProcessReady({
      baseUrl,
      checkReady: async () => {
        await readWebHealth(baseUrl);
        return true;
      },
      child,
      logPath,
      pollIntervalMs: POLL_INTERVAL_MS,
      timeoutMs: WEB_START_TIMEOUT_MS,
    });
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

  async waitForAnimationFrames(frameCount = 2) {
    const count = Math.max(1, Math.floor(frameCount));
    return this.evaluate(`new Promise((resolve) => {
      let remaining = ${count};
      const onFrame = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve(true);
          return;
        }
        requestAnimationFrame(onFrame);
      };
      requestAnimationFrame(onFrame);
    })`);
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
            const visibleDecisionArtifact = document.querySelector(
              "[data-visible-decision-artifact='true']",
            );
            return {
              bodyTextSample: bodyText.replace(/\\s+/g, " ").trim().slice(0, 900),
              compactPrimaryActionText: compactPrimaryAction?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
              hasRowanText: bodyText.includes("Rowan"),
              hasVisibleDecisionArtifact: Boolean(visibleDecisionArtifact),
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
              (lastState.hasWatchAction ||
                lastState.hasVisibleDecisionArtifact) &&
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
      const dockRoot = document.querySelector(".ml-dock");
      const rail = document.querySelector(".ml-rail-shell");
      const commandRail = document.querySelector(".ml-command-rail");
      const rightStack = document.querySelector(".ml-right-stack");
      const root = document.querySelector(".ml-root");
      const timePill = document.querySelector(".ml-time-pill");
      const whyNow = document.querySelector(".ml-rowan-story-card-reason");
      const decisionArtifacts = Array.from(
        document.querySelectorAll("[data-visible-decision-artifact='true']"),
      );
      const decisionArtifact = decisionArtifacts[0] ?? null;
      const decisionDetails = document.querySelector("[data-decision-details='true']");
      const liveConversationWorkspace = document.querySelector(
        "[data-live-conversation-workspace='true']",
      );
      const liveConversationTranscript = document.querySelector(
        "[data-live-conversation-thread='true'] .ml-chat-transcript",
      );
      const decisionChoice = decisionArtifact?.querySelector(
        "[data-decision-field='choice'] p",
      );
      const nextStoryCard = document.querySelector(
        "[data-rowan-story-card='next']",
      );
      const passiveWatchStatus = document.querySelector(".ml-autoplay-note");
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
          style.contentVisibility !== "hidden" &&
          Number.parseFloat(style.opacity || "1") > 0.01 &&
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
      const dockRootRect = dockRoot?.getBoundingClientRect();
      const railRect = rail?.getBoundingClientRect();
      const rightStackRect = rightStack?.getBoundingClientRect();
      const timePillRect = timePill?.getBoundingClientRect();
      const whyNowRect = whyNow?.getBoundingClientRect();
      const decisionArtifactRect = decisionArtifact?.getBoundingClientRect();
      const rectData = (rect) => rect ? {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        x: Math.round(rect.x),
        y: Math.round(rect.y)
      } : null;
      const visibleRectFor = (element) => {
        if (!element) {
          return null;
        }
        const source = element.getBoundingClientRect();
        let visible = {
          bottom: Math.min(source.bottom, window.innerHeight),
          left: Math.max(source.left, 0),
          right: Math.min(source.right, window.innerWidth),
          top: Math.max(source.top, 0),
        };
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = window.getComputedStyle(ancestor);
          const clipsX = /auto|clip|hidden|scroll/.test(style.overflowX);
          const clipsY = /auto|clip|hidden|scroll/.test(style.overflowY);
          if (!clipsX && !clipsY) {
            continue;
          }
          const rect = ancestor.getBoundingClientRect();
          if (clipsX) {
            visible.left = Math.max(visible.left, rect.left);
            visible.right = Math.min(visible.right, rect.right);
          }
          if (clipsY) {
            visible.top = Math.max(visible.top, rect.top);
            visible.bottom = Math.min(visible.bottom, rect.bottom);
          }
        }
        if (visible.right <= visible.left || visible.bottom <= visible.top) {
          return null;
        }
        return {
          ...visible,
          height: visible.bottom - visible.top,
          width: visible.right - visible.left,
          x: visible.left,
          y: visible.top,
        };
      };
      const meaningfulConversationBubbles = Array.from(
        liveConversationTranscript?.querySelectorAll(".ml-chat-bubble") ?? [],
      ).filter(
        (bubble) =>
          (bubble.textContent?.replace(/\\s+/g, " ").trim() ?? "").length > 0,
      );
      const latestMeaningfulConversationBubble =
        meaningfulConversationBubbles.at(-1) ?? null;
      const latestMeaningfulConversationBubbleRect =
        latestMeaningfulConversationBubble?.getBoundingClientRect() ?? null;
      const latestMeaningfulConversationBubbleVisibleRect =
        visibleRectFor(latestMeaningfulConversationBubble);
      const latestMeaningfulConversationBubbleFullyVisible = Boolean(
        latestMeaningfulConversationBubbleRect &&
          latestMeaningfulConversationBubbleVisibleRect &&
          latestMeaningfulConversationBubbleVisibleRect.left <=
            latestMeaningfulConversationBubbleRect.left + 1 &&
          latestMeaningfulConversationBubbleVisibleRect.right >=
            latestMeaningfulConversationBubbleRect.right - 1 &&
          latestMeaningfulConversationBubbleVisibleRect.top <=
            latestMeaningfulConversationBubbleRect.top + 1 &&
          latestMeaningfulConversationBubbleVisibleRect.bottom >=
            latestMeaningfulConversationBubbleRect.bottom - 1,
      );
      const computedVisualStyle = (element) => {
        if (!element) {
          return null;
        }
        const style = window.getComputedStyle(element);
        return {
          color: style.color,
          contentVisibility: style.contentVisibility,
          display: style.display,
          opacity: Number.parseFloat(style.opacity || "1"),
          rect: rectData(element.getBoundingClientRect()),
          transform: style.transform,
          visibility: style.visibility,
        };
      };
      const visibleTimeChipElements = Array.from(
        timePill?.querySelectorAll(".ml-time-chip") ?? [],
      )
        .filter(isVisibleEnabled);
      const visibleTimeChips = visibleTimeChipElements.map(
        (chip) => chip.textContent?.replace(/\\s+/g, " ").trim() ?? "",
      );
      const visibleTimeChipStyles = visibleTimeChipElements.map((chip) => ({
        ...computedVisualStyle(chip),
        text: chip.textContent?.replace(/\\s+/g, " ").trim() ?? "",
      }));
      const visibleTimeGlyphStyles = visibleTimeChipElements.flatMap(
        (chip, chipIndex) => {
          const chipText =
            chip.textContent?.replace(/\\s+/g, " ").trim() ?? "";
          const walker = document.createTreeWalker(
            chip,
            NodeFilter.SHOW_TEXT,
          );
          const runs = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.replace(/\\s+/g, " ").trim() ?? "";
            const parent = node.parentElement ?? chip;
            if (!text || !isVisibleEnabled(parent)) {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = range.getBoundingClientRect();
            range.detach();
            if (rect.width <= 0 || rect.height <= 0) {
              continue;
            }
            const style = window.getComputedStyle(parent);
            runs.push({
              chipIndex,
              chipText,
              color: style.color,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              opacity: Number.parseFloat(style.opacity || "1"),
              rect: rectData(rect),
              text,
              visibility: style.visibility,
            });
          }
          return runs;
        },
      );
      const visibleUiTextRegions = Array.from(
        document.querySelectorAll([
          ".ml-right-stack .ml-rail-name",
          ".ml-right-stack .ml-rail-status",
          ".ml-right-stack .ml-rail-peek-label",
          ".ml-right-stack .ml-rail-thought",
          ".ml-command-rail [data-decision-field]",
          ".ml-dock .ml-dock-button",
          ".ml-dock .ml-dock-copy",
        ].join(",")),
      )
        .filter(isVisibleEnabled)
        .flatMap((element) => {
          const elementVisibleRect = visibleRectFor(element);
          if (!elementVisibleRect) {
            return [];
          }
          const surface = element.closest(".ml-right-stack") ? "rail" : "dock";
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
          );
          const runs = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.replace(/\\s+/g, " ").trim() ?? "";
            const parent = node.parentElement ?? element;
            if (!text || !isVisibleEnabled(parent)) {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(node);
            const source = range.getBoundingClientRect();
            range.detach();
            const visible = {
              bottom: Math.min(source.bottom, elementVisibleRect.bottom),
              left: Math.max(source.left, elementVisibleRect.left),
              right: Math.min(source.right, elementVisibleRect.right),
              top: Math.max(source.top, elementVisibleRect.top),
            };
            if (visible.right <= visible.left || visible.bottom <= visible.top) {
              continue;
            }
            const style = window.getComputedStyle(parent);
            runs.push({
              color: style.color,
              contentVisibility: style.contentVisibility,
              display: style.display,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              opacity: Number.parseFloat(style.opacity || "1"),
              rect: rectData({
                ...visible,
                height: visible.bottom - visible.top,
                width: visible.right - visible.left,
                x: visible.left,
                y: visible.top,
              }),
              surface,
              text,
              transform: style.transform,
              visibility: style.visibility,
            });
          }
          return runs;
        });
      const decisionFieldCounts = Object.fromEntries(
        ["aim", "signals", "choice", "rationale", "next-check", "options"].map((field) => [
          field,
          document.querySelectorAll(
            "[data-rail-root='rowan'] [data-decision-field='" + field + "']",
          ).length,
        ]),
      );
      const decisionFieldGeometry = Object.fromEntries(
        ["aim", "signals", "choice", "rationale", "next-check", "options"].map((field) => {
          const element = decisionArtifact?.querySelector(
            "[data-decision-field='" + field + "']",
          );
          const source = element?.getBoundingClientRect() ?? null;
          const visible = element ? visibleRectFor(element) : null;
          const fullyVisible = Boolean(
            source &&
              visible &&
              visible.left <= source.left + 1 &&
              visible.right >= source.right - 1 &&
              visible.top <= source.top + 1 &&
              visible.bottom >= source.bottom - 1,
          );
          return [
            field,
            {
              fullyVisible,
              rect: rectData(source),
              visibleRect: rectData(visible),
            },
          ];
        }),
      );
      const visualHierarchy = (() => {
        const probe = document.querySelector("#ml-browser-visual-hierarchy-probe");
        try {
          return probe?.textContent ? JSON.parse(probe.textContent) : null;
        } catch {
          return null;
        }
      })();
      const npcPresence = (() => {
        const probe = document.querySelector("#ml-browser-npc-presence-probe");
        try {
          return probe?.textContent ? JSON.parse(probe.textContent) : null;
        } catch {
          return null;
        }
      })();
      const cameraProbe = (() => {
        const probe = document.querySelector("#ml-browser-camera-probe");
        try {
          return probe?.textContent ? JSON.parse(probe.textContent) : null;
        } catch {
          return null;
        }
      })();
      const sceneVisibleFraction = (() => {
        const scene = cameraProbe?.sceneViewportCss;
        if (!scene || scene.width <= 0 || scene.height <= 0) {
          return null;
        }
        const mapRect = {
          bottom: scene.y + scene.height,
          left: scene.x,
          right: scene.x + scene.width,
          top: scene.y,
        };
        const blockers = [rightStackRect, dockRootRect]
          .filter(Boolean)
          .map((rect) => ({
            bottom: Math.min(rect.bottom, mapRect.bottom),
            left: Math.max(rect.left, mapRect.left),
            right: Math.min(rect.right, mapRect.right),
            top: Math.max(rect.top, mapRect.top),
          }))
          .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
        const xs = [...new Set([
          mapRect.left,
          mapRect.right,
          ...blockers.flatMap((rect) => [rect.left, rect.right]),
        ])].sort((a, b) => a - b);
        const ys = [...new Set([
          mapRect.top,
          mapRect.bottom,
          ...blockers.flatMap((rect) => [rect.top, rect.bottom]),
        ])].sort((a, b) => a - b);
        let blockedArea = 0;
        for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
          for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
            const left = xs[xIndex];
            const right = xs[xIndex + 1];
            const top = ys[yIndex];
            const bottom = ys[yIndex + 1];
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;
            if (blockers.some((rect) =>
              centerX >= rect.left && centerX <= rect.right &&
              centerY >= rect.top && centerY <= rect.bottom
            )) {
              blockedArea += (right - left) * (bottom - top);
            }
          }
        }
        return Number((1 - blockedArea / (scene.width * scene.height)).toFixed(4));
      })();
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
        dockRoot: rectData(dockRootRect),
        commandRail: commandRail ? {
          clientHeight: commandRail.clientHeight,
          overflowY: window.getComputedStyle(commandRail).overflowY,
          scrollTop: commandRail.scrollTop,
          scrollHeight: commandRail.scrollHeight
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
        decisionArtifactCount: decisionArtifacts.length,
        decisionDetailsOpen: decisionDetails?.open ?? null,
        decisionFieldCounts,
        decisionFieldGeometry,
        latestMeaningfulConversationBubble:
          latestMeaningfulConversationBubbleRect
            ? {
                fullyVisible: latestMeaningfulConversationBubbleFullyVisible,
                rect: rectData(latestMeaningfulConversationBubbleRect),
                text:
                  latestMeaningfulConversationBubble?.textContent
                    ?.replace(/\\s+/g, " ")
                    .trim() ?? "",
                visibleRect: rectData(
                  latestMeaningfulConversationBubbleVisibleRect,
                ),
              }
            : null,
        liveConversationTranscript: liveConversationTranscript
          ? {
              clientHeight: liveConversationTranscript.clientHeight,
              overflowY: window.getComputedStyle(liveConversationTranscript)
                .overflowY,
              scrollHeight: liveConversationTranscript.scrollHeight,
              scrollTop: liveConversationTranscript.scrollTop,
            }
          : null,
        liveConversationWorkspace: liveConversationWorkspace
          ? rectData(liveConversationWorkspace.getBoundingClientRect())
          : null,
        railNarrative: {
          decisionChoice:
            decisionChoice?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          next:
            nextStoryCard?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
          passiveWatchStatus:
            passiveWatchStatus?.textContent?.replace(/\\s+/g, " ").trim() ?? "",
        },
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
        cameraActiveSpaceId: cameraProbe?.activeSpaceId ?? null,
        cameraActiveSpaceKind: cameraProbe?.activeSpaceKind ?? null,
        sceneVisibleFraction,
        sceneViewportCss: cameraProbe?.sceneViewportCss ?? null,
        npcPresence,
        timePill: timePillRect ? {
          bottom: Math.round(timePillRect.bottom),
          height: Math.round(timePillRect.height),
          width: Math.round(timePillRect.width),
          x: Math.round(timePillRect.x),
          y: Math.round(timePillRect.y)
        } : null,
        timePillComputedStyle: computedVisualStyle(timePill),
        visibleTimeChips,
        visibleTimeChipStyles,
        visibleTimeGlyphStyles,
        visibleUiTextRegions,
        visualHierarchy,
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
    const developmentOverlay = await this.evaluate(`(() => {
      const isVisible = (element) => {
        if (!(element instanceof Element)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" && style.visibility !== "hidden" &&
          Number.parseFloat(style.opacity || "1") > 0.01;
      };
      const roots = Array.from(document.querySelectorAll("nextjs-portal"))
        .map((portal) => portal.shadowRoot)
        .filter(Boolean);
      return {
        portalCount: roots.length,
        visibleErrorCount: roots.reduce(
          (count, root) => count + Array.from(
            root.querySelectorAll("[data-nextjs-dialog-overlay],[data-nextjs-dialog]"),
          ).filter(isVisible).length,
          0,
        ),
        visibleIndicatorCount: roots.filter((root) =>
          isVisible(root.getElementById("data-devtools-indicator")),
        ).length,
        visiblePanelCount: roots.filter((root) =>
          isVisible(root.getElementById("panel-route")),
        ).length,
      };
    })()`);
    assert.equal(
      developmentOverlay.visibleErrorCount,
      0,
      `Next.js error UI is visible before screenshot capture: ${JSON.stringify(developmentOverlay)}.`,
    );
    assert.deepEqual(
      {
        visibleIndicatorCount: developmentOverlay.visibleIndicatorCount,
        visiblePanelCount: developmentOverlay.visiblePanelCount,
      },
      { visibleIndicatorCount: 0, visiblePanelCount: 0 },
      `Next.js development UI would contaminate the screenshot: ${JSON.stringify(developmentOverlay)}.`,
    );
    await this.evaluate(`new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const pill = document.querySelector(".ml-time-pill");
          pill?.getBoundingClientRect();
          for (const chip of pill?.querySelectorAll(".ml-time-chip") ?? []) {
            chip.getBoundingClientRect();
            window.getComputedStyle(chip).opacity;
          }
          resolve(true);
        });
      });
    })`);
    await this.send("Page.getLayoutMetrics");
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

function assertHudScreenshotPixels(
  buffer,
  page,
  viewport,
  label,
  image = decodePngPixels(buffer),
) {
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  assert.ok(
    page.visibleTimeGlyphStyles?.length >= 5,
    `${label}: missing tight HUD glyph geometry for pixel validation.`,
  );

  const runDiagnostics = page.visibleTimeGlyphStyles.map((run) => {
    const rect = run.rect;
    assert.ok(rect, `${label}: HUD text run ${run.text} has no glyph rectangle.`);
    const left = clamp(Math.floor(rect.left * scaleX), 0, image.width);
    const right = clamp(Math.ceil(rect.right * scaleX), left, image.width);
    const top = clamp(Math.floor(rect.top * scaleY), 0, image.height);
    const bottom = clamp(Math.ceil(rect.bottom * scaleY), top, image.height);
    let brightPixels = 0;
    let sampledPixels = 0;
    const nonSpaceCharacters = run.text.replace(/\s+/g, "").length;
    const horizontalBinCount = clamp(
      Math.ceil(nonSpaceCharacters / 2),
      2,
      8,
    );
    const horizontalBins = new Uint16Array(horizontalBinCount);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * image.width + x) * image.channels;
        const red = image.pixels[offset];
        const green = image.pixels[offset + 1] ?? red;
        const blue = image.pixels[offset + 2] ?? red;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        if (luminance >= 90) {
          brightPixels += 1;
          const relativeX = right > left ? (x - left) / (right - left) : 0;
          horizontalBins[
            clamp(Math.floor(relativeX * horizontalBinCount), 0, horizontalBinCount - 1)
          ] += 1;
        }
        sampledPixels += 1;
      }
    }
    const minimumBrightPixels = Math.max(
      5 * nonSpaceCharacters * scaleX * scaleY,
      sampledPixels * 0.035,
    );
    const minimumPixelsPerActiveBin = Math.max(2, Math.floor(2 * scaleX * scaleY));
    const activeHorizontalBins = [...horizontalBins].filter(
      (count) => count >= minimumPixelsPerActiveBin,
    ).length;
    const minimumActiveHorizontalBins = Math.ceil(horizontalBinCount * 0.75);
    assert.ok(
      brightPixels >= minimumBrightPixels,
      `${label}: HUD text run "${run.text}" in chip "${run.chipText}" is visually blank or incomplete (${brightPixels} bright glyph pixels, expected >= ${minimumBrightPixels.toFixed(1)}).`,
    );
    assert.ok(
      activeHorizontalBins >= minimumActiveHorizontalBins,
      `${label}: HUD text run "${run.text}" in chip "${run.chipText}" is only partially painted (${activeHorizontalBins}/${horizontalBinCount} active horizontal glyph bins, expected >= ${minimumActiveHorizontalBins}).`,
    );
    return {
      activeHorizontalBins,
      brightPixels,
      chipIndex: run.chipIndex,
      chipText: run.chipText,
      horizontalBinCount,
      minimumActiveHorizontalBins,
      minimumBrightPixels: Number(minimumBrightPixels.toFixed(1)),
      rect,
      text: run.text,
    };
  });

  return page.visibleTimeChipStyles.map((chip, chipIndex) => ({
    chipIndex,
    text: chip.text,
    runs: runDiagnostics.filter((run) => run.chipIndex === chipIndex),
  }));
}

function assertVisibleUiTextPixels(
  buffer,
  page,
  viewport,
  label,
  image = decodePngPixels(buffer),
) {
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const regions = page.visibleUiTextRegions ?? [];
  assert.ok(
    regions.length >= 5,
    `${label}: expected tight visible rail/dock text runs for screenshot validation.`,
  );
  const surfaces = new Set(regions.map((region) => region.surface));
  assert.ok(
    surfaces.has("rail") && surfaces.has("dock"),
    `${label}: screenshot validation requires both rail and dock glyph runs; found ${JSON.stringify([...surfaces])}.`,
  );

  const diagnostics = [];
  for (const region of regions) {
    const rect = region.rect;
    assert.ok(rect, `${label}: UI text region ${region.text} has no rectangle.`);
    const left = clamp(Math.floor(rect.left * scaleX), 0, image.width);
    const right = clamp(Math.ceil(rect.right * scaleX), left, image.width);
    const top = clamp(Math.floor(rect.top * scaleY), 0, image.height);
    const bottom = clamp(Math.ceil(rect.bottom * scaleY), top, image.height);
    let brightPixels = 0;
    let sampledPixels = 0;
    const nonSpaceCharacters = region.text.replace(/\s+/g, "").length;
    const horizontalBinCount = clamp(
      Math.ceil(nonSpaceCharacters / 3),
      2,
      8,
    );
    const horizontalBins = new Uint16Array(horizontalBinCount);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const pixelOffset = (y * image.width + x) * image.channels;
        const red = image.pixels[pixelOffset];
        const green = image.pixels[pixelOffset + 1] ?? red;
        const blue = image.pixels[pixelOffset + 2] ?? red;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        if (luminance >= 70) {
          brightPixels += 1;
          const relativeX = right > left ? (x - left) / (right - left) : 0;
          horizontalBins[
            clamp(Math.floor(relativeX * horizontalBinCount), 0, horizontalBinCount - 1)
          ] += 1;
        }
        sampledPixels += 1;
      }
    }
    const minimumBrightPixels = Math.max(
      4 * Math.max(scaleX, scaleY),
      2 * nonSpaceCharacters * scaleX * scaleY,
      sampledPixels * 0.012,
    );
    const minimumPixelsPerActiveBin = Math.max(
      2,
      Math.floor(2 * scaleX * scaleY),
    );
    const activeHorizontalBins = [...horizontalBins].filter(
      (count) => count >= minimumPixelsPerActiveBin,
    ).length;
    const minimumActiveHorizontalBins = Math.ceil(horizontalBinCount * 0.6);
    assert.ok(
      brightPixels >= minimumBrightPixels,
      `${label}: visible rail/dock text region "${region.text.slice(0, 48)}" is blank in the screenshot (${brightPixels} bright pixels, expected >= ${minimumBrightPixels.toFixed(1)}).`,
    );
    assert.ok(
      activeHorizontalBins >= minimumActiveHorizontalBins,
      `${label}: visible rail/dock text run "${region.text.slice(0, 48)}" is only partially painted (${activeHorizontalBins}/${horizontalBinCount} active horizontal glyph bins, expected >= ${minimumActiveHorizontalBins}).`,
    );
    diagnostics.push({
      activeHorizontalBins,
      brightPixels,
      horizontalBinCount,
      minimumActiveHorizontalBins,
      minimumBrightPixels: Number(minimumBrightPixels.toFixed(1)),
      rect,
      surface: region.surface,
      text: region.text,
    });
  }
  return diagnostics;
}

function assertNoLargeNearBlackDropout(
  buffer,
  viewport,
  label,
  image = decodePngPixels(buffer),
) {
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const width = viewport.width;
  const height = viewport.height;
  const nearBlack = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(Math.floor((y + 0.5) * scaleY), 0, image.height - 1);
    for (let x = 0; x < width; x += 1) {
      const sourceX = clamp(Math.floor((x + 0.5) * scaleX), 0, image.width - 1);
      const pixelOffset = (sourceY * image.width + sourceX) * image.channels;
      const red = image.pixels[pixelOffset];
      const green = image.pixels[pixelOffset + 1] ?? red;
      const blue = image.pixels[pixelOffset + 2] ?? red;
      nearBlack[y * width + x] = Math.max(red, green, blue) <= 6 ? 1 : 0;
    }
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
        if (
          neighbor >= 0 &&
          nearBlack[neighbor] &&
          !visited[neighbor]
        ) {
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
  return largest;
}

function assertScreenshotVisualIntegrity(buffer, page, viewport, label) {
  assertPngScreenshot(buffer, viewport);
  const image = decodePngPixels(buffer);
  const hudChipDiagnostics = assertHudScreenshotPixels(
    buffer,
    page,
    viewport,
    label,
    image,
  );
  const uiTextDiagnostics = assertVisibleUiTextPixels(
    buffer,
    page,
    viewport,
    label,
    image,
  );
  const largestNearBlackComponent = assertNoLargeNearBlackDropout(
    buffer,
    viewport,
    label,
    image,
  );
  return { hudChipDiagnostics, largestNearBlackComponent, uiTextDiagnostics };
}

function assertEastWaterfrontCompositionPixels(
  buffer,
  camera,
  page,
  viewport,
  label,
) {
  const image = decodePngPixels(buffer);
  const scene = page.sceneViewportCss;
  const worldView = camera?.renderedWorldView;
  assert.ok(scene && worldView, `${label}: missing camera geometry for waterfront validation.`);

  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const blockers = [page.rightStack, page.dockRoot]
    .map(normalizePageRect)
    .filter(Boolean);
  const diagnostics = [];

  for (const bay of EAST_WATERFRONT_MOORING_BAYS) {
    const cssRect = {
      bottom:
        scene.y +
        ((bay.bottom - worldView.top) / worldView.height) * scene.height,
      left:
        scene.x +
        ((bay.left - worldView.left) / worldView.width) * scene.width,
      right:
        scene.x +
        ((bay.right - worldView.left) / worldView.width) * scene.width,
      top:
        scene.y +
        ((bay.top - worldView.top) / worldView.height) * scene.height,
    };
    const sample = {
      bottom: Math.min(cssRect.bottom, scene.y + scene.height),
      left: Math.max(cssRect.left, scene.x),
      right: Math.min(cssRect.right, scene.x + scene.width),
      top: Math.max(cssRect.top, scene.y),
    };
    if (sample.right - sample.left < 24 || sample.bottom - sample.top < 18) {
      continue;
    }
    const anchor = {
      x:
        scene.x +
        ((bay.anchorX - worldView.left) / worldView.width) * scene.width,
      y:
        scene.y +
        ((bay.anchorY - worldView.top) / worldView.height) * scene.height,
    };
    if (
      anchor.x < scene.x ||
      anchor.x > scene.x + scene.width ||
      anchor.y < scene.y ||
      anchor.y > scene.y + scene.height ||
      blockers.some(
        (blocker) =>
          anchor.x >= blocker.left &&
          anchor.x <= blocker.right &&
          anchor.y >= blocker.top &&
          anchor.y <= blocker.bottom,
      )
    ) {
      continue;
    }

    const materialBins = new Uint16Array(4);
    const colorBins = new Map();
    let darkHardwarePixels = 0;
    let groundedMaterialPixels = 0;
    let maximumLuminance = 0;
    let minimumLuminance = 255;
    let paleSlabPixels = 0;
    let sampledPixels = 0;
    let totalBlue = 0;
    let totalGreen = 0;
    let totalRed = 0;
    let transitionPixels = 0;

    for (
      let sourceY = Math.floor(sample.top * scaleY);
      sourceY < Math.ceil(sample.bottom * scaleY);
      sourceY += 1
    ) {
      let previousColor = null;
      for (
        let sourceX = Math.floor(sample.left * scaleX);
        sourceX < Math.ceil(sample.right * scaleX);
        sourceX += 1
      ) {
        const cssX = (sourceX + 0.5) / scaleX;
        const cssY = (sourceY + 0.5) / scaleY;
        if (
          blockers.some(
            (blocker) =>
              cssX >= blocker.left &&
              cssX <= blocker.right &&
              cssY >= blocker.top &&
              cssY <= blocker.bottom,
          )
        ) {
          previousColor = null;
          continue;
        }

        const offset = (sourceY * image.width + sourceX) * image.channels;
        const red = image.pixels[offset];
        const green = image.pixels[offset + 1] ?? red;
        const blue = image.pixels[offset + 2] ?? red;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const groundedMaterial =
          luminance >= 48 &&
          luminance <= 165 &&
          ((red - green >= 4 && green - blue >= 2) || chroma <= 38);
        const paleSlab =
          luminance >= 148 &&
          red >= 160 &&
          green >= 142 &&
          blue >= 112 &&
          chroma <= 78;
        const darkHardware =
          (red >= 52 &&
            red <= 124 &&
            green >= 42 &&
            green <= 104 &&
            blue >= 32 &&
            blue <= 88 &&
            red - green >= 4 &&
            red - green <= 28 &&
            green - blue >= 2 &&
            green - blue <= 26) ||
          (red >= 48 &&
            red <= 150 &&
            green >= 58 &&
            green <= 160 &&
            blue >= 64 &&
            blue <= 170 &&
            green - red >= 3 &&
            blue - red >= 7 &&
            blue - green >= -5 &&
            blue - green <= 28);

        sampledPixels += 1;
        totalBlue += blue;
        totalGreen += green;
        totalRed += red;
        minimumLuminance = Math.min(minimumLuminance, luminance);
        maximumLuminance = Math.max(maximumLuminance, luminance);
        const colorBinKey = `${red >> 4}:${green >> 4}:${blue >> 4}`;
        colorBins.set(colorBinKey, (colorBins.get(colorBinKey) ?? 0) + 1);
        if (groundedMaterial) {
          groundedMaterialPixels += 1;
          const relativeX =
            sample.right > sample.left
              ? (cssX - sample.left) / (sample.right - sample.left)
              : 0;
          materialBins[
            clamp(
              Math.floor(relativeX * materialBins.length),
              0,
              materialBins.length - 1,
            )
          ] += 1;
        }
        if (paleSlab) {
          paleSlabPixels += 1;
        }
        if (darkHardware) {
          darkHardwarePixels += 1;
        }
        if (
          previousColor &&
          Math.abs(red - previousColor.red) +
            Math.abs(green - previousColor.green) +
            Math.abs(blue - previousColor.blue) >=
            34
        ) {
          transitionPixels += 1;
        }
        previousColor = { blue, green, red };
      }
    }

    if (sampledPixels < 100) {
      continue;
    }

    const groundedMaterialFraction = groundedMaterialPixels / sampledPixels;
    const minimumMaterialPixelsPerBin = Math.max(
      4,
      Math.floor(sampledPixels * 0.006),
    );
    const activeMaterialBins = [...materialBins].filter(
      (count) => count >= minimumMaterialPixelsPerBin,
    ).length;
    const luminanceRange = maximumLuminance - minimumLuminance;
    const minimumDarkHardwarePixels = Math.max(
      6,
      Math.floor(sampledPixels * 0.003),
    );
    const minimumColorBinPixels = Math.max(4, Math.floor(sampledPixels * 0.004));
    const activeColorBins = [...colorBins.values()].filter(
      (count) => count >= minimumColorBinPixels,
    ).length;
    const [dominantColorKey, dominantColorPixels] = [...colorBins.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    const dominantColorFraction = dominantColorPixels / sampledPixels;
    const paleSlabFraction = paleSlabPixels / sampledPixels;
    const transitionFraction = transitionPixels / sampledPixels;
    const meanColor = {
      blue: totalBlue / sampledPixels,
      green: totalGreen / sampledPixels,
      red: totalRed / sampledPixels,
    };

    assert.ok(
      groundedMaterialFraction >= 0.32 && activeMaterialBins >= 3,
      `${label}: ${bay.id} east-waterfront bay lacks a broad grounded dock material (${groundedMaterialFraction.toFixed(3)} material fraction, ${activeMaterialBins}/4 active horizontal bands).`,
    );
    assert.ok(
      darkHardwarePixels >= minimumDarkHardwarePixels,
      `${label}: ${bay.id} east-waterfront bay lacks readable mooring hardware (${darkHardwarePixels} pixels, expected >= ${minimumDarkHardwarePixels}).`,
    );
    assert.ok(
      luminanceRange >= 48,
      `${label}: ${bay.id} east-waterfront bay is visually flat (${luminanceRange.toFixed(1)} luminance range).`,
    );
    assert.ok(
      paleSlabFraction <= 0.34,
      `${label}: ${bay.id} east-waterfront bay regressed to a pale slab (${paleSlabFraction.toFixed(3)} pale fraction).`,
    );
    assert.ok(
      activeColorBins >= 5 && dominantColorFraction <= 0.72,
      `${label}: ${bay.id} east-waterfront bay lacks material variation (${activeColorBins} active colors, ${dominantColorFraction.toFixed(3)} dominant fraction).`,
    );
    assert.ok(
      transitionFraction >= 0.012,
      `${label}: ${bay.id} east-waterfront bay lacks working-surface detail (${transitionFraction.toFixed(3)} transition fraction).`,
    );

    diagnostics.push({
      activeColorBins,
      activeMaterialBins,
      bay: bay.id,
      darkHardwarePixels,
      dominantColorFraction: Number(dominantColorFraction.toFixed(3)),
      dominantColorKey,
      groundedMaterialFraction: Number(groundedMaterialFraction.toFixed(3)),
      luminanceRange: Number(luminanceRange.toFixed(1)),
      meanColor: Object.fromEntries(
        Object.entries(meanColor).map(([channel, value]) => [
          channel,
          Number(value.toFixed(1)),
        ]),
      ),
      paleSlabFraction: Number(paleSlabFraction.toFixed(3)),
      sample,
      sampledPixels,
      transitionFraction: Number(transitionFraction.toFixed(3)),
    });
  }

  assert.ok(
    diagnostics.length >= 1,
    `${label}: no unobscured east-waterfront mooring bay was available for screenshot validation.`,
  );
  eastWaterfrontCompositionDiagnostics.push({ bays: diagnostics, label });
  return diagnostics;
}

function assertEastWaterfrontBayCoverage(diagnostics, viewportName) {
  const bestByBay = new Map();
  for (const diagnostic of diagnostics) {
    const current = bestByBay.get(diagnostic.bay);
    if (!current || diagnostic.sampledPixels > current.sampledPixels) {
      bestByBay.set(diagnostic.bay, diagnostic);
    }
  }
  const missingBays = EAST_WATERFRONT_MOORING_BAYS.filter(
    (bay) => !bestByBay.has(bay.id),
  ).map((bay) => bay.id);
  assert.deepEqual(
    missingBays,
    [],
    `${viewportName}: matched east/south captures did not validate every authored east-waterfront bay.`,
  );

  const bays = EAST_WATERFRONT_MOORING_BAYS.map((bay) => bestByBay.get(bay.id));
  const dominantColors = new Set(bays.map((bay) => bay.dominantColorKey));
  assert.ok(
    dominantColors.size >= 2,
    `${viewportName}: east-waterfront bays regressed to one repeated material signature (${[...dominantColors].join(", ")}).`,
  );
  let minimumPairwiseColorDistance = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < bays.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bays.length; rightIndex += 1) {
      const left = bays[leftIndex].meanColor;
      const right = bays[rightIndex].meanColor;
      minimumPairwiseColorDistance = Math.min(
        minimumPairwiseColorDistance,
        Math.hypot(
          left.red - right.red,
          left.green - right.green,
          left.blue - right.blue,
        ),
      );
    }
  }
  assert.ok(
    minimumPairwiseColorDistance >= 5,
    `${viewportName}: east-waterfront bays are mechanically repeated (${minimumPairwiseColorDistance.toFixed(1)} minimum mean-color distance).`,
  );
  return {
    bays,
    dominantColorCount: dominantColors.size,
    minimumPairwiseColorDistance: Number(minimumPairwiseColorDistance.toFixed(1)),
    viewportName,
  };
}

function sampleWorldCompositionRegion(
  buffer,
  camera,
  page,
  viewport,
  worldRegion,
  label,
) {
  const image = decodePngPixels(buffer);
  const scene = page.sceneViewportCss;
  const worldView = camera?.renderedWorldView;
  assert.ok(
    scene && worldView,
    `${label}: missing camera geometry for fringe composition validation.`,
  );

  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const blockers = [page.rightStack, page.dock ?? page.dockRoot]
    .map(normalizePageRect)
    .filter(Boolean);
  const cssRect = {
    bottom:
      scene.y +
      ((worldRegion.bottom - worldView.top) / worldView.height) * scene.height,
    left:
      scene.x +
      ((worldRegion.left - worldView.left) / worldView.width) * scene.width,
    right:
      scene.x +
      ((worldRegion.right - worldView.left) / worldView.width) * scene.width,
    top:
      scene.y +
      ((worldRegion.top - worldView.top) / worldView.height) * scene.height,
  };
  const sample = {
    bottom: Math.min(cssRect.bottom, scene.y + scene.height),
    left: Math.max(cssRect.left, scene.x),
    right: Math.min(cssRect.right, scene.x + scene.width),
    top: Math.max(cssRect.top, scene.y),
  };
  assert.ok(
    sample.right - sample.left >= 36 && sample.bottom - sample.top >= 24,
    `${label}: authored fringe sample is not visibly available (${JSON.stringify(sample)}).`,
  );

  const colorBins = new Map();
  let darkMaterialPixels = 0;
  let coolUtilityPixels = 0;
  let greenMaterialPixels = 0;
  let maximumLuminance = 0;
  let minimumLuminance = 255;
  let paleVoidPixels = 0;
  let sampledPixels = 0;
  let transitionPixels = 0;
  let warmDetailPixels = 0;
  let waterMaterialPixels = 0;

  for (
    let sourceY = Math.floor(sample.top * scaleY);
    sourceY < Math.ceil(sample.bottom * scaleY);
    sourceY += 1
  ) {
    let previousColor = null;
    for (
      let sourceX = Math.floor(sample.left * scaleX);
      sourceX < Math.ceil(sample.right * scaleX);
      sourceX += 1
    ) {
      const cssX = (sourceX + 0.5) / scaleX;
      const cssY = (sourceY + 0.5) / scaleY;
      if (
        blockers.some(
          (blocker) =>
            cssX >= blocker.left &&
            cssX <= blocker.right &&
            cssY >= blocker.top &&
            cssY <= blocker.bottom,
        )
      ) {
        previousColor = null;
        continue;
      }

      const offset = (sourceY * image.width + sourceX) * image.channels;
      const red = image.pixels[offset];
      const green = image.pixels[offset + 1] ?? red;
      const blue = image.pixels[offset + 2] ?? red;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const binKey = `${red >> 4}:${green >> 4}:${blue >> 4}`;

      sampledPixels += 1;
      minimumLuminance = Math.min(minimumLuminance, luminance);
      maximumLuminance = Math.max(maximumLuminance, luminance);
      colorBins.set(binKey, (colorBins.get(binKey) ?? 0) + 1);
      if (
        red >= 188 &&
        green >= 178 &&
        blue >= 154 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) <= 58
      ) {
        paleVoidPixels += 1;
      }
      if (
        luminance >= 38 &&
        luminance <= 148 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) <= 78
      ) {
        darkMaterialPixels += 1;
      }
      if (
        red >= 62 &&
        red <= 176 &&
        green >= red - 2 &&
        blue >= red + 7 &&
        blue - red <= 58
      ) {
        coolUtilityPixels += 1;
      }
      if (
        green >= 62 &&
        green <= 180 &&
        green - red >= 7 &&
        green - blue >= 10
      ) {
        greenMaterialPixels += 1;
      }
      if (
        red >= 112 &&
        green >= 67 &&
        blue <= 166 &&
        red - blue >= 20 &&
        red - green >= 5
      ) {
        warmDetailPixels += 1;
      }
      if (
        red <= 98 &&
        green >= 58 &&
        green <= 154 &&
        blue >= 82 &&
        blue - red >= 24 &&
        blue - green >= 8
      ) {
        waterMaterialPixels += 1;
      }
      if (
        previousColor &&
        Math.abs(red - previousColor.red) +
          Math.abs(green - previousColor.green) +
          Math.abs(blue - previousColor.blue) >=
          42
      ) {
        transitionPixels += 1;
      }
      previousColor = { blue, green, red };
    }
  }

  assert.ok(
    sampledPixels >= 800,
    `${label}: too few unobscured pixels were available (${sampledPixels}).`,
  );
  const minimumBinPixels = Math.max(6, Math.floor(sampledPixels * 0.002));
  const activeColorBins = [...colorBins.values()].filter(
    (count) => count >= minimumBinPixels,
  ).length;
  const dominantColorFraction =
    Math.max(...colorBins.values()) / sampledPixels;
  return {
    activeColorBins,
    coolUtilityFraction: coolUtilityPixels / sampledPixels,
    darkMaterialFraction: darkMaterialPixels / sampledPixels,
    dominantColorFraction,
    greenMaterialFraction: greenMaterialPixels / sampledPixels,
    luminanceRange: maximumLuminance - minimumLuminance,
    paleVoidFraction: paleVoidPixels / sampledPixels,
    sample,
    sampledPixels,
    transitionFraction: transitionPixels / sampledPixels,
    warmDetailFraction: warmDetailPixels / sampledPixels,
    waterMaterialFraction: waterMaterialPixels / sampledPixels,
  };
}

function assertNorthFringeCompositionPixels(
  buffer,
  camera,
  page,
  viewport,
  label,
) {
  const diagnostics = sampleWorldCompositionRegion(
    buffer,
    camera,
    page,
    viewport,
    NORTH_FRINGE_WORLD_REGION,
    label,
  );
  const minimumTransitionFraction =
    0.018 / (viewport.deviceScaleFactor ?? 1);
  assert.ok(
    diagnostics.activeColorBins >= 14,
    `${label}: north fringe lacks material variety (${diagnostics.activeColorBins} active bins).`,
  );
  assert.ok(
    diagnostics.darkMaterialFraction >= 0.34,
    `${label}: north fringe lacks a broad neighboring-facade read (${diagnostics.darkMaterialFraction.toFixed(3)} dark material).`,
  );
  assert.ok(
    diagnostics.warmDetailFraction >= 0.012,
    `${label}: north fringe lost its windows, doors, and warm service details (${diagnostics.warmDetailFraction.toFixed(3)} warm detail).`,
  );
  assert.ok(
    diagnostics.paleVoidFraction <= 0.22,
    `${label}: north fringe regressed to pale unfinished slabs (${diagnostics.paleVoidFraction.toFixed(3)} pale fraction).`,
  );
  assert.ok(
    diagnostics.luminanceRange >= 72 &&
      diagnostics.transitionFraction >= minimumTransitionFraction &&
      diagnostics.dominantColorFraction <= 0.46,
    `${label}: north fringe is visually flat (${diagnostics.luminanceRange.toFixed(1)} luminance range, ${diagnostics.transitionFraction.toFixed(3)} transitions, ${diagnostics.dominantColorFraction.toFixed(3)} dominant color).`,
  );
  fringeCompositionDiagnostics.push({
    ...diagnostics,
    label,
    region: "north-fringe",
  });
}

function assertWestOpenLotCompositionPixels(
  buffer,
  camera,
  page,
  viewport,
  label,
) {
  const diagnostics = sampleWorldCompositionRegion(
    buffer,
    camera,
    page,
    viewport,
    WEST_OPEN_LOT_WORLD_REGION,
    label,
  );
  const minimumTransitionFraction =
    0.022 / (viewport.deviceScaleFactor ?? 1);
  assert.ok(
    diagnostics.activeColorBins >= 16,
    `${label}: west open lot lacks authored material variety (${diagnostics.activeColorBins} active bins).`,
  );
  assert.ok(
    diagnostics.greenMaterialFraction >= 0.045 &&
      diagnostics.greenMaterialFraction <= 0.7,
    `${label}: west open lot no longer preserves restrained planted ground around the working yard (${diagnostics.greenMaterialFraction.toFixed(3)} green material).`,
  );
  assert.ok(
    diagnostics.warmDetailFraction >= 0.05,
    `${label}: west open lot lost its beds, workbench, storage, and service props (${diagnostics.warmDetailFraction.toFixed(3)} warm detail).`,
  );
  assert.ok(
    diagnostics.luminanceRange >= 68 &&
      diagnostics.transitionFraction >= minimumTransitionFraction &&
      diagnostics.dominantColorFraction <= 0.46,
    `${label}: west open lot regressed to a flat empty rectangle (${diagnostics.luminanceRange.toFixed(1)} luminance range, ${diagnostics.transitionFraction.toFixed(3)} transitions, ${diagnostics.dominantColorFraction.toFixed(3)} dominant color).`,
  );
  fringeCompositionDiagnostics.push({
    ...diagnostics,
    label,
    region: "west-open-lot",
  });
}

function assertMorrowYardCompositionPixels(
  buffer,
  camera,
  page,
  viewport,
  label,
) {
  const diagnostics = sampleWorldCompositionRegion(
    buffer,
    camera,
    page,
    viewport,
    MORROW_YARD_WORLD_REGION,
    label,
  );
  const minimumTransitionFraction =
    0.018 / (viewport.deviceScaleFactor ?? 1);
  assert.ok(
    diagnostics.activeColorBins >= 16 &&
      diagnostics.dominantColorFraction <= 0.48,
    `${label}: Morrow Yard regressed to a flat generic ground slab (${diagnostics.activeColorBins} active bins, ${diagnostics.dominantColorFraction.toFixed(3)} dominant color).`,
  );
  assert.ok(
    diagnostics.greenMaterialFraction >= 0.035 &&
      diagnostics.greenMaterialFraction <= 0.38,
    `${label}: Morrow Yard no longer balances a restrained planted strip with dominant service hardstanding (${diagnostics.greenMaterialFraction.toFixed(3)} green material).`,
  );
  assert.ok(
    diagnostics.coolUtilityFraction >= 0.018 &&
      diagnostics.warmDetailFraction >= 0.06,
    `${label}: Morrow Yard lost readable pump, wash, laundry, workbench, or storage cues (${diagnostics.coolUtilityFraction.toFixed(3)} cool utility, ${diagnostics.warmDetailFraction.toFixed(3)} warm detail).`,
  );
  assert.ok(
    diagnostics.luminanceRange >= 64 &&
      diagnostics.transitionFraction >= minimumTransitionFraction,
    `${label}: Morrow Yard lacks authored service-yard contrast/detail (${diagnostics.luminanceRange.toFixed(1)} luminance range, ${diagnostics.transitionFraction.toFixed(3)} transitions).`,
  );
  secondaryLandmarkCompositionDiagnostics.push({
    ...diagnostics,
    label,
    region: "morrow-yard",
  });
}

function assertPilgrimSlipCompositionPixels(
  buffer,
  camera,
  page,
  viewport,
  label,
) {
  const diagnostics = sampleWorldCompositionRegion(
    buffer,
    camera,
    page,
    viewport,
    PILGRIM_SLIP_WORLD_REGION,
    label,
  );
  const minimumTransitionFraction =
    0.016 / (viewport.deviceScaleFactor ?? 1);
  assert.ok(
    diagnostics.activeColorBins >= 16 &&
      diagnostics.dominantColorFraction <= 0.5,
    `${label}: Pilgrim Slip regressed to a featureless dock slab (${diagnostics.activeColorBins} active bins, ${diagnostics.dominantColorFraction.toFixed(3)} dominant color).`,
  );
  assert.ok(
    diagnostics.warmDetailFraction >= 0.16 &&
      diagnostics.waterMaterialFraction >= 0.08,
    `${label}: Pilgrim Slip lost its timber deck or visible water-contact channels (${diagnostics.warmDetailFraction.toFixed(3)} timber detail, ${diagnostics.waterMaterialFraction.toFixed(3)} water material).`,
  );
  assert.ok(
    diagnostics.darkMaterialFraction >= 0.1 &&
      diagnostics.coolUtilityFraction >= 0.012,
    `${label}: Pilgrim Slip lost readable mooring and ladder hardware (${diagnostics.darkMaterialFraction.toFixed(3)} dark hardware/material, ${diagnostics.coolUtilityFraction.toFixed(3)} cool utility).`,
  );
  assert.ok(
    diagnostics.luminanceRange >= 62 &&
      diagnostics.transitionFraction >= minimumTransitionFraction,
    `${label}: Pilgrim Slip lacks authored harbor contrast/detail (${diagnostics.luminanceRange.toFixed(1)} luminance range, ${diagnostics.transitionFraction.toFixed(3)} transitions).`,
  );
  secondaryLandmarkCompositionDiagnostics.push({
    ...diagnostics,
    label,
    region: "pilgrim-slip",
  });
}

function assertBoardingHouseInteriorCompositionPixels(
  buffer,
  page,
  viewport,
  label,
) {
  const image = decodePngPixels(buffer);
  const scene = page.sceneViewportCss;
  assert.ok(scene, `${label}: missing scene viewport for interior composition.`);
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const sceneBottom = scene.y + scene.height;
  const overlayTop = Math.min(
    page.rightStack?.y ?? sceneBottom,
    page.dockRoot?.y ?? sceneBottom,
  );
  const sample = {
    bottom: Math.min(sceneBottom - 12, overlayTop - 12),
    left: scene.x + 12,
    right: scene.x + scene.width - 12,
    top: scene.y + 12,
  };
  assert.ok(
    sample.bottom - sample.top >= Math.min(260, scene.height * 0.42),
    `${label}: overlays leave too little unobscured room for composition analysis: ${JSON.stringify(sample)}.`,
  );

  const columnCount = 8;
  const columns = Array.from({ length: columnCount }, () => ({
    authored: 0,
    sampled: 0,
  }));
  const sampleStep = Math.max(1, Math.floor(Math.min(scaleX, scaleY)));
  let authoredPixels = 0;
  let sampledPixels = 0;
  for (
    let sourceY = Math.floor(sample.top * scaleY);
    sourceY < Math.ceil(sample.bottom * scaleY);
    sourceY += sampleStep
  ) {
    for (
      let sourceX = Math.floor(sample.left * scaleX);
      sourceX < Math.ceil(sample.right * scaleX);
      sourceX += sampleStep
    ) {
      const offset = (sourceY * image.width + sourceX) * image.channels;
      const red = image.pixels[offset];
      const green = image.pixels[offset + 1] ?? red;
      const blue = image.pixels[offset + 2] ?? red;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const authored =
        luminance >= 50 &&
        red >= green * 1.05 &&
        green >= blue * 1.04;
      const cssX = sourceX / scaleX;
      const columnIndex = clamp(
        Math.floor(
          ((cssX - sample.left) / (sample.right - sample.left)) * columnCount,
        ),
        0,
        columnCount - 1,
      );
      columns[columnIndex].sampled += 1;
      sampledPixels += 1;
      if (authored) {
        columns[columnIndex].authored += 1;
        authoredPixels += 1;
      }
    }
  }

  const authoredFraction = authoredPixels / Math.max(sampledPixels, 1);
  const columnFractions = columns.map((column) =>
    Number((column.authored / Math.max(column.sampled, 1)).toFixed(3)),
  );
  assert.ok(
    authoredFraction >= 0.68,
    `${label}: authored boarding-house material covers only ${authoredFraction.toFixed(3)} of the unobscured room; expected at least 0.68. Columns: ${JSON.stringify(columnFractions)}.`,
  );
  assert.ok(
    columnFractions.every((fraction) => fraction >= 0.24),
    `${label}: the interior contains an unexplained empty/dark vertical band. Authored material by column: ${JSON.stringify(columnFractions)}.`,
  );

  const warmWash = findLargestWarmWashComponent(image, sample, scaleX, scaleY);
  const maximumWashWidth = scene.width * 0.26;
  const maximumWashHeight = (sample.bottom - sample.top) * 0.08;
  const warmWashAspectRatio =
    warmWash.width / Math.max(warmWash.height, 1);
  assert.ok(
    warmWash.width < maximumWashWidth ||
      warmWash.height < maximumWashHeight ||
      warmWash.areaFraction < 0.015 ||
      warmWashAspectRatio > 4 ||
      warmWash.fillRatio > 0.9,
    `${label}: an oversized low-detail warm wash still dominates the room: ${JSON.stringify({
      ...warmWash,
      maximumWashHeight: Number(maximumWashHeight.toFixed(1)),
      maximumWashWidth: Number(maximumWashWidth.toFixed(1)),
      warmWashAspectRatio: Number(warmWashAspectRatio.toFixed(2)),
    })}.`,
  );

  return {
    authoredFraction: Number(authoredFraction.toFixed(3)),
    columnFractions,
    sample,
    warmWash,
  };
}

function assertAuthoredInteriorIdentityPixels(
  buffer,
  page,
  viewport,
  role,
  label,
) {
  const image = decodePngPixels(buffer);
  const scene = normalizePageRect(page.sceneViewportCss);
  assert.ok(scene, `${label}: missing scene viewport for interior identity.`);
  const scaleX = image.width / viewport.width;
  const scaleY = image.height / viewport.height;
  const visibleAtCenter = getUnobscuredSceneBoundsAtX(
    page,
    (scene.left + scene.right) / 2,
  );
  const sample = {
    bottom: visibleAtCenter.bottom - 12,
    left: scene.left + 12,
    right: scene.right - 12,
    top: scene.top + 12,
  };
  assert.ok(
    sample.bottom - sample.top >=
      Math.min(220, (scene.bottom - scene.top) * 0.36),
    `${label}: overlays leave too little room for interior identity analysis: ${JSON.stringify({
      dockRoot: page.dockRoot,
      rightStack: page.rightStack,
      sample,
      scene,
      visibleAtCenter,
    })}.`,
  );

  const quantizedColors = new Map();
  const luminances = [];
  const sampleStep = Math.max(1, Math.floor(Math.min(scaleX, scaleY)));
  let coolMetalPixels = 0;
  let darkHardwarePixels = 0;
  let detailTransitions = 0;
  let domesticTextilePixels = 0;
  let goldAccentPixels = 0;
  let rustAccentPixels = 0;
  let sampledPixels = 0;
  let warmMaterialPixels = 0;

  for (
    let sourceY = Math.floor(sample.top * scaleY);
    sourceY < Math.ceil(sample.bottom * scaleY);
    sourceY += sampleStep
  ) {
    for (
      let sourceX = Math.floor(sample.left * scaleX);
      sourceX < Math.ceil(sample.right * scaleX);
      sourceX += sampleStep
    ) {
      const offset = (sourceY * image.width + sourceX) * image.channels;
      const red = image.pixels[offset];
      const green = image.pixels[offset + 1] ?? red;
      const blue = image.pixels[offset + 2] ?? red;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const colorKey = `${Math.floor(red / 24)}:${Math.floor(green / 24)}:${Math.floor(blue / 24)}`;
      quantizedColors.set(colorKey, (quantizedColors.get(colorKey) ?? 0) + 1);
      luminances.push(luminance);
      sampledPixels += 1;

      if (
        red >= green * 1.07 &&
        green >= blue * 1.06 &&
        luminance >= 48
      ) {
        warmMaterialPixels += 1;
      }
      if (
        green >= red * 0.92 &&
        blue >= red * 0.88 &&
        Math.abs(green - blue) <= 34 &&
        luminance >= 45 &&
        luminance <= 205
      ) {
        coolMetalPixels += 1;
      }
      if (luminance <= 72) {
        darkHardwarePixels += 1;
      }
      const mutedGreenTextile =
        green >= red * 1.01 &&
        green >= blue * 1.08 &&
        red >= 55 &&
        red <= 165 &&
        luminance >= 50 &&
        luminance <= 175;
      const wovenBurgundy =
        red >= 80 &&
        red <= 165 &&
        red >= green * 1.14 &&
        blue >= red * 0.55 &&
        blue <= green * 1.05 &&
        luminance >= 55 &&
        luminance <= 155;
      if (mutedGreenTextile || wovenBurgundy) {
        domesticTextilePixels += 1;
      }
      if (red >= 165 && green >= 105 && green >= blue * 1.22) {
        goldAccentPixels += 1;
      }
      if (red >= green * 1.16 && green >= blue * 1.04 && luminance >= 62) {
        rustAccentPixels += 1;
      }

      const compareX = sourceX + sampleStep * 2;
      if (compareX < Math.ceil(sample.right * scaleX)) {
        const compareOffset =
          (sourceY * image.width + compareX) * image.channels;
        const compareRed = image.pixels[compareOffset];
        const compareGreen = image.pixels[compareOffset + 1] ?? compareRed;
        const compareBlue = image.pixels[compareOffset + 2] ?? compareRed;
        const compareLuminance =
          compareRed * 0.2126 +
          compareGreen * 0.7152 +
          compareBlue * 0.0722;
        if (Math.abs(luminance - compareLuminance) >= 18) {
          detailTransitions += 1;
        }
      }
    }
  }

  luminances.sort((left, right) => left - right);
  const lowLuminance =
    luminances[Math.floor(luminances.length * 0.03)] ?? 0;
  const highLuminance =
    luminances[Math.floor(luminances.length * 0.97)] ?? 0;
  const luminanceRange = highLuminance - lowLuminance;
  const minimumColorBinPixels = Math.max(
    3,
    Math.floor(sampledPixels * 0.0015),
  );
  const activeColorBins = [...quantizedColors.values()].filter(
    (count) => count >= minimumColorBinPixels,
  ).length;
  const dominantColorFraction =
    Math.max(...quantizedColors.values()) / Math.max(sampledPixels, 1);
  const detailTransitionFraction =
    detailTransitions / Math.max(sampledPixels, 1);
  const fractions = {
    coolMetal: coolMetalPixels / Math.max(sampledPixels, 1),
    darkHardware: darkHardwarePixels / Math.max(sampledPixels, 1),
    domesticTextile: domesticTextilePixels / Math.max(sampledPixels, 1),
    goldAccent: goldAccentPixels / Math.max(sampledPixels, 1),
    rustAccent: rustAccentPixels / Math.max(sampledPixels, 1),
    warmMaterial: warmMaterialPixels / Math.max(sampledPixels, 1),
  };

  assert.ok(
    activeColorBins >= 12 && dominantColorFraction <= 0.58,
    `${label}: the room is visually flat or dominated by a generic slab (${activeColorBins} active color bins, ${dominantColorFraction.toFixed(3)} dominant fraction).`,
  );
  assert.ok(
    luminanceRange >= 58 && detailTransitionFraction >= 0.018,
    `${label}: the room lacks authored material contrast/detail (${luminanceRange.toFixed(1)} luminance range, ${detailTransitionFraction.toFixed(3)} transition fraction).`,
  );
  assert.ok(
    fractions.darkHardware >= 0.018,
    `${label}: the room lacks readable dark fixtures/hardware (${fractions.darkHardware.toFixed(3)} fraction).`,
  );

  if (role === "boarding-house") {
    assert.ok(
      fractions.warmMaterial >= 0.2 &&
        fractions.domesticTextile >= 0.015 &&
        fractions.goldAccent >= 0.008,
      `${label}: Morrow House lacks its warm reception, woven domestic textile, or brass key signature: ${JSON.stringify(fractions)}.`,
    );
  } else if (role === "tea-house") {
    assert.ok(
      fractions.warmMaterial >= 0.16 && fractions.goldAccent >= 0.01,
      `${label}: Kettle & Lamp lacks broad warm service material and tea-light accents: ${JSON.stringify(fractions)}.`,
    );
  } else {
    assert.equal(
      role,
      "repair-stall",
      `${label}: unsupported interior identity role ${role}.`,
    );
    assert.ok(
      fractions.coolMetal >= 0.18 && fractions.rustAccent >= 0.008,
      `${label}: Mercer Repairs lacks broad cool metal material and rust/parts accents: ${JSON.stringify(fractions)}.`,
    );
  }

  const diagnostics = {
    activeColorBins,
    detailTransitionFraction: Number(detailTransitionFraction.toFixed(3)),
    dominantColorFraction: Number(dominantColorFraction.toFixed(3)),
    fractions: Object.fromEntries(
      Object.entries(fractions).map(([key, value]) => [
        key,
        Number(value.toFixed(3)),
      ]),
    ),
    label,
    luminanceRange: Number(luminanceRange.toFixed(1)),
    role,
    sample,
  };
  interiorIdentityDiagnostics.push(diagnostics);
  return diagnostics;
}

function findLargestWarmWashComponent(image, sample, scaleX, scaleY) {
  const width = Math.max(1, Math.floor(sample.right - sample.left));
  const height = Math.max(1, Math.floor(sample.bottom - sample.top));
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(
      Math.floor((sample.top + y + 0.5) * scaleY),
      0,
      image.height - 1,
    );
    for (let x = 0; x < width; x += 1) {
      const sourceX = clamp(
        Math.floor((sample.left + x + 0.5) * scaleX),
        0,
        image.width - 1,
      );
      const offset = (sourceY * image.width + sourceX) * image.channels;
      const red = image.pixels[offset];
      const green = image.pixels[offset + 1] ?? red;
      const blue = image.pixels[offset + 2] ?? red;
      mask[y * width + x] =
        red >= 171 &&
        green >= 149 &&
        blue >= 112 &&
        red - green >= 15 &&
        red - green <= 36 &&
        green - blue >= 30 &&
        green - blue <= 50
          ? 1
          : 0;
    }
  }

  let largest = {
    area: 0,
    areaFraction: 0,
    bottom: 0,
    height: 0,
    fillRatio: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
  };
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }
    let head = 0;
    let tail = 0;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    queue[tail++] = index;
    visited[index] = 1;
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
        if (neighbor >= 0 && mask[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    if (area > largest.area) {
      largest = {
        area,
        areaFraction: Number((area / (width * height)).toFixed(4)),
        bottom: sample.top + bottom,
        height: bottom - top,
        fillRatio: Number(
          (area / Math.max((right - left) * (bottom - top), 1)).toFixed(4),
        ),
        left: sample.left + left,
        right: sample.left + right,
        top: sample.top + top,
        width: right - left,
      };
    }
  }

  return largest;
}

async function captureValidatedScreenshot({
  expectedHudText,
  label,
  page,
  session,
  targetPath,
  viewport,
}) {
  let currentPage = page;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await session.captureScreenshot(targetPath);
    const screenshot = await readFile(targetPath);
    try {
      const pixelDiagnostics = assertScreenshotVisualIntegrity(
        screenshot,
        currentPage,
        viewport,
        label,
      );
      screenshotPixelDiagnostics.push({
        hudChips: pixelDiagnostics.hudChipDiagnostics,
        label,
        largestNearBlackComponent:
          pixelDiagnostics.largestNearBlackComponent,
        targetPath,
        uiTextRuns: pixelDiagnostics.uiTextDiagnostics,
        viewport,
      });
      return {
        largestNearBlackComponent:
          pixelDiagnostics.largestNearBlackComponent,
        page: currentPage,
        retryCount: attempt - 1,
        screenshot,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= 3) {
        break;
      }

      const diagnosticPage = await session.inspectPage();
      assertOverlayGeometry(
        diagnosticPage,
        viewport,
        `${label} retry diagnostics`,
        expectedHudText,
      );
      const camera = await session.readCameraProbe();
      assert.ok(
        camera && !camera.dragging && cameraProbeInRange(camera),
        `${label}: screenshot failed while live camera diagnostics were unhealthy; refusing to retry.`,
      );
      const reason = error instanceof Error ? error.message : String(error);
      screenshotCaptureRetries.push({
        attempt,
        camera: {
          activeSpaceId: camera.activeSpaceId,
          scroll: camera.scroll,
          zoom: camera.zoom,
        },
        label,
        reason,
        targetPath,
      });
      process.stdout.write(
        `[many-lives] Retrying incomplete screenshot paint for ${label} after healthy live diagnostics: ${reason}\n`,
      );
      currentPage = diagnosticPage;
      await sleep(180);
    }
  }

  throw new Error(
    `${label}: could not capture a complete visual frame after 3 attempts. Last failure: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function decodePngPixels(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", "HUD pixel source is not a PNG.");
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
  assert.equal(interlace, 0, "Interlaced PNGs are not supported by the HUD check.");
  const channelsByColorType = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]);
  const channels = channelsByColorType.get(colorType);
  assert.ok(channels, `Unsupported PNG color type ${colorType}.`);
  const inflated = inflateSync(Buffer.concat(compressedChunks));
  const stride = width * channels;
  const expectedLength = height * (stride + 1);
  assert.equal(
    inflated.length,
    expectedLength,
    `Unexpected PNG scanline length ${inflated.length}; expected ${expectedLength}.`,
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
  const handoffDelay = readNumericConst(
    streetSource,
    "POST_FIRST_AFTERNOON_HANDOFF_DWELL_MS",
  );
  const renderFpsLimit = readNumericConst(
    streetSource,
    "RUNTIME_RENDER_FPS_LIMIT",
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
    completionDelay >= 7_500 && completionDelay <= 9_500,
    `First-afternoon completion dwell should remain readable but bounded: ${completionDelay}ms.`,
  );
  assert.ok(
    handoffDelay >= 7_500 && handoffDelay <= 9_500,
    `Post-first-afternoon objective handoff should remain readable but bounded: ${handoffDelay}ms.`,
  );
  assert.ok(
    renderFpsLimit >= 24 && renderFpsLimit <= 40,
    `Dynamic city rendering should stay smooth without starving watch-mode timers: ${renderFpsLimit}fps.`,
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
    southQuayV2DocumentSource,
    cameraSource,
    geometrySource,
    viewportSource,
    smokeSource,
  ] = await Promise.all([
      readFile(STREET_APP_PATH, "utf8"),
      readFile(STREET_VISUAL_SCENE_RENDERER_PATH, "utf8"),
      readFile(SOUTH_QUAY_V2_DOCUMENT_PATH, "utf8"),
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
    !streetSource.includes("playerReticle") &&
      !streetSource.includes("playerBeacon") &&
      !streetSource.includes("drawPlayerPresenceMarker") &&
      !streetSource.includes("drawWaypointBeacon"),
    "Rowan must not regain stacked reticle, beacon, halo, or waypoint treatments.",
  );
  assert.ok(
    streetSource.includes("persistentIdentityTreatments") &&
      streetSource.includes("contextualCues") &&
      smokeSource.includes("assertBoundedVisualHierarchy") &&
      smokeSource.includes("assertOverlayGeometry"),
    "Visual smoke must count Rowan cues and assert overlay geometry at runtime.",
  );
  assert.ok(
    streetSource.includes("function isNpcVisuallyPresentAtCurrentTime") &&
      streetSource.includes("function isHourWithinNpcScheduleWindow") &&
      streetSource.includes("isNpcVisuallyPresentAtCurrentTime(game, npc)"),
    "Phaser actor and nearby presence must remain schedule-authoritative.",
  );
  assert.ok(
    smokeSource.includes("assertHudScreenshotPixels") &&
      smokeSource.includes("visibleTimeGlyphStyles") &&
      smokeSource.includes("activeHorizontalBins") &&
      smokeSource.includes("screenshotPixelDiagnostics") &&
      smokeSource.includes("assertNoLargeNearBlackDropout") &&
      smokeSource.includes("captureValidatedScreenshot") &&
      smokeSource.includes("runAfterHoursNpcAvailabilityCheck"),
    "Visual smoke must glyph-check HUD paint, retain per-capture diagnostics, reject black dropouts, and verify after-hours NPC absence.",
  );
  assert.ok(
    streetSource.includes("target-outside-safe-rect") &&
      streetSource.includes("label-would-clamp-away-from-target") &&
      streetSource.includes("pointInsideVisualRect(cue.targetWorld, labelSafeRect)"),
    "Map-agency target labels must hide instead of clamping distant landmark labels into the wrong camera region.",
  );
  assert.ok(
    visualSceneRendererSource.includes("drawHarborBuoy(") &&
      visualSceneRendererSource.includes(
        "layer.lineBetween(eastWater.x + 1, buoyY - 9, buoyX - 5, buoyY + 5)",
      ),
    "Harbor ambient life must render the east-water cue as a quay-tied authored buoy, not a stray bright dot.",
  );
  const harborEdgeSource = visualSceneRendererSource.match(
    /function drawHarborEdge\([\s\S]*?\n}\n\nfunction findAdjacentQuayWall/,
  )?.[0];
  assert.ok(
    southQuayV2DocumentSource.includes('"id": "east-channel-mooring-bays"') &&
      southQuayV2DocumentSource.includes(
        '"id": "surface-east-channel-quay-wall"',
      ) &&
      southQuayV2DocumentSource.match(
        /"id": "surface-east-channel-(?:north|middle|south)-bay"/g,
      )?.length === 3 &&
      harborEdgeSource &&
      !harborEdgeSource.includes("visualScene.surfaceZones.find(") &&
      harborEdgeSource.includes(
        'visualScene.surfaceZones.filter(\n    (zone) => zone.kind === "quay_wall"',
      ) &&
      harborEdgeSource.includes(
        '.filter((zone) => zone.kind === "dock_apron")',
      ) &&
      harborEdgeSource.includes(
        "for (const [index, dockApron] of dockAprons.entries())",
      ) &&
      harborEdgeSource.includes(
        "for (const [index, quayWall] of quayWalls.entries())",
      ) &&
      visualSceneRendererSource.includes("function drawDockApronTreatment") &&
      visualSceneRendererSource.includes("function drawQuayWallTreatment") &&
      visualSceneRendererSource.includes("function drawMooringCapstan") &&
      visualSceneRendererSource.includes(
        "cluster.rect.height > cluster.rect.width * 1.5",
      ) &&
      smokeSource.includes("assertEastWaterfrontCompositionPixels") &&
      smokeSource.includes("assertEastWaterfrontBayCoverage") &&
      smokeSource.includes('"codex-retina-tall"'),
    "Every authored waterfront apron and wall must retain a varied, pixel-backed working-quay treatment across phone, compact, and high-DPR captures.",
  );
  assert.ok(
    southQuayV2DocumentSource.includes('"id": "fringe-north-west-town"') &&
      southQuayV2DocumentSource.includes('"id": "fringe-west-side-street"') &&
      southQuayV2DocumentSource.includes(
        '"id": "courtyard-morrow-yard-service"',
      ) &&
      visualSceneRendererSource.includes("drawNorthNeighborRow") &&
      visualSceneRendererSource.includes("drawRaisedGardenBed") &&
      smokeSource.includes("assertNorthFringeCompositionPixels") &&
      smokeSource.includes("assertWestOpenLotCompositionPixels"),
    "The north/west edge must retain its authored neighbor row, working yard composition, and pixel-backed fringe regressions.",
  );
  assert.ok(
    visualSceneRendererSource.includes("function drawPilgrimSlipHeroArt") &&
      visualSceneRendererSource.includes("function drawV2CourtyardPersonality") &&
      visualSceneRendererSource.includes("function drawYardServiceCluster") &&
      visualSceneRendererSource.includes("function drawLaundryLine") &&
      smokeSource.includes("assertMorrowYardCompositionPixels") &&
      smokeSource.includes("assertPilgrimSlipCompositionPixels") &&
      smokeSource.includes("secondary-landmarks-desktop.png") &&
      smokeSource.includes("morrow-yard-codex-compact.png") &&
      smokeSource.includes("morrow-yard-route-compact-tall.png") &&
      smokeSource.includes("pilgrim-slip-route-compact-tall.png") &&
      smokeSource.includes("runSecondaryLandmarkRouteIdentityCheck"),
    "Secondary landmarks must keep dedicated service-yard and harbor-slip rendering, pixel-backed identity checks, and deterministic evidence captures.",
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

async function assertAuthoredInteriorVisualGuard() {
  const [streetSource, smokeSource] = await Promise.all([
    readFile(STREET_APP_PATH, "utf8"),
    readFile(VISUAL_SMOKE_PATH, "utf8"),
  ]);
  const boardingAtmosphereSource = streetSource.match(
    /function drawBoardingHouseInteriorAtmosphere[\s\S]*?\n}\n\nfunction drawBoardingHouseWindow/,
  )?.[0];
  const teaHouseAtmosphereSource = streetSource.match(
    /function drawTeaHouseInteriorAtmosphere[\s\S]*?\n}\n\nfunction drawTeaHouseWindow/,
  )?.[0];
  const repairStallAtmosphereSource = streetSource.match(
    /function drawRepairStallInteriorAtmosphere[\s\S]*?\n}\n\nfunction drawRepairPartsBins/,
  )?.[0];

  assert.ok(
    streetSource.includes("function drawBoardingHouseInteriorAtmosphere") &&
      streetSource.includes("function drawBoardingHouseLoungeRug") &&
      streetSource.includes("function drawBoardingHouseWovenRug") &&
      streetSource.includes("function drawBoardingHouseRoomHall") &&
      streetSource.includes("function drawBoardingHouseKeyBoard") &&
      streetSource.includes("getInteriorActorCompositionBounds") &&
      streetSource.includes("getInteriorPortalWorldPoints") &&
      streetSource.includes(
        'space.id === "interior:boarding-house"',
      ),
    "Morrow House must keep its opaque woven rugs, room hall, key board, and boarding-house-specific atmosphere passes.",
  );
  assert.ok(
    streetSource.includes("function drawBoardingHouseInteriorObjectDetail") &&
      streetSource.includes(
        'object.id.startsWith("boarding-house-")',
      ),
    "Morrow House furniture must keep boarding-house-specific readable object details.",
  );
  assert.ok(
    boardingAtmosphereSource,
    "Could not isolate the Morrow House atmosphere pass for visual-noise validation.",
  );
  assert.doesNotMatch(
    boardingAtmosphereSource,
    /fillCircle\([^;]*CELL\s*\*\s*(?:1\.[2-9]|[2-9])/,
    "Morrow House atmosphere must not restore a room-dominating translucent circle.",
  );
  assert.ok(
    teaHouseAtmosphereSource &&
      streetSource.includes("function drawTeaHouseInteriorObjectDetail") &&
      streetSource.includes('space.id === "interior:tea-house"') &&
      streetSource.includes('object.id.startsWith("tea-house-")'),
    "Kettle & Lamp must keep tea-house-specific atmosphere and furniture detail passes.",
  );
  assert.ok(
    repairStallAtmosphereSource &&
      streetSource.includes("function drawRepairStallInteriorObjectDetail") &&
      streetSource.includes('space.id === "interior:repair-stall"') &&
      streetSource.includes('object.id.startsWith("repair-stall-")'),
    "Mercer Repairs must keep workshop-specific atmosphere and furniture detail passes.",
  );
  assert.doesNotMatch(
    `${teaHouseAtmosphereSource}\n${repairStallAtmosphereSource}`,
    /fill(?:Circle|Ellipse)\([^;]*CELL\s*\*\s*(?:1\.[5-9]|[2-9])/,
    "Authored cafe/workshop atmosphere must not restore room-dominating translucent halos.",
  );
  assert.match(
    streetSource,
    /function drawInteriorSpaceLabels[\s\S]*?fontFamily: "Inter, sans-serif"[\s\S]*?fontSize: "8px"[\s\S]*?setOrigin\(0\.5\)/,
    "Interior titles must remain compact, crisp, and centered secondary labels.",
  );
  assert.ok(
    smokeSource.includes("runInteriorCameraCheck") &&
      smokeSource.includes("interior-camera.png") &&
      smokeSource.includes("interior-camera-mobile.png") &&
      smokeSource.includes("runAuthoredInteriorIdentityCheck") &&
      smokeSource.includes("tea-house-interior-desktop.png") &&
      smokeSource.includes("tea-house-interior-mobile.png") &&
      smokeSource.includes("repair-stall-interior-desktop.png") &&
      smokeSource.includes("repair-stall-interior-mobile.png") &&
      smokeSource.includes("waitForVisualHierarchyPage") &&
      smokeSource.includes("assertBoardingHouseInteriorCompositionPixels") &&
      smokeSource.includes("assertAuthoredInteriorIdentityPixels") &&
      smokeSource.includes("assertInteriorCameraPointsUnobscured") &&
      smokeSource.includes("assertMorrowHouseRelevantActorsUnobscured") &&
      smokeSource.includes("captureMorrowHouseMobileState") &&
      smokeSource.includes("assertInteriorTitleInsideScene") &&
      smokeSource.includes("assertAuthoredInteriorVisualGuard"),
    "Visual smoke must keep desktop/mobile screenshots plus pixel-backed and geometry-backed checks for all authored interiors.",
  );
  assert.ok(
    streetSource.includes("browserVisualHierarchyProbeJson") &&
      streetSource.includes("serializeBrowserVisualHierarchyProbe") &&
      !streetSource.includes(
        '<script id="ml-browser-visual-hierarchy-probe" type="application/json">null</script>',
      ),
    "Overlay refreshes must initialize the visual hierarchy probe instead of recreating a transient null value.",
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

function assertNpcVisualPresenceMatchesAvailability(
  browserProbe,
  page,
  label,
) {
  const schedules = browserProbe?.worldPressure?.npcSchedules ?? [];
  const presence = page?.npcPresence;
  assert.ok(presence, `${label}: missing NPC visual-presence probe.`);
  assert.deepEqual(
    presence.scheduleSemantics,
    {
      fullDayWindowActive: true,
      halfOpenEndExcluded: true,
      overnightAfterMidnightActive: true,
      overnightBeforeMidnightActive: true,
      overnightEndExcluded: true,
    },
    `${label}: Phaser NPC presence helper no longer matches half-open/overnight schedule semantics.`,
  );
  const visuallyPresent = new Set(presence.visuallyPresentNpcIds ?? []);
  const nearby = new Set(presence.nearbyNpcIds ?? []);
  const visibleMarkerNpcIds = new Set(
    (browserProbe?.movement?.scheduledNpcMarkerSamples ?? [])
      .filter((sample) => sample.visible)
      .map((sample) => sample.npcId),
  );

  for (const schedule of schedules) {
    if (schedule.availability === "unavailable") {
      assert.ok(
        !visuallyPresent.has(schedule.id),
        `${label}: unavailable NPC ${schedule.id} remains visually present from stale location ${schedule.currentLocationId}.`,
      );
      assert.ok(
        !nearby.has(schedule.id),
        `${label}: unavailable NPC ${schedule.id} remains in the nearby list.`,
      );
      assert.ok(
        !visibleMarkerNpcIds.has(schedule.id),
        `${label}: unavailable NPC ${schedule.id} still has a visible Phaser/schedule marker.`,
      );
    }
  }

  for (const npcId of visibleMarkerNpcIds) {
    const schedule = schedules.find((entry) => entry.id === npcId);
    assert.ok(
      !schedule || schedule.availability !== "unavailable",
      `${label}: visible marker ${npcId} contradicts browser-probe availability ${schedule?.availability}.`,
    );
  }
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
  const superseded =
    carryForward.phase === "superseded_by_autoplay_progress";
  assert.equal(
    Boolean(carryForward.progressedBeyondOpening),
    superseded,
    `${label}: opening carry-forward phase disagrees with its progress state: ${JSON.stringify(carryForward)}.`,
  );
  if (superseded) {
    assert.equal(
      carryForward.status,
      "completed",
      `${label}: superseded opening carry-forward should report the opening action completed: ${JSON.stringify(carryForward)}.`,
    );
    assert.ok(
      openingActionProgressEvidence(carryForward).length > 0,
      `${label}: superseded opening carry-forward is missing concrete first-run progress evidence: ${JSON.stringify(carryForward)}.`,
    );
    assertValidOpeningAutoplaySupersession(carryForward, label);
  } else {
    assert.equal(
      carryForward.targetLocationId,
      "boarding-house",
      `${label}: active opening carry-forward should target Morrow House: ${JSON.stringify(carryForward)}.`,
    );
  }
  if (carryForward.status !== "completed") {
    assert.equal(
      carryForward.geometry?.nearActionLocation,
      true,
      `${label}: queued opening action should keep Rowan near the Morrow House door: ${JSON.stringify(carryForward)}.`,
    );
  }
}

function assertValidOpeningAutoplaySupersession(carryForward, label) {
  const supersededBy = carryForward.supersededBy;
  assert.ok(
    supersededBy,
    `${label}: superseded opening carry-forward is missing the current autoplay action: ${JSON.stringify(carryForward)}.`,
  );
  assert.equal(
    supersededBy.locationId,
    carryForward.currentLocationId,
    `${label}: superseding autoplay progress should identify Rowan's current location: ${JSON.stringify(carryForward)}.`,
  );
  assert.ok(
    typeof supersededBy.mode === "string" && supersededBy.mode.length > 0,
    `${label}: superseding autoplay progress is missing its mode: ${JSON.stringify(carryForward)}.`,
  );

  const actionId =
    typeof supersededBy.actionId === "string" && supersededBy.actionId.length > 0
      ? supersededBy.actionId
      : null;
  const activeConversationNpcId =
    typeof supersededBy.activeConversationNpcId === "string" &&
    supersededBy.activeConversationNpcId.length > 0
      ? supersededBy.activeConversationNpcId
      : null;
  const selectedConversationNpcId =
    supersededBy.mode === "conversation" &&
    typeof supersededBy.npcId === "string" &&
    supersededBy.npcId.length > 0
      ? supersededBy.npcId
      : null;
  assert.ok(
    actionId || activeConversationNpcId || selectedConversationNpcId,
    `${label}: superseding autoplay progress is missing a current action or conversation: ${JSON.stringify(carryForward)}.`,
  );
  assert.notEqual(
    actionId,
    "enter:boarding-house",
    `${label}: superseding autoplay progress still reports the opening action: ${JSON.stringify(carryForward)}.`,
  );
  if (actionId || selectedConversationNpcId) {
    assert.ok(
      typeof supersededBy.label === "string" && supersededBy.label.length > 0,
      `${label}: superseding autoplay action is missing its visible label: ${JSON.stringify(carryForward)}.`,
    );
  }

  if (supersededBy.targetLocationId) {
    assert.equal(
      carryForward.targetLocationId,
      supersededBy.targetLocationId,
      `${label}: superseded opening carry-forward should expose the current autoplay target: ${JSON.stringify(carryForward)}.`,
    );
  }
  if (supersededBy.mode === "moving" || actionId?.startsWith("move:")) {
    assert.ok(
      supersededBy.targetLocationId,
      `${label}: superseding movement is missing its target location: ${JSON.stringify(carryForward)}.`,
    );
  }
}

function assertOpeningActionCarryForwardContractGuard() {
  const progressedProbe = {
    openingActionCarryForward: {
      completionEvidence: ["first-afternoon-approaches-known"],
      currentLocationId: "boarding-house",
      phase: "superseded_by_autoplay_progress",
      progressedBeyondOpening: true,
      requiredVisibleInput: false,
      selectedActionId: "enter:boarding-house",
      status: "completed",
      supersededBy: {
        activeConversationNpcId: null,
        actionId: "move:tea-house",
        label: "Head to Kettle & Lamp",
        locationId: "boarding-house",
        mode: "moving",
        targetLocationId: "tea-house",
      },
      targetLocationId: "tea-house",
      watchMode: { autoplayEnabled: true, enabled: true, frozen: false },
    },
  };
  assert.doesNotThrow(() =>
    assertOpeningActionCarryForward(
      progressedProbe,
      "opening carry-forward progressed-state regression",
    ),
  );

  assert.doesNotThrow(() =>
    assertOpeningActionCarryForward(
      {
        openingActionCarryForward: {
          ...progressedProbe.openingActionCarryForward,
          supersededBy: {
            activeConversationNpcId: null,
            actionId: null,
            label: "Talk to Mara",
            locationId: "boarding-house",
            mode: "conversation",
            npcId: "npc-mara",
            targetLocationId: "boarding-house",
          },
          targetLocationId: "boarding-house",
        },
      },
      "opening selected-conversation regression",
    ),
  );

  assert.doesNotThrow(() =>
    assertOpeningActionCarryForward(
      {
        openingActionCarryForward: {
          completionEvidence: ["route-progress"],
          currentLocationId: "boarding-house",
          geometry: { nearActionLocation: true },
          phase: "opening_in_progress",
          progressedBeyondOpening: false,
          requiredVisibleInput: false,
          selectedActionId: "enter:boarding-house",
          status: "in_progress",
          supersededBy: null,
          targetLocationId: "boarding-house",
          watchMode: { autoplayEnabled: true, enabled: true, frozen: false },
        },
      },
      "opening route progress regression",
    ),
  );
  assert.equal(
    openingActionNeedsNearArrivalGrace({
      movement: {
        playerRoute: {
          active: true,
          legal: true,
          progress: 0.974,
          reachesDestination: true,
        },
      },
      openingActionCarryForward: {
        completionEvidence: ["route-progress"],
        phase: "opening_in_progress",
        requiredVisibleInput: false,
        selectedActionId: "enter:boarding-house",
        status: "in_progress",
        targetLocationId: "boarding-house",
        watchMode: { autoplayEnabled: true, enabled: true, frozen: false },
      },
    }),
    true,
    "a legal near-complete opening route should receive bounded hosted-renderer grace",
  );
  assert.equal(
    openingActionNeedsNearArrivalGrace({
      movement: {
        playerRoute: {
          active: true,
          legal: true,
          progress: 0.94,
          reachesDestination: true,
        },
      },
      openingActionCarryForward: {
        phase: "opening_in_progress",
        requiredVisibleInput: false,
        selectedActionId: "enter:boarding-house",
        status: "in_progress",
        targetLocationId: "boarding-house",
        watchMode: { autoplayEnabled: true, enabled: true, frozen: false },
      },
    }),
    false,
    "an opening route below the near-arrival threshold must not weaken the pacing deadline",
  );

  const mutateCarryForward = (changes) => ({
    openingActionCarryForward: {
      ...progressedProbe.openingActionCarryForward,
      ...changes,
    },
  });
  assert.throws(
    () =>
      assertOpeningActionCarryForward(
        mutateCarryForward({ selectedActionId: "move:tea-house" }),
        "opening carry-forward unselected-opening regression",
      ),
    /should select Enter Morrow House/,
  );
  assert.throws(
    () =>
      assertOpeningActionCarryForward(
        mutateCarryForward({ requiredVisibleInput: true }),
        "opening carry-forward visible-input regression",
      ),
    /should not require visible input/,
  );
  assert.throws(
    () =>
      assertOpeningActionCarryForward(
        mutateCarryForward({ supersededBy: null }),
        "opening carry-forward missing-supersession regression",
      ),
    /missing the current autoplay action/,
  );
  assert.throws(
    () =>
      assertOpeningActionCarryForward(
        mutateCarryForward({
          supersededBy: {
            activeConversationNpcId: null,
            actionId: null,
            label: "Talk to Mara",
            locationId: "boarding-house",
            mode: "conversation",
            npcId: null,
            targetLocationId: "boarding-house",
          },
        }),
        "opening carry-forward ungrounded-conversation regression",
      ),
    /missing a current action or conversation/,
  );
  assert.throws(
    () =>
      assertOpeningActionCarryForward(
        mutateCarryForward({
          phase: "opening_in_progress",
          progressedBeyondOpening: false,
          status: "in_progress",
        }),
        "opening carry-forward active-target regression",
      ),
    /active opening carry-forward should target Morrow House/,
  );
}

function openingActionProgressEvidence(carryForward) {
  return (carryForward?.completionEvidence ?? []).filter(
    (entry) =>
      OPENING_AUTOPLAY_PROGRESS_EVIDENCE.has(entry) ||
      String(entry).startsWith("first-afternoon-tea-shift-"),
  );
}

function openingActionHasAutoplayProgressed(browserProbe) {
  const carryForward = browserProbe?.openingActionCarryForward;
  if (!carryForward) {
    return false;
  }

  return Boolean(
    carryForward.status === "completed" &&
      carryForward.watchMode?.enabled &&
      carryForward.requiredVisibleInput === false &&
      (carryForward.progressedBeyondOpening ||
        openingActionProgressEvidence(carryForward).length > 0),
  );
}

function openingActionNeedsNearArrivalGrace(browserProbe) {
  const carryForward = browserProbe?.openingActionCarryForward;
  const route = browserProbe?.movement?.playerRoute;
  return Boolean(
    carryForward?.status === "in_progress" &&
      carryForward.phase === "opening_in_progress" &&
      carryForward.selectedActionId === "enter:boarding-house" &&
      carryForward.targetLocationId === "boarding-house" &&
      carryForward.requiredVisibleInput === false &&
      carryForward.watchMode?.enabled &&
      !carryForward.watchMode?.frozen &&
      route?.active &&
      route.legal &&
      route.reachesDestination &&
      Number.isFinite(route.progress) &&
      route.progress >= AUTOPLAY_NEAR_ARRIVAL_MIN_PROGRESS,
  );
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

function hasGroundedNearMorrowEntryAgency(mapAgency, browserProbe) {
  const target = mapAgency?.target;
  const carryForward = browserProbe?.openingActionCarryForward;
  return Boolean(
    mapAgency?.currentLocation?.id === "boarding-house" &&
      browserProbe?.location?.id === "boarding-house" &&
      target?.locationId === "boarding-house" &&
      target?.actionId === "enter:boarding-house" &&
      (target.source === "autonomy" || target.source === "pending-move") &&
      pointInsideBounds(target, OPENING_MORROW_HOUSE_DOOR_ANCHOR_BOUNDS) &&
      mapAgency.labels?.targetHiddenReason === "player-near-target" &&
      mapAgency.labels?.targetVisible === false &&
      carryForward?.selectedActionId === "enter:boarding-house" &&
      /Enter Morrow House|stepping inside Morrow House/i.test(
        [mapAgency.intent, mapAgency.detail].filter(Boolean).join(" "),
      ),
  );
}

function assertGroundedNearMorrowEntryAgencyGuard() {
  const mapAgency = {
    currentLocation: { id: "boarding-house" },
    detail: "Rowan is stepping inside Morrow House to ask Mara.",
    intent: "Enter Morrow House",
    labels: {
      targetHiddenReason: "player-near-target",
      targetVisible: false,
    },
    target: {
      actionId: "enter:boarding-house",
      locationId: "boarding-house",
      source: "autonomy",
      x: 222,
      y: 584,
    },
  };
  const browserProbe = {
    location: { id: "boarding-house" },
    openingActionCarryForward: {
      selectedActionId: "enter:boarding-house",
    },
  };

  assert.equal(
    hasGroundedNearMorrowEntryAgency(mapAgency, browserProbe),
    true,
    "A near-door Morrow entry transition should remain valid map agency when its redundant target label is suppressed.",
  );
  assert.equal(
    hasGroundedNearMorrowEntryAgency(
      {
        ...mapAgency,
        labels: {
          ...mapAgency.labels,
          targetHiddenReason: "missing-target",
        },
      },
      browserProbe,
    ),
    false,
    "Missing-target suppression must not satisfy the near-door Morrow entry contract.",
  );
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
    !/(?:\b(routeKey|advance_objective|planningTrace|worldPressure|cityEvents|jobWindows|npcSchedules|npcPressureMoves|planKey|actionId|targetLocationId|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate)\b|That opening has closed|keeps to the confirmed choice)/i.test(
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

  const lead = visibleDecisionNextCheckLead(outcome, label, signal);
  return compactVisibleDecisionText(signal ? `${lead}: ${signal}` : label, 118);
}

function visibleDecisionNextCheckLead(outcome, label, signal) {
  if (signal && outcome.status === "blocked") {
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
    .replace(
      /\b(?:cloned\s+)?destination(?:'s)?\s+legal action surface\b/gi,
      "choices available there",
    )
    .replace(
      /\b(?:cloned\s+)?future legal action surface\b/gi,
      "choices available then",
    )
    .replace(/\bcurrent legal action surface\b/gi, "choices available now")
    .replace(/\blegal action surface\b/gi, "available choices")
    .replace(
      /\bre-evaluate the legal conversation surface\b/gi,
      "see whether the conversation is still available",
    )
    .replace(/\blegal conversation surface\b/gi, "available conversation")
    .replace(/\bsimulator-legal current actions\b/gi, "choices available now")
    .replace(/\bsimulator[- ]validated\b/gi, "checked")
    .replace(/\b(?:fresh\s+)?simulator validation\b/gi, "a fresh check")
    .replace(/\bsimulator\b/gi, "the game")
    .replace(/\bdeterministic fallback\b/gi, "built-in guidance")
    .replace(/\bdeterministic planner\b/gi, "Rowan's judgment")
    .replace(/\bdeterministic route progress\b/gi, "Rowan's follow-through")
    .replace(/\bplanner recommendation\b/gi, "recommendation")
    .replace(/\broute progress\b/gi, "follow-through")
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
    .replace(/\blegal current actions?\b/gi, "choices available now")
    .replace(/\blegal actions?\b/gi, "available choices")
    .replace(/\blegal move\b/gi, "available move")
    .replace(/\bbe legal\b/gi, "be available")
    .replace(/\bvalidation\b/gi, "check")
    .replace(/\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function assertVisibleDecisionCopyCompactionContractGuard() {
  for (const [source, expected] of [
    [
      "Deterministic route progress, simulator-validated.",
      "Rowan's follow-through, checked.",
    ],
    [
      "Re-check this action against the destination's legal action surface.",
      "Re-check this action against the choices available there.",
    ],
    [
      "Re-evaluate the legal conversation surface before asking again.",
      "see whether the conversation is still available before asking again.",
    ],
    [
      "Choose from the simulator-legal current actions.",
      "Choose from the choices available now.",
    ],
    [
      "Use deterministic planner and deterministic fallback after fresh simulator validation.",
      "Use Rowan's judgment and built-in guidance after a fresh check.",
    ],
  ]) {
    assert.equal(
      compactVisibleDecisionText(source, 200),
      expected,
      `Visible decision copy compaction drifted for: ${source}`,
    );
  }

  const selectedStep = {
    actionId: "enter:boarding-house",
    label: "Enter Morrow House",
    legal: true,
  };
  const planningTrace = {
    nextSteps: [
      selectedStep,
      {
        actionId: "talk:npc-mara",
        label: "Talk to Mara",
        legal: true,
        rationale:
          "After reaching Morrow House, re-evaluate the legal conversation surface before Rowan asks the next question.",
      },
    ],
    outcomes: [],
    selectedActionId: selectedStep.actionId,
  };
  assert.equal(
    visibleDecisionNextCheck(planningTrace, selectedStep, selectedStep.label),
    "Talk to Mara: After reaching Morrow House, see whether the conversation is still available before Rowan a...",
    "Trace-backed Next Check reconstruction must use the sanitized player-facing rationale.",
  );

  assert.equal(
    visibleDecisionNextCheckForOutcome({
      outcomes: [
        {
          blockers: ["Tea-house work lead is not confirmed"],
          id: "tea-house-lead",
          label: "Tea-house work lead confirmed",
          status: "blocked",
        },
      ],
    }),
    "Confirm tea-house work lead: Tea-house work lead is not confirmed",
    "Blocked work-lead Next Check reconstruction must use the product outcome lead.",
  );
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
    /Planner trace|Rejected:|Blocked:|Action:|routeKey|advance_objective|planningTrace|desired-state predicate|stale predicate|route hint action|suggested move|no longer legal|current world state|Rejected because|live pressure|predicate|That opening has closed|keeps to the confirmed choice/i,
    `${label}: decision artifact leaked debug/planner language.`,
  );
}

function assertLiveConversationDecisionAndBubbleReadable(page, label) {
  assert.ok(
    page.liveConversationWorkspace,
    `${label}: missing the bounded live conversation workspace.`,
  );
  assert.equal(
    page.decisionArtifactCount,
    1,
    `${label}: live conversation must render exactly one current decision artifact.`,
  );
  for (const field of [
    "aim",
    "signals",
    "choice",
    "rationale",
    "next-check",
    "options",
  ]) {
    const count = page.decisionFieldCounts?.[field] ?? 0;
    if (field === "signals" || field === "next-check" || field === "options") {
      if (count === 0) {
        continue;
      }
    }
    assert.equal(
      count,
      1,
      `${label}: live decision field ${field} must occur exactly once.`,
    );
    assert.ok(
      page.decisionFieldGeometry?.[field]?.fullyVisible,
      `${label}: live decision field ${field} is clipped: ${JSON.stringify(
        page.decisionFieldGeometry?.[field],
      )}.`,
    );
  }
  assert.ok(
    page.liveConversationTranscript?.clientHeight >= 72,
    `${label}: live transcript has no readable viewport: ${JSON.stringify(
      page.liveConversationTranscript,
    )}.`,
  );
  assert.match(
    page.liveConversationTranscript?.overflowY ?? "",
    /auto|scroll/,
    `${label}: live transcript is not independently scrollable.`,
  );
  assert.ok(
    page.latestMeaningfulConversationBubble?.text,
    `${label}: live transcript has no meaningful conversation bubble.`,
  );
  assert.equal(
    page.latestMeaningfulConversationBubble?.fullyVisible,
    true,
    `${label}: latest meaningful conversation bubble is clipped: ${JSON.stringify(
      page.latestMeaningfulConversationBubble,
    )}.`,
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

function compactOpeningActionCarryForwardDiagnostic(carryForward) {
  if (!carryForward) {
    return null;
  }

  return {
    completionEvidence: carryForward.completionEvidence ?? [],
    currentLocationId: carryForward.currentLocationId ?? null,
    currentSpaceId: carryForward.currentSpaceId ?? null,
    firstAfternoon: carryForward.firstAfternoon ?? null,
    phase: carryForward.phase ?? null,
    progressEvidence: openingActionProgressEvidence(carryForward),
    progressedBeyondOpening: Boolean(carryForward.progressedBeyondOpening),
    requiredVisibleInput: carryForward.requiredVisibleInput ?? null,
    selectedActionId: carryForward.selectedActionId ?? null,
    status: carryForward.status ?? null,
    supersededBy: carryForward.supersededBy ?? null,
    targetLocationId: carryForward.targetLocationId ?? null,
    watchMode: carryForward.watchMode ?? null,
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
    firstAfternoon: probe.firstAfternoon ?? null,
    gameId: probe.gameId ?? null,
    location: probe.location ?? null,
    movement: probe.movement
      ? {
          playerRoute: probe.movement.playerRoute
            ? {
                active: probe.movement.playerRoute.active,
                legal: probe.movement.playerRoute.legal,
                progress: probe.movement.playerRoute.progress,
                reachesDestination:
                  probe.movement.playerRoute.reachesDestination,
                target: probe.movement.playerRoute.target,
              }
            : null,
        }
      : null,
    openingActionCarryForward: compactOpeningActionCarryForwardDiagnostic(
      probe.openingActionCarryForward,
    ),
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

function compactDecisionArtifactReadabilityGeometry(page) {
  return {
    commandRail: page?.commandRail ?? null,
    decisionArtifact: page?.decisionArtifact
      ? {
          height: page.decisionArtifact.height,
          visible: page.decisionArtifact.visible,
          width: page.decisionArtifact.width,
          x: page.decisionArtifact.x,
          y: page.decisionArtifact.y,
        }
      : null,
    decisionFields: page?.decisionFieldGeometry ?? null,
    dockRoot: page?.dockRoot ?? null,
    cameraActiveSpaceId: page?.cameraActiveSpaceId ?? null,
    cameraActiveSpaceKind: page?.cameraActiveSpaceKind ?? null,
    latestMeaningfulConversationBubble:
      page?.latestMeaningfulConversationBubble ?? null,
    liveConversationTranscript: page?.liveConversationTranscript ?? null,
    liveConversationWorkspace: page?.liveConversationWorkspace ?? null,
    sceneVisibleFraction: page?.sceneVisibleFraction ?? null,
    rail: page?.rail ?? null,
    railState: page?.railState ?? null,
    rightStack: page?.rightStack ?? null,
    sceneViewportCss: page?.sceneViewportCss ?? null,
    timePill: page?.timePill ?? null,
  };
}

function createDecisionArtifactReadabilityState() {
  return {
    geometry: null,
    signature: null,
    stableSamples: 0,
  };
}

function responsiveDecisionReadabilityDeadlineAt({
  candidateReadableAt,
  firstReadableAt,
  readinessDeadlineAt,
  requiredStableSamples,
  stabilityGraceMs,
  stabilityMaxMs,
}) {
  if (
    requiredStableSamples <= 1 ||
    firstReadableAt === null ||
    candidateReadableAt === null
  ) {
    return readinessDeadlineAt;
  }
  return Math.min(
    firstReadableAt + stabilityMaxMs,
    Math.max(readinessDeadlineAt, candidateReadableAt + stabilityGraceMs),
  );
}

function responsiveLongMaraReplayComplete(page, probe) {
  const conversation = probe?.activeConversation;
  const replay = conversation?.replay;
  const latestReply = page?.latestMeaningfulConversationBubble?.text
    ?.replace(/\s+/g, " ")
    .trim();
  return Boolean(
    replay?.isReplaying === false &&
      Number.isFinite(replay?.revealedEntryCount) &&
      Number.isFinite(conversation?.lines) &&
      replay.revealedEntryCount >= conversation.lines &&
      /^Tonight's bed is yours if you keep the house easy to live in\.[\s\S]*before lunch\.$/i.test(
        latestReply ?? "",
      ),
  );
}

function createResponsiveLongMaraReplayWaitState() {
  return {
    lastProgressAtMs: null,
    progress: null,
  };
}

function responsiveLongMaraReplayProgress(probe) {
  const conversation = probe?.activeConversation;
  const replay = conversation?.replay;
  const streamingEntryId = replay?.streamingEntryId;
  const interEntryPause =
    streamingEntryId === null && replay?.streamedWordCount === 0;
  if (
    replay?.isReplaying !== true ||
    !Number.isInteger(conversation?.lines) ||
    conversation.lines <= 0 ||
    !Number.isInteger(replay?.revealedEntryCount) ||
    replay.revealedEntryCount < 0 ||
    replay.revealedEntryCount > conversation.lines ||
    !Number.isInteger(replay?.streamedWordCount) ||
    replay.streamedWordCount < 0 ||
    (!interEntryPause &&
      (typeof streamingEntryId !== "string" ||
        streamingEntryId.length === 0))
  ) {
    return null;
  }
  return {
    lineCount: conversation.lines,
    revealedEntryCount: replay.revealedEntryCount,
    streamedWordCount: replay.streamedWordCount,
    streamingEntryId,
  };
}

function responsiveLongMaraReplayProgressAdvanced(previous, current) {
  if (!previous || !current || current.lineCount !== previous.lineCount) {
    return false;
  }
  if (current.revealedEntryCount < previous.revealedEntryCount) {
    return false;
  }
  if (current.revealedEntryCount > previous.revealedEntryCount) {
    return true;
  }
  return (
    current.streamingEntryId === previous.streamingEntryId &&
    current.streamedWordCount > previous.streamedWordCount
  );
}

function responsiveLongMaraReplayProgressCompatible(previous, current) {
  if (!previous || !current || current.lineCount !== previous.lineCount) {
    return false;
  }
  if (current.revealedEntryCount < previous.revealedEntryCount) {
    return false;
  }
  if (current.revealedEntryCount > previous.revealedEntryCount) {
    return true;
  }
  if (
    previous.streamingEntryId === null &&
    previous.streamedWordCount === 0 &&
    typeof current.streamingEntryId === "string" &&
    current.streamingEntryId.length > 0
  ) {
    return true;
  }
  return (
    current.streamingEntryId === previous.streamingEntryId &&
    current.streamedWordCount >= previous.streamedWordCount
  );
}

function responsiveLongMaraReplayWaitStep({
  absoluteMaxMs,
  elapsedMs,
  page,
  probe,
  stallGraceMs,
  state,
  timeoutMs,
}) {
  if (responsiveLongMaraReplayComplete(page, probe)) {
    return { readiness: "ready", state };
  }

  const progress = responsiveLongMaraReplayProgress(probe);
  const compatibleProgress = responsiveLongMaraReplayProgressCompatible(
    state.progress,
    progress,
  );
  const nextState = {
    lastProgressAtMs: responsiveLongMaraReplayProgressAdvanced(
      state.progress,
      progress,
    )
      ? elapsedMs
      : compatibleProgress
        ? state.lastProgressAtMs
        : null,
    progress,
  };

  if (elapsedMs < timeoutMs) {
    return { readiness: "waiting", state: nextState };
  }
  if (elapsedMs >= absoluteMaxMs) {
    return { readiness: "timed_out", state: nextState };
  }
  const progressDeadlineMs =
    nextState.lastProgressAtMs === null
      ? timeoutMs
      : Math.min(
          absoluteMaxMs,
          nextState.lastProgressAtMs + stallGraceMs,
        );
  return {
    readiness:
      elapsedMs < progressDeadlineMs ? "waiting" : "timed_out",
    state: nextState,
  };
}

function decisionArtifactReadabilitySignature(geometry) {
  const sceneViewport = geometry.sceneViewportCss;
  return JSON.stringify({
    cameraActiveSpaceId: geometry.cameraActiveSpaceId,
    cameraActiveSpaceKind: geometry.cameraActiveSpaceKind,
    commandRail: geometry.commandRail
      ? {
          clientHeight: geometry.commandRail.clientHeight,
          overflowY: geometry.commandRail.overflowY,
        }
      : null,
    decisionArtifact: geometry.decisionArtifact,
    decisionFields: geometry.decisionFields,
    dockRoot: geometry.dockRoot,
    latestMeaningfulConversationBubble:
      geometry.latestMeaningfulConversationBubble
        ? {
            fullyVisible:
              geometry.latestMeaningfulConversationBubble.fullyVisible,
          }
        : null,
    liveConversationTranscript: geometry.liveConversationTranscript
      ? {
          clientHeight: geometry.liveConversationTranscript.clientHeight,
          overflowY: geometry.liveConversationTranscript.overflowY,
        }
      : null,
    liveConversationWorkspace: geometry.liveConversationWorkspace,
    rail: geometry.rail,
    railState: geometry.railState,
    rightStack: geometry.rightStack,
    sceneVisibleFraction: Number.isFinite(geometry.sceneVisibleFraction)
      ? Number(geometry.sceneVisibleFraction.toFixed(2))
      : null,
    sceneViewportCss: sceneViewport
      ? {
          height: Math.round(sceneViewport.height),
          width: Math.round(sceneViewport.width),
          x: Math.round(sceneViewport.x),
          y: Math.round(sceneViewport.y),
        }
      : null,
    timePill: geometry.timePill,
  });
}

function assertDecisionFieldsFullyVisible(page, label) {
  const requiredFields = ["aim", "choice", "rationale"];
  if ((page?.decisionFieldCounts?.["next-check"] ?? 0) > 0) {
    requiredFields.push("next-check");
  }

  for (const field of requiredFields) {
    const geometry = page?.decisionFieldGeometry?.[field];
    assert.ok(
      geometry?.fullyVisible,
      `${label}: decision field ${field} is clipped in the expanded rail: ${JSON.stringify(geometry)}.`,
    );
  }
}

function decisionArtifactCameraProbeReady(page) {
  return Boolean(
    page?.cameraActiveSpaceId &&
      page?.cameraActiveSpaceKind &&
      page?.sceneViewportCss &&
      Number.isFinite(page?.sceneVisibleFraction),
  );
}

function recordDecisionArtifactReadabilitySample(state, page) {
  const geometry = compactDecisionArtifactReadabilityGeometry(page);
  let readable =
    page?.railState === "expanded" &&
    page?.decisionArtifact?.visible === true &&
    decisionArtifactCameraProbeReady(page);
  if (readable) {
    try {
      assertDecisionFieldsFullyVisible(page, "responsive decision readability");
    } catch {
      readable = false;
    }
  }
  if (!readable) {
    return {
      geometry,
      signature: null,
      stableSamples: 0,
    };
  }

  const signature = decisionArtifactReadabilitySignature(geometry);
  return {
    geometry,
    signature,
    stableSamples: state.signature === signature ? state.stableSamples + 1 : 1,
  };
}

function decisionArtifactReadabilityStable(
  state,
  requiredSamples = RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
) {
  return state.stableSamples >= requiredSamples;
}

function evaluateDecisionArtifactReadabilitySample(
  state,
  page,
  assertSettledPage,
) {
  const nextState = recordDecisionArtifactReadabilitySample(state, page);
  if (nextState.stableSamples === 0 || typeof assertSettledPage !== "function") {
    return { error: null, state: nextState };
  }

  try {
    assertSettledPage(page);
    return { error: null, state: nextState };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      state: {
        geometry: nextState.geometry,
        signature: null,
        stableSamples: 0,
      },
    };
  }
}

function assertDecisionArtifactReadabilityWaitRegression() {
  const readablePage = {
    commandRail: {
      clientHeight: 418,
      overflowY: "auto",
      scrollHeight: 694,
      scrollTop: 0,
    },
    decisionArtifact: {
      height: 228,
      visible: true,
      width: 344,
      x: 588,
      y: 254,
    },
    decisionFieldCounts: {
      aim: 1,
      choice: 1,
      rationale: 1,
      "next-check": 1,
    },
    decisionFieldGeometry: Object.fromEntries(
      ["aim", "choice", "rationale", "next-check"].map((field, index) => [
        field,
        {
          fullyVisible: true,
          rect: {
            bottom: 300 + index * 45,
            height: 36,
            left: 598,
            right: 922,
            top: 264 + index * 45,
            width: 324,
            x: 598,
            y: 264 + index * 45,
          },
          visibleRect: {
            bottom: 300 + index * 45,
            height: 36,
            left: 598,
            right: 922,
            top: 264 + index * 45,
            width: 324,
            x: 598,
            y: 264 + index * 45,
          },
        },
      ]),
    ),
    dockRoot: {
      bottom: 970,
      height: 72,
      left: 12,
      right: 650,
      top: 898,
      width: 638,
      x: 12,
      y: 898,
    },
    cameraActiveSpaceId: "street:south-quay",
    cameraActiveSpaceKind: "street",
    sceneVisibleFraction: 0.62,
    rail: { height: 538, width: 376, x: 576, y: 94 },
    railState: "expanded",
    rightStack: { height: 538, width: 376, x: 576, y: 94 },
    sceneViewportCss: { height: 998, width: 662, x: 0, y: 0 },
    timePill: {
      bottom: 74,
      height: 58,
      left: 16,
      right: 486,
      top: 16,
      width: 470,
      x: 16,
      y: 16,
    },
  };
  const unreadablePage = {
    ...readablePage,
    decisionArtifact: {
      ...readablePage.decisionArtifact,
      visible: false,
      y: 640,
    },
  };
  const clippedLongMaraPage = {
    ...readablePage,
    decisionArtifact: {
      ...readablePage.decisionArtifact,
      height: 372,
    },
    decisionFieldGeometry: {
      ...readablePage.decisionFieldGeometry,
      rationale: {
        fullyVisible: false,
        rect: {
          bottom: 654,
          height: 72,
          left: 598,
          right: 922,
          top: 582,
          width: 324,
          x: 598,
          y: 582,
        },
        visibleRect: {
          bottom: 604,
          height: 22,
          left: 598,
          right: 922,
          top: 582,
          width: 324,
          x: 598,
          y: 582,
        },
      },
    },
  };
  const readableLongMaraConversationPage = {
    ...readablePage,
    decisionArtifactCount: 1,
    latestMeaningfulConversationBubble: {
      fullyVisible: true,
      rect: {
        bottom: 752,
        height: 89,
        left: 25,
        right: 361,
        top: 663,
        width: 336,
        x: 25,
        y: 663,
      },
      text: "Tonight's bed is yours if you keep the house easy to live in.",
      visibleRect: {
        bottom: 752,
        height: 89,
        left: 25,
        right: 361,
        top: 663,
        width: 336,
        x: 25,
        y: 663,
      },
    },
    liveConversationTranscript: {
      clientHeight: 112,
      overflowY: "auto",
      scrollHeight: 214,
      scrollTop: 102,
    },
    liveConversationWorkspace: {
      bottom: 755,
      height: 230,
      left: 25,
      right: 365,
      top: 525,
      width: 340,
      x: 25,
      y: 525,
    },
  };
  const clippedLongMaraConversationPage = {
    ...readableLongMaraConversationPage,
    latestMeaningfulConversationBubble: {
      ...readableLongMaraConversationPage.latestMeaningfulConversationBubble,
      fullyVisible: false,
      rect: {
        bottom: 791,
        height: 89,
        left: 25,
        right: 361,
        top: 702,
        width: 336,
        x: 25,
        y: 702,
      },
      visibleRect: {
        bottom: 755,
        height: 22,
        left: 25,
        right: 361,
        top: 733,
        width: 336,
        x: 25,
        y: 733,
      },
    },
  };
  const readableDesktopLongMaraConversationPage = {
    ...readableLongMaraConversationPage,
    commandRail: {
      clientHeight: 501,
      overflowY: "hidden",
      scrollHeight: 501,
      scrollTop: 0,
    },
    decisionArtifact: {
      ...readableLongMaraConversationPage.decisionArtifact,
      height: 154,
    },
    latestMeaningfulConversationBubble: {
      fullyVisible: true,
      rect: {
        bottom: 666,
        height: 198,
        left: 922,
        right: 1197,
        top: 468,
        width: 275,
        x: 922,
        y: 468,
      },
      text: "Tonight's bed is yours if you keep the house easy to live in.",
      visibleRect: {
        bottom: 666,
        height: 198,
        left: 922,
        right: 1197,
        top: 468,
        width: 275,
        x: 922,
        y: 468,
      },
    },
    liveConversationTranscript: {
      clientHeight: 208,
      overflowY: "auto",
      scrollHeight: 358,
      scrollTop: 150,
    },
    liveConversationWorkspace: {
      bottom: 685,
      height: 477,
      left: 878,
      right: 1245,
      top: 209,
      width: 367,
      x: 878,
      y: 209,
    },
  };
  const onePixelClippedDesktopConversationPage = {
    ...readableDesktopLongMaraConversationPage,
    latestMeaningfulConversationBubble: {
      ...readableDesktopLongMaraConversationPage.latestMeaningfulConversationBubble,
      fullyVisible: false,
      visibleRect: {
        ...readableDesktopLongMaraConversationPage
          .latestMeaningfulConversationBubble.visibleRect,
        height: 197,
        top: 469,
        y: 469,
      },
    },
  };
  const missingScenePage = {
    ...readablePage,
    cameraActiveSpaceId: null,
    cameraActiveSpaceKind: null,
    sceneVisibleFraction: null,
    sceneViewportCss: null,
  };

  let settling = createDecisionArtifactReadabilityState();
  settling = recordDecisionArtifactReadabilitySample(settling, unreadablePage);
  assert.equal(
    settling.stableSamples,
    0,
    "Transiently clipped decision geometry must not count as readable.",
  );
  settling = recordDecisionArtifactReadabilitySample(
    settling,
    clippedLongMaraPage,
  );
  assert.equal(
    settling.stableSamples,
    0,
    "A long Mara artifact with a clipped Why This field must not count as readable.",
  );
  const clippedConversationSample = evaluateDecisionArtifactReadabilitySample(
    createDecisionArtifactReadabilityState(),
    clippedLongMaraConversationPage,
    (page) =>
      assertLiveConversationDecisionAndBubbleReadable(
        page,
        "mobile long Mara responsive decision",
      ),
  );
  assert.ok(
    clippedConversationSample.error,
    "A partially visible latest Mara reply must fail the responsive decision guard.",
  );
  const readableConversationSample = evaluateDecisionArtifactReadabilitySample(
    createDecisionArtifactReadabilityState(),
    readableLongMaraConversationPage,
    (page) =>
      assertLiveConversationDecisionAndBubbleReadable(
        page,
        "mobile long Mara responsive decision",
      ),
  );
  assert.equal(
    readableConversationSample.error,
    null,
    "A fully visible latest Mara reply should satisfy the strict conversation guard.",
  );
  const clippedDesktopConversationSample =
    evaluateDecisionArtifactReadabilitySample(
      createDecisionArtifactReadabilityState(),
      onePixelClippedDesktopConversationPage,
      (page) =>
        assertLiveConversationDecisionAndBubbleReadable(
          page,
          "desktop long Mara responsive decision",
        ),
    );
  assert.ok(
    clippedDesktopConversationSample.error,
    "A desktop Mara reply clipped by one pixel at the top must fail the responsive decision guard.",
  );
  const readableDesktopConversationSample =
    evaluateDecisionArtifactReadabilitySample(
      createDecisionArtifactReadabilityState(),
      readableDesktopLongMaraConversationPage,
      (page) =>
        assertLiveConversationDecisionAndBubbleReadable(
          page,
          "desktop long Mara responsive decision",
        ),
    );
  assert.equal(
    readableDesktopConversationSample.error,
    null,
    "A 154px decision and fully visible 198px desktop Mara reply must satisfy the strict guard inside a 501px command rail.",
  );
  settling = recordDecisionArtifactReadabilitySample(settling, readablePage);
  assert.equal(settling.stableSamples, 1);
  let settledAssertionCalls = 0;
  const missingCameraSample = evaluateDecisionArtifactReadabilitySample(
    settling,
    missingScenePage,
    () => {
      settledAssertionCalls += 1;
    },
  );
  assert.equal(
    missingCameraSample.error,
    null,
    "A missing camera probe is an unsettled sample, not an overlay assertion failure.",
  );
  assert.equal(
    missingCameraSample.state.stableSamples,
    0,
    "A missing camera probe must reset accumulated decision readability.",
  );
  assert.equal(
    settledAssertionCalls,
    0,
    "Overlay assertions must not run before the active scene camera probe is ready.",
  );
  settling = missingCameraSample.state;
  for (let sample = 0; sample < RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT; sample += 1) {
    settling = recordDecisionArtifactReadabilitySample(settling, readablePage);
  }
  assert.equal(
    decisionArtifactReadabilityStable(settling),
    true,
    "A naturally settled expanded rail should become stably readable.",
  );

  const transcriptGrowthPage = {
    ...readablePage,
    commandRail: {
      ...readablePage.commandRail,
      scrollHeight: readablePage.commandRail.scrollHeight + 180,
      scrollTop: 32,
    },
  };
  const transcriptGrowth = recordDecisionArtifactReadabilitySample(
    settling,
    transcriptGrowthPage,
  );
  assert.equal(
    transcriptGrowth.stableSamples,
    settling.stableSamples + 1,
    "Live transcript growth must not reset otherwise stable decision readability.",
  );

  let clipped = createDecisionArtifactReadabilityState();
  for (let sample = 0; sample < RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT + 1; sample += 1) {
    clipped = recordDecisionArtifactReadabilitySample(clipped, unreadablePage);
  }
  assert.equal(
    decisionArtifactReadabilityStable(clipped),
    false,
    "A permanently clipped decision artifact must never satisfy readability.",
  );

  const shiftedPage = {
    ...readablePage,
    decisionArtifact: { ...readablePage.decisionArtifact, y: 260 },
  };
  const shifted = recordDecisionArtifactReadabilitySample(
    transcriptGrowth,
    shiftedPage,
  );
  assert.equal(
    shifted.stableSamples,
    1,
    "Changing rail geometry must restart the stable-readability sample count.",
  );

  const compactViewport = { height: 998, width: 662 };
  const evaluateSettledSample = (state, page) =>
    evaluateDecisionArtifactReadabilitySample(
      state,
      page,
      (settledPage) =>
        assertSceneVisibilityGeometry(
          settledPage,
          compactViewport,
          "responsive decision guard",
          "street:south-quay",
        ),
    );
  const clippedScenePage = {
    ...readablePage,
    sceneVisibleFraction: 0.49,
  };
  const staleSpacePage = {
    ...readablePage,
    cameraActiveSpaceId: "interior:boarding-house",
  };

  let coherent = createDecisionArtifactReadabilityState();
  for (const invalidPage of [clippedScenePage, staleSpacePage]) {
    for (let sample = 0; sample < RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT; sample += 1) {
      const evaluated = evaluateSettledSample(coherent, invalidPage);
      coherent = evaluated.state;
      assert.ok(
        evaluated.error,
        "Clipped or stale scene geometry must reject the settled readability sample.",
      );
    }
    assert.equal(
      decisionArtifactReadabilityStable(coherent),
      false,
      "Permanently clipped or stale scene geometry must never satisfy settled readability.",
    );
  }

  for (let sample = 0; sample < RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT - 1; sample += 1) {
    const evaluated = evaluateSettledSample(coherent, readablePage);
    assert.equal(evaluated.error, null);
    coherent = evaluated.state;
  }
  assert.equal(
    decisionArtifactReadabilityStable(coherent),
    false,
    "Fewer than the required coherent samples must not satisfy settled readability.",
  );
  const interrupted = evaluateSettledSample(coherent, missingScenePage);
  assert.equal(
    interrupted.error,
    null,
    "A transiently missing camera probe must wait instead of failing overlay geometry.",
  );
  assert.equal(
    interrupted.state.stableSamples,
    0,
    "A transiently missing camera probe must interrupt the coherent sample sequence.",
  );
  coherent = interrupted.state;
  for (let sample = 0; sample < RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT; sample += 1) {
    const evaluated = evaluateSettledSample(coherent, readablePage);
    assert.equal(evaluated.error, null);
    coherent = evaluated.state;
  }
  assert.equal(
    decisionArtifactReadabilityStable(coherent),
    true,
    "Decision readability and valid scene geometry should pass only after a coherent stable sequence.",
  );
  assert.equal(
    responsiveDecisionReadabilityDeadlineAt({
      candidateReadableAt: null,
      firstReadableAt: null,
      readinessDeadlineAt: 30_000,
      requiredStableSamples: RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
      stabilityGraceMs: 45_000,
      stabilityMaxMs: 120_000,
    }),
    30_000,
    "A missing readable sample must not extend the readiness deadline.",
  );
  assert.equal(
    responsiveDecisionReadabilityDeadlineAt({
      candidateReadableAt: 29_000,
      firstReadableAt: 29_000,
      readinessDeadlineAt: 30_000,
      requiredStableSamples: RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
      stabilityGraceMs: 45_000,
      stabilityMaxMs: 120_000,
    }),
    74_000,
    "A late valid sample must receive one bounded stability-proof window.",
  );
  assert.equal(
    responsiveDecisionReadabilityDeadlineAt({
      candidateReadableAt: 60_000,
      firstReadableAt: 29_000,
      readinessDeadlineAt: 30_000,
      requiredStableSamples: RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
      stabilityGraceMs: 45_000,
      stabilityMaxMs: 120_000,
    }),
    105_000,
    "A changed coherent layout must receive a fresh stability-proof window.",
  );
  assert.equal(
    responsiveDecisionReadabilityDeadlineAt({
      candidateReadableAt: 145_000,
      firstReadableAt: 29_000,
      readinessDeadlineAt: 30_000,
      requiredStableSamples: RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
      stabilityGraceMs: 45_000,
      stabilityMaxMs: 120_000,
    }),
    149_000,
    "Repeated coherent layout changes must not exceed the absolute stability cap.",
  );
  assert.equal(
    responsiveDecisionReadabilityDeadlineAt({
      candidateReadableAt: 29_000,
      firstReadableAt: 29_000,
      readinessDeadlineAt: 30_000,
      requiredStableSamples: 1,
      stabilityGraceMs: 45_000,
      stabilityMaxMs: 120_000,
    }),
    30_000,
    "A single-sample caller must keep the original readiness deadline.",
  );

  const advancingReplayProbe = (
    streamedWordCount,
    {
      revealedEntryCount = 1,
      streamingEntryId = "conversation-2-663",
    } = {},
  ) => ({
    activeConversation: {
      lines: 2,
      replay: {
        isReplaying: true,
        revealedEntryCount,
        streamedWordCount,
        streamingEntryId,
      },
    },
  });
  const advancingReplayPage = {
    latestMeaningfulConversationBubble: {
      text: "Tonight's bed is yours if you keep the house easy to live in. Rinse what you use, don't vanish when something needs doing, and get a little coin in your",
    },
  };
  const completedReplayPage = {
    latestMeaningfulConversationBubble: {
      text: "Tonight's bed is yours if you keep the house easy to live in. Rinse what you use, don't vanish when something needs doing, and get a little coin in your pocket. The yard pump is already leaking, and Ada at Kettle & Lamp may still need calm hands before lunch.",
    },
  };
  const completedReplayProbe = {
    activeConversation: {
      ...advancingReplayProbe(29).activeConversation,
      replay: {
        isReplaying: false,
        revealedEntryCount: 2,
        streamedWordCount: 49,
        streamingEntryId: null,
      },
    },
  };
  const replayStep = ({ elapsedMs, page, probe, state }) =>
    responsiveLongMaraReplayWaitStep({
      absoluteMaxMs: 120_000,
      elapsedMs,
      page,
      probe,
      stallGraceMs: 15_000,
      state,
      timeoutMs: 60_000,
    });
  const lineOneProgress = {
    lineCount: 3,
    revealedEntryCount: 1,
    streamedWordCount: 29,
    streamingEntryId: "conversation-2-663",
  };
  assert.equal(
    responsiveLongMaraReplayProgressAdvanced(lineOneProgress, {
      lineCount: 3,
      revealedEntryCount: 2,
      streamedWordCount: 0,
      streamingEntryId: "conversation-3-664",
    }),
    true,
    "Revealing the next line must count as progress even when its word counter resets.",
  );
  assert.equal(
    responsiveLongMaraReplayProgressAdvanced(lineOneProgress, {
      lineCount: 3,
      revealedEntryCount: 1,
      streamedWordCount: 30,
      streamingEntryId: "conversation-3-664",
    }),
    false,
    "Changing entry identity without revealing another line must not count as progress.",
  );
  assert.equal(
    responsiveLongMaraReplayProgressCompatible(lineOneProgress, {
      lineCount: 3,
      revealedEntryCount: 1,
      streamedWordCount: 30,
      streamingEntryId: "conversation-3-664",
    }),
    false,
    "Changing entry identity without revealing another line must also clear prior grace.",
  );

  let interEntryReplay = replayStep({
    elapsedMs: 59_750,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29, {
      revealedEntryCount: 0,
      streamingEntryId: "conversation-1-662",
    }),
    state: createResponsiveLongMaraReplayWaitState(),
  });
  interEntryReplay = replayStep({
    elapsedMs: 60_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(0, {
      revealedEntryCount: 1,
      streamingEntryId: null,
    }),
    state: interEntryReplay.state,
  });
  assert.equal(
    interEntryReplay.readiness,
    "waiting",
    "A revealed-line increment into the null-id inter-entry pause must extend the replay wait.",
  );
  interEntryReplay = replayStep({
    elapsedMs: 60_500,
    page: advancingReplayPage,
    probe: advancingReplayProbe(0),
    state: interEntryReplay.state,
  });
  assert.equal(
    interEntryReplay.state.lastProgressAtMs,
    60_000,
    "Starting the next entry must preserve, but not renew, inter-entry progress grace.",
  );
  interEntryReplay = replayStep({
    elapsedMs: 61_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(1),
    state: interEntryReplay.state,
  });
  assert.equal(
    interEntryReplay.state.lastProgressAtMs,
    61_000,
    "Streaming the first word of the next entry must renew progress grace.",
  );

  let advancingReplay = replayStep({
    elapsedMs: 59_750,
    page: advancingReplayPage,
    probe: advancingReplayProbe(28),
    state: createResponsiveLongMaraReplayWaitState(),
  });
  advancingReplay = replayStep({
    elapsedMs: 60_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29),
    state: advancingReplay.state,
  });
  assert.equal(
    advancingReplay.readiness,
    "waiting",
    "The exact 29-word replay advancing at 60s must receive bounded stall grace.",
  );
  assert.equal(
    replayStep({
      elapsedMs: 65_000,
      page: completedReplayPage,
      probe: completedReplayProbe,
      state: advancingReplay.state,
    }).readiness,
    "ready",
    "An extended replay must still satisfy the complete final-text contract.",
  );

  let neverAdvancingReplay = replayStep({
    elapsedMs: 0,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29),
    state: createResponsiveLongMaraReplayWaitState(),
  });
  neverAdvancingReplay = replayStep({
    elapsedMs: 60_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29),
    state: neverAdvancingReplay.state,
  });
  assert.equal(
    neverAdvancingReplay.readiness,
    "timed_out",
    "An unchanged partial replay must not extend the base deadline.",
  );

  let stalledReplay = replayStep({
    elapsedMs: 59_750,
    page: advancingReplayPage,
    probe: advancingReplayProbe(28),
    state: createResponsiveLongMaraReplayWaitState(),
  });
  stalledReplay = replayStep({
    elapsedMs: 60_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29),
    state: stalledReplay.state,
  });
  stalledReplay = replayStep({
    elapsedMs: 75_000,
    page: advancingReplayPage,
    probe: advancingReplayProbe(29),
    state: stalledReplay.state,
  });
  assert.equal(
    stalledReplay.readiness,
    "timed_out",
    "A replay that stops advancing must time out after bounded stall grace.",
  );

  let cappedReplay = replayStep({
    elapsedMs: 59_750,
    page: advancingReplayPage,
    probe: advancingReplayProbe(28),
    state: createResponsiveLongMaraReplayWaitState(),
  });
  for (const [elapsedMs, streamedWordCount] of [
    [60_000, 29],
    [74_000, 30],
    [88_000, 31],
    [102_000, 32],
    [116_000, 33],
    [120_000, 34],
  ]) {
    cappedReplay = replayStep({
      elapsedMs,
      page: advancingReplayPage,
      probe: advancingReplayProbe(streamedWordCount),
      state: cappedReplay.state,
    });
  }
  assert.equal(
    cappedReplay.readiness,
    "timed_out",
    "Continued partial progress must not exceed the hard absolute replay cap.",
  );

  const interiorPage = {
    ...readablePage,
    cameraActiveSpaceId: "interior:boarding-house",
    cameraActiveSpaceKind: "interior",
  };
  assert.doesNotThrow(
    () =>
      assertSceneVisibilityGeometry(
        interiorPage,
        compactViewport,
        "responsive interior decision guard",
        "interior:boarding-house",
      ),
    "A coherent interior scene must satisfy compact scene primacy without requiring a street map.",
  );
}

async function waitForVisibleDecisionArtifactDom(session, label, options = {}) {
  const timeoutMs = options.timeoutMs ?? AUTOPLAY_START_TIMEOUT_MS;
  const requiredStableSamples = options.stableSamples ?? 1;
  const stabilityGraceMs =
    options.stabilityGraceMs ?? RESPONSIVE_DECISION_STABILITY_GRACE_MS;
  const stabilityMaxMs =
    options.stabilityMaxMs ?? RESPONSIVE_DECISION_STABILITY_MAX_MS;
  const startedAt = Date.now();
  const readinessDeadlineAt = startedAt + timeoutMs;
  let effectiveDeadlineAt = readinessDeadlineAt;
  let firstReadableAt = null;
  let candidateReadableAt = null;
  let lastMismatch = null;
  let readabilityState = createDecisionArtifactReadabilityState();
  const timingDiagnostic = () => ({
    effectiveTimeoutMs: effectiveDeadlineAt - startedAt,
    elapsedMs: Date.now() - startedAt,
    firstReadableElapsedMs:
      firstReadableAt === null ? null : firstReadableAt - startedAt,
    candidateReadableElapsedMs:
      candidateReadableAt === null ? null : candidateReadableAt - startedAt,
    readinessTimeoutMs: timeoutMs,
    stabilityGraceMs: requiredStableSamples > 1 ? stabilityGraceMs : 0,
    stabilityMaxMs: requiredStableSamples > 1 ? stabilityMaxMs : 0,
  });

  while (Date.now() < effectiveDeadlineAt) {
    const probe = await session.readBrowserProbe();
    const page = await session.inspectPage();
    const payload = selectedVisibleDecisionArtifactPayload(probe);
    const accepted =
      typeof options.accept === "function" ? options.accept({ page, probe }) : true;

    if (!accepted) {
      readabilityState = createDecisionArtifactReadabilityState();
      lastMismatch = {
        bodyText: page.bodyText,
        commandRail: page.commandRail,
        decisionArtifactDom: page.decisionArtifact,
        error: "Page/probe state did not satisfy the caller's readiness predicate.",
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        rail: page.rail,
        railState: page.railState,
        readabilityGeometry:
          compactDecisionArtifactReadabilityGeometry(page),
        rightStack: page.rightStack,
        selectedPayload: compactDecisionArtifactDiagnostic(payload),
        timing: timingDiagnostic(),
        url: page.url,
      };
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    try {
      assert.ok(payload, `${label}: missing visible decision artifact payload.`);
      assertVisibleDecisionArtifactDom(page.decisionArtifact, label, payload);
      const evaluatedSample = evaluateDecisionArtifactReadabilitySample(
        readabilityState,
        page,
        typeof options.assertSettledPage === "function"
          ? () => options.assertSettledPage({ page, payload, probe })
          : null,
      );
      readabilityState = evaluatedSample.state;
      if (evaluatedSample.error) {
        throw evaluatedSample.error;
      }
      if (readabilityState.stableSamples > 0 && firstReadableAt === null) {
        firstReadableAt = Date.now();
      }
      if (readabilityState.stableSamples === 1) {
        candidateReadableAt = Date.now();
      }
      if (readabilityState.stableSamples > 0) {
        effectiveDeadlineAt = responsiveDecisionReadabilityDeadlineAt({
          candidateReadableAt,
          firstReadableAt,
          readinessDeadlineAt,
          requiredStableSamples,
          stabilityGraceMs,
          stabilityMaxMs,
        });
      }
      if (
        decisionArtifactReadabilityStable(
          readabilityState,
          requiredStableSamples,
        )
      ) {
        return {
          page,
          payload,
          probe,
          readabilityState,
          timing: timingDiagnostic(),
        };
      }
      lastMismatch = {
        bodyText: page.bodyText,
        commandRail: page.commandRail,
        decisionArtifactDom: page.decisionArtifact,
        error: `Decision artifact is readable but stable for only ${readabilityState.stableSamples}/${requiredStableSamples} required samples.`,
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        rail: page.rail,
        railState: page.railState,
        readabilityGeometry: readabilityState.geometry,
        rightStack: page.rightStack,
        selectedPayload: compactDecisionArtifactDiagnostic(payload),
        timing: timingDiagnostic(),
        url: page.url,
      };
      await sleep(POLL_INTERVAL_MS);
    } catch (error) {
      readabilityState = createDecisionArtifactReadabilityState();
      lastMismatch = {
        bodyText: page.bodyText,
        commandRail: page.commandRail,
        decisionArtifactDom: page.decisionArtifact,
        error: error instanceof Error ? error.message : String(error),
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        rail: page.rail,
        railState: page.railState,
        readabilityGeometry:
          compactDecisionArtifactReadabilityGeometry(page),
        rightStack: page.rightStack,
        selectedPayload: compactDecisionArtifactDiagnostic(payload),
        timing: timingDiagnostic(),
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
      `${label}: rendered decision artifact did not match the browser probe payload within ${effectiveDeadlineAt - startedAt}ms.`,
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
        openingActionCarryForward:
          compactOpeningActionCarryForwardDiagnostic(
            probe?.openingActionCarryForward,
          ),
        probe: compactDecisionArtifactProbeDiagnostic(probe),
        url: page.url ?? null,
        visibleProgressionControls: page.visibleProgressionControls ?? null,
        watchModeReplyAffordances: page.watchModeReplyAffordances ?? null,
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

function assertBoundedVisualHierarchy(
  page,
  label,
  { requireContextualCue = false } = {},
) {
  const hierarchy = page.visualHierarchy;
  assert.ok(hierarchy, `${label}: missing visual hierarchy probe.`);
  assert.ok(
    hierarchy.persistentIdentityTreatments.length <= 1,
    `${label}: Rowan has more than one persistent identity treatment: ${JSON.stringify(hierarchy)}.`,
  );
  assert.ok(
    hierarchy.contextualCues.length <= 1,
    `${label}: Rowan has more than one contextual route/target cue: ${JSON.stringify(hierarchy)}.`,
  );
  assert.deepEqual(
    hierarchy.persistentIdentityTreatments,
    ["you-label"],
    `${label}: Rowan's persistent identity should be the single actor-attached YOU label.`,
  );
  assert.equal(
    hierarchy.actorLabels?.rowan?.lineCount,
    1,
    `${label}: Rowan identity must remain a single-line actor annotation: ${JSON.stringify(hierarchy)}.`,
  );
  assert.ok(
    (hierarchy.actorLabels?.rowan?.width ?? Infinity) <= 60 &&
      (hierarchy.actorLabels?.rowan?.height ?? Infinity) <= 18 &&
      (hierarchy.actorLabels?.rowan?.alpha ?? Infinity) <= 0.82,
    `${label}: Rowan identity plaque is visually dominant: ${JSON.stringify(hierarchy.actorLabels?.rowan)}.`,
  );
  for (const npcLabel of hierarchy.actorLabels?.npcs ?? []) {
    assert.equal(
      npcLabel.lineCount,
      1,
      `${label}: NPC identity and contextual cue are stacked: ${JSON.stringify(npcLabel)}.`,
    );
    assert.ok(
      npcLabel.width <= 100 && npcLabel.height <= 20 && npcLabel.alpha <= 0.9,
      `${label}: NPC identity plaque is visually dominant: ${JSON.stringify(npcLabel)}.`,
    );
  }
  assert.equal(
    hierarchy.intentLabelVisible,
    false,
    `${label}: the old player intent label is still visible beside the route/target cue.`,
  );
  if (requireContextualCue) {
    assert.ok(
      hierarchy.hasTarget || hierarchy.hasRoute,
      `${label}: bounded hierarchy lost both the current target and active route.`,
    );
  }
}

function assertNoDecisionActionRailDuplication(page, label) {
  const decisionChoice = page.railNarrative?.decisionChoice?.trim() ?? "";
  if (!decisionChoice) {
    return;
  }

  const normalizedChoice = decisionChoice.toLowerCase();
  const target = normalizedChoice.match(
    /\b(?:talk to|ask|speak with)\s+([a-z][a-z'-]*)/i,
  )?.[1];
  const candidates = [
    ["passive watch status", page.railNarrative?.passiveWatchStatus],
    ["Next card", page.railNarrative?.next],
  ];
  for (const [surface, copy] of candidates) {
    const normalizedCopy = copy?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    if (!normalizedCopy) {
      continue;
    }
    const repeatsExactAction =
      normalizedCopy.includes(normalizedChoice) ||
      (target &&
        normalizedCopy.includes(target.toLowerCase()) &&
        /\b(?:ask|talk|speak|conversation)\b/i.test(normalizedCopy));
    const repeatsGenericConversation =
      /\b(?:talk|ask|speak)\b/i.test(normalizedChoice) &&
      /\bnext conversation automatically\b/i.test(normalizedCopy);
    assert.equal(
      Boolean(repeatsExactAction || repeatsGenericConversation),
      false,
      `${label}: ${surface} repeats the decision action "${decisionChoice}": ${copy}`,
    );
  }
}

function assertDecisionHierarchy(page, label, artifactPayload) {
  assert.equal(
    page.decisionArtifactCount,
    1,
    `${label}: aim/choice/rationale summary is repeated in ${page.decisionArtifactCount} decision artifacts.`,
  );
  assertNoDecisionActionRailDuplication(page, label);
  for (const field of ["aim", "choice", "rationale"]) {
    assert.equal(
      page.decisionFieldCounts[field],
      1,
      `${label}: decision field ${field} must appear exactly once.`,
    );
  }
  assert.equal(
    page.decisionFieldCounts["next-check"],
    artifactPayload?.nextCheck ? 1 : 0,
    `${label}: next check must appear once when supplied and nowhere else.`,
  );
  const hasDeeperEvidence = Boolean(
    artifactPayload?.constraints?.length ||
      artifactPayload?.considered?.length ||
      artifactPayload?.passedOver?.length,
  );
  if (page.liveConversationWorkspace) {
    assert.equal(
      page.decisionDetailsOpen,
      null,
      `${label}: compact live decision must not duplicate deeper evidence in a second control.`,
    );
    assert.equal(
      page.decisionFieldCounts.signals,
      artifactPayload?.constraints?.length ? 1 : 0,
      `${label}: compact live decision signals must appear exactly once when supplied.`,
    );
    assert.equal(
      page.decisionFieldCounts.options,
      artifactPayload?.considered?.length ? 1 : 0,
      `${label}: compact live decision options must appear exactly once when supplied.`,
    );
    return;
  }
  assert.equal(
    page.decisionDetailsOpen,
    hasDeeperEvidence ? false : null,
    `${label}: evidence/options should remain available on demand, not expanded by default.`,
  );
}

function assertOverlayGeometry(
  page,
  viewport,
  label,
  expectedHudText,
  expectedSpaceId = null,
) {
  const viewportBottom = viewport.height;
  const viewportRight = viewport.width;
  const rectBottom = (rect) => rect?.bottom ?? rect?.y + rect?.height;
  const rectRight = (rect) => rect?.right ?? rect?.x + rect?.width;
  const insideViewport = (rect) =>
    rect &&
    rect.x >= -1 &&
    rect.y >= -1 &&
    rectRight(rect) <= viewportRight + 1 &&
    rectBottom(rect) <= viewportBottom + 1;

  assert.ok(page.timePill, `${label}: top HUD is missing.`);
  assert.ok(
    page.timePillComputedStyle,
    `${label}: top HUD computed style is missing.`,
  );
  assert.notEqual(
    page.timePillComputedStyle.display,
    "none",
    `${label}: top HUD computed display is none.`,
  );
  assert.equal(
    page.timePillComputedStyle.visibility,
    "visible",
    `${label}: top HUD computed visibility is ${page.timePillComputedStyle.visibility}.`,
  );
  assert.notEqual(
    page.timePillComputedStyle.contentVisibility,
    "hidden",
    `${label}: top HUD content visibility is hidden.`,
  );
  assert.ok(
    page.timePillComputedStyle.opacity >= 0.99,
    `${label}: top HUD computed opacity is ${page.timePillComputedStyle.opacity}.`,
  );
  assert.ok(
    insideViewport(page.timePill),
    `${label}: top HUD is clipped outside ${viewport.width}x${viewport.height}: ${JSON.stringify(page.timePill)}.`,
  );
  assert.ok(
    page.visibleTimeChips.length >= 3,
    `${label}: top HUD lost visible day/time/resource content: ${JSON.stringify(page.visibleTimeChips)}.`,
  );
  assert.equal(
    page.visibleTimeChipStyles.length,
    page.visibleTimeChips.length,
    `${label}: HUD chip style probe diverged from visible text.`,
  );
  assert.ok(
    page.visibleTimeGlyphStyles.length >= page.visibleTimeChips.length + 1,
    `${label}: HUD glyph probe did not expose each visible text run: ${JSON.stringify(page.visibleTimeGlyphStyles)}.`,
  );
  for (const chip of page.visibleTimeChipStyles) {
    assert.notEqual(
      chip.display,
      "none",
      `${label}: HUD chip "${chip.text}" computed display is none.`,
    );
    assert.equal(
      chip.visibility,
      "visible",
      `${label}: HUD chip "${chip.text}" computed visibility is ${chip.visibility}.`,
    );
    assert.notEqual(
      chip.contentVisibility,
      "hidden",
      `${label}: HUD chip "${chip.text}" content visibility is hidden.`,
    );
    assert.ok(
      chip.opacity >= 0.99,
      `${label}: HUD chip "${chip.text}" computed opacity is ${chip.opacity}.`,
    );
    assert.ok(
      chip.rect.left >= page.timePill.x - 1 &&
        chip.rect.right <= page.timePill.x + page.timePill.width + 1 &&
        chip.rect.top >= page.timePill.y - 1 &&
        chip.rect.bottom <= page.timePill.bottom + 1,
      `${label}: HUD chip "${chip.text}" is clipped outside the pill: ${JSON.stringify(chip.rect)}.`,
    );
  }
  for (const run of page.visibleTimeGlyphStyles) {
    assert.equal(
      run.visibility,
      "visible",
      `${label}: HUD text run "${run.text}" computed visibility is ${run.visibility}.`,
    );
    assert.ok(
      run.opacity >= 0.99,
      `${label}: HUD text run "${run.text}" computed opacity is ${run.opacity}.`,
    );
    assert.ok(
      run.rect.left >= page.timePill.x - 1 &&
        run.rect.right <= page.timePill.x + page.timePill.width + 1 &&
        run.rect.top >= page.timePill.y - 1 &&
        run.rect.bottom <= page.timePill.bottom + 1,
      `${label}: HUD text run "${run.text}" is clipped outside the pill: ${JSON.stringify(run.rect)}.`,
    );
  }
  if (expectedHudText) {
    assert.deepEqual(
      page.visibleTimeChips,
      expectedHudText,
      `${label}: HUD contents changed or disappeared after overlay/camera interaction.`,
    );
  }

  assert.ok(insideViewport(page.rightStack), `${label}: rail is clipped.`);
  assert.ok(insideViewport(page.dockRoot), `${label}: dock is clipped.`);
  const rail = page.rightStack;
  const dock = page.dockRoot;
  const overlapsX = rail.x < rectRight(dock) && rectRight(rail) > dock.x;
  const overlapsY = rail.y < rectBottom(dock) && rectBottom(rail) > dock.y;
  const clearance = overlapsX
    ? Math.max(dock.y - rectBottom(rail), rail.y - rectBottom(dock))
    : overlapsY
      ? Math.max(dock.x - rectRight(rail), rail.x - rectRight(dock))
      : Math.max(
          dock.y - rectBottom(rail),
          rail.y - rectBottom(dock),
          dock.x - rectRight(rail),
          rail.x - rectRight(dock),
        );
  assert.ok(
    clearance >= 8,
    `${label}: rail-to-dock clearance is ${clearance}px; expected at least 8px. Rail ${JSON.stringify(rail)}, dock ${JSON.stringify(dock)}.`,
  );

  assertSceneVisibilityGeometry(page, viewport, label, expectedSpaceId);
}

function assertSceneVisibilityGeometry(
  page,
  viewport,
  label,
  expectedSpaceId = null,
) {
  if (viewport.width > 960) {
    return;
  }

  assert.ok(
    page.cameraActiveSpaceId,
    `${label}: the active scene camera probe is missing.`,
  );
  if (expectedSpaceId) {
    assert.equal(
      page.cameraActiveSpaceId,
      expectedSpaceId,
      `${label}: camera scene ${page.cameraActiveSpaceId} does not match active space ${expectedSpaceId}.`,
    );
  }

  const minimumSceneVisibleFraction = viewport.width <= 560 ? 0.45 : 0.5;
  assert.ok(
    Number.isFinite(page.sceneVisibleFraction) &&
      page.sceneVisibleFraction >= minimumSceneVisibleFraction,
    `${label}: only ${page.sceneVisibleFraction} of the active scene remains visible; expected at least ${minimumSceneVisibleFraction}. Scene viewport: ${JSON.stringify(page.sceneViewportCss)}.`,
  );
}

function assertExpandedRailScroll(page, label) {
  if (page.liveConversationWorkspace) {
    assert.ok(
      page.liveConversationTranscript,
      `${label}: live conversation has no internal transcript scroller.`,
    );
    assert.match(
      page.liveConversationTranscript.overflowY,
      /auto|scroll/,
      `${label}: live transcript overflow is ${page.liveConversationTranscript.overflowY}, not internally scrollable.`,
    );
    assert.ok(
      page.liveConversationTranscript.clientHeight > 0 &&
        page.liveConversationTranscript.scrollHeight >=
          page.liveConversationTranscript.clientHeight,
      `${label}: live transcript scroller has invalid dimensions ${JSON.stringify(
        page.liveConversationTranscript,
      )}.`,
    );
    return;
  }
  assert.ok(page.commandRail, `${label}: expanded rail has no internal scroller.`);
  assert.match(
    page.commandRail.overflowY,
    /auto|scroll/,
    `${label}: expanded rail overflow is ${page.commandRail.overflowY}, not internally scrollable.`,
  );
  assert.ok(
    page.commandRail.clientHeight > 0 &&
      page.commandRail.scrollHeight >= page.commandRail.clientHeight,
    `${label}: expanded rail scroller has invalid dimensions ${JSON.stringify(page.commandRail)}.`,
  );
}

function cameraPointDistance(first, second) {
  return Math.hypot(
    (second?.x ?? 0) - (first?.x ?? 0),
    (second?.y ?? 0) - (first?.y ?? 0),
  );
}

function projectCameraWorldPoint(camera, worldPoint) {
  const scene = camera?.sceneViewportCss;
  const worldView = camera?.renderedWorldView;
  assert.ok(scene, "Camera projection is missing the CSS scene viewport.");
  assert.ok(
    worldView &&
      Number.isFinite(worldView.width) &&
      worldView.width > 0 &&
      Number.isFinite(worldView.height) &&
      worldView.height > 0,
    `Camera projection has invalid rendered world view ${JSON.stringify(worldView)}.`,
  );
  assert.ok(worldPoint, "Camera projection is missing a world point.");
  return {
    x:
      scene.x +
      ((worldPoint.x - worldView.left) / worldView.width) * scene.width,
    y:
      scene.y +
      ((worldPoint.y - worldView.top) / worldView.height) * scene.height,
  };
}

function normalizePageRect(rect) {
  if (!rect) {
    return null;
  }
  return {
    bottom: rect.bottom ?? rect.y + rect.height,
    left: rect.left ?? rect.x,
    right: rect.right ?? rect.x + rect.width,
    top: rect.top ?? rect.y,
  };
}

function getUnobscuredSceneBoundsAtX(page, x) {
  const scene = normalizePageRect(page.sceneViewportCss);
  assert.ok(scene, "Unobscured scene geometry is missing the scene viewport.");
  let bottom = scene.bottom;
  for (const blocker of [page.rightStack, page.dockRoot]
    .map(normalizePageRect)
    .filter(Boolean)) {
    const overlapsScene =
      blocker.bottom > scene.top &&
      blocker.top < scene.bottom &&
      blocker.right > scene.left &&
      blocker.left < scene.right;
    if (
      overlapsScene &&
      x >= blocker.left - 0.5 &&
      x <= blocker.right + 0.5
    ) {
      bottom = Math.min(bottom, Math.max(blocker.top, scene.top));
    }
  }
  return {
    ...scene,
    bottom,
  };
}

function assertInteriorCameraPointsUnobscured(page, camera, label) {
  const diagnostics = {};
  for (const [name, worldPoint] of [
    ["player", camera.playerWorldPoint],
    ["follow", camera.followWorldPoint],
  ]) {
    const screenPoint = projectCameraWorldPoint(camera, worldPoint);
    const visible = getUnobscuredSceneBoundsAtX(page, screenPoint.x);
    const horizontalMargin = 12;
    const verticalMargin = 24;
    assert.ok(
      screenPoint.x >= visible.left + horizontalMargin &&
        screenPoint.x <= visible.right - horizontalMargin &&
        screenPoint.y >= visible.top + verticalMargin &&
        screenPoint.y <= visible.bottom - verticalMargin,
      `${label}: ${name} point is not inside the unobscured scene region: ${JSON.stringify({
        camera: {
          renderedWorldView: camera.renderedWorldView,
          safeFrameCss: camera.safeFrameCss,
          scroll: camera.scroll,
          scrollRange: camera.scrollRange,
        },
        screenPoint,
        visible,
        worldPoint,
      })}.`,
    );
    diagnostics[name] = {
      screenPoint: {
        x: Number(screenPoint.x.toFixed(2)),
        y: Number(screenPoint.y.toFixed(2)),
      },
      visible,
      worldPoint,
    };
  }

  const safeFrame = normalizePageRect(camera.safeFrameCss);
  if (safeFrame) {
    const expected = Object.values(diagnostics).reduce(
      (combined, point) => ({
        ...combined,
        bottom: Math.min(combined.bottom, point.visible.bottom),
      }),
      normalizePageRect(page.sceneViewportCss),
    );
    assert.ok(
      Math.abs(safeFrame.top - expected.top) <= 2 &&
        Math.abs(safeFrame.bottom - expected.bottom) <= 2,
      `${label}: camera safe frame does not match the live overlay occlusion: ${JSON.stringify({
        expected,
        safeFrame,
      })}.`,
    );
  }

  return diagnostics;
}

function assertMorrowHouseRelevantActorsUnobscured(
  page,
  camera,
  label,
  viewport,
  stateId,
) {
  const actors = {};
  for (const [name, worldPoint, worldExtents] of [
    [
      "mara",
      MORROW_HOUSE_MARA_WORLD_POINT,
      MORROW_HOUSE_MARA_WORLD_EXTENTS,
    ],
    ["rowan", camera.playerWorldPoint, ROWAN_WORLD_EXTENTS],
  ]) {
    const screenPoint = projectCameraWorldPoint(camera, worldPoint);
    const topLeft = projectCameraWorldPoint(camera, {
      x: worldPoint.x - worldExtents.halfWidth,
      y: worldPoint.y - worldExtents.halfHeight,
    });
    const bottomRight = projectCameraWorldPoint(camera, {
      x: worldPoint.x + worldExtents.halfWidth,
      y: worldPoint.y + worldExtents.halfHeight,
    });
    const bounds = {
      bottom: bottomRight.y,
      height: bottomRight.y - topLeft.y,
      left: topLeft.x,
      right: bottomRight.x,
      top: topLeft.y,
      width: bottomRight.x - topLeft.x,
    };
    const visibleSlices = [
      bounds.left + 1,
      screenPoint.x,
      bounds.right - 1,
    ].map((x) => getUnobscuredSceneBoundsAtX(page, x));
    const visible = {
      bottom: Math.min(...visibleSlices.map((slice) => slice.bottom)),
      left: Math.max(...visibleSlices.map((slice) => slice.left)),
      right: Math.min(...visibleSlices.map((slice) => slice.right)),
      top: Math.max(...visibleSlices.map((slice) => slice.top)),
    };
    const clearance = Math.min(
      bounds.left - visible.left,
      visible.right - bounds.right,
      bounds.top - visible.top,
      visible.bottom - bounds.bottom,
    );
    const unobscured = clearance >= INTERIOR_ACTOR_EDGE_MARGIN_PX;
    assert.ok(
      unobscured,
      `${label}: ${name}'s full sprite bounds lack ${INTERIOR_ACTOR_EDGE_MARGIN_PX}px of unobscured breathing room: ${JSON.stringify({
        bounds,
        clearance: Number(clearance.toFixed(2)),
        screenPoint,
        visible,
        worldPoint,
      })}.`,
    );
    actors[name] = {
      bounds: Object.fromEntries(
        Object.entries(bounds).map(([key, value]) => [
          key,
          Number(value.toFixed(2)),
        ]),
      ),
      clearance: Number(clearance.toFixed(2)),
      requiredMargin: INTERIOR_ACTOR_EDGE_MARGIN_PX,
      screenPoint: {
        x: Number(screenPoint.x.toFixed(2)),
        y: Number(screenPoint.y.toFixed(2)),
      },
      unobscured,
      worldPoint,
    };
  }

  const portalPoint = projectCameraWorldPoint(
    camera,
    MORROW_HOUSE_PORTAL_WORLD_POINT,
  );
  const portalVisible = getUnobscuredSceneBoundsAtX(page, portalPoint.x);
  const portalClearance = Math.min(
    portalPoint.x - portalVisible.left,
    portalVisible.right - portalPoint.x,
    portalPoint.y - portalVisible.top,
    portalVisible.bottom - portalPoint.y,
  );
  const portalUnobscured =
    portalClearance >= INTERIOR_PORTAL_EDGE_MARGIN_PX;
  assert.ok(
    portalUnobscured,
    `${label}: the Morrow House portal/action point lacks ${INTERIOR_PORTAL_EDGE_MARGIN_PX}px of unobscured clearance: ${JSON.stringify({
      clearance: Number(portalClearance.toFixed(2)),
      screenPoint: portalPoint,
      visible: portalVisible,
      worldPoint: MORROW_HOUSE_PORTAL_WORLD_POINT,
    })}.`,
  );
  actors.portal = {
    clearance: Number(portalClearance.toFixed(2)),
    requiredMargin: INTERIOR_PORTAL_EDGE_MARGIN_PX,
    screenPoint: {
      x: Number(portalPoint.x.toFixed(2)),
      y: Number(portalPoint.y.toFixed(2)),
    },
    unobscured: portalUnobscured,
    worldPoint: MORROW_HOUSE_PORTAL_WORLD_POINT,
  };

  const diagnostics = {
    actors,
    label,
    playerWorldPoint: camera.playerWorldPoint,
    relevantActorId: "npc-mara",
    role: "boarding-house",
    stateId,
    viewport: viewport.name,
  };
  interiorActorVisibilityDiagnostics.push(diagnostics);
  return diagnostics;
}

function assertInteriorTitleInsideScene(camera, label) {
  const bounds = camera.interiorTitleWorldBounds;
  assert.ok(bounds, `${label}: missing interior title world bounds.`);
  const topLeft = projectCameraWorldPoint(camera, {
    x: bounds.left,
    y: bounds.top,
  });
  const bottomRight = projectCameraWorldPoint(camera, {
    x: bounds.right,
    y: bounds.bottom,
  });
  const scene = normalizePageRect(camera.sceneViewportCss);
  const margin = 3;
  assert.ok(
    topLeft.x >= scene.left + margin &&
      bottomRight.x <= scene.right - margin &&
      topLeft.y >= scene.top + margin &&
      bottomRight.y <= scene.bottom - margin,
    `${label}: interior title is clipped by the camera viewport: ${JSON.stringify({
      projected: {
        bottom: bottomRight.y,
        left: topLeft.x,
        right: bottomRight.x,
        top: topLeft.y,
      },
      scene,
      worldBounds: bounds,
    })}.`,
  );
  const projectedWidth = bottomRight.x - topLeft.x;
  const projectedHeight = bottomRight.y - topLeft.y;
  const sceneWidth = scene.right - scene.left;
  assert.ok(
    projectedWidth <= sceneWidth * 0.46 && projectedHeight <= 34,
    `${label}: interior title dominates the room instead of acting as a secondary orientation label: ${JSON.stringify({
      projectedHeight,
      projectedWidth,
      scene,
      sceneWidth,
      worldBounds: bounds,
    })}.`,
  );
  return {
    bottom: Number(bottomRight.y.toFixed(2)),
    height: Number(projectedHeight.toFixed(2)),
    left: Number(topLeft.x.toFixed(2)),
    right: Number(bottomRight.x.toFixed(2)),
    top: Number(topLeft.y.toFixed(2)),
    width: Number(projectedWidth.toFixed(2)),
  };
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
  if (openingActionHasAutoplayProgressed(openingProbe)) {
    return openingProbe;
  }

  const readAdvancedProbe = async () => {
    const probe = await session.readBrowserProbe();
    if (!probe?.watchMode?.enabled || probe.watchMode?.frozen) {
      return false;
    }

    const advanced =
      openingActionHasAutoplayProgressed(probe) ||
      probe.clock?.totalMinutes > openingProbe.clock?.totalMinutes ||
      probe.autonomy?.key !== openingProbe.autonomy?.key ||
      probe.location?.id !== openingProbe.location?.id ||
      Boolean(probe.activeConversation?.npcId);

    return advanced ? probe : false;
  };
  const openingDiagnostic = compactDecisionArtifactProbeDiagnostic(openingProbe);

  try {
    return await waitFor(
      readAdvancedProbe,
      AUTOPLAY_START_TIMEOUT_MS,
      `${label} did not leave the opening Watch Rowan begin state within ${AUTOPLAY_START_TIMEOUT_MS}ms. Opening state: ${JSON.stringify(
        openingDiagnostic,
      )}`,
    );
  } catch (error) {
    const latestProbe = await session.readBrowserProbe();
    if (
      !openingActionNeedsNearArrivalGrace(openingProbe) &&
      !openingActionNeedsNearArrivalGrace(latestProbe)
    ) {
      throw new Error(
        `${error.message} Latest state: ${JSON.stringify(
          compactDecisionArtifactProbeDiagnostic(latestProbe),
        )}`,
        { cause: error },
      );
    }

    return waitFor(
      readAdvancedProbe,
      AUTOPLAY_NEAR_ARRIVAL_GRACE_MS,
      `${label} reached a legal route at ${Math.round(
        AUTOPLAY_NEAR_ARRIVAL_MIN_PROGRESS * 100,
      )}%+ but did not complete the autonomous opening transition within the additional ${AUTOPLAY_NEAR_ARRIVAL_GRACE_MS}ms. Opening state: ${JSON.stringify(
        openingDiagnostic,
      )}. Latest state: ${JSON.stringify(
        compactDecisionArtifactProbeDiagnostic(latestProbe),
      )}`,
    );
  }
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
  const openingAlreadyProgressed =
    openingActionHasAutoplayProgressed(openingProbe);
  if (openingAlreadyProgressed) {
    const mapShowsKettle = assertKettleMapAgencyTargetCorrelation(
      openingMapAgency,
      "fresh autoplay opening progressed",
    );
    const mapShowsGroundedMorrowEntry = hasGroundedNearMorrowEntryAgency(
      openingMapAgency,
      openingProbe,
    );
    assert.ok(
      mapShowsKettle ||
        mapShowsGroundedMorrowEntry ||
        Boolean(openingProbe.activeConversation?.npcId) ||
        openingProbe.location?.id === "tea-house",
      `fresh autoplay opening already progressed, but map agency did not show the next first-run target: ${JSON.stringify(
        {
          mapAgency: openingMapAgency,
          opening: compactOpeningActionCarryForwardDiagnostic(
            openingProbe.openingActionCarryForward,
          ),
        },
      )}.`,
    );
  } else {
    assertMorrowMapAgencyTargetCorrelation(
      openingMapAgency,
      "fresh autoplay opening",
    );
    assertKettleMapAgencyTargetCorrelation(
      openingMapAgency,
      "fresh autoplay opening",
    );
  }
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
      assertSettledPage: ({ page, probe }) => {
        if (probe?.activeConversation?.npcId) {
          assertLiveConversationDecisionAndBubbleReadable(
            page,
            "fresh autoplay live conversation",
          );
        }
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
    assertLiveConversationDecisionAndBubbleReadable(
      page,
      "fresh autoplay live conversation",
    );
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
  await captureValidatedScreenshot({
    expectedHudText: page.visibleTimeChips,
    label: "fresh autoplay",
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });

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
      openingAlreadyProgressed,
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
  const previousGameId = (await session.readBrowserProbe())?.gameId ?? null;
  await session.setViewport(viewport);
  await session.navigate(url);
  await session.waitForAppReady();

  const openingProbe = await waitFor(
    async () => {
      const probe = await session.readBrowserProbe();
      if (
        !probe?.gameId ||
        probe.gameId === previousGameId ||
        probe.watchMode?.enabled !== false ||
        probe.openingActionCarryForward?.requiredVisibleInput !== true
      ) {
        return null;
      }
      return probe;
    },
    AUTOPLAY_START_TIMEOUT_MS,
    "Timed out waiting for a distinct fresh manual opening after autoplay opt-out.",
  );
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

async function createLongMaraDecisionArtifactGame() {
  const gameId = await createSmokeGame(
    activeWebBase,
    "Long Mara decision artifact check",
  );
  let game = null;
  let advanceCount = 0;
  while (advanceCount < 12 && game?.activeConversation?.npcId !== "npc-mara") {
    const advanced = await fetchJson(
      `${activeWebBase}/sim/game/${gameId}/command`,
      {
        body: JSON.stringify({
          allowTimeSkip: true,
          type: "advance_objective",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      30_000,
    );
    game = advanced?.game ?? null;
    advanceCount += 1;
  }
  assert.equal(
    game?.activeConversation?.npcId,
    "npc-mara",
    `Long Mara decision artifact check did not reach Mara's live conversation after ${advanceCount} objective advances.`,
  );
  const groundedDecision = [
    game?.activeConversation?.decision,
    game?.activeConversation?.objectiveText,
    game?.rowanAutonomy?.planningTrace?.nextSteps?.[0]?.rationale,
  ]
    .filter(Boolean)
    .join(" ");
  assert.match(
    groundedDecision,
    /(?:\bAda\b[\s\S]*\bpump\b|\bpump\b[\s\S]*\bAda\b)/i,
    "Long Mara decision artifact check did not produce the state-backed Ada/pump comparison.",
  );

  return {
    advanceCount,
    decision: groundedDecision,
    gameId,
  };
}

function responsiveDecisionViewports() {
  if (requestedViewportName) {
    const requested = VIEWPORTS.find(
      (viewport) => viewport.name === requestedViewportName,
    );
    if (requested && RESPONSIVE_DECISION_VIEWPORT_NAMES.has(requested.name)) {
      return [requested];
    }
    return [
      VIEWPORTS.find((viewport) => viewport.name === "codex-compact"),
    ].filter(Boolean);
  }
  return VIEWPORTS.filter((viewport) =>
    RESPONSIVE_DECISION_VIEWPORT_NAMES.has(viewport.name),
  );
}

async function waitForResponsiveDecisionCameraProbe(
  session,
  viewport,
  expectedSpaceId,
  label,
) {
  const startedAt = Date.now();
  let lastGeometry = null;
  let recoveryCount = 0;

  while (Date.now() - startedAt < RESPONSIVE_DECISION_READABILITY_TIMEOUT_MS) {
    const page = await session.inspectPage();
    lastGeometry = compactDecisionArtifactReadabilityGeometry(page);
    if (
      decisionArtifactCameraProbeReady(page) &&
      (!expectedSpaceId || page.cameraActiveSpaceId === expectedSpaceId)
    ) {
      return {
        activeSpaceId: page.cameraActiveSpaceId,
        activeSpaceKind: page.cameraActiveSpaceKind,
        recoveryCount,
        sceneVisibleFraction: page.sceneVisibleFraction,
        waitedMs: Date.now() - startedAt,
      };
    }

    if (
      recoveryCount === 0 &&
      Date.now() - startedAt >= RESPONSIVE_DECISION_CAMERA_RECOVERY_GRACE_MS
    ) {
      await session.setViewport({
        ...viewport,
        height: viewport.height - 1,
      });
      await sleep(POLL_INTERVAL_MS);
      await session.setViewport(viewport);
      recoveryCount += 1;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `${label}: active scene camera probe did not recover before decision sampling: ${JSON.stringify(lastGeometry)}.`,
  );
}

async function waitForResponsiveLongMaraReplayCompletion(session, label) {
  const startedAt = Date.now();
  let lastPage = null;
  let lastProbe = null;
  let waitState = createResponsiveLongMaraReplayWaitState();

  while (true) {
    lastProbe = await session.readBrowserProbe();
    lastPage = await session.inspectPage();
    const elapsedMs = Date.now() - startedAt;
    const step = responsiveLongMaraReplayWaitStep({
      absoluteMaxMs: RESPONSIVE_DECISION_REPLAY_COMPLETION_MAX_MS,
      elapsedMs,
      page: lastPage,
      probe: lastProbe,
      stallGraceMs:
        RESPONSIVE_DECISION_REPLAY_PROGRESS_STALL_GRACE_MS,
      state: waitState,
      timeoutMs: RESPONSIVE_DECISION_REPLAY_COMPLETION_TIMEOUT_MS,
    });
    waitState = step.state;
    if (step.readiness === "ready") {
      return {
        replay: lastProbe?.activeConversation?.replay ?? null,
        waitedMs: elapsedMs,
      };
    }
    if (step.readiness === "timed_out") {
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `${label}: deterministic Mara replay did not complete within the ${RESPONSIVE_DECISION_REPLAY_COMPLETION_TIMEOUT_MS}ms base deadline plus bounded advancing-replay grace (absolute cap ${RESPONSIVE_DECISION_REPLAY_COMPLETION_MAX_MS}ms): ${JSON.stringify({
      latestMeaningfulConversationBubble:
        lastPage?.latestMeaningfulConversationBubble ?? null,
      probe: compactDecisionArtifactProbeDiagnostic(lastProbe),
      replayProgress: waitState,
    })}.`,
  );
}

async function runResponsiveDecisionArtifactCheck(session) {
  const { gameId } = await createLongMaraDecisionArtifactGame();
  const results = [];

  for (const viewport of responsiveDecisionViewports()) {
    await session.setViewport(viewport);
    await session.navigate(
      `${activeWebBase}/?freezeAutoplay=1&responsiveDecisionLongMara=${viewport.name}-${Date.now()}&gameId=${encodeURIComponent(gameId)}`,
    );
    await session.waitForAppReady();
    await session.waitForWatchModeUi(viewport);
    const frozenProbe = await waitFor(
      async () => {
        const probe = await session.readBrowserProbe();
        const payload = selectedVisibleDecisionArtifactPayload(probe);
        if (
          probe?.gameId !== gameId ||
          probe.watchMode?.frozen !== true ||
          probe.activeConversation?.npcId !== "npc-mara" ||
          !/^With Mara$/i.test(probe.autonomy?.label ?? "") ||
          !payload
        ) {
          return null;
        }
        return probe;
      },
      APP_READY_TIMEOUT_MS,
      `${viewport.name}: timed out waiting for the deterministic long Mara decision artifact.`,
    );
    const frozenPayload = selectedVisibleDecisionArtifactPayload(frozenProbe);
    assertVisibleDecisionArtifactPayload(
      frozenPayload,
      `${viewport.name} long Mara responsive decision probe`,
      frozenProbe.autonomy?.planningTrace,
    );
    assert.ok(
      (frozenPayload?.objective.length ?? 0) >= 80 &&
        (frozenPayload?.nextCheck?.length ?? 0) >= 60 &&
        (frozenPayload?.rationale.length ?? 0) >= 60,
      `${viewport.name}: deterministic Mara artifact no longer exercises long aim, next-check, and rationale copy.`,
    );

    const initialPage = await session.inspectPage();
    if (initialPage.railState !== "expanded") {
      await session.clickSelector(".ml-rail-toggle");
    }
    const cameraReadiness = await waitForResponsiveDecisionCameraProbe(
      session,
      viewport,
      frozenProbe.location?.spaceId ?? null,
      `${viewport.name} long Mara responsive decision camera`,
    );
    const replayReadiness =
      await waitForResponsiveLongMaraReplayCompletion(
        session,
        `${viewport.name} long Mara responsive decision replay`,
      );
    const readableRail = await waitForVisibleDecisionArtifactDom(
      session,
      `${viewport.name} long Mara responsive decision rail`,
      {
        accept: ({ page, probe }) =>
          page.railState === "expanded" &&
          responsiveLongMaraReplayComplete(page, probe),
        assertSettledPage: ({ page, payload, probe }) => {
          assertDecisionHierarchy(
            page,
            `${viewport.name} long Mara responsive decision hierarchy`,
            payload,
          );
          assertDecisionFieldsFullyVisible(
            page,
            `${viewport.name} long Mara responsive decision`,
          );
          assertLiveConversationDecisionAndBubbleReadable(
            page,
            `${viewport.name} long Mara responsive decision`,
          );
          assertOverlayGeometry(
            page,
            viewport,
            `${viewport.name} long Mara responsive decision expanded`,
            page.visibleTimeChips,
            probe.location?.spaceId ?? null,
          );
          assertExpandedRailScroll(
            page,
            `${viewport.name} long Mara responsive decision expanded`,
          );
          assertBoundedVisualHierarchy(
            page,
            `${viewport.name} long Mara responsive decision expanded`,
          );
        },
        stableSamples: RESPONSIVE_DECISION_STABLE_SAMPLE_COUNT,
        timeoutMs: RESPONSIVE_DECISION_READABILITY_TIMEOUT_MS,
      },
    );
    const page = readableRail.page;
    const readablePayload = readableRail.payload;
    assert.equal(
      page.railState,
      "expanded",
      `${viewport.name}: responsive decision check could not expand the rail.`,
    );
    assertVisibleDecisionArtifactDom(
      page.decisionArtifact,
      `${viewport.name} long Mara responsive decision rail`,
      readablePayload,
    );
    assertDecisionHierarchy(
      page,
      `${viewport.name} long Mara responsive decision hierarchy`,
      readablePayload,
    );
    assertDecisionFieldsFullyVisible(
      page,
      `${viewport.name} long Mara responsive decision`,
    );
    assertLiveConversationDecisionAndBubbleReadable(
      page,
      `${viewport.name} long Mara responsive decision`,
    );
    assertOverlayGeometry(
      page,
      viewport,
      `${viewport.name} long Mara responsive decision expanded`,
      page.visibleTimeChips,
      readableRail.probe.location?.spaceId ?? null,
    );
    assertExpandedRailScroll(
      page,
      `${viewport.name} long Mara responsive decision expanded`,
    );
    assertBoundedVisualHierarchy(
      page,
      `${viewport.name} long Mara responsive decision expanded`,
    );
    assertNoWatchModeReplyAffordances(
      page,
      `${viewport.name} long Mara responsive decision`,
    );

    const screenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-decision-artifact.png`,
    );
    await captureValidatedScreenshot({
      expectedHudText: page.visibleTimeChips,
      label: `${viewport.name} long Mara responsive decision`,
      page,
      session,
      targetPath: screenshotPath,
      viewport,
    });
    results.push({
      cameraReadiness,
      expandedDecisionArtifact: page.decisionArtifact,
      expandedGeometry: compactDecisionArtifactReadabilityGeometry(page),
      probe: compactDecisionArtifactProbeDiagnostic(frozenProbe),
      readabilityTiming: readableRail.timing,
      replayReadiness,
      screenshotPath,
      viewport,
    });
  }

  return {
    gameId,
    results,
  };
}

async function runViewportCheck(session, viewport) {
  const eastWaterfrontViewportDiagnostics = [];
  let eastWaterfrontCoverage = null;
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
  const expectedHudText = page.visibleTimeChips;
  assertOverlayGeometry(page, viewport, `${viewport.name} collapsed`, expectedHudText);
  assertBoundedVisualHierarchy(page, `${viewport.name} collapsed`);

  const screenshotPath = path.join(OUTPUT_DIR, `${viewport.name}.png`);
  const initialCamera = await session.readCameraProbe();
  assert.ok(initialCamera, `${viewport.name}: missing initial camera probe.`);
  const initialCapture = await captureValidatedScreenshot({
    expectedHudText,
    label: `${viewport.name} initial`,
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });
  let secondaryLandmarksScreenshotPath = null;
  if (viewport.name === "desktop") {
    assertMorrowYardCompositionPixels(
      initialCapture.screenshot,
      initialCamera,
      initialCapture.page,
      viewport,
      "desktop Morrow Yard",
    );
    assertPilgrimSlipCompositionPixels(
      initialCapture.screenshot,
      initialCamera,
      initialCapture.page,
      viewport,
      "desktop Pilgrim Slip",
    );
    secondaryLandmarksScreenshotPath = path.join(
      OUTPUT_DIR,
      "secondary-landmarks-desktop.png",
    );
    await writeFile(secondaryLandmarksScreenshotPath, initialCapture.screenshot);
  }

  const mapAgency = await session.waitForMapAgencyProbe(viewport);
  assert.ok(mapAgency?.intent, `${viewport.name}: missing in-map agency cue.`);
  assert.ok(
    mapAgency.target?.label || mapAgency.detail,
    `${viewport.name}: in-map agency cue has no target or reason.`,
  );
  assertMorrowMapAgencyTargetCorrelation(mapAgency, viewport.name);
  assertKettleMapAgencyTargetCorrelation(mapAgency, viewport.name);
  assertBoundedVisualHierarchy(page, `${viewport.name} map agency`, {
    requireContextualCue: true,
  });
  const browserProbe = await session.readBrowserProbe();
  assert.ok(browserProbe, `${viewport.name}: missing browser probe.`);
  assertNpcVisualPresenceMatchesAvailability(
    browserProbe,
    page,
    viewport.name,
  );
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
    /why (?:now|this)/i.test(page.bodyText) ||
    (await session.evaluate(
      `(/why (?:now|this)/i).test(document.body.innerText || "")`,
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
    assertDecisionHierarchy(
      page,
      `${viewport.name} rail hierarchy`,
      browserProbe.rail.visibleDecisionArtifact,
    );
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
    assertOverlayGeometry(
      expandedPage,
      viewport,
      `${viewport.name} expanded`,
      expectedHudText,
    );
    assertExpandedRailScroll(expandedPage, `${viewport.name} expanded`);
    assertBoundedVisualHierarchy(expandedPage, `${viewport.name} expanded`);
    if (browserProbe.rail?.visibleDecisionArtifact) {
      assertVisibleDecisionArtifactDom(
        expandedPage.decisionArtifact,
        `${viewport.name} expanded rail`,
        browserProbe.rail.visibleDecisionArtifact,
      );
      assertDecisionHierarchy(
        expandedPage,
        `${viewport.name} expanded rail hierarchy`,
        browserProbe.rail.visibleDecisionArtifact,
      );
      expandedDecisionArtifact = expandedPage.decisionArtifact;
    }
    expandedRailScreenshotPath = path.join(
      OUTPUT_DIR,
      `${viewport.name}-rail-expanded.png`,
    );
    await captureValidatedScreenshot({
      expectedHudText,
      label: `${viewport.name} expanded`,
      page: expandedPage,
      session,
      targetPath: expandedRailScreenshotPath,
      viewport,
    });
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
  const pageAfterPan = await session.inspectPage();
  assertOverlayGeometry(
    pageAfterPan,
    viewport,
    `${viewport.name} after pan`,
    expectedHudText,
  );
  assertBoundedVisualHierarchy(pageAfterPan, `${viewport.name} after pan`);
  const panScreenshotPath = path.join(
    OUTPUT_DIR,
    `${viewport.name}-after-pan.png`,
  );
  await captureValidatedScreenshot({
    expectedHudText,
    label: `${viewport.name} after pan`,
    page: pageAfterPan,
    session,
    targetPath: panScreenshotPath,
    viewport,
  });

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
  const westPanPage = await session.inspectPage();
  assertOverlayGeometry(
    westPanPage,
    viewport,
    `${viewport.name} west pan`,
    expectedHudText,
  );
  assertBoundedVisualHierarchy(westPanPage, `${viewport.name} west pan`);
  const westPanCapture = await captureValidatedScreenshot({
    expectedHudText,
    label: `${viewport.name} west pan`,
    page: westPanPage,
    session,
    targetPath: westPanScreenshotPath,
    viewport,
  });
  if (WEST_OPEN_LOT_VIEWPORT_NAMES.has(viewport.name)) {
    assertWestOpenLotCompositionPixels(
      westPanCapture.screenshot,
      panAtWestEdge,
      westPanCapture.page,
      viewport,
      `${viewport.name} west pan`,
    );
  }
  let morrowYardScreenshotPath = null;
  if (viewport.name === "codex-compact") {
    assertMorrowYardCompositionPixels(
      westPanCapture.screenshot,
      panAtWestEdge,
      westPanCapture.page,
      viewport,
      `${viewport.name} Morrow Yard`,
    );
    morrowYardScreenshotPath = path.join(
      OUTPUT_DIR,
      `morrow-yard-${viewport.name}.png`,
    );
    await writeFile(morrowYardScreenshotPath, westPanCapture.screenshot);
  }

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
    const northPanPage = await session.inspectPage();
    assertOverlayGeometry(
      northPanPage,
      viewport,
      `${viewport.name} north pan`,
      expectedHudText,
    );
    assertBoundedVisualHierarchy(northPanPage, `${viewport.name} north pan`);
    const northPanCapture = await captureValidatedScreenshot({
      expectedHudText,
      label: `${viewport.name} north pan`,
      page: northPanPage,
      session,
      targetPath: northPanScreenshotPath,
      viewport,
    });
    if (NORTH_FRINGE_VIEWPORT_NAMES.has(viewport.name)) {
      assertNorthFringeCompositionPixels(
        northPanCapture.screenshot,
        northEdge,
        northPanCapture.page,
        viewport,
        `${viewport.name} north pan`,
      );
    }

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
    const eastPanPage = await session.inspectPage();
    assertOverlayGeometry(
      eastPanPage,
      viewport,
      `${viewport.name} east pan`,
      expectedHudText,
    );
    assertBoundedVisualHierarchy(eastPanPage, `${viewport.name} east pan`);
    const eastPanCapture = await captureValidatedScreenshot({
      expectedHudText,
      label: `${viewport.name} east pan`,
      page: eastPanPage,
      session,
      targetPath: eastPanScreenshotPath,
      viewport,
    });
    if (EAST_WATERFRONT_VIEWPORT_NAMES.has(viewport.name)) {
      eastWaterfrontViewportDiagnostics.push(
        ...assertEastWaterfrontCompositionPixels(
          eastPanCapture.screenshot,
          eastEdge,
          eastPanCapture.page,
          viewport,
          `${viewport.name} east pan`,
        ),
      );
    }

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
    const southPanPage = await session.inspectPage();
    assertOverlayGeometry(
      southPanPage,
      viewport,
      `${viewport.name} south pan`,
      expectedHudText,
    );
    assertBoundedVisualHierarchy(southPanPage, `${viewport.name} south pan`);
    const southPanCapture = await captureValidatedScreenshot({
      expectedHudText,
      label: `${viewport.name} south pan`,
      page: southPanPage,
      session,
      targetPath: southPanScreenshotPath,
      viewport,
    });
    if (EAST_WATERFRONT_VIEWPORT_NAMES.has(viewport.name)) {
      eastWaterfrontViewportDiagnostics.push(
        ...assertEastWaterfrontCompositionPixels(
          southPanCapture.screenshot,
          southEdge,
          southPanCapture.page,
          viewport,
          `${viewport.name} south pan`,
        ),
      );
      eastWaterfrontCoverage = assertEastWaterfrontBayCoverage(
        eastWaterfrontViewportDiagnostics,
        viewport.name,
      );
    }
  }

  return {
    eastWaterfrontCoverage,
    eventCues: browserProbe.visualEventCues ?? [],
    mapAgency,
    page,
    morrowYardScreenshotPath,
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
    secondaryLandmarksScreenshotPath,
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

const AUTHORED_INTERIOR_CASES = [
  {
    enterActionId: "enter:tea-house",
    locationId: "tea-house",
    moveTo: { x: 6, y: 4 },
    name: "Kettle & Lamp",
    role: "tea-house",
    spaceId: "interior:tea-house",
  },
  {
    enterActionId: "enter:repair-stall",
    locationId: "repair-stall",
    moveTo: { x: 16, y: 9 },
    name: "Mercer Repairs",
    role: "repair-stall",
    spaceId: "interior:repair-stall",
  },
];

const SECONDARY_LANDMARK_ROUTE_CASES = [
  {
    locationId: "courtyard",
    moveTo: { x: 3, y: 12 },
    name: "Morrow Yard",
    screenshotName: "morrow-yard-route-compact-tall.png",
    worldRegion: MORROW_YARD_WORLD_REGION,
  },
  {
    locationId: "moss-pier",
    moveTo: { x: 18, y: 14 },
    name: "Pilgrim Slip",
    screenshotName: "pilgrim-slip-route-compact-tall.png",
    worldRegion: PILGRIM_SLIP_WORLD_REGION,
  },
];

async function createSecondaryLandmarkRouteGame(landmarkCase) {
  const gameId = await createSmokeGame(
    activeWebBase,
    `${landmarkCase.name} route identity check`,
  );
  const moved = await fetchJson(`${activeWebBase}/sim/game/${gameId}/command`, {
    body: JSON.stringify({
      type: "move_to",
      x: landmarkCase.moveTo.x,
      y: landmarkCase.moveTo.y,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(
    moved?.game?.player?.currentLocationId,
    landmarkCase.locationId,
    `${landmarkCase.name} route identity check could not reach its authored endpoint.`,
  );
  assert.equal(
    moved?.game?.activeSpaceId,
    "street:south-quay",
    `${landmarkCase.name} route identity check left the South Quay street.`,
  );
  return gameId;
}

async function captureSecondaryLandmarkRouteIdentity(
  session,
  landmarkCase,
  gameId,
  viewport,
) {
  const label = `${landmarkCase.name} route compact tall`;
  await session.setViewport(viewport);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=${landmarkCase.locationId}-route-compact-tall-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  const initial = await waitFor(
    async () => {
      try {
        const probe = await session.readCameraProbe();
        return probe?.activeSpaceKind === "street" &&
          cameraProbeInRange(probe)
          ? probe
          : false;
      } catch {
        return false;
      }
    },
    APP_READY_TIMEOUT_MS,
    `${label}: timed out waiting for the South Quay camera.`,
  );
  const { settled, settledAgain } = await waitForStableCameraProbes({
    initialProbe: initial,
    isEligible: (probe) =>
      probe?.activeSpaceKind === "street" && cameraProbeInRange(probe),
    readProbe: () => session.readCameraProbe(),
    timeoutMs: APP_READY_TIMEOUT_MS,
    waitForFrame: () => session.waitForAnimationFrames(2),
  });
  const playerPoint = settledAgain.playerWorldPoint;
  assert.ok(
    playerPoint.x >= landmarkCase.worldRegion.left &&
      playerPoint.x <= landmarkCase.worldRegion.right &&
      playerPoint.y >= landmarkCase.worldRegion.top &&
      playerPoint.y <= landmarkCase.worldRegion.bottom,
    `${label}: Rowan's rendered route endpoint is outside the authored landmark footprint: ${JSON.stringify(playerPoint)}.`,
  );
  const framed = await settleCameraAtEdge(session, "south", settledAgain);
  assertSameCameraSpace(
    viewport,
    settledAgain,
    framed,
    `${landmarkCase.name} route/south framing`,
  );

  const page = await waitForVisualHierarchyPage(session, label);
  assertOverlayGeometry(page, viewport, label, page.visibleTimeChips);
  assertBoundedVisualHierarchy(page, label);
  const screenshotPath = path.join(OUTPUT_DIR, landmarkCase.screenshotName);
  const capture = await captureValidatedScreenshot({
    expectedHudText: page.visibleTimeChips,
    label,
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });
  if (landmarkCase.locationId === "courtyard") {
    assertMorrowYardCompositionPixels(
      capture.screenshot,
      framed,
      capture.page,
      viewport,
      label,
    );
  } else {
    assertPilgrimSlipCompositionPixels(
      capture.screenshot,
      framed,
      capture.page,
      viewport,
      label,
    );
  }

  return {
    gameId,
    framed,
    initial,
    locationId: landmarkCase.locationId,
    playerPoint,
    screenshotPath,
    settled,
    settledAgain,
  };
}

async function runSecondaryLandmarkRouteIdentityCheck(session) {
  const compactTallViewport = VIEWPORTS.find(
    (viewport) => viewport.name === "codex-screenshot-tall",
  );
  assert.ok(
    compactTallViewport,
    "Secondary landmark route identity check requires the tall compact viewport.",
  );

  const results = {};
  for (const landmarkCase of SECONDARY_LANDMARK_ROUTE_CASES) {
    const gameId = await createSecondaryLandmarkRouteGame(landmarkCase);
    results[landmarkCase.locationId] =
      await captureSecondaryLandmarkRouteIdentity(
        session,
        landmarkCase,
        gameId,
        compactTallViewport,
      );
  }
  return results;
}

async function createAuthoredInteriorGame(interiorCase) {
  const gameId = await createSmokeGame(
    activeWebBase,
    `${interiorCase.name} identity check`,
  );
  const moved = await fetchJson(`${activeWebBase}/sim/game/${gameId}/command`, {
    body: JSON.stringify({
      type: "move_to",
      x: interiorCase.moveTo.x,
      y: interiorCase.moveTo.y,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(
    moved?.game?.player?.currentLocationId,
    interiorCase.locationId,
    `${interiorCase.name} identity check could not reach its exterior portal.`,
  );
  assert.ok(
    moved?.game?.availableActions?.some(
      (action) => action.id === interiorCase.enterActionId,
    ),
    `${interiorCase.name} identity check did not expose its legal enter action.`,
  );

  const entered = await fetchJson(`${activeWebBase}/sim/game/${gameId}/command`, {
    body: JSON.stringify({
      actionId: interiorCase.enterActionId,
      type: "act",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(
    entered?.game?.activeSpaceId,
    interiorCase.spaceId,
    `${interiorCase.name} identity check loaded the wrong interior.`,
  );
  return gameId;
}

async function captureAuthoredInteriorIdentity(
  session,
  interiorCase,
  gameId,
  viewport,
) {
  const viewportRole = viewport.name === "mobile" ? "mobile" : "desktop";
  const label = `${interiorCase.name} interior ${viewportRole}`;
  await session.setViewport(viewport);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=${interiorCase.role}-interior-${viewportRole}-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  const initial = await waitForInteriorCameraProbe(session);
  const { settled, settledAgain } = await waitForInteriorCameraSettle(
    session,
    initial,
  );
  assert.equal(
    settledAgain.activeSpaceId,
    interiorCase.spaceId,
    `${label}: browser loaded the wrong active interior.`,
  );
  assert.ok(
    cameraProbeInRange(settled) && cameraProbeInRange(settledAgain),
    `${label}: interior camera settled outside its legal range.`,
  );
  assert.ok(
    cameraScrollDistance(settled, settledAgain) <= 2,
    `${label}: interior camera drifted after settling.`,
  );

  const page = await waitForVisualHierarchyPage(session, label);
  assertOverlayGeometry(
    page,
    viewport,
    label,
    page.visibleTimeChips,
    interiorCase.spaceId,
  );
  assertBoundedVisualHierarchy(page, label);
  const pointVisibility = assertInteriorCameraPointsUnobscured(
    page,
    settledAgain,
    label,
  );
  const titleBounds = assertInteriorTitleInsideScene(settledAgain, label);
  const screenshotPath = path.join(
    OUTPUT_DIR,
    `${interiorCase.role}-interior-${viewportRole}.png`,
  );
  const capture = await captureValidatedScreenshot({
    expectedHudText: page.visibleTimeChips,
    label,
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });
  const composition = assertAuthoredInteriorIdentityPixels(
    capture.screenshot,
    page,
    viewport,
    interiorCase.role,
    label,
  );

  return {
    composition,
    initial,
    pointVisibility,
    screenshotPath,
    settled,
    settledAgain,
    titleBounds,
    viewport,
  };
}

async function runAuthoredInteriorIdentityCheck(session) {
  const desktopViewport = VIEWPORTS.find(
    (viewport) => viewport.name === "desktop",
  );
  const mobileViewport = VIEWPORTS.find(
    (viewport) => viewport.name === "mobile",
  );
  assert.ok(
    desktopViewport && mobileViewport,
    "Authored interior identity check requires desktop and mobile viewports.",
  );

  const results = {};
  for (const interiorCase of AUTHORED_INTERIOR_CASES) {
    const gameId = await createAuthoredInteriorGame(interiorCase);
    results[interiorCase.role] = {
      desktop: await captureAuthoredInteriorIdentity(
        session,
        interiorCase,
        gameId,
        desktopViewport,
      ),
      gameId,
      mobile: await captureAuthoredInteriorIdentity(
        session,
        interiorCase,
        gameId,
        mobileViewport,
      ),
      name: interiorCase.name,
      spaceId: interiorCase.spaceId,
    };
  }

  const teaProfile = results["tea-house"].desktop.composition.fractions;
  const repairProfile =
    results["repair-stall"].desktop.composition.fractions;
  assert.ok(
    teaProfile.warmMaterial >= repairProfile.warmMaterial + 0.05 &&
      repairProfile.coolMetal >= teaProfile.coolMetal + 0.05,
    `Kettle & Lamp and Mercer Repairs do not read as materially distinct rooms: ${JSON.stringify({
      repairProfile,
      teaProfile,
    })}.`,
  );

  return results;
}

async function runAfterHoursNpcAvailabilityCheck(session) {
  const viewport = VIEWPORTS[0];
  const gameId = await createSmokeGame(
    activeWebBase,
    "After-hours NPC availability check",
  );
  const initialState = await fetchJson(
    `${activeWebBase}/sim/game/${gameId}/state`,
  );
  const initialTotalMinutes = initialState?.game?.clock?.totalMinutes;
  assert.ok(
    Number.isFinite(initialTotalMinutes),
    "After-hours NPC check could not read the initial game clock.",
  );
  const currentDayStart =
    Math.floor(initialTotalMinutes / (24 * 60)) * 24 * 60;
  const sameDayBoundary = currentDayStart + 18 * 60;
  const targetTotalMinutes =
    initialTotalMinutes <= sameDayBoundary
      ? sameDayBoundary
      : sameDayBoundary + 24 * 60;
  let waited = initialState;
  let waitAttempts = 0;
  while (
    waited?.game?.clock?.totalMinutes < targetTotalMinutes &&
    waitAttempts < 24
  ) {
    const waitMinutes =
      targetTotalMinutes - waited.game.clock.totalMinutes;
    waited = await fetchJson(
      `${activeWebBase}/sim/game/${gameId}/command`,
      {
        body: JSON.stringify({
          minutes: waitMinutes,
          silent: true,
          type: "wait",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    waitAttempts += 1;
  }
  assert.equal(
    waited?.game?.clock?.totalMinutes,
    targetTotalMinutes,
    "After-hours NPC check did not reach Jo's half-open 18:00 boundary.",
  );
  await session.setViewport(viewport);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=after-hours-npc-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  await sleep(500);
  const browserProbe = await session.readBrowserProbe();
  const page = await session.inspectPage();
  const joSchedule = browserProbe?.worldPressure?.npcSchedules?.find(
    (npc) => npc.id === "npc-jo",
  );
  assert.equal(
    joSchedule?.availability,
    "unavailable",
    `After-hours NPC check expected Jo unavailable at 18:00: ${JSON.stringify(joSchedule)}.`,
  );
  assert.equal(
    joSchedule?.currentLocationId,
    "repair-stall",
    "After-hours NPC check no longer exercises the stale last-known Mercer location.",
  );
  assertNpcVisualPresenceMatchesAvailability(
    browserProbe,
    page,
    "after-hours NPC availability",
  );
  const screenshotPath = path.join(
    OUTPUT_DIR,
    "after-hours-npc-availability.png",
  );
  await captureValidatedScreenshot({
    expectedHudText: page.visibleTimeChips,
    label: "after-hours NPC availability",
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });

  return {
    gameId,
    joSchedule,
    npcPresence: page.npcPresence,
    screenshotPath,
  };
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

async function waitForInteriorCameraSettle(session, initialProbe) {
  return waitForStableCameraProbes({
    initialProbe,
    isEligible: (probe) =>
      probe?.activeSpaceKind === "interior" && cameraProbeInRange(probe),
    readProbe: () => session.readCameraProbe(),
    timeoutMs: APP_READY_TIMEOUT_MS,
    waitForFrame: () => session.waitForAnimationFrames(2),
  });
}

async function waitForVisualHierarchyPage(session, label) {
  let attempts = 0;
  let lastError = null;
  let lastPage = null;

  try {
    return await waitFor(
      async () => {
        attempts += 1;
        try {
          lastPage = await session.inspectPage();
          return lastPage?.visualHierarchy ? lastPage : false;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          return false;
        }
      },
      APP_READY_TIMEOUT_MS,
      `${label}: timed out waiting for the visual hierarchy probe.`,
    );
  } catch (error) {
    throw new Error(
      `${error.message} Attempts: ${attempts}. Last state: ${JSON.stringify({
        cameraActiveSpaceId: lastPage?.cameraActiveSpaceId ?? null,
        cameraActiveSpaceKind: lastPage?.cameraActiveSpaceKind ?? null,
        hasCanvas: Boolean(lastPage?.canvas),
        hasFrameworkOverlay: lastPage?.hasFrameworkOverlay ?? null,
        lastError,
        rootClass: lastPage?.rootClass ?? null,
        title: lastPage?.title ?? null,
        url: lastPage?.url ?? null,
      })}`,
      { cause: error },
    );
  }
}

async function captureMorrowHouseMobileState({
  expectedPlayerWorldPoint,
  gameId,
  label,
  screenshotName,
  session,
  stateId,
  viewport,
}) {
  await session.setViewport(viewport);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=${stateId}-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  const initial = await waitForInteriorCameraProbe(session);
  const { settled, settledAgain } = await waitForInteriorCameraSettle(
    session,
    initial,
  );
  assert.ok(
    cameraPointDistance(
      settledAgain.playerWorldPoint,
      expectedPlayerWorldPoint,
    ) <= 2,
    `${label}: Rowan did not load at the expected alternate-state point: ${JSON.stringify({
      actual: settledAgain.playerWorldPoint,
      expected: expectedPlayerWorldPoint,
      stateId,
    })}.`,
  );

  const page = await waitForVisualHierarchyPage(session, label);
  assertOverlayGeometry(
    page,
    viewport,
    label,
    page.visibleTimeChips,
    "interior:boarding-house",
  );
  assertBoundedVisualHierarchy(page, label);
  const pointVisibility = assertInteriorCameraPointsUnobscured(
    page,
    settledAgain,
    label,
  );
  const titleBounds = assertInteriorTitleInsideScene(settledAgain, label);
  const screenshotPath = path.join(OUTPUT_DIR, screenshotName);
  const capture = await captureValidatedScreenshot({
    expectedHudText: page.visibleTimeChips,
    label,
    page,
    session,
    targetPath: screenshotPath,
    viewport,
  });
  const composition = assertBoardingHouseInteriorCompositionPixels(
    capture.screenshot,
    page,
    viewport,
    label,
  );
  const identity = assertAuthoredInteriorIdentityPixels(
    capture.screenshot,
    page,
    viewport,
    "boarding-house",
    label,
  );
  const actorVisibility = assertMorrowHouseRelevantActorsUnobscured(
    page,
    settledAgain,
    label,
    viewport,
    stateId,
  );

  return {
    actorVisibility,
    composition,
    identity,
    initial,
    pointVisibility,
    screenshotPath,
    settled,
    settledAgain,
    stateId,
    titleBounds,
  };
}

async function runInteriorCameraCheck(session) {
  const gameId = await createInteriorCameraGame();
  await session.setViewport(INTERIOR_CAMERA_VIEWPORT);
  await session.navigate(
    `${activeWebBase}/?freezeAutoplay=1&readyCheck=interior-camera-${Date.now()}&gameId=${gameId}`,
  );
  await session.waitForAppReady();
  const initial = await waitForInteriorCameraProbe(session);
  const { settled, settledAgain } = await waitForInteriorCameraSettle(
    session,
    initial,
  );

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
  const interiorPage = await waitForVisualHierarchyPage(
    session,
    "interior camera",
  );
  assertOverlayGeometry(
    interiorPage,
    INTERIOR_CAMERA_VIEWPORT,
    "interior camera",
    interiorPage.visibleTimeChips,
    "interior:boarding-house",
  );
  assertBoundedVisualHierarchy(interiorPage, "interior camera");
  const compactPointVisibility = assertInteriorCameraPointsUnobscured(
    interiorPage,
    settledAgain,
    "interior camera",
  );
  const compactTitleBounds = assertInteriorTitleInsideScene(
    settledAgain,
    "interior camera",
  );
  const compactCapture = await captureValidatedScreenshot({
    expectedHudText: interiorPage.visibleTimeChips,
    label: "interior camera",
    page: interiorPage,
    session,
    targetPath: screenshotPath,
    viewport: INTERIOR_CAMERA_VIEWPORT,
  });
  const compactComposition = assertBoardingHouseInteriorCompositionPixels(
    compactCapture.screenshot,
    interiorPage,
    INTERIOR_CAMERA_VIEWPORT,
    "interior camera",
  );
  const compactIdentity = assertAuthoredInteriorIdentityPixels(
    compactCapture.screenshot,
    interiorPage,
    INTERIOR_CAMERA_VIEWPORT,
    "boarding-house",
    "Morrow House interior desktop",
  );
  const compactActorVisibility = assertMorrowHouseRelevantActorsUnobscured(
    interiorPage,
    settledAgain,
    "Morrow House interior desktop",
    INTERIOR_CAMERA_VIEWPORT,
    "desktop-current",
  );

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

  const mobileViewport = VIEWPORTS.find(
    (viewport) => viewport.name === "mobile",
  );
  assert.ok(mobileViewport, "Interior camera check is missing the mobile viewport.");
  const mobileGameId = await createInteriorCameraGame();
  const mobilePortalState = await captureMorrowHouseMobileState({
    expectedPlayerWorldPoint: MORROW_HOUSE_PORTAL_WORLD_POINT,
    gameId: mobileGameId,
    label: "Morrow House interior mobile entrance state",
    screenshotName: "interior-camera-mobile.png",
    session,
    stateId: "entrance",
    viewport: mobileViewport,
  });
  const movedNearMara = await fetchJson(
    `${activeWebBase}/sim/game/${mobileGameId}/command`,
    {
      body: JSON.stringify({
        type: "move_to",
        x: 5,
        y: 5,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  assert.equal(
    movedNearMara?.game?.activeSpaceId,
    "interior:boarding-house",
    "Morrow House alternate-state check left the interior.",
  );
  assert.deepEqual(
    {
      x: movedNearMara?.game?.player?.x,
      y: movedNearMara?.game?.player?.y,
    },
    { x: 5, y: 5 },
    "Morrow House alternate-state check could not position Rowan near Mara.",
  );
  const mobileNearMaraState = await captureMorrowHouseMobileState({
    expectedPlayerWorldPoint: MORROW_HOUSE_MARA_INTERACTION_WORLD_POINT,
    gameId: mobileGameId,
    label: "Morrow House interior mobile Mara state",
    screenshotName: "interior-camera-mobile-near-mara.png",
    session,
    stateId: "near-mara",
    viewport: mobileViewport,
  });

  return {
    compactActorVisibility,
    compactComposition,
    compactIdentity,
    compactPointVisibility,
    compactTitleBounds,
    eastEdge,
    gameId,
    initial,
    mobileActorVisibility: mobilePortalState.actorVisibility,
    mobileComposition: mobilePortalState.composition,
    mobileGameId,
    mobileIdentity: mobilePortalState.identity,
    mobileInitial: mobilePortalState.initial,
    mobileNearMaraState,
    mobilePointVisibility: mobilePortalState.pointVisibility,
    mobilePortalState,
    mobileScreenshotPath: mobilePortalState.screenshotPath,
    mobileSettled: mobilePortalState.settled,
    mobileSettledAgain: mobilePortalState.settledAgain,
    mobileTitleBounds: mobilePortalState.titleBounds,
    northEdge,
    screenshotPath,
    settled,
    southEdge,
    westEdge,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  assertOpeningActionCarryForwardContractGuard();
  assertGroundedNearMorrowEntryAgencyGuard();
  assertVisibleDecisionCopyCompactionContractGuard();
  assertDecisionArtifactReadabilityWaitRegression();
  assertResponsiveDecisionArtifactModeContract();
  if (RUN_RESPONSIVE_DECISION_GUARD_ONLY) {
    process.stdout.write(
      "[many-lives] Responsive decision readability guard passed.\n",
    );
    return;
  }
  await assertAmbientScaleGuard();
  await assertWatchModeFeelGuard();
  await assertCameraPanContractGuard();
  await assertAuthoredInteriorVisualGuard();
  const webServer = await ensureStack();
  const nextDevelopmentIndicatorDisabled =
    await disableLocalNextDevelopmentIndicator(activeWebBase);
  const devtoolsPort = await findFreePort();
  const session = await launchBrowser(devtoolsPort);
  const results = [];
  let afterHoursNpcAvailability = null;
  let authoredInteriorIdentity = null;
  let freshAutoplayStart = null;
  let freshAutoplayOptOut = null;
  let interiorCamera = null;
  let responsiveDecisionArtifact = null;
  let secondaryLandmarkRouteIdentity = null;
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
    if (shouldRunResponsiveDecisionArtifactCheck(activeWebBase)) {
      process.stdout.write(
        "[many-lives] Checking responsive decision callback...\n",
      );
      responsiveDecisionArtifact =
        await runResponsiveDecisionArtifactCheck(session);
      process.stdout.write(
        "[many-lives] Finished responsive decision callback.\n",
      );
    } else {
      process.stdout.write(
        `[many-lives] Skipping deterministic responsive decision callback for external base ${activeWebBase}.\n`,
      );
      responsiveDecisionArtifact =
        responsiveDecisionArtifactSkipSummary(activeWebBase);
    }
    for (const viewport of ACTIVE_VIEWPORTS) {
      process.stdout.write(`[many-lives] Checking ${viewport.name} viewport...\n`);
      results.push({
        viewport,
        ...(await runViewportCheck(session, viewport)),
      });
      process.stdout.write(`[many-lives] Finished ${viewport.name} viewport.\n`);
    }
    process.stdout.write("[many-lives] Checking after-hours NPC availability...\n");
    afterHoursNpcAvailability =
      await runAfterHoursNpcAvailabilityCheck(session);
    process.stdout.write("[many-lives] Finished after-hours NPC availability.\n");
    process.stdout.write(
      "[many-lives] Checking secondary landmark route identity...\n",
    );
    secondaryLandmarkRouteIdentity =
      await runSecondaryLandmarkRouteIdentityCheck(session);
    process.stdout.write(
      "[many-lives] Finished secondary landmark route identity.\n",
    );
    process.stdout.write("[many-lives] Checking stored-run prompt behavior...\n");
    storedGameChoice = await runStoredGameChoiceCheck(session);
    process.stdout.write("[many-lives] Finished stored-run prompt behavior.\n");
    process.stdout.write("[many-lives] Checking interior camera behavior...\n");
    interiorCamera = await runInteriorCameraCheck(session);
    process.stdout.write("[many-lives] Finished interior camera behavior.\n");
    process.stdout.write("[many-lives] Checking authored interior identity...\n");
    authoredInteriorIdentity =
      await runAuthoredInteriorIdentityCheck(session);
    process.stdout.write("[many-lives] Finished authored interior identity.\n");
    const visualQualityRegressionEvidence =
      createVisualQualityRegressionEvidence({
        fringeCompositionDiagnostics,
        interiorActorVisibilityDiagnostics,
        interiorIdentityDiagnostics,
        results,
        screenshotPixelDiagnostics,
        secondaryLandmarkCompositionDiagnostics,
      });
    const visualQualityRegression =
      assertVisualQualityRegressionEvidence(visualQualityRegressionEvidence);

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
          afterHoursNpcAvailability,
          authoredInteriorIdentity,
          eastWaterfrontCompositionDiagnostics,
          fringeCompositionDiagnostics,
          freshAutoplayStart,
          freshAutoplayOptOut,
          nextDevelopmentIndicatorDisabled,
          outputDir: OUTPUT_DIR,
          interiorCamera,
          interiorActorVisibilityDiagnostics,
          interiorIdentityDiagnostics,
          responsiveDecisionArtifact,
          results,
          screenshotCaptureRetries,
          screenshotPixelDiagnostics,
          secondaryLandmarkCompositionDiagnostics,
          secondaryLandmarkRouteIdentity,
          storedGameChoice,
          visualQualityRegression,
          visualQualityRegressionEvidence,
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
        `[many-lives] Interior camera mobile: ${path.join(OUTPUT_DIR, "interior-camera-mobile.png")}`,
        `[many-lives] Interior camera mobile near Mara: ${path.join(OUTPUT_DIR, "interior-camera-mobile-near-mara.png")}`,
        `[many-lives] Kettle & Lamp interior desktop: ${path.join(OUTPUT_DIR, "tea-house-interior-desktop.png")}`,
        `[many-lives] Kettle & Lamp interior mobile: ${path.join(OUTPUT_DIR, "tea-house-interior-mobile.png")}`,
        `[many-lives] Mercer Repairs interior desktop: ${path.join(OUTPUT_DIR, "repair-stall-interior-desktop.png")}`,
        `[many-lives] Mercer Repairs interior mobile: ${path.join(OUTPUT_DIR, "repair-stall-interior-mobile.png")}`,
        `[many-lives] Secondary landmarks desktop: ${path.join(OUTPUT_DIR, "secondary-landmarks-desktop.png")}`,
        `[many-lives] Morrow Yard compact: ${path.join(OUTPUT_DIR, "morrow-yard-codex-compact.png")}`,
        `[many-lives] Morrow Yard route compact tall: ${path.join(OUTPUT_DIR, "morrow-yard-route-compact-tall.png")}`,
        `[many-lives] Pilgrim Slip route compact tall: ${path.join(OUTPUT_DIR, "pilgrim-slip-route-compact-tall.png")}`,
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
