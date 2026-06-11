export type TileKind =
  | "lane"
  | "plaza"
  | "stoop"
  | "floor"
  | "wall"
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

export interface GridPoint {
  x: number;
  y: number;
}

export type SpaceKind = "street" | "interior";

export type SpaceObjectKind =
  | "wall"
  | "counter"
  | "table"
  | "chair"
  | "bed"
  | "shelf"
  | "bench"
  | "workbench"
  | "stove"
  | "desk"
  | "rug";

export interface SpaceObject {
  id: string;
  kind: SpaceObjectKind;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  solid: boolean;
}

export type SpaceAnchorKind = "spawn" | "npc" | "action" | "portal";

export interface SpaceAnchor {
  id: string;
  kind: SpaceAnchorKind;
  x: number;
  y: number;
  label?: string;
  npcId?: string;
  actionId?: string;
}

export interface SpacePortal {
  id: string;
  label: string;
  locationId: string;
  actionId: string;
  reversePortalId: string;
  fromSpaceId: string;
  from: GridPoint;
  toSpaceId: string;
  to: GridPoint;
}

export interface SpaceDefinition {
  id: string;
  name: string;
  kind: SpaceKind;
  locationId?: string;
  width: number;
  height: number;
  tiles: MapTile[];
  objects: SpaceObject[];
  anchors: SpaceAnchor[];
  portals: SpacePortal[];
  camera?: {
    minZoom?: number;
    maxZoom?: number;
  };
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

export type ObjectiveOutcomeStatus =
  | "open"
  | "blocked"
  | "at_risk"
  | "met"
  | "failed";

export type ObjectiveOutcomeAuthority = "predicate" | "trail";

export interface ObjectiveOutcomeState {
  id: string;
  label: string;
  status: ObjectiveOutcomeStatus;
  urgency: number;
  authority?: ObjectiveOutcomeAuthority;
  blockers?: string[];
  evidence?: string;
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
}

export interface PlayerObjective {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  focus: ObjectiveFocus;
  source: ObjectiveSource;
  routeKey: string;
  outcomes: ObjectiveOutcomeState[];
  trail: ObjectiveTrailItem[];
  completedTrail: ObjectiveTrailItem[];
  progress: ObjectiveProgressState;
}

export interface FirstAfternoonState {
  completedAt?: string;
  completionAcknowledgedAt?: string;
  leadFieldNote?: {
    createdAt: string;
    evidence: string;
    learned: string;
    memory: string;
    next: string;
  };
  fieldNote?: {
    createdAt: string;
    evidence: string;
    learned: string;
    memory: string;
    next: string;
  };
  planSettledAt?: string;
  teaShiftStage?: "rush" | "counter" | "paid";
}

export interface PendingObjectiveMove {
  targetLocationId: string;
  objectiveText: string;
  rationale: string;
  npcId?: string;
  actionId?: string;
  planningTrace?: RowanPlanningTrace;
  speech?: string;
  preparedAt: string;
}

export interface PlayerState {
  id: string;
  name: string;
  backstory: string;
  spaceId?: string;
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
  spaceId?: string;
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
  currentSpaceId?: string;
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
  missedAt?: string;
  consequenceAppliedAt?: string;
  deferredUntilMinutes?: number;
  unlockedBy?: string;
}

export interface ProblemState {
  id: string;
  title: string;
  summary: string;
  locationId: string;
  status: "hidden" | "active" | "solved" | "expired" | "resolved";
  discovered: boolean;
  urgency: number;
  escalationLevel?: number;
  escalatedAt?: string;
  expiredAt?: string;
  resolvedAt?: string;
  resolvedByNpcId?: string;
  consequenceAppliedAt?: string;
  rewardMoney: number;
  requiredItemId?: string;
  consequenceIfIgnored: string;
  benefitIfSolved: string;
}

export type CityEventKind =
  | "cafe_prep"
  | "lunch_rush"
  | "market_crossing"
  | "square_cart"
  | "yard_loading";

export type CityEventStatus = "upcoming" | "active" | "resolved";
export type CityEventOutcome =
  | "handled"
  | "missed"
  | "passed"
  | "pending"
  | "worsened";

export interface CityEventState {
  id: string;
  kind: CityEventKind;
  title: string;
  locationId: string;
  status: CityEventStatus;
  startMinute: number;
  endMinute: number;
  summary: string;
  visibleLabel: string;
  tone: "info" | "lead" | "warning";
  participants?: string[];
  progress?: string;
  outcome?: CityEventOutcome;
  resolvedAt?: string;
  updatedAt: string;
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
  spaceId?: string;
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
  | "enter"
  | "exit"
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
  spaceId?: string;
  targetAnchorId?: string;
  targetLocationId?: string;
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

export type RowanAutonomyTravelPhase = "route-progress";

export type RowanAutonomyEffect =
  | "conversation"
  | "memory"
  | "objective"
  | "thought";

export interface RowanAutonomyIntent {
  reason: string;
  signals: string[];
}

export type RowanPlanningTraceProvenance =
  | "legal-action"
  | "live-pressure"
  | "objective-predicate"
  | "route-scaffold"
  | "stale-predicate";

export type RowanPlanningTraceLegalBackingSource =
  | "conversation-resolution"
  | "current-legal-action-surface"
  | "destination-preview-legal-action"
  | "projected-follow-up-legal-action"
  | "simulator-validated-move"
  | "simulator-validated-wait";

export type RowanPlanningTraceRecommendationSourceKind =
  | "deterministic-planner"
  | "live-llm";

export type RowanPlanningTraceValidationStatus =
  | "conversation-resolution"
  | "legal-action-surface-validated"
  | "projected-legal-action"
  | "simulator-validated"
  | "unvalidated";

export interface RowanPlanningTraceLegalBacking {
  actionId?: string;
  locationId?: string;
  source: RowanPlanningTraceLegalBackingSource;
}

export interface RowanPlanningTraceSelectedRecommendation {
  accepted: boolean;
  advisory: boolean;
  confidence?: number;
  legalBackingSource?: RowanPlanningTraceLegalBackingSource;
  model?: string;
  provider?: string;
  rationale?: string;
  sourceKind: RowanPlanningTraceRecommendationSourceKind;
  validationSource?: RowanPlanningTraceLegalBackingSource;
  validationStatus: RowanPlanningTraceValidationStatus;
}

export interface RowanPlanningTraceOption {
  actionId?: string;
  label: string;
  legalBacking?: RowanPlanningTraceLegalBacking;
  matchedOutcomeId?: string;
  pressureId?: string;
  pressureKind?: string;
  pressureLabel?: string;
  planKey: string;
  provenance: RowanPlanningTraceProvenance;
  rationale: string;
  reason?: string;
  score: number;
  status: "selected" | "rejected";
  targetLocationId?: string;
  npcId?: string;
}

export interface RowanPlanningTraceStep {
  actionId?: string;
  kind: RowanAutonomyStepKind;
  label: string;
  legalBacking?: RowanPlanningTraceLegalBacking;
  legal: boolean;
  npcId?: string;
  rationale: string;
  targetLocationId?: string;
  validation: string;
}

export interface RowanPlanningTraceOutcome {
  authority?: ObjectiveOutcomeAuthority;
  id: string;
  label: string;
  status: ObjectiveOutcomeStatus;
  urgency: number;
  blockers?: string[];
  evidence?: string;
}

export interface RowanPlanningTrace {
  blockers: string[];
  considered: RowanPlanningTraceOption[];
  nextSteps: RowanPlanningTraceStep[];
  outcomes: RowanPlanningTraceOutcome[];
  rejected: RowanPlanningTraceOption[];
  selectedActionId?: string;
  selectedLabel?: string;
  selectedLegalBacking?: RowanPlanningTraceLegalBacking;
  selectedMatchedOutcomeId?: string;
  selectedPlanKey?: string;
  selectedPressureId?: string;
  selectedPressureKind?: string;
  selectedPressureLabel?: string;
  selectedRecommendation?: RowanPlanningTraceSelectedRecommendation;
  selectedTargetLocationId?: string;
}

export interface RowanAutonomyState {
  actionId?: string;
  autoContinue: boolean;
  detail: string;
  effects?: RowanAutonomyEffect[];
  intent?: RowanAutonomyIntent;
  key: string;
  label: string;
  layer?: RowanAutonomyLayer;
  mode: "acting" | "blocked" | "conversation" | "idle" | "moving" | "waiting";
  npcId?: string;
  planningTrace?: RowanPlanningTrace;
  stepKind?: RowanAutonomyStepKind;
  targetLocationId?: string;
  travelPhase?: RowanAutonomyTravelPhase;
}

export interface RowanCognitionNeedSummary {
  key: string;
  label: string;
  reason: string;
  status: "active" | "stable" | "urgent";
}

export interface RowanCognitionBeliefSummary {
  confidence: "confirmed" | "possible" | "promising";
  id: string;
  locationId?: string;
  npcId?: string;
  source: string;
  text: string;
  topic: "belonging" | "help" | "shelter" | "tool" | "work";
}

export interface RowanCognitionNextMoveSummary {
  actionId?: string;
  kind?: RowanAutonomyStepKind;
  npcId?: string;
  rationale: string;
  targetLocationId?: string;
  text: string;
}

export interface RowanNotebookAuthoritySummary {
  belief: string;
  clue: string;
  confidence: string;
  plan: string;
  title: string;
  uncertainty: string;
  authority: {
    beliefConfidence?: RowanCognitionBeliefSummary["confidence"];
    beliefId?: string;
    beliefSource?: string;
    nextMoveActionId?: string;
    nextMoveNpcId?: string;
    nextMoveRationale?: string;
    nextMoveTargetLocationId?: string;
    notebookNeedKey?: string;
    primaryNeedKey?: string;
  };
}

export interface RowanCognitionState {
  currentBelief?: RowanCognitionBeliefSummary;
  nextMove?: RowanCognitionNextMoveSummary;
  notebook: RowanNotebookAuthoritySummary;
  primaryNeed?: RowanCognitionNeedSummary;
}

export type AIRuntimeTask =
  | "generateStreetAutonomousLine"
  | "generateStreetReply"
  | "generateStreetThoughts"
  | "interpretStreetConversation"
  | "planStreetNextAction";

export interface AIRuntimeTaskSummary {
  fallbacks: number;
  lastFallbackReason?: string;
  lastStatus?: "fallback" | "skipped" | "success";
  lastUpdatedAt?: string;
  skips: number;
  successes: number;
}

export interface AIRuntimeState {
  fallbackReasons: string[];
  lastLiveCallAt?: string;
  lastUpdatedAt?: string;
  model: string;
  provider: string;
  status: "fallback" | "live" | "not_called";
  tasks: Record<AIRuntimeTask, AIRuntimeTaskSummary>;
  totalFallbacks: number;
  totalSkips: number;
  totalSuccesses: number;
}

export interface StreetGameState {
  id: string;
  scenarioName: string;
  cityName: string;
  cityNarrative: SettingNarrativeProfile;
  districtName: string;
  districtNarrative: SettingNarrativeProfile;
  visualSceneId?: string;
  activeSpaceId?: string;
  aiRuntime?: AIRuntimeState;
  currentTime: string;
  clock: ClockState;
  map: CityMap;
  spaces?: SpaceDefinition[];
  locations: LocationState[];
  player: PlayerState;
  npcs: NpcState[];
  jobs: JobState[];
  problems: ProblemState[];
  cityEvents: CityEventState[];
  firstAfternoon?: FirstAfternoonState;
  feed: FeedEntry[];
  conversations: ConversationEntry[];
  conversationThreads: Record<string, ConversationThreadState>;
  activeConversation?: ActiveConversationState;
  currentScene: SceneSummary;
  availableActions: ActionOption[];
  goals: string[];
  rowanAutonomy: RowanAutonomyState;
  rowanCognition?: RowanCognitionState;
  summary: string;
}
