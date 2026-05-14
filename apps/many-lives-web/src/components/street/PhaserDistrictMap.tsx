"use client";

import type PhaserType from "phaser";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  LocationState,
  MapDoor,
  MapFootprint,
  MapLabel,
  MapProp,
  MapTile,
  NpcState,
  StreetGameState,
  TileKind,
} from "@/lib/street/types";

const CELL = 40;
const WORLD_PADDING = 24;
const CANVAS_MIN_HEIGHT_PX = 460;
const DEFAULT_PLAYER_MOVE_MS_PER_TILE = 320;
const PLAYER_MAX_MOVE_DURATION_MS = 4800;
const PLAYER_MOVE_DURATION_MULTIPLIER = 0.42;
const PLAYER_CAMERA_LERP = 0.08;
const OPEN_SURFACE_KINDS = new Set<TileKind>([
  "lane",
  "plaza",
  "stoop",
  "workyard",
  "courtyard",
  "dock",
]);

type Point = {
  x: number;
  y: number;
};

type SnapshotPlayerState = Pick<
  StreetGameState["player"],
  | "activeJobId"
  | "currentLocationId"
  | "currentThought"
  | "energy"
  | "inventory"
  | "knownLocationIds"
  | "knownNpcIds"
  | "money"
  | "name"
  | "reputation"
> & {
  objectiveText?: string;
  x: number;
  y: number;
};

type DistrictMapSnapshot = {
  activeConversationEntries: StreetGameState["conversations"];
  activeConversationNpcId?: string;
  busy: boolean;
  clock: StreetGameState["clock"];
  jobs: StreetGameState["jobs"];
  locations: LocationState[];
  map: StreetGameState["map"];
  npcs: NpcState[];
  player: SnapshotPlayerState;
  problems: StreetGameState["problems"];
  viewport: {
    height: number;
    width: number;
  };
  world: {
    height: number;
    width: number;
  };
};

type PlayerMotionState = {
  durationMs: number;
  path: Point[];
  startedAt: number;
  to: Point;
};

type DistrictMapRuntime = {
  destroy: () => void;
  updateSnapshot: (snapshot: DistrictMapSnapshot) => void;
};

type RuntimeIndices = {
  footprintByLocationId: Map<string, MapFootprint>;
  locationsById: Map<string, LocationState>;
  primaryDoorByLocation: Map<string, MapDoor>;
  propsByLocation: Map<string, MapProp[]>;
  routeFinder: (start: Point, end: Point) => Point[];
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
  body: PhaserType.GameObjects.Arc;
  container: PhaserType.GameObjects.Container;
  label: PhaserType.GameObjects.Text;
  outline: PhaserType.GameObjects.Arc;
};

type RuntimeObjects = {
  clockBadge: PhaserType.GameObjects.Text;
  conversationCard: PhaserType.GameObjects.Text;
  locationBadge: PhaserType.GameObjects.Text;
  mapLabels: PhaserType.GameObjects.Text[];
  npcMarkers: Map<string, NpcMarkerObjects>;
  overlayLayer: PhaserType.GameObjects.Graphics;
  playerContainer: PhaserType.GameObjects.Container;
  playerOutline: PhaserType.GameObjects.Arc;
  playerPulse: PhaserType.GameObjects.Arc;
  playerThoughtPanel: PhaserType.GameObjects.Text;
  scene: PhaserType.Scene;
  statusBadge: PhaserType.GameObjects.Text;
  structureLayer: PhaserType.GameObjects.Graphics;
  terrainLayer: PhaserType.GameObjects.Graphics;
};

type RuntimeState = {
  indices: RuntimeIndices;
  mapKey: string;
  objects: RuntimeObjects | null;
  playerMotion: PlayerMotionState;
};

const TILE_COLORS: Record<TileKind, number> = {
  courtyard: 0x48614d,
  dock: 0x6a5741,
  garden: 0x456947,
  lane: 0x52636e,
  plaza: 0x7d715d,
  roof: 0x171c21,
  stoop: 0x5a6771,
  water: 0x346580,
  workyard: 0x716856,
};

export function PhaserDistrictMap({
  game,
  onTileClick,
  busy,
  playerPosition,
  activeConversationNpcId,
  activeConversationEntries = [],
}: {
  activeConversationEntries?: StreetGameState["conversations"];
  activeConversationNpcId?: string;
  busy: boolean;
  game: StreetGameState;
  onTileClick: (x: number, y: number) => void;
  playerPosition?: Point;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<DistrictMapRuntime | null>(null);
  const onTileClickRef = useRef(onTileClick);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onTileClickRef.current = onTileClick;
  }, [onTileClick]);

  const snapshot = useMemo(
    () =>
      buildSnapshot(
        game,
        busy,
        playerPosition,
        activeConversationNpcId,
        activeConversationEntries,
      ),
    [activeConversationEntries, activeConversationNpcId, busy, game, playerPosition],
  );

  const latestSnapshotRef = useRef(snapshot);
  useEffect(() => {
    latestSnapshotRef.current = snapshot;
    runtimeRef.current?.updateSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    void createDistrictMapRuntime({
      initialSnapshot: latestSnapshotRef.current,
      mount,
      onTileClick: (x, y) => {
        onTileClickRef.current(x, y);
      },
    })
      .then((runtime) => {
        if (cancelled) {
          runtime.destroy();
          return;
        }

        runtimeRef.current = runtime;
        runtime.updateSnapshot(latestSnapshotRef.current);
        setLoadError(null);
        setIsReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to start the Phaser street scene.",
        );
      });

    return () => {
      cancelled = true;
      setIsReady(false);
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, [snapshot.viewport.height, snapshot.viewport.width]);

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[rgba(134,145,154,0.26)] bg-[radial-gradient(circle_at_top,rgba(32,54,66,0.42),rgba(10,18,24,0.98))] shadow-[0_28px_70px_rgba(0,0,0,0.28)]">
      <div
        ref={mountRef}
        className="w-full"
        style={{
          aspectRatio: `${snapshot.viewport.width} / ${snapshot.viewport.height}`,
          minHeight: `${CANVAS_MIN_HEIGHT_PX}px`,
        }}
      />

      {!isReady && !loadError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(7,13,17,0.18)] px-6 text-center text-[0.78rem] uppercase tracking-[0.22em] text-[rgba(221,228,233,0.72)]">
          Loading Phaser street scene...
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-x-4 bottom-4 rounded-[20px] border border-[rgba(167,105,99,0.44)] bg-[rgba(167,105,99,0.14)] px-4 py-3 text-[0.86rem] text-[color:var(--text-main)]">
          {loadError}
        </div>
      ) : null}
    </div>
  );
}

