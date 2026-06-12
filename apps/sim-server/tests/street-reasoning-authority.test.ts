import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { buildGenerateStreetThoughtsPrompt } from "../src/ai/prompts/generateStreetThoughts.js";
import { buildGenerateStreetAutonomousLinePrompt } from "../src/ai/prompts/generateStreetAutonomousLine.js";
import { buildGenerateStreetReplyPrompt } from "../src/ai/prompts/generateStreetReply.js";
import { buildInterpretStreetConversationPrompt } from "../src/ai/prompts/interpretStreetConversation.js";
import { buildPlainRowanContext } from "../src/ai/prompts/plainStreetConversationContext.js";
import {
  buildStreetConversationContext,
  buildDeterministicStreetReply,
} from "../src/ai/streetDialogue.js";
import { buildDeterministicStreetThoughts } from "../src/ai/streetThoughts.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";

const FIRST_AFTERNOON_PLAN_RATIONALE =
  "Leave Morrow House, reach Kettle & Lamp, then ask Ada before lunch gets busy.";
const FIRST_AFTERNOON_DIALOGUE_FALLBACK =
  "Go to Kettle & Lamp before lunch and ask Ada if she still needs help. It is close, honest, and useful today.";
const MARA_ADA_GROUNDING_FOLLOWUP =
  "Just to be clear, should I ask Ada at Kettle & Lamp about lunch work before the rush?";
const MARA_ADA_GROUNDED_FALLBACK_REPLY =
  "Morrow House can hold you tonight, but a foothold needs work. Ask Ada at Kettle & Lamp before lunch; she may need steady hands for the cup-and-counter shift.";
const MARA_ADA_GROUNDING_FALLBACK_MEMORY =
  "Mara's answer was not specific enough yet to turn Ada into a grounded work lead.";
const MARA_ADA_GROUNDING_FALLBACK_SUMMARY =
  "Mara has not yet made the Kettle & Lamp lead visible in the conversation.";
const NPC_FIRST_CONTACT_PRIMER_COPY = [
  "Mara gives you a measured look, like she's deciding whether you're here for a bed, for work, or just to stop feeling new.",
  "Mara weighs newcomers by whether they settle in, pull their weight, or disappear.",
  "Ada glances over like the room is already filling, but there is still a little welcome in it.",
  "Ada offers work when she thinks someone can keep the tea room easy through lunch.",
  "Jo looks up from the bench with the kind of patience that expects you to get to the point.",
  "Jo prices things fairly enough that you notice.",
  "Tomas glances at your shoulders, not your face, like talk only matters if it turns into labor.",
  "Tomas thinks in loads, time windows, and whether you slow the rest of the yard down.",
  "Nia watches the square while she talks to you, like she expects the next important detail to arrive mid-sentence.",
  "Nia notices small jams before the whole block has to notice them.",
];
const FIRST_AFTERNOON_RETURN_HOME_THOUGHT =
  "I should head back to Morrow House and let today land.";
const FIRST_AFTERNOON_TEA_RUSH_THOUGHT =
  "The room is filling. Cups first, tables second, keep moving.";
const FIRST_AFTERNOON_TEA_COUNTER_THOUGHT =
  "Ada is not watching every step now. That probably means I am keeping up.";
const FIRST_AFTERNOON_COMPLETION_FEED =
  "Rowan closes the first-afternoon note and lets tomorrow's lead compete with the live work and trouble still moving around South Quay.";
const FIRST_AFTERNOON_COMPLETION_MEMORY =
  "After the first afternoon was recorded, Rowan treated the next move as a fresh choice from live work, rest, and local trouble instead of replaying the old route.";
const FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT =
  "Tonight's bed holds. I earned real money, and tomorrow has a lead.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_PLAYER_THOUGHT =
  "Tonight's bed still holds. I earned real money, Ada knows I can keep up, and the pump in Morrow Yard is not just background noise anymore. That is enough for a first afternoon.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_FEED =
  "Rowan takes stock at Morrow House: tonight's bed still holds, $14 is in his pocket, Ada has seen him keep up, and the Morrow Yard pump is now a real local problem instead of background noise.";
const FIRST_AFTERNOON_COMPLETION_OUTCOME_MEMORY =
  "You finished the first afternoon with a room to return to, paid work, and a small foothold in South Quay. Taking stock also made the Morrow Yard pump impossible to ignore.";
const FIRST_AFTERNOON_PLAN_ACTION_DESCRIPTION =
  "Commit to leaving Morrow House and following Mara's lead to Ada at Kettle & Lamp.";
