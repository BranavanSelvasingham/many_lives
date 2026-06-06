import type PhaserType from "phaser";

import { blendColor } from "@/lib/street/renderColor";
import {
  getNormalizedSkyLayerRect,
  getSkyLayerPhaseOffset,
} from "@/lib/street/skyLayers";
import type {
  VisualRect,
  VisualScene,
  VisualSceneCloudKind,
  VisualSceneWeatherKind,
  VisualSurfaceMaterialKind,
} from "@/lib/street/visualScenes";

type AuthoredVisualSceneObjects = {
  assetStructureNodes: PhaserType.GameObjects.GameObject[];
  assetTerrainNodes: PhaserType.GameObjects.GameObject[];
  scene: PhaserType.Scene;
  structureDetailLayer: PhaserType.GameObjects.Graphics;
  structureLayer: PhaserType.GameObjects.Graphics;
  terrainLayer: PhaserType.GameObjects.Graphics;
};

export function visualSceneTextureKey(sceneId: string) {
  return `visual-scene-${sceneId}-reference`;
}

export function renderAuthoredVisualScene(
  objects: AuthoredVisualSceneObjects,
  visualScene: VisualScene,
) {
  if (visualScene.id === "south-quay-v2") {
    drawFringeZones(objects.terrainLayer, visualScene);
    drawSurfaceZones(objects.terrainLayer, visualScene);
    drawV2LandmarkGroundArt(objects.terrainLayer, visualScene);
    drawHarborEdge(objects.terrainLayer, visualScene);
    drawV2LandmarkStructureArt(objects, visualScene);
    drawLandmarkModules(objects, visualScene);
    drawPropClusters(objects.structureDetailLayer, visualScene);
    drawV2AtmosphereAndLighting(objects.structureDetailLayer, visualScene);
    return;
  }

  const plateKey = visualSceneTextureKey(visualScene.id);

  drawAuthoredSceneGround(objects.terrainLayer, visualScene);
  drawAuthoredSceneStructures(objects.structureLayer, visualScene);

  if (
    visualScene.referencePlate.alpha > 0.001 &&
    objects.scene.textures.exists(plateKey)
  ) {
    const plate = objects.scene.add
      .image(
        visualScene.referencePlate.x,
        visualScene.referencePlate.y,
        plateKey,
      )
      .setOrigin(0, 0)
      .setAlpha(visualScene.referencePlate.alpha)
      .setDisplaySize(
        visualScene.referencePlate.width,
        visualScene.referencePlate.height,
      )
      .setDepth(12);
    objects.assetTerrainNodes.push(plate);
  }
}

function addLandmarkTextNode(
  objects: AuthoredVisualSceneObjects,
  config: {
    color: string;
    fontFamily: string;
    fontSize: number;
    fontStyle?: string;
    text: string;
    x: number;
    y: number;
  },
) {
  const label = objects.scene.add
    .text(config.x, config.y, config.text, {
      color: config.color,
      fontFamily: config.fontFamily,
      fontSize: `${Math.max(10, Math.round(config.fontSize))}px`,
      fontStyle: config.fontStyle ?? "700",
    })
    .setDepth(23)
    .setOrigin(0.5, 0.5);
  objects.assetStructureNodes.push(label);
}

function drawV2LandmarkGroundArt(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  drawV2LandmarkCastShadows(layer, visualScene);
  drawV2MacroCompositionPass(layer, visualScene);
  drawV2SurfaceAestheticPass(layer, visualScene);
  drawV2ComposedPavingPass(layer, visualScene);
  drawV2SquareGroundAccents(layer, visualScene);
  drawV2DockGroundWear(layer, visualScene);
}

function drawV2LandmarkCastShadows(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const landmark of visualScene.landmarks) {
    const { rect } = landmark;
    const shadowAlpha =
      landmark.style === "square"
        ? 0.06
        : landmark.style === "dock"
          ? 0.1
          : landmark.style === "courtyard"
            ? 0.035
            : 0.16;
    const offsetX =
      landmark.style === "dock" ? 10 : landmark.style === "courtyard" ? 12 : 18;
    const offsetY =
      landmark.style === "dock" ? 13 : landmark.style === "courtyard" ? 14 : 24;

    layer.fillStyle(0x071116, shadowAlpha);
    layer.fillRoundedRect(
      rect.x + offsetX,
      rect.y + offsetY,
      rect.width,
      rect.height,
      rect.radius ?? 20,
    );

    layer.fillStyle(0x061015, shadowAlpha * 0.42);
    layer.fillEllipse(
      rect.x + rect.width / 2 + offsetX * 1.5,
      rect.y + rect.height + offsetY * 0.82,
      rect.width * 0.92,
      Math.max(24, rect.height * 0.15),
    );
  }
}

function forEachSurfaceDraftCell(
  visualScene: VisualScene,
  callback: (cell: {
    col: number;
    height: number;
    kind: VisualSurfaceMaterialKind;
    row: number;
    width: number;
    x: number;
    y: number;
  }) => void,
) {
  const surface = visualScene.surfaceDraft;
  if (!surface) {
    return;
  }

  const cols = Math.max(1, Math.ceil(visualScene.width / surface.cellSize));
  const rows = Math.max(1, Math.ceil(visualScene.height / surface.cellSize));
  const overrideMap = new Map(
    surface.overrides.map((cell) => [`${cell.col}:${cell.row}`, cell.kind]),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const kind = overrideMap.get(`${col}:${row}`) ?? surface.baseKind;
      const x = col * surface.cellSize;
      const y = row * surface.cellSize;
      const width = Math.min(surface.cellSize, visualScene.width - x);
      const height = Math.min(surface.cellSize, visualScene.height - y);
      const terrainKind = getTerrainDraftKindAtPoint(
        visualScene,
        x + width / 2,
        y + height / 2,
      );

      if (terrainKind === "water") {
        continue;
      }

      callback({ col, height, kind, row, width, x, y });
    }
  }
}

function drawV2SurfaceAestheticPass(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  forEachSurfaceDraftCell(visualScene, (cell) => {
    const seed = cell.col * 29 + cell.row * 37;
    const centerX = cell.x + cell.width / 2;
    const centerY = cell.y + cell.height / 2;

    if (
      cell.kind === "paved_asphalt" ||
      cell.kind === "tiled_stone_road" ||
      cell.kind === "walkway"
    ) {
      const warmLine =
        cell.kind === "walkway"
          ? 0xf7ecd7
          : cell.kind === "tiled_stone_road"
            ? 0xe5d7bb
            : 0xd2c8b5;
      const coolJoint =
        cell.kind === "paved_asphalt"
          ? 0x5a6466
          : cell.kind === "walkway"
            ? 0xbca98a
            : 0xa99678;
      const tileAccent =
        cell.kind === "walkway"
          ? 0xf5e4c6
          : cell.kind === "tiled_stone_road"
            ? 0xdac8a5
            : 0x7f8887;
      const tileShadow =
        cell.kind === "paved_asphalt"
          ? 0x343d40
          : cell.kind === "walkway"
            ? 0x927d5c
            : 0x897659;

      if (seed % 2 === 0) {
        layer.fillStyle(tileAccent, 0.034);
        layer.fillRoundedRect(
          cell.x + 4 + (seed % 7),
          cell.y + 5 + ((seed + 3) % 9),
          Math.max(18, cell.width * (0.34 + (seed % 4) * 0.03)),
          Math.max(8, cell.height * 0.16),
          5,
        );
      }
      if (seed % 5 === 0) {
        layer.fillStyle(tileShadow, 0.03);
        layer.fillRoundedRect(
          cell.x + cell.width * 0.42 + ((seed + 5) % 8),
          cell.y + cell.height * 0.58 + ((seed + 1) % 5),
          Math.max(16, cell.width * 0.32),
          Math.max(6, cell.height * 0.13),
          5,
        );
      }

      layer.lineStyle(1.1, warmLine, 0.1);
      layer.lineBetween(
        cell.x + 6,
        cell.y + 8 + (seed % 9),
        cell.x + cell.width - 7,
        cell.y + 7 + ((seed + 3) % 9),
      );
      layer.lineStyle(1, coolJoint, 0.11);
      layer.lineBetween(
        cell.x + 8 + (seed % 7),
        cell.y + cell.height - 8,
        cell.x + cell.width - 8,
        cell.y + cell.height - 10 + ((seed + 5) % 6),
      );

      if (seed % 4 === 0) {
        layer.fillStyle(0x6f5e49, 0.035);
        layer.fillEllipse(
          centerX + Math.sin(seed) * 8,
          centerY + Math.cos(seed * 0.7) * 8,
          26 + (seed % 14),
          4,
        );
      }

      if (
        cell.y > visualScene.height * 0.74 ||
        cell.x > visualScene.width - 320
      ) {
        layer.fillStyle(0x315e66, 0.052);
        layer.fillEllipse(
          centerX + Math.sin(seed * 0.4) * 12,
          centerY + Math.cos(seed * 0.2) * 10,
          34 + (seed % 18),
          7,
        );
      }

      if (cell.kind !== "paved_asphalt" && seed % 7 === 1) {
        layer.lineStyle(1, 0xfff4d0, 0.08);
        layer.lineBetween(
          cell.x + 10,
          cell.y + 12,
          cell.x + 22 + (seed % 19),
          cell.y + 11 + ((seed + 7) % 11),
        );
      }
    }

    if (cell.kind === "trees" || cell.kind === "bushes") {
      layer.fillStyle(0x071116, cell.kind === "trees" ? 0.12 : 0.08);
      layer.fillEllipse(centerX + 8, centerY + 12, cell.width * 0.72, 15);
    }

    if (cell.kind === "grass") {
      layer.lineStyle(1.2, 0xb7ce8e, 0.1);
      layer.lineBetween(
        cell.x + 7,
        centerY - 4 + (seed % 8),
        cell.x + cell.width - 8,
        centerY - 8 + ((seed + 3) % 10),
      );
    }
  });
}

function drawV2MacroCompositionPass(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const square = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "market-square",
  );
  const cafe = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "tea-house",
  );
  const boardingHouse = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "boarding-house",
  );
  const freightYard = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "freight-yard",
  );
  const pier = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "moss-pier",
  );

  if (boardingHouse && cafe) {
    const y = Math.max(
      boardingHouse.rect.y + boardingHouse.rect.height + 8,
      602,
    );
    layer.fillStyle(0xffefca, 0.05);
    layer.fillRoundedRect(
      boardingHouse.rect.x + boardingHouse.rect.width * 0.4,
      y,
      cafe.rect.x + cafe.rect.width - boardingHouse.rect.x,
      86,
      26,
    );
    layer.fillStyle(0x18232a, 0.055);
    layer.fillRoundedRect(
      boardingHouse.rect.x + boardingHouse.rect.width * 0.44,
      y + 76,
      cafe.rect.x + cafe.rect.width - boardingHouse.rect.x - 24,
      12,
      6,
    );
  }

  if (square) {
    const centerX = square.rect.x + square.rect.width / 2;
    const centerY = square.rect.y + square.rect.height / 2;
    layer.fillStyle(0xffefd2, 0.065);
    layer.fillEllipse(
      centerX,
      centerY + 24,
      square.rect.width * 1.72,
      square.rect.height * 1.56,
    );
    layer.fillStyle(0x162025, 0.055);
    layer.fillEllipse(
      centerX + 24,
      centerY + square.rect.height * 0.6,
      square.rect.width * 1.35,
      38,
    );
  }

  if (freightYard && pier) {
    layer.fillStyle(0x28444a, 0.05);
    layer.fillRoundedRect(
      freightYard.rect.x - 64,
      freightYard.rect.y + freightYard.rect.height - 18,
      pier.rect.x + pier.rect.width - freightYard.rect.x + 72,
      Math.max(
        102,
        pier.rect.y - freightYard.rect.y - freightYard.rect.height + 64,
      ),
      28,
    );
    layer.fillStyle(0xffe0a4, 0.04);
    layer.fillRoundedRect(
      freightYard.rect.x - 26,
      freightYard.rect.y + freightYard.rect.height + 28,
      Math.max(420, pier.rect.width + 60),
      28,
      14,
    );
  }

  layer.fillStyle(0x071116, 0.075);
  layer.fillRoundedRect(
    0,
    visualScene.height * 0.91,
    visualScene.width,
    visualScene.height * 0.09,
    0,
  );
}

function drawV2ComposedPavingPass(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const square = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "market-square",
  );
  const boardingHouse = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "boarding-house",
  );
  const cafe = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "tea-house",
  );
  const freightYard = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "freight-yard",
  );
  const pier = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "moss-pier",
  );

  const pavingBands: VisualRect[] = [];
  if (boardingHouse && cafe) {
    pavingBands.push({
      x: boardingHouse.rect.x + boardingHouse.rect.width * 0.42,
      y: Math.min(
        boardingHouse.rect.y + boardingHouse.rect.height + 20,
        cafe.rect.y + cafe.rect.height + 18,
      ),
      width:
        cafe.rect.x +
        cafe.rect.width -
        (boardingHouse.rect.x + boardingHouse.rect.width * 0.42),
      height: 72,
      radius: 24,
    });
  }
  if (square) {
    pavingBands.push({
      x: square.rect.x - 154,
      y: square.rect.y + square.rect.height + 20,
      width: square.rect.width + 308,
      height: 94,
      radius: 28,
    });
  }
  if (freightYard && pier) {
    pavingBands.push({
      x: freightYard.rect.x - 42,
      y: Math.min(
        freightYard.rect.y + freightYard.rect.height + 18,
        pier.rect.y - 76,
      ),
      width: Math.max(
        pier.rect.x + pier.rect.width - freightYard.rect.x + 30,
        420,
      ),
      height: 92,
      radius: 26,
    });
  }

  for (const band of pavingBands) {
    layer.fillStyle(0xf2dfbb, 0.045);
    layer.fillRoundedRect(
      band.x,
      band.y,
      band.width,
      band.height,
      band.radius ?? 18,
    );
    layer.lineStyle(2.2, 0xffefc8, 0.14);
    layer.lineBetween(
      band.x + 18,
      band.y + 9,
      band.x + band.width - 18,
      band.y + 5,
    );
    layer.lineStyle(2.4, 0x6e5f4e, 0.085);
    layer.lineBetween(
      band.x + 20,
      band.y + band.height - 7,
      band.x + band.width - 18,
      band.y + band.height - 11,
    );

    for (let x = band.x + 26; x < band.x + band.width - 18; x += 46) {
      const seed = Math.round(x + band.y * 0.5);
      layer.lineStyle(1, 0xa99370, 0.09);
      layer.lineBetween(
        x,
        band.y + 16 + (seed % 8),
        x + 14,
        band.y + band.height - 18 - ((seed + 5) % 10),
      );
    }
  }

  for (const anchors of Object.values(visualScene.locationAnchors)) {
    layer.fillStyle(0x071116, 0.055);
    layer.fillEllipse(anchors.frontage.x + 12, anchors.frontage.y + 18, 96, 18);
    layer.fillStyle(0xffedc3, 0.055);
    layer.fillEllipse(anchors.frontage.x - 6, anchors.frontage.y + 4, 78, 12);
  }
}

function drawV2SquareGroundAccents(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const square = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "market-square",
  );
  if (!square) {
    return;
  }

  const { rect } = square;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  layer.lineStyle(2, 0xf4ead0, 0.22);
  layer.strokeRoundedRect(
    rect.x + 12,
    rect.y + 12,
    rect.width - 24,
    rect.height - 24,
    Math.max(12, (rect.radius ?? 24) - 8),
  );
  layer.lineStyle(1.2, 0x9d8763, 0.18);
  for (
    let inset = 34;
    inset < Math.min(rect.width, rect.height) / 2;
    inset += 26
  ) {
    layer.strokeRoundedRect(
      rect.x + inset,
      rect.y + inset * 0.52,
      rect.width - inset * 2,
      rect.height - inset,
      14,
    );
  }

  layer.fillStyle(0xfff3cf, 0.08);
  layer.fillEllipse(centerX - 16, centerY - 10, rect.width * 0.72, 28);
}

function drawV2DockGroundWear(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const yard = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "freight-yard",
  );
  const pier = visualScene.landmarks.find(
    (landmark) => landmark.locationId === "moss-pier",
  );

  if (yard) {
    const { rect } = yard;
    layer.lineStyle(3, 0x4d463c, 0.14);
    for (let index = 0; index < 5; index += 1) {
      const y = rect.y + rect.height + 28 + index * 10;
      layer.lineBetween(rect.x + 34, y, rect.x + rect.width - 36, y + 18);
    }
    layer.fillStyle(0x6e5136, 0.1);
    layer.fillEllipse(
      rect.x + rect.width * 0.52,
      rect.y + rect.height + 44,
      156,
      18,
    );
  }

  if (pier) {
    const { rect } = pier;
    layer.fillStyle(0x2e5e63, 0.09);
    layer.fillRoundedRect(rect.x - 18, rect.y - 18, rect.width + 36, 26, 8);
    layer.lineStyle(2, 0xefe0b8, 0.2);
    for (let x = rect.x + 22; x < rect.x + rect.width - 18; x += 54) {
      layer.lineBetween(x, rect.y - 8, x + 18, rect.y - 4);
    }
  }
}

function drawV2LandmarkStructureArt(
  objects: AuthoredVisualSceneObjects,
  visualScene: VisualScene,
) {
  const layer = objects.structureLayer;
  for (const landmark of visualScene.landmarks) {
    if (
      landmark.locationId === "market-square" ||
      landmark.style === "square"
    ) {
      drawQuaySquareHeroArt(layer, landmark.rect);
      continue;
    }

    if (landmark.style === "courtyard") {
      continue;
    }

    if (landmark.style === "cafe") {
      drawTeaHouseHeroArt(layer, landmark.rect);
      continue;
    }

    if (landmark.style === "boarding-house") {
      drawBoardingHouseHeroArt(layer, landmark.rect);
      addLandmarkTextNode(objects, {
        color: "#f4ead2",
        fontFamily: "Georgia, serif",
        fontSize: 14,
        text: "BOARDING HOUSE",
        x: landmark.rect.x + landmark.rect.width / 2,
        y: landmark.rect.y + 27,
      });
      continue;
    }

    drawV2GenericLandmarkArt(layer, landmark);
  }
}

function drawTeaHouseHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const roofHeight = Math.max(24, Math.min(42, rect.height * 0.18));
  const lowerBandHeight = Math.max(26, rect.height * 0.16);
  const awningY = rect.y + roofHeight + rect.height * 0.36;
  layer.fillStyle(0xf0e4cd, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.fillStyle(0xb08c66, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    roofHeight,
    rect.radius ?? 18,
  );
  layer.fillStyle(0xfff3d6, 0.18);
  layer.fillRoundedRect(rect.x + 22, rect.y + 8, rect.width - 44, 7, 4);
  layer.lineStyle(2, 0x6f795b, 0.28);
  for (let x = rect.x + 30; x < rect.x + rect.width - 24; x += 34) {
    layer.lineBetween(x, rect.y + 8, x + 8, rect.y + roofHeight - 8);
  }
  layer.fillStyle(0xffffff, 0.52);
  layer.fillRoundedRect(
    rect.x + 42,
    rect.y + roofHeight + 12,
    rect.width - 84,
    10,
    5,
  );
  layer.fillStyle(0xf6eddc, 1);
  layer.fillRoundedRect(
    rect.x + 17,
    rect.y + roofHeight + 18,
    rect.width - 34,
    Math.max(54, rect.height - roofHeight - lowerBandHeight - 28),
    Math.max(16, (rect.radius ?? 20) - 4),
  );
  layer.lineStyle(3, 0xa78661, 0.18);
  layer.strokeRoundedRect(
    rect.x + 17,
    rect.y + roofHeight + 18,
    rect.width - 34,
    Math.max(54, rect.height - roofHeight - lowerBandHeight - 28),
    Math.max(16, (rect.radius ?? 20) - 4),
  );
  layer.fillStyle(0x315241, 0.9);
  layer.fillRoundedRect(rect.x + 34, awningY, rect.width - 68, 22, 9);
  layer.fillStyle(0xf4ead3, 0.92);
  for (let index = 0; index < 7; index += 1) {
    const scallopX = rect.x + 48 + index * ((rect.width - 96) / 6);
    layer.fillCircle(scallopX, awningY + 22, 9);
  }
  layer.fillStyle(0x071116, 0.12);
  layer.fillRoundedRect(rect.x + 38, awningY + 24, rect.width - 76, 8, 4);
  layer.fillStyle(0x79583a, 0.12);
  layer.fillRoundedRect(
    rect.x + 32,
    rect.y + rect.height - lowerBandHeight - 22,
    rect.width - 64,
    14,
    7,
  );
  layer.fillStyle(0x815d3f, 1);
  layer.fillRect(
    rect.x + 9,
    rect.y + rect.height - lowerBandHeight - 10,
    rect.width - 18,
    lowerBandHeight,
  );
  layer.fillStyle(0x6a4d35, 1);
  layer.fillRoundedRect(
    rect.x + 27,
    rect.y + rect.height - 24,
    rect.width - 54,
    12,
    6,
  );
  layer.fillStyle(0xffdda0, 0.16);
  layer.fillEllipse(
    rect.x + rect.width / 2,
    rect.y + rect.height - 34,
    rect.width * 0.58,
    18,
  );
}

function drawBoardingHouseHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const roofHeight = Math.max(28, Math.min(56, rect.height * 0.24));
  const lowerBandHeight = Math.max(40, rect.height * 0.22);
  const signWidth = Math.min(228, rect.width - 112);
  const signX = rect.x + (rect.width - signWidth) / 2;
  layer.fillStyle(0xd8c7b6, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 20,
  );
  layer.fillStyle(0x89949c, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    roofHeight,
    rect.radius ?? 18,
  );
  layer.lineStyle(1.8, 0xe7edf0, 0.18);
  for (let x = rect.x + 22; x < rect.x + rect.width - 22; x += 36) {
    layer.lineBetween(x, rect.y + 8, x + 9, rect.y + roofHeight - 9);
  }
  layer.fillStyle(0x4d5961, 1);
  layer.fillRoundedRect(signX, rect.y + 12, signWidth, 34, 12);
  layer.lineStyle(3, 0xd5bd88, 1);
  layer.strokeRoundedRect(signX, rect.y + 12, signWidth, 34, 12);
  layer.fillStyle(0xffffff, 0.1);
  layer.fillRoundedRect(signX + 14, rect.y + 18, signWidth - 28, 7, 3.5);
  layer.fillStyle(0xe3d7c9, 1);
  layer.fillRoundedRect(
    rect.x + 14,
    rect.y + roofHeight + 10,
    rect.width - 28,
    Math.max(86, rect.height * 0.34),
    16,
  );
  layer.lineStyle(3, 0x7a614e, 0.12);
  layer.strokeRoundedRect(
    rect.x + 14,
    rect.y + roofHeight + 10,
    rect.width - 28,
    Math.max(86, rect.height * 0.34),
    16,
  );
  layer.fillStyle(0xcfb9a5, 1);
  layer.fillRoundedRect(
    rect.x + 20,
    rect.y + rect.height - lowerBandHeight - Math.max(92, rect.height * 0.28),
    rect.width - 40,
    Math.max(72, rect.height * 0.26),
    14,
  );
  layer.lineStyle(3, 0x755642, 0.12);
  layer.strokeRoundedRect(
    rect.x + 20,
    rect.y + rect.height - lowerBandHeight - Math.max(92, rect.height * 0.28),
    rect.width - 40,
    Math.max(72, rect.height * 0.26),
    14,
  );
  layer.fillStyle(0xa67961, 1);
  layer.fillRect(
    rect.x + 9,
    rect.y + rect.height - lowerBandHeight - 10,
    rect.width - 18,
    lowerBandHeight,
  );
  layer.lineStyle(2, 0x79553f, 0.26);
  for (
    let y = rect.y + roofHeight + 32;
    y < rect.y + rect.height - 54;
    y += 42
  ) {
    layer.lineBetween(rect.x + 28, y, rect.x + rect.width - 30, y + 3);
  }
  layer.fillStyle(0xffe2a3, 0.09);
  layer.fillEllipse(
    rect.x + rect.width / 2 - 10,
    rect.y + rect.height - 48,
    120,
    18,
  );
}

function drawQuaySquareHeroArt(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const inset = 22;
  const innerRect = {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  };
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const crossWidth = Math.max(54, rect.width * 0.16);
  const crossHeight = Math.max(54, rect.height * 0.16);
  const civicRadius = Math.min(rect.width, rect.height) * 0.18;
  layer.fillStyle(0xd7c7a6, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 30,
  );
  layer.lineStyle(4, 0xf4ead3, 0.28);
  layer.strokeRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 30,
  );
  layer.fillStyle(0xccb993, 1);
  layer.fillRoundedRect(
    innerRect.x,
    innerRect.y,
    innerRect.width,
    innerRect.height,
    24,
  );
  layer.lineStyle(3, 0x9a805c, 0.18);
  layer.strokeRoundedRect(
    innerRect.x,
    innerRect.y,
    innerRect.width,
    innerRect.height,
    24,
  );
  layer.fillStyle(0xe7dcc3, 1);
  layer.fillRoundedRect(
    centerX - crossWidth / 2,
    innerRect.y + 31,
    crossWidth,
    innerRect.height - 62,
    22,
  );
  layer.fillRoundedRect(
    innerRect.x + 31,
    centerY - crossHeight / 2,
    innerRect.width - 62,
    crossHeight,
    22,
  );
  layer.lineStyle(1.4, 0xf7edcf, 0.24);
  for (let index = 0; index < 5; index += 1) {
    const offset = (index - 2) * 26;
    layer.lineBetween(
      innerRect.x + 38,
      centerY + offset,
      innerRect.x + innerRect.width - 38,
      centerY + offset * 0.82,
    );
  }
  layer.fillStyle(0xb8a17a, 1);
  layer.fillCircle(centerX, centerY, civicRadius + 26);
  layer.fillStyle(0xe9dfcc, 1);
  layer.fillCircle(centerX, centerY, civicRadius + 16);
  layer.fillStyle(0xa9b3b9, 1);
  layer.fillCircle(centerX, centerY, civicRadius);
  layer.fillStyle(0xd8ecf5, 1);
  layer.fillCircle(centerX, centerY, civicRadius * 0.58);
  layer.fillStyle(0xffffff, 0.36);
  layer.fillCircle(centerX, centerY - civicRadius * 0.16, civicRadius * 0.24);
  layer.fillStyle(0xd8f7ff, 0.18);
  layer.fillEllipse(
    centerX + 3,
    centerY + 3,
    civicRadius * 1.35,
    civicRadius * 0.58,
  );
  layer.lineStyle(1.6, 0xf8ffff, 0.34);
  layer.strokeEllipse(centerX, centerY, civicRadius * 1.58, civicRadius * 0.82);
  layer.fillStyle(0x9c8760, 1);
  layer.fillRoundedRect(
    innerRect.x + 42,
    innerRect.y + 26,
    innerRect.width - 84,
    16,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + 42,
    innerRect.y + innerRect.height - 42,
    innerRect.width - 84,
    16,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + 26,
    innerRect.y + 42,
    16,
    innerRect.height - 84,
    8,
  );
  layer.fillRoundedRect(
    innerRect.x + innerRect.width - 42,
    innerRect.y + 42,
    16,
    innerRect.height - 84,
    8,
  );
}

function drawV2GenericLandmarkArt(
  layer: PhaserType.GameObjects.Graphics,
  landmark: VisualScene["landmarks"][number],
) {
  const roofFill =
    landmark.style === "workshop"
      ? 0x5a6670
      : landmark.style === "dock"
        ? 0x8d6d47
        : landmark.style === "yard"
          ? 0x6d675d
          : landmark.style === "courtyard"
            ? 0x7c8b63
            : 0xd6c7a9;
  const bodyFill =
    landmark.style === "workshop"
      ? 0x9e8667
      : landmark.style === "dock"
        ? 0x866444
        : landmark.style === "yard"
          ? 0x7b776d
          : landmark.style === "courtyard"
            ? 0x72825f
            : 0xddd1b8;
  const lowerBand =
    landmark.style === "workshop"
      ? 0x6e5b46
      : landmark.style === "dock"
        ? 0x76563b
        : landmark.style === "yard"
          ? 0x4d4a45
          : 0xa99c7d;
  const roofHeight = Math.max(28, Math.min(56, landmark.rect.height * 0.24));
  const lowerBandHeight = Math.max(40, landmark.rect.height * 0.22);
  const isDockyard = landmark.locationId === "freight-yard";
  const isRepairStall = landmark.locationId === "repair-stall";
  const dockyardCargoWidth = isDockyard
    ? Math.max(78, landmark.rect.width * 0.28)
    : 0;
  const dockyardCargoHeight = isDockyard
    ? Math.max(104, landmark.rect.height * 0.5)
    : 0;
  const dockyardCargoX =
    landmark.rect.x + landmark.rect.width - dockyardCargoWidth - 38;
  const dockyardCargoY =
    landmark.rect.y +
    landmark.rect.height -
    lowerBandHeight -
    dockyardCargoHeight -
    18;

  layer.fillStyle(bodyFill, 1);
  layer.fillRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    landmark.rect.height,
    landmark.rect.radius ?? 20,
  );
  layer.lineStyle(4, 0xf4ead3, 0.35);
  layer.strokeRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    landmark.rect.height,
    landmark.rect.radius ?? 20,
  );
  layer.fillStyle(roofFill, 1);
  layer.fillRoundedRect(
    landmark.rect.x,
    landmark.rect.y,
    landmark.rect.width,
    roofHeight,
    landmark.rect.radius ?? 18,
  );
  layer.lineStyle(2, 0xf2dfb8, 0.12);
  for (
    let x = landmark.rect.x + 20;
    x < landmark.rect.x + landmark.rect.width - 20;
    x += 42
  ) {
    layer.lineBetween(
      x,
      landmark.rect.y + 9,
      x + 7,
      landmark.rect.y + roofHeight - 8,
    );
  }

  if (isDockyard) {
    layer.fillStyle(0x8a8376, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 17,
      landmark.rect.y + roofHeight + 18,
      landmark.rect.width - 34,
      Math.max(64, landmark.rect.height * 0.28),
      14,
    );
    layer.lineStyle(3, 0x292622, 0.16);
    layer.strokeRoundedRect(
      landmark.rect.x + 17,
      landmark.rect.y + roofHeight + 18,
      landmark.rect.width - 34,
      Math.max(64, landmark.rect.height * 0.28),
      14,
    );
    layer.fillStyle(0xd8ccb2, 0.2);
    layer.fillRoundedRect(
      landmark.rect.x + 45,
      landmark.rect.y + roofHeight + 28,
      landmark.rect.width - 90,
      10,
      5,
    );
    layer.fillStyle(0x5a564f, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y +
        landmark.rect.height -
        lowerBandHeight -
        Math.max(96, landmark.rect.height * 0.34),
      landmark.rect.width - 44,
      Math.max(74, landmark.rect.height * 0.32),
      16,
    );
    layer.lineStyle(3, 0xe8d8bb, 0.1);
    layer.strokeRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y +
        landmark.rect.height -
        lowerBandHeight -
        Math.max(96, landmark.rect.height * 0.34),
      landmark.rect.width - 44,
      Math.max(74, landmark.rect.height * 0.32),
      16,
    );
    layer.fillStyle(0xc6923d, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 35,
      landmark.rect.y + landmark.rect.height - lowerBandHeight - 26,
      landmark.rect.width - 70,
      10,
      5,
    );
  }

  if (isRepairStall) {
    const bayY = landmark.rect.y + roofHeight + 28;
    layer.fillStyle(0x18242a, 0.42);
    layer.fillRoundedRect(
      landmark.rect.x + 34,
      bayY,
      landmark.rect.width - 68,
      Math.max(70, landmark.rect.height * 0.36),
      16,
    );
    layer.fillStyle(0xb89062, 0.82);
    layer.fillRoundedRect(
      landmark.rect.x + 48,
      bayY + Math.max(42, landmark.rect.height * 0.22),
      landmark.rect.width - 96,
      16,
      7,
    );
    layer.lineStyle(2.5, 0xcfd8dc, 0.28);
    for (
      let x = landmark.rect.x + 62;
      x < landmark.rect.x + landmark.rect.width - 64;
      x += 38
    ) {
      layer.lineBetween(x, bayY + 12, x - 6, bayY + 48);
      layer.lineBetween(x - 6, bayY + 48, x + 9, bayY + 48);
    }
    layer.fillStyle(0xffd796, 0.08);
    layer.fillEllipse(
      landmark.rect.x + landmark.rect.width / 2,
      bayY + 48,
      landmark.rect.width * 0.72,
      22,
    );
  }

  layer.fillStyle(lowerBand, 1);
  layer.fillRect(
    landmark.rect.x + 9,
    landmark.rect.y + landmark.rect.height - lowerBandHeight - 10,
    landmark.rect.width - 18,
    lowerBandHeight,
  );

  if (isDockyard) {
    layer.fillStyle(0x0c0e0f, 0.18);
    layer.fillEllipse(
      dockyardCargoX + dockyardCargoWidth / 2,
      dockyardCargoY + dockyardCargoHeight - 2,
      dockyardCargoWidth * 1.04,
      Math.max(18, dockyardCargoHeight * 0.16),
    );
    layer.fillStyle(0x65513b, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.08,
      dockyardCargoY +
        dockyardCargoHeight -
        Math.max(16, dockyardCargoHeight * 0.14),
      dockyardCargoWidth * 0.84,
      Math.max(10, dockyardCargoHeight * 0.1),
      4,
    );
    layer.fillStyle(0x4e5961, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.54,
      dockyardCargoY + dockyardCargoHeight * 0.18,
      dockyardCargoWidth * 0.38,
      dockyardCargoHeight * 0.54,
      10,
    );
    layer.lineStyle(3, 0xf0e5cb, 0.14);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.54,
      dockyardCargoY + dockyardCargoHeight * 0.18,
      dockyardCargoWidth * 0.38,
      dockyardCargoHeight * 0.54,
      10,
    );
    layer.fillStyle(0xffffff, 0.1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.61,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.24,
      8,
      4,
    );
    layer.lineStyle(3, 0x262a2d, 0.44);
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.64,
      dockyardCargoY + dockyardCargoHeight * 0.22,
      dockyardCargoX + dockyardCargoWidth * 0.64,
      dockyardCargoY + dockyardCargoHeight * 0.68,
    );
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.79,
      dockyardCargoY + dockyardCargoHeight * 0.22,
      dockyardCargoX + dockyardCargoWidth * 0.79,
      dockyardCargoY + dockyardCargoHeight * 0.68,
    );
    layer.fillStyle(0x866448, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.04,
      dockyardCargoY + dockyardCargoHeight * 0.52,
      dockyardCargoWidth * 0.44,
      dockyardCargoHeight * 0.24,
      9,
    );
    layer.lineStyle(3, 0xeedcb7, 0.12);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.04,
      dockyardCargoY + dockyardCargoHeight * 0.52,
      dockyardCargoWidth * 0.44,
      dockyardCargoHeight * 0.24,
      9,
    );
    layer.fillStyle(0xe8cda2, 0.16);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.1,
      dockyardCargoY + dockyardCargoHeight * 0.58,
      dockyardCargoWidth * 0.3,
      7,
      3.5,
    );
    layer.lineStyle(2.5, 0x583c25, 0.4);
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.14,
      dockyardCargoY + dockyardCargoHeight * 0.54,
      dockyardCargoX + dockyardCargoWidth * 0.14,
      dockyardCargoY + dockyardCargoHeight * 0.74,
    );
    layer.lineBetween(
      dockyardCargoX + dockyardCargoWidth * 0.31,
      dockyardCargoY + dockyardCargoHeight * 0.54,
      dockyardCargoX + dockyardCargoWidth * 0.31,
      dockyardCargoY + dockyardCargoHeight * 0.74,
    );
    layer.fillStyle(0xa17d53, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.18,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.28,
      dockyardCargoHeight * 0.18,
      8,
    );
    layer.lineStyle(3, 0xf8e9c8, 0.1);
    layer.strokeRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.18,
      dockyardCargoY + dockyardCargoHeight * 0.24,
      dockyardCargoWidth * 0.28,
      dockyardCargoHeight * 0.18,
      8,
    );
    layer.fillStyle(0xa98050, 1);
    layer.fillRoundedRect(
      dockyardCargoX + dockyardCargoWidth * 0.22,
      dockyardCargoY + dockyardCargoHeight * 0.31,
      dockyardCargoWidth * 0.16,
      8,
      4,
    );
    layer.fillStyle(0x1f2528, 0.38);
    layer.fillRoundedRect(
      landmark.rect.x + 54,
      landmark.rect.y + landmark.rect.height - 22,
      landmark.rect.width - 108,
      8,
      4,
    );
    layer.lineStyle(2, 0xcc9d62, 0.32);
    for (
      let x = landmark.rect.x + 66;
      x < landmark.rect.x + landmark.rect.width - 66;
      x += 42
    ) {
      layer.lineBetween(
        x,
        landmark.rect.y + landmark.rect.height - 22,
        x + 18,
        landmark.rect.y + landmark.rect.height - 15,
      );
    }
    layer.fillStyle(0x4c4841, 1);
    layer.fillRoundedRect(
      landmark.rect.x + 22,
      landmark.rect.y + 12,
      10,
      landmark.rect.height - 26,
      6,
    );
    layer.fillRoundedRect(
      landmark.rect.x + landmark.rect.width - 32,
      landmark.rect.y + 12,
      10,
      landmark.rect.height - 26,
      6,
    );
  }
}

function drawSurfaceZones(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const hasTerrainDraft = drawTerrainDraftGround(layer, visualScene);
  if (!hasTerrainDraft) {
    layer.fillStyle(0x111d23, 1);
    layer.fillRect(0, 0, visualScene.width, visualScene.height);
  }

  const hasSurfaceDraft = drawSurfaceDraft(layer, visualScene);

  for (const zone of visualScene.surfaceZones) {
    if (
      hasSurfaceDraft &&
      (zone.kind === "main_street" ||
        zone.kind === "north_promenade" ||
        zone.kind === "service_lane" ||
        zone.kind === "square_border" ||
        zone.kind === "square_center" ||
        zone.kind === "west_lane")
    ) {
      continue;
    }

    const { rect } = zone;

    switch (zone.kind) {
      case "north_promenade":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd8c9a9,
          base: 0xd1c1a1,
          emphasis: zone.emphasis ?? "medium",
          joint: 0xb4a27f,
          stripe: 0xe1d3b5,
        });
        break;
      case "main_street":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd0c0a0,
          base: 0xc4b391,
          emphasis: zone.emphasis ?? "medium",
          joint: 0xae9d79,
          stripe: 0xdcccad,
        });
        break;
      case "west_lane":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xc3b391,
          base: 0xb8a682,
          emphasis: zone.emphasis ?? "medium",
          joint: 0x9c8968,
          stripe: 0xd0be9a,
        });
        layer.fillStyle(0x8a7960, 0.24);
        layer.fillRect(
          rect.x + rect.width - 18,
          rect.y + 10,
          8,
          rect.height - 20,
        );
        break;
      case "service_lane":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xb8ad95,
          base: 0xa89b7f,
          emphasis: zone.emphasis ?? "medium",
          joint: 0x88775f,
          stripe: 0xc5baa2,
        });
        layer.lineStyle(3, 0x7b654b, 0.18);
        layer.lineBetween(
          rect.x + rect.width * 0.28,
          rect.y + 18,
          rect.x + rect.width * 0.22,
          rect.y + rect.height - 18,
        );
        layer.lineBetween(
          rect.x + rect.width * 0.74,
          rect.y + 18,
          rect.x + rect.width * 0.78,
          rect.y + rect.height - 18,
        );
        break;
      case "square_border":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xd9ccb1,
          base: 0xd0c1a3,
          emphasis: "high",
          joint: 0xb7a78e,
          stripe: 0xe3d7bf,
        });
        layer.lineStyle(2, 0xefe1c1, 0.52);
        layer.strokeRoundedRect(
          rect.x + 18,
          rect.y + 18,
          rect.width - 36,
          rect.height - 36,
          24,
        );
        break;
      case "square_center":
        fillPatternedStoneZone(layer, rect, {
          accent: 0xe3d7bc,
          base: 0xd9cdb3,
          emphasis: "high",
          joint: 0xbcae93,
          stripe: 0xf0e6cf,
        });
        layer.lineStyle(2, 0xf0e6cd, 0.36);
        layer.strokeRoundedRect(
          rect.x + 12,
          rect.y + 12,
          rect.width - 24,
          rect.height - 24,
          18,
        );
        break;
      case "courtyard_ground":
        layer.fillStyle(0x7d9164, 0.34);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 18,
        );
        layer.lineStyle(2, 0x4f6146, 0.2);
        layer.strokeRoundedRect(
          rect.x + 2,
          rect.y + 2,
          rect.width - 4,
          rect.height - 4,
          rect.radius ?? 18,
        );
        layer.fillStyle(0x97a979, 0.11);
        layer.fillRoundedRect(
          rect.x + 16,
          rect.y + 16,
          rect.width - 32,
          rect.height - 32,
          16,
        );
        layer.fillStyle(0xd3c49f, 0.14);
        layer.fillRoundedRect(
          rect.x + rect.width / 2 - 28,
          rect.y + 52,
          56,
          rect.height - 110,
          10,
        );
        layer.lineStyle(1.4, 0xd6e3ac, 0.1);
        for (let y = rect.y + 24; y < rect.y + rect.height - 18; y += 22) {
          layer.lineBetween(rect.x + 24, y, rect.x + rect.width - 28, y - 8);
        }
        break;
      case "dock_apron":
        layer.fillStyle(0xb69f7a, 0.98);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 12,
        );
        layer.lineStyle(2, 0x8f7755, 0.2);
        for (let x = rect.x + 14; x < rect.x + rect.width - 14; x += 28) {
          layer.lineBetween(x, rect.y + 8, x, rect.y + rect.height - 8);
        }
        break;
      case "quay_wall":
        layer.fillStyle(0x5f625f, 1);
        layer.fillRoundedRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.radius ?? 8,
        );
        layer.fillStyle(0x8f846f, 0.34);
        layer.fillRect(rect.x, rect.y, rect.width, 10);
        layer.lineStyle(1, 0x4a4d4a, 0.28);
        for (let x = rect.x + 22; x < rect.x + rect.width - 22; x += 34) {
          layer.lineBetween(x, rect.y + 12, x, rect.y + rect.height - 4);
        }
        break;
      case "deep_water":
        layer.fillStyle(0x245c77, 1);
        layer.fillRect(rect.x, rect.y, rect.width, rect.height);
        layer.fillStyle(0x1f4e63, 0.28);
        layer.fillRect(
          rect.x,
          rect.y + rect.height * 0.46,
          rect.width,
          rect.height * 0.54,
        );
        break;
      default:
        break;
    }
  }
}

