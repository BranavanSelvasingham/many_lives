import type PhaserType from "phaser";

import { KENNEY_MODERN_CITY_KEY } from "@/components/street/streetKenneySprites";
import { drawDockDetail, sampleTileNoise } from "@/components/street/streetTiles";
import {
  CELL,
  KENNEY_SCALE,
  VISUAL_MARGIN_TILES,
  mapTileToWorldOrigin,
  worldGridToWorldOrigin,
  type MapSize,
} from "@/lib/street/runtimeGeometry";
import { blendColor } from "@/lib/street/renderColor";
import type {
  CityMap,
  MapDoor,
  MapFootprint,
  RoofStyle,
  StreetGameState,
} from "@/lib/street/types";

type ArchitecturalPalette = {
  awning: number;
  base: number;
  outline: number;
  profile:
    | "boarding-house"
    | "freight-yard"
    | "moss-pier"
    | "repair-stall"
    | "rowhouse"
    | "tea-house"
    | "warehouse";
  roof: number;
  roofBand: number;
  shadow: number;
  sign: number;
  trim: number;
  window: number;
};

export function drawFootprints(
  layer: PhaserType.GameObjects.Graphics,
  map: CityMap,
  useKenneyAssets: boolean,
) {
  for (const footprint of map.footprints) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(
      footprint.x,
      footprint.y,
    );
    const width = footprint.width * CELL;
    const height = footprint.height * CELL;

    if (useKenneyAssets) {
      if (footprint.kind === "building") {
        drawKenneyBuildingMass(
          layer,
          map,
          footprint,
          worldX,
          worldY,
          width,
          height,
        );
        continue;
      }

      if (
        footprint.kind === "market" ||
        footprint.kind === "yard" ||
        footprint.kind === "dock"
      ) {
        drawKenneyOpenPlot(layer, footprint, worldX, worldY, width, height);
        continue;
      }
    }

    const palette = drawArchitecturalMass(layer, {
      kind: footprint.kind,
      locationId: footprint.locationId,
      roofStyle: footprint.roofStyle,
      seedX: footprint.x,
      seedY: footprint.y,
      worldX,
      worldY,
      width,
      height,
    });

    if (footprint.kind === "building") {
      drawBuildingDetail(layer, worldX, worldY, width, height, palette);
    } else {
      drawFootprintSurfaceDetail(
        layer,
        footprint.kind,
        worldX,
        worldY,
        width,
        height,
        palette,
      );
    }
  }
}

type FootprintFacing = "east" | "north" | "south" | "west";

function drawKenneyBuildingMass(
  layer: PhaserType.GameObjects.Graphics,
  map: CityMap,
  footprint: MapFootprint,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
) {
  const palette = footprintPalette({
    kind: footprint.kind,
    locationId: footprint.locationId,
    roofStyle: footprint.roofStyle,
    seedX: footprint.x,
    seedY: footprint.y,
  });
  const facing = resolveFootprintFacing(map, footprint);
  const shellX = worldX + 4;
  const shellY = worldY + 4;
  const shellWidth = Math.max(width - 8, 14);
  const shellHeight = Math.max(height - 8, 14);
  const cornerRadius =
    palette.profile === "repair-stall"
      ? 10
      : palette.profile === "freight-yard" || palette.profile === "warehouse"
        ? 9
        : 12;
  const facadeDepth = getKenneyFacadeDepth(
    palette.profile,
    facing,
    width,
    height,
  );
  const facadeRect = getFootprintBandRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    facing,
    facadeDepth,
  );
  const roofRect = getFootprintRoofRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    facing,
    facadeDepth,
  );
  const shellColor = blendColor(palette.base, 0xf1ebde, 0.38);
  const roofColor = blendColor(
    palette.roof,
    0xe7d7bf,
    palette.profile === "repair-stall" || palette.profile === "warehouse"
      ? 0.18
      : 0.24,
  );
  const trimColor = blendColor(palette.trim, 0xf8f0dd, 0.24);
  const outlineColor = blendColor(palette.outline, 0x0d1317, 0.08);
  const shadowColor = blendColor(palette.shadow, 0x06090b, 0.14);

  layer.fillStyle(0x000000, 0.14);
  layer.fillEllipse(
    worldX + width * 0.55,
    worldY + height - 4,
    Math.max(width - 14, 20),
    Math.max(12, height * 0.14),
  );
  layer.fillStyle(shellColor, 1);
  layer.fillRoundedRect(shellX, shellY, shellWidth, shellHeight, cornerRadius);
  layer.fillStyle(blendColor(shellColor, palette.window, 0.12), 1);
  layer.fillRoundedRect(
    facadeRect.x,
    facadeRect.y,
    facadeRect.width,
    facadeRect.height,
    Math.max(6, cornerRadius - 4),
  );
  layer.fillStyle(roofColor, 1);
  layer.fillRoundedRect(
    roofRect.x,
    roofRect.y,
    roofRect.width,
    roofRect.height,
    Math.max(6, cornerRadius - 3),
  );
  layer.fillStyle(trimColor, 0.96);
  drawFootprintParapet(layer, roofRect, facing);
  layer.lineStyle(2.6, outlineColor, 0.9);
  layer.strokeRoundedRect(
    shellX,
    shellY,
    shellWidth,
    shellHeight,
    cornerRadius,
  );
  layer.lineStyle(1.6, shadowColor, 0.3);
  drawRoofRhythm(layer, roofRect, facing, palette.profile);
  drawRoofClutter(layer, roofRect, facing, palette);
}

function getKenneyFacadeDepth(
  profile: ArchitecturalPalette["profile"],
  facing: FootprintFacing,
  width: number,
  height: number,
) {
  if (facing !== "north" && facing !== "south") {
    return clamp(width * 0.3, 10, 22);
  }

  switch (profile) {
    case "boarding-house":
      return clamp(height * 0.34, 28, 46);
    case "tea-house":
      return clamp(height * 0.42, 30, 52);
    case "repair-stall":
      return clamp(height * 0.44, 32, 54);
    case "freight-yard":
    case "warehouse":
      return clamp(height * 0.34, 26, 44);
    default:
      return clamp(height * 0.3, 24, 40);
  }
}

function drawKenneyOpenPlot(
  layer: PhaserType.GameObjects.Graphics,
  footprint: MapFootprint,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
) {
  const palette = footprintPalette({
    kind: footprint.kind,
    locationId: footprint.locationId,
    roofStyle: footprint.roofStyle,
    seedX: footprint.x,
    seedY: footprint.y,
  });
  const inset =
    footprint.kind === "dock" ? 4 : footprint.kind === "market" ? 7 : 6;
  const innerX = worldX + inset;
  const innerY = worldY + inset;
  const innerWidth = Math.max(width - inset * 2, 12);
  const innerHeight = Math.max(height - inset * 2, 12);
  const strokeColor =
    footprint.kind === "market"
      ? blendColor(palette.trim, 0xf4ead6, 0.26)
      : blendColor(palette.outline, 0x182026, 0.08);
  const fillColor =
    footprint.kind === "market"
      ? 0xe9dcc2
      : footprint.kind === "yard"
        ? blendColor(palette.base, 0xe4d1b2, 0.32)
        : blendColor(palette.base, 0xe5d1ac, 0.28);
  const fillAlpha =
    footprint.kind === "market"
      ? 0.18
      : footprint.kind === "yard"
        ? 0.09
        : 0.12;

  layer.fillStyle(fillColor, fillAlpha);
  layer.fillRoundedRect(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    footprint.kind === "dock" ? 8 : 12,
  );
  layer.lineStyle(2.4, strokeColor, footprint.kind === "market" ? 0.62 : 0.48);
  layer.strokeRoundedRect(
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    footprint.kind === "dock" ? 8 : 12,
  );
  layer.lineStyle(1.2, blendColor(strokeColor, 0xffffff, 0.2), 0.2);
  layer.strokeRoundedRect(
    innerX + 6,
    innerY + 6,
    Math.max(innerWidth - 12, 8),
    Math.max(innerHeight - 12, 8),
    footprint.kind === "dock" ? 5 : 9,
  );

  if (footprint.kind === "dock") {
    layer.lineStyle(1.4, blendColor(palette.trim, 0xf8e5be, 0.22), 0.26);
    const plankCount = Math.max(2, Math.floor(innerWidth / 26));
    for (let plank = 1; plank < plankCount; plank += 1) {
      const plankX = innerX + (innerWidth * plank) / plankCount;
      layer.lineBetween(plankX, innerY + 3, plankX, innerY + innerHeight - 3);
    }
    return;
  }

  if (footprint.kind === "market") {
    layer.lineStyle(1.4, blendColor(strokeColor, 0xffffff, 0.18), 0.26);
    layer.lineBetween(
      innerX + innerWidth / 2,
      innerY + 10,
      innerX + innerWidth / 2,
      innerY + innerHeight - 10,
    );
    layer.lineBetween(
      innerX + 10,
      innerY + innerHeight / 2,
      innerX + innerWidth - 10,
      innerY + innerHeight / 2,
    );
    layer.fillStyle(0xc6b18a, 0.14);
    layer.fillCircle(
      innerX + innerWidth / 2,
      innerY + innerHeight / 2,
      Math.min(innerWidth, innerHeight) * 0.12,
    );
    return;
  }

  if (footprint.kind === "yard") {
    layer.lineStyle(1.4, blendColor(strokeColor, 0x5e4b35, 0.18), 0.22);
    layer.lineBetween(
      innerX + 10,
      innerY + 12,
      innerX + innerWidth - 12,
      innerY + 18,
    );
    layer.lineBetween(
      innerX + 12,
      innerY + innerHeight - 14,
      innerX + innerWidth - 10,
      innerY + innerHeight - 20,
    );
  }
}

