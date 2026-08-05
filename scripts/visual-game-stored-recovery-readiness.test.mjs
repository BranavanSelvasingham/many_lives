import assert from "node:assert/strict";
import test from "node:test";

import {
  hasWatchModeProgressText,
  storedGameRecoveryHasVisibleAutoplayProgress,
  waitForRecoveredDesktopRenderableState,
} from "./visual-game-smoke.mjs";

const DESKTOP = { height: 720, name: "desktop", width: 1280 };

function readinessState(gameId, overrides = {}) {
  const visible = {
    rect: { height: 720, width: 1280, x: 0, y: 0 },
    visible: true,
  };
  return {
    bodyTextSample: "Rowan is choosing his next move.",
    browserProbeGameId: gameId,
    cameraRenderedAtMs: 100,
    cameraSceneViewportCss: { height: 720, width: 920, x: 0, y: 0 },
    canvas: visible,
    expectedGameId: "game-recovered",
    hasFrameworkOverlay: false,
    hud: {
      rect: { height: 52, width: 530, x: 16, y: 16 },
      visible: true,
    },
    innerViewport: { height: 720, width: 1280 },
    rail: {
      rect: { height: 630, width: 332, x: 932, y: 74 },
      visible: true,
    },
    ready: gameId === "game-recovered",
    reasons: gameId === "game-recovered" ? [] : ["game-id-mismatch"],
    root: visible,
    rootClass: "ml-root is-watch-mode is-rail-collapsed",
    url: "http://127.0.0.1:3001/",
    ...overrides,
  };
}

function fakeSession(states) {
  let reads = 0;
  let frameWaits = 0;
  return {
    evaluate: async () => {
      const state = states[Math.min(reads, states.length - 1)];
      reads += 1;
      return state;
    },
    get frameWaits() {
      return frameWaits;
    },
    get reads() {
      return reads;
    },
    waitForAnimationFrames: async (count) => {
      assert.equal(count, 2);
      frameWaits += 1;
    },
  };
}

test("recovered desktop capture waits through a blank remount and the wrong game", async () => {
  const blank = readinessState(null, {
    bodyTextSample: "",
    cameraSceneViewportCss: null,
    canvas: { rect: null, visible: false },
    hud: { rect: null, visible: false },
    rail: { rect: null, visible: false },
    ready: false,
    reasons: [
      "root-not-renderable",
      "canvas-not-renderable",
      "rail-not-visible",
      "hud-not-visible",
      "camera-probe-not-ready",
      "game-id-mismatch",
    ],
    root: { rect: null, visible: false },
    rootClass: "",
  });
  const session = fakeSession([
    blank,
    readinessState("game-stale"),
    readinessState("game-recovered"),
    blank,
    readinessState("game-recovered"),
    readinessState("game-recovered"),
    readinessState("game-recovered"),
  ]);

  const result = await waitForRecoveredDesktopRenderableState(
    session,
    "game-recovered",
    DESKTOP,
    { pollIntervalMs: 0, requiredStableSamples: 3, timeoutMs: 1_000 },
  );

  assert.equal(result.browserProbeGameId, "game-recovered");
  assert.equal(result.stableSamples, 3);
  assert.equal(session.reads, 7);
  assert.equal(session.frameWaits, 7);
  assert.ok(
    result.diagnostics.some((sample) =>
      sample.reasons?.includes("root-not-renderable"),
    ),
    "The gate should retain the temporary blank state in its diagnostics.",
  );
  assert.ok(
    result.diagnostics.some((sample) =>
      sample.reasons?.includes("game-id-mismatch"),
    ),
    "The gate should retain the stale game identity in its diagnostics.",
  );
});

test("recovered desktop capture rejects a stable render for another game id", async () => {
  const session = fakeSession([readinessState("game-stale")]);

  await assert.rejects(
    waitForRecoveredDesktopRenderableState(
      session,
      "game-recovered",
      DESKTOP,
      { pollIntervalMs: 0, requiredStableSamples: 2, timeoutMs: 20 },
    ),
    (error) => {
      assert.match(error.message, /game-recovered/);
      assert.match(error.message, /game-stale/);
      assert.match(error.message, /game-id-mismatch/);
      assert.match(error.message, /Required 2 stable samples/);
      return true;
    },
  );
  assert.ok(session.reads > 1);
});

test("stored recovery accepts a completed zero-click entry into Morrow House", () => {
  assert.equal(
    storedGameRecoveryHasVisibleAutoplayProgress({
      location: {
        id: "boarding-house",
        spaceId: "interior:boarding-house",
      },
      openingActionCarryForward: {
        completionEvidence: ["entered-morrow-house"],
        phase: "opening_completed",
        progressedBeyondOpening: false,
        requiredVisibleInput: false,
        selectedActionId: "enter:boarding-house",
        status: "completed",
        targetLocationId: "boarding-house",
        watchMode: { enabled: true, frozen: false },
      },
    }),
    true,
  );
});

test("stored recovery rejects entry evidence without a rendered interior", () => {
  assert.equal(
    storedGameRecoveryHasVisibleAutoplayProgress({
      location: {
        id: "boarding-house",
        spaceId: "street:south-quay",
      },
      openingActionCarryForward: {
        completionEvidence: ["entered-morrow-house"],
        phase: "opening_completed",
        progressedBeyondOpening: false,
        requiredVisibleInput: false,
        selectedActionId: "enter:boarding-house",
        status: "completed",
        targetLocationId: "boarding-house",
        watchMode: { enabled: true, frozen: false },
      },
    }),
    false,
  );
});

test("watch progress accepts probe-backed legal movement without fixed copy", () => {
  assert.equal(
    hasWatchModeProgressText("Moving inside Morrow House", {
      movement: {
        playerRoute: {
          active: true,
          legal: true,
          progress: 0.003,
          reachesDestination: true,
        },
      },
    }),
    true,
  );
  assert.equal(
    hasWatchModeProgressText("Moving inside Morrow House", {
      movement: {
        playerRoute: {
          active: true,
          legal: false,
          progress: 0.003,
          reachesDestination: true,
        },
      },
    }),
    false,
  );
});
