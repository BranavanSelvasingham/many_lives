import type { ActionOption, StreetGameState } from "./types";

export type PendingConversationSource = "autonomy" | "selection";
export type ConversationAutostartSource =
  | PendingConversationSource
  | "only-talk";

export type ConversationAutostartPlan = {
  autoStartKey: string;
  npcId: string;
  source: ConversationAutostartSource;
  talkActionId: string;
};

export type ConversationPlaybackTiming = {
  entrySettle: number;
  firstEntryPause: number;
  initialDelay: number;
  npcWord: number;
  playerWord: number;
  sameSpeakerPause: number;
  turnChangePause: number;
};

function hasNpc(game: StreetGameState, npcId: string | null | undefined) {
  return Boolean(npcId && game.npcs.some((npc) => npc.id === npcId));
}

function extractTalkNpcId(actionId: string) {
  const [kind, targetId] = actionId.split(":");
  return kind === "talk" && targetId ? targetId : undefined;
}

function findConversationPreviewLength(game: StreetGameState, npcId: string) {
  const thread = Object.values(game.conversationThreads ?? {}).find(
    (candidate) => candidate.npcId === npcId,
  );
  return thread?.lines.length ?? 0;
}

function getTalkTargets(actions: ActionOption[]) {
  return actions.flatMap((action) => {
    const npcId = extractTalkNpcId(action.id);
    return npcId ? [{ actionId: action.id, npcId }] : [];
  });
}

function getConversationThread(game: StreetGameState, npcId: string | null) {
  if (!npcId) {
    return undefined;
  }

  return Object.values(game.conversationThreads ?? {}).find(
    (candidate) => candidate.npcId === npcId,
  );
}

export function conversationThreadHasOutcome(
  thread: StreetGameState["conversationThreads"][string] | undefined,
) {
  return Boolean(
    thread?.decision || thread?.objectiveText || thread?.summary,
  );
}

function isMeaningfulConversationThread(
  thread: StreetGameState["conversationThreads"][string],
) {
  return thread.lines.length > 0 || conversationThreadHasOutcome(thread);
}

function getMeaningfulConversationThreads(game: StreetGameState) {
  return Object.values(game.conversationThreads ?? {}).filter(
    isMeaningfulConversationThread,
  );
}

function rankConversationThread(
  game: StreetGameState,
  thread: StreetGameState["conversationThreads"][string],
  index: number,
) {
  const playerLocationId = game.player.currentLocationId;
  const npc = game.npcs.find((candidate) => candidate.id === thread.npcId);
  const isNearby =
    Boolean(playerLocationId) && npc?.currentLocationId === playerLocationId;
  const updatedAt = Date.parse(thread.updatedAt);

  return {
    index,
    isNearby,
    updatedAt: Number.isNaN(updatedAt) ? 0 : updatedAt,
  };
}

function countConversationWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getLatestMeaningfulConversationThread(game: StreetGameState) {
  return getMeaningfulConversationThreads(game)
    .map((thread, index) => ({
      rank: rankConversationThread(game, thread, index),
      thread,
    }))
    .sort((left, right) => {
      if (left.rank.isNearby !== right.rank.isNearby) {
        return Number(right.rank.isNearby) - Number(left.rank.isNearby);
      }

      if (left.rank.updatedAt !== right.rank.updatedAt) {
        return right.rank.updatedAt - left.rank.updatedAt;
      }

      return right.rank.index - left.rank.index;
    })[0]?.thread;
}

export function estimateConversationPlaybackMs(
  lines: StreetGameState["conversations"],
  timing: ConversationPlaybackTiming,
) {
  return lines.reduce((total, entry, index) => {
    const wordCount = Math.max(1, countConversationWords(entry.text));
    const wordDelay =
      entry.speaker === "player" ? timing.playerWord : timing.npcWord;
    const startDelay =
      index === 0
        ? timing.firstEntryPause
        : lines[index - 1]?.speaker === entry.speaker
          ? timing.sameSpeakerPause
          : timing.turnChangePause;

    return total + startDelay + timing.initialDelay + wordCount * wordDelay;
  }, timing.entrySettle);
}

export function buildObjectiveAutoContinueKey(
  game: StreetGameState | null,
): string | null {
  if (!game?.rowanAutonomy?.autoContinue) {
    return null;
  }

  return `${game.id}:${game.rowanAutonomy.key}`;
}

export function buildConversationAutostartKey(
  game: StreetGameState,
  npcId: string,
  fallbackAutonomyKey = "idle:fallback",
): string | null {
  if (!game.player.currentLocationId) {
    return null;
  }

  return `${game.id}:${game.player.currentLocationId}:${npcId}:${game.rowanAutonomy?.key ?? fallbackAutonomyKey}`;
}