function resolveFootprintFacing(
  map: CityMap,
  footprint: MapFootprint,
): FootprintFacing {
  const linkedDoor =
    (footprint.locationId
      ? map.doors.find((door) => door.locationId === footprint.locationId)
      : undefined) ??
    map.doors.find((door) => doorTouchesFootprint(door, footprint));

  if (linkedDoor) {
    return facingFromDoor(footprint, linkedDoor);
  }

  const walkableTiles = new Set(
    map.tiles
      .filter((tile) => tile.walkable)
      .map((tile) => `${tile.x},${tile.y}`),
  );
  const scores: Record<FootprintFacing, number> = {
    east: scoreFootprintAccessEdge(walkableTiles, footprint, "east"),
    north: scoreFootprintAccessEdge(walkableTiles, footprint, "north"),
    south: scoreFootprintAccessEdge(walkableTiles, footprint, "south"),
    west: scoreFootprintAccessEdge(walkableTiles, footprint, "west"),
  };
  const ranked = (
    Object.entries(scores) as Array<[FootprintFacing, number]>
  ).sort((left, right) => right[1] - left[1]);

  if (ranked[0]?.[1]) {
    return ranked[0][0];
  }

  if (footprint.height > footprint.width * 1.35) {
    return footprint.x < map.width / 2 ? "east" : "west";
  }

  return footprint.y < map.height / 2 ? "south" : "north";
}

function doorTouchesFootprint(door: MapDoor, footprint: MapFootprint) {
  return !(
    door.x + door.width < footprint.x - 0.35 ||
    door.x > footprint.x + footprint.width + 0.35 ||
    door.y + door.height < footprint.y - 0.35 ||
    door.y > footprint.y + footprint.height + 0.35
  );
}

function facingFromDoor(
  footprint: MapFootprint,
  door: MapDoor,
): FootprintFacing {
  const doorCenterX = door.x + door.width / 2;
  const doorCenterY = door.y + door.height / 2;
  const distances: Record<FootprintFacing, number> = {
    east: Math.abs(doorCenterX - (footprint.x + footprint.width)),
    north: Math.abs(doorCenterY - footprint.y),
    south: Math.abs(doorCenterY - (footprint.y + footprint.height)),
    west: Math.abs(doorCenterX - footprint.x),
  };

  return (
    (Object.entries(distances) as Array<[FootprintFacing, number]>).sort(
      (left, right) => left[1] - right[1],
    )[0]?.[0] ?? "south"
  );
}

function scoreFootprintAccessEdge(
  walkableTiles: Set<string>,
  footprint: MapFootprint,
  edge: FootprintFacing,
) {
  const sampleCount =
    edge === "north" || edge === "south"
      ? Math.max(2, Math.ceil(footprint.width * 2))
      : Math.max(2, Math.ceil(footprint.height * 2));
  let score = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = (index + 0.5) / sampleCount;
    const sampleTileX =
      edge === "north" || edge === "south"
        ? Math.floor(footprint.x + footprint.width * ratio)
        : edge === "east"
          ? Math.floor(footprint.x + footprint.width + 0.55)
          : Math.floor(footprint.x - 0.55);
    const sampleTileY =
      edge === "east" || edge === "west"
        ? Math.floor(footprint.y + footprint.height * ratio)
        : edge === "south"
          ? Math.floor(footprint.y + footprint.height + 0.55)
          : Math.floor(footprint.y - 0.55);

    if (walkableTiles.has(`${sampleTileX},${sampleTileY}`)) {
      score += 1;
    }
  }

  return score;
}

function getFootprintBandRect(
  x: number,
  y: number,
  width: number,
  height: number,
  facing: FootprintFacing,
  depth: number,
) {
  switch (facing) {
    case "north":
      return { height: depth, width, x, y };
    case "south":
      return { height: depth, width, x, y: y + height - depth };
    case "east":
      return { height, width: depth, x: x + width - depth, y };
    case "west":
      return { height, width: depth, x, y };
  }
}

function getFootprintRoofRect(
  x: number,
  y: number,
  width: number,
  height: number,
  facing: FootprintFacing,
  depth: number,
) {
  switch (facing) {
    case "north":
      return {
        height: Math.max(height - depth - 6, 12),
        width,
        x,
        y: y + depth + 2,
      };
    case "south":
      return { height: Math.max(height - depth - 6, 12), width, x, y };
    case "east":
      return { height, width: Math.max(width - depth - 6, 12), x, y };
    case "west":
      return {
        height,
        width: Math.max(width - depth - 6, 12),
        x: x + depth + 2,
        y,
      };
  }
}

function drawFootprintParapet(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
) {
  switch (facing) {
    case "north":
      layer.fillRoundedRect(
        roofRect.x + 4,
        roofRect.y,
        roofRect.width - 8,
        7,
        3,
      );
      return;
    case "south":
      layer.fillRoundedRect(
        roofRect.x + 4,
        roofRect.y + roofRect.height - 7,
        roofRect.width - 8,
        7,
        3,
      );
      return;
    case "east":
      layer.fillRoundedRect(
        roofRect.x + roofRect.width - 7,
        roofRect.y + 4,
        7,
        roofRect.height - 8,
        3,
      );
      return;
    case "west":
      layer.fillRoundedRect(
        roofRect.x,
        roofRect.y + 4,
        7,
        roofRect.height - 8,
        3,
      );
  }
}

function drawRoofRhythm(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
  profile: ArchitecturalPalette["profile"],
) {
  const seamCount =
    facing === "north" || facing === "south"
      ? Math.max(
          1,
          Math.floor(roofRect.width / (profile === "warehouse" ? 34 : 42)),
        )
      : Math.max(
          1,
          Math.floor(roofRect.height / (profile === "warehouse" ? 34 : 42)),
        );

  for (let seam = 1; seam < seamCount; seam += 1) {
    const ratio = seam / seamCount;
    if (facing === "north" || facing === "south") {
      const lineX = roofRect.x + roofRect.width * ratio;
      layer.lineBetween(
        lineX,
        roofRect.y + 6,
        lineX,
        roofRect.y + roofRect.height - 6,
      );
    } else {
      const lineY = roofRect.y + roofRect.height * ratio;
      layer.lineBetween(
        roofRect.x + 6,
        lineY,
        roofRect.x + roofRect.width - 6,
        lineY,
      );
    }
  }
}

function drawRoofClutter(
  layer: PhaserType.GameObjects.Graphics,
  roofRect: { height: number; width: number; x: number; y: number },
  facing: FootprintFacing,
  palette: ArchitecturalPalette,
) {
  const accent = blendColor(palette.trim, 0xf7ebd0, 0.14);
  const shadow = blendColor(palette.shadow, 0x06080a, 0.18);

  if (palette.profile === "boarding-house" || palette.profile === "rowhouse") {
    const dormerCount = Math.max(1, Math.floor(roofRect.width / 56));
    for (let dormer = 0; dormer < dormerCount; dormer += 1) {
      const centerX =
        roofRect.x + ((dormer + 1) * roofRect.width) / (dormerCount + 1);
      const dormerY =
        facing === "north"
          ? roofRect.y + roofRect.height - 18
          : roofRect.y + 10;
      layer.fillStyle(accent, 0.96);
      layer.fillRoundedRect(centerX - 8, dormerY, 16, 12, 3);
      layer.fillStyle(blendColor(palette.window, 0xffffff, 0.1), 0.88);
      layer.fillRoundedRect(centerX - 5, dormerY + 3, 10, 6, 2);
    }
    return;
  }

  if (palette.profile === "repair-stall") {
    layer.fillStyle(accent, 0.95);
    layer.fillRoundedRect(
      roofRect.x + 10,
      roofRect.y + 9,
      roofRect.width - 20,
      6,
      3,
    );
    return;
  }

  if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
    const ventWidth = Math.max(20, roofRect.width * 0.28);
    layer.fillStyle(accent, 0.96);
    layer.fillRoundedRect(
      roofRect.x + roofRect.width / 2 - ventWidth / 2,
      roofRect.y + roofRect.height / 2 - 7,
      ventWidth,
      14,
      4,
    );
    layer.fillStyle(shadow, 0.3);
    layer.fillRoundedRect(
      roofRect.x + roofRect.width / 2 - ventWidth / 2 + 2,
      roofRect.y + roofRect.height / 2 - 3,
      ventWidth - 4,
      4,
      2,
    );
    return;
  }

  layer.fillStyle(accent, 0.95);
  const chimneyX =
    facing === "west" ? roofRect.x + roofRect.width - 14 : roofRect.x + 10;
  const chimneyY =
    facing === "north" ? roofRect.y + roofRect.height - 24 : roofRect.y + 10;
  layer.fillRoundedRect(chimneyX, chimneyY, 10, 16, 2);
}

