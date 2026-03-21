import type { Character } from "../../domain/character.js";
import type {
  BeliefFrame,
  BeliefRecord,
  BeliefStatus,
  MemoryTone,
} from "../../domain/memory.js";
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
    event.type === "current_lost" ||
    event.type === "obligation_missed"
  ) {
    memory.coherence = clamp(memory.coherence - 4, 0, 100);
  } else if (
    event.type === "signal_detected" ||
    event.type === "contact_shift" ||
    event.type === "threshold_shift" ||
    event.type === "rumor_sharpened" ||
    event.type === "scene_heat" ||
    event.type === "tech_glimmer" ||
    event.type === "task_completed" ||
    event.type === "player_response"
  ) {
    memory.coherence = clamp(memory.coherence + 1, 0, 100);
  }

  if (
    event.type === "signal_detected" ||
    event.type === "contact_shift" ||
    event.type === "threshold_shift" ||
    event.type === "rumor_sharpened" ||
    event.type === "scene_heat" ||
    event.type === "tech_glimmer" ||
    event.type === "current_lost"
  ) {
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
      {
        frame: "anchor",
        source: "player",
        status: "confirmed",
      },
    );
  }

  updateRelationships(world, event, character);
  character.memoryCoherence = memory.coherence;
}

export function synchronizeBeliefState(world: WorldState): void {
  for (const memory of world.memories) {
    const character = world.characters.find(
      (entry) => entry.id === memory.characterId,
    );
    if (!character) {
      continue;
    }

    for (const belief of memory.beliefs) {
      const nextStatus = evaluateBeliefStatus(world, character, memory, belief);

      if (nextStatus === belief.status) {
        belief.confidence = clamp(
          belief.confidence + confidenceAdjustmentFor(nextStatus, false),
          0,
          1,
        );
        belief.lastUpdatedAt = world.currentTime;
        continue;
      }

      const previousStatus = belief.status;
      belief.status = nextStatus;
      belief.confidence = clamp(
        belief.confidence + confidenceAdjustmentFor(nextStatus, true),
        0,
        1,
      );
      belief.lastUpdatedAt = world.currentTime;

      if (nextStatus === "confirmed") {
        memory.coherence = clamp(memory.coherence + 1, 0, 100);
      }

      if (nextStatus === "disproven") {
        memory.coherence = clamp(memory.coherence - 3, 0, 100);
        memory.unresolvedThreads = uniqueThreads([
          `Reconcile ${belief.source}`,
          ...memory.unresolvedThreads,
        ]).slice(0, 8);
      } else if (previousStatus === "disproven") {
        memory.coherence = clamp(memory.coherence + 1, 0, 100);
      }
    }

    character.memoryCoherence = memory.coherence;
  }

  world.cityState.coherence = clamp(
    Math.round(
      world.characters.reduce(
        (total, character) => total + character.memoryCoherence,
        0,
      ) / Math.max(1, world.characters.length),
    ),
    0,
    100,
  );
}

function toneForEvent(eventType: EventRecord["type"]): MemoryTone {
  switch (eventType) {
    case "signal_detected":
    case "contact_shift":
    case "threshold_shift":
    case "rumor_sharpened":
    case "scene_heat":
    case "tech_glimmer":
    case "task_completed":
      return "opportunity";
    case "world_shift":
    case "rival_advance":
    case "rival_trace":
    case "current_lost":
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
  options?: {
    frame?: BeliefFrame;
    source?: string;
    status?: BeliefStatus;
  },
) {
  const existing = beliefs.find((entry) => entry.subject === subject);

  if (existing) {
    existing.belief = belief;
    existing.confidence = clamp(existing.confidence + 0.05, 0, 1);
    existing.lastUpdatedAt = createdAt;
    existing.frame = options?.frame ?? existing.frame;
    existing.source = options?.source ?? existing.source;
    existing.status =
      existing.status === "disproven" && options?.status !== "confirmed"
        ? existing.status
        : options?.status ?? existing.status;
    return beliefs;
  }

  const nextBelief = {
    id: `belief-${subject}`,
    subject,
    belief,
    confidence: 0.65,
    status: options?.status ?? "held",
    frame: options?.frame ?? "anchor",
    source: options?.source ?? subject,
    lastUpdatedAt: createdAt,
  };

  if (subject === "player") {
    return [...beliefs, nextBelief].slice(-12);
  }

  return [
    nextBelief,
    ...beliefs,
  ].slice(0, 12);
}

function uniqueThreads(threads: string[]): string[] {
  return Array.from(new Set(threads));
}

function evaluateBeliefStatus(
  world: WorldState,
  character: Character,
  memory: WorldState["memories"][number],
  belief: BeliefRecord,
): BeliefStatus {
  if (belief.subject === "player" || belief.frame === "anchor") {
    return belief.status === "disproven" ? "held" : belief.status;
  }

  if (belief.frame === "stabilize") {
    if (memory.coherence <= 45 || character.stress >= 80) {
      return "confirmed";
    }

    if (memory.coherence <= 60 || character.stress >= 68) {
      return "held";
    }

    return "speculative";
  }

  if (belief.frame === "entanglement" && belief.sourceRelationshipId) {
    const relationship = world.relationships.find(
      (entry) => entry.id === belief.sourceRelationshipId,
    );

    if (!relationship) {
      return "speculative";
    }

    const pressure = relationship.strain + relationship.dependency;

    if (pressure >= 100) {
      return "confirmed";
    }

    if (pressure >= 80) {
      return "held";
    }

    return "disproven";
  }

  if (belief.frame === "counter") {
    if (belief.sourceCurrentId) {
      const current = world.city.currents.find(
        (entry) => entry.id === belief.sourceCurrentId,
      );

      if (current?.lockedByRivalId) {
        return "confirmed";
      }

      if (current?.seizedByCharacterId === character.id) {
        return "held";
      }
    }

    const rival = belief.sourceRivalId
      ? world.city.rivals.find((entry) => entry.id === belief.sourceRivalId)
      : undefined;

    if (!rival) {
      return world.cityState.rivalAttention >= 65 ? "held" : "speculative";
    }

    if (rival.threat >= 72 || rival.momentum >= 72) {
      return "confirmed";
    }

    if (rival.threat <= 50 && rival.momentum <= 50) {
      return "disproven";
    }

    return "held";
  }

  if (belief.sourceCurrentId) {
    const current = world.city.currents.find(
      (entry) => entry.id === belief.sourceCurrentId,
    );

    if (!current) {
      return "speculative";
    }

    switch (belief.frame) {
      case "claim":
        if (current.seizedByCharacterId === character.id) {
          return "confirmed";
        }
        if (
          current.status === "claimed" &&
          current.seizedByCharacterId !== character.id
        ) {
          return "disproven";
        }
        return current.status === "forming" ? "speculative" : "held";
      case "verify":
        if (current.status === "dissolved") {
          return "disproven";
        }
        if (
          current.status === "claimed" ||
          current.seizedByCharacterId !== undefined ||
          current.lockedByRivalId !== undefined
        ) {
          return "confirmed";
        }
        return current.status === "forming" ? "speculative" : "held";
      default:
        break;
    }
  }

  return belief.status;
}

function confidenceAdjustmentFor(
  status: BeliefStatus,
  changed: boolean,
): number {
  switch (status) {
    case "confirmed":
      return changed ? 0.12 : 0.02;
    case "held":
      return changed ? 0.04 : 0.01;
    case "speculative":
      return changed ? -0.03 : -0.01;
    case "disproven":
      return changed ? -0.16 : -0.03;
  }
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
      case "current_lost":
      case "rival_trace":
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
