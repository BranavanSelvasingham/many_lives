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
  moveStreetPlayer,
  setStreetObjective,
  speakToStreetNpc,
  waitInStreetGame,
} from "@/lib/street/api";
import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import {
  getNormalizedSkyLayerRect,
  getSkyLayerPhaseOffset,
} from "@/lib/street/skyLayers";
import type {
  CityMap,
  ConversationEntry,
  LocationState,
  MapDoor,
  MapFootprint,
  MapLabel,
  MapProp,
  MapTile,
  NpcState,
  RoofStyle,
  StreetGameState,
  TileKind,
} from "@/lib/street/types";
import {
  getVisualScene,
  getVisualSceneDocument,
  getVisualSceneRuntimeRevision,
  projectVisualScenePoint,
  validateVisualSceneAgainstGame,
  VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT,
  type VisualSceneCloudKind,
  type VisualRect,
  type VisualScene,
  type VisualSurfaceMaterialKind,
  type VisualSceneWeatherKind,
} from "@/lib/street/visualScenes";

const CELL = 40;
const KENNEY_MODERN_CITY_KEY = "kenney-modern-city";
const KENNEY_TILE = 16;
const KENNEY_SCALE = CELL / KENNEY_TILE;
const WORLD_PADDING = 16;
const VISUAL_MARGIN_TILES = {
  bottom: 1,
  left: 2,
  right: 2,
  top: 1,
} as const;
const CAMERA_DRAG_START_DISTANCE_PX = 10;
const CAMERA_OFFSET_RETURN_DELAY_MS = 900;
const CAMERA_OFFSET_RETURN_LERP = 0.035;
const CAMERA_USER_ZOOM_DEFAULT = 1;
const CAMERA_USER_ZOOM_LERP = 0.16;
const CAMERA_USER_ZOOM_MAX = 1.16;
const CAMERA_USER_ZOOM_MIN = 0.76;
const COMPACT_LAYOUT_MAX_WIDTH = 960;
const COMPACT_PORTRAIT_COVER_ZOOM_BOOST = 1.12;
const MAX_RUNTIME_RENDER_SCALE = 6;
const RUNTIME_RENDER_CLARITY_BOOST = 1.35;
const CAMERA_WHEEL_ZOOM_STEP = 0.08;
const MOVEMENT_FLUSH_DELAY_MS = 45;
const DEFAULT_PLAYER_MOVE_MS_PER_TILE = 320;
const PLAYER_MAX_MOVE_DURATION_MS = 4800;
const PLAYER_MOVE_DURATION_MULTIPLIER = 0.72;
const PLAYER_CAMERA_LERP = 0.08;
const HEADER_HEIGHT = 90;
const TILE_NOISE_SCALE = 0.42;
const STREET_SIM_BASE_DAY = "2026-03-21T00:00:00.000Z";
const CONVERSATION_STREAM_FIRST_ENTRY_PAUSE_MS = 260;
const CONVERSATION_STREAM_INITIAL_DELAY_MS = 120;
const CONVERSATION_STREAM_PLAYER_WORD_DELAY_MS = 30;
const CONVERSATION_STREAM_NPC_WORD_DELAY_MS = 38;
const CONVERSATION_STREAM_SAME_SPEAKER_PAUSE_MS = 180;
const CONVERSATION_STREAM_TURN_CHANGE_PAUSE_MS = 620;
const CONVERSATION_STREAM_ENTRY_SETTLE_MS = 120;
type MapSize = {
  height: number;
  width: number;
};

type Point = {
  x: number;
  y: number;
};

type WalkableRuntimePoint = {
  kind: TileKind;
  locationId?: string;
  tile: Point;
  tileCenter: Point;
  world: Point;
};

type WalkablePointSearchOptions = {
  preferredKinds?: TileKind[];
  preferredLocationId?: string;
};

type ViewportSize = {
  height: number;
  width: number;
};

type SceneViewport = ViewportSize & {
  x: number;
  y: number;
};

type OverlayLayoutMetrics = {
  dockFocusWidth: number;
  dockWidth: number;
  focusHeight: number;
  focusWidth: number;
  overlayInset: number;
  railMaxHeight: number;
  railWidth: number;
  sceneGap: number;
};

type StreetAppSnapshot = {
  busyLabel: string | null;
  error: string | null;
  game: StreetGameState | null;
  loadingLabel: string;
  optimisticPlayerPosition?: Point;
  waypointNonce: number;
  waypointTarget?: Point;
  visualSceneRefreshNonce: number;
  viewport: ViewportSize;
};

type MoveToOptions = {
  showWaypoint?: boolean;
};

type PhaserStreetExperienceProps = {
  onAction: (actionId: string, label: string) => void;
  onAdvanceObjective: () => void;
  onAdvanceTime: (minutes: number, label: string) => void;
  onMoveBy: (deltaX: number, deltaY: number) => void;
  onMoveTo: (x: number, y: number, options?: MoveToOptions) => boolean;
  onReload: () => void;
  onSetObjective: (text: string) => void;
  onSpeak: (npcId: string, text: string) => void;
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
  | "onSetObjective"
  | "onSpeak"
>;

type PlayerMotionState = {
  durationMs: number;
  path: Point[];
  startedAt: number;
  to: Point;
};

type RuntimeIndices = {
  animatedSurfaceTiles: Array<Pick<MapTile, "kind" | "x" | "y">>;
  footprintByLocationId: Map<string, MapFootprint>;
  locationsById: Map<string, LocationState>;
  patrolDistanceByKey: Map<string, number>;
  patrolPathByKey: Map<string, Point[]>;
  primaryDoorByLocation: Map<string, MapDoor>;
  propsByLocation: Map<string, MapProp[]>;
  routeFinder: (start: Point, end: Point) => Point[];
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

type CharacterAppearance = {
  accent: number;
  accessory?: "apron" | "satchel" | "scarf" | "shawl" | "vest";
  coat: number;
  face: number;
  hair: number;
  hairStyle: "beard-cap" | "bun" | "cap" | "cropped" | "ponytail" | "scarf";
  outline: number;
};

type CharacterRig = {
  accent: PhaserType.GameObjects.Rectangle;
  avatar: PhaserType.GameObjects.Container;
  head: PhaserType.GameObjects.Container;
  leftArm: PhaserType.GameObjects.Container;
  leftLeg: PhaserType.GameObjects.Container;
  rightArm: PhaserType.GameObjects.Container;
  rightLeg: PhaserType.GameObjects.Container;
  shadow: PhaserType.GameObjects.Ellipse;
  torso: PhaserType.GameObjects.Ellipse;
};

type CharacterMotionStyle = {
  armLift: number;
  armSwing: number;
  bodyBob: number;
  headBob: number;
  headTilt: number;
  idleWave: number;
  legLift: number;
  legSwing: number;
  shadowPulse: number;
  squash: number;
  stepPower: number;
  torsoLean: number;
  torsoLift: number;
};

type NpcPersonalityProfile = {
  badge: string;
  chatSubtitle: string;
  labelBackground: string;
  labelColor: string;
  listLine: string;
  motion: CharacterMotionStyle;
  pace: number;
  scale: number;
  signature: string;
  stepStrength: number;
  sway: number;
  swayRate: number;
};

type ArchitecturalPalette = {
  awning: number;
  base: number;
  outline: number;
  profile:
    | "boarding-house"
    | "freight-yard"
    | "moss-pier"
    | "repair-stall"
    | "rowhouse"
    | "tea-house"
    | "warehouse";
  roof: number;
  roofBand: number;
  shadow: number;
  sign: number;
  trim: number;
  window: number;
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
  railExpanded: boolean;
  selectedNpcId: string | null;
  supportExpanded: boolean;
};

type ObjectivePlanItem = {
  id: string;
  title: string;
  detail: string;
  progress?: string;
  done: boolean;
};

type MemoryThread = {
  id: string;
  title: string;
  detail: string;
  priority: number;
};

type ClockAdvanceOption = {
  key: string;
  minutes: number;
  label: string;
  busyLabel: string;
  kind: "increment" | "target";
};

type CameraGestureState = {
  downScreen: Point;
  dragging: boolean;
  originOffset: Point;
  pointerId: number;
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
  cameraGesture: CameraGestureState | null;
  cameraOffset: Point;
  cameraZoomFactor: number;
  conversationReplay: ConversationReplayState;
  indices: RuntimeIndices;
  lastCameraInteractionAt: number;
  mapKey: string;
  objects: RuntimeObjects | null;
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

const TILE_COLORS: Record<TileKind, number> = {
  courtyard: 0xc4b595,
  dock: 0x8b6848,
  garden: 0x52784f,
  lane: 0xc7b9a1,
  plaza: 0xd8cbb2,
  roof: 0x2f3b42,
  stoop: 0xb8ab91,
  water: 0x2f6d83,
  workyard: 0xa89276,
};

const PUBLIC_TRAVEL_TILE_KINDS: TileKind[] = ["lane", "plaza", "stoop", "dock"];
const PLAYER_ENTRANCE_TILE_KINDS: TileKind[] = ["lane", "plaza", "dock"];

const ROUTE_NEIGHBOR_OFFSETS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const ROUTE_CLEARANCE_OFFSETS: Array<
  Point & {
    weight: number;
  }
> = [
  { x: -1, y: -1, weight: 0.34 },
  { x: 0, y: -1, weight: 0.68 },
  { x: 1, y: -1, weight: 0.34 },
  { x: -1, y: 0, weight: 0.7 },
  { x: 1, y: 0, weight: 0.7 },
  { x: -1, y: 1, weight: 0.34 },
  { x: 0, y: 1, weight: 0.68 },
  { x: 1, y: 1, weight: 0.34 },
];

function visualSceneTextureKey(sceneId: string) {
  return `visual-scene-${sceneId}-reference`;
}

export function PhaserStreetGameApp() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewport = useViewportSize(hostRef);
  const [game, setGame] = useState<StreetGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [sceneOverrideVersion, setSceneOverrideVersion] = useState(0);
  const [optimisticPlayerPosition, setOptimisticPlayerPosition] =
    useState<Point | null>(null);
  const [waypointNonce, setWaypointNonce] = useState(0);
  const [waypointTarget, setWaypointTarget] = useState<Point | null>(null);
  const gameRef = useRef<StreetGameState | null>(null);
  const optimisticPlayerRef = useRef<Point | null>(null);
  const waypointTargetRef = useRef<Point | null>(null);
  const movementTargetRef = useRef<Point | null>(null);
  const movementFlushTimerRef = useRef<number | null>(null);
  const routeFinderRef = useRef<((start: Point, end: Point) => Point[]) | null>(
    null,
  );
  const routeFinderMapKeyRef = useRef("");
  const isMovementInFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const lastAppliedRequestRef = useRef(0);
  const busyLabelRef = useRef<string | null>(null);

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

      gameRef.current = nextGame;
      startTransition(() => {
        setGame(nextGame);
      });

      return true;
    },
    [],
  );

  const loadGame = useCallback(async () => {
    const requestId = nextRequestId();
    setError(null);
    setBusyLabel("Opening the district...");

    try {
      const nextGame = await createStreetGame();
      setOptimisticPlayerPosition(null);
      publishWaypoint(null);
      applyGameUpdate(nextGame, requestId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not open the district.",
      );
    } finally {
      setBusyLabel(null);
    }
  }, [applyGameUpdate, nextRequestId, publishWaypoint]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

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
      }
    } catch (moveError) {
      movementTargetRef.current = null;
      setOptimisticPlayerPosition(null);
      publishWaypoint(null);
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Rowan lost the thread of that move.",
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
      if (!activeGame || busyLabelRef.current) {
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

  const handleAdvanceObjective = useCallback(async () => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current) {
      return;
    }

    await runWithBusy("Letting Rowan pursue the objective...", async () => {
      const requestId = nextRequestId();
      const nextGame = await advanceStreetObjective(activeGame.id, {
        allowTimeSkip: false,
      });
      applyGameUpdate(nextGame, requestId);
    });
  }, [applyGameUpdate, nextRequestId, runWithBusy]);

  const handleSetObjective = useCallback(
    async (text: string) => {
      const activeGame = gameRef.current;
      if (!activeGame) {
        return;
      }

      const nextObjective = text.replace(/\s+/g, " ").trim();
      if (!nextObjective) {
        return;
      }

      await runWithBusy("Refocusing Rowan...", async () => {
        const requestId = nextRequestId();
        const nextGame = await setStreetObjective(activeGame.id, nextObjective);
        applyGameUpdate(nextGame, requestId);
      });
    },
    [applyGameUpdate, nextRequestId, runWithBusy],
  );

  const handleSpeak = useCallback(
    async (npcId: string, text: string) => {
      const activeGame = gameRef.current;
      if (!activeGame) {
        return;
      }

      const trimmed = text.replace(/\s+/g, " ").trim();
      if (!trimmed) {
        return;
      }

      await runWithBusy("Speaking up...", async () => {
        const requestId = nextRequestId();
        const nextGame = await speakToStreetNpc(activeGame.id, npcId, trimmed);
        applyGameUpdate(nextGame, requestId);
      });
    },
    [applyGameUpdate, nextRequestId, runWithBusy],
  );

  useEffect(() => {
    return () => {
      if (movementFlushTimerRef.current) {
        window.clearTimeout(movementFlushTimerRef.current);
      }
    };
  }, []);

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
      loadingLabel: busyLabel ?? "Preparing the district...",
      optimisticPlayerPosition: optimisticPlayerPosition ?? undefined,
      waypointNonce,
      waypointTarget: waypointTarget ?? undefined,
      visualSceneRefreshNonce: sceneOverrideVersion,
      viewport,
    }),
    [
      busyLabel,
      error,
      game,
      optimisticPlayerPosition,
      sceneOverrideVersion,
      viewport,
      waypointNonce,
      waypointTarget,
    ],
  );

  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      <div ref={hostRef} className="h-full w-full overflow-hidden">
        {viewport.width > 0 && viewport.height > 0 ? (
          <PhaserStreetExperience
            onAction={handleAction}
            onAdvanceObjective={() => {
              void handleAdvanceObjective();
            }}
            onAdvanceTime={(minutes, label) => {
              void handleAdvanceTime(minutes, label);
            }}
            onMoveBy={handleMoveBy}
            onMoveTo={handleMoveTo}
            onReload={() => {
              void loadGame();
            }}
            onSetObjective={(text) => {
              void handleSetObjective(text);
            }}
            onSpeak={(npcId, text) => {
              void handleSpeak(npcId, text);
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
  onSetObjective,
  onSpeak,
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
    onSetObjective,
    onSpeak,
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
      onSetObjective,
      onSpeak,
    };
  }, [
    onAction,
    onAdvanceObjective,
    onAdvanceTime,
    onMoveBy,
    onMoveTo,
    onReload,
    onSetObjective,
    onSpeak,
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
    cameraGesture: null,
    cameraOffset: { x: 0, y: 0 },
    cameraZoomFactor: CAMERA_USER_ZOOM_DEFAULT,
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
      railExpanded: initialSnapshot.viewport.width > 720,
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
        beginCameraGesture(runtimeState, pointer);
      });
      this.input.on("pointermove", (pointer: PhaserType.Input.Pointer) => {
        updateCameraGesture(runtimeState, pointer);
      });
      this.input.on("pointerup", (pointer: PhaserType.Input.Pointer) => {
        finishCameraGesture(runtimeState, pointer, options.callbacksRef);
      });
      this.input.on("pointerupoutside", (pointer: PhaserType.Input.Pointer) => {
        finishCameraGesture(runtimeState, pointer, options.callbacksRef);
      });
      this.input.on(
        "wheel",
        (
          pointer: PhaserType.Input.Pointer,
          _gameObjects: PhaserType.GameObjects.GameObject[],
          _deltaX: number,
          deltaY: number,
          _deltaZ: number,
          event: WheelEvent,
        ) => {
          if (
            !runtimeState.snapshot.game ||
            isOverlayTextInputFocused(runtimeState.objects?.overlayDom ?? null)
          ) {
            return;
          }
          if (
            isOverlayEventTarget(
              runtimeState.objects?.overlayDom ?? null,
              event.target,
            )
          ) {
            return;
          }
          if (isCompactViewport(runtimeState.snapshot.viewport)) {
            return;
          }

          const sceneViewport = getSceneViewport(
            getRuntimeViewportSize(runtimeState),
            getWorldBounds(runtimeState.snapshot),
            runtimeState.snapshot.viewport,
          );
          if (!isPointerWithinSceneViewport(pointer, sceneViewport)) {
            return;
          }

          adjustCameraZoom(
            runtimeState,
            deltaY > 0 ? -CAMERA_WHEEL_ZOOM_STEP : CAMERA_WHEEL_ZOOM_STEP,
          );
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
    backgroundColor: "#000000",
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

function playerCharacterAppearance(): CharacterAppearance {
  return {
    accent: 0xf4d6a1,
    accessory: "scarf",
    coat: 0x4f78c9,
    face: 0xd7a476,
    hair: 0x4f3d31,
    hairStyle: "cropped",
    outline: 0x101820,
  };
}

function characterAppearanceForNpc(npc: NpcState): CharacterAppearance {
  const knownAppearance: CharacterAppearance =
    npc.id === "npc-mara"
      ? {
          accent: 0xd9ceb7,
          accessory: "apron",
          coat: 0x837058,
          face: 0xbf8466,
          hair: 0x7c796f,
          hairStyle: "bun",
          outline: 0x13181c,
        }
      : npc.id === "npc-ada"
        ? {
            accent: 0xdcbfa0,
            accessory: "shawl",
            coat: 0x567776,
            face: 0xe4bb99,
            hair: 0xcd945f,
            hairStyle: "scarf",
            outline: 0x13181c,
          }
        : npc.id === "npc-jo"
          ? {
              accent: 0xb2bec6,
              accessory: "satchel",
              coat: 0x596771,
              face: 0x9f6c54,
              hair: 0x3b4043,
              hairStyle: "cap",
              outline: 0x13181c,
            }
          : npc.id === "npc-tomas"
            ? {
                accent: 0xbeb085,
                accessory: "vest",
                coat: 0x77684a,
                face: 0x684531,
                hair: 0x292420,
                hairStyle: "beard-cap",
                outline: 0x13181c,
              }
            : npc.id === "npc-nia"
              ? {
                  accent: 0xc0daaf,
                  accessory: "scarf",
                  coat: 0x4f8370,
                  face: 0xcf926c,
                  hair: 0x62452e,
                  hairStyle: "ponytail",
                  outline: 0x13181c,
                }
              : {
                  accent: 0xc4b28f,
                  coat: 0x6e6452,
                  face: 0xcd9e79,
                  hair: 0x43392d,
                  hairStyle: "cropped",
                  outline: 0x13181c,
                };

  if (npc.known) {
    return knownAppearance;
  }

  return {
    ...knownAppearance,
    accent: blendColor(knownAppearance.accent, 0x49515a, 0.36),
    coat: blendColor(knownAppearance.coat, 0x434a51, 0.34),
    face: blendColor(knownAppearance.face, 0x927964, 0.24),
    hair: blendColor(knownAppearance.hair, 0x555d64, 0.28),
  };
}

const DEFAULT_CHARACTER_MOTION_STYLE: CharacterMotionStyle = {
  armLift: 1,
  armSwing: 1,
  bodyBob: 1,
  headBob: 1,
  headTilt: 1,
  idleWave: 1,
  legLift: 1,
  legSwing: 1,
  shadowPulse: 1,
  squash: 1,
  stepPower: 1,
  torsoLean: 0,
  torsoLift: 1,
};

function npcPersonalityProfile(npc: NpcState): NpcPersonalityProfile {
  switch (npc.id) {
    case "npc-mara":
      return {
        badge: "Hearth-Eyed Keeper",
        chatSubtitle:
          "Keeps the house steady with one look and two quiet steps.",
        labelBackground: "rgba(54, 41, 29, 0.92)",
        labelColor: "#f3dec0",
        listLine:
          "Grounded, observant, and warmer than she lets on at first glance.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 0.76,
          bodyBob: 0.82,
          headTilt: 0.74,
          idleWave: 1.08,
          stepPower: 0.8,
          torsoLean: 0.05,
          torsoLift: 0.82,
        },
        pace: 0.88,
        scale: 1.03,
        signature:
          "She moves like she already knows who needs help before they ask.",
        stepStrength: 0.72,
        sway: 0.02,
        swayRate: 0.72,
      };
    case "npc-ada":
      return {
        badge: "Clockwork Hostess",
        chatSubtitle:
          "Every gesture is quick, practiced, and somehow still welcoming.",
        labelBackground: "rgba(28, 63, 61, 0.92)",
        labelColor: "#d9f2ef",
        listLine:
          "Brisk and bright, always half a beat ahead of the room around her.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 1.08,
          bodyBob: 0.92,
          headTilt: 0.86,
          idleWave: 0.88,
          stepPower: 1,
          torsoLean: 0.18,
          torsoLift: 0.96,
        },
        pace: 1.15,
        scale: 1,
        signature:
          "She cuts through the street like she has six tasks balanced in one hand.",
        stepStrength: 0.96,
        sway: 0.014,
        swayRate: 1.22,
      };
    case "npc-jo":
      return {
        badge: "Grease-Stained Fixer",
        chatSubtitle:
          "Loose shoulders, sharp eyes, and the kind of stillness that means thinking.",
        labelBackground: "rgba(32, 39, 45, 0.92)",
        labelColor: "#dde5ec",
        listLine:
          "A little slouched, a little guarded, but impossible to mistake for anyone else.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armLift: 0.84,
          armSwing: 0.7,
          bodyBob: 0.74,
          headBob: 0.84,
          headTilt: 0.62,
          idleWave: 1.26,
          legLift: 0.88,
          legSwing: 0.82,
          stepPower: 0.86,
          torsoLean: -0.12,
          torsoLift: 0.72,
        },
        pace: 0.95,
        scale: 0.99,
        signature: "He walks like a person who trusts tools more than noise.",
        stepStrength: 0.8,
        sway: 0.026,
        swayRate: 0.96,
      };
    case "npc-tomas":
      return {
        badge: "Dock-Bell Foreman",
        chatSubtitle:
          "Heavy-footed, planted, and all blunt edges until you earn the softer read.",
        labelBackground: "rgba(67, 46, 26, 0.94)",
        labelColor: "#f0d8b0",
        listLine:
          "Broad, deliberate, and built from the same timber as the yard he runs.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armLift: 0.72,
          armSwing: 0.62,
          bodyBob: 0.7,
          headBob: 0.76,
          headTilt: 0.54,
          idleWave: 0.8,
          legLift: 0.82,
          legSwing: 0.72,
          shadowPulse: 1.18,
          squash: 0.84,
          stepPower: 0.9,
          torsoLean: 0.08,
          torsoLift: 0.62,
        },
        pace: 0.84,
        scale: 1.08,
        signature: "Even at rest, he reads like a warning nailed to a post.",
        stepStrength: 0.9,
        sway: 0.012,
        swayRate: 0.8,
      };
    case "npc-nia":
      return {
        badge: "Street-Swift Spark",
        chatSubtitle:
          "Every stop looks temporary, like she might launch into a sprint mid-sentence.",
        labelBackground: "rgba(34, 68, 49, 0.92)",
        labelColor: "#e3f6d4",
        listLine:
          "Quick, spring-loaded, and already halfway into the next idea.",
        motion: {
          ...DEFAULT_CHARACTER_MOTION_STYLE,
          armSwing: 1.16,
          bodyBob: 1.24,
          headBob: 1.22,
          headTilt: 1.08,
          idleWave: 1.42,
          legLift: 1.08,
          legSwing: 1.18,
          stepPower: 1.14,
          torsoLean: 0.14,
          torsoLift: 1.08,
        },
        pace: 1.28,
        scale: 0.98,
        signature:
          "She crosses the square like the air itself is hurrying her along.",
        stepStrength: 1.12,
        sway: 0.032,
        swayRate: 1.78,
      };
    default:
      return {
        badge: "Neighborhood Regular",
        chatSubtitle:
          "A familiar shape in the district, easy to place even before you know the details.",
        labelBackground: "rgba(34, 43, 49, 0.92)",
        labelColor: "#e1e8ed",
        listLine:
          "Distinct enough to notice, still holding most of their story close.",
        motion: DEFAULT_CHARACTER_MOTION_STYLE,
        pace: 1,
        scale: 1,
        signature: "They carry themselves like they belong to these lanes.",
        stepStrength: 0.86,
        sway: 0.018,
        swayRate: 1,
      };
  }
}

function createCharacterAvatar(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
) {
  const shadow = scene.add.ellipse(0, 13.5, 18, 5.6, 0x091015, 0.46);
  const leftLeg = createCharacterLeg(scene, -4.5, 8.5, appearance);
  const rightLeg = createCharacterLeg(scene, 4.5, 8.5, appearance);
  const leftArm = createCharacterArm(scene, -8.5, -1.5, appearance);
  const rightArm = createCharacterArm(scene, 8.5, -1.5, appearance);
  const torsoOutline = scene.add.ellipse(
    0,
    2.5,
    21.5,
    24,
    appearance.outline,
    0.92,
  );
  const torso = scene.add.ellipse(0, 2.5, 19, 21.5, appearance.coat, 0.98);
  const torsoHighlight = scene.add.ellipse(
    -2.4,
    -1.6,
    8,
    6,
    blendColor(appearance.coat, 0xffffff, 0.18),
    0.12,
  );
  const torsoShade = scene.add.ellipse(
    3.2,
    6.2,
    10.5,
    9.5,
    blendColor(appearance.coat, 0x10161b, 0.24),
    0.28,
  );
  const accent = scene.add.rectangle(0, 5.3, 9, 12.5, appearance.accent, 0.98);
  const accessoryNodes = createCharacterAccessoryNodes(scene, appearance);
  const headOutline = scene.add.circle(0, 0, 9.9, appearance.outline, 0.94);
  const headBase = scene.add.circle(0, 0, 8.9, appearance.face, 0.99);
  const headHighlight = scene.add.ellipse(-2.2, -2.5, 5.2, 3.6, 0xffffff, 0.14);
  const faceNodes = [
    scene.add.circle(-2.5, -0.6, 0.8, appearance.outline, 0.9),
    scene.add.circle(2.5, -0.6, 0.8, appearance.outline, 0.9),
    scene.add.circle(
      0.8,
      1.3,
      0.9,
      blendColor(appearance.face, 0xca8455, 0.25),
      0.74,
    ),
    scene.add.ellipse(0, 3, 4, 1.2, appearance.outline, 0.22),
  ] as PhaserType.GameObjects.GameObject[];
  const hairNodes = createCharacterHairNodes(scene, appearance);
  const head = scene.add.container(0, -10.5, [
    headOutline,
    headBase,
    headHighlight,
    ...hairNodes,
    ...faceNodes,
  ]);

  const avatar = scene.add.container(0, 0, [
    shadow,
    leftLeg.container,
    rightLeg.container,
    leftArm.container,
    torsoOutline,
    torso,
    torsoShade,
    torsoHighlight,
    accent,
    ...accessoryNodes,
    head,
    rightArm.container,
  ]);
  avatar.setSize(34, 46);

  return {
    accent,
    avatar,
    head,
    leftArm: leftArm.container,
    leftLeg: leftLeg.container,
    rightArm: rightArm.container,
    rightLeg: rightLeg.container,
    shadow,
    torso,
  };
}

function createCharacterAccessoryNodes(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
) {
  switch (appearance.accessory) {
    case "apron":
      return [
        scene.add.rectangle(0, 12, 8, 13, 0xe9deca, 0.72),
      ] as PhaserType.GameObjects.GameObject[];
    case "shawl":
      return [
        scene.add.ellipse(
          0,
          2,
          22,
          11,
          blendColor(appearance.accent, 0x1f2930, 0.1),
          0.92,
        ),
      ] as PhaserType.GameObjects.GameObject[];
    case "satchel":
      return [
        scene.add.rectangle(6.5, 10, 6, 6, 0x6a4e36, 0.92),
      ] as PhaserType.GameObjects.GameObject[];
    case "vest":
      return [
        scene.add.rectangle(
          -4,
          8,
          4,
          13,
          blendColor(appearance.coat, 0x261d15, 0.45),
          0.8,
        ),
        scene.add.rectangle(
          4,
          8,
          4,
          13,
          blendColor(appearance.coat, 0x261d15, 0.45),
          0.8,
        ),
      ] as PhaserType.GameObjects.GameObject[];
    case "scarf":
      return [
        scene.add.ellipse(0, 1, 15, 5, 0xe0c193, 0.92),
        scene.add.rectangle(5, 8, 3, 9, 0xe0c193, 0.86),
      ] as PhaserType.GameObjects.GameObject[];
    default:
      return [] as PhaserType.GameObjects.GameObject[];
  }
}

function createCharacterHairNodes(
  scene: PhaserType.Scene,
  appearance: CharacterAppearance,
) {
  switch (appearance.hairStyle) {
    case "bun":
      return [
        scene.add.ellipse(0, -4.5, 16, 8, appearance.hair, 0.98),
        scene.add.circle(6.4, -7.8, 3.1, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
    case "scarf":
      return [
        scene.add.ellipse(0, -4.5, 18, 9, appearance.hair, 0.98),
        scene.add.rectangle(6.5, -1.5, 3, 8, appearance.hair, 0.94),
      ] as PhaserType.GameObjects.GameObject[];
    case "cap":
      return [
        scene.add.ellipse(0, -4.8, 18, 8, appearance.hair, 0.98),
        scene.add.rectangle(4.8, -2.4, 5, 2.4, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
    case "beard-cap":
      return [
        scene.add.ellipse(0, -4.8, 18, 8, appearance.hair, 0.98),
        scene.add.ellipse(0, 5.4, 10, 7, appearance.hair, 0.86),
      ] as PhaserType.GameObjects.GameObject[];
    case "ponytail":
      return [
        scene.add.ellipse(0, -4.5, 17, 8, appearance.hair, 0.98),
        scene.add.ellipse(7.5, 0, 4, 10, appearance.hair, 0.94),
      ] as PhaserType.GameObjects.GameObject[];
    default:
      return [
        scene.add.ellipse(0, -4.5, 16, 8, appearance.hair, 0.98),
      ] as PhaserType.GameObjects.GameObject[];
  }
}

function createCharacterArm(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  appearance: CharacterAppearance,
) {
  const sleeve = scene.add.ellipse(
    0,
    4.5,
    6.4,
    13,
    blendColor(appearance.coat, 0x0f1419, 0.08),
    0.98,
  );
  const hand = scene.add.circle(0, 10.5, 2.2, appearance.face, 0.98);
  return {
    container: scene.add.container(x, y, [sleeve, hand]),
  };
}

function createCharacterLeg(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  appearance: CharacterAppearance,
) {
  const trouser = scene.add.ellipse(
    0,
    4.5,
    7,
    14,
    blendColor(appearance.coat, 0x11161c, 0.14),
    0.98,
  );
  const boot = scene.add.ellipse(
    0,
    10.8,
    8.5,
    4.4,
    blendColor(appearance.outline, 0x2d251d, 0.18),
    0.98,
  );
  return {
    container: scene.add.container(x, y, [trouser, boot]),
  };
}

function poseCharacterRig(
  rig: CharacterRig,
  {
    facing,
    now,
    style = DEFAULT_CHARACTER_MOTION_STYLE,
    stride,
  }: {
    facing: 1 | -1;
    now: number;
    style?: CharacterMotionStyle;
    stride: number;
  },
) {
  const swing = clamp(stride * style.stepPower, -1, 1);
  const bob =
    Math.abs(swing) * 2.1 * style.bodyBob +
    Math.sin(now / 240) * 0.22 * style.idleWave;
  const armSwing = swing * 0.52 * style.armSwing;
  const legSwing = swing * 0.36 * style.legSwing;
  const squashX = 1 + Math.abs(swing) * 0.03 * style.squash;
  const squashY = 1 - Math.abs(swing) * 0.035 * style.squash;
  const lean = swing * 0.08 * style.torsoLean;

  rig.avatar.setScale(facing * squashX, squashY);
  rig.avatar.setY(-bob);
  rig.torso.setY(2.5 - Math.abs(swing) * 0.45 * style.torsoLift);
  rig.torso.setRotation(lean);
  rig.accent.setY(5.5 - Math.abs(swing) * 0.45 * style.torsoLift);
  rig.accent.setRotation(lean * 0.65);
  rig.head.setX(Math.sin(now / 340) * 0.3 * style.idleWave);
  rig.head.setY(
    -10.5 -
      Math.abs(swing) * 0.8 * style.headBob +
      Math.sin(now / 200) * 0.35 * style.idleWave,
  );
  rig.head.setRotation(swing * 0.06 * style.headTilt + lean * 0.35);
  rig.shadow.setScale(
    1 - Math.abs(swing) * 0.1 * style.shadowPulse,
    1 - Math.abs(swing) * 0.03 * style.shadowPulse,
  );
  rig.leftArm.setRotation(armSwing + lean * 0.6);
  rig.rightArm.setRotation(-armSwing + lean * 0.6);
  rig.leftArm.setY(
    -1.5 +
      Math.max(0, swing) * 0.6 * style.armLift +
      Math.sin(now / 310) * 0.08 * style.idleWave,
  );
  rig.rightArm.setY(
    -1.5 +
      Math.max(0, -swing) * 0.6 * style.armLift -
      Math.sin(now / 310) * 0.08 * style.idleWave,
  );
  rig.leftLeg.setRotation(-legSwing - lean * 0.2);
  rig.rightLeg.setRotation(legSwing - lean * 0.2);
  rig.leftLeg.setY(8.5 + Math.max(0, -swing) * 0.4 * style.legLift);
  rig.rightLeg.setY(8.5 + Math.max(0, swing) * 0.4 * style.legLift);
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
      runtimeState.ui.activeTab = "people";
      runtimeState.ui.focusPanel = "people";
      runtimeState.ui.pendingConversationNpcId =
        selectNpcButton.dataset.selectNpc ?? null;
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

    const objectiveButton = target.closest<HTMLElement>(
      "[data-objective-text]",
    );
    if (objectiveButton) {
      const objectiveText = objectiveButton.dataset.objectiveText;
      if (objectiveText) {
        callbacksRef.current.onSetObjective(objectiveText);
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
      callbacksRef.current.onAdvanceObjective();
      return;
    }

    const reloadButton = target.closest<HTMLElement>("[data-reload]");
    if (reloadButton) {
      callbacksRef.current.onReload();
    }
  };

  root.onsubmit = (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement | null;
    if (!form) {
      return;
    }

    const formData = new FormData(form);

    if (form.dataset.objectiveForm === "true") {
      callbacksRef.current.onSetObjective(
        String(formData.get("objective") ?? ""),
      );
      return;
    }

    if (form.dataset.speakForm === "true") {
      const npcId = form.dataset.npcId;
      if (!npcId) {
        return;
      }

      callbacksRef.current.onSpeak(npcId, String(formData.get("speech") ?? ""));
      const input = form.querySelector<HTMLInputElement>(
        'input[name="speech"]',
      );
      if (input) {
        input.value = "";
      }
    }
  };
}

function isOverlayTextInputFocused(root: HTMLDivElement | null) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  if (!root || !root.contains(activeElement)) {
    return false;
  }

  return Boolean(
    activeElement.closest('input, textarea, [contenteditable="true"]'),
  );
}

function isOverlayEventTarget(
  root: HTMLDivElement | null,
  target: EventTarget | null,
) {
  return target instanceof Node && Boolean(root?.contains(target));
}

type OverlayRenderState = {
  activeFieldKey: string | null;
  commandRailNearBottom: boolean;
  commandRailScrollTop: number | null;
  fieldSelectionEnd: number | null;
  fieldSelectionStart: number | null;
  fieldValueByKey: Map<string, string>;
  focusedTagName: string | null;
  scrollTopByKey: Map<string, number>;
  transcriptNearBottom: boolean;
  transcriptScrollTop: number | null;
};

function captureOverlayRenderState(root: HTMLDivElement): OverlayRenderState {
  const activeElement = document.activeElement;
  const activeField =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
      ? activeElement
      : null;
  const fieldValueByKey = new Map<string, string>();
  const scrollTopByKey = new Map<string, number>();
  const commandRail = root.querySelector<HTMLElement>(
    '[data-preserve-scroll="command-rail"]',
  );
  const transcript = root.querySelector<HTMLElement>(
    '[data-chat-transcript="true"]',
  );

  root
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("[data-overlay-field-key]")
    .forEach((field) => {
      const key = field.dataset.overlayFieldKey;
      if (key) {
        fieldValueByKey.set(key, field.value);
      }
    });

  root
    .querySelectorAll<HTMLElement>("[data-preserve-scroll]")
    .forEach((element) => {
      const key = element.dataset.preserveScroll;
      if (key) {
        scrollTopByKey.set(key, element.scrollTop);
      }
    });

  return {
    activeFieldKey:
      activeField && root.contains(activeField)
        ? (activeField.dataset.overlayFieldKey ?? null)
        : null,
    commandRailNearBottom: commandRail
      ? commandRail.scrollHeight -
          commandRail.scrollTop -
          commandRail.clientHeight <
        56
      : false,
    commandRailScrollTop: commandRail?.scrollTop ?? null,
    fieldSelectionEnd: activeField?.selectionEnd ?? null,
    fieldSelectionStart: activeField?.selectionStart ?? null,
    fieldValueByKey,
    focusedTagName:
      activeElement instanceof HTMLElement && root.contains(activeElement)
        ? activeElement.tagName
        : null,
    scrollTopByKey,
    transcriptNearBottom: transcript
      ? transcript.scrollHeight -
          transcript.scrollTop -
          transcript.clientHeight <
        48
      : false,
    transcriptScrollTop: transcript?.scrollTop ?? null,
  };
}

function restoreOverlayRenderState(
  root: HTMLDivElement,
  state: OverlayRenderState,
) {
  root
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("[data-overlay-field-key]")
    .forEach((field) => {
      const key = field.dataset.overlayFieldKey;
      if (!key) {
        return;
      }

      const nextValue = state.fieldValueByKey.get(key);
      if (nextValue !== undefined && field.value !== nextValue) {
        field.value = nextValue;
      }
    });

  root
    .querySelectorAll<HTMLElement>("[data-preserve-scroll]")
    .forEach((element) => {
      const key = element.dataset.preserveScroll;
      if (!key) {
        return;
      }

      const nextScrollTop = state.scrollTopByKey.get(key);
      if (nextScrollTop !== undefined) {
        element.scrollTop = nextScrollTop;
      }
    });

  const commandRail = root.querySelector<HTMLElement>(
    '[data-preserve-scroll="command-rail"]',
  );
  if (commandRail) {
    if (state.commandRailNearBottom) {
      commandRail.scrollTop = commandRail.scrollHeight;
    } else if (state.commandRailScrollTop !== null) {
      commandRail.scrollTop = Math.min(
        state.commandRailScrollTop,
        Math.max(commandRail.scrollHeight - commandRail.clientHeight, 0),
      );
    }
  }

  const transcript = root.querySelector<HTMLElement>(
    '[data-chat-transcript="true"]',
  );
  if (transcript) {
    if (state.transcriptNearBottom) {
      transcript.scrollTop = transcript.scrollHeight;
    } else if (state.transcriptScrollTop !== null) {
      transcript.scrollTop = Math.min(
        state.transcriptScrollTop,
        Math.max(transcript.scrollHeight - transcript.clientHeight, 0),
      );
    }
  }

  if (!state.activeFieldKey) {
    return;
  }

  const restoredField = root.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(`[data-overlay-field-key="${CSS.escape(state.activeFieldKey)}"]`);
  if (!restoredField) {
    return;
  }

  restoredField.focus({ preventScroll: true });
  if (
    state.fieldSelectionStart !== null &&
    state.fieldSelectionEnd !== null &&
    typeof restoredField.setSelectionRange === "function"
  ) {
    restoredField.setSelectionRange(
      state.fieldSelectionStart,
      state.fieldSelectionEnd,
    );
  }
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
  camera.setBackgroundColor("#000000");
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
      runtimeState,
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
  const playerPixel = playerTileToWorld(playerTile, runtimeState.indices);
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
  updateCamera(camera, runtimeState, sceneViewport, playerPixel, world, now);
}

function renderAuthoredVisualScene(
  objects: RuntimeObjects,
  runtimeState: RuntimeState,
  visualScene: VisualScene,
) {
  if (visualScene.id === "south-quay-v2") {
    drawFringeZones(objects.terrainLayer, visualScene);
    drawSurfaceZones(objects.terrainLayer, visualScene);
    drawV2LandmarkGroundArt(objects.terrainLayer, visualScene);
    drawHarborEdge(objects.terrainLayer, visualScene);
    drawV2LandmarkStructureArt(objects, visualScene);
    drawLandmarkModules(objects, visualScene);
    drawPropClusters(objects.structureDetailLayer, visualScene);
    void runtimeState;
    return;
  }

  const plateKey = visualSceneTextureKey(visualScene.id);

  drawAuthoredSceneGround(objects.terrainLayer, visualScene);
  drawAuthoredSceneStructures(objects.structureLayer, visualScene);

  if (
    visualScene.referencePlate.alpha > 0.001 &&
    objects.scene.textures.exists(plateKey)
  ) {
    const plate = objects.scene.add
      .image(
        visualScene.referencePlate.x,
        visualScene.referencePlate.y,
        plateKey,
      )
      .setOrigin(0, 0)
      .setAlpha(visualScene.referencePlate.alpha)
      .setDisplaySize(
        visualScene.referencePlate.width,
        visualScene.referencePlate.height,
      )
      .setDepth(12);
    objects.assetTerrainNodes.push(plate);
  }

  void runtimeState;
}

function addLandmarkTextNode(
  objects: RuntimeObjects,
  config: {
    color: string;
    fontFamily: string;
    fontSize: number;
    fontStyle?: string;
    text: string;
    x: number;
    y: number;
  },
) {
  const label = objects.scene.add
    .text(config.x, config.y, config.text, {
      color: config.color,
      fontFamily: config.fontFamily,
      fontSize: `${Math.max(10, Math.round(config.fontSize))}px`,
      fontStyle: config.fontStyle ?? "700",
    })
    .setDepth(23)
    .setOrigin(0.5, 0.5);
  objects.assetStructureNodes.push(label);
}

function drawV2LandmarkGroundArt(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  void layer;
  void visualScene;
}

function drawV2LandmarkStructureArt(
  objects: RuntimeObjects,
  visualScene: VisualScene,
) {
  const layer = objects.structureLayer;
  for (const landmark of visualScene.landmarks) {
    if (
      landmark.locationId === "market-square" ||
      landmark.style === "square"
    ) {
      drawQuaySquareHeroArt(layer, landmark.rect);
      continue;
    }

    if (landmark.style === "courtyard") {
      continue;
    }

    if (landmark.style === "cafe") {
      drawTeaHouseHeroArt(layer, landmark.rect);
      continue;
    }

    if (landmark.style === "boarding-house") {
      drawBoardingHouseHeroArt(layer, landmark.rect);
      addLandmarkTextNode(objects, {
        color: "#f4ead2",
        fontFamily: "Georgia, serif",
        fontSize: 14,
        text: "BOARDING HOUSE",
        x: landmark.rect.x + landmark.rect.width / 2,
        y: landmark.rect.y + 27,
      });
      continue;
    }

    drawV2GenericLandmarkArt(layer, landmark);
  }
}

function drawTeaHouseHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const roofHeight = Math.max(24, Math.min(42, rect.height * 0.18));
  const lowerBandHeight = Math.max(26, rect.height * 0.16);
  layer.fillStyle(0xf0e4cd, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.fillStyle(0xb08c66, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    roofHeight,
    rect.radius ?? 18,
  );
  layer.fillStyle(0xffffff, 0.52);
  layer.fillRoundedRect(
    rect.x + 42,
    rect.y + roofHeight + 12,
    rect.width - 84,
    10,
    5,
  );
  layer.fillStyle(0xf6eddc, 1);
  layer.fillRoundedRect(
    rect.x + 17,
    rect.y + roofHeight + 18,
    rect.width - 34,
    Math.max(54, rect.height - roofHeight - lowerBandHeight - 28),
    Math.max(16, (rect.radius ?? 20) - 4),
  );
  layer.lineStyle(3, 0xa78661, 0.18);
  layer.strokeRoundedRect(
    rect.x + 17,
    rect.y + roofHeight + 18,
    rect.width - 34,
    Math.max(54, rect.height - roofHeight - lowerBandHeight - 28),
    Math.max(16, (rect.radius ?? 20) - 4),
  );
  layer.fillStyle(0x79583a, 0.12);
  layer.fillRoundedRect(
    rect.x + 32,
    rect.y + rect.height - lowerBandHeight - 22,
    rect.width - 64,
    14,
    7,
  );
  layer.fillStyle(0x815d3f, 1);
  layer.fillRect(
    rect.x + 9,
    rect.y + rect.height - lowerBandHeight - 10,
    rect.width - 18,
    lowerBandHeight,
  );
  layer.fillStyle(0x6a4d35, 1);
  layer.fillRoundedRect(
    rect.x + 27,
    rect.y + rect.height - 24,
    rect.width - 54,
    12,
    6,
  );
}

function drawBoardingHouseHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const roofHeight = Math.max(28, Math.min(56, rect.height * 0.24));
  const lowerBandHeight = Math.max(40, rect.height * 0.22);
  const signWidth = Math.min(228, rect.width - 112);
  const signX = rect.x + (rect.width - signWidth) / 2;
  layer.fillStyle(0xd8c7b6, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.fillStyle(0x89949c, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    roofHeight,
    rect.radius ?? 18,
  );
  layer.fillStyle(0x4d5961, 1);
  layer.fillRoundedRect(signX, rect.y + 12, signWidth, 34, 12);
  layer.lineStyle(3, 0xd5bd88, 1);
  layer.strokeRoundedRect(signX, rect.y + 12, signWidth, 34, 12);
  layer.fillStyle(0xffffff, 0.1);
  layer.fillRoundedRect(signX + 14, rect.y + 18, signWidth - 28, 7, 3.5);
  layer.fillStyle(0xe3d7c9, 1);
  layer.fillRoundedRect(
    rect.x + 14,
    rect.y + roofHeight + 10,
    rect.width - 28,
    Math.max(86, rect.height * 0.34),
    16,
  );
  layer.lineStyle(3, 0x7a614e, 0.12);
  layer.strokeRoundedRect(
    rect.x + 14,
    rect.y + roofHeight + 10,
    rect.width - 28,
    Math.max(86, rect.height * 0.34),
    16,
  );
  layer.fillStyle(0xcfb9a5, 1);
  layer.fillRoundedRect(
    rect.x + 20,
    rect.y + rect.height - lowerBandHeight - Math.max(92, rect.height * 0.28),
    rect.width - 40,
    Math.max(72, rect.height * 0.26),
    14,
  );
  layer.lineStyle(3, 0x755642, 0.12);
  layer.strokeRoundedRect(
    rect.x + 20,
    rect.y + rect.height - lowerBandHeight - Math.max(92, rect.height * 0.28),
    rect.width - 40,
    Math.max(72, rect.height * 0.26),
    14,
  );
  layer.fillStyle(0xa67961, 1);
  layer.fillRect(
    rect.x + 9,
    rect.y + rect.height - lowerBandHeight - 10,
    rect.width - 18,
    lowerBandHeight,
  );
}

function drawQuaySquareHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const inset = 22;
  const innerRect = {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  };
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const crossWidth = Math.max(54, rect.width * 0.16);
  const crossHeight = Math.max(54, rect.height * 0.16);
  const civicRadius = Math.min(rect.width, rect.height) * 0.18;
  layer.fillStyle(0xd7c7a6, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 30,
  );
  layer.lineStyle(4, 0xf4ead3, 0.28);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 30,
  );
  layer.fillStyle(0xccb993, 1);
  layer.fillRoundedRect(
    innerRect.x,
    innerRect.y,
    innerRect.width,
    innerRect.height,
    24,
  );
  layer.lineStyle(3, 0x9a805c, 0.18);
  layer.strokeRoundedRect(
    innerRect.x,
    innerRect.y,
    innerRect.width,
    innerRect.height,
    24,
  );
  layer.fillStyle(0xe7dcc3, 1);
  layer.fillRoundedRect(
    centerX - crossWidth / 2,
    innerRect.y + 31,
    crossWidth,
    innerRect.height - 62,
    22,
  );
  layer.fillRoundedRect(
    innerRect.x + 31,
    centerY - crossHeight / 2,
    innerRect.width - 62,
    crossHeight,
    22,
  );
  layer.fillStyle(0xb8a17a, 1);
  layer.fillCircle(centerX, centerY, civicRadius + 26);
  layer.fillStyle(0xe9dfcc, 1);
  layer.fillCircle(centerX, centerY, civicRadius + 16);
  layer.fillStyle(0xa9b3b9, 1);
  layer.fillCircle(centerX, centerY, civicRadius);
  layer.fillStyle(0xd8ecf5, 1);
  layer.fillCircle(centerX, centerY, civicRadius * 0.58);
  layer.fillStyle(0xffffff, 0.36);
  layer.fillCircle(centerX, centerY - civicRadius * 0.16, civicRadius * 0.24);
  layer.fillStyle(0x9c8760, 1);
  layer.fillRoundedRect(
    innerRect.x + 42,
    innerRect.y + 26,
    innerRect.width - 84,
    16,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + 42,
    innerRect.y + innerRect.height - 42,
    innerRect.width - 84,
    16,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + 26,
    innerRect.y + 42,
    16,
    innerRect.height - 84,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + innerRect.width - 42,
    innerRect.y + 42,
    16,
    innerRect.height - 84,
    8,
  );
}

function drawV2GenericLandmarkArt(
  layer: PhaserType.GameObjects.Graphics,
  landmark: VisualScene["landmarks"][number],
) {
  const roofFill =
    landmark.style === "workshop"
      ? 0x5a6670
      : landmark.style === "dock"
        ? 0x8d6d47
        : landmark.style === "yard"
          ? 0x6d675d
          : landmark.style === "courtyard"
            ? 0x7c8b63
            : 0xd6c7a9;
  const bodyFill =
    landmark.style === "workshop"
      ? 0x9e8667
      : landmark.style === "dock"
        ? 0x866444
        : landmark.style === "yard"
          ? 0x7b776d
          : landmark.style === "courtyard"
            ? 0x72825f
            : 0xddd1b8;
  const lowerBand =
    landmark.style === "workshop"
      ? 0x6e5b46
      : landmark.style === "dock"
        ? 0x76563b
        : landmark.style === "yard"
          ? 0x4d4a45
          : 0xa99c7d;
  const roofHeight = Math.max(28, Math.min(56, landmark.rect.height * 0.24));
  const lowerBandHeight = Math.max(40, landmark.rect.height * 0.22);
  const isDockyard = landmark.locationId === "freight-yard";
  const dockyardCargoWidth = isDockyard
    ? Math.max(78, landmark.rect.width * 0.28)
    : 0;
  const dockyardCargoHeight = isDockyard
    ? Math.max(104, landmark.rect.height * 0.5)
    : 0;
  const dockyardCargoX =
    landmark.rect.x + landmark.rect.width - dockyardCargoWidth - 38;
  const dockyardCargoY =
    landmark.rect.y +
    landmark.rect.height -
    lowerBandHeight -
    dockyardCargoHeight -
    18;

  layer.fillStyle(bodyFill, 1);
  layer.fillRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    landmark.rect.height,
    landmark.rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    landmark.rect.height,
    landmark.rect.radius ?? 20,
  );
  layer.fillStyle(roofFill, 1);
  layer.fillRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    roofHeight,
    landmark.rect.radius ?? 18,
  );

  if (isDockyard) {
    layer.fillStyle(0x8a8376, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 17,
      landmark.rect.y + roofHeight + 18,
      landmark.rect.width - 34,
      Math.max(64, landmark.rect.height * 0.28),
      14,
    );
    layer.lineStyle(3, 0x292622, 0.16);
    layer.strokeRoundedRect(
      landmark.rect.x + 17,
      landmark.rect.y + roofHeight + 18,
      landmark.rect.width - 34,
      Math.max(64, landmark.rect.height * 0.28),
      14,
    );
    layer.fillStyle(0xd8ccb2, 0.2);
    layer.fillRoundedRect(
      landmark.rect.x + 45,
      landmark.rect.y + roofHeight + 28,
      landmark.rect.width - 90,
      10,
      5,
    );
    layer.fillStyle(0x5a564f, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y +
        landmark.rect.height -
        lowerBandHeight -
        Math.max(96, landmark.rect.height * 0.34),
      landmark.rect.width - 44,
      Math.max(74, landmark.rect.height * 0.32),
      16,
    );
    layer.lineStyle(3, 0xe8d8bb, 0.1);
    layer.strokeRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y +
        landmark.rect.height -
        lowerBandHeight -
        Math.max(96, landmark.rect.height * 0.34),
      landmark.rect.width - 44,
      Math.max(74, landmark.rect.height * 0.32),
      16,
    );
    layer.fillStyle(0xc6923d, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 35,
      landmark.rect.y + landmark.rect.height - lowerBandHeight - 26,
      landmark.rect.width - 70,
      10,
      5,
    );
  }

  layer.fillStyle(lowerBand, 1);
  layer.fillRect(
    landmark.rect.x + 9,
    landmark.rect.y + landmark.rect.height - lowerBandHeight - 10,
    landmark.rect.width - 18,
    lowerBandHeight,
  );

  if (isDockyard) {
    layer.fillStyle(0x0c0e0f, 0.18);
    layer.fillEllipse(
      dockyardCargoX + dockyardCargoWidth / 2,
      dockyardCargoY + dockyardCargoHeight - 2,
      dockyardCargoWidth * 1.04,
      Math.max(18, dockyardCargoHeight * 0.16),
    );
    layer.fillStyle(0x65513b, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.08,
      dockyardCargoY +
        dockyardCargoHeight -
        Math.max(16, dockyardCargoHeight * 0.14),
      dockyardCargoWidth * 0.84,
      Math.max(10, dockyardCargoHeight * 0.1),
      4,
    );
    layer.fillStyle(0x4e5961, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.54,
      dockyardCargoY + dockyardCargoHeight * 0.18,
      dockyardCargoWidth * 0.38,
      dockyardCargoHeight * 0.54,
      10,
    );
    layer.lineStyle(3, 0xf0e5cb, 0.14);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.54,
      dockyardCargoY + dockyardCargoHeight * 0.18,
      dockyardCargoWidth * 0.38,
      dockyardCargoHeight * 0.54,
      10,
    );
    layer.fillStyle(0xffffff, 0.1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.61,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.24,
      8,
      4,
    );
    layer.lineStyle(3, 0x262a2d, 0.44);
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.64,
      dockyardCargoY + dockyardCargoHeight * 0.22,
      dockyardCargoX + dockyardCargoWidth * 0.64,
      dockyardCargoY + dockyardCargoHeight * 0.68,
    );
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.79,
      dockyardCargoY + dockyardCargoHeight * 0.22,
      dockyardCargoX + dockyardCargoWidth * 0.79,
      dockyardCargoY + dockyardCargoHeight * 0.68,
    );
    layer.fillStyle(0x866448, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.04,
      dockyardCargoY + dockyardCargoHeight * 0.52,
      dockyardCargoWidth * 0.44,
      dockyardCargoHeight * 0.24,
      9,
    );
    layer.lineStyle(3, 0xeedcb7, 0.12);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.04,
      dockyardCargoY + dockyardCargoHeight * 0.52,
      dockyardCargoWidth * 0.44,
      dockyardCargoHeight * 0.24,
      9,
    );
    layer.fillStyle(0xe8cda2, 0.16);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.1,
      dockyardCargoY + dockyardCargoHeight * 0.58,
      dockyardCargoWidth * 0.3,
      7,
      3.5,
    );
    layer.lineStyle(2.5, 0x583c25, 0.4);
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.14,
      dockyardCargoY + dockyardCargoHeight * 0.54,
      dockyardCargoX + dockyardCargoWidth * 0.14,
      dockyardCargoY + dockyardCargoHeight * 0.74,
    );
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.31,
      dockyardCargoY + dockyardCargoHeight * 0.54,
      dockyardCargoX + dockyardCargoWidth * 0.31,
      dockyardCargoY + dockyardCargoHeight * 0.74,
    );
    layer.fillStyle(0xa17d53, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.18,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.28,
      dockyardCargoHeight * 0.18,
      8,
    );
    layer.lineStyle(3, 0xf8e9c8, 0.1);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.18,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.28,
      dockyardCargoHeight * 0.18,
      8,
    );
    layer.fillStyle(0xd1ab58, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.22,
      dockyardCargoY + dockyardCargoHeight * 0.31,
      dockyardCargoWidth * 0.16,
      8,
      4,
    );
    const stripeWidth = (landmark.rect.width - 110) / 5;
    for (let stripeIndex = 0; stripeIndex < 5; stripeIndex += 1) {
      layer.fillStyle(stripeIndex % 2 === 0 ? 0xd9a240 : 0x2d2e30, 1);
      layer.fillRoundedRect(
        landmark.rect.x + 55 + stripeIndex * stripeWidth,
        landmark.rect.y + landmark.rect.height - 18,
        stripeWidth,
        8,
        4,
      );
    }
    layer.fillStyle(0x4c4841, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y + 12,
      10,
      landmark.rect.height - 26,
      6,
    );
    layer.fillRoundedRect(
      landmark.rect.x + landmark.rect.width - 32,
      landmark.rect.y + 12,
      10,
      landmark.rect.height - 26,
      6,
    );
  }
}

function drawSurfaceZones(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const hasTerrainDraft = drawTerrainDraftGround(layer, visualScene);
  if (!hasTerrainDraft) {
    layer.fillStyle(0x111d23, 1);
    layer.fillRect(0, 0, visualScene.width, visualScene.height);
  }

  const hasSurfaceDraft = drawSurfaceDraft(layer, visualScene);

  for (const zone of visualScene.surfaceZones) {
    if (
      hasSurfaceDraft &&
      (zone.kind === "main_street" ||
        zone.kind === "north_promenade" ||
        zone.kind === "service_lane" ||
        zone.kind === "square_border" ||
        zone.kind === "square_center" ||
        zone.kind === "west_lane")
    ) {
      continue;
    }

    const { rect } = zone;

    switch (zone.kind) {
      case "north_promenade":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd8c9a9,
          base: 0xd1c1a1,
          emphasis: zone.emphasis ?? "medium",
          joint: 0xb4a27f,
          stripe: 0xe1d3b5,
        });
        break;
      case "main_street":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd0c0a0,
          base: 0xc4b391,
          emphasis: zone.emphasis ?? "medium",
          joint: 0xae9d79,
          stripe: 0xdcccad,
        });
        break;
      case "west_lane":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xc3b391,
          base: 0xb8a682,
          emphasis: zone.emphasis ?? "medium",
          joint: 0x9c8968,
          stripe: 0xd0be9a,
        });
        layer.fillStyle(0x8a7960, 0.24);
        layer.fillRect(
          rect.x + rect.width - 18,
          rect.y + 10,
          8,
          rect.height - 20,
        );
        break;
      case "service_lane":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xb8ad95,
          base: 0xa89b7f,
          emphasis: zone.emphasis ?? "medium",
          joint: 0x88775f,
          stripe: 0xc5baa2,
        });
        layer.lineStyle(3, 0x7b654b, 0.18);
        layer.lineBetween(
          rect.x + rect.width * 0.28,
          rect.y + 18,
          rect.x + rect.width * 0.22,
          rect.y + rect.height - 18,
        );
        layer.lineBetween(
          rect.x + rect.width * 0.74,
          rect.y + 18,
          rect.x + rect.width * 0.78,
          rect.y + rect.height - 18,
        );
        break;
      case "square_border":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd9ccb1,
          base: 0xd0c1a3,
          emphasis: "high",
          joint: 0xb7a78e,
          stripe: 0xe3d7bf,
        });
        layer.lineStyle(2, 0xefe1c1, 0.52);
        layer.strokeRoundedRect(
          rect.x + 18,
          rect.y + 18,
          rect.width - 36,
          rect.height - 36,
          24,
        );
        break;
      case "square_center":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xe3d7bc,
          base: 0xd9cdb3,
          emphasis: "high",
          joint: 0xbcae93,
          stripe: 0xf0e6cf,
        });
        layer.lineStyle(2, 0xf0e6cd, 0.36);
        layer.strokeRoundedRect(
          rect.x + 12,
          rect.y + 12,
          rect.width - 24,
          rect.height - 24,
          18,
        );
        break;
      case "courtyard_ground":
        layer.fillStyle(0x657855, 0.98);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 18,
        );
        layer.fillStyle(0x7d8c6b, 0.28);
        layer.fillRoundedRect(
          rect.x + 16,
          rect.y + 16,
          rect.width - 32,
          rect.height - 32,
          16,
        );
        layer.fillStyle(0xbba985, 0.32);
        layer.fillRoundedRect(
          rect.x + rect.width / 2 - 28,
          rect.y + 52,
          56,
          rect.height - 110,
          10,
        );
        break;
      case "dock_apron":
        layer.fillStyle(0xb69f7a, 0.98);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 12,
        );
        layer.lineStyle(2, 0x8f7755, 0.2);
        for (let x = rect.x + 14; x < rect.x + rect.width - 14; x += 28) {
          layer.lineBetween(x, rect.y + 8, x, rect.y + rect.height - 8);
        }
        break;
      case "quay_wall":
        layer.fillStyle(0x5f625f, 1);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 8,
        );
        layer.fillStyle(0x8f846f, 0.34);
        layer.fillRect(rect.x, rect.y, rect.width, 10);
        layer.lineStyle(1, 0x4a4d4a, 0.28);
        for (let x = rect.x + 22; x < rect.x + rect.width - 22; x += 34) {
          layer.lineBetween(x, rect.y + 12, x, rect.y + rect.height - 4);
        }
        break;
      case "deep_water":
        layer.fillStyle(0x245c77, 1);
        layer.fillRect(rect.x, rect.y, rect.width, rect.height);
        layer.fillStyle(0x1f4e63, 0.28);
        layer.fillRect(
          rect.x,
          rect.y + rect.height * 0.46,
          rect.width,
          rect.height * 0.54,
        );
        break;
      default:
        break;
    }
  }
}

type TerrainDraftGrid = {
  cellSize: number;
  cols: number;
  kinds: Array<Array<"land" | "water">>;
  rows: number;
};

type TerrainDraftWaterSegment = {
  height: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

function buildTerrainDraftGrid(
  visualScene: VisualScene,
): TerrainDraftGrid | null {
  const terrain = visualScene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const cols = Math.max(1, Math.ceil(visualScene.width / terrain.cellSize));
  const rows = Math.max(1, Math.ceil(visualScene.height / terrain.cellSize));
  const overrideMap = new Map(
    terrain.overrides.map((cell) => [`${cell.col}:${cell.row}`, cell.kind]),
  );
  const kinds: Array<Array<"land" | "water">> = [];

  for (let row = 0; row < rows; row += 1) {
    const rowKinds: Array<"land" | "water"> = [];
    for (let col = 0; col < cols; col += 1) {
      rowKinds.push(overrideMap.get(`${col}:${row}`) ?? terrain.baseKind);
    }
    kinds.push(rowKinds);
  }

  return {
    cellSize: terrain.cellSize,
    cols,
    kinds,
    rows,
  };
}

function terrainDraftCellRect(
  visualScene: VisualScene,
  cellSize: number,
  col: number,
  row: number,
) {
  const x = col * cellSize;
  const y = row * cellSize;
  return {
    height: Math.min(cellSize, visualScene.height - y),
    width: Math.min(cellSize, visualScene.width - x),
    x,
    y,
  };
}

function buildTerrainDraftWaterSegments(grid: TerrainDraftGrid) {
  const segments: TerrainDraftWaterSegment[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    let startCol: number | null = null;

    for (let col = 0; col <= grid.cols; col += 1) {
      const water = col < grid.cols && grid.kinds[row][col] === "water";

      if (water) {
        if (startCol === null) {
          startCol = col;
        }
        continue;
      }

      if (startCol === null) {
        continue;
      }

      const x = startCol * grid.cellSize;
      const endX = col * grid.cellSize;
      segments.push({
        height: grid.cellSize,
        row,
        width: endX - x,
        x,
        y: row * grid.cellSize,
      });
      startCol = null;
    }
  }

  return segments;
}

function drawWaveStroke(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  beat: number,
  phaseOffset: number,
  amplitude: number,
  thickness: number,
  color: number,
  alpha: number,
  travelFade?: {
    direction?: 1 | -1;
    packetLength: number;
    softness?: number;
    speed: number;
  },
) {
  if (width <= 4) {
    return;
  }

  const sampleStep = 16;
  let previousX = x;
  let previousY =
    y +
    Math.sin(previousX * 0.024 + beat * 1.6 + phaseOffset) * amplitude +
    Math.sin(previousX * 0.011 + beat * 0.72 + phaseOffset * 0.7) *
      amplitude *
      0.48;

  if (!travelFade) {
    layer.lineStyle(thickness, color, alpha);
  }

  for (let offset = sampleStep; offset <= width; offset += sampleStep) {
    const nextX = Math.min(x + offset, x + width);
    const nextY =
      y +
      Math.sin(nextX * 0.024 + beat * 1.6 + phaseOffset) * amplitude +
      Math.sin(nextX * 0.011 + beat * 0.72 + phaseOffset * 0.7) *
        amplitude *
        0.48;
    if (travelFade) {
      const segmentProgress = ((previousX + nextX) * 0.5 - x) / width;
      const packetRatio = Math.min(
        Math.max(travelFade.packetLength / Math.max(width, 1), 0.08),
        0.72,
      );
      const cycleSpan = 1 + packetRatio * 2;
      const direction = travelFade.direction ?? 1;
      const front =
        positiveModulo(
          beat * travelFade.speed + phaseOffset * 0.061,
          cycleSpan,
        ) - packetRatio;
      const softness = Math.max(travelFade.softness ?? 1.75, 0.45);
      let segmentAlpha = 0;

      if (direction >= 0) {
        const tail = front - packetRatio;
        if (segmentProgress >= tail && segmentProgress <= front) {
          const progress = (segmentProgress - tail) / packetRatio;
          segmentAlpha = Math.pow(progress, softness);
        }
      } else {
        const tail = front + packetRatio;
        if (segmentProgress >= front && segmentProgress <= tail) {
          const progress = 1 - (segmentProgress - front) / packetRatio;
          segmentAlpha = Math.pow(progress, softness);
        }
      }

      if (segmentAlpha > 0.002) {
        layer.lineStyle(thickness, color, alpha * segmentAlpha);
        layer.lineBetween(previousX, previousY, nextX, nextY);
      }
    } else {
      layer.lineBetween(previousX, previousY, nextX, nextY);
    }
    previousX = nextX;
    previousY = nextY;
  }
}

function drawTerrainDraftRubble(
  layer: PhaserType.GameObjects.Graphics,
  rect: { height: number; width: number; x: number; y: number },
  side: "bottom" | "left" | "right" | "top",
  seed: number,
) {
  const count = 2 + (seed % 2);

  for (let index = 0; index < count; index += 1) {
    const progress = (index + 1) / (count + 1);
    const radius = 3 + ((seed + index) % 3);
    const x =
      side === "left"
        ? rect.x + 12
        : side === "right"
          ? rect.x + rect.width - 12
          : rect.x + rect.width * progress;
    const y =
      side === "top"
        ? rect.y + 12
        : side === "bottom"
          ? rect.y + rect.height - 12
          : rect.y + rect.height * progress;

    layer.fillStyle(0x76614a, 0.92);
    layer.fillCircle(x, y, radius + 1.8);
    layer.fillStyle(0xab987a, 0.52);
    layer.fillCircle(x - 1, y - 1, Math.max(radius - 1.4, 1));
  }
}

function drawTerrainDraftGround(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const grid = buildTerrainDraftGrid(visualScene);
  if (!grid) {
    return false;
  }

  const baseKind = visualScene.terrainDraft?.baseKind ?? "land";

  layer.fillStyle(baseKind === "water" ? 0x4b7086 : 0xd4c6a4, 1);
  layer.fillRect(0, 0, visualScene.width, visualScene.height);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const kind = grid.kinds[row][col];
      if (kind === baseKind) {
        continue;
      }
      const { x, y, width, height } = terrainDraftCellRect(
        visualScene,
        grid.cellSize,
        col,
        row,
      );
      if (kind === "land" && baseKind === "water") {
        layer.fillStyle(0xd4c6a4, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0xe9dfc4, 0.18);
        layer.fillRect(x + 2, y + 2, width * 0.52, height * 0.42);
        layer.fillStyle(0xa48f66, 0.08);
        layer.fillRect(x, y + height - 2, width, 2);
      } else if (kind === "water" && baseKind === "land") {
        layer.fillStyle(0x54798f, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0x103346, 0.26);
        layer.fillRect(x, y + height * 0.48, width, height * 0.52);
      } else if (kind === "land") {
        layer.fillStyle(0xd4c6a4, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0xe9dfc4, 0.18);
        layer.fillRect(x + 2, y + 2, width * 0.52, height * 0.42);
        layer.fillStyle(0x8b7b5f, 0.08);
        layer.fillRect(x, y + height - 2, width, 2);
      } else {
        layer.fillStyle(0x54798f, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0x103346, 0.26);
        layer.fillRect(x, y + height * 0.48, width, height * 0.52);
      }
    }
  }

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (grid.kinds[row][col] !== "land") {
        continue;
      }

      const rect = terrainDraftCellRect(visualScene, grid.cellSize, col, row);
      const top = row > 0 ? grid.kinds[row - 1][col] : null;
      const bottom = row < grid.rows - 1 ? grid.kinds[row + 1][col] : null;
      const left = col > 0 ? grid.kinds[row][col - 1] : null;
      const right = col < grid.cols - 1 ? grid.kinds[row][col + 1] : null;
      const edges = [
        top === "water" ? "top" : null,
        bottom === "water" ? "bottom" : null,
        left === "water" ? "left" : null,
        right === "water" ? "right" : null,
      ].filter(Boolean) as Array<"bottom" | "left" | "right" | "top">;

      for (const side of edges) {
        const seed =
          col * 17 +
          row * 23 +
          (side === "top"
            ? 1
            : side === "bottom"
              ? 3
              : side === "left"
                ? 5
                : 7);
        const bandThickness = 9;

        layer.fillStyle(0x7f694a, 0.28);
        if (side === "top") {
          layer.fillRect(rect.x + 6, rect.y, rect.width - 12, bandThickness);
        } else if (side === "bottom") {
          layer.fillRect(
            rect.x + 6,
            rect.y + rect.height - bandThickness,
            rect.width - 12,
            bandThickness,
          );
        } else if (side === "left") {
          layer.fillRect(rect.x, rect.y + 6, bandThickness, rect.height - 12);
        } else {
          layer.fillRect(
            rect.x + rect.width - bandThickness,
            rect.y + 6,
            bandThickness,
            rect.height - 12,
          );
        }

        layer.lineStyle(4, 0xf8faf4, 0.94);
        if (side === "top") {
          layer.lineBetween(
            rect.x + 8,
            rect.y + 1,
            rect.x + rect.width - 10,
            rect.y + 1,
          );
          layer.lineStyle(2.6, 0xdff4fb, 0.5);
          layer.lineBetween(
            rect.x + 10,
            rect.y - 5,
            rect.x + rect.width - 12,
            rect.y - 5,
          );
        } else if (side === "bottom") {
          layer.lineBetween(
            rect.x + 8,
            rect.y + rect.height - 1,
            rect.x + rect.width - 10,
            rect.y + rect.height - 1,
          );
          layer.lineStyle(2.6, 0xdff4fb, 0.5);
          layer.lineBetween(
            rect.x + 10,
            rect.y + rect.height + 5,
            rect.x + rect.width - 12,
            rect.y + rect.height + 5,
          );
        } else if (side === "left") {
          layer.lineBetween(
            rect.x + 1,
            rect.y + 8,
            rect.x + 1,
            rect.y + rect.height - 10,
          );
        } else {
          layer.lineBetween(
            rect.x + rect.width - 1,
            rect.y + 8,
            rect.x + rect.width - 1,
            rect.y + rect.height - 10,
          );
        }

        drawTerrainDraftRubble(layer, rect, side, seed);
      }
    }
  }

  return true;
}

function getTerrainDraftKindAtPoint(
  visualScene: VisualScene,
  x: number,
  y: number,
) {
  const terrain = visualScene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const maxCol = Math.max(
    0,
    Math.ceil(visualScene.width / terrain.cellSize) - 1,
  );
  const maxRow = Math.max(
    0,
    Math.ceil(visualScene.height / terrain.cellSize) - 1,
  );
  const col = Math.max(0, Math.min(Math.floor(x / terrain.cellSize), maxCol));
  const row = Math.max(0, Math.min(Math.floor(y / terrain.cellSize), maxRow));
  const key = `${col}:${row}`;
  const override = terrain.overrides.find(
    (cell) => `${cell.col}:${cell.row}` === key,
  );
  return override?.kind ?? terrain.baseKind;
}

function drawSurfaceDraft(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const surface = visualScene.surfaceDraft;
  if (!surface) {
    return false;
  }

  const cols = Math.max(1, Math.ceil(visualScene.width / surface.cellSize));
  const rows = Math.max(1, Math.ceil(visualScene.height / surface.cellSize));
  const overrideMap = new Map(
    surface.overrides.map((cell) => [`${cell.col}:${cell.row}`, cell.kind]),
  );
  const rowKinds: Array<Array<VisualSurfaceMaterialKind | null>> = [];

  for (let row = 0; row < rows; row += 1) {
    const currentRow: Array<VisualSurfaceMaterialKind | null> = [];
    for (let col = 0; col < cols; col += 1) {
      const kind = overrideMap.get(`${col}:${row}`) ?? surface.baseKind;
      const x = col * surface.cellSize;
      const y = row * surface.cellSize;
      const width = Math.min(surface.cellSize, visualScene.width - x);
      const height = Math.min(surface.cellSize, visualScene.height - y);
      const terrainKind = getTerrainDraftKindAtPoint(
        visualScene,
        x + width / 2,
        y + height / 2,
      );
      if (terrainKind === "water") {
        currentRow.push(null);
        continue;
      }
      currentRow.push(kind);
    }
    rowKinds.push(currentRow);
  }

  for (let row = 0; row < rows; row += 1) {
    let startCol: number | null = null;
    let currentKind: VisualSurfaceMaterialKind | null = null;

    for (let col = 0; col <= cols; col += 1) {
      const nextKind = col < cols ? rowKinds[row][col] : null;

      if (nextKind !== null && nextKind === currentKind) {
        continue;
      }

      if (startCol !== null && currentKind !== null) {
        const x = startCol * surface.cellSize;
        const endX = Math.min(col * surface.cellSize, visualScene.width);
        const y = row * surface.cellSize;
        const width = endX - x;
        const height = Math.min(surface.cellSize, visualScene.height - y);

        switch (currentKind) {
          case "paved_asphalt":
            layer.fillStyle(0x5d656a, 0.96);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0xffffff, 0.04);
            layer.fillRect(x, y + height * 0.12, width, height * 0.18);
            layer.fillStyle(0x14181b, 0.12);
            layer.fillRect(x, y + height - 2, width, 2);
            layer.lineStyle(2, 0xd9dccd, 0.22);
            for (let dashX = x + 10; dashX < x + width - 14; dashX += 18) {
              layer.lineBetween(
                dashX,
                y + height / 2,
                Math.min(dashX + 8, x + width - 10),
                y + height / 2,
              );
            }
            break;
          case "tiled_stone_road":
            layer.fillStyle(0xb6b0a2, 0.98);
            layer.fillRect(x, y, width, height);
            layer.lineStyle(1.5, 0xe9e2d2, 0.2);
            for (
              let seamY = y + height / 4;
              seamY < y + height;
              seamY += height / 4
            ) {
              layer.lineBetween(x + 6, seamY, x + width - 6, seamY);
            }
            break;
          case "walkway":
            layer.fillStyle(0xddd1bc, 0.98);
            layer.fillRect(x, y, width, height);
            layer.lineStyle(1.4, 0xf5ecdd, 0.2);
            for (
              let seamY = y + height / 4;
              seamY < y + height;
              seamY += height / 4
            ) {
              layer.lineBetween(x + 8, seamY, x + width - 8, seamY);
            }
            break;
          case "grass":
            layer.fillStyle(0x7d9566, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0xb8d092, 0.12);
            layer.fillRect(
              x + width * 0.08,
              y + height * 0.18,
              width * 0.68,
              height * 0.24,
            );
            layer.lineStyle(1.4, 0x566e3f, 0.16);
            layer.lineBetween(
              x + 10,
              y + height * 0.64,
              x + width - 10,
              y + height * 0.58,
            );
            break;
          case "bushes":
            layer.fillStyle(0x6d8a55, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0x36552d, 0.44);
            for (let bushX = x + 22; bushX < x + width - 10; bushX += 42) {
              const bushY =
                y +
                height * (Math.round((bushX - x) / 42) % 2 === 0 ? 0.5 : 0.42);
              layer.fillCircle(bushX, bushY, 8);
              layer.fillCircle(bushX + 10, bushY - 4, 9);
            }
            break;
          case "trees":
            layer.fillStyle(0x72905e, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0x74553d, 0.72);
            layer.fillStyle(0x4f7a42, 0.9);
            for (let treeX = x + 28; treeX < x + width - 10; treeX += 68) {
              const treeY =
                y +
                height * (Math.round((treeX - x) / 68) % 2 === 0 ? 0.46 : 0.4);
              layer.fillStyle(0x74553d, 0.72);
              layer.fillRoundedRect(treeX - 2, treeY + 10, 4, 8, 2);
              layer.fillStyle(0x4f7a42, 0.9);
              layer.fillCircle(treeX, treeY, 11);
              layer.fillCircle(treeX + 8, treeY - 3, 8);
            }
            break;
          default:
            break;
        }
      }

      startCol = nextKind === null ? null : col;
      currentKind = nextKind;
    }
  }

  return true;
}

function fillPatternedStoneZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  palette: {
    accent: number;
    base: number;
    emphasis: "high" | "low" | "medium";
    joint: number;
    stripe: number;
  },
) {
  layer.fillStyle(palette.base, 0.99);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.lineStyle(1, palette.joint, palette.emphasis === "high" ? 0.32 : 0.22);

  for (let x = rect.x + 16; x < rect.x + rect.width - 16; x += 30) {
    layer.lineBetween(x, rect.y + 10, x, rect.y + rect.height - 10);
  }

  for (let y = rect.y + 16; y < rect.y + rect.height - 16; y += 30) {
    layer.lineBetween(rect.x + 10, y, rect.x + rect.width - 10, y);
  }

  layer.fillStyle(palette.stripe, palette.emphasis === "high" ? 0.2 : 0.12);
  for (let y = rect.y + 14; y < rect.y + rect.height - 14; y += 60) {
    layer.fillRect(rect.x + 12, y, rect.width - 24, 6);
  }

  layer.fillStyle(palette.accent, palette.emphasis === "high" ? 0.18 : 0.12);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 90) {
    layer.fillRect(x, rect.y + 12, 16, rect.height - 24);
  }
}

function drawFringeZones(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const zone of visualScene.fringeZones) {
    switch (zone.kind) {
      case "neighbor_facade":
        drawNeighborFacadeZone(layer, zone.rect, zone.edge);
        break;
      case "alley_mouth":
        drawAlleyZone(layer, zone.rect);
        break;
      case "side_street":
        drawSideStreetZone(layer, zone.rect, zone.edge);
        break;
      case "quay_continuation":
        drawQuayContinuationZone(layer, zone.rect, zone.edge);
        break;
      default:
        break;
    }
  }
}

function drawNeighborFacadeZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  layer.fillStyle(0x1a2a31, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x24363f, 0.9);
  layer.fillRect(rect.x, rect.y + 8, rect.width, 18);
  layer.lineStyle(1, 0x334852, 0.26);
  for (let x = rect.x + 20; x < rect.x + rect.width - 20; x += 48) {
    layer.lineBetween(x, rect.y + 28, x, rect.y + rect.height - 14);
  }
  if (edge === "north") {
    layer.fillStyle(0x4a4d4d, 0.16);
    layer.fillRect(rect.x + 16, rect.y + rect.height - 26, rect.width - 32, 12);
  }
}

function drawAlleyZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x142028, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.fillStyle(0x1e2d35, 0.8);
  layer.fillRoundedRect(
    rect.x + 14,
    rect.y + 18,
    rect.width - 28,
    rect.height - 36,
    14,
  );
  layer.lineStyle(1, 0x2f4650, 0.22);
  for (let y = rect.y + 26; y < rect.y + rect.height - 18; y += 44) {
    layer.lineBetween(rect.x + 18, y, rect.x + rect.width - 18, y);
  }
}

function drawSideStreetZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  layer.fillStyle(0x1b2a32, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x2a3942, 0.26);
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 36) {
    layer.fillRect(rect.x + 14, y, rect.width - 28, 8);
  }
  if (edge === "east" || edge === "west") {
    layer.fillStyle(0x23343d, 0.8);
    layer.fillRect(
      rect.x + rect.width / 2 - 18,
      rect.y + 22,
      36,
      rect.height - 44,
    );
  }
}

function drawQuayContinuationZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  void edge;
  layer.fillStyle(0x1f2a2f, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 12,
  );
  layer.fillStyle(0x6a655a, 0.55);
  layer.fillRect(rect.x, rect.y, rect.width, 16);
  layer.fillStyle(0x23566f, 1);
  layer.fillRect(
    rect.x,
    rect.y + Math.max(rect.height - 82, 0),
    rect.width,
    82,
  );
}

function drawHarborEdge(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const quayWall = visualScene.surfaceZones.find(
    (zone) => zone.kind === "quay_wall",
  );
  const dockApron = visualScene.surfaceZones.find(
    (zone) => zone.kind === "dock_apron",
  );
  const dockLandmark = visualScene.landmarks.find(
    (landmark) => landmark.style === "dock",
  );

  if (quayWall) {
    const rect = quayWall.rect;
    layer.lineStyle(2, 0xb4a583, 0.36);
    for (let x = rect.x + 26; x < rect.x + rect.width - 26; x += 86) {
      layer.lineBetween(x, rect.y + 10, x, rect.y + rect.height - 4);
    }
  }

  if (dockApron) {
    const rect = dockApron.rect;
    layer.fillStyle(0xb38b5c, 0.28);
    layer.fillRoundedRect(rect.x + 14, rect.y + 16, rect.width - 28, 18, 8);
  }

  if (dockLandmark) {
    const rect = dockLandmark.rect;
    layer.fillStyle(0x7a5b3f, 0.98);
    layer.fillRoundedRect(
      rect.x + 24,
      rect.y + 34,
      rect.width - 48,
      rect.height - 52,
      16,
    );
    layer.lineStyle(2, 0xa67d52, 0.26);
    for (let x = rect.x + 36; x < rect.x + rect.width - 36; x += 30) {
      layer.lineBetween(x, rect.y + 44, x, rect.y + rect.height - 26);
    }
    layer.fillStyle(0x6e5140, 1);
    layer.fillRoundedRect(rect.x + 72, rect.y + 58, 70, 16, 6);
    layer.fillRoundedRect(rect.x + rect.width - 152, rect.y + 84, 88, 16, 6);
  }
}

function drawLandmarkModules(
  objects: RuntimeObjects,
  visualScene: VisualScene,
) {
  const layer = objects.structureDetailLayer;
  for (const landmarkModule of visualScene.landmarkModules) {
    switch (landmarkModule.kind) {
      case "roof_cap":
        drawLandmarkRoofCap(layer, landmarkModule);
        break;
      case "wall_band":
        drawLandmarkWallBand(layer, landmarkModule);
        break;
      case "awning":
        drawLandmarkAwning(layer, landmarkModule);
        break;
      case "entry":
        drawLandmarkEntry(layer, landmarkModule);
        break;
      case "window_row":
        drawLandmarkWindowRow(layer, landmarkModule);
        break;
      case "terrace_rail":
        drawLandmarkTerraceRail(layer, landmarkModule);
        break;
      case "shutters":
        drawLandmarkShutters(layer, landmarkModule);
        break;
      case "stoop":
        drawLandmarkStoop(layer, landmarkModule);
        break;
      case "service_bay":
        drawLandmarkServiceBay(layer, landmarkModule);
        break;
      case "sign":
        drawLandmarkSign(layer, landmarkModule);
        break;
      case "trim":
        drawLandmarkTrim(layer, landmarkModule);
        break;
      case "downspout":
        drawLandmarkDownspout(layer, landmarkModule);
        break;
      default:
        break;
    }
  }

  for (const landmarkModule of visualScene.landmarkModules) {
    if (landmarkModule.kind !== "sign") {
      continue;
    }

    if (landmarkModule.variant === "cafe") {
      addLandmarkTextNode(objects, {
        color: "#f7edd2",
        fontFamily: "Georgia, serif",
        fontSize: Math.max(16, landmarkModule.rect.height * 0.55),
        text: "CAFE",
        x: landmarkModule.rect.x + landmarkModule.rect.width / 2,
        y:
          landmarkModule.rect.y +
          landmarkModule.rect.height / 2 +
          Math.max(4, landmarkModule.rect.height * 0.12),
      });
    }

    if (landmarkModule.variant === "yard") {
      addLandmarkTextNode(objects, {
        color: "#f0dfb8",
        fontFamily: "Arial Black, Impact, sans-serif",
        fontSize: Math.max(12, landmarkModule.rect.height * 0.44),
        text: "DOCK YARD",
        x: landmarkModule.rect.x + landmarkModule.rect.width / 2,
        y:
          landmarkModule.rect.y +
          landmarkModule.rect.height / 2 +
          Math.max(4, landmarkModule.rect.height * 0.12),
      });
    }
  }
}

function drawLandmarkRoofCap(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const roofColor =
    landmarkModule.variant === "verdigris"
      ? 0x567365
      : landmarkModule.variant === "iron"
        ? 0x53616b
        : landmarkModule.variant === "timber"
          ? 0x80614a
          : 0x5d6870;

  layer.fillStyle(roofColor, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 12,
  );
  layer.lineStyle(2, 0xbda676, 0.18);
  for (
    let x = landmarkModule.rect.x + 14;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 14;
    x += 30
  ) {
    layer.lineBetween(
      x,
      landmarkModule.rect.y + 8,
      x,
      landmarkModule.rect.y + landmarkModule.rect.height - 8,
    );
  }
}

function drawLandmarkWallBand(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const palette =
    landmarkModule.variant === "cafe-ivory"
      ? { base: 0xe7ddbf, accent: 0xc79268 }
      : landmarkModule.variant === "walnut"
        ? { base: 0x8c684a, accent: 0x6f5039 }
        : landmarkModule.variant === "boarding-upper"
          ? { base: 0xd0c2ab, accent: 0xb3765e }
          : landmarkModule.variant === "boarding-lower"
            ? { base: 0xc3b49b, accent: 0xa26d58 }
            : landmarkModule.variant === "workshop-stone"
              ? { base: 0x697883, accent: 0xbe8660 }
              : landmarkModule.variant === "yard-gatehouse"
                ? { base: 0x8e785e, accent: 0x70563f }
                : { base: 0xd0c2ab, accent: 0xaa7f61 };

  layer.fillStyle(palette.base, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 16,
  );
  layer.fillStyle(palette.accent, 0.9);
  layer.fillRect(
    landmarkModule.rect.x + 10,
    landmarkModule.rect.y + landmarkModule.rect.height * 0.45,
    landmarkModule.rect.width - 20,
    Math.max(18, landmarkModule.rect.height * 0.32),
  );
}

function drawLandmarkAwning(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const stripeCount = 8;
  const stripeWidth = landmarkModule.rect.width / stripeCount;
  for (let index = 0; index < stripeCount; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0x42a474 : 0xf3efe1, 1);
    layer.fillRect(
      landmarkModule.rect.x + index * stripeWidth,
      landmarkModule.rect.y,
      stripeWidth,
      landmarkModule.rect.height,
    );
  }
  layer.fillStyle(0x6b5037, 0.34);
  layer.fillRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y + landmarkModule.rect.height - 6,
    landmarkModule.rect.width,
    6,
  );
}

function drawLandmarkEntry(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const fill =
    landmarkModule.variant === "house-door"
      ? 0x71533f
      : landmarkModule.variant === "arched"
        ? 0x6d4d39
        : 0x3e4d53;
  layer.fillStyle(fill, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.fillStyle(0xf0deb2, 0.12);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 8,
    landmarkModule.rect.y + 10,
    Math.max(landmarkModule.rect.width - 16, 0),
    Math.max(landmarkModule.rect.height * 0.36, 0),
    6,
  );
}

function drawLandmarkWindowRow(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const count = landmarkModule.count ?? 3;
  const gap = 14;
  const unitWidth = Math.max(
    (landmarkModule.rect.width - gap * (count - 1)) / count,
    18,
  );
  const windowHeight =
    landmarkModule.variant === "cafe-large"
      ? landmarkModule.rect.height
      : landmarkModule.rect.height - 10;

  for (let index = 0; index < count; index += 1) {
    const x = landmarkModule.rect.x + index * (unitWidth + gap);
    layer.fillStyle(0xf0e0b4, 0.92);
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y + 4,
      unitWidth,
      windowHeight,
      8,
    );
    layer.fillStyle(0x5d4537, 0.22);
    layer.fillRoundedRect(
      x + 4,
      landmarkModule.rect.y + 8,
      unitWidth - 8,
      Math.max(windowHeight - 14, 0),
      6,
    );
  }
}

function drawLandmarkTerraceRail(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x7a5b42, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y + landmarkModule.rect.height / 2 - 4,
    landmarkModule.rect.width,
    8,
    4,
  );
  for (
    let x = landmarkModule.rect.x + 12;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 12;
    x += 26
  ) {
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y,
      4,
      landmarkModule.rect.height,
      2,
    );
  }
}

function drawLandmarkShutters(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const count = landmarkModule.count ?? 2;
  const gap = 12;
  const shutterWidth = Math.max(
    (landmarkModule.rect.width - gap * (count - 1)) / count,
    14,
  );

  for (let index = 0; index < count; index += 1) {
    const x = landmarkModule.rect.x + index * (shutterWidth + gap);
    layer.fillStyle(0xc3cbc7, 0.95);
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y,
      shutterWidth,
      landmarkModule.rect.height,
      6,
    );
    layer.fillStyle(0x62737c, 0.18);
    layer.fillRect(x + 4, landmarkModule.rect.y + 8, shutterWidth - 8, 6);
  }
}

function drawLandmarkStoop(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x9d8a6d, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 8,
  );
  layer.fillStyle(0x866f57, 0.9);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 10,
    landmarkModule.rect.y + 8,
    landmarkModule.rect.width - 20,
    8,
    4,
  );
}

function drawLandmarkServiceBay(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(
    landmarkModule.variant === "yard-gate" ? 0x6f5844 : 0x35474f,
    1,
  );
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.lineStyle(2, 0xc6a873, 0.22);
  for (
    let x = landmarkModule.rect.x + 12;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 12;
    x += 26
  ) {
    layer.lineBetween(
      x,
      landmarkModule.rect.y + 10,
      x,
      landmarkModule.rect.y + landmarkModule.rect.height - 10,
    );
  }
}

function drawLandmarkSign(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const fill =
    landmarkModule.variant === "cafe"
      ? 0x384a3f
      : landmarkModule.variant === "workshop"
        ? 0x3e4648
        : landmarkModule.variant === "yard"
          ? 0x564638
          : 0x2f4240;

  layer.fillStyle(fill, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.lineStyle(2, 0xd7bc79, 0.84);
  layer.strokeRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
}

function drawLandmarkTrim(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const trim =
    landmarkModule.variant === "warm-trim"
      ? 0xdeb88f
      : landmarkModule.variant === "industrial-band"
        ? 0xbc8d63
        : landmarkModule.variant === "yard-band"
          ? 0xc89d74
          : 0xd0b48c;
  layer.fillStyle(trim, 0.94);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 6,
  );
}

function drawLandmarkDownspout(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x53626a, 0.94);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 4,
  );
}

function drawPropClusters(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const cluster of visualScene.propClusters) {
    switch (cluster.kind) {
      case "cafe_terrace":
        drawCafeTerraceCluster(layer, cluster);
        break;
      case "square_bench_pair":
        drawBenchPairCluster(layer, cluster);
        break;
      case "square_planter_pair":
        drawPlanterPairCluster(layer, cluster);
        break;
      case "workshop_stock":
        drawWorkshopStockCluster(layer, cluster);
        break;
      case "yard_service":
        drawYardServiceCluster(layer, cluster);
        break;
      case "harbor_mooring":
        drawHarborMooringCluster(layer, cluster);
        break;
      default:
        break;
    }
  }

  for (const prop of visualScene.props) {
    switch (prop.kind) {
      case "lamp":
        drawAuthoredLamp(layer, prop.x, prop.y, prop.scale ?? 1);
        break;
      case "bench":
        drawAuthoredBench(layer, prop.x, prop.y, prop.rotation);
        break;
      case "planter":
        drawAuthoredPlanter(layer, prop.x, prop.y);
        break;
      case "terrace-table":
        drawAuthoredTerraceTable(layer, prop.x, prop.y);
        break;
      default:
        break;
    }
  }
}

function drawCafeTerraceCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  layer.fillStyle(0x7b5d44, 0.96);
  layer.fillRoundedRect(
    cluster.rect.x,
    cluster.rect.y + 12,
    cluster.rect.width,
    8,
    4,
  );
  for (
    let x = cluster.rect.x + 12;
    x < cluster.rect.x + cluster.rect.width - 12;
    x += 32
  ) {
    layer.fillRoundedRect(x, cluster.rect.y, 4, cluster.rect.height - 18, 2);
  }
  for (const tablePoint of cluster.points ?? []) {
    drawAuthoredTerraceTable(layer, tablePoint.x, tablePoint.y);
  }
  drawMenuBoard(layer, cluster.rect.x + 28, cluster.rect.y + 28);
  drawAuthoredPlanter(
    layer,
    cluster.rect.x + 20,
    cluster.rect.y + cluster.rect.height - 12,
  );
  drawAuthoredPlanter(
    layer,
    cluster.rect.x + cluster.rect.width - 20,
    cluster.rect.y + cluster.rect.height - 12,
  );
}

function drawBenchPairCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const benchPoint of cluster.points ?? []) {
    drawAuthoredBench(layer, benchPoint.x, benchPoint.y);
  }
}

function drawPlanterPairCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const planterPoint of cluster.points ?? []) {
    drawAuthoredPlanter(layer, planterPoint.x, planterPoint.y);
  }
}

function drawWorkshopStockCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const stockPoint of cluster.points ?? []) {
    drawCrateStack(layer, stockPoint.x, stockPoint.y);
  }
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width - 30,
    cluster.rect.y + 34,
  );
  drawToolStand(layer, cluster.rect.x + 42, cluster.rect.y + 24);
}

function drawYardServiceCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  const [pumpPoint = { x: cluster.rect.x + 54, y: cluster.rect.y + 56 }] =
    cluster.points ?? [];
  drawPump(layer, pumpPoint.x, pumpPoint.y);
  drawLaundryLine(
    layer,
    cluster.rect.x + 82,
    cluster.rect.y + 18,
    cluster.rect.x + cluster.rect.width - 26,
  );
  drawCrateStack(
    layer,
    cluster.rect.x + cluster.rect.width - 44,
    cluster.rect.y + cluster.rect.height - 30,
  );
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width / 2,
    cluster.rect.y + cluster.rect.height - 34,
  );
}

function drawHarborMooringCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const mooringPoint of cluster.points ?? []) {
    drawBollard(layer, mooringPoint.x, mooringPoint.y);
    drawRopeCoil(layer, mooringPoint.x + 18, mooringPoint.y + 8);
  }
  drawDockLadder(layer, cluster.rect.x + 112, cluster.rect.y + 24);
  drawCrateStack(
    layer,
    cluster.rect.x + cluster.rect.width - 58,
    cluster.rect.y + 28,
  );
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width - 104,
    cluster.rect.y + 34,
  );
}

function drawAuthoredSceneGround(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  layer.fillStyle(0x101c22, 1);
  layer.fillRect(0, 0, visualScene.width, visualScene.height);

  const townBody = {
    x: 92,
    y: 86,
    width: visualScene.width - 184,
    height: visualScene.height - 128,
  };
  layer.fillStyle(0x202f35, 1);
  layer.fillRoundedRect(
    townBody.x,
    townBody.y,
    townBody.width,
    townBody.height,
    26,
  );
  layer.lineStyle(2, 0x40515a, 0.7);
  layer.strokeRoundedRect(
    townBody.x,
    townBody.y,
    townBody.width,
    townBody.height,
    26,
  );

  const promenade = { x: 170, y: 184, width: 1360, height: 286, radius: 18 };
  const mainStreet = { x: 160, y: 454, width: 1402, height: 348, radius: 16 };
  const southWalk = { x: 154, y: 820, width: 1428, height: 198, radius: 14 };

  drawAuthoredPavingField(layer, promenade, {
    accent: 0xd6c59f,
    base: 0xcfbea2,
    line: 0xb5a58d,
  });
  drawAuthoredPavingField(layer, mainStreet, {
    accent: 0xd4c2a5,
    base: 0xcab89d,
    line: 0xbaa88f,
  });
  drawAuthoredPavingField(layer, southWalk, {
    accent: 0xd8c8ad,
    base: 0xcdbd9f,
    line: 0xb7a78e,
  });

  for (const waterRegion of visualScene.waterRegions) {
    const { rect } = waterRegion;
    layer.fillStyle(
      waterRegion.baseColor,
      waterRegion.tag === "shore_foam" ? 0.32 : 0.98,
    );
    layer.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  const dock = visualScene.landmarks.find(
    (landmark) => landmark.style === "dock",
  );
  if (dock) {
    layer.fillStyle(0x7f6040, 0.96);
    layer.fillRoundedRect(
      dock.rect.x,
      dock.rect.y,
      dock.rect.width,
      dock.rect.height,
      12,
    );
    layer.lineStyle(2, 0xa88056, 0.28);
    for (
      let x = dock.rect.x + 18;
      x < dock.rect.x + dock.rect.width - 18;
      x += 22
    ) {
      layer.lineBetween(
        x,
        dock.rect.y + 8,
        x,
        dock.rect.y + dock.rect.height - 8,
      );
    }
  }

  drawAuthoredFringeBlocks(layer, visualScene);
}

function drawAuthoredPavingField(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  palette: {
    accent: number;
    base: number;
    line: number;
  },
) {
  layer.fillStyle(palette.base, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.lineStyle(1, palette.line, 0.24);

  for (let x = rect.x + 16; x < rect.x + rect.width - 16; x += 28) {
    layer.lineBetween(x, rect.y + 12, x, rect.y + rect.height - 12);
  }

  for (let y = rect.y + 16; y < rect.y + rect.height - 16; y += 28) {
    layer.lineBetween(rect.x + 12, y, rect.x + rect.width - 12, y);
  }

  layer.fillStyle(palette.accent, 0.22);
  for (let y = rect.y + 12; y < rect.y + rect.height - 12; y += 56) {
    layer.fillRect(rect.x + 12, y, rect.width - 24, 6);
  }
}

function drawAuthoredFringeBlocks(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const blocks = [
    { x: 124, y: 110, width: 502, height: 92 },
    { x: 668, y: 112, width: 822, height: 86 },
    { x: 122, y: 1040, width: 862, height: 142 },
    { x: 1180, y: 932, width: 360, height: 138 },
    { x: 92, y: 248, width: 110, height: 716 },
    { x: 1558, y: 154, width: 188, height: 850 },
  ];

  layer.fillStyle(0x17242b, 1);
  for (const block of blocks) {
    layer.fillRoundedRect(block.x, block.y, block.width, block.height, 16);
  }

  layer.lineStyle(2, 0x31444d, 0.34);
  for (const block of blocks) {
    layer.strokeRoundedRect(block.x, block.y, block.width, block.height, 16);
  }

  layer.lineStyle(1, 0x3f5660, 0.22);
  for (const block of blocks) {
    for (let y = block.y + 18; y < block.y + block.height - 16; y += 32) {
      layer.lineBetween(block.x + 14, y, block.x + block.width - 14, y);
    }
  }

  void visualScene;
}

function drawAuthoredSceneStructures(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const landmark of visualScene.landmarks) {
    switch (landmark.style) {
      case "boarding-house":
        drawBoardingHouseFacade(layer, landmark.rect);
        break;
      case "cafe":
        drawCafeFacade(layer, landmark.rect);
        break;
      case "courtyard":
        drawCourtyardSpace(layer, landmark.rect);
        break;
      case "dock":
        drawDockEdgeDetails(layer, landmark.rect);
        break;
      case "square":
        drawSquareLandmark(layer, landmark.rect);
        break;
      case "workshop":
        drawWorkshopFacade(layer, landmark.rect);
        break;
      case "yard":
        drawYardLandmark(layer, landmark.rect);
        break;
      default:
        break;
    }
  }

  for (const prop of visualScene.props) {
    switch (prop.kind) {
      case "bench":
        drawAuthoredBench(layer, prop.x, prop.y, prop.rotation);
        break;
      case "boat":
        break;
      case "lamp":
        drawAuthoredLamp(layer, prop.x, prop.y, prop.scale ?? 1);
        break;
      case "planter":
        drawAuthoredPlanter(layer, prop.x, prop.y);
        break;
      case "terrace-table":
        drawAuthoredTerraceTable(layer, prop.x, prop.y);
        break;
      default:
        break;
    }
  }
}

function drawCafeFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x3e5548, 1);
  layer.fillRoundedRect(rect.x + 18, rect.y, rect.width - 36, 30, 14);
  layer.fillStyle(0xe6dec2, 1);
  layer.fillRoundedRect(rect.x, rect.y + 28, rect.width, rect.height - 28, 18);
  layer.fillStyle(0xb37e59, 0.96);
  layer.fillRect(rect.x + 10, rect.y + 96, rect.width - 20, 72);
  layer.fillStyle(0x714f37, 0.94);
  layer.fillRoundedRect(rect.x + 40, rect.y + 130, rect.width - 80, 58, 12);

  const awningY = rect.y + 82;
  const awningSegments = 8;
  const awningWidth = (rect.width - 28) / awningSegments;
  for (let index = 0; index < awningSegments; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0x3e9f6f : 0xf3efe4, 1);
    layer.fillRect(rect.x + 14 + index * awningWidth, awningY, awningWidth, 28);
  }

  layer.fillStyle(0xf8e9be, 0.95);
  layer.fillRoundedRect(rect.x + 30, rect.y + 138, 60, 42, 8);
  layer.fillRoundedRect(rect.x + rect.width - 90, rect.y + 138, 60, 42, 8);
  layer.fillStyle(0x79563d, 1);
  layer.fillRoundedRect(rect.x + rect.width / 2 - 28, rect.y + 126, 56, 62, 10);
  layer.lineStyle(2, 0xceb883, 0.9);
  layer.strokeRoundedRect(rect.x + 58, rect.y + 44, rect.width - 116, 34, 10);
}

function drawBoardingHouseFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x55656d, 1);
  layer.fillRoundedRect(rect.x, rect.y, rect.width, 42, 18);
  layer.fillStyle(0xc3b49c, 1);
  layer.fillRoundedRect(rect.x, rect.y + 36, rect.width, rect.height - 36, 18);
  layer.fillStyle(0xb06d58, 0.92);
  layer.fillRect(rect.x + 12, rect.y + 78, rect.width - 24, 64);
  layer.fillStyle(0x6c4938, 1);
  layer.fillRoundedRect(
    rect.x + rect.width / 2 - 22,
    rect.y + rect.height - 78,
    44,
    68,
    10,
  );
  layer.fillStyle(0xf2dfb6, 0.92);
  for (let index = 0; index < 4; index += 1) {
    const x = rect.x + 36 + index * 58;
    layer.fillRoundedRect(x, rect.y + 58, 30, 40, 6);
    layer.fillRoundedRect(x, rect.y + 114, 30, 34, 6);
  }
  layer.fillStyle(0x9a7a63, 1);
  layer.fillRoundedRect(
    rect.x + rect.width / 2 - 34,
    rect.y + rect.height - 20,
    68,
    18,
    8,
  );
}

function drawWorkshopFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x59656f, 1);
  layer.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 16);
  layer.fillStyle(0x8e5e42, 0.92);
  layer.fillRect(rect.x + 10, rect.y + 54, rect.width - 20, 56);
  layer.fillStyle(0xe0d6bb, 0.96);
  const segments = 6;
  const segmentWidth = (rect.width - 24) / segments;
  for (let index = 0; index < segments; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0xf1f0ea : 0xc8824b, 1);
    layer.fillRect(
      rect.x + 12 + index * segmentWidth,
      rect.y + 116,
      segmentWidth,
      28,
    );
  }
  layer.fillStyle(0x36454d, 1);
  layer.fillRoundedRect(rect.x + 54, rect.y + 138, rect.width - 108, 48, 10);
  layer.fillStyle(0xd4c9ac, 0.88);
  layer.fillRoundedRect(rect.x + 18, rect.y + 144, 24, 34, 4);
  layer.fillRoundedRect(rect.x + rect.width - 42, rect.y + 144, 24, 34, 4);
}

function drawSquareLandmark(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0xddcfaf, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.lineStyle(1, 0xc7b898, 0.32);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 30) {
    layer.lineBetween(x, rect.y + 14, x, rect.y + rect.height - 14);
  }
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 30) {
    layer.lineBetween(rect.x + 14, y, rect.x + rect.width - 14, y);
  }
  layer.fillStyle(0x8c948f, 0.96);
  layer.fillEllipse(rect.x + rect.width / 2, rect.y + rect.height / 2, 42, 42);
  layer.fillStyle(0xc8d8df, 0.72);
  layer.fillEllipse(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2 - 2,
    20,
    20,
  );
}

function drawYardLandmark(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x8d7458, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x6d5844, 0.82);
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 34) {
    layer.fillRect(rect.x + 14, y, rect.width - 28, 10);
  }
  layer.fillStyle(0x7f694f, 1);
  layer.fillRoundedRect(rect.x + 22, rect.y + 22, 54, 44, 8);
  layer.fillRoundedRect(rect.x + rect.width - 78, rect.y + 40, 52, 40, 8);
}

function drawCourtyardSpace(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x6f7f5a, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.fillStyle(0x566746, 0.42);
  layer.fillRoundedRect(
    rect.x + 12,
    rect.y + 12,
    rect.width - 24,
    rect.height - 24,
    14,
  );
  layer.fillStyle(0x8e8b78, 0.96);
  layer.fillRoundedRect(rect.x + rect.width / 2 - 16, rect.y + 68, 32, 32, 8);
  layer.lineStyle(3, 0xc7d8e1, 0.72);
  layer.lineBetween(
    rect.x + rect.width / 2,
    rect.y + 82,
    rect.x + rect.width / 2,
    rect.y + 44,
  );
}

function drawDockEdgeDetails(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x9d794f, 0.94);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 54) {
    layer.fillRoundedRect(x, rect.y + rect.height - 22, 12, 22, 4);
  }
  layer.fillStyle(0x6a4f36, 1);
  layer.fillRoundedRect(rect.x + 24, rect.y + 28, 80, 14, 6);
  layer.fillRoundedRect(rect.x + rect.width - 108, rect.y + 50, 74, 14, 6);
}

function drawAuthoredLamp(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
) {
  layer.fillStyle(0x0c1318, 0.22);
  layer.fillEllipse(x, y + 8 * scale, 12 * scale, 6 * scale);
  layer.fillStyle(0x3a474d, 1);
  layer.fillRoundedRect(
    x - 2 * scale,
    y - 18 * scale,
    4 * scale,
    26 * scale,
    2,
  );
  layer.fillRoundedRect(x - 5 * scale, y + 6 * scale, 10 * scale, 4 * scale, 2);
  layer.fillStyle(0xf3dfa6, 0.98);
  layer.fillRoundedRect(
    x - 5 * scale,
    y - 28 * scale,
    10 * scale,
    12 * scale,
    4,
  );
  layer.fillStyle(0xf3dfa6, 0.18);
  layer.fillCircle(x, y - 22 * scale, 11 * scale);
}

function drawAuthoredBench(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  rotation = 0,
) {
  if (Math.abs(rotation) > 0.4) {
    layer.fillStyle(0x795c42, 1);
    layer.fillRoundedRect(x - 8, y - 26, 16, 50, 5);
    layer.fillRoundedRect(x - 18, y - 20, 6, 36, 3);
    layer.fillRoundedRect(x + 12, y - 20, 6, 36, 3);
    return;
  }

  layer.fillStyle(0x795c42, 1);
  layer.fillRoundedRect(x - 30, y - 8, 60, 16, 5);
  layer.fillRoundedRect(x - 24, y - 18, 48, 6, 3);
  layer.fillRoundedRect(x - 20, y + 6, 6, 18, 3);
  layer.fillRoundedRect(x + 14, y + 6, 6, 18, 3);
}

function drawAuthoredPlanter(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x6e5b4b, 1);
  layer.fillRoundedRect(x - 14, y - 10, 28, 20, 6);
  layer.fillStyle(0x4e7747, 0.98);
  layer.fillCircle(x - 6, y - 6, 10);
  layer.fillCircle(x + 2, y - 10, 9);
  layer.fillCircle(x + 9, y - 5, 8);
}

function drawAuthoredTerraceTable(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x694f38, 1);
  layer.fillCircle(x, y, 12);
  layer.fillRoundedRect(x - 1.5, y + 6, 3, 18, 1.5);
  layer.fillRoundedRect(x - 22, y + 8, 12, 4, 2);
  layer.fillRoundedRect(x + 10, y + 8, 12, 4, 2);
  layer.fillRoundedRect(x - 18, y - 2, 8, 3, 2);
  layer.fillRoundedRect(x + 10, y - 2, 8, 3, 2);
}

function drawMenuBoard(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 14, 18, 6);
  layer.fillStyle(0x78593f, 1);
  layer.fillRoundedRect(x - 4, y - 4, 8, 24, 4);
  layer.fillRoundedRect(x - 12, y + 18, 24, 4, 2);
  layer.fillStyle(0x38463f, 1);
  layer.fillRoundedRect(x - 16, y - 20, 32, 24, 6);
  layer.lineStyle(2, 0xd7bc79, 0.72);
  layer.strokeRoundedRect(x - 16, y - 20, 32, 24, 6);
}

function drawCrateStack(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.1);
  layer.fillEllipse(x + 2, y + 10, 34, 8);
  const crates = [
    { x: x - 18, y: y - 12, width: 26, height: 20 },
    { x: x - 2, y: y - 24, width: 24, height: 18 },
  ];
  for (const crate of crates) {
    layer.fillStyle(0x8b6848, 1);
    layer.fillRoundedRect(crate.x, crate.y, crate.width, crate.height, 4);
    layer.lineStyle(2, 0xa88460, 0.5);
    layer.strokeRoundedRect(crate.x, crate.y, crate.width, crate.height, 4);
    layer.lineBetween(
      crate.x + 4,
      crate.y + 4,
      crate.x + crate.width - 4,
      crate.y + crate.height - 4,
    );
    layer.lineBetween(
      crate.x + crate.width - 4,
      crate.y + 4,
      crate.x + 4,
      crate.y + crate.height - 4,
    );
  }
}

function drawBarrel(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.1);
  layer.fillEllipse(x, y + 10, 22, 6);
  layer.fillStyle(0x7c5b42, 1);
  layer.fillEllipse(x, y - 10, 18, 8);
  layer.fillRoundedRect(x - 10, y - 10, 20, 28, 6);
  layer.fillStyle(0xc2a070, 0.82);
  layer.fillRect(x - 10, y - 2, 20, 3);
  layer.fillRect(x - 10, y + 8, 20, 3);
}

function drawToolStand(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.08);
  layer.fillEllipse(x, y + 14, 24, 6);
  layer.fillStyle(0x6e5640, 1);
  layer.fillRoundedRect(x - 12, y - 18, 24, 38, 6);
  layer.fillStyle(0xced7dc, 0.92);
  layer.fillRoundedRect(x - 8, y - 10, 4, 20, 2);
  layer.fillRoundedRect(x - 1, y - 12, 4, 22, 2);
  layer.fillRoundedRect(x + 6, y - 8, 4, 18, 2);
  layer.fillStyle(0x8a6b4b, 1);
  layer.fillRect(x - 9, y - 14, 6, 4);
  layer.fillRect(x + 4, y - 15, 8, 4);
}

function drawPump(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.08);
  layer.fillEllipse(x, y + 16, 28, 8);
  layer.fillStyle(0x728087, 1);
  layer.fillRoundedRect(x - 10, y - 8, 20, 28, 6);
  layer.fillRoundedRect(x - 3, y - 30, 6, 22, 3);
  layer.fillRoundedRect(x + 3, y - 26, 20, 4, 2);
  layer.fillRoundedRect(x + 18, y - 26, 4, 16, 2);
  layer.fillStyle(0x8f6a48, 1);
  layer.fillRoundedRect(x - 14, y + 18, 28, 6, 3);
}

function drawLaundryLine(
  layer: PhaserType.GameObjects.Graphics,
  startX: number,
  y: number,
  endX: number,
) {
  layer.lineStyle(2, 0x665548, 0.52);
  layer.lineBetween(startX, y, endX, y + 4);
  const clothColors = [0xf0e9dd, 0xc58f63, 0x7a9cba, 0xe7d6a6];
  const spacing = (endX - startX) / 5;
  for (let index = 0; index < 4; index += 1) {
    const clothX = startX + spacing * (index + 0.7);
    layer.fillStyle(clothColors[index], 0.96);
    layer.fillRoundedRect(clothX - 8, y + 2, 16, 18, 3);
  }
}

function drawBollard(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 12, 18, 6);
  layer.fillStyle(0x5b4d43, 1);
  layer.fillRoundedRect(x - 8, y - 8, 16, 22, 6);
  layer.fillStyle(0xc6a873, 0.88);
  layer.fillRoundedRect(x - 8, y - 10, 16, 5, 2);
}

function drawRopeCoil(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.lineStyle(3, 0xc8ab72, 0.85);
  layer.strokeEllipse(x, y, 18, 10);
  layer.strokeEllipse(x, y, 10, 5);
}

function drawDockLadder(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.lineStyle(3, 0x61727a, 0.84);
  layer.lineBetween(x - 6, y - 18, x - 6, y + 26);
  layer.lineBetween(x + 6, y - 18, x + 6, y + 26);
  for (let rungY = y - 10; rungY <= y + 20; rungY += 8) {
    layer.lineBetween(x - 6, rungY, x + 6, rungY);
  }
}

function drawAuthoredBoat(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  rotation: number,
  scale: number,
) {
  const width = 56 * scale;
  const height = 18 * scale;
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 10 * scale, width * 0.9, height * 0.78);
  layer.fillStyle(0x805f43, 0.98);
  layer.fillRoundedRect(
    x - width / 2,
    y - height / 2,
    width,
    height,
    8 * scale,
  );
  layer.fillStyle(0xd7c095, 0.82);
  layer.fillRoundedRect(
    x - width / 2 + 8,
    y - 2,
    width - 16,
    4 * scale,
    2 * scale,
  );
  void rotation;
}

function drawAnimatedVisualWater(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  now: number,
) {
  const beat = now / 1000;
  const animatedWaterRegions =
    visualScene.waterRegions.filter((region) => region.tag === "water_surface")
      .length > 0
      ? visualScene.waterRegions
          .filter((region) => region.tag === "water_surface")
          .map((region) => ({
            crestColor: region.crestColor,
            intensity: region.intensity,
            rect: region.rect,
          }))
      : visualScene.surfaceZones
          .filter((zone) => zone.kind === "deep_water")
          .map((zone) => ({
            crestColor: 0xd8f4fb,
            intensity: 0.78,
            rect: zone.rect,
          }));

  for (const waterRegion of animatedWaterRegions) {
    const { rect } = waterRegion;
    const swellColor = blendColor(waterRegion.crestColor, 0x2a5f76, 0.52);
    const highlightColor = blendColor(waterRegion.crestColor, 0xffffff, 0.28);

    for (let row = 18; row < rect.height - 8; row += 28) {
      const rowPhase = row * 0.034;
      drawWaveStroke(
        layer,
        rect.x + 12,
        rect.y + row,
        Math.max(rect.width - 24, 0),
        beat,
        rowPhase,
        5.6,
        4.4,
        swellColor,
        0.055 + waterRegion.intensity * 0.03,
      );
      drawWaveStroke(
        layer,
        rect.x + 18,
        rect.y + row - 5,
        Math.max(rect.width - 36, 0),
        beat,
        rowPhase + 0.85,
        3.2,
        2.2,
        highlightColor,
        0.085 + waterRegion.intensity * 0.05,
        {
          packetLength: Math.max(Math.min(rect.width * 0.22, 108), 52),
          softness: 1.9,
          speed: 0.14,
        },
      );
    }

    for (let row = 14; row < rect.height - 10; row += 20) {
      for (let x = rect.x + 20; x < rect.x + rect.width - 28; x += 76) {
        const localWave = beat * 1.5 + row * 0.08 + x * 0.014;
        const drift = Math.sin(localWave) * 8;
        const chopWidth = 24 + (Math.sin(localWave * 0.72) + 1) * 14;
        const chopY = rect.y + row + Math.sin(localWave * 1.18) * 3.4;
        layer.lineStyle(
          1.8,
          waterRegion.crestColor,
          0.08 + waterRegion.intensity * 0.05,
        );
        layer.lineBetween(
          x + drift,
          chopY,
          Math.min(x + drift + chopWidth, rect.x + rect.width - 16),
          chopY - 1.6,
        );
      }

      for (let x = rect.x + 34; x < rect.x + rect.width - 22; x += 116) {
        const shimmerPhase = beat * 1.22 + row * 0.05 + x * 0.009;
        layer.fillStyle(
          blendColor(waterRegion.crestColor, 0xffffff, 0.38),
          0.035 + (Math.sin(shimmerPhase) + 1) * 0.018,
        );
        layer.fillEllipse(
          x + Math.sin(shimmerPhase * 0.8) * 5,
          rect.y + row + 6 + Math.cos(shimmerPhase) * 3,
          18,
          3.2,
        );
      }
    }
  }

  for (const waterRegion of visualScene.waterRegions) {
    const { rect } = waterRegion;
    if (waterRegion.tag === "shore_foam") {
      drawWaveStroke(
        layer,
        rect.x + 10,
        rect.y + rect.height / 2,
        Math.max(rect.width - 20, 0),
        beat,
        rect.y * 0.01,
        1.8,
        1.8,
        waterRegion.crestColor,
        0.08 + waterRegion.intensity * 0.05,
        {
          packetLength: Math.max(Math.min(rect.width * 0.18, 84), 34),
          softness: 2,
          speed: 0.22,
        },
      );
      for (let x = rect.x; x < rect.x + rect.width; x += 22) {
        const lift = Math.sin(beat * 2.3 + x * 0.04) * 4;
        layer.fillStyle(
          waterRegion.crestColor,
          0.12 + waterRegion.intensity * 0.08,
        );
        layer.fillEllipse(x, rect.y + rect.height / 2 + lift, 20, 5);
        layer.fillStyle(0xffffff, 0.045 + waterRegion.intensity * 0.03);
        layer.fillEllipse(x + 4, rect.y + rect.height / 2 + lift - 1, 12, 2.8);
      }
    }
  }

  const terrainGrid = buildTerrainDraftGrid(visualScene);
  if (terrainGrid) {
    const waterSegments = buildTerrainDraftWaterSegments(terrainGrid);

    for (const segment of waterSegments) {
      const segmentPhase = segment.row * 0.32;
      drawWaveStroke(
        layer,
        segment.x + 10,
        segment.y + segment.height * 0.24,
        Math.max(segment.width - 20, 0),
        beat,
        segmentPhase,
        4.2,
        2.8,
        0xdcf5fb,
        0.18,
      );
      drawWaveStroke(
        layer,
        segment.x + 12,
        segment.y + segment.height * 0.5,
        Math.max(segment.width - 24, 0),
        beat,
        segmentPhase + 0.9,
        3.1,
        2.2,
        0xd4eef5,
        0.12,
        {
          packetLength: Math.max(Math.min(segment.width * 0.28, 88), 34),
          softness: 1.85,
          speed: 0.18,
        },
      );
      drawWaveStroke(
        layer,
        segment.x + 16,
        segment.y + segment.height * 0.74,
        Math.max(segment.width - 32, 0),
        beat,
        segmentPhase + 1.45,
        2.1,
        1.7,
        0xc6e5ee,
        0.08,
        {
          packetLength: Math.max(Math.min(segment.width * 0.22, 72), 28),
          softness: 2.1,
          speed: 0.24,
        },
      );
    }

    for (let row = 0; row < terrainGrid.rows; row += 1) {
      for (let col = 0; col < terrainGrid.cols; col += 1) {
        if (terrainGrid.kinds[row][col] !== "water") {
          continue;
        }

        const rect = terrainDraftCellRect(
          visualScene,
          terrainGrid.cellSize,
          col,
          row,
        );
        const top = row > 0 ? terrainGrid.kinds[row - 1][col] : null;
        const bottom =
          row < terrainGrid.rows - 1 ? terrainGrid.kinds[row + 1][col] : null;
        const left = col > 0 ? terrainGrid.kinds[row][col - 1] : null;
        const right =
          col < terrainGrid.cols - 1 ? terrainGrid.kinds[row][col + 1] : null;
        const shoreEdges = [
          top === "land" ? "top" : null,
          bottom === "land" ? "bottom" : null,
          left === "land" ? "left" : null,
          right === "land" ? "right" : null,
        ].filter(Boolean) as Array<"bottom" | "left" | "right" | "top">;

        for (const side of shoreEdges) {
          const foamAlpha =
            0.13 + (Math.sin(beat * 2.1 + col * 0.61 + row * 0.49) + 1) * 0.08;
          layer.fillStyle(0xf5fcff, foamAlpha);

          if (side === "top") {
            for (let x = rect.x + 8; x < rect.x + rect.width - 8; x += 18) {
              const lift = Math.sin(beat * 2.3 + x * 0.05) * 3;
              layer.fillEllipse(x, rect.y + 4 + lift, 18, 4.8);
            }
          } else if (side === "bottom") {
            for (let x = rect.x + 8; x < rect.x + rect.width - 8; x += 18) {
              const lift = Math.sin(beat * 2.3 + x * 0.05 + 1.4) * 3;
              layer.fillEllipse(x, rect.y + rect.height - 4 + lift, 18, 4.8);
            }
          } else if (side === "left") {
            for (let y = rect.y + 8; y < rect.y + rect.height - 8; y += 18) {
              const driftY = Math.sin(beat * 2.1 + y * 0.05) * 2.5;
              layer.fillEllipse(rect.x + 4 + driftY, y, 4.8, 18);
            }
          } else {
            for (let y = rect.y + 8; y < rect.y + rect.height - 8; y += 18) {
              const driftY = Math.sin(beat * 2.1 + y * 0.05 + 1.4) * 2.5;
              layer.fillEllipse(rect.x + rect.width - 4 + driftY, y, 4.8, 18);
            }
          }
        }
      }
    }
  }

  for (const prop of visualScene.props) {
    if (prop.kind === "lamp") {
      const flicker = 0.12 + (Math.sin(beat * 2.4 + prop.x * 0.015) + 1) * 0.03;
      layer.fillStyle(0xf3dfa6, flicker);
      layer.fillCircle(
        prop.x,
        prop.y - 22 * (prop.scale ?? 1),
        12 * (prop.scale ?? 1),
      );
      continue;
    }

    if (prop.kind === "boat") {
      const bob = Math.sin(beat * 1.2 + prop.x * 0.01) * (prop.bobAmount ?? 4);
      drawAuthoredBoat(
        layer,
        prop.x,
        prop.y + bob,
        prop.rotation ?? 0,
        prop.scale ?? 1,
      );
    }
  }
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
}

type SkyLayerPalette = {
  body: number;
  edge: number;
  haze: number;
  hazeAlpha: number;
  mist: number;
  mistAlpha: number;
  mistAccent: number;
  mistAccentAlpha: number;
  rain: number;
  stormRain: number;
};

function skyLayerPalette(kind: VisualSceneCloudKind): SkyLayerPalette {
  switch (kind) {
    case "storm-front":
      return {
        body: 0x737f8f,
        edge: 0xc5d0dc,
        haze: 0x606c78,
        hazeAlpha: 0.24,
        mist: 0xdbe8ee,
        mistAlpha: 0.2,
        mistAccent: 0xbecfd8,
        mistAccentAlpha: 0.14,
        rain: 0xd4e2ec,
        stormRain: 0xd0deeb,
      };
    case "harbor-bank":
      return {
        body: 0xdee8ec,
        edge: 0xffffff,
        haze: 0xd2e0e6,
        hazeAlpha: 0.18,
        mist: 0xeef4f6,
        mistAlpha: 0.18,
        mistAccent: 0xd6e2e6,
        mistAccentAlpha: 0.12,
        rain: 0xe2ecf2,
        stormRain: 0xd6e4ee,
      };
    case "wispy":
    default:
      return {
        body: 0xf0f5f7,
        edge: 0xffffff,
        haze: 0xe4ecf1,
        hazeAlpha: 0.14,
        mist: 0xf1f6f7,
        mistAlpha: 0.16,
        mistAccent: 0xdfeaf0,
        mistAccentAlpha: 0.11,
        rain: 0xe6eff4,
        stormRain: 0xd8e5ef,
      };
  }
}

function weatherLayerOpacity(
  kind: VisualSceneWeatherKind,
  baseOpacity: number,
) {
  switch (kind) {
    case "mist":
      return Math.min(baseOpacity * 0.74, 0.48);
    case "drizzle":
      return Math.min(baseOpacity * 0.64, 0.34);
    case "rain":
      return Math.min(baseOpacity * 0.76, 0.46);
    case "storm":
      return Math.min(baseOpacity * 0.92, 0.6);
    default:
      return 0;
  }
}

function drawAnimatedSkyWeather(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  now: number,
) {
  if (visualScene.skyLayers.length === 0) {
    return;
  }

  const beat = now / 1000;

  for (const skyLayer of visualScene.skyLayers) {
    const skyRect = getNormalizedSkyLayerRect(
      visualScene.height,
      skyLayer.rect,
    );
    const bandX = clamp(skyRect.x, 0, Math.max(visualScene.width - 1, 0));
    const bandWidth = Math.max(
      1,
      Math.min(skyRect.width, visualScene.width - bandX),
    );
    const coverageWidth = Math.max(bandWidth, visualScene.width * 0.16);
    const cloudCount = Math.max(
      4,
      Math.round((coverageWidth / 240) * Math.max(skyLayer.density, 1.2)),
    );
    const spacing = Math.max(
      (coverageWidth + bandWidth * 0.14) / Math.max(cloudCount, 1),
      140,
    );
    const travelSpan = bandWidth + spacing * 3;
    const phaseOffset = getSkyLayerPhaseOffset(
      skyRect.x,
      visualScene.width,
      travelSpan,
    );
    const drift = positiveModulo(
      beat * skyLayer.speed * 4 + phaseOffset,
      travelSpan,
    );
    const palette = skyLayerPalette(skyLayer.cloudKind);
    const weatherOpacity = weatherLayerOpacity(
      skyLayer.weather,
      skyLayer.opacity,
    );
    const fallLength =
      skyLayer.weather === "storm"
        ? Math.min(visualScene.height - skyRect.y, 360)
        : skyLayer.weather === "rain"
          ? Math.min(visualScene.height - skyRect.y, 280)
          : skyLayer.weather === "drizzle"
            ? Math.min(visualScene.height - skyRect.y, 180)
            : Math.min(visualScene.height - skyRect.y, skyRect.height + 80);

    if (skyLayer.weather === "mist") {
      const mistHeight = Math.max(
        0,
        Math.min(skyRect.height + 70, visualScene.height - skyRect.y),
      );
      if (mistHeight > 0.5) {
        layer.fillStyle(palette.mist, palette.mistAlpha);
        layer.fillRoundedRect(
          bandX,
          skyRect.y,
          bandWidth,
          mistHeight,
          skyRect.radius ?? 20,
        );
      }
      const mistAccentY = Math.min(skyRect.y + 18, visualScene.height);
      const mistAccentHeight = Math.max(
        0,
        Math.min(skyRect.height + 110, visualScene.height - mistAccentY),
      );
      if (mistAccentHeight > 0.5) {
        layer.fillStyle(palette.mistAccent, palette.mistAccentAlpha);
        layer.fillRect(bandX, mistAccentY, bandWidth, mistAccentHeight);
      }
    }

    if (
      skyLayer.weather === "drizzle" ||
      skyLayer.weather === "rain" ||
      skyLayer.weather === "storm"
    ) {
      const rainCount = Math.max(
        10,
        Math.round(
          (bandWidth / 38) *
            (skyLayer.weather === "storm"
              ? 1.6
              : skyLayer.weather === "rain"
                ? 1.15
                : 0.7),
        ),
      );
      const rainLead = positiveModulo(beat * skyLayer.speed * 3, 28);
      const rainSlant =
        skyLayer.weather === "storm"
          ? 18
          : skyLayer.weather === "rain"
            ? 14
            : 10;
      const rainDrop =
        skyLayer.weather === "storm"
          ? 42
          : skyLayer.weather === "rain"
            ? 32
            : 24;
      const rainWidth = skyLayer.weather === "storm" ? 2.6 : 1.8;
      const rainColor =
        skyLayer.weather === "storm" ? palette.stormRain : palette.rain;
      const rainAlpha =
        (skyLayer.weather === "storm" ? 0.3 : 0.24) *
        clamp(
          weatherOpacity * (skyLayer.weather === "storm" ? 1.18 : 1.34),
          0.24,
          1,
        );

      layer.lineStyle(rainWidth, rainColor, rainAlpha);
      for (let rainIndex = 0; rainIndex < rainCount; rainIndex += 1) {
        const x =
          bandX +
          (((rainIndex / rainCount) * bandWidth + rainLead) % bandWidth);
        const y =
          skyRect.y +
          18 +
          ((rainIndex * 17) % Math.max(skyRect.height - 14, 24));
        if (y > visualScene.height) {
          continue;
        }
        layer.lineBetween(
          x,
          y,
          Math.max(x - rainSlant, bandX),
          Math.min(y + rainDrop + fallLength * 0.2, visualScene.height),
        );
      }
    }

    const hazeAlpha = clamp(
      palette.hazeAlpha * (0.74 + skyLayer.opacity * 0.42),
      0.08,
      0.4,
    );
    layer.fillStyle(palette.haze, hazeAlpha);
    layer.fillRoundedRect(
      bandX,
      skyRect.y,
      bandWidth,
      skyRect.height,
      skyRect.radius ?? 18,
    );

    for (let cloudIndex = 0; cloudIndex < cloudCount + 3; cloudIndex += 1) {
      const wrappedX =
        positiveModulo(cloudIndex * spacing + drift, travelSpan) - spacing;
      const cloudScale =
        skyLayer.scale *
        (skyLayer.cloudKind === "storm-front"
          ? 1.28
          : skyLayer.cloudKind === "harbor-bank"
            ? 1.12
            : 0.94) *
        (0.92 + (cloudIndex % 3) * 0.11);
      const cloudWidth = 118 * cloudScale;
      const cloudHeight = 36 * cloudScale;
      const cloudX = bandX + wrappedX;
      if (cloudX < bandX || cloudX + cloudWidth > bandX + bandWidth) {
        continue;
      }
      const baseY =
        skyRect.y +
        skyRect.height * (0.18 + (cloudIndex % 4) * 0.12) +
        Math.sin(beat * 0.45 + cloudIndex * 0.9) * 6;
      if (baseY > visualScene.height || baseY + cloudHeight < -6) {
        continue;
      }
      const cloudAlpha = Math.max(
        0.12,
        Math.min(skyLayer.opacity * (0.7 + (cloudIndex % 2) * 0.12), 1),
      );

      layer.fillStyle(0x000000, 0.08 * cloudAlpha);
      layer.fillEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.66,
        cloudWidth * 0.92,
        cloudHeight * 0.48,
      );

      layer.fillStyle(palette.body, cloudAlpha);
      layer.lineStyle(1.2, palette.edge, cloudAlpha * 0.34);
      layer.fillEllipse(
        cloudX + cloudWidth * 0.28,
        baseY + cloudHeight * 0.58,
        cloudWidth * 0.48,
        cloudHeight * 0.84,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.28,
        baseY + cloudHeight * 0.58,
        cloudWidth * 0.48,
        cloudHeight * 0.84,
      );
      layer.fillEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.42,
        cloudWidth * 0.62,
        cloudHeight * 0.96,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.42,
        cloudWidth * 0.62,
        cloudHeight * 0.96,
      );
      layer.fillEllipse(
        cloudX + cloudWidth * 0.78,
        baseY + cloudHeight * 0.6,
        cloudWidth * 0.52,
        cloudHeight * 0.76,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.78,
        baseY + cloudHeight * 0.6,
        cloudWidth * 0.52,
        cloudHeight * 0.76,
      );
      layer.fillRoundedRect(
        cloudX + cloudWidth * 0.18,
        baseY + cloudHeight * 0.5,
        cloudWidth * 0.66,
        cloudHeight * 0.46,
        cloudHeight * 0.22,
      );
    }

    if (skyLayer.weather === "storm") {
      const flashCycle = positiveModulo(beat / 9.5, 1);
      const flashAlpha =
        flashCycle >= 0.87 && flashCycle < 0.88
          ? 0.06
          : flashCycle >= 0.88 && flashCycle < 0.89
            ? 0.24
            : flashCycle >= 0.89 && flashCycle < 0.9
              ? 0.04
              : flashCycle >= 0.9 && flashCycle < 0.91
                ? 0.14
                : 0;
      if (flashAlpha > 0) {
        const flashY = Math.max(skyRect.y - 8, 0);
        const flashHeight = Math.max(
          0,
          Math.min(skyRect.height + 22, visualScene.height - flashY),
        );
        if (flashHeight > 0.5) {
          layer.fillStyle(0xf8fcff, flashAlpha * weatherOpacity);
          layer.fillRect(bandX, flashY, bandWidth, flashHeight);
        }
      }
    }
  }
}

function clearConversationReplayTimer(runtimeState: RuntimeState) {
  if (runtimeState.conversationReplay.timerId !== null) {
    window.clearTimeout(runtimeState.conversationReplay.timerId);
    runtimeState.conversationReplay.timerId = null;
  }
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
  runtimeState.conversationReplay.activeNpcId = npcId;
  runtimeState.conversationReplay.appliedSignature = replaySignature;
  runtimeState.conversationReplay.isReplaying = replayEntryIds.length > 0;
  runtimeState.conversationReplay.revealedEntryIds = visibleEntries
    .filter((entry) => !replayEntryIds.includes(entry.id))
    .map((entry) => entry.id);
  runtimeState.conversationReplay.streamPauseActor = null;
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
        ? CONVERSATION_STREAM_ENTRY_SETTLE_MS
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
      runtimeState.ui.pendingConversationNpcId = npc.id;
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
  const selectedActiveConversation =
    selectedNpc && game.activeConversation?.npcId === selectedNpc.id
      ? game.activeConversation
      : undefined;
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
  const nextObjectiveStep =
    objectivePlanItems.find((item) => !item.done) ?? objectivePlanItems[0];
  const directionTitle = nextObjectiveStep?.title ?? currentObjectiveText;
  const directionSupport = buildNarrativePreview(
    nextObjectiveStep?.detail ?? activeCommitmentSummary ?? currentContext,
    120,
  );
  const railThought =
    currentThoughtPreview || directionSupport || currentObjectiveText;
  const rowanContext =
    currentSummaryPreview && currentSummaryPreview !== railThought
      ? currentSummaryPreview
      : directionSupport;
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
  const selectedConversationLines = selectedNpc
    ? getConversationPreview(game, selectedNpc.id)
    : [];
  const latestSelectedConversation = selectedConversationLines.at(-1);
  const selectedConversationTimestamp =
    selectedActiveConversation?.updatedAt ??
    selectedConversationThread?.updatedAt ??
    latestSelectedConversation?.time;
  const hasConversationFocus = Boolean(
    selectedNpc &&
    (selectedActiveConversation ||
      selectedConversationThread ||
      selectedConversationLines.length > 0 ||
      selectedTalkAction),
  );
  const nearbyNames = nearbyNpcs.slice(0, 3).map((npc) => npc.name);
  const conversationEntry = selectedNpc
    ? {
        id: `conversation-${selectedNpc.id}`,
        meta: selectedActiveConversation
          ? "Conversation in motion"
          : selectedConversationTimestamp
            ? `Conversation thread • ${formatClock(
                selectedConversationTimestamp,
              )}`
            : selectedTalkAction
              ? "Rowan can open here"
              : "Social read",
        text: buildNarrativePreview(
          joinNarrativeFragments([
            latestSelectedConversation
              ? `${latestSelectedConversation.speaker === "player" ? game.player.name : latestSelectedConversation.speakerName}: ${latestSelectedConversation.text}`
              : selectedTalkAction
                ? `${selectedNpc.name} is close enough to read. Let Rowan open and the exchange will start in his voice right here.`
                : `${selectedNpc.name} is part of the block, but Rowan does not have a live thread with them yet.`,
            selectedConversationThread?.decision ??
              selectedConversationThread?.objectiveText ??
              selectedConversationThread?.summary,
          ]),
          168,
        ),
        title: `With ${selectedNpc.name}`,
        tone: selectedActiveConversation
          ? "conversation"
          : latestSelectedConversation
            ? latestSelectedConversation.speaker === "player"
              ? "objective"
              : "conversation"
            : "scene",
        actionCopy:
          !latestSelectedConversation && selectedTalkAction
            ? `Start with ${selectedNpc.name} in Rowan's voice and let the thread unfold here.`
            : undefined,
        actionId:
          !latestSelectedConversation && selectedTalkAction
            ? selectedTalkAction.id
            : undefined,
        actionLabel:
          !latestSelectedConversation && selectedTalkAction
            ? `Rowan opens with ${selectedNpc.name}`
            : undefined,
      }
    : {
        id: "social-read",
        meta: "Social read",
        text:
          nearbyNames.length > 0
            ? `${formatNameList(nearbyNames)} ${
                nearbyNames.length === 1 ? "is" : "are"
              } close enough to read, but Rowan has not stepped into a real conversation yet.`
            : "No one nearby has opened into a real conversation yet.",
        title: "People on the edge of this beat",
        tone: "scene",
      };
  const showConversationRail = Boolean(
    selectedNpc &&
    (selectedConversationLines.length > 0 ||
      selectedTalkAction ||
      selectedConversationThread ||
      selectedActiveConversation),
  );
  const conversationRailHtml =
    selectedNpc && showConversationRail
      ? buildConversationPanelHtml({
          conversationDecision:
            selectedActiveConversation?.decision ??
            selectedConversationThread?.decision,
          conversationLines: selectedConversationLines,
          conversationLocationId:
            selectedActiveConversation?.locationId ??
            selectedConversationThread?.locationId,
          conversationObjectiveText:
            selectedActiveConversation?.objectiveText ??
            selectedConversationThread?.objectiveText,
          conversationSummary: selectedConversationThread?.summary,
          conversationUpdatedAt:
            selectedActiveConversation?.updatedAt ??
            selectedConversationThread?.updatedAt,
          currentObjectiveText,
          currentThought,
          isLiveConversation: Boolean(selectedActiveConversation),
          mode: "rail",
          npc: selectedNpc,
          replay: runtimeState.conversationReplay,
          snapshot,
          startAction: selectedTalkAction
            ? {
                id: selectedTalkAction.id,
                label: `Rowan opens with ${selectedNpc.name}`,
              }
            : undefined,
          talkableNpcIds,
        })
      : "";
  const availableActionsForRail =
    hasConversationFocus && selectedTalkAction
      ? actions.filter((action) => action.id !== selectedTalkAction.id)
      : actions;
  const quickActions = availableActionsForRail.slice(0, width <= 1080 ? 3 : 4);
  const primaryAction = showConversationRail ? null : (quickActions[0] ?? null);
  const secondaryActions = availableActionsForRail.slice(
    primaryAction ? 1 : 0,
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
    ...(rowanContext && rowanContext !== directionSupport
      ? [
          {
            id: "context",
            label: "Context",
            text: rowanContext,
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
  const hasRailMore =
    railContextEntries.length > 0 ||
    secondaryActions.length > 0 ||
    waitOptions.length > 0;
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
    waitOptions.length > 0 ? "time controls" : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const railStatusLabel = selectedActiveConversation
    ? "Live conversation"
    : showConversationRail && selectedNpc
      ? `With ${selectedNpc.name}`
      : game.currentScene.title;
  const railPeekLabel =
    showConversationRail && selectedNpc ? selectedNpc.name : directionTitle;
  const dockActiveTab = focusPanel ?? "actions";
  const clockLabel = formatClock(game.currentTime);
  const todoCounterLabel =
    game.player.objective?.progress?.label ??
    `${objectivePlanItems.length} live threads`;
  const compactRailCollapsedHeight = railViewport === "phone" ? 104 : 112;
  const compactRailExpandedHeight =
    railViewport === "phone"
      ? Math.max(340, Math.min(Math.round(height * 0.72), height - 156))
      : Math.max(380, Math.min(Math.round(height * 0.76), height - 148));
  const compactRailWidth =
    railViewport === "phone"
      ? Math.max(width - overlayInset * 2, 280)
      : Math.min(Math.max(width * 0.42, 320), 360);
  const compactRailBottomOffset = railViewport === "phone" ? 108 : 112;
  return `
    <style>
      .ml-root {
        width: ${width}px;
        height: ${height}px;
        position: relative;
        box-sizing: border-box;
        color: #edf2f5;
        font-family: "Avenir Next", "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
        pointer-events: none;
        overflow: hidden;
        --ml-inset: ${overlayInset}px;
        --ml-rail-width: ${Math.round(railWidth)}px;
        --ml-dock-width: ${Math.round(dockWidth)}px;
        --ml-dock-focus-width: ${Math.round(dockFocusWidth)}px;
        --ml-focus-width: ${Math.round(focusWidth)}px;
        --ml-focus-height: ${Math.round(focusHeight)}px;
        --ml-rail-max-height: ${Math.round(railMaxHeight)}px;
        --ml-compact-rail-bottom: ${Math.round(compactRailBottomOffset)}px;
        --ml-compact-rail-collapsed-height: ${Math.round(compactRailCollapsedHeight)}px;
        --ml-compact-rail-expanded-height: ${Math.round(compactRailExpandedHeight)}px;
        --ml-compact-rail-width: ${Math.round(compactRailWidth)}px;
      }
      .ml-right-stack,
      .ml-dock {
        position: absolute;
        bottom: var(--ml-inset);
        z-index: 2;
      }
      .ml-time-pill {
        position: absolute;
        top: var(--ml-inset);
        left: var(--ml-inset);
        z-index: 3;
        pointer-events: none;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.32);
        background: rgba(9, 14, 19, 0.9);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
        padding: 8px 10px;
        max-width: min(calc(100% - var(--ml-inset) * 2), 760px);
      }
      .ml-time-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(25, 34, 40, 0.74);
        padding: 6px 11px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(232, 238, 241, 0.84);
      }
      .ml-time-chip.is-core {
        border-color: rgba(205, 174, 115, 0.26);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
      }
      .ml-time-chip.is-core strong {
        font-size: 12px;
        letter-spacing: 0.18em;
        color: #f7e0b4;
      }
      .ml-time-chip.is-core em {
        font-style: normal;
        color: rgba(247, 227, 187, 0.74);
      }
      .ml-time-chip.is-metric {
        background: rgba(17, 24, 29, 0.82);
      }
      .ml-right-stack {
        right: var(--ml-inset);
        width: min(calc(100% - var(--ml-inset) * 2), var(--ml-rail-width));
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ml-dock {
        left: var(--ml-inset);
        width: min(calc(100% - var(--ml-inset) * 2), var(--ml-dock-width));
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-panel {
        pointer-events: auto;
        border: 1px solid rgba(138, 151, 161, 0.22);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(12, 19, 24, 0.96), rgba(8, 13, 18, 0.93));
        box-shadow: 0 22px 46px rgba(0, 0, 0, 0.28);
      }
      .ml-rail-shell {
        min-width: 0;
        max-height: var(--ml-rail-max-height);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ml-rail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
      }
      .ml-rail-head-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-rail-heading-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .ml-rail-name {
        font-size: 28px;
        line-height: 0.98;
        font-weight: 700;
        color: rgba(247, 249, 250, 0.98);
      }
      .ml-rail-status {
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.1);
        padding: 6px 9px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.94);
      }
      .ml-rail-peek-label {
        margin-top: 10px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.62);
      }
      .ml-rail-thought {
        margin-top: 7px;
        font-size: 18px;
        line-height: 1.5;
        color: rgba(239, 243, 245, 0.96);
      }
      .ml-rail-toggle {
        flex-shrink: 0;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(28, 38, 45, 0.82);
        color: rgba(232, 238, 241, 0.9);
        padding: 10px 12px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-command-rail {
        min-width: 0;
        min-height: 0;
        flex: 1;
        overflow-y: auto;
        padding: 0 14px 14px;
        border-top: 1px solid rgba(138, 151, 161, 0.12);
        scrollbar-width: thin;
      }
      .ml-command-rail-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-top: 14px;
      }
      .ml-command-rail,
      .ml-focus-body,
      .ml-chat-transcript,
      .ml-rail-feed {
        scroll-behavior: auto;
      }
      .ml-command-rail::-webkit-scrollbar,
      .ml-focus-body::-webkit-scrollbar {
        width: 8px;
      }
      .ml-command-rail::-webkit-scrollbar-thumb,
      .ml-focus-body::-webkit-scrollbar-thumb {
        background: rgba(138, 151, 161, 0.24);
        border-radius: 999px;
      }
      .ml-dock-panel {
        padding: 12px 14px;
      }
      .ml-dock-identity {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 10px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.2);
        background:
          radial-gradient(circle at top left, rgba(205, 174, 115, 0.16), transparent 48%),
          linear-gradient(180deg, rgba(26, 33, 38, 0.9), rgba(14, 19, 24, 0.94));
        padding: 10px 12px;
      }
      .ml-dock-identity-copy {
        min-width: 0;
      }
      .ml-dock-identity-kicker {
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(236, 222, 184, 0.7);
      }
      .ml-dock-identity-name {
        margin-top: 4px;
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        color: rgba(252, 246, 230, 0.98);
      }
      .ml-dock-identity-badge {
        flex-shrink: 0;
        border-radius: 999px;
        border: 1px solid rgba(141, 208, 205, 0.28);
        background: rgba(31, 52, 55, 0.6);
        padding: 8px 10px;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(214, 245, 243, 0.92);
      }
      .ml-kicker {
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.66);
      }
      .ml-rowan-directive {
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.18);
        background: rgba(36, 30, 24, 0.56);
        padding: 13px 14px;
      }
      .ml-rowan-directive-title {
        margin-top: 7px;
        font-size: 20px;
        line-height: 1.16;
        font-weight: 700;
        color: rgba(247, 249, 250, 0.96);
      }
      .ml-rowan-directive-copy {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.58;
        color: rgba(220, 229, 233, 0.8);
      }
      .ml-rail-more {
        border-top: 1px solid rgba(138, 151, 161, 0.12);
        padding-top: 14px;
      }
      .ml-rail-more-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(20, 29, 34, 0.76);
        padding: 12px 13px;
        color: rgba(239, 243, 245, 0.94);
        cursor: pointer;
        text-align: left;
      }
      .ml-rail-more-copy {
        min-width: 0;
      }
      .ml-rail-more-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
      }
      .ml-rail-more-state {
        flex-shrink: 0;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.9);
      }
      .ml-rail-more-body {
        display: none;
        margin-top: 12px;
        flex-direction: column;
        gap: 12px;
      }
      .ml-rail-more.is-open .ml-rail-more-body {
        display: flex;
      }
      .ml-rail-context-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ml-rail-context-row {
        border-radius: 16px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(21, 30, 35, 0.72);
        padding: 11px 12px;
      }
      .ml-rail-context-row[data-tone="objective"] {
        border-color: rgba(205, 174, 115, 0.18);
        background: rgba(39, 34, 27, 0.54);
      }
      .ml-rail-context-row[data-tone="conversation"] {
        border-color: rgba(89, 165, 132, 0.2);
        background: rgba(19, 35, 33, 0.72);
      }
      .ml-rail-context-row[data-tone="problem"] {
        border-color: rgba(167, 105, 99, 0.24);
        background: rgba(44, 28, 31, 0.72);
      }
      .ml-rail-context-label {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.74);
      }
      .ml-rail-context-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
        color: rgba(239, 243, 245, 0.94);
      }
      .ml-rail-context-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(219, 228, 233, 0.78);
      }
      .ml-title {
        margin-top: 8px;
        font-size: 36px;
        line-height: 0.96;
        font-weight: 700;
      }
      .ml-copy {
        margin-top: 10px;
        max-width: 36ch;
        font-size: 16px;
        line-height: 1.42;
        color: rgba(229, 236, 239, 0.92);
      }
      .ml-badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .ml-badge {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.2);
        background: rgba(36, 46, 54, 0.72);
        padding: 7px 11px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(231, 238, 241, 0.84);
      }
      .ml-badge.is-warm {
        border-color: rgba(205, 174, 115, 0.28);
        background: rgba(205, 174, 115, 0.1);
        color: rgba(241, 214, 160, 0.96);
      }
      .ml-badge.is-alert {
        border-color: rgba(167, 105, 99, 0.34);
        background: rgba(167, 105, 99, 0.12);
        color: rgba(246, 198, 193, 0.96);
      }
      .ml-player-meta {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(138, 151, 161, 0.14);
        font-size: 11px;
        line-height: 1.5;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(212, 221, 226, 0.64);
      }
      .ml-scene-card {
        border: 1px solid rgba(138, 151, 161, 0.18);
        border-radius: 22px;
        background: rgba(18, 28, 34, 0.72);
        padding: 14px;
      }
      .ml-scene-card + .ml-command-section {
        margin-top: 12px;
      }
      .ml-summary-card {
        padding: 16px;
        margin-bottom: 12px;
      }
      .ml-summary-title {
        margin-top: 8px;
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }
      .ml-summary-copy {
        margin-top: 10px;
        font-size: 15px;
        line-height: 1.42;
        color: rgba(229, 236, 239, 0.92);
      }
      .ml-rowan-log-card {
        margin-bottom: 12px;
        border-radius: 24px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background:
          radial-gradient(circle at top left, rgba(205, 174, 115, 0.14), transparent 34%),
          linear-gradient(180deg, rgba(18, 28, 34, 0.82), rgba(12, 19, 24, 0.94));
        padding: 16px;
      }
      .ml-rowan-log-title {
        margin-top: 8px;
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }
      .ml-rowan-log-voice {
        margin-top: 10px;
        max-width: 18ch;
        font-size: 18px;
        line-height: 1.48;
        color: rgba(239, 243, 245, 0.96);
      }
      .ml-rowan-log-context {
        margin-top: 10px;
        max-width: 34ch;
        font-size: 13px;
        line-height: 1.58;
        color: rgba(216, 225, 229, 0.78);
      }
      .ml-rowan-flow {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-rowan-entry {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 10px;
      }
      .ml-rowan-entry-rail {
        position: relative;
        display: flex;
        justify-content: center;
      }
      .ml-rowan-entry-rail::before {
        content: "";
        position: absolute;
        top: 6px;
        bottom: -16px;
        width: 1px;
        background: rgba(138, 151, 161, 0.18);
      }
      .ml-rowan-entry:last-child .ml-rowan-entry-rail::before {
        display: none;
      }
      .ml-rowan-entry-dot {
        position: relative;
        z-index: 1;
        margin-top: 7px;
        height: 8px;
        width: 8px;
        border-radius: 999px;
        background: rgba(240, 207, 140, 0.94);
        box-shadow: 0 0 0 6px rgba(205, 174, 115, 0.08);
      }
      .ml-rowan-entry-body {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(24, 32, 38, 0.76);
        padding: 11px 12px;
      }
      .ml-rowan-entry-meta {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-rowan-entry-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
        color: rgba(239, 243, 245, 0.95);
      }
      .ml-rowan-entry-copy {
        margin-top: 5px;
        font-size: 12px;
        line-height: 1.56;
        color: rgba(219, 228, 233, 0.78);
      }
      .ml-rowan-entry[data-tone="scene"] .ml-rowan-entry-dot,
      .ml-rowan-entry[data-tone="info"] .ml-rowan-entry-dot {
        background: rgba(148, 189, 212, 0.9);
        box-shadow: 0 0 0 6px rgba(69, 133, 214, 0.08);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-dot {
        background: rgba(137, 205, 175, 0.92);
        box-shadow: 0 0 0 6px rgba(89, 165, 132, 0.1);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-dot {
        background: rgba(232, 154, 145, 0.92);
        box-shadow: 0 0 0 6px rgba(167, 105, 99, 0.1);
      }
      .ml-rowan-entry[data-tone="memory"] .ml-rowan-entry-dot {
        background: rgba(210, 181, 235, 0.88);
        box-shadow: 0 0 0 6px rgba(168, 126, 205, 0.1);
      }
      .ml-rowan-entry[data-tone="objective"] .ml-rowan-entry-body,
      .ml-rowan-entry[data-tone="job"] .ml-rowan-entry-body {
        border-color: rgba(205, 174, 115, 0.2);
        background: rgba(39, 34, 27, 0.58);
      }
      .ml-rowan-entry[data-tone="scene"] .ml-rowan-entry-meta,
      .ml-rowan-entry[data-tone="info"] .ml-rowan-entry-meta {
        color: rgba(176, 206, 220, 0.74);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-body {
        border-color: rgba(89, 165, 132, 0.2);
        background: rgba(19, 35, 33, 0.76);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-meta {
        color: rgba(177, 226, 204, 0.74);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-body {
        border-color: rgba(167, 105, 99, 0.24);
        background: rgba(44, 28, 31, 0.76);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-meta {
        color: rgba(239, 182, 176, 0.78);
      }
      .ml-rowan-entry[data-tone="memory"] .ml-rowan-entry-meta {
        color: rgba(219, 200, 238, 0.74);
      }
      .ml-summary-support {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(216, 225, 229, 0.72);
      }
      .ml-scene-title {
        margin-top: 8px;
        font-size: 20px;
        font-weight: 700;
      }
      .ml-scene-description {
        margin-top: 8px;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(216, 225, 229, 0.82);
      }
      .ml-note {
        margin-top: 10px;
        border-radius: 16px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.5;
        background: rgba(22, 31, 37, 0.84);
        border: 1px solid rgba(138, 151, 161, 0.16);
      }
      .ml-note[data-tone="lead"] {
        background: rgba(183, 146, 89, 0.1);
        border-color: rgba(183, 146, 89, 0.28);
      }
      .ml-note[data-tone="warning"] {
        background: rgba(167, 105, 99, 0.12);
        border-color: rgba(167, 105, 99, 0.28);
      }
      .ml-objective-card {
        margin-top: 14px;
      }
      .ml-dock-row,
      .ml-tab-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .ml-dock-row {
        margin-top: 10px;
      }
      .ml-tab,
      .ml-dock-button,
      .ml-focus-tab {
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.68);
        color: rgba(224, 232, 236, 0.88);
        padding: 8px 9px;
        border-radius: 999px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        text-align: center;
      }
      .ml-tab.is-active,
      .ml-dock-button.is-active,
      .ml-focus-tab.is-active {
        border-color: rgba(205, 174, 115, 0.28);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(241, 214, 160, 0.96);
      }
      .ml-tab:focus-visible,
      .ml-dock-button:focus-visible,
      .ml-focus-tab:focus-visible,
      .ml-button:focus-visible,
      .ml-person:focus-visible,
      .ml-chip:focus-visible,
      .ml-control:focus-visible,
      .ml-rail-more-toggle:focus-visible,
      .ml-rail-toggle:focus-visible,
      .ml-submit:focus-visible,
      .ml-focus-close:focus-visible,
      .ml-loading-button:focus-visible {
        outline: 2px solid rgba(241, 214, 160, 0.92);
        outline-offset: 2px;
      }
      .ml-input:focus-visible {
        outline: 2px solid rgba(241, 214, 160, 0.76);
        outline-offset: 2px;
      }
      .ml-button {
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.84);
        padding: 12px 14px;
        text-align: left;
        color: #f0f4f6;
        cursor: pointer;
      }
      .ml-button[data-tone="high"] {
        border-color: rgba(183, 146, 89, 0.36);
        background: rgba(183, 146, 89, 0.1);
      }
      .ml-button[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-button-title {
        font-size: 14px;
        font-weight: 700;
      }
      .ml-button-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(219, 228, 233, 0.76);
      }
      .ml-people-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ml-person {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.82);
        padding: 12px;
        cursor: pointer;
        text-align: left;
        color: #eef3f5;
      }
      .ml-person.is-active {
        border-color: rgba(205, 174, 115, 0.32);
        background: rgba(183, 146, 89, 0.1);
      }
      .ml-person.has-live-thread {
        border-color: rgba(242, 201, 124, 0.3);
        box-shadow: inset 0 0 0 1px rgba(242, 201, 124, 0.08);
      }
      .ml-person-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ml-person-name {
        font-size: 13px;
        font-weight: 700;
      }
      .ml-person-live-tag {
        border-radius: 999px;
        border: 1px solid rgba(242, 201, 124, 0.22);
        background: rgba(242, 201, 124, 0.08);
        color: rgba(248, 223, 169, 0.96);
        padding: 4px 7px;
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .ml-person-meta {
        margin-top: 6px;
        font-size: 11px;
        line-height: 1.4;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(215, 224, 228, 0.66);
      }
      .ml-card {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(17, 25, 31, 0.84);
        padding: 12px;
      }
      .ml-focus-body .ml-card {
        background: rgba(12, 19, 24, 0.8);
      }
      .ml-card-title {
        font-size: 17px;
        font-weight: 700;
      }
      .ml-mini-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ml-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ml-row {
        border-radius: 14px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(26, 34, 39, 0.82);
        padding: 9px 10px;
      }
      .ml-row-title {
        font-size: 12px;
        font-weight: 700;
      }
      .ml-row-copy {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.4;
        color: rgba(219, 228, 233, 0.76);
      }
      .ml-row-meta {
        margin-top: 6px;
        font-size: 10px;
        line-height: 1.45;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(215, 224, 228, 0.62);
      }
      .ml-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .ml-chip {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.72);
        color: rgba(232, 238, 241, 0.9);
        padding: 8px 10px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-chip[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-form {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }
      .ml-input {
        min-width: 0;
        flex: 1;
        border-radius: 12px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(10, 16, 20, 0.86);
        color: #f3f7f8;
        padding: 10px 11px;
        font-size: 12px;
      }
      .ml-submit {
        border-radius: 12px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
        padding: 10px 12px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-chat-shell {
        margin-top: 12px;
        border-radius: 22px;
        border: 1px solid rgba(205, 174, 115, 0.18);
        background: linear-gradient(180deg, rgba(16, 24, 29, 0.96), rgba(10, 15, 19, 0.98));
        padding: 12px;
      }
      .ml-chat-shell.is-rail {
        margin-top: 0;
        border-radius: 0;
        border-width: 1px 0 0;
        border-color: rgba(138, 151, 161, 0.12);
        background: none;
        padding: 16px 0 0;
      }
      .ml-chat-shell.is-live {
        border-color: rgba(241, 214, 160, 0.34);
        background: linear-gradient(180deg, rgba(17, 26, 32, 0.98), rgba(9, 15, 19, 1));
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(241, 214, 160, 0.08);
      }
      .ml-chat-shell.is-rail.is-live {
        box-shadow: none;
      }
      .ml-chat-header {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .ml-chat-avatar {
        display: flex;
        height: 36px;
        width: 36px;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.2);
        background: rgba(46, 56, 63, 0.88);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .ml-chat-head-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-chat-title {
        font-size: 17px;
        font-weight: 700;
      }
      .ml-chat-subtitle {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.4;
        color: rgba(215, 224, 228, 0.66);
      }
      .ml-chat-context {
        margin-top: 6px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-live-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.22);
        background: rgba(205, 174, 115, 0.08);
        padding: 6px 9px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.94);
      }
      .ml-live-pill-dot {
        height: 7px;
        width: 7px;
        border-radius: 999px;
        background: rgba(241, 214, 160, 0.96);
        animation: mlPulse 1.15s ease-in-out infinite;
      }
      .ml-chat-sim-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .ml-chat-sim-card {
        border-radius: 16px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(22, 31, 37, 0.78);
        padding: 10px 11px;
      }
      .ml-chat-sim-card.is-rowan {
        border-color: rgba(69, 133, 214, 0.22);
        background: rgba(32, 54, 83, 0.42);
      }
      .ml-chat-sim-label {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-chat-sim-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(229, 236, 239, 0.9);
      }
      .ml-chat-transcript {
        max-height: 420px;
        min-height: 260px;
        margin-top: 12px;
        overflow-y: auto;
        padding-right: 4px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-chat-shell.is-live .ml-chat-transcript {
        max-height: 520px;
        min-height: 340px;
      }
      .ml-chat-shell.is-rail .ml-chat-transcript {
        max-height: none;
        min-height: 0;
        overflow: visible;
        padding-right: 0;
        gap: 12px;
      }
      .ml-chat-shell.is-rail.is-live .ml-chat-transcript {
        max-height: none;
        min-height: 0;
      }
      .ml-chat-row {
        display: flex;
      }
      .ml-chat-row.is-player {
        justify-content: flex-end;
      }
      .ml-chat-stack {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        max-width: 88%;
      }
      .ml-chat-stack.is-player {
        flex-direction: row-reverse;
      }
      .ml-chat-bubble-wrap {
        min-width: 0;
      }
      .ml-chat-bubble {
        border-radius: 22px;
        border-bottom-left-radius: 8px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(48, 58, 65, 0.92);
        padding: 11px 14px;
        font-size: 14px;
        line-height: 1.55;
        color: #edf3f6;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
      }
      .ml-chat-bubble.is-player {
        border-color: rgba(69, 133, 214, 0.26);
        border-bottom-left-radius: 22px;
        border-bottom-right-radius: 8px;
        background: linear-gradient(180deg, #2f95ff 0%, #0a84ff 100%);
        color: #ffffff;
      }
      .ml-chat-meta {
        margin-top: 4px;
        padding: 0 4px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(215, 224, 228, 0.58);
      }
      .ml-chat-meta.is-player {
        text-align: right;
      }
      .ml-chat-typing {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .ml-chat-dot {
        height: 8px;
        width: 8px;
        border-radius: 999px;
        background: rgba(237, 228, 212, 0.94);
        animation: mlDotPulse 0.96s ease-in-out infinite;
      }
      .ml-chat-dot:nth-child(2) {
        animation-delay: 0.12s;
      }
      .ml-chat-dot:nth-child(3) {
        animation-delay: 0.24s;
      }
      .ml-chat-caret {
        display: inline-block;
        height: 1.05em;
        width: 0.5ch;
        margin-left: 4px;
        border-radius: 999px;
        background: rgba(237, 228, 212, 0.78);
        vertical-align: -0.1em;
        animation: mlPulse 1s ease-in-out infinite;
      }
      .ml-chat-empty {
        border-radius: 18px;
        border: 1px dashed rgba(117, 128, 137, 0.22);
        padding: 14px;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(219, 228, 233, 0.72);
      }
      .ml-chat-outcome {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.22);
        background: rgba(205, 174, 115, 0.08);
        padding: 12px 14px;
      }
      .ml-chat-summary {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(27, 36, 42, 0.76);
        padding: 12px 14px;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(224, 232, 236, 0.78);
      }
      .ml-chat-outcome-title {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(228, 191, 123, 0.92);
      }
      .ml-chat-outcome-copy {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.55;
      }
      .ml-chat-rail-note {
        margin-top: 10px;
        border-left: 2px solid rgba(205, 174, 115, 0.28);
        padding-left: 10px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(226, 233, 236, 0.8);
      }
      .ml-chat-shell.is-rail .ml-chat-empty {
        background: rgba(20, 29, 34, 0.72);
      }
      .ml-chat-shell.is-rail .ml-form {
        position: sticky;
        bottom: 0;
        z-index: 1;
        padding-top: 10px;
        background: linear-gradient(
          180deg,
          rgba(9, 14, 18, 0),
          rgba(9, 14, 18, 0.82) 24%,
          rgba(9, 14, 18, 0.98)
        );
      }
      @keyframes mlPulse {
        0%, 100% {
          opacity: 0.45;
          transform: scale(0.92);
        }
        50% {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes mlDotPulse {
        0%, 100% {
          opacity: 0.42;
          transform: translateY(0);
        }
        50% {
          opacity: 1;
          transform: translateY(-1px);
        }
      }
      .ml-command-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ml-control {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.72);
        color: rgba(232, 238, 241, 0.9);
        padding: 9px 11px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-control[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-footer-copy {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.5;
        color: rgba(216, 225, 229, 0.78);
      }
      .ml-error {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(167, 105, 99, 0.28);
        background: rgba(167, 105, 99, 0.12);
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.5;
        color: rgba(247, 213, 210, 0.96);
      }
      .ml-dock-copy {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.45;
        color: rgba(216, 225, 229, 0.74);
        text-align: center;
      }
      .ml-rail-feed {
        max-height: 156px;
        overflow-y: auto;
        padding-right: 2px;
      }
      .ml-inline-focus-window {
        width: min(var(--ml-dock-focus-width), calc(100vw - var(--ml-inset) * 2));
        min-width: min(540px, var(--ml-dock-focus-width));
        align-self: flex-start;
        max-height: min(var(--ml-focus-height), var(--ml-rail-max-height));
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ml-focus-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        padding: 20px 20px 15px;
        border-bottom: 1px solid rgba(138, 151, 161, 0.14);
        background: linear-gradient(180deg, rgba(22, 31, 37, 0.8), rgba(12, 19, 24, 0.56));
      }
      .ml-focus-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-focus-title {
        margin-top: 8px;
        font-size: 30px;
        line-height: 1.02;
        font-weight: 700;
      }
      .ml-focus-copy .ml-footer-copy {
        margin-top: 10px;
        max-width: 60ch;
        line-height: 1.55;
      }
      .ml-focus-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ml-focus-nav {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .ml-focus-close {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.84);
        color: rgba(232, 238, 241, 0.9);
        padding: 9px 12px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-focus-body {
        overflow-y: auto;
        padding: 18px 20px 20px;
      }
      .ml-focus-body .ml-card {
        padding: 14px;
      }
      .ml-focus-body .ml-row {
        padding: 11px 12px;
      }
      .ml-focus-body .ml-row-title {
        font-size: 13px;
      }
      .ml-focus-body .ml-row-copy {
        margin-top: 5px;
        font-size: 12px;
        line-height: 1.55;
      }
      .ml-focus-body .ml-list {
        gap: 10px;
      }
      .ml-focus-body .ml-mini-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
      }
      .ml-focus-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      .ml-focus-grid.is-live-conversation {
        grid-template-columns: minmax(260px, 0.76fr) minmax(0, 1.24fr);
      }
      .ml-focus-stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      @media (max-width: 1120px) {
        .ml-root {
          --ml-inset: 16px;
        }
        .ml-focus-grid {
          grid-template-columns: 1fr;
        }
        .ml-focus-grid.is-live-conversation {
          grid-template-columns: 1fr;
        }
        .ml-focus-header {
          flex-direction: column;
          align-items: stretch;
        }
        .ml-focus-controls {
          justify-content: space-between;
          align-items: center;
        }
        .ml-inline-focus-window {
          min-width: min(480px, var(--ml-dock-focus-width));
        }
      }
      @media (max-width: 960px) {
        .ml-root {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .ml-time-pill {
          position: static;
          align-self: flex-start;
          transform: none;
        }
        .ml-right-stack,
        .ml-dock {
          position: static;
          width: 100%;
          transform: none;
        }
        .ml-title {
          font-size: 24px;
        }
        .ml-copy {
          font-size: 14px;
        }
        .ml-command-rail,
        .ml-focus-body {
          max-height: min(52vh, var(--ml-rail-max-height));
          overflow-y: auto;
        }
        .ml-dock-row,
        .ml-tab-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ml-mini-grid {
          grid-template-columns: 1fr;
        }
        .ml-people-grid {
          grid-template-columns: 1fr;
        }
        .ml-form {
          flex-direction: column;
        }
        .ml-chip-row,
        .ml-controls {
          gap: 6px;
        }
        .ml-inline-focus-window {
          min-width: 0;
          width: 100%;
          max-height: min(60vh, var(--ml-rail-max-height));
        }
      }
      @media (max-width: 560px) {
        .ml-root {
          padding: 0;
          display: block;
          overflow: hidden;
        }
        .ml-time-pill {
          position: absolute;
          top: max(var(--ml-inset), env(safe-area-inset-top));
          left: var(--ml-inset);
          z-index: 4;
          max-width: 100%;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 22px;
        }
        .ml-right-stack,
        .ml-dock {
          position: absolute;
          transform: none;
          width: auto;
          z-index: 3;
        }
        .ml-right-stack {
          right: var(--ml-inset);
          top: auto;
          bottom: calc(max(var(--ml-inset), env(safe-area-inset-bottom)) + 108px);
          width: min(48vw, 280px);
          max-width: calc(100% - var(--ml-inset) * 2);
          max-height: min(30vh, var(--ml-rail-max-height));
        }
        .ml-dock {
          left: var(--ml-inset);
          right: var(--ml-inset);
          bottom: max(var(--ml-inset), env(safe-area-inset-bottom));
        }
        .ml-time-chip {
          font-size: 9px;
          letter-spacing: 0.1em;
          padding: 5px 8px;
        }
        .ml-dock-panel {
          padding: 10px;
        }
        .ml-dock-copy {
          margin-top: 7px;
          text-align: left;
          font-size: 10px;
          line-height: 1.4;
        }
        .ml-inline-focus-window {
          width: 100%;
          max-height: min(52vh, var(--ml-rail-max-height));
        }
        .ml-focus-header {
          padding: 12px 12px 10px;
          gap: 10px;
        }
        .ml-focus-title {
          font-size: 24px;
          line-height: 1.06;
        }
        .ml-focus-copy .ml-footer-copy {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.45;
        }
        .ml-focus-controls {
          gap: 8px;
        }
        .ml-focus-nav {
          width: 100%;
          justify-content: flex-start;
        }
        .ml-focus-tab {
          flex: 1 1 calc(33.333% - 6px);
        }
        .ml-focus-body {
          padding: 12px;
        }
        .ml-focus-grid {
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .ml-focus-stack {
          gap: 10px;
        }
        .ml-right-stack {
          gap: 10px;
        }
        .ml-command-rail {
          max-height: 100%;
          padding: 8px;
        }
        .ml-command-rail > .ml-scene-card:not(.ml-summary-card) {
          display: none;
        }
        .ml-command-rail > .ml-summary-card {
          display: none;
        }
        .ml-command-rail > .ml-command-section:not(:first-of-type) {
          display: none;
        }
        .ml-scene-card {
          padding: 10px;
        }
        .ml-summary-card {
          padding: 12px;
          margin-bottom: 10px;
        }
        .ml-summary-title {
          font-size: 22px;
        }
        .ml-summary-copy {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-summary-support {
          display: none;
        }
        .ml-rowan-log-card {
          margin-bottom: 10px;
          padding: 12px;
        }
        .ml-rowan-log-title {
          font-size: 22px;
        }
        .ml-rowan-log-voice {
          margin-top: 8px;
          max-width: none;
          font-size: 14px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-rowan-log-context {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-rowan-flow {
          margin-top: 10px;
          gap: 8px;
        }
        .ml-rowan-entry:nth-of-type(n + 5) {
          display: none;
        }
        .ml-rowan-entry-body {
          padding: 10px;
        }
        .ml-rowan-entry-title {
          font-size: 13px;
        }
        .ml-rowan-entry-copy {
          font-size: 11px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-player-meta {
          display: none;
        }
        .ml-objective-card {
          margin-top: 9px;
        }
        .ml-objective-card .ml-row-copy {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-objective-card .ml-row-meta {
          display: none;
        }
        .ml-scene-title {
          font-size: 16px;
        }
        .ml-scene-description {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-command-section {
          gap: 8px;
        }
        .ml-button {
          padding: 10px 11px;
        }
        .ml-button-copy {
          display: none;
        }
      }
      @media (min-width: 481px) and (max-width: 760px) {
        .ml-right-stack {
          display: none;
        }
        .ml-dock {
          z-index: 4;
        }
      }
      @media (max-width: 430px) {
        .ml-right-stack {
          width: min(52vw, 250px);
        }
        .ml-time-pill {
          max-width: calc(100% - var(--ml-inset) * 2);
        }
        .ml-time-chip.is-core strong {
          font-size: 11px;
          letter-spacing: 0.14em;
        }
      }
      .ml-root.is-collapsible-rail {
        padding: 0;
        display: block;
        overflow: hidden;
      }
      .ml-root.is-collapsible-rail .ml-time-pill {
        position: absolute;
        top: max(var(--ml-inset), env(safe-area-inset-top));
        left: var(--ml-inset);
        z-index: 4;
        max-width: calc(100% - var(--ml-inset) * 2);
      }
      .ml-root.is-collapsible-rail .ml-dock {
        position: absolute;
        left: var(--ml-inset);
        right: var(--ml-inset);
        bottom: max(var(--ml-inset), env(safe-area-inset-bottom));
        width: auto;
        z-index: 4;
      }
      .ml-root.is-collapsible-rail .ml-right-stack {
        position: absolute;
        right: var(--ml-inset);
        bottom: calc(
          max(var(--ml-inset), env(safe-area-inset-bottom)) +
            var(--ml-compact-rail-bottom)
        );
        width: min(var(--ml-compact-rail-width), calc(100% - var(--ml-inset) * 2));
        max-width: calc(100% - var(--ml-inset) * 2);
        display: flex;
        z-index: 4;
      }
      .ml-root.is-collapsible-rail.is-phone-rail .ml-right-stack {
        left: var(--ml-inset);
        right: var(--ml-inset);
        width: auto;
      }
      .ml-root.is-collapsible-rail .ml-rail-shell {
        width: 100%;
        max-height: var(--ml-compact-rail-expanded-height);
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-rail-shell {
        max-height: var(--ml-compact-rail-collapsed-height);
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-command-rail {
        flex: 0 0 0;
        max-height: 0;
        overflow: hidden;
        padding-top: 0;
        padding-bottom: 0;
        border-top-color: transparent;
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-rail-thought {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ml-root.is-collapsible-rail .ml-rail-toggle {
        align-self: flex-start;
      }
      .ml-root.is-collapsible-rail .ml-rail-name {
        font-size: 24px;
      }
      .ml-root.is-collapsible-rail .ml-rail-thought {
        font-size: 16px;
      }
      .ml-root.is-collapsible-rail .ml-rowan-directive-title {
        font-size: 18px;
      }
      .ml-root.is-collapsible-rail .ml-chat-bubble {
        font-size: 13px;
      }
      @media (max-height: 820px) and (min-width: 1081px) {
        .ml-player-panel,
        .ml-command-rail,
        .ml-dock-panel,
        .ml-inline-focus-window {
          border-radius: 20px;
        }
        .ml-title {
          font-size: 30px;
        }
      }
    </style>
    <div
      class="ml-root ${railViewport !== "desktop" ? "is-collapsible-rail" : ""} ${
        railViewport === "phone" ? "is-phone-rail" : ""
      } ${railExpanded ? "is-rail-expanded" : "is-rail-collapsed"}"
    >
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
          <div class="ml-kicker">Field Kit</div>
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
              "Keep Rowan in motion on the map, then open locals, journal, or memory in the right rail when you want a proper read.",
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
          <div class="ml-command-rail" data-preserve-scroll="command-rail">
            <div class="ml-command-rail-body">
              <div class="ml-rowan-directive">
                <div class="ml-kicker">Next move</div>
                <div class="ml-rowan-directive-title">${escapeHtml(
                  directionTitle,
                )}</div>
                <div class="ml-rowan-directive-copy">${escapeHtml(
                  directionSupport || currentObjectiveText,
                )}</div>
              </div>

              ${
                primaryAction
                  ? `
                  <button
                    class="ml-button"
                    data-action-id="${escapeHtml(primaryAction.id)}"
                    data-action-label="${escapeHtml(primaryAction.label)}"
                    data-tone="${escapeHtml(primaryAction.emphasis)}"
                    ${snapshot.busyLabel || primaryAction.disabled ? "disabled" : ""}
                    type="button"
                  >
                    <div class="ml-button-title">${escapeHtml(
                      primaryAction.label,
                    )}</div>
                    <div class="ml-button-copy">${escapeHtml(
                      primaryAction.description,
                    )}</div>
                    ${
                      primaryAction.disabledReason
                        ? `<div class="ml-button-copy" style="color: rgba(246, 198, 193, 0.92);">${escapeHtml(
                            primaryAction.disabledReason,
                          )}</div>`
                        : ""
                    }
                  </button>
                `
                  : ""
              }

              ${conversationRailHtml}

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
                                  ${snapshot.busyLabel || action.disabled ? "disabled" : ""}
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
                                ${snapshot.busyLabel ? "disabled" : ""}
                                type="button"
                              >
                                ${escapeHtml(option.label)}
                              </button>
                            `,
                            )
                            .join("")}
                          <button
                            class="ml-control"
                            data-advance-objective="true"
                            ${snapshot.busyLabel ? "disabled" : ""}
                            type="button"
                          >
                            Pursue Objective
                          </button>
                        </div>
                        <div class="ml-footer-copy">${escapeHtml(
                          upcomingCommitmentLabel ??
                            "Advance the hour when Rowan is waiting on the next useful beat, or click the street and let him move.",
                        )}</div>
                      </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildLoadingHtml(
  snapshot: StreetAppSnapshot,
  width: number,
  height: number,
) {
  return `
    <style>
      .ml-loading-root {
        width: ${width}px;
        height: ${height}px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        pointer-events: none;
        font-family: "Avenir Next", "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
      }
      .ml-loading-card {
        width: min(680px, 100%);
        border-radius: 32px;
        border: 1px solid rgba(138, 151, 161, 0.22);
        background: linear-gradient(180deg, rgba(18, 26, 31, 0.94), rgba(12, 18, 23, 0.9));
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
        padding: 28px;
        pointer-events: auto;
        color: #edf2f5;
      }
      .ml-loading-kicker {
        font-size: 11px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.66);
      }
      .ml-loading-title {
        margin-top: 14px;
        font-size: 34px;
        line-height: 0.98;
        font-weight: 700;
      }
      .ml-loading-copy {
        margin-top: 12px;
        font-size: 16px;
        line-height: 1.7;
        color: rgba(219, 228, 233, 0.82);
      }
      .ml-loading-status {
        margin-top: 20px;
        border-radius: 22px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.08);
        padding: 16px 18px;
        font-size: 14px;
        line-height: 1.6;
      }
      .ml-loading-error {
        border-color: rgba(167, 105, 99, 0.28);
        background: rgba(167, 105, 99, 0.12);
      }
      .ml-loading-button {
        margin-top: 16px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
        padding: 10px 14px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        cursor: pointer;
      }
    </style>
    <div class="ml-loading-root">
      <div class="ml-loading-card">
        <div class="ml-loading-kicker">Brackenport • South Quay</div>
        <div class="ml-loading-title">Opening the district</div>
        <div class="ml-loading-copy">One person, one block, one day to start finding a place in the city.</div>
        <div class="ml-loading-status ${snapshot.error ? "ml-loading-error" : ""}">
          ${escapeHtml(snapshot.error ?? snapshot.loadingLabel)}
        </div>
        ${
          snapshot.error
            ? `<button class="ml-loading-button" data-reload="true" type="button">Try Again</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildTabButton(
  tab: UiState["activeTab"],
  active: boolean,
  className = "ml-tab",
) {
  return `
    <button
      class="${className} ${active ? "is-active" : ""}"
      data-tab="${tab}"
      aria-pressed="${active ? "true" : "false"}"
      type="button"
    >
      ${escapeHtml(tabLabel(tab))}
    </button>
  `;
}

function buildPeopleTabHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  currentObjectiveText: string;
  currentSummary: string;
  currentThought: string;
  npcs: NpcState[];
  selectedNpc: NpcState | null;
  snapshot: StreetAppSnapshot;
  talkableNpcIds: Set<string>;
  tools: StreetGameState["player"]["inventory"];
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    currentObjectiveText,
    currentSummary,
    currentThought,
    npcs,
    selectedNpc,
    snapshot,
    talkableNpcIds,
    tools,
  } = options;
  const selectedPersonality = selectedNpc
    ? npcPersonalityProfile(selectedNpc)
    : null;
  const liveConversationNpcId = snapshot.game?.activeConversation?.npcId;
  const liveConversationSelected =
    Boolean(selectedNpc) && liveConversationNpcId === selectedNpc?.id;

  return `
    <div class="ml-focus-grid ${liveConversationSelected ? "is-live-conversation" : ""}">
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Rowan Model</div>
          <div class="ml-row-title" style="margin-top: 8px;">${escapeHtml(
            currentThought,
          )}</div>
          <div class="ml-row-copy">${escapeHtml(currentSummary)}</div>
          <div class="ml-row-copy">${escapeHtml(currentObjectiveText)}</div>
          <div class="ml-row-meta">${escapeHtml(
            tools.length > 0
              ? `Tools on hand: ${tools.map((item) => item.name).join(", ")}`
              : "No tools yet. Rowan is still relying on time, talk, and a little cash.",
          )}</div>
        </div>
        <div class="ml-card">
          <div class="ml-kicker">Agents In Reach</div>
          <div class="ml-people-grid" style="margin-top: 12px;">
            ${npcs
              .map((npc) => {
                const personality = npcPersonalityProfile(npc);
                const hasLiveThread = liveConversationNpcId === npc.id;
                return `
                <button
                  class="ml-person ${selectedNpc?.id === npc.id ? "is-active" : ""} ${
                    hasLiveThread ? "has-live-thread" : ""
                  }"
                  data-select-npc="${escapeHtml(npc.id)}"
                  type="button"
                >
                  <div class="ml-person-heading">
                    <div class="ml-person-name">${escapeHtml(npc.name)}</div>
                    ${
                      hasLiveThread
                        ? '<div class="ml-person-live-tag">Live</div>'
                        : ""
                    }
                  </div>
                  <div class="ml-person-meta">${escapeHtml(
                    `${personality.badge} • ${npc.known ? "known" : "unfamiliar"}`,
                  )}</div>
                  <div class="ml-row-copy" style="margin-top: 8px;">${escapeHtml(
                    personality.listLine,
                  )}</div>
                </button>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
      <div class="ml-focus-stack">
        ${
          selectedNpc
            ? `
            <div class="ml-card">
              <div class="ml-kicker">${escapeHtml(
                liveConversationSelected ? "Agent In Motion" : "Agent Card",
              )}</div>
              <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
                selectedNpc.name,
              )}</div>
              <div class="ml-row-copy" style="margin-top: 6px;">${escapeHtml(
                `${selectedPersonality?.badge ?? selectedNpc.role} • mood: ${selectedNpc.mood} • trust ${selectedNpc.trust}`,
              )}</div>
              <div class="ml-row-copy" style="margin-top: 10px;">${escapeHtml(
                selectedPersonality?.signature ??
                  "They already feel like they belong to this block.",
              )}</div>
              <div class="ml-row-copy" style="margin-top: 10px;">${escapeHtml(
                selectedNpc.summary,
              )}</div>
              <div class="ml-mini-grid" style="margin-top: 12px;">
                <div class="ml-row">
                  <div class="ml-row-meta">Current Objective</div>
                  <div class="ml-row-copy">${escapeHtml(
                    selectedNpc.currentObjective ||
                      "Still finding the clearest thread to protect.",
                  )}</div>
                </div>
                <div class="ml-row">
                  <div class="ml-row-meta">Current Concern</div>
                  <div class="ml-row-copy">${escapeHtml(
                    selectedNpc.currentConcern ||
                      selectedNpc.currentThought ||
                      "Still reading Rowan before showing their full hand.",
                  )}</div>
                </div>
              </div>
              ${buildPeopleConversationStatusHtml({
                conversationDecision,
                conversationLines,
                conversationObjectiveText,
                conversationSummary,
                conversationUpdatedAt,
                isLiveConversation: liveConversationSelected,
                npc: selectedNpc,
                talkableNpcIds,
              })}
            </div>
          `
            : `
            <div class="ml-card">
              <div class="ml-kicker">Character Card</div>
              <div class="ml-row-copy" style="margin-top: 8px;">Pick someone from the block to pull their card into focus.</div>
            </div>
          `
        }
      </div>
    </div>
  `;
}

function buildPeopleConversationStatusHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  isLiveConversation: boolean;
  npc: NpcState;
  talkableNpcIds: Set<string>;
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    isLiveConversation,
    npc,
    talkableNpcIds,
  } = options;
  const threadRead =
    conversationDecision ||
    conversationObjectiveText ||
    conversationSummary ||
    (talkableNpcIds.has(npc.id)
      ? `Rowan can open with ${npc.name} from the main log whenever you're ready.`
      : `${npc.name} is not ready to talk right now.`);

  return `
    <div class="ml-card" style="margin-top: 12px;">
      <div class="ml-kicker">${
        isLiveConversation ? "Live In Rowan Log" : "Conversation Thread"
      }</div>
      <div class="ml-row-copy" style="margin-top: 8px;">${escapeHtml(
        isLiveConversation
          ? `The live exchange with ${npc.name} is unfolding in Rowan's log on the main rail.`
          : threadRead,
      )}</div>
      ${
        conversationLines.length > 0 && conversationUpdatedAt
          ? `<div class="ml-row-meta">${escapeHtml(
              `Last update • ${formatClock(conversationUpdatedAt)}`,
            )}</div>`
          : ""
      }
    </div>
  `;
}

function buildConversationPanelHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationLocationId?: string;
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  currentObjectiveText: string;
  currentThought: string;
  isLiveConversation: boolean;
  mode: "focus" | "rail";
  npc: NpcState;
  replay: ConversationReplayState;
  snapshot: StreetAppSnapshot;
  startAction?: {
    id: string;
    label: string;
  };
  talkableNpcIds: Set<string>;
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationLocationId,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    currentObjectiveText,
    currentThought,
    isLiveConversation,
    mode,
    npc,
    replay,
    snapshot,
    startAction,
    talkableNpcIds,
  } = options;
  const isRailMode = mode === "rail";
  const personality = npcPersonalityProfile(npc);
  const npcInitials = initialsForName(npc.name);
  const conversationLocation = conversationLocationId
    ? snapshot.game?.locations.find(
        (location) => location.id === conversationLocationId,
      )
    : undefined;
  const conversationTimestamp =
    conversationUpdatedAt ??
    conversationLines[conversationLines.length - 1]?.time;
  const conversationContext = [
    conversationLocation?.name,
    conversationTimestamp ? formatClock(conversationTimestamp) : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const revealedEntryIdSet = new Set(replay.revealedEntryIds);
  const visibleConversationEntries = (
    isRailMode ? conversationLines : conversationLines.slice(-6)
  ).filter(
    (entry) =>
      revealedEntryIdSet.has(entry.id) || entry.id === replay.streamingEntryId,
  );
  const effectiveTypingState = replay.streamPauseActor
    ? {
        actor: replay.streamPauseActor,
        label:
          replay.streamPauseActor === "npc"
            ? `${npc.name} is replying...`
            : "Rowan is replying...",
      }
    : null;
  const isTranscriptInMotion =
    Boolean(effectiveTypingState) ||
    Boolean(replay.streamingEntryId) ||
    replay.streamQueue.length > 0 ||
    replay.isReplaying;
  const journalNoteVisible =
    conversationObjectiveText &&
    conversationObjectiveText !== conversationDecision &&
    !isTranscriptInMotion;
  const threadShift =
    conversationDecision ||
    conversationObjectiveText ||
    conversationSummary ||
    "The exchange is still changing how both agents read the block.";
  const railThreadNote = buildNarrativePreview(
    joinNarrativeFragments([
      conversationDecision,
      journalNoteVisible ? conversationObjectiveText : null,
      !conversationDecision && !journalNoteVisible ? conversationSummary : null,
    ]),
    188,
  );
  const rowanThread =
    conversationObjectiveText || currentThought || currentObjectiveText;
  const npcThread =
    npc.currentConcern ||
    npc.currentObjective ||
    npc.currentThought ||
    "Still deciding how much Rowan should matter here.";
  const canSpeak = talkableNpcIds.has(npc.id) && conversationLines.length > 0;
  const canStartWithRowan =
    Boolean(startAction) &&
    talkableNpcIds.has(npc.id) &&
    conversationLines.length === 0;

  return `
    <div class="ml-chat-shell ${isLiveConversation ? "is-live" : ""} ${
      isRailMode ? "is-rail" : ""
    }">
      <div class="ml-chat-header">
        <div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>
        <div class="ml-chat-head-copy">
          <div class="ml-chat-title">${escapeHtml(npc.name)}</div>
          <div class="ml-chat-subtitle">${escapeHtml(
            `${personality.badge}. ${personality.chatSubtitle}`,
          )}</div>
          ${
            conversationContext
              ? `<div class="ml-chat-context">${escapeHtml(conversationContext)}</div>`
              : ""
          }
          ${
            isTranscriptInMotion
              ? `<div class="ml-live-pill"><span class="ml-live-pill-dot"></span>Live Conversation</div>`
              : ""
          }
        </div>
      </div>
      ${
        isRailMode
          ? `
          <div class="ml-chat-rail-note">${escapeHtml(
            conversationLines.length > 0
              ? railThreadNote || threadShift
              : `If Rowan starts with ${npc.name}, the exchange will unfold here in real time.`,
          )}</div>
        `
          : `
          <div class="ml-chat-sim-strip">
            <div class="ml-chat-sim-card is-rowan">
              <div class="ml-chat-sim-label">Rowan Is Testing</div>
              <div class="ml-chat-sim-copy">${escapeHtml(rowanThread)}</div>
            </div>
            <div class="ml-chat-sim-card">
              <div class="ml-chat-sim-label">${escapeHtml(npc.name)} Is Protecting</div>
              <div class="ml-chat-sim-copy">${escapeHtml(npcThread)}</div>
            </div>
            <div class="ml-chat-sim-card">
              <div class="ml-chat-sim-label">${
                isTranscriptInMotion
                  ? "Interpretation In Motion"
                  : "Thread Shift"
              }</div>
              <div class="ml-chat-sim-copy">${escapeHtml(threadShift)}</div>
            </div>
          </div>
        `
      }
      ${
        !isRailMode && conversationSummary && !isTranscriptInMotion
          ? `
          <div class="ml-chat-summary">${escapeHtml(conversationSummary)}</div>
        `
          : ""
      }
      ${
        !isRailMode && conversationDecision && !isTranscriptInMotion
          ? `
          <div class="ml-chat-outcome">
            <div class="ml-chat-outcome-title">Thread Shift</div>
            <div class="ml-chat-outcome-copy">${escapeHtml(conversationDecision)}</div>
          </div>
        `
          : ""
      }
      ${
        !isRailMode && journalNoteVisible
          ? `
          <div class="ml-chat-outcome">
            <div class="ml-chat-outcome-title">Objective Update</div>
            <div class="ml-chat-outcome-copy">${escapeHtml(conversationObjectiveText)}</div>
          </div>
        `
          : ""
      }
      ${
        !isRailMode || conversationLines.length > 0 || effectiveTypingState
          ? `
          <div class="ml-chat-transcript" ${
            isRailMode ? "" : 'data-chat-transcript="true"'
          }>
            ${
              conversationLines.length === 0
                ? `<div class="ml-chat-empty">${escapeHtml(
                    `${npc.name} is here, but Rowan has not stepped into the conversation yet.`,
                  )}</div>`
                : visibleConversationEntries
                    .map((entry) => {
                      const isPlayer = entry.speaker === "player";
                      const displayText =
                        entry.id === replay.streamingEntryId
                          ? revealConversationText(
                              entry.text,
                              replay.streamedWordCount,
                            )
                          : entry.text;

                      return `
                        <div class="ml-chat-row ${isPlayer ? "is-player" : ""}">
                          <div class="ml-chat-stack ${isPlayer ? "is-player" : ""}">
                            ${
                              isPlayer
                                ? ""
                                : `<div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>`
                            }
                            <div class="ml-chat-bubble-wrap">
                              <div class="ml-chat-bubble ${isPlayer ? "is-player" : ""}">
                                ${escapeHtml(displayText)}${
                                  entry.id === replay.streamingEntryId
                                    ? '<span class="ml-chat-caret"></span>'
                                    : ""
                                }
                              </div>
                              <div class="ml-chat-meta ${isPlayer ? "is-player" : ""}">${escapeHtml(
                                `${isPlayer ? "Rowan" : entry.speakerName} • ${formatClock(entry.time)}`,
                              )}</div>
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join("")
            }
            ${
              effectiveTypingState
                ? `
                <div class="ml-chat-row ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                  <div class="ml-chat-stack ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                    ${
                      effectiveTypingState.actor === "rowan"
                        ? ""
                        : `<div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>`
                    }
                    <div class="ml-chat-bubble-wrap">
                      <div class="ml-chat-bubble ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                        <div class="ml-chat-typing">
                          <span class="ml-chat-dot"></span>
                          <span class="ml-chat-dot"></span>
                          <span class="ml-chat-dot"></span>
                        </div>
                      </div>
                      <div class="ml-chat-meta ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">${escapeHtml(
                        effectiveTypingState.label,
                      )}</div>
                    </div>
                  </div>
                </div>
              `
                : ""
            }
          </div>
        `
          : ""
      }
      ${
        canStartWithRowan && startAction
          ? `
          <button
            class="ml-button"
            data-action-id="${escapeHtml(startAction.id)}"
            data-action-label="${escapeHtml(startAction.label)}"
            data-tone="high"
            ${snapshot.busyLabel ? "disabled" : ""}
            type="button"
          >
            <div class="ml-button-title">Let Rowan Open</div>
            <div class="ml-button-copy">${escapeHtml(
              `Start with ${npc.name} in Rowan's voice and let the conversation begin in the log.`,
            )}</div>
          </button>
        `
          : canSpeak
            ? `
            <form class="ml-form" data-speak-form="true" data-npc-id="${escapeHtml(
              npc.id,
            )}">
              <input
                class="ml-input"
                data-overlay-field-key="speak:${escapeHtml(npc.id)}"
                aria-label="Speak to ${escapeHtml(npc.name)}"
                ${snapshot.busyLabel ? "disabled" : ""}
                name="speech"
                placeholder="${escapeHtml(
                  isRailMode
                    ? `What should Rowan say to ${npc.name}?`
                    : `Say something to ${npc.name}`,
                )}"
                type="text"
              />
              <button class="ml-submit" ${snapshot.busyLabel ? "disabled" : ""} type="submit">
                ${isRailMode ? "Rowan Says" : "Speak"}
              </button>
            </form>
          `
            : talkableNpcIds.has(npc.id)
              ? ""
              : `
            <div class="ml-chat-rail-note">${escapeHtml(
              `${npc.name} is not ready to talk right now.`,
            )}</div>
          `
      }
    </div>
  `;
}

function buildJournalTabHtml(options: {
  busyLabel: string | null;
  currentObjectiveText: string;
  game: StreetGameState;
  objectiveCompleted: ObjectivePlanItem[];
  objectivePlanItems: ObjectivePlanItem[];
  objectiveSuggestions: string[];
  recentFeed: StreetGameState["feed"];
}) {
  const {
    busyLabel,
    currentObjectiveText,
    game,
    objectiveCompleted,
    objectivePlanItems,
    objectiveSuggestions,
    recentFeed,
  } = options;

  return `
    <div class="ml-focus-grid">
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Objective</div>
          <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
            currentObjectiveText,
          )}</div>
          <form class="ml-form" data-objective-form="true">
            <input
              class="ml-input"
              data-overlay-field-key="objective"
              aria-label="Refocus objective"
              ${busyLabel ? "disabled" : ""}
              name="objective"
              type="text"
              value="${escapeHtml(currentObjectiveText)}"
            />
            <button class="ml-submit" ${busyLabel ? "disabled" : ""} type="submit">Refocus</button>
          </form>
          ${
            objectiveSuggestions.length > 0
              ? `
              <div class="ml-chip-row">
                ${objectiveSuggestions
                  .map(
                    (suggestion) => `
                    <button
                      class="ml-chip"
                      data-objective-text="${escapeHtml(suggestion)}"
                      ${busyLabel ? "disabled" : ""}
                      type="button"
                    >
                      ${escapeHtml(suggestion)}
                    </button>
                  `,
                  )
                  .join("")}
              </div>
            `
              : ""
          }
        </div>
        <div class="ml-card">
          <div class="ml-kicker">Objective Trail</div>
          <div class="ml-list" style="margin-top: 12px;">
            ${
              objectivePlanItems.length > 0
                ? objectivePlanItems
                    .slice(0, 5)
                    .map(
                      (item) => `
                      <div class="ml-row">
                        <div class="ml-row-title">${escapeHtml(item.title)}</div>
                        <div class="ml-row-copy">${escapeHtml(item.detail)}</div>
                        ${
                          item.progress
                            ? `<div class="ml-row-meta">${escapeHtml(item.progress)}</div>`
                            : ""
                        }
                      </div>
                    `,
                    )
                    .join("")
                : `<div class="ml-row"><div class="ml-row-copy">No active objective checklist yet.</div></div>`
            }
          </div>
        </div>
      </div>
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Accomplishments And Feed</div>
          <div class="ml-list" style="margin-top: 12px;">
            ${objectiveCompleted
              .slice(0, 3)
              .map(
                (item) => `
                <div class="ml-row">
                  <div class="ml-row-title">${escapeHtml(item.title)}</div>
                  <div class="ml-row-copy">${escapeHtml(item.detail)}</div>
                  ${
                    item.progress
                      ? `<div class="ml-row-meta">${escapeHtml(item.progress)}</div>`
                      : ""
                  }
                </div>
              `,
              )
              .join("")}
            ${recentFeed
              .slice(0, 5)
              .map(
                (entry) => `
                <div class="ml-row">
                  <div class="ml-row-title">${escapeHtml(formatClock(entry.time))}</div>
                  <div class="ml-row-copy">${escapeHtml(entry.text)}</div>
                </div>
              `,
              )
              .join("")}
          </div>
          <div class="ml-row-copy" style="margin-top: 12px;">Known locations: ${escapeHtml(
            String(game.player.knownLocationIds.length),
          )} • known locals: ${escapeHtml(String(game.player.knownNpcIds.length))}</div>
        </div>
      </div>
    </div>
  `;
}

function buildMindTabHtml(options: {
  extraPeopleNames: string[];
  extraPlaceNames: string[];
  extraThreadTitles: string[];
  extraToolNames: string[];
  game: StreetGameState;
  memoryThreads: MemoryThread[];
  primaryPerson?: StreetGameState["npcs"][number];
  primaryPlace?: StreetGameState["locations"][number];
  primaryThread?: MemoryThread;
  primaryTool?: StreetGameState["player"]["inventory"][number];
}) {
  const {
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
  } = options;

  return `
    <div class="ml-focus-stack">
      <div class="ml-card">
        <div class="ml-kicker">Working Memory</div>
        <div class="ml-mini-grid" style="margin-top: 12px;">
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryPlace?.name ?? "Still getting bearings",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryPlace
                ? buildKnownPlaceDetail(primaryPlace)
                : "The district is still mostly unmapped in Rowan's head.",
            )}</div>
            ${
              formatMemoryMeta(
                extraPlaceNames,
                game.player.knownLocationIds.length,
              )
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraPlaceNames,
                      game.player.knownLocationIds.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryPerson?.name ?? "No one sticking yet",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryPerson
                ? buildKnownPersonDetail(primaryPerson)
                : "No one has become a stable part of Rowan's mental map yet.",
            )}</div>
            ${
              formatMemoryMeta(extraPeopleNames, game.player.knownNpcIds.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraPeopleNames,
                      game.player.knownNpcIds.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryThread?.title ?? "Nothing urgent yet",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryThread?.detail ??
                "No work or local trouble is really sticking yet.",
            )}</div>
            ${
              formatMemoryMeta(extraThreadTitles, memoryThreads.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(extraThreadTitles, memoryThreads.length) ??
                      "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryTool?.name ?? `$${game.player.money} on hand`,
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryTool?.description ??
                cashReadLabel(game.player.money, game.player.energy),
            )}</div>
            ${
              primaryTool &&
              formatMemoryMeta(extraToolNames, game.player.inventory.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraToolNames,
                      game.player.inventory.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
        </div>
      </div>
      <div class="ml-card">
        <div class="ml-kicker">Journal</div>
        <div class="ml-list" style="margin-top: 12px;">
          ${
            game.player.memories.length === 0
              ? `<div class="ml-row"><div class="ml-row-copy">Nothing has stuck yet. Rowan needs to walk, talk, or act before the journal starts filling in.</div></div>`
              : game.player.memories
                  .slice(0, 6)
                  .map(
                    (memory) => `
                    <div class="ml-row">
                      <div class="ml-row-title">${escapeHtml(formatClock(memory.time))}</div>
                      <div class="ml-row-copy">${escapeHtml(
                        toFirstPersonText(memory.text),
                      )}</div>
                    </div>
                  `,
                  )
                  .join("")
          }
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

function joinNarrativeFragments(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function formatNameList(names: string[]) {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0]!;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function feedToneLabel(tone: StreetGameState["feed"][number]["tone"]) {
  switch (tone) {
    case "job":
      return "Work";
    case "problem":
      return "Problem";
    case "memory":
      return "Memory";
    case "info":
    default:
      return "Activity";
  }
}

function buildObjectivePlanRows(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
) {
  if (game.player.objective?.trail?.length) {
    return game.player.objective.trail.map((item) => ({
      detail: item.detail ?? item.progress ?? "Active",
      done: Boolean(item.done),
      id: item.id,
      progress: item.progress,
      title: item.title,
    }));
  }

  return buildObjectivePlanItems(game, locationById);
}

function buildObjectiveCompletionRows(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
) {
  if (game.player.objective?.completedTrail?.length) {
    return game.player.objective.completedTrail.map((item) => ({
      detail: item.detail ?? item.progress ?? "Done",
      done: true,
      id: item.id,
      progress: item.progress,
      title: item.title,
    }));
  }

  return buildObjectiveCompletedItems(game, locationById);
}

function buildObjectiveSuggestions(game: StreetGameState) {
  const suggestions = new Set<string>();
  const activeJob = game.jobs.find(
    (job) => job.id === game.player.activeJobId && !job.completed,
  );
  const pumpProblem = game.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const cartProblem = game.problems.find(
    (problem) => problem.id === "problem-cart",
  );
  const hasWrench = game.player.inventory.some(
    (item) => item.id === "item-wrench",
  );
  const spokenNpcCount = new Set(
    game.conversations
      .filter((entry) => entry.speaker === "player")
      .map((entry) => entry.npcId),
  ).size;

  if (spokenNpcCount < game.npcs.length) {
    suggestions.add("Make the rounds and talk to everyone.");
  }

  if (activeJob) {
    suggestions.add(`Finish ${activeJob.title.toLowerCase()}.`);
  }

  if (
    pumpProblem?.discovered &&
    pumpProblem.status === "active" &&
    !hasWrench
  ) {
    suggestions.add("Buy a wrench and fix the pump.");
  } else if (pumpProblem?.discovered && pumpProblem.status === "active") {
    suggestions.add("Fix the pump in Morrow Yard.");
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    suggestions.add("Clear the jammed cart in the square.");
  }

  if (game.player.money < 18) {
    suggestions.add("Find steady income before tonight.");
  }

  if ((game.player.reputation.morrow_house ?? 0) < 2) {
    suggestions.add("Figure out where I can stay beyond tonight.");
  }

  if (game.player.knownLocationIds.length < 4) {
    suggestions.add("Learn the lanes and meet people.");
  }

  if (game.player.knownNpcIds.length < 3) {
    suggestions.add("Meet people who could become friends in South Quay.");
  }

  if (game.player.energy < 38) {
    suggestions.add("Get somewhere quiet and recover.");
  }

  suggestions.add("Get settled in Brackenport.");

  return Array.from(suggestions).slice(0, 5);
}

function buildMemoryThreads(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
) {
  const visibleJobs = game.jobs
    .filter(
      (job) => job.accepted || job.discovered || job.completed || job.missed,
    )
    .map((job) => ({
      detail: buildJobMemoryDetail(job, locationById.get(job.locationId)?.name),
      id: job.id,
      priority: job.accepted ? 4 : job.discovered ? 3 : job.completed ? 2 : 1,
      title: job.title,
    }));

  const visibleProblems = game.problems
    .filter((problem) => problem.discovered)
    .map((problem) => ({
      detail: buildProblemMemoryDetail(
        problem,
        locationById.get(problem.locationId)?.name,
      ),
      id: problem.id,
      priority:
        problem.status === "active"
          ? 5
          : problem.status === "solved"
            ? 2
            : problem.status === "expired"
              ? 1
              : 0,
      title: problem.title,
    }));

  return [...visibleProblems, ...visibleJobs]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);
}

function cashReadLabel(money: number, energy: number) {
  if (money < 8) {
    return "Cash is tight enough that the next useful move probably needs to pay.";
  }

  if (money < 20 && energy < 40) {
    return "Rowan can act, but does not have enough room to waste a tired step.";
  }

  if (money < 20) {
    return "There is enough for one modest purchase or a little breathing room.";
  }

  if (energy < 40) {
    return "Money can cover a need, but not the effort to brute-force the day.";
  }

  return "There is enough cash on hand to solve a problem instead of only chasing coin.";
}

function formatMemoryMeta(items: string[], total: number) {
  if (total <= 1 || items.length === 0) {
    return undefined;
  }

  const remaining = total - 1 - items.length;
  const base = items.join(" • ");

  if (remaining > 0) {
    return `${base} • +${remaining} more`;
  }

  return base;
}

function buildNarrativePreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const firstSentenceBreak = normalized.indexOf(". ");
  if (firstSentenceBreak !== -1 && firstSentenceBreak + 1 <= maxLength) {
    return normalized.slice(0, firstSentenceBreak + 1).trim();
  }

  const clipped = normalized.slice(0, maxLength).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(maxLength * 0.55)
      ? clipped.slice(0, lastSpace)
      : clipped;

  return `${base.trimEnd()}...`;
}

function buildKnownPlaceDetail(location: StreetGameState["locations"][number]) {
  return `I know this as a ${location.type} in ${location.neighborhood}. ${location.context}`;
}

function buildKnownPersonDetail(person: StreetGameState["npcs"][number]) {
  const roleWithArticle = /^[aeiou]/i.test(person.role)
    ? `an ${person.role}`
    : `a ${person.role}`;
  const roleLine = `I know ${person.name} as ${roleWithArticle}.`;

  if (person.currentThought) {
    return `${roleLine} ${toFirstPersonText(person.currentThought)}`;
  }

  return `${roleLine} I remember that ${person.name} ${lowercaseFirst(trimPeriod(person.summary))}.`;
}

function buildJobMemoryDetail(
  job: StreetGameState["jobs"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (job.completed) {
    return `I finished this at ${place} and got paid.`;
  }

  if (job.missed) {
    return `I let this slip at ${place}.`;
  }

  if (job.accepted) {
    if (job.deferredUntilMinutes !== undefined) {
      return `I'm still committed to this at ${place}, but I've pushed it back for a bit.`;
    }

    return `I'm committed to this at ${place}. It pays $${job.pay}.`;
  }

  return `I know this lead at ${place}. It pays $${job.pay}.`;
}

function buildProblemMemoryDetail(
  problem: StreetGameState["problems"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (problem.status === "solved") {
    return `I already handled this at ${place}.`;
  }

  if (problem.status === "expired") {
    return `I let this spread at ${place}.`;
  }

  if (problem.status === "active") {
    return `I can deal with this at ${place}. It pays $${problem.rewardMoney}.`;
  }

  return `I heard about this at ${place}.`;
}

function trimPeriod(text: string) {
  return text.replace(/[.!?]+$/, "").trim();
}

function lowercaseFirst(text: string) {
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildObjectiveCompletedItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  const completedItems: ObjectivePlanItem[] = [];
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2);
  const completedJobs = game.jobs.filter((job) => job.completed);
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  );

  for (const job of completedJobs) {
    completedItems.push({
      detail: `You followed through at ${
        locationById.get(job.locationId)?.name ?? "the job site"
      } and got paid.`,
      done: true,
      id: `completed-job-${job.id}`,
      progress: `+$${job.pay}`,
      title: `Finished ${job.title.toLowerCase()}`,
    });
  }

  for (const problem of solvedProblems) {
    completedItems.push({
      detail: `You handled this at ${
        locationById.get(problem.locationId)?.name ?? "the scene"
      } and made the block a little easier to live in.`,
      done: true,
      id: `completed-problem-${problem.id}`,
      progress:
        problem.rewardMoney > 0 ? `+$${problem.rewardMoney}` : undefined,
      title: `Solved ${problem.title.toLowerCase()}`,
    });
  }

  if (game.player.knownLocationIds.length >= 4) {
    completedItems.push({
      detail:
        "The district has stopped feeling like a blur. Rowan has enough of the lanes in his head to plan ahead.",
      done: true,
      id: "completed-lanes",
      progress: `${game.player.knownLocationIds.length} places known`,
      title: "Got the lay of South Quay",
    });
  }

  if (game.player.knownNpcIds.length >= 3) {
    completedItems.push({
      detail:
        "Rowan is no longer a stranger to just one face. A few locals know him well enough to place him.",
      done: true,
      id: "completed-locals",
      progress: `${game.player.knownNpcIds.length} people known`,
      title: "Made first introductions",
    });
  }

  if (trustedPeople.length >= 1) {
    completedItems.push({
      detail: `${trustedPeople[0]?.name ?? "Someone"} has started answering Rowan like he belongs in the conversation.`,
      done: true,
      id: "completed-trust",
      progress: `${trustedPeople.length} trusted`,
      title: "Earned some trust",
    });
  }

  if (game.player.money >= 20) {
    completedItems.push({
      detail:
        "Cash has started feeling like footing instead of the day's last few coins.",
      done: true,
      id: "completed-breathing-room",
      progress: `$${game.player.money} on hand`,
      title: "Built a little breathing room",
    });
  }

  return completedItems.slice(0, 8);
}

function buildObjectivePlanItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  const focus = game.player.objective?.focus ?? "settle";
  const activeJob = game.jobs.find(
    (job) =>
      job.id === game.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const discoveredJobs = game.jobs.filter((job) => job.discovered);
  const completedJobs = game.jobs.filter((job) => job.completed).length;
  const discoveredProblems = game.problems.filter(
    (problem) => problem.discovered,
  );
  const activeProblems = discoveredProblems.filter(
    (problem) => problem.status === "active",
  );
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  ).length;
  const knownPeople = game.player.knownNpcIds.length;
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2).length;
  const knownPlaces = game.player.knownLocationIds.length;
  const houseStanding = game.player.reputation.morrow_house ?? 0;
  const homeName =
    locationById.get(game.player.homeLocationId)?.name ?? "Morrow House";
  const hasWrench = game.player.inventory.some(
    (item) => item.id === "item-wrench",
  );
  const activeProblem = activeProblems[0];
  const activeJobLocation = activeJob
    ? locationById.get(activeJob.locationId)?.name
    : undefined;

  switch (focus) {
    case "work":
      return [
        {
          detail:
            discoveredJobs.length > 0
              ? "There is at least one real work lead on the block now."
              : "You still need to find out who is actually hiring today.",
          done: discoveredJobs.length > 0,
          id: "work-lead",
          progress: `${Math.min(discoveredJobs.length, 1)}/1 lead`,
          title: "Find paying work",
        },
        {
          detail: activeJob
            ? `You already have ${activeJob.title.toLowerCase()} lined up at ${activeJobLocation ?? "the job site"}.`
            : completedJobs > 0
              ? "You have already proved you can turn a lead into real work."
              : "You still need to lock one job in instead of only hearing about it.",
          done: Boolean(activeJob || completedJobs > 0),
          id: "work-commit",
          progress: activeJob || completedJobs > 0 ? "In hand" : "Not lined up",
          title: "Line up the next shift",
        },
        {
          detail:
            completedJobs > 0 || game.player.money >= 20
              ? "Money is starting to feel like footing, not just survival."
              : "The point is not only work. It is enough cash that the next move gets easier.",
          done: completedJobs > 0 || game.player.money >= 20,
          id: "work-money",
          progress: `$${game.player.money} on hand`,
          title: "Turn it into breathing room",
        },
      ];
    case "people":
      return [
        {
          detail:
            knownPeople >= 3
              ? "You know enough people now that the block has stopped feeling faceless."
              : "You still need to make yourself known to more than one or two people here.",
          done: knownPeople >= 3,
          id: "people-meet",
          progress: `${knownPeople}/3 people`,
          title: "Meet a few locals",
        },
        {
          detail:
            trustedPeople >= 1
              ? "At least one person is starting to answer you like you belong in the conversation."
              : "You still need one real conversation that turns into trust.",
          done: trustedPeople >= 1,
          id: "people-open-up",
          progress: `${Math.min(trustedPeople, 1)}/1 trust`,
          title: "Get someone to open up",
        },
        {
          detail:
            trustedPeople >= 2
              ? "A couple of people are starting to feel like they could become real friends."
              : "This is not just about names. It is about finding people you would actually return to.",
          done: trustedPeople >= 2,
          id: "people-friends",
          progress: `${trustedPeople}/2 trusted`,
          title: "Find people to come back to",
        },
      ];
    case "explore":
      return [
        {
          detail:
            knownPlaces >= 4
              ? "You know enough places now to move with some intention."
              : "You still need a better mental map of where this district opens up.",
          done: knownPlaces >= 4,
          id: "explore-places",
          progress: `${knownPlaces}/4 places`,
          title: "Learn the shape of the block",
        },
        {
          detail:
            knownPeople >= 2
              ? "You have started pairing places with the people who matter there."
              : "A map is not enough. You still need to connect those places to real people.",
          done: knownPeople >= 2,
          id: "explore-people",
          progress: `${knownPeople}/2 people`,
          title: "Read the people in it",
        },
        {
          detail:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0
              ? "The district has already given you at least one thread worth following."
              : "Learning the lanes should surface one job, problem, or useful opening.",
          done:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0,
          id: "explore-lead",
          progress:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0
              ? "Lead found"
              : "Still looking",
          title: "Come away with one usable lead",
        },
      ];
    case "help":
      return [
        {
          detail:
            discoveredProblems.length > 0
              ? "You know what is actually wrong now, not just that something feels off."
              : "You still need to pin down what needs fixing and where it sits.",
          done: discoveredProblems.length > 0,
          id: "help-find",
          progress: `${Math.min(discoveredProblems.length, 1)}/1 problem`,
          title: "Find the problem clearly",
        },
        {
          detail: !activeProblem
            ? "Once the problem is clear, figure out whether it needs time, hands, or a tool."
            : activeProblem.requiredItemId
              ? hasWrench
                ? "You have the tool this fix has been waiting on."
                : "You know the fix needs a tool before your hands can finish it."
              : "You already have what you need to handle this.",
          done:
            Boolean(activeProblem) &&
            (!activeProblem.requiredItemId || hasWrench),
          id: "help-ready",
          progress: !activeProblem
            ? "Waiting on the read"
            : activeProblem.requiredItemId
              ? hasWrench
                ? "Tool ready"
                : "Tool needed"
              : "Ready now",
          title: "Get what the fix needs",
        },
        {
          detail:
            solvedProblems > 0
              ? "You have already turned one local problem into proof that you can help."
              : "The last step is doing the work, not circling it.",
          done: solvedProblems > 0,
          id: "help-solve",
          progress: `${Math.min(solvedProblems, 1)}/1 solved`,
          title: "See it through",
        },
      ];
    case "tool":
      return [
        {
          detail:
            activeProblem?.requiredItemId || hasWrench
              ? "You know the block is pointing you toward one concrete tool."
              : "You still need to hear what tool would actually change the day.",
          done: Boolean(activeProblem?.requiredItemId || hasWrench),
          id: "tool-decide",
          progress:
            activeProblem?.requiredItemId || hasWrench
              ? "Clear enough"
              : "Still asking",
          title: "Figure out which tool matters",
        },
        {
          detail:
            game.player.money >= 8 || hasWrench
              ? "You have enough coin to stop this at talk and turn it into a purchase."
              : "You still need enough cash to buy the tool without wrecking your next move.",
          done: game.player.money >= 8 || hasWrench,
          id: "tool-money",
          progress: `$${game.player.money} / $8`,
          title: "Get the money together",
        },
        {
          detail: hasWrench
            ? "The tool is already in your hands now."
            : "You still need to go get it.",
          done: hasWrench,
          id: "tool-buy",
          progress: hasWrench ? "Owned" : "Not bought",
          title: "Buy the tool",
        },
      ];
    case "rest":
      return [
        {
          detail:
            game.player.currentLocationId === game.player.homeLocationId
              ? `You are already at ${homeName}, which gives rest a chance to count.`
              : `You need to get back to ${homeName} or another safe place before resting does much.`,
          done: game.player.currentLocationId === game.player.homeLocationId,
          id: "rest-safe",
          progress:
            game.player.currentLocationId === game.player.homeLocationId
              ? "In place"
              : "Still out",
          title: "Get somewhere you can actually stop",
        },
        {
          detail:
            game.player.energy >= 70
              ? "Your energy has already come back enough that the edge is off."
              : "You still need to actually stop long enough for recovery to happen.",
          done: game.player.energy >= 70,
          id: "rest-hour",
          progress: `${game.player.energy} energy`,
          title: "Let the hour land",
        },
      ];
    case "settle":
    default:
      return [
        {
          detail: game.goals[0] ?? "You still need a real path to money.",
          done: Boolean(
            activeJob || completedJobs > 0 || discoveredJobs.length > 0,
          ),
          id: "settle-income",
          progress:
            activeJob || completedJobs > 0 || discoveredJobs.length > 0
              ? "Lead found"
              : "Still looking",
          title: "Find income",
        },
        {
          detail:
            game.goals[1] ?? `You still need better footing at ${homeName}.`,
          done: houseStanding >= 2,
          id: "settle-stay",
          progress: `${houseStanding}/2 footing`,
          title: "Make the bed situation less shaky",
        },
        {
          detail:
            game.goals[2] ??
            "You still need people who are more than passing faces.",
          done: trustedPeople >= 1 || knownPeople >= 3,
          id: "settle-people",
          progress: `${Math.max(trustedPeople, knownPeople)}/${trustedPeople > 0 ? 2 : 3}`,
          title: "Find people you might actually keep",
        },
        {
          detail:
            knownPlaces >= 4
              ? "The district is starting to feel like somewhere you can route yourself through."
              : "You still need a stronger read on where things are and what each place is good for.",
          done: knownPlaces >= 4,
          id: "settle-bearings",
          progress: `${knownPlaces}/4 places`,
          title: "Learn enough of the block to plan ahead",
        },
      ];
  }
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
      busyLabel: "Letting five quiet minutes pass...",
      key: "increment-5",
      kind: "increment",
      label: "+5m",
      minutes: 5,
    },
    {
      busyLabel: "Letting fifteen quiet minutes pass...",
      key: "increment-15",
      kind: "increment",
      label: "+15m",
      minutes: 15,
    },
    {
      busyLabel: "Letting half an hour pass...",
      key: "increment-30",
      kind: "increment",
      label: "+30m",
      minutes: 30,
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

function syncUiState(runtimeState: RuntimeState) {
  const game = runtimeState.snapshot.game;
  const nextDefaultNpcId = pickDefaultSelectedNpcId(game);
  const previousSelectedNpcId = runtimeState.ui.selectedNpcId;
  const collapsibleRailViewport = isCollapsibleRailViewport(
    runtimeState.snapshot.viewport,
  );

  if (!game) {
    runtimeState.ui.selectedNpcId = null;
    runtimeState.ui.activeTab = "actions";
    runtimeState.ui.focusPanel = null;
    runtimeState.ui.railExpanded = !collapsibleRailViewport;
    return;
  }

  if (!collapsibleRailViewport) {
    runtimeState.ui.railExpanded = true;
  }

  if (game.activeConversation?.npcId) {
    if (
      collapsibleRailViewport &&
      !runtimeState.ui.railExpanded &&
      previousSelectedNpcId !== game.activeConversation.npcId
    ) {
      runtimeState.ui.railExpanded = true;
    }
    runtimeState.ui.selectedNpcId = game.activeConversation.npcId;
    if (runtimeState.ui.focusPanel !== "people") {
      runtimeState.ui.activeTab = "actions";
      runtimeState.ui.focusPanel = null;
    }
  }

  if (
    !runtimeState.ui.selectedNpcId ||
    !game.npcs.some((npc) => npc.id === runtimeState.ui.selectedNpcId)
  ) {
    runtimeState.ui.selectedNpcId = nextDefaultNpcId;
  }

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
  if (!game || runtimeState.snapshot.busyLabel || game.activeConversation) {
    return;
  }

  const selectedNpc = getSelectedNpc(runtimeState);
  if (
    !selectedNpc ||
    !game.player.currentLocationId ||
    selectedNpc.currentLocationId !== game.player.currentLocationId
  ) {
    return;
  }

  const talkActions = game.availableActions.filter((action) =>
    extractTalkNpcId(action.id),
  );
  const selectedTalkAction = talkActions.find(
    (action) => extractTalkNpcId(action.id) === selectedNpc.id,
  );
  if (!selectedTalkAction) {
    return;
  }

  if (getConversationPreview(game, selectedNpc.id).length > 0) {
    runtimeState.ui.pendingConversationNpcId = null;
    return;
  }

  const onlyTalkActionNpcId =
    talkActions.length === 1 ? extractTalkNpcId(talkActions[0].id) : null;
  const shouldAutostart =
    runtimeState.ui.pendingConversationNpcId === selectedNpc.id ||
    onlyTalkActionNpcId === selectedNpc.id;

  if (!shouldAutostart) {
    return;
  }

  const autoStartKey = `${game.id}:${game.player.currentLocationId}:${selectedNpc.id}`;
  if (runtimeState.autoStartedConversationKey === autoStartKey) {
    return;
  }

  runtimeState.autoStartedConversationKey = autoStartKey;
  runtimeState.ui.pendingConversationNpcId = null;
  runtimeState.ui.activeTab = "actions";
  runtimeState.ui.focusPanel = null;
  if (isCollapsibleRailViewport(runtimeState.snapshot.viewport)) {
    runtimeState.ui.railExpanded = true;
  }
  callbacksRef.current.onAction(
    selectedTalkAction.id,
    `Rowan opens with ${selectedNpc.name}`,
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

function collectAnimatedSurfaceTiles(
  map: CityMap,
): Array<Pick<MapTile, "kind" | "x" | "y">> {
  const animatedTiles = map.tiles
    .filter((tile) => tile.kind === "water" || tile.kind === "dock")
    .map((tile) => ({ kind: tile.kind, x: tile.x, y: tile.y }));
  const extendedGrid = getExtendedGridSize(map);
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const fringeTile = fringeTileForCoordinate(column, row, map);
      if (
        !fringeTile ||
        (fringeTile.kind !== "water" && fringeTile.kind !== "dock")
      ) {
        continue;
      }

      animatedTiles.push({
        kind: fringeTile.kind,
        x: column - mapLeft,
        y: row - mapTop,
      });
    }
  }

  return animatedTiles;
}

function getWorldBounds(snapshot: StreetAppSnapshot) {
  if (!snapshot.game) {
    return {
      height: snapshot.viewport.height,
      width: snapshot.viewport.width,
    };
  }

  const visualScene = getPlayableVisualScene(snapshot.game);
  if (visualScene) {
    return {
      height: visualScene.height,
      width: visualScene.width,
    };
  }

  const extendedGrid = getExtendedGridSize(snapshot.game.map);
  return {
    height: extendedGrid.height * CELL + WORLD_PADDING * 2,
    width: extendedGrid.width * CELL + WORLD_PADDING * 2,
  };
}

function getExtendedGridSize(map: MapSize) {
  return {
    height: map.height + VISUAL_MARGIN_TILES.top + VISUAL_MARGIN_TILES.bottom,
    width: map.width + VISUAL_MARGIN_TILES.left + VISUAL_MARGIN_TILES.right,
  };
}

function getMapWorldOrigin() {
  return {
    x: WORLD_PADDING + VISUAL_MARGIN_TILES.left * CELL,
    y: WORLD_PADDING + VISUAL_MARGIN_TILES.top * CELL,
  };
}

function mapPointToWorld(point: Point) {
  const origin = getMapWorldOrigin();
  return {
    x: origin.x + point.x * CELL,
    y: origin.y + point.y * CELL,
  };
}

function projectRuntimePoint(indices: RuntimeIndices, point: Point) {
  if (indices.visualScene) {
    return projectVisualScenePoint(indices.visualScene, point);
  }

  return mapPointToWorld(point);
}

function projectRuntimeTileCenter(
  indices: RuntimeIndices,
  x: number,
  y: number,
) {
  return projectRuntimePoint(indices, {
    x: x + 0.5,
    y: y + 0.5,
  });
}

function getCompactCameraHorizontalRange(
  runtimeState: RuntimeState,
  world: { height: number; width: number },
  visibleWidth: number,
) {
  const maxScrollX = Math.max(world.width - visibleWidth, 0);
  const game = runtimeState.snapshot.game;
  if (!game) {
    return { max: maxScrollX, min: 0 };
  }

  const visualScene = runtimeState.indices.visualScene;
  if (visualScene) {
    const projectedLeft = projectVisualScenePoint(visualScene, {
      x: 0,
      y: 0,
    }).x;
    const projectedRight = projectVisualScenePoint(visualScene, {
      x: game.map.width,
      y: 0,
    }).x;
    const contentLeft = Math.min(projectedLeft, projectedRight);
    const contentRight = Math.max(projectedLeft, projectedRight);
    const min = clamp(contentLeft, 0, maxScrollX);
    const max = Math.max(
      min,
      Math.min(contentRight - visibleWidth, maxScrollX),
    );
    return { max, min };
  }

  const mapOrigin = getMapWorldOrigin();
  const contentLeft = mapOrigin.x;
  const contentRight = mapOrigin.x + game.map.width * CELL;
  const min = clamp(contentLeft, 0, maxScrollX);
  const max = Math.max(min, Math.min(contentRight - visibleWidth, maxScrollX));
  return { max, min };
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

function mapTileToWorldOrigin(x: number, y: number) {
  return mapPointToWorld({ x, y });
}

function mapTileToWorldCenter(x: number, y: number) {
  return mapPointToWorld({
    x: x + 0.5,
    y: y + 0.5,
  });
}

function worldGridToWorldOrigin(x: number, y: number) {
  return {
    x: WORLD_PADDING + x * CELL,
    y: WORLD_PADDING + y * CELL,
  };
}

function getOverlayLayoutMetrics(viewport: ViewportSize): OverlayLayoutMetrics {
  const { height, width } = viewport;
  const overlayInset = width <= 720 ? 12 : width <= 1080 ? 16 : 20;
  const railWidth =
    width <= 720
      ? width - overlayInset * 2
      : width <= 1080
        ? Math.min(width - overlayInset * 2, 380)
        : clamp(width * 0.31, 380, 460);
  const dockWidth =
    width <= 720
      ? width - overlayInset * 2
      : width <= 1080
        ? Math.min(width - overlayInset * 2, 360)
        : clamp(width * 0.28, 340, 460);
  const focusWidth =
    width <= 720
      ? width - overlayInset * 2
      : width <= 1080
        ? Math.min(width - overlayInset * 2, 940)
        : clamp(width * 0.62, 820, 1120);
  const focusHeight =
    width <= 720 ? height - overlayInset * 2 : clamp(height * 0.7, 540, 780);
  const railMaxHeight = Math.max(280, height - overlayInset * 2);
  const sceneGap = width <= 720 ? 0 : overlayInset;
  const dockFocusGap = width <= 960 ? 0 : width <= 1320 ? 12 : 16;
  const dockFocusMaxWidth =
    width <= 960
      ? width - overlayInset * 2
      : Math.max(
          width - overlayInset * 2 - railWidth - dockFocusGap,
          dockWidth,
        );
  const dockFocusWidth = Math.min(focusWidth, dockFocusMaxWidth);

  return {
    dockFocusWidth,
    dockWidth,
    focusHeight,
    focusWidth,
    overlayInset,
    railMaxHeight,
    railWidth,
    sceneGap,
  };
}

function isCollapsibleRailViewport(viewport: ViewportSize) {
  return viewport.width <= 960;
}

function isPhoneRailViewport(viewport: ViewportSize) {
  return viewport.width <= 720;
}

function isCompactViewport(viewport: ViewportSize) {
  return viewport.width <= COMPACT_LAYOUT_MAX_WIDTH;
}

function isCompactPortraitViewport(viewport: ViewportSize) {
  return isCompactViewport(viewport) && viewport.height > viewport.width;
}

function getSceneViewport(
  viewport: ViewportSize,
  world: { height: number; width: number },
  layoutViewport: ViewportSize = viewport,
): SceneViewport {
  if (isCompactViewport(layoutViewport)) {
    return {
      height: viewport.height,
      width: viewport.width,
      x: 0,
      y: 0,
    };
  }

  const { overlayInset, railWidth, sceneGap } =
    getOverlayLayoutMetrics(viewport);
  const frameX = 0;
  const frameY = overlayInset;
  const frameWidth = Math.max(
    viewport.width - railWidth - sceneGap - overlayInset,
    1,
  );
  const frameHeight = Math.max(viewport.height - overlayInset * 2, 1);
  const worldAspect = Math.max(world.width, 1) / Math.max(world.height, 1);
  const frameAspect = frameWidth / frameHeight;
  const sceneWidth =
    frameAspect > worldAspect ? frameHeight * worldAspect : frameWidth;
  const sceneHeight =
    frameAspect > worldAspect
      ? frameHeight
      : frameWidth / Math.max(worldAspect, 0.001);

  return {
    height: sceneHeight,
    width: sceneWidth,
    x: frameX,
    y: frameY + (frameHeight - sceneHeight) / 2,
  };
}

function getSceneZoom(
  viewport: SceneViewport,
  world: { height: number; width: number },
  layoutViewport: ViewportSize = viewport,
) {
  const widthFit = viewport.width / Math.max(world.width, 1);
  const heightFit = viewport.height / Math.max(world.height, 1);
  if (isCompactPortraitViewport(layoutViewport)) {
    return heightFit * COMPACT_PORTRAIT_COVER_ZOOM_BOOST;
  }
  return Math.min(widthFit, heightFit);
}

function getRuntimeRenderScale(cameraZoomFactor = CAMERA_USER_ZOOM_DEFAULT) {
  if (typeof window === "undefined") {
    return 1;
  }

  const deviceRatio = window.devicePixelRatio || 1;
  const zoomFactor = Math.max(cameraZoomFactor, 1);
  return Math.min(
    Math.max(deviceRatio * zoomFactor * RUNTIME_RENDER_CLARITY_BOOST, 1),
    MAX_RUNTIME_RENDER_SCALE,
  );
}

function getRuntimeViewportSize(runtimeState: RuntimeState): ViewportSize {
  return {
    height: Math.max(
      Math.round(
        runtimeState.snapshot.viewport.height * runtimeState.renderScale,
      ),
      1,
    ),
    width: Math.max(
      Math.round(
        runtimeState.snapshot.viewport.width * runtimeState.renderScale,
      ),
      1,
    ),
  };
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
    runtimeState.playerMotion = createPlayerEntranceMotion(
      game,
      runtimeState.indices.routeFinder,
      nextPoint,
      now,
    );

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
  const routedPoints = runtimeState.indices.routeFinder(fromPoint, nextPoint);
  const path = [fromPoint, ...routedPoints.slice(1)];
  const playerMoveMsPerTile = derivePlayerMoveMsPerTile(runtimeState);
  const durationMs = clamp(
    Math.max(path.length - 1, 1) * playerMoveMsPerTile,
    playerMoveMsPerTile,
    PLAYER_MAX_MOVE_DURATION_MS,
  );

  runtimeState.playerMotion = {
    durationMs,
    path,
    startedAt: now,
    to: nextPoint,
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

function pathDistance(path: Point[]) {
  if (path.length <= 1) {
    return 0;
  }

  return path.slice(1).reduce((sum, point, index) => {
    return sum + distanceBetween(path[index], point);
  }, 0);
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
  const phaseOffset = ((hashString(npc.id) + index * 17) % 997) / 997;
  const cycleSeconds = patrolCycleSeconds(location.type);
  const progress = positiveModulo(
    (animationBeat * personality.pace) / cycleSeconds +
      phaseOffset +
      game.clock.totalMinutes * 0.021 * personality.pace,
    1,
  );
  const point = sampleLoopPath(patrolPath, progress);
  const lookAhead = sampleLoopPath(
    patrolPath,
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
          Math.max(3, patrolPath.length - 1) *
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

function updateCamera(
  camera: PhaserType.Cameras.Scene2D.Camera,
  runtimeState: RuntimeState,
  viewport: SceneViewport,
  playerPixel: Point,
  world: { height: number; width: number },
  now: number,
) {
  relaxCameraOffset(runtimeState, viewport, now);
  const targetZoom = getTargetSceneZoom(runtimeState, viewport, world);
  camera.setZoom(
    camera.zoom + (targetZoom - camera.zoom) * CAMERA_USER_ZOOM_LERP,
  );
  const effectiveZoom = Math.max(camera.zoom, 0.001);
  const visibleWidth = viewport.width / effectiveZoom;
  const visibleHeight = viewport.height / effectiveZoom;
  const anchorX =
    visibleWidth / 2 + runtimeState.cameraOffset.x / effectiveZoom;
  const anchorY =
    visibleHeight * 0.42 + runtimeState.cameraOffset.y / effectiveZoom;
  const deadzoneWidth =
    clamp(viewport.width * 0.12, CELL * 1.6, CELL * 3.2) / effectiveZoom;
  const deadzoneHeight =
    clamp(viewport.height * 0.085, CELL * 1.2, CELL * 2.4) / effectiveZoom;
  let minScrollX = 0;
  let maxScrollX = Math.max(world.width - visibleWidth, 0);
  const maxScrollY = Math.max(world.height - visibleHeight, 0);
  if (isCompactViewport(runtimeState.snapshot.viewport)) {
    const range = getCompactCameraHorizontalRange(
      runtimeState,
      world,
      visibleWidth,
    );
    minScrollX = range.min;
    maxScrollX = range.max;
  }
  const playerViewportX = playerPixel.x - camera.scrollX;
  const playerViewportY = playerPixel.y - camera.scrollY;
  const isDragging = runtimeState.cameraGesture?.dragging === true;
  let targetScrollX = camera.scrollX;
  let targetScrollY = camera.scrollY;

  if (isDragging) {
    targetScrollX = playerPixel.x - anchorX;
    targetScrollY = playerPixel.y - anchorY;
  } else {
    if (playerViewportX < anchorX - deadzoneWidth) {
      targetScrollX = playerPixel.x - (anchorX - deadzoneWidth);
    } else if (playerViewportX > anchorX + deadzoneWidth) {
      targetScrollX = playerPixel.x - (anchorX + deadzoneWidth);
    }

    if (playerViewportY < anchorY - deadzoneHeight) {
      targetScrollY = playerPixel.y - (anchorY - deadzoneHeight);
    } else if (playerViewportY > anchorY + deadzoneHeight) {
      targetScrollY = playerPixel.y - (anchorY + deadzoneHeight);
    }
  }

  targetScrollX = clamp(targetScrollX, minScrollX, maxScrollX);
  targetScrollY = clamp(targetScrollY, 0, maxScrollY);

  const followLerp = isDragging ? 0.18 : PLAYER_CAMERA_LERP;
  camera.scrollX += (targetScrollX - camera.scrollX) * followLerp;
  camera.scrollY += (targetScrollY - camera.scrollY) * followLerp;
}

function beginCameraGesture(
  runtimeState: RuntimeState,
  pointer: PhaserType.Input.Pointer,
) {
  if (!runtimeState.snapshot.game) {
    return;
  }

  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    getWorldBounds(runtimeState.snapshot),
    runtimeState.snapshot.viewport,
  );
  if (!isPointerWithinSceneViewport(pointer, sceneViewport)) {
    return;
  }

  runtimeState.cameraGesture = {
    downScreen: { x: pointer.x, y: pointer.y },
    dragging: false,
    originOffset: runtimeState.cameraOffset,
    pointerId: pointer.id,
  };
  runtimeState.lastCameraInteractionAt = getRuntimeNow();
}

function updateCameraGesture(
  runtimeState: RuntimeState,
  pointer: PhaserType.Input.Pointer,
) {
  const gesture = runtimeState.cameraGesture;
  if (!gesture || gesture.pointerId !== pointer.id || !pointer.isDown) {
    return;
  }

  const deltaX = pointer.x - gesture.downScreen.x;
  const deltaY = pointer.y - gesture.downScreen.y;

  if (
    !gesture.dragging &&
    Math.hypot(deltaX, deltaY) < CAMERA_DRAG_START_DISTANCE_PX
  ) {
    return;
  }

  gesture.dragging = true;
  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    getWorldBounds(runtimeState.snapshot),
    runtimeState.snapshot.viewport,
  );
  runtimeState.cameraOffset = clampCameraOffset(sceneViewport, {
    x: gesture.originOffset.x + deltaX,
    y: gesture.originOffset.y + deltaY,
  });
  runtimeState.lastCameraInteractionAt = getRuntimeNow();
}

function finishCameraGesture(
  runtimeState: RuntimeState,
  pointer: PhaserType.Input.Pointer,
  callbacksRef: React.MutableRefObject<RuntimeCallbacks>,
) {
  const gesture = runtimeState.cameraGesture;
  if (!gesture || gesture.pointerId !== pointer.id) {
    return;
  }

  runtimeState.cameraGesture = null;
  runtimeState.lastCameraInteractionAt = getRuntimeNow();

  if (gesture.dragging) {
    return;
  }

  const game = runtimeState.snapshot.game;
  if (!game || runtimeState.snapshot.busyLabel) {
    return;
  }

  const sceneViewport = getSceneViewport(
    getRuntimeViewportSize(runtimeState),
    getWorldBounds(runtimeState.snapshot),
    runtimeState.snapshot.viewport,
  );
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

function isPointerWithinSceneViewport(
  pointer: PhaserType.Input.Pointer,
  sceneViewport: SceneViewport,
) {
  return !(
    pointer.x < sceneViewport.x ||
    pointer.y < sceneViewport.y ||
    pointer.x > sceneViewport.x + sceneViewport.width ||
    pointer.y > sceneViewport.y + sceneViewport.height
  );
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

function clampCameraOffset(viewport: ViewportSize, offset: Point) {
  const maxX = clamp(viewport.width * 0.22, CELL * 2.2, CELL * 5.6);
  const maxY = clamp(viewport.height * 0.18, CELL * 1.6, CELL * 4.2);
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function getCameraZoomRange(viewport: ViewportSize) {
  return {
    max: CAMERA_USER_ZOOM_MAX,
    min: isCompactViewport(viewport)
      ? CAMERA_USER_ZOOM_DEFAULT
      : CAMERA_USER_ZOOM_MIN,
  };
}

function clampCameraZoomFactor(zoomFactor: number, viewport: ViewportSize) {
  const range = getCameraZoomRange(viewport);
  return clamp(zoomFactor, range.min, range.max);
}

function normalizeCameraZoomFactor(runtimeState: RuntimeState) {
  runtimeState.cameraZoomFactor = clampCameraZoomFactor(
    runtimeState.cameraZoomFactor,
    runtimeState.snapshot.viewport,
  );
}

function adjustCameraZoom(runtimeState: RuntimeState, delta: number) {
  runtimeState.cameraZoomFactor = clampCameraZoomFactor(
    Number((runtimeState.cameraZoomFactor + delta).toFixed(2)),
    runtimeState.snapshot.viewport,
  );
  runtimeState.lastCameraInteractionAt = getRuntimeNow();
}

function getTargetSceneZoom(
  runtimeState: RuntimeState,
  viewport: SceneViewport,
  world: { height: number; width: number },
) {
  normalizeCameraZoomFactor(runtimeState);
  return (
    getSceneZoom(viewport, world, runtimeState.snapshot.viewport) *
    runtimeState.cameraZoomFactor
  );
}

function relaxCameraOffset(
  runtimeState: RuntimeState,
  viewport: SceneViewport,
  now: number,
) {
  runtimeState.cameraOffset = clampCameraOffset(
    viewport,
    runtimeState.cameraOffset,
  );

  if (runtimeState.cameraGesture?.dragging) {
    return;
  }

  if (
    now - runtimeState.lastCameraInteractionAt <
    CAMERA_OFFSET_RETURN_DELAY_MS
  ) {
    return;
  }

  runtimeState.cameraOffset = {
    x:
      Math.abs(runtimeState.cameraOffset.x) < 0.5
        ? 0
        : runtimeState.cameraOffset.x * (1 - CAMERA_OFFSET_RETURN_LERP),
    y:
      Math.abs(runtimeState.cameraOffset.y) < 0.5
        ? 0
        : runtimeState.cameraOffset.y * (1 - CAMERA_OFFSET_RETURN_LERP),
  };
}

function drawBackdrop(
  layer: PhaserType.GameObjects.Graphics,
  world: { height: number; width: number },
  map?: CityMap,
) {
  layer.fillStyle(0x10212a, 1);
  layer.fillRoundedRect(0, 0, world.width, world.height, 34);
  layer.fillStyle(0x172b34, 1);
  layer.fillRoundedRect(
    WORLD_PADDING / 2,
    WORLD_PADDING / 2 + HEADER_HEIGHT / 8,
    world.width - WORLD_PADDING,
    world.height - WORLD_PADDING - HEADER_HEIGHT / 8,
    30,
  );
  layer.lineStyle(2, 0x304650, 0.68);
  layer.strokeRoundedRect(
    WORLD_PADDING / 2,
    WORLD_PADDING / 2 + HEADER_HEIGHT / 8,
    world.width - WORLD_PADDING,
    world.height - WORLD_PADDING - HEADER_HEIGHT / 8,
    30,
  );
  layer.fillStyle(0x132128, 0.14);
  layer.fillRoundedRect(
    WORLD_PADDING,
    world.height - 110,
    world.width - WORLD_PADDING * 2,
    80,
    28,
  );

  if (map) {
    const mapOrigin = getMapWorldOrigin();
    const waterfrontX = mapOrigin.x + map.width * CELL * 0.72;
    const waterfrontY = mapOrigin.y + map.height * CELL + CELL * 1.6;
    layer.fillStyle(0x4f8297, 0.11);
    layer.fillEllipse(
      waterfrontX,
      waterfrontY,
      map.width * CELL * 0.72,
      CELL * 5.2,
    );
    layer.fillStyle(0xd7bf95, 0.04);
    layer.fillEllipse(
      mapOrigin.x + map.width * CELL * 0.25,
      mapOrigin.y + map.height * CELL * 0.22,
      map.width * CELL * 0.48,
      map.height * CELL * 0.62,
    );
  }
}

// Kept for future edge-of-map staging passes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function drawBackdropCitySilhouette(
  layer: PhaserType.GameObjects.Graphics,
  world: { height: number; width: number },
) {
  const skylineTop = WORLD_PADDING + 8;
  const farBandY = skylineTop + 10;
  const nearBandY = skylineTop + 62;
  const farWidths = [78, 64, 92, 68, 84, 60, 98, 74, 88];
  const nearBlocks = [
    { height: 146, width: 122, x: WORLD_PADDING + 10, y: nearBandY + 34 },
    { height: 104, width: 110, x: WORLD_PADDING + 146, y: nearBandY + 12 },
    { height: 132, width: 124, x: world.width * 0.37, y: nearBandY + 18 },
    { height: 112, width: 118, x: world.width * 0.54, y: nearBandY + 26 },
    {
      height: 156,
      width: 126,
      x: world.width - WORLD_PADDING - 136,
      y: nearBandY + 24,
    },
  ];
  let cursor = WORLD_PADDING + 14;

  for (let index = 0; index < farWidths.length; index += 1) {
    const width = farWidths[index];
    const height = 40 + (index % 4) * 13;
    const x = cursor;
    const y = farBandY + (index % 2) * 6;
    const columns = Math.max(3, Math.floor(width / 18));
    const rows = 2 + (index % 2);

    layer.fillStyle(index % 2 === 0 ? 0x0c171d : 0x102028, 0.56);
    layer.fillRoundedRect(x, y, width, height, 10);
    layer.fillStyle(0xf0d2a0, 0.06);
    layer.fillRoundedRect(x + 10, y + 8, width - 20, 5, 2);
    layer.fillStyle(0xe6cf9d, 0.07);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        layer.fillRect(x + 10 + column * 14, y + 12 + row * 12, 4.5, 4.5);
      }
    }

    cursor += width - 6;
  }

  layer.fillStyle(0x0b161d, 0.2);
  layer.fillEllipse(
    world.width * 0.5,
    skylineTop + 186,
    world.width * 0.72,
    80,
  );

  for (let index = 0; index < nearBlocks.length; index += 1) {
    const block = nearBlocks[index];
    const windowColor = index % 2 === 0 ? 0xf0d29b : 0xcfd8df;

    layer.fillStyle(index % 2 === 0 ? 0x0f1c24 : 0x121f28, 0.64);
    layer.fillRoundedRect(block.x, block.y, block.width, block.height, 18);
    layer.fillStyle(0xffffff, 0.04);
    layer.fillRoundedRect(block.x + 10, block.y + 8, block.width - 20, 6, 3);
    layer.fillStyle(0x000000, 0.1);
    layer.fillRoundedRect(
      block.x + 10,
      block.y + block.height - 18,
      block.width - 20,
      10,
      3,
    );
    layer.fillStyle(windowColor, 0.06);
    for (
      let row = 0;
      row < Math.max(3, Math.floor(block.height / 32));
      row += 1
    ) {
      for (
        let column = 0;
        column < Math.max(4, Math.floor(block.width / 22));
        column += 1
      ) {
        layer.fillRect(
          block.x + 12 + column * 16,
          block.y + 18 + row * 18,
          5,
          5,
        );
      }
    }
  }

  layer.fillStyle(0x081015, 0.28);
  layer.fillRoundedRect(world.width * 0.46, skylineTop + 56, 46, 212, 20);
  layer.fillStyle(0xf1d8a9, 0.05);
  layer.fillRect(world.width * 0.46 + 18, skylineTop + 76, 5, 86);
}

function drawTiles(layer: PhaserType.GameObjects.Graphics, tiles: MapTile[]) {
  const tileLookup = createTileLookup(tiles);
  for (const tile of tiles) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(tile.x, tile.y);
    drawTileCell(
      layer,
      tileLookup,
      tile.x,
      tile.y,
      worldX,
      worldY,
      tile.kind,
      tile.walkable,
    );
  }
}

function createTileLookup(tiles: MapTile[]) {
  const lookup = new Map<string, MapTile>();

  for (const tile of tiles) {
    lookup.set(`${tile.x},${tile.y}`, tile);
  }

  return lookup;
}

function isMatchingSurface(
  tileLookup: Map<string, MapTile>,
  x: number,
  y: number,
  kind: TileKind,
) {
  return tileLookup.get(`${x},${y}`)?.kind === kind;
}

function getTileSurfaceEdges(
  tileLookup: Map<string, MapTile>,
  x: number,
  y: number,
  kind: TileKind,
) {
  return {
    east: isMatchingSurface(tileLookup, x + 1, y, kind),
    north: isMatchingSurface(tileLookup, x, y - 1, kind),
    south: isMatchingSurface(tileLookup, x, y + 1, kind),
    west: isMatchingSurface(tileLookup, x - 1, y, kind),
  };
}

function drawFootprints(
  layer: PhaserType.GameObjects.Graphics,
  map: CityMap,
  useKenneyAssets: boolean,
) {
  for (const footprint of map.footprints) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(
      footprint.x,
      footprint.y,
    );
    const width = footprint.width * CELL;
    const height = footprint.height * CELL;

    if (useKenneyAssets) {
      if (footprint.kind === "building") {
        drawKenneyBuildingMass(
          layer,
          map,
          footprint,
          worldX,
          worldY,
          width,
          height,
        );
        continue;
      }

      if (
        footprint.kind === "market" ||
        footprint.kind === "yard" ||
        footprint.kind === "dock"
      ) {
        drawKenneyOpenPlot(layer, footprint, worldX, worldY, width, height);
        continue;
      }
    }

    const palette = drawArchitecturalMass(layer, {
      kind: footprint.kind,
      locationId: footprint.locationId,
      roofStyle: footprint.roofStyle,
      seedX: footprint.x,
      seedY: footprint.y,
      worldX,
      worldY,
      width,
      height,
    });

    if (footprint.kind === "building") {
      drawBuildingDetail(layer, worldX, worldY, width, height, palette);
    } else {
      drawFootprintSurfaceDetail(
        layer,
        footprint.kind,
        worldX,
        worldY,
        width,
        height,
        palette,
      );
    }
  }
}

type FootprintFacing = "east" | "north" | "south" | "west";

function drawKenneyBuildingMass(
  layer: PhaserType.GameObjects.Graphics,
  map: CityMap,
  footprint: MapFootprint,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
) {
  const palette = footprintPalette({
    kind: footprint.kind,
    locationId: footprint.locationId,
    roofStyle: footprint.roofStyle,
    seedX: footprint.x,
    seedY: footprint.y,
  });
  const facing = resolveFootprintFacing(map, footprint);
  const shellX = worldX + 4;
  const shellY = worldY + 4;
  const shellWidth = Math.max(width - 8, 14);
  const shellHeight = Math.max(height - 8, 14);
  const cornerRadius =
    palette.profile === "repair-stall"
      ? 10
      : palette.profile === "freight-yard" || palette.profile === "warehouse"
        ? 9
        : 12;
  const facadeDepth = getKenneyFacadeDepth(
    palette.profile,
    facing,
    width,
    height,
  );
  const facadeRect = getFootprintBandRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    facing,
    facadeDepth,
  );
  const roofRect = getFootprintRoofRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    facing,
    facadeDepth,
  );
  const shellColor = blendColor(palette.base, 0xf1ebde, 0.38);
  const roofColor = blendColor(
    palette.roof,
    0xe7d7bf,
    palette.profile === "repair-stall" || palette.profile === "warehouse"
      ? 0.18
      : 0.24,
  );
  const trimColor = blendColor(palette.trim, 0xf8f0dd, 0.24);
  const outlineColor = blendColor(palette.outline, 0x0d1317, 0.08);
  const shadowColor = blendColor(palette.shadow, 0x06090b, 0.14);

  layer.fillStyle(0x000000, 0.14);
  layer.fillEllipse(
    worldX + width * 0.55,
    worldY + height - 4,
    Math.max(width - 14, 20),
    Math.max(12, height * 0.14),
  );
  layer.fillStyle(shellColor, 1);
  layer.fillRoundedRect(shellX, shellY, shellWidth, shellHeight, cornerRadius);
  layer.fillStyle(blendColor(shellColor, palette.window, 0.12), 1);
  layer.fillRoundedRect(
    facadeRect.x,
    facadeRect.y,
    facadeRect.width,
    facadeRect.height,
    Math.max(6, cornerRadius - 4),
  );
  layer.fillStyle(roofColor, 1);
  layer.fillRoundedRect(
    roofRect.x,
    roofRect.y,
    roofRect.width,
    roofRect.height,
    Math.max(6, cornerRadius - 3),
  );
  layer.fillStyle(trimColor, 0.96);
  drawFootprintParapet(layer, roofRect, facing);
  layer.lineStyle(2.6, outlineColor, 0.9);
  layer.strokeRoundedRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    cornerRadius,
  );
  layer.lineStyle(1.6, shadowColor, 0.3);
  drawRoofRhythm(layer, roofRect, facing, palette.profile);
  drawRoofClutter(layer, roofRect, facing, palette);
}

function getKenneyFacadeDepth(
  profile: ArchitecturalPalette["profile"],
  facing: FootprintFacing,
  width: number,
  height: number,
) {
  if (facing !== "north" && facing !== "south") {
    return clamp(width * 0.3, 10, 22);
  }

  switch (profile) {
    case "boarding-house":
      return clamp(height * 0.34, 28, 46);
    case "tea-house":
      return clamp(height * 0.42, 30, 52);
    case "repair-stall":
      return clamp(height * 0.44, 32, 54);
    case "freight-yard":
    case "warehouse":
      return clamp(height * 0.34, 26, 44);
    default:
      return clamp(height * 0.3, 24, 40);
  }
}

function drawKenneyOpenPlot(
  layer: PhaserType.GameObjects.Graphics,
  footprint: MapFootprint,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
) {
  const palette = footprintPalette({
    kind: footprint.kind,
    locationId: footprint.locationId,
    roofStyle: footprint.roofStyle,
    seedX: footprint.x,
    seedY: footprint.y,
  });
  const inset =
    footprint.kind === "dock" ? 4 : footprint.kind === "market" ? 7 : 6;
  const innerX = worldX + inset;
  const innerY = worldY + inset;
  const innerWidth = Math.max(width - inset * 2, 12);
  const innerHeight = Math.max(height - inset * 2, 12);
  const strokeColor =
    footprint.kind === "market"
      ? blendColor(palette.trim, 0xf4ead6, 0.26)
      : blendColor(palette.outline, 0x182026, 0.08);
  const fillColor =
    footprint.kind === "market"
      ? 0xe9dcc2
      : footprint.kind === "yard"
        ? blendColor(palette.base, 0xe4d1b2, 0.32)
        : blendColor(palette.base, 0xe5d1ac, 0.28);
  const fillAlpha =
    footprint.kind === "market"
      ? 0.18
      : footprint.kind === "yard"
        ? 0.09
        : 0.12;

  layer.fillStyle(fillColor, fillAlpha);
  layer.fillRoundedRect(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    footprint.kind === "dock" ? 8 : 12,
  );
  layer.lineStyle(2.4, strokeColor, footprint.kind === "market" ? 0.62 : 0.48);
  layer.strokeRoundedRect(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    footprint.kind === "dock" ? 8 : 12,
  );
  layer.lineStyle(1.2, blendColor(strokeColor, 0xffffff, 0.2), 0.2);
  layer.strokeRoundedRect(
    innerX + 6,
    innerY + 6,
    Math.max(innerWidth - 12, 8),
    Math.max(innerHeight - 12, 8),
    footprint.kind === "dock" ? 5 : 9,
  );

  if (footprint.kind === "dock") {
    layer.lineStyle(1.4, blendColor(palette.trim, 0xf8e5be, 0.22), 0.26);
    const plankCount = Math.max(2, Math.floor(innerWidth / 26));
    for (let plank = 1; plank < plankCount; plank += 1) {
      const plankX = innerX + (innerWidth * plank) / plankCount;
      layer.lineBetween(plankX, innerY + 3, plankX, innerY + innerHeight - 3);
    }
    return;
  }

  if (footprint.kind === "market") {
    layer.lineStyle(1.4, blendColor(strokeColor, 0xffffff, 0.18), 0.26);
    layer.lineBetween(
      innerX + innerWidth / 2,
      innerY + 10,
      innerX + innerWidth / 2,
      innerY + innerHeight - 10,
    );
    layer.lineBetween(
      innerX + 10,
      innerY + innerHeight / 2,
      innerX + innerWidth - 10,
      innerY + innerHeight / 2,
    );
    layer.fillStyle(0xc6b18a, 0.14);
    layer.fillCircle(
      innerX + innerWidth / 2,
      innerY + innerHeight / 2,
      Math.min(innerWidth, innerHeight) * 0.12,
    );
    return;
  }

  if (footprint.kind === "yard") {
    layer.lineStyle(1.4, blendColor(strokeColor, 0x5e4b35, 0.18), 0.22);
    layer.lineBetween(
      innerX + 10,
      innerY + 12,
      innerX + innerWidth - 12,
      innerY + 18,
    );
    layer.lineBetween(
      innerX + 12,
      innerY + innerHeight - 14,
      innerX + innerWidth - 10,
      innerY + innerHeight - 20,
    );
  }
}

function resolveFootprintFacing(
  map: CityMap,
  footprint: MapFootprint,
): FootprintFacing {
  const linkedDoor =
    (footprint.locationId
      ? map.doors.find((door) => door.locationId === footprint.locationId)
      : undefined) ??
    map.doors.find((door) => doorTouchesFootprint(door, footprint));

  if (linkedDoor) {
    return facingFromDoor(footprint, linkedDoor);
  }

  const walkableTiles = new Set(
    map.tiles
      .filter((tile) => tile.walkable)
      .map((tile) => `${tile.x},${tile.y}`),
  );
  const scores: Record<FootprintFacing, number> = {
    east: scoreFootprintAccessEdge(walkableTiles, footprint, "east"),
    north: scoreFootprintAccessEdge(walkableTiles, footprint, "north"),
    south: scoreFootprintAccessEdge(walkableTiles, footprint, "south"),
    west: scoreFootprintAccessEdge(walkableTiles, footprint, "west"),
  };
  const ranked = (
    Object.entries(scores) as Array<[FootprintFacing, number]>
  ).sort((left, right) => right[1] - left[1]);

  if (ranked[0]?.[1]) {
    return ranked[0][0];
  }

  if (footprint.height > footprint.width * 1.35) {
    return footprint.x < map.width / 2 ? "east" : "west";
  }

  return footprint.y < map.height / 2 ? "south" : "north";
}

function doorTouchesFootprint(door: MapDoor, footprint: MapFootprint) {
  return !(
    door.x + door.width < footprint.x - 0.35 ||
    door.x > footprint.x + footprint.width + 0.35 ||
    door.y + door.height < footprint.y - 0.35 ||
    door.y > footprint.y + footprint.height + 0.35
  );
}

function facingFromDoor(
  footprint: MapFootprint,
  door: MapDoor,
): FootprintFacing {
  const doorCenterX = door.x + door.width / 2;
  const doorCenterY = door.y + door.height / 2;
  const distances: Record<FootprintFacing, number> = {
    east: Math.abs(doorCenterX - (footprint.x + footprint.width)),
    north: Math.abs(doorCenterY - footprint.y),
    south: Math.abs(doorCenterY - (footprint.y + footprint.height)),
    west: Math.abs(doorCenterX - footprint.x),
  };

  return (
    (Object.entries(distances) as Array<[FootprintFacing, number]>).sort(
      (left, right) => left[1] - right[1],
    )[0]?.[0] ?? "south"
  );
}

function scoreFootprintAccessEdge(
  walkableTiles: Set<string>,
  footprint: MapFootprint,
  edge: FootprintFacing,
) {
  const sampleCount =
    edge === "north" || edge === "south"
      ? Math.max(2, Math.ceil(footprint.width * 2))
      : Math.max(2, Math.ceil(footprint.height * 2));
  let score = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = (index + 0.5) / sampleCount;
    const sampleTileX =
      edge === "north" || edge === "south"
        ? Math.floor(footprint.x + footprint.width * ratio)
        : edge === "east"
          ? Math.floor(footprint.x + footprint.width + 0.55)
          : Math.floor(footprint.x - 0.55);
    const sampleTileY =
      edge === "east" || edge === "west"
        ? Math.floor(footprint.y + footprint.height * ratio)
        : edge === "south"
          ? Math.floor(footprint.y + footprint.height + 0.55)
          : Math.floor(footprint.y - 0.55);

    if (walkableTiles.has(`${sampleTileX},${sampleTileY}`)) {
      score += 1;
    }
  }

  return score;
}

function getFootprintBandRect(
  x: number,
  y: number,
  width: number,
  height: number,
  facing: FootprintFacing,
  depth: number,
) {
  switch (facing) {
    case "north":
      return { height: depth, width, x, y };
    case "south":
      return { height: depth, width, x, y: y + height - depth };
    case "east":
      return { height, width: depth, x: x + width - depth, y };
    case "west":
      return { height, width: depth, x, y };
  }
}

function getFootprintRoofRect(
  x: number,
  y: number,
  width: number,
  height: number,
  facing: FootprintFacing,
  depth: number,
) {
  switch (facing) {
    case "north":
      return {
        height: Math.max(height - depth - 6, 12),
        width,
        x,
        y: y + depth + 2,
      };
    case "south":
      return { height: Math.max(height - depth - 6, 12), width, x, y };
    case "east":
      return { height, width: Math.max(width - depth - 6, 12), x, y };
    case "west":
      return {
        height,
        width: Math.max(width - depth - 6, 12),
        x: x + depth + 2,
        y,
      };
  }
}

function drawFootprintParapet(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
) {
  switch (facing) {
    case "north":
      layer.fillRoundedRect(
        roofRect.x + 4,
        roofRect.y,
        roofRect.width - 8,
        7,
        3,
      );
      return;
    case "south":
      layer.fillRoundedRect(
        roofRect.x + 4,
        roofRect.y + roofRect.height - 7,
        roofRect.width - 8,
        7,
        3,
      );
      return;
    case "east":
      layer.fillRoundedRect(
        roofRect.x + roofRect.width - 7,
        roofRect.y + 4,
        7,
        roofRect.height - 8,
        3,
      );
      return;
    case "west":
      layer.fillRoundedRect(
        roofRect.x,
        roofRect.y + 4,
        7,
        roofRect.height - 8,
        3,
      );
  }
}

function drawRoofRhythm(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
  profile: ArchitecturalPalette["profile"],
) {
  const seamCount =
    facing === "north" || facing === "south"
      ? Math.max(
          1,
          Math.floor(roofRect.width / (profile === "warehouse" ? 34 : 42)),
        )
      : Math.max(
          1,
          Math.floor(roofRect.height / (profile === "warehouse" ? 34 : 42)),
        );

  for (let seam = 1; seam < seamCount; seam += 1) {
    const ratio = seam / seamCount;
    if (facing === "north" || facing === "south") {
      const lineX = roofRect.x + roofRect.width * ratio;
      layer.lineBetween(
        lineX,
        roofRect.y + 6,
        lineX,
        roofRect.y + roofRect.height - 6,
      );
    } else {
      const lineY = roofRect.y + roofRect.height * ratio;
      layer.lineBetween(
        roofRect.x + 6,
        lineY,
        roofRect.x + roofRect.width - 6,
        lineY,
      );
    }
  }
}

function drawRoofClutter(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
  palette: ArchitecturalPalette,
) {
  const accent = blendColor(palette.trim, 0xf7ebd0, 0.14);
  const shadow = blendColor(palette.shadow, 0x06080a, 0.18);

  if (palette.profile === "boarding-house" || palette.profile === "rowhouse") {
    const dormerCount = Math.max(1, Math.floor(roofRect.width / 56));
    for (let dormer = 0; dormer < dormerCount; dormer += 1) {
      const centerX =
        roofRect.x + ((dormer + 1) * roofRect.width) / (dormerCount + 1);
      const dormerY =
        facing === "north"
          ? roofRect.y + roofRect.height - 18
          : roofRect.y + 10;
      layer.fillStyle(accent, 0.96);
      layer.fillRoundedRect(centerX - 8, dormerY, 16, 12, 3);
      layer.fillStyle(blendColor(palette.window, 0xffffff, 0.1), 0.88);
      layer.fillRoundedRect(centerX - 5, dormerY + 3, 10, 6, 2);
    }
    return;
  }

  if (palette.profile === "repair-stall") {
    layer.fillStyle(accent, 0.95);
    layer.fillRoundedRect(
      roofRect.x + 10,
      roofRect.y + 9,
      roofRect.width - 20,
      6,
      3,
    );
    return;
  }

  if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
    const ventWidth = Math.max(20, roofRect.width * 0.28);
    layer.fillStyle(accent, 0.96);
    layer.fillRoundedRect(
      roofRect.x + roofRect.width / 2 - ventWidth / 2,
      roofRect.y + roofRect.height / 2 - 7,
      ventWidth,
      14,
      4,
    );
    layer.fillStyle(shadow, 0.3);
    layer.fillRoundedRect(
      roofRect.x + roofRect.width / 2 - ventWidth / 2 + 2,
      roofRect.y + roofRect.height / 2 - 3,
      ventWidth - 4,
      4,
      2,
    );
    return;
  }

  layer.fillStyle(accent, 0.95);
  const chimneyX =
    facing === "west" ? roofRect.x + roofRect.width - 14 : roofRect.x + 10;
  const chimneyY =
    facing === "north" ? roofRect.y + roofRect.height - 24 : roofRect.y + 10;
  layer.fillRoundedRect(chimneyX, chimneyY, 10, 16, 2);
}

function drawArchitecturalMass(
  layer: PhaserType.GameObjects.Graphics,
  {
    height,
    kind,
    locationId,
    roofStyle,
    seedX,
    seedY,
    width,
    worldX,
    worldY,
  }: {
    height: number;
    kind: MapFootprint["kind"];
    locationId?: string;
    roofStyle?: RoofStyle;
    seedX: number;
    seedY: number;
    width: number;
    worldX: number;
    worldY: number;
  },
) {
  const palette = footprintPalette({
    kind,
    locationId,
    roofStyle,
    seedX,
    seedY,
  });
  const cornerRadius =
    kind === "building"
      ? palette.profile === "freight-yard" || palette.profile === "warehouse"
        ? 10
        : palette.profile === "repair-stall"
          ? 11
          : 13
      : kind === "dock" || kind === "yard"
        ? 10
        : 12;
  const roofInset =
    palette.profile === "repair-stall" || palette.profile === "warehouse"
      ? 6
      : Math.max(8, Math.min(width, height) * 0.08);
  const bodyTop = worldY + (kind === "building" ? 12 : 9);
  const bodyHeight = Math.max(height - 16, 18);

  layer.fillStyle(0x000000, 0.16);
  layer.fillEllipse(
    worldX + width * 0.55,
    worldY + height - 5,
    Math.max(width - 16, 20),
    Math.max(18, height * 0.22),
  );
  layer.fillStyle(palette.shadow, kind === "building" ? 0.28 : 0.22);
  layer.fillRoundedRect(
    worldX + width * 0.16,
    worldY + height - 4,
    width * 0.72,
    Math.max(10, height * 0.14),
    10,
  );
  layer.fillStyle(palette.base, 1);
  layer.fillRoundedRect(
    worldX + 4,
    bodyTop,
    width - 8,
    bodyHeight,
    cornerRadius,
  );
  layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.16), 1);
  layer.fillRoundedRect(
    worldX + 8,
    worldY + height - Math.max(16, height * 0.18),
    width - 16,
    Math.max(10, height * 0.12),
    Math.max(5, cornerRadius - 6),
  );

  if (kind === "building") {
    if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
      layer.fillStyle(palette.roof, 1);
      layer.fillRoundedRect(
        worldX + 6,
        worldY + 6,
        width - 12,
        Math.max(18, height - 22),
        10,
      );
      layer.fillStyle(palette.roofBand, 1);
      layer.fillRoundedRect(worldX + 10, worldY + 11, width - 20, 11, 4);
    } else {
      layer.fillStyle(palette.roof, 1);
      layer.fillRoundedRect(
        worldX + roofInset,
        worldY + 5,
        width - roofInset * 2,
        Math.max(height - 22, 18),
        Math.max(10, cornerRadius - 2),
      );
      layer.fillStyle(palette.roofBand, 1);
      layer.fillRoundedRect(
        worldX + roofInset + 4,
        worldY + 10,
        Math.max(width - roofInset * 2 - 8, 12),
        8,
        3,
      );
    }

    layer.fillStyle(palette.trim, 0.98);
    layer.fillRoundedRect(
      worldX + 10,
      worldY + height - Math.max(22, height * 0.22),
      width - 20,
      7,
      3,
    );
    layer.lineStyle(3, palette.outline, 0.84);
    layer.strokeRoundedRect(
      worldX + 4,
      worldY + 4,
      width - 8,
      height - 8,
      cornerRadius,
    );
    drawRoofSilhouette(layer, worldX, worldY, width, height, palette);

    if (palette.profile === "repair-stall") {
      layer.lineStyle(1.6, blendColor(palette.outline, 0x091015, 0.18), 0.36);
      for (let seam = 1; seam < 4; seam += 1) {
        const seamX = worldX + 10 + ((width - 20) * seam) / 4;
        layer.lineBetween(seamX, worldY + 10, seamX, worldY + height - 16);
      }
    }

    if (palette.profile === "moss-pier") {
      layer.fillStyle(blendColor(palette.base, 0x0b1014, 0.16), 1);
      layer.fillRoundedRect(worldX + 8, worldY + 20, width - 16, 5, 2);
      layer.fillRoundedRect(worldX + 8, worldY + 30, width - 16, 4, 2);
    }
  } else {
    layer.fillStyle(palette.roof, 0.98);
    layer.fillRoundedRect(
      worldX + 6,
      worldY + 6,
      width - 12,
      height - 12,
      cornerRadius - 4,
    );
    layer.lineStyle(2.5, palette.outline, 0.72);
    layer.strokeRoundedRect(
      worldX + 5,
      worldY + 5,
      width - 10,
      height - 10,
      cornerRadius - 2,
    );
  }

  return palette;
}

function drawFootprintSurfaceDetail(
  layer: PhaserType.GameObjects.Graphics,
  kind: MapFootprint["kind"],
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  switch (kind) {
    case "market":
      layer.lineStyle(2, palette.outline, 0.32);
      layer.strokeRoundedRect(
        worldX + 10,
        worldY + 10,
        width - 20,
        height - 20,
        12,
      );
      layer.lineBetween(
        worldX + 16,
        worldY + height / 2,
        worldX + width - 16,
        worldY + height / 2,
      );
      layer.lineBetween(
        worldX + width / 2,
        worldY + 16,
        worldX + width / 2,
        worldY + height - 16,
      );
      layer.fillStyle(blendColor(palette.base, 0xf4dfb8, 0.18), 0.9);
      layer.fillCircle(worldX + width / 2, worldY + height / 2, 15);
      layer.lineStyle(2, blendColor(palette.trim, 0xffffff, 0.16), 0.24);
      layer.strokeCircle(worldX + width / 2, worldY + height / 2, 15);
      break;
    case "yard":
      layer.lineStyle(2, blendColor(palette.trim, 0x201810, 0.22), 0.24);
      layer.lineBetween(
        worldX + 16,
        worldY + height - 18,
        worldX + width - 16,
        worldY + height - 28,
      );
      layer.lineBetween(
        worldX + 22,
        worldY + 20,
        worldX + width - 20,
        worldY + 28,
      );
      layer.fillStyle(blendColor(palette.base, 0x3a2d20, 0.18), 0.58);
      layer.fillRoundedRect(worldX + 18, worldY + 16, 18, 10, 3);
      layer.fillRoundedRect(
        worldX + width - 40,
        worldY + height - 28,
        20,
        11,
        3,
      );
      break;
    case "dock":
      layer.fillStyle(blendColor(palette.shadow, 0x090b0d, 0.18), 0.45);
      layer.fillRoundedRect(worldX + 6, worldY + height - 16, width - 12, 8, 3);
      layer.lineStyle(2, blendColor(palette.outline, 0xf7ead2, 0.08), 0.24);
      layer.lineBetween(
        worldX + 12,
        worldY + 18,
        worldX + width - 12,
        worldY + 18,
      );
      layer.lineBetween(
        worldX + 12,
        worldY + height - 24,
        worldX + width - 12,
        worldY + height - 24,
      );
      break;
    case "garden":
      layer.lineStyle(2, palette.outline, 0.22);
      layer.strokeRoundedRect(
        worldX + 10,
        worldY + 10,
        width - 20,
        height - 20,
        12,
      );
      layer.fillStyle(blendColor(palette.base, 0x9ec07e, 0.22), 0.58);
      layer.fillEllipse(worldX + width * 0.28, worldY + height * 0.54, 42, 18);
      layer.fillEllipse(worldX + width * 0.7, worldY + height * 0.48, 36, 16);
      break;
    case "water":
      layer.lineStyle(2, blendColor(palette.window, 0xffffff, 0.08), 0.24);
      layer.lineBetween(
        worldX + 10,
        worldY + 16,
        worldX + width - 10,
        worldY + 10,
      );
      layer.lineBetween(
        worldX + 12,
        worldY + height - 14,
        worldX + width - 14,
        worldY + height - 18,
      );
      layer.fillStyle(blendColor(palette.base, 0x0d2030, 0.18), 0.52);
      layer.fillEllipse(worldX + width * 0.3, worldY + height * 0.64, 44, 10);
      layer.fillEllipse(worldX + width * 0.75, worldY + height * 0.34, 34, 8);
      break;
    default:
      break;
  }
}

function footprintPalette({
  kind,
  locationId,
  roofStyle,
  seedX,
  seedY,
}: {
  kind: MapFootprint["kind"];
  locationId?: string;
  roofStyle?: RoofStyle;
  seedX: number;
  seedY: number;
}): ArchitecturalPalette {
  if (kind === "building") {
    return buildingPaletteForProfile(
      resolveBuildingProfile(locationId, roofStyle, seedX, seedY),
    );
  }

  switch (kind) {
    case "dock":
      return {
        awning: 0xce9968,
        base: 0x8f6b47,
        outline: 0xe0c49a,
        profile: "moss-pier",
        roof: 0x6c4f34,
        roofBand: 0xb98a59,
        shadow: 0x18120d,
        sign: 0xceb183,
        trim: 0xb78558,
        window: 0xf1d7aa,
      };
    case "garden":
      return {
        awning: 0x9ac082,
        base: 0x486846,
        outline: 0xb7d29f,
        profile: "rowhouse",
        roof: 0x355239,
        roofBand: 0x628b59,
        shadow: 0x101710,
        sign: 0x8fba77,
        trim: 0x7ca06d,
        window: 0xe7efc8,
      };
    case "market":
      return {
        awning: 0xc1835b,
        base: 0x7d6149,
        outline: 0xe0c197,
        profile: "tea-house",
        roof: 0x5e432d,
        roofBand: 0xa16f46,
        shadow: 0x15100d,
        sign: 0xd9b47d,
        trim: 0xcf9b63,
        window: 0xf2d3a0,
      };
    case "water":
      return {
        awning: 0x77bfd6,
        base: 0x2d5a72,
        outline: 0xa6d4e3,
        profile: "moss-pier",
        roof: 0x214758,
        roofBand: 0x5fa0b7,
        shadow: 0x0d1f2b,
        sign: 0xaad7e7,
        trim: 0x76b8cf,
        window: 0xe7f8fc,
      };
    case "yard":
      return {
        awning: 0xc99662,
        base: 0x73614d,
        outline: 0xd6b98b,
        profile: "freight-yard",
        roof: 0x594632,
        roofBand: 0xa87d48,
        shadow: 0x16110d,
        sign: 0xcfb17c,
        trim: 0xbd905a,
        window: 0xf1d3a2,
      };
    default:
      return buildingPaletteForProfile(
        resolveBuildingProfile(locationId, roofStyle, seedX, seedY),
      );
  }
}

function drawBuildingDetail(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const profile = palette.profile;
  const seedX = Math.round(worldX / CELL);
  const seedY = Math.round(worldY / CELL);
  const windowColumns =
    profile === "freight-yard" || profile === "warehouse"
      ? Math.max(2, Math.floor(width / 48))
      : Math.max(2, Math.floor(width / 38));
  const windowRows =
    profile === "boarding-house"
      ? Math.max(2, Math.floor((height - 42) / 22))
      : 1;
  const storefrontHeight = Math.min(32, Math.max(18, height * 0.22));
  const upperTop = worldY + 24;
  const upperBottom = worldY + height - storefrontHeight - 16;
  const bayCount =
    profile === "freight-yard" || profile === "warehouse"
      ? Math.max(2, Math.floor(width / 56))
      : Math.max(2, Math.floor(width / 46));

  layer.fillStyle(palette.trim, 0.98);
  layer.fillRoundedRect(worldX + 10, worldY + 20, width - 20, 7, 6);
  layer.fillStyle(blendColor(palette.base, 0x11161b, 0.22), 1);
  layer.fillRoundedRect(
    worldX + 8,
    worldY + height - storefrontHeight - 8,
    width - 16,
    storefrontHeight,
    6,
  );
  drawFacadeRhythm(
    layer,
    worldX,
    upperTop,
    upperBottom,
    width,
    bayCount,
    palette,
  );

  const span = width - 32;
  for (let row = 0; row < windowRows; row += 1) {
    for (let column = 0; column < windowColumns; column += 1) {
      const windowX = worldX + 16 + column * (span / windowColumns);
      const windowY = upperTop + row * 19;
      if (windowY + 10 >= upperBottom) {
        continue;
      }
      const lit = sampleTileNoise(column + seedX, row + seedY, 113) > 0.42;
      layer.fillStyle(
        lit ? palette.window : blendColor(palette.base, 0x20303a, 0.42),
        0.96,
      );
      layer.fillRoundedRect(windowX, windowY, 11, 10, 2);
      layer.fillStyle(
        blendColor(0xffffff, palette.window, 0.25),
        lit ? 0.22 : 0.08,
      );
      layer.fillRoundedRect(windowX + 1, windowY + 1, 9, 2.5, 1);
      layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.22), 0.34);
      layer.fillRect(windowX, windowY + 10, 11, 1.5);
    }
  }

  if (profile === "boarding-house") {
    const chimneyCount = width > CELL * 3 ? 2 : 1;
    for (let index = 0; index < chimneyCount; index += 1) {
      const chimneyX = worldX + 18 + index * (width - 44);
      const chimneyY = worldY + 6 + (index % 2) * 2;
      layer.fillStyle(blendColor(palette.roof, 0x0b1115, 0.1), 1);
      layer.fillRoundedRect(chimneyX, chimneyY, 9, 15, 2);
      layer.fillStyle(palette.trim, 0.92);
      layer.fillRoundedRect(chimneyX + 1, chimneyY, 7, 3, 1);
    }
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(
      worldX + width / 2 - 24,
      worldY + height - 20,
      48,
      7,
      3,
    );
    drawDoorPair(
      layer,
      worldX + width * 0.28,
      worldY + height - 17,
      palette,
      0.92,
    );
    drawDoorPair(
      layer,
      worldX + width * 0.64,
      worldY + height - 17,
      palette,
      0.92,
    );
  }

  if (profile === "tea-house") {
    const canopyX = worldX + width / 2 - 24;
    const canopyY = worldY + height - 30;
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + 14, worldY + 10, 44, 12, 4);
    layer.fillStyle(palette.awning, 1);
    layer.fillTriangle(
      canopyX + 3,
      canopyY + 7,
      canopyX + 45,
      canopyY + 7,
      canopyX + 24,
      canopyY + 18,
    );
    layer.fillStyle(blendColor(palette.awning, 0xffffff, 0.18), 1);
    layer.fillRoundedRect(canopyX + 4, canopyY, 40, 7, 3);
    layer.fillStyle(blendColor(palette.sign, 0x0d1216, 0.08), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 32,
      worldY + height - 18,
      64,
      10,
      4,
    );
    layer.fillStyle(palette.window, 0.88);
    layer.fillCircle(worldX + 16, worldY + height - 16, 2.6);
    layer.fillCircle(worldX + width - 16, worldY + height - 16, 2.6);
  }

  if (profile === "repair-stall") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + width - 54, worldY + height - 24, 44, 15, 4);
    layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.3), 1);
    layer.fillRoundedRect(worldX + 10, worldY + height - 25, width - 64, 16, 3);
    layer.lineStyle(2, blendColor(palette.outline, 0x0b1014, 0.16), 0.4);
    layer.lineBetween(
      worldX + 10,
      worldY + height - 9,
      worldX + width - 10,
      worldY + height - 9,
    );
    layer.lineStyle(2.4, palette.awning, 0.9);
    layer.lineBetween(
      worldX + 8,
      worldY + 18,
      worldX + width - 10,
      worldY + 22,
    );
  }

  if (profile === "freight-yard" || profile === "warehouse") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + width / 2 - 28, worldY + 12, 56, 10, 4);
    layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.34), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 26,
      worldY + height - 30,
      52,
      20,
      4,
    );
    for (let index = 0; index < 4; index += 1) {
      const clerestoryX = worldX + 14 + index * ((width - 28) / 4);
      layer.fillStyle(palette.window, 0.9);
      layer.fillRoundedRect(clerestoryX, worldY + 26, 10, 6, 2);
    }
    layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.14), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 18,
      worldY + height - 26,
      36,
      16,
      3,
    );
  }

  if (profile === "moss-pier") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + 12, worldY + 12, 50, 10, 4);
    layer.lineStyle(2, blendColor(palette.outline, 0x0a1014, 0.14), 0.32);
    for (let slat = 0; slat < 4; slat += 1) {
      const slatY = worldY + 22 + slat * 10;
      layer.lineBetween(worldX + 12, slatY, worldX + width - 12, slatY);
    }
    layer.fillStyle(blendColor(palette.shadow, 0x06090c, 0.08), 1);
    layer.fillRoundedRect(worldX + 12, worldY + height - 24, width - 24, 12, 3);
    layer.fillStyle(palette.awning, 0.98);
    layer.fillTriangle(
      worldX + width * 0.24,
      worldY + height - 23,
      worldX + width * 0.78,
      worldY + height - 23,
      worldX + width * 0.51,
      worldY + height - 11,
    );
  }

  if (profile === "rowhouse") {
    const dormerCount = Math.max(1, Math.floor(width / 92));
    for (let dormer = 0; dormer < dormerCount; dormer += 1) {
      const ratio = (dormer + 1) / (dormerCount + 1);
      const dormerX = worldX + width * ratio - 7;
      layer.fillStyle(palette.sign, 0.96);
      layer.fillRoundedRect(dormerX, worldY + 15 + (dormer % 2) * 2, 14, 9, 3);
      layer.fillStyle(palette.window, 0.86);
      layer.fillRoundedRect(
        dormerX + 3,
        worldY + 18 + (dormer % 2) * 2,
        8,
        4,
        2,
      );
    }
    if (width > CELL * 2.1) {
      const awningWidth = Math.min(34, width * 0.24);
      layer.fillStyle(palette.awning, 1);
      layer.fillTriangle(
        worldX + width * 0.22,
        worldY + height - 19,
        worldX + width * 0.22 + awningWidth,
        worldY + height - 19,
        worldX + width * 0.22 + awningWidth / 2,
        worldY + height - 10,
      );
      layer.fillTriangle(
        worldX + width * 0.58,
        worldY + height - 19,
        worldX + width * 0.58 + awningWidth,
        worldY + height - 19,
        worldX + width * 0.58 + awningWidth / 2,
        worldY + height - 10,
      );
    }
  }

  layer.fillStyle(palette.trim, 0.98);
  layer.fillRoundedRect(
    worldX + 12,
    worldY + height - storefrontHeight + 2,
    width - 24,
    5,
    2,
  );
}

function drawRoofSilhouette(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  _height: number,
  palette: ArchitecturalPalette,
) {
  const roofY = worldY + 7;

  if (palette.profile === "boarding-house" || palette.profile === "rowhouse") {
    const gableCount = Math.max(2, Math.floor(width / 52));
    for (let index = 0; index < gableCount; index += 1) {
      const ratio = (index + 0.5) / gableCount;
      const centerX = worldX + width * ratio;
      const gableWidth = Math.min(34, width / gableCount - 8);
      const peakY = roofY - 8 - (index % 2) * 3;
      layer.fillStyle(palette.roofBand, 0.98);
      layer.fillTriangle(
        centerX - gableWidth / 2,
        roofY + 10,
        centerX + gableWidth / 2,
        roofY + 10,
        centerX,
        peakY,
      );
      layer.lineStyle(1.4, blendColor(palette.outline, 0x0a1014, 0.12), 0.28);
      layer.lineBetween(centerX, peakY + 1, centerX, roofY + 8);
    }
    return;
  }

  if (palette.profile === "tea-house") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillTriangle(
      worldX + 18,
      roofY + 10,
      worldX + width - 18,
      roofY + 10,
      worldX + width / 2,
      roofY - 7,
    );
    return;
  }

  if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
    const clerestoryWidth = Math.max(32, width * 0.34);
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillRoundedRect(
      worldX + width / 2 - clerestoryWidth / 2,
      roofY - 4,
      clerestoryWidth,
      11,
      4,
    );
    layer.fillTriangle(
      worldX + width / 2 - clerestoryWidth / 2,
      roofY + 7,
      worldX + width / 2 + clerestoryWidth / 2,
      roofY + 7,
      worldX + width / 2,
      roofY - 8,
    );
    return;
  }

  if (palette.profile === "repair-stall") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillTriangle(
      worldX + 12,
      roofY + 10,
      worldX + width - 10,
      roofY + 16,
      worldX + width - 16,
      roofY - 2,
    );
    return;
  }

  if (palette.profile === "moss-pier") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillRoundedRect(worldX + 12, roofY + 3, width - 24, 8, 4);
  }
}

function drawFacadeRhythm(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  upperTop: number,
  upperBottom: number,
  width: number,
  bayCount: number,
  palette: ArchitecturalPalette,
) {
  for (let bay = 1; bay < bayCount; bay += 1) {
    const dividerX = worldX + (width * bay) / bayCount;
    layer.fillStyle(blendColor(palette.trim, palette.shadow, 0.26), 0.68);
    layer.fillRoundedRect(
      dividerX - 1.5,
      upperTop - 4,
      3,
      upperBottom - upperTop + 14,
      2,
    );
    layer.fillStyle(blendColor(palette.window, 0xffffff, 0.12), 0.12);
    layer.fillRoundedRect(
      dividerX - 0.5,
      upperTop - 2,
      1,
      upperBottom - upperTop + 8,
      1,
    );
  }
}

function drawDoorPair(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  baselineY: number,
  palette: ArchitecturalPalette,
  alpha: number,
) {
  layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.1), alpha);
  layer.fillRoundedRect(centerX - 10, baselineY - 8, 20, 12, 3);
  layer.fillStyle(blendColor(palette.sign, 0x2c2018, 0.18), alpha);
  layer.fillRoundedRect(centerX - 8, baselineY - 7, 7, 10, 2);
  layer.fillRoundedRect(centerX + 1, baselineY - 7, 7, 10, 2);
}

function resolveBuildingProfile(
  locationId: string | undefined,
  roofStyle: RoofStyle | undefined,
  seedX: number,
  seedY: number,
): ArchitecturalPalette["profile"] {
  switch (locationId) {
    case "boarding-house":
      return "boarding-house";
    case "tea-house":
      return "tea-house";
    case "repair-stall":
      return "repair-stall";
    case "freight-yard":
      return "freight-yard";
    case "moss-pier":
      return "moss-pier";
    default:
      break;
  }

  if (roofStyle === "tin") {
    return "repair-stall";
  }

  if (roofStyle === "timber") {
    return "moss-pier";
  }

  if (roofStyle === "plaster") {
    return "tea-house";
  }

  return sampleTileNoise(seedX, seedY, 887) > 0.68 ? "warehouse" : "rowhouse";
}

function buildingPaletteForProfile(
  profile: ArchitecturalPalette["profile"],
): ArchitecturalPalette {
  switch (profile) {
    case "boarding-house":
      return {
        awning: 0xc3a383,
        base: 0x61707b,
        outline: 0xe2ddd0,
        profile,
        roof: 0x36434d,
        roofBand: 0x4d5b65,
        shadow: 0x131c23,
        sign: 0xcab394,
        trim: 0xa88c6f,
        window: 0xf2ddb2,
      };
    case "tea-house":
      return {
        awning: 0x8c5442,
        base: 0x7f654d,
        outline: 0xe6cda3,
        profile,
        roof: 0x5a4331,
        roofBand: 0xa46f47,
        shadow: 0x16100d,
        sign: 0xd9b27d,
        trim: 0xc6905d,
        window: 0xf4d7a6,
      };
    case "repair-stall":
      return {
        awning: 0x7c9098,
        base: 0x687984,
        outline: 0xd7e1e4,
        profile,
        roof: 0x4e5d67,
        roofBand: 0x90a4ad,
        shadow: 0x121920,
        sign: 0xb6c6cd,
        trim: 0x8ea3ac,
        window: 0xe7f3f6,
      };
    case "freight-yard":
      return {
        awning: 0xc38e4f,
        base: 0x80684d,
        outline: 0xe1c18d,
        profile,
        roof: 0x62503b,
        roofBand: 0xaf7d44,
        shadow: 0x18120d,
        sign: 0xd0ae76,
        trim: 0xbf8d55,
        window: 0xf0d2a2,
      };
    case "moss-pier":
      return {
        awning: 0xc7925d,
        base: 0x7a5a40,
        outline: 0xe2c497,
        profile,
        roof: 0x5a412d,
        roofBand: 0xb27f4f,
        shadow: 0x16100b,
        sign: 0xd8b17d,
        trim: 0xbf8856,
        window: 0xf1d8aa,
      };
    case "warehouse":
      return {
        awning: 0xb98854,
        base: 0x6d604d,
        outline: 0xd7c3a2,
        profile,
        roof: 0x514636,
        roofBand: 0x8c7254,
        shadow: 0x16130f,
        sign: 0xcab087,
        trim: 0xb69068,
        window: 0xeed9b3,
      };
    case "rowhouse":
    default:
      return {
        awning: 0xb98b63,
        base: 0x536978,
        outline: 0xd5d8cf,
        profile: "rowhouse",
        roof: 0x33424d,
        roofBand: 0x516372,
        shadow: 0x121a21,
        sign: 0xc9b08a,
        trim: 0xac8c69,
        window: 0xf0dcaf,
      };
  }
}

function drawDoors(layer: PhaserType.GameObjects.Graphics, doors: MapDoor[]) {
  for (const door of doors) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(door.x, door.y);
    const width = Math.max(door.width * CELL, 12);
    const height = Math.max(door.height * CELL, 12);

    layer.fillStyle(0x000000, 0.12);
    layer.fillRoundedRect(worldX + 2, worldY + height - 5, width - 4, 6, 3);
    layer.fillStyle(0x33261d, 0.9);
    layer.fillRoundedRect(worldX + 1, worldY + 1, width - 2, height - 2, 7);
    layer.fillStyle(0xe9ba78, 0.94);
    layer.fillRoundedRect(worldX + 3, worldY + 3, width - 6, height - 6, 6);
    layer.fillStyle(0xf7ddb0, 0.22);
    layer.fillRoundedRect(worldX + 5, worldY + 4, width - 10, 3, 2);
    layer.fillStyle(0x1f1511, 0.28);
    layer.fillRoundedRect(worldX + width * 0.52, worldY + 6, 2, height - 12, 1);
    layer.fillStyle(0x22160f, 0.26);
    layer.fillRoundedRect(worldX + 4, worldY + height - 8, width - 8, 4, 2);
    layer.fillStyle(0xfbe7bd, 0.1);
    layer.fillCircle(worldX + width - 7, worldY + height / 2 + 1, 1.4);
  }
}

function drawProps(layer: PhaserType.GameObjects.Graphics, props: MapProp[]) {
  for (const prop of props) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(prop.x, prop.y);
    const scale = prop.scale ?? 1;
    const vertical = Math.abs(prop.rotation ?? 0) >= 45;

    switch (prop.kind) {
      case "boat":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          (vertical ? 16 : 26) * scale,
          (vertical ? 26 : 11) * scale,
        );
        layer.fillStyle(0x5b4333, 0.98);
        if (vertical) {
          layer.fillEllipse(worldX, worldY, 14 * scale, 30 * scale);
          layer.fillStyle(0xd8c3a3, 0.92);
          layer.fillRoundedRect(
            worldX - 4 * scale,
            worldY - 9 * scale,
            8 * scale,
            14 * scale,
            3,
          );
          layer.lineStyle(1.5, 0xe8dec7, 0.42);
          layer.lineBetween(
            worldX,
            worldY - 16 * scale,
            worldX,
            worldY + 10 * scale,
          );
        } else {
          layer.fillEllipse(worldX, worldY, 30 * scale, 14 * scale);
          layer.fillStyle(0xd8c3a3, 0.92);
          layer.fillRoundedRect(
            worldX - 9 * scale,
            worldY - 4 * scale,
            14 * scale,
            8 * scale,
            3,
          );
          layer.lineStyle(1.5, 0xe8dec7, 0.42);
          layer.lineBetween(
            worldX - 14 * scale,
            worldY,
            worldX + 11 * scale,
            worldY,
          );
        }
        layer.fillStyle(0x7eaec4, 0.28);
        layer.fillEllipse(
          worldX - 1 * scale,
          worldY - 1 * scale,
          10 * scale,
          4 * scale,
        );
        break;
      case "fountain":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          28 * scale,
          12 * scale,
        );
        layer.fillStyle(0x51616c, 0.98);
        layer.fillCircle(worldX, worldY + 1 * scale, 10 * scale);
        layer.fillStyle(0xb6c7cf, 0.26);
        layer.fillCircle(worldX, worldY - 1 * scale, 7.5 * scale);
        layer.fillStyle(0x73858f, 0.98);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY - 10 * scale,
          6 * scale,
          11 * scale,
          2,
        );
        layer.fillStyle(0x9fd5e3, 0.82);
        layer.fillCircle(worldX, worldY - 10 * scale, 3.2 * scale);
        layer.lineStyle(1.4, 0xcfeef6, 0.46);
        layer.lineBetween(
          worldX,
          worldY - 12 * scale,
          worldX,
          worldY - 19 * scale,
        );
        layer.lineBetween(
          worldX - 2 * scale,
          worldY - 11 * scale,
          worldX - 5 * scale,
          worldY - 16 * scale,
        );
        layer.lineBetween(
          worldX + 2 * scale,
          worldY - 11 * scale,
          worldX + 5 * scale,
          worldY - 16 * scale,
        );
        break;
      case "planter":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 1 * scale,
          worldY + 7 * scale,
          18 * scale,
          8 * scale,
        );
        layer.fillStyle(0x7a6046, 0.96);
        layer.fillRoundedRect(
          worldX - 7 * scale,
          worldY - 2 * scale,
          14 * scale,
          8 * scale,
          3,
        );
        layer.fillStyle(0x2f5a3e, 0.98);
        layer.fillCircle(worldX - 4 * scale, worldY - 4 * scale, 4 * scale);
        layer.fillCircle(worldX + 2 * scale, worldY - 5 * scale, 4.4 * scale);
        layer.fillCircle(worldX + 6 * scale, worldY - 2 * scale, 3.2 * scale);
        layer.fillStyle(0x8db97a, 0.2);
        layer.fillCircle(worldX + 1 * scale, worldY - 7 * scale, 3.3 * scale);
        break;
      case "tree":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 1 * scale,
          worldY + 6 * scale,
          24 * scale,
          12 * scale,
        );
        layer.fillStyle(0x203528, 1);
        layer.fillCircle(worldX - 8 * scale, worldY - 6 * scale, 8 * scale);
        layer.fillCircle(worldX + 7 * scale, worldY - 7 * scale, 9 * scale);
        layer.fillStyle(0x48754e, 1);
        layer.fillCircle(worldX, worldY - 12 * scale, 12 * scale);
        layer.fillCircle(worldX - 10 * scale, worldY, 7 * scale);
        layer.fillCircle(worldX + 10 * scale, worldY - 1 * scale, 6.5 * scale);
        layer.fillStyle(0xa6cc86, 0.28);
        layer.fillCircle(worldX - 2 * scale, worldY - 15 * scale, 4 * scale);
        layer.lineStyle(1.6, 0x112017, 0.42);
        layer.strokeCircle(worldX, worldY - 12 * scale, 12 * scale);
        layer.fillStyle(0x74553c, 1);
        layer.fillRoundedRect(
          worldX - 2.5 * scale,
          worldY - 2 * scale,
          5 * scale,
          12 * scale,
          2,
        );
        break;
      case "lamp":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 9 * scale,
          14 * scale,
          7 * scale,
        );
        layer.fillStyle(0x26333b, 0.98);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY + 7 * scale,
          6 * scale,
          4 * scale,
          2,
        );
        layer.fillRoundedRect(
          worldX - 1.4 * scale,
          worldY - 11 * scale,
          2.8 * scale,
          20 * scale,
          1.4,
        );
        layer.lineStyle(2 * scale, 0x26333b, 0.98);
        layer.lineBetween(
          worldX,
          worldY - 10 * scale,
          worldX + 5.5 * scale,
          worldY - 14 * scale,
        );
        layer.lineBetween(
          worldX + 5.5 * scale,
          worldY - 14 * scale,
          worldX + 5.5 * scale,
          worldY - 16 * scale,
        );
        layer.fillStyle(0x1a2329, 0.98);
        layer.fillRoundedRect(
          worldX + 1.5 * scale,
          worldY - 20 * scale,
          8 * scale,
          10 * scale,
          2,
        );
        layer.fillStyle(0xf8e3b0, 0.28);
        layer.fillCircle(
          worldX + 5.5 * scale,
          worldY - 14.5 * scale,
          7 * scale,
        );
        layer.fillStyle(0xf8e3b0, 0.94);
        layer.fillRoundedRect(
          worldX + 3 * scale,
          worldY - 18 * scale,
          5 * scale,
          6 * scale,
          1.5,
        );
        layer.fillStyle(0xcfb981, 0.96);
        layer.fillRoundedRect(
          worldX + 4 * scale,
          worldY - 22 * scale,
          3 * scale,
          2 * scale,
          1,
        );
        break;
      case "cart":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          24 * scale,
          10 * scale,
        );
        layer.fillStyle(0x8f6c4d, 1);
        if (vertical) {
          layer.fillRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            20 * scale,
            5,
          );
          layer.fillStyle(0xd8b08a, 0.34);
          layer.fillRoundedRect(
            worldX - 5 * scale,
            worldY - 8 * scale,
            10 * scale,
            4 * scale,
            3,
          );
          layer.lineStyle(1.5, 0x3e2f22, 0.34);
          layer.lineBetween(
            worldX - 4 * scale,
            worldY - 5 * scale,
            worldX + 4 * scale,
            worldY - 5 * scale,
          );
          layer.fillStyle(0x2a343c, 0.92);
          layer.fillCircle(worldX - 6 * scale, worldY + 9 * scale, 3 * scale);
          layer.fillCircle(worldX + 6 * scale, worldY + 9 * scale, 3 * scale);
          layer.lineStyle(1.2, 0xd7b78d, 0.3);
          layer.strokeRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            20 * scale,
            5,
          );
        } else {
          layer.fillRoundedRect(
            worldX - 10 * scale,
            worldY - 6 * scale,
            20 * scale,
            12 * scale,
            5,
          );
          layer.fillStyle(0xd8b08a, 0.34);
          layer.fillRoundedRect(
            worldX - 8 * scale,
            worldY - 5 * scale,
            16 * scale,
            4 * scale,
            3,
          );
          layer.lineStyle(1.5, 0x3e2f22, 0.34);
          layer.lineBetween(
            worldX - 7 * scale,
            worldY - 1 * scale,
            worldX + 7 * scale,
            worldY - 1 * scale,
          );
          layer.fillStyle(0x2a343c, 0.92);
          layer.fillCircle(worldX - 7 * scale, worldY + 8 * scale, 3 * scale);
          layer.fillCircle(worldX + 7 * scale, worldY + 8 * scale, 3 * scale);
          layer.lineStyle(1.2, 0xd7b78d, 0.3);
          layer.strokeRoundedRect(
            worldX - 10 * scale,
            worldY - 6 * scale,
            20 * scale,
            12 * scale,
            5,
          );
        }
        break;
      case "laundry":
        layer.lineStyle(2 * scale, 0xe8ddca, 0.8);
        if (vertical) {
          layer.lineBetween(
            worldX - 8 * scale,
            worldY - 12 * scale,
            worldX - 8 * scale,
            worldY + 12 * scale,
          );
          layer.fillStyle(0xc89c79, 0.92);
          layer.fillRect(
            worldX - 10 * scale,
            worldY - 9 * scale,
            9 * scale,
            5 * scale,
          );
          layer.fillStyle(0x7fa7bf, 0.9);
          layer.fillRect(
            worldX - 10 * scale,
            worldY - 1 * scale,
            10 * scale,
            5 * scale,
          );
        } else {
          layer.lineBetween(
            worldX - 12 * scale,
            worldY - 8 * scale,
            worldX + 12 * scale,
            worldY - 8 * scale,
          );
          layer.fillStyle(0xc89c79, 0.92);
          layer.fillRect(
            worldX - 9 * scale,
            worldY - 6 * scale,
            5 * scale,
            9 * scale,
          );
          layer.fillStyle(0x7fa7bf, 0.9);
          layer.fillRect(
            worldX - 1 * scale,
            worldY - 6 * scale,
            5 * scale,
            10 * scale,
          );
        }
        break;
      case "crate":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 16 * scale, 7 * scale);
        layer.fillStyle(0x8c6849, 0.95);
        layer.fillRoundedRect(
          worldX - 6 * scale,
          worldY - 6 * scale,
          12 * scale,
          12 * scale,
          2.5,
        );
        layer.lineStyle(1, 0xd6bb95, 0.18);
        layer.strokeRoundedRect(
          worldX - 6 * scale,
          worldY - 6 * scale,
          12 * scale,
          12 * scale,
          2.5,
        );
        layer.lineBetween(
          worldX - 4 * scale,
          worldY - 3 * scale,
          worldX + 4 * scale,
          worldY + 3 * scale,
        );
        layer.lineBetween(
          worldX + 4 * scale,
          worldY - 3 * scale,
          worldX - 4 * scale,
          worldY + 3 * scale,
        );
        break;
      case "barrel":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 15 * scale, 7 * scale);
        layer.fillStyle(0x73553c, 0.95);
        layer.fillEllipse(worldX, worldY - 4 * scale, 11 * scale, 4.5 * scale);
        layer.fillRoundedRect(
          worldX - 5.5 * scale,
          worldY - 4 * scale,
          11 * scale,
          12 * scale,
          4,
        );
        layer.lineStyle(1.2, 0x2f241c, 0.28);
        layer.lineBetween(
          worldX - 4.5 * scale,
          worldY - 1 * scale,
          worldX + 4.5 * scale,
          worldY - 1 * scale,
        );
        layer.lineBetween(
          worldX - 4.5 * scale,
          worldY + 4 * scale,
          worldX + 4.5 * scale,
          worldY + 4 * scale,
        );
        layer.fillStyle(0xd5b48d, 0.12);
        layer.fillEllipse(worldX, worldY - 4 * scale, 8 * scale, 2.6 * scale);
        break;
      case "bench":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 1,
          worldY + 7,
          (vertical ? 10 : 18) * scale,
          (vertical ? 18 : 10) * scale,
        );
        layer.fillStyle(0x88684a, 0.94);
        if (vertical) {
          layer.fillRoundedRect(
            worldX - 3 * scale,
            worldY - 8 * scale,
            6 * scale,
            16 * scale,
            2,
          );
          layer.fillRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            3 * scale,
            2,
          );
          layer.fillStyle(0x2c2118, 0.3);
          layer.fillRect(
            worldX - 4 * scale,
            worldY + 8 * scale,
            2 * scale,
            5 * scale,
          );
          layer.fillRect(
            worldX + 2 * scale,
            worldY + 8 * scale,
            2 * scale,
            5 * scale,
          );
        } else {
          layer.fillRoundedRect(
            worldX - 8 * scale,
            worldY - 3 * scale,
            16 * scale,
            6 * scale,
            2,
          );
          layer.fillRoundedRect(
            worldX - 10 * scale,
            worldY - 7 * scale,
            20 * scale,
            3 * scale,
            2,
          );
          layer.fillStyle(0x2c2118, 0.3);
          layer.fillRect(
            worldX - 6 * scale,
            worldY + 3 * scale,
            2 * scale,
            5 * scale,
          );
          layer.fillRect(
            worldX + 4 * scale,
            worldY + 3 * scale,
            2 * scale,
            5 * scale,
          );
        }
        break;
      case "canopy":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 2, worldY + 10, 28 * scale, 10 * scale);
        layer.lineStyle(2, 0x6f563f, 0.72);
        layer.lineBetween(
          worldX - 10 * scale,
          worldY + 8 * scale,
          worldX - 10 * scale,
          worldY - 4 * scale,
        );
        layer.lineBetween(
          worldX + 10 * scale,
          worldY + 8 * scale,
          worldX + 10 * scale,
          worldY - 4 * scale,
        );
        layer.fillStyle(0xddba8d, 1);
        layer.fillRoundedRect(
          worldX - 12 * scale,
          worldY - 7 * scale,
          24 * scale,
          6 * scale,
          3,
        );
        layer.fillStyle(0x8f5a45, 1);
        layer.fillTriangle(
          worldX - 12 * scale,
          worldY - 1 * scale,
          worldX + 12 * scale,
          worldY - 1 * scale,
          worldX,
          worldY + 7 * scale,
        );
        layer.fillStyle(0xf4d6aa, 0.34);
        layer.fillRoundedRect(
          worldX - 8 * scale,
          worldY - 5 * scale,
          16 * scale,
          2 * scale,
          1,
        );
        break;
      case "bollard":
        layer.fillStyle(0x000000, 0.1);
        layer.fillEllipse(worldX, worldY + 5, 10 * scale, 5 * scale);
        layer.fillStyle(0x49545d, 0.94);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY - 6 * scale,
          6 * scale,
          12 * scale,
          2,
        );
        layer.fillStyle(0xd5dddf, 0.12);
        layer.fillRoundedRect(
          worldX - 2 * scale,
          worldY - 5 * scale,
          2 * scale,
          6 * scale,
          1,
        );
        break;
      case "pump":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 16 * scale, 7 * scale);
        layer.fillStyle(0x667883, 0.92);
        layer.fillRoundedRect(
          worldX - 4 * scale,
          worldY - 7 * scale,
          8 * scale,
          14 * scale,
          3,
        );
        layer.fillStyle(0x90a7b2, 0.14);
        layer.fillRoundedRect(
          worldX - 2 * scale,
          worldY - 5 * scale,
          2 * scale,
          5 * scale,
          1,
        );
        layer.lineStyle(2, 0xcab58c, 0.36);
        layer.lineBetween(
          worldX + 1 * scale,
          worldY - 5 * scale,
          worldX + 8 * scale,
          worldY - 11 * scale,
        );
        layer.lineBetween(
          worldX + 8 * scale,
          worldY - 11 * scale,
          worldX + 11 * scale,
          worldY - 8 * scale,
        );
        break;
      default:
        layer.fillStyle(colorForProp(prop.kind), 0.94);
        layer.fillRoundedRect(
          worldX - 8 * scale,
          worldY - 8 * scale,
          16 * scale,
          16 * scale,
          5,
        );
        break;
    }
  }
}

function drawLocationLabels(
  scene: PhaserType.Scene,
  game: StreetGameState,
  indices: RuntimeIndices,
  visualScene: VisualScene | null,
) {
  const objects: PhaserType.GameObjects.GameObject[] = [];
  if (visualScene) {
    for (const label of visualScene.labels) {
      objects.push(createAuthoredSceneLabel(scene, label));
    }

    return objects;
  }

  for (const location of game.locations) {
    const footprint = indices.footprintByLocationId.get(location.id);
    if (!footprint) {
      continue;
    }

    const point = mapPointToWorld({ x: location.labelX, y: location.labelY });
    objects.push(
      createWorldLabelPlate(scene, point.x, point.y, location.name, {
        accentColor: landmarkAccentColor(location.id),
        depth: 38,
        tone: "location",
      }),
    );
  }

  for (const label of game.map.labels) {
    const { x, y } = mapPointToWorld({
      x: label.x + 0.5,
      y: label.y + 0.5,
    });
    objects.push(
      createWorldLabelPlate(scene, x, y, label.text, {
        accentColor: label.tone === "district" ? 0xf1d4a1 : 0x8ca7b4,
        depth: label.tone === "district" ? 36 : 34,
        tone: label.tone,
      }),
    );
  }

  return objects;
}

function createAuthoredSceneLabel(
  scene: PhaserType.Scene,
  label: VisualScene["labels"][number],
) {
  return scene.add
    .text(label.x, label.y, label.text, {
      color:
        label.tone === "landmark"
          ? "#324742"
          : label.tone === "district"
            ? "rgba(47, 63, 67, 0.72)"
            : "rgba(70, 76, 79, 0.68)",
      fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
      fontSize:
        label.tone === "landmark"
          ? "24px"
          : label.tone === "district"
            ? "28px"
            : "18px",
      fontStyle: label.tone === "landmark" ? "700" : "600",
    })
    .setDepth(label.tone === "district" ? 36 : 34)
    .setOrigin(0.5, 0.5);
}

function createWorldLabelPlate(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  text: string,
  options: {
    accentColor: number;
    depth: number;
    tone: "district" | "landmark" | "location" | "street";
  },
) {
  const { accentColor, depth, tone } = options;
  const fontSize =
    tone === "location"
      ? 13
      : tone === "district"
        ? 16
        : tone === "landmark"
          ? 12
          : 11;
  const boardFill =
    tone === "location" || tone === "landmark"
      ? 0x24352d
      : tone === "district"
        ? 0x1b2426
        : 0x2b3438;
  const boardInner =
    tone === "location" || tone === "landmark"
      ? 0x31473c
      : tone === "district"
        ? 0x263236
        : 0x394449;
  const boardStroke =
    tone === "street" ? 0x8b9b9f : tone === "district" ? 0xd6b36c : 0xd9ba74;
  const textNode = scene.add
    .text(0, 0, text, {
      align: "center",
      color:
        tone === "location" || tone === "landmark"
          ? "#f3ead0"
          : toneColor(tone),
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: tone === "district" || tone === "location" ? "700" : "600",
    })
    .setOrigin(0.5);
  const paddingX = tone === "location" ? 12 : tone === "district" ? 10 : 8;
  const paddingY = tone === "location" ? 6 : 4;
  const width = textNode.width + paddingX * 2;
  const height = textNode.height + paddingY * 2;
  const background = scene.add.graphics();

  background.fillStyle(boardFill, tone === "street" ? 0.78 : 0.96);
  background.lineStyle(2, boardStroke, tone === "street" ? 0.5 : 0.95);
  background.fillRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    tone === "district" ? 8 : 7,
  );
  background.strokeRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    tone === "district" ? 8 : 7,
  );
  background.fillStyle(boardInner, tone === "street" ? 0.18 : 0.54);
  background.fillRoundedRect(
    -width / 2 + 3,
    -height / 2 + 3,
    width - 6,
    height - 6,
    tone === "district" ? 6 : 5,
  );
  background.fillStyle(accentColor, tone === "street" ? 0.18 : 0.34);
  background.fillRoundedRect(
    -width / 2 + 8,
    -height / 2 + 5,
    width - 16,
    2.5,
    1.5,
  );

  return scene.add.container(x, y, [background, textNode]).setDepth(depth);
}

function landmarkAccentColor(locationId: string) {
  switch (locationId) {
    case "boarding-house":
      return 0xd4dde5;
    case "tea-house":
      return 0xe0c08a;
    case "repair-stall":
      return 0xbdd0da;
    case "freight-yard":
      return 0xd7b176;
    case "moss-pier":
      return 0xd8b084;
    case "market-square":
      return 0xe3c892;
    case "courtyard":
      return 0xb9d49c;
    default:
      return 0x9db7c0;
  }
}

const KENNEY_GRASS = [925, 926, 927, 962, 963, 964, 999, 1000, 1001];
const KENNEY_TREE_FRAMES = [401, 402, 403, 404, 405];
const KENNEY_SIGN_FRAMES = [290, 291, 292, 293];

function drawKenneyTerrainSprites(scene: PhaserType.Scene, tiles: MapTile[]) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const tile of tiles) {
    const frame = kenneyGroundFrameForTile(tile);
    if (frame === null) {
      continue;
    }

    const { x, y } = mapTileToWorldOrigin(tile.x, tile.y);
    nodes.push(
      scene.add
        .image(x, y, KENNEY_MODERN_CITY_KEY, frame)
        .setOrigin(0)
        .setScale(KENNEY_SCALE)
        .setDepth(14),
    );
  }

  return nodes;
}

function kenneyGroundFrameForTile(tile: MapTile) {
  const noise = sampleTileNoise(tile.x, tile.y, 331);

  switch (tile.kind) {
    case "garden":
      return pickKenneyFrame(KENNEY_GRASS, noise);
    default:
      return null;
  }
}

function drawKenneyFacadeSprites(
  scene: PhaserType.Scene,
  game: StreetGameState,
) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const footprint of game.map.footprints) {
    if (footprint.kind !== "building") {
      continue;
    }

    const facade = kenneyFacadeStyleForFootprint(footprint);
    const facing = resolveFootprintFacing(game.map, footprint);
    const tileMinX = Math.floor(footprint.x + 0.1);
    const tileMinY = Math.floor(footprint.y + 0.1);
    const tileMaxX = Math.max(
      tileMinX + 1,
      Math.ceil(footprint.x + footprint.width - 0.1),
    );
    const tileMaxY = Math.max(
      tileMinY + 1,
      Math.ceil(footprint.y + footprint.height - 0.1),
    );
    const columns = tileMaxX - tileMinX;
    const rows = tileMaxY - tileMinY;

    if (facing !== "north" && facing !== "south") {
      continue;
    }

    const facadeRows = Math.min(
      rows,
      Math.max(2, Math.min(3, Math.round(footprint.height))),
    );
    const baseTileY =
      facing === "south" ? Math.max(tileMinY, tileMaxY - facadeRows) : tileMinY;

    for (let row = 0; row < facadeRows; row += 1) {
      const visualRow = facing === "south" ? row : facadeRows - row - 1;
      for (let column = 0; column < columns; column += 1) {
        const frame =
          visualRow === 0
            ? facade.top[column % facade.top.length]
            : visualRow === facadeRows - 1
              ? facade.base[column % facade.base.length]
              : facade.mid[(visualRow + column) % facade.mid.length];
        const { x, y } = mapTileToWorldOrigin(
          tileMinX + column,
          baseTileY + row,
        );
        nodes.push(
          scene.add
            .image(x, y, KENNEY_MODERN_CITY_KEY, frame)
            .setOrigin(0)
            .setScale(KENNEY_SCALE)
            .setDepth(23),
        );
      }
    }

    if (facade.awning.length > 0) {
      const awningRow =
        facing === "south"
          ? Math.max(baseTileY + facadeRows - 2, baseTileY)
          : Math.min(baseTileY + 1, tileMaxY - 1);
      for (let column = 0; column < columns; column += 1) {
        const { x, y } = mapTileToWorldOrigin(tileMinX + column, awningRow);
        nodes.push(
          scene.add
            .image(
              x,
              y,
              KENNEY_MODERN_CITY_KEY,
              facade.awning[column % facade.awning.length],
            )
            .setOrigin(0)
            .setScale(KENNEY_SCALE)
            .setDepth(24),
        );
      }
    }

    if (facade.signFrame !== null) {
      const signX = tileMinX + Math.max(0, Math.floor(columns / 2) - 1);
      const signY =
        facing === "south"
          ? Math.min(baseTileY + 1, tileMaxY - 1)
          : Math.max(baseTileY + facadeRows - 2, baseTileY);
      const { x, y } = mapTileToWorldOrigin(signX, signY);
      nodes.push(
        scene.add
          .image(x, y, KENNEY_MODERN_CITY_KEY, facade.signFrame)
          .setOrigin(0)
          .setScale(KENNEY_SCALE)
          .setDepth(25),
      );
    }
  }

  return nodes;
}

function drawKenneyLandmarkOverlays(
  scene: PhaserType.Scene,
  game: StreetGameState,
) {
  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const footprint of game.map.footprints) {
    if (footprint.kind !== "building" || !footprint.locationId) {
      continue;
    }

    const palette = footprintPalette({
      kind: footprint.kind,
      locationId: footprint.locationId,
      roofStyle: footprint.roofStyle,
      seedX: footprint.x,
      seedY: footprint.y,
    });
    const facing = resolveFootprintFacing(game.map, footprint);

    if (
      facing !== "south" ||
      (palette.profile !== "boarding-house" &&
        palette.profile !== "tea-house" &&
        palette.profile !== "repair-stall")
    ) {
      continue;
    }

    const { x: worldX, y: worldY } = mapTileToWorldOrigin(
      footprint.x,
      footprint.y,
    );
    const width = footprint.width * CELL;
    const height = footprint.height * CELL;
    const overlay = scene.add.graphics().setDepth(26);

    if (
      footprint.locationId === "tea-house" &&
      palette.profile === "tea-house"
    ) {
      drawTeaHouseLandmark(overlay, worldX, worldY, width, height, palette);
    } else {
      drawBuildingDetail(overlay, worldX, worldY, width, height, palette);
      drawLandmarkPurposeAccent(
        overlay,
        worldX,
        worldY,
        width,
        height,
        palette,
      );
    }
    nodes.push(overlay);
  }

  return nodes;
}

function drawTeaHouseLandmark(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const centerX = worldX + width / 2;
  const roofLeft = worldX + 8;
  const roofRight = worldX + width - 8;
  const roofBaseY = worldY + 24;
  const wallTop = worldY + 28;
  const wallHeight = Math.max(height - 42, 44);
  const awningY = worldY + height - 42;
  const storefrontY = worldY + height - 34;
  const terraceY = worldY + height + 3;
  const planterY = worldY + height + 29;
  const warmWindow = blendColor(palette.window, 0xfff6e0, 0.2);
  const teaRoof = 0x496d5b;
  const teaRoofDark = 0x30483e;
  const teaWall = 0xe3d7bf;
  const teaTrim = 0x79583d;
  const teaWood = 0x6b4b33;
  const terraceStone = 0xc8b89a;
  const terraceShadow = 0x8f7b61;
  const stripeLight = 0xf5efe4;
  const stripeGreen = 0x58a774;
  const brickWarm = 0xbc8768;
  const creamTrim = 0xf2e6d0;
  const cafeRail = 0x664731;
  const terraceCloth = 0xf1ede2;
  const terraceAccent = 0xe0c995;
  const menuBoard = 0x243129;
  const menuFrame = 0x6a4d37;

  layer.fillStyle(teaRoofDark, 0.22);
  layer.fillEllipse(centerX, worldY + height - 2, Math.max(width - 26, 40), 16);

  layer.fillStyle(teaRoof, 1);
  layer.fillTriangle(
    roofLeft,
    roofBaseY + 14,
    roofRight,
    roofBaseY + 14,
    centerX,
    worldY + 8,
  );
  layer.fillStyle(blendColor(teaRoof, 0xb1cfbf, 0.18), 1);
  layer.fillRoundedRect(worldX + 16, worldY + 11, width - 32, 9, 4);
  layer.fillStyle(teaRoofDark, 1);
  layer.fillRoundedRect(worldX + 12, roofBaseY + 8, width - 24, 8, 4);
  layer.lineStyle(1.6, blendColor(teaRoofDark, 0xf0eadb, 0.08), 0.34);
  for (let seam = 1; seam < 5; seam += 1) {
    const seamX = worldX + 18 + ((width - 36) * seam) / 5;
    layer.lineBetween(seamX, worldY + 13, seamX - 4, roofBaseY + 12);
  }

  layer.fillStyle(teaWall, 0.98);
  layer.fillRoundedRect(worldX + 10, wallTop, width - 20, wallHeight, 8);
  layer.fillStyle(brickWarm, 1);
  layer.fillRoundedRect(worldX + 10, worldY + 52, width - 20, 14, 2);
  layer.fillStyle(blendColor(teaWall, 0xffffff, 0.18), 1);
  layer.fillRoundedRect(worldX + 14, wallTop + 5, width - 28, 8, 3);
  layer.fillStyle(creamTrim, 0.92);
  layer.fillRoundedRect(
    worldX + width - 24,
    wallTop + 6,
    12,
    wallHeight - 18,
    4,
  );
  layer.fillStyle(stripeGreen, 0.86);
  layer.fillRect(worldX + width - 22, wallTop + 22, 3, wallHeight - 34);
  layer.fillRect(worldX + width - 16, wallTop + 22, 3, wallHeight - 34);

  const upperWindowY = worldY + 36;
  for (const offset of [-34, 0, 34]) {
    const windowX = centerX + offset - 11;
    layer.fillStyle(teaTrim, 0.96);
    layer.fillRoundedRect(windowX - 2, upperWindowY - 2, 26, 24, 4);
    layer.fillStyle(warmWindow, 0.96);
    layer.fillRoundedRect(windowX, upperWindowY, 22, 20, 3);
    layer.lineStyle(1.2, blendColor(teaTrim, 0x0d1114, 0.12), 0.42);
    layer.lineBetween(
      windowX + 11,
      upperWindowY + 2,
      windowX + 11,
      upperWindowY + 18,
    );
    layer.lineBetween(
      windowX + 2,
      upperWindowY + 10,
      windowX + 20,
      upperWindowY + 10,
    );
  }

  const awningWidth = width - 34;
  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(worldX + 14, awningY - 6, awningWidth, 8, 4);
  for (let stripe = 0; stripe < 7; stripe += 1) {
    const stripeX = worldX + 17 + stripe * (awningWidth / 7);
    const stripeWidth = awningWidth / 7 + 1;
    layer.fillStyle(stripe % 2 === 0 ? stripeLight : stripeGreen, 0.98);
    layer.fillRect(stripeX, awningY, stripeWidth, 18);
  }
  layer.fillStyle(teaWood, 0.98);
  layer.fillTriangle(
    worldX + 18,
    awningY + 18,
    worldX + 14 + awningWidth,
    awningY + 18,
    centerX,
    awningY + 28,
  );

  layer.fillStyle(teaWood, 1);
  layer.fillRoundedRect(worldX + 12, storefrontY, width - 24, 24, 5);
  layer.fillStyle(blendColor(teaWood, 0x101417, 0.24), 1);
  layer.fillRoundedRect(centerX - 12, storefrontY - 1, 24, 25, 5);
  layer.fillStyle(blendColor(teaWood, 0xffffff, 0.12), 0.88);
  layer.fillRoundedRect(centerX - 8, storefrontY + 2, 16, 18, 4);
  layer.fillStyle(blendColor(teaWood, 0x15110d, 0.18), 1);
  layer.fillRoundedRect(centerX - 11, storefrontY - 3, 22, 5, 2);
  layer.fillStyle(warmWindow, 0.95);
  layer.fillRoundedRect(worldX + 17, storefrontY + 3, 26, 17, 3);
  layer.fillRoundedRect(worldX + width - 43, storefrontY + 3, 26, 17, 3);
  layer.fillStyle(blendColor(warmWindow, 0xffffff, 0.16), 0.84);
  layer.fillRoundedRect(worldX + 20, storefrontY + 5, 20, 5, 2);
  layer.fillRoundedRect(worldX + width - 40, storefrontY + 5, 20, 5, 2);
  layer.fillStyle(creamTrim, 0.42);
  layer.fillRoundedRect(worldX + 24, storefrontY + 11, 12, 2, 1);
  layer.fillRoundedRect(worldX + width - 36, storefrontY + 11, 12, 2, 1);
  layer.fillStyle(0xe9d8ad, 0.9);
  layer.fillCircle(centerX + 5, storefrontY + 13, 1.5);
  layer.lineStyle(1.2, blendColor(teaTrim, 0x0c1114, 0.14), 0.34);
  layer.lineBetween(
    worldX + 30,
    storefrontY + 4,
    worldX + 30,
    storefrontY + 20,
  );
  layer.lineBetween(
    worldX + width - 30,
    storefrontY + 4,
    worldX + width - 30,
    storefrontY + 20,
  );
  drawTeaHouseWallLantern(layer, worldX + 28, storefrontY - 6);
  drawTeaHouseWallLantern(layer, worldX + width - 28, storefrontY - 6);
  layer.fillStyle(0x476a45, 0.96);
  layer.fillRoundedRect(worldX + 18, storefrontY - 11, 18, 3, 2);
  layer.fillRoundedRect(worldX + width - 36, storefrontY - 11, 18, 3, 2);
  layer.fillStyle(0x86ab6d, 0.92);
  layer.fillCircle(worldX + 22, storefrontY - 13, 3);
  layer.fillCircle(worldX + 29, storefrontY - 13, 3.2);
  layer.fillCircle(worldX + width - 23, storefrontY - 13, 3);
  layer.fillCircle(worldX + width - 29, storefrontY - 13, 3.2);

  layer.fillStyle(terraceStone, 0.98);
  layer.fillRoundedRect(worldX + 12, terraceY, width - 18, 24, 8);
  layer.fillStyle(blendColor(terraceStone, 0xffffff, 0.12), 1);
  layer.fillRoundedRect(worldX + 16, terraceY + 2, width - 26, 4, 3);
  layer.fillStyle(blendColor(terraceShadow, 0x1a1815, 0.1), 0.7);
  layer.fillRect(worldX + 16, terraceY + 20, width - 26, 2);
  layer.fillStyle(cafeRail, 0.96);
  layer.fillRoundedRect(worldX + 15, terraceY + 20, width - 22, 3, 2);
  for (const railX of [
    worldX + 20,
    worldX + 35,
    worldX + width - 42,
    worldX + width - 24,
  ]) {
    layer.fillRoundedRect(railX, terraceY + 11, 3, 13, 1.5);
  }
  layer.fillRoundedRect(worldX + 18, terraceY + 8, 26, 3, 2);
  layer.fillRoundedRect(worldX + width - 46, terraceY + 8, 26, 3, 2);

  drawTeaHouseCafeTable(
    layer,
    worldX + 34,
    terraceY + 13,
    teaWood,
    stripeGreen,
    terraceCloth,
    terraceAccent,
    true,
  );
  drawTeaHouseCafeTable(
    layer,
    worldX + 58,
    terraceY + 15,
    teaWood,
    teaTrim,
    terraceCloth,
    terraceAccent,
    false,
  );

  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(worldX + width - 19, terraceY + 4, 3, 16, 1.5);
  layer.fillRoundedRect(worldX + width - 27, terraceY + 8, 13, 9, 2);
  layer.fillStyle(stripeLight, 0.9);
  layer.fillRoundedRect(worldX + width - 24, terraceY + 10, 8, 1.5, 1);
  layer.fillRoundedRect(worldX + width - 24, terraceY + 13, 6, 1.5, 1);
  layer.fillStyle(terraceStone, 0.98);
  layer.fillRoundedRect(worldX + width - 6, terraceY - 1, 18, 26, 5);
  drawTeaHouseMenuBoard(
    layer,
    worldX + width + 4,
    terraceY + 11,
    menuBoard,
    menuFrame,
  );
  layer.fillStyle(cafeRail, 0.96);
  layer.fillRoundedRect(worldX + width + 4, terraceY + 20, 10, 3, 2);
  layer.fillRoundedRect(worldX + width + 8, terraceY + 9, 3, 14, 1.5);

  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(centerX - 24, worldY + 22, 48, 10, 5);
  layer.fillStyle(0xf3e8cb, 0.96);
  layer.fillCircle(centerX - 12, worldY + 27, 3.6);
  layer.lineStyle(1.4, 0xf3e8cb, 0.96);
  layer.strokeCircle(centerX - 12, worldY + 27, 5.2);
  layer.lineBetween(centerX - 7.5, worldY + 27, centerX - 4.5, worldY + 27);
  layer.lineStyle(1.2, 0xf3e8cb, 0.54);
  layer.lineBetween(centerX - 15, worldY + 20, centerX - 13, worldY + 16);
  layer.lineBetween(centerX - 10, worldY + 20, centerX - 8, worldY + 16);

  layer.fillStyle(0x587a4e, 0.98);
  layer.fillRoundedRect(worldX + 18, planterY, 10, 7, 3);
  layer.fillRoundedRect(worldX + width - 28, planterY, 10, 7, 3);
  layer.fillRoundedRect(worldX + width + 1, terraceY + 19, 10, 7, 3);
  layer.fillStyle(0x2f4d34, 0.96);
  layer.fillCircle(worldX + 23, planterY - 3, 6);
  layer.fillCircle(worldX + width - 23, planterY - 3, 6);
  layer.fillCircle(worldX + width + 6, terraceY + 16, 6);
  layer.fillStyle(0x587a4e, 0.98);
  layer.fillRoundedRect(worldX + 12, terraceY + 19, 10, 7, 3);
  layer.fillStyle(0x2f4d34, 0.96);
  layer.fillCircle(worldX + 17, terraceY + 16, 6);
}

function drawTeaHouseWallLantern(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
) {
  layer.lineStyle(1.4, 0x5f4634, 0.92);
  layer.lineBetween(centerX - 2, centerY, centerX + 2, centerY);
  layer.lineBetween(centerX + 2, centerY, centerX + 5, centerY - 3);
  layer.fillStyle(0x2a3339, 0.98);
  layer.fillRoundedRect(centerX + 3, centerY - 8, 6, 8, 2);
  layer.fillStyle(0xf7e2b0, 0.92);
  layer.fillRoundedRect(centerX + 4.5, centerY - 6.5, 3, 4.5, 1.2);
}

function drawTeaHouseCafeTable(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  tableColor: number,
  chairColor: number,
  clothColor: number,
  accentColor: number,
  umbrella: boolean,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(centerX + 1, centerY + 10, 26, 9);
  if (umbrella) {
    layer.fillStyle(0xece9df, 0.96);
    layer.fillEllipse(centerX, centerY - 7, 18, 10);
    layer.fillStyle(accentColor, 0.96);
    layer.fillEllipse(centerX, centerY - 7, 8, 10);
    layer.fillStyle(tableColor, 0.94);
    layer.fillRoundedRect(centerX - 1, centerY - 7, 2, 18, 1);
  }
  layer.fillStyle(tableColor, 0.98);
  layer.fillCircle(centerX, centerY + 1, 6.3);
  layer.fillStyle(clothColor, 0.98);
  layer.fillCircle(centerX, centerY + 1, 4.6);
  layer.fillStyle(accentColor, 0.94);
  layer.fillCircle(centerX, centerY + 1, 1.6);
  layer.fillStyle(tableColor, 0.98);
  layer.fillRoundedRect(centerX - 1.4, centerY + 1, 2.8, 9, 1.2);
  layer.fillStyle(0xf7e9cf, 0.9);
  layer.fillCircle(centerX - 2.2, centerY - 0.5, 0.95);
  layer.fillCircle(centerX + 2.2, centerY - 0.5, 0.95);
  layer.fillStyle(chairColor, 0.98);
  layer.fillRoundedRect(centerX - 12, centerY - 2, 6, 6.2, 2);
  layer.fillRoundedRect(centerX + 6, centerY - 2, 6, 6.2, 2);
  layer.fillRoundedRect(centerX - 10.5, centerY + 8, 5.2, 2.5, 1);
  layer.fillRoundedRect(centerX + 5.3, centerY + 8, 5.2, 2.5, 1);
  layer.fillStyle(blendColor(chairColor, 0xffffff, 0.16), 0.62);
  layer.fillRoundedRect(centerX - 11, centerY - 1, 4, 1.6, 1);
  layer.fillRoundedRect(centerX + 7, centerY - 1, 4, 1.6, 1);
}

function drawTeaHouseMenuBoard(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  boardColor: number,
  frameColor: number,
) {
  layer.fillStyle(0x000000, 0.14);
  layer.fillEllipse(centerX + 1, centerY + 10, 16, 7);
  layer.fillStyle(frameColor, 0.98);
  layer.fillRoundedRect(centerX - 5.5, centerY - 9, 11, 16, 2);
  layer.fillStyle(boardColor, 0.98);
  layer.fillRoundedRect(centerX - 4, centerY - 7.5, 8, 12, 1.5);
  layer.lineStyle(1.1, 0xe8dcc0, 0.55);
  layer.lineBetween(centerX - 2.5, centerY - 4.5, centerX + 2.5, centerY - 4.5);
  layer.lineBetween(centerX - 2.5, centerY - 1.5, centerX + 2.5, centerY - 1.5);
  layer.lineBetween(centerX - 2.5, centerY + 1.5, centerX + 2.5, centerY + 1.5);
  layer.lineStyle(1.2, frameColor, 0.94);
  layer.lineBetween(centerX - 1.5, centerY + 7, centerX - 4.5, centerY + 13);
  layer.lineBetween(centerX + 1.5, centerY + 7, centerX + 4.5, centerY + 13);
}

function drawLandmarkPurposeAccent(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const centerX = worldX + width / 2;

  switch (palette.profile) {
    case "boarding-house":
      layer.lineStyle(2, blendColor(palette.trim, 0xf2e7d4, 0.28), 0.6);
      layer.lineBetween(
        centerX - 20,
        worldY + height - 27,
        centerX - 20,
        worldY + height - 12,
      );
      layer.lineBetween(
        centerX + 20,
        worldY + height - 27,
        centerX + 20,
        worldY + height - 12,
      );
      layer.fillStyle(blendColor(palette.sign, 0xf6e6c8, 0.16), 0.98);
      layer.fillRoundedRect(centerX - 14, worldY + height - 30, 28, 8, 4);
      break;
    case "tea-house":
      layer.fillStyle(blendColor(palette.window, 0xfff8ea, 0.2), 0.22);
      layer.fillCircle(centerX - 18, worldY + height - 24, 4);
      layer.fillCircle(centerX + 18, worldY + height - 24, 4);
      layer.fillStyle(blendColor(palette.awning, 0xf5e8cf, 0.08), 1);
      layer.fillRoundedRect(centerX - 18, worldY + 13, 36, 8, 4);
      break;
    case "repair-stall":
      layer.lineStyle(2, blendColor(palette.trim, 0xf0eadf, 0.12), 0.56);
      layer.lineBetween(
        centerX - 6,
        worldY + height - 31,
        centerX + 6,
        worldY + height - 19,
      );
      layer.lineBetween(
        centerX - 6,
        worldY + height - 19,
        centerX + 6,
        worldY + height - 31,
      );
      layer.fillStyle(blendColor(palette.sign, 0xe8ded0, 0.12), 0.96);
      layer.fillRoundedRect(centerX + 18, worldY + height - 28, 18, 10, 4);
      break;
    default:
      break;
  }
}

function kenneyFacadeStyleForFootprint(footprint: MapFootprint) {
  const profile = resolveBuildingProfile(
    footprint.locationId,
    footprint.roofStyle,
    footprint.x,
    footprint.y,
  );

  switch (profile) {
    case "boarding-house":
      return {
        awning: [] as number[],
        base: [410, 411, 412, 413],
        mid: [373, 374, 375, 376],
        signFrame: KENNEY_SIGN_FRAMES[0],
        top: [336, 337, 338, 339],
      };
    case "tea-house":
      return {
        awning: [391, 392, 393, 394, 395],
        base: [377, 380, 381, 382, 379],
        mid: [377, 380, 381, 382, 379],
        signFrame: KENNEY_SIGN_FRAMES[1],
        top: [340, 341, 342, 380],
      };
    case "repair-stall":
      return {
        awning: [396, 397, 398, 399],
        base: [380, 381, 382, 383],
        mid: [343, 344, 345, 346],
        signFrame: KENNEY_SIGN_FRAMES[2],
        top: [336, 343, 344, 345],
      };
    case "freight-yard":
    case "warehouse":
      return {
        awning: [] as number[],
        base: [380, 381, 382, 383],
        mid: [373, 380, 381, 376],
        signFrame: KENNEY_SIGN_FRAMES[3],
        top: [336, 337, 338, 339],
      };
    case "moss-pier":
      return {
        awning: [396, 397, 398],
        base: [370, 371, 372, 377],
        mid: [370, 371, 372, 377],
        signFrame: KENNEY_SIGN_FRAMES[1],
        top: [333, 334, 335, 340],
      };
    case "rowhouse":
    default:
      return {
        awning: [] as number[],
        base: [407, 408, 409, 414],
        mid: [370, 371, 372, 377],
        signFrame: null as number | null,
        top: [333, 334, 335, 340],
      };
  }
}

function drawKenneyPropSprites(scene: PhaserType.Scene, props: MapProp[]) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const prop of props) {
    if (prop.kind !== "tree") {
      continue;
    }

    const frame = pickKenneyFrame(
      KENNEY_TREE_FRAMES,
      sampleTileNoise(prop.x, prop.y, 719),
    );
    const { x, y } = mapTileToWorldOrigin(prop.x, prop.y);
    nodes.push(
      scene.add
        .image(x - 6, y - CELL * 0.85, KENNEY_MODERN_CITY_KEY, frame)
        .setOrigin(0)
        .setScale(KENNEY_SCALE)
        .setDepth(26),
    );
  }

  return nodes;
}

function pickKenneyFrame(frames: number[], noise: number) {
  const index = Math.max(
    0,
    Math.min(frames.length - 1, Math.floor(noise * frames.length)),
  );
  return frames[index] ?? frames[0]!;
}

function drawTileCell(
  layer: PhaserType.GameObjects.Graphics,
  tileLookup: Map<string, MapTile>,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  kind: TileKind,
  walkable: boolean,
  alpha = 1,
) {
  const edges = getTileSurfaceEdges(tileLookup, gridX, gridY, kind);
  const fillColor = walkable
    ? blendColor(TILE_COLORS[kind], 0x0d1418, kind === "water" ? 0.08 : 0.03)
    : blendColor(TILE_COLORS[kind], 0x101619, 0.58);
  const leftBleed = edges.west ? 1.5 : 0;
  const rightBleed = edges.east ? 1.5 : 0;
  const topBleed = edges.north ? 1.5 : 0;
  const bottomBleed = edges.south ? 1.5 : 0;
  const surfaceX = worldX - leftBleed;
  const surfaceY = worldY - topBleed;
  const surfaceWidth = CELL + leftBleed + rightBleed;
  const surfaceHeight = CELL + topBleed + bottomBleed;
  const isolated = !edges.north && !edges.south && !edges.east && !edges.west;
  const baseAlpha = (walkable ? 1 : 0.82) * alpha;

  layer.fillStyle(fillColor, baseAlpha);
  if (isolated) {
    layer.fillRoundedRect(
      surfaceX + 1,
      surfaceY + 1,
      surfaceWidth - 2,
      surfaceHeight - 2,
      9,
    );
  } else {
    layer.fillRect(surfaceX, surfaceY, surfaceWidth, surfaceHeight);
  }
  drawSurfacePatina(
    layer,
    gridX,
    gridY,
    surfaceX,
    surfaceY,
    surfaceWidth,
    surfaceHeight,
    kind,
    alpha,
  );
  drawTileSurfaceDetail(layer, gridX, gridY, worldX, worldY, kind, alpha);

  drawSurfaceEdge(
    layer,
    surfaceX,
    surfaceY,
    surfaceWidth,
    surfaceHeight,
    edges,
    kind,
    alpha,
  );

  if (!walkable) {
    layer.lineStyle(2, 0x12181c, 0.42 * alpha);
    layer.lineBetween(
      worldX + 8,
      worldY + 8,
      worldX + CELL - 8,
      worldY + CELL - 8,
    );
  }
}

function drawSurfacePatina(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  surfaceX: number,
  surfaceY: number,
  width: number,
  height: number,
  kind: TileKind,
  alpha: number,
) {
  const patchColor = blendColor(
    TILE_COLORS[kind],
    0xf0e2c4,
    kind === "water" ? 0.2 : 0.12,
  );
  const shadowColor = blendColor(TILE_COLORS[kind], 0x0a1116, 0.22);
  const patchCount =
    kind === "lane" || kind === "plaza" ? 1 : kind === "water" ? 1 : 2;

  for (let index = 0; index < patchCount; index += 1) {
    const offsetSeed = sampleTileNoise(
      gridX + index * 2,
      gridY + index,
      121 + index * 19,
    );
    const patchX = surfaceX + 6 + offsetSeed * Math.max(width - 16, 8);
    const patchY =
      surfaceY +
      7 +
      sampleTileNoise(gridX, gridY + index * 3, 141 + index * 13) *
        Math.max(height - 18, 8);
    const patchWidth =
      kind === "water"
        ? 10 + sampleTileNoise(gridX + index, gridY, 161 + index * 11) * 12
        : 5 + sampleTileNoise(gridX + index, gridY, 161 + index * 11) * 10;
    const patchHeight =
      kind === "water"
        ? 2 + sampleTileNoise(gridX, gridY + index, 181 + index * 5) * 2.5
        : 2 + sampleTileNoise(gridX, gridY + index, 181 + index * 5) * 4;

    layer.fillStyle(
      index % 3 === 0 ? patchColor : shadowColor,
      (kind === "water"
        ? 0.02
        : kind === "lane" || kind === "plaza"
          ? 0.012
          : 0.022) * alpha,
    );
    layer.fillEllipse(patchX, patchY, patchWidth, patchHeight);
  }
}

function drawSurfaceEdge(
  layer: PhaserType.GameObjects.Graphics,
  surfaceX: number,
  surfaceY: number,
  width: number,
  height: number,
  edges: { east: boolean; north: boolean; south: boolean; west: boolean },
  kind: TileKind,
  alpha: number,
) {
  const highlight = blendColor(
    TILE_COLORS[kind],
    0xf2e1bc,
    kind === "water" ? 0.4 : 0.32,
  );
  const shadow = blendColor(TILE_COLORS[kind], 0x091015, 0.46);

  if (!edges.north) {
    layer.fillStyle(highlight, (kind === "water" ? 0.12 : 0.1) * alpha);
    layer.fillRect(surfaceX + 2, surfaceY + 1, Math.max(width - 4, 6), 2.5);
  }

  if (!edges.west) {
    layer.fillStyle(highlight, 0.06 * alpha);
    layer.fillRect(surfaceX + 1, surfaceY + 2, 2, Math.max(height - 4, 6));
  }

  if (!edges.south) {
    layer.fillStyle(shadow, 0.14 * alpha);
    layer.fillRect(
      surfaceX + 2,
      surfaceY + height - 3,
      Math.max(width - 4, 6),
      2.5,
    );
  }

  if (!edges.east) {
    layer.fillStyle(shadow, 0.09 * alpha);
    layer.fillRect(
      surfaceX + width - 3,
      surfaceY + 2,
      2.5,
      Math.max(height - 4, 6),
    );
  }
}

function drawTileSurfaceDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  kind: TileKind,
  alpha: number,
) {
  switch (kind) {
    case "lane":
      drawLaneDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "plaza":
      drawPlazaDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "stoop":
      drawStoopDetail(layer, worldX, worldY, alpha);
      return;
    case "dock":
      drawDockDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "water":
      drawWaterDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "garden":
      drawGardenDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "courtyard":
      drawCourtyardDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "roof":
      drawRoofDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "workyard":
      drawWorkyardDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    default:
      return;
  }
}

function drawLaneDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const seam = sampleTileNoise(gridX, gridY, 9);
  const curbHighlight = 0.032 + seam * 0.01;
  const gutterShadow = 0.045 + seam * 0.016;

  layer.fillStyle(0xf3e7cf, curbHighlight * alpha);
  layer.fillRect(worldX + 2, worldY + 3, CELL - 4, 2);
  layer.fillStyle(0x544b3f, gutterShadow * alpha);
  layer.fillRect(worldX + 2, worldY + CELL - 4, CELL - 4, 2);

  layer.lineStyle(1, 0xe0d3ba, (0.06 + seam * 0.02) * alpha);
  layer.lineBetween(worldX + 5, worldY + 13, worldX + CELL - 5, worldY + 13);
  layer.lineBetween(worldX + 5, worldY + 26, worldX + CELL - 5, worldY + 26);
  layer.lineBetween(worldX + 13, worldY + 5, worldX + 13, worldY + CELL - 5);
  layer.lineBetween(worldX + 26, worldY + 5, worldX + 26, worldY + CELL - 5);

  layer.fillStyle(0x9f8a6f, (0.035 + seam * 0.02) * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 8, 9, 5, 2);
  layer.fillRoundedRect(worldX + 22, worldY + 22, 8, 5, 2);
}

function drawPlazaDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const tone = sampleTileNoise(gridX, gridY, 23);
  const inset = 4;

  layer.lineStyle(1.1, 0xf0e3cc, (0.1 + tone * 0.04) * alpha);
  layer.strokeRoundedRect(
    worldX + inset,
    worldY + inset,
    CELL - inset * 2,
    CELL - inset * 2,
    5,
  );
  layer.lineBetween(worldX + 7, worldY + 13, worldX + CELL - 7, worldY + 13);
  layer.lineBetween(worldX + 7, worldY + 27, worldX + CELL - 7, worldY + 27);
  layer.lineBetween(worldX + 13, worldY + 7, worldX + 13, worldY + CELL - 7);
  layer.lineBetween(worldX + 27, worldY + 7, worldX + 27, worldY + CELL - 7);

  layer.fillStyle(
    blendColor(0xc1b092, 0xf0e5cf, 0.24),
    (0.07 + tone * 0.02) * alpha,
  );
  layer.fillRoundedRect(worldX + 15, worldY + 15, 10, 10, 3);
  layer.lineStyle(1, 0xc7b08a, 0.08 * alpha);
  layer.strokeCircle(worldX + CELL / 2, worldY + CELL / 2, 5.2);
}

function drawStoopDetail(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  layer.fillStyle(0xf2e5c8, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 6, worldY + 6, CELL - 12, 6, 3);
  layer.fillStyle(0x201913, 0.12 * alpha);
  layer.fillRoundedRect(worldX + 6, worldY + 16, CELL - 12, 5, 3);
  layer.fillRoundedRect(worldX + 8, worldY + 25, CELL - 16, 4, 3);
}

function drawDockDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const wear = sampleTileNoise(gridX, gridY, 31);
  layer.lineStyle(2, 0xc89f69, (0.12 + wear * 0.06) * alpha);
  layer.lineBetween(worldX + 4, worldY + 8, worldX + CELL - 5, worldY + 8);
  layer.lineBetween(worldX + 4, worldY + 18, worldX + CELL - 6, worldY + 18);
  layer.lineBetween(worldX + 5, worldY + 28, worldX + CELL - 5, worldY + 28);
  layer.lineStyle(1.2, 0x523824, 0.22 * alpha);
  layer.lineBetween(worldX + 11, worldY + 4, worldX + 11, worldY + CELL - 5);
  layer.lineBetween(worldX + 21, worldY + 4, worldX + 21, worldY + CELL - 5);
  layer.lineBetween(worldX + 31, worldY + 4, worldX + 31, worldY + CELL - 5);
  layer.fillStyle(0x2d241a, 0.22 * alpha);
  layer.fillRect(worldX + 5, worldY + CELL - 8, 4, 6);
  layer.fillRect(worldX + CELL - 9, worldY + CELL - 8, 4, 6);
  layer.fillStyle(0xe3c493, 0.08 * alpha);
  layer.fillEllipse(worldX + 18, worldY + 13, 16, 4);
  layer.lineStyle(1, 0xe6d1b0, 0.12 * alpha);
  layer.strokeCircle(worldX + 18, worldY + 22, 3.5);
  if (wear > 0.62) {
    layer.lineStyle(1.4, 0xd7c2a0, 0.14 * alpha);
    layer.strokeCircle(worldX + 28, worldY + 22, 4);
  }
}

function drawWaterDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const crest = sampleTileNoise(gridX, gridY, 41);
  layer.lineStyle(2, 0x89c5da, (0.13 + crest * 0.07) * alpha);
  layer.lineBetween(worldX + 5, worldY + 10, worldX + CELL - 7, worldY + 8);
  layer.lineBetween(worldX + 9, worldY + 21, worldX + CELL - 4, worldY + 18);
  layer.lineBetween(worldX + 7, worldY + 31, worldX + CELL - 9, worldY + 27);
  layer.lineStyle(1.2, 0xdff4f8, (0.09 + crest * 0.05) * alpha);
  layer.lineBetween(worldX + 4, worldY + 5, worldX + CELL - 8, worldY + 4);
  layer.fillStyle(0xc7e6ef, (0.06 + crest * 0.04) * alpha);
  layer.fillEllipse(worldX + 13, worldY + 27, 7, 3);
  layer.fillEllipse(worldX + 28, worldY + 15, 5, 2.5);
  layer.fillStyle(0x173d4d, 0.08 * alpha);
  layer.fillEllipse(worldX + 22, worldY + 24, 18, 5);
}

function drawGardenDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const bloom = sampleTileNoise(gridX, gridY, 53);
  layer.lineStyle(1.2, 0xa9cf8f, 0.08 * alpha);
  layer.strokeRoundedRect(worldX + 5, worldY + 5, CELL - 10, CELL - 10, 6);
  layer.fillStyle(0x2d4c33, 0.18 * alpha);
  layer.fillCircle(worldX + 11, worldY + 13, 4.4);
  layer.fillCircle(worldX + 26, worldY + 25, 5.4);
  layer.fillCircle(worldX + 21, worldY + 14, 3.8);
  layer.fillStyle(0x365b3d, 0.12 * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 20, 12, 6, 3);
  layer.fillStyle(0x9bc17a, (0.1 + bloom * 0.05) * alpha);
  layer.fillCircle(worldX + 15, worldY + 25, 2.3);
  layer.fillCircle(worldX + 28, worldY + 11, 2);
  layer.fillCircle(worldX + 10, worldY + 28, 1.8);
}

function drawCourtyardDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const scatter = sampleTileNoise(gridX, gridY, 67);
  layer.fillStyle(0x6e725f, (0.12 + scatter * 0.04) * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 8, 8, 7, 2);
  layer.fillRoundedRect(worldX + 20, worldY + 21, 10, 8, 2);
  layer.fillStyle(0x93a574, 0.08 * alpha);
  layer.fillCircle(worldX + 30, worldY + 11, 2.2);
}

function drawRoofDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const panel = sampleTileNoise(gridX, gridY, 79);
  const warmSlate = blendColor(0x3e4c55, 0x798892, 0.18 + panel * 0.08);
  const seamAlpha = 0.12 + panel * 0.05;
  layer.fillStyle(0xf2e4c8, 0.06 * alpha);
  layer.fillRect(worldX + 4, worldY + 4, CELL - 8, 2.4);
  layer.fillStyle(0x0f171c, 0.16 * alpha);
  layer.fillRect(worldX + 4, worldY + CELL - 6, CELL - 8, 2.8);
  layer.lineStyle(1.1, warmSlate, seamAlpha * alpha);
  layer.lineBetween(worldX + 6, worldY + 10, worldX + CELL - 6, worldY + 10);
  layer.lineBetween(worldX + 6, worldY + 19, worldX + CELL - 6, worldY + 19);
  layer.lineBetween(worldX + 12, worldY + 6, worldX + 12, worldY + CELL - 6);
  layer.lineBetween(worldX + 28, worldY + 6, worldX + 28, worldY + CELL - 6);
  layer.fillStyle(0x56646e, (0.14 + panel * 0.04) * alpha);
  layer.fillRoundedRect(worldX + 23, worldY + 23, 8, 5.5, 2);
  layer.fillStyle(0xe7d8ba, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 25, worldY + 24, 4, 1.5, 1);
}

function drawWorkyardDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const grit = sampleTileNoise(gridX, gridY, 97);
  layer.fillStyle(0x8d785f, (0.12 + grit * 0.04) * alpha);
  layer.fillCircle(worldX + 12, worldY + 12, 2.2);
  layer.fillCircle(worldX + 26, worldY + 24, 2.6);
  layer.lineStyle(1.2, 0x5a4933, 0.14 * alpha);
  layer.lineBetween(worldX + 8, worldY + 30, worldX + CELL - 8, worldY + 26);
  layer.lineBetween(worldX + 10, worldY + 11, worldX + CELL - 10, worldY + 14);
  layer.fillStyle(0x5e4d39, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 7, worldY + 18, 8, 4, 2);
  layer.fillRoundedRect(worldX + 22, worldY + 9, 9, 4, 2);
}

function sampleTileNoise(x: number, y: number, salt: number) {
  // Use low-frequency coherent noise so neighboring tiles blend instead of flickering as noisy cells.
  const scaledX = x * TILE_NOISE_SCALE + salt * 0.00091;
  const scaledY = y * TILE_NOISE_SCALE + salt * 0.00137;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tX = smoothstepUnit(scaledX - x0);
  const tY = smoothstepUnit(scaledY - y0);
  const n00 = tileNoiseHash(x0, y0, salt);
  const n10 = tileNoiseHash(x1, y0, salt);
  const n01 = tileNoiseHash(x0, y1, salt);
  const n11 = tileNoiseHash(x1, y1, salt);

  return mixScalar(mixScalar(n00, n10, tX), mixScalar(n01, n11, tX), tY);
}

function tileNoiseHash(x: number, y: number, salt: number) {
  const raw = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function mixScalar(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function smoothstepUnit(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function drawFringeTiles(layer: PhaserType.GameObjects.Graphics, map: CityMap) {
  const extendedGrid = getExtendedGridSize(map);
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;
  const extendedLookup = createExtendedTileLookup(map);

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const tile = fringeTileForCoordinate(column, row, map);
      if (!tile) {
        continue;
      }

      const { x: worldX, y: worldY } = worldGridToWorldOrigin(column, row);
      drawTileCell(
        layer,
        extendedLookup,
        column,
        row,
        worldX,
        worldY,
        tile.kind,
        tile.walkable,
        tile.alpha,
      );
    }
  }
}

function createExtendedTileLookup(map: CityMap) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const lookup = new Map<string, MapTile>();

  for (const tile of map.tiles) {
    lookup.set(`${tile.x + mapLeft},${tile.y + mapTop}`, tile);
  }

  const extendedGrid = getExtendedGridSize(map);
  const mapRight = mapLeft + map.width;
  const mapBottom = mapTop + map.height;

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const tile = fringeTileForCoordinate(column, row, map);
      if (!tile) {
        continue;
      }

      lookup.set(`${column},${row}`, {
        kind: tile.kind,
        walkable: tile.walkable,
        x: column,
        y: row,
      } as MapTile);
    }
  }

  return lookup;
}

function drawFringeBlocks(
  layer: PhaserType.GameObjects.Graphics,
  map: MapSize,
) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;
  const northWest = worldGridToWorldOrigin(0.2, 0.6);
  const northEast = worldGridToWorldOrigin(mapRight + 1.1, 0.9);
  const eastRow = worldGridToWorldOrigin(mapRight + 0.4, mapTop + 5.8);
  const lowerSlip = worldGridToWorldOrigin(mapRight + 1.8, mapBottom - 1.2);
  const westTall = worldGridToWorldOrigin(0.6, mapTop + 6.1);
  const southWest = worldGridToWorldOrigin(2.4, mapBottom - 2.5);
  const northBandLeft = worldGridToWorldOrigin(mapLeft - 7.3, mapTop - 5.7);
  const northBandCenterLeft = worldGridToWorldOrigin(
    mapLeft - 1.3,
    mapTop - 5.9,
  );
  const northBandCenterRight = worldGridToWorldOrigin(
    mapLeft + 10.3,
    mapTop - 5.8,
  );
  const northBandRight = worldGridToWorldOrigin(mapRight + 1.1, mapTop - 5.4);
  const northAlleyShadow = worldGridToWorldOrigin(mapLeft + 6.6, mapTop - 4.6);

  const northWestPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: 1,
    seedY: 1,
    worldX: northWest.x,
    worldY: northWest.y,
    width: CELL * 4.7,
    height: CELL * 3.1,
  });
  const northEastPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: 1,
    worldX: northEast.x,
    worldY: northEast.y,
    width: CELL * 4.9,
    height: CELL * 2.8,
  });
  const eastPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: mapTop + 6,
    worldX: eastRow.x,
    worldY: eastRow.y,
    width: CELL * 2.8,
    height: CELL * 4.6,
  });
  drawArchitecturalMass(layer, {
    kind: "dock",
    seedX: mapRight + 2,
    seedY: mapBottom - 1,
    worldX: lowerSlip.x,
    worldY: lowerSlip.y,
    width: CELL * 2.5,
    height: CELL * 2.2,
  });
  const westTallPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: 2,
    seedY: mapTop + 6,
    worldX: westTall.x,
    worldY: westTall.y,
    width: CELL * 2.3,
    height: CELL * 4.9,
  });
  const northBandLeftPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft - 7,
    seedY: mapTop - 6,
    worldX: northBandLeft.x,
    worldY: northBandLeft.y,
    width: CELL * 5.4,
    height: CELL * 3.6,
  });
  const northBandCenterLeftPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft - 1,
    seedY: mapTop - 6,
    worldX: northBandCenterLeft.x,
    worldY: northBandCenterLeft.y,
    width: CELL * 4.2,
    height: CELL * 4.8,
  });
  const northBandCenterRightPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft + 10,
    seedY: mapTop - 6,
    worldX: northBandCenterRight.x,
    worldY: northBandCenterRight.y,
    width: CELL * 4.6,
    height: CELL * 4.1,
  });
  const northBandRightPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: mapTop - 5,
    worldX: northBandRight.x,
    worldY: northBandRight.y,
    width: CELL * 4.9,
    height: CELL * 3.8,
  });
  drawArchitecturalMass(layer, {
    kind: "yard",
    seedX: 3,
    seedY: mapBottom - 2,
    worldX: southWest.x,
    worldY: southWest.y,
    width: CELL * 3.4,
    height: CELL * 2.2,
  });
  drawBuildingDetail(
    layer,
    northWest.x,
    northWest.y,
    CELL * 4.7,
    CELL * 3.1,
    northWestPalette,
  );
  drawBuildingDetail(
    layer,
    northEast.x,
    northEast.y,
    CELL * 4.9,
    CELL * 2.8,
    northEastPalette,
  );
  drawBuildingDetail(
    layer,
    eastRow.x,
    eastRow.y,
    CELL * 2.8,
    CELL * 4.6,
    eastPalette,
  );
  drawBuildingDetail(
    layer,
    westTall.x,
    westTall.y,
    CELL * 2.3,
    CELL * 4.9,
    westTallPalette,
  );
  drawBuildingDetail(
    layer,
    northBandLeft.x,
    northBandLeft.y,
    CELL * 5.4,
    CELL * 3.6,
    northBandLeftPalette,
  );
  drawBuildingDetail(
    layer,
    northBandCenterLeft.x,
    northBandCenterLeft.y,
    CELL * 4.2,
    CELL * 4.8,
    northBandCenterLeftPalette,
  );
  drawBuildingDetail(
    layer,
    northBandCenterRight.x,
    northBandCenterRight.y,
    CELL * 4.6,
    CELL * 4.1,
    northBandCenterRightPalette,
  );
  drawBuildingDetail(
    layer,
    northBandRight.x,
    northBandRight.y,
    CELL * 4.9,
    CELL * 3.8,
    northBandRightPalette,
  );
  drawDockDetail(
    layer,
    mapRight + 2,
    mapBottom - 1,
    lowerSlip.x,
    lowerSlip.y,
    0.7,
  );
  layer.fillStyle(0x071015, 0.22);
  layer.fillRoundedRect(
    northAlleyShadow.x,
    northAlleyShadow.y,
    CELL * 2.8,
    CELL * 4.4,
    12,
  );
  layer.fillStyle(0xf0d5a0, 0.06);
  layer.fillRect(
    northAlleyShadow.x + CELL * 1.28,
    northAlleyShadow.y + 26,
    5,
    CELL * 2.2,
  );
}

function drawFringeProps(layer: PhaserType.GameObjects.Graphics, map: MapSize) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapRight = mapLeft + map.width;
  const mapBottom = mapTop + map.height;
  const northLamp = worldGridToWorldOrigin(mapLeft - 1.6, mapTop + 4.6);
  const westTree = worldGridToWorldOrigin(mapLeft - 4.7, mapBottom - 1.2);
  const eastLamp = worldGridToWorldOrigin(mapRight + 3.1, mapTop + 8.4);
  const dockLamp = worldGridToWorldOrigin(mapRight + 1.4, mapBottom - 3.2);
  const laundry = worldGridToWorldOrigin(mapLeft - 1.2, mapTop + 7.2);
  const cratePile = worldGridToWorldOrigin(mapRight + 0.9, mapBottom - 2.3);
  const bollard = worldGridToWorldOrigin(mapRight + 1.2, mapBottom - 0.2);
  const signboard = worldGridToWorldOrigin(mapLeft + 11.2, mapTop - 1.5);
  const roofTank = worldGridToWorldOrigin(mapLeft - 4.4, mapTop - 2.2);
  const alleyLaundry = worldGridToWorldOrigin(mapLeft + 7.7, mapTop - 1.3);

  layer.lineStyle(3, 0xd3c89a, 0.5);
  layer.lineBetween(
    northLamp.x,
    northLamp.y + 10,
    northLamp.x,
    northLamp.y - 11,
  );
  layer.fillStyle(0xf0dca6, 0.44);
  layer.fillCircle(northLamp.x, northLamp.y - 13, 4);
  layer.lineBetween(eastLamp.x, eastLamp.y + 10, eastLamp.x, eastLamp.y - 11);
  layer.fillCircle(eastLamp.x, eastLamp.y - 13, 4);
  layer.lineBetween(dockLamp.x, dockLamp.y + 10, dockLamp.x, dockLamp.y - 11);
  layer.fillCircle(dockLamp.x, dockLamp.y - 13, 4);

  layer.fillStyle(0x2e5036, 0.78);
  layer.fillCircle(westTree.x - 5, westTree.y - 5, 7);
  layer.fillCircle(westTree.x + 5, westTree.y - 7, 8);
  layer.fillStyle(0x4a7651, 0.82);
  layer.fillCircle(westTree.x, westTree.y - 9, 11);
  layer.fillStyle(0x7d593d, 0.78);
  layer.fillRect(westTree.x - 2, westTree.y - 2, 4, 12);

  layer.lineStyle(2, 0xd8d2bf, 0.42);
  layer.lineBetween(
    laundry.x - 14,
    laundry.y - 10,
    laundry.x + 14,
    laundry.y - 10,
  );
  layer.fillStyle(0xc99172, 0.84);
  layer.fillRect(laundry.x - 11, laundry.y - 8, 6, 10);
  layer.fillStyle(0x8fb0ca, 0.82);
  layer.fillRect(laundry.x - 1, laundry.y - 8, 7, 11);

  layer.fillStyle(0x8e6a4b, 0.88);
  layer.fillRoundedRect(cratePile.x - 10, cratePile.y - 8, 11, 11, 3);
  layer.fillRoundedRect(cratePile.x + 1, cratePile.y - 5, 9, 9, 3);
  layer.lineStyle(1, 0xd8bf98, 0.18);
  layer.strokeRoundedRect(cratePile.x - 10, cratePile.y - 8, 11, 11, 3);
  layer.strokeRoundedRect(cratePile.x + 1, cratePile.y - 5, 9, 9, 3);

  layer.fillStyle(0x505a62, 0.9);
  layer.fillRoundedRect(bollard.x - 3, bollard.y - 4, 6, 11, 2);

  layer.fillStyle(0x7c6047, 0.9);
  layer.fillRoundedRect(signboard.x - 12, signboard.y - 5, 24, 10, 3);
  layer.lineStyle(1.6, 0xd8c19a, 0.2);
  layer.lineBetween(
    signboard.x - 8,
    signboard.y - 1,
    signboard.x + 8,
    signboard.y - 1,
  );

  layer.fillStyle(0x3b4853, 0.82);
  layer.fillRoundedRect(roofTank.x - 9, roofTank.y - 7, 18, 14, 4);
  layer.fillStyle(0x1e2a33, 0.3);
  layer.fillRoundedRect(roofTank.x - 6, roofTank.y - 4, 12, 3, 2);
  layer.lineStyle(1.6, 0x8696a2, 0.16);
  layer.lineBetween(
    roofTank.x - 4,
    roofTank.y + 7,
    roofTank.x - 6,
    roofTank.y + 14,
  );
  layer.lineBetween(
    roofTank.x + 4,
    roofTank.y + 7,
    roofTank.x + 6,
    roofTank.y + 14,
  );

  layer.lineStyle(2, 0xd9d1be, 0.3);
  layer.lineBetween(
    alleyLaundry.x - 14,
    alleyLaundry.y - 12,
    alleyLaundry.x + 14,
    alleyLaundry.y - 14,
  );
  layer.fillStyle(0xc68f72, 0.72);
  layer.fillRect(alleyLaundry.x - 9, alleyLaundry.y - 10, 5, 8);
  layer.fillStyle(0x8fa6c1, 0.72);
  layer.fillRect(alleyLaundry.x - 1, alleyLaundry.y - 11, 5, 9);
}

function fringeTileForCoordinate(
  column: number,
  row: number,
  map: CityMap,
): { alpha: number; kind: TileKind; walkable: boolean } | null {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width - 1;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height - 1;
  const projectedX = clamp(column - mapLeft, 0, map.width - 1);
  const projectedY = clamp(row - mapTop, 0, map.height - 1);
  const baseTile = getMapTile(map, projectedX, projectedY);

  if (!baseTile) {
    return null;
  }

  const horizontalDistance =
    column < mapLeft
      ? mapLeft - column
      : column > mapRight
        ? column - mapRight
        : 0;
  const verticalDistance =
    row < mapTop ? mapTop - row : row > mapBottom ? row - mapBottom : 0;
  const edgeDistance = Math.max(horizontalDistance, verticalDistance);
  const alpha = clamp(0.92 - edgeDistance * 0.055, 0.56, 0.9);
  const projectedKind = projectFringeTileKind(
    baseTile.kind,
    horizontalDistance,
    verticalDistance,
    column < mapLeft
      ? "west"
      : column > mapRight
        ? "east"
        : row < mapTop
          ? "north"
          : "south",
  );

  return {
    alpha,
    kind: projectedKind.kind,
    walkable: projectedKind.walkable,
  };
}

function getMapTile(map: CityMap, x: number, y: number) {
  const direct = map.tiles[y * map.width + x];
  if (direct && direct.x === x && direct.y === y) {
    return direct;
  }

  return map.tiles.find((tile) => tile.x === x && tile.y === y);
}

function projectFringeTileKind(
  baseKind: TileKind,
  horizontalDistance: number,
  verticalDistance: number,
  edge: "east" | "north" | "south" | "west",
): { kind: TileKind; walkable: boolean } {
  const distance = Math.max(horizontalDistance, verticalDistance);

  switch (baseKind) {
    case "stoop":
      return {
        kind: distance <= 2 && edge === "north" ? "lane" : "roof",
        walkable: distance <= 2 && edge === "north",
      };
    case "plaza":
      return {
        kind: distance <= 2 ? "plaza" : "lane",
        walkable: true,
      };
    case "workyard":
      return {
        kind: edge === "south" && distance >= 3 ? "dock" : "workyard",
        walkable: true,
      };
    case "courtyard":
      return {
        kind: distance >= 4 ? "garden" : "courtyard",
        walkable: distance < 4,
      };
    case "dock":
      return {
        kind: distance >= 2 ? "water" : "dock",
        walkable: distance < 2,
      };
    case "garden":
      return {
        kind: verticalDistance >= 2 ? "water" : "garden",
        walkable: false,
      };
    case "lane":
      return {
        kind: "lane",
        walkable: true,
      };
    case "roof":
      return {
        kind: "roof",
        walkable: false,
      };
    case "water":
      return {
        kind: "water",
        walkable: false,
      };
    default:
      return {
        kind: "lane",
        walkable: true,
      };
  }
}

function pickDefaultSelectedNpcId(game: StreetGameState | null) {
  if (!game) {
    return null;
  }

  if (game.activeConversation?.npcId) {
    return game.activeConversation.npcId;
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

function getConversationThreadState(game: StreetGameState, npcId: string) {
  return Object.values(game.conversationThreads ?? {}).find(
    (candidate) => candidate.npcId === npcId,
  );
}

function getConversationPreview(game: StreetGameState, npcId: string) {
  const thread = getConversationThreadState(game, npcId);

  if (thread?.lines.length) {
    return thread.lines;
  }

  return game.conversations.filter((entry) => entry.npcId === npcId);
}

function splitConversationStreamWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function revealConversationText(text: string, wordCount: number) {
  const words = splitConversationStreamWords(text);
  if (words.length === 0) {
    return "";
  }

  return words.slice(0, Math.max(1, wordCount)).join(" ");
}

function conversationActorForSpeaker(
  speaker: StreetGameState["conversations"][number]["speaker"],
) {
  return speaker === "player" ? "rowan" : "npc";
}

function findPreviousConversationSpeaker(
  entries: StreetGameState["conversations"],
  entryId: string,
) {
  const nextIndex = entries.findIndex((entry) => entry.id === entryId);
  if (nextIndex <= 0) {
    return undefined;
  }

  return entries[nextIndex - 1]?.speaker;
}

function conversationEntryStartDelayMs(
  previousSpeaker:
    | StreetGameState["conversations"][number]["speaker"]
    | undefined,
  nextSpeaker: StreetGameState["conversations"][number]["speaker"] | undefined,
) {
  if (!nextSpeaker) {
    return 0;
  }

  if (!previousSpeaker) {
    return CONVERSATION_STREAM_FIRST_ENTRY_PAUSE_MS;
  }

  if (previousSpeaker === nextSpeaker) {
    return CONVERSATION_STREAM_SAME_SPEAKER_PAUSE_MS;
  }

  return CONVERSATION_STREAM_TURN_CHANGE_PAUSE_MS;
}

function conversationWordDelayMs(
  speaker: StreetGameState["conversations"][number]["speaker"],
) {
  return speaker === "player"
    ? CONVERSATION_STREAM_PLAYER_WORD_DELAY_MS
    : CONVERSATION_STREAM_NPC_WORD_DELAY_MS;
}

function conversationStreamDelayMs(
  speaker: StreetGameState["conversations"][number]["speaker"],
  visibleWordCount: number,
) {
  const baseDelay = conversationWordDelayMs(speaker);

  if (visibleWordCount <= 1) {
    return CONVERSATION_STREAM_INITIAL_DELAY_MS + baseDelay;
  }

  return baseDelay;
}

function buildConversationReplaySignature(
  activeConversation: NonNullable<StreetGameState["activeConversation"]>,
) {
  const lineIds = activeConversation.lines.map((entry) => entry.id).join("|");
  return `${activeConversation.threadId}:${lineIds}`;
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
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
    return "I could use a proper sit-down.";
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

function createRouteFinder(tiles: MapTile[]) {
  const walkableTiles = tiles.filter((tile) => tile.walkable);
  const walkable = new Set(walkableTiles.map((tile) => `${tile.x},${tile.y}`));
  const tileByKey = new Map<string, MapTile>(
    walkableTiles.map((tile) => [`${tile.x},${tile.y}`, tile]),
  );
  const clearancePenaltyByKey = new Map<string, number>();
  const cache = new Map<string, Point[]>();

  for (const tile of walkableTiles) {
    const key = `${tile.x},${tile.y}`;
    let penalty = 0;

    for (const offset of ROUTE_CLEARANCE_OFFSETS) {
      if (!walkable.has(`${tile.x + offset.x},${tile.y + offset.y}`)) {
        penalty += offset.weight;
      }
    }

    clearancePenaltyByKey.set(key, penalty);
  }

  return (start: Point, end: Point) => {
    const roundedStart = {
      x: Math.round(start.x),
      y: Math.round(start.y),
    };
    const roundedEnd = {
      x: Math.round(end.x),
      y: Math.round(end.y),
    };
    const startTile = `${roundedStart.x},${roundedStart.y}`;
    const endTile = `${roundedEnd.x},${roundedEnd.y}`;
    const cacheKey = `${startTile}->${endTile}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const frontier: Array<{
      cost: number;
      point: Point;
      priority: number;
    }> = [
      {
        cost: 0,
        point: roundedStart,
        priority: routeHeuristic(roundedStart, roundedEnd),
      },
    ];
    const bestCostByKey = new Map([[startTile, 0]]);
    const parentByKey = new Map<string, string>();
    let foundKey = startTile;

    while (frontier.length > 0) {
      let bestIndex = 0;
      for (let index = 1; index < frontier.length; index += 1) {
        if (frontier[index].priority < frontier[bestIndex].priority) {
          bestIndex = index;
        }
      }

      const currentEntry = frontier.splice(bestIndex, 1)[0];
      const current = currentEntry.point;
      const currentKey = `${current.x},${current.y}`;
      const bestKnownCost = bestCostByKey.get(currentKey);

      if (
        bestKnownCost === undefined ||
        currentEntry.cost > bestKnownCost + 0.0001
      ) {
        continue;
      }

      if (currentKey === endTile) {
        foundKey = currentKey;
        break;
      }

      for (const offset of ROUTE_NEIGHBOR_OFFSETS) {
        const nextX = current.x + offset.x;
        const nextY = current.y + offset.y;
        const nextKey = `${nextX},${nextY}`;
        const nextTile = tileByKey.get(nextKey);

        if (!nextTile) {
          continue;
        }

        const nextCost =
          currentEntry.cost +
          routeTileTraversalCost(
            nextTile,
            clearancePenaltyByKey.get(nextKey) ?? 0,
          );

        if (
          nextCost >= (bestCostByKey.get(nextKey) ?? Number.POSITIVE_INFINITY)
        ) {
          continue;
        }

        bestCostByKey.set(nextKey, nextCost);
        parentByKey.set(nextKey, currentKey);
        frontier.push({
          cost: nextCost,
          point: {
            x: nextX,
            y: nextY,
          },
          priority:
            nextCost + routeHeuristic({ x: nextX, y: nextY }, roundedEnd),
        });
      }
    }

    if (foundKey !== endTile) {
      const fallback = [roundedStart];
      cache.set(cacheKey, fallback);
      return fallback;
    }

    const path: Point[] = [];
    let currentKey: string | undefined = foundKey;

    while (currentKey) {
      const [x, y] = currentKey.split(",").map(Number);
      path.unshift({ x, y });
      currentKey = parentByKey.get(currentKey);
    }

    cache.set(cacheKey, path);
    return path;
  };
}

function routeHeuristic(from: Point, to: Point) {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function routeTileTraversalCost(tile: MapTile, clearancePenalty: number) {
  return routeTileKindCost(tile.kind) + clearancePenalty * 0.16;
}

function routeTileKindCost(kind: TileKind) {
  switch (kind) {
    case "lane":
      return 1;
    case "plaza":
      return 1.04;
    case "stoop":
      return 1.08;
    case "dock":
      return 1.12;
    case "courtyard":
      return 1.34;
    case "workyard":
      return 1.42;
    default:
      return 1.18;
  }
}

function routeReachesDestination(route: Point[], destination: Point) {
  const endpoint = route[route.length - 1];
  return Boolean(
    endpoint &&
    endpoint.x === Math.round(destination.x) &&
    endpoint.y === Math.round(destination.y),
  );
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

function buildNpcPatrolPath({
  door,
  findRoute,
  location,
  nextLocation,
  props,
  visualHints,
  walkableRuntimePoints,
}: {
  door?: MapDoor;
  findRoute: (start: Point, end: Point) => Point[];
  location: LocationState;
  nextLocation?: LocationState;
  props: MapProp[];
  visualHints?: Point[];
  walkableRuntimePoints: WalkableRuntimePoint[];
}) {
  const entryPoint = door
    ? { x: door.x + door.width / 2, y: door.y + door.height / 2 }
    : { x: location.entryX + 0.5, y: location.entryY + 0.5 };
  const preferredKinds = preferredWalkableKindsForLocation(location.type);
  const entryWalkablePoint = findNearestWalkablePointByTileHint(
    walkableRuntimePoints,
    entryPoint,
    {
      preferredKinds,
      preferredLocationId: location.id,
    },
  );
  const centerPoint = {
    x: location.x + location.width / 2,
    y: location.y + location.height / 2,
  };
  const pump = props.find((prop) => prop.kind === "pump");

  let basePath: Point[];

  switch (location.type) {
    case "square":
      basePath = [
        entryPoint,
        { x: location.x + 1.4, y: location.y + 1.1 },
        { x: location.x + location.width - 1.2, y: location.y + 1.15 },
        {
          x: location.x + location.width - 1.05,
          y: location.y + location.height - 1.1,
        },
        { x: location.x + 1.2, y: location.y + location.height - 1.0 },
      ];
      break;
    case "workyard":
      basePath = [
        entryPoint,
        { x: location.x + 1.2, y: location.y + 1.15 },
        { x: location.x + location.width - 1.15, y: location.y + 1.15 },
        {
          x: location.x + location.width - 1.15,
          y: location.y + location.height - 1.0,
        },
        centerPoint,
        { x: location.x + 1.25, y: location.y + location.height - 1.05 },
      ];
      break;
    case "courtyard":
      basePath = [
        entryPoint,
        { x: location.x + 1.2, y: location.y + 1.2 },
        pump
          ? { x: pump.x, y: pump.y }
          : {
              x: location.x + location.width / 2,
              y: location.y + location.height / 2,
            },
        { x: location.x + location.width - 1.1, y: location.y + 1.3 },
        {
          x: location.x + location.width - 1.4,
          y: location.y + location.height - 1.0,
        },
        { x: location.x + 1.35, y: location.y + location.height - 1.05 },
      ];
      break;
    case "pier":
      basePath = [
        entryPoint,
        { x: location.x + 1.45, y: location.y + 1.6 },
        { x: location.x + location.width - 1.15, y: location.y + 1.4 },
        { x: location.x + location.width - 1.7, y: location.y + 0.95 },
        { x: location.x + 1.7, y: location.y + 0.9 },
      ];
      break;
    default:
      basePath = [
        entryPoint,
        { x: entryPoint.x - 0.85, y: entryPoint.y + 0.08 },
        { x: entryPoint.x + 0.9, y: entryPoint.y - 0.04 },
        { x: entryPoint.x + 0.15, y: entryPoint.y - 0.82 },
      ];
      break;
  }

  const routedVisualLoop = stitchWalkableTilePath(
    findRoute,
    [
      entryWalkablePoint?.tile,
      ...(visualHints ?? []).map(
        (point) =>
          findNearestWalkablePointByWorldHint(walkableRuntimePoints, point, {
            preferredKinds,
            preferredLocationId: location.id,
          })?.tile,
      ),
    ].filter(isPresent),
    {
      closed: true,
    },
  ).map(tilePointToCenter);

  const routedBaseLoop = stitchWalkableTilePath(
    findRoute,
    [
      entryWalkablePoint?.tile,
      ...basePath.map(
        (point) =>
          findNearestWalkablePointByTileHint(walkableRuntimePoints, point, {
            preferredKinds,
            preferredLocationId: location.id,
          })?.tile,
      ),
    ].filter(isPresent),
    {
      closed: true,
    },
  ).map(tilePointToCenter);

  const loopPath =
    routedVisualLoop.length > 1
      ? routedVisualLoop
      : routedBaseLoop.length > 0
        ? routedBaseLoop
        : [
            entryWalkablePoint
              ? tilePointToCenter(entryWalkablePoint.tile)
              : entryPoint,
          ];

  if (nextLocation && nextLocation.id !== location.id) {
    const nextEntryWalkablePoint = findNearestWalkablePointByTileHint(
      walkableRuntimePoints,
      {
        x: nextLocation.entryX + 0.5,
        y: nextLocation.entryY + 0.5,
      },
      {
        preferredKinds: preferredWalkableKindsForLocation(nextLocation.type),
        preferredLocationId: nextLocation.id,
      },
    );

    if (entryWalkablePoint && nextEntryWalkablePoint) {
      const fullRouteOut = findRoute(
        entryWalkablePoint.tile,
        nextEntryWalkablePoint.tile,
      );

      if (routeReachesDestination(fullRouteOut, nextEntryWalkablePoint.tile)) {
        const routeOut = fullRouteOut
          .slice(1, location.type === "square" ? 8 : 7)
          .map(tilePointToCenter);

        if (routeOut.length > 1) {
          return dedupePointSequence([
            ...loopPath,
            ...routeOut,
            ...[...routeOut].reverse().slice(1),
          ]);
        }
      }
    }
  }

  return loopPath;
}

function preferredWalkableKindsForLocation(locationType?: string): TileKind[] {
  switch (locationType) {
    case "square":
      return ["plaza", "lane", "stoop"];
    case "workyard":
      return ["workyard", "lane", "stoop"];
    case "courtyard":
      return ["courtyard", "stoop", "lane"];
    case "pier":
      return ["dock", "lane"];
    default:
      return ["stoop", "lane", "plaza"];
  }
}

function findNearestWalkablePointByTileHint(
  walkableRuntimePoints: WalkableRuntimePoint[],
  point: Point,
  options: WalkablePointSearchOptions = {},
) {
  let bestPoint: WalkableRuntimePoint | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of walkableRuntimePoints) {
    const score =
      distanceBetween(candidate.tileCenter, point) +
      walkableSearchPenalty(candidate, options);

    if (score < bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

function findNearestWalkablePointByWorldHint(
  walkableRuntimePoints: WalkableRuntimePoint[],
  point: Point,
  options: WalkablePointSearchOptions = {},
) {
  let bestPoint: WalkableRuntimePoint | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of walkableRuntimePoints) {
    const score =
      distanceBetween(candidate.world, point) / CELL +
      walkableSearchPenalty(candidate, options);

    if (score < bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

function walkableSearchPenalty(
  point: Pick<WalkableRuntimePoint, "kind" | "locationId">,
  options: WalkablePointSearchOptions,
) {
  let penalty = 0;

  if (
    options.preferredLocationId &&
    point.locationId !== options.preferredLocationId
  ) {
    penalty += 1.35;
  }

  if (
    options.preferredKinds &&
    options.preferredKinds.length > 0 &&
    !options.preferredKinds.includes(point.kind)
  ) {
    penalty += 0.85;
  }

  return penalty;
}

function stitchWalkableTilePath(
  routeFinder: (start: Point, end: Point) => Point[],
  waypoints: Point[],
  options: {
    closed?: boolean;
  } = {},
) {
  const roundedWaypoints = dedupeGridPointSequence(
    waypoints.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
    })),
  );

  if (roundedWaypoints.length === 0) {
    return [];
  }

  const targets = options.closed
    ? [...roundedWaypoints, roundedWaypoints[0]]
    : roundedWaypoints;
  const path: Point[] = [targets[0]];

  for (let index = 1; index < targets.length; index += 1) {
    const from = path[path.length - 1];
    const to = targets[index];

    if (sameGridPoint(from, to)) {
      continue;
    }

    const route = routeFinder(from, to);
    const segment = routeReachesDestination(route, to)
      ? options.closed && index === targets.length - 1
        ? route.slice(1, -1)
        : route.slice(1)
      : [to];

    for (const point of segment) {
      pushDistinctGridPoint(path, point);
    }
  }

  if (options.closed) {
    pushDistinctGridPoint(path, roundedWaypoints[0]);
  }

  return path;
}

function dedupeGridPointSequence(points: Point[]) {
  const deduped: Point[] = [];

  for (const point of points) {
    pushDistinctGridPoint(deduped, point);
  }

  return deduped;
}

function pushDistinctGridPoint(points: Point[], point: Point) {
  if (points.length === 0 || !sameGridPoint(points[points.length - 1], point)) {
    points.push(point);
  }
}

function sameGridPoint(left: Point, right: Point) {
  return left.x === right.x && left.y === right.y;
}

function tilePointToCenter(point: Point) {
  return {
    x: point.x + 0.5,
    y: point.y + 0.5,
  };
}

function dedupePointSequence(points: Point[]) {
  const deduped: Point[] = [];

  for (const point of points) {
    if (
      deduped.length === 0 ||
      distanceBetween(deduped[deduped.length - 1], point) > 0.001
    ) {
      deduped.push(point);
    }
  }

  return deduped;
}

function patrolCycleSeconds(locationType?: string) {
  switch (locationType) {
    case "square":
      return 18;
    case "workyard":
      return 16;
    case "pier":
      return 14;
    default:
      return 11.5;
  }
}

function loopPathDistance(path: Point[]) {
  if (path.length <= 1) {
    return 0;
  }

  return path.reduce((sum, point, index) => {
    const next = path[(index + 1) % path.length];
    return sum + distanceBetween(point, next);
  }, 0);
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

function playerTileToWorld(point: Point, indices: RuntimeIndices) {
  return projectRuntimeTileCenter(indices, point.x, point.y);
}

function sampleLoopPath(path: Point[], progress: number) {
  if (path.length === 0) {
    return { x: 0, y: 0 };
  }

  if (path.length === 1) {
    return path[0];
  }

  const segments = path.map((point, index) => ({
    from: point,
    to: path[(index + 1) % path.length],
  }));
  const totalLength = segments.reduce(
    (sum, segment) => sum + distanceBetween(segment.from, segment.to),
    0,
  );
  const target = totalLength * progress;
  let covered = 0;

  for (const segment of segments) {
    const segmentLength = distanceBetween(segment.from, segment.to);

    if (covered + segmentLength >= target) {
      const localProgress =
        segmentLength === 0 ? 0 : (target - covered) / segmentLength;
      return interpolatePoint(segment.from, segment.to, localProgress);
    }

    covered += segmentLength;
  }

  return path[path.length - 1];
}

function samplePathPoint(path: Point[], progress: number) {
  if (path.length === 0) {
    return { x: 0, y: 0 };
  }

  if (path.length === 1) {
    return path[0];
  }

  const segments = path.slice(0, -1).map((point, index) => ({
    from: point,
    to: path[index + 1],
  }));
  const totalLength = segments.reduce(
    (sum, segment) => sum + distanceBetween(segment.from, segment.to),
    0,
  );
  const target = totalLength * progress;
  let covered = 0;

  for (const segment of segments) {
    const segmentLength = distanceBetween(segment.from, segment.to);

    if (covered + segmentLength >= target) {
      const localProgress =
        segmentLength === 0 ? 0 : (target - covered) / segmentLength;
      return interpolatePoint(segment.from, segment.to, localProgress);
    }

    covered += segmentLength;
  }

  return path[path.length - 1];
}

function interpolatePoint(from: Point, to: Point, progress: number) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function perpendicularNormal(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0.0001) {
    return { x: 0, y: 0 };
  }

  return {
    x: -dy / distance,
    y: dx / distance,
  };
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

function tabLabel(tab: UiState["activeTab"]) {
  switch (tab) {
    case "people":
      return "Locals";
    case "journal":
      return "Journal";
    case "mind":
      return "Mind";
    default:
      return "World";
  }
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
            : "Agent Card"
          : "People In Reach",
        subtitle: selectedNpc
          ? isLiveConversation
            ? `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust} • actively updating the thread`
            : `${selectedPersonality?.badge ?? selectedNpc.role} • mood ${selectedNpc.mood} • trust ${selectedNpc.trust}`
          : `People Rowan can read or approach in ${game.currentScene.title}.`,
        title: selectedNpc?.name ?? "Locals",
      };
    case "journal":
      return {
        kicker: "Field Notes",
        subtitle:
          "Objectives, feed, and the cleanest read on what Rowan should do next.",
        title: "Journal",
      };
    case "mind":
      return {
        kicker: "Working Memory",
        subtitle:
          "The places, people, and threads Rowan is actively holding together.",
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function colorForProp(kind: MapProp["kind"]) {
  switch (kind) {
    case "barrel":
      return 0x84654c;
    case "bench":
      return 0x78604d;
    case "bollard":
      return 0x5a636a;
    case "boat":
      return 0x6b5342;
    case "canopy":
      return 0xba795f;
    case "crate":
      return 0x8a6a4d;
    case "fountain":
      return 0x7f939e;
    case "planter":
      return 0x58754f;
    case "pump":
      return 0x6e848f;
    default:
      return 0x75838b;
  }
}

function toneColor(tone: MapLabel["tone"]) {
  switch (tone) {
    case "district":
      return "#f1dfb8";
    case "landmark":
      return "#f0e2bf";
    case "street":
      return "#d4d8d1";
    default:
      return "#f0e2bf";
  }
}

function blendColor(base: number, mix: number, amount: number) {
  const clampedAmount = Math.max(0, Math.min(amount, 1));
  const red = Math.round(
    ((base >> 16) & 0xff) * (1 - clampedAmount) +
      ((mix >> 16) & 0xff) * clampedAmount,
  );
  const green = Math.round(
    ((base >> 8) & 0xff) * (1 - clampedAmount) +
      ((mix >> 8) & 0xff) * clampedAmount,
  );
  const blue = Math.round(
    (base & 0xff) * (1 - clampedAmount) + (mix & 0xff) * clampedAmount,
  );

  return (red << 16) | (green << 8) | blue;
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