type TerrainDraftGrid = {
  cellSize: number;
  cols: number;
  kinds: Array<Array<"land" | "water">>;
  rows: number;
};

type TerrainDraftWaterSegment = {
  height: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

function buildTerrainDraftGrid(
  visualScene: VisualScene,
): TerrainDraftGrid | null {
  const terrain = visualScene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const cols = Math.max(1, Math.ceil(visualScene.width / terrain.cellSize));
  const rows = Math.max(1, Math.ceil(visualScene.height / terrain.cellSize));
  const overrideMap = new Map(
    terrain.overrides.map((cell) => [`${cell.col}:${cell.row}`, cell.kind]),
  );
  const kinds: Array<Array<"land" | "water">> = [];

  for (let row = 0; row < rows; row += 1) {
    const rowKinds: Array<"land" | "water"> = [];
    for (let col = 0; col < cols; col += 1) {
      rowKinds.push(overrideMap.get(`${col}:${row}`) ?? terrain.baseKind);
    }
    kinds.push(rowKinds);
  }

  return {
    cellSize: terrain.cellSize,
    cols,
    kinds,
    rows,
  };
}

function terrainDraftCellRect(
  visualScene: VisualScene,
  cellSize: number,
  col: number,
  row: number,
) {
  const x = col * cellSize;
  const y = row * cellSize;
  return {
    height: Math.min(cellSize, visualScene.height - y),
    width: Math.min(cellSize, visualScene.width - x),
    x,
    y,
  };
}

function buildTerrainDraftWaterSegments(grid: TerrainDraftGrid) {
  const segments: TerrainDraftWaterSegment[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    let startCol: number | null = null;

    for (let col = 0; col <= grid.cols; col += 1) {
      const water = col < grid.cols && grid.kinds[row][col] === "water";

      if (water) {
        if (startCol === null) {
          startCol = col;
        }
        continue;
      }

      if (startCol === null) {
        continue;
      }

      const x = startCol * grid.cellSize;
      const endX = col * grid.cellSize;
      segments.push({
        height: grid.cellSize,
        row,
        width: endX - x,
        x,
        y: row * grid.cellSize,
      });
      startCol = null;
    }
  }

  return segments;
}

function drawTerrainDraftWaterReflections(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  grid: TerrainDraftGrid,
) {
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (grid.kinds[row][col] !== "water") {
        continue;
      }

      const rect = terrainDraftCellRect(visualScene, grid.cellSize, col, row);
      const top = row > 0 ? grid.kinds[row - 1][col] : null;
      const bottom = row < grid.rows - 1 ? grid.kinds[row + 1][col] : null;
      const left = col > 0 ? grid.kinds[row][col - 1] : null;
      const right = col < grid.cols - 1 ? grid.kinds[row][col + 1] : null;

      if (top === "land") {
        layer.fillStyle(0x071c25, 0.24);
        layer.fillRect(rect.x, rect.y, rect.width, 7);
        layer.fillStyle(0xd8c39a, 0.18);
        layer.fillRoundedRect(rect.x + 7, rect.y + 5, rect.width - 14, 6, 3);
        layer.fillStyle(0xf5efd7, 0.08);
        layer.fillRoundedRect(rect.x + 12, rect.y + 15, rect.width - 24, 4, 2);
        layer.fillStyle(0xf2d7a3, 0.075);
        for (let x = rect.x + 10; x < rect.x + rect.width - 8; x += 26) {
          const length = 16 + ((col * 7 + row * 11 + Math.round(x)) % 14);
          layer.fillRoundedRect(x, rect.y + 10, 6, length, 3);
        }
      }

      if (bottom === "land") {
        layer.fillStyle(0x061821, 0.22);
        layer.fillRect(rect.x, rect.y + rect.height - 7, rect.width, 7);
        layer.fillStyle(0xcba677, 0.16);
        layer.fillRoundedRect(
          rect.x + 7,
          rect.y + rect.height - 12,
          rect.width - 14,
          6,
          3,
        );
        layer.fillStyle(0xf1d19a, 0.065);
        for (let x = rect.x + 12; x < rect.x + rect.width - 8; x += 28) {
          const length = 13 + ((col * 5 + row * 13 + Math.round(x)) % 12);
          layer.fillRoundedRect(
            x,
            rect.y + rect.height - length - 10,
            6,
            length,
            3,
          );
        }
      }

      if (left === "land") {
        layer.fillStyle(0x061821, 0.2);
        layer.fillRect(rect.x, rect.y, 7, rect.height);
        layer.fillStyle(0xd8c39a, 0.14);
        layer.fillRoundedRect(rect.x + 5, rect.y + 8, 5, rect.height - 16, 3);
        layer.fillStyle(0xf2d7a3, 0.07);
        for (let y = rect.y + 12; y < rect.y + rect.height - 8; y += 22) {
          layer.fillRoundedRect(rect.x + 12, y, 13, 5, 3);
        }
      }

      if (right === "land") {
        layer.fillStyle(0x061821, 0.2);
        layer.fillRect(rect.x + rect.width - 7, rect.y, 7, rect.height);
        layer.fillStyle(0xd8c39a, 0.14);
        layer.fillRoundedRect(
          rect.x + rect.width - 10,
          rect.y + 8,
          5,
          rect.height - 16,
          3,
        );
        layer.fillStyle(0xf2d7a3, 0.07);
        for (let y = rect.y + 12; y < rect.y + rect.height - 8; y += 22) {
          layer.fillRoundedRect(rect.x + rect.width - 25, y, 13, 5, 3);
        }
      }
    }
  }
}

function drawWaterPaintDabs(
  layer: PhaserType.GameObjects.Graphics,
  segment: TerrainDraftWaterSegment,
  height: number,
  palette: {
    deep: number;
    glow: number;
    jade: number;
    stone: number;
  },
) {
  const seed = segment.row * 37 + Math.round(segment.x / 8);

  for (let index = 0; index < 4; index += 1) {
    const ratio = (index + 0.55) / 4.6;
    const x =
      segment.x +
      segment.width * ratio +
      Math.sin(seed * 0.31 + index * 1.7) * 22;
    const y =
      segment.y +
      height * (0.2 + ((seed + index * 17) % 53) / 88) +
      Math.sin(seed * 0.19 + index) * 3;
    const width = Math.min(
      segment.width * (0.18 + ((seed + index * 11) % 10) / 52),
      154,
    );
    const color =
      index % 3 === 0
        ? palette.jade
        : index % 3 === 1
          ? palette.glow
          : palette.stone;

    layer.fillStyle(color, 0.07 + (index % 2) * 0.025);
    layer.fillEllipse(x, y, Math.max(width, 38), 8 + (index % 2) * 4);
    layer.fillStyle(palette.deep, 0.045);
    layer.fillEllipse(
      x + Math.sin(seed + index) * 8,
      y + 8,
      Math.max(width * 0.72, 30),
      5,
    );
  }
}

function drawTerrainDraftWaterBase(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  grid: TerrainDraftGrid,
) {
  const waterSegments = buildTerrainDraftWaterSegments(grid);

  for (const segment of waterSegments) {
    const height = Math.min(segment.height, visualScene.height - segment.y);
    if (height <= 0 || segment.width <= 0) {
      continue;
    }

    const depth = Math.max(
      0,
      Math.min((segment.y + height / 2) / visualScene.height, 1),
    );
    const rowPulse = (Math.sin(segment.row * 0.74) + 1) / 2;
    const harborBase = blendColor(
      blendColor(0x1f7893, 0x092b42, depth * 0.55),
      0x35c0a6,
      rowPulse * 0.22,
    );
    const glassColor = blendColor(harborBase, 0xd0f1ed, 0.42);
    const troughColor = blendColor(harborBase, 0x031926, 0.55);
    const jadeColor = blendColor(harborBase, 0x4fe6c6, 0.42);
    const reflectedStone = blendColor(0xf6c56f, harborBase, 0.28);
    const deepInk = blendColor(0x031926, harborBase, 0.24);

    layer.fillStyle(harborBase, 1);
    layer.fillRect(segment.x, segment.y, segment.width, height);
    layer.fillStyle(glassColor, 0.2);
    layer.fillRect(segment.x, segment.y + 2, segment.width, height * 0.3);
    layer.fillStyle(troughColor, 0.24 + depth * 0.1);
    layer.fillRect(
      segment.x,
      segment.y + height * 0.55,
      segment.width,
      height * 0.45,
    );

    layer.fillStyle(blendColor(harborBase, 0xffffff, 0.26), 0.07);
    layer.fillRoundedRect(
      segment.x + 4,
      segment.y + height * 0.12,
      Math.max(segment.width - 8, 0),
      Math.max(height * 0.08, 3),
      5,
    );
    layer.fillStyle(deepInk, 0.18);
    layer.fillRoundedRect(
      segment.x + 2,
      segment.y + height * 0.78,
      Math.max(segment.width - 4, 0),
      Math.max(height * 0.12, 5),
      6,
    );

    drawWaterPaintDabs(layer, segment, height, {
      deep: deepInk,
      glow: glassColor,
      jade: jadeColor,
      stone: reflectedStone,
    });

    drawWaveStroke(
      layer,
      segment.x + 4,
      segment.y + height * (0.62 + rowPulse * 0.06),
      Math.max(segment.width - 8, 0),
      0,
      segment.row * 0.9 + 0.6,
      8.6,
      10.2,
      blendColor(0x0d3545, harborBase, 0.34),
      0.18,
    );
    drawWaveStroke(
      layer,
      segment.x + 8,
      segment.y + height * (0.48 + rowPulse * 0.08),
      Math.max(segment.width - 16, 0),
      0,
      segment.row * 0.74,
      7.8,
      8.5,
      jadeColor,
      0.16,
    );
    drawWaveStroke(
      layer,
      segment.x + 16,
      segment.y + height * (0.34 + rowPulse * 0.12),
      Math.max(segment.width - 32, 0),
      0,
      segment.row * 0.55 + 1.8,
      3.6,
      4.2,
      reflectedStone,
      0.2,
    );

    layer.lineStyle(1.5, blendColor(glassColor, 0xffffff, 0.24), 0.18);
    for (let x = segment.x + 24; x < segment.x + segment.width - 16; x += 86) {
      const drift = Math.sin(x * 0.021 + segment.row * 0.5) * 5;
      const y = segment.y + height * (0.28 + rowPulse * 0.2);
      layer.lineBetween(x + drift, y, x + 42 + drift, y - 2);
    }

    layer.fillStyle(blendColor(glassColor, 0xffffff, 0.3), 0.08);
    for (let x = segment.x + 44; x < segment.x + segment.width - 24; x += 122) {
      const shimmerY =
        segment.y + height * (0.38 + Math.sin(x * 0.017 + segment.row) * 0.18);
      layer.fillEllipse(x, shimmerY, 46, 5.5);
    }

    if (segment.width < 132) {
      for (let y = segment.y + 8; y < segment.y + height - 8; y += 18) {
        const drift = Math.sin(y * 0.037 + segment.row) * 3;
        layer.lineStyle(3.6, blendColor(jadeColor, 0xffffff, 0.18), 0.19);
        layer.lineBetween(
          segment.x + segment.width * 0.24 + drift,
          y,
          segment.x + segment.width * 0.76 + drift,
          y + 15,
        );
        layer.lineStyle(2.5, blendColor(reflectedStone, 0xffffff, 0.14), 0.14);
        layer.lineBetween(
          segment.x + segment.width * 0.2 - drift,
          y + 3,
          segment.x + segment.width * 0.7 - drift,
          y + 14,
        );
      }
    }
  }

  drawTerrainDraftWaterReflections(layer, visualScene, grid);
}

function drawWaveStroke(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  beat: number,
  phaseOffset: number,
  amplitude: number,
  thickness: number,
  color: number,
  alpha: number,
  travelFade?: {
    direction?: 1 | -1;
    packetLength: number;
    softness?: number;
    speed: number;
  },
) {
  if (width <= 4) {
    return;
  }

  const sampleStep = 16;
  let previousX = x;
  let previousY =
    y +
    Math.sin(previousX * 0.024 + beat * 1.6 + phaseOffset) * amplitude +
    Math.sin(previousX * 0.011 + beat * 0.72 + phaseOffset * 0.7) *
      amplitude *
      0.48;

  if (!travelFade) {
    layer.lineStyle(thickness, color, alpha);
  }

  for (let offset = sampleStep; offset <= width; offset += sampleStep) {
    const nextX = Math.min(x + offset, x + width);
    const nextY =
      y +
      Math.sin(nextX * 0.024 + beat * 1.6 + phaseOffset) * amplitude +
      Math.sin(nextX * 0.011 + beat * 0.72 + phaseOffset * 0.7) *
        amplitude *
        0.48;
    if (travelFade) {
      const segmentProgress = ((previousX + nextX) * 0.5 - x) / width;
      const packetRatio = Math.min(
        Math.max(travelFade.packetLength / Math.max(width, 1), 0.08),
        0.72,
      );
      const cycleSpan = 1 + packetRatio * 2;
      const direction = travelFade.direction ?? 1;
      const front =
        positiveModulo(
          beat * travelFade.speed + phaseOffset * 0.061,
          cycleSpan,
        ) - packetRatio;
      const softness = Math.max(travelFade.softness ?? 1.75, 0.45);
      let segmentAlpha = 0;

      if (direction >= 0) {
        const tail = front - packetRatio;
        if (segmentProgress >= tail && segmentProgress <= front) {
          const progress = (segmentProgress - tail) / packetRatio;
          segmentAlpha = Math.pow(progress, softness);
        }
      } else {
        const tail = front + packetRatio;
        if (segmentProgress >= front && segmentProgress <= tail) {
          const progress = 1 - (segmentProgress - front) / packetRatio;
          segmentAlpha = Math.pow(progress, softness);
        }
      }

      if (segmentAlpha > 0.002) {
        layer.lineStyle(thickness, color, alpha * segmentAlpha);
        layer.lineBetween(previousX, previousY, nextX, nextY);
      }
    } else {
      layer.lineBetween(previousX, previousY, nextX, nextY);
    }
    previousX = nextX;
    previousY = nextY;
  }
}

function drawTerrainDraftRubble(
  layer: PhaserType.GameObjects.Graphics,
  rect: { height: number; width: number; x: number; y: number },
  side: "bottom" | "left" | "right" | "top",
  seed: number,
) {
  const count = 2 + (seed % 2);

  for (let index = 0; index < count; index += 1) {
    const progress = (index + 1) / (count + 1);
    const radius = 3 + ((seed + index) % 3);
    const x =
      side === "left"
        ? rect.x + 12
        : side === "right"
          ? rect.x + rect.width - 12
          : rect.x + rect.width * progress;
    const y =
      side === "top"
        ? rect.y + 12
        : side === "bottom"
          ? rect.y + rect.height - 12
          : rect.y + rect.height * progress;

    layer.fillStyle(0x76614a, 0.92);
    layer.fillCircle(x, y, radius + 1.8);
    layer.fillStyle(0xab987a, 0.52);
    layer.fillCircle(x - 1, y - 1, Math.max(radius - 1.4, 1));
  }
}

function drawTerrainDraftGround(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const grid = buildTerrainDraftGrid(visualScene);
  if (!grid) {
    return false;
  }

  const baseKind = visualScene.terrainDraft?.baseKind ?? "land";

  layer.fillStyle(baseKind === "water" ? 0x2d6277 : 0xd4c6a4, 1);
  layer.fillRect(0, 0, visualScene.width, visualScene.height);
  drawTerrainDraftWaterBase(layer, visualScene, grid);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const kind = grid.kinds[row][col];
      if (kind === baseKind) {
        continue;
      }
      if (kind === "water") {
        continue;
      }
      const { x, y, width, height } = terrainDraftCellRect(
        visualScene,
        grid.cellSize,
        col,
        row,
      );
      if (kind === "land" && baseKind === "water") {
        layer.fillStyle(0xd4c6a4, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0xe9dfc4, 0.18);
        layer.fillRect(x + 2, y + 2, width * 0.52, height * 0.42);
        layer.fillStyle(0xa48f66, 0.08);
        layer.fillRect(x, y + height - 2, width, 2);
      } else if (kind === "land") {
        layer.fillStyle(0xd4c6a4, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0xe9dfc4, 0.18);
        layer.fillRect(x + 2, y + 2, width * 0.52, height * 0.42);
        layer.fillStyle(0x8b7b5f, 0.08);
        layer.fillRect(x, y + height - 2, width, 2);
      } else {
        layer.fillStyle(0x54798f, 1);
        layer.fillRect(x, y, width, height);
        layer.fillStyle(0x103346, 0.26);
        layer.fillRect(x, y + height * 0.48, width, height * 0.52);
      }
    }
  }

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (grid.kinds[row][col] !== "land") {
        continue;
      }

      const rect = terrainDraftCellRect(visualScene, grid.cellSize, col, row);
      const top = row > 0 ? grid.kinds[row - 1][col] : null;
      const bottom = row < grid.rows - 1 ? grid.kinds[row + 1][col] : null;
      const left = col > 0 ? grid.kinds[row][col - 1] : null;
      const right = col < grid.cols - 1 ? grid.kinds[row][col + 1] : null;
      const edges = [
        top === "water" ? "top" : null,
        bottom === "water" ? "bottom" : null,
        left === "water" ? "left" : null,
        right === "water" ? "right" : null,
      ].filter(Boolean) as Array<"bottom" | "left" | "right" | "top">;

      for (const side of edges) {
        const seed =
          col * 17 +
          row * 23 +
          (side === "top"
            ? 1
            : side === "bottom"
              ? 3
              : side === "left"
                ? 5
                : 7);
        const bandThickness = 9;

        layer.fillStyle(0x7f694a, 0.28);
        if (side === "top") {
          layer.fillRect(rect.x + 6, rect.y, rect.width - 12, bandThickness);
        } else if (side === "bottom") {
          layer.fillRect(
            rect.x + 6,
            rect.y + rect.height - bandThickness,
            rect.width - 12,
            bandThickness,
          );
        } else if (side === "left") {
          layer.fillRect(rect.x, rect.y + 6, bandThickness, rect.height - 12);
        } else {
          layer.fillRect(
            rect.x + rect.width - bandThickness,
            rect.y + 6,
            bandThickness,
            rect.height - 12,
          );
        }

        layer.lineStyle(4, 0xd8c5a0, 0.5);
        if (side === "top") {
          layer.lineBetween(
            rect.x + 8,
            rect.y + 1,
            rect.x + rect.width - 10,
            rect.y + 1,
          );
          layer.lineStyle(2.6, 0xdff4fb, 0.32);
          layer.lineBetween(
            rect.x + 10,
            rect.y - 5,
            rect.x + rect.width - 12,
            rect.y - 5,
          );
        } else if (side === "bottom") {
          layer.lineBetween(
            rect.x + 8,
            rect.y + rect.height - 1,
            rect.x + rect.width - 10,
            rect.y + rect.height - 1,
          );
          layer.lineStyle(2.6, 0xdff4fb, 0.32);
          layer.lineBetween(
            rect.x + 10,
            rect.y + rect.height + 5,
            rect.x + rect.width - 12,
            rect.y + rect.height + 5,
          );
        } else if (side === "left") {
          layer.lineBetween(
            rect.x + 1,
            rect.y + 8,
            rect.x + 1,
            rect.y + rect.height - 10,
          );
        } else {
          layer.lineBetween(
            rect.x + rect.width - 1,
            rect.y + 8,
            rect.x + rect.width - 1,
            rect.y + rect.height - 10,
          );
        }

        drawTerrainDraftRubble(layer, rect, side, seed);
      }
    }
  }

  return true;
}

