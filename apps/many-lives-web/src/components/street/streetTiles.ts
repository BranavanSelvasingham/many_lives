import type PhaserType from "phaser";

import {
  CELL,
  VISUAL_MARGIN_TILES,
  getExtendedGridSize,
  mapTileToWorldOrigin,
  worldGridToWorldOrigin,
} from "@/lib/street/runtimeGeometry";
import { blendColor } from "@/lib/street/renderColor";
import type { CityMap, MapTile, TileKind } from "@/lib/street/types";

const TILE_NOISE_SCALE = 0.42;

const TILE_COLORS: Record<TileKind, number> = {
  courtyard: 0xc4b595,
  dock: 0x8b6848,
  garden: 0x52784f,
  lane: 0xc7b9a1,
  plaza: 0xd8cbb2,
  roof: 0x2f3b42,
  stoop: 0xb8ab91,
  water: 0x2f6d83,
  workyard: 0xa89276,
};

export function drawTiles(
  layer: PhaserType.GameObjects.Graphics,
  tiles: MapTile[],
) {
  const tileLookup = createTileLookup(tiles);
  for (const tile of tiles) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(tile.x, tile.y);
    drawTileCell(
      layer,
      tileLookup,
      tile.x,
      tile.y,
      worldX,
      worldY,
      tile.kind,
      tile.walkable,
    );
  }
}

export function collectAnimatedSurfaceTiles(
  map: CityMap,
): Array<Pick<MapTile, "kind" | "x" | "y">> {
  const animatedTiles = map.tiles
    .filter((tile) => tile.kind === "water" || tile.kind === "dock")
    .map((tile) => ({ kind: tile.kind, x: tile.x, y: tile.y }));
  const extendedGrid = getExtendedGridSize(map);
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const fringeTile = fringeTileForCoordinate(column, row, map);
      if (
        !fringeTile ||
        (fringeTile.kind !== "water" && fringeTile.kind !== "dock")
      ) {
        continue;
      }

      animatedTiles.push({
        kind: fringeTile.kind,
        x: column - mapLeft,
        y: row - mapTop,
      });
    }
  }

  return animatedTiles;
}

export function drawFringeTiles(
  layer: PhaserType.GameObjects.Graphics,
  map: CityMap,
) {
  const extendedGrid = getExtendedGridSize(map);
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;
  const extendedLookup = createExtendedTileLookup(map);

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const tile = fringeTileForCoordinate(column, row, map);
      if (!tile) {
        continue;
      }

      const { x: worldX, y: worldY } = worldGridToWorldOrigin(column, row);
      drawTileCell(
        layer,
        extendedLookup,
        column,
        row,
        worldX,
        worldY,
        tile.kind,
        tile.walkable,
        tile.alpha,
      );
    }
  }
}

function createTileLookup(tiles: MapTile[]) {
  const lookup = new Map<string, MapTile>();

  for (const tile of tiles) {
    lookup.set(`${tile.x},${tile.y}`, tile);
  }

  return lookup;
}

function isMatchingSurface(
  tileLookup: Map<string, MapTile>,
  x: number,
  y: number,
  kind: TileKind,
) {
  return tileLookup.get(`${x},${y}`)?.kind === kind;
}

function getTileSurfaceEdges(
  tileLookup: Map<string, MapTile>,
  x: number,
  y: number,
  kind: TileKind,
) {
  return {
    east: isMatchingSurface(tileLookup, x + 1, y, kind),
    north: isMatchingSurface(tileLookup, x, y - 1, kind),
    south: isMatchingSurface(tileLookup, x, y + 1, kind),
    west: isMatchingSurface(tileLookup, x - 1, y, kind),
  };
}

