"use client";

import type PhaserType from "phaser";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  actInStreetGame,
  advanceStreetObjective,
  createStreetGame,
  loadStreetGame,
  moveStreetPlayer,
  waitInStreetGame,
} from "@/lib/street/api";
import { useSearchParams } from "next/navigation";
import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import {
  buildJournalTabHtml,
  buildLoadingHtml,
  buildMindTabHtml,
  buildNarrativePreview,
  buildRowanStoryCardHtml,
  buildTabButton,
  escapeHtml,
  feedToneLabel,
  formatNameList,
  joinNarrativeFragments,
} from "@/components/street/streetOverlayHtml";
import {
  buildConversationPanelHtml,
  buildPeopleTabHtml,
} from "@/components/street/streetConversationHtml";
import {
  characterAppearanceForNpc,
  createCharacterAvatar,
  playerCharacterAppearance,
  poseCharacterRig,
  type CharacterAppearance,
  type CharacterRig,
} from "@/components/street/streetCharacters";
import { drawBackdrop } from "@/components/street/streetBackdrop";
import {
  drawFootprints,
  drawFringeBlocks,
  drawFringeProps,
  drawKenneyFacadeSprites,
  drawKenneyLandmarkOverlays,
} from "@/components/street/streetArchitecture";
import {
  collectAnimatedSurfaceTiles,
  drawFringeTiles,
  drawTiles,
} from "@/components/street/streetTiles";
import {
  KENNEY_MODERN_CITY_KEY,
  drawKenneyPropSprites,
  drawKenneyTerrainSprites,
} from "@/components/street/streetKenneySprites";
import { drawLocationLabels } from "@/components/street/streetLabels";
import { drawDoors, drawProps } from "@/components/street/streetProps";
import {
  drawAnimatedSkyWeather,
  drawAnimatedVisualWater,
  renderAuthoredVisualScene,
  visualSceneTextureKey,
} from "@/components/street/streetVisualSceneRenderer";
import {
  buildMemoryThreads,
  buildObjectiveCompletionRows,
  buildObjectivePlanRows,
  buildObjectiveSuggestions,
} from "@/lib/street/journalModel";
import { npcPersonalityProfile } from "@/lib/street/npcPersonality";
import { blendColor } from "@/lib/street/renderColor";
import {
  buildConversationReplaySignature,
  conversationActorForSpeaker,
  conversationEntryStartDelayMs,
  conversationStreamDelayMs,
  findPreviousConversationSpeaker,
  getConversationPreview,
  getConversationThreadState,
  splitConversationStreamWords,
} from "@/lib/street/conversationModel";
import {
  buildCommandRailPreserveScrollKey,
  buildResolvedConversationAutoContinueKey,
  buildObjectiveAutoContinueKey,
  conversationThreadHasOutcome,
  getLatestMeaningfulConversationThread,
  resolveConversationAutostartPlan,
  resolvePendingConversationTarget,
  resolveRowanRailNpcSelection,
  type PendingConversationSource,
} from "@/lib/street/rowanAutonomy";
import {
  buildStreetBrowserProbeJson,
} from "@/lib/street/browserProbe";
import { buildStreetOverlayStyle } from "@/lib/street/streetOverlayStyles";
import {
  buildNpcPatrolPath,
  createRouteFinder,
  dedupePointSequence,
  distanceBetween,
  findNearestWalkablePointByWorldHint,
  loopPathDistance,
  pathDistance,
  patrolCycleSeconds,
  perpendicularNormal,
  PLAYER_ENTRANCE_TILE_KINDS,
  PUBLIC_TRAVEL_TILE_KINDS,
  routeReachesDestination,
  sampleLoopPath,
  samplePathPoint,
  type Point,
  type RouteFinder,
  type WalkableRuntimePoint,
} from "@/lib/street/navigation";
import {
  captureOverlayRenderState,
  isOverlayEventTarget,
  isOverlayTextInputFocused,
  restoreOverlayRenderState,
} from "@/lib/street/overlayDomState";
import {
  alignRowanPlaybackWithGame,
  appendRowanPlaybackBeats,
  buildRowanRailViewModel,
  completeActiveRowanPlaybackBeat,
  createEmptyRowanPlaybackState,
  deriveRowanPlaybackBeats,
  estimateLiveConversationBeatMs,
  isBlockingRowanPlayback,
  ROWAN_PLAYBACK_TIMING_MS,
  startNextRowanPlaybackBeat,
  type RecentBeat,
  type RowanPlaybackState,
} from "@/lib/street/rowanPlayback";
import {
  CAMERA_USER_ZOOM_DEFAULT,
  getOverlayLayoutMetrics,
  getRuntimeRenderScale,
  getScaledViewportSize,
  getSceneViewport,
  isCollapsibleRailViewport,
  isCompactViewport,
  isPhoneRailViewport,
  type SceneViewport,
  type ViewportSize,
} from "@/lib/street/runtimeViewport";
import {
  CAMERA_WHEEL_ZOOM_STEP,
  adjustCameraPan,
  adjustCameraZoom,
  beginCameraGesture,
  finishCameraGesture,
  getTargetSceneZoom,
  isPointerWithinSceneViewport,
  updateCamera,
  updateCameraGesture,
  type CameraEdgeName,
  type CameraEdgeState,
  type CameraGestureState,
} from "@/lib/street/runtimeCamera";
import {
  CELL,
  KENNEY_TILE,
  getMapWorldOrigin,
  getWorldBoundsForRuntime,
  mapPointToWorld,
  mapTileToWorldCenter,
  mapTileToWorldOrigin,
  projectRuntimePoint,
  projectRuntimeTileCenter,
} from "@/lib/street/runtimeGeometry";
import type {
  ConversationEntry,
  LocationState,
  MapDoor,
  MapFootprint,
  MapProp,
  MapTile,
  NpcState,
  StreetGameState,
} from "@/lib/street/types";
import {
  getVisualScene,
  getVisualSceneDocument,
  getVisualSceneRuntimeRevision,
  projectVisualScenePoint,
  validateVisualSceneAgainstGame,
  VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT,
  type VisualRect,
  type VisualScene,
} from "@/lib/street/visualScenes";

const MOVEMENT_FLUSH_DELAY_MS = 45;
const BOUND_GAME_REFRESH_MS = 900;
const CAMERA_EDGE_CUE_DURATION_MS = 520;
const CAMERA_EDGE_CUE_NAMES: CameraEdgeName[] = [
  "north",
  "east",
  "south",
  "west",
];
const CAMERA_WHEEL_PAN_MAX_DELTA = 150;
const CAMERA_WHEEL_PAN_SENSITIVITY = 0.92;
const DEFAULT_PLAYER_MOVE_MS_PER_TILE = 320;
const PLAYER_MAX_MOVE_DURATION_MS = 4800;
const PLAYER_MOVE_DURATION_MULTIPLIER = 0.72;
const STREET_GAME_SESSION_STORAGE_KEY = "many-lives:street-game-id";
const STREET_SIM_BASE_DAY = "2026-03-21T00:00:00.000Z";
const AUTONOMY_BEAT_DELAY_MS = {
  acting: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
  conversation: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
  moving: ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
  waiting: 780,
} as const;
const FALLBACK_ROWAN_AUTONOMY: StreetGameState["rowanAutonomy"] = {
  autoContinue: false,
  detail: "Choose where Rowan should go or what he should do next.",
  key: "idle:fallback",
  label: "Choose a direction",
  layer: "idle",
  mode: "idle",
  stepKind: "idle",
};
function autoContinueDelayMsForBeat(game: StreetGameState) {
  const autonomy = game.rowanAutonomy ?? FALLBACK_ROWAN_AUTONOMY;
  const baseDelay =
    autonomy.mode === "conversation"
      ? AUTONOMY_BEAT_DELAY_MS.conversation
      : autonomy.mode === "waiting"
        ? AUTONOMY_BEAT_DELAY_MS.waiting
        : autonomy.mode === "moving"
          ? AUTONOMY_BEAT_DELAY_MS.moving
          : AUTONOMY_BEAT_DELAY_MS.acting;

  if (
    autonomy.layer !== "conversation" ||
    !game.activeConversation?.lines.length
  ) {
    return baseDelay;
  }

  // Keep Rowan's next step behind the human-visible transcript, not just the sim state.
  return Math.max(
    baseDelay,
    estimateLiveConversationBeatMs(game),
  );
}

function buildGameSyncKey(game: StreetGameState) {
  return [
    game.id,
    game.currentTime,
    game.player.x,
    game.player.y,
    game.player.currentLocationId ?? "",
    game.player.money,
    game.player.energy,
    game.player.objective?.routeKey ?? "",
    game.player.objective?.text ?? "",
    game.player.objective?.progress?.label ?? "",
    game.rowanAutonomy.key,
    game.rowanAutonomy.label,
    game.rowanAutonomy.mode,
    game.rowanAutonomy.stepKind,
    game.rowanAutonomy.targetLocationId ?? "",
    game.activeConversation?.threadId ?? "",
    game.activeConversation?.updatedAt ?? "",
    game.activeConversation?.decision ?? "",
    game.activeConversation?.objectiveText ?? "",
    game.activeConversation?.lines.length ?? 0,
    ...game.jobs.map((job) =>
      [
        job.id,
        job.accepted ? "1" : "0",
        job.completed ? "1" : "0",
        job.missed ? "1" : "0",
      ].join(":"),
    ),
  ].join("|");
}

function shouldDeferPlayerPositionUpdate(
  previousGame: StreetGameState,
  nextGame: StreetGameState,
  optimisticPlayerPosition: Point | null,
) {
  if (previousGame.id !== nextGame.id || optimisticPlayerPosition) {
    return false;
  }

  return (
    previousGame.player.x !== nextGame.player.x ||
    previousGame.player.y !== nextGame.player.y
  );
}

function estimateDeferredPlayerMoveMs(
  previousGame: StreetGameState,
  nextGame: StreetGameState,
  route?: Point[] | null,
) {
  const routeDistance =
    route && routeReachesDestination(route, nextGame.player)
      ? pathDistance(route)
      : distanceBetween(previousGame.player, nextGame.player);

  return clamp(
    Math.max(routeDistance, 1) * 360,
    ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
    PLAYER_MAX_MOVE_DURATION_MS,
  );
}

function bindGameToCurrentUrl(gameId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  if (nextUrl.searchParams.get("gameId") === gameId) {
    return;
  }

  nextUrl.searchParams.set("gameId", gameId);
  window.history.replaceState(null, "", nextUrl.toString());
}

function hideGameIdFromCurrentUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  if (!nextUrl.searchParams.has("gameId")) {
    return;
  }

  nextUrl.searchParams.delete("gameId");
  window.history.replaceState(null, "", nextUrl.toString());
}

function readStoredStreetGameId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedGameId = window.localStorage
      .getItem(STREET_GAME_SESSION_STORAGE_KEY)
      ?.trim();
    return storedGameId || null;
  } catch {
    return null;
  }
}

function rememberStreetGameId(gameId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STREET_GAME_SESSION_STORAGE_KEY, gameId);
  } catch {
    // URL-bound games still work when local storage is unavailable.
  }
}

function forgetStoredStreetGameId(gameId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.localStorage.getItem(STREET_GAME_SESSION_STORAGE_KEY) === gameId) {
      window.localStorage.removeItem(STREET_GAME_SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; the app can always create a fresh local run.
  }
}

