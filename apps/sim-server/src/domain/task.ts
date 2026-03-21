export type TaskKind =
  | "access"
  | "momentum"
  | "signal"
  | "coherence"
  | "travel"
  | "recovery";

export type TaskStatus = "pending" | "active" | "completed" | "missed";

export interface Task {
  id: string;
  characterId: string;
  title: string;
  description: string;
  kind: TaskKind;
  location: string;
  startAt: string;
  dueAt: string;
  durationMinutes: number;
  progressMinutes: number;
  travelMinutes: number;
  travelProgressMinutes: number;
  status: TaskStatus;
  importance: number;
  mandatory: boolean;
  createdBy: "scenario" | "system" | "player";
  dynamic?: boolean;
  sourceSignalId?: string;
  sourceCurrentId?: string;
  sourceRelationshipId?: string;
  sourceRivalId?: string;
  startedAt?: string;
  lastProgressAt?: string;
  completedAt?: string;
  missedAt?: string;
}
