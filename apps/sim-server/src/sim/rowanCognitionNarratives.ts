import type { StreetGameState } from "../street-sim/types.js";

interface NotebookNextMoveLike {
  actionId?: string;
  text?: string;
}

interface NotebookBeliefLike {
  confidence?: "possible" | "promising" | "confirmed";
  id?: string;
  source?: string;
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
  "work-yard": "Ask Tomas before the North Crane Yard freight window closes.",
};

const NOTEBOOK_NIA_RECOVERY_PLAN =
  "Recover before following Nia's block-jam lead.";
const NOTEBOOK_RECOVERY_PLAN =
  "Rest at Morrow House long enough to recover, then choose the yard work, pump, or current opening that still matters.";
const NOTEBOOK_STALE_ENTRY_FALLBACK = "Ask the first useful question.";
const NOTEBOOK_FIELD_NOTE_CLUE =
  "Evidence: Ada's field note says Rowan asked directly, stayed through lunch, and left Kettle & Lamp with pay and a clearer obligation.";
const NOTEBOOK_FIELD_NOTE_CONFIDENCE =
  "Confirmed by Ada's field note and the paid tea shift.";
const NOTEBOOK_YARD_CLUE =
  "Evidence: Tomas described paid yard work at North Crane Yard, and the freight window is the obligation Rowan can still try to meet.";
const NOTEBOOK_YARD_CONFIDENCE =
  "Confirmed by Tomas and the open freight window.";
const NOTEBOOK_PUMP_CLUE =
  "Evidence: the Morrow Yard pump is discovered, still active, and tied to Rowan's standing at the house.";
const NOTEBOOK_PUMP_WITH_TOOL_CLUE =
  "Evidence: the Morrow Yard pump is active, and Rowan already has the wrench that can make the repair real.";
const NOTEBOOK_PUMP_CONFIDENCE =
  "Promising because the house problem is active and Rowan can test it directly.";
const NOTEBOOK_PUMP_WITH_TOOL_CONFIDENCE =
  "Promising because the problem is active and the needed tool is in Rowan's hands.";
const NOTEBOOK_NIA_CLUE =
  "Evidence: Jo pointed Rowan toward Nia before the block jam turns into someone else's problem.";
const NOTEBOOK_JO_TOOLS_CLUE =
  "Evidence: Jo can turn scarce coins into the right tool only if Rowan knows which repair deserves it.";

export function rowanNotebookUncertaintyForBelief(beliefId?: string) {
  return beliefId ? NOTEBOOK_UNCERTAINTY_BY_BELIEF_ID[beliefId] : undefined;
}

export function rowanNotebookClueText(
  world: StreetGameState,
  belief?: NotebookBeliefLike,
) {
  switch (belief?.id) {
    case "belief-first-afternoon-field-note":
      return fieldNoteEvidence(world) ?? NOTEBOOK_FIELD_NOTE_CLUE;
    case "belief-tomas-work":
      return NOTEBOOK_YARD_CLUE;
    case "belief-pump-standing":
      return playerHasWrench(world)
        ? NOTEBOOK_PUMP_WITH_TOOL_CLUE
        : NOTEBOOK_PUMP_CLUE;
    case "belief-nia-current-lead":
      return NOTEBOOK_NIA_CLUE;
    case "belief-jo-tools":
      return NOTEBOOK_JO_TOOLS_CLUE;
    default:
      return undefined;
  }
}

export function rowanNotebookConfidenceText(
  world: StreetGameState,
  belief?: NotebookBeliefLike,
) {
  switch (belief?.id) {
    case "belief-first-afternoon-field-note":
      return NOTEBOOK_FIELD_NOTE_CONFIDENCE;
    case "belief-tomas-work":
      return NOTEBOOK_YARD_CONFIDENCE;
    case "belief-pump-standing":
      return playerHasWrench(world)
        ? NOTEBOOK_PUMP_WITH_TOOL_CONFIDENCE
        : NOTEBOOK_PUMP_CONFIDENCE;
    default:
      return undefined;
  }
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
  return hasSpecificRouteNotebookText(nextMoveText)
    ? nextMoveText
    : NOTEBOOK_ROUTE_PLAN_FALLBACKS[routeKey];
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

function fieldNoteEvidence(world: StreetGameState) {
  const evidence = world.firstAfternoon?.fieldNote?.evidence;
  if (!evidence) {
    return undefined;
  }

  return `Evidence: ${evidence}`;
}

function playerHasWrench(world: StreetGameState) {
  return world.player.inventory.some((item) => item.id === "item-wrench");
}
