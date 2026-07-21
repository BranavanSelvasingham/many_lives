import type {
  RowanPlaybackState,
  RowanRailViewModel,
} from "./rowanPlayback";
import { buildRowanVisibleDecisionArtifact } from "./rowanDecisionArtifact";
import {
  buildIndependentNpcActionRecords,
  findIndependentNpcActionBySummary,
} from "./independentNpcActions";
import type { StreetGameState } from "./types";

export type StreetBrowserMovementDiagnostics = {
  activeSpaceId: string | null;
  npcPatrols: Array<{
    droppedWaypoints: number;
    key: string;
    locationId: string;
    nextLocationId: string | null;
    pathLength: number;
    requestedWaypoints: number;
    routed: boolean;
    snappedWaypoints: number;
    unreachableSegments: number;
    usedVisualHints: boolean;
  }>;
  playerLocationGeometry: {
    actionId: string | null;
    actionLabel: string | null;
    anchorKind: "door" | "frontage" | "player-approach" | "projected-tile";
    anchorLocationId: string | null;
    anchorLocationName: string | null;
    anchorWorldPoint: {
      x: number;
      y: number;
    } | null;
    authoredArrivalPoints: Array<{
      kind: "door" | "frontage" | "player-approach";
      x: number;
      y: number;
    }>;
    competingLandmarkFootprints: Array<{
      bounds: {
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
      };
      locationId: string;
    }>;
    currentLocationId: string | null;
    currentLocationName: string | null;
    currentSpaceId: string | null;
    distanceToAnchor: number | null;
    nearActionLocation: boolean;
    playerTile: {
      x: number;
      y: number;
    };
    playerWorldPoint: {
      x: number;
      y: number;
    };
    targetLocationId: string | null;
  } | null;
  scheduledNpcRoutes: Array<{
    acceptedNoRouteReason: string | null;
    currentScheduleLocationId: string | null;
    droppedWaypoints: number;
    fromLocationId: string;
    key: string;
    legal: boolean;
    nextScheduleLocationId: string | null;
    npcId: string;
    pathLength: number;
    reachesTarget: boolean;
    routeKind: "current-schedule-stop" | "next-scheduled-stop";
    routed: boolean;
    sampledPointsLegal: boolean;
    toLocationId: string;
    unreachableSegments: number;
    visualObstaclesClear: boolean;
  }>;
  scheduledNpcMarkerSamples: Array<{
    activeSpaceId: string | null;
    currentLocationId: string;
    currentScheduleLocationId: string | null;
    distanceToRoute: number | null;
    key: string;
    markerSource: "phaser-marker" | "schedule-route-cue";
    nextScheduleLocationId: string | null;
    npcId: string;
    onRoute: boolean;
    position: {
      x: number;
      y: number;
    };
    routePathLength: number;
    routeProgress: number | null;
    toLocationId: string | null;
    visible: boolean;
  }>;
  scheduledNpcVisualCues: Array<{
    activeSpaceId: string | null;
    cueKind:
      | "current-schedule-stop"
      | "local-schedule-round"
      | "next-scheduled-stop";
    cueLabel: string;
    cueSignal: string;
    currentLocationId: string;
    currentScheduleLocationId: string | null;
    distanceToRoute: number | null;
    fromLocationId: string;
    key: string;
    markerSource: "phaser-marker" | "schedule-route-cue";
    nextScheduleLocationId: string | null;
    nextScheduleStartsInMinutes: number | null;
    npcId: string;
    npcName: string;
    onRoute: boolean;
    position: {
      x: number;
      y: number;
    };
    routeLegal: boolean;
    routePathLength: number;
    routeProgress: number | null;
    toLocationId: string;
    visible: boolean;
  }>;
  playerRoute: {
    active: boolean;
    diagnostics: {
      blockedByVisualScene: number;
      legal: boolean;
      reachesDestination: boolean;
      sampledPointsLegal: boolean;
      snappedEnd: boolean;
      snappedStart: boolean;
      visualObstaclesClear: boolean;
    };
    durationMs: number;
    legal: boolean;
    progress: number;
    reachesDestination: boolean;
    sampledPointsLegal: boolean;
    spaceId: string | null;
    visualObstaclesClear: boolean;
    target: {
      x: number;
      y: number;
    };
    targetLocationId: string | null;
    tilePath: Array<{
      x: number;
      y: number;
    }>;
    worldPath: Array<{
      x: number;
      y: number;
    }>;
  } | null;
};

