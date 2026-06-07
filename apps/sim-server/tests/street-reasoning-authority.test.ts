import { describe, expect, it } from "vitest";

import { buildGenerateStreetThoughtsPrompt } from "../src/ai/prompts/generateStreetThoughts.js";
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
    expect(prompt).toContain("supportingRouteHints");
    expect(prompt).toContain("Follow the stale route to the old pier");
    expect(prompt).not.toContain("Rowan's current plan");
    expect(prompt).not.toContain('"nextSteps"');
    expect(prompt).not.toContain('"trail"');
  });

  it("exposes conversation current plan as outcomes first and route hints second", () => {
    const world = worldWithPoisonedTrail();

    const context = buildStreetConversationContext({
      game: world,
      npcId: "npc-mara",
      playerText:
        "What should I do first if I want to keep the room and find honest work?",
    });
    const rowan = buildPlainRowanContext(context);
    const planText = JSON.stringify(rowan.currentPlan);

    expect(planText).toContain("desiredOutcomes");
    expect(planText).toContain("openDesiredOutcomes");
    expect(planText).toContain("Ask Mara what keeps the Morrow House room stable");
    expect(planText).toContain("supportingRouteHints");
    expect(planText).toContain("Follow the stale route to the old pier");
    expect(planText).not.toContain("nextSteps");
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
});
