import type { StreetGameState } from "../street-sim/types.js";

export interface CreateGameRequest {
  scenarioId?: string;
}

export interface GameStateResponse {
  game: StreetGameState;
}

export interface TickGameRequest {
  ticks?: number;
  minutes?: number;
}

export interface MoveCommand {
  type: "move_to";
  x: number;
  y: number;
}

export interface ActCommand {
  type: "act";
  actionId: string;
}

export interface WaitCommand {
  type: "wait";
  minutes: number;
}

export interface UpdatePolicyCommand {
  type: "update_policy";
  characterId?: string;
  policy?: Record<string, unknown>;
}

export interface UpdatePolicyRequest {
  characterId?: string;
  policy?: Record<string, unknown>;
}

export type GameCommand =
  | MoveCommand
  | ActCommand
  | WaitCommand
  | UpdatePolicyCommand;
