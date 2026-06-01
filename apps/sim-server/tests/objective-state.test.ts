import { describe, expect, it } from "vitest";
import {
  buildPlayerObjectiveState,
  classifyObjective,
} from "../src/sim/objectiveState.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type { PlayerObjective } from "../src/street-sim/types.js";

describe("objectiveState classification", () => {
  it("treats Ada's steady-hands lead as work instead of housing", () => {
    expect(
      classifyObjective("Ask Ada if Kettle & Lamp needs steady hands today."),
    ).toBe("work");
  });

  it("treats Mara's lead verification loop as work", () => {
    expect(
      classifyObjective(
        "Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.",
      ),
    ).toBe("work");
  });

  it("treats Tomas's yard lead as work", () => {
    expect(
      classifyObjective("See if Tomas still needs another back at North Crane Yard."),
    ).toBe("work");
  });

  it("keeps explicit room-security wording on the settle track", () => {
    expect(
      classifyObjective(
        "Find out what it takes to keep my room at Morrow House tonight.",
      ),
    ).toBe("settle");
  });

  it("exposes desired-state outcomes and blockers for a pump objective", () => {
    const world = seedStreetGame("objective-pump-blockers");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.status = "active";
    }

    const objective = buildPlayerObjectiveState(world, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });

    expect(objective).toMatchObject({
      routeKey: "tool-pump",
      progress: {
        completed: 1,
        total: 3,
      },
    });
    expect(objective?.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "help-pump-inspect",
          status: "met",
        }),
        expect.objectContaining({
          id: "help-pump-tool",
          status: "blocked",
          blockers: expect.arrayContaining([
            "Rowan does not have a wrench yet.",
          ]),
        }),
        expect.objectContaining({
          id: "help-pump-fix",
          status: "blocked",
          blockers: expect.arrayContaining([
            "The pump needs a wrench before Rowan can solve it.",
          ]),
        }),
      ]),
    );
  });

  it("marks objectives complete from world predicates despite stale trail state", () => {
    const world = seedStreetGame("objective-pump-predicates");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.status = "solved";
    }
    world.player.inventory.push({
      id: "item-wrench",
      name: "Old wrench",
      description: "A tool for the pump.",
    });

    const previous: PlayerObjective = {
      ...(world.player.objective as PlayerObjective),
      focus: "help",
      source: "manual",
      routeKey: "help-pump",
      text: "Fix the pump in Morrow Yard before it spreads.",
      trail: [
        {
          id: "stale-scripted-step",
          title: "Ask Mara instead of checking the solved pump.",
          done: false,
          npcId: "npc-mara",
          targetLocationId: "boarding-house",
        },
      ],
      outcomes: [],
      completedTrail: [],
      progress: {
        completed: 0,
        label: "0/1 stale trail item",
        total: 1,
      },
    };

    const objective = buildPlayerObjectiveState(world, {
      focus: "help",
      previous,
      source: "manual",
      text: previous.text,
    });

    expect(objective).toMatchObject({
      routeKey: "help-pump",
      progress: {
        completed: 3,
        total: 3,
      },
    });
    expect(objective?.outcomes.every((outcome) => outcome.status === "met")).toBe(
      true,
    );
  });

  it("recognizes paid work outcomes without relying on trail completion", () => {
    const world = seedStreetGame("objective-paid-work");
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    if (teaJob) {
      teaJob.discovered = true;
      teaJob.accepted = true;
      teaJob.completed = true;
    }
    world.player.money = 26;

    const objective = buildPlayerObjectiveState(world, {
      focus: "work",
      source: "manual",
      text: "Earn money at Kettle & Lamp.",
    });

    expect(objective).toMatchObject({
      routeKey: "work-tea",
      progress: {
        completed: 4,
        total: 4,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "work-lead-tea",
      "work-commit",
      "work-finish",
      "work-pay",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.status === "met")).toBe(
      true,
    );
  });
});
