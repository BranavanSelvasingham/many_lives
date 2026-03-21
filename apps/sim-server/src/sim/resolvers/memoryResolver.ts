import type { Character } from "../../domain/character.js";
import type { MemoryTone } from "../../domain/memory.js";
import type { EventRecord } from "../../domain/event.js";
import type { WorldState } from "../../domain/world.js";
import {
  clamp,
  findMemoryState,
  findRelationshipsForCharacter,
} from "../worldState.js";

export function rememberEvent(
  world: WorldState,
  event: EventRecord,
  character: Character,
): void {
  const memory = findMemoryState(world, character.id);
  if (!memory) {
    return;
  }

  world.counters.memory += 1;
  memory.episodes.unshift({
    id: `memory-${world.counters.memory}`,
    eventId: event.id,
    createdAt: event.createdAt,
    summary: event.description,
    tone: toneForEvent(event.type),
    weight: memoryWeightFor(event.priority),
    tags: [event.type, character.role],
  });

  memory.episodes = memory.episodes.slice(0, 24);
  memory.lastReflectionAt = event.createdAt;

  if (
    event.type === "stress_spike" ||
    event.type === "coherence_drift" ||
    event.type === "obligation_missed"
  ) {
    memory.coherence = clamp(memory.coherence - 4, 0, 100);
  } else if (
    event.type === "opening_detected" ||
    event.type === "task_completed" ||
    event.type === "player_response"
  ) {
    memory.coherence = clamp(memory.coherence + 1, 0, 100);
  }

  if (event.type === "opening_detected" || event.type === "opening_claimed") {
    memory.unresolvedThreads = uniqueThreads([
      event.title,
      ...memory.unresolvedThreads,
    ]).slice(0, 8);
  }

  if (event.type === "player_response") {
    memory.beliefs = upsertBelief(
      memory.beliefs,
      "player",
      `${character.name} expects the player to keep shaping decisive thresholds.`,
      event.createdAt,
    );
  }

  updateRelationships(world, event, character);
  character.memoryCoherence = memory.coherence;
}

function toneForEvent(eventType: EventRecord["type"]): MemoryTone {
  switch (eventType) {
    case "opening_detected":
    case "task_completed":
      return "opportunity";
    case "world_shift":
    case "rival_advance":
    case "opening_claimed":
      return "warning";
    case "stress_spike":
    case "coherence_drift":
      return "strain";
    case "obligation_missed":
      return "loss";
    case "player_response":
    case "policy_update":
      return "instruction";
    default:
      return "breakthrough";
  }
}

function memoryWeightFor(priority: EventRecord["priority"]): number {
  switch (priority) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
  }
}

function upsertBelief(
  beliefs: WorldState["memories"][number]["beliefs"],
  subject: string,
  belief: string,
  createdAt: string,
) {
  const existing = beliefs.find((entry) => entry.subject === subject);

  if (existing) {
    existing.belief = belief;
    existing.confidence = clamp(existing.confidence + 0.05, 0, 1);
    existing.lastConfirmedAt = createdAt;
    return beliefs;
  }

  return [
    {
      id: `belief-${subject}`,
      subject,
      belief,
      confidence: 0.65,
      lastConfirmedAt: createdAt,
    },
    ...beliefs,
  ].slice(0, 12);
}

function uniqueThreads(threads: string[]): string[] {
  return Array.from(new Set(threads));
}

function updateRelationships(
  world: WorldState,
  event: EventRecord,
  character: Character,
): void {
  const relationships = findRelationshipsForCharacter(world, character.id);

  for (const relationship of relationships) {
    switch (event.type) {
      case "player_response":
        if (relationship.targetType === "player") {
          relationship.trust = clamp(relationship.trust + 2, 0, 100);
          relationship.strain = clamp(relationship.strain - 1, 0, 100);
          relationship.lastUpdatedAt = event.createdAt;
        }
        break;
      case "rival_advance":
      case "opening_claimed":
        if (relationship.targetType === "rival") {
          relationship.strain = clamp(relationship.strain + 3, 0, 100);
          relationship.lastUpdatedAt = event.createdAt;
        }
        break;
      case "task_completed":
        if (relationship.targetType !== "player") {
          relationship.affinity = clamp(relationship.affinity + 1, 0, 100);
          relationship.strain = clamp(relationship.strain - 2, 0, 100);
          relationship.lastUpdatedAt = event.createdAt;
        }
        break;
      case "obligation_missed":
        relationship.strain = clamp(relationship.strain + 1, 0, 100);
        relationship.lastUpdatedAt = event.createdAt;
        break;
      default:
        break;
    }
  }
}
