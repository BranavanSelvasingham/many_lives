import type { Character } from "../../domain/character.js";
import type { CityOpening } from "../../domain/city.js";
import type { RelationshipState } from "../../domain/relationship.js";
import type { Task, TaskKind } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import { STEP_MINUTES, addMinutes, findMemoryState } from "../worldState.js";

export function synchronizeDerivedTasks(world: WorldState): void {
  for (const character of world.characters) {
    deriveOpeningTasks(world, character);
    deriveRelationshipTasks(world, character);
    deriveIntegrityTasks(world, character);
  }
}

function deriveOpeningTasks(world: WorldState, character: Character): void {
  const activeOpenings = world.city.openings.filter(
    (opening) =>
      opening.status === "active" &&
      opening.discoveredByCharacterIds.includes(character.id),
  );

  for (const opening of activeOpenings) {
    if (
      hasMatchingTask(
        world.tasks,
        character.id,
        opening.title,
        opening.id,
      )
    ) {
      continue;
    }

    world.tasks.push({
      id: `task-derived-${character.id}-${opening.id}-${world.tickCount}`,
      characterId: character.id,
      title: opening.title,
      description: opening.summary,
      kind: opening.axis,
      location: opening.districtId,
      startAt: world.currentTime,
      dueAt: addMinutes(
        world.currentTime,
        minutesUntilOpeningCloses(world, opening),
      ),
      durationMinutes: 60,
      progressMinutes: 0,
      travelMinutes:
        character.currentLocation === opening.districtId ? 0 : STEP_MINUTES,
      travelProgressMinutes: 0,
      status: "pending",
      importance: Math.min(5, Math.max(3, Math.round(opening.urgency / 2))),
      mandatory:
        opening.urgency >= 8 || opening.axis === character.policies.priorityBias,
      createdBy: "system",
      sourceOpeningId: opening.id,
      dynamic: true,
    });
  }
}

function deriveRelationshipTasks(world: WorldState, character: Character): void {
  const relevantRelationships = world.relationships.filter(
    (relationship) =>
      relationship.sourceCharacterId === character.id &&
      relationship.targetType !== "player" &&
      relationship.targetType !== "city" &&
      relationship.strain + relationship.dependency >= 85,
  );

  for (const relationship of relevantRelationships) {
    const title = `Manage ${relationship.label}`;
    if (
      hasMatchingTask(
        world.tasks,
        character.id,
        title,
        undefined,
        relationship.id,
      )
    ) {
      continue;
    }

    world.tasks.push({
      id: `task-derived-${character.id}-relationship-${relationship.id}-${world.tickCount}`,
      characterId: character.id,
      title,
      description: `${relationship.summary} ${character.name} cannot ignore this pull without ceding leverage to someone else.`,
      kind: relationshipTaskKind(character, relationship),
      location: relationshipLocation(world, relationship),
      startAt: world.currentTime,
      dueAt: addMinutes(world.currentTime, STEP_MINUTES * 3),
      durationMinutes: 30,
      progressMinutes: 0,
      travelMinutes:
        character.currentLocation === relationshipLocation(world, relationship)
          ? 0
          : STEP_MINUTES,
      travelProgressMinutes: 0,
      status: "pending",
      importance: relationship.strain >= 50 ? 4 : 3,
      mandatory: relationship.strain >= 60,
      createdBy: "system",
      sourceRelationshipId: relationship.id,
      sourceRivalId:
        relationship.targetType === "rival" ? relationship.targetId : undefined,
      dynamic: true,
    });
  }
}

function deriveIntegrityTasks(world: WorldState, character: Character): void {
  const memory = findMemoryState(world, character.id);
  if (!memory || memory.coherence > 54) {
    return;
  }

  const title = "Recover coherence";
  if (hasMatchingTask(world.tasks, character.id, title)) {
    return;
  }

  world.tasks.push({
    id: `task-derived-${character.id}-coherence-${world.tickCount}`,
    characterId: character.id,
    title,
    description:
      "Recent moves are starting to contradict each other. Spend a block consolidating memory, narrative, and intent before the selves shear apart.",
    kind: "coherence",
    location: character.currentLocation,
    startAt: world.currentTime,
    dueAt: addMinutes(world.currentTime, STEP_MINUTES * 2),
    durationMinutes: 30,
    progressMinutes: 0,
    travelMinutes: 0,
    travelProgressMinutes: 0,
    status: "pending",
    importance: 5,
    mandatory: true,
    createdBy: "system",
    dynamic: true,
  });
}

function hasMatchingTask(
  tasks: Task[],
  characterId: string,
  title: string,
  sourceOpeningId?: string,
  sourceRelationshipId?: string,
): boolean {
  const normalizedTitle = normalize(title);

  return tasks.some(
    (task) =>
      task.characterId === characterId &&
      task.status !== "missed" &&
      task.status !== "completed" &&
      ((sourceOpeningId !== undefined &&
        task.sourceOpeningId === sourceOpeningId) ||
        (sourceRelationshipId !== undefined &&
          task.sourceRelationshipId === sourceRelationshipId) ||
        normalize(task.title) === normalizedTitle),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function minutesUntilOpeningCloses(
  world: WorldState,
  opening: CityOpening,
): number {
  if (opening.closesAtTick === undefined) {
    return STEP_MINUTES * 4;
  }

  return Math.max(
    STEP_MINUTES,
    (opening.closesAtTick - world.tickCount) * STEP_MINUTES,
  );
}

function relationshipTaskKind(
  character: Character,
  relationship: RelationshipState,
): TaskKind {
  if (relationship.targetType === "rival") {
    return "momentum";
  }

  if (relationship.targetType === "faction") {
    return character.policies.priorityBias;
  }

  return "access";
}

function relationshipLocation(
  world: WorldState,
  relationship: RelationshipState,
): string {
  if (relationship.targetType === "faction") {
    const matchingOpening = world.city.openings.find((opening) =>
      opening.factionIds.includes(relationship.targetId),
    );

    if (matchingOpening) {
      return matchingOpening.districtId;
    }
  }

  if (relationship.targetType === "rival") {
    const matchingRivalOpening = world.city.openings.find(
      (opening) => opening.claimedByRivalId === relationship.targetId,
    );

    if (matchingRivalOpening) {
      return matchingRivalOpening.districtId;
    }
  }

  return world.city.districts[0]?.id ?? "the-city";
}
