import assert from "node:assert/strict";
import test from "node:test";

import { captureValidatedScreenshot } from "./visual-game-smoke.mjs";

const VIEWPORT = { height: 720, name: "desktop", width: 1280 };
const INITIAL_HUD = [
  "Day 1",
  "11:02 Late morning",
  "$12",
  "72 energy",
  "0/4 outcomes met",
];
const ADVANCED_HUD = [
  "Day 1",
  "11:03 Late morning",
  "$12",
  "71 energy",
  "2/4 outcomes met",
];

function rect(left, top, width, height) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
  };
}

function pageWithHud(hud = INITIAL_HUD) {
  const timePill = rect(16, 16, 620, 50);
  const chipRects = hud.map((_, index) => rect(28 + index * 116, 25, 104, 30));
  const visibleTimeChipStyles = hud.map((text, index) => ({
    contentVisibility: "visible",
    display: "inline-flex",
    opacity: 1,
    rect: chipRects[index],
    text,
    visibility: "visible",
  }));
  const visibleTimeGlyphStyles = hud.flatMap((text, chipIndex) => {
    const runs = chipIndex === 1 ? text.split(" ", 2) : [text];
    return runs.map((run, runIndex) => ({
      chipIndex,
      chipText: text,
      opacity: 1,
      rect: rect(32 + chipIndex * 116 + runIndex * 34, 30, 30, 18),
      text: run,
      visibility: "visible",
    }));
  });

  return {
    dockRoot: rect(16, 650, 880, 50),
    releaseWidget: null,
    rightStack: rect(936, 80, 328, 500),
    timePill,
    timePillComputedStyle: {
      contentVisibility: "visible",
      display: "flex",
      opacity: 1,
      visibility: "visible",
    },
    visibleTimeChips: [...hud],
    visibleTimeChipStyles,
    visibleTimeGlyphStyles,
  };
}

function healthyCamera(overrides = {}) {
  return {
    activeSpaceId: "street:south-quay",
    dragging: false,
    scroll: { x: 100, y: 100 },
    scrollRange: { maxX: 400, maxY: 300, minX: 0, minY: 0 },
    zoom: 1,
    ...overrides,
  };
}

function captureDependencies({
  diagnosticPage = pageWithHud(ADVANCED_HUD),
  camera = healthyCamera(),
  validationError = "transient screenshot paint corruption",
  validationFailures = 1,
} = {}) {
  let validations = 0;
  const validatedPages = [];
  return {
    dependencies: {
      captureScreenshot: async () => {},
      inspectPage: async () => diagnosticPage,
      readCameraProbe: async () => camera,
      readScreenshot: async () => Buffer.from(`frame-${validations}`),
      validateScreenshot: (_screenshot, page) => {
        validations += 1;
        validatedPages.push(page.visibleTimeChips);
        if (validations <= validationFailures) {
          throw new Error(validationError);
        }
        return {
          hudChipDiagnostics: [],
          largestNearBlackComponent: null,
          uiTextDiagnostics: [],
        };
      },
      waitForRepaint: async (delayMs) => assert.equal(delayMs, 180),
    },
    get validatedPages() {
      return validatedPages;
    },
  };
}

async function runCapture(overrides = {}) {
  const harness = captureDependencies(overrides);
  const result = await captureValidatedScreenshot({
    dependencies: harness.dependencies,
    expectedHudText: INITIAL_HUD,
    label: "VF-24 changing HUD",
    page: pageWithHud(INITIAL_HUD),
    session: {},
    targetPath: "/tmp/vf-24.png",
    viewport: VIEWPORT,
  });
  return { harness, result };
}

test("VF-24 retries against one freshly inspected advancing HUD", async () => {
  const { harness, result } = await runCapture();

  assert.equal(result.retryCount, 1);
  assert.deepEqual(result.page.visibleTimeChips, ADVANCED_HUD);
  assert.deepEqual(harness.validatedPages, [INITIAL_HUD, ADVANCED_HUD]);
});

for (const [name, hud] of [
  ["missing content", ADVANCED_HUD.slice(0, 4)],
  [
    "reordered content",
    [
      ADVANCED_HUD[0],
      ADVANCED_HUD[2],
      ADVANCED_HUD[1],
      ...ADVANCED_HUD.slice(3),
    ],
  ],
  [
    "malformed content",
    [...ADVANCED_HUD.slice(0, 3), "energy 71", ADVANCED_HUD[4]],
  ],
]) {
  test(`VF-24 rejects ${name} in a freshly inspected retry HUD`, async () => {
    await assert.rejects(
      runCapture({ diagnosticPage: pageWithHud(hud) }),
      /HUD content roles changed|HUD content is malformed|HUD content is reordered/,
    );
  });
}

test("VF-24 retains clipping, visibility, opacity, and camera health gates", async () => {
  for (const [name, mutate, pattern] of [
    [
      "clipped",
      (page) => {
        page.timePill.x = -20;
        page.timePill.left = -20;
      },
      /top HUD is clipped/,
    ],
    [
      "not displayed",
      (page) => {
        page.timePillComputedStyle.display = "none";
      },
      /computed display is none/,
    ],
    [
      "hidden",
      (page) => {
        page.timePillComputedStyle.visibility = "hidden";
      },
      /visibility is hidden/,
    ],
    [
      "transparent",
      (page) => {
        page.timePillComputedStyle.opacity = 0;
      },
      /computed opacity is 0/,
    ],
  ]) {
    const page = pageWithHud(ADVANCED_HUD);
    mutate(page);
    await assert.rejects(
      runCapture({ diagnosticPage: page }),
      pattern,
      name,
    );
  }

  await assert.rejects(
    runCapture({ camera: healthyCamera({ dragging: true }) }),
    /camera diagnostics were unhealthy/,
  );
  await assert.rejects(
    runCapture({ camera: healthyCamera({ scroll: { x: 999, y: 100 } }) }),
    /camera diagnostics were unhealthy/,
  );
});

for (const [name, validationError] of [
  ["corrupt", "transient screenshot paint corruption"],
  ["stale", "stale screenshot capture"],
]) {
  test(`VF-24 still fails closed after three ${name} frames`, async () => {
    await assert.rejects(
      runCapture({ validationError, validationFailures: 3 }),
      new RegExp(
        `could not capture a complete visual frame after 3 attempts.*${validationError}`,
      ),
    );
  });
}