function createExtendedTileLookup(map: CityMap) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const lookup = new Map<string, MapTile>();

  for (const tile of map.tiles) {
    lookup.set(`${tile.x + mapLeft},${tile.y + mapTop}`, tile);
  }

  const extendedGrid = getExtendedGridSize(map);
  const mapRight = mapLeft + map.width;
  const mapBottom = mapTop + map.height;

  for (let row = 0; row < extendedGrid.height; row += 1) {
    for (let column = 0; column < extendedGrid.width; column += 1) {
      const insideActualMap =
        column >= mapLeft &&
        column < mapRight &&
        row >= mapTop &&
        row < mapBottom;

      if (insideActualMap) {
        continue;
      }

      const tile = fringeTileForCoordinate(column, row, map);
      if (!tile) {
        continue;
      }

      lookup.set(`${column},${row}`, {
        kind: tile.kind,
        walkable: tile.walkable,
        x: column,
        y: row,
      } as MapTile);
    }
  }

  return lookup;
}

function fringeTileForCoordinate(
  column: number,
  row: number,
  map: CityMap,
): { alpha: number; kind: TileKind; walkable: boolean } | null {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width - 1;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height - 1;
  const projectedX = clamp(column - mapLeft, 0, map.width - 1);
  const projectedY = clamp(row - mapTop, 0, map.height - 1);
  const baseTile = getMapTile(map, projectedX, projectedY);

  if (!baseTile) {
    return null;
  }

  const horizontalDistance =
    column < mapLeft
      ? mapLeft - column
      : column > mapRight
        ? column - mapRight
        : 0;
  const verticalDistance =
    row < mapTop ? mapTop - row : row > mapBottom ? row - mapBottom : 0;
  const edgeDistance = Math.max(horizontalDistance, verticalDistance);
  const alpha = clamp(0.92 - edgeDistance * 0.055, 0.56, 0.9);
  const projectedKind = projectFringeTileKind(
    baseTile.kind,
    horizontalDistance,
    verticalDistance,
    column < mapLeft
      ? "west"
      : column > mapRight
        ? "east"
        : row < mapTop
          ? "north"
          : "south",
  );

  return {
    alpha,
    kind: projectedKind.kind,
    walkable: projectedKind.walkable,
  };
}

function getMapTile(map: CityMap, x: number, y: number) {
  const direct = map.tiles[y * map.width + x];
  if (direct && direct.x === x && direct.y === y) {
    return direct;
  }

  return map.tiles.find((tile) => tile.x === x && tile.y === y);
}

function projectFringeTileKind(
  baseKind: TileKind,
  horizontalDistance: number,
  verticalDistance: number,
  edge: "east" | "north" | "south" | "west",
): { kind: TileKind; walkable: boolean } {
  const distance = Math.max(horizontalDistance, verticalDistance);

  switch (baseKind) {
    case "stoop":
      return {
        kind: distance <= 2 && edge === "north" ? "lane" : "roof",
        walkable: distance <= 2 && edge === "north",
      };
    case "plaza":
      return {
        kind: distance <= 2 ? "plaza" : "lane",
        walkable: true,
      };
    case "workyard":
      return {
        kind: edge === "south" && distance >= 3 ? "dock" : "workyard",
        walkable: true,
      };
    case "courtyard":
      return {
        kind: distance >= 4 ? "garden" : "courtyard",
        walkable: distance < 4,
      };
    case "dock":
      return {
        kind: distance >= 2 ? "water" : "dock",
        walkable: distance < 2,
      };
    case "garden":
      return {
        kind: verticalDistance >= 2 ? "water" : "garden",
        walkable: false,
      };
    case "lane":
      return {
        kind: "lane",
        walkable: true,
      };
    case "roof":
      return {
        kind: "roof",
        walkable: false,
      };
    case "water":
      return {
        kind: "water",
        walkable: false,
      };
    default:
      return {
        kind: "lane",
        walkable: true,
      };
  }
}

