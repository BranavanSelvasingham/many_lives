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
