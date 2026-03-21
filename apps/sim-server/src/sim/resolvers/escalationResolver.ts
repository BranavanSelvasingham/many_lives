import type { Character } from "../../domain/character.js";
import type { EscalationDecision } from "../../domain/attention.js";
import type { EventRecord } from "../../domain/event.js";
import type { InboxPriority } from "../../domain/inbox.js";
import type { Task } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import type { AIProvider } from "../../ai/provider.js";
import {
  findMemoryState,
  formatPriorityScore,
  recordInboxMessage,
  recordNotification,
} from "../worldState.js";

interface EscalationInput {
  world: WorldState;
  character: Character;
  event: EventRecord;
  task?: Task;
}

export async function maybeEscalateEvent(
  input: EscalationInput,
  aiProvider: AIProvider,
): Promise<void> {
  const decision = evaluateEscalation(input);

  recordNotification(input.world, {
    characterId: input.character.id,
    eventId: input.event.id,
    tier: decision.tier,
    priority: decision.priority,
    subject: input.event.title,
    summary: `${input.event.description} Attention tier: ${decision.tier}.`,
    createdAt: input.event.createdAt,
  });

  if (!decision.shouldEscalate) {
    return;
  }

  const providerSuggestion = await aiProvider.classifyEscalation({
    world: input.world,
    character: input.character,
    event: input.event,
    task: input.task,
  });

  const suggestedActions = await aiProvider.proposeNextAction({
    world: input.world,
    character: input.character,
    event: input.event,
    task: input.task,
  });

  const message = await aiProvider.generateInboxMessage({
    world: input.world,
    character: input.character,
    event: input.event,
    task: input.task,
    escalation: {
      shouldEscalate: true,
      priority: decision.priority,
      rationale: providerSuggestion.rationale,
    },
    suggestedActions: suggestedActions.slice(0, 4),
  });

  recordInboxMessage(input.world, {
    characterId: input.character.id,
    type: message.type,
    priority: decision.priority,
    subject: message.subject,
    body: `${message.body} Escalation reason: ${decision.reason}.`,
    suggestedActions: message.suggestedActions,
    requiresResponse: message.requiresResponse,
    createdAt: input.event.createdAt,
    eventId: input.event.id,
    attentionTier: decision.tier,
    escalationReason: decision.reason,
  });
}

export function evaluateEscalation(input: EscalationInput): EscalationDecision {
  if (!isInboxEligibleEvent(input)) {
    return {
      shouldEscalate: false,
      priority: input.event.priority,
      score: 0,
      tier: "silent",
      reason: "routine event kept out of the inbox",
      signals: {
        stakes: 0,
        reversibility: 0,
        confidence: 0,
        novelty: 0,
        coherenceThreat: 0,
        rivalPressure: 0,
        playerRelevance: 0,
      },
    };
  }

  const memory = findMemoryState(input.world, input.character.id);
  const reportingAdjustment = reportingAdjustmentFor(
    input.character.policies.reportingFrequency,
  );
  const riskAdjustment = Math.round(input.character.policies.riskTolerance * 2);
  const biasAdjustment =
    input.task && input.task.kind === input.character.policies.priorityBias
      ? 1
      : 0;
  const signals = {
    stakes:
      formatPriorityScore(input.event.priority) +
      Math.max(0, (input.task?.importance ?? 0) - 2),
    reversibility: reversibilityFor(input.event),
    confidence: input.task ? 2 : 1,
    novelty: noveltyFor(input.event),
    coherenceThreat: coherenceThreatFor(input, memory?.coherence),
    rivalPressure: rivalPressureFor(input),
    playerRelevance:
      (input.task?.mandatory ? 2 : 0) +
      (input.event.type === "world_shift" || input.event.type === "rival_advance"
        ? 1
        : 0),
  };

  const score =
    formatPriorityScore(input.event.priority) +
    (input.task?.mandatory ? 1 : 0) +
    ((input.task?.importance ?? 0) >= 5 ? 1 : 0) +
    (signals.coherenceThreat >= 2 ? 1 : 0) +
    (signals.rivalPressure >= 2 ? 1 : 0) +
    (signals.novelty >= 2 ? 1 : 0) +
    (signals.playerRelevance >= 2 ? 1 : 0) +
    (input.character.stress >= 70 ? 1 : 0) +
    (input.character.energy <= 25 ? 1 : 0) +
    reportingAdjustment +
    biasAdjustment -
    riskAdjustment;

  const threshold = input.character.policies.escalationThreshold;
  const tier = tierForScore(score, threshold);
  const shouldEscalate = tier === "message" || tier === "interrupt";

  return {
    shouldEscalate,
    priority: priorityForScore(score, input.event.priority),
    score,
    tier,
    reason: `score ${score} vs threshold ${threshold}; stakes ${signals.stakes}, coherence threat ${signals.coherenceThreat}, rival pressure ${signals.rivalPressure}`,
    signals,
  };
}