function drawArchitecturalMass(
  layer: PhaserType.GameObjects.Graphics,
  {
    height,
    kind,
    locationId,
    roofStyle,
    seedX,
    seedY,
    width,
    worldX,
    worldY,
  }: {
    height: number;
    kind: MapFootprint["kind"];
    locationId?: string;
    roofStyle?: RoofStyle;
    seedX: number;
    seedY: number;
    width: number;
    worldX: number;
    worldY: number;
  },
) {
  const palette = footprintPalette({
    kind,
    locationId,
    roofStyle,
    seedX,
    seedY,
  });
  const cornerRadius =
    kind === "building"
      ? palette.profile === "freight-yard" || palette.profile === "warehouse"
        ? 10
        : palette.profile === "repair-stall"
          ? 11
          : 13
      : kind === "dock" || kind === "yard"
        ? 10
        : 12;
  const roofInset =
    palette.profile === "repair-stall" || palette.profile === "warehouse"
      ? 6
      : Math.max(8, Math.min(width, height) * 0.08);
  const bodyTop = worldY + (kind === "building" ? 12 : 9);
  const bodyHeight = Math.max(height - 16, 18);

  layer.fillStyle(0x000000, 0.16);
  layer.fillEllipse(
    worldX + width * 0.55,
    worldY + height - 5,
    Math.max(width - 16, 20),
    Math.max(18, height * 0.22),
  );
  layer.fillStyle(palette.shadow, kind === "building" ? 0.28 : 0.22);
  layer.fillRoundedRect(
    worldX + width * 0.16,
    worldY + height - 4,
    width * 0.72,
    Math.max(10, height * 0.14),
    10,
  );
  layer.fillStyle(palette.base, 1);
  layer.fillRoundedRect(
    worldX + 4,
    bodyTop,
    width - 8,
    bodyHeight,
    cornerRadius,
  );
  layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.16), 1);
  layer.fillRoundedRect(
    worldX + 8,
    worldY + height - Math.max(16, height * 0.18),
    width - 16,
    Math.max(10, height * 0.12),
    Math.max(5, cornerRadius - 6),
  );

  if (kind === "building") {
    if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
      layer.fillStyle(palette.roof, 1);
      layer.fillRoundedRect(
        worldX + 6,
        worldY + 6,
        width - 12,
        Math.max(18, height - 22),
        10,
      );
      layer.fillStyle(palette.roofBand, 1);
      layer.fillRoundedRect(worldX + 10, worldY + 11, width - 20, 11, 4);
    } else {
      layer.fillStyle(palette.roof, 1);
      layer.fillRoundedRect(
        worldX + roofInset,
        worldY + 5,
        width - roofInset * 2,
        Math.max(height - 22, 18),
        Math.max(10, cornerRadius - 2),
      );
      layer.fillStyle(palette.roofBand, 1);
      layer.fillRoundedRect(
        worldX + roofInset + 4,
        worldY + 10,
        Math.max(width - roofInset * 2 - 8, 12),
        8,
        3,
      );
    }

    layer.fillStyle(palette.trim, 0.98);
    layer.fillRoundedRect(
      worldX + 10,
      worldY + height - Math.max(22, height * 0.22),
      width - 20,
      7,
      3,
    );
    layer.lineStyle(3, palette.outline, 0.84);
    layer.strokeRoundedRect(
      worldX + 4,
      worldY + 4,
      width - 8,
      height - 8,
      cornerRadius,
    );
    drawRoofSilhouette(layer, worldX, worldY, width, height, palette);

    if (palette.profile === "repair-stall") {
      layer.lineStyle(1.6, blendColor(palette.outline, 0x091015, 0.18), 0.36);
      for (let seam = 1; seam < 4; seam += 1) {
        const seamX = worldX + 10 + ((width - 20) * seam) / 4;
        layer.lineBetween(seamX, worldY + 10, seamX, worldY + height - 16);
      }
    }

    if (palette.profile === "moss-pier") {
      layer.fillStyle(blendColor(palette.base, 0x0b1014, 0.16), 1);
      layer.fillRoundedRect(worldX + 8, worldY + 20, width - 16, 5, 2);
      layer.fillRoundedRect(worldX + 8, worldY + 30, width - 16, 4, 2);
    }
  } else {
    layer.fillStyle(palette.roof, 0.98);
    layer.fillRoundedRect(
      worldX + 6,
      worldY + 6,
      width - 12,
      height - 12,
      cornerRadius - 4,
    );
    layer.lineStyle(2.5, palette.outline, 0.72);
    layer.strokeRoundedRect(
      worldX + 5,
      worldY + 5,
      width - 10,
      height - 10,
      cornerRadius - 2,
    );
  }

  return palette;
}

function drawFootprintSurfaceDetail(
  layer: PhaserType.GameObjects.Graphics,
  kind: MapFootprint["kind"],
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  switch (kind) {
    case "market":
      layer.lineStyle(2, palette.outline, 0.32);
      layer.strokeRoundedRect(
        worldX + 10,
        worldY + 10,
        width - 20,
        height - 20,
        12,
      );
      layer.lineBetween(
        worldX + 16,
        worldY + height / 2,
        worldX + width - 16,
        worldY + height / 2,
      );
      layer.lineBetween(
        worldX + width / 2,
        worldY + 16,
        worldX + width / 2,
        worldY + height - 16,
      );
      layer.fillStyle(blendColor(palette.base, 0xf4dfb8, 0.18), 0.9);
      layer.fillCircle(worldX + width / 2, worldY + height / 2, 15);
      layer.lineStyle(2, blendColor(palette.trim, 0xffffff, 0.16), 0.24);
      layer.strokeCircle(worldX + width / 2, worldY + height / 2, 15);
      break;
    case "yard":
      layer.lineStyle(2, blendColor(palette.trim, 0x201810, 0.22), 0.24);
      layer.lineBetween(
        worldX + 16,
        worldY + height - 18,
        worldX + width - 16,
        worldY + height - 28,
      );
      layer.lineBetween(
        worldX + 22,
        worldY + 20,
        worldX + width - 20,
        worldY + 28,
      );
      layer.fillStyle(blendColor(palette.base, 0x3a2d20, 0.18), 0.58);
      layer.fillRoundedRect(worldX + 18, worldY + 16, 18, 10, 3);
      layer.fillRoundedRect(
        worldX + width - 40,
        worldY + height - 28,
        20,
        11,
        3,
      );
      break;
    case "dock":
      layer.fillStyle(blendColor(palette.shadow, 0x090b0d, 0.18), 0.45);
      layer.fillRoundedRect(worldX + 6, worldY + height - 16, width - 12, 8, 3);
      layer.lineStyle(2, blendColor(palette.outline, 0xf7ead2, 0.08), 0.24);
      layer.lineBetween(
        worldX + 12,
        worldY + 18,
        worldX + width - 12,
        worldY + 18,
      );
      layer.lineBetween(
        worldX + 12,
        worldY + height - 24,
        worldX + width - 12,
        worldY + height - 24,
      );
      break;
    case "garden":
      layer.lineStyle(2, palette.outline, 0.22);
      layer.strokeRoundedRect(
        worldX + 10,
        worldY + 10,
        width - 20,
        height - 20,
        12,
      );
      layer.fillStyle(blendColor(palette.base, 0x9ec07e, 0.22), 0.58);
      layer.fillEllipse(worldX + width * 0.28, worldY + height * 0.54, 42, 18);
      layer.fillEllipse(worldX + width * 0.7, worldY + height * 0.48, 36, 16);
      break;
    case "water":
      layer.lineStyle(2, blendColor(palette.window, 0xffffff, 0.08), 0.24);
      layer.lineBetween(
        worldX + 10,
        worldY + 16,
        worldX + width - 10,
        worldY + 10,
      );
      layer.lineBetween(
        worldX + 12,
        worldY + height - 14,
        worldX + width - 14,
        worldY + height - 18,
      );
      layer.fillStyle(blendColor(palette.base, 0x0d2030, 0.18), 0.52);
      layer.fillEllipse(worldX + width * 0.3, worldY + height * 0.64, 44, 10);
      layer.fillEllipse(worldX + width * 0.75, worldY + height * 0.34, 34, 8);
      break;
    default:
      break;
  }
}

function footprintPalette({
  kind,
  locationId,
  roofStyle,
  seedX,
  seedY,
}: {
  kind: MapFootprint["kind"];
  locationId?: string;
  roofStyle?: RoofStyle;
  seedX: number;
  seedY: number;
}): ArchitecturalPalette {
  if (kind === "building") {
    return buildingPaletteForProfile(
      resolveBuildingProfile(locationId, roofStyle, seedX, seedY),
    );
  }

  switch (kind) {
    case "dock":
      return {
        awning: 0xce9968,
        base: 0x8f6b47,
        outline: 0xe0c49a,
        profile: "moss-pier",
        roof: 0x6c4f34,
        roofBand: 0xb98a59,
        shadow: 0x18120d,
        sign: 0xceb183,
        trim: 0xb78558,
        window: 0xf1d7aa,
      };
    case "garden":
      return {
        awning: 0x9ac082,
        base: 0x486846,
        outline: 0xb7d29f,
        profile: "rowhouse",
        roof: 0x355239,
        roofBand: 0x628b59,
        shadow: 0x101710,
        sign: 0x8fba77,
        trim: 0x7ca06d,
        window: 0xe7efc8,
      };
    case "market":
      return {
        awning: 0xc1835b,
        base: 0x7d6149,
        outline: 0xe0c197,
        profile: "tea-house",
        roof: 0x5e432d,
        roofBand: 0xa16f46,
        shadow: 0x15100d,
        sign: 0xd9b47d,
        trim: 0xcf9b63,
        window: 0xf2d3a0,
      };
    case "water":
      return {
        awning: 0x77bfd6,
        base: 0x2d5a72,
        outline: 0xa6d4e3,
        profile: "moss-pier",
        roof: 0x214758,
        roofBand: 0x5fa0b7,
        shadow: 0x0d1f2b,
        sign: 0xaad7e7,
        trim: 0x76b8cf,
        window: 0xe7f8fc,
      };
    case "yard":
      return {
        awning: 0xc99662,
        base: 0x73614d,
        outline: 0xd6b98b,
        profile: "freight-yard",
        roof: 0x594632,
        roofBand: 0xa87d48,
        shadow: 0x16110d,
        sign: 0xcfb17c,
        trim: 0xbd905a,
        window: 0xf1d3a2,
      };
    default:
      return buildingPaletteForProfile(
        resolveBuildingProfile(locationId, roofStyle, seedX, seedY),
      );
  }
}

