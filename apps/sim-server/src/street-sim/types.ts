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
  context?: string;
  backstory?: string;
  locationId?: string;
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
  | "tree"
  | "fountain"
  | "planter"
  | "boat";

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

export type LocationType =
  | "home"
  | "eatery"
  | "shop"
  | "square"
  | "workyard"
  | "courtyard"
  | "pier";

export interface LocationState {
  id: string;
  name: string;
  shortLabel: string;
  type: LocationType;
  x: number;
  y: number;
  width: number;
  height: number;
  entryX: number;
  entryY: number;
  labelX: number;
  labelY: number;
  description: string;
  context: string;
  backstory: string;
  neighborhood: string;
  openHour: number;
  closeHour: number;
}

export interface SettingNarrativeProfile {
  context: string;
  backstory: string;
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

export interface ConversationEntry {
  id: string;
  time: string;
  threadId: string;
  npcId: string;
  speaker: "player" | "npc";
  speakerName: string;
  text: string;
  locationId?: string;
}

export interface ConversationThreadState {
  id: string;
  npcId: string;
  updatedAt: string;
  locationId?: string;
  decision?: string;
  objectiveKey?: string;
  objectiveText?: string;
  summary?: string;
  lines: ConversationEntry[];
}

export interface ActiveConversationState {
  id: string;
  threadId: string;
  npcId: string;
  locationId?: string;
  updatedAt: string;
  decision?: string;
  objectiveKey?: string;
  objectiveText?: string;
  lines: ConversationEntry[];
}

export type ObjectiveFocus =
  | "settle"
  | "work"
  | "explore"
  | "help"
  | "rest"
  | "tool"
  | "people"
  | "custom";

export type ObjectiveSource = "seed" | "manual" | "conversation" | "dynamic";

export interface ObjectiveTrailItem {
  id: string;
  title: string;
  detail?: string;
  progress?: string;
  timestamp?: string;
  done?: boolean;
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
}

export interface ObjectiveProgressState {
  completed: number;
  total: number;
  label: string;
}

export interface PlayerObjective {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  focus: ObjectiveFocus;
  source: ObjectiveSource;
  routeKey: string;
  trail: ObjectiveTrailItem[];
  completedTrail: ObjectiveTrailItem[];
  progress: ObjectiveProgressState;
}

export interface FirstAfternoonState {
  completedAt?: string;
  planSettledAt?: string;
  teaShiftStage?: "rush" | "counter" | "paid";
}

export interface PendingObjectiveMove {
  targetLocationId: string;
  objectiveText: string;
  rationale: string;
  npcId?: string;
  actionId?: string;
  speech?: string;
  preparedAt: string;
}

export interface PlayerState {
  id: string;
  name: string;
  backstory: string;
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
  objective?: PlayerObjective;
  pendingObjectiveMove?: PendingObjectiveMove;
  currentThought?: string;
  lastRestAt?: string;
  reputation: Record<string, number>;
  memories: MemoryEntry[];
}

export interface NpcScheduleStop {
  locationId: string;
  fromHour: number;
  toHour: number;
}

export interface NpcNarrativeProfile {
  backstory: string;
  context: string;
  objective: string;
  voice: string;
}

export interface NpcState {
  id: string;
  name: string;
  role: string;
  summary: string;
  narrative: NpcNarrativeProfile;
  currentLocationId: string;
  trust: number;
  openness: number;
  known: boolean;
  mood: string;
  currentObjective: string;
  currentConcern: string;
  currentThought?: string;
  lastSpokenLine?: string;
  lastInteractionAt?: string;
  memory: string[];
  schedule: NpcScheduleStop[];
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
  deferredUntilMinutes?: number;
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

export interface SceneNote {
  id: string;
  text: string;
  tone: "info" | "lead" | "warning";
}

export interface SceneSummary {
  locationId?: string;
  title: string;
  description: string;
  context?: string;
  backstory?: string;
  people: Array<{
    id: string;
    name: string;
    role: string;
    known: boolean;
  }>;
  notes: SceneNote[];
}

export type ActionKind =
  | "talk"
  | "accept_job"
  | "work_job"
  | "buy"
  | "contribute"
  | "solve"
  | "rest"
  | "reflect"
  | "inspect";

export interface ActionOption {
  id: string;
  label: string;
  description: string;
  kind: ActionKind;
  emphasis: "low" | "medium" | "high";
  matchesObjective?: boolean;
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

export type RowanAutonomyLayer =
  | "commitment"
  | "conversation"
  | "idle"
  | "objective";

export type RowanAutonomyStepKind =
  | "act"
  | "blocked"
  | "idle"
  | "move"
  | "observe"
  | "reflect"
  | "talk"
  | "wait";

export type RowanAutonomyEffect =
  | "conversation"
  | "memory"
  | "objective"
  | "thought";

export interface RowanAutonomyState {
  actionId?: string;
  autoContinue: boolean;
  detail: string;
  effects?: RowanAutonomyEffect[];
  key: string;
  label: string;
  layer?: RowanAutonomyLayer;
  mode: "acting" | "blocked" | "conversation" | "idle" | "moving" | "waiting";
  npcId?: string;
  stepKind?: RowanAutonomyStepKind;
  targetLocationId?: string;
}

export interface StreetGameState {
  id: string;
  scenarioName: string;
  cityName: string;
  cityNarrative: SettingNarrativeProfile;
  districtName: string;
  districtNarrative: SettingNarrativeProfile;
  visualSceneId?: string;
  currentTime: string;
  clock: ClockState;
  map: CityMap;
  locations: LocationState[];
  player: PlayerState;
  npcs: NpcState[];
  jobs: JobState[];
  problems: ProblemState[];
  firstAfternoon?: FirstAfternoonState;
  feed: FeedEntry[];
  conversations: ConversationEntry[];
  conversationThreads: Record<string, ConversationThreadState>;
  activeConversation?: ActiveConversationState;
  currentScene: SceneSummary;
  availableActions: ActionOption[];
  goals: string[];
  rowanAutonomy: RowanAutonomyState;
  summary: string;
}
