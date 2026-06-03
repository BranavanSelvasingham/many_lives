import { describe, expect, it } from "vitest";
import {
  buildObjectiveCompletionRows,
  buildObjectivePlanRows,
} from "../../many-lives-web/src/lib/street/journalModel.js";
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

  it("shows completed objective outcomes before completed route trail hints", () => {
    const world = seedStreetGame("journal-objective-completions");
    world.player.objective = {
      ...world.player.objective!,
      completedTrail: [
        {
          id: "stale-completed-route-step",
          title: "Followed the old route instruction.",
          done: true,
          timestamp: world.currentTime,
        },
      ],
      outcomes: [
        {
          id: "paid-work-secured",
          label: "Paid work secured.",
          status: "met",
          urgency: 9,
          evidence: "Ada paid Rowan for the lunch shift.",
        },
        {
          id: "pump-solved",
          label: "Pump solved before supper.",
          status: "blocked",
          urgency: 7,
          blockers: ["The pump is still active."],
        },
      ],
      trail: [
        {
          id: "stale-route-step",
          title: "Walk to the exact old waypoint.",
          done: false,
        },
      ],
    };
    const locationById = new Map(
      world.locations.map((location) => [location.id, location] as const),
    );

    const rows = buildObjectiveCompletionRows(asWebGame(world), locationById);

    expect(rows.map((row) => row.id)).toEqual(["paid-work-secured"]);
    expect(rows[0]).toMatchObject({
      detail: "Ada paid Rowan for the lunch shift.",
      progress: "Met",
      title: "Paid work secured.",
    });
    expect(rows.map((row) => row.title)).not.toContain(
      "Followed the old route instruction.",
    );
  });
});
