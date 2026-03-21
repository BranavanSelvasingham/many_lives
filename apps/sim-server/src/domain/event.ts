import type { InboxPriority } from "./inbox.js";

export type EventType =
  | "world_shift"
  | "signal_detected"
  | "current_lost"
  | "rival_advance"
  | "rival_trace"
  | "contact_shift"
  | "threshold_shift"
  | "rumor_sharpened"
  | "scene_heat"
  | "tech_glimmer"
  | "coherence_drift"
  | "task_started"
  | "task_completed"
  | "obligation_missed"
  | "schedule_conflict"
  | "travel_delay"
  | "stress_spike"
  | "player_response"
  | "policy_update";

export interface EventRecord {
  id: string;
  characterId: string;
  type: EventType;
  priority: InboxPriority;
  title: string;
  description: string;
  createdAt: string;
  relatedTaskId?: string;
  relatedTaskIds?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export type NewEvent = Omit<EventRecord, "id">;
