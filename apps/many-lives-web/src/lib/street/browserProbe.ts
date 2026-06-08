import type {
  RowanPlaybackState,
  RowanRailViewModel,
} from "./rowanPlayback";
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
  movement?: StreetBrowserMovementDiagnostics;
  optimisticPlayerPosition?: {
    x: number;
    y: number;
  };
  rowanPlayback?: Pick<
    RowanPlaybackState,
    "activeBeat" | "lastCompletedBeat" | "queuedBeats"
  >;
  rowanAutoplayEnabled?: boolean;
  rowanAutoplayFrozen?: boolean;
  visualEventCues?: Array<{
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

  return {
    blockers: trace.blockers,
    considered: trace.considered.map(optionPayload),
    nextSteps: (trace.nextSteps ?? []).map((step) => ({
      actionId: step.actionId ?? null,
      kind: step.kind,
      label: step.label,
      legal: step.legal,
      npcId: step.npcId ?? null,
      rationale: step.rationale,
      targetLocationId: step.targetLocationId ?? null,
      validation: step.validation,
    })),
    outcomes: trace.outcomes.map((outcome) => ({
      authority: outcome.authority ?? null,
      blockers: outcome.blockers ?? [],
      evidence: outcome.evidence ?? null,
      id: outcome.id,
      label: outcome.label,
      status: outcome.status,
      urgency: outcome.urgency,
    })),
    rejected: trace.rejected.map(optionPayload),
    selectedActionId: trace.selectedActionId ?? null,
    selectedLabel: trace.selectedLabel ?? null,
    selectedMatchedOutcomeId: trace.selectedMatchedOutcomeId ?? null,
    selectedPlanKey: trace.selectedPlanKey ?? null,
    selectedPressureId: trace.selectedPressureId ?? null,
    selectedPressureKind: trace.selectedPressureKind ?? null,
    selectedPressureLabel: trace.selectedPressureLabel ?? null,
    selectedTargetLocationId: trace.selectedTargetLocationId ?? null,
  };
}

function worldPressureProbePayload(game: StreetGameState) {
  const currentTotalMinutes = game.clock.totalMinutes;
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
    npcSchedules: (game.npcs ?? []).map((npc) => {
      const currentHour = game.clock.hour + game.clock.minute / 60;
      const currentSchedule =
        npc.schedule.find(
          (entry) => currentHour >= entry.fromHour && currentHour < entry.toHour,
        ) ?? null;
      const nextSchedule =
        npc.schedule
          .filter((entry) => entry.fromHour > currentHour)
          .sort((left, right) => left.fromHour - right.fromHour)[0] ?? null;
      return {
        currentLocationId: npc.currentLocationId,
        currentConcern: npc.currentConcern,
        currentScheduleLocationId: currentSchedule?.locationId ?? null,
        id: npc.id,
        mood: npc.mood,
        nextScheduleLocationId: nextSchedule?.locationId ?? null,
        nextScheduleStartsInMinutes: nextSchedule
          ? Math.max(0, Math.round((nextSchedule.fromHour - currentHour) * 60))
          : null,
      };
    }),
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
  const currentLocation = game.locations.find(
    (location) => location.id === game.player.currentLocationId,
  );
  const payload = {
    activeConversation: activeConversation
      ? {
          lines: activeConversation.lines.length,
          npcId: activeConversation.npcId,
          npcName: conversationNpcName ?? null,
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
    gameId: game.id,
    visualEventCues: snapshot.visualEventCues ?? [],
    firstAfternoon: {
      completedAt: game.firstAfternoon?.completedAt ?? null,
      completionAcknowledgedAt:
        game.firstAfternoon?.completionAcknowledgedAt ?? null,
      hasFieldNote: Boolean(game.firstAfternoon?.fieldNote),
      hasLeadFieldNote: Boolean(game.firstAfternoon?.leadFieldNote),
      planSettledAt: game.firstAfternoon?.planSettledAt ?? null,
      teaShiftStage: game.firstAfternoon?.teaShiftStage ?? null,
    },
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      spaceId: game.activeSpaceId ?? game.player.spaceId ?? null,
      x: game.player.x,
      y: game.player.y,
    },
    objective: objectiveProbePayload(game),
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
    worldPressure: worldPressureProbePayload(game),
    visualPlayer: {
      isMovingToServerState: Boolean(snapshot.optimisticPlayerPosition),
      targetX: snapshot.optimisticPlayerPosition?.x ?? game.player.x,
      targetY: snapshot.optimisticPlayerPosition?.y ?? game.player.y,
    },
    movement: snapshot.movement ?? null,
    playback: {
      activeKind: snapshot.rowanPlayback?.activeBeat?.kind ?? null,
      activeTitle: snapshot.rowanPlayback?.activeBeat?.title ?? null,
      justHappened: snapshot.rowanPlayback?.lastCompletedBeat?.title ?? null,
      queuedCount: snapshot.rowanPlayback?.queuedBeats.length ?? 0,
    },
    watchMode: {
      autoContinue: game.rowanAutonomy.autoContinue,
      enabled: Boolean(snapshot.rowanAutoplayEnabled),
      frozen: Boolean(snapshot.rowanAutoplayFrozen),
      pendingPlayback: Boolean(
        snapshot.rowanPlayback?.activeBeat ||
          snapshot.rowanPlayback?.queuedBeats.length,
      ),
      status: snapshot.rowanAutoplayFrozen
        ? "frozen"
        : !snapshot.rowanAutoplayEnabled
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
    },
  };

  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
