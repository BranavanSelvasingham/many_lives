import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserRegressionPath = new URL(
  "./rowan-browser-regression.mjs",
  import.meta.url,
);
const source = await readFile(browserRegressionPath, "utf8");
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
const sleepUntilEpochStart = source.indexOf("async function sleepUntilEpochMs(");
const sleepUntilEpochEnd = source.indexOf(
  "\nfunction ",
  sleepUntilEpochStart + 1,
);
const sleepUntilEpochMs = Function(
  `return (${source.slice(sleepUntilEpochStart, sleepUntilEpochEnd)})`,
)();

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
  assert.match(pacingAssertionSource, /ledger\.maxInAppGapMs/);
  assert.match(
    pacingAssertionSource,
    /typeof ledger\.maxInAppGapMs === "number"/,
  );
  assert.doesNotMatch(pacingAssertionSource, /ledger\.maxIdleGapMs/);
  assert.match(source, /progressKinds\.push\("playback-progress"\)/);
  assert.match(source, /progressKinds\.push\("activity-progress"\)/);
  assert.match(
    source,
    /activeConversation\?\.replay\?\.streamedWordCount/,
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
    /intendedDelayMs < current\.intendedDelayMs[\s\S]*\? nowMs[\s\S]*: current\.startedAtMs/,
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
    "AUTOPLAY_ROUTE_SEGMENT_MAX_SAMPLE_GAP_MS",
    "AUTOPLAY_ROUTE_SEGMENT_PROGRESS_RESET_TOLERANCE",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "requireStableAutoplayScreenshotPaintProbe",
    "requireStableAutoplayRouteWindowPaintProbe",
    "assertAutoplayRouteHudContinuity",
    "autoplayRecordedRouteWindowFrame",
    `${policySource}\n${source.slice(recordedStart, recordedEnd)}; return { archiveAutoplayRouteCaptureFromPacingProbe, assertAutoplayFootholdRouteCaptureGuard, buildAutoplayFootholdRouteGuardFixture, buildAutoplayRouteCaptureSampleFromPacingProbe, buildAutoplayRouteCaptureSegments, selectAutoplayRecordedRouteTrajectory };`,
  )(
    assert,
    0.1,
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
    /opening route segment did not contain two distinct legal rendered positions/,
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
    /opening route segment did not contain two distinct legal rendered positions/,
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
  assert.equal(routeHudContinuityChecks, 1);

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
      /opening route segment did not contain two distinct legal rendered positions/,
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
    source.indexOf("async function captureAutoplayProactiveRouteFrameWindow("),
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
  assert.match(source, /source: "proactive-route-screenshot"/);
  assert.match(
    source,
    /async captureAutoplayRouteVisualFrame[\s\S]*Page\.captureScreenshot/,
  );
  assert.match(
    source,
    /withAutoplayScreencastPausedForRouteCapture[\s\S]*Page\.stopScreencast[\s\S]*Page\.startScreencast/,
    "Proactive screenshots must own the CDP visual transport instead of competing with the active screencast.",
  );
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
  assert.match(
    proactiveCaptureSource,
    /const capturedFrame = await session\.captureAutoplayRouteVisualFrame\(\{\s*minimumCapturedAtEpochMs:\s*beforeProbe\.capturedAtEpochMs \+\s*AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS,/,
    "The position screenshot must retain the compositing settle interval inside the legal opening segment.",
  );
  assert.equal(
    (proactiveCaptureSource.match(/captureAutoplayRouteVisualFrame\(/g) ?? [])
      .length,
    1,
    "Each proactive route position must consume one renderer screenshot.",
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
  assert.match(source, /routeMidWindow\.before\.progress - routeStartWindow\.after\.progress/);
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
    3,
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
  ];
  const persistentProbes = [
    probe(1_400),
    null,
    probe(1_700),
    null,
    probe(2_000),
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
    /current-state probe was unavailable after frame capture on attempt 3\/3/,
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
    /current-state probe was unavailable before frame capture on attempt 3\/3\. CDP diagnostics: \{"pendingRequests":\[\],"socket":\{"writable":true\}\}/,
  );
  assert.deepEqual(
    persistentValidatedSequences,
    [],
    "Persistent unbracketed pixels must never be validated.",
  );

  await assert.rejects(
    acquireFrame({
      initialProbe: probe(200),
      isCaptureWindowCoherent: (before, after) => before.state === after.state,
      isInitialProbeCoherent: (initial, before) =>
        initial.state === before.state,
      label: "stale live milestone",
      readProbe: async () => probe(210),
      session: {
        autoplayScreencastSequence: () => 2,
        readScreenshotPaintProbe: session.readScreenshotPaintProbe,
        waitForAutoplayScreencastFrame: (() => {
          const staleFrames = [
            {
              data: "stale",
              metadata: { timestamp: (epoch + 205) / 1_000 },
              sequence: 3,
            },
            {
              data: "stale-confirmation",
              metadata: { timestamp: (epoch + 330) / 1_000 },
              sequence: 4,
            },
          ];
          return async () => staleFrames.shift();
        })(),
      },
      validateFrame: () => assert.fail("stale pixels must not be validated"),
    }),
    /timestamp was outside its current-state probe window/,
  );

  await assert.rejects(
    acquireFrame({
      initialProbe: probe(300),
      isCaptureWindowCoherent: (before, after) => before.state === after.state,
      isInitialProbeCoherent: (initial, before) =>
        initial.state === before.state,
      label: "mismatched live milestone",
      readProbe: (() => {
        const mismatched = [probe(310), probe(330, "arrival")];
        return async () => mismatched.shift();
      })(),
      session: {
        autoplayScreencastSequence: () => 3,
        readScreenshotPaintProbe: session.readScreenshotPaintProbe,
        waitForAutoplayScreencastFrame: (() => {
          const mismatchedFrames = [
            {
              data: "wrong-state",
              metadata: { timestamp: (epoch + 320) / 1_000 },
              sequence: 4,
            },
            {
              data: "wrong-state-confirmation",
              metadata: { timestamp: (epoch + 445) / 1_000 },
              sequence: 5,
            },
          ];
          return async () => mismatchedFrames.shift();
        })(),
      },
      validateFrame: () => assert.fail("mismatched pixels must not be validated"),
    }),
    /not bracketed by one coherent current state/,
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
    `${source.slice(routeSegmentsPolicyStart, routeSegmentsPolicyEnd)}; return { autoplayRecordedRouteWindowSharesAdmissibleIdentity, autoplayRouteCaptureSamplesShareExactIdentity, autoplayRouteCaptureSamplesShareExactRouteIdentity, autoplayRouteCaptureWindowOpeningMembership, buildAutoplayRouteCaptureSegments, compactAutoplayRouteCaptureSegments, compactAutoplayRouteFrameWindowProbe, isAutoplayFootholdRouteFrame };`,
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
    "AUTOPLAY_ROUTE_SEGMENT_MAX_SAMPLE_GAP_MS",
    "AUTOPLAY_ROUTE_SEGMENT_PROGRESS_RESET_TOLERANCE",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "screencastFrameCapturedAtEpochMs",
    "screencastFrameIsBracketedByEpochProbes",
    "requireStableAutoplayScreenshotPaintProbe",
    "requireStableAutoplayRouteWindowPaintProbe",
    "assertAutoplayRouteHudContinuity",
    "autoplayRecordedRouteWindowFrame",
    `${source.slice(routeSegmentsPolicyStart, routeSegmentsPolicyEnd)}\n${source.slice(recordedRoutePolicyStart, recordedRoutePolicyEnd)}; return { selectAutoplayRecordedRouteTrajectory };`,
  )(
    assert,
    0.1,
    2_000,
    0.02,
    125,
    screencastFrameCapturedAtEpochMs,
    screencastFrameIsBracketedByEpochProbes,
    (_before, after) => after,
    (_before, after) => after,
    () => ({ routeHudContinuityPixelDifferenceRatio: 0 }),
    (recordedWindow) =>
      recordedWindow?.frame ?? recordedWindow?.confirmationFrame ?? null,
  );
  const proactiveCaptureStart = source.indexOf(
    "async function captureAutoplayProactiveRouteFrameWindow(",
  );
  const proactiveCaptureEnd = source.indexOf(
    "\nfunction recordedRouteWindowBelongsToOpeningSegment(",
    proactiveCaptureStart,
  );
  const proactiveCapturePolicy = Function(
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "autoplayRouteCaptureWindowCoherent",
    "isAutoplayFootholdRouteFrame",
    "screencastFrameCapturedAtEpochMs",
    "autoplayRouteCaptureSamplesShareExactIdentity",
    "autoplayRouteCaptureSamplesShareExactRouteIdentity",
    `${source.slice(proactiveCaptureStart, proactiveCaptureEnd)}; return captureAutoplayProactiveRouteFrameWindow;`,
  )(
    125,
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
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactIdentity,
    routeSegmentsPolicy.autoplayRouteCaptureSamplesShareExactRouteIdentity,
  );
  let proactiveRouteCaptureFixture = async () => null;
  const classStart = source.indexOf("class CdpSession {");
  const classEnd = source.indexOf(
    "\nasync function launchBrowserSession(",
    classStart,
  );
  const CdpSession = Function(
    "assert",
    "AUTOPLAY_SCREENCAST_COMMAND_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_EVERY_NTH_FRAME",
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
    "AUTOPLAY_ROUTE_DIRECT_SCREENCAST_GRACE_MS",
    "AUTOPLAY_ROUTE_NO_SCREENCAST_FALLBACK_GRACE_MS",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "AUTOPLAY_ROUTE_PROACTIVE_SCREENSHOT_SCALE",
    "AUTOPLAY_ROUTE_RENDERED_FRAME_MIN_HEIGHT",
    "AUTOPLAY_ROUTE_RENDERED_FRAME_MIN_WIDTH",
    "AUTOPLAY_SCREENCAST_COMPOSITING_SETTLE_MS",
    "PROBE_POLL_INTERVAL_MS",
    "autoplayRouteCaptureWindowCoherent",
    "autoplayRouteCaptureSamplesShareExactIdentity",
    "autoplayRouteCaptureSamplesShareExactRouteIdentity",
    "autoplayRecordedRouteWindowSharesAdmissibleIdentity",
    "autoplayRouteCaptureWindowOpeningMembership",
    "autoplayRecordedRouteWindowFrame",
    "buildAutoplayRouteCaptureSegments",
    "captureAutoplayProactiveRouteFrameWindow",
    "compactAutoplayRouteCaptureSegments",
    "compactAutoplayRouteFrameWindowProbe",
    "CDP_WAIT_TIMEOUT_MS",
    "isAutoplayFootholdRouteFrame",
    "screencastFrameIsBracketedByEpochProbes",
    "screencastFrameCapturedAtEpochMs",
    "sleep",
    "sleepUntilEpochMs",
    "withTimeout",
    `${source.slice(classStart, classEnd)}; return CdpSession;`,
  )(
    assert,
    5,
    4,
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
    25,
    8,
    0.1,
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
    routeSegmentsPolicy.autoplayRouteCaptureWindowOpeningMembership,
    (recordedWindow) =>
      recordedWindow?.frame ?? recordedWindow?.confirmationFrame ?? null,
    routeSegmentsPolicy.buildAutoplayRouteCaptureSegments,
    (options) => proactiveRouteCaptureFixture(options),
    routeSegmentsPolicy.compactAutoplayRouteCaptureSegments,
    routeSegmentsPolicy.compactAutoplayRouteFrameWindowProbe,
    20,
    routeSegmentsPolicy.isAutoplayFootholdRouteFrame,
    screencastFrameIsBracketedByEpochProbes,
    screencastFrameCapturedAtEpochMs,
    (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    (minimumEpochMs) =>
      sleepUntilEpochMs(minimumEpochMs, {
        sleepFor: (milliseconds) =>
          new Promise((resolve) => setTimeout(resolve, milliseconds)),
      }),
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
          command.params.maxHeight === 375 &&
          command.params.maxWidth === 819,
      ),
    "Every screencast generation must retain the bounded legible route-evidence raster.",
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
    "coalesced visual capture recovers five legal samples with one opening screencast frame",
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
        /exclusive access to the CDP visual transport/,
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

      const captureGapAfter = sample(0.905, 7_080, {
        previousOffsetMs: 4_500,
        tickCount: 5,
      });
      const captureGapRecorder = {
        ...openingRecorder,
        samples: [...openingRecorder.samples, captureGapAfter],
      };
      assert.equal(
        routeSegmentsPolicy.buildAutoplayRouteCaptureSegments({
          expectedTargetLocationId: "tea-house",
          samples: captureGapRecorder.samples,
        }).length,
        2,
        "The synthetic screenshot delay must split the recorder segment without changing route identity.",
      );
      const afterSamples = [initialSamples[1], captureGapAfter];
      const renderedFrames = [
        frame(201, 500, "loaded-route-position-start"),
        frame(202, 4_700, "loaded-route-position-mid"),
      ];
      let visualCaptureCount = 0;
      loadedSession.captureAutoplayRouteVisualFrame = async () => {
        assert.equal(
          loadedSession.screencast.routeVisualCaptureTransportStatus,
          "paused-for-route-capture",
        );
        visualCaptureCount += 1;
        return renderedFrames.shift();
      };
      loadedSession.sampleAutoplayRouteCaptureRecorder = async () =>
        afterSamples.shift() ?? null;
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
          "exclusive-route-capture-gap",
        );
        assert.ok(
          loadedSession.autoplayRouteFrameWindows().every(
            (recordedWindow) =>
              recordedWindow.frame &&
              !recordedWindow.candidateFrame &&
              !recordedWindow.confirmationFrame,
          ),
        );
        assert.equal(loadedSession.screencast.routeVisualCapturePauseCount, 2);
        assert.equal(loadedSession.screencast.routeVisualCaptureResumeCount, 2);

        let crossPositionPixelCheckCount = 0;
        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
            expectedTargetLocationId: "tea-house",
            frames: [],
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
            validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
              crossPositionPixelCheckCount += 1;
              assert.notDeepEqual(afterBuffer, beforeBuffer);
              return { hudPixelDifferenceRatio: 0 };
            },
          });
        assert.equal(trajectory.start.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.mid.evidenceSource, "proactive-route-frame");
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.004);
        assert.equal(trajectory.start.afterProbe.route.progress, 0.25);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.9);
        assert.equal(trajectory.mid.afterProbe.route.progress, 0.905);
        assert.equal(crossPositionPixelCheckCount, 1);

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
    "exclusive visual transport recovers five legal samples with zero screencast frames",
    async () => {
      const starvationSession = new CdpSession({
        browser: null,
        outputDir: "/tmp",
        pageWsUrl: "ws://127.0.0.1:9222/devtools/page/starved-route",
        url: "http://127.0.0.1/",
      });
      starvationSession.socket = { destroyed: false, writable: true };
      const commands = [];
      let screenshotCount = 0;
      starvationSession.send = async (method, params) => {
        commands.push({ method, params });
        if (method === "Page.captureScreenshot") {
          assert.equal(
            starvationSession.screencast.routeVisualCaptureTransportStatus,
            "paused-for-route-capture",
            "A renderer screenshot must never compete with the active screencast stream.",
          );
          assert.equal(params.optimizeForSpeed, true);
          assert.equal(params.format, "jpeg");
          assert.equal(params.quality, 90);
          assert.deepEqual(params.clip, {
            height: 625,
            scale: 0.6,
            width: 1365,
            x: 0,
            y: 0,
          });
          screenshotCount += 1;
          return {
            result: {
              data: Buffer.from(
                `\xff\xd8\xffstarved-opening-rendered-position-${screenshotCount}`,
                "latin1",
              ).toString("base64"),
            },
          };
        }
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
        sample(0.003, 0),
        sample(0.18, 900),
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
      const afterSamples = [openingSamples[2], openingSamples[4]];
      starvationSession.sampleAutoplayRouteCaptureRecorder = async () =>
        afterSamples.shift() ?? null;
      starvationSession.readOrRearmAutoplayRouteCaptureRecorder = async () =>
        recorder;
      starvationSession.normalizeAutoplayRouteVisualFrame = async (frame) => ({
        ...frame,
        data: Buffer.from(`normalized-${frame.sequence}`).toString("base64"),
        metadata: {
          ...frame.metadata,
          format: "png",
          sourceFormat: "jpeg",
        },
      });

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
          2,
        );
        assert.equal(
          starvationSession.screencast.routeVisualCaptureResumeCount,
          2,
        );
        assert.equal(
          starvationSession.screencast.routeVisualCaptureTransportStatus,
          "active",
        );
        assert.deepEqual(
          commands.slice(0, 7).map((command) => command.method),
          [
            "Page.startScreencast",
            "Page.stopScreencast",
            "Page.captureScreenshot",
            "Page.startScreencast",
            "Page.stopScreencast",
            "Page.captureScreenshot",
            "Page.startScreencast",
          ],
        );
        assert.equal(screenshotCount, 2);

        const trajectory =
          recordedRoutePolicy.selectAutoplayRecordedRouteTrajectory({
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
            validateStableFramePair: ({ afterBuffer, beforeBuffer }) => {
              assert.notDeepEqual(afterBuffer, beforeBuffer);
              return { hudPixelDifferenceRatio: 0 };
            },
          });
        assert.equal(trajectory.start.beforeProbe.route.progress, 0.003);
        assert.equal(trajectory.start.afterProbe.route.progress, 0.73);
        assert.equal(trajectory.mid.beforeProbe.route.progress, 0.86);
        assert.equal(trajectory.mid.afterProbe.route.progress, 0.95);
        assert.equal(
          trajectory.start.validated.textPaint.routeWindowPaintProbeBasis,
          "stable-hud-containers-and-frame-adjacent-text",
        );
        assert.match(
          trajectory.start.validated.paintProbe.regions[0].text,
          /11:23/,
        );
        assert.notEqual(trajectory.start.frame.data, trajectory.mid.frame.data);

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
    "direct opening frames receive grace before screenshot fallback",
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

        graceSession.screencast.routeFrameHistory.push(
          {
            data: "direct-route-start",
            metadata: { timestamp: (startedAt + 250) / 1_000 },
            sequence: 1,
          },
          {
            data: "direct-route-mid",
            metadata: { timestamp: (startedAt + 550) / 1_000 },
            sequence: 2,
          },
        );
        graceSession.screencast.routeFrameSampleCount = 2;
        graceSession.archiveAutoplayRouteFrames({
          acceptedCount: samples.length,
          expectedTargetLocationId: "tea-house",
          generation: 2,
          samples,
        });
        assert.equal(graceSession.screencast.routeFrameArchive.length, 2);

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
      } finally {
        proactiveRouteCaptureFixture = async () => null;
        await graceSession.stopAutoplayScreencast();
      }
    },
  );

  await t.test(
    "failed screenshot fallback requires a fresh opening route sample",
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
    "two archived opening frames supersede a hung screenshot fallback",
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
      renderedSession.screencast.routeFrameSampleCount = 2;
      renderedSession.screencast.routeFrameHistory.push(openingFrames[0]);
      renderedSession.archiveAutoplayRouteFrames({
        acceptedCount: 4,
        expectedTargetLocationId: "tea-house",
        generation: 2,
        samples: openingSamples.slice(0, 4),
      });
      assert.equal(renderedSession.screencast.routeFrameArchive.length, 1);

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
      renderedSession.scheduleAutoplayRouteVisualWindowCapture({
        beforeProbe: openingSamples[4],
        expectedTargetLocationId: "tea-house",
        label: "hung-screenshot-fallback",
      });
      assert.equal(
        renderedSession.screencast.routeFrameWindowCapturePendingSample.route
          .progress,
        0.377,
      );
      assert.equal(
        renderedSession.screencast.routeFrameWindowCaptureStatus,
        "capturing-opening-route",
      );

      renderedSession.screencast.routeFrameHistory.push(openingFrames[1]);
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
      assert.equal(
        renderedSession.screencast.routeFrameWindowCapturePendingSample.route
          .progress,
        0.377,
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
      liveSession.handleAutoplayScreencastFrame({
        data: "only-passive-opening-frame",
        metadata: { timestamp: (startedAt + 100) / 1_000 },
        sessionId: 41,
      });

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
        return liveSession.archiveAutoplayRouteFrameWindow({
          expectedTargetLocationId,
          recordedWindow: {
            afterProbe,
            beforeProbe,
            frame: {
              data: Buffer.from("resumed-screencast-position").toString(
                "base64",
              ),
              metadata: { timestamp: (startedAt + 435) / 1_000 },
              sequence: 2_002,
            },
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
  assert.match(
    pacingAssertionSource,
    /ledger\.minimumPlaybackCardDwellMs >=\s*AUTOPLAY_MIN_PLAYBACK_CARD_DWELL_MS/,
  );
  assert.match(source, /interruptedPlaybackCardDwells:/);
  assert.match(source, /assertAutoplayPlaybackCardDwellResetGuard\(\);/);
  assert.match(source, /rawAppMonotonicMs < activeCard\.lastRawAppMonotonicMs/);
  assert.match(
    source,
    /activeCard\.lastAppMonotonicMs - activeCard\.startedAtMs/,
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
    /else if \(state\.commandRailConversationVisible\) {\s*ensureCommandRailConversationVisible\(commandRail\);/,
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
