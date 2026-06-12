import type {
  ActionKind,
  JobState,
  NpcState,
  ObjectiveFocus,
  ObjectiveTrailItem,
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
  locationId: string;
  npcId?: string;
  rationale: string;
  when?: (context: ScaffoldContext) => boolean;
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
  actionTargetLocations?: ActionTargetLocationHint[];
  availableActions?: AvailableActionHint[];
  completionAcknowledgement?: CompletionAcknowledgementHint;
  completionOutcome?: CompletionOutcomeCopy;
  conversationFallbacks?: ConversationFallbackHint[];
  conversationTopicSuppressions?: ConversationTopicSuppression[];
  conversationThoughts?: ConversationThoughtHint[];
  deterministicOpeningNpcIds?: string[];
  deterministicOpeningRouteKeys?: string[];
  moveIntents?: MoveIntentHint[];
  playerThoughts?: PlayerThoughtHint[];
  routeKeys: string[];
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
        locationId: "tea-house",
        npcId: "npc-ada",
        rationale:
          "Walk to Kettle & Lamp and ask Ada whether the lunch work is real.",
        when: ({ objective, world }) =>
          objective.routeKey === "mara-ada-lead" ||
          (objective.routeKey === "first-afternoon" &&
            Boolean(world.firstAfternoon?.planSettledAt) &&
            firstAfternoonAdaLeadViable(world) &&
            countPlayerConversationsWithNpc(world, "npc-ada") === 0),
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
    routeKeys: ["work-tea"],
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
          "Walk to Kettle & Lamp and ask Ada whether the lunch work is real.",
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
        locationId: "freight-yard",
        npcId: "npc-tomas",
        rationale:
          "Walk to the freight yard and ask Tomas what work is actually open.",
      },
    ],
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

function resolveFirstAfternoonRouteValue(
  value:
    | string
    | ((state: FirstAfternoonRouteState) => string | undefined)
    | undefined,
  state: FirstAfternoonRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

function resolveFirstAfternoonRouteText(
  value: string | ((state: FirstAfternoonRouteState) => string),
  state: FirstAfternoonRouteState,
) {
  return typeof value === "function" ? value(state) : value;
}

export function objectiveRouteMoveIntent(
  world: StreetGameState,
  objective: ObjectiveScaffoldDirective,
  locationId: string,
) {
  const context = { objective, world };
  for (const scaffold of activeScaffolds(objective.routeKey)) {
    const intent = (scaffold.moveIntents ?? []).find(
      (candidate) =>
        candidate.locationId === locationId &&
        (!candidate.when || candidate.when(context)),
    );
    if (intent) {
      return {
        actionId: intent.actionId,
        npcId: intent.npcId,
        rationale: intent.rationale,
      };
    }
  }

  return routeDerivedMoveIntent(world, objective, locationId);
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
  return OBJECTIVE_ROUTE_SCAFFOLDS.filter((scaffold) =>
    scaffold.routeKeys.includes(routeKey),
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