export type StreetBrowserProbeSnapshot = {
  autoContinueBeatTiming?: {
    intendedDelayMs: number;
    key: string;
    startedAtMs: number;
  } | null;
  busyLabel?: string | null;
  conversationReplay?: {
    isReplaying: boolean;
    revealedEntryIds: string[];
    streamedWordCount: number;
    streamingEntryId: string | null;
  };
  movement?: StreetBrowserMovementDiagnostics;
  optimisticPlayerPosition?: {
    x: number;
    y: number;
  };
  rowanPlayback?: Pick<
    RowanPlaybackState,
    | "activeBeat"
    | "activeBeatStartedAtMs"
    | "completedBeatTimings"
    | "lastCompletedBeat"
    | "queuedBeats"
  >;
  rowanAutoplayEnabled?: boolean;
  rowanAutoplayFrozen?: boolean;
  rowanWatchModeEnabled?: boolean;
  visualEventCues?: Array<{
    backingEvents: Array<{
      id: string;
      locationId: string;
      outcome: string | null;
      progress: string | null;
      status: string;
      visibleLabel: string | null;
    }>;
    cue: string;
    locationId: string;
    locationName: string;
    signal: string;
    visibleLabel: string | null;
  }>;
};

function objectiveProbePayload(game: StreetGameState) {
  const objective = game.player.objective;
  return {
    focus: objective?.focus ?? null,
    outcomes:
      objective?.outcomes.map((outcome) => ({
        actionId: outcome.actionId ?? null,
        authority: outcome.authority ?? null,
        blockers: outcome.blockers ?? [],
        evidence: outcome.evidence ?? null,
        id: outcome.id,
        label: outcome.label,
        npcId: outcome.npcId ?? null,
        status: outcome.status,
        targetLocationId: outcome.targetLocationId ?? null,
        urgency: outcome.urgency,
      })) ?? [],
    progress: objective?.progress ?? null,
    routeKey: objective?.routeKey ?? null,
    source: objective?.source ?? null,
    text: objective?.text ?? null,
    trailHints:
      objective?.trail.map((hint) => ({
        actionId: hint.actionId ?? null,
        done: Boolean(hint.done),
        id: hint.id,
        npcId: hint.npcId ?? null,
        targetLocationId: hint.targetLocationId ?? null,
        title: hint.title,
      })) ?? [],
  };
}

function planningTraceProbePayload(game: StreetGameState) {
  const trace = game.rowanAutonomy.planningTrace;
  if (!trace) {
    return null;
  }

  const optionPayload = (option: (typeof trace.considered)[number]) => ({
    actionId: option.actionId ?? null,
    label: option.label,
    legalBacking: option.legalBacking
      ? {
          actionId: option.legalBacking.actionId ?? null,
          locationId: option.legalBacking.locationId ?? null,
          source: option.legalBacking.source,
        }
      : null,
    matchedOutcomeId: option.matchedOutcomeId ?? null,
    npcId: option.npcId ?? null,
    planKey: option.planKey,
    pressureId: option.pressureId ?? null,
    pressureKind: option.pressureKind ?? null,
    pressureLabel: option.pressureLabel ?? null,
    provenance: option.provenance,
    rationale: option.rationale,
    reason: option.reason ?? null,
    score: option.score,
    status: option.status,
    targetLocationId: option.targetLocationId ?? null,
  });
  const stepPayload = (step: (typeof trace.nextSteps)[number]) => ({
    actionId: step.actionId ?? null,
    kind: step.kind,
    label: step.label,
    legal: step.legal,
    legalBacking: step.legalBacking
      ? {
          actionId: step.legalBacking.actionId ?? null,
          locationId: step.legalBacking.locationId ?? null,
          source: step.legalBacking.source,
        }
      : null,
    npcId: step.npcId ?? null,
    rationale: step.rationale,
    targetLocationId: step.targetLocationId ?? null,
    validation: step.validation,
  });

  return {
    blockers: trace.blockers,
    considered: trace.considered.map(optionPayload),
    immediateAction: trace.immediateAction
      ? stepPayload(trace.immediateAction)
      : null,
    intendedFollowUp: trace.intendedFollowUp
      ? stepPayload(trace.intendedFollowUp)
      : null,
    nextSteps: (trace.nextSteps ?? []).map(stepPayload),
    outcomes: trace.outcomes.map((outcome) => ({
      authority: outcome.authority ?? null,
      blockers: outcome.blockers ?? [],
      evidence: outcome.evidence ?? null,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      urgency: outcome.urgency,
    })),
    plannerIntent: trace.plannerIntent
      ? {
          actionId: trace.plannerIntent.actionId ?? null,
          label: trace.plannerIntent.label,
          matchedOutcomeId: trace.plannerIntent.matchedOutcomeId ?? null,
          npcId: trace.plannerIntent.npcId ?? null,
          planKey: trace.plannerIntent.planKey ?? null,
          pressureId: trace.plannerIntent.pressureId ?? null,
          pressureKind: trace.plannerIntent.pressureKind ?? null,
          pressureLabel: trace.plannerIntent.pressureLabel ?? null,
          rationale: trace.plannerIntent.rationale,
          targetLocationId: trace.plannerIntent.targetLocationId ?? null,
        }
      : null,
    providerAttempt: trace.providerAttempt
      ? {
          model: trace.providerAttempt.model,
          outcome: trace.providerAttempt.outcome,
          provider: trace.providerAttempt.provider,
          reasonCode: trace.providerAttempt.reasonCode ?? null,
          task: trace.providerAttempt.task,
        }
      : null,
    rejected: trace.rejected.map(optionPayload),
    selectedActionId: trace.selectedActionId ?? null,
    selectedLabel: trace.selectedLabel ?? null,
    selectedLegalBacking: trace.selectedLegalBacking
      ? {
          actionId: trace.selectedLegalBacking.actionId ?? null,
          locationId: trace.selectedLegalBacking.locationId ?? null,
          source: trace.selectedLegalBacking.source,
        }
      : null,
    selectedMatchedOutcomeId: trace.selectedMatchedOutcomeId ?? null,
    selectedPlanKey: trace.selectedPlanKey ?? null,
    selectedPressureId: trace.selectedPressureId ?? null,
    selectedPressureKind: trace.selectedPressureKind ?? null,
    selectedPressureLabel: trace.selectedPressureLabel ?? null,
    selectedRecommendation: trace.selectedRecommendation
      ? {
          accepted: trace.selectedRecommendation.accepted,
          advisory: trace.selectedRecommendation.advisory,
          confidence: trace.selectedRecommendation.confidence ?? null,
          legalBackingSource:
            trace.selectedRecommendation.legalBackingSource ?? null,
          model: trace.selectedRecommendation.model ?? null,
          provider: trace.selectedRecommendation.provider ?? null,
          rationale: trace.selectedRecommendation.rationale ?? null,
          sourceKind: trace.selectedRecommendation.sourceKind,
          validationSource:
            trace.selectedRecommendation.validationSource ?? null,
          validationStatus: trace.selectedRecommendation.validationStatus,
        }
      : null,
    sourceLabel:
      trace.selectedRecommendation?.sourceKind === "live-llm"
        ? "live"
        : trace.selectedRecommendation?.sourceKind ===
            "deterministic-fallback"
          ? "deterministic fallback"
          : "deterministic",
    selectedTargetLocationId: trace.selectedTargetLocationId ?? null,
  };
}

