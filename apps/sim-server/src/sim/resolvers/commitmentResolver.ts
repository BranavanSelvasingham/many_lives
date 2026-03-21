import type { Character } from "../../domain/character.js";
import type { Task, TaskKind } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import {
  STEP_MINUTES,
  addMinutes,
  findIntentsForCharacter,
} from "../worldState.js";

export function synchronizeDerivedTasks(world: WorldState): void {
  for (const character of world.characters) {
    const intents = findIntentsForCharacter(world, character.id).slice(0, 2);
    pruneDerivedTasks(world, character, intents);
    deriveIntentTasks(world, character, intents);
  }
}

function deriveIntentTasks(
  world: WorldState,
  character: Character,
  intents: ReturnType<typeof findIntentsForCharacter>,
): void {
  for (const intent of intents) {
    if (
      hasMatchingTask(
        world.tasks,
        character.id,
        taskTitleForIntent(world, intent),
        intent.id,
        intent.sourceCurrentId,
        intent.sourceRelationshipId,
        intent.sourceRivalId,
      )
    ) {
      continue;
    }

    const relatedCurrent = intent.sourceCurrentId
      ? world.city.currents.find((current) => current.id === intent.sourceCurrentId)
      : undefined;
    const location = intentLocation(world, character, intent);

    world.tasks.push({
      id: `task-derived-${character.id}-${intent.id}-${world.tickCount}`,
      characterId: character.id,
      title: taskTitleForIntent(world, intent),
      description: `${intent.summary} ${intent.rationale}`,
      kind: taskKindForIntent(intent),
      location,
      startAt: world.currentTime,
      dueAt: addMinutes(
        world.currentTime,
        relatedCurrent
          ? minutesUntilCurrentDissipates(world, relatedCurrent)
          : taskWindowForIntent(intent),
      ),
      durationMinutes: 60,
      progressMinutes: 0,
      travelMinutes:
        character.currentLocation === location
          ? 0
          : STEP_MINUTES,
      travelProgressMinutes: 0,
      status: "pending",
      importance: Math.min(5, Math.max(3, Math.round(intent.priority / 6))),
      mandatory:
        intent.kind === "protect_coherence" ||
        intent.kind === "counter_rival" ||
        intent.priority >= 18,
      createdBy: "system",
      sourceIntentId: intent.id,
      sourceSignalId: intent.sourceSignalId,
      sourceCurrentId: intent.sourceCurrentId,
      sourceRelationshipId: intent.sourceRelationshipId,
      sourceRivalId: intent.sourceRivalId,
      dynamic: true,
    });
  }
}

function pruneDerivedTasks(
  world: WorldState,
  character: Character,
  intents: ReturnType<typeof findIntentsForCharacter>,
): void {
  const liveIntentIds = new Set(intents.map((intent) => intent.id));
  const liveCurrentIds = new Set(
    intents
      .map((intent) => intent.sourceCurrentId)
      .filter((entry): entry is string => entry !== undefined),
  );
  const liveRelationshipIds = new Set(
    intents
      .map((intent) => intent.sourceRelationshipId)
      .filter((entry): entry is string => entry !== undefined),
  );
  const liveRivalIds = new Set(
    intents
      .map((intent) => intent.sourceRivalId)
      .filter((entry): entry is string => entry !== undefined),
  );

  world.tasks = world.tasks.filter((task) => {
    if (
      task.characterId !== character.id ||
      task.createdBy !== "system" ||
      !task.dynamic
    ) {
      return true;
    }

    if (task.status === "active") {
      return true;
    }

    if (
      task.status === "completed" ||
      task.status === "missed"
    ) {
      return false;
    }

    if (task.sourceIntentId && liveIntentIds.has(task.sourceIntentId)) {
      return true;
    }

    if (task.sourceCurrentId && liveCurrentIds.has(task.sourceCurrentId)) {
      return true;
    }

    if (
      task.sourceRelationshipId &&
      liveRelationshipIds.has(task.sourceRelationshipId)
    ) {
      return true;
    }

    if (task.sourceRivalId && liveRivalIds.has(task.sourceRivalId)) {
      return true;
    }

    return false;
  });
}