async function createDistrictMapRuntime(options: {
  initialSnapshot: DistrictMapSnapshot;
  mount: HTMLDivElement;
  onTileClick: (x: number, y: number) => void;
}): Promise<DistrictMapRuntime> {
  const phaserModule = await import("phaser");
  const Phaser = phaserModule.default;
  let snapshot = options.initialSnapshot;
  const runtimeState: RuntimeState = {
    indices: createRuntimeIndices(snapshot),
    mapKey: createMapKey(snapshot),
    objects: null,
    playerMotion: createInitialPlayerMotion(snapshot),
  };

  const sceneConfig = {
    create(this: PhaserType.Scene) {
      const objects = createRuntimeObjects(this, snapshot);
      runtimeState.objects = objects;

      renderStaticScene(objects, snapshot, runtimeState.indices);
      syncNpcMarkerObjects(objects, snapshot);
      renderDynamicScene(objects, snapshot, runtimeState, getRuntimeNow());

      this.input.on("pointerdown", (pointer: PhaserType.Input.Pointer) => {
        if (snapshot.busy) {
          return;
        }

        const x = Math.floor((pointer.worldX - WORLD_PADDING) / CELL);
        const y = Math.floor((pointer.worldY - WORLD_PADDING) / CELL);

        if (x < 0 || y < 0 || x >= snapshot.map.width || y >= snapshot.map.height) {
          return;
        }

        const tile = snapshot.map.tiles.find(
          (candidate) => candidate.x === x && candidate.y === y,
        );

        if (!tile?.walkable) {
          return;
        }

        options.onTileClick(x, y);
      });
    },

    update(this: PhaserType.Scene) {
      if (!runtimeState.objects) {
        return;
      }

      renderDynamicScene(runtimeState.objects, snapshot, runtimeState, getRuntimeNow());
    },
  };

  const game = new Phaser.Game({
    audio: {
      noAudio: true,
    },
    backgroundColor: "#08141a",
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
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height: snapshot.viewport.height,
      mode: Phaser.Scale.FIT,
      width: snapshot.viewport.width,
    },
    scene: sceneConfig,
    type: Phaser.AUTO,
  });

  return {
    destroy() {
      runtimeState.objects = null;
      game.destroy(true);
    },

    updateSnapshot(nextSnapshot) {
      snapshot = nextSnapshot;
      const now = getRuntimeNow();
      const nextMapKey = createMapKey(nextSnapshot);

      if (nextMapKey !== runtimeState.mapKey) {
        runtimeState.indices = createRuntimeIndices(nextSnapshot);
        runtimeState.mapKey = nextMapKey;

        if (runtimeState.objects) {
          renderStaticScene(runtimeState.objects, nextSnapshot, runtimeState.indices);
        }
      }

      syncPlayerMotion(runtimeState, nextSnapshot, now);

      if (runtimeState.objects) {
        syncNpcMarkerObjects(runtimeState.objects, nextSnapshot);
        renderDynamicScene(runtimeState.objects, nextSnapshot, runtimeState, now);
      }
    },
  };
}

function buildSnapshot(
  game: StreetGameState,
  busy: boolean,
  playerPosition: Point | undefined,
  activeConversationNpcId: string | undefined,
  activeConversationEntries: StreetGameState["conversations"],
): DistrictMapSnapshot {
  const worldWidth = game.map.width * CELL + WORLD_PADDING * 2;
  const worldHeight = game.map.height * CELL + WORLD_PADDING * 2;

  return {
    activeConversationEntries,
    activeConversationNpcId,
    busy,
    clock: game.clock,
    jobs: game.jobs,
    locations: game.locations,
    map: game.map,
    npcs: game.npcs,
    player: {
      activeJobId: game.player.activeJobId,
      currentLocationId: game.player.currentLocationId,
      currentThought: game.player.currentThought,
      energy: game.player.energy,
      inventory: game.player.inventory,
      knownLocationIds: game.player.knownLocationIds,
      knownNpcIds: game.player.knownNpcIds,
      money: game.player.money,
      name: game.player.name,
      objectiveText: game.player.objective?.text,
      reputation: game.player.reputation,
      x: playerPosition?.x ?? game.player.x,
      y: playerPosition?.y ?? game.player.y,
    },
    problems: game.problems,
    viewport: {
      height: Math.min(worldHeight, 640),
      width: Math.min(worldWidth, 940),
    },
    world: {
      height: worldHeight,
      width: worldWidth,
    },
  };
}

function createInitialPlayerMotion(snapshot: DistrictMapSnapshot): PlayerMotionState {
  const point = {
    x: snapshot.player.x,
    y: snapshot.player.y,
  };

  return {
    durationMs: 1,
    path: [point],
    startedAt: getRuntimeNow(),
    to: point,
  };
}