export function drawTileCell(
  layer: PhaserType.GameObjects.Graphics,
  tileLookup: Map<string, MapTile>,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  kind: TileKind,
  walkable: boolean,
  alpha = 1,
) {
  const edges = getTileSurfaceEdges(tileLookup, gridX, gridY, kind);
  const fillColor = walkable
    ? blendColor(TILE_COLORS[kind], 0x0d1418, kind === "water" ? 0.08 : 0.03)
    : blendColor(TILE_COLORS[kind], 0x101619, 0.58);
  const leftBleed = edges.west ? 1.5 : 0;
  const rightBleed = edges.east ? 1.5 : 0;
  const topBleed = edges.north ? 1.5 : 0;
  const bottomBleed = edges.south ? 1.5 : 0;
  const surfaceX = worldX - leftBleed;
  const surfaceY = worldY - topBleed;
  const surfaceWidth = CELL + leftBleed + rightBleed;
  const surfaceHeight = CELL + topBleed + bottomBleed;
  const isolated = !edges.north && !edges.south && !edges.east && !edges.west;
  const baseAlpha = (walkable ? 1 : 0.82) * alpha;

  layer.fillStyle(fillColor, baseAlpha);
  if (isolated) {
    layer.fillRoundedRect(
      surfaceX + 1,
      surfaceY + 1,
      surfaceWidth - 2,
      surfaceHeight - 2,
      9,
    );
  } else {
    layer.fillRect(surfaceX, surfaceY, surfaceWidth, surfaceHeight);
  }
  drawSurfacePatina(
    layer,
    gridX,
    gridY,
    surfaceX,
    surfaceY,
    surfaceWidth,
    surfaceHeight,
    kind,
    alpha,
  );
  drawTileSurfaceDetail(layer, gridX, gridY, worldX, worldY, kind, alpha);

  drawSurfaceEdge(
    layer,
    surfaceX,
    surfaceY,
    surfaceWidth,
    surfaceHeight,
    edges,
    kind,
    alpha,
  );

  if (!walkable) {
    layer.lineStyle(2, 0x12181c, 0.42 * alpha);
    layer.lineBetween(
      worldX + 8,
      worldY + 8,
      worldX + CELL - 8,
      worldY + CELL - 8,
    );
  }
}

function drawSurfacePatina(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  surfaceX: number,
  surfaceY: number,
  width: number,
  height: number,
  kind: TileKind,
  alpha: number,
) {
  const patchColor = blendColor(
    TILE_COLORS[kind],
    0xf0e2c4,
    kind === "water" ? 0.2 : 0.12,
  );
  const shadowColor = blendColor(TILE_COLORS[kind], 0x0a1116, 0.22);
  const patchCount =
    kind === "lane" || kind === "plaza" ? 1 : kind === "water" ? 1 : 2;

  for (let index = 0; index < patchCount; index += 1) {
    const offsetSeed = sampleTileNoise(
      gridX + index * 2,
      gridY + index,
      121 + index * 19,
    );
    const patchX = surfaceX + 6 + offsetSeed * Math.max(width - 16, 8);
    const patchY =
      surfaceY +
      7 +
      sampleTileNoise(gridX, gridY + index * 3, 141 + index * 13) *
        Math.max(height - 18, 8);
    const patchWidth =
      kind === "water"
        ? 10 + sampleTileNoise(gridX + index, gridY, 161 + index * 11) * 12
        : 5 + sampleTileNoise(gridX + index, gridY, 161 + index * 11) * 10;
    const patchHeight =
      kind === "water"
        ? 2 + sampleTileNoise(gridX, gridY + index, 181 + index * 5) * 2.5
        : 2 + sampleTileNoise(gridX, gridY + index, 181 + index * 5) * 4;

    layer.fillStyle(
      index % 3 === 0 ? patchColor : shadowColor,
      (kind === "water"
        ? 0.02
        : kind === "lane" || kind === "plaza"
          ? 0.012
          : 0.022) * alpha,
    );
    layer.fillEllipse(patchX, patchY, patchWidth, patchHeight);
  }
}