const FIRST_AFTERNOON_PUMP_ACTION_DESCRIPTION =
  "Treat the leaking pump as the first proof that Rowan notices what the house needs.";
const FIRST_AFTERNOON_COMPARE_ACTION_DESCRIPTION =
  "Keep Ada's offer in view while checking the pump, the square, or another lead before committing.";
const FIRST_AFTERNOON_COMPLETION_ACTION_DESCRIPTION =
  "Count what changed today before chasing another errand.";
const FIRST_AFTERNOON_ROUTE_OUTCOME_LABEL = "Useful first move chosen";
const FIRST_AFTERNOON_ROUTE_STEP_TITLE = "Choose the first useful move.";
const FIRST_AFTERNOON_ROUTE_STEP_DETAIL =
  "Rowan could wander, rest, or ask Ada. Ada is the useful first bet.";
const FIRST_AFTERNOON_ROUTE_COMPLETION_DETAIL =
  "Tonight's bed still holds, $14 is in Rowan's pocket, Ada has seen him keep up, and tomorrow has a real lead.";
const MARA_ADA_ROUTE_OUTCOME_LABEL = "Ada verification intent formed";
const MARA_ADA_ROUTE_STEP_TITLE = "Form the plan to verify it directly.";
const MARA_ADA_ROUTE_STEP_DETAIL =
  "Make the plan explicit: walk to Kettle & Lamp and ask Ada about lunch work.";
const MARA_ADA_ROUTE_COMPLETION_DETAIL =
  "The offer is now actionable: take the shift, check another lead, return later, or keep exploring.";
const MARA_ADA_ROUTE_HEADLINE =
  "Verify Mara's Kettle & Lamp lead and turn it into a real choice.";
const WORK_ROUTE_COMMIT_OUTCOME_LABEL = "Paid work committed";
const WORK_ROUTE_YARD_STEP_TITLE =
  "Take the freight-yard lift before the window closes.";
const WORK_ROUTE_TEA_STEP_DETAIL = "Ada likes speed more than speeches.";
const WORK_ROUTE_PAY_STEP_DETAIL =
  "Work only matters if it buys more than the next hour.";
const WORK_ROUTE_TEA_HEADLINE =
  "Secure paid work at Kettle & Lamp and follow through.";
const WORK_ROUTE_YARD_HEADLINE = "Secure paid yard work and follow through.";
const SETTLE_ROUTE_TERMS_OUTCOME_LABEL = "Room terms understood";
const SETTLE_ROUTE_STANDING_OUTCOME_LABEL = "Morrow House standing built";
const SETTLE_ROUTE_LEAD_OUTCOME_LABEL = "Tea-house work lead confirmed";
const SETTLE_ROUTE_TERMS_STEP_TITLE_ANCHOR = "Lock in my stay at";
const SETTLE_ROUTE_TERMS_STEP_DETAIL =
  "Mara can walk Rowan through exactly what it takes to keep a room here.";
const SETTLE_ROUTE_STANDING_STEP_DETAIL =
  "Now that Rowan knows the terms, he needs to show up, help out, and make the house easier to run.";
const SETTLE_ROUTE_YARD_STEP_TITLE =
  "Line up one solid work lead at North Crane Yard.";
const SETTLE_ROUTE_INCOME_STEP_TITLE = "Turn that lead into steady pay.";
const SETTLE_ROUTE_PEOPLE_STEP_TITLE = "Build two real connections.";
const SETTLE_ROUTE_HEADLINE =
  "Get settled in Brackenport: find a place to stay, steady income, and a few friends.";
const PEOPLE_ROUTE_OUTCOME_LABEL = "Local introduction made";
const PEOPLE_ROUTE_STEP_TITLE = "Give somebody a reason to remember me well.";
const PEOPLE_ROUTE_STEP_DETAIL =
  "A real introduction makes the block feel less faceless.";
const PEOPLE_ROUTE_HEADLINE =
  "Meet people who could become real friends in South Quay.";
const EXPLORE_ROUTE_OUTCOME_LABEL = "Unknown place visited";
const EXPLORE_ROUTE_STEP_TITLE = "Learn what the place is really for.";
const EXPLORE_ROUTE_STEP_DETAIL =
  "A new corner is usually easier to understand once you stand in it.";
const EXPLORE_ROUTE_HEADLINE = "Learn the lanes and people of South Quay.";
const COMMITTED_JOB_ROUTE_OUTCOME_LABEL_SUFFIX = "site reached";
const COMMITTED_JOB_ROUTE_STEP_DETAIL =
  "A live commitment should be the first thing Rowan can actually cash in.";
