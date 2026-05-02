import type PhaserType from "phaser";

import { mapPointToWorld } from "@/lib/street/runtimeGeometry";
import type {
  MapFootprint,
  MapLabel,
  StreetGameState,
} from "@/lib/street/types";
import type { VisualScene } from "@/lib/street/visualScenes";

type LocationLabelIndices = {
  footprintByLocationId: Map<string, MapFootprint>;
};

export function drawLocationLabels(
  scene: PhaserType.Scene,
  game: StreetGameState,
  indices: LocationLabelIndices,
  visualScene: VisualScene | null,
) {
  const objects: PhaserType.GameObjects.GameObject[] = [];
  if (visualScene) {
    for (const label of visualScene.labels) {
      objects.push(createAuthoredSceneLabel(scene, label));
    }

    return objects;
  }

  for (const location of game.locations) {
    const footprint = indices.footprintByLocationId.get(location.id);
    if (!footprint) {
      continue;
    }

    const point = mapPointToWorld({ x: location.labelX, y: location.labelY });
    objects.push(
      createWorldLabelPlate(scene, point.x, point.y, location.name, {
        accentColor: landmarkAccentColor(location.id),
        depth: 38,
        tone: "location",
      }),
    );
  }

  for (const label of game.map.labels) {
    const { x, y } = mapPointToWorld({
      x: label.x + 0.5,
      y: label.y + 0.5,
    });
    objects.push(
      createWorldLabelPlate(scene, x, y, label.text, {
        accentColor: label.tone === "district" ? 0xf1d4a1 : 0x8ca7b4,
        depth: label.tone === "district" ? 36 : 34,
        tone: label.tone,
      }),
    );
  }

  return objects;
}

function createAuthoredSceneLabel(
  scene: PhaserType.Scene,
  label: VisualScene["labels"][number],
) {
  return scene.add
    .text(label.x, label.y, label.text, {
      color:
        label.tone === "landmark"
          ? "#324742"
          : label.tone === "district"
            ? "rgba(47, 63, 67, 0.72)"
            : "rgba(70, 76, 79, 0.68)",
      fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
      fontSize:
        label.tone === "landmark"
          ? "24px"
          : label.tone === "district"
            ? "28px"
            : "18px",
      fontStyle: label.tone === "landmark" ? "700" : "600",
    })
    .setDepth(label.tone === "district" ? 36 : 34)
    .setOrigin(0.5, 0.5);
}

function createWorldLabelPlate(
  scene: PhaserType.Scene,
  x: number,
  y: number,
  text: string,
  options: {
    accentColor: number;
    depth: number;
    tone: "district" | "landmark" | "location" | "street";
  },
) {
  const { accentColor, depth, tone } = options;
  const fontSize =
    tone === "location"
      ? 13
      : tone === "district"
        ? 16
        : tone === "landmark"
          ? 12
          : 11;
  const boardFill =
    tone === "location" || tone === "landmark"
      ? 0x24352d
      : tone === "district"
        ? 0x1b2426
        : 0x2b3438;
  const boardInner =
    tone === "location" || tone === "landmark"
      ? 0x31473c
      : tone === "district"
        ? 0x263236
        : 0x394449;
  const boardStroke =
    tone === "street" ? 0x8b9b9f : tone === "district" ? 0xd6b36c : 0xd9ba74;
  const textNode = scene.add
    .text(0, 0, text, {
      align: "center",
      color:
        tone === "location" || tone === "landmark"
          ? "#f3ead0"
          : toneColor(tone),
      fontFamily: '"Avenir Next", "Nunito Sans", ui-sans-serif, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: tone === "district" || tone === "location" ? "700" : "600",
    })
    .setOrigin(0.5);
  const paddingX = tone === "location" ? 12 : tone === "district" ? 10 : 8;
  const paddingY = tone === "location" ? 6 : 4;
  const width = textNode.width + paddingX * 2;
  const height = textNode.height + paddingY * 2;
  const background = scene.add.graphics();

  background.fillStyle(boardFill, tone === "street" ? 0.78 : 0.96);
  background.lineStyle(2, boardStroke, tone === "street" ? 0.5 : 0.95);
  background.fillRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    tone === "district" ? 8 : 7,
  );
  background.strokeRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    tone === "district" ? 8 : 7,
  );
  background.fillStyle(boardInner, tone === "street" ? 0.18 : 0.54);
  background.fillRoundedRect(
    -width / 2 + 3,
    -height / 2 + 3,
    width - 6,
    height - 6,
    tone === "district" ? 6 : 5,
  );
  background.fillStyle(accentColor, tone === "street" ? 0.18 : 0.34);
  background.fillRoundedRect(
    -width / 2 + 8,
    -height / 2 + 5,
    width - 16,
    2.5,
    1.5,
  );

  return scene.add.container(x, y, [background, textNode]).setDepth(depth);
}

function landmarkAccentColor(locationId: string) {
  switch (locationId) {
    case "boarding-house":
      return 0xd4dde5;
    case "tea-house":
      return 0xe0c08a;
    case "repair-stall":
      return 0xbdd0da;
    case "freight-yard":
      return 0xd7b176;
    case "moss-pier":
      return 0xd8b084;
    case "market-square":
      return 0xe3c892;
    case "courtyard":
      return 0xb9d49c;
    default:
      return 0x9db7c0;
  }
}

function toneColor(tone: MapLabel["tone"]) {
  switch (tone) {
    case "district":
      return "#f1dfb8";
    case "landmark":
      return "#f0e2bf";
    case "street":
      return "#d4d8d1";
    default:
      return "#f0e2bf";
  }
}
