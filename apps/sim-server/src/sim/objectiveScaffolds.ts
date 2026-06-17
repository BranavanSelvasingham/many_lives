import type {
  ActionKind,
  JobState,
  MemoryEntry,
  NpcState,
  ObjectiveFocus,
  ObjectiveTrailItem,
  ProblemState,
  StreetGameState,
} from "../street-sim/types.js";

export interface ObjectiveScaffoldDirective {
  focus: ObjectiveFocus;
  routeKey: string;
  text: string;
}

interface ScaffoldContext {
  objective: ObjectiveScaffoldDirective;
  world: StreetGameState;
}

interface SemanticHint {
  locationId?: string | ((context: ScaffoldContext) => string | undefined);
  npcId?: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface MoveIntentHint {
  actionId?: string;
  label?: string;
  locationId: string | ((context: ScaffoldContext) => string | undefined);
  npcId?: string;
  rationale: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface OutcomeMoveRationaleHint {
  matches: (outcomeLabel: string) => boolean;
  rationale: string | ((context: ScaffoldContext) => string);
}

interface PlayerFacingRationaleNormalizationHint {
  matches: (normalizedRationale: string, context: ScaffoldContext) => boolean;
  rationale: string | ((context: ScaffoldContext) => string);
}

interface ActionLocationReasonHint {
  matches: (input: {
    actionLabel: string;
    currentLocationName: string;
  }) => boolean;
  reason: string;
}

interface SemanticMoveBonus {
  locationId: string;
  score: number;
  when?: (
    context: ScaffoldContext & {
      predicateAuthority: boolean;
    },
  ) => boolean;
}

interface ConversationThoughtHint {
  npcId: string;
  routeKeys?: string[];
  thought: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface PlayerThoughtHint {
  routeKeys?: string[];
  thought: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface WorkStageThoughtHint {
  jobId: string;
  routeKeys?: string[];
  stage: NonNullable<
    NonNullable<StreetGameState["firstAfternoon"]>["teaShiftStage"]
  >;
  thought: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface ConversationTopicSuppression {
  npcId: string;
  routeKeys?: string[];
  topic: string;
  when?: (
    context: ScaffoldContext & {
      playerAskedTopic: boolean;
    },
  ) => boolean;
}

interface ConversationFallbackHint {
  choiceKey: string;
  followupChoiceKey: string;
  followupThoughts: string[];
  npcId: string;
  replyLines: string[];
  routeKeys?: string[];
  when?: (context: ScaffoldContext) => boolean;
}

export interface ObjectiveRouteConversationResolutionFallback {
  decision: string;
  memoryKind: MemoryEntry["kind"];
  memoryText: string;
  summary: string;
}

export interface ObjectiveRouteConversationGroundingPolicy {
  fallbackReason: string;
  fallbackReply: {
    followupThought: string;
    reply: string;
  };
  followupPlayerText: string;
  id: string;
  resolutionFallback: ObjectiveRouteConversationResolutionFallback;
}

interface ConversationGroundingPolicyHint
  extends ObjectiveRouteConversationGroundingPolicy {
  npcId: string;
  playerTextGroundsEvidence?: (text: string | undefined) => boolean;
  promptGroundedPlayerLines?: string[];
  promptRequiredLines?: string[];
  routeKeys?: string[];
  responseAffirmsEvidence: (text: string | undefined) => boolean;
  responseGroundsEvidence: (text: string | undefined) => boolean;
  resolutionPointsToEvidence: (
    resolution: {
      decision?: string;
      memoryText?: string;
      objectiveText?: string;
      summary?: string;
    },
  ) => boolean;
  when?: (
    context: ScaffoldContext & {
      playerText: string;
    },
  ) => boolean;
}

interface ActionRationaleHint {
  actionId?: string;
  npcId?: string;
  rationale: string;
  routeKeys?: string[];
  when?: (context: ScaffoldContext) => boolean;
}

interface SpeechHint {
  npcId: string;
  routeKeys: string[];
  speech: string;
  when?: (
    context: ScaffoldContext & {
      normalizedObjectiveText: string;
      playerConversationCount: number;
    },
  ) => boolean;
}

interface ActionTargetLocationHint {
  actionId: string;
  locationId: string | ((context: ScaffoldContext) => string | undefined);
  routeKeys?: string[];
}

interface AvailableActionHint {
  description: string;
  emphasis: "low" | "medium" | "high";
  id: string;
  kind: ActionKind;
  label: string;
  routeKeys?: string[];
  targetLocationId: string | ((context: ScaffoldContext) => string | undefined);
  when?: (context: ScaffoldContext) => boolean;
}

export interface ObjectiveRouteAvailableAction {
  description: string;
  emphasis: "low" | "medium" | "high";
  id: string;
  kind: ActionKind;
  label: string;
  targetLocationId: string;
}

export interface ObjectiveRouteOutcomeDefinition {
  id: string;
  label: string;
  urgency?: number;
  fallbackEvidence?: string;
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
}

export interface FirstAfternoonRouteState {
  atHome: boolean;
  hasActiveTeaJob: boolean;
  hasFinishedTeaShift: boolean;
  hasLeadFieldNote: boolean;
  hasRoomTerms: boolean;
  hasSettledPlan: boolean;
  hasStartedTeaShift: boolean;
  hasTakenTeaShift: boolean;
  hasTalkedToAda: boolean;
  hasTalkedToMara: boolean;
  homeLocationId?: string;
  teaJobAccepted: boolean;
  teaJobCompleted: boolean;
  teaJobDiscovered: boolean;
  teaJobId?: string;
  teaJobMissed: boolean;
  teaLeadViable: boolean;
  teaShiftStage?: NonNullable<
    NonNullable<StreetGameState["firstAfternoon"]>["teaShiftStage"]
  >;
  wrappedFirstAfternoon: boolean;
}

export interface MaraAdaLeadRouteState {
  hasFormedVerificationIntent: boolean;
  hasLeadFieldNote: boolean;
  hasLeadViable: boolean;
  hasOpenWorkChoice: boolean;
  hasReachedTeaHouse: boolean;
  hasTalkedToAda: boolean;
  hasTalkedToMara: boolean;
  homeLocationId?: string;
}

export interface SettleRouteState {
  anyLeadJobCompleted: boolean;
  anyLeadJobDiscovered: boolean;
  anyPlayerActiveJob: boolean;
  familiarPeople: number;
  hasCommittedIncome: boolean;
  hasStayTerms: boolean;
  hasTalkedToMara: boolean;
  hasWorkLead: boolean;
  homeLocationId?: string;
  homeLocationName?: string;
  houseStanding: number;
  lead: "tea" | "yard";
  leadJobAccepted: boolean;
  leadJobActive: boolean;
  leadJobCompleted: boolean;
  leadJobDiscovered: boolean;
  leadJobId?: string;
  leadJobLocationId?: string;
  leadJobMissed: boolean;
  settleLeadLocationId: string;
  settleLeadNpcId: string;
  settlePeopleTargetId?: string;
  settlePeopleTargetLocationId?: string;
}

export interface WorkRouteState {
  anyCompletedWork: boolean;
  lead: "tea" | "yard";
  leadConfirmed: boolean;
  leadJobAccepted: boolean;
  leadJobCompleted: boolean;
  leadJobDiscovered: boolean;
  leadJobId?: string;
  leadJobMissed: boolean;
  leadJobAtRisk: boolean;
  leadJobActive: boolean;
  leadLocationId?: string;
  leadLocationName?: string;
  leadNpcId?: string;
  leadNpcName?: string;
  playerMoney: number;
}

export interface CommittedJobRouteState {
  atLocation: boolean;
  beforeWindow: boolean;
  canWork: boolean;
  inWindow: boolean;
  jobCompleted: boolean;
  jobId: string;
  jobLocationId?: string;
  jobLocationName?: string;
  jobOpen: boolean;
  jobTitle: string;
  jobTitleLower: string;
}

export interface RestRouteState {
  atHome: boolean;
  homeLocationId?: string;
  homeLocationName?: string;
  playerEnergy: number;
  restLanded: boolean;
  restRequested: boolean;
}

export interface HelpProblemRouteState {
  hasWrench: boolean;
  problemActive: boolean;
  problemClosed: boolean;
  problemCleared: boolean;
  problemDiscovered: boolean;
  problemLocationId?: string;
  problemLocationName?: string;
  problemStatus?: ProblemState["status"];
}

export interface ToolProblemRouteState {
  hasWrench: boolean;
  targetCleared: boolean;
  targetDiscovered: boolean;
  targetId?: string;
  targetLocationId?: string;
  targetLocationName?: string;
  targetOpen: boolean;
  targetStatus?: ProblemState["status"];
  targetTitle?: string;
  toolAtProblem: boolean;
}

export interface PeopleRouteState {
  familiarPeople: number;
  friendObjective: boolean;
  secondConnectionTargetId?: string;
  secondConnectionTargetLocationId?: string;
  targetConversationCount: number;
  targetId?: string;
  targetLocationId?: string;
  targetName?: string;
  trustedPeople: number;
}

export interface ExploreRouteState {
  hasVisitedTarget: boolean;
  knownLocationCount: number;
  mapKnowledgeObjective: boolean;
  talkedAtTarget: boolean;
  targetGuideId?: string;
  targetGuideName?: string;
  targetId?: string;
  targetName?: string;
  targetPeopleCount: number;
}

interface FirstAfternoonRouteStepTemplate {
  actionId?: (state: FirstAfternoonRouteState) => string | undefined;
  detail: string | ((state: FirstAfternoonRouteState) => string);
  done: (state: FirstAfternoonRouteState) => boolean;
  id: string;
  npcId?: string | ((state: FirstAfternoonRouteState) => string | undefined);
  progress: string | ((state: FirstAfternoonRouteState) => string);
  targetLocationId?:
    | string
    | ((state: FirstAfternoonRouteState) => string | undefined);
  title: string;
}

interface FirstAfternoonRouteOutcomeTemplate {
  actionId?: (state: FirstAfternoonRouteState) => string | undefined;
  id: string;
  label: string;
  npcId?: string | ((state: FirstAfternoonRouteState) => string | undefined);
  targetLocationId?:
    | string
    | ((state: FirstAfternoonRouteState) => string | undefined);
  urgency: number;
}

interface MaraAdaLeadRouteStepTemplate {
  actionId?: (state: MaraAdaLeadRouteState) => string | undefined;
  detail: string | ((state: MaraAdaLeadRouteState) => string);
  done: (state: MaraAdaLeadRouteState) => boolean;
  id: string;
  npcId?: string | ((state: MaraAdaLeadRouteState) => string | undefined);
  progress: string | ((state: MaraAdaLeadRouteState) => string);
  targetLocationId?:
    | string
    | ((state: MaraAdaLeadRouteState) => string | undefined);
  title: string;
}

interface MaraAdaLeadRouteOutcomeTemplate {
  actionId?: (state: MaraAdaLeadRouteState) => string | undefined;
  id: string;
  label: string;
  npcId?: string | ((state: MaraAdaLeadRouteState) => string | undefined);
  targetLocationId?:
    | string
    | ((state: MaraAdaLeadRouteState) => string | undefined);
  urgency: number;
}

interface SettleRouteStepTemplate {
  actionId?: (state: SettleRouteState) => string | undefined;
  detail: string | ((state: SettleRouteState) => string);
  done: (state: SettleRouteState) => boolean;
  id: string;
  npcId?: string | ((state: SettleRouteState) => string | undefined);
  progress: string | ((state: SettleRouteState) => string);
  targetLocationId?: string | ((state: SettleRouteState) => string | undefined);
  title: string | ((state: SettleRouteState) => string);
}

interface SettleRouteOutcomeTemplate {
  actionId?: (state: SettleRouteState) => string | undefined;
  id: string;
  label: string | ((state: SettleRouteState) => string);
  npcId?: string | ((state: SettleRouteState) => string | undefined);
  targetLocationId?: string | ((state: SettleRouteState) => string | undefined);
  urgency: number;
}

interface WorkRouteStepTemplate {
  actionId?: (state: WorkRouteState) => string | undefined;
  detail: string | ((state: WorkRouteState) => string);
  done: (state: WorkRouteState) => boolean;
  id: string | ((state: WorkRouteState) => string);
  npcId?: string | ((state: WorkRouteState) => string | undefined);
  progress: string | ((state: WorkRouteState) => string);
  targetLocationId?: string | ((state: WorkRouteState) => string | undefined);
  title: string | ((state: WorkRouteState) => string);
}

interface WorkRouteOutcomeTemplate {
  actionId?: (state: WorkRouteState) => string | undefined;
  id: string | ((state: WorkRouteState) => string);
  label: string | ((state: WorkRouteState) => string);
  npcId?: string | ((state: WorkRouteState) => string | undefined);
  targetLocationId?: string | ((state: WorkRouteState) => string | undefined);
  urgency: number | ((state: WorkRouteState) => number);
}

interface CommittedJobRouteStepTemplate {
  actionId?: (state: CommittedJobRouteState) => string | undefined;
  detail: string;
  done: (state: CommittedJobRouteState) => boolean;
  id: string | ((state: CommittedJobRouteState) => string);
  progress: string | ((state: CommittedJobRouteState) => string);
  targetLocationId?: (state: CommittedJobRouteState) => string | undefined;
  title: string | ((state: CommittedJobRouteState) => string);
}

interface CommittedJobRouteOutcomeTemplate {
  actionId?: (state: CommittedJobRouteState) => string | undefined;
  id: string | ((state: CommittedJobRouteState) => string);
  label: string | ((state: CommittedJobRouteState) => string);
  targetLocationId?: (state: CommittedJobRouteState) => string | undefined;
  urgency: number;
}

interface RestRouteStepTemplate {
  actionId?: (state: RestRouteState) => string | undefined;
  detail: string | ((state: RestRouteState) => string);
  done: (state: RestRouteState) => boolean;
  id: string;
  progress: string | ((state: RestRouteState) => string);
  targetLocationId?: (state: RestRouteState) => string | undefined;
  title: string | ((state: RestRouteState) => string);
}

interface RestRouteOutcomeTemplate {
  actionId?: (state: RestRouteState) => string | undefined;
  id: string;
  label: string;
  targetLocationId?: (state: RestRouteState) => string | undefined;
  urgency: number;
}

interface HelpProblemRouteStepTemplate {
  actionId?: string | ((state: HelpProblemRouteState) => string | undefined);
  detail: string | ((state: HelpProblemRouteState) => string);
  done: (state: HelpProblemRouteState) => boolean;
  id: string;
  progress: string | ((state: HelpProblemRouteState) => string);
  targetLocationId?:
    | string
    | ((state: HelpProblemRouteState) => string | undefined);
  title: string | ((state: HelpProblemRouteState) => string);
}

interface HelpProblemRouteOutcomeTemplate {
  actionId?: (state: HelpProblemRouteState) => string | undefined;
  id: string;
  label: string;
  targetLocationId?:
    | string
    | ((state: HelpProblemRouteState) => string | undefined);
  urgency: number;
}

interface ToolProblemRouteStepTemplate {
  actionId?: string | ((state: ToolProblemRouteState) => string | undefined);
  detail: string | ((state: ToolProblemRouteState) => string);
  done: (state: ToolProblemRouteState) => boolean;
  id: string;
  progress: string | ((state: ToolProblemRouteState) => string);
  targetLocationId?:
    | string
    | ((state: ToolProblemRouteState) => string | undefined);
  title: string | ((state: ToolProblemRouteState) => string);
}

interface ToolProblemRouteOutcomeTemplate {
  actionId?: (state: ToolProblemRouteState) => string | undefined;
  id: string;
  label: string;
  targetLocationId?:
    | string
    | ((state: ToolProblemRouteState) => string | undefined);
  urgency: number;
}

interface PeopleRouteStepTemplate {
  detail: string | ((state: PeopleRouteState) => string);
  done: (state: PeopleRouteState) => boolean;
  id: string;
  npcId?: (state: PeopleRouteState) => string | undefined;
  progress: string | ((state: PeopleRouteState) => string);
  targetLocationId?: (state: PeopleRouteState) => string | undefined;
  title: string | ((state: PeopleRouteState) => string);
}

interface PeopleRouteOutcomeTemplate {
  id: string;
  label: string;
  npcId?: (state: PeopleRouteState) => string | undefined;
  targetLocationId?: (state: PeopleRouteState) => string | undefined;
  urgency: number;
}

interface ExploreRouteStepTemplate {
  detail: string | ((state: ExploreRouteState) => string);
  done: (state: ExploreRouteState) => boolean;
  id: string;
  npcId?: (state: ExploreRouteState) => string | undefined;
  progress: string | ((state: ExploreRouteState) => string);
  targetLocationId?: (state: ExploreRouteState) => string | undefined;
  title: string | ((state: ExploreRouteState) => string);
}

interface ExploreRouteOutcomeTemplate {
  id: string;
  label: string;
  npcId?: (state: ExploreRouteState) => string | undefined;
  targetLocationId?: (state: ExploreRouteState) => string | undefined;
  urgency: number;
}

interface CompletionAcknowledgementHint {
  feedText: string;
  memoryText: string;
  playerThought?: string;
  playerThoughtWhen?: (context: ScaffoldContext) => boolean;
  when?: (context: ScaffoldContext) => boolean;
}

interface CompletionOutcomeCopy {
  feedText: string;
  memoryText: string;
  playerThought: string;
}

interface RouteActionPressureInput {
  actionId: string;
  actionKind: string;
  currentLocationId?: string;
  planTargetLocationId?: string;
  predicateAuthority: boolean;
}

interface ObjectiveRouteScaffold {
  actionRationales?: ActionRationaleHint[];
  actionLocationReasons?: ActionLocationReasonHint[];
  actionTargetLocations?: ActionTargetLocationHint[];
  availableActions?: AvailableActionHint[];
  completionAcknowledgement?: CompletionAcknowledgementHint;
  completionOutcome?: CompletionOutcomeCopy;
  conversationFallbacks?: ConversationFallbackHint[];
  conversationGroundingPolicies?: ConversationGroundingPolicyHint[];
  conversationTopicSuppressions?: ConversationTopicSuppression[];
  conversationThoughts?: ConversationThoughtHint[];
  deterministicOpeningNpcIds?: string[];
  deterministicOpeningRouteKeys?: string[];
  moveIntents?: MoveIntentHint[];
  outcomeMoveRationales?: OutcomeMoveRationaleHint[];
  playerFacingRationaleNormalizations?: PlayerFacingRationaleNormalizationHint[];
  playerThoughts?: PlayerThoughtHint[];
  routeHeadline?: string;
  routeKeys: string[];
  routeKeyPrefixes?: string[];
  semanticMoveBonuses?: SemanticMoveBonus[];
  semanticHints?: SemanticHint[];
  speechHints?: SpeechHint[];
  workStageThoughts?: WorkStageThoughtHint[];
}

const FIRST_AFTERNOON_ROUTE_KEYS = ["first-afternoon"] as const;
const ADA_LEAD_ROUTE_KEYS = [
  "first-afternoon",
  "mara-ada-lead",
  "work-tea",
] as const;

function textGroundsMaraAdaLead(text: string | undefined): boolean {
  const normalized = (text ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    /\bada\b/.test(normalized) &&
    /\bkettle\b|\blamp\b|\btea[- ]?house\b/.test(normalized) &&
    /\blunch\b|\bwork\b|\bjob\b|\bshift\b|\bhands?\b|\bhelp\b|\bcounter\b|\bpay\b/.test(
      normalized,
    )
  );
}

function textAffirmsMaraAdaLead(text: string | undefined): boolean {
  const normalized = (text ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    /\b(no|not|don't|do not|isn't|closed|can't|cannot|avoid|skip|wrong)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /\byes\b|\bright\b|\bexactly\b|\bcorrect\b|\bthat(?:'|’)s right\b|\bthat(?:'|’)s the one\b|\bthat is the one\b|\byou(?:'|’)ve got it\b|\byou have got it\b|\bdo that\b|\bask her\b|\bask ada\b/.test(
      normalized,
    ) ||
    /\b(she|ada)\s*(?:'|’)?ll\b/.test(normalized) ||
    /\b(she|ada)\s+(may|might|could|can|will|does|needs?|has)\b/.test(
      normalized,
    ) ||
    /\bworth\s+(asking|trying)\b/.test(normalized)
  );
}

function resolutionPointsToMaraAdaLead(resolution: {
  decision?: string;
  memoryText?: string;
  objectiveText?: string;
  summary?: string;
}): boolean {
  const text = [
    resolution.decision,
    resolution.memoryText,
    resolution.objectiveText,
    resolution.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /\bada\b|\bkettle\b|\blamp\b|\btea[- ]?house\b/.test(text) &&
    /\blunch\b|\bwork\b|\bjob\b|\bshift\b|\bhands?\b|\bcounter\b/.test(text)
  );
}

const SETTLE_ROUTE_OUTCOME_TEMPLATES: SettleRouteOutcomeTemplate[] = [
  {
    id: "settle-terms",
    label: "Room terms understood",
    urgency: 5,
    npcId: ({ hasStayTerms }) => (hasStayTerms ? undefined : "npc-mara"),
    targetLocationId: ({ hasStayTerms, homeLocationId }) =>
      hasStayTerms ? undefined : homeLocationId,
  },
  {
    id: "settle-standing",
    label: "Morrow House standing built",
    urgency: 4,
    actionId: ({
      hasStayTerms,
      hasTalkedToMara,
      homeLocationId,
      houseStanding,
    }) =>
      (hasStayTerms || hasTalkedToMara) && houseStanding < 2 && homeLocationId
        ? `contribute:${homeLocationId}`
        : undefined,
    targetLocationId: ({ homeLocationId, houseStanding }) =>
      houseStanding >= 2 ? undefined : homeLocationId,
  },
  {
    id: "settle-lead",
    label: ({ lead }) =>
      lead === "yard"
        ? "Yard work lead confirmed"
        : "Tea-house work lead confirmed",
    urgency: 3,
    npcId: ({ hasWorkLead, settleLeadNpcId }) =>
      hasWorkLead ? undefined : settleLeadNpcId,
    targetLocationId: ({ hasWorkLead, settleLeadLocationId }) =>
      hasWorkLead ? undefined : settleLeadLocationId,
  },
  {
    id: "settle-income",
    label: "Income committed or completed",
    urgency: 2,
    actionId: ({
      hasCommittedIncome,
      leadJobAccepted,
      leadJobCompleted,
      leadJobDiscovered,
      leadJobId,
      leadJobMissed,
    }) =>
      !hasCommittedIncome && leadJobId && !leadJobCompleted && !leadJobMissed
        ? leadJobAccepted
          ? `work:${leadJobId}`
          : leadJobDiscovered
            ? `accept:${leadJobId}`
            : undefined
        : undefined,
    targetLocationId: ({ hasCommittedIncome, leadJobLocationId }) =>
      hasCommittedIncome ? undefined : leadJobLocationId,
  },
  {
    id: "settle-people",
    label: "Two local connections built",
    urgency: 1,
    npcId: ({ familiarPeople, settlePeopleTargetId }) =>
      familiarPeople >= 2 ? undefined : settlePeopleTargetId,
    targetLocationId: ({ familiarPeople, settlePeopleTargetLocationId }) =>
      familiarPeople >= 2 ? undefined : settlePeopleTargetLocationId,
  },
];

const SETTLE_ROUTE_STEP_TEMPLATES: SettleRouteStepTemplate[] = [
  {
    id: "settle-terms",
    title: ({ homeLocationName }) =>
      `Lock in my stay at ${homeLocationName ?? "Morrow House"}.`,
    detail: ({ hasStayTerms, hasTalkedToMara }) =>
      hasStayTerms
        ? "Mara has already laid out what keeps this room mine."
        : hasTalkedToMara
          ? "Mara can help, but Rowan still needs the exact room terms."
          : "Mara can walk Rowan through exactly what it takes to keep a room here.",
    progress: ({ hasStayTerms, hasTalkedToMara }) =>
      hasStayTerms
        ? "Terms clear"
        : hasTalkedToMara
          ? "Need exact terms"
          : "Talk to Mara",
    done: ({ hasStayTerms }) => hasStayTerms,
    npcId: "npc-mara",
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
  {
    id: "settle-standing",
    title: ({ homeLocationName }) =>
      `Build standing at ${homeLocationName ?? "Morrow House"} so the room stays mine.`,
    detail: ({ houseStanding }) =>
      houseStanding >= 2
        ? "Morrow House is starting to see Rowan as dependable."
        : "Now that Rowan knows the terms, he needs to show up, help out, and make the house easier to run.",
    progress: ({ houseStanding }) => `Standing ${houseStanding}/2`,
    done: ({ houseStanding }) => houseStanding >= 2,
    actionId: ({ hasStayTerms, homeLocationId, houseStanding }) =>
      hasStayTerms && houseStanding < 2 && homeLocationId
        ? `contribute:${homeLocationId}`
        : undefined,
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
  {
    id: "settle-lead",
    title: ({ lead }) =>
      lead === "yard"
        ? "Line up one solid work lead at North Crane Yard."
        : "Line up one solid work lead at Kettle & Lamp.",
    detail: ({ lead }) =>
      lead === "yard"
        ? "The yard is a reliable place to turn effort into decent pay."
        : "The tea room is a strong place to turn conversation into work.",
    progress: ({ anyLeadJobDiscovered, hasCommittedIncome, hasWorkLead }) =>
      hasWorkLead
        ? "Lead locked"
        : anyLeadJobDiscovered
          ? "Lead spotted"
          : hasCommittedIncome
            ? "Work in hand"
            : "Looking",
    done: ({ hasWorkLead }) => hasWorkLead,
    npcId: ({ settleLeadNpcId }) => settleLeadNpcId,
    targetLocationId: ({ settleLeadLocationId }) => settleLeadLocationId,
  },
  {
    id: "settle-income",
    title: "Turn that lead into steady pay.",
    detail: ({ hasCommittedIncome }) =>
      hasCommittedIncome
        ? "Real work is finally taking shape."
        : "A lead matters once Rowan commits and follows through.",
    progress: ({ hasWorkLead, anyLeadJobCompleted, anyPlayerActiveJob }) =>
      anyPlayerActiveJob
        ? "Working"
        : anyLeadJobCompleted
          ? "Paid once"
          : hasWorkLead
            ? "Ready to commit"
            : "Looking",
    done: ({ hasCommittedIncome }) => hasCommittedIncome,
    actionId: ({
      leadJobAccepted,
      leadJobActive,
      leadJobCompleted,
      leadJobDiscovered,
      leadJobId,
      leadJobMissed,
    }) =>
      leadJobId && !leadJobCompleted && !leadJobMissed
        ? leadJobAccepted || leadJobActive
          ? `work:${leadJobId}`
          : leadJobDiscovered
            ? `accept:${leadJobId}`
            : undefined
        : undefined,
    targetLocationId: ({ leadJobLocationId }) => leadJobLocationId,
  },
  {
    id: "settle-people",
    title: "Build two real connections.",
    detail: ({ familiarPeople }) =>
      familiarPeople >= 2
        ? "A couple of faces now feel like real allies."
        : "Rowan needs a few real connections to make this place feel like home.",
    progress: ({ familiarPeople }) =>
      `${Math.min(familiarPeople, 2)}/2 real connections`,
    done: ({ familiarPeople }) => familiarPeople >= 2,
    npcId: ({ familiarPeople, settlePeopleTargetId }) =>
      familiarPeople < 2 ? settlePeopleTargetId : undefined,
    targetLocationId: ({ familiarPeople, settlePeopleTargetLocationId }) =>
      familiarPeople < 2 ? settlePeopleTargetLocationId : undefined,
  },
];

const WORK_OUTCOME_TEMPLATES: WorkRouteOutcomeTemplate[] = [
  {
    id: ({ lead }) => (lead === "yard" ? "work-lead-yard" : "work-lead-tea"),
    label: ({ lead }) =>
      lead === "yard"
        ? "Yard work lead confirmed"
        : "Tea-house work lead confirmed",
    urgency: 4,
    npcId: ({ leadNpcId }) => leadNpcId,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-commit",
    label: "Paid work committed",
    urgency: ({ leadJobAtRisk }) => (leadJobAtRisk ? 7 : 3),
    actionId: ({
      leadJobAccepted,
      leadJobCompleted,
      leadJobDiscovered,
      leadJobId,
      leadJobMissed,
    }) =>
      leadJobId && !leadJobCompleted && !leadJobMissed
        ? leadJobAccepted
          ? `work:${leadJobId}`
          : leadJobDiscovered
            ? `accept:${leadJobId}`
            : undefined
        : undefined,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-finish",
    label: "Paid work finished",
    urgency: ({ leadJobAtRisk }) => (leadJobAtRisk ? 6 : 2),
    actionId: ({
      leadJobAccepted,
      leadJobCompleted,
      leadJobId,
      leadJobMissed,
    }) =>
      leadJobId && leadJobAccepted && !leadJobCompleted && !leadJobMissed
        ? `work:${leadJobId}`
        : undefined,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-pay",
    label: "Pay turned into breathing room",
    urgency: 1,
  },
];

const WORK_STEP_TEMPLATES: WorkRouteStepTemplate[] = [
  {
    id: ({ lead }) => (lead === "yard" ? "work-lead-yard" : "work-lead-tea"),
    title: ({ lead, leadLocationName, leadNpcName }) =>
      lead === "yard"
        ? `Get a real work lead from ${leadNpcName ?? "Tomas"} at ${leadLocationName ?? "North Crane Yard"}.`
        : `Get a real work lead from ${leadNpcName ?? "Ada"} at ${leadLocationName ?? "Kettle & Lamp"}.`,
    detail: ({ lead }) =>
      lead === "yard"
        ? "The yard only counts as a lead once Tomas puts actual work on the table."
        : "The tea room only counts as a lead once Ada makes the offer real.",
    progress: ({ leadConfirmed, leadJobDiscovered }) =>
      leadConfirmed
        ? "Lead confirmed"
        : leadJobDiscovered
          ? "Heard about it"
          : "Still asking",
    done: ({ leadConfirmed }) => leadConfirmed,
    npcId: ({ leadNpcId }) => leadNpcId,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-commit",
    title: ({ lead }) =>
      lead === "yard"
        ? "Take the freight-yard lift before the window closes."
        : "Take the cup-and-counter shift at Kettle & Lamp.",
    detail: ({ lead }) =>
      lead === "yard"
        ? "The yard only stays open for work if Rowan moves in time."
        : "Ada likes speed more than speeches.",
    progress: ({
      leadJobAccepted,
      leadJobActive,
      leadJobCompleted,
      leadJobDiscovered,
    }) =>
      leadJobAccepted || leadJobActive
        ? "Committed"
        : leadJobCompleted
          ? "Already worked"
          : leadJobDiscovered
            ? "Lead waiting"
            : "Still asking",
    done: ({ leadJobAccepted, leadJobCompleted }) =>
      leadJobAccepted || leadJobCompleted,
    actionId: ({
      leadJobAccepted,
      leadJobActive,
      leadJobCompleted,
      leadJobDiscovered,
      leadJobId,
      leadJobMissed,
    }) =>
      leadJobId && !leadJobCompleted && !leadJobMissed
        ? leadJobAccepted || leadJobActive
          ? `work:${leadJobId}`
          : leadJobDiscovered
            ? `accept:${leadJobId}`
            : undefined
        : undefined,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-finish",
    title: ({ lead }) =>
      lead === "yard"
        ? "Finish the yard lift cleanly."
        : "Finish the tea-house shift cleanly.",
    detail: ({ lead }) =>
      lead === "yard"
        ? "Following through matters as much as taking the lift."
        : "Finishing the rush matters more than saying yes to it.",
    progress: ({ leadJobCompleted }) =>
      leadJobCompleted ? "Finished" : "Still ahead",
    done: ({ leadJobCompleted }) => leadJobCompleted,
    actionId: ({ leadJobCompleted, leadJobId }) =>
      leadJobId && !leadJobCompleted ? `work:${leadJobId}` : undefined,
    targetLocationId: ({ leadLocationId }) => leadLocationId,
  },
  {
    id: "work-pay",
    title: "Turn the pay into breathing room.",
    detail: ({ anyCompletedWork, playerMoney }) =>
      playerMoney >= 20 || anyCompletedWork
        ? "The day is starting to look more like footing than scrambling."
        : "Work only matters if it buys more than the next hour.",
    progress: ({ playerMoney }) => `$${playerMoney} on hand`,
    done: ({ anyCompletedWork, playerMoney }) =>
      playerMoney >= 20 || anyCompletedWork,
  },
];

const COMMITTED_JOB_OUTCOME_TEMPLATES: CommittedJobRouteOutcomeTemplate[] = [
  {
    id: ({ jobId }) => `commitment-go-${jobId}`,
    label: ({ jobTitle }) => `${jobTitle} site reached`,
    urgency: 3,
    targetLocationId: ({ atLocation, jobLocationId, jobOpen }) =>
      jobOpen && !atLocation ? jobLocationId : undefined,
  },
  {
    id: ({ jobId }) => `commitment-window-${jobId}`,
    label: ({ jobTitle }) => `${jobTitle} window open`,
    urgency: 2,
    targetLocationId: ({ atLocation, jobLocationId, jobOpen }) =>
      jobOpen && !atLocation ? jobLocationId : undefined,
  },
  {
    id: ({ jobId }) => `commitment-finish-${jobId}`,
    label: ({ jobTitle }) => `${jobTitle} finished`,
    urgency: 1,
    actionId: ({ canWork, jobId }) => (canWork ? `work:${jobId}` : undefined),
    targetLocationId: ({ canWork, jobLocationId, jobOpen }) =>
      jobOpen && !canWork ? jobLocationId : undefined,
  },
];

const COMMITTED_JOB_STEP_TEMPLATES: CommittedJobRouteStepTemplate[] = [
  {
    id: ({ jobId }) => `commitment-go-${jobId}`,
    title: ({ jobLocationName, jobTitleLower }) =>
      `Get to ${jobLocationName ?? "the job site"} for ${jobTitleLower}.`,
    detail:
      "A live commitment should be the first thing Rowan can actually cash in.",
    progress: ({ atLocation }) => (atLocation ? "On site" : "Still moving"),
    done: ({ atLocation, jobCompleted }) => atLocation || jobCompleted,
    targetLocationId: ({ jobLocationId }) => jobLocationId,
  },
  {
    id: ({ jobId }) => `commitment-window-${jobId}`,
    title: "Be there while the shift window is still open.",
    detail: "The block only keeps a shift open for so long.",
    progress: ({ beforeWindow, inWindow }) =>
      inWindow ? "Window open" : beforeWindow ? "Waiting on the hour" : "Window slipping",
    done: ({ inWindow, jobCompleted }) => inWindow || jobCompleted,
    targetLocationId: ({ jobLocationId }) => jobLocationId,
  },
  {
    id: ({ jobId }) => `commitment-finish-${jobId}`,
    title: ({ jobTitleLower }) => `Finish ${jobTitleLower}.`,
    detail: "Following through is what turns a lead into standing.",
    progress: ({ jobCompleted }) =>
      jobCompleted ? "Finished" : "Still committed",
    done: ({ jobCompleted }) => jobCompleted,
    actionId: ({ jobCompleted, jobId }) =>
      jobCompleted ? undefined : `work:${jobId}`,
    targetLocationId: ({ jobLocationId }) => jobLocationId,
  },
];

const REST_OUTCOME_TEMPLATES: RestRouteOutcomeTemplate[] = [
  {
    id: "rest-return",
    label: "Returned somewhere safe to rest",
    urgency: 2,
    targetLocationId: ({ atHome, homeLocationId, restLanded }) =>
      !atHome && !restLanded ? homeLocationId : undefined,
  },
  {
    id: "rest-hour",
    label: "Recovered with an hour of rest",
    urgency: 1,
    actionId: ({ atHome, restLanded }) =>
      atHome && !restLanded ? "rest:home" : undefined,
    targetLocationId: ({ homeLocationId, restLanded }) =>
      restLanded ? undefined : homeLocationId,
  },
];

const REST_STEP_TEMPLATES: RestRouteStepTemplate[] = [
  {
    id: "rest-return",
    title: ({ homeLocationName }) =>
      `Return to ${homeLocationName ?? "Morrow House"} to recover.`,
    detail: ({ restRequested }) =>
      restRequested
        ? "Rowan needs a safe pause before the next live opening costs him tired mistakes."
        : "Rowan needs somewhere familiar before the hour can turn into real recovery.",
    progress: ({ atHome }) => (atHome ? "Home" : "Away"),
    done: ({ atHome }) => atHome,
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
  {
    id: "rest-hour",
    title: "Rest for an hour.",
    detail:
      "The point is to stop fighting the block long enough to get your legs back.",
    progress: ({ playerEnergy, restLanded }) =>
      restLanded ? "Recovered" : `Energy ${playerEnergy}`,
    done: ({ restLanded }) => restLanded,
    actionId: ({ restLanded }) => (restLanded ? undefined : "rest:home"),
    targetLocationId: ({ homeLocationId, restLanded }) =>
      restLanded ? undefined : homeLocationId,
  },
];

const CART_PROBLEM_OUTCOME_TEMPLATES: HelpProblemRouteOutcomeTemplate[] = [
  {
    id: "cart-discovered",
    label: "Cart problem understood",
    urgency: 2,
    actionId: ({ problemActive, problemDiscovered }) =>
      problemActive && !problemDiscovered ? "inspect:problem-cart" : undefined,
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
  {
    id: "cart-solved",
    label: "Cart cleared",
    urgency: 1,
    actionId: ({ problemActive, problemDiscovered }) =>
      problemActive && problemDiscovered ? "solve:problem-cart" : undefined,
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
];

const CART_PROBLEM_STEP_TEMPLATES: HelpProblemRouteStepTemplate[] = [
  {
    id: "help-cart-inspect",
    title: ({ problemLocationName }) =>
      `Inspect the jammed cart in ${problemLocationName ?? "Quay Square"}.`,
    detail: "The wheel is already starting to catch on the square's traffic.",
    progress: ({ problemDiscovered }) =>
      problemDiscovered ? "Problem seen" : "Still a rumor",
    done: ({ problemDiscovered }) => problemDiscovered,
    actionId: "inspect:problem-cart",
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
  {
    id: "help-cart-solve",
    title: "Clear the cart before it snarls the square.",
    detail:
      "The square works better when somebody moves trouble before it spreads.",
    progress: ({ problemCleared, problemStatus }) =>
      problemCleared
        ? "Cleared"
        : problemStatus === "expired"
          ? "Missed"
          : "Active",
    done: ({ problemCleared }) => problemCleared,
    actionId: ({ problemActive, problemDiscovered }) =>
      problemActive && problemDiscovered ? "solve:problem-cart" : undefined,
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
];

const PUMP_PROBLEM_OUTCOME_TEMPLATES: HelpProblemRouteOutcomeTemplate[] = [
  {
    id: "pump-discovered",
    label: "Pump problem understood",
    urgency: 3,
    actionId: ({ problemActive, problemDiscovered }) =>
      problemActive && !problemDiscovered ? "inspect:problem-pump" : undefined,
    targetLocationId: ({
      problemActive,
      problemDiscovered,
      problemLocationId,
    }) => (problemActive && !problemDiscovered ? problemLocationId : undefined),
  },
  {
    id: "wrench-in-inventory",
    label: "Wrench secured",
    urgency: 2,
    actionId: ({ hasWrench, problemClosed }) =>
      !problemClosed && !hasWrench ? "buy:item-wrench" : undefined,
    targetLocationId: ({ hasWrench, problemClosed }) =>
      !problemClosed && !hasWrench ? "repair-stall" : undefined,
  },
  {
    id: "pump-solved",
    label: "Pump solved",
    urgency: 1,
    actionId: ({ hasWrench, problemActive, problemDiscovered }) =>
      problemActive && problemDiscovered && hasWrench
        ? "solve:problem-pump"
        : undefined,
    targetLocationId: ({ problemActive, problemLocationId }) =>
      problemActive ? problemLocationId : undefined,
  },
];

const PUMP_PROBLEM_STEP_TEMPLATES: HelpProblemRouteStepTemplate[] = [
  {
    id: "help-pump-inspect",
    title: ({ problemLocationName }) =>
      `Inspect the pump in ${problemLocationName ?? "Morrow Yard"}.`,
    detail: ({ problemDiscovered }) =>
      problemDiscovered
        ? "Rowan knows enough to tell the leak is one bad turn away from a worse day."
        : "A closer look will tell Rowan whether this is his problem or just nearby trouble.",
    progress: ({ problemDiscovered }) =>
      problemDiscovered ? "Problem seen" : "Still a lead",
    done: ({ problemDiscovered }) => problemDiscovered,
    actionId: ({ problemActive, problemDiscovered }) =>
      problemActive && !problemDiscovered ? "inspect:problem-pump" : undefined,
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
  {
    id: "help-pump-tool",
    title: ({ hasWrench }) =>
      hasWrench
        ? "Bring the wrench back to the pump."
        : "Buy a wrench from Jo.",
    detail: ({ hasWrench }) =>
      hasWrench
        ? "The tool is in hand. The yard just needs Rowan to use it."
        : "Jo is the easiest place to turn loose coins into something that helps.",
    progress: ({ hasWrench, problemClosed }) =>
      hasWrench
        ? "Tool in hand"
        : problemClosed
          ? "No longer needed"
          : "No wrench yet",
    done: ({ hasWrench, problemClosed }) => hasWrench || problemClosed,
    actionId: ({ hasWrench, problemActive, problemClosed }) =>
      problemActive && !hasWrench && !problemClosed
        ? "buy:item-wrench"
        : undefined,
    targetLocationId: ({
      hasWrench,
      problemActive,
      problemClosed,
      problemLocationId,
    }) =>
      problemActive && !hasWrench && !problemClosed
        ? "repair-stall"
        : hasWrench && problemActive
          ? problemLocationId
          : undefined,
  },
  {
    id: "help-pump-fix",
    title: "Fix the leak before it spreads.",
    detail:
      "South Quay remembers the people who solve trouble before it gets loud.",
    progress: ({ problemCleared, problemStatus }) =>
      problemCleared
        ? "Cleared"
        : problemStatus === "expired"
          ? "Missed"
          : "Active",
    done: ({ problemCleared }) => problemCleared,
    actionId: ({ hasWrench, problemActive, problemDiscovered }) =>
      problemActive && problemDiscovered && hasWrench
        ? "solve:problem-pump"
        : undefined,
    targetLocationId: ({ problemLocationId }) => problemLocationId,
  },
];

const TOOL_PROBLEM_OUTCOME_TEMPLATES: ToolProblemRouteOutcomeTemplate[] = [
  {
    id: "tool-buy",
    label: "Required tool secured",
    urgency: 3,
    actionId: ({ hasWrench }) => (hasWrench ? undefined : "buy:item-wrench"),
    targetLocationId: ({ hasWrench }) =>
      hasWrench ? undefined : "repair-stall",
  },
  {
    id: "tool-return",
    label: "Tool brought to the problem",
    urgency: 2,
    targetLocationId: ({
      hasWrench,
      targetLocationId,
      targetOpen,
      toolAtProblem,
    }) =>
      hasWrench && targetOpen && !toolAtProblem ? targetLocationId : undefined,
  },
  {
    id: "tool-use",
    label: "Tool used to solve the problem",
    urgency: 1,
    actionId: ({ hasWrench, targetId, targetOpen }) =>
      hasWrench && targetOpen ? `solve:${targetId}` : undefined,
    targetLocationId: ({ hasWrench, targetLocationId, targetOpen }) =>
      hasWrench && targetOpen ? targetLocationId : undefined,
  },
];

const TOOL_PROBLEM_STEP_TEMPLATES: ToolProblemRouteStepTemplate[] = [
  {
    id: "tool-buy",
    title: "Buy a wrench from Jo.",
    detail: "A tool is only a tool until it reaches the problem that needs it.",
    progress: ({ hasWrench }) => (hasWrench ? "Bought" : "Needed"),
    done: ({ hasWrench }) => hasWrench,
    actionId: ({ hasWrench }) => (hasWrench ? undefined : "buy:item-wrench"),
    targetLocationId: "repair-stall",
  },
  {
    id: "tool-return",
    title: ({ targetLocationName }) =>
      `Take it back to ${targetLocationName ?? "the trouble"}.`,
    detail: ({ targetTitle }) =>
      targetTitle
        ? `That is where ${targetTitle.toLowerCase()} is waiting.`
        : "Rowan still needs the right place before the tool matters.",
    progress: ({ targetDiscovered }) =>
      targetDiscovered ? "Lead known" : "Lead unclear",
    done: ({ toolAtProblem }) => toolAtProblem,
    targetLocationId: ({ targetLocationId }) => targetLocationId,
  },
  {
    id: "tool-use",
    title: "Use it before the trouble spreads.",
    detail:
      "The right tool should end the problem, not just change the label on it.",
    progress: ({ targetCleared, targetStatus }) =>
      targetCleared
        ? "Cleared"
        : targetStatus === "expired"
          ? "Missed"
          : "Active",
    done: ({ targetCleared }) => targetCleared,
    actionId: ({ targetDiscovered, targetId, targetStatus }) =>
      targetStatus === "active" && targetDiscovered
        ? `solve:${targetId}`
        : undefined,
    targetLocationId: ({ targetLocationId }) => targetLocationId,
  },
];

const PEOPLE_ROUTE_OUTCOME_TEMPLATES: PeopleRouteOutcomeTemplate[] = [
  {
    id: "people-talk",
    label: "Local introduction made",
    urgency: 3,
    npcId: ({ targetConversationCount, targetId }) =>
      targetConversationCount > 0 ? undefined : targetId,
    targetLocationId: ({ targetConversationCount, targetLocationId }) =>
      targetConversationCount > 0 ? undefined : targetLocationId,
  },
  {
    id: "people-open",
    label: "A local connection opened up",
    urgency: 2,
    npcId: ({ familiarPeople, targetId }) =>
      familiarPeople >= 1 ? undefined : targetId,
    targetLocationId: ({ familiarPeople, targetLocationId }) =>
      familiarPeople >= 1 ? undefined : targetLocationId,
  },
  {
    id: "people-friend",
    label: "Two trusted local ties built",
    urgency: 1,
    npcId: ({ secondConnectionTargetId, trustedPeople }) =>
      trustedPeople >= 2 ? undefined : secondConnectionTargetId,
    targetLocationId: ({ secondConnectionTargetLocationId, trustedPeople }) =>
      trustedPeople >= 2 ? undefined : secondConnectionTargetLocationId,
  },
];

const PEOPLE_ROUTE_STEP_TEMPLATES: PeopleRouteStepTemplate[] = [
  {
    id: "people-talk",
    title: ({ targetName }) =>
      targetName
        ? `Talk to ${targetName} and make a proper introduction.`
        : "Talk to someone new nearby.",
    detail: ({ friendObjective }) =>
      friendObjective
        ? "Rowan is looking for more than a name now."
        : "A real introduction makes the block feel less faceless.",
    progress: ({ targetConversationCount, targetId }) =>
      targetId ? `${targetConversationCount} chats` : "No target",
    done: ({ familiarPeople, targetConversationCount, targetId }) =>
      targetId ? targetConversationCount > 0 : familiarPeople > 0,
    npcId: ({ targetId }) => targetId,
    targetLocationId: ({ targetLocationId }) => targetLocationId,
  },
  {
    id: "people-open",
    title: "Give somebody a reason to remember me well.",
    detail: ({ familiarPeople }) =>
      familiarPeople > 0
        ? "At least one conversation has started to feel warmer than surface-level."
        : "A good conversation should leave somebody a little more open than before.",
    progress: ({ familiarPeople }) =>
      `${Math.min(familiarPeople, 1)}/1 person opened up`,
    done: ({ familiarPeople }) => familiarPeople >= 1,
    npcId: ({ familiarPeople, targetId }) =>
      familiarPeople < 1 ? targetId : undefined,
    targetLocationId: ({ familiarPeople, targetLocationId }) =>
      familiarPeople < 1 ? targetLocationId : undefined,
  },
  {
    id: "people-friend",
    title: "Come away with two people I can return to.",
    detail: ({ trustedPeople }) =>
      trustedPeople >= 2
        ? "A couple of people are starting to feel like real footholds."
        : "Rowan still needs more than one good conversation if he's going to stop feeling dropped in.",
    progress: ({ trustedPeople }) => `${Math.min(trustedPeople, 2)}/2 trusted`,
    done: ({ trustedPeople }) => trustedPeople >= 2,
    npcId: ({ secondConnectionTargetId, trustedPeople }) =>
      trustedPeople < 2 ? secondConnectionTargetId : undefined,
    targetLocationId: ({ secondConnectionTargetLocationId, trustedPeople }) =>
      trustedPeople < 2 ? secondConnectionTargetLocationId : undefined,
  },
];

const EXPLORE_ROUTE_OUTCOME_TEMPLATES: ExploreRouteOutcomeTemplate[] = [
  {
    id: "explore-go",
    label: "Unknown place visited",
    urgency: 3,
    targetLocationId: ({ hasVisitedTarget, targetId }) =>
      targetId && !hasVisitedTarget ? targetId : undefined,
  },
  {
    id: "explore-talk",
    label: "Local guide heard from",
    urgency: 2,
    npcId: ({ hasVisitedTarget, talkedAtTarget, targetGuideId }) =>
      hasVisitedTarget && !talkedAtTarget ? targetGuideId : undefined,
    targetLocationId: ({ hasVisitedTarget, talkedAtTarget, targetId }) =>
      targetId && hasVisitedTarget && !talkedAtTarget ? targetId : undefined,
  },
  {
    id: "explore-learn",
    label: "South Quay map knowledge improved",
    urgency: 1,
  },
];

const EXPLORE_ROUTE_STEP_TEMPLATES: ExploreRouteStepTemplate[] = [
  {
    id: "explore-go",
    title: ({ targetName }) =>
      targetName
        ? `Walk to ${targetName} and see what it is for.`
        : "Walk to a corner you do not know yet.",
    detail: ({ mapKnowledgeObjective }) =>
      mapKnowledgeObjective
        ? "Rowan is trying to make the district legible."
        : "A new corner is usually easier to understand once you stand in it.",
    progress: ({ hasVisitedTarget, targetId }) =>
      targetId
        ? `${hasVisitedTarget ? "Known" : "Unknown"} place`
        : "No target",
    done: ({ hasVisitedTarget }) => hasVisitedTarget,
    targetLocationId: ({ targetId }) => targetId,
  },
  {
    id: "explore-talk",
    title: ({ targetGuideName }) =>
      targetGuideName
        ? `Talk to ${targetGuideName} there.`
        : "Talk to whoever runs that corner.",
    detail: ({ targetGuideName }) =>
      targetGuideName
        ? `${targetGuideName} is the most likely person to explain the place.`
        : "Someone there should know what the corner is really for.",
    progress: ({ targetPeopleCount }) => `${targetPeopleCount} people nearby`,
    done: ({ talkedAtTarget, targetPeopleCount }) =>
      targetPeopleCount > 0 && talkedAtTarget,
    npcId: ({ targetGuideId }) => targetGuideId,
    targetLocationId: ({ targetId }) => targetId,
  },
  {
    id: "explore-learn",
    title: "Learn what the place is really for.",
    detail: ({ knownLocationCount }) =>
      knownLocationCount >= 4
        ? "The district is starting to feel like a place rather than a blur."
        : "Rowan still needs one more place before the map starts making sense.",
    progress: ({ knownLocationCount }) => `${knownLocationCount}/4 places`,
    done: ({ knownLocationCount }) => knownLocationCount >= 4,
  },
];

const FIRST_AFTERNOON_OUTCOME_TEMPLATES: FirstAfternoonRouteOutcomeTemplate[] =
  [
    {
      id: "first-afternoon-room",
      label: "Room terms understood",
      urgency: 8,
      npcId: ({ hasRoomTerms }) => (hasRoomTerms ? undefined : "npc-mara"),
      targetLocationId: ({ hasRoomTerms, homeLocationId }) =>
        hasRoomTerms ? undefined : homeLocationId,
    },
    {
      id: "first-afternoon-choose-move",
      label: "Useful first move chosen",
      urgency: 7,
      actionId: ({ hasTalkedToMara, hasSettledPlan, teaLeadViable }) =>
        hasTalkedToMara && !hasSettledPlan && teaLeadViable
          ? "reflect:first-afternoon-plan"
          : undefined,
      targetLocationId: ({
        hasTalkedToMara,
        hasSettledPlan,
        homeLocationId,
        teaLeadViable,
      }) =>
        hasTalkedToMara && !hasSettledPlan && teaLeadViable
          ? homeLocationId
          : undefined,
    },
    {
      id: "first-afternoon-ada-lead",
      label: "Ada lead verified",
      urgency: 6,
      npcId: ({
        hasFinishedTeaShift,
        hasSettledPlan,
        hasTakenTeaShift,
        hasTalkedToAda,
        teaLeadViable,
      }) =>
        hasSettledPlan &&
        !hasTalkedToAda &&
        !hasTakenTeaShift &&
        !hasFinishedTeaShift &&
        teaLeadViable
          ? "npc-ada"
          : undefined,
      targetLocationId: ({
        hasFinishedTeaShift,
        hasSettledPlan,
        hasTakenTeaShift,
        hasTalkedToAda,
        teaLeadViable,
      }) =>
        hasSettledPlan &&
        !hasTalkedToAda &&
        !hasTakenTeaShift &&
        !hasFinishedTeaShift &&
        teaLeadViable
          ? "tea-house"
          : undefined,
    },
    {
      id: "first-afternoon-record-lead",
      label: "Ada lead recorded as evidence",
      urgency: 5,
      targetLocationId: ({ hasLeadFieldNote, hasTalkedToAda }) =>
        hasTalkedToAda && !hasLeadFieldNote ? "tea-house" : undefined,
    },
    {
      id: "first-afternoon-take-shift",
      label: "Cup-and-counter shift accepted",
      urgency: 4,
      actionId: ({
        hasLeadFieldNote,
        hasTakenTeaShift,
        teaJobDiscovered,
        teaJobId,
        teaLeadViable,
      }) =>
        hasLeadFieldNote &&
        teaJobId &&
        !hasTakenTeaShift &&
        teaLeadViable &&
        teaJobDiscovered
          ? `accept:${teaJobId}`
          : undefined,
      targetLocationId: ({
        hasLeadFieldNote,
        hasTakenTeaShift,
        teaLeadViable,
      }) =>
        hasLeadFieldNote && !hasTakenTeaShift && teaLeadViable
          ? "tea-house"
          : undefined,
    },
    {
      id: "first-afternoon-start-shift",
      label: "Lunch rush started",
      urgency: 3,
      actionId: ({
        hasStartedTeaShift,
        teaJobAccepted,
        teaJobId,
        teaJobMissed,
      }) =>
        teaJobId && teaJobAccepted && !hasStartedTeaShift && !teaJobMissed
          ? `work:${teaJobId}`
          : undefined,
      targetLocationId: ({
        hasStartedTeaShift,
        teaJobAccepted,
        teaJobId,
        teaJobMissed,
      }) =>
        teaJobId && teaJobAccepted && !hasStartedTeaShift && !teaJobMissed
          ? "tea-house"
          : undefined,
    },
    {
      id: "first-afternoon-finish-shift",
      label: "Shift finished and paid",
      urgency: 2,
      actionId: ({
        hasFinishedTeaShift,
        hasStartedTeaShift,
        teaJobId,
        teaJobMissed,
      }) =>
        teaJobId && hasStartedTeaShift && !hasFinishedTeaShift && !teaJobMissed
          ? `work:${teaJobId}`
          : undefined,
      targetLocationId: ({
        hasFinishedTeaShift,
        hasStartedTeaShift,
        teaJobId,
        teaJobMissed,
      }) =>
        teaJobId && hasStartedTeaShift && !hasFinishedTeaShift && !teaJobMissed
          ? "tea-house"
          : undefined,
    },
    {
      id: "first-afternoon-take-stock",
      label: "First afternoon taken stock",
      urgency: 1,
      actionId: ({ atHome, hasFinishedTeaShift, wrappedFirstAfternoon }) =>
        atHome && hasFinishedTeaShift && !wrappedFirstAfternoon
          ? "reflect:first-afternoon"
          : undefined,
      targetLocationId: ({
        hasFinishedTeaShift,
        homeLocationId,
        wrappedFirstAfternoon,
      }) =>
        hasFinishedTeaShift && !wrappedFirstAfternoon
          ? homeLocationId
          : undefined,
    },
  ];

const FIRST_AFTERNOON_STEP_TEMPLATES: FirstAfternoonRouteStepTemplate[] = [
  {
    id: "first-afternoon-room",
    title: "Ask Mara how to keep tonight's room.",
    detail: ({ hasTalkedToMara }) =>
      hasTalkedToMara
        ? "Mara explained how Morrow House works."
        : "Ask what the room costs, what the house expects, and how tonight works.",
    progress: ({ hasTalkedToMara }) =>
      hasTalkedToMara ? "Mara has weighed in" : "Talk to Mara",
    done: ({ hasTalkedToMara }) => hasTalkedToMara,
    npcId: "npc-mara",
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
  {
    id: "first-afternoon-choose-move",
    title: "Choose the first useful move.",
    detail: ({ hasSettledPlan }) =>
      hasSettledPlan
        ? "Rowan chose Ada over drifting or resting."
        : "Rowan could wander, rest, or ask Ada. Ada is the useful first bet.",
    progress: ({ hasSettledPlan }) =>
      hasSettledPlan ? "Ada chosen" : "Weigh the options",
    done: ({ hasSettledPlan }) => hasSettledPlan,
    actionId: ({ hasTalkedToMara, hasSettledPlan, teaLeadViable }) =>
      hasTalkedToMara && !hasSettledPlan && teaLeadViable
        ? "reflect:first-afternoon-plan"
        : undefined,
    targetLocationId: ({
      hasTalkedToMara,
      hasSettledPlan,
      homeLocationId,
      teaLeadViable,
    }) =>
      hasTalkedToMara && !hasSettledPlan && teaLeadViable
        ? homeLocationId
        : undefined,
  },
  {
    id: "first-afternoon-ada-lead",
    title: "Ask Ada if Kettle & Lamp needs help today.",
    detail: ({ hasTalkedToAda }) =>
      hasTalkedToAda
        ? "Ada made the tea-house lead concrete."
        : "Ask Ada directly if there is work Rowan can do today.",
    progress: ({ hasTalkedToAda }) =>
      hasTalkedToAda ? "Ada asked" : "Find Ada",
    done: ({ hasFinishedTeaShift, hasTakenTeaShift, hasTalkedToAda }) =>
      hasTalkedToAda || hasTakenTeaShift || hasFinishedTeaShift,
    npcId: ({ teaLeadViable }) => (teaLeadViable ? "npc-ada" : undefined),
    targetLocationId: ({ teaLeadViable }) =>
      teaLeadViable ? "tea-house" : undefined,
  },
  {
    id: "first-afternoon-record-lead",
    title: "Record what Ada confirmed.",
    detail: ({ hasLeadFieldNote }) =>
      hasLeadFieldNote
        ? "Rowan turned Mara's lead into a field note with evidence."
        : "Write down what Ada said, where it happened, and what choice it opened.",
    progress: ({ hasLeadFieldNote }) =>
      hasLeadFieldNote ? "Lead grounded" : "Needs field note",
    done: ({ hasLeadFieldNote }) => hasLeadFieldNote,
    targetLocationId: ({ hasLeadFieldNote, hasTalkedToAda, teaLeadViable }) =>
      hasTalkedToAda || hasLeadFieldNote || teaLeadViable
        ? "tea-house"
        : undefined,
  },
  {
    id: "first-afternoon-take-shift",
    title: "Take the cup-and-counter shift.",
    detail: ({ hasTakenTeaShift }) =>
      hasTakenTeaShift
        ? "Rowan has the shift."
        : "Say yes to the cup-and-counter shift.",
    progress: ({ hasTakenTeaShift, teaJobDiscovered }) =>
      hasTakenTeaShift
        ? "Shift taken"
        : teaJobDiscovered
          ? "Offer ready"
          : "Need the offer",
    done: ({ hasFinishedTeaShift, hasTakenTeaShift }) =>
      hasTakenTeaShift || hasFinishedTeaShift,
    actionId: ({
      hasActiveTeaJob,
      teaJobAccepted,
      teaJobCompleted,
      teaJobDiscovered,
      teaJobId,
      teaLeadViable,
    }) =>
      teaJobId && !teaJobCompleted && teaLeadViable
        ? teaJobAccepted || hasActiveTeaJob
          ? `work:${teaJobId}`
          : teaJobDiscovered
            ? `accept:${teaJobId}`
            : undefined
        : undefined,
    targetLocationId: ({ teaLeadViable }) =>
      teaLeadViable ? "tea-house" : undefined,
  },
  {
    id: "first-afternoon-start-shift",
    title: "Get through the lunch rush.",
    detail: ({ hasStartedTeaShift }) =>
      hasStartedTeaShift
        ? "Rowan has started keeping the room moving."
        : "Start with cups, tables, and the counter when lunch fills in.",
    progress: ({ hasStartedTeaShift }) =>
      hasStartedTeaShift ? "Rush handled" : "Shift ahead",
    done: ({ hasStartedTeaShift }) => hasStartedTeaShift,
    actionId: ({ teaJobAccepted, teaJobCompleted, teaJobId, teaJobMissed }) =>
      teaJobId && teaJobAccepted && !teaJobCompleted && !teaJobMissed
        ? `work:${teaJobId}`
        : undefined,
    targetLocationId: ({
      teaJobAccepted,
      teaJobCompleted,
      teaJobId,
      teaJobMissed,
    }) =>
      teaJobId && teaJobAccepted && !teaJobCompleted && !teaJobMissed
        ? "tea-house"
        : undefined,
  },
  {
    id: "first-afternoon-finish-shift",
    title: "Finish the shift and get paid.",
    detail: ({ hasFinishedTeaShift, teaShiftStage }) =>
      hasFinishedTeaShift
        ? "Rowan worked the shift and got paid."
        : teaShiftStage === "counter"
          ? "Finish the last counter pass and collect the pay."
          : "Keep the shift steady until Ada can pay Rowan.",
    progress: ({ hasFinishedTeaShift }) =>
      hasFinishedTeaShift ? "Paid" : "Still ahead",
    done: ({ hasFinishedTeaShift }) => hasFinishedTeaShift,
    actionId: ({ teaJobCompleted, teaJobId, teaJobMissed }) =>
      teaJobId && !teaJobCompleted && !teaJobMissed
        ? `work:${teaJobId}`
        : undefined,
    targetLocationId: ({
      hasStartedTeaShift,
      teaJobCompleted,
      teaJobId,
      teaJobMissed,
    }) =>
      teaJobId && hasStartedTeaShift && !teaJobCompleted && !teaJobMissed
        ? "tea-house"
        : undefined,
  },
  {
    id: "first-afternoon-take-stock",
    title: "Head back to Morrow House and take stock.",
    detail: ({ atHome, hasFinishedTeaShift, wrappedFirstAfternoon }) =>
      wrappedFirstAfternoon
        ? "Tonight's bed still holds, $14 is in Rowan's pocket, Ada has seen him keep up, and tomorrow has a real lead."
        : atHome && hasFinishedTeaShift
          ? "Stop for a minute and count what changed today."
          : "Go back to Morrow House before ending the first afternoon.",
    progress: ({ atHome, wrappedFirstAfternoon }) =>
      wrappedFirstAfternoon
        ? "First afternoon complete"
        : atHome
          ? "Ready to take stock"
          : "Head home",
    done: ({ wrappedFirstAfternoon }) => wrappedFirstAfternoon,
    actionId: ({ atHome, hasFinishedTeaShift, wrappedFirstAfternoon }) =>
      atHome && hasFinishedTeaShift && !wrappedFirstAfternoon
        ? "reflect:first-afternoon"
        : undefined,
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
];

const MARA_ADA_LEAD_OUTCOME_TEMPLATES: MaraAdaLeadRouteOutcomeTemplate[] = [
  {
    id: "mara-ada-hear-lead",
    label: "Mara's lead heard",
    urgency: 6,
    npcId: ({ hasLeadFieldNote, hasTalkedToMara }) =>
      hasTalkedToMara || hasLeadFieldNote ? undefined : "npc-mara",
    targetLocationId: ({
      hasLeadFieldNote,
      hasTalkedToMara,
      homeLocationId,
    }) => (hasTalkedToMara || hasLeadFieldNote ? undefined : homeLocationId),
  },
  {
    id: "mara-ada-form-intent",
    label: "Ada verification intent formed",
    urgency: 5,
    actionId: ({
      hasFormedVerificationIntent,
      hasLeadViable,
      hasTalkedToMara,
    }) =>
      hasTalkedToMara && !hasFormedVerificationIntent && hasLeadViable
        ? "reflect:first-afternoon-plan"
        : undefined,
    targetLocationId: ({
      hasFormedVerificationIntent,
      hasLeadViable,
      homeLocationId,
    }) =>
      hasFormedVerificationIntent || !hasLeadViable
        ? undefined
        : homeLocationId,
  },
  {
    id: "mara-ada-walk-route",
    label: "Kettle & Lamp reached",
    urgency: 4,
    targetLocationId: ({ hasLeadViable, hasReachedTeaHouse }) =>
      hasReachedTeaHouse || !hasLeadViable ? undefined : "tea-house",
  },
  {
    id: "mara-ada-ask-directly",
    label: "Ada lead verified directly",
    urgency: 3,
    npcId: ({ hasLeadFieldNote, hasLeadViable, hasTalkedToAda }) =>
      hasTalkedToAda || hasLeadFieldNote || !hasLeadViable
        ? undefined
        : "npc-ada",
    targetLocationId: ({ hasLeadFieldNote, hasLeadViable, hasTalkedToAda }) =>
      hasTalkedToAda || hasLeadFieldNote || !hasLeadViable
        ? undefined
        : "tea-house",
  },
  {
    id: "mara-ada-record-evidence",
    label: "Ada lead recorded as evidence",
    urgency: 2,
    targetLocationId: ({ hasLeadFieldNote, hasTalkedToAda }) =>
      hasTalkedToAda && !hasLeadFieldNote ? "tea-house" : undefined,
  },
  {
    id: "mara-ada-open-choice",
    label: "Lead opened a real choice",
    urgency: 1,
    targetLocationId: ({
      hasLeadFieldNote,
      hasLeadViable,
      hasOpenWorkChoice,
    }) =>
      hasLeadFieldNote && !hasOpenWorkChoice && hasLeadViable
        ? "tea-house"
        : undefined,
  },
];

const MARA_ADA_LEAD_STEP_TEMPLATES: MaraAdaLeadRouteStepTemplate[] = [
  {
    id: "mara-ada-hear-lead",
    title: "Hear Mara's Kettle & Lamp lead.",
    detail: ({ hasTalkedToMara }) =>
      hasTalkedToMara
        ? "Mara pointed Rowan toward Ada instead of letting the afternoon drift."
        : "Ask Mara who can turn tonight's room into real footing.",
    progress: ({ hasTalkedToMara }) =>
      hasTalkedToMara ? "Lead heard" : "Talk to Mara",
    done: ({ hasTalkedToMara }) => hasTalkedToMara,
    npcId: "npc-mara",
    targetLocationId: ({ homeLocationId }) => homeLocationId,
  },
  {
    id: "mara-ada-form-intent",
    title: "Form the plan to verify it directly.",
    detail: ({ hasFormedVerificationIntent }) =>
      hasFormedVerificationIntent
        ? "Rowan chose to ask Ada rather than wander, rest, or wait for work to find him."
        : "Make the plan explicit: walk to Kettle & Lamp and ask Ada about lunch work.",
    progress: ({ hasFormedVerificationIntent }) =>
      hasFormedVerificationIntent ? "Intent clear" : "Choose the useful move",
    done: ({ hasFormedVerificationIntent }) => hasFormedVerificationIntent,
    actionId: ({
      hasFormedVerificationIntent,
      hasLeadViable,
      hasTalkedToMara,
    }) =>
      hasTalkedToMara && !hasFormedVerificationIntent && hasLeadViable
        ? "reflect:first-afternoon-plan"
        : undefined,
    targetLocationId: ({
      hasFormedVerificationIntent,
      hasLeadViable,
      hasTalkedToMara,
      homeLocationId,
    }) =>
      hasTalkedToMara && !hasFormedVerificationIntent && hasLeadViable
        ? homeLocationId
        : undefined,
  },
  {
    id: "mara-ada-walk-route",
    title: "Walk to Kettle & Lamp.",
    detail:
      "The knowledge only counts if Rowan gets there in person and asks the right person.",
    progress: ({ hasReachedTeaHouse }) =>
      hasReachedTeaHouse ? "At Kettle & Lamp" : "On the way",
    done: ({ hasReachedTeaHouse }) => hasReachedTeaHouse,
    targetLocationId: ({ hasLeadViable }) =>
      hasLeadViable ? "tea-house" : undefined,
  },
  {
    id: "mara-ada-ask-directly",
    title: "Ask Ada about lunch work.",
    detail: ({ hasTalkedToAda }) =>
      hasTalkedToAda
        ? "Ada answered the lead directly."
        : "Ask Ada whether lunch actually needs help today.",
    progress: ({ hasTalkedToAda }) =>
      hasTalkedToAda ? "Ada asked" : "Ask Ada",
    done: ({ hasTalkedToAda }) => hasTalkedToAda,
    npcId: ({ hasLeadViable }) => (hasLeadViable ? "npc-ada" : undefined),
    targetLocationId: ({ hasLeadViable }) =>
      hasLeadViable ? "tea-house" : undefined,
  },
  {
    id: "mara-ada-record-evidence",
    title: "Record what Rowan learned.",
    detail: ({ hasLeadFieldNote }) =>
      hasLeadFieldNote
        ? "Rowan has a field note tying the claim to Ada, Kettle & Lamp, and the time."
        : "Capture the learned fact, the source, the place, and what remains uncertain.",
    progress: ({ hasLeadFieldNote }) =>
      hasLeadFieldNote ? "Field note made" : "Needs evidence",
    done: ({ hasLeadFieldNote }) => hasLeadFieldNote,
    targetLocationId: ({ hasLeadFieldNote, hasLeadViable, hasTalkedToAda }) =>
      hasTalkedToAda || hasLeadFieldNote || hasLeadViable
        ? "tea-house"
        : undefined,
  },
  {
    id: "mara-ada-open-choice",
    title: "Open the next choice from that knowledge.",
    detail: ({ hasOpenWorkChoice }) =>
      hasOpenWorkChoice
        ? "The offer is now actionable: take the shift, check another lead, return later, or keep exploring."
        : "The loop should end with an actual choice, not a vague lead.",
    progress: ({ hasOpenWorkChoice }) =>
      hasOpenWorkChoice ? "Choice unlocked" : "No offer yet",
    done: ({ hasOpenWorkChoice }) => hasOpenWorkChoice,
    targetLocationId: ({ hasLeadViable }) =>
      hasLeadViable ? "tea-house" : undefined,
  },
];

const OBJECTIVE_ROUTE_SCAFFOLDS: ObjectiveRouteScaffold[] = [
  {
    routeKeys: ["first-afternoon", "mara-ada-lead"],
    completionAcknowledgement: {
      feedText:
        "Rowan closes the first-afternoon note and lets tomorrow's lead compete with the live work and trouble still moving around South Quay.",
      memoryText:
        "After the first afternoon was recorded, Rowan treated the next move as a fresh choice from live work, rest, and local trouble instead of replaying the old route.",
      playerThought:
        "Tonight's bed holds. I earned real money, and tomorrow has a lead.",
      playerThoughtWhen: ({ world }) =>
        Boolean(world.firstAfternoon?.completedAt),
      when: ({ objective }) => objective.routeKey === "first-afternoon",
    },
    completionOutcome: {
      feedText:
        "Rowan takes stock at Morrow House: tonight's bed still holds, $14 is in his pocket, Ada has seen him keep up, and the Morrow Yard pump is now a real local problem instead of background noise.",
      memoryText:
        "You finished the first afternoon with a room to return to, paid work, and a small foothold in South Quay. Taking stock also made the Morrow Yard pump impossible to ignore.",
      playerThought:
        "Tonight's bed still holds. I earned real money, Ada knows I can keep up, and the pump in Morrow Yard is not just background noise anymore. That is enough for a first afternoon.",
    },
    deterministicOpeningNpcIds: ["npc-mara", "npc-ada"],
    deterministicOpeningRouteKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
    semanticHints: [
      { locationId: ({ world }) => world.player.homeLocationId },
      {
        locationId: "tea-house",
        npcId: "npc-ada",
        when: ({ objective, world }) =>
          objective.routeKey === "mara-ada-lead" ||
          Boolean(
            world.firstAfternoon?.planSettledAt &&
            firstAfternoonAdaLeadViable(world),
          ),
      },
      {
        locationId: ({ world }) => world.player.homeLocationId,
        when: ({ world }) =>
          Boolean(jobById(world, "job-tea-shift")?.completed),
      },
    ],
    moveIntents: [
      {
        label: "Follow Mara's lead to Kettle & Lamp",
        locationId: "tea-house",
        npcId: "npc-ada",
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room; ask Ada whether the lunch work is real.",
        when: ({ objective, world }) =>
          objective.routeKey === "mara-ada-lead" ||
          (objective.routeKey === "first-afternoon" &&
            Boolean(world.firstAfternoon?.planSettledAt) &&
            firstAfternoonAdaLeadViable(world) &&
            countPlayerConversationsWithNpc(world, "npc-ada") === 0),
      },
      {
        label: "Return to Morrow House to take stock",
        locationId: ({ world }) => world.player.homeLocationId,
        rationale:
          "The shift paid, and Morrow House is the right place to let the day land.",
        when: ({ world }) =>
          Boolean(jobById(world, "job-tea-shift")?.completed) &&
          !world.firstAfternoon?.completedAt,
      },
    ],
    outcomeMoveRationales: [
      {
        matches: (outcomeLabel) => outcomeLabel.includes("ada lead verified"),
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room",
      },
      {
        matches: (outcomeLabel) =>
          outcomeLabel.includes("first afternoon taken stock"),
        rationale: ({ world }) =>
          world.player.energy < 28
            ? "The shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land"
            : "The shift paid, and Morrow House is the right place to let the day land",
      },
      {
        matches: (outcomeLabel) =>
          outcomeLabel.includes("lunch") || outcomeLabel.includes("shift"),
        rationale:
          "Ada gave Rowan real work, and the room needs steady hands now",
      },
    ],
    playerFacingRationaleNormalizations: [
      {
        matches: (normalizedRationale) =>
          normalizedRationale.includes("ada lead verified"),
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room",
      },
      {
        matches: (normalizedRationale) =>
          /ask ada.*morrow house|ada work at morrow house|lunch work at morrow house/.test(
            normalizedRationale,
          ),
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp, so Rowan needs to leave Morrow House and reach the cafe first",
      },
      {
        matches: (normalizedRationale) =>
          normalizedRationale.includes("first afternoon taken stock"),
        rationale: ({ world }) =>
          world.player.energy < 28
            ? "the shift paid, and Rowan is tired enough that Morrow House is the right place to let the day land"
            : "the shift paid, and Morrow House is the right place to let the day land",
      },
      {
        matches: (normalizedRationale, { world }) =>
          objectiveRouteHasNiaBlockLead(world) &&
          /\b(rest|recover|reset)\b.*\bmorrow house\b/.test(
            normalizedRationale,
          ),
        rationale:
          "Rowan is too worn down to make Nia's lead stick, so he needs a short recovery before the block jam gets worse",
      },
      {
        matches: (normalizedRationale) =>
          normalizedRationale.includes("morrow house standing built"),
        rationale: ({ world }) => {
          if (objectiveRouteHasNiaBlockLead(world)) {
            return "Jo's clue points toward Nia now, so Rowan needs South Quay before the block jam gets worse";
          }

          return world.player.energy < 28
            ? "Morrow House is where Rowan can let today's standing settle before he runs himself flat"
            : "Morrow House is where today's standing can turn into a steadier foothold";
        },
      },
      {
        matches: (normalizedRationale) =>
          normalizedRationale.includes("cup-and-counter") ||
          normalizedRationale.includes("lunch rush"),
        rationale:
          "Ada gave Rowan real work, and the room needs steady hands now",
      },
    ],
    actionLocationReasons: [
      {
        matches: ({ actionLabel, currentLocationName }) =>
          /ada|kettle|lunch/i.test(actionLabel) &&
          currentLocationName === "Morrow House",
        reason:
          "Mara's lead points to Ada at Kettle & Lamp, so Rowan has to reach the cafe before asking.",
      },
    ],
    conversationThoughts: [
      {
        npcId: "npc-mara",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        thought:
          "Mara gave me three ways to spend the afternoon: drift, rest, or ask Ada. Ada turns the room into something earned.",
      },
      {
        npcId: "npc-ada",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        thought:
          "Ada made the work concrete. If I can stay steady through lunch, tonight feels less temporary.",
      },
    ],
    conversationTopicSuppressions: [
      {
        npcId: "npc-mara",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        topic: "pump",
        when: ({ playerAskedTopic, world }) =>
          !world.firstAfternoon?.planSettledAt && !playerAskedTopic,
      },
    ],
    conversationFallbacks: [
      {
        choiceKey: "mara-first-afternoon-tea-closed-yard-open",
        followupChoiceKey: "mara-first-afternoon-work-closed-followup",
        followupThoughts: [
          "The old route is not the current answer.",
          "The hour changed the advice.",
          "That keeps Rowan out of a stale errand.",
        ],
        npcId: "npc-mara",
        replyLines: [
          "Kettle & Lamp was the right first bet this morning, but lunch is gone. Go ask Tomas before the yard closes.",
          "Ada's window moved on. If Rowan still wants today's work, North Crane Yard is the live lead now.",
          "Do not walk to a closed lunch shift. Try Tomas at the yard while there is still daylight.",
        ],
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return (
            jobWindowClosed(world, teaJob) && jobWindowOpen(world, yardJob)
          );
        },
      },
      {
        choiceKey: "mara-first-afternoon-work-closed",
        followupChoiceKey: "mara-first-afternoon-work-closed-followup",
        followupThoughts: [
          "The old route is not the current answer.",
          "The hour changed the advice.",
          "That keeps Rowan out of a stale errand.",
        ],
        npcId: "npc-mara",
        replyLines: [
          "Kettle & Lamp was the right first bet this morning, but that window is closed now. Come back and take stock.",
          "Do not walk to a closed lunch shift. The useful move now is to count what the day left you.",
          "Ada's window moved on. Stop chasing the morning route and bring the day back to Morrow House.",
        ],
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return (
            jobWindowClosed(world, teaJob) && !jobWindowOpen(world, yardJob)
          );
        },
      },
      {
        choiceKey: "mara-first-afternoon-next",
        followupChoiceKey: "mara-first-afternoon-next-followup",
        followupThoughts: [
          "That gives Rowan a clear first errand.",
          "A direct next step is easier to trust.",
          "Ada is the right first bet.",
        ],
        npcId: "npc-mara",
        replyLines: [
          "Go to Kettle & Lamp before lunch and ask Ada if she still needs help. It is close, honest, and useful today.",
          "Start with Ada at Kettle & Lamp. If lunch still needs hands, that gives you coin and a reason to be seen.",
          "Make Kettle & Lamp your next stop. Ask Ada directly about lunch work, then bring what you learn back here.",
        ],
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return !jobWindowClosed(world, teaJob);
        },
      },
    ],
    conversationGroundingPolicies: [
      {
        fallbackReason:
          "Live Mara reply did not ground the Ada lead after Rowan's follow-up.",
        fallbackReply: {
          followupThought: "Ada is the first useful bet.",
          reply:
            "Morrow House can hold you tonight, but a foothold needs work. Ask Ada at Kettle & Lamp before lunch; she may need steady hands for the cup-and-counter shift.",
        },
        followupPlayerText:
          "Just to be clear, should I ask Ada at Kettle & Lamp about lunch work before the rush?",
        id: "mara-ada-lead-grounding",
        npcId: "npc-mara",
        playerTextGroundsEvidence: textGroundsMaraAdaLead,
        promptGroundedPlayerLines: [
          "- Rowan's line already names the exact Ada/Kettle & Lamp/lunch-work lead. Answer plainly whether Mara confirms it.",
          "- A short direct confirmation is acceptable here, but it must clearly affirm that exact lead instead of drifting back to room rules.",
          "- Good shape for this follow-up: Yes, that's the one. Ask her before lunch fills the counter. Or: Exactly. She'll need steady hands before lunch.",
        ],
        promptRequiredLines: [
          "- Required for this Mara reply: visibly ground the work lead by naming Ada, Kettle & Lamp, and lunch work, shift, hands, counter, or pay.",
          "- This requirement overrides the general route-command caution; the player must see the Ada/Kettle & Lamp/lunch-work evidence before the sim can treat the lead as real.",
        ],
        resolutionFallback: {
          decision:
            "ask Mara one clearer question before treating Ada's lead as real.",
          memoryKind: "self",
          memoryText:
            "Mara's answer was not specific enough yet to turn Ada into a grounded work lead.",
          summary:
            "Mara has not yet made the Kettle & Lamp lead visible in the conversation.",
        },
        responseAffirmsEvidence: textAffirmsMaraAdaLead,
        responseGroundsEvidence: textGroundsMaraAdaLead,
        resolutionPointsToEvidence: resolutionPointsToMaraAdaLead,
        routeKeys: ["first-afternoon"],
        when: ({ playerText, world }) =>
          !world.firstAfternoon?.leadFieldNote &&
          !world.firstAfternoon?.planSettledAt &&
          !/\bpump\b|\bleak\b|\bwrench\b|\brepair\b/.test(
            playerText.toLowerCase(),
          ),
      },
    ],
    actionRationales: [
      {
        actionId: "reflect:first-afternoon-plan",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        rationale:
          "Leave Morrow House, reach Kettle & Lamp, then ask Ada before lunch gets busy.",
      },
      {
        npcId: "npc-mara",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        rationale:
          "Ask what the room costs and what would make tonight's bed real.",
        when: ({ world }) => !firstAfternoonRoomTermsKnown(world),
      },
      {
        npcId: "npc-ada",
        routeKeys: [...ADA_LEAD_ROUTE_KEYS],
        rationale:
          "Ask Ada whether the lunch work is real, open, and worth taking now.",
      },
    ],
    availableActions: [
      {
        id: "reflect:first-afternoon-plan",
        label: "Choose Ada's Kettle & Lamp lead",
        description:
          "Commit to leaving Morrow House and following Mara's lead to Ada at Kettle & Lamp.",
        kind: "reflect",
        emphasis: "high",
        targetLocationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) =>
          world.player.currentLocationId === world.player.homeLocationId &&
          !world.firstAfternoon?.planSettledAt &&
          countPlayerConversationsWithNpc(world, "npc-mara") > 0 &&
          firstAfternoonAdaLeadViable(world),
      },
      {
        id: "reflect:first-afternoon-pump",
        label: "Check the Morrow Yard pump",
        description:
          "Treat the leaking pump as the first proof that Rowan notices what the house needs.",
        kind: "reflect",
        emphasis: "medium",
        targetLocationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) =>
          world.player.currentLocationId === world.player.homeLocationId &&
          !world.firstAfternoon?.planSettledAt &&
          countPlayerConversationsWithNpc(world, "npc-mara") > 0 &&
          firstAfternoonAdaLeadViable(world) &&
          problemById(world, "problem-pump")?.status === "active",
      },
      {
        id: "reflect:first-afternoon-compare",
        label: "Compare other live leads",
        description:
          "Keep Ada's offer in view while checking the pump, the square, or another lead before committing.",
        kind: "reflect",
        emphasis: "low",
        targetLocationId: "tea-house",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return Boolean(
            world.player.currentLocationId === "tea-house" &&
            world.firstAfternoon?.leadFieldNote &&
            teaJob?.discovered &&
            !teaJob.accepted &&
            !teaJob.completed &&
            !teaJob.missed,
          );
        },
      },
      {
        id: "reflect:first-afternoon",
        label: "Take stock",
        description: "Count what changed today before chasing another errand.",
        kind: "reflect",
        emphasis: "high",
        targetLocationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) =>
          world.player.currentLocationId === world.player.homeLocationId &&
          !world.firstAfternoon?.completedAt &&
          Boolean(jobById(world, "job-tea-shift")?.completed),
      },
    ],
    actionTargetLocations: [
      {
        actionId: "reflect:first-afternoon",
        locationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
      },
      {
        actionId: "reflect:first-afternoon-plan",
        locationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
      },
      {
        actionId: "reflect:first-afternoon-pump",
        locationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
      },
      {
        actionId: "reflect:first-afternoon-compare",
        locationId: "tea-house",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
      },
    ],
    playerThoughts: [
      {
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        thought: "I should head back to Morrow House and let today land.",
        when: ({ world }) =>
          world.firstAfternoon?.teaShiftStage === "paid" &&
          world.player.currentLocationId !== world.player.homeLocationId,
      },
    ],
    workStageThoughts: [
      {
        jobId: "job-tea-shift",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        stage: "rush",
        thought: "The room is filling. Cups first, tables second, keep moving.",
      },
      {
        jobId: "job-tea-shift",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        stage: "counter",
        thought:
          "Ada is not watching every step now. That probably means I am keeping up.",
      },
    ],
    speechHints: [
      {
        npcId: "npc-mara",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        speech:
          "I'm Rowan. I've got tonight at Morrow House, and I'd like to do this right. What do I need to know about keeping the room?",
        when: ({ normalizedObjectiveText, playerConversationCount }) =>
          playerConversationCount === 0 ||
          /\broom\b|\btonight\b|\bmorrow house\b|\bstay\b/.test(
            normalizedObjectiveText,
          ),
      },
      {
        npcId: "npc-ada",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        speech:
          "I'm Rowan. Mara said lunch might need calm hands. Is there still work I can do before the room fills?",
      },
    ],
  },
  {
    routeKeys: ["settle-core"],
    routeHeadline:
      "Get settled in Brackenport: find a place to stay, steady income, and a few friends.",
    moveIntents: [
      {
        label: "Return to Morrow House to keep the room stable",
        locationId: ({ world }) => world.player.homeLocationId,
        rationale:
          "Morrow House is where Rowan can keep tonight's room safe and turn house standing into a steadier foothold.",
        when: ({ world }) => Boolean(world.firstAfternoon?.completedAt),
      },
    ],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["people-"],
    routeHeadline: "Meet people who could become real friends in South Quay.",
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["explore-"],
    routeHeadline: "Learn the lanes and people of South Quay.",
  },
  {
    routeKeys: ["help-pump"],
    routeHeadline: "Fix the leaking pump in Morrow Yard before it spreads.",
  },
  {
    routeKeys: ["help-cart"],
    routeHeadline: "Clear the jammed cart before it snarls the square.",
  },
  {
    routeKeys: ["work-tea"],
    routeHeadline: "Secure paid work at Kettle & Lamp and follow through.",
    semanticHints: [{ locationId: "tea-house", npcId: "npc-ada" }],
    semanticMoveBonuses: [
      {
        locationId: "tea-house",
        score: 24,
        when: ({ predicateAuthority }) => !predicateAuthority,
      },
    ],
    moveIntents: [
      {
        locationId: "tea-house",
        npcId: "npc-ada",
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp before lunch fills the room; ask Ada whether the lunch work is real.",
      },
    ],
    actionRationales: [
      {
        npcId: "npc-ada",
        rationale:
          "Ask Ada whether the lunch work is real, open, and worth taking now.",
      },
    ],
  },
  {
    routeKeys: ["mara-ada-lead"],
    routeHeadline:
      "Verify Mara's Kettle & Lamp lead and turn it into a real choice.",
    semanticMoveBonuses: [
      {
        locationId: "tea-house",
        score: 28,
        when: ({ predicateAuthority }) => !predicateAuthority,
      },
    ],
  },
  {
    routeKeys: ["work-yard"],
    routeHeadline: "Secure paid yard work and follow through.",
    semanticHints: [{ locationId: "freight-yard", npcId: "npc-tomas" }],
    semanticMoveBonuses: [
      {
        locationId: "freight-yard",
        score: 24,
        when: ({ predicateAuthority }) => !predicateAuthority,
      },
    ],
    moveIntents: [
      {
        label: "Ask Tomas before the freight window closes",
        locationId: "freight-yard",
        npcId: "npc-tomas",
        rationale:
          "Ask Tomas whether paid freight work is still open before the loading window closes.",
      },
    ],
  },
  {
    routeKeys: ["rest-home"],
    routeHeadline: "Recover enough at Morrow House to move cleanly again.",
    moveIntents: [
      {
        label: "Return to Morrow House to recover",
        locationId: ({ world }) => world.player.homeLocationId,
        rationale:
          "Morrow House is where Rowan can recover enough to move cleanly, keep tonight's room safe, and choose the next live opening with a clear head.",
      },
    ],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["commitment-"],
    routeHeadline: "Follow through on accepted work before the window closes.",
  },
];

export function objectiveRouteSemanticHints(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
) {
  const locationIds = new Set<string>();
  const npcIds = new Set<string>();
  const context = { objective, world };

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    for (const hint of scaffold.semanticHints ?? []) {
      if (hint.when && !hint.when(context)) {
        continue;
      }

      const locationId =
        typeof hint.locationId === "function"
          ? hint.locationId(context)
          : hint.locationId;
      if (locationId) {
        locationIds.add(locationId);
      }
      if (hint.npcId) {
        npcIds.add(hint.npcId);
      }
    }
  }

  addRouteDerivedSemanticHints(world, objective, { locationIds, npcIds });

  return {
    locationIds: [...locationIds],
    npcIds: [...npcIds],
  };
}

export function objectiveRouteCompletionAcknowledgement(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const acknowledgement = scaffold.completionAcknowledgement;
    if (
      acknowledgement &&
      (!acknowledgement.when || acknowledgement.when(context))
    ) {
      return {
        feedText: acknowledgement.feedText,
        memoryText: acknowledgement.memoryText,
      };
    }
  }

  return undefined;
}

export function objectiveRouteCompletionPlayerThought(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const acknowledgement = scaffold.completionAcknowledgement;
    if (
      acknowledgement?.playerThought &&
      (!acknowledgement.when || acknowledgement.when(context)) &&
      (!acknowledgement.playerThoughtWhen ||
        acknowledgement.playerThoughtWhen(context))
    ) {
      return acknowledgement.playerThought;
    }
  }

  return undefined;
}

export function objectiveRouteFirstAfternoonCompletionOutcome(): CompletionOutcomeCopy {
  for (const scaffold of activeScaffolds("first-afternoon")) {
    if (scaffold.completionOutcome) {
      return scaffold.completionOutcome;
    }
  }

  throw new Error("First-afternoon completion outcome scaffold is missing.");
}

export function objectiveRouteHeadline(routeKey: string) {
  for (const scaffold of activeScaffolds(routeKey)) {
    if (scaffold.routeHeadline) {
      return scaffold.routeHeadline;
    }
  }

  return undefined;
}

export function objectiveRouteDefaultTextForFocus(focus: ObjectiveFocus) {
  switch (focus) {
    case "rest":
      return "Recover enough to move cleanly again.";
    case "people":
      return "Meet people who could become real friends in South Quay.";
    case "explore":
      return "Learn the lanes and people of South Quay.";
    default:
      return undefined;
  }
}

export function objectiveRoutePeopleRouteScaffold(state: PeopleRouteState): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: PEOPLE_ROUTE_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      npcId: template.npcId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
    steps: PEOPLE_ROUTE_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolvePeopleRouteText(template.title, state),
      detail: resolvePeopleRouteText(template.detail, state),
      progress: resolvePeopleRouteText(template.progress, state),
      done: template.done(state),
      npcId: template.npcId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
  };
}

export function objectiveRouteExploreRouteScaffold(state: ExploreRouteState): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: EXPLORE_ROUTE_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      npcId: template.npcId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
    steps: EXPLORE_ROUTE_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveExploreRouteText(template.title, state),
      detail: resolveExploreRouteText(template.detail, state),
      progress: resolveExploreRouteText(template.progress, state),
      done: template.done(state),
      npcId: template.npcId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
  };
}

export function objectiveRouteFirstAfternoonRouteScaffold(
  state: FirstAfternoonRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: FIRST_AFTERNOON_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      npcId: resolveFirstAfternoonRouteValue(template.npcId, state),
      targetLocationId: resolveFirstAfternoonRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: FIRST_AFTERNOON_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: template.title,
      detail: resolveFirstAfternoonRouteText(template.detail, state),
      progress: resolveFirstAfternoonRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      npcId: resolveFirstAfternoonRouteValue(template.npcId, state),
      targetLocationId: resolveFirstAfternoonRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

export function objectiveRouteMaraAdaLeadRouteScaffold(
  state: MaraAdaLeadRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: MARA_ADA_LEAD_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      npcId: resolveMaraAdaLeadRouteValue(template.npcId, state),
      targetLocationId: resolveMaraAdaLeadRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: MARA_ADA_LEAD_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: template.title,
      detail: resolveMaraAdaLeadRouteText(template.detail, state),
      progress: resolveMaraAdaLeadRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      npcId: resolveMaraAdaLeadRouteValue(template.npcId, state),
      targetLocationId: resolveMaraAdaLeadRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

export function objectiveRouteSettleRouteScaffold(state: SettleRouteState): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: SETTLE_ROUTE_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: resolveSettleRouteText(template.label, state),
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      npcId: resolveSettleRouteValue(template.npcId, state),
      targetLocationId: resolveSettleRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: SETTLE_ROUTE_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveSettleRouteText(template.title, state),
      detail: resolveSettleRouteText(template.detail, state),
      progress: resolveSettleRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      npcId: resolveSettleRouteValue(template.npcId, state),
      targetLocationId: resolveSettleRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

export function objectiveRouteWorkRouteScaffold(state: WorkRouteState): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: WORK_OUTCOME_TEMPLATES.map((template) => ({
      id: resolveWorkRouteText(template.id, state),
      label: resolveWorkRouteText(template.label, state),
      urgency: resolveWorkRouteNumber(template.urgency, state),
      actionId: template.actionId?.(state),
      npcId: resolveWorkRouteValue(template.npcId, state),
      targetLocationId: resolveWorkRouteValue(template.targetLocationId, state),
    })),
    steps: WORK_STEP_TEMPLATES.map((template) => ({
      id: resolveWorkRouteText(template.id, state),
      title: resolveWorkRouteText(template.title, state),
      detail: resolveWorkRouteText(template.detail, state),
      progress: resolveWorkRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      npcId: resolveWorkRouteValue(template.npcId, state),
      targetLocationId: resolveWorkRouteValue(template.targetLocationId, state),
    })),
  };
}

export function objectiveRouteCommittedJobRouteScaffold(
  state: CommittedJobRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: COMMITTED_JOB_OUTCOME_TEMPLATES.map((template) => ({
      id: resolveCommittedJobRouteText(template.id, state),
      label: resolveCommittedJobRouteText(template.label, state),
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
    steps: COMMITTED_JOB_STEP_TEMPLATES.map((template) => ({
      id: resolveCommittedJobRouteText(template.id, state),
      title: resolveCommittedJobRouteText(template.title, state),
      detail: template.detail,
      progress: resolveCommittedJobRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
  };
}

export function objectiveRouteRestRouteScaffold(state: RestRouteState): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: REST_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
    steps: REST_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveRestRouteText(template.title, state),
      detail: resolveRestRouteText(template.detail, state),
      progress: resolveRestRouteText(template.progress, state),
      done: template.done(state),
      actionId: template.actionId?.(state),
      targetLocationId: template.targetLocationId?.(state),
    })),
  };
}

export function objectiveRouteCartProblemRouteScaffold(
  state: HelpProblemRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: CART_PROBLEM_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      targetLocationId: resolveHelpProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: CART_PROBLEM_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveHelpProblemRouteText(template.title, state),
      detail: resolveHelpProblemRouteText(template.detail, state),
      progress: resolveHelpProblemRouteText(template.progress, state),
      done: template.done(state),
      actionId: resolveHelpProblemRouteValue(template.actionId, state),
      targetLocationId: resolveHelpProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

export function objectiveRoutePumpProblemRouteScaffold(
  state: HelpProblemRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: PUMP_PROBLEM_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      targetLocationId: resolveHelpProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: PUMP_PROBLEM_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveHelpProblemRouteText(template.title, state),
      detail: resolveHelpProblemRouteText(template.detail, state),
      progress: resolveHelpProblemRouteText(template.progress, state),
      done: template.done(state),
      actionId: resolveHelpProblemRouteValue(template.actionId, state),
      targetLocationId: resolveHelpProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

export function objectiveRouteToolProblemRouteScaffold(
  state: ToolProblemRouteState,
): {
  outcomes: ObjectiveRouteOutcomeDefinition[];
  steps: ObjectiveTrailItem[];
} {
  return {
    outcomes: TOOL_PROBLEM_OUTCOME_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
      urgency: template.urgency,
      actionId: template.actionId?.(state),
      targetLocationId: resolveToolProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
    steps: TOOL_PROBLEM_STEP_TEMPLATES.map((template) => ({
      id: template.id,
      title: resolveToolProblemRouteText(template.title, state),
      detail: resolveToolProblemRouteText(template.detail, state),
      progress: resolveToolProblemRouteText(template.progress, state),
      done: template.done(state),
      actionId: resolveToolProblemRouteValue(template.actionId, state),
      targetLocationId: resolveToolProblemRouteValue(
        template.targetLocationId,
        state,
      ),
    })),
  };
}

function resolveFirstAfternoonRouteValue(
  value:
    | string
    | ((state: FirstAfternoonRouteState) => string | undefined)
    | undefined,
  state: FirstAfternoonRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveMaraAdaLeadRouteValue(
  value:
    | string
    | ((state: MaraAdaLeadRouteState) => string | undefined)
    | undefined,
  state: MaraAdaLeadRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveFirstAfternoonRouteText(
  value: string | ((state: FirstAfternoonRouteState) => string),
  state: FirstAfternoonRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveMaraAdaLeadRouteText(
  value: string | ((state: MaraAdaLeadRouteState) => string),
  state: MaraAdaLeadRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveSettleRouteValue(
  value: string | ((state: SettleRouteState) => string | undefined) | undefined,
  state: SettleRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveSettleRouteText(
  value: string | ((state: SettleRouteState) => string),
  state: SettleRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveWorkRouteValue(
  value: string | ((state: WorkRouteState) => string | undefined) | undefined,
  state: WorkRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveWorkRouteText(
  value: string | ((state: WorkRouteState) => string),
  state: WorkRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveWorkRouteNumber(
  value: number | ((state: WorkRouteState) => number),
  state: WorkRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveCommittedJobRouteText(
  value: string | ((state: CommittedJobRouteState) => string),
  state: CommittedJobRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveRestRouteText(
  value: string | ((state: RestRouteState) => string),
  state: RestRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveHelpProblemRouteValue(
  value:
    | string
    | ((state: HelpProblemRouteState) => string | undefined)
    | undefined,
  state: HelpProblemRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveHelpProblemRouteText(
  value: string | ((state: HelpProblemRouteState) => string),
  state: HelpProblemRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveToolProblemRouteValue(
  value:
    | string
    | ((state: ToolProblemRouteState) => string | undefined)
    | undefined,
  state: ToolProblemRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveToolProblemRouteText(
  value: string | ((state: ToolProblemRouteState) => string),
  state: ToolProblemRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolvePeopleRouteText(
  value: string | ((state: PeopleRouteState) => string),
  state: PeopleRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveExploreRouteText(
  value: string | ((state: ExploreRouteState) => string),
  state: ExploreRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

export function objectiveRouteMoveIntent(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
): Pick<MoveIntentHint, "actionId" | "label" | "npcId" | "rationale"> | undefined {
  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const intent = (scaffold.moveIntents ?? []).find(
      (candidate) =>
        resolveScaffoldLocationId(candidate.locationId, context) ===
          locationId &&
        (!candidate.when || candidate.when(context)),
    );
    if (intent) {
      return {
        actionId: intent.actionId,
        label: intent.label,
        npcId: intent.npcId,
        rationale: intent.rationale,
      };
    }
  }

  return routeDerivedMoveIntent(world, objective, locationId);
}

function resolveScaffoldLocationId(
  locationId: MoveIntentHint["locationId"],
  context: ScaffoldContext,
) {
  return typeof locationId === "function" ? locationId(context) : locationId;
}

export function objectiveRouteMoveRationaleForOutcome(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  outcomeLabel: string,
) {
  const normalizedOutcomeLabel = outcomeLabel.toLowerCase();
  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const rationale = (scaffold.outcomeMoveRationales ?? []).find((candidate) =>
      candidate.matches(normalizedOutcomeLabel),
    );
    if (rationale) {
      return typeof rationale.rationale === "function"
        ? rationale.rationale(context)
        : rationale.rationale;
    }
  }

  return outcomeLabel;
}

export function objectiveRoutePlayerFacingAutonomyRationale(
  world: StreetGameState,
  rationaleText: string | undefined,
) {
  const normalizedRationale = normalizePlayerFacingRationale(rationaleText ?? "");
  if (!normalizedRationale) {
    return undefined;
  }

  const context = {
    objective: objectiveScaffoldDirectiveForWorld(world),
    world,
  };
  for (const scaffold of OBJECTIVE_ROUTE_SCAFFOLDS) {
    const rationale = (scaffold.playerFacingRationaleNormalizations ?? []).find(
      (candidate) => candidate.matches(normalizedRationale, context),
    );
    if (rationale) {
      return typeof rationale.rationale === "function"
        ? rationale.rationale(context)
        : rationale.rationale;
    }
  }

  return undefined;
}

export function objectiveRouteActionLocationReason(input: {
  actionLabel: string | undefined;
  currentLocationName: string | undefined;
}) {
  const { actionLabel, currentLocationName } = input;
  if (!actionLabel || !currentLocationName) {
    return undefined;
  }

  for (const scaffold of OBJECTIVE_ROUTE_SCAFFOLDS) {
    const reason = (scaffold.actionLocationReasons ?? []).find((candidate) =>
      candidate.matches({
        actionLabel,
        currentLocationName,
      }),
    );
    if (reason) {
      return reason.reason;
    }
  }

  return undefined;
}

export function objectiveRouteActionRationale(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  input: {
    actionId?: string;
    npc?: NpcState;
  },
) {
  if (!input.npc && !input.actionId) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const rationale = (scaffold.actionRationales ?? []).find(
      (candidate) =>
        (!candidate.npcId || candidate.npcId === input.npc?.id) &&
        (!candidate.actionId || candidate.actionId === input.actionId) &&
        (candidate.npcId || candidate.actionId) &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (rationale) {
      return rationale.rationale;
    }
  }

  return undefined;
}

export function objectiveRouteActionTargetLocation(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  actionId: string,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const hint = (scaffold.actionTargetLocations ?? []).find(
      (candidate) =>
        candidate.actionId === actionId &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)),
    );
    if (!hint) {
      continue;
    }

    return typeof hint.locationId === "function"
      ? hint.locationId(context)
      : hint.locationId;
  }

  return undefined;
}

export function objectiveRouteAvailableActions(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
): ObjectiveRouteAvailableAction[] {
  if (!objective) {
    return [];
  }

  const context = { objective, world };
  const actions: ObjectiveRouteAvailableAction[] = [];

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    for (const action of scaffold.availableActions ?? []) {
      if (action.routeKeys && !action.routeKeys.includes(objective.routeKey)) {
        continue;
      }

      if (action.when && !action.when(context)) {
        continue;
      }

      const targetLocationId =
        typeof action.targetLocationId === "function"
          ? action.targetLocationId(context)
          : action.targetLocationId;
      if (!targetLocationId) {
        continue;
      }

      actions.push({
        description: action.description,
        emphasis: action.emphasis,
        id: action.id,
        kind: action.kind,
        label: action.label,
        targetLocationId,
      });
    }
  }

  return actions;
}

export function objectiveRouteConversationThought(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  npc: NpcState,
) {
  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const thought = (scaffold.conversationThoughts ?? []).find(
      (candidate) =>
        candidate.npcId === npc.id &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (thought) {
      return thought.thought;
    }
  }

  return undefined;
}

export function objectiveRoutePlayerThought(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const thought = (scaffold.playerThoughts ?? []).find(
      (candidate) =>
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (thought) {
      return thought.thought;
    }
  }

  return undefined;
}

export function objectiveRouteWorkStageThought(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  input: {
    jobId: string;
    stage: WorkStageThoughtHint["stage"] | undefined;
  },
) {
  if (!objective || !input.stage) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const thought = (scaffold.workStageThoughts ?? []).find(
      (candidate) =>
        candidate.jobId === input.jobId &&
        candidate.stage === input.stage &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (thought) {
      return thought.thought;
    }
  }

  return undefined;
}

export function objectiveRouteConversationFallback(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const fallback = (scaffold.conversationFallbacks ?? []).find(
      (candidate) =>
        candidate.npcId === npc.id &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (fallback) {
      return fallback;
    }
  }

  return undefined;
}

function matchingConversationGroundingPolicy(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
  playerText: string,
) {
  return matchingConversationGroundingPolicyByNpcId(
    world,
    objective,
    npc.id,
    playerText,
  );
}

function matchingConversationGroundingPolicyByNpcId(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npcId: string,
  playerText: string,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, playerText, world };

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const policy = (scaffold.conversationGroundingPolicies ?? []).find(
      (candidate) =>
        candidate.npcId === npcId &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    );
    if (policy) {
      return policy;
    }
  }

  return undefined;
}

export function objectiveRouteConversationGroundingPolicy(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
  playerText: string,
): ObjectiveRouteConversationGroundingPolicy | undefined {
  return matchingConversationGroundingPolicy(
    world,
    objective,
    npc,
    playerText,
  );
}

export function objectiveRouteConversationPromptGroundingLines(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npcId: string,
  playerText: string,
): string[] {
  const policy = matchingConversationGroundingPolicyByNpcId(
    world,
    objective,
    npcId,
    playerText,
  );
  if (!policy) {
    return [];
  }

  const lines = [...(policy.promptRequiredLines ?? [])];
  const playerTextGroundsEvidence =
    policy.playerTextGroundsEvidence ?? policy.responseGroundsEvidence;
  if (playerTextGroundsEvidence(playerText)) {
    lines.push(...(policy.promptGroundedPlayerLines ?? []));
  }

  return lines;
}

export function objectiveRouteTextGroundsConversationPolicy(
  policy: ObjectiveRouteConversationGroundingPolicy | undefined,
  text: string | undefined,
) {
  return Boolean(
    policy &&
      matchingConversationGroundingPolicyById(policy.id)
        ?.responseGroundsEvidence(text),
  );
}

export function objectiveRouteTextAffirmsConversationPolicy(
  policy: ObjectiveRouteConversationGroundingPolicy | undefined,
  text: string | undefined,
) {
  return Boolean(
    policy &&
      matchingConversationGroundingPolicyById(policy.id)
        ?.responseAffirmsEvidence(text),
  );
}

export function objectiveRouteConversationResolutionPointsToPolicy(
  policy: ObjectiveRouteConversationGroundingPolicy | undefined,
  resolution: {
    decision?: string;
    memoryText?: string;
    objectiveText?: string;
    summary?: string;
  },
) {
  return Boolean(
    policy &&
      matchingConversationGroundingPolicyById(policy.id)
        ?.resolutionPointsToEvidence(resolution),
  );
}

export function objectiveRouteConversationHasVisibleEvidence(
  world: StreetGameState,
  policy: ObjectiveRouteConversationGroundingPolicy | undefined,
  closingReply?: string,
) {
  if (!policy) {
    return false;
  }

  const matchedPolicy = matchingConversationGroundingPolicyById(policy.id);
  if (!matchedPolicy) {
    return false;
  }

  if (matchedPolicy.responseGroundsEvidence(closingReply)) {
    return true;
  }

  return world.conversations.some(
    (entry) =>
      entry.npcId === matchedPolicy.npcId &&
      (entry.speaker === "npc" || entry.speaker === "player") &&
      matchedPolicy.responseGroundsEvidence(entry.text),
  );
}

function matchingConversationGroundingPolicyById(id: string) {
  for (const scaffold of OBJECTIVE_ROUTE_SCAFFOLDS) {
    const policy = scaffold.conversationGroundingPolicies?.find(
      (candidate) => candidate.id === id,
    );
    if (policy) {
      return policy;
    }
  }

  return undefined;
}

export function objectiveRouteScriptedReply(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
  playerText: string,
): { reply: string; followupThought?: string } | undefined {
  if (!objective || objective.routeKey !== "first-afternoon") {
    return undefined;
  }

  const normalized = playerText.toLowerCase();
  const firstPlayerLineWithNpc =
    countPlayerConversationsWithNpc(world, npc.id) <= 1;
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const teaWindowClosed = jobWindowClosed(world, teaJob);
  const yardWindowOpen = jobWindowOpen(world, yardJob);

  if (npc.id === "npc-mara" && firstPlayerLineWithNpc) {
    if (
      /\broom\b|\btonight\b|\bmorrow house\b|\bstay\b|\bbed\b/.test(normalized)
    ) {
      if (teaWindowClosed) {
        return {
          reply: yardWindowOpen
            ? "Tonight's bed is still yours if you keep the house easy to live in, but Ada's lunch window already moved on. If you still need coin today, ask Tomas at North Crane before the yard closes."
            : "Tonight's bed is still yours if you keep the house easy to live in, but today's easy paid windows have closed. Come back to Morrow House and take stock instead of chasing stale work.",
          followupThought: yardWindowOpen
            ? "Mara closed the stale lunch lead and pointed Rowan at the live yard window."
            : "Mara did not pretend the work windows waited for Rowan.",
        };
      }

      return {
        reply:
          "Tonight's bed is yours if you keep the house easy to live in. Rinse what you use, don't vanish when something needs doing, and get a little coin in your pocket. The yard pump is already leaking, and Ada at Kettle & Lamp may still need calm hands before lunch.",
        followupThought:
          "Mara made the room conditional: keep the house easy to live in, notice the pump, and find real coin.",
      };
    }

    if (
      /\bwork\b|\bcoin\b|\bjob\b|\bada\b|\bkettle\b|\blamp\b|\blunch\b/.test(
        normalized,
      )
    ) {
      if (teaWindowClosed) {
        return {
          reply: yardWindowOpen
            ? "Ada's lunch rush has already gone. Do not walk there because my morning lead is stale. Tomas still has yard work open if you want coin today."
            : "Ada's lunch rush has already gone and the yard window is closing too. Come back here, take stock, and stop making the block wait for a plan that expired.",
          followupThought: yardWindowOpen
            ? "Mara treated the stale cafe lead as information and redirected Rowan toward the live yard work."
            : "The paid windows have closed; Rowan needs to return and take stock instead of following old hints.",
        };
      }

      return {
        reply:
          "Ada runs the Kettle & Lamp room hard before noon. If you can stay calm, take plates, and not make her repeat herself, ask her directly. Do it before the rush fills the room.",
        followupThought:
          "Ada at Kettle & Lamp is a live paid lead, but only if Rowan moves before lunch.",
      };
    }
  }

  if (npc.id === "npc-ada" && firstPlayerLineWithNpc) {
    if (
      /\bwork\b|\bhelp\b|\bhands?\b|\blunch\b|\bshift\b|\broom\b/.test(
        normalized,
      )
    ) {
      if (teaWindowClosed) {
        return {
          reply: yardWindowOpen
            ? "Lunch already moved on. I cannot pay you for a rush that finished without you, but Tomas may still need hands at North Crane before the yard closes."
            : "Lunch already moved on. I cannot pay you for a rush that finished without you, and today's useful work windows are gone.",
          followupThought: yardWindowOpen
            ? "Ada closed her own window and pointed Rowan at the remaining live work."
            : "Ada made the closed lunch window explicit instead of reopening stale work.",
        };
      }

      if (
        teaJob?.accepted ||
        teaJob?.completed ||
        teaJob?.missed ||
        !jobWindowOpen(world, teaJob)
      ) {
        return undefined;
      }

      return {
        reply:
          "Yes. Lunch is about to start. Clear cups, wipe tables, and keep the counter moving. It pays fourteen if you can stay steady.",
        followupThought:
          "Rowan asked plainly, which is the fastest way Ada knows how to answer.",
      };
    }
  }

  return undefined;
}

export function objectiveRouteSuppressesConversationTopic(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  npc: NpcState,
  topic: string,
  input: { playerAskedTopic: boolean },
) {
  const context = {
    objective,
    playerAskedTopic: input.playerAskedTopic,
    world,
  };

  return activeScaffolds(objective.routeKey).some((scaffold) =>
    (scaffold.conversationTopicSuppressions ?? []).some(
      (candidate) =>
        candidate.npcId === npc.id &&
        candidate.topic === topic &&
        (!candidate.routeKeys ||
          candidate.routeKeys.includes(objective.routeKey)) &&
        (!candidate.when || candidate.when(context)),
    ),
  );
}

export function objectiveRouteDeterministicOpening(
  objective: ObjectiveScaffoldDirective,
  npcId: string,
) {
  return activeScaffolds(objective.routeKey).some(
    (scaffold) =>
      (scaffold.deterministicOpeningNpcIds ?? []).includes(npcId) &&
      (scaffold.deterministicOpeningRouteKeys ?? scaffold.routeKeys).includes(
        objective.routeKey,
      ),
  );
}

export function objectiveRouteSemanticMoveBonus(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
  input: { planningText?: string; predicateAuthority: boolean },
) {
  const context = {
    objective,
    predicateAuthority: input.predicateAuthority,
    world,
  };

  const scaffoldScore = activeScaffolds(objective.routeKey)
    .flatMap((scaffold) => scaffold.semanticMoveBonuses ?? [])
    .filter(
      (bonus) =>
        bonus.locationId === locationId && (!bonus.when || bonus.when(context)),
    )
    .reduce((total, bonus) => total + bonus.score, 0);

  return (
    scaffoldScore +
    routeDerivedSemanticMoveBonus(world, objective, locationId, input)
  );
}

export function objectiveRouteActionPressureScore(
  objective: ObjectiveScaffoldDirective,
  input: RouteActionPressureInput,
) {
  if (
    !input.predicateAuthority &&
    objective.routeKey.startsWith("explore-") &&
    objective.routeKey !== "explore-district"
  ) {
    const targetLocationId = objective.routeKey.slice("explore-".length);
    if (
      input.currentLocationId !== targetLocationId &&
      input.planTargetLocationId !== targetLocationId
    ) {
      return -58;
    }
  }

  if (objective.focus === "tool") {
    if (input.actionId === "buy:item-wrench") {
      return 36;
    }

    if (input.actionKind === "talk") {
      return -18;
    }
  }

  return 0;
}

export function objectiveRouteSpeech(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  npc: NpcState,
  input: {
    normalizedObjectiveText: string;
    playerConversationCount: number;
  },
) {
  const context = {
    normalizedObjectiveText: input.normalizedObjectiveText,
    objective,
    playerConversationCount: input.playerConversationCount,
    world,
  };

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const speech = (scaffold.speechHints ?? []).find(
      (candidate) =>
        candidate.npcId === npc.id &&
        candidate.routeKeys.includes(objective.routeKey) &&
        (!candidate.when || candidate.when(context)),
    );
    if (speech) {
      return speech.speech;
    }
  }

  return undefined;
}

function activeScaffolds(routeKey: string) {
  return OBJECTIVE_ROUTE_SCAFFOLDS.filter(
    (scaffold) =>
      scaffold.routeKeys.includes(routeKey) ||
      (scaffold.routeKeyPrefixes ?? []).some((prefix) =>
        routeKey.startsWith(prefix),
      ),
  );
}

function normalizePlayerFacingRationale(text: string) {
  return text.trim().replace(/[.?!]+$/g, "").toLowerCase();
}

function objectiveScaffoldDirectiveForWorld(
  world: StreetGameState,
): ObjectiveScaffoldDirective {
  return {
    focus: world.player.objective?.focus ?? "custom",
    routeKey: world.player.objective?.routeKey ?? "",
    text: world.player.objective?.text ?? "",
  };
}

export function objectiveRouteHasNiaBlockLead(world: StreetGameState) {
  const objective = world.player.objective;
  if (!objective) {
    return false;
  }

  const objectiveText = [
    objective.text,
    objective.routeKey,
    ...(objective.outcomes ?? []).flatMap((outcome) => [
      outcome.id,
      outcome.label,
      outcome.npcId,
      outcome.evidence,
      ...(outcome.blockers ?? []),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /\bnia\b/.test(objectiveText) &&
    /\b(block|jam|cart|square)\b/.test(objectiveText)
  );
}

function addRouteDerivedSemanticHints(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  output: {
    locationIds: Set<string>;
    npcIds: Set<string>;
  },
) {
  const addProblemLocation = (problemId: string) => {
    const problem = problemById(world, problemId);
    if (problem?.locationId) {
      output.locationIds.add(problem.locationId);
    }
  };
  const addJobLocation = (jobId: string) => {
    const job = jobById(world, jobId);
    if (job?.locationId) {
      output.locationIds.add(job.locationId);
    }
  };
  const planningText = objective.text.toLowerCase();

  if (objective.routeKey.startsWith("people-")) {
    const npcId = objective.routeKey.slice("people-".length);
    if (npcId !== "locals") {
      output.npcIds.add(npcId);
    }
  }

  if (objective.routeKey.startsWith("explore-")) {
    const locationId = objective.routeKey.slice("explore-".length);
    if (locationId !== "district") {
      output.locationIds.add(locationId);
    }
  }

  if (objective.routeKey.startsWith("commitment-")) {
    addJobLocation(objective.routeKey.slice("commitment-".length));
  }

  if (objective.routeKey.includes("pump")) {
    addProblemLocation("problem-pump");
    if (!hasItem(world, "item-wrench")) {
      output.locationIds.add("repair-stall");
      output.npcIds.add("npc-jo");
    }
  }

  if (objective.routeKey.includes("cart")) {
    addProblemLocation("problem-cart");
  }

  if (
    objective.focus === "tool" ||
    objective.routeKey.includes("tool") ||
    /\b(tool|wrench|jo|repair)\b/.test(planningText)
  ) {
    output.locationIds.add("repair-stall");
    output.npcIds.add("npc-jo");
  }
}

function routeDerivedMoveIntent(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
) {
  if (objective.routeKey.startsWith("people-")) {
    const npcId = objective.routeKey.slice("people-".length);
    const npc = npcById(world, npcId);
    const location = findLocation(world, locationId);
    if (npcId !== "locals" && npc?.currentLocationId === locationId) {
      return {
        npcId,
        rationale: `Walk to ${location?.name ?? "the next place"} and make a real introduction with ${npc.name}.`,
      };
    }
  }

  if (
    (objective.focus === "tool" || objective.routeKey.includes("tool")) &&
    locationId === "repair-stall" &&
    !hasItem(world, "item-wrench")
  ) {
    return {
      actionId: "buy:item-wrench",
      rationale:
        "Walk to Jo's repair stall and buy the wrench the problem needs.",
    };
  }

  return undefined;
}

function routeDerivedSemanticMoveBonus(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
  input: { planningText?: string; predicateAuthority: boolean },
) {
  const planningText = (input.planningText ?? objective.text).toLowerCase();
  let score = 0;

  if (!input.predicateAuthority && objective.routeKey.startsWith("people-")) {
    const npcId = objective.routeKey.slice("people-".length);
    if (npcById(world, npcId)?.currentLocationId === locationId) {
      score += 24;
    }
  }

  if (!input.predicateAuthority && objective.routeKey.startsWith("explore-")) {
    const targetLocationId = objective.routeKey.slice("explore-".length);
    if (targetLocationId === locationId) {
      score += 22;
    }
  }

  if (
    (objective.focus === "tool" ||
      (!input.predicateAuthority && objective.routeKey.includes("tool")) ||
      /\b(tool|wrench|jo|repair)\b/.test(planningText)) &&
    locationId === "repair-stall" &&
    !hasItem(world, "item-wrench")
  ) {
    score += 28;
  }

  if (
    !input.predicateAuthority &&
    objective.routeKey.includes("pump") &&
    problemById(world, "problem-pump")?.locationId === locationId &&
    hasItem(world, "item-wrench")
  ) {
    score += 20;
  }

  return score;
}

function npcById(world: StreetGameState, npcId: string) {
  return world.npcs.find((entry) => entry.id === npcId);
}

function findLocation(world: StreetGameState, locationId: string) {
  return world.locations.find((entry) => entry.id === locationId);
}

function problemById(world: StreetGameState, problemId: string) {
  return world.problems.find((entry) => entry.id === problemId);
}

function hasItem(world: StreetGameState, itemId: string) {
  return world.player.inventory.some((item) => item.id === itemId);
}

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
}

function jobWindowMinutesRemaining(world: StreetGameState, job: JobState) {
  return (
    totalMinutesForDayHour(world.clock.day, job.endHour) -
    world.clock.totalMinutes
  );
}

function jobWindowOpen(world: StreetGameState, job: JobState | undefined) {
  return Boolean(
    job &&
    !job.completed &&
    !job.missed &&
    jobWindowMinutesRemaining(world, job) > 0,
  );
}

function firstAfternoonAdaLeadViable(world: StreetGameState) {
  return jobWindowOpen(world, jobById(world, "job-tea-shift"));
}

function jobWindowClosed(world: StreetGameState, job: JobState | undefined) {
  return Boolean(
    job &&
    !job.completed &&
    (job.missed || jobWindowMinutesRemaining(world, job) <= 0),
  );
}

function totalMinutesForDayHour(day: number, hour: number) {
  return (day - 1) * 24 * 60 + hour * 60;
}

function countPlayerConversationsWithNpc(
  world: StreetGameState,
  npcId: string,
) {
  return world.conversations.filter(
    (entry) => entry.npcId === npcId && entry.speaker === "player",
  ).length;
}

function firstAfternoonRoomTermsKnown(world: StreetGameState) {
  return (
    countPlayerConversationsWithNpc(world, "npc-mara") > 0 ||
    Boolean(
      world.firstAfternoon?.planSettledAt ||
      world.firstAfternoon?.leadFieldNote,
    )
  );
}
