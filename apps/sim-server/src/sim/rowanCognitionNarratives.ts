import type { StreetGameState } from "../street-sim/types.js";

interface NotebookNextMoveLike {
  actionId?: string;
  text?: string;
}

const NOTEBOOK_UNCERTAINTY_BY_BELIEF_ID: Record<string, string> = {
  "belief-first-afternoon-field-note":
    "Which current opening deserves Rowan's recovered hour: North Crane Yard work, the Morrow Yard pump, or another lead?",
  "belief-jo-tools":
    "Which local problem is worth spending scarce money on?",
  "belief-nia-current-lead":
    "What does Nia know about the block before it jams?",
  "belief-pump-standing":
    "Can Rowan turn a small fix into a real local foothold?",
};

const NOTEBOOK_ROUTE_PLAN_FALLBACKS: Record<string, string> = {
  "help-pump":
    "Handle the Morrow Yard pump before the house has to absorb it without Rowan.",
  "work-yard": "Follow the yard work window before it closes.",
};

const NOTEBOOK_NIA_RECOVERY_PLAN =
  "Recover before following Nia's block-jam lead.";
const NOTEBOOK_RECOVERY_PLAN =
  "Rest at Morrow House long enough to recover, then choose the yard work, pump, or current opening that still matters.";
const NOTEBOOK_STALE_ENTRY_FALLBACK = "Ask the first useful question.";

export function rowanNotebookUncertaintyForBelief(beliefId?: string) {
  return beliefId ? NOTEBOOK_UNCERTAINTY_BY_BELIEF_ID[beliefId] : undefined;
}

export function rowanNotebookUsesRecoveryRestNeed(
  world: StreetGameState,
  nextMove?: NotebookNextMoveLike,
) {
  return (
    Boolean(world.firstAfternoon?.completedAt) &&
    world.player.objective?.routeKey === "rest-home" &&
    nextMove?.actionId === "enter:boarding-house"
  );
}

export function rowanNotebookPlanText(
  world: StreetGameState,
  nextMove?: NotebookNextMoveLike,
): string {
  if (rowanNotebookUsesNiaRecoveryPlan(world, nextMove)) {
    return NOTEBOOK_NIA_RECOVERY_PLAN;
  }

  if (
    world.player.objective?.routeKey === "rest-home" ||
    world.player.objective?.focus === "rest" ||
    nextMove?.actionId === "rest:home" ||
    rowanNotebookUsesRecoveryRestNeed(world, nextMove)
  ) {
    return NOTEBOOK_RECOVERY_PLAN;
  }

  const routePlan = rowanNotebookRoutePlanText(world, nextMove);
  if (routePlan) {
    return routePlan;
  }

  const nextMoveText = nextMove?.text;
  if (hasFreshNotebookText(nextMoveText)) {
    return nextMoveText;
  }

  const autonomyLabel = world.rowanAutonomy?.label;
  if (hasFreshNotebookText(autonomyLabel)) {
    return autonomyLabel;
  }

  return NOTEBOOK_STALE_ENTRY_FALLBACK;
}

function rowanNotebookUsesNiaRecoveryPlan(
  world: StreetGameState,
  nextMove?: NotebookNextMoveLike,
) {
  const objectiveText = world.player.objective?.text.toLowerCase() ?? "";
  return (
    /\bnia\b/.test(objectiveText) &&
    /\b(block|jam|cart|square)\b/.test(objectiveText) &&
    nextMove?.actionId === "rest:home"
  );
}

function rowanNotebookRoutePlanText(
  world: StreetGameState,
  nextMove?: NotebookNextMoveLike,
): string | undefined {
  const routeKey = world.player.objective?.routeKey;
  if (routeKey !== "help-pump" && routeKey !== "work-yard") {
    return undefined;
  }

  const nextMoveText = nextMove?.text;
  return hasFreshNotebookText(nextMoveText)
    ? nextMoveText
    : NOTEBOOK_ROUTE_PLAN_FALLBACKS[routeKey];
}

function hasFreshNotebookText(text?: string): text is string {
  if (!text) {
    return false;
  }

  return !/^Enter Morrow House$/i.test(text.trim());
}