function createRuntimeIndices(snapshot: DistrictMapSnapshot): RuntimeIndices {
  return {
    footprintByLocationId: new Map(
      snapshot.map.footprints
        .filter((footprint) => footprint.locationId)
        .map((footprint) => [footprint.locationId as string, footprint]),
    ),
    locationsById: new Map(snapshot.locations.map((location) => [location.id, location])),
    primaryDoorByLocation: new Map(
      snapshot.map.doors.map((door) => [door.locationId, door]),
    ),
    propsByLocation: groupPropsByLocation(snapshot.map.props),
    routeFinder: createRouteFinder(snapshot.map.tiles),
  };
}

function createRuntimeObjects(
  scene: PhaserType.Scene,
  snapshot: DistrictMapSnapshot,
): RuntimeObjects {
  const terrainLayer = scene.add.graphics().setDepth(10);
  const structureLayer = scene.add.graphics().setDepth(20);
  const overlayLayer = scene.add.graphics().setDepth(30);

  const playerPulse = scene.add.circle(0, 0, 24, 0x8dd0cd, 0.12);
  const playerShadow = scene.add.circle(0, 0, 19, 0x11181d, 0.82);
  const playerBody = scene.add.circle(0, 0, 13, 0x8dd0cd, 0.98);
  const playerOutline = scene.add.circle(0, 0, 18);
  playerOutline.setStrokeStyle(3, 0xddeee8, 0.96);

  const playerName = scene.add
    .text(0, 21, snapshot.player.name, {
      align: "center",
      color: "#f2fbfb",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "12px",
      fontStyle: "700",
    })
    .setOrigin(0.5, 0);

  const playerContainer = scene.add
    .container(0, 0, [playerPulse, playerShadow, playerBody, playerOutline, playerName])
    .setDepth(60);

  const conversationCard = scene.add
    .text(0, 0, "", {
      align: "left",
      backgroundColor: "#10181de6",
      color: "#e7edf0",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "12px",
      lineSpacing: 5,
      padding: { x: 12, y: 10 },
      wordWrap: {
        width: 240,
      },
    })
    .setDepth(70)
    .setOrigin(0.5, 1)
    .setVisible(false);

  const locationBadge = createHudText(scene, {
    backgroundColor: "#122129",
    color: "#dbe5e6",
    fontSize: "12px",
    fontStyle: "700",
  }).setPosition(18, 16);

  const clockBadge = createHudText(scene, {
    backgroundColor: "#162129",
    color: "#d5dde1",
    fontSize: "11px",
    fontStyle: "700",
  }).setPosition(18, 60);

  const statusBadge = createHudText(scene, {
    backgroundColor: "#162129",
    color: "#d5dde1",
    fontSize: "11px",
    fontStyle: "700",
  }).setOrigin(1, 0);

  const playerThoughtPanel = scene.add
    .text(18, snapshot.viewport.height - 18, "", {
      backgroundColor: "#10181dd9",
      color: "#d7dde2",
      fixedWidth: Math.min(340, snapshot.viewport.width - 36),
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "13px",
      lineSpacing: 4,
      padding: { x: 14, y: 12 },
      wordWrap: {
        width: Math.min(340, snapshot.viewport.width - 36),
      },
    })
    .setDepth(90)
    .setOrigin(0, 1)
    .setScrollFactor(0);

  return {
    clockBadge,
    conversationCard,
    locationBadge,
    mapLabels: [],
    npcMarkers: new Map(),
    overlayLayer,
    playerContainer,
    playerOutline,
    playerPulse,
    playerThoughtPanel,
    scene,
    statusBadge,
    structureLayer,
    terrainLayer,
  };
}

function createHudText(
  scene: PhaserType.Scene,
  style: {
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontStyle: string;
  },
) {
  return scene.add
    .text(0, 0, "", {
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: style.fontSize,
      fontStyle: style.fontStyle,
      padding: { x: 12, y: 8 },
    })
    .setDepth(90)
    .setScrollFactor(0);
}

function renderStaticScene(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
  indices: RuntimeIndices,
) {
  const camera = objects.scene.cameras.main;
  camera.setBackgroundColor("#08141a");
  camera.setBounds(0, 0, snapshot.world.width, snapshot.world.height);
  camera.setRoundPixels(true);

  objects.terrainLayer.clear();
  objects.structureLayer.clear();
  objects.overlayLayer.clear();

  for (const label of objects.mapLabels) {
    label.destroy();
  }
  objects.mapLabels = [];

  drawBackdrop(objects.terrainLayer, snapshot.world);
  drawTiles(objects.terrainLayer, snapshot.map.tiles);
  drawFootprints(objects.structureLayer, snapshot.map.footprints);
  drawDoors(objects.structureLayer, snapshot.map.doors);
  drawProps(objects.structureLayer, snapshot.map.props);
  objects.mapLabels = drawLocationLabels(objects.scene, snapshot.map.labels);

  if (indices.footprintByLocationId.size === 0) {
    objects.locationBadge.setVisible(false);
  }
}

