import type { StreetGameState } from "../street-sim/types.js";
import {
  objectiveRouteNotebookBeliefClue,
  objectiveRouteNotebookBeliefConfidence,
  objectiveRouteNotebookBeliefUncertainty,
  objectiveRouteNotebookPlanFallback,
  objectiveRouteNotebookRecoveryPlan,
  objectiveRouteNotebookStaleEntryFallback,
} from "./objectiveScaffolds.js";

interface NotebookNextMoveLike {
  actionId?: string;
  text?: string;
}

interface NotebookBeliefLike {
  confidence?: "possible" | "promising" | "confirmed";
  id?: string;
  source?: string;
}

export function rowanNotebookUncertaintyForBelief(beliefId?: string) {
  return objectiveRouteNotebookBeliefUncertainty(beliefId);
}

export function rowanNotebookClueText(
  world: StreetGameState,
  belief?: NotebookBeliefLike,
) {
  return (
    fieldNoteEvidence(world, belief) ??
    objectiveRouteNotebookBeliefClue({
      beliefId: belief?.id,
      hasWrench: playerHasWrench(world),
    })
  );
}

export function rowanNotebookConfidenceText(
  world: StreetGameState,
  belief?: NotebookBeliefLike,
) {
  return objectiveRouteNotebookBeliefConfidence({
    beliefId: belief?.id,
    hasWrench: playerHasWrench(world),
  });
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
    return objectiveRouteNotebookRecoveryPlan("nia-block");
  }

  if (
    world.player.objective?.routeKey === "rest-home" ||
    world.player.objective?.focus === "rest" ||
    nextMove?.actionId === "rest:home" ||
    rowanNotebookUsesRecoveryRestNeed(world, nextMove)
  ) {
    return objectiveRouteNotebookRecoveryPlan("post-afternoon");
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

  return objectiveRouteNotebookStaleEntryFallback();
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
  const fallback = objectiveRouteNotebookPlanFallback(routeKey);
  if (!fallback) {
    return undefined;
  }

  const nextMoveText = nextMove?.text;
  return hasSpecificRouteNotebookText(nextMoveText) ? nextMoveText : fallback;
}

function hasSpecificRouteNotebookText(text?: string): text is string {
  if (!hasFreshNotebookText(text)) {
    return false;
  }

  return !/^Exit to South Quay$/i.test(text.trim());
}

function hasFreshNotebookText(text?: string): text is string {
  if (!text) {
    return false;
  }

  return !/^Enter Morrow House$/i.test(text.trim());
}

function fieldNoteEvidence(
  world: StreetGameState,
  belief?: NotebookBeliefLike,
) {
  if (belief?.id !== "belief-first-afternoon-field-note") {
    return undefined;
  }

  const evidence = world.firstAfternoon?.fieldNote?.evidence;
  if (!evidence) {
    return undefined;
  }

  return `Evidence: ${evidence}`;
}

function playerHasWrench(world: StreetGameState) {
  return world.player.inventory.some((item) => item.id === "item-wrench");
}