function hasMatchingTask(
  tasks: Task[],
  characterId: string,
  title: string,
  sourceIntentId?: string,
  sourceCurrentId?: string,
  sourceRelationshipId?: string,
  sourceRivalId?: string,
): boolean {
  const normalizedTitle = normalize(title);

  return tasks.some(
    (task) =>
      task.characterId === characterId &&
      task.status !== "missed" &&
      task.status !== "completed" &&
      ((sourceIntentId !== undefined &&
        task.sourceIntentId === sourceIntentId) ||
        (sourceCurrentId !== undefined &&
          task.sourceCurrentId === sourceCurrentId) ||
        (sourceRelationshipId !== undefined &&
          task.sourceRelationshipId === sourceRelationshipId) ||
        (sourceRivalId !== undefined &&
          task.sourceRivalId === sourceRivalId) ||
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

function taskKindForIntent(
  intent: ReturnType<typeof findIntentsForCharacter>[number],
): TaskKind {
  switch (intent.kind) {
    case "protect_coherence":
      return "coherence";
    case "counter_rival":
      return "momentum";
    case "manage_entanglement":
      return intent.axis === "coherence" ? "coherence" : intent.axis;
    case "verify_signal":
    case "press_advantage":
    default:
      return intent.axis;
  }
}

function taskTitleForIntent(
  world: WorldState,
  intent: ReturnType<typeof findIntentsForCharacter>[number],
): string {
  const current = intent.sourceCurrentId
    ? world.city.currents.find((entry) => entry.id === intent.sourceCurrentId)
    : undefined;
  const rival = intent.sourceRivalId
    ? world.city.rivals.find((entry) => entry.id === intent.sourceRivalId)
    : undefined;
  const sourceLabel = current?.title ?? rival?.name ?? intent.source ?? intent.axis;

  switch (intent.kind) {
    case "verify_signal":
      return `Verify ${sourceLabel}`;
    case "counter_rival":
      return rival ? `Counter ${rival.name}` : `Counter movement around ${sourceLabel}`;
    case "manage_entanglement":
      return `Untangle ${sourceLabel}`;
    case "protect_coherence":
      return "Recover coherence";
    case "press_advantage":
    default:
      return sourceLabel === intent.axis ? "Press advantage" : `Press ${sourceLabel}`;
  }
}

function taskWindowForIntent(
  intent: ReturnType<typeof findIntentsForCharacter>[number],
) {
  switch (intent.kind) {
    case "protect_coherence":
      return STEP_MINUTES * 2;
    case "counter_rival":
      return STEP_MINUTES * 2;
    default:
      return STEP_MINUTES * 3;
  }
}

function intentLocation(
  world: WorldState,
  character: Character,
  intent: ReturnType<typeof findIntentsForCharacter>[number],
): string {
  if (intent.sourceCurrentId) {
    const matchingCurrent = world.city.currents.find(
      (current) => current.id === intent.sourceCurrentId,
    );

    if (matchingCurrent) {
      return matchingCurrent.districtId;
    }
  }

  if (intent.sourceRelationshipId) {
    const relationship = world.relationships.find(
      (entry) => entry.id === intent.sourceRelationshipId,
    );

    if (relationship?.targetType === "faction") {
      const matchingCurrent = world.city.currents.find((current) =>
        current.factionIds.includes(relationship.targetId),
      );

      if (matchingCurrent) {
        return matchingCurrent.districtId;
      }
    }
  }

  if (intent.sourceRivalId) {
    const matchingRivalCurrent = world.city.currents.find(
      (current) => current.lockedByRivalId === intent.sourceRivalId,
    );

    if (matchingRivalCurrent) {
      return matchingRivalCurrent.districtId;
    }
  }

  return character.currentLocation || world.city.districts[0]?.id || "the-city";
}