const COMMITTED_JOB_ROUTE_WINDOW_DETAIL =
  "The block only keeps a shift open for so long.";
const COMMITTED_JOB_ROUTE_HEADLINE =
  "Follow through on accepted work before the window closes.";
const REST_ROUTE_OUTCOME_LABEL = "Recovered with an hour of rest";
const REST_ROUTE_RETURN_DETAIL = "The day is asking for a pause.";
const REST_ROUTE_HOUR_DETAIL =
  "The point is to stop fighting the block long enough to get your legs back.";
const REST_ROUTE_HEADLINE =
  "Recover enough at Morrow House to move cleanly again.";
const REST_ROUTE_DEFAULT_TEXT = "Recover enough to move cleanly again.";
const ADA_LEAD_OUTCOME_MOVE_RATIONALE =
  "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room";
const BAD_ADA_AT_MORROW_PLAYER_RATIONALE =
  "Mara's lead points to Ada at Kettle & Lamp, so Rowan needs to leave Morrow House and reach the cafe first";
const ADA_AT_MORROW_ACTION_REASON =
  "Mara's lead points to Ada at Kettle & Lamp, so Rowan has to reach the cafe before asking.";
const FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE =
  "The shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE =
  "The shift paid, and Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_LOW_ENERGY_PLAYER_RATIONALE =
  "the shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land";
const FIRST_AFTERNOON_NORMAL_ENERGY_PLAYER_RATIONALE =
  "the shift paid, and Morrow House is the right place to let the day land";
const TEA_SHIFT_OUTCOME_MOVE_RATIONALE =
  "Ada gave Rowan real work, and the room needs steady hands now";
const NIA_RECOVERY_PLAYER_RATIONALE =
  "Rowan is too worn down to make Nia's lead stick, so he needs a short recovery before the block jam gets worse";
const NIA_STANDING_PLAYER_RATIONALE =
  "Jo's clue points toward Nia now, so Rowan needs South Quay before the block jam gets worse";
const MORROW_STANDING_LOW_ENERGY_PLAYER_RATIONALE =
  "Morrow House is where Rowan can let today's standing settle before he runs himself flat";
const MORROW_STANDING_NORMAL_ENERGY_PLAYER_RATIONALE =
  "Morrow House is where today's standing can turn into a steadier foothold";

function worldWithPoisonedTrail(): StreetGameState {
  const world = seedStreetGame("game-reasoning-poisoned-trail");
  const currentObjective = world.player.objective as PlayerObjective;

  world.player.currentLocationId = "boarding-house";
  world.player.knownNpcIds = Array.from(
    new Set([...world.player.knownNpcIds, "npc-mara"]),
  );
  world.player.objective = {
    ...currentObjective,
    focus: "settle",
    outcomes: [
      {
        authority: "predicate",
        id: "live-room-standing",
        label: "Ask Mara what keeps the Morrow House room stable",
        npcId: "npc-mara",
        status: "open",
        targetLocationId: "boarding-house",
        urgency: 96,
      },
    ],
    progress: {
      completed: 0,
      label: "0/1 outcomes met",
      total: 1,
    },
    trail: [
      {
        detail:
          "This poisoned route hint should stay scaffolding and must not become Rowan's plan.",
        done: false,
        id: "poisoned-route-hint",
        targetLocationId: "pier",
        title: "Follow the stale route to the old pier",
      },
    ],
  };
  world.rowanAutonomy = {
    autoContinue: true,
    detail: "Mara is here, so Rowan can ask the question in person.",
    intent: {
      reason: "Mara is here, so Rowan can ask the question in person.",
      signals: [
        "Goal: Ask Mara what keeps the Morrow House room stable",
        "Target: Morrow House",
      ],
    },
    key: "objective:talk:mara",
    label: "Talk to Mara",
    layer: "objective",
    mode: "conversation",
    npcId: "npc-mara",
    stepKind: "talk",
    targetLocationId: "boarding-house",
  };
  world.availableActions = [
    {
      description: "Ask Mara what actually keeps the room stable.",
      emphasis: "high",
      id: "talk:npc-mara",
      kind: "talk",
      label: "Talk to Mara",
      matchesObjective: true,
      targetLocationId: "boarding-house",
    },
    {
      description: "The stale route hint is not a legal current-state action.",
      disabled: true,
      disabledReason: "Rowan has no current reason to go to the old pier.",
      emphasis: "low",
      id: "move:pier",
      kind: "inspect",
      label: "Head to the old pier",
      matchesObjective: false,
      targetLocationId: "pier",
    },
  ];

  return world;
}

