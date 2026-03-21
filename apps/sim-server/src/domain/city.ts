export type CityAxis = "access" | "momentum" | "signal" | "coherence";
export type OpeningVisibility = "hidden" | "whispered" | "open";
export type OpeningStatus = "emerging" | "active" | "claimed" | "closed";

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

export interface CityOpening {
  id: string;
  title: string;
  summary: string;
  axis: CityAxis;
  districtId: string;
  factionIds: string[];
  urgency: number;
  exclusivity: number;
  visibility: OpeningVisibility;
  status: OpeningStatus;
  discoveredByCharacterIds: string[];
  claimCharacterId?: string;
  claimedByRivalId?: string;
  closesAtTick?: number;
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
  openings: CityOpening[];
  rivals: RivalNetwork[];
  clocks: CityClock[];
  summaryLines: string[];
}
