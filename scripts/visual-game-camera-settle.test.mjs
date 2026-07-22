import assert from "node:assert/strict";
import test from "node:test";

import {
  stableCameraProbeWindow,
  waitForStableCameraProbes,
} from "./visual-game-camera-settle.mjs";

function cameraProbe(x, renderedAtMs, overrides = {}) {
  return {
    activeSpaceId: "interior:boarding-house",
    activeSpaceKind: "interior",
    dragging: false,
    followWorldPoint: { x: 340, y: 220 },
    playerWorldPoint: { x: 340, y: 220 },
    renderedAtMs,
    sceneViewport: { height: 720, width: 960, x: 0, y: 0 },
    sceneViewportCss: { height: 720, width: 960, x: 0, y: 0 },
    scroll: { x, y: 40 },
    scrollRange: { maxX: 120, maxY: 80, minX: 0, minY: 0 },
    renderScale: 1,
    zoom: 1,
    ...overrides,
  };
}

test("camera settle waits through late easing on distinct rendered frames", async () => {
  const sequence = [
    cameraProbe(9.2, 200),
    cameraProbe(14, 600),
    cameraProbe(15, 1_000),
    cameraProbe(15.5, 1_400),
  ];
  let frameWaits = 0;
  const result = await waitForStableCameraProbes({
    initialProbe: cameraProbe(0, 0),
    isEligible: (probe) => probe.activeSpaceKind === "interior",
    readProbe: async () => sequence.shift(),
    timeoutMs: 10_000,
    waitForFrame: async () => {
      frameWaits += 1;
    },
  });

  assert.equal(frameWaits, 4);
  assert.deepEqual(
    result.samples.map((probe) => probe.scroll.x),
    [14, 15, 15.5],
  );
  assert.equal(result.settled.scroll.x, 14);
  assert.equal(result.settledAgain.scroll.x, 15.5);
});

test("camera settle rejects repeated drift instead of raising the tolerance", async () => {
  let elapsedMs = 0;
  let x = 0;
  let renderedAtMs = 0;
  await assert.rejects(
    waitForStableCameraProbes({
      initialProbe: cameraProbe(x, renderedAtMs),
      isEligible: (probe) => probe.activeSpaceKind === "interior",
      now: () => elapsedMs,
      readProbe: async () => {
        x += 3;
        renderedAtMs += 400;
        return cameraProbe(x, renderedAtMs);
      },
      timeoutMs: 1_000,
      waitForFrame: async () => {
        elapsedMs += 250;
      },
    }),
    /Timed out waiting for 3 stable camera frames spanning 800 rendered milliseconds within 2 world pixels/,
  );
});

test("camera settle rejects stale timestamps and undersized rendered spans", () => {
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 100),
      cameraProbe(10.5, 100),
      cameraProbe(11, 900),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 100),
      cameraProbe(10.5, 400),
      cameraProbe(11, 899),
    ]),
    null,
  );
});

test("camera settle ignores stale reads until distinct rendered probes converge", async () => {
  const sequence = [
    cameraProbe(10, 0),
    cameraProbe(10, 400),
    cameraProbe(10.5, 400),
    cameraProbe(11, 800),
  ];
  const result = await waitForStableCameraProbes({
    initialProbe: cameraProbe(10, 0),
    isEligible: (probe) => probe.activeSpaceKind === "interior",
    readProbe: async () => sequence.shift(),
    timeoutMs: 10_000,
    waitForFrame: async () => {},
  });

  assert.deepEqual(
    result.samples.map((probe) => probe.renderedAtMs),
    [0, 400, 800],
  );
});

test("camera settle requires one coherent non-dragging projection", () => {
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400, { activeSpaceId: "street:south-quay" }),
      cameraProbe(11, 800),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400, { dragging: true }),
      cameraProbe(11, 800),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400, {
        sceneViewport: { height: 720, width: 940, x: 0, y: 0 },
      }),
      cameraProbe(11, 800),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400, {
        scrollRange: { maxX: 121, maxY: 80, minX: 0, minY: 0 },
      }),
      cameraProbe(11, 800),
    ]),
    null,
  );
});

test("camera settle rejects moving subjects, follow targets, and zoom", () => {
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400),
      cameraProbe(11, 800, { playerWorldPoint: { x: 343, y: 220 } }),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400),
      cameraProbe(11, 800, { followWorldPoint: { x: 340, y: 223 } }),
    ]),
    null,
  );
  assert.equal(
    stableCameraProbeWindow([
      cameraProbe(10, 0),
      cameraProbe(10.5, 400),
      cameraProbe(11, 800, { zoom: 1.002 }),
    ]),
    null,
  );
});

test("camera settle accepts fresh stable rendered samples", () => {
  const samples = [
    cameraProbe(10, 0),
    cameraProbe(10.8, 400),
    cameraProbe(11.5, 800),
  ];
  assert.deepEqual(stableCameraProbeWindow(samples), samples);
});
