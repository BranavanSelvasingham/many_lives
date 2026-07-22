import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL(
  "../apps/many-lives-web/src/components/street/PhaserStreetGameApp.tsx",
  import.meta.url,
);
const source = await readFile(componentPath, "utf8");
const applyGameUpdateSource = source.slice(
  source.indexOf("  const applyGameUpdate = useCallback("),
  source.indexOf("  const loadGame = useCallback("),
);
const loadGameSource = source.slice(
  source.indexOf("  const loadGame = useCallback("),
  source.indexOf(
    "  const handleResumeStoredGame",
    source.indexOf("  const loadGame = useCallback("),
  ),
);
const advanceObjectiveSource = source.slice(
  source.indexOf("  const handleAdvanceObjective = useCallback("),
  source.indexOf(
    "  useEffect(() => {",
    source.indexOf("  const handleAdvanceObjective = useCallback("),
  ),
);
const optimisticCleanupCalls = [
  "setOptimisticPlayerPosition(",
  "setOptimisticPlayerLocationId(",
  "setOptimisticPlayerConversationLocationId(",
  "setOptimisticPlayerMoveDurationMs(",
  "publishWaypoint(",
];
const authorityCalls = [
  "setGame(",
  "clearOptimisticPlayerMove(",
  ...optimisticCleanupCalls,
];

assert.ok(applyGameUpdateSource, "applyGameUpdate source was not found");

function extractBalancedBlock(input, openingBraceIndex) {
  let depth = 0;
  for (let index = openingBraceIndex; index < input.length; index += 1) {
    if (input[index] === "{") {
      depth += 1;
    } else if (input[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(openingBraceIndex + 1, index);
      }
    }
  }

  throw new Error("Unbalanced source block");
}

function transitionBodies(input) {
  const bodies = [];
  let searchFrom = 0;
  while (true) {
    const transitionIndex = input.indexOf(
      "startTransition(() => {",
      searchFrom,
    );
    if (transitionIndex < 0) {
      return bodies;
    }

    const openingBraceIndex = input.indexOf("{", transitionIndex);
    bodies.push(extractBalancedBlock(input, openingBraceIndex));
    searchFrom = openingBraceIndex + 1;
  }
}

test("authoritative game refs only follow committed React state", () => {
  assert.equal(
    (source.match(/gameRef\.current\s*=/g) ?? []).length,
    1,
    "gameRef must only be synchronized by the game effect after render",
  );
  assert.doesNotMatch(applyGameUpdateSource, /gameRef\.current\s*=/);
});

test("the 900ms observer cannot deduplicate stale optimistic render state", () => {
  assert.match(source, /const BOUND_GAME_REFRESH_MS = 900;/);
  assert.match(
    applyGameUpdateSource,
    /buildStreetGameSyncKey\(previousGame\) === nextSyncKey &&\s*!optimisticPlayerRef\.current/,
  );
});

test("fresh URL cleanup cannot issue a newer stale reload request", () => {
  const cleanupGuard = loadGameSource.indexOf(
    "shouldSkipUrlCleanupGameReload({",
  );
  const requestId = loadGameSource.indexOf("const requestId = nextRequestId();");

  assert.ok(cleanupGuard >= 0, "fresh URL cleanup guard is missing");
  assert.ok(
    requestId > cleanupGuard,
    "request IDs must be allocated after URL cleanup exits",
  );
});

test("autoplay only consumes an accepted visibly advancing response", () => {
  assert.match(
    advanceObjectiveSource,
    /autoplayAdvanceMadeVisibleProgress\(activeGame, nextGame\) &&\s*applyGameUpdate\(nextGame, requestId\)/,
  );
  assert.match(
    advanceObjectiveSource,
    /return requestSucceeded && madeVisibleProgress;/,
  );
});

