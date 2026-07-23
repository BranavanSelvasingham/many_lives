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
    authorityAtClose: buildConversationAuthorityAtClose(input),
  };

  return [
    "Read the conversation that just ended and summarize what changed.",
    "Return strict JSON only with this shape:",
    '{"decision":"...","objectiveText":"...","summary":"...","memoryKind":"self","memoryText":"...","npcImpression":"..."}',
    "Rules:",
    "- Do not write more dialogue.",
    "- Base the output on the actual exchange, what is already known, and the current place. Do not invent new jobs, items, promises, or facts.",
    "- Treat authorityAtClose as hard current-state evidence. The speaker may only make commitments supported by their profile, scheduled places, owned work, the actual exchange, desired outcomes, and available legal actions.",
    "- Do not assign another place's prices, room terms, appointments, or operating responsibilities to the speaker. A referral is not authority to promise on someone else's behalf.",
    "- A clock time without an explicit future day means the current day. Do not turn a time that has already passed into a current appointment or next goal; describe it as missed/closed or leave objectiveText empty.",
    "- Do not describe a completed, missed, closed, unavailable, or unscheduled opening as current.",
    "- `decision` is Rowan's clearest takeaway in natural language. Leave it empty if nothing became clearer.",
    "- `objectiveText` is optional, but include it whenever the exchange changes where Rowan should go next, who he should check in with, which opening matters now, or what small favor would help.",
    "- When you set `objectiveText`, make it sound like Rowan's next practical goal.",
    "- Keep `objectiveText` concise: one sentence or sentence fragment Rowan could carry as his live objective, ideally under 18 words.",
    "- If the decision points Rowan toward a specific person or place, let `objectiveText` explain why that contact or location matters instead of only repeating 'talk to X next'.",
    "- Use rowan.objectiveAuthority, currentAutonomy, availableLegalActions, and the actual exchange as the authority for what changed.",
    "- Treat supportingRouteHints and recentlyFinishedHints as optional scaffolding only. Do not summarize an old route hint as the live decision if the conversation and legal actions point elsewhere.",
    "- `summary` should explain what changed in this exchange in one natural sentence.",
    "- `memoryKind` must be one of place, person, job, problem, or self when `memoryText` is present.",
    "- `memoryText` should capture a durable thing Rowan learned or realized from the exchange.",
    "- `npcImpression` should capture how this person now reads Rowan in one short sentence.",
    "- Prefer simple human changes: what Rowan learned, what matters next, and how the other person now feels about him.",
    "- Avoid tutorial tone, UI labels, and generic filler like 'talk to X next' unless that really is the clearest concrete takeaway.",
    `Context in plain English: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}

function buildConversationAuthorityAtClose(
  input: StreetConversationInterpretationRequest,
) {
  const npc = input.game.npcs.find((entry) => entry.id === input.npcId);
  const currentMinuteOfDay =
    input.game.clock.hour * 60 + input.game.clock.minute;
  const currentDayStart = (input.game.clock.day - 1) * 24 * 60;

  return {
    evaluatedAt: {
      day: input.game.clock.day,
      hour: input.game.clock.hour,
      minute: input.game.clock.minute,
      totalMinutes: input.game.clock.totalMinutes,
    },
    speaker: npc
      ? {
          id: npc.id,
          name: npc.name,
          role: npc.role,
          currentLocationId: npc.currentLocationId,
          profile: {
            about: npc.summary,
            objective: npc.currentObjective,
            concern: npc.currentConcern,
          },
          scheduledPlaces: npc.schedule.map((stop) => ({
            locationId: stop.locationId,
            fromHour: stop.fromHour,
            toHour: stop.toHour,
            activeNow:
              currentMinuteOfDay >= stop.fromHour * 60 &&
              currentMinuteOfDay < stop.toHour * 60,
          })),
          ownedWork: input.game.jobs
            .filter((job) => job.giverNpcId === npc.id)
            .map((job) => ({
              id: job.id,
              title: job.title,
              locationId: job.locationId,
            })),
        }
      : undefined,
    currentWorkWindows: input.game.jobs.map((job) => {
      const endsAtTotalMinutes = currentDayStart + job.endHour * 60;
      const status = job.completed
        ? "completed"
        : job.missed || input.game.clock.totalMinutes >= endsAtTotalMinutes
          ? "missed_or_closed"
          : "current";
      return {
        id: job.id,
        title: job.title,
        giverNpcId: job.giverNpcId,
        locationId: job.locationId,
        startHour: job.startHour,
        endHour: job.endHour,
        status,
      };
    }),
    availableLegalActions: input.game.availableActions
      .filter((action) => !action.disabled)
      .map((action) => ({
        id: action.id,
        label: action.label,
        targetLocationId: action.targetLocationId,
      })),
    desiredOutcomes:
      input.game.player.objective?.outcomes.map((outcome) => ({
        id: outcome.id,
        label: outcome.label,
        npcId: outcome.npcId,
        targetLocationId: outcome.targetLocationId,
        status: outcome.status,
      })) ?? [],
  };
}
