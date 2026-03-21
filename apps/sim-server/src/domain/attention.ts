import type { InboxPriority } from "./inbox.js";

export type AttentionTier =
  | "silent"
  | "ambient"
  | "digest"
  | "message"
  | "interrupt";

export interface AttentionSignal {
  stakes: number;
  reversibility: number;
  confidence: number;
  novelty: number;
  coherenceThreat: number;
  rivalPressure: number;
  playerRelevance: number;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  priority: InboxPriority;
  score: number;
  tier: AttentionTier;
  reason: string;
  signals: AttentionSignal;
}

export interface NotificationRecord {
  id: string;
  characterId: string;
  eventId: string;
  tier: AttentionTier;
  priority: InboxPriority;
  subject: string;
  summary: string;
  createdAt: string;
}
