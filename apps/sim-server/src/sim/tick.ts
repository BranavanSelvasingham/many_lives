import type { AIProvider } from "../ai/provider.js";
import type { EventRecord } from "../domain/event.js";
import type { WorldState } from "../domain/world.js";
import { maybeEscalateEvent } from "./resolvers/escalationResolver.js";
import { synchronizeDerivedTasks } from "./resolvers/commitmentResolver.js";
import { rememberEvent } from "./resolvers/memoryResolver.js";
import { detectCharacterPerceptions } from "./resolvers/perceptionResolver.js";
import {
  detectIntegrityDrift,
  detectMissedObligations,
  detectScheduleConflicts,
  detectStressEvents,
  resolveCharacterStep,
} from "./resolvers/taskResolver.js";
import { advanceCityState } from "./resolvers/worldResolver.js";
import {
  STEP_MINUTES,
  addMinutes,
  cloneWorldState,
  findCharacter,
  findTask,
  recordEvent,
} from "./worldState.js";

export async function advanceWorldByTicks(
  world: WorldState,
  tickCount: number,
  aiProvider: AIProvider,
): Promise<WorldState> {
  const nextWorld = cloneWorldState(world);

  for (let index = 0; index < tickCount; index += 1) {
    await advanceSingleTick(nextWorld, aiProvider);
  }

  nextWorld.summary = await aiProvider.summarizeState(nextWorld);
  return nextWorld;
}

async function advanceSingleTick(
  world: WorldState,
  aiProvider: AIProvider,
): Promise<void> {
  const stepStart = world.currentTime;
  const stepEnd = addMinutes(stepStart, STEP_MINUTES);
  const eventsToHandle: EventRecord[] = [];

  for (const draft of advanceCityState(world)) {
    eventsToHandle.push(recordEvent(world, draft));
  }

  synchronizeDerivedTasks(world);

  for (const draft of detectScheduleConflicts(world, stepStart)) {
    eventsToHandle.push(recordEvent(world, draft));
  }

  for (const character of world.characters) {
    for (const draft of detectCharacterPerceptions(world, character)) {
      eventsToHandle.push(recordEvent(world, draft));
    }

    for (const draft of resolveCharacterStep(
      world,
      character,
      stepStart,
      stepEnd,
    )) {
      eventsToHandle.push(recordEvent(world, draft));
    }
  }

  world.currentTime = stepEnd;
  world.tickCount += 1;

  for (const draft of detectMissedObligations(world, world.currentTime)) {
    eventsToHandle.push(recordEvent(world, draft));
  }

  for (const draft of detectStressEvents(world, world.currentTime)) {
    eventsToHandle.push(recordEvent(world, draft));
  }

  for (const draft of detectIntegrityDrift(world, world.currentTime)) {
    eventsToHandle.push(recordEvent(world, draft));
  }

  for (const event of eventsToHandle) {
    const character = findCharacter(world, event.characterId);
    if (!character) {
      continue;
    }

    const task =
      findTask(world, event.relatedTaskId) ??
      world.tasks.find((entry) => event.relatedTaskIds?.includes(entry.id));

    rememberEvent(world, event, character);

    await maybeEscalateEvent(
      {
        world,
        character,
        event,
        task,
      },
      aiProvider,
    );
  }
}