function getTerrainDraftKindAtPoint(
  visualScene: VisualScene,
  x: number,
  y: number,
) {
  const terrain = visualScene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const maxCol = Math.max(
    0,
    Math.ceil(visualScene.width / terrain.cellSize) - 1,
  );
  const maxRow = Math.max(
    0,
    Math.ceil(visualScene.height / terrain.cellSize) - 1,
  );
  const col = Math.max(0, Math.min(Math.floor(x / terrain.cellSize), maxCol));
  const row = Math.max(0, Math.min(Math.floor(y / terrain.cellSize), maxRow));
  const key = `${col}:${row}`;
  const override = terrain.overrides.find(
    (cell) => `${cell.col}:${cell.row}` === key,
  );
  return override?.kind ?? terrain.baseKind;
}

function drawSurfaceDraft(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const surface = visualScene.surfaceDraft;
  if (!surface) {
    return false;
  }

  const cols = Math.max(1, Math.ceil(visualScene.width / surface.cellSize));
  const rows = Math.max(1, Math.ceil(visualScene.height / surface.cellSize));
  const overrideMap = new Map(
    surface.overrides.map((cell) => [`${cell.col}:${cell.row}`, cell.kind]),
  );
  const rowKinds: Array<Array<VisualSurfaceMaterialKind | null>> = [];

  for (let row = 0; row < rows; row += 1) {
    const currentRow: Array<VisualSurfaceMaterialKind | null> = [];
    for (let col = 0; col < cols; col += 1) {
      const kind = overrideMap.get(`${col}:${row}`) ?? surface.baseKind;
      const x = col * surface.cellSize;
      const y = row * surface.cellSize;
      const width = Math.min(surface.cellSize, visualScene.width - x);
      const height = Math.min(surface.cellSize, visualScene.height - y);
      const terrainKind = getTerrainDraftKindAtPoint(
        visualScene,
        x + width / 2,
        y + height / 2,
      );
      if (terrainKind === "water") {
        currentRow.push(null);
        continue;
      }
      currentRow.push(kind);
    }
    rowKinds.push(currentRow);
  }

  for (let row = 0; row < rows; row += 1) {
    let startCol: number | null = null;
    let currentKind: VisualSurfaceMaterialKind | null = null;

    for (let col = 0; col <= cols; col += 1) {
      const nextKind = col < cols ? rowKinds[row][col] : null;

      if (nextKind !== null && nextKind === currentKind) {
        continue;
      }

      if (startCol !== null && currentKind !== null) {
        const x = startCol * surface.cellSize;
        const endX = Math.min(col * surface.cellSize, visualScene.width);
        const y = row * surface.cellSize;
        const width = endX - x;
        const height = Math.min(surface.cellSize, visualScene.height - y);

        switch (currentKind) {
          case "paved_asphalt":
            layer.fillStyle(0x5d656a, 0.96);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0xffffff, 0.04);
            layer.fillRect(x, y + height * 0.12, width, height * 0.18);
            layer.fillStyle(0x14181b, 0.12);
            layer.fillRect(x, y + height - 2, width, 2);
            layer.lineStyle(2, 0xd9dccd, 0.22);
            for (let dashX = x + 10; dashX < x + width - 14; dashX += 18) {
              layer.lineBetween(
                dashX,
                y + height / 2,
                Math.min(dashX + 8, x + width - 10),
                y + height / 2,
              );
            }
            break;
          case "tiled_stone_road":
            layer.fillStyle(0xb6b0a2, 0.98);
            layer.fillRect(x, y, width, height);
            layer.lineStyle(1.5, 0xe9e2d2, 0.2);
            for (
              let seamY = y + height / 4;
              seamY < y + height;
              seamY += height / 4
            ) {
              layer.lineBetween(x + 6, seamY, x + width - 6, seamY);
            }
            break;
          case "walkway":
            layer.fillStyle(0xddd1bc, 0.98);
            layer.fillRect(x, y, width, height);
            layer.lineStyle(1.4, 0xf5ecdd, 0.2);
            for (
              let seamY = y + height / 4;
              seamY < y + height;
              seamY += height / 4
            ) {
              layer.lineBetween(x + 8, seamY, x + width - 8, seamY);
            }
            break;
          case "grass":
            layer.fillStyle(0x7d9566, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0xb8d092, 0.12);
            layer.fillRect(
              x + width * 0.08,
              y + height * 0.18,
              width * 0.68,
              height * 0.24,
            );
            layer.lineStyle(1.4, 0x566e3f, 0.16);
            layer.lineBetween(
              x + 10,
              y + height * 0.64,
              x + width - 10,
              y + height * 0.58,
            );
            break;
          case "bushes":
            layer.fillStyle(0x6d8a55, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0x36552d, 0.44);
            for (let bushX = x + 22; bushX < x + width - 10; bushX += 42) {
              const bushY =
                y +
                height * (Math.round((bushX - x) / 42) % 2 === 0 ? 0.5 : 0.42);
              layer.fillCircle(bushX, bushY, 8);
              layer.fillCircle(bushX + 10, bushY - 4, 9);
            }
            break;
          case "trees":
            layer.fillStyle(0x72905e, 0.98);
            layer.fillRect(x, y, width, height);
            layer.fillStyle(0x74553d, 0.72);
            layer.fillStyle(0x4f7a42, 0.9);
            for (let treeX = x + 28; treeX < x + width - 10; treeX += 68) {
              const treeY =
                y +
                height * (Math.round((treeX - x) / 68) % 2 === 0 ? 0.46 : 0.4);
              layer.fillStyle(0x74553d, 0.72);
              layer.fillRoundedRect(treeX - 2, treeY + 10, 4, 8, 2);
              layer.fillStyle(0x4f7a42, 0.9);
              layer.fillCircle(treeX, treeY, 11);
              layer.fillCircle(treeX + 8, treeY - 3, 8);
            }
            break;
          default:
            break;
        }
      }

      startCol = nextKind === null ? null : col;
      currentKind = nextKind;
    }
  }

  return true;
}

function fillPatternedStoneZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  palette: {
    accent: number;
    base: number;
    emphasis: "high" | "low" | "medium";
    joint: number;
    stripe: number;
  },
) {
  layer.fillStyle(palette.base, 0.99);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.lineStyle(1, palette.joint, palette.emphasis === "high" ? 0.32 : 0.22);

  for (let x = rect.x + 16; x < rect.x + rect.width - 16; x += 30) {
    layer.lineBetween(x, rect.y + 10, x, rect.y + rect.height - 10);
  }

  for (let y = rect.y + 16; y < rect.y + rect.height - 16; y += 30) {
    layer.lineBetween(rect.x + 10, y, rect.x + rect.width - 10, y);
  }

  layer.fillStyle(palette.stripe, palette.emphasis === "high" ? 0.2 : 0.12);
  for (let y = rect.y + 14; y < rect.y + rect.height - 14; y += 60) {
    layer.fillRect(rect.x + 12, y, rect.width - 24, 6);
  }

  layer.fillStyle(palette.accent, palette.emphasis === "high" ? 0.18 : 0.12);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 90) {
    layer.fillRect(x, rect.y + 12, 16, rect.height - 24);
  }
}

function drawFringeZones(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const zone of visualScene.fringeZones) {
    switch (zone.kind) {
      case "neighbor_facade":
        drawNeighborFacadeZone(layer, zone.rect, zone.edge);
        break;
      case "alley_mouth":
        drawAlleyZone(layer, zone.rect);
        break;
      case "side_street":
        drawSideStreetZone(layer, zone.rect, zone.edge);
        break;
      case "quay_continuation":
        drawQuayContinuationZone(layer, zone.rect, zone.edge);
        break;
      default:
        break;
    }
  }
}

function drawNeighborFacadeZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  layer.fillStyle(0x1a2a31, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x24363f, 0.9);
  layer.fillRect(rect.x, rect.y + 8, rect.width, 18);
  layer.lineStyle(1, 0x334852, 0.26);
  for (let x = rect.x + 20; x < rect.x + rect.width - 20; x += 48) {
    layer.lineBetween(x, rect.y + 28, x, rect.y + rect.height - 14);
  }
  if (edge === "north") {
    layer.fillStyle(0x4a4d4d, 0.16);
    layer.fillRect(rect.x + 16, rect.y + rect.height - 26, rect.width - 32, 12);
  }
}

function drawAlleyZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x142028, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.fillStyle(0x1e2d35, 0.8);
  layer.fillRoundedRect(
    rect.x + 14,
    rect.y + 18,
    rect.width - 28,
    rect.height - 36,
    14,
  );
  layer.lineStyle(1, 0x2f4650, 0.22);
  for (let y = rect.y + 26; y < rect.y + rect.height - 18; y += 44) {
    layer.lineBetween(rect.x + 18, y, rect.x + rect.width - 18, y);
  }
}

function drawSideStreetZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  layer.fillStyle(0x1b2a32, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x2a3942, 0.26);
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 36) {
    layer.fillRect(rect.x + 14, y, rect.width - 28, 8);
  }
  if (edge === "east" || edge === "west") {
    layer.fillStyle(0x23343d, 0.8);
    layer.fillRect(
      rect.x + rect.width / 2 - 18,
      rect.y + 22,
      36,
      rect.height - 44,
    );
  }
}

function drawQuayContinuationZone(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  edge: "east" | "north" | "south" | "west",
) {
  void edge;
  layer.fillStyle(0x1f2a2f, 1);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 12,
  );
  layer.fillStyle(0x6a655a, 0.55);
  layer.fillRect(rect.x, rect.y, rect.width, 16);
  layer.fillStyle(0x23566f, 1);
  layer.fillRect(
    rect.x,
    rect.y + Math.max(rect.height - 82, 0),
    rect.width,
    82,
  );
}

function drawHarborEdge(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const quayWall = visualScene.surfaceZones.find(
    (zone) => zone.kind === "quay_wall",
  );
  const dockApron = visualScene.surfaceZones.find(
    (zone) => zone.kind === "dock_apron",
  );
  const dockLandmark = visualScene.landmarks.find(
    (landmark) => landmark.style === "dock",
  );

  if (quayWall) {
    const rect = quayWall.rect;
    layer.fillStyle(0x0a1720, 0.18);
    layer.fillRoundedRect(
      rect.x + 6,
      rect.y + rect.height - 6,
      rect.width - 12,
      12,
      5,
    );
    layer.fillStyle(0xf0d7a0, 0.12);
    layer.fillRoundedRect(rect.x + 12, rect.y + 4, rect.width - 24, 7, 4);
    layer.lineStyle(2, 0xb4a583, 0.36);
    for (let x = rect.x + 26; x < rect.x + rect.width - 26; x += 86) {
      layer.lineBetween(x, rect.y + 10, x, rect.y + rect.height - 4);
      layer.fillStyle(0xf8e7b8, 0.08);
      layer.fillEllipse(x + 8, rect.y + rect.height + 12, 16, 34);
    }
  }

  if (dockApron) {
    const rect = dockApron.rect;
    layer.fillStyle(0xb38b5c, 0.28);
    layer.fillRoundedRect(rect.x + 14, rect.y + 16, rect.width - 28, 18, 8);
    layer.lineStyle(2.4, 0xf2d7a3, 0.2);
    layer.lineBetween(
      rect.x + 18,
      rect.y + 12,
      rect.x + rect.width - 20,
      rect.y + 9,
    );
    layer.lineStyle(2, 0x493426, 0.16);
    layer.lineBetween(
      rect.x + 20,
      rect.y + rect.height - 10,
      rect.x + rect.width - 22,
      rect.y + rect.height - 14,
    );
  }

  if (dockLandmark) {
    const rect = dockLandmark.rect;
    layer.fillStyle(0x7a5b3f, 0.98);
    layer.fillRoundedRect(
      rect.x + 24,
      rect.y + 34,
      rect.width - 48,
      rect.height - 52,
      16,
    );
    layer.lineStyle(2, 0xa67d52, 0.26);
    for (let x = rect.x + 36; x < rect.x + rect.width - 36; x += 30) {
      layer.lineBetween(x, rect.y + 44, x, rect.y + rect.height - 26);
    }
    layer.fillStyle(0x6e5140, 1);
    layer.fillRoundedRect(rect.x + 72, rect.y + 58, 70, 16, 6);
    layer.fillRoundedRect(rect.x + rect.width - 152, rect.y + 84, 88, 16, 6);
    layer.fillStyle(0xf4d59a, 0.1);
    for (let x = rect.x + 54; x < rect.x + rect.width - 46; x += 76) {
      layer.fillRoundedRect(x, rect.y + 48, 36, 5, 3);
      layer.fillEllipse(x + 12, rect.y + rect.height + 2, 24, 11);
    }
  }
}

function drawLandmarkModules(
  objects: AuthoredVisualSceneObjects,
  visualScene: VisualScene,
) {
  const layer = objects.structureDetailLayer;
  for (const landmarkModule of visualScene.landmarkModules) {
    switch (landmarkModule.kind) {
      case "roof_cap":
        drawLandmarkRoofCap(layer, landmarkModule);
        break;
      case "wall_band":
        drawLandmarkWallBand(layer, landmarkModule);
        break;
      case "awning":
        drawLandmarkAwning(layer, landmarkModule);
        break;
      case "entry":
        drawLandmarkEntry(layer, landmarkModule);
        break;
      case "window_row":
        drawLandmarkWindowRow(layer, landmarkModule);
        break;
      case "terrace_rail":
        drawLandmarkTerraceRail(layer, landmarkModule);
        break;
      case "shutters":
        drawLandmarkShutters(layer, landmarkModule);
        break;
      case "stoop":
        drawLandmarkStoop(layer, landmarkModule);
        break;
      case "service_bay":
        drawLandmarkServiceBay(layer, landmarkModule);
        break;
      case "sign":
        drawLandmarkSign(layer, landmarkModule);
        break;
      case "trim":
        drawLandmarkTrim(layer, landmarkModule);
        break;
      case "downspout":
        drawLandmarkDownspout(layer, landmarkModule);
        break;
      default:
        break;
    }
  }

  for (const landmarkModule of visualScene.landmarkModules) {
    if (landmarkModule.kind !== "sign") {
      continue;
    }

    if (landmarkModule.variant === "cafe") {
      addLandmarkTextNode(objects, {
        color: "#f7edd2",
        fontFamily: "Georgia, serif",
        fontSize: Math.max(16, landmarkModule.rect.height * 0.55),
        text: "CAFE",
        x: landmarkModule.rect.x + landmarkModule.rect.width / 2,
        y:
          landmarkModule.rect.y +
          landmarkModule.rect.height / 2 +
          Math.max(4, landmarkModule.rect.height * 0.12),
      });
    }

    if (landmarkModule.variant === "yard") {
      addLandmarkTextNode(objects, {
        color: "#f0dfb8",
        fontFamily: "Arial Black, Impact, sans-serif",
        fontSize: Math.max(12, landmarkModule.rect.height * 0.44),
        text: "DOCK YARD",
        x: landmarkModule.rect.x + landmarkModule.rect.width / 2,
        y:
          landmarkModule.rect.y +
          landmarkModule.rect.height / 2 +
          Math.max(4, landmarkModule.rect.height * 0.12),
      });
    }
  }
}

function drawLandmarkRoofCap(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const roofColor =
    landmarkModule.variant === "verdigris"
      ? 0x567365
      : landmarkModule.variant === "iron"
        ? 0x53616b
        : landmarkModule.variant === "timber"
          ? 0x80614a
          : 0x5d6870;

  layer.fillStyle(roofColor, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 12,
  );
  layer.lineStyle(2, 0xbda676, 0.18);
  for (
    let x = landmarkModule.rect.x + 14;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 14;
    x += 30
  ) {
    layer.lineBetween(
      x,
      landmarkModule.rect.y + 8,
      x,
      landmarkModule.rect.y + landmarkModule.rect.height - 8,
    );
  }
}

function drawLandmarkWallBand(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const palette =
    landmarkModule.variant === "cafe-ivory"
      ? { base: 0xe7ddbf, accent: 0xc79268 }
      : landmarkModule.variant === "walnut"
        ? { base: 0x8c684a, accent: 0x6f5039 }
        : landmarkModule.variant === "boarding-upper"
          ? { base: 0xd0c2ab, accent: 0xb3765e }
          : landmarkModule.variant === "boarding-lower"
            ? { base: 0xc3b49b, accent: 0xa26d58 }
            : landmarkModule.variant === "workshop-stone"
              ? { base: 0x697883, accent: 0xbe8660 }
              : landmarkModule.variant === "yard-gatehouse"
                ? { base: 0x8e785e, accent: 0x70563f }
                : { base: 0xd0c2ab, accent: 0xaa7f61 };

  layer.fillStyle(palette.base, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 16,
  );
  layer.fillStyle(palette.accent, 0.9);
  layer.fillRect(
    landmarkModule.rect.x + 10,
    landmarkModule.rect.y + landmarkModule.rect.height * 0.45,
    landmarkModule.rect.width - 20,
    Math.max(18, landmarkModule.rect.height * 0.32),
  );
  layer.fillStyle(0xfff0cf, 0.08);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 12,
    landmarkModule.rect.y + 10,
    landmarkModule.rect.width - 24,
    Math.max(8, landmarkModule.rect.height * 0.12),
    5,
  );
  layer.lineStyle(1.2, 0x5f4d3d, 0.08);
  for (
    let y = landmarkModule.rect.y + 18;
    y < landmarkModule.rect.y + landmarkModule.rect.height - 14;
    y += 34
  ) {
    layer.lineBetween(
      landmarkModule.rect.x + 14,
      y,
      landmarkModule.rect.x + landmarkModule.rect.width - 16,
      y + 2,
    );
  }
}

function drawLandmarkAwning(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const stripeCount = 8;
  const stripeWidth = landmarkModule.rect.width / stripeCount;
  for (let index = 0; index < stripeCount; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0x42a474 : 0xf3efe1, 1);
    layer.fillRect(
      landmarkModule.rect.x + index * stripeWidth,
      landmarkModule.rect.y,
      stripeWidth,
      landmarkModule.rect.height,
    );
  }
  layer.fillStyle(0x6b5037, 0.34);
  layer.fillRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y + landmarkModule.rect.height - 6,
    landmarkModule.rect.width,
    6,
  );
  layer.fillStyle(0x071116, 0.12);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 2,
    landmarkModule.rect.y + landmarkModule.rect.height,
    landmarkModule.rect.width - 4,
    7,
    3,
  );
  layer.lineStyle(1, 0xffffff, 0.2);
  layer.lineBetween(
    landmarkModule.rect.x + 8,
    landmarkModule.rect.y + 4,
    landmarkModule.rect.x + landmarkModule.rect.width - 8,
    landmarkModule.rect.y + 4,
  );
}

function drawLandmarkEntry(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const fill =
    landmarkModule.variant === "house-door"
      ? 0x71533f
      : landmarkModule.variant === "arched"
        ? 0x6d4d39
        : 0x3e4d53;
  layer.fillStyle(fill, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.fillStyle(0xf0deb2, 0.12);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 8,
    landmarkModule.rect.y + 10,
    Math.max(landmarkModule.rect.width - 16, 0),
    Math.max(landmarkModule.rect.height * 0.36, 0),
    6,
  );
}

function drawLandmarkWindowRow(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const count = landmarkModule.count ?? 3;
  const gap = 14;
  const unitWidth = Math.max(
    (landmarkModule.rect.width - gap * (count - 1)) / count,
    18,
  );
  const windowHeight =
    landmarkModule.variant === "cafe-large"
      ? landmarkModule.rect.height
      : landmarkModule.rect.height - 10;

  for (let index = 0; index < count; index += 1) {
    const x = landmarkModule.rect.x + index * (unitWidth + gap);
    layer.fillStyle(0xf0e0b4, 0.92);
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y + 4,
      unitWidth,
      windowHeight,
      8,
    );
    layer.fillStyle(0x5d4537, 0.22);
    layer.fillRoundedRect(
      x + 4,
      landmarkModule.rect.y + 8,
      unitWidth - 8,
      Math.max(windowHeight - 14, 0),
      6,
    );
    layer.lineStyle(1.4, 0x775b43, 0.22);
    layer.lineBetween(
      x + unitWidth / 2,
      landmarkModule.rect.y + 8,
      x + unitWidth / 2,
      landmarkModule.rect.y + Math.max(windowHeight - 8, 8),
    );
    layer.lineBetween(
      x + 6,
      landmarkModule.rect.y + windowHeight * 0.52,
      x + unitWidth - 6,
      landmarkModule.rect.y + windowHeight * 0.52,
    );
    layer.fillStyle(0xffffff, 0.18);
    layer.fillRoundedRect(
      x + 7,
      landmarkModule.rect.y + 9,
      Math.max(unitWidth * 0.28, 5),
      5,
      2,
    );
  }
}

