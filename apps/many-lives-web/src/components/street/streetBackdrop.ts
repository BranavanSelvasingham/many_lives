import type PhaserType from "phaser";

import {
  CELL,
  WORLD_PADDING,
  getMapWorldOrigin,
} from "@/lib/street/runtimeGeometry";
import type { CityMap } from "@/lib/street/types";

const HEADER_HEIGHT = 90;

export function drawBackdrop(
  layer: PhaserType.GameObjects.Graphics,
  world: { height: number; width: number },
  map?: CityMap,
) {
  layer.fillStyle(0x10212a, 1);
  layer.fillRoundedRect(0, 0, world.width, world.height, 34);
  layer.fillStyle(0x172b34, 1);
  layer.fillRoundedRect(
    WORLD_PADDING / 2,
    WORLD_PADDING / 2 + HEADER_HEIGHT / 8,
    world.width - WORLD_PADDING,
    world.height - WORLD_PADDING - HEADER_HEIGHT / 8,
    30,
  );
  layer.lineStyle(2, 0x304650, 0.68);
  layer.strokeRoundedRect(
    WORLD_PADDING / 2,
    WORLD_PADDING / 2 + HEADER_HEIGHT / 8,
    world.width - WORLD_PADDING,
    world.height - WORLD_PADDING - HEADER_HEIGHT / 8,
    30,
  );
  layer.fillStyle(0x132128, 0.14);
  layer.fillRoundedRect(
    WORLD_PADDING,
    world.height - 110,
    world.width - WORLD_PADDING * 2,
    80,
    28,
  );

  if (map) {
    const mapOrigin = getMapWorldOrigin();
    const waterfrontX = mapOrigin.x + map.width * CELL * 0.72;
    const waterfrontY = mapOrigin.y + map.height * CELL + CELL * 1.6;
    layer.fillStyle(0x4f8297, 0.11);
    layer.fillEllipse(
      waterfrontX,
      waterfrontY,
      map.width * CELL * 0.72,
      CELL * 5.2,
    );
    layer.fillStyle(0xd7bf95, 0.04);
    layer.fillEllipse(
      mapOrigin.x + map.width * CELL * 0.25,
      mapOrigin.y + map.height * CELL * 0.22,
      map.width * CELL * 0.48,
      map.height * CELL * 0.62,
    );
  }
}

export function drawBackdropCitySilhouette(
  layer: PhaserType.GameObjects.Graphics,
  world: { height: number; width: number },
) {
  const skylineTop = WORLD_PADDING + 8;
  const farBandY = skylineTop + 10;
  const nearBandY = skylineTop + 62;
  const farWidths = [78, 64, 92, 68, 84, 60, 98, 74, 88];
  const nearBlocks = [
    { height: 146, width: 122, x: WORLD_PADDING + 10, y: nearBandY + 34 },
    { height: 104, width: 110, x: WORLD_PADDING + 146, y: nearBandY + 12 },
    { height: 132, width: 124, x: world.width * 0.37, y: nearBandY + 18 },
    { height: 112, width: 118, x: world.width * 0.54, y: nearBandY + 26 },
    {
      height: 156,
      width: 126,
      x: world.width - WORLD_PADDING - 136,
      y: nearBandY + 24,
    },
  ];
  let cursor = WORLD_PADDING + 14;

  for (let index = 0; index < farWidths.length; index += 1) {
    const width = farWidths[index];
    const height = 40 + (index % 4) * 13;
    const x = cursor;
    const y = farBandY + (index % 2) * 6;
    const columns = Math.max(3, Math.floor(width / 18));
    const rows = 2 + (index % 2);

    layer.fillStyle(index % 2 === 0 ? 0x0c171d : 0x102028, 0.56);
    layer.fillRoundedRect(x, y, width, height, 10);
    layer.fillStyle(0xf0d2a0, 0.06);
    layer.fillRoundedRect(x + 10, y + 8, width - 20, 5, 2);
    layer.fillStyle(0xe6cf9d, 0.07);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        layer.fillRect(x + 10 + column * 14, y + 12 + row * 12, 4.5, 4.5);
      }
    }

    cursor += width - 6;
  }

  layer.fillStyle(0x0b161d, 0.2);
  layer.fillEllipse(
    world.width * 0.5,
    skylineTop + 186,
    world.width * 0.72,
    80,
  );

  for (let index = 0; index < nearBlocks.length; index += 1) {
    const block = nearBlocks[index];
    const windowColor = index % 2 === 0 ? 0xf0d29b : 0xcfd8df;

    layer.fillStyle(index % 2 === 0 ? 0x0f1c24 : 0x121f28, 0.64);
    layer.fillRoundedRect(block.x, block.y, block.width, block.height, 18);
    layer.fillStyle(0xffffff, 0.04);
    layer.fillRoundedRect(block.x + 10, block.y + 8, block.width - 20, 6, 3);
    layer.fillStyle(0x000000, 0.1);
    layer.fillRoundedRect(
      block.x + 10,
      block.y + block.height - 18,
      block.width - 20,
      10,
      3,
    );
    layer.fillStyle(windowColor, 0.06);
    for (
      let row = 0;
      row < Math.max(3, Math.floor(block.height / 32));
      row += 1
    ) {
      for (
        let column = 0;
        column < Math.max(4, Math.floor(block.width / 22));
        column += 1
      ) {
        layer.fillRect(
          block.x + 12 + column * 16,
          block.y + 18 + row * 18,
          5,
          5,
        );
      }
    }
  }

  layer.fillStyle(0x081015, 0.28);
  layer.fillRoundedRect(world.width * 0.46, skylineTop + 56, 46, 212, 20);
  layer.fillStyle(0xf1d8a9, 0.05);
  layer.fillRect(world.width * 0.46 + 18, skylineTop + 76, 5, 86);
}
