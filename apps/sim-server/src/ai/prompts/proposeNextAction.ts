import type { Character } from "../../domain/character.js";
import type { EventRecord } from "../../domain/event.js";
import type { Task } from "../../domain/task.js";

export function buildProposeNextActionPrompt(
  character: Character,
  event: EventRecord,
  task?: Task,
): string {
  return [
    `Propose player actions for ${character.name}.`,
    `Event: ${event.title}`,
    task ? `Task: ${task.title}` : "Task: none",
    `Priority bias: ${character.policies.priorityBias}`,
  ].join("\n");
}
