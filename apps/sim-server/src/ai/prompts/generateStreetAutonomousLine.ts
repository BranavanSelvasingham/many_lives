import type { StreetAutonomousLineRequest } from "../provider.js";
import { buildStreetConversationContext } from "../streetDialogue.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";

export function buildGenerateStreetAutonomousLinePrompt(
  input: StreetAutonomousLineRequest,
): string {
  const context = buildStreetConversationContext({
    game: input.game,
    npcId: input.npcId,
    playerText: "",
  });
  const promptContext = {
    purpose: input.purpose,
    objective: input.objective,
    rowan: {
      backstory: context.rowan.backstory,
      broadObjective: context.rowan.objective,
      objectiveState: context.rowan.objectiveState,
      currentThought: context.rowan.currentThought,
      cognition: {
        primaryNeed: context.rowan.cognition.primaryNeed,
        needs: context.rowan.cognition.needs.slice(0, 3),
        beliefs: context.rowan.cognition.beliefs.slice(0, 5),
        nextMove: context.rowan.cognition.nextMove,
      },
      memories: context.rowan.memories.slice(0, 6),
    },
    npc: {
      id: context.npc.id,
      name: context.npc.name,
      role: context.npc.role,
      summary: context.npc.summary,
      narrative: context.npc.narrative,
      currentObjective: context.npc.currentObjective,
      currentConcern: context.npc.currentConcern,
      currentThought: context.npc.currentThought,
      lastSpokenLine: context.npc.lastSpokenLine,
      trust: context.npc.trust,
      openness: context.npc.openness,
    },
    scene: context.scene,
    recentConversation: context.recentConversation,
    thread: {
      decision: context.thread.decision,
      objectiveText: context.thread.objectiveText,
      summary: context.thread.summary,
      turnCount: context.thread.turnCount,
    },
    lastNpcReply: input.lastNpcReply ?? null,
    time: context.time,
  };

  return [
    "Write one short spoken line for Rowan in a live AI-agent social simulation.",
    "Return strict JSON only with this shape:",
    '{"speech":"..."}',
    "Rules:",
    "- Write Rowan's actual spoken line only.",
    "- Use first person singular and present tense.",
    "- 1 to 2 short sentences maximum.",
    "- This is not UI copy, not a quest label, and not a planner summary.",
    "- Make Rowan sound like a person actively interpreting the world, the other agent, and the next useful opening.",
    "- Let the line reveal what Rowan is trying to learn, test, confirm, or narrow down right now.",
    "- If purpose is opener, make Rowan arrive with a real pressure and a clear question or angle.",
    "- If purpose is followup, build directly on the NPC's last reply and push toward a sharper read of what changes next.",
    "- Avoid canned tutorial phrasing, generic 'where should I go' filler, or overly broad life-story speeches.",
    "- Keep it grounded, direct, and natural to South Quay.",
    ...buildStreetVoicePromptLines(),
    `Context: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}
