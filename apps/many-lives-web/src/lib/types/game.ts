export type SourceMode = "backend" | "mock";
export type InboxTab =
  | "All"
  | "Urgent"
  | "Waiting"
  | "Reports"
  | "Opportunities";
export type RightPanelMode = "message" | "character" | "policy" | "rule";
export type PriorityLevel = "urgent" | "high" | "normal" | "low";
export type MessageType =
  | "interruption"
  | "status"
  | "decision"
  | "opportunity"
  | "social";
export type RiskLevel = "none" | "low" | "medium" | "high";

export type AutonomyLevel = "low" | "medium" | "high";
export type InterruptWhen = "always" | "important_only" | "emergencies_only";
export type PriorityBias =
  | "work"
  | "family"
  | "money"
  | "health"
  | "relationships";
export type RiskTolerance = "careful" | "balanced" | "aggressive";
export type ScheduleProtection = "strict" | "flexible" | "opportunistic";
export type ReportingFrequency = "minimal" | "standard" | "detailed";
export type EscalationSensitivity = "low" | "normal" | "high";
export type SpendPreset = "0" | "50" | "200" | "custom";

export interface PolicySettings {
  autonomy: AutonomyLevel;
  spendWithoutAsking: number;
  spendPreset: SpendPreset;
  interruptWhen: InterruptWhen;
  priorityBias: PriorityBias;
  riskTolerance: RiskTolerance;
  scheduleProtection: ScheduleProtection;
  reportingFrequency: ReportingFrequency;
  escalationSensitivity: EscalationSensitivity;
  ruleSummary: string;
}

export interface CharacterView {
  id: string;
  name: string;
  role: string;
  subtitle: string;
  currentTask: string;
  currentTaskEnds?: string;
  location: string;
  stress: number;
  energy: number;
  cash: number;
  urgency: PriorityLevel;
  nextObligation: string;
  nextObligationSnippet: string;
  recentEvents: string[];
  priorities: string[];
  autonomyProfile: string;
  policy: PolicySettings;
  scheduleSummary: string;
  load: number;
}

export interface InboxAction {
  id: string;
  label: string;
}

export interface InboxMessageView {
  id: string;
  characterId: string;
  senderName: string;
  type: MessageType;
  priority: PriorityLevel;
  subject: string;
  body: string;
  preview: string;
  createdAt: string;
  createdAtIso: string;
  requiresResponse: boolean;
  suggestedActions: InboxAction[];
  consequences: Partial<
    Record<
      "money" | "stress" | "reputation" | "relationship" | "schedule",
      RiskLevel
    >
  >;
  snoozedUntil?: string | null;
  delegatedToCharacterId?: string;
  resolvedAt?: string | null;
}

export interface WorldSummary {
  urgentCount: number;
  activeThreads: number;
  upcomingObligations: string[];
  risks: {
    money: RiskLevel;
    relationship: RiskLevel;
    health: RiskLevel;
    schedule: RiskLevel;
  };
}

export interface GameState {
  gameId: string;
  scenarioName: string;
  time: string;
  currentTimeIso: string;
  tickCount: number;
  summary: string;
  source: SourceMode;
  characters: CharacterView[];
  inbox: InboxMessageView[];
  worldSummary: WorldSummary;
}

export interface RawPolicySettings {
  riskTolerance: number;
  spendingLimit: number;
  escalationThreshold: number;
  reportingFrequency: "low" | "normal" | "high";
  priorityBias: "work" | "family" | "money" | "health";
}

export interface RawCharacter {
  id: string;
  name: string;
  role: string;
  homeLocation: string;
  currentLocation: string;
  energy: number;
  stress: number;
  cash: number;
  activeTaskId: string | null;
  obligations: string[];
  scheduleSummary: string;
  policies: RawPolicySettings;
}

export interface RawTask {
  id: string;
  characterId: string;
  title: string;
  description: string;
  kind: string;
  location: string;
  startAt: string;
  dueAt: string;
  durationMinutes: number;
  progressMinutes: number;
  travelMinutes: number;
  travelProgressMinutes: number;
  status: string;
  importance: number;
  mandatory: boolean;
}

export interface RawEvent {
  id: string;
  characterId: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  createdAt: string;
  relatedTaskId?: string;
}

export interface RawInboxMessage {
  id: string;
  characterId: string;
  senderName?: string;
  type: "alert" | "summary" | "request" | "update";
  priority: "low" | "medium" | "high" | "critical";
  subject: string;
  body: string;
  suggestedActions: Array<string | { id?: string; label: string }>;
  requiresResponse: boolean;
  createdAt: string;
  eventId: string;
  consequences?: Partial<
    Record<
      "money" | "stress" | "reputation" | "relationship" | "schedule",
      RiskLevel
    >
  >;
  snoozedUntil?: string | null;
  delegatedToCharacterId?: string | null;
  resolvedAt?: string | null;
}

export interface RawWorldState {
  id: string;
  scenarioId: string;
  scenarioName: string;
  currentTime: string;
  tickCount: number;
  summary: string;
  characters: RawCharacter[];
  tasks: RawTask[];
  events: RawEvent[];
  inbox: RawInboxMessage[];
}

export interface GameResponse {
  game: RawWorldState;
}

export interface ResolveMessageInput {
  messageId: string;
  actionId: string;
  overrideText?: string;
}

export interface SnoozeMessageInput {
  messageId: string;
  durationMinutes: number;
}

export interface DelegateMessageInput {
  messageId: string;
  targetCharacterId: string;
}

export interface UpdatePolicyInput {
  characterId: string;
  policyPatch: Partial<{
    spendingLimit: number;
    priorityBias: "work" | "family" | "money" | "health";
    riskTolerance: number;
    reportingFrequency: "low" | "normal" | "high";
    escalationThreshold: number;
  }>;
  draft: PolicySettings;
}
