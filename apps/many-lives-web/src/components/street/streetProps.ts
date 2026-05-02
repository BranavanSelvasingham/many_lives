import type PhaserType from "phaser";

import { CELL, mapTileToWorldOrigin } from "@/lib/street/runtimeGeometry";
import type { MapDoor, MapProp } from "@/lib/street/types";

export function drawDoors(layer: PhaserType.GameObjects.Graphics, doors: MapDoor[]) {
  for (const door of doors) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(door.x, door.y);
    const width = Math.max(door.width * CELL, 12);
    const height = Math.max(door.height * CELL, 12);

    layer.fillStyle(0x000000, 0.12);
    layer.fillRoundedRect(worldX + 2, worldY + height - 5, width - 4, 6, 3);
    layer.fillStyle(0x33261d, 0.9);
    layer.fillRoundedRect(worldX + 1, worldY + 1, width - 2, height - 2, 7);
    layer.fillStyle(0xe9ba78, 0.94);
    layer.fillRoundedRect(worldX + 3, worldY + 3, width - 6, height - 6, 6);
    layer.fillStyle(0xf7ddb0, 0.22);
    layer.fillRoundedRect(worldX + 5, worldY + 4, width - 10, 3, 2);
    layer.fillStyle(0x1f1511, 0.28);
    layer.fillRoundedRect(worldX + width * 0.52, worldY + 6, 2, height - 12, 1);
    layer.fillStyle(0x22160f, 0.26);
    layer.fillRoundedRect(worldX + 4, worldY + height - 8, width - 8, 4, 2);
    layer.fillStyle(0xfbe7bd, 0.1);
    layer.fillCircle(worldX + width - 7, worldY + height / 2 + 1, 1.4);
  }
}

