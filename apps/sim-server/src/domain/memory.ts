export type MemoryTone =
  | "breakthrough"
  | "strain"
  | "warning"
  | "opportunity"
  | "loss"
  | "instruction";

export interface MemoryEpisode {
  id: string;
  eventId: string;
  createdAt: string;
  summary: string;
  tone: MemoryTone;
  weight: number;
  tags: string[];
}

export type BeliefStatus =
  | "speculative"
  | "held"
  | "confirmed"
  | "disproven";

export type BeliefFrame =
  | "claim"
  | "verify"
  | "counter"
  | "entanglement"
  | "stabilize"
  | "anchor";

export interface BeliefRecord {
  id: string;
  subject: string;
  belief: string;
  confidence: number;
  status: BeliefStatus;
  frame: BeliefFrame;
  source: string;
  lastUpdatedAt: string;
  sourceCurrentId?: string;
  sourceSignalId?: string;
  sourceRelationshipId?: string;
  sourceRivalId?: string;
}

export interface MemoryState {
  characterId: string;
  coherence: number;
  episodes: MemoryEpisode[];
  beliefs: BeliefRecord[];
  unresolvedThreads: string[];
  lastReflectionAt?: string;
}