function drawBuildingDetail(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const profile = palette.profile;
  const seedX = Math.round(worldX / CELL);
  const seedY = Math.round(worldY / CELL);
  const windowColumns =
    profile === "freight-yard" || profile === "warehouse"
      ? Math.max(2, Math.floor(width / 48))
      : Math.max(2, Math.floor(width / 38));
  const windowRows =
    profile === "boarding-house"
      ? Math.max(2, Math.floor((height - 42) / 22))
      : 1;
  const storefrontHeight = Math.min(32, Math.max(18, height * 0.22));
  const upperTop = worldY + 24;
  const upperBottom = worldY + height - storefrontHeight - 16;
  const bayCount =
    profile === "freight-yard" || profile === "warehouse"
      ? Math.max(2, Math.floor(width / 56))
      : Math.max(2, Math.floor(width / 46));

  layer.fillStyle(palette.trim, 0.98);
  layer.fillRoundedRect(worldX + 10, worldY + 20, width - 20, 7, 6);
  layer.fillStyle(blendColor(palette.base, 0x11161b, 0.22), 1);
  layer.fillRoundedRect(
    worldX + 8,
    worldY + height - storefrontHeight - 8,
    width - 16,
    storefrontHeight,
    6,
  );
  drawFacadeRhythm(
    layer,
    worldX,
    upperTop,
    upperBottom,
    width,
    bayCount,
    palette,
  );

  const span = width - 32;
  for (let row = 0; row < windowRows; row += 1) {
    for (let column = 0; column < windowColumns; column += 1) {
      const windowX = worldX + 16 + column * (span / windowColumns);
      const windowY = upperTop + row * 19;
      if (windowY + 10 >= upperBottom) {
        continue;
      }
      const lit = sampleTileNoise(column + seedX, row + seedY, 113) > 0.42;
      layer.fillStyle(
        lit ? palette.window : blendColor(palette.base, 0x20303a, 0.42),
        0.96,
      );
      layer.fillRoundedRect(windowX, windowY, 11, 10, 2);
      layer.fillStyle(
        blendColor(0xffffff, palette.window, 0.25),
        lit ? 0.22 : 0.08,
      );
      layer.fillRoundedRect(windowX + 1, windowY + 1, 9, 2.5, 1);
      layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.22), 0.34);
      layer.fillRect(windowX, windowY + 10, 11, 1.5);
    }
  }

  if (profile === "boarding-house") {
    const chimneyCount = width > CELL * 3 ? 2 : 1;
    for (let index = 0; index < chimneyCount; index += 1) {
      const chimneyX = worldX + 18 + index * (width - 44);
      const chimneyY = worldY + 6 + (index % 2) * 2;
      layer.fillStyle(blendColor(palette.roof, 0x0b1115, 0.1), 1);
      layer.fillRoundedRect(chimneyX, chimneyY, 9, 15, 2);
      layer.fillStyle(palette.trim, 0.92);
      layer.fillRoundedRect(chimneyX + 1, chimneyY, 7, 3, 1);
    }
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(
      worldX + width / 2 - 24,
      worldY + height - 20,
      48,
      7,
      3,
    );
    drawDoorPair(
      layer,
      worldX + width * 0.28,
      worldY + height - 17,
      palette,
      0.92,
    );
    drawDoorPair(
      layer,
      worldX + width * 0.64,
      worldY + height - 17,
      palette,
      0.92,
    );
  }

  if (profile === "tea-house") {
    const canopyX = worldX + width / 2 - 24;
    const canopyY = worldY + height - 30;
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + 14, worldY + 10, 44, 12, 4);
    layer.fillStyle(palette.awning, 1);
    layer.fillTriangle(
      canopyX + 3,
      canopyY + 7,
      canopyX + 45,
      canopyY + 7,
      canopyX + 24,
      canopyY + 18,
    );
    layer.fillStyle(blendColor(palette.awning, 0xffffff, 0.18), 1);
    layer.fillRoundedRect(canopyX + 4, canopyY, 40, 7, 3);
    layer.fillStyle(blendColor(palette.sign, 0x0d1216, 0.08), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 32,
      worldY + height - 18,
      64,
      10,
      4,
    );
    layer.fillStyle(palette.window, 0.88);
    layer.fillCircle(worldX + 16, worldY + height - 16, 2.6);
    layer.fillCircle(worldX + width - 16, worldY + height - 16, 2.6);
  }

  if (profile === "repair-stall") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + width - 54, worldY + height - 24, 44, 15, 4);
    layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.3), 1);
    layer.fillRoundedRect(worldX + 10, worldY + height - 25, width - 64, 16, 3);
    layer.lineStyle(2, blendColor(palette.outline, 0x0b1014, 0.16), 0.4);
    layer.lineBetween(
      worldX + 10,
      worldY + height - 9,
      worldX + width - 10,
      worldY + height - 9,
    );
    layer.lineStyle(2.4, palette.awning, 0.9);
    layer.lineBetween(
      worldX + 8,
      worldY + 18,
      worldX + width - 10,
      worldY + 22,
    );
  }

  if (profile === "freight-yard" || profile === "warehouse") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + width / 2 - 28, worldY + 12, 56, 10, 4);
    layer.fillStyle(blendColor(palette.base, 0x0a1014, 0.34), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 26,
      worldY + height - 30,
      52,
      20,
      4,
    );
    for (let index = 0; index < 4; index += 1) {
      const clerestoryX = worldX + 14 + index * ((width - 28) / 4);
      layer.fillStyle(palette.window, 0.9);
      layer.fillRoundedRect(clerestoryX, worldY + 26, 10, 6, 2);
    }
    layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.14), 1);
    layer.fillRoundedRect(
      worldX + width / 2 - 18,
      worldY + height - 26,
      36,
      16,
      3,
    );
  }

  if (profile === "moss-pier") {
    layer.fillStyle(palette.sign, 0.98);
    layer.fillRoundedRect(worldX + 12, worldY + 12, 50, 10, 4);
    layer.lineStyle(2, blendColor(palette.outline, 0x0a1014, 0.14), 0.32);
    for (let slat = 0; slat < 4; slat += 1) {
      const slatY = worldY + 22 + slat * 10;
      layer.lineBetween(worldX + 12, slatY, worldX + width - 12, slatY);
    }
    layer.fillStyle(blendColor(palette.shadow, 0x06090c, 0.08), 1);
    layer.fillRoundedRect(worldX + 12, worldY + height - 24, width - 24, 12, 3);
    layer.fillStyle(palette.awning, 0.98);
    layer.fillTriangle(
      worldX + width * 0.24,
      worldY + height - 23,
      worldX + width * 0.78,
      worldY + height - 23,
      worldX + width * 0.51,
      worldY + height - 11,
    );
  }

  if (profile === "rowhouse") {
    const dormerCount = Math.max(1, Math.floor(width / 92));
    for (let dormer = 0; dormer < dormerCount; dormer += 1) {
      const ratio = (dormer + 1) / (dormerCount + 1);
      const dormerX = worldX + width * ratio - 7;
      layer.fillStyle(palette.sign, 0.96);
      layer.fillRoundedRect(dormerX, worldY + 15 + (dormer % 2) * 2, 14, 9, 3);
      layer.fillStyle(palette.window, 0.86);
      layer.fillRoundedRect(
        dormerX + 3,
        worldY + 18 + (dormer % 2) * 2,
        8,
        4,
        2,
      );
    }
    if (width > CELL * 2.1) {
      const awningWidth = Math.min(34, width * 0.24);
      layer.fillStyle(palette.awning, 1);
      layer.fillTriangle(
        worldX + width * 0.22,
        worldY + height - 19,
        worldX + width * 0.22 + awningWidth,
        worldY + height - 19,
        worldX + width * 0.22 + awningWidth / 2,
        worldY + height - 10,
      );
      layer.fillTriangle(
        worldX + width * 0.58,
        worldY + height - 19,
        worldX + width * 0.58 + awningWidth,
        worldY + height - 19,
        worldX + width * 0.58 + awningWidth / 2,
        worldY + height - 10,
      );
    }
  }

  layer.fillStyle(palette.trim, 0.98);
  layer.fillRoundedRect(
    worldX + 12,
    worldY + height - storefrontHeight + 2,
    width - 24,
    5,
    2,
  );
}

function drawRoofSilhouette(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  _height: number,
  palette: ArchitecturalPalette,
) {
  const roofY = worldY + 7;

  if (palette.profile === "boarding-house" || palette.profile === "rowhouse") {
    const gableCount = Math.max(2, Math.floor(width / 52));
    for (let index = 0; index < gableCount; index += 1) {
      const ratio = (index + 0.5) / gableCount;
      const centerX = worldX + width * ratio;
      const gableWidth = Math.min(34, width / gableCount - 8);
      const peakY = roofY - 8 - (index % 2) * 3;
      layer.fillStyle(palette.roofBand, 0.98);
      layer.fillTriangle(
        centerX - gableWidth / 2,
        roofY + 10,
        centerX + gableWidth / 2,
        roofY + 10,
        centerX,
        peakY,
      );
      layer.lineStyle(1.4, blendColor(palette.outline, 0x0a1014, 0.12), 0.28);
      layer.lineBetween(centerX, peakY + 1, centerX, roofY + 8);
    }
    return;
  }

  if (palette.profile === "tea-house") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillTriangle(
      worldX + 18,
      roofY + 10,
      worldX + width - 18,
      roofY + 10,
      worldX + width / 2,
      roofY - 7,
    );
    return;
  }

  if (palette.profile === "freight-yard" || palette.profile === "warehouse") {
    const clerestoryWidth = Math.max(32, width * 0.34);
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillRoundedRect(
      worldX + width / 2 - clerestoryWidth / 2,
      roofY - 4,
      clerestoryWidth,
      11,
      4,
    );
    layer.fillTriangle(
      worldX + width / 2 - clerestoryWidth / 2,
      roofY + 7,
      worldX + width / 2 + clerestoryWidth / 2,
      roofY + 7,
      worldX + width / 2,
      roofY - 8,
    );
    return;
  }

  if (palette.profile === "repair-stall") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillTriangle(
      worldX + 12,
      roofY + 10,
      worldX + width - 10,
      roofY + 16,
      worldX + width - 16,
      roofY - 2,
    );
    return;
  }

  if (palette.profile === "moss-pier") {
    layer.fillStyle(palette.roofBand, 0.98);
    layer.fillRoundedRect(worldX + 12, roofY + 3, width - 24, 8, 4);
  }
}

function drawFacadeRhythm(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  upperTop: number,
  upperBottom: number,
  width: number,
  bayCount: number,
  palette: ArchitecturalPalette,
) {
  for (let bay = 1; bay < bayCount; bay += 1) {
    const dividerX = worldX + (width * bay) / bayCount;
    layer.fillStyle(blendColor(palette.trim, palette.shadow, 0.26), 0.68);
    layer.fillRoundedRect(
      dividerX - 1.5,
      upperTop - 4,
      3,
      upperBottom - upperTop + 14,
      2,
    );
    layer.fillStyle(blendColor(palette.window, 0xffffff, 0.12), 0.12);
    layer.fillRoundedRect(
      dividerX - 0.5,
      upperTop - 2,
      1,
      upperBottom - upperTop + 8,
      1,
    );
  }
}

