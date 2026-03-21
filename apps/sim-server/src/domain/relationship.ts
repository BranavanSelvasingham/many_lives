export type RelationshipTargetType =
  | "character"
  | "faction"
  | "rival"
  | "player"
  | "city";

export interface RelationshipState {
  id: string;
  sourceCharacterId: string;
  targetType: RelationshipTargetType;
  targetId: string;
  label: string;
  trust: number;
  affinity: number;
  dependency: number;
  strain: number;
  summary: string;
  lastUpdatedAt: string;
}
