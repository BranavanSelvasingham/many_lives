import { describe, expect, it } from "vitest";

import { MockAIProvider } from "../src/ai/mockProvider.js";
import type { StreetDialogueRequest } from "../src/ai/streetDialogue.js";
import { buildGenerateStreetReplyPrompt } from "../src/ai/prompts/generateStreetReply.js";
import { buildDeterministicStreetReply } from "../src/ai/streetDialogue.js";
import { SimulationEngine } from "../src/sim/engine.js";
import {
  objectiveRouteConversationGroundingPolicy,
  objectiveRouteConversationHasVisibleEvidence,
  objectiveRouteTextAffirmsConversationPolicy,
  objectiveRouteTextGroundsConversationPolicy,
} from "../src/sim/objectiveScaffolds.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import { enterMorrowHouse } from "./street-test-helpers.js";

const MARA_ADA_GROUNDING_FOLLOWUP =
  "Just to be clear, should I ask Ada at Kettle & Lamp about lunch work before the rush?";
const MARA_ADA_GROUNDED_FALLBACK_REPLY =
  "Morrow House can hold you tonight, but a foothold needs work. Ask Ada at Kettle & Lamp before lunch; she may need steady hands for the cup-and-counter shift.";
const MARA_ADA_REQUIRED_PROMPT_LINE =
  "- Required for this Mara reply: visibly ground the work lead by naming Ada, Kettle & Lamp, and lunch work, shift, hands, counter, or pay.";
const MARA_ADA_PROMPT_OVERRIDE_LINE =
  "- This requirement overrides the general route-command caution; the player must see the Ada/Kettle & Lamp/lunch-work evidence before the sim can treat the lead as real.";
const MARA_ADA_GROUNDED_PROMPT_LINE =
  "- Rowan's line already names the exact Ada/Kettle & Lamp/lunch-work lead. Answer plainly whether Mara confirms it.";

class UngroundedMaraReplyProvider extends MockAIProvider {
  override readonly name = "openai";
  readonly replyRequests: StreetDialogueRequest[] = [];

  override async generateStreetReply(input: StreetDialogueRequest) {
    this.replyRequests.push(input);

    return {
      followupThought: "Mara keeps the answer too broad.",
      reply: "Keep the house easy, pay when you say you will, and do not vanish.",
    };
  }
}