function drawSurfaceEdge(
  layer: PhaserType.GameObjects.Graphics,
  surfaceX: number,
  surfaceY: number,
  width: number,
  height: number,
  edges: { east: boolean; north: boolean; south: boolean; west: boolean },
  kind: TileKind,
  alpha: number,
) {
  const highlight = blendColor(
    TILE_COLORS[kind],
    0xf2e1bc,
    kind === "water" ? 0.4 : 0.32,
  );
  const shadow = blendColor(TILE_COLORS[kind], 0x091015, 0.46);

  if (!edges.north) {
    layer.fillStyle(highlight, (kind === "water" ? 0.12 : 0.1) * alpha);
    layer.fillRect(surfaceX + 2, surfaceY + 1, Math.max(width - 4, 6), 2.5);
  }

  if (!edges.west) {
    layer.fillStyle(highlight, 0.06 * alpha);
    layer.fillRect(surfaceX + 1, surfaceY + 2, 2, Math.max(height - 4, 6));
  }

  if (!edges.south) {
    layer.fillStyle(shadow, 0.14 * alpha);
    layer.fillRect(
      surfaceX + 2,
      surfaceY + height - 3,
      Math.max(width - 4, 6),
      2.5,
    );
  }

  if (!edges.east) {
    layer.fillStyle(shadow, 0.09 * alpha);
    layer.fillRect(
      surfaceX + width - 3,
      surfaceY + 2,
      2.5,
      Math.max(height - 4, 6),
    );
  }
}

function drawTileSurfaceDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  kind: TileKind,
  alpha: number,
) {
  switch (kind) {
    case "lane":
      drawLaneDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "plaza":
      drawPlazaDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "stoop":
      drawStoopDetail(layer, worldX, worldY, alpha);
      return;
    case "dock":
      drawDockDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "water":
      drawWaterDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "garden":
      drawGardenDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "courtyard":
      drawCourtyardDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "roof":
      drawRoofDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    case "workyard":
      drawWorkyardDetail(layer, gridX, gridY, worldX, worldY, alpha);
      return;
    default:
      return;
  }
}

function drawLaneDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const seam = sampleTileNoise(gridX, gridY, 9);
  const curbHighlight = 0.032 + seam * 0.01;
  const gutterShadow = 0.045 + seam * 0.016;

  layer.fillStyle(0xf3e7cf, curbHighlight * alpha);
  layer.fillRect(worldX + 2, worldY + 3, CELL - 4, 2);
  layer.fillStyle(0x544b3f, gutterShadow * alpha);
  layer.fillRect(worldX + 2, worldY + CELL - 4, CELL - 4, 2);

  layer.lineStyle(1, 0xe0d3ba, (0.06 + seam * 0.02) * alpha);
  layer.lineBetween(worldX + 5, worldY + 13, worldX + CELL - 5, worldY + 13);
  layer.lineBetween(worldX + 5, worldY + 26, worldX + CELL - 5, worldY + 26);
  layer.lineBetween(worldX + 13, worldY + 5, worldX + 13, worldY + CELL - 5);
  layer.lineBetween(worldX + 26, worldY + 5, worldX + 26, worldY + CELL - 5);

  layer.fillStyle(0x9f8a6f, (0.035 + seam * 0.02) * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 8, 9, 5, 2);
  layer.fillRoundedRect(worldX + 22, worldY + 22, 8, 5, 2);
}

function drawPlazaDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const tone = sampleTileNoise(gridX, gridY, 23);
  const inset = 4;

  layer.lineStyle(1.1, 0xf0e3cc, (0.1 + tone * 0.04) * alpha);
  layer.strokeRoundedRect(
    worldX + inset,
    worldY + inset,
    CELL - inset * 2,
    CELL - inset * 2,
    5,
  );
  layer.lineBetween(worldX + 7, worldY + 13, worldX + CELL - 7, worldY + 13);
  layer.lineBetween(worldX + 7, worldY + 27, worldX + CELL - 7, worldY + 27);
  layer.lineBetween(worldX + 13, worldY + 7, worldX + 13, worldY + CELL - 7);
  layer.lineBetween(worldX + 27, worldY + 7, worldX + 27, worldY + CELL - 7);

  layer.fillStyle(
    blendColor(0xc1b092, 0xf0e5cf, 0.24),
    (0.07 + tone * 0.02) * alpha,
  );
  layer.fillRoundedRect(worldX + 15, worldY + 15, 10, 10, 3);
  layer.lineStyle(1, 0xc7b08a, 0.08 * alpha);
  layer.strokeCircle(worldX + CELL / 2, worldY + CELL / 2, 5.2);
}