function isMissingStreetGameError(error: unknown) {
  return (
    error instanceof Error &&
    /game\s+[^"]+\s+was not found/i.test(error.message)
  );
}

type StreetAppSnapshot = {
  animatePlayerEntrance: boolean;
  busyLabel: string | null;
  error: string | null;
  game: StreetGameState | null;
  loadingLabel: string;
  optimisticPlayerPosition?: Point;
  optimisticPlayerLocationId?: string | null;
  optimisticPlayerConversationLocationId?: string | null;
  optimisticPlayerMoveDurationMs?: number;
  recentBeat?: RecentBeat;
  rowanPlayback?: RowanPlaybackState;
  rowanAutoplayEnabled: boolean;
  waypointNonce: number;
  waypointTarget?: Point;
  visualSceneRefreshNonce: number;
  viewport: ViewportSize;
};

type MoveToOptions = {
  showWaypoint?: boolean;
};

type AdvanceObjectiveOptions = {
  confirmedByUser?: boolean;
};

type PhaserStreetExperienceProps = {
  onAction: (actionId: string, label: string) => void;
  onAdvanceObjective: (options?: AdvanceObjectiveOptions) => void;
  onAdvanceTime: (minutes: number, label: string) => void;
  onMoveBy: (deltaX: number, deltaY: number) => void;
  onMoveTo: (x: number, y: number, options?: MoveToOptions) => boolean;
  onReload: () => void;
  snapshot: StreetAppSnapshot;
};

type RuntimeCallbacks = Pick<
  PhaserStreetExperienceProps,
  | "onAction"
  | "onAdvanceObjective"
  | "onAdvanceTime"
  | "onMoveBy"
  | "onMoveTo"
  | "onReload"
>;

type PlayerMotionState = {
  durationMs: number;
  path: Point[];
  startedAt: number;
  to: Point;
  worldPath?: Point[];
};

type PendingVisualGameUpdate = {
  game: StreetGameState;
  syncKey: string;
  timerId: number;
};

type RuntimeIndices = {
  animatedSurfaceTiles: Array<Pick<MapTile, "kind" | "x" | "y">>;
  footprintByLocationId: Map<string, MapFootprint>;
  locationsById: Map<string, LocationState>;
  patrolDistanceByKey: Map<string, number>;
  patrolPathByKey: Map<string, Point[]>;
  primaryDoorByLocation: Map<string, MapDoor>;
  propsByLocation: Map<string, MapProp[]>;
  routeFinder: RouteFinder;
  visualScene: VisualScene | null;
  walkableRuntimePoints: WalkableRuntimePoint[];
};

type AnimatedNpcState = {
  facing: 1 | -1;
  isYielding?: boolean;
  known: boolean;
  npc: NpcState;
  step: number;
  x: number;
  y: number;
};

type NpcMarkerObjects = {
  appearance: CharacterAppearance;
  container: PhaserType.GameObjects.Container;
  label: PhaserType.GameObjects.Text;
  rig: CharacterRig;
};

type RuntimeObjects = {
  ambientLayer: PhaserType.GameObjects.Graphics;
  assetStructureNodes: PhaserType.GameObjects.GameObject[];
  assetTerrainNodes: PhaserType.GameObjects.GameObject[];
  mapLabels: PhaserType.GameObjects.GameObject[];
  npcMarkers: Map<string, NpcMarkerObjects>;
  overlayDom: HTMLDivElement;
  overlayLayer: PhaserType.GameObjects.Graphics;
  playerBeacon: PhaserType.GameObjects.Arc;
  playerBeaconTail: PhaserType.GameObjects.Rectangle;
  playerContainer: PhaserType.GameObjects.Container;
  playerAppearance: CharacterAppearance;
  playerName: PhaserType.GameObjects.Text;
  playerPulse: PhaserType.GameObjects.Arc;
  playerReticle: PhaserType.GameObjects.Ellipse;
  playerRig: CharacterRig;
  playerTitle: PhaserType.GameObjects.Text;
  scene: PhaserType.Scene;
  structureDetailLayer: PhaserType.GameObjects.Graphics;
  structureLayer: PhaserType.GameObjects.Graphics;
  terrainLayer: PhaserType.GameObjects.Graphics;
};

type FocusPanel = "journal" | "mind" | "people";

type UiState = {
  activeTab: "actions" | "journal" | "mind" | "people";
  focusPanel: FocusPanel | null;
  pendingConversationNpcId: string | null;
  pendingConversationSource: PendingConversationSource | null;
  railExpanded: boolean;
  selectedNpcId: string | null;
  supportExpanded: boolean;
};

type ClockAdvanceOption = {
  key: string;
  minutes: number;
  label: string;
  busyLabel: string;
  kind: "increment" | "target";
};

type ConversationReplayState = {
  activeNpcId: string | null;
  appliedSignature: string | null;
  isReplaying: boolean;
  revealedEntryIds: string[];
  streamPauseActor: "npc" | "rowan" | null;
  streamQueue: string[];
  streamedWordCount: number;
  streamingEntryId: string | null;
  timerId: number | null;
};

type RuntimeState = {
  autoStartedConversationKey: string | null;
  cameraEdgeCue: Record<CameraEdgeName, number>;
  cameraGesture: CameraGestureState | null;
  cameraOffset: Point;
  cameraZoomFactor: number;
  conversationAutostartTimerId: number | null;
  conversationReplay: ConversationReplayState;
  indices: RuntimeIndices;
  lastCameraInteractionAt: number;
  mapKey: string;
  objects: RuntimeObjects | null;
  pendingConversationAutostartNpcId: string | null;
  playerEntranceGameId: string | null;
  playerMotion: PlayerMotionState;
  renderScale: number;
  snapshot: StreetAppSnapshot;
  ui: UiState;
  waypointAppliedNonce: number;
  waypointPlacedAt: number;
  waypointTarget: Point | null;
};

type RuntimeHandle = {
  destroy: () => void;
  updateSnapshot: (snapshot: StreetAppSnapshot) => void;
};

export function PhaserStreetGameApp() {
  const searchParams = useSearchParams();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewport = useViewportSize(hostRef);
  const [game, setGame] = useState<StreetGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [rowanPlayback, setRowanPlayback] = useState<RowanPlaybackState>(
    createEmptyRowanPlaybackState(),
  );
  const [sceneOverrideVersion, setSceneOverrideVersion] = useState(0);
  const [optimisticPlayerPosition, setOptimisticPlayerPosition] =
    useState<Point | null>(null);
  const [optimisticPlayerLocationId, setOptimisticPlayerLocationId] =
    useState<string | null>(null);
  const [
    optimisticPlayerConversationLocationId,
    setOptimisticPlayerConversationLocationId,
  ] = useState<string | null>(null);
  const [optimisticPlayerMoveDurationMs, setOptimisticPlayerMoveDurationMs] =
    useState<number | null>(null);
  const [waypointNonce, setWaypointNonce] = useState(0);
  const [waypointTarget, setWaypointTarget] = useState<Point | null>(null);
  const gameRef = useRef<StreetGameState | null>(null);
  const optimisticPlayerRef = useRef<Point | null>(null);
  const objectiveAutoContinueTimerRef = useRef<number | null>(null);
  const waypointTargetRef = useRef<Point | null>(null);
  const movementTargetRef = useRef<Point | null>(null);
  const movementFlushTimerRef = useRef<number | null>(null);
  const pendingVisualGameUpdateRef = useRef<PendingVisualGameUpdate | null>(
    null,
  );
  const lastObjectiveAutoContinueKeyRef = useRef<string | null>(null);
  const routeFinderRef = useRef<((start: Point, end: Point) => Point[]) | null>(
    null,
  );
  const routeFinderMapKeyRef = useRef("");
  const isMovementInFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const lastAppliedRequestRef = useRef(0);
  const busyLabelRef = useRef<string | null>(null);
  const boundGameRefreshTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const rowanPlaybackRef = useRef<RowanPlaybackState>(rowanPlayback);
  const requestedGameId = useMemo(() => {
    const rawGameId = searchParams.get("gameId");
    const normalizedGameId = rawGameId?.trim();
    return normalizedGameId ? normalizedGameId : null;
  }, [searchParams]);
  const rowanAutoplayEnabled = useMemo(() => {
    const autoplayValue = searchParams.get("autoplay")?.trim().toLowerCase();
    return (
      autoplayValue === "1" ||
      autoplayValue === "true" ||
      autoplayValue === "yes" ||
      autoplayValue === "on"
    );
  }, [searchParams]);
  const boundGameObserverEnabled = useMemo(() => {
    const observeValue = searchParams.get("observe")?.trim().toLowerCase();
    return (
      observeValue === "1" ||
      observeValue === "true" ||
      observeValue === "yes" ||
      observeValue === "on"
    );
  }, [searchParams]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    optimisticPlayerRef.current = optimisticPlayerPosition;
  }, [optimisticPlayerPosition]);

  useEffect(() => {
    waypointTargetRef.current = waypointTarget;
  }, [waypointTarget]);

  useEffect(() => {
    busyLabelRef.current = busyLabel;
  }, [busyLabel]);

  useEffect(() => {
    rowanPlaybackRef.current = rowanPlayback;
  }, [rowanPlayback]);

  const publishWaypoint = useCallback((target: Point | null) => {
    setWaypointTarget(target);
    setWaypointNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!game) {
      routeFinderRef.current = null;
      routeFinderMapKeyRef.current = "";
      return;
    }

    const mapKey = createMapKey(game);
    if (routeFinderMapKeyRef.current === mapKey && routeFinderRef.current) {
      return;
    }

    routeFinderMapKeyRef.current = mapKey;
    routeFinderRef.current = createRouteFinder(
      buildNavigationTiles(game, getPlayableVisualScene(game)),
    );
  }, [game]);

  const nextRequestId = useCallback(() => {
    requestSequenceRef.current += 1;
    return requestSequenceRef.current;
  }, []);

  const clearPendingVisualGameUpdate = useCallback(() => {
    const pending = pendingVisualGameUpdateRef.current;
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timerId);
    pendingVisualGameUpdateRef.current = null;
  }, []);

  const applyGameUpdate = useCallback(
    (nextGame: StreetGameState, requestId?: number) => {
      if (
        requestId !== undefined &&
        requestId < lastAppliedRequestRef.current
      ) {
        return false;
      }

      if (requestId !== undefined) {
        lastAppliedRequestRef.current = requestId;
      }

      const previousGame = gameRef.current;
      const nextSyncKey = buildGameSyncKey(nextGame);
      const pendingVisualGameUpdate = pendingVisualGameUpdateRef.current;
      if (
        pendingVisualGameUpdate &&
        pendingVisualGameUpdate.game.id === nextGame.id &&
        pendingVisualGameUpdate.syncKey === nextSyncKey
      ) {
        return true;
      }

      if (
        previousGame &&
        previousGame.id === nextGame.id &&
        buildGameSyncKey(previousGame) === nextSyncKey
      ) {
        return true;
      }

      if (pendingVisualGameUpdate) {
        clearPendingVisualGameUpdate();
        setOptimisticPlayerPosition(null);
        setOptimisticPlayerLocationId(null);
        setOptimisticPlayerConversationLocationId(null);
        setOptimisticPlayerMoveDurationMs(null);
        publishWaypoint(null);
      }

      const nextPlaybackBeats =
        previousGame && previousGame.id === nextGame.id
          ? deriveRowanPlaybackBeats(previousGame, nextGame)
          : [];

      if (
        previousGame &&
        shouldDeferPlayerPositionUpdate(
          previousGame,
          nextGame,
          optimisticPlayerRef.current,
        )
      ) {
        const visualTarget = {
          x: nextGame.player.x,
          y: nextGame.player.y,
        };
        const visualRoute = routeFinderRef.current?.(
          previousGame.player,
          visualTarget,
        );
        const transitionMs = estimateDeferredPlayerMoveMs(
          previousGame,
          nextGame,
          visualRoute,
        );
        const deferredPlaybackBeats = nextPlaybackBeats.map((beat) =>
          beat.kind === "move" ? { ...beat, durationMs: transitionMs } : beat,
        );

        setOptimisticPlayerPosition(visualTarget);
        setOptimisticPlayerLocationId(nextGame.player.currentLocationId ?? null);
        setOptimisticPlayerConversationLocationId(
          nextGame.activeConversation?.locationId ?? null,
        );
        setOptimisticPlayerMoveDurationMs(transitionMs);
        if (!waypointTargetRef.current) {
          publishWaypoint(visualTarget);
        }
        startTransition(() => {
          setRowanPlayback((current) =>
            appendRowanPlaybackBeats(current, deferredPlaybackBeats),
          );
        });

        pendingVisualGameUpdateRef.current = {
          game: nextGame,
          syncKey: nextSyncKey,
          timerId: window.setTimeout(() => {
            const pending = pendingVisualGameUpdateRef.current;
            if (!pending || pending.syncKey !== nextSyncKey) {
              return;
            }

            pendingVisualGameUpdateRef.current = null;
            gameRef.current = nextGame;
            startTransition(() => {
              setGame(nextGame);
              setOptimisticPlayerPosition(null);
              setOptimisticPlayerLocationId(null);
              setOptimisticPlayerConversationLocationId(null);
              setOptimisticPlayerMoveDurationMs(null);
              publishWaypoint(null);
              setRowanPlayback((current) =>
                alignRowanPlaybackWithGame(current, nextGame),
              );
            });
          }, transitionMs),
        };

        return true;
      }

      gameRef.current = nextGame;
      startTransition(() => {
        setGame(nextGame);
        setRowanPlayback((current) =>
          appendRowanPlaybackBeats(
            alignRowanPlaybackWithGame(current, nextGame),
            nextPlaybackBeats,
          ),
        );
      });

      return true;
    },
    [clearPendingVisualGameUpdate, publishWaypoint],
  );

  const loadGame = useCallback(async () => {
    const requestId = nextRequestId();
    const storedGameId = requestedGameId ? null : readStoredStreetGameId();
    const gameIdToOpen = requestedGameId ?? storedGameId;
    setError(null);
    setBusyLabel(
      gameIdToOpen ? "Opening your game..." : "Opening the district...",
    );

    try {
      const nextGame = gameIdToOpen
        ? await loadStreetGame(gameIdToOpen).catch(async (loadError) => {
            if (!isMissingStreetGameError(loadError)) {
              throw loadError;
            }

            if (storedGameId) {
              forgetStoredStreetGameId(storedGameId);
            }
            return createStreetGame();
          })
        : await createStreetGame();
      rememberStreetGameId(nextGame.id);
      if (requestedGameId && nextGame.id !== requestedGameId) {
        bindGameToCurrentUrl(nextGame.id);
      } else if (
        requestedGameId &&
        !boundGameObserverEnabled &&
        !rowanAutoplayEnabled
      ) {
        hideGameIdFromCurrentUrl();
      }
      setOptimisticPlayerPosition(null);
      setOptimisticPlayerLocationId(null);
      setOptimisticPlayerConversationLocationId(null);
      setOptimisticPlayerMoveDurationMs(null);
      setRowanPlayback(createEmptyRowanPlaybackState());
      publishWaypoint(null);
      applyGameUpdate(nextGame, requestId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : gameIdToOpen
            ? "Could not open your saved game."
            : "Could not open the district.",
      );
    } finally {
      setBusyLabel(null);
    }
  }, [
    applyGameUpdate,
    boundGameObserverEnabled,
    nextRequestId,
    publishWaypoint,
    requestedGameId,
    rowanAutoplayEnabled,
  ]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!requestedGameId || !boundGameObserverEnabled) {
      if (boundGameRefreshTimerRef.current) {
        window.clearTimeout(boundGameRefreshTimerRef.current);
        boundGameRefreshTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const queueRefresh = () => {
      if (cancelled) {
        return;
      }

      boundGameRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          if (!busyLabelRef.current) {
            const requestId = nextRequestId();
            const refreshedGame = await loadStreetGame(requestedGameId);
            if (!cancelled) {
              applyGameUpdate(refreshedGame, requestId);
            }
          }
        } catch {
          // Keep polling bound games quietly; the visible health checks cover stack failures.
        } finally {
          queueRefresh();
        }
      }, BOUND_GAME_REFRESH_MS);
    };

    queueRefresh();

    return () => {
      cancelled = true;
      if (boundGameRefreshTimerRef.current) {
        window.clearTimeout(boundGameRefreshTimerRef.current);
        boundGameRefreshTimerRef.current = null;
      }
    };
  }, [applyGameUpdate, boundGameObserverEnabled, nextRequestId, requestedGameId]);

  const runWithBusy = useCallback(
    async (label: string, callback: () => Promise<void>) => {
      setError(null);
      setBusyLabel(label);

      try {
        await callback();
      } catch (runError) {
        setError(
          runError instanceof Error
            ? runError.message
            : "Something in the district failed to update.",
        );
      } finally {
        setBusyLabel(null);
      }
    },
    [],
  );

  const flushMovementQueue = useCallback(async () => {
    if (isMovementInFlightRef.current) {
      return;
    }

    const activeGame = gameRef.current;
    const target = movementTargetRef.current;
    if (!activeGame || !target) {
      return;
    }

    movementTargetRef.current = null;
    isMovementInFlightRef.current = true;
    const requestId = nextRequestId();

    try {
      const nextGame = await moveStreetPlayer(
        activeGame.id,
        target.x,
        target.y,
      );
      applyGameUpdate(nextGame, requestId);

      if (!movementTargetRef.current) {
        setOptimisticPlayerPosition(null);
        setOptimisticPlayerLocationId(null);
        setOptimisticPlayerConversationLocationId(null);
        setOptimisticPlayerMoveDurationMs(null);
      }
    } catch (moveError) {
      movementTargetRef.current = null;
      setOptimisticPlayerPosition(null);
      setOptimisticPlayerLocationId(null);
      setOptimisticPlayerConversationLocationId(null);
      setOptimisticPlayerMoveDurationMs(null);
      publishWaypoint(null);
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Rowan couldn't complete that move.",
      );
    } finally {
      isMovementInFlightRef.current = false;

      if (movementTargetRef.current) {
        void flushMovementQueue();
      }
    }
  }, [applyGameUpdate, nextRequestId, publishWaypoint]);

  const scheduleMovementFlush = useCallback(() => {
    if (movementFlushTimerRef.current) {
      window.clearTimeout(movementFlushTimerRef.current);
    }

    movementFlushTimerRef.current = window.setTimeout(() => {
      movementFlushTimerRef.current = null;
      void flushMovementQueue();
    }, MOVEMENT_FLUSH_DELAY_MS);
  }, [flushMovementQueue]);

  const handleMoveTo = useCallback(
    (x: number, y: number, options?: MoveToOptions) => {
      const activeGame = gameRef.current;
      if (
        !activeGame ||
        busyLabelRef.current ||
        pendingVisualGameUpdateRef.current ||
        isBlockingRowanPlayback(rowanPlaybackRef.current)
      ) {
        return false;
      }

      const visualScene = getPlayableVisualScene(activeGame);
      const nextTile = findWalkableTile(
        activeGame,
        clamp(x, 0, activeGame.map.width - 1),
        clamp(y, 0, activeGame.map.height - 1),
        visualScene,
      );

      if (!nextTile) {
        return false;
      }

      const currentVisualPosition = optimisticPlayerRef.current ?? {
        x: activeGame.player.x,
        y: activeGame.player.y,
      };
      const mapKey = createMapKey(activeGame);
      if (routeFinderMapKeyRef.current !== mapKey || !routeFinderRef.current) {
        routeFinderMapKeyRef.current = mapKey;
        routeFinderRef.current = createRouteFinder(
          buildNavigationTiles(activeGame, visualScene),
        );
      }
      const candidateRoute = routeFinderRef.current(
        currentVisualPosition,
        nextTile,
      );

      if (!routeReachesDestination(candidateRoute, nextTile)) {
        setError("Rowan cannot find a clean route there.");
        return false;
      }

      if (
        currentVisualPosition.x === nextTile.x &&
        currentVisualPosition.y === nextTile.y
      ) {
        return false;
      }

      setError(null);
      setOptimisticPlayerPosition({
        x: nextTile.x,
        y: nextTile.y,
      });
      if (options?.showWaypoint) {
        publishWaypoint({ x: nextTile.x, y: nextTile.y });
      } else if (waypointTargetRef.current) {
        publishWaypoint(null);
      }
      movementTargetRef.current = {
        x: nextTile.x,
        y: nextTile.y,
      };
      scheduleMovementFlush();
      return true;
    },
    [publishWaypoint, scheduleMovementFlush],
  );

  const handleMoveBy = useCallback(
    (deltaX: number, deltaY: number) => {
      const activeGame = gameRef.current;
      if (!activeGame || busyLabelRef.current) {
        return;
      }

      const origin = optimisticPlayerRef.current ?? {
        x: activeGame.player.x,
        y: activeGame.player.y,
      };

      handleMoveTo(origin.x + deltaX, origin.y + deltaY);
    },
    [handleMoveTo],
  );

  const handleAction = useCallback(
    async (actionId: string, label: string) => {
      const activeGame = gameRef.current;
      if (!activeGame) {
        return;
      }

      await runWithBusy(`${label}...`, async () => {
        const requestId = nextRequestId();
        const nextGame = await actInStreetGame(activeGame.id, actionId);
        applyGameUpdate(nextGame, requestId);
      });
    },
    [applyGameUpdate, nextRequestId, runWithBusy],
  );

  const handleAdvanceTime = useCallback(
    async (minutes: number, label: string) => {
      const activeGame = gameRef.current;
      if (!activeGame || busyLabelRef.current || minutes <= 0) {
        return;
      }

      await runWithBusy(label, async () => {
        const requestId = nextRequestId();
        const nextGame = await waitInStreetGame(activeGame.id, minutes);
        applyGameUpdate(nextGame, requestId);
      });
    },
    [applyGameUpdate, nextRequestId, runWithBusy],
  );

  const handleAdvanceObjective = useCallback(async (
    options: AdvanceObjectiveOptions = {},
  ) => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current) {
      return;
    }

    const rowanAutonomy =
      activeGame.rowanAutonomy ?? FALLBACK_ROWAN_AUTONOMY;
    const busyCopy = rowanAutonomy.autoContinue
      ? `Following Rowan: ${rowanAutonomy.label}...`
      : "Continuing Rowan's plan...";

    await runWithBusy(busyCopy, async () => {
      const requestId = nextRequestId();
      const nextGame = await advanceStreetObjective(activeGame.id, {
        allowTimeSkip: true,
        confirmMove: options.confirmedByUser ?? false,
      });
      applyGameUpdate(nextGame, requestId);
    });
  }, [applyGameUpdate, nextRequestId, runWithBusy]);

  useEffect(() => {
    return () => {
      if (objectiveAutoContinueTimerRef.current) {
        window.clearTimeout(objectiveAutoContinueTimerRef.current);
      }
      if (movementFlushTimerRef.current) {
        window.clearTimeout(movementFlushTimerRef.current);
      }
      clearPendingVisualGameUpdate();
      if (boundGameRefreshTimerRef.current) {
        window.clearTimeout(boundGameRefreshTimerRef.current);
      }
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
      }
    };
  }, [clearPendingVisualGameUpdate]);

  useEffect(() => {
    if (rowanPlayback.activeBeat || rowanPlayback.queuedBeats.length === 0) {
      return;
    }

    setRowanPlayback((current) => startNextRowanPlaybackBeat(current));
  }, [rowanPlayback.activeBeat, rowanPlayback.queuedBeats]);

  useEffect(() => {
    const activeBeat = rowanPlayback.activeBeat;

    if (playbackTimerRef.current) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!activeBeat) {
      return;
    }

    playbackTimerRef.current = window.setTimeout(() => {
      setRowanPlayback((current) => completeActiveRowanPlaybackBeat(current));
    }, activeBeat.durationMs);

    return () => {
      if (playbackTimerRef.current) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [rowanPlayback.activeBeat]);

  useEffect(() => {
    if (objectiveAutoContinueTimerRef.current) {
      window.clearTimeout(objectiveAutoContinueTimerRef.current);
      objectiveAutoContinueTimerRef.current = null;
    }

    const autonomy = game?.rowanAutonomy;
    const autoContinueKey = game ? buildObjectiveAutoContinueKey(game) : null;
    if (
      lastObjectiveAutoContinueKeyRef.current &&
      lastObjectiveAutoContinueKeyRef.current !== autoContinueKey
    ) {
      lastObjectiveAutoContinueKeyRef.current = null;
    }

    if (
      !game ||
      !rowanAutoplayEnabled ||
      !autonomy?.autoContinue ||
      busyLabel ||
      optimisticPlayerPosition ||
      isBlockingRowanPlayback(rowanPlayback)
    ) {
      return;
    }

    const autoContinuingConversation =
      Boolean(game.activeConversation) && autonomy.layer === "conversation";
    if (game.activeConversation && !autoContinuingConversation) {
      return;
    }

    if (!autoContinueKey) {
      return;
    }

    if (lastObjectiveAutoContinueKeyRef.current === autoContinueKey) {
      return;
    }

    objectiveAutoContinueTimerRef.current = window.setTimeout(() => {
      const activeGame = gameRef.current;
      const activeAutonomy = activeGame?.rowanAutonomy;
      if (
        !activeGame ||
        !activeAutonomy?.autoContinue ||
        busyLabelRef.current ||
        optimisticPlayerRef.current ||
        isBlockingRowanPlayback(rowanPlaybackRef.current)
      ) {
        return;
      }

      const activeAutoContinuingConversation =
        Boolean(activeGame.activeConversation) &&
        activeAutonomy.layer === "conversation";
      if (
        activeGame.activeConversation &&
        !activeAutoContinuingConversation
      ) {
        return;
      }

      const activeAutoContinueKey = buildObjectiveAutoContinueKey(activeGame);
      if (activeAutoContinueKey !== autoContinueKey) {
        return;
      }

      lastObjectiveAutoContinueKeyRef.current = autoContinueKey;
      void handleAdvanceObjective();
    }, autoContinueDelayMsForBeat(game));

    return () => {
      if (objectiveAutoContinueTimerRef.current) {
        window.clearTimeout(objectiveAutoContinueTimerRef.current);
        objectiveAutoContinueTimerRef.current = null;
      }
    };
  }, [
    busyLabel,
    game,
    game?.activeConversation?.id,
    game?.activeConversation?.updatedAt,
    game?.activeConversation?.lines.length,
    game?.id,
    game?.rowanAutonomy?.autoContinue,
    game?.rowanAutonomy?.key,
    game?.rowanAutonomy?.mode,
    handleAdvanceObjective,
    optimisticPlayerPosition,
    rowanPlayback,
    rowanAutoplayEnabled,
  ]);

  useEffect(() => {
    const handleOverrideChange = () => {
      setSceneOverrideVersion((current) => current + 1);
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key.startsWith("many-lives.visual-scene-runtime")
      ) {
        handleOverrideChange();
      }
    };

    window.addEventListener(
      VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT,
      handleOverrideChange as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT,
        handleOverrideChange as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const snapshot = useMemo<StreetAppSnapshot>(
    () => ({
      busyLabel,
      error,
      game,
      animatePlayerEntrance: !requestedGameId,
      loadingLabel: busyLabel ?? "Preparing the district...",
      optimisticPlayerPosition: optimisticPlayerPosition ?? undefined,
      optimisticPlayerLocationId,
      optimisticPlayerConversationLocationId,
      optimisticPlayerMoveDurationMs: optimisticPlayerMoveDurationMs ?? undefined,
      recentBeat: rowanPlayback.lastCompletedBeat,
      rowanPlayback,
      rowanAutoplayEnabled,
      waypointNonce,
      waypointTarget: waypointTarget ?? undefined,
      visualSceneRefreshNonce: sceneOverrideVersion,
      viewport,
    }),
    [
      busyLabel,
      error,
      game,
      optimisticPlayerConversationLocationId,
      optimisticPlayerLocationId,
      optimisticPlayerMoveDurationMs,
      optimisticPlayerPosition,
      requestedGameId,
      rowanPlayback,
      rowanAutoplayEnabled,
      sceneOverrideVersion,
      viewport,
      waypointNonce,
      waypointTarget,
    ],
  );

  return (
    <main
      className="overflow-hidden bg-black text-white"
      style={{ height: "100dvh" }}
    >
      <div ref={hostRef} className="h-full w-full overflow-hidden">
        {viewport.width > 0 && viewport.height > 0 ? (
          <PhaserStreetExperience
            onAction={handleAction}
            onAdvanceObjective={(options) => {
              void handleAdvanceObjective(options);
            }}
            onAdvanceTime={(minutes, label) => {
              void handleAdvanceTime(minutes, label);
            }}
            onMoveBy={handleMoveBy}
            onMoveTo={handleMoveTo}
            onReload={() => {
              void loadGame();
            }}
            snapshot={snapshot}
          />
        ) : null}
      </div>
    </main>
  );
}

function PhaserStreetExperience({
  snapshot,
  onMoveTo,
  onMoveBy,
  onAction,
  onAdvanceTime,
  onAdvanceObjective,
  onReload,
}: PhaserStreetExperienceProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const callbacksRef = useRef({
    onAction,
    onAdvanceObjective,
    onAdvanceTime,
    onMoveBy,
    onMoveTo,
    onReload,
  });
  const latestSnapshotRef = useRef(snapshot);

  useEffect(() => {
    callbacksRef.current = {
      onAction,
      onAdvanceObjective,
      onAdvanceTime,
      onMoveBy,
      onMoveTo,
      onReload,
    };
  }, [
    onAction,
    onAdvanceObjective,
    onAdvanceTime,
    onMoveBy,
    onMoveTo,
    onReload,
  ]);

  useEffect(() => {
    latestSnapshotRef.current = snapshot;
    runtimeRef.current?.updateSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;

    void createRuntime({
      callbacksRef,
      initialSnapshot: latestSnapshotRef.current,
      mount,
    }).then((runtime) => {
      if (cancelled) {
        runtime.destroy();
        return;
      }

      runtimeRef.current = runtime;
      runtime.updateSnapshot(latestSnapshotRef.current);
    });

    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, [snapshot.viewport.height, snapshot.viewport.width]);

  return <div ref={mountRef} className="h-full w-full" />;
}

async function createRuntime(options: {
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>;
  initialSnapshot: StreetAppSnapshot;
  mount: HTMLDivElement;
}): Promise<RuntimeHandle> {
  const phaserModule = await import("phaser");
  const Phaser = phaserModule.default;
  const initialSnapshot = options.initialSnapshot;
  const overlayDom = document.createElement("div");
  overlayDom.style.position = "absolute";
  overlayDom.style.inset = "0";
  overlayDom.style.zIndex = "2";
  overlayDom.style.pointerEvents = "none";
  overlayDom.style.overflow = "hidden";
  options.mount.style.position = "relative";
  options.mount.appendChild(overlayDom);
  const runtimeNow = getRuntimeNow();
  const renderScale = getRuntimeRenderScale();
  const initialIndices = createRuntimeIndices(initialSnapshot);
  const runtimeState: RuntimeState = {
    autoStartedConversationKey: null,
    cameraEdgeCue: createCameraEdgeCueState(),
    cameraGesture: null,
    cameraOffset: { x: 0, y: 0 },
    cameraZoomFactor: CAMERA_USER_ZOOM_DEFAULT,
    conversationAutostartTimerId: null,
    conversationReplay: {
      activeNpcId: null,
      appliedSignature: null,
      isReplaying: false,
      revealedEntryIds: [],
      streamPauseActor: null,
      streamQueue: [],
      streamedWordCount: 0,
      streamingEntryId: null,
      timerId: null,
    },
    indices: initialIndices,
    lastCameraInteractionAt: runtimeNow,
    mapKey: createMapKey(initialSnapshot.game),
    objects: null,
    pendingConversationAutostartNpcId: null,
    playerEntranceGameId: initialSnapshot.game?.id ?? null,
    playerMotion: createInitialPlayerMotion(
      initialSnapshot,
      initialIndices,
      runtimeNow,
    ),
    renderScale,
    snapshot: initialSnapshot,
    ui: {
      activeTab: "actions",
      focusPanel: null,
      pendingConversationNpcId: null,
      pendingConversationSource: null,
      railExpanded: false,
      selectedNpcId: pickDefaultSelectedNpcId(initialSnapshot.game),
      supportExpanded: false,
    },
    waypointAppliedNonce: initialSnapshot.waypointNonce,
    waypointPlacedAt: runtimeNow,
    waypointTarget: initialSnapshot.waypointTarget ?? null,
  };

  const sceneConfig = {
    preload(this: PhaserType.Scene) {
      if (!this.textures.exists(KENNEY_MODERN_CITY_KEY)) {
        this.load.spritesheet(
          KENNEY_MODERN_CITY_KEY,
          "/assets/kenney/roguelike-modern-city-tilemap-packed.png",
          {
            frameHeight: KENNEY_TILE,
            frameWidth: KENNEY_TILE,
          },
        );
      }

      const southQuayVisualScene = getVisualScene("south-quay-v1");
      if (
        southQuayVisualScene &&
        !this.textures.exists(visualSceneTextureKey(southQuayVisualScene.id))
      ) {
        this.load.image(
          visualSceneTextureKey(southQuayVisualScene.id),
          southQuayVisualScene.referencePlate.src,
        );
      }
    },

    create(this: PhaserType.Scene) {
      const objects = createRuntimeObjects(
        this,
        runtimeState.snapshot,
        overlayDom,
      );
      runtimeState.objects = objects;

      bindOverlayEvents(objects.overlayDom, runtimeState, options.callbacksRef);

      renderStaticScene(objects, runtimeState);
      syncNpcMarkerObjects(objects, runtimeState, options.callbacksRef);
      renderDynamicScene(objects, runtimeState);
      renderOverlay(objects, runtimeState);

      const keyboard = this.input.keyboard;
      if (keyboard) {
        keyboard.on("keydown-W", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(0, -1);
        });
        keyboard.on("keydown-S", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(0, 1);
        });
        keyboard.on("keydown-A", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(-1, 0);
        });
        keyboard.on("keydown-D", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(1, 0);
        });
        keyboard.on("keydown-UP", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(0, -1);
        });
        keyboard.on("keydown-DOWN", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(0, 1);
        });
        keyboard.on("keydown-LEFT", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(-1, 0);
        });
        keyboard.on("keydown-RIGHT", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          options.callbacksRef.current.onMoveBy(1, 0);
        });
        keyboard.on("keydown-MINUS", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          adjustCameraZoom(runtimeState, -CAMERA_WHEEL_ZOOM_STEP);
        });
        keyboard.on("keydown-EQUALS", () => {
          if (
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          adjustCameraZoom(runtimeState, CAMERA_WHEEL_ZOOM_STEP);
        });
      }

      this.input.on("pointerdown", (pointer: PhaserType.Input.Pointer) => {
        beginCameraGesture(
          runtimeState,
          pointer,
          getRuntimeSceneViewport(runtimeState),
        );
      });
      this.input.on("pointermove", (pointer: PhaserType.Input.Pointer) => {
        const now = getRuntimeNow();
        const panResult = updateCameraGesture(
          runtimeState,
          pointer,
          getRuntimeSceneViewport(runtimeState),
          now,
        );
        pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, now);
      });
      this.input.on("pointerup", (pointer: PhaserType.Input.Pointer) => {
        finishRuntimePointerTap(runtimeState, pointer, options.callbacksRef);
      });
      this.input.on("pointerupoutside", (pointer: PhaserType.Input.Pointer) => {
        finishRuntimePointerTap(runtimeState, pointer, options.callbacksRef);
      });
      this.input.on(
        "wheel",
        (
          pointer: PhaserType.Input.Pointer,
          _gameObjects: PhaserType.GameObjects.GameObject[],
          deltaX: number,
          deltaY: number,
          _deltaZ: number,
          event?: WheelEvent,
        ) => {
          if (
            !runtimeState.snapshot.game ||
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          const eventTarget = event?.target ?? null;
          if (
            eventTarget &&
            isOverlayEventTarget(
              runtimeState.objects?.overlayDom ?? null,
              eventTarget,
            )
          ) {
            return;
          }
          if (isCompactViewport(runtimeState.snapshot.viewport)) {
            return;
          }

          const sceneViewport = getRuntimeSceneViewport(runtimeState);
          if (!isPointerWithinSceneViewport(pointer, sceneViewport)) {
            return;
          }

          event?.preventDefault();
          const wheelDelta = normalizeCameraWheelDelta(
            deltaX,
            deltaY,
            event,
            sceneViewport,
          );
          const shouldZoom =
            Boolean(event?.ctrlKey) ||
            Boolean(event?.metaKey) ||
            Boolean(event?.altKey);
          if (shouldZoom) {
            adjustCameraZoom(
              runtimeState,
              wheelDelta.y > 0
                ? -CAMERA_WHEEL_ZOOM_STEP
                : CAMERA_WHEEL_ZOOM_STEP,
            );
            return;
          }

          const now = getRuntimeNow();
          const panResult = adjustCameraPan(
            runtimeState,
            sceneViewport,
            wheelDelta,
            now,
          );
          pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, now);
        },
      );
    },

    update(this: PhaserType.Scene) {
      if (!runtimeState.objects) {
        return;
      }

      renderDynamicScene(runtimeState.objects, runtimeState);
    },
  };

  const game = new Phaser.Game({
    backgroundColor: "#111d23",
    dom: {
      createContainer: true,
    },
    input: {
      mouse: {
        target: options.mount,
      },
      touch: {
        target: options.mount,
      },
    },
    parent: options.mount,
    render: {
      antialias: true,
      pixelArt: false,
    },
    scale: {
      autoCenter: Phaser.Scale.NO_CENTER,
      height: Math.max(
        Math.round(initialSnapshot.viewport.height * renderScale),
        1,
      ),
      mode: Phaser.Scale.NONE,
      width: Math.max(
        Math.round(initialSnapshot.viewport.width * renderScale),
        1,
      ),
      zoom: 1 / renderScale,
    },
    scene: sceneConfig,
    type: Phaser.AUTO,
  });

  return {
    destroy() {
      clearConversationAutostartTimer(runtimeState);
      clearConversationReplayTimer(runtimeState);
      runtimeState.objects = null;
      game.destroy(true);
      overlayDom.remove();
    },

    updateSnapshot(nextSnapshot) {
      runtimeState.snapshot = nextSnapshot;
      const nextMapKey = createMapKey(nextSnapshot.game);

      if (nextMapKey !== runtimeState.mapKey) {
        runtimeState.indices = createRuntimeIndices(nextSnapshot);
        runtimeState.mapKey = nextMapKey;

        if (runtimeState.objects) {
          renderStaticScene(runtimeState.objects, runtimeState);
        }
      }

      syncUiState(runtimeState);
      syncPlayerMotion(runtimeState);
      syncWaypointState(runtimeState);
      maybeAutostartConversation(runtimeState, options.callbacksRef);

      if (runtimeState.objects) {
        drawAmbientOverlay(
          runtimeState.objects.ambientLayer,
          runtimeState,
          getWorldBounds(runtimeState.snapshot),
        );
        syncNpcMarkerObjects(
          runtimeState.objects,
          runtimeState,
          options.callbacksRef,
        );
        renderDynamicScene(runtimeState.objects, runtimeState);
        renderOverlay(runtimeState.objects, runtimeState);
      }
    },
  };
}