function drawDoorPair(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  baselineY: number,
  palette: ArchitecturalPalette,
  alpha: number,
) {
  layer.fillStyle(blendColor(palette.shadow, 0x05080a, 0.1), alpha);
  layer.fillRoundedRect(centerX - 10, baselineY - 8, 20, 12, 3);
  layer.fillStyle(blendColor(palette.sign, 0x2c2018, 0.18), alpha);
  layer.fillRoundedRect(centerX - 8, baselineY - 7, 7, 10, 2);
  layer.fillRoundedRect(centerX + 1, baselineY - 7, 7, 10, 2);
}

function resolveBuildingProfile(
  locationId: string | undefined,
  roofStyle: RoofStyle | undefined,
  seedX: number,
  seedY: number,
): ArchitecturalPalette["profile"] {
  switch (locationId) {
    case "boarding-house":
      return "boarding-house";
    case "tea-house":
      return "tea-house";
    case "repair-stall":
      return "repair-stall";
    case "freight-yard":
      return "freight-yard";
    case "moss-pier":
      return "moss-pier";
    default:
      break;
  }

  if (roofStyle === "tin") {
    return "repair-stall";
  }

  if (roofStyle === "timber") {
    return "moss-pier";
  }

  if (roofStyle === "plaster") {
    return "tea-house";
  }

  return sampleTileNoise(seedX, seedY, 887) > 0.68 ? "warehouse" : "rowhouse";
}

function buildingPaletteForProfile(
  profile: ArchitecturalPalette["profile"],
): ArchitecturalPalette {
  switch (profile) {
    case "boarding-house":
      return {
        awning: 0xc3a383,
        base: 0x61707b,
        outline: 0xe2ddd0,
        profile,
        roof: 0x36434d,
        roofBand: 0x4d5b65,
        shadow: 0x131c23,
        sign: 0xcab394,
        trim: 0xa88c6f,
        window: 0xf2ddb2,
      };
    case "tea-house":
      return {
        awning: 0x8c5442,
        base: 0x7f654d,
        outline: 0xe6cda3,
        profile,
        roof: 0x5a4331,
        roofBand: 0xa46f47,
        shadow: 0x16100d,
        sign: 0xd9b27d,
        trim: 0xc6905d,
        window: 0xf4d7a6,
      };
    case "repair-stall":
      return {
        awning: 0x7c9098,
        base: 0x687984,
        outline: 0xd7e1e4,
        profile,
        roof: 0x4e5d67,
        roofBand: 0x90a4ad,
        shadow: 0x121920,
        sign: 0xb6c6cd,
        trim: 0x8ea3ac,
        window: 0xe7f3f6,
      };
    case "freight-yard":
      return {
        awning: 0xc38e4f,
        base: 0x80684d,
        outline: 0xe1c18d,
        profile,
        roof: 0x62503b,
        roofBand: 0xaf7d44,
        shadow: 0x18120d,
        sign: 0xd0ae76,
        trim: 0xbf8d55,
        window: 0xf0d2a2,
      };
    case "moss-pier":
      return {
        awning: 0xc7925d,
        base: 0x7a5a40,
        outline: 0xe2c497,
        profile,
        roof: 0x5a412d,
        roofBand: 0xb27f4f,
        shadow: 0x16100b,
        sign: 0xd8b17d,
        trim: 0xbf8856,
        window: 0xf1d8aa,
      };
    case "warehouse":
      return {
        awning: 0xb98854,
        base: 0x6d604d,
        outline: 0xd7c3a2,
        profile,
        roof: 0x514636,
        roofBand: 0x8c7254,
        shadow: 0x16130f,
        sign: 0xcab087,
        trim: 0xb69068,
        window: 0xeed9b3,
      };
    case "rowhouse":
    default:
      return {
        awning: 0xb98b63,
        base: 0x536978,
        outline: 0xd5d8cf,
        profile: "rowhouse",
        roof: 0x33424d,
        roofBand: 0x516372,
        shadow: 0x121a21,
        sign: 0xc9b08a,
        trim: 0xac8c69,
        window: 0xf0dcaf,
      };
  }
}

const KENNEY_SIGN_FRAMES = [290, 291, 292, 293];

export function drawKenneyFacadeSprites(
  scene: PhaserType.Scene,
  game: StreetGameState,
) {
  if (!scene.textures.exists(KENNEY_MODERN_CITY_KEY)) {
    return [];
  }

  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const footprint of game.map.footprints) {
    if (footprint.kind !== "building") {
      continue;
    }

    const facade = kenneyFacadeStyleForFootprint(footprint);
    const facing = resolveFootprintFacing(game.map, footprint);
    const tileMinX = Math.floor(footprint.x + 0.1);
    const tileMinY = Math.floor(footprint.y + 0.1);
    const tileMaxX = Math.max(
      tileMinX + 1,
      Math.ceil(footprint.x + footprint.width - 0.1),
    );
    const tileMaxY = Math.max(
      tileMinY + 1,
      Math.ceil(footprint.y + footprint.height - 0.1),
    );
    const columns = tileMaxX - tileMinX;
    const rows = tileMaxY - tileMinY;

    if (facing !== "north" && facing !== "south") {
      continue;
    }

    const facadeRows = Math.min(
      rows,
      Math.max(2, Math.min(3, Math.round(footprint.height))),
    );
    const baseTileY =
      facing === "south" ? Math.max(tileMinY, tileMaxY - facadeRows) : tileMinY;

    for (let row = 0; row < facadeRows; row += 1) {
      const visualRow = facing === "south" ? row : facadeRows - row - 1;
      for (let column = 0; column < columns; column += 1) {
        const frame =
          visualRow === 0
            ? facade.top[column % facade.top.length]
            : visualRow === facadeRows - 1
              ? facade.base[column % facade.base.length]
              : facade.mid[(visualRow + column) % facade.mid.length];
        const { x, y } = mapTileToWorldOrigin(
          tileMinX + column,
          baseTileY + row,
        );
        nodes.push(
          scene.add
            .image(x, y, KENNEY_MODERN_CITY_KEY, frame)
            .setOrigin(0)
            .setScale(KENNEY_SCALE)
            .setDepth(23),
        );
      }
    }

    if (facade.awning.length > 0) {
      const awningRow =
        facing === "south"
          ? Math.max(baseTileY + facadeRows - 2, baseTileY)
          : Math.min(baseTileY + 1, tileMaxY - 1);
      for (let column = 0; column < columns; column += 1) {
        const { x, y } = mapTileToWorldOrigin(tileMinX + column, awningRow);
        nodes.push(
          scene.add
            .image(
              x,
              y,
              KENNEY_MODERN_CITY_KEY,
              facade.awning[column % facade.awning.length],
            )
            .setOrigin(0)
            .setScale(KENNEY_SCALE)
            .setDepth(24),
        );
      }
    }

    if (facade.signFrame !== null) {
      const signX = tileMinX + Math.max(0, Math.floor(columns / 2) - 1);
      const signY =
        facing === "south"
          ? Math.min(baseTileY + 1, tileMaxY - 1)
          : Math.max(baseTileY + facadeRows - 2, baseTileY);
      const { x, y } = mapTileToWorldOrigin(signX, signY);
      nodes.push(
        scene.add
          .image(x, y, KENNEY_MODERN_CITY_KEY, facade.signFrame)
          .setOrigin(0)
          .setScale(KENNEY_SCALE)
          .setDepth(25),
      );
    }
  }

  return nodes;
}

export function drawKenneyLandmarkOverlays(
  scene: PhaserType.Scene,
  game: StreetGameState,
) {
  const nodes: PhaserType.GameObjects.GameObject[] = [];

  for (const footprint of game.map.footprints) {
    if (footprint.kind !== "building" || !footprint.locationId) {
      continue;
    }

    const palette = footprintPalette({
      kind: footprint.kind,
      locationId: footprint.locationId,
      roofStyle: footprint.roofStyle,
      seedX: footprint.x,
      seedY: footprint.y,
    });
    const facing = resolveFootprintFacing(game.map, footprint);

    if (
      facing !== "south" ||
      (palette.profile !== "boarding-house" &&
        palette.profile !== "tea-house" &&
        palette.profile !== "repair-stall")
    ) {
      continue;
    }

    const { x: worldX, y: worldY } = mapTileToWorldOrigin(
      footprint.x,
      footprint.y,
    );
    const width = footprint.width * CELL;
    const height = footprint.height * CELL;
    const overlay = scene.add.graphics().setDepth(26);

    if (
      footprint.locationId === "tea-house" &&
      palette.profile === "tea-house"
    ) {
      drawTeaHouseLandmark(overlay, worldX, worldY, width, height, palette);
    } else {
      drawBuildingDetail(overlay, worldX, worldY, width, height, palette);
      drawLandmarkPurposeAccent(
        overlay,
        worldX,
        worldY,
        width,
        height,
        palette,
      );
    }
    nodes.push(overlay);
  }

  return nodes;
}

