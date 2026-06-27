import type {
  AIProvider,
  StreetPlanningAllowedAction,
  StreetPlanningObjectiveOutcome,
  StreetPlanningResult,
} from "../ai/provider.js";
import { buildDeterministicStreetThoughts } from "../ai/streetThoughts.js";
import { syncCityEvents } from "../street-sim/cityEvents.js";
import {
  activeProblemInspectNarrative,
  activeProblemSolveNarrative,
  independentProblemResolutionNarrative,
  problemEscalationStages,
  problemExpiryConsequenceNarrative,
} from "../street-sim/problemPressureNarratives.js";
import {
  activeJobCompletionNarrative,
  activeJobInterruptionNarrative,
  activeJobStageNarrative,
  independentNpcJobClosureNarrative,
  passiveMissedJobNarrative,
  yardWorkPumpConsequenceNarrative,
} from "../street-sim/jobNarratives.js";
import { seedStreetGame } from "../street-sim/seedGame.js";
import {
  buildGenericClosedWorkWindowConversationResolution,
  buildNpcConversationImpression,
  buildNpcConversationResolution,
  buildSocialNextNpcConversationResolution,
  getNpcFirstContactPrimer,
  getNpcNarrative,
  npcInnerStateNarrative,
} from "../street-sim/npcNarratives.js";
import {
  buildPlayerObjectiveState,
  classifyObjective,
} from "./objectiveState.js";
import { scoreNpcForObjectiveAffinity } from "./npcObjectiveAffinity.js";
import { scorePlanForDesiredOutcomes } from "./objectivePlanningScoring.js";
import {
  buildGenericStreetPlanningOutcomes,
  objectiveRouteActionRationale,
  objectiveRouteActionLocationReason,
  objectiveRouteAvailableActions,
  objectiveRouteAutonomousContinuationFallbackSpeech,
  objectiveRouteAutonomousFollowupSpeech,
  objectiveRouteAutonomousOpeningSpeech,
  objectiveRouteActionPressureScore,
  objectiveRouteActionTargetLocation,
  objectiveRouteCompletionAcknowledgement,
  objectiveRouteCompletionIdleCopy,
  objectiveRouteCompletionRationale,
  objectiveRouteCompletionSummaryTail,
  objectiveRouteConversationGroundingPolicy,
  objectiveRouteConversationHasVisibleEvidence,
  objectiveRouteConversationResolutionPointsToPolicy,
  objectiveRouteCurrentOpeningMoveReason,
  objectiveRouteFirstAfternoonCompareChoiceCopy,
  objectiveRouteFirstAfternoonCompletionCopy,
  objectiveRouteFirstAfternoonCompletionFieldNote,
  objectiveRouteFirstAfternoonCompletionOutcome,
  objectiveRouteFirstAfternoonLeadFieldNote,
  objectiveRouteFirstAfternoonPlanSettlementCopy,
  objectiveRouteFirstAfternoonPumpChoiceCopy,
  objectiveRouteConversationThought,
  objectiveRouteDeterministicOpening,
  objectiveRouteHasNiaBlockLead,
  objectiveRouteHomeReturnReason,
  objectiveRouteMoveIntent,
  objectiveRoutePlayerFacingAutonomyRationale,
  objectiveRouteMoveRationaleForOutcome,
  objectiveRouteSemanticHints,
  objectiveRouteSemanticMoveBonus,
  objectiveRouteSpeech,
  objectiveRouteScriptedReply,
  objectiveRouteSuppressesConversationTopic,
  objectiveRouteTextAffirmsConversationPolicy,
  objectiveRouteTextGroundsConversationPolicy,
  objectiveRouteWorkStageThought,
  objectiveRouteWorkStageWatchCopy,
} from "./objectiveScaffolds.js";
import {
  buildRowanCognition,
  buildRowanCognitionState,
} from "./rowanCognition.js";
import {
  executeRowanLoopStep,
  resolveRowanLoopStep as resolveLayeredRowanLoopStep,
  rowanAutonomyFromLoopStep,
} from "./rowanLoop.js";
import {
  STREET_SPACE_ID,
  defaultSpaceIdForLocation,
  interiorSpaceIdForLocation,
} from "../street-sim/spaces.js";
import type {
  AIRuntimeTask,
  ActionOption,
  ClockState,
  ConversationEntry,
  ConversationThreadState,
  FeedEntry,
  JobState,
  LocationState,
  MapTile,
  MemoryEntry,
  NpcState,
  ObjectiveFocus,
  ObjectiveOutcomeState,
  PendingObjectiveMove,
  ProblemState,
  RowanAutonomyEffect,
  RowanAutonomyIntent,
  RowanAutonomyStepKind,
  RowanPlanningTrace,
  RowanPlanningTraceLegalBacking,
  RowanPlanningTraceOption,
  RowanPlanningTraceSelectedRecommendation,
  RowanPlanningTraceStep,
  SceneNote,
  SpaceDefinition,
  SpacePortal,
  StreetGameState,
} from "../street-sim/types.js";
import type { GameCommand } from "../types/api.js";
import type {
  RowanLoopObjectiveDirective as ObjectiveDirective,
  RowanLoopStep,
} from "./rowanLoop.js";

export const STEP_MINUTES = 30;

const MINUTES_PER_MOVEMENT_TILE = 1.5;
const MIN_PLAYER_MOVEMENT_ENERGY = 12;
const MIN_STREET_PLANNER_CONFIDENCE = 0.55;
const JOB_WINDOW_PRESSURE_MINUTES = 45;

const BASE_DAY = "2026-03-21T00:00:00.000Z";

type ObjectivePlan = {
  score: number;
  rationale: string;
  targetLocationId?: string;
  actionId?: string;
  npcId?: string;
  speech?: string;
  waitUntilMinutes?: number;
};

type ObjectivePlanChoice = ObjectivePlan & {
  plannerAction: StreetPlanningAllowedAction;
};

type AcceptedStreetPlannerRecommendation = {
  confidence: number;
  model: string;
  provider: string;
  rationale: string;
  sourceKind: "live-llm";
};

type ObjectivePlanningPressureKind =
  | "energy"
  | "job"
  | "predicate"
  | "problem"
  | "tool";

type ObjectivePlanningPressure = {
  id: string;
  kind: ObjectivePlanningPressureKind;
  label: string;
  priority: number;
  rationale: string;
  actionId?: string;
  matchedOutcomeId?: string;
  npcId?: string;
  targetLocationId?: string;
};

type ObjectivePlanningPressureMatch = {
  pressure: ObjectivePlanningPressure;
  score: number;
};

type PendingMoveActionReference = {
  actionId: string;
  current?: boolean;
  targetLocationId?: string;
  npcId?: string;
};

type ConversationResolution = {
  decision?: string;
  memoryKind?: MemoryEntry["kind"];
  memoryText?: string;
  npcImpression?: string;
  objectiveText?: string;
  summary?: string;
};

type ConversationLoopOptions = {
  addFallbackFeed?: boolean;
  maxAutonomousFollowups?: number;
  surfaceNpcRepliesInFeed?: boolean;
};

type ThoughtRefreshMode = "full" | "deterministic";

type GridPoint = {
  x: number;
  y: number;
};

type ActionValidation =
  | {
      action: ActionOption;
      anchor?: GridPoint;
      distanceToAnchor: number;
      ok: true;
      routeToAnchor?: ReturnType<typeof findWalkableRoute>;
    }
  | {
      ok: false;
      reason: string;
    };

export class SimulationEngine {
  constructor(private readonly aiProvider: AIProvider) {}

  get providerName(): string {
    return this.aiProvider.name;
  }

  async createGame(gameId: string): Promise<StreetGameState> {
    const world = seedStreetGame(gameId);
    initializeAIRuntime(world, this.aiProvider);
    return refreshWorld(world, this.aiProvider, { thoughtRefreshMode: "full" });
  }

  async tick(
    world: StreetGameState,
    tickCount: number,
  ): Promise<StreetGameState> {
    const nextWorld = cloneWorld(world);

    for (let index = 0; index < tickCount; index += 1) {
      advanceWorld(nextWorld, STEP_MINUTES);
      addFeed(
        nextWorld,
        "info",
        "You let half an hour pass and watched the block keep rearranging itself.",
      );
    }

    return refreshWorld(nextWorld, this.aiProvider, {
      thoughtRefreshMode: "full",
    });
  }

  async runCommand(
    world: StreetGameState,
    command: GameCommand,
  ): Promise<StreetGameState> {
    const nextWorld = cloneWorld(world);
    let thoughtRefreshMode: ThoughtRefreshMode = "full";

    if (command.type !== "advance_objective") {
      clearPendingObjectiveMove(nextWorld);
    }

    if (command.type !== "speak" && command.type !== "advance_objective") {
      clearActiveConversation(nextWorld);
    }

    switch (command.type) {
      case "move_to":
        movePlayer(nextWorld, command.x, command.y);
        thoughtRefreshMode = "deterministic";
        break;
      case "act":
        await performAction(nextWorld, command.actionId, this.aiProvider);
        break;
      case "wait":
        advanceWorldUntilIndependentNpcAction(nextWorld, command.minutes);
        thoughtRefreshMode = "deterministic";
        if (!command.silent) {
          addFeed(
            nextWorld,
            "info",
            "You stayed put long enough for the block to move around you.",
          );
        }
        break;
      case "update_policy":
        addFeed(
          nextWorld,
          "info",
          "This street slice has no policy layer yet. What matters is where you go and what you do there.",
        );
        break;
      case "set_objective":
        setObjective(nextWorld, command.text);
        break;
      case "speak":
        await speakToNpc(
          nextWorld,
          command.npcId,
          command.text,
          this.aiProvider,
        );
        break;
      case "advance_objective":
        thoughtRefreshMode =
          (await advanceObjective(nextWorld, this.aiProvider, {
            allowTimeSkip: command.allowTimeSkip ?? true,
            confirmMove: command.confirmMove ?? false,
          })) ?? thoughtRefreshMode;
        break;
      default:
        break;
    }

    return refreshWorld(nextWorld, this.aiProvider, {
      thoughtRefreshMode,
    });
  }
}

function cloneWorld(world: StreetGameState): StreetGameState {
  return structuredClone(world);
}

const AI_RUNTIME_TASKS: AIRuntimeTask[] = [
  "generateStreetAutonomousLine",
  "generateStreetReply",
  "generateStreetThoughts",
  "interpretStreetConversation",
  "planStreetNextAction",
];

function initializeAIRuntime(
  world: StreetGameState,
  aiProvider: AIProvider,
): void {
  world.aiRuntime ??= {
    fallbackReasons: [],
    model: aiProvider.model,
    provider: aiProvider.name,
    status: "not_called",
    tasks: Object.fromEntries(
      AI_RUNTIME_TASKS.map((task) => [
        task,
        {
          fallbacks: 0,
          skips: 0,
          successes: 0,
        },
      ]),
    ) as NonNullable<StreetGameState["aiRuntime"]>["tasks"],
    totalFallbacks: 0,
    totalSkips: 0,
    totalSuccesses: 0,
  };
  world.aiRuntime.model = aiProvider.model;
  world.aiRuntime.provider = aiProvider.name;
}

function recordAIRuntimePolicyFallback(
  world: StreetGameState,
  task: AIRuntimeTask,
  reason: string,
): void {
  if (!world.aiRuntime) {
    return;
  }

  const summary = world.aiRuntime.tasks[task];
  const now = new Date().toISOString();
  summary.fallbacks += 1;
  summary.lastFallbackReason = reason;
  summary.lastStatus = "fallback";
  summary.lastUpdatedAt = now;
  world.aiRuntime.fallbackReasons = [
    reason,
    ...world.aiRuntime.fallbackReasons,
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 5);
  world.aiRuntime.lastUpdatedAt = now;
  world.aiRuntime.status =
    world.aiRuntime.totalSuccesses > 0 ? "live" : "fallback";
  world.aiRuntime.totalFallbacks += 1;
}

async function refreshWorld(
  world: StreetGameState,
  aiProvider: AIProvider,
  options: { thoughtRefreshMode?: ThoughtRefreshMode } = {},
): Promise<StreetGameState> {
  const thoughtRefreshMode = options.thoughtRefreshMode ?? "full";
  initializeAIRuntime(world, aiProvider);
  world.conversations ??= [];
  world.conversationThreads ??= {};
  world.firstAfternoon ??= {};
  world.cityEvents ??= [];
  world.currentTime = isoFor(world.clock.totalMinutes);
  updateNpcLocations(world);
  updatePlayerLocation(world);
  resolvePassiveState(world);
  syncCityEvents(world);
  world.player.objective = buildPlayerObjectiveState(world, {
    previous: world.player.objective,
  });
  reconcilePendingObjectiveMove(world);
  syncNpcInnerState(world);
  reconcileActiveConversation(world);
  world.currentScene = buildScene(world);
  world.availableActions = buildAvailableActions(world);
  world.goals = buildGoals(world);
  world.rowanAutonomy = deriveRowanAutonomy(world);
  world.rowanCognition = buildRowanCognitionState(world);
  world.summary = buildSummary(world);
  await hydrateStreetThoughts(world, aiProvider, thoughtRefreshMode);
  trimFeed(world);
  trimMemories(world);
  trimConversations(world);
  return world;
}

function advanceWorld(
  world: StreetGameState,
  minutes: number,
  options: { workingJobId?: string } = {},
): void {
  const normalizedMinutes = Math.max(0, Math.round(minutes));

  if (normalizedMinutes === 0) {
    return;
  }

  let remainingMinutes = normalizedMinutes;

  while (remainingMinutes > 0) {
    const chunkMinutes = Math.min(remainingMinutes, 5);
    world.clock.totalMinutes += chunkMinutes;
    updateClock(world.clock);
    world.currentTime = isoFor(world.clock.totalMinutes);
    updateNpcLocations(world);
    updatePlayerLocation(world);
    resolvePassiveState(world, { workingJobId: options.workingJobId });
    syncCityEvents(world);
    remainingMinutes -= chunkMinutes;
  }
}

function independentNpcActionKeys(world: StreetGameState): Set<string> {
  const problemKeys = (world.problems ?? [])
    .filter(
      (problem) => problem.status === "resolved" && problem.resolvedByNpcId,
    )
    .map(
      (problem) =>
        `${problem.id}|${problem.resolvedByNpcId}|${problem.resolvedAt ?? "none"}`,
    );
  const jobKeys = (world.jobs ?? [])
    .filter(
      (job) =>
        job.id === "job-yard-shift" &&
        job.missed &&
        Boolean(job.consequenceAppliedAt),
    )
    .map((job) => `${job.id}|npc-tomas|${job.consequenceAppliedAt}`);

  return new Set([...problemKeys, ...jobKeys]);
}

function advanceWorldUntilIndependentNpcAction(
  world: StreetGameState,
  minutes: number,
  options: { workingJobId?: string } = {},
): { advancedMinutes: number; interrupted: boolean } {
  const normalizedMinutes = Math.max(0, Math.round(minutes));

  if (normalizedMinutes === 0) {
    return { advancedMinutes: 0, interrupted: false };
  }

  const knownIndependentActions = independentNpcActionKeys(world);
  let advancedMinutes = 0;
  let remainingMinutes = normalizedMinutes;

  while (remainingMinutes > 0) {
    const chunkMinutes = Math.min(remainingMinutes, 5);
    world.clock.totalMinutes += chunkMinutes;
    advancedMinutes += chunkMinutes;
    updateClock(world.clock);
    world.currentTime = isoFor(world.clock.totalMinutes);
    updateNpcLocations(world);
    updatePlayerLocation(world);
    resolvePassiveState(world, { workingJobId: options.workingJobId });
    syncCityEvents(world);
    remainingMinutes -= chunkMinutes;

    const nextIndependentActions = independentNpcActionKeys(world);
    if (
      [...nextIndependentActions].some((key) => !knownIndependentActions.has(key))
    ) {
      return { advancedMinutes, interrupted: true };
    }
  }

  return { advancedMinutes, interrupted: false };
}

function movePlayer(world: StreetGameState, x: number, y: number): void {
  const space = activeSpace(world);
  const targetX = clamp(x, 0, space.width - 1);
  const targetY = clamp(y, 0, space.height - 1);
  const targetTile = space.tiles.find(
    (tile) => tile.x === targetX && tile.y === targetY,
  );

  if (!targetTile || !targetTile.walkable) {
    addFeed(world, "info", "That route is blocked or not worth taking.");
    return;
  }

  const startPoint = {
    x: world.player.x,
    y: world.player.y,
  };
  const targetPoint = {
    x: targetTile.x,
    y: targetTile.y,
  };
  const route = findWalkableRoute(space.tiles, startPoint, targetPoint);

  if (!route.reached) {
    addFeed(world, "info", "That route is blocked or not worth taking.");
    return;
  }

  const distance = Math.max(route.path.length - 1, 0);

  if (distance === 0) {
    addFeed(world, "info", "You are already standing there.");
    return;
  }

  advanceWorld(world, movementMinutesForDistance(distance, space.kind));
  world.activeSpaceId = space.id;
  world.player.spaceId = space.id;
  world.player.x = targetTile.x;
  world.player.y = targetTile.y;
  world.player.energy = clamp(
    world.player.energy - movementEnergyForDistance(distance, space.kind),
    MIN_PLAYER_MOVEMENT_ENERGY,
    100,
  );
  updatePlayerLocation(world);

  const location = currentLocation(world);

  if (location && !world.player.knownLocationIds.includes(location.id)) {
    world.player.knownLocationIds.push(location.id);
    remember(
      world,
      "place",
      `You found ${location.name}. ${location.description} ${location.context}`,
    );
    addFeed(world, "memory", `You got your bearings at ${location.name}.`);
  } else if (location) {
    addFeed(world, "info", `You made your way to ${location.name}.`);
  } else {
    addFeed(
      world,
      "info",
      space.kind === "interior"
        ? "You crossed the room and kept reading what the place allowed."
        : "You walked the lane and kept watching the district unfold.",
    );
  }
}

function usePortal(world: StreetGameState, actionId: string): void {
  const fromSpace = activeSpace(world);
  const portal = fromSpace.portals.find(
    (entry) =>
      entry.actionId === actionId && entry.fromSpaceId === fromSpace.id,
  );

  if (!portal) {
    addFeed(world, "info", "There is no valid doorway from here.");
    return;
  }

  const toSpace = spaceById(world, portal.toSpaceId);
  const fromTile = tileAt(fromSpace, portal.from.x, portal.from.y);
  const toTile = toSpace ? tileAt(toSpace, portal.to.x, portal.to.y) : undefined;

  if (!toSpace || !fromTile?.walkable || !toTile?.walkable) {
    addFeed(world, "info", "That doorway is blocked.");
    return;
  }

  const route = findWalkableRoute(fromSpace.tiles, world.player, portal.from);
  if (!route.reached) {
    addFeed(world, "info", "You cannot reach that doorway from here.");
    return;
  }

  const distance = Math.max(route.path.length - 1, 0);
  advanceWorld(world, movementMinutesForDistance(distance, fromSpace.kind) + 1);
  world.activeSpaceId = toSpace.id;
  world.player.spaceId = toSpace.id;
  world.player.x = portal.to.x;
  world.player.y = portal.to.y;
  world.player.energy = clamp(
    world.player.energy - movementEnergyForDistance(distance, fromSpace.kind),
    MIN_PLAYER_MOVEMENT_ENERGY,
    100,
  );
  updatePlayerLocation(world);

  const location = findLocation(world, portal.locationId);
  const enteredInterior = toSpace.kind === "interior";
  addFeed(
    world,
    "info",
    enteredInterior
      ? `You stepped inside ${location?.name ?? toSpace.name}.`
      : `You stepped back out to ${world.districtName}.`,
  );
}

function movementMinutesForDistance(
  distance: number,
  spaceKind: SpaceDefinition["kind"] = "street",
): number {
  if (spaceKind === "interior") {
    return Math.max(1, Math.ceil(distance * 0.25));
  }

  return Math.max(1, Math.ceil(distance * MINUTES_PER_MOVEMENT_TILE));
}

function movementEnergyForDistance(
  distance: number,
  spaceKind: SpaceDefinition["kind"] = "street",
): number {
  if (spaceKind === "interior") {
    return Math.ceil(distance / 4);
  }

  return distance * 2;
}

function findWalkableRoute(tiles: MapTile[], start: GridPoint, end: GridPoint) {
  const roundedStart = {
    x: Math.round(start.x),
    y: Math.round(start.y),
  };
  const roundedEnd = {
    x: Math.round(end.x),
    y: Math.round(end.y),
  };
  const walkable = new Set(
    tiles.filter((tile) => tile.walkable).map((tile) => `${tile.x},${tile.y}`),
  );
  const startKey = `${roundedStart.x},${roundedStart.y}`;
  const endKey = `${roundedEnd.x},${roundedEnd.y}`;
  const queue: GridPoint[] = [roundedStart];
  const visited = new Set([startKey]);
  const parentByKey = new Map<string, string>();
  let foundKey = startKey;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;

    if (currentKey === endKey) {
      foundKey = currentKey;
      break;
    }

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nextX = current.x + dx;
      const nextY = current.y + dy;
      const nextKey = `${nextX},${nextY}`;

      if (!walkable.has(nextKey) || visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parentByKey.set(nextKey, currentKey);
      queue.push({ x: nextX, y: nextY });
    }
  }

  if (foundKey !== endKey) {
    return {
      path: [roundedStart],
      reached: false,
    };
  }

  const path: GridPoint[] = [];
  let currentKey: string | undefined = foundKey;

  while (currentKey) {
    const [x, y] = currentKey.split(",").map(Number);
    path.unshift({ x, y });
    currentKey = parentByKey.get(currentKey);
  }

  return {
    path,
    reached: true,
  };
}

async function performAction(
  world: StreetGameState,
  actionId: string,
  aiProvider?: AIProvider,
): Promise<void> {
  const validation = validateActionForExecution(world, actionId);
  if (!validation.ok) {
    addFeed(world, "info", validation.reason);
    return;
  }

  if (actionRequiresAnchorArrival(validation.action)) {
    if (!movePlayerToActionAnchor(world, validation)) {
      addFeed(world, "info", "You cannot reach that spot from here.");
      return;
    }

    const revalidation = validateActionForExecution(world, actionId);
    if (!revalidation.ok) {
      addFeed(world, "info", revalidation.reason);
      return;
    }
  }

  await performActionUnchecked(world, actionId, aiProvider);
}

function validateActionForExecution(
  world: StreetGameState,
  actionId: string,
): ActionValidation {
  const action = buildAvailableActions(world).find(
    (candidate) => candidate.id === actionId,
  );

  if (!action) {
    return {
      ok: false,
      reason:
        unavailableActionReason(world, actionId) ??
        "That action is not available from here.",
    };
  }

  if (action.disabled) {
    return {
      ok: false,
      reason: action.disabledReason ?? "That action is not available right now.",
    };
  }

  const currentSpaceId = activeSpaceId(world);
  if (action.spaceId && action.spaceId !== currentSpaceId) {
    return {
      ok: false,
      reason: "That action belongs to a different space.",
    };
  }

  if (actionNeedsInteriorAnchor(world, action) && !action.targetAnchorId) {
    return {
      ok: false,
      reason: "There is no reachable spot for that action in this room.",
    };
  }

  if (!action.targetAnchorId) {
    return {
      action,
      distanceToAnchor: 0,
      ok: true,
    };
  }

  const space = activeSpace(world);
  const anchor = space.anchors.find(
    (candidate) => candidate.id === action.targetAnchorId,
  );
  if (!anchor) {
    return {
      ok: false,
      reason: "There is no reachable spot for that action in this room.",
    };
  }

  const anchorTile = tileAt(space, anchor.x, anchor.y);
  if (!anchorTile?.walkable) {
    return {
      ok: false,
      reason: "You cannot reach that spot from here.",
    };
  }

  const route = findWalkableRoute(space.tiles, world.player, anchor);
  if (!route.reached) {
    return {
      ok: false,
      reason: "You cannot reach that spot from here.",
    };
  }

  return {
    action,
    anchor,
    distanceToAnchor: Math.max(route.path.length - 1, 0),
    ok: true,
    routeToAnchor: route,
  };
}

function unavailableActionReason(
  world: StreetGameState,
  actionId: string,
): string | undefined {
  const [kind, targetId] = actionId.split(":");
  if (kind === "talk" && targetId) {
    const npc = world.npcs.find((entry) => entry.id === targetId);
    return npc ? unavailableNpcActionReason(world, npc) : undefined;
  }

  return undefined;
}

function unavailableNpcActionReason(world: StreetGameState, npc: NpcState) {
  const playerLocation = currentLocation(world);
  const npcLocation = findLocation(world, npc.currentLocationId);
  const playerSpace = activeSpace(world);
  const npcSpace = spaceById(world, npcSpaceId(npc));

  if (
    playerLocation &&
    npcLocation &&
    playerLocation.id === npcLocation.id &&
    playerSpace.kind === "street" &&
    npcSpace?.kind === "interior"
  ) {
    return `Step inside ${npcLocation.name} to find ${npc.name}.`;
  }

  if (
    playerLocation &&
    npcLocation &&
    playerLocation.id === npcLocation.id &&
    playerSpace.kind === "interior" &&
    npcSpace?.kind === "street"
  ) {
    return `Step back out to ${world.districtName} to find ${npc.name}.`;
  }

  if (npcLocation) {
    return `${npc.name} is at ${npcLocation.name}; Rowan needs to reach ${npcLocation.name} before talking.`;
  }

  return `${npc.name} is not available to talk right now.`;
}

function actionNeedsInteriorAnchor(
  world: StreetGameState,
  action: ActionOption,
) {
  const space = activeSpace(world);
  return (
    space.kind === "interior" &&
    action.kind !== "enter" &&
    action.kind !== "exit"
  );
}

function actionRequiresAnchorArrival(action: ActionOption) {
  return (
    Boolean(action.targetAnchorId) &&
    action.kind !== "enter" &&
    action.kind !== "exit"
  );
}

function movePlayerToActionAnchor(
  world: StreetGameState,
  validation: Extract<ActionValidation, { ok: true }>,
) {
  if (!validation.anchor || !validation.routeToAnchor?.reached) {
    return true;
  }

  if (validation.distanceToAnchor <= 0) {
    return true;
  }

  const space = activeSpace(world);
  advanceWorld(
    world,
    movementMinutesForDistance(validation.distanceToAnchor, space.kind),
  );
  world.activeSpaceId = space.id;
  world.player.spaceId = space.id;
  world.player.x = validation.anchor.x;
  world.player.y = validation.anchor.y;
  world.player.energy = clamp(
    world.player.energy -
      movementEnergyForDistance(validation.distanceToAnchor, space.kind),
    MIN_PLAYER_MOVEMENT_ENERGY,
    100,
  );
  updatePlayerLocation(world);
  return true;
}

async function performActionUnchecked(
  world: StreetGameState,
  actionId: string,
  aiProvider?: AIProvider,
): Promise<void> {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "talk":
      if (targetId && aiProvider) {
        await talkToNpc(world, targetId, aiProvider);
      }
      break;
    case "accept":
      if (targetId) {
        acceptJob(world, targetId);
      }
      break;
    case "work":
      if (targetId) {
        workJob(world, targetId);
      }
      break;
    case "enter":
    case "exit":
      usePortal(world, actionId);
      break;
    case "defer":
      if (targetId) {
        deferJob(world, targetId);
      }
      break;
    case "resume":
      if (targetId) {
        resumeJob(world, targetId);
      }
      break;
    case "abandon":
      if (targetId) {
        abandonJob(world, targetId);
      }
      break;
    case "buy":
      if (targetId) {
        buyItem(world, targetId);
      }
      break;
    case "contribute":
      if (targetId) {
        contributeToLocation(world, targetId);
      }
      break;
    case "solve":
      if (targetId) {
        solveProblem(world, targetId);
      }
      break;
    case "inspect":
      if (targetId) {
        inspectLead(world, targetId);
      }
      break;
    case "rest":
      restAtHome(world);
      break;
    case "reflect":
      if (targetId === "first-afternoon-plan") {
        settleFirstAfternoonPlan(world);
      } else if (targetId === "first-afternoon-pump") {
        chooseFirstAfternoonPumpPlan(world);
      } else if (targetId === "first-afternoon-compare") {
        compareFirstAfternoonOptions(world);
      } else if (targetId === "first-afternoon") {
        completeFirstAfternoon(world);
      }
      break;
    default:
      addFeed(world, "info", "Nothing came of that.");
      break;
  }
}

function isTimeSkippingAction(actionId: string) {
  const [kind] = actionId.split(":");
  return (
    kind === "contribute" ||
    kind === "work" ||
    kind === "solve" ||
    kind === "rest"
  );
}

function setLongActionThought(world: StreetGameState, actionId: string) {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "work": {
      const job = targetId ? jobById(world, targetId) : undefined;
      world.player.currentThought = job
        ? `The ${job.title.toLowerCase()} is ready. I can take the next step when you want me to.`
        : "I'm ready to work when you want Rowan to take the next step.";
      return;
    }
    case "solve": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      world.player.currentThought = problem
        ? `I'm ready to deal with ${problem.title.toLowerCase()} when you want Rowan to take the next step.`
        : "I'm ready to deal with this once you want Rowan to take the next step.";
      return;
    }
    case "contribute":
      world.player.currentThought =
        "I'm ready to help around Morrow House when you want Rowan to take the next step.";
      return;
    case "rest":
      world.player.currentThought =
        "I can stop and rest when you want Rowan to take the next step.";
      return;
    default:
      return;
  }
}

function setObjective(world: StreetGameState, text: string): void {
  const previous = world.player.objective?.text?.trim();
  const normalized = normalizeObjectiveText(text);

  clearPendingObjectiveMove(world);

  if (!normalized) {
    if (!previous) {
      addFeed(
        world,
        "info",
        "Rowan is already moving without a fixed direction.",
      );
      return;
    }

    world.player.objective = undefined;
    addFeed(
      world,
      "memory",
      "You let go of the fixed objective for now and went back to taking the day one step at a time.",
    );
    remember(
      world,
      "self",
      "You let go of one fixed objective and decided to take the day more as it comes.",
    );
    return;
  }

  if (previous?.toLowerCase() === normalized.toLowerCase()) {
    addFeed(
      world,
      "info",
      `You are still steering Rowan toward: ${normalized}`,
    );
    return;
  }

  world.player.objective = buildPlayerObjectiveState(world, {
    text: normalized,
    focus: classifyObjective(normalized),
    source: "manual",
    previous: world.player.objective,
  });
  addFeed(world, "memory", `You set Rowan's direction: ${normalized}`);
  remember(
    world,
    "self",
    `You decided that what matters right now is simple: ${normalized}`,
  );
}

function currentObjectiveDirective(
  world: StreetGameState,
): ObjectiveDirective | undefined {
  const objective = world.player.objective;
  if (!objective) {
    return undefined;
  }

  const text = objective.text;
  if (!text) {
    return undefined;
  }

  return {
    text,
    focus: objective.focus ?? classifyObjective(text),
    routeKey: objective.routeKey,
  };
}

function isCurrentObjectiveComplete(world: StreetGameState) {
  const progress = world.player.objective?.progress;
  return Boolean(
    progress && progress.total > 0 && progress.completed >= progress.total,
  );
}

async function advanceObjective(
  world: StreetGameState,
  aiProvider: AIProvider,
  options: {
    allowTimeSkip?: boolean;
    confirmMove?: boolean;
  } = {},
): Promise<ThoughtRefreshMode | void> {
  const allowTimeSkip = options.allowTimeSkip ?? true;
  syncNpcInnerState(world);
  const deterministicLoopStep = resolveRowanLoopStep(world);
  const loopStep =
    (await resolveAiPlannedObjectiveLoopStep(
      world,
      aiProvider,
      deterministicLoopStep,
    )) ?? deterministicLoopStep;

  return executeRowanLoopStep<ThoughtRefreshMode | void>(loopStep, {
    idle: () => {
      if (acknowledgeFirstAfternoonCompletion(world)) {
        return "deterministic" as const;
      }

      addFeed(
        world,
        "info",
        "Rowan has no clear direction yet. Set an objective first, then let him run with it.",
      );
    },
    blocked: () => {
      addFeed(
        world,
        "info",
        "Rowan keeps circling the objective, but the block has not given him a clean next move yet.",
      );
    },
    reflect: (step) => executeRowanReflectLoopStep(world, step),
    continueConversation: () => continueActiveConversation(world, aiProvider),
    openConversation: async (step) => {
      if (step.npcId && step.speech && step.objective) {
        await conductAutonomousConversation(
          world,
          step.npcId,
          step.speech,
          step.objective,
          aiProvider,
        );
        return "deterministic" as const;
      }
      return undefined;
    },
    move: (step) =>
      executeRowanMoveLoopStep(world, step, aiProvider, {
        confirmMove: options.confirmMove ?? false,
      }),
    action: (step) =>
      executeRowanActionLoopStep(world, step, aiProvider, {
        allowTimeSkip,
      }),
    observe: (step) => {
      if (step.targetLocationId) {
        const location = findLocation(world, step.targetLocationId);
        addFeed(
          world,
          "info",
          `Rowan reaches ${location?.name ?? "the next spot"} and keeps reading the room for the next opening.`,
        );
      }
      world.player.currentThought = step.detail;
      return "deterministic" as const;
    },
  });
}

function acknowledgeFirstAfternoonCompletion(world: StreetGameState): boolean {
  if (
    world.player.objective?.routeKey !== "first-afternoon" ||
    !world.firstAfternoon?.completedAt ||
    world.firstAfternoon.completionAcknowledgedAt ||
    !isCurrentObjectiveComplete(world)
  ) {
    return false;
  }

  const acknowledgement = objectiveRouteCompletionAcknowledgement(
    world,
    world.player.objective,
  );
  if (!acknowledgement) {
    return false;
  }

  world.firstAfternoon.completionAcknowledgedAt = world.currentTime;
  addFeed(world, "memory", acknowledgement.feedText);
  rememberIfNew(world, "self", acknowledgement.memoryText);
  return true;
}

function resolveConversationTarget(world: StreetGameState, npcId: string) {
  const npc = world.npcs.find((entry) => entry.id === npcId);
  if (!npc) {
    return undefined;
  }

  const location = currentLocation(world);
  if (!location || !isNpcInActiveScene(world, npc)) {
    addFeed(world, "info", unavailableNpcActionReason(world, npc));
    return undefined;
  }

  return { npc, location };
}

function movePlayerToNpcAnchor(world: StreetGameState, npc: NpcState) {
  const space = activeSpace(world);
  const actionId = `talk:${npc.id}`;
  const anchor =
    space.anchors.find((candidate) => candidate.actionId === actionId) ??
    space.anchors.find((candidate) => candidate.npcId === npc.id);

  if (!anchor) {
    if (space.kind === "interior") {
      addFeed(world, "info", "There is no reachable spot for that person in this room.");
      return false;
    }

    return true;
  }

  const anchorTile = tileAt(space, anchor.x, anchor.y);
  if (!anchorTile?.walkable) {
    addFeed(world, "info", "You cannot reach that spot from here.");
    return false;
  }

  const route = findWalkableRoute(space.tiles, world.player, anchor);
  if (!route.reached) {
    addFeed(world, "info", "You cannot reach that spot from here.");
    return false;
  }

  const distance = Math.max(route.path.length - 1, 0);
  if (distance <= 0) {
    return true;
  }

  advanceWorld(world, movementMinutesForDistance(distance, space.kind));
  world.activeSpaceId = space.id;
  world.player.spaceId = space.id;
  world.player.x = anchor.x;
  world.player.y = anchor.y;
  world.player.energy = clamp(
    world.player.energy - movementEnergyForDistance(distance, space.kind),
    MIN_PLAYER_MOVEMENT_ENERGY,
    100,
  );
  updatePlayerLocation(world);
  return true;
}

function resolveRowanLoopStep(world: StreetGameState): RowanLoopStep {
  const loopStep = resolveLayeredRowanLoopStep(world, {
    conversation: resolveConversationLoopStep,
    pendingMove: resolvePendingMoveLoopStep,
    commitment: resolveCommittedJobLoopStep,
    objective: resolveObjectiveLoopStep,
  });

  return {
    ...loopStep,
    intent: loopStep.intent ?? buildRowanAutonomyIntent(world, loopStep),
  };
}

