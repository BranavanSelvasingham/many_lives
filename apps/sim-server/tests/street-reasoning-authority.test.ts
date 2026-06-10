import { describe, expect, it } from "vitest";

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
import type { PlayerObjective, StreetGameState } from "../src/street-sim/types.js";

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

describe("street reasoning authority", () => {
  it("does not turn stale trail titles into Rowan's deterministic thought", () => {
    const world = worldWithPoisonedTrail();

    const thoughts = buildDeterministicStreetThoughts(world);

    expect(thoughts.playerThought).toMatch(/Mara/i);
    expect(thoughts.playerThought).not.toMatch(/stale|old pier|poisoned|route/i);
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
    expect(rowanText).toContain("Ask Mara what keeps the Morrow House room stable");
    expect(rowanText).toContain("currentAutonomy");
    expect(rowanText).toContain("Mara is here, so Rowan can ask the question in person.");
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
      text: world.player.objective?.text ?? "Ask Mara what keeps the room stable",
    };

    const autonomousPrompt = buildGenerateStreetAutonomousLinePrompt({
      game: world,
      npcId: "npc-mara",
      objective,
      purpose: "opener",
    });
    const interpretPrompt = buildInterpretStreetConversationPrompt({
      closingReply: "Ask Ada at Kettle & Lamp before lunch if you need work today.",
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

    expect(reply.reply).toMatch(/Ada|Kettle|Lamp|lunch|work|shift|counter|pay/i);
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
    expect(reply.reply).not.toMatch(/Ada|Kettle|Lamp|lunch|old pier|poisoned|route/i);
  });
});
