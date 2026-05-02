import { ROWAN_PLAYBACK_TIMING_MS } from "@/lib/street/rowanPlayback";
import type { StreetGameState } from "@/lib/street/types";

type ConversationSpeaker = StreetGameState["conversations"][number]["speaker"];

export function getConversationThreadState(
  game: StreetGameState,
  npcId: string,
) {
  return Object.values(game.conversationThreads ?? {}).find(
    (candidate) => candidate.npcId === npcId,
  );
}

export function getConversationPreview(game: StreetGameState, npcId: string) {
  const thread = getConversationThreadState(game, npcId);

  if (thread?.lines.length) {
    return thread.lines;
  }

  return game.conversations.filter((entry) => entry.npcId === npcId);
}

export function splitConversationStreamWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function conversationActorForSpeaker(speaker: ConversationSpeaker) {
  return speaker === "player" ? "rowan" : "npc";
}

export function findPreviousConversationSpeaker(
  entries: StreetGameState["conversations"],
  entryId: string,
) {
  const nextIndex = entries.findIndex((entry) => entry.id === entryId);
  if (nextIndex <= 0) {
    return undefined;
  }

  return entries[nextIndex - 1]?.speaker;
}

export function conversationEntryStartDelayMs(
  previousSpeaker: ConversationSpeaker | undefined,
  nextSpeaker: ConversationSpeaker | undefined,
) {
  if (!nextSpeaker) {
    return 0;
  }

  if (!previousSpeaker) {
    return ROWAN_PLAYBACK_TIMING_MS.firstEntryPause;
  }

  if (previousSpeaker === nextSpeaker) {
    return ROWAN_PLAYBACK_TIMING_MS.sameSpeakerPause;
  }

  return ROWAN_PLAYBACK_TIMING_MS.turnChangePause;
}

export function conversationWordDelayMs(speaker: ConversationSpeaker) {
  return speaker === "player"
    ? ROWAN_PLAYBACK_TIMING_MS.playerWord
    : ROWAN_PLAYBACK_TIMING_MS.npcWord;
}

export function conversationStreamDelayMs(
  speaker: ConversationSpeaker,
  visibleWordCount: number,
) {
  const baseDelay = conversationWordDelayMs(speaker);

  if (visibleWordCount <= 1) {
    return ROWAN_PLAYBACK_TIMING_MS.initialDelay + baseDelay;
  }

  return baseDelay;
}

export function buildConversationReplaySignature(
  activeConversation: NonNullable<StreetGameState["activeConversation"]>,
) {
  const lineIds = activeConversation.lines.map((entry) => entry.id).join("|");
  return `${activeConversation.threadId}:${lineIds}`;
}
