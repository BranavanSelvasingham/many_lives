import {
  projectVisualScenePoint,
  type VisualScene,
} from "@/lib/street/visualScenes";

export const CELL = 40;
export const KENNEY_TILE = 16;
export const KENNEY_SCALE = CELL / KENNEY_TILE;
export const WORLD_PADDING = 16;
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
  const maxScrollX = Math.max(world.width - visibleWidth, 0);
  if (!map) {
    return { max: maxScrollX, min: 0 };
  }

  if (visualScene) {
    const projectedLeft = projectVisualScenePoint(visualScene, {
      x: 0,
      y: 0,
    }).x;
    const projectedRight = projectVisualScenePoint(visualScene, {
      x: map.width,
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
  const contentRight = mapOrigin.x + map.width * CELL;
  const min = clamp(contentLeft, 0, maxScrollX);
  const max = Math.max(min, Math.min(contentRight - visibleWidth, maxScrollX));
  return { max, min };
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
