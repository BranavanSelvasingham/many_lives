import { describe, expect, it } from "vitest";

import { buildRowanCognitionState } from "../src/sim/rowanCognition.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";

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

function settleFirstAfternoon(world: StreetGameState) {
  world.firstAfternoon = {
    completedAt: "Day 1, 16:20",
    completionAcknowledgedAt: "Day 1, 16:24",
    fieldNote: {
      createdAt: "Day 1, 16:20",
      evidence:
        "Asked Ada at Kettle & Lamp at 11:20; she offered cup-and-counter shift for $14.",
      learned:
        "Ada needed steady lunch help, and Rowan could keep Kettle & Lamp moving when the room filled up.",
      memory:
        "Ada remembers Rowan asked directly, stayed through the rush, and took his pay without making the room harder.",
      next: "Rest on the first foothold, then choose between the yard work window and the Morrow Yard pump before the city moves on without Rowan.",
    },
    leadFieldNote: {
      createdAt: "Day 1, 11:22",
      evidence:
        "Asked Ada at Kettle & Lamp at 11:20; she offered cup-and-counter shift for $14.",
      learned:
        "Mara's Kettle & Lamp lead is real: Ada needs steady lunch help today.",
      memory:
        "Ada remembers Rowan came in person instead of treating Mara's lead as a rumor.",
      next: "The first afternoon is settled; rest at Morrow House and decide which lead deserves tomorrow morning.",
    },
  };
  world.player.knownNpcIds = Array.from(
    new Set([...world.player.knownNpcIds, "npc-mara", "npc-ada"]),
  );
  world.player.knownLocationIds = Array.from(
    new Set([...world.player.knownLocationIds, "tea-house", "courtyard"]),
  );
  world.player.reputation.morrow_house = 2;

  const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
  if (teaJob) {
    teaJob.accepted = true;
    teaJob.completed = true;
    teaJob.discovered = true;
  }

  const pump = world.problems.find((problem) => problem.id === "problem-pump");
  if (pump) {
    pump.discovered = true;
    pump.status = "active";
    pump.urgency = 5;
  }

  addNpcReply(
    world,
    "npc-mara",
    "Mara",
    "You can stay if you keep proving the house can count on you.",
  );
  addNpcReply(
    world,
    "npc-ada",
    "Ada",
    "Lunch work is real today. Keep the cups moving and I can pay fourteen.",
  );
}