function resolveConversationLoopStep(
  world: StreetGameState,
): RowanLoopStep | undefined {
  if (!world.activeConversation) {
    return undefined;
  }

  const npc = npcById(world, world.activeConversation.npcId);
  const hasResolution = Boolean(
    world.activeConversation.decision || world.activeConversation.objectiveText,
  );
  const objective = currentConversationObjective(world);
  const discussedTopics = collectConversationTopics(
    world.activeConversation.lines,
  );
  const lastNpcReply = latestNpcReplyFromConversation(
    world.activeConversation.lines,
  );
  const provisionalResolution =
    npc && lastNpcReply
      ? deriveConversationResolution(
          world,
          npc,
          objective,
          lastNpcReply,
          discussedTopics,
        )
      : {};
  const canContinueConversation =
    npc && lastNpcReply
      ? shouldContinueConversation(
          world,
          npc,
          objective,
          lastNpcReply,
          discussedTopics,
          provisionalResolution,
        )
      : false;
  const effects: RowanAutonomyEffect[] = hasResolution
    ? [
        ...(world.activeConversation.decision ? (["memory"] as const) : []),
        ...(world.activeConversation.objectiveText
          ? (["objective"] as const)
          : []),
      ]
    : ["conversation"];

  return {
    autoContinue: hasResolution || canContinueConversation,
    detail: hasResolution
      ? "That gives Rowan enough to work with. He can close the conversation and act on it."
      : canContinueConversation
        ? `Rowan has one more question for ${npc?.name ?? "someone nearby"} before he moves on.`
        : "The conversation has gone quiet, and Rowan can turn back toward the day.",
    effects,
    key: `conversation:${world.activeConversation.threadId}:${world.activeConversation.updatedAt}`,
    kind: hasResolution
      ? "reflect"
      : canContinueConversation
        ? "talk"
        : "reflect",
    label: `With ${npc?.name ?? "someone nearby"}`,
    layer: "conversation",
    npcId: world.activeConversation.npcId,
    targetLocationId: world.activeConversation.locationId,
  };
}

function resolvePendingMoveLoopStep(
  world: StreetGameState,
): RowanLoopStep | undefined {
  const pendingMove = world.player.pendingObjectiveMove;
  if (!pendingMove) {
    return undefined;
  }

  const location = findLocation(world, pendingMove.targetLocationId);
  const activeJobId = world.player.activeJobId;

  return {
    actionId: pendingMove.actionId,
    autoContinue: true,
    detail:
      pendingMove.rationale ||
      `${location?.name ?? "The destination"} fits Rowan's current obligation based on what he knows now.`,
    key: `pending:${pendingMove.preparedAt}:${pendingMove.targetLocationId}:${pendingMove.actionId ?? pendingMove.npcId ?? ""}`,
    kind: "move",
    label: autonomyLabelForRouteProgress(world, pendingMove.targetLocationId),
    layer:
      activeJobId && pendingMove.actionId === `work:${activeJobId}`
        ? "commitment"
        : "objective",
    npcId: pendingMove.npcId,
    objective: currentObjectiveDirective(world),
    planningTrace: pendingMove.planningTrace,
    speech: pendingMove.speech,
    targetLocationId: pendingMove.targetLocationId,
    travelPhase: "route-progress",
  };
}

function autonomyLabelForRouteProgress(
  world: StreetGameState,
  targetLocationId: string,
) {
  const location = findLocation(world, targetLocationId);
  if (location) {
    return (
      objectiveRouteMoveLabelForLocation(world, location) ??
      `On the way to ${location.name}`
    );
  }

  return "Following the current route";
}

function resolveCommittedJobLoopStep(
  world: StreetGameState,
): RowanLoopStep | undefined {
  const committedJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  if (!committedJob) {
    return undefined;
  }

  const location = findLocation(world, committedJob.locationId);
  const startTotalMinutes = totalMinutesForDayHour(
    world.clock.day,
    committedJob.startHour,
  );

  if (
    committedJob.deferredUntilMinutes !== undefined &&
    world.clock.totalMinutes < committedJob.deferredUntilMinutes
  ) {
    const actionId = `resume:${committedJob.id}`;
    const targetTotalMinutes = committedJob.deferredUntilMinutes;
    const label = `Hold for ${committedJob.title}`;
    return {
      actionId,
      autoContinue: true,
      detail: `The commitment is still live. Rowan can wait until about ${formatClockAt(
        world,
        targetTotalMinutes,
      )}.`,
      effects: ["thought"],
      key: `job-deferred:${committedJob.id}:${targetTotalMinutes}`,
      kind: "wait",
      label,
      layer: "commitment",
      planningTrace: buildCommittedJobPlanningTrace(world, committedJob, {
        actionId,
        detail: `Rowan can wait until about ${formatClockAt(
          world,
          targetTotalMinutes,
        )}, then pick the commitment back up.`,
        kind: "wait",
        label,
        targetLocationId: committedJob.locationId,
        validation: "The commitment is paused until this time.",
        waitUntilMinutes: targetTotalMinutes,
      }),
      targetLocationId: committedJob.locationId,
      waitUntilMinutes: targetTotalMinutes,
    };
  }

  if (world.player.currentLocationId !== committedJob.locationId) {
    const actionId = `move:${committedJob.locationId}`;
    const label = `Get to ${location?.name ?? "the job site"}`;
    return {
      actionId,
      autoContinue: true,
      detail: `The shift matters more than wandering right now, so Rowan is routing himself to ${location?.name ?? "the job site"}.`,
      key: `job-travel:${committedJob.id}:${world.player.currentLocationId ?? "none"}:${committedJob.locationId}`,
      kind: "move",
      label,
      layer: "commitment",
      planningTrace: buildCommittedJobPlanningTrace(world, committedJob, {
        actionId,
        detail: `The accepted shift is at ${location?.name ?? "the job site"}, so Rowan is taking the validated route there before the work window slips.`,
        kind: "move",
        label,
        targetLocationId: committedJob.locationId,
        validation: "The destination exists and the simulator will route the move.",
      }),
      targetLocationId: committedJob.locationId,
    };
  }

  if (world.clock.totalMinutes < startTotalMinutes) {
    const actionId = `work:${committedJob.id}`;
    const label = `Hold for ${committedJob.title}`;
    return {
      actionId,
      autoContinue: true,
      detail: `Rowan is already in place. The shift starts at ${formatClockAt(
        world,
        startTotalMinutes,
      )}.`,
      effects: ["thought"],
      key: `job-start:${committedJob.id}:${startTotalMinutes}`,
      kind: "wait",
      label,
      layer: "commitment",
      planningTrace: buildCommittedJobPlanningTrace(world, committedJob, {
        actionId,
        detail: `Rowan is already at ${location?.name ?? "the job site"} and can wait until the shift starts.`,
        kind: "wait",
        label,
        targetLocationId: committedJob.locationId,
        validation: "Rowan is already at the job site and the start time is still ahead.",
        waitUntilMinutes: startTotalMinutes,
      }),
      targetLocationId: committedJob.locationId,
      waitUntilMinutes: startTotalMinutes,
    };
  }

  const workAlreadyStarted = jobIsStartedCommitment(world, committedJob);
  if (
    (currentHour(world) < committedJob.endHour || workAlreadyStarted) &&
    world.player.energy >= 28
  ) {
    const workStageWatchCopy = objectiveRouteWorkStageWatchCopy(
      world,
      currentObjectiveDirective(world),
      {
        jobId: committedJob.id,
        stage: world.firstAfternoon?.teaShiftStage,
      },
    );
    const label =
      workStageWatchCopy?.label ??
      (workAlreadyStarted
        ? `Finish ${committedJob.title}`
        : `Start ${committedJob.title}`);
    const actionId = `work:${committedJob.id}`;
    return {
      actionId,
      autoContinue: true,
      detail:
        workStageWatchCopy?.detail ??
        (workAlreadyStarted
          ? "Rowan already started this shift before the window closed, so he can finish the work in hand."
          : "The shift window is open now. Rowan can start working."),
      key: `job-work:${committedJob.id}:${world.clock.totalMinutes}:${world.firstAfternoon?.teaShiftStage ?? "ready"}`,
      kind: "act",
      label,
      layer: "commitment",
      planningTrace: buildCommittedJobPlanningTrace(world, committedJob, {
        actionId,
        detail: workAlreadyStarted
          ? "The work is already in hand, so Rowan can finish it rather than starting a new thread."
          : `The work window is open at ${location?.name ?? "the job site"} and Rowan has enough energy to start.`,
        kind: "act",
        label,
        targetLocationId: committedJob.locationId,
        validation: "The work action is available from Rowan's current job-site choices.",
      }),
      targetLocationId: committedJob.locationId,
    };
  }

  if (
    world.player.energy < 28 &&
    world.player.currentLocationId !== world.player.homeLocationId
  ) {
    const home = findLocation(world, world.player.homeLocationId);
    const actionId = `move:${world.player.homeLocationId}`;
    const label = `Reset at ${home?.name ?? "Morrow House"}`;
    return {
      actionId,
      autoContinue: true,
      detail:
        "Rowan needs a quick reset at Morrow House before he burns the shift on tired legs.",
      key: `job-rest:${committedJob.id}:${world.player.currentLocationId ?? "none"}:${world.player.homeLocationId}`,
      kind: "move",
      label,
      layer: "commitment",
      planningTrace: buildCommittedJobPlanningTrace(world, committedJob, {
        actionId,
        detail: `Rowan is too tired to work ${committedJob.title} reliably, so he is routing to ${home?.name ?? "Morrow House"} before checking the commitment again.`,
        kind: "move",
        label,
        targetLocationId: world.player.homeLocationId,
        validation: "Low energy makes rest the safe follow-through move before more work.",
      }),
      targetLocationId: world.player.homeLocationId,
    };
  }

  return undefined;
}

function buildCommittedJobPlanningTrace(
  world: StreetGameState,
  job: JobState,
  step: {
    actionId: string;
    detail: string;
    kind: RowanAutonomyStepKind;
    label: string;
    targetLocationId: string;
    validation: string;
    waitUntilMinutes?: number;
  },
): RowanPlanningTrace {
  const selectedLegalBacking = committedJobLegalBacking(world, step);
  const planKey = `commitment:${job.id}:${step.kind}:${step.actionId}`;
  const selectedOption: RowanPlanningTraceOption = {
    actionId: step.actionId,
    label: step.label,
    legalBacking: selectedLegalBacking,
    matchedOutcomeId: `commitment-${job.id}`,
    pressureId: `commitment:${job.id}`,
    pressureKind: "commitment",
    pressureLabel: `${job.title} is the active commitment`,
    planKey,
    provenance: "live-pressure",
    rationale: step.detail,
    score: 200,
    status: "selected",
    targetLocationId: step.targetLocationId,
  };
  const immediateAction: RowanPlanningTraceStep = {
    actionId: step.actionId,
    kind: step.kind,
    label: step.label,
    legal: true,
    legalBacking: selectedLegalBacking,
    rationale: step.detail,
    targetLocationId: step.targetLocationId,
    validation: step.validation,
  };
  const nextSteps = [
    immediateAction,
    ...committedJobFollowUpSteps(world, job, step),
  ];
  const selectedRecommendation: RowanPlanningTraceSelectedRecommendation = {
    accepted: true,
    advisory: false,
    legalBackingSource: selectedLegalBacking.source,
    sourceKind: "deterministic-planner",
    validationSource: selectedLegalBacking.source,
    validationStatus:
      selectedLegalBacking.source === "current-legal-action-surface"
        ? "legal-action-surface-validated"
        : "simulator-validated",
  };

  return {
    blockers: committedJobTraceBlockers(world, job, step),
    considered: [
      selectedOption,
      ...rejectedCommittedJobOptions(world, job, step, selectedLegalBacking),
    ],
    immediateAction,
    nextSteps,
    outcomes: [
      {
        authority: "predicate",
        evidence: committedJobOutcomeEvidence(world, job, step),
        id: `commitment-${job.id}`,
        label: `${job.title} carried through`,
        status: "open",
        urgency: 95,
      },
    ],
    plannerIntent: {
      actionId: step.actionId,
      label: step.label,
      matchedOutcomeId: `commitment-${job.id}`,
      planKey,
      pressureId: `commitment:${job.id}`,
      pressureKind: "commitment",
      pressureLabel: `${job.title} is the active commitment`,
      rationale: step.detail,
      targetLocationId: step.targetLocationId,
    },
    rejected: rejectedCommittedJobOptions(
      world,
      job,
      step,
      selectedLegalBacking,
    ),
    selectedActionId: step.actionId,
    selectedLabel: step.label,
    selectedLegalBacking,
    selectedMatchedOutcomeId: `commitment-${job.id}`,
    selectedPlanKey: planKey,
    selectedPressureId: `commitment:${job.id}`,
    selectedPressureKind: "commitment",
    selectedPressureLabel: `${job.title} is the active commitment`,
    selectedRecommendation,
    selectedTargetLocationId: step.targetLocationId,
  };
}

function committedJobLegalBacking(
  world: StreetGameState,
  step: {
    actionId: string;
    kind: RowanAutonomyStepKind;
    targetLocationId: string;
    waitUntilMinutes?: number;
  },
): RowanPlanningTraceLegalBacking {
  const currentBacking = currentLegalActionBacking(world, step.actionId);
  if (currentBacking) {
    return currentBacking;
  }

  if (step.kind === "wait" || step.waitUntilMinutes !== undefined) {
    return {
      actionId: step.actionId,
      locationId: world.player.currentLocationId,
      source: "simulator-validated-wait",
    };
  }

  return {
    actionId: step.actionId,
    locationId: step.targetLocationId,
    source: "simulator-validated-move",
  };
}

function committedJobFollowUpSteps(
  world: StreetGameState,
  job: JobState,
  step: {
    actionId: string;
    kind: RowanAutonomyStepKind;
    targetLocationId: string;
    waitUntilMinutes?: number;
  },
): RowanPlanningTraceStep[] {
  if (step.kind === "wait" && step.waitUntilMinutes !== undefined) {
    return [
      {
        actionId: `work:${job.id}`,
        kind: "act",
        label: `Check ${job.title}`,
        legal: true,
        legalBacking: {
          actionId: `work:${job.id}`,
          locationId: job.locationId,
          source: "projected-follow-up-legal-action",
        },
        rationale: `At ${formatClockAt(
          world,
          step.waitUntilMinutes,
        )}, Rowan should check whether ${job.title} can move forward.`,
        targetLocationId: job.locationId,
        validation: "The follow-up check is tied to the accepted job window.",
      },
    ];
  }

  if (step.kind === "move" && step.targetLocationId !== job.locationId) {
    return [
      {
        actionId: `work:${job.id}`,
        kind: "act",
        label: `Recheck ${job.title}`,
        legal: true,
        legalBacking: {
          actionId: `work:${job.id}`,
          locationId: job.locationId,
          source: "projected-follow-up-legal-action",
        },
        rationale: "After recovering, Rowan should check whether the accepted work can still be completed.",
        targetLocationId: job.locationId,
        validation: "The job remains the live obligation after recovery.",
      },
    ];
  }

  if (step.kind === "move") {
    return [
      {
        actionId: `work:${job.id}`,
        kind: "act",
        label: `Start ${job.title}`,
        legal: true,
        legalBacking: {
          actionId: `work:${job.id}`,
          locationId: job.locationId,
          source: "destination-preview-legal-action",
        },
        rationale: "Once Rowan reaches the job site, the next check is whether the work action is open.",
        targetLocationId: job.locationId,
        validation: "The job site is the required place to work this commitment.",
      },
    ];
  }

  return [];
}

function committedJobTraceBlockers(
  world: StreetGameState,
  job: JobState,
  step: {
    kind: RowanAutonomyStepKind;
    waitUntilMinutes?: number;
  },
) {
  const blockers: string[] = [];
  if (step.kind === "wait" && step.waitUntilMinutes !== undefined) {
    blockers.push(`The useful check is around ${formatClockAt(world, step.waitUntilMinutes)}.`);
  }
  if (world.player.energy < 28) {
    blockers.push("Rowan's energy is low enough that recovery has to come first.");
  }
  if (world.player.currentLocationId !== job.locationId) {
    const location = findLocation(world, job.locationId);
    blockers.push(`${job.title} is at ${location?.name ?? "the job site"}, not here.`);
  }
  return blockers;
}

function committedJobOutcomeEvidence(
  world: StreetGameState,
  job: JobState,
  step: {
    kind: RowanAutonomyStepKind;
    waitUntilMinutes?: number;
  },
) {
  if (step.kind === "wait" && step.waitUntilMinutes !== undefined) {
    return `Accepted; next check around ${formatClockAt(world, step.waitUntilMinutes)}.`;
  }
  if (world.player.currentLocationId === job.locationId) {
    return "Rowan is at the job site.";
  }
  const location = findLocation(world, job.locationId);
  return `Accepted; job site is ${location?.name ?? "the job site"}.`;
}

function rejectedCommittedJobOptions(
  world: StreetGameState,
  job: JobState,
  step: {
    actionId: string;
    targetLocationId: string;
  },
  selectedLegalBacking: RowanPlanningTraceLegalBacking,
): RowanPlanningTraceOption[] {
  const pressureId = `commitment:${job.id}`;
  const pressureKind = "commitment";
  const pressureLabel = `${job.title} is the active commitment`;
  const base = {
    matchedOutcomeId: `commitment-${job.id}`,
    pressureId,
    pressureKind,
    pressureLabel,
    provenance: "live-pressure" as const,
    targetLocationId: step.targetLocationId,
  };

  return [
    {
      ...base,
      actionId: "wait:unrelated",
      label: "Start a different thread",
      legalBacking: selectedLegalBacking,
      planKey: `${pressureId}:defer`,
      rationale: `${job.title} is already accepted, so unrelated exploration waits until Rowan has honored or closed it.`,
      reason: "The accepted job is the current obligation.",
      score: 40,
      status: "rejected",
    },
    {
      ...base,
      actionId: "drop:commitment",
      label: "Let the commitment drift",
      legalBacking: selectedLegalBacking,
      planKey: `${pressureId}:drop`,
      rationale: "Walking away would risk the work window and Rowan's reliability.",
      reason: "No current state says the accepted work is impossible.",
      score: 25,
      status: "rejected",
    },
  ];
}

function resolveObjectiveLoopStep(world: StreetGameState): RowanLoopStep {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return {
      autoContinue: false,
      detail: "Choose where Rowan should go or what he should do next.",
      key: `idle:${world.clock.totalMinutes}`,
      kind: "idle",
      label: "Choose a direction",
      layer: "idle",
    };
  }

  if (isCurrentObjectiveComplete(world)) {
    const completionIdleCopy = objectiveRouteCompletionIdleCopy(
      world,
      objective,
    );

    return {
      autoContinue: false,
      detail:
        completionIdleCopy?.detail ??
        "Rowan has checked off this objective. Set a new direction when you want to keep going.",
      effects: ["memory", "objective"],
      key: `complete:${world.player.objective?.routeKey ?? "objective"}:${world.player.objective?.updatedAt ?? world.currentTime}:${world.firstAfternoon?.completedAt ?? "done"}`,
      kind: "idle",
      label: completionIdleCopy?.label ?? "Objective complete",
      layer: "objective",
      objective,
    };
  }

  const planning = chooseObjectivePlan(world);
  if (!planning.plan) {
    return {
      autoContinue: false,
      detail:
        "Rowan has exhausted the obvious next steps here and needs a fresher lead, a different route, or a more specific objective.",
      key: `blocked:${objective.routeKey}:${world.player.currentLocationId ?? "none"}:${world.clock.totalMinutes}`,
      kind: "blocked",
      label: "Needs a fresher lead",
      layer: "objective",
      objective,
      planningTrace: planning.trace,
    };
  }

  return objectivePlanToLoopStep(world, objective, planning.plan, planning.trace);
}

async function resolveAiPlannedObjectiveLoopStep(
  world: StreetGameState,
  aiProvider: AIProvider,
  deterministicLoopStep: RowanLoopStep,
): Promise<RowanLoopStep | undefined> {
  if (!shouldUseStreetPlanner(aiProvider, deterministicLoopStep)) {
    return undefined;
  }

  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return undefined;
  }

  const choices = buildStreetPlannerChoices(world, deterministicLoopStep, objective);
  if (choices.length === 0) {
    return undefined;
  }

  const allowedActions = dedupePlannerActions(
    choices.map((choice) => choice.plannerAction),
  );
  const planned = await aiProvider.planStreetNextAction({
    allowedActions: structuredClone(allowedActions),
    desiredOutcomes: buildStreetPlanningOutcomes(world, objective),
    game: world,
    objective,
  });
  const choice = selectPlannerChoice(planned, choices);
  if (!choice || !planned) {
    return undefined;
  }

  return objectivePlanToLoopStep(
    world,
    objective,
    choice,
    buildObjectivePlanningTrace(world, objective, choice, choices, {
      confidence: planned.confidence,
      model: aiProvider.model,
      provider: aiProvider.name,
      rationale: planned.rationale,
      sourceKind: "live-llm",
    }),
  );
}

function shouldUseStreetPlanner(
  aiProvider: AIProvider,
  loopStep: RowanLoopStep,
) {
  return (
    aiProvider.name === "openai" &&
    loopStep.layer === "objective" &&
    loopStep.autoContinue &&
    loopStep.kind !== "idle" &&
    loopStep.kind !== "blocked"
  );
}

function objectivePlanToLoopStep(
  world: StreetGameState,
  objective: ObjectiveDirective,
  plan: ObjectivePlan,
  planningTrace?: RowanPlanningTrace,
): RowanLoopStep {
  const targetLocation =
    plan.targetLocationId !== undefined
      ? findLocation(world, plan.targetLocationId)
      : undefined;
  const currentActionId = currentPlannerActionIdForPlan(world, plan);
  const isPortalAction =
    currentActionId?.startsWith("enter:") ||
    currentActionId?.startsWith("exit:");
  const label = isPortalAction && currentActionId
    ? autonomyLabelForAction(world, currentActionId)
    : autonomyLabelForNextBeat(world, plan);
  const detail = isPortalAction && currentActionId
    ? autonomyDetailForAction(
        world,
        currentActionId,
        plan.rationale || objective.text,
      )
    : autonomyDetailForObjectivePlan(world, plan, objective.text);
  const key = `plan:${[
    objective.routeKey,
    plan.targetLocationId ?? "here",
    plan.actionId ?? "no-action",
    plan.npcId ?? "no-npc",
    plan.waitUntilMinutes ?? "no-wait",
    loopKindForObjectivePlan(world, plan),
  ].join(":")}`;

  if (isPortalAction) {
    return {
      actionId: currentActionId,
      autoContinue: true,
      detail,
      key,
      kind: "act",
      label,
      layer: "objective",
      objective,
      planningTrace,
      targetLocationId: plan.targetLocationId,
    };
  }

  if (targetLocation && world.player.currentLocationId !== targetLocation.id) {
    return {
      actionId: currentActionId,
      autoContinue: true,
      detail,
      key,
      kind: "move",
      label,
      layer: "objective",
      npcId: plan.npcId,
      objective,
      planningTrace,
      speech: plan.speech,
      targetLocationId: plan.targetLocationId,
    };
  }

  if (plan.npcId) {
    return {
      actionId: plan.actionId,
      autoContinue: true,
      detail,
      effects: ["conversation"],
      key,
      kind: "talk",
      label,
      layer: "objective",
      npcId: plan.npcId,
      objective,
      planningTrace,
      speech: plan.speech,
      targetLocationId: plan.targetLocationId,
    };
  }

  if (plan.waitUntilMinutes !== undefined) {
    return {
      actionId: plan.actionId,
      autoContinue: true,
      detail,
      effects: ["thought"],
      key,
      kind: "wait",
      label,
      layer: "objective",
      objective,
      planningTrace,
      targetLocationId: plan.targetLocationId,
      waitUntilMinutes: plan.waitUntilMinutes,
    };
  }

  if (plan.actionId) {
    return {
      actionId: plan.actionId,
      autoContinue: true,
      detail,
      effects: isTimeSkippingAction(plan.actionId) ? ["thought"] : undefined,
      key,
      kind: isTimeSkippingAction(plan.actionId) ? "wait" : "act",
      label,
      layer: "objective",
      objective,
      planningTrace,
      targetLocationId: plan.targetLocationId,
    };
  }

  return {
    autoContinue: true,
    detail,
    effects: ["thought"],
    key,
    kind: "observe",
    label,
    layer: "objective",
    objective,
    planningTrace,
    targetLocationId: plan.targetLocationId,
  };
}

function buildStreetPlannerChoices(
  world: StreetGameState,
  deterministicLoopStep: RowanLoopStep,
  objective: ObjectiveDirective,
): ObjectivePlanChoice[] {
  const choices: ObjectivePlanChoice[] = [];

  for (const plan of buildObjectiveAgentPlanCandidates(world, objective, {
    includeLowScoringActions: false,
  })) {
    if (!plannerChoiceCanExecute(world, objective, plan)) {
      continue;
    }
    addPlannerChoice(world, choices, plan);
  }

  const deterministicPlan = loopStepToObjectivePlan(deterministicLoopStep);
  if (!plannerChoiceCanExecute(world, objective, deterministicPlan)) {
    return choices;
  }

  addPlannerChoice(
    world,
    choices,
    deterministicPlan,
  );

  return choices;
}

function plannerChoiceCanExecute(
  world: StreetGameState,
  objective: ObjectiveDirective,
  plan: ObjectivePlan,
) {
  const pressure = dominantObjectivePlanningPressure(world, objective);
  if (pressure && pressureRequiresFocusedPlan(pressure)) {
    return planMatchesObjectivePlanningPressure(world, plan, pressure);
  }

  const currentPredicateActionId = currentOpenPredicateActionId(world);
  if (currentPredicateActionId) {
    return planMatchesExactActionAtLocation(
      world,
      plan,
      currentPredicateActionId,
    );
  }

  return true;
}

function addPlannerChoice(
  world: StreetGameState,
  choices: ObjectivePlanChoice[],
  plan: ObjectivePlan | undefined,
) {
  const plannerAction = plan ? plannerActionForPlan(world, plan) : undefined;
  if (!plan || !plannerAction) {
    return;
  }

  if (
    choices.some(
      (choice) => choice.plannerAction.planKey === plannerAction.planKey,
    )
  ) {
    return;
  }

  choices.push({
    ...plan,
    plannerAction,
  });
}

function plannerActionForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
): StreetPlanningAllowedAction | undefined {
  const actionId = currentPlannerActionIdForPlan(world, plan);
  if (!actionId) {
    return undefined;
  }

  const pressureMatch = bestObjectivePlanningPressureMatch(
    world,
    currentObjectiveDirective(world),
    plan,
  );

  return {
    actionId,
    description: plan.rationale,
    kind: plannerKindForActionId(actionId, plan),
    label: autonomyLabelForNextBeat(world, plan),
    matchedOutcomeId: pressureMatch?.pressure.matchedOutcomeId,
    npcId: plan.npcId,
    planKey: objectivePlanTraceKey(world, plan),
    pressureId: pressureMatch?.pressure.id,
    pressureKind: pressureMatch?.pressure.kind,
    pressureLabel: pressureMatch?.pressure.label,
    targetLocationId: plan.targetLocationId,
  };
}

function currentPlannerActionIdForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
) {
  const space = activeSpace(world);
  if (
    space.kind === "interior" &&
    plan.targetLocationId &&
    plan.targetLocationId !== space.locationId &&
    space.locationId
  ) {
    return `exit:${space.locationId}`;
  }

  if (planRequiresMove(world, plan) && plan.targetLocationId) {
    return `move:${plan.targetLocationId}`;
  }

  if (planRequiresInteriorEntry(world, plan)) {
    return `enter:${plan.targetLocationId}`;
  }

  return plannerActionIdForPlan(plan);
}

function planRequiresMove(world: StreetGameState, plan: ObjectivePlan) {
  return Boolean(
    plan.targetLocationId &&
      plan.targetLocationId !== world.player.currentLocationId,
  );
}

function planRequiresInteriorEntry(
  world: StreetGameState,
  plan: ObjectivePlan,
) {
  const targetLocationId = plan.targetLocationId;
  if (!targetLocationId || targetLocationId !== world.player.currentLocationId) {
    return false;
  }

  const interiorSpaceId = interiorSpaceIdForLocation(targetLocationId);
  return Boolean(interiorSpaceId && activeSpaceId(world) !== interiorSpaceId);
}

function plannerActionIdForPlan(plan: ObjectivePlan) {
  if (plan.actionId) {
    return plan.actionId;
  }

  if (plan.waitUntilMinutes !== undefined) {
    return `wait:${plan.waitUntilMinutes}`;
  }

  if (plan.npcId) {
    return `talk:${plan.npcId}`;
  }

  if (plan.targetLocationId) {
    return `move:${plan.targetLocationId}`;
  }

  return undefined;
}

function plannerKindForPlan(
  plan: ObjectivePlan,
): StreetPlanningAllowedAction["kind"] {
  if (plan.waitUntilMinutes !== undefined) {
    return "wait";
  }

  if (!plan.actionId) {
    return plan.npcId ? "talk" : plan.targetLocationId ? "move" : "observe";
  }

  const [kind] = plan.actionId.split(":");
  switch (kind) {
    case "talk":
      return "talk";
    case "accept":
      return "accept_job";
    case "work":
    case "resume":
      return "work_job";
    case "solve":
      return "solve";
    case "inspect":
      return "inspect";
    case "buy":
      return "buy";
    case "enter":
      return "enter";
    case "exit":
      return "exit";
    case "contribute":
      return "contribute";
    case "rest":
      return "rest";
    case "reflect":
      return "reflect";
    default:
      return "observe";
  }
}

function plannerKindForActionId(
  actionId: string,
  plan: ObjectivePlan,
): StreetPlanningAllowedAction["kind"] {
  if (actionId.startsWith("move:")) {
    return "move";
  }

  if (actionId.startsWith("talk:")) {
    return "talk";
  }

  if (actionId.startsWith("wait:")) {
    return "wait";
  }

  return plannerKindForPlan({ ...plan, actionId });
}

function dedupePlannerActions(actions: StreetPlanningAllowedAction[]) {
  return [...new Map(actions.map((action) => [action.planKey, action])).values()];
}

function selectPlannerChoice(
  planned: StreetPlanningResult | null,
  choices: ObjectivePlanChoice[],
): ObjectivePlanChoice | undefined {
  if (!planned || planned.confidence < MIN_STREET_PLANNER_CONFIDENCE) {
    return undefined;
  }

  const choice = planned.planKey
    ? choices.find((candidate) => candidate.plannerAction.planKey === planned.planKey)
    : uniquePlannerChoiceForActionId(choices, planned.actionId);
  if (!choice) {
    return undefined;
  }

  return {
    ...choice,
    rationale: planned.rationale || choice.rationale,
  };
}

