import type { WorldState } from "../../domain/world.js";

export function buildSummarizeStatePrompt(world: WorldState): string {
  return [
    "Summarize the current state of the Many Lives prototype.",
    `Current time: ${world.currentTime}`,
    `Open inbox items: ${world.inbox.filter((message) => !message.resolvedAt).length}`,
    `Characters: ${world.characters.map((character) => character.name).join(", ")}`,
  ].join("\n");
}
