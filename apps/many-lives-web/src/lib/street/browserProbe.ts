import type {
  RowanPlaybackState,
  RowanRailViewModel,
} from "./rowanPlayback";
import type { StreetGameState } from "./types";

export type StreetBrowserProbeSnapshot = {
  optimisticPlayerPosition?: {
    x: number;
    y: number;
  };
  rowanPlayback?: Pick<
    RowanPlaybackState,
    "activeBeat" | "lastCompletedBeat" | "queuedBeats"
  >;
};

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
    autonomy: {
      autoContinue: game.rowanAutonomy.autoContinue,
      key: game.rowanAutonomy.key,
      label: game.rowanAutonomy.label,
      mode: game.rowanAutonomy.mode,
      stepKind: game.rowanAutonomy.stepKind,
      targetLocationId: game.rowanAutonomy.targetLocationId ?? null,
    },
    clock: {
      iso: game.currentTime,
      label: game.clock.label,
      totalMinutes: game.clock.totalMinutes,
    },
    gameId: game.id,
    location: {
      id: game.player.currentLocationId ?? null,
      name: currentLocation?.name ?? game.currentScene.title,
      x: game.player.x,
      y: game.player.y,
    },
    objective: {
      routeKey: game.player.objective?.routeKey ?? null,
      text: game.player.objective?.text ?? null,
    },
    visualPlayer: {
      isMovingToServerState: Boolean(snapshot.optimisticPlayerPosition),
      targetX: snapshot.optimisticPlayerPosition?.x ?? game.player.x,
      targetY: snapshot.optimisticPlayerPosition?.y ?? game.player.y,
    },
    playback: {
      activeKind: snapshot.rowanPlayback?.activeBeat?.kind ?? null,
      activeTitle: snapshot.rowanPlayback?.activeBeat?.title ?? null,
      justHappened: snapshot.rowanPlayback?.lastCompletedBeat?.title ?? null,
      queuedCount: snapshot.rowanPlayback?.queuedBeats.length ?? 0,
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