function uniquePlannerChoiceForActionId(
  choices: ObjectivePlanChoice[],
  actionId: string,
) {
  const matches = choices.filter(
    (candidate) => candidate.plannerAction.actionId === actionId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function buildMovementFeedText(
  world: StreetGameState,
  targetLocation: LocationState,
  plan: ObjectivePlan,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const rawPurpose = planMovementPurpose(world, plan, objective);
  const destinationPrefix = `${targetLocation.name.toLowerCase()} is tied to the current obligation`;
  const purpose =
    rawPurpose.toLowerCase().startsWith(destinationPrefix)
      ? rawPurpose.slice(destinationPrefix.length).replace(/^[:\s]+/, "")
      : rawPurpose;
  const detail = purpose.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");

  return detail
    ? `Rowan heads to ${targetLocation.name}: ${detail}.`
    : `Rowan heads to ${targetLocation.name}.`;
}

async function executeRowanMoveLoopStep(
  world: StreetGameState,
  loopStep: RowanLoopStep,
  aiProvider: AIProvider,
  options: { confirmMove?: boolean } = {},
) {
  const targetLocation = loopStep.targetLocationId
    ? findLocation(world, loopStep.targetLocationId)
    : undefined;
  if (!targetLocation) {
    return;
  }

  const objective =
    loopStep.objective ??
    currentObjectiveDirective(world) ??
    fallbackConversationObjective(world);
  const plan = loopStepToObjectivePlan(loopStep);

  if (
    !options.confirmMove &&
    !pendingObjectiveMoveMatches(world, objective.text, targetLocation.id, plan)
  ) {
    queuePendingObjectiveMove(
      world,
      objective.text,
      plan,
      targetLocation.id,
      loopStep.planningTrace,
    );
    addFeed(
      world,
      "info",
      `Rowan sets a course for ${targetLocation.name}.`,
    );
    return "deterministic" as const;
  }

  clearPendingObjectiveMove(world);
  addFeed(
    world,
    "info",
    buildMovementFeedText(world, targetLocation, plan, objective),
  );
  movePlayer(world, targetLocation.entryX, targetLocation.entryY);
  syncNpcInnerState(world);
  if (loopStep.npcId && loopStep.speech) {
    await conductAutonomousConversation(
      world,
      loopStep.npcId,
      loopStep.speech,
      objective,
      aiProvider,
    );
    return;
  }

  world.player.currentThought = arrivalThought(world, plan, targetLocation.id);
  return "deterministic" as const;
}

async function executeRowanActionLoopStep(
  world: StreetGameState,
  loopStep: RowanLoopStep,
  aiProvider: AIProvider,
  options: {
    allowTimeSkip: boolean;
  },
) {
  if (loopStep.kind === "wait" && loopStep.waitUntilMinutes !== undefined) {
    if (!options.allowTimeSkip) {
      if (loopStep.actionId) {
        setLongActionThought(world, loopStep.actionId);
      } else {
        world.player.currentThought = loopStep.detail;
      }
      return;
    }

    const minutesToAdvance = Math.max(
      loopStep.waitUntilMinutes - world.clock.totalMinutes,
      0,
    );
    if (minutesToAdvance > 0) {
      advanceWorld(world, minutesToAdvance);
      addFeed(world, "info", loopStep.detail);
    }

    if (loopStep.actionId?.startsWith("resume:")) {
      await performAction(world, loopStep.actionId, aiProvider);
    }

    return advanceObjective(world, aiProvider, options);
  }

  if (!loopStep.actionId) {
    return;
  }

  if (loopStep.kind === "wait" && !options.allowTimeSkip) {
    setLongActionThought(world, loopStep.actionId);
    return;
  }

  await performAction(world, loopStep.actionId, aiProvider);
}

async function executeRowanReflectLoopStep(
  world: StreetGameState,
  loopStep: RowanLoopStep,
) {
  if (loopStep.layer !== "conversation" || !world.activeConversation) {
    world.player.currentThought = loopStep.detail;
    return "deterministic" as const;
  }

  const npc = npcById(world, world.activeConversation.npcId);
  const hadResolution = Boolean(
    world.activeConversation.decision || world.activeConversation.objectiveText,
  );
  clearActiveConversation(world);

  addFeed(
    world,
    "info",
    hadResolution
      ? `Rowan leaves ${npc?.name ?? "the conversation"} with enough to act on.`
      : `The conversation with ${npc?.name ?? "them"} quiets down, and Rowan turns back toward the day.`,
  );

  world.player.objective = buildPlayerObjectiveState(world, {
    previous: world.player.objective,
  });
  world.currentScene = buildScene(world);
  world.availableActions = buildAvailableActions(world);
  world.player.currentThought = hadResolution
    ? `That gives Rowan the next step: ${world.player.objective?.text ?? "keep going"}.`
    : loopStep.detail;
  return "deterministic" as const;
}

function loopStepToObjectivePlan(loopStep: RowanLoopStep): ObjectivePlan {
  return {
    actionId: loopStep.actionId,
    npcId: loopStep.npcId,
    rationale: loopStep.detail,
    score: 0,
    speech: loopStep.speech,
    targetLocationId: loopStep.targetLocationId,
    waitUntilMinutes: loopStep.waitUntilMinutes,
  };
}

function loopKindForObjectivePlan(
  world: StreetGameState,
  plan: ObjectivePlan,
): RowanAutonomyStepKind {
  const currentActionId = currentPlannerActionIdForPlan(world, plan);
  if (
    currentActionId?.startsWith("enter:") ||
    currentActionId?.startsWith("exit:")
  ) {
    return "act";
  }

  const targetLocation =
    plan.targetLocationId !== undefined
      ? findLocation(world, plan.targetLocationId)
      : undefined;

  if (targetLocation && world.player.currentLocationId !== targetLocation.id) {
    return "move";
  }

  if (plan.npcId) {
    return "talk";
  }

  if (plan.waitUntilMinutes !== undefined) {
    return "wait";
  }

  if (plan.actionId) {
    return isTimeSkippingAction(plan.actionId) ? "wait" : "act";
  }

  return "observe";
}

function clearPendingObjectiveMove(world: StreetGameState) {
  world.player.pendingObjectiveMove = undefined;
}

function queuePendingObjectiveMove(
  world: StreetGameState,
  objectiveText: string,
  plan: ObjectivePlan,
  targetLocationId: string,
  planningTrace?: RowanPlanningTrace,
) {
  world.player.pendingObjectiveMove = {
    targetLocationId,
    objectiveText,
    rationale: plan.rationale,
    npcId: plan.npcId,
    actionId: currentPlannerActionIdForPlan(world, plan),
    planningTrace,
    speech: plan.speech,
    preparedAt: isoFor(world.clock.totalMinutes),
  };
}

function pendingObjectiveMoveMatches(
  world: StreetGameState,
  objectiveText: string,
  targetLocationId: string,
  plan: ObjectivePlan,
) {
  const pendingMove = world.player.pendingObjectiveMove;
  if (!pendingMove) {
    return false;
  }

  return (
    pendingMove.targetLocationId === targetLocationId &&
    pendingMove.objectiveText === objectiveText &&
    pendingMove.npcId === plan.npcId &&
    pendingMove.actionId === currentPlannerActionIdForPlan(world, plan)
  );
}

function pendingObjectiveMoveStillViable(
  world: StreetGameState,
  pendingMove: PendingObjectiveMove,
) {
  if (!findLocation(world, pendingMove.targetLocationId)) {
    return false;
  }

  const actionReferences = [
    ...pendingObjectiveMoveActionReferences(pendingMove),
    ...legacyPendingObjectiveMoveActionReferences(world, pendingMove),
  ];

  if (
    actionReferences.some(
      (reference) =>
        !pendingObjectiveMoveActionReferenceStillLive(
          world,
          pendingMove,
          reference,
        ),
    )
  ) {
    return false;
  }

  return pendingObjectiveMovePressureIds(pendingMove).every((pressureId) =>
    pendingObjectiveMovePressureStillLive(world, pressureId),
  );
}

function pendingObjectiveMoveActionReferences(
  pendingMove: PendingObjectiveMove,
) {
  const references: PendingMoveActionReference[] = [];
  const addReference = (
    actionId: string | undefined,
    targetLocationId: string | undefined,
    npcId?: string,
  ) => {
    const resolvedActionId = actionId ?? (npcId ? `talk:${npcId}` : undefined);
    if (!resolvedActionId || resolvedActionId.startsWith("move:")) {
      return;
    }

    references.push({
      actionId: resolvedActionId,
      targetLocationId,
      npcId,
    });
  };

  addReference(
    pendingMove.actionId,
    pendingMove.targetLocationId,
    pendingMove.npcId,
  );

  const trace = pendingMove.planningTrace;
  addReference(
    trace?.plannerIntent?.actionId,
    trace?.plannerIntent?.targetLocationId,
    trace?.plannerIntent?.npcId,
  );
  addReference(
    trace?.immediateAction?.actionId,
    trace?.immediateAction?.targetLocationId,
    trace?.immediateAction?.npcId,
  );
  addReference(
    trace?.intendedFollowUp?.actionId,
    trace?.intendedFollowUp?.targetLocationId,
    trace?.intendedFollowUp?.npcId,
  );

  for (const option of trace?.considered ?? []) {
    if (option.status === "selected") {
      addReference(option.actionId, option.targetLocationId, option.npcId);
    }
  }

  return dedupePendingMoveActionReferences(references);
}

function legacyPendingObjectiveMoveActionReferences(
  world: StreetGameState,
  pendingMove: PendingObjectiveMove,
) {
  if (pendingMove.planningTrace) {
    return [];
  }

  const objective = world.player.objective;
  if (!objective || objective.text !== pendingMove.objectiveText) {
    return [];
  }

  const outcomeReferences = legacyPendingObjectiveMoveReferencesFromCandidates(
    world,
    pendingMove,
    objective.outcomes
      .filter((outcome) => !hasLegacyTrailOutcomeAuthority(outcome))
      .map((outcome) => ({
        actionId: outcome.actionId,
        current: objectiveOutcomeIsStillCurrent(outcome),
        npcId: outcome.npcId,
        targetLocationId: outcome.targetLocationId,
      })),
  );
  if (outcomeReferences.length > 0) {
    return outcomeReferences;
  }

  return legacyPendingObjectiveMoveReferencesFromCandidates(
    world,
    pendingMove,
    objective.trail.map((trailItem) => ({
      actionId: trailItem.actionId,
      current: !trailItem.done,
      npcId: trailItem.npcId,
      targetLocationId: trailItem.targetLocationId,
    })),
  );
}

function legacyPendingObjectiveMoveReferencesFromCandidates(
  world: StreetGameState,
  pendingMove: PendingObjectiveMove,
  candidates: {
    actionId?: string;
    current: boolean;
    npcId?: string;
    targetLocationId?: string;
  }[],
) {
  const references: PendingMoveActionReference[] = [];
  for (const candidate of candidates) {
    const actionId =
      candidate.actionId ??
      (candidate.npcId ? `talk:${candidate.npcId}` : undefined);
    const targetLocationId =
      candidate.targetLocationId ??
      (actionId ? targetLocationIdForActionId(world, actionId) : undefined);
    if (targetLocationId !== pendingMove.targetLocationId) {
      continue;
    }

    if (!actionId || actionId.startsWith("move:")) {
      if (candidate.current === false) {
        references.push({
          actionId:
            pendingMove.actionId ?? `move:${pendingMove.targetLocationId}`,
          current: false,
          targetLocationId,
          npcId: candidate.npcId,
        });
      }
      continue;
    }

    references.push({
      actionId,
      current: candidate.current,
      targetLocationId,
      npcId: candidate.npcId,
    });
  }

  return dedupePendingMoveActionReferences(references);
}

function objectiveOutcomeIsStillCurrent(outcome: ObjectiveOutcomeState) {
  return outcome.status !== "met" && outcome.status !== "failed";
}

function dedupePendingMoveActionReferences(
  references: PendingMoveActionReference[],
) {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = [
      reference.actionId,
      reference.current === false ? "not-current" : "current",
      reference.targetLocationId ?? "no-location",
      reference.npcId ?? "no-npc",
    ].join("|");
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function pendingObjectiveMoveActionReferenceStillLive(
  world: StreetGameState,
  pendingMove: PendingObjectiveMove,
  reference: PendingMoveActionReference,
) {
  if (reference.current === false) {
    return false;
  }

  const targetLocationId =
    reference.targetLocationId ?? pendingMove.targetLocationId;
  const liveTargetLocationId = targetLocationIdForActionId(
    world,
    reference.actionId,
  );

  if (
    liveTargetLocationId &&
    targetLocationId &&
    liveTargetLocationId !== targetLocationId
  ) {
    return false;
  }

  if (
    !pendingObjectiveMoveEntityStillLive(
      world,
      reference.actionId,
      targetLocationId,
    )
  ) {
    return false;
  }

  const preview = previewWorldAtLocation(world, targetLocationId);
  return buildAvailableActions(preview).some(
    (action) => action.id === reference.actionId && !action.disabled,
  );
}

function pendingObjectiveMoveEntityStillLive(
  world: StreetGameState,
  actionId: string,
  targetLocationId: string,
) {
  const [kind, targetId] = actionId.split(":");
  if (!targetId) {
    return false;
  }

  switch (kind) {
    case "accept":
    case "work":
    case "resume": {
      const job = jobById(world, targetId);
      return Boolean(
        job &&
          job.locationId === targetLocationId &&
          !job.completed &&
          !job.missed,
      );
    }
    case "inspect":
    case "solve": {
      const problem = problemById(world, targetId);
      return Boolean(
        problem &&
          problem.locationId === targetLocationId &&
          problem.status === "active",
      );
    }
    case "talk": {
      const npc = npcById(world, targetId);
      return Boolean(npc && npc.currentLocationId === targetLocationId);
    }
    default:
      return true;
  }
}

function pendingObjectiveMovePressureIds(
  pendingMove: PendingObjectiveMove,
) {
  return [
    pendingMove.planningTrace?.selectedPressureId,
    pendingMove.planningTrace?.plannerIntent?.pressureId,
    ...((pendingMove.planningTrace?.considered ?? [])
      .filter((option) => option.status === "selected")
      .map((option) => option.pressureId)),
  ].filter((pressureId): pressureId is string => Boolean(pressureId));
}

function pendingObjectiveMovePressureStillLive(
  world: StreetGameState,
  pressureId: string,
) {
  const [kind, targetId, linkedId] = pressureId.split(":");

  switch (kind) {
    case "job": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return jobWindowOpen(world, job);
    }
    case "problem": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      return problem?.status === "active";
    }
    case "tool": {
      const problemId = linkedId?.startsWith("problem-")
        ? linkedId
        : undefined;
      const problem = problemId ? problemById(world, problemId) : undefined;
      return !problemId || problem?.status === "active";
    }
    default:
      return true;
  }
}

function reconcilePendingObjectiveMove(world: StreetGameState) {
  const pendingMove = world.player.pendingObjectiveMove;
  if (!pendingMove) {
    return;
  }

  const objective = currentObjectiveDirective(world);
  if (
    !objective ||
    pendingMove.objectiveText !== objective.text ||
    pendingMove.targetLocationId === world.player.currentLocationId ||
    !pendingObjectiveMoveStillViable(world, pendingMove)
  ) {
    clearPendingObjectiveMove(world);
  }
}

function reconcileActiveConversation(world: StreetGameState) {
  const activeConversation = world.activeConversation;
  if (!activeConversation) {
    return;
  }

  if (activeConversation.decision || activeConversation.objectiveText) {
    return;
  }

  const npc = npcById(world, activeConversation.npcId);
  if (!npc) {
    clearActiveConversation(world);
    return;
  }

  if (
    !world.player.currentLocationId ||
    npc.currentLocationId !== world.player.currentLocationId
  ) {
    clearActiveConversation(world);
    return;
  }

  const lastNpcReply = latestNpcReplyFromConversation(activeConversation.lines);
  if (!lastNpcReply) {
    clearActiveConversation(world);
    return;
  }

  const objective = currentConversationObjective(world);
  const discussedTopics = collectConversationTopics(activeConversation.lines);
  const provisionalResolution = deriveConversationResolution(
    world,
    npc,
    objective,
    lastNpcReply,
    discussedTopics,
  );

  if (
    !shouldContinueConversation(
      world,
      npc,
      objective,
      lastNpcReply,
      discussedTopics,
      provisionalResolution,
    )
  ) {
    clearActiveConversation(world);
  }
}

function primeNpcConversation(world: StreetGameState, npc: NpcState) {
  ensureNpcKnown(world, npc);
  npc.lastInteractionAt = isoFor(world.clock.totalMinutes);

  if (countPlayerConversationsWithNpc(world, npc.id) > 0) {
    return;
  }

  const primer = getNpcFirstContactPrimer(npc.id);
  if (!primer) {
    return;
  }

  addFeed(world, "info", primer.feed);
  rememberIfNew(world, "person", primer.memory);
}

function fallbackConversationObjective(world: StreetGameState) {
  const text =
    world.player.objective?.text ??
    "Get settled in Brackenport: find a place to stay, steady income, and a few friends.";

  return {
    text,
    focus: classifyObjective(text),
    routeKey: world.player.objective?.routeKey ?? "settle-core",
  };
}

function currentConversationObjective(world: StreetGameState) {
  return (
    currentObjectiveDirective(world) ?? fallbackConversationObjective(world)
  );
}

function collectConversationTopics(
  lines: Array<Pick<ConversationEntry, "text">>,
) {
  const topics = new Set<string>();

  for (const line of lines) {
    for (const topic of detectConversationTopics(line.text)) {
      topics.add(topic);
    }
  }

  return topics;
}

function latestNpcReplyFromConversation(
  lines: Array<Pick<ConversationEntry, "speaker" | "text">>,
) {
  return [...lines].reverse().find((line) => line.speaker === "npc")?.text;
}

function sanitizeConversationResolutionForVisibleEvidence(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  resolution: ConversationResolution,
  closingReply: string,
): ConversationResolution {
  const groundingPolicy = objectiveRouteConversationGroundingPolicy(
    world,
    objective,
    npc,
    "",
  );

  if (
    !groundingPolicy ||
    !objectiveRouteConversationResolutionPointsToPolicy(
      groundingPolicy,
      resolution,
    ) ||
    objectiveRouteConversationHasVisibleEvidence(
      world,
      groundingPolicy,
      closingReply,
    )
  ) {
    return resolution;
  }

  recordAIRuntimePolicyFallback(
    world,
    "interpretStreetConversation",
    "Conversation interpretation did not have scaffold-required visible evidence.",
  );

  return groundingPolicy.resolutionFallback;
}

function shouldContinueConversation(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  closingReply: string,
  discussedTopics: Set<string>,
  resolution: ConversationResolution,
) {
  return shouldAskAutonomousFollowup(
    world,
    npc,
    objective,
    closingReply,
    discussedTopics,
    resolution,
  );
}

async function runConversationLoop(
  world: StreetGameState,
  npc: NpcState,
  location: LocationState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  openingText: string,
  aiProvider: AIProvider,
  options: ConversationLoopOptions = {},
) {
  const maxAutonomousFollowups = options.maxAutonomousFollowups ?? 0;
  let remainingAutonomousFollowups = maxAutonomousFollowups;
  let trustOpened = false;
  let closingReply = "";
  let discussedTopics = new Set<string>();
  let resolution: ConversationResolution = {};
  let nextPlayerText = openingText;

  while (nextPlayerText) {
    const turn = await performConversationTurn(
      world,
      npc,
      location.id,
      nextPlayerText,
      aiProvider,
    );
    if (options.surfaceNpcRepliesInFeed) {
      addFeed(world, "info", `${npc.name}: ${turn.npcReply}`);
    }

    trustOpened = trustOpened || turn.trustDelta > 0;
    closingReply = turn.npcReply;
    turn.topics.forEach((topic) => {
      discussedTopics.add(topic);
    });
    resolution = await resolveConversationResolution(
      world,
      npc,
      objective,
      closingReply,
      discussedTopics,
      aiProvider,
    );

    if (
      remainingAutonomousFollowups <= 0 ||
      !shouldContinueConversation(
        world,
        npc,
        objective,
        closingReply,
        discussedTopics,
        resolution,
      )
    ) {
      break;
    }

    remainingAutonomousFollowups -= 1;
    nextPlayerText = await generateAutonomousContinuation(
      world,
      npc,
      objective,
      closingReply,
      aiProvider,
    );
  }

  const conversationCanContinue =
    Boolean(closingReply) &&
    shouldContinueConversation(
      world,
      npc,
      objective,
      closingReply,
      discussedTopics,
      resolution,
    );
  const outcome = applyConversationResolution(
    world,
    npc,
    location,
    objective,
    resolution,
    {
      closingReply,
      trustOpened,
    },
  );

  if (outcome.feedTone && outcome.feedText) {
    addFeed(world, outcome.feedTone, outcome.feedText);
  } else if (options.addFallbackFeed) {
    addFeed(
      world,
      "info",
      `Rowan and ${npc.name} trade a few direct words, then the block keeps moving.`,
    );
  }

  if (
    !resolution.decision &&
    !resolution.objectiveText &&
    !conversationCanContinue
  ) {
    clearActiveConversation(world);
  }

  return {
    conversationCanContinue,
    resolution,
  };
}

async function continueActiveConversation(
  world: StreetGameState,
  aiProvider: AIProvider,
) {
  const activeConversation = world.activeConversation;
  if (!activeConversation) {
    return;
  }

  const target = resolveConversationTarget(world, activeConversation.npcId);
  if (!target) {
    clearActiveConversation(world);
    return;
  }

  const objective = currentConversationObjective(world);
  const lastNpcReply = latestNpcReplyFromConversation(activeConversation.lines);
  if (!lastNpcReply) {
    clearActiveConversation(world);
    return;
  }

  const followup = await generateAutonomousContinuation(
    world,
    target.npc,
    objective,
    lastNpcReply,
    aiProvider,
  );

  if (!followup) {
    clearActiveConversation(world);
    return "deterministic" as const;
  }

  await runConversationLoop(
    world,
    target.npc,
    target.location,
    objective,
    followup,
    aiProvider,
    {
      maxAutonomousFollowups: 0,
    },
  );
  return "deterministic" as const;
}

async function talkToNpc(
  world: StreetGameState,
  npcId: string,
  aiProvider: AIProvider,
): Promise<void> {
  const target = resolveConversationTarget(world, npcId);
  if (!target) {
    return;
  }

  const { npc, location } = target;
  primeNpcConversation(world, npc);
  const objective = currentConversationObjective(world);
  const opener = await generateAutonomousSpeech(
    world,
    npc,
    objective,
    aiProvider,
  );

  await conductAutonomousConversation(
    world,
    npc.id,
    opener,
    objective,
    aiProvider,
  );
}

async function speakToNpc(
  world: StreetGameState,
  npcId: string,
  rawText: string,
  aiProvider: AIProvider,
): Promise<void> {
  const target = resolveConversationTarget(world, npcId);
  if (!target) {
    return;
  }

  const { npc, location } = target;
  const text = normalizeSpeechText(rawText);
  const objective = currentConversationObjective(world);
  if (!text) {
    addFeed(world, "info", "Say something Rowan can actually put into words.");
    return;
  }

  if (!movePlayerToNpcAnchor(world, npc)) {
    return;
  }

  primeNpcConversation(world, npc);
  await runConversationLoop(world, npc, location, objective, text, aiProvider, {
    maxAutonomousFollowups: 1,
    surfaceNpcRepliesInFeed: true,
  });
}

async function conductAutonomousConversation(
  world: StreetGameState,
  npcId: string,
  opener: string,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  aiProvider: AIProvider,
): Promise<void> {
  const npc = world.npcs.find((entry) => entry.id === npcId);
  if (!npc) {
    return;
  }

  const location = currentLocation(world);
  if (!location || !isNpcInActiveScene(world, npc)) {
    addFeed(world, "info", unavailableNpcActionReason(world, npc));
    return;
  }

  if (!movePlayerToNpcAnchor(world, npc)) {
    return;
  }

  const liveOpener =
    aiProvider.name === "openai"
      ? (
          await aiProvider.generateStreetAutonomousLine({
            game: world,
            npcId,
            objective,
            purpose: "opener",
          })
        ).speech
      : opener;

  await runConversationLoop(
    world,
    npc,
    location,
    objective,
    liveOpener,
    aiProvider,
    {
      addFallbackFeed: true,
      maxAutonomousFollowups: 1,
    },
  );
}

function buildObjectiveScriptedReply(
  world: StreetGameState,
  npc: NpcState,
  playerText: string,
): { reply: string; followupThought?: string } | undefined {
  return objectiveRouteScriptedReply(
    world,
    world.player.objective,
    npc,
    playerText,
  );
}

async function performConversationTurn(
  world: StreetGameState,
  npc: NpcState,
  locationId: string,
  rawText: string,
  aiProvider: AIProvider,
) {
  const text = normalizeSpeechText(rawText);
  if (!text) {
    return {
      npcReply: "I don't have much to add.",
      trustDelta: 0,
      topics: new Set<string>(),
    };
  }

  ensureNpcKnown(world, npc);
  recordConversation(world, {
    npcId: npc.id,
    speaker: "player",
    speakerName: world.player.name,
    text,
    locationId,
  });

  const playerTopics = detectConversationTopics(text);
  const trustDelta = updateNpcTrustFromSpeech(npc, text, playerTopics);
  syncRowanAutonomy(world);
  const generatedReply = await aiProvider.generateStreetReply({
    game: world,
    npcId: npc.id,
    playerText: text,
  });
  let reply =
    aiProvider.name === "openai"
      ? generatedReply
      : buildObjectiveScriptedReply(world, npc, text) ?? generatedReply;
  let groundingFollowupTopics = new Set<string>();
  const groundingPolicy = objectiveRouteConversationGroundingPolicy(
    world,
    world.player.objective,
    npc,
    text,
  );
  if (
    aiProvider.name === "openai" &&
    groundingPolicy &&
    !objectiveRouteTextGroundsConversationPolicy(groundingPolicy, reply.reply)
  ) {
    recordConversation(world, {
      npcId: npc.id,
      speaker: "npc",
      speakerName: npc.name,
      text: reply.reply,
      locationId,
    });

    const groundingFollowup = groundingPolicy.followupPlayerText;
    groundingFollowupTopics = detectConversationTopics(groundingFollowup);
    recordConversation(world, {
      npcId: npc.id,
      speaker: "player",
      speakerName: world.player.name,
      text: groundingFollowup,
      locationId,
    });

    const groundingReply = await aiProvider.generateStreetReply({
      game: world,
      npcId: npc.id,
      playerText: groundingFollowup,
    });
    reply = groundingReply;

    if (
      !objectiveRouteTextGroundsConversationPolicy(
        groundingPolicy,
        reply.reply,
      ) &&
      !(
        objectiveRouteTextGroundsConversationPolicy(
          groundingPolicy,
          groundingFollowup,
        ) &&
        objectiveRouteTextAffirmsConversationPolicy(
          groundingPolicy,
          reply.reply,
        )
      )
    ) {
      reply = groundingPolicy.fallbackReply;
      recordAIRuntimePolicyFallback(
        world,
        "generateStreetReply",
        groundingPolicy.fallbackReason,
      );
    }
  }
  const replyTopics = detectConversationTopics(reply.reply);
  const topics = new Set<string>([
    ...playerTopics,
    ...groundingFollowupTopics,
    ...replyTopics,
  ]);
  applyConversationRevelations(world, npc, topics);

  npc.lastSpokenLine = reply.reply;
  npc.lastInteractionAt = isoFor(world.clock.totalMinutes);
  if (reply.followupThought) {
    npc.currentThought = reply.followupThought;
  }

  recordConversation(world, {
    npcId: npc.id,
    speaker: "npc",
    speakerName: npc.name,
    text: reply.reply,
    locationId,
  });

  return {
    npcReply: reply.reply,
    trustDelta,
    topics,
  };
}

function applyConversationResolution(
  world: StreetGameState,
  npc: NpcState,
  location: LocationState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  resolution: ConversationResolution,
  options: {
    closingReply: string;
    trustOpened: boolean;
  },
) {
  if (options.trustOpened) {
    rememberIfNew(
      world,
      "person",
      `${npc.name} gave you a more open answer once you stayed plain and local.`,
    );
  }

  if (resolution.memoryKind && resolution.memoryText) {
    rememberIfNew(world, resolution.memoryKind, resolution.memoryText);
  }

  const summary = buildConversationThreadSummary(
    world,
    npc,
    location,
    resolution,
    options.closingReply,
  );
  rememberNpcIfNew(
    npc,
    resolution.npcImpression ??
      buildNpcConversationImpression({
        npcId: npc.id,
        nextMove:
          resolution.objectiveText ?? resolution.decision ?? objective.text,
        objectiveText: objective.text,
      }),
  );
  setActiveConversation(world, npc, {
    decision: resolution.decision,
    locationId: location.id,
    objectiveText: resolution.objectiveText,
    summary: resolution.summary ?? summary,
  });

  const scaffoldThought = objectiveRouteConversationThought(world, objective, npc);
  if (scaffoldThought) {
    world.player.currentThought = scaffoldThought;
  }

  if (npc.id === "npc-ada") {
    ensureFirstAfternoonLeadFieldNote(world);
  }

  const groundingPolicy = objectiveRouteConversationGroundingPolicy(
    world,
    objective,
    npc,
    "",
  );
  if (
    groundingPolicy &&
    !world.firstAfternoon?.planSettledAt &&
    objectiveRouteConversationHasVisibleEvidence(
      world,
      groundingPolicy,
      options.closingReply,
    )
  ) {
    settleFirstAfternoonPlan(world);
  }

  const objectiveUpdated =
    Boolean(resolution.objectiveText) &&
    normalizeObjectiveText(resolution.objectiveText ?? "") !==
      normalizeObjectiveText(world.player.objective?.text ?? "");
  if (objectiveUpdated && resolution.objectiveText) {
    world.player.objective = buildPlayerObjectiveState(world, {
      text: resolution.objectiveText,
      focus: classifyObjective(resolution.objectiveText),
      previous: world.player.objective,
      source: "conversation",
    });
    rememberIfNew(
      world,
      "self",
      `At ${location.name} in the ${world.clock.label.toLowerCase()}, talking with ${npc.name} clarified the next step: ${resolution.objectiveText}`,
    );
    return {
      feedText: `Rowan updates the journal after talking with ${npc.name}: ${resolution.objectiveText}`,
      feedTone: "memory" as const,
    };
  }

  if (resolution.decision) {
    return {
      feedText: `After talking with ${npc.name}, Rowan leaves with a clear next move: ${resolution.decision}`,
      feedTone: "info" as const,
    };
  }

  return {
    feedText: undefined,
    feedTone: undefined,
  };
}

function buildConversationThreadSummary(
  world: StreetGameState,
  npc: NpcState,
  location: LocationState,
  resolution: ConversationResolution,
  closingReply: string,
) {
  const moment = `${location.name} in the ${world.clock.label.toLowerCase()}`;
  if (resolution.objectiveText) {
    return `${npc.name} helped narrow Rowan's day down at ${moment}: ${resolution.objectiveText}`;
  }

  if (resolution.decision) {
    return `${npc.name} pointed Rowan toward the next move at ${moment}: ${resolution.decision}`;
  }

  const trimmedReply = closingReply.replace(/\s+/g, " ").trim();
  return `${npc.name} at ${moment}: ${trimmedReply}`;
}

function deriveRowanAutonomy(world: StreetGameState) {
  return rowanAutonomyFromLoopStep(resolveRowanLoopStep(world));
}

function syncRowanAutonomy(world: StreetGameState) {
  world.rowanAutonomy = deriveRowanAutonomy(world);
}

function autonomyLabelForNextBeat(
  world: StreetGameState,
  plan: Pick<
    ObjectivePlan,
    "actionId" | "npcId" | "targetLocationId" | "waitUntilMinutes"
  >,
) {
  const targetLocation =
    plan.targetLocationId !== undefined
      ? findLocation(world, plan.targetLocationId)
      : undefined;

  if (planIsNiaRecoveryBeat(world, plan)) {
    return "Recover before following Nia";
  }

  if (targetLocation && world.player.currentLocationId !== targetLocation.id) {
    return (
      objectivePlanMoveLabelForLocation(world, plan, targetLocation) ??
      `Head to ${targetLocation.name}`
    );
  }

  if (plan.npcId) {
    const npc = npcById(world, plan.npcId);
    return `Talk to ${npc?.name ?? "someone nearby"}`;
  }

  if (plan.waitUntilMinutes !== undefined) {
    return `Wait until ${formatClockAt(world, plan.waitUntilMinutes)}`;
  }

  if (plan.actionId) {
    return autonomyLabelForAction(world, plan.actionId);
  }

  if (targetLocation) {
    return `Read ${targetLocation.name}`;
  }

  return "Carry the objective forward";
}

function objectiveRouteMoveLabelForLocation(
  world: StreetGameState,
  location: LocationState,
) {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return undefined;
  }

  return objectiveRouteMoveIntent(world, objective, location.id)?.label;
}

function objectivePlanMoveLabelForLocation(
  world: StreetGameState,
  plan: Pick<ObjectivePlan, "actionId" | "npcId" | "targetLocationId">,
  location: LocationState,
) {
  const routeLabel = objectiveRouteMoveLabelForLocation(world, location);
  if (routeLabel) {
    return routeLabel;
  }

  if (location.id !== world.player.homeLocationId) {
    return undefined;
  }

  if (plan.actionId === "rest:home") {
    return "Return to Morrow House to recover";
  }

  if (plan.actionId === "reflect:first-afternoon") {
    return "Return to Morrow House to take stock";
  }

  if (plan.actionId?.startsWith("contribute:")) {
    return "Return to Morrow House to help the house";
  }

  if (plan.npcId === "npc-mara") {
    return "Return to Morrow House to talk to Mara";
  }

  return undefined;
}

function autonomyLabelForAction(world: StreetGameState, actionId: string) {
  const currentAction = world.availableActions.find(
    (action) => action.id === actionId,
  );
  if (currentAction) {
    return currentAction.label;
  }

  const [kind, targetId] = actionId.split(":");
  switch (kind) {
    case "talk": {
      const npc = targetId ? npcById(world, targetId) : undefined;
      return `Talk to ${npc?.name ?? "someone nearby"}`;
    }
    case "accept": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job ? `Take ${job.title}` : "Take the next job";
    }
    case "work":
    case "resume": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job ? `Start ${job.title}` : "Start work";
    }
    case "enter": {
      const location = targetId ? findLocation(world, targetId) : undefined;
      return `Enter ${location?.name ?? "the building"}`;
    }
    case "exit":
      return `Exit to ${world.districtName}`;
    case "solve": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      return problem ? `Solve ${problem.title}` : "Solve the problem";
    }
    case "inspect": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      return problem ? `Inspect ${problem.title}` : "Inspect the lead";
    }
    case "contribute":
      return "Handle house chores";
    case "rest":
      if (objectiveRouteHasNiaBlockLead(world)) {
        return "Recover before following Nia";
      }
      return "Rest at Morrow House";
    case "reflect":
      return "Take stock";
    default:
      return "Take the next action";
  }
}

function planIsNiaRecoveryBeat(
  world: StreetGameState,
  plan: Pick<ObjectivePlan, "actionId" | "targetLocationId">,
) {
  return (
    objectiveRouteHasNiaBlockLead(world) &&
    plan.actionId === "rest:home" &&
    plan.targetLocationId === world.player.homeLocationId
  );
}

function autonomyDetailForObjectivePlan(
  world: StreetGameState,
  plan: ObjectivePlan,
  objectiveText: string,
) {
  const rationale = playerFacingAutonomyRationale(
    world,
    normalizeAutonomyRationale(plan.rationale || objectiveText),
  );
  const targetLocation =
    plan.targetLocationId !== undefined
      ? findLocation(world, plan.targetLocationId)
      : undefined;

  if (targetLocation && world.player.currentLocationId !== targetLocation.id) {
    const routeReason = objectiveRouteMoveReasonForLocation(
      world,
      plan.targetLocationId,
      targetLocation.name,
      plan.npcId ? npcById(world, plan.npcId)?.name : undefined,
    );
    if (routeReason) {
      return routeReason;
    }

    return `${targetLocation.name} is tied to Rowan's current aim: ${normalizeAutonomyRationale(
      playerFacingAutonomyRationale(world, plan.rationale) ||
        `reach ${targetLocation.name} and keep the objective moving`,
    )}.`;
  }

  if (plan.npcId) {
    const npc = npcById(world, plan.npcId);
    return `Rowan is ready to talk to ${npc?.name ?? "someone nearby"}: ${rationale}.`;
  }

  if (plan.waitUntilMinutes !== undefined) {
    return `Rowan is letting the clock move until ${formatClockAt(
      world,
      plan.waitUntilMinutes,
    )}: ${rationale}.`;
  }

  if (plan.actionId) {
    return isTimeSkippingAction(plan.actionId)
      ? `This will take some time: ${rationale}.`
      : `Rowan can act on this now: ${rationale}.`;
  }

  return `Rowan still has a clear next step: ${rationale}.`;
}

function autonomyDetailForAction(
  world: StreetGameState,
  actionId: string,
  rationaleText: string,
) {
  const rationale = playerFacingAutonomyRationale(
    world,
    normalizeAutonomyRationale(rationaleText),
  );
  const [kind, targetId] = actionId.split(":");

  if (kind === "enter") {
    const location = targetId ? findLocation(world, targetId) : undefined;
    return `${location?.name ?? "The building"} is where Rowan can check the current aim inside: ${rationale}.`;
  }

  if (kind === "exit") {
    const location = targetId ? findLocation(world, targetId) : undefined;
    return `Rowan is done inside ${location?.name ?? "this room"} for now, so he steps back into South Quay: ${rationale}.`;
  }

  return isTimeSkippingAction(actionId)
    ? `This will take some time: ${rationale}.`
    : `Rowan can act on this now: ${rationale}.`;
}

export function playerFacingAutonomyRationale(
  world: StreetGameState,
  rationaleText: string | undefined,
) {
  const rationale = normalizeAutonomyRationale(rationaleText ?? "");
  if (!rationale) {
    return "";
  }

  const scaffoldRationale = objectiveRoutePlayerFacingAutonomyRationale(
    world,
    rationale,
  );
  if (scaffoldRationale) {
    return scaffoldRationale;
  }

  return rationale
    .replace(/move toward the open objective outcome:\s*/i, "")
    .replace(/\bcurrent objective\b/gi, "next promise")
    .replace(/\bfits the next promise\b/gi, "belongs to the next promise");
}

function buildRowanAutonomyIntent(
  world: StreetGameState,
  loopStep: RowanLoopStep,
): RowanAutonomyIntent {
  const currentLocation = world.player.currentLocationId
    ? findLocation(world, world.player.currentLocationId)
    : undefined;
  const targetLocation = loopStep.targetLocationId
    ? findLocation(world, loopStep.targetLocationId)
    : undefined;
  const npc = loopStep.npcId ? npcById(world, loopStep.npcId) : undefined;
  const objective =
    loopStep.objective ??
    currentObjectiveDirective(world) ??
    fallbackConversationObjective(world);
  const action = loopStep.actionId
    ? world.availableActions.find((candidate) => candidate.id === loopStep.actionId)
    : undefined;

  return {
    reason: compactIntentText(
      buildRowanAutonomyReason({
        actionLabel: action?.label,
        currentLocationName: currentLocation?.name,
        loopStep,
        npcName: npc?.name,
        targetLocationName: targetLocation?.name,
        world,
      }),
      170,
    ),
    signals: buildRowanAutonomySignals({
      actionLabel: action?.label,
      currentLocationName: currentLocation?.name,
      loopStep,
      npcName: npc?.name,
      objectiveText: objective.text,
      targetLocationName: targetLocation?.name,
      world,
    }).map((signal) => compactIntentText(signal, 72)),
  };
}