test("deferred move authority settles outside playback transitions", () => {
  const transitions = transitionBodies(applyGameUpdateSource);
  assert.ok(
    transitions.length >= 2,
    "expected staged and ordinary playback transitions",
  );
  for (const transition of transitions) {
    for (const call of authorityCalls) {
      assert.equal(
        transition.includes(call),
        false,
        `${call} must not be left in startTransition`,
      );
    }
  }

  const deadlineStart = applyGameUpdateSource.indexOf(
    "timerId: window.setTimeout(() => {",
  );
  const deadlineEnd = applyGameUpdateSource.indexOf(
    "}, transitionMs),",
    deadlineStart,
  );
  const deadlineSource = applyGameUpdateSource.slice(
    deadlineStart,
    deadlineEnd,
  );
  assert.ok(deadlineStart >= 0 && deadlineEnd > deadlineStart);
  assert.doesNotMatch(deadlineSource, /startTransition\(\(\) => \{/);
  assert.match(deadlineSource, /pendingVisualGameUpdateRef\.current = null;/);
  assert.match(
    deadlineSource,
    /settleCompletedMovePlayback\(current, nextGame\)/,
  );
  assert.ok(
    deadlineSource.indexOf("setGame(nextGame);") <
      deadlineSource.indexOf("settleCompletedMovePlayback(current, nextGame)"),
  );
  assert.ok(
    deadlineSource.indexOf("clearOptimisticPlayerMove();") <
      deadlineSource.indexOf("settleCompletedMovePlayback(current, nextGame)"),
  );
});

test("optimistic move cleanup clears every visual authority field together", () => {
  const cleanupStart = source.indexOf(
    "  const clearOptimisticPlayerMove = useCallback(() => {",
  );
  const cleanupEnd = source.indexOf("  const applyGameUpdate", cleanupStart);
  const cleanupSource = source.slice(cleanupStart, cleanupEnd);

  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  assert.match(cleanupSource, /optimisticPlayerRef\.current = null;/);
  for (const call of optimisticCleanupCalls) {
    assert.ok(cleanupSource.includes(call), `${call} is missing from cleanup`);
  }
});

test("optimistic move authority is staged synchronously with its render state", () => {
  assert.match(
    applyGameUpdateSource,
    /optimisticPlayerRef\.current = visualTarget;\s*setOptimisticPlayerPosition\(visualTarget\);/,
  );
});

test("game reloads cancel pending movement through the shared authority cleanup", () => {
  const loadGameSource = source.slice(
    source.indexOf("  const loadGame = useCallback("),
    source.indexOf("  const handleResumeStoredGame"),
  );

  assert.match(
    loadGameSource,
    /clearPendingVisualGameUpdate\(\);\s*clearOptimisticPlayerMove\(\);\s*setRowanPlayback/,
  );
  assert.doesNotMatch(
    loadGameSource,
    /setOptimisticPlayer(?:Position|LocationId|ConversationLocationId|MoveDurationMs)\(null\)/,
  );
});

test("autoplay timing skips redundant passive-effect state dispatches", () => {
  const timingPublisherStart = source.indexOf(
    "  const publishAutoContinueBeatTiming = useCallback(",
  );
  const timingPublisherEnd = source.indexOf(
    "  useEffect(() => {",
    timingPublisherStart,
  );
  const timingPublisherSource = source.slice(
    timingPublisherStart,
    timingPublisherEnd,
  );
  const autoplayEffectStart = source.indexOf(
    "  useEffect(() => {\n    if (objectiveAutoContinueTimerRef.current)",
  );
  const autoplayEffectEnd = source.indexOf(
    "  useEffect(() => {\n    const handleOverrideChange",
    autoplayEffectStart,
  );
  const autoplayEffectSource = source.slice(
    autoplayEffectStart,
    autoplayEffectEnd,
  );

  assert.ok(timingPublisherStart >= 0 && timingPublisherEnd > timingPublisherStart);
  assert.match(timingPublisherSource, /autoContinueBeatTimingRef\.current/);
  assert.match(timingPublisherSource, /setAutoContinueBeatTimingState\(next\)/);
  assert.doesNotMatch(autoplayEffectSource, /setAutoContinueBeatTimingState/);
  assert.equal(
    (autoplayEffectSource.match(/publishAutoContinueBeatTiming\(/g) ?? [])
      .length,
    2,
  );
});
