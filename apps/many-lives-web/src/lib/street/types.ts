export type TileKind =
  | "lane"
  | "plaza"
  | "stoop"
  | "roof"
  | "workyard"
  | "courtyard"
  | "dock"
  | "water"
  | "garden";

export interface MapTile {
  x: number;
  y: number;
  kind: TileKind;
  walkable: boolean;
  locationId?: string;
  district?: string;
}

export interface MapLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  tone: "street" | "district" | "landmark";
}

export type MapFootprintKind =
  | "building"
  | "market"
  | "yard"
  | "dock"
  | "water"
  | "garden";

export type RoofStyle = "slate" | "tin" | "plaster" | "timber";

export interface MapFootprint {
  id: string;
  kind: MapFootprintKind;
  x: number;
  y: number;
  width: number;
  height: number;
  locationId?: string;
  roofStyle?: RoofStyle;
}

export type MapDoorKind = "entry" | "service" | "gate";

export interface MapDoor {
  id: string;
  locationId: string;
  kind: MapDoorKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MapPropKind =
  | "lamp"
  | "crate"
  | "barrel"
  | "cart"
  | "laundry"
  | "bench"
  | "canopy"
  | "bollard"
  | "pump"
  | "tree";

export interface MapProp {
  id: string;
  kind: MapPropKind;
  x: number;
  y: number;
  locationId?: string;
  scale?: number;
  rotation?: number;
}

export interface CityMap {
  width: number;
  height: number;
  tiles: MapTile[];
  labels: MapLabel[];
  footprints: MapFootprint[];
  doors: MapDoor[];
  props: MapProp[];
}

export interface LocationState {
  id: string;
  name: string;
  shortLabel: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  entryX: number;
  entryY: number;
  labelX: number;
  labelY: number;
  description: string;
  neighborhood: string;
  openHour: number;
  closeHour: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
}

export interface MemoryEntry {
  id: string;
  time: string;
  kind: "place" | "person" | "job" | "problem" | "self";
  text: string;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  currentLocationId?: string;
  homeLocationId: string;
  money: number;
  energy: number;
  inventory: InventoryItem[];
  knownLocationIds: string[];
  knownNpcIds: string[];
  activeJobId?: string;
  reputation: Record<string, number>;
  memories: MemoryEntry[];
}

export interface NpcState {
  id: string;
  name: string;
  role: string;
  summary: string;
  currentLocationId: string;
  trust: number;
  known: boolean;
  memory: string[];
}

export interface JobState {
  id: string;
  title: string;
  summary: string;
  giverNpcId: string;
  locationId: string;
  startHour: number;
  endHour: number;
  durationMinutes: number;
  pay: number;
  discovered: boolean;
  accepted: boolean;
  completed: boolean;
  missed: boolean;
  unlockedBy?: string;
}

export interface ProblemState {
  id: string;
  title: string;
  summary: string;
  locationId: string;
  status: "hidden" | "active" | "solved" | "expired";
  discovered: boolean;
  urgency: number;
  rewardMoney: number;
  requiredItemId?: string;
  consequenceIfIgnored: string;
  benefitIfSolved: string;
}

export interface FeedEntry {
  id: string;
  time: string;
  tone: "info" | "job" | "problem" | "memory";
  text: string;
}

export interface SceneSummary {
  locationId?: string;
  title: string;
  description: string;
  people: Array<{
    id: string;
    name: string;
    role: string;
    known: boolean;
  }>;
  notes: Array<{
    id: string;
    text: string;
    tone: "info" | "lead" | "warning";
  }>;
}

export interface ActionOption {
  id: string;
  label: string;
  description: string;
  kind:
    | "talk"
    | "accept_job"
    | "work_job"
    | "buy"
    | "solve"
    | "rest"
    | "inspect";
  emphasis: "low" | "medium" | "high";
  disabled?: boolean;
  disabledReason?: string;
}

export interface ClockState {
  day: number;
  hour: number;
  minute: number;
  totalMinutes: number;
  label: string;
}

export interface StreetGameState {
  id: string;
  scenarioName: string;
  cityName: string;
  districtName: string;
  currentTime: string;
  clock: ClockState;
  map: CityMap;
  locations: LocationState[];
  player: PlayerState;
  npcs: NpcState[];
  jobs: JobState[];
  problems: ProblemState[];
  feed: FeedEntry[];
  currentScene: SceneSummary;
  availableActions: ActionOption[];
  goals: string[];
  summary: string;
}

export interface GameStateResponse {
  game: StreetGameState;
}
