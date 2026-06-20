import type { StreetPlanningObjectiveOutcome } from "../ai/provider.js";
import type { NpcState, StreetGameState } from "../street-sim/types.js";
import {
  objectiveDesiredOutcomeScoreAdjustment,
  objectiveRouteActionTargetLocation,
  type ObjectiveDesiredOutcomeScoringInput,
} from "./objectiveScaffolds.js";

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
    const context: ObjectiveDesiredOutcomeScoringInput = {
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
    score += objectiveDesiredOutcomeScoreAdjustment(outcome.id, context);
  }

  return score;
}

function scoreJobWindowOutcome(
  context: ObjectiveDesiredOutcomeScoringInput,
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