export function resolveRowanRailNpcSelection({
  game,
  preserveSelectedNpc = false,
  selectedNpcId,
}: {
  game: StreetGameState;
  preserveSelectedNpc?: boolean;
  selectedNpcId: string | null;
}): string | null {
  const normalizedSelectedNpcId = hasNpc(game, selectedNpcId)
    ? selectedNpcId
    : null;

  if (hasNpc(game, game.activeConversation?.npcId)) {
    return game.activeConversation?.npcId ?? null;
  }

  if (game.rowanAutonomy?.autoContinue) {
    if (hasNpc(game, game.rowanAutonomy.npcId)) {
      return game.rowanAutonomy.npcId ?? null;
    }

    if (preserveSelectedNpc && normalizedSelectedNpcId) {
      return normalizedSelectedNpcId;
    }
  }

  if (preserveSelectedNpc && normalizedSelectedNpcId) {
    return normalizedSelectedNpcId;
  }

  const latestMeaningfulConversationThread =
    getLatestMeaningfulConversationThread(game);
  if (hasNpc(game, latestMeaningfulConversationThread?.npcId)) {
    return latestMeaningfulConversationThread?.npcId ?? null;
  }

  return normalizedSelectedNpcId;
}

export function buildResolvedConversationAutoContinueKey(
  game: StreetGameState | null,
): string | null {
  const activeConversation = game?.activeConversation;
  if (
    !game ||
    !activeConversation ||
    (!activeConversation.decision && !activeConversation.objectiveText)
  ) {
    return null;
  }

  return [
    game.id,
    activeConversation.threadId,
    activeConversation.updatedAt,
    activeConversation.npcId,
    activeConversation.objectiveText ?? "no-objective",
    activeConversation.decision ?? "no-decision",
  ].join(":");
}

export function buildCommandRailPreserveScrollKey({
  game,
  selectedNpcId,
}: {
  game: StreetGameState;
  selectedNpcId: string | null;
}): string {
  const thread = getConversationThread(game, selectedNpcId);
  const latestLineId = thread?.lines.at(-1)?.id ?? "no-lines";

  return [
    game.id,
    game.rowanAutonomy?.key ?? "no-autonomy",
    game.activeConversation?.threadId ?? "no-live-conversation",
    selectedNpcId ?? "no-selected-npc",
    thread?.updatedAt ?? "no-thread-update",
    latestLineId,
  ].join(":");
}

export function resolvePendingConversationTarget({
  autonomyNpcId,
  npcIds,
  pendingNpcId,
  pendingSource,
  selectedNpcId,
}: {
  autonomyNpcId: string | null;
  npcIds: string[];
  pendingNpcId: string | null;
  pendingSource: PendingConversationSource | null;
  selectedNpcId: string | null;
}): {
  npcId: string | null;
  source: PendingConversationSource | null;
} {
  if (autonomyNpcId && selectedNpcId === autonomyNpcId) {
    return {
      npcId: autonomyNpcId,
      source: "autonomy",
    };
  }

  if (
    !pendingNpcId ||
    !selectedNpcId ||
    pendingNpcId !== selectedNpcId ||
    !npcIds.includes(pendingNpcId)
  ) {
    return {
      npcId: null,
      source: null,
    };
  }

  if (pendingSource === "autonomy") {
    return {
      npcId: null,
      source: null,
    };
  }

  return {
    npcId: pendingNpcId,
    source: pendingSource ?? "selection",
  };
}

export function resolveConversationAutostartPlan({
  game,
  pendingNpcId,
  pendingSource,
  selectedNpcId,
}: {
  game: StreetGameState;
  pendingNpcId: string | null;
  pendingSource: PendingConversationSource | null;
  selectedNpcId: string | null;
}): ConversationAutostartPlan | null {
  if (!selectedNpcId || !game.player.currentLocationId) {
    return null;
  }

  const selectedNpc = game.npcs.find((npc) => npc.id === selectedNpcId);
  if (
    !selectedNpc ||
    selectedNpc.currentLocationId !== game.player.currentLocationId ||
    findConversationPreviewLength(game, selectedNpcId) > 0
  ) {
    return null;
  }

  const talkTargets = getTalkTargets(game.availableActions);
  const selectedTalkTarget = talkTargets.find(
    (target) => target.npcId === selectedNpcId,
  );
  if (!selectedTalkTarget) {
    return null;
  }

  const autoStartKey = buildConversationAutostartKey(game, selectedNpcId);
  if (!autoStartKey) {
    return null;
  }

  const onlyTalkActionNpcId =
    talkTargets.length === 1 ? talkTargets[0].npcId : null;
  const source =
    pendingNpcId === selectedNpcId
      ? (pendingSource ?? "selection")
      : onlyTalkActionNpcId === selectedNpcId
        ? "only-talk"
        : null;

  if (!source) {
    return null;
  }

  return {
    autoStartKey,
    npcId: selectedNpcId,
    source,
    talkActionId: selectedTalkTarget.actionId,
  };
}
