import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserRegressionPath = new URL(
  "./rowan-browser-regression.mjs",
  import.meta.url,
);
const source = await readFile(browserRegressionPath, "utf8");
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
