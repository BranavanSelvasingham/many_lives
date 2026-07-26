import type PhaserType from "phaser";

import type { Point } from "@/lib/street/navigation";
import {
  CELL,
  getCompactCameraScrollRange,
  getMapWorldOrigin,
  getWorldBoundsForRuntime,
  type MapSize,
} from "@/lib/street/runtimeGeometry";
import {
  clampCameraZoomFactor,
  getSceneZoom,
  isCompactViewport,
  isCompactPortraitViewport,
  type SceneViewport,
  type ViewportSize,
} from "@/lib/street/runtimeViewport";
import type { VisualScene } from "@/lib/street/visualScenes";

const CAMERA_DRAG_START_DISTANCE_PX = 10;
const CAMERA_DRAG_PAN_MULTIPLIER = 2.35;
const CAMERA_DRAG_PAN_COMPACT_VERTICAL_MULTIPLIER = 5.2;
const CAMERA_OFFSET_RETURN_DELAY_MS = 30_000;
const CAMERA_OFFSET_RETURN_LERP = 0.003;
const CAMERA_RECENT_INTERACTION_LERP = 0.68;
const CAMERA_USER_ZOOM_LERP = 0.16;
const INTERIOR_COMPOSITION_CLEARANCE = CELL * 0.4;
const PLAYER_CAMERA_LERP = 0.08;
const COMPACT_CAMERA_ANCHOR_Y_INTERACTIVE_RATIO = 0.5;
const COMPACT_CAMERA_ANCHOR_Y_WATCH_RATIO = 0.48;
const CAMERA_OFFSET_VERTICAL_WORLD_RATIO = 0.72;
const COMPACT_CAMERA_OFFSET_VERTICAL_WORLD_RATIO = 1.2;

export const CAMERA_WHEEL_ZOOM_STEP = 0.08;

export type CameraEdgeName = "east" | "north" | "south" | "west";

export type CameraEdgeState = Record<CameraEdgeName, boolean>;

export type CameraGestureState = {
  downScreen: Point;
  dragging: boolean;
  originOffset: Point;
  pointerId: number;
};

export type CameraPanResult = {
  blockedEdges: CameraEdgeState;
  didMove: boolean;
};

export type CameraSafeFrame = SceneViewport;

export type RuntimeCameraState = {
  cameraGesture: CameraGestureState | null;
  cameraOffset: Point;
  cameraZoomFactor: number;
  indices: {
    activeSpace?: MapSize | null;
    visualScene: VisualScene | null;
  };
  lastCameraInteractionAt: number;
  snapshot: {
    game: {
      map: MapSize;
      rowanAutonomy?: {
        autoContinue?: boolean;
      };
    } | null;
    rowanAutoplayEnabled?: boolean;
    viewport: ViewportSize;
  };
};