function worldWithStaleFirstAfternoonThoughtAndLivePump(): StreetGameState {
  const world = seedStreetGame("game-reasoning-stale-first-afternoon-thought");

  world.player.currentLocationId = "boarding-house";
  world.player.inventory.push({
    description: "A worn wrench that can handle the yard pump.",
    id: "item-wrench",
    name: "Old wrench",
  });
  world.firstAfternoon = {
    completedAt: world.currentTime,
    fieldNote: {
      createdAt: world.currentTime,
      evidence: "Rowan already finished the first afternoon route.",
      learned: "The original first-afternoon loop is complete.",
      memory: "The old route should not control later thought.",
      next: "Follow the live problem instead.",
    },
    teaShiftStage: "paid",
  };

  const pump = world.problems.find((problem) => problem.id === "problem-pump");
  if (pump) {
    pump.discovered = true;
    pump.status = "active";
  }

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
    targetLocationId: "boarding-house",
  };
  world.availableActions = [
    {
      description: "Fix the yard pump with the wrench.",
      emphasis: "high",
      id: "solve:problem-pump",
      kind: "solve",
      label: "Fix the pump",
      matchesObjective: true,
      targetLocationId: "boarding-house",
    },
  ];

  return world;
}

function worldWithActiveTeaCommitment(
  teaShiftStage: "rush" | "counter" = "rush",
): StreetGameState {
  const world = seedStreetGame("game-reasoning-active-tea-thought");
  const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");

  world.player.currentLocationId = "tea-house";
  world.player.activeJobId = "job-tea-shift";
  world.clock = {
    day: 1,
    hour: 12,
    label: "Afternoon",
    minute: 30,
    totalMinutes: 12 * 60 + 30,
  };
  world.currentTime = "2026-03-21T12:30:00.000Z";
  world.firstAfternoon = {
    teaShiftStage,
  };
  if (teaJob) {
    teaJob.accepted = true;
    teaJob.completed = false;
    teaJob.missed = false;
  }

  return world;
}

function worldWithPaidFirstAfternoonReturnThought(): StreetGameState {
  const world = seedStreetGame("game-reasoning-paid-first-afternoon-return");

  world.player.currentLocationId = "freight-yard";
  world.firstAfternoon = {
    teaShiftStage: "paid",
  };

  return world;
}

function worldWithCompletedFirstAfternoonPlayerThought(): StreetGameState {
  const world = seedStreetGame(
    "game-reasoning-completed-first-afternoon-thought",
  );

  world.firstAfternoon = {
    completedAt: world.currentTime,
  };

  return world;
}

