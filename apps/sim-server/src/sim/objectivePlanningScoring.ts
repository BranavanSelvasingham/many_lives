import type { StreetPlanningObjectiveOutcome } from "../ai/provider.js";
import type {
  JobState,
  NpcState,
  StreetGameState,
} from "../street-sim/types.js";
import { objectiveRouteActionTargetLocation } from "./objectiveScaffolds.js";

const JOB_WINDOW_OUTCOME_PREFIX = "job-window-";

type DesiredOutcomePlan = {
  actionId?: string;
  npcId?: string;
  rationale?: string;
  score?: number;
  speech?: string;
  targetLocationId?: string;
  waitUntilMinutes?: number;
};

type DesiredOutcomeScoringContext = {
  actionId: string;
  job?: JobState;
  kind?: string;
  locationId?: string;
  npcId?: string;
  plan: DesiredOutcomePlan;
  priority: number;
  world: StreetGameState;
};

type DesiredOutcomeScoringRule = (
  context: DesiredOutcomeScoringContext,
) => number;

const DESIRED_OUTCOME_SCORE_RULES: Record<string, DesiredOutcomeScoringRule> = {
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

export function scorePlanForDesiredOutcomes(
  world: StreetGameState,
  plan: DesiredOutcomePlan,
  outcomes: StreetPlanningObjectiveOutcome[],
) {
  const actionId = plan.actionId ?? "";
  const [kind, targetId] = actionId.split(":");
  const job =
    targetId && (kind === "accept" || kind === "work" || kind === "resume")
      ? jobById(world, targetId)
      : undefined;
  const locationId = plan.targetLocationId;
  const npcId = plan.npcId;
  let score = 0;

  for (const outcome of outcomes) {
    const priority = outcome.priority;
    const context: DesiredOutcomeScoringContext = {
      actionId,
      job,
      kind,
      locationId,
      npcId,
      plan,
      priority,
      world,
    };

    score += scorePlanForTargetedOutcome(world, plan, outcome);
    score += scoreJobWindowOutcome(context, outcome);
    score += DESIRED_OUTCOME_SCORE_RULES[outcome.id]?.(context) ?? 0;
  }

  return score;
}

function scoreJobWindowOutcome(
  context: DesiredOutcomeScoringContext,
  outcome: StreetPlanningObjectiveOutcome,
) {
  if (!outcome.id.startsWith(JOB_WINDOW_OUTCOME_PREFIX)) {
    return 0;
  }

  const outcomeJobId = outcome.id.slice(JOB_WINDOW_OUTCOME_PREFIX.length);
  if (
    context.job?.id === outcomeJobId &&
    (context.kind === "accept" ||
      context.kind === "work" ||
      context.kind === "resume")
  ) {
    return context.priority * 3.5;
  }

  if (context.locationId === outcome.targetLocationId) {
    return context.priority * 2;
  }

  return 0;
}

function scorePlanForTargetedOutcome(
  world: StreetGameState,
  plan: DesiredOutcomePlan,
  outcome: StreetPlanningObjectiveOutcome,
) {
  let score = 0;

  if (outcome.actionId && plannerActionIdForPlan(plan) === outcome.actionId) {
    score += outcome.priority * 18;
  }

  if (outcome.npcId && plan.npcId === outcome.npcId) {
    score += outcome.priority * 10;
  }

  if (
    outcome.targetLocationId &&
    plan.targetLocationId === outcome.targetLocationId
  ) {
    score += outcome.priority * 9;
  }

  if (
    outcome.npcId &&
    plan.targetLocationId === npcById(world, outcome.npcId)?.currentLocationId
  ) {
    score += outcome.priority * 4;
  }

  if (
    outcome.actionId &&
    plan.targetLocationId ===
      targetLocationIdForActionId(world, outcome.actionId)
  ) {
    score += outcome.priority * 4;
  }

  return score;
}

function plannerActionIdForPlan(plan: DesiredOutcomePlan) {
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

function findLocation(world: StreetGameState, locationId: string | undefined) {
  return world.locations.find((entry) => entry.id === locationId);
}

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
}

function problemById(world: StreetGameState, problemId: string) {
  return world.problems.find((entry) => entry.id === problemId);
}

function npcById(world: StreetGameState, npcId: string): NpcState | undefined {
  return world.npcs.find((entry) => entry.id === npcId);
}