function createRuntimeObjects(
  scene: PhaserType.Scene,
  snapshot: StreetAppSnapshot,
  overlayDom: HTMLDivElement,
): RuntimeObjects {
  const terrainLayer = scene.add.graphics().setDepth(10);
  const structureLayer = scene.add.graphics().setDepth(20);
  const structureDetailLayer = scene.add.graphics().setDepth(22);
  const ambientLayer = scene.add.graphics().setDepth(25);
  const overlayLayer = scene.add.graphics().setDepth(30);

  const playerPulse = scene.add.circle(0, 0, 34, 0x8dd0cd, 0.16);
  const playerReticle = scene.add
    .ellipse(0, 16, 52, 28, 0xf1d09f, 0.14)
    .setStrokeStyle(2.2, 0xf1d09f, 0.5);
  const playerAppearance = playerCharacterAppearance();
  const playerRig = createCharacterAvatar(scene, playerAppearance);
  playerRig.avatar.setScale(1.06);
  const playerBeacon = scene.add
    .circle(0, -72, 5.2, 0xffefc8, 0.98)
    .setStrokeStyle(2.2, 0xf0cf8c, 0.64);
  const playerBeaconTail = scene.add.rectangle(0, -64, 2.4, 10, 0xf0cf8c, 0.84);

  const playerTitle = scene.add
    .text(0, -60, "YOU", {
      align: "center",
      color: "#f6deb0",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "11px",
      fontStyle: "700",
      letterSpacing: 3,
    })
    .setBackgroundColor("rgba(31, 25, 17, 0.96)")
    .setOrigin(0.5, 0.5);
  playerTitle.setPadding(8, 4, 8, 4);
  playerTitle.setStroke("#0a1116", 2);

  const playerName = scene.add
    .text(0, -41, snapshot.game?.player.name ?? "Rowan", {
      align: "center",
      color: "#fffaf0",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "15px",
      fontStyle: "700",
    })
    .setBackgroundColor("rgba(7, 13, 18, 0.95)")
    .setOrigin(0.5, 0.5);
  playerName.setPadding(10, 5, 10, 5);
  playerName.setStroke("#091015", 2);

  const playerContainer = scene.add
    .container(0, 0, [
      playerPulse,
      playerReticle,
      playerRig.avatar,
      playerBeaconTail,
      playerBeacon,
      playerTitle,
      playerName,
    ])
    .setDepth(60);
  playerContainer.setScale(1.08);

  return {
    ambientLayer,
    assetStructureNodes: [],
    assetTerrainNodes: [],
    mapLabels: [],
    npcMarkers: new Map(),
    overlayDom,
    overlayLayer,
    playerBeacon,
    playerBeaconTail,
    playerAppearance,
    playerContainer,
    playerName,
    playerPulse,
    playerReticle,
    playerRig,
    playerTitle,
    scene,
    structureDetailLayer,
    structureLayer,
    terrainLayer,
  };
}

function bindOverlayEvents(
  root: HTMLDivElement,
  runtimeState: RuntimeState,
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>,
) {
  root.addEventListener(
    "wheel",
    (event) => {
      if (isOverlayEventTarget(root, event.target)) {
        event.stopPropagation();
      }
    },
    { capture: true, passive: true },
  );

  root.onclick = (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const tabButton = target.closest<HTMLElement>("[data-tab]");
    if (tabButton) {
      const nextTab = asTab(tabButton.dataset.tab);
      runtimeState.ui.activeTab = nextTab;
      runtimeState.ui.focusPanel = asFocusPanel(nextTab);
      renderOverlay(runtimeState.objects!, runtimeState);
      return;
    }

    const toggleRailButton = target.closest<HTMLElement>("[data-toggle-rail]");
    if (toggleRailButton) {
      if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
        runtimeState.ui.railExpanded = !runtimeState.ui.railExpanded;
        renderOverlay(runtimeState.objects!, runtimeState);
      }
      return;
    }

    const toggleSupportButton = target.closest<HTMLElement>(
      "[data-toggle-support]",
    );
    if (toggleSupportButton) {
      runtimeState.ui.supportExpanded = !runtimeState.ui.supportExpanded;
      renderOverlay(runtimeState.objects!, runtimeState);
      return;
    }

    const selectNpcButton = target.closest<HTMLElement>("[data-select-npc]");
    if (selectNpcButton) {
      runtimeState.ui.selectedNpcId = selectNpcButton.dataset.selectNpc ?? null;
      runtimeState.ui.activeTab = "actions";
      runtimeState.ui.focusPanel = null;
      if (selectNpcButton.dataset.selectNpc) {
        setPendingConversation(
          runtimeState,
          selectNpcButton.dataset.selectNpc,
          "selection",
        );
      } else {
        clearPendingConversation(runtimeState);
      }
      if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
        runtimeState.ui.railExpanded = true;
      }
      renderOverlay(runtimeState.objects!, runtimeState);
      maybeAutostartConversation(runtimeState, callbacksRef);
      return;
    }

    const closeFocusButton = target.closest<HTMLElement>("[data-close-focus]");
    if (closeFocusButton) {
      runtimeState.ui.focusPanel = null;
      runtimeState.ui.activeTab = "actions";
      renderOverlay(runtimeState.objects!, runtimeState);
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-action-id]");
    if (actionButton) {
      const actionId = actionButton.dataset.actionId;
      const actionLabel = actionButton.dataset.actionLabel ?? "Doing that";
      if (actionId) {
        const talkNpcId = extractTalkNpcId(actionId);
        if (talkNpcId) {
          clearConversationAutostartTimer(runtimeState);
          runtimeState.ui.selectedNpcId = talkNpcId;
          runtimeState.ui.activeTab = "actions";
          runtimeState.ui.focusPanel = null;
          if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
            runtimeState.ui.railExpanded = true;
          }
        }
        callbacksRef.current.onAction(actionId, actionLabel);
      }
      return;
    }

    const waitButton = target.closest<HTMLElement>("[data-wait-minutes]");
    if (waitButton) {
      const minutes = Number(waitButton.dataset.waitMinutes ?? "0");
      const label = waitButton.dataset.waitLabel ?? "Waiting...";
      if (minutes > 0) {
        callbacksRef.current.onAdvanceTime(minutes, label);
      }
      return;
    }

    const advanceButton = target.closest<HTMLElement>(
      "[data-advance-objective]",
    );
    if (advanceButton) {
      const snapshotGame = runtimeState.snapshot.game;
      const canAdvanceConversation =
        Boolean(snapshotGame?.activeConversation) &&
        Boolean(snapshotGame?.rowanAutonomy?.autoContinue);
      if (!snapshotGame?.activeConversation || canAdvanceConversation) {
        callbacksRef.current.onAdvanceObjective({ confirmedByUser: true });
      }
      return;
    }

    const reloadButton = target.closest<HTMLElement>("[data-reload]");
    if (reloadButton) {
      callbacksRef.current.onReload();
    }
  };
}

function syncCommandRailDiagnostics(root: HTMLDivElement) {
  const commandRail = root.querySelector<HTMLElement>(
    '[data-preserve-scroll="command-rail"]',
  );
  if (!commandRail) {
    return;
  }

  const anchor = commandRail.querySelector<HTMLElement>(".ml-rowan-directive");
  const directive =
    anchor ??
    commandRail.querySelector<HTMLElement>('[data-rowan-directive="true"]');
  if (!directive) {
    commandRail.dataset.commandRailAnchorVisible = "true";
    commandRail.dataset.commandRailScrollTop = String(commandRail.scrollTop);
    return;
  }

  const railRect = commandRail.getBoundingClientRect();
  const anchorRect = directive.getBoundingClientRect();
  const anchorVisible = anchorRect.top >= railRect.top - 1;
  commandRail.dataset.commandRailAnchorVisible = anchorVisible
    ? "true"
    : "false";
  commandRail.dataset.commandRailScrollTop = String(
    Math.round(commandRail.scrollTop),
  );
}

function renderStaticScene(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
) {
  const {
    ambientLayer,
    scene,
    structureDetailLayer,
    structureLayer,
    terrainLayer,
  } = objects;
  const world = getWorldBounds(runtimeState.snapshot);
  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    world,
    runtimeState.snapshot.viewport,
  );
  const sceneZoom = getTargetSceneZoom(runtimeState, sceneViewport, world);
  const camera = scene.cameras.main;
  camera.setBackgroundColor(
    getPlayableVisualScene(runtimeState.snapshot.game)?.backgroundColor ??
      "#111d23",
  );
  camera.setBounds(0, 0, world.width, world.height);
  camera.setViewport(
    sceneViewport.x,
    sceneViewport.y,
    sceneViewport.width,
    sceneViewport.height,
  );
  camera.setZoom(sceneZoom);
  camera.setRoundPixels(runtimeState.indices.visualScene !== null);

  terrainLayer.clear();
  structureLayer.clear();
  structureDetailLayer.clear();
  ambientLayer.clear();

  for (const label of objects.mapLabels) {
    label.destroy();
  }
  objects.mapLabels = [];
  for (const node of objects.assetTerrainNodes) {
    node.destroy();
  }
  objects.assetTerrainNodes = [];
  for (const node of objects.assetStructureNodes) {
    node.destroy();
  }
  objects.assetStructureNodes = [];

  const game = runtimeState.snapshot.game;
  drawBackdrop(
    terrainLayer,
    world,
    runtimeState.indices.visualScene ? undefined : game?.map,
  );
  if (!game) {
    return;
  }

  if (runtimeState.indices.visualScene) {
    renderAuthoredVisualScene(
      objects,
      runtimeState.indices.visualScene,
    );
    drawAmbientOverlay(ambientLayer, runtimeState, world);
    objects.mapLabels = drawLocationLabels(
      scene,
      game,
      runtimeState.indices,
      runtimeState.indices.visualScene,
    );
    return;
  }

  const useKenneyAssets = scene.textures.exists(KENNEY_MODERN_CITY_KEY);
  drawFringeTiles(terrainLayer, game.map);
  drawTiles(terrainLayer, game.map.tiles);
  drawFringeBlocks(structureLayer, game.map);
  drawFootprints(structureLayer, game.map, useKenneyAssets);
  drawDoors(structureLayer, game.map.doors);
  drawProps(structureLayer, game.map.props);
  drawFringeProps(structureLayer, game.map);
  objects.assetTerrainNodes = drawKenneyTerrainSprites(scene, game.map.tiles);
  objects.assetStructureNodes = [
    ...drawKenneyFacadeSprites(scene, game),
    ...drawKenneyLandmarkOverlays(scene, game),
    ...drawKenneyPropSprites(scene, game.map.props),
  ];
  drawAmbientOverlay(ambientLayer, runtimeState, world);
  objects.mapLabels = drawLocationLabels(
    scene,
    game,
    runtimeState.indices,
    null,
  );
}

function renderDynamicScene(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
) {
  const game = runtimeState.snapshot.game;
  const now = getRuntimeNow();
  const world = getWorldBounds(runtimeState.snapshot);
  const usingAuthoredVisualScene = runtimeState.indices.visualScene !== null;

  if (!game) {
    objects.overlayLayer.clear();
    objects.playerContainer.setVisible(false);
    for (const marker of objects.npcMarkers.values()) {
      marker.container.setVisible(false);
    }
    return;
  }

  if (syncRuntimeRenderScale(objects, runtimeState)) {
    renderStaticScene(objects, runtimeState);
  }

  objects.playerContainer.setVisible(true);
  const playerTile = samplePlayerTile(runtimeState.playerMotion, now);
  if (
    runtimeState.waypointTarget &&
    distanceBetween(playerTile, runtimeState.waypointTarget) <= 0.08
  ) {
    setRuntimeWaypointTarget(runtimeState, null, now);
  }
  const playerPixel = samplePlayerWorld(runtimeState, playerTile, now);
  const activeConversationNpc = getSelectedNpc(runtimeState) ?? undefined;
  const animatedNpcs = computeAnimatedNpcs(runtimeState, now, playerPixel);
  const playerAnimation = getPlayerAnimationState(
    runtimeState.playerMotion,
    now,
  );

  objects.playerContainer.setPosition(playerPixel.x, playerPixel.y);
  objects.playerName
    .setText(runtimeState.snapshot.game?.player.name ?? "Rowan")
    .setVisible(!usingAuthoredVisualScene);
  objects.playerBeacon
    .setVisible(true)
    .setScale(1 + Math.sin(now / 220) * (usingAuthoredVisualScene ? 0.1 : 0.08))
    .setAlpha(usingAuthoredVisualScene ? 0.96 : 0.9);
  objects.playerBeaconTail
    .setVisible(true)
    .setAlpha(
      usingAuthoredVisualScene
        ? 0.88 + Math.sin(now / 240) * 0.08
        : 0.78 + Math.sin(now / 240) * 0.06,
    );
  objects.playerTitle
    .setVisible(true)
    .setAlpha(usingAuthoredVisualScene ? 0.96 : 0.84);
  objects.playerPulse
    .setVisible(!usingAuthoredVisualScene)
    .setScale(1 + Math.sin(now / 220) * 0.08)
    .setAlpha(runtimeState.snapshot.busyLabel ? 0.24 : 0.16);
  objects.playerReticle
    .setVisible(!usingAuthoredVisualScene)
    .setScale(1 + Math.sin(now / 260) * 0.04, 1 + Math.sin(now / 260) * 0.03)
    .setAlpha(activeConversationNpc ? 0.56 : 0.42);
  poseCharacterRig(objects.playerRig, {
    facing: playerAnimation.facing,
    now,
    stride: playerAnimation.stride,
  });
  objects.playerRig.torso.setFillStyle(
    activeConversationNpc
      ? blendColor(objects.playerAppearance.coat, 0xf1d09f, 0.18)
      : objects.playerAppearance.coat,
    0.98,
  );
  objects.playerRig.accent.setFillStyle(
    activeConversationNpc
      ? blendColor(objects.playerAppearance.accent, 0xf1d09f, 0.24)
      : objects.playerAppearance.accent,
    0.94,
  );
  objects.playerRig.shadow.setFillStyle(
    0x091015,
    activeConversationNpc ? 0.48 : 0.38,
  );

  updateNpcMarkers(objects, runtimeState, animatedNpcs, now);
  drawDynamicOverlay(objects.overlayLayer, runtimeState, playerPixel, now);
  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    world,
    runtimeState.snapshot.viewport,
  );
  const camera = objects.scene.cameras.main;
  const cameraBlockedEdges = updateCamera(
    camera,
    runtimeState,
    sceneViewport,
    playerPixel,
    world,
    now,
  );
  pulseCameraEdgeCue(runtimeState, cameraBlockedEdges, now);
  syncCameraEdgeCues(
    objects.overlayDom,
    runtimeState,
    getOverlaySceneViewport(runtimeState),
    now,
  );
}