describe("street reasoning authority", () => {
  it("keeps first-afternoon action rationale in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_PLAN_RATIONALE);
    expect(engineSource).not.toContain(FIRST_AFTERNOON_PLAN_RATIONALE);
  });

  it("keeps first-afternoon reflection action metadata in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const actionCopy of [
      FIRST_AFTERNOON_PLAN_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_PUMP_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_COMPARE_ACTION_DESCRIPTION,
      FIRST_AFTERNOON_COMPLETION_ACTION_DESCRIPTION,
    ]) {
      expect(scaffoldSource).toContain(actionCopy);
      expect(engineSource).not.toContain(actionCopy);
    }

    expect(scaffoldSource).toContain("availableActions");
    expect(engineSource).toContain("objectiveRouteAvailableActions");
  });

  it("keeps first-afternoon dialogue fallback copy in scaffold data, not dialogue control flow", () => {
    const dialogueSource = readFileSync(
      new URL("../src/ai/streetDialogue.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_DIALOGUE_FALLBACK);
    expect(dialogueSource).not.toContain(FIRST_AFTERNOON_DIALOGUE_FALLBACK);
    expect(dialogueSource).not.toContain('routeKey === "first-afternoon"');
  });

  it("keeps Mara/Ada lead-grounding copy in scaffold policy, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const groundingCopy of [
      MARA_ADA_GROUNDING_FOLLOWUP,
      MARA_ADA_GROUNDED_FALLBACK_REPLY,
      MARA_ADA_GROUNDING_FALLBACK_MEMORY,
      MARA_ADA_GROUNDING_FALLBACK_SUMMARY,
    ]) {
      expect(scaffoldSource).toContain(groundingCopy);
      expect(engineSource).not.toContain(groundingCopy);
    }

    expect(scaffoldSource).toContain("conversationGroundingPolicies");
    expect(scaffoldSource).toContain("mara-ada-lead-grounding");
    expect(engineSource).toContain("objectiveRouteConversationGroundingPolicy");
    expect(engineSource).not.toContain("groundedMaraAdaLeadReply");
    expect(engineSource).not.toContain("buildMaraAdaLeadGroundingFollowup");
    expect(engineSource).not.toContain("shouldRequireMaraAdaLeadEvidence");
  });

  it("keeps NPC first-contact primer copy in NPC narrative data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const npcNarrativesSource = readFileSync(
      new URL("../src/street-sim/npcNarratives.ts", import.meta.url),
      "utf8",
    );

    for (const primerCopy of NPC_FIRST_CONTACT_PRIMER_COPY) {
      expect(npcNarrativesSource).toContain(primerCopy);
      expect(engineSource).not.toContain(primerCopy);
    }

    expect(npcNarrativesSource).toContain("firstContactPrimer");
    expect(engineSource).toContain("getNpcFirstContactPrimer");
    expect(engineSource).not.toContain("firstContactPrimer:");
  });

  it("keeps first-afternoon return-home thought copy in scaffold data, not thought control flow", () => {
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
    expect(thoughtsSource).not.toContain(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
  });

  it("keeps first-afternoon tea-shift stage thoughts in scaffold data, not thought or engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const stageThought of [
      FIRST_AFTERNOON_TEA_RUSH_THOUGHT,
      FIRST_AFTERNOON_TEA_COUNTER_THOUGHT,
    ]) {
      expect(scaffoldSource).toContain(stageThought);
      expect(engineSource).not.toContain(stageThought);
      expect(thoughtsSource).not.toContain(stageThought);
    }
  });

  it("keeps first-afternoon completion acknowledgement copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const acknowledgementCopy of [
      FIRST_AFTERNOON_COMPLETION_FEED,
      FIRST_AFTERNOON_COMPLETION_MEMORY,
    ]) {
      expect(scaffoldSource).toContain(acknowledgementCopy);
      expect(engineSource).not.toContain(acknowledgementCopy);
    }
  });

  it("keeps first-afternoon completion player-thought copy in scaffold data, not thought control flow", () => {
    const thoughtsSource = readFileSync(
      new URL("../src/ai/streetThoughts.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    expect(scaffoldSource).toContain(FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT);
    expect(thoughtsSource).not.toContain(
      FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT,
    );
  });

  it("keeps first-afternoon completion outcome copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const outcomeCopy of [
      FIRST_AFTERNOON_COMPLETION_OUTCOME_PLAYER_THOUGHT,
      FIRST_AFTERNOON_COMPLETION_OUTCOME_FEED,
      FIRST_AFTERNOON_COMPLETION_OUTCOME_MEMORY,
    ]) {
      expect(scaffoldSource).toContain(outcomeCopy);
      expect(engineSource).not.toContain(outcomeCopy);
    }
    expect(engineSource).toContain(
      "world.player.currentThought = completionOutcome.playerThought",
    );
    expect(engineSource).toContain(
      'addFeed(world, "memory", completionOutcome.feedText)',
    );
    expect(engineSource).toContain(
      'remember(world, "self", completionOutcome.memoryText)',
    );
  });

  it("keeps outcome-label move rationale copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const outcomeMoveRationale of [
      ADA_LEAD_OUTCOME_MOVE_RATIONALE,
      FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE,
      FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE,
      TEA_SHIFT_OUTCOME_MOVE_RATIONALE,
    ]) {
      expect(scaffoldSource).toContain(outcomeMoveRationale);
    }
    expect(scaffoldSource).toContain("outcomeMoveRationales");
    expect(scaffoldSource).toContain("objectiveRouteMoveRationaleForOutcome");
    expect(engineSource).toContain("objectiveRouteMoveRationaleForOutcome");
    expect(engineSource).not.toContain("function moveRationaleForOutcome");
    expect(engineSource).not.toContain("moveRationaleForOutcome(world");
    expect(engineSource).not.toContain(
      FIRST_AFTERNOON_LOW_ENERGY_OUTCOME_MOVE_RATIONALE,
    );
    expect(engineSource).not.toContain(
      FIRST_AFTERNOON_NORMAL_ENERGY_OUTCOME_MOVE_RATIONALE,
    );
  });

  it("keeps player-facing autonomy rationale normalization copy in scaffold data, not engine control flow", () => {
    const engineSource = readFileSync(
      new URL("../src/sim/engine.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const playerFacingCopy of [
      ADA_LEAD_OUTCOME_MOVE_RATIONALE,
      BAD_ADA_AT_MORROW_PLAYER_RATIONALE,
      ADA_AT_MORROW_ACTION_REASON,
      FIRST_AFTERNOON_LOW_ENERGY_PLAYER_RATIONALE,
      FIRST_AFTERNOON_NORMAL_ENERGY_PLAYER_RATIONALE,
      TEA_SHIFT_OUTCOME_MOVE_RATIONALE,
      NIA_RECOVERY_PLAYER_RATIONALE,
      NIA_STANDING_PLAYER_RATIONALE,
      MORROW_STANDING_LOW_ENERGY_PLAYER_RATIONALE,
      MORROW_STANDING_NORMAL_ENERGY_PLAYER_RATIONALE,
    ]) {
      expect(scaffoldSource).toContain(playerFacingCopy);
      expect(engineSource).not.toContain(playerFacingCopy);
    }

    expect(scaffoldSource).toContain("playerFacingRationaleNormalizations");
    expect(scaffoldSource).toContain("actionLocationReasons");
    expect(engineSource).toContain("objectiveRoutePlayerFacingAutonomyRationale");
    expect(engineSource).toContain("objectiveRouteActionLocationReason");
  });

  it("keeps first-afternoon route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      FIRST_AFTERNOON_ROUTE_OUTCOME_LABEL,
      FIRST_AFTERNOON_ROUTE_STEP_TITLE,
      FIRST_AFTERNOON_ROUTE_STEP_DETAIL,
      FIRST_AFTERNOON_ROUTE_COMPLETION_DETAIL,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("FIRST_AFTERNOON_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("FIRST_AFTERNOON_STEP_TEMPLATES");
    expect(objectiveStateSource).toContain(
      "objectiveRouteFirstAfternoonRouteScaffold",
    );
  });

  it("keeps Mara/Ada lead route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      MARA_ADA_ROUTE_OUTCOME_LABEL,
      MARA_ADA_ROUTE_STEP_TITLE,
      MARA_ADA_ROUTE_STEP_DETAIL,
      MARA_ADA_ROUTE_COMPLETION_DETAIL,
      MARA_ADA_ROUTE_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("MARA_ADA_LEAD_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("MARA_ADA_LEAD_STEP_TEMPLATES");
    expect(objectiveStateSource).toContain(
      "objectiveRouteMaraAdaLeadRouteScaffold",
    );
    expect(objectiveStateSource).toContain('case "mara-ada-form-intent"');
  });

  it("keeps work route outcome, step, and headline metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      WORK_ROUTE_COMMIT_OUTCOME_LABEL,
      WORK_ROUTE_YARD_STEP_TITLE,
      WORK_ROUTE_TEA_STEP_DETAIL,
      WORK_ROUTE_PAY_STEP_DETAIL,
      WORK_ROUTE_TEA_HEADLINE,
      WORK_ROUTE_YARD_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("WORK_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("WORK_STEP_TEMPLATES");
    expect(objectiveStateSource).toContain("objectiveRouteWorkRouteScaffold");
    expect(objectiveStateSource).toContain('case "work-commit"');
  });

  it("keeps settle route outcome and step metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      SETTLE_ROUTE_TERMS_OUTCOME_LABEL,
      SETTLE_ROUTE_STANDING_OUTCOME_LABEL,
      SETTLE_ROUTE_LEAD_OUTCOME_LABEL,
      SETTLE_ROUTE_TERMS_STEP_TITLE_ANCHOR,
      SETTLE_ROUTE_TERMS_STEP_DETAIL,
      SETTLE_ROUTE_STANDING_STEP_DETAIL,
      SETTLE_ROUTE_YARD_STEP_TITLE,
      SETTLE_ROUTE_INCOME_STEP_TITLE,
      SETTLE_ROUTE_PEOPLE_STEP_TITLE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("SETTLE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("SETTLE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeys: ["settle-core"]');
    expect(scaffoldSource).toContain(SETTLE_ROUTE_HEADLINE);
    expect(objectiveStateSource).toContain("objectiveRouteSettleRouteScaffold");
    expect(objectiveStateSource).toContain('case "settle-standing"');
  });

  it("keeps people and explore route metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      PEOPLE_ROUTE_OUTCOME_LABEL,
      PEOPLE_ROUTE_STEP_TITLE,
      PEOPLE_ROUTE_STEP_DETAIL,
      PEOPLE_ROUTE_HEADLINE,
      EXPLORE_ROUTE_OUTCOME_LABEL,
      EXPLORE_ROUTE_STEP_TITLE,
      EXPLORE_ROUTE_STEP_DETAIL,
      EXPLORE_ROUTE_HEADLINE,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("PEOPLE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("PEOPLE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain("EXPLORE_ROUTE_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("EXPLORE_ROUTE_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["people-"]');
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["explore-"]');
    expect(objectiveStateSource).toContain("objectiveRoutePeopleRouteScaffold");
    expect(objectiveStateSource).toContain(
      "objectiveRouteExploreRouteScaffold",
    );
    expect(objectiveStateSource).toContain('case "people-talk"');
    expect(objectiveStateSource).toContain('case "explore-go"');
  });

  it("keeps committed-job and rest route metadata in scaffold data, not objective-state control flow", () => {
    const objectiveStateSource = readFileSync(
      new URL("../src/sim/objectiveState.ts", import.meta.url),
      "utf8",
    );
    const scaffoldSource = readFileSync(
      new URL("../src/sim/objectiveScaffolds.ts", import.meta.url),
      "utf8",
    );

    for (const routeCopy of [
      COMMITTED_JOB_ROUTE_OUTCOME_LABEL_SUFFIX,
      COMMITTED_JOB_ROUTE_STEP_DETAIL,
      COMMITTED_JOB_ROUTE_WINDOW_DETAIL,
      COMMITTED_JOB_ROUTE_HEADLINE,
      REST_ROUTE_OUTCOME_LABEL,
      REST_ROUTE_RETURN_DETAIL,
      REST_ROUTE_HOUR_DETAIL,
      REST_ROUTE_HEADLINE,
      REST_ROUTE_DEFAULT_TEXT,
    ]) {
      expect(scaffoldSource).toContain(routeCopy);
      expect(objectiveStateSource).not.toContain(routeCopy);
    }

    expect(scaffoldSource).toContain("COMMITTED_JOB_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("COMMITTED_JOB_STEP_TEMPLATES");
    expect(scaffoldSource).toContain("REST_OUTCOME_TEMPLATES");
    expect(scaffoldSource).toContain("REST_STEP_TEMPLATES");
    expect(scaffoldSource).toContain('routeKeyPrefixes: ["commitment-"]');
    expect(scaffoldSource).toContain('routeKeys: ["rest-home"]');
    expect(objectiveStateSource).toContain(
      "objectiveRouteCommittedJobRouteScaffold",
    );
    expect(objectiveStateSource).toContain("objectiveRouteRestRouteScaffold");
    expect(objectiveStateSource).toContain(
      'definition.id.startsWith("commitment-finish-")',
    );
    expect(objectiveStateSource).toContain('case "rest-hour"');
  });

  it("does not turn stale trail titles into Rowan's deterministic thought", () => {
    const world = worldWithPoisonedTrail();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toMatch(/Mara/i);
    expect(thoughts.playerThought).not.toMatch(
      /stale|old pier|poisoned|route/i,
    );
  });

  it("labels unfinished trail items as supporting hints in the thought prompt", () => {
    const world = worldWithPoisonedTrail();

    const prompt = buildGenerateStreetThoughtsPrompt(world);

    expect(prompt).toContain("Rowan's objective authority");
    expect(prompt).toContain("desiredOutcomes");
    expect(prompt).toContain("currentAutonomy");
    expect(prompt).toContain("supporting_hint");
    expect(prompt).toContain("supportingRouteHints");
    expect(prompt).toContain("Follow the stale route to the old pier");
    expect(prompt).not.toContain("Rowan's current plan");
    expect(prompt).not.toContain('"nextSteps"');
    expect(prompt).not.toContain('"trail"');
  });

  it("exposes conversation authority as outcomes, autonomy, and legal actions first", () => {
    const world = worldWithPoisonedTrail();

    const context = buildStreetConversationContext({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });
    const rowan = buildPlainRowanContext(context);
    const rowanText = JSON.stringify(rowan);
    const rowanRecord = rowan as Record<string, unknown>;

    expect(rowanRecord.currentPlan).toBeUndefined();
    expect(rowanText).toContain("objectiveAuthority");
    expect(rowanText).toContain("desiredOutcomes");
    expect(rowanText).toContain("openDesiredOutcomes");
    expect(rowanText).toContain(
      "Ask Mara what keeps the Morrow House room stable",
    );
    expect(rowanText).toContain("currentAutonomy");
    expect(rowanText).toContain(
      "Mara is here, so Rowan can ask the question in person.",
    );
    expect(rowanText).toContain("availableLegalActions");
    expect(rowanText).toContain("talk:npc-mara");
    expect(rowanText).toContain("supportingRouteHints");
    expect(rowanText).toContain("supporting_hint");
    expect(rowanText).toContain("Follow the stale route to the old pier");
    expect(rowanText).not.toContain("nextSteps");
  });

  it("keeps stale route hints out of authoritative dialogue prompt fields", () => {
    const world = worldWithPoisonedTrail();

    const prompt = buildGenerateStreetReplyPrompt({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });

    expect(prompt).toContain("rowan.objectiveAuthority");
    expect(prompt).toContain("currentAutonomy");
    expect(prompt).toContain("availableLegalActions");
    expect(prompt).toContain("supportingRouteHints");
    expect(prompt).toContain("supporting_hint");
    expect(prompt).toContain("Follow the stale route to the old pier");
    expect(prompt).not.toContain('"currentPlan"');
    expect(prompt).not.toContain('"nextSteps"');
    expect(prompt).not.toContain('"trail"');
  });

  it("uses the same objective authority contract for Rowan speech and conversation interpretation", () => {
    const world = worldWithPoisonedTrail();
    const objective = {
      focus: world.player.objective?.focus ?? "settle",
      routeKey: world.player.objective?.routeKey ?? "first-afternoon",
      text:
        world.player.objective?.text ?? "Ask Mara what keeps the room stable",
    };

    const autonomousPrompt = buildGenerateStreetAutonomousLinePrompt({
      game: world,
      npcId: "npc-mara",
      objective,
      purpose: "opener",
    });
    const interpretPrompt = buildInterpretStreetConversationPrompt({
      closingReply:
        "Ask Ada at Kettle & Lamp before lunch if you need work today.",
      discussedTopics: ["room", "work", "Ada"],
      game: world,
      npcId: "npc-mara",
      objective,
    });

    for (const prompt of [autonomousPrompt, interpretPrompt]) {
      expect(prompt).toContain("rowan.objectiveAuthority");
      expect(prompt).toContain("currentAutonomy");
      expect(prompt).toContain("availableLegalActions");
      expect(prompt).toContain("supportingRouteHints");
      expect(prompt).toContain("supporting_hint");
      expect(prompt).not.toContain('"currentPlan"');
      expect(prompt).not.toContain('"nextSteps"');
      expect(prompt).not.toContain('"trail"');
    }
  });

  it("does not let poisoned trail text dominate deterministic dialogue selection", () => {
    const world = worldWithPoisonedTrail();

    const reply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });

    expect(reply.reply).toMatch(
      /Ada|Kettle|Lamp|lunch|work|shift|counter|pay/i,
    );
    expect(reply.reply).not.toMatch(/old pier|poisoned|stale route/i);
  });

  it("lets a current Mara predicate outrank first-afternoon route-key fallback dialogue", () => {
    const world = worldWithPoisonedTrail();

    const reply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-mara",
      playerText: "What matters most right now?",
    });

    expect(reply.reply).toMatch(/room|Morrow House|shared spaces|pay|house/i);
    expect(reply.reply).not.toMatch(
      /Ada|Kettle|Lamp|lunch|old pier|poisoned|route/i,
    );
  });

  it("lets live autonomy and discovered problems outrank stale first-afternoon thought copy", () => {
    const world = worldWithStaleFirstAfternoonThoughtAndLivePump();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toMatch(/pump/i);
    expect(thoughts.playerThought).not.toMatch(
      /bed|tomorrow|lead|Morrow House|let today land/i,
    );
  });

  it("keeps first-afternoon cafe-stage thoughts when the tea shift is the active commitment", () => {
    const world = worldWithActiveTeaCommitment();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_TEA_RUSH_THOUGHT);
    expect(thoughts.playerThought).not.toMatch(/pump|wrench|Morrow House/i);
  });

  it("keeps first-afternoon counter-stage thoughts when the tea shift reaches the counter", () => {
    const world = worldWithActiveTeaCommitment("counter");

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_TEA_COUNTER_THOUGHT);
    expect(thoughts.playerThought).not.toMatch(/pump|wrench|Morrow House/i);
  });

  it("keeps first-afternoon return-home thought visible through scaffold data", () => {
    const world = worldWithPaidFirstAfternoonReturnThought();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(FIRST_AFTERNOON_RETURN_HOME_THOUGHT);
  });

  it("keeps completed first-afternoon player thought visible through scaffold data", () => {
    const world = worldWithCompletedFirstAfternoonPlayerThought();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toBe(
      FIRST_AFTERNOON_COMPLETION_PLAYER_THOUGHT,
    );
  });
});
