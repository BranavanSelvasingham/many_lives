import type { Character } from "./character.js";
import type { NotificationRecord } from "./attention.js";
import type { City } from "./city.js";
import type { EventRecord } from "./event.js";
import type { InboxMessage } from "./inbox.js";
import type { MemoryState } from "./memory.js";
import type { PerceivedSignal } from "./perception.js";
import type { RelationshipState } from "./relationship.js";
import type { Task } from "./task.js";

export interface CityState {
  access: number;
  momentum: number;
  signal: number;
  coherence: number;
  risk: number;
  socialDebt: number;
  rivalAttention: number;
  windowNarrowing: number;
  worldPulse: string[];
  rivalStatus: string;
}

export interface WorldState {
  id: string;
  scenarioId: string;
  scenarioName: string;
  currentTime: string;
  tickCount: number;
  summary: string;
  city: City;
  characters: Character[];
  memories: MemoryState[];
  relationships: RelationshipState[];
  perceivedSignals: PerceivedSignal[];
  tasks: Task[];
  events: EventRecord[];
  inbox: InboxMessage[];
  attentionLog: NotificationRecord[];
  cityState: CityState;
  systemFlags: string[];
  counters: {
    event: number;
    inbox: number;
    memory: number;
    notification: number;
    signal: number;
  };
}