function drawLandmarkTerraceRail(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x7a5b42, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y + landmarkModule.rect.height / 2 - 4,
    landmarkModule.rect.width,
    8,
    4,
  );
  for (
    let x = landmarkModule.rect.x + 12;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 12;
    x += 26
  ) {
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y,
      4,
      landmarkModule.rect.height,
      2,
    );
  }
}

function drawLandmarkShutters(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const count = landmarkModule.count ?? 2;
  const gap = 12;
  const shutterWidth = Math.max(
    (landmarkModule.rect.width - gap * (count - 1)) / count,
    14,
  );

  for (let index = 0; index < count; index += 1) {
    const x = landmarkModule.rect.x + index * (shutterWidth + gap);
    layer.fillStyle(0xc3cbc7, 0.95);
    layer.fillRoundedRect(
      x,
      landmarkModule.rect.y,
      shutterWidth,
      landmarkModule.rect.height,
      6,
    );
    layer.fillStyle(0x62737c, 0.18);
    layer.fillRect(x + 4, landmarkModule.rect.y + 8, shutterWidth - 8, 6);
  }
}

function drawLandmarkStoop(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x9d8a6d, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 8,
  );
  layer.fillStyle(0x866f57, 0.9);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 10,
    landmarkModule.rect.y + 8,
    landmarkModule.rect.width - 20,
    8,
    4,
  );
}

function drawLandmarkServiceBay(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(
    landmarkModule.variant === "yard-gate" ? 0x6f5844 : 0x35474f,
    1,
  );
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.lineStyle(2, 0xc6a873, 0.22);
  for (
    let x = landmarkModule.rect.x + 12;
    x < landmarkModule.rect.x + landmarkModule.rect.width - 12;
    x += 26
  ) {
    layer.lineBetween(
      x,
      landmarkModule.rect.y + 10,
      x,
      landmarkModule.rect.y + landmarkModule.rect.height - 10,
    );
  }
  layer.fillStyle(0x071116, 0.18);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 12,
    landmarkModule.rect.y + landmarkModule.rect.height - 16,
    landmarkModule.rect.width - 24,
    9,
    4,
  );
  layer.fillStyle(0xd7bc79, 0.12);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 18,
    landmarkModule.rect.y + 10,
    landmarkModule.rect.width - 36,
    6,
    3,
  );
}

function drawLandmarkSign(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const fill =
    landmarkModule.variant === "cafe"
      ? 0x384a3f
      : landmarkModule.variant === "workshop"
        ? 0x3e4648
        : landmarkModule.variant === "yard"
          ? 0x564638
          : 0x2f4240;

  layer.fillStyle(fill, 1);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.lineStyle(2, 0xd7bc79, 0.84);
  layer.strokeRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 10,
  );
  layer.fillStyle(0xffffff, 0.08);
  layer.fillRoundedRect(
    landmarkModule.rect.x + 10,
    landmarkModule.rect.y + 6,
    landmarkModule.rect.width - 20,
    5,
    3,
  );
}

function drawLandmarkTrim(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  const trim =
    landmarkModule.variant === "warm-trim"
      ? 0xdeb88f
      : landmarkModule.variant === "industrial-band"
        ? 0xbc8d63
        : landmarkModule.variant === "yard-band"
          ? 0xc89d74
          : 0xd0b48c;
  layer.fillStyle(trim, 0.94);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 6,
  );
}

function drawLandmarkDownspout(
  layer: PhaserType.GameObjects.Graphics,
  landmarkModule: VisualScene["landmarkModules"][number],
) {
  layer.fillStyle(0x53626a, 0.94);
  layer.fillRoundedRect(
    landmarkModule.rect.x,
    landmarkModule.rect.y,
    landmarkModule.rect.width,
    landmarkModule.rect.height,
    landmarkModule.rect.radius ?? 4,
  );
}

function drawPropClusters(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  if (visualScene.id === "south-quay-v2") {
    drawV2ProceduralPropClusters(layer, visualScene);
    drawV2VegetationCanopies(layer, visualScene);
  }

  for (const cluster of visualScene.propClusters) {
    switch (cluster.kind) {
      case "cafe_terrace":
        drawCafeTerraceCluster(layer, cluster);
        break;
      case "square_bench_pair":
        drawBenchPairCluster(layer, cluster);
        break;
      case "square_planter_pair":
        drawPlanterPairCluster(layer, cluster);
        break;
      case "workshop_stock":
        drawWorkshopStockCluster(layer, cluster);
        break;
      case "yard_service":
        drawYardServiceCluster(layer, cluster);
        break;
      case "harbor_mooring":
        drawHarborMooringCluster(layer, cluster);
        break;
      default:
        break;
    }
  }

  for (const prop of visualScene.props) {
    switch (prop.kind) {
      case "lamp":
        drawAuthoredLamp(layer, prop.x, prop.y, prop.scale ?? 1);
        break;
      case "bench":
        drawAuthoredBench(layer, prop.x, prop.y, prop.rotation);
        break;
      case "planter":
        drawAuthoredPlanter(layer, prop.x, prop.y);
        break;
      case "terrace-table":
        drawAuthoredTerraceTable(layer, prop.x, prop.y);
        break;
      default:
        break;
    }
  }
}

function getV2Landmark(
  visualScene: VisualScene,
  locationId: VisualScene["landmarks"][number]["locationId"],
) {
  return visualScene.landmarks.find(
    (landmark) => landmark.locationId === locationId,
  );
}

function drawV2ProceduralPropClusters(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const cafe = getV2Landmark(visualScene, "tea-house");
  const boardingHouse = getV2Landmark(visualScene, "boarding-house");
  const repairStall = getV2Landmark(visualScene, "repair-stall");
  const square = getV2Landmark(visualScene, "market-square");
  const freightYard = getV2Landmark(visualScene, "freight-yard");
  const pier = getV2Landmark(visualScene, "moss-pier");
  const courtyard = getV2Landmark(visualScene, "courtyard");

  if (cafe) {
    drawV2CafePersonality(layer, cafe.rect);
  }
  if (boardingHouse) {
    drawV2BoardingHousePersonality(layer, boardingHouse.rect);
  }
  if (repairStall) {
    drawV2RepairStallPersonality(layer, repairStall.rect);
  }
  if (square) {
    drawV2SquarePersonality(layer, square.rect);
  }
  if (freightYard) {
    drawV2FreightYardPersonality(layer, freightYard.rect);
  }
  if (pier) {
    drawV2PierPersonality(layer, pier.rect);
  }
  if (courtyard) {
    drawV2CourtyardPersonality(layer, courtyard.rect);
  }
  drawV2StreetLifeVehicles(layer, {
    cafe,
    freightYard,
    pier,
    square,
  });
}

function drawV2CafePersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const terraceY = rect.y + rect.height - 44;
  layer.fillStyle(0x071116, 0.1);
  layer.fillRoundedRect(rect.x + 44, terraceY + 18, rect.width - 88, 22, 8);
  layer.fillStyle(0xffe4ad, 0.07);
  layer.fillEllipse(
    rect.x + rect.width / 2,
    terraceY + 20,
    rect.width * 0.72,
    28,
  );
  layer.lineStyle(2, 0x6e4f36, 0.52);
  layer.lineBetween(
    rect.x + 56,
    terraceY + 3,
    rect.x + rect.width - 54,
    terraceY + 3,
  );
  layer.lineStyle(1.5, 0xcaa36f, 0.38);
  for (let x = rect.x + 62; x < rect.x + rect.width - 58; x += 38) {
    layer.lineBetween(x, terraceY - 8, x, terraceY + 26);
  }

  const tableY = terraceY + 18;
  for (let x = rect.x + 82; x < rect.x + rect.width - 76; x += 74) {
    drawAuthoredTerraceTable(layer, x, tableY + Math.sin(x * 0.04) * 2);
    layer.fillStyle(0xeed4a2, 0.34);
    layer.fillCircle(x - 4, tableY - 3, 5);
    layer.fillStyle(0x2f2017, 0.1);
    layer.fillEllipse(x + 8, tableY + 19, 38, 9);
  }

  drawMenuBoard(layer, rect.x + 42, rect.y + rect.height - 58);
  drawAuthoredPlanter(layer, rect.x + 28, rect.y + rect.height - 18);
  drawAuthoredPlanter(
    layer,
    rect.x + rect.width - 28,
    rect.y + rect.height - 18,
  );
}

function drawV2BoardingHousePersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const doorX = rect.x + rect.width / 2;
  const doorY = rect.y + rect.height - 78;
  layer.fillStyle(0x071116, 0.14);
  layer.fillEllipse(doorX + 8, doorY + 78, 90, 18);
  layer.fillStyle(0x7e5e46, 0.96);
  layer.fillRoundedRect(doorX - 44, doorY + 58, 88, 20, 8);
  layer.fillStyle(0xd8c195, 0.55);
  layer.fillRoundedRect(doorX - 34, doorY + 63, 68, 6, 3);

  layer.fillStyle(0xead7aa, 0.2);
  for (let x = rect.x + 58; x < rect.x + rect.width - 48; x += 64) {
    layer.fillRoundedRect(x - 10, rect.y + 88, 24, 7, 4);
    layer.fillRoundedRect(x - 10, rect.y + 144, 24, 6, 3);
    layer.fillStyle(0x8c4f43, 0.22);
    layer.fillRoundedRect(x - 14, rect.y + 96, 6, 28, 3);
    layer.fillRoundedRect(x + 16, rect.y + 96, 6, 28, 3);
    layer.fillStyle(0xead7aa, 0.2);
  }
}

function drawV2RepairStallPersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const counterY = rect.y + rect.height - 54;
  layer.fillStyle(0x071116, 0.13);
  layer.fillEllipse(
    rect.x + rect.width / 2 + 10,
    counterY + 26,
    rect.width * 0.72,
    18,
  );
  layer.fillStyle(0x7c6046, 0.98);
  layer.fillRoundedRect(rect.x + 42, counterY, rect.width - 84, 22, 8);
  layer.fillStyle(0xd2bc91, 0.5);
  layer.fillRoundedRect(rect.x + 54, counterY + 5, rect.width - 108, 6, 3);
  drawToolStand(layer, rect.x + 46, rect.y + rect.height - 28);
  drawCrateStack(layer, rect.x + rect.width - 42, rect.y + rect.height - 28);
  layer.fillStyle(0x38444a, 0.26);
  layer.fillRoundedRect(rect.x + 62, rect.y + 74, rect.width - 124, 8, 4);
  layer.lineStyle(2.4, 0x38444a, 0.46);
  layer.lineBetween(
    rect.x + rect.width - 80,
    rect.y + 42,
    rect.x + rect.width - 28,
    rect.y + 18,
  );
  layer.lineBetween(
    rect.x + rect.width - 50,
    rect.y + 30,
    rect.x + rect.width - 50,
    rect.y + 74,
  );
}

function drawV2SquarePersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const benchY = centerY + rect.height * 0.35;

  drawAuthoredBench(layer, rect.x + 66, benchY, 0);
  drawAuthoredBench(layer, rect.x + rect.width - 66, benchY, 0);
  drawAuthoredBench(layer, centerX, rect.y + 34, Math.PI / 2);
  drawAuthoredPlanter(layer, rect.x + 42, rect.y + 36);
  drawAuthoredPlanter(layer, rect.x + rect.width - 42, rect.y + 36);
  drawAuthoredLamp(layer, rect.x + 42, rect.y + rect.height - 34, 0.82);
  drawAuthoredLamp(
    layer,
    rect.x + rect.width - 42,
    rect.y + rect.height - 34,
    0.82,
  );
  drawAuthoredLamp(layer, rect.x + 42, rect.y + 38, 0.72);
  drawAuthoredLamp(layer, rect.x + rect.width - 42, rect.y + 38, 0.72);

  layer.fillStyle(0xffffff, 0.1);
  layer.fillEllipse(centerX - 4, centerY - 5, 72, 34);
  layer.lineStyle(1.8, 0xf6fbff, 0.34);
  layer.strokeEllipse(centerX, centerY, 56, 28);
  layer.lineStyle(1.4, 0xa8d8e6, 0.44);
  layer.strokeEllipse(centerX, centerY - 2, 34, 16);
  layer.fillStyle(0xffe5a8, 0.08);
  layer.fillEllipse(centerX, centerY + 9, 118, 20);
}

function drawV2FreightYardPersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  drawCrateStack(layer, rect.x + 38, rect.y + rect.height - 34);
  drawBarrel(layer, rect.x + rect.width - 42, rect.y + rect.height - 40);
  drawToolStand(layer, rect.x + rect.width - 70, rect.y + 78);
  layer.fillStyle(0x071116, 0.1);
  layer.fillEllipse(
    rect.x + rect.width / 2,
    rect.y + rect.height - 28,
    rect.width * 0.76,
    20,
  );
  layer.lineStyle(4, 0x2c3438, 0.48);
  layer.lineBetween(
    rect.x + 34,
    rect.y + 36,
    rect.x + rect.width - 34,
    rect.y + 36,
  );
  layer.lineStyle(2, 0xcfa767, 0.34);
  layer.lineBetween(
    rect.x + 62,
    rect.y + 46,
    rect.x + rect.width - 60,
    rect.y + 46,
  );
  layer.fillStyle(0x977653, 0.42);
  for (let x = rect.x + 56; x < rect.x + rect.width - 58; x += 74) {
    layer.fillRoundedRect(x, rect.y + rect.height - 21, 32, 5, 3);
  }
}

function drawV2StreetLifeVehicles(
  layer: PhaserType.GameObjects.Graphics,
  landmarks: {
    cafe?: VisualScene["landmarks"][number];
    freightYard?: VisualScene["landmarks"][number];
    pier?: VisualScene["landmarks"][number];
    square?: VisualScene["landmarks"][number];
  },
) {
  if (landmarks.cafe) {
    const rect = landmarks.cafe.rect;
    drawParkedBicycle(layer, rect.x + 82, rect.y + rect.height + 16, 1.14);
    drawSmallDeliveryVan(
      layer,
      rect.x + rect.width * 0.52,
      rect.y + rect.height + 42,
      1.08,
    );
  }

  if (landmarks.freightYard) {
    const rect = landmarks.freightYard.rect;
    drawCargoHandcart(
      layer,
      rect.x + rect.width + 34,
      rect.y + rect.height * 0.5,
      0.95,
    );
  }
}

function drawV2PierPersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x071116, 0.16);
  layer.fillRoundedRect(
    rect.x + 18,
    rect.y + rect.height - 16,
    rect.width - 36,
    26,
    8,
  );
  layer.fillStyle(0x1b3944, 0.18);
  layer.fillRoundedRect(
    rect.x + 20,
    rect.y + rect.height - 5,
    rect.width - 40,
    13,
    6,
  );
  layer.lineStyle(2, 0xd6bc82, 0.26);
  for (let x = rect.x + 28; x < rect.x + rect.width - 24; x += 38) {
    layer.lineBetween(x, rect.y + 24, x, rect.y + rect.height - 18);
    layer.lineStyle(1.6, 0xf3d39a, 0.1);
    layer.lineBetween(x + 7, rect.y + 28, x + 7, rect.y + rect.height - 24);
    layer.lineStyle(2, 0xd6bc82, 0.26);
  }

  const bollards = [
    { x: rect.x + 48, y: rect.y + 38 },
    { x: rect.x + 136, y: rect.y + 54 },
    { x: rect.x + rect.width - 138, y: rect.y + 46 },
    { x: rect.x + rect.width - 52, y: rect.y + 68 },
  ];
  for (const bollard of bollards) {
    drawBollard(layer, bollard.x, bollard.y);
    layer.fillStyle(0xd8bf7a, 0.08);
    layer.fillEllipse(bollard.x, bollard.y + 34, 18, 38);
  }
  drawSaggingRope(
    layer,
    bollards[0].x,
    bollards[0].y,
    bollards[1].x,
    bollards[1].y,
  );
  drawSaggingRope(
    layer,
    bollards[2].x,
    bollards[2].y,
    bollards[3].x,
    bollards[3].y,
  );
  drawRopeCoil(layer, rect.x + rect.width - 94, rect.y + 100);
  drawDockLadder(layer, rect.x + 116, rect.y + rect.height - 32);
  drawAuthoredBoat(
    layer,
    rect.x + rect.width - 106,
    rect.y + rect.height - 42,
    -0.08,
    0.72,
  );
  layer.lineStyle(2, 0xcdb68a, 0.45);
  layer.lineBetween(
    rect.x + rect.width - 132,
    rect.y + rect.height - 45,
    rect.x + rect.width - 94,
    rect.y + 103,
  );
  layer.fillStyle(0xf4e3b6, 0.08);
  layer.fillEllipse(
    rect.x + rect.width - 110,
    rect.y + rect.height - 20,
    62,
    12,
  );
}

function drawV2CourtyardPersonality(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  drawPump(layer, rect.x + 78, rect.y + 92);
  drawLaundryLine(layer, rect.x + 124, rect.y + 48, rect.x + rect.width - 42);
  drawBarrel(layer, rect.x + rect.width - 56, rect.y + rect.height - 44);
  drawCrateStack(layer, rect.x + rect.width - 92, rect.y + rect.height - 40);
  layer.fillStyle(0xd8c49a, 0.18);
  layer.fillRoundedRect(
    rect.x + 28,
    rect.y + rect.height - 42,
    rect.width - 56,
    10,
    5,
  );
}

function drawSaggingRope(
  layer: PhaserType.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  layer.lineStyle(3, 0xc9ad79, 0.76);
  let previousX = startX;
  let previousY = startY;
  for (let step = 1; step <= 12; step += 1) {
    const ratio = step / 12;
    const x = startX + (endX - startX) * ratio;
    const y = startY + (endY - startY) * ratio + Math.sin(ratio * Math.PI) * 14;
    layer.lineBetween(previousX, previousY, x, y);
    previousX = x;
    previousY = y;
  }
}

function drawV2VegetationCanopies(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  forEachSurfaceDraftCell(visualScene, (cell) => {
    if (
      cell.kind !== "trees" &&
      cell.kind !== "bushes" &&
      cell.kind !== "grass"
    ) {
      return;
    }

    const seed = cell.col * 19 + cell.row * 31;
    const centerX = cell.x + cell.width / 2 + Math.sin(seed) * 5;
    const centerY = cell.y + cell.height / 2 + Math.cos(seed * 0.7) * 4;

    if (cell.kind === "grass") {
      layer.lineStyle(1.2, 0xd5e5a8, 0.12);
      for (let blade = 0; blade < 3; blade += 1) {
        const x =
          cell.x + 10 + ((seed + blade * 13) % Math.max(cell.width - 18, 1));
        const y =
          cell.y + 12 + ((seed + blade * 17) % Math.max(cell.height - 18, 1));
        layer.lineBetween(x, y + 4, x + 10, y);
      }
      layer.fillStyle(0xf3e4b2, 0.055);
      layer.fillEllipse(centerX - 4, centerY - 2, cell.width * 0.42, 8);
      return;
    }

    layer.fillStyle(0x132016, 0.13);
    layer.fillEllipse(centerX + 8, centerY + 17, cell.width * 0.66, 15);

    const baseColor = cell.kind === "trees" ? 0x436f3c : 0x4f7743;
    const darkColor = cell.kind === "trees" ? 0x2f5430 : 0x365f35;
    const lightColor = cell.kind === "trees" ? 0x86a968 : 0x95b36f;
    const radius = cell.kind === "trees" ? 13 : 9;

    layer.fillStyle(darkColor, 0.92);
    layer.fillCircle(centerX - 9, centerY + 5, radius * 1.08);
    layer.fillCircle(centerX + 8, centerY + 3, radius * 0.92);
    layer.fillCircle(centerX + 1, centerY + 10, radius * 0.86);
    layer.fillStyle(baseColor, 0.96);
    layer.fillCircle(centerX - 3, centerY - 4, radius * 1.08);
    layer.fillCircle(centerX + 12, centerY - 7, radius * 0.84);
    layer.fillCircle(centerX - 16, centerY - 3, radius * 0.72);
    layer.fillStyle(lightColor, 0.32);
    layer.fillCircle(centerX - 7, centerY - 10, radius * 0.42);
    layer.fillCircle(centerX + 8, centerY - 12, radius * 0.3);
    layer.fillStyle(0xf2e9bb, 0.16);
    layer.fillEllipse(centerX - 4, centerY - 14, radius * 1.1, 3.8);
  });
}

