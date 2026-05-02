import type { StreetConversationInterpretationRequest } from "../provider.js";
import { buildStreetConversationContext } from "../streetDialogue.js";
import {
  buildPlainConversationContext,
  buildPlainPersonContext,
  buildPlainPlaceContext,
  buildPlainRowanContext,
} from "./plainStreetConversationContext.js";

export function buildInterpretStreetConversationPrompt(
  input: StreetConversationInterpretationRequest,
): string {
  const context = buildStreetConversationContext({
    game: input.game,
    npcId: input.npcId,
    playerText: "",
  });
  const promptContext = {
    rowanCurrentGoal: {
      goal: input.objective.text,
      kind: input.objective.focus,
    },
    placeAndTime: buildPlainPlaceContext(context),
    rowan: buildPlainRowanContext(context),
    personRowanTalkedTo: buildPlainPersonContext(context),
    conversationSoFar: buildPlainConversationContext(context),
    closingReply: input.closingReply,
    topicsMentioned: input.discussedTopics,
  };

  return [
    "Read the conversation that just ended and summarize what changed.",
    "Return strict JSON only with this shape:",
    '{"decision":"...","objectiveText":"...","summary":"...","memoryKind":"self","memoryText":"...","npcImpression":"..."}',
    "Rules:",
    "- Do not write more dialogue.",
    "- Base the output on the actual exchange, what is already known, and the current place. Do not invent new jobs, items, promises, or facts.",
    "- `decision` is Rowan's clearest takeaway in natural language. Leave it empty if nothing became clearer.",
    "- `objectiveText` is optional, but include it whenever the exchange changes where Rowan should go next, who he should check in with, which opening matters now, or what small favor would help.",
    "- When you set `objectiveText`, make it sound like Rowan's next practical goal.",
    "- Keep `objectiveText` concise: one sentence or sentence fragment Rowan could carry as his live objective, ideally under 18 words.",
    "- If the decision points Rowan toward a specific person or place, let `objectiveText` explain why that contact or location matters instead of only repeating 'talk to X next'.",
    "- `summary` should explain what changed in this exchange in one natural sentence.",
    "- `memoryKind` must be one of place, person, job, problem, or self when `memoryText` is present.",
    "- `memoryText` should capture a durable thing Rowan learned or realized from the exchange.",
    "- `npcImpression` should capture how this person now reads Rowan in one short sentence.",
    "- Prefer simple human changes: what Rowan learned, what matters next, and how the other person now feels about him.",
    "- Avoid tutorial tone, UI labels, and generic filler like 'talk to X next' unless that really is the clearest concrete takeaway.",
    `Context in plain English: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}
