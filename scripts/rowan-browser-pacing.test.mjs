import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deflateSync, inflateSync } from "node:zlib";

const browserRegressionPath = new URL(
  "./rowan-browser-regression.mjs",
  import.meta.url,
);
const source = await readFile(browserRegressionPath, "utf8");
const pngDecodeStart = source.indexOf("function paethPredictor(");
const pngDecodeEnd = source.indexOf(
  "\nfunction assertNoLargeNearBlackDropout(",
  pngDecodeStart,
);
const decodePngPixels = Function(
  "assert",
  "inflateSync",
  `${source.slice(pngDecodeStart, pngDecodeEnd)}; return decodePngPixels;`,
)(assert, inflateSync);
const overlayDomStateSource = await readFile(
  new URL(
    "../apps/many-lives-web/src/lib/street/overlayDomState.ts",
    import.meta.url,
  ),
  "utf8",
);
const streetRuntimeSource = await readFile(
  new URL(
    "../apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const streetOverlayHtmlSource = await readFile(
  new URL(
    "../apps/many-lives-web/src/components/street/streetOverlayHtml.ts",
    import.meta.url,
  ),
  "utf8",
);
const streetOverlayStylesSource = await readFile(
  new URL(
    "../apps/many-lives-web/src/lib/street/streetOverlayStyles.ts",
    import.meta.url,
  ),
  "utf8",
);
const rowanPlaybackSource = await readFile(
  new URL(
    "../apps/many-lives-web/src/lib/street/rowanPlayback.ts",
    import.meta.url,
  ),
  "utf8",
);
const assertionStart = source.indexOf(
  "function assertReadableFirstAfternoonDwell(",
);
const assertionEnd = source.indexOf(
  "function assertWatchPacingAudit(",
  assertionStart,
);
const assertionSource = source.slice(assertionStart, assertionEnd);
const pacingAssertionStart = source.indexOf(
  "function assertAutoplayObservationPacingLedger(",
);
const pacingAssertionEnd = source.indexOf(
  "\nfunction ",
  pacingAssertionStart + 1,
);
const pacingAssertionSource = source.slice(
  pacingAssertionStart,
  pacingAssertionEnd,
);
const cumulativeAppMonotonicStart = source.indexOf(
  "function buildCumulativeAppMonotonicSamples(",
);
const cumulativeAppMonotonicEnd = source.indexOf(
  "\nfunction ",
  cumulativeAppMonotonicStart + 1,
);
const buildCumulativeAppMonotonicSamples = Function(
  `return (${source.slice(
    cumulativeAppMonotonicStart,
    cumulativeAppMonotonicEnd,
  )})`,
)();
const playbackCardDwellAuditStart = source.indexOf(
  "function buildAutoplayPlaybackCardDwellAudit(",
);
const playbackCardDwellAuditEnd = source.indexOf(
  "\nfunction ",
  playbackCardDwellAuditStart + 1,
);
const buildAutoplayPlaybackCardDwellAudit = Function(
  "AUTOPLAY_DWELL_AUDIT_BEAT_KINDS",
  "AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS",
  `return (${source.slice(
    playbackCardDwellAuditStart,
    playbackCardDwellAuditEnd,
  )})`,
)(
  new Set([
    "action_complete",
    "action_start",
    "city_beat",
    "objective_shift",
    "rest",
    "thread_landed",
    "time_passed",
  ]),
  2_000,
);
const sleepUntilEpochStart = source.indexOf("async function sleepUntilEpochMs(");
const sleepUntilEpochEnd = source.indexOf(
  "\nfunction ",
  sleepUntilEpochStart + 1,
);
const sleepUntilEpochMs = Function(
  `return (${source.slice(sleepUntilEpochStart, sleepUntilEpochEnd)})`,
)();
const visualMoveSettlementStart = source.indexOf(
  "function recordVisualMoveSettlementProgress(",
);
const visualMoveSettlementEnd = source.indexOf(
  "\nfunction ",
  visualMoveSettlementStart + 1,
);
const recordVisualMoveSettlementProgress = Function(
  `return (${source.slice(
    visualMoveSettlementStart,
    visualMoveSettlementEnd,
  )})`,
)();
const naturalStopClassifierStart = source.indexOf(
  "function classifyAutoplayNaturalFirstAfternoonStop(",
);
const naturalStopClassifierEnd = source.indexOf(
  "\nfunction ",
  naturalStopClassifierStart + 1,
);
const classifyAutoplayNaturalFirstAfternoonStop = Function(
  "AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS",
  `return (${source.slice(
    naturalStopClassifierStart,
    naturalStopClassifierEnd,
  )})`,
)(2_000);
const routeCanvasGeometryStart = source.indexOf(
  "function buildAutoplayRouteCanvasReadbackGeometry(",
);
const routeCanvasGeometryEnd = source.indexOf(
  "\nconst APP_READY_TIMEOUT_MS",
  routeCanvasGeometryStart + 1,
);
const buildAutoplayRouteCanvasReadbackGeometry = Function(
  `return (${source.slice(
    routeCanvasGeometryStart,
    routeCanvasGeometryEnd,
  )})`,
)();
const routeRecorderSamplerStart = source.indexOf(
  "function sampleAutoplayRouteRecorderAtOrAfter(",
);
const routeRecorderSamplerEnd = source.indexOf(
  "\nfunction ",
  routeRecorderSamplerStart + 1,
);
const sampleAutoplayRouteRecorderAtOrAfter = Function(
  `return (${source.slice(
    routeRecorderSamplerStart,
    routeRecorderSamplerEnd,
  )})`,
)();
function completedFirstAfternoonSample(overrides = {}) {
  return {
    autonomy: {
      actionId: null,
      autoContinue: false,
    },
    firstAfternoon: {
      completedAt: "2026-03-21T14:14:00.000Z",
      completionAcknowledgedAt: null,
      consequence: {
        achievedAt: "2026-03-21T14:14:00.000Z",
        id: "problem-pump",
        kind: "local-problem",
      },
    },
    objective: {
      routeKey: "first-afternoon",
      text: "Secure one foothold before the afternoon closes.",
    },
    ...overrides,
  };
}

function acknowledgedFirstAfternoonHandoffSample() {
  return completedFirstAfternoonSample({
    autonomy: {
      actionId: "rest:home",
      autoContinue: true,
      label: "Rest for an hour",
      targetLocationId: "boarding-house",
    },
    firstAfternoon: {
      completedAt: "2026-03-21T14:14:00.000Z",
      completionAcknowledgedAt: "2026-03-21T14:14:00.000Z",
      consequence: {
        achievedAt: "2026-03-21T14:14:00.000Z",
        evidence:
          "Leaking hand pump solved after Rowan grounded the local problem.",
        id: "problem-pump",
        kind: "local-problem",
        label: "Leaking hand pump solved",
      },
    },
    objective: {
      routeKey: "rest-home",
      text: "Recover enough at Morrow House to move cleanly again.",
    },
    planningTrace: {
      selectedActionId: "rest:home",
      selectedLabel: "Rest for an hour",
      selectedLegalBacking: {
        actionId: "rest:home",
        source: "current-legal-action-surface",
      },
      selectedRecommendation: {
        accepted: true,
        legalBackingSource: "current-legal-action-surface",
        sourceKind: "deterministic-planner",
        validationSource: "current-legal-action-surface",
        validationStatus: "legal-action-surface-validated",
      },
    },
    visibleDecisionArtifact: {
      selectedAction: "Rest for an hour",
    },
  });
}

test("first-afternoon readability uses full app-visible dwell", () => {
  assert.ok(assertionStart >= 0 && assertionEnd > assertionStart);
  assert.match(assertionSource, /entry\.fullAppDurationMs/);
  assert.match(assertionSource, /entry\.autoContinueIntendedDelayMs/);
  assert.match(
    assertionSource,
    /FIRST_AFTERNOON_MIN_VISIBLE_DWELL_MS/,
  );
});

test("completion and handoff both use the full-dwell assertion", () => {
  assert.equal(
    (source.match(/assertReadableFirstAfternoonDwell\(/g) ?? []).length,
    3,
  );
  assert.match(
    source,
    /assertReadableFirstAfternoonDwell\(\s*completionDwell,/,
  );
  assert.match(
    source,
    /assertReadableFirstAfternoonDwell\(\s*handoffDwell,/,
  );
});

test("ordinary completion idle remains a natural first-afternoon stop", () => {
  assert.deepEqual(
    classifyAutoplayNaturalFirstAfternoonStop(
      completedFirstAfternoonSample(),
      [],
    ),
    {
      accepted: true,
      evidence: "completion-idle",
    },
  );
});

test("a slow observer accepts the acknowledged state-derived handoff from CI", () => {
  const sample = acknowledgedFirstAfternoonHandoffSample();

  assert.deepEqual(
    classifyAutoplayNaturalFirstAfternoonStop(sample, [
      {
        configuredDurationMs: 2_800,
        evidence: "active-terminal-card",
        key: "objective-shift:rest-home",
        kind: "objective_shift",
        observedAppDurationMs: 547.6,
      },
    ]),
    {
      accepted: true,
      evidence: "acknowledged-state-derived-handoff",
      handoffActionId: "rest:home",
      handoffCardKey: "objective-shift:rest-home",
      handoffRouteKey: "rest-home",
    },
  );
});

test("acknowledged state-derived handoff without its active shift card is rejected", () => {
  assert.deepEqual(
    classifyAutoplayNaturalFirstAfternoonStop(
      acknowledgedFirstAfternoonHandoffSample(),
      [],
    ),
    {
      accepted: false,
      evidence: "untrusted-post-completion-state",
    },
  );
});

test("completed state without trustworthy handoff evidence is rejected", () => {
  const sample = completedFirstAfternoonSample({
    autonomy: {
      actionId: "wander:anywhere",
      autoContinue: true,
      label: "Wander",
    },
    firstAfternoon: {
      completedAt: "2026-03-21T14:14:00.000Z",
      completionAcknowledgedAt: "2026-03-21T14:14:00.000Z",
      consequence: {
        achievedAt: "2026-03-21T14:14:00.000Z",
        id: "problem-pump",
        kind: "local-problem",
      },
    },
    objective: {
      routeKey: "wander",
      text: "Wander without validated backing.",
    },
    visibleDecisionArtifact: {
      selectedAction: "Wander",
    },
  });

  assert.deepEqual(
    classifyAutoplayNaturalFirstAfternoonStop(sample, [
      {
        configuredDurationMs: 2_800,
        evidence: "active-terminal-card",
        key: "objective-shift:wander",
        kind: "objective_shift",
        observedAppDurationMs: 500,
      },
    ]),
    {
      accepted: false,
      evidence: "untrusted-post-completion-state",
    },
  );
});

test("slow-observer handoff recognition cannot replace full dwell proof", () => {
  assert.match(
    streetRuntimeSource,
    /const FIRST_AFTERNOON_COMPLETION_DWELL_MS = 8000;/,
  );
  assert.match(
    assertionSource,
    /entry\.fullAppDurationMs >= FIRST_AFTERNOON_MIN_VISIBLE_DWELL_MS/,
  );
  assert.match(
    source,
    /assertReadableFirstAfternoonDwell\(\s*completionDwell,/,
  );
  assert.match(
    source,
    /assertReadableFirstAfternoonDwell\(\s*handoffDwell,/,
  );
});

test("readability checkpoint accounts for app time before the observer attaches", () => {
  const helperStart = source.indexOf(
    "function remainingFirstAfternoonReadabilityCheckpointMs(",
  );
  const helperEnd = source.indexOf("\nfunction ", helperStart + 1);
  const helperSource = source.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(
    helperSource,
    /FIRST_AFTERNOON_READABILITY_CHECKPOINT_MS - observedElapsedMs/,
  );
  assert.match(
    source,
    /readabilityWaitMs\s*=\s*\n\s*remainingFirstAfternoonReadabilityCheckpointMs\(/,
  );
  assert.match(source, /await sleep\(logEntry\.readabilityWaitMs\)/);
});

test("autoplay pacing uses cumulative app-visible progress gaps", () => {
  assert.ok(
    pacingAssertionStart >= 0 && pacingAssertionEnd > pacingAssertionStart,
  );
  assert.match(source, /buildAutoplayObservationProgressGaps\(/);
  assert.match(source, /previousProgressSample/);
  assert.match(source, /exactPlaybackProgressCheckpointsBetween\(/);
  assert.match(source, /exactPlaybackCheckpoints: playbackCheckpoints/);
  assert.match(source, /A true 24-second product-visible silence must still fail/);
  assert.match(pacingAssertionSource, /ledger\.maxInAppGapMs/);
  assert.match(
    pacingAssertionSource,
    /typeof ledger\.maxInAppGapMs === "number"/,
  );
  assert.doesNotMatch(pacingAssertionSource, /ledger\.maxIdleGapMs/);
  assert.match(source, /progressKinds\.push\("playback-progress"\)/);
  assert.match(source, /progressKinds\.push\("activity-progress"\)/);
  assert.match(source, /stateBackedFollowThroughStarted/);
  assert.match(
    source,
    /previous\.activity\.autoContinue\.key !== next\.activity\.autoContinue\.key/,
  );
  assert.match(source, /\^Following through:/);
  assert.match(
    source,
    /Follow-through copy without a scheduler transition must remain cosmetic-only evidence/,
  );
  assert.match(
    source,
    /activeConversation\?\.replay\?\.streamedWordCount/,
  );
});

test("delayed auto-continue polling splits only on proven follow-through", () => {
  assert.match(source, /exactAutoContinueProgressCheckpointsBetween\(/);
  assert.match(source, /exactAutoContinueCheckpoints: autoContinueCheckpoints/);
  assert.match(
    source,
    /probe\.timing\.autoContinue\.startedAtMs \?\? null/,
  );
  assert.match(source, /key: probe\.autonomy\.key \?\? null/);
  assert.match(
    source,
    /autoContinue\.startedAtMs \+ autoContinue\.intendedDelayMs/,
  );
  assert.match(
    source,
    /documentOffsetMs \+ rawFireAtMs/,
  );
  assert.match(
    source,
    /autoContinue\.elapsedMs < autoContinue\.intendedDelayMs/,
  );
  assert.match(
    source,
    /autoContinue\.key\.endsWith\(`:\$\{autonomyKey\}`\)/,
  );
  assert.match(source, /sample\?\.movement\?\.routeActive/);
  assert.match(source, /evidence: "state-backed-auto-continue"/);
  assert.match(source, /15300\.2ms sampled pacing failure/);
  assert.match(source, /10_992\.4/);
  assert.match(source, /originating document offset/);
  assert.match(source, /Timer start evidence alone/);
  assert.match(source, /Stale scheduler identity/);
  assert.match(source, /Cosmetic follow-through copy/);
  assert.match(
    source,
    /A true 24-second product-visible silence must still fail/,
  );
  assert.match(
    source,
    /One early playback checkpoint must not excuse a later 22-second silence/,
  );
});

test("app-monotonic pacing survives a page clock reset", () => {
  assert.match(source, /buildCumulativeAppMonotonicSamples\(/);
  assert.match(source, /rawAppMonotonicMs/);
  assert.match(source, /sampledSegmentEndMs/);
  assert.match(source, /observedDocumentOffsetMs/);
  assert.match(
    source,
    /Math\.max\(\s*sampledSegmentEndMs,\s*observedDocumentOffsetMs \?\? sampledSegmentEndMs/,
  );
  assert.match(source, /assertAutoplayAppMonotonicResetGuard\(\);/);
  assert.match(
    source,
    /\{ appMonotonicMs: 6_500, rawAppMonotonicMs: 500 \}/,
  );
});

test("app-monotonic pacing recovers the loaded-runner document-reset interval", () => {
  assert.ok(
    cumulativeAppMonotonicStart >= 0 &&
      cumulativeAppMonotonicEnd > cumulativeAppMonotonicStart,
  );
  const samples = buildCumulativeAppMonotonicSamples([
    {
      appMonotonicMs: 720,
      elapsedMs: 910,
      wallMonotonicMs: 720,
    },
    {
      appMonotonicMs: 10_675.9,
      elapsedMs: 11_570,
      wallMonotonicMs: 10_675.9,
    },
    {
      appMonotonicMs: 780.3,
      elapsedMs: 22_954,
      wallMonotonicMs: 780.3,
    },
    {
      appMonotonicMs: 163_782.9,
      elapsedMs: 186_280,
      wallMonotonicMs: 163_782.9,
    },
  ]);

  assert.equal(Math.round(samples[2].appMonotonicMs), 22_764);
  assert.equal(
    Math.round(samples[2].appDocumentResetCompensationMs),
    11_308,
  );
  assert.equal(Math.round(samples[3].appMonotonicMs), 185_767);
  assert.ok(samples[3].appMonotonicMs >= 180_000);
  assert.match(
    source,
    /resetAutoplayFirstAfternoonPresentationFloor\(game\.id\)/,
  );
  assert.match(
    source,
    /sessionStorage\.removeItem\(storageKey\)/,
  );
  assert.ok(
    source.indexOf(
      "resetAutoplayFirstAfternoonPresentationFloor(game.id)",
    ) < source.indexOf("const pacingStartedAt = Date.now()"),
    "Frozen opening evidence must be removed from the floor before live pacing starts.",
  );
});

test("route compositing waits through an early timer wake-up", async () => {
  assert.ok(sleepUntilEpochStart >= 0 && sleepUntilEpochEnd > sleepUntilEpochStart);
  const clockSamples = [100, 224, 225];
  const waits = [];

  await sleepUntilEpochMs(225, {
    now: () => clockSamples.shift() ?? 225,
    sleepFor: async (durationMs) => {
      waits.push(durationMs);
    },
  });

  assert.deepEqual(waits, [125, 1]);
  assert.match(
    source,
    /await sleepUntilEpochMs\(minimumCapturedAtEpochMs\)/,
  );
});

test("route canvas sampling reuses only recorder evidence at the required boundary", () => {
  assert.ok(
    routeRecorderSamplerStart >= 0 &&
      routeRecorderSamplerEnd > routeRecorderSamplerStart,
  );
  const older = { capturedAtEpochMs: 999, route: { progress: 0.1 } };
  const current = { capturedAtEpochMs: 1_000, route: { progress: 0.2 } };
  const recorder = {
    samples: [older, current],
    sample() {
      this.lastSampleStatus = "probe-unavailable";
    },
  };

  assert.equal(
    sampleAutoplayRouteRecorderAtOrAfter({
      minimumCapturedAtEpochMs: 1_000,
      recorder,
    }),
    current,
  );
  assert.equal(
    sampleAutoplayRouteRecorderAtOrAfter({
      minimumCapturedAtEpochMs: 1_001,
      recorder,
    }),
    null,
  );

  const afterCapture = {
    capturedAtEpochMs: 1_025,
    route: { progress: 0.3 },
  };
  recorder.sample = function sample() {
    this.samples.push(afterCapture);
  };
  assert.equal(
    sampleAutoplayRouteRecorderAtOrAfter({
      minimumCapturedAtEpochMs: 1_020,
      recorder,
    }),
    afterCapture,
  );
});

test("route canvas crop is derived from measured CSS and backing-store scale", () => {
  assert.ok(
    routeCanvasGeometryStart >= 0 &&
      routeCanvasGeometryEnd > routeCanvasGeometryStart,
  );
  const scaled = buildAutoplayRouteCanvasReadbackGeometry({
    canvas: { height: 1_350, width: 2_700 },
    canvasIndex: 0,
    contextType: "webgl2",
    cropHeight: 360,
    cropWidth: 640,
    devicePixelRatio: 2,
    rect: { height: 500, left: 24, top: 12, width: 1_000 },
    renderScale: 2.7,
    sceneViewport: { height: 1_080, width: 2_160, x: 270, y: 135 },
    sceneViewportCss: { height: 400, width: 800, x: 100, y: 50 },
  });
  assert.equal(scaled.error, undefined);
  assert.deepEqual(scaled.geometry.crop, {
    height: 360,
    width: 640,
    x: 1_030,
    y: 495,
  });
  assert.equal(
    scaled.geometry.coordinateSpace.cssOriginMode,
    "canvas-local",
  );
  assert.equal(scaled.geometry.coordinateSpace.backingScaleX, 2.7);
  assert.equal(scaled.geometry.coordinateSpace.backingScaleY, 2.7);
  assert.equal(scaled.geometry.coordinateSpace.devicePixelRatio, 2);
  assert.equal(scaled.geometry.coordinateSpace.renderScale, 2.7);
  assert.deepEqual(scaled.geometry.sceneViewportBackingFromCss, {
    height: 1_080,
    width: 2_160,
    x: 270,
    y: 135,
  });

  const clientRelative = buildAutoplayRouteCanvasReadbackGeometry({
    canvas: { height: 1_350, width: 2_700 },
    canvasIndex: 0,
    contextType: "webgl2",
    cropHeight: 360,
    cropWidth: 640,
    devicePixelRatio: 2,
    rect: { height: 500, left: 24, top: 12, width: 1_000 },
    renderScale: 2.7,
    sceneViewport: { height: 1_080, width: 2_160, x: 270, y: 135 },
    sceneViewportCss: { height: 400, width: 800, x: 124, y: 62 },
  });
  assert.equal(clientRelative.error, undefined);
  assert.equal(
    clientRelative.geometry.coordinateSpace.cssOriginMode,
    "client-relative",
  );
  assert.deepEqual(clientRelative.geometry.crop, scaled.geometry.crop);

  assert.equal(
    buildAutoplayRouteCanvasReadbackGeometry({
      canvas: { height: 1_350, width: 2_700 },
      canvasIndex: 0,
      contextType: "webgl2",
      cropHeight: 360,
      cropWidth: 640,
      devicePixelRatio: 2,
      rect: { height: 500, left: 24, top: 12, width: 900 },
      renderScale: 2.7,
      sceneViewport: { height: 1_080, width: 2_160, x: 270, y: 135 },
      sceneViewportCss: { height: 400, width: 800, x: 100, y: 50 },
    }).error,
    "canvas-backing-scale-drift",
  );
  assert.equal(
    buildAutoplayRouteCanvasReadbackGeometry({
      canvas: { height: 1_350, width: 2_700 },
      canvasIndex: 0,
      contextType: "webgl2",
      cropHeight: 360,
      cropWidth: 640,
      devicePixelRatio: 2,
      rect: { height: 500, left: 24, top: 12, width: 1_000 },
      renderScale: 2.7,
      sceneViewport: { height: 1_080, width: 2_160, x: 20, y: 135 },
      sceneViewportCss: { height: 400, width: 800, x: 100, y: 50 },
    }).error,
    "scene-viewport-coordinate-drift",
  );
});

test("forced route canvas validation is opt-in and keeps real WebGL available", () => {
  assert.match(
    source,
    /const AUTOPLAY_ROUTE_CANVAS_CAPTURE_TIMEOUT_MS = 1_500;/,
  );
  assert.match(source, /\{ timeoutMs: boundedTimeoutMs \+ 250 \}/);
  assert.match(
    source,
    /MANY_LIVES_BROWSER_TEST_FORCE_ROUTE_CANVAS_FALLBACK === "1"/,
  );
  assert.match(
    source,
    /AUTOPLAY_TEST_FORCE_ROUTE_CANVAS_FALLBACK[\s\S]*?"--enable-unsafe-swiftshader"[\s\S]*?"--use-angle=swiftshader"[\s\S]*?: \["--disable-gpu"\]/,
  );
  assert.match(
    source,
    /forced-route-canvas-validation\.json/,
  );
  assert.match(
    source,
    /Forced route canvas validation did not retain at least one independently validated default-framebuffer canvas position/,
  );
  assert.match(
    source,
    /autoplayRouteCanvasCommandSession\(\)[\s\S]*?session\.connect\(\{ navigate: false \}\)/,
  );
  assert.match(
    source,
    /async captureAutoplayRouteCanvasVisualFrame[\s\S]*?const commandSession = await this\.autoplayRouteCanvasCommandSession\(\);[\s\S]*?commandSession\.send\(\s*"Runtime\.evaluate"/,
  );
  assert.match(
    source,
    /async captureAutoplayRouteVisualFrame[\s\S]*?const response = await this\.send\(\s*"Page\.captureScreenshot"/,
  );
});

test("first-afternoon pacing enforces the app-monotonic duration window with sampling tolerance", () => {
  assert.match(
    source,
    /const AUTOPLAY_FIRST_AFTERNOON_MIN_DURATION_MS = 180_000;/,
  );
  assert.match(
    source,
    /const AUTOPLAY_FIRST_AFTERNOON_MAX_DURATION_MS = 300_000;/,
  );
  assert.match(
    source,
    /const AUTOPLAY_FIRST_AFTERNOON_DURATION_TOLERANCE_MS = 250;/,
  );
  assert.match(
    source,
    /firstAfternoonCompletedAppElapsedMs:/,
  );
  assert.match(
    pacingAssertionSource,
    /assertAutoplayFirstAfternoonDuration\(\s*ledger\.firstAfternoonCompletedAppElapsedMs,/,
  );
  assert.match(source, /assertAutoplayFirstAfternoonDurationGuard\(\);/);
  assert.match(
    source,
    /AUTOPLAY_FIRST_AFTERNOON_MIN_DURATION_MS -\s*AUTOPLAY_FIRST_AFTERNOON_DURATION_TOLERANCE_MS -\s*1/,
  );
  assert.match(
    source,
    /AUTOPLAY_FIRST_AFTERNOON_MAX_DURATION_MS \+\s*AUTOPLAY_FIRST_AFTERNOON_DURATION_TOLERANCE_MS \+\s*1/,
  );
});

test("first-afternoon pacing keeps the full route budget contract strict", () => {
  assert.match(
    source,
    /MANY_LIVES_BROWSER_AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS \?\? "15000"/,
  );
  assert.match(
    pacingAssertionSource,
    /ledger\.maxInAppGapMs <= AUTOPLAY_PACING_IDLE_GAP_TIMEOUT_MS/,
  );
  assert.match(
    pacingAssertionSource,
    /ledger\.minimumPlaybackCardDwellMs >=\s*AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS/,
  );
  assert.match(
    pacingAssertionSource,
    /assertAutoplayFirstAfternoonDuration\(\s*ledger\.firstAfternoonCompletedAppElapsedMs,/,
  );
});

test("first-afternoon runtime floor keeps real elapsed time across reloads", () => {
  assert.match(
    rowanPlaybackSource,
    /many-lives:street-first-afternoon-start:/,
  );
  assert.match(
    rowanPlaybackSource,
    /storage\.getItem\(storageKey\)/,
  );
  assert.match(
    streetRuntimeSource,
    /readOrCreateRowanWatchFirstAfternoonPresentationStart\([\s\S]*window\.sessionStorage,[\s\S]*Date\.now\(\)/,
  );
  assert.match(
    streetRuntimeSource,
    /const presentationElapsedMs =[\s\S]*rowanWatchFirstAfternoonPresentationElapsedMs\([\s\S]*Date\.now\(\)/,
  );
  assert.match(
    streetRuntimeSource,
    /autoContinueDelayMsForBeat\(game, \{\s*presentationElapsedMs,/,
  );
  assert.match(
    streetRuntimeSource,
    /reconcileAutoContinueBeatTiming\([\s\S]*intendedDelayMs,[\s\S]*timingNowMs/,
  );
  assert.doesNotMatch(
    streetRuntimeSource,
    /autoContinueDelayMsForBeat\(game, \{\s*beatStartedAtMs,/,
  );
  assert.match(
    rowanPlaybackSource,
    /rowanWatchDelayForFirstAfternoonFloor\([\s\S]*presentationElapsedMs: number \| undefined/,
  );
  assert.match(
    rowanPlaybackSource,
    /return \{\s*\.\.\.current,\s*intendedDelayMs,\s*\};/,
  );
  assert.doesNotMatch(
    rowanPlaybackSource,
    /intendedDelayMs < current\.intendedDelayMs[\s\S]*\? nowMs/,
  );
  assert.match(
    streetRuntimeSource,
    /restartOnDelayContraction:\s*game\.rowanAutonomy\?\.actionId === "reflect:first-afternoon"[\s\S]*presentationElapsedMs <[\s\S]*ROWAN_WATCH_FIRST_AFTERNOON_MIN_PRESENTATION_MS/,
  );
});

test("first-afternoon runtime catches up from state-derived pacing pressure", () => {
  assert.match(
    rowanPlaybackSource,
    /ROWAN_WATCH_FIRST_AFTERNOON_PACING_TARGET_MS = 270_000/,
  );
  assert.match(
    rowanPlaybackSource,
    /const progress = game\.player\.objective\?\.progress/,
  );
  assert.match(
    rowanPlaybackSource,
    /progressRatio \*[\s\S]*ROWAN_WATCH_FIRST_AFTERNOON_PACING_TARGET_MS/,
  );
  assert.match(
    rowanPlaybackSource,
    /ROWAN_WATCH_FIRST_AFTERNOON_MIN_SEMANTIC_DWELL_MS = 2_000/,
  );
  assert.match(
    rowanPlaybackSource,
    /beat\.kind === "thread_line"[\s\S]*\? readableDurationMs/,
  );
  assert.match(
    streetRuntimeSource,
    /minimumDelayMs =[\s\S]*estimateLiveConversationBeatMs\(game\) \+ 900/,
  );
  assert.match(
    streetRuntimeSource,
    /rowanWatchFirstAfternoonPacedDurationMs\([\s\S]*estimateDeferredPlayerMoveMs\([\s\S]*minimumDurationMs: 2_400/,
  );
  assert.doesNotMatch(
    rowanPlaybackSource,
    /noticed-pump|problem-pump.*PACING_TARGET/,
  );
});

test("autoplay observer budget preserves strict app-visible pacing evidence", () => {
  assert.match(
    source,
    /MANY_LIVES_BROWSER_AUTOPLAY_OBSERVATION_TIMEOUT_MS \?\? "600000"/,
  );
  assert.match(
    source,
    /AUTOPLAY_OBSERVATION_TIMEOUT_MS \+ 60_000/,
  );
  assert.match(
    source,
    /`autoplay-observation-\$\{openingWorldVariant\}`,\s*AUTOPLAY_OBSERVATION_PHASE_TIMEOUT_MS/,
  );
});

test("inhabit gameplay keeps enough bounded time for constrained CI runners", () => {
  assert.match(
    source,
    /MANY_LIVES_BROWSER_INHABIT_GAMEPLAY_TIMEOUT_MS \?\? "840000"/,
  );
  assert.match(
    source,
    /runBrowserPhase\(\s*"inhabit-gameplay",\s*INHABIT_GAMEPLAY_TIMEOUT_MS,/,
  );
});

test("opening map evidence is frozen before zero-click pacing begins", () => {
  const runStart = source.indexOf(
    "async function runAutoplayObservation(session, { game, openingWorldVariant })",
  );
  const runEnd = source.indexOf(
    "\nfunction assertAutoplayOpeningWorldTrajectoryEvidence(",
    runStart,
  );
  const runSource = source.slice(runStart, runEnd);
  const frozenCapture = runSource.indexOf(
    'captureFrozenMilestoneOnce("opening", openingProbe, openingDom)',
  );
  const pacingStart = runSource.indexOf("const pacingStartedAt = Date.now()");

  assert.ok(runStart >= 0 && runEnd > runStart);
  assert.match(runSource, /autoplayBrowserUrl\(game\.id, \{ frozen: true \}\)/);
  assert.match(source, /autoplay=\$\{frozen \? "0" : "1"\}/);
  assert.match(source, /frozen \? "&freezeAutoplay=1" : ""/);
  assert.match(runSource, /probe\.watchMode\?\.status !== "frozen"/);
  assert.match(runSource, /frozen opening evidence mutated the game clock/);
  assert.match(runSource, /frozen opening evidence moved Rowan/);
  assert.ok(
    frozenCapture >= 0 && frozenCapture < pacingStart,
    "Opening map evidence must be captured before the normal autoplay page starts its pacing clock.",
  );
});

test("proactive route history survives a delayed observer and rejects unproven windows", async () => {
  const policyStart = source.indexOf(
    "function isAutoplayFootholdRouteFrame(",
  );
  const policyEnd = source.indexOf(
    "\nasync function captureAutoplayFrozenTrajectoryMilestone(",
    policyStart,
  );
  const policySource = source.slice(policyStart, policyEnd);
  const recordedStart = source.indexOf(
    "function recordedRouteWindowBelongsToOpeningSegment(",
  );
  const recordedEnd = source.indexOf(
    "\nasync function waitForAutoplayRecordedRouteTrajectory(",
    recordedStart,
  );
  const framePolicyStart = source.indexOf(
    "function screencastFrameCapturedAtEpochMs(",
  );
  const framePolicyEnd = source.indexOf(
    "\nfunction isCdpRuntimeEvaluateTimeout(",
    framePolicyStart,
  );
  const framePolicy = Function(
    `${source.slice(framePolicyStart, framePolicyEnd)}; return { screencastFrameCapturedAtEpochMs, screencastFrameIsBracketedByEpochProbes };`,
  )();
  let routeHudContinuityChecks = 0;
  const routeCapture = Function(
    "assert",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "AUTOPLAY_ROUTE_OPENING_FRAME_MAX_PROGRESS",
    "AUTOPLAY_ROUTE_OPENING_FRAME_MIN_SETTLE_MS",
    "AUTOPLAY_ROUTE_SEGMENT_MAX_SAMPLE_GAP_MS",
    "AUTOPLAY_ROUTE_SEGMENT_PROGRESS_RESET_TOLERANCE",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "requireStableAutoplayScreenshotPaintProbe",
    "requireStableAutoplayRouteWindowPaintProbe",
    "assertAutoplayRouteHudContinuity",
    "assertStableAutoplayScreencastFramePair",
    "validateAutoplayRouteCanvasFrame",
    "assertAutoplayRouteCanvasFramePair",
    "autoplayRecordedRouteWindowFrame",
    `${policySource}\n${source.slice(recordedStart, recordedEnd)}; return { archiveAutoplayRouteCaptureFromPacingProbe, assertAutoplayFootholdRouteCaptureGuard, autoplayRecordedRouteWindowsHaveDistinctProgress, autoplayRouteCaptureWindowRetainsCompositingSettle, buildAutoplayFootholdRouteGuardFixture, buildAutoplayRouteCaptureSampleFromPacingProbe, buildAutoplayRouteCaptureSegments, selectAutoplayRecordedRouteTrajectory };`,
  )(
    assert,
    0.1,
    0.02,
    50,
    2_000,
    0.02,
    125,
    framePolicy.screencastFrameCapturedAtEpochMs,
    framePolicy.screencastFrameIsBracketedByEpochProbes,
    (_before, after) => after,
    (_before, after) => after,
    () => {
      routeHudContinuityChecks += 1;
      return { routeHudContinuityPixelDifferenceRatio: 0 };
    },
    () => ({ hudPixelDifferenceRatio: 0 }),
    ({ frame, paintProbe }) => ({
      buffer: Buffer.from(frame.data, "base64"),
      height: 360,
      paintProbe,
      routeCanvas: { geometry: frame.metadata.geometry },
      textPaint: {},
      width: 640,
    }),
    () => ({ routeCanvasChangedPixelRatio: 0.01 }),
    (recordedWindow) =>
      recordedWindow?.frame ?? recordedWindow?.confirmationFrame ?? null,
  );
  assert.doesNotThrow(() =>
    routeCapture.assertAutoplayFootholdRouteCaptureGuard(),
  );

  const fallbackSample =
    routeCapture.buildAutoplayRouteCaptureSampleFromPacingProbe({
      expectedTargetLocationId: "tea-house",
      paintProbe: {
        capturedAtEpochMs: 1_750_000_000_010,
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      },
      probe: {
        cdpRead: {
          capturedAtEpochMs: 1_750_000_000_000,
          capturedAtMonotonicMs: 100,
        },
        movement: {
          playerRoute: routeCapture.buildAutoplayFootholdRouteGuardFixture(0.3),
        },
      },
    });
  assert.equal(fallbackSample.source, "cdp-pacing-probe");
  assert.equal(fallbackSample.capturedAtEpochMs, 1_750_000_000_010);
  let archivedFallbackRecorder = null;
  const archivedFallbackSample =
    await routeCapture.archiveAutoplayRouteCaptureFromPacingProbe({
      expectedTargetLocationId: "tea-house",
      label: "page-recorder-loss-fixture",
      probe: {
        cdpRead: {
          capturedAtEpochMs: 1_750_000_000_000,
          capturedAtMonotonicMs: 100,
        },
        movement: {
          playerRoute: routeCapture.buildAutoplayFootholdRouteGuardFixture(0.3),
        },
      },
      session: {
        archiveAutoplayRouteFrames(recorder) {
          archivedFallbackRecorder = recorder;
        },
        async readScreenshotPaintProbe() {
          return fallbackSample.paintProbe;
        },
      },
    });
  assert.equal(archivedFallbackSample.source, "cdp-pacing-probe");
  assert.equal(archivedFallbackRecorder.expectedTargetLocationId, "tea-house");
  assert.equal(archivedFallbackRecorder.samples.length, 1);

  const capturedAtEpochMs = 1_750_000_000_000;
  const paintProbeForTime = (time) => ({
    regions: [
      { surface: "hud", text: "DAY 1" },
      { surface: "hud", text: time },
    ],
    stableRegions: [{ surface: "hud", text: `DAY 1 ${time}` }],
    viewport: { height: 625, width: 1365 },
  });
  const paintProbe = paintProbeForTime("11:05");
  const routeSample = (
    progress,
    offsetMs,
    overrides = {},
    samplePaintProbe = paintProbe,
  ) => ({
    capturedAtEpochMs: capturedAtEpochMs + offsetMs,
    capturedAtMonotonicMs: 100 + offsetMs,
    paintProbe: samplePaintProbe,
    recorderGeneration: 2,
    route: routeCapture.buildAutoplayFootholdRouteGuardFixture(
      progress,
      overrides,
    ),
    source: "movement-probe-recorder",
  });
  const sharedAfterProbe = routeSample(0.386, 2_095);
  assert.equal(
    routeCapture.autoplayRecordedRouteWindowsHaveDistinctProgress(
      {
        afterProbe: sharedAfterProbe,
        beforeProbe: routeSample(0.003, 0),
        frame: { capturedAtEpochMs: capturedAtEpochMs + 1_052 },
      },
      {
        afterProbe: sharedAfterProbe,
        beforeProbe: routeSample(0.003, 1_027),
        frame: { capturedAtEpochMs: capturedAtEpochMs + 2_084 },
      },
    ),
    true,
    "Distinct rendered positions must remain valid when CI brackets both frames with one shared after-probe.",
  );
  const sparseOpeningSamples = [
    routeSample(0.003, 0),
    routeSample(0.15, 1_000),
    routeSample(0.35, 3_000),
    routeSample(0.657, 5_000),
  ];
  const sparseOpeningFrames = [
    {
      data: "sparse-opening-start",
      metadata: { timestamp: (capturedAtEpochMs + 72) / 1_000 },
      sequence: 8,
    },
    {
      data: "sparse-opening-mid",
      metadata: { timestamp: (capturedAtEpochMs + 3_276) / 1_000 },
      sequence: 9,
    },
  ];
  const sparseOpeningTrajectory =
    routeCapture.selectAutoplayRecordedRouteTrajectory({
      expectedTargetLocationId: "tea-house",
      frames: sparseOpeningFrames,
      label: "sparse constrained-runner opening frames",
      samples: sparseOpeningSamples,
      validateFrame: ({ frame, paintProbe: acceptedPaintProbe }) => ({
        buffer: Buffer.from(frame.data),
        height: 625,
        paintProbe: acceptedPaintProbe,
        textPaint: {},
        width: 1365,
      }),
      validateStableFramePair: () => ({}),
    });
  assert.equal(sparseOpeningTrajectory.start.frame.sequence, 8);
  assert.equal(sparseOpeningTrajectory.mid.frame.sequence, 9);
  assert.equal(
    sparseOpeningTrajectory.start.validated.textPaint.openingFrameGraceMs,
    72,
  );
  const sparseOpeningEvidenceWindow = {
    before: {
      capturedAtEpochMs,
      progress: 0.003,
    },
    frame: {
      capturedAtEpochMs: capturedAtEpochMs + 72,
    },
    textPaint: {
      openingFrameGraceMinimumMs: 50,
      openingFrameGraceMs: 72,
    },
  };
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      sparseOpeningEvidenceWindow,
      { allowOpeningFrameGrace: true },
    ),
    true,
    "The final evidence invariant must accept the same bounded opening grace as candidate selection.",
  );
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      sparseOpeningEvidenceWindow,
    ),
    false,
    "Only route-start evidence may use the bounded opening grace.",
  );
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      {
        ...sparseOpeningEvidenceWindow,
        before: {
          ...sparseOpeningEvidenceWindow.before,
          progress: 0.03,
        },
      },
      { allowOpeningFrameGrace: true },
    ),
    false,
    "Opening grace must remain limited to a near-zero legal route position.",
  );
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      {
        ...sparseOpeningEvidenceWindow,
        frame: {
          capturedAtEpochMs: capturedAtEpochMs + 42,
        },
        textPaint: {
          ...sparseOpeningEvidenceWindow.textPaint,
          openingFrameGraceMs: 42,
        },
      },
      { allowOpeningFrameGrace: true },
    ),
    false,
    "Opening grace must still retain at least three render frames of compositing settle.",
  );
  assert.throws(
    () =>
      routeCapture.selectAutoplayRecordedRouteTrajectory({
        expectedTargetLocationId: "tea-house",
        frames: [
          {
            ...sparseOpeningFrames[0],
            metadata: { timestamp: (capturedAtEpochMs + 42) / 1_000 },
          },
          sparseOpeningFrames[1],
        ],
        label: "unsettled sparse opening frame",
        samples: sparseOpeningSamples,
        validateFrame: ({ frame, paintProbe: acceptedPaintProbe }) => ({
          buffer: Buffer.from(frame.data),
          height: 625,
          paintProbe: acceptedPaintProbe,
          textPaint: {},
          width: 1365,
        }),
        validateStableFramePair: () => ({}),
      }),
    /did not contain two distinct legal rendered positions/,
  );
  const constrainedRunnerOpeningAtEpochMs = 1_785_425_623_361;
  const constrainedRunnerSample = (progress, sampleAtEpochMs) => ({
    ...routeSample(progress, 0),
    capturedAtEpochMs: sampleAtEpochMs,
    capturedAtMonotonicMs:
      sampleAtEpochMs - constrainedRunnerOpeningAtEpochMs,
  });
  const routeHudContinuityChecksBeforeConstrainedRunner =
    routeHudContinuityChecks;
  const constrainedRunnerArchivedTrajectory =
    routeCapture.selectAutoplayRecordedRouteTrajectory({
      archivedFrames: [
        {
          data: "ci-archived-opening-route-start",
          metadata: { timestamp: 1_785_425_623.412167 },
          sequence: 702,
        },
        {
          data: "ci-archived-opening-route-mid",
          metadata: { timestamp: 1_785_425_625.747765 },
          sequence: 704,
        },
      ],
      expectedTargetLocationId: "tea-house",
      frames: [],
      label: "exact constrained-runner archived opening frames",
      samples: [
        constrainedRunnerSample(0.006, constrainedRunnerOpeningAtEpochMs),
        constrainedRunnerSample(0.3, 1_785_425_624_861),
        constrainedRunnerSample(0.48, 1_785_425_625_561),
        constrainedRunnerSample(0.535, 1_785_425_625_722),
        constrainedRunnerSample(0.56, 1_785_425_625_800),
      ],
      validateFrame: ({ frame, paintProbe: acceptedPaintProbe }) => ({
        buffer: Buffer.from(frame.data),
        height: 625,
        paintProbe: acceptedPaintProbe,
        textPaint: {},
        width: 1365,
      }),
      validateStableFramePair: () => ({}),
    });
  const constrainedRunnerWindow = (capture) => ({
    before: {
      capturedAtEpochMs: capture.beforeProbe.capturedAtEpochMs,
      progress: capture.beforeProbe.route.progress,
    },
    frame: {
      capturedAtEpochMs:
        framePolicy.screencastFrameCapturedAtEpochMs(capture.frame),
    },
    textPaint: capture.validated.textPaint,
  });
  assert.equal(constrainedRunnerArchivedTrajectory.start.frame.sequence, 702);
  assert.ok(
    Math.abs(
      constrainedRunnerArchivedTrajectory.start.validated.textPaint
        .openingFrameGraceMs - 51.167,
    ) < 0.001,
  );
  assert.equal(
    constrainedRunnerArchivedTrajectory.start.validated.textPaint
      .openingFrameGraceMinimumMs,
    50,
  );
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      constrainedRunnerWindow(constrainedRunnerArchivedTrajectory.start),
      { allowOpeningFrameGrace: true },
    ),
    true,
    "Archived route-start promotion must retain the same bounded opening grace accepted during candidate selection.",
  );
  assert.equal(constrainedRunnerArchivedTrajectory.mid.frame.sequence, 704);
  assert.equal(
    constrainedRunnerArchivedTrajectory.mid.beforeProbe.route.progress,
    0.48,
  );
  assert.equal(
    constrainedRunnerArchivedTrajectory.mid.validated.textPaint
      .openingFrameGraceMs,
    undefined,
  );
  assert.equal(
    routeCapture.autoplayRouteCaptureWindowRetainsCompositingSettle(
      constrainedRunnerWindow(constrainedRunnerArchivedTrajectory.mid),
    ),
    true,
    "A non-opening archived frame must retain the full compositing settle interval.",
  );
  assert.equal(
    routeHudContinuityChecks,
    routeHudContinuityChecksBeforeConstrainedRunner + 1,
  );
  routeHudContinuityChecks =
    routeHudContinuityChecksBeforeConstrainedRunner;
  const completedRouteOpeningAtEpochMs = 1_785_434_896_125;
  const completedRoutePaintProbe = (text) => ({
    regions: [{ surface: "hud", text }],
    stableRegions: [{ surface: "hud", text }],
    viewport: { height: 625, width: 1365 },
  });
  const completedRouteSample = (
    progress,
    sampleAtEpochMs,
    hudText = "DAY 1 11:05 LATE MORNING $12 70 ENERGY 2/4 OUTCOMES MET",
    routeOverrides = {},
  ) => ({
    ...routeSample(
      progress,
      0,
      routeOverrides,
      completedRoutePaintProbe(hudText),
    ),
    capturedAtEpochMs: sampleAtEpochMs,
    capturedAtMonotonicMs:
      sampleAtEpochMs - completedRouteOpeningAtEpochMs,
  });
  const completedRouteSamples = [
    completedRouteSample(0.006, completedRouteOpeningAtEpochMs),
    completedRouteSample(0.15, 1_785_434_897_000),
    completedRouteSample(0.35, 1_785_434_898_300),
    completedRouteSample(0.4, 1_785_434_898_412),
    completedRouteSample(
      0.65,
      1_785_434_899_600,
      "DAY 1 11:23 LATE MORNING $12 46 ENERGY 2/4 OUTCOMES MET",
    ),
    completedRouteSample(
      0.77,
      1_785_434_899_972,
      "DAY 1 11:23 LATE MORNING $12 46 ENERGY 2/4 OUTCOMES MET",
    ),
  ];
  const completedRouteArchivedFrames = [
    {
      data: "ci-completed-opening-route-start",
      metadata: { timestamp: 1_785_434_898.445189 },
      sequence: 726,
    },
    {
      data: "ci-completed-opening-route-mid",
      metadata: { timestamp: 1_785_434_899.960604 },
      sequence: 730,
    },
  ];
  const completedRouteValidateFrame = ({
    frame,
    paintProbe: acceptedPaintProbe,
  }) => {
    assert.equal(
      typeof frame.data,
      "string",
      "Archived route evidence must contain rendered frame pixels.",
    );
    return {
      buffer: Buffer.from(frame.data),
      height: 625,
      paintProbe: acceptedPaintProbe,
      textPaint: {},
      width: 1365,
    };
  };
  const completedRouteArchivedTrajectory =
    routeCapture.selectAutoplayRecordedRouteTrajectory({
      archivedFrames: completedRouteArchivedFrames,
      expectedTargetLocationId: "tea-house",
      frames: completedRouteArchivedFrames,
      label: "exact completed-route archived opening frames",
      samples: completedRouteSamples,
      validateFrame: completedRouteValidateFrame,
      validateStableFramePair: () => ({}),
    });
  assert.equal(completedRouteArchivedTrajectory.start.frame.sequence, 726);
  assert.equal(completedRouteArchivedTrajectory.mid.frame.sequence, 730);
  assert.ok(
    completedRouteArchivedTrajectory.mid.beforeProbe.route.progress -
      completedRouteArchivedTrajectory.start.afterProbe.route.progress >=
      0.1,
  );
  assert.equal(
    completedRouteArchivedTrajectory.start.validated.textPaint
      .routeHudContinuityBasis,
    "exact-route-identity-and-per-frame-hud-paint",
  );
  assert.equal(
    completedRouteArchivedTrajectory.mid.validated.textPaint
      .routeHudContinuityBasis,
    "exact-route-identity-and-per-frame-hud-paint",
  );
  for (const [fixtureLabel, archivedFrames] of [
    ["one archived frame", completedRouteArchivedFrames.slice(0, 1)],
    [
      "stale and after-arrival archived frames",
      [
        {
          data: "stale-opening-route-frame",
          metadata: { timestamp: 1_785_434_895.9 },
          sequence: 724,
        },
        {
          data: "after-arrival-opening-route-frame",
          metadata: { timestamp: 1_785_434_900.2 },
          sequence: 732,
        },
      ],
    ],
  ]) {
    assert.throws(
      () =>
        routeCapture.selectAutoplayRecordedRouteTrajectory({
          archivedFrames,
          expectedTargetLocationId: "tea-house",
          frames: [],
          label: fixtureLabel,
          samples: completedRouteSamples,
          validateFrame: completedRouteValidateFrame,
          validateStableFramePair: () => ({}),
        }),
      /did not contain two distinct legal rendered positions/,
    );
  }
  assert.throws(
    () =>
      routeCapture.selectAutoplayRecordedRouteTrajectory({
        archivedFrames: [
          completedRouteArchivedFrames[0],
          {
            ...completedRouteArchivedFrames[1],
            data: undefined,
          },
        ],
        expectedTargetLocationId: "tea-house",
        frames: [],
        label: "missing archived route pixels",
        samples: completedRouteSamples,
        validateFrame: completedRouteValidateFrame,
        validateStableFramePair: () => ({}),
      }),
    /Archived route evidence must contain rendered frame pixels/,
  );
  assert.throws(
    () =>
      routeCapture.selectAutoplayRecordedRouteTrajectory({
        archivedFrames: completedRouteArchivedFrames,
        expectedTargetLocationId: "tea-house",
        frames: [],
        label: "changed archived route identity",
        samples: completedRouteSamples.map((sample, index) =>
          index < 4
            ? sample
            : {
                ...sample,
                route: {
                  ...sample.route,
                  targetLocationId: "repair-stall",
                },
              },
        ),
        validateFrame: completedRouteValidateFrame,
        validateStableFramePair: () => ({}),
      }),
    /did not contain two distinct legal rendered positions/,
  );
  const screencastFrame = (sequence, offsetMs) => ({
    data: `active-route-png-${sequence}`,
    metadata: { timestamp: (capturedAtEpochMs + offsetMs) / 1_000 },
    sequence,
  });
  const frames = [
    screencastFrame(10, 150),
    screencastFrame(11, 280),
    screencastFrame(12, 550),
    screencastFrame(13, 680),
  ];
  const samples = [
    routeSample(0.02, 0),
    routeSample(0.04, 100),
    routeSample(0.08, 200),
    routeSample(0.12, 300),
    routeSample(0.25, 400),
    routeSample(0.32, 500),
    routeSample(0.4, 600),
    routeSample(0.48, 700),
  ];
  const validateFrame = ({ frame, paintProbe: acceptedPaintProbe }) => ({
    buffer: Buffer.from(frame.data),
    height: 625,
    paintProbe: acceptedPaintProbe,
    textPaint: { regionCount: 9, surfaces: ["hud"] },
    width: 1365,
  });
  const delayedCurrentObserverProbe = null;
  const expiredGenericFrames = [
    screencastFrame(100, 30_000),
    screencastFrame(101, 30_130),
    screencastFrame(102, 30_260),
    screencastFrame(103, 30_390),
  ];
  const laterPaintProbe = paintProbeForTime("12:21");
  const laterSamples = [
    routeSample(0.02, 29_800, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.05, 29_900, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.08, 30_000, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.12, 30_100, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.25, 30_200, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.32, 30_300, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.4, 30_400, { tilePathLength: 4 }, laterPaintProbe),
    routeSample(0.48, 30_500, { tilePathLength: 4 }, laterPaintProbe),
  ];
  const mixedSamples = [...samples, ...laterSamples];
  const segments = routeCapture.buildAutoplayRouteCaptureSegments({
    expectedTargetLocationId: "tea-house",
    samples: mixedSamples,
  });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].samples.length, samples.length);
  assert.equal(segments[1].samples.length, laterSamples.length);
  assert.ok(segments[1].boundaryReasons.includes("sample-gap"));
  assert.ok(segments[1].boundaryReasons.includes("progress-reset"));
  assert.ok(segments[1].boundaryReasons.includes("path-change"));
  assert.ok(!segments[1].boundaryReasons.includes("hud-change"));
  assert.equal(
    routeCapture.buildAutoplayRouteCaptureSegments({
      expectedTargetLocationId: "tea-house",
      samples: [
        routeSample(0.48, 700),
        routeSample(0.62, 900, {}, laterPaintProbe),
      ],
    }).length,
    1,
    "A legitimate in-route HUD update must not split one unchanged legal path.",
  );
  assert.throws(
    () =>
      routeCapture.selectAutoplayRecordedRouteTrajectory({
        expectedTargetLocationId: "tea-house",
        frames: expiredGenericFrames,
        label: "expired generic ring fixture",
        samples: mixedSamples,
        validateFrame,
        validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
      }),
    /opening route evidence did not contain two distinct legal rendered positions/,
  );
  assert.throws(
    () =>
      routeCapture.selectAutoplayRecordedRouteTrajectory({
        expectedTargetLocationId: "tea-house",
        frames: [
          frames[0],
          frames[1],
          expiredGenericFrames[0],
          expiredGenericFrames[1],
        ],
        label: "cross-segment pairing fixture",
        samples: mixedSamples,
        validateFrame,
        validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
      }),
    /opening route evidence did not contain two distinct legal rendered positions/,
  );
  const trajectory = routeCapture.selectAutoplayRecordedRouteTrajectory({
    expectedTargetLocationId: "tea-house",
    frames: [...frames, ...expiredGenericFrames],
    label: "delayed hosted observer fixture",
    samples: mixedSamples,
    validateFrame,
    validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
  });

  assert.equal(delayedCurrentObserverProbe, null);
  assert.equal(trajectory.start.frame.sequence, 10);
  assert.equal(trajectory.mid.frame.sequence, 12);
  assert.equal(trajectory.start.beforeProbe.source, "movement-probe-recorder");
  assert.equal(trajectory.mid.afterProbe.source, "movement-probe-recorder");
  assert.ok(
    trajectory.mid.beforeProbe.route.progress -
      trajectory.start.afterProbe.route.progress >=
      0.1,
  );
  assert.ok(
    framePolicy.screencastFrameCapturedAtEpochMs(
      trajectory.start.frame,
    ) - trajectory.start.beforeProbe.capturedAtEpochMs >= 125,
  );
  assert.ok(
    framePolicy.screencastFrameCapturedAtEpochMs(trajectory.mid.frame) <=
      trajectory.mid.afterProbe.capturedAtEpochMs,
  );
  assert.equal(routeHudContinuityChecks, 2);

  for (const [label, rejectedSamples] of [
    ["absent", []],
    [
      "stale fallback",
      samples.map((sample) => ({
        ...sample,
        source: "browser-probe-fallback",
      })),
    ],
    [
      "target mismatch",
      samples.map((sample) => ({
        ...sample,
        route: { ...sample.route, targetLocationId: "repair-stall" },
      })),
    ],
    [
      "arrival",
      samples.map((sample) => ({
        ...sample,
        route: { ...sample.route, active: false, progress: 1 },
      })),
    ],
  ]) {
    assert.throws(
      () =>
        routeCapture.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames,
          label,
          samples: rejectedSamples,
          validateFrame,
          validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
        }),
      /opening route evidence did not contain two distinct legal rendered positions/,
    );
  }

  const captureStart = source.indexOf(
    "async function captureAutoplayRouteScreenshotWindow(",
  );
  const captureEnd = source.indexOf(
    "\nasync function runAutoplayObservation(",
    captureStart,
  );
  const captureSource = source.slice(captureStart, captureEnd);
  const recordedSource = source.slice(recordedStart, recordedEnd);
  const proactiveCaptureSource = source.slice(
    source.indexOf(
      "async function captureAutoplayRouteVisualFrameWithFallback(",
    ),
    recordedStart,
  );
  const runStart = source.indexOf(
    "async function runAutoplayObservation(session, { game, openingWorldVariant })",
  );
  const runEnd = source.indexOf(
    "\nfunction assertAutoplayOpeningWorldTrajectoryEvidence(",
    runStart,
  );
  const runSource = source.slice(runStart, runEnd);
  const recorderStartIndex = runSource.indexOf(
    "await session.startAutoplayRouteCaptureRecorder(",
  );
  const visualRecorderStartIndex = runSource.indexOf(
    "session.startAutoplayRouteVisualWindowRecorder(",
  );
  const denseRoutePrearmIndex = runSource.indexOf(
    "await session.rearmAutoplayScreencastForRouteCapture(",
  );
  const normalNavigationIndex = runSource.indexOf(
    "await session.navigate(url);",
  );
  const observationWaitIndex = runSource.indexOf(
    "const completion = await waitFor(",
  );

  assert.ok(
    recordedStart >= 0 &&
      recordedEnd > recordedStart &&
      captureStart >= 0 &&
      captureEnd > captureStart,
  );
  assert.doesNotMatch(
    recordedSource,
    /captureScreenshot|Page\.captureScreenshot/,
    "Proactive route evidence must not await the blocking screenshot command.",
  );
  assert.match(source, /decodePngPixels\(buffer\)/);
  assert.match(
    captureSource,
    /writeFile\(screenshot, captureWindow\.validated\.buffer\)/,
  );
  assert.match(source, /Page\.startScreencast/);
  assert.match(source, /source: "in-page-route-canvas"/);
  assert.match(
    source,
    /async captureAutoplayRouteVisualFrame[\s\S]*Page\.captureScreenshot/,
  );
  assert.match(source, /gl\.readPixels\(/);
  assert.doesNotMatch(source, /\.toBlob\(/);
  assert.doesNotMatch(source, /\.toDataURL\(/);
  assert.match(source, /browserPayloadFormat: "rgba-base64"/);
  assert.match(source, /rawRowOrientation: "bottom-up"/);
  assert.match(source, /requestAnimationFrame\(resolve\)/);
  assert.match(source, /Page\.screencastFrameAck/);
  assert.match(source, /Page\.stopScreencast/);
  assert.match(
    source,
    /await session\.startAutoplayScreencast\(\);\s+autoplayScreencastStarted = true;/,
  );
  assert.match(
    source,
    /if \(autoplayScreencastStarted\) \{\s+await session\.stopAutoplayScreencast\(\)/,
  );
  assert.doesNotMatch(source, /Page\.setWebLifecycleState/);
  assert.doesNotMatch(source, /Emulation\.setVirtualTimePolicy/);
  assert.ok(
    recorderStartIndex >= 0 && recorderStartIndex < observationWaitIndex,
    "The in-page route recorder must start before the delayed Node observer loop.",
  );
  assert.ok(
    visualRecorderStartIndex >= 0 &&
      visualRecorderStartIndex < normalNavigationIndex,
    "The proactive visual recorder must be watching before autoplay navigation can begin the opening route.",
  );
  assert.ok(
    denseRoutePrearmIndex > visualRecorderStartIndex &&
      denseRoutePrearmIndex < normalNavigationIndex,
    "Dense route screencast cadence must be ready before navigation can begin the opening route.",
  );
  assert.match(
    proactiveCaptureSource,
    /return await session\.captureAutoplayRouteCanvasVisualFrame\(\{/,
    "The bounded fallback must begin with the in-page route canvas while screencast stays active.",
  );
  assert.match(
    proactiveCaptureSource,
    /session\.forceRouteCanvasFallback \|\|\s*!isRetryableAutoplayRouteCanvasCaptureError\(error\)[\s\S]*throw error;/,
    "Forced canvas mode and non-transport failures must remain fail-closed.",
  );
  assert.match(
    proactiveCaptureSource,
    /captureAutoplayRouteScreenshotVisualFrame\(\{/,
    "Only a retryable canvas transport failure may use the bracketed screenshot recovery.",
  );
  assert.match(
    proactiveCaptureSource,
    /const captured = await captureAutoplayRouteVisualFrameWithFallback\(\{/,
    "The proactive route position must retain the strict canvas-first recovery helper.",
  );
  assert.equal(
    (proactiveCaptureSource.match(/captureAutoplayRouteCanvasVisualFrame\(/g) ?? [])
      .length,
    1,
    "Each fallback route position must consume one bounded canvas readback.",
  );
  assert.doesNotMatch(proactiveCaptureSource, /Page\.captureScreenshot/);
  assert.doesNotMatch(
    proactiveCaptureSource,
    /withAutoplayScreencastPausedForRouteCapture/,
  );
  assert.match(runSource, /selectAutoplayRecordedRouteTrajectory\(/);
  assert.match(runSource, /startAutoplayRouteVisualWindowRecorder\(/);
  assert.match(runSource, /readOrRearmAutoplayRouteCaptureRecorder\(/);
  assert.match(source, /execution-context-recorder-missing/);
  assert.match(source, /routeRecorderRestarts/);
  for (const sampleStatus of [
    "probe-unavailable",
    "parse-error",
    "route-rejected",
    "route-unavailable",
    "accepted",
  ]) {
    assert.match(
      source,
      new RegExp(`lastSampleStatus[\\s\\S]{0,120}"${sampleStatus}"`),
      `The route recorder must distinguish ${sampleStatus} samples in diagnostics.`,
    );
  }
  assert.match(
    runSource,
    /archiveAutoplayRouteFrames\(recorder\);\s+const trajectory = selectAutoplayRecordedRouteTrajectory[\s\S]*acceptAutoplayRouteRenderedFrameTrajectory\(trajectory\);\s+return trajectory;/,
    "Validated screencast evidence must supersede the screenshot fallback only after trajectory selection succeeds.",
  );
  assert.doesNotMatch(runSource, /route\?\.active\s*&&[\s\S]*waitForAutoplayRecordedRouteTrajectory/);
  assert.doesNotMatch(
    captureSource,
    /readAutoplayDomAudit|readCameraProbe|readMapAgencyProbe/,
    "Route capture must return to phase sampling without blocking auxiliary reads.",
  );
  assert.match(captureSource, /routeCaptureWindow:/);
  assert.match(
    captureSource,
    /capturedAtEpochMs: afterCapturedAtEpochMs/,
    "Route evidence must retain its after-probe wall-clock timestamp.",
  );
  assert.match(
    captureSource,
    /capturedAtEpochMs: beforeCapturedAtEpochMs/,
    "Route evidence must retain its before-probe wall-clock timestamp.",
  );
  assert.match(
    source,
    /autoplayRecordedRouteWindowsHaveDistinctProgress\(\s*routeStartWindow,\s*routeMidWindow/,
  );
  assert.match(source, /routeMidWindow\.frame\.sequence > routeStartWindow\.frame\.sequence/);
  assert.match(source, /probeSource[\s\S]*movement-probe-recorder/);
  const routeProbeMethodStart = source.indexOf("  async readAutoplayRouteProbe(");
  const routeProbeMethodEnd = source.indexOf(
    "\n  async readAutoplayDomAudit(",
    routeProbeMethodStart,
  );
  const routeProbeMethod = source.slice(
    routeProbeMethodStart,
    routeProbeMethodEnd,
  );
  assert.match(routeProbeMethod, /#ml-browser-movement-probe/);
  assert.doesNotMatch(routeProbeMethod, /#ml-browser-probe|fallback/);
  assert.match(source, /assertAutoplayFootholdRouteCaptureGuard\(\);/);
});

test("live frame acquisition retries HUD drift and transient unavailable probes", async () => {
  const framePolicyStart = source.indexOf(
    "function screencastFrameCapturedAtEpochMs(",
  );
  const framePolicyEnd = source.indexOf(
    "\nfunction isCdpRuntimeEvaluateTimeout(",
    framePolicyStart,
  );
  const framePolicy = Function(
    `${source.slice(framePolicyStart, framePolicyEnd)}; return { cdpProbeCapturedAtEpochMs, screencastFrameCapturedAtEpochMs, screencastFrameIsBracketedByEpochProbes };`,
  )();
  const paintPolicyStart = source.indexOf(
    "function maximumRectGeometryDelta(",
  );
  const paintPolicyEnd = source.indexOf(
    "\nfunction shouldValidateGameplayScreenshotPaint(",
    paintPolicyStart,
  );
  const paintPolicy = Function(
    "assert",
    "AUTOPLAY_SCREENCAST_TEXT_GEOMETRY_TOLERANCE_CSS_PX",
    `${source.slice(paintPolicyStart, paintPolicyEnd)}; return { requireStableAutoplayRouteWindowPaintProbe, requireStableAutoplayScreenshotPaintProbe };`,
  )(assert, 0.75);
  const cleanHudPixels = Buffer.alloc(100 * 50 * 3, 18);
  const fillHudRect = (pixels, { bottom, left, right, top }, value) => {
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * 100 + x) * 3;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
      }
    }
  };
  fillHudRect(cleanHudPixels, { bottom: 9, left: 12, right: 29, top: 2 }, 54);
  fillHudRect(cleanHudPixels, { bottom: 9, left: 32, right: 39, top: 2 }, 42);
  fillHudRect(cleanHudPixels, { bottom: 9, left: 42, right: 53, top: 2 }, 38);
  const movingMapCleanHudPixels = Buffer.from(cleanHudPixels);
  fillHudRect(
    movingMapCleanHudPixels,
    { bottom: 50, left: 0, right: 100, top: 14 },
    96,
  );
  const misassignedMoneyHudPixels = Buffer.from(movingMapCleanHudPixels);
  fillHudRect(
    misassignedMoneyHudPixels,
    { bottom: 9, left: 29, right: 39, top: 2 },
    54,
  );
  const decodedFramePixels = new Map([
    ["route-start-reference", cleanHudPixels],
    ["partial", misassignedMoneyHudPixels],
    ["partial-immediate", misassignedMoneyHudPixels],
    ["partial-late", misassignedMoneyHudPixels],
    ["clean", movingMapCleanHudPixels],
    ["clean-immediate", movingMapCleanHudPixels],
    ["clean-confirmation", movingMapCleanHudPixels],
  ]);
  const pixelPolicyStart = source.indexOf(
    "function screenshotRegionPixelDifferenceRatio(",
  );
  const pixelPolicyEnd = source.indexOf(
    "\nfunction shouldValidateGameplayScreenshotPaint(",
    pixelPolicyStart,
  );
  const pixelPolicy = Function(
    "assert",
    "decodePngPixels",
    "AUTOPLAY_ROUTE_HUD_CONTINUITY_MAX_PIXEL_DIFFERENCE_RATIO",
    "AUTOPLAY_SCREENCAST_TEXT_GEOMETRY_TOLERANCE_CSS_PX",
    `${source.slice(pixelPolicyStart, pixelPolicyEnd)}; return { assertAutoplayRouteHudContinuity, assertStableAutoplayScreencastFramePair };`,
  )(
    assert,
    (buffer) => ({
      channels: 3,
      height: 50,
      pixels: decodedFramePixels.get(buffer.toString()),
      width: 100,
    }),
    0.006,
    0.75,
  );
  const genericCaptureStart = source.indexOf(
    "async function acquireAutoplayScreencastFrameWindow(",
  );
  const genericCaptureEnd = source.indexOf(
    "\nfunction autoplayLiveMilestoneMatches(",
    genericCaptureStart,
  );
  const acquireFrame = Function(
    "assert",
    "AUTOPLAY_SCREENCAST_CAPTURE_ATTEMPTS",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "cdpProbeCapturedAtEpochMs",
    "requireStableAutoplayScreenshotPaintProbe",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "sleep",
    "slug",
    "validateAutoplayScreencastFrame",
    "assertStableAutoplayScreencastFramePair",
    `${source.slice(genericCaptureStart, genericCaptureEnd)}; return acquireAutoplayScreencastFrameWindow;`,
  )(
    assert,
    4,
    125,
    framePolicy.cdpProbeCapturedAtEpochMs,
    paintPolicy.requireStableAutoplayScreenshotPaintProbe,
    framePolicy.screencastFrameCapturedAtEpochMs,
    framePolicy.screencastFrameIsBracketedByEpochProbes,
    async () => {},
    (value) => value,
    () => null,
    () => null,
  );
  const epoch = 1_750_000_000_000;
  const probe = (offsetMs, state = "conversation") => ({
    capturedAtEpochMs: epoch + offsetMs,
    state,
  });
  const frames = [
    {
      data: "partial",
      metadata: { timestamp: (epoch + 140) / 1_000 },
      sequence: 1,
    },
    {
      data: "partial-immediate",
      metadata: { timestamp: (epoch + 150) / 1_000 },
      sequence: 2,
    },
    {
      data: "partial-late",
      metadata: { timestamp: (epoch + 280) / 1_000 },
      sequence: 3,
    },
    {
      data: "clean",
      metadata: { timestamp: (epoch + 440) / 1_000 },
      sequence: 4,
    },
    {
      data: "clean-immediate",
      metadata: { timestamp: (epoch + 450) / 1_000 },
      sequence: 5,
    },
    {
      data: "clean-confirmation",
      metadata: { timestamp: (epoch + 580) / 1_000 },
      sequence: 6,
    },
  ];
  const probes = [probe(10), probe(300), probe(310), probe(600)];
  const textRegion = (surface, text, left, right) => ({
    rect: { bottom: 48, left, right, top: 28 },
    surface,
    text,
  });
  const paintProbe = () => ({
    regions: [
      textRegion("hud", "DAY 1", 2, 8),
      textRegion("hud", "11:05", 10, 20),
      textRegion("hud", "LATE MORNING", 21, 30),
      textRegion("hud", "MONEY", 32, 38),
      textRegion("hud", "$12", 40, 45),
      textRegion("hud", "70 ENERGY", 47, 58),
      textRegion("dock", "WORLD", 2, 8),
      textRegion("rail", "Rowan", 70, 85),
    ],
    stableRegions: [
      {
        rect: { bottom: 10, left: 2, right: 10, top: 1 },
        surface: "hud",
        text: "DAY 1",
      },
      {
        rect: { bottom: 10, left: 10, right: 30, top: 1 },
        surface: "hud",
        text: "11:05 LATE MORNING",
      },
      {
        rect: { bottom: 10, left: 32, right: 39, top: 1 },
        surface: "hud",
        text: "$12",
      },
      {
        rect: { bottom: 10, left: 42, right: 53, top: 1 },
        surface: "hud",
        text: "70 ENERGY",
      },
    ],
    viewport: { height: 50, width: 100 },
  });
  const shiftedGeometryProbe = paintProbe();
  shiftedGeometryProbe.regions[4] = textRegion("hud", "$12", 34, 39);
  assert.throws(
    () =>
      paintPolicy.requireStableAutoplayScreenshotPaintProbe(
        paintProbe(),
        shiftedGeometryProbe,
        "shifted money chip fixture",
      ),
    /text geometry drifted/,
  );
  const changedHudProbe = paintProbe();
  changedHudProbe.regions[1] = textRegion("hud", "11:23", 10, 20);
  changedHudProbe.regions[5] = textRegion("hud", "46 ENERGY", 47, 58);
  changedHudProbe.stableRegions[1] = {
    ...changedHudProbe.stableRegions[1],
    text: "11:23 LATE MORNING",
  };
  changedHudProbe.stableRegions[3] = {
    ...changedHudProbe.stableRegions[3],
    text: "46 ENERGY",
  };
  const changedHudPaint =
    paintPolicy.requireStableAutoplayRouteWindowPaintProbe(
      paintProbe(),
      changedHudProbe,
      "moving route HUD fixture",
    );
  assert.ok(
    changedHudPaint.regions.some((region) => region.text === "11:23"),
  );
  const changedRailProbe = paintProbe();
  changedRailProbe.regions[7] = textRegion("rail", "Someone else", 70, 85);
  assert.throws(
    () =>
      paintPolicy.requireStableAutoplayRouteWindowPaintProbe(
        paintProbe(),
        changedRailProbe,
        "changed rail fixture",
      ),
    /non-HUD visible text content changed/,
  );
  const shiftedHudContainerProbe = paintProbe();
  shiftedHudContainerProbe.stableRegions[1] = {
    ...shiftedHudContainerProbe.stableRegions[1],
    rect: { bottom: 10, left: 12, right: 32, top: 1 },
  };
  assert.throws(
    () =>
      paintPolicy.requireStableAutoplayRouteWindowPaintProbe(
        paintProbe(),
        shiftedHudContainerProbe,
        "shifted HUD container fixture",
      ),
    /HUD container geometry drifted/,
  );
  const paintProbes = [
    paintProbe(),
    paintProbe(),
    paintProbe(),
    paintProbe(),
  ];
  const routeStartHudReference = {
    buffer: Buffer.from("route-start-reference"),
    paintProbe: paintProbe(),
  };
  let blockingCaptureCalls = 0;
  let lastSequence = 0;
  let routeHudContinuityRejections = 0;
  let stabilityCalls = 0;
  const selectedFrameSequences = [];
  const waitRequests = [];
  const session = {
    autoplayScreencastSequence: () => lastSequence,
    captureScreenshot: async () => {
      blockingCaptureCalls += 1;
      await new Promise(() => {});
    },
    readScreenshotPaintProbe: async () => paintProbes.shift(),
    waitForAutoplayScreencastFrame: async (options) => {
      waitRequests.push(options);
      const frame = frames.find(
        (candidate) =>
          candidate.sequence > options.afterSequence &&
          framePolicy.screencastFrameCapturedAtEpochMs(candidate) >=
            options.minimumCapturedAtEpochMs,
      );
      assert.ok(frame, "Expected an eligible asynchronous screencast frame.");
      lastSequence = frame.sequence;
      selectedFrameSequences.push(frame.sequence);
      return frame;
    },
  };
  const capture = await acquireFrame({
    initialProbe: probe(0),
    isCaptureWindowCoherent: (before, after) => before.state === after.state,
    isInitialProbeCoherent: (initial, before) =>
      initial.state === before.state,
    label: "partial live milestone",
    readProbe: async () => probes.shift(),
    session,
    validateFrame: ({ frame, paintProbe: stablePaintProbe }) => {
      return {
        buffer: Buffer.from(frame.data),
        height: 625,
        paintProbe: stablePaintProbe,
        textPaint: { regionCount: 8, surfaces: ["hud", "dock", "rail"] },
        width: 1365,
      };
    },
    validateStableFramePair: (options) => {
      stabilityCalls += 1;
      const frameStability =
        pixelPolicy.assertStableAutoplayScreencastFramePair(options);
      try {
        return {
          ...frameStability,
          ...pixelPolicy.assertAutoplayRouteHudContinuity({
            ...options,
            hudReference: routeStartHudReference,
          }),
        };
      } catch (error) {
        routeHudContinuityRejections += 1;
        throw error;
      }
    },
  });
  assert.equal(capture.frame.sequence, 6);
  assert.deepEqual(selectedFrameSequences, [1, 3, 4, 6]);
  assert.equal(
    Math.round(waitRequests[1].minimumCapturedAtEpochMs - epoch),
    265,
  );
  assert.equal(
    Math.round(waitRequests[3].minimumCapturedAtEpochMs - epoch),
    565,
  );
  assert.equal(routeHudContinuityRejections, 1);
  assert.equal(stabilityCalls, 2);
  assert.equal(blockingCaptureCalls, 0);

  const buildProbeRetrySession = (retryFrames) => {
    let sequence = 0;
    return {
      autoplayScreencastSequence: () => sequence,
      readScreenshotPaintProbe: async () => paintProbe(),
      waitForAutoplayScreencastFrame: async (options) => {
        const frame = retryFrames.find(
          (candidate) =>
            candidate.sequence > options.afterSequence &&
            framePolicy.screencastFrameCapturedAtEpochMs(candidate) >=
              options.minimumCapturedAtEpochMs,
        );
        assert.ok(frame, "Expected an eligible probe-retry screencast frame.");
        sequence = frame.sequence;
        return frame;
      },
    };
  };
  const validateProbeRetryFrame = (validatedSequences) =>
    ({ frame, paintProbe: stablePaintProbe }) => {
      validatedSequences.push(frame.sequence);
      return {
        buffer: Buffer.from(frame.data),
        height: 625,
        paintProbe: stablePaintProbe,
        textPaint: { regionCount: 8, surfaces: ["hud", "dock", "rail"] },
        width: 1365,
      };
    };
  const transientProbeFrames = [
    { data: "unbracketed", metadata: { timestamp: (epoch + 840) / 1_000 }, sequence: 1 },
    { data: "unbracketed-confirmation", metadata: { timestamp: (epoch + 970) / 1_000 }, sequence: 2 },
    { data: "bracketed", metadata: { timestamp: (epoch + 1_140) / 1_000 }, sequence: 3 },
    { data: "bracketed-confirmation", metadata: { timestamp: (epoch + 1_270) / 1_000 }, sequence: 4 },
  ];
  const transientProbes = [probe(700), null, probe(1_000), probe(1_300)];
  const transientValidatedSequences = [];
  const transientCapture = await acquireFrame({
    initialProbe: probe(690),
    isCaptureWindowCoherent: (before, after) => before.state === after.state,
    isInitialProbeCoherent: (initial, before) =>
      initial.state === before.state,
    label: "transient unavailable after probe",
    readProbe: async () => transientProbes.shift(),
    session: buildProbeRetrySession(transientProbeFrames),
    validateFrame: validateProbeRetryFrame(transientValidatedSequences),
    validateStableFramePair: () => ({}),
  });
  assert.equal(transientCapture.frame.sequence, 4);
  assert.deepEqual(
    transientValidatedSequences,
    [3, 4],
    "Pixels from the attempt without an after-probe must never be validated.",
  );

  const persistentProbeFrames = [
    { data: "attempt-1", metadata: { timestamp: (epoch + 1_540) / 1_000 }, sequence: 1 },
    { data: "attempt-1-confirmation", metadata: { timestamp: (epoch + 1_670) / 1_000 }, sequence: 2 },
    { data: "attempt-2", metadata: { timestamp: (epoch + 1_840) / 1_000 }, sequence: 3 },
    { data: "attempt-2-confirmation", metadata: { timestamp: (epoch + 1_970) / 1_000 }, sequence: 4 },
    { data: "attempt-3", metadata: { timestamp: (epoch + 2_140) / 1_000 }, sequence: 5 },
    { data: "attempt-3-confirmation", metadata: { timestamp: (epoch + 2_270) / 1_000 }, sequence: 6 },
    { data: "attempt-4", metadata: { timestamp: (epoch + 2_440) / 1_000 }, sequence: 7 },
    { data: "attempt-4-confirmation", metadata: { timestamp: (epoch + 2_570) / 1_000 }, sequence: 8 },
  ];
  const persistentProbes = [
    probe(1_400),
    null,
    probe(1_700),
    null,
    probe(2_000),
    null,
    probe(2_300),
    null,
  ];
  const persistentValidatedSequences = [];
  await assert.rejects(
    acquireFrame({
      initialProbe: probe(1_390),
      isCaptureWindowCoherent: (before, after) =>
        before.state === after.state,
      isInitialProbeCoherent: (initial, before) =>
        initial.state === before.state,
      label: "persistent unavailable after probe",
      readProbe: async () => persistentProbes.shift(),
      session: buildProbeRetrySession(persistentProbeFrames),
      validateFrame: validateProbeRetryFrame(persistentValidatedSequences),
      validateStableFramePair: () => ({}),
    }),
    /current-state probe was unavailable after frame capture on attempt 4\/4/,
  );
  await assert.rejects(
    acquireFrame({
      initialProbe: probe(2_390),
      isCaptureWindowCoherent: (before, after) =>
        before.state === after.state,
      isInitialProbeCoherent: (initial, before) =>
        initial.state === before.state,
      label: "persistent unavailable before probe diagnostics",
      readProbe: async () => null,
      session: {
        cdpDiagnosticSnapshot: () => ({
          pendingRequests: [],
          socket: { writable: true },
        }),
      },
    }),
    /current-state probe was unavailable before frame capture on attempt 4\/4\. CDP diagnostics: \{"pendingRequests":\[\],"socket":\{"writable":true\}\}/,
  );
  assert.deepEqual(
    persistentValidatedSequences,
    [],
    "Persistent unbracketed pixels must never be validated.",
  );

  const staleProbeSequence = [
    probe(210), probe(500),
    probe(610), probe(900),
    probe(1_010), probe(1_300),
    probe(1_410), probe(1_700),
  ];
  const staleFrames = [
    [200, 330],
    [600, 730],
    [1_000, 1_130],
    [1_400, 1_530],
  ].flatMap(([candidate, confirmation], index) => [
    {
      data: `stale-${index + 1}`,
      metadata: { timestamp: (epoch + candidate) / 1_000 },
      sequence: index * 2 + 1,
    },
    {
      data: `stale-${index + 1}-confirmation`,
      metadata: { timestamp: (epoch + confirmation) / 1_000 },
      sequence: index * 2 + 2,
    },
  ]);
  let staleSequence = 0;
  await assert.rejects(
    acquireFrame({
      initialProbe: probe(200),
      isCaptureWindowCoherent: (before, after) => before.state === after.state,
      isInitialProbeCoherent: (initial, before) =>
        initial.state === before.state,
      label: "stale live milestone",
      readProbe: async () => staleProbeSequence.shift(),
      session: {
        autoplayScreencastSequence: () => staleSequence,
        readScreenshotPaintProbe: async () => paintProbe(),
        waitForAutoplayScreencastFrame: async () => {
          const frame = staleFrames.shift();
          assert.ok(frame, "Expected a stale screencast frame fixture.");
          staleSequence = frame.sequence;
          return frame;
        },
      },
      validateFrame: () => assert.fail("stale pixels must not be validated"),
    }),
    /timestamp was outside its current-state probe window/,
  );

  const boundaryFrames = [
    { data: "boundary", metadata: { timestamp: (epoch + 440) / 1_000 }, sequence: 1 },
    { data: "boundary-confirmation", metadata: { timestamp: (epoch + 570) / 1_000 }, sequence: 2 },
    { data: "arrival", metadata: { timestamp: (epoch + 740) / 1_000 }, sequence: 3 },
    { data: "arrival-confirmation", metadata: { timestamp: (epoch + 870) / 1_000 }, sequence: 4 },
  ];
  const boundaryProbes = [
    probe(310),
    probe(600, "arrival"),
    probe(610, "arrival"),
    probe(900, "arrival"),
  ];
  const boundaryValidatedSequences = [];
  const recoveredBoundaryCapture = await acquireFrame({
    initialProbe: probe(300),
    isCaptureWindowCoherent: (before, after) => before.state === after.state,
    isInitialProbeCoherent: (_initial, before) =>
      before.state === "conversation" || before.state === "arrival",
    label: "transient live milestone state boundary",
    readProbe: async () => boundaryProbes.shift(),
    session: buildProbeRetrySession(boundaryFrames),
    validateFrame: validateProbeRetryFrame(boundaryValidatedSequences),
    validateStableFramePair: () => ({}),
  });
  assert.equal(recoveredBoundaryCapture.frame.sequence, 4);
  assert.equal(recoveredBoundaryCapture.beforeProbe.state, "arrival");
  assert.equal(recoveredBoundaryCapture.afterProbe.state, "arrival");
  assert.deepEqual(
    boundaryValidatedSequences,
    [3, 4],
    "Pixels that crossed the route-arrival boundary must never be validated.",
  );

  const persistentBoundaryFrames = [
    [1_040, 1_170],
    [1_440, 1_570],
    [1_840, 1_970],
    [2_240, 2_370],
  ].flatMap(([candidate, confirmation], index) => [
    {
      data: `boundary-${index + 1}`,
      metadata: { timestamp: (epoch + candidate) / 1_000 },
      sequence: index * 2 + 1,
    },
    {
      data: `boundary-${index + 1}-confirmation`,
      metadata: { timestamp: (epoch + confirmation) / 1_000 },
      sequence: index * 2 + 2,
    },
  ]);
  const persistentBoundaryProbes = [
    probe(910), probe(1_300, "arrival"),
    probe(1_310), probe(1_700, "arrival"),
    probe(1_710), probe(2_100, "arrival"),
    probe(2_110), probe(2_500, "arrival"),
  ];
  const persistentBoundaryValidatedSequences = [];
  await assert.rejects(
    acquireFrame({
      initialProbe: probe(900),
      isCaptureWindowCoherent: (before, after) => before.state === after.state,
      isInitialProbeCoherent: () => true,
      label: "persistent live milestone state boundary",
      readProbe: async () => persistentBoundaryProbes.shift(),
      session: buildProbeRetrySession(persistentBoundaryFrames),
      validateFrame: validateProbeRetryFrame(
        persistentBoundaryValidatedSequences,
      ),
      validateStableFramePair: () => ({}),
    }),
    /not bracketed by one coherent current state\. Candidate: .* Confirmation:/,
  );
  assert.deepEqual(
    persistentBoundaryValidatedSequences,
    [],
    "Persistent state-boundary pixels must never be validated.",
  );

  const runStart = source.indexOf("async function runAutoplayObservation(");
  const liveStart = source.indexOf(
    "await session.startAutoplayScreencast();",
    runStart,
  );
  const runEnd = source.indexOf(
    "\nfunction assertAutoplayOpeningWorldTrajectoryEvidence(",
    liveStart,
  );
  assert.doesNotMatch(
    source.slice(liveStart, runEnd),
    /captureScreenshot|Page\.captureScreenshot/,
    "No active autoplay milestone may invoke the blocking capture API.",
  );
  assert.match(source, /captureAutoplayFrozenTrajectoryMilestone/);
  assert.match(source, /assertVisibleScreenshotTextPaint\(buffer, paintProbe, label\)/);
});

test("HUD glyph validation rejects a missing DAY run over a visible chip", () => {
  const width = 120;
  const height = 40;
  const channels = 3;
  const completePixels = Buffer.alloc(width * height * channels, 18);
  const fillRect = (pixels, rect, value) => {
    for (let y = rect.top; y < rect.bottom; y += 1) {
      for (let x = rect.left; x < rect.right; x += 1) {
        const offset = (y * width + x) * channels;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
      }
    }
  };
  const region = (surface, text, left, right, top = 2, bottom = 10) => ({
    rect: { bottom, left, right, top },
    surface,
    text,
  });
  const probe = {
    regions: [
      region("hud", "DAY 1", 2, 14),
      region("hud", "11:05", 16, 30),
      region("hud", "LATE MORNING", 32, 58),
      region("hud", "$12", 60, 70),
      region("hud", "70 ENERGY", 72, 90),
      region("hud", "4/4 MET", 92, 118),
      region("dock", "WORLD", 2, 16, 20, 30),
      region("rail", "Rowan", 20, 36, 20, 30),
    ],
    viewport: { height, width },
  };
  for (const textRegion of probe.regions) {
    fillRect(completePixels, textRegion.rect, 200);
  }
  const missingDayPixels = Buffer.from(completePixels);
  fillRect(missingDayPixels, probe.regions[0].rect, 80);
  const decodedPixels = new Map([
    ["complete-hud", completePixels],
    ["missing-day-hud", missingDayPixels],
  ]);
  const textPaintStart = source.indexOf(
    "function assertVisibleScreenshotTextPaint(",
  );
  const textPaintEnd = source.indexOf(
    "\nfunction screenshotRegionPixelDifferenceRatio(",
    textPaintStart,
  );
  const assertTextPaint = Function(
    "assert",
    "decodePngPixels",
    `${source.slice(textPaintStart, textPaintEnd)}; return assertVisibleScreenshotTextPaint;`,
  )(
    assert,
    (buffer) => ({
      channels,
      height,
      pixels: decodedPixels.get(buffer.toString()),
      width,
    }),
  );

  assert.doesNotThrow(() =>
    assertTextPaint(Buffer.from("complete-hud"), probe, "complete HUD fixture"),
  );
  assert.throws(
    () =>
      assertTextPaint(
        Buffer.from("missing-day-hud"),
        probe,
        "missing DAY fixture",
      ),
    /visible hud text "DAY 1" was not completely painted/,
  );
});

test("screencast slow frames stay bounded and lifecycle failures remain diagnostic", async (t) => {
  assert.match(
    source,
    /MANY_LIVES_BROWSER_AUTOPLAY_SCREENCAST_FRAME_TIMEOUT_MS[\s\S]*?"8000"/,
  );
  const routeSegmentsPolicyStart = source.indexOf(
    "function isAutoplayFootholdRouteFrame(",
  );
  const routeSegmentsPolicyEnd = source.indexOf(
    "\nasync function captureAutoplayFrozenTrajectoryMilestone(",
    routeSegmentsPolicyStart,
  );
  const routeSegmentsPolicy = Function(
    "AUTOPLAY_ROUTE_SEGMENT_MAX_SAMPLE_GAP_MS",
    "AUTOPLAY_ROUTE_SEGMENT_PROGRESS_RESET_TOLERANCE",
    `${source.slice(routeSegmentsPolicyStart, routeSegmentsPolicyEnd)}; return { autoplayRecordedRouteWindowSharesAdmissibleIdentity, autoplayRouteCaptureSamplesShareExactIdentity, autoplayRouteCaptureSamplesShareExactRouteIdentity, autoplayRouteCaptureWindowOpeningMembership, buildAutoplayOpeningRouteEvidence, buildAutoplayRouteCaptureSegments, compactAutoplayRouteCaptureSegments, compactAutoplayRouteFrameWindowProbe, isAutoplayFootholdRouteFrame };`,
  )(2_000, 0.02);
  const screencastFrameCapturedAtEpochMs = (frame) =>
    typeof frame?.metadata?.timestamp === "number"
      ? frame.metadata.timestamp * 1_000
      : null;
  const screencastFrameIsBracketedByEpochProbes = (
    frame,
    beforeProbe,
    afterProbe,
  ) => {
    const capturedAtEpochMs = screencastFrameCapturedAtEpochMs(frame);
    return (
      typeof capturedAtEpochMs === "number" &&
      capturedAtEpochMs >= beforeProbe.capturedAtEpochMs &&
      capturedAtEpochMs <= afterProbe.capturedAtEpochMs
    );
  };
  const recordedRoutePolicyStart = source.indexOf(
    "function recordedRouteWindowBelongsToOpeningSegment(",
  );
  const recordedRoutePolicyEnd = source.indexOf(
    "\nasync function waitForAutoplayRecordedRouteTrajectory(",
    recordedRoutePolicyStart,
  );
  const recordedRoutePolicy = Function(
    "assert",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "AUTOPLAY_ROUTE_OPENING_FRAME_MAX_PROGRESS",
    "AUTOPLAY_ROUTE_OPENING_FRAME_MIN_SETTLE_MS",
    "AUTOPLAY_ROUTE_SEGMENT_MAX_SAMPLE_GAP_MS",
    "AUTOPLAY_ROUTE_SEGMENT_PROGRESS_RESET_TOLERANCE",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "requireStableAutoplayScreenshotPaintProbe",
    "requireStableAutoplayRouteWindowPaintProbe",
    "assertAutoplayRouteHudContinuity",
    "assertStableAutoplayScreencastFramePair",
    "validateAutoplayRouteCanvasFrame",
    "assertAutoplayRouteCanvasFramePair",
    "autoplayRecordedRouteWindowFrame",
    `${source.slice(routeSegmentsPolicyStart, routeSegmentsPolicyEnd)}\n${source.slice(recordedRoutePolicyStart, recordedRoutePolicyEnd)}; return { autoplayDelayedScreencastRouteFrameWindowMatches, autoplayRecordedRouteWindowsHaveDistinctProgress, autoplayRouteCaptureWindowRetainsCompositingSettle, buildAutoplayDelayedScreencastRouteFrameWindow, buildAutoplayRecordedRouteFrameCandidates, buildAutoplayRenderedOpeningRouteEvidence, selectAutoplayRecordedRouteTrajectory };`,
  )(
    assert,
    0.1,
    0.02,
    50,
    2_000,
    0.02,
    125,
    screencastFrameCapturedAtEpochMs,
    screencastFrameIsBracketedByEpochProbes,
    (_before, after) => after,
    (_before, after) => after,
    () => ({ routeHudContinuityPixelDifferenceRatio: 0 }),
    () => ({ hudPixelDifferenceRatio: 0 }),
    ({ frame, paintProbe }) => {
      assert.equal(frame?.metadata?.contextLost, false);
      assert.equal(frame?.metadata?.defaultFramebuffer, true);
      assert.ok(
        Number(frame?.metadata?.renderedAtMs) >
          Number(frame?.metadata?.initialRenderedAtMs),
      );
      assert.equal(frame?.metadata?.geometry?.crop?.width, 640);
      assert.equal(frame?.metadata?.geometry?.crop?.height, 360);
      const buffer = Buffer.from(frame.data, "base64");
      assert.notEqual(buffer.toString(), "blank");
      return {
        buffer,
        height: 360,
        paintProbe,
        routeCanvas: { geometry: frame.metadata.geometry },
        textPaint: {},
        width: 640,
      };
    },
    ({ after, before }) => {
      assert.deepEqual(after.routeCanvas.geometry, before.routeCanvas.geometry);
      assert.notDeepEqual(after.buffer, before.buffer);
      return { routeCanvasChangedPixelRatio: 0.01 };
    },
    (recordedWindow) =>
      recordedWindow?.frame ?? recordedWindow?.confirmationFrame ?? null,
  );
  const cdpCaptureErrorPolicyStart = source.indexOf(
    "function isCdpRuntimeEvaluateTimeout(",
  );
  const cdpCaptureErrorPolicyEnd = source.indexOf(
    "\nclass CdpSession {",
    cdpCaptureErrorPolicyStart,
  );
  const cdpCaptureErrorPolicy = Function(
    `${source.slice(cdpCaptureErrorPolicyStart, cdpCaptureErrorPolicyEnd)}; return { isCdpExecutionContextReset, isRetryableAutoplayRouteCanvasCaptureError };`,
  )();
  const proactiveCaptureStart = source.indexOf(
    "async function captureAutoplayRouteVisualFrameWithFallback(",
  );
  const proactiveCaptureEnd = source.indexOf(
    "\nfunction recordedRouteWindowBelongsToOpeningSegment(",
    proactiveCaptureStart,
  );
  const proactiveCapturePolicy = Function(
    "AUTOPLAY_SCREENCAST_COMMAND_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "isRetryableAutoplayRouteCanvasCaptureError",
    "autoplayRouteCaptureWindowCoherent",
    "isAutoplayFootholdRouteFrame",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "autoplayRouteCaptureSamplesShareExactIdentity",
    "autoplayRouteCaptureSamplesShareExactRouteIdentity",
    `${source.slice(proactiveCaptureStart, proactiveCaptureEnd)}; return captureAutoplayProactiveRouteFrameWindow;`,
  )(
    5,
    125,
    cdpCaptureErrorPolicy.isRetryableAutoplayRouteCanvasCaptureError,
    (beforeRoute, afterRoute, expectedTargetLocationId) =>
      routeSegmentsPolicy.isAutoplayFootholdRouteFrame(
        beforeRoute,
        expectedTargetLocationId,
      ) &&
      routeSegmentsPolicy.isAutoplayFootholdRouteFrame(
        afterRoute,
        expectedTargetLocationId,
      ) &&
      afterRoute.progress >= beforeRoute.progress,
    routeSegmentsPolicy.isAutoplayFootholdRouteFrame,
    screencastFrameCapturedAtEpochMs,
    screencastFrameIsBracketedByEpochProbes,
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactIdentity,
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactRouteIdentity,
  );
  let proactiveRouteCaptureFixture = async () => null;
  let routeCompositingSleepFixture = (minimumEpochMs) =>
    sleepUntilEpochMs(minimumEpochMs, {
      sleepFor: (milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)),
    });
  const classStart = source.indexOf("class CdpSession {");
  const classEnd = source.indexOf(
    "\nasync function launchBrowserSession(",
    classStart,
  );
  const CdpSession = Function(
    "assert",
    "deflateSync",
    "AUTOPLAY_SCREENCAST_COMMAND_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_EVERY_NTH_FRAME",
    "AUTOPLAY_ROUTE_SCREENCAST_EVERY_NTH_FRAME",
    "AUTOPLAY_ROUTE_SCREENCAST_MIN_FRAME_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_MAX_HEIGHT",
    "AUTOPLAY_SCREENCAST_MAX_WIDTH",
    "AUTOPLAY_SCREENCAST_FRAME_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_MAX_BUFFERED_FRAMES",
    "AUTOPLAY_ROUTE_RECORDER_FRAME_HISTORY_MS",
    "AUTOPLAY_ROUTE_RECORDER_FRAME_INTERVAL_MS",
    "AUTOPLAY_ROUTE_RECORDER_MAX_FRAMES",
    "AUTOPLAY_ROUTE_FRAME_ARCHIVE_MAX_FRAMES",
    "AUTOPLAY_ROUTE_FRAME_WINDOW_ARCHIVE_MAX_WINDOWS",
    "AUTOPLAY_ROUTE_FRAME_WINDOW_REJECTION_MAX_ENTRIES",
    "AUTOPLAY_ROUTE_RECORDER_MAX_SNAPSHOTS",
    "AUTOPLAY_ROUTE_RECORDER_MAX_RESTARTS",
    "AUTOPLAY_ROUTE_RECORDER_SAMPLE_INTERVAL_MS",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "AUTOPLAY_ROUTE_CANVAS_CAPTURE_TIMEOUT_MS",
    "AUTOPLAY_ROUTE_CANVAS_MAX_PAYLOAD_BASE64_LENGTH",
    "AUTOPLAY_ROUTE_PROACTIVE_SCREENSHOT_SCALE",
    "AUTOPLAY_ROUTE_RENDERED_FRAME_MIN_HEIGHT",
    "AUTOPLAY_ROUTE_RENDERED_FRAME_MIN_WIDTH",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "PROBE_POLL_INTERVAL_MS",
    "autoplayRouteCaptureWindowCoherent",
    "autoplayRouteCaptureSamplesShareExactIdentity",
    "autoplayRouteCaptureSamplesShareExactRouteIdentity",
    "autoplayRecordedRouteWindowSharesAdmissibleIdentity",
    "autoplayDelayedScreencastRouteFrameWindowMatches",
    "autoplayRouteCaptureWindowOpeningMembership",
    "autoplayRecordedRouteWindowFrame",
    "autoplayRecordedRouteWindowsHaveDistinctProgress",
    "buildAutoplayOpeningRouteEvidence",
    "buildAutoplayRenderedOpeningRouteEvidence",
    "buildAutoplayRouteCaptureSegments",
    "buildAutoplayRouteCanvasReadbackGeometry",
    "sampleAutoplayRouteRecorderAtOrAfter",
    "buildAutoplayDelayedScreencastRouteFrameWindow",
    "captureAutoplayProactiveRouteFrameWindow",
    "compactAutoplayRouteCaptureSegments",
    "compactAutoplayRouteFrameWindowProbe",
    "CDP_WAIT_TIMEOUT_MS",
    "isAutoplayFootholdRouteFrame",
    "isCdpExecutionContextReset",
    "screencastFrameIsBracketedByEpochProbes",
    "screencastFrameCapturedAtEpochMs",
    "sleep",
    "sleepUntilEpochMs",
    "withTimeout",
    `${source.slice(classStart, classEnd)}; return CdpSession;`,
  )(
    assert,
    deflateSync,
    5,
    2,
    1,
    25,
    375,
    819,
    60,
    4,
    2_000,
    125,
    16,
    8,
    2,
    8,
    16,
    4,
    1,
    0.1,
    1_500,
    2_000_000,
    0.6,
    360,
    640,
    125,
    25,
    (beforeRoute, afterRoute, expectedTargetLocationId) =>
      beforeRoute?.active === true &&
      afterRoute?.active === true &&
      beforeRoute.targetLocationId === expectedTargetLocationId &&
      afterRoute.targetLocationId === expectedTargetLocationId &&
      afterRoute.progress >= beforeRoute.progress,
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactIdentity,
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactRouteIdentity,
    routeSegmentsPolicy.autoplayRecordedRouteWindowSharesAdmissibleIdentity,
    recordedRoutePolicy.autoplayDelayedScreencastRouteFrameWindowMatches,
    routeSegmentsPolicy.autoplayRouteCaptureWindowOpeningMembership,
    (recordedWindow) =>
      recordedWindow?.frame ?? recordedWindow?.confirmationFrame ?? null,
    recordedRoutePolicy.autoplayRecordedRouteWindowsHaveDistinctProgress,
    routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence,
    recordedRoutePolicy.buildAutoplayRenderedOpeningRouteEvidence,
    routeSegmentsPolicy.buildAutoplayRouteCaptureSegments,
    buildAutoplayRouteCanvasReadbackGeometry,
    sampleAutoplayRouteRecorderAtOrAfter,
    recordedRoutePolicy.buildAutoplayDelayedScreencastRouteFrameWindow,
    (options) => proactiveRouteCaptureFixture(options),
    routeSegmentsPolicy.compactAutoplayRouteCaptureSegments,
    routeSegmentsPolicy.compactAutoplayRouteFrameWindowProbe,
    20,
    routeSegmentsPolicy.isAutoplayFootholdRouteFrame,
    cdpCaptureErrorPolicy.isCdpExecutionContextReset,
    screencastFrameIsBracketedByEpochProbes,
    screencastFrameCapturedAtEpochMs,
    (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    (minimumEpochMs) => routeCompositingSleepFixture(minimumEpochMs),
    (promise, timeoutMs, message) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(message)), timeoutMs),
        ),
      ]),
  );
  const session = new CdpSession({
    browser: null,
    outputDir: "/tmp",
    pageWsUrl: "ws://127.0.0.1:9222/devtools/page/test",
    url: "http://127.0.0.1/",
  });
  session.socket = { destroyed: false, writable: true };
  const commands = [];
  session.send = async (method, params) => {
    commands.push({ method, params });
    return {};
  };

  await session.startAutoplayScreencast();
  const firstStartedAt = session.screencast.startedAtEpochMs;
  session.handleAutoplayScreencastFrame({
    data: "first",
    metadata: { timestamp: (firstStartedAt + 1) / 1_000 },
    sessionId: 1,
  });
  assert.equal(session.screencast.frames.length, 1);
  const waiter = session.waitForAutoplayScreencastFrame({
    afterSequence: 1,
    minimumCapturedAtEpochMs: firstStartedAt,
  });
  const stopping = session.stopAutoplayScreencast();
  await assert.rejects(waiter, /stopped before a frame arrived/);
  await stopping;
  session.handleAutoplayScreencastFrame({
    data: "late",
    metadata: { timestamp: (firstStartedAt + 2) / 1_000 },
    sessionId: 2,
  });

  await session.startAutoplayScreencast();
  const secondStartedAt = session.screencast.startedAtEpochMs;
  session.handleAutoplayScreencastFrame({
    data: "stale-generation",
    metadata: { timestamp: (secondStartedAt - 1) / 1_000 },
    sessionId: 3,
  });
  assert.equal(session.screencast.frames.length, 0);
  assert.equal(session.screencast.ignoredFrameCount, 1);
  session.handleAutoplayScreencastFrame({
    data: "second",
    metadata: { timestamp: (secondStartedAt + 1) / 1_000 },
    sessionId: 4,
  });
  assert.equal(session.screencast.frames.length, 1);
  assert.equal(session.screencast.frames[0].data, "second");
  await session.stopAutoplayScreencast();
  assert.ok(
    commands.filter((command) => command.method === "Page.screencastFrameAck")
      .length >= 4,
    "Every current or late screencast event must be acknowledged.",
  );
  assert.ok(
    commands
      .filter((command) => command.method === "Page.startScreencast")
      .every(
        (command) =>
          command.params.everyNthFrame === 2 &&
          command.params.maxHeight === 375 &&
          command.params.maxWidth === 819,
      ),
    "Every screencast generation must retain the bounded legible route-evidence raster and CI-safe cadence.",
  );

  const archiveSession = new CdpSession({
    browser: null,
    outputDir: "/tmp",
    pageWsUrl: "ws://127.0.0.1:9222/devtools/page/route-archive",
    url: "http://127.0.0.1/",
  });
  archiveSession.socket = { destroyed: false, writable: true };
  archiveSession.send = async () => ({});
  await archiveSession.startAutoplayScreencast();
  const archiveStartedAt = archiveSession.screencast.startedAtEpochMs;
  const routeOffsets = [150, 280, 550, 680];
  routeOffsets.forEach((offsetMs, index) => {
    archiveSession.handleAutoplayScreencastFrame({
      data: `route-${index + 1}`,
      metadata: { timestamp: (archiveStartedAt + offsetMs) / 1_000 },
      sessionId: 10 + index,
    });
  });
  const archivedRecorder = {
    acceptedCount: 8,
    expectedTargetLocationId: "tea-house",
    samples: [0, 100, 200, 300, 400, 500, 600, 700].map(
      (offsetMs, index) => ({
        capturedAtEpochMs: archiveStartedAt + offsetMs,
        paintProbe: {
          stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        },
        route: {
          active: true,
          legal: true,
          progress: 0.02 + index * 0.06,
          reachesDestination: true,
          sampledPointsLegal: true,
          targetLocationId: "tea-house",
          tilePathLength: 15,
          visualObstaclesClear: true,
          worldPathLength: 16,
        },
        source: "movement-probe-recorder",
      }),
    ),
  };
  assert.equal(archiveSession.archiveAutoplayRouteFrames(archivedRecorder), 4);
  assert.equal(archiveSession.archiveAutoplayRouteFrames(archivedRecorder), 4);
  [5_000, 5_130, 5_260, 5_390].forEach((offsetMs, index) => {
    archiveSession.handleAutoplayScreencastFrame({
      data: `post-route-${index + 1}`,
      metadata: { timestamp: (archiveStartedAt + offsetMs) / 1_000 },
      sessionId: 20 + index,
    });
  });
  const laterSamples = [4_800, 4_900, 5_000, 5_100, 5_200, 5_300].map(
    (offsetMs, index) => ({
      capturedAtEpochMs: archiveStartedAt + offsetMs,
      paintProbe: {
        stableRegions: [{ surface: "hud", text: "DAY 1 12:21" }],
      },
      route: {
        active: true,
        legal: true,
        progress: 0.01 + index * 0.08,
        reachesDestination: true,
        sampledPointsLegal: true,
        targetLocationId: "tea-house",
        tilePathLength: 4,
        visualObstaclesClear: true,
        worldPathLength: 4,
      },
      source: "movement-probe-recorder",
    }),
  );
  archiveSession.archiveAutoplayRouteFrames({
    acceptedCount: archivedRecorder.acceptedCount + laterSamples.length,
    expectedTargetLocationId: "tea-house",
    samples: [...archivedRecorder.samples, ...laterSamples],
  });
  assert.ok(
    archiveSession.screencast.routeFrameHistory.every(
      (frame) => frame.sequence > routeOffsets.length,
    ),
    "The generic route ring fixture must expire every route-time frame.",
  );
  assert.deepEqual(
    archiveSession.screencast.routeFrameArchive.map((frame) => frame.data),
    ["route-1", "route-2", "route-3", "route-4"],
  );
  assert.equal(archiveSession.screencast.routeFrameArchiveFrozen, true);
  assert.equal(archiveSession.screencast.routeFrameObservedSegmentCount, 2);
  assert.equal(archiveSession.screencast.routeFrameArchivedSampleCount, 8);
  assert.equal(archiveSession.autoplayRouteCaptureSamples().length, 8);
  assert.match(
    archiveSession.screencast.routeFrameOpeningSegment.hudSignature,
    /11:05/,
  );
  assert.doesNotMatch(
    archiveSession.screencast.routeFrameOpeningSegment.hudSignature,
    /12:21/,
  );
  assert.deepEqual(
    archiveSession
      .autoplayRouteFrameHistory()
      .slice(0, routeOffsets.length)
      .map((frame) => frame.data),
    ["route-1", "route-2", "route-3", "route-4"],
    "Delayed selection must retain the bounded route archive after the generic ring expires.",
  );
  await archiveSession.stopAutoplayScreencast();

  await t.test(
    "a bounded route-tail frame survives slow CI screencast cadence",
    async () => {
      const tailSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/route-tail",
        url: "http://127.0.0.1/",
      });
      tailSession.socket = { destroyed: false, writable: true };
      tailSession.send = async () => ({});
      await tailSession.startAutoplayScreencast();
      const startedAt = tailSession.screencast.startedAtEpochMs;
      const samples = [
        [0.005, 0],
        [0.14, 200],
        [0.28, 400],
        [0.42, 600],
        [0.56, 800],
        [0.7, 1_000],
        [0.852, 1_200],
      ].map(([progress, offsetMs], index) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          regions: [{ surface: "hud", text: "DAY 1 11:05" }],
          stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
          viewport: { height: 625, width: 1365 },
        },
        recorderGeneration: 2,
        recorderParseErrorCount: 0,
        recorderRejectedCount: 0,
        recorderTickCount: index + 1,
        recorderUnavailableCount: 0,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      }));
      const addFrame = (sequence, offsetMs, pixels) => {
        tailSession.handleAutoplayScreencastFrame({
          data: Buffer.from(pixels).toString("base64"),
          metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
          sessionId: sequence,
        });
      };
      addFrame(41, 500, "route-middle");
      tailSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      tailSession.archiveAutoplayRouteFrames({
        acceptedCount: samples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples,
      });
      assert.equal(
        tailSession.screencast.routeFrameArchive.length,
        1,
        "The initial recorder read must reproduce the single-frame CI archive.",
      );

      addFrame(42, 1_215, "route-tail");
      assert.equal(
        tailSession.screencast.routeFrameArchive.length,
        2,
        "A bounded tail frame arriving after the recorder read must update the durable archive immediately.",
      );
      addFrame(43, 1_400, "too-late");
      const routeMiddleFrame =
        tailSession.screencast.routeFrameHistory[0];
      const tooLateFrame = tailSession.screencast.routeFrameHistory[2];

      addFrame(44, 5_000, "later-route");
      const laterSamples = [0.1, 0.4].map((progress, index) => ({
        ...samples[index],
        capturedAtEpochMs: startedAt + 5_000 + index * 100,
        capturedAtMonotonicMs: 5_000 + index * 100,
        paintProbe: {
          ...samples[index].paintProbe,
          regions: [{ surface: "hud", text: "DAY 1 11:25" }],
          stableRegions: [{ surface: "hud", text: "DAY 1 11:25" }],
        },
        route: {
          ...samples[index].route,
          durationMs: 840,
          progress,
          spaceId: "interior:tea-house",
          target: { x: 8, y: 3 },
          tilePath: [
            { x: 7, y: 4 },
            { x: 8, y: 3 },
          ],
          worldPath: [
            { x: 396, y: 236 },
            { x: 436, y: 196 },
          ],
        },
      }));
      tailSession.archiveAutoplayRouteFrames({
        acceptedCount: samples.length + laterSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [...samples, ...laterSamples],
      });
      assert.deepEqual(
        tailSession.screencast.routeFrameArchive.map((frame) =>
          Buffer.from(frame.data, "base64").toString(),
        ),
        ["route-middle", "route-tail"],
        "Only the frame inside the legal sample span and the 15ms route-tail frame should survive archival.",
      );
      assert.equal(tailSession.screencast.routeFrameArchiveFrozen, true);
      assert.equal(
        tailSession.screencast.routeFrameHistory.length,
        1,
        "Later route churn must be allowed to evict the generic ring without losing the durable opening frames.",
      );

      const validateFrame = ({ frame, paintProbe: framePaintProbe }) => ({
        buffer: Buffer.from(frame.data, "base64"),
        height: 375,
        paintProbe: framePaintProbe,
        textPaint: {},
        width: 819,
      });
      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: tailSession.autoplayRouteFrameHistory(),
          label: "bounded route-tail",
          samples: tailSession.autoplayRouteCaptureSamples(),
          validateFrame,
          validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
            assert.notDeepEqual(afterBuffer, beforeBuffer);
            return { hudPixelDifferenceRatio: 0 };
          },
        });
      assert.equal(trajectory.start.frame.sequence, 1);
      assert.equal(trajectory.mid.frame.sequence, 2);
      assert.equal(
        trajectory.mid.validated.textPaint.routeTailFrameGraceMs,
        15,
      );
      assert.equal(
        trajectory.mid.validated.textPaint.routeTailFrameGraceMaximumMs,
        125,
      );

      assert.throws(
        () =>
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: [routeMiddleFrame, tooLateFrame],
            label: "late route-tail",
            samples,
            validateFrame,
            validateStableFramePair: () => ({}),
          }),
        /opening route evidence did not contain two distinct legal rendered positions/,
        "A frame beyond both the 125ms tail bound and remaining legal route time must stay rejected.",
      );
      await tailSession.stopAutoplayScreencast();
    },
  );

  await t.test(
    "frames captured on a legal opening route survive an inactive after-probe",
    async () => {
      const delayedSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/delayed-route-frame",
        url: "http://127.0.0.1/",
      });
      delayedSession.socket = { destroyed: false, writable: true };
      delayedSession.send = async () => ({});
      await delayedSession.startAutoplayScreencast();
      const startedAt = delayedSession.screencast.startedAtEpochMs;
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sampleAt = (progress, offsetMs, overrides = {}) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          regions: [{ surface: "hud", text: "DAY 1 11:05" }],
          stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
          viewport: { height: 625, width: 1_365 },
        },
        recorderGeneration: 2,
        route: { ...route, progress },
        source: "movement-probe-recorder",
        ...overrides,
      });
      const samples = [
        sampleAt(0.005, 0),
        sampleAt(0.2, 300),
        sampleAt(0.55, 700),
        sampleAt(0.67, 900),
        sampleAt(0.82, 1_100),
      ];
      const frames = [
        {
          data: Buffer.from("opening-route-position").toString("base64"),
          metadata: { timestamp: (startedAt + 725) / 1_000 },
          sequence: 41,
          source: "screencast",
        },
        {
          data: Buffer.from("later-route-position").toString("base64"),
          metadata: { timestamp: (startedAt + 1_125) / 1_000 },
          sequence: 42,
          source: "screencast",
        },
      ];
      delayedSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      delayedSession.screencast.routeRecorderGeneration = 2;
      delayedSession.screencast.routeSampleArchive = samples.slice(0, 3);
      let nextFrame = 0;
      let afterProbeReadCount = 0;
      delayedSession.waitForAutoplayScreencastFrame = async () =>
        frames[nextFrame++];
      delayedSession.sampleAutoplayRouteCaptureRecorder = async () => {
        afterProbeReadCount += 1;
        return null;
      };
      delayedSession.classifyAutoplayRouteCaptureSampleFailure = async () =>
        "route-unavailable";

      const firstWindow =
        await delayedSession.captureAutoplayScreencastRouteFrameWindow({
          afterSequence: 40,
          beforeProbe: samples[0],
          expectedTargetLocationId: "tea-house",
          label: "delayed opening route frame",
          timeoutMs: 1_000,
        });
      assert.ok(firstWindow);
      assert.equal(firstWindow.delayedAfterProbeRecovery,
        "archived-legal-route-samples");
      assert.equal(firstWindow.routeTailFrameGraceMs, 25);

      delayedSession.screencast.routeSampleArchive = samples;
      const secondWindow =
        await delayedSession.captureAutoplayScreencastRouteFrameWindow({
          afterSequence: 41,
          beforeProbe: samples[3],
          expectedTargetLocationId: "tea-house",
          label: "delayed later route frame",
          timeoutMs: 1_000,
        });
      assert.ok(secondWindow);
      assert.equal(afterProbeReadCount, 0,
        "Archived legal samples must bind the frame before a slow inactive after-probe can discard it.");
      assert.equal(delayedSession.autoplayRouteFrameWindows().length, 2);

      const validateFrame = ({ frame, paintProbe }) => ({
        buffer: Buffer.from(frame.data, "base64"),
        height: 375,
        paintProbe,
        textPaint: {},
        width: 819,
      });
      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: [],
          label: "delayed inactive after-probe",
          recordedWindows: delayedSession.autoplayRouteFrameWindows(),
          samples,
          validateFrame,
          validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
            assert.notDeepEqual(afterBuffer, beforeBuffer);
            return { hudPixelDifferenceRatio: 0 };
          },
        });
      assert.equal(trajectory.start.frame.sequence, 41);
      assert.equal(trajectory.mid.frame.sequence, 42);
      assert.equal(trajectory.start.evidenceSource, "screencast-frame");
      assert.equal(trajectory.mid.evidenceSource, "screencast-frame");

      const unrelatedPathSamples = samples.map((sample, index) =>
        index === 2
          ? {
              ...sample,
              route: {
                ...sample.route,
                worldPath: [
                  { x: 331, y: 688 },
                  { x: 884, y: 612 },
                ],
              },
            }
          : sample,
      );
      assert.equal(
        recordedRoutePolicy.buildAutoplayDelayedScreencastRouteFrameWindow({
          beforeProbe: unrelatedPathSamples[0],
          expectedTargetLocationId: "tea-house",
          frame: frames[0],
          samples: unrelatedPathSamples.slice(0, 3),
        }),
        null,
        "A path-changed frame must not inherit the opening route identity.",
      );
      assert.equal(
        recordedRoutePolicy.buildAutoplayDelayedScreencastRouteFrameWindow({
          beforeProbe: samples[0],
          expectedTargetLocationId: "tea-house",
          frame: {
            ...frames[0],
            metadata: { timestamp: (startedAt + 5_100) / 1_000 },
            sequence: 43,
          },
          samples: samples.slice(0, 3),
        }),
        null,
        "A frame beyond the projected legal route lifetime must stay rejected.",
      );
      assert.equal(
        recordedRoutePolicy.buildAutoplayDelayedScreencastRouteFrameWindow({
          beforeProbe: samples[0],
          expectedTargetLocationId: "tea-house",
          frame: frames[0],
          samples: samples.slice(0, 3).map((sample, index) =>
            index === 2
              ? { ...sample, recorderGeneration: 3 }
              : sample,
          ),
        }),
        null,
        "A generation-changed frame must not inherit archived route proof.",
      );
      await delayedSession.stopAutoplayScreencast();
    },
  );

  await t.test(
    "attempt-1 opening frames survive a post-probe route end and sample gap",
    async () => {
      const recoverySession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/attempt-1-route-recovery",
        url: "http://127.0.0.1/",
      });
      recoverySession.socket = { destroyed: false, writable: true };
      recoverySession.send = async () => ({});
      await recoverySession.startAutoplayScreencast();
      const startedAt = recoverySession.screencast.startedAtEpochMs;
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 10, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 884, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sampleAt = (progress, offsetMs, monotonicOffsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: monotonicOffsetMs,
        paintProbe: {
          regions: [
            { surface: "hud", text: "DAY 1 11:05 LATE MORNING" },
            { surface: "dock", text: "WORLD" },
            { surface: "rail", text: "Rowan" },
          ],
          stableRegions: [
            { surface: "hud", text: "DAY 1 11:05 LATE MORNING" },
          ],
          viewport: { height: 625, width: 1_365 },
        },
        recorderGeneration: 2,
        route: { ...route, progress },
        source: "movement-probe-recorder",
      });
      const samples = [
        sampleAt(0.009, 0, 5_000),
        sampleAt(0.009, 2_210, 100),
        sampleAt(0.457, 2_253, 143),
        sampleAt(0.767, 3_812, 1_702),
      ];
      const frameAt = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
        source: "screencast",
      });
      const openingFrame = frameAt(774, 2_243, "attempt-1-route-start");
      const laterFrame = frameAt(775, 3_792, "attempt-1-route-mid");
      const recorder = {
        acceptedCount: samples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        lastObservedRoute: null,
        samples,
        status: "active",
        unavailableCount: 1,
      };

      const strictOpening =
        routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence({
          expectedTargetLocationId: "tea-house",
          samples,
        });
      assert.equal(strictOpening.fragmentCount, 1);
      assert.equal(strictOpening.openingSegment.samples.length, 1);
      recoverySession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      recoverySession.screencast.routeRecorderGeneration = 2;
      recoverySession.screencast.routeSampleArchive = [samples[0]];
      recoverySession.screencast.routeFrameArchive = [openingFrame];
      recoverySession.screencast.routeFrameHistory = [];
      recoverySession.waitForAutoplayScreencastFrame = async () => laterFrame;
      recoverySession.sampleAutoplayRouteCaptureRecorder = async () => null;
      recoverySession.readOrRearmAutoplayRouteCaptureRecorder = async () =>
        recorder;
      let failureClassificationCount = 0;
      recoverySession.classifyAutoplayRouteCaptureSampleFailure = async () => {
        failureClassificationCount += 1;
        return "route-unavailable";
      };

      const recoveredWindow =
        await recoverySession.captureAutoplayScreencastRouteFrameWindow({
          afterSequence: 774,
          beforeProbe: samples[2],
          expectedTargetLocationId: "tea-house",
          label: "attempt-1 ended opening route",
          timeoutMs: 1_000,
        });
      assert.ok(recoveredWindow);
      assert.equal(
        recoveredWindow.endedRouteRecovery,
        "retained-legal-post-frame-sample",
      );
      assert.equal(recoveredWindow.afterProbe.route.progress, 0.767);
      assert.equal(failureClassificationCount, 0);
      assert.equal(
        recoverySession.screencast.routeFrameWindowRejections.length,
        0,
      );
      assert.equal(recoverySession.autoplayRouteFrameWindows().length, 1);
      assert.equal(recoverySession.autoplayRouteCaptureSamples().length, 1);
      assert.equal(
        recoverySession.autoplayRouteCaptureSamples(recorder).length,
        samples.length,
        "The final selector must retain the recorder samples that legally bracket the recovered frame.",
      );

      const validateFrame = ({ frame, paintProbe }) => ({
        buffer: Buffer.from(frame.data, "base64"),
        height: 375,
        paintProbe,
        textPaint: {},
        width: 819,
      });
      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          archivedFrames: recoverySession.autoplayRouteArchivedFrames(),
          expectedTargetLocationId: "tea-house",
          frames: recoverySession.autoplayRouteFrameHistory(),
          label: "attempt-1 recovered opening route",
          recordedWindows: recoverySession.autoplayRouteFrameWindows(),
          samples: recoverySession.autoplayRouteCaptureSamples(recorder),
          validateFrame,
          validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
            assert.notDeepEqual(afterBuffer, beforeBuffer);
            return { hudPixelDifferenceRatio: 0 };
          },
        });
      assert.deepEqual(
        [trajectory.start.frame.sequence, trajectory.mid.frame.sequence],
        [774, 775],
      );
      assert.ok(
        recordedRoutePolicy.autoplayRecordedRouteWindowsHaveDistinctProgress(
          trajectory.start,
          trajectory.mid,
        ),
      );

      const expectInsufficientEvidence = ({
        frames = [openingFrame],
        mutatedSamples = samples,
        windows = [recoveredWindow],
      } = {}) =>
        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              archivedFrames: frames,
              expectedTargetLocationId: "tea-house",
              frames,
              label: "attempt-1 rejected opening route",
              recordedWindows: windows,
              samples: mutatedSamples,
              validateFrame,
              validateStableFramePair: () => ({}),
            }),
          /did not contain two distinct legal rendered positions/,
        );
      expectInsufficientEvidence({ windows: [] });
      expectInsufficientEvidence({
        windows: [
          {
            ...recoveredWindow,
            frame: { ...recoveredWindow.frame, data: openingFrame.data },
          },
        ],
      });
      expectInsufficientEvidence({
        mutatedSamples: samples.map((sample, index) =>
          index === samples.length - 1
            ? { ...sample, route: { ...sample.route, legal: false } }
            : sample,
        ),
      });
      expectInsufficientEvidence({
        mutatedSamples: samples.map((sample, index) =>
          index === samples.length - 1
            ? {
                ...sample,
                route: {
                  ...sample.route,
                  worldPath: [
                    { x: 331, y: 688 },
                    { x: 1_338, y: 620 },
                  ],
                },
              }
            : sample,
        ),
      });
      await recoverySession.stopAutoplayScreencast();
    },
  );

  await t.test(
    "late route attachment prefers dense screencast before canvas fallback",
    async () => {
      const startedAt = 1_785_897_703_443;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05 LATE MORNING" }],
        stableRegions: [
          { surface: "hud", text: "DAY 1 11:05 LATE MORNING" },
        ],
        viewport: { height: 625, width: 1_365 },
      };
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 10, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 884, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sampleAt = (
        progress,
        offsetMs,
        {
          generation = 2,
          hud = "DAY 1 11:05 LATE MORNING",
          previousTickAtEpochMs = null,
          tickCount = 1,
        } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        recorderParseErrorCount: 0,
        recorderPreviousTickAtEpochMs: previousTickAtEpochMs,
        recorderRejectedCount: 847,
        recorderTickCount: tickCount,
        recorderUnavailableCount: 39,
        route: { ...route, progress },
        source: "movement-probe-recorder",
      });
      const frameAt = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
        source: "screencast",
      });
      const terminalSamples = [
        sampleAt(0.572, 0, { tickCount: 1_000 }),
        sampleAt(0.575, 2_260, {
          previousTickAtEpochMs: startedAt,
          tickCount: 1_001,
        }),
        sampleAt(0.58, 2_286, {
          previousTickAtEpochMs: startedAt + 2_260,
          tickCount: 1_002,
        }),
      ];
      const terminalFrames = [
        frameAt(792, 18, "late-route-first-frame"),
        frameAt(804, 2_319, "late-route-last-frame"),
      ];
      const validateFrame = ({ frame, paintProbe: framePaintProbe }) => ({
        buffer: Buffer.from(frame.data, "base64"),
        height: 375,
        paintProbe: framePaintProbe,
        textPaint: {},
        width: 819,
      });

      const terminalSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/late-route-terminal-evidence",
        url: "http://127.0.0.1/",
      });
      terminalSession.socket = { destroyed: false, writable: true };
      terminalSession.send = async () => ({});
      await terminalSession.startAutoplayScreencast();
      terminalSession.screencast.startedAtEpochMs = startedAt;
      terminalSession.screencast.routeFrameHistory.push(...terminalFrames);
      terminalSession.archiveAutoplayRouteFrames({
        acceptedCount: terminalSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: terminalSamples,
      });
      assert.equal(
        terminalSession.screencast.routeFrameOpeningSegment.firstProgress,
        0.572,
      );
      assert.equal(
        terminalSession.screencast.routeFrameOpeningSegment.lastProgress,
        0.58,
      );
      assert.equal(
        terminalSession.screencast.routeFrameOpeningSegment
          .stalledRecorderGapCount,
        1,
      );
      assert.deepEqual(
        terminalSession
          .autoplayRouteArchivedFrames()
          .map((frame) => frame.sequence),
        [792, 804],
      );
      assert.equal(
        recordedRoutePolicy.buildAutoplayRecordedRouteFrameCandidates({
          expectedTargetLocationId: "tea-house",
          frames: terminalSession.autoplayRouteArchivedFrames(),
          samples: terminalSamples,
        }).length,
        1,
        "The hosted terminal evidence must remain insufficient rather than weakening the movement requirement.",
      );
      assert.throws(
        () =>
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: terminalSession.autoplayRouteArchivedFrames(),
            expectedTargetLocationId: "tea-house",
            frames: terminalSession.autoplayRouteFrameHistory(),
            label: "late attached ended route",
            samples: terminalSamples,
            validateFrame,
            validateStableFramePair: () => ({}),
          }),
        /did not contain two distinct legal rendered positions/,
      );
      await terminalSession.stopAutoplayScreencast();

      const captureSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/late-route-dense-first",
        url: "http://127.0.0.1/",
      });
      captureSession.socket = { destroyed: false, writable: true };
      captureSession.send = async () => ({});
      await captureSession.startAutoplayScreencast();
      captureSession.screencast.startedAtEpochMs = startedAt;
      captureSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      captureSession.screencast.routeRecorderGeneration = 2;
      const openingSample = terminalSamples[0];
      captureSession.archiveAutoplayRouteFrames({
        acceptedCount: 1,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [openingSample],
      });
      captureSession.screencast.routeFrameHistory.push(terminalFrames[0]);
      captureSession.archiveAutoplayRouteFrames({
        acceptedCount: 1,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [openingSample],
      });
      assert.equal(
        captureSession.autoplayRouteArchiveNeedsProactiveOpeningCapture(
          openingSample,
        ),
        true,
      );
      captureSession.autoplayDenseOpeningCaptureTimeoutMs = (frameTimeoutMs) => {
        assert.equal(frameTimeoutMs, 60);
        return 50;
      };
      routeCompositingSleepFixture = async (minimumEpochMs) => {
        assert.equal(minimumEpochMs, startedAt + 125);
      };
      const freshSamples = [sampleAt(0.75, 450), sampleAt(0.82, 700)];
      captureSession.sampleAutoplayRouteCaptureRecorder = async () =>
        freshSamples.shift() ?? null;
      let directCaptureCount = 0;
      captureSession.captureAutoplayScreencastRouteFrameWindow = async ({
        beforeProbe,
        expectedTargetLocationId,
        label,
        timeoutMs,
      }) => {
        const captureIndex = directCaptureCount;
        directCaptureCount += 1;
        if (captureIndex === 0) {
          assert.match(label, /dense-before-canvas$/);
          assert.equal(timeoutMs, 50);
        } else {
          assert.doesNotMatch(label, /dense-before-canvas$/);
          assert.equal(timeoutMs, 60);
        }
        const afterProbe =
          captureIndex === 0
            ? sampleAt(0.7, 250)
            : sampleAt(0.95, 950);
        const frame =
          captureIndex === 0
            ? frameAt(793, 150, "dense-late-route-start")
            : frameAt(794, 850, "dense-late-route-mid");
        const recorderSamples = [
          openingSample,
          sampleAt(0.7, 250),
          sampleAt(0.75, 450),
          sampleAt(0.82, 700),
          afterProbe,
        ].filter(
          (sample, index, samples) =>
            samples.findIndex(
              (candidate) =>
                candidate.capturedAtEpochMs === sample.capturedAtEpochMs,
            ) === index,
        );
        captureSession.screencast.routeFrameHistory.push(frame);
        const recorder = {
          acceptedCount: recorderSamples.length,
          expectedTargetLocationId,
          generation: 2,
          samples: recorderSamples,
        };
        captureSession.archiveAutoplayRouteFrames(recorder);
        const archived = captureSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: { afterProbe, beforeProbe, frame },
          recorder,
        });
        return archived;
      };
      let canvasFallbackCount = 0;
      proactiveRouteCaptureFixture = async () => {
        canvasFallbackCount += 1;
        throw new Error("Timed out waiting for Runtime.evaluate");
      };

      try {
        await captureSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSample,
          expectedTargetLocationId: "tea-house",
          label: "late-route-dense-first",
        });
        assert.equal(directCaptureCount, 2);
        assert.equal(
          canvasFallbackCount,
          0,
          "A viable dense screencast opportunity must precede the blocking Runtime.evaluate fallback.",
        );
        assert.equal(captureSession.autoplayRouteFrameWindows().length, 2);
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: captureSession.autoplayRouteArchivedFrames(),
            expectedTargetLocationId: "tea-house",
            frames: captureSession.autoplayRouteFrameHistory(),
            label: "late attached dense opening route",
            recordedWindows: captureSession.autoplayRouteFrameWindows(),
            samples: captureSession.autoplayRouteCaptureSamples(),
            validateFrame,
            validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
              assert.notDeepEqual(afterBuffer, beforeBuffer);
              return { hudPixelDifferenceRatio: 0 };
            },
          });
        assert.deepEqual(
          [trajectory.start.frame.sequence, trajectory.mid.frame.sequence],
          [793, 794],
        );
        assert.ok(
          trajectory.mid.beforeProbe.route.progress -
            trajectory.start.afterProbe.route.progress >=
            0.1,
        );
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        routeCompositingSleepFixture = (minimumEpochMs) =>
          sleepUntilEpochMs(minimumEpochMs, {
            sleepFor: (milliseconds) =>
              new Promise((resolve) => setTimeout(resolve, milliseconds)),
          });
        await captureSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "short opening routes archive two truthful visual windows despite sparse screencast timing",
    async () => {
  const sparseSession = new CdpSession({
    browser: null,
    outputDir: "/tmp",
    pageWsUrl: "ws://127.0.0.1:9222/devtools/page/sparse-route",
    url: "http://127.0.0.1/",
  });
  sparseSession.socket = { destroyed: false, writable: true };
  sparseSession.send = async () => ({});
  await sparseSession.startAutoplayScreencast();
  const sparseStartedAt = sparseSession.screencast.startedAtEpochMs;
  const sparseSample = (
    progress,
    offsetMs,
    recorderGeneration = 2,
    {
      hud = "DAY 1 11:05",
      previousTickOffsetMs = null,
      tickCount = Math.max(1, Math.round(offsetMs / 50)),
    } = {},
  ) => ({
    capturedAtEpochMs: sparseStartedAt + offsetMs,
    capturedAtMonotonicMs: offsetMs,
    paintProbe: {
      regions: [{ surface: "hud", text: hud }],
      stableRegions: [{ surface: "hud", text: hud }],
      viewport: { height: 625, width: 1365 },
    },
    recorderGeneration,
    recorderParseErrorCount: 0,
    recorderPreviousTickAtEpochMs:
      previousTickOffsetMs === null
        ? null
        : sparseStartedAt + previousTickOffsetMs,
    recorderRejectedCount: 0,
    recorderTickCount: tickCount,
    recorderUnavailableCount: 0,
    route: {
      active: true,
      durationMs: 5_000,
      legal: true,
      progress,
      reachesDestination: true,
      sampledPointsLegal: true,
      targetLocationId: "tea-house",
      tilePathLength: 15,
      visualObstaclesClear: true,
      worldPathLength: 16,
    },
    source: "movement-probe-recorder",
  });
  const sparsePeriodicSamples = [
    sparseSample(0.004, 0, 1, { tickCount: 1 }),
    sparseSample(0.01, 100, 2, { tickCount: 1 }),
    sparseSample(0.482, 2_471, 2, {
      previousTickOffsetMs: 100,
      tickCount: 2,
    }),
    sparseSample(0.764, 3_881, 2, {
      hud: "DAY 1 11:23",
      previousTickOffsetMs: 3_661,
      tickCount: 5,
    }),
  ];
  sparseSession.screencast.routeRecorderExpectedTargetLocationId =
    "tea-house";
  sparseSession.screencast.routeRecorderGeneration = 1;
  sparseSession.screencast.routeSampleArchive = [sparsePeriodicSamples[0]];
  let rearmRequest = null;
  let rearmedRecorder = null;
  sparseSession.readAutoplayRouteCaptureRecorder = async () =>
    rearmedRecorder;
  sparseSession.startAutoplayRouteCaptureRecorder = async (request) => {
    rearmRequest = request;
    sparseSession.screencast.routeRecorderGeneration = request.generation;
    rearmedRecorder = {
      acceptedCount: 0,
      expectedTargetLocationId: request.expectedTargetLocationId,
      generation: request.generation,
      lastObservedRoute: null,
      restartReason: request.restartReason,
      samples: [],
      status: "active",
    };
    return rearmedRecorder;
  };
  const recoveredRecorder =
    await sparseSession.readOrRearmAutoplayRouteCaptureRecorder({
      expectedTargetLocationId: "tea-house",
      label: "sparse-route-context-reset",
    });
  assert.equal(recoveredRecorder.generation, 2);
  assert.equal(rearmRequest.expectedTargetLocationId, "tea-house");
  assert.equal(rearmRequest.restartReason, "execution-context-recorder-missing");
  assert.equal(sparseSession.screencast.routeRecorderRestartCount, 1);
  assert.deepEqual(sparseSession.screencast.routeRecorderRestarts, [
    {
      atEpochMs:
        sparseSession.screencast.routeRecorderRestarts[0].atEpochMs,
      generation: 2,
      openingSampleCount: 1,
      openingWindowCount: 0,
      reason: "execution-context-recorder-missing",
      status: "active",
      targetLocationId: "tea-house",
    },
  ]);
  sparseSession.handleAutoplayScreencastFrame({
    data: "only-passive-route-frame",
    metadata: { timestamp: (sparseStartedAt + 900) / 1_000 },
    sessionId: 31,
  });
  assert.equal(
    sparseSession.autoplayRouteFrameHistory().length,
    1,
    "The sparse CI fixture must begin with only one passive screencast frame.",
  );
  const startBefore = sparsePeriodicSamples[1];
  const startAfter = sparsePeriodicSamples[2];
  const midBefore = sparseSample(0.6, 3_061, 2, {
    previousTickOffsetMs: 2_471,
    tickCount: 3,
  });
  const midAfter = sparseSample(0.72, 3_661, 2, {
    previousTickOffsetMs: 3_061,
    tickCount: 4,
  });
  const recorderWithDirectBoundaries = {
    acceptedCount: 5,
    expectedTargetLocationId: "tea-house",
    generation: 2,
    restartReason: "execution-context-recorder-missing",
    samples: [
      ...sparsePeriodicSamples.slice(1),
      midBefore,
      midAfter,
    ].sort((left, right) => left.capturedAtEpochMs - right.capturedAtEpochMs),
  };
  rearmedRecorder = recorderWithDirectBoundaries;
  sparseSession.archiveAutoplayRouteFrames(recorderWithDirectBoundaries);
  assert.equal(
    sparseSession.screencast.routeFrameOpeningSegment.stalledRecorderGapCount,
    1,
    "A 2.371s gap may remain in the opening segment only when adjacent recorder ticks and route timing prove renderer starvation.",
  );
  const unprovenSparseGapSegments =
    routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
      expectedTargetLocationId: "tea-house",
      samples: [
        startBefore,
        {
          ...startAfter,
          recorderRejectedCount: 1,
        },
      ],
    });
  assert.equal(unprovenSparseGapSegments.length, 2);
  assert.deepEqual(unprovenSparseGapSegments[1].boundaryReasons, [
    "sample-gap",
  ]);
  assert.equal(sparseSession.screencast.routeFrameObservedSegmentCount, 1);
  assert.equal(sparseSession.screencast.routeFrameArchiveFrozen, false);
  assert.equal(
    sparseSession.screencast.routeFrameOpeningSegment.lastProgress,
    0.764,
    "A HUD clock update must extend the unchanged legal route segment.",
  );
  assert.deepEqual(
    sparseSession.screencast.routeFrameOpeningSegment.recorderGenerations,
    [1, 2],
    "The opening segment must preserve truthful samples from both recorder generations.",
  );
  const proactiveFrame = (sequence, offsetMs, pixels) => ({
    data: Buffer.from(pixels).toString("base64"),
    metadata: {
      source: "proactive-route-screenshot",
      timestamp: (sparseStartedAt + offsetMs) / 1_000,
    },
    sequence,
    source: "proactive-route-screenshot",
  });
  const sparseStartWindow = {
    afterProbe: startAfter,
    beforeProbe: startBefore,
    candidateFrame: proactiveFrame(1_001, 1_100, "start-candidate-pixels"),
    confirmationFrame: proactiveFrame(
      1_002,
      1_225,
      "start-confirmation-pixels",
    ),
  };
  const sparseMidWindow = {
    afterProbe: midAfter,
    beforeProbe: midBefore,
    candidateFrame: proactiveFrame(1_003, 3_200, "mid-candidate-pixels"),
    confirmationFrame: proactiveFrame(
      1_004,
      3_325,
      "mid-confirmation-pixels",
    ),
  };
  assert.ok(
    sparseSession.archiveAutoplayRouteFrameWindow({
      expectedTargetLocationId: "tea-house",
      recordedWindow: sparseStartWindow,
      recorder: recorderWithDirectBoundaries,
    }),
  );
  assert.ok(
    sparseSession.archiveAutoplayRouteFrameWindow({
      expectedTargetLocationId: "tea-house",
      recordedWindow: sparseMidWindow,
      recorder: recorderWithDirectBoundaries,
    }),
  );
  assert.deepEqual(
    sparseSession
      .autoplayRouteFrameWindows()
      .map((window) => window.confirmationFrame.sequence),
    [1_002, 1_004],
    "A short opening route must retain two distinct proactive visual windows even with one passive frame.",
  );
  assert.equal(
    sparseSession.autoplayRouteFrameWindows()[0].afterProbe.route.progress,
    0.482,
  );
  assert.equal(
    sparseSession.autoplayRouteFrameWindows()[1].beforeProbe.route.progress,
    0.6,
  );
  assert.notEqual(
    sparseSession.autoplayRouteFrameWindows()[0].confirmationFrame.data,
    sparseSession.autoplayRouteFrameWindows()[1].confirmationFrame.data,
    "The two proactive windows must contain genuinely distinct visual payloads.",
  );
  assert.equal(sparseSession.autoplayRouteFrameWindows().length, 2);
  assert.ok(sparseSession.screencast.routeSampleArchive.length <= 16);
  assert.ok(sparseSession.screencast.routeRecorderRestarts.length <= 4);
  await sparseSession.stopAutoplayScreencast();
    },
  );

  await t.test(
    "bounded same-identity sparse cadence preserves opening rendered frames",
    async () => {
      const cadenceSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/sparse-cadence",
        url: "http://127.0.0.1/",
      });
      cadenceSession.socket = { destroyed: false, writable: true };
      cadenceSession.send = async () => ({});
      await cadenceSession.startAutoplayScreencast();
      const startedAt = cadenceSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const routeDurationMs = 5_040;
      const sample = (
        progress,
        offsetMs,
        {
          generation = 2,
          acceptedPaintProbe = paintProbe,
          previousTickOffsetMs = null,
          rejectedCount = 0,
          routeOverrides = {},
          tickCount,
          unavailableCount = 0,
        },
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: acceptedPaintProbe,
        recorderGeneration: generation,
        recorderParseErrorCount: 0,
        recorderPreviousTickAtEpochMs:
          previousTickOffsetMs === null
            ? null
            : startedAt + previousTickOffsetMs,
        recorderRejectedCount: rejectedCount,
        recorderTickCount: tickCount,
        recorderUnavailableCount: unavailableCount,
        route: {
          active: true,
          durationMs: routeDurationMs,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
          ...routeOverrides,
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.003, 0, { tickCount: 1 }),
        sample(0.27, 1_627, {
          previousTickOffsetMs: 0,
          tickCount: 2,
        }),
        sample(0.594, 4_542, {
          previousTickOffsetMs: 1_627,
          tickCount: 3,
        }),
        sample(0.75, 5_200, {
          previousTickOffsetMs: 4_542,
          tickCount: 4,
        }),
      ];
      const continuousSegments =
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: openingSamples,
        });
      assert.equal(continuousSegments.length, 1);
      assert.equal(continuousSegments[0].samples.length, 4);
      assert.equal(continuousSegments[0].stalledRecorderGapCount, 1);

      const excessiveSparseOffsetMs =
        1_627 +
        Math.ceil(
          (1 - 0.27) * routeDurationMs +
            Math.max(250, routeDurationMs * 0.03),
        ) +
        1;
      const boundaryFor = (candidate) =>
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: openingSamples.slice(0, 2).concat(candidate),
        })[1]?.boundaryReasons ?? [];
      assert.deepEqual(
        boundaryFor(
          sample(0.594, 4_542, {
            previousTickOffsetMs: 1_627,
            routeOverrides: {
              worldPath: [
                { x: 331, y: 688 },
                { x: 1_400, y: 700 },
              ],
            },
            tickCount: 3,
          }),
        ),
        ["sample-gap", "path-change"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.1, 4_542, {
            previousTickOffsetMs: 1_627,
            tickCount: 3,
          }),
        ),
        ["sample-gap", "progress-reset"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.594, excessiveSparseOffsetMs, {
            previousTickOffsetMs: 1_627,
            tickCount: 3,
          }),
        ),
        ["sample-gap"],
        "A gap beyond remaining route duration plus timing tolerance must split.",
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.594, 4_542, {
            generation: 3,
            previousTickOffsetMs: 1_627,
            tickCount: 3,
          }),
        ),
        ["sample-gap"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.594, 4_542, {
            acceptedPaintProbe: {
              regions: [],
              stableRegions: [],
              viewport: paintProbe.viewport,
            },
            previousTickOffsetMs: 1_627,
            tickCount: 3,
          }),
        ),
        ["sample-gap"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.594, 4_542, {
            previousTickOffsetMs: 3_000,
            rejectedCount: 1,
            tickCount: 4,
          }),
        ),
        ["sample-gap"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.594, 4_542, {
            previousTickOffsetMs: 3_000,
            tickCount: 4,
            unavailableCount: 1,
          }),
        ),
        ["sample-gap"],
      );
      assert.deepEqual(
        boundaryFor(
          sample(0.95, 4_542, {
            previousTickOffsetMs: 1_627,
            tickCount: 3,
          }),
        ),
        ["sample-gap"],
        "Route progress that outruns elapsed time must not bridge a sparse gap.",
      );

      const frame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
      });
      cadenceSession.screencast.routeFrameSampleCount = 1;
      cadenceSession.screencast.routeFrameHistory.push(
        frame(1, 800, "sparse-opening-position-a"),
        frame(2, 4_800, "sparse-opening-position-b"),
      );
      cadenceSession.archiveAutoplayRouteFrames({
        acceptedCount: openingSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples,
      });
      assert.equal(cadenceSession.screencast.routeFrameArchiveFrozen, false);
      assert.equal(cadenceSession.screencast.routeFrameArchive.length, 2);
      assert.equal(cadenceSession.screencast.routeSampleArchive.length, 4);
      assert.equal(
        cadenceSession.screencast.routeFrameOpeningSegment.stalledRecorderGapCount,
        1,
      );

      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: cadenceSession.autoplayRouteFrameHistory(),
          label: "bounded sparse-cadence opening route",
          recordedWindows: cadenceSession.autoplayRouteFrameWindows(),
          samples: cadenceSession.autoplayRouteCaptureSamples(),
          validateFrame: ({ frame: renderedFrame, paintProbe: acceptedPaintProbe }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            height: 625,
            paintProbe: acceptedPaintProbe,
            textPaint: {},
            width: 1365,
          }),
          validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
        });
      assert.equal(trajectory.start.frame.sequence, 1);
      assert.equal(trajectory.mid.frame.sequence, 2);
      assert.equal(trajectory.start.afterProbe.route.progress, 0.27);
      assert.equal(trajectory.mid.beforeProbe.route.progress, 0.594);
      assert.equal(
        cadenceSession.acceptAutoplayRouteRenderedFrameTrajectory(trajectory),
        true,
      );
      await cadenceSession.stopAutoplayScreencast();
    },
  );

  await t.test(
    "opening evidence joins only bounded same-identity startup fragments",
    () => {
      const startedAt = 1_750_000_000_000;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        progress: 0,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (
        progress,
        offsetMs,
        {
          generation = 2,
          hud = "DAY 1 11:05",
          monotonicOffsetMs = offsetMs,
          previousOffsetMs = null,
          routeOverrides = {},
          tickCount,
          unavailableCount = 0,
        } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: monotonicOffsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        recorderParseErrorCount: 0,
        recorderPreviousTickAtEpochMs:
          previousOffsetMs === null
            ? null
            : startedAt + previousOffsetMs,
        recorderRejectedCount: 0,
        recorderTickCount: tickCount,
        recorderUnavailableCount: unavailableCount,
        route: { ...route, progress, ...routeOverrides },
        source: "movement-probe-recorder",
      });
      const fragmentedSamples = [
        sample(0.003, 0, { tickCount: 1 }),
        sample(0.008, 2_200, {
          previousOffsetMs: 0,
          tickCount: 2,
          unavailableCount: 1,
        }),
        sample(0.6, 3_500, {
          previousOffsetMs: 2_200,
          tickCount: 3,
          unavailableCount: 1,
        }),
        sample(0.954, 4_800, {
          previousOffsetMs: 3_500,
          tickCount: 4,
          unavailableCount: 1,
        }),
      ];
      const rawSegments =
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: fragmentedSamples,
        });
      assert.equal(rawSegments.length, 2);
      assert.deepEqual(rawSegments[1].boundaryReasons, ["sample-gap"]);

      const openingEvidence =
        routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence({
          expectedTargetLocationId: "tea-house",
          samples: fragmentedSamples,
        });
      assert.equal(openingEvidence.fragmentCount, 2);
      assert.equal(openingEvidence.openingSegment.samples.length, 4);

      const incrementalArchive = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/fragmented-opening-route",
        url: "http://127.0.0.1/",
      });
      incrementalArchive.screencast = {
        routeFrameArchive: [],
        routeFrameArchiveFrozen: false,
        routeFrameArchivedLastSampleAtEpochMs: null,
        routeFrameArchivedSampleCount: 0,
        routeFrameHistory: [],
        routeFrameObservedSegmentCount: 0,
        routeFrameOpeningSegment: null,
        routeSampleArchive: [],
      };
      incrementalArchive.archiveAutoplayRouteFrames({
        expectedTargetLocationId: "tea-house",
        samples: fragmentedSamples.slice(0, 1),
      });
      incrementalArchive.archiveAutoplayRouteFrames({
        expectedTargetLocationId: "tea-house",
        samples: fragmentedSamples,
      });
      assert.equal(incrementalArchive.screencast.routeFrameArchiveFrozen, false);
      assert.equal(incrementalArchive.screencast.routeSampleArchive.length, 4);
      assert.equal(
        incrementalArchive.screencast.routeFrameOpeningSegment.lastProgress,
        0.954,
      );
      assert.equal(
        incrementalArchive.screencast.routeFrameObservedSegmentCount,
        2,
      );

      const frame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
      });
      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: [
            frame(1, 100, "startup-route-position-a"),
            frame(2, 3_650, "startup-route-position-b"),
          ],
          label: "startup-starved opening route",
          samples: fragmentedSamples,
          validateFrame: ({
            frame: renderedFrame,
            paintProbe: acceptedPaintProbe,
          }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            height: 625,
            paintProbe: acceptedPaintProbe,
            textPaint: {},
            width: 1365,
          }),
          validateStableFramePair: () => ({
            hudPixelDifferenceRatio: 0,
          }),
        });
      assert.equal(trajectory.start.frame.sequence, 1);
      assert.equal(trajectory.mid.frame.sequence, 2);

      const ciStartedAt = 1_785_513_475_087;
      const ciSample = (progress, offsetMs, options = {}) => {
        const captured = sample(progress, offsetMs, options);
        return {
          ...captured,
          capturedAtEpochMs: ciStartedAt + offsetMs,
          recorderPreviousTickAtEpochMs:
            options.previousOffsetMs === undefined
              ? null
              : ciStartedAt + options.previousOffsetMs,
        };
      };
      const ciFragmentedSamples = [
        ciSample(0.003, 0, { tickCount: 1 }),
        ciSample(0.128, 18, { previousOffsetMs: 0, tickCount: 2 }),
        ciSample(0.253, 36, { previousOffsetMs: 18, tickCount: 3 }),
        ciSample(0.253, 3_024, {
          previousOffsetMs: 36,
          tickCount: 22,
        }),
        ciSample(0.253, 3_028, {
          previousOffsetMs: 3_024,
          tickCount: 23,
        }),
        ciSample(0.853, 5_200, {
          previousOffsetMs: 3_028,
          tickCount: 42,
        }),
        ciSample(0.853, 5_201, {
          previousOffsetMs: 5_200,
          tickCount: 43,
        }),
        ciSample(0.854, 5_202, {
          previousOffsetMs: 5_201,
          tickCount: 44,
        }),
      ];
      const ciRawSegments =
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: ciFragmentedSamples,
        });
      assert.equal(ciRawSegments.length, 3);
      assert.deepEqual(
        ciRawSegments.map((segment) => segment.boundaryReasons),
        [[], ["sample-gap"], ["sample-gap"]],
      );

      const ciOpeningEvidence =
        routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence({
          expectedTargetLocationId: "tea-house",
          samples: ciFragmentedSamples,
        });
      assert.equal(ciOpeningEvidence.fragmentCount, 3);
      assert.equal(ciOpeningEvidence.openingSegment.samples.length, 8);

      const ciFrame = (sequence, capturedAtEpochMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: capturedAtEpochMs / 1_000 },
        sequence,
      });
      const ciFrames = [
        ciFrame(101, 1_785_513_475_112.783, "ci-route-position-too-early"),
        ciFrame(102, 1_785_513_478_185.051, "ci-route-position-mid"),
      ];
      assert.deepEqual(
        recordedRoutePolicy
          .buildAutoplayRecordedRouteFrameCandidates({
            expectedTargetLocationId: "tea-house",
            frames: ciFrames,
            openingSegment: ciOpeningEvidence.openingSegment,
            samples: ciOpeningEvidence.samples,
          })
          .map((candidate) => candidate.frame.sequence),
        [102],
        "The same-route fragment join must recover the bracketed CI frame without weakening the opening-frame compositing settle rule.",
      );

      const ciTrajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: [
            ciFrame(100, ciStartedAt + 150, "ci-route-position-start"),
            ...ciFrames,
          ],
          label: "same-route sample-fragment race",
          samples: ciFragmentedSamples,
          validateFrame: ({
            frame: renderedFrame,
            paintProbe: acceptedPaintProbe,
          }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            height: 625,
            paintProbe: acceptedPaintProbe,
            textPaint: {},
            width: 1_365,
          }),
          validateStableFramePair: () => ({
            hudPixelDifferenceRatio: 0,
          }),
        });
      assert.equal(ciTrajectory.start.frame.sequence, 100);
      assert.equal(ciTrajectory.mid.frame.sequence, 102);

      const ciFragmentCountFor = (replacement) =>
        routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence({
          expectedTargetLocationId: "tea-house",
          samples: [...ciFragmentedSamples.slice(0, 5), replacement],
        }).fragmentCount;
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_200, {
            previousOffsetMs: 3_028,
            routeOverrides: {
              worldPath: [
                { x: 331, y: 688 },
                { x: 1_400, y: 700 },
              ],
            },
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_200, {
            hud: "DAY 1 11:10",
            previousOffsetMs: 3_028,
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_200, {
            generation: 3,
            previousOffsetMs: 3_028,
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_200, {
            previousOffsetMs: 3_028,
            routeOverrides: { targetLocationId: "repair-stall" },
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.2, 5_200, {
            previousOffsetMs: 3_028,
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_200, {
            monotonicOffsetMs: 4_800,
            previousOffsetMs: 3_028,
            tickCount: 42,
          }),
        ),
        2,
      );
      assert.equal(
        ciFragmentCountFor(
          ciSample(0.853, 5_400, {
            previousOffsetMs: 3_028,
            tickCount: 42,
          }),
        ),
        2,
      );

      const fragmentCountFor = (replacement) =>
        routeSegmentsPolicy.buildAutoplayOpeningRouteEvidence({
          expectedTargetLocationId: "tea-house",
          samples: [fragmentedSamples[0], replacement],
        }).fragmentCount;
      assert.equal(
        fragmentCountFor(
          sample(0.008, 2_200, {
            previousOffsetMs: 0,
            routeOverrides: {
              worldPath: [
                { x: 331, y: 688 },
                { x: 1_400, y: 700 },
              ],
            },
            tickCount: 2,
            unavailableCount: 1,
          }),
        ),
        1,
      );
      assert.equal(
        fragmentCountFor(
          sample(0.008, 2_200, {
            hud: "DAY 1 11:10",
            previousOffsetMs: 0,
            tickCount: 2,
            unavailableCount: 1,
          }),
        ),
        1,
      );
      assert.equal(
        fragmentCountFor(
          sample(0, 2_200, {
            previousOffsetMs: 0,
            tickCount: 2,
            unavailableCount: 1,
          }),
        ),
        1,
      );
      assert.equal(
        fragmentCountFor(
          sample(0.008, 6_000, {
            previousOffsetMs: 0,
            tickCount: 2,
            unavailableCount: 1,
          }),
        ),
        1,
      );
      assert.equal(
        fragmentCountFor(
          sample(0.008, 2_200, {
            generation: 3,
            previousOffsetMs: 0,
            tickCount: 2,
            unavailableCount: 1,
          }),
        ),
        1,
      );
    },
  );

  await t.test(
    "coalesced visual capture recovers five legal samples with one opening screencast frame",
    { skip: "Superseded by dense direct-screencast route recovery." },
    async () => {
      const startupSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/startup-route",
        url: "http://127.0.0.1/",
      });
      startupSession.socket = { destroyed: false, writable: true };
      startupSession.send = async () => ({});
      await startupSession.startAutoplayScreencast();
      const startedAt = startupSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const progressValues = [0.003, 0.244, 0.5, 0.75, 0.962];
      const offsets = [300, 500, 700, 900, 1_100];
      const openingSamples = progressValues.map((progress, index) => ({
        capturedAtEpochMs: startedAt + offsets[index],
        capturedAtMonotonicMs: offsets[index],
        paintProbe,
        recorderGeneration: 2,
        recorderParseErrorCount: 0,
        recorderPreviousTickAtEpochMs:
          index === 0 ? startedAt - 50 : startedAt + offsets[index - 1],
        recorderRejectedCount: 0,
        recorderTickCount: 22 + index,
        recorderUnavailableCount: 21,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      }));
      const queuedSamples = [null, ...openingSamples.slice(1, 4)];
      let rearmCount = 0;
      startupSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      startupSession.screencast.routeRecorderGeneration = 1;
      startupSession.sampleAutoplayRouteCaptureRecorder = async () =>
        queuedSamples.shift() ?? null;
      startupSession.readOrRearmAutoplayRouteCaptureRecorder = async ({
        expectedTargetLocationId,
      }) => {
        rearmCount += 1;
        startupSession.screencast.routeRecorderGeneration = 2;
        return {
          acceptedCount: 1,
          expectedTargetLocationId,
          generation: 2,
          lastObservedRoute: {
            active: true,
            progress: openingSamples[0].route.progress,
            targetLocationId: expectedTargetLocationId,
          },
          restartReason: "execution-context-recorder-missing",
          samples: [openingSamples[0]],
          status: "active",
          unavailableCount: 21,
        };
      };
      let releaseFirstCapture;
      const firstCaptureHeld = new Promise((resolve) => {
        releaseFirstCapture = resolve;
      });
      let markFirstCaptureStarted;
      const firstCaptureStarted = new Promise((resolve) => {
        markFirstCaptureStarted = resolve;
      });
      let proactiveCaptureCount = 0;
      const proactiveFrame = (sequence, capturedAtEpochMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: {
          source: "proactive-route-screenshot",
          timestamp: capturedAtEpochMs / 1_000,
        },
        sequence,
        source: "proactive-route-screenshot",
      });
      proactiveRouteCaptureFixture = async ({
        beforeProbe,
        expectedTargetLocationId,
        session,
      }) => {
        const captureIndex = proactiveCaptureCount;
        assert.equal(captureIndex, 0);
        proactiveCaptureCount += 1;
        markFirstCaptureStarted();
        await firstCaptureHeld;
        const afterProbe = openingSamples[2];
        const recordedWindow = {
          afterProbe,
          beforeProbe,
          frame: proactiveFrame(
            1_001,
            beforeProbe.capturedAtEpochMs + 125,
            "proactive-position",
          ),
        };
        const recorder = {
          acceptedCount: 3,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples.slice(0, 3),
        };
        session.archiveAutoplayRouteFrames(recorder);
        return session.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow,
          recorder,
        });
      };
      let resumedScreencastCaptureCount = 0;
      startupSession.captureAutoplayScreencastRouteFrameWindow = async ({
        afterSequence,
        beforeProbe,
        expectedTargetLocationId,
      }) => {
        assert.equal(afterSequence, 1_001);
        resumedScreencastCaptureCount += 1;
        const afterProbe = openingSamples[4];
        const recorder = {
          acceptedCount: 5,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples,
        };
        startupSession.archiveAutoplayRouteFrames(recorder);
        return startupSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe,
            beforeProbe,
            frame: {
              data: Buffer.from("resumed-screencast-position").toString(
                "base64",
              ),
              metadata: {
                timestamp:
                  (beforeProbe.capturedAtEpochMs + 125) / 1_000,
              },
              sequence: 1_002,
            },
          },
          recorder,
        });
      };

      const waitFor = async (predicate, message) => {
        for (let attempt = 0; attempt < 200; attempt += 1) {
          if (predicate()) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        assert.fail(message);
      };
      try {
        startupSession.handleAutoplayScreencastFrame({
          data: "pre-opening-frame",
          metadata: {
            timestamp: (startedAt + 100) / 1_000,
          },
          sessionId: 50,
        });
        await waitFor(
          () => startupSession.screencast.routeFrameSampleCount === 1,
          "The first rendered-frame route sample was not retained.",
        );
        await firstCaptureStarted;
        assert.equal(startupSession.autoplayRouteFrameWindows().length, 0);

        startupSession.handleAutoplayScreencastFrame({
          data: "only-opening-route-frame",
          metadata: {
            timestamp: (startedAt + 600) / 1_000,
          },
          sessionId: 51,
        });
        await waitFor(
          () => startupSession.screencast.routeFrameSampleCount === 2,
          "The second rendered-frame route sample was not retained.",
        );
        releaseFirstCapture();
        await waitFor(
          () => startupSession.autoplayRouteFrameWindows().length === 2,
          "The coalesced pipeline did not pair the screenshot with a resumed-screencast position.",
        );

        assert.equal(rearmCount, 1);
        assert.equal(proactiveCaptureCount, 1);
        assert.equal(resumedScreencastCaptureCount, 1);
        assert.equal(startupSession.screencast.routeFrameSampleError, null);
        assert.equal(startupSession.screencast.routeFrameWindowCaptureError, null);
        assert.equal(
          startupSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
        assert.equal(
          startupSession.screencast.routeFrameWindowCaptureAttemptCount,
          2,
        );
        assert.equal(startupSession.screencast.routeFrameArchive.length, 1);
        assert.equal(startupSession.screencast.routeSampleArchive.length, 5);
        assert.ok(startupSession.screencast.routeFrameArchive.length <= 8);
        assert.ok(startupSession.screencast.routeSampleArchive.length <= 16);

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: startupSession.autoplayRouteFrameHistory(),
            label: "five-sample one-frame opening route",
            recordedWindows: startupSession.autoplayRouteFrameWindows(),
            samples: startupSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
              buffer: Buffer.from(frame.data, "base64"),
              paintProbe: framePaintProbe,
              textPaint: {},
            }),
            validateStableFramePair: () => ({}),
          });
        assert.equal(trajectory.start.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "screencast-frame");
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.244);
        assert.equal(trajectory.start.afterProbe.route.progress, 0.5);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.75);
        assert.equal(trajectory.mid.afterProbe.route.progress, 0.962);
        assert.ok(
          trajectory.mid.beforeProbe.route.progress -
            trajectory.start.afterProbe.route.progress >=
            0.1,
        );
        assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);

        startupSession.archiveAutoplayRouteFrames({
          acceptedCount: 6,
          expectedTargetLocationId: "tea-house",
          samples: [
            {
              ...openingSamples.at(-1),
              capturedAtEpochMs: startedAt + 10_000,
              paintProbe: {
                ...paintProbe,
                regions: [{ surface: "hud", text: "DAY 1 11:25" }],
                stableRegions: [{ surface: "hud", text: "DAY 1 11:25" }],
              },
              route: {
                ...openingSamples.at(-1).route,
                durationMs: 840,
                progress: 0.1,
                spaceId: "interior:tea-house",
                tilePath: [
                  { x: 7, y: 4 },
                  { x: 8, y: 3 },
                ],
                worldPath: [
                  { x: 396, y: 236 },
                  { x: 436, y: 196 },
                ],
              },
            },
          ],
        });
        assert.equal(startupSession.screencast.routeFrameArchiveFrozen, true);
        assert.equal(startupSession.screencast.routeSampleArchive.length, 5);
        assert.equal(startupSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          startupSession.screencast.routeFrameOpeningSegment.lastProgress,
          0.962,
        );
      } finally {
        releaseFirstCapture();
        proactiveRouteCaptureFixture = async () => null;
        await startupSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "single-frame positions recover after four loaded-runner window rejections",
    async () => {
      const loadedSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/loaded-route",
        url: "http://127.0.0.1/",
      });
      loadedSession.socket = { destroyed: false, writable: true };
      const commands = [];
      loadedSession.send = async (method, params) => {
        commands.push({ method, params });
        return {};
      };
      await loadedSession.startAutoplayScreencast();
      const startedAt = loadedSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (
        progress,
        offsetMs,
        {
          generation = 2,
          previousOffsetMs = null,
          tickCount,
          routeOverrides = {},
        } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: generation,
        recorderParseErrorCount: 0,
        recorderPreviousTickAtEpochMs:
          previousOffsetMs === null ? null : startedAt + previousOffsetMs,
        recorderRejectedCount: 522,
        recorderTickCount: tickCount,
        recorderUnavailableCount: 45,
        route: { ...route, progress, ...routeOverrides },
        source: "movement-probe-recorder",
      });
      const initialSamples = [
        sample(0.004, 0, { tickCount: 1 }),
        sample(0.25, 600, {
          previousOffsetMs: 0,
          tickCount: 2,
        }),
        sample(0.814, 3_500, {
          previousOffsetMs: 600,
          tickCount: 3,
        }),
      ];
      const finalOpeningSample = sample(0.9, 4_500, {
        previousOffsetMs: 3_500,
        tickCount: 4,
      });
      const openingRecorder = {
        acceptedCount: 21,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        rejectedCount: 522,
        samples: [...initialSamples, finalOpeningSample],
        unavailableCount: 45,
      };
      const frame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: {
          source: "proactive-route-screenshot",
          timestamp: (startedAt + offsetMs) / 1_000,
        },
        sequence,
        source: "proactive-route-screenshot",
      });
      const canvasGeometry = {
        canvas: {
          height: 625,
          index: 0,
          rect: { height: 625, left: 0, top: 0, width: 1365 },
          width: 1365,
        },
        contextType: "webgl",
        crop: { height: 360, width: 640, x: 362, y: 132 },
        renderScale: 1,
        sceneViewport: { height: 625, width: 1365, x: 0, y: 0 },
      };
      const canvasFrame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: {
          capturedAtEpochMs: startedAt + offsetMs,
          contextLost: false,
          defaultFramebuffer: true,
          format: "png",
          geometry: canvasGeometry,
          initialRenderedAtMs: offsetMs - 20,
          renderedAtMs: offsetMs - 1,
          source: "in-page-route-canvas",
          timestamp: (startedAt + offsetMs) / 1_000,
        },
        sequence,
        source: "in-page-route-canvas",
      });
      const arrivedProbe = sample(1, 5_500, {
        previousOffsetMs: 4_500,
        routeOverrides: { active: false },
        tickCount: 5,
      });

      assert.equal(loadedSession.autoplayRouteFrameHistory().length, 0);
      const initialSegments =
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: initialSamples,
        });
      assert.equal(initialSegments.length, 1);
      assert.equal(initialSegments[0].samples.length, 3);
      assert.equal(initialSegments[0].stalledRecorderGapCount, 1);
      await assert.rejects(
        loadedSession.captureAutoplayRouteVisualFrame({
          minimumCapturedAtEpochMs: startedAt,
        }),
        /either exclusive main-CDP access or the dedicated capture transport/,
      );

      for (let attempt = 0; attempt < 4; attempt += 1) {
        assert.equal(
          loadedSession.archiveAutoplayRouteFrameWindow({
            expectedTargetLocationId: "tea-house",
            recordedWindow: {
              afterProbe: arrivedProbe,
              beforeProbe: initialSamples[0],
              candidateFrame: frame(
                100 + attempt * 2,
                300,
                `legacy-candidate-${attempt}`,
              ),
              confirmationFrame: frame(
                101 + attempt * 2,
                425,
                `legacy-confirmation-${attempt}`,
              ),
            },
            recorder: {
              ...openingRecorder,
              samples: [...openingRecorder.samples, arrivedProbe],
            },
          }),
          null,
        );
      }
      loadedSession.screencast.routeFrameWindowCaptureAttemptCount = 4;
      assert.equal(loadedSession.autoplayRouteFrameWindows().length, 0);
      assert.equal(loadedSession.screencast.routeFrameWindowRejectedCount, 4);
      assert.equal(loadedSession.screencast.routeFrameWindowRejections.length, 4);
      assert.ok(
        loadedSession.screencast.routeFrameWindowRejections.every(
          (rejection) =>
            rejection.reason === "after-probe-outside-opening-segment" &&
            rejection.before.route.progress === 0.004 &&
            rejection.after.route.active === false &&
            rejection.frame.source === "proactive-route-screenshot",
        ),
      );

      const captureGapAfter = sample(0.95, 4_800, {
        previousOffsetMs: 4_500,
        tickCount: 5,
      });
      const firstCaptureBefore = sample(0.05, 150, {
        previousOffsetMs: 0,
        tickCount: 2,
      });
      const captureGapRecorder = {
        ...openingRecorder,
        samples: [
          initialSamples[0],
          firstCaptureBefore,
          initialSamples[1],
          initialSamples[2],
          finalOpeningSample,
          captureGapAfter,
        ],
      };
      assert.equal(
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: captureGapRecorder.samples,
        }).length,
        1,
        "Recovery samples must stay inside the same legal opening route lifetime.",
      );
      const canvasCaptures = [
        {
          afterProbe: initialSamples[1],
          captureBeforeProbe: firstCaptureBefore,
          frame: canvasFrame(201, 300, "loaded-route-position-start"),
        },
        {
          afterProbe: captureGapAfter,
          captureBeforeProbe: finalOpeningSample,
          frame: canvasFrame(202, 4_650, "loaded-route-position-mid"),
        },
      ];
      let visualCaptureCount = 0;
      loadedSession.captureAutoplayRouteCanvasVisualFrame = async () => {
        assert.equal(
          loadedSession.screencast.routeVisualCaptureTransportStatus,
          "active",
        );
        visualCaptureCount += 1;
        return canvasCaptures.shift();
      };
      loadedSession.readOrRearmAutoplayRouteCaptureRecorder = async () =>
        captureGapRecorder;

      try {
        assert.ok(
          await proactiveCapturePolicy({
            beforeProbe: initialSamples[0],
            expectedTargetLocationId: "tea-house",
            label: "loaded-route:start",
            session: loadedSession,
          }),
        );
        assert.ok(
          await proactiveCapturePolicy({
            beforeProbe: finalOpeningSample,
            expectedTargetLocationId: "tea-house",
            label: "loaded-route:mid",
            session: loadedSession,
          }),
        );
        assert.equal(visualCaptureCount, 2);
        assert.equal(loadedSession.autoplayRouteFrameHistory().length, 0);
        assert.equal(loadedSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          loadedSession.autoplayRouteFrameWindows()[1]
            .openingSegmentExtension,
          undefined,
        );
        assert.ok(
          loadedSession.autoplayRouteFrameWindows().every(
            (recordedWindow) =>
              recordedWindow.frame &&
              !recordedWindow.candidateFrame &&
              !recordedWindow.confirmationFrame,
          ),
        );
        assert.equal(loadedSession.screencast.routeVisualCapturePauseCount, 0);
        assert.equal(loadedSession.screencast.routeVisualCaptureResumeCount, 0);

        const earlyHudFrame = {
          data: Buffer.from("loaded-route-full-frame-hud").toString("base64"),
          metadata: { timestamp: (startedAt + 14) / 1_000 },
          sequence: 200,
        };
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: [earlyHudFrame],
            expectedTargetLocationId: "tea-house",
            forceCanvasFallback: true,
            frames: [earlyHudFrame],
            label: "three-sample loaded opening route",
            recordedWindows: loadedSession.autoplayRouteFrameWindows(),
            samples: loadedSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame: positionFrame, paintProbe }) => ({
              buffer: Buffer.from(positionFrame.data, "base64"),
              height: 625,
              paintProbe,
              textPaint: { regionCount: 9, surfaces: ["hud"] },
              width: 1365,
            }),
          });
        assert.equal(trajectory.start.evidenceSource, "canvas-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "canvas-route-frame");
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.004);
        assert.equal(trajectory.start.afterProbe.route.progress, 0.25);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.9);
        assert.equal(trajectory.mid.afterProbe.route.progress, 0.95);
        assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);

        const generationChanged = sample(0.2, 550, {
          generation: 3,
          previousOffsetMs: 0,
          tickCount: 2,
        });
        assert.equal(
          loadedSession.archiveAutoplayRouteFrameWindow({
            expectedTargetLocationId: "tea-house",
            recordedWindow: {
              afterProbe: generationChanged,
              beforeProbe: initialSamples[0],
              frame: frame(301, 500, "generation-changed-position"),
            },
            recorder: {
              ...openingRecorder,
              samples: [...openingRecorder.samples, generationChanged],
            },
          }),
          null,
        );
        assert.equal(
          loadedSession.screencast.routeFrameWindowRejections.at(-1).reason,
          "route-window-identity-changed",
        );
        assert.ok(
          loadedSession.screencast.routeFrameWindowRejections.length <= 8,
        );
      } finally {
        await loadedSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "canvas starvation fails closed without full-frame HUD corroboration",
    async () => {
      const starvationSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/starved-route",
        url: "http://127.0.0.1/",
      });
      starvationSession.socket = { destroyed: false, writable: true };
      const commands = [];
      starvationSession.send = async (method, params) => {
        commands.push({ method, params });
        assert.notEqual(method, "Page.captureScreenshot");
        return {};
      };

      await starvationSession.startAutoplayScreencast();
      const startedAt = starvationSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (
        progress,
        offsetMs,
        {
          generation = 2,
          hud = "DAY 1 11:05",
          routeOverrides = {},
        } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        recorderParseErrorCount: 0,
        recorderRejectedCount: 522,
        recorderTickCount: Math.max(1, Math.round(offsetMs / 25)),
        recorderUnavailableCount: 45,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
          ...routeOverrides,
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.003, 0, { hud: "DAY 1 11:23" }),
        sample(0.18, 900, { hud: "DAY 1 11:23" }),
        sample(0.73, 1_600, { hud: "DAY 1 11:23" }),
        sample(0.86, 2_400, { hud: "DAY 1 11:23" }),
        sample(0.95, 3_521, { hud: "DAY 1 11:23" }),
      ];
      const recorder = {
        acceptedCount: 21,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        rejectedCount: 522,
        samples: openingSamples,
        unavailableCount: 45,
      };
      const canvasGeometry = {
        canvas: {
          height: 625,
          index: 0,
          rect: { height: 625, left: 0, top: 0, width: 1365 },
          width: 1365,
        },
        contextType: "webgl",
        crop: { height: 360, width: 640, x: 362, y: 132 },
        renderScale: 1,
        sceneViewport: { height: 625, width: 1365, x: 0, y: 0 },
      };
      const canvasCaptures = [
        {
          afterProbe: openingSamples[2],
          captureBeforeProbe: openingSamples[1],
          offsetMs: 1_000,
          pixels: "starved-canvas-position-one",
        },
        {
          afterProbe: openingSamples[4],
          captureBeforeProbe: openingSamples[3],
          offsetMs: 2_600,
          pixels: "starved-canvas-position-two",
        },
      ];
      starvationSession.captureAutoplayRouteCanvasVisualFrame = async () => {
        const capture = canvasCaptures.shift();
        assert.ok(capture);
        starvationSession.screencast.lastSequence += 1;
        return {
          afterProbe: capture.afterProbe,
          captureBeforeProbe: capture.captureBeforeProbe,
          frame: {
            data: Buffer.from(capture.pixels).toString("base64"),
            metadata: {
              capturedAtEpochMs: startedAt + capture.offsetMs,
              contextLost: false,
              defaultFramebuffer: true,
              format: "png",
              geometry: canvasGeometry,
              initialRenderedAtMs: capture.offsetMs - 20,
              renderedAtMs: capture.offsetMs - 1,
              source: "in-page-route-canvas",
              timestamp: (startedAt + capture.offsetMs) / 1_000,
            },
            sequence: starvationSession.screencast.lastSequence,
            source: "in-page-route-canvas",
          },
        };
      };
      starvationSession.readOrRearmAutoplayRouteCaptureRecorder = async () =>
        recorder;

      try {
        assert.equal(starvationSession.autoplayRouteFrameHistory().length, 0);
        assert.ok(
          await proactiveCapturePolicy({
            beforeProbe: openingSamples[0],
            expectedTargetLocationId: "tea-house",
            label: "zero-frame-starvation:start",
            session: starvationSession,
          }),
        );
        assert.ok(
          await proactiveCapturePolicy({
            beforeProbe: openingSamples[3],
            expectedTargetLocationId: "tea-house",
            label: "zero-frame-starvation:mid",
            session: starvationSession,
          }),
        );

        assert.equal(starvationSession.screencast.routeFrameArchive.length, 0);
        assert.equal(
          starvationSession.screencast.routeFrameArchivedSampleCount,
          5,
        );
        assert.equal(starvationSession.screencast.routeSampleArchive.length, 5);
        assert.equal(starvationSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          starvationSession.screencast.routeVisualCapturePauseCount,
          0,
        );
        assert.equal(
          starvationSession.screencast.routeVisualCaptureResumeCount,
          0,
        );
        assert.equal(
          starvationSession.screencast.routeVisualCaptureTransportStatus,
          "active",
        );
        assert.equal(
          commands.filter(({ method }) => method === "Page.stopScreencast")
            .length,
          0,
        );
        assert.equal(
          commands.filter(({ method }) => method === "Page.captureScreenshot")
            .length,
          0,
        );
        assert.equal(canvasCaptures.length, 0);

        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              archivedFrames: [],
              expectedTargetLocationId: "tea-house",
              frames: starvationSession.autoplayRouteFrameHistory(),
              label: "five-sample zero-frame opening route",
              recordedWindows: starvationSession.autoplayRouteFrameWindows(),
              samples: starvationSession.autoplayRouteCaptureSamples(),
              validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
                buffer: Buffer.from(frame.data, "base64"),
                height: 625,
                paintProbe: framePaintProbe,
                textPaint: {},
                width: 1365,
              }),
            }),
          /lacked validated full-frame screencast HUD corroboration/,
        );

        const laterSamples = [
          sample(0.1, 7_000, {
            hud: "DAY 1 11:25",
            routeOverrides: {
              durationMs: 840,
              spaceId: "interior:tea-house",
              tilePath: [
                { x: 7, y: 4 },
                { x: 8, y: 3 },
              ],
              worldPath: [
                { x: 396, y: 236 },
                { x: 436, y: 196 },
              ],
            },
          }),
          sample(0.4, 7_200, {
            hud: "DAY 1 11:25",
            routeOverrides: {
              durationMs: 840,
              spaceId: "interior:tea-house",
              tilePath: [
                { x: 7, y: 4 },
                { x: 8, y: 3 },
              ],
              worldPath: [
                { x: 396, y: 236 },
                { x: 436, y: 196 },
              ],
            },
          }),
        ];
        starvationSession.archiveAutoplayRouteFrames({
          ...recorder,
          acceptedCount: 23,
          samples: [...openingSamples, ...laterSamples],
        });
        assert.equal(
          starvationSession.screencast.routeFrameArchiveFrozen,
          true,
        );
        assert.equal(starvationSession.screencast.routeSampleArchive.length, 5);
        assert.equal(
          starvationSession.screencast.routeFrameOpeningSegment.lastProgress,
          0.95,
        );
        assert.equal(
          starvationSession.archiveAutoplayRouteFrameWindow({
            expectedTargetLocationId: "tea-house",
            recordedWindow: {
              afterProbe: laterSamples[1],
              beforeProbe: laterSamples[0],
              candidateFrame: {
                data: Buffer.from("later-candidate").toString("base64"),
                metadata: { timestamp: (startedAt + 7_025) / 1_000 },
                sequence: 101,
              },
              confirmationFrame: {
                data: Buffer.from("later-confirmation").toString("base64"),
                metadata: { timestamp: (startedAt + 7_150) / 1_000 },
                sequence: 102,
              },
            },
            recorder: {
              ...recorder,
              samples: [...openingSamples, ...laterSamples],
            },
          }),
          null,
          "A later same-target route must not enter the frozen opening archive.",
        );
        assert.equal(starvationSession.autoplayRouteFrameWindows().length, 2);
      } finally {
        await starvationSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "dense route rearm recovers the constrained-runner opening frame race",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/dense-route-rearm",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      const commands = [];
      routeSession.send = async (method, params, options) => {
        commands.push({ method, params });
        return {};
      };
      await routeSession.startAutoplayScreencast();
      routeSession.autoplayRouteArchiveNeedsProactiveOpeningCapture = () =>
        false;
      const startedAt = routeSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.004, 0),
        sample(0.08, 100),
        sample(0.18, 200),
        sample(0.31, 400),
        sample(0.51, 600),
        sample(0.7, 800),
      ];
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: 2,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 2),
      });
      assert.equal(routeSession.screencast.routeFrameArchive.length, 0);

      const beforeSamples = [openingSamples[2], openingSamples[4]];
      routeSession.sampleAutoplayRouteCaptureRecorder = async () =>
        beforeSamples.shift() ?? null;
      let directCaptureCount = 0;
      routeSession.captureAutoplayScreencastRouteFrameWindow = async ({
        afterSequence,
        beforeProbe,
        expectedTargetLocationId,
      }) => {
        const captureIndex = directCaptureCount;
        directCaptureCount += 1;
        const afterProbe = openingSamples[captureIndex === 0 ? 3 : 5];
        const frame = {
          data: Buffer.from(`dense-route-position-${captureIndex}`).toString(
            "base64",
          ),
          metadata: {
            timestamp:
              (beforeProbe.capturedAtEpochMs + 125) / 1_000,
          },
          sequence: captureIndex + 2,
        };
        assert.equal(afterSequence, captureIndex === 0 ? 0 : 2);
        const recorder = {
          acceptedCount: captureIndex === 0 ? 4 : 6,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples.slice(0, captureIndex === 0 ? 4 : 6),
        };
        routeSession.archiveAutoplayRouteFrames(recorder);
        return routeSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: { afterProbe, beforeProbe, frame },
          recorder,
        });
      };
      proactiveRouteCaptureFixture = async () => {
        assert.fail("Opening-route recovery must not use a screenshot fallback.");
      };

      try {
        await routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[0],
          expectedTargetLocationId: "tea-house",
          label: "dense-route-rearm",
        });
        assert.equal(directCaptureCount, 2);
        assert.equal(routeSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
        assert.equal(
          routeSession.screencast.routeScreencastRearmAttemptCount,
          1,
        );
        assert.equal(routeSession.screencast.routeScreencastRestoreCount, 1);
        assert.equal(routeSession.screencast.everyNthFrame, 2);
        assert.deepEqual(
          commands
            .filter(({ method }) =>
              ["Page.startScreencast", "Page.stopScreencast"].includes(method),
            )
            .map(({ method, params }) => [method, params?.everyNthFrame ?? null]),
          [
            ["Page.startScreencast", 2],
            ["Page.stopScreencast", null],
            ["Page.startScreencast", 1],
            ["Page.stopScreencast", null],
            ["Page.startScreencast", 2],
          ],
        );

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: routeSession.autoplayRouteFrameHistory(),
            label: "dense rearmed opening route",
            recordedWindows: routeSession.autoplayRouteFrameWindows(),
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
              buffer: Buffer.from(frame.data, "base64"),
              paintProbe: framePaintProbe,
              textPaint: {},
            }),
            validateStableFramePair: () => ({}),
          });
        assert.equal(trajectory.start.frame.sequence, 2);
        assert.equal(trajectory.mid.frame.sequence, 3);
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.004);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.51);

        const adjacentSamples = [
          sample(0.004, 0),
          sample(0.31, 400),
          sample(0.7, 800),
        ];
        const adjacentTrajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: [
              {
                data: Buffer.from("adjacent-route-position-start").toString(
                  "base64",
                ),
                metadata: { timestamp: (startedAt + 200) / 1_000 },
                sequence: 20,
              },
              {
                data: Buffer.from("adjacent-route-position-mid").toString(
                  "base64",
                ),
                metadata: { timestamp: (startedAt + 600) / 1_000 },
                sequence: 21,
              },
            ],
            label: "adjacent direct opening route frames",
            samples: adjacentSamples,
            validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
              buffer: Buffer.from(frame.data, "base64"),
              paintProbe: framePaintProbe,
              textPaint: {},
            }),
            validateStableFramePair: () => ({}),
          });
        assert.equal(adjacentTrajectory.start.frame.sequence, 20);
        assert.equal(adjacentTrajectory.mid.frame.sequence, 21);
        assert.equal(
          adjacentTrajectory.start.afterProbe.capturedAtEpochMs,
          adjacentTrajectory.mid.beforeProbe.capturedAtEpochMs,
          "Sparse CI samples may form adjacent legal frame windows with one shared boundary.",
        );

        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              expectedTargetLocationId: "tea-house",
              frames: [
                {
                  data: Buffer.from("close-route-position-start").toString(
                    "base64",
                  ),
                  metadata: { timestamp: (startedAt + 140) / 1_000 },
                  sequence: 30,
                },
                {
                  data: Buffer.from("close-route-position-mid").toString(
                    "base64",
                  ),
                  metadata: { timestamp: (startedAt + 572) / 1_000 },
                  sequence: 31,
                },
              ],
              label: "overly close direct opening route frames",
              samples: [
                sample(0.005, 0),
                sample(0.043, 183),
                sample(0.086, 433),
                sample(0.122, 616),
              ],
              validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
                buffer: Buffer.from(frame.data, "base64"),
                paintProbe: framePaintProbe,
                textPaint: {},
              }),
              validateStableFramePair: () => ({}),
            }),
          /did not contain two distinct legal rendered positions/,
        );

        const commandCountAfterRecovery = commands.length;
        await routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[5],
          expectedTargetLocationId: "tea-house",
          label: "redundant-dense-route-rearm",
        });
        assert.equal(commands.length, commandCountAfterRecovery);
        assert.equal(
          routeSession.screencast.routeScreencastRearmAttemptCount,
          1,
        );
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        await routeSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "a missing or unsettled opening frame triggers one bounded proactive position alongside dense capture",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-proactive-opening-route",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      routeSession.send = async () => ({});
      await routeSession.startAutoplayScreencast();
      const startedAt = 1_785_515_560_424;
      routeSession.screencast.startedAtEpochMs = startedAt;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (
        progress,
        offsetMs,
        { generation = 2, hud = "DAY 1 11:05", routeOverrides = {} } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        route: { ...route, progress, ...routeOverrides },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.004, 0),
        sample(0.08, 150),
        sample(0.19, 300),
        sample(0.31, 600),
        sample(0.655, 2_100),
        sample(0.664, 2_123),
      ];
      const frame = (sequence, capturedAtEpochMs, pixels, source = null) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: {
          ...(source ? { source } : {}),
          timestamp: capturedAtEpochMs / 1_000,
        },
        sequence,
        ...(source ? { source } : {}),
      });
      const tooEarlyFrame = frame(
        758,
        1_785_515_560_458.283,
        "ci-unsettled-opening-position",
      );
      routeSession.screencast.lastSequence = 757;
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: 1,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 1),
      });
      assert.equal(routeSession.screencast.routeFrameArchive.length, 0);
      assert.equal(
        routeSession.autoplayRouteArchiveNeedsProactiveOpeningCapture(
          openingSamples[0],
        ),
        true,
        "A runner with no settled opening frame must use the bounded canvas capture instead of waiting through the route.",
      );
      routeCompositingSleepFixture = async (minimumEpochMs) => {
        assert.equal(minimumEpochMs, startedAt + 125);
        routeSession.screencast.lastSequence = 758;
        routeSession.screencast.routeFrameHistory.push(tooEarlyFrame);
        routeSession.archiveAutoplayRouteFrames({
          acceptedCount: 1,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: openingSamples.slice(0, 1),
        });
      };

      let proactiveCaptureCount = 0;
      proactiveRouteCaptureFixture = async ({
        beforeProbe,
        expectedTargetLocationId,
        session,
        timeoutMs,
      }) => {
        proactiveCaptureCount += 1;
        assert.equal(beforeProbe, openingSamples[0]);
        assert.equal(timeoutMs, 60);
        const recorder = {
          acceptedCount: 2,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples.slice(0, 2),
        };
        session.archiveAutoplayRouteFrames(recorder);
        return session.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe: openingSamples[1],
            beforeProbe,
            frame: frame(
              759,
              startedAt + 125,
              "ci-proactive-opening-position",
              "proactive-route-screenshot",
            ),
          },
          recorder,
        });
      };
      const freshSamples = [openingSamples[3]];
      routeSession.sampleAutoplayRouteCaptureRecorder = async () =>
        freshSamples.shift() ?? null;
      let directCaptureCount = 0;
      routeSession.captureAutoplayScreencastRouteFrameWindow = async ({
        afterSequence,
        beforeProbe,
        expectedTargetLocationId,
      }) => {
        directCaptureCount += 1;
        assert.equal(afterSequence, 759);
        assert.equal(beforeProbe, openingSamples[3]);
        const recorder = {
          acceptedCount: openingSamples.length,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples,
        };
        const renderedFrame = frame(
          760,
          1_785_515_562_520.554,
          "ci-settled-opening-position",
        );
        routeSession.screencast.lastSequence = 760;
        routeSession.screencast.routeFrameHistory.push(renderedFrame);
        routeSession.archiveAutoplayRouteFrames(recorder);
        return routeSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe: openingSamples[4],
            beforeProbe,
            frame: renderedFrame,
          },
          recorder,
        });
      };

      try {
        await routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[0],
          expectedTargetLocationId: "tea-house",
          label: "ci-unsettled-opening-route",
        });
        assert.equal(proactiveCaptureCount, 1);
        assert.equal(directCaptureCount, 1);
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureAttemptCount,
          2,
        );
        assert.equal(
          routeSession.autoplayRouteFrameWindows().length,
          2,
          JSON.stringify(routeSession.screencast.routeFrameWindowRejections),
        );
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
        assert.equal(
          routeSession.screencast.routeFrameOpeningSegment.sampleCount,
          6,
        );
        assert.equal(
          routeSession.screencast.routeFrameOpeningSegment.firstProgress,
          0.004,
        );
        assert.equal(
          routeSession.screencast.routeFrameOpeningSegment.lastProgress,
          0.664,
        );
        const directCandidates = recordedRoutePolicy
          .buildAutoplayRecordedRouteFrameCandidates({
            expectedTargetLocationId: "tea-house",
            frames: routeSession.autoplayRouteFrameHistory(),
            samples: routeSession.autoplayRouteCaptureSamples(),
          })
          .map((candidate) => candidate.frame.sequence);
        assert.deepEqual(directCandidates, [760]);

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: routeSession.autoplayRouteFrameHistory(),
            label: "CI one-settled-frame opening route",
            recordedWindows: routeSession.autoplayRouteFrameWindows(),
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame: renderedFrame, paintProbe }) => ({
              buffer: Buffer.from(renderedFrame.data, "base64"),
              height: 625,
              paintProbe,
              textPaint: {},
              width: 1365,
            }),
            validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
          });
        assert.equal(trajectory.start.frame.sequence, 759);
        assert.equal(trajectory.mid.frame.sequence, 760);
        assert.equal(trajectory.start.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "screencast-frame");
        assert.ok(
          trajectory.mid.beforeProbe.route.progress -
            trajectory.start.afterProbe.route.progress >=
            0.1,
        );
        assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);
        assert.equal(
          routeSession.autoplayRouteArchiveNeedsProactiveOpeningCapture(
            openingSamples[0],
          ),
          false,
        );
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        routeCompositingSleepFixture = (minimumEpochMs) =>
          sleepUntilEpochMs(minimumEpochMs, {
            sleepFor: (milliseconds) =>
              new Promise((resolve) => setTimeout(resolve, milliseconds)),
          });
        await routeSession.stopAutoplayScreencast();
      }

      const guardSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-proactive-opening-guards",
        url: "http://127.0.0.1/",
      });
      guardSession.socket = { destroyed: false, writable: true };
      guardSession.send = async () => ({});
      await guardSession.startAutoplayScreencast();
      guardSession.screencast.startedAtEpochMs = startedAt;
      let guardAfterProbe = openingSamples[1];
      let guardFrameOffsetMs = 125;
      let guardSequence = 800;
      guardSession.captureAutoplayRouteCanvasVisualFrame = async () => ({
        afterProbe: guardAfterProbe,
        captureBeforeProbe: openingSamples[0],
        frame: frame(
          guardSequence,
          startedAt + guardFrameOffsetMs,
          `guard-${guardSequence}`,
          "in-page-route-canvas",
        ),
      });
      guardSession.readOrRearmAutoplayRouteCaptureRecorder = async () => ({
        acceptedCount: 2,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [openingSamples[0], guardAfterProbe],
      });
      try {
        const rejectedCaptures = [
          {
            afterProbe: openingSamples[1],
            frameOffsetMs: 34.283,
            reason: "visual-frame-before-compositing-settle",
          },
          {
            afterProbe: openingSamples[1],
            frameOffsetMs: 200,
            reason: "canvas-frame-outside-probe-bracket",
          },
          {
            afterProbe: sample(0.08, 150, {
              routeOverrides: {
                worldPath: [
                  { x: 331, y: 688 },
                  { x: 1_420, y: 702 },
                ],
              },
            }),
            frameOffsetMs: 125,
            reason: "canvas-route-identity-changed",
          },
          {
            afterProbe: sample(0.08, 150, { hud: "DAY 1 11:10" }),
            frameOffsetMs: 125,
            reason: "canvas-route-identity-changed",
          },
          {
            afterProbe: sample(0.08, 150, { generation: 3 }),
            frameOffsetMs: 125,
            reason: "canvas-route-identity-changed",
          },
        ];
        for (const rejected of rejectedCaptures) {
          guardAfterProbe = rejected.afterProbe;
          guardFrameOffsetMs = rejected.frameOffsetMs;
          guardSequence += 1;
          assert.equal(
            await proactiveCapturePolicy({
              beforeProbe: openingSamples[0],
              expectedTargetLocationId: "tea-house",
              label: `guard-${guardSequence}`,
              session: guardSession,
              timeoutMs: 1_000,
            }),
            null,
          );
          assert.equal(
            guardSession.screencast.routeFrameWindowRejections.at(-1).reason,
            rejected.reason,
          );
        }
        assert.equal(guardSession.autoplayRouteFrameWindows().length, 0);
      } finally {
        await guardSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "a slow proactive capture preserves dense screencast route positions",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-concurrent-proactive-route",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      const commands = [];
      routeSession.send = async (method, params) => {
        commands.push({ method, params });
        return {};
      };
      await routeSession.startAutoplayScreencast();
      const startedAt = 1_785_519_000_000;
      routeSession.screencast.startedAtEpochMs = startedAt;
      routeSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      routeSession.scheduleAutoplayRouteSampleFromScreencastFrame = () => {};
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 1_000,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: 2,
        route: { ...route, progress },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.005, 0),
        sample(0.2, 250),
        sample(0.35, 400),
        sample(0.65, 650),
        sample(0.9, 850),
      ];
      const recorder = (sampleCount) => ({
        acceptedCount: sampleCount,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, sampleCount),
      });
      routeSession.archiveAutoplayRouteFrames(recorder(1));
      routeSession.sampleAutoplayRouteCaptureRecorder = async () => null;
      routeCompositingSleepFixture = async (minimumEpochMs) => {
        assert.equal(minimumEpochMs, startedAt + 125);
      };

      let markSlowCaptureStarted;
      const slowCaptureStarted = new Promise((resolve) => {
        markSlowCaptureStarted = resolve;
      });
      let releaseSlowCapture;
      const slowCaptureHeld = new Promise((resolve) => {
        releaseSlowCapture = resolve;
      });
      proactiveRouteCaptureFixture = async () => {
        markSlowCaptureStarted();
        await slowCaptureHeld;
        throw new Error("capture-after-route-timeout");
      };

      let capturePromise = null;
      try {
        capturePromise =
          routeSession.scheduleAutoplayRouteVisualWindowCapture({
            beforeProbe: openingSamples[0],
            expectedTargetLocationId: "tea-house",
            label: "ci-concurrent-proactive-route",
          });
        await slowCaptureStarted;
        assert.equal(
          routeSession.screencast.everyNthFrame,
          1,
          "Dense screencast cadence must be active while the separate proactive canvas command is pending.",
        );

        routeSession.archiveAutoplayRouteFrames(recorder(2));
        routeSession.handleAutoplayScreencastFrame({
          data: Buffer.from("dense-opening-position").toString("base64"),
          metadata: { timestamp: (startedAt + 250) / 1_000 },
          sessionId: 901,
        });
        routeSession.archiveAutoplayRouteFrames(recorder(4));
        routeSession.handleAutoplayScreencastFrame({
          data: Buffer.from("dense-mid-route-position").toString("base64"),
          metadata: { timestamp: (startedAt + 650) / 1_000 },
          sessionId: 902,
        });
        routeSession.archiveAutoplayRouteFrames(recorder(5));
        releaseSlowCapture();
        await capturePromise;

        assert.deepEqual(
          routeSession
            .autoplayRouteArchivedFrames()
            .map((frame) => Buffer.from(frame.data, "base64").toString()),
          ["dense-opening-position", "dense-mid-route-position"],
          "Both dense frames must remain in the legal opening-route archive after the proactive attempt times out.",
        );
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: routeSession.autoplayRouteArchivedFrames(),
            expectedTargetLocationId: "tea-house",
            frames: [],
            label: "concurrent dense screencast opening route",
            recordedWindows: routeSession.autoplayRouteFrameWindows(),
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
              buffer: Buffer.from(frame.data, "base64"),
              height: 625,
              paintProbe: framePaintProbe,
              textPaint: {},
              width: 1365,
            }),
            validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
              assert.notDeepEqual(afterBuffer, beforeBuffer);
              return { hudPixelDifferenceRatio: 0 };
            },
          });
        assert.equal(trajectory.start.frame.sequence, 1);
        assert.equal(trajectory.mid.frame.sequence, 2);
        assert.equal(trajectory.start.evidenceSource, "screencast-frame");
        assert.equal(trajectory.mid.evidenceSource, "screencast-frame");
        assert.equal(
          trajectory.start.validated.textPaint.routeFrameEvidenceBasis,
          "archived-screencast-frame-matched-to-legal-route-sample",
        );
        assert.equal(
          trajectory.mid.validated.textPaint.routeFrameEvidenceBasis,
          "archived-screencast-frame-matched-to-legal-route-sample",
        );
        assert.deepEqual(
          commands
            .filter(({ method }) =>
              ["Page.startScreencast", "Page.stopScreencast"].includes(method),
            )
            .map(({ method, params }) => [
              method,
              params?.everyNthFrame ?? null,
            ]),
          [
            ["Page.startScreencast", 2],
            ["Page.stopScreencast", null],
            ["Page.startScreencast", 1],
            ["Page.stopScreencast", null],
            ["Page.startScreencast", 2],
          ],
        );
      } finally {
        releaseSlowCapture();
        await capturePromise?.catch(() => null);
        proactiveRouteCaptureFixture = async () => null;
        routeCompositingSleepFixture = (minimumEpochMs) =>
          sleepUntilEpochMs(minimumEpochMs, {
            sleepFor: (milliseconds) =>
              new Promise((resolve) => setTimeout(resolve, milliseconds)),
          });
        await routeSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "a slow proactive opening capture immediately earns a second bounded proactive position",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-adaptive-proactive-route",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      routeSession.send = async () => ({});
      await routeSession.startAutoplayScreencast();
      const startedAt = 1_785_517_972_106;
      routeSession.screencast.startedAtEpochMs = startedAt;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 5_040,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (
        progress,
        offsetMs,
        { generation = 2, hud = "DAY 1 11:05", routeOverrides = {} } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        route: { ...route, progress, ...routeOverrides },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.004, 0),
        sample(0.12, 600),
        sample(0.329, 1_700),
        sample(0.45, 2_300),
        sample(0.66, 3_400),
        sample(0.84, 4_200),
        sample(0.948, 4_768),
      ];
      const frame = (sequence, capturedAtEpochMs, pixels, source = null) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: {
          ...(source ? { source } : {}),
          timestamp: capturedAtEpochMs / 1_000,
        },
        sequence,
        ...(source ? { source } : {}),
      });
      const earlyFrame = frame(
        725,
        startedAt + 34.283,
        "ci-unsettled-opening-position",
      );
      routeSession.screencast.lastSequence = 725;
      routeSession.screencast.routeFrameHistory.push(earlyFrame);
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: 1,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 1),
      });
      routeCompositingSleepFixture = async (minimumEpochMs) => {
        assert.equal(minimumEpochMs, startedAt + 125);
      };

      const proactiveFrames = [
        frame(
          726,
          1_785_517_973_794.276,
          "ci-first-proactive-position",
          "proactive-route-screenshot",
        ),
        frame(
          727,
          startedAt + 3_290,
          "ci-second-proactive-position",
          "proactive-route-screenshot",
        ),
      ];
      const proactiveWindows = [
        {
          afterProbe: openingSamples[2],
          beforeProbe: openingSamples[0],
        },
        {
          afterProbe: openingSamples[4],
          beforeProbe: openingSamples[2],
        },
      ];
      let proactiveCaptureCount = 0;
      proactiveRouteCaptureFixture = async ({
        beforeProbe,
        expectedTargetLocationId,
        session,
        timeoutMs,
      }) => {
        const captureIndex = proactiveCaptureCount;
        const recordedWindow = proactiveWindows[captureIndex];
        assert.equal(beforeProbe, recordedWindow.beforeProbe);
        assert.equal(timeoutMs, 60);
        proactiveCaptureCount += 1;
        session.screencast.lastSequence =
          proactiveFrames[captureIndex].sequence;
        const recorder = {
          acceptedCount: captureIndex === 0 ? 3 : 5,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples.slice(0, captureIndex === 0 ? 3 : 5),
        };
        session.archiveAutoplayRouteFrames(recorder);
        return session.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            ...recordedWindow,
            frame: proactiveFrames[captureIndex],
          },
          recorder,
        });
      };
      routeSession.sampleAutoplayRouteCaptureRecorder = async () => {
        assert.fail(
          "Adaptive proactive follow-up must not wait for a constrained recorder sample.",
        );
      };
      routeSession.captureAutoplayScreencastRouteFrameWindow = async () => {
        assert.fail(
          "Adaptive proactive follow-up must not spend the remaining route budget on dense capture.",
        );
      };

      try {
        await routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[0],
          expectedTargetLocationId: "tea-house",
          label: "ci-adaptive-proactive-route",
        });
        assert.equal(proactiveCaptureCount, 2);
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureAttemptCount,
          2,
        );
        assert.equal(routeSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
        assert.equal(
          routeSession.autoplayProactiveRouteWindowNeedsFollowUp(
            routeSession.autoplayRouteFrameWindows()[0],
            "tea-house",
          ),
          false,
          "The adaptive branch is one-shot after the second window is archived.",
        );

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: routeSession.autoplayRouteFrameHistory(),
            label: "CI adaptive proactive opening route",
            recordedWindows: routeSession.autoplayRouteFrameWindows(),
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame: renderedFrame, paintProbe }) => ({
              buffer: Buffer.from(renderedFrame.data, "base64"),
              height: 625,
              paintProbe,
              textPaint: {},
              width: 1365,
            }),
            validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
          });
        assert.equal(trajectory.start.frame.sequence, 726);
        assert.equal(trajectory.mid.frame.sequence, 727);
        assert.equal(trajectory.start.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "proactive-route-frame");
        assert.equal(
          recordedRoutePolicy.autoplayRecordedRouteWindowsHaveDistinctProgress(
            routeSession.autoplayRouteFrameWindows()[0],
            routeSession.autoplayRouteFrameWindows()[1],
          ),
          true,
        );
        assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        routeCompositingSleepFixture = (minimumEpochMs) =>
          sleepUntilEpochMs(minimumEpochMs, {
            sleepFor: (milliseconds) =>
              new Promise((resolve) => setTimeout(resolve, milliseconds)),
          });
        await routeSession.stopAutoplayScreencast();
      }

      const rejectionSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-adaptive-proactive-guards",
        url: "http://127.0.0.1/",
      });
      rejectionSession.socket = { destroyed: false, writable: true };
      rejectionSession.send = async () => ({});
      await rejectionSession.startAutoplayScreencast();
      rejectionSession.archiveAutoplayRouteFrames({
        acceptedCount: openingSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples,
      });
      const firstWindow = {
        ...proactiveWindows[0],
        frame: proactiveFrames[0],
      };
      assert.ok(
        rejectionSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId: "tea-house",
          recordedWindow: firstWindow,
          recorder: {
            expectedTargetLocationId: "tea-house",
            samples: openingSamples,
          },
        }),
      );
      try {
        const insufficientProgress = {
          afterProbe: sample(0.39, 2_100),
          beforeProbe: openingSamples[2],
          frame: frame(
            728,
            startedAt + 2_000,
            "ci-insufficient-progress-position",
            "proactive-route-screenshot",
          ),
        };
        assert.equal(
          rejectionSession.archiveAutoplayRouteFrameWindow({
            expectedTargetLocationId: "tea-house",
            recordedWindow: insufficientProgress,
            recorder: {
              expectedTargetLocationId: "tea-house",
              samples: [...openingSamples, insufficientProgress.afterProbe],
            },
          }),
          null,
        );
        assert.equal(
          rejectionSession.screencast.routeFrameWindowRejections.at(-1)
            .reason,
          "route-progress-not-distinct",
        );

        const identicalPixels = {
          ...proactiveWindows[1],
          frame: frame(
            729,
            startedAt + 3_290,
            "ci-first-proactive-position",
            "proactive-route-screenshot",
          ),
        };
        assert.equal(
          rejectionSession.archiveAutoplayRouteFrameWindow({
            expectedTargetLocationId: "tea-house",
            recordedWindow: identicalPixels,
            recorder: {
              expectedTargetLocationId: "tea-house",
              samples: openingSamples,
            },
          }),
          null,
        );
        assert.equal(
          rejectionSession.screencast.routeFrameWindowRejections.at(-1)
            .reason,
          "visual-frame-pixels-identical",
        );
        assert.equal(rejectionSession.autoplayRouteFrameWindows().length, 1);
      } finally {
        await rejectionSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "forced canvas mode ignores accepted screencast evidence and proves two opening positions",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        forceRouteCanvasFallback: true,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/ci-canvas-opening-route",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      const startedAt = 1_785_519_812_888;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const route = {
        active: true,
        durationMs: 6_350,
        legal: true,
        reachesDestination: true,
        sampledPointsLegal: true,
        spaceId: "street:south-quay",
        target: { x: 17, y: 9 },
        targetLocationId: "tea-house",
        tilePath: [
          { x: 3, y: 9 },
          { x: 17, y: 9 },
        ],
        visualObstaclesClear: true,
        worldPath: [
          { x: 331, y: 688 },
          { x: 1_338, y: 656 },
        ],
      };
      const sample = (
        progress,
        offsetMs,
        { generation = 2, hud = "DAY 1 11:05", routeOverrides = {} } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: generation,
        route: { ...route, progress, ...routeOverrides },
        source: "movement-probe-recorder",
      });
      const samples = {
        afterFirst: sample(0.2, 200),
        afterSecond: sample(0.5, 800),
        beforeFirst: sample(0.04, 140),
        beforeSecond: sample(0.34, 740),
        opening: sample(0.003, 0),
        secondTrigger: sample(0.32, 600),
      };
      const geometry = {
        canvas: {
          height: 625,
          index: 0,
          rect: { height: 625, left: 0, top: 0, width: 1365 },
          width: 1365,
        },
        contextType: "webgl",
        crop: { height: 360, width: 640, x: 362, y: 132 },
        renderScale: 1,
        sceneViewport: { height: 625, width: 1365, x: 0, y: 0 },
      };
      const rawCanvasPosition = (changed = false) => {
        const pixels = Buffer.alloc(640 * 360 * 4);
        for (let offset = 0; offset < pixels.length; offset += 4) {
          pixels[offset] = 52;
          pixels[offset + 1] = 96;
          pixels[offset + 2] = 132;
          pixels[offset + 3] = 255;
        }
        if (changed) {
          for (let y = 120; y < 180; y += 1) {
            for (let x = 280; x < 360; x += 1) {
              const offset = (y * 640 + x) * 4;
              pixels[offset] = 184;
              pixels[offset + 1] = 72;
              pixels[offset + 2] = 48;
            }
          }
        }
        return pixels;
      };
      const rawCanvasCapture = ({
        afterProbe,
        captureBeforeProbe,
        changed = false,
        offsetMs,
      }) => ({
        afterProbe,
        captureBeforeProbe,
        data: rawCanvasPosition(changed).toString("base64"),
        metadata: {
          browserPayloadFormat: "rgba-base64",
          capturedAtEpochMs: startedAt + offsetMs,
          capturedAtMonotonicMs: offsetMs,
          contextLost: false,
          defaultFramebuffer: true,
          format: "rgba",
          geometry,
          initialRenderedAtMs: offsetMs - 50,
          rawByteLength: 640 * 360 * 4,
          rawHeight: 360,
          rawRowOrientation: "bottom-up",
          rawWidth: 640,
          renderedAtMs: offsetMs - 8,
          requestedAtEpochMs: startedAt + offsetMs - 25,
          source: "in-page-route-canvas",
          timestamp: (startedAt + offsetMs) / 1_000,
        },
      });
      const captureResults = [
        rawCanvasCapture({
          afterProbe: samples.afterFirst,
          captureBeforeProbe: samples.beforeFirst,
          offsetMs: 150,
        }),
        rawCanvasCapture({
          afterProbe: samples.afterSecond,
          captureBeforeProbe: samples.beforeSecond,
          changed: true,
          offsetMs: 750,
        }),
      ];
      const commands = [];
      let allowFinalStop = false;
      routeSession.send = async (method, params, options) => {
        commands.push({ method, options, params });
        assert.notEqual(
          method,
          "Page.captureScreenshot",
          "Opening canvas recovery must not use Page.captureScreenshot.",
        );
        if (method === "Page.stopScreencast" && !allowFinalStop) {
          assert.fail("Opening canvas recovery must not pause screencast.");
        }
        if (method === "Runtime.evaluate") {
          const captured = captureResults.shift();
          assert.ok(captured, "Unexpected extra canvas capture.");
          assert.match(params.expression, /gl\.readPixels\(/);
          assert.match(params.expression, /requestAnimationFrame\(resolve\)/);
          assert.match(
            params.expression,
            /sampleAutoplayRouteRecorderAtOrAfter/,
          );
          assert.match(
            params.expression,
            /while \(!routeIsLegal\(afterProbe\)\)/,
          );
          assert.doesNotMatch(params.expression, /\.toBlob\(|\.toDataURL\(/);
          assert.doesNotMatch(params.expression, /createImageData|putImageData/);
          assert.match(params.expression, /rawRowOrientation: "bottom-up"/);
          acceptedSamples.push(
            captured.captureBeforeProbe,
            captured.afterProbe,
          );
          return { result: { result: { value: captured } } };
        }
        return {};
      };
      await routeSession.startAutoplayScreencast();
      routeSession.screencast.startedAtEpochMs = startedAt;
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: 1,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [samples.opening],
      });
      const earlyHudFrame = {
        data: Buffer.from("full-frame-hud-paint").toString("base64"),
        metadata: { timestamp: (startedAt + 14) / 1_000 },
        sequence: 865,
      };
      routeCompositingSleepFixture = async (minimumEpochMs) => {
        assert.equal(minimumEpochMs, startedAt + 125);
        routeSession.screencast.lastSequence = earlyHudFrame.sequence;
        routeSession.screencast.routeFrameHistory.push(earlyHudFrame);
        routeSession.archiveAutoplayRouteFrames({
          acceptedCount: 1,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: [samples.opening],
        });
      };
      const acceptedSamples = [samples.opening];
      routeSession.readOrRearmAutoplayRouteCaptureRecorder = async () => ({
        acceptedCount: acceptedSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [...acceptedSamples],
      });
      const freshSamples = [samples.secondTrigger];
      routeSession.sampleAutoplayRouteCaptureRecorder = async () => {
        const next = freshSamples.shift() ?? null;
        if (next) acceptedSamples.push(next);
        return next;
      };
      proactiveRouteCaptureFixture = async (options) => {
        return proactiveCapturePolicy(options);
      };

      const validateFullFrame = ({ frame, paintProbe: framePaintProbe }) => ({
        buffer: Buffer.from(frame.data, "base64"),
        height: 375,
        paintProbe: framePaintProbe,
        textPaint: {
          maximumContainerGeometryDeltaCssPx: 0,
          maximumTextGeometryDeltaCssPx: 0,
          regionCount: 9,
          surfaces: ["hud", "dock", "rail"],
        },
        width: 819,
      });
      try {
        await routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: samples.opening,
          expectedTargetLocationId: "tea-house",
          label: "ci-non-pausing-canvas-opening-route",
        });
        assert.equal(
          captureResults.length,
          0,
          JSON.stringify({
            captureStatus:
              routeSession.screencast.routeFrameWindowCaptureStatus,
            pendingSample:
              routeSession.screencast.routeFrameWindowCapturePendingSample,
            rejections: routeSession.screencast.routeFrameWindowRejections,
            transportEvents: routeSession.transportEvents,
            windows: routeSession.autoplayRouteFrameWindows(),
          }),
        );
        assert.equal(routeSession.screencast.routeCanvasCaptureCount, 2);
        assert.equal(routeSession.screencast.routeVisualCapturePauseCount, 0);
        assert.equal(routeSession.screencast.routeVisualCaptureResumeCount, 0);
        assert.equal(
          routeSession.screencast.routeVisualCaptureTransportStatus,
          "active",
        );
        assert.equal(routeSession.autoplayRouteFrameWindows().length, 2);
        const runtimeCaptureCommands = commands.filter(
          ({ method }) => method === "Runtime.evaluate",
        );
        assert.equal(runtimeCaptureCommands.length, 2);
        assert.ok(
          runtimeCaptureCommands.every(
            ({ options }) =>
              options.timeoutMs > 0 && options.timeoutMs <= 1_750,
          ),
          "Two-position canvas scheduling exceeded the bounded response budget.",
        );
        assert.equal(
          commands.filter(({ method }) => method === "Page.stopScreencast")
            .length,
          0,
        );

        const orientationPng = routeSession.encodeAutoplayRouteCanvasRgbaPng({
          height: 2,
          pixels: Buffer.from([
            220, 30, 20, 255,
            15, 40, 210, 255,
          ]),
          rowOrientation: "bottom-up",
          width: 1,
        });
        const orientedPixels = decodePngPixels(orientationPng);
        assert.deepEqual(
          [...orientedPixels.pixels],
          [15, 40, 210, 255, 220, 30, 20, 255],
          "Node PNG encoding did not flip WebGL bottom-up rows exactly once.",
        );

        const assertRawCaptureRejected = async (mutate, pattern) => {
          const captured = rawCanvasCapture({
            afterProbe: samples.afterFirst,
            captureBeforeProbe: samples.beforeFirst,
            offsetMs: 150,
          });
          mutate(captured);
          routeSession.send = async (method, params) => {
            if (method !== "Runtime.evaluate") return {};
            assert.doesNotMatch(params.expression, /\.toBlob\(|\.toDataURL\(/);
            return { result: { result: { value: captured } } };
          };
          await assert.rejects(
            routeSession.captureAutoplayRouteCanvasVisualFrame({
              beforeProbe: samples.opening,
              expectedTargetLocationId: "tea-house",
            }),
            pattern,
          );
        };
        await assertRawCaptureRejected(
          (captured) => {
            captured.metadata.rawWidth -= 1;
          },
          /raw width did not match its crop geometry/,
        );
        await assertRawCaptureRejected(
          (captured) => {
            const shortPixels = rawCanvasPosition().subarray(0, -4);
            captured.data = shortPixels.toString("base64");
            captured.metadata.rawByteLength = shortPixels.length;
          },
          /raw byte length did not match 640x360 RGBA/,
        );
        await assertRawCaptureRejected(
          (captured) => {
            captured.metadata.rawRowOrientation = "top-down";
          },
          /must preserve WebGL bottom-up orientation/,
        );

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: [earlyHudFrame],
            expectedTargetLocationId: "tea-house",
            forceCanvasFallback: true,
            frames: [earlyHudFrame],
            label: "30652039449 constrained opening route",
            recordedWindows: routeSession.autoplayRouteFrameWindows(),
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: validateFullFrame,
          });
        assert.equal(trajectory.start.evidenceSource, "canvas-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "canvas-route-frame");
        assert.equal(
          trajectory.start.validated.textPaint.routeHudContinuityBasis,
          "validated-screencast-hud-paint-and-exact-canvas-route-state",
        );
        assert.equal(
          trajectory.mid.validated.textPaint.routeCanvasChangedPixelRatio,
          0.01,
        );
        assert.ok(
          recordedRoutePolicy.autoplayRecordedRouteWindowsHaveDistinctProgress(
            trajectory.start,
            trajectory.mid,
          ),
        );

        const windows = routeSession.autoplayRouteFrameWindows();
        const constrainedRunnerOpeningFrame = {
          data: Buffer.from("fdb8867-full-frame-hud-and-city").toString(
            "base64",
          ),
          metadata: { timestamp: (startedAt + 68) / 1_000 },
          sequence: 865,
          source: "screencast",
        };
        const mixedTrajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            archivedFrames: [constrainedRunnerOpeningFrame],
            expectedTargetLocationId: "tea-house",
            forceCanvasFallback: true,
            frames: [constrainedRunnerOpeningFrame],
            label: "fdb8867 and timing-final1 mixed opening route",
            recordedWindows: [windows[1]],
            samples: routeSession.autoplayRouteCaptureSamples(),
            validateFrame: validateFullFrame,
          });
        assert.equal(mixedTrajectory.start.evidenceSource, "screencast-frame");
        assert.equal(mixedTrajectory.mid.evidenceSource, "canvas-route-frame");
        assert.equal(mixedTrajectory.start.frame.sequence, 865);
        assert.equal(mixedTrajectory.mid.frame.sequence, 867);
        assert.equal(
          mixedTrajectory.mid.validated.textPaint.routeMixedEvidenceBasis,
          "independently-validated-screencast-and-canvas-positions-with-exact-route-and-hud-identity",
        );
        for (const position of [
          mixedTrajectory.start,
          mixedTrajectory.mid,
        ]) {
          assert.equal(
            position.validated.textPaint.routeHudContinuityBasis,
            "exact-route-identity-and-per-frame-hud-paint",
            "Both independently validated mixed positions must carry the accepted exact-identity HUD continuity basis.",
          );
        }
        assert.equal(
          mixedTrajectory.mid.validated.textPaint
            .routeMixedTransportDimensionsCompared,
          false,
          "Mixed visual transports must never enter raw cross-dimension pixel comparison.",
        );
        assert.equal(
          mixedTrajectory.mid.validated.textPaint
            .hudCorroborationFrameSequence,
          constrainedRunnerOpeningFrame.sequence,
        );
        assert.ok(
          recordedRoutePolicy.autoplayRecordedRouteWindowsHaveDistinctProgress(
            mixedTrajectory.start,
            mixedTrajectory.mid,
          ),
        );
        assert.equal(
          routeSession.acceptAutoplayRouteRenderedFrameTrajectory(
            mixedTrajectory,
          ),
          true,
        );
        assert.equal(
          routeSession.autoplayRouteVisualWindowCaptureComplete(),
          true,
          "Forced mode must complete from one validated canvas position only after the mixed trajectory is accepted.",
        );

        const expectRejectedMixedTrajectory = (mutate, pattern) => {
          const rejectedFrame = structuredClone(constrainedRunnerOpeningFrame);
          const rejectedWindow = structuredClone(windows[1]);
          mutate({ frame: rejectedFrame, window: rejectedWindow });
          assert.throws(
            () =>
              recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
                archivedFrames: [rejectedFrame],
                expectedTargetLocationId: "tea-house",
                forceCanvasFallback: true,
                frames: [rejectedFrame],
                label: "rejected mixed opening route",
                recordedWindows: [rejectedWindow],
                samples: routeSession.autoplayRouteCaptureSamples(),
                validateFrame: validateFullFrame,
              }),
            pattern,
          );
        };
        expectRejectedMixedTrajectory(
          ({ window }) => {
            window.beforeProbe.route.worldPath = [{ x: 1, y: 1 }];
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedMixedTrajectory(
          ({ window }) => {
            window.beforeProbe.paintProbe.stableRegions[0].text =
              "DAY 1 11:10";
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedMixedTrajectory(
          ({ window }) => {
            window.beforeProbe.recorderGeneration += 1;
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedMixedTrajectory(
          ({ window }) => {
            window.beforeProbe.route.progress = 0.04;
            window.afterProbe.route.progress = 0.09;
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedMixedTrajectory(
          ({ frame, window }) => {
            window.frame.sequence = frame.sequence;
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedMixedTrajectory(
          ({ frame, window }) => {
            window.frame.metadata.timestamp =
              frame.metadata.timestamp + 0.05;
          },
          /did not contain two distinct legal rendered positions/,
        );

        const expectRejectedTrajectory = (mutate, pattern) => {
          const rejectedWindows = structuredClone(windows);
          mutate(rejectedWindows);
          assert.throws(
            () =>
              recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
                archivedFrames: [earlyHudFrame],
                expectedTargetLocationId: "tea-house",
                forceCanvasFallback: true,
                frames: [earlyHudFrame],
                label: "rejected canvas opening route",
                recordedWindows: rejectedWindows,
                samples: routeSession.autoplayRouteCaptureSamples(),
                validateFrame: validateFullFrame,
              }),
            pattern,
          );
        };
        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              archivedFrames: [],
              expectedTargetLocationId: "tea-house",
              forceCanvasFallback: true,
              frames: [],
              label: "missing HUD corroboration",
              recordedWindows: windows,
              samples: routeSession.autoplayRouteCaptureSamples(),
              validateFrame: validateFullFrame,
            }),
          /lacked validated full-frame screencast HUD corroboration/,
        );
        const mislabeledDirectWindows = structuredClone(windows);
        for (const recordedWindow of mislabeledDirectWindows) {
          recordedWindow.frame.source = "screencast";
          recordedWindow.frame.metadata.source = "screencast";
        }
        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              archivedFrames: [earlyHudFrame],
              expectedTargetLocationId: "tea-house",
              forceCanvasFallback: true,
              frames: [earlyHudFrame],
              label: "forced canvas rejects screencast recorded windows",
              recordedWindows: mislabeledDirectWindows,
              samples: routeSession.autoplayRouteCaptureSamples(),
              validateFrame: validateFullFrame,
            }),
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[0].frame.metadata.timestamp =
              (rejected[0].afterProbe.capturedAtEpochMs + 1) / 1_000;
          },
          /did not contain two distinct legal rendered positions/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.metadata.contextLost = true;
          },
          /Expected values to be strictly equal|contextLost/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.metadata.defaultFramebuffer = false;
          },
          /Expected values to be strictly equal|defaultFramebuffer/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.metadata.renderedAtMs =
              rejected[1].frame.metadata.initialRenderedAtMs;
          },
          /falsy value/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.metadata.geometry = structuredClone(
              rejected[1].frame.metadata.geometry,
            );
            rejected[1].frame.metadata.geometry.canvas.width += 1;
          },
          /Expected values to be strictly deep-equal/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.data = Buffer.from("blank").toString("base64");
          },
          /strictly unequal[\s\S]*'blank'/,
        );
        expectRejectedTrajectory(
          (rejected) => {
            rejected[1].frame.data = rejected[0].frame.data;
          },
          /Expected "actual" not to be strictly deep-equal/,
        );
        for (const mutateIdentity of [
          (rejected) => {
            rejected[1].beforeProbe.route.worldPath = [{ x: 1, y: 1 }];
          },
          (rejected) => {
            rejected[1].beforeProbe.paintProbe.stableRegions[0].text =
              "DAY 1 11:10";
          },
          (rejected) => {
            rejected[1].beforeProbe.recorderGeneration += 1;
          },
          (rejected) => {
            rejected[1].beforeProbe.route.progress = 0.01;
            rejected[1].afterProbe.route.progress = 0.02;
          },
          (rejected) => {
            rejected[1].afterProbe.route.active = false;
          },
        ]) {
          expectRejectedTrajectory(
            mutateIdentity,
            /did not contain two distinct legal rendered positions/,
          );
        }
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        routeCompositingSleepFixture = (minimumEpochMs) =>
          sleepUntilEpochMs(minimumEpochMs, {
            sleepFor: (milliseconds) =>
              new Promise((resolve) => setTimeout(resolve, milliseconds)),
          });
        allowFinalStop = true;
        await routeSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "delayed dense route rearm retains the triggering opening sample",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/delayed-dense-route-rearm",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      routeSession.send = async () => ({});
      await routeSession.startAutoplayScreencast();
      routeSession.autoplayRouteArchiveNeedsProactiveOpeningCapture = () =>
        false;
      const startedAt = routeSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.004, 0),
        sample(0.004, 2),
        sample(0.18, 200),
        sample(0.31, 400),
        sample(0.51, 600),
        sample(0.7, 800),
      ];
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: 2,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 2),
      });

      let markRearmStarted;
      const rearmStarted = new Promise((resolve) => {
        markRearmStarted = resolve;
      });
      let releaseRearm;
      const rearmHeld = new Promise((resolve) => {
        releaseRearm = resolve;
      });
      routeSession.rearmAutoplayScreencastForRouteCapture = async () => {
        markRearmStarted();
        await rearmHeld;
        routeSession.screencast.everyNthFrame = 1;
        return true;
      };
      routeSession.restoreAutoplayScreencastCadence = async () => {
        routeSession.screencast.everyNthFrame = 2;
        return true;
      };

      const queuedSamples = [openingSamples[2], openingSamples[4]];
      routeSession.sampleAutoplayRouteCaptureRecorder = async () =>
        queuedSamples.shift() ?? null;
      const capturedBeforeProgress = [];
      routeSession.captureAutoplayScreencastRouteFrameWindow = async ({
        beforeProbe,
        expectedTargetLocationId,
      }) => {
        const captureIndex = capturedBeforeProgress.length;
        capturedBeforeProgress.push(beforeProbe.route.progress);
        const afterProbe = openingSamples[captureIndex === 0 ? 3 : 5];
        const recorder = {
          acceptedCount: captureIndex === 0 ? 4 : 6,
          expectedTargetLocationId,
          generation: 2,
          samples: openingSamples.slice(0, captureIndex === 0 ? 4 : 6),
        };
        routeSession.archiveAutoplayRouteFrames(recorder);
        return routeSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe,
            beforeProbe,
            frame: {
              data: Buffer.from(
                `delayed-rearm-position-${captureIndex}`,
              ).toString("base64"),
              metadata: {
                timestamp:
                  (beforeProbe.capturedAtEpochMs + 125) / 1_000,
              },
              sequence: captureIndex + 1,
            },
          },
          recorder,
        });
      };

      try {
        const capture = routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[0],
          expectedTargetLocationId: "tea-house",
          label: "delayed-dense-route-rearm",
        });
        await rearmStarted;
        const coalescedCapture =
          routeSession.scheduleAutoplayRouteVisualWindowCapture({
            beforeProbe: openingSamples[1],
            expectedTargetLocationId: "tea-house",
            label: "delayed-dense-route-rearm-coalesced",
          });
        assert.equal(coalescedCapture, capture);
        releaseRearm();
        await capture;

        assert.deepEqual(capturedBeforeProgress, [0.004, 0.51]);
        assert.equal(routeSession.autoplayRouteFrameWindows().length, 2);
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "complete",
        );
      } finally {
        releaseRearm();
        await routeSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "a delayed first capture at progress 0.824 remains a truthful failure",
    async () => {
      const routeSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/late-dense-route-rearm",
        url: "http://127.0.0.1/",
      });
      routeSession.socket = { destroyed: false, writable: true };
      routeSession.send = async () => ({});
      await routeSession.startAutoplayScreencast();
      const startedAt = routeSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.004, 0),
        sample(0.006, 16),
        sample(0.006, 2_603),
        sample(0.18, 3_000),
        sample(0.36, 3_300),
        sample(0.54, 3_600),
        sample(0.7, 3_900),
        sample(0.824, 4_136),
      ];
      routeSession.screencast.lastSequence = 2;
      routeSession.screencast.routeFrameHistory.push(
        {
          data: Buffer.from("late-rearm-archived-position-1").toString(
            "base64",
          ),
          metadata: { timestamp: (startedAt + 2_625) / 1_000 },
          sequence: 1,
        },
        {
          data: Buffer.from("late-rearm-archived-position-2").toString(
            "base64",
          ),
          metadata: { timestamp: (startedAt + 4_139) / 1_000 },
          sequence: 2,
        },
      );
      routeSession.archiveAutoplayRouteFrames({
        acceptedCount: openingSamples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples,
      });
      assert.equal(routeSession.screencast.routeFrameArchive.length, 2);
      assert.equal(routeSession.screencast.routeFrameObservedSegmentCount, 2);
      assert.equal(
        routeSession.screencast.routeFrameOpeningSegment.sampleCount,
        8,
      );
      assert.equal(
        routeSession.screencast.routeFrameOpeningSegment.lastProgress,
        0.824,
      );

      let markRearmStarted;
      const rearmStarted = new Promise((resolve) => {
        markRearmStarted = resolve;
      });
      let releaseRearm;
      const rearmHeld = new Promise((resolve) => {
        releaseRearm = resolve;
      });
      routeSession.rearmAutoplayScreencastForRouteCapture = async () => {
        markRearmStarted();
        await rearmHeld;
        routeSession.screencast.everyNthFrame = 1;
        return true;
      };
      routeSession.restoreAutoplayScreencastCadence = async () => {
        routeSession.screencast.everyNthFrame = 2;
        return true;
      };
      routeSession.sampleAutoplayRouteCaptureRecorder = async () => null;
      let attemptedProgress = null;
      let attemptedTimeoutMs = null;
      routeSession.captureAutoplayScreencastRouteFrameWindow = async ({
        beforeProbe,
        timeoutMs,
      }) => {
        attemptedProgress = beforeProbe.route.progress;
        attemptedTimeoutMs = timeoutMs;
        throw new Error(
          `Timed out waiting ${timeoutMs}ms for an asynchronous autoplay screencast frame.`,
        );
      };

      try {
        const capture = routeSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[0],
          expectedTargetLocationId: "tea-house",
          label: "late-dense-route-rearm",
        });
        await rearmStarted;
        for (const pendingSample of openingSamples.slice(1)) {
          assert.equal(
            routeSession.scheduleAutoplayRouteVisualWindowCapture({
              beforeProbe: pendingSample,
              expectedTargetLocationId: "tea-house",
              label: "late-dense-route-rearm-coalesced",
            }),
            capture,
          );
        }
        releaseRearm();
        await capture;

        const constrainedRunnerFrameBudgetMs = Math.floor(
          5_040 * (1 - 0.824) - 125 * 2,
        );
        assert.equal(attemptedProgress, 0.824);
        assert.equal(constrainedRunnerFrameBudgetMs, 637);
        assert.equal(
          attemptedTimeoutMs,
          Math.min(60, constrainedRunnerFrameBudgetMs),
        );
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureAttemptCount,
          1,
        );
        assert.equal(routeSession.autoplayRouteFrameWindows().length, 0);
        assert.equal(
          routeSession.screencast.routeRenderedFrameEvidenceAccepted,
          false,
        );
        assert.equal(
          routeSession.screencast.routeFrameWindowCaptureStatus,
          "failed",
        );
        assert.match(
          routeSession.screencast.routeFrameWindowCaptureError,
          /Timed out waiting 60ms/,
        );
        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
              expectedTargetLocationId: "tea-house",
              frames: [routeSession.screencast.routeFrameArchive[1]],
              label: "late first capture",
              recordedWindows: routeSession.autoplayRouteFrameWindows(),
              samples: routeSession.autoplayRouteCaptureSamples(),
              validateFrame: ({ frame, paintProbe: framePaintProbe }) => ({
                buffer: Buffer.from(frame.data, "base64"),
                paintProbe: framePaintProbe,
                textPaint: {},
              }),
              validateStableFramePair: () => ({}),
            }),
          /did not contain two distinct legal rendered positions/,
        );
      } finally {
        releaseRearm();
        await routeSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "failed dense route rearm restores the prior screencast cadence",
    async () => {
      const recoverySession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/rearm-recovery",
        url: "http://127.0.0.1/",
      });
      recoverySession.socket = { destroyed: false, writable: true };
      const commands = [];
      let denseStartRejected = false;
      recoverySession.send = async (method, params) => {
        commands.push({ method, params });
        if (
          method === "Page.startScreencast" &&
          params?.everyNthFrame === 1 &&
          !denseStartRejected
        ) {
          denseStartRejected = true;
          throw new Error("synthetic dense cadence rejection");
        }
        return {};
      };
      await recoverySession.startAutoplayScreencast();
      try {
        await assert.rejects(
          recoverySession.rearmAutoplayScreencastForRouteCapture(
            "dense-rearm-recovery",
          ),
          /prior cadence was restored/,
        );
        assert.equal(recoverySession.screencast.everyNthFrame, 2);
        assert.equal(
          recoverySession.screencast.routeVisualCaptureTransportStatus,
          "active",
        );
        assert.equal(
          recoverySession.screencast.routeScreencastRearmStatus,
          "failed-prior-cadence-recovered",
        );
        assert.match(
          recoverySession.screencast.routeScreencastRearmError,
          /synthetic dense cadence rejection/,
        );
        assert.deepEqual(
          commands.map(({ method, params }) => [
            method,
            params?.everyNthFrame ?? null,
          ]),
          [
            ["Page.startScreencast", 2],
            ["Page.stopScreencast", null],
            ["Page.startScreencast", 1],
            ["Page.startScreencast", 2],
          ],
        );
      } finally {
        await recoverySession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "direct opening frames receive grace before screenshot fallback",
    { skip: "Opening-route screenshot fallback was removed." },
    async () => {
      const graceSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/direct-route-grace",
        url: "http://127.0.0.1/",
      });
      graceSession.socket = { destroyed: false, writable: true };
      graceSession.send = async () => ({});
      await graceSession.startAutoplayScreencast();
      const startedAt = graceSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe,
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      });
      const samples = [
        sample(0.005, 0),
        sample(0.015, 10),
        sample(0.18, 200),
        sample(0.31, 300),
        sample(0.51, 500),
        sample(0.64, 600),
        sample(0.8, 750),
      ];
      graceSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      graceSession.screencast.routeFrameSampleCount = 1;
      graceSession.archiveAutoplayRouteFrames({
        acceptedCount: 2,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: samples.slice(0, 2),
      });
      let proactiveCaptureCount = 0;
      proactiveRouteCaptureFixture = async () => {
        proactiveCaptureCount += 1;
        return null;
      };

      try {
        await graceSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: samples[1],
          expectedTargetLocationId: "tea-house",
          label: "direct-route-grace",
        });
        assert.equal(proactiveCaptureCount, 0);
        assert.equal(
          graceSession.screencast.routeFrameWindowCaptureStatus,
          "waiting-for-direct-screencast-evidence",
        );

        graceSession.screencast.routeFrameHistory.push({
          data: Buffer.from("unsettled-route-frame").toString("base64"),
          metadata: { timestamp: (startedAt + 42) / 1_000 },
          sequence: 1,
        });
        graceSession.archiveAutoplayRouteFrames({
          acceptedCount: 3,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: samples.slice(0, 3),
        });
        assert.equal(graceSession.screencast.routeFrameArchive.length, 1);

        await graceSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: samples[2],
          expectedTargetLocationId: "tea-house",
          label: "direct-route-grace",
        });
        assert.equal(
          proactiveCaptureCount,
          0,
          "One legal direct opening frame must keep the stream alive instead of invoking the slow screenshot fallback.",
        );
        assert.equal(
          graceSession.screencast.routeFrameWindowCaptureStatus,
          "waiting-for-second-direct-screencast-frame",
        );

        graceSession.screencast.routeFrameHistory.push({
          data: Buffer.from("direct-route-start").toString("base64"),
          metadata: { timestamp: (startedAt + 250) / 1_000 },
          sequence: 2,
        });
        graceSession.screencast.routeFrameSampleCount = 2;
        graceSession.archiveAutoplayRouteFrames({
          acceptedCount: 4,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: samples.slice(0, 4),
        });
        assert.equal(graceSession.screencast.routeFrameArchive.length, 2);

        await graceSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: samples[3],
          expectedTargetLocationId: "tea-house",
          label: "direct-route-grace",
        });
        assert.equal(proactiveCaptureCount, 0);

        graceSession.screencast.routeFrameHistory.push({
          data: Buffer.from("direct-route-mid").toString("base64"),
          metadata: { timestamp: (startedAt + 650) / 1_000 },
          sequence: 3,
        });
        graceSession.screencast.routeFrameSampleCount = 3;
        graceSession.archiveAutoplayRouteFrames({
          acceptedCount: samples.length,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples,
        });
        assert.equal(graceSession.screencast.routeFrameArchive.length, 3);

        await graceSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: samples.at(-1),
          expectedTargetLocationId: "tea-house",
          label: "direct-route-grace",
        });
        assert.equal(proactiveCaptureCount, 0);
        assert.equal(
          graceSession.screencast.routeFrameWindowCaptureStatus,
          "waiting-for-direct-screencast-validation",
        );
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: graceSession.autoplayRouteFrameHistory(),
            label: "unsettled-first-frame opening route",
            recordedWindows: graceSession.autoplayRouteFrameWindows(),
            samples: graceSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame: renderedFrame, paintProbe: framePaintProbe }) => ({
              buffer: Buffer.from(renderedFrame.data, "base64"),
              height: 625,
              paintProbe: framePaintProbe,
              textPaint: {},
              width: 1365,
            }),
            validateStableFramePair: () => ({ hudPixelDifferenceRatio: 0 }),
          });
        assert.equal(trajectory.start.frame.sequence, 2);
        assert.equal(trajectory.mid.frame.sequence, 3);
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        await graceSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "failed screenshot fallback requires a fresh opening route sample",
    { skip: "Opening-route screenshot fallback was removed." },
    async () => {
      const retrySession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/fresh-route-retry",
        url: "http://127.0.0.1/",
      });
      retrySession.socket = { destroyed: false, writable: true };
      retrySession.send = async () => ({});
      await retrySession.startAutoplayScreencast();
      const startedAt = retrySession.screencast.startedAtEpochMs;
      const sample = (progress, offsetMs) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          regions: [{ surface: "hud", text: "DAY 1 11:05" }],
          stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
          viewport: { height: 625, width: 1365 },
        },
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: 5_040,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId: "street:south-quay",
          target: { x: 17, y: 9 },
          targetLocationId: "tea-house",
          tilePath: [
            { x: 3, y: 9 },
            { x: 17, y: 9 },
          ],
          visualObstaclesClear: true,
          worldPath: [
            { x: 331, y: 688 },
            { x: 1_338, y: 656 },
          ],
        },
        source: "movement-probe-recorder",
      });
      const opening = sample(0.005, 0);
      const firstAttempt = sample(0.12, 10);
      const freshAttempt = sample(0.24, 20);
      retrySession.archiveAutoplayRouteFrames({
        acceptedCount: 2,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [opening, firstAttempt],
      });
      retrySession.sampleAutoplayRouteCaptureRecorder = async () => null;
      let proactiveCaptureCount = 0;
      proactiveRouteCaptureFixture = async () => {
        proactiveCaptureCount += 1;
        return null;
      };

      try {
        await retrySession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: firstAttempt,
          expectedTargetLocationId: "tea-house",
          label: "fresh-route-retry",
        });
        assert.equal(proactiveCaptureCount, 1);
        assert.equal(
          retrySession.screencast.routeFrameWindowLastAttemptedSampleAtEpochMs,
          firstAttempt.capturedAtEpochMs,
        );

        await retrySession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: firstAttempt,
          expectedTargetLocationId: "tea-house",
          label: "fresh-route-retry",
        });
        assert.equal(proactiveCaptureCount, 1);
        assert.equal(
          retrySession.screencast.routeFrameWindowCaptureStatus,
          "waiting-for-fresh-opening-route-sample",
        );

        retrySession.archiveAutoplayRouteFrames({
          acceptedCount: 3,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: [opening, firstAttempt, freshAttempt],
        });
        await retrySession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: freshAttempt,
          expectedTargetLocationId: "tea-house",
          label: "fresh-route-retry",
        });
        assert.equal(proactiveCaptureCount, 2);
        assert.equal(
          retrySession.screencast.routeFrameWindowLastAttemptedSampleAtEpochMs,
          freshAttempt.capturedAtEpochMs,
        );
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        await retrySession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "archived opening frames survive direct window budget exhaustion",
    async () => {
      const archivePromotionSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl:
          "ws://127.0.0.1:9222/devtools/page/archive-promotion-route",
        url: "http://127.0.0.1/",
      });
      archivePromotionSession.socket = { destroyed: false, writable: true };
      archivePromotionSession.send = async () => ({});
      await archivePromotionSession.startAutoplayScreencast();
      try {
        const startedAt =
          archivePromotionSession.screencast.startedAtEpochMs;
        const paintProbe = {
          regions: [{ surface: "hud", text: "DAY 1 11:05" }],
          stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
          viewport: { height: 625, width: 1365 },
        };
        const sample = (progress, offsetMs) => ({
          capturedAtEpochMs: startedAt + offsetMs,
          capturedAtMonotonicMs: offsetMs,
          paintProbe,
          recorderGeneration: 2,
          route: {
            active: true,
            durationMs: 5_040,
            legal: true,
            progress,
            reachesDestination: true,
            sampledPointsLegal: true,
            spaceId: "street:south-quay",
            target: { x: 17, y: 9 },
            targetLocationId: "tea-house",
            tilePath: [
              { x: 3, y: 9 },
              { x: 17, y: 9 },
            ],
            visualObstaclesClear: true,
            worldPath: [
              { x: 331, y: 688 },
              { x: 1_338, y: 656 },
            ],
          },
          source: "movement-probe-recorder",
        });
        const openingSamples = [
          sample(0.006, 0),
          sample(0.5, 1_080),
          sample(0.72, 2_160),
          sample(0.929, 3_249),
        ];
        const frame = (sequence, offsetMs, pixels) => ({
          data: Buffer.from(pixels).toString("base64"),
          metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
          sequence,
        });
        const archivedFrames = [
          frame(1, 68, "opening-route-rendered-at-progress-0286"),
          frame(2, 3_280, "opening-route-rendered-at-progress-0929"),
        ];
        archivePromotionSession.screencast.routeFrameHistory.push(
          ...archivedFrames,
        );
        archivePromotionSession.archiveAutoplayRouteFrames({
          acceptedCount: openingSamples.length,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples: openingSamples,
        });
        archivePromotionSession.screencast.routeFrameWindowCaptureAttemptCount =
          1;
        archivePromotionSession.screencast.routeFrameWindowCaptureStatus =
          "dense-route-rearm-complete-awaiting-direct-validation";
        archivePromotionSession.recordAutoplayRouteFrameWindowRejection({
          beforeProbe: openingSamples.at(-1),
          reason: "opening-route-frame-budget-exhausted",
        });

        assert.equal(
          archivePromotionSession.autoplayRouteArchivedFrames().length,
          2,
        );
        assert.equal(
          archivePromotionSession.autoplayRouteFrameWindows().length,
          0,
        );
        const selectionOptions = {
          expectedTargetLocationId: "tea-house",
          frames: [],
          label: "CI archive promotion opening route",
          recordedWindows:
            archivePromotionSession.autoplayRouteFrameWindows(),
          samples: archivePromotionSession.autoplayRouteCaptureSamples(),
          validateFrame: ({ frame: renderedFrame, paintProbe: framePaint }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            height: 625,
            paintProbe: framePaint,
            textPaint: {},
            width: 1365,
          }),
          validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
            assert.notDeepEqual(afterBuffer, beforeBuffer);
            return { hudPixelDifferenceRatio: 0 };
          },
        };
        assert.throws(
          () =>
            recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory(
              selectionOptions,
            ),
          /Direct frame candidates: 0\. Archived frame candidates: 0\./,
        );

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            ...selectionOptions,
            archivedFrames:
              archivePromotionSession.autoplayRouteArchivedFrames(),
          });
        assert.equal(trajectory.start.frame.sequence, 1);
        assert.equal(trajectory.mid.frame.sequence, 2);
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.006);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.72);
        assert.equal(
          trajectory.start.validated.textPaint.routeFrameEvidenceBasis,
          "archived-screencast-frame-matched-to-legal-route-sample",
        );
        assert.equal(
          trajectory.mid.validated.textPaint.routeFrameEvidenceBasis,
          "archived-screencast-frame-matched-to-legal-route-sample",
        );
        assert.equal(
          trajectory.mid.beforeProbe.route.progress -
            trajectory.start.afterProbe.route.progress,
          0.714,
        );
        assert.equal(
          archivePromotionSession.acceptAutoplayRouteRenderedFrameTrajectory(
            trajectory,
          ),
          true,
        );
      } finally {
        await archivePromotionSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "archive promotion rejects stale, mismatched, and one-frame evidence",
    () => {
      const startedAt = Date.now();
      const sample = (
        progress,
        offsetMs,
        { hud = "DAY 1 11:05", path = "opening" } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
          viewport: { height: 625, width: 1365 },
        },
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: path === "opening" ? 5_040 : 840,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId:
            path === "opening" ? "street:south-quay" : "interior:tea-house",
          target: path === "opening" ? { x: 17, y: 9 } : { x: 8, y: 3 },
          targetLocationId: "tea-house",
          tilePath:
            path === "opening"
              ? [
                  { x: 3, y: 9 },
                  { x: 17, y: 9 },
                ]
              : [
                  { x: 7, y: 4 },
                  { x: 8, y: 3 },
                ],
          visualObstaclesClear: true,
          worldPath:
            path === "opening"
              ? [
                  { x: 331, y: 688 },
                  { x: 1_338, y: 656 },
                ]
              : [
                  { x: 396, y: 236 },
                  { x: 436, y: 196 },
                ],
        },
        source: "movement-probe-recorder",
      });
      const frame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
      });
      const openingSamples = [
        sample(0.006, 0),
        sample(0.5, 1_080),
        sample(0.72, 2_160),
        sample(0.929, 3_249),
      ];
      const firstFrame = frame(1, 68, "first-legal-rendered-frame");
      const select = ({ archivedFrames, samples = openingSamples }) =>
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          archivedFrames,
          expectedTargetLocationId: "tea-house",
          frames: [],
          label: "strict archive promotion",
          samples,
          validateFrame: ({ frame: renderedFrame, paintProbe }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            paintProbe,
            textPaint: {},
          }),
          validateStableFramePair: () => ({}),
        });

      assert.throws(
        () => select({ archivedFrames: [firstFrame] }),
        /did not contain two distinct legal rendered positions/,
      );
      assert.throws(
        () =>
          select({
            archivedFrames: [
              firstFrame,
              frame(2, 5_000, "stale-rendered-frame"),
            ],
          }),
        /Archived frame candidates: 1\./,
      );
      assert.throws(
        () =>
          select({
            archivedFrames: [
              firstFrame,
              frame(2, 2_268, "mismatched-route-rendered-frame"),
            ],
            samples: [
              ...openingSamples.slice(0, 2),
              sample(0.1, 2_200, {
                hud: "DAY 1 11:25",
                path: "later",
              }),
            ],
          }),
        /Archived frame candidates: 1\./,
      );
    },
  );

  await t.test(
    "two archived opening frames supersede a hung screenshot fallback",
    { skip: "Opening-route screenshot fallback was removed." },
    async () => {
      const renderedSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/rendered-route",
        url: "http://127.0.0.1/",
      });
      renderedSession.socket = { destroyed: false, writable: true };
      renderedSession.send = async () => ({});
      await renderedSession.startAutoplayScreencast();
      const startedAt = renderedSession.screencast.startedAtEpochMs;
      const paintProbe = {
        regions: [{ surface: "hud", text: "DAY 1 11:05" }],
        stableRegions: [{ surface: "hud", text: "DAY 1 11:05" }],
        viewport: { height: 625, width: 1365 },
      };
      const sample = (
        progress,
        offsetMs,
        { hud = "DAY 1 11:05", path = "opening" } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          ...paintProbe,
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
        },
        recorderGeneration: 2,
        route: {
          active: true,
          durationMs: path === "opening" ? 5_040 : 840,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          spaceId:
            path === "opening" ? "street:south-quay" : "interior:tea-house",
          target: path === "opening" ? { x: 17, y: 9 } : { x: 8, y: 3 },
          targetLocationId: "tea-house",
          tilePath:
            path === "opening"
              ? [
                  { x: 3, y: 9 },
                  { x: 17, y: 9 },
                ]
              : [
                  { x: 7, y: 4 },
                  { x: 8, y: 3 },
                ],
          visualObstaclesClear: true,
          worldPath:
            path === "opening"
              ? [
                  { x: 331, y: 688 },
                  { x: 1_338, y: 656 },
                ]
              : [
                  { x: 396, y: 236 },
                  { x: 436, y: 196 },
                ],
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.005, 0),
        sample(0.08, 100),
        sample(0.16, 200),
        sample(0.27, 300),
        sample(0.377, 400),
        sample(0.51, 500),
        sample(0.649, 600),
      ];
      const frame = (sequence, offsetMs, pixels) => ({
        data: Buffer.from(pixels).toString("base64"),
        metadata: { timestamp: (startedAt + offsetMs) / 1_000 },
        sequence,
      });
      const openingFrames = [
        frame(1, 250, "opening-rendered-position-a"),
        frame(2, 550, "opening-rendered-position-b"),
      ];
      renderedSession.screencast.routeRecorderExpectedTargetLocationId =
        "tea-house";
      renderedSession.screencast.routeRecorderGeneration = 2;
      renderedSession.screencast.routeRecorderRestartCount = 1;
      renderedSession.screencast.routeRecorderRestarts = [
        {
          generation: 2,
          reason: "execution-context-recorder-missing",
          targetLocationId: "tea-house",
        },
      ];
      renderedSession.screencast.routeFrameSampleCount = 0;
      renderedSession.archiveAutoplayRouteFrames({
        acceptedCount: 4,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 4),
      });
      assert.equal(renderedSession.screencast.routeFrameArchive.length, 0);

      let releaseCapture;
      const captureHeld = new Promise((resolve) => {
        releaseCapture = resolve;
      });
      let markCaptureStarted;
      const captureStarted = new Promise((resolve) => {
        markCaptureStarted = resolve;
      });
      proactiveRouteCaptureFixture = async () => {
        markCaptureStarted();
        await captureHeld;
        return null;
      };
      const capturePromise =
        renderedSession.scheduleAutoplayRouteVisualWindowCapture({
          beforeProbe: openingSamples[1],
          expectedTargetLocationId: "tea-house",
          label: "hung-screenshot-fallback",
        });
      await captureStarted;
      renderedSession.screencast.routeFrameHistory.push(...openingFrames);
      renderedSession.screencast.routeFrameSampleCount = 2;
      renderedSession.archiveAutoplayRouteFrames({
        acceptedCount: 7,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples,
      });
      assert.equal(renderedSession.screencast.routeFrameArchive.length, 2);
      assert.equal(
        renderedSession.screencast.routeFrameWindowCaptureStatus,
        "capturing-opening-route",
      );
      assert.equal(renderedSession.autoplayRouteFrameWindows().length, 0);
      assert.equal(
        renderedSession.screencast.routeFrameWindowCaptureAttemptCount,
        1,
      );

      for (let sequence = 3; sequence <= 15; sequence += 1) {
        renderedSession.screencast.routeFrameHistory.push(
          frame(sequence, 4_000 + sequence * 150, `later-frame-${sequence}`),
        );
      }
      const laterSamples = [
        sample(0.1, 5_000, { hud: "DAY 1 11:25", path: "later" }),
        sample(0.45, 5_200, { hud: "DAY 1 11:25", path: "later" }),
      ];
      renderedSession.archiveAutoplayRouteFrames({
        acceptedCount: 9,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: [...openingSamples, ...laterSamples],
      });
      assert.equal(renderedSession.screencast.routeFrameArchiveFrozen, true);
      assert.equal(renderedSession.screencast.routeFrameArchive.length, 2);
      assert.equal(renderedSession.autoplayRouteFrameHistory().length, 15);
      assert.equal(renderedSession.screencast.routeSampleArchive.length, 7);
      assert.equal(
        renderedSession.screencast.routeFrameOpeningSegment.lastProgress,
        0.649,
      );

      let framePairValidationCount = 0;
      const trajectory =
        recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
          expectedTargetLocationId: "tea-house",
          frames: renderedSession.autoplayRouteFrameHistory(),
          label: "two-frame hung-fallback opening route",
          recordedWindows: renderedSession.autoplayRouteFrameWindows(),
          samples: renderedSession.autoplayRouteCaptureSamples(),
          validateFrame: ({ frame: renderedFrame, paintProbe: framePaintProbe }) => ({
            buffer: Buffer.from(renderedFrame.data, "base64"),
            height: 625,
            paintProbe: framePaintProbe,
            textPaint: {},
            width: 1365,
          }),
          validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
            framePairValidationCount += 1;
            assert.notDeepEqual(afterBuffer, beforeBuffer);
            return { hudPixelDifferenceRatio: 0 };
          },
        });
      assert.equal(trajectory.start.frame.sequence, 1);
      assert.equal(trajectory.mid.frame.sequence, 2);
      assert.equal(trajectory.start.beforeProbe.route.progress, 0.08);
      assert.equal(trajectory.start.afterProbe.route.progress, 0.27);
      assert.equal(trajectory.mid.beforeProbe.route.progress, 0.377);
      assert.equal(trajectory.mid.afterProbe.route.progress, 0.649);
      assert.equal(framePairValidationCount, 1);
      assert.equal(trajectory.start.validated.textPaint.hudPixelDifferenceRatio, 0);
      assert.equal(trajectory.mid.validated.textPaint.hudPixelDifferenceRatio, 0);
      assert.ok(
        trajectory.start.frame.metadata.timestamp * 1_000 -
          trajectory.start.beforeProbe.capturedAtEpochMs >=
          125,
      );
      assert.ok(
        trajectory.mid.frame.metadata.timestamp * 1_000 -
          trajectory.mid.beforeProbe.capturedAtEpochMs >=
          125,
      );
      assert.ok(
        trajectory.mid.beforeProbe.route.progress -
          trajectory.start.afterProbe.route.progress >=
          0.1,
      );
      assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);
      assert.equal(
        renderedSession.acceptAutoplayRouteRenderedFrameTrajectory(trajectory),
        true,
      );
      assert.equal(
        renderedSession.screencast.routeFrameWindowCaptureStatus,
        "screencast-evidence-ready",
      );
      assert.equal(
        renderedSession.screencast.routeFrameWindowCapturePendingSample,
        null,
      );

      try {
        await Promise.race([
          renderedSession.stopAutoplayScreencast(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Screencast stop awaited the obsolete screenshot fallback.")),
              100,
            ),
          ),
        ]);
      } finally {
        releaseCapture();
        await capturePromise;
        proactiveRouteCaptureFixture = async () => null;
      }
    },
  );

  await t.test(
    "live recorder pairs one slow screenshot with a later resumed-screencast frame",
    { skip: "Opening-route screenshot fallback was removed." },
    async () => {
      const liveSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/live-route",
        url: "http://127.0.0.1/",
      });
      liveSession.socket = { destroyed: false, writable: true };
      liveSession.send = async () => ({});
      await liveSession.startAutoplayScreencast();
      const startedAt = liveSession.screencast.startedAtEpochMs;
      const sample = (
        progress,
        offsetMs,
        { hud = "DAY 1 11:05", pathLength = 15 } = {},
      ) => ({
        capturedAtEpochMs: startedAt + offsetMs,
        capturedAtMonotonicMs: offsetMs,
        paintProbe: {
          regions: [{ surface: "hud", text: hud }],
          stableRegions: [{ surface: "hud", text: hud }],
          viewport: { height: 625, width: 1365 },
        },
        recorderGeneration: 2,
        route: {
          active: true,
          legal: true,
          progress,
          reachesDestination: true,
          sampledPointsLegal: true,
          targetLocationId: "tea-house",
          tilePathLength: pathLength,
          visualObstaclesClear: true,
          worldPathLength: pathLength + 1,
        },
        source: "movement-probe-recorder",
      });
      const openingSamples = [
        sample(0.003, 0),
        sample(0.73, 200, { hud: "DAY 1 11:23" }),
        sample(0.86, 300, { hud: "DAY 1 11:23" }),
        sample(0.95, 500, { hud: "DAY 1 11:23" }),
      ];
      const recorder = (samples) => ({
        acceptedCount: samples.length,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        lastObservedRoute: {
          active: true,
          progress: samples.at(-1).route.progress,
          targetLocationId: "tea-house",
        },
        samples,
        status: "active",
      });
      const stagedRecorders = [
        recorder(openingSamples.slice(0, 2)),
        recorder(openingSamples),
      ];
      const laterSameTargetSamples = [
        sample(0.08, 3_000, { hud: "DAY 1 12:21", pathLength: 4 }),
        sample(0.36, 3_200, { hud: "DAY 1 12:21", pathLength: 4 }),
      ];
      const laterRecorder = recorder([
        ...openingSamples,
        ...laterSameTargetSamples,
      ]);
      let recorderReadCount = 0;
      liveSession.readOrRearmAutoplayRouteCaptureRecorder = async () => {
        const next = stagedRecorders[recorderReadCount] ?? laterRecorder;
        recorderReadCount += 1;
        return next;
      };
      let proactiveCaptureCount = 0;
      proactiveRouteCaptureFixture = async ({
        expectedTargetLocationId,
        session,
      }) => {
        assert.equal(proactiveCaptureCount, 0);
        const [beforeProbe, afterProbe] = openingSamples.slice(0, 2);
        const frame = {
          data: Buffer.from("proactive-position").toString("base64"),
          metadata: {
            source: "proactive-route-screenshot",
            timestamp: (startedAt + 135) / 1_000,
          },
          sequence: 2_001,
          source: "proactive-route-screenshot",
        };
        const captured = session.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe,
            beforeProbe,
            frame,
          },
          recorder: stagedRecorders[0],
        });
        proactiveCaptureCount += 1;
        return captured;
      };
      let resumedScreencastCaptureCount = 0;
      liveSession.captureAutoplayScreencastRouteFrameWindow = async ({
        afterSequence,
        expectedTargetLocationId,
      }) => {
        assert.equal(afterSequence, 2_001);
        const [beforeProbe, afterProbe] = openingSamples.slice(2, 4);
        resumedScreencastCaptureCount += 1;
        const frame = {
          data: Buffer.from("resumed-screencast-position").toString(
            "base64",
          ),
          metadata: { timestamp: (startedAt + 435) / 1_000 },
          sequence: 2_002,
        };
        liveSession.screencast.routeFrameHistory.push(frame);
        return liveSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe,
            beforeProbe,
            frame,
          },
          recorder: stagedRecorders[1],
        });
      };

      try {
        await liveSession.startAutoplayRouteVisualWindowRecorder({
          expectedTargetLocationId: "tea-house",
          label: "ci-ordering-live-route",
        });
        assert.equal(recorderReadCount, 2);
        assert.equal(proactiveCaptureCount, 1);
        assert.equal(resumedScreencastCaptureCount, 1);
        assert.equal(
          liveSession.screencast.routeFrameWindowRecorderStatus,
          "complete",
        );
        assert.equal(liveSession.autoplayRouteFrameHistory().length, 1);
        assert.equal(liveSession.autoplayRouteFrameWindows().length, 2);
        assert.ok(
          liveSession.autoplayRouteFrameWindows()[1].beforeProbe.route.progress -
            liveSession.autoplayRouteFrameWindows()[0].afterProbe.route.progress >=
            0.1,
        );
        assert.notEqual(
          liveSession.autoplayRouteFrameWindows()[0].frame.data,
          liveSession.autoplayRouteFrameWindows()[1].frame.data,
        );

        let crossTransportPixelCheckCount = 0;
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: liveSession.autoplayRouteFrameHistory(),
            label: "mixed-transport opening route",
            recordedWindows: liveSession.autoplayRouteFrameWindows(),
            samples: liveSession.autoplayRouteCaptureSamples(),
            validateFrame: ({ frame: renderedFrame, paintProbe }) => ({
              buffer: Buffer.from(renderedFrame.data, "base64"),
              height:
                renderedFrame.source === "proactive-route-screenshot"
                  ? 375
                  : 625,
              paintProbe,
              textPaint: { regionCount: 9, surfaces: ["hud"] },
              width:
                renderedFrame.source === "proactive-route-screenshot"
                  ? 819
                  : 1365,
            }),
            validateStableFramePair: () => {
              crossTransportPixelCheckCount += 1;
              return { hudPixelDifferenceRatio: 0 };
            },
          });
        assert.equal(trajectory.start.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "screencast-frame");
        assert.equal(crossTransportPixelCheckCount, 0);
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.003);
        assert.equal(trajectory.start.afterProbe.route.progress, 0.73);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.86);
        assert.equal(trajectory.mid.afterProbe.route.progress, 0.95);
        assert.equal(
          trajectory.start.validated.textPaint.routeWindowPaintProbeBasis,
          "stable-hud-containers-and-frame-adjacent-text",
        );
        assert.equal(
          trajectory.mid.validated.textPaint.routeHudContinuityBasis,
          "exact-route-identity-and-per-frame-hud-paint",
        );
        assert.equal(
          liveSession.acceptAutoplayRouteRenderedFrameTrajectory(trajectory),
          true,
        );

        liveSession.archiveAutoplayRouteFrames(laterRecorder);
        assert.equal(liveSession.screencast.routeFrameObservedSegmentCount, 2);
        assert.equal(liveSession.screencast.routeSampleArchive.length, 4);
        assert.equal(
          liveSession.screencast.routeFrameOpeningSegment.lastProgress,
          0.95,
        );
        assert.equal(liveSession.autoplayRouteFrameWindows().length, 2);
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        await liveSession.stopAutoplayScreencast();
      }
    },
  );

  const slowFrameSession = new CdpSession({
    browser: null,
    outputDir: "/tmp",
    pageWsUrl: "ws://127.0.0.1:9222/devtools/page/slow-frame",
    url: "http://127.0.0.1/",
  });
  slowFrameSession.socket = {
    bytesRead: 128,
    bytesWritten: 64,
    destroyed: false,
    readyState: "open",
    writable: true,
  };
  slowFrameSession.send = async () => ({});
  await slowFrameSession.startAutoplayScreencast();
  const slowFrameStartedAt = slowFrameSession.screencast.startedAtEpochMs;
  const delayedFrame = slowFrameSession.waitForAutoplayScreencastFrame({
    afterSequence: 0,
    minimumCapturedAtEpochMs: slowFrameStartedAt,
  });
  setTimeout(() => {
    slowFrameSession.handleAutoplayScreencastFrame({
      data: "delayed-ci-frame",
      metadata: { timestamp: (slowFrameStartedAt + 35) / 1_000 },
      sessionId: 5,
    });
  }, 35);
  assert.equal((await delayedFrame).data, "delayed-ci-frame");

  const terminalWaitStartedAt = Date.now();
  await assert.rejects(
    slowFrameSession.waitForAutoplayScreencastFrame({
      afterSequence: 1,
      minimumCapturedAtEpochMs: slowFrameStartedAt + 100,
    }),
    (error) => {
      assert.match(
        error.message,
        /Timed out waiting 60ms.*after sequence 1 captured at or after/,
      );
      assert.match(error.message, /CDP diagnostics:/);
      assert.match(error.message, /"lastSequence":1/);
      assert.match(error.message, /"writable":true/);
      return true;
    },
  );
  assert.ok(Date.now() - terminalWaitStartedAt >= 50);
  assert.equal(slowFrameSession.screencast.waiters.length, 0);
  assert.equal(
    slowFrameSession.transportEvents.at(-1)?.kind,
    "screencast-frame-wait-timeout",
  );
  await slowFrameSession.stopAutoplayScreencast();

  const timeoutSession = new CdpSession({
    browser: null,
    outputDir: "/tmp",
    pageWsUrl: "ws://127.0.0.1:9222/devtools/page/timeout",
    url: "http://127.0.0.1/",
  });
  timeoutSession.socket = { destroyed: false, writable: true };
  timeoutSession.writeFrame = () => {};
  await assert.rejects(
    timeoutSession.send("Runtime.evaluate", {}, { timeoutMs: 5 }),
    /Timed out waiting for Chrome DevTools response.*pendingRequests/,
  );
  assert.equal(timeoutSession.pending.size, 0);
  timeoutSession.socket.destroyed = true;
  await assert.rejects(
    timeoutSession.send("Runtime.evaluate"),
    /transport is not writable.*pendingRequests/,
  );
});