function drawStoopDetail(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  layer.fillStyle(0xf2e5c8, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 6, worldY + 6, CELL - 12, 6, 3);
  layer.fillStyle(0x201913, 0.12 * alpha);
  layer.fillRoundedRect(worldX + 6, worldY + 16, CELL - 12, 5, 3);
  layer.fillRoundedRect(worldX + 8, worldY + 25, CELL - 16, 4, 3);
}

export function drawDockDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const wear = sampleTileNoise(gridX, gridY, 31);
  layer.lineStyle(2, 0xc89f69, (0.12 + wear * 0.06) * alpha);
  layer.lineBetween(worldX + 4, worldY + 8, worldX + CELL - 5, worldY + 8);
  layer.lineBetween(worldX + 4, worldY + 18, worldX + CELL - 6, worldY + 18);
  layer.lineBetween(worldX + 5, worldY + 28, worldX + CELL - 5, worldY + 28);
  layer.lineStyle(1.2, 0x523824, 0.22 * alpha);
  layer.lineBetween(worldX + 11, worldY + 4, worldX + 11, worldY + CELL - 5);
  layer.lineBetween(worldX + 21, worldY + 4, worldX + 21, worldY + CELL - 5);
  layer.lineBetween(worldX + 31, worldY + 4, worldX + 31, worldY + CELL - 5);
  layer.fillStyle(0x2d241a, 0.22 * alpha);
  layer.fillRect(worldX + 5, worldY + CELL - 8, 4, 6);
  layer.fillRect(worldX + CELL - 9, worldY + CELL - 8, 4, 6);
  layer.fillStyle(0xe3c493, 0.08 * alpha);
  layer.fillEllipse(worldX + 18, worldY + 13, 16, 4);
  layer.lineStyle(1, 0xe6d1b0, 0.12 * alpha);
  layer.strokeCircle(worldX + 18, worldY + 22, 3.5);
  if (wear > 0.62) {
    layer.lineStyle(1.4, 0xd7c2a0, 0.14 * alpha);
    layer.strokeCircle(worldX + 28, worldY + 22, 4);
  }
}

function drawWaterDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const crest = sampleTileNoise(gridX, gridY, 41);
  layer.lineStyle(2, 0x89c5da, (0.13 + crest * 0.07) * alpha);
  layer.lineBetween(worldX + 5, worldY + 10, worldX + CELL - 7, worldY + 8);
  layer.lineBetween(worldX + 9, worldY + 21, worldX + CELL - 4, worldY + 18);
  layer.lineBetween(worldX + 7, worldY + 31, worldX + CELL - 9, worldY + 27);
  layer.lineStyle(1.2, 0xdff4f8, (0.09 + crest * 0.05) * alpha);
  layer.lineBetween(worldX + 4, worldY + 5, worldX + CELL - 8, worldY + 4);
  layer.fillStyle(0xc7e6ef, (0.06 + crest * 0.04) * alpha);
  layer.fillEllipse(worldX + 13, worldY + 27, 7, 3);
  layer.fillEllipse(worldX + 28, worldY + 15, 5, 2.5);
  layer.fillStyle(0x173d4d, 0.08 * alpha);
  layer.fillEllipse(worldX + 22, worldY + 24, 18, 5);
}

function drawGardenDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const bloom = sampleTileNoise(gridX, gridY, 53);
  layer.lineStyle(1.2, 0xa9cf8f, 0.08 * alpha);
  layer.strokeRoundedRect(worldX + 5, worldY + 5, CELL - 10, CELL - 10, 6);
  layer.fillStyle(0x2d4c33, 0.18 * alpha);
  layer.fillCircle(worldX + 11, worldY + 13, 4.4);
  layer.fillCircle(worldX + 26, worldY + 25, 5.4);
  layer.fillCircle(worldX + 21, worldY + 14, 3.8);
  layer.fillStyle(0x365b3d, 0.12 * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 20, 12, 6, 3);
  layer.fillStyle(0x9bc17a, (0.1 + bloom * 0.05) * alpha);
  layer.fillCircle(worldX + 15, worldY + 25, 2.3);
  layer.fillCircle(worldX + 28, worldY + 11, 2);
  layer.fillCircle(worldX + 10, worldY + 28, 1.8);
}

function drawCourtyardDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const scatter = sampleTileNoise(gridX, gridY, 67);
  layer.fillStyle(0x6e725f, (0.12 + scatter * 0.04) * alpha);
  layer.fillRoundedRect(worldX + 8, worldY + 8, 8, 7, 2);
  layer.fillRoundedRect(worldX + 20, worldY + 21, 10, 8, 2);
  layer.fillStyle(0x93a574, 0.08 * alpha);
  layer.fillCircle(worldX + 30, worldY + 11, 2.2);
}

function drawRoofDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const panel = sampleTileNoise(gridX, gridY, 79);
  const warmSlate = blendColor(0x3e4c55, 0x798892, 0.18 + panel * 0.08);
  const seamAlpha = 0.12 + panel * 0.05;
  layer.fillStyle(0xf2e4c8, 0.06 * alpha);
  layer.fillRect(worldX + 4, worldY + 4, CELL - 8, 2.4);
  layer.fillStyle(0x0f171c, 0.16 * alpha);
  layer.fillRect(worldX + 4, worldY + CELL - 6, CELL - 8, 2.8);
  layer.lineStyle(1.1, warmSlate, seamAlpha * alpha);
  layer.lineBetween(worldX + 6, worldY + 10, worldX + CELL - 6, worldY + 10);
  layer.lineBetween(worldX + 6, worldY + 19, worldX + CELL - 6, worldY + 19);
  layer.lineBetween(worldX + 12, worldY + 6, worldX + 12, worldY + CELL - 6);
  layer.lineBetween(worldX + 28, worldY + 6, worldX + 28, worldY + CELL - 6);
  layer.fillStyle(0x56646e, (0.14 + panel * 0.04) * alpha);
  layer.fillRoundedRect(worldX + 23, worldY + 23, 8, 5.5, 2);
  layer.fillStyle(0xe7d8ba, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 25, worldY + 24, 4, 1.5, 1);
}

function drawWorkyardDetail(
  layer: PhaserType.GameObjects.Graphics,
  gridX: number,
  gridY: number,
  worldX: number,
  worldY: number,
  alpha: number,
) {
  const grit = sampleTileNoise(gridX, gridY, 97);
  layer.fillStyle(0x8d785f, (0.12 + grit * 0.04) * alpha);
  layer.fillCircle(worldX + 12, worldY + 12, 2.2);
  layer.fillCircle(worldX + 26, worldY + 24, 2.6);
  layer.lineStyle(1.2, 0x5a4933, 0.14 * alpha);
  layer.lineBetween(worldX + 8, worldY + 30, worldX + CELL - 8, worldY + 26);
  layer.lineBetween(worldX + 10, worldY + 11, worldX + CELL - 10, worldY + 14);
  layer.fillStyle(0x5e4d39, 0.08 * alpha);
  layer.fillRoundedRect(worldX + 7, worldY + 18, 8, 4, 2);
  layer.fillRoundedRect(worldX + 22, worldY + 9, 9, 4, 2);
}

export function sampleTileNoise(x: number, y: number, salt: number) {
  // Use low-frequency coherent noise so neighboring tiles blend instead of flickering as noisy cells.
  const scaledX = x * TILE_NOISE_SCALE + salt * 0.00091;
  const scaledY = y * TILE_NOISE_SCALE + salt * 0.00137;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tX = smoothstepUnit(scaledX - x0);
  const tY = smoothstepUnit(scaledY - y0);
  const n00 = tileNoiseHash(x0, y0, salt);
  const n10 = tileNoiseHash(x1, y0, salt);
  const n01 = tileNoiseHash(x0, y1, salt);
  const n11 = tileNoiseHash(x1, y1, salt);

  return mixScalar(mixScalar(n00, n10, tX), mixScalar(n01, n11, tX), tY);
}

function tileNoiseHash(x: number, y: number, salt: number) {
  const raw = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function mixScalar(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function smoothstepUnit(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
