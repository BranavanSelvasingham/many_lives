import type { StreetGameState } from "./types";

export type RowanVisibleDecisionArtifact = {
  backingSummary: string;
  considered: string[];
  constraints: string[];
  nextCheck?: string;
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
    autonomyActionId: game.rowanAutonomy?.actionId,
    autonomyLabel: game.rowanAutonomy?.label,
    autonomyReason: game.rowanAutonomy?.intent?.reason,
    autonomySignals: game.rowanAutonomy?.intent?.signals,
    objectiveText: game.player.objective?.text,
    planningTrace: game.rowanAutonomy?.planningTrace,
    recentIndependentResolution: recentIndependentResolutionConstraint(game),
    travelPhase: game.rowanAutonomy?.travelPhase,
  });
}

export function buildRowanVisibleDecisionArtifactFromState({
  activeConversationDecision,
  autonomyActionId,
  autonomyLabel,
  autonomyReason,
  autonomySignals,
  objectiveText,
  planningTrace,
  recentIndependentResolution,
  travelPhase,
}: {
  activeConversationDecision?: string;
  autonomyActionId?: string;
  autonomyLabel?: string;
  autonomyReason?: string;
  autonomySignals?: string[];
  objectiveText?: string;
  planningTrace?: PlanningTrace;
  recentIndependentResolution?: string;
  travelPhase?: StreetGameState["rowanAutonomy"]["travelPhase"];
}): RowanVisibleDecisionArtifact | null {
  if (!planningTrace && !activeConversationDecision) {
    return null;
  }

  const selectedOption = selectedPlanningOption(planningTrace);
  const selectedStep = selectedPlanningStep(planningTrace);
  const selectedRuntimeActionLabel =
    planningTrace?.selectedActionId &&
    autonomyActionId === planningTrace.selectedActionId
      ? autonomyLabel
      : undefined;
  const selectedActionBase = compactDecisionText(
    selectedRuntimeActionLabel ??
      selectedStep?.label ??
      planningTrace?.selectedLabel ??
      selectedOption?.label ??
      autonomyLabel,
    72,
  );
  const selectedAction =
    travelPhase === "route-progress" && selectedActionBase
      ? compactDecisionText(`Following through: ${selectedActionBase}`, 72)
      : selectedActionBase;
  const selectedFollowUpLabel = compactDecisionText(
    selectedRuntimeActionLabel &&
      selectedStep?.label &&
      selectedStep.label !== selectedRuntimeActionLabel
      ? selectedStep.label
      : selectedRuntimeActionLabel &&
          selectedOption?.label &&
          selectedOption.label !== selectedRuntimeActionLabel
        ? selectedOption.label
        : undefined,
    44,
  );
  const rationaleBase = compactDecisionText(
    selectedFollowUpLabel
      ? `${selectedFollowUpLabel}: ${
          selectedOption?.rationale ??
          selectedStep?.rationale ??
          autonomyReason ??
          activeConversationDecision
        }`
      : selectedOption?.rationale ??
          selectedStep?.rationale ??
          autonomyReason ??
          activeConversationDecision,
    132,
  );
  const rationale =
    travelPhase === "route-progress"
      ? compactDecisionText(
          autonomyReason ??
            "Rowan is carrying out the route he already validated.",
          132,
        )
      : rationaleBase;
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
  const nextCheck = nextCheckForTrace(
    planningTrace,
    selectedStep,
    selectedAction,
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
      recentIndependentResolution,
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
    ...(nextCheck ? { nextCheck } : {}),
    objective,
    passedOver,
    rationale,
    selectedAction,
    sourceSummary: sourceSummaryForDecisionArtifact(
      planningTrace,
      activeConversationDecision,
      travelPhase,
    ),
  };
}

