import { describe, expect, it } from "vitest";
import {
  buildPlayerObjectiveState,
  classifyObjective,
} from "../src/sim/objectiveState.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";

function addConversationWith(world: StreetGameState, npcId: string) {
  world.conversations.push({
    id: `conversation-${world.id}-${npcId}-${world.conversations.length}`,
    locationId: world.player.currentLocationId,
    npcId,
    speaker: "player",
    speakerName: "Rowan",
    text: `Checking in with ${npcId}.`,
    threadId: `thread-${world.id}-${npcId}`,
    time: world.currentTime,
  });
}

function setFirstAfternoonLeadFieldNote(world: StreetGameState) {
  world.firstAfternoon = {
    ...world.firstAfternoon,
    leadFieldNote: {
      createdAt: world.currentTime,
      evidence: "Ada confirmed the Kettle & Lamp lunch lead.",
      learned: "Ada can use steady hands before lunch.",
      memory: "Ada saw Rowan ask directly.",
      next: "Take the cup-and-counter shift.",
    },
  };
}

function firstAfternoonObjective(world: StreetGameState) {
  return buildPlayerObjectiveState(world, {
    focus: "settle",
    source: "dynamic",
    text: "Make the first afternoon count.",
  });
}

function maraAdaLeadObjective(
  world: StreetGameState,
  source: "manual" | "seed" = "manual",
) {
  return buildPlayerObjectiveState(world, {
    focus: "work",
    source,
    text: "Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.",
  });
}

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
      classifyObjective(
        "See if Tomas still needs another back at North Crane Yard.",
      ),
    ).toBe("work");
  });

  it("keeps explicit room-security wording on the settle track", () => {
    expect(
      classifyObjective(
        "Find out what it takes to keep my room at Morrow House tonight.",
      ),
    ).toBe("settle");
  });

  it("treats the late Nia block-jam lead as people instead of stale housing", () => {
    const text =
      "Ask Nia where the block is about to jam before the square feels it.";

    expect(classifyObjective(text)).toBe("people");

    const world = seedStreetGame("objective-nia-block-lead");
    world.player.knownNpcIds = Array.from(
      new Set([...world.player.knownNpcIds, "npc-nia"]),
    );
    const objective = buildPlayerObjectiveState(world, {
      focus: classifyObjective(text),
      previous: world.player.objective,
      source: "conversation",
      text,
    });
    const objectiveText = [
      objective?.routeKey,
      ...(objective?.outcomes.map((outcome) => outcome.label) ?? []),
      ...(objective?.trail.map((step) => step.title) ?? []),
    ].join(" ");

    expect(objective?.routeKey).toBe("people-npc-nia");
    expect(objectiveText).toMatch(/Nia/i);
    expect(objectiveText).not.toMatch(
      /Build standing at Morrow House|room stays mine|Morrow House standing built/i,
    );
  });

  it("exposes desired-state outcomes and blockers for a pump objective", () => {
    const world = seedStreetGame("objective-pump-blockers");
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
    expect(objective?.outcomes[0]).toMatchObject({
      id: "first-afternoon-room",
      npcId: "npc-mara",
      status: "open",
      targetLocationId: "boarding-house",
    });
    expect(
      objective?.outcomes
        .slice(1)
        .some(
          (outcome) =>
            outcome.actionId || outcome.npcId || outcome.targetLocationId,
        ),
    ).toBe(false);
  });

  it("keeps first-afternoon route metadata stable across representative live states", () => {
    const fresh = seedStreetGame("objective-first-afternoon-route-fresh");
    const afterMara = seedStreetGame("objective-first-afternoon-route-mara");
    const afterPlan = seedStreetGame("objective-first-afternoon-route-plan");
    const afterAda = seedStreetGame("objective-first-afternoon-route-ada");
    const afterAccepted = seedStreetGame(
      "objective-first-afternoon-route-accepted",
    );
    const afterStarted = seedStreetGame(
      "objective-first-afternoon-route-started",
    );
    const afterPaid = seedStreetGame("objective-first-afternoon-route-paid");
    const afterStock = seedStreetGame("objective-first-afternoon-route-stock");

    addConversationWith(afterMara, "npc-mara");

    for (const world of [
      afterPlan,
      afterAda,
      afterAccepted,
      afterStarted,
      afterPaid,
      afterStock,
    ]) {
      addConversationWith(world, "npc-mara");
      world.firstAfternoon = {
        ...world.firstAfternoon,
        planSettledAt: world.currentTime,
      };
    }

    for (const world of [
      afterAda,
      afterAccepted,
      afterStarted,
      afterPaid,
      afterStock,
    ]) {
      addConversationWith(world, "npc-ada");
      setFirstAfternoonLeadFieldNote(world);
      const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
      if (teaJob) {
        teaJob.discovered = true;
      }
    }

    for (const world of [afterAccepted, afterStarted, afterPaid, afterStock]) {
      const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
      if (teaJob) {
        teaJob.accepted = true;
      }
    }

    afterStarted.player.activeJobId = "job-tea-shift";
    afterStarted.firstAfternoon = {
      ...afterStarted.firstAfternoon,
      teaShiftStage: "rush",
    };

    for (const world of [afterPaid, afterStock]) {
      const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
      if (teaJob) {
        teaJob.completed = true;
      }
      world.firstAfternoon = {
        ...world.firstAfternoon,
        teaShiftStage: "paid",
      };
    }
    afterPaid.player.currentLocationId = "tea-house";
    afterStock.player.currentLocationId = afterStock.player.homeLocationId;
    afterStock.firstAfternoon = {
      ...afterStock.firstAfternoon,
      completedAt: afterStock.currentTime,
      fieldNote: {
        createdAt: afterStock.currentTime,
        evidence: "Ada paid Rowan after the Kettle & Lamp shift.",
        learned: "Tonight's room holds.",
        memory: "The first afternoon ended with paid work.",
        next: "Let tomorrow's lead compete with live pressure.",
      },
    };

    const objectiveByState = {
      fresh: firstAfternoonObjective(fresh),
      afterMara: firstAfternoonObjective(afterMara),
      afterPlan: firstAfternoonObjective(afterPlan),
      afterAda: firstAfternoonObjective(afterAda),
      afterAccepted: firstAfternoonObjective(afterAccepted),
      afterStarted: firstAfternoonObjective(afterStarted),
      afterPaid: firstAfternoonObjective(afterPaid),
      afterStock: firstAfternoonObjective(afterStock),
    };

    expect(
      objectiveByState.fresh?.outcomes.map(({ id, label, urgency }) => ({
        id,
        label,
        urgency,
      })),
    ).toEqual([
      {
        id: "first-afternoon-room",
        label: "Room terms understood",
        urgency: 8,
      },
      {
        id: "first-afternoon-choose-move",
        label: "Useful first move chosen",
        urgency: 7,
      },
      {
        id: "first-afternoon-ada-lead",
        label: "Ada lead verified",
        urgency: 6,
      },
      {
        id: "first-afternoon-record-lead",
        label: "Ada lead recorded as evidence",
        urgency: 5,
      },
      {
        id: "first-afternoon-take-shift",
        label: "Cup-and-counter shift accepted",
        urgency: 4,
      },
      {
        id: "first-afternoon-start-shift",
        label: "Lunch rush started",
        urgency: 3,
      },
      {
        id: "first-afternoon-finish-shift",
        label: "Shift finished and paid",
        urgency: 2,
      },
      {
        id: "first-afternoon-take-stock",
        label: "First afternoon taken stock",
        urgency: 1,
      },
    ]);
    expect(
      objectiveByState.fresh?.trail.map(({ id, title }) => ({ id, title })),
    ).toEqual([
      {
        id: "first-afternoon-room",
        title: "Ask Mara how to keep tonight's room.",
      },
      {
        id: "first-afternoon-choose-move",
        title: "Choose the first useful move.",
      },
      {
        id: "first-afternoon-ada-lead",
        title: "Ask Ada if Kettle & Lamp needs help today.",
      },
      {
        id: "first-afternoon-record-lead",
        title: "Record what Ada confirmed.",
      },
      {
        id: "first-afternoon-take-shift",
        title: "Take the cup-and-counter shift.",
      },
      {
        id: "first-afternoon-start-shift",
        title: "Get through the lunch rush.",
      },
      {
        id: "first-afternoon-finish-shift",
        title: "Finish the shift and get paid.",
      },
      {
        id: "first-afternoon-take-stock",
        title: "Head back to Morrow House and take stock.",
      },
    ]);

    expect(objectiveByState.afterMara?.outcomes[1]).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objectiveByState.afterMara?.trail[1]).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      detail:
        "Rowan could wander, rest, or ask Ada. Ada is the useful first bet.",
      progress: "Weigh the options",
      targetLocationId: "boarding-house",
    });

    expect(objectiveByState.afterPlan?.outcomes[2]).toMatchObject({
      npcId: "npc-ada",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.afterPlan?.trail[1]).toMatchObject({
      detail: "Rowan chose Ada over drifting or resting.",
      done: true,
      progress: "Ada chosen",
    });

    expect(objectiveByState.afterAda?.outcomes[4]).toMatchObject({
      actionId: "accept:job-tea-shift",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.afterAda?.trail[3]).toMatchObject({
      detail: "Rowan turned Mara's lead into a field note with evidence.",
      done: true,
      progress: "Lead grounded",
    });

    expect(objectiveByState.afterAccepted?.outcomes[5]).toMatchObject({
      actionId: "work:job-tea-shift",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.afterStarted?.outcomes[6]).toMatchObject({
      actionId: "work:job-tea-shift",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.afterStarted?.trail[5]).toMatchObject({
      detail: "Rowan has started keeping the room moving.",
      done: true,
      progress: "Rush handled",
    });

    expect(objectiveByState.afterPaid?.outcomes[7]).toMatchObject({
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objectiveByState.afterPaid?.trail[7]).toMatchObject({
      detail: "Go back to Morrow House before ending the first afternoon.",
      progress: "Head home",
      targetLocationId: "boarding-house",
    });

    expect(objectiveByState.afterStock?.progress).toMatchObject({
      completed: 8,
      total: 8,
    });
    expect(
      objectiveByState.afterStock?.outcomes.every(
        (outcome) => outcome.status === "met",
      ),
    ).toBe(true);
    expect(objectiveByState.afterStock?.trail[7]).toMatchObject({
      detail:
        "Tonight's bed still holds, $14 is in Rowan's pocket, Ada has seen him keep up, and tomorrow has a real lead.",
      done: true,
      progress: "First afternoon complete",
      targetLocationId: "boarding-house",
    });
  });

  it("exposes Mara's Ada lead as predicate authority, not trail authority", () => {
    const world = seedStreetGame("objective-mara-ada-predicates");

    const objective = maraAdaLeadObjective(world);

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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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

  it("keeps Mara's Ada lead route metadata stable across representative live states", () => {
    const freshManual = seedStreetGame("objective-mara-ada-route-fresh");
    const afterMara = seedStreetGame("objective-mara-ada-route-mara");
    const afterPlan = seedStreetGame("objective-mara-ada-route-plan");
    const afterReached = seedStreetGame("objective-mara-ada-route-reached");
    const afterRecorded = seedStreetGame("objective-mara-ada-route-recorded");
    const afterChoice = seedStreetGame("objective-mara-ada-route-choice");

    for (const world of [
      afterMara,
      afterPlan,
      afterReached,
      afterRecorded,
      afterChoice,
    ]) {
      addConversationWith(world, "npc-mara");
    }

    for (const world of [afterPlan, afterReached, afterRecorded, afterChoice]) {
      world.firstAfternoon = {
        ...world.firstAfternoon,
        planSettledAt: world.currentTime,
      };
    }

    for (const world of [afterReached, afterRecorded, afterChoice]) {
      world.player.currentLocationId = "tea-house";
    }

    for (const world of [afterRecorded, afterChoice]) {
      addConversationWith(world, "npc-ada");
      setFirstAfternoonLeadFieldNote(world);
    }

    const choiceJob = afterChoice.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (choiceJob) {
      choiceJob.discovered = true;
    }

    const objectiveByState = {
      freshManual: maraAdaLeadObjective(freshManual),
      afterMara: maraAdaLeadObjective(afterMara, "seed"),
      afterPlan: maraAdaLeadObjective(afterPlan, "seed"),
      afterReached: maraAdaLeadObjective(afterReached, "seed"),
      afterRecorded: maraAdaLeadObjective(afterRecorded, "seed"),
      afterChoice: maraAdaLeadObjective(afterChoice, "seed"),
    };

    expect(
      objectiveByState.freshManual?.outcomes.map(({ id, label, urgency }) => ({
        id,
        label,
        urgency,
      })),
    ).toEqual([
      {
        id: "mara-ada-hear-lead",
        label: "Mara's lead heard",
        urgency: 6,
      },
      {
        id: "mara-ada-form-intent",
        label: "Ada verification intent formed",
        urgency: 5,
      },
      {
        id: "mara-ada-walk-route",
        label: "Kettle & Lamp reached",
        urgency: 4,
      },
      {
        id: "mara-ada-ask-directly",
        label: "Ada lead verified directly",
        urgency: 3,
      },
      {
        id: "mara-ada-record-evidence",
        label: "Ada lead recorded as evidence",
        urgency: 2,
      },
      {
        id: "mara-ada-open-choice",
        label: "Lead opened a real choice",
        urgency: 1,
      },
    ]);
    expect(
      objectiveByState.freshManual?.trail.map(({ id, title }) => ({
        id,
        title,
      })),
    ).toEqual([
      {
        id: "mara-ada-hear-lead",
        title: "Hear Mara's Kettle & Lamp lead.",
      },
      {
        id: "mara-ada-form-intent",
        title: "Form the plan to verify it directly.",
      },
      {
        id: "mara-ada-walk-route",
        title: "Walk to Kettle & Lamp.",
      },
      {
        id: "mara-ada-ask-directly",
        title: "Ask Ada about lunch work.",
      },
      {
        id: "mara-ada-record-evidence",
        title: "Record what Rowan learned.",
      },
      {
        id: "mara-ada-open-choice",
        title: "Open the next choice from that knowledge.",
      },
    ]);

    expect(objectiveByState.freshManual?.progress).toMatchObject({
      completed: 1,
      total: 6,
    });
    expect(objectiveByState.freshManual?.outcomes[0]).toMatchObject({
      npcId: "npc-mara",
      status: "open",
      targetLocationId: "boarding-house",
    });
    expect(objectiveByState.freshManual?.trail[1]).toMatchObject({
      detail:
        "Rowan chose to ask Ada rather than wander, rest, or wait for work to find him.",
      done: true,
      progress: "Intent clear",
    });

    expect(objectiveByState.afterMara?.outcomes[0]).toMatchObject({
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.afterMara?.trail[1]).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      detail:
        "Make the plan explicit: walk to Kettle & Lamp and ask Ada about lunch work.",
      done: false,
      progress: "Choose the useful move",
      targetLocationId: "boarding-house",
    });

    expect(objectiveByState.afterPlan?.trail[1]).toMatchObject({
      detail:
        "Rowan chose to ask Ada rather than wander, rest, or wait for work to find him.",
      done: true,
      progress: "Intent clear",
    });
    expect(objectiveByState.afterPlan?.outcomes[2]).toMatchObject({
      status: "open",
      targetLocationId: "tea-house",
    });

    expect(objectiveByState.afterReached?.outcomes[2]).toMatchObject({
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.afterReached?.trail[2]).toMatchObject({
      done: true,
      progress: "At Kettle & Lamp",
    });

    expect(objectiveByState.afterRecorded?.outcomes[4]).toMatchObject({
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.afterRecorded?.trail[4]).toMatchObject({
      detail:
        "Rowan has a field note tying the claim to Ada, Kettle & Lamp, and the time.",
      done: true,
      progress: "Field note made",
    });
    expect(objectiveByState.afterRecorded?.outcomes[5]).toMatchObject({
      status: "blocked",
      targetLocationId: "tea-house",
    });

    expect(objectiveByState.afterChoice?.progress).toMatchObject({
      completed: 6,
      total: 6,
    });
    expect(objectiveByState.afterChoice?.outcomes[5]).toMatchObject({
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.afterChoice?.trail[5]).toMatchObject({
      detail:
        "The offer is now actionable: take the shift, check another lead, return later, or keep exploring.",
      done: true,
      progress: "Choice unlocked",
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
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
    expect(
      objective?.outcomes.every((outcome) => outcome.status === "met"),
    ).toBe(true);
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

  it("closes pump objectives when the world resolves the pump without Rowan", () => {
    const world = seedStreetGame("objective-pump-world-resolved");
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
    if (pump) {
      pump.discovered = true;
      pump.resolvedAt = world.currentTime;
      pump.resolvedByNpcId = "npc-mara";
      pump.status = "resolved";
    }

    const objective = buildPlayerObjectiveState(world, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });

    expect(objective).toMatchObject({
      progress: {
        completed: 3,
        total: 3,
      },
    });
    expect(objective?.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: undefined,
          id: "pump-discovered",
          status: "met",
        }),
        expect.objectContaining({
          actionId: undefined,
          evidence: "The pump was already contained by the house.",
          id: "wrench-in-inventory",
          status: "met",
        }),
        expect.objectContaining({
          actionId: undefined,
          evidence: "resolved",
          id: "pump-solved",
          status: "met",
        }),
      ]),
    );
    expect(
      objective?.trail.flatMap((step) => step.actionId ?? []),
    ).not.toContain("buy:item-wrench");
    expect(
      objective?.trail.flatMap((step) => step.actionId ?? []),
    ).not.toContain("solve:problem-pump");
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
    expect(
      objective?.outcomes.every((outcome) => outcome.status === "met"),
    ).toBe(true);
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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

  it("marks discovered closing job windows as at-risk work predicates", () => {
    const world = seedStreetGame("objective-work-window-pressure");
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.discovered = true;
    }
    world.clock.totalMinutes = 16 * 60 + 30;
    world.clock.hour = 16;
    world.clock.minute = 30;
    world.clock.label = "Afternoon";

    const objective = buildPlayerObjectiveState(world, {
      focus: "work",
      source: "manual",
      text: "Take the freight yard lift before the window closes.",
    });

    expect(objective).toMatchObject({
      routeKey: "work-yard",
    });
    expect(objective?.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "accept:job-yard-shift",
          blockers: expect.arrayContaining(["Freight yard lift closes soon."]),
          evidence: "Freight yard lift window closes around 5pm.",
          id: "work-commit",
          status: "at_risk",
          targetLocationId: "freight-yard",
          urgency: 7,
        }),
      ]),
    );
  });

  it("keeps work route metadata stable across representative live states", () => {
    const routeCases = [
      {
        id: "objective-work-route-tea-undiscovered",
        text: "Earn money at Kettle & Lamp.",
        setup: (world: StreetGameState) => {
          const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
          if (teaJob) {
            teaJob.discovered = false;
            teaJob.accepted = false;
            teaJob.completed = false;
          }
        },
        expected: {
          routeKey: "work-tea",
          progress: { completed: 0, total: 4 },
          outcomes: [
            [
              "work-lead-tea",
              "Tea-house work lead confirmed",
              4,
              "blocked",
              undefined,
            ],
            ["work-commit", "Paid work committed", 3, "blocked", undefined],
            ["work-finish", "Paid work finished", 2, "blocked", undefined],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-tea",
              "Get a real work lead from Ada at Kettle & Lamp.",
              "The tea room only counts as a lead once Ada makes the offer real.",
              "Still asking",
              undefined,
              false,
            ],
            [
              "work-commit",
              "Take the cup-and-counter shift at Kettle & Lamp.",
              "Ada likes speed more than speeches.",
              "Still asking",
              undefined,
              false,
            ],
            [
              "work-finish",
              "Finish the tea-house shift cleanly.",
              "Finishing the rush matters more than saying yes to it.",
              "Still ahead",
              "work:job-tea-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-tea-discovered",
        text: "Earn money at Kettle & Lamp.",
        setup: (world: StreetGameState) => {
          const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
          if (teaJob) {
            teaJob.discovered = true;
            teaJob.accepted = false;
            teaJob.completed = false;
          }
        },
        expected: {
          routeKey: "work-tea",
          progress: { completed: 0, total: 4 },
          outcomes: [
            [
              "work-lead-tea",
              "Tea-house work lead confirmed",
              4,
              "blocked",
              undefined,
            ],
            [
              "work-commit",
              "Paid work committed",
              3,
              "blocked",
              "accept:job-tea-shift",
            ],
            ["work-finish", "Paid work finished", 2, "blocked", undefined],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-tea",
              "Get a real work lead from Ada at Kettle & Lamp.",
              "The tea room only counts as a lead once Ada makes the offer real.",
              "Heard about it",
              undefined,
              false,
            ],
            [
              "work-commit",
              "Take the cup-and-counter shift at Kettle & Lamp.",
              "Ada likes speed more than speeches.",
              "Lead waiting",
              "accept:job-tea-shift",
              false,
            ],
            [
              "work-finish",
              "Finish the tea-house shift cleanly.",
              "Finishing the rush matters more than saying yes to it.",
              "Still ahead",
              "work:job-tea-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-tea-accepted",
        text: "Earn money at Kettle & Lamp.",
        setup: (world: StreetGameState) => {
          const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
          if (teaJob) {
            teaJob.discovered = true;
            teaJob.accepted = true;
            teaJob.completed = false;
          }
        },
        expected: {
          routeKey: "work-tea",
          progress: { completed: 2, total: 4 },
          outcomes: [
            [
              "work-lead-tea",
              "Tea-house work lead confirmed",
              4,
              "met",
              undefined,
            ],
            [
              "work-commit",
              "Paid work committed",
              3,
              "met",
              "work:job-tea-shift",
            ],
            [
              "work-finish",
              "Paid work finished",
              2,
              "blocked",
              "work:job-tea-shift",
            ],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-tea",
              "Get a real work lead from Ada at Kettle & Lamp.",
              "The tea room only counts as a lead once Ada makes the offer real.",
              "Lead confirmed",
              undefined,
              true,
            ],
            [
              "work-commit",
              "Take the cup-and-counter shift at Kettle & Lamp.",
              "Ada likes speed more than speeches.",
              "Committed",
              "work:job-tea-shift",
              true,
            ],
            [
              "work-finish",
              "Finish the tea-house shift cleanly.",
              "Finishing the rush matters more than saying yes to it.",
              "Still ahead",
              "work:job-tea-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-tea-completed",
        text: "Earn money at Kettle & Lamp.",
        setup: (world: StreetGameState) => {
          const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
          if (teaJob) {
            teaJob.discovered = true;
            teaJob.accepted = true;
            teaJob.completed = true;
          }
          world.player.money = 26;
        },
        expected: {
          routeKey: "work-tea",
          progress: { completed: 4, total: 4 },
          outcomes: [
            [
              "work-lead-tea",
              "Tea-house work lead confirmed",
              4,
              "met",
              undefined,
            ],
            ["work-commit", "Paid work committed", 3, "met", undefined],
            ["work-finish", "Paid work finished", 2, "met", undefined],
            ["work-pay", "Pay turned into breathing room", 1, "met", undefined],
          ],
          trail: [
            [
              "work-lead-tea",
              "Get a real work lead from Ada at Kettle & Lamp.",
              "The tea room only counts as a lead once Ada makes the offer real.",
              "Lead confirmed",
              undefined,
              true,
            ],
            [
              "work-commit",
              "Take the cup-and-counter shift at Kettle & Lamp.",
              "Ada likes speed more than speeches.",
              "Committed",
              undefined,
              true,
            ],
            [
              "work-finish",
              "Finish the tea-house shift cleanly.",
              "Finishing the rush matters more than saying yes to it.",
              "Finished",
              undefined,
              true,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "The day is starting to look more like footing than scrambling.",
              "$26 on hand",
              undefined,
              true,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-yard-undiscovered",
        text: "Verify Tomas's yard opening from current world state.",
        setup: (world: StreetGameState) => {
          const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
          if (yardJob) {
            yardJob.discovered = false;
            yardJob.accepted = false;
            yardJob.completed = false;
          }
        },
        expected: {
          routeKey: "work-yard",
          progress: { completed: 0, total: 4 },
          outcomes: [
            [
              "work-lead-yard",
              "Yard work lead confirmed",
              4,
              "blocked",
              undefined,
            ],
            ["work-commit", "Paid work committed", 3, "blocked", undefined],
            ["work-finish", "Paid work finished", 2, "blocked", undefined],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-yard",
              "Get a real work lead from Tomas at North Crane Yard.",
              "The yard only counts as a lead once Tomas puts actual work on the table.",
              "Still asking",
              undefined,
              false,
            ],
            [
              "work-commit",
              "Take the freight-yard lift before the window closes.",
              "The yard only stays open for work if Rowan moves in time.",
              "Still asking",
              undefined,
              false,
            ],
            [
              "work-finish",
              "Finish the yard lift cleanly.",
              "Following through matters as much as taking the lift.",
              "Still ahead",
              "work:job-yard-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-yard-at-risk",
        text: "Verify Tomas's yard opening from current world state.",
        setup: (world: StreetGameState) => {
          const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
          if (yardJob) {
            yardJob.discovered = true;
            yardJob.accepted = false;
            yardJob.completed = false;
          }
          world.clock.totalMinutes = 16 * 60 + 30;
          world.clock.hour = 16;
          world.clock.minute = 30;
          world.clock.label = "Afternoon";
        },
        expected: {
          routeKey: "work-yard",
          progress: { completed: 0, total: 4 },
          outcomes: [
            [
              "work-lead-yard",
              "Yard work lead confirmed",
              4,
              "blocked",
              undefined,
            ],
            [
              "work-commit",
              "Paid work committed",
              7,
              "at_risk",
              "accept:job-yard-shift",
            ],
            ["work-finish", "Paid work finished", 6, "at_risk", undefined],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-yard",
              "Get a real work lead from Tomas at North Crane Yard.",
              "The yard only counts as a lead once Tomas puts actual work on the table.",
              "Heard about it",
              undefined,
              false,
            ],
            [
              "work-commit",
              "Take the freight-yard lift before the window closes.",
              "The yard only stays open for work if Rowan moves in time.",
              "Lead waiting",
              "accept:job-yard-shift",
              false,
            ],
            [
              "work-finish",
              "Finish the yard lift cleanly.",
              "Following through matters as much as taking the lift.",
              "Still ahead",
              "work:job-yard-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-yard-accepted",
        text: "Verify Tomas's yard opening from current world state.",
        setup: (world: StreetGameState) => {
          const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
          if (yardJob) {
            yardJob.discovered = true;
            yardJob.accepted = true;
            yardJob.completed = false;
          }
          world.clock.totalMinutes = 15 * 60;
          world.clock.hour = 15;
          world.clock.minute = 0;
          world.clock.label = "Afternoon";
        },
        expected: {
          routeKey: "work-yard",
          progress: { completed: 2, total: 4 },
          outcomes: [
            ["work-lead-yard", "Yard work lead confirmed", 4, "met", undefined],
            [
              "work-commit",
              "Paid work committed",
              3,
              "met",
              "work:job-yard-shift",
            ],
            [
              "work-finish",
              "Paid work finished",
              2,
              "blocked",
              "work:job-yard-shift",
            ],
            [
              "work-pay",
              "Pay turned into breathing room",
              1,
              "blocked",
              undefined,
            ],
          ],
          trail: [
            [
              "work-lead-yard",
              "Get a real work lead from Tomas at North Crane Yard.",
              "The yard only counts as a lead once Tomas puts actual work on the table.",
              "Lead confirmed",
              undefined,
              true,
            ],
            [
              "work-commit",
              "Take the freight-yard lift before the window closes.",
              "The yard only stays open for work if Rowan moves in time.",
              "Committed",
              "work:job-yard-shift",
              true,
            ],
            [
              "work-finish",
              "Finish the yard lift cleanly.",
              "Following through matters as much as taking the lift.",
              "Still ahead",
              "work:job-yard-shift",
              false,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "Work only matters if it buys more than the next hour.",
              "$12 on hand",
              undefined,
              false,
            ],
          ],
        },
      },
      {
        id: "objective-work-route-yard-paid",
        text: "Verify Tomas's yard opening from current world state.",
        setup: (world: StreetGameState) => {
          const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
          if (yardJob) {
            yardJob.discovered = true;
            yardJob.accepted = true;
            yardJob.completed = true;
          }
          world.player.money = 30;
        },
        expected: {
          routeKey: "work-yard",
          progress: { completed: 4, total: 4 },
          outcomes: [
            ["work-lead-yard", "Yard work lead confirmed", 4, "met", undefined],
            ["work-commit", "Paid work committed", 3, "met", undefined],
            ["work-finish", "Paid work finished", 2, "met", undefined],
            ["work-pay", "Pay turned into breathing room", 1, "met", undefined],
          ],
          trail: [
            [
              "work-lead-yard",
              "Get a real work lead from Tomas at North Crane Yard.",
              "The yard only counts as a lead once Tomas puts actual work on the table.",
              "Lead confirmed",
              undefined,
              true,
            ],
            [
              "work-commit",
              "Take the freight-yard lift before the window closes.",
              "The yard only stays open for work if Rowan moves in time.",
              "Committed",
              undefined,
              true,
            ],
            [
              "work-finish",
              "Finish the yard lift cleanly.",
              "Following through matters as much as taking the lift.",
              "Finished",
              undefined,
              true,
            ],
            [
              "work-pay",
              "Turn the pay into breathing room.",
              "The day is starting to look more like footing than scrambling.",
              "$30 on hand",
              undefined,
              true,
            ],
          ],
        },
      },
    ] as const;

    for (const routeCase of routeCases) {
      const world = seedStreetGame(routeCase.id);
      routeCase.setup(world);

      const objective = buildPlayerObjectiveState(world, {
        focus: "work",
        source: "manual",
        text: routeCase.text,
      });

      expect(objective, routeCase.id).toMatchObject({
        routeKey: routeCase.expected.routeKey,
        progress: routeCase.expected.progress,
      });
      expect(
        objective?.outcomes.map(({ actionId, id, label, status, urgency }) => [
          id,
          label,
          urgency,
          status,
          actionId,
        ]),
        routeCase.id,
      ).toEqual(routeCase.expected.outcomes);
      expect(
        objective?.trail.map(
          ({ actionId, detail, done, id, progress, title }) => [
            id,
            title,
            detail,
            progress,
            actionId,
            done,
          ],
        ),
        routeCase.id,
      ).toEqual(routeCase.expected.trail);
    }
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
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
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
    ).toBe(true);
    expect(
      objective?.outcomes.every((outcome) => outcome.status === "met"),
    ).toBe(true);
    expect(objective?.outcomes.map((outcome) => outcome.id)).not.toContain(
      "stale-tool-step",
    );
  });
});