function resolveDailyNpcSchedule(
  schedule: StreetGameState["npcs"][number]["schedule"],
  totalMinutes: number,
) {
  const minutesPerDay = 24 * 60;
  const now = Math.max(0, Math.round(totalMinutes));
  const dayIndex = Math.floor(now / minutesPerDay);
  const occurrences = [] as Array<{
    endTotalMinutes: number;
    startTotalMinutes: number;
    stop: (typeof schedule)[number];
  }>;

  for (let day = Math.max(0, dayIndex - 1); day <= dayIndex + 2; day += 1) {
    for (const stop of schedule) {
      const fromMinute = Math.round(stop.fromHour * 60);
      const toMinute = Math.round(stop.toHour * 60);
      if (
        !Number.isFinite(fromMinute) ||
        !Number.isFinite(toMinute) ||
        fromMinute < 0 ||
        fromMinute >= minutesPerDay ||
        toMinute < 0 ||
        toMinute > minutesPerDay
      ) {
        continue;
      }

      const startTotalMinutes = day * minutesPerDay + fromMinute;
      const durationMinutes =
        toMinute === fromMinute
          ? minutesPerDay
          : toMinute > fromMinute
            ? toMinute - fromMinute
            : minutesPerDay - fromMinute + toMinute;
      occurrences.push({
        endTotalMinutes: startTotalMinutes + durationMinutes,
        startTotalMinutes,
        stop,
      });
    }
  }

  occurrences.sort(
    (left, right) => left.startTotalMinutes - right.startTotalMinutes,
  );
  const active = occurrences.find(
    (occurrence) =>
      now >= occurrence.startTotalMinutes && now < occurrence.endTotalMinutes,
  );
  return {
    active,
    nextOpening: occurrences.find(
      (occurrence) => occurrence.startTotalMinutes > now,
    ),
    status: occurrences.length === 0
      ? "unscheduled"
      : active
        ? "active"
        : "unavailable",
  };
}

