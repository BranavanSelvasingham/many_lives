import type { Character } from "../../domain/character.js";
import type { CityAxis, CityOpening } from "../../domain/city.js";
import type { NewEvent } from "../../domain/event.js";
import type { WorldState } from "../../domain/world.js";

export function detectCharacterPerceptions(
  world: WorldState,
  character: Character,
): NewEvent[] {
  const events: NewEvent[] = [];
  const eligibleOpenings = world.city.openings
    .filter((opening) => opening.status === "active")
    .filter(
      (opening) => !opening.discoveredByCharacterIds.includes(character.id),
    )
    .filter(
      (opening) => perceptionScore(character, opening) >= opening.exclusivity,
    )
    .sort(
      (left, right) =>
        perceptionScore(character, right) - perceptionScore(character, left),
    )
    .slice(0, 1);

  for (const opening of eligibleOpenings) {
    opening.discoveredByCharacterIds.push(character.id);
    events.push({
      characterId: character.id,
      type: "opening_detected",
      priority: opening.urgency >= 8 ? "high" : "medium",
      title: `${character.name} found ${opening.title}`,
      description: `${character.name} noticed ${opening.title.toLowerCase()} in ${districtNameFor(world, opening)} before the rest of the network agreed on what it was.`,
      createdAt: world.currentTime,
      metadata: {
        urgency: opening.urgency,
        exclusivity: opening.exclusivity,
      },
    });
  }

  return events;
}

function perceptionScore(character: Character, opening: CityOpening): number {
  let score = 0;

  if (opening.axis === character.policies.priorityBias) {
    score += 4;
  }

  if (opening.axis === roleAxis(character.role)) {
    score += 3;
  }

  if (character.traits.includes("intuitive")) {
    score += 1;
  }

  if (character.traits.includes("discreet") && opening.visibility === "hidden") {
    score += 1;
  }

  if (character.values.includes("novelty") && opening.visibility !== "open") {
    score += 1;
  }

  score += Math.round(character.policies.riskTolerance * 2);

  return score;
}

function roleAxis(role: Character["role"]): CityAxis {
  switch (role) {
    case "architect":
      return "access";
    case "signal":
      return "signal";
    case "threshold":
      return "coherence";
    case "gravity":
    default:
      return "momentum";
  }
}

function districtNameFor(world: WorldState, opening: CityOpening): string {
  return (
    world.city.districts.find((district) => district.id === opening.districtId)
      ?.name ?? "the city"
  );
}