test("semantic playback cards have measured browser dwell evidence", () => {
  assert.match(
    source,
    /const AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS = 2_000;/,
  );
  assert.match(source, /buildAutoplayPlaybackCardDwellAudit\(/);
  assert.match(source, /minimumPlaybackCardDwellMs:/);
  assert.match(source, /completedTimings: probe\?\.playback\?\.completedTimings/);
  assert.match(source, /evidence: "browser-playback-timer"/);
  assert.match(
    source,
    /completedTiming\.completedAtMs - completedTiming\.startedAtMs/,
  );
  assert.match(
    pacingAssertionSource,
    /ledger\.minimumPlaybackCardDwellMs >=\s*AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS/,
  );
  assert.match(source, /interruptedPlaybackCardDwells:/);
  assert.match(source, /activePlaybackCardsAtEnd:/);
  assert.match(source, /evidence: "active-terminal-card"/);
  assert.match(source, /assertAutoplayPlaybackCardDwellResetGuard\(\);/);
  assert.match(source, /rawAppMonotonicMs < activeCard\.lastRawAppMonotonicMs/);
  assert.match(
    source,
    /activeCard\.lastAppMonotonicMs - activeCard\.startedAtMs/,
  );
});

test("an active terminal semantic card is not reported as completed before its floor", () => {
  const audit = buildAutoplayPlaybackCardDwellAudit([
    {
      appMonotonicMs: 275_687.8,
      playback: {
        activeDurationMs: 2_800,
        activeKey: "objective-shift:rest-home",
        activeKind: "objective_shift",
        activeStartedAtMs: 275_121.4,
        activeTitle: "Objective shifted",
      },
      rawAppMonotonicMs: 275_687.8,
    },
  ]);

  assert.deepEqual(audit.dwells, []);
  assert.equal(audit.activeAtEnd.length, 1);
  assert.equal(audit.activeAtEnd[0].key, "objective-shift:rest-home");
  assert.ok(
    Math.abs(audit.activeAtEnd[0].observedAppDurationMs - 566.4) < 0.001,
  );
});

test("opening watch action keeps 600ms scheduling within follow-through acceptance", () => {
  assert.match(
    source,
    /entry\.autoContinueIntendedDelayMs === 600/,
  );
  assert.match(
    source,
    /entry\.fullAppDurationMs[\s\S]*AUTOPLAY_PACING_ACTION_FOLLOWTHROUGH_TIMEOUT_MS/,
  );
});

test("Chrome startup retries once and records actionable diagnostics", () => {
  assert.match(source, /const CHROME_START_ATTEMPTS = Number\(/);
  assert.match(
    source,
    /for \(let attempt = 1; attempt <= CHROME_START_ATTEMPTS; attempt \+= 1\)/,
  );
  assert.match(source, /chrome-session-retry-\$\{attempt\}/);
  assert.match(source, /chrome-startup-attempt-\$\{attempt\}\.json/);
  assert.match(source, /browser\.once\("exit", \(code, signal\) =>/);
  assert.match(source, /stderr: browserStderr\.trim\(\) \|\| null/);
});

test("browser evidence waits for readable rail geometry", () => {
  assert.match(
    source,
    /async function waitForGameplayDom\(label, session, probe, game\)/,
  );
  assert.match(source, /await session\.waitForAnimationFrames\(2\)/);
  assert.match(
    source,
    /assertRailReadability\(label, game, probe, lastDom\)/,
  );
  assert.match(source, /expectedConversationLine/);
  assert.match(source, /conversationFullyRendered/);
  assert.match(source, /readableStableSamples >= 2/);
  assert.match(source, /Last readability error:/);
  assert.match(
    source,
    /const collapsed = railSummary\?\.state === "collapsed"/,
  );
  assert.match(
    source,
    /assertCollapsedRailSummaryReadability\(label, game, railSummary\)/,
  );
  assert.match(source, /commandRail\.rect\?\.height >= 120/);
  assert.match(source, /assertRailReadabilityStateRegression\(\)/);
  assert.match(source, /await session\.waitForVisualMoveSettlement\(/);
});

test("visual move settlement survives a transient false probe and rejects restarted movement", () => {
  assert.ok(
    visualMoveSettlementStart >= 0 &&
      visualMoveSettlementEnd > visualMoveSettlementStart,
  );
  const game = { id: "game-settlement" };
  const matchesGame = (probe, expectedGame) =>
    probe?.gameId === expectedGame.id;
  const settledProbe = {
    activeConversation: null,
    autonomy: {
      actionId: "talk:npc-mara",
      label: "Talk to Mara",
      mode: "acting",
      stepKind: "talk",
      targetLocationId: "boarding-house",
    },
    clock: { iso: "2026-03-21T11:02:00.000Z" },
    gameId: game.id,
    location: {
      id: "boarding-house",
      spaceId: "interior:boarding-house",
      x: 5,
      y: 5,
    },
    movement: { playerRoute: null },
    playback: { activeKind: "talk", queuedCount: 1 },
    visualPlayer: {
      isMovingToServerState: false,
      targetX: 5,
      targetY: 5,
    },
    watchMode: {
      frozen: true,
      pendingPlayback: true,
      status: "frozen",
    },
  };
  const activeRouteProbe = {
    ...settledProbe,
    movement: {
      playerRoute: {
        active: true,
        progress: 0.861,
        target: { x: 5, y: 5 },
        targetLocationId: "boarding-house",
      },
    },
    visualPlayer: {
      ...settledProbe.visualPlayer,
      isMovingToServerState: true,
    },
  };
  const record = (progress, probe, elapsedMs) =>
    recordVisualMoveSettlementProgress({
      elapsedMs,
      game,
      matchesGame,
      minimumStableMs: 500,
      probe,
      progress,
      requiredStableSamples: 3,
    });

  let progress = record(null, activeRouteProbe, 0);
  progress = record(progress, settledProbe, 250);
  assert.equal(
    progress.settled,
    false,
    "One transient non-moving probe must not settle the route.",
  );
  progress = record(progress, activeRouteProbe, 500);
  assert.equal(progress.stableSampleCount, 0);
  assert.equal(progress.movementRestartCount, 1);
  progress = record(progress, settledProbe, 750);
  progress = record(progress, settledProbe, 1_000);
  progress = record(progress, settledProbe, 1_250);
  assert.equal(
    progress.settled,
    true,
    "The same pending playback identity should settle after three route-free samples spanning 500ms.",
  );

  let captureRevalidation = record(null, activeRouteProbe, 0);
  captureRevalidation = record(
    captureRevalidation,
    settledProbe,
    250,
  );
  captureRevalidation = record(
    captureRevalidation,
    settledProbe,
    500,
  );
  assert.equal(
    captureRevalidation.settled,
    false,
    "A route that restarts before capture must remain unsettled without a full stable window.",
  );

  let neverStable = null;
  for (let elapsedMs = 0; elapsedMs <= 15_000; elapsedMs += 250) {
    neverStable = record(
      neverStable,
      elapsedMs % 500 === 0 ? activeRouteProbe : settledProbe,
      elapsedMs,
    );
    assert.equal(
      neverStable.settled,
      false,
      "Alternating active and transient settled probes must never pass.",
    );
  }

  assert.match(
    source,
    /await session\.waitForStableNonMovementGame\(game,/,
  );
  assert.match(
    source,
    /probe\.movement\?\.playerRoute\?\.active \?\? false/,
  );
});

test("conversation capture settles the expected beat independently of a newer streaming follow-up", () => {
  assert.match(
    source,
    /function conversationBeatReadabilitySignature\(dom, expectedLine\)/,
  );
  assert.match(
    source,
    /\(dom\?\.layout\?\.chatBubbles \?\? \[\]\)\.find\(\(bubble\) =>/,
  );
  assert.match(
    source,
    /conversationBeatReadabilitySignature\(\s*lastDom,\s*expectedConversationLine,?\s*\)/,
  );
  assert.match(
    source,
    /The previous whole-transcript signature must reproduce the hosted reset\./,
  );
  assert.match(
    source,
    /A newer streaming follow-up must not restart settlement for an already rendered Mara beat\./,
  );
  assert.match(
    source,
    /The expected conversation bubble itself must still settle before capture\./,
  );
  assert.doesNotMatch(
    source,
    /const readableSignature = JSON\.stringify\(\{\s*conversationText:/,
  );
});

test("streaming conversation growth keeps following a readable exchange", () => {
  assert.match(
    overlayDomStateSource,
    /commandRailConversationVisible: commandRail\s*\? isCommandRailConversationVisible\(commandRail\)/,
  );
  assert.match(
    overlayDomStateSource,
    /commandRailConversationActive: commandRail\s*\? isLiveCommandRailConversation\(commandRail\)/,
    "Command rail capture must distinguish live conversation state from ordinary near-bottom position.",
  );
  assert.match(
    overlayDomStateSource,
    /shouldFollowCommandRailGrowth\(\{[\s\S]*?nearBottom: state\.commandRailNearBottom,[\s\S]*?nextConversationActive: isLiveCommandRailConversation\(commandRail\),[\s\S]*?previousConversationActive: state\.commandRailConversationActive,[\s\S]*?\}\)/,
    "Near-bottom command rail growth should follow only while a live conversation continues.",
  );
  assert.doesNotMatch(
    overlayDomStateSource,
    /else if \(state\.commandRailNearBottom\)/,
    "Ordinary decision rails must preserve their prior scroll position when content grows.",
  );
  assert.match(
    overlayDomStateSource,
    /else if \(state\.commandRailConversationVisible\) {\s*ensureCommandRailConversationVisible\(commandRail\);/,
  );
});

test("live conversation uses one compact decision and an independent transcript viewport", () => {
  assert.match(
    streetRuntimeSource,
    /showConversationRail && rowanRail\.now\.decisionArtifact[\s\S]*buildCompactVisibleDecisionArtifactHtml\(rowanRail\.now\.decisionArtifact\)/,
  );
  assert.match(
    streetRuntimeSource,
    /liveConversationWorkspaceHtml[\s\S]*decisionArtifact: null/,
    "The hidden Now card must not duplicate the live conversation artifact.",
  );
  assert.match(
    streetRuntimeSource,
    /data-live-conversation-workspace="true"/,
  );
  assert.match(
    streetRuntimeSource,
    /data-live-conversation-thread="true"/,
  );
  for (const field of [
    "aim",
    "signals",
    "choice",
    "rationale",
    "next-check",
    "options",
  ]) {
    assert.match(
      streetOverlayHtmlSource,
      new RegExp(`data-decision-field="${field}"`),
      `Compact live decision must expose ${field} semantics.`,
    );
  }
  assert.match(
    streetOverlayStylesSource,
    /\.ml-command-rail\.is-live-conversation\s*{[\s\S]*?overflow:\s*hidden;/,
  );
  assert.match(
    streetOverlayStylesSource,
    /\.ml-live-conversation-thread[\s\S]*?overflow:\s*hidden;/,
  );
  assert.match(
    streetOverlayStylesSource,
    /\.ml-live-conversation-thread \.ml-chat-shell\.is-rail[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
  );
  assert.match(
    streetOverlayStylesSource,
    /\.ml-live-conversation-thread \.ml-chat-shell\.is-rail \.ml-chat-transcript,[\s\S]*?overflow-y:\s*auto;/,
  );
  assert.doesNotMatch(
    overlayDomStateSource,
    /commandRailDirectiveVisible|isCommandRailDirectiveVisible/,
    "Live decision visibility must not compete with transcript scroll restoration.",
  );
  assert.match(
    overlayDomStateSource,
    /\[data-live-conversation-thread="true"\] \.ml-chat-transcript/,
    "The independent live transcript must participate in overlay scroll preservation.",
  );
  assert.match(
    overlayDomStateSource,
    /if \(state\.transcriptScrollTop === null \|\| state\.transcriptNearBottom\) \{\s*transcript\.scrollTop = transcript\.scrollHeight;\s*\} else if \(state\.transcriptScrollTop !== null\) \{\s*transcript\.scrollTop = Math\.min\(/,
    "A new or bottom-following transcript should follow the latest line without overriding intentional user scroll.",
  );
});

test("streaming overlay rebuilds retain the last coherent camera probe", () => {
  assert.match(
    overlayDomStateSource,
    /browserCameraProbeJson: browserCameraProbe\?\.textContent \?\? null/,
  );
  assert.match(
    overlayDomStateSource,
    /if \(browserCameraProbe && state\.browserCameraProbeJson !== null\) \{\s*browserCameraProbe\.textContent = state\.browserCameraProbeJson;/,
  );
});

test("scheduled NPC evidence retains intermediate settled watch probes", () => {
  assert.match(
    source,
    /recordInhabitScheduledNpcObservation\(\{\s*attempt,\s*milestoneLabel: milestone\.label,/,
  );
  assert.match(
    source,
    /if \(milestone\.reached\(probe\)\) \{/,
  );
  assert.ok(
    source.indexOf("recordInhabitScheduledNpcObservation({") <
      source.indexOf("if (milestone.reached(probe)) {"),
  );
  assert.match(
    source,
    /scheduledNpcObservationTimeline: scheduledNpcObservations/,
  );
  assert.match(
    source,
    /\.\.\.scheduledNpcObservationTimeline\.map\(\(entry, observationIndex\) =>/,
  );
  assert.match(source, /evidenceForMilestone: milestoneLabel/);
  assert.match(source, /cue\.timelineIndex <= timelineIndex/);
  assert.match(source, /cue\.cueKind === "next-scheduled-stop"/);
  assert.match(source, /assertScheduledNpcLocationChangeAuditRegression\(\);/);
});
