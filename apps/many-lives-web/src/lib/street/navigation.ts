import type {
  LocationState,
  MapDoor,
  MapProp,
  MapTile,
  TileKind,
} from "./types";

export type Point = {
  x: number;
  y: number;
};

export type RouteFinder = (start: Point, end: Point) => Point[];

export type WalkableRuntimePoint = {
  kind: TileKind;
  locationId?: string;
  tile: Point;
  tileCenter: Point;
  world: Point;
};

type WalkablePointSearchOptions = {
  preferredKinds?: TileKind[];
  preferredLocationId?: string;
  worldDistanceScale?: number;
};

export const PUBLIC_TRAVEL_TILE_KINDS: TileKind[] = [
  "lane",
  "plaza",
  "stoop",
  "dock",
];
export const PLAYER_ENTRANCE_TILE_KINDS: TileKind[] = [
  "lane",
  "plaza",
  "dock",
];

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

const DEFAULT_WORLD_DISTANCE_SCALE = 40;

export function createRouteFinder(tiles: MapTile[]): RouteFinder {
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

export function routeReachesDestination(route: Point[], destination: Point) {
  const endpoint = route[route.length - 1];
  return Boolean(
    endpoint &&
      endpoint.x === Math.round(destination.x) &&
      endpoint.y === Math.round(destination.y),
  );
}

export function pathDistance(path: Point[]) {
  if (path.length <= 1) {
    return 0;
  }

  return path.slice(1).reduce((sum, point, index) => {
    return sum + distanceBetween(path[index], point);
  }, 0);
}

export function buildNpcPatrolPath({
  door,
  findRoute,
  location,
  nextLocation,
  props,
  visualHints,
  walkableRuntimePoints,
}: {
  door?: MapDoor;
  findRoute: RouteFinder;
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

export function findNearestWalkablePointByWorldHint(
  walkableRuntimePoints: WalkableRuntimePoint[],
  point: Point,
  options: WalkablePointSearchOptions = {},
) {
  let bestPoint: WalkableRuntimePoint | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const worldDistanceScale =
    options.worldDistanceScale ?? DEFAULT_WORLD_DISTANCE_SCALE;

  for (const candidate of walkableRuntimePoints) {
    const score =
      distanceBetween(candidate.world, point) / worldDistanceScale +
      walkableSearchPenalty(candidate, options);

    if (score < bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

export function dedupePointSequence(points: Point[]) {
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

export function patrolCycleSeconds(locationType?: string) {
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

export function loopPathDistance(path: Point[]) {
  if (path.length <= 1) {
    return 0;
  }

  return path.reduce((sum, point, index) => {
    const next = path[(index + 1) % path.length];
    return sum + distanceBetween(point, next);
  }, 0);
}

export function sampleLoopPath(path: Point[], progress: number) {
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

export function samplePathPoint(path: Point[], progress: number) {
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

export function distanceBetween(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function perpendicularNormal(from: Point, to: Point) {
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
  routeFinder: RouteFinder,
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

function interpolatePoint(from: Point, to: Point, progress: number) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