function renderOverlay(objects: RuntimeObjects, runtimeState: RuntimeState) {
  syncConversationReplayState(runtimeState);
  const root = objects.overlayDom;
  const { width, height } = runtimeState.snapshot.viewport;
  const overlayState = captureOverlayRenderState(root);
  root.style.width = `${width}px`;
  root.style.height = `${height}px`;
  root.style.pointerEvents = "none";
  root.style.boxSizing = "border-box";
  root.innerHTML = buildOverlayHtml(runtimeState);
  restoreOverlayRenderState(root, overlayState);
  syncCommandRailDiagnostics(root);
}

function clearConversationReplayTimer(runtimeState: RuntimeState) {
  if (runtimeState.conversationReplay.timerId !== null) {
    window.clearTimeout(runtimeState.conversationReplay.timerId);
    runtimeState.conversationReplay.timerId = null;
  }
}

function clearConversationAutostartTimer(runtimeState: RuntimeState) {
  if (runtimeState.conversationAutostartTimerId !== null) {
    window.clearTimeout(runtimeState.conversationAutostartTimerId);
    runtimeState.conversationAutostartTimerId = null;
  }
  runtimeState.pendingConversationAutostartNpcId = null;
}

function clearPendingConversation(runtimeState: RuntimeState) {
  runtimeState.ui.pendingConversationNpcId = null;
  runtimeState.ui.pendingConversationSource = null;
}

function setPendingConversation(
  runtimeState: RuntimeState,
  npcId: string,
  source: PendingConversationSource,
) {
  runtimeState.ui.pendingConversationNpcId = npcId;
  runtimeState.ui.pendingConversationSource = source;
}

function resetConversationReplayState(
  runtimeState: RuntimeState,
  {
    npcId,
    replayEntryIds,
    replaySignature,
    visibleEntries,
  }: {
    npcId: string | null;
    replayEntryIds: string[];
    replaySignature: string | null;
    visibleEntries: ConversationEntry[];
  },
) {
  clearConversationReplayTimer(runtimeState);
  const firstReplayEntry = visibleEntries.find((entry) =>
    replayEntryIds.includes(entry.id),
  );
  runtimeState.conversationReplay.activeNpcId = npcId;
  runtimeState.conversationReplay.appliedSignature = replaySignature;
  runtimeState.conversationReplay.isReplaying = replayEntryIds.length > 0;
  runtimeState.conversationReplay.revealedEntryIds = visibleEntries
    .filter((entry) => !replayEntryIds.includes(entry.id))
    .map((entry) => entry.id);
  runtimeState.conversationReplay.streamPauseActor = firstReplayEntry
    ? conversationActorForSpeaker(firstReplayEntry.speaker)
    : null;
  runtimeState.conversationReplay.streamQueue = [...replayEntryIds];
  runtimeState.conversationReplay.streamedWordCount = 0;
  runtimeState.conversationReplay.streamingEntryId = null;
}

function mergeConversationReplayState(
  runtimeState: RuntimeState,
  {
    npcId,
    replayEntryIds,
    replaySignature,
    visibleEntries,
  }: {
    npcId: string;
    replayEntryIds: string[];
    replaySignature: string | null;
    visibleEntries: ConversationEntry[];
  },
) {
  const replay = runtimeState.conversationReplay;
  const visibleEntryIdSet = new Set(visibleEntries.map((entry) => entry.id));
  replay.activeNpcId = npcId;
  replay.appliedSignature = replaySignature;
  replay.revealedEntryIds = replay.revealedEntryIds.filter((entryId) =>
    visibleEntryIdSet.has(entryId),
  );
  replay.streamQueue = replay.streamQueue.filter(
    (entryId) =>
      visibleEntryIdSet.has(entryId) && entryId !== replay.streamingEntryId,
  );

  if (
    replay.streamingEntryId &&
    !visibleEntryIdSet.has(replay.streamingEntryId)
  ) {
    replay.streamingEntryId = null;
    replay.streamedWordCount = 0;
  }

  const knownEntryIds = new Set(replay.revealedEntryIds);
  replay.streamQueue.forEach((entryId) => {
    knownEntryIds.add(entryId);
  });
  if (replay.streamingEntryId) {
    knownEntryIds.add(replay.streamingEntryId);
  }

  const nextQueuedEntryIds = replayEntryIds.filter(
    (entryId) => !knownEntryIds.has(entryId),
  );
  if (nextQueuedEntryIds.length > 0) {
    replay.streamQueue = [...replay.streamQueue, ...nextQueuedEntryIds];
  }

  replay.isReplaying =
    Boolean(replay.streamingEntryId) || replay.streamQueue.length > 0;
  if (!replay.isReplaying) {
    replay.streamPauseActor = null;
  }
}

function syncConversationReplayState(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  const selectedNpc = getSelectedNpc(runtimeState);

  if (!game || !selectedNpc) {
    resetConversationReplayState(runtimeState, {
      npcId: null,
      replayEntryIds: [],
      replaySignature: null,
      visibleEntries: [],
    });
    return;
  }

  const visibleEntries = getConversationPreview(game, selectedNpc.id);
  const activeConversation =
    game.activeConversation?.npcId === selectedNpc.id
      ? game.activeConversation
      : undefined;
  const replaySignature = activeConversation
    ? buildConversationReplaySignature(activeConversation)
    : null;
  const replayEntryIds =
    activeConversation?.lines.map((entry) => entry.id) ?? [];
  const replay = runtimeState.conversationReplay;

  if (replay.activeNpcId !== selectedNpc.id) {
    resetConversationReplayState(runtimeState, {
      npcId: selectedNpc.id,
      replayEntryIds,
      replaySignature,
      visibleEntries,
    });
  } else if (replaySignature && replaySignature !== replay.appliedSignature) {
    mergeConversationReplayState(runtimeState, {
      npcId: selectedNpc.id,
      replayEntryIds,
      replaySignature,
      visibleEntries,
    });
  } else {
    if (!replaySignature && replay.appliedSignature) {
      replay.appliedSignature = null;
    }

    const revealedEntryIdsLookup = new Set(replay.revealedEntryIds);
    const queuedEntryIdsLookup = new Set(replay.streamQueue);
    const nextQueuedEntryIds = visibleEntries
      .filter(
        (entry) =>
          !revealedEntryIdsLookup.has(entry.id) &&
          !queuedEntryIdsLookup.has(entry.id) &&
          entry.id !== replay.streamingEntryId,
      )
      .map((entry) => entry.id);

    if (nextQueuedEntryIds.length > 0) {
      replay.streamQueue = [...replay.streamQueue, ...nextQueuedEntryIds];
      replay.isReplaying = true;
    }
  }

  if (replay.timerId === null) {
    scheduleConversationReplayTick(runtimeState);
  }
}

function scheduleConversationReplayTick(runtimeState: RuntimeState) {
  clearConversationReplayTimer(runtimeState);

  const game = runtimeState.snapshot.game;
  const replay = runtimeState.conversationReplay;
  if (!game || !replay.activeNpcId) {
    return;
  }

  const visibleEntries = getConversationPreview(game, replay.activeNpcId);
  const currentStreamingEntry = replay.streamingEntryId
    ? visibleEntries.find((entry) => entry.id === replay.streamingEntryId)
    : undefined;

  if (currentStreamingEntry) {
    const totalWords = splitConversationStreamWords(
      currentStreamingEntry.text,
    ).length;
    const delay =
      totalWords <= 1 || replay.streamedWordCount >= totalWords
        ? ROWAN_PLAYBACK_TIMING_MS.entrySettle
        : conversationStreamDelayMs(
            currentStreamingEntry.speaker,
            replay.streamedWordCount,
          );

    replay.timerId = window.setTimeout(() => {
      if (!runtimeState.snapshot.game) {
        return;
      }

      if (
        totalWords <= 1 ||
        runtimeState.conversationReplay.streamedWordCount >= totalWords
      ) {
        runtimeState.conversationReplay.revealedEntryIds = [
          ...runtimeState.conversationReplay.revealedEntryIds,
          currentStreamingEntry.id,
        ];
        runtimeState.conversationReplay.streamingEntryId = null;
        runtimeState.conversationReplay.streamedWordCount = 0;
      } else {
        runtimeState.conversationReplay.streamedWordCount += 1;
      }

      runtimeState.conversationReplay.timerId = null;
      if (runtimeState.objects) {
        renderOverlay(runtimeState.objects, runtimeState);
      }
    }, delay);

    return;
  }

  if (replay.streamQueue.length > 0) {
    const [nextEntryId, ...remainingEntryIds] = replay.streamQueue;
    const nextEntry = visibleEntries.find((entry) => entry.id === nextEntryId);
    const previousSpeaker = nextEntryId
      ? findPreviousConversationSpeaker(visibleEntries, nextEntryId)
      : undefined;
    const delay = conversationEntryStartDelayMs(
      previousSpeaker,
      nextEntry?.speaker,
    );
    replay.streamPauseActor =
      nextEntry && delay > 0
        ? conversationActorForSpeaker(nextEntry.speaker)
        : null;

    replay.timerId = window.setTimeout(() => {
      runtimeState.conversationReplay.streamQueue = remainingEntryIds;
      runtimeState.conversationReplay.streamingEntryId = nextEntryId ?? null;
      runtimeState.conversationReplay.streamedWordCount = 1;
      runtimeState.conversationReplay.streamPauseActor = null;
      runtimeState.conversationReplay.timerId = null;
      if (runtimeState.objects) {
        renderOverlay(runtimeState.objects, runtimeState);
      }
    }, delay);

    return;
  }

  if (replay.streamPauseActor) {
    replay.streamPauseActor = null;
  }

  if (replay.isReplaying) {
    replay.isReplaying = false;
  }
}

function syncNpcMarkerObjects(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>,
) {
  const game = runtimeState.snapshot.game;
  const liveNpcIds = new Set((game?.npcs ?? []).map((npc) => npc.id));

  for (const [npcId, marker] of objects.npcMarkers) {
    if (liveNpcIds.has(npcId)) {
      continue;
    }

    marker.container.destroy();
    objects.npcMarkers.delete(npcId);
  }

  for (const npc of game?.npcs ?? []) {
    if (objects.npcMarkers.has(npc.id)) {
      continue;
    }

    const marker = createNpcMarker(objects.scene, npc, () => {
      runtimeState.ui.selectedNpcId = npc.id;
      runtimeState.ui.activeTab = "people";
      runtimeState.ui.focusPanel = "people";
      setPendingConversation(runtimeState, npc.id, "selection");
      renderOverlay(objects, runtimeState);
      maybeAutostartConversation(runtimeState, callbacksRef);
    });
    objects.npcMarkers.set(npc.id, marker);
  }

  if (!game) {
    return;
  }

  if (runtimeState.snapshot.busyLabel) {
    return;
  }

  const keyboard = objects.scene.input.keyboard;
  if (!keyboard) {
    return;
  }

  keyboard.enabled = true;
  void callbacksRef;
}

function createNpcMarker(
  scene: PhaserType.Scene,
  npc: NpcState,
  onSelect: () => void,
): NpcMarkerObjects {
  const appearance = characterAppearanceForNpc(npc);
  const rig = createCharacterAvatar(scene, appearance);

  const label = scene.add
    .text(0, 24, npc.name, {
      align: "center",
      color: "#eef5f7",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "12px",
      fontStyle: "700",
    })
    .setBackgroundColor("rgba(8, 14, 19, 0.9)")
    .setAlpha(0.96)
    .setOrigin(0.5, 0);
  label.setPadding(6, 3, 6, 3);

  const container = scene.add.container(0, 0, [rig.avatar, label]).setDepth(40);

  container.setSize(50, 50);
  container.setInteractive({ useHandCursor: true });
  container.on(
    "pointerdown",
    (
      _pointer: PhaserType.Input.Pointer,
      _localX: number,
      _localY: number,
      event: PhaserType.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      onSelect();
    },
  );

  return {
    appearance,
    container,
    label,
    rig,
  };
}

function updateNpcMarkers(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
  animatedNpcs: AnimatedNpcState[],
  now: number,
) {
  const game = runtimeState.snapshot.game;
  const usingAuthoredVisualScene = runtimeState.indices.visualScene !== null;
  const showActorLabels = !usingAuthoredVisualScene;
  const talkableNpcIds = new Set(
    (game?.availableActions ?? [])
      .map((action) => extractTalkNpcId(action.id))
      .filter(isPresent),
  );

  for (const marker of objects.npcMarkers.values()) {
    marker.container.setVisible(false);
  }

  for (const animatedNpc of animatedNpcs) {
    const marker = objects.npcMarkers.get(animatedNpc.npc.id);
    if (!marker) {
      continue;
    }

    const personality = npcPersonalityProfile(animatedNpc.npc);
    const highlight = animatedNpc.npc.id === runtimeState.ui.selectedNpcId;
    const inLiveConversation =
      game?.activeConversation?.npcId === animatedNpc.npc.id;
    const isTalkable = talkableNpcIds.has(animatedNpc.npc.id);
    const showLabel =
      showActorLabels || highlight || inLiveConversation || isTalkable;
    marker.container
      .setPosition(animatedNpc.x, animatedNpc.y)
      .setScale(
        highlight
          ? personality.scale + 0.08
          : animatedNpc.isYielding
            ? Math.max(personality.scale - 0.04, 0.92)
            : personality.scale,
      )
      .setVisible(true);
    marker.label
      .setVisible(showLabel)
      .setAlpha(
        usingAuthoredVisualScene
          ? highlight || inLiveConversation
            ? 0.98
            : isTalkable
              ? 0.88
              : 0.8
          : 0.96,
      );
    poseCharacterRig(marker.rig, {
      facing: animatedNpc.facing,
      now,
      style: personality.motion,
      stride: animatedNpc.isYielding
        ? animatedNpc.step * 0.42
        : animatedNpc.step,
    });
    marker.label
      .setColor(
        highlight
          ? "#fff1d2"
          : inLiveConversation
            ? "#fff0c3"
            : isTalkable && usingAuthoredVisualScene
              ? "#f6e4bb"
              : animatedNpc.npc.known
                ? personality.labelColor
                : "#eef5f7",
      )
      .setBackgroundColor(
        highlight
          ? colorToCssRgba(
              blendColor(marker.appearance.accent, 0x1a1f25, 0.36),
              0.96,
            )
          : inLiveConversation
            ? colorToCssRgba(
                blendColor(marker.appearance.accent, 0x201910, 0.4),
                0.94,
              )
            : isTalkable && usingAuthoredVisualScene
              ? "rgba(37, 31, 21, 0.92)"
              : personality.labelBackground,
      );
    marker.rig.torso.setFillStyle(
      highlight
        ? blendColor(marker.appearance.coat, 0xf1d09f, 0.22)
        : marker.appearance.coat,
      0.98,
    );
    marker.rig.accent.setFillStyle(
      highlight
        ? blendColor(marker.appearance.accent, 0xf1d09f, 0.3)
        : marker.appearance.accent,
      0.94,
    );
    marker.rig.shadow.setFillStyle(0x091015, highlight ? 0.5 : 0.42);
  }
}

