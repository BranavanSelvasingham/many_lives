import { estimateConversationPlaybackMs } from "./rowanAutonomy";
import type { StreetGameState } from "./types";

export const ROWAN_PLAYBACK_TIMING_MS = {
  arrivalSettle: 420,
  entrySettle: 100,
  firstEntryPause: 180,
  initialDelay: 120,
  minimumAutoplayGap: 650,
  npcWord: 28,
  playerWord: 24,
  postActionCompletePause: 950,
  postThreadLandedPause: 900,
  preConversationPause: 320,
  sameSpeakerPause: 140,
  turnChangePause: 420,
} as const;

export type RecentBeat = {
  detail: string;
  key: string;
  kind: RowanPlaybackBeatKind;
  label: string;
  locationId?: string;
  title: string;
  tone: "conversation" | "info" | "objective";
};

export type RowanPlaybackBeatKind =
  | "action_complete"
  | "action_start"
  | "arrive"
  | "move"
  | "objective_shift"
  | "rest"
  | "thread_landed"
  | "thread_line"
  | "thread_open"
  | "time_passed";

export type RowanPlaybackBeatTone = RecentBeat["tone"];

export type RowanPlaybackBeat = {
  blocking: boolean;
  detail: string;
  durationMs: number;
  key: string;
  kind: RowanPlaybackBeatKind;
  title: string;
  tone: RowanPlaybackBeatTone;
  locationId?: string;
  npcId?: string;
};

export type RowanPlaybackState = {
  activeBeat?: RowanPlaybackBeat;
  lastCompletedBeat?: RecentBeat;
  queuedBeats: RowanPlaybackBeat[];
};

export type RowanRailCard = {
  detail: string;
  title: string;
  tone: RowanPlaybackBeatTone;
};

export type RowanRailViewModel = {
  justHappened: RowanRailCard | null;
  next: RowanRailCard | null;
  now: RowanRailCard;
  peekLabel: string;
  shouldAutoOpen: boolean;
  statusLabel: string;
  thought: string;
  useConversationTranscript: boolean;
};

type BuildRowanRailViewModelOptions = {
  conversationReplayActive: boolean;
  fallbackThought: string;
  game: StreetGameState;
  playback?: RowanPlaybackState;
  quietStatusLabel: string;
  watchMode?: boolean;
};

const AUTO_OPEN_BEAT_KINDS = new Set<RowanPlaybackBeatKind>([
  "action_complete",
  "action_start",
  "arrive",
  "objective_shift",
  "rest",
  "thread_landed",
  "thread_line",
  "thread_open",
]);

export function createEmptyRowanPlaybackState(): RowanPlaybackState {
  return {
    queuedBeats: [],
  };
}

export function appendRowanPlaybackBeats(
  state: RowanPlaybackState,
  beats: RowanPlaybackBeat[],
): RowanPlaybackState {
  if (beats.length === 0) {
    return state;
  }

  const seenKeys = new Set<string>([
    ...(state.activeBeat?.key ? [state.activeBeat.key] : []),
    ...(state.lastCompletedBeat?.key ? [state.lastCompletedBeat.key] : []),
    ...state.queuedBeats.map((beat) => beat.key),
  ]);
  const nextQueuedBeats = beats.filter((beat) => {
    if (seenKeys.has(beat.key)) {
      return false;
    }

    seenKeys.add(beat.key);
    return true;
  });

  if (nextQueuedBeats.length === 0) {
    return state;
  }

  return {
    ...state,
    queuedBeats: [...state.queuedBeats, ...nextQueuedBeats],
  };
}

export function startNextRowanPlaybackBeat(
  state: RowanPlaybackState,
): RowanPlaybackState {
  if (state.activeBeat || state.queuedBeats.length === 0) {
    return state;
  }

  const [activeBeat, ...queuedBeats] = state.queuedBeats;
  return {
    ...state,
    activeBeat,
    queuedBeats,
  };
}

