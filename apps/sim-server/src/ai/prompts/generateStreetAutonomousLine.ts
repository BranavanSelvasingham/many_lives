import type { StreetAutonomousLineRequest } from "../provider.js";
import { buildStreetConversationContext } from "../streetDialogue.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";
import {
  buildPlainConversationContext,
  buildPlainPersonContext,
  buildPlainPlaceContext,
  buildPlainRowanContext,
} from "./plainStreetConversationContext.js";

export function buildGenerateStreetAutonomousLinePrompt(
  input: StreetAutonomousLineRequest,
): string {
  const context = buildStreetConversationContext({
    game: input.game,
    npcId: input.npcId,
    playerText: "",
  });
  const promptContext = {
    whyRowanIsSpeaking:
      input.purpose === "opener"
        ? "Rowan is starting this conversation."
        : "Rowan is following up on what the other person just said.",
    rowanCurrentGoal: {
      goal: input.objective.text,
      kind: input.objective.focus,
    },
    placeAndTime: buildPlainPlaceContext(context),
    rowan: buildPlainRowanContext(context),
    personRowanIsTalkingTo: buildPlainPersonContext(context),
    conversationSoFar: buildPlainConversationContext(context),
    lastThingTheySaid: input.lastNpcReply ?? null,
  };

  return [
    "Write one short line for Rowan to say out loud.",
    "Return strict JSON only with this shape:",
    '{"speech":"..."}',
    "Rules:",
    "- Write Rowan's actual spoken line only.",
    "- Use first person singular and present tense.",
    "- 1 to 2 short sentences maximum.",
    "- This is not menu text, not a task label, and not a summary.",
    "- Make Rowan sound like a person trying to understand the neighborhood without making the moment too heavy.",
    "- Use plain contemporary English. No dialect, old-time phrasing, ornate metaphors, or stagey local color.",
    "- Rowan can be open about being new, but keep him observant and respectful rather than needy or generic.",
    "- Let the line reveal what Rowan is trying to learn, confirm, or narrow down right now.",
    "- If purpose is opener, give Rowan a real need and a clear, easy question.",
    "- If this is a followup, build directly on the last reply and ask a simple next question. Prefer specific followups like what should I move first, when does it start, or what are you paying over vague helpfulness.",
    "- Avoid canned tutorial phrasing, generic 'where should I go' filler, or overly broad life-story speeches.",
    "- Do not invent props or procedures. Ask about the actual work, person, place, pay, or timing already in context.",
    "- Keep it grounded, direct, and natural to South Quay.",
    ...buildStreetVoicePromptLines(),
    `Context in plain English: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}