function buildRowanAutonomyReason({
  actionLabel,
  currentLocationName,
  loopStep,
  npcName,
  targetLocationName,
  world,
}: {
  actionLabel?: string;
  currentLocationName?: string;
  loopStep: RowanLoopStep;
  npcName?: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const activeConversation = world.activeConversation;
  if (loopStep.layer === "conversation" && activeConversation) {
    if (activeConversation.decision || activeConversation.objectiveText) {
      return "The conversation produced a usable lead, so Rowan can close it and act on what changed.";
    }

    if (loopStep.kind === "talk") {
      return "The last answer left one practical gap, so Rowan is asking one more question before moving.";
    }

    return "No clearer lead is forming here, so Rowan can step back into the day.";
  }

  if (world.player.pendingObjectiveMove && loopStep.kind === "move") {
    return buildPendingMovementReason({
      actionLabel,
      loopStep,
      npcName,
      targetLocationName,
      world,
    });
  }

  const activeJob = activeJobForIntent(world);
  if (loopStep.layer === "commitment" && activeJob) {
    if (loopStep.kind === "move" && targetLocationName) {
      return `${activeJob.title} is already accepted, so Rowan is getting to ${targetLocationName} before the window slips.`;
    }

    if (loopStep.kind === "wait") {
      return `${activeJob.title} is already accepted, so Rowan is watching the clock instead of starting a new thread.`;
    }

    return `${activeJob.title} is open now, and finishing it matters more than wandering.`;
  }

  if (loopStep.kind === "move" && targetLocationName) {
    const routeReason = objectiveRouteMoveReasonForLocation(
      world,
      loopStep.targetLocationId,
      targetLocationName,
      npcName,
    );
    if (routeReason) {
      return routeReason;
    }

    if (npcName) {
      return `${npcName} is tied to the next step, so Rowan is getting to ${targetLocationName} before talking.`;
    }

    if (actionLabel) {
      return `${targetLocationName} is where ${lowercaseFirst(actionLabel)} can happen, so Rowan is going there now.`;
    }

    return groundedCurrentOpeningMoveReason({
      targetLocationId: loopStep.targetLocationId,
      targetLocationName,
      world,
    });
  }

  if (loopStep.kind === "talk" && npcName) {
    return `${npcName} is here, so Rowan can ask the question in person.`;
  }

  if (loopStep.kind === "act" && actionLabel) {
    const scaffoldReason = objectiveRouteActionLocationReason({
      actionLabel,
      currentLocationName,
    });
    if (scaffoldReason) {
      return scaffoldReason;
    }

    if (currentLocationName) {
      if (/^enter\b/i.test(actionLabel)) {
        return `${actionLabel} is available here, and going inside fits Rowan's current aim.`;
      }

      return `${actionLabel} is available at ${currentLocationName}, and it fits Rowan's current aim.`;
    }

    return `${actionLabel} is the legal action that fits Rowan's current aim.`;
  }

  if (loopStep.kind === "wait") {
    return "The timing matters, so Rowan is letting the clock move instead of starting something unrelated.";
  }

  if (loopStep.kind === "blocked") {
    return "None of the available moves clearly fit what Rowan knows, so he needs a fresher lead.";
  }

  if (loopStep.kind === "observe") {
    return "No action needs a click yet; Rowan is reading the place before committing.";
  }

  if (loopStep.kind === "idle" && isCurrentObjectiveComplete(world)) {
    const completionRationale = objectiveRouteCompletionRationale(
      world,
      loopStep.objective ?? currentObjectiveDirective(world),
    );

    return (
      completionRationale ??
      "This objective is complete. Set a new direction when Rowan is ready to keep going."
    );
  }

  return loopStep.detail;
}

function objectiveRouteMoveReasonForLocation(
  world: StreetGameState,
  locationId: string | undefined,
  locationName: string,
  npcName?: string,
) {
  const objective = currentObjectiveDirective(world);
  if (!objective || !locationId) {
    return undefined;
  }

  const intent = objectiveRouteMoveIntent(world, objective, locationId);
  if (!intent?.rationale) {
    return undefined;
  }

  const rationale = groundedMoveRationaleForLocation(
    locationName,
    playerFacingAutonomyRationale(world, intent.rationale) || intent.rationale,
  );
  if (!rationale) {
    return undefined;
  }

  if (intent.label && /^return\b/i.test(intent.label)) {
    return `${rationale}.`;
  }

  if (npcName || intent.npcId) {
    const npc =
      npcName ?? (intent.npcId ? npcById(world, intent.npcId)?.name : undefined);
    return `${locationName} is where ${npc ?? "the right person"} can answer the live question: ${rationale}.`;
  }

  return `${locationName} is tied to the current obligation: ${rationale}.`;
}

function groundedMoveRationaleForLocation(
  locationName: string,
  rationaleText: string,
) {
  const locationPattern = locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeAutonomyRationale(rationaleText)
    .replace(
      new RegExp(`^(?:walk|go|get) to ${locationPattern}\\s+and\\s+`, "i"),
      "",
    )
    .replace(/^(?:walk|go|get) to [^,.]+ and\s+/i, "")
    .replace(/^(?:walk|go|get) to [^,.]+(?:\.|$)/i, "")
    .trim();
}

function buildPendingMovementReason({
  actionLabel,
  loopStep,
  npcName,
  targetLocationName,
  world,
}: {
  actionLabel?: string;
  loopStep: RowanLoopStep;
  npcName?: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const pendingMove = world.player.pendingObjectiveMove;
  const rationale = playerFacingAutonomyRationale(
    world,
    pendingMove?.rationale ?? loopStep.detail,
  ).replace(/[.!?]+$/g, "");
  const target = targetLocationName ?? "the next place";
  const normalizedTarget = targetLocationName?.toLowerCase();
  const homeReturnReason = objectiveRouteHomeReturnReason({
    rationale,
    targetLocationId: loopStep.targetLocationId,
    targetLocationName,
    world,
  });
  if (homeReturnReason) {
    return homeReturnReason;
  }

  const routeReason = objectiveRouteMoveReasonForLocation(
    world,
    loopStep.targetLocationId,
    target,
    npcName,
  );
  if (routeReason) {
    return routeReason;
  }

  if (
    rationale &&
    normalizedTarget &&
    rationale.toLowerCase().startsWith(normalizedTarget)
  ) {
    return `${rationale}.`;
  }

  const cleanedActionLabel = actionLabel
    ? lowercaseFirst(actionLabel).replace(/\.$/g, "")
    : undefined;

  if (rationale && npcName && targetLocationName) {
    return `${target} is where ${npcName} can answer the next question: ${rationale}.`;
  }

  if (rationale && cleanedActionLabel && targetLocationName) {
    return `${target} is where Rowan can ${cleanedActionLabel}: ${rationale}.`;
  }

  if (rationale) {
    return `${target} is tied to the current obligation: ${rationale}.`;
  }

  return groundedCurrentOpeningMoveReason({
    targetLocationId: loopStep.targetLocationId,
    targetLocationName,
    world,
  });
}

function groundedCurrentOpeningMoveReason({
  targetLocationId,
  targetLocationName,
  world,
}: {
  targetLocationId?: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const scaffoldReason = objectiveRouteCurrentOpeningMoveReason({
    targetLocationId,
    targetLocationName,
    world,
  });
  if (scaffoldReason) {
    return scaffoldReason;
  }

  const target = targetLocationName ?? "the next check";
  const objective = currentObjectiveDirective(world);
  const obligation = objective?.text
    ? normalizeAutonomyRationale(
        playerFacingAutonomyRationale(world, objective.text),
      )
    : undefined;

  return obligation
    ? `${target} is the next check tied to Rowan's current obligation: ${obligation}.`
    : `${target} is tied to Rowan's current obligation, so he is moving there before acting further.`;
}

function buildRowanAutonomySignals({
  actionLabel,
  currentLocationName,
  loopStep,
  npcName,
  objectiveText,
  targetLocationName,
  world,
}: {
  actionLabel?: string;
  currentLocationName?: string;
  loopStep: RowanLoopStep;
  npcName?: string;
  objectiveText: string;
  targetLocationName?: string;
  world: StreetGameState;
}) {
  const activeJob = activeJobForIntent(world);
  const signals = [
    `Goal: ${objectiveText}`,
    currentLocationName ? `Here: ${currentLocationName}` : undefined,
    targetLocationName && targetLocationName !== currentLocationName
      ? `Target: ${targetLocationName}`
      : undefined,
    npcName ? `Person: ${npcName}` : undefined,
    loopStep.kind === "wait" && loopStep.waitUntilMinutes !== undefined
      ? `Timing: about ${formatClockAt(world, loopStep.waitUntilMinutes)}`
      : undefined,
    actionLabel && loopStep.kind !== "wait"
      ? `Action: ${actionLabel}`
      : undefined,
    `Resources: $${world.player.money}, ${world.player.energy} energy`,
    activeJob ? `Commitment: ${activeJob.title}` : undefined,
    loopStep.layer === "conversation" && world.activeConversation
      ? `Conversation: ${npcName ?? world.activeConversation.npcId}`
      : undefined,
  ].filter((signal): signal is string => Boolean(signal));

  return [...new Set(signals)].slice(0, 4);
}

function activeJobForIntent(world: StreetGameState) {
  return world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
}

function compactIntentText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const cutAt = normalized.lastIndexOf(" ", maxLength - 3);
  return `${normalized.slice(0, cutAt > 24 ? cutAt : maxLength - 3).trim()}...`;
}

function lowercaseFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function normalizeAutonomyRationale(text: string) {
  return text.trim().replace(/[.?!]+$/g, "");
}

function chooseObjectivePlan(world: StreetGameState): {
  plan?: ObjectivePlan;
  trace: RowanPlanningTrace;
} {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return {
      trace: emptyObjectivePlanningTrace(world),
    };
  }

  const selectableCandidates = buildObjectiveAgentPlanCandidates(world, objective, {
    includeLowScoringActions: false,
  });
  const traceCandidates = buildObjectiveAgentPlanCandidates(world, objective, {
    includeLowScoringActions: true,
  });
  selectableCandidates.sort((left, right) => right.score - left.score);
  const plan = selectableCandidates[0];

  return {
    plan,
    trace: buildObjectivePlanningTrace(world, objective, plan, traceCandidates),
  };
}

function emptyObjectivePlanningTrace(world: StreetGameState): RowanPlanningTrace {
  return {
    blockers: objectivePlanningBlockers(world),
    considered: [],
    nextSteps: [],
    outcomes: objectivePlanningTraceOutcomes(world),
    rejected: [],
  };
}

function buildObjectivePlanningTrace(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  selected: ObjectivePlan | undefined,
  candidates: ObjectivePlan[],
  acceptedRecommendation?: AcceptedStreetPlannerRecommendation,
): RowanPlanningTrace {
  const selectedActionId = selected
    ? currentPlannerActionIdForPlan(world, selected)
    : undefined;
  const selectedTraceKey = selected
    ? objectivePlanTraceKey(world, selected)
    : undefined;
  const selectedPressureMatch = selected
    ? bestObjectivePlanningPressureMatch(
        world,
        currentObjectiveDirective(world),
        selected,
      )
    : undefined;
  const selectedLegalBacking = selected
    ? planningTraceLegalBackingForPlan(world, selected)
    : undefined;
  const selectedRecommendation = selected
    ? buildSelectedPlanningTraceRecommendation(
        world,
        selected,
        selectedActionId,
        selectedLegalBacking,
        acceptedRecommendation,
      )
    : undefined;
  const nextSteps = buildObjectivePlanningTraceNextSteps(world, selected);
  const immediateAction = selectedImmediatePlanningTraceStep(
    nextSteps,
    selectedActionId,
  );
  const intendedFollowUp = selectedIntendedFollowUpTraceStep(
    nextSteps,
    immediateAction,
  );
  const plannerIntent = selected
    ? planningTracePlannerIntentForPlan(
        world,
        selected,
        selectedTraceKey,
        selectedPressureMatch,
      )
    : undefined;
  const selectedLabel = immediateAction?.label;
  const sortedCandidates = dedupeObjectivePlans([
    ...(selected ? [selected] : []),
    ...candidates,
  ]).sort((left, right) => {
    if (selectedTraceKey) {
      const leftSelected = objectivePlanTraceKey(world, left) === selectedTraceKey;
      const rightSelected =
        objectivePlanTraceKey(world, right) === selectedTraceKey;
      if (leftSelected !== rightSelected) {
        return Number(rightSelected) - Number(leftSelected);
      }
    }

    return right.score - left.score;
  });
  const considered = sortedCandidates
    .slice(0, 5)
    .map((plan) =>
      planningTraceOptionForPlan(world, plan, selected, selected?.score),
    );
  const rejected = sortedCandidates
    .filter(
      (plan) =>
        !selectedTraceKey ||
        objectivePlanTraceKey(world, plan) !== selectedTraceKey,
    )
    .slice(0, 4)
    .map((plan) =>
      planningTraceOptionForPlan(
        world,
        plan,
        selected,
        selected?.score,
        "rejected",
      ),
    );
  const staleActionRejected = staleObjectiveActionTraceOptions(
    world,
    selectedActionId,
  );

  return {
    blockers: objectivePlanningBlockers(world),
    considered,
    immediateAction,
    intendedFollowUp,
    nextSteps,
    outcomes: objectivePlanningTraceOutcomes(world),
    plannerIntent,
    rejected: dedupePlanningTraceOptions([
      ...staleActionRejected,
      ...rejected,
    ]).slice(0, 5),
    selectedActionId,
    selectedLabel,
    selectedLegalBacking,
    selectedMatchedOutcomeId: selectedPressureMatch?.pressure.matchedOutcomeId,
    selectedPlanKey: selectedTraceKey,
    selectedPressureId: selectedPressureMatch?.pressure.id,
    selectedPressureKind: selectedPressureMatch?.pressure.kind,
    selectedPressureLabel: selectedPressureMatch?.pressure.label,
    selectedRecommendation,
    selectedTargetLocationId: selected?.targetLocationId,
  };
}

function selectedImmediatePlanningTraceStep(
  nextSteps: RowanPlanningTraceStep[],
  selectedActionId: string | undefined,
) {
  return (
    nextSteps.find(
      (step) => selectedActionId && step.actionId === selectedActionId,
    ) ??
    nextSteps[0] ??
    undefined
  );
}

function selectedIntendedFollowUpTraceStep(
  nextSteps: RowanPlanningTraceStep[],
  immediateAction: RowanPlanningTraceStep | undefined,
) {
  if (!immediateAction) {
    return undefined;
  }

  return nextSteps.find(
    (step) =>
      step !== immediateAction &&
      step.legal &&
      (!step.actionId || step.actionId !== immediateAction.actionId),
  );
}

function planningTracePlannerIntentForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
  selectedTraceKey: string | undefined,
  selectedPressureMatch: ObjectivePlanningPressureMatch | undefined,
) {
  const plannerActionId = plannerActionIdForPlan(plan);
  return {
    actionId: plannerActionId,
    label: autonomyLabelForNextBeat(world, plan),
    matchedOutcomeId: selectedPressureMatch?.pressure.matchedOutcomeId,
    npcId: plan.npcId,
    planKey: selectedTraceKey,
    pressureId: selectedPressureMatch?.pressure.id,
    pressureKind: selectedPressureMatch?.pressure.kind,
    pressureLabel: selectedPressureMatch?.pressure.label,
    rationale: compactIntentText(
      playerFacingAutonomyRationale(world, plan.rationale) || plan.rationale,
      140,
    ),
    targetLocationId: plan.targetLocationId,
  };
}

function buildSelectedPlanningTraceRecommendation(
  world: StreetGameState,
  selected: ObjectivePlan,
  selectedActionId: string | undefined,
  selectedLegalBacking: RowanPlanningTraceLegalBacking | undefined,
  acceptedRecommendation: AcceptedStreetPlannerRecommendation | undefined,
): RowanPlanningTraceSelectedRecommendation {
  const validationBacking = planningTraceLegalBackingForStep(
    world,
    selected,
    selectedActionId,
    loopKindForObjectivePlan(world, selected),
  );
  const validationSource =
    validationBacking?.source ?? selectedLegalBacking?.source;
  const legalBackingSource = selectedLegalBacking?.source ?? validationSource;
  const sourceKind =
    acceptedRecommendation?.sourceKind ?? "deterministic-planner";

  return {
    accepted: true,
    advisory: sourceKind === "live-llm",
    confidence:
      acceptedRecommendation?.confidence !== undefined
        ? Math.round(acceptedRecommendation.confidence * 100) / 100
        : undefined,
    legalBackingSource,
    model: acceptedRecommendation?.model,
    provider: acceptedRecommendation?.provider,
    rationale: acceptedRecommendation?.rationale
      ? compactIntentText(
          playerFacingAutonomyRationale(
            world,
            acceptedRecommendation.rationale,
          ) || acceptedRecommendation.rationale,
          140,
        )
      : undefined,
    sourceKind,
    validationSource,
    validationStatus: planningTraceValidationStatusForSource(validationSource),
  };
}

function planningTraceValidationStatusForSource(
  source: RowanPlanningTraceLegalBacking["source"] | undefined,
): RowanPlanningTraceSelectedRecommendation["validationStatus"] {
  switch (source) {
    case "conversation-resolution":
      return "conversation-resolution";
    case "current-legal-action-surface":
      return "legal-action-surface-validated";
    case "destination-preview-legal-action":
    case "projected-follow-up-legal-action":
      return "projected-legal-action";
    case "simulator-validated-move":
    case "simulator-validated-wait":
      return "simulator-validated";
    default:
      return "unvalidated";
  }
}

function staleObjectiveActionTraceOptions(
  world: StreetGameState,
  selectedActionId: string | undefined,
): RowanPlanningTraceOption[] {
  const predicateOptions = openObjectivePredicateOutcomes(world)
    .filter((outcome) => outcome.actionId)
    .filter((outcome) => outcome.actionId !== selectedActionId)
    .filter(
      (outcome) =>
        !objectivePredicateActionIsLegal(world, outcome.actionId ?? ""),
    )
    .map((outcome) => {
      const targetLocationId =
        targetLocationIdForActionId(world, outcome.actionId ?? "") ??
        outcome.targetLocationId;
      return {
        actionId: outcome.actionId,
        label: outcome.label,
        matchedOutcomeId: outcome.id,
        rationale:
          outcome.evidence ??
          "This predicate action was considered against the current simulator state.",
        reason:
          "Rejected because this objective action is no longer legal in the current world state.",
        score: 0,
        status: "rejected" as const,
        targetLocationId,
        npcId: outcome.npcId,
        planKey: `stale-predicate|${outcome.id}|${outcome.actionId ?? "no-action"}|${targetLocationId ?? "no-location"}`,
        provenance: "stale-predicate" as const,
      };
    });
  const trailOptions = (world.player.objective?.trail ?? [])
    .filter((step) => step.actionId && !step.done)
    .filter((step) => step.actionId !== selectedActionId)
    .filter(
      (step) => !objectivePredicateActionIsLegal(world, step.actionId ?? ""),
    )
    .map((step) => {
      const targetLocationId =
        targetLocationIdForActionId(world, step.actionId ?? "") ??
        step.targetLocationId;
      return {
        actionId: step.actionId,
        label: step.title,
        matchedOutcomeId: step.id,
        rationale:
          step.detail ??
          "This route hint was checked against the current simulator state.",
        reason:
          "Rejected because this route hint action is no longer legal in the current world state.",
        score: 0,
        status: "rejected" as const,
        targetLocationId,
        npcId: step.npcId,
        planKey: `stale-trail|${step.id}|${step.actionId ?? "no-action"}|${targetLocationId ?? "no-location"}`,
        provenance: "stale-trail" as const,
      };
    });

  return [...predicateOptions, ...trailOptions];
}

function objectivePredicateActionIsLegal(
  world: StreetGameState,
  actionId: string,
) {
  if (!actionId) {
    return false;
  }

  const targetLocationId =
    targetLocationIdForActionId(world, actionId) ??
    world.player.currentLocationId;
  if (!targetLocationId) {
    return false;
  }

  const preview = previewWorldAtLocation(world, targetLocationId);
  return buildAvailableActions(preview).some(
    (action) =>
      action.id === actionId &&
      !action.disabled &&
      canAutoPlanAction(world, targetLocationId, action, preview),
  );
}

function dedupePlanningTraceOptions(
  options: RowanPlanningTraceOption[],
): RowanPlanningTraceOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.planKey;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildObjectivePlanningTraceNextSteps(
  world: StreetGameState,
  selected: ObjectivePlan | undefined,
): RowanPlanningTraceStep[] {
  if (!selected) {
    return [];
  }

  const selectedActionId = currentPlannerActionIdForPlan(world, selected);
  const steps = [
    traceStepForPlan(world, selected, {
      actionId: selectedActionId,
      label: immediatePlannerActionLabel(world, selected, selectedActionId),
    }),
    ...buildProjectedDestinationFollowUpTraceSteps(world, selected),
    ...buildLiveProblemFollowUpTraceSteps(world, selected),
  ];
  const seen = new Set<string>();

  return steps
    .filter((step) => {
      const key = [
        step.kind,
        step.targetLocationId ?? "here",
        step.actionId ?? "no-action",
        step.npcId ?? "no-npc",
      ].join(":");
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function immediatePlannerActionLabel(
  world: StreetGameState,
  plan: ObjectivePlan,
  actionId: string | undefined,
) {
  if (!actionId) {
    return autonomyLabelForNextBeat(world, plan);
  }

  if (actionId.startsWith("move:")) {
    const locationId = actionId.slice("move:".length);
    const location = findLocation(world, locationId);
    return location
      ? (objectivePlanMoveLabelForLocation(world, plan, location) ??
          `Head to ${location.name}`)
      : "Follow the current route";
  }

  if (actionId.startsWith("wait:") && plan.waitUntilMinutes !== undefined) {
    return `Wait until ${formatClockAt(world, plan.waitUntilMinutes)}`;
  }

  return autonomyLabelForAction(world, actionId);
}

function buildProjectedDestinationFollowUpTraceSteps(
  world: StreetGameState,
  selected: ObjectivePlan,
): RowanPlanningTraceStep[] {
  const requiresInteriorEntry = planRequiresInteriorEntry(world, selected);
  if (
    !selected.targetLocationId ||
    (selected.targetLocationId === world.player.currentLocationId &&
      !requiresInteriorEntry) ||
    (!selected.actionId && !selected.npcId)
  ) {
    return [];
  }

  const location = findLocation(world, selected.targetLocationId);
  if (!location) {
    return [];
  }

  const preview = previewWorldAtLocation(world, selected.targetLocationId);

  if (selected.npcId) {
    const npc = npcById(preview, selected.npcId);
    const actionId = `talk:${selected.npcId}`;
    const action = buildAvailableActions(preview).find(
      (candidate) => candidate.id === actionId,
    );
    const legal = Boolean(action && !action.disabled && npc);

    return [
      {
        actionId,
        kind: "talk",
        label: action?.label ?? `Talk to ${npc?.name ?? "someone nearby"}`,
        legal,
        legalBacking:
          legal && action
            ? {
                actionId,
                locationId: location.id,
                source: "destination-preview-legal-action",
              }
            : undefined,
        npcId: selected.npcId,
        rationale: `After reaching ${location.name}, re-evaluate the legal conversation surface before Rowan asks the next question.`,
        targetLocationId: location.id,
        validation: legal
          ? "Projected from a cloned destination legal action surface; real execution still requires arrival and a fresh simulator validation."
          : `Projected talk is not currently legal at ${location.name}.`,
      },
    ];
  }

  if (!selected.actionId) {
    return [];
  }

  const action = buildAvailableActions(preview).find(
    (candidate) => candidate.id === selected.actionId,
  );
  const legal = Boolean(action && !action.disabled);

  return [
    {
      actionId: selected.actionId,
      kind: isTimeSkippingAction(selected.actionId) ? "wait" : "act",
      label: action?.label ?? autonomyLabelForAction(preview, selected.actionId),
      legal,
      legalBacking:
        legal && action
          ? {
              actionId: selected.actionId,
              locationId: location.id,
              source: "destination-preview-legal-action",
            }
          : undefined,
      rationale: `After reaching ${location.name}, re-check this action against the destination's legal action surface before applying consequences.`,
      targetLocationId: location.id,
      validation: legal
        ? "Projected from a cloned destination legal action surface; real execution still requires arrival and a fresh simulator validation."
        : `Projected action is not currently legal at ${location.name}: ${action?.disabledReason ?? "action unavailable"}.`,
    },
  ];
}

function traceStepForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
  overrides: Partial<RowanPlanningTraceStep> = {},
): RowanPlanningTraceStep {
  const kind = loopKindForObjectivePlan(world, plan);
  const actionId = overrides.actionId ?? plannerActionIdForPlan(plan);
  const legalBacking =
    overrides.legalBacking ??
    planningTraceLegalBackingForStep(world, plan, actionId, kind);
  return {
    actionId,
    kind,
    label: autonomyLabelForNextBeat(world, plan),
    legalBacking,
    legal: true,
    npcId: plan.npcId,
    rationale: compactIntentText(plan.rationale, 160),
    targetLocationId: plan.targetLocationId,
    validation: validationTextForTracePlan(world, plan, kind),
    ...overrides,
  };
}

function validationTextForTracePlan(
  world: StreetGameState,
  plan: ObjectivePlan,
  kind: RowanAutonomyStepKind,
) {
  const currentActionId = currentPlannerActionIdForPlan(world, plan);

  if (
    plan.targetLocationId &&
    plan.targetLocationId !== world.player.currentLocationId
  ) {
    return "Simulator must validate the move before any action consequence applies.";
  }

  if (
    currentActionId?.startsWith("enter:") ||
    currentActionId?.startsWith("exit:")
  ) {
    return "Portal action is present in the current legal action surface before Rowan changes spaces.";
  }

  if (plan.actionId) {
    return "Action is present in the current legal action surface before execution.";
  }

  if (kind === "talk" && plan.npcId) {
    return "Conversation target is present at the current simulated location.";
  }

  if (kind === "wait") {
    return "Time skip remains simulator-validated and re-evaluates passive world state.";
  }

  return "Diagnostic step only; no state mutation happens from the trace.";
}

function buildLiveProblemFollowUpTraceSteps(
  world: StreetGameState,
  selected: ObjectivePlan,
): RowanPlanningTraceStep[] {
  const selectedActionId = selected.actionId ?? "";
  const [selectedKind, selectedTargetId] = selectedActionId.split(":");
  const steps: RowanPlanningTraceStep[] = [];

  if (selectedKind === "buy" && selectedTargetId === "item-wrench") {
    const problem = urgentKnownProblems(world).find(
      (candidate) =>
        candidate.requiredItemId === "item-wrench" &&
        !hasRequiredProblemItem(world, candidate) &&
        knowsToolSourceForProblem(world, candidate),
    );
    if (!problem) {
      return steps;
    }

    const purchaseStep = traceLegalActionStepAtLocation(
      world,
      "repair-stall",
      "buy:item-wrench",
      "Buy the wrench before spending more time at the broken site.",
      {
        kind: "act",
        validation:
          "After the move is validated, this buy action must appear in the legal action surface before money or inventory changes.",
      },
    );
    if (
      purchaseStep &&
      !(
        selected.targetLocationId === "repair-stall" &&
        world.player.currentLocationId === "repair-stall" &&
        selected.actionId === "buy:item-wrench"
      )
    ) {
      steps.push(purchaseStep);
    }

    const repairPreview = previewWorldAtLocation(world, problem.locationId);
    if (!hasItem(repairPreview, "item-wrench")) {
      repairPreview.player.inventory.push({
        id: "item-wrench",
        name: "Old wrench",
        description:
          "Trace preview only: assumes the selected buy action succeeds before the follow-up solve is reconsidered.",
      });
    }

    const repairLocation = findLocation(repairPreview, problem.locationId);
    if (repairLocation) {
      if (world.player.currentLocationId !== repairLocation.id) {
        steps.push(
          traceStepForPlan(
            world,
            {
              actionId: `solve:${problem.id}`,
              rationale: `Return to ${repairLocation.name} once the tool is actually in Rowan's inventory.`,
              score: selected.score,
              targetLocationId: repairLocation.id,
            },
            {
              kind: "move",
              label: `Return to ${repairLocation.name}`,
              legal: true,
              validation:
                "Projected future move only; the simulator must validate arrival before the repair action can execute.",
            },
          ),
        );
      }

      const solveAction = buildAvailableActions(repairPreview).find(
        (action) => action.id === `solve:${problem.id}`,
      );
      steps.push({
        actionId: `solve:${problem.id}`,
        kind: "act",
        legalBacking:
          solveAction && !solveAction.disabled
            ? {
                actionId: `solve:${problem.id}`,
                locationId: repairLocation.id,
                source: "projected-follow-up-legal-action",
              }
            : undefined,
        label: solveAction?.label ?? `Solve ${problem.title.toLowerCase()}`,
        legal: Boolean(solveAction && !solveAction.disabled),
        rationale: `Solve ${problem.title.toLowerCase()} after the move and purchase have both been validated.`,
        targetLocationId: repairLocation.id,
        validation:
          solveAction && !solveAction.disabled
            ? "Projected from a cloned future legal action surface; real execution still requires the solve action to be legal then."
            : `Projected solve is not currently legal: ${solveAction?.disabledReason ?? "action unavailable"}.`,
      });
      /*
       * The solve step above is deliberately trace-only. The simulator still
       * requires a later advance_objective beat to expose and perform it.
       */
    }
  }

  return steps;
}

function traceLegalActionStepAtLocation(
  world: StreetGameState,
  locationId: string,
  actionId: string,
  rationale: string,
  overrides: Partial<RowanPlanningTraceStep> = {},
): RowanPlanningTraceStep | undefined {
  const preview = previewWorldAtLocation(world, locationId);
  const action = buildAvailableActions(preview).find(
    (candidate) => candidate.id === actionId,
  );
  const location = findLocation(world, locationId);
  if (!action || !location) {
    return undefined;
  }

  return traceStepForPlan(
    world,
    {
      actionId,
      rationale,
      score: 0,
      targetLocationId: location.id,
    },
    {
      kind:
        world.player.currentLocationId === location.id
          ? isTimeSkippingAction(actionId)
            ? "wait"
            : "act"
          : "move",
      label:
        world.player.currentLocationId === location.id
          ? action.label
          : (objectivePlanMoveLabelForLocation(
              world,
              { actionId, targetLocationId: location.id },
              location,
            ) ??
            `Head to ${location.name}`),
      legal: !action.disabled,
      legalBacking: action.disabled
        ? undefined
        : {
            actionId,
            locationId: location.id,
            source:
              world.player.currentLocationId === location.id
                ? "current-legal-action-surface"
                : "destination-preview-legal-action",
          },
      validation: action.disabled
        ? `Blocked in the legal action surface: ${action.disabledReason ?? "disabled"}.`
        : "Action appears in a cloned legal action surface at this location; execution still requires arrival and simulator validation.",
      ...overrides,
    },
  );
}

function planningTraceOptionForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
  selectedPlan: ObjectivePlan | undefined,
  selectedScore: number | undefined,
  forcedStatus?: RowanPlanningTraceOption["status"],
): RowanPlanningTraceOption {
  const actionId = currentPlannerActionIdForPlan(world, plan);
  const selected = Boolean(
    selectedPlan &&
      objectivePlanTraceKey(world, plan) ===
        objectivePlanTraceKey(world, selectedPlan),
  );
  const pressureMatch = bestObjectivePlanningPressureMatch(
    world,
    currentObjectiveDirective(world),
    plan,
  );
  const provenance = planningTraceProvenanceForPlan(pressureMatch);
  const legalBacking = planningTraceLegalBackingForPlan(world, plan);
  return {
    actionId,
    label: autonomyLabelForNextBeat(world, plan),
    legalBacking,
    matchedOutcomeId: pressureMatch?.pressure.matchedOutcomeId,
    npcId: plan.npcId,
    planKey: objectivePlanTraceKey(world, plan),
    pressureId: pressureMatch?.pressure.id,
    pressureKind: pressureMatch?.pressure.kind,
    pressureLabel: pressureMatch?.pressure.label,
    provenance,
    rationale: compactIntentText(
      playerFacingAutonomyRationale(world, plan.rationale) || plan.rationale,
      140,
    ),
    reason:
      forcedStatus === "rejected" || !selected
        ? rejectedPlanningReason(world, plan, selectedScore)
        : undefined,
    score: Math.round(plan.score * 10) / 10,
    status: forcedStatus ?? (selected ? "selected" : "rejected"),
    targetLocationId: plan.targetLocationId,
  };
}

function planningTraceProvenanceForPlan(
  pressureMatch: ReturnType<typeof bestObjectivePlanningPressureMatch>,
): RowanPlanningTraceOption["provenance"] {
  if (pressureMatch?.pressure.kind === "predicate") {
    return "objective-predicate";
  }

  if (pressureMatch) {
    return "live-pressure";
  }

  return "legal-action";
}

function planningTraceLegalBackingForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
): RowanPlanningTraceLegalBacking | undefined {
  const followUpActionId = projectedFollowUpActionIdForPlan(plan);
  if (
    plan.targetLocationId &&
    plan.targetLocationId !== world.player.currentLocationId &&
    followUpActionId
  ) {
    const destinationBacking = legalActionBackingAtLocation(
      world,
      plan.targetLocationId,
      followUpActionId,
      "destination-preview-legal-action",
    );
    if (destinationBacking) {
      return destinationBacking;
    }
  }

  const currentActionId = currentPlannerActionIdForPlan(world, plan);
  if (plan.waitUntilMinutes !== undefined) {
    return {
      actionId: currentActionId,
      locationId: world.player.currentLocationId,
      source: "simulator-validated-wait",
    };
  }

  const currentBacking = currentLegalActionBacking(world, currentActionId);
  if (currentBacking) {
    return currentBacking;
  }

  if (
    currentActionId?.startsWith("move:") &&
    plan.targetLocationId &&
    findLocation(world, plan.targetLocationId)
  ) {
    return {
      actionId: currentActionId,
      locationId: plan.targetLocationId,
      source: "simulator-validated-move",
    };
  }

  if (followUpActionId && plan.targetLocationId) {
    return legalActionBackingAtLocation(
      world,
      plan.targetLocationId,
      followUpActionId,
      "destination-preview-legal-action",
    );
  }

  return undefined;
}

function planningTraceLegalBackingForStep(
  world: StreetGameState,
  plan: ObjectivePlan,
  actionId: string | undefined,
  kind: RowanAutonomyStepKind,
): RowanPlanningTraceLegalBacking | undefined {
  const currentBacking = currentLegalActionBacking(world, actionId);
  if (currentBacking) {
    return currentBacking;
  }

  if (kind === "wait" && plan.waitUntilMinutes !== undefined) {
    return {
      actionId,
      locationId: world.player.currentLocationId,
      source: "simulator-validated-wait",
    };
  }

  if (
    (kind === "move" || actionId?.startsWith("move:")) &&
    plan.targetLocationId &&
    findLocation(world, plan.targetLocationId)
  ) {
    return {
      actionId,
      locationId: plan.targetLocationId,
      source: "simulator-validated-move",
    };
  }

  return undefined;
}

function currentLegalActionBacking(
  world: StreetGameState,
  actionId: string | undefined,
): RowanPlanningTraceLegalBacking | undefined {
  if (!actionId) {
    return undefined;
  }

  const action = buildAvailableActions(world).find(
    (candidate) => candidate.id === actionId && !candidate.disabled,
  );
  if (!action) {
    return undefined;
  }

  return {
    actionId,
    locationId: world.player.currentLocationId,
    source: "current-legal-action-surface",
  };
}

function legalActionBackingAtLocation(
  world: StreetGameState,
  locationId: string,
  actionId: string,
  source: RowanPlanningTraceLegalBacking["source"],
): RowanPlanningTraceLegalBacking | undefined {
  const preview = previewWorldAtLocation(world, locationId);
  const action = buildAvailableActions(preview).find(
    (candidate) =>
      candidate.id === actionId &&
      !candidate.disabled &&
      canAutoPlanAction(world, locationId, candidate, preview),
  );
  if (!action) {
    return undefined;
  }

  return {
    actionId,
    locationId,
    source,
  };
}

function projectedFollowUpActionIdForPlan(
  plan: ObjectivePlan,
): string | undefined {
  if (plan.actionId) {
    return plan.actionId;
  }

  if (plan.npcId) {
    return `talk:${plan.npcId}`;
  }

  return undefined;
}

function objectivePlanTraceKey(world: StreetGameState, plan: ObjectivePlan) {
  return [
    currentPlannerActionIdForPlan(world, plan) ?? "",
    plan.actionId ?? "",
    plan.npcId ?? "",
    plan.targetLocationId ?? "",
    plan.waitUntilMinutes ?? "",
  ].join("|");
}

function rejectedPlanningReason(
  world: StreetGameState,
  plan: ObjectivePlan,
  selectedScore: number | undefined,
) {
  const objective = currentObjectiveDirective(world);
  const pressure = dominantObjectivePlanningPressure(world, objective);
  if (
    pressure &&
    pressureRequiresFocusedPlan(pressure) &&
    !planMatchesObjectivePlanningPressure(world, plan, pressure)
  ) {
    return `Rejected because ${pressure.label} is the dominant live pressure right now.`;
  }

  if (
    hasOpenObjectivePredicateAuthority(world) &&
    !planMatchesAnyOpenObjectivePredicate(world, plan) &&
    !planTargetsUrgentLivePressure(world, plan)
  ) {
    return "Rejected because it does not target the open objective predicate.";
  }

  if (plan.score <= 0) {
    return "Legal, but it does not move the current desired outcomes enough.";
  }

  if (
    plan.targetLocationId &&
    plan.targetLocationId !== world.player.currentLocationId
  ) {
    return "Possible, but it costs travel time before it changes the live state.";
  }

  if (selectedScore !== undefined && plan.score < selectedScore) {
    return "Lower priority than the selected live-state move.";
  }

  return "Possible, but not the best fit for the current blockers.";
}

function objectivePlanningBlockers(world: StreetGameState) {
  return (
    world.player.objective?.outcomes
      .flatMap((outcome) => outcome.blockers ?? [])
      .filter(Boolean)
      .slice(0, 5) ?? []
  );
}

function objectivePlanningTraceOutcomes(world: StreetGameState) {
  const objective = currentObjectiveDirective(world);
  const objectiveOutcomes =
    world.player.objective?.outcomes.map((outcome) => ({
      authority: outcome.authority ?? "predicate",
      blockers: outcome.blockers,
      evidence: outcome.evidence,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      urgency: outcome.urgency,
    })) ?? [];
  const seen = new Set(objectiveOutcomes.map((outcome) => outcome.id));
  const planningOutcomes =
    objective
      ? buildStreetPlanningOutcomes(world, objective)
          .filter((outcome) => !seen.has(outcome.id))
          .map((outcome) => ({
            authority: "predicate" as const,
            blockers: outcome.blockers,
            evidence: outcome.evidence,
            id: outcome.id,
            label: outcome.label,
            status: outcome.status,
            urgency: Math.round(outcome.priority),
          }))
      : [];

  return [...objectiveOutcomes, ...planningOutcomes].slice(0, 8);
}