export function drawProps(layer: PhaserType.GameObjects.Graphics, props: MapProp[]) {
  for (const prop of props) {
    const { x: worldX, y: worldY } = mapTileToWorldOrigin(prop.x, prop.y);
    const scale = prop.scale ?? 1;
    const vertical = Math.abs(prop.rotation ?? 0) >= 45;

    switch (prop.kind) {
      case "boat":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          (vertical ? 16 : 26) * scale,
          (vertical ? 26 : 11) * scale,
        );
        layer.fillStyle(0x5b4333, 0.98);
        if (vertical) {
          layer.fillEllipse(worldX, worldY, 14 * scale, 30 * scale);
          layer.fillStyle(0xd8c3a3, 0.92);
          layer.fillRoundedRect(
            worldX - 4 * scale,
            worldY - 9 * scale,
            8 * scale,
            14 * scale,
            3,
          );
          layer.lineStyle(1.5, 0xe8dec7, 0.42);
          layer.lineBetween(
            worldX,
            worldY - 16 * scale,
            worldX,
            worldY + 10 * scale,
          );
        } else {
          layer.fillEllipse(worldX, worldY, 30 * scale, 14 * scale);
          layer.fillStyle(0xd8c3a3, 0.92);
          layer.fillRoundedRect(
            worldX - 9 * scale,
            worldY - 4 * scale,
            14 * scale,
            8 * scale,
            3,
          );
          layer.lineStyle(1.5, 0xe8dec7, 0.42);
          layer.lineBetween(
            worldX - 14 * scale,
            worldY,
            worldX + 11 * scale,
            worldY,
          );
        }
        layer.fillStyle(0x7eaec4, 0.28);
        layer.fillEllipse(
          worldX - 1 * scale,
          worldY - 1 * scale,
          10 * scale,
          4 * scale,
        );
        break;
      case "fountain":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          28 * scale,
          12 * scale,
        );
        layer.fillStyle(0x51616c, 0.98);
        layer.fillCircle(worldX, worldY + 1 * scale, 10 * scale);
        layer.fillStyle(0xb6c7cf, 0.26);
        layer.fillCircle(worldX, worldY - 1 * scale, 7.5 * scale);
        layer.fillStyle(0x73858f, 0.98);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY - 10 * scale,
          6 * scale,
          11 * scale,
          2,
        );
        layer.fillStyle(0x9fd5e3, 0.82);
        layer.fillCircle(worldX, worldY - 10 * scale, 3.2 * scale);
        layer.lineStyle(1.4, 0xcfeef6, 0.46);
        layer.lineBetween(
          worldX,
          worldY - 12 * scale,
          worldX,
          worldY - 19 * scale,
        );
        layer.lineBetween(
          worldX - 2 * scale,
          worldY - 11 * scale,
          worldX - 5 * scale,
          worldY - 16 * scale,
        );
        layer.lineBetween(
          worldX + 2 * scale,
          worldY - 11 * scale,
          worldX + 5 * scale,
          worldY - 16 * scale,
        );
        break;
      case "planter":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 1 * scale,
          worldY + 7 * scale,
          18 * scale,
          8 * scale,
        );
        layer.fillStyle(0x7a6046, 0.96);
        layer.fillRoundedRect(
          worldX - 7 * scale,
          worldY - 2 * scale,
          14 * scale,
          8 * scale,
          3,
        );
        layer.fillStyle(0x2f5a3e, 0.98);
        layer.fillCircle(worldX - 4 * scale, worldY - 4 * scale, 4 * scale);
        layer.fillCircle(worldX + 2 * scale, worldY - 5 * scale, 4.4 * scale);
        layer.fillCircle(worldX + 6 * scale, worldY - 2 * scale, 3.2 * scale);
        layer.fillStyle(0x8db97a, 0.2);
        layer.fillCircle(worldX + 1 * scale, worldY - 7 * scale, 3.3 * scale);
        break;
      case "tree":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 1 * scale,
          worldY + 6 * scale,
          24 * scale,
          12 * scale,
        );
        layer.fillStyle(0x203528, 1);
        layer.fillCircle(worldX - 8 * scale, worldY - 6 * scale, 8 * scale);
        layer.fillCircle(worldX + 7 * scale, worldY - 7 * scale, 9 * scale);
        layer.fillStyle(0x48754e, 1);
        layer.fillCircle(worldX, worldY - 12 * scale, 12 * scale);
        layer.fillCircle(worldX - 10 * scale, worldY, 7 * scale);
        layer.fillCircle(worldX + 10 * scale, worldY - 1 * scale, 6.5 * scale);
        layer.fillStyle(0xa6cc86, 0.28);
        layer.fillCircle(worldX - 2 * scale, worldY - 15 * scale, 4 * scale);
        layer.lineStyle(1.6, 0x112017, 0.42);
        layer.strokeCircle(worldX, worldY - 12 * scale, 12 * scale);
        layer.fillStyle(0x74553c, 1);
        layer.fillRoundedRect(
          worldX - 2.5 * scale,
          worldY - 2 * scale,
          5 * scale,
          12 * scale,
          2,
        );
        break;
      case "lamp":
        layer.fillStyle(0x000000, 0.14);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 9 * scale,
          14 * scale,
          7 * scale,
        );
        layer.fillStyle(0x26333b, 0.98);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY + 7 * scale,
          6 * scale,
          4 * scale,
          2,
        );
        layer.fillRoundedRect(
          worldX - 1.4 * scale,
          worldY - 11 * scale,
          2.8 * scale,
          20 * scale,
          1.4,
        );
        layer.lineStyle(2 * scale, 0x26333b, 0.98);
        layer.lineBetween(
          worldX,
          worldY - 10 * scale,
          worldX + 5.5 * scale,
          worldY - 14 * scale,
        );
        layer.lineBetween(
          worldX + 5.5 * scale,
          worldY - 14 * scale,
          worldX + 5.5 * scale,
          worldY - 16 * scale,
        );
        layer.fillStyle(0x1a2329, 0.98);
        layer.fillRoundedRect(
          worldX + 1.5 * scale,
          worldY - 20 * scale,
          8 * scale,
          10 * scale,
          2,
        );
        layer.fillStyle(0xf8e3b0, 0.28);
        layer.fillCircle(
          worldX + 5.5 * scale,
          worldY - 14.5 * scale,
          7 * scale,
        );
        layer.fillStyle(0xf8e3b0, 0.94);
        layer.fillRoundedRect(
          worldX + 3 * scale,
          worldY - 18 * scale,
          5 * scale,
          6 * scale,
          1.5,
        );
        layer.fillStyle(0xcfb981, 0.96);
        layer.fillRoundedRect(
          worldX + 4 * scale,
          worldY - 22 * scale,
          3 * scale,
          2 * scale,
          1,
        );
        break;
      case "cart":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 2 * scale,
          worldY + 8 * scale,
          24 * scale,
          10 * scale,
        );
        layer.fillStyle(0x8f6c4d, 1);
        if (vertical) {
          layer.fillRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            20 * scale,
            5,
          );
          layer.fillStyle(0xd8b08a, 0.34);
          layer.fillRoundedRect(
            worldX - 5 * scale,
            worldY - 8 * scale,
            10 * scale,
            4 * scale,
            3,
          );
          layer.lineStyle(1.5, 0x3e2f22, 0.34);
          layer.lineBetween(
            worldX - 4 * scale,
            worldY - 5 * scale,
            worldX + 4 * scale,
            worldY - 5 * scale,
          );
          layer.fillStyle(0x2a343c, 0.92);
          layer.fillCircle(worldX - 6 * scale, worldY + 9 * scale, 3 * scale);
          layer.fillCircle(worldX + 6 * scale, worldY + 9 * scale, 3 * scale);
          layer.lineStyle(1.2, 0xd7b78d, 0.3);
          layer.strokeRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            20 * scale,
            5,
          );
        } else {
          layer.fillRoundedRect(
            worldX - 10 * scale,
            worldY - 6 * scale,
            20 * scale,
            12 * scale,
            5,
          );
          layer.fillStyle(0xd8b08a, 0.34);
          layer.fillRoundedRect(
            worldX - 8 * scale,
            worldY - 5 * scale,
            16 * scale,
            4 * scale,
            3,
          );
          layer.lineStyle(1.5, 0x3e2f22, 0.34);
          layer.lineBetween(
            worldX - 7 * scale,
            worldY - 1 * scale,
            worldX + 7 * scale,
            worldY - 1 * scale,
          );
          layer.fillStyle(0x2a343c, 0.92);
          layer.fillCircle(worldX - 7 * scale, worldY + 8 * scale, 3 * scale);
          layer.fillCircle(worldX + 7 * scale, worldY + 8 * scale, 3 * scale);
          layer.lineStyle(1.2, 0xd7b78d, 0.3);
          layer.strokeRoundedRect(
            worldX - 10 * scale,
            worldY - 6 * scale,
            20 * scale,
            12 * scale,
            5,
          );
        }
        break;
      case "laundry":
        layer.lineStyle(2 * scale, 0xe8ddca, 0.8);
        if (vertical) {
          layer.lineBetween(
            worldX - 8 * scale,
            worldY - 12 * scale,
            worldX - 8 * scale,
            worldY + 12 * scale,
          );
          layer.fillStyle(0xc89c79, 0.92);
          layer.fillRect(
            worldX - 10 * scale,
            worldY - 9 * scale,
            9 * scale,
            5 * scale,
          );
          layer.fillStyle(0x7fa7bf, 0.9);
          layer.fillRect(
            worldX - 10 * scale,
            worldY - 1 * scale,
            10 * scale,
            5 * scale,
          );
        } else {
          layer.lineBetween(
            worldX - 12 * scale,
            worldY - 8 * scale,
            worldX + 12 * scale,
            worldY - 8 * scale,
          );
          layer.fillStyle(0xc89c79, 0.92);
          layer.fillRect(
            worldX - 9 * scale,
            worldY - 6 * scale,
            5 * scale,
            9 * scale,
          );
          layer.fillStyle(0x7fa7bf, 0.9);
          layer.fillRect(
            worldX - 1 * scale,
            worldY - 6 * scale,
            5 * scale,
            10 * scale,
          );
        }
        break;
      case "crate":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 16 * scale, 7 * scale);
        layer.fillStyle(0x8c6849, 0.95);
        layer.fillRoundedRect(
          worldX - 6 * scale,
          worldY - 6 * scale,
          12 * scale,
          12 * scale,
          2.5,
        );
        layer.lineStyle(1, 0xd6bb95, 0.18);
        layer.strokeRoundedRect(
          worldX - 6 * scale,
          worldY - 6 * scale,
          12 * scale,
          12 * scale,
          2.5,
        );
        layer.lineBetween(
          worldX - 4 * scale,
          worldY - 3 * scale,
          worldX + 4 * scale,
          worldY + 3 * scale,
        );
        layer.lineBetween(
          worldX + 4 * scale,
          worldY - 3 * scale,
          worldX - 4 * scale,
          worldY + 3 * scale,
        );
        break;
      case "barrel":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 15 * scale, 7 * scale);
        layer.fillStyle(0x73553c, 0.95);
        layer.fillEllipse(worldX, worldY - 4 * scale, 11 * scale, 4.5 * scale);
        layer.fillRoundedRect(
          worldX - 5.5 * scale,
          worldY - 4 * scale,
          11 * scale,
          12 * scale,
          4,
        );
        layer.lineStyle(1.2, 0x2f241c, 0.28);
        layer.lineBetween(
          worldX - 4.5 * scale,
          worldY - 1 * scale,
          worldX + 4.5 * scale,
          worldY - 1 * scale,
        );
        layer.lineBetween(
          worldX - 4.5 * scale,
          worldY + 4 * scale,
          worldX + 4.5 * scale,
          worldY + 4 * scale,
        );
        layer.fillStyle(0xd5b48d, 0.12);
        layer.fillEllipse(worldX, worldY - 4 * scale, 8 * scale, 2.6 * scale);
        break;
      case "bench":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(
          worldX + 1,
          worldY + 7,
          (vertical ? 10 : 18) * scale,
          (vertical ? 18 : 10) * scale,
        );
        layer.fillStyle(0x88684a, 0.94);
        if (vertical) {
          layer.fillRoundedRect(
            worldX - 3 * scale,
            worldY - 8 * scale,
            6 * scale,
            16 * scale,
            2,
          );
          layer.fillRoundedRect(
            worldX - 6 * scale,
            worldY - 10 * scale,
            12 * scale,
            3 * scale,
            2,
          );
          layer.fillStyle(0x2c2118, 0.3);
          layer.fillRect(
            worldX - 4 * scale,
            worldY + 8 * scale,
            2 * scale,
            5 * scale,
          );
          layer.fillRect(
            worldX + 2 * scale,
            worldY + 8 * scale,
            2 * scale,
            5 * scale,
          );
        } else {
          layer.fillRoundedRect(
            worldX - 8 * scale,
            worldY - 3 * scale,
            16 * scale,
            6 * scale,
            2,
          );
          layer.fillRoundedRect(
            worldX - 10 * scale,
            worldY - 7 * scale,
            20 * scale,
            3 * scale,
            2,
          );
          layer.fillStyle(0x2c2118, 0.3);
          layer.fillRect(
            worldX - 6 * scale,
            worldY + 3 * scale,
            2 * scale,
            5 * scale,
          );
          layer.fillRect(
            worldX + 4 * scale,
            worldY + 3 * scale,
            2 * scale,
            5 * scale,
          );
        }
        break;
      case "canopy":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 2, worldY + 10, 28 * scale, 10 * scale);
        layer.lineStyle(2, 0x6f563f, 0.72);
        layer.lineBetween(
          worldX - 10 * scale,
          worldY + 8 * scale,
          worldX - 10 * scale,
          worldY - 4 * scale,
        );
        layer.lineBetween(
          worldX + 10 * scale,
          worldY + 8 * scale,
          worldX + 10 * scale,
          worldY - 4 * scale,
        );
        layer.fillStyle(0xddba8d, 1);
        layer.fillRoundedRect(
          worldX - 12 * scale,
          worldY - 7 * scale,
          24 * scale,
          6 * scale,
          3,
        );
        layer.fillStyle(0x8f5a45, 1);
        layer.fillTriangle(
          worldX - 12 * scale,
          worldY - 1 * scale,
          worldX + 12 * scale,
          worldY - 1 * scale,
          worldX,
          worldY + 7 * scale,
        );
        layer.fillStyle(0xf4d6aa, 0.34);
        layer.fillRoundedRect(
          worldX - 8 * scale,
          worldY - 5 * scale,
          16 * scale,
          2 * scale,
          1,
        );
        break;
      case "bollard":
        layer.fillStyle(0x000000, 0.1);
        layer.fillEllipse(worldX, worldY + 5, 10 * scale, 5 * scale);
        layer.fillStyle(0x49545d, 0.94);
        layer.fillRoundedRect(
          worldX - 3 * scale,
          worldY - 6 * scale,
          6 * scale,
          12 * scale,
          2,
        );
        layer.fillStyle(0xd5dddf, 0.12);
        layer.fillRoundedRect(
          worldX - 2 * scale,
          worldY - 5 * scale,
          2 * scale,
          6 * scale,
          1,
        );
        break;
      case "pump":
        layer.fillStyle(0x000000, 0.12);
        layer.fillEllipse(worldX + 1, worldY + 7, 16 * scale, 7 * scale);
        layer.fillStyle(0x667883, 0.92);
        layer.fillRoundedRect(
          worldX - 4 * scale,
          worldY - 7 * scale,
          8 * scale,
          14 * scale,
          3,
        );
        layer.fillStyle(0x90a7b2, 0.14);
        layer.fillRoundedRect(
          worldX - 2 * scale,
          worldY - 5 * scale,
          2 * scale,
          5 * scale,
          1,
        );
        layer.lineStyle(2, 0xcab58c, 0.36);
        layer.lineBetween(
          worldX + 1 * scale,
          worldY - 5 * scale,
          worldX + 8 * scale,
          worldY - 11 * scale,
        );
        layer.lineBetween(
          worldX + 8 * scale,
          worldY - 11 * scale,
          worldX + 11 * scale,
          worldY - 8 * scale,
        );
        break;
      default:
        layer.fillStyle(colorForProp(prop.kind), 0.94);
        layer.fillRoundedRect(
          worldX - 8 * scale,
          worldY - 8 * scale,
          16 * scale,
          16 * scale,
          5,
        );
        break;
    }
  }
}

function colorForProp(kind: MapProp["kind"]) {
  switch (kind) {
    case "barrel":
      return 0x84654c;
    case "bench":
      return 0x78604d;
    case "bollard":
      return 0x5a636a;
    case "boat":
      return 0x6b5342;
    case "canopy":
      return 0xba795f;
    case "crate":
      return 0x8a6a4d;
    case "fountain":
      return 0x7f939e;
    case "planter":
      return 0x58754f;
    case "pump":
      return 0x6e848f;
    default:
      return 0x75838b;
  }
}
