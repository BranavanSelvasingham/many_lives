import type { Character } from "../../domain/character.js";
import type { EventRecord } from "../../domain/event.js";
import type { InboxPriority } from "../../domain/inbox.js";
import type { Task } from "../../domain/task.js";
import type { WorldState } from "../../domain/world.js";
import type { AIProvider } from "../../ai/provider.js";
import { formatPriorityScore, recordInboxMessage } from "../worldState.js";

interface EscalationDecision {
  shouldEscalate: boolean;
  priority: InboxPriority;
  score: number;
  reason: string;
}

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
  });
}

export function evaluateEscalation(input: EscalationInput): EscalationDecision {
  if (!isInboxEligibleEvent(input)) {
    return {
      shouldEscalate: false,
      priority: input.event.priority,
      score: 0,
      reason: "routine event kept out of the inbox",
    };
  }

  const reportingAdjustment = reportingAdjustmentFor(
    input.character.policies.reportingFrequency,
  );
  const riskAdjustment = Math.round(input.character.policies.riskTolerance * 2);
  const biasAdjustment =
    input.task && input.task.kind === input.character.policies.priorityBias
      ? 1
      : 0;

  const score =
    formatPriorityScore(input.event.priority) +
    (input.task?.mandatory ? 1 : 0) +
    Math.max(0, (input.task?.importance ?? 0) - 2) +
    (input.character.stress >= 70 ? 1 : 0) +
    (input.character.energy <= 25 ? 1 : 0) +
    reportingAdjustment +
    biasAdjustment -
    riskAdjustment;

  const shouldEscalate = score >= input.character.policies.escalationThreshold;

  return {
    shouldEscalate,
    priority: priorityForScore(score, input.event.priority),
    score,
    reason: `score ${score} vs threshold ${input.character.policies.escalationThreshold}`,
  };
}

function isInboxEligibleEvent(input: EscalationInput): boolean {
  switch (input.event.type) {
    case "obligation_missed":
    case "schedule_conflict":
    case "travel_delay":
    case "stress_spike":
      return true;
    case "task_completed":
      return (
        input.character.policies.reportingFrequency === "high" &&
        Boolean(input.task?.mandatory) &&
        (input.task?.importance ?? 0) >= 5
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