export function completeActiveRowanPlaybackBeat(
  state: RowanPlaybackState,
): RowanPlaybackState {
  if (!state.activeBeat) {
    return state;
  }

  const recentBeat = recentBeatFromPlaybackBeat(state.activeBeat);
  return {
    ...state,
    activeBeat: undefined,
    lastCompletedBeat: recentBeat ?? state.lastCompletedBeat,
  };
}

export function alignRowanPlaybackWithGame(
  state: RowanPlaybackState,
  game: StreetGameState,
): RowanPlaybackState {
  const activeBeat = beatStillMatchesGameLocation(state.activeBeat, game)
    ? state.activeBeat
    : undefined;
  const lastCompletedBeat = beatStillMatchesGameLocation(
    state.lastCompletedBeat,
    game,
  )
    ? state.lastCompletedBeat
    : undefined;
  const queuedBeats = state.queuedBeats.filter((beat) =>
    beatStillMatchesGameLocation(beat, game),
  );

  if (
    activeBeat === state.activeBeat &&
    lastCompletedBeat === state.lastCompletedBeat &&
    queuedBeats.length === state.queuedBeats.length
  ) {
    return state;
  }

  return {
    ...state,
    activeBeat,
    lastCompletedBeat,
    queuedBeats,
  };
}

export function isBlockingRowanPlayback(
  state: RowanPlaybackState | null | undefined,
) {
  return Boolean(state?.activeBeat || state?.queuedBeats.length);
}

export function estimateLiveConversationBeatMs(game: StreetGameState): number {
  if (!game.activeConversation?.lines.length) {
    return 0;
  }

  return (
    estimateConversationPlaybackMs(
      game.activeConversation.lines,
      ROWAN_PLAYBACK_TIMING_MS,
    ) + ROWAN_PLAYBACK_TIMING_MS.entrySettle
  );
}

export function buildConversationLineBeat(
  game: StreetGameState,
): RowanPlaybackBeat | null {
  if (!game.activeConversation) {
    return null;
  }

  const npcName = npcNameForId(game, game.activeConversation.npcId);
  const latestLine = game.activeConversation.lines.at(-1);
  const latestSpeakerName =
    latestLine?.speaker === "player"
      ? game.player.name
      : latestLine?.speakerName || npcName;
  return {
    blocking: true,
    detail: latestLine
      ? `${latestSpeakerName}: ${trimConversationBeatText(latestLine.text)}`
      : `Rowan is opening the conversation with ${npcName}.`,
    durationMs: estimateLiveConversationBeatMs(game),
    key: `thread-line:${game.activeConversation.threadId}:${game.activeConversation.updatedAt}`,
    kind: "thread_line",
    locationId: game.activeConversation.locationId,
    npcId: game.activeConversation.npcId,
    title: `In conversation with ${npcName}`,
    tone: "conversation",
  };
}