function worldPressureProbePayload(game: StreetGameState) {
  const currentTotalMinutes = game.clock.totalMinutes;
  const npcSchedules = (game.npcs ?? []).map((npc) => {
    const schedule = resolveDailyNpcSchedule(
      npc.schedule,
      currentTotalMinutes,
    );
    return {
      activeWindowEndsAtMinutes: schedule.active?.endTotalMinutes ?? null,
      availability: schedule.status,
      currentLocationId: npc.currentLocationId,
      currentConcern: npc.currentConcern,
      currentScheduleLocationId: schedule.active?.stop.locationId ?? null,
      id: npc.id,
      mood: npc.mood,
      nextOpeningAtMinutes: schedule.nextOpening?.startTotalMinutes ?? null,
      nextScheduleLocationId:
        schedule.nextOpening?.stop.locationId ?? null,
      nextScheduleStartsInMinutes: schedule.nextOpening
        ? Math.max(
            0,
            schedule.nextOpening.startTotalMinutes - currentTotalMinutes,
          )
        : null,
    };
  });
  const npcPressureMoves = npcSchedules
    .filter(
      (npc) =>
        npc.currentScheduleLocationId &&
        npc.currentLocationId !== npc.currentScheduleLocationId,
    )
    .map((npc) => ({
      currentConcern: npc.currentConcern,
      currentLocationId: npc.currentLocationId,
      currentScheduleLocationId: npc.currentScheduleLocationId,
      id: npc.id,
      mood: npc.mood,
    }));

  return {
    cityEvents: (game.cityEvents ?? []).map((event) => {
      const startTotal =
        Math.max(0, game.clock.day - 1) * 24 * 60 + event.startMinute;
      const endTotal =
        Math.max(0, game.clock.day - 1) * 24 * 60 + event.endMinute;
      return {
        endsInMinutes:
          event.status === "active"
            ? Math.max(0, endTotal - currentTotalMinutes)
            : null,
        id: event.id,
        locationId: event.locationId,
        outcome: event.outcome ?? null,
        progress: event.progress ?? null,
        resolvedAt: event.resolvedAt ?? null,
        startsInMinutes:
          event.status === "upcoming"
            ? Math.max(0, startTotal - currentTotalMinutes)
            : null,
        status: event.status,
        tone: event.tone,
        visibleLabel: event.visibleLabel,
      };
    }),
    jobWindows: (game.jobs ?? []).map((job) => {
      const startTotal =
        Math.max(0, game.clock.day - 1) * 24 * 60 + Math.round(job.startHour * 60);
      const endTotal =
        Math.max(0, game.clock.day - 1) * 24 * 60 + Math.round(job.endHour * 60);
      const inWindow =
        currentTotalMinutes >= startTotal && currentTotalMinutes < endTotal;
      return {
        accepted: job.accepted,
        completed: job.completed,
        consequenceAppliedAt: job.consequenceAppliedAt ?? null,
        deferredUntilMinutes: job.deferredUntilMinutes ?? null,
        discovered: job.discovered,
        endsInMinutes: inWindow
          ? Math.max(0, endTotal - currentTotalMinutes)
          : null,
        id: job.id,
        inWindow,
        locationId: job.locationId,
        missed: job.missed,
        missedAt: job.missedAt ?? null,
        startsInMinutes:
          currentTotalMinutes < startTotal
            ? Math.max(0, startTotal - currentTotalMinutes)
            : null,
        title: job.title,
      };
    }),
    npcPressureMoves,
    npcSchedules,
    problems: (game.problems ?? []).map((problem) => ({
      discovered: problem.discovered,
      consequenceAppliedAt: problem.consequenceAppliedAt ?? null,
      escalatedAt: problem.escalatedAt ?? null,
      escalationLevel: problem.escalationLevel ?? 0,
      expiredAt: problem.expiredAt ?? null,
      id: problem.id,
      locationId: problem.locationId,
      requiredItemId: problem.requiredItemId ?? null,
      resolvedAt: problem.resolvedAt ?? null,
      resolvedByNpcId: problem.resolvedByNpcId ?? null,
      status: problem.status,
      title: problem.title,
      urgency: problem.urgency,
    })),
  };
}

function independentNpcActionsProbePayload(game: StreetGameState) {
  return buildIndependentNpcActionRecords(game);
}

