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
    expect(objective?.trail.map((step) => step.id)).toEqual([
      "help-pump-inspect",
      "help-pump-tool",
      "help-pump-fix",
    ]);
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "pump-discovered",
      "wrench-in-inventory",
      "pump-solved",
    ]);
    expect(objective?.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pump-discovered",
          status: "met",
        }),
        expect.objectContaining({
          id: "wrench-in-inventory",
          status: "blocked",
          blockers: expect.arrayContaining([
            "Rowan does not have a wrench yet.",
          ]),
        }),
        expect.objectContaining({
          id: "pump-solved",
          status: "blocked",
          blockers: expect.arrayContaining([
            "The pump needs a wrench before Rowan can solve it.",
          ]),
        }),
      ]),
    );
  });

  it("does not turn unfinished trail labels into dynamic objective authority", () => {
    const world = seedStreetGame("objective-dynamic-text-not-trail");
    world.player.objective = undefined;

    const objective = buildPlayerObjectiveState(world);
    const nextTrailTitle = objective?.trail.find((step) => !step.done)?.title;

    expect(objective).toMatchObject({
      routeKey: "first-afternoon",
      text: "Make Rowan's first afternoon count: understand the room, earn a little money, and end with a real foothold.",
    });
    expect(nextTrailTitle).toBe("Ask Mara how to keep tonight's room.");
    expect(objective?.text).not.toBe(nextTrailTitle);
  });

  it("exposes the first afternoon as explicit predicates, not trail-derived authority", () => {
    const world = seedStreetGame("objective-first-afternoon-predicates");
    world.player.objective = undefined;

    const objective = buildPlayerObjectiveState(world);

    expect(objective).toMatchObject({
      routeKey: "first-afternoon",
      progress: {
        completed: 0,
        total: 8,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "first-afternoon-room",
      "first-afternoon-choose-move",
      "first-afternoon-ada-lead",
      "first-afternoon-record-lead",
      "first-afternoon-take-shift",
      "first-afternoon-start-shift",
      "first-afternoon-finish-shift",
      "first-afternoon-take-stock",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "first-afternoon-room",
      npcId: "npc-mara",
      status: "open",
      targetLocationId: "boarding-house",
    });
    expect(
      objective?.outcomes.slice(1).some(
        (outcome) =>
          outcome.actionId || outcome.npcId || outcome.targetLocationId,
      ),
    ).toBe(false);
  });

  it("exposes Mara's Ada lead as predicate authority, not trail authority", () => {
    const world = seedStreetGame("objective-mara-ada-predicates");

    const objective = buildPlayerObjectiveState(world, {
      focus: "work",
      source: "manual",
      text: "Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.",
    });

    expect(objective).toMatchObject({
      routeKey: "mara-ada-lead",
      progress: {
        completed: 1,
        total: 6,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "mara-ada-hear-lead",
      "mara-ada-form-intent",
      "mara-ada-walk-route",
      "mara-ada-ask-directly",
      "mara-ada-record-evidence",
      "mara-ada-open-choice",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "mara-ada-hear-lead",
      npcId: "npc-mara",
      status: "open",
      targetLocationId: "boarding-house",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "mara-ada-form-intent",
      status: "met",
      targetLocationId: undefined,
    });
    expect(objective?.outcomes[2]).toMatchObject({
      id: "mara-ada-walk-route",
      status: "open",
      targetLocationId: "tea-house",
    });
    expect(objective?.outcomes[3]).toMatchObject({
      id: "mara-ada-ask-directly",
      npcId: "npc-ada",
      status: "blocked",
      targetLocationId: "tea-house",
    });
  });

  it("exposes settle routes as room, standing, work, income, and people predicates", () => {
    const world = seedStreetGame("objective-settle-predicates");

    const objective = buildPlayerObjectiveState(world, {
      focus: "settle",
      source: "manual",
      text: "Find out what it takes to keep my room at Morrow House tonight.",
    });

    expect(objective).toMatchObject({
      routeKey: "settle-core",
      progress: {
        completed: 0,
        total: 5,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "settle-terms",
      "settle-standing",
      "settle-lead",
      "settle-income",
      "settle-people",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "settle-terms",
      npcId: "npc-mara",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "settle-standing",
      actionId: undefined,
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objective?.outcomes[2]).toMatchObject({
      id: "settle-lead",
      npcId: "npc-ada",
      status: "blocked",
      targetLocationId: "tea-house",
    });
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
    expect(objective?.trail.map((step) => step.id)).toEqual([
      "help-pump-inspect",
      "help-pump-tool",
      "help-pump-fix",
    ]);
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "pump-discovered",
      "wrench-in-inventory",
      "pump-solved",
    ]);
    expect(objective?.outcomes.map((outcome) => outcome.id)).not.toContain(
      "stale-scripted-step",
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
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes.every((outcome) => outcome.status === "met")).toBe(
      true,
    );
  });

  it("exposes work routes as desired predicates with live intent targets", () => {
    const world = seedStreetGame("objective-work-predicates");
    const objective = buildPlayerObjectiveState(world, {
      focus: "work",
      source: "manual",
      text: "Verify Tomas's yard opening from current world state.",
    });

    expect(objective).toMatchObject({
      routeKey: "work-yard",
      progress: {
        completed: 0,
        total: 4,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "work-lead-yard",
      "work-commit",
      "work-finish",
      "work-pay",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "work-lead-yard",
      npcId: "npc-tomas",
      status: "blocked",
      targetLocationId: "freight-yard",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "work-commit",
      actionId: undefined,
      status: "blocked",
      targetLocationId: "freight-yard",
    });
  });

  it("exposes active job commitments as desired predicates", () => {
    const world = seedStreetGame("objective-commitment-predicates");
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    if (teaJob) {
      teaJob.discovered = true;
      teaJob.accepted = true;
    }
    world.player.activeJobId = "job-tea-shift";
    world.player.objective = undefined;

    const objective = buildPlayerObjectiveState(world);

    expect(objective).toMatchObject({
      routeKey: "commitment-job-tea-shift",
      progress: {
        completed: 0,
        total: 3,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "commitment-go-job-tea-shift",
      "commitment-window-job-tea-shift",
      "commitment-finish-job-tea-shift",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "commitment-go-job-tea-shift",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objective?.outcomes[2]).toMatchObject({
      id: "commitment-finish-job-tea-shift",
      actionId: undefined,
      targetLocationId: "tea-house",
    });
  });

  it("exposes tool routes as desired predicates with live tool targets", () => {
    const world = seedStreetGame("objective-tool-predicates");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.status = "active";
    }

    const objective = buildPlayerObjectiveState(world, {
      focus: "tool",
      source: "manual",
      text: "Buy a wrench for the pump and bring it back.",
    });

    expect(objective).toMatchObject({
      routeKey: "tool-wrench",
      progress: {
        completed: 0,
        total: 3,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "tool-buy",
      "tool-return",
      "tool-use",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      actionId: "buy:item-wrench",
      id: "tool-buy",
      status: "blocked",
      targetLocationId: "repair-stall",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "tool-return",
      targetLocationId: undefined,
    });
  });

  it("exposes rest routes as desired predicates instead of rest trail steps", () => {
    const world = seedStreetGame("objective-rest-predicates");
    world.player.currentLocationId = "tea-house";
    world.player.energy = 24;

    const objective = buildPlayerObjectiveState(world, {
      focus: "rest",
      source: "manual",
      text: "Rest at Morrow House before taking another commitment.",
    });

    expect(objective).toMatchObject({
      routeKey: "rest-home",
      progress: {
        completed: 0,
        total: 2,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "rest-return",
      "rest-hour",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "rest-return",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      actionId: undefined,
      id: "rest-hour",
      targetLocationId: "boarding-house",
    });
  });

  it("exposes people routes as desired social predicates", () => {
    const world = seedStreetGame("objective-people-predicates");

    const objective = buildPlayerObjectiveState(world, {
      focus: "people",
      source: "manual",
      text: "Meet people and make the rounds.",
    });

    expect(objective).toMatchObject({
      routeKey: "people-npc-mara",
      progress: {
        completed: 1,
        total: 3,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "people-talk",
      "people-open",
      "people-friend",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "people-talk",
      npcId: "npc-mara",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "people-open",
      status: "met",
    });
  });

  it("exposes explore routes as desired map-knowledge predicates", () => {
    const world = seedStreetGame("objective-explore-predicates");

    const objective = buildPlayerObjectiveState(world, {
      focus: "explore",
      source: "manual",
      text: "Explore the district and get your bearings.",
    });

    expect(objective).toMatchObject({
      routeKey: "explore-tea-house",
      progress: {
        completed: 0,
        total: 3,
      },
    });
    expect(objective?.outcomes.map((outcome) => outcome.id)).toEqual([
      "explore-go",
      "explore-talk",
      "explore-learn",
    ]);
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes[0]).toMatchObject({
      id: "explore-go",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objective?.outcomes[1]).toMatchObject({
      id: "explore-talk",
      npcId: undefined,
      targetLocationId: undefined,
    });
  });

  it("recognizes tool outcomes from live state despite stale trail state", () => {
    const world = seedStreetGame("objective-tool-stale-trail");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.status = "solved";
    }
    world.player.currentLocationId = "courtyard";
    world.player.inventory.push({
      id: "item-wrench",
      name: "Old wrench",
      description: "A tool for the pump.",
    });

    const previous: PlayerObjective = {
      ...(world.player.objective as PlayerObjective),
      focus: "tool",
      source: "manual",
      routeKey: "tool-wrench",
      text: "Buy a wrench for the pump and bring it back.",
      trail: [
        {
          id: "stale-tool-step",
          title: "Go buy another wrench even though the pump is solved.",
          done: false,
          actionId: "buy:item-wrench",
          targetLocationId: "repair-stall",
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
      focus: "tool",
      previous,
      source: "manual",
      text: previous.text,
    });

    expect(objective).toMatchObject({
      routeKey: "tool-wrench",
      progress: {
        completed: 3,
        total: 3,
      },
    });
    expect(objective?.outcomes.every((outcome) => outcome.authority === "predicate")).toBe(
      true,
    );
    expect(objective?.outcomes.every((outcome) => outcome.status === "met")).toBe(
      true,
    );
    expect(objective?.outcomes.map((outcome) => outcome.id)).not.toContain(
      "stale-tool-step",
    );
  });
});