export function deriveRowanPlaybackBeats(
  previousGame: StreetGameState,
  nextGame: StreetGameState,
): RowanPlaybackBeat[] {
  if (previousGame.id !== nextGame.id) {
    return [];
  }

  const beats: RowanPlaybackBeat[] = [];
  const playerMoveDistance = tileDistance(previousGame.player, nextGame.player);
  const previousObjectiveText = normalizeText(
    previousGame.player.objective?.text,
  );
  const nextObjectiveText = normalizeText(nextGame.player.objective?.text);
  const previousJobsById = new Map(
    previousGame.jobs.map((job) => [job.id, job] as const),
  );
  const timeDeltaMinutes =
    nextGame.clock.totalMinutes - previousGame.clock.totalMinutes;
  const energyDelta = nextGame.player.energy - previousGame.player.energy;
  const moneyDelta = nextGame.player.money - previousGame.player.money;

  if (playerMoveDistance > 0) {
    const moveTargetName =
      locationNameForId(nextGame, nextGame.player.currentLocationId) ??
      "the next stop";
    beats.push({
      blocking: true,
      detail:
        nextGame.rowanAutonomy?.detail ||
        `Rowan is on his way to ${moveTargetName}.`,
      durationMs: moveDurationMs(playerMoveDistance),
      key: `move:${nextGame.currentTime}:${nextGame.player.x}:${nextGame.player.y}:${nextGame.rowanAutonomy?.key ?? "idle"}`,
      kind: "move",
      locationId: nextGame.player.currentLocationId,
      title: `Walking to ${moveTargetName}`,
      tone: beatToneForAutonomy(nextGame.rowanAutonomy?.layer),
    });
  }

  if (
    previousGame.player.currentLocationId !== nextGame.player.currentLocationId
  ) {
    const locationName =
      locationNameForId(nextGame, nextGame.player.currentLocationId) ??
      "the next stop";
    beats.push({
      blocking: true,
      detail: `Rowan reached ${locationName}.`,
      durationMs: ROWAN_PLAYBACK_TIMING_MS.arrivalSettle,
      key: `arrive:${nextGame.currentTime}:${nextGame.player.currentLocationId ?? "street"}`,
      kind: "arrive",
      locationId: nextGame.player.currentLocationId,
      title: `Arrived at ${locationName}`,
      tone: "info",
    });
  }

  if (!previousGame.activeConversation && nextGame.activeConversation) {
    const npcName = npcNameForId(nextGame, nextGame.activeConversation.npcId);
    beats.push({
      blocking: true,
      detail: `Rowan is starting a conversation with ${npcName}.`,
      durationMs: ROWAN_PLAYBACK_TIMING_MS.preConversationPause,
      key: `thread-open:${nextGame.activeConversation.threadId}:${nextGame.activeConversation.updatedAt}`,
      kind: "thread_open",
      locationId: nextGame.activeConversation.locationId,
      npcId: nextGame.activeConversation.npcId,
      title: `Talk to ${npcName}`,
      tone: "conversation",
    });
  }

  const acceptedJob = nextGame.jobs.find((job) => {
    const previousJob = previousJobsById.get(job.id);
    return job.accepted && !previousJob?.accepted;
  });
  if (acceptedJob) {
    const locationName =
      locationNameForId(nextGame, acceptedJob.locationId) ?? "the block";
    beats.push({
      blocking: true,
      detail: `Rowan locked in ${acceptedJob.title.toLowerCase()} at ${locationName} and can plan around it now.`,
      durationMs: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
      key: `action-start:${acceptedJob.id}:${nextGame.currentTime}`,
      kind: "action_start",
      locationId: acceptedJob.locationId,
      title: "Shift booked",
      tone: "objective",
    });
  }

  const previousTeaShiftStage = previousGame.firstAfternoon?.teaShiftStage;
  const nextTeaShiftStage = nextGame.firstAfternoon?.teaShiftStage;
  if (
    nextTeaShiftStage &&
    nextTeaShiftStage !== previousTeaShiftStage &&
    nextTeaShiftStage !== "paid"
  ) {
    const stageCopy =
      nextTeaShiftStage === "rush"
        ? {
            detail:
              "Lunch is filling Kettle & Lamp. Rowan starts with cups, tables, and the counter.",
            title: "Lunch rush started",
          }
        : {
            detail:
              "The rush is cresting. Rowan has found the rhythm and can finish the counter pass.",
            title: "Rush steadied",
          };
    beats.push({
      blocking: true,
      detail: stageCopy.detail,
      durationMs: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
      key: `tea-shift-stage:${nextTeaShiftStage}:${nextGame.currentTime}`,
      kind: "action_start",
      locationId: "tea-house",
      title: stageCopy.title,
      tone: "objective",
    });
  }

  if (previousGame.activeConversation && !nextGame.activeConversation) {
    const thread =
      nextGame.conversationThreads[previousGame.activeConversation.npcId];
    const npcName = npcNameForId(
      nextGame,
      previousGame.activeConversation.npcId,
    );
    const outcomeText =
      thread?.decision ??
      thread?.objectiveText ??
      thread?.summary ??
      `${npcName} gave Rowan a lead.`;
    beats.push({
      blocking: true,
      detail: sentenceCaseFragment(outcomeText),
      durationMs: ROWAN_PLAYBACK_TIMING_MS.postThreadLandedPause,
      key: `thread-landed:${previousGame.activeConversation.threadId}:${nextGame.currentTime}`,
      kind: "thread_landed",
      locationId:
        thread?.locationId ?? previousGame.activeConversation.locationId,
      npcId: previousGame.activeConversation.npcId,
      title: `Conversation finished with ${npcName}`,
      tone: "conversation",
    });
  }

  const completedJob = nextGame.jobs.find((job) => {
    const previousJob = previousJobsById.get(job.id);
    return job.completed && !previousJob?.completed;
  });
  if (completedJob) {
    const locationName =
      locationNameForId(nextGame, completedJob.locationId) ?? "the shift";
    const payCopy = moneyDelta > 0 ? ` and came away with +$${moneyDelta}` : "";
    beats.push({
      blocking: true,
      detail: `Rowan made it through ${locationName}${payCopy}.`,
      durationMs: ROWAN_PLAYBACK_TIMING_MS.postActionCompletePause,
      key: `action-complete:${completedJob.id}:${nextGame.currentTime}`,
      kind: "action_complete",
      locationId: completedJob.locationId,
      title: `${completedJob.title} complete`,
      tone: "objective",
    });
  }

  if (previousObjectiveText !== nextObjectiveText && nextObjectiveText) {
    const conversationJustLanded = beats.some(
      (beat) => beat.kind === "thread_landed",
    );
    if (!conversationJustLanded) {
      beats.push({
        blocking: true,
        detail: nextGame.player.objective?.text ?? "Rowan has a new objective.",
        durationMs: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
        key: `objective-shift:${nextGame.player.objective?.routeKey ?? nextGame.currentTime}`,
        kind: "objective_shift",
        title: "Objective shifted",
        tone: "objective",
      });
    }
  }

  if (timeDeltaMinutes >= 45) {
    const alreadyExplained = beats.some(
      (beat) =>
        beat.kind === "action_complete" ||
        beat.kind === "thread_landed" ||
        beat.kind === "objective_shift",
    );
    if (!alreadyExplained) {
      const atHome =
        nextGame.player.currentLocationId === "boarding-house" ||
        /morrow house|boarding house/i.test(
          locationNameForId(nextGame, nextGame.player.currentLocationId) ?? "",
        );
      if (energyDelta > 0 && atHome) {
        beats.push({
          blocking: true,
          detail: `Rowan caught his breath and got ${energyDelta} energy back before the next push.`,
          durationMs: ROWAN_PLAYBACK_TIMING_MS.postActionCompletePause,
          key: `rest:${nextGame.currentTime}:${nextGame.player.energy}`,
          kind: "rest",
          locationId: nextGame.player.currentLocationId,
          title: "Rest complete",
          tone: "info",
        });
      } else {
        beats.push({
          blocking: true,
          detail: `${formatClockLabel(nextGame.currentTime)} now.`,
          durationMs: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
          key: `time-passed:${nextGame.currentTime}`,
          kind: "time_passed",
          title: "Time passed",
          tone: "info",
        });
      }
    }
  }

  return beats;
}

