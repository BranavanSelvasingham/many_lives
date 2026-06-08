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
  waitInStreetGame,
} from "@/lib/street/api";
import { useSearchParams } from "next/navigation";
import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import {
  buildFirstAfternoonFieldNoteHtml,
  buildJournalTabHtml,
  buildLoadingHtml,
  buildMindTabHtml,
  buildNarrativePreview,
  buildRuntimeDebugHtml,
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
  type StreetBrowserMovementDiagnostics,
} from "@/lib/street/browserProbe";
import { buildStreetOverlayStyle } from "@/lib/street/streetOverlayStyles";
import {
  buildNpcPatrolRoute,
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
  type NpcPatrolPathDiagnostics,
  type WalkableRuntimePoint,
} from "@/lib/street/navigation";
import {
  buildVisualNavigationSurface,
  buildVisualWalkableRuntimePoints,
  isVisualWorldPathLegal,
  projectVisualNavigationTileCenter,
  resolveVisualRoute,
  type VisualRouteDiagnostics,
} from "@/lib/street/visualNavigation";
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
  isBlockingRowanPlaybackForGame,
  isFirstAfternoonOpening,
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
  getRuntimeCameraAnchorXRatio,
  getRuntimeCameraAnchorYRatio,
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
  getCompactCameraScrollRange,
  getWorldBoundsForRuntime,
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
  SpaceDefinition,
  SpaceObject,
  StreetGameState,
} from "@/lib/street/types";
import {
  getVisualScene,
  getVisualSceneDocument,
  getVisualSceneRuntimeRevision,
  validateVisualSceneAgainstGame,
  VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT,
  type VisualRect,
  type VisualScene,
} from "@/lib/street/visualScenes";

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
const PLAYER_MAX_MOVE_DURATION_MS = 5200;
const WATCH_PLAYER_MOVE_MS_PER_TILE = 620;
const WATCH_PLAYER_MAX_MOVE_DURATION_MS = 8600;
const PLAYER_MOVE_DURATION_MULTIPLIER = 0.72;
const STREET_GAME_SESSION_STORAGE_KEY = "many-lives:street-game-id";
const STREET_SIM_BASE_DAY = "2026-03-21T00:00:00.000Z";
const AUTOPLAY_CONVERSATION_AUTOSTART_DELAY_MS = 1800;
const AUTOPLAY_OPENING_AUTOSTART_DELAY_MS = 1800;
const AUTONOMY_BEAT_DELAY_MS = {
  acting: 1800,
  conversation: 2200,
  moving: 1400,
  waiting: 1800,
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
  if (isFirstAfternoonOpening(game)) {
    return AUTOPLAY_OPENING_AUTOSTART_DELAY_MS;
  }

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
  return Math.max(baseDelay, estimateLiveConversationBeatMs(game) + 900);
}

function buildWatchModeAdvanceKey(game: StreetGameState | null) {
  if (!game) {
    return null;
  }

  const autoContinueKey = buildObjectiveAutoContinueKey(game);
  if (autoContinueKey) {
    return autoContinueKey;
  }

  if (isFirstAfternoonOpening(game)) {
    return `${game.id}:opening:${game.rowanAutonomy?.key ?? "opening"}`;
  }

  return null;
}

function buildGameSyncKey(game: StreetGameState) {
  return [
    game.id,
    game.currentTime,
    game.activeSpaceId ?? "",
    game.player.spaceId ?? "",
    game.player.x,
    game.player.y,
    game.player.currentLocationId ?? "",
    game.player.money,
    game.player.energy,
    game.player.objective?.routeKey ?? "",
    game.player.objective?.text ?? "",
    game.player.objective?.progress?.label ?? "",
    game.firstAfternoon?.planSettledAt ?? "",
    game.firstAfternoon?.teaShiftStage ?? "",
    game.firstAfternoon?.completedAt ?? "",
    game.firstAfternoon?.leadFieldNote?.createdAt ?? "",
    game.firstAfternoon?.leadFieldNote?.evidence ?? "",
    game.firstAfternoon?.fieldNote?.createdAt ?? "",
    game.firstAfternoon?.fieldNote?.evidence ?? "",
    ...(game.cityEvents ?? []).map((event) =>
      [
        event.id,
        event.status,
        event.progress ?? "",
        event.updatedAt,
      ].join(":"),
    ),
    game.rowanAutonomy.key,
    game.rowanAutonomy.label,
    game.rowanAutonomy.intent?.reason ?? "",
    game.rowanAutonomy.intent?.signals?.join("|") ?? "",
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

  if (
    (previousGame.activeSpaceId ?? previousGame.player.spaceId ?? "") !==
    (nextGame.activeSpaceId ?? nextGame.player.spaceId ?? "")
  ) {
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
  options: { watchMode?: boolean } = {},
) {
  const routeDistance =
    route && routeReachesDestination(route, nextGame.player)
      ? pathDistance(route)
      : distanceBetween(previousGame.player, nextGame.player);
  const msPerTile = options.watchMode ? WATCH_PLAYER_MOVE_MS_PER_TILE : 360;
  const maxDuration = options.watchMode
    ? WATCH_PLAYER_MAX_MOVE_DURATION_MS
    : PLAYER_MAX_MOVE_DURATION_MS;

  return clamp(
    Math.max(routeDistance, 1) * msPerTile,
    ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap,
    maxDuration,
  );
}

const FRESH_GAME_QUERY_PARAMS = ["new", "newGame", "reset"] as const;

function isTruthyQueryValue(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase();
  return (
    normalizedValue === "1" ||
    normalizedValue === "true" ||
    normalizedValue === "yes" ||
    normalizedValue === "on"
  );
}

function bindGameToCurrentUrl(
  gameId: string,
  options: { clearFreshGameParams?: boolean } = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  let didUpdate = false;

  if (nextUrl.searchParams.get("gameId") !== gameId) {
    nextUrl.searchParams.set("gameId", gameId);
    didUpdate = true;
  }

  if (options.clearFreshGameParams) {
    for (const param of FRESH_GAME_QUERY_PARAMS) {
      if (nextUrl.searchParams.has(param)) {
        nextUrl.searchParams.delete(param);
        didUpdate = true;
      }
    }
  }

  if (didUpdate) {
    window.history.replaceState(null, "", nextUrl.toString());
  }
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

function formatStreetRuntimeError(error: unknown, fallback: string) {
  if (isMissingStreetGameError(error)) {
    return "That run is no longer available. Start a fresh run to keep watching Rowan.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
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
  rowanAutoplayFrozen: boolean;
  storedGameId?: string | null;
  waypointNonce: number;
  waypointTarget?: Point;
  visualSceneRefreshNonce: number;
  viewport: ViewportSize;
};

type AdvanceObjectiveOptions = {
  confirmedByUser?: boolean;
};

type LoadGameOptions = {
  forceNew?: boolean;
  resumeStored?: boolean;
};

type PhaserStreetExperienceProps = {
  onAction: (actionId: string, label: string) => void;
  onAdvanceObjective: (options?: AdvanceObjectiveOptions) => void;
  onAdvanceTime: (minutes: number, label: string) => void;
  onReload: () => void;
  onResumeStoredGame: () => void;
  onStartNewGame: () => void;
  snapshot: StreetAppSnapshot;
};

type RuntimeCallbacks = Pick<
  PhaserStreetExperienceProps,
  | "onAction"
  | "onAdvanceObjective"
  | "onAdvanceTime"
  | "onReload"
  | "onResumeStoredGame"
  | "onStartNewGame"
>;

type PlayerMotionState = {
  durationMs: number;
  path: Point[];
  routeDiagnostics?: VisualRouteDiagnostics;
  spaceId?: string | null;
  startedAt: number;
  to: Point;
  worldPath?: Point[];
};

type RuntimePatrolDiagnostics = NpcPatrolPathDiagnostics & {
  key: string;
  locationId: string;
  nextLocationId: string | null;
  pathLength: number;
};

type PendingVisualGameUpdate = {
  game: StreetGameState;
  syncKey: string;
  timerId: number;
};

type RuntimeIndices = {
  activeSpace: SpaceDefinition | null;
  activeSpaceId: string | null;
  animatedSurfaceTiles: Array<Pick<MapTile, "kind" | "x" | "y">>;
  blockedNavigationTileCount: number;
  footprintByLocationId: Map<string, MapFootprint>;
  locationsById: Map<string, LocationState>;
  patrolDistanceByKey: Map<string, number>;
  patrolDiagnosticsByKey: Map<string, RuntimePatrolDiagnostics>;
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
  agencyIntentText: PhaserType.GameObjects.Text;
  agencyTargetText: PhaserType.GameObjects.Text;
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

type MapAgencyTone =
  | "acting"
  | "blocked"
  | "conversation"
  | "idle"
  | "moving"
  | "waiting";

type MapAgencyCue = {
  detail: string;
  intent: string;
  targetIsNpc: boolean;
  targetLabel: string | null;
  targetLocationId: string | null;
  targetTile: Point | null;
  targetWorld: Point | null;
  tone: MapAgencyTone;
};

type MapAgencyLabelDiagnostics = {
  closeInteractionSuppressed: boolean;
  intentText: string | null;
  intentVisible: boolean;
  targetText: string | null;
  targetVisible: boolean;
};

type AmbientCityRoute = {
  accent: number;
  cityEventIds?: string[];
  color: number;
  id: string;
  path: Point[];
  phase: number;
  scale: number;
  seconds: number;
  startHour?: number;
  endHour?: number;
};

const AMBIENT_CITY_ROUTES: AmbientCityRoute[] = [
  {
    accent: 0xd7bc79,
    cityEventIds: ["event-cafe-prep", "event-lunch-rush"],
    color: 0x52646c,
    id: "tea-house-front",
    path: [
      { x: 338, y: 356 },
      { x: 470, y: 360 },
      { x: 620, y: 360 },
      { x: 620, y: 520 },
      { x: 470, y: 520 },
    ],
    phase: 0.08,
    scale: 0.9,
    seconds: 34,
    startHour: 10,
    endHour: 16,
  },
  {
    accent: 0x8dd0cd,
    color: 0x4a5961,
    id: "morrow-court",
    path: [
      { x: 250, y: 646 },
      { x: 360, y: 646 },
      { x: 486, y: 646 },
      { x: 486, y: 760 },
    ],
    phase: 0.42,
    scale: 0.86,
    seconds: 42,
    startHour: 7,
    endHour: 19,
  },
  {
    accent: 0xb68d5b,
    cityEventIds: ["event-market-crossing", "event-square-cart"],
    color: 0x43545c,
    id: "market-crossing",
    path: [
      { x: 720, y: 624 },
      { x: 846, y: 744 },
      { x: 934, y: 744 },
      { x: 1066, y: 624 },
    ],
    phase: 0.2,
    scale: 0.88,
    seconds: 46,
    startHour: 8,
    endHour: 18,
  },
  {
    accent: 0xd79c65,
    color: 0x4d4f50,
    id: "repair-lane",
    path: [
      { x: 1086, y: 520 },
      { x: 1238, y: 618 },
      { x: 1366, y: 618 },
      { x: 1366, y: 744 },
    ],
    phase: 0.66,
    scale: 0.86,
    seconds: 38,
    startHour: 9,
    endHour: 17,
  },
  {
    accent: 0xc78c59,
    cityEventIds: ["event-yard-loading"],
    color: 0x3f4b52,
    id: "yard-shuttle",
    path: [
      { x: 1224, y: 792 },
      { x: 1290, y: 808 },
      { x: 1444, y: 842 },
      { x: 1518, y: 842 },
    ],
    phase: 0.12,
    scale: 0.92,
    seconds: 32,
    startHour: 6,
    endHour: 18,
  },
  {
    accent: 0xa8c0cc,
    color: 0x374c56,
    id: "pier-hands",
    path: [
      { x: 1094, y: 1032 },
      { x: 1316, y: 1032 },
      { x: 1452, y: 1040 },
      { x: 1614, y: 1040 },
    ],
    phase: 0.5,
    scale: 0.88,
    seconds: 52,
    startHour: 6,
    endHour: 20,
  },
];

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

type CameraProjectionState = {
  playerWorldPoint: Point;
  sceneViewportCss: SceneViewport;
  visibleWorldRect: {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  };
};

type RuntimeState = {
  autoStartedConversationKey: string | null;
  cameraEdgeCue: Record<CameraEdgeName, number>;
  cameraGesture: CameraGestureState | null;
  cameraOffset: Point;
  cameraProjection: CameraProjectionState | null;
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
  visualEventCues: VisualEventCue[];
  waypointAppliedNonce: number;
  waypointPlacedAt: number;
  waypointTarget: Point | null;
};

type VisualEventCue = {
  cue: string;
  locationId: string;
  locationName: string;
  signal: string;
  visibleLabel: string | null;
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
  const [storedGamePromptId, setStoredGamePromptId] = useState<string | null>(
    null,
  );
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
  const pendingVisualGameUpdateRef = useRef<PendingVisualGameUpdate | null>(
    null,
  );
  const lastObjectiveAutoContinueKeyRef = useRef<string | null>(null);
  const routeFinderRef = useRef<((start: Point, end: Point) => Point[]) | null>(
    null,
  );
  const routeFinderMapKeyRef = useRef("");
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
  const forceFreshGame = useMemo(
    () =>
      FRESH_GAME_QUERY_PARAMS.some((param) =>
        isTruthyQueryValue(searchParams.get(param)),
      ),
    [searchParams],
  );
  const rowanAutoplayEnabled = useMemo(() => {
    return isTruthyQueryValue(searchParams.get("autoplay"));
  }, [searchParams]);
  const rowanAutoplayFrozen = useMemo(() => {
    return isTruthyQueryValue(searchParams.get("freezeAutoplay"));
  }, [searchParams]);
  const boundGameObserverEnabled = useMemo(() => {
    return isTruthyQueryValue(searchParams.get("observe"));
  }, [searchParams]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    optimisticPlayerRef.current = optimisticPlayerPosition;
  }, [optimisticPlayerPosition]);

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
    routeFinderRef.current = buildVisualNavigationSurface(
      game,
      getPlayableVisualScene(game),
    ).routeFinder;
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
          { watchMode: rowanAutoplayEnabled || boundGameObserverEnabled },
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
        publishWaypoint(visualTarget);
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
    [
      boundGameObserverEnabled,
      clearPendingVisualGameUpdate,
      publishWaypoint,
      rowanAutoplayEnabled,
    ],
  );

  const loadGame = useCallback(async (options: LoadGameOptions = {}) => {
    const requestId = nextRequestId();
    const shouldCreateFreshGame = forceFreshGame || options.forceNew === true;
    const storedGameId =
      requestedGameId || shouldCreateFreshGame
        ? null
        : readStoredStreetGameId();

    if (storedGameId && !options.resumeStored) {
      setError(null);
      setBusyLabel(null);
      setStoredGamePromptId(storedGameId);
      setGame(null);
      gameRef.current = null;
      setRowanPlayback(createEmptyRowanPlaybackState());
      publishWaypoint(null);
      return;
    }

    const gameIdToOpen = shouldCreateFreshGame
      ? null
      : requestedGameId ?? storedGameId;
    setStoredGamePromptId(null);
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
      if (
        forceFreshGame ||
        (requestedGameId && nextGame.id !== requestedGameId)
      ) {
        bindGameToCurrentUrl(nextGame.id, {
          clearFreshGameParams: forceFreshGame,
        });
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
        formatStreetRuntimeError(
          loadError,
          gameIdToOpen
            ? "Could not open your saved game."
            : "Could not open the district.",
        ),
      );
    } finally {
      setBusyLabel(null);
    }
  }, [
    applyGameUpdate,
    boundGameObserverEnabled,
    forceFreshGame,
    nextRequestId,
    publishWaypoint,
    requestedGameId,
    rowanAutoplayEnabled,
  ]);

  const handleResumeStoredGame = useCallback(() => {
    void loadGame({ resumeStored: true });
  }, [loadGame]);

  const handleStartNewGame = useCallback(() => {
    void loadGame({ forceNew: true });
  }, [loadGame]);

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
          formatStreetRuntimeError(
            runError,
            "Something in the district failed to update.",
          ),
        );
      } finally {
        setBusyLabel(null);
      }
    },
    [],
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
    const openingAutoStart = game ? isFirstAfternoonOpening(game) : false;
    const autoContinueKey = buildWatchModeAdvanceKey(game);
    if (
      lastObjectiveAutoContinueKeyRef.current &&
      lastObjectiveAutoContinueKeyRef.current !== autoContinueKey
    ) {
      lastObjectiveAutoContinueKeyRef.current = null;
    }

    if (
      !game ||
      !rowanAutoplayEnabled ||
      rowanAutoplayFrozen ||
      (!autonomy?.autoContinue && !openingAutoStart) ||
      busyLabel ||
      optimisticPlayerPosition ||
      isBlockingRowanPlaybackForGame(rowanPlayback, game)
    ) {
      return;
    }

    const autoContinuingConversation =
      Boolean(game.activeConversation) && autonomy?.layer === "conversation";
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
      const activeOpeningAutoStart = activeGame
        ? isFirstAfternoonOpening(activeGame)
        : false;
      if (
        !activeGame ||
        (!activeAutonomy?.autoContinue && !activeOpeningAutoStart) ||
        busyLabelRef.current ||
        optimisticPlayerRef.current ||
        isBlockingRowanPlaybackForGame(rowanPlaybackRef.current, activeGame)
      ) {
        return;
      }

      const activeAutoContinuingConversation =
        Boolean(activeGame.activeConversation) &&
        activeAutonomy?.layer === "conversation";
      if (
        activeGame.activeConversation &&
        !activeAutoContinuingConversation
      ) {
        return;
      }

      const activeAutoContinueKey = buildWatchModeAdvanceKey(activeGame);
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
    rowanAutoplayFrozen,
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
      animatePlayerEntrance: forceFreshGame || !requestedGameId,
      loadingLabel: busyLabel ?? "Preparing the district...",
      optimisticPlayerPosition: optimisticPlayerPosition ?? undefined,
      optimisticPlayerLocationId,
      optimisticPlayerConversationLocationId,
      optimisticPlayerMoveDurationMs: optimisticPlayerMoveDurationMs ?? undefined,
      recentBeat: rowanPlayback.lastCompletedBeat,
      rowanPlayback,
      rowanAutoplayEnabled,
      rowanAutoplayFrozen,
      storedGameId: storedGamePromptId,
      waypointNonce,
      waypointTarget: waypointTarget ?? undefined,
      visualSceneRefreshNonce: sceneOverrideVersion,
      viewport,
    }),
    [
      busyLabel,
      error,
      game,
      forceFreshGame,
      optimisticPlayerConversationLocationId,
      optimisticPlayerLocationId,
      optimisticPlayerMoveDurationMs,
      optimisticPlayerPosition,
      requestedGameId,
      rowanPlayback,
      rowanAutoplayEnabled,
      rowanAutoplayFrozen,
      sceneOverrideVersion,
      storedGamePromptId,
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
            onReload={() => {
              void loadGame();
            }}
            onResumeStoredGame={handleResumeStoredGame}
            onStartNewGame={handleStartNewGame}
            snapshot={snapshot}
          />
        ) : null}
      </div>
    </main>
  );
}