function drawV2AtmosphereAndLighting(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  drawV2WindowWarmth(layer, visualScene);
  drawV2WaterfrontHaze(layer, visualScene);
  drawV2MorningLightWash(layer, visualScene);
}

function drawV2WindowWarmth(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const visualModule of visualScene.landmarkModules) {
    if (visualModule.kind !== "window_row" && visualModule.kind !== "entry") {
      continue;
    }

    const glowAlpha = visualModule.kind === "entry" ? 0.075 : 0.052;
    layer.fillStyle(0xffe2a3, glowAlpha);
    layer.fillRoundedRect(
      visualModule.rect.x - 5,
      visualModule.rect.y - 5,
      visualModule.rect.width + 10,
      visualModule.rect.height + 10,
      Math.max(8, visualModule.rect.radius ?? 8),
    );
    layer.fillStyle(0xffffff, glowAlpha * 0.42);
    layer.fillRoundedRect(
      visualModule.rect.x + 4,
      visualModule.rect.y + 4,
      Math.max(visualModule.rect.width * 0.42, 8),
      Math.max(visualModule.rect.height * 0.22, 4),
      4,
    );
  }
}

function drawV2WaterfrontHaze(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const waterGrid = buildTerrainDraftGrid(visualScene);
  if (!waterGrid) {
    return;
  }

  const waterSegments = buildTerrainDraftWaterSegments(waterGrid);
  for (const segment of waterSegments) {
    if (segment.width < 120) {
      continue;
    }

    layer.fillStyle(0xe4f2e6, 0.035);
    layer.fillRoundedRect(
      segment.x + 8,
      segment.y + 10,
      segment.width - 16,
      Math.min(segment.height * 0.5, 30),
      10,
    );
    layer.fillStyle(0xffd89a, 0.026);
    layer.fillEllipse(
      segment.x + segment.width * 0.55,
      segment.y + segment.height * 0.32,
      Math.min(segment.width * 0.58, 260),
      18,
    );
  }
}

function drawV2MorningLightWash(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  layer.fillStyle(0xffe2a8, 0.035);
  layer.fillRoundedRect(0, 0, visualScene.width, visualScene.height * 0.42, 0);
  layer.fillStyle(0xffffff, 0.026);
  layer.fillEllipse(
    visualScene.width * 0.18,
    visualScene.height * 0.12,
    visualScene.width * 0.7,
    visualScene.height * 0.22,
  );
  layer.fillStyle(0x061116, 0.055);
  layer.fillRoundedRect(
    0,
    visualScene.height * 0.88,
    visualScene.width,
    visualScene.height * 0.12,
    0,
  );
}

function drawCafeTerraceCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  layer.fillStyle(0x7b5d44, 0.96);
  layer.fillRoundedRect(
    cluster.rect.x,
    cluster.rect.y + 12,
    cluster.rect.width,
    8,
    4,
  );
  for (
    let x = cluster.rect.x + 12;
    x < cluster.rect.x + cluster.rect.width - 12;
    x += 32
  ) {
    layer.fillRoundedRect(x, cluster.rect.y, 4, cluster.rect.height - 18, 2);
  }
  for (const tablePoint of cluster.points ?? []) {
    drawAuthoredTerraceTable(layer, tablePoint.x, tablePoint.y);
  }
  drawMenuBoard(layer, cluster.rect.x + 28, cluster.rect.y + 28);
  drawAuthoredPlanter(
    layer,
    cluster.rect.x + 20,
    cluster.rect.y + cluster.rect.height - 12,
  );
  drawAuthoredPlanter(
    layer,
    cluster.rect.x + cluster.rect.width - 20,
    cluster.rect.y + cluster.rect.height - 12,
  );
}

function drawBenchPairCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const benchPoint of cluster.points ?? []) {
    drawAuthoredBench(layer, benchPoint.x, benchPoint.y);
  }
}

function drawPlanterPairCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const planterPoint of cluster.points ?? []) {
    drawAuthoredPlanter(layer, planterPoint.x, planterPoint.y);
  }
}

function drawWorkshopStockCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const stockPoint of cluster.points ?? []) {
    drawCrateStack(layer, stockPoint.x, stockPoint.y);
  }
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width - 30,
    cluster.rect.y + 34,
  );
  drawToolStand(layer, cluster.rect.x + 42, cluster.rect.y + 24);
}

function drawYardServiceCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  const [pumpPoint = { x: cluster.rect.x + 54, y: cluster.rect.y + 56 }] =
    cluster.points ?? [];
  drawPump(layer, pumpPoint.x, pumpPoint.y);
  drawLaundryLine(
    layer,
    cluster.rect.x + 82,
    cluster.rect.y + 18,
    cluster.rect.x + cluster.rect.width - 26,
  );
  drawCrateStack(
    layer,
    cluster.rect.x + cluster.rect.width - 44,
    cluster.rect.y + cluster.rect.height - 30,
  );
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width / 2,
    cluster.rect.y + cluster.rect.height - 34,
  );
}

function drawHarborMooringCluster(
  layer: PhaserType.GameObjects.Graphics,
  cluster: VisualScene["propClusters"][number],
) {
  for (const mooringPoint of cluster.points ?? []) {
    drawBollard(layer, mooringPoint.x, mooringPoint.y);
    drawRopeCoil(layer, mooringPoint.x + 18, mooringPoint.y + 8);
  }
  drawDockLadder(layer, cluster.rect.x + 112, cluster.rect.y + 24);
  drawCrateStack(
    layer,
    cluster.rect.x + cluster.rect.width - 58,
    cluster.rect.y + 28,
  );
  drawBarrel(
    layer,
    cluster.rect.x + cluster.rect.width - 104,
    cluster.rect.y + 34,
  );
}

function drawAuthoredSceneGround(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  layer.fillStyle(0x101c22, 1);
  layer.fillRect(0, 0, visualScene.width, visualScene.height);

  const townBody = {
    x: 92,
    y: 86,
    width: visualScene.width - 184,
    height: visualScene.height - 128,
  };
  layer.fillStyle(0x202f35, 1);
  layer.fillRoundedRect(
    townBody.x,
    townBody.y,
    townBody.width,
    townBody.height,
    26,
  );
  layer.lineStyle(2, 0x40515a, 0.7);
  layer.strokeRoundedRect(
    townBody.x,
    townBody.y,
    townBody.width,
    townBody.height,
    26,
  );

  const promenade = { x: 170, y: 184, width: 1360, height: 286, radius: 18 };
  const mainStreet = { x: 160, y: 454, width: 1402, height: 348, radius: 16 };
  const southWalk = { x: 154, y: 820, width: 1428, height: 198, radius: 14 };

  drawAuthoredPavingField(layer, promenade, {
    accent: 0xd6c59f,
    base: 0xcfbea2,
    line: 0xb5a58d,
  });
  drawAuthoredPavingField(layer, mainStreet, {
    accent: 0xd4c2a5,
    base: 0xcab89d,
    line: 0xbaa88f,
  });
  drawAuthoredPavingField(layer, southWalk, {
    accent: 0xd8c8ad,
    base: 0xcdbd9f,
    line: 0xb7a78e,
  });

  for (const waterRegion of visualScene.waterRegions) {
    const { rect } = waterRegion;
    layer.fillStyle(
      waterRegion.baseColor,
      waterRegion.tag === "shore_foam" ? 0.32 : 0.98,
    );
    layer.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  const dock = visualScene.landmarks.find(
    (landmark) => landmark.style === "dock",
  );
  if (dock) {
    layer.fillStyle(0x7f6040, 0.96);
    layer.fillRoundedRect(
      dock.rect.x,
      dock.rect.y,
      dock.rect.width,
      dock.rect.height,
      12,
    );
    layer.lineStyle(2, 0xa88056, 0.28);
    for (
      let x = dock.rect.x + 18;
      x < dock.rect.x + dock.rect.width - 18;
      x += 22
    ) {
      layer.lineBetween(
        x,
        dock.rect.y + 8,
        x,
        dock.rect.y + dock.rect.height - 8,
      );
    }
  }

  drawAuthoredFringeBlocks(layer, visualScene);
}

function drawAuthoredPavingField(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
  palette: {
    accent: number;
    base: number;
    line: number;
  },
) {
  layer.fillStyle(palette.base, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.lineStyle(1, palette.line, 0.24);

  for (let x = rect.x + 16; x < rect.x + rect.width - 16; x += 28) {
    layer.lineBetween(x, rect.y + 12, x, rect.y + rect.height - 12);
  }

  for (let y = rect.y + 16; y < rect.y + rect.height - 16; y += 28) {
    layer.lineBetween(rect.x + 12, y, rect.x + rect.width - 12, y);
  }

  layer.fillStyle(palette.accent, 0.22);
  for (let y = rect.y + 12; y < rect.y + rect.height - 12; y += 56) {
    layer.fillRect(rect.x + 12, y, rect.width - 24, 6);
  }
}

function drawAuthoredFringeBlocks(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  const blocks = [
    { x: 124, y: 110, width: 502, height: 92 },
    { x: 668, y: 112, width: 822, height: 86 },
    { x: 122, y: 1040, width: 862, height: 142 },
    { x: 1180, y: 932, width: 360, height: 138 },
    { x: 92, y: 248, width: 110, height: 716 },
    { x: 1558, y: 154, width: 188, height: 850 },
  ];

  layer.fillStyle(0x17242b, 1);
  for (const block of blocks) {
    layer.fillRoundedRect(block.x, block.y, block.width, block.height, 16);
  }

  layer.lineStyle(2, 0x31444d, 0.34);
  for (const block of blocks) {
    layer.strokeRoundedRect(block.x, block.y, block.width, block.height, 16);
  }

  layer.lineStyle(1, 0x3f5660, 0.22);
  for (const block of blocks) {
    for (let y = block.y + 18; y < block.y + block.height - 16; y += 32) {
      layer.lineBetween(block.x + 14, y, block.x + block.width - 14, y);
    }
  }

  void visualScene;
}

function drawAuthoredSceneStructures(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
) {
  for (const landmark of visualScene.landmarks) {
    switch (landmark.style) {
      case "boarding-house":
        drawBoardingHouseFacade(layer, landmark.rect);
        break;
      case "cafe":
        drawCafeFacade(layer, landmark.rect);
        break;
      case "courtyard":
        drawCourtyardSpace(layer, landmark.rect);
        break;
      case "dock":
        drawDockEdgeDetails(layer, landmark.rect);
        break;
      case "square":
        drawSquareLandmark(layer, landmark.rect);
        break;
      case "workshop":
        drawWorkshopFacade(layer, landmark.rect);
        break;
      case "yard":
        drawYardLandmark(layer, landmark.rect);
        break;
      default:
        break;
    }
  }

  for (const prop of visualScene.props) {
    switch (prop.kind) {
      case "bench":
        drawAuthoredBench(layer, prop.x, prop.y, prop.rotation);
        break;
      case "boat":
        break;
      case "lamp":
        drawAuthoredLamp(layer, prop.x, prop.y, prop.scale ?? 1);
        break;
      case "planter":
        drawAuthoredPlanter(layer, prop.x, prop.y);
        break;
      case "terrace-table":
        drawAuthoredTerraceTable(layer, prop.x, prop.y);
        break;
      default:
        break;
    }
  }
}

function drawCafeFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x3e5548, 1);
  layer.fillRoundedRect(rect.x + 18, rect.y, rect.width - 36, 30, 14);
  layer.fillStyle(0xe6dec2, 1);
  layer.fillRoundedRect(rect.x, rect.y + 28, rect.width, rect.height - 28, 18);
  layer.fillStyle(0xb37e59, 0.96);
  layer.fillRect(rect.x + 10, rect.y + 96, rect.width - 20, 72);
  layer.fillStyle(0x714f37, 0.94);
  layer.fillRoundedRect(rect.x + 40, rect.y + 130, rect.width - 80, 58, 12);

  const awningY = rect.y + 82;
  const awningSegments = 8;
  const awningWidth = (rect.width - 28) / awningSegments;
  for (let index = 0; index < awningSegments; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0x3e9f6f : 0xf3efe4, 1);
    layer.fillRect(rect.x + 14 + index * awningWidth, awningY, awningWidth, 28);
  }

  layer.fillStyle(0xf8e9be, 0.95);
  layer.fillRoundedRect(rect.x + 30, rect.y + 138, 60, 42, 8);
  layer.fillRoundedRect(rect.x + rect.width - 90, rect.y + 138, 60, 42, 8);
  layer.fillStyle(0x79563d, 1);
  layer.fillRoundedRect(rect.x + rect.width / 2 - 28, rect.y + 126, 56, 62, 10);
  layer.lineStyle(2, 0xceb883, 0.9);
  layer.strokeRoundedRect(rect.x + 58, rect.y + 44, rect.width - 116, 34, 10);
}

function drawBoardingHouseFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x55656d, 1);
  layer.fillRoundedRect(rect.x, rect.y, rect.width, 42, 18);
  layer.fillStyle(0xc3b49c, 1);
  layer.fillRoundedRect(rect.x, rect.y + 36, rect.width, rect.height - 36, 18);
  layer.fillStyle(0xb06d58, 0.92);
  layer.fillRect(rect.x + 12, rect.y + 78, rect.width - 24, 64);
  layer.fillStyle(0x6c4938, 1);
  layer.fillRoundedRect(
    rect.x + rect.width / 2 - 22,
    rect.y + rect.height - 78,
    44,
    68,
    10,
  );
  layer.fillStyle(0xf2dfb6, 0.92);
  for (let index = 0; index < 4; index += 1) {
    const x = rect.x + 36 + index * 58;
    layer.fillRoundedRect(x, rect.y + 58, 30, 40, 6);
    layer.fillRoundedRect(x, rect.y + 114, 30, 34, 6);
  }
  layer.fillStyle(0x9a7a63, 1);
  layer.fillRoundedRect(
    rect.x + rect.width / 2 - 34,
    rect.y + rect.height - 20,
    68,
    18,
    8,
  );
}

function drawWorkshopFacade(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x59656f, 1);
  layer.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 16);
  layer.fillStyle(0x8e5e42, 0.92);
  layer.fillRect(rect.x + 10, rect.y + 54, rect.width - 20, 56);
  layer.fillStyle(0xe0d6bb, 0.96);
  const segments = 6;
  const segmentWidth = (rect.width - 24) / segments;
  for (let index = 0; index < segments; index += 1) {
    layer.fillStyle(index % 2 === 0 ? 0xf1f0ea : 0xc8824b, 1);
    layer.fillRect(
      rect.x + 12 + index * segmentWidth,
      rect.y + 116,
      segmentWidth,
      28,
    );
  }
  layer.fillStyle(0x36454d, 1);
  layer.fillRoundedRect(rect.x + 54, rect.y + 138, rect.width - 108, 48, 10);
  layer.fillStyle(0xd4c9ac, 0.88);
  layer.fillRoundedRect(rect.x + 18, rect.y + 144, 24, 34, 4);
  layer.fillRoundedRect(rect.x + rect.width - 42, rect.y + 144, 24, 34, 4);
}

function drawSquareLandmark(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0xddcfaf, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.lineStyle(1, 0xc7b898, 0.32);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 30) {
    layer.lineBetween(x, rect.y + 14, x, rect.y + rect.height - 14);
  }
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 30) {
    layer.lineBetween(rect.x + 14, y, rect.x + rect.width - 14, y);
  }
  layer.fillStyle(0x8c948f, 0.96);
  layer.fillEllipse(rect.x + rect.width / 2, rect.y + rect.height / 2, 42, 42);
  layer.fillStyle(0xc8d8df, 0.72);
  layer.fillEllipse(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2 - 2,
    20,
    20,
  );
}

function drawYardLandmark(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x8d7458, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 16,
  );
  layer.fillStyle(0x6d5844, 0.82);
  for (let y = rect.y + 18; y < rect.y + rect.height - 18; y += 34) {
    layer.fillRect(rect.x + 14, y, rect.width - 28, 10);
  }
  layer.fillStyle(0x7f694f, 1);
  layer.fillRoundedRect(rect.x + 22, rect.y + 22, 54, 44, 8);
  layer.fillRoundedRect(rect.x + rect.width - 78, rect.y + 40, 52, 40, 8);
}

function drawCourtyardSpace(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x6f7f5a, 0.98);
  layer.fillRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius ?? 18,
  );
  layer.fillStyle(0x566746, 0.42);
  layer.fillRoundedRect(
    rect.x + 12,
    rect.y + 12,
    rect.width - 24,
    rect.height - 24,
    14,
  );
  layer.fillStyle(0x8e8b78, 0.96);
  layer.fillRoundedRect(rect.x + rect.width / 2 - 16, rect.y + 68, 32, 32, 8);
  layer.lineStyle(3, 0xc7d8e1, 0.72);
  layer.lineBetween(
    rect.x + rect.width / 2,
    rect.y + 82,
    rect.x + rect.width / 2,
    rect.y + 44,
  );
}

function drawDockEdgeDetails(
  layer: PhaserType.GameObjects.Graphics,
  rect: VisualRect,
) {
  layer.fillStyle(0x9d794f, 0.94);
  for (let x = rect.x + 18; x < rect.x + rect.width - 18; x += 54) {
    layer.fillRoundedRect(x, rect.y + rect.height - 22, 12, 22, 4);
  }
  layer.fillStyle(0x6a4f36, 1);
  layer.fillRoundedRect(rect.x + 24, rect.y + 28, 80, 14, 6);
  layer.fillRoundedRect(rect.x + rect.width - 108, rect.y + 50, 74, 14, 6);
}

function drawAuthoredLamp(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
) {
  layer.fillStyle(0x0c1318, 0.22);
  layer.fillEllipse(x, y + 8 * scale, 12 * scale, 6 * scale);
  layer.fillStyle(0xffe0a0, 0.07);
  layer.fillEllipse(x + 4 * scale, y + 4 * scale, 34 * scale, 13 * scale);
  layer.fillStyle(0x3a474d, 1);
  layer.fillRoundedRect(
    x - 2 * scale,
    y - 18 * scale,
    4 * scale,
    26 * scale,
    2,
  );
  layer.fillRoundedRect(x - 5 * scale, y + 6 * scale, 10 * scale, 4 * scale, 2);
  layer.fillStyle(0xf3dfa6, 0.98);
  layer.fillRoundedRect(
    x - 5 * scale,
    y - 28 * scale,
    10 * scale,
    12 * scale,
    4,
  );
  layer.fillStyle(0xffffff, 0.2);
  layer.fillRoundedRect(x - 2 * scale, y - 26 * scale, 4 * scale, 5 * scale, 2);
  layer.fillStyle(0xf3dfa6, 0.18);
  layer.fillCircle(x, y - 22 * scale, 11 * scale);
}

function drawAuthoredBench(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  rotation = 0,
) {
  if (Math.abs(rotation) > 0.4) {
    layer.fillStyle(0x795c42, 1);
    layer.fillRoundedRect(x - 8, y - 26, 16, 50, 5);
    layer.fillRoundedRect(x - 18, y - 20, 6, 36, 3);
    layer.fillRoundedRect(x + 12, y - 20, 6, 36, 3);
    return;
  }

  layer.fillStyle(0x795c42, 1);
  layer.fillRoundedRect(x - 30, y - 8, 60, 16, 5);
  layer.fillRoundedRect(x - 24, y - 18, 48, 6, 3);
  layer.fillStyle(0xd4b178, 0.28);
  layer.fillRoundedRect(x - 26, y - 16, 52, 3, 2);
  layer.fillRoundedRect(x - 26, y - 5, 52, 3, 2);
  layer.fillStyle(0x3c2d22, 0.28);
  layer.fillEllipse(x + 5, y + 14, 68, 9);
  layer.fillStyle(0x795c42, 1);
  layer.fillRoundedRect(x - 20, y + 6, 6, 18, 3);
  layer.fillRoundedRect(x + 14, y + 6, 6, 18, 3);
}

function drawAuthoredPlanter(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x071116, 0.12);
  layer.fillEllipse(x + 3, y + 8, 35, 9);
  layer.fillStyle(0x6e5b4b, 1);
  layer.fillRoundedRect(x - 14, y - 10, 28, 20, 6);
  layer.fillStyle(0xd0aa78, 0.22);
  layer.fillRoundedRect(x - 10, y - 8, 20, 5, 3);
  layer.fillStyle(0x4e7747, 0.98);
  layer.fillCircle(x - 6, y - 6, 10);
  layer.fillCircle(x + 2, y - 10, 9);
  layer.fillCircle(x + 9, y - 5, 8);
  layer.fillStyle(0x99ba6c, 0.36);
  layer.fillCircle(x - 5, y - 12, 3.6);
  layer.fillCircle(x + 7, y - 11, 3);
}