export function buildRowanRailViewModel({
  conversationReplayActive,
  fallbackThought,
  game,
  playback,
  quietStatusLabel,
  watchMode = false,
}: BuildRowanRailViewModelOptions): RowanRailViewModel {
  const alignedPlayback = playback
    ? alignRowanPlaybackWithGame(playback, game)
    : undefined;
  const liveConversationBeat =
    conversationReplayActive || game.activeConversation
      ? buildConversationLineBeat(game)
      : null;
  const activeBeat = liveConversationBeat ?? alignedPlayback?.activeBeat;
  const useConversationTranscript = Boolean(liveConversationBeat);
  const completedObjectiveAutonomy =
    objectiveIsComplete(game) &&
    game.rowanAutonomy?.layer === "objective" &&
    !game.rowanAutonomy.autoContinue;
  const autonomyCard = {
    detail:
      game.rowanAutonomy?.autoContinue || completedObjectiveAutonomy
        ? game.rowanAutonomy.detail
        : (game.player.objective?.text ??
          "Choose where Rowan should go or what he should do next."),
    title:
      game.rowanAutonomy?.autoContinue || completedObjectiveAutonomy
        ? game.rowanAutonomy.label
        : (game.player.objective?.text ?? "Choose a direction"),
    tone: beatToneForAutonomy(game.rowanAutonomy?.layer),
  };
  const openingBeat = isFirstAfternoonOpening(game);
  const openingNowCard: RowanRailCard = {
    detail:
      "Rowan has $12, tonight's bed at Morrow House, and one useful first person to ask: Mara.",
    title: "A room for tonight",
    tone: "info",
  };
  const openingNextCard: RowanRailCard = {
    detail:
      "Mara can explain what the room costs, what the house expects, and how tonight works.",
    title: "Ask Mara how to keep tonight's room.",
    tone: "objective",
  };
  const nowCard = activeBeat
    ? railCardFromBeat(activeBeat)
    : openingBeat
      ? openingNowCard
      : autonomyCard;
  const nextCard =
    activeBeat?.kind === "thread_line"
      ? null
      : activeBeat
        ? buildNextRailCard(autonomyCard, activeBeat)
        : openingBeat
          ? openingNextCard
          : buildObjectiveNextRailCard(game, autonomyCard);
  const statusLabel = useConversationTranscript
    ? "Live conversation"
    : activeBeat
      ? statusLabelForBeat(activeBeat)
      : completedObjectiveAutonomy
        ? "Complete"
        : game.rowanAutonomy?.autoContinue
          ? watchMode
            ? "Watching Rowan"
            : "Ready"
          : quietStatusLabel;
  const justHappened = useConversationTranscript
    ? null
    : alignedPlayback?.lastCompletedBeat
      ? {
          detail: alignedPlayback.lastCompletedBeat.detail,
          title: alignedPlayback.lastCompletedBeat.title,
          tone: alignedPlayback.lastCompletedBeat.tone,
        }
      : null;
  const thought =
    activeBeat?.detail ||
    (openingBeat
      ? "Follow Rowan as he spends time, earns money, meets people, and tries to get a foothold."
      : "") ||
    fallbackThought ||
    nextCard?.detail ||
    game.player.objective?.text ||
    "Choose Rowan's next step.";

  return {
    justHappened,
    next: nextCard,
    now: nowCard,
    peekLabel: openingBeat
      ? "First morning in South Quay"
      : activeBeat?.title ?? nextCard?.title ?? nowCard.title,
    shouldAutoOpen:
      useConversationTranscript ||
      Boolean(activeBeat && AUTO_OPEN_BEAT_KINDS.has(activeBeat.kind)),
    statusLabel,
    thought,
    useConversationTranscript,
  };
}

