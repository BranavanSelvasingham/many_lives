import type { StreetDialogueRequest } from "../streetDialogue.js";
import { buildStreetConversationContext } from "../streetDialogue.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";

export function buildGenerateStreetReplyPrompt(
  input: StreetDialogueRequest,
): string {
  const context = buildStreetConversationContext(input);
  const promptContext = {
    city: context.city,
    district: context.district,
    scene: context.scene,
    nearbyPlaces: context.nearbyPlaces.map((place) => ({
      id: place.id,
      name: place.name,
      type: place.type,
      neighborhood: place.neighborhood,
      context: place.context,
    })),
    nearbyLandmarks: context.nearbyLandmarks.map((landmark) => ({
      id: landmark.id,
      text: landmark.text,
      tone: landmark.tone,
      context: landmark.context,
    })),
    rowan: {
      name: context.rowan.name,
      backstory: context.rowan.backstory,
      broadObjective: context.rowan.objective,
      objectiveState: context.rowan.objectiveState,
      currentThought: context.rowan.currentThought,
      money: context.rowan.money,
      energy: context.rowan.energy,
      cognition: {
        primaryNeed: context.rowan.cognition.primaryNeed,
        needs: context.rowan.cognition.needs.slice(0, 3),
        beliefs: context.rowan.cognition.beliefs.slice(0, 5),
        nextMove: context.rowan.cognition.nextMove,
      },
      memories: context.rowan.memories,
    },
    npc: context.npc,
    thread: {
      decision: context.thread.decision,
      objectiveText: context.thread.objectiveText,
      summary: context.thread.summary,
      turnCount: context.thread.turnCount,
    },
    recentConversation: context.recentConversation,
    liveLeads: {
      jobs: input.game.jobs
        .filter((job) => job.discovered && !job.completed && !job.missed)
        .map((job) => ({
          id: job.id,
          title: job.title,
          locationId: job.locationId,
          accepted: job.accepted,
          startHour: job.startHour,
          endHour: job.endHour,
        })),
      problems: input.game.problems
        .filter((problem) => problem.discovered && problem.status === "active")
        .map((problem) => ({
          id: problem.id,
          title: problem.title,
          locationId: problem.locationId,
          urgency: problem.urgency,
        })),
    },
    time: context.time,
  };

  return [
    "Write a very short in-character reply for a grounded street-level city sim.",
    "Return strict JSON only with this shape:",
    '{"reply":"...","followupThought":"..."}',
    "Rules:",
    "- reply must be 1 to 3 short sentences, spoken dialogue only.",
    "- followupThought must be 2 to 10 words in first person singular.",
    "- No markdown, no stage directions, no quotation marks inside JSON values, no emojis.",
    "- End on a complete thought; never trail off mid-sentence.",
    "- The reply must sound like the NPC is speaking directly to Rowan right now.",
    "- Rowan's line has already been said. Do not continue Rowan's sentence, do not rewrite Rowan's line, and do not speak as Rowan.",
    "- When the NPC refers to themself, use first person: I, me, my, we, us, our.",
    "- Do not refer to the speaking NPC by their own proper name as if an outside narrator is describing them.",
    "- Treat this as agent-to-agent simulation, not authored quest dialogue: the NPC should answer from what they know, notice, suspect, and care about.",
    "- Do not write UI copy, task labels, or objective-summary language like an external planner.",
    "- Never answer with checklist or routing language like 'Talk to Mara', 'Get to Kettle & Lamp', 'Keep moving', or other internal next-step phrasing.",
    "- Stay grounded, local, and specific to the block.",
    "- Keep the tone practical and lightly encouraging: honest about pressure, never theatrically bleak.",
    "- Let the NPC reveal their model of Rowan and the block through the reply: who seems useful, what feels risky, what timing matters, what is still uncertain.",
    "- Treat the city, district, and place context as lived-in memory, not exposition dumps.",
    "- If Rowan asks something broad, answer briefly and steer toward what matters nearby.",
    "- Whenever possible, include one concrete, workable path forward in the reply.",
    "- Treat Rowan as new to Brackenport: a place to stay, steady income, and a few real friends are the pressure underneath most questions.",
    "- Use Rowan's current objective state, needs, beliefs, and next move as inner pressure, not as planner jargon. Respond like a local person hearing what he is really trying to solve.",
    "- Use the per-NPC thread as the living conversation history.",
    "- Let time of day, open windows, nearby places, and unresolved local problems shape what sounds urgent right now.",
    "- Do not repeat the same phrasing as the recent thread; vary wording, opening, and closing across turns.",
    "- If the same topic returns, advance it with a new detail, a narrower question, or a concrete next step.",
    ...buildStreetVoicePromptLines(),
    `Context: ${JSON.stringify(promptContext)}`,
    `Rowan says: ${input.playerText}`,
    "Treat the narrative profile as fixed backstory and the currentConcern as the live scene state.",
  ].join("\n");
}
