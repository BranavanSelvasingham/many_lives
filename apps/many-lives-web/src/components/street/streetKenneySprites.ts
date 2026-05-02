import type PhaserType from "phaser";

import { sampleTileNoise } from "@/components/street/streetTiles";
import {
  CELL,
  KENNEY_SCALE,
  mapTileToWorldOrigin,
} from "@/lib/street/runtimeGeometry";
import type { MapProp, MapTile } from "@/lib/street/types";

export const KENNEY_MODERN_CITY_KEY = "kenney-modern-city";

const KENNEY_GRASS = [925, 926, 927, 962, 963, 964, 999, 1000, 1001];
const KENNEY_TREE_FRAMES = [401, 402, 403, 404, 405];

export function drawKenneyTerrainSprites(
  scene: PhaserType.Scene,
  tiles: MapTile[],
) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const tile of tiles) {
    const frame = kenneyGroundFrameForTile(tile);
    if (frame === null) {
      continue;
    }

    const { x, y } = mapTileToWorldOrigin(tile.x, tile.y);
    nodes.push(
      scene.add
        .image(x, y, KENNEY_MODERN_CITY_KEY, frame)
        .setOrigin(0)
        .setScale(KENNEY_SCALE)
        .setDepth(14),
    );
  }

  return nodes;
}

function kenneyGroundFrameForTile(tile: MapTile) {
  const noise = sampleTileNoise(tile.x, tile.y, 331);

  switch (tile.kind) {
    case "garden":
      return pickKenneyFrame(KENNEY_GRASS, noise);
    default:
      return null;
  }
}

export function drawKenneyPropSprites(
  scene: PhaserType.Scene,
  props: MapProp[],
) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const prop of props) {
    if (prop.kind !== "tree") {
      continue;
    }

    const frame = pickKenneyFrame(
      KENNEY_TREE_FRAMES,
      sampleTileNoise(prop.x, prop.y, 719),
    );
    const { x, y } = mapTileToWorldOrigin(prop.x, prop.y);
    nodes.push(
      scene.add
        .image(x - 6, y - CELL * 0.85, KENNEY_MODERN_CITY_KEY, frame)
        .setOrigin(0)
        .setScale(KENNEY_SCALE)
        .setDepth(26),
    );
  }

  return nodes;
}

function pickKenneyFrame(frames: number[], noise: number) {
  const index = Math.max(
    0,
    Math.min(frames.length - 1, Math.floor(noise * frames.length)),
  );
  return frames[index] ?? frames[0]!;
}
