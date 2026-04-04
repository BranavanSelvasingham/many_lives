import type { VisualRect } from "./visualScenes";

export const SKY_LAYER_MAX_TOP_RATIO = 0.18;

export function clampSkyLayerTop(sceneHeight: number, y: number) {
  const topLimit = Math.max(0, Math.round(sceneHeight * SKY_LAYER_MAX_TOP_RATIO));
  return Math.max(0, Math.min(Math.round(y), topLimit));
}

export function getNormalizedSkyLayerRect(
  sceneHeight: number,
  rect: VisualRect,
): VisualRect {
  return {
    ...rect,
    y: clampSkyLayerTop(sceneHeight, rect.y),
  };
}

export function getSkyLayerPhaseOffset(
  layerX: number,
  sceneWidth: number,
  travelSpan: number,
) {
  if (travelSpan <= 0) {
    return 0;
  }

  const normalizedX = ((layerX / Math.max(sceneWidth, 1)) * travelSpan) % travelSpan;
  return (normalizedX + travelSpan) % travelSpan;
}
