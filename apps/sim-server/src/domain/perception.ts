import type { CityAxis } from "./city.js";

export type PerceivedSignalKind =
  | "contact_shift"
  | "threshold_shift"
  | "rumor_sharpened"
  | "rival_trace"
  | "scene_heat"
  | "tech_glimmer";

export interface PerceivedSignal {
  id: string;
  characterId: string;
  kind: PerceivedSignalKind;
  axis: CityAxis;
  summary: string;
  source: string;
  districtId?: string;
  currentId?: string;
  strength: number;
  clarity: number;
  createdAt: string;
  tags: string[];
}
