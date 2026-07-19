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
  assert.match(source, /completedSegmentMs \+= previousRawAppMonotonicMs/);
  assert.match(source, /assertAutoplayAppMonotonicResetGuard\(\);/);
  assert.match(
    source,
    /\{ appMonotonicMs: 6_500, rawAppMonotonicMs: 500 \}/,
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

test("late foothold route samples require two coherent distinct screenshot windows", async () => {
  const policyStart = source.indexOf(
    "function isAutoplayFootholdRouteFrame(",
  );
  const policyEnd = source.indexOf(
    "\nasync function captureAutoplayFrozenTrajectoryMilestone(",
    policyStart,
  );
  const policySource = source.slice(policyStart, policyEnd);
  const policy = Function(
    "assert",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    `${policySource}; return { autoplayRouteCaptureWindowCoherent, assertAutoplayFootholdRouteCaptureGuard, buildAutoplayFootholdRouteGuardFixture, nextAutoplayFootholdRouteMilestone };`,
  )(assert, 0.1);
  const lateStart = policy.buildAutoplayFootholdRouteGuardFixture(0.633);

  assert.equal(
    policy.nextAutoplayFootholdRouteMilestone({
      capturedRouteMid: false,
      capturedRouteStart: false,
      expectedTargetLocationId: "tea-house",
      route: lateStart,
      routeStartProgress: null,
    }),
    "foothold-route-start",
  );
  assert.equal(
    policy.nextAutoplayFootholdRouteMilestone({
      capturedRouteMid: false,
      capturedRouteStart: true,
      expectedTargetLocationId: "tea-house",
      route: policy.buildAutoplayFootholdRouteGuardFixture(0.744),
      routeStartProgress: lateStart.progress,
    }),
    "foothold-route-mid",
  );
  assert.equal(
    policy.autoplayRouteCaptureWindowCoherent(
      lateStart,
      policy.buildAutoplayFootholdRouteGuardFixture(1, { active: false }),
      "tea-house",
    ),
    false,
  );
  assert.doesNotThrow(() => policy.assertAutoplayFootholdRouteCaptureGuard());

  const routeWindowStart = source.indexOf(
    "async function readAutoplayRouteCaptureProbe(",
  );
  const routeWindowEnd = source.indexOf(
    "\nasync function captureAutoplayRouteTrajectoryMilestone(",
    routeWindowStart,
  );
  const routeWindowSource = source.slice(routeWindowStart, routeWindowEnd);
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
  const genericCaptureStart = source.indexOf(
    "async function acquireAutoplayScreencastFrameWindow(",
  );
  const genericCaptureEnd = source.indexOf(
    "\nfunction autoplayLiveMilestoneMatches(",
    genericCaptureStart,
  );
  const genericCapture = Function(
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
    (_before, after) => after,
    framePolicy.screencastFrameCapturedAtEpochMs,
    framePolicy.screencastFrameIsBracketedByEpochProbes,
    async () => {},
    (value) => value,
    () => ({
      buffer: Buffer.from("validated-frame"),
      height: 625,
      paintProbe: {},
      textPaint: { regionCount: 9, surfaces: ["hud"] },
      width: 1365,
    }),
    () => ({ hudPixelDifferenceRatio: 0 }),
  );
  const routeCapture = Function(
    "assert",
    "AUTOPLAY_ROUTE_CAPTURE_PROBE_MAX_ATTEMPTS",
    "AUTOPLAY_ROUTE_CAPTURE_PROBE_RETRY_DELAY_MS",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "sleep",
    "slug",
    "acquireAutoplayScreencastFrameWindow",
    "assertStableAutoplayScreencastFramePair",
    "assertAutoplayRouteHudContinuity",
    `${policySource}\n${routeWindowSource}; return { acquireAutoplayRouteScreencastWindow, buildAutoplayFootholdRouteGuardFixture };`,
  )(
    assert,
    3,
    0,
    0.1,
    async () => {},
    (value) => value,
    genericCapture,
    () => ({ hudPixelDifferenceRatio: 0 }),
    () => ({}),
  );
  const capturedAtEpochMs = 1_750_000_000_000;
  const routeProbe = (progress, offsetMs, overrides = {}) => ({
    capturedAtEpochMs: capturedAtEpochMs + offsetMs,
    capturedAtMonotonicMs: 100 + offsetMs,
    route: routeCapture.buildAutoplayFootholdRouteGuardFixture(
      progress,
      overrides,
    ),
  });
  const screencastFrame = (sequence, offsetMs) => ({
    data: `active-route-png-${sequence}`,
    metadata: { timestamp: (capturedAtEpochMs + offsetMs) / 1_000 },
    sequence,
  });
  const fakeSession = ({ afterSequence, frame, probes }) => {
    const calls = [];
    const confirmationFrame = {
      ...frame,
      metadata: {
        ...frame.metadata,
        timestamp: frame.metadata.timestamp + 0.13,
      },
      sequence: frame.sequence + 1,
    };
    let nextFrame = frame;
    let blockingScreenshotCalls = 0;
    return {
      calls,
      captureScreenshot: async () => {
        blockingScreenshotCalls += 1;
        await new Promise(() => {});
      },
      get blockingScreenshotCalls() {
        return blockingScreenshotCalls;
      },
      readAutoplayRouteProbe: async () => {
        const probe = probes.shift();
        calls.push(probe ? `route:${probe.route.progress}` : "route:null");
        return probe;
      },
      autoplayScreencastSequence: () => {
        calls.push(`sequence:${afterSequence}`);
        return afterSequence;
      },
      readScreenshotPaintProbe: async () => {
        calls.push("paint");
        return { regions: [], viewport: { height: 625, width: 1365 } };
      },
      waitForAutoplayScreencastFrame: async (options) => {
        calls.push(`frame:${nextFrame.sequence}`);
        assert.equal(
          options.afterSequence,
          nextFrame === frame ? afterSequence : frame.sequence,
        );
        const result = nextFrame;
        assert.ok(
          framePolicy.screencastFrameCapturedAtEpochMs(result) >=
            options.minimumCapturedAtEpochMs,
        );
        nextFrame = confirmationFrame;
        return result;
      },
    };
  };

  const hostedStart = routeCapture.buildAutoplayFootholdRouteGuardFixture(0.523);
  const startSession = fakeSession({
    afterSequence: 10,
    frame: screencastFrame(11, 145),
    probes: [routeProbe(0.53, 10), null, routeProbe(0.56, 300)],
  });
  const startWindow =
    await routeCapture.acquireAutoplayRouteScreencastWindow({
      expectedTargetLocationId: "tea-house",
      initialRoute: hostedStart,
      label: "slow ordinary screenshot fixture",
      session: startSession,
    });
  assert.equal(startWindow.beforeRoute.progress, 0.53);
  assert.equal(startWindow.afterRoute.progress, 0.56);
  assert.equal(startWindow.frame.sequence, 12);
  assert.equal(startSession.blockingScreenshotCalls, 0);
  assert.deepEqual(startSession.calls, [
    "route:0.53",
    "paint",
    "sequence:10",
    "frame:11",
    "frame:12",
    "paint",
    "route:null",
    "route:0.56",
  ]);

  const midSession = fakeSession({
    afterSequence: 20,
    frame: screencastFrame(21, 1_145),
    probes: [routeProbe(0.68, 1_010), routeProbe(0.71, 1_300)],
  });
  const midWindow = await routeCapture.acquireAutoplayRouteScreencastWindow({
    expectedTargetLocationId: "tea-house",
    initialRoute: routeCapture.buildAutoplayFootholdRouteGuardFixture(0.67),
    label: "distinct mid screencast fixture",
    session: midSession,
  });
  assert.ok(
    midWindow.beforeRoute.progress - startWindow.afterRoute.progress >= 0.1,
  );
  assert.ok(midWindow.frame.sequence > startWindow.frame.sequence);

  for (const [label, afterProbe] of [
    ["arrival", routeProbe(1, 2_040, { active: false })],
    [
      "target mismatch",
      routeProbe(0.7, 2_040, { targetLocationId: "repair-stall" }),
    ],
  ]) {
    const mismatchSession = fakeSession({
      afterSequence: 30,
      frame: screencastFrame(31, 2_145),
      probes: [routeProbe(0.68, 2_010), {
        ...afterProbe,
        capturedAtEpochMs: capturedAtEpochMs + 2_300,
      }],
    });
    await assert.rejects(
      routeCapture.acquireAutoplayRouteScreencastWindow({
        expectedTargetLocationId: "tea-house",
        initialRoute: routeCapture.buildAutoplayFootholdRouteGuardFixture(0.67),
        label: `${label} screencast fixture`,
        session: mismatchSession,
      }),
      /screencast frame was not bracketed by one coherent current state/,
    );
  }

  const captureStart = source.indexOf(
    "async function captureAutoplayRouteTrajectoryMilestone(",
  );
  const captureEnd = source.indexOf(
    "\nasync function waitForDistinctAutoplayFootholdRouteProbe(",
    captureStart,
  );
  const captureSource = source.slice(captureStart, captureEnd);

  assert.ok(captureStart >= 0 && captureEnd > captureStart);
  assert.doesNotMatch(
    routeWindowSource,
    /captureScreenshot|Page\.captureScreenshot/,
    "Route evidence must not await the blocking screenshot command.",
  );
  const genericCaptureSource = source.slice(
    genericCaptureStart,
    genericCaptureEnd,
  );
  assert.match(genericCaptureSource, /waitForAutoplayScreencastFrame\(/);
  assert.match(
    genericCaptureSource,
    /screencastFrameIsBracketedByEpochProbes\(/,
  );
  assert.match(source, /decodePngPixels\(buffer\)/);
  assert.match(
    routeWindowSource,
    /writeFile\(screenshot, captureWindow\.validated\.buffer\)/,
  );
  assert.match(source, /Page\.startScreencast/);
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
  assert.match(source, /async readAutoplayRouteProbe\(/);
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
  assert.match(source, /waitForDistinctAutoplayFootholdRouteProbe\(/);
  assert.match(source, /routeMidWindow\.before\.progress - routeStartWindow\.after\.progress/);
  assert.match(source, /routeMidWindow\.frame\.sequence > routeStartWindow\.frame\.sequence/);
  const routeCaptureIndex = source.indexOf(
    "const expectedRouteTarget =",
    source.indexOf("const completion = await waitFor("),
  );
  const domSamplingIndex = source.indexOf(
    "let sampleDom = null",
    routeCaptureIndex,
  );
  assert.ok(
    routeCaptureIndex >= 0 && routeCaptureIndex < domSamplingIndex,
    "Route capture must run before optional DOM sampling can consume the route.",
  );
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
    `${source.slice(paintPolicyStart, paintPolicyEnd)}; return { requireStableAutoplayScreenshotPaintProbe };`,
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
        rect: { bottom: 10, left: 5, right: 60, top: 1 },
        surface: "hud",
        text: "DAY 1 11:05 LATE MORNING MONEY $12 70 ENERGY",
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

test("screencast slow frames stay bounded and lifecycle failures remain diagnostic", async () => {
  assert.match(
    source,
    /MANY_LIVES_BROWSER_AUTOPLAY_SCREENCAST_FRAME_TIMEOUT_MS[\s\S]*?"8000"/,
  );
  const classStart = source.indexOf("class CdpSession {");
  const classEnd = source.indexOf(
    "\nasync function launchBrowserSession(",
    classStart,
  );
  const CdpSession = Function(
    "assert",
    "AUTOPLAY_SCREENCAST_COMMAND_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_EVERY_NTH_FRAME",
    "AUTOPLAY_SCREENCAST_FRAME_TIMEOUT_MS",
    "AUTOPLAY_SCREENCAST_MAX_BUFFERED_FRAMES",
    "CDP_WAIT_TIMEOUT_MS",
    "screencastFrameCapturedAtEpochMs",
    "withTimeout",
    `${source.slice(classStart, classEnd)}; return CdpSession;`,
  )(
    assert,
    5,
    4,
    60,
    4,
    20,
    (frame) => frame?.metadata?.timestamp * 1_000,
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
