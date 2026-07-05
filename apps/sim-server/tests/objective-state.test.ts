import { readFileSync } from "node:fs";
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

function addNpcReplyWith(world: StreetGameState, npcId: string, text: string) {
  world.conversations.push({
    id: `conversation-${world.id}-${npcId}-${world.conversations.length}`,
    locationId: world.player.currentLocationId,
    npcId,
    speaker: "npc",
    speakerName: npcId,
    text,
    threadId: `thread-${world.id}-${npcId}`,
    time: world.currentTime,
  });
}

function addConversationObjective(
  world: StreetGameState,
  npcId: string,
  objectiveText: string,
) {
  const threadId = `thread-${world.id}-${npcId}-objective`;
  const line = {
    id: `conversation-${world.id}-${npcId}-objective`,
    locationId: world.player.currentLocationId,
    npcId,
    speaker: "npc" as const,
    speakerName: npcId,
    text: objectiveText,
    threadId,
    time: world.currentTime,
  };
  world.conversationThreads[npcId] = {
    id: threadId,
    lines: [line],
    locationId: world.player.currentLocationId,
    npcId,
    objectiveText,
    updatedAt: world.currentTime,
  };
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

function setProblemState(
  world: StreetGameState,
  problemId: string,
  patch: Partial<StreetGameState["problems"][number]>,
) {
  const problem = world.problems.find((entry) => entry.id === problemId);
  if (!problem) {
    throw new Error(`Missing problem ${problemId}`);
  }
  Object.assign(problem, patch);
  return problem;
}

function addWrench(world: StreetGameState) {
  world.player.inventory.push({
    id: "item-wrench",
    name: "Old wrench",
    description: "A tool for the pump.",
  });
}

function objectiveOutcome(objective: PlayerObjective | undefined, id: string) {
  const outcome = objective?.outcomes.find((entry) => entry.id === id);
  expect(outcome).toBeDefined();
  return outcome!;
}

function setClock(world: StreetGameState, hour: number, minute = 0) {
  world.clock.hour = hour;
  world.clock.minute = minute;
  world.clock.totalMinutes = hour * 60 + minute;
  world.clock.label = hour >= 12 ? "Afternoon" : "Late morning";
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

function settleObjective(
  world: StreetGameState,
  text = "Find out what it takes to keep my room at Morrow House tonight.",
) {
  return buildPlayerObjectiveState(world, {
    focus: "settle",
    source: "manual",
    text,
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

  it("keeps objective-state outcome authority off trail-step fallback code", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );

    expect(objectiveStateSource).not.toContain(
      "objectiveOutcomeDefinitionFromTrailStep",
    );
    expect(objectiveStateSource).not.toContain('authority: "trail"');
    expect(objectiveStateSource).not.toContain(
      'authority: hasExplicitOutcomes ? "predicate" : "trail"',
    );
  });

  it("keeps shared objective outcome authority public types predicate-only", () => {
    const simTypesSource = readFileSync(
      new URL("../src/street-sim/types.ts", import.meta.url),
      "utf8",
    );
    const webTypesSource = readFileSync(
      new URL(
        "../../many-lives-web/src/lib/street/types.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(simTypesSource).toContain(
      'export type ObjectiveOutcomeAuthority = "predicate";',
    );
    expect(webTypesSource).toContain(
      'export type ObjectiveOutcomeAuthority = "predicate";',
    );
    expect(simTypesSource).not.toContain(
      'export type ObjectiveOutcomeAuthority = "predicate" | "trail";',
    );
    expect(webTypesSource).not.toContain(
      'export type ObjectiveOutcomeAuthority = "predicate" | "trail";',
    );
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
        label: "Ask Ada directly",
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

  it("preserves first-afternoon shift and take-stock predicate evidence and failures", () => {
    const setupLeadAndTeaJob = (world: StreetGameState) => {
      addConversationWith(world, "npc-mara");
      addConversationWith(world, "npc-ada");
      setFirstAfternoonLeadFieldNote(world);
      world.firstAfternoon = {
        ...world.firstAfternoon,
        planSettledAt: world.currentTime,
      };
      const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
      if (!teaJob) {
        throw new Error("Missing tea shift job");
      }
      teaJob.discovered = true;
      return teaJob;
    };

    const accepted = seedStreetGame(
      "objective-first-afternoon-shift-accepted",
    );
    const acceptedTeaJob = setupLeadAndTeaJob(accepted);
    acceptedTeaJob.accepted = true;
    const acceptedObjective = firstAfternoonObjective(accepted);
    expect(
      objectiveOutcome(acceptedObjective, "first-afternoon-take-shift"),
    ).toMatchObject({
      evidence: "Shift accepted.",
      status: "met",
    });
    expect(
      objectiveOutcome(acceptedObjective, "first-afternoon-start-shift"),
    ).toMatchObject({
      blockers: ["The lunch rush has not started for Rowan yet."],
      status: "blocked",
    });

    const started = seedStreetGame("objective-first-afternoon-shift-started");
    const startedTeaJob = setupLeadAndTeaJob(started);
    startedTeaJob.accepted = true;
    started.player.activeJobId = "job-tea-shift";
    started.firstAfternoon = {
      ...started.firstAfternoon,
      teaShiftStage: "rush",
    };
    const startedObjective = firstAfternoonObjective(started);
    expect(
      objectiveOutcome(startedObjective, "first-afternoon-start-shift"),
    ).toMatchObject({
      evidence: "rush",
      status: "met",
    });

    const completed = seedStreetGame(
      "objective-first-afternoon-shift-completed",
    );
    const completedTeaJob = setupLeadAndTeaJob(completed);
    completedTeaJob.completed = true;
    completed.player.currentLocationId = "tea-house";
    completed.firstAfternoon = {
      ...completed.firstAfternoon,
      teaShiftStage: "paid",
    };
    const completedObjective = firstAfternoonObjective(completed);
    expect(
      objectiveOutcome(completedObjective, "first-afternoon-finish-shift"),
    ).toMatchObject({
      evidence: "Ada paid Rowan for the shift.",
      status: "met",
    });
    expect(
      objectiveOutcome(completedObjective, "first-afternoon-take-stock"),
    ).toMatchObject({
      blockers: ["Rowan is not back at Morrow House yet."],
      status: "blocked",
    });

    completed.player.currentLocationId = completed.player.homeLocationId;
    const homeObjective = firstAfternoonObjective(completed);
    expect(
      objectiveOutcome(homeObjective, "first-afternoon-take-stock"),
    ).toMatchObject({
      blockers: ["Rowan has not taken stock yet."],
      status: "blocked",
    });

    completed.firstAfternoon = {
      ...completed.firstAfternoon,
      completedAt: completed.currentTime,
      fieldNote: {
        createdAt: completed.currentTime,
        evidence: "Ada paid Rowan after the Kettle & Lamp shift.",
        learned: "Tonight's room holds.",
        memory: "The first afternoon ended with paid work.",
        next: "Let tomorrow's lead compete with live pressure.",
      },
    };
    const stockObjective = firstAfternoonObjective(completed);
    expect(
      objectiveOutcome(stockObjective, "first-afternoon-take-stock"),
    ).toMatchObject({
      evidence: "Ada paid Rowan after the Kettle & Lamp shift.",
      status: "met",
    });

    const missed = seedStreetGame("objective-first-afternoon-shift-missed");
    const missedTeaJob = setupLeadAndTeaJob(missed);
    missedTeaJob.missed = true;
    const missedObjective = firstAfternoonObjective(missed);
    expect(
      objectiveOutcome(missedObjective, "first-afternoon-take-shift"),
    ).toMatchObject({
      blockers: ["The cup-and-counter shift window has slipped."],
      status: "failed",
    });
    expect(
      objectiveOutcome(missedObjective, "first-afternoon-finish-shift"),
    ).toMatchObject({
      blockers: ["The cup-and-counter shift was missed."],
      status: "failed",
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
        label: "Ask Ada directly",
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

  it("preserves Mara/Ada lead predicate sources and work-choice gating", () => {
    const heardCases = [
      {
        name: "conversation",
        setup: (world: StreetGameState) => addConversationWith(world, "npc-mara"),
      },
      {
        name: "plan",
        setup: (world: StreetGameState) => {
          world.firstAfternoon = {
            ...world.firstAfternoon,
            planSettledAt: world.currentTime,
          };
        },
      },
      {
        name: "field-note",
        setup: setFirstAfternoonLeadFieldNote,
      },
    ];

    for (const testCase of heardCases) {
      const world = seedStreetGame(`objective-mara-ada-heard-${testCase.name}`);
      testCase.setup(world);
      expect(
        objectiveOutcome(
          maraAdaLeadObjective(world),
          "mara-ada-hear-lead",
        ),
      ).toMatchObject({
        evidence:
          "Mara has explained what tonight's room and first lead require.",
        status: "met",
      });
    }

    const reachedByLocation = seedStreetGame(
      "objective-mara-ada-reached-location",
    );
    reachedByLocation.player.currentLocationId = "tea-house";
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(reachedByLocation),
        "mara-ada-walk-route",
      ),
    ).toMatchObject({
      evidence: "tea-house",
      status: "met",
    });

    const reachedByAda = seedStreetGame("objective-mara-ada-reached-ada");
    addConversationWith(reachedByAda, "npc-ada");
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(reachedByAda),
        "mara-ada-walk-route",
      ),
    ).toMatchObject({
      status: "met",
    });
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(reachedByAda),
        "mara-ada-ask-directly",
      ),
    ).toMatchObject({
      status: "met",
    });

    const verifiedByAcceptedJob = seedStreetGame(
      "objective-mara-ada-verified-accepted-job",
    );
    const acceptedTeaJob = verifiedByAcceptedJob.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (!acceptedTeaJob) {
      throw new Error("Missing tea shift job");
    }
    acceptedTeaJob.accepted = true;
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(verifiedByAcceptedJob),
        "mara-ada-ask-directly",
      ),
    ).toMatchObject({
      status: "met",
    });

    const verifiedByCompletedJob = seedStreetGame(
      "objective-mara-ada-verified-completed-job",
    );
    const completedTeaJob = verifiedByCompletedJob.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (!completedTeaJob) {
      throw new Error("Missing tea shift job");
    }
    completedTeaJob.completed = true;
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(verifiedByCompletedJob),
        "mara-ada-ask-directly",
      ),
    ).toMatchObject({
      status: "met",
    });

    const noteOnly = seedStreetGame("objective-mara-ada-choice-note-only");
    setFirstAfternoonLeadFieldNote(noteOnly);
    expect(
      objectiveOutcome(maraAdaLeadObjective(noteOnly), "mara-ada-open-choice"),
    ).toMatchObject({
      blockers: ["The lead has not opened a legal work choice yet."],
      status: "blocked",
    });

    const choiceOpen = seedStreetGame("objective-mara-ada-choice-open");
    setFirstAfternoonLeadFieldNote(choiceOpen);
    const choiceTeaJob = choiceOpen.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (!choiceTeaJob) {
      throw new Error("Missing tea shift job");
    }
    choiceTeaJob.discovered = true;
    expect(
      objectiveOutcome(maraAdaLeadObjective(choiceOpen), "mara-ada-open-choice"),
    ).toMatchObject({
      evidence: "Cup-and-counter shift is available.",
      status: "met",
    });

    const closedChoice = seedStreetGame("objective-mara-ada-choice-closed");
    setFirstAfternoonLeadFieldNote(closedChoice);
    const closedChoiceTeaJob = closedChoice.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (!closedChoiceTeaJob) {
      throw new Error("Missing tea shift job");
    }
    closedChoiceTeaJob.discovered = true;
    closedChoiceTeaJob.missed = true;
    expect(
      objectiveOutcome(
        maraAdaLeadObjective(closedChoice),
        "mara-ada-open-choice",
      ),
    ).toMatchObject({
      blockers: ["The lead has not opened a legal work choice yet."],
      evidence: "Cup-and-counter shift is available.",
      status: "blocked",
    });
  });

  it("keeps first-afternoon route retention and text matching owned by scaffolds", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const helperName of [
      "shouldKeepFirstAfternoonRoute",
      "shouldKeepMaraAdaLeadRoute",
      "shouldFirstAfternoonAbsorbConversationRoute",
      "shouldMaraAdaLeadAbsorbConversationRoute",
      "isMaraAdaLeadObjectiveText",
    ]) {
      expect(objectiveStateSource).not.toContain(helperName);
    }

    for (const policySnippet of [
      "completionAcknowledgedAt",
      'normalizedIncludes(text, "first afternoon")',
      "grounded knowledge",
      "what rowan learns",
    ]) {
      expect(objectiveStateSource).not.toContain(policySnippet);
    }

    expect(scaffoldSource).toContain("objectiveStatePolicies");
    expect(scaffoldSource).toContain(
      "objectiveRouteScaffoldRetainedRouteKey",
    );
    expect(scaffoldSource).toContain(
      "objectiveRouteScaffoldAbsorbsConversationFocus",
    );
    expect(scaffoldSource).toContain(
      "objectiveRouteScaffoldRouteKeyForObjectiveText",
    );
    expect(scaffoldSource).toContain("completionAcknowledgedAt");
    expect(scaffoldSource).toContain("textMatchesMaraAdaLeadObjective");
  });

  it("retains first-afternoon through settle/work conversation routes until acknowledgement", () => {
    const cases = [
      {
        expectedReleasedRouteKey: "settle-core",
        npcId: "npc-mara",
        text: "Find out what it takes to keep my room at Morrow House tonight.",
      },
      {
        expectedReleasedRouteKey: "work-tea",
        npcId: "npc-ada",
        text: "Earn money at Kettle & Lamp before lunch.",
      },
    ];

    for (const testCase of cases) {
      const world = seedStreetGame(
        `objective-first-afternoon-retains-${testCase.expectedReleasedRouteKey}`,
      );
      const previous = firstAfternoonObjective(world);
      expect(previous?.routeKey).toBe("first-afternoon");
      world.player.objective = previous;
      addConversationObjective(world, testCase.npcId, testCase.text);

      const retained = buildPlayerObjectiveState(world, { previous });

      expect(retained).toMatchObject({
        routeKey: "first-afternoon",
        text: previous?.text,
      });

      world.firstAfternoon = {
        ...world.firstAfternoon,
        completionAcknowledgedAt: world.currentTime,
      };

      const released = buildPlayerObjectiveState(world, { previous });

      expect(released?.routeKey).toBe(testCase.expectedReleasedRouteKey);
    }
  });

  it("retains Mara's Ada lead through settle/work conversation routes", () => {
    const cases = [
      {
        npcId: "npc-mara",
        text: "Find out what it takes to keep my room at Morrow House tonight.",
      },
      {
        npcId: "npc-ada",
        text: "Earn money at Kettle & Lamp before lunch.",
      },
    ];

    for (const testCase of cases) {
      const world = seedStreetGame(
        `objective-mara-ada-retains-${testCase.npcId}`,
      );
      const previous = maraAdaLeadObjective(world, "seed");
      expect(previous?.routeKey).toBe("mara-ada-lead");
      world.player.objective = previous;
      addConversationObjective(world, testCase.npcId, testCase.text);

      const retained = buildPlayerObjectiveState(world, { previous });

      expect(retained).toMatchObject({
        routeKey: "mara-ada-lead",
        text: previous?.text,
      });
    }
  });

  it("routes explicit first-afternoon and Mara/Ada text while preserving unrelated objectives", () => {
    const firstAfternoonWorld = seedStreetGame(
      "objective-explicit-first-afternoon-text",
    );
    const firstAfternoon = buildPlayerObjectiveState(firstAfternoonWorld, {
      source: "manual",
      text: "Make Rowan's first afternoon count before the day moves on.",
    });

    expect(firstAfternoon?.routeKey).toBe("first-afternoon");

    const maraAdaWorld = seedStreetGame("objective-explicit-mara-ada-text");
    const maraAda = buildPlayerObjectiveState(maraAdaWorld, {
      source: "manual",
      text: "Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.",
    });

    expect(maraAda?.routeKey).toBe("mara-ada-lead");

    const manualSettleWorld = seedStreetGame("objective-manual-settle-text");
    const manualSettle = buildPlayerObjectiveState(manualSettleWorld, {
      source: "manual",
      text: "Find out what it takes to keep my room at Morrow House tonight.",
    });

    expect(manualSettle?.routeKey).toBe("settle-core");

    const conversationWorld = seedStreetGame("objective-unrelated-conversation");
    conversationWorld.player.knownNpcIds = Array.from(
      new Set([...conversationWorld.player.knownNpcIds, "npc-nia"]),
    );
    const conversationPeople = buildPlayerObjectiveState(conversationWorld, {
      source: "conversation",
      text: "Ask Nia where the block is about to jam before the square feels it.",
    });

    expect(conversationPeople?.routeKey).toBe("people-npc-nia");
  });

  it("exposes settle routes as room, standing, work, income, and people predicates", () => {
    const world = seedStreetGame("objective-settle-predicates");

    const objective = settleObjective(world);

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

  it("keeps settle route metadata stable across representative live states", () => {
    const fresh = seedStreetGame("objective-settle-route-fresh");
    const afterMara = seedStreetGame("objective-settle-route-after-mara");
    const termsKnown = seedStreetGame("objective-settle-route-terms-known");
    const teaSpotted = seedStreetGame("objective-settle-route-tea-spotted");
    const teaCommitted = seedStreetGame("objective-settle-route-tea-committed");
    const teaCompleted = seedStreetGame("objective-settle-route-tea-completed");
    const yardHint = seedStreetGame("objective-settle-route-yard-hint");
    const peopleUnmet = seedStreetGame("objective-settle-route-people-unmet");
    const peopleMet = seedStreetGame("objective-settle-route-people-met");

    addConversationWith(afterMara, "npc-mara");
    addNpcReplyWith(
      termsKnown,
      "npc-mara",
      "The stay is simple: help the house, keep the room clean, and come home before it gets too late.",
    );

    const teaSpottedJob = teaSpotted.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (teaSpottedJob) {
      teaSpottedJob.discovered = true;
    }

    const teaCommittedJob = teaCommitted.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (teaCommittedJob) {
      teaCommittedJob.discovered = true;
      teaCommittedJob.accepted = true;
    }

    const teaCompletedJob = teaCompleted.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    if (teaCompletedJob) {
      teaCompletedJob.discovered = true;
      teaCompletedJob.accepted = true;
      teaCompletedJob.completed = true;
    }

    for (const npc of peopleUnmet.npcs) {
      npc.trust = 0;
    }
    for (const npc of peopleMet.npcs.slice(0, 2)) {
      npc.trust = 1;
    }

    const objectiveByState = {
      fresh: settleObjective(fresh),
      afterMara: settleObjective(afterMara),
      termsKnown: settleObjective(termsKnown),
      teaSpotted: settleObjective(teaSpotted),
      teaCommitted: settleObjective(teaCommitted),
      teaCompleted: settleObjective(teaCompleted),
      yardHint: settleObjective(
        yardHint,
        "Line up yard work at North Crane Yard while getting settled.",
      ),
      peopleUnmet: settleObjective(peopleUnmet),
      peopleMet: settleObjective(peopleMet),
    };

    expect(
      objectiveByState.fresh?.outcomes.map(({ id, label, urgency }) => ({
        id,
        label,
        urgency,
      })),
    ).toEqual([
      {
        id: "settle-terms",
        label: "Room terms understood",
        urgency: 5,
      },
      {
        id: "settle-standing",
        label: "Morrow House standing built",
        urgency: 4,
      },
      {
        id: "settle-lead",
        label: "Tea-house work lead confirmed",
        urgency: 3,
      },
      {
        id: "settle-income",
        label: "Income committed or completed",
        urgency: 2,
      },
      {
        id: "settle-people",
        label: "Two local connections built",
        urgency: 1,
      },
    ]);
    expect(
      objectiveByState.fresh?.trail.map(({ detail, id, progress, title }) => [
        id,
        title,
        detail,
        progress,
      ]),
    ).toEqual([
      [
        "settle-terms",
        "Lock in my stay at Morrow House.",
        "Mara can walk Rowan through exactly what it takes to keep a room here.",
        "Talk to Mara",
      ],
      [
        "settle-standing",
        "Build standing at Morrow House so the room stays mine.",
        "Now that Rowan knows the terms, he needs to show up, help out, and make the house easier to run.",
        "Standing 1/2",
      ],
      [
        "settle-lead",
        "Line up one solid work lead at Kettle & Lamp.",
        "The tea room is a strong place to turn conversation into work.",
        "Looking",
      ],
      [
        "settle-income",
        "Turn that lead into steady pay.",
        "A lead matters once Rowan commits and follows through.",
        "Looking",
      ],
      [
        "settle-people",
        "Build two real connections.",
        "Rowan needs a few real connections to make this place feel like home.",
        "1/2 real connections",
      ],
    ]);

    expect(objectiveByState.afterMara?.trail[0]).toMatchObject({
      detail: "Mara can help, but Rowan still needs the exact room terms.",
      done: false,
      progress: "Need exact terms",
    });
    expect(objectiveByState.afterMara?.outcomes[1]).toMatchObject({
      actionId: "contribute:boarding-house",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objectiveByState.afterMara?.trail[1]).toMatchObject({
      actionId: undefined,
    });

    expect(objectiveByState.termsKnown?.outcomes[0]).toMatchObject({
      npcId: undefined,
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.termsKnown?.outcomes[1]).toMatchObject({
      actionId: "contribute:boarding-house",
      status: "blocked",
      targetLocationId: "boarding-house",
    });
    expect(objectiveByState.termsKnown?.trail[1]).toMatchObject({
      actionId: "contribute:boarding-house",
      progress: "Standing 1/2",
      targetLocationId: "boarding-house",
    });

    expect(objectiveByState.teaSpotted?.trail[2]).toMatchObject({
      progress: "Lead spotted",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.teaSpotted?.outcomes[3]).toMatchObject({
      actionId: "accept:job-tea-shift",
      status: "blocked",
      targetLocationId: "tea-house",
    });

    expect(objectiveByState.teaCommitted?.outcomes[2]).toMatchObject({
      status: "met",
    });
    expect(objectiveByState.teaCommitted?.outcomes[3]).toMatchObject({
      actionId: undefined,
      status: "met",
    });
    expect(objectiveByState.teaCommitted?.trail[3]).toMatchObject({
      actionId: "work:job-tea-shift",
      done: true,
      progress: "Ready to commit",
    });

    expect(objectiveByState.teaCompleted?.trail[3]).toMatchObject({
      actionId: undefined,
      done: true,
      progress: "Paid once",
    });

    expect(objectiveByState.yardHint?.outcomes[2]).toMatchObject({
      label: "Yard work lead confirmed",
      npcId: "npc-tomas",
      targetLocationId: "freight-yard",
    });
    expect(objectiveByState.yardHint?.trail[2]).toMatchObject({
      detail: "The yard is a reliable place to turn effort into decent pay.",
      npcId: "npc-tomas",
      targetLocationId: "freight-yard",
      title: "Line up one solid work lead at North Crane Yard.",
    });

    expect(objectiveByState.peopleUnmet?.outcomes[4]).toMatchObject({
      status: "blocked",
    });
    expect(objectiveByState.peopleUnmet?.outcomes[4].npcId).toBeDefined();
    expect(
      objectiveByState.peopleUnmet?.outcomes[4].targetLocationId,
    ).toBeDefined();
    expect(objectiveByState.peopleUnmet?.trail[4]).toMatchObject({
      done: false,
      progress: "0/2 real connections",
    });

    expect(objectiveByState.peopleMet?.outcomes[4]).toMatchObject({
      npcId: undefined,
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.peopleMet?.trail[4]).toMatchObject({
      done: true,
      progress: "2/2 real connections",
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
    expect(
      objective?.outcomes.every((outcome) => outcome.authority === "predicate"),
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

  it("refreshes non-manual work objective copy when live state moves authority to the yard", () => {
    const world = seedStreetGame("objective-work-yard-copy-refresh");
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    if (teaJob) {
      teaJob.discovered = true;
      teaJob.completed = true;
    }
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.discovered = true;
      yardJob.accepted = true;
    }
    world.player.activeJobId = "job-yard-shift";
    world.player.objective = undefined;

    const objective = buildPlayerObjectiveState(world, {
      focus: "work",
      source: "conversation",
      text: "Take the cup-and-counter shift at Kettle & Lamp.",
    });

    expect(objective).toMatchObject({
      routeKey: "work-yard",
      text: "Secure paid yard work and follow through.",
    });
    expect(objective?.text).not.toMatch(/cup-and-counter|Kettle/i);
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

  it("keeps committed-job route metadata stable across active tea-shift states", () => {
    const cases = [
      {
        name: "away-before-window",
        locationId: "boarding-house",
        hour: 11,
        completed: false,
        expectedRouteKey: "commitment-job-tea-shift",
        expectedText:
          "Follow through on accepted work before the window closes.",
        expectedProgress: { completed: 0, total: 3 },
        expectedOutcomes: [
          {
            id: "commitment-go-job-tea-shift",
            label: "Cup-and-counter shift site reached",
            urgency: 3,
            status: "blocked",
            actionId: undefined,
            targetLocationId: "tea-house",
          },
          {
            id: "commitment-window-job-tea-shift",
            label: "Cup-and-counter shift window open",
            urgency: 2,
            status: "blocked",
            actionId: undefined,
            targetLocationId: "tea-house",
          },
          {
            id: "commitment-finish-job-tea-shift",
            label: "Cup-and-counter shift finished",
            urgency: 1,
            status: "blocked",
            actionId: undefined,
            targetLocationId: "tea-house",
          },
        ],
        expectedTrail: [
          {
            id: "commitment-go-job-tea-shift",
            title:
              "Get to Kettle & Lamp for cup-and-counter shift.",
            detail:
              "A live commitment should be the first thing Rowan can actually cash in.",
            progress: "Still moving",
            actionId: undefined,
            done: false,
            targetLocationId: "tea-house",
          },
          {
            id: "commitment-window-job-tea-shift",
            title: "Be there while the shift window is still open.",
            detail: "The block only keeps a shift open for so long.",
            progress: "Waiting on the hour",
            actionId: undefined,
            done: false,
            targetLocationId: "tea-house",
          },
          {
            id: "commitment-finish-job-tea-shift",
            title: "Finish cup-and-counter shift.",
            detail: "Following through is what turns a lead into standing.",
            progress: "Still committed",
            actionId: "work:job-tea-shift",
            done: false,
            targetLocationId: "tea-house",
          },
        ],
      },
      {
        name: "at-job-in-window",
        locationId: "tea-house",
        hour: 12,
        completed: false,
        expectedRouteKey: "commitment-job-tea-shift",
        expectedText:
          "Follow through on accepted work before the window closes.",
        expectedProgress: { completed: 2, total: 3 },
        expectedOutcomes: [
          {
            id: "commitment-go-job-tea-shift",
            status: "met",
            targetLocationId: undefined,
          },
          {
            id: "commitment-window-job-tea-shift",
            status: "met",
            targetLocationId: undefined,
          },
          {
            id: "commitment-finish-job-tea-shift",
            status: "blocked",
            actionId: "work:job-tea-shift",
            targetLocationId: undefined,
          },
        ],
        expectedTrail: [
          {
            id: "commitment-go-job-tea-shift",
            progress: "On site",
            done: true,
          },
          {
            id: "commitment-window-job-tea-shift",
            progress: "Window open",
            done: true,
          },
          {
            id: "commitment-finish-job-tea-shift",
            progress: "Still committed",
            actionId: "work:job-tea-shift",
            done: false,
          },
        ],
      },
      {
        name: "completed-job-hands-off",
        locationId: "tea-house",
        hour: 13,
        completed: true,
        expectedRouteKey: expect.not.stringMatching(/^commitment-/),
      },
    ];

    for (const scenario of cases) {
      const world = seedStreetGame(`objective-commitment-${scenario.name}`);
      const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
      if (!teaJob) {
        throw new Error("Missing tea shift");
      }
      teaJob.discovered = true;
      teaJob.accepted = true;
      teaJob.completed = scenario.completed;
      world.player.activeJobId = "job-tea-shift";
      world.player.currentLocationId = scenario.locationId;
      world.player.objective = undefined;
      setClock(world, scenario.hour);

      const objective = buildPlayerObjectiveState(world);

      expect(objective?.routeKey).toEqual(scenario.expectedRouteKey);
      if (!scenario.expectedText) {
        continue;
      }
      expect(objective).toMatchObject({
        routeKey: scenario.expectedRouteKey,
        text: scenario.expectedText,
        progress: scenario.expectedProgress,
      });
      expect(objective?.outcomes).toMatchObject(scenario.expectedOutcomes);
      expect(objective?.trail).toMatchObject(scenario.expectedTrail);
    }
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

  it("keeps rest route metadata stable across away, at-home, and recovered states", () => {
    const cases = [
      {
        name: "away-low-energy",
        locationId: "tea-house",
        energy: 24,
        lastRestAt: undefined,
        expectedProgress: { completed: 0, total: 2 },
        expectedOutcomes: [
          {
            id: "rest-return",
            label: "Returned somewhere safe to rest",
            urgency: 2,
            status: "blocked",
            actionId: undefined,
            targetLocationId: "boarding-house",
          },
          {
            id: "rest-hour",
            label: "Recovered with an hour of rest",
            urgency: 1,
            status: "blocked",
            actionId: undefined,
            targetLocationId: "boarding-house",
          },
        ],
        expectedTrail: [
          {
            id: "rest-return",
            title: "Return to Morrow House to recover.",
            detail:
              "Rowan needs a safe pause before the next live opening costs him tired mistakes.",
            progress: "Away",
            actionId: undefined,
            done: false,
            targetLocationId: "boarding-house",
          },
          {
            id: "rest-hour",
            title: "Rest for an hour.",
            detail:
              "The point is to stop fighting the block long enough to get your legs back.",
            progress: "Energy 24",
            actionId: "rest:home",
            done: false,
            targetLocationId: "boarding-house",
          },
        ],
      },
      {
        name: "home-low-energy",
        locationId: "boarding-house",
        energy: 24,
        lastRestAt: undefined,
        expectedProgress: { completed: 1, total: 2 },
        expectedOutcomes: [
          {
            id: "rest-return",
            status: "met",
            targetLocationId: undefined,
          },
          {
            id: "rest-hour",
            status: "blocked",
            actionId: "rest:home",
            targetLocationId: "boarding-house",
          },
        ],
        expectedTrail: [
          {
            id: "rest-return",
            progress: "Home",
            done: true,
          },
          {
            id: "rest-hour",
            progress: "Energy 24",
            actionId: "rest:home",
            done: false,
          },
        ],
      },
      {
        name: "recovered",
        locationId: "boarding-house",
        energy: 35,
        lastRestAt: "current",
        expectedProgress: { completed: 2, total: 2 },
        expectedOutcomes: [
          {
            id: "rest-return",
            status: "met",
            targetLocationId: undefined,
          },
          {
            id: "rest-hour",
            status: "met",
            actionId: undefined,
            targetLocationId: undefined,
          },
        ],
        expectedTrail: [
          {
            id: "rest-return",
            progress: "Home",
            done: true,
          },
          {
            id: "rest-hour",
            progress: "Recovered",
            actionId: undefined,
            done: true,
            targetLocationId: undefined,
          },
        ],
      },
    ];

    for (const scenario of cases) {
      const world = seedStreetGame(`objective-rest-${scenario.name}`);
      world.player.currentLocationId = scenario.locationId;
      world.player.energy = scenario.energy;
      world.player.lastRestAt =
        scenario.lastRestAt === "current" ? world.currentTime : undefined;

      const objective = buildPlayerObjectiveState(world, {
        focus: "rest",
        source: "manual",
        text: "Rest at Morrow House before taking another commitment.",
      });

      expect(objective).toMatchObject({
        routeKey: "rest-home",
        text: "Rest at Morrow House before taking another commitment.",
        progress: scenario.expectedProgress,
      });
      expect(objective?.outcomes).toMatchObject(scenario.expectedOutcomes);
      expect(objective?.trail).toMatchObject(scenario.expectedTrail);
    }
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

  it("keeps people route metadata stable across representative live states", () => {
    const fresh = seedStreetGame("objective-people-route-fresh");
    const talkedToTarget = seedStreetGame("objective-people-route-talked");
    addConversationWith(talkedToTarget, "npc-mara");

    const oneFamiliar = seedStreetGame("objective-people-route-familiar");
    for (const npc of oneFamiliar.npcs) {
      npc.trust = 0;
    }
    oneFamiliar.npcs.find((npc) => npc.id === "npc-mara")!.trust = 1;

    const twoTrusted = seedStreetGame("objective-people-route-trusted");
    for (const npc of twoTrusted.npcs) {
      npc.trust = 0;
    }
    twoTrusted.npcs.find((npc) => npc.id === "npc-mara")!.trust = 2;
    twoTrusted.npcs.find((npc) => npc.id === "npc-ada")!.trust = 2;

    const objectiveByState = {
      fresh: buildPlayerObjectiveState(fresh, {
        focus: "people",
        source: "manual",
        text: "Meet people and make the rounds.",
      }),
      oneFamiliar: buildPlayerObjectiveState(oneFamiliar, {
        focus: "people",
        source: "manual",
        text: "Meet people and make the rounds.",
      }),
      talkedToTarget: buildPlayerObjectiveState(talkedToTarget, {
        focus: "people",
        source: "manual",
        text: "Meet Mara and make a proper introduction.",
      }),
      twoTrusted: buildPlayerObjectiveState(twoTrusted, {
        focus: "people",
        source: "manual",
        text: "Meet people and make the rounds.",
      }),
    };

    expect(objectiveByState.fresh?.routeKey).toBe("people-npc-mara");
    expect(objectiveByState.fresh?.text).toBe(
      "Meet people and make the rounds.",
    );
    expect(
      objectiveByState.fresh?.outcomes.map((outcome) => outcome.id),
    ).toEqual(["people-talk", "people-open", "people-friend"]);
    expect(objectiveByState.fresh?.outcomes[0]).toMatchObject({
      id: "people-talk",
      label: "Local introduction made",
      npcId: "npc-mara",
      targetLocationId: "boarding-house",
      urgency: 3,
    });
    expect(objectiveByState.fresh?.trail[0]).toMatchObject({
      detail: "A real introduction makes the block feel less faceless.",
      done: false,
      id: "people-talk",
      npcId: "npc-mara",
      progress: "0 chats",
      targetLocationId: "boarding-house",
      title: "Talk to Mara and make a proper introduction.",
    });

    expect(objectiveByState.talkedToTarget?.outcomes[0]).toMatchObject({
      id: "people-talk",
      npcId: undefined,
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.talkedToTarget?.trail[0]).toMatchObject({
      done: true,
      progress: "1 chats",
    });

    expect(objectiveByState.oneFamiliar?.outcomes[1]).toMatchObject({
      id: "people-open",
      npcId: undefined,
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.oneFamiliar?.trail[1]).toMatchObject({
      detail:
        "At least one conversation has started to feel warmer than surface-level.",
      done: true,
      progress: "1/1 person opened up",
    });

    expect(objectiveByState.twoTrusted?.outcomes[2]).toMatchObject({
      id: "people-friend",
      npcId: undefined,
      status: "met",
      targetLocationId: undefined,
    });
    expect(objectiveByState.twoTrusted?.trail[2]).toMatchObject({
      detail: "A couple of people are starting to feel like real footholds.",
      done: true,
      progress: "2/2 trusted",
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

  it("keeps explore route metadata stable across representative live states", () => {
    const fresh = seedStreetGame("objective-explore-route-fresh");
    const visitedTarget = seedStreetGame("objective-explore-route-visited");
    visitedTarget.player.knownLocationIds.push("tea-house");

    const talkedAtTarget = seedStreetGame("objective-explore-route-talked");
    talkedAtTarget.player.knownLocationIds.push("tea-house");
    talkedAtTarget.player.currentLocationId = "tea-house";
    addConversationWith(talkedAtTarget, "npc-ada");

    const knownThreshold = seedStreetGame("objective-explore-route-known");
    knownThreshold.player.knownLocationIds = [
      "boarding-house",
      "courtyard",
      "tea-house",
      "square",
    ];

    const objectiveByState = {
      fresh: buildPlayerObjectiveState(fresh, {
        focus: "explore",
        source: "manual",
        text: "Explore the district and get your bearings.",
      }),
      knownThreshold: buildPlayerObjectiveState(knownThreshold, {
        focus: "explore",
        source: "manual",
        text: "Explore Kettle & Lamp and get your bearings.",
      }),
      talkedAtTarget: buildPlayerObjectiveState(talkedAtTarget, {
        focus: "explore",
        source: "manual",
        text: "Explore Kettle & Lamp and get your bearings.",
      }),
      visitedTarget: buildPlayerObjectiveState(visitedTarget, {
        focus: "explore",
        source: "manual",
        text: "Explore Kettle & Lamp and get your bearings.",
      }),
    };

    expect(objectiveByState.fresh?.routeKey).toBe("explore-tea-house");
    expect(objectiveByState.fresh?.text).toBe(
      "Explore the district and get your bearings.",
    );
    expect(
      objectiveByState.fresh?.outcomes.map((outcome) => outcome.id),
    ).toEqual(["explore-go", "explore-talk", "explore-learn"]);
    expect(objectiveByState.fresh?.outcomes[0]).toMatchObject({
      id: "explore-go",
      label: "Unknown place visited",
      status: "blocked",
      targetLocationId: "tea-house",
      urgency: 3,
    });
    expect(objectiveByState.fresh?.trail[0]).toMatchObject({
      detail:
        "A new corner is usually easier to understand once you stand in it.",
      done: false,
      id: "explore-go",
      progress: "Unknown place",
      targetLocationId: "tea-house",
      title: "Walk to Kettle & Lamp and see what it is for.",
    });

    expect(objectiveByState.visitedTarget?.outcomes[1]).toMatchObject({
      id: "explore-talk",
      npcId: "npc-ada",
      status: "blocked",
      targetLocationId: "tea-house",
    });
    expect(objectiveByState.visitedTarget?.trail[1]).toMatchObject({
      detail: "Ada is the most likely person to explain the place.",
      done: false,
      npcId: "npc-ada",
      progress: "1 people nearby",
      targetLocationId: "tea-house",
      title: "Talk to Ada there.",
    });

    expect(objectiveByState.talkedAtTarget?.outcomes[1]).toMatchObject({
      id: "explore-talk",
      npcId: undefined,
      status: "blocked",
      targetLocationId: undefined,
    });
    expect(objectiveByState.talkedAtTarget?.trail[1]).toMatchObject({
      done: true,
      progress: "1 people nearby",
    });

    expect(objectiveByState.knownThreshold?.outcomes[2]).toMatchObject({
      id: "explore-learn",
      label: "South Quay map knowledge improved",
      status: "met",
    });
    expect(objectiveByState.knownThreshold?.trail[2]).toMatchObject({
      detail:
        "The district is starting to feel like a place rather than a blur.",
      done: true,
      progress: "4/4 places",
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

  it("keeps help and tool problem-route copy out of objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const objectiveScaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );
    const scaffoldOwnedCopy = [
      "Cart problem understood",
      "The wheel is already starting to catch on the square's traffic.",
      "Fix the leaking pump in Morrow Yard before it spreads.",
      "Pump problem understood",
      "Rowan knows enough to tell the leak is one bad turn away from a worse day.",
      "Buy a wrench from Jo.",
      "A tool is only a tool until it reaches the problem that needs it.",
      "Tool used to solve the problem",
    ];

    for (const copy of scaffoldOwnedCopy) {
      expect(objectiveScaffoldSource).toContain(copy);
      expect(objectiveStateSource).not.toContain(copy);
    }

    expect(objectiveStateSource).toContain("problemClosedByWorld(problem)");
    expect(objectiveStateSource).toContain("problemCleared(problem)");
    expect(objectiveStateSource).toContain('hasItem(world, "item-wrench")');
  });

  it("preserves problem and tool objective outcome blockers and evidence", () => {
    const cartActive = seedStreetGame("objective-cart-active-copy");
    setProblemState(cartActive, "problem-cart", {
      discovered: false,
      status: "active",
    });
    const cartActiveObjective = buildPlayerObjectiveState(cartActive, {
      focus: "help",
      source: "manual",
      text: "Clear the jammed cart in Quay Square.",
    });

    expect(
      objectiveOutcome(cartActiveObjective, "cart-discovered"),
    ).toMatchObject({
      blockers: ["The jammed cart has not been inspected yet."],
      status: "blocked",
    });
    expect(
      objectiveOutcome(cartActiveObjective, "cart-discovered").evidence,
    ).toBeUndefined();
    expect(objectiveOutcome(cartActiveObjective, "cart-solved")).toMatchObject({
      blockers: ["The jammed cart is still active."],
      evidence: "active",
      status: "blocked",
    });

    const cartExpired = seedStreetGame("objective-cart-expired-copy");
    setProblemState(cartExpired, "problem-cart", {
      discovered: true,
      status: "expired",
    });
    const cartExpiredObjective = buildPlayerObjectiveState(cartExpired, {
      focus: "help",
      source: "manual",
      text: "Clear the jammed cart in Quay Square.",
    });
    expect(objectiveOutcome(cartExpiredObjective, "cart-solved")).toMatchObject(
      {
        blockers: ["The jammed cart got worse before anyone cleared it."],
        evidence: "expired",
        status: "failed",
      },
    );

    const pumpNoWrench = seedStreetGame("objective-pump-no-wrench-copy");
    setProblemState(pumpNoWrench, "problem-pump", {
      discovered: false,
      status: "active",
    });
    const pumpNoWrenchObjective = buildPlayerObjectiveState(pumpNoWrench, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });

    expect(
      objectiveOutcome(pumpNoWrenchObjective, "pump-discovered"),
    ).toMatchObject({
      blockers: ["The pump problem has not been inspected yet."],
      status: "blocked",
    });
    expect(
      objectiveOutcome(pumpNoWrenchObjective, "wrench-in-inventory"),
    ).toMatchObject({
      blockers: ["Rowan does not have a wrench yet."],
      evidence: "active",
      status: "blocked",
    });
    expect(
      objectiveOutcome(pumpNoWrenchObjective, "pump-solved"),
    ).toMatchObject({
      blockers: ["The pump needs a wrench before Rowan can solve it."],
      evidence: "active",
      status: "blocked",
    });

    const pumpWithWrench = seedStreetGame("objective-pump-with-wrench-copy");
    setProblemState(pumpWithWrench, "problem-pump", {
      discovered: true,
      status: "active",
    });
    addWrench(pumpWithWrench);
    const pumpWithWrenchObjective = buildPlayerObjectiveState(pumpWithWrench, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });
    expect(
      objectiveOutcome(pumpWithWrenchObjective, "wrench-in-inventory"),
    ).toMatchObject({
      evidence: "Wrench in inventory.",
      status: "met",
    });
    expect(
      objectiveOutcome(pumpWithWrenchObjective, "pump-solved"),
    ).toMatchObject({
      blockers: ["The pump is still active."],
      evidence: "active",
      status: "blocked",
    });

    const pumpResolved = seedStreetGame("objective-pump-resolved-copy");
    setProblemState(pumpResolved, "problem-pump", {
      discovered: true,
      status: "resolved",
    });
    const pumpResolvedObjective = buildPlayerObjectiveState(pumpResolved, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });
    expect(
      objectiveOutcome(pumpResolvedObjective, "wrench-in-inventory"),
    ).toMatchObject({
      evidence: "The pump was already contained by the house.",
      status: "met",
    });
    expect(
      objectiveOutcome(pumpResolvedObjective, "pump-solved"),
    ).toMatchObject({
      evidence: "resolved",
      status: "met",
    });

    const pumpExpired = seedStreetGame("objective-pump-expired-copy");
    setProblemState(pumpExpired, "problem-pump", {
      discovered: true,
      status: "expired",
    });
    const pumpExpiredObjective = buildPlayerObjectiveState(pumpExpired, {
      focus: "help",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
    });
    expect(
      objectiveOutcome(pumpExpiredObjective, "wrench-in-inventory"),
    ).toMatchObject({
      evidence: "expired",
      status: "met",
    });
    expect(objectiveOutcome(pumpExpiredObjective, "pump-solved")).toMatchObject(
      {
        blockers: ["The pump got away before anyone contained it."],
        evidence: "expired",
        status: "failed",
      },
    );

    const toolNoWrench = seedStreetGame("objective-tool-no-wrench-copy");
    setProblemState(toolNoWrench, "problem-pump", {
      discovered: true,
      status: "active",
    });
    const toolNoWrenchObjective = buildPlayerObjectiveState(toolNoWrench, {
      focus: "tool",
      source: "manual",
      text: "Buy a wrench for the pump and bring it back.",
    });
    expect(
      objectiveOutcome(toolNoWrenchObjective, "tool-return"),
    ).toMatchObject({
      blockers: ["Rowan does not have a wrench yet."],
      evidence: "courtyard",
      status: "blocked",
    });
    expect(objectiveOutcome(toolNoWrenchObjective, "tool-use")).toMatchObject({
      blockers: ["The target problem needs the right tool first."],
      evidence: "active",
      status: "blocked",
    });

    const toolAway = seedStreetGame("objective-tool-away-copy");
    setProblemState(toolAway, "problem-pump", {
      discovered: true,
      status: "active",
    });
    addWrench(toolAway);
    toolAway.player.currentLocationId = "boarding-house";
    const toolAwayObjective = buildPlayerObjectiveState(toolAway, {
      focus: "tool",
      source: "manual",
      text: "Buy a wrench for the pump and bring it back.",
    });
    expect(objectiveOutcome(toolAwayObjective, "tool-return")).toMatchObject({
      blockers: ["The tool has not reached the problem yet."],
      evidence: "courtyard",
      status: "blocked",
    });
    expect(objectiveOutcome(toolAwayObjective, "tool-use")).toMatchObject({
      blockers: ["The target problem is still active."],
      evidence: "active",
      status: "blocked",
    });

    const toolExpired = seedStreetGame("objective-tool-expired-copy");
    setProblemState(toolExpired, "problem-pump", {
      discovered: true,
      status: "expired",
    });
    addWrench(toolExpired);
    const toolExpiredObjective = buildPlayerObjectiveState(toolExpired, {
      focus: "tool",
      source: "manual",
      text: "Buy a wrench for the pump and bring it back.",
    });
    expect(objectiveOutcome(toolExpiredObjective, "tool-use")).toMatchObject({
      blockers: ["The target problem got worse before the tool reached it."],
      evidence: "expired",
      status: "failed",
    });
  });

  it("keeps cart help route metadata stable across live problem states", () => {
    const cases = [
      {
        name: "undiscovered",
        patch: { discovered: false, status: "active" as const },
        expectedProgress: { completed: 0, total: 2 },
        expectedOutcomes: [
          {
            id: "cart-discovered",
            label: "Cart problem understood",
            urgency: 2,
            actionId: "inspect:problem-cart",
            status: "blocked",
            targetLocationId: "market-square",
          },
          {
            id: "cart-solved",
            label: "Cart cleared",
            urgency: 1,
            actionId: undefined,
            status: "blocked",
            targetLocationId: "market-square",
          },
        ],
        expectedTrail: [
          {
            id: "help-cart-inspect",
            title: "Inspect the jammed cart in Quay Square.",
            progress: "Still a rumor",
            done: false,
            actionId: "inspect:problem-cart",
            targetLocationId: "market-square",
          },
          {
            id: "help-cart-solve",
            title: "Clear the cart before it snarls the square.",
            progress: "Active",
            done: false,
            actionId: undefined,
            targetLocationId: "market-square",
          },
        ],
      },
      {
        name: "discovered",
        patch: { discovered: true, status: "active" as const },
        expectedProgress: { completed: 1, total: 2 },
        expectedOutcomes: [
          {
            id: "cart-discovered",
            actionId: undefined,
            status: "met",
          },
          {
            id: "cart-solved",
            actionId: "solve:problem-cart",
            status: "blocked",
          },
        ],
        expectedTrail: [
          {
            id: "help-cart-inspect",
            progress: "Problem seen",
            done: true,
          },
          {
            id: "help-cart-solve",
            progress: "Active",
            done: false,
            actionId: "solve:problem-cart",
          },
        ],
      },
      {
        name: "cleared",
        patch: { discovered: true, status: "solved" as const },
        expectedProgress: { completed: 2, total: 2 },
        expectedOutcomes: [
          {
            id: "cart-discovered",
            status: "met",
          },
          {
            id: "cart-solved",
            actionId: undefined,
            status: "met",
          },
        ],
        expectedTrail: [
          {
            id: "help-cart-inspect",
            done: true,
          },
          {
            id: "help-cart-solve",
            progress: "Cleared",
            done: true,
            actionId: undefined,
          },
        ],
      },
      {
        name: "expired",
        patch: { discovered: true, status: "expired" as const },
        expectedProgress: { completed: 1, total: 2 },
        expectedOutcomes: [
          {
            id: "cart-discovered",
            status: "met",
          },
          {
            id: "cart-solved",
            actionId: undefined,
            status: "failed",
          },
        ],
        expectedTrail: [
          {
            id: "help-cart-inspect",
            done: true,
          },
          {
            id: "help-cart-solve",
            progress: "Missed",
            done: false,
            actionId: undefined,
          },
        ],
      },
    ];

    for (const scenario of cases) {
      const world = seedStreetGame(`objective-cart-${scenario.name}`);
      setProblemState(world, "problem-cart", scenario.patch);

      const objective = buildPlayerObjectiveState(world, {
        focus: "help",
        source: "manual",
        text: "Clear the jammed cart in Quay Square.",
      });

      expect(objective).toMatchObject({
        routeKey: "help-cart",
        progress: scenario.expectedProgress,
      });
      expect(objective?.outcomes).toMatchObject(scenario.expectedOutcomes);
      expect(objective?.trail).toMatchObject(scenario.expectedTrail);
    }
  });

  it("keeps pump help route metadata stable across tool and lifecycle states", () => {
    const cases = [
      {
        name: "undiscovered",
        hasWrench: false,
        patch: { discovered: false, status: "active" as const },
        routeKey: "tool-pump",
        expectedProgress: { completed: 0, total: 3 },
        expectedOutcomes: [
          {
            id: "pump-discovered",
            label: "Pump problem understood",
            urgency: 3,
            actionId: "inspect:problem-pump",
            status: "blocked",
            targetLocationId: "courtyard",
          },
          {
            id: "wrench-in-inventory",
            label: "Wrench secured",
            urgency: 2,
            actionId: "buy:item-wrench",
            status: "blocked",
            targetLocationId: "repair-stall",
          },
          {
            id: "pump-solved",
            label: "Pump solved",
            urgency: 1,
            actionId: undefined,
            status: "blocked",
            targetLocationId: "courtyard",
          },
        ],
        expectedTrail: [
          {
            id: "help-pump-inspect",
            title: "Inspect the pump in Morrow Yard.",
            progress: "Still a lead",
            done: false,
            actionId: "inspect:problem-pump",
            targetLocationId: "courtyard",
          },
          {
            id: "help-pump-tool",
            title: "Buy a wrench from Jo.",
            progress: "No wrench yet",
            done: false,
            actionId: "buy:item-wrench",
            targetLocationId: "repair-stall",
          },
          {
            id: "help-pump-fix",
            title: "Fix the leak before it spreads.",
            progress: "Active",
            done: false,
            actionId: undefined,
            targetLocationId: "courtyard",
          },
        ],
      },
      {
        name: "discovered-no-wrench",
        hasWrench: false,
        patch: { discovered: true, status: "active" as const },
        routeKey: "tool-pump",
        expectedProgress: { completed: 1, total: 3 },
        expectedOutcomes: [
          { id: "pump-discovered", actionId: undefined, status: "met" },
          {
            id: "wrench-in-inventory",
            actionId: "buy:item-wrench",
            status: "blocked",
          },
          { id: "pump-solved", actionId: undefined, status: "blocked" },
        ],
        expectedTrail: [
          { id: "help-pump-inspect", progress: "Problem seen", done: true },
          {
            id: "help-pump-tool",
            title: "Buy a wrench from Jo.",
            progress: "No wrench yet",
            done: false,
            actionId: "buy:item-wrench",
          },
          { id: "help-pump-fix", actionId: undefined, done: false },
        ],
      },
      {
        name: "has-wrench",
        hasWrench: true,
        patch: { discovered: true, status: "active" as const },
        routeKey: "help-pump",
        expectedProgress: { completed: 2, total: 3 },
        expectedOutcomes: [
          { id: "pump-discovered", status: "met" },
          { id: "wrench-in-inventory", actionId: undefined, status: "met" },
          {
            id: "pump-solved",
            actionId: "solve:problem-pump",
            status: "blocked",
          },
        ],
        expectedTrail: [
          { id: "help-pump-inspect", done: true },
          {
            id: "help-pump-tool",
            title: "Bring the wrench back to the pump.",
            progress: "Tool in hand",
            done: true,
            actionId: undefined,
            targetLocationId: "courtyard",
          },
          {
            id: "help-pump-fix",
            actionId: "solve:problem-pump",
            done: false,
          },
        ],
      },
      {
        name: "resolved-by-world",
        hasWrench: false,
        patch: { discovered: true, status: "resolved" as const },
        routeKey: "tool-pump",
        expectedProgress: { completed: 3, total: 3 },
        expectedOutcomes: [
          { id: "pump-discovered", status: "met" },
          {
            id: "wrench-in-inventory",
            actionId: undefined,
            status: "met",
          },
          { id: "pump-solved", actionId: undefined, status: "met" },
        ],
        expectedTrail: [
          { id: "help-pump-inspect", done: true },
          {
            id: "help-pump-tool",
            progress: "No longer needed",
            done: true,
            actionId: undefined,
          },
          {
            id: "help-pump-fix",
            progress: "Cleared",
            done: true,
            actionId: undefined,
          },
        ],
      },
      {
        name: "expired",
        hasWrench: false,
        patch: { discovered: true, status: "expired" as const },
        routeKey: "tool-pump",
        expectedProgress: { completed: 2, total: 3 },
        expectedOutcomes: [
          { id: "pump-discovered", status: "met" },
          { id: "wrench-in-inventory", status: "met" },
          { id: "pump-solved", status: "failed" },
        ],
        expectedTrail: [
          { id: "help-pump-inspect", done: true },
          {
            id: "help-pump-tool",
            progress: "No longer needed",
            done: true,
            actionId: undefined,
          },
          {
            id: "help-pump-fix",
            progress: "Missed",
            done: false,
            actionId: undefined,
          },
        ],
      },
    ];

    for (const scenario of cases) {
      const world = seedStreetGame(`objective-pump-${scenario.name}`);
      setProblemState(world, "problem-pump", scenario.patch);
      if (scenario.hasWrench) {
        addWrench(world);
      }

      const objective = buildPlayerObjectiveState(world, {
        focus: "help",
        source: "manual",
        text: "Fix the pump in Morrow Yard before it spreads.",
      });

      expect(objective).toMatchObject({
        routeKey: scenario.routeKey,
        progress: scenario.expectedProgress,
      });
      expect(objective?.outcomes).toMatchObject(scenario.expectedOutcomes);
      expect(objective?.trail).toMatchObject(scenario.expectedTrail);
    }
  });

  it("keeps tool route metadata stable for pump and cart targets", () => {
    const cases = [
      {
        name: "cart-unknown",
        text: "Buy a wrench later.",
        routeKey: "tool-cart",
        problemId: "problem-cart",
        patch: { discovered: false, status: "hidden" as const },
        locationName: "Quay Square",
        targetId: "problem-cart",
        targetLocationId: "market-square",
        expectedProgress: { completed: 0, total: 3 },
        expectedOutcomes: [
          {
            id: "tool-buy",
            label: "Required tool secured",
            urgency: 3,
            actionId: "buy:item-wrench",
            status: "blocked",
            targetLocationId: "repair-stall",
          },
          {
            id: "tool-return",
            label: "Tool brought to the problem",
            urgency: 2,
            actionId: undefined,
            status: "blocked",
            targetLocationId: undefined,
          },
          {
            id: "tool-use",
            label: "Tool used to solve the problem",
            urgency: 1,
            actionId: undefined,
            status: "blocked",
            targetLocationId: undefined,
          },
        ],
        expectedTrail: [
          {
            id: "tool-buy",
            title: "Buy a wrench from Jo.",
            progress: "Needed",
            done: false,
            actionId: "buy:item-wrench",
            targetLocationId: "repair-stall",
          },
          {
            id: "tool-return",
            title: "Take it back to Quay Square.",
            progress: "Lead unclear",
            done: false,
            targetLocationId: "market-square",
          },
          {
            id: "tool-use",
            title: "Use it before the trouble spreads.",
            progress: "Active",
            done: false,
            actionId: undefined,
            targetLocationId: "market-square",
          },
        ],
      },
      {
        name: "cart-known",
        text: "Buy a wrench later.",
        routeKey: "tool-cart",
        problemId: "problem-cart",
        patch: { discovered: true, status: "active" as const },
        expectedProgress: { completed: 0, total: 3 },
        expectedTrail: [
          { id: "tool-buy", actionId: "buy:item-wrench" },
          {
            id: "tool-return",
            progress: "Lead known",
            targetLocationId: "market-square",
          },
          {
            id: "tool-use",
            actionId: "solve:problem-cart",
            targetLocationId: "market-square",
          },
        ],
      },
      {
        name: "pump-known",
        text: "Buy a wrench for the pump and bring it back.",
        routeKey: "tool-wrench",
        problemId: "problem-pump",
        patch: { discovered: true, status: "active" as const },
        expectedProgress: { completed: 0, total: 3 },
        expectedTrail: [
          { id: "tool-buy", actionId: "buy:item-wrench" },
          {
            id: "tool-return",
            title: "Take it back to Morrow Yard.",
            progress: "Lead known",
            targetLocationId: "courtyard",
          },
          {
            id: "tool-use",
            actionId: "solve:problem-pump",
            targetLocationId: "courtyard",
          },
        ],
      },
      {
        name: "wrench-bought-and-returned",
        text: "Buy a wrench for the pump and bring it back.",
        routeKey: "tool-wrench",
        problemId: "problem-pump",
        patch: { discovered: true, status: "active" as const },
        hasWrench: true,
        currentLocationId: "courtyard",
        expectedProgress: { completed: 2, total: 3 },
        expectedOutcomes: [
          { id: "tool-buy", actionId: undefined, status: "met" },
          { id: "tool-return", status: "met", targetLocationId: undefined },
          {
            id: "tool-use",
            actionId: "solve:problem-pump",
            status: "blocked",
            targetLocationId: "courtyard",
          },
        ],
        expectedTrail: [
          {
            id: "tool-buy",
            progress: "Bought",
            done: true,
            actionId: undefined,
          },
          {
            id: "tool-return",
            progress: "Lead known",
            done: true,
            targetLocationId: "courtyard",
          },
          {
            id: "tool-use",
            progress: "Active",
            done: false,
            actionId: "solve:problem-pump",
            targetLocationId: "courtyard",
          },
        ],
      },
    ];

    for (const scenario of cases) {
      const world = seedStreetGame(`objective-tool-${scenario.name}`);
      setProblemState(world, scenario.problemId, scenario.patch);
      if (scenario.hasWrench) {
        addWrench(world);
      }
      if (scenario.currentLocationId) {
        world.player.currentLocationId = scenario.currentLocationId;
      }

      const objective = buildPlayerObjectiveState(world, {
        focus: "tool",
        source: "manual",
        text: scenario.text,
      });

      expect(objective).toMatchObject({
        routeKey: scenario.routeKey,
        progress: scenario.expectedProgress,
      });
      if (scenario.expectedOutcomes) {
        expect(objective?.outcomes).toMatchObject(scenario.expectedOutcomes);
      }
      expect(objective?.trail).toMatchObject(scenario.expectedTrail);
    }
  });
});