function independentNpcSurfaceProbePayload({
  game,
  rowanRail,
  snapshot,
}: {
  game: StreetGameState;
  rowanRail: RowanRailViewModel;
  snapshot: StreetBrowserProbeSnapshot;
}) {
  const activeBeat = snapshot.rowanPlayback?.activeBeat;
  const recentBeat = snapshot.rowanPlayback?.lastCompletedBeat;
  const activeMatch =
    activeBeat?.kind === "city_beat"
      ? findIndependentNpcActionBySummary(game, activeBeat.detail)
      : null;
  if (activeMatch) {
    return {
      ...activeMatch,
      detail: activeBeat?.detail ?? activeMatch.playerFacingSummary,
      slot:
        rowanRail.justHappened?.title === activeBeat?.title
          ? "just_happened"
          : "now",
      title: activeBeat?.title ?? null,
    };
  }

  const recentMatch =
    recentBeat?.kind === "city_beat"
      ? findIndependentNpcActionBySummary(game, recentBeat.detail)
      : null;
  if (recentMatch) {
    return {
      ...recentMatch,
      detail: recentBeat?.detail ?? recentMatch.playerFacingSummary,
      slot: "just_happened",
      title: recentBeat?.title ?? null,
    };
  }

  return null;
}

function openingActionCompletionEvidence({
  currentSpaceId,
  game,
  snapshot,
}: {
  currentSpaceId: string | null;
  game: StreetGameState;
  snapshot: StreetBrowserProbeSnapshot;
}) {
  const evidence: string[] = [];
  const routeGeometry = snapshot.movement?.playerLocationGeometry ?? null;

  if (currentSpaceId === "interior:boarding-house") {
    evidence.push("entered-morrow-house");
  }
  if (game.activeConversation?.npcId === "npc-mara") {
    evidence.push("mara-conversation-active");
  }
  if (game.firstAfternoon?.approachesKnownAt) {
    evidence.push("first-afternoon-approaches-known");
  }
  if (game.firstAfternoon?.leadFieldNote) {
    evidence.push("first-afternoon-lead-recorded");
  }
  if (game.firstAfternoon?.teaShiftStage) {
    evidence.push(`first-afternoon-tea-shift-${game.firstAfternoon.teaShiftStage}`);
  }
  if (game.firstAfternoon?.completedAt) {
    evidence.push("first-afternoon-completed");
  }
  if (game.firstAfternoon?.consequence) {
    evidence.push(
      `first-afternoon-consequence-${game.firstAfternoon.consequence.kind}`,
    );
  }
  if (game.activeConversation) {
    evidence.push("interaction-active");
  }
  if (
    snapshot.rowanWatchModeEnabled &&
    routeGeometry?.targetLocationId &&
    (snapshot.optimisticPlayerPosition || snapshot.movement?.playerRoute?.active)
  ) {
    evidence.push("route-progress");
  }

  return Array.from(new Set(evidence));
}

function openingActionSupersededByAutoplayProgress({
  actionId,
  evidence,
  targetLocationId,
}: {
  actionId: string | null;
  evidence: string[];
  targetLocationId: string | null;
}) {
  const openingActionCurrent =
    actionId === "enter:boarding-house" &&
    targetLocationId === "boarding-house";
  const routeProgressedPastOpening =
    evidence.includes("route-progress") && !openingActionCurrent;
  const approachesSupersededOpening =
    evidence.includes("first-afternoon-approaches-known") &&
    !openingActionCurrent;
  const strongProgressEvidence = evidence.some(
    (entry) =>
      [
        "first-afternoon-lead-recorded",
        "first-afternoon-completed",
        "interaction-active",
      ].includes(entry) ||
      entry.startsWith("first-afternoon-tea-shift-") ||
      entry.startsWith("first-afternoon-consequence-"),
  );

  return (
    routeProgressedPastOpening ||
    approachesSupersededOpening ||
    strongProgressEvidence
  );
}

function openingActionStillRelevant(game: StreetGameState) {
  const progress = game.player.objective?.progress;
  const hasConversationHistory =
    game.conversations.length > 0 ||
    Object.values(game.conversationThreads).some(
      (thread) => thread.lines.length > 0,
    );

  return Boolean(
      !game.firstAfternoon?.completionAcknowledgedAt &&
      !game.firstAfternoon?.approachesKnownAt &&
      !game.firstAfternoon?.leadFieldNote &&
      !game.firstAfternoon?.teaShiftStage &&
      !game.firstAfternoon?.completedAt &&
      progress &&
      progress.completed === 0 &&
      !game.activeConversation &&
      !hasConversationHistory,
  );
}

