import {
  projectVisualScenePoint,
  type VisualScene,
} from "@/lib/street/visualScenes";

export const CELL = 40;
export const KENNEY_TILE = 16;
export const KENNEY_SCALE = CELL / KENNEY_TILE;
export const WORLD_PADDING = 16;
export const COMPACT_CAMERA_HORIZONTAL_OVERSCAN_MAX = CELL * 12;
export const COMPACT_CAMERA_NORTH_CLEARANCE_MAX = CELL * 9;
export const COMPACT_CAMERA_VERTICAL_OVERSCAN_MAX = CELL * 12;
export const VISUAL_MARGIN_TILES = {
  bottom: 1,
  left: 2,
  right: 2,
  top: 1,
} as const;

export type MapSize = {
  height: number;
  width: number;
};

export type RuntimeGeometryPoint = {
  x: number;
  y: number;
};

export type CameraScrollRange = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

export function getWorldBoundsForRuntime({
  map,
  viewport,
  visualScene,
}: {
  map?: MapSize;
  viewport: MapSize;
  visualScene?: Pick<VisualScene, "height" | "width"> | null;
}) {
  if (visualScene) {
    return {
      height: visualScene.height,
      width: visualScene.width,
    };
  }

  if (!map) {
    return {
      height: viewport.height,
      width: viewport.width,
    };
  }

  const extendedGrid = getExtendedGridSize(map);
  return {
    height: extendedGrid.height * CELL + WORLD_PADDING * 2,
    width: extendedGrid.width * CELL + WORLD_PADDING * 2,
  };
}

export function getCompactCameraHorizontalRange({
  map,
  visualScene,
  visibleWidth,
  world,
}: {
  map?: MapSize;
  visualScene?: VisualScene | null;
  visibleWidth: number;
  world: MapSize;
}) {
  const range = getCompactCameraScrollRange({
    map,
    visibleHeight: world.height,
    visibleWidth,
    visualScene,
    world,
  });
  return { max: range.maxX, min: range.minX };
}

export function getCompactCameraScrollRange({
  map,
  visibleHeight,
  visibleWidth,
  visualScene,
  world,
}: {
  map?: MapSize;
  visibleHeight: number;
  visibleWidth: number;
  visualScene?: VisualScene | null;
  world: MapSize;
}): CameraScrollRange {
  const maxScrollX = Math.max(world.width - visibleWidth, 0);
  const maxScrollY = Math.max(world.height - visibleHeight, 0);
  const horizontalOverscan = getCompactCameraHorizontalOverscan(visibleWidth);
  const verticalOverscan = getCompactCameraVerticalOverscan(visibleHeight);
  const northOverscan = getCompactCameraNorthOverscan(visibleHeight);
  const minBoundX = -horizontalOverscan;
  const maxBoundX = maxScrollX + horizontalOverscan;
  const minBoundY = -northOverscan;
  const maxBoundY = maxScrollY + verticalOverscan;
  if (!map) {
    return {
      maxX: maxBoundX,
      maxY: maxBoundY,
      minX: minBoundX,
      minY: minBoundY,
    };
  }

  if (visualScene) {
    return {
      maxX: maxBoundX,
      maxY: maxBoundY,
      minX: minBoundX,
      minY: minBoundY,
    };
  }

  const mapOrigin = getMapWorldOrigin();
  const contentLeft = mapOrigin.x;
  const contentRight = mapOrigin.x + map.width * CELL;
  const contentTop = mapOrigin.y;
  const contentBottom = mapOrigin.y + map.height * CELL;
  const minX = clamp(contentLeft - horizontalOverscan, minBoundX, maxBoundX);
  const maxX = Math.max(
    minX,
    Math.min(contentRight - visibleWidth + horizontalOverscan, maxBoundX),
  );
  const minY = clamp(contentTop - northOverscan, minBoundY, maxBoundY);
  const maxY = Math.max(
    minY,
    Math.min(contentBottom - visibleHeight + verticalOverscan, maxBoundY),
  );
  return { maxX, maxY, minX, minY };
}

export function getCompactCameraHorizontalOverscan(visibleWidth: number) {
  return clamp(
    visibleWidth * 0.58,
    CELL * 3,
    COMPACT_CAMERA_HORIZONTAL_OVERSCAN_MAX,
  );
}

export function getCompactCameraVerticalOverscan(visibleHeight: number) {
  return clamp(
    visibleHeight * 0.36,
    CELL * 3,
    COMPACT_CAMERA_VERTICAL_OVERSCAN_MAX,
  );
}

export function getCompactCameraNorthOverscan(visibleHeight: number) {
  return (
    getCompactCameraVerticalOverscan(visibleHeight) +
    clamp(visibleHeight * 0.28, CELL * 2, COMPACT_CAMERA_NORTH_CLEARANCE_MAX)
  );
}

export function getExtendedGridSize(map: MapSize) {
  return {
    height: map.height + VISUAL_MARGIN_TILES.top + VISUAL_MARGIN_TILES.bottom,
    width: map.width + VISUAL_MARGIN_TILES.left + VISUAL_MARGIN_TILES.right,
  };
}

export function getMapWorldOrigin() {
  return {
    x: WORLD_PADDING + VISUAL_MARGIN_TILES.left * CELL,
    y: WORLD_PADDING + VISUAL_MARGIN_TILES.top * CELL,
  };
}

export function mapPointToWorld(point: RuntimeGeometryPoint) {
  const origin = getMapWorldOrigin();
  return {
    x: origin.x + point.x * CELL,
    y: origin.y + point.y * CELL,
  };
}

export function projectRuntimePoint(
  runtime: { visualScene: VisualScene | null },
  point: RuntimeGeometryPoint,
) {
  if (runtime.visualScene) {
    return projectVisualScenePoint(runtime.visualScene, point);
  }

  return mapPointToWorld(point);
}

export function projectRuntimeTileCenter(
  runtime: { visualScene: VisualScene | null },
  x: number,
  y: number,
) {
  return projectRuntimePoint(runtime, {
    x: x + 0.5,
    y: y + 0.5,
  });
}

export function mapTileToWorldOrigin(x: number, y: number) {
  return mapPointToWorld({ x, y });
}

export function mapTileToWorldCenter(x: number, y: number) {
  return mapPointToWorld({
    x: x + 0.5,
    y: y + 0.5,
  });
}

export function worldGridToWorldOrigin(x: number, y: number) {
  return {
    x: WORLD_PADDING + x * CELL,
    y: WORLD_PADDING + y * CELL,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