function buildObjectiveAgentPlanCandidates(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  options: { includeLowScoringActions?: boolean } = {},
): ObjectivePlan[] {
  const desiredOutcomes = buildStreetPlanningOutcomes(world, objective);
  const planningText = objectivePlanningText(world, objective);
  const candidates: ObjectivePlan[] = [];

  for (const location of objectiveCandidateLocations(world, objective)) {
    const preview = previewWorldAtLocation(world, location.id);
    const actions = buildAvailableActions(preview);

    for (const action of actions) {
      if (
        action.disabled ||
        !canAutoPlanAction(world, location.id, action, preview)
      ) {
        continue;
      }

      const plan = objectivePlanForActionAtLocation(
        world,
        preview,
        location,
        action,
        objective,
      );
      if (!plan) {
        continue;
      }
      const suppressed = shouldSuppressObjectivePlanCandidate(
        world,
        objective,
        plan,
      );
      if (suppressed && !options.includeLowScoringActions) {
        continue;
      }

      plan.score = scoreObjectiveAgentPlan(world, preview, {
        action,
        desiredOutcomes,
        objective,
        plan,
        planningText,
      });

      if (options.includeLowScoringActions || plan.score > 0) {
        candidates.push(plan);
      }
    }

    if (location.id !== world.player.currentLocationId) {
      const moveIntent = objectiveMoveIntentForLocation(
        world,
        location,
        objective,
      );
      const plan: ObjectivePlan = {
        actionId: moveIntent?.actionId,
        npcId: moveIntent?.npcId,
        score: 0,
        rationale:
          moveIntent?.rationale ??
          `Walk to ${location.name} and read what opens from there.`,
        speech: moveIntent?.speech,
        targetLocationId: location.id,
      };
      const suppressed = shouldSuppressObjectivePlanCandidate(
        world,
        objective,
        plan,
      );
      if (suppressed && !options.includeLowScoringActions) {
        continue;
      }
      plan.score = scoreObjectiveAgentMovePlan(world, {
        desiredOutcomes,
        location,
        objective,
        plan,
        planningText,
      });
      if (options.includeLowScoringActions || plan.score > 0) {
        candidates.push(plan);
      }
    }
  }

  for (const waitPlan of buildObjectiveWaitPlans(
    world,
    objective,
    desiredOutcomes,
  )) {
    if (options.includeLowScoringActions || waitPlan.score > 0) {
      candidates.push(waitPlan);
    }
  }

  return dedupeObjectivePlans(candidates);
}

function buildStreetPlanningOutcomes(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
): StreetPlanningObjectiveOutcome[] {
  const planningText = objectivePlanningText(world, objective);
  const outcomes: StreetPlanningObjectiveOutcome[] =
    buildGenericStreetPlanningOutcomes(world, objective, {
      planningText,
    });
  const addOutcome = (
    id: string,
    label: string,
    priority: number,
    status: StreetPlanningObjectiveOutcome["status"],
    evidence?: string,
    metadata: Pick<
      StreetPlanningObjectiveOutcome,
      "actionId" | "blockers" | "npcId" | "targetLocationId"
    > = {},
  ) => {
    const existing = outcomes.find((outcome) => outcome.id === id);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      if (existing.status !== "at_risk") {
        existing.status = status;
      }
      existing.evidence ??= evidence;
      existing.actionId ??= metadata.actionId;
      existing.blockers ??= metadata.blockers;
      existing.npcId ??= metadata.npcId;
      existing.targetLocationId ??= metadata.targetLocationId;
      return;
    }

    outcomes.push({ id, label, priority, status, evidence, ...metadata });
  };

  const activeJob = activeJobForIntent(world);

  if (activeJob) {
    const endMinutes = totalMinutesForDayHour(world.clock.day, activeJob.endHour);
    addOutcome(
      "active-commitment",
      `Follow through on ${activeJob.title}.`,
      12,
      endMinutes - world.clock.totalMinutes <= 45 ? "at_risk" : "open",
      `Window ends around ${formatHour(activeJob.endHour)}`,
    );
  }

  for (const job of urgentKnownJobs(world)) {
    addOutcome(
      `job-window-${job.id}`,
      `${job.title} is close to slipping unless Rowan acts now.`,
      12 + jobWindowPressure(world, job),
      "at_risk",
      `Window ends around ${formatHour(job.endHour)}`,
      {
        actionId: job.accepted ? `work:${job.id}` : `accept:${job.id}`,
        blockers: [`${job.title} closes around ${formatHour(job.endHour)}.`],
        targetLocationId: job.locationId,
      },
    );
  }

  for (const outcome of openObjectivePredicateOutcomes(world)) {
    addOutcome(
      outcome.id,
      outcome.label,
      objectivePredicatePlanningPriority(outcome),
      outcome.status === "at_risk" ? "at_risk" : "open",
      outcome.evidence,
      {
        actionId: outcome.actionId,
        blockers: outcome.blockers,
        npcId: outcome.npcId,
        targetLocationId: outcome.targetLocationId,
      },
    );
  }

  return outcomes
    .filter((outcome) => outcome.status !== "met")
    .sort((left, right) => right.priority - left.priority);
}

function openObjectivePredicateOutcomes(
  world: StreetGameState,
): ObjectiveOutcomeState[] {
  const objective = world.player.objective;
  if (
    !objective ||
    objective.outcomes.length !== objective.progress.total
  ) {
    return [];
  }

  return objective.outcomes
    .filter(
      (outcome) => {
        if (
          hasLegacyTrailOutcomeAuthority(outcome) ||
          outcome.status === "met" ||
          outcome.status === "failed" ||
          !(outcome.targetLocationId || outcome.npcId || outcome.actionId)
        ) {
          return false;
        }

        return true;
      },
    )
    .sort((left, right) => right.urgency - left.urgency);
}

function hasLegacyTrailOutcomeAuthority(outcome: ObjectiveOutcomeState) {
  // Old saved/external JSON may still carry trail authority; do not treat it as predicate input.
  return (outcome as { authority?: unknown }).authority === "trail";
}

function hasOpenObjectivePredicateAuthority(world: StreetGameState) {
  return openObjectivePredicateOutcomes(world).length > 0;
}

function scoreOpenPredicateAuthorityForPlan(
  world: StreetGameState,
  plan: ObjectivePlan,
) {
  const outcomes = openObjectivePredicateOutcomes(world);
  if (outcomes.length === 0) {
    return 0;
  }

  const highestPriority = Math.max(
    ...outcomes.map(objectivePredicatePlanningPriority),
  );

  const matchedPriorities = outcomes
    .filter((outcome) => planMatchesObjectivePredicate(world, plan, outcome))
    .map(objectivePredicatePlanningPriority);

  if (matchedPriorities.length > 0) {
    return Math.max(36, Math.max(...matchedPriorities) * 10);
  }

  if (planTargetsUrgentLivePressure(world, plan)) {
    return 0;
  }

  return -Math.max(90, highestPriority * 12);
}

function planMatchesAnyOpenObjectivePredicate(
  world: StreetGameState,
  plan: ObjectivePlan,
) {
  return openObjectivePredicateOutcomes(world).some((outcome) =>
    planMatchesObjectivePredicate(world, plan, outcome),
  );
}

function planMatchesObjectivePredicate(
  world: StreetGameState,
  plan: ObjectivePlan,
  outcome: ObjectiveOutcomeState,
) {
  if (outcome.actionId) {
    if (plannerActionIdForPlan(plan) === outcome.actionId) {
      return true;
    }

    const actionLocationId = targetLocationIdForActionId(
      world,
      outcome.actionId,
    );
    return Boolean(
      actionLocationId &&
        planIsRouteTowardLocation(plan, actionLocationId),
    );
  }

  if (outcome.npcId) {
    if (plan.npcId === outcome.npcId) {
      return true;
    }

    const npcLocationId = npcById(world, outcome.npcId)?.currentLocationId;
    return Boolean(
      npcLocationId &&
        planIsRouteTowardLocation(plan, npcLocationId),
    );
  }

  if (outcome.targetLocationId) {
    return Boolean(
      plan.targetLocationId === outcome.targetLocationId &&
        (!plan.actionId || plan.actionId === `move:${outcome.targetLocationId}`) &&
        !plan.npcId,
    );
  }

  return false;
}

function planIsRouteTowardLocation(plan: ObjectivePlan, locationId: string) {
  if (plan.targetLocationId !== locationId || plan.npcId) {
    return false;
  }

  if (!plan.actionId) {
    return true;
  }

  return (
    plan.actionId === `move:${locationId}` ||
    plan.actionId === `enter:${locationId}` ||
    plan.actionId.startsWith("exit:")
  );
}

function shouldSuppressObjectivePlanCandidate(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  plan: ObjectivePlan,
) {
  const pressure = dominantObjectivePlanningPressure(world, objective);
  return Boolean(
    pressure &&
      pressureRequiresFocusedPlan(pressure) &&
      !planMatchesObjectivePlanningPressure(world, plan, pressure),
  );
}

function dominantObjectivePlanningPressure(
  world: StreetGameState,
  objective?: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  return buildObjectivePlanningPressures(world, objective)[0];
}

function pressureRequiresFocusedPlan(pressure: ObjectivePlanningPressure) {
  return pressure.priority >= 80;
}

function buildObjectivePlanningPressures(
  world: StreetGameState,
  objective?: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const pressures: ObjectivePlanningPressure[] = [];
  const finalPredicateRoutePending = hasFinalCurrentObjectivePredicateRoute(world);
  const pushPressure = (pressure: ObjectivePlanningPressure | undefined) => {
    if (!pressure) {
      return;
    }

    const existing = pressures.find((entry) => entry.id === pressure.id);
    if (!existing) {
      pressures.push(pressure);
      return;
    }

    if (pressure.priority > existing.priority) {
      Object.assign(existing, pressure);
    }
  };

  const activeJob = activeJobForIntent(world);
  if (activeJob && jobWindowOpen(world, activeJob)) {
    pushPressure({
      actionId: `work:${activeJob.id}`,
      id: `job:${activeJob.id}:active`,
      kind: "job",
      label: `${activeJob.title} is the active commitment`,
      priority: 178,
      rationale: "Rowan is already committed to this job, so it stays ahead of optional objectives.",
      targetLocationId: activeJob.locationId,
    });
  }

  if (
    world.player.energy < 28 &&
    world.player.homeLocationId &&
    !hasFinalCurrentObjectivePredicateAction(world) &&
    !finalPredicateRoutePending
  ) {
    pushPressure({
      actionId: "rest:home",
      id: "energy:recover",
      kind: "energy",
      label: "Rowan needs recovery before new commitments",
      priority: world.player.energy < 15 ? 182 : 164,
      rationale: "Low energy is live state pressure, not a first-afternoon script step.",
      targetLocationId: world.player.homeLocationId,
    });
  }

  for (const outcome of openObjectivePredicateOutcomes(world)) {
    pushPressure(objectivePlanningPressureFromPredicate(world, outcome));
  }

  if (!finalPredicateRoutePending) {
    for (const job of urgentKnownJobs(world)) {
      const pressure = jobWindowPressure(world, job);
      pushPressure({
        actionId: job.accepted ? `work:${job.id}` : `accept:${job.id}`,
        id: `job:${job.id}`,
        kind: "job",
        label: `${job.title} window is closing`,
        priority: 134 + pressure * 10 + (job.accepted ? 10 : 0),
        rationale: `${job.title} closes around ${formatHour(job.endHour)}, so live time pressure can outrank stale route hints.`,
        targetLocationId: job.locationId,
      });
    }

    for (const problem of urgentKnownProblems(world)) {
      if (hasRequiredProblemItem(world, problem)) {
        pushPressure({
          actionId: `solve:${problem.id}`,
          id: `problem:${problem.id}`,
          kind: "problem",
          label: `${problem.title} is escalating`,
          priority: 106 + problemPressure(problem) * 9,
          rationale: `${problem.title} is changing without Rowan, so the planner should route to the actual fix.`,
          targetLocationId: problem.locationId,
        });
        continue;
      }

      const toolSourceLocationId = toolSourceLocationIdForProblem(problem);
      if (
        toolSourceLocationId &&
        knowsToolSourceForProblem(world, problem) &&
        canBuyRequiredProblemTool(world, problem)
      ) {
        pushPressure({
          actionId: "buy:item-wrench",
          id: `tool:${problem.requiredItemId}:${problem.id}`,
          kind: "tool",
          label: `${problem.title} needs a tool Rowan can get`,
          priority: 100 + problemPressure(problem) * 9,
          rationale: `${problem.title} is blocked by a known tool source, so Rowan should get the tool before returning.`,
          targetLocationId: toolSourceLocationId,
        });
        continue;
      }

      pushPressure({
        actionId: `inspect:${problem.id}`,
        id: `problem:${problem.id}:inspect`,
        kind: "problem",
        label: `${problem.title} needs a reachable next read`,
        priority: 78 + problemPressure(problem) * 7,
        rationale: `${problem.title} is urgent, but the fix is still blocked; inspect the site instead of pretending the tool exists.`,
        targetLocationId: problem.locationId,
      });
    }
  }

  if (objective?.focus === "tool" && !hasItem(world, "item-wrench")) {
    pushPressure({
      actionId: canBuyWrench(world) ? "buy:item-wrench" : undefined,
      id: "tool:item-wrench:objective",
      kind: "tool",
      label: "The current objective needs the wrench",
      priority: 86,
      rationale: "Tool-focused objectives target the legal tool source instead of relying on route copy.",
      targetLocationId: "repair-stall",
    });
  }

  return pressures.sort((left, right) => right.priority - left.priority);
}

function objectivePlanningPressureFromPredicate(
  world: StreetGameState,
  outcome: ObjectiveOutcomeState,
): ObjectivePlanningPressure | undefined {
  const actionTargetLocationId = outcome.actionId
    ? targetLocationIdForActionId(world, outcome.actionId)
    : undefined;
  const npcLocationId = outcome.npcId
    ? npcById(world, outcome.npcId)?.currentLocationId
    : undefined;
  const targetLocationId =
    actionTargetLocationId ?? npcLocationId ?? outcome.targetLocationId;

  if (!targetLocationId) {
    return undefined;
  }

  if (
    !outcome.actionId &&
    !outcome.npcId &&
    targetLocationId === world.player.currentLocationId
  ) {
    return undefined;
  }

  const priority =
    80 +
    objectivePredicatePlanningPriority(outcome) * 6 +
    (outcome.status === "at_risk" ? 10 : 0) +
    (isFinalCurrentObjectivePredicateOutcome(world, outcome) ? 120 : 0);

  return {
    actionId: outcome.actionId,
    id: `predicate:${outcome.id}`,
    kind: "predicate",
    label: `${outcome.label} is an open desired-state predicate`,
    matchedOutcomeId: outcome.id,
    npcId: outcome.npcId,
    priority,
    rationale: "Objective outcomes are desired-state predicates; route hints can explain, but not override them.",
    targetLocationId,
  };
}

function canBuyRequiredProblemTool(
  world: StreetGameState,
  problem: ProblemState,
) {
  return problem.requiredItemId === "item-wrench" ? canBuyWrench(world) : false;
}

function canBuyWrench(world: StreetGameState) {
  return world.player.money >= 8 && !hasItem(world, "item-wrench");
}

function currentOpenPredicateActionId(world: StreetGameState) {
  if (!world.player.currentLocationId) {
    return undefined;
  }

  const legalActionIds = new Set(
    buildAvailableActions(world)
      .filter((action) => !action.disabled)
      .map((action) => action.id),
  );

  return openObjectivePredicateOutcomes(world).find(
    (outcome) =>
      outcome.actionId &&
      legalActionIds.has(outcome.actionId) &&
      targetLocationIdForActionId(world, outcome.actionId) ===
        world.player.currentLocationId,
  )?.actionId;
}

function hasFinalCurrentObjectivePredicateAction(world: StreetGameState) {
  return openObjectivePredicateOutcomes(world).some((outcome) =>
    isFinalCurrentObjectivePredicateOutcome(world, outcome),
  );
}

function hasFinalCurrentObjectivePredicateRoute(world: StreetGameState) {
  const openOutcomes = openObjectivePredicateOutcomes(world);
  if (openOutcomes.length !== 1) {
    return false;
  }

  const [outcome] = openOutcomes;
  if (
    !outcome ||
    !outcome.actionId ||
    !isFinalCurrentObjectivePredicateOutcome(world, outcome, {
      requireCurrentLocation: false,
      requireLegalAction: false,
    })
  ) {
    return false;
  }

  const targetLocationId =
    targetLocationIdForActionId(world, outcome.actionId) ??
    outcome.targetLocationId;
  return Boolean(
    targetLocationId && targetLocationId !== world.player.currentLocationId,
  );
}

function isFinalCurrentObjectivePredicateOutcome(
  world: StreetGameState,
  outcome: ObjectiveOutcomeState,
  options: {
    requireCurrentLocation?: boolean;
    requireLegalAction?: boolean;
  } = {},
) {
  const requireCurrentLocation = options.requireCurrentLocation ?? true;
  const requireLegalAction = options.requireLegalAction ?? true;

  if (
    !outcome.actionId ||
    (requireCurrentLocation && !world.player.currentLocationId)
  ) {
    return false;
  }

  const openOutcomes = openObjectivePredicateOutcomes(world);
  if (openOutcomes.length !== 1 || openOutcomes[0]?.id !== outcome.id) {
    return false;
  }

  const actionTargetLocationId = targetLocationIdForActionId(
    world,
    outcome.actionId,
  );
  if (
    requireCurrentLocation &&
    actionTargetLocationId !== world.player.currentLocationId
  ) {
    return false;
  }

  if (!requireLegalAction) {
    return Boolean(actionTargetLocationId ?? outcome.targetLocationId);
  }

  return buildAvailableActions(world).some(
    (action) => action.id === outcome.actionId && !action.disabled,
  );
}

function planMatchesExactActionAtLocation(
  world: StreetGameState,
  plan: ObjectivePlan,
  actionId: string,
) {
  return Boolean(
    plannerActionIdForPlan(plan) === actionId &&
      plan.targetLocationId === targetLocationIdForActionId(world, actionId),
  );
}

function bestObjectivePlanningPressureMatch(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string } | undefined,
  plan: ObjectivePlan,
): ObjectivePlanningPressureMatch | undefined {
  return buildObjectivePlanningPressures(world, objective)
    .map((pressure) => ({
      pressure,
      score: scoreObjectivePlanningPressureMatch(world, plan, pressure),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0];
}

function scoreObjectivePlanningPressureMatch(
  world: StreetGameState,
  plan: ObjectivePlan,
  pressure: ObjectivePlanningPressure,
) {
  if (!planMatchesObjectivePlanningPressure(world, plan, pressure)) {
    return 0;
  }

  let score = pressure.priority;
  if (pressure.actionId && plannerActionIdForPlan(plan) === pressure.actionId) {
    score += 24;
  } else if (pressure.npcId && plan.npcId === pressure.npcId) {
    score += 22;
  } else if (
    pressure.targetLocationId &&
    plan.targetLocationId === pressure.targetLocationId
  ) {
    score += 10;
  }

  if (pressure.matchedOutcomeId) {
    score += 4;
  }

  return score;
}

function scoreObjectivePlanningPressureForPlan(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string } | undefined,
  plan: ObjectivePlan,
) {
  const bestMatch = bestObjectivePlanningPressureMatch(world, objective, plan);
  if (bestMatch) {
    return bestMatch.score;
  }

  const pressure = dominantObjectivePlanningPressure(world, objective);
  if (pressure && pressureRequiresFocusedPlan(pressure)) {
    return -Math.min(110, pressure.priority);
  }

  return 0;
}

function planMatchesObjectivePlanningPressure(
  world: StreetGameState,
  plan: ObjectivePlan,
  pressure: ObjectivePlanningPressure,
) {
  if (pressure.actionId) {
    if (plannerActionIdForPlan(plan) === pressure.actionId) {
      return true;
    }

    return Boolean(
      pressure.targetLocationId &&
        planIsRouteTowardLocation(plan, pressure.targetLocationId) &&
        plan.targetLocationId !== world.player.currentLocationId,
    );
  }

  if (pressure.npcId) {
    if (plan.npcId === pressure.npcId) {
      return true;
    }

    return Boolean(
      pressure.targetLocationId &&
        planIsRouteTowardLocation(plan, pressure.targetLocationId) &&
        plan.targetLocationId !== world.player.currentLocationId,
    );
  }

  return Boolean(
    pressure.targetLocationId &&
      planIsRouteTowardLocation(plan, pressure.targetLocationId),
  );
}

function planTargetsUrgentLivePressure(
  world: StreetGameState,
  plan: ObjectivePlan,
) {
  const actionId = plan.actionId ?? "";
  const [kind, targetId] = actionId.split(":");

  if (kind === "buy" && targetId === "item-wrench") {
    return urgentKnownProblems(world).some(
      (problem) =>
        problem.requiredItemId === "item-wrench" &&
        !hasRequiredProblemItem(world, problem) &&
        knowsToolSourceForProblem(world, problem) &&
        toolSourceLocationIdForProblem(problem) === plan.targetLocationId,
    );
  }

  if (targetId) {
    const problem = problemById(world, targetId);
    if (
      problem &&
      urgentKnownProblems(world).some((entry) => entry.id === problem.id) &&
      (kind === "inspect" || kind === "solve")
    ) {
      return true;
    }

    const job = jobById(world, targetId);
    if (
      job &&
      urgentKnownJobs(world).some((entry) => entry.id === job.id) &&
      (kind === "accept" || kind === "work" || kind === "resume")
    ) {
      return true;
    }
  }

  return Boolean(
    plan.targetLocationId &&
      (highestPressureProblemForLocation(world, plan.targetLocationId) ||
        highestPressureJobForLocation(world, plan.targetLocationId) ||
        urgentKnownProblems(world).some(
          (problem) =>
            toolSourceLocationIdForProblem(problem) === plan.targetLocationId &&
            !hasRequiredProblemItem(world, problem) &&
            knowsToolSourceForProblem(world, problem),
        )),
  );
}

function objectivePredicatePlanningPriority(outcome: ObjectiveOutcomeState) {
  const urgency = Math.max(1, outcome.urgency);
  return Math.min(14, urgency + (outcome.status === "at_risk" ? 4 : 2));
}

function objectiveCandidateLocations(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const locationIds = new Set<string>();

  if (world.player.currentLocationId) {
    locationIds.add(world.player.currentLocationId);
  }

  for (const locationId of world.player.knownLocationIds) {
    locationIds.add(locationId);
  }

  for (const locationId of knownLeadLocationIds(world)) {
    locationIds.add(locationId);
  }

  addObjectivePredicateTargetLocationIds(world, locationIds);
  addObjectiveSemanticLocationIds(world, objective, locationIds);

  for (const event of world.cityEvents ?? []) {
    if (
      event.status === "active" ||
      event.tone === "lead" ||
      event.tone === "warning"
    ) {
      locationIds.add(event.locationId);
    }
  }

  if (
    objective.focus === "settle" ||
    objective.focus === "explore" ||
    objective.focus === "people"
  ) {
    for (const location of explorationFrontier(world)) {
      locationIds.add(location.id);
    }
  }

  if (objective.focus === "rest") {
    locationIds.add(world.player.homeLocationId);
  }

  return [...locationIds]
    .map((locationId) => findLocation(world, locationId))
    .filter((location): location is LocationState => Boolean(location));
}

function addObjectivePredicateTargetLocationIds(
  world: StreetGameState,
  locationIds: Set<string>,
) {
  const addLocation = (locationId?: string) => {
    if (locationId && findLocation(world, locationId)) {
      locationIds.add(locationId);
    }
  };

  for (const outcome of openObjectivePredicateOutcomes(world)) {
    addLocation(outcome.targetLocationId);
    if (outcome.npcId) {
      addLocation(npcById(world, outcome.npcId)?.currentLocationId);
    }
    if (outcome.actionId) {
      addLocation(targetLocationIdForActionId(world, outcome.actionId));
    }
  }
}

function addObjectiveSemanticLocationIds(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  locationIds: Set<string>,
) {
  const planningText = objectivePlanningText(world, objective).toLowerCase();
  const addLocation = (locationId?: string) => {
    if (locationId && findLocation(world, locationId)) {
      locationIds.add(locationId);
    }
  };
  const addNpcLocation = (npcId: string) => {
    addLocation(npcById(world, npcId)?.currentLocationId);
  };

  addMentionedEntityLocations(world, planningText, locationIds);

  const scaffoldHints = objectiveRouteSemanticHints(world, objective);
  for (const locationId of scaffoldHints.locationIds) {
    addLocation(locationId);
  }
  for (const npcId of scaffoldHints.npcIds) {
    addNpcLocation(npcId);
  }

  addLivePressureLocationIds(world, locationIds);
}

function addLivePressureLocationIds(
  world: StreetGameState,
  locationIds: Set<string>,
) {
  for (const problem of urgentKnownProblems(world)) {
    if (findLocation(world, problem.locationId)) {
      locationIds.add(problem.locationId);
    }

    const toolSourceLocationId = toolSourceLocationIdForProblem(problem);
    if (
      toolSourceLocationId &&
      !hasRequiredProblemItem(world, problem) &&
      knowsToolSourceForProblem(world, problem) &&
      findLocation(world, toolSourceLocationId)
    ) {
      locationIds.add(toolSourceLocationId);
    }
  }

  for (const job of urgentKnownJobs(world)) {
    if (findLocation(world, job.locationId)) {
      locationIds.add(job.locationId);
    }
  }
}

function addMentionedEntityLocations(
  world: StreetGameState,
  planningText: string,
  locationIds: Set<string>,
) {
  if (!planningText) {
    return;
  }

  for (const location of world.locations) {
    const names = [location.id, location.name, location.shortLabel]
      .map((value) => value.toLowerCase())
      .filter(Boolean);
    if (names.some((name) => planningText.includes(name))) {
      locationIds.add(location.id);
    }
  }

  for (const npc of world.npcs) {
    if (planningText.includes(npc.name.toLowerCase())) {
      locationIds.add(npc.currentLocationId);
    }
  }
}

function objectivePlanForActionAtLocation(
  world: StreetGameState,
  preview: StreetGameState,
  location: LocationState,
  action: ActionOption,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
): ObjectivePlan | undefined {
  const targetId = extractActionTargetId(action.id);
  const npc =
    action.kind === "talk" && targetId ? npcById(preview, targetId) : undefined;

  if (action.kind === "talk" && (!npc || !targetId)) {
    return undefined;
  }

  return {
    actionId: npc ? undefined : action.id,
    npcId: npc?.id,
    rationale: objectivePlanRationale(world, location, action, npc, objective),
    score: 0,
    speech: npc ? buildAutonomousSpeech(world, npc, objective) : undefined,
    targetLocationId: location.id,
  };
}

function objectiveMoveIntentForLocation(
  world: StreetGameState,
  location: LocationState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
): Pick<ObjectivePlan, "actionId" | "npcId" | "rationale" | "speech"> | undefined {
  const predicateIntent = objectivePredicateMoveIntentForLocation(
    world,
    location,
    objective,
  );
  if (predicateIntent) {
    return predicateIntent;
  }

  if (hasOpenObjectivePredicateAuthority(world)) {
    return livePressureMoveIntentForLocation(world, location);
  }

  const buildNpcIntent = (npcId: string, rationale: string) => {
    const npc = npcById(world, npcId);
    if (!npc || npc.currentLocationId !== location.id) {
      return undefined;
    }

    return {
      npcId,
      rationale,
      speech: buildAutonomousSpeech(world, npc, objective),
    };
  };

  const scaffoldIntent = objectiveRouteMoveIntent(world, objective, location.id);
  if (scaffoldIntent) {
    if (scaffoldIntent.npcId) {
      const intent = buildNpcIntent(scaffoldIntent.npcId, scaffoldIntent.rationale);
      if (intent) {
        return scaffoldIntent.actionId
          ? {
              ...intent,
              actionId: scaffoldIntent.actionId,
            }
          : intent;
      }
    }

    if (scaffoldIntent.actionId) {
      return {
        actionId: scaffoldIntent.actionId,
        rationale: scaffoldIntent.rationale,
      };
    }
  }

  const pressureIntent = livePressureMoveIntentForLocation(world, location);
  if (pressureIntent) {
    return pressureIntent;
  }

  return undefined;
}

function objectivePredicateMoveIntentForLocation(
  world: StreetGameState,
  location: LocationState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
): Pick<ObjectivePlan, "actionId" | "npcId" | "rationale" | "speech"> | undefined {
  for (const outcome of openObjectivePredicateOutcomes(world)) {
    const actionLocationId = outcome.actionId
      ? targetLocationIdForActionId(world, outcome.actionId)
      : undefined;
    const npc = outcome.npcId ? npcById(world, outcome.npcId) : undefined;
    const matchesLocation =
      outcome.targetLocationId === location.id ||
      actionLocationId === location.id ||
      npc?.currentLocationId === location.id;

    if (!matchesLocation) {
      continue;
    }

    const preview = previewWorldAtLocation(world, location.id);
    const actionLegal =
      outcome.actionId &&
      buildAvailableActions(preview).some(
        (action) => action.id === outcome.actionId && !action.disabled,
      );

    if (outcome.npcId && npc?.currentLocationId === location.id) {
      return {
        npcId: outcome.npcId,
        rationale: objectiveRouteMoveRationaleForOutcome(
          world,
          objective,
          outcome.label,
        ),
        speech: buildAutonomousSpeech(world, npc, objective),
      };
    }

    if (outcome.actionId && actionLegal) {
      return {
        actionId: outcome.actionId,
        rationale: objectiveRouteMoveRationaleForOutcome(
          world,
          objective,
          outcome.label,
        ),
      };
    }

    return {
      rationale: objectiveRouteMoveRationaleForOutcome(
        world,
        objective,
        outcome.label,
      ),
    };
  }

  return undefined;
}

function livePressureMoveIntentForLocation(
  world: StreetGameState,
  location: LocationState,
): Pick<ObjectivePlan, "actionId" | "rationale"> | undefined {
  const problem = highestPressureProblemForLocation(world, location.id);
  if (problem) {
    if (hasRequiredProblemItem(world, problem)) {
      return {
        actionId: `solve:${problem.id}`,
        rationale: `${problem.title} is live and urgent, so Rowan should deal with it before it spreads further.`,
      };
    }

    return {
      rationale: `${problem.title} is getting worse, but Rowan still needs the right tool before he can solve it.`,
    };
  }

  const job = highestPressureJobForLocation(world, location.id);
  if (job) {
    return {
      actionId: job.accepted ? `work:${job.id}` : `accept:${job.id}`,
      rationale: `${job.title} is near closing, so Rowan should act on the live work window before it slips.`,
    };
  }

  const toolProblem = urgentKnownProblems(world).find(
    (candidate) =>
      toolSourceLocationIdForProblem(candidate) === location.id &&
      !hasRequiredProblemItem(world, candidate) &&
      knowsToolSourceForProblem(world, candidate),
  );
  if (!toolProblem) {
    return undefined;
  }

  return {
    actionId: "buy:item-wrench",
    rationale: `${toolProblem.title} is escalating, so Rowan should buy the wrench before returning to the leak.`,
  };
}

function objectivePlanRationale(
  world: StreetGameState,
  location: LocationState,
  action: ActionOption,
  npc: NpcState | undefined,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const scaffoldRationale = objectiveRouteActionRationale(world, objective, {
    actionId: action.id,
    npc,
  });
  if (scaffoldRationale) {
    return scaffoldRationale;
  }

  if (action.id === "buy:item-wrench") {
    const pressureProblem = urgentKnownProblems(world).find(
      (problem) =>
        toolSourceLocationIdForProblem(problem) === location.id &&
        !hasRequiredProblemItem(world, problem) &&
        knowsToolSourceForProblem(world, problem),
    );
    if (pressureProblem) {
      return `${pressureProblem.title} is escalating, so Rowan should buy the wrench before returning to the leak.`;
    }
  }

  const targetId = extractActionTargetId(action.id);
  const job = targetId ? jobById(world, targetId) : undefined;
  if (
    job &&
    urgentKnownJobs(world).some((candidate) => candidate.id === job.id) &&
    (action.kind === "accept_job" || action.kind === "work_job")
  ) {
    return `${job.title} closes around ${formatHour(job.endHour)}, so Rowan should take the live work before the city moves on.`;
  }

  return npc
    ? `Speak with ${npc.name} at ${location.name}.`
    : `${action.label} at ${location.name}.`;
}

function scoreObjectiveAgentPlan(
  world: StreetGameState,
  preview: StreetGameState,
  input: {
    action: ActionOption;
    desiredOutcomes: StreetPlanningObjectiveOutcome[];
    objective: { text: string; focus: ObjectiveFocus; routeKey: string };
    plan: ObjectivePlan;
    planningText: string;
  },
) {
  const distancePenalty =
    !input.plan.targetLocationId ||
    input.plan.targetLocationId === world.player.currentLocationId
      ? 0
      : distanceToLocation(world, input.plan.targetLocationId) * 0.75;
  const currentLocationBonus =
    input.plan.targetLocationId === world.player.currentLocationId ? 14 : 0;
  const liveStatePressureBonus = scoreLiveStatePressureForAction(world, input);
  const staleConversationPenalty = scoreRecentConversationRepeatPenalty(
    world,
    input.action,
  );

  return (
    scoreAutoActionForObjective(
      preview,
      input.action,
      input.planningText,
      input.objective.focus,
    ) +
    scorePlanForDesiredOutcomes(world, input.plan, input.desiredOutcomes) +
    scoreOpenPredicateAuthorityForPlan(world, input.plan) +
    distancePenalty +
    currentLocationBonus +
    liveStatePressureBonus +
    staleConversationPenalty
  );
}

function scoreRecentConversationRepeatPenalty(
  world: StreetGameState,
  action: ActionOption,
) {
  if (action.kind !== "talk") {
    return 0;
  }

  const npcId = extractActionTargetId(action.id);
  const npc = npcId ? npcById(world, npcId) : undefined;
  if (!npc || countPlayerConversationsWithNpc(world, npc.id) === 0) {
    return 0;
  }

  return minutesSinceLastNpcConversation(world, npc) < 15 ? -80 : -20;
}

function scoreLiveStatePressureForAction(
  world: StreetGameState,
  input: {
    action: ActionOption;
    objective: { text: string; focus: ObjectiveFocus; routeKey: string };
    plan: ObjectivePlan;
  },
) {
  const objectivePressureScore = scoreObjectivePlanningPressureForPlan(
    world,
    input.objective,
    input.plan,
  );
  if (objectivePressureScore !== 0) {
    return objectivePressureScore;
  }

  const pressureActionScore = scoreLiveProblemPressureForAction(
    world,
    input.action,
    input.plan.targetLocationId,
  );
  if (pressureActionScore !== 0) {
    return pressureActionScore;
  }

  const jobPressureActionScore = scoreLiveJobPressureForAction(
    world,
    input.action,
    input.plan.targetLocationId,
  );
  if (jobPressureActionScore !== 0) {
    return jobPressureActionScore;
  }

  const routeActionScore = objectiveRouteActionPressureScore(input.objective, {
    actionId: input.action.id,
    actionKind: input.action.kind,
    currentLocationId: world.player.currentLocationId,
    planTargetLocationId: input.plan.targetLocationId,
    predicateAuthority: hasOpenObjectivePredicateAuthority(world),
  });
  if (routeActionScore !== 0) {
    return routeActionScore;
  }

  if (
    input.objective.focus === "explore" &&
    input.plan.targetLocationId &&
    input.plan.targetLocationId !== world.player.currentLocationId &&
    input.action.kind === "talk"
  ) {
    return -42;
  }

  if (input.plan.targetLocationId !== world.player.currentLocationId) {
    return 0;
  }

  const targetId = extractActionTargetId(input.action.id);
  if (!targetId) {
    return 0;
  }

  const problem = problemById(world, targetId);
  if (
    problem?.status === "active" &&
    problem.locationId === world.player.currentLocationId
  ) {
    if (input.action.kind === "solve" && !input.action.disabled) {
      return 42;
    }

    if (input.action.kind === "inspect") {
      return 24;
    }
  }

  const job = jobById(world, targetId);
  if (
    job?.accepted &&
    !job.completed &&
    !job.missed &&
    job.locationId === world.player.currentLocationId &&
    (input.action.kind === "work_job" || input.action.id.startsWith("resume:"))
  ) {
    return 34;
  }

  return 0;
}

function scoreObjectiveAgentMovePlan(
  world: StreetGameState,
  input: {
    desiredOutcomes: StreetPlanningObjectiveOutcome[];
    location: LocationState;
    objective: { text: string; focus: ObjectiveFocus; routeKey: string };
    plan: ObjectivePlan;
    planningText: string;
  },
) {
  const known = world.player.knownLocationIds.includes(input.location.id);
  const hasActiveEvent = (world.cityEvents ?? []).some(
    (event) =>
      event.locationId === input.location.id && event.status === "active",
  );
  const hasLead = knownLeadLocationIds(world).includes(input.location.id);
  let score = known ? 2 : 0;

  if (hasLead) {
    score += 8;
  }

  if (hasActiveEvent) {
    score += 6;
  }

  if (
    input.objective.focus === "explore" &&
    !world.player.knownLocationIds.includes(input.location.id)
  ) {
    score += 14;
  }

  if (
    input.objective.focus === "settle" &&
    !world.player.knownLocationIds.includes(input.location.id)
  ) {
    score += 5;
  }

  score += scorePlanForDesiredOutcomes(
    world,
    input.plan,
    input.desiredOutcomes,
  );
  score += scoreOpenPredicateAuthorityForPlan(world, input.plan);
  score += scoreSemanticMovePressure(world, input);
  score -= distanceToLocation(world, input.location.id) * 0.45;
  return score;
}

function scoreSemanticMovePressure(
  world: StreetGameState,
  input: {
    location: LocationState;
    objective: { text: string; focus: ObjectiveFocus; routeKey: string };
    planningText: string;
  },
) {
  const locationId = input.location.id;
  const planningText = input.planningText.toLowerCase();
  const predicateAuthority = hasOpenObjectivePredicateAuthority(world);
  let score = 0;

  score += scoreObjectivePlanningPressureForPlan(world, input.objective, {
    rationale: `Move toward ${input.location.name}.`,
    score: 0,
    targetLocationId: locationId,
  });

  score += objectiveRouteSemanticMoveBonus(world, input.objective, locationId, {
    planningText,
    predicateAuthority,
  });

  score += scoreLiveProblemPressureForMove(world, locationId);
  score += scoreLiveJobPressureForMove(world, locationId);

  return score;
}

function scoreLiveProblemPressureForAction(
  world: StreetGameState,
  action: ActionOption,
  targetLocationId?: string,
) {
  const [kind, targetId] = action.id.split(":");

  if (kind === "buy" && targetId === "item-wrench") {
    const problem = urgentKnownProblems(world).find(
      (candidate) =>
        candidate.requiredItemId === "item-wrench" &&
        !hasRequiredProblemItem(world, candidate) &&
        knowsToolSourceForProblem(world, candidate) &&
        toolSourceLocationIdForProblem(candidate) === targetLocationId,
    );
    return problem ? 56 + problemPressure(problem) * 7 : 0;
  }

  if (!targetId) {
    return 0;
  }

  const problem = problemById(world, targetId);
  if (!problem || !urgentKnownProblems(world).some((entry) => entry.id === problem.id)) {
    return 0;
  }

  if (kind === "solve" && !action.disabled) {
    return 60 + problemPressure(problem) * 8;
  }

  if (kind === "inspect") {
    return 24 + problemPressure(problem) * 4;
  }

  return 0;
}

function scoreLiveJobPressureForAction(
  world: StreetGameState,
  action: ActionOption,
  targetLocationId?: string,
) {
  const [kind, targetId] = action.id.split(":");
  if (!targetId || (kind !== "accept" && kind !== "work" && kind !== "resume")) {
    return 0;
  }

  const job = jobById(world, targetId);
  if (
    !job ||
    job.locationId !== targetLocationId ||
    !urgentKnownJobs(world).some((entry) => entry.id === job.id)
  ) {
    return 0;
  }

  if (kind === "accept") {
    return 58 + jobWindowPressure(world, job) * 9;
  }

  return 64 + jobWindowPressure(world, job) * 10;
}

function scoreLiveProblemPressureForMove(
  world: StreetGameState,
  locationId: string,
) {
  const problem = highestPressureProblemForLocation(world, locationId);
  if (problem) {
    return hasRequiredProblemItem(world, problem)
      ? 54 + problemPressure(problem) * 6
      : 8 + problemPressure(problem);
  }

  const toolProblem = urgentKnownProblems(world).find(
    (candidate) =>
      toolSourceLocationIdForProblem(candidate) === locationId &&
      !hasRequiredProblemItem(world, candidate) &&
      knowsToolSourceForProblem(world, candidate),
  );

  return toolProblem ? 48 + problemPressure(toolProblem) * 7 : 0;
}

function scoreLiveJobPressureForMove(
  world: StreetGameState,
  locationId: string,
) {
  const job = highestPressureJobForLocation(world, locationId);
  return job ? 50 + jobWindowPressure(world, job) * 8 : 0;
}

function urgentKnownProblems(world: StreetGameState) {
  return world.problems
    .filter(
      (problem) =>
        problem.discovered &&
        problem.status === "active" &&
        (problem.urgency >= 4 || (problem.escalationLevel ?? 0) > 0),
    )
    .sort((left, right) => problemPressure(right) - problemPressure(left));
}

function urgentKnownJobs(world: StreetGameState) {
  return world.jobs
    .filter(
      (job) =>
        (job.discovered || job.accepted) &&
        !job.completed &&
        !job.missed &&
        jobWindowMinutesRemaining(world, job) >= 0 &&
        jobWindowMinutesRemaining(world, job) <= JOB_WINDOW_PRESSURE_MINUTES,
    )
    .sort(
      (left, right) =>
        jobWindowMinutesRemaining(world, left) -
        jobWindowMinutesRemaining(world, right),
    );
}

function highestPressureProblemForLocation(
  world: StreetGameState,
  locationId: string,
) {
  return urgentKnownProblems(world).find(
    (problem) => problem.locationId === locationId,
  );
}

function highestPressureJobForLocation(
  world: StreetGameState,
  locationId: string,
) {
  return urgentKnownJobs(world).find((job) => job.locationId === locationId);
}

function problemPressure(problem: ProblemState) {
  return problem.urgency + (problem.escalationLevel ?? 0);
}

function jobWindowPressure(world: StreetGameState, job: JobState) {
  const remaining = Math.max(0, jobWindowMinutesRemaining(world, job));
  return Math.max(
    1,
    Math.ceil((JOB_WINDOW_PRESSURE_MINUTES - remaining) / 15) + 1,
  );
}

function jobWindowMinutesRemaining(world: StreetGameState, job: JobState) {
  return totalMinutesForDayHour(world.clock.day, job.endHour) - world.clock.totalMinutes;
}

function jobWindowOpen(world: StreetGameState, job: JobState | undefined) {
  return Boolean(
    job &&
      !job.completed &&
      !job.missed &&
      jobWindowMinutesRemaining(world, job) > 0,
  );
}

function jobWindowClosed(world: StreetGameState, job: JobState | undefined) {
  return Boolean(
    job &&
      !job.completed &&
      (job.missed || jobWindowMinutesRemaining(world, job) <= 0),
  );
}

function hasRequiredProblemItem(world: StreetGameState, problem: ProblemState) {
  return !problem.requiredItemId || hasItem(world, problem.requiredItemId);
}

function toolSourceLocationIdForProblem(problem: ProblemState) {
  if (problem.requiredItemId === "item-wrench") {
    return "repair-stall";
  }

  return undefined;
}

function knowsToolSourceForProblem(
  world: StreetGameState,
  problem: ProblemState,
) {
  if (problem.requiredItemId !== "item-wrench") {
    return false;
  }

  return (
    world.player.knownLocationIds.includes("repair-stall") ||
    world.player.knownNpcIds.includes("npc-jo") ||
    world.player.memories.some(
      (entry) => /\b(Jo|Mercer Repairs|wrench|repair stall)\b/i.test(entry.text),
    )
  );
}

function buildObjectiveWaitPlans(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  desiredOutcomes: StreetPlanningObjectiveOutcome[],
): ObjectivePlan[] {
  const plans: ObjectivePlan[] = [];
  const currentTotal = world.clock.totalMinutes;
  const activeJob = activeJobForIntent(world);

  if (activeJob) {
    const startTotal = totalMinutesForDayHour(world.clock.day, activeJob.startHour);
    if (
      currentTotal < startTotal &&
      startTotal - currentTotal <= 90 &&
      world.player.currentLocationId === activeJob.locationId
    ) {
      plans.push({
        actionId: `wait:${startTotal}`,
        rationale: `Hold here until ${activeJob.title.toLowerCase()} opens.`,
        score: 14 + scorePlanForDesiredOutcomes(world, { score: 0, rationale: "", waitUntilMinutes: startTotal }, desiredOutcomes),
        targetLocationId: activeJob.locationId,
        waitUntilMinutes: startTotal,
      });
    }
  }

  for (const event of world.cityEvents ?? []) {
    const eventStartTotal =
      Math.max(0, world.clock.day - 1) * 24 * 60 + event.startMinute;
    const startsSoon =
      event.status === "upcoming" &&
      eventStartTotal > currentTotal &&
      eventStartTotal - currentTotal <= 60;
    if (
      !startsSoon ||
      event.locationId !== world.player.currentLocationId ||
      (event.tone !== "lead" && event.tone !== "warning")
    ) {
      continue;
    }

    const plan: ObjectivePlan = {
      actionId: `wait:${eventStartTotal}`,
      rationale: `${event.title} is about to change what is available here.`,
      score: 7 + (objective.focus === "work" ? 4 : 0),
      targetLocationId: event.locationId,
      waitUntilMinutes: eventStartTotal,
    };
    plan.score += scorePlanForDesiredOutcomes(world, plan, desiredOutcomes);
    plans.push(plan);
  }

  return plans;
}

function dedupeObjectivePlans(plans: ObjectivePlan[]) {
  const byAction = new Map<string, ObjectivePlan>();

  for (const plan of plans) {
    const key =
      plannerActionIdForPlan(plan) ??
      [
        plan.targetLocationId ?? "here",
        plan.npcId ?? "no-npc",
        plan.actionId ?? "no-action",
        plan.waitUntilMinutes ?? "no-wait",
      ].join(":");
    const existing = byAction.get(key);
    if (!existing || plan.score > existing.score) {
      byAction.set(key, plan);
    }
  }

  return [...byAction.values()];
}

function objectivePlanningText(
  world: StreetGameState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const parts = [objective.text];
  const latestThread = latestObjectiveConversationThread(world);
  if (latestThread) {
    if (latestThread.objectiveText) {
      parts.push(latestThread.objectiveText);
    }
    if (latestThread.decision) {
      parts.push(latestThread.decision);
    }
    if (latestThread.summary) {
      parts.push(latestThread.summary);
    }
  }

  return [
    ...new Set(
      parts.map((part) => normalizeObjectiveText(part)).filter(Boolean),
    ),
  ].join(" ");
}

function planMovementPurpose(
  world: StreetGameState,
  plan: ObjectivePlan,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  if (plan.npcId) {
    const npc = npcById(world, plan.npcId);
    if (npc) {
      return `talk to ${npc.name}`;
    }
  }

  if (plan.actionId) {
    const [kind, targetId] = plan.actionId.split(":");

    if ((kind === "accept" || kind === "work") && targetId) {
      const job = jobById(world, targetId);
      if (job) {
        return kind === "accept"
          ? `take ${job.title.toLowerCase()}`
          : `work ${job.title.toLowerCase()}`;
      }
    }

    if ((kind === "inspect" || kind === "solve") && targetId) {
      const problem = problemById(world, targetId);
      if (problem) {
        return kind === "inspect"
          ? `inspect ${problem.title.toLowerCase()}`
          : `solve ${problem.title.toLowerCase()}`;
      }
    }

    if (kind === "buy") {
      return "pick up the tool he needs";
    }

    if (kind === "contribute") {
      return "pull his weight around the house";
    }

    if (kind === "rest") {
      return "get off his feet for an hour";
    }

    if (kind === "reflect") {
      return "take stock of the afternoon";
    }
  }

  if (plan.rationale) {
    return objectiveClause(plan.rationale);
  }

  return objectiveClause(objective.text);
}

function latestObjectiveConversationThread(world: StreetGameState) {
  const threads = Object.values(world.conversationThreads ?? {}).filter(
    (thread) => thread.objectiveText || thread.decision || thread.summary,
  );
  threads.sort((left, right) =>
    compareConversationThreadRecency(world, left, right),
  );
  return threads[0];
}

function compareConversationThreadRecency(
  world: StreetGameState,
  left: {
    npcId: string;
    updatedAt: string;
    lines: { id: string }[];
  },
  right: {
    npcId: string;
    updatedAt: string;
    lines: { id: string }[];
  },
) {
  const activeNpcId = world.activeConversation?.npcId;
  const leftIsActive = left.npcId === activeNpcId;
  const rightIsActive = right.npcId === activeNpcId;
  if (leftIsActive !== rightIsActive) {
    return Number(rightIsActive) - Number(leftIsActive);
  }

  const leftOrder = latestConversationLineOrder(left.lines);
  const rightOrder = latestConversationLineOrder(right.lines);
  if (leftOrder !== rightOrder) {
    return rightOrder - leftOrder;
  }

  return Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
}

function latestConversationLineOrder(lines: { id: string }[]) {
  const latestId = lines.at(-1)?.id ?? "";
  const match = /conversation-(\d+)-/.exec(latestId);
  return match ? Number(match[1]) : 0;
}

function previewWorldAtLocation(world: StreetGameState, locationId: string) {
  const preview = cloneWorld(world);
  const location = findLocation(preview, locationId);
  if (!location) {
    return preview;
  }

  const spaceId = activeLocationActionSpaceId(preview, location.id);
  const space = spaceById(preview, spaceId);
  const spawn =
    space?.anchors.find((anchor) => anchor.kind === "spawn") ??
    space?.tiles.find((tile) => tile.walkable);

  preview.activeSpaceId = spaceId;
  preview.player.spaceId = spaceId;
  preview.player.x = spawn?.x ?? location.entryX;
  preview.player.y = spawn?.y ?? location.entryY;
  preview.player.currentLocationId = location.id;
  return preview;
}

function canAutoPlanAction(
  world: StreetGameState,
  locationId: string,
  action: ActionOption,
  preview: StreetGameState,
) {
  if (
    action.kind === "inspect" &&
    locationId !== world.player.currentLocationId
  ) {
    return false;
  }

  if (action.kind !== "talk") {
    return true;
  }

  const npcId = extractActionTargetId(action.id);
  const npc = npcId ? npcById(preview, npcId) : undefined;
  if (!npc) {
    return false;
  }

  return (
    npc.known ||
    locationId === world.player.currentLocationId ||
    world.player.knownLocationIds.includes(locationId)
  );
}

function explorationFrontier(world: StreetGameState) {
  const knownLocationIds = new Set(world.player.knownLocationIds);

  return world.locations
    .filter((location) => !knownLocationIds.has(location.id))
    .map((location) => ({
      location,
      distanceFromPlayer: distanceToLocation(world, location.id),
      distanceFromKnown: nearestKnownLocationDistance(world, location.id),
    }))
    .sort((left, right) => {
      if (left.distanceFromKnown !== right.distanceFromKnown) {
        return left.distanceFromKnown - right.distanceFromKnown;
      }

      return left.distanceFromPlayer - right.distanceFromPlayer;
    })
    .slice(0, 3)
    .map((entry) => entry.location);
}

function knownLeadLocationIds(world: StreetGameState) {
  const leadLocationIds = new Set<string>();

  for (const job of world.jobs) {
    if (job.discovered) {
      leadLocationIds.add(job.locationId);
    }
  }

  for (const problem of world.problems) {
    if (problem.discovered) {
      leadLocationIds.add(problem.locationId);
    }
  }

  return [...leadLocationIds];
}

function nearestKnownLocationDistance(
  world: StreetGameState,
  locationId: string,
) {
  const knownLocationIds = world.player.knownLocationIds;
  if (knownLocationIds.length === 0) {
    return distanceToLocation(world, locationId);
  }

  return Math.min(
    ...knownLocationIds.map((knownLocationId) =>
      locationDistance(world, knownLocationId, locationId),
    ),
  );
}

function locationDistance(
  world: StreetGameState,
  fromLocationId: string,
  toLocationId: string,
) {
  const from = findLocation(world, fromLocationId);
  const to = findLocation(world, toLocationId);
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(from.entryX - to.entryX) + Math.abs(from.entryY - to.entryY);
}

function distanceToLocation(world: StreetGameState, locationId: string) {
  const location = findLocation(world, locationId);
  if (!location) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    Math.abs(world.player.x - location.entryX) +
    Math.abs(world.player.y - location.entryY)
  );
}

