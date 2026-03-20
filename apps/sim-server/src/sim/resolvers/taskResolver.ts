import type { Character } from "../../domain/character.js";
import type { NewEvent } from "../../domain/event.js";
import type { Task } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import {
  STEP_MINUTES,
  addSystemFlag,
  clamp,
  hasSystemFlag,
  minutesBetween,
  removeSystemFlag,
  remainingTaskMinutes,
  remainingTravelMinutes,
} from "../worldState.js";

export function detectScheduleConflicts(
  world: WorldState,
  currentTime: string,
): NewEvent[] {
  const events: NewEvent[] = [];
  const alertWindowEnd = new Date(currentTime).getTime() + 60 * 60_000;

  for (const character of world.characters) {
    const pendingTasks = world.tasks
      .filter(
        (task) =>
          task.characterId === character.id &&
          (task.status === "pending" || task.status === "active"),
      )
      .sort(
        (left, right) => taskWindowStartsAt(left) - taskWindowStartsAt(right),
      );

    for (let index = 0; index < pendingTasks.length; index += 1) {
      const task = pendingTasks[index];

      if (taskWindowStartsAt(task) > alertWindowEnd) {
        continue;
      }

      for (
        let peerIndex = index + 1;
        peerIndex < pendingTasks.length;
        peerIndex += 1
      ) {
        const peer = pendingTasks[peerIndex];
        if (!windowsOverlap(task, peer)) {
          continue;
        }

        const conflictKey = `conflict:${character.id}:${[task.id, peer.id].sort().join(":")}`;
        if (hasSystemFlag(world, conflictKey)) {
          continue;
        }

        addSystemFlag(world, conflictKey);
        events.push({
          characterId: character.id,
          type: "schedule_conflict",
          priority: task.mandatory && peer.mandatory ? "high" : "medium",
          title: `${character.name} has overlapping obligations`,
          description: `${task.title} overlaps with ${peer.title}. Their current primary pursuit is ${character.policies.priorityBias}.`,
          createdAt: currentTime,
          relatedTaskIds: [task.id, peer.id],
          metadata: {
            firstTaskDueAt: task.dueAt,
            secondTaskDueAt: peer.dueAt,
          },
        });
      }
    }
  }

  return events;
}

export function resolveCharacterStep(
  world: WorldState,
  character: Character,
  stepStart: string,
  stepEnd: string,
): NewEvent[] {
  const events: NewEvent[] = [];

  if (character.activeTaskId) {
    const activeTask = world.tasks.find(
      (task) => task.id === character.activeTaskId,
    );
    if (!activeTask || activeTask.status !== "active") {
      character.activeTaskId = null;
    }
  }

  if (!character.activeTaskId) {
    const nextTask = selectNextTask(
      character,
      world.tasks.filter((task) => task.characterId === character.id),
      stepStart,
    );

    if (nextTask) {
      nextTask.status = "active";
      nextTask.startedAt ??= stepStart;
      character.activeTaskId = nextTask.id;

      events.push({
        characterId: character.id,
        type: "task_started",
        priority: nextTask.importance >= 4 ? "medium" : "low",
        title: `${character.name} started ${nextTask.title}`,
        description: `${character.name} committed the next 30 minutes to ${nextTask.title.toLowerCase()}.`,
        createdAt: stepStart,
        relatedTaskId: nextTask.id,
      });
    }
  }

  const activeTask = world.tasks.find(
    (task) => task.id === character.activeTaskId,
  );

  if (!activeTask) {
    applyIdleRecovery(character);
    return events;
  }

  const travelLeft = remainingTravelMinutes(activeTask);
  if (travelLeft > 0) {
    activeTask.travelProgressMinutes = Math.min(
      activeTask.travelMinutes,
      activeTask.travelProgressMinutes + STEP_MINUTES,
    );
    character.energy = clamp(character.energy - 5, 0, 100);
    character.stress = clamp(character.stress + 3, 0, 100);

    if (remainingTravelMinutes(activeTask) === 0) {
      character.currentLocation = activeTask.location;
    }

    const lateAfterTravel =
      minutesBetween(stepEnd, activeTask.dueAt) <
        remainingTaskMinutes(activeTask) &&
      !hasSystemFlag(world, `travel-delay:${activeTask.id}`);

    if (lateAfterTravel) {
      addSystemFlag(world, `travel-delay:${activeTask.id}`);
      events.push({
        characterId: character.id,
        type: "travel_delay",
        priority: activeTask.mandatory ? "high" : "medium",
        title: `${character.name} is losing time in transit`,
        description: `${activeTask.title} may slip because travel consumed the current slot.`,
        createdAt: stepEnd,
        relatedTaskId: activeTask.id,
      });
    }

    return events;
  }

  if (new Date(stepStart).getTime() < new Date(activeTask.startAt).getTime()) {
    // Travel can begin before a task slot starts, but the actual work should still wait for the slot.
    character.energy = clamp(character.energy + 1, 0, 100);
    character.stress = clamp(character.stress - 1, 0, 100);
    return events;
  }

  activeTask.progressMinutes = Math.min(
    activeTask.durationMinutes,
    activeTask.progressMinutes + STEP_MINUTES,
  );
  activeTask.lastProgressAt = stepEnd;
  applyTaskEffect(character, activeTask);

  if (activeTask.progressMinutes >= activeTask.durationMinutes) {
    activeTask.status = "completed";
    activeTask.completedAt = stepEnd;
    character.activeTaskId = null;

    events.push({
      characterId: character.id,
      type: "task_completed",
      priority: activeTask.importance >= 4 ? "medium" : "low",
      title: `${character.name} completed ${activeTask.title}`,
      description: `${character.name} wrapped up ${activeTask.title.toLowerCase()} and is ready for the next obligation.`,
      createdAt: stepEnd,
      relatedTaskId: activeTask.id,
    });
  }

  return events;
}

