import assert from "node:assert/strict";
import test from "node:test";

import { isFirstAfternoonOpening } from "./rowanPlayback";
import type { StreetGameState } from "./types";

function openingGame(completedOutcomes: number): StreetGameState {
  return {
    activeSpaceId: "street:south-quay",
    conversationThreads: {},
    conversations: [],
    firstAfternoon: {},
    player: {
      objective: {
        progress: { completed: completedOutcomes, total: 4 },
      },
      spaceId: "street:south-quay",
    },
    rowanAutonomy: {
      actionId: "enter:boarding-house",
    },
  } as unknown as StreetGameState;
}

test("seeded opening facts retain the fast first-action schedule", () => {
  assert.equal(isFirstAfternoonOpening(openingGame(0)), true);
  assert.equal(isFirstAfternoonOpening(openingGame(1)), true);
});

test("opening treatment ends when Rowan selects the next action", () => {
  const game = openingGame(1);
  game.rowanAutonomy.actionId = undefined;
  game.rowanAutonomy.npcId = "npc-mara";

  assert.equal(isFirstAfternoonOpening(game), false);
});