function scoreAutoActionForObjective(
  world: StreetGameState,
  action: ActionOption,
  objectiveText: string,
  objectiveFocus: ObjectiveFocus,
) {
  let score =
    scoreActionForObjective(action, objectiveText, objectiveFocus) * 2;
  const targetId = extractActionTargetId(action.id);
  const targetJob =
    (action.kind === "accept_job" || action.kind === "work_job") && targetId
      ? jobById(world, targetId)
      : undefined;

  if (
    targetJob?.deferredUntilMinutes !== undefined &&
    world.clock.totalMinutes < targetJob.deferredUntilMinutes
  ) {
    return -40;
  }

  if (action.kind === "work_job") {
    score += 18;
  }

  if (action.kind === "accept_job") {
    score += 14;

    if (targetId) {
      const job = jobById(world, targetId);
      const giver = job ? npcById(world, job.giverNpcId) : undefined;
      if (
        job &&
        giver &&
        giver.currentLocationId === job.locationId &&
        countPlayerConversationsWithNpc(world, giver.id) === 0
      ) {
        score -= 22;
      }
    }
  }

  if (action.kind === "solve") {
    score += 16;
  }

  if (action.kind === "buy") {
    score += 12;
  }

  if (action.kind === "contribute") {
    score += objectiveFocus === "settle" ? 18 : 8;
  }

  if (action.kind === "inspect") {
    score += objectiveFocus === "help" || objectiveFocus === "explore" ? 8 : 4;
  }

  if (action.kind === "rest") {
    score += world.player.energy < 40 || objectiveFocus === "rest" ? 14 : 0;
  }

  if (action.kind === "talk" && targetId) {
    const npc = npcById(world, targetId);
    const playerConversationCount = countPlayerConversationsWithNpc(
      world,
      targetId,
    );
    score += scoreNpcForObjectiveAffinity({
      allowImmediateFollowup: npc
        ? shouldAllowImmediateNpcFollowup(
            world,
            npc,
            objectiveText,
            playerConversationCount,
          )
        : false,
      minutesSinceConversation: npc
        ? minutesSinceLastNpcConversation(world, npc)
        : Number.POSITIVE_INFINITY,
      npc,
      objectiveFocus,
      objectiveText,
      playerConversationCount,
      totalNpcCount: world.npcs.length,
      uniqueNpcConversations: countUniqueNpcConversations(world),
    });
  }

  if (world.player.activeJobId && targetId === world.player.activeJobId) {
    score += 30;
  }

  return score;
}

function shouldAllowImmediateNpcFollowup(
  world: StreetGameState,
  npc: NpcState,
  objectiveText: string,
  playerConversationCount: number,
) {
  if (playerConversationCount < 1 || playerConversationCount > 2) {
    return false;
  }

  const latestThread = latestObjectiveConversationThread(world);
  if (!latestThread || latestThread.npcId !== npc.id) {
    return false;
  }

  const cueText = [
    objectiveText,
    latestThread.objectiveText ?? "",
    latestThread.decision ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return cueText.includes(npc.name.toLowerCase());
}

async function generateAutonomousSpeech(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  aiProvider: AIProvider,
) {
  syncRowanAutonomy(world);
  if (objectiveRouteDeterministicOpening(objective, npc.id)) {
    return buildAutonomousSpeech(world, npc, objective);
  }

  const generated = await aiProvider.generateStreetAutonomousLine({
    game: world,
    npcId: npc.id,
    objective,
    purpose: "opener",
  });
  const normalized = normalizeSpeechText(generated.speech ?? "");
  if (normalized) {
    return normalized;
  }

  return buildAutonomousSpeech(world, npc, objective);
}

async function generateAutonomousContinuation(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
  aiProvider: AIProvider,
) {
  syncRowanAutonomy(world);
  const generated = await aiProvider.generateStreetAutonomousLine({
    game: world,
    lastNpcReply,
    npcId: npc.id,
    objective,
    purpose: "followup",
  });
  const normalized = normalizeSpeechText(generated.speech ?? "");
  if (normalized) {
    return normalized;
  }

  return buildAutonomousContinuation(world, npc, objective, lastNpcReply);
}

async function resolveConversationResolution(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  closingReply: string,
  discussedTopics: Set<string>,
  aiProvider: AIProvider,
) {
  const heuristic = deriveConversationResolution(
    world,
    npc,
    objective,
    closingReply,
    discussedTopics,
  );
  syncRowanAutonomy(world);
  const interpreted = await aiProvider.interpretStreetConversation({
    closingReply,
    discussedTopics: [...discussedTopics],
    game: world,
    npcId: npc.id,
    objective,
  });

  return sanitizeConversationResolutionForVisibleEvidence(
    world,
    npc,
    objective,
    {
    decision: interpreted.decision ?? heuristic.decision,
    memoryKind: interpreted.memoryText
      ? (interpreted.memoryKind ?? heuristic.memoryKind)
      : heuristic.memoryKind,
    memoryText: interpreted.memoryText ?? heuristic.memoryText,
    npcImpression: interpreted.npcImpression ?? heuristic.npcImpression,
    objectiveText: interpreted.objectiveText ?? heuristic.objectiveText,
    summary: interpreted.summary ?? heuristic.summary,
    },
    closingReply,
  );
}

function buildAutonomousSpeech(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const text = objective.text.toLowerCase();
  const playerConversationCount = countPlayerConversationsWithNpc(
    world,
    npc.id,
  );
  const cognition = buildRowanCognition(world);
  const primaryNeed = cognition.primaryNeed?.key;
  const teaLeadKnown = cognition.beliefs.some(
    (belief) => belief.id === "belief-ada-work",
  );
  const yardLeadKnown = cognition.beliefs.some(
    (belief) => belief.id === "belief-tomas-work",
  );
  const lastNpcReply = [...world.conversations]
    .reverse()
    .find((entry) => entry.npcId === npc.id && entry.speaker === "npc")
    ?.text.toLowerCase();

  if (playerConversationCount > 0) {
    const followup = buildAutonomousFollowup(
      world,
      npc.id,
      objective.focus,
      text,
      lastNpcReply,
    );
    if (followup) {
      return followup;
    }
  }

  const scaffoldSpeech = objectiveRouteSpeech(world, objective, npc, {
    normalizedObjectiveText: text,
    playerConversationCount,
  });
  if (scaffoldSpeech) {
    return scaffoldSpeech;
  }

  return objectiveRouteAutonomousOpeningSpeech({
    npcId: npc.id,
    objectiveClause: objectiveClause(objective.text),
    objectiveFocus: objective.focus,
    objectiveText: text,
    primaryNeed,
    teaLeadKnown,
    yardLeadKnown,
  });
}

function buildAutonomousFollowup(
  world: StreetGameState,
  npcId: string,
  objectiveFocus: ObjectiveFocus,
  objectiveText: string,
  lastNpcReply?: string,
) {
  const cognition = buildRowanCognition(world);
  const primaryNeed = cognition.primaryNeed?.key;
  const normalizedReply = lastNpcReply ?? "";
  const replyTopics = detectConversationTopics(normalizedReply);
  const replyNamesAdaLead = /\bada\b|\bkettle\b|\blamp\b/.test(normalizedReply);
  const replyNamesTomasLead = /\btomas\b|\bnorth crane\b|\byard\b/.test(
    normalizedReply,
  );

  return objectiveRouteAutonomousFollowupSpeech({
    npcId,
    objectiveFocus,
    objectiveText,
    primaryNeed,
    replyNamesAdaLead,
    replyNamesTomasLead,
    replyText: normalizedReply,
    replyTopics: [...replyTopics],
  });
}

function extractActionTargetId(actionId: string) {
  const parts = actionId.split(":");
  return parts.length > 1 ? parts[1] : undefined;
}

function targetLocationIdForActionId(
  world: StreetGameState,
  actionId: string,
): string | undefined {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "move":
      return targetId && findLocation(world, targetId) ? targetId : undefined;
    case "enter":
    case "exit":
      return targetId && findLocation(world, targetId) ? targetId : undefined;
    case "accept":
    case "work":
    case "resume":
      return targetId ? jobById(world, targetId)?.locationId : undefined;
    case "inspect":
    case "solve":
      return targetId ? problemById(world, targetId)?.locationId : undefined;
    case "talk":
      return targetId ? npcById(world, targetId)?.currentLocationId : undefined;
    case "buy":
      return targetId === "item-wrench" ? "repair-stall" : undefined;
    case "contribute":
      return targetId && findLocation(world, targetId) ? targetId : undefined;
    case "rest":
      return world.player.homeLocationId;
    case "reflect":
      return objectiveRouteActionTargetLocation(
        world,
        world.player.objective,
        actionId,
      );
    default:
      return undefined;
  }
}

function acceptJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  const location = currentLocation(world);

  if (job.missed || job.completed) {
    addFeed(world, "info", `${job.title} is no longer on the table.`);
    return;
  }

  if (!job.discovered) {
    addFeed(
      world,
      "info",
      "You cannot commit to work you have not actually found yet.",
    );
    return;
  }

  if (currentHour(world) >= job.endHour) {
    addFeed(world, "info", `You are too late for ${job.title.toLowerCase()}.`);
    job.missed = true;
    return;
  }

  if (
    !location ||
    location.id !== job.locationId ||
    !isPlayerInActionSpace(world, job.locationId)
  ) {
    addFeed(
      world,
      "info",
      "You need to be at the job site before you can commit to the work.",
    );
    return;
  }

  if (currentHour(world) >= job.startHour && world.player.energy < 28) {
    addFeed(
      world,
      "info",
      "You are too worn down to take work that starts now.",
    );
    return;
  }

  if (world.player.activeJobId && world.player.activeJobId !== job.id) {
    addFeed(world, "info", "You already have another commitment.");
    return;
  }

  job.accepted = true;
  job.deferredUntilMinutes = undefined;
  world.player.activeJobId = job.id;
  addFeed(world, "job", `You took ${job.title.toLowerCase()}.`);
  remember(
    world,
    "job",
    `You committed to ${job.title.toLowerCase()} at ${findLocation(world, job.locationId)?.name}.`,
  );
}

function deferJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(world, "info", "There is no live commitment here to push back.");
    return;
  }

  const dayStartMinutes = (world.clock.day - 1) * 24 * 60;
  const lastUsefulMinute = dayStartMinutes + job.endHour * 60 - 15;
  const deferredUntil = Math.min(
    world.clock.totalMinutes + 60,
    lastUsefulMinute,
  );

  if (deferredUntil <= world.clock.totalMinutes + 5) {
    addFeed(
      world,
      "info",
      `There is not enough room left to safely defer ${job.title.toLowerCase()}.`,
    );
    return;
  }

  job.deferredUntilMinutes = deferredUntil;
  world.player.currentThought = `I'm keeping ${job.title.toLowerCase()} alive, but not until about ${formatClockAt(world, deferredUntil)}.`;
  addFeed(
    world,
    "info",
    `You keep ${job.title.toLowerCase()} in hand, but push it back until about ${formatClockAt(world, deferredUntil)}.`,
  );
  remember(
    world,
    "self",
    `You pushed ${job.title.toLowerCase()} back for a bit instead of dropping the commitment entirely.`,
  );
}

function abandonJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(
      world,
      "info",
      "There is no live commitment here to walk away from.",
    );
    return;
  }

  job.accepted = false;
  job.missed = true;
  job.deferredUntilMinutes = undefined;
  world.player.activeJobId = undefined;
  addFeed(world, "job", `You walked away from ${job.title.toLowerCase()}.`);
  remember(
    world,
    "job",
    `You let ${job.title.toLowerCase()} go instead of bending the day around it.`,
  );
}

function resumeJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(
      world,
      "info",
      "There is no paused commitment here to pick back up.",
    );
    return;
  }

  if (job.deferredUntilMinutes === undefined) {
    addFeed(world, "info", `${job.title} is already live in Rowan's head.`);
    return;
  }

  job.deferredUntilMinutes = undefined;
  addFeed(
    world,
    "info",
    `You pull ${job.title.toLowerCase()} back to the front of Rowan's day.`,
  );
  remember(
    world,
    "self",
    `You brought ${job.title.toLowerCase()} back to the front instead of letting it wait any longer.`,
  );
}

function workJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  const location = currentLocation(world);
  if (
    !location ||
    location.id !== job.locationId ||
    !isPlayerInActionSpace(world, job.locationId)
  ) {
    addFeed(world, "info", "You need to be at the job site to do the work.");
    return;
  }

  if (!job.accepted) {
    addFeed(world, "info", "Nobody is paying you for this yet.");
    return;
  }

  if (job.completed || job.missed) {
    addFeed(world, "info", `${job.title} has already resolved.`);
    return;
  }

  const workAlreadyStarted = jobIsStartedCommitment(world, job);

  if (
    currentHour(world) < job.startHour ||
    (currentHour(world) >= job.endHour && !workAlreadyStarted)
  ) {
    addFeed(
      world,
      "info",
      "The shift window is wrong. Either you are early, or the work has moved on.",
    );
    return;
  }

  if (world.player.energy < 28) {
    addFeed(
      world,
      "info",
      "You are too worn down to be much help on this shift.",
    );
    return;
  }

  if (job.id === "job-tea-shift") {
    world.firstAfternoon ??= {};
    if (!world.firstAfternoon.teaShiftStage) {
      advanceWorld(world, 20, { workingJobId: job.id });
      world.player.energy = clamp(world.player.energy - 4, 12, 100);
      world.firstAfternoon.teaShiftStage = "rush";
      const workStageThought = objectiveRouteWorkStageThought(
        world,
        world.player.objective,
        {
          jobId: job.id,
          stage: world.firstAfternoon.teaShiftStage,
        },
      );
      if (workStageThought) {
        world.player.currentThought = workStageThought;
      }
      const stageNarrative = activeJobStageNarrative(job.id, {
        stage: world.firstAfternoon.teaShiftStage,
      });
      if (stageNarrative) {
        addFeed(world, "job", stageNarrative.feedText);
        if (stageNarrative.memory) {
          rememberIfNew(
            world,
            stageNarrative.memory.kind,
            stageNarrative.memory.text,
          );
        }
      }
      return;
    }

    if (world.firstAfternoon.teaShiftStage === "rush") {
      advanceWorld(world, 25, { workingJobId: job.id });
      world.player.energy = clamp(world.player.energy - 5, 12, 100);
      world.firstAfternoon.teaShiftStage = "counter";
      movePlayerWithinActiveSpaceForWork(world, { x: 7, y: 5 });
      const workStageThought = objectiveRouteWorkStageThought(
        world,
        world.player.objective,
        {
          jobId: job.id,
          stage: world.firstAfternoon.teaShiftStage,
        },
      );
      if (workStageThought) {
        world.player.currentThought = workStageThought;
      }
      const stageNarrative = activeJobStageNarrative(job.id, {
        stage: world.firstAfternoon.teaShiftStage,
      });
      if (stageNarrative) {
        addFeed(world, "job", stageNarrative.feedText);
        if (stageNarrative.memory) {
          rememberIfNew(
            world,
            stageNarrative.memory.kind,
            stageNarrative.memory.text,
          );
        }
      }
      return;
    }
  }

  const workMinutes =
    job.id === "job-tea-shift" &&
    world.firstAfternoon?.teaShiftStage === "counter"
      ? Math.max(
          5,
          totalMinutesForDayHour(world.clock.day, job.endHour) -
            world.clock.totalMinutes,
        )
      : Math.max(5, job.durationMinutes - (job.progressMinutes ?? 0));

  const workAdvance = advanceWorldUntilIndependentNpcAction(world, workMinutes, {
    workingJobId: job.id,
  });
  const totalProgressMinutes = Math.min(
    job.durationMinutes,
    (job.progressMinutes ?? 0) + workAdvance.advancedMinutes,
  );
  const energyCost = Math.max(
    1,
    Math.round((14 * workAdvance.advancedMinutes) / job.durationMinutes),
  );

  if (workAdvance.interrupted && totalProgressMinutes < job.durationMinutes) {
    job.progressMinutes = totalProgressMinutes;
    world.player.energy = clamp(world.player.energy - energyCost, 12, 100);
    world.player.activeJobId = job.id;
    job.accepted = true;
    const interruptionNarrative = activeJobInterruptionNarrative(job.id, {
      jobTitle: job.title,
      pay: job.pay,
    });
    addFeed(world, "job", interruptionNarrative.feedText);
    rememberIfNew(world, "job", interruptionNarrative.memoryText);
    return;
  }

  job.progressMinutes = job.durationMinutes;
  world.player.money += job.pay;
  world.player.energy = clamp(world.player.energy - energyCost, 12, 100);
  world.player.activeJobId = undefined;
  job.accepted = false;
  job.completed = true;
  job.missed = false;
  job.deferredUntilMinutes = undefined;

  const npc = npcById(world, job.giverNpcId);
  if (npc) {
    npc.trust += 1;
  }

  const completionNarrative = activeJobCompletionNarrative(job.id, {
    jobTitle: job.title,
    pay: job.pay,
  });

  if (job.id === "job-tea-shift") {
    world.firstAfternoon ??= {};
    world.firstAfternoon.teaShiftStage = "paid";
    discoverJob(world, "job-yard-shift");
  }
  if (completionNarrative.currentThought) {
    world.player.currentThought = completionNarrative.currentThought;
  }
  addFeed(world, "job", completionNarrative.feedText);
  if (job.id !== "job-tea-shift") {
    addYardWorkPumpConsequenceFeed(world, job);
  }

  remember(world, "job", completionNarrative.memoryText);
}

function addYardWorkPumpConsequenceFeed(
  world: StreetGameState,
  job: JobState,
): void {
  if (job.id !== "job-yard-shift") {
    return;
  }

  const pumpProblem = problemById(world, "problem-pump");
  if (
    pumpProblem?.status !== "resolved" ||
    pumpProblem.resolvedByNpcId !== "npc-mara"
  ) {
    return;
  }

  const narrative = yardWorkPumpConsequenceNarrative(job.id);
  if (!narrative) {
    return;
  }

  addFeed(world, "problem", narrative.feedText);
  rememberIfNew(world, "problem", narrative.memoryText);
}

function movePlayerWithinActiveSpaceForWork(
  world: StreetGameState,
  target: GridPoint,
) {
  const space = activeSpace(world);
  const targetTile = tileAt(space, target.x, target.y);
  if (!targetTile?.walkable) {
    return false;
  }

  const route = findWalkableRoute(space.tiles, world.player, targetTile);
  if (!route.reached) {
    return false;
  }

  world.activeSpaceId = space.id;
  world.player.spaceId = space.id;
  world.player.x = targetTile.x;
  world.player.y = targetTile.y;
  updatePlayerLocation(world);
  return true;
}

function buyItem(world: StreetGameState, itemId: string): void {
  const location = currentLocation(world);
  if (
    !location ||
    location.id !== "repair-stall" ||
    !isPlayerInActionSpace(world, "repair-stall")
  ) {
    addFeed(world, "info", "You cannot buy that here.");
    return;
  }

  if (itemId !== "item-wrench") {
    return;
  }

  if (hasItem(world, itemId)) {
    addFeed(world, "info", "You already have the wrench.");
    return;
  }

  if (world.player.money < 8) {
    addFeed(world, "info", "You do not have enough money for Jo's wrench.");
    return;
  }

  world.player.money -= 8;
  world.player.inventory.push({
    id: "item-wrench",
    name: "Old wrench",
    description:
      "Heavy, scarred, and still solid enough to turn a stubborn fitting.",
  });
  addFeed(world, "info", "You bought an old wrench from Jo for $8.");
  remember(
    world,
    "self",
    "You spent scarce money on a tool because South Quay keeps rewarding people who can fix what others step around.",
  );
}

function solveProblem(world: StreetGameState, problemId: string): void {
  const problem = problemById(world, problemId);
  if (!problem) {
    return;
  }

  const location = currentLocation(world);
  if (
    !location ||
    location.id !== problem.locationId ||
    !isPlayerInActionSpace(world, problem.locationId)
  ) {
    addFeed(world, "info", "You need to be on-site to solve that.");
    return;
  }

  if (problem.status !== "active") {
    addFeed(world, "info", `${problem.title} is no longer waiting on you.`);
    return;
  }

  if (problem.requiredItemId && !hasItem(world, problem.requiredItemId)) {
    addFeed(
      world,
      "info",
      `You need the right tool before ${problem.title.toLowerCase()} becomes solvable.`,
    );
    return;
  }

  if (problem.id === "problem-pump") {
    advanceWorld(world, 60);
    world.player.energy = clamp(world.player.energy - 10, 12, 100);
    world.player.money += problem.rewardMoney;
    world.player.reputation.morrow_house += 1;
    problem.status = "solved";
    const narrative = activeProblemSolveNarrative(problem.id, {
      rewardMoney: problem.rewardMoney,
    });
    if (narrative) {
      addFeed(world, "problem", narrative.feedText);
      remember(world, "problem", narrative.memoryText);
    }
    return;
  }

  if (problem.id === "problem-cart") {
    advanceWorld(world, 30);
    world.player.energy = clamp(world.player.energy - 8, 12, 100);
    world.player.money += problem.rewardMoney;
    world.player.reputation.south_quay += 1;
    problem.status = "solved";
    const narrative = activeProblemSolveNarrative(problem.id, {
      rewardMoney: problem.rewardMoney,
    });
    if (narrative) {
      addFeed(world, "problem", narrative.feedText);
      remember(world, "problem", narrative.memoryText);
    }
  }
}

