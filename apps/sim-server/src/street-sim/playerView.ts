import type { StreetGameState } from "./types.js";

export function projectStreetGameForPlayer(world: StreetGameState): StreetGameState {
  const projected = structuredClone(world);
  const knownNpcIds = new Set(projected.player.knownNpcIds);
  const currentLocationId = projected.player.currentLocationId;

  projected.npcs = projected.npcs.map((npc) => {
    const fullyKnown = knownNpcIds.has(npc.id);
    const currentlyVisible = npc.currentLocationId === currentLocationId;

    if (fullyKnown || currentlyVisible) {
      return npc;
    }

    return {
      ...npc,
      narrative: {
        backstory: "",
        context: "",
        objective: "",
        voice: "",
      },
      currentObjective: "",
      currentConcern: "",
      currentThought: undefined,
      lastSpokenLine: undefined,
      memory: [],
    };
  });

  projected.jobs = projected.jobs.filter(
    (job) =>
      job.discovered ||
      job.accepted ||
      job.completed ||
      job.missed ||
      job.id === projected.player.activeJobId,
  );

  projected.problems = projected.problems.filter((problem) => problem.discovered);

  return projected;
}
