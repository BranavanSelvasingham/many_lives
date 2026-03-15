import type { Character } from "../../domain/character.js";
import type { EventRecord } from "../../domain/event.js";
import type { Task } from "../../domain/task.js";

export function buildClassifyEscalationPrompt(
  character: Character,
  event: EventRecord,
  task?: Task,
): string {
  return [
    `Evaluate whether ${character.name} should escalate this simulation event.`,
    `Event type: ${event.type}`,
    `Priority: ${event.priority}`,
    task
      ? `Related task importance: ${task.importance}`
      : "Related task importance: none",
    `Risk tolerance: ${character.policies.riskTolerance}`,
    `Escalation threshold: ${character.policies.escalationThreshold}`,
  ].join("\n");
}
