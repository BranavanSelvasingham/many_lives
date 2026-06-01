import { describe, expect, it } from "vitest";
import { buildObjectivePlanRows } from "../../many-lives-web/src/lib/street/journalModel.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type { StreetGameState } from "../src/street-sim/types.js";

function asWebGame(world: StreetGameState) {
  return world as unknown as import("../../many-lives-web/src/lib/street/types.js").StreetGameState;
}

describe("street journal model", () => {
  it("shows objective outcomes before route trail hints", () => {
    const world = seedStreetGame("journal-objective-outcomes");
    world.player.objective = {
      ...world.player.objective!,
      outcomes: [
        {
          id: "room-secured",
          label: "Room secured at Morrow House.",
          status: "met",
          urgency: 9,
          evidence: "Mara confirmed tonight's bed.",
        },
        {
          id: "pump-solved",
          label: "Pump solved before it spreads.",
          status: "blocked",
          urgency: 7,
          blockers: ["Rowan does not have a wrench yet."],
        },
      ],
      trail: [
        {
          id: "stale-route-step",
          title: "Follow an old route hint.",
          done: false,
        },
      ],
    };
    const locationById = new Map(
      world.locations.map((location) => [location.id, location] as const),
    );

    const rows = buildObjectivePlanRows(asWebGame(world), locationById);

    expect(rows.map((row) => row.id)).toEqual([
      "room-secured",
      "pump-solved",
    ]);
    expect(rows.map((row) => row.title)).not.toContain(
      "Follow an old route hint.",
    );
    expect(rows[1]).toMatchObject({
      detail: "Rowan does not have a wrench yet.",
      progress: "Blocked",
    });
  });
});
