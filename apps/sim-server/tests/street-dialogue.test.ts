import { describe, expect, it } from "vitest";

import { MockAIProvider } from "../src/ai/mockProvider.js";
import { buildDeterministicStreetReply } from "../src/ai/streetDialogue.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";

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
});
