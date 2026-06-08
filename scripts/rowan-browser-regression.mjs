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
  USE_CHROME_DRIVER && process.env.MANY_LIVES_BROWSER_REQUIRE_SCREENSHOTS !== "0";
const REQUIRE_RECORDING =
  USE_CHROME_DRIVER && process.env.MANY_LIVES_BROWSER_REQUIRE_RECORDING !== "0";
const TRACE_REGRESSION =
  process.env.MANY_LIVES_BROWSER_TRACE === "1";
const DEFAULT_WEB_BASE =
  process.env.MANY_LIVES_WEB_BASE_URL ?? "http://127.0.0.1:3001";
const FORCE_LOCAL_WEB =
  process.env.MANY_LIVES_BROWSER_FORCE_LOCAL_WEB !== "0";
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
const SIM_WAIT_TIMEOUT_MS = 15_000;
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
const OPENING_CTA_PATTERN =
  /Watch Rowan begin|Rowan starts by asking Mara\./i;
const GENERIC_WATCH_CTA_COPY_PATTERN =
  /Rowan will keep going when this beat lands/i;

let activeWebBase = DEFAULT_WEB_BASE;

function traceRegression(message) {
  if (TRACE_REGRESSION) {
    process.stderr.write(`[many-lives:trace] ${message}\n`);
  }
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
    return;
  }

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

  if (child.exitCode === null && child.signalCode === null) {
    child.unref?.();
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

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

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
    this.pageErrors = [];
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
    await this.send("Log.enable");
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
      this.socket?.destroy();
    } catch {}

    await closeChildProcess(this.browser);
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
    })()`);

    if (probe?.parseError) {
      throw new Error(`Could not parse #ml-browser-probe: ${probe.parseError}`);
    }

    return probe;
  }

  async readMapAgencyProbe() {
    const probe = await this.evaluate(`(() => {
      const script = document.querySelector("#ml-browser-map-agency-probe");
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
      throw new Error(
        `Could not parse #ml-browser-map-agency-probe: ${probe.parseError}`,
      );
    }

    return probe;
  }

  async readCameraProbe() {
    const probe = await this.evaluate(`(() => {
      const script = document.querySelector("#ml-browser-camera-probe");
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
      throw new Error(`Could not parse #ml-browser-camera-probe: ${probe.parseError}`);
    }

    return probe;
  }

  async readVisibleElementRect(selector) {
    return this.evaluate(`(() => {
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
    })()`);
  }

  async readPlayerControlCandidate() {
    return this.evaluate(`(() => {
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
    })()`);
  }

  async clickVisibleSelector(selector) {
    const target = await this.readVisibleElementRect(selector);
    assert.ok(target, `Expected visible clickable element for selector ${selector}.`);
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

  async readDomSnapshot() {
    return this.evaluate(`(() => {
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
      const chatBubbles = Array.from(document.querySelectorAll(".ml-chat-bubble"));
      const latestChatBubble = chatBubbles.at(-1) ?? null;
      const chatRows = Array.from(document.querySelectorAll(".ml-chat-row"));
      const latestChatRow = chatRows.at(-1) ?? null;
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
        hasCanvas: Boolean(canvas),
        hasFieldNote: Boolean(fieldNote),
        hasFrameworkErrorOverlay: /Unhandled Runtime Error|Runtime Error|Build Error|Failed to compile|Application error/i.test(
          frameworkErrorText
        ),
        hasRail: Boolean(rail),
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
    })()`);
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
            probe.visualPlayer?.targetY === nextGame.player.y &&
            probe.movement?.playerRoute?.active === true &&
            probe.movement?.playerRoute?.target?.x === nextGame.player.x &&
            probe.movement?.playerRoute?.target?.y === nextGame.player.y
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
            probe.location?.id ===
              (previousGame.player.currentLocationId ?? null) &&
            probe.location?.x === previousGame.player.x &&
            probe.location?.y === previousGame.player.y &&
            probe.visualPlayer?.isMovingToServerState === true &&
            probe.visualPlayer?.targetX === nextGame.player.x &&
            probe.visualPlayer?.targetY === nextGame.player.y &&
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
      if (message.method === "Runtime.exceptionThrown") {
        this.pageErrors.push({
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
        this.pageErrors.push({
          method: message.method,
          text: message.params.entry.text ?? "Browser log error",
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
    "home-reset",
    "first-afternoon-complete",
    "exit-morrow-for-repair",
    "stage-repair-move",
    "enter-repair-interior",
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
            game.npcs.find((npc) => npc.id === activeConversation.npcId)?.name ??
            null,
          updatedAt: activeConversation.updatedAt,
      }
      : null,
    aiRuntime: aiRuntimeProbeFromGame(game),
    autonomy: {
      autoContinue: game.rowanAutonomy.autoContinue,
      intent: game.rowanAutonomy.intent
        ? {
            reason: game.rowanAutonomy.intent.reason,
            signals: game.rowanAutonomy.intent.signals,
          }
        : null,
      key: game.rowanAutonomy.key,
      label: game.rowanAutonomy.label,
      mode: game.rowanAutonomy.mode,
      planningTrace: planningTraceProbeFromGame(game),
      stepKind: game.rowanAutonomy.stepKind,
      targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
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
    matchedOutcomeId: option.matchedOutcomeId ?? null,
    npcId: option.npcId ?? null,
    planKey: option.planKey ?? null,
    pressureId: option.pressureId ?? null,
    pressureKind: option.pressureKind ?? null,
    pressureLabel: option.pressureLabel ?? null,
    rationale: option.rationale,
    reason: option.reason ?? null,
    score: option.score,
    status: option.status,
    targetLocationId: option.targetLocationId ?? null,
  });

  return {
    blockers: trace.blockers,
    considered: trace.considered.map(optionPayload),
    nextSteps: (trace.nextSteps ?? []).map((step) => ({
      actionId: step.actionId ?? null,
      kind: step.kind,
      label: step.label,
      legal: step.legal,
      npcId: step.npcId ?? null,
      rationale: step.rationale,
      targetLocationId: step.targetLocationId ?? null,
      validation: step.validation,
    })),
    outcomes: trace.outcomes.map((outcome) => ({
      blockers: outcome.blockers ?? [],
      evidence: outcome.evidence ?? null,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      urgency: outcome.urgency,
    })),
    rejected: trace.rejected.map(optionPayload),
    selectedActionId: trace.selectedActionId ?? null,
    selectedLabel: trace.selectedLabel ?? null,
    selectedMatchedOutcomeId: trace.selectedMatchedOutcomeId ?? null,
    selectedPlanKey: trace.selectedPlanKey ?? null,
    selectedPressureId: trace.selectedPressureId ?? null,
    selectedPressureKind: trace.selectedPressureKind ?? null,
    selectedPressureLabel: trace.selectedPressureLabel ?? null,
    selectedTargetLocationId: trace.selectedTargetLocationId ?? null,
  };
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
          (entry) => currentHour >= entry.fromHour && currentHour < entry.toHour,
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

function findCityEvent(game, id) {
  return (game.cityEvents ?? []).find((event) => event.id === id) ?? null;
}

function assertBrowserProbeMatchesGame(label, game, probe, options = {}) {
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
        Object.prototype.hasOwnProperty.call(step, "targetLocationId") &&
        Object.prototype.hasOwnProperty.call(step, "npcId"),
    ),
    `${label}: planner trace next steps must expose kind, legality, validation, target, and npc.`,
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
        Object.prototype.hasOwnProperty.call(option, "pressureLabel"),
    ),
    `${label}: planner trace considered options must expose plan key, score, rationale, target, npc, outcome, and pressure metadata.`,
  );
  const selectedTraceOption = planningTrace.considered.find(
    (option) => option.status === "selected",
  );
  assert.ok(
    planningTrace.selectedPlanKey &&
      selectedTraceOption?.planKey === planningTrace.selectedPlanKey,
    `${label}: planner trace selectedPlanKey must match the selected considered option.`,
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(planningTrace, "selectedPressureId") &&
      Object.prototype.hasOwnProperty.call(planningTrace, "selectedPressureKind") &&
      Object.prototype.hasOwnProperty.call(planningTrace, "selectedMatchedOutcomeId") &&
      Object.prototype.hasOwnProperty.call(planningTrace, "selectedTargetLocationId"),
    `${label}: planner trace must expose selected pressure, selected outcome, and selected target metadata.`,
  );
  assert.ok(
    planningTrace.rejected.every((option) =>
      Object.prototype.hasOwnProperty.call(option, "reason"),
    ),
    `${label}: planner trace rejected options must expose rejection reasons.`,
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
    (probe.worldPressure?.problems ?? []).length >= (game.problems ?? []).length,
    `${label}: world pressure probe is missing problems.`,
  );
  assert.ok(
    (probe.worldPressure?.npcSchedules ?? []).length >= (game.npcs ?? []).length,
    `${label}: world pressure probe is missing NPC schedules.`,
  );
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
      `${label}: active Rowan rail card is clipped or scrolled out of view (${JSON.stringify({
        commandRail,
        directive: dom.layout?.rowanDirective,
      })}).`,
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
    `${label}: latest conversation bubble is clipped outside the command rail (${JSON.stringify({
      bubble: dom.layout?.latestChatBubble,
      commandRail: commandRail?.rect,
    })}).`,
  );
  if (dom.layout?.latestChatExchange?.fitsCommandRail) {
    assert.ok(
      rectIsInside(dom.layout.latestChatExchange.rect, commandRail?.rect, 3),
      `${label}: latest conversation exchange is clipped outside the command rail (${JSON.stringify({
        commandRail: commandRail?.rect,
        exchange: dom.layout.latestChatExchange,
      })}).`,
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
      current.minPathLength = Math.min(current.minPathLength, patrol.pathLength);
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
    playerRoutes,
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

  const patrolByLocationId = new Map(
    movementAudit.npcPatrols.map((patrol) => [patrol.locationId, patrol]),
  );
  for (const locationId of REQUIRED_NPC_PATROL_LOCATION_IDS) {
    const patrol = patrolByLocationId.get(locationId);
    assert.ok(
      patrol,
      `Expected summary NPC diagnostics for ${locationId}.`,
    );
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

function assertRectsDoNotOverlap(label, firstRect, secondRect, firstName, secondName) {
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
    assertRectInsideViewport(label, layout.focusWindow, "focus panel", viewport);
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
  assertNotebookFreshForLateObjective(label, normalizedBody, notebook);
}

function assertNotebookFreshForLateObjective(label, normalizedBody, notebook) {
  const lateNiaLeadVisible =
    /Talk to Nia next while there is still time/i.test(normalizedBody) ||
    /Ask Nia where the block is about to jam/i.test(normalizedBody) ||
    /Objective shifted/i.test(normalizedBody);
  if (!lateNiaLeadVisible) {
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
    /Keep a stable room|Mara is the person most likely|tonight's bed|bed feel less temporary/i,
    `${label}: late Notebook stayed anchored to stale room/shelter authority after the Nia lead surfaced.`,
  );
  assert.doesNotMatch(
    normalizedBody,
    /Morrow House is where Rowan can let today's standing settle|runs himself flat|tonight's bed|room stays mine/i,
    `${label}: late rail/body mixed the Nia objective shift with stale Morrow House standing rationale.`,
  );
  assert.match(
    notebookText,
    /Nia|Jo|block|jam|square/i,
    `${label}: late Notebook should reflect the current Nia/block-jam lead.`,
  );
  assert.notEqual(
    notebook.authority?.notebookNeedKey,
    "shelter",
    `${label}: late Notebook should not keep shelter as the active need after the objective shifted to Nia/local pressure.`,
  );
}

function buildTimelineEntry({
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
  const probe = await session.waitForGame(game);
  assertBrowserProbeMatchesGame(label, game, probe);
  assertCityEventState(label, game);
  const dom = await waitForGameplayDom(label, session, probe);
  const mapAgency = await session.readMapAgencyProbe();
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
  const mapAgency = await session.readMapAgencyProbe();

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
    dom: null,
    mapAgency: null,
    probe,
    screenshot: null,
    screenshotError: null,
  };
}

async function runAutoplayObservation(session) {
  const url = `${getWebBase()}?new=1&autoplay=1&autoplayRegression=${Date.now()}`;
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
        /AT THE TIME\s+Sleep on the first foothold, then decide whether tomorrow starts with Ada's lead or the dock board\./i,
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
      rejectedText: [/worldPressure/i, /cityEvents/i, /jobWindows/i, /npcSchedules/i],
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
    x: Math.round(
      ((after?.scroll?.x ?? 0) - (before?.scroll?.x ?? 0)) * 100,
    ) / 100,
    y: Math.round(
      ((after?.scroll?.y ?? 0) - (before?.scroll?.y ?? 0)) * 100,
    ) / 100,
  };
}

function assertInhabitPlayerDom(label, dom, controlCandidate = null, probe = null) {
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
      const probe = await session.readBrowserProbe();
      if (!probe) {
        return null;
      }
      if (probe.visualPlayer?.isMovingToServerState) {
        return null;
      }
      if (probe.playback?.activeKind || (probe.playback?.queuedCount ?? 0) > 0) {
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
      const probe = await session.readBrowserProbe();
      if (!probe || playerProbeSignature(probe) === beforeSignature) {
        return null;
      }
      if (probe.visualPlayer?.isMovingToServerState) {
        return null;
      }
      if (probe.playback?.activeKind || (probe.playback?.queuedCount ?? 0) > 0) {
        return null;
      }
      return probe;
    },
    75_000,
    `${label}: visible player control did not advance the run.`,
  );
}

async function waitForInhabitCameraProbe(session, label) {
  return waitFor(
    async () => {
      const probe = await session.readCameraProbe();
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
  assert.ok(camera?.sceneViewportCss, `${label}: missing scene viewport bounds.`);
  assert.ok(camera?.visibleWorldRect, `${label}: missing visible world bounds.`);
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

async function closeInhabitSupportPanel(session) {
  const openToggle = await session.readVisibleElementRect(
    '[data-toggle-support][aria-expanded="true"]',
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
  session,
  userQuestion,
}) {
  await closeInhabitSupportPanel(session);
  const probe = await waitForInhabitSettled(session, label);
  const dom = await session.readDomSnapshot();
  const controlCandidate = await session.readPlayerControlCandidate();
  assertInhabitPlayerDom(label, dom, controlCandidate, probe);
  const camera = await session.readCameraProbe().catch(() => null);
  const screenshot = path.join(
    OUTPUT_DIR,
    `inhabit-${String(index).padStart(2, "0")}-${slug(label)}.png`,
  );
  await session.captureScreenshot(screenshot);
  const moment = {
    activeConversation: probe.activeConversation?.npcId ?? null,
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
    label,
    location: probe.location,
    screenshot,
    userQuestion,
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

function assertInhabitOpeningCtaProgression(moments) {
  const byLabel = Object.fromEntries(
    moments.map((moment) => [moment.label, moment]),
  );
  const firstActionable = byLabel["first-actionable-screen"];
  const enteredMorrowHouse = byLabel["entered-morrow-house"];

  assert.ok(
    firstActionable?.control?.text,
    "first-actionable-screen: expected opening CTA control text.",
  );
  assert.match(
    firstActionable.control.text,
    OPENING_CTA_PATTERN,
    "first-actionable-screen: expected the true exterior opening to invite watching Rowan begin.",
  );
  assert.equal(
    firstActionable.location?.spaceId,
    "street:south-quay",
    "first-actionable-screen: opening CTA evidence must come from the exterior street space.",
  );

  assert.ok(
    enteredMorrowHouse?.control?.text,
    "entered-morrow-house: expected continued-watch control text.",
  );
  assert.equal(
    enteredMorrowHouse.location?.spaceId,
    "interior:boarding-house",
    "entered-morrow-house: CTA regression evidence must be captured inside Morrow House.",
  );
  assert.doesNotMatch(
    enteredMorrowHouse.control.text,
    OPENING_CTA_PATTERN,
    "entered-morrow-house: opening CTA text must not persist after Rowan enters Morrow House.",
  );
  assert.match(
    enteredMorrowHouse.control.text,
    /Continue watching/i,
    "entered-morrow-house: expected established continued-watch CTA copy after the opening beat.",
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
    const visibleWatchText = moment?.control?.text ?? moment?.autonomyLabel ?? "";
    assert.ok(
      visibleWatchText,
      `${expectation.label}: expected continued-watch or autonomy text.`,
    );
    assert.doesNotMatch(
      visibleWatchText,
      GENERIC_WATCH_CTA_COPY_PATTERN,
      `${expectation.label}: continued-watch copy regressed to generic beat-landing copy.`,
    );
    assert.match(
      visibleWatchText,
      expectation.pattern,
      expectation.reason,
    );
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
    const dom = await session.readDomSnapshot();
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

  await session.clickVisibleSelector("[data-close-focus]");
  await sleep(200);
  const closedDom = await session.readDomSnapshot();
  assert.equal(
    closedDom.activeTab,
    "actions",
    "inhabit-panel-close: expected close to return to the World/action view.",
  );

  return checks;
}

async function runInhabitRowanNotebookClickCheck(session) {
  const label = "inhabit-rowan-click-notebook";
  const camera = await waitForInhabitCameraProbe(session, label);
  const avatarWorldPoint = {
    x: camera.playerWorldPoint.x,
    y: camera.playerWorldPoint.y + 96,
  };
  const clickPoint = worldPointToViewportPoint(
    camera,
    avatarWorldPoint,
    label,
  );

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

  const dom = await session.readDomSnapshot();
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
    `${label}: clicking Rowan should open the Notebook tab. ${JSON.stringify(
      { clickDebug, screenshot },
    )}`,
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
  const probe = await session.readBrowserProbe();
  assertNotebookUsesCognitionAuthority(label, dom, probe);

  assertCriticalVisualCoherence(label, dom, {
    expectFocusWindow: true,
  });

  await session.clickVisibleSelector("[data-close-focus]");
  await sleep(200);

  return {
    activeTab: dom.activeTab,
    bodyTextSample: dom.bodyTextSample,
    clickPoint: {
      x: Math.round(clickPoint.x),
      y: Math.round(clickPoint.y),
    },
    label,
    screenshot,
  };
}

async function runInhabitCameraCheck(session) {
  const before = await waitForInhabitCameraProbe(session, "inhabit-camera");
  const viewport = before.sceneViewportCss;
  const center = {
    x: viewport.x + viewport.width * 0.42,
    y: viewport.y + viewport.height * 0.52,
  };
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
      visibleWorldRect: after.visibleWorldRect,
    });
    previous = after;
  }

  const moved = observations.some(
    (entry) => Math.abs(entry.delta.x) >= 8 || Math.abs(entry.delta.y) >= 8,
  );
  assert.equal(
    moved,
    true,
    `inhabit-camera: player drags did not visibly move the camera. ${JSON.stringify(
      observations,
    )}`,
  );

  const screenshot = path.join(OUTPUT_DIR, "inhabit-camera-after-drags.png");
  await session.captureScreenshot(screenshot);

  return {
    before: {
      scroll: before.scroll,
      scrollRange: before.scrollRange,
      visibleWorldRect: before.visibleWorldRect,
    },
    observations,
    screenshot,
  };
}

async function clickUntilInhabitMilestone({
  clickLog,
  maxClicks,
  milestone,
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
    let control = await session.readPlayerControlCandidate();
    let openedSupportForControl = false;
    if (!control) {
      const supportToggle = await session.readVisibleElementRect(
        '[data-toggle-support]',
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
        control = await session.readPlayerControlCandidate();
      }
    }
    if (
      !control &&
      probe.watchMode?.enabled &&
      !probe.watchMode?.frozen &&
      probe.autonomy?.autoContinue
    ) {
      clickLog.push({
        beforeAutonomyLabel: probe.autonomy?.label ?? null,
        beforeClock: probe.clock,
        beforeLocation: probe.location,
        kind: "watched-auto-continue",
        milestone: milestone.label,
        text: "Watched autoplay carry the beat.",
      });
      await waitForInhabitTransition(
        session,
        beforeSignature,
        `${milestone.label}-watch-${attempt + 1}`,
      );
      await closeInhabitSupportPanel(session);
      continue;
    }
    if (!control) {
      const dom = await session.readDomSnapshot().catch(() => null);
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
      openedSupportForControl,
      milestone: milestone.label,
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

  const finalProbe = await session.readBrowserProbe();
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

async function runInhabitGameplayPass(session) {
  const url = `${getWebBase()}?new=1&autoplay=1&freezeAutoplay=1&inhabitGameplay=${Date.now()}`;
  await session.navigate(url);
  const moments = [];
  const clickLog = [];
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
  const frozenProbe = await session.readBrowserProbe();
  const watchUrl = `${getWebBase()}?gameId=${encodeURIComponent(
    frozenProbe.gameId,
  )}&autoplay=1&inhabitGameplay=${Date.now()}`;
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
  ];

  for (const milestone of milestones) {
    await clickUntilInhabitMilestone({
      clickLog,
      maxClicks: milestone.maxClicks,
      milestone,
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

  const visibleControlClickCount = clickLog.filter(
    (entry) => entry.kind === "visible-control-click",
  ).length;
  const watchedAutoContinueCount = clickLog.filter(
    (entry) => entry.kind === "watched-auto-continue",
  ).length;
  assert.ok(
    visibleControlClickCount >= 4,
    `Inhabit gameplay pass clicked too few visible controls to count as a player-POV run: ${visibleControlClickCount}.`,
  );
  assert.ok(
    clickLog.length >= 10,
    `Inhabit gameplay pass had too few player-facing interactions/watch beats: ${clickLog.length}.`,
  );
  assert.equal(
    milestonesReached.at(-1),
    "first-afternoon-complete",
    "Inhabit gameplay pass did not end at first-afternoon completion.",
  );
  assert.ok(
    moments.every((moment) => moment.screenshot),
    "Inhabit gameplay pass must capture screenshot evidence for every player milestone.",
  );
  assertInhabitOpeningCtaProgression(moments);
  assertInhabitSituatedWatchCtaCopy(moments);

  const reportPath = path.join(OUTPUT_DIR, "inhabit-gameplay-report.json");
  const report = {
    cameraCheck,
    clickCount: clickLog.length,
    directSimCommandsUsed: false,
    evidenceStandard:
      "Progression is driven by visible browser controls, pointer drags, and normal watch-mode beats; sim probes are read only for assertions.",
    moments,
    milestonesReached,
    panelChecks,
    progressionClicks: clickLog,
    reportPath,
    rowanNotebookClick,
    status: "passed",
    url,
    visibleControlClickCount,
    watchUrl,
    watchedAutoContinueCount,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
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
  const frameListPath = path.join(OUTPUT_DIR, "rowan-gameplay-regression.frames.txt");
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
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
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
  await writeFile(manifestPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

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
      label: "home-reset",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "first-afternoon-complete",
      mutate: async () => advanceObjective(gameRef.current.id, true),
    },
    {
      label: "exit-morrow-for-repair",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          type: "act",
          actionId: "exit:boarding-house",
        }),
    },
    {
      label: "stage-repair-move",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          type: "move_to",
          x: 16,
          y: 9,
        }),
    },
    {
      label: "enter-repair-interior",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          type: "act",
          actionId: "enter:repair-stall",
        }),
    },
    {
      label: "repair-jo-live-thread",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          type: "act",
          actionId: "talk:npc-jo",
        }),
    },
    {
      label: "buy-wrench-interior",
      mutate: async () =>
        runGameCommand(gameRef.current.id, {
          type: "act",
          actionId: "buy:item-wrench",
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
  let inhabitGameplay = null;
  const session = USE_CHROME_DRIVER
    ? await launchBrowserSession(browserUrl(game.id))
    : null;

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
            dom: routeStartCapture.dom,
            game: previousGame,
            label: routeStartLabel,
            mapAgency: routeStartCapture.mapAgency,
            probe: routeStartCapture.probe,
            screenshot: routeStartCapture.screenshot,
            screenshotError: routeStartCapture.screenshotError,
          }),
        );
        await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");

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
            dom: routeMidCapture.dom,
            game: previousGame,
            label: routeMidLabel,
            mapAgency: routeMidCapture.mapAgency,
            probe: routeMidCapture.probe,
            screenshot: routeMidCapture.screenshot,
            screenshotError: routeMidCapture.screenshotError,
          }),
        );
        await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");

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
              dom: routeCloseCapture.dom,
              game: previousGame,
              label: routeCloseLabel,
              mapAgency: routeCloseCapture.mapAgency,
              probe: routeCloseCapture.probe,
              screenshot: routeCloseCapture.screenshot,
              screenshotError: routeCloseCapture.screenshotError,
            }),
          );
          await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");
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
          dom: capture.dom,
          game,
          label: step.label,
          mapAgency: capture.mapAgency,
          probe: capture.probe,
          screenshot: capture.screenshot,
          screenshotError: capture.screenshotError,
        }),
      );
      await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, "utf8");
      traceRegression(`step-written:${index}:${step.label}`);
    }

    if (session !== null) {
      traceRegression("overlay-start");
      overlayChecks = await runOverlayPanelChecks(session);
      traceRegression("overlay-done");
      traceRegression("autoplay-observation-start");
      autoplayObservation = await runAutoplayObservation(session);
      traceRegression("autoplay-observation-done");
      traceRegression("inhabit-gameplay-start");
      inhabitGameplay = await runInhabitGameplayPass(session);
      traceRegression("inhabit-gameplay-done");
      assert.deepEqual(
        session.pageErrors,
        [],
        `Browser emitted runtime/log errors: ${JSON.stringify(session.pageErrors, null, 2)}`,
      );
    }
  } finally {
    traceRegression("closing-session");
    await session?.close();
    traceRegression("closing-web-server");
    await closeChildProcess(webServer);
    traceRegression("closed");
  }

  const byLabel = Object.fromEntries(
    timeline.map((entry) => [entry.label, entry]),
  );

  assertTimelineRoute(
    byLabel,
    "stage-cafe-move-route-start",
    "Morrow House to Kettle & Lamp",
  );
  assertTimelineRoute(
    byLabel,
    "stage-home-move-route-start",
    "Kettle & Lamp to Morrow House",
  );
  assertTimelineRoute(
    byLabel,
    "stage-repair-move-route-start",
    "Morrow House to Mercer Repairs",
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
    byLabel["first-afternoon-complete"],
    "Expected browser evidence for first-afternoon completion after the room route.",
  );
  assert.equal(
    byLabel["first-afternoon-complete"]?.autonomy?.label,
    "First afternoon complete",
    "Expected first-afternoon completion to resolve after Rowan reaches the room/take-stock anchor.",
  );
  assert.equal(
    byLabel["first-afternoon-complete"]?.autonomy?.mode,
    "idle",
    "Expected first-afternoon completion to be a settled in-place completion, not another movement route.",
  );
  assertTimelineRoute(
    byLabel,
    "repair-jo-live-thread-route-start",
    "Mercer Repairs entry to Jo",
    { spaceId: "interior:repair-stall" },
  );
  assertTimelineRoute(
    byLabel,
    "buy-wrench-interior-route-start",
    "Jo to Mercer Repairs wrench anchor",
    { minPathPoints: 2, spaceId: "interior:repair-stall" },
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
  assertCleanSettledInteriorFrame(
    byLabel,
    "lunch-rush",
    "interior:tea-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "enter-morrow-return",
    "interior:boarding-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "home-reset",
    "interior:boarding-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "first-afternoon-complete",
    "interior:boarding-house",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "enter-repair-interior",
    "interior:repair-stall",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "repair-jo-live-thread",
    "interior:repair-stall",
  );
  assertCleanSettledInteriorFrame(
    byLabel,
    "buy-wrench-interior",
    "interior:repair-stall",
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
    byLabel["home-reset"]?.location?.id,
    "boarding-house",
    "Expected Rowan to stay at Morrow House after routing to the room/take-stock anchor.",
  );
  assert.match(
    byLabel["home-reset"]?.autonomy?.label ?? "",
    /take stock|first afternoon complete/i,
    "Expected Rowan to take stock or finish the first-afternoon outcome at Morrow House.",
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
  const finalFieldNote = byLabel["first-afternoon-complete"]?.sim?.fieldNote;
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
  assert.equal(
    byLabel["exit-morrow-for-repair"]?.location?.spaceId,
    "street:south-quay",
    "Expected Rowan to exit Morrow House before routing to Mercer Repairs.",
  );
  assert.equal(
    byLabel["stage-repair-move"]?.location?.id,
    "repair-stall",
    "Expected Rowan to route to Mercer Repairs on the street map.",
  );
  assert.equal(
    byLabel["enter-repair-interior"]?.location?.spaceId,
    "interior:repair-stall",
    "Expected the browser run to switch into the Mercer Repairs interior.",
  );
  assert.equal(
    byLabel["repair-jo-live-thread"]?.activeConversation?.npcId,
    "npc-jo",
    "Expected Rowan to reach Jo inside Mercer Repairs.",
  );
  assert.equal(
    byLabel["buy-wrench-interior"]?.location?.spaceId,
    "interior:repair-stall",
    "Expected Rowan to stay inside Mercer Repairs while buying the wrench.",
  );
  assert.ok(
    byLabel["buy-wrench-interior"]?.sim?.inventory?.some(
      (item) => item.id === "item-wrench",
    ),
    "Expected Rowan to buy the wrench at the Mercer Repairs anchor.",
  );

  const screenshotCount = timeline.filter((entry) => entry.screenshot).length;
  const movementAudit = buildMovementAuditSummary(timeline);
  assertMovementAuditSummary(movementAudit);
  const evidence = await createVisualEvidence({
    overlayChecks,
    timeline,
  });
  const summary = {
    browserDriver: BROWSER_DRIVER,
    autoplayObservation,
    evidence,
    finalGameId: game.id,
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
    npcDiagnostics: movementAudit.npcPatrols,
    outputDir: OUTPUT_DIR,
    overlayChecks,
    routeDiagnostics: movementAudit.playerRoutes,
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
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  process.stdout.write(
    `[many-lives] Rowan ${USE_CHROME_DRIVER ? "Chrome" : "in-app probe"} regression passed.\n[many-lives] Web base: ${getWebBase()}\n[many-lives] Game URL: ${browserUrl(game.id)}\n[many-lives] Output: ${OUTPUT_DIR}\n[many-lives] Timeline: ${timelinePath}\n[many-lives] Summary: ${summaryPath}\n${evidence.recordingPath ? `[many-lives] Recording: ${evidence.recordingPath}\n` : ""}`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Rowan browser regression failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
