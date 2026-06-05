import type { StreetPlanningRequest } from "../provider.js";

export function buildPlanStreetNextActionPrompt(
  input: StreetPlanningRequest,
): string {
  const locationById = new Map(
    input.game.locations.map((location) => [location.id, location]),
  );
  const currentLocation = input.game.player.currentLocationId
    ? locationById.get(input.game.player.currentLocationId)
    : undefined;
  const knownLocationIds = new Set(input.game.player.knownLocationIds);
  const knownNpcIds = new Set(input.game.player.knownNpcIds);

  const context = {
    rowan: {
      name: input.game.player.name,
      currentLocation: currentLocation
        ? {
            id: currentLocation.id,
            name: currentLocation.name,
            type: currentLocation.type,
            context: currentLocation.context,
          }
        : null,
      money: input.game.player.money,
      energy: input.game.player.energy,
      inventory: input.game.player.inventory.map((item) => ({
        id: item.id,
        name: item.name,
      })),
      memories: input.game.player.memories.slice(-8).map((memory) => ({
        kind: memory.kind,
        text: memory.text,
      })),
    },
    objective: input.objective,
    desiredOutcomes: input.desiredOutcomes,
    clock: input.game.clock,
    knownPlaces: input.game.locations
      .filter((location) => knownLocationIds.has(location.id))
      .map((location) => ({
        id: location.id,
        name: location.name,
        type: location.type,
        context: location.context,
      })),
    knownPeople: input.game.npcs
      .filter((npc) => knownNpcIds.has(npc.id) || npc.known)
      .map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        location: locationById.get(npc.currentLocationId)?.name ?? npc.currentLocationId,
        trust: npc.trust,
        mood: npc.mood,
        concern: npc.currentConcern,
        memory: npc.memory.slice(-4),
      })),
    jobs: input.game.jobs
      .filter((job) => job.discovered || job.accepted || job.completed)
      .map((job) => ({
        id: job.id,
        title: job.title,
        location: locationById.get(job.locationId)?.name ?? job.locationId,
        accepted: job.accepted,
        completed: job.completed,
        missed: job.missed,
        pay: job.pay,
        startHour: job.startHour,
        endHour: job.endHour,
      })),
    problems: input.game.problems
      .filter((problem) => problem.discovered || problem.status === "active")
      .map((problem) => ({
        id: problem.id,
        title: problem.title,
        location: locationById.get(problem.locationId)?.name ?? problem.locationId,
        status: problem.status,
        urgency: problem.urgency,
        requiredItemId: problem.requiredItemId ?? null,
      })),
    cityEvents: input.game.cityEvents
      .filter((event) => event.status !== "resolved")
      .map((event) => ({
        id: event.id,
        title: event.title,
        location: locationById.get(event.locationId)?.name ?? event.locationId,
        status: event.status,
        summary: event.summary,
        tone: event.tone,
        startMinute: event.startMinute,
        endMinute: event.endMinute,
      })),
    recentConversation: input.game.conversations.slice(-8).map((entry) => ({
      speaker: entry.speakerName,
      text: entry.text,
      npcId: entry.npcId,
    })),
    allowedActions: input.allowedActions,
  };

  return [
    "Choose Rowan's next move from the allowed actions.",
    "Return strict JSON only with this shape:",
    '{"planKey":"...","actionId":"...","rationale":"...","confidence":0.0}',
    "Rules:",
    "- Choose exactly one planKey from allowedActions. Include the matching actionId for audit only. Do not invent plan keys or action IDs.",
    "- If multiple allowed actions share the same actionId, the planKey is what distinguishes the actual target and reason.",
    "- The game server will execute and validate the action; you cannot change state directly.",
    "- Prefer the action that best follows Rowan's current objective, memories, recent conversations, time, money, energy, and local opportunities.",
    "- Treat desiredOutcomes as the goal; the objective trail is only supporting context, not a mandatory route.",
    "- Keep rationale one short plain-English sentence about why this move fits the current state.",
    "- confidence must be a number from 0 to 1.",
    "- Use confidence below 0.55 if no allowed action clearly fits.",
    "- Do not write dialogue, narration, markdown, or extra keys.",
    `Current state: ${JSON.stringify(context)}`,
  ].join("\n");
}
