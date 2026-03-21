import type { PolicySettings } from "./policy.js";

export type CharacterRole = "architect" | "signal" | "gravity" | "threshold";

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  traits: string[];
  values: string[];
  ambitions: string[];
  fears: string[];
  standingInstincts: string[];
  attentionStyle: string;
  relationshipToPlayer: string;
  homeLocation: string;
  currentLocation: string;
  energy: number;
  stress: number;
  memoryCoherence: number;
  cash: number;
  activeTaskId: string | null;
  obligations: string[];
  scheduleSummary: string;
  policies: PolicySettings;
  lastStressAlertTick?: number;
}