function drawTeaHouseLandmark(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const centerX = worldX + width / 2;
  const roofLeft = worldX + 8;
  const roofRight = worldX + width - 8;
  const roofBaseY = worldY + 24;
  const wallTop = worldY + 28;
  const wallHeight = Math.max(height - 42, 44);
  const awningY = worldY + height - 42;
  const storefrontY = worldY + height - 34;
  const terraceY = worldY + height + 3;
  const planterY = worldY + height + 29;
  const warmWindow = blendColor(palette.window, 0xfff6e0, 0.2);
  const teaRoof = 0x496d5b;
  const teaRoofDark = 0x30483e;
  const teaWall = 0xe3d7bf;
  const teaTrim = 0x79583d;
  const teaWood = 0x6b4b33;
  const terraceStone = 0xc8b89a;
  const terraceShadow = 0x8f7b61;
  const stripeLight = 0xf5efe4;
  const stripeGreen = 0x58a774;
  const brickWarm = 0xbc8768;
  const creamTrim = 0xf2e6d0;
  const cafeRail = 0x664731;
  const terraceCloth = 0xf1ede2;
  const terraceAccent = 0xe0c995;
  const menuBoard = 0x243129;
  const menuFrame = 0x6a4d37;

  layer.fillStyle(teaRoofDark, 0.22);
  layer.fillEllipse(centerX, worldY + height - 2, Math.max(width - 26, 40), 16);

  layer.fillStyle(teaRoof, 1);
  layer.fillTriangle(
    roofLeft,
    roofBaseY + 14,
    roofRight,
    roofBaseY + 14,
    centerX,
    worldY + 8,
  );
  layer.fillStyle(blendColor(teaRoof, 0xb1cfbf, 0.18), 1);
  layer.fillRoundedRect(worldX + 16, worldY + 11, width - 32, 9, 4);
  layer.fillStyle(teaRoofDark, 1);
  layer.fillRoundedRect(worldX + 12, roofBaseY + 8, width - 24, 8, 4);
  layer.lineStyle(1.6, blendColor(teaRoofDark, 0xf0eadb, 0.08), 0.34);
  for (let seam = 1; seam < 5; seam += 1) {
    const seamX = worldX + 18 + ((width - 36) * seam) / 5;
    layer.lineBetween(seamX, worldY + 13, seamX - 4, roofBaseY + 12);
  }

  layer.fillStyle(teaWall, 0.98);
  layer.fillRoundedRect(worldX + 10, wallTop, width - 20, wallHeight, 8);
  layer.fillStyle(brickWarm, 1);
  layer.fillRoundedRect(worldX + 10, worldY + 52, width - 20, 14, 2);
  layer.fillStyle(blendColor(teaWall, 0xffffff, 0.18), 1);
  layer.fillRoundedRect(worldX + 14, wallTop + 5, width - 28, 8, 3);
  layer.fillStyle(creamTrim, 0.92);
  layer.fillRoundedRect(
    worldX + width - 24,
    wallTop + 6,
    12,
    wallHeight - 18,
    4,
  );
  layer.fillStyle(stripeGreen, 0.86);
  layer.fillRect(worldX + width - 22, wallTop + 22, 3, wallHeight - 34);
  layer.fillRect(worldX + width - 16, wallTop + 22, 3, wallHeight - 34);

  const upperWindowY = worldY + 36;
  for (const offset of [-34, 0, 34]) {
    const windowX = centerX + offset - 11;
    layer.fillStyle(teaTrim, 0.96);
    layer.fillRoundedRect(windowX - 2, upperWindowY - 2, 26, 24, 4);
    layer.fillStyle(warmWindow, 0.96);
    layer.fillRoundedRect(windowX, upperWindowY, 22, 20, 3);
    layer.lineStyle(1.2, blendColor(teaTrim, 0x0d1114, 0.12), 0.42);
    layer.lineBetween(
      windowX + 11,
      upperWindowY + 2,
      windowX + 11,
      upperWindowY + 18,
    );
    layer.lineBetween(
      windowX + 2,
      upperWindowY + 10,
      windowX + 20,
      upperWindowY + 10,
    );
  }

  const awningWidth = width - 34;
  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(worldX + 14, awningY - 6, awningWidth, 8, 4);
  for (let stripe = 0; stripe < 7; stripe += 1) {
    const stripeX = worldX + 17 + stripe * (awningWidth / 7);
    const stripeWidth = awningWidth / 7 + 1;
    layer.fillStyle(stripe % 2 === 0 ? stripeLight : stripeGreen, 0.98);
    layer.fillRect(stripeX, awningY, stripeWidth, 18);
  }
  layer.fillStyle(teaWood, 0.98);
  layer.fillTriangle(
    worldX + 18,
    awningY + 18,
    worldX + 14 + awningWidth,
    awningY + 18,
    centerX,
    awningY + 28,
  );

  layer.fillStyle(teaWood, 1);
  layer.fillRoundedRect(worldX + 12, storefrontY, width - 24, 24, 5);
  layer.fillStyle(blendColor(teaWood, 0x101417, 0.24), 1);
  layer.fillRoundedRect(centerX - 12, storefrontY - 1, 24, 25, 5);
  layer.fillStyle(blendColor(teaWood, 0xffffff, 0.12), 0.88);
  layer.fillRoundedRect(centerX - 8, storefrontY + 2, 16, 18, 4);
  layer.fillStyle(blendColor(teaWood, 0x15110d, 0.18), 1);
  layer.fillRoundedRect(centerX - 11, storefrontY - 3, 22, 5, 2);
  layer.fillStyle(warmWindow, 0.95);
  layer.fillRoundedRect(worldX + 17, storefrontY + 3, 26, 17, 3);
  layer.fillRoundedRect(worldX + width - 43, storefrontY + 3, 26, 17, 3);
  layer.fillStyle(blendColor(warmWindow, 0xffffff, 0.16), 0.84);
  layer.fillRoundedRect(worldX + 20, storefrontY + 5, 20, 5, 2);
  layer.fillRoundedRect(worldX + width - 40, storefrontY + 5, 20, 5, 2);
  layer.fillStyle(creamTrim, 0.42);
  layer.fillRoundedRect(worldX + 24, storefrontY + 11, 12, 2, 1);
  layer.fillRoundedRect(worldX + width - 36, storefrontY + 11, 12, 2, 1);
  layer.fillStyle(0xe9d8ad, 0.9);
  layer.fillCircle(centerX + 5, storefrontY + 13, 1.5);
  layer.lineStyle(1.2, blendColor(teaTrim, 0x0c1114, 0.14), 0.34);
  layer.lineBetween(
    worldX + 30,
    storefrontY + 4,
    worldX + 30,
    storefrontY + 20,
  );
  layer.lineBetween(
    worldX + width - 30,
    storefrontY + 4,
    worldX + width - 30,
    storefrontY + 20,
  );
  drawTeaHouseWallLantern(layer, worldX + 28, storefrontY - 6);
  drawTeaHouseWallLantern(layer, worldX + width - 28, storefrontY - 6);
  layer.fillStyle(0x476a45, 0.96);
  layer.fillRoundedRect(worldX + 18, storefrontY - 11, 18, 3, 2);
  layer.fillRoundedRect(worldX + width - 36, storefrontY - 11, 18, 3, 2);
  layer.fillStyle(0x86ab6d, 0.92);
  layer.fillCircle(worldX + 22, storefrontY - 13, 3);
  layer.fillCircle(worldX + 29, storefrontY - 13, 3.2);
  layer.fillCircle(worldX + width - 23, storefrontY - 13, 3);
  layer.fillCircle(worldX + width - 29, storefrontY - 13, 3.2);

  layer.fillStyle(terraceStone, 0.98);
  layer.fillRoundedRect(worldX + 12, terraceY, width - 18, 24, 8);
  layer.fillStyle(blendColor(terraceStone, 0xffffff, 0.12), 1);
  layer.fillRoundedRect(worldX + 16, terraceY + 2, width - 26, 4, 3);
  layer.fillStyle(blendColor(terraceShadow, 0x1a1815, 0.1), 0.7);
  layer.fillRect(worldX + 16, terraceY + 20, width - 26, 2);
  layer.fillStyle(cafeRail, 0.96);
  layer.fillRoundedRect(worldX + 15, terraceY + 20, width - 22, 3, 2);
  for (const railX of [
    worldX + 20,
    worldX + 35,
    worldX + width - 42,
    worldX + width - 24,
  ]) {
    layer.fillRoundedRect(railX, terraceY + 11, 3, 13, 1.5);
  }
  layer.fillRoundedRect(worldX + 18, terraceY + 8, 26, 3, 2);
  layer.fillRoundedRect(worldX + width - 46, terraceY + 8, 26, 3, 2);

  drawTeaHouseCafeTable(
    layer,
    worldX + 34,
    terraceY + 13,
    teaWood,
    stripeGreen,
    terraceCloth,
    terraceAccent,
    true,
  );
  drawTeaHouseCafeTable(
    layer,
    worldX + 58,
    terraceY + 15,
    teaWood,
    teaTrim,
    terraceCloth,
    terraceAccent,
    false,
  );

  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(worldX + width - 19, terraceY + 4, 3, 16, 1.5);
  layer.fillRoundedRect(worldX + width - 27, terraceY + 8, 13, 9, 2);
  layer.fillStyle(stripeLight, 0.9);
  layer.fillRoundedRect(worldX + width - 24, terraceY + 10, 8, 1.5, 1);
  layer.fillRoundedRect(worldX + width - 24, terraceY + 13, 6, 1.5, 1);
  layer.fillStyle(terraceStone, 0.98);
  layer.fillRoundedRect(worldX + width - 6, terraceY - 1, 18, 26, 5);
  drawTeaHouseMenuBoard(
    layer,
    worldX + width + 4,
    terraceY + 11,
    menuBoard,
    menuFrame,
  );
  layer.fillStyle(cafeRail, 0.96);
  layer.fillRoundedRect(worldX + width + 4, terraceY + 20, 10, 3, 2);
  layer.fillRoundedRect(worldX + width + 8, terraceY + 9, 3, 14, 1.5);

  layer.fillStyle(teaWood, 0.98);
  layer.fillRoundedRect(centerX - 24, worldY + 22, 48, 10, 5);
  layer.fillStyle(0xf3e8cb, 0.96);
  layer.fillCircle(centerX - 12, worldY + 27, 3.6);
  layer.lineStyle(1.4, 0xf3e8cb, 0.96);
  layer.strokeCircle(centerX - 12, worldY + 27, 5.2);
  layer.lineBetween(centerX - 7.5, worldY + 27, centerX - 4.5, worldY + 27);
  layer.lineStyle(1.2, 0xf3e8cb, 0.54);
  layer.lineBetween(centerX - 15, worldY + 20, centerX - 13, worldY + 16);
  layer.lineBetween(centerX - 10, worldY + 20, centerX - 8, worldY + 16);

  layer.fillStyle(0x587a4e, 0.98);
  layer.fillRoundedRect(worldX + 18, planterY, 10, 7, 3);
  layer.fillRoundedRect(worldX + width - 28, planterY, 10, 7, 3);
  layer.fillRoundedRect(worldX + width + 1, terraceY + 19, 10, 7, 3);
  layer.fillStyle(0x2f4d34, 0.96);
  layer.fillCircle(worldX + 23, planterY - 3, 6);
  layer.fillCircle(worldX + width - 23, planterY - 3, 6);
  layer.fillCircle(worldX + width + 6, terraceY + 16, 6);
  layer.fillStyle(0x587a4e, 0.98);
  layer.fillRoundedRect(worldX + 12, terraceY + 19, 10, 7, 3);
  layer.fillStyle(0x2f4d34, 0.96);
  layer.fillCircle(worldX + 17, terraceY + 16, 6);
}