export function isFirstAfternoonOpening(game: StreetGameState) {
  const progress = game.player.objective?.progress;
  const hasConversationHistory =
    game.conversations.length > 0 ||
    Object.values(game.conversationThreads).some(
      (thread) => thread.lines.length > 0,
    );

  return Boolean(
    game.player.objective?.routeKey === "first-afternoon" &&
      progress &&
      progress.completed === 0 &&
      !game.activeConversation &&
      !hasConversationHistory &&
      !game.firstAfternoon?.planSettledAt &&
      !game.firstAfternoon?.teaShiftStage &&
      !game.firstAfternoon?.completedAt,
  );
}

function trimConversationBeatText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 150) {
    return normalized;
  }

  return `${normalized.slice(0, 147).trimEnd()}...`;
}

function sentenceCaseFragment(text: string) {
  const trimmed = text.trim();
  return trimmed.replace(
    /^([\s"'(\[]*)([a-z])/,
    (_match, prefix, firstLetter) => `${prefix}${firstLetter.toUpperCase()}`,
  );
}

function railCardFromBeat(beat: RowanPlaybackBeat): RowanRailCard {
  return {
    detail: beat.detail,
    title: beat.title,
    tone: beat.tone,
  };
}

function buildNextRailCard(
  autonomyCard: RowanRailCard,
  activeBeat: RowanPlaybackBeat | null | undefined,
): RowanRailCard | null {
  if (
    activeBeat &&
    normalizeText(activeBeat.title) === normalizeText(autonomyCard.title) &&
    normalizeText(activeBeat.detail) === normalizeText(autonomyCard.detail)
  ) {
    return null;
  }

  return autonomyCard;
}

function buildObjectiveNextRailCard(
  game: StreetGameState,
  nowCard: RowanRailCard,
): RowanRailCard | null {
  if (objectiveIsComplete(game)) {
    return null;
  }

  const nextObjectiveStep = game.player.objective?.trail.find(
    (step) => !step.done,
  );
  const objectiveText =
    nextObjectiveStep?.title ??
    game.player.objective?.text ??
    "Choose Rowan's next objective.";
  const nextCard = {
    detail:
      nextObjectiveStep?.detail ?? game.player.objective?.text ?? objectiveText,
    title: objectiveText,
    tone: "objective" as const,
  };

  if (
    normalizeText(nextCard.title) === normalizeText(nowCard.title) ||
    normalizeText(nextCard.detail) === normalizeText(nowCard.detail)
  ) {
    return null;
  }

  return nextCard;
}

function statusLabelForBeat(beat: RowanPlaybackBeat) {
  switch (beat.kind) {
    case "move":
      return "On the move";
    case "arrive":
      return "Arrival";
    case "thread_open":
    case "thread_line":
      return "Live conversation";
    case "thread_landed":
      return "Conversation finished";
    case "action_complete":
      return "Action complete";
    case "objective_shift":
      return "Objective shift";
    case "rest":
      return "Rest complete";
    default:
      return "Ready";
  }
}

function recentBeatFromPlaybackBeat(
  beat: RowanPlaybackBeat,
): RecentBeat | null {
  if (
    beat.kind === "move" ||
    beat.kind === "thread_open" ||
    beat.kind === "action_start"
  ) {
    return null;
  }

  return {
    detail: beat.detail,
    key: beat.key,
    kind: beat.kind,
    label: "Just happened",
    locationId: beat.locationId,
    title: beat.title,
    tone: beat.tone,
  };
}

function beatStillMatchesGameLocation(
  beat:
    | Pick<RowanPlaybackBeat, "locationId">
    | Pick<RecentBeat, "locationId">
    | null
    | undefined,
  game: StreetGameState,
) {
  return !beat?.locationId || beat.locationId === game.player.currentLocationId;
}

function moveDurationMs(tileCount: number) {
  return clamp(
    tileCount * 360,
    ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
    4800,
  );
}

function beatToneForAutonomy(
  layer: StreetGameState["rowanAutonomy"]["layer"],
): RowanPlaybackBeatTone {
  if (layer === "conversation") {
    return "conversation";
  }

  if (layer === "objective" || layer === "commitment") {
    return "objective";
  }

  return "info";
}

function npcNameForId(game: StreetGameState, npcId: string | undefined) {
  return (
    game.npcs.find((candidate) => candidate.id === npcId)?.name ??
    "someone nearby"
  );
}

function locationNameForId(
  game: StreetGameState,
  locationId: string | undefined,
) {
  return game.locations.find((location) => location.id === locationId)?.name;
}

function tileDistance(
  previousPlayer: Pick<StreetGameState["player"], "x" | "y">,
  nextPlayer: Pick<StreetGameState["player"], "x" | "y">,
) {
  return (
    Math.abs(nextPlayer.x - previousPlayer.x) +
    Math.abs(nextPlayer.y - previousPlayer.y)
  );
}

function normalizeText(text: string | null | undefined) {
  return (
    text
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/[.?!]+$/g, "")
      .toLowerCase() ?? ""
  );
}

function objectiveIsComplete(game: StreetGameState) {
  const progress = game.player.objective?.progress;
  return Boolean(
    progress && progress.total > 0 && progress.completed >= progress.total,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatClockLabel(isoString: string) {
  const date = new Date(isoString);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const normalizedHour = hour % 12 || 12;
  const meridian = hour >= 12 ? "PM" : "AM";
  const paddedMinute = String(minute).padStart(2, "0");
  return `${normalizedHour}:${paddedMinute} ${meridian}`;
}