function inspectLead(world: StreetGameState, targetId: string): void {
  const problem = problemById(world, targetId);
  if (
    problem &&
    !isPlayerInActionSpace(world, problem.locationId)
  ) {
    addFeed(world, "info", "You need to get to the right spot first.");
    return;
  }

  if (targetId === "problem-pump") {
    discoverProblem(world, "problem-pump");
    const narrative = activeProblemInspectNarrative(targetId);
    if (narrative) {
      addFeed(world, "problem", narrative.feedText);
    }
  }

  if (targetId === "problem-cart") {
    discoverProblem(world, "problem-cart");
    const narrative = activeProblemInspectNarrative(targetId);
    if (narrative) {
      addFeed(world, "problem", narrative.feedText);
    }
  }
}

function contributeToLocation(
  world: StreetGameState,
  locationId: string,
): void {
  const location = currentLocation(world);
  if (
    !location ||
    location.id !== locationId ||
    !isPlayerInActionSpace(world, locationId)
  ) {
    addFeed(
      world,
      "info",
      "Rowan needs to be there before he can pull his weight.",
    );
    return;
  }

  if (location.id !== world.player.homeLocationId) {
    addFeed(
      world,
      "info",
      "That kind of steady, local chore work only really counts at Morrow House right now.",
    );
    return;
  }

  if (world.player.energy < 24) {
    addFeed(
      world,
      "info",
      "Rowan is too worn down to be much help around the house.",
    );
    return;
  }

  const choreAdvance = advanceWorldUntilIndependentNpcAction(world, 60);
  const energyCost = Math.max(
    1,
    Math.round((10 * choreAdvance.advancedMinutes) / 60),
  );
  world.player.energy = clamp(world.player.energy - energyCost, 12, 100);
  if (choreAdvance.interrupted && choreAdvance.advancedMinutes < 60) {
    addFeed(
      world,
      "memory",
      "Rowan kept the house moving until city news cut through the hour; the chores still need finishing.",
    );
    return;
  }

  world.player.reputation.morrow_house = clamp(
    (world.player.reputation.morrow_house ?? 0) + 1,
    0,
    10,
  );
  addFeed(
    world,
    "memory",
    "Rowan spent the hour sweeping the stairs, straightening the entry, and making Morrow House feel a little easier.",
  );
  remember(
    world,
    "self",
    "You kept your head down and helped the house run more cleanly for an hour.",
  );
}

function markCurrentObjectiveStepCompleted(
  world: StreetGameState,
  routeKey: string,
  stepId: string,
): void {
  const objective = world.player.objective;
  if (!objective || objective.routeKey !== routeKey) {
    return;
  }

  const step = objective.trail.find((candidate) => candidate.id === stepId);
  if (!step) {
    return;
  }

  step.done = true;

  if (objective.completedTrail.some((candidate) => candidate.id === stepId)) {
    return;
  }

  objective.completedTrail.unshift({
    ...step,
    done: true,
    timestamp: world.currentTime,
  });
}

function restAtHome(world: StreetGameState): void {
  const location = currentLocation(world);
  if (
    !location ||
    location.id !== world.player.homeLocationId ||
    !isPlayerInActionSpace(world, world.player.homeLocationId)
  ) {
    addFeed(
      world,
      "info",
      "You need somewhere that is actually yours for an hour before rest does any good.",
    );
    return;
  }

  const pumpSolved = problemById(world, "problem-pump")?.status === "solved";
  const restAdvance = advanceWorldUntilIndependentNpcAction(world, 60);
  const fullRestEnergy = postFirstAfternoonNeedsCommitmentRecovery(world)
    ? 56
    : pumpSolved
      ? 28
      : 24;
  const energyGain = Math.max(
    1,
    Math.round((fullRestEnergy * restAdvance.advancedMinutes) / 60),
  );
  world.player.energy = clamp(
    world.player.energy + energyGain,
    12,
    100,
  );
  world.player.lastRestAt = world.currentTime;
  if (restAdvance.interrupted && restAdvance.advancedMinutes < 60) {
    addFeed(
      world,
      "memory",
      "Rowan caught part of the hour at Morrow House before the city changed loudly enough to matter.",
    );
    return;
  }

  addFeed(
    world,
    "memory",
    pumpSolved
      ? "You rested in a quiet room at Morrow House and felt the hour actually land."
      : "You rested, but the house never quite stopped sounding busy and unfinished.",
  );
  markCurrentObjectiveStepCompleted(world, "rest-home", "rest-hour");
}

function postFirstAfternoonNeedsCommitmentRecovery(world: StreetGameState) {
  const yardJob = jobById(world, "job-yard-shift");
  return Boolean(
    world.firstAfternoon?.completionAcknowledgedAt &&
      yardJob?.discovered &&
      jobWindowOpen(world, yardJob) &&
      !yardJob.accepted &&
      !yardJob.completed &&
      !yardJob.missed,
  );
}

function settleFirstAfternoonPlan(world: StreetGameState): void {
  const copy = objectiveRouteFirstAfternoonPlanSettlementCopy();
  if (!isPlayerInActionSpace(world, world.player.homeLocationId)) {
    addFeed(world, "info", copy.invalidLocationFeedText);
    return;
  }

  world.firstAfternoon ??= {};
  if (world.firstAfternoon.planSettledAt) {
    return;
  }

  world.firstAfternoon.planSettledAt = world.currentTime;
  world.player.currentThought = copy.currentThought;
  addFeed(world, "memory", copy.feedText);
  rememberIfNew(world, "self", copy.memoryText);
}

function chooseFirstAfternoonPumpPlan(world: StreetGameState): void {
  const copy = objectiveRouteFirstAfternoonPumpChoiceCopy();
  if (!isPlayerInActionSpace(world, world.player.homeLocationId)) {
    addFeed(world, "info", copy.invalidLocationFeedText);
    return;
  }

  world.firstAfternoon ??= {};
  world.firstAfternoon.planSettledAt ??= world.currentTime;
  discoverProblem(world, "problem-pump");
  world.player.currentThought = copy.currentThought;
  world.player.objective = buildPlayerObjectiveState(world, {
    focus: copy.objective.focus,
    previous: world.player.objective,
    source: "manual",
    text: copy.objective.text,
  });
  addFeed(world, "problem", copy.feedText);
  rememberIfNew(world, "self", copy.memoryText);
}

function compareFirstAfternoonOptions(world: StreetGameState): void {
  const copy = objectiveRouteFirstAfternoonCompareChoiceCopy();
  if (!isPlayerInActionSpace(world, "tea-house")) {
    addFeed(world, "info", copy.invalidLocationFeedText);
    return;
  }

  discoverProblem(world, "problem-pump");
  world.player.currentThought = copy.currentThought;
  world.player.objective = buildPlayerObjectiveState(world, {
    focus: copy.objective.focus,
    previous: world.player.objective,
    source: "manual",
    text: copy.objective.text,
  });
  addFeed(world, "info", copy.feedText);
  rememberIfNew(world, "self", copy.memoryText);
}

function completeFirstAfternoon(world: StreetGameState): void {
  const copy = objectiveRouteFirstAfternoonCompletionCopy();
  const location = currentLocation(world);
  if (
    !location ||
    location.id !== world.player.homeLocationId ||
    !isPlayerInActionSpace(world, world.player.homeLocationId)
  ) {
    addFeed(world, "info", copy.invalidLocationFeedText);
    return;
  }

  const teaShift = jobById(world, "job-tea-shift");
  if (!teaShift?.completed) {
    addFeed(world, "info", copy.missingShiftFeedText);
    return;
  }

  world.firstAfternoon ??= {};
  if (world.firstAfternoon.completedAt) {
    addFeed(world, "info", copy.alreadyCompletedFeedText);
    return;
  }

  world.firstAfternoon.completedAt = world.currentTime;
  world.firstAfternoon.fieldNote = buildFirstAfternoonFieldNote(
    world,
    teaShift,
  );
  discoverProblem(world, "problem-pump");
  const completionOutcome = objectiveRouteFirstAfternoonCompletionOutcome();
  world.player.currentThought = completionOutcome.playerThought;
  addFeed(world, "memory", completionOutcome.feedText);
  remember(world, "self", completionOutcome.memoryText);
}

function buildFirstAfternoonFieldNote(
  world: StreetGameState,
  teaShift: JobState,
) {
  const adaQuestion = world.conversations.find(
    (entry) =>
      entry.npcId === "npc-ada" &&
      entry.speaker === "player" &&
      /lunch|work|hands/i.test(entry.text),
  );
  const adaAnswer = world.conversations.find(
    (entry) => entry.npcId === "npc-ada" && entry.speaker === "npc",
  );
  const askedAt = adaQuestion?.time
    ? formatClockAt(world, totalMinutesForIso(adaQuestion.time))
    : undefined;
  const copy = objectiveRouteFirstAfternoonCompletionFieldNote({
    adaAnswered: Boolean(adaAnswer),
    askedAt,
    teaShiftPay: teaShift.pay,
    teaShiftTitle: teaShift.title,
  });

  return {
    createdAt: world.currentTime,
    ...copy,
  };
}

function ensureFirstAfternoonLeadFieldNote(world: StreetGameState): void {
  world.firstAfternoon ??= {};
  if (world.firstAfternoon.leadFieldNote) {
    return;
  }

  const teaShift = jobById(world, "job-tea-shift");
  if (!teaShift?.discovered) {
    return;
  }

  const adaQuestion = world.conversations.find(
    (entry) =>
      entry.npcId === "npc-ada" &&
      entry.speaker === "player" &&
      /lunch|work|hands|shift|help/i.test(entry.text),
  );
  const adaAnswer = world.conversations.find(
    (entry) => entry.npcId === "npc-ada" && entry.speaker === "npc",
  );
  if (!adaQuestion || !adaAnswer) {
    return;
  }

  const askedAt = formatClockAt(world, totalMinutesForIso(adaQuestion.time));
  const copy = objectiveRouteFirstAfternoonLeadFieldNote({
    askedAt,
    teaShiftPay: teaShift.pay,
    teaShiftTitle: teaShift.title,
  });
  world.firstAfternoon.leadFieldNote = {
    createdAt: world.currentTime,
    evidence: copy.evidence,
    learned: copy.learned,
    memory: copy.memory,
    next: copy.next,
  };
  addFeed(world, "memory", copy.feedText);
  rememberIfNew(world, "job", copy.memoryText);
}

function resolvePassiveState(
  world: StreetGameState,
  options: { workingJobId?: string } = {},
): void {
  const teaJob = jobById(world, "job-tea-shift");
  if (
    teaJob &&
    !teaJob.completed &&
    currentHour(world) >= teaJob.endHour &&
    options.workingJobId !== teaJob.id &&
    !jobIsStartedCommitment(world, teaJob)
  ) {
    missJobFromPassiveWorld(world, teaJob);
  }

  const cartProblem = problemById(world, "problem-cart");
  if (
    cartProblem &&
    cartProblem.status === "hidden" &&
    currentHour(world) >= 12
  ) {
    cartProblem.status = "active";
  }

  const pumpProblem = problemById(world, "problem-pump");
  if (
    pumpProblem &&
    pumpProblem.status === "active" &&
    currentHour(world) >= 18
  ) {
    pumpProblem.status = "expired";
    pumpProblem.expiredAt ??= world.currentTime;
    applyProblemExpiryConsequences(world, pumpProblem);
  }

  if (
    cartProblem &&
    cartProblem.status === "active" &&
    currentHour(world) >= 17
  ) {
    cartProblem.status = "expired";
    cartProblem.expiredAt ??= world.currentTime;
    applyProblemExpiryConsequences(world, cartProblem);
  }

  resolveProblemEscalation(world, pumpProblem);
  resolveProblemEscalation(world, cartProblem);
  resolveIndependentNpcActions(world, options);
}

function jobIsStartedCommitment(world: StreetGameState, job: JobState): boolean {
  return world.player.activeJobId === job.id && (job.progressMinutes ?? 0) > 0;
}

function missJobFromPassiveWorld(
  world: StreetGameState,
  job: JobState,
): void {
  if (job.completed) {
    return;
  }

  const wasLiveToRowan = job.discovered || job.accepted;
  job.accepted = false;
  job.missed = true;
  job.missedAt ??= world.currentTime;
  job.deferredUntilMinutes = undefined;
  job.progressMinutes = undefined;
  if (world.player.activeJobId === job.id) {
    world.player.activeJobId = undefined;
  }

  if (!wasLiveToRowan || job.consequenceAppliedAt) {
    return;
  }

  job.consequenceAppliedAt = world.currentTime;
  const giver = npcById(world, job.giverNpcId);
  if (giver) {
    giver.trust = clamp(giver.trust - 1, 0, 10);
  }

  const narrative = passiveMissedJobNarrative(job.id);
  if (!narrative) {
    return;
  }

  if (giver) {
    rememberNpcIfNew(giver, narrative.npcMemoryText);
  }
  addFeed(world, "job", narrative.feedText);
  rememberIfNew(world, "job", narrative.playerMemoryText);
}

function applyProblemExpiryConsequences(
  world: StreetGameState,
  problem: ProblemState,
): void {
  if (problem.consequenceAppliedAt) {
    return;
  }

  problem.consequenceAppliedAt = world.currentTime;

  if (problem.id === "problem-pump") {
    const narrative = problemExpiryConsequenceNarrative(problem.id);
    world.player.reputation.morrow_house = clamp(
      (world.player.reputation.morrow_house ?? 0) - 1,
      0,
      10,
    );
    const mara = npcById(world, "npc-mara");
    if (mara) {
      mara.trust = clamp(mara.trust - 1, 0, 10);
      if (narrative) {
        rememberNpcIfNew(mara, narrative.npcMemoryText);
      }
    }
    if (problem.discovered && narrative) {
      addFeed(world, "problem", narrative.discoveredFeedText);
      rememberIfNew(world, "problem", narrative.discoveredMemoryText);
    }
    return;
  }

  if (problem.id === "problem-cart") {
    const narrative = problemExpiryConsequenceNarrative(problem.id);
    world.player.reputation.south_quay = clamp(
      (world.player.reputation.south_quay ?? 0) - 1,
      0,
      10,
    );
    const nia = npcById(world, "npc-nia");
    if (nia && narrative) {
      rememberNpcIfNew(nia, narrative.npcMemoryText);
    }
    if (problem.discovered && narrative) {
      addFeed(world, "problem", narrative.discoveredFeedText);
      rememberIfNew(world, "problem", narrative.discoveredMemoryText);
    }
  }
}

function resolveIndependentNpcActions(
  world: StreetGameState,
  options: { workingJobId?: string } = {},
): void {
  resolveTomasYardLoading(world, options);

  const pumpProblem = problemById(world, "problem-pump");
  const mara = npcById(world, "npc-mara");
  const pumpResolutionMinute = totalMinutesForDayHour(world.clock.day, 17.5);
  const pumpNarrative = independentProblemResolutionNarrative("problem-pump");

  if (
    pumpProblem?.status === "active" &&
    (pumpProblem.escalationLevel ?? 0) >= 2 &&
    world.clock.totalMinutes >= pumpResolutionMinute &&
    mara?.currentLocationId === "courtyard"
  ) {
    pumpProblem.status = "resolved";
    pumpProblem.resolvedAt ??= world.currentTime;
    pumpProblem.resolvedByNpcId ??= mara.id;
    pumpProblem.urgency = 0;
    if (pumpNarrative) {
      rememberNpcIfNew(mara, pumpNarrative.npcMemoryText);
    }
    if (pumpProblem.discovered && pumpNarrative) {
      world.player.reputation.morrow_house = clamp(
        (world.player.reputation.morrow_house ?? 0) - 1,
        0,
        10,
      );
      mara.trust = clamp(mara.trust - 1, 0, 10);
      addFeed(world, "problem", pumpNarrative.discoveredFeedText);
      rememberIfNew(world, "problem", pumpNarrative.discoveredMemoryText);
    }
  }

  const cartProblem = problemById(world, "problem-cart");
  const nia = npcById(world, "npc-nia");
  const cartResolutionMinute = totalMinutesForDayHour(world.clock.day, 16.5);
  const cartNarrative = independentProblemResolutionNarrative("problem-cart");

  if (
    cartProblem?.status === "active" &&
    (cartProblem.escalationLevel ?? 0) >= 2 &&
    world.clock.totalMinutes >= cartResolutionMinute &&
    nia?.currentLocationId === "market-square"
  ) {
    cartProblem.status = "resolved";
    cartProblem.resolvedAt ??= world.currentTime;
    cartProblem.resolvedByNpcId ??= nia.id;
    cartProblem.urgency = 0;
    if (cartNarrative) {
      rememberNpcIfNew(nia, cartNarrative.npcMemoryText);
    }
    if (cartProblem.discovered && cartNarrative) {
      addFeed(world, "problem", cartNarrative.discoveredFeedText);
      rememberIfNew(world, "problem", cartNarrative.discoveredMemoryText);
    }
  }
}

function resolveTomasYardLoading(
  world: StreetGameState,
  options: { workingJobId?: string } = {},
): void {
  const yardJob = jobById(world, "job-yard-shift");
  if (!yardJob || yardJob.completed || yardJob.consequenceAppliedAt) {
    return;
  }

  const yardDeadlineMinute = totalMinutesForDayHour(
    world.clock.day,
    yardJob.endHour,
  );
  if (
    world.clock.totalMinutes < yardDeadlineMinute ||
    options.workingJobId === yardJob.id ||
    jobIsStartedCommitment(world, yardJob)
  ) {
    return;
  }

  const wasLiveToRowan = yardJob.discovered || yardJob.accepted;
  yardJob.accepted = false;
  yardJob.missed = true;
  yardJob.missedAt ??= world.currentTime;
  yardJob.consequenceAppliedAt = world.currentTime;
  yardJob.deferredUntilMinutes = undefined;
  yardJob.progressMinutes = undefined;
  if (world.player.activeJobId === yardJob.id) {
    world.player.activeJobId = undefined;
  }

  const tomas = npcById(world, "npc-tomas");
  const narrative = independentNpcJobClosureNarrative(yardJob.id, {
    wasLiveToRowan,
  });
  if (tomas) {
    if (wasLiveToRowan) {
      tomas.trust = clamp(tomas.trust - 1, 0, 10);
    }
    if (narrative) {
      rememberNpcIfNew(tomas, narrative.npcMemoryText);
    }
  }

  if (!wasLiveToRowan) {
    return;
  }

  if (narrative?.playerFeedText) {
    addFeed(world, "job", narrative.playerFeedText);
  }
  if (narrative?.playerMemoryText) {
    rememberIfNew(world, "job", narrative.playerMemoryText);
  }
}

function resolveProblemEscalation(
  world: StreetGameState,
  problem: ProblemState | undefined,
): void {
  if (!problem || problem.status !== "active") {
    return;
  }

  const stages = problemEscalationStages(problem.id);
  const stage = stages
    .filter((candidate) => world.clock.totalMinutes >= candidate.atMinute)
    .sort((left, right) => right.level - left.level)[0];

  if (!stage || stage.level <= (problem.escalationLevel ?? 0)) {
    return;
  }

  problem.escalationLevel = stage.level;
  problem.escalatedAt = world.currentTime;
  problem.urgency = clamp(problem.urgency, stage.urgency, 5);

  if (!problem.discovered) {
    return;
  }

  addFeed(world, "problem", stage.feedText);
  rememberIfNew(world, "problem", stage.memoryText);
}

function updateNpcLocations(world: StreetGameState): void {
  for (const npc of world.npcs) {
    const hour = currentHour(world);
    const stop =
      npc.schedule.find(
        (entry) => hour >= entry.fromHour && hour < entry.toHour,
      ) ?? npc.schedule[npc.schedule.length - 1];

    if (stop) {
      const pressureLocationId = pressureLocationForNpc(
        world,
        npc,
        stop.locationId,
      );
      npc.currentLocationId = pressureLocationId ?? stop.locationId;
      npc.currentSpaceId = pressureLocationId
        ? defaultSpaceIdForLocation(pressureLocationId)
        : (stop.spaceId ?? defaultSpaceIdForLocation(stop.locationId));
    }
  }
}

function pressureLocationForNpc(
  world: StreetGameState,
  npc: NpcState,
  scheduledLocationId: string,
): string | undefined {
  const pumpProblem = problemById(world, "problem-pump");
  if (
    npc.id === "npc-mara" &&
    scheduledLocationId !== "courtyard" &&
    pumpProblem?.status === "active" &&
    (pumpProblem.escalationLevel ?? 0) >= 2
  ) {
    return "courtyard";
  }

  const cartProblem = problemById(world, "problem-cart");
  if (
    npc.id === "npc-nia" &&
    scheduledLocationId !== "market-square" &&
    cartProblem?.status === "active" &&
    (cartProblem.escalationLevel ?? 0) >= 2
  ) {
    return "market-square";
  }

  return undefined;
}

function updatePlayerLocation(world: StreetGameState): void {
  const space = activeSpace(world);
  world.activeSpaceId = space.id;
  world.player.spaceId = space.id;

  if (space.kind === "interior" && space.locationId) {
    world.player.currentLocationId = space.locationId;
    return;
  }

  const location = findLocationAt(world, world.player.x, world.player.y);
  world.player.currentLocationId = location?.id;
}

function cityEventsForScene(world: StreetGameState, locationId: string) {
  return (world.cityEvents ?? [])
    .filter((event) => event.locationId === locationId)
    .filter(
      (event) =>
        event.status === "active" ||
        (event.status === "upcoming" &&
          (event.tone === "lead" ||
            event.tone === "warning" ||
            event.kind === "lunch_rush")),
    )
    .sort((left, right) => cityEventPriority(right) - cityEventPriority(left))
    .slice(0, 2);
}

function cityEventPriority(event: StreetGameState["cityEvents"][number]) {
  const statusScore =
    event.status === "active" ? 4 : event.status === "upcoming" ? 2 : 0;
  const toneScore =
    event.tone === "warning" ? 3 : event.tone === "lead" ? 2 : 1;
  return statusScore + toneScore;
}

function buildScene(world: StreetGameState) {
  const location = currentLocation(world);
  const space = activeSpace(world);
  const activeJob =
    world.player.activeJobId !== undefined
      ? jobById(world, world.player.activeJobId)
      : undefined;
  const people = world.npcs
    .filter((npc) => isNpcInActiveScene(world, npc))
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      known: npc.known,
    }));

  const notes: SceneNote[] = [];

  if (location) {
    notes.push({
      id: `note-open-${location.id}`,
      text: isLocationOpen(world, location)
        ? `${location.name} is active right now.`
        : `${location.name} is quiet or closed at this hour.`,
      tone: isLocationOpen(world, location) ? "info" : "warning",
    });

    for (const event of cityEventsForScene(world, location.id)) {
      notes.push({
        id: `note-city-${event.id}`,
        text: event.summary,
        tone: event.tone,
      });
    }
  }

  if (
    activeJob &&
    activeJob.accepted &&
    !activeJob.completed &&
    !activeJob.missed &&
    activeJob.locationId !== location?.id
  ) {
    const jobLocation = findLocation(world, activeJob.locationId);
    notes.push({
      id: `note-commitment-${activeJob.id}`,
      text:
        activeJob.deferredUntilMinutes !== undefined &&
        activeJob.deferredUntilMinutes > world.clock.totalMinutes
          ? `You're still committed to ${activeJob.title.toLowerCase()} at ${
              jobLocation?.name ?? "the job site"
            }, but you've pushed it back until about ${formatClockAt(
              world,
              activeJob.deferredUntilMinutes,
            )}.`
          : `You're still committed to ${activeJob.title.toLowerCase()} at ${
              jobLocation?.name ?? "the job site"
            }.`,
      tone: "lead",
    });
  }

  for (const job of world.jobs.filter(
    (entry) =>
      entry.locationId === location?.id &&
      entry.discovered &&
      !entry.completed &&
      !entry.missed,
  )) {
    notes.push({
      id: `note-job-${job.id}`,
      text: `${job.title} pays $${job.pay} between ${formatHour(job.startHour)} and ${formatHour(job.endHour)}.`,
      tone: "lead",
    });
  }

  for (const problem of world.problems.filter(
    (entry) =>
      entry.locationId === location?.id &&
      entry.discovered &&
      entry.status === "active",
  )) {
    notes.push({
      id: `note-problem-${problem.id}`,
      text: problem.summary,
      tone: "warning",
    });
  }

  if (!location) {
    return {
      spaceId: space.id,
      locationId: undefined,
      title: "South Quay Streets",
      description:
        "Brick, puddles, shop shutters, and people who look busy enough that you have to decide whether to stop them anyway.",
      context: world.districtNarrative.context,
      backstory: world.districtNarrative.backstory,
      people,
      notes,
    };
  }

  return {
    spaceId: space.id,
    locationId: location.id,
    title: location.name,
    description: location.description,
    context: location.context,
    backstory: location.backstory,
    people,
    notes,
  };
}

function buildAvailableActions(world: StreetGameState): ActionOption[] {
  const location = currentLocation(world);
  const objective = currentObjectiveDirective(world);
  const space = activeSpace(world);
  const playerSpaceId = activeSpaceId(world);
  const actionSpaceReady = isPlayerInActionSpace(world, location?.id);
  const actions: ActionOption[] = [];
  const spatial = (
    actionId: string,
    targetLocationId = location?.id,
  ): Pick<ActionOption, "spaceId" | "targetAnchorId" | "targetLocationId"> => ({
    spaceId: playerSpaceId,
    targetAnchorId: actionAnchorFor(world, actionId),
    targetLocationId,
  });

  for (const portal of space.portals) {
    const portalLocation = findLocation(world, portal.locationId);
    const canSurfacePortal =
      space.kind === "interior" || portal.locationId === location?.id;
    const route = findWalkableRoute(space.tiles, world.player, portal.from);

    if (!canSurfacePortal || !route.reached) {
      continue;
    }

    const isExit = portal.actionId.startsWith("exit:");
    actions.push({
      id: portal.actionId,
      label: portal.label,
      description: isExit
        ? `Return to ${world.districtName}.`
        : `Step inside ${portalLocation?.name ?? "the building"}.`,
      kind: isExit ? "exit" : "enter",
      emphasis: "medium",
      ...spatial(portal.actionId, portal.locationId),
    });
  }

  if (location && actionSpaceReady) {
    for (const npc of world.npcs.filter(
      (entry) => isNpcInActiveScene(world, entry),
    )) {
      const actionId = `talk:${npc.id}`;
      actions.push({
        id: actionId,
        label: `Talk to ${npc.name}`,
        description: npc.currentConcern || npc.summary,
        kind: "talk",
        emphasis: npc.known ? "low" : "medium",
        ...spatial(actionId, location.id),
      });
    }
  }

  for (const job of world.jobs.filter(
    (entry) =>
      actionSpaceReady &&
      entry.locationId === location?.id &&
      entry.discovered &&
      !entry.completed &&
      !entry.missed,
  )) {
    if (!job.accepted) {
      const actionId = `accept:${job.id}`;
      actions.push({
        id: actionId,
        label: `Take ${job.title}`,
        description: `${job.summary} Pays $${job.pay}.`,
        kind: "accept_job",
        emphasis: "medium",
        ...spatial(actionId, job.locationId),
        disabled:
          currentHour(world) >= job.endHour ||
          (currentHour(world) >= job.startHour && world.player.energy < 28),
        disabledReason:
          currentHour(world) >= job.endHour
            ? "The shift window is gone."
            : currentHour(world) >= job.startHour && world.player.energy < 28
              ? "You are too drained for work that starts now."
            : undefined,
      });
    } else {
      const actionId = `work:${job.id}`;
      const workAlreadyStarted = jobIsStartedCommitment(world, job);
      const workStageWatchCopy = objectiveRouteWorkStageWatchCopy(
        world,
        objective,
        {
          jobId: job.id,
          stage: world.firstAfternoon?.teaShiftStage,
        },
      );
      const remainingWorkMinutes = Math.max(
        5,
        job.durationMinutes - (job.progressMinutes ?? 0),
      );
      actions.push({
        id: actionId,
        label:
          workStageWatchCopy?.label ??
          (workAlreadyStarted
            ? `Finish ${job.title}`
            : `Work ${job.title}`),
        description:
          workStageWatchCopy?.detail ??
          `${remainingWorkMinutes} minutes for $${job.pay}.`,
        kind: "work_job",
        emphasis: "high",
        ...spatial(actionId, job.locationId),
        disabled:
          currentHour(world) < job.startHour ||
          (currentHour(world) >= job.endHour && !workAlreadyStarted) ||
          world.player.energy < 28,
        disabledReason:
          currentHour(world) < job.startHour
            ? "Too early for the shift."
            : currentHour(world) >= job.endHour && !workAlreadyStarted
              ? "The shift has already slipped."
              : world.player.energy < 28
                ? "You are too drained for this work."
                : undefined,
      });
    }
  }

  for (const problem of world.problems.filter(
    (entry) => entry.locationId === location?.id,
  )) {
    if (!actionSpaceReady) {
      continue;
    }

    if (!problem.discovered && problem.status === "active") {
      const actionId = `inspect:${problem.id}`;
      actions.push({
        id: actionId,
        label: `Inspect ${problem.title.toLowerCase()}`,
        description:
          "Take a closer look before deciding whether it is yours to fix.",
        kind: "inspect",
        emphasis: "low",
        ...spatial(actionId, problem.locationId),
      });
      continue;
    }

    if (problem.discovered && problem.status === "active") {
      const actionId = `solve:${problem.id}`;
      actions.push({
        id: actionId,
        label: `Solve ${problem.title.toLowerCase()}`,
        description: problem.requiredItemId
          ? `${problem.summary} Needs the right tool.`
          : problem.summary,
        kind: "solve",
        emphasis: "high",
        ...spatial(actionId, problem.locationId),
        disabled:
          problem.requiredItemId !== undefined &&
          !hasItem(world, problem.requiredItemId),
        disabledReason:
          problem.requiredItemId !== undefined &&
          !hasItem(world, problem.requiredItemId)
            ? "You do not have the right tool."
            : undefined,
      });
    }
  }

  if (
    actionSpaceReady &&
    location?.id === "repair-stall" &&
    !hasItem(world, "item-wrench")
  ) {
    const actionId = "buy:item-wrench";
    actions.push({
      id: actionId,
      label: "Buy old wrench",
      description:
        "A solid tool for $8. Heavy, ugly, and friendly once it starts turning.",
      kind: "buy",
      emphasis: "medium",
      ...spatial(actionId, "repair-stall"),
      disabled: world.player.money < 8,
      disabledReason:
        world.player.money < 8
          ? "You only have enough money to be thoughtful, not equipped."
          : undefined,
    });
  }

  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const maraTopics = conversationTopicsForNpc(world, "npc-mara");
  const stayTermsClear =
    houseStanding >= 2 || hasAnyConversationTopic(maraTopics, ["home", "stay"]);
  if (
    actionSpaceReady &&
    location?.id === world.player.homeLocationId &&
    stayTermsClear &&
    houseStanding < 2
  ) {
    const actionId = `contribute:${location.id}`;
    actions.push({
      id: actionId,
      label: "Handle house chores",
      description:
        "Sweep stairs, tidy the entry, and take some weight off the house before the day tightens up.",
      kind: "contribute",
      emphasis: "high",
      ...spatial(actionId, location.id),
      disabled: world.player.energy < 24,
      disabledReason:
        world.player.energy < 24
          ? "You are too drained to be much help around the house."
          : undefined,
    });
  }

  if (actionSpaceReady) {
    for (const action of objectiveRouteAvailableActions(
      world,
      world.player.objective,
    )) {
      actions.push({
        id: action.id,
        label: action.label,
        description: action.description,
        kind: action.kind,
        emphasis: action.emphasis,
        ...spatial(action.id, action.targetLocationId),
      });
    }
  }

  if (actionSpaceReady && location?.id === world.player.homeLocationId) {
    const actionId = "rest:home";
    actions.push({
      id: actionId,
      label: "Rest for an hour",
      description:
        "Get off your feet and let the block keep moving without you for a bit.",
      kind: "rest",
      emphasis: "low",
      ...spatial(actionId, location.id),
    });
  }

  return prioritizeActionsForObjective(
    world,
    actions.map((action) =>
      isAnchorReachable(world, action.targetAnchorId)
        ? action
        : {
            ...action,
            disabled: true,
            disabledReason: "You cannot reach that spot from here.",
          },
    ),
  );
}

function buildGoals(world: StreetGameState): string[] {
  const completedJobs = world.jobs.filter((job) => job.completed).length;
  const knownPeople = world.player.knownNpcIds.length;
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;

  return [
    jobGoalLine(world.player.money, completedJobs, world.player.activeJobId),
    roomGoalLine(world),
    peopleGoalLine(knownPeople, trustedPeople),
  ];
}

function buildSummary(world: StreetGameState): string {
  const location = currentLocation(world);
  const completedJobs = world.jobs.filter((job) => job.completed).length;
  const solvedProblems = world.problems.filter(
    (problem) => problem.status === "solved",
  ).length;
  const knownPlaces = world.player.knownLocationIds.length;
  const objective = world.player.objective;
  const activeJob =
    world.player.activeJobId !== undefined
      ? jobById(world, world.player.activeJobId)
      : undefined;
  const objectiveComplete = Boolean(
    objective?.progress.total &&
    objective.progress.completed >= objective.progress.total,
  );

  const objectiveTail = objectiveComplete
    ? (objectiveRouteCompletionSummaryTail(world, objective) ??
      " That objective is checked off.")
    : objective
      ? ` I'm still trying to ${objectiveClause(objective.text)}.`
      : "";
  const nextStepTail =
    !objectiveComplete && world.rowanAutonomy?.autoContinue
      ? ` Right now Rowan is choosing ${objectiveClause(world.rowanAutonomy.label)}.`
      : "";
  const objectiveProgressTail = objective?.progress
    ? ` ${objective.progress.label}.`
    : "";
  const commitmentTail =
    activeJob && activeJob.accepted && !activeJob.completed && !activeJob.missed
      ? activeJob.deferredUntilMinutes !== undefined &&
        activeJob.deferredUntilMinutes > world.clock.totalMinutes
        ? ` I'm still committed to ${activeJob.title.toLowerCase()} at ${
            findLocation(world, activeJob.locationId)?.name ?? "the job site"
          }, but I've pushed it back until about ${formatClockAt(
            world,
            activeJob.deferredUntilMinutes,
          )}.`
        : world.player.currentLocationId === activeJob.locationId &&
            currentHour(world) >= activeJob.startHour &&
            currentHour(world) < activeJob.endHour
          ? ` The shift window is open right now at ${
              findLocation(world, activeJob.locationId)?.name ?? "the job site"
            }, so that comes first.`
          : currentHour(world) < activeJob.startHour
            ? ` I've already committed to ${activeJob.title.toLowerCase()} at ${
                findLocation(world, activeJob.locationId)?.name ??
                "the job site"
              }, and it starts around ${formatHour(activeJob.startHour)}.`
            : currentHour(world) >= activeJob.startHour &&
                currentHour(world) < activeJob.endHour
              ? ` I've already committed to ${activeJob.title.toLowerCase()} at ${
                  findLocation(world, activeJob.locationId)?.name ??
                  "the job site"
                }, and the window is open now.`
              : ` I've already committed to ${activeJob.title.toLowerCase()} at ${
                  findLocation(world, activeJob.locationId)?.name ??
                  "the job site"
                }, so that comes first until it resolves.`
      : "";

  return `${world.clock.label}, day ${world.clock.day}. I'm new to ${
    world.cityName
  }, and at ${
    location?.name ?? "the street"
  } in ${location?.neighborhood ?? world.districtName}, ${describeMoney(world.player.money)}, and ${describeEnergy(
    world.player.energy,
  )}. ${describeDistrictSense(knownPlaces)} ${describeStanding(completedJobs, solvedProblems)}${objectiveTail}${nextStepTail}${objectiveProgressTail}${commitmentTail}`;
}

