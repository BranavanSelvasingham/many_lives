export type TaskKind =
  | "work"
  | "family"
  | "health"
  | "money"
  | "study"
  | "travel"
  | "rest"
  | "errand";

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
  startedAt?: string;
  lastProgressAt?: string;
  completedAt?: string;
  missedAt?: string;
}