function isInboxEligibleEvent(input: EscalationInput): boolean {
  switch (input.event.type) {
    case "world_shift":
    case "opening_detected":
    case "opening_claimed":
    case "rival_advance":
    case "coherence_drift":
    case "obligation_missed":
    case "schedule_conflict":
    case "travel_delay":
    case "stress_spike":
      return true;
    case "task_completed":
      return (
        input.character.policies.reportingFrequency === "high" &&
        Boolean(input.task?.mandatory) &&
        (input.task?.importance ?? 0) >= 5 &&
        input.task?.createdBy === "scenario"
      );
    default:
      return false;
  }
}

function reportingAdjustmentFor(
  frequency: Character["policies"]["reportingFrequency"],
): number {
  switch (frequency) {
    case "high":
      return 1;
    case "normal":
      return 0;
    case "low":
      return -1;
  }
}

function priorityForScore(
  score: number,
  eventPriority: InboxPriority,
): InboxPriority {
  if (score >= 8) {
    return "critical";
  }
  if (score >= 5) {
    return "high";
  }
  if (score >= 3) {
    return "medium";
  }
  return eventPriority === "critical" ? "high" : "low";
}

function tierForScore(
  score: number,
  threshold: number,
): EscalationDecision["tier"] {
  if (score >= threshold + 4) {
    return "interrupt";
  }
  if (score >= threshold + 1) {
    return "message";
  }
  if (score >= threshold - 1) {
    return "digest";
  }
  if (score >= 3) {
    return "ambient";
  }
  return "silent";
}

function reversibilityFor(event: EventRecord): number {
  switch (event.type) {
    case "opening_claimed":
    case "obligation_missed":
      return 3;
    case "world_shift":
    case "rival_advance":
    case "coherence_drift":
      return 2;
    default:
      return 1;
  }
}

function noveltyFor(event: EventRecord): number {
  switch (event.type) {
    case "opening_detected":
    case "world_shift":
      return 2;
    case "rival_advance":
      return 1;
    default:
      return 0;
  }
}

function coherenceThreatFor(
  input: EscalationInput,
  memoryCoherence = input.character.memoryCoherence,
): number {
  if (
    input.event.type === "coherence_drift" ||
    input.event.type === "stress_spike"
  ) {
    return 3;
  }

  if (memoryCoherence <= 45) {
    return 2;
  }

  if (memoryCoherence <= 60) {
    return 1;
  }

  return 0;
}

function rivalPressureFor(input: EscalationInput): number {
  if (
    input.event.type === "opening_claimed" ||
    input.event.type === "rival_advance"
  ) {
    return 3;
  }

  if (input.world.cityState.rivalAttention >= 70) {
    return 2;
  }

  if (input.world.cityState.rivalAttention >= 45) {
    return 1;
  }

  return 0;
}
