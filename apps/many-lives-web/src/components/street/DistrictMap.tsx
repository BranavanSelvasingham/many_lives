"use client";

import { useEffect, useMemo, useState } from "react";

import { toFirstPersonText } from "@/components/street/streetFormatting";
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

const CELL = 38;
const MAP_PADDING = 24;
const DEFAULT_PLAYER_MOVE_MS_PER_TILE = 320;
const PLAYER_MAX_MOVE_DURATION_MS = 4800;
const PLAYER_MOVE_DURATION_MULTIPLIER = 0.42;
const DARKEN_OUTSIDE_PLAYER_FIELD_OF_VIEW = false;

type Point = {
  x: number;
  y: number;
};

type AnimatedNpcState = {
  npc: NpcState;
  known: boolean;
  x: number;
  y: number;
  facing: 1 | -1;
  step: number;
  isYielding?: boolean;
};

type PlayerMotionState = {
  path: Point[];
  startedAt: number;
  durationMs: number;
  to: Point;
};

type NpcAppearance = {
  headY: number;
  headRadius: number;
  bodyWidth: number;
  hemWidth: number;
  shoulderY: number;
  hemY: number;
  strideScale: number;
  coat: string;
  accent: string;
  hair: string;
  face: string;
  cheek: string;
  eye: string;
  outline: string;
  leg: string;
  shoe: string;
  hairStyle: "bun" | "scarf" | "cap" | "beard-cap" | "ponytail" | "cropped";
  faceStyle: "soft" | "wry" | "steady" | "stern" | "bright" | "guarded";
  accessory?: "apron" | "shawl" | "satchel" | "vest" | "scarf";
};

