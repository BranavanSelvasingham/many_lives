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

export interface BeliefRecord {
  id: string;
  subject: string;
  belief: string;
  confidence: number;
  lastConfirmedAt: string;
}

export interface MemoryState {
  characterId: string;
  coherence: number;
  episodes: MemoryEpisode[];
  beliefs: BeliefRecord[];
  unresolvedThreads: string[];
  lastReflectionAt?: string;
}