function openingActionCarryForwardProbePayload({
  game,
  rowanRail,
  snapshot,
}: {
  game: StreetGameState;
  rowanRail: RowanRailViewModel;
  snapshot: StreetBrowserProbeSnapshot;
}) {
  const geometry = snapshot.movement?.playerLocationGeometry ?? null;
  const currentSpaceId = game.activeSpaceId ?? game.player.spaceId ?? null;
  const completionEvidence = openingActionCompletionEvidence({
    currentSpaceId,
    game,
    snapshot,
  });
  const currentActionId = game.rowanAutonomy.actionId ?? null;
  const currentTargetLocationId =
    geometry?.targetLocationId ??
    game.rowanAutonomy.targetLocationId ??
    null;
  const openingActionCurrent =
    currentActionId === "enter:boarding-house" &&
    currentTargetLocationId === "boarding-house";
  const progressedBeyondOpening = openingActionSupersededByAutoplayProgress({
    actionId: currentActionId,
    evidence: completionEvidence,
    targetLocationId: currentTargetLocationId,
  });
  const completed =
    completionEvidence.includes("entered-morrow-house") ||
    completionEvidence.includes("mara-conversation-active") ||
    progressedBeyondOpening;
  const openingActionRelevant =
    completed ||
    progressedBeyondOpening ||
    openingActionCurrent ||
    openingActionStillRelevant(game);
  const selectedActionId =
    completed
      ? "enter:boarding-house"
      : geometry?.actionId ?? game.rowanAutonomy.actionId ?? null;
  const rawSelectedActionLabel =
    geometry?.actionLabel ??
    game.rowanAutonomy.label ??
    (completed ? "Enter Morrow House" : null);
  const selectedActionLabel =
    selectedActionId === "enter:boarding-house"
      ? "Enter Morrow House"
      : rawSelectedActionLabel;
  const targetLocationId =
    geometry?.targetLocationId ??
    game.rowanAutonomy.targetLocationId ??
    (completed ? "boarding-house" : null);
  const targetLocation = targetLocationId
    ? game.locations.find((location) => location.id === targetLocationId)
    : null;
  const openingActionSelected =
    selectedActionId === "enter:boarding-house" ||
    targetLocationId === "boarding-house" ||
    completed;

  if (
    !openingActionRelevant ||
    !openingActionSelected
  ) {
    return null;
  }

  const inProgress = Boolean(
    snapshot.optimisticPlayerPosition ||
      snapshot.movement?.playerRoute?.active ||
      snapshot.busyLabel,
  );
  const watchModeEnabled = Boolean(snapshot.rowanWatchModeEnabled);
  const status = completed
    ? "completed"
    : inProgress
      ? "in_progress"
      : watchModeEnabled
        ? "queued"
        : "ready";
  const phase = progressedBeyondOpening
    ? "superseded_by_autoplay_progress"
    : completed
      ? "opening_completed"
      : inProgress
        ? "opening_in_progress"
        : watchModeEnabled
          ? "opening_queued"
          : "opening_ready_for_input";

  return {
    assertion: watchModeEnabled
      ? "Watch mode has the opening action selected and does not require a visible input."
      : "Player mode leaves the opening action ready for explicit input.",
    completionEvidence,
    currentLocationId: game.player.currentLocationId ?? null,
    currentLocationName:
      game.locations.find(
        (location) => location.id === game.player.currentLocationId,
      )?.name ?? null,
    currentSpaceId,
    firstAfternoon: {
      approachesKnownAt: game.firstAfternoon?.approachesKnownAt ?? null,
      completedAt: game.firstAfternoon?.completedAt ?? null,
      completionAcknowledgedAt:
        game.firstAfternoon?.completionAcknowledgedAt ?? null,
      hasLeadFieldNote: Boolean(game.firstAfternoon?.leadFieldNote),
      consequence: game.firstAfternoon?.consequence ?? null,
      planSettledAt: game.firstAfternoon?.planSettledAt ?? null,
      teaShiftStage: game.firstAfternoon?.teaShiftStage ?? null,
    },
    geometry: geometry
      ? {
          anchorLocationId: geometry.anchorLocationId,
          distanceToAnchor: geometry.distanceToAnchor,
          nearActionLocation: geometry.nearActionLocation,
          playerTile: geometry.playerTile,
          playerWorldPoint: geometry.playerWorldPoint,
        }
      : null,
    phase,
    progressedBeyondOpening,
    requiredVisibleInput: !watchModeEnabled && !completed,
    selectedActionId,
    selectedActionLabel,
    status,
    supersededBy: progressedBeyondOpening
      ? {
          activeConversationNpcId: game.activeConversation?.npcId ?? null,
          actionId: game.rowanAutonomy.actionId ?? null,
          label: game.rowanAutonomy.label ?? null,
          locationId: game.player.currentLocationId ?? null,
          mode: game.rowanAutonomy.mode,
          npcId: game.rowanAutonomy.npcId ?? null,
          targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
        }
      : null,
    targetLocationId,
    targetLocationName: targetLocation?.name ?? null,
    watchMode: {
      autoplayEnabled: Boolean(snapshot.rowanAutoplayEnabled),
      enabled: watchModeEnabled,
      frozen: Boolean(snapshot.rowanAutoplayFrozen),
    },
    rail: {
      now: rowanRail.now.title,
      status: rowanRail.statusLabel,
      thought: rowanRail.thought,
    },
  };
}

