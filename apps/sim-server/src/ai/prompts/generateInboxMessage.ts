import type { Character } from "../../domain/character.js";
import type { EventRecord } from "../../domain/event.js";
import type { Task } from "../../domain/task.js";

export function buildGenerateInboxMessagePrompt(
  character: Character,
  event: EventRecord,
  task?: Task,
): string {
  return [
    `Write a concise inbox message for ${character.name}.`,
    `Event: ${event.type}`,
    `Priority: ${event.priority}`,
    `Title: ${event.title}`,
    task ? `Task: ${task.title}` : "Task: none",
  ].join("\n");
}