function expectNoStaleOpeningNotebookAuthority(
  notebook: ReturnType<typeof buildRowanCognitionState>["notebook"],
) {
  expect(
    [
      notebook.title,
      notebook.belief,
      notebook.clue,
      notebook.plan,
      notebook.uncertainty,
    ].join(" "),
  ).not.toMatch(
    /Keep a stable room|Mara is the person most likely|Enter Morrow House|tonight's bed|bed feel less temporary/i,
  );
  expect(notebook.authority.notebookNeedKey).not.toBe("shelter");
  expect(notebook.authority.primaryNeedKey).not.toBe("shelter");
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
    expect(notebook.uncertainty).toBe(
      "What does Nia know about the block before it jams?",
    );
    expect(
      `${notebook.title} ${notebook.belief} ${notebook.uncertainty}`,
    ).not.toMatch(/Mara is the person most likely|tonight's bed|temporary/i);
    expect(notebook.authority.beliefId).toBe("belief-nia-current-lead");
  });

  it("turns the post-field-note rest handoff into recovery cognition instead of an entry action", () => {
    const world = seedStreetGame("game-post-afternoon-rest-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;
    settleFirstAfternoon(world);
    world.currentTime = "Day 1, 16:24";
    world.clock.hour = 16;
    world.clock.minute = 24;
    world.clock.totalMinutes = 16 * 60 + 24;
    world.player.energy = 18;
    world.player.currentLocationId = "market-square";
    world.player.objective = {
      ...currentObjective,
      focus: "rest",
      routeKey: "rest-home",
      source: "dynamic",
      text: "Recover enough at Morrow House to move cleanly again.",
      outcomes: [
        {
          authority: "predicate",
          id: "rest-return",
          label: "Returned somewhere safe to rest",
          status: "open",
          targetLocationId: "boarding-house",
          urgency: 2,
        },
        {
          actionId: "rest:home",
          authority: "predicate",
          id: "rest-hour",
          label: "Recovered with an hour of rest",
          status: "open",
          targetLocationId: "boarding-house",
          urgency: 1,
        },
      ],
      progress: {
        completed: 0,
        label: "0/2 outcomes met",
        total: 2,
      },
      trail: [],
    };
    world.rowanAutonomy = {
      actionId: "enter:boarding-house",
      autoContinue: true,
      detail:
        "Morrow House is the closest place Rowan can recover before deciding what still needs attention.",
      intent: {
        reason:
          "Morrow House is the closest place Rowan can recover before deciding what still needs attention.",
        signals: ["Goal: Recover enough to move cleanly again."],
      },
      key: "objective:rest:return-home",
      label: "Enter Morrow House",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.title).toBe("Keep enough energy to follow through");
    expect(notebook.belief).toMatch(/Ada|field note|opening room question/i);
    expect(notebook.clue).toMatch(/Asked Ada|Kettle & Lamp|cup-and-counter/i);
    expect(notebook.confidence).toMatch(/Confirmed|field note|paid tea shift/i);
    expect(notebook.plan).toBe(
      "Rest at Morrow House long enough to recover, then weigh only what is still live.",
    );
    expect(notebook.uncertainty).toBe(
      "What still deserves Rowan's attention after he recovers?",
    );
    expectNoStaleOpeningNotebookAuthority(notebook);
    expect(notebook.authority.beliefId).toBe(
      "belief-first-afternoon-field-note",
    );
  });

  it("keeps post-rest pump pressure from falling back to opening shelter authority", () => {
    const world = seedStreetGame("game-post-rest-pump-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;
    settleFirstAfternoon(world);
    world.currentTime = "Day 1, 17:34";
    world.clock.hour = 17;
    world.clock.minute = 34;
    world.clock.totalMinutes = 17 * 60 + 34;
    world.player.energy = 42;
    world.player.lastRestAt = "Day 1, 17:20";
    world.player.currentLocationId = "courtyard";
    world.player.inventory.push({
      description: "A worn wrench that can handle the yard pump.",
      id: "item-wrench",
      name: "Wrench",
    });
    world.player.objective = {
      ...currentObjective,
      focus: "help",
      routeKey: "help-pump",
      source: "dynamic",
      text: "Fix the leaking pump in Morrow Yard before it spreads.",
      outcomes: [
        {
          actionId: "solve:problem-pump",
          authority: "predicate",
          id: "pump-solved",
          label: "Fix the leaking pump",
          status: "open",
          targetLocationId: "courtyard",
          urgency: 3,
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
      actionId: "solve:problem-pump",
      autoContinue: true,
      detail:
        "The pump is active and Rowan has the wrench, so fixing it is the live useful move.",
      intent: {
        reason:
          "The pump is active and Rowan has the wrench, so fixing it is the live useful move.",
        signals: ["Problem: pump active", "Tool: wrench owned"],
      },
      key: "objective:solve:pump",
      label: "Fix the pump",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "courtyard",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.title).toBe("Learn how South Quay fits together");
    expect(notebook.belief).toMatch(/Morrow Yard pump|live house problem/i);
    expect(notebook.clue).toMatch(/Morrow Yard pump|active|wrench/i);
    expect(notebook.confidence).toMatch(/Promising|active|tool/i);
    expect(notebook.plan).toBe("Fix the pump");
    expect(notebook.uncertainty).toBe(
      "Can Rowan turn a small fix into a real local foothold?",
    );
    expect(notebook.authority.beliefId).toBe("belief-pump-standing");
    expectNoStaleOpeningNotebookAuthority(notebook);
  });

  it("keeps post-rest yard work cognition on the live income route", () => {
    const world = seedStreetGame("game-post-rest-yard-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;
    settleFirstAfternoon(world);
    world.currentTime = "Day 1, 17:34";
    world.clock.hour = 17;
    world.clock.minute = 34;
    world.clock.totalMinutes = 17 * 60 + 34;
    world.player.energy = 46;
    world.player.lastRestAt = "Day 1, 17:05";
    world.player.currentLocationId = "boarding-house";
    world.player.knownNpcIds = Array.from(
      new Set([...world.player.knownNpcIds, "npc-tomas"]),
    );
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.accepted = false;
      yardJob.completed = false;
      yardJob.discovered = true;
      yardJob.missed = false;
    }
    addNpcReply(
      world,
      "npc-tomas",
      "Tomas",
      "Yard work pays if you reach the freight window before the load moves.",
    );
    world.player.objective = {
      ...currentObjective,
      focus: "work",
      routeKey: "work-yard",
      source: "dynamic",
      text: "Get a real work lead from Tomas at North Crane Yard.",
      outcomes: [
        {
          authority: "predicate",
          evidence: "Tomas described paid yard work.",
          id: "work-lead-yard",
          label: "Yard work lead confirmed",
          status: "met",
          urgency: 3,
        },
        {
          actionId: "accept:job-yard-shift",
          authority: "predicate",
          id: "work-commit",
          label: "Yard work accepted",
          status: "open",
          targetLocationId: "freight-yard",
          urgency: 2,
        },
      ],
      progress: {
        completed: 1,
        label: "1/2 outcomes met",
        total: 2,
      },
      trail: [],
    };
    world.rowanAutonomy = {
      autoContinue: true,
      detail:
        "The yard window is still live, so Rowan should reach Tomas before the work moves on.",
      intent: {
        reason:
          "The yard window is still live, so Rowan should reach Tomas before the work moves on.",
        signals: ["Job: yard work", "Window: still open"],
      },
      key: "objective:work-yard:travel",
      label: "Ask Tomas before the freight window closes",
      layer: "objective",
      mode: "acting",
      stepKind: "move",
      targetLocationId: "freight-yard",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.title).toBe("Find steady income");
    expect(notebook.belief).toMatch(/Tomas|yard work|freight/i);
    expect(notebook.clue).toMatch(/Tomas|North Crane Yard|freight window/i);
    expect(notebook.confidence).toMatch(/Confirmed|Tomas|freight window/i);
    expect(notebook.plan).toBe("Ask Tomas before the freight window closes");
    expect(notebook.authority.beliefId).toBe("belief-tomas-work");
    expectNoStaleOpeningNotebookAuthority(notebook);
  });

  it("does not reduce a post-rest yard plan to the low-level street exit", () => {
    const world = seedStreetGame("game-post-rest-yard-exit-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;
    settleFirstAfternoon(world);
    world.currentTime = "Day 1, 16:26";
    world.clock.hour = 16;
    world.clock.minute = 26;
    world.clock.totalMinutes = 16 * 60 + 26;
    world.player.energy = 70;
    world.player.currentLocationId = "boarding-house";
    world.player.knownNpcIds = Array.from(
      new Set([...world.player.knownNpcIds, "npc-tomas"]),
    );
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.discovered = true;
    }
    addNpcReply(
      world,
      "npc-tomas",
      "Tomas",
      "Yard work pays if you reach the freight window before the load moves.",
    );
    world.player.objective = {
      ...currentObjective,
      focus: "work",
      routeKey: "work-yard",
      source: "dynamic",
      text: "Get a real work lead from Tomas at North Crane Yard.",
      outcomes: [
        {
          actionId: "accept:job-yard-shift",
          authority: "predicate",
          id: "work-commit",
          label: "Yard work accepted",
          status: "open",
          targetLocationId: "freight-yard",
          urgency: 2,
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
      actionId: "exit:boarding-house",
      autoContinue: true,
      detail:
        "The yard window is still live, so Rowan should leave Morrow House and reach Tomas before the work moves on.",
      intent: {
        reason:
          "The yard window is still live, so Rowan should leave Morrow House and reach Tomas before the work moves on.",
        signals: ["Job: yard work", "Window: still open"],
      },
      key: "objective:work-yard:exit",
      label: "Exit to South Quay",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.plan).toBe(
      "Ask Tomas before the North Crane Yard freight window closes.",
    );
    expect(notebook.plan).not.toBe("Exit to South Quay");
    expect(notebook.plan).not.toMatch(/^Head to North Crane Yard/i);
    expect(notebook.clue).toMatch(/Tomas|North Crane Yard|freight window/i);
    expectNoStaleOpeningNotebookAuthority(notebook);
  });

  it("keeps Jo's tool lead notebook uncertainty on the live repair choice", () => {
    const world = seedStreetGame("game-jo-tool-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;

    world.currentTime = "Day 1, 13:10";
    world.clock.hour = 13;
    world.clock.minute = 10;
    world.clock.totalMinutes = 13 * 60 + 10;
    world.player.currentLocationId = "repair-stall";
    world.player.knownNpcIds = Array.from(
      new Set([...world.player.knownNpcIds, "npc-jo"]),
    );
    addNpcReply(
      world,
      "npc-jo",
      "Jo",
      "If you buy the wrench, use it on a repair that actually matters.",
    );
    world.player.objective = {
      ...currentObjective,
      focus: "tool",
      routeKey: "people-jo",
      source: "conversation",
      text: "Decide whether Jo's wrench is worth buying for a real repair.",
      outcomes: [
        {
          authority: "predicate",
          id: "tool-choice",
          label: "Decide whether Jo's wrench is worth buying",
          npcId: "npc-jo",
          status: "open",
          targetLocationId: "repair-stall",
          urgency: 3,
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
      actionId: "talk:npc-jo",
      autoContinue: true,
      detail:
        "Jo can tell Rowan whether the wrench is worth the coins before he spends them.",
      intent: {
        reason:
          "Jo can tell Rowan whether the wrench is worth the coins before he spends them.",
        signals: ["Question: is the wrench worth buying?"],
      },
      key: "objective:talk:jo",
      label: "Talk to Jo",
      layer: "objective",
      mode: "conversation",
      npcId: "npc-jo",
      stepKind: "talk",
      targetLocationId: "repair-stall",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.plan).toBe("Talk to Jo");
    expect(notebook.uncertainty).toBe(
      "Which local problem is worth spending scarce money on?",
    );
    expect(notebook.authority.beliefId).toBe("belief-jo-tools");
  });

  it("falls back from stale opening entry text to a generic notebook plan", () => {
    const world = seedStreetGame("game-stale-opening-entry-notebook-cognition");
    const currentObjective = world.player.objective as PlayerObjective;

    world.player.objective = {
      ...currentObjective,
      focus: "settle",
      routeKey: "settle-core",
      text: "Find the first useful question to ask in South Quay.",
      outcomes: [
        {
          authority: "predicate",
          id: "opening-question",
          label: "Find the first useful question",
          status: "open",
          targetLocationId: "boarding-house",
          urgency: 1,
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
      actionId: "enter:boarding-house",
      autoContinue: true,
      detail:
        "Rowan should step inside before deciding what question is worth asking first.",
      intent: {
        reason:
          "Rowan should step inside before deciding what question is worth asking first.",
        signals: ["Entry: boarding-house"],
      },
      key: "opening:enter-home",
      label: "Enter Morrow House",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    };

    const notebook = buildRowanCognitionState(world).notebook;

    expect(notebook.plan).toBe("Ask the first useful question.");
  });
});
