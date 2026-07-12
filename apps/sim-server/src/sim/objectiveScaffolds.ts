import type { StreetPlanningObjectiveOutcome } from "../ai/provider.js";
import type {
  ActionKind,
  JobState,
  MemoryEntry,
  NpcState,
  ObjectiveFocus,
  ObjectiveOutcomeStatus,
  ObjectiveTrailItem,
  ObjectiveSource,
  PlayerObjective,
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

type ScaffoldStringResolver =
  | string
  | ((context: ScaffoldContext) => string | undefined);

interface SemanticHint {
  locationId?: ScaffoldStringResolver;
  npcId?: ScaffoldStringResolver;
  when?: (context: ScaffoldContext) => boolean;
}

interface MoveIntentContext extends ScaffoldContext {
  locationId: string;
}

interface MoveIntentHint {
  actionId?: string;
  label?: string;
  locationId: ScaffoldStringResolver;
  npcId?: ScaffoldStringResolver;
  rationale: string | ((context: MoveIntentContext) => string);
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

interface ObjectiveRouteTextMatchInput {
  normalizedText: string;
  previous?: PlayerObjective;
  source: ObjectiveSource;
  text: string;
}

interface ObjectiveRouteSelectionPolicy {
  absorbConversationFocuses?: ObjectiveFocus[];
  matchesObjectiveText?: (input: ObjectiveRouteTextMatchInput) => boolean;
  retainPrevious?: (input: {
    previous: PlayerObjective;
    world: StreetGameState;
  }) => boolean;
  routeKey: string;
}

interface ActionLocationReasonHint {
  matches: (input: {
    actionLabel: string;
    currentLocationName: string;
  }) => boolean;
  reason: string;
}

interface HomeReturnMoveReasonInput {
  rationale?: string;
  targetLocationId?: string;
  targetLocationName?: string;
}

interface HomeReturnMoveReasonHint {
  priority?: number;
  reason:
    | string
    | ((
        input: HomeReturnMoveReasonInput & { homeName: string },
        context: ScaffoldContext,
      ) => string);
  when: (
    input: HomeReturnMoveReasonInput & { homeName: string },
    context: ScaffoldContext,
  ) => boolean;
}

interface CurrentOpeningMoveReasonInput {
  targetLocationId?: string;
  targetLocationName?: string;
}

interface CurrentOpeningMoveReasonHint {
  priority?: number;
  reason:
    | string
    | ((
        input: CurrentOpeningMoveReasonInput,
        context: ScaffoldContext,
      ) => string);
  when: (
    input: CurrentOpeningMoveReasonInput,
    context: ScaffoldContext,
  ) => boolean;
}

interface SemanticMoveBonus {
  locationId: ScaffoldStringResolver;
  score: number;
  when?: (context: SemanticMoveBonusContext) => boolean;
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

export type WorkStageStage = NonNullable<
  NonNullable<StreetGameState["firstAfternoon"]>["teaShiftStage"]
>;

interface WorkStageThoughtHint {
  jobId: string;
  routeKeys?: string[];
  stage: WorkStageStage;
  thought: string;
  when?: (context: ScaffoldContext) => boolean;
}

type WorkStageWatchCopyStage = "ready" | "rush" | "counter";

export interface WorkStageWatchCopy {
  detail: string;
  label: string;
}

interface WorkStageWatchCopyHint extends WorkStageWatchCopy {
  jobId: string;
  routeKeys?: string[];
  stage: WorkStageWatchCopyStage;
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

export type FirstAfternoonWorkWindowDialogueKind =
  | "adaWork"
  | "adaYardHandoff"
  | "maraHome"
  | "maraWork"
  | "tomasYardNextStep"
  | "tomasYardWork";

export type ObjectiveRouteProblemDialogueKind =
  | "joToolOwned"
  | "joToolSell"
  | "niaCartActive"
  | "niaCartSolved";

export interface ObjectiveRouteDialogueReplyVariant {
  choiceKey: string;
  followupChoiceKey: string;
  followupThoughts: string[];
  replyLines: string[];
}

export interface ObjectiveRouteJoMoneyWorkDialogueContext {
  nearbyPlaceName?: string;
}

interface ProblemRouteDialogueHint extends ObjectiveRouteDialogueReplyVariant {
  kind: ObjectiveRouteProblemDialogueKind;
  npcId: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface FirstAfternoonWorkWindowDialogueHint
  extends ObjectiveRouteDialogueReplyVariant {
  kind: FirstAfternoonWorkWindowDialogueKind;
  npcId: string;
  when: (context: ScaffoldContext) => boolean;
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

type PrimaryRowanNeed = "belonging" | "income" | "shelter" | string;

interface AutonomousOpeningContext {
  objectiveClause: string;
  objectiveFocus: ObjectiveFocus;
  objectiveText: string;
  primaryNeed?: PrimaryRowanNeed;
  teaLeadKnown: boolean;
  yardLeadKnown: boolean;
}

interface AutonomousOpeningSpeechRule {
  focus?: ObjectiveFocus;
  npcId?: string;
  speech: string | ((context: AutonomousOpeningContext) => string);
  when?: (context: AutonomousOpeningContext) => boolean;
}

export interface ObjectiveAutonomousOpeningInput
  extends AutonomousOpeningContext {
  npcId: string;
}

interface AutonomousFollowupContext {
  objectiveFocus: ObjectiveFocus;
  objectiveText: string;
  primaryNeed?: PrimaryRowanNeed;
  replyNamesAdaLead: boolean;
  replyNamesTomasLead: boolean;
  replyText: string;
  replyTopics: readonly string[];
}

interface AutonomousFollowupRule {
  focus: ObjectiveFocus;
  npcId?: string;
  followup:
    | string
    | undefined
    | ((context: AutonomousFollowupContext) => string | undefined);
  when?: (context: AutonomousFollowupContext) => boolean;
}

export interface ObjectiveAutonomousFollowupInput
  extends AutonomousFollowupContext {
  npcId: string;
}

interface AutonomousContinuationFallbackContext {
  hasNextNpc: boolean;
  objectiveFocus: ObjectiveFocus;
}

interface AutonomousContinuationFallbackRule {
  focus: ObjectiveFocus;
  speech:
    | string
    | ((context: AutonomousContinuationFallbackContext) => string);
}

export interface ObjectiveAutonomousContinuationFallbackInput
  extends AutonomousContinuationFallbackContext {}

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

export interface ObjectiveRouteScaffoldRoute {
  key: string;
  focus: ObjectiveFocus;
  source: ObjectiveSource;
  steps: ObjectiveTrailItem[];
  outcomes: ObjectiveRouteOutcomeDefinition[];
  terminal?: boolean;
  preferHeadlineText?: boolean;
}

export interface FirstAfternoonRouteState {
  atHome: boolean;
  approachCount: number;
  approachesKnown: boolean;
  consequenceAchieved: boolean;
  consequenceLabel?: string;
  hasRoomTerms: boolean;
  hasTalkedToMara: boolean;
  homeLocationId?: string;
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

export interface ObjectiveRouteOutcomeEvaluation {
  status: ObjectiveOutcomeStatus;
  blockers?: string[];
  evidence?: string;
}

interface ObjectiveRouteOutcomeEvaluationOptions {
  blockers?: string[];
  evidence?: string;
  failed?: boolean;
}

interface HelpProblemRouteOutcomeEvaluationTemplate {
  evaluate: (state: HelpProblemRouteState) => ObjectiveRouteOutcomeEvaluation;
  ids: readonly string[];
}

interface ToolProblemRouteOutcomeEvaluationTemplate {
  evaluate: (state: ToolProblemRouteState) => ObjectiveRouteOutcomeEvaluation;
  ids: readonly string[];
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

export interface ObjectiveRouteCompletionIdleCopy {
  detail: string;
  label: string;
}

interface CompletionIdleCopyHint extends ObjectiveRouteCompletionIdleCopy {
  when?: (context: ScaffoldContext) => boolean;
}

interface CompletionRationaleHint {
  rationale: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface CompletionSummaryTailHint {
  text: string;
  when?: (context: ScaffoldContext) => boolean;
}

interface CompletionOutcomeCopy {
  feedText: string;
  memoryText: string;
  playerThought: string;
}

export interface FirstAfternoonObjectiveCopy {
  focus: ObjectiveFocus;
  text: string;
}

export interface FirstAfternoonPlanChoiceCopy {
  currentThought: string;
  feedText: string;
  invalidLocationFeedText: string;
  memoryText: string;
}

export interface FirstAfternoonObjectiveChoiceCopy
  extends FirstAfternoonPlanChoiceCopy {
  objective: FirstAfternoonObjectiveCopy;
}

export interface FirstAfternoonCompletionCopy {
  alreadyCompletedFeedText: string;
  invalidLocationFeedText: string;
  missingConsequenceFeedText: string;
}

export interface FirstAfternoonFieldNoteCopy {
  evidence: string;
  learned: string;
  memory: string;
  next: string;
}

export interface FirstAfternoonLeadFieldNoteCopy
  extends FirstAfternoonFieldNoteCopy {
  feedText: string;
  memoryText: string;
}

export interface FirstAfternoonFieldNoteInput {
  consequenceEvidence: string;
  consequenceKind: NonNullable<
    NonNullable<StreetGameState["firstAfternoon"]>["consequence"]
  >["kind"];
  consequenceLabel: string;
}

export interface FirstAfternoonLeadFieldNoteInput {
  askedAt: string;
  teaShiftPay: number;
  teaShiftTitle: string;
}

interface FirstAfternoonScaffoldCopy {
  compareChoice: FirstAfternoonObjectiveChoiceCopy;
  completion: FirstAfternoonCompletionCopy;
  completionFieldNote: (
    input: FirstAfternoonFieldNoteInput,
  ) => FirstAfternoonFieldNoteCopy;
  leadFieldNote: (
    input: FirstAfternoonLeadFieldNoteInput,
  ) => FirstAfternoonLeadFieldNoteCopy;
  planSettlement: FirstAfternoonPlanChoiceCopy;
  pumpChoice: FirstAfternoonObjectiveChoiceCopy;
}

interface RouteActionPressureInput {
  actionId: string;
  actionKind: string;
  currentLocationId?: string;
  planTargetLocationId?: string;
  predicateAuthority: boolean;
}

interface RouteActionPressureContext {
  objective: ObjectiveScaffoldDirective;
}

interface RouteActionPressureRule {
  score:
    | number
    | ((
        input: RouteActionPressureInput,
        context: RouteActionPressureContext,
      ) => number);
  when: (
    input: RouteActionPressureInput,
    context: RouteActionPressureContext,
  ) => boolean;
}

export interface ObjectiveDesiredOutcomeScoringInput {
  actionId: string;
  job?: JobState;
  kind?: string;
  locationId?: string;
  npcId?: string;
  plan: {
    waitUntilMinutes?: number;
  };
  priority: number;
  world: StreetGameState;
}

type ObjectiveDesiredOutcomeScoringRule = (
  input: ObjectiveDesiredOutcomeScoringInput,
) => number;

type GenericPlanningDesiredOutcomePolicyId =
  | "income"
  | "shelter-stability"
  | "social-anchors"
  | "useful-help"
  | "tool-ready"
  | "recover"
  | "map-knowledge";

interface GenericPlanningDesiredOutcomeContext extends ScaffoldContext {
  activeJob?: JobState;
  activeProblem?: ProblemState;
  completedJobs: number;
  knownPeople: number;
  planningText: string;
  solvedProblems: number;
  trustedPeople: number;
}

interface GenericPlanningDesiredOutcomePolicy {
  evidence?: (context: GenericPlanningDesiredOutcomeContext) => string | undefined;
  focusMatches?: ObjectiveFocus[];
  id: GenericPlanningDesiredOutcomePolicyId;
  label:
    | string
    | ((context: GenericPlanningDesiredOutcomeContext) => string);
  priority:
    | number
    | ((context: GenericPlanningDesiredOutcomeContext) => number);
  status: (
    context: GenericPlanningDesiredOutcomeContext,
  ) => StreetPlanningObjectiveOutcome["status"];
  textMatches?: RegExp;
  when?: (context: GenericPlanningDesiredOutcomeContext) => boolean;
}

const GENERIC_PLANNING_DESIRED_OUTCOME_POLICIES: GenericPlanningDesiredOutcomePolicy[] =
  [
    {
      id: "shelter-stability",
      label: "Keep tonight's room and improve Rowan's standing at Morrow House.",
      priority: 9,
      status: ({ objective, world }) =>
        objective.routeKey === "first-afternoon" &&
        firstAfternoonRoomTermsKnown(world)
          ? "met"
          : (world.player.reputation.morrow_house ?? 0) >= 2
            ? "met"
            : "open",
      evidence: ({ world }) =>
        `Morrow House standing ${world.player.reputation.morrow_house ?? 0}`,
      focusMatches: ["settle"],
      textMatches: /room|stay|bed|home|foothold/,
    },
    {
      id: "income",
      label: "Turn one real lead into money or a live work commitment.",
      priority: 8,
      status: ({ activeJob, completedJobs }) =>
        completedJobs > 0 || activeJob ? "met" : "open",
      evidence: ({ world }) => `$${world.player.money} on hand`,
      focusMatches: ["settle"],
      textMatches: /room|stay|bed|home|foothold/,
    },
    {
      id: "social-anchors",
      label: "Build enough local ties that Rowan is not only passing through.",
      priority: 5,
      status: ({ objective, trustedPeople, world }) =>
        objective.routeKey === "first-afternoon" &&
        (Boolean(world.firstAfternoon?.approachesKnownAt) ||
          firstAfternoonLiveApproaches(world).length >= 2)
          ? "met"
          : trustedPeople >= 2
            ? "met"
            : "open",
      evidence: ({ knownPeople }) => `${knownPeople} known people`,
      focusMatches: ["settle"],
      textMatches: /room|stay|bed|home|foothold/,
    },
    {
      id: "income",
      label: "Earn money or secure a credible work commitment.",
      priority: 10,
      status: ({ activeJob, completedJobs }) =>
        completedJobs > 0 || activeJob ? "met" : "open",
      evidence: ({ world }) => `$${world.player.money} on hand`,
      focusMatches: ["work"],
      textMatches: /work|job|money|earn|pay|shift/,
    },
    {
      id: "useful-help",
      label: ({ activeProblem }) =>
        activeProblem
          ? `Resolve ${activeProblem.title.toLowerCase()} before it spreads.`
          : "Find and resolve a concrete local problem.",
      priority: 9,
      status: ({ activeProblem, solvedProblems }) =>
        activeProblem?.status === "solved" || solvedProblems > 0
          ? "met"
          : "open",
      evidence: ({ activeProblem }) => activeProblem?.summary,
      focusMatches: ["help"],
      textMatches: /help|fix|solve|repair|problem|pump|cart/,
    },
    {
      id: "tool-ready",
      label: "Get the tool Rowan needs before trying the repair.",
      priority: 8,
      status: ({ world }) => (hasItem(world, "item-wrench") ? "met" : "open"),
      evidence: ({ world }) =>
        hasItem(world, "item-wrench") ? "Wrench in inventory" : "No wrench yet",
      focusMatches: ["tool"],
      textMatches: /tool|wrench|buy/,
    },
    {
      id: "recover",
      label: "Recover enough energy to make the next commitment safely.",
      priority: ({ world }) => (world.player.energy < 35 ? 10 : 7),
      status: ({ world }) => (world.player.energy < 45 ? "open" : "met"),
      evidence: ({ world }) => `${world.player.energy} energy`,
      focusMatches: ["rest"],
      textMatches: /rest|recover|sleep|tired|energy/,
      when: ({ world }) => world.player.energy < 35,
    },
    {
      id: "social-anchors",
      label: "Meet and deepen real local connections.",
      priority: 9,
      status: ({ trustedPeople }) => (trustedPeople >= 2 ? "met" : "open"),
      evidence: ({ knownPeople, trustedPeople }) =>
        `${knownPeople} known people, ${trustedPeople} trusted`,
      focusMatches: ["people"],
      textMatches: /people|friend|trust|meet/,
    },
    {
      id: "map-knowledge",
      label: "Make South Quay more legible by visiting places and asking locals.",
      priority: 8,
      status: ({ world }) =>
        world.player.knownLocationIds.length >= 4 ? "met" : "open",
      evidence: ({ world }) =>
        `${world.player.knownLocationIds.length} known places`,
      focusMatches: ["explore"],
      textMatches: /explore|map|learn|district|bearings/,
    },
  ];

export function buildGenericStreetPlanningOutcomes(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  input: { planningText: string },
): StreetPlanningObjectiveOutcome[] {
  const planningText = input.planningText.toLowerCase();
  const outcomes: StreetPlanningObjectiveOutcome[] = [];
  const context: GenericPlanningDesiredOutcomeContext = {
    activeJob: activeGenericPlanningJob(world),
    activeProblem: mostRelevantGenericPlanningProblem(world, planningText),
    completedJobs: world.jobs.filter((job) => job.completed).length,
    knownPeople: world.player.knownNpcIds.length,
    objective,
    planningText,
    solvedProblems: world.problems.filter(
      (problem) => problem.status === "solved",
    ).length,
    trustedPeople: world.npcs.filter((npc) => npc.trust >= 2).length,
    world,
  };

  for (const policy of GENERIC_PLANNING_DESIRED_OUTCOME_POLICIES) {
    if (!genericPlanningDesiredOutcomeApplies(policy, context)) {
      continue;
    }

    addGenericPlanningOutcome(outcomes, {
      id: policy.id,
      label: resolveGenericPlanningOutcomeValue(policy.label, context),
      priority: resolveGenericPlanningOutcomeValue(policy.priority, context),
      status: policy.status(context),
      evidence: policy.evidence?.(context),
    });
  }

  return outcomes;
}

export const OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICY_IDS = [
  "active-commitment",
  "income",
  "shelter-stability",
  "social-anchors",
  "useful-help",
  "tool-ready",
  "recover",
  "map-knowledge",
] as const;

type ObjectiveDesiredOutcomeScorePolicyId =
  (typeof OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICY_IDS)[number];

const OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICIES: Record<
  ObjectiveDesiredOutcomeScorePolicyId,
  ObjectiveDesiredOutcomeScoringRule
> = {
  "active-commitment": ({ job, kind, locationId, plan, priority, world }) => {
    if (job?.id === world.player.activeJobId && kind === "work") {
      return priority * 3;
    }

    if (job?.id === world.player.activeJobId && kind === "resume") {
      return priority * 2;
    }

    if (locationId && job?.locationId === locationId) {
      return priority;
    }

    if (plan.waitUntilMinutes !== undefined) {
      return priority;
    }

    return 0;
  },
  income: ({ kind, locationId, npcId, priority, world }) => {
    if (kind === "work") {
      return priority * 2.6;
    }

    if (kind === "accept") {
      return priority * 2.1;
    }

    if (npcId === "npc-ada" || npcId === "npc-tomas") {
      return priority * 1.4;
    }

    if (
      locationId &&
      world.jobs.some(
        (candidate) =>
          candidate.locationId === locationId &&
          !candidate.completed &&
          !candidate.missed,
      )
    ) {
      return priority;
    }

    return 0;
  },
  "shelter-stability": ({ kind, locationId, npcId, priority, world }) => {
    if (kind === "contribute") {
      return priority * 2.5;
    }

    if (npcId === "npc-mara") {
      return priority * 1.8;
    }

    if (locationId === world.player.homeLocationId) {
      return priority * 0.7;
    }

    return 0;
  },
  "social-anchors": ({ npcId, priority, world }) => {
    if (!npcId) {
      return 0;
    }

    const npc = npcById(world, npcId);
    return priority * (npc?.known ? 1.2 : 1.8);
  },
  "useful-help": ({ kind, locationId, npcId, priority, world }) => {
    if (kind === "solve") {
      return priority * 4.2;
    }

    if (kind === "inspect") {
      return priority * 2.2;
    }

    if (kind === "buy") {
      return priority * 1.2;
    }

    if (
      locationId &&
      world.problems.some(
        (candidate) =>
          candidate.locationId === locationId &&
          (candidate.status === "active" || candidate.discovered),
      )
    ) {
      return priority;
    }

    if (npcId === "npc-mara" || npcId === "npc-jo" || npcId === "npc-nia") {
      return priority * 0.9;
    }

    return 0;
  },
  "tool-ready": ({ kind, locationId, npcId, priority }) => {
    if (kind === "buy") {
      return priority * 2.8;
    }

    if (npcId === "npc-jo" || locationId === "repair-stall") {
      return priority * 1.3;
    }

    return 0;
  },
  recover: ({ kind, locationId, priority, world }) => {
    if (kind === "rest") {
      return priority * 2.7;
    }

    if (locationId === world.player.homeLocationId) {
      return priority;
    }

    return 0;
  },
  "map-knowledge": ({ kind, locationId, npcId, priority, world }) => {
    if (locationId && !world.player.knownLocationIds.includes(locationId)) {
      return priority * 1.7;
    }

    if (npcId || kind === "inspect") {
      return priority;
    }

    return 0;
  },
};

interface SemanticMoveBonusContext extends ScaffoldContext {
  planningText: string;
  predicateAuthority: boolean;
}

interface ObjectiveRouteScaffold {
  actionRationales?: ActionRationaleHint[];
  actionLocationReasons?: ActionLocationReasonHint[];
  actionPressureRules?: RouteActionPressureRule[];
  actionTargetLocations?: ActionTargetLocationHint[];
  availableActions?: AvailableActionHint[];
  completionAcknowledgement?: CompletionAcknowledgementHint;
  completionIdleCopy?: CompletionIdleCopyHint;
  completionRationale?: CompletionRationaleHint;
  completionSummaryTail?: CompletionSummaryTailHint;
  completionOutcome?: CompletionOutcomeCopy;
  conversationFallbacks?: ConversationFallbackHint[];
  conversationGroundingPolicies?: ConversationGroundingPolicyHint[];
  conversationTopicSuppressions?: ConversationTopicSuppression[];
  conversationThoughts?: ConversationThoughtHint[];
  currentOpeningMoveReasons?: CurrentOpeningMoveReasonHint[];
  deterministicOpeningNpcIds?: string[];
  deterministicOpeningRouteKeys?: string[];
  firstAfternoonWorkWindowDialogue?: FirstAfternoonWorkWindowDialogueHint[];
  firstAfternoon?: FirstAfternoonScaffoldCopy;
  homeReturnMoveReasons?: HomeReturnMoveReasonHint[];
  notebookRecoveryPlanKind?: ObjectiveRouteNotebookRecoveryPlanKind;
  moveIntents?: MoveIntentHint[];
  notebookPlanFallback?: string;
  objectiveFocuses?: ObjectiveFocus[];
  objectiveMatches?: (objective: ObjectiveScaffoldDirective) => boolean;
  objectiveStatePolicies?: ObjectiveRouteSelectionPolicy[];
  outcomeMoveRationales?: OutcomeMoveRationaleHint[];
  playerFacingRationaleNormalizations?: PlayerFacingRationaleNormalizationHint[];
  playerThoughts?: PlayerThoughtHint[];
  problemRouteDialogue?: ProblemRouteDialogueHint[];
  routeHeadline?: string;
  routeKeys: string[];
  routeKeyPrefixes?: string[];
  semanticMoveBonuses?: SemanticMoveBonus[];
  semanticHints?: SemanticHint[];
  speechHints?: SpeechHint[];
  workStageWatchCopy?: WorkStageWatchCopyHint[];
  workStageThoughts?: WorkStageThoughtHint[];
}

const FIRST_AFTERNOON_ROUTE_KEYS = ["first-afternoon"] as const;
const ADA_LEAD_ROUTE_KEYS = [
  "first-afternoon",
  "mara-ada-lead",
  "work-tea",
] as const;

type ObjectiveRouteNotebookRecoveryPlanKind = "nia-block" | "post-afternoon";

export type ObjectiveRouteNotebookBeliefTopic =
  | "shelter"
  | "work"
  | "belonging"
  | "tool"
  | "help";

export type ObjectiveRouteNotebookBeliefConfidence =
  | "possible"
  | "promising"
  | "confirmed";

export interface ObjectiveRouteNotebookBelief {
  id: string;
  topic: ObjectiveRouteNotebookBeliefTopic;
  text: string;
  confidence: ObjectiveRouteNotebookBeliefConfidence;
  source: string;
  npcId?: string;
  locationId?: string;
}

export interface ObjectiveRouteNotebookBeliefCatalogInput {
  firstAfternoonFieldNoteRecorded: boolean;
  firstAfternoonSettled: boolean;
  knownNpcs: {
    ada: boolean;
    jo: boolean;
    mara: boolean;
    nia: boolean;
    tomas: boolean;
  };
  leads: {
    niaCurrentObjective: boolean;
    pumpDiscovered: boolean;
    teaJobDiscovered: boolean;
    yardJobDiscovered: boolean;
  };
  confidence: {
    adaWork: ObjectiveRouteNotebookBeliefConfidence;
    firstAfternoonFieldNote: ObjectiveRouteNotebookBeliefConfidence;
    maraRoom: ObjectiveRouteNotebookBeliefConfidence;
    niaCurrentLead: ObjectiveRouteNotebookBeliefConfidence;
    pumpStanding: ObjectiveRouteNotebookBeliefConfidence;
    tomasWork: ObjectiveRouteNotebookBeliefConfidence;
  };
  pumpStandingVariant: "active-house-problem" | "background-proof";
}

interface ObjectiveRouteNotebookBeliefNarrative {
  clue?: string;
  clueWithTool?: string;
  confidence?: string;
  confidenceWithTool?: string;
  uncertainty?: string;
}

interface ObjectiveRouteNotebookBeliefTemplate {
  confidence: (
    input: ObjectiveRouteNotebookBeliefCatalogInput,
  ) => ObjectiveRouteNotebookBeliefConfidence;
  id: string;
  locationId?: string;
  npcId?: string;
  source:
    | string
    | ((input: ObjectiveRouteNotebookBeliefCatalogInput) => string);
  text:
    | string
    | ((input: ObjectiveRouteNotebookBeliefCatalogInput) => string);
  topic: ObjectiveRouteNotebookBeliefTopic;
  when: (input: ObjectiveRouteNotebookBeliefCatalogInput) => boolean;
}

interface ObjectiveRouteNotebookBeliefRankingPolicy {
  id: string;
  scoreAdjustment: number;
  when: (input: ObjectiveRouteNotebookBeliefScoreAdjustmentInput) => boolean;
}

export interface ObjectiveRouteNotebookBeliefObjectiveMatchInput {
  beliefId: string;
  beliefTopic: ObjectiveRouteNotebookBeliefTopic;
  objectiveText: string;
}

export interface ObjectiveRouteNotebookBeliefScoreAdjustmentInput {
  beliefTopic: ObjectiveRouteNotebookBeliefTopic;
  direct: boolean;
  firstAfternoonSettled: boolean;
  objectiveFocus?: ObjectiveFocus;
  objectiveMatch: boolean;
  objectiveRouteKey?: string;
}

const OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_TEMPLATES: ObjectiveRouteNotebookBeliefTemplate[] =
  [
    {
      id: "belief-first-afternoon-field-note",
      topic: "help",
      text: "Ada has now seen Rowan ask directly, work through lunch, and record what changed; the opening room question is evidence, not the current plan.",
      confidence: ({ confidence }) => confidence.firstAfternoonFieldNote,
      source: "First afternoon field note",
      locationId: "tea-house",
      npcId: "npc-ada",
      when: ({ firstAfternoonSettled }) => firstAfternoonSettled,
    },
    {
      id: "belief-mara-room",
      topic: "shelter",
      text: "Mara is the person most likely to tell Rowan what keeps a room at Morrow House from turning temporary again.",
      confidence: ({ confidence }) => confidence.maraRoom,
      source: "Morrow House",
      npcId: "npc-mara",
      locationId: "boarding-house",
      when: ({ knownNpcs }) => knownNpcs.mara,
    },
    {
      id: "belief-ada-work",
      topic: "work",
      text: "Ada may have paid work at Kettle & Lamp if Rowan shows up before the lunch crowd fills the cafe.",
      confidence: ({ confidence }) => confidence.adaWork,
      source: "Kettle & Lamp",
      npcId: "npc-ada",
      locationId: "tea-house",
      when: ({ knownNpcs, leads }) => leads.teaJobDiscovered || knownNpcs.ada,
    },
    {
      id: "belief-tomas-work",
      topic: "work",
      text: "Tomas may have yard work when the freight window is open and Rowan sounds reliable enough to bother with.",
      confidence: ({ confidence }) => confidence.tomasWork,
      source: "North Crane Yard",
      npcId: "npc-tomas",
      locationId: "freight-yard",
      when: ({ knownNpcs, leads }) =>
        leads.yardJobDiscovered || knownNpcs.tomas,
    },
    {
      id: "belief-jo-tools",
      topic: "tool",
      text: "Jo is the clearest place to turn coins into the right tool when Rowan finally knows what he needs.",
      confidence: () => "promising",
      source: "Mercer Repairs",
      npcId: "npc-jo",
      locationId: "repair-stall",
      when: ({ knownNpcs }) => knownNpcs.jo,
    },
    {
      id: "belief-pump-standing",
      topic: "help",
      text: ({ pumpStandingVariant }) =>
        pumpStandingVariant === "active-house-problem"
          ? "The Morrow Yard pump is now a live house problem, not background noise Rowan can keep treating as later."
          : "Fixing the pump in Morrow Yard could turn house trouble into proof that Rowan notices what needs doing.",
      confidence: ({ confidence }) => confidence.pumpStanding,
      source: "Morrow Yard",
      locationId: "courtyard",
      when: ({ leads }) => leads.pumpDiscovered,
    },
    {
      id: "belief-nia-current-lead",
      topic: "help",
      text: "Jo's clue points Rowan toward Nia before the block jam turns into someone else's problem.",
      confidence: ({ confidence }) => confidence.niaCurrentLead,
      source: ({ knownNpcs }) =>
        knownNpcs.jo ? "Jo at Mercer Repairs" : "Current lead",
      npcId: "npc-nia",
      when: ({ leads }) => leads.niaCurrentObjective,
    },
    {
      id: "belief-nia-people",
      topic: "belonging",
      text: "Nia seems like the kind of person who can explain who matters before Rowan wastes a whole afternoon guessing.",
      confidence: () => "possible",
      source: "South Quay",
      npcId: "npc-nia",
      when: ({ knownNpcs }) => knownNpcs.nia,
    },
  ];

const OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_RANKING_POLICIES: ObjectiveRouteNotebookBeliefRankingPolicy[] =
  [
    {
      id: "stale-opening-shelter-after-first-afternoon",
      scoreAdjustment: -220,
      when: ({
        beliefTopic,
        firstAfternoonSettled,
        objectiveFocus,
        objectiveRouteKey,
      }) =>
        firstAfternoonSettled &&
        beliefTopic === "shelter" &&
        objectiveRouteKey !== "first-afternoon" &&
        objectiveFocus !== "settle",
    },
    {
      id: "settled-shelter-without-live-anchor",
      scoreAdjustment: -90,
      when: ({
        beliefTopic,
        direct,
        firstAfternoonSettled,
        objectiveMatch,
      }) =>
        firstAfternoonSettled &&
        beliefTopic === "shelter" &&
        !direct &&
        !objectiveMatch,
    },
  ];

const OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_NARRATIVES: Record<
  string,
  ObjectiveRouteNotebookBeliefNarrative
> = {
  "belief-first-afternoon-field-note": {
    clue:
      "Evidence: Ada's field note says Rowan asked directly, stayed through lunch, and left Kettle & Lamp with pay and a clearer obligation.",
    confidence: "Confirmed by Ada's field note and the paid tea shift.",
    uncertainty:
      "Which current opening deserves Rowan's recovered hour: North Crane Yard work, the Morrow Yard pump, or another lead?",
  },
  "belief-jo-tools": {
    clue:
      "Evidence: Jo can turn scarce coins into the right tool only if Rowan knows which repair deserves it.",
    uncertainty: "Which local problem is worth spending scarce money on?",
  },
  "belief-nia-current-lead": {
    clue:
      "Evidence: Jo pointed Rowan toward Nia before the block jam turns into someone else's problem.",
    uncertainty: "What does Nia know about the block before it jams?",
  },
  "belief-pump-standing": {
    clue:
      "Evidence: the Morrow Yard pump is discovered, still active, and tied to Rowan's standing at the house.",
    clueWithTool:
      "Evidence: the Morrow Yard pump is active, and Rowan already has the wrench that can make the repair real.",
    confidence:
      "Promising because the house problem is active and Rowan can test it directly.",
    confidenceWithTool:
      "Promising because the problem is active and the needed tool is in Rowan's hands.",
    uncertainty: "Can Rowan turn a small fix into a real local foothold?",
  },
  "belief-tomas-work": {
    clue:
      "Evidence: Tomas described paid yard work at North Crane Yard, and the freight window is the obligation Rowan can still try to meet.",
    confidence: "Confirmed by Tomas and the open freight window.",
  },
};

const OBJECTIVE_ROUTE_NOTEBOOK_RECOVERY_PLANS = {
  "nia-block": "Recover before following Nia's block-jam lead.",
  "post-afternoon":
    "Rest at Morrow House long enough to recover, then choose the yard work, pump, or current opening that still matters.",
} satisfies Record<ObjectiveRouteNotebookRecoveryPlanKind, string>;

const OBJECTIVE_ROUTE_NOTEBOOK_STALE_ENTRY_FALLBACK =
  "Ask the first useful question.";

function textGroundsFirstAfternoonApproaches(
  text: string | undefined,
): boolean {
  const normalized = (text ?? "").toLowerCase();
  return Boolean(
    textGroundsMaraAdaLead(normalized) &&
      /\bpump\b|\bleak(?:ing)?\b|\bmorrow yard\b/.test(normalized),
  );
}

function resolutionPointsToFirstAfternoonApproaches(resolution: {
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
  return Boolean(
    /\bada\b|\bkettle\b|\btea[- ]?house\b/.test(text) &&
      /\bpump\b|\bleak(?:ing)?\b|\bmorrow yard\b/.test(text) &&
      /\bcompare\b|\bapproach(?:es)?\b|\bchoice\b|\bcurrent\b|\blive\b/.test(
        text,
      ),
  );
}

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

function textGroundsAdaLunchWorkOffer(text: string | undefined): boolean {
  const normalized = (text ?? "").toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    /\b(no|not|don't|do not|isn't|closed|can't|cannot|missed|gone|too late)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /\blunch\b|\bcup(?:s)?\b|\bcounter\b|\btables?\b|\btea[- ]?house\b|\bkettle\b|\blamp\b/.test(
      normalized,
    ) &&
    /\bwork\b|\bhelp\b|\bhands?\b|\bshift\b|\buse\b|\bneed(?:s|ed)?\b|\bclear\b|\bwipe\b|\bkeep\b/.test(
      normalized,
    ) &&
    /\bfourteen\b|\b14\b|\bpay\b|\bpays\b|\bpaid\b|\boffer\b|\boffered\b|\bavailable\b|\bon the table\b|\bthrough lunch\b/.test(
      normalized,
    )
  );
}

function resolutionPointsToAdaLunchWorkOffer(resolution: {
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
    /\blunch\b|\bwork\b|\bshift\b|\bhands?\b|\bcounter\b|\bpay\b|\bfourteen\b|\b14\b/.test(
      text,
    )
  );
}

const AUTONOMOUS_OPENING_SPEECH_RULES: AutonomousOpeningSpeechRule[] = [
  {
    focus: "settle",
    npcId: "npc-mara",
    speech:
      "I'm Rowan. New in Brackenport. I've got tonight at Morrow House, and I'd like to be an easy guest. What should I know?",
    when: ({ primaryNeed }) => primaryNeed === "shelter",
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    speech:
      "I'm Rowan. New here. Who might need an extra pair of hands before lunch gets busy?",
    when: ({ primaryNeed }) => primaryNeed === "income",
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    speech:
      "I'm Rowan. New in Brackenport. Who around here is kind to newcomers who ask normal questions?",
    when: ({ primaryNeed }) => primaryNeed === "belonging",
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    speech:
      "I'm Rowan. New in Brackenport. I'm looking for a room, a little work, and a few friendly faces. Where should I start?",
  },
  {
    focus: "settle",
    npcId: "npc-ada",
    speech: "I'm Rowan. I heard lunch might still need hands. Is that still true?",
    when: ({ teaLeadKnown }) => teaLeadKnown,
  },
  {
    focus: "settle",
    npcId: "npc-ada",
    speech: "I'm new here and trying to be helpful. Need another pair of hands right now?",
  },
  {
    focus: "settle",
    npcId: "npc-tomas",
    speech:
      "I'm Rowan. I heard the yard might still need another set of hands. Still true?",
    when: ({ yardLeadKnown }) => yardLeadKnown,
  },
  {
    focus: "settle",
    npcId: "npc-tomas",
    speech:
      "I'm Rowan. New in town. If I want a little honest work today, is the yard still short on hands?",
  },
  {
    focus: "settle",
    npcId: "npc-nia",
    speech:
      "I'm new in South Quay. Who should I talk to if I want to understand the place a little better?",
  },
  {
    focus: "settle",
    speech:
      "I'm new in Brackenport. I'm looking for a room, a little work, and a few friendly faces. Where do I begin?",
  },
  {
    focus: "work",
    npcId: "npc-ada",
    speech:
      "I'm Rowan. I heard you might still need hands for lunch. Is there still room for me?",
    when: ({ teaLeadKnown }) => teaLeadKnown,
  },
  {
    focus: "work",
    npcId: "npc-ada",
    speech:
      "I'm Rowan. I'm looking for work and happy to help. Do you need another pair of hands?",
  },
  {
    focus: "work",
    npcId: "npc-tomas",
    speech:
      "I'm Rowan. I heard the yard might still be short on hands. Still looking?",
    when: ({ yardLeadKnown }) => yardLeadKnown,
  },
  {
    focus: "work",
    npcId: "npc-tomas",
    speech: "I'm Rowan. I'm looking for work. Still need another set of hands in the yard?",
  },
  {
    focus: "work",
    speech: "I'm Rowan. I'm trying to start earning today. Where should I begin?",
  },
  {
    focus: "help",
    npcId: "npc-jo",
    speech: "I'm trying to fix the pump. What tool actually gets it done?",
    when: ({ objectiveText }) => objectiveText.includes("pump"),
  },
  {
    focus: "help",
    speech: "I'm trying to sort out the leaking pump. What matters first?",
    when: ({ objectiveText }) => objectiveText.includes("pump"),
  },
  {
    focus: "help",
    speech: "I heard the square might jam up. What's actually wrong with the cart?",
    when: ({ objectiveText }) => objectiveText.includes("cart"),
  },
  {
    focus: "help",
    speech: "I'm trying to help before anything gets annoying. What needs a hand?",
  },
  {
    focus: "tool",
    speech: "I need the right tool for this. What would actually help me today?",
  },
  {
    focus: "rest",
    speech: "I'm running thin. Is there anything here that can't wait until I get my legs back?",
  },
  {
    focus: "explore",
    speech: "I'm still learning South Quay. What should I look at before I miss it?",
  },
  {
    focus: "people",
    speech: "Who on this block is worth meeting properly if I'm trying to find my footing?",
  },
  {
    speech: "I need a wrench today. What's the quickest honest way to get one?",
    when: ({ objectiveText }) => objectiveText.includes("wrench"),
  },
  {
    speech: "I need to fix the pump. What do I need to know before I start?",
    when: ({ objectiveText }) => objectiveText.includes("pump"),
  },
  {
    speech: ({ objectiveClause }) =>
      `I'm trying to ${objectiveClause}. Where is the easiest place to start?`,
  },
];

const AUTONOMOUS_FOLLOWUP_RULES: AutonomousFollowupRule[] = [
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: "Got it. Anything I should know before I ask Ada?",
    when: ({ objectiveText, replyNamesAdaLead }) =>
      replyNamesAdaLead &&
      (objectiveText.includes("room") ||
        objectiveText.includes("first afternoon")),
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: undefined,
    when: ({ replyNamesAdaLead }) => replyNamesAdaLead,
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: "What helps a room here start feeling less temporary?",
    when: ({ replyTopics }) =>
      !hasConversationTopic(replyTopics, "home") &&
      !hasConversationTopic(replyTopics, "stay"),
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: "And if I need paid work soon, who is good to ask before lunch?",
    when: ({ replyTopics }) => !hasConversationTopic(replyTopics, "work"),
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: "Who would you talk to next if you were new here?",
    when: ({ primaryNeed, replyTopics }) =>
      primaryNeed === "belonging" && !hasConversationTopic(replyTopics, "people"),
  },
  {
    focus: "settle",
    npcId: "npc-mara",
    followup: undefined,
  },
  {
    focus: "settle",
    npcId: "npc-ada",
    followup: "Do you still need hands, or did lunch beat me here?",
    when: ({ replyTopics }) => !hasConversationTopic(replyTopics, "work"),
  },
  {
    focus: "settle",
    npcId: "npc-ada",
    followup: undefined,
  },
  {
    focus: "settle",
    npcId: "npc-jo",
    followup: "What should someone new avoid spending money on?",
  },
  {
    focus: "settle",
    npcId: "npc-tomas",
    followup: "Does the yard still need hands, or did I miss the easy part?",
    when: ({ replyTopics }) =>
      !hasConversationTopic(replyTopics, "work") &&
      !hasConversationTopic(replyTopics, "yard"),
  },
  {
    focus: "settle",
    npcId: "npc-tomas",
    followup: "If I do a good job here, is there anyone I should check with after?",
  },
  {
    focus: "settle",
    npcId: "npc-nia",
    followup: "Who actually makes South Quay feel less strange once you know them?",
  },
  {
    focus: "work",
    npcId: "npc-ada",
    followup: undefined,
    when: ({ replyNamesTomasLead }) => replyNamesTomasLead,
  },
  {
    focus: "work",
    npcId: "npc-ada",
    followup: "Do you actually need hands, or should I keep moving?",
    when: ({ replyTopics }) => !hasConversationTopic(replyTopics, "work"),
  },
  {
    focus: "work",
    npcId: "npc-ada",
    followup: undefined,
    when: ({ replyText }) =>
      /\bfourteen\b|\bpay\b|\bpays\b|\bshift\b|\bcoin\b|\bcoins\b/.test(
        replyText,
      ),
  },
  {
    focus: "work",
    npcId: "npc-ada",
    followup: "What does it pay if I keep up?",
  },
  {
    focus: "work",
    npcId: "npc-tomas",
    followup: "Is the yard actually short on hands, or am I too late?",
    when: ({ replyTopics }) =>
      !hasConversationTopic(replyTopics, "work") &&
      !hasConversationTopic(replyTopics, "yard"),
  },
  {
    focus: "work",
    npcId: "npc-tomas",
    followup: undefined,
    when: ({ replyText }) =>
      /\btwenty-four\b|\bcrates?\b|\bcart lane\b|\bbay\b|\bpay\b|\bpays\b/.test(
        replyText,
      ),
  },
  {
    focus: "work",
    npcId: "npc-tomas",
    followup: "If I take it, what do you need me to move first?",
  },
  {
    focus: "work",
    npcId: "npc-mara",
    followup: undefined,
    when: ({ replyNamesAdaLead }) => replyNamesAdaLead,
  },
  {
    focus: "work",
    npcId: "npc-mara",
    followup: "Who on this block actually follows through when work opens up?",
  },
  {
    focus: "help",
    npcId: "npc-jo",
    followup: "If I buy the wrench, what am I likely to get wrong at the pump?",
    when: ({ objectiveText }) => objectiveText.includes("pump"),
  },
  {
    focus: "help",
    npcId: "npc-mara",
    followup: "If I fix the pump, what else around the house settles down with it?",
    when: ({ objectiveText }) => objectiveText.includes("pump"),
  },
  {
    focus: "help",
    npcId: "npc-nia",
    followup: "When does that cart turn from nuisance into a real jam?",
    when: ({ objectiveText }) => objectiveText.includes("cart"),
  },
  {
    focus: "explore",
    npcId: "npc-mara",
    followup: "What does somebody new usually misunderstand about this block?",
  },
  {
    focus: "explore",
    npcId: "npc-ada",
    followup: "Who here is worth meeting before the day folds up?",
  },
  {
    focus: "explore",
    npcId: "npc-jo",
    followup: "What kind of trouble usually walks in before the people do?",
  },
  {
    focus: "explore",
    npcId: "npc-tomas",
    followup: "Who in the yard actually decides whether somebody belongs there?",
  },
  {
    focus: "explore",
    npcId: "npc-nia",
    followup: "What should I notice if I'm trying to read this place properly?",
  },
  {
    focus: "people",
    npcId: "npc-mara",
    followup: "What does somebody new usually misunderstand about this block?",
  },
  {
    focus: "people",
    npcId: "npc-ada",
    followup: "Who here is worth meeting before the day folds up?",
  },
  {
    focus: "people",
    npcId: "npc-jo",
    followup: "What kind of trouble usually walks in before the people do?",
  },
  {
    focus: "people",
    npcId: "npc-tomas",
    followup: "Who in the yard actually decides whether somebody belongs there?",
  },
  {
    focus: "people",
    npcId: "npc-nia",
    followup: "What should I notice if I'm trying to read this place properly?",
  },
];

const AUTONOMOUS_CONTINUATION_FALLBACK_RULES: AutonomousContinuationFallbackRule[] =
  [
    {
      focus: "settle",
      speech: ({ hasNextNpc }) =>
        hasNextNpc
          ? "Who should I see after you if I'm trying to get my feet under me here?"
          : "What would stop me from still feeling new by tonight?",
    },
    {
      focus: "work",
      speech: "So if the work is not here, where should I try next?",
    },
    {
      focus: "help",
      speech: "What needs doing first?",
    },
    {
      focus: "tool",
      speech: "If I spend the coin, what does it actually unlock for me?",
    },
    {
      focus: "explore",
      speech: ({ hasNextNpc }) =>
        hasNextNpc
          ? "Who should I go see after you?"
          : "What am I still missing about this block?",
    },
    {
      focus: "people",
      speech: ({ hasNextNpc }) =>
        hasNextNpc
          ? "Who should I go see after you?"
          : "What am I still missing about this block?",
    },
    {
      focus: "rest",
      speech: "What can wait until I've got my legs back under me?",
    },
    {
      focus: "custom",
      speech: "So where does that leave me right now?",
    },
  ];

function hasConversationTopic(topics: readonly string[], topic: string) {
  return topics.includes(topic);
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

const CART_PROBLEM_OUTCOME_EVALUATION_TEMPLATES: HelpProblemRouteOutcomeEvaluationTemplate[] =
  [
    {
      ids: ["help-cart-inspect", "cart-discovered"],
      evaluate: ({ problemDiscovered }) =>
        objectiveRouteOutcomeEvaluation(problemDiscovered, {
          blockers: ["The jammed cart has not been inspected yet."],
        }),
    },
    {
      ids: ["help-cart-solve", "cart-solved"],
      evaluate: ({ problemCleared, problemStatus }) =>
        objectiveRouteOutcomeEvaluation(problemCleared, {
          blockers:
            problemStatus === "expired"
              ? ["The jammed cart got worse before anyone cleared it."]
              : ["The jammed cart is still active."],
          evidence: problemStatus,
          failed: problemStatus === "expired",
        }),
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

const PUMP_PROBLEM_OUTCOME_EVALUATION_TEMPLATES: HelpProblemRouteOutcomeEvaluationTemplate[] =
  [
    {
      ids: ["help-pump-inspect", "pump-discovered"],
      evaluate: ({ problemDiscovered }) =>
        objectiveRouteOutcomeEvaluation(problemDiscovered, {
          blockers: ["The pump problem has not been inspected yet."],
        }),
    },
    {
      ids: ["help-pump-tool", "tool-buy", "wrench-in-inventory"],
      evaluate: ({ hasWrench, problemClosed, problemStatus }) =>
        objectiveRouteOutcomeEvaluation(hasWrench || problemClosed, {
          blockers:
            problemStatus === "expired"
              ? ["The pump got away before the tool mattered."]
              : ["Rowan does not have a wrench yet."],
          evidence: hasWrench
            ? "Wrench in inventory."
            : problemStatus === "resolved"
              ? "The pump was already contained by the house."
              : problemStatus,
          failed: problemStatus === "expired",
        }),
    },
    {
      ids: ["help-pump-fix", "pump-solved"],
      evaluate: ({ hasWrench, problemCleared, problemStatus }) =>
        objectiveRouteOutcomeEvaluation(problemCleared, {
          blockers:
            problemStatus === "expired"
              ? ["The pump got away before anyone contained it."]
              : hasWrench
                ? ["The pump is still active."]
                : ["The pump needs a wrench before Rowan can solve it."],
          evidence: problemStatus,
          failed: problemStatus === "expired",
        }),
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

const TOOL_PROBLEM_OUTCOME_EVALUATION_TEMPLATES: ToolProblemRouteOutcomeEvaluationTemplate[] =
  [
    {
      ids: ["tool-return"],
      evaluate: ({ hasWrench, targetLocationId, toolAtProblem }) =>
        objectiveRouteOutcomeEvaluation(hasWrench && toolAtProblem, {
          blockers: hasWrench
            ? ["The tool has not reached the problem yet."]
            : ["Rowan does not have a wrench yet."],
          evidence: targetLocationId,
        }),
    },
    {
      ids: ["tool-use"],
      evaluate: ({ hasWrench, targetCleared, targetStatus }) =>
        objectiveRouteOutcomeEvaluation(targetCleared, {
          blockers: hasWrench
            ? targetStatus === "expired"
              ? ["The target problem got worse before the tool reached it."]
              : ["The target problem is still active."]
            : ["The target problem needs the right tool first."],
          evidence: targetStatus,
          failed: targetStatus === "expired",
        }),
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
      id: "first-afternoon-approaches",
      label: "Multiple live approaches known",
      urgency: 7,
    },
    {
      id: "first-afternoon-consequence",
      label: "One consequential foothold achieved",
      urgency: 6,
    },
    {
      id: "first-afternoon-take-stock",
      label: "First afternoon taken stock",
      urgency: 5,
      actionId: ({ atHome, consequenceAchieved, wrappedFirstAfternoon }) =>
        atHome && consequenceAchieved && !wrappedFirstAfternoon
          ? "reflect:first-afternoon"
          : undefined,
      targetLocationId: ({
        consequenceAchieved,
        homeLocationId,
        wrappedFirstAfternoon,
      }) =>
        consequenceAchieved && !wrappedFirstAfternoon
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
    id: "first-afternoon-approaches",
    title: "Learn more than one live way forward.",
    detail: ({ approachCount, approachesKnown }) =>
      approachesKnown
        ? `Rowan can name ${approachCount} current approaches and let the present situation decide between them.`
        : "Ask what paid work and useful local trouble are actually live before choosing.",
    progress: ({ approachCount, approachesKnown }) =>
      approachesKnown ? `${approachCount} approaches known` : `${approachCount}/2 approaches`,
    done: ({ approachesKnown }) => approachesKnown,
  },
  {
    id: "first-afternoon-consequence",
    title: "Turn one approach into a consequential foothold.",
    detail: ({ consequenceAchieved, consequenceLabel }) =>
      consequenceAchieved
        ? `${consequenceLabel ?? "A useful choice"} changed Rowan's standing in South Quay.`
        : "Follow through on live tea work, yard work, or a grounded local problem; the current state decides which path is strongest.",
    progress: ({ consequenceAchieved, consequenceLabel }) =>
      consequenceAchieved ? consequenceLabel ?? "Foothold achieved" : "Choose and follow through",
    done: ({ consequenceAchieved }) => consequenceAchieved,
  },
  {
    id: "first-afternoon-take-stock",
    title: "Head back to Morrow House and take stock.",
    detail: ({ atHome, consequenceAchieved, consequenceLabel, wrappedFirstAfternoon }) =>
      wrappedFirstAfternoon
        ? `Tonight's bed still holds, and ${consequenceLabel ?? "one useful consequence"} gave Rowan a real foothold.`
        : atHome && consequenceAchieved
          ? "Stop for a minute and record what actually changed today."
          : "Achieve one real consequence, then go back to Morrow House before ending the first afternoon.",
    progress: ({ atHome, wrappedFirstAfternoon }) =>
      wrappedFirstAfternoon
        ? "First afternoon complete"
        : atHome
          ? "Ready to take stock"
          : "Head home",
    done: ({ wrappedFirstAfternoon }) => wrappedFirstAfternoon,
    actionId: ({ atHome, consequenceAchieved, wrappedFirstAfternoon }) =>
      atHome && consequenceAchieved && !wrappedFirstAfternoon
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
    label: "Ask Ada directly",
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
    completionIdleCopy: {
      detail:
        "Good stopping point: tonight's bed still holds, and Rowan has one durable foothold from the approach he actually followed through on.",
      label: "First afternoon complete",
      when: ({ objective, world }) =>
        objective.routeKey === "first-afternoon" &&
        Boolean(world.firstAfternoon?.completedAt),
    },
    completionRationale: {
      rationale:
        "First afternoon complete: Rowan understands the room, compared live approaches, achieved one durable consequence, and recorded what changed.",
      when: ({ objective, world }) =>
        objective.routeKey === "first-afternoon" &&
        Boolean(world.firstAfternoon?.completedAt),
    },
    completionSummaryTail: {
      text: " The first afternoon is complete: room understood, live approaches compared, and one real foothold achieved.",
      when: ({ objective, world }) =>
        objective.routeKey === "first-afternoon" &&
        Boolean(world.firstAfternoon?.completedAt),
    },
    completionOutcome: {
      feedText:
        "Rowan takes stock at Morrow House: tonight's bed still holds, one current approach changed his standing, and the route he took came from what was live rather than an old instruction list.",
      memoryText:
        "You finished the first afternoon with a room to return to and one durable foothold earned through actual follow-through.",
      playerThought:
        "Tonight's bed still holds. I learned what was live, chose one approach from the current block, and changed something people can remember. That is enough for a first afternoon.",
    },
    objectiveStatePolicies: [
      {
        absorbConversationFocuses: ["settle", "work"],
        matchesObjectiveText: ({ text }) =>
          textMatchesMaraAdaLeadObjective(text),
        retainPrevious: ({ previous }) =>
          previous.routeKey === "mara-ada-lead",
        routeKey: "mara-ada-lead",
      },
      {
        absorbConversationFocuses: ["settle", "work"],
        matchesObjectiveText: ({
          normalizedText,
          previous,
          source,
          text,
        }) =>
          normalizedText.includes("first afternoon") ||
          (previous?.routeKey === "first-afternoon" &&
            source !== "manual" &&
            normalizeObjectiveRouteTextForPolicy(text) ===
              normalizeObjectiveRouteTextForPolicy(previous.text)),
        retainPrevious: ({ previous, world }) =>
          previous.routeKey === "first-afternoon" &&
          !world.firstAfternoon?.completionAcknowledgedAt,
        routeKey: "first-afternoon",
      },
    ],
    firstAfternoon: {
      compareChoice: {
        currentThought:
          "Ada's shift is real, but it sits beside the pump, the house, and whatever else is moving through the square.",
        feedText:
          "Rowan keeps Ada's offer in view while checking whether another current opening should come first.",
        invalidLocationFeedText:
          "Step inside Kettle & Lamp before comparing Ada's offer.",
        memoryText:
          "Rowan did not treat Ada's offer as a script; he paused to compare it against the live state of the block.",
        objective: {
          focus: "explore",
          text: "Compare the live work offer with the pump, the square, and any better lead before committing.",
        },
      },
      completion: {
        alreadyCompletedFeedText: "The first afternoon is already settled.",
        invalidLocationFeedText:
          "Bring Rowan back to Morrow House before calling the first afternoon done.",
        missingConsequenceFeedText:
          "There is still no durable consequence to count. Rowan needs to complete live work or solve a grounded local problem first.",
      },
      completionFieldNote: ({
        consequenceEvidence,
        consequenceKind,
        consequenceLabel,
      }) => {
        const nextByKind =
          consequenceKind === "tea-work"
            ? "Let the tea-house standing compete with the yard, the pump, and whatever is still live tomorrow."
            : consequenceKind === "yard-work"
              ? "Let the yard standing compete with house needs and other live work instead of assuming the same route repeats."
              : "Carry the local trust from solving the problem into the next paid, social, or house-facing opening.";
        return {
          evidence: consequenceEvidence,
          learned: `${consequenceLabel} became Rowan's first durable foothold in South Quay.`,
          memory: `People can now remember that Rowan followed through on ${consequenceLabel.toLowerCase()}.`,
          next: nextByKind,
        };
      },
      leadFieldNote: ({ askedAt, teaShiftPay, teaShiftTitle }) => ({
        evidence: `Asked Ada at Kettle & Lamp at ${askedAt}; she offered ${teaShiftTitle.toLowerCase()} for $${teaShiftPay}.`,
        feedText:
          "Rowan records the lead as grounded knowledge: Ada at Kettle & Lamp has real lunch work on the table.",
        learned:
          "Mara's Kettle & Lamp lead is real: Ada needs steady lunch help today.",
        memory:
          "Ada remembers Rowan asked directly before the lunch rush instead of waiting for work to find him.",
        memoryText:
          "You verified Mara's lead at Kettle & Lamp: Ada needs steady lunch help and offered the cup-and-counter shift.",
        next:
          "Ada's offer is now a current choice: take the cup-and-counter shift, compare another opening, or deliberately walk away before the window closes.",
      }),
      planSettlement: {
        currentThought:
          "Mara gave me more than one live approach: Ada's lunch work and the leaking pump are both real. The current legal choices can decide which deserves the first follow-through.",
        feedText:
          "Rowan records more than one live approach without settling the afternoon to a single route.",
        invalidLocationFeedText:
          "Step inside Morrow House before settling that plan.",
        memoryText:
          "When the first afternoon opened up, Rowan kept Ada's work and the house's local trouble as competing live approaches.",
      },
      pumpChoice: {
        currentThought:
          "The pump is not glamorous, but solving house trouble is one way to make tonight's bed feel less borrowed.",
        feedText:
          "Rowan chooses the Morrow Yard pump as the first proof that he notices what the house needs.",
        invalidLocationFeedText:
          "Step inside Morrow House before weighing that lead.",
        memoryText:
          "Rowan chose the pump over the obvious work lead because the house itself had a live problem.",
        objective: {
          focus: "help",
          text: "Fix the leaking pump in Morrow Yard before it spreads.",
        },
      },
    },
    deterministicOpeningNpcIds: ["npc-mara", "npc-ada", "npc-jo", "npc-tomas"],
    deterministicOpeningRouteKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
    semanticHints: [
      { locationId: ({ world }) => world.player.homeLocationId },
      {
        locationId: "tea-house",
        npcId: "npc-ada",
        when: ({ objective, world }) =>
          objective.routeKey === "mara-ada-lead" &&
          firstAfternoonAdaLeadViable(world),
      },
      {
        locationId: ({ world }) => world.player.homeLocationId,
        when: ({ world }) =>
          Boolean(firstAfternoonConsequence(world)),
      },
    ],
    moveIntents: [
      {
        label: "Follow Mara's lead to Kettle & Lamp",
        locationId: "tea-house",
        npcId: "npc-ada",
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp; Rowan needs to ask her directly before lunch fills the room.",
        when: ({ objective, world }) =>
          objective.routeKey === "mara-ada-lead" &&
          firstAfternoonAdaLeadViable(world) &&
          countPlayerConversationsWithNpc(world, "npc-ada") === 0,
      },
      {
        label: "Return to Morrow House to take stock",
        locationId: ({ world }) => world.player.homeLocationId,
        rationale:
          "One durable consequence landed, and Morrow House is the right place to record what actually changed.",
        when: ({ world }) =>
          Boolean(firstAfternoonConsequence(world)) &&
          !world.firstAfternoon?.completedAt,
      },
    ],
    outcomeMoveRationales: [
      {
        matches: (outcomeLabel) =>
          outcomeLabel.includes("ask ada directly"),
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp; Rowan needs to ask her directly before lunch fills the room",
      },
      {
        matches: (outcomeLabel) =>
          outcomeLabel.includes("first afternoon taken stock"),
        rationale:
          "One durable consequence landed, and Morrow House is the right place to record what actually changed",
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
          normalizedRationale.includes("ask ada directly"),
        rationale:
          "Mara's lead points to Ada at Kettle & Lamp; Rowan needs to ask her directly before lunch fills the room",
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
        rationale:
          "one durable consequence landed, and Morrow House is the right place to record what actually changed",
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
          "Mara made two current approaches concrete: Ada's lunch work and the leaking pump. Neither one settles the plan by itself.",
      },
      {
        npcId: "npc-ada",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        thought:
          "Ada made the work concrete. If I can stay steady through lunch, tonight feels less temporary.",
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
          "Ada at Kettle & Lamp may still need lunch hands, and the pump in Morrow Yard is already leaking. Both are real; check the current choices and follow through on one.",
          "Kettle & Lamp has possible lunch work, while the yard pump is making the house harder to live in. Those are two live approaches, not one settled route.",
          "Ask Ada if paid work matters most, or inspect the leaking pump if useful local standing matters more. Let what is legal now decide the first move.",
        ],
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return !jobWindowClosed(world, teaJob);
        },
      },
    ],
    firstAfternoonWorkWindowDialogue: [
      {
        choiceKey: "mara-work",
        followupChoiceKey: "mara-work-followup",
        followupThoughts: [
          "Ada will set him straight kindly.",
          "That should be enough to start.",
          "A tea room is a gentle first step.",
        ],
        kind: "maraWork",
        npcId: "npc-mara",
        replyLines: [
          "Ask Ada at Kettle & Lamp before lunch. She always knows who could use an extra pair of hands.",
          "Kettle & Lamp may need help before the lunch crowd wanders in. Try Ada now.",
          "Start with Ada at Kettle & Lamp. She will tell you quickly if lunch needs help.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return !jobWindowClosed(world, teaJob);
        },
      },
      {
        choiceKey: "mara-work-tea-closed-yard-open",
        followupChoiceKey: "mara-work-tea-closed-yard-open-followup",
        followupThoughts: [
          "The first work lead closed, but the day has not fully shut.",
          "Tomas is the live option now.",
          "That answer changed the route instead of pretending time held still.",
        ],
        kind: "maraWork",
        npcId: "npc-mara",
        replyLines: [
          "Ada's lunch window has already moved on. If you still need coin today, try Tomas at North Crane before the yard closes.",
          "Kettle & Lamp already had to solve lunch without you. North Crane Yard is the only work lead I would still chase today.",
          "Ada was the morning answer. This late, ask Tomas at the yard if he still has a loading block open.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "mara-work-closed",
        followupChoiceKey: "mara-work-closed-followup",
        followupThoughts: [
          "The day closed some doors.",
          "He needs to stop chasing a stale lead.",
          "Tomorrow will need a cleaner start.",
        ],
        kind: "maraWork",
        npcId: "npc-mara",
        replyLines: [
          "Ada's lunch window is gone, and the yard has likely moved on too. Go take stock before you chase tomorrow badly.",
          "Today's easy paid windows have closed. Come back to the house, count what is true, and start cleaner tomorrow.",
          "You missed the useful work hours for today. That does not end the story, but it changes the next move.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && !jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "mara-home",
        followupChoiceKey: "mara-home-followup",
        followupThoughts: [
          "That is the heart of it.",
          "Keep the house easy.",
          "A fair answer is enough.",
        ],
        kind: "maraHome",
        npcId: "npc-mara",
        replyLines: [
          "Pay when you say you will, be kind in the shared spaces, and rinse your cup before it becomes everyone's cup. If you need coin today, ask Ada at Kettle & Lamp before lunch.",
          "Morrow House keeps people who make the place easier to wake up in. Ada may still need help through lunch if you want the room to feel less temporary.",
          "A room starts feeling like yours when you treat the house like it is partly yours too. Start with Ada at Kettle & Lamp if you need honest work today.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return !jobWindowClosed(world, teaJob);
        },
      },
      {
        choiceKey: "mara-home-tea-closed-yard-open",
        followupChoiceKey: "mara-home-work-closed-followup",
        followupThoughts: [
          "That was a grounded answer.",
          "The room advice changed with the hour.",
          "Closed windows matter here.",
        ],
        kind: "maraHome",
        npcId: "npc-mara",
        replyLines: [
          "Pay when you say you will, be kind in the shared spaces, and stop chasing Ada's lunch window. If coin still matters today, ask Tomas at North Crane.",
          "Morrow House keeps people who notice when a window closes. Lunch moved on, but the yard may still have a loading block.",
          "A room starts feeling like yours when you adapt. Ada's lunch is done; Tomas is the only work lead I would still try today.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "mara-home-work-closed",
        followupChoiceKey: "mara-home-work-closed-followup",
        followupThoughts: [
          "That was a grounded answer.",
          "The room advice changed with the hour.",
          "Closed windows matter here.",
        ],
        kind: "maraHome",
        npcId: "npc-mara",
        replyLines: [
          "Pay when you say you will, be kind in the shared spaces, and stop chasing closed doors. Tonight is for taking stock.",
          "Morrow House keeps people who notice when the day has changed. The paid windows moved on; come back clear-eyed.",
          "A room starts feeling like yours when you adapt. The work windows are gone for today, so count what you still have.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && !jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "ada-work-open",
        followupChoiceKey: "ada-work-open-followup",
        followupThoughts: [
          "He might manage the room.",
          "Steady is plenty.",
          "Tea after, if he survives lunch.",
        ],
        kind: "adaWork",
        npcId: "npc-ada",
        replyLines: [
          "I could use help through lunch: clear cups, wipe tables, keep an eye on the counter. The shift pays fourteen if you can stay steady.",
          "Lunch is coming. Clear cups, wipe tables, listen the first time. Fourteen for the shift, and tea after if we both survive it.",
          "I can use steady hands through lunch. It is simple work, and it pays fourteen.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return Boolean(
            !teaJob?.accepted &&
              !teaJob?.completed &&
              !teaJob?.missed &&
              !jobWindowClosed(world, teaJob),
          );
        },
      },
      {
        choiceKey: "ada-work-tea-closed-yard-open",
        followupChoiceKey: "ada-work-tea-closed-yard-open-followup",
        followupThoughts: [
          "Ada closed her door without closing the whole day.",
          "Tomas is the live work lead now.",
          "The answer changed with the clock.",
        ],
        kind: "adaWork",
        npcId: "npc-ada",
        replyLines: [
          "Lunch already moved on. I cannot pay you for a rush that finished without you, but Tomas may still need hands at North Crane.",
          "You missed my useful window. If you still want today's coin, go ask Tomas before the yard shuts.",
          "The cup-and-counter work is gone for today. North Crane is the only place I would still ask.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "ada-work-closed",
        followupChoiceKey: "ada-work-closed-followup",
        followupThoughts: [
          "That window is gone.",
          "The room did not wait.",
          "Tomorrow needs a better start.",
        ],
        kind: "adaWork",
        npcId: "npc-ada",
        replyLines: [
          "Lunch already moved on, and I cannot pay you for a rush that finished without you.",
          "You missed my useful window. Come earlier tomorrow if you want this room to need you.",
          "The cup-and-counter work is gone for today. Do not stand here pretending lunch waited.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, teaJob) && !jobWindowOpen(world, yardJob);
        },
      },
      {
        choiceKey: "ada-yard-handoff",
        followupChoiceKey: "ada-yard-handoff-followup",
        followupThoughts: [
          "Maybe Tomas can use Rowan next.",
          "He can go see Tomas now.",
          "The yard will be louder than this.",
        ],
        kind: "adaYardHandoff",
        npcId: "npc-ada",
        replyLines: [
          "You kept up. Tomas by the yard may need another set of hands, and he's easier after someone else has already vouched for you.",
          "You kept pace. If you still want coin, try Tomas before the afternoon goes sleepy.",
          "You did fine here. North Crane Yard is the next place I would ask, preferably with a full cup in you.",
        ],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          const yardJob = jobById(world, "job-yard-shift");
          return Boolean(
            teaJob?.completed && !yardJob?.discovered && !yardJob?.missed,
          );
        },
      },
      {
        choiceKey: "tomas-yard-next-step",
        followupChoiceKey: "tomas-yard-next-step-followup",
        followupThoughts: [
          "That is clear enough.",
          "Crates first, then pay.",
          "He gave the actual job.",
        ],
        kind: "tomasYardNextStep",
        npcId: "npc-tomas",
        replyLines: [
          "Take the short loading block if you want it. Start with the lighter crates by the bay, keep the cart lane clear, and I will pay twenty-four when the run is done.",
          "First thing is simple: stack the small crates by the service bay and leave the handcart lane open. Twenty-four when it is done.",
          "If you are in, start with the crates nearest the bay door. Keep the lane clear for the handcart, finish the run, and the pay is twenty-four.",
        ],
        when: ({ world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          return Boolean(
            yardJob?.discovered &&
              !yardJob.accepted &&
              !yardJob.completed &&
              !yardJob.missed &&
              !jobWindowClosed(world, yardJob),
          );
        },
      },
      {
        choiceKey: "tomas-yard-next-step-closed",
        followupChoiceKey: "tomas-yard-next-step-closed-followup",
        followupThoughts: [
          "The yard did not hold the work open.",
          "He heard the window close.",
          "There is no stale shift to take.",
        ],
        kind: "tomasYardNextStep",
        npcId: "npc-tomas",
        replyLines: [
          "The loading block already moved. I cannot pay hands I did not have when the carts were here.",
          "Too late for that run. The lane is clear now because we cleared it without you.",
          "That work is done for today. Come earlier if you want the yard to build around you.",
        ],
        when: ({ world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          return Boolean(
            yardJob?.discovered &&
              !yardJob.accepted &&
              !yardJob.completed &&
              !yardJob.missed &&
              jobWindowClosed(world, yardJob),
          );
        },
      },
      {
        choiceKey: "tomas-yard-offer",
        followupChoiceKey: "tomas-yard-offer-followup",
        followupThoughts: [
          "Keep it simple.",
          "He either lifts or he doesn't.",
          "The path can stay clear.",
        ],
        kind: "tomasYardWork",
        npcId: "npc-tomas",
        replyLines: [
          "Short loading block by the yard. Twenty-four coins if you keep the cart lane clear and stack the lighter crates by the bay.",
          "One loading block. Keep up, finish clean, and I pay twenty-four. Start with the crates by the service bay.",
          "The yard needs another set of hands for a short run. Twenty-four if you can start with the bay crates now.",
        ],
        when: ({ world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          return Boolean(
            !yardJob?.accepted &&
              !yardJob?.completed &&
              !yardJob?.missed &&
              !jobWindowClosed(world, yardJob),
          );
        },
      },
      {
        choiceKey: "tomas-yard-closed",
        followupChoiceKey: "tomas-yard-closed-followup",
        followupThoughts: [
          "The yard did not hold the work open.",
          "He heard the window close.",
          "There is no stale shift to take.",
        ],
        kind: "tomasYardWork",
        npcId: "npc-tomas",
        replyLines: [
          "The loading block already moved. I cannot pay hands I did not have when the carts were here.",
          "Too late for that run. The lane is clear now because we cleared it without you.",
          "That work is done for today. Come earlier if you want the yard to build around you.",
        ],
        when: ({ world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          return jobWindowClosed(world, yardJob);
        },
      },
    ],
    conversationGroundingPolicies: [
      {
        fallbackReason:
          "Live Mara reply did not ground multiple first-afternoon approaches after Rowan's follow-up.",
        fallbackReply: {
          followupThought: "Ada's work and the pump are both current approaches.",
          reply:
            "Morrow House can hold you tonight if you help keep it easy to live in. Ada at Kettle & Lamp may need lunch hands, and the pump in Morrow Yard is leaking now. Both are live approaches; choose from what the block actually allows.",
        },
        followupPlayerText:
          "Just to be clear, are Ada's Kettle & Lamp lunch work and the leaking Morrow Yard pump both live ways I could make this afternoon count?",
        id: "mara-first-afternoon-approaches-grounding",
        npcId: "npc-mara",
        playerTextGroundsEvidence: textGroundsFirstAfternoonApproaches,
        promptGroundedPlayerLines: [
          "- Rowan's line names both Ada/Kettle & Lamp lunch work and the leaking Morrow Yard pump. Confirm both plainly.",
          "- Do not select one approach for Rowan. Explain that both are current possibilities and the legal current state should decide.",
        ],
        promptRequiredLines: [
          "- Required for this Mara reply: visibly ground both Ada/Kettle & Lamp work and the leaking Morrow Yard pump.",
          "- Present these as competing live approaches, not a command to follow Ada.",
        ],
        resolutionFallback: {
          decision:
            "compare Ada's live lunch work with the leaking pump and choose from the simulator-legal current actions.",
          memoryKind: "self",
          memoryText:
            "Mara made both Ada's work and the pump concrete without choosing the route for Rowan.",
          summary:
            "Mara exposed multiple live first-afternoon approaches without settling the plan.",
        },
        responseAffirmsEvidence: textGroundsFirstAfternoonApproaches,
        responseGroundsEvidence: textGroundsFirstAfternoonApproaches,
        resolutionPointsToEvidence:
          resolutionPointsToFirstAfternoonApproaches,
        routeKeys: ["first-afternoon"],
        when: ({ world }) => !world.firstAfternoon?.approachesKnownAt,
      },
      {
        fallbackReason:
          "Live Ada reply did not make the lunch work offer concrete.",
        fallbackReply: {
          followupThought:
            "Ada is making the offer concrete enough to act on.",
          reply:
            "I can use help through lunch: clear cups, wipe tables, and keep the counter moving. It pays fourteen if you can stay steady.",
        },
        followupPlayerText:
          "Can you say exactly what work is available here at Kettle & Lamp today?",
        id: "ada-lunch-work-offer-grounding",
        npcId: "npc-ada",
        promptGroundedPlayerLines: [
          "- Rowan is asking whether Ada has real lunch work available now. Answer with the actual work, not only yes or no.",
          "- Good shape for this answer: I can use help through lunch: clear cups, wipe tables, keep the counter moving. It pays fourteen.",
        ],
        promptRequiredLines: [
          "- Required for this Ada reply: make the offer concrete by naming lunch or the Kettle & Lamp counter work, the task, and the pay or live availability.",
          "- Do not answer only with 'yes' or a generic confirmation; the player must see what Ada is offering before the shift choice opens.",
        ],
        resolutionFallback: {
          decision:
            "ask Ada for the concrete lunch-work terms before treating the lead as verified.",
          memoryKind: "self",
          memoryText:
            "Ada's answer was not specific enough yet to turn Mara's lead into grounded work evidence.",
          summary:
            "Ada has not yet made the Kettle & Lamp lunch-work offer visible in the conversation.",
        },
        responseAffirmsEvidence: textGroundsAdaLunchWorkOffer,
        responseGroundsEvidence: textGroundsAdaLunchWorkOffer,
        resolutionPointsToEvidence: resolutionPointsToAdaLunchWorkOffer,
        routeKeys: [...ADA_LEAD_ROUTE_KEYS],
        when: ({ world }) => {
          const teaJob = jobById(world, "job-tea-shift");
          return Boolean(
            !world.firstAfternoon?.leadFieldNote &&
              teaJob &&
              !teaJob.accepted &&
              !teaJob.completed &&
              !teaJob.missed &&
              jobWindowOpen(world, teaJob),
          );
        },
      },
    ],
    actionRationales: [
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
          Boolean(firstAfternoonConsequence(world)),
      },
    ],
    actionTargetLocations: [
      {
        actionId: "reflect:first-afternoon",
        locationId: ({ world }) => world.player.homeLocationId,
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
      },
    ],
    homeReturnMoveReasons: [
      {
        priority: 20,
        reason: ({ homeName }) =>
          `${homeName} is where Rowan can take stock after a durable consequence and record what actually changed.`,
        when: (_input, { objective, world }) =>
          objective.routeKey === "first-afternoon" &&
          Boolean(firstAfternoonConsequence(world)),
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
    workStageWatchCopy: [
      {
        jobId: "job-tea-shift",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        stage: "ready",
        label: "Start the lunch rush",
        detail:
          "Lunch is filling Kettle & Lamp. Rowan can start with cups, tables, and the counter.",
      },
      {
        jobId: "job-tea-shift",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        stage: "rush",
        label: "Keep the lunch rush moving",
        detail:
          "The room is busy now. Rowan can keep clearing cups and watching Ada's rhythm.",
      },
      {
        jobId: "job-tea-shift",
        routeKeys: [...FIRST_AFTERNOON_ROUTE_KEYS],
        stage: "counter",
        label: "Finish the cup-and-counter shift",
        detail:
          "The rush is almost through. Rowan can finish the last counter pass and collect the pay.",
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
    homeReturnMoveReasons: [
      {
        priority: 10,
        reason: ({ homeName }) =>
          `${homeName} is where Rowan can keep tonight's room safe and turn today's standing into a steadier foothold.`,
        when: (_input, { objective, world }) =>
          objective.routeKey === "settle-core" &&
          Boolean(world.firstAfternoon?.completedAt),
      },
    ],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["people-"],
    routeHeadline: "Meet people who could become real friends in South Quay.",
    semanticHints: [{ npcId: peopleRouteNpcId }],
    moveIntents: [
      {
        locationId: peopleRouteNpcLocationId,
        npcId: peopleRouteNpcId,
        rationale: peopleRouteMoveRationale,
        when: (context) => Boolean(peopleRouteNpcLocationId(context)),
      },
    ],
    semanticMoveBonuses: [
      {
        locationId: peopleRouteNpcLocationId,
        score: 24,
        when: (context) =>
          !context.predicateAuthority &&
          Boolean(peopleRouteNpcLocationId(context)),
      },
    ],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["explore-"],
    routeHeadline: "Learn the lanes and people of South Quay.",
    actionPressureRules: [
      {
        score: -58,
        when: (input, { objective }) => {
          if (
            input.predicateAuthority ||
            objective.routeKey === "explore-district"
          ) {
            return false;
          }

          const targetLocationId = objective.routeKey.slice("explore-".length);
          return (
            input.currentLocationId !== targetLocationId &&
            input.planTargetLocationId !== targetLocationId
          );
        },
      },
    ],
    semanticHints: [{ locationId: exploreRouteSemanticLocationId }],
    semanticMoveBonuses: [
      {
        locationId: exploreRouteMoveBonusLocationId,
        score: 22,
        when: (context) => !context.predicateAuthority,
      },
    ],
  },
  {
    routeKeys: [],
    objectiveMatches: (objective) => objective.routeKey.includes("pump"),
    semanticHints: [
      { locationId: problemRouteLocationId("problem-pump") },
      {
        locationId: "repair-stall",
        npcId: "npc-jo",
        when: ({ world }) => !hasItem(world, "item-wrench"),
      },
    ],
    semanticMoveBonuses: [
      {
        locationId: problemRouteLocationId("problem-pump"),
        score: 20,
        when: ({ predicateAuthority, world }) =>
          !predicateAuthority && hasItem(world, "item-wrench"),
      },
    ],
  },
  {
    routeKeys: [],
    objectiveMatches: (objective) => objective.routeKey.includes("cart"),
    semanticHints: [{ locationId: problemRouteLocationId("problem-cart") }],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["tool-"],
    objectiveFocuses: ["tool"],
    objectiveMatches: (objective) =>
      objective.routeKey.includes("tool") || objectiveTextMentionsTool(objective),
    actionPressureRules: [
      {
        score: 36,
        when: (input, { objective }) =>
          objective.focus === "tool" && input.actionId === "buy:item-wrench",
      },
      {
        score: -18,
        when: (input, { objective }) =>
          objective.focus === "tool" && input.actionKind === "talk",
      },
    ],
    semanticHints: [{ locationId: "repair-stall", npcId: "npc-jo" }],
    moveIntents: [
      {
        actionId: "buy:item-wrench",
        locationId: "repair-stall",
        rationale:
          "Walk to Jo's repair stall and buy the wrench the problem needs.",
        when: ({ objective, world }) =>
          (objective.focus === "tool" || objective.routeKey.includes("tool")) &&
          !hasItem(world, "item-wrench"),
      },
    ],
    semanticMoveBonuses: [
      {
        locationId: "repair-stall",
        score: 28,
        when: ({ objective, planningText, predicateAuthority, world }) =>
          (objective.focus === "tool" ||
            (!predicateAuthority && objective.routeKey.includes("tool")) ||
            /\b(tool|wrench|jo|repair)\b/.test(planningText.toLowerCase())) &&
          !hasItem(world, "item-wrench"),
      },
    ],
  },
  {
    routeKeys: ["help-pump"],
    routeHeadline: "Fix the leaking pump in Morrow Yard before it spreads.",
    notebookPlanFallback:
      "Handle the Morrow Yard pump before the house has to absorb it without Rowan.",
    currentOpeningMoveReasons: [
      {
        priority: 20,
        reason: ({ targetLocationName }, { world }) => {
          const hasWrench = hasItem(world, "item-wrench");
          const pump = problemById(world, "problem-pump");
          const target = targetLocationName ?? "Morrow Yard";

          if (hasWrench) {
            return `${target} is where Rowan can put the wrench to the live pump before the house has to absorb the strain.`;
          }

          if (pump?.discovered) {
            return `${target} is where Rowan can check the live pump pressure before it becomes house strain.`;
          }

          return `${target} is where the house problem needs eyes before Rowan commits the recovered hour elsewhere.`;
        },
        when: ({ targetLocationId }, { world }) => {
          const pump = problemById(world, "problem-pump");
          return Boolean(
            targetLocationId &&
              pump?.locationId === targetLocationId &&
              pump.status === "active",
          );
        },
      },
    ],
    problemRouteDialogue: [
      {
        choiceKey: "jo-tool-owned",
        followupChoiceKey: "jo-tool-followup",
        followupThoughts: [
          "That wrench has another morning in it.",
          "The price is fair.",
          "Old metal, new hands.",
        ],
        kind: "joToolOwned",
        npcId: "npc-jo",
        replyLines: [
          "You've already got the wrench. Good. Go slow and do not force the old metal.",
          "You have the wrench. Try the fitting gently first, then tighten only what moves cleanly.",
          "The wrench is the easy part. Take your time with the pump.",
        ],
      },
      {
        choiceKey: "jo-tool-sell",
        followupChoiceKey: "jo-tool-followup",
        followupThoughts: [
          "That wrench has another morning in it.",
          "The price is fair.",
          "Old metal, new hands.",
        ],
        kind: "joToolSell",
        npcId: "npc-jo",
        replyLines: [
          "Old wrench, eight coins. It is ugly, but it works.",
          "Eight coins for the wrench. It has handled worse than that pump.",
          "Eight coins gets you the wrench I would use myself.",
        ],
      },
    ],
  },
  {
    routeKeys: ["help-cart"],
    routeHeadline: "Clear the jammed cart before it snarls the square.",
    problemRouteDialogue: [
      {
        choiceKey: "nia-cart-solved",
        followupChoiceKey: "nia-cart-followup",
        followupThoughts: [
          "That cart needs moving before lunch.",
          "The square wants an easier day.",
          "Small jams get loud fast.",
        ],
        kind: "niaCartSolved",
        npcId: "npc-nia",
        replyLines: [
          "Square's clear again. Nicely done before everyone had to complain about it.",
          "That jam's gone. Good. The square feels lighter already.",
          "The square loosened up. Small fix, big difference.",
        ],
      },
      {
        choiceKey: "nia-cart-active",
        followupChoiceKey: "nia-cart-followup",
        followupThoughts: [
          "That cart needs moving before lunch.",
          "The square wants an easier day.",
          "Small jams get loud fast.",
        ],
        kind: "niaCartActive",
        npcId: "npc-nia",
        replyLines: [
          "That split-wheel cart will jam Quay Square once foot traffic picks up. Move it early and everyone has an easier day.",
          "That cart will block the square if nobody moves it before the lunch crowd drifts in.",
          "Move the cart while it is still a small problem.",
        ],
      },
    ],
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
    notebookPlanFallback:
      "Ask Tomas before the North Crane Yard freight window closes.",
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
    currentOpeningMoveReasons: [
      {
        priority: 10,
        reason: ({ targetLocationName }, { world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          const target = targetLocationName ?? "North Crane Yard";
          const endMinutes = yardJob
            ? totalMinutesForDayHour(world.clock.day, yardJob.endHour)
            : 0;
          const windowText =
            endMinutes > world.clock.totalMinutes
              ? ` before ${formatClockAt(world, endMinutes)}`
              : "";
          return `${target} is where Rowan can check the paid yard work window${windowText} with his recovered energy.`;
        },
        when: ({ targetLocationId }, { world }) => {
          const yardJob = jobById(world, "job-yard-shift");
          return Boolean(
            targetLocationId &&
              yardJob?.locationId === targetLocationId &&
              yardJob.discovered &&
              !yardJob.completed &&
              !yardJob.missed,
          );
        },
      },
    ],
  },
  {
    routeKeys: ["rest-home"],
    routeHeadline: "Recover enough at Morrow House to move cleanly again.",
    notebookRecoveryPlanKind: "post-afternoon",
    moveIntents: [
      {
        label: "Return to Morrow House to recover",
        locationId: ({ world }) => world.player.homeLocationId,
        rationale:
          "Morrow House is where Rowan can recover enough to move cleanly, keep tonight's room safe, and choose the next live opening with a clear head.",
      },
    ],
    homeReturnMoveReasons: [
      {
        priority: 30,
        reason: ({ homeName }, { world }) =>
          world.firstAfternoon?.completedAt
            ? `${homeName} is where Rowan can recover enough to move cleanly, keep tonight's room safe, and let Ada's field-note standing land before choosing the yard work, pump, or another current opening.`
            : `${homeName} is where Rowan can recover enough to move cleanly before taking another commitment.`,
        when: (input, context) => recoveryHomeReturnReasonApplies(input, context),
      },
    ],
  },
  {
    routeKeys: [],
    routeKeyPrefixes: ["commitment-"],
    routeHeadline: "Follow through on accepted work before the window closes.",
    semanticHints: [{ locationId: commitmentRouteJobLocationId }],
  },
];

export function objectiveRouteSemanticHints(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
) {
  const locationIds = new Set<string>();
  const npcIds = new Set<string>();
  const context = { objective, world };

  for (const scaffold of activeScaffolds(objective)) {
    for (const hint of scaffold.semanticHints ?? []) {
      if (hint.when && !hint.when(context)) {
        continue;
      }

      const locationId = resolveScaffoldString(hint.locationId, context);
      if (locationId) {
        locationIds.add(locationId);
      }
      const npcId = resolveScaffoldString(hint.npcId, context);
      if (npcId) {
        npcIds.add(npcId);
      }
    }
  }

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

export function objectiveRouteCompletionIdleCopy(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const completionIdleCopy = scaffold.completionIdleCopy;
    if (
      completionIdleCopy &&
      (!completionIdleCopy.when || completionIdleCopy.when(context))
    ) {
      return {
        detail: completionIdleCopy.detail,
        label: completionIdleCopy.label,
      };
    }
  }

  return undefined;
}

export function objectiveRouteCompletionRationale(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const completionRationale = scaffold.completionRationale;
    if (
      completionRationale &&
      (!completionRationale.when || completionRationale.when(context))
    ) {
      return completionRationale.rationale;
    }
  }

  return undefined;
}

export function objectiveRouteCompletionSummaryTail(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
) {
  if (!objective) {
    return undefined;
  }

  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const completionSummaryTail = scaffold.completionSummaryTail;
    if (
      completionSummaryTail &&
      (!completionSummaryTail.when || completionSummaryTail.when(context))
    ) {
      return completionSummaryTail.text;
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

function firstAfternoonScaffoldCopy(): FirstAfternoonScaffoldCopy {
  for (const scaffold of activeScaffolds("first-afternoon")) {
    if (scaffold.firstAfternoon) {
      return scaffold.firstAfternoon;
    }
  }

  throw new Error("First-afternoon copy scaffold is missing.");
}

export function objectiveRouteFirstAfternoonPlanSettlementCopy(): FirstAfternoonPlanChoiceCopy {
  return firstAfternoonScaffoldCopy().planSettlement;
}

export function objectiveRouteFirstAfternoonPumpChoiceCopy(): FirstAfternoonObjectiveChoiceCopy {
  return firstAfternoonScaffoldCopy().pumpChoice;
}

export function objectiveRouteFirstAfternoonCompareChoiceCopy(): FirstAfternoonObjectiveChoiceCopy {
  return firstAfternoonScaffoldCopy().compareChoice;
}

export function objectiveRouteFirstAfternoonCompletionCopy(): FirstAfternoonCompletionCopy {
  return firstAfternoonScaffoldCopy().completion;
}

export function objectiveRouteFirstAfternoonCompletionFieldNote(
  input: FirstAfternoonFieldNoteInput,
): FirstAfternoonFieldNoteCopy {
  return firstAfternoonScaffoldCopy().completionFieldNote(input);
}

export function objectiveRouteFirstAfternoonLeadFieldNote(
  input: FirstAfternoonLeadFieldNoteInput,
): FirstAfternoonLeadFieldNoteCopy {
  return firstAfternoonScaffoldCopy().leadFieldNote(input);
}

export function objectiveRouteNotebookBeliefs(
  input: ObjectiveRouteNotebookBeliefCatalogInput,
): ObjectiveRouteNotebookBelief[] {
  return OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_TEMPLATES.filter((template) =>
    template.when(input),
  ).map((template) => ({
    id: template.id,
    topic: template.topic,
    text: resolveObjectiveRouteNotebookBeliefText(template.text, input),
    confidence: template.confidence(input),
    source: resolveObjectiveRouteNotebookBeliefText(template.source, input),
    npcId: template.npcId,
    locationId: template.locationId,
  }));
}

export function objectiveRouteNotebookBeliefMatchesObjective(
  input: ObjectiveRouteNotebookBeliefObjectiveMatchInput,
) {
  const objectiveText = input.objectiveText.toLowerCase();
  if (!objectiveText) {
    return false;
  }

  switch (input.beliefTopic) {
    case "help":
      if (input.beliefId === "belief-first-afternoon-field-note") {
        return /\bfirst afternoon\b|\bfield note\b|\brest\b|\brecover\b|\btake stock\b/.test(
          objectiveText,
        );
      }
      if (input.beliefId === "belief-pump-standing") {
        return /\bpump\b|\bleak\b|\bfix\b/.test(objectiveText);
      }
      return /\bblock\b|\bjam\b|\bcart\b|\bsquare\b|\bpump\b|\bfix\b|\bhelp\b/.test(
        objectiveText,
      );
    case "work":
      if (
        /\btomas\b|\byard\b|\bfreight\b|\bnorth crane\b/.test(objectiveText)
      ) {
        return input.beliefId === "belief-tomas-work";
      }
      if (
        /\bada\b|\bkettle\b|\bcafe\b|\btea\b|\bcup-and-counter\b/.test(
          objectiveText,
        )
      ) {
        return input.beliefId === "belief-ada-work";
      }
      return /\bwork\b|\bjob\b|\bshift\b|\bpay\b|\bincome\b/.test(
        objectiveText,
      );
    case "shelter":
      return /\broom\b|\bbed\b|\bstay\b|\bhouse\b|\bshelter\b/.test(
        objectiveText,
      );
    case "tool":
      return /\bwrench\b|\btool\b|\brepair\b/.test(objectiveText);
    case "belonging":
      return /\bperson\b|\bpeople\b|\bfriend\b|\btrust\b|\bknown\b/.test(
        objectiveText,
      );
    default:
      return false;
  }
}

export function objectiveRouteNotebookBeliefScoreAdjustment(
  input: ObjectiveRouteNotebookBeliefScoreAdjustmentInput,
) {
  return OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_RANKING_POLICIES.reduce(
    (scoreAdjustment, policy) =>
      policy.when(input)
        ? scoreAdjustment + policy.scoreAdjustment
        : scoreAdjustment,
    0,
  );
}

export function objectiveRouteNotebookBeliefClue(input: {
  beliefId?: string;
  hasWrench?: boolean;
}) {
  const copy = input.beliefId
    ? OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_NARRATIVES[input.beliefId]
    : undefined;
  if (!copy) {
    return undefined;
  }

  return input.hasWrench && copy.clueWithTool
    ? copy.clueWithTool
    : copy.clue;
}

export function objectiveRouteNotebookBeliefConfidence(input: {
  beliefId?: string;
  hasWrench?: boolean;
}) {
  const copy = input.beliefId
    ? OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_NARRATIVES[input.beliefId]
    : undefined;
  if (!copy) {
    return undefined;
  }

  return input.hasWrench && copy.confidenceWithTool
    ? copy.confidenceWithTool
    : copy.confidence;
}

export function objectiveRouteNotebookBeliefUncertainty(beliefId?: string) {
  return beliefId
    ? OBJECTIVE_ROUTE_NOTEBOOK_BELIEF_NARRATIVES[beliefId]?.uncertainty
    : undefined;
}

export function objectiveRouteNotebookPlanFallback(routeKey?: string) {
  if (!routeKey) {
    return undefined;
  }

  for (const scaffold of activeScaffolds(routeKey)) {
    if (scaffold.notebookPlanFallback) {
      return scaffold.notebookPlanFallback;
    }
  }

  return undefined;
}

export function objectiveRouteNotebookRecoveryPlanKind(input: {
  actionId?: string;
  objective?: ObjectiveScaffoldDirective;
  world: StreetGameState;
}): ObjectiveRouteNotebookRecoveryPlanKind | undefined {
  const objective =
    input.objective ?? objectiveScaffoldDirectiveForWorld(input.world);

  for (const scaffold of activeScaffolds(objective.routeKey)) {
    if (scaffold.notebookRecoveryPlanKind) {
      return scaffold.notebookRecoveryPlanKind;
    }
  }

  if (objective.focus === "rest" || input.actionId === "rest:home") {
    return "post-afternoon";
  }

  return undefined;
}

export function objectiveRouteNotebookUsesRecoveryRestNeed(input: {
  actionId?: string;
  objective?: ObjectiveScaffoldDirective;
  world: StreetGameState;
}) {
  if (
    !input.world.firstAfternoon?.completedAt ||
    input.actionId !== "enter:boarding-house"
  ) {
    return false;
  }

  const objective =
    input.objective ?? objectiveScaffoldDirectiveForWorld(input.world);
  return activeScaffolds(objective.routeKey).some(
    (scaffold) => scaffold.notebookRecoveryPlanKind === "post-afternoon",
  );
}

export function objectiveRouteNotebookRecoveryPlan(
  kind: ObjectiveRouteNotebookRecoveryPlanKind,
) {
  return OBJECTIVE_ROUTE_NOTEBOOK_RECOVERY_PLANS[kind];
}

export function objectiveRouteNotebookStaleEntryFallback() {
  return OBJECTIVE_ROUTE_NOTEBOOK_STALE_ENTRY_FALLBACK;
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

export function objectiveRouteScaffoldRetainedRouteKey(
  world: StreetGameState,
  previous: PlayerObjective,
) {
  return objectiveRouteSelectionPolicies().find((policy) =>
    policy.retainPrevious?.({ previous, world }),
  )?.routeKey;
}

export function objectiveRouteScaffoldAbsorbsConversationFocus(
  routeKey: string | undefined,
  focus: ObjectiveFocus,
) {
  return Boolean(
    routeKey &&
      objectiveRouteSelectionPolicyForRouteKey(
        routeKey,
      )?.absorbConversationFocuses?.includes(focus),
  );
}

export function objectiveRouteScaffoldRouteKeyForObjectiveText(input: {
  previous?: PlayerObjective;
  source: ObjectiveSource;
  text: string;
}) {
  const normalizedText = input.text.toLowerCase();
  return objectiveRouteSelectionPolicies().find((policy) =>
    policy.matchesObjectiveText?.({
      ...input,
      normalizedText,
    }),
  )?.routeKey;
}

export function objectiveRouteScaffoldRouteForRouteKey(input: {
  routeKey: string | undefined;
  source: ObjectiveSource;
  world: StreetGameState;
}): ObjectiveRouteScaffoldRoute | undefined {
  switch (input.routeKey) {
    case "mara-ada-lead":
      return buildMaraAdaLeadRoute(input.world, input.source);
    case "first-afternoon":
      return buildFirstAfternoonRoute(input.world, input.source);
    default:
      return undefined;
  }
}

function buildMaraAdaLeadRoute(
  world: StreetGameState,
  source: ObjectiveSource,
): ObjectiveRouteScaffoldRoute {
  const home = findLocation(world, world.player.homeLocationId);
  const teaJob = jobById(world, "job-tea-shift");
  const teaLeadViable = firstAfternoonRouteAdaLeadViable(world, teaJob);
  const hasTalkedToMara =
    countPlayerConversationsWithNpc(world, "npc-mara") > 0;
  const hasSettledPlan = Boolean(world.firstAfternoon?.planSettledAt);
  const hasFormedVerificationIntent = hasSettledPlan || source !== "seed";
  const hasTalkedToAda = countPlayerConversationsWithNpc(world, "npc-ada") > 0;
  const hasLeadFieldNote = Boolean(world.firstAfternoon?.leadFieldNote);
  const hasOpenWorkChoice = Boolean(
    hasLeadFieldNote && teaJob?.discovered && teaLeadViable,
  );
  const hasReachedTeaHouse =
    world.player.currentLocationId === "tea-house" ||
    hasTalkedToAda ||
    hasLeadFieldNote;
  const scaffold = objectiveRouteMaraAdaLeadRouteScaffold({
    hasFormedVerificationIntent,
    hasLeadFieldNote,
    hasLeadViable: teaLeadViable,
    hasOpenWorkChoice,
    hasReachedTeaHouse,
    hasTalkedToAda,
    hasTalkedToMara,
    homeLocationId: home?.id,
  });

  return {
    key: "mara-ada-lead",
    focus: "work",
    source,
    terminal: true,
    outcomes: scaffold.outcomes,
    steps: scaffold.steps,
  };
}

function buildFirstAfternoonRoute(
  world: StreetGameState,
  source: ObjectiveSource,
): ObjectiveRouteScaffoldRoute {
  const home = findLocation(world, world.player.homeLocationId);
  const hasTalkedToMara =
    countPlayerConversationsWithNpc(world, "npc-mara") > 0;
  const approaches = firstAfternoonLiveApproaches(world);
  const approachesKnown =
    Boolean(world.firstAfternoon?.approachesKnownAt) || approaches.length >= 2;
  const consequence = firstAfternoonConsequence(world);
  const hasRoomTerms = firstAfternoonRoomTermsKnown(world);
  const atHome = world.player.currentLocationId === world.player.homeLocationId;
  const wrappedFirstAfternoon = Boolean(world.firstAfternoon?.completedAt);
  const routeScaffold = objectiveRouteFirstAfternoonRouteScaffold({
    atHome,
    approachCount: approachesKnown ? Math.max(2, approaches.length) : approaches.length,
    approachesKnown,
    consequenceAchieved: Boolean(consequence),
    consequenceLabel: consequence?.label,
    hasRoomTerms,
    hasTalkedToMara,
    homeLocationId: home?.id,
    wrappedFirstAfternoon,
  });

  return {
    key: "first-afternoon",
    focus: "settle",
    source,
    terminal: true,
    outcomes: routeScaffold.outcomes,
    steps: routeScaffold.steps.map(makeObjectiveRouteStep),
  };
}

function firstAfternoonLiveApproaches(world: StreetGameState) {
  const approaches: string[] = [];
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const pump = problemById(world, "problem-pump");
  const cart = problemById(world, "problem-cart");

  if (teaJob?.discovered && jobWindowOpen(world, teaJob)) {
    approaches.push(teaJob.id);
  }
  if (yardJob?.discovered && jobWindowOpen(world, yardJob)) {
    approaches.push(yardJob.id);
  }
  if (pump?.discovered && pump.status === "active") {
    approaches.push(pump.id);
  }
  if (cart?.discovered && cart.status === "active") {
    approaches.push(cart.id);
  }

  return approaches;
}

function firstAfternoonConsequence(world: StreetGameState) {
  const teaJob = jobById(world, "job-tea-shift");
  if (teaJob?.completed) {
    return {
      evidence: `${teaJob.title} completed for $${teaJob.pay}.`,
      id: teaJob.id,
      label: "Kettle & Lamp work completed",
    };
  }

  const yardJob = jobById(world, "job-yard-shift");
  if (yardJob?.completed) {
    return {
      evidence: `${yardJob.title} completed for $${yardJob.pay}.`,
      id: yardJob.id,
      label: "North Crane Yard work completed",
    };
  }

  const solvedProblem = world.problems.find(
    (problem) => problem.discovered && problem.status === "solved",
  );
  return solvedProblem
    ? {
        evidence: `${solvedProblem.title} solved after Rowan grounded the local problem.`,
        id: solvedProblem.id,
        label: `${solvedProblem.title} solved`,
      }
    : undefined;
}

function firstAfternoonRouteAdaLeadViable(
  world: StreetGameState,
  teaJob = jobById(world, "job-tea-shift"),
) {
  return firstAfternoonOutcomeAdaLeadViable(world, teaJob);
}

function makeObjectiveRouteStep(step: ObjectiveTrailItem): ObjectiveTrailItem {
  return step;
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

export function objectiveRouteProblemToolOutcomeEvaluation(
  outcomeId: string,
  state: {
    cartProblem: HelpProblemRouteState;
    pumpProblem: HelpProblemRouteState;
    toolProblem: ToolProblemRouteState;
  },
): ObjectiveRouteOutcomeEvaluation | undefined {
  return (
    evaluateHelpProblemRouteOutcome(
      CART_PROBLEM_OUTCOME_EVALUATION_TEMPLATES,
      outcomeId,
      state.cartProblem,
    ) ??
    evaluateHelpProblemRouteOutcome(
      PUMP_PROBLEM_OUTCOME_EVALUATION_TEMPLATES,
      outcomeId,
      state.pumpProblem,
    ) ??
    evaluateToolProblemRouteOutcome(
      TOOL_PROBLEM_OUTCOME_EVALUATION_TEMPLATES,
      outcomeId,
      state.toolProblem,
    )
  );
}

export function objectiveRouteScaffoldOutcomeEvaluation(input: {
  outcomeId: string;
  routeKey: string;
  world: StreetGameState;
}): ObjectiveRouteOutcomeEvaluation | undefined {
  const { outcomeId, routeKey, world } = input;
  const teaJob = jobById(world, "job-tea-shift");
  const teaLeadViable = firstAfternoonOutcomeAdaLeadViable(world, teaJob);
  const atHome = world.player.currentLocationId === world.player.homeLocationId;

  switch (outcomeId) {
    case "mara-ada-hear-lead":
    case "first-afternoon-room":
      return objectiveRouteOutcomeEvaluation(firstAfternoonRoomTermsKnown(world), {
        evidence:
          "Mara has explained what tonight's room and first lead require.",
      });
    case "mara-ada-form-intent":
      return objectiveRouteOutcomeEvaluation(routeKey === "mara-ada-lead", {
        blockers: ["Rowan has not made the verification intent explicit yet."],
        evidence:
          routeKey === "mara-ada-lead"
            ? "The current objective is explicitly to verify Mara's Ada lead."
            : undefined,
      });
    case "first-afternoon-approaches": {
      const approaches = firstAfternoonLiveApproaches(world);
      const approachesKnown =
        Boolean(world.firstAfternoon?.approachesKnownAt) ||
        approaches.length >= 2;
      return objectiveRouteOutcomeEvaluation(
        approachesKnown,
        {
          blockers: ["Rowan does not yet know two materially live approaches."],
          evidence:
            approaches.length > 0
              ? approachesKnown && approaches.length < 2
                ? `Multiple approaches were grounded before Rowan committed; ${approaches.join(", ")} remains live now.`
                : `${approaches.length} live approach${approaches.length === 1 ? "" : "es"}: ${approaches.join(", ")}.`
              : approachesKnown
                ? "Multiple approaches were grounded before Rowan committed to the consequence."
              : undefined,
        },
      );
    }
    case "first-afternoon-consequence": {
      const consequence = firstAfternoonConsequence(world);
      return objectiveRouteOutcomeEvaluation(Boolean(consequence), {
        blockers: [
          "Rowan has not yet completed live tea work, yard work, or a grounded local problem.",
        ],
        evidence: consequence?.evidence,
      });
    }
    case "mara-ada-walk-route":
      return objectiveRouteOutcomeEvaluation(
        world.player.currentLocationId === "tea-house" ||
          countPlayerConversationsWithNpc(world, "npc-ada") > 0 ||
          Boolean(world.firstAfternoon?.leadFieldNote),
        { evidence: world.player.currentLocationId },
      );
    case "mara-ada-ask-directly":
    case "first-afternoon-ada-lead":
      return objectiveRouteOutcomeEvaluation(
        countPlayerConversationsWithNpc(world, "npc-ada") > 0 ||
          Boolean(teaJob?.accepted || teaJob?.completed),
        {
          blockers: [
            teaLeadViable
              ? "Ada has not confirmed the Kettle & Lamp lead yet."
              : "Ada's lunch work is no longer a live lead.",
          ],
          evidence: teaJob?.discovered
            ? "Kettle & Lamp work is discovered."
            : undefined,
        },
      );
    case "mara-ada-record-evidence":
    case "first-afternoon-record-lead":
      return objectiveRouteOutcomeEvaluation(
        Boolean(world.firstAfternoon?.leadFieldNote),
        {
          blockers: ["The lead has not been recorded as grounded evidence."],
          evidence: world.firstAfternoon?.leadFieldNote?.evidence,
        },
      );
    case "mara-ada-open-choice":
      return objectiveRouteOutcomeEvaluation(
        Boolean(
          world.firstAfternoon?.leadFieldNote &&
            teaJob?.discovered &&
            teaLeadViable,
        ),
        {
          blockers: ["The lead has not opened a legal work choice yet."],
          evidence: teaJob?.discovered
            ? "Cup-and-counter shift is available."
            : undefined,
        },
      );
    case "first-afternoon-take-shift":
      return objectiveRouteOutcomeEvaluation(
        Boolean(
          teaJob?.accepted ||
            teaJob?.completed ||
            world.player.activeJobId === "job-tea-shift",
        ),
        {
          blockers: teaJob?.missed
            ? ["The cup-and-counter shift window has slipped."]
            : ["Rowan has not committed to the cup-and-counter shift."],
          evidence: teaJob?.accepted ? "Shift accepted." : undefined,
          failed: Boolean(teaJob?.missed && !teaJob.completed),
        },
      );
    case "first-afternoon-start-shift":
      return objectiveRouteOutcomeEvaluation(
        Boolean(
          world.firstAfternoon?.teaShiftStage === "rush" ||
            world.firstAfternoon?.teaShiftStage === "counter" ||
            world.firstAfternoon?.teaShiftStage === "paid" ||
            teaJob?.completed,
        ),
        {
          blockers: ["The lunch rush has not started for Rowan yet."],
          evidence: world.firstAfternoon?.teaShiftStage,
        },
      );
    case "first-afternoon-finish-shift":
      return objectiveRouteOutcomeEvaluation(Boolean(teaJob?.completed), {
        blockers: teaJob?.missed
          ? ["The cup-and-counter shift was missed."]
          : ["The cup-and-counter shift is not finished yet."],
        evidence: teaJob?.completed
          ? "Ada paid Rowan for the shift."
          : undefined,
        failed: Boolean(teaJob?.missed && !teaJob.completed),
      });
    case "first-afternoon-take-stock":
      return objectiveRouteOutcomeEvaluation(
        Boolean(world.firstAfternoon?.completedAt),
        {
          blockers: atHome
            ? ["Rowan has not taken stock yet."]
            : ["Rowan is not back at Morrow House yet."],
          evidence: world.firstAfternoon?.fieldNote?.evidence,
        },
      );
    default:
      return undefined;
  }
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

function evaluateHelpProblemRouteOutcome(
  templates: HelpProblemRouteOutcomeEvaluationTemplate[],
  outcomeId: string,
  state: HelpProblemRouteState,
) {
  return templates
    .find((template) => template.ids.includes(outcomeId))
    ?.evaluate(state);
}

function evaluateToolProblemRouteOutcome(
  templates: ToolProblemRouteOutcomeEvaluationTemplate[],
  outcomeId: string,
  state: ToolProblemRouteState,
) {
  return templates
    .find((template) => template.ids.includes(outcomeId))
    ?.evaluate(state);
}

function objectiveRouteOutcomeEvaluation(
  met: boolean,
  options: ObjectiveRouteOutcomeEvaluationOptions = {},
): ObjectiveRouteOutcomeEvaluation {
  if (met) {
    return {
      status: "met",
      evidence: options.evidence,
    };
  }

  if (options.failed) {
    return {
      status: "failed",
      blockers: options.blockers,
      evidence: options.evidence,
    };
  }

  return {
    status: options.blockers?.length ? "blocked" : "open",
    blockers: options.blockers,
    evidence: options.evidence,
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

function resolveObjectiveRouteNotebookBeliefText(
  value:
    | string
    | ((input: ObjectiveRouteNotebookBeliefCatalogInput) => string),
  input: ObjectiveRouteNotebookBeliefCatalogInput,
) {
  return typeof value === "function" ? value(input) : value;
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

function peopleRouteNpcId({ objective }: ScaffoldContext) {
  if (!objective.routeKey.startsWith("people-")) {
    return undefined;
  }

  const npcId = objective.routeKey.slice("people-".length);
  return npcId === "locals" ? undefined : npcId;
}

function peopleRouteNpcLocationId(context: ScaffoldContext) {
  const npcId = peopleRouteNpcId(context);
  return npcId ? npcById(context.world, npcId)?.currentLocationId : undefined;
}

function peopleRouteMoveRationale(context: MoveIntentContext) {
  const npcId = peopleRouteNpcId(context);
  const npc = npcId ? npcById(context.world, npcId) : undefined;
  const location = findLocation(context.world, context.locationId);

  return `Walk to ${location?.name ?? "the next place"} and make a real introduction with ${npc?.name ?? "them"}.`;
}

function exploreRouteSemanticLocationId({ objective }: ScaffoldContext) {
  if (!objective.routeKey.startsWith("explore-")) {
    return undefined;
  }

  const locationId = objective.routeKey.slice("explore-".length);
  return locationId === "district" ? undefined : locationId;
}

function exploreRouteMoveBonusLocationId({ objective }: ScaffoldContext) {
  return objective.routeKey.startsWith("explore-")
    ? objective.routeKey.slice("explore-".length)
    : undefined;
}

function commitmentRouteJobLocationId({ objective, world }: ScaffoldContext) {
  if (!objective.routeKey.startsWith("commitment-")) {
    return undefined;
  }

  return jobById(world, objective.routeKey.slice("commitment-".length))
    ?.locationId;
}

function problemRouteLocationId(problemId: string) {
  return ({ world }: ScaffoldContext) => problemById(world, problemId)?.locationId;
}

function objectiveTextMentionsTool(objective: ObjectiveScaffoldDirective) {
  return /\b(tool|wrench|jo|repair)\b/.test(objective.text.toLowerCase());
}

export function objectiveRouteMoveIntent(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
):
  | { actionId?: string; label?: string; npcId?: string; rationale: string }
  | undefined {
  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective)) {
    const intent = (scaffold.moveIntents ?? []).find(
      (candidate) =>
        resolveScaffoldString(candidate.locationId, context) === locationId &&
        (!candidate.when || candidate.when(context)),
    );
    if (intent) {
      const moveIntentContext = { ...context, locationId };
      return {
        actionId: intent.actionId,
        label: intent.label,
        npcId: resolveScaffoldString(intent.npcId, context),
        rationale: resolveMoveIntentRationale(
          intent.rationale,
          moveIntentContext,
        ),
      };
    }
  }

  return undefined;
}

function resolveScaffoldString(
  value: ScaffoldStringResolver | undefined,
  context: ScaffoldContext,
) {
  return typeof value === "function" ? value(context) : value;
}

function resolveMoveIntentRationale(
  rationale: MoveIntentHint["rationale"],
  context: MoveIntentContext,
) {
  return typeof rationale === "function" ? rationale(context) : rationale;
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

export function objectiveRouteHomeReturnReason(input: {
  rationale?: string;
  targetLocationId?: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const { targetLocationId, targetLocationName, world } = input;
  if (!targetLocationId || targetLocationId !== world.player.homeLocationId) {
    return undefined;
  }

  const context = {
    objective: objectiveScaffoldDirectiveForWorld(world),
    world,
  };
  const reasonInput = {
    rationale: input.rationale,
    targetLocationId,
    targetLocationName,
    homeName: targetLocationName ?? "Morrow House",
  };
  const candidates = OBJECTIVE_ROUTE_SCAFFOLDS.flatMap((scaffold) =>
    scaffold.homeReturnMoveReasons ?? [],
  ).sort((left, right) => {
    return (right.priority ?? 0) - (left.priority ?? 0);
  });

  for (const hint of candidates) {
    if (!hint.when(reasonInput, context)) {
      continue;
    }

    return typeof hint.reason === "function"
      ? hint.reason(reasonInput, context)
      : hint.reason;
  }

  return undefined;
}

export function objectiveRouteCurrentOpeningMoveReason(input: {
  targetLocationId?: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const { targetLocationId, targetLocationName, world } = input;
  if (!targetLocationId) {
    return undefined;
  }

  const context = {
    objective: objectiveScaffoldDirectiveForWorld(world),
    world,
  };
  const reasonInput = {
    targetLocationId,
    targetLocationName,
  };
  const candidates = OBJECTIVE_ROUTE_SCAFFOLDS.flatMap((scaffold) =>
    scaffold.currentOpeningMoveReasons ?? [],
  ).sort((left, right) => {
    return (right.priority ?? 0) - (left.priority ?? 0);
  });

  for (const hint of candidates) {
    if (!hint.when(reasonInput, context)) {
      continue;
    }

    return typeof hint.reason === "function"
      ? hint.reason(reasonInput, context)
      : hint.reason;
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

function normalizeWorkStageWatchCopyStage(
  stage: WorkStageStage | undefined,
): WorkStageWatchCopyStage {
  if (stage === "rush" || stage === "counter") {
    return stage;
  }

  return "ready";
}

function findWorkStageWatchCopy(
  scaffolds: ObjectiveRouteScaffold[],
  context: ScaffoldContext | undefined,
  input: { jobId: string; stage: WorkStageWatchCopyStage },
): WorkStageWatchCopy | undefined {
  for (const scaffold of scaffolds) {
    const copy = (scaffold.workStageWatchCopy ?? []).find((candidate) => {
      if (candidate.jobId !== input.jobId || candidate.stage !== input.stage) {
        return false;
      }

      if (
        context &&
        candidate.routeKeys &&
        !candidate.routeKeys.includes(context.objective.routeKey)
      ) {
        return false;
      }

      return !candidate.when || (context && candidate.when(context));
    });
    if (copy) {
      return {
        detail: copy.detail,
        label: copy.label,
      };
    }
  }

  return undefined;
}

export function objectiveRouteWorkStageWatchCopy(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  input: {
    jobId: string;
    stage: WorkStageStage | undefined;
  },
): WorkStageWatchCopy | undefined {
  const stage = normalizeWorkStageWatchCopyStage(input.stage);
  const context = objective ? { objective, world } : undefined;

  return (
    (objective
      ? findWorkStageWatchCopy(activeScaffolds(objective.routeKey), context, {
          jobId: input.jobId,
          stage,
        })
      : undefined) ??
    findWorkStageWatchCopy(OBJECTIVE_ROUTE_SCAFFOLDS, undefined, {
      jobId: input.jobId,
      stage,
    })
  );
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

export function objectiveRouteProblemDialogue(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
  kind: ObjectiveRouteProblemDialogueKind,
): ObjectiveRouteDialogueReplyVariant | undefined {
  const scaffoldObjective = objective ?? objectiveScaffoldDirectiveForWorld(world);
  const context: ScaffoldContext = { objective: scaffoldObjective, world };

  for (const scaffold of OBJECTIVE_ROUTE_SCAFFOLDS) {
    const reply = (scaffold.problemRouteDialogue ?? []).find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.npcId === npc.id &&
        (!candidate.when || candidate.when(context)),
    );
    if (reply) {
      return reply;
    }
  }

  return undefined;
}

export function objectiveRouteJoMoneyWorkDialogue({
  nearbyPlaceName,
}: ObjectiveRouteJoMoneyWorkDialogueContext): ObjectiveRouteDialogueReplyVariant {
  return {
    choiceKey: "jo-money-work",
    followupChoiceKey: "jo-money-work-followup",
    followupThoughts: [
      "He can take his time.",
      "The wrench is simple enough.",
      "A calm decision is fine.",
    ],
    replyLines: [
      nearbyPlaceName
        ? `I sell repairs, not shifts. Around ${nearbyPlaceName}, a decent tool can still save your afternoon.`
        : "I sell repairs, not shifts. A decent tool can still save your afternoon.",
      "Paid work is elsewhere. If the pump is your problem, the wrench is the practical part.",
      "If the money is tight, spend it only when you know what it helps you fix.",
    ],
  };
}

export function objectiveRouteFirstAfternoonWorkWindowDialogue(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective | undefined,
  npc: NpcState,
  kind: FirstAfternoonWorkWindowDialogueKind,
): ObjectiveRouteDialogueReplyVariant | undefined {
  const scaffoldObjective: ObjectiveScaffoldDirective =
    objective ?? {
      focus: "work",
      routeKey: "first-afternoon",
      text: "Find paid work before the afternoon slips.",
    };
  const context: ScaffoldContext = { objective: scaffoldObjective, world };

  for (const scaffold of OBJECTIVE_ROUTE_SCAFFOLDS) {
    if (!scaffold.routeKeys.includes("first-afternoon")) {
      continue;
    }

    const reply = (scaffold.firstAfternoonWorkWindowDialogue ?? []).find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.npcId === npc.id &&
        candidate.when(context),
    );
    if (reply) {
      return reply;
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
          "Ada runs Kettle & Lamp hard before noon and may still need lunch hands. The Morrow Yard pump is leaking too, so paid work and useful local help are both live approaches; choose from what is actually available now.",
        followupThought:
          "Mara exposed Ada's work and the leaking pump without choosing Rowan's route for him.",
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
          "I can use help through lunch: clear cups, wipe tables, and keep the counter moving. It pays fourteen if you can stay steady.",
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
    planningText: input.planningText ?? objective.text,
    predicateAuthority: input.predicateAuthority,
    world,
  };

  return activeScaffolds(objective)
    .flatMap((scaffold) => scaffold.semanticMoveBonuses ?? [])
    .filter(
      (bonus) =>
        resolveScaffoldString(bonus.locationId, context) === locationId &&
        (!bonus.when || bonus.when(context)),
    )
    .reduce((total, bonus) => total + bonus.score, 0);
}

export function objectiveRouteActionPressureScore(
  objective: ObjectiveScaffoldDirective,
  input: RouteActionPressureInput,
) {
  const context = { objective };
  for (const scaffold of activeScaffolds(objective)) {
    for (const rule of scaffold.actionPressureRules ?? []) {
      if (!rule.when(input, context)) {
        continue;
      }

      return typeof rule.score === "function"
        ? rule.score(input, context)
        : rule.score;
    }
  }

  return 0;
}

export function objectiveDesiredOutcomeScoreAdjustment(
  outcomeId: string,
  input: ObjectiveDesiredOutcomeScoringInput,
) {
  if (!isObjectiveDesiredOutcomeScorePolicyId(outcomeId)) {
    return 0;
  }

  return OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICIES[outcomeId](input);
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

export function objectiveRouteAutonomousOpeningSpeech(
  input: ObjectiveAutonomousOpeningInput,
): string {
  const context: AutonomousOpeningContext = {
    objectiveClause: input.objectiveClause,
    objectiveFocus: input.objectiveFocus,
    objectiveText: input.objectiveText,
    primaryNeed: input.primaryNeed,
    teaLeadKnown: input.teaLeadKnown,
    yardLeadKnown: input.yardLeadKnown,
  };

  const rule = AUTONOMOUS_OPENING_SPEECH_RULES.find(
    (candidate) =>
      (!candidate.focus || candidate.focus === input.objectiveFocus) &&
      (!candidate.npcId || candidate.npcId === input.npcId) &&
      (!candidate.when || candidate.when(context)),
  );
  if (!rule) {
    return `I'm trying to ${input.objectiveClause}. Where is the easiest place to start?`;
  }

  return typeof rule.speech === "function"
    ? rule.speech(context)
    : rule.speech;
}

export function objectiveRouteAutonomousFollowupSpeech(
  input: ObjectiveAutonomousFollowupInput,
) {
  const context: AutonomousFollowupContext = {
    objectiveFocus: input.objectiveFocus,
    objectiveText: input.objectiveText,
    primaryNeed: input.primaryNeed,
    replyNamesAdaLead: input.replyNamesAdaLead,
    replyNamesTomasLead: input.replyNamesTomasLead,
    replyText: input.replyText,
    replyTopics: input.replyTopics,
  };

  const rule = AUTONOMOUS_FOLLOWUP_RULES.find(
    (candidate) =>
      candidate.focus === input.objectiveFocus &&
      (!candidate.npcId || candidate.npcId === input.npcId) &&
      (!candidate.when || candidate.when(context)),
  );
  if (!rule) {
    return undefined;
  }

  return typeof rule.followup === "function"
    ? rule.followup(context)
    : rule.followup;
}

export function objectiveRouteAutonomousContinuationFallbackSpeech(
  input: ObjectiveAutonomousContinuationFallbackInput,
): string {
  const rule =
    AUTONOMOUS_CONTINUATION_FALLBACK_RULES.find(
      (candidate) => candidate.focus === input.objectiveFocus,
    ) ??
    AUTONOMOUS_CONTINUATION_FALLBACK_RULES.find(
      (candidate) => candidate.focus === "custom",
    );
  if (!rule) {
    return "So where does that leave me right now?";
  }

  return typeof rule.speech === "function" ? rule.speech(input) : rule.speech;
}

function activeScaffolds(input: string | ObjectiveScaffoldDirective) {
  const objective = typeof input === "string" ? undefined : input;
  const routeKey = typeof input === "string" ? input : input.routeKey;

  return OBJECTIVE_ROUTE_SCAFFOLDS.filter(
    (scaffold) =>
      scaffold.routeKeys.includes(routeKey) ||
      (scaffold.routeKeyPrefixes ?? []).some((prefix) =>
        routeKey.startsWith(prefix),
      ) ||
      (objective &&
        Boolean(
          (scaffold.objectiveFocuses ?? []).includes(objective.focus) ||
            scaffold.objectiveMatches?.(objective),
        )),
  );
}

function objectiveRouteSelectionPolicies() {
  return OBJECTIVE_ROUTE_SCAFFOLDS.flatMap(
    (scaffold) => scaffold.objectiveStatePolicies ?? [],
  );
}

function objectiveRouteSelectionPolicyForRouteKey(routeKey: string) {
  return objectiveRouteSelectionPolicies().find(
    (policy) => policy.routeKey === routeKey,
  );
}

function textMatchesMaraAdaLeadObjective(text: string) {
  const normalized = text.toLowerCase();
  const pointsToMaraLead =
    /\bmara\b/.test(normalized) &&
    /\blead\b|\bverify\b|\bgrounded knowledge\b|\bgrounded\b/.test(
      normalized,
    );
  const pointsToAdaWork =
    /\bada\b|\bkettle & lamp\b|\btea[- ]house\b/.test(normalized) &&
    /\bwork\b|\blunch\b|\bshift\b|\bhands?\b|\bask\b/.test(normalized);
  const asksForFieldNote =
    /\brecord\b|\bfield note\b|\bwhat rowan learns\b|\bevidence\b/.test(
      normalized,
    );

  return pointsToAdaWork && (pointsToMaraLead || asksForFieldNote);
}

function normalizeObjectiveRouteTextForPolicy(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"+|"+$/g, "");
  const maxChars = 140;
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const withinLimit = cleaned.slice(0, maxChars).trimEnd();
  const lastSpace = withinLimit.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(maxChars * 0.7)
      ? withinLimit.slice(0, lastSpace)
      : withinLimit;
  return `${base.replace(/["'.,!?;:]+$/g, "").trimEnd()}...`;
}

function normalizePlayerFacingRationale(text: string) {
  return text.trim().replace(/[.?!]+$/g, "").toLowerCase();
}

function recoveryHomeReturnReasonApplies(
  input: HomeReturnMoveReasonInput,
  context: ScaffoldContext,
) {
  const objectiveText = context.objective.text.toLowerCase();
  const rationale = input.rationale ?? "";
  return (
    context.objective.routeKey === "rest-home" ||
    context.objective.focus === "rest" ||
    /\b(rest|recover|recovery|reset|tired|energy)\b/.test(objectiveText) ||
    /\b(rest|recover|recovery|reset|tired|energy)\b/i.test(rationale)
  );
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

function npcById(world: StreetGameState, npcId: string) {
  return world.npcs.find((entry) => entry.id === npcId);
}

function genericPlanningDesiredOutcomeApplies(
  policy: GenericPlanningDesiredOutcomePolicy,
  context: GenericPlanningDesiredOutcomeContext,
) {
  return Boolean(
    policy.focusMatches?.includes(context.objective.focus) ||
      policy.textMatches?.test(context.planningText) ||
      policy.when?.(context),
  );
}

function addGenericPlanningOutcome(
  outcomes: StreetPlanningObjectiveOutcome[],
  outcome: StreetPlanningObjectiveOutcome,
) {
  const existing = outcomes.find((candidate) => candidate.id === outcome.id);
  if (existing) {
    existing.priority = Math.max(existing.priority, outcome.priority);
    if (existing.status !== "at_risk") {
      existing.status = outcome.status;
    }
    existing.evidence ??= outcome.evidence;
    return;
  }

  outcomes.push(outcome);
}

function resolveGenericPlanningOutcomeValue<T extends string | number>(
  value: T | ((context: GenericPlanningDesiredOutcomeContext) => T),
  context: GenericPlanningDesiredOutcomeContext,
) {
  return typeof value === "function" ? value(context) : value;
}

function activeGenericPlanningJob(world: StreetGameState) {
  return world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
}

function mostRelevantGenericPlanningProblem(
  world: StreetGameState,
  planningText: string,
) {
  if (planningText.includes("cart")) {
    return problemById(world, "problem-cart");
  }

  if (planningText.includes("pump") || planningText.includes("wrench")) {
    return problemById(world, "problem-pump");
  }

  return world.problems
    .filter((problem) => problem.status === "active" || problem.discovered)
    .sort((left, right) => right.urgency - left.urgency)[0];
}

function isObjectiveDesiredOutcomeScorePolicyId(
  outcomeId: string,
): outcomeId is ObjectiveDesiredOutcomeScorePolicyId {
  return (OBJECTIVE_DESIRED_OUTCOME_SCORE_POLICY_IDS as readonly string[]).includes(
    outcomeId,
  );
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

function firstAfternoonOutcomeAdaLeadViable(
  world: StreetGameState,
  teaJob: JobState | undefined,
) {
  return Boolean(
    teaJob &&
      !teaJob.completed &&
      !teaJob.missed &&
      world.clock.hour + world.clock.minute / 60 < teaJob.endHour,
  );
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

function formatClockAt(world: StreetGameState, totalMinutes: number) {
  const dayStartMinutes = (world.clock.day - 1) * 24 * 60;
  const minuteOfDay = Math.max(0, totalMinutes - dayStartMinutes) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
      world.firstAfternoon?.approachesKnownAt ||
      world.firstAfternoon?.planSettledAt ||
      world.firstAfternoon?.leadFieldNote,
    )
  );
}