export function DistrictMap({
  game,
  onTileClick,
  busy,
  playerPosition,
  activeConversationNpcId,
  activeConversationEntries = [],
}: {
  game: StreetGameState;
  onTileClick: (x: number, y: number) => void;
  busy: boolean;
  playerPosition?: Point;
  activeConversationNpcId?: string;
  activeConversationEntries?: StreetGameState["conversations"];
}) {
  const [animationNow, setAnimationNow] = useState(() => Date.now());

  useEffect(() => {
    let frame = window.requestAnimationFrame(function tick() {
      setAnimationNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const animationBeat = animationNow / 1000;
  const sceneMinutes = game.clock.totalMinutes + animationBeat * 2.4;
  const locationById = useMemo(
    () => Object.fromEntries(game.locations.map((location) => [location.id, location])),
    [game.locations],
  );
  const knownLocationIds = new Set(game.player.knownLocationIds);
  const currentLocationId = game.player.currentLocationId;
  const currentLocation = currentLocationId ? locationById[currentLocationId] : undefined;
  const propsByLocation = useMemo(
    () => groupPropsByLocation(game.map.props),
    [game.map.props],
  );
  const activeJobCountByLocation = countActiveJobs(game);
  const activeProblemCountByLocation = countActiveProblems(game);
  const primaryDoorByLocation = useMemo(
    () => new Map(game.map.doors.map((door) => [door.locationId, door])),
    [game.map.doors],
  );
  const findRoute = useMemo(() => createRouteFinder(game.map.tiles), [game.map.tiles]);
  const playerMoveMsPerTile = useMemo(() => {
    if (!currentLocation) {
      return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
    }

    const referencePath = buildNpcPatrolPath({
      door: primaryDoorByLocation.get(currentLocation.id),
      location: currentLocation,
      props: propsByLocation.get(currentLocation.id) ?? [],
      findRoute,
    });
    const patrolDistance = loopPathDistance(referencePath);

    if (patrolDistance <= 0) {
      return DEFAULT_PLAYER_MOVE_MS_PER_TILE;
    }

    const rawMsPerTile =
      (patrolCycleSeconds(currentLocation.type) * 1000) / patrolDistance;
    return clamp(rawMsPerTile * PLAYER_MOVE_DURATION_MULTIPLIER, 220, 640);
  }, [currentLocation, findRoute, primaryDoorByLocation, propsByLocation]);
  const [playerMotion, setPlayerMotion] = useState<PlayerMotionState>(() => {
    const point = playerPosition ?? { x: game.player.x, y: game.player.y };
    return {
      path: [point],
      startedAt: Date.now(),
      durationMs: playerMoveMsPerTile,
      to: point,
    };
  });
  useEffect(() => {
    const nextPoint = playerPosition ?? { x: game.player.x, y: game.player.y };

    setPlayerMotion((current) => {
      if (current.to.x === nextPoint.x && current.to.y === nextPoint.y) {
        return current;
      }

      const path = findRoute(current.to, nextPoint);
      const durationMs = clamp(
        Math.max(path.length - 1, 1) * playerMoveMsPerTile,
        playerMoveMsPerTile,
        PLAYER_MAX_MOVE_DURATION_MS,
      );

      return {
        path,
        startedAt: Date.now(),
        durationMs,
        to: nextPoint,
      };
    });
  }, [findRoute, game.player.x, game.player.y, playerMoveMsPerTile, playerPosition]);
  const playerMotionProgress = useMemo(
    () =>
      clamp(
        (animationNow - playerMotion.startedAt) / playerMotion.durationMs,
        0,
        1,
      ),
    [animationNow, playerMotion.durationMs, playerMotion.startedAt],
  );
  const playerTile = useMemo(() => {
    const progress = easeInOutCubic(playerMotionProgress);

    return samplePathPoint(playerMotion.path, progress);
  }, [playerMotion.path, playerMotionProgress]);
  const mapWidth = game.map.width * CELL;
  const mapHeight = game.map.height * CELL;
  const playerPixel = useMemo(
    () => ({
      x: (playerTile.x + 0.5) * CELL,
      y: (playerTile.y + 0.5) * CELL,
    }),
    [playerTile.x, playerTile.y],
  );
  const awarenessMaskId = `${game.id}-awareness-mask`;
  const playerFieldGradientId = `${game.id}-player-fov`;
  const rawAnimatedNpcs = useMemo(
    () =>
      game.npcs.map((npc, index) =>
        buildAnimatedNpcState({
          animationBeat,
          findRoute,
          game,
          index,
          locationById,
          npc,
          primaryDoorByLocation,
          propsByLocation,
        }),
      ),
    [
      animationBeat,
      findRoute,
      game,
      locationById,
      primaryDoorByLocation,
      propsByLocation,
    ],
  );
  const animatedNpcs = useMemo(
    () => resolveCrowdPositions(rawAnimatedNpcs, playerPixel),
    [playerPixel, rawAnimatedNpcs],
  );
  const activeConversationNpc = useMemo(
    () =>
      activeConversationNpcId
        ? game.npcs.find((npc) => npc.id === activeConversationNpcId)
        : undefined,
    [activeConversationNpcId, game.npcs],
  );
  const activeConversationNpcMarker = useMemo(
    () =>
      activeConversationNpcId
        ? animatedNpcs.find((entry) => entry.npc.id === activeConversationNpcId)
        : undefined,
    [activeConversationNpcId, animatedNpcs],
  );
  const activeConversation = useMemo(
    () =>
      activeConversationNpc
        ? buildConversationOverlay({
            npc: activeConversationNpc,
            recentConversation: activeConversationEntries,
          })
        : undefined,
    [activeConversationEntries, activeConversationNpc],
  );
  const frozenConversationNpcMarker = useMemo(
    () =>
      activeConversationNpcMarker
        ? freezeConversationMarker(
            activeConversationNpcMarker,
            playerPixel,
            mapWidth,
            mapHeight,
          )
        : undefined,
    [activeConversationNpcMarker, mapHeight, mapWidth, playerPixel],
  );
  const showConversationOverlay = Boolean(
    activeConversation &&
      frozenConversationNpcMarker &&
      playerMotionProgress >= 0.995,
  );
  const playerThought = buildPlayerThought(game);
  const playerBubbleY = showConversationOverlay
    ? playerPixel.y
    : playerPixel.y + Math.sin(animationBeat * 1.2) * 0.7;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-[rgba(134,145,154,0.24)] bg-[rgba(19,26,31,0.9)] shadow-[0_34px_90px_rgba(0,0,0,0.24)]">
        <div className="overflow-x-auto p-4 sm:p-5">
          <div className="mx-auto min-w-[920px] lg:min-w-0 lg:h-[80vh] lg:max-h-[56rem]">
            <svg
              className="h-auto w-full lg:h-full lg:w-full"
              viewBox={`0 0 ${mapWidth + MAP_PADDING * 2} ${mapHeight + MAP_PADDING * 2}`}
            >
              <SceneDefs />
              {DARKEN_OUTSIDE_PLAYER_FIELD_OF_VIEW ? (
                <AwarenessDefs
                  mapHeight={mapHeight}
                  mapWidth={mapWidth}
                  maskId={awarenessMaskId}
                  playerGradientId={playerFieldGradientId}
                  playerPixel={playerPixel}
                />
              ) : null}

              <rect
                fill="url(#scene-backdrop)"
                height={mapHeight + MAP_PADDING * 2}
                rx="30"
                width={mapWidth + MAP_PADDING * 2}
                x="0"
                y="0"
              />

              <g transform={`translate(${MAP_PADDING} ${MAP_PADDING})`}>
                <rect
                  fill="rgba(19,24,28,0.22)"
                  height={mapHeight}
                  rx="24"
                  stroke="rgba(142,159,170,0.18)"
                  width={mapWidth}
                  x="0"
                  y="0"
                />

                <g opacity="0.98">
                  {game.map.tiles.map((tile) => (
                    <rect
                      fill={tileFill(tile.kind)}
                      height={CELL}
                      key={`${tile.x}-${tile.y}`}
                      stroke={tileStroke(tile.kind)}
                      strokeWidth="0.65"
                      width={CELL}
                      x={tile.x * CELL}
                      y={tile.y * CELL}
                    />
                  ))}
                </g>

                <StreetEdgeOverlay tiles={game.map.tiles} />
                <CityGlowOverlay
                  mapHeight={mapHeight}
                  mapWidth={mapWidth}
                  sceneMinutes={sceneMinutes}
                />

                <g>
                  {game.map.footprints.map((footprint) => (
                    <FootprintShape
                      currentLocationId={currentLocationId}
                      footprint={footprint}
                      key={footprint.id}
                      location={
                        footprint.locationId
                          ? locationById[footprint.locationId]
                          : undefined
                      }
                    />
                  ))}
                </g>

                <g>
                  {game.map.doors.map((door) => (
                    <DoorShape door={door} key={door.id} />
                  ))}
                </g>

                <g>
                  {game.map.props.map((prop) => (
                    <PropShape
                      animationBeat={animationBeat}
                      key={prop.id}
                      prop={prop}
                    />
                  ))}
                </g>

                <WaterMotionOverlay
                  footprints={game.map.footprints}
                  sceneMinutes={sceneMinutes}
                />
                <LampGlowOverlay props={game.map.props} sceneMinutes={sceneMinutes} />

                <g>
                  {game.map.labels.map((label) => (
                    <MapTextLabel key={label.id} label={label} />
                  ))}
                </g>

                <g>
                  {game.locations.map((location) => {
                    const known = knownLocationIds.has(location.id);
                    const isHere = currentLocationId === location.id;
                    const door = primaryDoorByLocation.get(location.id);
                    const workCount = activeJobCountByLocation.get(location.id) ?? 0;
                    const troubleCount =
                      activeProblemCountByLocation.get(location.id) ?? 0;

                    return (
                      <g key={location.id}>
                        {(known || isHere) && door ? (
                          <LocationPlacard
                            door={door}
                            isHere={isHere}
                            known={known}
                            location={location}
                            troubleCount={troubleCount}
                            workCount={workCount}
                          />
                        ) : null}

                        {door ? (
                          <circle
                            className={busy ? "" : "cursor-pointer"}
                            cx={(door.x + door.width / 2) * CELL}
                            cy={(door.y + door.height / 2) * CELL}
                            fill="transparent"
                            onClick={() => {
                              if (!busy) {
                                onTileClick(location.entryX, location.entryY);
                              }
                            }}
                            r="18"
                            stroke="none"
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                <g>
                  {animatedNpcs.map((entry) => (
                    <NpcMarker
                      facing={
                        showConversationOverlay && entry.npc.id === frozenConversationNpcMarker?.npc.id
                          ? frozenConversationNpcMarker.facing
                          : entry.facing
                      }
                      key={entry.npc.id}
                      known={entry.known}
                      npcId={entry.npc.id}
                      step={
                        showConversationOverlay && entry.npc.id === frozenConversationNpcMarker?.npc.id
                          ? frozenConversationNpcMarker.step
                          : entry.step
                      }
                      x={
                        showConversationOverlay && entry.npc.id === frozenConversationNpcMarker?.npc.id
                          ? frozenConversationNpcMarker.x
                          : entry.x
                      }
                      y={
                        showConversationOverlay && entry.npc.id === frozenConversationNpcMarker?.npc.id
                          ? frozenConversationNpcMarker.y
                          : entry.y
                      }
                    />
                  ))}
                </g>

                <AwarenessOverlay
                  dimOutsideFieldOfView={DARKEN_OUTSIDE_PLAYER_FIELD_OF_VIEW}
                  playerPixel={playerPixel}
                  height={mapHeight}
                  maskId={awarenessMaskId}
                  width={mapWidth}
                />

                <g>
                  {animatedNpcs.map((entry) => {
                    if (showConversationOverlay && entry.npc.id === activeConversation?.npcId) {
                      return null;
                    }

                    const offset = thoughtBubbleOffset(entry.npc.id);

                    return (
                      <ThoughtBubble
                        dx={offset.x}
                        dy={offset.y}
                        key={`thought-${entry.npc.id}`}
                        mapWidth={mapWidth}
                        mapHeight={mapHeight}
                        text={buildNpcThought(entry.npc, game)}
                        tone="npc"
                        x={entry.x}
                        y={entry.y + Math.abs(entry.step) * -1.4}
                      />
                    );
                  })}
                </g>

                <PlayerMarker
                  animationBeat={animationBeat}
                  freeze={showConversationOverlay}
                  x={playerTile.x}
                  y={playerTile.y}
                />
                {showConversationOverlay && activeConversation && frozenConversationNpcMarker ? (
                  <ConversationStatusPill
                    label={`${game.player.name} and ${frozenConversationNpcMarker.npc.name} talking`}
                    mapWidth={mapWidth}
                    x={(playerPixel.x + frozenConversationNpcMarker.x) / 2}
                    y={Math.min(playerBubbleY, frozenConversationNpcMarker.y) - 20}
                  />
                ) : (
                  <ThoughtBubble
                    dx={0}
                    dy={-42}
                    mapWidth={mapWidth}
                    mapHeight={mapHeight}
                    text={playerThought}
                    tone="player"
                    x={playerPixel.x}
                    y={playerBubbleY}
                  />
                )}

                <g opacity="0">
                  {game.map.tiles.map((tile) => {
                    if (!tile.walkable) {
                      return null;
                    }

                    return (
                      <rect
                        className={busy ? "" : "cursor-pointer"}
                        height={CELL}
                        key={`${tile.x}-${tile.y}`}
                        onClick={() => {
                          if (!busy) {
                            onTileClick(tile.x, tile.y);
                          }
                        }}
                        width={CELL}
                        x={tile.x * CELL}
                        y={tile.y * CELL}
                      />
                    );
                  })}
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LegendChip
          detail="Cobble lanes, stairs, and open market routes"
          label="Streets"
          tone="lane"
        />
        <LegendChip
          detail="Roofs, facades, awnings, and entry stoops"
          label="Buildings"
          tone="roof"
        />
        <LegendChip
          detail="People, work, and local trouble embedded in the scene"
          label="Activity"
          tone="open"
        />
        <LegendChip
          detail="Pilings, planks, river edge, and dock traffic"
          label="Waterfront"
          tone="water"
        />
      </div>
    </div>
  );
}

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="scene-backdrop" x1="0%" x2="100%" y1="0%" y2="100%">
        <stop offset="0%" stopColor="#2d3d48" />
        <stop offset="55%" stopColor="#1f2b33" />
        <stop offset="100%" stopColor="#182127" />
      </linearGradient>

      <radialGradient id="sun-haze" cx="28%" cy="18%" r="55%">
        <stop offset="0%" stopColor="rgba(222,187,121,0.22)" />
        <stop offset="100%" stopColor="rgba(222,187,121,0)" />
      </radialGradient>

      <radialGradient id="street-vignette" cx="50%" cy="50%" r="70%">
        <stop offset="62%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.16)" />
      </radialGradient>

      <linearGradient id="river-glint" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
        <stop offset="50%" stopColor="rgba(182,220,244,0.34)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>

      <pattern id="lane-cobble" height="22" patternUnits="userSpaceOnUse" width="22">
        <rect fill="#5b6771" height="22" width="22" />
        <path
          d="M0 6 C4 4,7 4,11 6 C15 8,18 8,22 6 M0 16 C4 14,7 14,11 16 C15 18,18 18,22 16"
          fill="none"
          stroke="#74818b"
          strokeWidth="1.1"
        />
        <path
          d="M5 0 V22 M16 0 V22"
          fill="none"
          stroke="rgba(38,44,49,0.18)"
          strokeWidth="0.9"
        />
      </pattern>

      <pattern id="plaza-pavers" height="26" patternUnits="userSpaceOnUse" width="26">
        <rect fill="#81745d" height="26" width="26" />
        <path
          d="M0 13 H26 M13 0 V26"
          fill="none"
          stroke="#a08f6d"
          strokeWidth="1.2"
        />
        <path
          d="M0 0 L26 26 M26 0 L0 26"
          fill="none"
          stroke="rgba(70,58,41,0.12)"
          strokeWidth="0.9"
        />
      </pattern>

      <pattern id="yard-ground" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#716856" height="16" width="16" />
        <path d="M0 4 H16 M0 12 H16" stroke="#887960" strokeWidth="0.9" />
      </pattern>

      <pattern id="dock-planks" height="14" patternUnits="userSpaceOnUse" width="14">
        <rect fill="#89684a" height="14" width="14" />
        <path d="M0 7 H14" stroke="#a27f5a" strokeWidth="1.1" />
        <path d="M0 0 V14 M7 0 V14" stroke="rgba(72,53,34,0.18)" strokeWidth="0.9" />
      </pattern>

      <pattern id="water-ripple" height="24" patternUnits="userSpaceOnUse" width="24">
        <rect fill="#346580" height="24" width="24" />
        <path
          d="M0 8 C4 6,8 6,12 8 C16 10,20 10,24 8 M0 18 C4 16,8 16,12 18 C16 20,20 20,24 18"
          fill="none"
          stroke="#6da3c0"
          strokeWidth="1.2"
        />
      </pattern>

      <pattern id="garden-ground" height="18" patternUnits="userSpaceOnUse" width="18">
        <rect fill="#446947" height="18" width="18" />
        <circle cx="4" cy="5" fill="#5f8a60" r="1.8" />
        <circle cx="11" cy="10" fill="#587e59" r="1.8" />
      </pattern>

      <pattern id="roof-slate" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#44505a" height="16" width="16" />
        <path d="M0 12 L16 0" stroke="#61707b" strokeWidth="1.4" />
        <path d="M-4 16 L12 0" stroke="rgba(112,124,134,0.52)" strokeWidth="1" />
      </pattern>

      <pattern id="roof-tin" height="14" patternUnits="userSpaceOnUse" width="14">
        <rect fill="#666d72" height="14" width="14" />
        <path d="M4 0 V14 M10 0 V14" stroke="#87939a" strokeWidth="1.2" />
      </pattern>

      <pattern id="roof-plaster" height="18" patternUnits="userSpaceOnUse" width="18">
        <rect fill="#9c9183" height="18" width="18" />
        <circle cx="5" cy="6" fill="#b1a595" r="1.4" />
        <circle cx="13" cy="12" fill="#a89d8d" r="1.4" />
      </pattern>

      <pattern id="roof-timber" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#826249" height="16" width="16" />
        <path d="M0 6 H16 M0 12 H16" stroke="#664b36" strokeWidth="1.2" />
      </pattern>

      <filter id="soft-shadow" height="220%" width="220%" x="-60%" y="-60%">
        <feDropShadow
          dx="0"
          dy="10"
          floodColor="rgba(0,0,0,0.28)"
          stdDeviation="10"
        />
      </filter>

      <filter id="lamp-blur" height="240%" width="240%" x="-70%" y="-70%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
  );
}

function AwarenessDefs({
  maskId,
  mapWidth,
  mapHeight,
  playerGradientId,
  playerPixel,
}: {
  maskId: string;
  mapWidth: number;
  mapHeight: number;
  playerGradientId: string;
  playerPixel: Point;
}) {
  const playerOuterRadius = CELL * 5.6;
  const playerInnerRadius = CELL * 3.1;

  return (
    <defs>
      <radialGradient
        cx={playerPixel.x}
        cy={playerPixel.y}
        gradientUnits="userSpaceOnUse"
        id={playerGradientId}
        r={playerOuterRadius}
      >
        <stop offset="0%" stopColor="#020202" />
        <stop
          offset={`${(playerInnerRadius / playerOuterRadius) * 100}%`}
          stopColor="#121212"
        />
        <stop offset="63%" stopColor="#484848" />
        <stop offset="82%" stopColor="#b5b5b5" />
        <stop offset="100%" stopColor="white" />
      </radialGradient>

      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect fill="white" height={mapHeight} width={mapWidth} x="0" y="0" />
        <circle
          cx={playerPixel.x}
          cy={playerPixel.y}
          fill={`url(#${playerGradientId})`}
          r={playerOuterRadius}
        />
      </mask>
    </defs>
  );
}

function AwarenessOverlay({
  dimOutsideFieldOfView,
  maskId,
  width,
  height,
  playerPixel,
}: {
  dimOutsideFieldOfView: boolean;
  maskId: string;
  width: number;
  height: number;
  playerPixel: Point;
}) {
  const playerRadius = CELL * 5.55;

  return (
    <g pointerEvents="none">
      {dimOutsideFieldOfView ? (
        <rect
          fill="rgba(9,13,16,0.32)"
          height={height}
          mask={`url(#${maskId})`}
          width={width}
          x="0"
          y="0"
        />
      ) : null}
      <circle
        cx={playerPixel.x}
        cy={playerPixel.y}
        fill="rgba(236,222,193,0.06)"
        r={playerRadius - CELL * 1.2}
      />
      <circle
        cx={playerPixel.x}
        cy={playerPixel.y}
        fill="none"
        r={playerRadius}
        stroke="rgba(212,188,138,0.24)"
        strokeDasharray="10 10"
        strokeWidth="2"
      />
      <rect
        fill="rgba(0,0,0,0.04)"
        height={height}
        rx="20"
        width={width}
        x="0"
        y="0"
      />
    </g>
  );
}

function CityGlowOverlay({
  mapWidth,
  mapHeight,
  sceneMinutes,
}: {
  mapWidth: number;
  mapHeight: number;
  sceneMinutes: number;
}) {
  const hour = (sceneMinutes / 60) % 24;
  const warmStrength =
    hour >= 7 && hour <= 17 ? 0.14 : hour > 17 && hour <= 21 ? 0.08 : 0.04;

  return (
    <>
      <rect
        fill="url(#sun-haze)"
        height={mapHeight}
        opacity={warmStrength}
        width={mapWidth}
        x="0"
        y="0"
      />
      <rect
        fill="rgba(5,8,10,0.1)"
        height={mapHeight}
        rx="20"
        stroke="rgba(255,255,255,0.02)"
        width={mapWidth}
        x="0"
        y="0"
      />
      <rect
        fill="url(#street-vignette)"
        height={mapHeight}
        opacity="0.7"
        width={mapWidth}
        x="0"
        y="0"
      />
    </>
  );
}

function WaterMotionOverlay({
  footprints,
  sceneMinutes,
}: {
  footprints: MapFootprint[];
  sceneMinutes: number;
}) {
  const water = footprints.find((entry) => entry.kind === "water");
  if (!water) {
    return null;
  }

  const x = water.x * CELL;
  const y = water.y * CELL;
  const width = water.width * CELL;
  const phase = (sceneMinutes % 90) / 90;
  const shimmerOffset = phase * 22;

  return (
    <g opacity="0.82" pointerEvents="none">
      <path
        d={`M ${x - 20 + shimmerOffset} ${y + 16} C ${x + width * 0.18} ${y + 6}, ${x + width * 0.32} ${y + 30}, ${x + width * 0.52} ${y + 18} S ${x + width * 0.84} ${y + 4}, ${x + width + 36} ${y + 20}`}
        fill="none"
        stroke="url(#river-glint)"
        strokeWidth="10"
      />
      <path
        d={`M ${x - 10 - shimmerOffset * 0.6} ${y + 44} C ${x + width * 0.12} ${y + 26}, ${x + width * 0.34} ${y + 58}, ${x + width * 0.56} ${y + 42} S ${x + width * 0.84} ${y + 28}, ${x + width + 28} ${y + 46}`}
        fill="none"
        opacity="0.8"
        stroke="rgba(183,220,244,0.26)"
        strokeWidth="8"
      />
    </g>
  );
}

function LampGlowOverlay({
  props,
  sceneMinutes,
}: {
  props: MapProp[];
  sceneMinutes: number;
}) {
  const lamps = props.filter((prop) => prop.kind === "lamp");
  const flicker = 0.7 + ((sceneMinutes % 6) / 20);

  return (
    <g opacity={flicker} pointerEvents="none">
      {lamps.map((lamp) => (
        <circle
          cx={lamp.x * CELL}
          cy={lamp.y * CELL - 18}
          fill="rgba(222,187,121,0.24)"
          filter="url(#lamp-blur)"
          key={`${lamp.id}-glow`}
          r={(14 + (lamp.scale ?? 1) * 5).toString()}
        />
      ))}
    </g>
  );
}

function StreetEdgeOverlay({ tiles }: { tiles: MapTile[] }) {
  const tileByKey = new Map(tiles.map((tile) => [`${tile.x}-${tile.y}`, tile]));
  const edgeKinds = new Set<TileKind>([
    "lane",
    "plaza",
    "stoop",
    "workyard",
    "courtyard",
    "dock",
  ]);
  const paths: string[] = [];

  for (const tile of tiles) {
    if (!edgeKinds.has(tile.kind)) {
      continue;
    }

    const x = tile.x * CELL;
    const y = tile.y * CELL;
    const neighbors = {
      top: tileByKey.get(`${tile.x}-${tile.y - 1}`),
      right: tileByKey.get(`${tile.x + 1}-${tile.y}`),
      bottom: tileByKey.get(`${tile.x}-${tile.y + 1}`),
      left: tileByKey.get(`${tile.x - 1}-${tile.y}`),
    };

    if (!isOpenSurface(neighbors.top?.kind)) {
      paths.push(`M${x},${y} H${x + CELL}`);
    }
    if (!isOpenSurface(neighbors.right?.kind)) {
      paths.push(`M${x + CELL},${y} V${y + CELL}`);
    }
    if (!isOpenSurface(neighbors.bottom?.kind)) {
      paths.push(`M${x},${y + CELL} H${x + CELL}`);
    }
    if (!isOpenSurface(neighbors.left?.kind)) {
      paths.push(`M${x},${y} V${y + CELL}`);
    }
  }

  return (
    <path
      d={paths.join(" ")}
      fill="none"
      opacity="0.38"
      stroke="rgba(225,212,186,0.28)"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  );
}

function FootprintShape({
  footprint,
  currentLocationId,
  location,
}: {
  footprint: MapFootprint;
  currentLocationId?: string;
  location?: LocationState;
}) {
  const x = footprint.x * CELL;
  const y = footprint.y * CELL;
  const width = footprint.width * CELL;
  const height = footprint.height * CELL;
  const isCurrent = currentLocationId === footprint.locationId;
  const stroke = isCurrent ? "rgba(183,146,89,0.74)" : footprintStroke(footprint);
  const strokeWidth = isCurrent ? 3 : 2;
  const titleText = location
    ? buildMapNarrativeTitle(
        location.name,
        location.description,
        location.context,
        location.backstory,
      )
    : undefined;

  if (footprint.kind === "building") {
    return (
      <g filter="url(#soft-shadow)">
        {titleText ? <title>{titleText}</title> : null}
        <rect
          fill="rgba(0,0,0,0.22)"
          height={height}
          rx="12"
          width={width}
          x={x + 6}
          y={y + 8}
        />
        <rect
          fill={roofFill(footprint.roofStyle)}
          height={height}
          rx="12"
          stroke={stroke}
          strokeWidth={strokeWidth}
          width={width}
          x={x}
          y={y}
        />
        <rect
          fill="none"
          height={Math.max(height - 14, 14)}
          rx="9"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1.4"
          width={Math.max(width - 14, 14)}
          x={x + 7}
          y={y + 7}
        />
        <BuildingDetail location={location} x={x} y={y} width={width} height={height} />
      </g>
    );
  }

  if (footprint.kind === "market") {
    return (
      <g filter="url(#soft-shadow)">
        {titleText ? <title>{titleText}</title> : null}
        <rect
          fill="rgba(0,0,0,0.18)"
          height={height}
          rx="10"
          width={width}
          x={x + 6}
          y={y + 8}
        />
        <rect
          fill="url(#plaza-pavers)"
          height={height}
          rx="10"
          stroke={stroke}
          strokeWidth={strokeWidth}
          width={width}
          x={x}
          y={y}
        />
        <path
          d={`M ${x + 14} ${y + 16} H ${x + width - 14}`}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
        />
        <rect fill="rgba(149,70,56,0.9)" height="20" rx="5" width="44" x={x + 12} y={y + 10} />
        <rect fill="rgba(170,117,59,0.88)" height="18" rx="5" width="38" x={x + width - 54} y={y + height - 30} />
      </g>
    );
  }

  if (footprint.kind === "yard") {
    return (
      <g filter="url(#soft-shadow)">
        {titleText ? <title>{titleText}</title> : null}
        <rect
          fill="rgba(0,0,0,0.16)"
          height={height}
          rx="8"
          width={width}
          x={x + 5}
          y={y + 7}
        />
        <rect
          fill="url(#yard-ground)"
          height={height}
          rx="8"
          stroke={stroke}
          strokeWidth={strokeWidth}
          width={width}
          x={x}
          y={y}
        />
        <path
          d={`M ${x + 12} ${y + 12} V ${y + height - 12} M ${x + width - 12} ${y + 12} V ${y + height - 12}`}
          stroke="rgba(214,193,157,0.14)"
          strokeDasharray="4 5"
          strokeWidth="2"
        />
      </g>
    );
  }

  if (footprint.kind === "dock") {
    return (
      <g filter="url(#soft-shadow)">
        {titleText ? <title>{titleText}</title> : null}
        <rect
          fill="rgba(0,0,0,0.18)"
          height={height}
          rx="8"
          width={width}
          x={x + 4}
          y={y + 7}
        />
        <rect
          fill="url(#dock-planks)"
          height={height}
          rx="8"
          stroke={stroke}
          strokeWidth={strokeWidth}
          width={width}
          x={x}
          y={y}
        />
        {Array.from({ length: 5 }, (_, index) => (
          <rect
            fill="rgba(59,44,31,0.88)"
            height={12}
            key={`${footprint.id}-pile-${index}`}
            rx="3"
            width={7}
            x={x + 14 + index * ((width - 28) / 4)}
            y={y + height - 4}
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      {titleText ? <title>{titleText}</title> : null}
      <rect
        fill={footprintFill(footprint.kind)}
        height={height}
        rx="8"
        stroke={stroke}
        strokeWidth={strokeWidth}
        width={width}
        x={x}
        y={y}
      />
    </g>
  );
}

function BuildingDetail({
  location,
  x,
  y,
  width,
  height,
}: {
  location?: LocationState;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const windowRows = location?.id === "boarding-house" ? 2 : 1;
  const windowColumns = Math.max(2, Math.floor(width / 34));
  const windows = [];

  for (let row = 0; row < windowRows; row += 1) {
    for (let column = 0; column < windowColumns; column += 1) {
      windows.push(
        <rect
          fill="rgba(236,212,163,0.18)"
          height="9"
          key={`${location?.id ?? "building"}-${row}-${column}`}
          rx="2"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
          width="11"
          x={x + 12 + column * ((width - 24) / windowColumns)}
          y={y + 12 + row * 18}
        />,
      );
    }
  }

  return (
    <g>
      <rect
        fill="rgba(13,16,19,0.26)"
        height="8"
        rx="4"
        width={width - 18}
        x={x + 9}
        y={y + height - 18}
      />
      <path
        d={`M ${x + 12} ${y + height / 2} H ${x + width - 12}`}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="2"
      />
      <path
        d={`M ${x + 9} ${y + 9} H ${x + width - 9}`}
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="1.6"
      />
      {windows}

      {location?.id === "tea-house" ? (
        <path
          d={`M ${x + 18} ${y + height - 4} Q ${x + width / 2} ${y + height + 18} ${x + width - 18} ${y + height - 4}`}
          fill="rgba(142,67,52,0.94)"
          stroke="rgba(237,214,171,0.26)"
          strokeWidth="1.3"
        />
      ) : null}

      {location?.id === "tea-house" ? (
        <rect
          fill="rgba(80,55,31,0.88)"
          height="12"
          rx="4"
          width="44"
          x={x + 14}
          y={y + 8}
        />
      ) : null}

      {location?.id === "repair-stall" ? (
        <>
          <rect
            fill="rgba(106,89,64,0.92)"
            height="15"
            rx="4"
            width="44"
            x={x + width - 52}
            y={y + height - 19}
          />
          <path
            d={`M ${x + 10} ${y + height - 8} H ${x + width - 10}`}
            stroke="rgba(21,24,27,0.4)"
            strokeWidth="3"
          />
        </>
      ) : null}

      {location?.id === "repair-stall" ? (
        <>
          <rect
            fill="rgba(193,163,112,0.16)"
            height="10"
            rx="3"
            width="14"
            x={x + 10}
            y={y + 10}
          />
          <rect
            fill="rgba(193,163,112,0.16)"
            height="10"
            rx="3"
            width="14"
            x={x + 27}
            y={y + 10}
          />
        </>
      ) : null}

      {location?.id === "boarding-house" ? (
        <>
          <rect fill="rgba(94,73,51,0.96)" height="14" rx="3" width="8" x={x + 18} y={y - 6} />
          <rect fill="rgba(94,73,51,0.96)" height="14" rx="3" width="8" x={x + width - 26} y={y - 4} />
          <rect
            fill="rgba(203,181,141,0.1)"
            height="8"
            rx="4"
            width="48"
            x={x + width / 2 - 24}
            y={y + height - 17}
          />
        </>
      ) : null}
    </g>
  );
}

function DoorShape({ door }: { door: MapDoor }) {
  const x = door.x * CELL;
  const y = door.y * CELL;
  const width = door.width * CELL;
  const height = door.height * CELL;
  const fill =
    door.kind === "gate" ? "rgba(185,160,111,0.96)" : "rgba(31,24,18,0.96)";

  return (
    <g>
      <rect
        fill="rgba(0,0,0,0.22)"
        height={height}
        rx="4"
        width={width}
        x={x + 2}
        y={y + 3}
      />
      <rect
        fill={fill}
        height={height}
        rx="4"
        stroke="rgba(239,228,206,0.12)"
        strokeWidth="1.1"
        width={width}
        x={x}
        y={y}
      />
    </g>
  );
}

function PropShape({
  prop,
  animationBeat,
}: {
  prop: MapProp;
  animationBeat: number;
}) {
  const x = prop.x * CELL;
  const y = prop.y * CELL;
  const scale = prop.scale ?? 1;
  const rotation = prop.rotation ?? 0;
  const seed = hashString(prop.id);
  const sway = Math.sin(animationBeat * 1.5 + seed) * 2.4;
  const bob = Math.cos(animationBeat * 1.9 + seed * 0.7) * 0.7;
  const animatedTransform =
    prop.kind === "laundry"
      ? `translate(0 ${bob}) rotate(${sway})`
      : prop.kind === "canopy"
        ? `translate(0 ${bob * 0.4}) rotate(${sway * 0.7})`
        : prop.kind === "tree"
          ? `translate(${Math.sin(animationBeat * 1.1 + seed) * 0.4} 0) rotate(${sway * 0.25})`
          : "";

  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale}) ${animatedTransform}`}
    >
      {renderPropGlyph(prop)}
    </g>
  );
}

function MapTextLabel({ label }: { label: MapLabel }) {
  const x = label.x * CELL;
  const y = label.y * CELL;
  const titleText = buildMapNarrativeTitle(
    label.text,
    label.context,
    label.backstory,
  );

  if (label.tone === "district") {
    return (
      <g>
        {titleText ? <title>{titleText}</title> : null}
        <text
          fill="rgba(237,228,212,0.34)"
          fontSize="19"
          letterSpacing="6.2"
          textAnchor="middle"
          x={x}
          y={y}
        >
          {label.text.toUpperCase()}
        </text>
      </g>
    );
  }

  if (label.tone === "landmark") {
    return (
      <g>
        {titleText ? <title>{titleText}</title> : null}
        <text
          fill="rgba(183,146,89,0.7)"
          fontSize="12"
          fontWeight="700"
          letterSpacing="2"
          textAnchor="middle"
          x={x}
          y={y}
        >
          {label.text.toUpperCase()}
        </text>
      </g>
    );
  }

  return (
    <g>
      {titleText ? <title>{titleText}</title> : null}
      <text
        fill="rgba(187,179,167,0.48)"
        fontSize="11"
        letterSpacing="2.1"
        textAnchor="middle"
        x={x}
        y={y}
      >
        {label.text.toUpperCase()}
      </text>
    </g>
  );
}

function buildMapNarrativeTitle(...lines: Array<string | undefined>) {
  const content = lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  return content.length > 0 ? content.join("\n") : undefined;
}

function LocationPlacard({
  door,
  isHere,
  known,
  location,
  workCount,
  troubleCount,
}: {
  door: MapDoor;
  isHere: boolean;
  known: boolean;
  location: LocationState;
  workCount: number;
  troubleCount: number;
}) {
  const anchorX = (door.x + door.width / 2) * CELL;
  const anchorY = door.y * CELL;
  const cardWidth = Math.max(110, location.name.length * 7.1);
  const cardX = location.labelX * CELL - cardWidth / 2;
  const cardY = location.labelY * CELL - 18;

  return (
    <g pointerEvents="none">
      <path
        d={`M ${anchorX} ${anchorY - 2} Q ${anchorX} ${cardY + 34} ${cardX + cardWidth / 2} ${cardY + 34}`}
        fill="none"
        opacity="0.52"
        stroke={isHere ? "rgba(183,146,89,0.52)" : "rgba(146,159,169,0.24)"}
        strokeWidth="1.6"
      />
      <rect
        fill={
          isHere
            ? "rgba(17,23,29,0.94)"
            : known
              ? "rgba(14,19,24,0.82)"
              : "rgba(14,19,24,0.58)"
        }
        height="30"
        rx="15"
        stroke={isHere ? "rgba(183,146,89,0.58)" : "rgba(92,109,121,0.28)"}
        width={cardWidth}
        x={cardX}
        y={cardY}
      />
      <text
        fill="rgba(237,228,212,0.96)"
        fontSize="11.6"
        fontWeight="600"
        x={cardX + 12}
        y={cardY + 18.5}
      >
        {location.name}
      </text>
      {workCount > 0 ? (
        <rect
          fill="rgba(183,146,89,0.96)"
          height="7"
          rx="2"
          width="7"
          x={cardX + cardWidth - 26}
          y={cardY + 11.5}
        />
      ) : null}
      {troubleCount > 0 ? (
        <circle
          cx={cardX + cardWidth - 12}
          cy={cardY + 15}
          fill="rgba(177,108,98,0.96)"
          r="4"
        />
      ) : null}
    </g>
  );
}

function NpcMarker({
  x,
  known,
  npcId,
  y,
  facing,
  step,
}: {
  x: number;
  y: number;
  known: boolean;
  npcId: string;
  facing: 1 | -1;
  step: number;
}) {
  const bob = Math.abs(step) * -1.4;
  const appearance = npcAppearanceForId(npcId, known);
  const stride = step * appearance.strideScale;

  return (
    <g transform={`translate(${x} ${y + bob}) scale(${facing} 1)`} pointerEvents="none">
      <ellipse
        cx="0"
        cy="12.9"
        fill="rgba(0,0,0,0.2)"
        rx="6.8"
        ry="2.25"
      />
      <path
        d={`M -2 7.7 L ${-3.2 - stride} 13.2`}
        fill="none"
        stroke={appearance.leg}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d={`M 1.8 7.7 L ${3.2 + stride} 13.2`}
        fill="none"
        stroke={appearance.leg}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <ellipse
        cx={-3.7 - stride}
        cy="13.45"
        fill={appearance.shoe}
        rx="2"
        ry="0.95"
      />
      <ellipse
        cx={3.6 + stride}
        cy="13.45"
        fill={appearance.shoe}
        rx="2"
        ry="0.95"
      />
      <path
        d={`M ${-appearance.bodyWidth} ${appearance.shoulderY} Q 0 ${appearance.shoulderY - 3.2} ${appearance.bodyWidth} ${appearance.shoulderY} L ${appearance.hemWidth} ${appearance.hemY - 2.3} Q ${appearance.hemWidth - 0.2} ${appearance.hemY + 0.6} 0 ${appearance.hemY + 1.1} Q ${-appearance.hemWidth + 0.2} ${appearance.hemY + 0.6} ${-appearance.hemWidth} ${appearance.hemY - 2.3} Z`}
        fill={appearance.coat}
        stroke={appearance.outline}
        strokeWidth="1.1"
      />
      <path
        d={`M ${-appearance.bodyWidth * 0.34} ${appearance.shoulderY + 0.2} Q 0 ${appearance.shoulderY - 1} ${appearance.bodyWidth * 0.34} ${appearance.shoulderY + 0.2} L ${appearance.bodyWidth * 0.25} ${appearance.hemY - 0.8} L ${-appearance.bodyWidth * 0.25} ${appearance.hemY - 0.8} Z`}
        fill={appearance.accent}
        opacity="0.92"
      />
      {renderNpcAccessory(appearance)}
      <path
        d={`M ${-appearance.bodyWidth + 0.4} ${appearance.shoulderY + 2} Q -6.9 3.9 -7.2 6.5`}
        fill="none"
        stroke={appearance.outline}
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <path
        d={`M ${appearance.bodyWidth - 0.4} ${appearance.shoulderY + 2} Q 6.9 3.9 7.2 6.5`}
        fill="none"
        stroke={appearance.outline}
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <circle
        cx="0"
        cy={appearance.headY}
        fill={appearance.face}
        r={appearance.headRadius}
        stroke={appearance.outline}
        strokeWidth="1.25"
      />
      <circle
        cx={-appearance.headRadius * 0.45}
        cy={appearance.headY + appearance.headRadius * 0.3}
        fill={appearance.cheek}
        r="1.1"
      />
      <circle
        cx={appearance.headRadius * 0.45}
        cy={appearance.headY + appearance.headRadius * 0.3}
        fill={appearance.cheek}
        r="1.1"
      />
      {renderNpcHair(appearance)}
      {renderNpcFace(appearance)}
    </g>
  );
}

function PlayerMarker({
  x,
  y,
  animationBeat,
  freeze = false,
}: {
  x: number;
  y: number;
  animationBeat: number;
  freeze?: boolean;
}) {
  const pixelX = (x + 0.5) * CELL;
  const pixelY =
    (y + 0.5) * CELL + (freeze ? 0 : Math.sin(animationBeat * 1.2) * 0.7);

  return (
    <g pointerEvents="none">
      <ellipse
        cx={pixelX}
        cy={pixelY + 13.4}
        fill="rgba(0,0,0,0.24)"
        rx="8.8"
        ry="2.9"
      />
      <circle cx={pixelX} cy={pixelY + 0.6} fill="rgba(183,146,89,0.12)" r="16.5" />
      <path
        d={`M ${pixelX - 2.4} ${pixelY + 8.3} L ${pixelX - 4.6} ${pixelY + 15}`}
        fill="none"
        stroke="rgba(85,64,41,0.96)"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d={`M ${pixelX + 2.2} ${pixelY + 8.3} L ${pixelX + 4.3} ${pixelY + 15}`}
        fill="none"
        stroke="rgba(85,64,41,0.96)"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <ellipse cx={pixelX - 5.1} cy={pixelY + 15.2} fill="rgba(61,45,30,0.98)" rx="1.9" ry="1" />
      <ellipse cx={pixelX + 4.7} cy={pixelY + 15.2} fill="rgba(61,45,30,0.98)" rx="1.9" ry="1" />
      <path
        d={`M ${pixelX - 6.1} ${pixelY + 1.1} Q ${pixelX} ${pixelY - 3.9} ${pixelX + 6.1} ${pixelY + 1.1} L ${pixelX + 5.1} ${pixelY + 4.9} Q ${pixelX + 4.3} ${pixelY + 10.8} ${pixelX} ${pixelY + 11.8} Q ${pixelX - 4.3} ${pixelY + 10.8} ${pixelX - 5.1} ${pixelY + 4.9} Z`}
        fill="rgba(191,152,93,0.98)"
        stroke="rgba(250,239,219,0.7)"
        strokeWidth="1.35"
      />
      <path
        d={`M ${pixelX - 2.4} ${pixelY + 1.2} Q ${pixelX} ${pixelY - 0.2} ${pixelX + 2.4} ${pixelY + 1.2} L ${pixelX + 1.7} ${pixelY + 9.5} L ${pixelX - 1.7} ${pixelY + 9.5} Z`}
        fill="rgba(235,214,175,0.9)"
      />
      <path
        d={`M ${pixelX + 5.4} ${pixelY + 1.8} Q ${pixelX + 8.7} ${pixelY + 4.2} ${pixelX + 7.9} ${pixelY + 8.6}`}
        fill="none"
        stroke="rgba(102,78,48,0.94)"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <rect
        fill="rgba(121,88,46,0.98)"
        height="5.7"
        rx="1.6"
        stroke="rgba(245,225,190,0.45)"
        strokeWidth="0.8"
        width="3.8"
        x={pixelX + 6.2}
        y={pixelY + 3.9}
      />
      <circle
        cx={pixelX}
        cy={pixelY - 7.8}
        fill="rgba(245,235,219,0.98)"
        r="7.35"
        stroke="rgba(16,20,23,0.92)"
        strokeWidth="1.45"
      />
      <path
        d={`M ${pixelX - 7.2} ${pixelY - 9.4} Q ${pixelX - 6} ${pixelY - 15.8} ${pixelX + 0.8} ${pixelY - 15.2} Q ${pixelX + 6.9} ${pixelY - 14.1} ${pixelX + 7.2} ${pixelY - 8.1} L ${pixelX + 5.3} ${pixelY - 4.4} Q ${pixelX + 2.9} ${pixelY - 6.4} ${pixelX - 0.3} ${pixelY - 5.7} Q ${pixelX - 4.4} ${pixelY - 4.9} ${pixelX - 5.8} ${pixelY - 3.6} Z`}
        fill="rgba(122,91,55,0.98)"
      />
      <circle cx={pixelX - 2.2} cy={pixelY - 6.3} fill="rgba(223,179,160,0.35)" r="1.35" />
      <circle cx={pixelX + 2.4} cy={pixelY - 6.3} fill="rgba(223,179,160,0.35)" r="1.35" />
      <path
        d={`M ${pixelX - 3.6} ${pixelY - 10} Q ${pixelX - 2.1} ${pixelY - 11} ${pixelX - 0.5} ${pixelY - 10}`}
        fill="none"
        stroke="rgba(92,69,45,0.96)"
        strokeLinecap="round"
        strokeWidth="0.82"
      />
      <path
        d={`M ${pixelX + 0.6} ${pixelY - 10} Q ${pixelX + 2.1} ${pixelY - 11} ${pixelX + 3.6} ${pixelY - 10}`}
        fill="none"
        stroke="rgba(92,69,45,0.96)"
        strokeLinecap="round"
        strokeWidth="0.82"
      />
      <circle cx={pixelX - 1.95} cy={pixelY - 8.4} fill="rgba(41,33,27,0.94)" r="0.86" />
      <circle cx={pixelX + 1.8} cy={pixelY - 8.4} fill="rgba(41,33,27,0.94)" r="0.86" />
      <path
        d={`M ${pixelX} ${pixelY - 7.1} L ${pixelX - 0.55} ${pixelY - 5.3}`}
        fill="none"
        stroke="rgba(120,90,63,0.62)"
        strokeLinecap="round"
        strokeWidth="0.8"
      />
      <path
        d={`M ${pixelX - 2.4} ${pixelY - 3.9} Q ${pixelX} ${pixelY - 2.1} ${pixelX + 2.5} ${pixelY - 3.9}`}
        fill="none"
        stroke="rgba(75,54,37,0.9)"
        strokeLinecap="round"
        strokeWidth="0.92"
      />
    </g>
  );
}

function ConversationStatusPill({
  x,
  y,
  mapWidth,
  label,
}: {
  x: number;
  y: number;
  mapWidth: number;
  label: string;
}) {
  const width = clamp(label.length * 6.4 + 28, 148, 280);
  const pillX = clamp(x - width / 2, 12, mapWidth - width - 12);

  return (
    <g pointerEvents="none">
      <rect
        fill="rgba(16,22,27,0.9)"
        height="28"
        rx="14"
        stroke="rgba(205,174,115,0.26)"
        strokeWidth="1"
        width={width}
        x={pillX}
        y={y - 24}
      />
      <circle cx={pillX + 14} cy={y - 10} fill="rgba(228,191,123,0.88)" r="2.3" />
      <circle cx={pillX + 20} cy={y - 10} fill="rgba(228,191,123,0.66)" r="2" />
      <circle cx={pillX + 26} cy={y - 10} fill="rgba(228,191,123,0.44)" r="1.8" />
      <text
        fill="rgba(235,228,214,0.94)"
        fontSize="9.4"
        fontWeight="600"
        letterSpacing="0.6"
        x={pillX + 36}
        y={y - 7}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

function ThoughtBubble({
  x,
  y,
  text,
  tone,
  mapWidth,
  mapHeight,
  dx,
  dy,
  variant = "thought",
  speakerLabel,
}: {
  x: number;
  y: number;
  text: string;
  tone: "player" | "npc";
  mapWidth: number;
  mapHeight: number;
  dx: number;
  dy: number;
  variant?: "thought" | "dialogue";
  speakerLabel?: string;
}) {
  const isDialogue = variant === "dialogue";
  const maxLines = isDialogue ? 9 : 5;
  const maxChars = isDialogue ? 34 : 20;
  const lines = wrapThoughtLines(text, maxChars, maxLines);
  const contentWidth =
    Math.max(...lines.map((line) => line.length), 6) *
      (isDialogue ? (tone === "player" ? 6.5 : 6.2) : tone === "player" ? 6.2 : 5.9) +
    (isDialogue ? 34 : 20);
  const bubbleWidth = clamp(contentWidth, isDialogue ? 164 : 82, isDialogue ? 348 : 168);
  const bubbleHeight =
    (speakerLabel ? 28 : 16) +
    lines.length * (isDialogue ? 15.5 : 12.5) +
    (isDialogue ? 10 : 4);
  const bubbleX = clamp(x - bubbleWidth / 2 + dx, 8, mapWidth - bubbleWidth - 8);
  const anchorY = y + dy;
  const aboveY = anchorY - bubbleHeight - 18;
  const belowY = anchorY + 18;
  const maxBubbleY = Math.max(8, mapHeight - bubbleHeight - 8);
  const bubbleY =
    aboveY >= 8
      ? aboveY
      : belowY + bubbleHeight <= mapHeight - 8
        ? belowY
        : clamp(aboveY, 8, maxBubbleY);
  const bubbleBelowAnchor = bubbleY > anchorY;
  const tailX = clamp(x + dx * 0.24, bubbleX + 14, bubbleX + bubbleWidth - 14);
  const speechTailTipX = clamp(x, bubbleX + 18, bubbleX + bubbleWidth - 18);
  const speechTailTipY = bubbleBelowAnchor
    ? bubbleY - 18
    : bubbleY + bubbleHeight + 18;
  const fill =
    tone === "player"
      ? isDialogue
        ? "rgba(246,237,223,0.97)"
        : "rgba(244,235,220,0.94)"
      : isDialogue
        ? "rgba(238,241,244,0.95)"
        : "rgba(241,236,228,0.9)";
  const stroke =
    tone === "player"
      ? isDialogue
        ? "rgba(183,146,89,0.68)"
        : "rgba(183,146,89,0.54)"
      : isDialogue
        ? "rgba(112,126,137,0.5)"
        : "rgba(126,136,143,0.36)";
  const textFill = tone === "player" ? "rgba(69,50,34,0.94)" : "rgba(54,58,63,0.94)";
  const textX = isDialogue ? bubbleX + 12 : bubbleX + bubbleWidth / 2;
  const textY = bubbleY + (speakerLabel ? 27 : 16);

  return (
    <g pointerEvents="none">
      {isDialogue ? (
        <path
          d={
            bubbleBelowAnchor
              ? `M ${tailX - 12} ${bubbleY + 1} Q ${tailX - 4} ${bubbleY - 3} ${speechTailTipX} ${speechTailTipY} Q ${tailX + 4} ${bubbleY - 5} ${tailX + 12} ${bubbleY + 1} Z`
              : `M ${tailX - 12} ${bubbleY + bubbleHeight - 1} Q ${tailX - 4} ${bubbleY + bubbleHeight + 3} ${speechTailTipX} ${speechTailTipY} Q ${tailX + 4} ${bubbleY + bubbleHeight + 5} ${tailX + 12} ${bubbleY + bubbleHeight - 1} Z`
          }
          fill={fill}
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth="1"
        />
      ) : (
        <>
          <circle
            cx={tailX - 2}
            cy={bubbleBelowAnchor ? bubbleY - 7 : bubbleY + bubbleHeight + 7}
            fill={fill}
            r="2.3"
            opacity="0.94"
          />
          <circle
            cx={tailX + 1.4}
            cy={bubbleBelowAnchor ? bubbleY - 11.2 : bubbleY + bubbleHeight + 11.2}
            fill={fill}
            r="1.5"
            opacity="0.9"
          />
        </>
      )}
      <rect
        fill={fill}
        height={bubbleHeight}
        rx="10"
        stroke={stroke}
        strokeWidth="1"
        width={bubbleWidth}
        x={bubbleX}
        y={bubbleY}
      />
      {!isDialogue ? (
        <path
          d={
            bubbleBelowAnchor
              ? `M ${tailX - 6} ${bubbleY + 1} Q ${tailX - 1} ${bubbleY - 4} ${tailX + 4} ${bubbleY + 1}`
              : `M ${tailX - 6} ${bubbleY + bubbleHeight - 1} Q ${tailX - 1} ${bubbleY + bubbleHeight + 4} ${tailX + 4} ${bubbleY + bubbleHeight - 1}`
          }
          fill={fill}
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="0.8"
        />
      ) : null}
      {speakerLabel ? (
        <text
          fill={tone === "player" ? "rgba(150,116,66,0.96)" : "rgba(90,102,112,0.96)"}
          fontSize="8.3"
          fontWeight="700"
          letterSpacing="1.1"
          x={bubbleX + 12}
          y={bubbleY + 14}
        >
          {speakerLabel.toUpperCase()}
        </text>
      ) : null}
      <text
        fill={textFill}
        fontSize={isDialogue ? (tone === "player" ? "11.5" : "11.1") : tone === "player" ? "10.7" : "10.2"}
        fontWeight={tone === "player" ? "600" : "500"}
        x={textX}
        y={textY}
        textAnchor={isDialogue ? "start" : "middle"}
      >
        {lines.map((line, index) => (
          <tspan
            dy={index === 0 ? 0 : isDialogue ? 14.2 : 11.6}
            key={`${line}-${index}`}
            x={textX}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function npcAppearanceForId(npcId: string, known: boolean): NpcAppearance {
  const outline = "rgba(19,24,28,0.9)";
  const muted = !known;

  switch (npcId) {
    case "npc-mara":
      return {
        headY: -8.8,
        headRadius: 6.6,
        bodyWidth: 5.2,
        hemWidth: 5.9,
        shoulderY: -0.2,
        hemY: 8.7,
        strideScale: 1.42,
        coat: muted ? "rgba(111,103,90,0.95)" : "rgba(131,112,88,0.98)",
        accent: muted ? "rgba(183,174,162,0.78)" : "rgba(219,206,183,0.92)",
        hair: muted ? "rgba(95,94,88,0.96)" : "rgba(124,121,111,0.98)",
        face: "rgba(191,132,102,0.98)",
        cheek: "rgba(223,170,150,0.34)",
        eye: "rgba(66,45,31,0.92)",
        outline,
        leg: muted ? "rgba(96,86,72,0.94)" : "rgba(104,79,61,0.95)",
        shoe: "rgba(58,44,31,0.96)",
        hairStyle: "bun",
        faceStyle: "soft",
        accessory: "apron",
      };
    case "npc-ada":
      return {
        headY: -8.5,
        headRadius: 6.3,
        bodyWidth: 4.6,
        hemWidth: 5,
        shoulderY: -0.3,
        hemY: 8.5,
        strideScale: 1.5,
        coat: muted ? "rgba(98,111,112,0.95)" : "rgba(86,119,118,0.98)",
        accent: muted ? "rgba(177,166,155,0.8)" : "rgba(220,191,160,0.92)",
        hair: muted ? "rgba(88,79,71,0.94)" : "rgba(109,71,48,0.98)",
        face: "rgba(228,187,153,0.98)",
        cheek: "rgba(231,189,169,0.28)",
        eye: "rgba(60,41,28,0.92)",
        outline,
        leg: muted ? "rgba(82,91,92,0.94)" : "rgba(63,86,88,0.95)",
        shoe: "rgba(44,38,31,0.96)",
        hairStyle: "scarf",
        faceStyle: "wry",
        accessory: "shawl",
      };
    case "npc-jo":
      return {
        headY: -8.2,
        headRadius: 6.15,
        bodyWidth: 4.9,
        hemWidth: 5.2,
        shoulderY: -0.1,
        hemY: 8.4,
        strideScale: 1.38,
        coat: muted ? "rgba(95,104,109,0.96)" : "rgba(89,103,113,0.98)",
        accent: muted ? "rgba(148,158,165,0.78)" : "rgba(178,190,198,0.88)",
        hair: muted ? "rgba(72,78,83,0.95)" : "rgba(59,64,67,0.98)",
        face: "rgba(159,108,84,0.98)",
        cheek: "rgba(196,141,121,0.22)",
        eye: "rgba(40,33,28,0.92)",
        outline,
        leg: muted ? "rgba(79,85,90,0.94)" : "rgba(70,78,85,0.95)",
        shoe: "rgba(38,43,47,0.96)",
        hairStyle: "cap",
        faceStyle: "steady",
        accessory: "satchel",
      };
    case "npc-tomas":
      return {
        headY: -8.7,
        headRadius: 6.75,
        bodyWidth: 5.6,
        hemWidth: 6,
        shoulderY: 0,
        hemY: 8.9,
        strideScale: 1.28,
        coat: muted ? "rgba(106,100,84,0.95)" : "rgba(119,104,74,0.98)",
        accent: muted ? "rgba(160,155,141,0.76)" : "rgba(190,176,133,0.9)",
        hair: muted ? "rgba(56,52,46,0.96)" : "rgba(41,36,32,0.98)",
        face: "rgba(104,69,49,0.99)",
        cheek: "rgba(163,108,86,0.18)",
        eye: "rgba(22,18,14,0.94)",
        outline,
        leg: muted ? "rgba(84,75,61,0.94)" : "rgba(88,72,52,0.96)",
        shoe: "rgba(31,28,24,0.98)",
        hairStyle: "beard-cap",
        faceStyle: "stern",
        accessory: "vest",
      };
    case "npc-nia":
      return {
        headY: -8.6,
        headRadius: 6.2,
        bodyWidth: 4.4,
        hemWidth: 4.9,
        shoulderY: -0.4,
        hemY: 8.2,
        strideScale: 1.92,
        coat: muted ? "rgba(90,107,99,0.95)" : "rgba(79,131,112,0.98)",
        accent: muted ? "rgba(167,180,166,0.78)" : "rgba(192,218,175,0.9)",
        hair: muted ? "rgba(72,58,45,0.95)" : "rgba(98,69,46,0.98)",
        face: "rgba(207,146,108,0.99)",
        cheek: "rgba(233,180,146,0.28)",
        eye: "rgba(56,35,22,0.92)",
        outline,
        leg: muted ? "rgba(73,86,79,0.94)" : "rgba(59,96,81,0.95)",
        shoe: "rgba(35,46,40,0.96)",
        hairStyle: "ponytail",
        faceStyle: "bright",
        accessory: "scarf",
      };
    default:
      return {
        headY: -8.4,
        headRadius: 6.3,
        bodyWidth: 4.9,
        hemWidth: 5.2,
        shoulderY: -0.2,
        hemY: 8.5,
        strideScale: 1.48,
        coat: muted ? "rgba(100,104,108,0.96)" : "rgba(110,100,82,0.98)",
        accent: muted ? "rgba(164,170,176,0.84)" : "rgba(196,178,143,0.9)",
        hair: muted ? "rgba(82,88,94,0.95)" : "rgba(67,57,45,0.98)",
        face: "rgba(205,158,121,0.98)",
        cheek: "rgba(222,176,159,0.3)",
        eye: "rgba(49,39,30,0.92)",
        outline,
        leg: muted ? "rgba(82,88,94,0.94)" : "rgba(84,74,58,0.94)",
        shoe: "rgba(49,43,36,0.96)",
        hairStyle: "cropped",
        faceStyle: "guarded",
      };
  }
}

function renderNpcAccessory(appearance: NpcAppearance) {
  switch (appearance.accessory) {
    case "apron":
      return (
        <path
          d="M -2.1 1.4 L 2.1 1.4 L 1.7 8.4 L -1.7 8.4 Z"
          fill="rgba(233,222,202,0.78)"
        />
      );
    case "shawl":
      return (
        <path
          d="M -5.2 0.9 Q 0 -2.6 5.2 0.9 L 3.5 2.6 Q 0 1.5 -3.5 2.6 Z"
          fill="rgba(208,183,147,0.88)"
          opacity="0.9"
        />
      );
    case "satchel":
      return (
        <>
          <path
            d="M 2.3 -0.2 Q -0.4 3.1 -0.7 9.1"
            fill="none"
            stroke="rgba(67,51,36,0.86)"
            strokeLinecap="round"
            strokeWidth="1"
          />
          <rect
            x="-1.9"
            y="4.2"
            width="2.6"
            height="2.7"
            rx="0.8"
            fill="rgba(106,78,54,0.95)"
          />
        </>
      );
    case "vest":
      return (
        <path
          d="M -3 0.4 L -0.8 0.4 L -0.2 7.6 L -2.2 7.6 Z M 0.8 0.4 L 3 0.4 L 2.2 7.6 L 0.2 7.6 Z"
          fill="rgba(78,58,39,0.64)"
        />
      );
    case "scarf":
      return (
        <>
          <path
            d="M -3.8 0.9 Q 0 -1.1 3.8 0.9 Q 2.2 2.1 0 2.2 Q -2.2 2.1 -3.8 0.9 Z"
            fill="rgba(222,193,152,0.9)"
          />
          <path
            d="M 2.3 2.1 L 4.6 5.4"
            fill="none"
            stroke="rgba(222,193,152,0.9)"
            strokeLinecap="round"
            strokeWidth="1.15"
          />
        </>
      );
    default:
      return null;
  }
}

function renderNpcHair(appearance: NpcAppearance) {
  const { hairStyle, hair, headY, headRadius } = appearance;

  switch (hairStyle) {
    case "bun":
      return (
        <>
          <circle cx="2.9" cy={headY - headRadius + 0.3} fill={hair} r="2.2" />
          <path
            d={`M ${-headRadius + 0.8} ${headY - 0.9} Q -4.5 ${headY - headRadius + 0.4} 0 ${headY - headRadius + 0.1} Q 4.9 ${headY - headRadius + 0.4} ${headRadius - 0.2} ${headY - 0.6} Q 2.9 ${headY + 0.9} -2.1 ${headY + 0.7} Z`}
            fill={hair}
          />
        </>
      );
    case "scarf":
      return (
        <>
          <path
            d={`M ${-headRadius - 0.5} ${headY - headRadius + 1.1} Q 0 ${headY - headRadius - 1.6} ${headRadius + 0.5} ${headY - headRadius + 1.1} L ${headRadius - 0.2} ${headY - 2.1} Q 0 ${headY - 3.3} ${-headRadius + 0.1} ${headY - 2.1} Z`}
            fill="rgba(205,148,95,0.98)"
          />
          <path
            d={`M ${headRadius - 1.5} ${headY - 1.8} Q ${headRadius + 1.4} ${headY + 1.2} ${headRadius - 0.4} ${headY + 4.1}`}
            fill="none"
            stroke="rgba(205,148,95,0.98)"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </>
      );
    case "cap":
      return (
        <>
          <path
            d={`M ${-headRadius - 0.2} ${headY - 1.6} Q -2 ${headY - headRadius - 1.3} ${headRadius - 0.3} ${headY - 1.7} Q 3.2 ${headY - 0.8} -1.5 ${headY - 0.6} Z`}
            fill={hair}
          />
          <path
            d={`M ${headRadius - 1.2} ${headY - 1.8} Q ${headRadius + 1.6} ${headY - 1.1} ${headRadius + 0.2} ${headY - 0.2}`}
            fill="none"
            stroke={hair}
            strokeLinecap="round"
            strokeWidth="1.4"
          />
        </>
      );
    case "beard-cap":
      return (
        <>
          <path
            d={`M ${-headRadius - 0.4} ${headY - 1.7} Q -1.9 ${headY - headRadius - 1.7} ${headRadius - 0.4} ${headY - 1.8} Q 2.6 ${headY - 1.1} -1.3 ${headY - 0.8} Z`}
            fill={hair}
          />
          <path
            d={`M ${-3.6} ${headY + 2.9} Q 0 ${headY + 6.1} 3.6 ${headY + 2.9} Q 2.9 ${headY + 5.2} 0 ${headY + 5.6} Q -2.9 ${headY + 5.2} -3.6 ${headY + 2.9} Z`}
            fill={hair}
          />
        </>
      );
    case "ponytail":
      return (
        <>
          <path
            d={`M ${-headRadius + 0.4} ${headY - 1.3} Q -3.8 ${headY - headRadius + 0.2} 0 ${headY - headRadius - 0.2} Q 4.6 ${headY - headRadius + 0.1} ${headRadius - 0.1} ${headY - 1.1} Q 1.2 ${headY + 0.5} -2.6 ${headY + 0.6} Z`}
            fill={hair}
          />
          <path
            d={`M ${headRadius - 1} ${headY - headRadius + 1.8} Q ${headRadius + 2.8} ${headY - headRadius + 0.8} ${headRadius + 1.3} ${headY + 2.6}`}
            fill="none"
            stroke={hair}
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </>
      );
    default:
      return (
        <path
          d={`M ${-headRadius + 0.6} ${headY - 1.1} Q -3.8 ${headY - headRadius + 0.1} 0 ${headY - headRadius + 0.1} Q 4.4 ${headY - headRadius + 0.2} ${headRadius - 0.2} ${headY - 0.8} Q 2.7 ${headY + 0.3} -2.5 ${headY + 0.5} Z`}
          fill={hair}
        />
      );
  }
}

function renderNpcFace(appearance: NpcAppearance) {
  const { faceStyle, eye, headY } = appearance;

  switch (faceStyle) {
    case "soft":
      return (
        <>
          <path
            d={`M -3.4 ${headY - 2.1} Q -1.8 ${headY - 2.9} -0.4 ${headY - 1.9}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.72"
          />
          <path
            d={`M 0.4 ${headY - 1.9} Q 1.8 ${headY - 2.9} 3.4 ${headY - 2.1}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.72"
          />
          <circle cx="-1.85" cy={headY - 1.1} fill={eye} r="0.52" />
          <circle cx="1.85" cy={headY - 1.1} fill={eye} r="0.52" />
          <path
            d={`M -2 ${headY + 2.2} Q 0 ${headY + 3.6} 2 ${headY + 2.2}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.8"
          />
        </>
      );
    case "wry":
      return (
        <>
          <path
            d={`M -3 ${headY - 2.5} L -0.9 ${headY - 2.9}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.74"
          />
          <path
            d={`M 0.7 ${headY - 3} L 3.1 ${headY - 2.4}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.74"
          />
          <ellipse cx="-1.85" cy={headY - 1.1} fill={eye} rx="0.58" ry="0.72" />
          <ellipse cx="1.8" cy={headY - 1.1} fill={eye} rx="0.58" ry="0.72" />
          <path
            d={`M 0 ${headY - 0.2} L -0.4 ${headY + 1.3}`}
            fill="none"
            stroke="rgba(126,93,65,0.5)"
            strokeLinecap="round"
            strokeWidth="0.64"
          />
          <path
            d={`M -1.8 ${headY + 2.4} Q -0.1 ${headY + 3.2} 2 ${headY + 1.9}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.82"
          />
        </>
      );
    case "steady":
      return (
        <>
          <path
            d={`M -3 ${headY - 2.1} Q -1.8 ${headY - 2.9} -0.7 ${headY - 2.1}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <path
            d={`M 0.7 ${headY - 2.1} Q 1.8 ${headY - 2.9} 3 ${headY - 2.1}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <circle cx="-1.65" cy={headY - 1.1} fill={eye} r="0.5" />
          <circle cx="1.65" cy={headY - 1.1} fill={eye} r="0.5" />
          <path
            d={`M -1.7 ${headY + 2.6} Q 0 ${headY + 2.2} 1.7 ${headY + 2.6}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.72"
          />
        </>
      );
    case "stern":
      return (
        <>
          <path
            d={`M -3.3 ${headY - 2.8} L -0.9 ${headY - 3.4}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.82"
          />
          <path
            d={`M 0.9 ${headY - 3.4} L 3.3 ${headY - 2.8}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.82"
          />
          <circle cx="-1.8" cy={headY - 1.6} fill={eye} r="0.56" />
          <circle cx="1.8" cy={headY - 1.6} fill={eye} r="0.56" />
          <path
            d={`M -1.9 ${headY + 2.7} Q 0 ${headY + 2.2} 1.9 ${headY + 2.7}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
        </>
      );
    case "bright":
      return (
        <>
          <circle cx="-1.9" cy={headY - 1.3} fill={eye} r="0.58" />
          <circle cx="1.9" cy={headY - 1.3} fill={eye} r="0.58" />
          <path
            d={`M -3.1 ${headY - 2.4} Q -1.7 ${headY - 3.3} -0.4 ${headY - 2.3}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <path
            d={`M 0.4 ${headY - 2.3} Q 1.7 ${headY - 3.3} 3.1 ${headY - 2.4}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <circle cx="-2.55" cy={headY + 0.8} fill={eye} r="0.3" opacity="0.45" />
          <circle cx="-1.6" cy={headY + 1.4} fill={eye} r="0.3" opacity="0.45" />
          <circle cx="-0.6" cy={headY + 0.9} fill={eye} r="0.3" opacity="0.45" />
          <path
            d={`M -2.1 ${headY + 2.3} Q 0 ${headY + 4.1} 2.2 ${headY + 2.3}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.88"
          />
        </>
      );
    default:
      return (
        <>
          <path
            d={`M -3 ${headY - 2} Q -1.7 ${headY - 2.8} -0.5 ${headY - 1.9}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <path
            d={`M 0.5 ${headY - 1.9} Q 1.7 ${headY - 2.8} 3 ${headY - 2}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.7"
          />
          <circle cx="-1.55" cy={headY - 1.05} fill={eye} r="0.5" />
          <circle cx="1.55" cy={headY - 1.05} fill={eye} r="0.5" />
          <path
            d={`M -1.8 ${headY + 2.2} Q 0 ${headY + 3} 1.8 ${headY + 2.2}`}
            fill="none"
            stroke={eye}
            strokeLinecap="round"
            strokeWidth="0.74"
          />
        </>
      );
  }
}

function buildPlayerThought(game: StreetGameState) {
  if (game.player.currentThought) {
    return toFirstPersonText(game.player.currentThought);
  }

  if (game.player.objective?.text) {
    return toFirstPersonText(game.player.objective.text);
  }

  const activeJob = game.jobs.find((job) => job.id === game.player.activeJobId);
  const pumpProblem = game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = game.problems.find((problem) => problem.id === "problem-cart");
  const hasWrench = game.player.inventory.some((item) => item.id === "item-wrench");

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

function buildNpcThought(npc: NpcState, game: StreetGameState) {
  if (npc.currentThought) {
    return toFirstPersonText(npc.currentThought);
  }

  const hour = game.clock.hour + game.clock.minute / 60;
  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const yardJob = game.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = game.problems.find((problem) => problem.id === "problem-cart");
  const playerHasWrench = game.player.inventory.some((item) => item.id === "item-wrench");

  switch (npc.id) {
    case "npc-mara":
      if (pumpProblem?.discovered && pumpProblem.status === "active") {
        return "That pump is making a mess.";
      }
      if (pumpProblem?.discovered && pumpProblem.status === "solved") {
        return "At least the yard's holding.";
      }
      return hour < 12 ? "Somebody's late on rent." : "This house still remembers.";
    case "npc-ada":
      if (!teaJob?.accepted && hour < 12.25) {
        return "I need another pair of hands.";
      }
      if (teaJob?.accepted && !teaJob.completed) {
        return "I need to keep the cups moving.";
      }
      return "Noon rush is almost here.";
    case "npc-jo":
      if (pumpProblem?.discovered && pumpProblem.status === "active" && !playerHasWrench) {
        return "That wrench should sell today.";
      }
      return "Everything breaks eventually.";
    case "npc-tomas":
      if (!yardJob?.accepted && hour < 13.5) {
        return "I need one more back today.";
      }
      if (yardJob?.accepted && !yardJob.completed) {
        return "I need the load moved, not excuses.";
      }
      return "The weather won't lift these crates.";
    case "npc-nia":
      if (cartProblem?.discovered && cartProblem.status === "active") {
        return "That cart will jam the square.";
      }
      return npc.currentLocationId === "moss-pier"
        ? "I should watch the boats, not the gulls."
        : "One rumor here is real.";
    default:
      return toFirstPersonText(npc.summary.split(".")[0] ?? "I need to keep moving.");
  }
}

function buildConversationOverlay({
  npc,
  recentConversation,
}: {
  npc: NpcState;
  recentConversation: StreetGameState["conversations"];
}) {
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
    npcId: npc.id,
    npcText: lastNpcLine,
    playerText: lastPlayerLine || "Can we talk a minute?",
  };
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

function thoughtBubbleOffset(characterId: string) {
  switch (characterId) {
    case "npc-mara":
      return { x: -26, y: -32 };
    case "npc-ada":
      return { x: 24, y: -34 };
    case "npc-jo":
      return { x: 28, y: -30 };
    case "npc-tomas":
      return { x: -30, y: -34 };
    case "npc-nia":
      return { x: 26, y: -36 };
    default:
      return { x: 0, y: -32 };
  }
}

function wrapThoughtLines(text: string, maxChars: number, maxLines = 2) {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || current.length === 0) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function LegendChip({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "lane" | "roof" | "open" | "water";
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 rounded-[22px] border border-[rgba(117,128,137,0.2)] bg-[rgba(14,19,23,0.84)] px-4 py-3">
      <div className={`h-3.5 w-3.5 shrink-0 rounded-full ${legendDotTone(tone)}`} />
      <div className="min-w-0">
        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
          {label}
        </div>
        <div className="mt-1 text-[0.82rem] leading-5 text-[color:var(--text-muted)]">
          {detail}
        </div>
      </div>
    </div>
  );
}

function countActiveJobs(game: StreetGameState) {
  const counts = new Map<string, number>();

  for (const job of game.jobs) {
    if (!job.discovered || job.completed || job.missed) {
      continue;
    }

    counts.set(job.locationId, (counts.get(job.locationId) ?? 0) + 1);
  }

  return counts;
}

function countActiveProblems(game: StreetGameState) {
  const counts = new Map<string, number>();

  for (const problem of game.problems) {
    if (!problem.discovered || problem.status !== "active") {
      continue;
    }

    counts.set(problem.locationId, (counts.get(problem.locationId) ?? 0) + 1);
  }

  return counts;
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

function buildAnimatedNpcState({
  animationBeat,
  findRoute,
  game,
  index,
  locationById,
  npc,
  primaryDoorByLocation,
  propsByLocation,
}: {
  animationBeat: number;
  findRoute: (start: Point, end: Point) => Point[];
  game: StreetGameState;
  index: number;
  locationById: Record<string, LocationState>;
  npc: NpcState;
  primaryDoorByLocation: Map<string, MapDoor>;
  propsByLocation: Map<string, MapProp[]>;
}): AnimatedNpcState {
  const location = locationById[npc.currentLocationId];

  if (!location) {
    return {
      npc,
      known: npc.known,
      x: 0,
      y: 0,
      facing: 1,
      step: 0,
    };
  }

  const nextLocation = nextScheduledLocation(npc, game.clock.hour + game.clock.minute / 60, locationById);
  const patrolPath = buildNpcPatrolPath({
    door: primaryDoorByLocation.get(location.id),
    location,
    nextLocation,
    props: propsByLocation.get(location.id) ?? [],
    findRoute,
  });
  const phaseOffset = ((hashString(npc.id) + index * 17) % 997) / 997;
  const cycleSeconds = patrolCycleSeconds(location.type);
  const progress = positiveModulo(
    animationBeat / cycleSeconds + phaseOffset + game.clock.totalMinutes * 0.021,
    1,
  );
  const point = sampleLoopPath(patrolPath, progress);
  const lookAhead = sampleLoopPath(patrolPath, positiveModulo(progress + 0.018, 1));

  return {
    npc,
    known: npc.known,
    x: point.x * CELL,
    y: point.y * CELL,
    facing: lookAhead.x >= point.x ? 1 : -1,
    step: Math.sin(progress * Math.PI * 2 * Math.max(3, patrolPath.length - 1)),
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
    x: entry.x,
    y: entry.y,
    step: entry.step,
    isYielding: false,
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
      x: point.x,
      y: point.y,
      didYield: false,
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
    x: point.x + awayX * radialPush + tangentX * sidestep,
    y: point.y + awayY * radialPush + tangentY * sidestep,
    didYield: distance < influenceRadius * 0.86,
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
      x: point.x,
      y: point.y,
      wasClamped: false,
    };
  }

  const scale = maximum / distance;
  return {
    x: original.x + dx * scale,
    y: original.y + dy * scale,
    wasClamped: true,
  };
}

function nextScheduledLocation(
  npc: NpcState,
  currentHour: number,
  locationById: Record<string, LocationState>,
) {
  if (npc.schedule.length <= 1) {
    return undefined;
  }

  const stopIndex = npc.schedule.findIndex(
    (entry) => currentHour >= entry.fromHour && currentHour < entry.toHour,
  );
  const resolvedIndex = stopIndex >= 0 ? stopIndex : npc.schedule.length - 1;
  const nextStop = npc.schedule[(resolvedIndex + 1) % npc.schedule.length];

  return nextStop ? locationById[nextStop.locationId] : undefined;
}

function buildNpcPatrolPath({
  door,
  location,
  nextLocation,
  props,
  findRoute,
}: {
  door?: MapDoor;
  location: LocationState;
  nextLocation?: LocationState;
  props: MapProp[];
  findRoute: (start: Point, end: Point) => Point[];
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
    const startTile = `${Math.round(start.x)},${Math.round(start.y)}`;
    const endTile = `${Math.round(end.x)},${Math.round(end.y)}`;
    const cacheKey = `${startTile}->${endTile}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const queue: Point[] = [{ x: Math.round(start.x), y: Math.round(start.y) }];
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
      const fallback = [
        { x: Math.round(start.x), y: Math.round(start.y) },
      ];
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

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function freezeConversationMarker(
  marker: AnimatedNpcState,
  playerPixel: Point,
  mapWidth: number,
  mapHeight: number,
): AnimatedNpcState {
  const standsRightOfPlayer = marker.x >= playerPixel.x;
  const offsetX = standsRightOfPlayer ? CELL * 1.38 : -CELL * 1.38;

  return {
    ...marker,
    facing: standsRightOfPlayer ? -1 : 1,
    step: 0,
    x: clamp(playerPixel.x + offsetX, CELL * 0.7, mapWidth - CELL * 0.7),
    y: clamp(playerPixel.y + CELL * 0.08, CELL * 0.7, mapHeight - CELL * 0.7),
    isYielding: false,
  };
}

function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function positiveModulo(value: number, base: number) {
  return ((value % base) + base) % base;
}

function isOpenSurface(kind?: TileKind) {
  return kind
    ? new Set<TileKind>([
        "lane",
        "plaza",
        "stoop",
        "workyard",
        "courtyard",
        "dock",
      ]).has(kind)
    : false;
}

function tileFill(kind: TileKind) {
  switch (kind) {
    case "lane":
    case "stoop":
      return "url(#lane-cobble)";
    case "plaza":
      return "url(#plaza-pavers)";
    case "workyard":
    case "courtyard":
      return "url(#yard-ground)";
    case "dock":
      return "url(#dock-planks)";
    case "water":
      return "url(#water-ripple)";
    case "garden":
      return "url(#garden-ground)";
    case "roof":
    default:
      return "rgba(17,21,25,0.98)";
  }
}

function tileStroke(kind: TileKind) {
  switch (kind) {
    case "water":
      return "rgba(107,152,182,0.12)";
    case "roof":
      return "rgba(42,49,55,0.26)";
    default:
      return "rgba(255,255,255,0.03)";
  }
}

function roofFill(style?: MapFootprint["roofStyle"]) {
  switch (style) {
    case "tin":
      return "url(#roof-tin)";
    case "plaster":
      return "url(#roof-plaster)";
    case "timber":
      return "url(#roof-timber)";
    case "slate":
    default:
      return "url(#roof-slate)";
  }
}

function footprintFill(kind: MapFootprint["kind"]) {
  switch (kind) {
    case "market":
      return "url(#plaza-pavers)";
    case "yard":
      return "url(#yard-ground)";
    case "dock":
      return "url(#dock-planks)";
    case "water":
      return "url(#water-ripple)";
    case "garden":
      return "url(#garden-ground)";
    case "building":
    default:
      return "rgba(48,55,63,0.94)";
  }
}

function footprintStroke(footprint: MapFootprint) {
  switch (footprint.kind) {
    case "building":
      return "rgba(255,255,255,0.08)";
    case "market":
      return "rgba(222,200,158,0.18)";
    case "yard":
      return "rgba(183,160,121,0.18)";
    case "dock":
      return "rgba(198,176,137,0.16)";
    case "water":
      return "rgba(115,159,189,0.2)";
    case "garden":
      return "rgba(119,154,116,0.18)";
    default:
      return "rgba(255,255,255,0.08)";
  }
}

function renderPropGlyph(prop: MapProp) {
  switch (prop.kind) {
    case "lamp":
      return (
        <>
          <line
            stroke="rgba(71,81,88,0.96)"
            strokeWidth="3"
            x1="0"
            x2="0"
            y1="-17"
            y2="2"
          />
          <circle cx="0" cy="-19" fill="rgba(219,191,134,0.92)" r="5" />
        </>
      );
    case "crate":
      return (
        <rect
          fill="rgba(126,97,63,0.96)"
          height="12"
          rx="2"
          stroke="rgba(78,56,36,0.94)"
          strokeWidth="1.4"
          width="12"
          x="-6"
          y="-6"
        />
      );
    case "barrel":
      return (
        <>
          <ellipse cx="0" cy="-5" fill="rgba(112,85,53,0.98)" rx="5.5" ry="3.2" />
          <rect
            fill="rgba(94,71,45,0.98)"
            height="10"
            rx="3"
            width="11"
            x="-5.5"
            y="-5"
          />
          <ellipse cx="0" cy="5" fill="rgba(112,85,53,0.98)" rx="5.5" ry="3.2" />
        </>
      );
    case "cart":
      return (
        <>
          <rect
            fill="rgba(127,96,61,0.98)"
            height="10"
            rx="2"
            stroke="rgba(73,53,35,0.94)"
            strokeWidth="1.2"
            width="18"
            x="-9"
            y="-7"
          />
          <circle cx="-5.5" cy="6" fill="rgba(33,38,43,0.96)" r="3.4" />
          <circle cx="5.5" cy="6" fill="rgba(33,38,43,0.96)" r="3.4" />
        </>
      );
    case "laundry":
      return (
        <>
          <line
            stroke="rgba(168,159,148,0.88)"
            strokeWidth="1.6"
            x1="-12"
            x2="12"
            y1="-10"
            y2="-8"
          />
          <path d="M -8 -9 L -4 0 L 0 -9 Z" fill="rgba(196,178,150,0.92)" />
          <path d="M 1 -8 L 5 1 L 9 -8 Z" fill="rgba(155,171,184,0.88)" />
        </>
      );
    case "bench":
      return (
        <>
          <rect fill="rgba(121,93,63,0.95)" height="4" rx="2" width="16" x="-8" y="-3" />
          <line stroke="rgba(73,53,35,0.94)" strokeWidth="1.6" x1="-5" x2="-5" y1="1" y2="7" />
          <line stroke="rgba(73,53,35,0.94)" strokeWidth="1.6" x1="5" x2="5" y1="1" y2="7" />
        </>
      );
    case "canopy":
      return (
        <path
          d="M -11 0 L 0 -11 L 11 0 Z"
          fill="rgba(152,64,52,0.9)"
          stroke="rgba(224,198,156,0.3)"
          strokeWidth="1.2"
        />
      );
    case "bollard":
      return (
        <rect
          fill="rgba(59,66,72,0.98)"
          height="12"
          rx="3"
          width="6"
          x="-3"
          y="-6"
        />
      );
    case "pump":
      return (
        <>
          <rect
            fill="rgba(102,114,120,0.98)"
            height="11"
            rx="3"
            width="9"
            x="-4.5"
            y="-4"
          />
          <line
            stroke="rgba(168,176,180,0.98)"
            strokeWidth="2"
            x1="0"
            x2="8"
            y1="-4"
            y2="-10"
          />
        </>
      );
    case "tree":
      return (
        <>
          <rect fill="rgba(98,70,44,0.98)" height="10" rx="2" width="4" x="-2" y="0" />
          <circle cx="0" cy="-6" fill="rgba(77,114,71,0.96)" r="9" />
        </>
      );
    default:
      return null;
  }
}

function legendDotTone(tone: "lane" | "roof" | "open" | "water") {
  switch (tone) {
    case "roof":
      return "bg-[rgba(52,61,69,1)]";
    case "open":
      return "bg-[rgba(183,146,89,0.94)]";
    case "water":
      return "bg-[rgba(39,96,141,0.92)]";
    case "lane":
    default:
      return "bg-[rgba(92,101,109,0.92)]";
  }
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }

  return hash;
}
