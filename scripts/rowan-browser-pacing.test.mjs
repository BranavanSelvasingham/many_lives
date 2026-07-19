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
    'captureMilestoneOnce("opening", openingProbe, openingDom)',
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
    "\nasync function captureAutoplayTrajectoryMilestone(",
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
  const routeCapture = Function(
    "assert",
    "AUTOPLAY_ROUTE_CAPTURE_PROBE_MAX_ATTEMPTS",
    "AUTOPLAY_ROUTE_CAPTURE_PROBE_RETRY_DELAY_MS",
    "AUTOPLAY_ROUTE_MIN_DISTINCT_PROGRESS",
    "sleep",
    "slug",
    `${policySource}\n${routeWindowSource}; return { buildAutoplayFootholdRouteGuardFixture, captureAutoplayRouteScreenshotWindow };`,
  )(assert, 3, 0, 0.1, async () => {}, (value) => value);
  const captureCalls = [];
  const captureRoutes = [
    routeCapture.buildAutoplayFootholdRouteGuardFixture(0.641),
    null,
    routeCapture.buildAutoplayFootholdRouteGuardFixture(0.652),
  ];
  const captureWindow =
    await routeCapture.captureAutoplayRouteScreenshotWindow({
      expectedTargetLocationId: "tea-house",
      initialRoute: lateStart,
      label: "transient null route fixture",
      screenshot: "/tmp/route-fixture.png",
      session: {
        captureScreenshot: async (_path, { afterCapture, beforeCapture }) => {
          await beforeCapture();
          captureCalls.push("screenshot");
          await afterCapture();
        },
        readAutoplayRouteProbe: async () => {
          const route = captureRoutes.shift();
          captureCalls.push(route ? `route:${route.progress}` : "route:null");
          return route;
        },
      },
    });
  assert.equal(captureWindow.beforeRoute.progress, 0.641);
  assert.equal(captureWindow.afterRoute.progress, 0.652);
  assert.deepEqual(captureCalls, [
    "route:0.641",
    "screenshot",
    "route:null",
    "route:0.652",
  ]);

  const arrivalCalls = [];
  const arrivalRoutes = [
    routeCapture.buildAutoplayFootholdRouteGuardFixture(0.641),
    null,
    routeCapture.buildAutoplayFootholdRouteGuardFixture(1, { active: false }),
  ];
  await assert.rejects(
    routeCapture.captureAutoplayRouteScreenshotWindow({
      expectedTargetLocationId: "tea-house",
      initialRoute: lateStart,
      label: "arrival route fixture",
      screenshot: "/tmp/arrival-route-fixture.png",
      session: {
        captureScreenshot: async (_path, { afterCapture, beforeCapture }) => {
          await beforeCapture();
          arrivalCalls.push("screenshot");
          await afterCapture();
        },
        readAutoplayRouteProbe: async () => arrivalRoutes.shift(),
      },
    }),
    /screenshot was not bracketed by the same active legal route/,
  );
  assert.deepEqual(arrivalCalls, ["screenshot"]);

  const captureStart = source.indexOf(
    "async function captureAutoplayRouteTrajectoryMilestone(",
  );
  const captureEnd = source.indexOf(
    "\nasync function waitForDistinctAutoplayFootholdRouteProbe(",
    captureStart,
  );
  const captureSource = source.slice(captureStart, captureEnd);
  const screenshotMethodStart = source.indexOf("async captureScreenshot(");
  const screenshotMethodEnd = source.indexOf(
    "\n  waitForEvent(",
    screenshotMethodStart,
  );
  const screenshotMethodSource = source.slice(
    screenshotMethodStart,
    screenshotMethodEnd,
  );
  const beforeCaptureIndex = screenshotMethodSource.indexOf(
    "await beforeCapture({ attempt })",
  );
  const screenshotIndex = screenshotMethodSource.indexOf(
    'this.send("Page.captureScreenshot"',
  );
  const afterCaptureIndex = screenshotMethodSource.indexOf(
    "await afterCapture({ attempt })",
  );

  assert.ok(captureStart >= 0 && captureEnd > captureStart);
  assert.ok(
    beforeCaptureIndex >= 0 &&
      beforeCaptureIndex < screenshotIndex &&
      screenshotIndex < afterCaptureIndex,
    "Route probes must run immediately around Page.captureScreenshot.",
  );
  assert.match(routeWindowSource, /beforeCapture:/);
  assert.match(routeWindowSource, /afterCapture:/);
  assert.doesNotMatch(source, /Page\.setWebLifecycleState/);
  assert.doesNotMatch(source, /Emulation\.setVirtualTimePolicy/);
  assert.match(source, /async readAutoplayRouteProbe\(/);
  assert.doesNotMatch(
    captureSource,
    /readAutoplayDomAudit|readCameraProbe|readMapAgencyProbe/,
    "Route capture must return to phase sampling without blocking auxiliary reads.",
  );
  assert.match(captureSource, /routeCaptureWindow:/);
  assert.match(source, /waitForDistinctAutoplayFootholdRouteProbe\(/);
  assert.match(source, /routeMidWindow\.before\.progress - routeStartWindow\.after\.progress/);
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