export function updateCamera(
  camera: PhaserType.Cameras.Scene2D.Camera,
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  playerPixel: Point,
  world: MapSize,
  now: number,
  safeFrame: CameraSafeFrame | null = null,
  compositionBounds: CameraWorldBounds | null = null,
) {
  relaxCameraOffset(runtimeState, viewport, now);
  const blockedEdges = createEmptyCameraEdgeState();
  const targetZoom = getTargetSceneZoom(runtimeState, viewport, world);
  camera.setZoom(
    camera.zoom + (targetZoom - camera.zoom) * CAMERA_USER_ZOOM_LERP,
  );
  const effectiveZoom = Math.max(camera.zoom, 0.001);
  const visibleWidth = viewport.width / effectiveZoom;
  const visibleHeight = viewport.height / effectiveZoom;
  const isWatchingRowan = Boolean(
    runtimeState.snapshot.rowanAutoplayEnabled &&
      runtimeState.snapshot.game?.rowanAutonomy?.autoContinue,
  );
  const anchorYRatio = getRuntimeCameraAnchorYRatio(runtimeState);
  const anchorX =
    visibleWidth * getRuntimeCameraAnchorXRatio(runtimeState) +
    runtimeState.cameraOffset.x / effectiveZoom;
  const anchorY =
    visibleHeight * anchorYRatio + runtimeState.cameraOffset.y / effectiveZoom;
  const deadzoneWidth =
    clamp(
      viewport.width * (isWatchingRowan ? 0.08 : 0.12),
      CELL * (isWatchingRowan ? 1.2 : 1.6),
      CELL * (isWatchingRowan ? 2.5 : 3.2),
    ) / effectiveZoom;
  const deadzoneHeight =
    clamp(
      viewport.height * (isWatchingRowan ? 0.06 : 0.085),
      CELL * (isWatchingRowan ? 0.9 : 1.2),
      CELL * (isWatchingRowan ? 1.8 : 2.4),
    ) / effectiveZoom;
  let minScrollX = 0;
  let maxScrollX = Math.max(world.width - visibleWidth, 0);
  let minScrollY = 0;
  let maxScrollY = Math.max(world.height - visibleHeight, 0);
  const resolvedSafeFrame = safeFrame ?? {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  };
  const interiorVisibleFrame = runtimeState.indices.activeSpace
    ? getCameraVisibleWorldFrame(
        resolvedSafeFrame,
        effectiveZoom,
        {
          x: (camera.width - camera.worldView.width) / 2,
          y: (camera.height - camera.worldView.height) / 2,
        },
        {
          x: camera.worldView.width / Math.max(camera.width, 1),
          y: camera.worldView.height / Math.max(camera.height, 1),
        },
      )
    : null;
  if (runtimeState.indices.activeSpace) {
    const range = getInteriorCameraScrollRange({
      compositionBounds,
      focusPoint: playerPixel,
      map: runtimeState.indices.activeSpace,
      visibleFrame: interiorVisibleFrame,
      visibleHeight,
      visibleWidth,
    });
    minScrollX = range.minX;
    maxScrollX = range.maxX;
    minScrollY = range.minY;
    maxScrollY = range.maxY;
  } else if (isCompactViewport(runtimeState.snapshot.viewport)) {
    const range = getCompactCameraScrollRange({
      map: getRuntimeCameraMap(runtimeState),
      visibleHeight,
      visualScene: runtimeState.indices.visualScene,
      visibleWidth,
      world,
    });
    minScrollX = range.minX;
    maxScrollX = range.maxX;
    minScrollY = range.minY;
    maxScrollY = range.maxY;
  }
  const playerViewportX = playerPixel.x - camera.scrollX;
  const playerViewportY = playerPixel.y - camera.scrollY;
  const isInteriorSpace = Boolean(runtimeState.indices.activeSpace);
  const isDragging = runtimeState.cameraGesture?.dragging === true;
  const isExploring =
    isDragging ||
    now - runtimeState.lastCameraInteractionAt < CAMERA_OFFSET_RETURN_DELAY_MS;
  let targetScrollX = camera.scrollX;
  let targetScrollY = camera.scrollY;

  if (isInteriorSpace && !isExploring) {
    if (interiorVisibleFrame) {
      const restingScroll = getInteriorCameraRestingScroll(
        interiorVisibleFrame,
        playerPixel,
        compositionBounds,
      );
      targetScrollX = restingScroll.x;
      targetScrollY = restingScroll.y;
    } else {
      targetScrollX = (minScrollX + maxScrollX) / 2;
      targetScrollY = (minScrollY + maxScrollY) / 2;
    }
  } else if (isInteriorSpace) {
    targetScrollX =
      playerPixel.x -
      (interiorVisibleFrame!.left + interiorVisibleFrame!.right) / 2 -
      runtimeState.cameraOffset.x / effectiveZoom;
    targetScrollY =
      playerPixel.y -
      (interiorVisibleFrame!.top + interiorVisibleFrame!.bottom) / 2 -
      runtimeState.cameraOffset.y / effectiveZoom;
  } else if (isExploring) {
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

  if (isExploring) {
    if (targetScrollX < minScrollX - 0.01) {
      blockedEdges.west = true;
    } else if (targetScrollX > maxScrollX + 0.01) {
      blockedEdges.east = true;
    }

    if (targetScrollY < minScrollY - 0.01) {
      blockedEdges.north = true;
    } else if (targetScrollY > maxScrollY + 0.01) {
      blockedEdges.south = true;
    }
  }

  targetScrollX = clamp(targetScrollX, minScrollX, maxScrollX);
  targetScrollY = clamp(targetScrollY, minScrollY, maxScrollY);

  if (isExploring && hasBlockedCameraEdge(blockedEdges)) {
    runtimeState.cameraOffset = clampCameraOffset(
      runtimeState,
      viewport,
      isInteriorSpace
        ? {
            x:
              (playerPixel.x -
                (interiorVisibleFrame!.left + interiorVisibleFrame!.right) /
                  2 -
                targetScrollX) *
              effectiveZoom,
            y:
              (playerPixel.y -
                (interiorVisibleFrame!.top + interiorVisibleFrame!.bottom) / 2 -
                targetScrollY) *
              effectiveZoom,
          }
        : {
            x:
              (playerPixel.x -
                targetScrollX -
                visibleWidth * getRuntimeCameraAnchorXRatio(runtimeState)) *
              effectiveZoom,
            y:
              (playerPixel.y -
                targetScrollY -
                visibleHeight * anchorYRatio) *
              effectiveZoom,
          },
    );
  }

  const scrollGap = Math.hypot(
    targetScrollX - camera.scrollX,
    targetScrollY - camera.scrollY,
  );
  const snapThreshold = Math.max(visibleWidth, visibleHeight) * 0.42;
  if (!isExploring && isWatchingRowan && scrollGap > snapThreshold) {
    camera.scrollX = targetScrollX;
    camera.scrollY = targetScrollY;
    return blockedEdges;
  }

  const followLerp = isDragging
    ? 1
    : isInteriorSpace && !isExploring
      ? 1
    : isExploring
      ? CAMERA_RECENT_INTERACTION_LERP
      : isWatchingRowan
        ? 0.13
        : PLAYER_CAMERA_LERP;
  camera.scrollX += (targetScrollX - camera.scrollX) * followLerp;
  camera.scrollY += (targetScrollY - camera.scrollY) * followLerp;
  camera.scrollX = clamp(camera.scrollX, minScrollX, maxScrollX);
  camera.scrollY = clamp(camera.scrollY, minScrollY, maxScrollY);
  return blockedEdges;
}

export function getRuntimeCameraAnchorYRatio(
  runtimeState: RuntimeCameraState,
) {
  const isWatchingRowan = Boolean(
    runtimeState.snapshot.rowanAutoplayEnabled &&
      runtimeState.snapshot.game?.rowanAutonomy?.autoContinue,
  );
  if (isCompactPortraitViewport(runtimeState.snapshot.viewport)) {
    return isWatchingRowan
      ? COMPACT_CAMERA_ANCHOR_Y_WATCH_RATIO
      : COMPACT_CAMERA_ANCHOR_Y_INTERACTIVE_RATIO;
  }

  return isWatchingRowan ? 0.46 : 0.42;
}

export function getRuntimeCameraAnchorXRatio(
  runtimeState: RuntimeCameraState,
) {
  const isWatchingRowan = Boolean(
    runtimeState.snapshot.rowanAutoplayEnabled &&
      runtimeState.snapshot.game?.rowanAutonomy?.autoContinue,
  );
  if (isCompactPortraitViewport(runtimeState.snapshot.viewport)) {
    return isWatchingRowan ? 0.62 : 0.56;
  }

  return 0.5;
}

export function beginCameraGesture(
  runtimeState: RuntimeCameraState,
  pointer: PhaserType.Input.Pointer,
  sceneViewport: SceneViewport,
  now = getRuntimeNow(),
  gestureViewport = sceneViewport,
) {
  if (!runtimeState.snapshot.game) {
    return;
  }

  if (!isPointerWithinSceneViewport(pointer, gestureViewport)) {
    return;
  }

  runtimeState.cameraGesture = {
    downScreen: { x: pointer.x, y: pointer.y },
    dragging: false,
    originOffset: runtimeState.cameraOffset,
    pointerId: pointer.id,
  };
  runtimeState.lastCameraInteractionAt = now;
}

export function updateCameraGesture(
  runtimeState: RuntimeCameraState,
  pointer: PhaserType.Input.Pointer,
  sceneViewport: SceneViewport,
  now = getRuntimeNow(),
  gestureViewport = sceneViewport,
) {
  const gesture = runtimeState.cameraGesture;
  if (!gesture || gesture.pointerId !== pointer.id) {
    return createEmptyCameraPanResult();
  }

  if (!pointer.isDown) {
    runtimeState.cameraGesture = null;
    runtimeState.lastCameraInteractionAt = now;
    return createEmptyCameraPanResult();
  }

  if (
    !gesture.dragging &&
    !isPointerWithinSceneViewport(pointer, gestureViewport)
  ) {
    return createEmptyCameraPanResult();
  }

  const deltaX = pointer.x - gesture.downScreen.x;
  const deltaY = pointer.y - gesture.downScreen.y;

  if (
    !gesture.dragging &&
    Math.hypot(deltaX, deltaY) < CAMERA_DRAG_START_DISTANCE_PX
  ) {
    return createEmptyCameraPanResult();
  }

  gesture.dragging = true;
  const verticalPanMultiplier = isCompactPortraitViewport(
    runtimeState.snapshot.viewport,
  )
    ? CAMERA_DRAG_PAN_COMPACT_VERTICAL_MULTIPLIER
    : CAMERA_DRAG_PAN_MULTIPLIER;
  return applyCameraOffset(
    runtimeState,
    sceneViewport,
    {
      x: gesture.originOffset.x + deltaX * CAMERA_DRAG_PAN_MULTIPLIER,
      y: gesture.originOffset.y + deltaY * verticalPanMultiplier,
    },
    now,
  );
}

export function finishCameraGesture(
  runtimeState: RuntimeCameraState,
  pointer: PhaserType.Input.Pointer,
  now = getRuntimeNow(),
) {
  const gesture = runtimeState.cameraGesture;
  if (!gesture || gesture.pointerId !== pointer.id) {
    return { wasTap: false };
  }

  runtimeState.cameraGesture = null;
  runtimeState.lastCameraInteractionAt = now;

  return {
    wasTap: !gesture.dragging,
  };
}

export function isPointerWithinSceneViewport(
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

export function adjustCameraZoom(
  runtimeState: RuntimeCameraState,
  delta: number,
  now = getRuntimeNow(),
) {
  runtimeState.cameraZoomFactor = clampCameraZoomFactor(
    Number((runtimeState.cameraZoomFactor + delta).toFixed(2)),
    runtimeState.snapshot.viewport,
  );
  runtimeState.lastCameraInteractionAt = now;
}

export function adjustCameraPan(
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  delta: Point,
  now = getRuntimeNow(),
) {
  if (!runtimeState.snapshot.game) {
    return createEmptyCameraPanResult();
  }

  const deltaX = Number.isFinite(delta.x) ? delta.x : 0;
  const deltaY = Number.isFinite(delta.y) ? delta.y : 0;
  if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) {
    return createEmptyCameraPanResult();
  }

  return applyCameraOffset(
    runtimeState,
    viewport,
    {
      x: runtimeState.cameraOffset.x - deltaX,
      y: runtimeState.cameraOffset.y - deltaY,
    },
    now,
  );
}

export function getTargetSceneZoom(
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  world: MapSize,
) {
  normalizeCameraZoomFactor(runtimeState);
  return (
    getSceneZoom(viewport, world, runtimeState.snapshot.viewport) *
    runtimeState.cameraZoomFactor
  );
}

export function getInteriorCameraScrollRange({
  compositionBounds,
  focusPoint,
  map,
  visibleFrame,
  visibleHeight,
  visibleWidth,
}: {
  compositionBounds?: CameraWorldBounds | null;
  focusPoint?: Point | null;
  map: MapSize;
  visibleFrame?: CameraVisibleWorldFrame | null;
  visibleHeight: number;
  visibleWidth: number;
}) {
  const origin = getMapWorldOrigin();
  const frame = visibleFrame ?? {
    bottom: visibleHeight,
    left: 0,
    right: visibleWidth,
    top: 0,
  };
  const contentLeft = Math.min(
    origin.x,
    compositionBounds?.left ?? origin.x,
  );
  const contentRight = Math.max(
    origin.x + map.width * CELL,
    compositionBounds
      ? compositionBounds.right + INTERIOR_COMPOSITION_CLEARANCE
      : origin.x,
  );
  const contentTop = Math.min(
    origin.y,
    compositionBounds?.top ?? origin.y,
  );
  const contentBottom = Math.max(
    origin.y + map.height * CELL,
    compositionBounds
      ? compositionBounds.bottom + INTERIOR_COMPOSITION_CLEARANCE
      : origin.y,
  );
  const horizontal = getInteriorAxisScrollRange(
    contentLeft,
    contentRight - contentLeft,
    frame.left,
    frame.right,
  );
  const vertical = getInteriorAxisScrollRange(
    contentTop,
    contentBottom - contentTop,
    frame.top,
    frame.bottom,
  );
  if (focusPoint) {
    const restingScroll = getInteriorCameraRestingScroll(
      frame,
      focusPoint,
      compositionBounds,
    );
    horizontal.min = Math.min(horizontal.min, restingScroll.x);
    horizontal.max = Math.max(horizontal.max, restingScroll.x);
    vertical.min = Math.min(vertical.min, restingScroll.y);
    vertical.max = Math.max(vertical.max, restingScroll.y);
  }

  return {
    maxX: horizontal.max,
    maxY: vertical.max,
    minX: horizontal.min,
    minY: vertical.min,
  };
}

function getInteriorAxisScrollRange(
  contentStart: number,
  contentSize: number,
  frameStart: number,
  frameEnd: number,
) {
  const frameSize = frameEnd - frameStart;
  if (frameSize >= contentSize) {
    const centeredScroll =
      contentStart + contentSize / 2 - (frameStart + frameEnd) / 2;
    return { max: centeredScroll, min: centeredScroll };
  }

  return {
    max: contentStart + contentSize - frameEnd,
    min: contentStart - frameStart,
  };
}

export type CameraVisibleWorldFrame = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type CameraWorldBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function getInteriorCameraRestingScroll(
  frame: CameraVisibleWorldFrame,
  focusPoint: Point,
  compositionBounds: CameraWorldBounds | null = null,
) {
  const horizontalFocus = compositionBounds
    ? (Math.min(focusPoint.x, compositionBounds.left) +
        Math.max(focusPoint.x, compositionBounds.right)) /
      2
    : focusPoint.x;
  const frameHeight = frame.bottom - frame.top;
  const preferredScrollY =
    focusPoint.y - (frame.top + frameHeight * 0.72);
  let restingScrollY = preferredScrollY;
  if (compositionBounds) {
    const contentTop = Math.min(focusPoint.y, compositionBounds.top);
    const contentBottom = Math.max(focusPoint.y, compositionBounds.bottom);
    const minScrollY =
      contentBottom - (frame.bottom - frameHeight * 0.1);
    const maxScrollY = contentTop - (frame.top + frameHeight * 0.01);
    restingScrollY =
      minScrollY <= maxScrollY
        ? clamp(preferredScrollY, minScrollY, maxScrollY)
        : (contentTop + contentBottom - frame.top - frame.bottom) / 2;
  }

  return {
    x: horizontalFocus - (frame.left + frame.right) / 2,
    y: restingScrollY,
  };
}

export function getCameraVisibleWorldFrame(
  safeFrame: CameraSafeFrame,
  zoom: number,
  worldViewOffset: Point = { x: 0, y: 0 },
  worldUnitsPerPixel: Point | null = null,
): CameraVisibleWorldFrame {
  const effectiveZoom = Math.max(zoom, 0.001);
  const scale = worldUnitsPerPixel ?? {
    x: 1 / effectiveZoom,
    y: 1 / effectiveZoom,
  };
  return {
    bottom:
      worldViewOffset.y +
      (safeFrame.y + safeFrame.height) * scale.y,
    left: worldViewOffset.x + safeFrame.x * scale.x,
    right:
      worldViewOffset.x +
      (safeFrame.x + safeFrame.width) * scale.x,
    top: worldViewOffset.y + safeFrame.y * scale.y,
  };
}

function relaxCameraOffset(
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  now: number,
) {
  runtimeState.cameraOffset = clampCameraOffset(
    runtimeState,
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

function applyCameraOffset(
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  attemptedOffset: Point,
  now: number,
): CameraPanResult {
  const previousOffset = runtimeState.cameraOffset;
  const clampedOffset = clampCameraOffset(
    runtimeState,
    viewport,
    attemptedOffset,
  );
  const blockedEdges = createEmptyCameraEdgeState();

  if (attemptedOffset.x < clampedOffset.x - 0.01) {
    blockedEdges.east = true;
  } else if (attemptedOffset.x > clampedOffset.x + 0.01) {
    blockedEdges.west = true;
  }

  if (attemptedOffset.y < clampedOffset.y - 0.01) {
    blockedEdges.south = true;
  } else if (attemptedOffset.y > clampedOffset.y + 0.01) {
    blockedEdges.north = true;
  }

  runtimeState.cameraOffset = clampedOffset;
  runtimeState.lastCameraInteractionAt = now;

  return {
    blockedEdges,
    didMove:
      Math.abs(previousOffset.x - clampedOffset.x) > 0.01 ||
      Math.abs(previousOffset.y - clampedOffset.y) > 0.01,
  };
}

function createEmptyCameraPanResult(): CameraPanResult {
  return {
    blockedEdges: createEmptyCameraEdgeState(),
    didMove: false,
  };
}

function createEmptyCameraEdgeState(): CameraEdgeState {
  return {
    east: false,
    north: false,
    south: false,
    west: false,
  };
}

function hasBlockedCameraEdge(edges: CameraEdgeState) {
  return edges.east || edges.north || edges.south || edges.west;
}

function clampCameraOffset(
  runtimeState: RuntimeCameraState,
  viewport: SceneViewport,
  offset: Point,
) {
  const world = getWorldBoundsForRuntime({
    map: getRuntimeCameraMap(runtimeState),
    viewport,
    visualScene: runtimeState.indices.visualScene,
  });
  const targetZoom = getTargetSceneZoom(runtimeState, viewport, world);
  // cameraOffset is in rendered pixels. World-sized caps must scale with zoom
  // on high-DPR canvases or north/west panning caps out before the edge.
  const worldToRenderedPixels = Math.max(targetZoom, 1);
  const maxX = Math.max(
    clamp(viewport.width * 0.32, CELL * 2.8, CELL * 8.6),
    world.width * 0.82 * worldToRenderedPixels,
  );
  const maxY = Math.max(
    clamp(viewport.height * 0.26, CELL * 2.2, CELL * 6.4),
    world.height *
      (isCompactViewport(runtimeState.snapshot.viewport)
        ? COMPACT_CAMERA_OFFSET_VERTICAL_WORLD_RATIO
        : CAMERA_OFFSET_VERTICAL_WORLD_RATIO) *
      worldToRenderedPixels,
  );
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function getRuntimeCameraMap(runtimeState: RuntimeCameraState) {
  return runtimeState.indices.activeSpace ?? runtimeState.snapshot.game?.map;
}

function normalizeCameraZoomFactor(runtimeState: RuntimeCameraState) {
  runtimeState.cameraZoomFactor = clampCameraZoomFactor(
    runtimeState.cameraZoomFactor,
    runtimeState.snapshot.viewport,
  );
}

function getRuntimeNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
