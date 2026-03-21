import type { Character } from "../domain/character.js";
import type { MemoryState } from "../domain/memory.js";
import type { NotificationRecord } from "../domain/attention.js";
import type { NewEvent, EventRecord } from "../domain/event.js";
import type { InboxMessage } from "../domain/inbox.js";
import type { RelationshipState } from "../domain/relationship.js";
import type { Task } from "../domain/task.js";
import type { WorldState } from "../domain/world.js";

export const STEP_MINUTES = 30;

export function cloneWorldState(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

export function addMinutes(isoTime: string, minutes: number): string {
  const timestamp = new Date(isoTime).getTime() + minutes * 60_000;
  return new Date(timestamp).toISOString();
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000,
  );
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function findCharacter(
  world: WorldState,
  characterId: string,
): Character | undefined {
  return world.characters.find((character) => character.id === characterId);
}

export function findTask(world: WorldState, taskId?: string): Task | undefined {
  return world.tasks.find((task) => task.id === taskId);
}

export function findMemoryState(
  world: WorldState,
  characterId: string,
): MemoryState | undefined {
  return world.memories.find((memory) => memory.characterId === characterId);
}

export function findRelationshipsForCharacter(
  world: WorldState,
  characterId: string,
): RelationshipState[] {
  return world.relationships.filter(
    (relationship) => relationship.sourceCharacterId === characterId,
  );
}

export function findRelationship(
  world: WorldState,
  relationshipId: string,
): RelationshipState | undefined {
  return world.relationships.find(
    (relationship) => relationship.id === relationshipId,
  );
}

export function remainingTaskMinutes(task: Task): number {
  return Math.max(0, task.durationMinutes - task.progressMinutes);
}

export function remainingTravelMinutes(task: Task): number {
  return Math.max(0, task.travelMinutes - task.travelProgressMinutes);
}

export function recordEvent(world: WorldState, event: NewEvent): EventRecord {
  world.counters.event += 1;
  const storedEvent: EventRecord = {
    id: `event-${world.counters.event}`,
    ...event,
  };
  world.events.push(storedEvent);
  return storedEvent;
}

export function recordInboxMessage(
  world: WorldState,
  message: Omit<InboxMessage, "id">,
): InboxMessage {
  world.counters.inbox += 1;
  const storedMessage: InboxMessage = {
    id: `inbox-${world.counters.inbox}`,
    ...message,
  };
  world.inbox.unshift(storedMessage);
  return storedMessage;
}

export function recordNotification(
  world: WorldState,
  notification: Omit<NotificationRecord, "id">,
): NotificationRecord {
  world.counters.notification += 1;
  const storedNotification: NotificationRecord = {
    id: `notification-${world.counters.notification}`,
    ...notification,
  };
  world.attentionLog.unshift(storedNotification);
  return storedNotification;
}

export function hasSystemFlag(world: WorldState, flag: string): boolean {
  return world.systemFlags.includes(flag);
}

export function addSystemFlag(world: WorldState, flag: string): void {
  if (!hasSystemFlag(world, flag)) {
    world.systemFlags.push(flag);
  }
}

export function removeSystemFlag(world: WorldState, flag: string): void {
  world.systemFlags = world.systemFlags.filter((entry) => entry !== flag);
}

export function formatPriorityScore(
  priority: "low" | "medium" | "high" | "critical",
): number {
  switch (priority) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
  }
}