function drawAuthoredTerraceTable(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x071116, 0.12);
  layer.fillEllipse(x + 4, y + 18, 44, 9);
  layer.fillStyle(0x694f38, 1);
  layer.fillCircle(x, y, 12);
  layer.fillStyle(0xc9975c, 0.38);
  layer.fillCircle(x - 4, y - 3, 5);
  layer.fillRoundedRect(x - 1.5, y + 6, 3, 18, 1.5);
  layer.fillRoundedRect(x - 22, y + 8, 12, 4, 2);
  layer.fillRoundedRect(x + 10, y + 8, 12, 4, 2);
  layer.fillRoundedRect(x - 18, y - 2, 8, 3, 2);
  layer.fillRoundedRect(x + 10, y - 2, 8, 3, 2);
}

function drawParkedBicycle(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
) {
  layer.fillStyle(0x071116, 0.16);
  layer.fillEllipse(x + 5 * scale, y + 9 * scale, 48 * scale, 8 * scale);
  layer.lineStyle(2.4 * scale, 0x334248, 0.8);
  layer.strokeCircle(x - 14 * scale, y + 2 * scale, 8 * scale);
  layer.strokeCircle(x + 16 * scale, y + 2 * scale, 8 * scale);
  layer.lineStyle(2.2 * scale, 0x5d4a38, 0.9);
  layer.lineBetween(
    x - 14 * scale,
    y + 2 * scale,
    x - 1 * scale,
    y - 10 * scale,
  );
  layer.lineBetween(
    x - 1 * scale,
    y - 10 * scale,
    x + 16 * scale,
    y + 2 * scale,
  );
  layer.lineBetween(x - 6 * scale, y + 2 * scale, x + 7 * scale, y + 2 * scale);
  layer.lineStyle(1.7 * scale, 0xc6a873, 0.52);
  layer.lineBetween(
    x - 1 * scale,
    y - 10 * scale,
    x + 9 * scale,
    y - 13 * scale,
  );
  layer.lineBetween(
    x + 6 * scale,
    y - 7 * scale,
    x + 16 * scale,
    y - 13 * scale,
  );
}

function drawCargoHandcart(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
) {
  layer.fillStyle(0x071116, 0.16);
  layer.fillEllipse(x + 8 * scale, y + 14 * scale, 64 * scale, 11 * scale);
  layer.fillStyle(0x6f583e, 0.96);
  layer.fillRoundedRect(
    x - 20 * scale,
    y - 12 * scale,
    42 * scale,
    21 * scale,
    5 * scale,
  );
  layer.fillStyle(0xb08b5e, 0.28);
  layer.fillRoundedRect(
    x - 15 * scale,
    y - 8 * scale,
    32 * scale,
    6 * scale,
    3 * scale,
  );
  layer.lineStyle(2.4 * scale, 0x3d3026, 0.72);
  layer.lineBetween(
    x + 18 * scale,
    y - 3 * scale,
    x + 36 * scale,
    y - 12 * scale,
  );
  layer.lineBetween(
    x + 18 * scale,
    y + 3 * scale,
    x + 36 * scale,
    y + 12 * scale,
  );
  layer.fillStyle(0x273238, 0.9);
  layer.fillCircle(x - 14 * scale, y + 12 * scale, 5 * scale);
  layer.fillCircle(x + 14 * scale, y + 12 * scale, 5 * scale);
}

function drawSmallDeliveryVan(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
) {
  layer.fillStyle(0x071116, 0.15);
  layer.fillEllipse(x + 8 * scale, y + 16 * scale, 76 * scale, 12 * scale);
  layer.fillStyle(0xbeb6a0, 0.92);
  layer.fillRoundedRect(
    x - 34 * scale,
    y - 12 * scale,
    68 * scale,
    26 * scale,
    8 * scale,
  );
  layer.fillStyle(0x8e9aa0, 0.68);
  layer.fillRoundedRect(
    x - 20 * scale,
    y - 8 * scale,
    22 * scale,
    10 * scale,
    4 * scale,
  );
  layer.fillStyle(0x7b6449, 0.45);
  layer.fillRoundedRect(
    x + 7 * scale,
    y - 6 * scale,
    18 * scale,
    8 * scale,
    3 * scale,
  );
  layer.fillStyle(0x263137, 0.9);
  layer.fillCircle(x - 18 * scale, y + 15 * scale, 5 * scale);
  layer.fillCircle(x + 21 * scale, y + 15 * scale, 5 * scale);
  layer.fillStyle(0xf1d9a4, 0.38);
  layer.fillRoundedRect(
    x - 31 * scale,
    y - 9 * scale,
    8 * scale,
    4 * scale,
    2 * scale,
  );
}

function drawMenuBoard(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 14, 18, 6);
  layer.fillStyle(0x78593f, 1);
  layer.fillRoundedRect(x - 4, y - 4, 8, 24, 4);
  layer.fillRoundedRect(x - 12, y + 18, 24, 4, 2);
  layer.fillStyle(0x38463f, 1);
  layer.fillRoundedRect(x - 16, y - 20, 32, 24, 6);
  layer.lineStyle(2, 0xd7bc79, 0.72);
  layer.strokeRoundedRect(x - 16, y - 20, 32, 24, 6);
  layer.lineStyle(1, 0xf2dfaa, 0.5);
  layer.lineBetween(x - 9, y - 13, x + 9, y - 13);
  layer.lineBetween(x - 9, y - 7, x + 7, y - 7);
}

function drawCrateStack(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.1);
  layer.fillEllipse(x + 2, y + 10, 34, 8);
  const crates = [
    { x: x - 18, y: y - 12, width: 26, height: 20 },
    { x: x - 2, y: y - 24, width: 24, height: 18 },
  ];
  for (const crate of crates) {
    layer.fillStyle(0x8b6848, 1);
    layer.fillRoundedRect(crate.x, crate.y, crate.width, crate.height, 4);
    layer.fillStyle(0xc59b68, 0.2);
    layer.fillRoundedRect(crate.x + 4, crate.y + 4, crate.width - 8, 5, 3);
    layer.lineStyle(2, 0xa88460, 0.5);
    layer.strokeRoundedRect(crate.x, crate.y, crate.width, crate.height, 4);
    layer.lineBetween(
      crate.x + 4,
      crate.y + 4,
      crate.x + crate.width - 4,
      crate.y + crate.height - 4,
    );
    layer.lineBetween(
      crate.x + crate.width - 4,
      crate.y + 4,
      crate.x + 4,
      crate.y + crate.height - 4,
    );
  }
}

function drawBarrel(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.1);
  layer.fillEllipse(x, y + 10, 22, 6);
  layer.fillStyle(0x7c5b42, 1);
  layer.fillEllipse(x, y - 10, 18, 8);
  layer.fillRoundedRect(x - 10, y - 10, 20, 28, 6);
  layer.fillStyle(0xc2a070, 0.82);
  layer.fillRect(x - 10, y - 2, 20, 3);
  layer.fillRect(x - 10, y + 8, 20, 3);
}

function drawToolStand(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.08);
  layer.fillEllipse(x, y + 14, 24, 6);
  layer.fillStyle(0x6e5640, 1);
  layer.fillRoundedRect(x - 12, y - 18, 24, 38, 6);
  layer.fillStyle(0xced7dc, 0.92);
  layer.fillRoundedRect(x - 8, y - 10, 4, 20, 2);
  layer.fillRoundedRect(x - 1, y - 12, 4, 22, 2);
  layer.fillRoundedRect(x + 6, y - 8, 4, 18, 2);
  layer.fillStyle(0x8a6b4b, 1);
  layer.fillRect(x - 9, y - 14, 6, 4);
  layer.fillRect(x + 4, y - 15, 8, 4);
}

function drawPump(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.08);
  layer.fillEllipse(x, y + 16, 28, 8);
  layer.fillStyle(0x728087, 1);
  layer.fillRoundedRect(x - 10, y - 8, 20, 28, 6);
  layer.fillRoundedRect(x - 3, y - 30, 6, 22, 3);
  layer.fillRoundedRect(x + 3, y - 26, 20, 4, 2);
  layer.fillRoundedRect(x + 18, y - 26, 4, 16, 2);
  layer.fillStyle(0x8f6a48, 1);
  layer.fillRoundedRect(x - 14, y + 18, 28, 6, 3);
}

function drawLaundryLine(
  layer: PhaserType.GameObjects.Graphics,
  startX: number,
  y: number,
  endX: number,
) {
  layer.lineStyle(1.6, 0x665548, 0.34);
  layer.lineBetween(startX, y, endX, y + 4);
  const spacing = (endX - startX) / 5;
  for (let index = 0; index < 4; index += 1) {
    const pegX = startX + spacing * (index + 0.7);
    const pegY = y + 1 + index * 0.2;
    layer.lineStyle(1.2, 0x8d7657, 0.28);
    layer.lineBetween(pegX, pegY, pegX, pegY + 7);
    layer.fillStyle(0xd4c39b, 0.16);
    layer.fillRoundedRect(pegX - 2.5, pegY + 6, 5, 2.4, 1.2);
  }
}

function drawBollard(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 12, 18, 6);
  layer.fillStyle(0x5b4d43, 1);
  layer.fillRoundedRect(x - 8, y - 8, 16, 22, 6);
  layer.fillStyle(0xc6a873, 0.88);
  layer.fillRoundedRect(x - 8, y - 10, 16, 5, 2);
}

function drawRopeCoil(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.lineStyle(3, 0xc8ab72, 0.85);
  layer.strokeEllipse(x, y, 18, 10);
  layer.strokeEllipse(x, y, 10, 5);
}

function drawDockLadder(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
) {
  layer.lineStyle(3, 0x61727a, 0.84);
  layer.lineBetween(x - 6, y - 18, x - 6, y + 26);
  layer.lineBetween(x + 6, y - 18, x + 6, y + 26);
  for (let rungY = y - 10; rungY <= y + 20; rungY += 8) {
    layer.lineBetween(x - 6, rungY, x + 6, rungY);
  }
}

function drawAuthoredBoat(
  layer: PhaserType.GameObjects.Graphics,
  x: number,
  y: number,
  rotation: number,
  scale: number,
) {
  const width = 56 * scale;
  const height = 18 * scale;
  layer.fillStyle(0x000000, 0.12);
  layer.fillEllipse(x, y + 10 * scale, width * 0.9, height * 0.78);
  layer.fillStyle(0x805f43, 0.98);
  layer.fillRoundedRect(
    x - width / 2,
    y - height / 2,
    width,
    height,
    8 * scale,
  );
  layer.fillStyle(0x3a2a20, 0.28);
  layer.fillRoundedRect(
    x - width / 2 + 5 * scale,
    y + 1 * scale,
    width - 10 * scale,
    4 * scale,
    2 * scale,
  );
  layer.fillStyle(0xd7c095, 0.82);
  layer.fillRoundedRect(
    x - width / 2 + 8,
    y - 2,
    width - 16,
    4 * scale,
    2 * scale,
  );
  void rotation;
}

function drawAmbientHarborLife(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  waterSegments: TerrainDraftWaterSegment[],
  beat: number,
) {
  const bottomWater = waterSegments
    .filter(
      (segment) => segment.y > visualScene.height * 0.72 && segment.width > 220,
    )
    .sort((a, b) => b.width - a.width)[0];
  const eastWater = waterSegments.find(
    (segment) =>
      segment.x + segment.width > visualScene.width - 96 &&
      segment.y > visualScene.height * 0.22 &&
      segment.y < visualScene.height * 0.72 &&
      segment.width > 40,
  );

  if (bottomWater) {
    const bob = Math.sin(beat * 1.12 + bottomWater.row * 0.44) * 3.4;
    const boatX = bottomWater.x + bottomWater.width * 0.7;
    const boatY = bottomWater.y + bottomWater.height * 0.46 + bob;
    layer.fillStyle(0x071820, 0.2);
    layer.fillEllipse(boatX + 4, boatY + 13, 62, 12);
    drawAuthoredBoat(layer, boatX, boatY, -0.08, 0.74);
    layer.lineStyle(1.8, 0xd6c08f, 0.35);
    layer.lineBetween(
      boatX - 34,
      boatY - 3,
      bottomWater.x + bottomWater.width * 0.52,
      bottomWater.y + 6,
    );
  }

  if (eastWater) {
    const pulse = (Math.sin(beat * 1.7 + eastWater.row * 0.5) + 1) / 2;
    const buoyX = eastWater.x + eastWater.width * 0.54;
    const buoyY = eastWater.y + eastWater.height * 0.5 + pulse * 4;
    layer.fillStyle(0x061821, 0.2);
    layer.fillEllipse(buoyX, buoyY + 5, 18, 5);
    layer.fillStyle(0xd7a446, 0.95);
    layer.fillCircle(buoyX, buoyY, 5.5);
    layer.fillStyle(0xf7e3a8, 0.72);
    layer.fillCircle(buoyX - 1.2, buoyY - 1.4, 2.2);
  }
}

function drawAnimatedWaterLightFields(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  waterSegments: TerrainDraftWaterSegment[],
  beat: number,
) {
  for (const segment of waterSegments) {
    const height = Math.min(segment.height, visualScene.height - segment.y);
    if (height <= 0 || segment.width <= 0) {
      continue;
    }
    if (segment.width < 96 && segment.row % 2 === 1) {
      continue;
    }

    const sweep = positiveModulo(beat * 0.075 + segment.row * 0.11, 1.26);
    const sweepX = segment.x + segment.width * (sweep - 0.13);
    const pulse = (Math.sin(beat * 1.25 + segment.row * 0.7) + 1) / 2;
    const glowWidth = Math.min(Math.max(segment.width * 0.38, 56), 220);
    const glowY = segment.y + height * (0.34 + pulse * 0.24);

    layer.fillStyle(0x83fff0, 0.045 + pulse * 0.035);
    layer.fillEllipse(sweepX, glowY, glowWidth, 12 + pulse * 8);
    layer.fillStyle(0xffd997, 0.035 + pulse * 0.026);
    layer.fillEllipse(
      segment.x + segment.width * (1.08 - sweep * 0.74),
      segment.y + height * (0.2 + pulse * 0.16),
      Math.min(glowWidth * 0.66, 132),
      7 + pulse * 5,
    );

    for (let index = 0; index < 2; index += 1) {
      const sparklePhase =
        beat * (1.4 + index * 0.24) + segment.row * 0.52 + index;
      const sparkleX =
        segment.x +
        positiveModulo(sparklePhase * 31 + index * 57, segment.width);
      const sparkleY =
        segment.y +
        height * (0.18 + ((segment.row + index * 5) % 8) / 11) +
        Math.sin(sparklePhase) * 4;
      const sparkleAlpha = 0.06 + (Math.sin(sparklePhase * 1.7) + 1) * 0.045;
      layer.fillStyle(0xf5fff6, sparkleAlpha);
      layer.fillEllipse(sparkleX, sparkleY, 28, 4.2);
      layer.fillStyle(0x9ff8f0, sparkleAlpha * 0.6);
      layer.fillEllipse(sparkleX + 7, sparkleY + 2.4, 17, 3);
    }
  }
}

function drawV2AnimatedVegetationHighlights(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  beat: number,
) {
  if (visualScene.id !== "south-quay-v2") {
    return;
  }

  forEachSurfaceDraftCell(visualScene, (cell) => {
    if (cell.kind !== "trees" && cell.kind !== "bushes") {
      return;
    }

    const seed = cell.col * 23 + cell.row * 41;
    const sway = Math.sin(beat * 0.72 + seed * 0.19) * 2.2;
    const centerX = cell.x + cell.width / 2 + Math.sin(seed) * 5;
    const centerY = cell.y + cell.height / 2 + Math.cos(seed * 0.7) * 4;
    const alpha = cell.kind === "trees" ? 0.052 : 0.04;

    layer.fillStyle(0xe8efbb, alpha);
    layer.fillEllipse(
      centerX - 7 + sway,
      centerY - 13,
      cell.kind === "trees" ? 18 : 12,
      4,
    );
    layer.fillStyle(0x9fc875, alpha * 0.75);
    layer.fillEllipse(
      centerX + 9 + sway * 0.7,
      centerY - 9,
      cell.kind === "trees" ? 14 : 10,
      3.5,
    );
  });
}

