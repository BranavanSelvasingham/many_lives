import type { PolicySettings } from "../domain/policy.js";
import type { WorldState } from "../domain/world.js";

export interface CreateGameRequest {
  scenarioId?: string;
}

export interface GameStateResponse {
  game: WorldState;
}

export interface TickGameRequest {
  ticks?: number;
  minutes?: number;
}

export interface ResolveInboxCommand {
  type: "resolve_inbox";
  messageId: string;
  actionId?: string;
  overrideText?: string;
}

export interface SnoozeInboxCommand {
  type: "snooze_inbox";
  messageId: string;
  durationMinutes: number;
}

export interface DelegateInboxCommand {
  type: "delegate_inbox";
  messageId: string;
  targetCharacterId: string;
}

export interface UpdatePolicyCommand {
  type: "update_policy";
  characterId: string;
  policy: Partial<PolicySettings>;
}

export interface UpdatePolicyRequest {
  characterId: string;
  policy: Partial<PolicySettings>;
}

export type GameCommand =
  | ResolveInboxCommand
  | SnoozeInboxCommand
  | DelegateInboxCommand
  | UpdatePolicyCommand;
