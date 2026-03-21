import type { CityAxis } from "./city.js";

export type InterpretationKind =
  | "press_advantage"
  | "verify_signal"
  | "counter_rival"
  | "manage_entanglement"
  | "protect_coherence";

export interface InterpretationRecord {
  id: string;
  characterId: string;
  kind: InterpretationKind;
  axis: CityAxis;
  summary: string;
  rationale: string;
  source: string;
  confidence: number;
  urgency: number;
  createdAt: string;
  sourceSignalId?: string;
  sourceCurrentId?: string;
  sourceRelationshipId?: string;
  sourceRivalId?: string;
  tags: string[];
}

export interface ActiveIntent {
  id: string;
  characterId: string;
  kind: InterpretationKind;
  axis: CityAxis;
  source: string;
  summary: string;
  rationale: string;
  priority: number;
  confidence: number;
  createdAt: string;
  sourceInterpretationId: string;
  sourceSignalId?: string;
  sourceCurrentId?: string;
  sourceRelationshipId?: string;
  sourceRivalId?: string;
  rank: number;
}