function renderDynamicScene(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
  runtimeState: RuntimeState,
  now: number,
) {
  const indices = runtimeState.indices;
  const playerTile = samplePlayerTile(runtimeState.playerMotion, now);
  const playerPixel = playerTileToWorld(playerTile);
  const activeConversationNpc = snapshot.activeConversationNpcId
    ? snapshot.npcs.find((npc) => npc.id === snapshot.activeConversationNpcId)
    : undefined;
  const animatedNpcs = computeAnimatedNpcs(snapshot, indices, now, playerPixel);

  objects.playerContainer.setPosition(playerPixel.x, playerPixel.y);
  objects.playerPulse
    .setScale(1 + Math.sin(now / 220) * 0.06)
    .setAlpha(snapshot.busy ? 0.2 : 0.12);
  objects.playerOutline.setStrokeStyle(
    3,
    activeConversationNpc ? 0xf1d09f : 0xddeee8,
    0.96,
  );

  updateNpcMarkers(objects, snapshot, animatedNpcs);
  drawDynamicOverlay(objects.overlayLayer, snapshot, indices, playerPixel, now);
  updateConversationCard(objects, snapshot, activeConversationNpc, animatedNpcs, playerPixel);
  updateHud(objects, snapshot, playerPixel);
  updateCamera(objects.scene.cameras.main, snapshot, playerPixel);
}

function syncNpcMarkerObjects(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
) {
  const liveNpcIds = new Set(snapshot.npcs.map((npc) => npc.id));

  for (const [npcId, marker] of objects.npcMarkers) {
    if (liveNpcIds.has(npcId)) {
      continue;
    }

    marker.container.destroy();
    objects.npcMarkers.delete(npcId);
  }

  for (const npc of snapshot.npcs) {
    if (objects.npcMarkers.has(npc.id)) {
      continue;
    }

    const marker = createNpcMarker(objects.scene, npc);
    objects.npcMarkers.set(npc.id, marker);
  }
}

function createNpcMarker(
  scene: PhaserType.Scene,
  npc: NpcState,
): NpcMarkerObjects {
  const ring = scene.add.circle(0, 0, 14, 0x16222a, 0.88);
  const body = scene.add.circle(0, 0, 10, 0xd69f6a, 0.96);
  const outline = scene.add.circle(0, 0, 13);
  outline.setStrokeStyle(2, 0x29353d, 0.95);

  const label = scene.add
    .text(0, 18, npc.known ? npc.name : npc.role, {
      align: "center",
      color: "#d7dde2",
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: "11px",
      fontStyle: "700",
    })
    .setAlpha(0.84)
    .setOrigin(0.5, 0);

  const container = scene.add
    .container(0, 0, [ring, body, outline, label])
    .setDepth(40);

  return {
    body,
    container,
    label,
    outline,
  };
}

function updateNpcMarkers(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
  animatedNpcs: AnimatedNpcState[],
) {
  for (const animatedNpc of animatedNpcs) {
    const marker = objects.npcMarkers.get(animatedNpc.npc.id);

    if (!marker) {
      continue;
    }

    const highlight = animatedNpc.npc.id === snapshot.activeConversationNpcId;
    const labelText = animatedNpc.known ? animatedNpc.npc.name : animatedNpc.npc.role;

    marker.container.setPosition(
      animatedNpc.x,
      animatedNpc.y + Math.abs(animatedNpc.step) * -1.6,
    );
    marker.container.setScale(highlight ? 1.06 : animatedNpc.isYielding ? 0.96 : 1);
    marker.label.setText(labelText).setColor(highlight ? "#f7e0b4" : "#d7dde2");
    marker.body.setFillStyle(highlight ? 0xe0b27d : 0xd69f6a, 0.98);
    marker.outline.setStrokeStyle(
      highlight ? 3 : 2,
      highlight ? 0xf1d09f : 0x29353d,
      0.95,
    );
  }
}

function updateConversationCard(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
  activeConversationNpc: NpcState | undefined,
  animatedNpcs: AnimatedNpcState[],
  playerPixel: Point,
) {
  if (!activeConversationNpc) {
    objects.conversationCard.setVisible(false);
    return;
  }

  const overlay = buildConversationOverlay(
    activeConversationNpc,
    snapshot.activeConversationEntries,
  );
  const activeMarker = animatedNpcs.find(
    (entry) => entry.npc.id === activeConversationNpc.id,
  );

  if (!activeMarker) {
    objects.conversationCard.setVisible(false);
    return;
  }

  const midX = clamp(
    (playerPixel.x + activeMarker.x) / 2,
    150,
    snapshot.world.width - 150,
  );
  const topY = clamp(
    Math.min(playerPixel.y, activeMarker.y) - 54,
    80,
    snapshot.world.height - 24,
  );

  objects.conversationCard
    .setText(`${activeConversationNpc.name}: ${overlay.npcText}\nYou: ${overlay.playerText}`)
    .setPosition(midX, topY)
    .setVisible(true);
}

function updateHud(
  objects: RuntimeObjects,
  snapshot: DistrictMapSnapshot,
  playerPixel: Point,
) {
  const location = snapshot.player.currentLocationId
    ? snapshot.locations.find((entry) => entry.id === snapshot.player.currentLocationId)
    : undefined;

  objects.locationBadge
    .setPosition(18, 16)
    .setText((location?.name ?? "The street").toUpperCase());
  objects.clockBadge
    .setPosition(18, 60)
    .setText(snapshot.clock.label.toUpperCase());
  objects.statusBadge
    .setPosition(snapshot.viewport.width - 18, 16)
    .setText((snapshot.busy ? "Processing..." : "Tap a walkable tile to move").toUpperCase())
    .setStyle({
      backgroundColor: snapshot.busy ? "#2d433f" : "#162129",
      color: snapshot.busy ? "#d6f2ec" : "#d5dde1",
    });

  objects.playerThoughtPanel
    .setPosition(18, snapshot.viewport.height - 18)
    .setText(buildPlayerThought(snapshot));

  const pulseY =
    60 +
    Math.sin(nowMinutesToPhase(snapshot.clock.totalMinutes) + playerPixel.x / 200) * 1.5;
  objects.clockBadge.y = pulseY;
}

