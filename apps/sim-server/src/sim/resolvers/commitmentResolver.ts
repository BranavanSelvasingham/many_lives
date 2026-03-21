import type { Character } from "../../domain/character.js";
import type { RelationshipState } from "../../domain/relationship.js";
import type { Task, TaskKind } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import {
  STEP_MINUTES,
  addMinutes,
  findMemoryState,
  findSignalsForCharacter,
} from "../worldState.js";

export function synchronizeDerivedTasks(world: WorldState): void {
  for (const character of world.characters) {
    deriveSignalTasks(world, character);
    deriveRelationshipTasks(world, character);
    deriveCoherenceTasks(world, character);
  }
}

function deriveSignalTasks(world: WorldState, character: Character): void {
  const recentSignals = findSignalsForCharacter(world, character.id)
    .slice()
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 4);

  for (const signal of recentSignals) {
    if (
      hasMatchingTask(
        world.tasks,
        character.id,
        signal.source,
        signal.id,
      )
    ) {
      continue;
    }

    const relatedCurrent = signal.currentId
      ? world.city.currents.find((current) => current.id === signal.currentId)
      : undefined;

    world.tasks.push({
      id: `task-derived-${character.id}-${signal.id}-${world.tickCount}`,
      characterId: character.id,
      title: signal.source,
      description: `${signal.summary} ${character.name} is moving because the city just became more legible here.`,
      kind: signal.axis,
      location: signal.districtId ?? character.currentLocation,
      startAt: world.currentTime,
      dueAt: addMinutes(
        world.currentTime,
        relatedCurrent
          ? minutesUntilCurrentDissipates(world, relatedCurrent)
          : STEP_MINUTES * 3,
      ),
      durationMinutes: 60,
      progressMinutes: 0,
      travelMinutes:
        character.currentLocation === (signal.districtId ?? character.currentLocation)
          ? 0
          : STEP_MINUTES,
      travelProgressMinutes: 0,
      status: "pending",
      importance: Math.min(5, Math.max(3, Math.round(signal.strength / 2))),
      mandatory:
        signal.strength >= 8 || signal.axis === character.policies.priorityBias,
      createdBy: "system",
      sourceSignalId: signal.id,
      sourceCurrentId: signal.currentId,
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

function deriveCoherenceTasks(world: WorldState, character: Character): void {
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
  sourceSignalId?: string,
  sourceRelationshipId?: string,
): boolean {
  const normalizedTitle = normalize(title);

  return tasks.some(
    (task) =>
      task.characterId === characterId &&
      task.status !== "missed" &&
      task.status !== "completed" &&
      ((sourceSignalId !== undefined &&
        task.sourceSignalId === sourceSignalId) ||
        (sourceRelationshipId !== undefined &&
          task.sourceRelationshipId === sourceRelationshipId) ||
        normalize(task.title) === normalizedTitle),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function minutesUntilCurrentDissipates(
  world: WorldState,
  current: WorldState["city"]["currents"][number],
): number {
  if (current.dissipatesAtTick === undefined) {
    return STEP_MINUTES * 4;
  }

  return Math.max(
    STEP_MINUTES,
    (current.dissipatesAtTick - world.tickCount) * STEP_MINUTES,
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
    const matchingCurrent = world.city.currents.find((current) =>
      current.factionIds.includes(relationship.targetId),
    );

    if (matchingCurrent) {
      return matchingCurrent.districtId;
    }
  }

  if (relationship.targetType === "rival") {
    const matchingRivalCurrent = world.city.currents.find(
      (current) => current.lockedByRivalId === relationship.targetId,
    );

    if (matchingRivalCurrent) {
      return matchingRivalCurrent.districtId;
    }
  }

  return world.city.districts[0]?.id ?? "the-city";
}