function syncNpcInnerState(world: StreetGameState) {
  const hour = currentHour(world);
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const cartProblem = problemById(world, "problem-cart");
  const pumpProblem = problemById(world, "problem-pump");
  const playerHasWrench = hasItem(world, "item-wrench");

  for (const npc of world.npcs) {
    const narrative = getNpcNarrative(npc.id);
    const innerNarrative = npcInnerStateNarrative(npc.id, {
      cartProblem,
      currentHour: hour,
      npcCurrentLocationId: npc.currentLocationId,
      playerHasWrench,
      pumpProblem,
      teaJob,
      yardJob,
    });

    switch (npc.id) {
      case "npc-mara":
        npc.currentObjective = innerNarrative.currentObjective;
        npc.currentConcern = innerNarrative.currentConcern;
        npc.mood =
          pumpProblem?.status === "resolved"
            ? "guarded"
            : pumpProblem?.status === "expired"
            ? "strained"
            : pumpProblem?.discovered && pumpProblem.status === "active"
            ? "watchful"
            : "measured";
        npc.openness = clamp(npc.openness || 58, 36, 92);
        break;
      case "npc-ada":
        npc.currentObjective = innerNarrative.currentObjective;
        npc.currentConcern = innerNarrative.currentConcern;
        npc.mood = teaJob?.missed
          ? "cool"
          : teaJob?.accepted && !teaJob.completed
            ? "brisk"
            : "pressed";
        npc.openness = clamp(npc.openness || 50, 30, 88);
        break;
      case "npc-jo":
        npc.currentObjective = innerNarrative.currentObjective;
        npc.currentConcern = innerNarrative.currentConcern;
        npc.mood = "dry";
        npc.openness = clamp(npc.openness || 44, 22, 82);
        break;
      case "npc-tomas":
        npc.currentObjective = innerNarrative.currentObjective;
        npc.currentConcern = innerNarrative.currentConcern;
        npc.mood = yardJob?.missed ? "guarded" : "busy";
        npc.openness = clamp(npc.openness || 34, 18, 74);
        break;
      case "npc-nia":
        npc.currentObjective = innerNarrative.currentObjective;
        npc.currentConcern = innerNarrative.currentConcern;
        npc.mood =
          cartProblem?.status === "resolved"
            ? "satisfied"
            : cartProblem?.status === "expired"
              ? "sharp"
              : "alert";
        npc.openness = clamp(npc.openness || 60, 34, 94);
        break;
      default:
        npc.currentObjective ||= innerNarrative.currentObjective;
        npc.currentConcern ||= innerNarrative.currentConcern;
        npc.summary ||= narrative.backstory;
        npc.mood ||= "steady";
        npc.openness = clamp(npc.openness || 50, 20, 90);
        break;
    }
  }
}

function activeSpaceId(world: StreetGameState) {
  return world.activeSpaceId ?? world.player.spaceId ?? STREET_SPACE_ID;
}

function activeSpace(world: StreetGameState): SpaceDefinition {
  return spaceById(world, activeSpaceId(world)) ?? streetSpaceFallback(world);
}

function spaceById(
  world: StreetGameState,
  spaceId: string | undefined,
): SpaceDefinition | undefined {
  if (!spaceId) {
    return undefined;
  }

  if (spaceId === STREET_SPACE_ID) {
    return (
      world.spaces?.find((space) => space.id === STREET_SPACE_ID) ??
      streetSpaceFallback(world)
    );
  }

  return world.spaces?.find((space) => space.id === spaceId);
}

function streetSpaceFallback(world: StreetGameState): SpaceDefinition {
  return {
    id: STREET_SPACE_ID,
    name: world.districtName,
    kind: "street",
    width: world.map.width,
    height: world.map.height,
    tiles: world.map.tiles,
    objects: [],
    anchors: [],
    portals: [],
  };
}

function tileAt(
  space: SpaceDefinition,
  x: number,
  y: number,
): MapTile | undefined {
  return space.tiles.find((tile) => tile.x === x && tile.y === y);
}

function activeLocationActionSpaceId(
  world: StreetGameState,
  locationId: string | undefined,
) {
  if (!locationId) {
    return activeSpaceId(world);
  }

  return interiorSpaceIdForLocation(locationId) ?? STREET_SPACE_ID;
}

function isPlayerInActionSpace(
  world: StreetGameState,
  locationId: string | undefined,
) {
  return activeSpaceId(world) === activeLocationActionSpaceId(world, locationId);
}

function npcSpaceId(npc: NpcState) {
  return npc.currentSpaceId ?? defaultSpaceIdForLocation(npc.currentLocationId);
}

function isNpcInActiveScene(world: StreetGameState, npc: NpcState) {
  const location = currentLocation(world);
  return (
    Boolean(location) &&
    npc.currentLocationId === location?.id &&
    npcSpaceId(npc) === activeSpaceId(world)
  );
}

function actionAnchorFor(
  world: StreetGameState,
  actionId: string,
): string | undefined {
  const space = activeSpace(world);
  const [kind, targetId] = actionId.split(":");

  if (kind === "talk" && targetId) {
    return (
      space.anchors.find((anchor) => anchor.actionId === actionId)?.id ??
      space.anchors.find((anchor) => anchor.npcId === targetId)?.id
    );
  }

  return space.anchors.find((anchor) => anchor.actionId === actionId)?.id;
}

function isAnchorReachable(
  world: StreetGameState,
  anchorId: string | undefined,
) {
  if (!anchorId) {
    return true;
  }

  const space = activeSpace(world);
  const anchor = space.anchors.find((entry) => entry.id === anchorId);
  if (!anchor) {
    return false;
  }

  const tile = tileAt(space, anchor.x, anchor.y);
  if (!tile?.walkable) {
    return false;
  }

  return findWalkableRoute(space.tiles, world.player, anchor).reached;
}

function currentLocation(world: StreetGameState) {
  return world.player.currentLocationId
    ? findLocation(world, world.player.currentLocationId)
    : undefined;
}

function findLocation(world: StreetGameState, locationId: string) {
  return world.locations.find((entry) => entry.id === locationId);
}

function findLocationAt(world: StreetGameState, x: number, y: number) {
  const tile = world.map.tiles.find((entry) => entry.x === x && entry.y === y);
  if (!tile?.locationId) {
    return undefined;
  }

  return findLocation(world, tile.locationId);
}

function currentHour(world: StreetGameState) {
  return world.clock.hour + world.clock.minute / 60;
}

function totalMinutesForDayHour(day: number, hour: number) {
  return Math.max(0, day - 1) * 24 * 60 + hour * 60;
}

function isLocationOpen(world: StreetGameState, location: LocationState) {
  const hour = currentHour(world);
  if (location.openHour === 0 && location.closeHour === 24) {
    return true;
  }

  return hour >= location.openHour && hour < location.closeHour;
}

function discoverJob(world: StreetGameState, jobId: string) {
  const job = jobById(world, jobId);
  if (!job || job.discovered) {
    return;
  }

  job.discovered = true;
  remember(world, "job", `You found out about ${job.title.toLowerCase()}.`);
}

function discoverLiveJob(world: StreetGameState, jobId: string) {
  const job = jobById(world, jobId);
  if (!job || !jobWindowOpen(world, job)) {
    return false;
  }

  discoverJob(world, jobId);
  return true;
}

function discoverProblem(world: StreetGameState, problemId: string) {
  const problem = problemById(world, problemId);
  if (!problem || problem.discovered || problem.status !== "active") {
    return;
  }

  problem.discovered = true;
  remember(world, "problem", `You noticed ${problem.title.toLowerCase()}.`);
}

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
}

function problemById(world: StreetGameState, problemId: string) {
  return world.problems.find((entry) => entry.id === problemId);
}

function npcById(world: StreetGameState, npcId: string) {
  return world.npcs.find((entry) => entry.id === npcId);
}

function ensureNpcKnown(world: StreetGameState, npc: NpcState) {
  npc.known = true;
  if (!world.player.knownNpcIds.includes(npc.id)) {
    world.player.knownNpcIds.push(npc.id);
  }
}

function recordConversation(
  world: StreetGameState,
  entry: Omit<ConversationEntry, "id" | "time" | "threadId">,
) {
  world.conversations ??= [];
  world.conversationThreads ??= {};
  const thread = ensureConversationThread(world, entry.npcId, entry.locationId);
  world.conversations.push({
    id: `conversation-${world.conversations.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    ...entry,
    threadId: thread.id,
  });

  thread.updatedAt = isoFor(world.clock.totalMinutes);
  thread.locationId = entry.locationId ?? thread.locationId;
  thread.lines = world.conversations
    .filter((conversation) => conversation.npcId === entry.npcId)
    .slice(-12);
  world.conversationThreads[entry.npcId] = thread;
}

function countPlayerConversationsWithNpc(
  world: StreetGameState,
  npcId: string,
) {
  return world.conversations.filter(
    (entry) => entry.npcId === npcId && entry.speaker === "player",
  ).length;
}

function conversationTopicsForNpc(world: StreetGameState, npcId: string) {
  const topics = new Set<string>();

  for (const entry of world.conversations) {
    if (entry.npcId !== npcId || entry.speaker !== "npc") {
      continue;
    }

    for (const topic of detectConversationTopics(entry.text)) {
      topics.add(topic);
    }
  }

  return topics;
}

function hasAnyConversationTopic(topics: Set<string>, candidates: string[]) {
  return candidates.some((candidate) => topics.has(candidate));
}

function countUniqueNpcConversations(world: StreetGameState) {
  return new Set(
    world.conversations
      .filter((entry) => entry.speaker === "player")
      .map((entry) => entry.npcId),
  ).size;
}

function minutesSinceLastNpcConversation(
  world: StreetGameState,
  npc: NpcState,
) {
  const lastInteraction = npc.lastInteractionAt;
  if (!lastInteraction) {
    return Number.POSITIVE_INFINITY;
  }

  const currentTime = Date.parse(world.currentTime);
  const lastTime = Date.parse(lastInteraction);
  if (Number.isNaN(currentTime) || Number.isNaN(lastTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((currentTime - lastTime) / 60000));
}

function clearActiveConversation(world: StreetGameState) {
  world.activeConversation = undefined;
}

function setActiveConversation(
  world: StreetGameState,
  npc: NpcState,
  options: {
    decision?: string;
    locationId?: string;
    objectiveText?: string;
    summary?: string;
  } = {},
) {
  const thread = ensureConversationThread(world, npc.id, options.locationId);
  const lines = thread.lines.slice(-6);
  if (lines.length === 0) {
    world.activeConversation = undefined;
    return;
  }

  world.activeConversation = {
    id: thread.id,
    threadId: thread.id,
    npcId: npc.id,
    locationId: options.locationId,
    updatedAt: thread.updatedAt,
    decision: options.decision,
    objectiveText: options.objectiveText,
    lines,
  };

  thread.decision = options.decision;
  thread.objectiveText = options.objectiveText;
  thread.summary =
    options.summary ??
    options.decision ??
    options.objectiveText ??
    thread.summary;
  thread.updatedAt = isoFor(world.clock.totalMinutes);
  thread.locationId = options.locationId ?? thread.locationId;
  world.conversationThreads[npc.id] = thread;
}

function ensureConversationThread(
  world: StreetGameState,
  npcId: string,
  locationId?: string,
): ConversationThreadState {
  world.conversationThreads ??= {};
  const existing = world.conversationThreads[npcId];
  if (existing) {
    return existing;
  }

  const threadId = threadIdForNpc(npcId);
  const lines = world.conversations
    .filter((entry) => entry.npcId === npcId)
    .slice(-12);

  const thread: ConversationThreadState = {
    id: threadId,
    npcId,
    updatedAt: world.currentTime,
    locationId,
    lines,
  };

  world.conversationThreads[npcId] = thread;
  return thread;
}

function threadIdForNpc(npcId: string) {
  return `conversation-thread-${npcId}`;
}

function buildAutonomousContinuation(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
) {
  const specific = buildAutonomousFollowup(
    world,
    npc.id,
    objective.focus,
    objective.text.toLowerCase(),
    lastNpcReply.toLowerCase(),
  );
  if (specific) {
    return specific;
  }

  const nextNpc = nextUntalkedNpc(world, npc.id);

  return objectiveRouteAutonomousContinuationFallbackSpeech({
    hasNextNpc: Boolean(nextNpc),
    objectiveFocus: objective.focus,
  });
}

function shouldAskAutonomousFollowup(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
  discussedTopics: Set<string>,
  initialResolution: ConversationResolution,
) {
  if (initialResolution.decision || initialResolution.objectiveText) {
    return false;
  }

  if (shouldForceAutonomousFollowup(world, npc, objective, lastNpcReply)) {
    return true;
  }

  if (objective.focus === "people" || objective.focus === "explore") {
    return Boolean(nextUntalkedNpc(world, npc.id));
  }

  if (discussedTopics.size === 0) {
    return true;
  }

  return /\b(maybe|depends|not sure|hard to say|ask around|look around|see who|could|might)\b/.test(
    lastNpcReply.toLowerCase(),
  );
}

function shouldForceAutonomousFollowup(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
) {
  if (countPlayerConversationsWithNpc(world, npc.id) !== 1) {
    return false;
  }

  if (
    objective.focus !== "settle" &&
    objective.focus !== "work" &&
    objective.focus !== "help"
  ) {
    return false;
  }

  return Boolean(
    buildAutonomousFollowup(
      world,
      npc.id,
      objective.focus,
      objective.text.toLowerCase(),
      lastNpcReply.toLowerCase(),
    ),
  );
}

function deriveConversationResolution(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  closingReply: string,
  discussedTopics: Set<string>,
): ConversationResolution {
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const hasWrench = hasItem(world, "item-wrench");
  const nextNpc = nextUntalkedNpc(world, npc.id);
  const socialLoopObjective =
    objective.focus === "people" ||
    objective.focus === "explore" ||
    /\beveryone\b|\bmake the rounds\b|\bmeet people\b|\btalk to everyone\b/.test(
      objective.text.toLowerCase(),
    );
  const shouldSharpenObjective = !socialLoopObjective;
  const normalizedObjective = objective.text.toLowerCase();
  const objectiveAboutPump = /\bpump\b|\bleak\b|\bwrench\b/.test(
    normalizedObjective,
  );
  const latestPlayerLine = [...world.conversations]
    .reverse()
    .find((entry) => entry.npcId === npc.id && entry.speaker === "player")
    ?.text.toLowerCase();
  const playerAskedPump = /\bpump\b|\bleak\b|\bwrench\b|\brepair\b/.test(
    latestPlayerLine ?? "",
  );
  const suppressPumpTopic = objectiveRouteSuppressesConversationTopic(
    world,
    objective,
    npc,
    "pump",
    { playerAskedTopic: playerAskedPump },
  );
  const discussedPump =
    objectiveAboutPump ||
    playerAskedPump ||
    (discussedTopics.has("pump") && !suppressPumpTopic);
  const discussedWork =
    objective.focus === "work" ||
    discussedTopics.has("work") ||
    discussedTopics.has("yard");
  const teaWindowClosed = jobWindowClosed(world, teaJob);
  const yardWindowOpen = jobWindowOpen(world, yardJob);
  const yardWindowClosed = jobWindowClosed(world, yardJob);

  if (socialLoopObjective && nextNpc) {
    return buildSocialNextNpcConversationResolution({
      currentNpcName: npc.name,
      nextNpcId: nextNpc.id,
      nextNpcName: nextNpc.name,
      shouldSharpenObjective,
      socialLoopObjective,
    });
  }

  switch (npc.id) {
    case "npc-mara":
      if (
        discussedPump &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active" &&
        !hasWrench
      ) {
        return buildNpcConversationResolution("mara-pump-needs-wrench", {
          shouldSharpenObjective,
        });
      }

      if (
        discussedPump &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active" &&
        hasWrench
      ) {
        return buildNpcConversationResolution("mara-pump-has-wrench", {
          shouldSharpenObjective,
        });
      }

      if (
        teaJob?.discovered &&
        jobWindowOpen(world, teaJob) &&
        !teaJob.accepted &&
        !teaJob.completed &&
        !teaJob.missed
      ) {
        return buildNpcConversationResolution("mara-live-tea-lead", {
          shouldSharpenObjective,
        });
      }

      if (discussedWork && teaWindowClosed && yardWindowOpen) {
        return buildNpcConversationResolution(
          "mara-closed-lunch-yard-redirect",
          {
            shouldSharpenObjective,
          },
        );
      }

      if (discussedWork && teaWindowClosed && yardWindowClosed) {
        return buildNpcConversationResolution("mara-closed-work-windows", {
          shouldSharpenObjective,
        });
      }
      break;
    case "npc-ada":
      if (discussedWork && teaWindowClosed && yardWindowOpen) {
        return buildNpcConversationResolution(
          "ada-closed-lunch-yard-redirect",
          {
            shouldSharpenObjective,
          },
        );
      }

      if (discussedWork && teaWindowClosed && yardWindowClosed) {
        return buildNpcConversationResolution("ada-closed-work-windows", {
          shouldSharpenObjective,
        });
      }

      if (
        teaJob?.discovered &&
        jobWindowOpen(world, teaJob) &&
        !teaJob.accepted &&
        !teaJob.completed &&
        !teaJob.missed
      ) {
        return buildNpcConversationResolution("ada-live-tea-shift", {
          shouldSharpenObjective,
        });
      }

      if (
        yardJob?.discovered &&
        jobWindowOpen(world, yardJob) &&
        !yardJob.accepted &&
        !yardJob.completed &&
        !yardJob.missed
      ) {
        return buildNpcConversationResolution("ada-live-yard-shift", {
          shouldSharpenObjective,
        });
      }
      break;
    case "npc-jo":
      if (
        discussedPump &&
        !hasWrench &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active"
      ) {
        return buildNpcConversationResolution("jo-wrench-needed-for-pump", {
          shouldSharpenObjective,
        });
      }

      if (
        discussedPump &&
        hasWrench &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active"
      ) {
        return buildNpcConversationResolution("jo-has-wrench-for-pump", {
          shouldSharpenObjective,
        });
      }
      break;
    case "npc-tomas":
      if (discussedWork && yardWindowClosed) {
        return buildNpcConversationResolution("tomas-closed-yard-window", {
          shouldSharpenObjective,
        });
      }

      if (
        yardJob?.discovered &&
        jobWindowOpen(world, yardJob) &&
        !yardJob.accepted &&
        !yardJob.completed &&
        !yardJob.missed
      ) {
        return buildNpcConversationResolution("tomas-live-yard-shift", {
          shouldSharpenObjective,
        });
      }
      break;
    case "npc-nia":
      if (cartProblem?.discovered && cartProblem.status === "active") {
        return buildNpcConversationResolution("nia-live-cart-jam", {
          shouldSharpenObjective,
        });
      }
      break;
    default:
      break;
  }

  if (discussedWork && teaWindowClosed && yardWindowClosed) {
    return buildGenericClosedWorkWindowConversationResolution({
      npcName: npc.name,
      shouldSharpenObjective,
    });
  }

  if (nextNpc) {
    return buildSocialNextNpcConversationResolution({
      currentNpcName: npc.name,
      nextNpcId: nextNpc.id,
      nextNpcName: nextNpc.name,
      shouldSharpenObjective,
      socialLoopObjective,
    });
  }

  return {
    decision: `follow up on this: ${closingReply.toLowerCase()}`,
    memoryKind: "self",
    memoryText:
      "The conversation gave you a clearer feel for where to lean next, even if it didn't hand you the whole answer.",
  };
}

function rememberNpcIfNew(npc: NpcState, text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || npc.memory.includes(normalized)) {
    return;
  }

  npc.memory.unshift(normalized);
  npc.memory = npc.memory.slice(0, 6);
}


function nextUntalkedNpc(world: StreetGameState, currentNpcId?: string) {
  return world.npcs
    .filter(
      (npc) =>
        npc.id !== currentNpcId &&
        countPlayerConversationsWithNpc(world, npc.id) === 0,
    )
    .sort((left, right) => {
      const leftDistance = distanceToLocation(world, left.currentLocationId);
      const rightDistance = distanceToLocation(world, right.currentLocationId);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return Number(right.known) - Number(left.known);
    })[0];
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function detectConversationTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (
    /\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(
      normalized,
    )
  ) {
    topics.add("work");
  }

  if (/\bhelp\b|\bfix\b|\brepair\b|\bsolve\b|\bhandle\b/.test(normalized)) {
    topics.add("help");
  }

  if (/\bpump\b|\bleak\b/.test(normalized)) {
    topics.add("pump");
  }

  if (/\bwrench\b|\btool\b|\btools\b/.test(normalized)) {
    topics.add("tool");
  }

  if (/\brent\b|\broom\b|\bhome\b|\bhouse\b|\blodg|\bstay\b/.test(normalized)) {
    topics.add("home");
  }

  if (/\brumou?r\b|\bgossip\b|\bnews\b|\bhear\b/.test(normalized)) {
    topics.add("gossip");
  }

  if (/\bcart\b|\bsquare\b|\bmarket\b/.test(normalized)) {
    topics.add("cart");
  }

  if (/\byard\b|\bload\b|\bcrate\b|\bcrane\b/.test(normalized)) {
    topics.add("yard");
  }

  if (/\bplease\b|\bthanks\b|\bthank you\b|\bappreciate\b/.test(normalized)) {
    topics.add("polite");
  }

  if (/\bstupid\b|\buseless\b|\bidiot\b|\bshut up\b/.test(normalized)) {
    topics.add("rude");
  }

  return topics;
}

function applyConversationRevelations(
  world: StreetGameState,
  npc: NpcState,
  topics: Set<string>,
) {
  const firstConversationWithNpc =
    countPlayerConversationsWithNpc(world, npc.id) <= 1;

  switch (npc.id) {
    case "npc-mara":
      if (topics.has("pump")) {
        discoverProblem(world, "problem-pump");
        rememberIfNew(
          world,
          "person",
          "Mara notices small fixes because they make the whole house easier to live in.",
        );
      }
      if (topics.has("work")) {
        if (!discoverLiveJob(world, "job-tea-shift")) {
          discoverLiveJob(world, "job-yard-shift");
        }
      }
      break;
    case "npc-ada":
      if (topics.has("work") || firstConversationWithNpc) {
        if (
          !discoverLiveJob(world, "job-tea-shift") ||
          jobById(world, "job-tea-shift")?.completed
        ) {
          discoverLiveJob(world, "job-yard-shift");
        }
      }
      rememberIfNew(
        world,
        "person",
        "Ada keeps listening for whether you will actually keep up once the room turns hot.",
      );
      break;
    case "npc-jo":
      if (topics.has("pump")) {
        discoverProblem(world, "problem-pump");
      }
      rememberIfNew(
        world,
        "person",
        "Jo speaks like tools should explain themselves if you are paying attention.",
      );
      break;
    case "npc-tomas":
      if (
        topics.has("work") ||
        topics.has("yard") ||
        firstConversationWithNpc
      ) {
        discoverLiveJob(world, "job-yard-shift");
      }
      rememberIfNew(
        world,
        "person",
        "Tomas has no patience for style points if the load is still sitting there.",
      );
      break;
    case "npc-nia":
      if (topics.has("cart") || topics.has("help") || topics.has("gossip")) {
        discoverProblem(world, "problem-cart");
      }
      rememberIfNew(
        world,
        "person",
        "Nia watches for the small jams that reveal where the whole block might get stuck.",
      );
      break;
    default:
      break;
  }
}

function updateNpcTrustFromSpeech(
  npc: NpcState,
  text: string,
  topics: Set<string>,
) {
  const normalized = text.toLowerCase();
  let delta = 0;

  if (topics.has("polite")) {
    delta += 1;
  }

  if (
    (npc.id === "npc-mara" &&
      (topics.has("help") || topics.has("pump") || topics.has("home"))) ||
    (npc.id === "npc-ada" && topics.has("work")) ||
    (npc.id === "npc-jo" && (topics.has("tool") || topics.has("pump"))) ||
    (npc.id === "npc-tomas" && (topics.has("work") || topics.has("yard"))) ||
    (npc.id === "npc-nia" && (topics.has("cart") || topics.has("gossip")))
  ) {
    delta += 1;
  }

  if (normalized.includes("need") || normalized.includes("trying to")) {
    delta += 0;
  }

  if (topics.has("rude")) {
    delta -= 1;
  }

  if (delta !== 0) {
    npc.trust = clamp(npc.trust + delta, 0, 5);
    npc.openness = clamp(npc.openness + delta * 5, 18, 96);
  }

  return delta;
}

function addFeed(
  world: StreetGameState,
  tone: FeedEntry["tone"],
  text: string,
) {
  world.feed.unshift({
    id: `feed-${world.feed.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    tone,
    text,
  });
}

function remember(
  world: StreetGameState,
  kind: MemoryEntry["kind"],
  text: string,
) {
  world.player.memories.unshift({
    id: `memory-${world.player.memories.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    kind,
    text,
  });
}

function rememberIfNew(
  world: StreetGameState,
  kind: MemoryEntry["kind"],
  text: string,
) {
  if (
    world.player.memories.some(
      (entry) => entry.kind === kind && entry.text === text,
    )
  ) {
    return;
  }

  remember(world, kind, text);
}

function trimFeed(world: StreetGameState) {
  world.feed = world.feed.slice(0, 18);
}

function trimMemories(world: StreetGameState) {
  world.player.memories = world.player.memories.slice(0, 18);
}

function trimConversations(world: StreetGameState) {
  world.conversations = world.conversations.slice(-24);
  world.conversationThreads = Object.fromEntries(
    Object.entries(world.conversationThreads ?? {}).map(([npcId, thread]) => [
      npcId,
      {
        ...thread,
        lines: thread.lines.slice(-12),
      },
    ]),
  );

  if (world.activeConversation) {
    const thread = world.conversationThreads[world.activeConversation.npcId];
    if (thread) {
      world.activeConversation = {
        ...world.activeConversation,
        updatedAt: thread.updatedAt,
        locationId: thread.locationId ?? world.activeConversation.locationId,
        decision: thread.decision ?? world.activeConversation.decision,
        objectiveText:
          thread.objectiveText ?? world.activeConversation.objectiveText,
        lines: thread.lines.slice(-6),
      };
    }
  }
}

async function hydrateStreetThoughts(
  world: StreetGameState,
  aiProvider: AIProvider,
  thoughtRefreshMode: ThoughtRefreshMode,
) {
  const thoughts =
    thoughtRefreshMode === "deterministic"
      ? buildDeterministicStreetThoughts(world)
      : await aiProvider.generateStreetThoughts(world);
  world.player.currentThought = thoughts.playerThought;

  for (const npc of world.npcs) {
    npc.currentThought = thoughts.npcThoughts[npc.id] ?? npc.currentThought;
  }
}

function hasItem(world: StreetGameState, itemId: string) {
  return world.player.inventory.some((entry) => entry.id === itemId);
}

function updateClock(clock: ClockState) {
  clock.day = Math.floor(clock.totalMinutes / (24 * 60)) + 1;
  const minuteOfDay = clock.totalMinutes % (24 * 60);
  clock.hour = Math.floor(minuteOfDay / 60);
  clock.minute = minuteOfDay % 60;
  clock.label = phaseForHour(clock.hour);
}

function phaseForHour(hour: number) {
  if (hour < 6) return "Pre-dawn";
  if (hour < 11) return "Morning";
  if (hour < 12) return "Late morning";
  if (hour < 18) return "Afternoon";
  if (hour < 22) return "Evening";
  return "Night";
}

function isoFor(totalMinutes: number) {
  const timestamp = new Date(BASE_DAY).getTime() + totalMinutes * 60_000;
  return new Date(timestamp).toISOString();
}

function totalMinutesForIso(value: string) {
  const timestamp = new Date(value).getTime();
  const baseTimestamp = new Date(BASE_DAY).getTime();
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.round((timestamp - baseTimestamp) / 60_000));
}

function formatHour(hour: number) {
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  if (hour > 12) return `${hour - 12}pm`;
  return `${hour}am`;
}

function formatClockAt(world: StreetGameState, totalMinutes: number) {
  const dayStartMinutes = (world.clock.day - 1) * 24 * 60;
  const minuteOfDay = Math.max(0, totalMinutes - dayStartMinutes) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function arrivalThought(
  world: StreetGameState,
  plan: ObjectivePlan,
  locationId: string,
) {
  const location = findLocation(world, locationId);
  if (!location) {
    return world.player.currentThought;
  }

  if (plan.npcId) {
    const npc = npcById(world, plan.npcId);
    return npc
      ? `I'm at ${location.name} now. I should see whether ${npc.name} actually has a minute for me.`
      : `I'm at ${location.name} now. I should take in the room before I ask for more.`;
  }

  if (!plan.actionId) {
    return `I'm at ${location.name} now. I should read the room before I decide what this place is really good for.`;
  }

  const [kind, targetId] = plan.actionId.split(":");
  switch (kind) {
    case "accept": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job
        ? `I'm at ${location.name} now. I should see whether ${job.title.toLowerCase()} is still on the table.`
        : `I'm at ${location.name} now. I should see whether the work is still there.`;
    }
    case "work": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job
        ? `I'm where ${job.title.toLowerCase()} happens. I should steady myself before I start the shift.`
        : `I'm at the job site now. I should steady myself before I start.`;
    }
    case "solve": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      return problem
        ? `I'm at ${location.name} now. I can deal with ${problem.title.toLowerCase()} once I know this is the right moment.`
        : `I'm at ${location.name} now. I should make sure this is the moment to step in.`;
    }
    case "inspect":
      return `I'm at ${location.name} now. I should look closer before I decide what to do with this lead.`;
    default:
      return `I'm at ${location.name} now. I should read the room before I commit to the next move.`;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function jobGoalLine(
  money: number,
  completedJobs: number,
  activeJobId?: string,
) {
  if (completedJobs >= 2 || money >= 30) {
    return "You've started proving you can build some real income here.";
  }

  if (activeJobId) {
    return "Hold onto the work in front of you and turn it into something steadier.";
  }

  if (money >= 20) {
    return "You've bought yourself a little time, but you still need steadier income.";
  }

  return "Find steady income before the city decides you're only passing through.";
}

function roomGoalLine(world: StreetGameState) {
  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const home = findLocation(world, world.player.homeLocationId);

  if (houseStanding >= 3) {
    return `${home?.name ?? "This place"} is starting to feel like somewhere you could actually stay awhile.`;
  }

  if (houseStanding >= 1) {
    return `Keep ${home?.name ?? "this place"} easy enough that the room still feels welcome tonight.`;
  }

  return "Make sure tonight ends with somewhere to sleep, not another scramble.";
}

function peopleGoalLine(knownPeople: number, trustedPeople: number) {
  if (trustedPeople >= 2) {
    return "A couple of people are starting to feel like real friends instead of faces on the block.";
  }

  if (knownPeople >= 3) {
    return "Keep showing up until the block stops treating you like a stranger.";
  }

  return "Meet people who might become friends instead of just learning your name.";
}

function describeMoney(money: number) {
  if (money >= 30) {
    return "with enough coin in your pocket to breathe a little";
  }

  if (money >= 15) {
    return "with a modest stack of coins in your pocket";
  }

  if (money >= 8) {
    return "with a few coins left to work with";
  }

  return "with barely enough coin to feel comfortable";
}

function describeEnergy(energy: number) {
  if (energy >= 75) {
    return "still steady on your feet";
  }

  if (energy >= 50) {
    return "feeling the day, but not bent by it";
  }

  if (energy >= 30) {
    return "starting to feel the drag in your legs";
  }

  return "running on tired legs";
}

function prioritizeActionsForObjective(
  world: StreetGameState,
  actions: ActionOption[],
) {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return actions;
  }

  const scored = actions.map((action, index) => {
    const score = scoreActionForObjective(
      action,
      objective.text,
      objective.focus,
    );

    return {
      action: {
        ...action,
        matchesObjective: score > 0,
      },
      index,
      score,
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (
      emphasisWeight(right.action.emphasis) !==
      emphasisWeight(left.action.emphasis)
    ) {
      return (
        emphasisWeight(right.action.emphasis) -
        emphasisWeight(left.action.emphasis)
      );
    }

    return left.index - right.index;
  });

  return scored.map((entry) => entry.action);
}

function scoreActionForObjective(
  action: ActionOption,
  text: string,
  focus: ObjectiveFocus,
) {
  const normalized = text.toLowerCase();
  const hasWorkCue =
    /(work|job|money|coin|earn|pay|shift|income|kettle & lamp|tea[- ]house|ada|north crane|tomas|counter|apron|tray|booths?|tables?|rush|gloves|bays?)/.test(
      normalized,
    );
  let score = 0;

  switch (focus) {
    case "settle":
      if (
        action.kind === "talk" ||
        action.kind === "accept_job" ||
        action.kind === "work_job" ||
        action.kind === "inspect" ||
        action.kind === "contribute" ||
        action.kind === "reflect"
      ) {
        score += 5;
      }
      break;
    case "work":
      if (action.kind === "accept_job" || action.kind === "work_job") {
        score += 5;
      }
      break;
    case "explore":
      if (action.kind === "talk" || action.kind === "inspect") {
        score += 4;
      }
      break;
    case "help":
      if (action.kind === "solve" || action.kind === "inspect") {
        score += 5;
      }
      break;
    case "rest":
      if (action.kind === "rest") {
        score += 6;
      }
      break;
    case "tool":
      if (action.kind === "buy") {
        score += 6;
      }
      break;
    case "people":
      if (action.kind === "talk") {
        score += 5;
      }
      break;
    default:
      break;
  }

  if (hasWorkCue) {
    if (action.kind === "accept_job" || action.kind === "work_job") {
      score += 4;
    }
  }

  if (/(learn|explore|walk|lanes|district|map|bearings)/.test(normalized)) {
    if (action.kind === "talk" || action.kind === "inspect") {
      score += 3;
    }
  }

  if (/(help|fix|solve|repair|problem|pump|cart)/.test(normalized)) {
    if (action.kind === "solve" || action.kind === "inspect") {
      score += 4;
    }
  }

  if (/(rest|recover|sleep|sit|energy|tired)/.test(normalized)) {
    if (action.kind === "rest") {
      score += 5;
    }
  }

  if (/(buy|tool|wrench)/.test(normalized)) {
    if (action.kind === "buy") {
      score += 5;
    }
  }

  if (
    /(talk|meet|people|trust|introduce|ask|friend|friends)/.test(normalized)
  ) {
    if (action.kind === "talk") {
      score += 4;
    }
  }

  if (
    /(room|stay|home|bed|shelter|belong|new here|new in|settle|get settled|footing|friend|friends|trust)/.test(
      normalized,
    )
  ) {
    if (
      action.kind === "talk" ||
      action.kind === "accept_job" ||
      action.kind === "work_job" ||
      action.kind === "inspect" ||
      action.kind === "contribute" ||
      action.kind === "reflect"
    ) {
      score += 3;
    }
  }

  if (
    /(take stock|first afternoon|foothold|wrap|finish|done)/.test(normalized)
  ) {
    if (action.kind === "reflect") {
      score += 8;
    }
  }

  if (
    /(standing|reliable|dependable|pull (my|your|their) weight|follow through|stairs|chores|entry|laundry|ledger)/.test(
      normalized,
    ) &&
    action.kind === "contribute"
  ) {
    score += 8;
  }

  if (normalized.includes("pump") && action.id.includes("problem-pump")) {
    score += 5;
  }

  if (normalized.includes("cart") && action.id.includes("problem-cart")) {
    score += 5;
  }

  if (normalized.includes("wrench") && action.id.includes("item-wrench")) {
    score += 5;
  }

  if (
    (normalized.includes("tea") ||
      normalized.includes("kettle") ||
      normalized.includes("ada") ||
      normalized.includes("counter")) &&
    action.id.includes("job-tea-shift")
  ) {
    score += 5;
  }

  if (
    (normalized.includes("yard") ||
      normalized.includes("north crane") ||
      normalized.includes("tomas") ||
      normalized.includes("gloves") ||
      normalized.includes("bay")) &&
    action.id.includes("job-yard-shift")
  ) {
    score += 5;
  }

  return score;
}

function emphasisWeight(emphasis: ActionOption["emphasis"]) {
  switch (emphasis) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function normalizeObjectiveText(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"+|"+$/g, "");
  const maxChars = 120;
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

function objectiveClause(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "stay open to whatever the block puts in front of you";
  }

  const normalized = `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;

  return /[.!?]$/.test(normalized) ? normalized.slice(0, -1) : normalized;
}

function describeDistrictSense(knownPlaces: number) {
  if (knownPlaces >= 5) {
    return "The lanes of South Quay are starting to make sense.";
  }

  if (knownPlaces >= 3) {
    return "A few corners of South Quay are beginning to stick in your head.";
  }

  return "South Quay still feels bigger than what you know of it.";
}

function describeStanding(completedJobs: number, solvedProblems: number) {
  const usefulMoments = completedJobs + solvedProblems;

  if (usefulMoments >= 2) {
    return "People are beginning to treat you like you belong here.";
  }

  if (usefulMoments >= 1) {
    return "A few people have started to remember you for something helpful.";
  }

  return "Most of the block is still trying to place your face.";
}