type BuildStreetBrowserProbeJsonOptions = {
  activeConversation: StreetGameState["activeConversation"];
  conversationNpcName?: string;
  game: StreetGameState;
  rowanRail: RowanRailViewModel;
  snapshot: StreetBrowserProbeSnapshot;
};

export function buildStreetBrowserProbeJson({
  activeConversation,
  conversationNpcName,
  game,
  rowanRail,
  snapshot,
}: BuildStreetBrowserProbeJsonOptions) {
  const wallMonotonicMs =
    typeof performance === "undefined" ? null : performance.now();
  const appMonotonicMs = wallMonotonicMs;
  const currentLocation = game.locations.find(
    (location) => location.id === game.player.currentLocationId,
  );
  const visibleDecisionArtifact = buildRowanVisibleDecisionArtifact(game);
  const payload = {
    busyLabel: snapshot.busyLabel ?? null,
    activeConversation: activeConversation
      ? {
          lines: activeConversation.lines.length,
          npcId: activeConversation.npcId,
          npcName: conversationNpcName ?? null,
          replay:
            snapshot.conversationReplay && rowanRail.useConversationTranscript
            ? {
                isReplaying: snapshot.conversationReplay.isReplaying,
                revealedEntryCount:
                  snapshot.conversationReplay.revealedEntryIds.length,
                streamedWordCount:
                  snapshot.conversationReplay.streamedWordCount,
                streamingEntryId:
                  snapshot.conversationReplay.streamingEntryId,
              }
            : null,
          updatedAt: activeConversation.updatedAt,
        }
      : null,
    aiRuntime: game.aiRuntime
      ? {
          fallbackReasons: game.aiRuntime.fallbackReasons,
          lastLiveCallAt: game.aiRuntime.lastLiveCallAt ?? null,
          lastUpdatedAt: game.aiRuntime.lastUpdatedAt ?? null,
          model: game.aiRuntime.model,
          provider: game.aiRuntime.provider,
          status: game.aiRuntime.status,
          tasks: game.aiRuntime.tasks,
          totalFallbacks: game.aiRuntime.totalFallbacks,
          totalSkips: game.aiRuntime.totalSkips,
          totalSuccesses: game.aiRuntime.totalSuccesses,
        }
      : null,
    autonomy: {
      actionId: game.rowanAutonomy.actionId ?? null,
      autoContinue: game.rowanAutonomy.autoContinue,
      effects: game.rowanAutonomy.effects ?? [],
      intent: game.rowanAutonomy.intent
        ? {
            reason: game.rowanAutonomy.intent.reason,
            signals: game.rowanAutonomy.intent.signals,
          }
        : null,
      key: game.rowanAutonomy.key,
      label: game.rowanAutonomy.label,
      layer: game.rowanAutonomy.layer ?? null,
      mode: game.rowanAutonomy.mode,
      npcId: game.rowanAutonomy.npcId ?? null,
      planningTrace: game.rowanAutonomy.planningTrace
        ? planningTraceProbePayload(game)
        : null,
      stepKind: game.rowanAutonomy.stepKind,
      targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
      travelPhase: game.rowanAutonomy.travelPhase ?? null,
      visibleDecisionArtifact,
    },
    rowanCognition: game.rowanCognition
      ? {
          currentBelief: game.rowanCognition.currentBelief ?? null,
          nextMove: game.rowanCognition.nextMove ?? null,
          notebook: game.rowanCognition.notebook,
          primaryNeed: game.rowanCognition.primaryNeed ?? null,
        }
      : null,
    clock: {
      iso: game.currentTime,
      label: game.clock.label,
      totalMinutes: game.clock.totalMinutes,
    },
    timing: {
      appMonotonicMs,
      wallMonotonicMs,
      autoContinue: snapshot.autoContinueBeatTiming
        ? {
            elapsedMs:
              wallMonotonicMs === null
                ? null
                : Math.max(
                    0,
                    wallMonotonicMs -
                      snapshot.autoContinueBeatTiming.startedAtMs,
                  ),
            intendedDelayMs:
              snapshot.autoContinueBeatTiming.intendedDelayMs,
            key: snapshot.autoContinueBeatTiming.key,
            startedAtMs: snapshot.autoContinueBeatTiming.startedAtMs,
          }
        : null,
    },
    gameId: game.id,
    visualEventCues: snapshot.visualEventCues ?? [],
    firstAfternoon: {
      approachesKnownAt: game.firstAfternoon?.approachesKnownAt ?? null,
      completedAt: game.firstAfternoon?.completedAt ?? null,
      completionAcknowledgedAt:
        game.firstAfternoon?.completionAcknowledgedAt ?? null,
      hasFieldNote: Boolean(game.firstAfternoon?.fieldNote),
      hasLeadFieldNote: Boolean(game.firstAfternoon?.leadFieldNote),
      consequence: game.firstAfternoon?.consequence ?? null,
      planSettledAt: game.firstAfternoon?.planSettledAt ?? null,
      teaShiftStage: game.firstAfternoon?.teaShiftStage ?? null,
    },
    feedTail: (game.feed ?? []).slice(0, 8).map((entry) => ({
      id: entry.id,
      text: entry.text,
      time: entry.time,
      tone: entry.tone,
    })),
    memoriesTail: (game.player.memories ?? []).slice(0, 8).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      text: entry.text,
      time: entry.time,
    })),
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      spaceId: game.activeSpaceId ?? game.player.spaceId ?? null,
      x: game.player.x,
      y: game.player.y,
    },
    scene: {
      locationId: game.currentScene.locationId ?? null,
      people: game.currentScene.people.map((person) => ({
        id: person.id,
        known: person.known,
        name: person.name,
        role: person.role,
      })),
      visibleScheduledNpcMarkers: (
        snapshot.movement?.scheduledNpcMarkerSamples ?? []
      )
        .filter((marker) => marker.visible)
        .map((marker) => ({
          currentLocationId: marker.currentLocationId,
          markerSource: marker.markerSource,
          npcId: marker.npcId,
        })),
    },
    player: {
      energy: game.player.energy,
      lastRestAt: game.player.lastRestAt ?? null,
      money: game.player.money,
    },
    objective: objectiveProbePayload(game),
    openingActionCarryForward: openingActionCarryForwardProbePayload({
      game,
      rowanRail,
      snapshot,
    }),
    cityEvents: (game.cityEvents ?? [])
      .filter((event) => event.status === "active")
      .map((event) => ({
        id: event.id,
        locationId: event.locationId,
        outcome: event.outcome ?? null,
        progress: event.progress ?? null,
        resolvedAt: event.resolvedAt ?? null,
        visibleLabel: event.visibleLabel,
      })),
    independentNpcActions: independentNpcActionsProbePayload(game),
    independentNpcSurface: independentNpcSurfaceProbePayload({
      game,
      rowanRail,
      snapshot,
    }),
    worldPressure: worldPressureProbePayload(game),
    visualPlayer: {
      isMovingToServerState: Boolean(snapshot.optimisticPlayerPosition),
      targetX: snapshot.optimisticPlayerPosition?.x ?? game.player.x,
      targetY: snapshot.optimisticPlayerPosition?.y ?? game.player.y,
    },
    movement: snapshot.movement ?? null,
    playback: {
      activeDurationMs:
        snapshot.rowanPlayback?.activeBeat?.durationMs ?? null,
      activeKind: snapshot.rowanPlayback?.activeBeat?.kind ?? null,
      activeStartedAtMs:
        snapshot.rowanPlayback?.activeBeatStartedAtMs ?? null,
      activeTitle: snapshot.rowanPlayback?.activeBeat?.title ?? null,
      activeKey: snapshot.rowanPlayback?.activeBeat?.key ?? null,
      completedTimings:
        snapshot.rowanPlayback?.completedBeatTimings ?? [],
      justHappened: snapshot.rowanPlayback?.lastCompletedBeat?.title ?? null,
      queuedCount: snapshot.rowanPlayback?.queuedBeats.length ?? 0,
    },
    watchMode: {
      autoContinue: game.rowanAutonomy.autoContinue,
      enabled: Boolean(snapshot.rowanWatchModeEnabled),
      frozen: Boolean(snapshot.rowanAutoplayFrozen),
      pendingPlayback: Boolean(
        snapshot.rowanPlayback?.activeBeat ||
          snapshot.rowanPlayback?.queuedBeats.length,
      ),
      status: snapshot.rowanAutoplayFrozen
        ? "frozen"
        : !snapshot.rowanWatchModeEnabled
          ? "off"
          : game.rowanAutonomy.autoContinue
            ? "watching"
            : game.rowanAutonomy.stepKind === "blocked"
              ? "blocked"
              : "stopped",
    },
    rail: {
      justHappened: rowanRail.justHappened?.title ?? null,
      next: rowanRail.next?.title ?? null,
      now: rowanRail.now.title,
      status: rowanRail.statusLabel,
      thought: rowanRail.thought,
      useConversationTranscript: rowanRail.useConversationTranscript,
      visibleDecisionArtifact:
        rowanRail.now.decisionArtifact ?? rowanRail.next?.decisionArtifact ?? null,
    },
  };

  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