describe("street dialogue fallback", () => {
  it("has Rowan ask Tomas a specific followup after a yard offer", async () => {
    const provider = new MockAIProvider();
    const world = seedStreetGame("game-tomas-followup-line");

    const line = await provider.generateStreetAutonomousLine({
      game: world,
      lastNpcReply:
        "The yard needs another set of hands for a short run. Twenty-four if you are ready.",
      npcId: "npc-tomas",
      objective: {
        focus: "work",
        routeKey: "work-yard",
        text: "Take the freight yard lift before the window closes.",
      },
      purpose: "followup",
    });

    expect(line.speech).toMatch(/what exactly/i);
    expect(line.speech).toMatch(/move first/i);
  });

  it("makes Tomas answer practical next-step questions directly", () => {
    const world = seedStreetGame("game-tomas-direct-answer");
    world.player.x = 18;
    world.player.y = 10;
    world.player.currentLocationId = "freight-yard";
    world.player.knownNpcIds.push("npc-tomas");
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.discovered = true;
    }

    const reply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-tomas",
      playerText: "If I take it, what exactly do you need me to move first?",
    });

    expect(reply.reply).toMatch(/crates?|cart lane|bay|twenty-four/i);
    expect(reply.reply).not.toMatch(/moving feet are friendlier/i);
    expect(reply.reply).not.toMatch(/making a ceremony/i);
    expect(reply.reply).not.toMatch(/prove|earn the softer|helpful thing/i);
  });

  it("preserves scaffold-owned Jo tool and Nia cart problem-route replies", () => {
    const world = seedStreetGame("game-problem-route-dialogue");

    const joSellReply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-jo",
      playerText: "What tool actually helps with the pump repair?",
    });
    expect(joSellReply.reply).toMatch(/wrench/i);
    expect(joSellReply.reply).toMatch(/eight coins/i);

    world.player.inventory.push({
      description: "A worn wrench that can handle the yard pump.",
      id: "item-wrench",
      name: "Old wrench",
    });
    const joOwnedReply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-jo",
      playerText: "I have the wrench. How should I handle the pump?",
    });
    expect(joOwnedReply.reply).toMatch(/wrench|pump/i);
    expect(joOwnedReply.reply).not.toMatch(/eight coins/i);

    const cartProblem = world.problems.find(
      (problem) => problem.id === "problem-cart",
    );
    if (cartProblem) {
      cartProblem.status = "active";
    }
    const niaActiveReply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-nia",
      playerText: "Can I help with the cart in the square?",
    });
    expect(niaActiveReply.reply).toMatch(/cart|square/i);

    if (cartProblem) {
      cartProblem.status = "solved";
    }
    const niaSolvedReply = buildDeterministicStreetReply({
      game: world,
      npcId: "npc-nia",
      playerText: "Can I help with the cart in the square?",
    });
    expect(niaSolvedReply.reply).toMatch(/clear|gone|loosened|lighter/i);
  });

  it("requires live Mara first-afternoon replies to ground the Ada work lead", () => {
    const world = seedStreetGame("game-mara-live-grounding-prompt");

    const prompt = buildGenerateStreetReplyPrompt({
      game: world,
      npcId: "npc-mara",
      playerText:
        "I'm Rowan. New here. What should I do first if I want to keep the room and find honest work?",
    });

    expect(prompt).toContain(MARA_ADA_REQUIRED_PROMPT_LINE);
    expect(prompt).toContain(MARA_ADA_PROMPT_OVERRIDE_LINE);
    expect(prompt).toContain("Ada");
    expect(prompt).toContain("Kettle & Lamp");
    expect(prompt).toMatch(/lunch work|shift|counter|pay/i);
  });

  it("tells live Mara to plainly confirm Rowan's grounded Ada follow-up", () => {
    const world = seedStreetGame("game-mara-live-followup-grounding-prompt");

    const prompt = buildGenerateStreetReplyPrompt({
      game: world,
      npcId: "npc-mara",
      playerText:
        "Just to be clear, should I ask Ada at Kettle & Lamp about lunch work before the rush?",
    });

    expect(prompt).toContain(MARA_ADA_GROUNDED_PROMPT_LINE);
    expect(prompt).toContain("clearly affirm that exact lead");
    expect(prompt).toContain("Exactly. She'll need steady hands before lunch.");
  });

  it("does not add Mara/Ada grounding prompt lines outside the scaffold policy match", () => {
    const broadQuestion =
      "I'm Rowan. New here. What should I do first if I want to keep the room and find honest work?";
    const cases: Array<{
      label: string;
      npcId: string;
      playerText: string;
      configure?: (world: ReturnType<typeof seedStreetGame>) => void;
    }> = [
      {
        label: "non-Mara speaker",
        npcId: "npc-ada",
        playerText: broadQuestion,
      },
      {
        configure: (world) => {
          if (world.player.objective) {
            world.player.objective = {
              ...world.player.objective,
              routeKey: "work-yard",
            };
          }
        },
        label: "non-first-afternoon objective",
        npcId: "npc-mara",
        playerText: broadQuestion,
      },
      {
        label: "pump-specific question",
        npcId: "npc-mara",
        playerText:
          "Before work, should I focus on the pump leak and find a wrench for the repair?",
      },
    ];

    for (const testCase of cases) {
      const world = seedStreetGame(`game-mara-grounding-negative-${testCase.label}`);
      testCase.configure?.(world);

      const prompt = buildGenerateStreetReplyPrompt({
        game: world,
        npcId: testCase.npcId,
        playerText: testCase.playerText,
      });

      expect(prompt, testCase.label).not.toContain(MARA_ADA_REQUIRED_PROMPT_LINE);
      expect(prompt, testCase.label).not.toContain(MARA_ADA_PROMPT_OVERRIDE_LINE);
      expect(prompt, testCase.label).not.toContain(MARA_ADA_GROUNDED_PROMPT_LINE);
    }
  });

  it("keeps Mara/Ada grounding follow-up and fallback behavior in scaffold policy", async () => {
    const provider = new UngroundedMaraReplyProvider();
    const engine = new SimulationEngine(provider);
    const world = await engine.createGame("game-mara-grounding-policy");
    const conversationWorld = await enterMorrowHouse(engine, world);
    const mara = conversationWorld.npcs.find((npc) => npc.id === "npc-mara");

    expect(mara).toBeDefined();
    const policy = objectiveRouteConversationGroundingPolicy(
      conversationWorld,
      conversationWorld.player.objective,
      mara!,
      "What should I do first if I want to keep the room and find honest work?",
    );

    expect(policy?.followupPlayerText).toBe(MARA_ADA_GROUNDING_FOLLOWUP);
    expect(policy?.fallbackReply.reply).toBe(MARA_ADA_GROUNDED_FALLBACK_REPLY);
    expect(
      objectiveRouteTextGroundsConversationPolicy(
        policy,
        MARA_ADA_GROUNDED_FALLBACK_REPLY,
      ),
    ).toBe(true);
    expect(
      objectiveRouteTextAffirmsConversationPolicy(
        policy,
        "Exactly. She'll need steady hands before lunch.",
      ),
    ).toBe(true);

    const nextWorld = await engine.runCommand(conversationWorld, {
      npcId: "npc-mara",
      text: "What should I do first if I want to keep the room and find honest work?",
      type: "speak",
    });

    expect(provider.replyRequests.map((request) => request.playerText)).toEqual(
      [
        "What should I do first if I want to keep the room and find honest work?",
        MARA_ADA_GROUNDING_FOLLOWUP,
      ],
    );
    expect(nextWorld.conversations.map((entry) => entry.text)).toEqual(
      expect.arrayContaining([
        MARA_ADA_GROUNDING_FOLLOWUP,
        MARA_ADA_GROUNDED_FALLBACK_REPLY,
      ]),
    );
    expect(
      objectiveRouteConversationHasVisibleEvidence(
        nextWorld,
        policy,
        MARA_ADA_GROUNDED_FALLBACK_REPLY,
      ),
    ).toBe(true);
    expect(nextWorld.firstAfternoon?.planSettledAt).toBeDefined();
  });
});
