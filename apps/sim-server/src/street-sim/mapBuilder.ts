import type { CityMap, MapLabel, MapTile, TileKind } from "./types.js";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaintOptions {
  walkable?: boolean;
  locationId?: string;
  district?: string;
}

export function createCityMap(
  width: number,
  height: number,
  fillKind: TileKind,
  walkable = false,
): CityMap {
  const tiles: MapTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        x,
        y,
        kind: fillKind,
        walkable,
      });
    }
  }

  return {
    width,
    height,
    tiles,
    labels: [],
    footprints: [],
    doors: [],
    props: [],
  };
}

export function paintRect(
  map: CityMap,
  rect: Rect,
  kind: TileKind,
  options: PaintOptions = {},
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      paintTile(map, x, y, kind, options);
    }
  }
}

export function paintTiles(
  map: CityMap,
  points: Array<{ x: number; y: number }>,
  kind: TileKind,
  options: PaintOptions = {},
): void {
  for (const point of points) {
    paintTile(map, point.x, point.y, kind, options);
  }
}

export function addLabel(map: CityMap, label: MapLabel): void {
  map.labels.push(label);
}

function paintTile(
  map: CityMap,
  x: number,
  y: number,
  kind: TileKind,
  options: PaintOptions,
): void {
  const tile = map.tiles.find((entry) => entry.x === x && entry.y === y);
  if (!tile) {
    return;
  }

  tile.kind = kind;
  tile.walkable = options.walkable ?? tile.walkable;
  tile.locationId = options.locationId;
  tile.district = options.district;
}