function updateCamera(
  camera: PhaserType.Cameras.Scene2D.Camera,
  snapshot: DistrictMapSnapshot,
  playerPixel: Point,
) {
  const maxScrollX = Math.max(snapshot.world.width - snapshot.viewport.width, 0);
  const maxScrollY = Math.max(snapshot.world.height - snapshot.viewport.height, 0);
  const targetScrollX = clamp(
    playerPixel.x - snapshot.viewport.width / 2,
    0,
    maxScrollX,
  );
  const targetScrollY = clamp(
    playerPixel.y - snapshot.viewport.height / 2,
    0,
    maxScrollY,
  );

  camera.scrollX += (targetScrollX - camera.scrollX) * PLAYER_CAMERA_LERP;
  camera.scrollY += (targetScrollY - camera.scrollY) * PLAYER_CAMERA_LERP;
}

function drawBackdrop(
  layer: PhaserType.GameObjects.Graphics,
  world: DistrictMapSnapshot["world"],
) {
  layer.fillStyle(0x07141a, 1);
  layer.fillRoundedRect(0, 0, world.width, world.height, 34);
  layer.fillStyle(0x0c1d26, 1);
  layer.fillRoundedRect(
    WORLD_PADDING / 2,
    WORLD_PADDING / 2,
    world.width - WORLD_PADDING,
    world.height - WORLD_PADDING,
    30,
  );
}

function drawTiles(layer: PhaserType.GameObjects.Graphics, tiles: MapTile[]) {
  for (const tile of tiles) {
    const worldX = WORLD_PADDING + tile.x * CELL;
    const worldY = WORLD_PADDING + tile.y * CELL;
    const fillColor = tile.walkable
      ? TILE_COLORS[tile.kind]
      : blendColor(TILE_COLORS[tile.kind], 0x101619, 0.58);

    layer.fillStyle(fillColor, tile.walkable ? 1 : 0.82);
    layer.fillRoundedRect(worldX + 1, worldY + 1, CELL - 2, CELL - 2, 8);

    if (OPEN_SURFACE_KINDS.has(tile.kind)) {
      layer.lineStyle(1, 0xe3d7c0, 0.06);
      layer.strokeRoundedRect(worldX + 1, worldY + 1, CELL - 2, CELL - 2, 8);
    } else if (tile.kind === "water") {
      layer.lineStyle(1, 0x8ac0da, 0.12);
      layer.strokeRoundedRect(worldX + 1, worldY + 1, CELL - 2, CELL - 2, 8);
    }

    if (!tile.walkable) {
      layer.lineStyle(2, 0x12181c, 0.42);
      layer.lineBetween(worldX + 8, worldY + 8, worldX + CELL - 8, worldY + CELL - 8);
    }
  }
}

function drawFootprints(
  layer: PhaserType.GameObjects.Graphics,
  footprints: MapFootprint[],
) {
  for (const footprint of footprints) {
    const worldX = WORLD_PADDING + footprint.x * CELL;
    const worldY = WORLD_PADDING + footprint.y * CELL;
    const width = footprint.width * CELL;
    const height = footprint.height * CELL;

    layer.fillStyle(colorForFootprint(footprint), 0.94);
    layer.fillRoundedRect(worldX + 4, worldY + 4, width - 8, height - 8, 20);

    layer.lineStyle(2, outlineForFootprint(footprint.kind), 0.8);
    layer.strokeRoundedRect(worldX + 4, worldY + 4, width - 8, height - 8, 20);

    if (footprint.kind === "building") {
      drawBuildingDetail(layer, worldX, worldY, width, height);
    }
  }
}

function drawBuildingDetail(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
) {
  layer.fillStyle(0x000000, 0.18);
  layer.fillRoundedRect(worldX + 14, worldY + height - 22, width - 28, 9, 4);
  layer.lineStyle(2, 0xffffff, 0.06);
  layer.lineBetween(worldX + 12, worldY + 12, worldX + width - 12, worldY + 12);

  const columnCount = Math.max(2, Math.floor(width / 36));
  for (let column = 0; column < columnCount; column += 1) {
    const windowX = worldX + 16 + column * ((width - 32) / columnCount);
    layer.fillStyle(0xe2c78f, 0.16);
    layer.fillRoundedRect(windowX, worldY + 18, 12, 10, 2);
  }
}

function drawDoors(
  layer: PhaserType.GameObjects.Graphics,
  doors: MapDoor[],
) {
  for (const door of doors) {
    const worldX = WORLD_PADDING + door.x * CELL;
    const worldY = WORLD_PADDING + door.y * CELL;
    const width = Math.max(door.width * CELL, 12);
    const height = Math.max(door.height * CELL, 12);

    layer.fillStyle(0xe9ba78, 0.94);
    layer.fillRoundedRect(worldX + 3, worldY + 3, width - 6, height - 6, 6);
  }
}