function drawTeaHouseWallLantern(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
) {
  layer.lineStyle(1.4, 0x5f4634, 0.92);
  layer.lineBetween(centerX - 2, centerY, centerX + 2, centerY);
  layer.lineBetween(centerX + 2, centerY, centerX + 5, centerY - 3);
  layer.fillStyle(0x2a3339, 0.98);
  layer.fillRoundedRect(centerX + 3, centerY - 8, 6, 8, 2);
  layer.fillStyle(0xf7e2b0, 0.92);
  layer.fillRoundedRect(centerX + 4.5, centerY - 6.5, 3, 4.5, 1.2);
}

function drawTeaHouseCafeTable(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  tableColor: number,
  chairColor: number,
  clothColor: number,
  accentColor: number,
  umbrella: boolean,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(centerX + 1, centerY + 10, 26, 9);
  if (umbrella) {
    layer.fillStyle(0xece9df, 0.96);
    layer.fillEllipse(centerX, centerY - 7, 18, 10);
    layer.fillStyle(accentColor, 0.96);
    layer.fillEllipse(centerX, centerY - 7, 8, 10);
    layer.fillStyle(tableColor, 0.94);
    layer.fillRoundedRect(centerX - 1, centerY - 7, 2, 18, 1);
  }
  layer.fillStyle(tableColor, 0.98);
  layer.fillCircle(centerX, centerY + 1, 6.3);
  layer.fillStyle(clothColor, 0.98);
  layer.fillCircle(centerX, centerY + 1, 4.6);
  layer.fillStyle(accentColor, 0.94);
  layer.fillCircle(centerX, centerY + 1, 1.6);
  layer.fillStyle(tableColor, 0.98);
  layer.fillRoundedRect(centerX - 1.4, centerY + 1, 2.8, 9, 1.2);
  layer.fillStyle(0xf7e9cf, 0.9);
  layer.fillCircle(centerX - 2.2, centerY - 0.5, 0.95);
  layer.fillCircle(centerX + 2.2, centerY - 0.5, 0.95);
  layer.fillStyle(chairColor, 0.98);
  layer.fillRoundedRect(centerX - 12, centerY - 2, 6, 6.2, 2);
  layer.fillRoundedRect(centerX + 6, centerY - 2, 6, 6.2, 2);
  layer.fillRoundedRect(centerX - 10.5, centerY + 8, 5.2, 2.5, 1);
  layer.fillRoundedRect(centerX + 5.3, centerY + 8, 5.2, 2.5, 1);
  layer.fillStyle(blendColor(chairColor, 0xffffff, 0.16), 0.62);
  layer.fillRoundedRect(centerX - 11, centerY - 1, 4, 1.6, 1);
  layer.fillRoundedRect(centerX + 7, centerY - 1, 4, 1.6, 1);
}

function drawTeaHouseMenuBoard(
  layer: PhaserType.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  boardColor: number,
  frameColor: number,
) {
  layer.fillStyle(0x000000, 0.14);
  layer.fillEllipse(centerX + 1, centerY + 10, 16, 7);
  layer.fillStyle(frameColor, 0.98);
  layer.fillRoundedRect(centerX - 5.5, centerY - 9, 11, 16, 2);
  layer.fillStyle(boardColor, 0.98);
  layer.fillRoundedRect(centerX - 4, centerY - 7.5, 8, 12, 1.5);
  layer.lineStyle(1.1, 0xe8dcc0, 0.55);
  layer.lineBetween(centerX - 2.5, centerY - 4.5, centerX + 2.5, centerY - 4.5);
  layer.lineBetween(centerX - 2.5, centerY - 1.5, centerX + 2.5, centerY - 1.5);
  layer.lineBetween(centerX - 2.5, centerY + 1.5, centerX + 2.5, centerY + 1.5);
  layer.lineStyle(1.2, frameColor, 0.94);
  layer.lineBetween(centerX - 1.5, centerY + 7, centerX - 4.5, centerY + 13);
  layer.lineBetween(centerX + 1.5, centerY + 7, centerX + 4.5, centerY + 13);
}

function drawLandmarkPurposeAccent(
  layer: PhaserType.GameObjects.Graphics,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  palette: ArchitecturalPalette,
) {
  const centerX = worldX + width / 2;

  switch (palette.profile) {
    case "boarding-house":
      layer.lineStyle(2, blendColor(palette.trim, 0xf2e7d4, 0.28), 0.6);
      layer.lineBetween(
        centerX - 20,
        worldY + height - 27,
        centerX - 20,
        worldY + height - 12,
      );
      layer.lineBetween(
        centerX + 20,
        worldY + height - 27,
        centerX + 20,
        worldY + height - 12,
      );
      layer.fillStyle(blendColor(palette.sign, 0xf6e6c8, 0.16), 0.98);
      layer.fillRoundedRect(centerX - 14, worldY + height - 30, 28, 8, 4);
      break;
    case "tea-house":
      layer.fillStyle(blendColor(palette.window, 0xfff8ea, 0.2), 0.22);
      layer.fillCircle(centerX - 18, worldY + height - 24, 4);
      layer.fillCircle(centerX + 18, worldY + height - 24, 4);
      layer.fillStyle(blendColor(palette.awning, 0xf5e8cf, 0.08), 1);
      layer.fillRoundedRect(centerX - 18, worldY + 13, 36, 8, 4);
      break;
    case "repair-stall":
      layer.lineStyle(2, blendColor(palette.trim, 0xf0eadf, 0.12), 0.56);
      layer.lineBetween(
        centerX - 6,
        worldY + height - 31,
        centerX + 6,
        worldY + height - 19,
      );
      layer.lineBetween(
        centerX - 6,
        worldY + height - 19,
        centerX + 6,
        worldY + height - 31,
      );
      layer.fillStyle(blendColor(palette.sign, 0xe8ded0, 0.12), 0.96);
      layer.fillRoundedRect(centerX + 18, worldY + height - 28, 18, 10, 4);
      break;
    default:
      break;
  }
}

function kenneyFacadeStyleForFootprint(footprint: MapFootprint) {
  const profile = resolveBuildingProfile(
    footprint.locationId,
    footprint.roofStyle,
    footprint.x,
    footprint.y,
  );

  switch (profile) {
    case "boarding-house":
      return {
        awning: [] as number[],
        base: [410, 411, 412, 413],
        mid: [373, 374, 375, 376],
        signFrame: KENNEY_SIGN_FRAMES[0],
        top: [336, 337, 338, 339],
      };
    case "tea-house":
      return {
        awning: [391, 392, 393, 394, 395],
        base: [377, 380, 381, 382, 379],
        mid: [377, 380, 381, 382, 379],
        signFrame: KENNEY_SIGN_FRAMES[1],
        top: [340, 341, 342, 380],
      };
    case "repair-stall":
      return {
        awning: [396, 397, 398, 399],
        base: [380, 381, 382, 383],
        mid: [343, 344, 345, 346],
        signFrame: KENNEY_SIGN_FRAMES[2],
        top: [336, 343, 344, 345],
      };
    case "freight-yard":
    case "warehouse":
      return {
        awning: [] as number[],
        base: [380, 381, 382, 383],
        mid: [373, 380, 381, 376],
        signFrame: KENNEY_SIGN_FRAMES[3],
        top: [336, 337, 338, 339],
      };
    case "moss-pier":
      return {
        awning: [396, 397, 398],
        base: [370, 371, 372, 377],
        mid: [370, 371, 372, 377],
        signFrame: KENNEY_SIGN_FRAMES[1],
        top: [333, 334, 335, 340],
      };
    case "rowhouse":
    default:
      return {
        awning: [] as number[],
        base: [407, 408, 409, 414],
        mid: [370, 371, 372, 377],
        signFrame: null as number | null,
        top: [333, 334, 335, 340],
      };
  }
}