export function drawAnimatedVisualWater(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  now: number,
) {
  const beat = now / 1000;
  const animatedWaterRegions =
    visualScene.waterRegions.filter((region) => region.tag === "water_surface")
      .length > 0
      ? visualScene.waterRegions
          .filter((region) => region.tag === "water_surface")
          .map((region) => ({
            crestColor: region.crestColor,
            intensity: region.intensity,
            rect: region.rect,
          }))
      : visualScene.surfaceZones
          .filter((zone) => zone.kind === "deep_water")
          .map((zone) => ({
            crestColor: 0xd8f4fb,
            intensity: 0.78,
            rect: zone.rect,
          }));

  for (const waterRegion of animatedWaterRegions) {
    const { rect } = waterRegion;
    const swellColor = blendColor(waterRegion.crestColor, 0x2a5f76, 0.52);
    const highlightColor = blendColor(waterRegion.crestColor, 0xffffff, 0.28);

    for (let row = 18; row < rect.height - 8; row += 28) {
      const rowPhase = row * 0.034;
      drawWaveStroke(
        layer,
        rect.x + 12,
        rect.y + row,
        Math.max(rect.width - 24, 0),
        beat,
        rowPhase,
        5.6,
        4.4,
        swellColor,
        0.055 + waterRegion.intensity * 0.03,
      );
      drawWaveStroke(
        layer,
        rect.x + 18,
        rect.y + row - 5,
        Math.max(rect.width - 36, 0),
        beat,
        rowPhase + 0.85,
        3.2,
        2.2,
        highlightColor,
        0.085 + waterRegion.intensity * 0.05,
        {
          packetLength: Math.max(Math.min(rect.width * 0.22, 108), 52),
          softness: 1.9,
          speed: 0.14,
        },
      );
    }

    for (let row = 14; row < rect.height - 10; row += 20) {
      for (let x = rect.x + 20; x < rect.x + rect.width - 28; x += 76) {
        const localWave = beat * 1.5 + row * 0.08 + x * 0.014;
        const drift = Math.sin(localWave) * 8;
        const chopWidth = 24 + (Math.sin(localWave * 0.72) + 1) * 14;
        const chopY = rect.y + row + Math.sin(localWave * 1.18) * 3.4;
        layer.lineStyle(
          1.8,
          waterRegion.crestColor,
          0.08 + waterRegion.intensity * 0.05,
        );
        layer.lineBetween(
          x + drift,
          chopY,
          Math.min(x + drift + chopWidth, rect.x + rect.width - 16),
          chopY - 1.6,
        );
      }

      for (let x = rect.x + 34; x < rect.x + rect.width - 22; x += 116) {
        const shimmerPhase = beat * 1.22 + row * 0.05 + x * 0.009;
        layer.fillStyle(
          blendColor(waterRegion.crestColor, 0xffffff, 0.38),
          0.035 + (Math.sin(shimmerPhase) + 1) * 0.018,
        );
        layer.fillEllipse(
          x + Math.sin(shimmerPhase * 0.8) * 5,
          rect.y + row + 6 + Math.cos(shimmerPhase) * 3,
          18,
          3.2,
        );
      }
    }
  }

  for (const waterRegion of visualScene.waterRegions) {
    const { rect } = waterRegion;
    if (waterRegion.tag === "shore_foam") {
      drawWaveStroke(
        layer,
        rect.x + 10,
        rect.y + rect.height / 2,
        Math.max(rect.width - 20, 0),
        beat,
        rect.y * 0.01,
        1.8,
        1.8,
        waterRegion.crestColor,
        0.08 + waterRegion.intensity * 0.05,
        {
          packetLength: Math.max(Math.min(rect.width * 0.18, 84), 34),
          softness: 2,
          speed: 0.22,
        },
      );
      for (let x = rect.x; x < rect.x + rect.width; x += 22) {
        const lift = Math.sin(beat * 2.3 + x * 0.04) * 4;
        layer.fillStyle(
          waterRegion.crestColor,
          0.12 + waterRegion.intensity * 0.08,
        );
        layer.fillEllipse(x, rect.y + rect.height / 2 + lift, 20, 5);
        layer.fillStyle(0xffffff, 0.045 + waterRegion.intensity * 0.03);
        layer.fillEllipse(x + 4, rect.y + rect.height / 2 + lift - 1, 12, 2.8);
      }
    }
  }

  const terrainGrid = buildTerrainDraftGrid(visualScene);
  if (terrainGrid) {
    const waterSegments = buildTerrainDraftWaterSegments(terrainGrid);

    for (const segment of waterSegments) {
      const segmentPhase = segment.row * 0.32;
      const depth = Math.max(
        0,
        Math.min((segment.y + segment.height / 2) / visualScene.height, 1),
      );
      const crestColor = blendColor(0xe2fbff, 0xa4d8e0, depth * 0.44);
      const deepSwellColor = blendColor(0x8cc7d2, 0x0f3444, depth * 0.52);
      drawWaveStroke(
        layer,
        segment.x + 10,
        segment.y + segment.height * 0.2,
        Math.max(segment.width - 20, 0),
        beat,
        segmentPhase,
        5.2,
        3.4,
        deepSwellColor,
        0.09,
      );
      drawWaveStroke(
        layer,
        segment.x + 6,
        segment.y + segment.height * 0.29,
        Math.max(segment.width - 12, 0),
        beat,
        segmentPhase + 2.15,
        6.4,
        7.2,
        blendColor(0x5ac7bd, deepSwellColor, 0.28),
        0.075,
        {
          packetLength: Math.max(Math.min(segment.width * 0.44, 164), 64),
          softness: 1.2,
          speed: 0.07,
        },
      );
      drawWaveStroke(
        layer,
        segment.x + 8,
        segment.y + segment.height * 0.34,
        Math.max(segment.width - 16, 0),
        beat,
        segmentPhase + 0.42,
        3.8,
        2.4,
        crestColor,
        0.145,
        {
          direction: -1,
          packetLength: Math.max(Math.min(segment.width * 0.24, 102), 38),
          softness: 1.55,
          speed: 0.12,
        },
      );
      drawWaveStroke(
        layer,
        segment.x + 12,
        segment.y + segment.height * 0.5,
        Math.max(segment.width - 24, 0),
        beat,
        segmentPhase + 0.9,
        3.1,
        2.2,
        blendColor(crestColor, 0xffffff, 0.18),
        0.17,
        {
          packetLength: Math.max(Math.min(segment.width * 0.28, 88), 34),
          softness: 1.85,
          speed: 0.18,
        },
      );
      drawWaveStroke(
        layer,
        segment.x + 16,
        segment.y + segment.height * 0.74,
        Math.max(segment.width - 32, 0),
        beat,
        segmentPhase + 1.45,
        2.1,
        1.7,
        blendColor(crestColor, 0x6eaebc, 0.28),
        0.105,
        {
          packetLength: Math.max(Math.min(segment.width * 0.22, 72), 28),
          softness: 2.1,
          speed: 0.24,
        },
      );

      for (
        let x = segment.x + 28;
        x < segment.x + segment.width - 18;
        x += 108
      ) {
        const shimmerPhase = beat * 1.45 + segment.row * 0.63 + x * 0.018;
        const shimmerAlpha = 0.055 + (Math.sin(shimmerPhase) + 1) * 0.038;
        const shimmerWidth = 18 + (Math.sin(shimmerPhase * 0.72) + 1) * 12;
        const shimmerY =
          segment.y + segment.height * 0.42 + Math.sin(shimmerPhase * 1.18) * 7;
        layer.lineStyle(
          1.5,
          blendColor(crestColor, 0xffffff, 0.38),
          shimmerAlpha,
        );
        layer.lineBetween(
          x + Math.sin(shimmerPhase * 0.8) * 6,
          shimmerY,
          Math.min(x + shimmerWidth, segment.x + segment.width - 12),
          shimmerY - 1.2,
        );
      }

      for (
        let x = segment.x + 56;
        x < segment.x + segment.width - 20;
        x += 168
      ) {
        const glintPhase = beat * 0.92 + x * 0.013 + segment.row * 0.41;
        layer.fillStyle(
          blendColor(crestColor, 0xffffff, 0.48),
          0.045 + (Math.sin(glintPhase) + 1) * 0.04,
        );
        layer.fillEllipse(
          x + Math.cos(glintPhase * 1.4) * 8,
          segment.y + segment.height * 0.62 + Math.sin(glintPhase) * 8,
          32,
          4.8,
        );
      }
    }

    drawAnimatedWaterLightFields(layer, visualScene, waterSegments, beat);
    drawAmbientHarborLife(layer, visualScene, waterSegments, beat);
    drawV2AnimatedVegetationHighlights(layer, visualScene, beat);

    for (let row = 0; row < terrainGrid.rows; row += 1) {
      for (let col = 0; col < terrainGrid.cols; col += 1) {
        if (terrainGrid.kinds[row][col] !== "water") {
          continue;
        }

        const rect = terrainDraftCellRect(
          visualScene,
          terrainGrid.cellSize,
          col,
          row,
        );
        const top = row > 0 ? terrainGrid.kinds[row - 1][col] : null;
        const bottom =
          row < terrainGrid.rows - 1 ? terrainGrid.kinds[row + 1][col] : null;
        const left = col > 0 ? terrainGrid.kinds[row][col - 1] : null;
        const right =
          col < terrainGrid.cols - 1 ? terrainGrid.kinds[row][col + 1] : null;
        const shoreEdges = [
          top === "land" ? "top" : null,
          bottom === "land" ? "bottom" : null,
          left === "land" ? "left" : null,
          right === "land" ? "right" : null,
        ].filter(Boolean) as Array<"bottom" | "left" | "right" | "top">;

        for (const side of shoreEdges) {
          const foamAlpha =
            0.1 + (Math.sin(beat * 2.1 + col * 0.61 + row * 0.49) + 1) * 0.07;
          layer.fillStyle(0xf5fcff, foamAlpha);

          if (side === "top") {
            for (let x = rect.x + 8; x < rect.x + rect.width - 8; x += 22) {
              const lift = Math.sin(beat * 2.3 + x * 0.05) * 3;
              layer.fillEllipse(x, rect.y + 4 + lift, 14, 4.2);
              layer.fillStyle(0xbfe8ef, foamAlpha * 0.32);
              layer.fillEllipse(x + 7, rect.y + 9 + lift * 0.4, 18, 3.2);
              layer.fillStyle(0xf5fcff, foamAlpha);
            }
          } else if (side === "bottom") {
            for (let x = rect.x + 8; x < rect.x + rect.width - 8; x += 22) {
              const lift = Math.sin(beat * 2.3 + x * 0.05 + 1.4) * 3;
              layer.fillEllipse(x, rect.y + rect.height - 4 + lift, 14, 4.2);
              layer.fillStyle(0xbfe8ef, foamAlpha * 0.3);
              layer.fillEllipse(
                x + 7,
                rect.y + rect.height - 9 + lift * 0.4,
                18,
                3.2,
              );
              layer.fillStyle(0xf5fcff, foamAlpha);
            }
          } else if (side === "left") {
            for (let y = rect.y + 8; y < rect.y + rect.height - 8; y += 20) {
              const driftY = Math.sin(beat * 2.1 + y * 0.05) * 2.5;
              layer.fillEllipse(rect.x + 4 + driftY, y, 4.2, 14);
              layer.fillStyle(0xbfe8ef, foamAlpha * 0.28);
              layer.fillEllipse(rect.x + 9 + driftY * 0.4, y + 7, 3.2, 18);
              layer.fillStyle(0xf5fcff, foamAlpha);
            }
          } else {
            for (let y = rect.y + 8; y < rect.y + rect.height - 8; y += 20) {
              const driftY = Math.sin(beat * 2.1 + y * 0.05 + 1.4) * 2.5;
              layer.fillEllipse(rect.x + rect.width - 4 + driftY, y, 4.2, 14);
              layer.fillStyle(0xbfe8ef, foamAlpha * 0.28);
              layer.fillEllipse(
                rect.x + rect.width - 9 + driftY * 0.4,
                y + 7,
                3.2,
                18,
              );
              layer.fillStyle(0xf5fcff, foamAlpha);
            }
          }
        }
      }
    }
  }

  for (const prop of visualScene.props) {
    if (prop.kind === "lamp") {
      const flicker = 0.12 + (Math.sin(beat * 2.4 + prop.x * 0.015) + 1) * 0.03;
      layer.fillStyle(0xf3dfa6, flicker);
      layer.fillCircle(
        prop.x,
        prop.y - 22 * (prop.scale ?? 1),
        12 * (prop.scale ?? 1),
      );
      continue;
    }

    if (prop.kind === "boat") {
      const bob = Math.sin(beat * 1.2 + prop.x * 0.01) * (prop.bobAmount ?? 4);
      drawAuthoredBoat(
        layer,
        prop.x,
        prop.y + bob,
        prop.rotation ?? 0,
        prop.scale ?? 1,
      );
    }
  }
}

type SkyLayerPalette = {
  body: number;
  edge: number;
  haze: number;
  hazeAlpha: number;
  mist: number;
  mistAlpha: number;
  mistAccent: number;
  mistAccentAlpha: number;
  rain: number;
  stormRain: number;
};

function skyLayerPalette(kind: VisualSceneCloudKind): SkyLayerPalette {
  switch (kind) {
    case "storm-front":
      return {
        body: 0x737f8f,
        edge: 0xc5d0dc,
        haze: 0x606c78,
        hazeAlpha: 0.24,
        mist: 0xdbe8ee,
        mistAlpha: 0.2,
        mistAccent: 0xbecfd8,
        mistAccentAlpha: 0.14,
        rain: 0xd4e2ec,
        stormRain: 0xd0deeb,
      };
    case "harbor-bank":
      return {
        body: 0xdee8ec,
        edge: 0xffffff,
        haze: 0xd2e0e6,
        hazeAlpha: 0.18,
        mist: 0xeef4f6,
        mistAlpha: 0.18,
        mistAccent: 0xd6e2e6,
        mistAccentAlpha: 0.12,
        rain: 0xe2ecf2,
        stormRain: 0xd6e4ee,
      };
    case "wispy":
    default:
      return {
        body: 0xf0f5f7,
        edge: 0xffffff,
        haze: 0xe4ecf1,
        hazeAlpha: 0.14,
        mist: 0xf1f6f7,
        mistAlpha: 0.16,
        mistAccent: 0xdfeaf0,
        mistAccentAlpha: 0.11,
        rain: 0xe6eff4,
        stormRain: 0xd8e5ef,
      };
  }
}

function weatherLayerOpacity(
  kind: VisualSceneWeatherKind,
  baseOpacity: number,
) {
  switch (kind) {
    case "mist":
      return Math.min(baseOpacity * 0.74, 0.48);
    case "drizzle":
      return Math.min(baseOpacity * 0.64, 0.34);
    case "rain":
      return Math.min(baseOpacity * 0.76, 0.46);
    case "storm":
      return Math.min(baseOpacity * 0.92, 0.6);
    default:
      return 0;
  }
}

export function drawAnimatedSkyWeather(
  layer: PhaserType.GameObjects.Graphics,
  visualScene: VisualScene,
  now: number,
) {
  if (visualScene.skyLayers.length === 0) {
    return;
  }

  const beat = now / 1000;

  for (const skyLayer of visualScene.skyLayers) {
    const quietHarborWeather = visualScene.id === "south-quay-v2";
    const skyRect = getNormalizedSkyLayerRect(
      visualScene.height,
      skyLayer.rect,
    );
    const bandX = clamp(skyRect.x, 0, Math.max(visualScene.width - 1, 0));
    const bandWidth = Math.max(
      1,
      Math.min(skyRect.width, visualScene.width - bandX),
    );
    const coverageWidth = Math.max(bandWidth, visualScene.width * 0.16);
    const cloudCount = Math.max(
      quietHarborWeather ? 2 : 4,
      Math.round(
        (coverageWidth / (quietHarborWeather ? 360 : 240)) *
          Math.max(skyLayer.density, quietHarborWeather ? 0.65 : 1.2),
      ),
    );
    const spacing = Math.max(
      (coverageWidth + bandWidth * 0.14) / Math.max(cloudCount, 1),
      140,
    );
    const travelSpan = bandWidth + spacing * 3;
    const phaseOffset = getSkyLayerPhaseOffset(
      skyRect.x,
      visualScene.width,
      travelSpan,
    );
    const drift = positiveModulo(
      beat * skyLayer.speed * 4 + phaseOffset,
      travelSpan,
    );
    const palette = skyLayerPalette(skyLayer.cloudKind);
    const weatherOpacity = weatherLayerOpacity(
      skyLayer.weather,
      skyLayer.opacity,
    );
    const fallLength =
      skyLayer.weather === "storm"
        ? Math.min(visualScene.height - skyRect.y, 360)
        : skyLayer.weather === "rain"
          ? Math.min(visualScene.height - skyRect.y, 280)
          : skyLayer.weather === "drizzle"
            ? Math.min(visualScene.height - skyRect.y, 180)
            : Math.min(visualScene.height - skyRect.y, skyRect.height + 80);

    if (skyLayer.weather === "mist") {
      const mistHeight = Math.max(
        0,
        Math.min(skyRect.height + 70, visualScene.height - skyRect.y),
      );
      if (mistHeight > 0.5) {
        layer.fillStyle(palette.mist, palette.mistAlpha);
        layer.fillRoundedRect(
          bandX,
          skyRect.y,
          bandWidth,
          mistHeight,
          skyRect.radius ?? 20,
        );
      }
      const mistAccentY = Math.min(skyRect.y + 18, visualScene.height);
      const mistAccentHeight = Math.max(
        0,
        Math.min(skyRect.height + 110, visualScene.height - mistAccentY),
      );
      if (mistAccentHeight > 0.5) {
        layer.fillStyle(palette.mistAccent, palette.mistAccentAlpha);
        layer.fillRect(bandX, mistAccentY, bandWidth, mistAccentHeight);
      }
    }

    if (
      skyLayer.weather === "drizzle" ||
      skyLayer.weather === "rain" ||
      skyLayer.weather === "storm"
    ) {
      const rainCount = Math.max(
        10,
        Math.round(
          (bandWidth / 38) *
            (skyLayer.weather === "storm"
              ? 1.6
              : skyLayer.weather === "rain"
                ? 1.15
                : 0.7),
        ),
      );
      const rainLead = positiveModulo(beat * skyLayer.speed * 3, 28);
      const rainSlant =
        skyLayer.weather === "storm"
          ? 18
          : skyLayer.weather === "rain"
            ? 14
            : 10;
      const rainDrop =
        skyLayer.weather === "storm"
          ? 42
          : skyLayer.weather === "rain"
            ? 32
            : 24;
      const rainWidth = skyLayer.weather === "storm" ? 2.6 : 1.8;
      const rainColor =
        skyLayer.weather === "storm" ? palette.stormRain : palette.rain;
      const rainAlpha =
        (skyLayer.weather === "storm" ? 0.3 : 0.24) *
        clamp(
          weatherOpacity * (skyLayer.weather === "storm" ? 1.18 : 1.34),
          0.24,
          1,
        );

      layer.lineStyle(rainWidth, rainColor, rainAlpha);
      for (let rainIndex = 0; rainIndex < rainCount; rainIndex += 1) {
        const x =
          bandX +
          (((rainIndex / rainCount) * bandWidth + rainLead) % bandWidth);
        const y =
          skyRect.y +
          18 +
          ((rainIndex * 17) % Math.max(skyRect.height - 14, 24));
        if (y > visualScene.height) {
          continue;
        }
        layer.lineBetween(
          x,
          y,
          Math.max(x - rainSlant, bandX),
          Math.min(y + rainDrop + fallLength * 0.2, visualScene.height),
        );
      }
    }

    const hazeAlpha = clamp(
      palette.hazeAlpha *
        (0.74 + skyLayer.opacity * 0.42) *
        (quietHarborWeather ? 0.42 : 1),
      quietHarborWeather ? 0.035 : 0.08,
      quietHarborWeather ? 0.16 : 0.4,
    );
    layer.fillStyle(palette.haze, hazeAlpha);
    layer.fillRoundedRect(
      bandX,
      skyRect.y,
      bandWidth,
      skyRect.height,
      skyRect.radius ?? 18,
    );

    for (let cloudIndex = 0; cloudIndex < cloudCount + 3; cloudIndex += 1) {
      const wrappedX =
        positiveModulo(cloudIndex * spacing + drift, travelSpan) - spacing;
      const cloudScale =
        skyLayer.scale *
        (quietHarborWeather
          ? 0.5
          : skyLayer.cloudKind === "storm-front"
            ? 1.28
            : skyLayer.cloudKind === "harbor-bank"
              ? 1.12
              : 0.94) *
        (0.92 + (cloudIndex % 3) * 0.11);
      const cloudWidth = 118 * cloudScale;
      const cloudHeight = 36 * cloudScale;
      const cloudX = bandX + wrappedX;
      if (cloudX < bandX || cloudX + cloudWidth > bandX + bandWidth) {
        continue;
      }
      const baseY =
        skyRect.y +
        skyRect.height * (0.18 + (cloudIndex % 4) * 0.12) +
        Math.sin(beat * 0.45 + cloudIndex * 0.9) * 6;
      if (baseY > visualScene.height || baseY + cloudHeight < -6) {
        continue;
      }
      const cloudAlpha = Math.max(
        quietHarborWeather ? 0.035 : 0.12,
        Math.min(
          skyLayer.opacity *
            (quietHarborWeather ? 0.18 : 0.7 + (cloudIndex % 2) * 0.12),
          quietHarborWeather ? 0.16 : 1,
        ),
      );

      if (quietHarborWeather) {
        const streakY = baseY + cloudHeight * 0.48;
        layer.fillStyle(palette.body, cloudAlpha);
        layer.fillRoundedRect(
          cloudX + cloudWidth * 0.08,
          streakY,
          cloudWidth * 0.84,
          Math.max(4, cloudHeight * 0.2),
          Math.max(3, cloudHeight * 0.1),
        );
        layer.fillStyle(palette.edge, cloudAlpha * 0.42);
        layer.fillRoundedRect(
          cloudX + cloudWidth * 0.18,
          streakY - cloudHeight * 0.18,
          cloudWidth * 0.48,
          Math.max(3, cloudHeight * 0.12),
          Math.max(2, cloudHeight * 0.07),
        );
        continue;
      }

      layer.fillStyle(0x000000, 0.08 * cloudAlpha);
      layer.fillEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.66,
        cloudWidth * 0.92,
        cloudHeight * 0.48,
      );

      layer.fillStyle(palette.body, cloudAlpha);
      layer.lineStyle(1.2, palette.edge, cloudAlpha * 0.34);
      layer.fillEllipse(
        cloudX + cloudWidth * 0.28,
        baseY + cloudHeight * 0.58,
        cloudWidth * 0.48,
        cloudHeight * 0.84,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.28,
        baseY + cloudHeight * 0.58,
        cloudWidth * 0.48,
        cloudHeight * 0.84,
      );
      layer.fillEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.42,
        cloudWidth * 0.62,
        cloudHeight * 0.96,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.52,
        baseY + cloudHeight * 0.42,
        cloudWidth * 0.62,
        cloudHeight * 0.96,
      );
      layer.fillEllipse(
        cloudX + cloudWidth * 0.78,
        baseY + cloudHeight * 0.6,
        cloudWidth * 0.52,
        cloudHeight * 0.76,
      );
      layer.strokeEllipse(
        cloudX + cloudWidth * 0.78,
        baseY + cloudHeight * 0.6,
        cloudWidth * 0.52,
        cloudHeight * 0.76,
      );
      layer.fillRoundedRect(
        cloudX + cloudWidth * 0.18,
        baseY + cloudHeight * 0.5,
        cloudWidth * 0.66,
        cloudHeight * 0.46,
        cloudHeight * 0.22,
      );
    }

    if (skyLayer.weather === "storm") {
      const flashCycle = positiveModulo(beat / 9.5, 1);
      const flashAlpha =
        flashCycle >= 0.87 && flashCycle < 0.88
          ? 0.06
          : flashCycle >= 0.88 && flashCycle < 0.89
            ? 0.24
            : flashCycle >= 0.89 && flashCycle < 0.9
              ? 0.04
              : flashCycle >= 0.9 && flashCycle < 0.91
                ? 0.14
                : 0;
      if (flashAlpha > 0) {
        const flashY = Math.max(skyRect.y - 8, 0);
        const flashHeight = Math.max(
          0,
          Math.min(skyRect.height + 22, visualScene.height - flashY),
        );
        if (flashHeight > 0.5) {
          layer.fillStyle(0xf8fcff, flashAlpha * weatherOpacity);
          layer.fillRect(bandX, flashY, bandWidth, flashHeight);
        }
      }
    }
  }
}

function positiveModulo(value: number, base: number) {
  return ((value % base) + base) % base;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
