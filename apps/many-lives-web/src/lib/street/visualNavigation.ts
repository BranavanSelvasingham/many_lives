import {
  createRouteFinder,
  dedupePointSequence,
  distanceBetween,
  pathDistance,
  routeReachesDestination,
  type Point,
  type RouteFinder,
  type WalkableRuntimePoint,
} from "./navigation";
import type { MapTile, StreetGameState } from "./types";

type VisualRect = {
  height: number;
  radius?: number;
  width: number;
  x: number;
  y: number;
};

type VisualNavigationScene = {
  landmarkModules: Array<{
    kind: string;
    rect: VisualRect;
  }>;
  landmarks: Array<{
    rect: VisualRect;
    style: string;
  }>;
  projection: {
    columnCenters: number[];
    rowCenters: number[];
  };
};

const CELL = 40;
const WORLD_PADDING = 16;
const VISUAL_MARGIN_TILES = {
  left: 2,
  top: 1,
} as const;
const WORLD_PATH_LEGAL_TOLERANCE = 3;

const BLOCKING_LANDMARK_INSET_BY_STYLE: Record<string, number> = {
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

export type VisualRouteDiagnostics = {
  blockedByVisualScene: number;
  legal: boolean;
  reachesDestination: boolean;
  sampledPointsLegal: boolean;
  snappedEnd: boolean;
  snappedStart: boolean;
};

export type VisualRouteResult = {
  diagnostics: VisualRouteDiagnostics;
  distance: number;
  reachesDestination: boolean;
  tilePath: Point[];
  worldPath: Point[];
};

export type VisualNavigationSurface = {
  blockedByVisualScene: number;
  routeFinder: RouteFinder;
  tiles: MapTile[];
  walkableRuntimePoints: WalkableRuntimePoint[];
};

export function buildVisualNavigationSurface(
  game: StreetGameState,
  visualScene: VisualNavigationScene | null,
): VisualNavigationSurface {
  const navigation = buildVisualNavigationTiles(game, visualScene);
  const walkableRuntimePoints = buildVisualWalkableRuntimePoints(
    navigation.tiles,
    visualScene,
  );

  return {
    blockedByVisualScene: navigation.blockedByVisualScene,
    routeFinder: createRouteFinder(navigation.tiles),
    tiles: navigation.tiles,
    walkableRuntimePoints,
  };
}

export function buildVisualNavigationTiles(
  game: StreetGameState,
  visualScene: VisualNavigationScene | null,
) {
  if (!visualScene) {
    return {
      blockedByVisualScene: 0,
      tiles: game.map.tiles,
    };
  }

  const blockingRects = collectVisualSceneBlockingRects(visualScene);
  if (blockingRects.length === 0) {
    return {
      blockedByVisualScene: 0,
      tiles: game.map.tiles,
    };
  }

  let blockedByVisualScene = 0;
  const tiles = game.map.tiles.map((tile) => {
    if (!tile.walkable) {
      return tile;
    }

    if (!isNavigationTileBlockedByVisualScene(tile, visualScene, blockingRects)) {
      return tile;
    }

    blockedByVisualScene += 1;
    return { ...tile, walkable: false };
  });

  return {
    blockedByVisualScene,
    tiles,
  };
}

export function buildVisualWalkableRuntimePoints(
  tiles: MapTile[],
  visualScene: VisualNavigationScene | null,
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
        world: projectVisualNavigationPoint(visualScene, tileCenter),
      };
    });
}

