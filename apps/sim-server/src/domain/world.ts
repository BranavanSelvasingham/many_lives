import type { Character } from "./character.js";
import type { EventRecord } from "./event.js";
import type { InboxMessage } from "./inbox.js";
import type { Task } from "./task.js";

export interface WorldState {
  id: string;
  scenarioId: string;
  scenarioName: string;
  currentTime: string;
  tickCount: number;
  summary: string;
  characters: Character[];
  tasks: Task[];
  events: EventRecord[];
  inbox: InboxMessage[];
  systemFlags: string[];
  counters: {
    event: number;
    inbox: number;
  };
}