export function drawFringeBlocks(
  layer: PhaserType.GameObjects.Graphics,
  map: MapSize,
) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapRight = mapLeft + map.width;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapBottom = mapTop + map.height;
  const northWest = worldGridToWorldOrigin(0.2, 0.6);
  const northEast = worldGridToWorldOrigin(mapRight + 1.1, 0.9);
  const eastRow = worldGridToWorldOrigin(mapRight + 0.4, mapTop + 5.8);
  const lowerSlip = worldGridToWorldOrigin(mapRight + 1.8, mapBottom - 1.2);
  const westTall = worldGridToWorldOrigin(0.6, mapTop + 6.1);
  const southWest = worldGridToWorldOrigin(2.4, mapBottom - 2.5);
  const northBandLeft = worldGridToWorldOrigin(mapLeft - 7.3, mapTop - 5.7);
  const northBandCenterLeft = worldGridToWorldOrigin(
    mapLeft - 1.3,
    mapTop - 5.9,
  );
  const northBandCenterRight = worldGridToWorldOrigin(
    mapLeft + 10.3,
    mapTop - 5.8,
  );
  const northBandRight = worldGridToWorldOrigin(mapRight + 1.1, mapTop - 5.4);
  const northAlleyShadow = worldGridToWorldOrigin(mapLeft + 6.6, mapTop - 4.6);

  const northWestPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: 1,
    seedY: 1,
    worldX: northWest.x,
    worldY: northWest.y,
    width: CELL * 4.7,
    height: CELL * 3.1,
  });
  const northEastPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: 1,
    worldX: northEast.x,
    worldY: northEast.y,
    width: CELL * 4.9,
    height: CELL * 2.8,
  });
  const eastPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: mapTop + 6,
    worldX: eastRow.x,
    worldY: eastRow.y,
    width: CELL * 2.8,
    height: CELL * 4.6,
  });
  drawArchitecturalMass(layer, {
    kind: "dock",
    seedX: mapRight + 2,
    seedY: mapBottom - 1,
    worldX: lowerSlip.x,
    worldY: lowerSlip.y,
    width: CELL * 2.5,
    height: CELL * 2.2,
  });
  const westTallPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: 2,
    seedY: mapTop + 6,
    worldX: westTall.x,
    worldY: westTall.y,
    width: CELL * 2.3,
    height: CELL * 4.9,
  });
  const northBandLeftPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft - 7,
    seedY: mapTop - 6,
    worldX: northBandLeft.x,
    worldY: northBandLeft.y,
    width: CELL * 5.4,
    height: CELL * 3.6,
  });
  const northBandCenterLeftPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft - 1,
    seedY: mapTop - 6,
    worldX: northBandCenterLeft.x,
    worldY: northBandCenterLeft.y,
    width: CELL * 4.2,
    height: CELL * 4.8,
  });
  const northBandCenterRightPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapLeft + 10,
    seedY: mapTop - 6,
    worldX: northBandCenterRight.x,
    worldY: northBandCenterRight.y,
    width: CELL * 4.6,
    height: CELL * 4.1,
  });
  const northBandRightPalette = drawArchitecturalMass(layer, {
    kind: "building",
    seedX: mapRight + 1,
    seedY: mapTop - 5,
    worldX: northBandRight.x,
    worldY: northBandRight.y,
    width: CELL * 4.9,
    height: CELL * 3.8,
  });
  drawArchitecturalMass(layer, {
    kind: "yard",
    seedX: 3,
    seedY: mapBottom - 2,
    worldX: southWest.x,
    worldY: southWest.y,
    width: CELL * 3.4,
    height: CELL * 2.2,
  });
  drawBuildingDetail(
    layer,
    northWest.x,
    northWest.y,
    CELL * 4.7,
    CELL * 3.1,
    northWestPalette,
  );
  drawBuildingDetail(
    layer,
    northEast.x,
    northEast.y,
    CELL * 4.9,
    CELL * 2.8,
    northEastPalette,
  );
  drawBuildingDetail(
    layer,
    eastRow.x,
    eastRow.y,
    CELL * 2.8,
    CELL * 4.6,
    eastPalette,
  );
  drawBuildingDetail(
    layer,
    westTall.x,
    westTall.y,
    CELL * 2.3,
    CELL * 4.9,
    westTallPalette,
  );
  drawBuildingDetail(
    layer,
    northBandLeft.x,
    northBandLeft.y,
    CELL * 5.4,
    CELL * 3.6,
    northBandLeftPalette,
  );
  drawBuildingDetail(
    layer,
    northBandCenterLeft.x,
    northBandCenterLeft.y,
    CELL * 4.2,
    CELL * 4.8,
    northBandCenterLeftPalette,
  );
  drawBuildingDetail(
    layer,
    northBandCenterRight.x,
    northBandCenterRight.y,
    CELL * 4.6,
    CELL * 4.1,
    northBandCenterRightPalette,
  );
  drawBuildingDetail(
    layer,
    northBandRight.x,
    northBandRight.y,
    CELL * 4.9,
    CELL * 3.8,
    northBandRightPalette,
  );
  drawDockDetail(
    layer,
    mapRight + 2,
    mapBottom - 1,
    lowerSlip.x,
    lowerSlip.y,
    0.7,
  );
  layer.fillStyle(0x071015, 0.22);
  layer.fillRoundedRect(
    northAlleyShadow.x,
    northAlleyShadow.y,
    CELL * 2.8,
    CELL * 4.4,
    12,
  );
  layer.fillStyle(0xf0d5a0, 0.06);
  layer.fillRect(
    northAlleyShadow.x + CELL * 1.28,
    northAlleyShadow.y + 26,
    5,
    CELL * 2.2,
  );
}

export function drawFringeProps(layer: PhaserType.GameObjects.Graphics, map: MapSize) {
  const mapLeft = VISUAL_MARGIN_TILES.left;
  const mapTop = VISUAL_MARGIN_TILES.top;
  const mapRight = mapLeft + map.width;
  const mapBottom = mapTop + map.height;
  const northLamp = worldGridToWorldOrigin(mapLeft - 1.6, mapTop + 4.6);
  const westTree = worldGridToWorldOrigin(mapLeft - 4.7, mapBottom - 1.2);
  const eastLamp = worldGridToWorldOrigin(mapRight + 3.1, mapTop + 8.4);
  const dockLamp = worldGridToWorldOrigin(mapRight + 1.4, mapBottom - 3.2);
  const laundry = worldGridToWorldOrigin(mapLeft - 1.2, mapTop + 7.2);
  const cratePile = worldGridToWorldOrigin(mapRight + 0.9, mapBottom - 2.3);
  const bollard = worldGridToWorldOrigin(mapRight + 1.2, mapBottom - 0.2);
  const signboard = worldGridToWorldOrigin(mapLeft + 11.2, mapTop - 1.5);
  const roofTank = worldGridToWorldOrigin(mapLeft - 4.4, mapTop - 2.2);
  const alleyLaundry = worldGridToWorldOrigin(mapLeft + 7.7, mapTop - 1.3);

  layer.lineStyle(3, 0xd3c89a, 0.5);
  layer.lineBetween(
    northLamp.x,
    northLamp.y + 10,
    northLamp.x,
    northLamp.y - 11,
  );
  layer.fillStyle(0xf0dca6, 0.44);
  layer.fillCircle(northLamp.x, northLamp.y - 13, 4);
  layer.lineBetween(eastLamp.x, eastLamp.y + 10, eastLamp.x, eastLamp.y - 11);
  layer.fillCircle(eastLamp.x, eastLamp.y - 13, 4);
  layer.lineBetween(dockLamp.x, dockLamp.y + 10, dockLamp.x, dockLamp.y - 11);
  layer.fillCircle(dockLamp.x, dockLamp.y - 13, 4);

  layer.fillStyle(0x2e5036, 0.78);
  layer.fillCircle(westTree.x - 5, westTree.y - 5, 7);
  layer.fillCircle(westTree.x + 5, westTree.y - 7, 8);
  layer.fillStyle(0x4a7651, 0.82);
  layer.fillCircle(westTree.x, westTree.y - 9, 11);
  layer.fillStyle(0x7d593d, 0.78);
  layer.fillRect(westTree.x - 2, westTree.y - 2, 4, 12);

  layer.lineStyle(2, 0xd8d2bf, 0.42);
  layer.lineBetween(
    laundry.x - 14,
    laundry.y - 10,
    laundry.x + 14,
    laundry.y - 10,
  );
  layer.fillStyle(0xc99172, 0.84);
  layer.fillRect(laundry.x - 11, laundry.y - 8, 6, 10);
  layer.fillStyle(0x8fb0ca, 0.82);
  layer.fillRect(laundry.x - 1, laundry.y - 8, 7, 11);

  layer.fillStyle(0x8e6a4b, 0.88);
  layer.fillRoundedRect(cratePile.x - 10, cratePile.y - 8, 11, 11, 3);
  layer.fillRoundedRect(cratePile.x + 1, cratePile.y - 5, 9, 9, 3);
  layer.lineStyle(1, 0xd8bf98, 0.18);
  layer.strokeRoundedRect(cratePile.x - 10, cratePile.y - 8, 11, 11, 3);
  layer.strokeRoundedRect(cratePile.x + 1, cratePile.y - 5, 9, 9, 3);

  layer.fillStyle(0x505a62, 0.9);
  layer.fillRoundedRect(bollard.x - 3, bollard.y - 4, 6, 11, 2);

  layer.fillStyle(0x7c6047, 0.9);
  layer.fillRoundedRect(signboard.x - 12, signboard.y - 5, 24, 10, 3);
  layer.lineStyle(1.6, 0xd8c19a, 0.2);
  layer.lineBetween(
    signboard.x - 8,
    signboard.y - 1,
    signboard.x + 8,
    signboard.y - 1,
  );

  layer.fillStyle(0x3b4853, 0.82);
  layer.fillRoundedRect(roofTank.x - 9, roofTank.y - 7, 18, 14, 4);
  layer.fillStyle(0x1e2a33, 0.3);
  layer.fillRoundedRect(roofTank.x - 6, roofTank.y - 4, 12, 3, 2);
  layer.lineStyle(1.6, 0x8696a2, 0.16);
  layer.lineBetween(
    roofTank.x - 4,
    roofTank.y + 7,
    roofTank.x - 6,
    roofTank.y + 14,
  );
  layer.lineBetween(
    roofTank.x + 4,
    roofTank.y + 7,
    roofTank.x + 6,
    roofTank.y + 14,
  );

  layer.lineStyle(2, 0xd9d1be, 0.3);
  layer.lineBetween(
    alleyLaundry.x - 14,
    alleyLaundry.y - 12,
    alleyLaundry.x + 14,
    alleyLaundry.y - 14,
  );
  layer.fillStyle(0xc68f72, 0.72);
  layer.fillRect(alleyLaundry.x - 9, alleyLaundry.y - 10, 5, 8);
  layer.fillStyle(0x8fa6c1, 0.72);
  layer.fillRect(alleyLaundry.x - 1, alleyLaundry.y - 11, 5, 9);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
