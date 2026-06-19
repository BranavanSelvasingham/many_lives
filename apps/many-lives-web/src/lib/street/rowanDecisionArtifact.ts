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
  /\bnpcPressureMoves\b/gi,
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
    autonomyDetail: game.rowanAutonomy?.detail,
    autonomyLabel: game.rowanAutonomy?.label,
    autonomyReason: game.rowanAutonomy?.intent?.reason,
    autonomySignals: game.rowanAutonomy?.intent?.signals,
    objectiveText: game.player.objective?.text,
    postFirstAfternoonChoiceSignal: postFirstAfternoonChoiceSignal(game),
    planningTrace: game.rowanAutonomy?.planningTrace,
    recentIndependentResolution: recentIndependentResolutionConstraint(game),
    travelPhase: game.rowanAutonomy?.travelPhase,
  });
}

export function buildRowanVisibleDecisionArtifactFromState({
  activeConversationDecision,
  autonomyActionId,
  autonomyDetail,
  autonomyLabel,
  autonomyReason,
  autonomySignals,
  objectiveText,
  postFirstAfternoonChoiceSignal,
  planningTrace,
  recentIndependentResolution,
  travelPhase,
}: {
  activeConversationDecision?: string;
  autonomyActionId?: string;
  autonomyDetail?: string;
  autonomyLabel?: string;
  autonomyReason?: string;
  autonomySignals?: string[];
  objectiveText?: string;
  postFirstAfternoonChoiceSignal?: string;
  planningTrace?: PlanningTrace;
  recentIndependentResolution?: string;
  travelPhase?: StreetGameState["rowanAutonomy"]["travelPhase"];
}): RowanVisibleDecisionArtifact | null {
  if (
    !planningTrace &&
    !activeConversationDecision &&
    !autonomyActionId &&
    !autonomyLabel
  ) {
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
          autonomyDetail ??
          activeConversationDecision
        }`
      : selectedOption?.rationale ??
          selectedStep?.rationale ??
          autonomyReason ??
          autonomyDetail ??
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
    planningTrace
      ? (planningTrace.selectedPressureLabel ??
          planningTrace.outcomes.find((outcome) => outcome.status !== "met")
            ?.label ??
          objectiveText ??
          activeConversationDecision ??
          autonomyLabel)
      : (activeConversationDecision ?? autonomyLabel ?? objectiveText),
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
      ...(planningTrace?.considered ?? []).map(visibleConsideredOptionText),
      ...(planningTrace?.nextSteps ?? []).map((step) => step.label),
      planningTrace ? undefined : selectedAction,
    ],
    3,
    64,
  );
  const passedOver = uniqueCompact(
    [
      ...(planningTrace?.rejected ?? []).map(visibleRejectedOptionText),
      ...(planningTrace?.blockers ?? []),
    ],
    2,
    72,
  );
  const artifactSignals = planningTrace
    ? autonomySignals
    : autonomySignals?.filter((signal) => !/^Goal:/i.test(signal));
  const constraints = uniqueCompact(
    [
      recentIndependentResolution,
      postFirstAfternoonChoiceSignal,
      ...(artifactSignals ?? []),
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

function postFirstAfternoonChoiceSignal(game: StreetGameState) {
  const objectiveRouteKey = game.player.objective?.routeKey;
  if (
    !game.firstAfternoon?.completedAt ||
    !game.firstAfternoon?.completionAcknowledgedAt ||
    !objectiveRouteKey ||
    objectiveRouteKey === "first-afternoon"
  ) {
    return undefined;
  }

  const currentHour = game.clock.hour + game.clock.minute / 60;
  const yardJob = game.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = game.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const openings: string[] = [];

  if (
    yardJob?.discovered &&
    !yardJob.completed &&
    !yardJob.missed &&
    currentHour < yardJob.endHour
  ) {
    openings.push("North Crane Yard work");
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active") {
    openings.push("the Morrow Yard pump");
  }

  if (openings.length === 0) {
    return undefined;
  }

  if (objectiveRouteKey === "rest-home") {
    return `Recovering before weighing ${formatChoiceContrast(openings)}.`;
  }

  return `Weighing ${formatChoiceContrast(openings)}.`;
}

function formatChoiceContrast(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "the next useful opening";
  }

  return `${values.slice(0, -1).join(", ")} against ${
    values[values.length - 1]
  }`;
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

  const lead = nextCheckLeadForOutcome(outcome, label, signal);
  return compactDecisionText(signal ? `${lead}: ${signal}` : label, 118);
}

function nextCheckLeadForOutcome(
  outcome: PlanningTrace["outcomes"][number],
  label: string,
  signal: string | undefined,
) {
  if (signal && outcome.status === "blocked") {
    if (
      /^Yard work lead confirmed$/i.test(label) &&
      /\bnot confirmed\b/i.test(signal)
    ) {
      return "Confirm yard work lead";
    }

    if (
      /^Tea-house work lead confirmed$/i.test(label) &&
      /\bnot confirmed\b/i.test(signal)
    ) {
      return "Confirm tea-house work lead";
    }
  }

  return stripTrailingDecisionPunctuation(label);
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

function visibleConsideredOptionText(
  option: PlanningTrace["considered"][number],
) {
  if (!isRouteCommandOptionLabel(option.label)) {
    return option.label;
  }

  return (
    visibleReasonFirstOptionText(option.label, option.rationale, 92) ??
    option.label
  );
}

function visibleRejectedOptionText(
  option: PlanningTrace["rejected"][number],
) {
  return (
    visibleReasonFirstOptionText(
      option.label,
      playerFacingRejectedReason(option),
      92,
    ) ?? option.label
  );
}

function playerFacingRejectedReason(
  option: PlanningTrace["rejected"][number],
) {
  const reason = option.reason ?? option.rationale;
  if (isStaleIllegalPlanningReason(reason)) {
    return "That opening has closed, so Rowan keeps to the confirmed choice.";
  }

  return reason;
}

function isStaleIllegalPlanningReason(reason: string | undefined) {
  return Boolean(
    reason?.match(
      /\b(?:Rejected because\s+)?this\s+(?:objective action|route hint action|suggested move)\s+is\s+no\s+longer\s+legal\s+in\s+the\s+current\s+world\s+state\.?/i,
    ),
  );
}

function visibleReasonFirstOptionText(
  label: string,
  reason: string | undefined,
  max: number,
) {
  const compactReason = compactDecisionText(reason, max);
  if (!compactReason) {
    return undefined;
  }

  const compactLabel = stripTrailingDecisionPunctuation(
    compactDecisionText(label, 72),
  );
  if (!compactLabel) {
    return compactReason;
  }

  const reasonWithoutLabel = compactReason
    .replace(
      new RegExp(`^${escapeRegExp(compactLabel)}\\s*[:\\-]\\s*`, "i"),
      "",
    )
    .trim();
  return reasonWithoutLabel || compactReason;
}

function isRouteCommandOptionLabel(label: string) {
  return /^(?:head|walk|go|move|return|enter|cross|follow)\s+(?:to|toward|into|through|back\b)/i.test(
    label.trim(),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (planningTrace?.selectedPressureKind === "commitment") {
    return "Commitment follow-through, checked before acting";
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
    .replace(
      /\b(?:Rejected because\s+)?this\s+(?:objective action|route hint action|suggested move)\s+is\s+no\s+longer\s+legal\s+in\s+the\s+current\s+world\s+state\.?/gi,
      "That opening has closed for now.",
    )
    .replace(/^Action:\s*/i, "")
    .replace(/\bcurrent objective\b/gi, "current aim")
    .replace(/\bcurrent world state\b/gi, "current situation")
    .replace(/\bplanner trace\b/gi, "Rowan weighs")
    .replace(/\bis an open desired-state predicate\b/gi, "")
    .replace(/\bdesired-state predicate\b/gi, "aim")
    .replace(/\bstale predicate\b/gi, "stale lead")
    .replace(/\bpredicate\b/gi, "aim")
    .replace(/\bRejected because\b/gi, "")
    .replace(/\bno longer legal\b/gi, "not available now")
    .replace(/\bdominant live pressure\b/gi, "strongest current reason")
    .replace(/\blive pressure\b/gi, "current reason")
    .replace(/\b(?:objective action|route hint action)\b/gi, "opening")
    .replace(/\bsuggested move\b/gi, "option")
    .replace(/\broute hint\b/gi, "suggested path")
    .replace(/\b(?:npc|job|problem|route|enter|talk|move|wait|objective|location):[A-Za-z0-9_-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}