function drawProps(
  layer: PhaserType.GameObjects.Graphics,
  props: MapProp[],
) {
  for (const prop of props) {
    const worldX = WORLD_PADDING + prop.x * CELL;
    const worldY = WORLD_PADDING + prop.y * CELL;

    switch (prop.kind) {
      case "tree":
        layer.fillStyle(0x355c3f, 0.96);
        layer.fillCircle(worldX, worldY - 6, 10);
        layer.fillStyle(0x7d593d, 0.94);
        layer.fillRect(worldX - 2, worldY - 2, 4, 12);
        break;
      case "lamp":
        layer.lineStyle(3, 0xd3c89a, 0.92);
        layer.lineBetween(worldX, worldY + 10, worldX, worldY - 11);
        layer.fillStyle(0xf0dca6, 0.78);
        layer.fillCircle(worldX, worldY - 13, 4);
        break;
      case "cart":
        layer.fillStyle(0x8f6c4d, 0.95);
        layer.fillRoundedRect(worldX - 10, worldY - 6, 20, 12, 5);
        layer.fillStyle(0x2a343c, 0.92);
        layer.fillCircle(worldX - 7, worldY + 8, 3);
        layer.fillCircle(worldX + 7, worldY + 8, 3);
        break;
      case "laundry":
        layer.lineStyle(2, 0xe8ddca, 0.8);
        layer.lineBetween(worldX - 12, worldY - 8, worldX + 12, worldY - 8);
        layer.fillStyle(0xc89c79, 0.92);
        layer.fillRect(worldX - 9, worldY - 6, 5, 9);
        layer.fillStyle(0x7fa7bf, 0.9);
        layer.fillRect(worldX - 1, worldY - 6, 5, 10);
        break;
      default:
        layer.fillStyle(colorForProp(prop.kind), 0.94);
        layer.fillRoundedRect(worldX - 8, worldY - 8, 16, 16, 5);
        break;
    }
  }
}

function drawLocationLabels(
  scene: PhaserType.Scene,
  labels: MapLabel[],
) {
  return labels.map((label) =>
    scene.add
      .text(
        WORLD_PADDING + (label.x + 0.5) * CELL,
        WORLD_PADDING + (label.y + 0.5) * CELL,
        label.text,
        {
          color: toneColor(label.tone),
          fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
          fontSize: label.tone === "district" ? "17px" : "13px",
          fontStyle: label.tone === "district" ? "700" : "600",
        },
      )
      .setAlpha(label.tone === "district" ? 0.82 : 0.68)
      .setDepth(35)
      .setOrigin(0.5),
  );
}

function drawDynamicOverlay(
  layer: PhaserType.GameObjects.Graphics,
  snapshot: DistrictMapSnapshot,
  indices: RuntimeIndices,
  playerPixel: Point,
  now: number,
) {
  const currentFootprint = snapshot.player.currentLocationId
    ? indices.footprintByLocationId.get(snapshot.player.currentLocationId)
    : undefined;
  const conversationFootprint = snapshot.activeConversationNpcId
    ? indices.footprintByLocationId.get(
        snapshot.npcs.find((npc) => npc.id === snapshot.activeConversationNpcId)
          ?.currentLocationId ?? "",
      )
    : undefined;
  const hour = snapshot.clock.hour + snapshot.clock.minute / 60;
  const warmStrength =
    hour >= 7 && hour <= 17 ? 0.14 : hour > 17 && hour <= 21 ? 0.08 : 0.04;
  const pulse = 0.55 + Math.sin(now / 320) * 0.12;

  layer.clear();
  layer.fillStyle(0xd5ab71, warmStrength);
  layer.fillCircle(snapshot.world.width * 0.28, snapshot.world.height * 0.18, 190);
  layer.fillStyle(0x000000, 0.05);
  layer.fillRect(0, 0, snapshot.world.width, snapshot.world.height);

  if (currentFootprint) {
    drawFootprintHalo(layer, currentFootprint, 0xa9d7d4, 0.08, 0.48);
  }

  if (conversationFootprint) {
    drawFootprintHalo(layer, conversationFootprint, 0xf1d09f, 0.12 * pulse, 0.68);
  }

  layer.fillStyle(0xe8d7ad, 0.04);
  layer.fillCircle(playerPixel.x, playerPixel.y, CELL * 4.2);
  layer.lineStyle(2, 0xd6c08f, 0.2);
  layer.strokeCircle(playerPixel.x, playerPixel.y, CELL * 5.4);
}

function drawFootprintHalo(
  layer: PhaserType.GameObjects.Graphics,
  footprint: MapFootprint,
  color: number,
  fillAlpha: number,
  strokeAlpha: number,
) {
  const worldX = WORLD_PADDING + footprint.x * CELL;
  const worldY = WORLD_PADDING + footprint.y * CELL;
  const width = footprint.width * CELL;
  const height = footprint.height * CELL;

  layer.fillStyle(color, fillAlpha);
  layer.fillRoundedRect(worldX, worldY, width, height, 26);
  layer.lineStyle(3, color, strokeAlpha);
  layer.strokeRoundedRect(worldX, worldY, width, height, 26);
}

