import type { StreetConversationInterpretationRequest } from "../provider.js";
import { buildStreetConversationContext } from "../streetDialogue.js";

export function buildInterpretStreetConversationPrompt(
  input: StreetConversationInterpretationRequest,
): string {
  const context = buildStreetConversationContext({
    game: input.game,
    npcId: input.npcId,
    playerText: "",
  });
  const promptContext = {
    objective: input.objective,
    rowan: {
      backstory: context.rowan.backstory,
      broadObjective: context.rowan.objective,
      objectiveState: context.rowan.objectiveState,
      currentThought: context.rowan.currentThought,
      cognition: context.rowan.cognition,
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
    closingReply: input.closingReply,
    discussedTopics: input.discussedTopics,
    time: context.time,
  };

  return [
    "Interpret a just-finished conversation beat for a live AI-agent street simulation.",
    "Return strict JSON only with this shape:",
    '{"decision":"...","objectiveText":"...","summary":"...","memoryKind":"self","memoryText":"...","npcImpression":"..."}',
    "Rules:",
    "- This is simulation state interpretation, not dialogue writing.",
    "- Base the output on the actual exchange, current world state, and known leads. Do not invent new jobs, items, promises, or facts.",
    "- `decision` is Rowan's clearest immediate takeaway in natural language. Leave it empty if the exchange did not sharpen one.",
    "- `objectiveText` is optional, but include it whenever the exchange changes where Rowan should go next, who he should test, which opening matters now, or what proof he needs to show.",
    "- When you set `objectiveText`, translate the concrete takeaway into Rowan's live objective in a way that preserves the underlying pressure: room, work, trust, tools, or fixing a problem.",
    "- Keep `objectiveText` concise: one sentence or sentence fragment Rowan could carry as his live objective, ideally under 18 words.",
    "- If the decision points Rowan toward a specific person or place, let `objectiveText` explain why that contact or location matters instead of only repeating 'talk to X next'.",
    "- `summary` should explain what changed in this exchange in one natural sentence.",
    "- `memoryKind` must be one of place, person, job, problem, or self when `memoryText` is present.",
    "- `memoryText` should capture a durable thing Rowan learned or realized from the exchange.",
    "- `npcImpression` should capture how this NPC now reads Rowan in one short sentence.",
    "- Prefer outputs that show agents updating beliefs, priorities, trust, or timing pressure rather than receiving quest text.",
    "- Avoid tutorial tone, UI labels, and generic filler like 'talk to X next' unless that really is the clearest concrete takeaway.",
    `Context: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}
