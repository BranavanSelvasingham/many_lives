export const CAMERA_USER_ZOOM_DEFAULT = 1;
export const CAMERA_USER_ZOOM_MAX = 1.16;
export const CAMERA_USER_ZOOM_MIN = 0.76;

const COMPACT_LAYOUT_MAX_WIDTH = 960;
const PHONE_RAIL_MAX_WIDTH = 560;
const COMPACT_PORTRAIT_COVER_ZOOM_BOOST = 1.12;
const MAX_RUNTIME_RENDER_SCALE = 6;
const RUNTIME_RENDER_CLARITY_BOOST = 1.35;

export type ViewportSize = {
  height: number;
  width: number;
};

export type SceneViewport = ViewportSize & {
  x: number;
  y: number;
};

export type OverlayLayoutMetrics = {
  dockFocusWidth: number;
  dockWidth: number;
  focusHeight: number;
  focusWidth: number;
  overlayInset: number;
  railMaxHeight: number;
  railWidth: number;
  sceneGap: number;
};

export function getOverlayLayoutMetrics(
  viewport: ViewportSize,
): OverlayLayoutMetrics {
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

export function isCollapsibleRailViewport(viewport: ViewportSize) {
  return viewport.width <= 960;
}

export function isPhoneRailViewport(viewport: ViewportSize) {
  return viewport.width <= PHONE_RAIL_MAX_WIDTH;
}

export function isCompactViewport(viewport: ViewportSize) {
  return viewport.width <= COMPACT_LAYOUT_MAX_WIDTH;
}

export function isCompactPortraitViewport(viewport: ViewportSize) {
  return isCompactViewport(viewport) && viewport.height > viewport.width;
}

export function getSceneViewport(
  viewport: ViewportSize,
  _world: { height: number; width: number },
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
    getOverlayLayoutMetrics(layoutViewport);
  const scaleX = viewport.width / Math.max(layoutViewport.width, 1);
  const scaleY = viewport.height / Math.max(layoutViewport.height, 1);
  const frameX = 0;
  const frameY = overlayInset * scaleY;
  const frameWidth = Math.max(
    (layoutViewport.width - railWidth - sceneGap - overlayInset) * scaleX,
    1,
  );
  const frameHeight = Math.max(
    (layoutViewport.height - overlayInset * 2) * scaleY,
    1,
  );

  return {
    height: frameHeight,
    width: frameWidth,
    x: frameX,
    y: frameY,
  };
}

export function getSceneZoom(
  viewport: SceneViewport,
  world: { height: number; width: number },
  layoutViewport: ViewportSize = viewport,
) {
  const widthFit = viewport.width / Math.max(world.width, 1);
  const heightFit = viewport.height / Math.max(world.height, 1);
  if (isCompactPortraitViewport(layoutViewport)) {
    return heightFit * COMPACT_PORTRAIT_COVER_ZOOM_BOOST;
  }
  if (!isCompactViewport(layoutViewport)) {
    return Math.max(widthFit, heightFit);
  }
  return Math.min(widthFit, heightFit);
}

export function getRuntimeRenderScale(
  cameraZoomFactor = CAMERA_USER_ZOOM_DEFAULT,
) {
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

export function getScaledViewportSize(
  viewport: ViewportSize,
  renderScale: number,
): ViewportSize {
  return {
    height: Math.max(Math.round(viewport.height * renderScale), 1),
    width: Math.max(Math.round(viewport.width * renderScale), 1),
  };
}

export function getCameraZoomRange(viewport: ViewportSize) {
  return {
    max: CAMERA_USER_ZOOM_MAX,
    min: isCompactViewport(viewport)
      ? CAMERA_USER_ZOOM_DEFAULT
      : CAMERA_USER_ZOOM_MIN,
  };
}

export function clampCameraZoomFactor(
  zoomFactor: number,
  viewport: ViewportSize,
) {
  const range = getCameraZoomRange(viewport);
  return clamp(zoomFactor, range.min, range.max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
