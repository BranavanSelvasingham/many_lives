import type { StreetDialogueRequest } from "../streetDialogue.js";
import { buildStreetConversationContext } from "../streetDialogue.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";
import {
  buildPlainConversationContext,
  buildPlainOpenPossibilitiesContext,
  buildPlainPersonContext,
  buildPlainPlaceContext,
  buildPlainRowanContext,
} from "./plainStreetConversationContext.js";

export function buildGenerateStreetReplyPrompt(
  input: StreetDialogueRequest,
): string {
  const context = buildStreetConversationContext(input);
  const promptContext = {
    placeAndTime: buildPlainPlaceContext(context),
    rowan: buildPlainRowanContext(context),
    personRowanIsTalkingTo: buildPlainPersonContext(context),
    conversationSoFar: buildPlainConversationContext(context),
    openPossibilities: buildPlainOpenPossibilitiesContext(input.game),
  };

  return [
    "Write a very short reply from the person Rowan is talking to.",
    "Return strict JSON only with this shape:",
    '{"reply":"...","followupThought":"..."}',
    "Rules:",
    "- reply must be 1 to 3 short sentences, spoken dialogue only.",
    "- followupThought must be 2 to 10 words in first person singular.",
    "- No markdown, no stage directions, no quotation marks inside JSON values, no emojis.",
    "- End on a complete thought; never trail off mid-sentence.",
    "- The reply must sound like this person is speaking directly to Rowan right now.",
    "- Rowan's line has already been said. Do not continue Rowan's sentence, do not rewrite Rowan's line, and do not speak as Rowan.",
    "- When the person refers to themself, use first person: I, me, my, we, us, our.",
    "- Do not have the person say their own name as if a narrator is describing them.",
    "- Answer like a normal local person, not like a game hint.",
    "- Use plain contemporary English. Do not use dialect spellings or stagey old-time words like aye, lass, laddie, ye, sirrah, or milord.",
    "- Do not write menu text, task labels, or checklist instructions.",
    "- Do not start with route commands like 'Talk to Mara', 'Get to Kettle & Lamp', or 'Keep moving'.",
    "- Stay grounded in the current place and what is happening nearby.",
    "- Keep the tone relaxed, warm, and lightly encouraging: practical without sounding severe.",
    "- Let the reply show what this person notices about Rowan and the neighborhood.",
    "- Do not make every reply sound like a test Rowan has to pass. A reply can still be firm while showing a little patience, humor, or ordinary care.",
    "- Prefer lived-in specificity over slogans: cups cooling, sea air in the doorway, a pump complaining, a cart in the square, lunch drifting in.",
    "- Do not invent props or procedures that are not in context. For work at Kettle & Lamp, stick to cups, tables, the counter, lunch, tea, and pay unless the context says otherwise.",
    "- Use the place details as background. Do not explain the setting unless the line needs it.",
    "- If Rowan asks something broad, answer briefly and steer toward what matters nearby.",
    "- If Rowan asks what to do first, what is helpful, or whether work is available, answer with the specific next action, place, pay, timing, or condition before adding personality.",
    "- When it fits, include one concrete thing Rowan could do next.",
    "- Treat Rowan as new to Brackenport: a place to stay, steady income, and a few real friends matter underneath most questions, but do not make every answer heavy.",
    "- Use Rowan's current goal, needs, and likely next move as background only. The line should still sound like casual speech.",
    "- Use conversationSoFar so the person does not repeat themself.",
    "- Let time of day, open windows, nearby places, and unresolved local problems shape what sounds urgent right now.",
    "- Do not repeat the same phrasing as recent lines; vary wording, opening, and closing across turns.",
    "- If the same topic returns, advance it with a new detail, a narrower question, or a concrete next step.",
    ...buildStreetVoicePromptLines(),
    `Context in plain English: ${JSON.stringify(promptContext)}`,
    `Rowan says: ${input.playerText}`,
    "Use the person's background, voice, and what is on their mind as quiet guidance.",
  ].join("\n");
}
