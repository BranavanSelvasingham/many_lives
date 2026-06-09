import type { StreetGameState } from "./types";

export type RowanVisibleDecisionArtifact = {
  backingSummary: string;
  considered: string[];
  constraints: string[];
  objective: string;
  passedOver: string[];
  rationale: string;
  selectedAction: string;
  sourceSummary: string;
};

type PlanningTrace = NonNullable<
  StreetGameState["rowanAutonomy"]["planningTrace"]
>;

const PLAYER_TEXT_BACKEND_PATTERNS = [
  /\badvance_objective\b/gi,
  /\bplanningTrace\b/gi,
  /\brouteKey\b/gi,
  /\bworldPressure\b/gi,
  /\bcityEvents\b/gi,
  /\bjobWindows\b/gi,
  /\bnpcSchedules\b/gi,
  /\bselectedPlanKey\b/gi,
  /\bplanKey\b/gi,
  /\btargetLocationId\b/gi,
  /\bactionId\b/gi,
];

export function buildRowanVisibleDecisionArtifact(
  game: StreetGameState,
): RowanVisibleDecisionArtifact | null {
  return buildRowanVisibleDecisionArtifactFromState({
    activeConversationDecision: game.activeConversation?.decision,
    autonomyLabel: game.rowanAutonomy?.label,
    autonomyReason: game.rowanAutonomy?.intent?.reason,
    autonomySignals: game.rowanAutonomy?.intent?.signals,
    objectiveText: game.player.objective?.text,
    planningTrace: game.rowanAutonomy?.planningTrace,
  });
}

export function buildRowanVisibleDecisionArtifactFromState({
  activeConversationDecision,
  autonomyLabel,
  autonomyReason,
  autonomySignals,
  objectiveText,
  planningTrace,
}: {
  activeConversationDecision?: string;
  autonomyLabel?: string;
  autonomyReason?: string;
  autonomySignals?: string[];
  objectiveText?: string;
  planningTrace?: PlanningTrace;
}): RowanVisibleDecisionArtifact | null {
  if (!planningTrace && !activeConversationDecision) {
    return null;
  }

  const selectedOption = selectedPlanningOption(planningTrace);
  const selectedStep = selectedPlanningStep(planningTrace);
  const selectedAction = compactDecisionText(
    planningTrace?.selectedLabel ??
      selectedOption?.label ??
      selectedStep?.label ??
      autonomyLabel,
    72,
  );
  const rationale = compactDecisionText(
    selectedOption?.rationale ??
      selectedStep?.rationale ??
      autonomyReason ??
      activeConversationDecision,
    132,
  );
  const objective = compactDecisionText(
    planningTrace?.selectedPressureLabel ??
      planningTrace?.outcomes.find((outcome) => outcome.status !== "met")
        ?.label ??
      objectiveText ??
      activeConversationDecision ??
      autonomyLabel,
    112,
  );
  const backingSummary = backingSummaryForTrace(
    planningTrace,
    selectedOption,
    selectedStep,
  );
  const considered = uniqueCompact(
    [
      ...(planningTrace?.considered ?? []).map((option) => option.label),
      ...(planningTrace?.nextSteps ?? []).map((step) => step.label),
      planningTrace ? undefined : selectedAction,
    ],
    3,
    64,
  );
  const passedOver = uniqueCompact(
    [
      ...(planningTrace?.rejected ?? []).map((option) =>
        option.reason ? `${option.label}: ${option.reason}` : option.label,
      ),
      ...(planningTrace?.blockers ?? []),
    ],
    2,
    72,
  );
  const constraints = uniqueCompact(
    [
      ...(autonomySignals ?? []),
      selectedOption?.pressureLabel,
      selectedStep?.validation,
      activeConversationDecision,
      backingSummary,
    ],
    3,
    78,
  );

  if (!selectedAction || !rationale || !objective) {
    return null;
  }

  return {
    backingSummary,
    considered,
    constraints,
    objective,
    passedOver,
    rationale,
    selectedAction,
    sourceSummary: planningTrace
      ? "Planner callback"
      : activeConversationDecision
        ? "Conversation result"
        : "Rowan's current intent",
  };
}

function selectedPlanningOption(trace?: PlanningTrace) {
  if (!trace) {
    return null;
  }

  return (
    trace.considered.find(
      (option) =>
        option.status === "selected" &&
        (!trace.selectedPlanKey || option.planKey === trace.selectedPlanKey),
    ) ??
    trace.considered.find((option) => option.status === "selected") ??
    null
  );
}

function selectedPlanningStep(trace?: PlanningTrace) {
  if (!trace) {
    return null;
  }

  return (
    trace.nextSteps.find(
      (step) =>
        trace.selectedActionId && step.actionId === trace.selectedActionId,
    ) ??
    trace.nextSteps[0] ??
    null
  );
}

function backingSummaryForTrace(
  trace: PlanningTrace | undefined,
  selectedOption: ReturnType<typeof selectedPlanningOption>,
  selectedStep: ReturnType<typeof selectedPlanningStep>,
) {
  const backing =
    trace?.selectedLegalBacking ??
    selectedOption?.legalBacking ??
    selectedStep?.legalBacking ??
    null;
  const source = backing?.source;

  switch (source) {
    case "conversation-resolution":
      return "Grounded in the conversation result.";
    case "current-legal-action-surface":
      return "Available from the current choices.";
    case "destination-preview-legal-action":
      return "The destination was checked before committing.";
    case "projected-follow-up-legal-action":
      return "The follow-up was checked before committing.";
    case "simulator-validated-move":
      return "The move was validated before Rowan carries it out.";
    case "simulator-validated-wait":
      return "The wait was validated before Rowan spends the time.";
    default:
      return trace
        ? "Checked against the current choices."
        : "Grounded in Rowan's current situation.";
  }
}

function uniqueCompact(values: Array<string | null | undefined>, limit: number, max: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const compact = compactDecisionText(value, max);
    if (!compact) {
      continue;
    }
    const key = compact.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(compact);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function compactDecisionText(value: string | null | undefined, max: number) {
  if (!value) {
    return "";
  }

  let text = value.replace(/\s+/g, " ").trim();
  for (const pattern of PLAYER_TEXT_BACKEND_PATTERNS) {
    text = text.replace(pattern, "");
  }
  text = text
    .replace(/^Action:\s*/i, "")
    .replace(/\bcurrent objective\b/gi, "current aim")
    .replace(/\bplanner trace\b/gi, "Rowan weighs")
    .replace(/\bis an open desired-state predicate\b/gi, "")
    .replace(/\bdesired-state predicate\b/gi, "aim")
    .replace(/\bstale predicate\b/gi, "stale lead")
    .replace(/\bpredicate\b/gi, "aim")
    .replace(/\bRejected because\b/gi, "")
    .replace(/\bdominant live pressure\b/gi, "strongest current reason")
    .replace(/\blive pressure\b/gi, "current reason")
    .replace(/\broute hint action\b/gi, "suggested move")
    .replace(/\broute hint\b/gi, "suggested path")
    .replace(/\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}
