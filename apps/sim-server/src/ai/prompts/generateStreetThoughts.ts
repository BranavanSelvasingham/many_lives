import type { StreetGameState } from "../../street-sim/types.js";
import { getNpcNarrative } from "../../street-sim/npcNarratives.js";
import { buildStreetVoicePromptLines } from "../streetVoice.js";

export function buildGenerateStreetThoughtsPrompt(
  game: StreetGameState,
): string {
  const locationById = new Map(game.locations.map((location) => [location.id, location]));
  const activeJob = game.jobs.find((job) => job.id === game.player.activeJobId);
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
    "Write very short present-tense thought bubbles for a small city-sim scene.",
    "Return strict JSON only with this shape:",
    '{"playerThought":"...","npcThoughts":{"npc-id":"..."}}',
    "Rules:",
    "- Each thought must be 3 to 14 words.",
    "- Write each thought in first person singular, as that character's own inner voice.",
    "- No narration, labels, quotation marks inside values, or emojis.",
    "- Keep each person distinct, grounded, practical, and a little private.",
    "- Reflect immediate concerns, bodily strain, timing pressure, or small judgments, not exposition.",
    "- Let idle thoughts shift with the hour and recent conversations instead of repeating the same sentence.",
    "- Rowan's thought should often become a short plan that uses known places, buildings, and people to decide where to go next.",
    "- If Rowan has already decided on his next stop, make the thought reflect that pause before he sets off.",
    "- When Rowan is still learning the district, make the thought point toward exploring the next building or NPC that can sharpen the plan.",
    "- Keep Rowan's inner voice respectful and emotionally normal. He can be uncertain or intent, but not creepy, possessive, or target-fixated about people.",
    "- Prefer natural lines like 'I should talk to Mara about a room' over compressed shorthand like 'eyes on Mara for a bed'.",
    ...buildStreetVoicePromptLines(),
    `Time: ${game.clock.label}, day ${game.clock.day}, ${String(game.clock.hour).padStart(2, "0")}:${String(game.clock.minute).padStart(2, "0")}`,
    `Player: ${game.player.name} at ${currentLocation?.name ?? "the street"}, backstory ${game.player.backstory}, money ${game.player.money}, energy ${game.player.energy}, objective ${objective?.text ?? "none"}, active job ${activeJob?.title ?? "none"}`,
    `Pending move: ${JSON.stringify(pendingObjectiveMove)}`,
    `Objective state: ${JSON.stringify(
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
    `City narrative: ${JSON.stringify(game.cityNarrative)}`,
    `District narrative: ${JSON.stringify(game.districtNarrative)}`,
    `Scene: ${JSON.stringify(
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
    `Active conversation thread: ${JSON.stringify(
      activeConversation
        ? {
            id: activeConversation.id,
            npcId: activeConversation.npcId,
            decision: activeConversation.decision,
            objectiveText: activeConversation.objectiveText,
            lines: activeConversation.lines.slice(-6).map((entry) => ({
              speaker: entry.speaker,
              speakerName: entry.speakerName,
              text: entry.text,
            })),
          }
        : null,
    )}`,
    `Discovered problems: ${JSON.stringify(discoveredProblems)}`,
    `Recent conversation: ${JSON.stringify(recentConversation)}`,
      `NPCs: ${JSON.stringify(
        game.npcs.map((npc) => ({
          id: npc.id,
          name: npc.name,
          role: npc.role,
          location: locationById.get(npc.currentLocationId)?.name ?? npc.currentLocationId,
          trust: npc.trust,
          openness: npc.openness,
          known: npc.known,
          mood: npc.mood,
          narrative: getNpcNarrative(npc.id),
          currentObjective: npc.currentObjective,
          currentConcern: npc.currentConcern,
          lastSpokenLine: npc.lastSpokenLine ?? null,
          summary: npc.summary,
        })),
      )}`,
    "NPC narrative profiles are fixed anchors: backstory, context, objective, and voice should stay coherent even as the live concern changes.",
  ].join("\n");
}
