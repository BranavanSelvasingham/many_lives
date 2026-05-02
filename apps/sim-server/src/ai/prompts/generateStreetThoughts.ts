import type { StreetGameState } from "../../street-sim/types.js";
import { getNpcNarrative } from "../../street-sim/npcNarratives.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";

export function buildGenerateStreetThoughtsPrompt(
  game: StreetGameState,
): string {
  const locationById = new Map(game.locations.map((location) => [location.id, location]));
  const activeJob = game.jobs.find((job) => job.id === game.player.activeJobId);
  const activeJobTiming = activeJob
    ? {
        title: activeJob.title,
        location: locationById.get(activeJob.locationId)?.name ?? activeJob.locationId,
        accepted: activeJob.accepted,
        completed: activeJob.completed,
        missed: activeJob.missed,
        startHour: activeJob.startHour,
        endHour: activeJob.endHour,
        windowState:
          game.clock.hour < activeJob.startHour
            ? "before_start"
            : game.clock.hour >= activeJob.endHour
              ? "after_end"
              : "open_now",
        onSite: game.player.currentLocationId === activeJob.locationId,
        deferredUntilMinutes: activeJob.deferredUntilMinutes ?? null,
      }
    : null;
  const currentLocation = locationById.get(game.player.currentLocationId ?? "");
  const pendingObjectiveMove = game.player.pendingObjectiveMove
    ? {
        targetLocationId: game.player.pendingObjectiveMove.targetLocationId,
        targetLocationName:
          locationById.get(game.player.pendingObjectiveMove.targetLocationId)?.name ??
          game.player.pendingObjectiveMove.targetLocationId,
        objectiveText: game.player.pendingObjectiveMove.objectiveText,
        rationale: game.player.pendingObjectiveMove.rationale,
        npcId: game.player.pendingObjectiveMove.npcId ?? null,
        actionId: game.player.pendingObjectiveMove.actionId ?? null,
      }
    : null;
  const activeConversation = game.activeConversation
    ? game.conversationThreads?.[game.activeConversation.npcId] ?? game.activeConversation
    : undefined;
  const objective = game.player.objective;
  const discoveredProblems = game.problems
    .filter((problem) => problem.discovered)
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      status: problem.status,
      location: locationById.get(problem.locationId)?.name ?? problem.locationId,
    }));
  const recentConversation = game.conversations.slice(-6).map((entry) => ({
    npcId: entry.npcId,
    speaker: entry.speakerName,
    text: entry.text,
  }));

  return [
    "Write very short present-tense thought bubbles for a small seaside neighborhood scene.",
    "Return strict JSON only with this shape:",
    '{"playerThought":"...","npcThoughts":{"npc-id":"..."}}',
    "Rules:",
    "- Each thought must be 3 to 14 words.",
    "- Write each thought in first person singular, as that character's own inner voice.",
    "- No narration, labels, quotation marks inside values, or emojis.",
    "- Keep each person distinct, grounded, practical, and a little private.",
    "- Treat each thought as a tiny window into what the person notices, what they care about, and what they think comes next.",
    "- Reflect immediate concerns, bodily strain, timing, small judgments, or seaside-cafe details, not exposition.",
    "- Keep thoughts quietly forward-looking: needs are real, but each line should imply a doable next move without sounding dire.",
    "- Avoid defeated or doom-heavy phrasing unless the character is truly blocked right now.",
    "- Let idle thoughts shift with the hour and recent conversations instead of repeating the same sentence.",
    "- Rowan's thought should often become a short plan that uses known places, buildings, and people to decide where to go next.",
    "- If Rowan has already decided on his next stop, make the thought reflect that pause before he sets off.",
    "- When Rowan is still learning the district, make the thought point toward the next building or person that can make the day clearer.",
    "- If Rowan has work scheduled and the hour changes, his thought should react immediately to whether it is not open yet, open now, or slipping away.",
    "- Keep Rowan's inner voice respectful and emotionally normal. He can be uncertain or intent, but not creepy, possessive, or target-fixated about people.",
    "- Prefer natural lines like 'I should talk to Mara about a room' over compressed shorthand like 'eyes on Mara for a bed'.",
    ...buildStreetVoicePromptLines(),
    `Time: ${game.clock.label}, day ${game.clock.day}, ${String(game.clock.hour).padStart(2, "0")}:${String(game.clock.minute).padStart(2, "0")}`,
    `Player: ${game.player.name} at ${currentLocation?.name ?? "the street"}, backstory ${game.player.backstory}, money ${game.player.money}, energy ${game.player.energy}, objective ${objective?.text ?? "none"}, active job ${activeJob?.title ?? "none"}`,
    `Current job timing: ${JSON.stringify(activeJobTiming)}`,
    `Place Rowan is about to go: ${JSON.stringify(pendingObjectiveMove)}`,
    `Rowan's current plan: ${JSON.stringify(
      objective
        ? {
            text: objective.text,
            focus: objective.focus,
            routeKey: objective.routeKey,
            progress: objective.progress,
            trail: objective.trail,
            completedTrail: objective.completedTrail.slice(-8),
          }
        : null,
    )}`,
    `City background: ${JSON.stringify(game.cityNarrative)}`,
    `District background: ${JSON.stringify(game.districtNarrative)}`,
    `Current place: ${JSON.stringify(
      currentLocation
        ? {
            id: currentLocation.id,
            name: currentLocation.name,
            type: currentLocation.type,
            neighborhood: currentLocation.neighborhood,
            description: currentLocation.description,
            context: currentLocation.context,
            backstory: currentLocation.backstory,
          }
        : {
            id: undefined,
            name: game.districtName,
            description: game.currentScene.description,
            context: game.currentScene.context,
            backstory: game.currentScene.backstory,
          },
    )}`,
    `Current conversation: ${JSON.stringify(
      activeConversation
        ? {
            id: activeConversation.id,
            personId: activeConversation.npcId,
            takeaway: activeConversation.decision,
            possibleNextStepForRowan: activeConversation.objectiveText,
            lines: activeConversation.lines.slice(-6).map((entry) => ({
              speaker: entry.speaker,
              speakerName: entry.speakerName,
              text: entry.text,
            })),
          }
        : null,
    )}`,
    `Known problems: ${JSON.stringify(discoveredProblems)}`,
    `Recent conversation: ${JSON.stringify(recentConversation)}`,
    `People nearby: ${JSON.stringify(
      game.npcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        location: locationById.get(npc.currentLocationId)?.name ?? npc.currentLocationId,
        trust: npc.trust,
        openness: npc.openness,
        known: npc.known,
        mood: npc.mood,
        background: getNpcNarrative(npc.id),
        whatTheyCareAbout: npc.currentObjective,
        whatIsOnTheirMind: npc.currentConcern,
        lastThingTheySaid: npc.lastSpokenLine ?? null,
        summary: npc.summary,
      })),
    )}`,
    "Each person's background, current concern, and voice should stay coherent as the day changes.",
  ].join("\n");
}