export function detectMissedObligations(
  world: WorldState,
  currentTime: string,
): NewEvent[] {
  const events: NewEvent[] = [];

  for (const task of world.tasks) {
    if (task.status === "completed" || task.status === "missed") {
      continue;
    }

    if (new Date(task.dueAt).getTime() > new Date(currentTime).getTime()) {
      continue;
    }

    const character = world.characters.find(
      (entry) => entry.id === task.characterId,
    );
    if (!character) {
      continue;
    }

    task.status = "missed";
    task.missedAt = currentTime;

    if (character.activeTaskId === task.id) {
      character.activeTaskId = null;
    }

    character.stress = clamp(character.stress + 12, 0, 100);
    character.energy = clamp(character.energy - 4, 0, 100);

    events.push({
      characterId: character.id,
      type: "obligation_missed",
      priority: task.mandatory ? "critical" : "high",
      title: `${character.name} missed ${task.title}`,
      description: `${task.title} was not completed by ${task.dueAt}. The miss is now affecting the rest of the day.`,
      createdAt: currentTime,
      relatedTaskId: task.id,
      metadata: {
        mandatory: task.mandatory,
      },
    });
  }

  return events;
}

export function detectStressEvents(
  world: WorldState,
  currentTime: string,
): NewEvent[] {
  const events: NewEvent[] = [];

  for (const character of world.characters) {
    const stressAlertFlag = `stress-alert:${character.id}`;

    if (character.stress < 70) {
      removeSystemFlag(world, stressAlertFlag);
      continue;
    }

    if (character.stress < 80 || hasSystemFlag(world, stressAlertFlag)) {
      continue;
    }

    addSystemFlag(world, stressAlertFlag);
    events.push({
      characterId: character.id,
      type: "stress_spike",
      priority: character.stress >= 90 ? "critical" : "high",
      title: `${character.name} is nearing overload`,
      description: `${character.name}'s strain reached ${character.stress}, which risks fragmentation across the network.`,
      createdAt: currentTime,
    });
  }

  return events;
}

function windowsOverlap(left: Task, right: Task): boolean {
  return (
    taskWindowStartsAt(left) < taskWindowEndsAt(right) &&
    taskWindowStartsAt(right) < taskWindowEndsAt(left)
  );
}

function selectNextTask(
  character: Character,
  tasks: Task[],
  currentTime: string,
): Task | undefined {
  return tasks
    .filter(
      (task) =>
        task.status === "pending" &&
        taskWindowStartsAt(task) <= new Date(currentTime).getTime(),
    )
    .sort(
      (left, right) =>
        scoreTask(character, right, currentTime) -
        scoreTask(character, left, currentTime),
    )[0];
}

function scoreTask(
  character: Character,
  task: Task,
  currentTime: string,
): number {
  const minutesUntilDue = Math.max(0, minutesBetween(currentTime, task.dueAt));
  const urgencyScore = Math.max(0, 180 - minutesUntilDue) / 10;
  const mandatoryScore = task.mandatory ? 18 : 0;
  const biasScore = task.kind === character.policies.priorityBias ? 12 : 0;
  const travelPenalty = task.travelMinutes / 10;

  return (
    task.importance * 10 +
    urgencyScore +
    mandatoryScore +
    biasScore -
    travelPenalty
  );
}

function applyIdleRecovery(character: Character): void {
  character.energy = clamp(character.energy + 4, 0, 100);
  character.stress = clamp(character.stress - 2, 0, 100);
}

function applyTaskEffect(character: Character, task: Task): void {
  switch (task.kind) {
    case "integrity":
      character.energy = clamp(character.energy + 8, 0, 100);
      character.stress = clamp(character.stress - 10, 0, 100);
      break;
    case "access":
      character.energy = clamp(character.energy - 6, 0, 100);
      character.stress = clamp(character.stress + 5, 0, 100);
      break;
    case "momentum":
      character.energy = clamp(character.energy - 5, 0, 100);
      character.stress = clamp(character.stress + 7, 0, 100);
      break;
    case "signal":
      character.energy = clamp(character.energy - 7, 0, 100);
      character.stress = clamp(character.stress + 6, 0, 100);
      break;
    default:
      character.energy = clamp(character.energy - 4, 0, 100);
      character.stress = clamp(character.stress + 3, 0, 100);
      break;
  }
}

function taskWindowStartsAt(task: Task): number {
  return new Date(task.startAt).getTime() - task.travelMinutes * 60_000;
}

function taskWindowEndsAt(task: Task): number {
  return new Date(task.dueAt).getTime();
}