function buildOverlayHtml(runtimeState: RuntimeState) {
  const { snapshot, ui } = runtimeState;
  const { width, height } = snapshot.viewport;

  if (!snapshot.game) {
    return buildLoadingHtml(snapshot, width, height);
  }

  const game = snapshot.game;
  const overlaySceneViewport = getOverlaySceneViewport(runtimeState);
  const locationById = new Map(
    game.locations.map((location) => [location.id, location] as const),
  );
  const selectedNpc = getSelectedNpc(runtimeState);
  const recentFeed = game.feed.slice(0, 5);
  const objectivePlanItems = buildObjectivePlanRows(game, locationById);
  const objectiveCompletedItems = buildObjectiveCompletionRows(
    game,
    locationById,
  );
  const actions = game.availableActions.slice(0, 8);
  const talkableNpcIds = new Set(
    game.availableActions
      .map((action) => extractTalkNpcId(action.id))
      .filter(isPresent),
  );
  const nearbyNpcs = game.currentScene.people
    .map((person) => game.npcs.find((npc) => npc.id === person.id))
    .filter(isPresent);
  const fallbackNpcList =
    nearbyNpcs.length > 0 ? nearbyNpcs : game.npcs.slice(0, 5);
  const sceneNotes = game.currentScene.notes.slice(0, 3);
  const currentObjectiveText =
    game.player.objective?.text ?? "Find the next useful thing to do.";
  const currentThought = toFirstPersonText(buildPlayerThought(game));
  const currentSummary = toFirstPersonText(game.summary);
  const backstoryPreview = buildNarrativePreview(game.player.backstory, 64);
  const currentThoughtPreview = buildNarrativePreview(currentThought, 88);
  const currentSummaryPreview = buildNarrativePreview(currentSummary, 132);
  const currentContext =
    game.currentScene.context ||
    game.districtNarrative.context ||
    game.cityNarrative.context ||
    backstoryPreview;
  const activeJob = game.jobs.find(
    (job) =>
      job.id === game.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const activeJobLocation = activeJob
    ? locationById.get(activeJob.locationId)
    : undefined;
  const activeJobDeferredUntilLabel =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > game.clock.totalMinutes
      ? formatClock(isoForTotalMinutes(activeJob.deferredUntilMinutes))
      : undefined;
  const activeJobStartTotalMinutes = activeJob
    ? totalMinutesForDayHour(game.clock.day, activeJob.startHour)
    : undefined;
  const upcomingCommitmentMinutes =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > game.clock.totalMinutes
      ? activeJob.deferredUntilMinutes
      : activeJobStartTotalMinutes !== undefined &&
          activeJobStartTotalMinutes > game.clock.totalMinutes
        ? activeJobStartTotalMinutes
        : undefined;
  const activeCommitmentSummary = activeJob
    ? activeJobDeferredUntilLabel
      ? `Deferred until about ${activeJobDeferredUntilLabel}.`
      : `${activeJobLocation?.name ?? "Job site"} • pays $${activeJob.pay} • ${formatJobWindow(
          game.clock.day,
          activeJob.startHour,
          activeJob.endHour,
        )}`
    : undefined;
  const upcomingCommitmentLabel =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > game.clock.totalMinutes
      ? `Deferred until about ${formatClock(
          isoForTotalMinutes(activeJob.deferredUntilMinutes),
        )}.`
      : activeJob &&
          activeJobStartTotalMinutes !== undefined &&
          activeJobStartTotalMinutes > game.clock.totalMinutes
        ? `${activeJob.title} starts at ${formatClock(
            isoForTotalMinutes(activeJobStartTotalMinutes),
          )}.`
        : undefined;
  const waitOptions = buildWaitOptions(
    game.clock.totalMinutes,
    upcomingCommitmentMinutes,
  );
  const objectiveSuggestions = buildObjectiveSuggestions(game);
  const rememberedPlaces = game.player.knownLocationIds
    .map((locationId) => locationById.get(locationId))
    .filter(isPresent)
    .slice(0, 6);
  const rememberedPeople = game.player.knownNpcIds
    .map((npcId) => game.npcs.find((npc) => npc.id === npcId))
    .filter(isPresent)
    .slice(0, 4);
  const memoryThreads = buildMemoryThreads(game, locationById);
  const tools = game.player.inventory;
  const primaryPlace =
    (game.player.currentLocationId
      ? locationById.get(game.player.currentLocationId)
      : undefined) ?? rememberedPlaces[0];
  const primaryPerson = rememberedPeople[0];
  const primaryThread = memoryThreads[0];
  const primaryTool = tools[0];
  const extraPlaceNames = rememberedPlaces
    .filter((location) => location.id !== primaryPlace?.id)
    .slice(0, 2)
    .map((location) => location.name);
  const extraPeopleNames = rememberedPeople
    .filter((person) => person.id !== primaryPerson?.id)
    .slice(0, 2)
    .map((person) => person.name);
  const extraThreadTitles = memoryThreads
    .filter((thread) => thread.id !== primaryThread?.id)
    .slice(0, 2)
    .map((thread) => thread.title);
  const extraToolNames = tools
    .filter((item) => item.id !== primaryTool?.id)
    .slice(0, 2)
    .map((item) => item.name);
  const conversationLines = selectedNpc
    ? getConversationPreview(game, selectedNpc.id)
    : [];
  const selectedConversationThread = selectedNpc
    ? getConversationThreadState(game, selectedNpc.id)
    : undefined;
  const fallbackConversationThread = !selectedNpc
    ? getLatestMeaningfulConversationThread(game)
    : undefined;
  const fallbackConversationNpc = fallbackConversationThread
    ? game.npcs.find((npc) => npc.id === fallbackConversationThread.npcId) ??
      null
    : null;
  const railConversationNpc = selectedNpc ?? fallbackConversationNpc;
  const railConversationThread = railConversationNpc
    ? getConversationThreadState(game, railConversationNpc.id)
    : undefined;
  const selectedActiveConversation =
    selectedNpc && game.activeConversation?.npcId === selectedNpc.id
      ? game.activeConversation
      : undefined;
  const railActiveConversation =
    railConversationNpc &&
    game.activeConversation?.npcId === railConversationNpc.id
      ? game.activeConversation
      : undefined;
  const railConversationLines = railConversationNpc
    ? getConversationPreview(game, railConversationNpc.id)
    : [];
  const selectedTalkAction = selectedNpc
    ? game.availableActions.find(
        (action) => extractTalkNpcId(action.id) === selectedNpc.id,
      )
    : undefined;
  const focusPanel = ui.focusPanel;
  const focusMeta = focusPanel
    ? focusPanelMeta(focusPanel, selectedNpc, game)
    : null;
  const focusContent =
    focusPanel === "people"
      ? buildPeopleTabHtml({
          conversationDecision:
            selectedActiveConversation?.decision ??
            selectedConversationThread?.decision,
          conversationLines,
          conversationObjectiveText:
            selectedActiveConversation?.objectiveText ??
            selectedConversationThread?.objectiveText,
          conversationSummary: selectedConversationThread?.summary,
          conversationUpdatedAt:
            selectedActiveConversation?.updatedAt ??
            selectedConversationThread?.updatedAt,
          currentObjectiveText,
          currentSummary,
          currentThought,
          npcs: fallbackNpcList,
          selectedNpc,
          snapshot,
          talkableNpcIds,
          tools,
        })
      : focusPanel === "journal"
        ? buildJournalTabHtml({
            busyLabel: snapshot.busyLabel,
            currentObjectiveText,
            game,
            objectiveCompleted: objectiveCompletedItems,
            objectivePlanItems,
            objectiveSuggestions,
            recentFeed,
          })
        : focusPanel === "mind"
          ? buildMindTabHtml({
              extraPeopleNames,
              extraPlaceNames,
              extraThreadTitles,
              extraToolNames,
              game,
              memoryThreads,
              primaryPerson,
              primaryPlace,
              primaryThread,
              primaryTool,
            })
          : "";
  const {
    dockFocusWidth,
    dockWidth,
    focusHeight,
    focusWidth,
    overlayInset,
    railMaxHeight,
    railWidth,
  } = getOverlayLayoutMetrics(snapshot.viewport);
  const feedPreview = recentFeed.slice(0, height <= 900 ? 1 : 2);
  const rowanAutonomy = game.rowanAutonomy ?? FALLBACK_ROWAN_AUTONOMY;
  const railViewport = isPhoneRailViewport(snapshot.viewport)
    ? "phone"
    : isCollapsibleRailViewport(snapshot.viewport)
      ? "tablet"
      : "desktop";
  const railExpanded = railViewport === "desktop" ? true : ui.railExpanded;
  const supportExpanded = ui.supportExpanded;
  const sceneDescriptionPreview = buildNarrativePreview(
    game.currentScene.description,
    116,
  );
  const quickSceneNotes = sceneNotes
    .filter((note) => !/is active right now\.?$/i.test(note.text.trim()))
    .slice(0, 1);
  const sceneRead = joinNarrativeFragments([
    sceneDescriptionPreview,
    quickSceneNotes[0]?.text,
  ]);
  const conversationWillCarryForward = Boolean(
    buildResolvedConversationAutoContinueKey(game),
  );
  const conversationReplayActive =
    runtimeState.conversationReplay.isReplaying ||
    Boolean(runtimeState.conversationReplay.streamingEntryId) ||
    Boolean(runtimeState.conversationReplay.streamPauseActor);
  const conversationCanAdvanceDuringReplay = Boolean(
    game.activeConversation && game.rowanAutonomy?.autoContinue,
  );
  const rowanRail = buildRowanRailViewModel({
    conversationReplayActive,
    fallbackThought:
      currentThoughtPreview ||
      currentSummaryPreview ||
      activeCommitmentSummary ||
      currentContext,
    game,
    playback: snapshot.rowanPlayback,
    quietStatusLabel: game.currentScene.title,
  });
  const latestRailConversation = railConversationLines.at(-1);
  const railConversationTimestamp =
    railActiveConversation?.updatedAt ??
    railConversationThread?.updatedAt ??
    latestRailConversation?.time;
  const commandRailPreserveScrollKey = buildCommandRailPreserveScrollKey({
    game,
    selectedNpcId: selectedNpc?.id ?? null,
  });
  const hasConversationFocus = Boolean(
    selectedNpc &&
    (selectedActiveConversation ||
      selectedConversationThread ||
      railConversationLines.length > 0 ||
      selectedTalkAction),
  );
  const nearbyNames = nearbyNpcs.slice(0, 3).map((npc) => npc.name);
  const visualMovePending = Boolean(snapshot.optimisticPlayerPosition);
  const canAdvanceObjectiveManually =
    (!game.activeConversation || Boolean(game.rowanAutonomy?.autoContinue)) &&
    (!isBlockingRowanPlayback(snapshot.rowanPlayback) ||
      conversationCanAdvanceDuringReplay) &&
    (!conversationReplayActive || conversationCanAdvanceDuringReplay) &&
    !visualMovePending;
  const showPrimaryContinue =
    canAdvanceObjectiveManually &&
    rowanAutonomy.autoContinue &&
    !snapshot.busyLabel;
  const activeConversationContinueLabel = rowanAutonomy.label.startsWith(
    "With ",
  )
    ? `Finish with ${rowanAutonomy.label.slice("With ".length)}`
    : "Continue conversation";
  const primaryContinueLabel = snapshot.rowanAutoplayEnabled
    ? "Continue Now"
    : game.activeConversation
      ? activeConversationContinueLabel
      : rowanAutonomy.label || "Continue";
  const primaryContinueCopy = game.activeConversation
    ? "Let the conversation land."
    : rowanAutonomy.mode === "moving"
      ? "Move Rowan there."
      : rowanAutonomy.mode === "waiting"
        ? "Let the clock pass."
        : rowanAutonomy.mode === "conversation"
          ? "Start the conversation."
          : "Do this step.";
  const conversationEntry = selectedNpc
    ? {
        id: `conversation-${selectedNpc.id}`,
        meta: selectedActiveConversation
          ? "Conversation active"
          : conversationThreadHasOutcome(selectedConversationThread)
            ? `Conversation finished • ${formatClock(
                railConversationTimestamp ??
                  selectedConversationThread?.updatedAt ??
                  latestRailConversation?.time ??
                  game.currentTime,
              )}`
            : railConversationTimestamp
              ? `Conversation • ${formatClock(
                  railConversationTimestamp,
                )}`
              : selectedTalkAction
                ? "Rowan can talk here"
                : "People nearby",
        text: buildNarrativePreview(
          joinNarrativeFragments([
            conversationThreadHasOutcome(selectedConversationThread)
              ? selectedConversationThread?.decision ??
                selectedConversationThread?.objectiveText ??
                selectedConversationThread?.summary
              : latestRailConversation
                ? `${latestRailConversation.speaker === "player" ? game.player.name : latestRailConversation.speakerName}: ${latestRailConversation.text}`
                : selectedTalkAction
                  ? `${selectedNpc.name} is close enough to talk to. Rowan can start the conversation here.`
                  : `${selectedNpc.name} is nearby, but Rowan has not started a real conversation with them yet.`,
            conversationThreadHasOutcome(selectedConversationThread) &&
            latestRailConversation
              ? `${latestRailConversation.speaker === "player" ? game.player.name : latestRailConversation.speakerName}: ${latestRailConversation.text}`
              : undefined,
          ]),
          168,
        ),
        title: conversationThreadHasOutcome(selectedConversationThread)
          ? `Finished with ${selectedNpc.name}`
          : `With ${selectedNpc.name}`,
        tone: selectedActiveConversation
          ? "conversation"
          : conversationThreadHasOutcome(selectedConversationThread)
            ? "objective"
            : latestRailConversation
              ? latestRailConversation.speaker === "player"
                ? "objective"
                : "conversation"
              : "scene",
        actionCopy:
          !latestRailConversation && selectedTalkAction
            ? `Start a conversation with ${selectedNpc.name}.`
            : undefined,
        actionId:
          !latestRailConversation && selectedTalkAction
            ? selectedTalkAction.id
            : undefined,
        actionLabel:
          !latestRailConversation && selectedTalkAction
            ? `Start conversation with ${selectedNpc.name}`
            : undefined,
      }
    : fallbackConversationNpc && fallbackConversationThread
      ? {
          id: `last-thread-${fallbackConversationNpc.id}`,
          meta: `Last conversation • ${formatClock(
            fallbackConversationThread.updatedAt,
          )}`,
          text: buildNarrativePreview(
            joinNarrativeFragments([
              fallbackConversationThread.decision ??
                fallbackConversationThread.objectiveText ??
                fallbackConversationThread.summary,
              fallbackConversationThread.lines.at(-1)
                ? `${fallbackConversationThread.lines.at(-1)?.speaker === "player" ? game.player.name : fallbackConversationThread.lines.at(-1)?.speakerName}: ${fallbackConversationThread.lines.at(-1)?.text}`
                : undefined,
            ]),
            168,
          ),
          title: `Finished with ${fallbackConversationNpc.name}`,
          tone: "objective",
        }
      : {
          id: "social-read",
          meta: "People nearby",
          text:
            nearbyNames.length > 0
                ? `${formatNameList(nearbyNames)} ${
                  nearbyNames.length === 1 ? "is" : "are"
                } nearby, but Rowan has not started a real conversation yet.`
              : "No one nearby has opened into a real conversation yet.",
          title: "People nearby",
          tone: "scene",
        };
  const showConversationRail = Boolean(
    rowanRail.useConversationTranscript && railConversationNpc && railActiveConversation,
  );
  const conversationRailHtml =
    railConversationNpc && showConversationRail
      ? buildConversationPanelHtml({
          conversationDecision:
            railActiveConversation?.decision ?? railConversationThread?.decision,
          conversationLines: railConversationLines,
          conversationLocationId:
            railActiveConversation?.locationId ?? railConversationThread?.locationId,
          conversationObjectiveText:
            railActiveConversation?.objectiveText ??
            railConversationThread?.objectiveText,
          conversationSummary: railConversationThread?.summary,
          conversationUpdatedAt:
            railActiveConversation?.updatedAt ?? railConversationThread?.updatedAt,
          currentObjectiveText,
          currentThought,
          isLiveConversation: Boolean(railActiveConversation),
          mode: "rail",
          npc: railConversationNpc,
          replay: runtimeState.conversationReplay,
          snapshot,
          startAction: undefined,
          threadObjectiveStillCurrent:
            Boolean(railActiveConversation) ||
            rowanAutonomy.npcId === railConversationNpc.id ||
            (Boolean(rowanAutonomy.targetLocationId) &&
              rowanAutonomy.targetLocationId ===
                (railActiveConversation?.locationId ??
                  railConversationThread?.locationId)),
          talkableNpcIds,
          willCarryForward:
            railConversationNpc.id === selectedNpc?.id
              ? conversationWillCarryForward
              : false,
          willAutostart: false,
        })
      : "";
  const availableActionsForRail =
    hasConversationFocus && selectedTalkAction
      ? actions.filter((action) => action.id !== selectedTalkAction.id)
      : actions;
  const secondaryActions = availableActionsForRail.slice(
    0,
    width <= 1080 ? 4 : 5,
  );
  const rowanFeedEntries = hasConversationFocus
    ? []
    : feedPreview.map((entry) => ({
        id: entry.id,
        meta: `${formatClock(entry.time)} • ${feedToneLabel(entry.tone)}`,
        text: buildNarrativePreview(entry.text, 148),
        tone: entry.tone,
      }));
  const railContextEntries = [
    ...(currentSummaryPreview && currentSummaryPreview !== rowanRail.thought
      ? [
          {
            id: "context",
            label: "Context",
            text: currentSummaryPreview,
            tone: "info",
          },
        ]
      : []),
    ...(sceneRead
      ? [
          {
            id: "scene",
            label: "Scene",
            text: sceneRead,
            title: game.currentScene.title,
            tone:
              quickSceneNotes[0]?.tone === "warning"
                ? "problem"
                : quickSceneNotes[0]?.tone === "lead"
                  ? "objective"
                  : "scene",
          },
        ]
      : []),
    ...(!showConversationRail
      ? [
          {
            id: conversationEntry.id,
            label: conversationEntry.meta,
            text: conversationEntry.text,
            title: conversationEntry.title,
            tone: conversationEntry.tone,
          },
        ]
      : []),
    ...rowanFeedEntries.map((entry) => ({
      id: entry.id,
      label: entry.meta,
      text: entry.text,
      tone: entry.tone,
    })),
  ];
  const showManualTimeControls =
    !railActiveConversation && !isBlockingRowanPlayback(snapshot.rowanPlayback);
  const hasRailMore =
    railContextEntries.length > 0 ||
    secondaryActions.length > 0 ||
    (showManualTimeControls && waitOptions.length > 0);
  const railMoreSummary = [
    railContextEntries.length > 0
      ? `${railContextEntries.length} context note${
          railContextEntries.length === 1 ? "" : "s"
        }`
      : null,
    secondaryActions.length > 0
      ? `${secondaryActions.length} more move${
          secondaryActions.length === 1 ? "" : "s"
        }`
      : null,
    showManualTimeControls && waitOptions.length > 0 ? "time controls" : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const railStatusLabel = rowanRail.statusLabel;
  const railPeekLabel = rowanRail.peekLabel;
  const railThought = buildNarrativePreview(rowanRail.thought, 120);
  const browserProbeJson = buildStreetBrowserProbeJson({
    activeConversation: railActiveConversation,
    conversationNpcName: railConversationNpc?.name,
    game,
    rowanRail,
    snapshot,
  });
  const dockActiveTab = focusPanel ?? "actions";
  const clockLabel = formatClock(game.currentTime);
  const todoCounterLabel =
    game.player.objective?.progress?.label ??
    `${objectivePlanItems.length} open tasks`;
  const compactRailCollapsedHeight = railViewport === "phone" ? 88 : 104;
  const compactRailExpandedHeight =
    railViewport === "phone"
      ? Math.max(320, Math.min(Math.round(height * 0.58), height - 152))
      : Math.max(340, Math.min(Math.round(height * 0.56), height - 160));
  const compactRailWidth =
    railViewport === "phone"
      ? Math.max(width - overlayInset * 2, 280)
      : Math.min(Math.max(width * 0.4, 320), 360);
  const compactRailBottomOffset = railViewport === "phone" ? 148 : 168;
  return `
    ${buildStreetOverlayStyle({
      compactRailBottomOffset,
      compactRailCollapsedHeight,
      compactRailExpandedHeight,
      compactRailWidth,
      dockFocusWidth,
      dockWidth,
      focusHeight,
      focusWidth,
      height,
      overlayInset,
      railMaxHeight,
      railWidth,
      width,
    })}
    <div
      class="ml-root ${railViewport !== "desktop" ? "is-collapsible-rail" : ""} ${
        railViewport === "phone" ? "is-phone-rail" : ""
      } ${railExpanded ? "is-rail-expanded" : "is-rail-collapsed"}"
    >
      ${buildMapEdgeCuesHtml(overlaySceneViewport)}
      <div class="ml-time-pill">
        <span class="ml-time-chip">Day ${escapeHtml(String(game.clock.day))}</span>
        <span class="ml-time-chip is-core">
          <strong>${escapeHtml(clockLabel)}</strong>
          <em>${escapeHtml(game.clock.label)}</em>
        </span>
        <span class="ml-time-chip is-metric">$${escapeHtml(String(game.player.money))}</span>
        <span class="ml-time-chip is-metric">${escapeHtml(String(game.player.energy))} energy</span>
        <span class="ml-time-chip is-metric">${escapeHtml(todoCounterLabel)}</span>
      </div>
      <div class="ml-dock">
        ${
          focusPanel && focusMeta
            ? `
            <div class="ml-panel ml-inline-focus-window">
              <div class="ml-focus-header">
                <div class="ml-focus-copy">
                  <div class="ml-kicker">${escapeHtml(focusMeta.kicker)}</div>
                  <div class="ml-focus-title">${escapeHtml(focusMeta.title)}</div>
                  <div class="ml-footer-copy">${escapeHtml(focusMeta.subtitle)}</div>
                </div>
                <div class="ml-focus-controls">
                  <div class="ml-focus-nav">
                    ${buildTabButton("people", focusPanel === "people", "ml-focus-tab")}
                    ${buildTabButton("journal", focusPanel === "journal", "ml-focus-tab")}
                    ${buildTabButton("mind", focusPanel === "mind", "ml-focus-tab")}
                  </div>
                  <button class="ml-focus-close" data-close-focus="true" type="button">
                    Close
                  </button>
                </div>
              </div>
              <div class="ml-focus-body" data-preserve-scroll="focus-body">${focusContent}</div>
            </div>
          `
            : ""
        }
        <div class="ml-panel ml-dock-panel">
          <div class="ml-kicker">Controls</div>
          <div class="ml-dock-identity">
            <div class="ml-dock-identity-copy">
              <div class="ml-dock-identity-kicker">You are</div>
              <div class="ml-dock-identity-name">${escapeHtml(game.player.name)}</div>
            </div>
            <div class="ml-dock-identity-badge">Main Perspective</div>
          </div>
          <div class="ml-dock-row">
            ${buildTabButton("actions", dockActiveTab === "actions", "ml-dock-button")}
            ${buildTabButton("people", dockActiveTab === "people", "ml-dock-button")}
            ${buildTabButton("journal", dockActiveTab === "journal", "ml-dock-button")}
            ${buildTabButton("mind", dockActiveTab === "mind", "ml-dock-button")}
          </div>
          <div class="ml-dock-copy">${escapeHtml(
            focusMeta?.subtitle ??
              upcomingCommitmentLabel ??
              "Scroll or drag the map to look around. Click a street tile to move, or open People, Journal, and Mind for details.",
          )}</div>
        </div>
      </div>

      <div
        class="ml-right-stack"
        data-rail-state="${railExpanded ? "expanded" : "collapsed"}"
        data-rail-viewport="${railViewport}"
      >
        <div class="ml-panel ml-rail-shell">
          <div class="ml-rail-head">
            <div class="ml-rail-head-copy">
              <div class="ml-kicker">${escapeHtml(game.cityName)} • ${escapeHtml(
                game.districtName,
              )}</div>
              <div class="ml-rail-heading-row">
                <div class="ml-rail-name">${escapeHtml(game.player.name)}</div>
                <div class="ml-rail-status">${escapeHtml(railStatusLabel)}</div>
              </div>
              <div class="ml-rail-peek-label">${escapeHtml(railPeekLabel)}</div>
              <div class="ml-rail-thought">${escapeHtml(railThought)}</div>
            </div>
            ${
              railViewport !== "desktop"
                ? `
                <button
                  class="ml-rail-toggle"
                  data-toggle-rail="true"
                  aria-expanded="${railExpanded ? "true" : "false"}"
                  type="button"
                >
                  ${railExpanded ? "Collapse" : "Open"}
                </button>
              `
                : ""
            }
          </div>
          <div
            class="ml-command-rail"
            data-preserve-scroll="command-rail"
            data-preserve-scroll-key="${escapeHtml(
              commandRailPreserveScrollKey,
            )}"
            data-rail-root="rowan"
          >
            <div class="ml-command-rail-body">
              ${buildRowanStoryCardHtml("Now", rowanRail.now, true)}
              ${
                showPrimaryContinue
                  ? `
                  <button
                    class="ml-primary-action"
                    data-advance-objective="true"
                    type="button"
                  >
                    <span class="ml-primary-action-label">${escapeHtml(
                      primaryContinueLabel,
                    )}</span>
                    <span class="ml-primary-action-copy">${escapeHtml(
                      primaryContinueCopy,
                    )}</span>
                  </button>
                `
                  : snapshot.rowanAutoplayEnabled && rowanAutonomy.autoContinue
                    ? `<div class="ml-autoplay-note">${escapeHtml(
                        "Autoplay is on. Remove autoplay=1 if you want to step through manually.",
                      )}</div>`
                    : ""
              }
              ${
                rowanRail.next
                  ? buildRowanStoryCardHtml("Next", rowanRail.next)
                  : ""
              }

              ${conversationRailHtml}

              ${
                rowanRail.justHappened
                  ? buildRowanStoryCardHtml(
                      "Just happened",
                      rowanRail.justHappened,
                    )
                  : ""
              }

              ${
                hasRailMore
                  ? `
                  <div class="ml-rail-more ${supportExpanded ? "is-open" : ""}">
                    <button
                      class="ml-rail-more-toggle"
                      data-toggle-support="true"
                      aria-expanded="${supportExpanded ? "true" : "false"}"
                      type="button"
                    >
                      <div class="ml-rail-more-copy">
                        <div class="ml-kicker">More</div>
                        <div class="ml-rail-more-title">Context and tools</div>
                        ${
                          railMoreSummary
                            ? `<div class="ml-footer-copy">${escapeHtml(
                                railMoreSummary,
                              )}</div>`
                            : ""
                        }
                      </div>
                      <div class="ml-rail-more-state">${
                        supportExpanded ? "Hide" : "Open"
                      }</div>
                    </button>
                    <div class="ml-rail-more-body">
                      ${
                        railContextEntries.length > 0
                          ? `
                          <div class="ml-rail-context-list">
                            ${railContextEntries
                              .map(
                                (entry) => `
                                <div class="ml-rail-context-row" data-tone="${escapeHtml(
                                  entry.tone,
                                )}">
                                  <div class="ml-rail-context-label">${escapeHtml(
                                    entry.label,
                                  )}</div>
                                  ${
                                    "title" in entry && entry.title
                                      ? `<div class="ml-rail-context-title">${escapeHtml(
                                          entry.title,
                                        )}</div>`
                                      : ""
                                  }
                                  <div class="ml-rail-context-copy">${escapeHtml(
                                    entry.text,
                                  )}</div>
                                </div>
                              `,
                              )
                              .join("")}
                          </div>
                        `
                          : ""
                      }

                      ${
                        secondaryActions.length > 0
                          ? `
                          <div class="ml-command-section">
                            <div class="ml-kicker">Moves</div>
                            ${secondaryActions
                              .map(
                                (action) => `
                                <button
                                  class="ml-button"
                                  data-action-id="${escapeHtml(action.id)}"
                                  data-action-label="${escapeHtml(action.label)}"
                                  data-tone="${escapeHtml(action.emphasis)}"
                                  ${snapshot.busyLabel || visualMovePending || action.disabled ? "disabled" : ""}
                                  type="button"
                                >
                                  <div class="ml-button-title">${escapeHtml(
                                    action.label,
                                  )}</div>
                                  <div class="ml-button-copy">${escapeHtml(
                                    action.description,
                                  )}</div>
                                  ${
                                    action.disabledReason
                                      ? `<div class="ml-button-copy" style="color: rgba(246, 198, 193, 0.92);">${escapeHtml(
                                          action.disabledReason,
                                        )}</div>`
                                      : ""
                                  }
                                </button>
                              `,
                              )
                              .join("")}
                          </div>
                        `
                          : ""
                      }

                      ${
                        showManualTimeControls
                          ? `
                        <div class="ml-command-section">
                          <div class="ml-kicker">Spend Time</div>
                          <div class="ml-controls">
                            ${waitOptions
                              .map(
                                (option) => `
                                <button
                                  class="ml-control"
                                  data-wait-minutes="${option.minutes}"
                                  data-wait-label="${escapeHtml(option.busyLabel)}"
                                  ${snapshot.busyLabel || visualMovePending ? "disabled" : ""}
                                  type="button"
                                >
                                  ${escapeHtml(option.label)}
                                </button>
                              `,
                              )
                              .join("")}
                          ${
                            canAdvanceObjectiveManually
                              ? `<button
                                  class="ml-control"
                                  data-advance-objective="true"
                                  ${snapshot.busyLabel || visualMovePending ? "disabled" : ""}
                                  type="button"
                                >
                                  Continue Now
                                </button>`
                              : ""
                          }
                        </div>
                          <div class="ml-footer-copy">${escapeHtml(
                            rowanAutonomy.autoContinue
                              ? "Autoplay is on. Use these controls to jump ahead or choose a different move."
                              : upcomingCommitmentLabel ??
                                  "Use time controls when Rowan is waiting, or click the street to move.",
                          )}</div>
                        </div>
                      `
                          : ""
                      }
                    </div>
                  </div>
                `
                  : ""
              }

              ${
                snapshot.busyLabel
                  ? `<div class="ml-footer-copy">${escapeHtml(
                      snapshot.busyLabel,
                    )}</div>`
                  : ""
              }
              ${
                snapshot.error
                  ? `<div class="ml-error">${escapeHtml(snapshot.error)}</div>`
                  : ""
              }
              <script id="ml-browser-probe" type="application/json">${browserProbeJson}</script>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildWaitOptions(
  currentTotalMinutes: number,
  upcomingCommitmentMinutes?: number,
) {
  return buildClockAdvanceOptions({
    currentTotalMinutes,
    upcomingCommitmentMinutes,
  });
}

function totalMinutesForDayHour(day: number, hour: number) {
  return Math.max(0, day - 1) * 24 * 60 + hour * 60;
}

function buildClockAdvanceOptions({
  currentTotalMinutes,
  upcomingCommitmentMinutes,
}: {
  currentTotalMinutes: number;
  upcomingCommitmentMinutes?: number;
}) {
  const options: ClockAdvanceOption[] = [
    {
      busyLabel: "Waiting 2 minutes...",
      key: "increment-2",
      kind: "increment",
      label: "+2m",
      minutes: 2,
    },
    {
      busyLabel: "Waiting 5 minutes...",
      key: "increment-5",
      kind: "increment",
      label: "+5m",
      minutes: 5,
    },
    {
      busyLabel: "Waiting 10 minutes...",
      key: "increment-10",
      kind: "increment",
      label: "+10m",
      minutes: 10,
    },
    {
      busyLabel: "Waiting 20 minutes...",
      key: "increment-20",
      kind: "increment",
      label: "+20m",
      minutes: 20,
    },
  ];

  if (
    upcomingCommitmentMinutes !== undefined &&
    upcomingCommitmentMinutes > currentTotalMinutes
  ) {
    const minutesUntilCommitment =
      upcomingCommitmentMinutes - currentTotalMinutes;
    options.unshift({
      busyLabel: `Waiting until ${formatClock(
        isoForTotalMinutes(upcomingCommitmentMinutes),
      )}...`,
      key: `target-${upcomingCommitmentMinutes}`,
      kind: "target",
      label: `To ${formatClock(isoForTotalMinutes(upcomingCommitmentMinutes))}`,
      minutes: minutesUntilCommitment,
    });
  }

  const seenMinutes = new Set<number>();
  return options.filter((option) => {
    if (option.minutes <= 0 || seenMinutes.has(option.minutes)) {
      return false;
    }

    seenMinutes.add(option.minutes);
    return true;
  });
}

function isoForTotalMinutes(totalMinutes: number) {
  const timestamp =
    new Date(STREET_SIM_BASE_DAY).getTime() + totalMinutes * 60_000;
  return new Date(timestamp).toISOString();
}

function formatJobWindow(day: number, startHour: number, endHour: number) {
  const dayOffsetMinutes = (day - 1) * 24 * 60;
  const start = formatClock(
    isoForTotalMinutes(dayOffsetMinutes + startHour * 60),
  );
  const end = formatClock(isoForTotalMinutes(dayOffsetMinutes + endHour * 60));
  return `${start} to ${end}`;
}

function syncPendingConversationState(
  runtimeState: RuntimeState,
  game: StreetGameState,
  autonomyNpcId: string | null,
) {
  const nextPendingConversation = resolvePendingConversationTarget({
    autonomyNpcId,
    npcIds: game.npcs.map((npc) => npc.id),
    pendingNpcId: runtimeState.ui.pendingConversationNpcId,
    pendingSource: runtimeState.ui.pendingConversationSource,
    selectedNpcId: runtimeState.ui.selectedNpcId,
  });

  if (
    nextPendingConversation.npcId &&
    nextPendingConversation.source &&
    getConversationPreview(game, nextPendingConversation.npcId).length === 0
  ) {
    setPendingConversation(
      runtimeState,
      nextPendingConversation.npcId,
      nextPendingConversation.source,
    );
    return;
  }

  clearPendingConversation(runtimeState);
}

function syncUiState(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  const nextDefaultNpcId = pickDefaultSelectedNpcId(game);
  const autonomyNpcId = game?.rowanAutonomy?.autoContinue
    ? game.rowanAutonomy.npcId ?? null
    : null;
  const shouldAutoOpenRail = game
    ? buildRowanRailViewModel({
        conversationReplayActive:
          runtimeState.conversationReplay.isReplaying ||
          Boolean(runtimeState.conversationReplay.streamingEntryId) ||
          Boolean(runtimeState.conversationReplay.streamPauseActor),
        fallbackThought: "",
        game,
        playback: runtimeState.snapshot.rowanPlayback,
        quietStatusLabel: game.currentScene.title,
      }).shouldAutoOpen
    : false;
  const collapsibleRailViewport = isCollapsibleRailViewport(
    runtimeState.snapshot.viewport,
  );

  if (!game) {
    runtimeState.ui.selectedNpcId = null;
    runtimeState.ui.activeTab = "actions";
    runtimeState.ui.focusPanel = null;
    clearPendingConversation(runtimeState);
    runtimeState.ui.railExpanded = !collapsibleRailViewport;
    return;
  }

  if (!collapsibleRailViewport) {
    runtimeState.ui.railExpanded = true;
  }

  if (game.activeConversation?.npcId) {
    if (collapsibleRailViewport && !runtimeState.ui.railExpanded) {
      runtimeState.ui.railExpanded = true;
    }
    runtimeState.ui.selectedNpcId = game.activeConversation.npcId;
    if (runtimeState.ui.focusPanel !== "people") {
      runtimeState.ui.activeTab = "actions";
      runtimeState.ui.focusPanel = null;
    }
  } else {
    runtimeState.ui.selectedNpcId = resolveRowanRailNpcSelection({
      game,
      preserveSelectedNpc: runtimeState.ui.focusPanel === "people",
      selectedNpcId: runtimeState.ui.selectedNpcId,
    });
  }

  if (
    runtimeState.ui.selectedNpcId &&
    !game.npcs.some((npc) => npc.id === runtimeState.ui.selectedNpcId)
  ) {
    runtimeState.ui.selectedNpcId = null;
  }

  if (
    !runtimeState.ui.selectedNpcId &&
    (!game.rowanAutonomy?.autoContinue ||
      runtimeState.ui.focusPanel === "people")
  ) {
    runtimeState.ui.selectedNpcId = nextDefaultNpcId;
  }

  if (
    collapsibleRailViewport &&
    shouldAutoOpenRail &&
    !runtimeState.ui.railExpanded
  ) {
    runtimeState.ui.railExpanded = true;
  }

  if (
    collapsibleRailViewport &&
    runtimeState.snapshot.rowanAutoplayEnabled &&
    !game.activeConversation &&
    !runtimeState.ui.focusPanel &&
    !runtimeState.ui.supportExpanded &&
    !shouldAutoOpenRail &&
    game.rowanAutonomy?.autoContinue &&
    (game.rowanAutonomy.mode === "moving" ||
      game.rowanAutonomy.mode === "waiting")
  ) {
    runtimeState.ui.railExpanded = false;
  }

  syncPendingConversationState(runtimeState, game, autonomyNpcId);

  if (
    runtimeState.ui.focusPanel &&
    runtimeState.ui.focusPanel !== "people" &&
    runtimeState.ui.activeTab === "actions"
  ) {
    runtimeState.ui.focusPanel = null;
  }
}

function maybeAutostartConversation(
  runtimeState: RuntimeState,
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>,
) {
  const game = runtimeState.snapshot.game;
  if (
    !game ||
    !runtimeState.snapshot.rowanAutoplayEnabled ||
    runtimeState.snapshot.busyLabel ||
    game.activeConversation ||
    isBlockingRowanPlayback(runtimeState.snapshot.rowanPlayback)
  ) {
    clearConversationAutostartTimer(runtimeState);
    return;
  }

  const selectedNpc = getSelectedNpc(runtimeState);
  const autoStartPlan = resolveConversationAutostartPlan({
    game,
    pendingNpcId: runtimeState.ui.pendingConversationNpcId,
    pendingSource: runtimeState.ui.pendingConversationSource,
    selectedNpcId: selectedNpc?.id ?? null,
  });
  const currentAutoStartKey = autoStartPlan?.autoStartKey ?? null;
  if (
    runtimeState.autoStartedConversationKey &&
    runtimeState.autoStartedConversationKey !== currentAutoStartKey
  ) {
    runtimeState.autoStartedConversationKey = null;
  }

  if (!selectedNpc || !autoStartPlan) {
    clearConversationAutostartTimer(runtimeState);
    return;
  }
  const autoStartKey = autoStartPlan.autoStartKey;

  if (runtimeState.autoStartedConversationKey === autoStartKey) {
    clearConversationAutostartTimer(runtimeState);
    return;
  }

  if (
    runtimeState.pendingConversationAutostartNpcId === selectedNpc.id &&
    runtimeState.conversationAutostartTimerId !== null
  ) {
    return;
  }

  clearConversationAutostartTimer(runtimeState);
  runtimeState.pendingConversationAutostartNpcId = selectedNpc.id;
  runtimeState.conversationAutostartTimerId = window.setTimeout(() => {
    const activeGame = runtimeState.snapshot.game;
    const nextAutoStartPlan = activeGame
      ? resolveConversationAutostartPlan({
          game: activeGame,
          pendingNpcId: runtimeState.ui.pendingConversationNpcId,
          pendingSource: runtimeState.ui.pendingConversationSource,
          selectedNpcId: runtimeState.ui.selectedNpcId,
        })
      : null;
    const activeSelectedNpc = getSelectedNpc(runtimeState);
    if (
      !activeGame ||
      runtimeState.snapshot.busyLabel ||
      activeGame.activeConversation ||
      isBlockingRowanPlayback(runtimeState.snapshot.rowanPlayback) ||
      !nextAutoStartPlan ||
      nextAutoStartPlan.autoStartKey !== autoStartKey ||
      !activeSelectedNpc ||
      activeSelectedNpc.id !== selectedNpc.id ||
      activeSelectedNpc.currentLocationId !==
        activeGame.player.currentLocationId
    ) {
      clearConversationAutostartTimer(runtimeState);
      if (runtimeState.objects) {
        renderOverlay(runtimeState.objects, runtimeState);
      }
      return;
    }

    runtimeState.autoStartedConversationKey = autoStartKey;
    clearPendingConversation(runtimeState);
    runtimeState.ui.activeTab = "actions";
    runtimeState.ui.focusPanel = null;
    if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
      runtimeState.ui.railExpanded = true;
    }
    clearConversationAutostartTimer(runtimeState);
    callbacksRef.current.onAction(
      nextAutoStartPlan.talkActionId,
      `Starting conversation with ${activeSelectedNpc.name}`,
    );
  }, ROWAN_PLAYBACK_TIMING_MS.preConversationPause);

  if (runtimeState.objects) {
    renderOverlay(runtimeState.objects, runtimeState);
  }
}

function createCameraEdgeCueState(): Record<CameraEdgeName, number> {
  return {
    east: 0,
    north: 0,
    south: 0,
    west: 0,
  };
}

function pulseCameraEdgeCue(
  runtimeState: RuntimeState,
  blockedEdges: CameraEdgeState,
  now = getRuntimeNow(),
) {
  for (const edge of CAMERA_EDGE_CUE_NAMES) {
    if (blockedEdges[edge]) {
      runtimeState.cameraEdgeCue[edge] = now;
    }
  }
}

function syncCameraEdgeCues(
  root: HTMLElement,
  runtimeState: RuntimeState,
  sceneViewport: SceneViewport,
  now: number,
) {
  const container = root.querySelector<HTMLElement>(
    '[data-map-edge-cues="true"]',
  );
  if (!container) {
    return;
  }

  container.style.left = `${Math.round(sceneViewport.x)}px`;
  container.style.top = `${Math.round(sceneViewport.y)}px`;
  container.style.width = `${Math.round(sceneViewport.width)}px`;
  container.style.height = `${Math.round(sceneViewport.height)}px`;

  for (const edge of CAMERA_EDGE_CUE_NAMES) {
    const cue = container.querySelector<HTMLElement>(
      `[data-map-edge-cue="${edge}"]`,
    );
    if (!cue) {
      continue;
    }

    const opacity = getCameraEdgeCueOpacity(
      runtimeState.cameraEdgeCue[edge],
      now,
    );
    cue.style.opacity = opacity > 0 ? opacity.toFixed(3) : "0";
    cue.dataset.active = opacity > 0.05 ? "true" : "false";
  }
}

function getCameraEdgeCueOpacity(startedAt: number, now: number) {
  if (startedAt <= 0) {
    return 0;
  }

  const elapsed = now - startedAt;
  if (elapsed < 0 || elapsed > CAMERA_EDGE_CUE_DURATION_MS) {
    return 0;
  }

  const progress = 1 - elapsed / CAMERA_EDGE_CUE_DURATION_MS;
  return Math.min(Math.pow(progress, 1.35) * 0.92, 0.92);
}

function buildMapEdgeCuesHtml(sceneViewport: SceneViewport) {
  return `
    <div
      class="ml-map-edge-cues"
      data-map-edge-cues="true"
      aria-hidden="true"
      style="left: ${Math.round(sceneViewport.x)}px; top: ${Math.round(
        sceneViewport.y,
      )}px; width: ${Math.round(sceneViewport.width)}px; height: ${Math.round(
        sceneViewport.height,
      )}px;"
    >
      ${CAMERA_EDGE_CUE_NAMES.map(
        (edge) =>
          `<div class="ml-map-edge-cue is-${edge}" data-map-edge-cue="${edge}"></div>`,
      ).join("")}
    </div>
  `;
}

function getOverlaySceneViewport(runtimeState: RuntimeState): SceneViewport {
  return getSceneViewport(
    runtimeState.snapshot.viewport,
    getWorldBounds(runtimeState.snapshot),
    runtimeState.snapshot.viewport,
  );
}

function getPlayableVisualScene(game: StreetGameState | null) {
  if (!game) {
    return null;
  }

  const sceneId = game.visualSceneId ?? null;
  const visualScene = getVisualScene(sceneId);
  if (!visualScene) {
    return null;
  }

  try {
    validateVisualSceneAgainstGame(visualScene, game);
    return visualScene;
  } catch (error) {
    const fallbackScene = getVisualSceneDocument(sceneId);
    if (fallbackScene && fallbackScene !== visualScene) {
      validateVisualSceneAgainstGame(fallbackScene, game);
      console.warn(
        `[many-lives] Falling back to file visual scene for ${sceneId} because the runtime override is invalid.`,
        error,
      );
      return fallbackScene;
    }

    throw error;
  }
}

function normalizeCameraWheelDelta(
  deltaX: number,
  deltaY: number,
  event: WheelEvent | undefined,
  sceneViewport: SceneViewport,
): Point {
  const deltaMode = event?.deltaMode ?? 0;
  const modeMultiplier =
    deltaMode === 1
      ? 18
      : deltaMode === 2
        ? Math.min(sceneViewport.height * 0.82, 520)
        : 1;
  let panX = deltaX * modeMultiplier;
  let panY = deltaY * modeMultiplier;

  if (event?.shiftKey && Math.abs(panX) < Math.abs(panY) * 0.5) {
    panX = panY;
    panY = 0;
  }

  return {
    x: clamp(
      panX * CAMERA_WHEEL_PAN_SENSITIVITY,
      -CAMERA_WHEEL_PAN_MAX_DELTA,
      CAMERA_WHEEL_PAN_MAX_DELTA,
    ),
    y: clamp(
      panY * CAMERA_WHEEL_PAN_SENSITIVITY,
      -CAMERA_WHEEL_PAN_MAX_DELTA,
      CAMERA_WHEEL_PAN_MAX_DELTA,
    ),
  };
}

const BLOCKING_LANDMARK_INSET_BY_STYLE: Partial<
  Record<VisualScene["landmarks"][number]["style"], number>
> = {
  "boarding-house": 12,
  cafe: 18,
  workshop: 18,
  yard: 14,
};

const BLOCKING_LANDMARK_MODULE_KINDS = new Set([
  "entry",
  "service_bay",
  "wall_band",
]);

function buildNavigationTiles(
  game: StreetGameState,
  visualScene: VisualScene | null,
) {
  if (!visualScene) {
    return game.map.tiles;
  }

  const blockingRects = collectVisualSceneBlockingRects(visualScene);
  if (blockingRects.length === 0) {
    return game.map.tiles;
  }

  return game.map.tiles.map((tile) => {
    if (!tile.walkable) {
      return tile;
    }

    return isNavigationTileBlockedByVisualScene(
      tile,
      visualScene,
      blockingRects,
    )
      ? { ...tile, walkable: false }
      : tile;
  });
}

function collectVisualSceneBlockingRects(scene: VisualScene) {
  return [
    ...scene.landmarks
      .filter((landmark) => landmark.style in BLOCKING_LANDMARK_INSET_BY_STYLE)
      .map((landmark) =>
        insetVisualRect(
          landmark.rect,
          BLOCKING_LANDMARK_INSET_BY_STYLE[landmark.style] ?? 0,
        ),
      ),
    ...scene.landmarkModules
      .filter((module) => BLOCKING_LANDMARK_MODULE_KINDS.has(module.kind))
      .map((module) => insetVisualRect(module.rect, 8)),
  ].filter((rect) => rect.width > 1 && rect.height > 1);
}

function insetVisualRect(rect: VisualRect, inset: number): VisualRect {
  const width = Math.max(rect.width - inset * 2, 0);
  const height = Math.max(rect.height - inset * 2, 0);

  return {
    ...rect,
    height,
    radius: rect.radius ? Math.max(rect.radius - inset, 0) : rect.radius,
    width,
    x: rect.x + inset,
    y: rect.y + inset,
  };
}

function isNavigationTileBlockedByVisualScene(
  tile: MapTile,
  scene: VisualScene,
  blockingRects: VisualRect[],
) {
  const projectedPoint = projectVisualScenePoint(scene, {
    x: tile.x + 0.5,
    y: tile.y + 0.5,
  });

  return blockingRects.some((rect) =>
    pointInsideVisualRect(projectedPoint, rect),
  );
}

function pointInsideVisualRect(point: Point, rect: VisualRect) {
  return !(
    point.x < rect.x ||
    point.y < rect.y ||
    point.x > rect.x + rect.width ||
    point.y > rect.y + rect.height
  );
}

function createRuntimeIndices(snapshot: StreetAppSnapshot): RuntimeIndices {
  const game = snapshot.game;
  if (!game) {
    return {
      animatedSurfaceTiles: [],
      footprintByLocationId: new Map(),
      locationsById: new Map(),
      patrolDistanceByKey: new Map(),
      patrolPathByKey: new Map(),
      primaryDoorByLocation: new Map(),
      propsByLocation: new Map(),
      routeFinder: (start, end) => [start, end],
      visualScene: null,
      walkableRuntimePoints: [],
    };
  }

  const visualScene = getPlayableVisualScene(game);
  const navigationTiles = buildNavigationTiles(game, visualScene);

  return {
    animatedSurfaceTiles: visualScene
      ? []
      : collectAnimatedSurfaceTiles(game.map),
    footprintByLocationId: new Map(
      game.map.footprints
        .filter((footprint) => footprint.locationId)
        .map((footprint) => [footprint.locationId as string, footprint]),
    ),
    locationsById: new Map(
      game.locations.map((location) => [location.id, location]),
    ),
    patrolDistanceByKey: new Map(),
    patrolPathByKey: new Map(),
    primaryDoorByLocation: new Map(
      game.map.doors.map((door) => [door.locationId, door]),
    ),
    propsByLocation: groupPropsByLocation(game.map.props),
    routeFinder: createRouteFinder(navigationTiles),
    visualScene,
    walkableRuntimePoints: buildWalkableRuntimePoints(
      navigationTiles,
      visualScene,
    ),
  };
}

function buildWalkableRuntimePoints(
  tiles: MapTile[],
  visualScene: VisualScene | null,
): WalkableRuntimePoint[] {
  return tiles
    .filter((tile) => tile.walkable)
    .map((tile) => {
      const tileCenter = {
        x: tile.x + 0.5,
        y: tile.y + 0.5,
      };

      return {
        kind: tile.kind,
        locationId: tile.locationId,
        tile: {
          x: tile.x,
          y: tile.y,
        },
        tileCenter,
        world: visualScene
          ? projectVisualScenePoint(visualScene, tileCenter)
          : mapPointToWorld(tileCenter),
      };
    });
}

function getWorldBounds(snapshot: StreetAppSnapshot) {
  return getWorldBoundsForRuntime({
    map: snapshot.game?.map,
    viewport: snapshot.viewport,
    visualScene: snapshot.game ? getPlayableVisualScene(snapshot.game) : null,
  });
}

function getRuntimeLocationHighlightRect(
  indices: RuntimeIndices,
  locationId: string,
): VisualRect | null {
  const visualAnchors = indices.visualScene?.locationAnchors[locationId];
  if (visualAnchors) {
    return visualAnchors.highlight;
  }

  const footprint = indices.footprintByLocationId.get(locationId);
  if (!footprint) {
    return null;
  }

  const { x, y } = mapTileToWorldOrigin(footprint.x, footprint.y);
  return {
    height: footprint.height * CELL,
    radius: 26,
    width: footprint.width * CELL,
    x,
    y,
  };
}

function getRuntimeViewportSize(runtimeState: RuntimeState): ViewportSize {
  return getScaledViewportSize(
    runtimeState.snapshot.viewport,
    runtimeState.renderScale,
  );
}

function getRuntimeSceneViewport(runtimeState: RuntimeState): SceneViewport {
  return getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    getWorldBounds(runtimeState.snapshot),
    runtimeState.snapshot.viewport,
  );
}

function syncRuntimeRenderScale(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
) {
  const nextRenderScale = getRuntimeRenderScale(runtimeState.cameraZoomFactor);
  if (Math.abs(nextRenderScale - runtimeState.renderScale) < 0.01) {
    return false;
  }

  runtimeState.renderScale = nextRenderScale;
  const nextViewport = getRuntimeViewportSize(runtimeState);
  objects.scene.scale.resize(nextViewport.width, nextViewport.height);
  objects.scene.scale.setZoom(1 / nextRenderScale);
  return true;
}

function createInitialPlayerMotion(
  snapshot: StreetAppSnapshot,
  indices: RuntimeIndices,
  startedAt = getRuntimeNow(),
): PlayerMotionState {
  const point = snapshot.game
    ? {
        x: snapshot.optimisticPlayerPosition?.x ?? snapshot.game.player.x,
        y: snapshot.optimisticPlayerPosition?.y ?? snapshot.game.player.y,
      }
    : { x: 0, y: 0 };

  if (snapshot.game) {
    if (!snapshot.animatePlayerEntrance) {
      return createStaticPlayerMotion(point, startedAt);
    }

    return createPlayerEntranceMotion(
      snapshot.game,
      indices.routeFinder,
      point,
      startedAt,
    );
  }

  return createStaticPlayerMotion(point);
}

function createStaticPlayerMotion(
  point: Point,
  startedAt = getRuntimeNow(),
): PlayerMotionState {
  return {
    durationMs: 1,
    path: [point],
    startedAt,
    to: point,
  };
}

function setRuntimeWaypointTarget(
  runtimeState: RuntimeState,
  target: Point | null,
  placedAt = getRuntimeNow(),
) {
  runtimeState.waypointPlacedAt = placedAt;
  runtimeState.waypointTarget = target ? { x: target.x, y: target.y } : null;
}

function syncWaypointState(runtimeState: RuntimeState) {
  if (
    runtimeState.snapshot.waypointNonce === runtimeState.waypointAppliedNonce
  ) {
    return;
  }

  runtimeState.waypointAppliedNonce = runtimeState.snapshot.waypointNonce;
  setRuntimeWaypointTarget(
    runtimeState,
    runtimeState.snapshot.waypointTarget ?? null,
  );
}

function syncPlayerMotion(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  if (!game) {
    runtimeState.playerEntranceGameId = null;
    runtimeState.playerMotion = createInitialPlayerMotion(
      runtimeState.snapshot,
      runtimeState.indices,
    );
    setRuntimeWaypointTarget(runtimeState, null);
    return;
  }

  const now = getRuntimeNow();
  const nextPoint = {
    x: runtimeState.snapshot.optimisticPlayerPosition?.x ?? game.player.x,
    y: runtimeState.snapshot.optimisticPlayerPosition?.y ?? game.player.y,
  };

  if (runtimeState.playerEntranceGameId !== game.id) {
    runtimeState.playerMotion = runtimeState.snapshot.animatePlayerEntrance
      ? createPlayerEntranceMotion(
          game,
          runtimeState.indices.routeFinder,
          nextPoint,
          now,
        )
      : createStaticPlayerMotion(nextPoint, now);

    runtimeState.playerEntranceGameId = game.id;
    return;
  }

  if (
    runtimeState.playerMotion.to.x === nextPoint.x &&
    runtimeState.playerMotion.to.y === nextPoint.y
  ) {
    return;
  }

  const fromPoint = samplePlayerTile(runtimeState.playerMotion, now);
  const fromWorldPoint = samplePlayerWorld(runtimeState, fromPoint, now);
  const routedPoints = runtimeState.indices.routeFinder(fromPoint, nextPoint);
  const path = [fromPoint, ...routedPoints.slice(1)];
  const playerMoveMsPerTile = derivePlayerMoveMsPerTile(runtimeState);
  const durationMs =
    runtimeState.snapshot.optimisticPlayerMoveDurationMs ??
    clamp(
      Math.max(path.length - 1, 1) * playerMoveMsPerTile,
      playerMoveMsPerTile,
      PLAYER_MAX_MOVE_DURATION_MS,
    );

  runtimeState.playerMotion = {
    durationMs,
    path,
    startedAt: now,
    to: nextPoint,
    worldPath: buildPlayerMotionWorldPath(
      runtimeState,
      path,
      fromWorldPoint,
      nextPoint,
    ),
  };
}

function createPlayerEntranceMotion(
  game: StreetGameState,
  findRoute: (start: Point, end: Point) => Point[],
  target: Point,
  startedAt = getRuntimeNow(),
): PlayerMotionState {
  const entrancePath = buildPlayerEntrancePath(game, findRoute, target);

  if (entrancePath.length <= 1) {
    return createStaticPlayerMotion(target, startedAt);
  }

  const introStepMs = clamp(
    DEFAULT_PLAYER_MOVE_MS_PER_TILE * 1.12,
    DEFAULT_PLAYER_MOVE_MS_PER_TILE,
    760,
  );

  return {
    durationMs: clamp(
      Math.max(entrancePath.length - 1, 1) * introStepMs,
      introStepMs * 2,
      PLAYER_MAX_MOVE_DURATION_MS,
    ),
    path: entrancePath,
    startedAt,
    to: target,
  };
}

function buildPlayerEntrancePath(
  game: StreetGameState,
  findRoute: (start: Point, end: Point) => Point[],
  target: Point,
) {
  const westernEntry = findWesternStreetEntry(game, findRoute, target);

  if (!westernEntry) {
    return [target];
  }

  const routedPoints = findRoute(westernEntry, target);
  const path = routedPoints.length > 1 ? routedPoints : [westernEntry, target];

  return [
    { x: westernEntry.x - 1.45, y: westernEntry.y },
    { x: westernEntry.x - 0.38, y: westernEntry.y },
    ...path,
  ];
}

function findWesternStreetEntry(
  game: StreetGameState,
  findRoute: (start: Point, end: Point) => Point[],
  target: Point,
) {
  const westernRoadTiles = game.map.tiles.filter(
    (tile) =>
      tile.walkable &&
      tile.x <= 1 &&
      PLAYER_ENTRANCE_TILE_KINDS.includes(tile.kind),
  );
  const westernWalkableTiles =
    westernRoadTiles.length > 0
      ? westernRoadTiles
      : game.map.tiles.filter((tile) => tile.walkable && tile.x <= 1);

  if (westernWalkableTiles.length === 0) {
    return undefined;
  }

  let bestTile = westernWalkableTiles[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const tile of westernWalkableTiles) {
    const route = findRoute({ x: tile.x, y: tile.y }, target);
    if (!routeReachesDestination(route, target)) {
      continue;
    }

    const routeDistance = pathDistance(route);
    const verticalBias = Math.abs(tile.y - target.y) * 0.42;
    const leftBias = tile.x * 0.55;
    const publicTileBias = PLAYER_ENTRANCE_TILE_KINDS.includes(tile.kind)
      ? 0
      : 1.2;
    const score = routeDistance + verticalBias + leftBias + publicTileBias;

    if (score < bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return { x: bestTile.x, y: bestTile.y };
}

function derivePlayerMoveMsPerTile(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  if (!game) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const currentLocation = game.player.currentLocationId
    ? runtimeState.indices.locationsById.get(game.player.currentLocationId)
    : undefined;

  if (!currentLocation) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const patrolDistance = getCachedPatrolDistance(runtimeState.indices, {
    door: runtimeState.indices.primaryDoorByLocation.get(currentLocation.id),
    findRoute: runtimeState.indices.routeFinder,
    location: currentLocation,
    props: runtimeState.indices.propsByLocation.get(currentLocation.id) ?? [],
    visualHints:
      runtimeState.indices.visualScene?.locationAnchors[
        currentLocation.id
      ]?.npcStands?.filter(Boolean) ?? [],
    walkableRuntimePoints: runtimeState.indices.walkableRuntimePoints,
  });

  if (patrolDistance <= 0) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const rawMsPerTile =
    (patrolCycleSeconds(currentLocation.type) * 1000) / patrolDistance;
  return clamp(rawMsPerTile * PLAYER_MOVE_DURATION_MULTIPLIER, 300, 760);
}

function computeAnimatedNpcs(
  runtimeState: RuntimeState,
  now: number,
  playerPixel: Point,
) {
  const game = runtimeState.snapshot.game;
  if (!game) {
    return [];
  }

  const animationBeat = now / 1000;
  const rawNpcs = game.npcs.map((npc, index) =>
    buildAnimatedNpcState({
      animationBeat,
      game,
      index,
      indices: runtimeState.indices,
      npc,
    }),
  );

  return resolveCrowdPositions(rawNpcs, playerPixel);
}

function buildAnimatedNpcState({
  animationBeat,
  game,
  index,
  indices,
  npc,
}: {
  animationBeat: number;
  game: StreetGameState;
  index: number;
  indices: RuntimeIndices;
  npc: NpcState;
}): AnimatedNpcState {
  const location = indices.locationsById.get(npc.currentLocationId);

  if (!location) {
    return {
      facing: 1,
      known: npc.known,
      npc,
      step: 0,
      ...mapTileToWorldCenter(0, 0),
    };
  }

  const personality = npcPersonalityProfile(npc);
  const currentHour = game.clock.hour + game.clock.minute / 60;
  const nextLocation = nextScheduledLocation(
    npc,
    currentHour,
    indices.locationsById,
  );
  const authoredPatrolPath = buildAuthoredNpcPatrolPath(
    indices.visualScene,
    location.id,
  );
  const patrolPath = getCachedPatrolPath(indices, {
    door: indices.primaryDoorByLocation.get(location.id),
    findRoute: indices.routeFinder,
    location,
    nextLocation,
    props: indices.propsByLocation.get(location.id) ?? [],
    visualHints:
      indices.visualScene?.locationAnchors[location.id]?.npcStands?.filter(
        Boolean,
      ) ?? [],
    walkableRuntimePoints: indices.walkableRuntimePoints,
  });
  const effectivePatrolPath = authoredPatrolPath ?? patrolPath;
  const phaseOffset = ((hashString(npc.id) + index * 17) % 997) / 997;
  const cycleSeconds = patrolCycleSeconds(location.type);
  const progress = positiveModulo(
    (animationBeat * personality.pace) / cycleSeconds +
      phaseOffset +
      game.clock.totalMinutes * 0.021 * personality.pace,
    1,
  );
  const point = sampleLoopPath(effectivePatrolPath, progress);
  const lookAhead = sampleLoopPath(
    effectivePatrolPath,
    positiveModulo(progress + 0.018 * personality.pace, 1),
  );
  const routeNormal = perpendicularNormal(point, lookAhead);
  const swayWave =
    Math.sin(animationBeat * personality.swayRate + phaseOffset * Math.PI * 2) *
    personality.sway;
  const styledPoint =
    Math.abs(routeNormal.x) > 0.001 || Math.abs(routeNormal.y) > 0.001
      ? {
          x: point.x + routeNormal.x * swayWave,
          y: point.y + routeNormal.y * swayWave,
        }
      : point;

  return {
    facing: lookAhead.x >= styledPoint.x ? 1 : -1,
    known: npc.known,
    npc,
    step:
      Math.sin(
        progress *
          Math.PI *
          2 *
          Math.max(3, effectivePatrolPath.length - 1) *
          personality.pace,
      ) *
        personality.stepStrength +
      Math.sin(animationBeat * 0.8 + phaseOffset * Math.PI * 2) *
        0.08 *
        personality.motion.idleWave,
    ...(authoredPatrolPath
      ? styledPoint
      : projectRuntimePoint(indices, styledPoint)),
  };
}

function buildAuthoredNpcPatrolPath(
  visualScene: VisualScene | null,
  locationId: string,
) {
  const anchors = visualScene?.locationAnchors[locationId];
  if (!anchors) {
    return null;
  }

  const candidatePoints = [
    anchors.frontage,
    ...(anchors.npcStands ?? []),
    anchors.door,
  ];
  const patrolPath = dedupePointSequence(
    candidatePoints.map((point) => ({
      x: point.x,
      y: point.y,
    })),
  );

  return patrolPath.length > 0 ? patrolPath : null;
}

function resolveCrowdPositions(
  rawNpcs: AnimatedNpcState[],
  playerPixel: Point,
) {
  const playerRadius = CELL * 0.34;
  const npcRadius = CELL * 0.28;
  const resolved = rawNpcs.map((entry) => ({
    ...entry,
    isYielding: false,
    step: entry.step,
    x: entry.x,
    y: entry.y,
  }));

  for (const entry of resolved) {
    const steered = steerAroundOccupant(
      { x: entry.x, y: entry.y },
      playerPixel,
      playerRadius + npcRadius + 2,
      CELL * 1.2,
      hashString(entry.npc.id) % 2 === 0 ? 1 : -1,
    );

    entry.x = steered.x;
    entry.y = steered.y;

    if (steered.didYield) {
      entry.isYielding = true;
      entry.step *= 0.35;
      entry.facing = steered.x >= playerPixel.x ? 1 : -1;
    }
  }

  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < resolved.length;
        rightIndex += 1
      ) {
        const left = resolved[leftIndex];
        const right = resolved[rightIndex];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const minimumGap = npcRadius * 2.05;

        if (distance >= minimumGap) {
          continue;
        }

        const push = (minimumGap - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        left.x -= nx * push;
        left.y -= ny * push;
        right.x += nx * push;
        right.y += ny * push;
        left.isYielding = true;
        right.isYielding = true;
        left.step *= 0.72;
        right.step *= 0.72;
      }
    }
  }

  for (const [index, entry] of resolved.entries()) {
    const clamped = clampNpcDisplacement(entry, rawNpcs[index]);
    entry.x = clamped.x;
    entry.y = clamped.y;

    if (clamped.wasClamped) {
      entry.isYielding = true;
      entry.step *= 0.68;
    }
  }

  return resolved;
}

function clampNpcDisplacement(point: Point, original: Point) {
  const dx = point.x - original.x;
  const dy = point.y - original.y;
  const distance = Math.hypot(dx, dy);
  const maximum = CELL * 0.48;

  if (distance <= maximum || distance === 0) {
    return {
      wasClamped: false,
      x: point.x,
      y: point.y,
    };
  }

  const scale = maximum / distance;
  return {
    wasClamped: true,
    x: original.x + dx * scale,
    y: original.y + dy * scale,
  };
}

function drawAmbientOverlay(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  world: { height: number; width: number },
) {
  const game = runtimeState.snapshot.game;
  layer.clear();

  if (!game) {
    return;
  }

  const hour = game.clock.hour + game.clock.minute / 60;
  const warmStrength =
    hour >= 7 && hour <= 17 ? 0.04 : hour > 17 && hour <= 21 ? 0.025 : 0.018;

  layer.fillStyle(0xd6b37c, warmStrength);
  layer.fillRect(0, 0, world.width, world.height);
  layer.fillStyle(0x000000, 0.03);
  layer.fillRect(0, 0, world.width, world.height);
}

function drawPlayerPresenceMarker(
  layer: PhaserType.GameObjects.Graphics,
  playerPixel: Point,
  now: number,
  options: {
    authoredScene?: boolean;
  } = {},
) {
  const authoredScene = options.authoredScene ?? false;
  const playerPulse = 0.68 + Math.sin(now / 240) * 0.12;
  const glowBoost = authoredScene ? 1.18 : 1;
  const markerLift = authoredScene ? 0.96 : 0.84;
  const markerY = playerPixel.y - CELL * markerLift - Math.sin(now / 200) * 2.8;

  layer.fillStyle(0x8dd0cd, (0.08 + playerPulse * 0.04) * glowBoost);
  layer.fillCircle(
    playerPixel.x,
    playerPixel.y,
    CELL * (1.2 + (authoredScene ? 0.1 : 0)),
  );
  layer.fillStyle(0xe8d7ad, (0.06 + playerPulse * 0.03) * glowBoost);
  layer.fillCircle(
    playerPixel.x,
    playerPixel.y,
    CELL * (0.96 + (authoredScene ? 0.08 : 0)),
  );
  layer.lineStyle(2.2, 0x9bded7, (0.28 + playerPulse * 0.12) * glowBoost);
  layer.strokeCircle(
    playerPixel.x,
    playerPixel.y,
    CELL * (1.56 + (authoredScene ? 0.08 : 0)),
  );
  layer.lineStyle(2.1, 0xf0cf8c, (0.42 + playerPulse * 0.12) * glowBoost);
  layer.strokeEllipse(
    playerPixel.x,
    playerPixel.y + CELL * 0.42,
    CELL * (1.72 + (authoredScene ? 0.16 : 0)),
    CELL * (0.94 + (authoredScene ? 0.08 : 0)),
  );
  layer.lineStyle(2.2, 0xf0cf8c, (0.34 + playerPulse * 0.12) * glowBoost);
  layer.lineBetween(
    playerPixel.x,
    markerY + 8,
    playerPixel.x,
    playerPixel.y - CELL * 0.16,
  );
  layer.fillStyle(0xffefc8, 0.96);
  layer.fillCircle(playerPixel.x, markerY, authoredScene ? 5.8 : 5.2);
}

function drawDynamicOverlay(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  playerPixel: Point,
  now: number,
) {
  const game = runtimeState.snapshot.game;
  layer.clear();

  if (!game) {
    return;
  }

  if (runtimeState.indices.visualScene) {
    drawAnimatedCitySurface(layer, runtimeState.indices, now);
    drawAnimatedSkyWeather(layer, runtimeState.indices.visualScene, now);
    if (runtimeState.waypointTarget) {
      drawWaypointBeacon(
        layer,
        runtimeState.indices,
        runtimeState.waypointTarget,
        now,
        runtimeState.waypointPlacedAt,
      );
    }
    drawPlayerPresenceMarker(layer, playerPixel, now, {
      authoredScene: true,
    });
    return;
  }

  const currentFootprint = game.player.currentLocationId
    ? getRuntimeLocationHighlightRect(
        runtimeState.indices,
        game.player.currentLocationId,
      )
    : undefined;
  const selectedNpc = getSelectedNpc(runtimeState);
  const selectedFootprint = selectedNpc
    ? getRuntimeLocationHighlightRect(
        runtimeState.indices,
        selectedNpc.currentLocationId,
      )
    : undefined;
  const pulse = 0.55 + Math.sin(now / 320) * 0.12;

  drawAnimatedCitySurface(layer, runtimeState.indices, now);

  if (runtimeState.waypointTarget) {
    drawWaypointBeacon(
      layer,
      runtimeState.indices,
      runtimeState.waypointTarget,
      now,
      runtimeState.waypointPlacedAt,
    );
  }

  if (currentFootprint) {
    drawFootprintHalo(layer, currentFootprint, 0xa9d7d4, 0.08, 0.48);
  }

  if (selectedFootprint) {
    drawFootprintHalo(layer, selectedFootprint, 0xf1d09f, 0.12 * pulse, 0.68);
  }

  drawPlayerPresenceMarker(layer, playerPixel, now);

  if (selectedNpc) {
    const selectedMarker = runtimeState.objects?.npcMarkers.get(selectedNpc.id);
    if (selectedMarker) {
      const personality = npcPersonalityProfile(selectedNpc);
      const ringColor = blendColor(
        selectedMarker.appearance.accent,
        0xfff2cf,
        0.22,
      );
      const ringRadius = CELL * (0.78 + pulse * 0.08);
      layer.fillStyle(ringColor, 0.06 * pulse);
      layer.fillCircle(
        selectedMarker.container.x,
        selectedMarker.container.y - 2,
        CELL * 0.72,
      );
      layer.lineStyle(
        2.5,
        ringColor,
        0.34 + personality.motion.idleWave * 0.02,
      );
      layer.strokeCircle(
        selectedMarker.container.x,
        selectedMarker.container.y - 2,
        ringRadius,
      );
    }
  }
}

function drawWaypointBeacon(
  layer: PhaserType.GameObjects.Graphics,
  indices: RuntimeIndices,
  target: Point,
  now: number,
  placedAt: number,
) {
  const worldPoint = projectRuntimeTileCenter(indices, target.x, target.y);
  const age = Math.max(now - placedAt, 0);
  const bob = Math.sin(now / 180) * 3.2;
  const pulse = 0.68 + (Math.sin(now / 210) + 1) * 0.16;
  const settle = clamp(age / 260, 0, 1);
  const outerRadius = CELL * (0.42 + pulse * 0.1);
  const innerRadius = CELL * (0.18 + pulse * 0.03);
  const markerY = worldPoint.y - CELL * (0.78 + (1 - settle) * 0.16) - bob;

  layer.fillStyle(0xf3dcaa, 0.08 * pulse);
  layer.fillCircle(worldPoint.x, worldPoint.y, outerRadius);
  layer.lineStyle(2.4, 0xf0cf8c, 0.4 + pulse * 0.12);
  layer.strokeCircle(worldPoint.x, worldPoint.y, outerRadius);
  layer.lineStyle(1.8, 0xffefc8, 0.72);
  layer.strokeCircle(worldPoint.x, worldPoint.y, innerRadius);
  layer.lineStyle(2, 0xf0cf8c, 0.36 + pulse * 0.12);
  layer.lineBetween(
    worldPoint.x,
    markerY + 8,
    worldPoint.x,
    worldPoint.y - CELL * 0.12,
  );
  layer.fillStyle(0xffefc8, 0.94);
  layer.fillCircle(worldPoint.x, markerY, 4.8);
}

function drawAnimatedCitySurface(
  layer: PhaserType.GameObjects.Graphics,
  indices: RuntimeIndices,
  now: number,
) {
  const wave = now / 1000;

  if (indices.visualScene) {
    drawAnimatedVisualWater(layer, indices.visualScene, now);
    return;
  }

  for (const tile of indices.animatedSurfaceTiles) {
    if (tile.kind === "water") {
      const { x: worldX, y: worldY } = mapTileToWorldOrigin(tile.x, tile.y);
      const crest = positiveModulo(
        wave * 0.84 + tile.x * 0.41 + tile.y * 0.23,
        1,
      );
      const drift = Math.sin(wave * 1.6 + tile.x * 0.68 + tile.y * 0.42);

      layer.lineStyle(2, 0xc9edf5, 0.09 + crest * 0.05);
      layer.lineBetween(
        worldX + 8 + drift * 1.6,
        worldY + 12,
        worldX + 24 + drift * 1.6,
        worldY + 10,
      );
      layer.lineBetween(
        worldX + 12 - drift,
        worldY + 26,
        worldX + 30 - drift,
        worldY + 23,
      );
      layer.fillStyle(0x89c8dc, 0.05 + crest * 0.03);
      layer.fillEllipse(worldX + 19, worldY + 31, 16, 2.8);
      continue;
    }

    if (tile.kind === "dock") {
      const { x: worldX, y: worldY } = mapTileToWorldOrigin(tile.x, tile.y);
      const sheen = 0.035 + (Math.sin(wave * 1.15 + tile.x * 0.52) + 1) * 0.012;
      layer.fillStyle(0xf0d3a2, sheen);
      layer.fillRoundedRect(worldX + 7, worldY + 7, CELL - 14, 2.6, 1);
    }
  }
}

function drawFootprintHalo(
  layer: PhaserType.GameObjects.Graphics,
  footprint: VisualRect,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
) {
  const { x: worldX, y: worldY } = footprint;
  const width = footprint.width;
  const height = footprint.height;
  const radius = footprint.radius ?? 26;

  layer.fillStyle(color, fillAlpha);
  layer.fillRoundedRect(worldX, worldY, width, height, radius);
  layer.lineStyle(3, color, strokeAlpha);
  layer.strokeRoundedRect(worldX, worldY, width, height, radius);
}

function finishRuntimePointerTap(
  runtimeState: RuntimeState,
  pointer: PhaserType.Input.Pointer,
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>,
) {
  const gestureResult = finishCameraGesture(runtimeState, pointer);
  if (!gestureResult.wasTap) {
    return;
  }

  const game = runtimeState.snapshot.game;
  if (!game || runtimeState.snapshot.busyLabel) {
    return;
  }

  const sceneViewport = getRuntimeSceneViewport(runtimeState);
  if (!isPointerWithinSceneViewport(pointer, sceneViewport)) {
    return;
  }

  const tile = getPointerTargetTile(runtimeState, game, pointer);
  if (!tile) {
    return;
  }

  const accepted = callbacksRef.current.onMoveTo(tile.x, tile.y, {
    showWaypoint: true,
  });
  if (accepted) {
    setRuntimeWaypointTarget(runtimeState, tile);
  }
}

function getPointerTargetTile(
  runtimeState: RuntimeState,
  game: StreetGameState,
  pointer: PhaserType.Input.Pointer,
) {
  const visualScene = runtimeState.indices.visualScene;
  if (visualScene) {
    const nearestPoint = findNearestWalkablePointByWorldHint(
      runtimeState.indices.walkableRuntimePoints,
      {
        x: pointer.worldX,
        y: pointer.worldY,
      },
      {
        preferredKinds: PUBLIC_TRAVEL_TILE_KINDS,
      },
    );

    if (
      !nearestPoint ||
      distanceBetween(nearestPoint.world, {
        x: pointer.worldX,
        y: pointer.worldY,
      }) > 92
    ) {
      return null;
    }

    return nearestPoint.tile;
  }

  const mapOrigin = getMapWorldOrigin();
  const x = Math.floor((pointer.worldX - mapOrigin.x) / CELL);
  const y = Math.floor((pointer.worldY - mapOrigin.y) / CELL);

  if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height) {
    return null;
  }

  return findWalkableTile(game, x, y, visualScene);
}

function pickDefaultSelectedNpcId(game: StreetGameState | null) {
  if (!game) {
    return null;
  }

  if (game.activeConversation?.npcId) {
    return game.activeConversation.npcId;
  }

  if (game.rowanAutonomy?.npcId) {
    return game.rowanAutonomy.npcId;
  }

  const talkNpcId = game.availableActions
    .map((action) => extractTalkNpcId(action.id))
    .find(isPresent);

  if (talkNpcId) {
    return talkNpcId;
  }

  return game.currentScene.people[0]?.id ?? game.npcs[0]?.id ?? null;
}

function getSelectedNpc(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  if (!game || !runtimeState.ui.selectedNpcId) {
    return null;
  }

  return (
    game.npcs.find((npc) => npc.id === runtimeState.ui.selectedNpcId) ?? null
  );
}

function buildPlayerThought(game: StreetGameState) {
  if (game.player.currentThought) {
    return game.player.currentThought;
  }

  if (game.player.objective?.text) {
    return game.player.objective.text;
  }

  const activeJob = game.jobs.find((job) => job.id === game.player.activeJobId);
  const pumpProblem = game.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const cartProblem = game.problems.find(
    (problem) => problem.id === "problem-cart",
  );
  const hasWrench = game.player.inventory.some(
    (item) => item.id === "item-wrench",
  );

  if (activeJob && !activeJob.completed) {
    return "I can't blow this shift.";
  }

  if (
    pumpProblem?.discovered &&
    pumpProblem.status === "active" &&
    !hasWrench
  ) {
    return "I need a wrench first.";
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && hasWrench) {
    return "I should go fix that pump.";
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    return "I need to move that cart.";
  }

  if (game.player.energy < 38) {
    return "I need a minute to rest.";
  }

  if ((game.player.reputation.morrow_house ?? 0) < 2) {
    return "I need somewhere to stay beyond tonight.";
  }

  if (game.player.knownNpcIds.length < 3) {
    return "I need to meet a few people I could actually befriend.";
  }

  if (game.player.knownLocationIds.length < 4) {
    return "I need to learn these lanes if I'm making a life here.";
  }

  if (game.player.money < 18) {
    return "I need steadier income if I'm going to stay here.";
  }

  return "I think I could find a real friend here.";
}

function nextScheduledLocation(
  npc: NpcState,
  currentHour: number,
  locationsById: Map<string, LocationState>,
) {
  if (npc.schedule.length <= 1) {
    return undefined;
  }

  const stopIndex = npc.schedule.findIndex(
    (entry) => currentHour >= entry.fromHour && currentHour < entry.toHour,
  );
  const resolvedIndex = stopIndex >= 0 ? stopIndex : npc.schedule.length - 1;
  const nextStop = npc.schedule[(resolvedIndex + 1) % npc.schedule.length];

  return nextStop ? locationsById.get(nextStop.locationId) : undefined;
}

function patrolCacheKey(locationId: string, nextLocationId?: string) {
  return `${locationId}->${nextLocationId ?? locationId}`;
}

function getCachedPatrolPath(
  indices: RuntimeIndices,
  options: {
    door?: MapDoor;
    findRoute: (start: Point, end: Point) => Point[];
    location: LocationState;
    nextLocation?: LocationState;
    props: MapProp[];
    visualHints?: Point[];
    walkableRuntimePoints: WalkableRuntimePoint[];
  },
) {
  const key = patrolCacheKey(options.location.id, options.nextLocation?.id);
  const cached = indices.patrolPathByKey.get(key);
  if (cached) {
    return cached;
  }

  const nextPath = buildNpcPatrolPath(options);
  indices.patrolPathByKey.set(key, nextPath);
  indices.patrolDistanceByKey.set(key, loopPathDistance(nextPath));
  return nextPath;
}

function getCachedPatrolDistance(
  indices: RuntimeIndices,
  options: Parameters<typeof getCachedPatrolPath>[1],
) {
  const key = patrolCacheKey(options.location.id, options.nextLocation?.id);
  const cachedDistance = indices.patrolDistanceByKey.get(key);
  if (cachedDistance !== undefined) {
    return cachedDistance;
  }

  getCachedPatrolPath(indices, options);
  return indices.patrolDistanceByKey.get(key) ?? 0;
}

function steerAroundOccupant(
  point: Point,
  obstacle: Point,
  minimumGap: number,
  influenceRadius: number,
  tangentSign: 1 | -1,
) {
  const dx = point.x - obstacle.x;
  const dy = point.y - obstacle.y;
  const distance = Math.hypot(dx, dy) || 0.001;

  if (distance >= influenceRadius) {
    return {
      didYield: false,
      x: point.x,
      y: point.y,
    };
  }

  const awayX = dx / distance;
  const awayY = dy / distance;
  const tangentX = -awayY * tangentSign;
  const tangentY = awayX * tangentSign;
  const closeness = 1 - Math.min(distance / influenceRadius, 1);
  const radialPush = Math.max(minimumGap - distance, 0) * 0.9;
  const sidestep = closeness * CELL * 0.44;

  return {
    didYield: distance < influenceRadius * 0.86,
    x: point.x + awayX * radialPush + tangentX * sidestep,
    y: point.y + awayY * radialPush + tangentY * sidestep,
  };
}

function samplePlayerTile(motion: PlayerMotionState, now: number) {
  const progress = clamp((now - motion.startedAt) / motion.durationMs, 0, 1);
  return samplePathPoint(motion.path, easeInOutCubic(progress));
}

function samplePlayerWorld(
  runtimeState: RuntimeState,
  playerTile: Point,
  now: number,
) {
  const motion = runtimeState.playerMotion;
  if (motion.worldPath && motion.worldPath.length > 0) {
    const progress = clamp((now - motion.startedAt) / motion.durationMs, 0, 1);
    return samplePathPoint(motion.worldPath, easeInOutCubic(progress));
  }

  return playerTileToWorld(
    playerTile,
    runtimeState.indices,
    runtimeState.snapshot.game ?? undefined,
  );
}

function getPlayerAnimationState(motion: PlayerMotionState, now: number) {
  const rawProgress = clamp((now - motion.startedAt) / motion.durationMs, 0, 1);
  const progress = easeInOutCubic(rawProgress);
  const current = samplePathPoint(motion.path, progress);
  const lookAhead = samplePathPoint(motion.path, clamp(progress + 0.06, 0, 1));
  const moving =
    motion.path.length > 1 &&
    (rawProgress < 0.995 || distanceBetween(current, motion.to) > 0.02);
  const dx = lookAhead.x - current.x;
  const facing = dx >= -0.001 ? 1 : -1;

  return {
    facing: facing as 1 | -1,
    stride: moving
      ? Math.sin(progress * Math.max(motion.path.length - 1, 1) * Math.PI * 2)
      : Math.sin(now / 380) * 0.12,
  };
}

function playerTileToWorld(
  point: Point,
  indices: RuntimeIndices,
  game?: StreetGameState,
) {
  if (game) {
    const authoredPoint = resolveAuthoredLocationWorldPoint({
      conversationLocationId: game.activeConversation?.locationId,
      indices,
      locationId: game.player.currentLocationId,
      point,
    });
    if (authoredPoint) {
      return authoredPoint;
    }
  }

  return projectRuntimeTileCenter(indices, point.x, point.y);
}

function buildPlayerMotionWorldPath(
  runtimeState: RuntimeState,
  path: Point[],
  fromWorldPoint: Point,
  nextPoint: Point,
) {
  if (!runtimeState.indices.visualScene || path.length <= 1) {
    return undefined;
  }

  const projectedPath = path.map((point) =>
    projectRuntimeTileCenter(runtimeState.indices, point.x, point.y),
  );
  const targetLocationId = runtimeState.snapshot.optimisticPlayerPosition
    ? runtimeState.snapshot.optimisticPlayerLocationId
    : runtimeState.snapshot.game?.player.currentLocationId;
  const targetWorldPoint = resolveAuthoredLocationWorldPoint({
    conversationLocationId:
      runtimeState.snapshot.optimisticPlayerConversationLocationId ??
      runtimeState.snapshot.game?.activeConversation?.locationId,
    indices: runtimeState.indices,
    locationId: targetLocationId,
    point: nextPoint,
  });

  return dedupePointSequence([
    fromWorldPoint,
    ...projectedPath.slice(1, -1),
    targetWorldPoint ?? projectedPath[projectedPath.length - 1],
  ]);
}

function resolveAuthoredLocationWorldPoint({
  conversationLocationId,
  indices,
  locationId,
  point,
}: {
  conversationLocationId?: string | null;
  indices: RuntimeIndices;
  locationId?: string | null;
  point: Point;
}) {
  if (!locationId) {
    return null;
  }

  const anchors = indices.visualScene?.locationAnchors[locationId];
  if (!anchors) {
    return null;
  }

  const candidatePoints = dedupePointSequence([
    ...(anchors.npcStands ?? []).map((candidate) => ({
      x: candidate.x,
      y: candidate.y,
    })),
    {
      x: anchors.frontage.x,
      y: anchors.frontage.y,
    },
    {
      x: anchors.door.x,
      y: anchors.door.y,
    },
  ]);
  if (candidatePoints.length === 0) {
    return null;
  }

  if (
    conversationLocationId === locationId &&
    candidatePoints.length > 1
  ) {
    return candidatePoints[0];
  }

  const location = indices.locationsById.get(locationId);
  if (!location || candidatePoints.length === 1) {
    return candidatePoints[0];
  }

  const horizontalProgress = clamp(
    (point.x - location.x) / Math.max(location.width, 1),
    0,
    0.999,
  );
  const candidateIndex = Math.min(
    candidatePoints.length - 1,
    Math.floor(horizontalProgress * candidatePoints.length),
  );

  return candidatePoints[candidateIndex];
}

function colorToCssRgba(color: number, alpha: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function positiveModulo(value: number, base: number) {
  return ((value % base) + base) % base;
}

function getRuntimeNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function asTab(value: string | undefined): UiState["activeTab"] {
  return value === "journal" || value === "mind" || value === "people"
    ? value
    : "actions";
}

function asFocusPanel(value: UiState["activeTab"]): FocusPanel | null {
  return value === "journal" || value === "mind" || value === "people"
    ? value
    : null;
}

function focusPanelMeta(
  focusPanel: FocusPanel,
  selectedNpc: NpcState | null,
  game: StreetGameState,
) {
  const selectedPersonality = selectedNpc
    ? npcPersonalityProfile(selectedNpc)
    : null;
  const isLiveConversation =
    Boolean(selectedNpc) && game.activeConversation?.npcId === selectedNpc?.id;

  switch (focusPanel) {
    case "people":
      return {
        kicker: selectedNpc
          ? isLiveConversation
            ? "Live Conversation"
            : "Person Card"
          : "People In Reach",
        subtitle: selectedNpc
          ? isLiveConversation
            ? `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust} • conversation active`
            : `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust}`
          : `People Rowan can approach in ${game.currentScene.title}.`,
        title: selectedNpc?.name ?? "Locals",
      };
    case "journal":
      return {
        kicker: "Field Notes",
        subtitle:
          "Objectives, feed, and what Rowan should do next.",
        title: "Journal",
      };
    case "mind":
      return {
        kicker: "Working Memory",
        subtitle:
          "Places, people, and unfinished business Rowan is keeping in view.",
        title: "Mind",
      };
  }
}

function extractTalkNpcId(actionId: string) {
  const [kind, targetId] = actionId.split(":");
  return kind === "talk" && targetId ? targetId : undefined;
}

function findWalkableTile(
  game: StreetGameState,
  x: number,
  y: number,
  visualScene: VisualScene | null = getPlayableVisualScene(game),
) {
  return buildNavigationTiles(game, visualScene).find(
    (tile) => tile.x === x && tile.y === y && tile.walkable,
  );
}

function createMapKey(game: StreetGameState | null) {
  if (!game) {
    return "empty";
  }

  return [
    game.visualSceneId ?? "none",
    getVisualSceneRuntimeRevision(game.visualSceneId ?? null),
    game.map.width,
    game.map.height,
    game.map.tiles.length,
    game.map.footprints.length,
    game.map.doors.length,
    game.map.props.length,
    game.map.labels.length,
  ].join(":");
}

function groupPropsByLocation(props: MapProp[]) {
  const grouped = new Map<string, MapProp[]>();

  for (const prop of props) {
    if (!prop.locationId) {
      continue;
    }

    const current = grouped.get(prop.locationId) ?? [];
    current.push(prop);
    grouped.set(prop.locationId, current);
  }

  return grouped;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }

  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function useViewportSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<ViewportSize>({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const nextWidth = Math.max(Math.round(element.clientWidth), 320);
      const nextHeight = Math.max(Math.round(element.clientHeight), 560);
      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {
              height: nextHeight,
              width: nextWidth,
            },
      );
    };

    update();
    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