function recentIndependentResolutionConstraint(game: StreetGameState) {
  const currentTime = Date.parse(game.currentTime);
  if (!Number.isFinite(currentTime)) {
    return undefined;
  }

  const npcsById = new Map(game.npcs.map((npc) => [npc.id, npc] as const));
  const recent = (game.problems ?? [])
    .filter(
      (problem) =>
        problem.discovered &&
        problem.status === "resolved" &&
        problem.resolvedByNpcId &&
        problem.resolvedAt,
    )
    .map((problem) => ({
      problem,
      resolvedTime: Date.parse(problem.resolvedAt ?? ""),
    }))
    .filter(
      ({ resolvedTime }) =>
        Number.isFinite(resolvedTime) &&
        currentTime - resolvedTime >= 0 &&
        currentTime - resolvedTime <= 90 * 60 * 1000,
    )
    .sort((left, right) => right.resolvedTime - left.resolvedTime)[0];

  if (!recent) {
    return undefined;
  }

  const resolver =
    npcsById.get(recent.problem.resolvedByNpcId ?? "")?.name ?? "someone local";
  return `${resolver} already contained the ${recent.problem.title.toLowerCase()}, so Rowan can choose among the remaining needs.`;
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

function nextCheckForTrace(
  trace: PlanningTrace | undefined,
  selectedStep: ReturnType<typeof selectedPlanningStep>,
  selectedAction: string,
) {
  if (!trace) {
    return "";
  }

  if (trace.nextSteps.length >= 2) {
    const selectedIndex = selectedStep
      ? trace.nextSteps.findIndex((step) => step === selectedStep)
      : -1;
    const candidates = trace.nextSteps.slice(
      selectedIndex >= 0 ? selectedIndex + 1 : 1,
    );
    const selectedKey = selectedAction.toLowerCase();

    for (const step of candidates) {
      if (!step.legal) {
        continue;
      }

      const label = compactDecisionText(step.label, 60);
      if (!label || label.toLowerCase() === selectedKey) {
        continue;
      }

      const rationale = compactDecisionText(step.rationale, 92);
      const text = compactDecisionText(
        rationale ? `${label}: ${rationale}` : label,
        118,
      );
      if (!text || text.toLowerCase() === selectedKey) {
        continue;
      }

      return text;
    }
  }

  return nextCheckForTraceOutcome(trace);
}

function nextCheckForTraceOutcome(trace: PlanningTrace) {
  const selectedOutcomeIndex = trace.selectedMatchedOutcomeId
    ? trace.outcomes.findIndex(
        (outcome) => outcome.id === trace.selectedMatchedOutcomeId,
      )
    : -1;
  const candidates = [
    ...(selectedOutcomeIndex >= 0
      ? trace.outcomes.slice(selectedOutcomeIndex + 1)
      : []),
    ...trace.outcomes,
  ].filter(
    (outcome) =>
      outcome.status !== "met" &&
      (!trace.selectedMatchedOutcomeId ||
        outcome.id !== trace.selectedMatchedOutcomeId) &&
      !isCurrentOrMetaTraceOutcome(trace, outcome),
  );
  const outcome = candidates[0];
  const label = compactDecisionText(outcome?.label, 58);
  if (!label) {
    return "";
  }

  const signal = uniqueCompact(
    [...(outcome?.blockers ?? []), outcome?.evidence],
    1,
    70,
  )[0];

  const lead = stripTrailingDecisionPunctuation(label);
  return compactDecisionText(signal ? `${lead}: ${signal}` : label, 118);
}

function isCurrentOrMetaTraceOutcome(
  trace: PlanningTrace,
  outcome: PlanningTrace["outcomes"][number],
) {
  const label = compactDecisionText(outcome.label, 80).toLowerCase();
  const current = compactDecisionText(
    trace.selectedPressureLabel,
    80,
  ).toLowerCase();
  const blockerText = (outcome.blockers ?? []).join(" ");
  return (
    (current && label === current) ||
    /\buseful first move\b/i.test(`${outcome.label} ${blockerText}`)
  );
}

function stripTrailingDecisionPunctuation(value: string) {
  return value.replace(/[.:;,]+\s*$/u, "").trim();
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

function sourceSummaryForDecisionArtifact(
  planningTrace: PlanningTrace | undefined,
  activeConversationDecision: string | undefined,
  travelPhase?: StreetGameState["rowanAutonomy"]["travelPhase"],
) {
  if (travelPhase === "route-progress") {
    return "Validated route progress";
  }

  if (planningTrace?.selectedRecommendation?.sourceKind === "live-llm") {
    return "Live planner recommendation, checked before acting";
  }

  if (planningTrace) {
    return "Planner recommendation, checked before acting";
  }

  if (activeConversationDecision) {
    return "Conversation result";
  }

  return "Rowan's current intent";
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
