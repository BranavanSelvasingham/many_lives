import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldFollowCommandRailGrowth,
  shouldFollowLatestConversationLine,
} from "./overlayDomState";

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