function syncPlayerMotion(
  runtimeState: RuntimeState,
  snapshot: DistrictMapSnapshot,
  now: number,
) {
  const nextPoint = {
    x: snapshot.player.x,
    y: snapshot.player.y,
  };

  if (
    runtimeState.playerMotion.to.x === nextPoint.x &&
    runtimeState.playerMotion.to.y === nextPoint.y
  ) {
    return;
  }

  const fromPoint = samplePlayerTile(runtimeState.playerMotion, now);
  const routedPoints = runtimeState.indices.routeFinder(fromPoint, nextPoint);
  const path = [fromPoint, ...routedPoints.slice(1)];
  const playerMoveMsPerTile = derivePlayerMoveMsPerTile(snapshot, runtimeState.indices);
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

function samplePlayerTile(
  motion: PlayerMotionState,
  now: number,
) {
  const progress = clamp((now - motion.startedAt) / motion.durationMs, 0, 1);
  return samplePathPoint(motion.path, easeInOutCubic(progress));
}

function computeAnimatedNpcs(
  snapshot: DistrictMapSnapshot,
  indices: RuntimeIndices,
  now: number,
  playerPixel: Point,
) {
  const animationBeat = now / 1000;
  const rawNpcs = snapshot.npcs.map((npc, index) =>
    buildAnimatedNpcState({
      animationBeat,
      index,
      indices,
      npc,
      snapshot,
    }),
  );

  return resolveCrowdPositions(rawNpcs, playerPixel);
}

function buildAnimatedNpcState({
  animationBeat,
  index,
  indices,
  npc,
  snapshot,
}: {
  animationBeat: number;
  index: number;
  indices: RuntimeIndices;
  npc: NpcState;
  snapshot: DistrictMapSnapshot;
}): AnimatedNpcState {
  const location = indices.locationsById.get(npc.currentLocationId);

  if (!location) {
    return {
      facing: 1,
      known: npc.known,
      npc,
      step: 0,
      x: WORLD_PADDING + CELL * 0.5,
      y: WORLD_PADDING + CELL * 0.5,
    };
  }

  const currentHour = snapshot.clock.hour + snapshot.clock.minute / 60;
  const nextLocation = nextScheduledLocation(npc, currentHour, indices.locationsById);
  const patrolPath = buildNpcPatrolPath({
    door: indices.primaryDoorByLocation.get(location.id),
    findRoute: indices.routeFinder,
    location,
    nextLocation,
    props: indices.propsByLocation.get(location.id) ?? [],
  });
  const phaseOffset = ((hashString(npc.id) + index * 17) % 997) / 997;
  const cycleSeconds = patrolCycleSeconds(location.type);
  const progress = positiveModulo(
    animationBeat / cycleSeconds + phaseOffset + snapshot.clock.totalMinutes * 0.021,
    1,
  );
  const point = sampleLoopPath(patrolPath, progress);
  const lookAhead = sampleLoopPath(patrolPath, positiveModulo(progress + 0.018, 1));

  return {
    facing: lookAhead.x >= point.x ? 1 : -1,
    known: npc.known,
    npc,
    step: Math.sin(progress * Math.PI * 2 * Math.max(3, patrolPath.length - 1)),
    x: WORLD_PADDING + point.x * CELL,
    y: WORLD_PADDING + point.y * CELL,
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
      for (let rightIndex = leftIndex + 1; rightIndex < resolved.length; rightIndex += 1) {
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
      entry.step *= 0.65;
    }
  }

  return resolved;
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

function clampNpcDisplacement(
  point: Point,
  original: Point,
) {
  const dx = point.x - original.x;
  const dy = point.y - original.y;
  const distance = Math.hypot(dx, dy);
  const maximum = CELL * 0.62;

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

function derivePlayerMoveMsPerTile(
  snapshot: DistrictMapSnapshot,
  indices: RuntimeIndices,
) {
  const currentLocation = snapshot.player.currentLocationId
    ? indices.locationsById.get(snapshot.player.currentLocationId)
    : undefined;

  if (!currentLocation) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const referencePath = buildNpcPatrolPath({
    door: indices.primaryDoorByLocation.get(currentLocation.id),
    findRoute: indices.routeFinder,
    location: currentLocation,
    props: indices.propsByLocation.get(currentLocation.id) ?? [],
  });
  const patrolDistance = loopPathDistance(referencePath);

  if (patrolDistance <= 0) {
    return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
  }

  const rawMsPerTile =
    (patrolCycleSeconds(currentLocation.type) * 1000) / patrolDistance;
  return clamp(rawMsPerTile * PLAYER_MOVE_DURATION_MULTIPLIER, 220, 640);
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

function buildNpcPatrolPath({
  door,
  findRoute,
  location,
  nextLocation,
  props,
}: {
  door?: MapDoor;
  findRoute: (start: Point, end: Point) => Point[];
  location: LocationState;
  nextLocation?: LocationState;
  props: MapProp[];
}) {
  const entryPoint = door
    ? { x: door.x + door.width / 2, y: door.y + door.height / 2 }
    : { x: location.entryX + 0.5, y: location.entryY + 0.5 };
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
        { x: location.x + location.width - 1.05, y: location.y + location.height - 1.1 },
        { x: location.x + 1.2, y: location.y + location.height - 1.0 },
      ];
      break;
    case "workyard":
      basePath = [
        entryPoint,
        { x: location.x + 1.2, y: location.y + 1.15 },
        { x: location.x + location.width - 1.15, y: location.y + 1.15 },
        { x: location.x + location.width - 1.15, y: location.y + location.height - 1.0 },
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
          : { x: location.x + location.width / 2, y: location.y + location.height / 2 },
        { x: location.x + location.width - 1.1, y: location.y + 1.3 },
        { x: location.x + location.width - 1.4, y: location.y + location.height - 1.0 },
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

  if (nextLocation && nextLocation.id !== location.id) {
    const routeOut = findRoute(
      { x: location.entryX, y: location.entryY },
      { x: nextLocation.entryX, y: nextLocation.entryY },
    )
      .slice(1, location.type === "square" ? 7 : 6)
      .map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }));

    if (routeOut.length > 1) {
      return [...basePath, ...routeOut, ...[...routeOut].reverse().slice(1)];
    }
  }

  return basePath;
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

function createRouteFinder(tiles: MapTile[]) {
  const walkable = new Set(
    tiles.filter((tile) => tile.walkable).map((tile) => `${tile.x},${tile.y}`),
  );
  const cache = new Map<string, Point[]>();

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

    const queue: Point[] = [roundedStart];
    const visited = new Set([startTile]);
    const parentByKey = new Map<string, string>();
    let foundKey = startTile;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.x},${current.y}`;

      if (currentKey === endTile) {
        foundKey = currentKey;
        break;
      }

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nextX = current.x + dx;
        const nextY = current.y + dy;
        const nextKey = `${nextX},${nextY}`;

        if (!walkable.has(nextKey) || visited.has(nextKey)) {
          continue;
        }

        visited.add(nextKey);
        parentByKey.set(nextKey, currentKey);
        queue.push({ x: nextX, y: nextY });
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

function buildConversationOverlay(
  npc: NpcState,
  recentConversation: StreetGameState["conversations"],
) {
  const lastPlayerLine = [...recentConversation]
    .reverse()
    .find((entry) => entry.speaker === "player")?.text;
  const lastNpcLine =
    [...recentConversation]
      .reverse()
      .find((entry) => entry.speaker === "npc")?.text ??
    npc.lastSpokenLine ??
    conversationStarterLine(npc);

  return {
    npcText: lastNpcLine,
    playerText: lastPlayerLine || "Can we talk a minute?",
  };
}

function buildPlayerThought(snapshot: DistrictMapSnapshot) {
  if (snapshot.player.currentThought) {
    return snapshot.player.currentThought;
  }

  if (snapshot.player.objectiveText) {
    return snapshot.player.objectiveText;
  }

  const activeJob = snapshot.jobs.find(
    (job) => job.id === snapshot.player.activeJobId,
  );
  const pumpProblem = snapshot.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const cartProblem = snapshot.problems.find(
    (problem) => problem.id === "problem-cart",
  );
  const hasWrench = snapshot.player.inventory.some((item) => item.id === "item-wrench");

  if (activeJob && !activeJob.completed) {
    return "I can't blow this shift.";
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && !hasWrench) {
    return "I need a wrench first.";
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && hasWrench) {
    return "I should go fix that pump.";
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    return "I need to move that cart.";
  }

  if (snapshot.player.energy < 38) {
    return "I need a minute to rest.";
  }

  if ((snapshot.player.reputation.morrow_house ?? 0) < 2) {
    return "I need somewhere to stay beyond tonight.";
  }

  if (snapshot.player.knownNpcIds.length < 3) {
    return "I need to meet a few people I could actually befriend.";
  }

  if (snapshot.player.knownLocationIds.length < 4) {
    return "I need to learn these lanes if I'm making a life here.";
  }

  if (snapshot.player.money < 18) {
    return "I need steadier income if I'm going to stay here.";
  }

  return "I think I could find a real friend here.";
}

function conversationStarterLine(npc: NpcState) {
  switch (npc.id) {
    case "npc-mara":
      return "What do you need from this house?";
    case "npc-ada":
      return "You here for work or a cup?";
    case "npc-jo":
      return "You need a tool or an answer?";
    case "npc-tomas":
      return "You looking for a shift or just looking?";
    case "npc-nia":
      return "What are you trying to learn before the block notices?";
    default:
      return "What are you after?";
  }
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

function playerTileToWorld(point: Point) {
  return {
    x: WORLD_PADDING + (point.x + 0.5) * CELL,
    y: WORLD_PADDING + (point.y + 0.5) * CELL,
  };
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
      const localProgress = segmentLength === 0 ? 0 : (target - covered) / segmentLength;
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
      const localProgress = segmentLength === 0 ? 0 : (target - covered) / segmentLength;
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

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function positiveModulo(value: number, base: number) {
  return ((value % base) + base) % base;
}

function nowMinutesToPhase(totalMinutes: number) {
  return (totalMinutes % 1440) / 18;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRuntimeNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function createMapKey(snapshot: DistrictMapSnapshot) {
  return [
    snapshot.map.width,
    snapshot.map.height,
    snapshot.map.tiles.length,
    snapshot.map.footprints.length,
    snapshot.map.doors.length,
    snapshot.map.props.length,
    snapshot.map.labels.length,
  ].join(":");
}

function colorForFootprint(footprint: MapFootprint) {
  switch (footprint.kind) {
    case "building":
      return 0x1f2d36;
    case "dock":
      return 0x89684a;
    case "garden":
      return 0x315139;
    case "market":
      return 0x7d715d;
    case "water":
      return 0x255871;
    case "yard":
      return 0x5e5848;
    default:
      return 0x1f2d36;
  }
}

function outlineForFootprint(kind: MapFootprint["kind"]) {
  switch (kind) {
    case "building":
      return 0xffffff;
    case "dock":
      return 0xc6b089;
    case "garden":
      return 0x8eb087;
    case "market":
      return 0xdecd9f;
    case "water":
      return 0x73a0bd;
    case "yard":
      return 0xb7a079;
    default:
      return 0xffffff;
  }
}

function colorForProp(kind: MapProp["kind"]) {
  switch (kind) {
    case "barrel":
      return 0x84654c;
    case "bench":
      return 0x78604d;
    case "bollard":
      return 0x5a636a;
    case "canopy":
      return 0xba795f;
    case "crate":
      return 0x8a6a4d;
    case "pump":
      return 0x6e848f;
    default:
      return 0x75838b;
  }
}

function toneColor(tone: MapLabel["tone"]) {
  switch (tone) {
    case "district":
      return "#efd5a4";
    case "landmark":
      return "#d9e7ea";
    case "street":
      return "#b8c9cf";
    default:
      return "#d9e7ea";
  }
}

function blendColor(base: number, mix: number, amount: number) {
  const clampedAmount = Math.max(0, Math.min(amount, 1));
  const red = Math.round(
    ((base >> 16) & 0xff) * (1 - clampedAmount) + ((mix >> 16) & 0xff) * clampedAmount,
  );
  const green = Math.round(
    ((base >> 8) & 0xff) * (1 - clampedAmount) + ((mix >> 8) & 0xff) * clampedAmount,
  );
  const blue = Math.round(
    (base & 0xff) * (1 - clampedAmount) + (mix & 0xff) * clampedAmount,
  );

  return (red << 16) | (green << 8) | blue;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }

  return hash;
}
