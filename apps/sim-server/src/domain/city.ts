export type CityAxis = "access" | "momentum" | "signal" | "coherence";
export type CurrentVisibility = "hidden" | "whispered" | "open";
export type CurrentStatus = "forming" | "live" | "claimed" | "dissolved";

export interface CityDistrict {
  id: string;
  name: string;
  kind: string;
  heat: number;
  prestige: number;
  summary: string;
}

export interface CityFaction {
  id: string;
  name: string;
  domain: string;
  power: number;
  openness: number;
  summary: string;
}

export interface CityCurrent {
  id: string;
  title: string;
  summary: string;
  axis: CityAxis;
  districtId: string;
  factionIds: string[];
  urgency: number;
  exclusivity: number;
  visibility: CurrentVisibility;
  status: CurrentStatus;
  sensedByCharacterIds: string[];
  seizedByCharacterId?: string;
  lockedByRivalId?: string;
  dissipatesAtTick?: number;
  tags: string[];
}

export interface RivalNetwork {
  id: string;
  name: string;
  style: string;
  focus: CityAxis;
  momentum: number;
  threat: number;
  summary: string;
}

export interface CityClock {
  id: string;
  label: string;
  progress: number;
  maxProgress: number;
  danger: number;
}

export interface City {
  id: string;
  name: string;
  premise: string;
  districts: CityDistrict[];
  factions: CityFaction[];
  currents: CityCurrent[];
  rivals: RivalNetwork[];
  clocks: CityClock[];
  summaryLines: string[];
}
