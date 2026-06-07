import { describe, expect, it } from "vitest";

import { buildRowanCognitionState } from "../src/sim/rowanCognition.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type { PlayerObjective, StreetGameState } from "../src/street-sim/types.js";

function addNpcReply(
  world: StreetGameState,
  npcId: string,
  speakerName: string,
  text: string,
) {
  world.conversations.push({
    id: `conversation-${world.conversations.length + 1}`,
    locationId: world.player.currentLocationId,
    npcId,
    speaker: "npc",
    speakerName,
    text,
    threadId: `thread-${npcId}`,
    time: world.currentTime,
  });
}

describe("Rowan cognition Notebook authority", () => {
  it("keeps the opening Notebook anchored to shelter and Mara", () => {
    const world = seedStreetGame("game-opening-notebook-cognition");
    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.title).toBe("Keep a stable room");
    expect(notebook.belief).toMatch(/Mara|room|Morrow House/i);
    expect(notebook.uncertainty).toMatch(/bed|temporary/i);
  });

  it("rotates the late Notebook from stable shelter to the active Nia lead", () => {
    const world = seedStreetGame("game-late-nia-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;

    world.currentTime = "Day 1, 15:50";
    world.clock.hour = 15;
    world.clock.minute = 50;
    world.clock.totalMinutes = 15 * 60 + 50;
    world.firstAfternoon = {
      completedAt: "Day 1, 15:24",
    };
    world.player.currentLocationId = "repair-stall";
    world.player.knownNpcIds = Array.from(
      new Set([
        ...world.player.knownNpcIds,
        "npc-mara",
        "npc-ada",
        "npc-jo",
        "npc-nia",
      ]),
    );
    world.player.reputation.morrow_house = 2;
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    if (teaJob) {
      teaJob.accepted = true;
      teaJob.completed = true;
      teaJob.discovered = true;
    }
    addNpcReply(
      world,
      "npc-mara",
      "Mara",
      "You can stay if you keep proving the house can count on you.",
    );
    addNpcReply(
      world,
      "npc-jo",
      "Jo",
      "Ask Nia where the block is about to jam before the square feels it.",
    );
    world.player.objective = {
      ...currentObjective,
      focus: "help",
      routeKey: "people-nia",
      source: "conversation",
      text: "Ask Nia where the block is about to jam before the square feels it.",
      outcomes: [
        {
          authority: "predicate",
          id: "nia-block-lead",
          label: "Ask Nia where the block is about to jam",
          npcId: "npc-nia",
          status: "open",
          urgency: 86,
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      trail: [],
    };
    world.rowanAutonomy = {
      autoContinue: true,
      detail: "Talk to Nia next while there is still time.",
      intent: {
        reason: "Talk to Nia next while there is still time.",
        signals: [
          "Goal: Ask Nia where the block is about to jam before the square feels it.",
        ],
      },
      key: "conversation-finished:jo",
      label: "Exit to South Quay",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.title).not.toBe("Keep a stable room");
    expect(notebook.belief).toMatch(/Nia|Jo|block|jam|square/i);
    expect(notebook.uncertainty).toMatch(/Nia|block|jam/i);
    expect(
      `${notebook.title} ${notebook.belief} ${notebook.uncertainty}`,
    ).not.toMatch(/Mara is the person most likely|tonight's bed|temporary/i);
    expect(notebook.authority.beliefId).toBe("belief-nia-current-lead");
  });
});
