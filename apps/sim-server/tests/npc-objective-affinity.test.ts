import { describe, expect, it } from "vitest";

import { scoreNpcForObjectiveAffinity } from "../src/sim/npcObjectiveAffinity.js";
import type { NpcState, ObjectiveFocus } from "../src/street-sim/types.js";

function scoreNpc(
  npcId: string,
  objectiveFocus: ObjectiveFocus,
  objectiveText: string,
  options: Partial<{
    allowImmediateFollowup: boolean;
    known: boolean;
    minutesSinceConversation: number;
    playerConversationCount: number;
    totalNpcCount: number;
    uniqueNpcConversations: number;
  }> = {},
) {
  return scoreNpcForObjectiveAffinity({
    allowImmediateFollowup: options.allowImmediateFollowup ?? false,
    minutesSinceConversation:
      options.minutesSinceConversation ?? Number.POSITIVE_INFINITY,
    npc: {
      id: npcId,
      known: options.known ?? true,
    } satisfies Pick<NpcState, "id" | "known">,
    objectiveFocus,
    objectiveText,
    playerConversationCount: options.playerConversationCount ?? 2,
    totalNpcCount: options.totalNpcCount ?? 5,
    uniqueNpcConversations: options.uniqueNpcConversations ?? 5,
  });
}

describe("NPC objective affinity scoring", () => {
  it("keeps representative NPC focus and topic affinity weights stable", () => {
    expect(scoreNpc("npc-mara", "settle", "Understand the room terms.")).toBe(
      16,
    );
    expect(
      scoreNpc("npc-ada", "work", "Get to Kettle & Lamp before the rush."),
    ).toBe(22);
    expect(
      scoreNpc("npc-tomas", "work", "Ask about the North Crane yard bays."),
    ).toBe(24);
    expect(scoreNpc("npc-jo", "tool", "Buy a wrench for the pump.")).toBe(45);
    expect(scoreNpc("npc-nia", "help", "Clear the jammed cart.")).toBe(26);
  });

  it("preserves first-contact novelty scoring for people objectives", () => {
    expect(
      scoreNpc("npc-nia", "people", "Meet another local.", {
        known: false,
        playerConversationCount: 0,
        uniqueNpcConversations: 0,
      }),
    ).toBe(46);
  });

  it("preserves recent-conversation penalties and immediate follow-up relief", () => {
    expect(
      scoreNpc("npc-mara", "settle", "Ask Mara about the room.", {
        minutesSinceConversation: 9,
        playerConversationCount: 2,
      }),
    ).toBe(-40);
    expect(
      scoreNpc("npc-mara", "settle", "Ask Mara about the room.", {
        allowImmediateFollowup: true,
        minutesSinceConversation: 9,
        playerConversationCount: 2,
      }),
    ).toBe(12);
    expect(
      scoreNpc("npc-mara", "settle", "Ask Mara about the room.", {
        minutesSinceConversation: 45,
        playerConversationCount: 2,
      }),
    ).toBe(8);
  });
});
