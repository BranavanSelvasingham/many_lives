"use client";

import { useEffect, useMemo, useState } from "react";

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
const ANIMATION_INTERVAL_MS = 110;

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
};

export function DistrictMap({
  game,
  onTileClick,
  busy,
}: {
  game: StreetGameState;
  onTileClick: (x: number, y: number) => void;
  busy: boolean;
}) {
  const [animationNow, setAnimationNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAnimationNow(Date.now());
    }, ANIMATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  const animationBeat = animationNow / 1000;
  const sceneMinutes = game.clock.totalMinutes + animationBeat * 2.4;
  const locationById = useMemo(
    () => Object.fromEntries(game.locations.map((location) => [location.id, location])),
    [game.locations],
  );
  const knownLocationIds = new Set(game.player.knownLocationIds);
  const currentLocationId = game.player.currentLocationId;
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
  const mapWidth = game.map.width * CELL;
  const mapHeight = game.map.height * CELL;
  const animatedNpcs = useMemo(
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

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-[rgba(117,128,137,0.22)] bg-[rgba(8,12,15,0.97)] shadow-[0_34px_90px_rgba(0,0,0,0.36)]">
        <div className="overflow-x-auto p-4 sm:p-5">
          <div className="mx-auto min-w-[920px]">
            <svg
              className="h-auto w-full"
              viewBox={`0 0 ${mapWidth + MAP_PADDING * 2} ${mapHeight + MAP_PADDING * 2}`}
            >
              <SceneDefs />

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
                  fill="rgba(6,9,11,0.42)"
                  height={mapHeight}
                  rx="24"
                  stroke="rgba(126,144,157,0.18)"
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
                            fill="rgba(0,0,0,0)"
                            onClick={() => {
                              if (!busy) {
                                onTileClick(location.entryX, location.entryY);
                              }
                            }}
                            r="18"
                            stroke={isHere ? "rgba(183,146,89,0.38)" : "rgba(146,159,169,0.14)"}
                            strokeWidth="1.2"
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                <g>
                  {animatedNpcs.map((entry) => (
                    <NpcMarker
                      facing={entry.facing}
                      key={entry.npc.id}
                      known={entry.known}
                      step={entry.step}
                      x={entry.x}
                      y={entry.y}
                    />
                  ))}
                </g>

                <PlayerMarker animationBeat={animationBeat} x={game.player.x} y={game.player.y} />

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
        <stop offset="0%" stopColor="#162028" />
        <stop offset="55%" stopColor="#0d151a" />
        <stop offset="100%" stopColor="#090d10" />
      </linearGradient>

      <radialGradient id="sun-haze" cx="28%" cy="18%" r="55%">
        <stop offset="0%" stopColor="rgba(222,187,121,0.17)" />
        <stop offset="100%" stopColor="rgba(222,187,121,0)" />
      </radialGradient>

      <radialGradient id="street-vignette" cx="50%" cy="50%" r="70%">
        <stop offset="62%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
      </radialGradient>

      <linearGradient id="river-glint" x1="0%" x2="100%" y1="0%" y2="0%">
        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
        <stop offset="50%" stopColor="rgba(182,220,244,0.34)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>

      <pattern id="lane-cobble" height="22" patternUnits="userSpaceOnUse" width="22">
        <rect fill="#47525c" height="22" width="22" />
        <path
          d="M0 6 C4 4,7 4,11 6 C15 8,18 8,22 6 M0 16 C4 14,7 14,11 16 C15 18,18 18,22 16"
          fill="none"
          stroke="#5f6a73"
          strokeWidth="1.1"
        />
        <path
          d="M5 0 V22 M16 0 V22"
          fill="none"
          stroke="rgba(33,38,43,0.28)"
          strokeWidth="0.9"
        />
      </pattern>

      <pattern id="plaza-pavers" height="26" patternUnits="userSpaceOnUse" width="26">
        <rect fill="#6c624c" height="26" width="26" />
        <path
          d="M0 13 H26 M13 0 V26"
          fill="none"
          stroke="#8b7c5d"
          strokeWidth="1.2"
        />
        <path
          d="M0 0 L26 26 M26 0 L0 26"
          fill="none"
          stroke="rgba(53,44,31,0.16)"
          strokeWidth="0.9"
        />
      </pattern>

      <pattern id="yard-ground" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#5d5647" height="16" width="16" />
        <path d="M0 4 H16 M0 12 H16" stroke="#746852" strokeWidth="0.9" />
      </pattern>

      <pattern id="dock-planks" height="14" patternUnits="userSpaceOnUse" width="14">
        <rect fill="#72583b" height="14" width="14" />
        <path d="M0 7 H14" stroke="#8d6f4e" strokeWidth="1.1" />
        <path d="M0 0 V14 M7 0 V14" stroke="rgba(55,39,25,0.24)" strokeWidth="0.9" />
      </pattern>

      <pattern id="water-ripple" height="24" patternUnits="userSpaceOnUse" width="24">
        <rect fill="#224962" height="24" width="24" />
        <path
          d="M0 8 C4 6,8 6,12 8 C16 10,20 10,24 8 M0 18 C4 16,8 16,12 18 C16 20,20 20,24 18"
          fill="none"
          stroke="#4b86a7"
          strokeWidth="1.2"
        />
      </pattern>

      <pattern id="garden-ground" height="18" patternUnits="userSpaceOnUse" width="18">
        <rect fill="#335138" height="18" width="18" />
        <circle cx="4" cy="5" fill="#456b49" r="1.8" />
        <circle cx="11" cy="10" fill="#416543" r="1.8" />
      </pattern>

      <pattern id="roof-slate" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#2d343c" height="16" width="16" />
        <path d="M0 12 L16 0" stroke="#404b55" strokeWidth="1.4" />
        <path d="M-4 16 L12 0" stroke="rgba(79,91,101,0.52)" strokeWidth="1" />
      </pattern>

      <pattern id="roof-tin" height="14" patternUnits="userSpaceOnUse" width="14">
        <rect fill="#50575c" height="14" width="14" />
        <path d="M4 0 V14 M10 0 V14" stroke="#6d767d" strokeWidth="1.2" />
      </pattern>

      <pattern id="roof-plaster" height="18" patternUnits="userSpaceOnUse" width="18">
        <rect fill="#82786b" height="18" width="18" />
        <circle cx="5" cy="6" fill="#968b7b" r="1.4" />
        <circle cx="13" cy="12" fill="#8d8374" r="1.4" />
      </pattern>

      <pattern id="roof-timber" height="16" patternUnits="userSpaceOnUse" width="16">
        <rect fill="#694f39" height="16" width="16" />
        <path d="M0 6 H16 M0 12 H16" stroke="#4f3a2a" strokeWidth="1.2" />
      </pattern>

      <filter id="soft-shadow" height="220%" width="220%" x="-60%" y="-60%">
        <feDropShadow
          dx="0"
          dy="10"
          floodColor="rgba(0,0,0,0.42)"
          stdDeviation="10"
        />
      </filter>

      <filter id="lamp-blur" height="240%" width="240%" x="-70%" y="-70%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
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
  const height = water.height * CELL;
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

  if (footprint.kind === "building") {
    return (
      <g filter="url(#soft-shadow)">
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

  if (label.tone === "district") {
    return (
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
    );
  }

  if (label.tone === "landmark") {
    return (
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
    );
  }

  return (
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
  );
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
  y,
  facing,
  step,
}: {
  x: number;
  y: number;
  known: boolean;
  facing: 1 | -1;
  step: number;
}) {
  const bob = Math.abs(step) * -1.4;
  const stride = step * 1.8;

  return (
    <g transform={`translate(${x} ${y + bob}) scale(${facing} 1)`} pointerEvents="none">
      <ellipse
        cx="0"
        cy="12"
        fill="rgba(0,0,0,0.26)"
        rx="5.5"
        ry="2.6"
      />
      <circle
        cx="0"
        cy="-6"
        fill={known ? "rgba(236,222,193,0.94)" : "rgba(156,168,177,0.9)"}
        r="4"
        stroke="rgba(11,15,19,0.92)"
        strokeWidth="1.5"
      />
      <path
        d="M -4 0 Q 0 -4 4 0 L 3 8 L -3 8 Z"
        fill={known ? "rgba(97,122,141,0.95)" : "rgba(83,92,100,0.95)"}
        stroke="rgba(11,15,19,0.72)"
        strokeWidth="1.2"
      />
      <path
        d={`M -1 8 L ${-2.8 - stride} 14`}
        fill="none"
        opacity="0.62"
        stroke="rgba(214,200,176,0.62)"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <path
        d={`M 1 8 L ${2.8 + stride} 14`}
        fill="none"
        opacity="0.62"
        stroke="rgba(214,200,176,0.62)"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </g>
  );
}

function PlayerMarker({
  x,
  y,
  animationBeat,
}: {
  x: number;
  y: number;
  animationBeat: number;
}) {
  const pixelX = (x + 0.5) * CELL;
  const pixelY = (y + 0.5) * CELL + Math.sin(animationBeat * 1.2) * 0.7;

  return (
    <g pointerEvents="none">
      <ellipse
        cx={pixelX}
        cy={pixelY + 12}
        fill="rgba(0,0,0,0.28)"
        rx="8"
        ry="3.2"
      />
      <circle cx={pixelX} cy={pixelY} fill="rgba(183,146,89,0.16)" r="19" />
      <circle
        cx={pixelX}
        cy={pixelY - 7}
        fill="rgba(245,235,219,0.96)"
        r="5"
        stroke="rgba(16,20,23,0.94)"
        strokeWidth="1.6"
      />
      <path
        d={`M ${pixelX - 6} ${pixelY - 1} Q ${pixelX} ${pixelY - 8} ${pixelX + 6} ${pixelY - 1} L ${pixelX + 4} ${pixelY + 10} L ${pixelX - 4} ${pixelY + 10} Z`}
        fill="rgba(183,146,89,0.98)"
        stroke="rgba(244,235,220,0.7)"
        strokeWidth="1.6"
      />
    </g>
  );
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
  const cycleSeconds =
    location.type === "square"
      ? 18
      : location.type === "workyard"
        ? 16
        : location.type === "pier"
          ? 14
          : 11.5;
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
        { x: Math.round(end.x), y: Math.round(end.y) },
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

function interpolatePoint(from: Point, to: Point, progress: number) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
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