function PhaserStreetExperience({
  snapshot,
  onAction,
  onAdvanceTime,
  onAdvanceObjective,
  onReload,
  onResumeStoredGame,
  onStartNewGame,
}: PhaserStreetExperienceProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const callbacksRef = useRef({
    onAction,
    onAdvanceObjective,
    onAdvanceTime,
    onReload,
    onResumeStoredGame,
    onStartNewGame,
  });
  const latestSnapshotRef = useRef(snapshot);

  useEffect(() => {
    callbacksRef.current = {
      onAction,
      onAdvanceObjective,
      onAdvanceTime,
      onReload,
      onResumeStoredGame,
      onStartNewGame,
    };
  }, [
    onAction,
    onAdvanceObjective,
    onAdvanceTime,
    onReload,
    onResumeStoredGame,
    onStartNewGame,
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
  options.mount.style.touchAction = "none";
  options.mount.style.cursor = "grab";
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
    lastCameraInteractionAt: Number.NEGATIVE_INFINITY,
    mapKey: createMapKey(initialSnapshot.game),
    objects: null,
    pendingConversationAutostartNpcId: null,
    playerEntranceGameId: initialSnapshot.game?.id ?? null,
    playerMotion: createInitialPlayerMotion(
      initialSnapshot,
      initialIndices,
      runtimeNow,
    ),
    cameraProjection: null,
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
    visualEventCues: [],
    waypointAppliedNonce: initialSnapshot.waypointNonce,
    waypointPlacedAt: runtimeNow,
    waypointTarget: initialSnapshot.waypointTarget ?? null,
  };
  const nativeCameraPanFallback = bindNativeCameraPanFallback(
    options.mount,
    runtimeState,
  );

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
      const openRowanNotebookFromScene = () => {
        runtimeState.ui.activeTab = "mind";
        runtimeState.ui.focusPanel = "mind";
        if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
          runtimeState.ui.railExpanded = false;
        }
        renderOverlay(objects, runtimeState);
      };
      const pointerHitsRowanAvatar = (pointer: PhaserType.Input.Pointer) => {
        if (!runtimeState.snapshot.game) {
          return false;
        }

        const now = getRuntimeNow();
        const playerTile = samplePlayerTile(runtimeState.playerMotion, now);
        const playerWorld = samplePlayerWorld(runtimeState, playerTile, now);
        const camera = this.cameras.main;
        const sceneViewport = getRuntimeSceneViewport(runtimeState);
        const zoom = Math.max(camera.zoom, 0.001);
        const playerScreen = {
          x: sceneViewport.x + (playerWorld.x - camera.scrollX) * zoom,
          y: sceneViewport.y + (playerWorld.y - camera.scrollY) * zoom,
        };

        return (
          Math.abs(pointer.x - playerScreen.x) <= 46 * zoom &&
          pointer.y >= playerScreen.y - 92 * zoom &&
          pointer.y <= playerScreen.y + 132 * zoom
        );
      };
      objects.playerContainer.setSize(78, 126);
      objects.playerContainer.setInteractive(
        new Phaser.Geom.Rectangle(-39, -88, 78, 126),
        Phaser.Geom.Rectangle.Contains,
      );
      objects.playerContainer.on(
        "pointerdown",
        (
          _pointer: PhaserType.Input.Pointer,
          _localX: number,
          _localY: number,
          event: PhaserType.Types.Input.EventData,
        ) => {
          event.stopPropagation();
          openRowanNotebookFromScene();
        },
      );

      bindOverlayEvents(objects.overlayDom, runtimeState, options.callbacksRef);

      renderStaticScene(objects, runtimeState);
      resetRuntimeCameraForGame(runtimeState, objects);
      syncNpcMarkerObjects(objects, runtimeState, options.callbacksRef);
      renderDynamicScene(objects, runtimeState);
      renderOverlay(objects, runtimeState);

      const keyboard = this.input.keyboard;
      if (keyboard) {
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
        if (pointerHitsRowanAvatar(pointer)) {
          openRowanNotebookFromScene();
          return;
        }

        options.mount.style.cursor = "grabbing";
        beginCameraGesture(
          runtimeState,
          pointer,
          getRuntimeSceneViewport(runtimeState),
          getRuntimeNow(),
          getRuntimeCameraGestureViewport(runtimeState),
        );
      });
      this.input.on("pointermove", (pointer: PhaserType.Input.Pointer) => {
        const now = getRuntimeNow();
        const panResult = updateCameraGesture(
          runtimeState,
          pointer,
          getRuntimeSceneViewport(runtimeState),
          now,
          getRuntimeCameraGestureViewport(runtimeState),
        );
        pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, now);
      });
      this.input.on("pointerup", (pointer: PhaserType.Input.Pointer) => {
        options.mount.style.cursor = "grab";
        finishCameraGesture(runtimeState, pointer);
      });
      this.input.on("pointerupoutside", (pointer: PhaserType.Input.Pointer) => {
        options.mount.style.cursor = "grab";
        finishCameraGesture(runtimeState, pointer);
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
          const sceneViewport = getRuntimeSceneViewport(runtimeState);
          if (
            !isPointerWithinSceneViewport(
              pointer,
              getRuntimeCameraGestureViewport(runtimeState),
            )
          ) {
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
    audio: {
      noAudio: true,
    },
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
      nativeCameraPanFallback.destroy();
      runtimeState.objects = null;
      game.destroy(true);
      overlayDom.remove();
    },

    updateSnapshot(nextSnapshot) {
      const previousGameId = runtimeState.snapshot.game?.id ?? null;
      const nextGameId = nextSnapshot.game?.id ?? null;
      const gameChanged = previousGameId !== nextGameId;
      const previousActiveSpaceId = runtimeState.indices.activeSpaceId;
      runtimeState.snapshot = nextSnapshot;
      const nextMapKey = createMapKey(nextSnapshot.game);

      if (nextMapKey !== runtimeState.mapKey) {
        runtimeState.indices = createRuntimeIndices(nextSnapshot);
        runtimeState.mapKey = nextMapKey;

        if (runtimeState.objects) {
          renderStaticScene(runtimeState.objects, runtimeState);
        }
      }

      if (
        gameChanged ||
        previousActiveSpaceId !== runtimeState.indices.activeSpaceId
      ) {
        resetRuntimeCameraForGame(runtimeState, runtimeState.objects);
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

function bindNativeCameraPanFallback(
  mount: HTMLDivElement,
  runtimeState: RuntimeState,
) {
  let activePointerId: number | null = null;
  let activeStartPointer: PhaserType.Input.Pointer | null = null;
  let activeStartClientPoint: Point | null = null;
  let activeMouseStartPointer: PhaserType.Input.Pointer | null = null;
  let activeMouseStartClientPoint: Point | null = null;
  let activeTouchId: number | null = null;
  let activeTouchStartPointer: PhaserType.Input.Pointer | null = null;
  let activeTouchStartClientPoint: Point | null = null;

  const toRuntimePointerFromClient = (
    clientX: number,
    clientY: number,
    id: number,
    isDown: boolean,
  ) => {
    const rect = mount.getBoundingClientRect();
    const viewport = getRuntimeViewportSize(runtimeState);
    const relativeX = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const relativeY =
      rect.height > 0 ? (clientY - rect.top) / rect.height : 0;

    return {
      id,
      isDown,
      x: relativeX * viewport.width,
      y: relativeY * viewport.height,
    } as PhaserType.Input.Pointer;
  };

  const toRuntimePointer = (event: MouseEvent | PointerEvent | WheelEvent) =>
    toRuntimePointerFromClient(
      event.clientX,
      event.clientY,
      "pointerId" in event ? event.pointerId : -1,
      "buttons" in event ? (event.buttons & 1) === 1 : false,
    );

  const toTouchPointer = (touch: Touch, isDown: boolean) =>
    toRuntimePointerFromClient(
      touch.clientX,
      touch.clientY,
      10_000 + touch.identifier,
      isDown,
    );

  const toClientPoint = (clientX: number, clientY: number): Point => ({
    x: clientX,
    y: clientY,
  });

  const isBlockedByOverlay = (event: Event) => {
    if (isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)) {
      return true;
    }

    return isOverlayEventTarget(
      runtimeState.objects?.overlayDom ?? null,
      event.target,
    );
  };

  const isInteractiveOverlayTarget = (target: EventTarget | null) => {
    const overlayRoot = runtimeState.objects?.overlayDom ?? null;
    if (!isOverlayEventTarget(overlayRoot, target)) {
      return false;
    }

    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="tab"], [data-overlay-field-key]',
      ),
    );
  };

  const captureCameraEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const openRowanNotebookFromMap = () => {
    const objects = runtimeState.objects;
    if (!objects || !runtimeState.snapshot.game) {
      return false;
    }

    runtimeState.ui.activeTab = "mind";
    runtimeState.ui.focusPanel = "mind";
    if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
      runtimeState.ui.railExpanded = false;
    }
    renderOverlay(objects, runtimeState);
    return true;
  };

  const isClientPointOnRowanAvatar = (point: Point) => {
    const projection = runtimeState.cameraProjection;
    if (!runtimeState.snapshot.game || !projection) {
      return false;
    }

    const playerWorld = projection.playerWorldPoint;
    const sceneViewport = projection.sceneViewportCss;
    const visibleWorld = projection.visibleWorldRect;
    const playerScreen = {
      x:
        sceneViewport.x +
        ((playerWorld.x - visibleWorld.left) / visibleWorld.width) *
          sceneViewport.width,
      y:
        sceneViewport.y +
        ((playerWorld.y - visibleWorld.top) / visibleWorld.height) *
          sceneViewport.height,
    };
    const hitZoom = sceneViewport.width / visibleWorld.width;
    const bounds = {
      bottom: playerScreen.y + 132 * hitZoom,
      left: playerScreen.x - 46 * hitZoom,
      right: playerScreen.x + 46 * hitZoom,
      top: playerScreen.y - 92 * hitZoom,
    };

    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  };

  const beginNativePan = (event: PointerEvent) => {
    if (
      activeTouchId !== null ||
      event.button !== 0 ||
      !runtimeState.snapshot.game ||
      isBlockedByOverlay(event)
    ) {
      return;
    }

    const pointer = toRuntimePointer(event);
    if (
      !isPointerWithinSceneViewport(
        pointer,
        getRuntimeCameraGestureViewport(runtimeState),
      )
    ) {
      return;
    }

    activePointerId = event.pointerId;
    activeStartPointer = pointer;
    activeStartClientPoint = toClientPoint(event.clientX, event.clientY);

    try {
      mount.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best effort; browsers can reject it for synthetic events.
    }
  };

  const updateNativePan = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    const pointer = toRuntimePointer(event);
    if (!pointer.isDown) {
      activePointerId = null;
      activeStartPointer = null;
      activeStartClientPoint = null;
      mount.style.cursor = "grab";
      finishCameraGesture(runtimeState, pointer, getRuntimeNow());
      return;
    }

    const now = getRuntimeNow();
    if (
      activeStartPointer &&
      runtimeState.cameraGesture?.pointerId !== event.pointerId
    ) {
      const deltaX = pointer.x - activeStartPointer.x;
      const deltaY = pointer.y - activeStartPointer.y;
      if (Math.hypot(deltaX, deltaY) < 10) {
        return;
      }

      beginCameraGesture(
        runtimeState,
        activeStartPointer,
        getRuntimeSceneViewport(runtimeState),
        now,
        getRuntimeCameraGestureViewport(runtimeState),
      );
    }

    const panResult = updateCameraGesture(
      runtimeState,
      pointer,
      getRuntimeSceneViewport(runtimeState),
      now,
      getRuntimeCameraGestureViewport(runtimeState),
    );
    pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, now);

    if (
      runtimeState.cameraGesture?.pointerId === event.pointerId &&
      runtimeState.cameraGesture.dragging
    ) {
      mount.style.cursor = "grabbing";
      captureCameraEvent(event);
    }
  };

  const finishNativePan = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    const pointer = toRuntimePointer(event);
    const wasDragging =
      runtimeState.cameraGesture?.pointerId === event.pointerId &&
      runtimeState.cameraGesture.dragging;
    const shouldOpenRowanNotebook =
      !wasDragging &&
      activeStartClientPoint &&
      isClientPointOnRowanAvatar(activeStartClientPoint) &&
      isClientPointOnRowanAvatar(toClientPoint(event.clientX, event.clientY));
    activePointerId = null;
    activeStartPointer = null;
    activeStartClientPoint = null;
    mount.style.cursor = "grab";

    try {
      mount.releasePointerCapture(event.pointerId);
    } catch {
      // Release can fail when capture was not granted.
    }

    if (wasDragging) {
      captureCameraEvent(event);
      finishCameraGesture(runtimeState, pointer, getRuntimeNow());
      return;
    }

    if (shouldOpenRowanNotebook && openRowanNotebookFromMap()) {
      captureCameraEvent(event);
      return;
    }

    window.setTimeout(() => {
      if (
        runtimeState.cameraGesture?.pointerId === event.pointerId &&
        !runtimeState.cameraGesture.dragging
      ) {
        finishCameraGesture(runtimeState, pointer, getRuntimeNow());
      }
    }, 0);
  };

  const beginNativeMouseClick = (event: MouseEvent) => {
    if (
      activeTouchId !== null ||
      event.button !== 0 ||
      !runtimeState.snapshot.game ||
      isBlockedByOverlay(event)
    ) {
      return;
    }

    const pointer = toRuntimePointer(event);
    if (
      !isPointerWithinSceneViewport(
        pointer,
        getRuntimeCameraGestureViewport(runtimeState),
      )
    ) {
      return;
    }

    activeMouseStartPointer = pointer;
    activeMouseStartClientPoint = toClientPoint(event.clientX, event.clientY);
  };

  const finishNativeMouseClick = (event: MouseEvent) => {
    if (!activeMouseStartPointer || !activeMouseStartClientPoint) {
      return;
    }

    const startPointer = activeMouseStartPointer;
    const startClientPoint = activeMouseStartClientPoint;
    const pointer = toRuntimePointer(event);
    const moved = Math.hypot(
      pointer.x - startPointer.x,
      pointer.y - startPointer.y,
    );
    activeMouseStartPointer = null;
    activeMouseStartClientPoint = null;

    if (
      moved >= 10 ||
      !isClientPointOnRowanAvatar(startClientPoint) ||
      !isClientPointOnRowanAvatar(toClientPoint(event.clientX, event.clientY))
    ) {
      return;
    }

    if (openRowanNotebookFromMap()) {
      captureCameraEvent(event);
    }
  };

  const cancelNativePan = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    activePointerId = null;
    activeStartPointer = null;
    activeStartClientPoint = null;
    mount.style.cursor = "grab";
    finishCameraGesture(runtimeState, toRuntimePointer(event), getRuntimeNow());
  };

  const findActiveTouch = (touches: TouchList) => {
    if (activeTouchId === null) {
      return null;
    }

    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);
      if (touch?.identifier === activeTouchId) {
        return touch;
      }
    }

    return null;
  };

  const beginNativeTouchPan = (event: TouchEvent) => {
    if (
      activePointerId !== null ||
      activeTouchId !== null ||
      !runtimeState.snapshot.game ||
      isBlockedByOverlay(event)
    ) {
      return;
    }

    const touch = event.changedTouches.item(0);
    if (!touch) {
      return;
    }

    const pointer = toTouchPointer(touch, true);
    if (
      !isPointerWithinSceneViewport(
        pointer,
        getRuntimeCameraGestureViewport(runtimeState),
      )
    ) {
      return;
    }

    activeTouchId = touch.identifier;
    activeTouchStartPointer = pointer;
    activeTouchStartClientPoint = toClientPoint(touch.clientX, touch.clientY);
  };

  const updateNativeTouchPan = (event: TouchEvent) => {
    const touch =
      findActiveTouch(event.touches) ?? findActiveTouch(event.changedTouches);
    if (!touch || activeTouchId === null) {
      return;
    }

    const pointer = toTouchPointer(touch, true);
    const now = getRuntimeNow();
    if (
      activeTouchStartPointer &&
      runtimeState.cameraGesture?.pointerId !== pointer.id
    ) {
      const deltaX = pointer.x - activeTouchStartPointer.x;
      const deltaY = pointer.y - activeTouchStartPointer.y;
      if (Math.hypot(deltaX, deltaY) < 10) {
        return;
      }

      beginCameraGesture(
        runtimeState,
        activeTouchStartPointer,
        getRuntimeSceneViewport(runtimeState),
        now,
        getRuntimeCameraGestureViewport(runtimeState),
      );
    }

    const panResult = updateCameraGesture(
      runtimeState,
      pointer,
      getRuntimeSceneViewport(runtimeState),
      now,
      getRuntimeCameraGestureViewport(runtimeState),
    );
    pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, now);

    if (
      runtimeState.cameraGesture?.pointerId === pointer.id &&
      runtimeState.cameraGesture.dragging
    ) {
      captureCameraEvent(event);
    }
  };

  const finishNativeTouchPan = (event: TouchEvent) => {
    const touch = findActiveTouch(event.changedTouches);
    if (!touch || activeTouchId === null) {
      return;
    }

    const pointer = toTouchPointer(touch, false);
    const wasDragging =
      runtimeState.cameraGesture?.pointerId === pointer.id &&
      runtimeState.cameraGesture.dragging;
    const shouldOpenRowanNotebook =
      !wasDragging &&
      activeTouchStartClientPoint &&
      isClientPointOnRowanAvatar(activeTouchStartClientPoint) &&
      isClientPointOnRowanAvatar(toClientPoint(touch.clientX, touch.clientY));
    activeTouchId = null;
    activeTouchStartPointer = null;
    activeTouchStartClientPoint = null;

    if (wasDragging) {
      captureCameraEvent(event);
      finishCameraGesture(runtimeState, pointer, getRuntimeNow());
      return;
    }

    if (shouldOpenRowanNotebook && openRowanNotebookFromMap()) {
      captureCameraEvent(event);
      return;
    }

    window.setTimeout(() => {
      if (
        runtimeState.cameraGesture?.pointerId === pointer.id &&
        !runtimeState.cameraGesture.dragging
      ) {
        finishCameraGesture(runtimeState, pointer, getRuntimeNow());
      }
    }, 0);
  };

  const cancelNativeTouchPan = (event: TouchEvent) => {
    const touch = findActiveTouch(event.changedTouches);
    if (!touch || activeTouchId === null) {
      return;
    }

    activeTouchId = null;
    activeTouchStartPointer = null;
    activeTouchStartClientPoint = null;
    finishCameraGesture(
      runtimeState,
      toTouchPointer(touch, false),
      getRuntimeNow(),
    );
  };

  const panFromWheel = (event: WheelEvent) => {
    if (!runtimeState.snapshot.game || isBlockedByOverlay(event)) {
      return;
    }

    const pointer = toRuntimePointer(event);
    if (
      !isPointerWithinSceneViewport(
        pointer,
        getRuntimeCameraGestureViewport(runtimeState),
      )
    ) {
      return;
    }

    captureCameraEvent(event);
    const sceneViewport = getRuntimeSceneViewport(runtimeState);
    const wheelDelta = normalizeCameraWheelDelta(
      event.deltaX,
      event.deltaY,
      event,
      sceneViewport,
    );
    const shouldZoom = event.ctrlKey || event.metaKey || event.altKey;
    if (shouldZoom) {
      adjustCameraZoom(
        runtimeState,
        wheelDelta.y > 0 ? -CAMERA_WHEEL_ZOOM_STEP : CAMERA_WHEEL_ZOOM_STEP,
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
  };

  const openRowanNotebookFromClick = (event: MouseEvent) => {
    const textInputBlocked = isOverlayTextInputFocused(
      runtimeState.objects?.overlayDom ?? null,
    );
    const point = toClientPoint(event.clientX, event.clientY);
    const avatarHit = isClientPointOnRowanAvatar(point);
    const interactiveOverlayBlocked = isInteractiveOverlayTarget(event.target);

    if (!runtimeState.snapshot.game || textInputBlocked) {
      return;
    }

    if (!avatarHit) {
      return;
    }

    if (interactiveOverlayBlocked) {
      return;
    }

    if (openRowanNotebookFromMap()) {
      captureCameraEvent(event);
    }
  };

  const browserCameraControlWindow = window as Window & {
    __manyLivesPanCameraToEdge?: (edge: CameraEdgeName) => boolean;
  };
  const browserPanCameraToEdge = (
    edge: CameraEdgeName,
  ) => {
    if (!runtimeState.snapshot.game) {
      return false;
    }

    const sceneViewport = getRuntimeSceneViewport(runtimeState);
    const panDistance = Math.max(sceneViewport.width, sceneViewport.height) * 4;
    const panResult = adjustCameraPan(
      runtimeState,
      sceneViewport,
      {
        x:
          edge === "east"
            ? panDistance
            : edge === "west"
              ? -panDistance
              : 0,
        y:
          edge === "south"
            ? panDistance
            : edge === "north"
              ? -panDistance
              : 0,
      },
      getRuntimeNow(),
    );
    pulseCameraEdgeCue(runtimeState, panResult.blockedEdges, getRuntimeNow());
    return panResult.didMove || panResult.blockedEdges[edge];
  };
  browserCameraControlWindow.__manyLivesPanCameraToEdge =
    browserPanCameraToEdge;

  mount.addEventListener("pointerdown", beginNativePan, { capture: true });
  mount.addEventListener("pointermove", updateNativePan, { capture: true });
  mount.addEventListener("pointerup", finishNativePan, { capture: true });
  mount.addEventListener("pointercancel", cancelNativePan, { capture: true });
  mount.addEventListener("mousedown", beginNativeMouseClick, {
    capture: true,
  });
  mount.addEventListener("mouseup", finishNativeMouseClick, { capture: true });
  mount.addEventListener("touchstart", beginNativeTouchPan, {
    capture: true,
    passive: false,
  });
  mount.addEventListener("touchmove", updateNativeTouchPan, {
    capture: true,
    passive: false,
  });
  mount.addEventListener("touchend", finishNativeTouchPan, {
    capture: true,
    passive: false,
  });
  mount.addEventListener("touchcancel", cancelNativeTouchPan, {
    capture: true,
    passive: false,
  });
  mount.addEventListener("click", openRowanNotebookFromClick, {
    capture: true,
  });
  document.addEventListener("click", openRowanNotebookFromClick, {
    capture: true,
  });
  mount.addEventListener("wheel", panFromWheel, {
    capture: true,
    passive: false,
  });

  return {
    destroy() {
      mount.removeEventListener("pointerdown", beginNativePan, {
        capture: true,
      });
      mount.removeEventListener("pointermove", updateNativePan, {
        capture: true,
      });
      mount.removeEventListener("pointerup", finishNativePan, {
        capture: true,
      });
      mount.removeEventListener("pointercancel", cancelNativePan, {
        capture: true,
      });
      mount.removeEventListener("mousedown", beginNativeMouseClick, {
        capture: true,
      });
      mount.removeEventListener("mouseup", finishNativeMouseClick, {
        capture: true,
      });
      mount.removeEventListener("touchstart", beginNativeTouchPan, {
        capture: true,
      });
      mount.removeEventListener("touchmove", updateNativeTouchPan, {
        capture: true,
      });
      mount.removeEventListener("touchend", finishNativeTouchPan, {
        capture: true,
      });
      mount.removeEventListener("touchcancel", cancelNativeTouchPan, {
        capture: true,
      });
      mount.removeEventListener("click", openRowanNotebookFromClick, {
        capture: true,
      });
      document.removeEventListener("click", openRowanNotebookFromClick, {
        capture: true,
      });
      mount.removeEventListener("wheel", panFromWheel, { capture: true });
      if (
        browserCameraControlWindow.__manyLivesPanCameraToEdge ===
        browserPanCameraToEdge
      ) {
        delete browserCameraControlWindow.__manyLivesPanCameraToEdge;
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
  const agencyIntentText = createMapAgencyLabel(scene, "intent").setDepth(86);
  const agencyTargetText = createMapAgencyLabel(scene, "target").setDepth(84);

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
    agencyIntentText,
    agencyTargetText,
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

function createMapAgencyLabel(
  scene: PhaserType.Scene,
  variant: "intent" | "target",
) {
  const label = scene.add
    .text(0, 0, "", {
      align: "center",
      color: variant === "intent" ? "#fffaf0" : "#f4d99d",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: variant === "intent" ? "16px" : "12px",
      fontStyle: "700",
      letterSpacing: variant === "intent" ? 0.2 : 2.2,
    })
    .setAlpha(0)
    .setBackgroundColor(
      variant === "intent"
        ? "rgba(6, 13, 17, 0.84)"
        : "rgba(20, 17, 12, 0.78)",
    )
    .setOrigin(0.5, 1)
    .setVisible(false);

  label.setPadding(
    variant === "intent" ? 10 : 8,
    variant === "intent" ? 6 : 4,
    variant === "intent" ? 10 : 8,
    variant === "intent" ? 6 : 4,
  );
  label.setStroke("#061016", variant === "intent" ? 3 : 2);
  return label;
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
      return;
    }

    const resumeStoredButton = target.closest<HTMLElement>(
      "[data-resume-stored-game]",
    );
    if (resumeStoredButton) {
      callbacksRef.current.onResumeStoredGame();
      return;
    }

    const startNewButton = target.closest<HTMLElement>("[data-start-new-game]");
    if (startNewButton) {
      callbacksRef.current.onStartNewGame();
      return;
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
  const visibleHeight =
    Math.min(anchorRect.bottom, railRect.bottom) -
    Math.max(anchorRect.top, railRect.top);
  const minimumReadableHeight = Math.min(anchorRect.height, railRect.height, 160);
  const anchorVisible =
    anchorRect.top >= railRect.top - 1 &&
    visibleHeight >= minimumReadableHeight - 1;
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
    runtimeState.indices.activeSpace
      ? "#121b1c"
      : (getPlayableVisualScene(runtimeState.snapshot.game)?.backgroundColor ??
        "#111d23"),
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
    runtimeState.indices.visualScene || runtimeState.indices.activeSpace
      ? undefined
      : game?.map,
  );
  if (!game) {
    return;
  }

  if (runtimeState.indices.activeSpace) {
    renderInteriorSpace(objects, runtimeState.indices.activeSpace);
    drawAmbientOverlay(ambientLayer, runtimeState, world);
    objects.mapLabels = drawInteriorSpaceLabels(
      scene,
      runtimeState.indices.activeSpace,
    );
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

function renderInteriorSpace(
  objects: RuntimeObjects,
  space: SpaceDefinition,
) {
  const { structureDetailLayer, structureLayer, terrainLayer } = objects;

  for (const tile of space.tiles) {
    const origin = mapTileToWorldOrigin(tile.x, tile.y);
    if (tile.walkable) {
      const alternate = (tile.x + tile.y) % 2 === 0;
      terrainLayer.fillStyle(alternate ? 0xb9b19b : 0xc2baa3, 1);
      terrainLayer.fillRect(origin.x, origin.y, CELL, CELL);
      terrainLayer.fillStyle(0xffffff, 0.05);
      terrainLayer.fillRect(origin.x + 2, origin.y + 2, CELL - 4, 1.5);
    } else {
      terrainLayer.fillStyle(0x354648, 1);
      terrainLayer.fillRect(origin.x, origin.y, CELL, CELL);
    }
  }

  for (const object of space.objects) {
    drawInteriorObject(
      object.solid ? structureLayer : structureDetailLayer,
      object,
    );
  }

  for (const portal of space.portals) {
    const center = mapTileToWorldCenter(portal.from.x, portal.from.y);
    structureDetailLayer.fillStyle(0xd9c27a, 0.72);
    structureDetailLayer.fillRoundedRect(
      center.x - CELL * 0.28,
      center.y + CELL * 0.18,
      CELL * 0.56,
      CELL * 0.12,
      5,
    );
  }

}

function drawTeaHouseShiftState(
  layer: PhaserType.GameObjects.Graphics,
  space: SpaceDefinition,
  game: StreetGameState,
) {
  if (space.id !== "interior:tea-house") {
    return;
  }

  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const stage =
    game.firstAfternoon?.teaShiftStage ??
    (teaJob?.accepted && !teaJob.completed ? "rush" : undefined);
  if (!stage) {
    return;
  }

  const counter = mapTileToWorldCenter(8, 3);
  const tablePass = mapTileToWorldCenter(7, 5);
  const northTable = mapTileToWorldCenter(4, 3);
  const middleTable = mapTileToWorldCenter(6, 5);
  const southTable = mapTileToWorldCenter(4, 7);
  const customerAlpha = stage === "paid" ? 0.28 : stage === "counter" ? 0.62 : 0.78;

  if (stage !== "paid") {
    drawCafeCustomer(layer, {
      accent: 0x9bd0cc,
      alpha: customerAlpha,
      facing: 1,
      x: northTable.x - CELL * 1.15,
      y: northTable.y + CELL * 0.56,
    });
    drawCafeCustomer(layer, {
      accent: 0xe0bd74,
      alpha: customerAlpha * 0.92,
      facing: -1,
      x: middleTable.x + CELL * 0.98,
      y: middleTable.y + CELL * 0.56,
    });
  }

  if (stage === "rush") {
    drawCafeCustomer(layer, {
      accent: 0x78a88a,
      alpha: 0.58,
      facing: -1,
      x: counter.x - CELL * 0.95,
      y: counter.y + CELL * 0.5,
    });
    drawCafeCustomer(layer, {
      accent: 0xb98bc3,
      alpha: 0.5,
      facing: -1,
      x: counter.x - CELL * 1.36,
      y: counter.y + CELL * 0.5,
    });
    drawCafeCustomer(layer, {
      accent: 0xc88d64,
      alpha: 0.68,
      facing: 1,
      x: southTable.x - CELL * 1.04,
      y: southTable.y + CELL * 0.56,
    });
    drawCafeCup(layer, northTable.x - 10, northTable.y - 3, true);
    drawCafeCup(layer, northTable.x + 12, northTable.y - 1, true);
    drawCafeCup(layer, middleTable.x + 8, middleTable.y - 2, true);
    drawCafeCup(layer, southTable.x - 5, southTable.y - 2, true);
    drawCafeCup(layer, southTable.x + 11, southTable.y + 1, true);
    drawCafeTray(layer, tablePass.x, tablePass.y, 0xe0bd74, 0.4);
  } else if (stage === "counter") {
    drawCafeTray(layer, northTable.x - 4, northTable.y - 1, 0x9bd0cc, 0.18);
    drawCafeTray(layer, southTable.x + 6, southTable.y, 0x9bd0cc, 0.16);
    drawCafeCup(layer, counter.x + 4, counter.y - 9, false);
    drawCafeCup(layer, counter.x + 18, counter.y - 9, false);
    drawCafeCup(layer, counter.x + 32, counter.y - 8, false);
    drawCafeTray(layer, counter.x + 7, counter.y + 4, 0x9bd0cc, 0.5);
    layer.lineStyle(2.2, 0xeedaa3, 0.36);
    layer.lineBetween(counter.x - 18, counter.y + 16, counter.x + 22, counter.y + 16);
    layer.lineBetween(counter.x - 10, counter.y + 23, counter.x + 30, counter.y + 23);
  } else if (stage === "paid") {
    drawCafeTray(layer, northTable.x - 6, northTable.y, 0x9bd0cc, 0.1);
    drawCafeTray(layer, middleTable.x + 8, middleTable.y, 0x9bd0cc, 0.1);
    drawCafeTray(layer, southTable.x + 4, southTable.y, 0x9bd0cc, 0.1);
    drawCafeCup(layer, counter.x + 4, counter.y - 8, false);
    drawCafeTray(layer, counter.x + 4, counter.y + 4, 0xe0bd74, 0.32);
    layer.fillStyle(0x17110a, 0.18);
    layer.fillCircle(counter.x + 29, counter.y + 8, 7.8);
    layer.fillStyle(0xe8c66b, 0.86);
    layer.fillCircle(counter.x + 27, counter.y + 6, 6.6);
    layer.fillStyle(0x6f5425, 0.74);
    layer.fillRect(counter.x + 24.5, counter.y + 3.5, 5, 1.2);
    layer.fillRect(counter.x + 24.5, counter.y + 7.5, 5, 1.2);
  }
}

function drawCafeCustomer(
  layer: PhaserType.GameObjects.Graphics,
  options: {
    accent: number;
    alpha: number;
    facing: 1 | -1;
    x: number;
    y: number;
  },
) {
  const { accent, alpha, facing, x, y } = options;
  layer.fillStyle(0x081016, 0.16 * alpha);
  layer.fillEllipse(x, y + 12, 22, 7);
  layer.fillStyle(0x4d5b5f, 0.82 * alpha);
  layer.fillRoundedRect(x - 7, y - 14, 14, 23, 5);
  layer.fillStyle(accent, 0.84 * alpha);
  layer.fillRoundedRect(x - 4, y - 9, 8, 13, 3);
  layer.fillStyle(0xc5a176, 0.86 * alpha);
  layer.fillCircle(x + facing * 1.4, y - 21, 8.2);
  layer.fillStyle(0x4b3c2f, 0.72 * alpha);
  layer.fillEllipse(x + facing * 1.2, y - 26, 13, 5.4);
}

function drawCafeCup(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  dirty: boolean,
) {
  layer.fillStyle(0x091015, 0.14);
  layer.fillEllipse(x + 1.2, y + 7, 12, 4.5);
  layer.fillStyle(dirty ? 0xb6ab95 : 0xe6eadf, dirty ? 0.82 : 0.92);
  layer.fillRoundedRect(x - 5, y - 4, 10, 12, 3);
  layer.lineStyle(1.4, dirty ? 0x6d5b42 : 0x8a9a95, 0.52);
  layer.strokeRoundedRect(x - 5, y - 4, 10, 12, 3);
  if (dirty) {
    layer.fillStyle(0x6f5432, 0.46);
    layer.fillCircle(x - 1, y + 1, 1.9);
  }
}

function drawCafeTray(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha: number,
) {
  layer.fillStyle(0x091015, 0.12);
  layer.fillRoundedRect(x - 17, y + 10, 35, 8, 4);
  layer.fillStyle(color, alpha);
  layer.fillRoundedRect(x - 18, y + 7, 35, 8, 4);
  layer.lineStyle(1.3, 0xf4e0ab, alpha * 0.7);
  layer.lineBetween(x - 12, y + 11, x + 12, y + 11);
}

function drawInteriorObject(
  layer: PhaserType.GameObjects.Graphics,
  object: SpaceObject,
) {
  const origin = mapTileToWorldOrigin(object.x, object.y);
  const rect = {
    height: object.height * CELL,
    width: object.width * CELL,
    x: origin.x,
    y: origin.y,
  };

  if (object.kind === "rug") {
    drawInteriorRug(layer, object, rect);
    return;
  }

  const style = interiorObjectStyle(object);

  layer.fillStyle(style.fill, style.alpha);
  layer.fillRoundedRect(
    rect.x + style.inset,
    rect.y + style.inset,
    rect.width - style.inset * 2,
    rect.height - style.inset * 2,
    style.radius,
  );

  if (object.solid) {
    layer.lineStyle(2, style.stroke, 0.42);
    layer.strokeRoundedRect(
      rect.x + style.inset,
      rect.y + style.inset,
      rect.width - style.inset * 2,
      rect.height - style.inset * 2,
      style.radius,
    );
  }
}

function drawInteriorRug(
  layer: PhaserType.GameObjects.Graphics,
  object: SpaceObject,
  rect: { height: number; width: number; x: number; y: number },
) {
  const inset = 6;
  const x = rect.x + inset;
  const y = rect.y + inset;
  const width = rect.width - inset * 2;
  const height = rect.height - inset * 2;

  if (/queue/i.test(`${object.id} ${object.label ?? ""}`)) {
    const centerX = rect.x + rect.width / 2;
    const top = rect.y + CELL * 0.38;
    const bottom = rect.y + rect.height - CELL * 0.38;
    const markerCount = Math.max(2, Math.round(object.height));
    layer.lineStyle(2, 0xd7c28d, 0.16);
    layer.lineBetween(centerX, top, centerX, bottom);
    for (let index = 0; index < markerCount; index += 1) {
      const progress =
        markerCount === 1 ? 0.5 : index / Math.max(markerCount - 1, 1);
      const markerY = top + (bottom - top) * progress;
      layer.fillStyle(0x1b1610, 0.12);
      layer.fillCircle(centerX + 1, markerY + 1.2, 4.2);
      layer.fillStyle(0xd8c17f, 0.46);
      layer.fillCircle(centerX, markerY, 3.4);
    }
    return;
  }

  const isOilMat = /oil|repair/i.test(`${object.id} ${object.label ?? ""}`);
  const fill = isOilMat ? 0x5e5747 : 0x9a7b55;
  const stroke = isOilMat ? 0x292a25 : 0x70563b;
  const thread = isOilMat ? 0x8a8069 : 0xc5aa77;
  const alpha = isOilMat ? 0.34 : 0.38;

  layer.fillStyle(fill, alpha);
  layer.fillRoundedRect(x, y, width, height, 9);
  layer.lineStyle(1.2, stroke, 0.28);
  layer.strokeRoundedRect(x, y, width, height, 9);

  const stripeCount = Math.max(2, Math.floor(height / 20));
  for (let index = 1; index <= stripeCount; index += 1) {
    const stripeY = y + (height / (stripeCount + 1)) * index;
    layer.lineStyle(1, thread, 0.16);
    layer.lineBetween(x + 7, stripeY, x + width - 7, stripeY);
  }
}

function interiorObjectStyle(object: SpaceObject) {
  switch (object.kind) {
    case "wall":
      return {
        alpha: 1,
        fill: 0x354648,
        inset: 0,
        radius: 0,
        stroke: 0x233134,
      };
    case "counter":
      return {
        alpha: 0.96,
        fill: 0x7a6043,
        inset: 3,
        radius: 8,
        stroke: 0x513d2c,
      };
    case "table":
      return {
        alpha: 0.96,
        fill: 0x8f6b48,
        inset: 5,
        radius: 10,
        stroke: 0x5f452f,
      };
    case "bed":
      return {
        alpha: 0.96,
        fill: 0x7c8891,
        inset: 5,
        radius: 8,
        stroke: 0x55646e,
      };
    case "shelf":
    case "workbench":
    case "desk":
      return {
        alpha: 0.96,
        fill: 0x66513d,
        inset: 4,
        radius: 7,
        stroke: 0x3e3024,
      };
    case "stove":
      return {
        alpha: 0.95,
        fill: 0x4f5b5d,
        inset: 4,
        radius: 7,
        stroke: 0x2f3a3c,
      };
    case "bench":
      return {
        alpha: 0.94,
        fill: 0x9b7a50,
        inset: 6,
        radius: 7,
        stroke: 0x60472f,
      };
    case "rug":
    case "chair":
    default:
      return {
        alpha: object.solid ? 0.94 : 0.2,
        fill: object.solid ? 0x7e6444 : 0x9a7b55,
        inset: 6,
        radius: 8,
        stroke: 0x3e3024,
      };
  }
}

function drawInteriorSpaceLabels(
  scene: PhaserType.Scene,
  space: SpaceDefinition,
) {
  const labels: PhaserType.GameObjects.GameObject[] = [];
  const titleOrigin = mapTileToWorldOrigin(1, 1);
  labels.push(
    scene.add
      .text(titleOrigin.x, titleOrigin.y + CELL * 0.12, space.name, {
        align: "left",
        color: "#f3ead2",
        fontFamily: "Georgia, serif",
        fontSize: "20px",
        fontStyle: "700",
        letterSpacing: 1.4,
        shadow: {
          blur: 4,
          color: "#000000",
          fill: true,
          offsetX: 0,
          offsetY: 1,
        },
      })
      .setDepth(40),
  );

  for (const portal of space.portals) {
    const center = mapTileToWorldCenter(portal.from.x, portal.from.y);
    labels.push(
      scene.add
        .text(center.x, center.y + CELL * 0.42, "EXIT", {
          align: "center",
          color: "#2b2417",
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontStyle: "800",
        })
        .setOrigin(0.5)
        .setDepth(40),
    );
  }

  return labels;
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
    hideMapAgencyObjects(objects);
    syncBrowserMapAgencyProbe(objects.overlayDom, null);
    objects.playerContainer.setVisible(false);
    for (const marker of objects.npcMarkers.values()) {
      marker.container.setVisible(false);
    }
    return;
  }

  if (syncRuntimeRenderScale(objects, runtimeState)) {
    renderStaticScene(objects, runtimeState);
  }

  drawAmbientOverlay(objects.ambientLayer, runtimeState, world, now);

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
  const nearbyInteriorNpc = runtimeState.indices.activeSpace
    ? nearestAnimatedNpcWithin(animatedNpcs, playerPixel, CELL * 1.35)
    : null;
  const tightInteriorConversationNpc =
    runtimeState.indices.activeSpace &&
    activeConversationNpc &&
    nearbyInteriorNpc?.npc.id === activeConversationNpc.id
      ? nearbyInteriorNpc
      : null;
  const suppressPlayerTitleForTightInteriorConversation = Boolean(
    tightInteriorConversationNpc &&
      distanceBetween(tightInteriorConversationNpc, playerPixel) <= CELL * 1.65,
  );
  const playerLabelOffsetX = nearbyInteriorNpc
    ? nearbyInteriorNpc.x <= playerPixel.x
      ? 40
      : -40
    : 0;
  const playerAnimation = getPlayerAnimationState(
    runtimeState.playerMotion,
    now,
  );

  objects.playerContainer.setPosition(playerPixel.x, playerPixel.y);
  objects.playerName
    .setText(runtimeState.snapshot.game?.player.name ?? "Rowan")
    .setX(playerLabelOffsetX)
    .setVisible(!usingAuthoredVisualScene && !runtimeState.indices.activeSpace);
  objects.playerTitle.setX(playerLabelOffsetX);
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
    .setVisible(!suppressPlayerTitleForTightInteriorConversation)
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

  updateNpcMarkers(objects, runtimeState, animatedNpcs, now, playerPixel);
  const mapAgencyCue = buildMapAgencyCue(
    runtimeState,
    animatedNpcs,
  );
  drawDynamicOverlay(
    objects.overlayLayer,
    runtimeState,
    playerTile,
    playerPixel,
    now,
    mapAgencyCue,
  );
  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    world,
    runtimeState.snapshot.viewport,
  );
  const camera = objects.scene.cameras.main;
  const cameraFollowPixel = resolveCameraFollowPixel(
    runtimeState,
    playerPixel,
    mapAgencyCue,
  );
  const cameraBlockedEdges = updateCamera(
    camera,
    runtimeState,
    sceneViewport,
    cameraFollowPixel,
    world,
    now,
  );
  const effectiveZoom = Math.max(camera.zoom, 0.001);
  const visibleWidth = sceneViewport.width / effectiveZoom;
  const visibleHeight = sceneViewport.height / effectiveZoom;
  runtimeState.cameraProjection = {
    playerWorldPoint: playerPixel,
    sceneViewportCss: {
      height: sceneViewport.height / runtimeState.renderScale,
      width: sceneViewport.width / runtimeState.renderScale,
      x: sceneViewport.x / runtimeState.renderScale,
      y: sceneViewport.y / runtimeState.renderScale,
    },
    visibleWorldRect: {
      bottom: camera.scrollY + visibleHeight,
      height: visibleHeight,
      left: camera.scrollX,
      right: camera.scrollX + visibleWidth,
      top: camera.scrollY,
      width: visibleWidth,
    },
  };
  syncMapAgencyObjects(objects, runtimeState, playerPixel, mapAgencyCue, now);
  pulseCameraEdgeCue(runtimeState, cameraBlockedEdges, now);
  syncCameraEdgeCues(
    objects.overlayDom,
    runtimeState,
    getOverlaySceneViewport(runtimeState),
    now,
  );
  syncBrowserCameraProbe(objects.overlayDom, runtimeState, camera, sceneViewport, {
    cameraFollowPixel,
    playerPixel,
  });
  syncBrowserMovementProbe(objects.overlayDom, runtimeState);
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
  installStreetProbeAccessor(root);
}

function installStreetProbeAccessor(root: HTMLDivElement) {
  const probeWindow = window as typeof window & {
    __manyLivesStreetProbe?: () => unknown;
  };
  probeWindow.__manyLivesStreetProbe = () => {
    const script = root.querySelector<HTMLScriptElement>("#ml-browser-probe");
    const payload = script?.textContent
      ? (JSON.parse(script.textContent) as Record<string, unknown>)
      : null;
    if (!payload) {
      return payload;
    }

    const mapAgencyScript = root.querySelector<HTMLScriptElement>(
      "#ml-browser-map-agency-probe",
    );
    try {
      payload.mapAgency = mapAgencyScript?.textContent
        ? JSON.parse(mapAgencyScript.textContent)
        : null;
    } catch {
      payload.mapAgency = null;
    }

    const rectFor = (element: Element | null) => {
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    };
    const commandRail = root.querySelector<HTMLElement>(
      '[data-preserve-scroll="command-rail"]',
    );
    const directive = root.querySelector('[data-rowan-directive="true"]');
    const readableDirectiveVisible = (() => {
      if (!commandRail || !directive) {
        return null;
      }

      const railRect = commandRail.getBoundingClientRect();
      const directiveRect = directive.getBoundingClientRect();
      const visibleHeight =
        Math.min(directiveRect.bottom, railRect.bottom) -
        Math.max(directiveRect.top, railRect.top);
      const minimumReadableHeight = Math.min(
        directiveRect.height,
        railRect.height,
        120,
      );
      return (
        directiveRect.top >= railRect.top - 1 &&
        visibleHeight >= minimumReadableHeight - 1
      );
    })();
    payload.railVisibility = {
      commandRailAnchorVisible: commandRail
        ? readableDirectiveVisible
        : null,
      commandRailScrollTop: commandRail
        ? Number(commandRail.dataset.commandRailScrollTop ?? commandRail.scrollTop)
        : null,
      conversationPanelRect: rectFor(
        root.querySelector("[data-conversation-panel]"),
      ),
      directiveRect: rectFor(directive),
      railRect: rectFor(commandRail),
    };
    return payload;
  };
}

function syncBrowserMovementProbe(
  root: HTMLElement,
  runtimeState: RuntimeState,
) {
  const probeElement = root.querySelector<HTMLScriptElement>("#ml-browser-probe");
  if (!probeElement?.textContent) {
    return;
  }

  try {
    const payload = JSON.parse(probeElement.textContent) as Record<
      string,
      unknown
    >;
    payload.movement = buildBrowserMovementDiagnostics(runtimeState);
    probeElement.textContent = JSON.stringify(payload).replace(/</g, "\\u003c");
  } catch {
    // Keep the visual runtime moving if the debug probe is temporarily absent.
  }
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
  playerPixel: Point,
) {
  const game = runtimeState.snapshot.game;
  const usingAuthoredVisualScene = runtimeState.indices.visualScene !== null;
  const showActorLabels =
    !usingAuthoredVisualScene && !runtimeState.indices.activeSpace;
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
    const interiorLabelCollisionDistance = inLiveConversation
      ? CELL * 1.85
      : CELL * 1.35;
    const interiorLabelCollides =
      runtimeState.indices.activeSpace &&
      distanceBetween(animatedNpc, playerPixel) <= interiorLabelCollisionDistance;
    const showLabel = runtimeState.indices.activeSpace
      ? !interiorLabelCollides &&
        (highlight || inLiveConversation || isTalkable)
      : showActorLabels || highlight || inLiveConversation || isTalkable;
    const interiorLabelOffsetX = interiorLabelCollides
      ? animatedNpc.x <= playerPixel.x
        ? -34
        : 34
      : 0;
    const interiorLabelOffsetY = interiorLabelCollides
      ? animatedNpc.y <= playerPixel.y
        ? -34
        : 30
      : 24;
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
      .setX(interiorLabelOffsetX)
      .setY(interiorLabelOffsetY)
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

function nearestAnimatedNpcWithin(
  animatedNpcs: AnimatedNpcState[],
  playerPixel: Point,
  maximumDistance: number,
) {
  let nearestNpc: AnimatedNpcState | null = null;
  let nearestDistance = maximumDistance;

  for (const npc of animatedNpcs) {
    const distance = distanceBetween(npc, playerPixel);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestNpc = npc;
    }
  }

  return nearestNpc;
}

function hideMapAgencyObjects(objects: RuntimeObjects) {
  objects.agencyIntentText.setVisible(false).setAlpha(0);
  objects.agencyTargetText.setVisible(false).setAlpha(0);
}

function syncMapAgencyObjects(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
  playerPixel: Point,
  cue: MapAgencyCue | null,
  now: number,
) {
  if (
    runtimeState.indices.activeSpace &&
    !isRuntimePlayerMotionActive(runtimeState, now)
  ) {
    hideMapAgencyObjects(objects);
    syncBrowserMapAgencyProbe(objects.overlayDom, null);
    return;
  }

  if (!cue) {
    hideMapAgencyObjects(objects);
    syncBrowserMapAgencyProbe(objects.overlayDom, null);
    return;
  }

  const world = getWorldBounds(runtimeState.snapshot);
  const labelSafeRect = getMapAgencyLabelSafeRect(objects, runtimeState, world);
  const playerLabelVisible = pointNearVisualRect(
    playerPixel,
    labelSafeRect,
    CELL * 1.2,
  );
  const intentCopy = cue.targetWorld || cue.targetLabel
    ? cue.intent
    : cue.detail
      ? `${cue.intent}\n${cue.detail}`
      : cue.intent;
  const closeInteractionSuppressed = Boolean(
    runtimeState.indices.activeSpace &&
      cue.tone === "conversation" &&
      cue.targetIsNpc &&
      cue.targetWorld &&
      distanceBetween(playerPixel, cue.targetWorld) <= CELL * 1.65,
  );
  const intentHalfWidth = estimateMapAgencyLabelHalfWidth(intentCopy, "intent");
  const intentPosition = clampMapAgencyLabelPosition(
    {
      x: playerPixel.x,
      y:
        playerPixel.y -
        (runtimeState.indices.visualScene ? CELL * 1.88 : CELL * 1.56),
    },
    world,
    intentHalfWidth,
    54,
    labelSafeRect,
  );
  const labelPulse = 0.92 + Math.sin(now / 560) * 0.035;
  const showIntentLabel = playerLabelVisible && !closeInteractionSuppressed;

  if (showIntentLabel) {
    setMapAgencyLabel(objects.agencyIntentText, intentCopy, intentPosition, {
      alpha: labelPulse,
      background:
        cue.tone === "conversation"
          ? "rgba(5, 20, 23, 0.86)"
          : "rgba(7, 13, 18, 0.84)",
      color: "#fffaf0",
    });
  } else {
    objects.agencyIntentText.setVisible(false).setAlpha(0);
  }

  let targetCopy: string | null = cue.targetLabel;
  const showTargetLabel =
    cue.targetWorld &&
    cue.targetLabel &&
    pointNearVisualRect(cue.targetWorld, labelSafeRect, CELL * 0.7) &&
    distanceBetween(playerPixel, cue.targetWorld) >
      (cue.targetIsNpc ? CELL * 1.45 : CELL * 1.8);

  if (showTargetLabel && cue.targetWorld && cue.targetLabel) {
    targetCopy = cue.targetLabel.toUpperCase();
    const targetHalfWidth = estimateMapAgencyLabelHalfWidth(
      targetCopy,
      "target",
    );
    const targetPosition = clampMapAgencyLabelPosition(
      {
        x: cue.targetWorld.x,
        y: cue.targetWorld.y - (cue.targetIsNpc ? CELL * 0.86 : CELL * 0.62),
      },
      world,
      targetHalfWidth,
      34,
      labelSafeRect,
    );
    setMapAgencyLabel(
      objects.agencyTargetText,
      targetCopy,
      targetPosition,
      {
        alpha: 0.8 + Math.sin(now / 640) * 0.035,
        background: "rgba(28, 22, 14, 0.72)",
        color: "#f4d99d",
      },
    );
  } else {
    objects.agencyTargetText.setVisible(false).setAlpha(0);
  }

  syncBrowserMapAgencyProbe(objects.overlayDom, cue, {
    closeInteractionSuppressed,
    intentText: intentCopy,
    intentVisible: showIntentLabel,
    targetText: targetCopy,
    targetVisible: Boolean(showTargetLabel),
  });
}

function setMapAgencyLabel(
  label: PhaserType.GameObjects.Text,
  text: string,
  point: Point,
  options: {
    alpha: number;
    background: string;
    color: string;
  },
) {
  label
    .setText(text)
    .setColor(options.color)
    .setBackgroundColor(options.background)
    .setPosition(Math.round(point.x), Math.round(point.y))
    .setVisible(true)
    .setAlpha(clamp(options.alpha, 0, 1));
}

function pointNearVisualRect(point: Point, rect: VisualRect, margin: number) {
  return !(
    point.x < rect.x - margin ||
    point.y < rect.y - margin ||
    point.x > rect.x + rect.width + margin ||
    point.y > rect.y + rect.height + margin
  );
}

function clampMapAgencyLabelPosition(
  point: Point,
  world: { height: number; width: number },
  halfWidth: number,
  height: number,
  safeRect?: VisualRect,
) {
  const worldMinX = halfWidth + 10;
  const worldMaxX = Math.max(worldMinX, world.width - halfWidth - 10);
  const worldMinY = height + 10;
  const worldMaxY = Math.max(worldMinY, world.height - 10);
  let minX = worldMinX;
  let maxX = worldMaxX;
  let minY = worldMinY;
  let maxY = worldMaxY;

  if (safeRect) {
    minX = Math.max(minX, safeRect.x + halfWidth);
    maxX = Math.min(maxX, safeRect.x + safeRect.width - halfWidth);
    minY = Math.max(minY, safeRect.y + height);
    maxY = Math.min(maxY, safeRect.y + safeRect.height);

    if (maxX < minX) {
      const visibleMidX = safeRect.x + safeRect.width / 2;
      const clampedMidX = clamp(visibleMidX, worldMinX, worldMaxX);
      minX = clampedMidX;
      maxX = clampedMidX;
    }

    if (maxY < minY) {
      const visibleMidY = safeRect.y + safeRect.height / 2;
      const clampedMidY = clamp(visibleMidY, worldMinY, worldMaxY);
      minY = clampedMidY;
      maxY = clampedMidY;
    }
  }

  return {
    x: clamp(point.x, minX, maxX),
    y: clamp(point.y, minY, maxY),
  };
}

function estimateMapAgencyLabelHalfWidth(
  text: string,
  variant: "intent" | "target",
) {
  const longestLineLength = text
    .split("\n")
    .reduce((maxLength, line) => Math.max(maxLength, line.trim().length), 0);
  const characterWidth = variant === "intent" ? 8.8 : 8.2;
  const padding = variant === "intent" ? 24 : 22;
  const minimum = variant === "intent" ? 150 : 110;
  const maximum = variant === "intent" ? 220 : 180;

  return clamp(
    Math.round((longestLineLength * characterWidth + padding) / 2),
    minimum,
    maximum,
  );
}

function getMapAgencyLabelSafeRect(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
  world: { height: number; width: number },
): VisualRect {
  const camera = objects.scene.cameras.main;
  const sceneViewport = getRuntimeSceneViewport(runtimeState);
  const zoom = Math.max(camera.zoom, 0.001);
  const visibleWidth = Math.min(sceneViewport.width / zoom, world.width);
  const visibleHeight = Math.min(sceneViewport.height / zoom, world.height);
  const compactPortrait =
    isCompactViewport(runtimeState.snapshot.viewport) &&
    runtimeState.snapshot.viewport.height > runtimeState.snapshot.viewport.width;
  const sideGutter = (compactPortrait ? 92 : 54) / zoom;
  const topGutter = (compactPortrait ? 54 : 24) / zoom;
  const bottomGutter = (compactPortrait ? 170 : 36) / zoom;
  const x = clamp(camera.scrollX + sideGutter, 0, world.width);
  const y = clamp(camera.scrollY + topGutter, 0, world.height);
  const maxWidth = Math.max(world.width - x, 1);
  const maxHeight = Math.max(world.height - y, 1);

  return {
    height: Math.min(Math.max(visibleHeight - topGutter - bottomGutter, 1), maxHeight),
    width: Math.min(Math.max(visibleWidth - sideGutter * 2, 1), maxWidth),
    x,
    y,
  };
}

function buildMapAgencyCue(
  runtimeState: RuntimeState,
  animatedNpcs: AnimatedNpcState[],
): MapAgencyCue | null {
  const game = runtimeState.snapshot.game;
  if (!game) {
    return null;
  }

  if (runtimeState.indices.activeSpace) {
    return buildInteriorMapAgencyCue(runtimeState, animatedNpcs);
  }

  const autonomy = game.rowanAutonomy ?? FALLBACK_ROWAN_AUTONOMY;
  const activeConversation = game.activeConversation;
  const pendingMove = game.player.pendingObjectiveMove;
  const shouldShowCue =
    autonomy.autoContinue ||
    Boolean(activeConversation) ||
    Boolean(pendingMove) ||
    Boolean(runtimeState.waypointTarget);

  if (!shouldShowCue) {
    return null;
  }

  const targetNpc =
    resolveNpcById(game, activeConversation?.npcId) ??
    resolveNpcById(game, autonomy.npcId) ??
    resolveNpcById(game, pendingMove?.npcId);
  const conversationLike =
    Boolean(activeConversation) ||
    autonomy.mode === "conversation" ||
    autonomy.stepKind === "talk";
  const targetLocationId =
    activeConversation?.locationId ??
    autonomy.targetLocationId ??
    pendingMove?.targetLocationId ??
    targetNpc?.currentLocationId ??
    null;
  const targetLocation = targetLocationId
    ? runtimeState.indices.locationsById.get(targetLocationId) ?? null
    : null;
  const npcWorld = targetNpc
    ? getAnimatedNpcWorldPoint(animatedNpcs, targetNpc.id) ??
      getMapAgencyLocationWorldPoint(runtimeState, targetNpc.currentLocationId)
    : null;
  const locationWorld = targetLocationId
    ? getMapAgencyLocationWorldPoint(runtimeState, targetLocationId)
    : null;
  const locationTile = targetLocation
    ? {
        x: targetLocation.entryX,
        y: targetLocation.entryY,
      }
    : null;
  const waypointWorld = runtimeState.waypointTarget
    ? projectRuntimeTileCenter(
        runtimeState.indices,
        runtimeState.waypointTarget.x,
        runtimeState.waypointTarget.y,
      )
    : null;
  const targetWorld =
    conversationLike && npcWorld
      ? npcWorld
      : locationWorld ?? npcWorld ?? waypointWorld;
  const targetIsNpc = Boolean(
    conversationLike && npcWorld && targetWorld === npcWorld,
  );
  const targetTile =
    runtimeState.waypointTarget ??
    locationTile ??
    (targetNpc?.currentLocationId
      ? getMapAgencyLocationTile(runtimeState, targetNpc.currentLocationId)
      : null);
  const targetLabel = buildMapAgencyTargetLabel({
    conversationLike,
    targetLocation,
    targetNpc,
  });
  const tone = normalizeMapAgencyTone(autonomy.mode);
  const intent = buildMapAgencyIntent({
    activeConversation: Boolean(activeConversation),
    autonomy,
    targetLocation,
    targetNpc,
  });
  const detail = buildMapAgencyDetail({
    activeConversation,
    autonomy,
    game,
    pendingMove,
    targetLocation,
  });

  if (!targetWorld && !intent) {
    return null;
  }

  return {
    detail,
    intent,
    targetIsNpc,
    targetLabel,
    targetLocationId,
    targetTile,
    targetWorld,
    tone,
  };
}

function buildInteriorMapAgencyCue(
  runtimeState: RuntimeState,
  animatedNpcs: AnimatedNpcState[],
): MapAgencyCue | null {
  const game = runtimeState.snapshot.game;
  const space = runtimeState.indices.activeSpace;
  if (!game || !space) {
    return null;
  }

  const autonomy = game.rowanAutonomy ?? FALLBACK_ROWAN_AUTONOMY;
  const activeConversation = game.activeConversation;
  const pendingMove = game.player.pendingObjectiveMove;
  const shouldShowCue =
    autonomy.autoContinue ||
    Boolean(activeConversation) ||
    Boolean(runtimeState.waypointTarget);

  if (!shouldShowCue) {
    return null;
  }

  const targetNpc =
    resolveNpcById(game, activeConversation?.npcId) ??
    resolveNpcById(game, autonomy.npcId) ??
    resolveNpcById(game, pendingMove?.npcId);
  const conversationLike =
    Boolean(activeConversation) ||
    autonomy.mode === "conversation" ||
    autonomy.stepKind === "talk";
  const anchor = resolveInteriorMapAgencyAnchor({
    activeConversationNpcId: activeConversation?.npcId,
    actionId: autonomy.actionId,
    npcId: targetNpc?.id ?? autonomy.npcId ?? pendingMove?.npcId,
    space,
  });
  const waypointTile = runtimeState.waypointTarget
    ? {
        x: Math.round(runtimeState.waypointTarget.x),
        y: Math.round(runtimeState.waypointTarget.y),
      }
    : null;
  const targetTile = anchor
    ? { x: anchor.x, y: anchor.y }
    : waypointTile;
  const animatedNpcWorld = targetNpc
    ? getAnimatedNpcWorldPoint(animatedNpcs, targetNpc.id)
    : null;
  const anchorWorld = targetTile
    ? projectRuntimeTileCenter(runtimeState.indices, targetTile.x, targetTile.y)
    : null;
  const targetWorld =
    conversationLike && animatedNpcWorld
      ? animatedNpcWorld
      : anchorWorld ?? animatedNpcWorld;

  if (!targetWorld) {
    return null;
  }

  return {
    detail: buildMapAgencyDetail({
      activeConversation,
      autonomy,
      game,
      pendingMove,
      targetLocation:
        game.player.currentLocationId
          ? runtimeState.indices.locationsById.get(game.player.currentLocationId) ?? null
          : null,
    }),
    intent: activeConversation && targetNpc
      ? `With ${targetNpc.name}`
      : conversationLike && targetNpc
        ? `Talk with ${targetNpc.name}`
        : compactMapAgencyCopy(autonomy.label || anchor?.label || "Next step", 34),
    targetIsNpc: Boolean(conversationLike && targetNpc),
    targetLabel:
      conversationLike && targetNpc
        ? null
        : anchor?.label
          ? `Next: ${anchor.label}`
          : null,
    targetLocationId: game.player.currentLocationId ?? null,
    targetTile,
    targetWorld,
    tone: normalizeMapAgencyTone(autonomy.mode),
  };
}

function resolveInteriorMapAgencyAnchor({
  activeConversationNpcId,
  actionId,
  npcId,
  space,
}: {
  activeConversationNpcId?: string | null;
  actionId?: string | null;
  npcId?: string | null;
  space: SpaceDefinition;
}) {
  if (activeConversationNpcId) {
    return (
      space.anchors.find(
        (anchor) => anchor.actionId === `talk:${activeConversationNpcId}`,
      ) ??
      space.anchors.find((anchor) => anchor.npcId === activeConversationNpcId) ??
      null
    );
  }

  if (actionId) {
    const actionAnchor = space.anchors.find(
      (anchor) => anchor.actionId === actionId,
    );
    if (actionAnchor) {
      return actionAnchor;
    }
  }

  if (npcId) {
    return (
      space.anchors.find((anchor) => anchor.actionId === `talk:${npcId}`) ??
      space.anchors.find((anchor) => anchor.npcId === npcId) ??
      null
    );
  }

  return null;
}

function resolveCameraFollowPixel(
  runtimeState: RuntimeState,
  playerPixel: Point,
  cue: MapAgencyCue | null,
) {
  if (
    !runtimeState.indices.activeSpace ||
    !cue?.targetWorld ||
    runtimeState.cameraGesture?.dragging
  ) {
    return playerPixel;
  }

  const distance = distanceBetween(playerPixel, cue.targetWorld);
  if (distance < CELL * 0.75) {
    return playerPixel;
  }

  return {
    x: playerPixel.x * 0.58 + cue.targetWorld.x * 0.42,
    y: playerPixel.y * 0.6 + cue.targetWorld.y * 0.4,
  };
}

function resolveNpcById(game: StreetGameState, npcId?: string | null) {
  return npcId ? game.npcs.find((npc) => npc.id === npcId) ?? null : null;
}

function getAnimatedNpcWorldPoint(
  animatedNpcs: AnimatedNpcState[],
  npcId: string,
) {
  const animatedNpc = animatedNpcs.find((entry) => entry.npc.id === npcId);
  return animatedNpc ? { x: animatedNpc.x, y: animatedNpc.y } : null;
}

function getMapAgencyLocationWorldPoint(
  runtimeState: RuntimeState,
  locationId: string,
) {
  const game = runtimeState.snapshot.game;
  const location = runtimeState.indices.locationsById.get(locationId);
  if (!game || !location) {
    return null;
  }

  const point = {
    x: location.entryX,
    y: location.entryY,
  };

  return (
    resolveAuthoredLocationWorldPoint({
      conversationLocationId: game.activeConversation?.locationId,
      indices: runtimeState.indices,
      locationId,
      point,
    }) ?? projectRuntimeTileCenter(runtimeState.indices, point.x, point.y)
  );
}

function getMapAgencyLocationTile(
  runtimeState: RuntimeState,
  locationId: string,
) {
  const location = runtimeState.indices.locationsById.get(locationId);
  return location
    ? {
        x: location.entryX,
        y: location.entryY,
      }
    : null;
}

function buildMapAgencyTargetLabel({
  conversationLike,
  targetLocation,
  targetNpc,
}: {
  conversationLike: boolean;
  targetLocation: LocationState | null;
  targetNpc: NpcState | null;
}) {
  if (conversationLike && targetNpc) {
    return null;
  }

  if (targetLocation) {
    return `Next: ${mapAgencyLocationName(targetLocation)}`;
  }

  if (targetNpc) {
    return `Find: ${targetNpc.name}`;
  }

  return null;
}

function buildMapAgencyIntent({
  activeConversation,
  autonomy,
  targetLocation,
  targetNpc,
}: {
  activeConversation: boolean;
  autonomy: StreetGameState["rowanAutonomy"];
  targetLocation: LocationState | null;
  targetNpc: NpcState | null;
}) {
  if (activeConversation && targetNpc) {
    return `With ${targetNpc.name}`;
  }

  if (autonomy.mode === "moving" && targetLocation) {
    return `Heading to ${mapAgencyLocationName(targetLocation)}`;
  }

  if (autonomy.mode === "conversation" && targetNpc) {
    return `Talk with ${targetNpc.name}`;
  }

  if (autonomy.mode === "acting") {
    return compactMapAgencyCopy(autonomy.label || "Taking the next step", 34);
  }

  if (autonomy.mode === "waiting") {
    return "Letting a little time pass";
  }

  if (autonomy.mode === "blocked") {
    return "Needs another way forward";
  }

  return autonomy.autoContinue ? "Choosing the next step" : "Looking around";
}

function buildMapAgencyDetail({
  activeConversation,
  autonomy,
  game,
  pendingMove,
  targetLocation,
}: {
  activeConversation?: StreetGameState["activeConversation"];
  autonomy: StreetGameState["rowanAutonomy"];
  game: StreetGameState;
  pendingMove?: StreetGameState["player"]["pendingObjectiveMove"];
  targetLocation: LocationState | null;
}) {
  if (activeConversation?.objectiveText) {
    return compactMapAgencyCopy(`Goal: ${activeConversation.objectiveText}`, 58);
  }

  if (activeConversation?.decision) {
    return compactMapAgencyCopy(activeConversation.decision, 58);
  }

  if (activeConversation) {
    const latestNpcLine = [...activeConversation.lines]
      .reverse()
      .find((entry) => entry.speaker === "npc");
    return compactMapAgencyCopy(
      latestNpcLine
        ? `${latestNpcLine.speakerName}: ${latestNpcLine.text}`
        : "Listening for what matters next.",
      58,
    );
  }

  if (pendingMove?.rationale) {
    return compactMapAgencyCopy(pendingMove.rationale, 58);
  }

  if (pendingMove?.objectiveText) {
    return compactMapAgencyCopy(`Goal: ${pendingMove.objectiveText}`, 58);
  }

  if (autonomy.intent?.reason) {
    return compactMapAgencyCopy(autonomy.intent.reason, 58);
  }

  if (autonomy.mode === "moving" && targetLocation) {
    return `Next stop: ${mapAgencyLocationName(targetLocation)}.`;
  }

  if (game.player.objective?.text) {
    return compactMapAgencyCopy(`Goal: ${game.player.objective.text}`, 58);
  }

  if (autonomy.detail && autonomy.detail !== autonomy.label) {
    return compactMapAgencyCopy(autonomy.detail, 58);
  }

  return compactMapAgencyCopy(buildPlayerThought(game), 58);
}

function buildWatchModePrimaryContinueCopy({
  autonomy,
  firstAfternoonOpening,
  targetLocation,
  targetNpc,
}: {
  autonomy: StreetGameState["rowanAutonomy"];
  firstAfternoonOpening: boolean;
  targetLocation: LocationState | null;
  targetNpc: NpcState | null;
}) {
  if (firstAfternoonOpening) {
    return "Rowan starts by asking Mara.";
  }

  const label = autonomy.label.trim();
  const targetLocationName = targetLocation
    ? mapAgencyLocationName(targetLocation)
    : null;

  if (autonomy.mode === "conversation") {
    if (targetNpc) {
      return `Rowan is about to ask ${targetNpc.name} in person.`;
    }

    const talkMatch = label.match(/^Talk to (.+)$/i);
    if (talkMatch?.[1]) {
      return `Rowan is about to ask ${talkMatch[1]} in person.`;
    }

    return "Rowan is starting the next conversation.";
  }

  if (
    /lunch rush/i.test(label) ||
    /lunch rush/i.test(autonomy.detail) ||
    autonomy.actionId?.startsWith("work:")
  ) {
    return "Rowan is keeping the lunch rush moving.";
  }

  if (/exit to south quay/i.test(label) || autonomy.actionId?.startsWith("exit:")) {
    return targetLocationName
      ? `Rowan is stepping back into South Quay toward ${targetLocationName}.`
      : "Rowan is stepping back into South Quay.";
  }

  if (/enter kettle/i.test(label)) {
    return "Rowan is stepping into Kettle & Lamp.";
  }

  if (/^Enter /i.test(label) && targetLocationName) {
    return `Rowan is stepping into ${targetLocationName}.`;
  }

  if (/kettle|cafe|ada/i.test(label)) {
    return "Rowan is turning Mara's lead toward Kettle & Lamp.";
  }

  if (autonomy.mode === "moving" && targetLocationName) {
    return `Rowan is heading toward ${targetLocationName}.`;
  }

  if (autonomy.mode === "waiting") {
    return "Rowan is letting the clock carry this beat.";
  }

  if (label) {
    return `Rowan is taking the next visible step: ${label}.`;
  }

  return "Rowan is choosing the next visible step.";
}

function buildManualPrimaryContinueCopy({
  autonomy,
  firstAfternoonOpening,
  targetLocation,
  targetNpc,
}: {
  autonomy: StreetGameState["rowanAutonomy"];
  firstAfternoonOpening: boolean;
  targetLocation: LocationState | null;
  targetNpc: NpcState | null;
}) {
  if (firstAfternoonOpening) {
    return "Start with the person who runs Morrow House.";
  }

  const label = autonomy.label.trim();
  const targetLocationName = targetLocation
    ? mapAgencyLocationName(targetLocation)
    : null;

  if (autonomy.mode === "moving") {
    return targetLocationName
      ? `Move Rowan toward ${targetLocationName}.`
      : "Move Rowan there.";
  }

  if (autonomy.mode === "waiting") {
    return "Let the clock carry this beat.";
  }

  if (autonomy.mode === "conversation") {
    if (targetNpc) {
      return `Start the conversation with ${targetNpc.name}.`;
    }

    return "Start the conversation.";
  }

  if (/lunch rush/i.test(label) || autonomy.actionId?.startsWith("work:")) {
    return "Work the lunch rush.";
  }

  if (/exit to south quay/i.test(label) || autonomy.actionId?.startsWith("exit:")) {
    return targetLocationName
      ? `Step into South Quay toward ${targetLocationName}.`
      : "Step into South Quay.";
  }

  if (/^Enter /i.test(label) && targetLocationName) {
    return `Enter ${targetLocationName}.`;
  }

  if (label) {
    return label.endsWith(".") ? label : `${label}.`;
  }

  return "Let Rowan follow through.";
}

function buildActiveConversationContinueCopy({
  npc,
  rowanAutoplayEnabled,
}: {
  npc: NpcState | null;
  rowanAutoplayEnabled: boolean;
}) {
  if (npc?.id === "npc-mara") {
    return rowanAutoplayEnabled
      ? "Let Mara's lead about Ada and Kettle & Lamp land."
      : "Let Mara's lead land.";
  }

  if (npc?.id === "npc-ada") {
    return rowanAutoplayEnabled
      ? "Let Ada answer whether the lunch shift is real."
      : "Let Ada's answer land.";
  }

  if (npc) {
    return rowanAutoplayEnabled
      ? `Let Rowan hear ${npc.name}'s answer.`
      : `Let ${npc.name}'s answer land.`;
  }

  return rowanAutoplayEnabled
    ? "Let the conversation move forward."
    : "Let the conversation land.";
}

function normalizeMapAgencyTone(
  mode: StreetGameState["rowanAutonomy"]["mode"],
): MapAgencyTone {
  return mode;
}

function mapAgencyLocationName(location: LocationState) {
  return location.name || location.shortLabel;
}

function compactMapAgencyCopy(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const cutAt = normalized.lastIndexOf(" ", maxLength - 3);
  return `${normalized.slice(0, cutAt > 28 ? cutAt : maxLength - 3).trim()}...`;
}

function buildBrowserMovementDiagnostics(
  runtimeState: RuntimeState,
): StreetBrowserMovementDiagnostics {
  warmBrowserPatrolDiagnostics(runtimeState);

  const now = getRuntimeNow();
  const motion = runtimeState.playerMotion;
  const routeWorldPath =
    motion.worldPath && motion.worldPath.length > 1
      ? motion.worldPath
      : motion.path.length > 1
        ? motion.path.map((point) =>
            projectVisualNavigationTileCenter(
              runtimeState.indices.visualScene,
              Math.round(point.x),
              Math.round(point.y),
            ),
          )
        : [];
  const routeSettled = isPlayerMotionSettled(motion, now);
  const sampledPointsLegal =
    routeWorldPath.length > 1
      ? isVisualWorldPathLegal(
          routeWorldPath,
          runtimeState.indices.walkableRuntimePoints,
        )
      : false;
  const diagnostics = motion.routeDiagnostics ?? {
    blockedByVisualScene: runtimeState.indices.blockedNavigationTileCount,
    legal: sampledPointsLegal,
    reachesDestination: routeWorldPath.length > 1,
    sampledPointsLegal,
    snappedEnd: false,
    snappedStart: false,
    visualObstaclesClear: sampledPointsLegal,
  };

  return {
    activeSpaceId: runtimeState.indices.activeSpaceId,
    npcPatrols: Array.from(runtimeState.indices.patrolDiagnosticsByKey.values())
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((entry) => ({
        droppedWaypoints: entry.droppedWaypoints,
        key: entry.key,
        locationId: entry.locationId,
        nextLocationId: entry.nextLocationId,
        pathLength: entry.pathLength,
        requestedWaypoints: entry.requestedWaypoints,
        routed: entry.routed,
        snappedWaypoints: entry.snappedWaypoints,
        unreachableSegments: entry.unreachableSegments,
        usedVisualHints: entry.usedVisualHints,
    })),
    playerRoute:
      !routeSettled && routeWorldPath.length > 1 && motion.path.length > 1
        ? {
            active: !routeSettled,
            diagnostics,
            durationMs: Math.round(motion.durationMs),
            legal: diagnostics.legal,
            progress: roundBrowserNumber(
              clamp((now - motion.startedAt) / motion.durationMs, 0, 1),
            ),
            reachesDestination: diagnostics.reachesDestination,
            sampledPointsLegal: diagnostics.sampledPointsLegal,
            spaceId: runtimeState.indices.activeSpaceId,
            target: roundBrowserPoint(motion.to),
            tilePath: motion.path.map(roundBrowserPoint),
            visualObstaclesClear: diagnostics.visualObstaclesClear,
            worldPath: routeWorldPath.map(roundBrowserPoint),
          }
        : null,
  };
}

function warmBrowserPatrolDiagnostics(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  if (!game) {
    return;
  }

  for (const location of game.locations) {
    getCachedPatrolPath(runtimeState.indices, {
      door: runtimeState.indices.primaryDoorByLocation.get(location.id),
      findRoute: runtimeState.indices.routeFinder,
      location,
      props: runtimeState.indices.propsByLocation.get(location.id) ?? [],
      visualHints: getVisualPatrolHints(runtimeState.indices, location.id),
      walkableRuntimePoints: runtimeState.indices.walkableRuntimePoints,
    });
  }
}

function roundBrowserPoint(point: Point) {
  return {
    x: roundBrowserNumber(point.x),
    y: roundBrowserNumber(point.y),
  };
}

function roundBrowserNumber(value: number) {
  return Math.round(value * 1000) / 1000;
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
  const currentLocationId =
    game.player.currentLocationId ?? game.currentScene.locationId;
  const scenePersonIds = new Set(
    game.currentScene.people.map((person) => person.id),
  );
  const nearbyNpcs = game.npcs.filter(
    (npc) =>
      scenePersonIds.has(npc.id) ||
      talkableNpcIds.has(npc.id) ||
      (Boolean(currentLocationId) && npc.currentLocationId === currentLocationId),
  );
  const nearbyNpcIds = new Set(nearbyNpcs.map((npc) => npc.id));
  const rosterNpcs = game.npcs
    .filter((npc) => !nearbyNpcIds.has(npc.id))
    .slice(0, 5);
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
  const peoplePanelNpc = selectedNpc ?? nearbyNpcs[0] ?? null;
  const peoplePanelConversationLines = peoplePanelNpc
    ? getConversationPreview(game, peoplePanelNpc.id)
    : [];
  const peoplePanelConversationThread = peoplePanelNpc
    ? getConversationThreadState(game, peoplePanelNpc.id)
    : undefined;
  const peoplePanelActiveConversation =
    peoplePanelNpc && game.activeConversation?.npcId === peoplePanelNpc.id
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
    ? focusPanelMeta(focusPanel, selectedNpc, game, nearbyNpcs.length)
    : null;
  const focusContent =
    focusPanel === "people"
      ? buildPeopleTabHtml({
          conversationDecision:
            peoplePanelActiveConversation?.decision ??
            peoplePanelConversationThread?.decision,
          conversationLines: peoplePanelConversationLines,
          conversationObjectiveText:
            peoplePanelActiveConversation?.objectiveText ??
            peoplePanelConversationThread?.objectiveText,
          conversationSummary: peoplePanelConversationThread?.summary,
          conversationUpdatedAt:
            peoplePanelActiveConversation?.updatedAt ??
            peoplePanelConversationThread?.updatedAt,
          currentObjectiveText,
          currentSummary,
          currentThought,
          nearbyNpcs,
          rosterNpcs,
          selectedNpc: peoplePanelNpc,
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
  const watchModeClass = snapshot.rowanAutoplayEnabled
    ? "is-watch-mode"
    : "";
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
    watchMode: snapshot.rowanAutoplayEnabled,
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
    (!isBlockingRowanPlaybackForGame(snapshot.rowanPlayback, game) ||
      conversationCanAdvanceDuringReplay) &&
    (!conversationReplayActive || conversationCanAdvanceDuringReplay) &&
    !visualMovePending;
  const watchModeCarriesObjective =
    snapshot.rowanAutoplayEnabled &&
    !snapshot.rowanAutoplayFrozen &&
    rowanAutonomy.autoContinue;
  const showPrimaryContinue =
    canAdvanceObjectiveManually &&
    rowanAutonomy.autoContinue &&
    !snapshot.busyLabel &&
    !watchModeCarriesObjective;
  const firstAfternoonOpening = isFirstAfternoonOpening(game);
  const activeConversationContinueLabel = rowanAutonomy.label.startsWith(
    "With ",
  )
    ? `Finish with ${rowanAutonomy.label.slice("With ".length)}`
    : "Continue conversation";
  const primaryContinueTargetLocation = rowanAutonomy.targetLocationId
    ? locationById.get(rowanAutonomy.targetLocationId) ?? null
    : null;
  const primaryContinueTargetNpc = rowanAutonomy.npcId
    ? (game.npcs.find((npc) => npc.id === rowanAutonomy.npcId) ?? null)
    : null;
  const primaryContinueLabel = snapshot.rowanAutoplayEnabled
    ? firstAfternoonOpening
      ? "Watch Rowan begin"
      : "Continue watching"
    : game.activeConversation
      ? activeConversationContinueLabel
      : rowanAutonomy.label || "Continue";
  const primaryContinueCopy = game.activeConversation
    ? buildActiveConversationContinueCopy({
        npc: selectedNpc,
        rowanAutoplayEnabled: snapshot.rowanAutoplayEnabled,
      })
    : snapshot.rowanAutoplayEnabled
      ? buildWatchModePrimaryContinueCopy({
          autonomy: rowanAutonomy,
          firstAfternoonOpening,
          targetLocation: primaryContinueTargetLocation,
          targetNpc: primaryContinueTargetNpc,
        })
      : buildManualPrimaryContinueCopy({
          autonomy: rowanAutonomy,
          firstAfternoonOpening,
          targetLocation: primaryContinueTargetLocation,
          targetNpc: primaryContinueTargetNpc,
        });
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
  const firstAfternoonComplete = Boolean(game.firstAfternoon?.completedAt);
  const firstAfternoonFieldNoteHtml = firstAfternoonComplete && !focusPanel
    ? buildFirstAfternoonFieldNoteHtml(game)
    : "";
  const secondaryActions = (
    firstAfternoonComplete ? [] : availableActionsForRail
  ).slice(0, width <= 1080 ? 4 : 5);
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
    !firstAfternoonComplete &&
    !railActiveConversation &&
    !isBlockingRowanPlaybackForGame(snapshot.rowanPlayback, game);
  const debugRailHtml = buildRuntimeDebugHtml(game);
  const hasRailMore =
    railContextEntries.length > 0 ||
    secondaryActions.length > 0 ||
    (showManualTimeControls && waitOptions.length > 0) ||
    Boolean(debugRailHtml);
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
  const compactPrimaryActionHtml = showPrimaryContinue
    ? `
      <button
        class="ml-compact-primary-action ${
          snapshot.rowanAutoplayEnabled ? "is-autoplay-nudge" : ""
        }"
        data-advance-objective="true"
        type="button"
        aria-label="${escapeHtml(primaryContinueLabel)}"
      >
        <span class="ml-compact-primary-action-label">${escapeHtml(
          primaryContinueLabel,
        )}</span>
        <span class="ml-compact-primary-action-copy">${escapeHtml(
          primaryContinueCopy,
        )}</span>
      </button>
    `
    : "";
  const compactRailWhyNowHtml =
    railViewport !== "desktop" && railExpanded && rowanRail.now.reason
      ? `<div class="ml-rowan-story-card-reason ml-rail-head-reason">
          <span>Why now</span>
          ${escapeHtml(buildNarrativePreview(rowanRail.now.reason, 148))}
        </div>`
      : "";
  const browserProbeJson = buildStreetBrowserProbeJson({
    activeConversation: railActiveConversation,
    conversationNpcName: railConversationNpc?.name,
    game,
    rowanRail,
    snapshot: {
      ...snapshot,
      movement: buildBrowserMovementDiagnostics(runtimeState),
      rowanAutoplayEnabled: snapshot.rowanAutoplayEnabled,
      rowanAutoplayFrozen: snapshot.rowanAutoplayFrozen,
      visualEventCues: runtimeState.visualEventCues,
    },
  });
  const dockActiveTab = focusPanel ?? "actions";
  const clockLabel = formatClock(game.currentTime);
  const todoCounterLabel =
    game.player.objective?.progress?.label ??
    `${objectivePlanItems.length} open tasks`;
  const compactRailCollapsedHeight = showPrimaryContinue
    ? railViewport === "phone"
      ? 218
      : 158
    : railViewport === "phone"
      ? 176
      : 112;
  const compactRailExpandedHeight =
    railViewport === "phone" && firstAfternoonOpening
      ? Math.max(400, Math.min(Math.round(height * 0.48), height - 240))
      : railViewport === "phone"
      ? Math.max(320, Math.min(Math.round(height * 0.58), height - 152))
      : Math.max(340, Math.min(Math.round(height * 0.56), height - 160));
  const compactRailWidth =
    railViewport === "phone"
      ? Math.max(width - overlayInset * 2, 280)
      : Math.min(Math.max(width * 0.4, 320), 360);
  const compactRailBottomOffset =
    railViewport === "phone" ? (firstAfternoonOpening ? 28 : 148) : 168;
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
      class="ml-root ${watchModeClass} ${railViewport !== "desktop" ? "is-collapsible-rail" : ""} ${
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
              (snapshot.rowanAutoplayEnabled
                ? "Drag the map to look around. Open Locals, Journal, or Notebook when you want details."
                : "Scroll or drag the map to look around. Click a street tile to move, or open People, Journal, and Notebook for details."),
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
              ${compactRailWhyNowHtml}
              ${compactPrimaryActionHtml}
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
              ${firstAfternoonFieldNoteHtml}
              ${buildRowanStoryCardHtml("Now", rowanRail.now, true)}
              ${
                showPrimaryContinue
                  ? `
                  <button
                    class="ml-primary-action ${
                      snapshot.rowanAutoplayEnabled
                        ? "is-autoplay-nudge"
                        : ""
                    }"
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
                        primaryContinueCopy,
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
                      ${debugRailHtml}
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
                                  Skip Ahead
                                </button>`
                              : ""
                          }
                        </div>
                          <div class="ml-footer-copy">${escapeHtml(
                            rowanAutonomy.autoContinue
                              ? "Watching Rowan choose. You can still jump ahead when needed."
                              : upcomingCommitmentLabel ??
                                  "Use time controls when Rowan is waiting.",
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
              <script id="ml-browser-map-agency-probe" type="application/json">null</script>
              <script id="ml-browser-camera-probe" type="application/json">{}</script>
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
        watchMode: runtimeState.snapshot.rowanAutoplayEnabled,
      }).shouldAutoOpen
    : false;
  const collapsibleRailViewport = isCollapsibleRailViewport(
    runtimeState.snapshot.viewport,
  );
  const compactAutoplayWatchMode =
    collapsibleRailViewport &&
    runtimeState.snapshot.rowanAutoplayEnabled &&
    !runtimeState.ui.focusPanel &&
    !runtimeState.ui.supportExpanded;

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
    if (
      collapsibleRailViewport &&
      !compactAutoplayWatchMode &&
      !runtimeState.ui.railExpanded
    ) {
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
    !compactAutoplayWatchMode &&
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
    isBlockingRowanPlaybackForGame(runtimeState.snapshot.rowanPlayback, game)
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
      isBlockingRowanPlaybackForGame(
        runtimeState.snapshot.rowanPlayback,
        activeGame,
      ) ||
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
    if (
      isCollapsibleRailViewport(runtimeState.snapshot.viewport) &&
      !runtimeState.snapshot.rowanAutoplayEnabled
    ) {
      runtimeState.ui.railExpanded = true;
    }
    clearConversationAutostartTimer(runtimeState);
    callbacksRef.current.onAction(
      nextAutoStartPlan.talkActionId,
      `Starting conversation with ${activeSelectedNpc.name}`,
    );
  }, AUTOPLAY_CONVERSATION_AUTOSTART_DELAY_MS);

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

function syncBrowserMapAgencyProbe(
  root: HTMLElement,
  cue: MapAgencyCue | null,
  labels?: MapAgencyLabelDiagnostics,
) {
  const probe = root.querySelector<HTMLScriptElement>(
    "#ml-browser-map-agency-probe",
  );
  if (!probe) {
    return;
  }

  probe.textContent = JSON.stringify(
    cue
      ? {
          detail: cue.detail,
          intent: cue.intent,
          labels: labels ?? null,
          target: cue.targetWorld
            ? {
                isNpc: cue.targetIsNpc,
                label: cue.targetLabel,
                locationId: cue.targetLocationId,
                x: Math.round(cue.targetWorld.x),
                y: Math.round(cue.targetWorld.y),
              }
            : null,
          tone: cue.tone,
        }
      : null,
  ).replace(/</g, "\\u003c");
}

function syncBrowserCameraProbe(
  root: HTMLElement,
  runtimeState: RuntimeState,
  camera: PhaserType.Cameras.Scene2D.Camera,
  sceneViewport: SceneViewport,
  points?: {
    cameraFollowPixel: Point;
    playerPixel: Point;
  },
) {
  const probe = root.querySelector<HTMLScriptElement>(
    "#ml-browser-camera-probe",
  );
  if (!probe) {
    return;
  }
  const effectiveZoom = Math.max(camera.zoom, 0.001);
  const visibleWidth = sceneViewport.width / effectiveZoom;
  const visibleHeight = sceneViewport.height / effectiveZoom;
  const world = getWorldBounds(runtimeState.snapshot);
  const scrollRange = isCompactViewport(runtimeState.snapshot.viewport)
    ? getCompactCameraScrollRange({
        map: runtimeState.indices.activeSpace ?? runtimeState.snapshot.game?.map,
        visibleHeight,
        visibleWidth,
        visualScene: runtimeState.indices.visualScene,
        world,
      })
    : {
        maxX: Math.max(world.width - visibleWidth, 0),
        maxY: Math.max(world.height - visibleHeight, 0),
        minX: 0,
        minY: 0,
      };

  probe.textContent = JSON.stringify({
    activeSpaceId: runtimeState.indices.activeSpaceId,
    activeSpaceKind: runtimeState.indices.activeSpace?.kind ?? "street",
    cameraOffset: {
      x: Number(runtimeState.cameraOffset.x.toFixed(2)),
      y: Number(runtimeState.cameraOffset.y.toFixed(2)),
    },
    dragging: runtimeState.cameraGesture?.dragging === true,
    followWorldPoint: points
      ? {
          x: Number(points.cameraFollowPixel.x.toFixed(2)),
          y: Number(points.cameraFollowPixel.y.toFixed(2)),
        }
      : null,
    playerWorldPoint: points
      ? {
          x: Number(points.playerPixel.x.toFixed(2)),
          y: Number(points.playerPixel.y.toFixed(2)),
        }
      : null,
    sceneViewport: {
      height: Math.round(sceneViewport.height),
      width: Math.round(sceneViewport.width),
      x: Math.round(sceneViewport.x),
      y: Math.round(sceneViewport.y),
    },
    sceneViewportCss: {
      height: Math.round(sceneViewport.height / runtimeState.renderScale),
      width: Math.round(sceneViewport.width / runtimeState.renderScale),
      x: Math.round(sceneViewport.x / runtimeState.renderScale),
      y: Math.round(sceneViewport.y / runtimeState.renderScale),
    },
    renderScale: Number(runtimeState.renderScale.toFixed(4)),
    scroll: {
      x: Number(camera.scrollX.toFixed(2)),
      y: Number(camera.scrollY.toFixed(2)),
    },
    scrollRange: {
      maxX: Number(scrollRange.maxX.toFixed(2)),
      maxY: Number(scrollRange.maxY.toFixed(2)),
      minX: Number(scrollRange.minX.toFixed(2)),
      minY: Number(scrollRange.minY.toFixed(2)),
    },
    visibleWorldRect: {
      bottom: Number((camera.scrollY + visibleHeight).toFixed(2)),
      height: Number(visibleHeight.toFixed(2)),
      left: Number(camera.scrollX.toFixed(2)),
      right: Number((camera.scrollX + visibleWidth).toFixed(2)),
      top: Number(camera.scrollY.toFixed(2)),
      width: Number(visibleWidth.toFixed(2)),
    },
    zoom: Number(camera.zoom.toFixed(4)),
  }).replace(/</g, "\\u003c");
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

  if (getActiveInteriorSpace(game)) {
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

function getActiveSpace(game: StreetGameState | null): SpaceDefinition | null {
  if (!game) {
    return null;
  }

  const activeSpaceId = getActiveSpaceId(game);
  if (!activeSpaceId) {
    return null;
  }

  return game.spaces?.find((space) => space.id === activeSpaceId) ?? null;
}

function getActiveSpaceId(game: StreetGameState | null) {
  return game ? (game.activeSpaceId ?? game.player.spaceId ?? null) : null;
}

function getStreetSpaceId(game: StreetGameState) {
  return (
    game.spaces?.find((space) => space.kind === "street")?.id ??
    "street:south-quay"
  );
}

function getInteriorSpaceForLocationId(
  game: StreetGameState,
  locationId: string | undefined,
) {
  if (!locationId) {
    return null;
  }

  return (
    game.spaces?.find(
      (space) => space.kind === "interior" && space.locationId === locationId,
    ) ?? null
  );
}

function getNpcActiveSpaceId(game: StreetGameState, npc: NpcState) {
  return (
    npc.currentSpaceId ??
    getInteriorSpaceForLocationId(game, npc.currentLocationId)?.id ??
    getStreetSpaceId(game)
  );
}

function getActiveInteriorSpace(
  game: StreetGameState | null,
): SpaceDefinition | null {
  const activeSpace = getActiveSpace(game);
  return activeSpace?.kind === "interior" ? activeSpace : null;
}

function buildActiveNavigationSurface(
  game: StreetGameState,
  visualScene: VisualScene | null,
) {
  const activeSpace = getActiveInteriorSpace(game);
  if (!activeSpace) {
    return buildVisualNavigationSurface(game, visualScene);
  }

  return {
    blockedByVisualScene: 0,
    routeFinder: createRouteFinder(activeSpace.tiles),
    tiles: activeSpace.tiles,
    walkableRuntimePoints: buildVisualWalkableRuntimePoints(
      activeSpace.tiles,
      null,
    ),
  };
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

function createRuntimeIndices(snapshot: StreetAppSnapshot): RuntimeIndices {
  const game = snapshot.game;
  if (!game) {
    return {
      activeSpace: null,
      activeSpaceId: null,
      animatedSurfaceTiles: [],
      blockedNavigationTileCount: 0,
      footprintByLocationId: new Map(),
      locationsById: new Map(),
      patrolDistanceByKey: new Map(),
      patrolDiagnosticsByKey: new Map(),
      patrolPathByKey: new Map(),
      primaryDoorByLocation: new Map(),
      propsByLocation: new Map(),
      routeFinder: (start, end) => [start, end],
      visualScene: null,
      walkableRuntimePoints: [],
    };
  }

  const activeSpace = getActiveInteriorSpace(game);
  const visualScene = activeSpace ? null : getPlayableVisualScene(game);
  const navigationSurface = buildActiveNavigationSurface(game, visualScene);

  return {
    activeSpace,
    activeSpaceId: activeSpace?.id ?? (game.activeSpaceId ?? game.player.spaceId ?? null),
    animatedSurfaceTiles: visualScene || activeSpace
      ? []
      : collectAnimatedSurfaceTiles(game.map),
    blockedNavigationTileCount: navigationSurface.blockedByVisualScene,
    footprintByLocationId: new Map(
      game.map.footprints
        .filter((footprint) => footprint.locationId)
        .map((footprint) => [footprint.locationId as string, footprint]),
    ),
    locationsById: new Map(
      game.locations.map((location) => [location.id, location]),
    ),
    patrolDistanceByKey: new Map(),
    patrolDiagnosticsByKey: new Map(),
    patrolPathByKey: new Map(),
    primaryDoorByLocation: new Map(
      game.map.doors.map((door) => [door.locationId, door]),
    ),
    propsByLocation: groupPropsByLocation(game.map.props),
    routeFinder: navigationSurface.routeFinder,
    visualScene,
    walkableRuntimePoints: navigationSurface.walkableRuntimePoints,
  };
}

function getWorldBounds(snapshot: StreetAppSnapshot) {
  const activeSpace = snapshot.game
    ? getActiveInteriorSpace(snapshot.game)
    : null;

  return getWorldBoundsForRuntime({
    map: activeSpace ?? snapshot.game?.map,
    viewport: snapshot.viewport,
    visualScene:
      activeSpace || !snapshot.game
        ? null
        : getPlayableVisualScene(snapshot.game),
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

function getRuntimeCameraGestureViewport(
  runtimeState: RuntimeState,
): SceneViewport {
  const viewport = getRuntimeViewportSize(runtimeState);
  return {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  };
}

function resetRuntimeCameraForGame(
  runtimeState: RuntimeState,
  objects: RuntimeObjects | null,
) {
  runtimeState.cameraGesture = null;
  runtimeState.cameraOffset = { x: 0, y: 0 };
  runtimeState.cameraZoomFactor = CAMERA_USER_ZOOM_DEFAULT;
  runtimeState.lastCameraInteractionAt = Number.NEGATIVE_INFINITY;

  const game = runtimeState.snapshot.game;
  if (!game || !objects) {
    return;
  }

  if (syncRuntimeRenderScale(objects, runtimeState)) {
    renderStaticScene(objects, runtimeState);
  }

  const world = getWorldBounds(runtimeState.snapshot);
  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    world,
    runtimeState.snapshot.viewport,
  );
  const targetZoom = getTargetSceneZoom(runtimeState, sceneViewport, world);
  const visibleWidth = sceneViewport.width / Math.max(targetZoom, 0.001);
  const visibleHeight = sceneViewport.height / Math.max(targetZoom, 0.001);
  const playerPixel = playerTileToWorld(
    {
      x: runtimeState.snapshot.optimisticPlayerPosition?.x ?? game.player.x,
      y: runtimeState.snapshot.optimisticPlayerPosition?.y ?? game.player.y,
    },
    runtimeState.indices,
    game,
  );
  let minScrollX = 0;
  let maxScrollX = Math.max(world.width - visibleWidth, 0);
  let minScrollY = 0;
  let maxScrollY = Math.max(world.height - visibleHeight, 0);
  if (isCompactViewport(runtimeState.snapshot.viewport)) {
    const range = getCompactCameraScrollRange({
      map: runtimeState.indices.activeSpace ?? game.map,
      visibleHeight,
      visibleWidth,
      visualScene: runtimeState.indices.visualScene,
      world,
    });
    minScrollX = range.minX;
    maxScrollX = range.maxX;
    minScrollY = range.minY;
    maxScrollY = range.maxY;
  }

  objects.scene.cameras.main
    .setZoom(targetZoom)
    .setScroll(
      clamp(
        playerPixel.x -
          visibleWidth * getRuntimeCameraAnchorXRatio(runtimeState),
        minScrollX,
        maxScrollX,
      ),
      clamp(
        playerPixel.y -
          visibleHeight * getRuntimeCameraAnchorYRatio(runtimeState),
        minScrollY,
        maxScrollY,
      ),
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
    if (!snapshot.animatePlayerEntrance || getActiveInteriorSpace(snapshot.game)) {
      return createStaticPlayerMotion(
        point,
        startedAt,
        getActiveSpaceId(snapshot.game),
      );
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
  spaceId?: string | null,
): PlayerMotionState {
  return {
    durationMs: 1,
    path: [point],
    spaceId,
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
  const nextSpaceId = getActiveSpaceId(game);

  if (runtimeState.playerEntranceGameId !== game.id) {
    runtimeState.playerMotion =
      runtimeState.snapshot.animatePlayerEntrance && !getActiveInteriorSpace(game)
      ? createPlayerEntranceMotion(
          game,
          runtimeState.indices.routeFinder,
          nextPoint,
          now,
        )
      : createStaticPlayerMotion(nextPoint, now, nextSpaceId);

    runtimeState.playerEntranceGameId = game.id;
    return;
  }

  if (runtimeState.playerMotion.spaceId !== nextSpaceId) {
    runtimeState.playerMotion = createStaticPlayerMotion(
      nextPoint,
      now,
      nextSpaceId,
    );
    setRuntimeWaypointTarget(runtimeState, null);
    return;
  }

  if (
    runtimeState.playerMotion.to.x === nextPoint.x &&
    runtimeState.playerMotion.to.y === nextPoint.y
  ) {
    return;
  }

  const fromPoint = samplePlayerTile(runtimeState.playerMotion, now);
  const sampledFromWorldPoint = samplePlayerWorld(runtimeState, fromPoint, now);
  let fromWorldPoint = sampledFromWorldPoint;
  if (runtimeState.indices.visualScene) {
    const projectedTilePoint = projectVisualNavigationTileCenter(
      runtimeState.indices.visualScene,
      Math.round(fromPoint.x),
      Math.round(fromPoint.y),
    );
    const nearestWalkablePoint = findNearestWalkablePointByWorldHint(
      runtimeState.indices.walkableRuntimePoints,
      sampledFromWorldPoint,
      {
        preferredKinds: PUBLIC_TRAVEL_TILE_KINDS,
      },
    );
    fromWorldPoint =
      nearestWalkablePoint &&
      distanceBetween(nearestWalkablePoint.world, projectedTilePoint) <= CELL * 1.5
        ? nearestWalkablePoint.world
        : projectedTilePoint;
  }
  const visualRoute = resolveVisualRoute({
    blockedByVisualScene: runtimeState.indices.blockedNavigationTileCount,
    end: nextPoint,
    routeFinder: runtimeState.indices.routeFinder,
    start: fromPoint,
    startWorldPoint: fromWorldPoint,
    visualScene: runtimeState.indices.visualScene,
    walkableRuntimePoints: runtimeState.indices.walkableRuntimePoints,
  });
  const path = visualRoute.tilePath.length > 0 ? visualRoute.tilePath : [fromPoint];
  const playerMoveMsPerTile = derivePlayerMoveMsPerTile(runtimeState);
  const playerMoveMaxDurationMs = runtimeState.snapshot.rowanAutoplayEnabled
    ? WATCH_PLAYER_MAX_MOVE_DURATION_MS
    : PLAYER_MAX_MOVE_DURATION_MS;
  const durationMs =
    runtimeState.snapshot.optimisticPlayerMoveDurationMs ??
    clamp(
      Math.max(path.length - 1, 1) * playerMoveMsPerTile,
      playerMoveMsPerTile,
      playerMoveMaxDurationMs,
    );

  runtimeState.playerMotion = {
    durationMs,
    path,
    routeDiagnostics: visualRoute.diagnostics,
    spaceId: nextSpaceId,
    startedAt: now,
    to: nextPoint,
    worldPath:
      runtimeState.indices.visualScene && visualRoute.worldPath.length > 1
        ? visualRoute.worldPath
        : undefined,
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
    return createStaticPlayerMotion(target, startedAt, getActiveSpaceId(game));
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
    spaceId: getActiveSpaceId(game),
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

  if (runtimeState.indices.activeSpace) {
    return runtimeState.snapshot.rowanAutoplayEnabled ? 420 : 340;
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
    visualHints: getPlayerRouteVisualHints(
      runtimeState.indices,
      currentLocation.id,
    ),
    walkableRuntimePoints: runtimeState.indices.walkableRuntimePoints,
  });

  if (patrolDistance <= 0) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const rawMsPerTile =
    (patrolCycleSeconds(currentLocation.type) * 1000) / patrolDistance;
  const watchMultiplier = runtimeState.snapshot.rowanAutoplayEnabled ? 1.24 : 1;
  return clamp(
    rawMsPerTile * PLAYER_MOVE_DURATION_MULTIPLIER * watchMultiplier,
    runtimeState.snapshot.rowanAutoplayEnabled ? 360 : 300,
    runtimeState.snapshot.rowanAutoplayEnabled ? 880 : 760,
  );
}

function getPlayerRouteVisualHints(
  indices: RuntimeIndices,
  locationId: string,
) {
  const anchors = indices.visualScene?.locationAnchors[locationId];
  if (!anchors) {
    return [];
  }

  return [
    ...(anchors.playerApproaches ?? []),
    ...getVisualPatrolHints(indices, locationId),
  ].filter(Boolean);
}

function getVisualPatrolHints(indices: RuntimeIndices, locationId: string) {
  const anchors = indices.visualScene?.locationAnchors[locationId];
  if (!anchors) {
    return [];
  }

  return [
    anchors.frontage,
    ...(anchors.npcStands ?? []),
    anchors.door,
  ].filter(Boolean);
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
  const activeSpaceId = getActiveSpaceId(game);
  const visibleNpcs = game.npcs.filter(
    (npc) => getNpcActiveSpaceId(game, npc) === activeSpaceId,
  );
  const rawNpcs = visibleNpcs.map((npc, index) =>
    runtimeState.indices.activeSpace
      ? buildInteriorAnimatedNpcState({
          animationBeat,
          index,
          npc,
          space: runtimeState.indices.activeSpace,
        })
      : buildAnimatedNpcState({
          animationBeat,
          game,
          index,
          indices: runtimeState.indices,
          npc,
        }),
  );
  const playerPath = buildPlayerAvoidanceWorldPath(runtimeState, now);

  return resolveCrowdPositions(rawNpcs, playerPixel, playerPath);
}

function buildInteriorAnimatedNpcState({
  animationBeat,
  index,
  npc,
  space,
}: {
  animationBeat: number;
  index: number;
  npc: NpcState;
  space: SpaceDefinition;
}): AnimatedNpcState {
  const anchor =
    space.anchors.find((entry) => entry.npcId === npc.id) ??
    space.anchors.find((entry) => entry.kind === "spawn") ??
    space.tiles.find((tile) => tile.walkable);
  const base = mapTileToWorldCenter(anchor?.x ?? 1, anchor?.y ?? 1);
  const personality = npcPersonalityProfile(npc);
  const phaseOffset = ((hashString(npc.id) + index * 17) % 997) / 997;
  const idle = Math.sin(animationBeat * personality.swayRate + phaseOffset * 8);

  return {
    facing: idle >= 0 ? 1 : -1,
    known: npc.known,
    npc,
    step: idle * 0.08 * personality.motion.idleWave,
    x: base.x + idle * CELL * 0.035,
    y: base.y + Math.cos(animationBeat * 0.7 + phaseOffset) * CELL * 0.025,
  };
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
  const patrolPath = getCachedPatrolPath(indices, {
    door: indices.primaryDoorByLocation.get(location.id),
    findRoute: indices.routeFinder,
    location,
    nextLocation,
    props: indices.propsByLocation.get(location.id) ?? [],
    visualHints: getVisualPatrolHints(indices, location.id),
    walkableRuntimePoints: indices.walkableRuntimePoints,
  });
  const effectivePatrolPath = patrolPath;
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
    ...projectRuntimePoint(indices, styledPoint),
  };
}

function resolveCrowdPositions(
  rawNpcs: AnimatedNpcState[],
  playerPixel: Point,
  playerPath: Point[] = [],
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

    if (playerPath.length > 1) {
      const nearestPathPoint = nearestPointOnPolyline(
        { x: entry.x, y: entry.y },
        playerPath,
      );
      const pathSteered = steerAroundOccupant(
        { x: entry.x, y: entry.y },
        nearestPathPoint,
        playerRadius + npcRadius + 4,
        CELL * 1.05,
        hashString(`${entry.npc.id}:path`) % 2 === 0 ? 1 : -1,
      );

      entry.x = pathSteered.x;
      entry.y = pathSteered.y;

      if (pathSteered.didYield) {
        entry.isYielding = true;
        entry.step *= 0.46;
        entry.facing = pathSteered.x >= nearestPathPoint.x ? 1 : -1;
      }
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

function buildPlayerAvoidanceWorldPath(runtimeState: RuntimeState, now: number) {
  const motion = runtimeState.playerMotion;
  if (!isRuntimePlayerMotionActive(runtimeState, now)) {
    return [];
  }

  const worldPath =
    motion.worldPath && motion.worldPath.length > 1
      ? motion.worldPath
      : motion.path.map((point) =>
          projectRuntimeTileCenter(runtimeState.indices, point.x, point.y),
        );

  return dedupePointSequence(worldPath);
}

function isRuntimePlayerMotionActive(runtimeState: RuntimeState, now: number) {
  const motion = runtimeState.playerMotion;
  return motion.path.length > 1 && !isPlayerMotionSettled(motion, now);
}

function isPlayerMotionSettled(motion: PlayerMotionState, now: number) {
  return (now - motion.startedAt) / Math.max(motion.durationMs, 1) >= 0.98;
}

function nearestPointOnPolyline(point: Point, path: Point[]) {
  let nearest = path[0] ?? point;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < path.length; index += 1) {
    const candidate = nearestPointOnSegment(point, path[index - 1], path[index]);
    const candidateDistance = distanceBetween(point, candidate);
    if (candidateDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }

  return nearest;
}

function nearestPointOnSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0.0001) {
    return start;
  }

  const progress = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );

  return {
    x: start.x + dx * progress,
    y: start.y + dy * progress,
  };
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
  now = getRuntimeNow(),
) {
  const game = runtimeState.snapshot.game;
  runtimeState.visualEventCues = [];
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

  drawAmbientCityLife(layer, runtimeState, now, hour);
}

function drawAmbientCityLife(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  now: number,
  hour: number,
) {
  const game = runtimeState.snapshot.game;
  if (!game || !runtimeState.indices.visualScene) {
    return;
  }

  const lunchRushActive = cityEventIsRenderable(game, "event-lunch-rush", {
    includeUpcoming: true,
  });
  const lunchPulse = lunchRushActive || (hour >= 11 && hour <= 15.4) ? 1 : 0.72;
  const cityAlpha = runtimeState.snapshot.rowanAutoplayEnabled ? 0.9 : 0.74;

  drawCafeWarmWindowEvent(layer, runtimeState, now, hour);
  drawDockCartEvent(layer, runtimeState, now, hour);

  for (const route of AMBIENT_CITY_ROUTES) {
    if (!ambientRouteIsActive(route, hour, game)) {
      continue;
    }

    const crowdCount =
      route.id === "tea-house-front" && lunchRushActive
        ? 3
        : route.id === "market-crossing" || route.id === "yard-shuttle"
          ? 2
          : 1;
    const routeTempo =
      route.id === "tea-house-front" || route.id === "market-crossing"
        ? lunchPulse
        : 0.78;

    for (let walkerIndex = 0; walkerIndex < crowdCount; walkerIndex += 1) {
      const progress = positiveModulo(
        now / (route.seconds * 1000) +
          route.phase +
          walkerIndex / crowdCount +
          game.clock.totalMinutes * 0.004 * routeTempo,
        1,
      );
      const point = sampleLoopPath(route.path, progress);
      const lookAhead = sampleLoopPath(
        route.path,
        positiveModulo(progress + 0.025, 1),
      );
      const bob =
        Math.sin(
          now / 190 + (route.phase + walkerIndex * 0.19) * Math.PI * 2,
        ) * 1.7;
      const pace = Math.sin(progress * Math.PI * 2 * route.path.length);

      drawAmbientPedestrian(layer, {
        accent: route.accent,
        alpha:
          cityAlpha *
          (crowdCount > 1 ? 0.82 : 0.92) *
          (0.84 + Math.abs(pace) * 0.16),
        color: route.color,
        facing: lookAhead.x >= point.x ? 1 : -1,
        scale: route.scale * (crowdCount > 1 ? 1.08 : 1.18),
        step: pace,
        x: point.x,
        y: point.y + bob,
      });
    }
  }

  drawSquarePasserbyBeat(layer, runtimeState, now, hour);
}

function ambientRouteIsActive(
  route: AmbientCityRoute,
  hour: number,
  game: StreetGameState,
) {
  if (route.cityEventIds?.length && game.cityEvents?.length) {
    return route.cityEventIds.some((eventId) =>
      cityEventIsRenderable(game, eventId, {
        includeUpcoming: route.id === "tea-house-front",
      }),
    );
  }

  const startHour = route.startHour ?? 0;
  const endHour = route.endHour ?? 24;
  return hour >= startHour && hour <= endHour;
}

function cityEventIsRenderable(
  game: StreetGameState,
  eventId: string,
  options: { includeResolved?: boolean; includeUpcoming?: boolean } = {},
) {
  const event = game.cityEvents?.find((candidate) => candidate.id === eventId);
  if (!event) {
    return false;
  }

  return (
    event.status === "active" ||
    (options.includeUpcoming && event.status === "upcoming") ||
    (options.includeResolved && event.status === "resolved")
  );
}

function cityEventVisibleLabel(
  game: StreetGameState,
  eventId: string,
  options: { includeResolved?: boolean; includeUpcoming?: boolean } = {},
) {
  const event = game.cityEvents?.find((candidate) => candidate.id === eventId);
  if (!event || !cityEventIsRenderable(game, eventId, options)) {
    return null;
  }

  return event.visibleLabel ?? event.title ?? null;
}

function locationNameForCue(
  game: StreetGameState,
  locationId: string,
  fallback: string,
) {
  return game.locations.find((location) => location.id === locationId)?.name ?? fallback;
}

function registerVisualEventCue(
  runtimeState: RuntimeState,
  cue: VisualEventCue,
) {
  if (
    runtimeState.visualEventCues.some(
      (existing) =>
        existing.cue === cue.cue && existing.locationId === cue.locationId,
    )
  ) {
    return;
  }

  runtimeState.visualEventCues.push(cue);
}

function drawCafeWarmWindowEvent(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  now: number,
  hour: number,
) {
  const game = runtimeState.snapshot.game;
  const anchors = runtimeState.indices.visualScene?.locationAnchors["tea-house"];
  const eventDriven =
    game &&
    (cityEventIsRenderable(game, "event-cafe-prep", {
      includeResolved: true,
    }) ||
      cityEventIsRenderable(game, "event-lunch-rush", {
        includeResolved: true,
        includeUpcoming: true,
      }));

  if (
    !anchors ||
    !game ||
    hour < 7 ||
    hour > 16.5 ||
    (!eventDriven && hour > 16)
  ) {
    return;
  }

  registerVisualEventCue(runtimeState, {
    cue: "warm cafe prep",
    locationId: "tea-house",
    locationName: locationNameForCue(game, "tea-house", "Kettle & Lamp"),
    signal: "awning lights, lit windows, menu board, and set tables",
    visibleLabel:
      cityEventVisibleLabel(game, "event-cafe-prep", {
        includeResolved: true,
      }) ??
      cityEventVisibleLabel(game, "event-lunch-rush", {
        includeResolved: true,
        includeUpcoming: true,
      }),
  });

  const rect = anchors.highlight;
  const lunchActive = game
    ? cityEventIsRenderable(game, "event-lunch-rush")
    : hour >= 12 && hour <= 15;
  const pulseBase = lunchActive ? 0.68 : 0.58;
  const pulse = pulseBase + (Math.sin(now / 720) + 1) * 0.18;
  const doorPulse = 0.56 + (Math.sin(now / 520 + 0.8) + 1) * 0.16;
  const windowY = rect.y + rect.height * 0.56;
  const windowWidth = rect.width * 0.18;
  const startX = rect.x + rect.width * 0.18;
  const awningY = rect.y + rect.height * 0.44;
  const awningX = rect.x + rect.width * 0.12;
  const awningWidth = rect.width * 0.76;

  layer.fillStyle(0xf3dfa6, 0.1 * pulse);
  layer.fillRoundedRect(
    rect.x + rect.width * 0.1,
    windowY - 12,
    rect.width * 0.8,
    42,
    16,
  );

  layer.fillStyle(0x823f3d, 0.78);
  layer.fillRoundedRect(awningX, awningY - 15, awningWidth, 24, 8);
  const stripeWidth = awningWidth / 6;
  for (let index = 0; index < 6; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0xf4d9a2 : 0x9f4c44, 0.86);
    layer.fillRoundedRect(
      awningX + index * stripeWidth + 2,
      awningY - 13,
      stripeWidth - 4,
      19,
      5,
    );
  }
  layer.lineStyle(2.4, 0xf6dfaa, 0.42 * pulse);
  layer.lineBetween(awningX + 8, awningY + 10, awningX + awningWidth - 8, awningY + 10);

  for (let index = 0; index < 3; index += 1) {
    const x = startX + index * (windowWidth + rect.width * 0.08);
    const localPulse = pulse + Math.sin(now / 420 + index * 0.7) * 0.08;
    layer.fillStyle(0xffedbd, 0.22 * localPulse);
    layer.fillRoundedRect(x - 5, windowY - 5, windowWidth + 10, 24, 8);
    layer.fillStyle(0xffd990, 0.38 * localPulse);
    layer.fillRoundedRect(x, windowY, windowWidth, 14, 4);
  }

  layer.fillStyle(0xf0cf8c, 0.2 * doorPulse);
  layer.fillCircle(anchors.door.x, anchors.door.y - 28, 18);
  layer.lineStyle(2, 0xf6dfaa, 0.38 * doorPulse);
  layer.strokeCircle(anchors.door.x, anchors.door.y - 28, 11);

  const menuX = rect.x + rect.width * 0.78;
  const menuY = rect.y + rect.height * 0.72;
  layer.fillStyle(0x161f22, 0.82);
  layer.fillRoundedRect(menuX, menuY, 28, 38, 5);
  layer.lineStyle(2, 0xd8c28c, 0.72);
  layer.strokeRoundedRect(menuX + 2, menuY + 2, 24, 34, 4);
  layer.lineStyle(2, 0xf1dfb2, 0.56);
  layer.lineBetween(menuX + 8, menuY + 12, menuX + 21, menuY + 12);
  layer.lineBetween(menuX + 8, menuY + 21, menuX + 20, menuY + 21);
  layer.lineBetween(menuX + 8, menuY + 29, menuX + 18, menuY + 29);

  const tableY = rect.y + rect.height * 0.82;
  for (let index = 0; index < 2; index += 1) {
    const tableX = rect.x + rect.width * (0.22 + index * 0.2);
    layer.fillStyle(0x5a4030, 0.58);
    layer.fillEllipse(tableX, tableY + 12, 48, 12);
    layer.fillStyle(0xf0cf8c, 0.84);
    layer.fillEllipse(tableX, tableY, 34, 14);
    layer.fillStyle(0xffedbd, 0.86);
    layer.fillCircle(tableX - 8, tableY - 6, 3.4);
    layer.fillCircle(tableX + 8, tableY - 6, 3.4);
    layer.lineStyle(1.5, 0xf7e5bd, 0.5 + Math.sin(now / 520 + index) * 0.12);
    layer.lineBetween(tableX - 8, tableY - 12, tableX - 8, tableY - 22);
    layer.lineBetween(tableX + 8, tableY - 12, tableX + 8, tableY - 21);
  }
}

function drawDockCartEvent(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  now: number,
  hour: number,
) {
  const game = runtimeState.snapshot.game;
  const anchors =
    runtimeState.indices.visualScene?.locationAnchors["market-square"];
  const eventDriven =
    game &&
    cityEventIsRenderable(game, "event-square-cart", {
      includeUpcoming: true,
    });

  if (!anchors || !game || (!eventDriven && (hour < 11.5 || hour > 17))) {
    return;
  }

  registerVisualEventCue(runtimeState, {
    cue: "square handcart",
    locationId: "market-square",
    locationName: locationNameForCue(game, "market-square", "Quay Square"),
    signal: "rolling cart, stacked crates, and visible wheels",
    visibleLabel: cityEventVisibleLabel(game, "event-square-cart", {
      includeUpcoming: true,
    }),
  });

  const rect = anchors.highlight;
  const progress = positiveModulo(
    now / 15000 + (runtimeState.snapshot.game?.clock.totalMinutes ?? 0) * 0.003,
    1,
  );
  const eased =
    progress < 0.5
      ? easeInOutCubic(progress * 2)
      : easeInOutCubic((1 - progress) * 2);
  const x = rect.x + rect.width * (0.18 + eased * 0.5);
  const y = rect.y + rect.height * 0.54;
  const lift = Math.sin(now / 180) * 1.2;

  layer.fillStyle(0x071016, 0.18);
  layer.fillEllipse(x, y + 16, 58, 13);
  layer.fillStyle(0x7f6040, 0.78);
  layer.fillRoundedRect(x - 24, y - 2 + lift, 48, 20, 5);
  layer.fillStyle(0xc7b38c, 0.86);
  layer.fillRoundedRect(x - 17, y - 15 + lift, 17, 14, 4);
  layer.fillRoundedRect(x + 3, y - 14 + lift, 18, 13, 4);
  layer.lineStyle(3, 0x4a3423, 0.68);
  layer.lineBetween(x + 21, y + 3 + lift, x + 37, y - 5 + lift);
  layer.fillStyle(0x1b252b, 0.82);
  layer.fillCircle(x - 16, y + 18 + lift, 5.5);
  layer.fillCircle(x + 15, y + 18 + lift, 5.5);
  layer.fillStyle(0xf0cf8c, 0.52);
  layer.fillCircle(x - 16, y + 18 + lift, 2.4);
  layer.fillCircle(x + 15, y + 18 + lift, 2.4);
}

function drawSquarePasserbyBeat(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  now: number,
  hour: number,
) {
  const game = runtimeState.snapshot.game;
  const anchors =
    runtimeState.indices.visualScene?.locationAnchors["market-square"];
  const eventDriven =
    game &&
    (cityEventIsRenderable(game, "event-market-crossing") ||
      cityEventIsRenderable(game, "event-square-cart", {
        includeUpcoming: true,
      }));

  if (!anchors || !game || (!eventDriven && (hour < 8 || hour > 18))) {
    return;
  }

  registerVisualEventCue(runtimeState, {
    cue: "square crossing bustle",
    locationId: "market-square",
    locationName: locationNameForCue(game, "market-square", "Quay Square"),
    signal: "paired pedestrians, crossing marks, pause bubble, and hand gesture",
    visibleLabel:
      cityEventVisibleLabel(game, "event-market-crossing") ??
      cityEventVisibleLabel(game, "event-square-cart", {
        includeUpcoming: true,
      }),
  });

  const rect = anchors.highlight;
  const progress = positiveModulo(now / 11000 + 0.18, 1);
  const pausing = progress > 0.36 && progress < 0.68;
  const x = rect.x + rect.width * (0.28 + Math.min(progress, 0.68) * 0.36);
  const y = rect.y + rect.height * 0.62 + Math.sin(now / 220) * 1.2;

  for (let index = 0; index < 4; index += 1) {
    const markX = rect.x + rect.width * (0.24 + index * 0.1);
    const markY = rect.y + rect.height * 0.55 + index * 7;
    layer.lineStyle(3.4, 0xf1dfb2, 0.24);
    layer.lineBetween(markX, markY, markX + 36, markY + 18);
  }

  drawAmbientPedestrian(layer, {
    accent: 0xc68a61,
    alpha: pausing ? 0.76 : 0.64,
    color: 0x5b4d49,
    facing: progress < 0.5 ? -1 : 1,
    scale: 0.88,
    step: pausing ? -0.08 : Math.sin(progress * Math.PI * 2 + 0.9),
    x: x + 34,
    y: y + 9,
  });

  drawAmbientPedestrian(layer, {
    accent: 0xf0cf8c,
    alpha: pausing ? 0.9 : 0.76,
    color: 0x455b5f,
    facing: progress < 0.52 ? 1 : -1,
    scale: 0.96,
    step: pausing ? 0.08 : Math.sin(progress * Math.PI * 2),
    x,
    y,
  });

  if (!pausing) {
    return;
  }

  layer.fillStyle(0xf7e5bd, 0.84);
  layer.fillRoundedRect(x + 17, y - 55, 34, 19, 7);
  layer.fillTriangle(x + 20, y - 37, x + 16, y - 29, x + 29, y - 37);
  layer.fillStyle(0x4a5961, 0.62);
  layer.fillCircle(x + 28, y - 45, 2.1);
  layer.fillCircle(x + 35, y - 45, 2.1);
  layer.fillCircle(x + 42, y - 45, 2.1);
  layer.lineStyle(2.4, 0xf0cf8c, 0.72);
  layer.lineBetween(x - 9, y - 7, x - 21, y - 22);
  layer.lineBetween(x - 21, y - 22, x - 17, y - 30);
}

function drawAmbientPedestrian(
  layer: PhaserType.GameObjects.Graphics,
  options: {
    accent: number;
    alpha: number;
    color: number;
    facing: 1 | -1;
    scale: number;
    step: number;
    x: number;
    y: number;
  },
) {
  const { accent, alpha, color, facing, scale, step, x, y } = options;
  const swing = Math.sin(step * Math.PI) * scale;
  const bodyBob = Math.abs(swing) * 1.6;
  const coatShade = blendColor(color, 0x10161b, 0.18);

  layer.fillStyle(0x081016, 0.18 * alpha);
  layer.fillEllipse(x, y + 13.5 * scale, 18 * scale, 5.6 * scale);

  layer.lineStyle(3.1 * scale, color, 0.68 * alpha);
  layer.lineBetween(
    x - 4.5 * scale,
    y + 8 * scale - bodyBob,
    x - 5.8 * scale,
    y + 17.2 * scale + swing * 2,
  );
  layer.lineBetween(
    x + 4.5 * scale,
    y + 8 * scale - bodyBob,
    x + 5.8 * scale,
    y + 17.2 * scale - swing * 2,
  );
  layer.lineStyle(3 * scale, coatShade, 0.52 * alpha);
  layer.lineBetween(
    x - 8.2 * scale,
    y - 1.8 * scale - bodyBob,
    x - 9.4 * scale,
    y + 8.8 * scale + swing,
  );
  layer.lineBetween(
    x + 8.2 * scale,
    y - 1.8 * scale - bodyBob,
    x + 9.4 * scale,
    y + 8.8 * scale - swing,
  );

  layer.fillStyle(0x101820, 0.42 * alpha);
  layer.fillEllipse(x, y + 2.5 * scale - bodyBob, 21.5 * scale, 24 * scale);
  layer.fillStyle(color, 0.88 * alpha);
  layer.fillEllipse(x, y + 2.5 * scale - bodyBob, 19 * scale, 21.5 * scale);
  layer.fillStyle(accent, 0.76 * alpha);
  layer.fillRoundedRect(
    x - 4.5 * scale,
    y + 1.2 * scale - bodyBob,
    9 * scale,
    12.5 * scale,
    3 * scale,
  );

  layer.fillStyle(0x101820, 0.38 * alpha);
  layer.fillCircle(
    x + facing * 0.8 * scale,
    y - 10.5 * scale - bodyBob,
    9.9 * scale,
  );
  layer.fillStyle(0xc3a47c, 0.9 * alpha);
  layer.fillCircle(
    x + facing * 0.8 * scale,
    y - 10.5 * scale - bodyBob,
    8.9 * scale,
  );
  layer.fillStyle(blendColor(accent, 0x392f28, 0.35), 0.78 * alpha);
  layer.fillEllipse(
    x + facing * 0.2 * scale,
    y - 15 * scale - bodyBob,
    15 * scale,
    7 * scale,
  );
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

function drawMapAgencyOverlay(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  playerTile: Point,
  playerPixel: Point,
  cue: MapAgencyCue | null,
  now: number,
) {
  if (!cue?.targetWorld) {
    return;
  }

  const color = mapAgencyToneColor(cue.tone);
  const distance = distanceBetween(playerPixel, cue.targetWorld);
  const pulse = 0.64 + (Math.sin(now / 360) + 1) * 0.16;
  const targetPoint = {
    x: cue.targetWorld.x,
    y: cue.targetWorld.y - (cue.targetIsNpc ? 4 : 0),
  };

  if (distance > CELL * 1.05) {
    drawMapAgencyPath(
      layer,
      playerPixel,
      targetPoint,
      color,
      now,
      buildMapAgencyRouteWorldPath(runtimeState, playerTile, cue, targetPoint),
    );
  }

  const ringRadius =
    CELL * (cue.targetIsNpc ? 0.68 + pulse * 0.12 : 0.52 + pulse * 0.12);
  layer.fillStyle(color, cue.targetIsNpc ? 0.07 : 0.055);
  layer.fillCircle(targetPoint.x, targetPoint.y, ringRadius * 1.12);
  layer.lineStyle(2.4, color, 0.26 + pulse * 0.13);
  layer.strokeCircle(targetPoint.x, targetPoint.y, ringRadius);
  layer.lineStyle(1.4, 0xfff2cf, 0.26 + pulse * 0.12);
  layer.strokeCircle(targetPoint.x, targetPoint.y, ringRadius * 0.62);

  if (cue.targetLocationId && !cue.targetIsNpc && distance > CELL * 1.1) {
    drawMapAgencyLocationTicks(layer, targetPoint, color, pulse);
  }
}

function drawMapAgencyLocationTicks(
  layer: PhaserType.GameObjects.Graphics,
  targetPoint: Point,
  color: number,
  pulse: number,
) {
  const tickRadius = CELL * (0.74 + pulse * 0.08);
  const tickLength = CELL * 0.18;
  const alpha = 0.28 + pulse * 0.12;
  const corners = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];

  layer.lineStyle(2, color, alpha);
  for (const corner of corners) {
    const x = targetPoint.x + corner.x * tickRadius;
    const y = targetPoint.y + corner.y * tickRadius;
    layer.lineBetween(x, y, x - corner.x * tickLength, y);
    layer.lineBetween(x, y, x, y - corner.y * tickLength);
  }
}

function drawMapAgencyPath(
  layer: PhaserType.GameObjects.Graphics,
  from: Point,
  to: Point,
  color: number,
  now: number,
  routePath?: Point[] | null,
) {
  if (routePath && routePath.length > 1) {
    drawMapAgencyPolylinePath(layer, [from, ...routePath], color, now);
    return;
  }

  const distance = distanceBetween(from, to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const normalLength = Math.hypot(dx, dy) || 1;
  const normal = {
    x: -dy / normalLength,
    y: dx / normalLength,
  };
  const bend = clamp(distance * 0.1, 12, 58) * (dx >= 0 ? -1 : 1);
  const control = {
    x: (from.x + to.x) / 2 + normal.x * bend,
    y: (from.y + to.y) / 2 + normal.y * bend,
  };
  const segmentCount = clamp(Math.round(distance / 42), 5, 20);

  layer.lineStyle(2.2, color, 0.13);
  let previous = sampleQuadraticPoint(from, control, to, 0.08);
  for (let index = 1; index <= segmentCount; index += 1) {
    const progress = clamp(index / segmentCount, 0.08, 0.93);
    const next = sampleQuadraticPoint(from, control, to, progress);
    layer.lineBetween(previous.x, previous.y, next.x, next.y);
    previous = next;
  }

  const flow = positiveModulo(now / 2600, 1);
  for (let index = 0; index < segmentCount; index += 1) {
    const progress = positiveModulo((index + flow) / segmentCount, 1);
    if (progress < 0.08 || progress > 0.92) {
      continue;
    }
    const point = sampleQuadraticPoint(from, control, to, progress);
    const size = 2.6 + Math.sin(now / 240 + index) * 0.35;
    layer.fillStyle(0x091015, 0.16);
    layer.fillCircle(point.x + 1.2, point.y + 1.4, size + 0.8);
    layer.fillStyle(color, 0.32);
    layer.fillCircle(point.x, point.y, size);
  }

  const arrowTip = sampleQuadraticPoint(from, control, to, 0.94);
  const arrowBack = sampleQuadraticPoint(from, control, to, 0.87);
  const angle = Math.atan2(arrowTip.y - arrowBack.y, arrowTip.x - arrowBack.x);
  const wing = 8.5;
  layer.fillStyle(color, 0.42);
  layer.fillTriangle(
    arrowTip.x,
    arrowTip.y,
    arrowTip.x - Math.cos(angle - 0.72) * wing,
    arrowTip.y - Math.sin(angle - 0.72) * wing,
    arrowTip.x - Math.cos(angle + 0.72) * wing,
    arrowTip.y - Math.sin(angle + 0.72) * wing,
  );
}

function buildMapAgencyRouteWorldPath(
  runtimeState: RuntimeState,
  playerTile: Point,
  cue: MapAgencyCue,
  finalWorldPoint: Point,
) {
  if (!cue.targetTile) {
    return null;
  }

  const route = runtimeState.indices.routeFinder(playerTile, cue.targetTile);
  if (!routeReachesDestination(route, cue.targetTile) || route.length <= 1) {
    return null;
  }

  const routePath = route.map((point) =>
    projectRuntimeTileCenter(runtimeState.indices, point.x, point.y),
  );
  const path = dedupePointSequence([routePath[0], ...routePath.slice(1)]);
  const lastPoint = path[path.length - 1];

  if (lastPoint && distanceBetween(lastPoint, finalWorldPoint) > CELL * 0.42) {
    path.push(finalWorldPoint);
  }

  return path.length > 1 ? path : null;
}

function drawMapAgencyPolylinePath(
  layer: PhaserType.GameObjects.Graphics,
  path: Point[],
  color: number,
  now: number,
) {
  const cleanPath = dedupePointSequence(path);
  if (cleanPath.length <= 1) {
    return;
  }

  layer.lineStyle(2.4, color, 0.13);
  for (let index = 1; index < cleanPath.length; index += 1) {
    layer.lineBetween(
      cleanPath[index - 1].x,
      cleanPath[index - 1].y,
      cleanPath[index].x,
      cleanPath[index].y,
    );
  }

  const totalDistance = polylineDistance(cleanPath);
  const markerCount = clamp(Math.round(totalDistance / 42), 4, 24);
  const flow = positiveModulo(now / 2600, 1);
  for (let index = 0; index < markerCount; index += 1) {
    const progress = positiveModulo((index + flow) / markerCount, 1);
    if (progress < 0.06 || progress > 0.94) {
      continue;
    }
    const point = samplePolylinePoint(cleanPath, progress);
    const size = 2.5 + Math.sin(now / 240 + index) * 0.32;
    layer.fillStyle(0x091015, 0.15);
    layer.fillCircle(point.x + 1.2, point.y + 1.4, size + 0.8);
    layer.fillStyle(color, 0.34);
    layer.fillCircle(point.x, point.y, size);
  }

  const arrowTip = samplePolylinePoint(cleanPath, 0.96);
  const arrowBack = samplePolylinePoint(cleanPath, 0.9);
  const angle = Math.atan2(arrowTip.y - arrowBack.y, arrowTip.x - arrowBack.x);
  const wing = 8.5;
  layer.fillStyle(color, 0.44);
  layer.fillTriangle(
    arrowTip.x,
    arrowTip.y,
    arrowTip.x - Math.cos(angle - 0.72) * wing,
    arrowTip.y - Math.sin(angle - 0.72) * wing,
    arrowTip.x - Math.cos(angle + 0.72) * wing,
    arrowTip.y - Math.sin(angle + 0.72) * wing,
  );
}

function polylineDistance(path: Point[]) {
  return path.slice(1).reduce((sum, point, index) => {
    return sum + distanceBetween(path[index], point);
  }, 0);
}

function samplePolylinePoint(path: Point[], progress: number) {
  const totalDistance = polylineDistance(path);
  if (totalDistance <= 0) {
    return path[0] ?? { x: 0, y: 0 };
  }

  let remainingDistance = clamp(progress, 0, 1) * totalDistance;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distanceBetween(start, end);
    if (segmentDistance <= 0) {
      continue;
    }
    if (remainingDistance <= segmentDistance) {
      const segmentProgress = remainingDistance / segmentDistance;
      return {
        x: start.x + (end.x - start.x) * segmentProgress,
        y: start.y + (end.y - start.y) * segmentProgress,
      };
    }
    remainingDistance -= segmentDistance;
  }

  return path[path.length - 1];
}

function sampleQuadraticPoint(
  from: Point,
  control: Point,
  to: Point,
  progress: number,
) {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * from.x +
      2 * inverse * progress * control.x +
      progress * progress * to.x,
    y:
      inverse * inverse * from.y +
      2 * inverse * progress * control.y +
      progress * progress * to.y,
  };
}

function mapAgencyToneColor(tone: MapAgencyTone) {
  switch (tone) {
    case "conversation":
      return 0x8dd0cd;
    case "moving":
      return 0xf0cf8c;
    case "acting":
      return 0xe7bf78;
    case "waiting":
      return 0xbfd6dc;
    case "blocked":
      return 0xef9a7b;
    case "idle":
      return 0xb9c4c8;
  }
}

function drawDynamicOverlay(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  playerTile: Point,
  playerPixel: Point,
  now: number,
  mapAgencyCue: MapAgencyCue | null,
) {
  const game = runtimeState.snapshot.game;
  layer.clear();

  if (!game) {
    return;
  }

  if (runtimeState.indices.visualScene) {
    drawAnimatedCitySurface(layer, runtimeState.indices, now);
    drawAnimatedSkyWeather(layer, runtimeState.indices.visualScene, now);
    drawPlayerRouteBreadcrumb(layer, runtimeState, now);
    if (runtimeState.waypointTarget) {
      drawWaypointBeacon(
        layer,
        runtimeState.indices,
        runtimeState.waypointTarget,
        now,
        runtimeState.waypointPlacedAt,
      );
    }
    drawMapAgencyOverlay(
      layer,
      runtimeState,
      playerTile,
      playerPixel,
      mapAgencyCue,
      now,
    );
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
  const activeInteriorSpace = Boolean(runtimeState.indices.activeSpace);
  const activePlayerMotion = isRuntimePlayerMotionActive(runtimeState, now);

  drawAnimatedCitySurface(layer, runtimeState.indices, now);
  if (runtimeState.indices.activeSpace) {
    drawTeaHouseShiftState(layer, runtimeState.indices.activeSpace, game);
  }
  drawPlayerRouteBreadcrumb(layer, runtimeState, now);

  if (runtimeState.waypointTarget && (!activeInteriorSpace || activePlayerMotion)) {
    drawWaypointBeacon(
      layer,
      runtimeState.indices,
      runtimeState.waypointTarget,
      now,
      runtimeState.waypointPlacedAt,
    );
  }

  if (!activeInteriorSpace || activePlayerMotion) {
    drawMapAgencyOverlay(
      layer,
      runtimeState,
      playerTile,
      playerPixel,
      mapAgencyCue,
      now,
    );
  }

  if (!activeInteriorSpace && currentFootprint) {
    drawFootprintHalo(layer, currentFootprint, 0xa9d7d4, 0.08, 0.48);
  }

  if (!activeInteriorSpace && selectedFootprint) {
    drawFootprintHalo(layer, selectedFootprint, 0xf1d09f, 0.12 * pulse, 0.68);
  }

  drawPlayerPresenceMarker(layer, playerPixel, now);

  if (!activeInteriorSpace && selectedNpc) {
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

function drawPlayerRouteBreadcrumb(
  layer: PhaserType.GameObjects.Graphics,
  runtimeState: RuntimeState,
  now: number,
) {
  const routePath = buildPlayerAvoidanceWorldPath(runtimeState, now);
  if (routePath.length <= 1) {
    return;
  }

  if (runtimeState.indices.activeSpace) {
    drawInteriorPlayerRouteBreadcrumb(layer, routePath, now);
    return;
  }

  const pulse = 0.62 + Math.sin(now / 220) * 0.14;
  layer.lineStyle(3.2, 0x8dd0cd, 0.38 * pulse);
  layer.beginPath();
  layer.moveTo(routePath[0].x, routePath[0].y);
  for (const point of routePath.slice(1)) {
    layer.lineTo(point.x, point.y);
  }
  layer.strokePath();

  layer.lineStyle(1.5, 0xffefc8, 0.26 * pulse);
  for (let index = 1; index < routePath.length - 1; index += 1) {
    const point = routePath[index];
    layer.strokeCircle(point.x, point.y, 3.2 + pulse * 1.1);
  }
}

function drawInteriorPlayerRouteBreadcrumb(
  layer: PhaserType.GameObjects.Graphics,
  routePath: Point[],
  now: number,
) {
  const cleanPath = dedupePointSequence(routePath);
  if (cleanPath.length <= 1) {
    return;
  }

  const pulse = 0.62 + Math.sin(now / 220) * 0.14;
  const totalDistance = polylineDistance(cleanPath);
  const markerCount = clamp(Math.round(totalDistance / 22), 3, 18);
  const flow = positiveModulo(now / 1800, 1);

  for (let index = 0; index <= markerCount; index += 1) {
    const progress = clamp((index + flow * 0.42) / markerCount, 0.08, 0.94);
    const point = samplePolylinePoint(cleanPath, progress);
    const radius = 2.4 + Math.sin(now / 260 + index * 0.9) * 0.28;
    layer.fillStyle(0x081016, 0.11);
    layer.fillCircle(point.x + 0.9, point.y + 1.1, radius + 0.9);
    layer.fillStyle(0xf4dcaa, 0.3 + pulse * 0.08);
    layer.fillCircle(point.x, point.y, radius);
  }

  const target = cleanPath[cleanPath.length - 1];
  layer.lineStyle(1.4, 0xf0cf8c, 0.22 + pulse * 0.08);
  layer.strokeCircle(target.x, target.y, CELL * 0.24);
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

  const nextRoute = buildNpcPatrolRoute(options);
  const nextPath = nextRoute.path;
  indices.patrolPathByKey.set(key, nextPath);
  indices.patrolDistanceByKey.set(key, loopPathDistance(nextPath));
  indices.patrolDiagnosticsByKey.set(key, {
    ...nextRoute.diagnostics,
    key,
    locationId: options.location.id,
    nextLocationId: options.nextLocation?.id ?? null,
    pathLength: nextPath.length,
  });
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
  if (indices.activeSpace) {
    return mapTileToWorldCenter(point.x, point.y);
  }

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
    ...(anchors.playerApproaches ?? []).map((candidate) => ({
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
    anchors.playerApproaches?.length &&
    candidatePoints.length > 1
  ) {
    return snapAuthoredLocationWorldPoint(
      indices,
      locationId,
      candidatePoints[0],
    );
  }

  const location = indices.locationsById.get(locationId);
  if (!location || candidatePoints.length === 1) {
    return snapAuthoredLocationWorldPoint(
      indices,
      locationId,
      candidatePoints[0],
    );
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

  return snapAuthoredLocationWorldPoint(
    indices,
    locationId,
    candidatePoints[candidateIndex],
  );
}

function snapAuthoredLocationWorldPoint(
  indices: RuntimeIndices,
  locationId: string,
  point: Point,
) {
  const nearestPoint = findNearestWalkablePointByWorldHint(
    indices.walkableRuntimePoints,
    point,
    {
      preferredKinds: PUBLIC_TRAVEL_TILE_KINDS,
      preferredLocationId: locationId,
      worldDistanceScale: 46,
    },
  );

  return nearestPoint?.world ?? point;
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
  nearbyNpcCount = 0,
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
          : nearbyNpcCount > 0
            ? "People In Reach"
            : "South Quay Locals",
        subtitle: selectedNpc
          ? isLiveConversation
            ? `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust} • conversation active`
            : `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust}`
          : nearbyNpcCount > 0
            ? `People Rowan can approach around ${game.currentScene.title}. Other locals are listed separately.`
            : `No one is currently in reach around ${game.currentScene.title}; wider South Quay locals are listed separately.`,
        title: selectedNpc?.name ?? "Locals",
      };
    case "journal":
      return {
        kicker: "Field Notes",
        subtitle:
          "Objectives, field notes, and what Rowan should do next.",
        title: "Journal",
      };
    case "mind":
      return {
        kicker: "Rowan's Notebook",
        subtitle:
          "Beliefs, plans, remembered clues, and unfinished questions.",
        title: "Notebook",
      };
  }
}

function extractTalkNpcId(actionId: string) {
  const [kind, targetId] = actionId.split(":");
  return kind === "talk" && targetId ? targetId : undefined;
}

function createMapKey(game: StreetGameState | null) {
  if (!game) {
    return "empty";
  }

  return [
    game.activeSpaceId ?? "",
    game.player.spaceId ?? "",
    game.visualSceneId ?? "none",
    getVisualSceneRuntimeRevision(game.visualSceneId ?? null),
    ...(game.spaces ?? []).map((space) =>
      [
        space.id,
        space.width,
        space.height,
        space.tiles.length,
        space.objects.length,
        space.anchors.length,
        space.portals.length,
      ].join(","),
    ),
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