export function resolveVisualRoute({
  blockedByVisualScene = 0,
  end,
  routeFinder,
  start,
  startWorldPoint,
  visualScene,
  walkableRuntimePoints,
}: {
  blockedByVisualScene?: number;
  end: Point;
  routeFinder: RouteFinder;
  start: Point;
  startWorldPoint?: Point;
  visualScene: VisualNavigationScene | null;
  walkableRuntimePoints: WalkableRuntimePoint[];
}): VisualRouteResult {
  const resolvedStart = resolveRouteEndpoint(start, walkableRuntimePoints);
  const resolvedEnd = resolveRouteEndpoint(end, walkableRuntimePoints);
  const routedPath =
    resolvedStart && resolvedEnd
      ? routeFinder(resolvedStart.tile, resolvedEnd.tile)
      : [];
  const reachesDestination = resolvedEnd
    ? routeReachesDestination(routedPath, resolvedEnd.tile)
    : false;
  const tilePath =
    resolvedStart && reachesDestination
      ? dedupePointSequence([
          start,
          ...routedPath.slice(
            routedPath.length > 0 &&
              routedPath[0].x === Math.round(start.x) &&
              routedPath[0].y === Math.round(start.y)
              ? 1
              : 0,
          ),
        ])
      : resolvedStart
        ? [start]
        : [];
  const projectedWorldPath = tilePath.map((point, index) =>
    index === 0 && startWorldPoint
      ? startWorldPoint
      : projectVisualNavigationTileCenter(
          visualScene,
          Math.round(point.x),
          Math.round(point.y),
        ),
  );
  const worldPath = dedupePointSequence(projectedWorldPath);
  const sampledPointsLegal = isVisualWorldPathLegal(
    worldPath,
    walkableRuntimePoints,
  );
  const legal = reachesDestination && sampledPointsLegal && tilePath.length > 0;

  return {
    diagnostics: {
      blockedByVisualScene,
      legal,
      reachesDestination,
      sampledPointsLegal,
      snappedEnd: resolvedEnd
        ? resolvedEnd.tile.x !== Math.round(end.x) ||
          resolvedEnd.tile.y !== Math.round(end.y)
        : false,
      snappedStart: resolvedStart
        ? resolvedStart.tile.x !== Math.round(start.x) ||
          resolvedStart.tile.y !== Math.round(start.y)
        : false,
    },
    distance: pathDistance(tilePath),
    reachesDestination,
    tilePath,
    worldPath,
  };
}

export function isVisualWorldPathLegal(
  worldPath: Point[],
  walkableRuntimePoints: WalkableRuntimePoint[],
  tolerance = WORLD_PATH_LEGAL_TOLERANCE,
) {
  if (worldPath.length === 0) {
    return false;
  }

  return worldPath.every((point) =>
    walkableRuntimePoints.some(
      (walkablePoint) => distanceBetween(walkablePoint.world, point) <= tolerance,
    ),
  );
}

export function projectVisualNavigationTileCenter(
  visualScene: VisualNavigationScene | null,
  x: number,
  y: number,
) {
  return projectVisualNavigationPoint(visualScene, {
    x: x + 0.5,
    y: y + 0.5,
  });
}

export function projectVisualNavigationPoint(
  visualScene: VisualNavigationScene | null,
  point: Point,
) {
  if (visualScene) {
    return {
      x: interpolateAnchors(visualScene.projection.columnCenters, point.x),
      y: interpolateAnchors(visualScene.projection.rowCenters, point.y),
    };
  }

  return {
    x: WORLD_PADDING + VISUAL_MARGIN_TILES.left * CELL + point.x * CELL,
    y: WORLD_PADDING + VISUAL_MARGIN_TILES.top * CELL + point.y * CELL,
  };
}

function resolveRouteEndpoint(
  point: Point,
  walkableRuntimePoints: WalkableRuntimePoint[],
) {
  const roundedPoint = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
  const exactPoint = walkableRuntimePoints.find(
    (candidate) =>
      candidate.tile.x === roundedPoint.x && candidate.tile.y === roundedPoint.y,
  );

  if (exactPoint) {
    return exactPoint;
  }

  return findNearestWalkableRuntimePointByTileCenter(
    walkableRuntimePoints,
    point,
  );
}

function findNearestWalkableRuntimePointByTileCenter(
  walkableRuntimePoints: WalkableRuntimePoint[],
  point: Point,
) {
  let bestPoint: WalkableRuntimePoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of walkableRuntimePoints) {
    const distance = distanceBetween(candidate.tileCenter, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

function collectVisualSceneBlockingRects(scene: VisualNavigationScene) {
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
  scene: VisualNavigationScene,
  blockingRects: VisualRect[],
) {
  const projectedPoint = projectVisualNavigationPoint(scene, {
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

function interpolateAnchors(anchors: number[], value: number) {
  if (anchors.length === 0) {
    return 0;
  }

  if (anchors.length === 1) {
    return anchors[0];
  }

  if (value <= 0) {
    const firstGap = anchors[1] - anchors[0];
    return anchors[0] + value * firstGap;
  }

  if (value >= anchors.length - 1) {
    const lastIndex = anchors.length - 1;
    const lastGap = anchors[lastIndex] - anchors[lastIndex - 1];
    return anchors[lastIndex] + (value - lastIndex) * lastGap;
  }

  const lowerIndex = Math.floor(value);
  const upperIndex = Math.min(lowerIndex + 1, anchors.length - 1);
  const localProgress = value - lowerIndex;
  const lower = anchors[lowerIndex];
  const upper = anchors[upperIndex];
  return lower + (upper - lower) * localProgress;
}
