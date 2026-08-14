import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldFollowCommandRailGrowth,
  shouldFollowLatestConversationLine,
} from "./overlayDomState";
import {
  getCompactOverlayLayoutMetrics,
  getCompactRailPresentation,
} from "./runtimeViewport";

test("near-bottom command rail growth follows only a continuing live conversation", () => {
  assert.equal(
    shouldFollowCommandRailGrowth({
      nearBottom: true,
      nextConversationActive: false,
      previousConversationActive: false,
    }),
    false,
  );
  assert.equal(
    shouldFollowCommandRailGrowth({
      nearBottom: true,
      nextConversationActive: true,
      previousConversationActive: true,
    }),
    true,
  );
  assert.equal(
    shouldFollowCommandRailGrowth({
      nearBottom: true,
      nextConversationActive: false,
      previousConversationActive: true,
    }),
    false,
  );
  assert.equal(
    shouldFollowCommandRailGrowth({
      nearBottom: false,
      nextConversationActive: true,
      previousConversationActive: true,
    }),
    false,
  );
});

test("streaming growth keeps following a partially visible latest reply", () => {
  assert.equal(
    shouldFollowLatestConversationLine({
      distanceFromBottom: 67,
      latestMeaningfulBottom: 791,
      latestMeaningfulTop: 702,
      viewportBottom: 755,
      viewportTop: 733,
    }),
    true,
  );
});

test("intentional transcript history scroll is preserved", () => {
  assert.equal(
    shouldFollowLatestConversationLine({
      distanceFromBottom: 140,
      latestMeaningfulBottom: 880,
      latestMeaningfulTop: 791,
      viewportBottom: 755,
      viewportTop: 660,
    }),
    false,
  );
});

test("near-bottom transcripts continue following after a layout reflow", () => {
  assert.equal(
    shouldFollowLatestConversationLine({
      distanceFromBottom: 32,
      latestMeaningfulBottom: null,
      latestMeaningfulTop: null,
      viewportBottom: 755,
      viewportTop: 660,
    }),
    true,
  );
});

test("compact tall rail uses a consistent bounded summary footprint", () => {
  for (const [viewport, expectedHeight, expectedWidth] of [
    [{ height: 998, width: 662 }, 152, 344.24],
    [{ height: 1041, width: 669 }, 152, 347.88],
    [{ height: 1024, width: 768 }, 132, 320],
  ]) {
    const metrics = getCompactOverlayLayoutMetrics(viewport, {
      hasPrimaryAction: false,
    });

    assert.equal(metrics.railCollapsedHeight, expectedHeight);
    assert.equal(metrics.railWidth, expectedWidth);
    assert.ok(metrics.railWidth < viewport.width * 0.56);
    assert.ok(
      metrics.railBottomOffset + metrics.railCollapsedHeight < viewport.height,
    );
  }
});

test("true-phone rail metrics retain their existing map-first footprint", () => {
  const metrics = getCompactOverlayLayoutMetrics(
    { height: 844, width: 390 },
    { hasPrimaryAction: false },
  );

  assert.equal(metrics.railBottomOffset, 64);
  assert.equal(metrics.railCollapsedHeight, 144);
  assert.equal(metrics.railWidth, 366);
});

test("compact rail presentation keeps complete state-backed copy", () => {
  assert.deepEqual(
    getCompactRailPresentation({
      districtName: "South Quay",
      fallbackTitle: "Enter Morrow House",
      selectedAction: "Enter Morrow House",
      statusLabel: "Watching Rowan",
      thought: "Rowan is stepping inside Morrow House to ask Mara.",
    }),
    {
      contextLabel: "South Quay • Watching Rowan",
      kickerLabel: "Many Lives • Living-world sim",
      thought: "Rowan is stepping inside Morrow House to ask Mara.",
    },
  );
});

test("compact rail presentation falls back to a complete action, never an ellipsis", () => {
  const presentation = getCompactRailPresentation({
    districtName: "South Quay",
    fallbackTitle:
      "A deliberately long fallback title that cannot fit inside the compact current-thought budget without becoming visually noisy",
    selectedAction: "Check the pump at Mercer Repairs",
    statusLabel: "Choosing a route",
    thought:
      "Rowan is considering an intentionally long current thought without a sentence boundary so the compact surface must choose stronger state-backed copy instead of clipping it midway through",
  });

  assert.equal(presentation.thought, "Check the pump at Mercer Repairs.");
  assert.doesNotMatch(presentation.thought, /(?:\.{3}|…)/);
});

test("compact rail presentation rejects an upstream ellipsis as incomplete copy", () => {
  const presentation = getCompactRailPresentation({
    districtName: "South Quay",
    fallbackTitle: "Enter Morrow House",
    selectedAction: "Ask Mara about the room",
    statusLabel: "Watching Rowan",
    thought: "Rowan is stepping inside Morrow House to ask...",
  });

  assert.equal(presentation.thought, "Ask Mara about the room.");
});
