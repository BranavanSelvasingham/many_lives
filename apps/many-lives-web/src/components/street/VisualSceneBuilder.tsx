"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  buildVisualSceneModuleSource,
  clearVisualSceneRuntimeOverride,
  cloneVisualSceneDocument,
  collectVisualSceneWarnings,
  getVisualSceneDocument,
  parseVisualSceneDocument,
  saveVisualSceneRuntimeOverride,
  serializeVisualSceneDocument,
  type VisualFringeZoneEdge,
  type VisualFringeZoneKind,
  type VisualLandmarkModuleKind,
  type VisualPoint,
  type VisualPropClusterKind,
  type VisualRect,
  type VisualScene,
  type VisualSceneDocument,
  type VisualSceneId,
  type VisualSceneLandmarkStyle,
  type VisualSurfaceMaterialKind,
  type VisualTerrainKind,
  type VisualSceneWaterTag,
  type VisualSurfaceZoneKind,
} from "@/lib/street/visualScenes";

const BUILDER_SCENE_ID: VisualSceneId = "south-quay-v2";

const SURFACE_ZONE_KINDS: VisualSurfaceZoneKind[] = [
  "north_promenade",
  "main_street",
  "square_border",
  "square_center",
  "service_lane",
  "west_lane",
  "courtyard_ground",
  "dock_apron",
  "quay_wall",
  "deep_water",
];

const SURFACE_MATERIAL_KINDS: VisualSurfaceMaterialKind[] = [
  "paved_asphalt",
  "tiled_stone_road",
  "walkway",
  "grass",
  "bushes",
  "trees",
];

const FRINGE_ZONE_KINDS: VisualFringeZoneKind[] = [
  "neighbor_facade",
  "alley_mouth",
  "side_street",
  "quay_continuation",
];

const FRINGE_EDGES: VisualFringeZoneEdge[] = ["north", "east", "south", "west"];

const PROP_CLUSTER_KINDS: VisualPropClusterKind[] = [
  "cafe_terrace",
  "square_bench_pair",
  "square_planter_pair",
  "workshop_stock",
  "yard_service",
  "harbor_mooring",
];

const PROP_KINDS = [
  "lamp",
  "bench",
  "planter",
  "terrace-table",
  "boat",
] as const;

const WATER_TAGS: VisualSceneWaterTag[] = [
  "water_surface",
  "shore_foam",
  "moored_boat",
];

const LANDMARK_STYLES: VisualSceneLandmarkStyle[] = [
  "boarding-house",
  "cafe",
  "courtyard",
  "dock",
  "square",
  "workshop",
  "yard",
];

const LABEL_TONES = ["district", "landmark", "street"] as const;
const SURFACE_EMPHASES = ["low", "medium", "high"] as const;

const PRESET_KINDS = [
  "eatery_frontage",
  "boarding_frontage",
  "workshop_frontage",
  "square_kit",
  "yard_service_kit",
  "harbor_edge_kit",
] as const;

const LANDMARK_MODULE_KINDS: VisualLandmarkModuleKind[] = [
  "roof_cap",
  "wall_band",
  "awning",
  "entry",
  "window_row",
  "terrace_rail",
  "shutters",
  "stoop",
  "service_bay",
  "sign",
  "trim",
  "downspout",
];

type VisibleGroups = {
  anchors: boolean;
  fringe: boolean;
  labels: boolean;
  landmarks: boolean;
  modules: boolean;
  props: boolean;
  surfaceZones: boolean;
  water: boolean;
};

type BuilderSelection =
  | { kind: "landmark"; index: number }
  | { kind: "surfaceZone"; index: number }
  | { kind: "fringeZone"; index: number }
  | { kind: "landmarkModule"; index: number }
  | { kind: "propCluster"; index: number }
  | { kind: "prop"; index: number }
  | { kind: "waterRegion"; index: number }
  | { kind: "label"; index: number }
  | { kind: "playerSpawn" }
  | { kind: "npcAnchor"; id: string }
  | { kind: "locationAnchorHighlight"; locationId: string }
  | {
      kind: "locationAnchorPoint";
      locationId: string;
      pointKey: "door" | "frontage" | "label";
    }
  | { kind: "locationAnchorNpcStand"; locationId: string; index: number };

type DragState = {
  origins: Array<{
    origin: VisualPoint | VisualRect;
    selection: BuilderSelection;
  }>;
  pointerId: number;
  start: VisualPoint;
};

type MarqueeState = {
  current: VisualPoint;
  pointerId: number;
  start: VisualPoint;
};

type BuilderListItem = {
  id: string;
  label: string;
  selection: BuilderSelection;
  section: string;
  subtitle: string;
};

type AddState = {
  fringeEdge: VisualFringeZoneEdge;
  fringeKind: VisualFringeZoneKind;
  moduleKind: VisualLandmarkModuleKind;
  propClusterKind: VisualPropClusterKind;
  propKind: (typeof PROP_KINDS)[number];
  surfaceKind: VisualSurfaceZoneKind;
  waterTag: VisualSceneWaterTag;
};

type BuilderPresetKind = (typeof PRESET_KINDS)[number];

type BuilderImportMode = "json" | "module";
type BuilderCanvasMode = "buildings" | "ground" | "roads" | "details";
type GroundToolMode = "brush" | "select";
type RoadToolMode = "brush" | "select";
type TerrainDisplayMode = "mask" | "render";
type PaintState = {
  layer: "surface" | "terrain";
  pointerId: number;
};

const ROAD_SURFACE_KINDS = new Set<VisualSurfaceZoneKind>([
  "north_promenade",
  "main_street",
  "square_border",
  "square_center",
  "service_lane",
  "west_lane",
]);

const GROUND_SURFACE_KINDS = new Set<VisualSurfaceZoneKind>([
  "courtyard_ground",
  "dock_apron",
  "quay_wall",
  "deep_water",
]);

const SURFACE_KIND_LABELS: Record<VisualSurfaceZoneKind, string> = {
  courtyard_ground: "Courtyard / grass",
  deep_water: "Deep water",
  dock_apron: "Dock apron",
  main_street: "Paved main street",
  north_promenade: "Promenade / sidewalk",
  quay_wall: "Quay wall",
  service_lane: "Service lane",
  square_border: "Square border",
  square_center: "Square center",
  west_lane: "West lane",
};

const TERRAIN_CELL_SIZE = 48;
const SURFACE_DRAFT_CELL_SIZE = 48;
const BUILDER_STORAGE_KEY = `many-lives.visual-scene-builder.${BUILDER_SCENE_ID}`;

const SURFACE_MATERIAL_LABELS: Record<VisualSurfaceMaterialKind, string> = {
  bushes: "Bushes",
  grass: "Grass",
  paved_asphalt: "Paved asphalt",
  tiled_stone_road: "Tiled stone road",
  trees: "Trees",
  walkway: "Walkway",
};

function cloneScene(scene: VisualScene) {
  return cloneVisualSceneDocument(scene);
}

function selectionId(selection: BuilderSelection) {
  switch (selection.kind) {
    case "landmark":
    case "surfaceZone":
    case "fringeZone":
    case "landmarkModule":
    case "propCluster":
    case "prop":
    case "waterRegion":
    case "label":
      return `${selection.kind}:${selection.index}`;
    case "playerSpawn":
      return "playerSpawn";
    case "npcAnchor":
      return `npcAnchor:${selection.id}`;
    case "locationAnchorHighlight":
      return `locationAnchorHighlight:${selection.locationId}`;
    case "locationAnchorPoint":
      return `locationAnchorPoint:${selection.locationId}:${selection.pointKey}`;
    case "locationAnchorNpcStand":
      return `locationAnchorNpcStand:${selection.locationId}:${selection.index}`;
    default:
      return "unknown";
  }
}

function getSelectionPoint(scene: VisualScene, selection: BuilderSelection): VisualPoint | null {
  switch (selection.kind) {
    case "prop":
      return scene.props[selection.index]
        ? { x: scene.props[selection.index].x, y: scene.props[selection.index].y }
        : null;
    case "label":
      return scene.labels[selection.index]
        ? { x: scene.labels[selection.index].x, y: scene.labels[selection.index].y }
        : null;
    case "playerSpawn":
      return scene.playerSpawn;
    case "npcAnchor":
      return scene.npcAnchors[selection.id] ?? null;
    case "locationAnchorPoint": {
      const anchor = scene.locationAnchors[selection.locationId];
      if (!anchor) {
        return null;
      }
      return anchor[selection.pointKey];
    }
    case "locationAnchorNpcStand": {
      const stand =
        scene.locationAnchors[selection.locationId]?.npcStands?.[selection.index] ?? null;
      return stand;
    }
    default:
      return null;
  }
}

function getSelectionRect(scene: VisualScene, selection: BuilderSelection): VisualRect | null {
  switch (selection.kind) {
    case "landmark":
      return scene.landmarks[selection.index]?.rect ?? null;
    case "surfaceZone":
      return scene.surfaceZones[selection.index]?.rect ?? null;
    case "fringeZone":
      return scene.fringeZones[selection.index]?.rect ?? null;
    case "landmarkModule":
      return scene.landmarkModules[selection.index]?.rect ?? null;
    case "propCluster":
      return scene.propClusters[selection.index]?.rect ?? null;
    case "waterRegion":
      return scene.waterRegions[selection.index]?.rect ?? null;
    case "locationAnchorHighlight":
      return scene.locationAnchors[selection.locationId]?.highlight ?? null;
    default:
      return null;
  }
}

function describeSelection(scene: VisualScene, selection: BuilderSelection) {
  switch (selection.kind) {
    case "landmark": {
      const item = scene.landmarks[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.style} • ${item.locationId}`,
            title: item.id,
          }
        : null;
    }
    case "surfaceZone": {
      const item = scene.surfaceZones[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.kind} • ${item.emphasis ?? "medium"}`,
            title: item.id,
          }
        : null;
    }
    case "fringeZone": {
      const item = scene.fringeZones[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.kind} • ${item.edge}`,
            title: item.id,
          }
        : null;
    }
    case "landmarkModule": {
      const item = scene.landmarkModules[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.kind} • ${item.locationId}`,
            title: item.id,
          }
        : null;
    }
    case "propCluster": {
      const item = scene.propClusters[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.kind}${item.locationId ? ` • ${item.locationId}` : ""}`,
            title: item.id,
          }
        : null;
    }
    case "prop": {
      const item = scene.props[selection.index];
      return item
        ? {
            mode: "point" as const,
            point: { x: item.x, y: item.y },
            subtitle: item.kind,
            title: `prop-${selection.index + 1}`,
          }
        : null;
    }
    case "waterRegion": {
      const item = scene.waterRegions[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: item.rect,
            subtitle: `${item.tag} • intensity ${item.intensity}`,
            title: item.id,
          }
        : null;
    }
    case "label": {
      const item = scene.labels[selection.index];
      return item
        ? {
            mode: "point" as const,
            point: { x: item.x, y: item.y },
            subtitle: item.tone,
            title: item.text,
          }
        : null;
    }
    case "playerSpawn":
      return {
        mode: "point" as const,
        point: scene.playerSpawn,
        subtitle: "player spawn",
        title: "Rowan spawn",
      };
    case "npcAnchor":
      return {
        mode: "point" as const,
        point: scene.npcAnchors[selection.id],
        subtitle: "npc anchor",
        title: selection.id,
      };
    case "locationAnchorHighlight":
      return {
        mode: "rect" as const,
        rect: scene.locationAnchors[selection.locationId].highlight,
        subtitle: "location highlight",
        title: `${selection.locationId} highlight`,
      };
    case "locationAnchorPoint":
      return {
        mode: "point" as const,
        point: scene.locationAnchors[selection.locationId][selection.pointKey],
        subtitle: `${selection.locationId} • ${selection.pointKey}`,
        title: `${selection.locationId} ${selection.pointKey}`,
      };
    case "locationAnchorNpcStand": {
      const point =
        scene.locationAnchors[selection.locationId].npcStands?.[selection.index] ?? null;
      if (!point) {
        return null;
      }
      return {
        mode: "point" as const,
        point,
        subtitle: `${selection.locationId} • npc stand`,
        title: `${selection.locationId} stand ${selection.index + 1}`,
      };
    }
    default:
      return null;
  }
}

function buildListItems(scene: VisualScene): BuilderListItem[] {
  return [
    ...scene.landmarks.map((item, index) => ({
      id: selectionId({ kind: "landmark", index }),
      label: item.locationId,
      selection: { kind: "landmark", index } as BuilderSelection,
      section: "Landmarks",
      subtitle: item.style,
    })),
    ...scene.surfaceZones.map((item, index) => ({
      id: selectionId({ kind: "surfaceZone", index }),
      label: item.id,
      selection: { kind: "surfaceZone", index } as BuilderSelection,
      section: "Surface Zones",
      subtitle: item.kind,
    })),
    ...scene.fringeZones.map((item, index) => ({
      id: selectionId({ kind: "fringeZone", index }),
      label: item.id,
      selection: { kind: "fringeZone", index } as BuilderSelection,
      section: "Fringe",
      subtitle: `${item.kind} • ${item.edge}`,
    })),
    ...scene.landmarkModules.map((item, index) => ({
      id: selectionId({ kind: "landmarkModule", index }),
      label: item.id,
      selection: { kind: "landmarkModule", index } as BuilderSelection,
      section: "Modules",
      subtitle: `${item.kind} • ${item.locationId}`,
    })),
    ...scene.propClusters.map((item, index) => ({
      id: selectionId({ kind: "propCluster", index }),
      label: item.id,
      selection: { kind: "propCluster", index } as BuilderSelection,
      section: "Prop Clusters",
      subtitle: item.kind,
    })),
    ...scene.props.map((item, index) => ({
      id: selectionId({ kind: "prop", index }),
      label: `prop-${index + 1}`,
      selection: { kind: "prop", index } as BuilderSelection,
      section: "Props",
      subtitle: item.kind,
    })),
    ...scene.waterRegions.map((item, index) => ({
      id: selectionId({ kind: "waterRegion", index }),
      label: item.id,
      selection: { kind: "waterRegion", index } as BuilderSelection,
      section: "Water",
      subtitle: item.tag,
    })),
    ...scene.labels.map((item, index) => ({
      id: selectionId({ kind: "label", index }),
      label: item.text,
      selection: { kind: "label", index } as BuilderSelection,
      section: "Labels",
      subtitle: item.tone,
    })),
    {
      id: selectionId({ kind: "playerSpawn" }),
      label: "Rowan Spawn",
      selection: { kind: "playerSpawn" },
      section: "Anchors",
      subtitle: "player spawn",
    },
    ...Object.keys(scene.npcAnchors).map((id) => ({
      id: selectionId({ id, kind: "npcAnchor" }),
      label: id,
      selection: { id, kind: "npcAnchor" } as BuilderSelection,
      section: "Anchors",
      subtitle: "npc anchor",
    })),
    ...Object.keys(scene.locationAnchors).flatMap((locationId) => {
      const anchor = scene.locationAnchors[locationId];
      const npcStandItems =
        anchor.npcStands?.map((_, index) => ({
          id: selectionId({ kind: "locationAnchorNpcStand", locationId, index }),
          label: `${locationId} stand ${index + 1}`,
          selection: {
            kind: "locationAnchorNpcStand",
            locationId,
            index,
          } as BuilderSelection,
          section: "Anchors",
          subtitle: "npc stand",
        })) ?? [];

      return [
        {
          id: selectionId({ kind: "locationAnchorHighlight", locationId }),
          label: `${locationId} highlight`,
          selection: { kind: "locationAnchorHighlight", locationId } as BuilderSelection,
          section: "Anchors",
          subtitle: "highlight rect",
        },
        {
          id: selectionId({
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "door",
          }),
          label: `${locationId} door`,
          selection: {
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "door",
          } as BuilderSelection,
          section: "Anchors",
          subtitle: "door",
        },
        {
          id: selectionId({
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "frontage",
          }),
          label: `${locationId} frontage`,
          selection: {
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "frontage",
          } as BuilderSelection,
          section: "Anchors",
          subtitle: "frontage",
        },
        {
          id: selectionId({
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "label",
          }),
          label: `${locationId} label`,
          selection: {
            kind: "locationAnchorPoint",
            locationId,
            pointKey: "label",
          } as BuilderSelection,
          section: "Anchors",
          subtitle: "label",
        },
        ...npcStandItems,
      ];
    }),
  ];
}

function updateSelectionPosition(
  draft: VisualScene,
  selection: BuilderSelection,
  x: number,
  y: number,
) {
  switch (selection.kind) {
    case "landmark":
      if (draft.landmarks[selection.index]) {
        draft.landmarks[selection.index].rect.x = x;
        draft.landmarks[selection.index].rect.y = y;
      }
      return;
    case "surfaceZone":
      if (draft.surfaceZones[selection.index]) {
        draft.surfaceZones[selection.index].rect.x = x;
        draft.surfaceZones[selection.index].rect.y = y;
      }
      return;
    case "fringeZone":
      if (draft.fringeZones[selection.index]) {
        draft.fringeZones[selection.index].rect.x = x;
        draft.fringeZones[selection.index].rect.y = y;
      }
      return;
    case "landmarkModule":
      if (draft.landmarkModules[selection.index]) {
        draft.landmarkModules[selection.index].rect.x = x;
        draft.landmarkModules[selection.index].rect.y = y;
      }
      return;
    case "propCluster":
      if (draft.propClusters[selection.index]) {
        draft.propClusters[selection.index].rect.x = x;
        draft.propClusters[selection.index].rect.y = y;
      }
      return;
    case "prop":
      if (draft.props[selection.index]) {
        draft.props[selection.index].x = x;
        draft.props[selection.index].y = y;
      }
      return;
    case "waterRegion":
      if (draft.waterRegions[selection.index]) {
        draft.waterRegions[selection.index].rect.x = x;
        draft.waterRegions[selection.index].rect.y = y;
      }
      return;
    case "label":
      if (draft.labels[selection.index]) {
        draft.labels[selection.index].x = x;
        draft.labels[selection.index].y = y;
      }
      return;
    case "playerSpawn":
      draft.playerSpawn = { x, y };
      return;
    case "npcAnchor":
      draft.npcAnchors[selection.id] = { x, y };
      return;
    case "locationAnchorHighlight":
      draft.locationAnchors[selection.locationId].highlight.x = x;
      draft.locationAnchors[selection.locationId].highlight.y = y;
      return;
    case "locationAnchorPoint":
      draft.locationAnchors[selection.locationId][selection.pointKey] = { x, y };
      return;
    case "locationAnchorNpcStand": {
      const stands = draft.locationAnchors[selection.locationId].npcStands ?? [];
      if (stands[selection.index]) {
        stands[selection.index] = { x, y };
        draft.locationAnchors[selection.locationId].npcStands = stands;
      }
      return;
    }
    default:
      return;
  }
}

function updateSelectionRectField(
  draft: VisualScene,
  selection: BuilderSelection,
  field: keyof VisualRect,
  value: number,
) {
  const rect = getSelectionRect(draft, selection);
  if (!rect) {
    return;
  }
  if (field === "radius") {
    rect.radius = value;
    return;
  }
  rect[field] = value as never;
}

function buildExportText(scene: VisualScene) {
  return serializeVisualSceneDocument(scene);
}

function buildModuleExportText(scene: VisualSceneDocument) {
  return buildVisualSceneModuleSource("SOUTH_QUAY_V2_DOCUMENT", scene);
}

function createDefaultRect(scene: VisualScene): VisualRect {
  return {
    x: Math.round(scene.width * 0.42),
    y: Math.round(scene.height * 0.38),
    width: 220,
    height: 140,
    radius: 18,
  };
}

function createDefaultPoint(scene: VisualScene): VisualPoint {
  return {
    x: Math.round(scene.width * 0.5),
    y: Math.round(scene.height * 0.5),
  };
}

function rectsOverlap(left: VisualRect, right: VisualRect) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function expandedRect(rect: VisualRect, padding: number): VisualRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    radius: rect.radius,
  };
}

function pointInsideRect(point: VisualPoint, rect: VisualRect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function normalizeRectFromPoints(start: VisualPoint, current: VisualPoint): VisualRect {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  return {
    x,
    y,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function terrainCellKey(col: number, row: number) {
  return `${col}:${row}`;
}

function terrainCellRect(
  scene: VisualScene,
  cellSize: number,
  col: number,
  row: number,
): VisualRect {
  const x = col * cellSize;
  const y = row * cellSize;
  return {
    x,
    y,
    width: Math.min(cellSize, scene.width - x),
    height: Math.min(cellSize, scene.height - y),
  };
}

function getTerrainKindAtPoint(scene: VisualScene, point: VisualPoint): VisualTerrainKind | null {
  const terrain = scene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const col = clamp(Math.floor(point.x / terrain.cellSize), 0, Math.max(0, Math.ceil(scene.width / terrain.cellSize) - 1));
  const row = clamp(Math.floor(point.y / terrain.cellSize), 0, Math.max(0, Math.ceil(scene.height / terrain.cellSize) - 1));
  const key = terrainCellKey(col, row);
  const override = terrain.overrides.find((cell) => terrainCellKey(cell.col, cell.row) === key);
  return override?.kind ?? terrain.baseKind;
}

function surfaceCellAllowed(
  scene: VisualScene,
  cellSize: number,
  col: number,
  row: number,
) {
  if (!scene.terrainDraft) {
    return true;
  }

  const rect = terrainCellRect(scene, cellSize, col, row);
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  return getTerrainKindAtPoint(scene, center) === "land";
}

function terrainColor(kind: VisualTerrainKind, emphasis: "base" | "override") {
  if (kind === "land") {
    return emphasis === "base" ? "rgba(188, 168, 126, 0.28)" : "rgba(208, 189, 145, 0.6)";
  }
  return emphasis === "base" ? "rgba(46, 84, 108, 0.3)" : "rgba(74, 123, 150, 0.68)";
}

type TerrainPreviewCell = {
  col: number;
  kind: VisualTerrainKind;
  rect: VisualRect;
  row: number;
};

type TerrainPreviewGrid = {
  cellSize: number;
  cells: TerrainPreviewCell[];
  cols: number;
  kinds: VisualTerrainKind[][];
  rows: number;
};

function buildTerrainPreviewGrid(scene: VisualScene): TerrainPreviewGrid | null {
  const terrain = scene.terrainDraft;
  if (!terrain) {
    return null;
  }

  const cols = Math.max(1, Math.ceil(scene.width / terrain.cellSize));
  const rows = Math.max(1, Math.ceil(scene.height / terrain.cellSize));
  const overrideMap = new Map(
    terrain.overrides.map((cell) => [terrainCellKey(cell.col, cell.row), cell.kind]),
  );
  const kinds: VisualTerrainKind[][] = [];
  const cells: TerrainPreviewCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    const rowKinds: VisualTerrainKind[] = [];
    for (let col = 0; col < cols; col += 1) {
      const kind = overrideMap.get(terrainCellKey(col, row)) ?? terrain.baseKind;
      rowKinds.push(kind);
      cells.push({
        col,
        kind,
        rect: terrainCellRect(scene, terrain.cellSize, col, row),
        row,
      });
    }
    kinds.push(rowKinds);
  }

  return {
    cellSize: terrain.cellSize,
    cells,
    cols,
    kinds,
    rows,
  };
}

function terrainPreviewFill(kind: VisualTerrainKind) {
  if (kind === "land") {
    return "#d4c6a4";
  }
  return "#54798f";
}

type TerrainShorelineEdge = {
  cell: TerrainPreviewCell;
  side: "bottom" | "left" | "right" | "top";
};

type TerrainWaterSegment = {
  height: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

function buildTerrainShorelineEdges(grid: TerrainPreviewGrid) {
  const edges: TerrainShorelineEdge[] = [];

  for (const cell of grid.cells) {
    if (cell.kind !== "land") {
      continue;
    }

    const top = cell.row > 0 ? grid.kinds[cell.row - 1][cell.col] : null;
    const bottom = cell.row < grid.rows - 1 ? grid.kinds[cell.row + 1][cell.col] : null;
    const left = cell.col > 0 ? grid.kinds[cell.row][cell.col - 1] : null;
    const right = cell.col < grid.cols - 1 ? grid.kinds[cell.row][cell.col + 1] : null;

    if (top === "water") {
      edges.push({ cell, side: "top" });
    }
    if (bottom === "water") {
      edges.push({ cell, side: "bottom" });
    }
    if (left === "water") {
      edges.push({ cell, side: "left" });
    }
    if (right === "water") {
      edges.push({ cell, side: "right" });
    }
  }

  return edges;
}

function buildTerrainWaterSegments(grid: TerrainPreviewGrid): TerrainWaterSegment[] {
  const segments: TerrainWaterSegment[] = [];

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
      const endX = Math.min((col) * grid.cellSize, grid.cols * grid.cellSize);
      const y = row * grid.cellSize;
      segments.push({
        height: grid.cellSize,
        row,
        width: endX - x,
        x,
        y,
      });
      startCol = null;
    }
  }

  return segments;
}

function buildHorizontalWavePath(
  x: number,
  y: number,
  width: number,
  beat: number,
  phaseOffset: number,
  amplitude: number,
) {
  const sampleStep = 16;
  let path = "";

  for (let offset = 0; offset <= width; offset += sampleStep) {
    const px = Math.min(x + offset, x + width);
    const py =
      y +
      Math.sin(px * 0.024 + beat * 1.6 + phaseOffset) * amplitude +
      Math.sin(px * 0.011 + beat * 0.72 + phaseOffset * 0.7) * amplitude * 0.48;
    path += `${offset === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)} `;
  }

  return path.trim();
}

function surfacePreviewFill(kind: VisualSurfaceZoneKind) {
  switch (kind) {
    case "north_promenade":
      return "#d8cfb7";
    case "main_street":
      return "#cbbda0";
    case "square_border":
      return "#d1c6ae";
    case "square_center":
      return "#e0d5bd";
    case "service_lane":
      return "#b8aa8d";
    case "west_lane":
      return "#b0a281";
    case "courtyard_ground":
      return "#72825f";
    case "dock_apron":
      return "#9b7a55";
    case "quay_wall":
      return "#78644f";
    case "deep_water":
      return "#5f8698";
    default:
      return "#c7b899";
  }
}

function renderTerrainPreview(
  scene: VisualScene,
  grid: TerrainPreviewGrid,
  previewTimeMs: number,
) {
  const shorelineEdges = buildTerrainShorelineEdges(grid);
  const waterSegments = buildTerrainWaterSegments(grid);
  const beat = previewTimeMs / 1000;
  const baseKind = scene.terrainDraft?.baseKind ?? "land";
  const oppositeKind: VisualTerrainKind = baseKind === "land" ? "water" : "land";

  return (
    <g key="terrain-preview">
      <rect fill={terrainPreviewFill(baseKind)} height={scene.height} width={scene.width} x="0" y="0" />
      {grid.cells.map((cell) => {
        if (cell.kind === baseKind) {
          return null;
        }
        return (
          <g key={`terrain-preview-${cell.col}-${cell.row}`}>
            <rect
              fill={terrainPreviewFill(oppositeKind)}
              height={cell.rect.height}
              width={cell.rect.width}
              x={cell.rect.x}
              y={cell.rect.y}
            />
            {cell.kind === "water" && baseKind === "land" ? (
              <>
                <rect
                  fill="rgba(16, 51, 70, 0.26)"
                  height={cell.rect.height * 0.52}
                  width={cell.rect.width}
                  x={cell.rect.x}
                  y={cell.rect.y + cell.rect.height * 0.48}
                />
              </>
            ) : cell.kind === "land" && baseKind === "water" ? (
              <>
                <rect
                  fill="rgba(233, 223, 196, 0.18)"
                  height={cell.rect.height * 0.42}
                  width={cell.rect.width * 0.52}
                  x={cell.rect.x + 2}
                  y={cell.rect.y + 2}
                />
                <rect
                  fill="rgba(164, 143, 102, 0.1)"
                  height={cell.rect.height}
                  width={cell.rect.width * 0.5}
                  x={cell.rect.x}
                  y={cell.rect.y}
                />
                <rect
                  fill="rgba(173, 150, 108, 0.08)"
                  height={cell.rect.height * 0.22}
                  width={cell.rect.width * 0.72}
                  x={cell.rect.x + cell.rect.width * 0.18}
                  y={cell.rect.y + cell.rect.height * 0.62}
                />
                <line
                  stroke="rgba(134, 116, 80, 0.08)"
                  strokeWidth="1"
                  x1={cell.rect.x}
                  x2={cell.rect.x + cell.rect.width}
                  y1={cell.rect.y + cell.rect.height}
                  y2={cell.rect.y + cell.rect.height}
                />
              </>
            ) : null}
          </g>
        );
      })}
      {waterSegments.map((segment, index) => {
        const segmentPhase = segment.row * 0.32;
        const topWaveY = segment.y + segment.height * 0.24;
        const midWaveY = segment.y + segment.height * 0.5;
        const lowWaveY = segment.y + segment.height * 0.74;
        return (
          <g key={`terrain-water-segment-${segment.row}-${index}`}>
            <path
              d={buildHorizontalWavePath(
                segment.x + 10,
                topWaveY,
                Math.max(segment.width - 20, 0),
                beat,
                segmentPhase,
                4.2,
              )}
              fill="none"
              stroke="rgba(243, 251, 255, 0.52)"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d={buildHorizontalWavePath(
                segment.x + 12,
                midWaveY,
                Math.max(segment.width - 24, 0),
                beat,
                segmentPhase + 0.9,
                3.2,
              )}
              fill="none"
              stroke="rgba(232, 246, 252, 0.34)"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
            <path
              d={buildHorizontalWavePath(
                segment.x + 16,
                lowWaveY,
                Math.max(segment.width - 32, 0),
                beat,
                segmentPhase + 1.5,
                2.2,
              )}
              fill="none"
              stroke="rgba(224, 243, 250, 0.24)"
              strokeLinecap="round"
              strokeWidth="1.9"
            />
          </g>
        );
      })}
      {shorelineEdges.map((edge, index) => {
        const { rect } = edge.cell;
        const seed = edge.cell.col * 17 + edge.cell.row * 23 + index * 7;
        const rockCount = 2 + (seed % 2);
        const isHorizontal = edge.side === "top" || edge.side === "bottom";
        const bandThickness = 9;
        const cutoffRect =
          edge.side === "top"
            ? { x: rect.x + 6, y: rect.y, width: rect.width - 12, height: bandThickness }
            : edge.side === "bottom"
              ? {
                  x: rect.x + 6,
                  y: rect.y + rect.height - bandThickness,
                  width: rect.width - 12,
                  height: bandThickness,
                }
              : edge.side === "left"
                ? { x: rect.x, y: rect.y + 6, width: bandThickness, height: rect.height - 12 }
                : {
                    x: rect.x + rect.width - bandThickness,
                    y: rect.y + 6,
                    width: bandThickness,
                    height: rect.height - 12,
                  };

        const foamLine =
          edge.side === "top"
            ? { x1: rect.x + 8, x2: rect.x + rect.width - 10, y1: rect.y + 2, y2: rect.y + 1 }
            : edge.side === "bottom"
              ? {
                  x1: rect.x + 8,
                  x2: rect.x + rect.width - 10,
                  y1: rect.y + rect.height - 2,
                  y2: rect.y + rect.height - 1,
                }
              : edge.side === "left"
                ? { x1: rect.x + 2, x2: rect.x + 1, y1: rect.y + 8, y2: rect.y + rect.height - 10 }
                : {
                    x1: rect.x + rect.width - 2,
                    x2: rect.x + rect.width - 1,
                    y1: rect.y + 8,
                    y2: rect.y + rect.height - 10,
                  };

        return (
          <g key={`shoreline-${edge.side}-${edge.cell.col}-${edge.cell.row}-${index}`}>
            <rect
              fill="rgba(127, 105, 74, 0.34)"
              height={cutoffRect.height}
              rx={isHorizontal ? 5 : 4}
              ry={isHorizontal ? 5 : 4}
              width={cutoffRect.width}
              x={cutoffRect.x}
              y={cutoffRect.y}
            />
            <line
              stroke="rgba(248, 250, 244, 0.96)"
              strokeLinecap="round"
              strokeWidth="4"
              x1={foamLine.x1}
              x2={foamLine.x2}
              y1={
                foamLine.y1 +
                (isHorizontal
                  ? Math.sin(beat * 2.1 + edge.cell.col * 0.55 + index * 0.4) * 1.8
                  : 0)
              }
              y2={
                foamLine.y2 +
                (isHorizontal
                  ? Math.cos(beat * 2.05 + edge.cell.row * 0.44 + index * 0.37) * 1.8
                  : 0)
              }
            />
            <line
              stroke="rgba(221, 244, 252, 0.64)"
              strokeLinecap="round"
              strokeWidth="2.8"
              x1={foamLine.x1}
              x2={foamLine.x2}
              y1={
                isHorizontal
                  ? foamLine.y1 + (edge.side === "top" ? -5 : 5)
                  : foamLine.y1
              }
              y2={
                isHorizontal
                  ? foamLine.y2 + (edge.side === "top" ? -5 : 5) + Math.sin(beat * 1.8 + index * 0.6) * 1.2
                  : foamLine.y2
              }
            />
            {isHorizontal
              ? Array.from({
                  length: Math.max(2, Math.floor((rect.width - 16) / 22)),
                }).map((_, foamIndex) => {
                  const foamX = rect.x + 12 + foamIndex * 22;
                  const foamY =
                    edge.side === "top"
                      ? rect.y + 2 + Math.sin(beat * 2.2 + foamIndex * 0.55 + index) * 2
                      : rect.y + rect.height - 2 + Math.sin(beat * 2.2 + foamIndex * 0.55 + index) * 2;
                  return (
                    <ellipse
                      cx={foamX}
                      cy={foamY}
                      fill="rgba(245, 252, 255, 0.68)"
                      key={`foam-puff-${foamIndex}`}
                      rx="7"
                      ry="2.8"
                    />
                  );
                })
              : null}
            {Array.from({ length: rockCount }).map((_, rockIndex) => {
              const progress = (rockIndex + 1) / (rockCount + 1);
              const radius = 3 + ((seed + rockIndex) % 3);
              const cx =
                edge.side === "left"
                  ? rect.x + 12
                  : edge.side === "right"
                    ? rect.x + rect.width - 12
                    : rect.x + rect.width * progress;
              const cy =
                edge.side === "top"
                  ? rect.y + 12
                  : edge.side === "bottom"
                    ? rect.y + rect.height - 12
                    : rect.y + rect.height * progress;
              return (
                <g key={`shore-rock-${rockIndex}`}>
                  <ellipse
                    cx={cx}
                    cy={cy}
                    fill="rgba(119, 98, 73, 0.9)"
                    rx={radius + 2}
                    ry={radius}
                  />
                  <ellipse
                    cx={cx - 1}
                    cy={cy - 1}
                    fill="rgba(168, 148, 120, 0.55)"
                    rx={Math.max(radius - 1, 1)}
                    ry={Math.max(radius - 2, 1)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

type SurfacePreviewCell = {
  col: number;
  kind: VisualSurfaceMaterialKind;
  rect: VisualRect;
  row: number;
};

type SurfacePreviewGrid = {
  cellSize: number;
  cells: SurfacePreviewCell[];
  cols: number;
  kinds: VisualSurfaceMaterialKind[][];
  rows: number;
};

type SurfacePreviewSegment = {
  height: number;
  kind: VisualSurfaceMaterialKind;
  row: number;
  width: number;
  x: number;
  y: number;
};

function buildSurfacePreviewGrid(scene: VisualScene): SurfacePreviewGrid | null {
  const surface = scene.surfaceDraft;
  if (!surface) {
    return null;
  }

  const cols = Math.max(1, Math.ceil(scene.width / surface.cellSize));
  const rows = Math.max(1, Math.ceil(scene.height / surface.cellSize));
  const overrideMap = new Map(
    surface.overrides.map((cell) => [terrainCellKey(cell.col, cell.row), cell.kind]),
  );
  const kinds: VisualSurfaceMaterialKind[][] = [];
  const cells: SurfacePreviewCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    const rowKinds: VisualSurfaceMaterialKind[] = [];
    for (let col = 0; col < cols; col += 1) {
      const kind = overrideMap.get(terrainCellKey(col, row)) ?? surface.baseKind;
      rowKinds.push(kind);
      if (!surfaceCellAllowed(scene, surface.cellSize, col, row)) {
        continue;
      }
      cells.push({
        col,
        kind,
        rect: terrainCellRect(scene, surface.cellSize, col, row),
        row,
      });
    }
    kinds.push(rowKinds);
  }

  return {
    cellSize: surface.cellSize,
    cells,
    cols,
    kinds,
    rows,
  };
}

function buildSurfacePreviewSegments(grid: SurfacePreviewGrid): SurfacePreviewSegment[] {
  const segments: SurfacePreviewSegment[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    let startCol: number | null = null;
    let currentKind: VisualSurfaceMaterialKind | null = null;

    for (let col = 0; col <= grid.cols; col += 1) {
      const cell = grid.cells.find((entry) => entry.row === row && entry.col === col);
      const nextKind = cell?.kind ?? null;

      if (nextKind !== null && nextKind === currentKind) {
        continue;
      }

      if (startCol !== null && currentKind !== null) {
        const x = startCol * grid.cellSize;
        const endX = col * grid.cellSize;
        segments.push({
          height: grid.cellSize,
          kind: currentKind,
          row,
          width: endX - x,
          x,
          y: row * grid.cellSize,
        });
      }

      startCol = nextKind === null ? null : col;
      currentKind = nextKind;
    }
  }

  return segments;
}

function surfaceMaterialColor(kind: VisualSurfaceMaterialKind, emphasis: "base" | "override") {
  const boost = emphasis === "base" ? "0.82" : "1";
  switch (kind) {
    case "paved_asphalt":
      return emphasis === "base" ? "rgba(81, 88, 92, 0.72)" : "rgba(92, 100, 105, 0.92)";
    case "tiled_stone_road":
      return emphasis === "base" ? "rgba(171, 164, 150, 0.78)" : "rgba(188, 180, 166, 0.96)";
    case "walkway":
      return emphasis === "base" ? "rgba(207, 196, 172, 0.76)" : "rgba(220, 208, 185, 0.96)";
    case "grass":
      return `rgba(117, 139, 93, ${boost})`;
    case "bushes":
      return emphasis === "base" ? "rgba(92, 117, 73, 0.82)" : "rgba(104, 132, 81, 1)";
    case "trees":
      return emphasis === "base" ? "rgba(106, 132, 86, 0.82)" : "rgba(122, 147, 98, 1)";
    default:
      return "rgba(188, 180, 166, 0.92)";
  }
}

function renderSurfaceDraftPreview(grid: SurfacePreviewGrid) {
  const segments = buildSurfacePreviewSegments(grid);
  return (
    <g key="surface-draft-preview">
      {segments.map((segment, index) => {
        const x = segment.x;
        const y = segment.y;
        const width = segment.width;
        const height = segment.height;
        return (
          <g key={`surface-draft-segment-${segment.row}-${index}`}>
            <rect
              fill={surfaceMaterialColor(segment.kind, "override")}
              height={height}
              width={width}
              x={x}
              y={y}
            />
            {segment.kind === "paved_asphalt" ? (
              <>
                <rect
                  fill="rgba(255,255,255,0.04)"
                  height={height * 0.18}
                  width={width}
                  x={x}
                  y={y + height * 0.12}
                />
                <line
                  stroke="rgba(216, 222, 210, 0.28)"
                  strokeDasharray="8 10"
                  strokeLinecap="round"
                  strokeWidth="2"
                  x1={x + 10}
                  x2={x + width - 10}
                  y1={y + height / 2}
                  y2={y + height / 2}
                />
                <rect fill="rgba(20,24,27,0.12)" height="2" width={width} x={x} y={y + height - 2} />
              </>
            ) : null}
            {segment.kind === "tiled_stone_road" || segment.kind === "walkway" ? (
              <>
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <line
                    key={`surface-row-${segment.row}-${index}-${rowIndex}`}
                    stroke={
                      segment.kind === "walkway"
                        ? "rgba(255, 249, 236, 0.26)"
                        : "rgba(235, 231, 221, 0.2)"
                    }
                    strokeWidth="1.5"
                    x1={x + 6}
                    x2={x + width - 6}
                    y1={y + ((rowIndex + 1) * height) / 4}
                    y2={y + ((rowIndex + 1) * height) / 4}
                  />
                ))}
              </>
            ) : null}
            {segment.kind === "grass" ? (
              <>
                <rect fill="rgba(184, 208, 146, 0.12)" height={height * 0.24} width={width * 0.68} x={x + width * 0.08} y={y + height * 0.18} />
                <line stroke="rgba(86, 110, 63, 0.16)" strokeLinecap="round" strokeWidth="1.4" x1={x + 10} x2={x + width - 10} y1={y + height * 0.64} y2={y + height * 0.58} />
              </>
            ) : null}
            {segment.kind === "bushes" ? (
              <>
                {Array.from({ length: Math.max(2, Math.floor(width / 54)) }).map((_, bushIndex) => {
                  const cx = x + 22 + bushIndex * 42;
                  const cy = y + height * (bushIndex % 2 === 0 ? 0.5 : 0.42);
                  return (
                    <g key={`bush-segment-${bushIndex}`}>
                      <circle cx={cx} cy={cy} fill="rgba(55, 77, 43, 0.44)" r="8" />
                      <circle cx={cx + 10} cy={cy - 4} fill="rgba(69, 91, 53, 0.5)" r="9" />
                    </g>
                  );
                })}
              </>
            ) : null}
            {segment.kind === "trees" ? (
              <>
                {Array.from({ length: Math.max(1, Math.floor(width / 86)) }).map((_, treeIndex) => {
                  const cx = x + 28 + treeIndex * 68;
                  const cy = y + height * (treeIndex % 2 === 0 ? 0.46 : 0.4);
                  return (
                    <g key={`tree-segment-${treeIndex}`}>
                      <rect fill="rgba(92, 68, 50, 0.48)" height="8" rx="2" width="4" x={cx - 2} y={cy + 10} />
                      <circle cx={cx} cy={cy} fill="rgba(55, 92, 48, 0.64)" r="11" />
                      <circle cx={cx + 8} cy={cy - 3} fill="rgba(64, 99, 52, 0.52)" r="8" />
                    </g>
                  );
                })}
              </>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function renderSurfaceZonePreview(zone: VisualScene["surfaceZones"][number], index: number) {
  const fill = surfacePreviewFill(zone.kind);
  const innerStroke =
    zone.kind === "square_center" || zone.kind === "square_border"
      ? "rgba(248, 242, 226, 0.45)"
      : "rgba(255, 255, 255, 0.14)";
  const seamCount =
    zone.kind === "main_street" || zone.kind === "north_promenade" || zone.kind === "service_lane"
      ? 3
      : zone.kind === "square_center" || zone.kind === "square_border"
        ? 2
        : 0;

  return (
    <g key={`surface-preview-${zone.id}-${index}`}>
      <rect
        fill={fill}
        height={zone.rect.height}
        rx={zone.rect.radius ?? 12}
        ry={zone.rect.radius ?? 12}
        stroke="rgba(103, 90, 63, 0.18)"
        strokeWidth="2"
        width={zone.rect.width}
        x={zone.rect.x}
        y={zone.rect.y}
      />
      {Array.from({ length: seamCount }).map((_, seamIndex) => {
        const ratio = (seamIndex + 1) / (seamCount + 1);
        return (
          <line
            key={`surface-seam-${zone.id}-${seamIndex}`}
            stroke={innerStroke}
            strokeLinecap="round"
            strokeWidth="2"
            x1={zone.rect.x + 18}
            x2={zone.rect.x + zone.rect.width - 18}
            y1={zone.rect.y + zone.rect.height * ratio}
            y2={zone.rect.y + zone.rect.height * ratio}
          />
        );
      })}
    </g>
  );
}

function renderFringeZonePreview(zone: VisualScene["fringeZones"][number], index: number) {
  const fill =
    zone.kind === "quay_continuation"
      ? "#6d5947"
      : zone.kind === "side_street"
        ? "#1f2a30"
        : zone.kind === "alley_mouth"
          ? "#20272c"
          : "#2d363b";
  return (
    <rect
      fill={fill}
      height={zone.rect.height}
      key={`fringe-preview-${zone.id}-${index}`}
      rx={zone.rect.radius ?? 12}
      ry={zone.rect.radius ?? 12}
      stroke="rgba(242, 231, 205, 0.08)"
      strokeWidth="2"
      width={zone.rect.width}
      x={zone.rect.x}
      y={zone.rect.y}
    />
  );
}

function renderLandmarkPreview(landmark: VisualScene["landmarks"][number], index: number) {
  const roofFill =
    landmark.style === "cafe"
      ? "#9a7a5c"
      : landmark.style === "boarding-house"
        ? "#7f8c92"
        : landmark.style === "workshop"
          ? "#5a6670"
          : landmark.style === "dock"
            ? "#8d6d47"
            : landmark.style === "yard" || landmark.style === "courtyard"
              ? "#7c8b63"
              : "#d6c7a9";
  const bodyFill =
    landmark.style === "cafe"
      ? "#efe3c8"
      : landmark.style === "boarding-house"
        ? "#d8c2ae"
        : landmark.style === "workshop"
          ? "#9e8667"
          : landmark.style === "dock"
            ? "#866444"
            : landmark.style === "yard" || landmark.style === "courtyard"
              ? "#72825f"
              : "#ddd1b8";
  const lowerBand =
    landmark.style === "cafe"
      ? "#7f5d3e"
      : landmark.style === "boarding-house"
        ? "#9f725e"
        : landmark.style === "workshop"
          ? "#6e5b46"
          : landmark.style === "dock"
            ? "#76563b"
            : "#a99c7d";

  return (
    <g key={`landmark-preview-${landmark.id}-${index}`}>
      <rect
        fill={bodyFill}
        height={landmark.rect.height}
        rx={landmark.rect.radius ?? 20}
        ry={landmark.rect.radius ?? 20}
        stroke="rgba(244, 234, 211, 0.35)"
        strokeWidth="4"
        width={landmark.rect.width}
        x={landmark.rect.x}
        y={landmark.rect.y}
      />
      <rect
        fill={roofFill}
        height={Math.max(28, Math.min(56, landmark.rect.height * 0.24))}
        rx={landmark.rect.radius ?? 18}
        ry={landmark.rect.radius ?? 18}
        width={landmark.rect.width}
        x={landmark.rect.x}
        y={landmark.rect.y}
      />
      <rect
        fill={lowerBand}
        height={Math.max(40, landmark.rect.height * 0.22)}
        rx="0"
        width={landmark.rect.width - 18}
        x={landmark.rect.x + 9}
        y={landmark.rect.y + landmark.rect.height - Math.max(40, landmark.rect.height * 0.22) - 10}
      />
    </g>
  );
}

function renderLandmarkModulePreview(
  module: VisualScene["landmarkModules"][number],
  index: number,
) {
  const rect = module.rect;

  if (module.kind === "awning") {
    const stripeCount = Math.max(4, module.count ?? Math.floor(rect.width / 38));
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: stripeCount }).map((_, stripeIndex) => {
          const stripeWidth = rect.width / stripeCount;
          const colors =
            module.locationId === "tea-house"
              ? ["#4c9a70", "#f2efe2", "#d27d3d", "#f2efe2"]
              : ["#6d7f8d", "#f2efe2"];
          return (
            <rect
              fill={colors[stripeIndex % colors.length]}
              height={rect.height}
              key={`awning-${module.id}-${stripeIndex}`}
              width={stripeWidth + 1}
              x={rect.x + stripeIndex * stripeWidth}
              y={rect.y}
            />
          );
        })}
      </g>
    );
  }

  if (module.kind === "window_row") {
    const count = Math.max(2, module.count ?? 4);
    const gap = 14;
    const windowWidth = Math.max(20, (rect.width - gap * (count + 1)) / count);
    const windowHeight = Math.max(18, rect.height * 0.6);
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: count }).map((_, windowIndex) => (
          <rect
            fill="#f6ebc7"
            height={windowHeight}
            key={`window-${module.id}-${windowIndex}`}
            rx="10"
            ry="10"
            stroke="rgba(112, 82, 52, 0.16)"
            strokeWidth="2"
            width={windowWidth}
            x={rect.x + gap + windowIndex * (windowWidth + gap)}
            y={rect.y + (rect.height - windowHeight) / 2}
          />
        ))}
      </g>
    );
  }

  if (module.kind === "entry" || module.kind === "service_bay") {
    return (
      <rect
        fill={module.kind === "entry" ? "#7a593c" : "#434c52"}
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 14}
        ry={rect.radius ?? 14}
        stroke="rgba(247, 239, 219, 0.22)"
        strokeWidth="3"
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "sign") {
    return (
      <rect
        fill="#334842"
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 12}
        ry={rect.radius ?? 12}
        stroke="#ccb47a"
        strokeWidth="3"
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "terrace_rail" || module.kind === "trim" || module.kind === "wall_band") {
    return (
      <rect
        fill={module.kind === "terrace_rail" ? "#856448" : "#c29a72"}
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 8}
        ry={rect.radius ?? 8}
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "roof_cap") {
    return (
      <rect
        fill="#708089"
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 14}
        ry={rect.radius ?? 14}
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "stoop") {
    return (
      <rect
        fill="#b8ab8d"
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 10}
        ry={rect.radius ?? 10}
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "shutters") {
    const count = Math.max(2, module.count ?? 3);
    const gap = 10;
    const shutterWidth = Math.max(14, (rect.width - gap * (count + 1)) / count);
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: count }).map((_, shutterIndex) => (
          <rect
            fill="#d9e2df"
            height={rect.height}
            key={`shutter-${module.id}-${shutterIndex}`}
            rx="6"
            ry="6"
            width={shutterWidth}
            x={rect.x + gap + shutterIndex * (shutterWidth + gap)}
            y={rect.y}
          />
        ))}
      </g>
    );
  }

  if (module.kind === "downspout") {
    return (
      <rect
        fill="#5d686f"
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx="4"
        ry="4"
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  return null;
}

function renderPropPreview(prop: VisualScene["props"][number], index: number) {
  if (prop.kind === "lamp") {
    const scale = prop.scale ?? 1;
    return (
      <g key={`prop-preview-${index}`}>
        <line
          stroke="#465258"
          strokeLinecap="round"
          strokeWidth={4 * scale}
          x1={prop.x}
          x2={prop.x}
          y1={prop.y - 18 * scale}
          y2={prop.y + 18 * scale}
        />
        <circle
          cx={prop.x}
          cy={prop.y - 22 * scale}
          fill="#f2dea1"
          r={7 * scale}
          stroke="rgba(68, 77, 83, 0.85)"
          strokeWidth="2"
        />
      </g>
    );
  }

  if (prop.kind === "bench") {
    return (
      <g key={`prop-preview-${index}`}>
        <rect fill="#7c5d3f" height="12" rx="4" ry="4" width="44" x={prop.x - 22} y={prop.y - 6} />
        <line stroke="#5c4530" strokeWidth="3" x1={prop.x - 16} x2={prop.x - 16} y1={prop.y + 4} y2={prop.y + 16} />
        <line stroke="#5c4530" strokeWidth="3" x1={prop.x + 16} x2={prop.x + 16} y1={prop.y + 4} y2={prop.y + 16} />
      </g>
    );
  }

  if (prop.kind === "planter") {
    return (
      <g key={`prop-preview-${index}`}>
        <rect fill="#75573d" height="16" rx="5" ry="5" width="20" x={prop.x - 10} y={prop.y - 4} />
        <circle cx={prop.x} cy={prop.y - 8} fill="#58724c" r="12" />
      </g>
    );
  }

  if (prop.kind === "terrace-table") {
    return (
      <g key={`prop-preview-${index}`}>
        <circle cx={prop.x} cy={prop.y} fill="#7a5a3c" r="12" />
        <line stroke="#7a5a3c" strokeWidth="3" x1={prop.x} x2={prop.x} y1={prop.y + 8} y2={prop.y + 22} />
        <circle cx={prop.x - 18} cy={prop.y + 2} fill="#8a6848" r="6" />
        <circle cx={prop.x + 18} cy={prop.y + 2} fill="#8a6848" r="6" />
      </g>
    );
  }

  if (prop.kind === "boat") {
    const scale = prop.scale ?? 1;
    return (
      <g key={`prop-preview-${index}`} transform={`rotate(${((prop.rotation ?? 0) * 180) / Math.PI} ${prop.x} ${prop.y})`}>
        <ellipse cx={prop.x} cy={prop.y} fill="#6f553d" rx={34 * scale} ry={12 * scale} />
        <ellipse cx={prop.x} cy={prop.y - 2 * scale} fill="#c3d6df" rx={18 * scale} ry={6 * scale} />
      </g>
    );
  }

  return null;
}

function renderPropClusterPreview(
  cluster: VisualScene["propClusters"][number],
  index: number,
) {
  if (!cluster.points?.length) {
    return null;
  }

  return (
    <g key={`cluster-preview-${cluster.id}-${index}`}>
      {cluster.points.map((point, pointIndex) => {
        if (cluster.kind === "cafe_terrace") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <circle cx={point.x} cy={point.y} fill="#7a5a3c" r="12" />
              <circle cx={point.x - 18} cy={point.y + 2} fill="#8e6c48" r="5" />
              <circle cx={point.x + 18} cy={point.y + 2} fill="#8e6c48" r="5" />
            </g>
          );
        }

        if (cluster.kind === "square_bench_pair") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <rect fill="#7c5d3f" height="12" rx="4" ry="4" width="46" x={point.x - 23} y={point.y - 8} />
              <line stroke="#5c4530" strokeWidth="3" x1={point.x - 16} x2={point.x - 16} y1={point.y + 2} y2={point.y + 14} />
              <line stroke="#5c4530" strokeWidth="3" x1={point.x + 16} x2={point.x + 16} y1={point.y + 2} y2={point.y + 14} />
            </g>
          );
        }

        if (cluster.kind === "square_planter_pair") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <rect fill="#75573d" height="16" rx="5" ry="5" width="22" x={point.x - 11} y={point.y - 6} />
              <circle cx={point.x} cy={point.y - 10} fill="#5f7b52" r="12" />
            </g>
          );
        }

        if (cluster.kind === "workshop_stock" || cluster.kind === "yard_service") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <rect fill="#7f6546" height="16" rx="4" ry="4" width="18" x={point.x - 9} y={point.y - 8} />
              <rect fill="#9b8159" height="14" rx="4" ry="4" width="20" x={point.x + 6} y={point.y - 6} />
            </g>
          );
        }

        if (cluster.kind === "harbor_mooring") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <line stroke="#5d4630" strokeWidth="4" x1={point.x} x2={point.x} y1={point.y - 12} y2={point.y + 12} />
              <circle cx={point.x} cy={point.y - 12} fill="#8f6f48" r="5" />
            </g>
          );
        }

        return null;
      })}
    </g>
  );
}

function getScenePreviewDepth(canvasMode: BuilderCanvasMode) {
  switch (canvasMode) {
    case "ground":
      return 0;
    case "roads":
      return 1;
    case "buildings":
      return 2;
    case "details":
    default:
      return 3;
  }
}

function selectionVisibleInCanvasMode(
  scene: VisualScene,
  selection: BuilderSelection,
  canvasMode: BuilderCanvasMode,
) {
  switch (canvasMode) {
    case "ground":
      if (selection.kind === "fringeZone" || selection.kind === "waterRegion") {
        return true;
      }
      return (
        selection.kind === "surfaceZone" &&
        Boolean(scene.surfaceZones[selection.index]) &&
        GROUND_SURFACE_KINDS.has(scene.surfaceZones[selection.index].kind)
      );
    case "roads":
      return (
        selection.kind === "surfaceZone" &&
        Boolean(scene.surfaceZones[selection.index]) &&
        ROAD_SURFACE_KINDS.has(scene.surfaceZones[selection.index].kind)
      );
    case "buildings":
      return selection.kind === "landmark" || selection.kind === "landmarkModule";
    case "details":
      return (
        selection.kind === "propCluster" ||
        selection.kind === "prop" ||
        selection.kind === "label" ||
        selection.kind === "playerSpawn" ||
        selection.kind === "npcAnchor" ||
        selection.kind === "locationAnchorHighlight" ||
        selection.kind === "locationAnchorPoint" ||
        selection.kind === "locationAnchorNpcStand"
      );
    default:
      return false;
  }
}

function defaultSelectionForCanvasMode(
  scene: VisualScene,
  canvasMode: BuilderCanvasMode,
): BuilderSelection | null {
  switch (canvasMode) {
    case "ground":
      if (scene.waterRegions.length > 0) {
        return { kind: "waterRegion", index: 0 };
      }
      if (scene.fringeZones.length > 0) {
        return { kind: "fringeZone", index: 0 };
      }
      {
        const groundIndex = scene.surfaceZones.findIndex((zone) =>
          GROUND_SURFACE_KINDS.has(zone.kind),
        );
        if (groundIndex >= 0) {
          return { kind: "surfaceZone", index: groundIndex };
        }
      }
      return null;
    case "roads": {
      const roadIndex = scene.surfaceZones.findIndex((zone) =>
        ROAD_SURFACE_KINDS.has(zone.kind),
      );
      return roadIndex >= 0 ? { kind: "surfaceZone", index: roadIndex } : null;
    }
    case "buildings":
      if (scene.landmarks.length > 0) {
        return { kind: "landmark", index: 0 };
      }
      if (scene.landmarkModules.length > 0) {
        return { kind: "landmarkModule", index: 0 };
      }
      return null;
    case "details":
      if (scene.propClusters.length > 0) {
        return { kind: "propCluster", index: 0 };
      }
      if (scene.props.length > 0) {
        return { kind: "prop", index: 0 };
      }
      if (scene.labels.length > 0) {
        return { kind: "label", index: 0 };
      }
      return { kind: "playerSpawn" };
    default:
      return null;
  }
}

function selectionsForCanvasMode(
  scene: VisualScene,
  canvasMode: BuilderCanvasMode,
): BuilderSelection[] {
  switch (canvasMode) {
    case "ground":
      return [
        ...scene.surfaceZones
          .map((zone, index) => ({ index, zone }))
          .filter(({ zone }) => GROUND_SURFACE_KINDS.has(zone.kind))
          .map(({ index }) => ({ kind: "surfaceZone", index }) as BuilderSelection),
        ...scene.fringeZones.map((_, index) => ({ kind: "fringeZone", index }) as BuilderSelection),
        ...scene.waterRegions.map((_, index) => ({ kind: "waterRegion", index }) as BuilderSelection),
      ];
    case "roads":
      return scene.surfaceZones
        .map((zone, index) => ({ index, zone }))
        .filter(({ zone }) => ROAD_SURFACE_KINDS.has(zone.kind))
        .map(({ index }) => ({ kind: "surfaceZone", index }) as BuilderSelection);
    case "buildings":
      return [
        ...scene.landmarks.map((_, index) => ({ kind: "landmark", index }) as BuilderSelection),
        ...scene.landmarkModules.map((_, index) => ({ kind: "landmarkModule", index }) as BuilderSelection),
      ];
    case "details":
      return [
        ...scene.propClusters.map((_, index) => ({ kind: "propCluster", index }) as BuilderSelection),
        ...scene.props.map((_, index) => ({ kind: "prop", index }) as BuilderSelection),
        ...scene.labels.map((_, index) => ({ kind: "label", index }) as BuilderSelection),
        { kind: "playerSpawn" },
        ...Object.keys(scene.npcAnchors).map((id) => ({ kind: "npcAnchor", id }) as BuilderSelection),
      ];
    default:
      return [];
  }
}

function renderSelectionPreviewHighlight(selectedMeta: ReturnType<typeof describeSelection>) {
  if (!selectedMeta) {
    return null;
  }

  if (selectedMeta.mode === "rect") {
    return (
      <rect
        fill="none"
        height={selectedMeta.rect.height}
        rx={selectedMeta.rect.radius ?? 18}
        ry={selectedMeta.rect.radius ?? 18}
        stroke="#f4d08e"
        strokeWidth="4"
        width={selectedMeta.rect.width}
        x={selectedMeta.rect.x}
        y={selectedMeta.rect.y}
      />
    );
  }

  return (
    <circle
      cx={selectedMeta.point.x}
      cy={selectedMeta.point.y}
      fill="none"
      r="16"
      stroke="#f4d08e"
      strokeWidth="4"
    />
  );
}

function formatColorHex(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function parseColorHex(value: string) {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 16);
}

function getSelectionLocationId(scene: VisualScene, selection: BuilderSelection): string | null {
  switch (selection.kind) {
    case "landmark":
      return scene.landmarks[selection.index]?.locationId ?? null;
    case "landmarkModule":
      return scene.landmarkModules[selection.index]?.locationId ?? null;
    case "propCluster":
      return scene.propClusters[selection.index]?.locationId ?? null;
    case "locationAnchorHighlight":
    case "locationAnchorNpcStand":
      return selection.locationId;
    case "locationAnchorPoint":
      return selection.locationId;
    default:
      return null;
  }
}

function getFocusRect(scene: VisualScene, selection: BuilderSelection): VisualRect | null {
  const locationId = getSelectionLocationId(scene, selection);
  if (locationId) {
    const anchor = scene.locationAnchors[locationId];
    if (anchor) {
      return expandedRect(anchor.highlight, 54);
    }
  }

  const rect = getSelectionRect(scene, selection);
  if (rect) {
    return expandedRect(rect, 42);
  }

  const point = getSelectionPoint(scene, selection);
  if (point) {
    return {
      x: point.x - 84,
      y: point.y - 84,
      width: 168,
      height: 168,
      radius: 24,
    };
  }

  return null;
}

function getStageViewBox(
  scene: VisualScene,
  focusRect: VisualRect | null,
  zoomLevel: number,
) {
  if (!focusRect) {
    return {
      height: scene.height,
      width: scene.width,
      x: 0,
      y: 0,
    };
  }

  const padding = 96;
  let x = focusRect.x - padding;
  let y = focusRect.y - padding;
  let width = focusRect.width + padding * 2;
  let height = focusRect.height + padding * 2;

  const effectiveZoom = Math.max(0.25, zoomLevel);
  width /= effectiveZoom;
  height /= effectiveZoom;

  const sceneAspect = scene.width / scene.height;
  const currentAspect = width / height;

  if (currentAspect > sceneAspect) {
    const targetHeight = width / sceneAspect;
    y -= (targetHeight - height) / 2;
    height = targetHeight;
  } else {
    const targetWidth = height * sceneAspect;
    x -= (targetWidth - width) / 2;
    width = targetWidth;
  }

  if (width >= scene.width) {
    x = 0;
    width = scene.width;
  } else {
    x = Math.max(0, Math.min(x, scene.width - width));
  }

  if (height >= scene.height) {
    y = 0;
    height = scene.height;
  } else {
    y = Math.max(0, Math.min(y, scene.height - height));
  }

  return { height, width, x, y };
}

function selectionInFocus(
  scene: VisualScene,
  selection: BuilderSelection,
  focusRect: VisualRect | null,
  focusLocationId: string | null,
) {
  if (!focusRect) {
    return true;
  }

  const selectionLocationId = getSelectionLocationId(scene, selection);
  if (focusLocationId && selectionLocationId === focusLocationId) {
    return true;
  }

  const rect = getSelectionRect(scene, selection);
  if (rect && rectsOverlap(rect, focusRect)) {
    return true;
  }

  const point = getSelectionPoint(scene, selection);
  return point ? pointInsideRect(point, focusRect) : false;
}

function nextSceneId(prefix: string, existing: Set<string>) {
  let attempt = 1;
  let candidate = `${prefix}-${attempt}`;
  while (existing.has(candidate)) {
    attempt += 1;
    candidate = `${prefix}-${attempt}`;
  }
  existing.add(candidate);
  return candidate;
}

function applyPresetToScene(
  draft: VisualSceneDocument,
  preset: BuilderPresetKind,
  selection: BuilderSelection,
) {
  const defaultLocationByPreset: Record<BuilderPresetKind, string> = {
    boarding_frontage: "boarding-house",
    eatery_frontage: "tea-house",
    harbor_edge_kit: "moss-pier",
    square_kit: "market-square",
    workshop_frontage: "repair-stall",
    yard_service_kit: "courtyard",
  };

  const targetLocationId =
    getSelectionLocationId(draft, selection) ?? defaultLocationByPreset[preset];
  const landmark = draft.landmarks.find((item) => item.locationId === targetLocationId);
  if (!landmark) {
    return;
  }

  const existingIds = new Set(
    [
      ...draft.landmarks.map((item) => item.id),
      ...draft.surfaceZones.map((item) => item.id),
      ...draft.fringeZones.map((item) => item.id),
      ...draft.landmarkModules.map((item) => item.id),
      ...draft.propClusters.map((item) => item.id),
      ...draft.waterRegions.map((item) => item.id),
    ].filter(Boolean),
  );
  const { rect } = landmark;

  function pushModule(
    kind: VisualLandmarkModuleKind,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: { count?: number; radius?: number; text?: string; variant?: string },
  ) {
    draft.landmarkModules.push({
      count: options?.count,
      id: nextSceneId(`${targetLocationId}-${kind}`, existingIds),
      kind,
      locationId: targetLocationId,
      rect: {
        x,
        y,
        width,
        height,
        radius: options?.radius,
      },
      text: options?.text,
      variant: options?.variant,
    });
  }

  function pushCluster(
    kind: VisualPropClusterKind,
    clusterRect: VisualRect,
    points?: VisualPoint[],
  ) {
    draft.propClusters.push({
      id: nextSceneId(`${targetLocationId}-${kind}`, existingIds),
      kind,
      locationId: targetLocationId,
      points,
      rect: clusterRect,
    });
  }

  function pushSurface(kind: VisualSurfaceZoneKind, zoneRect: VisualRect, emphasis: "low" | "medium" | "high") {
    draft.surfaceZones.push({
      emphasis,
      id: nextSceneId(`${targetLocationId}-${kind}`, existingIds),
      kind,
      rect: zoneRect,
    });
  }

  function pushWater(
    tag: VisualSceneWaterTag,
    waterRect: VisualRect,
    baseColor: number,
    crestColor: number,
    intensity: number,
  ) {
    draft.waterRegions.push({
      baseColor,
      crestColor,
      id: nextSceneId(`${targetLocationId}-${tag}`, existingIds),
      intensity,
      rect: waterRect,
      tag,
    });
  }

  switch (preset) {
    case "eatery_frontage":
      pushModule("sign", rect.x + 78, rect.y + 26, rect.width - 156, 34, {
        radius: 12,
        variant: "cafe",
      });
      pushModule("awning", rect.x + 28, rect.y + 108, rect.width - 56, 38, {
        variant: "terrace-awning",
      });
      pushModule("window_row", rect.x + 22, rect.y + 156, rect.width - 44, 66, {
        count: 2,
        radius: 12,
        variant: "cafe-large",
      });
      pushModule("entry", rect.x + rect.width / 2 - 34, rect.y + 150, 68, 92, {
        radius: 14,
        variant: "arched",
      });
      pushModule("terrace_rail", rect.x + 34, rect.y + rect.height - 34, rect.width - 68, 18, {
        radius: 8,
        variant: "cafe",
      });
      pushCluster(
        "cafe_terrace",
        { x: rect.x + 60, y: rect.y + rect.height + 18, width: rect.width - 120, height: 72, radius: 14 },
        [
          { x: rect.x + 92, y: rect.y + rect.height + 52 },
          { x: rect.x + rect.width / 2, y: rect.y + rect.height + 48 },
          { x: rect.x + rect.width - 92, y: rect.y + rect.height + 52 },
        ],
      );
      draft.props.push(
        { kind: "terrace-table", x: rect.x + 92, y: rect.y + rect.height + 50 },
        { kind: "terrace-table", x: rect.x + rect.width / 2, y: rect.y + rect.height + 46 },
        { kind: "terrace-table", x: rect.x + rect.width - 92, y: rect.y + rect.height + 50 },
        { kind: "planter", x: rect.x + 42, y: rect.y + rect.height + 54 },
        { kind: "planter", x: rect.x + rect.width - 42, y: rect.y + rect.height + 54 },
      );
      return;
    case "boarding_frontage":
      pushModule("roof_cap", rect.x, rect.y, rect.width, 36, {
        radius: 18,
        variant: "slate",
      });
      pushModule("window_row", rect.x + 34, rect.y + 62, rect.width - 68, 60, {
        count: 5,
        radius: 10,
        variant: "boarding-upper",
      });
      pushModule("window_row", rect.x + 52, rect.y + 146, rect.width - 104, 54, {
        count: 4,
        radius: 10,
        variant: "boarding-lower",
      });
      pushModule("entry", rect.x + rect.width / 2 - 30, rect.y + rect.height - 104, 60, 84, {
        radius: 12,
        variant: "house-door",
      });
      pushModule("stoop", rect.x + rect.width / 2 - 46, rect.y + rect.height - 22, 92, 22, {
        radius: 10,
        variant: "boarding",
      });
      pushModule("downspout", rect.x + rect.width - 26, rect.y + 48, 10, 168, {
        radius: 4,
        variant: "slate",
      });
      return;
    case "workshop_frontage":
      pushModule("roof_cap", rect.x, rect.y, rect.width, 36, {
        radius: 16,
        variant: "iron",
      });
      pushModule("service_bay", rect.x + 22, rect.y + rect.height - 92, rect.width - 44, 82, {
        radius: 14,
        variant: "workshop-bay",
      });
      pushModule("shutters", rect.x + 36, rect.y + 72, rect.width - 72, 34, {
        count: 3,
        radius: 8,
        variant: "workshop",
      });
      pushModule("sign", rect.x + 62, rect.y + 22, rect.width - 124, 30, {
        radius: 10,
        variant: "workshop",
      });
      pushCluster(
        "workshop_stock",
        { x: rect.x - 44, y: rect.y + rect.height + 24, width: rect.width + 12, height: 78, radius: 14 },
        [
          { x: rect.x - 12, y: rect.y + rect.height + 60 },
          { x: rect.x + 42, y: rect.y + rect.height + 66 },
          { x: rect.x + rect.width / 2, y: rect.y + rect.height + 62 },
        ],
      );
      draft.props.push(
        { kind: "bench", x: rect.x + 28, y: rect.y + rect.height + 54 },
        { kind: "planter", x: rect.x + rect.width - 28, y: rect.y + rect.height + 54 },
      );
      return;
    case "square_kit":
      pushSurface("square_border", expandedRect(rect, 22), "high");
      pushSurface(
        "square_center",
        {
          x: rect.x + 42,
          y: rect.y + 42,
          width: Math.max(180, rect.width - 84),
          height: Math.max(140, rect.height - 84),
          radius: 24,
        },
        "high",
      );
      pushCluster(
        "square_bench_pair",
        { x: rect.x + 66, y: rect.y + 70, width: rect.width - 132, height: 66, radius: 12 },
        [
          { x: rect.x + 118, y: rect.y + 102 },
          { x: rect.x + rect.width - 118, y: rect.y + 102 },
        ],
      );
      pushCluster(
        "square_planter_pair",
        { x: rect.x + 38, y: rect.y + 86, width: rect.width - 76, height: rect.height - 172, radius: 12 },
        [
          { x: rect.x + 62, y: rect.y + rect.height / 2 },
          { x: rect.x + rect.width - 62, y: rect.y + rect.height / 2 },
        ],
      );
      draft.props.push(
        { kind: "lamp", x: rect.x + 44, y: rect.y + 44 },
        { kind: "lamp", x: rect.x + rect.width - 44, y: rect.y + 44 },
        { kind: "lamp", x: rect.x + 44, y: rect.y + rect.height - 44 },
        { kind: "lamp", x: rect.x + rect.width - 44, y: rect.y + rect.height - 44 },
      );
      return;
    case "yard_service_kit":
      pushSurface("courtyard_ground", expandedRect(rect, 16), "medium");
      pushCluster(
        "yard_service",
        { x: rect.x + 30, y: rect.y + 76, width: rect.width - 60, height: rect.height - 126, radius: 16 },
        [
          { x: rect.x + 78, y: rect.y + rect.height / 2 },
          { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 - 18 },
          { x: rect.x + rect.width - 78, y: rect.y + rect.height / 2 + 8 },
        ],
      );
      draft.props.push(
        { kind: "bench", rotation: Math.PI / 2, x: rect.x + rect.width / 2, y: rect.y + 58 },
        { kind: "planter", x: rect.x + 46, y: rect.y + rect.height - 40 },
        { kind: "planter", x: rect.x + rect.width - 46, y: rect.y + rect.height - 40 },
      );
      return;
    case "harbor_edge_kit":
      pushSurface(
        "dock_apron",
        { x: rect.x - 54, y: rect.y - 68, width: rect.width + 84, height: 96, radius: 14 },
        "medium",
      );
      pushSurface(
        "quay_wall",
        { x: rect.x - 12, y: rect.y + rect.height - 10, width: rect.width + 24, height: 54, radius: 8 },
        "high",
      );
      pushSurface(
        "deep_water",
        { x: rect.x - 64, y: rect.y + rect.height + 40, width: rect.width + 182, height: 214, radius: 8 },
        "high",
      );
      pushWater(
        "water_surface",
        { x: rect.x - 64, y: rect.y + rect.height + 40, width: rect.width + 182, height: 214, radius: 8 },
        0x2a6c8a,
        0xd8f7ff,
        1,
      );
      pushWater(
        "shore_foam",
        { x: rect.x - 24, y: rect.y + rect.height + 32, width: rect.width + 102, height: 22, radius: 8 },
        0xebf7fb,
        0xffffff,
        0.9,
      );
      pushCluster(
        "harbor_mooring",
        { x: rect.x + 44, y: rect.y + rect.height + 18, width: rect.width - 88, height: 90, radius: 12 },
        [
          { x: rect.x + 78, y: rect.y + rect.height + 44 },
          { x: rect.x + rect.width / 2, y: rect.y + rect.height + 56 },
          { x: rect.x + rect.width - 78, y: rect.y + rect.height + 46 },
        ],
      );
      draft.props.push(
        {
          kind: "boat",
          bobAmount: 5,
          rotation: -0.12,
          scale: 1.04,
          waterRegionId: draft.waterRegions[draft.waterRegions.length - 2]?.id ?? "water",
          x: rect.x + rect.width / 2 - 96,
          y: rect.y + rect.height + 142,
        },
        {
          kind: "boat",
          bobAmount: 6,
          rotation: 0.1,
          scale: 1.08,
          waterRegionId: draft.waterRegions[draft.waterRegions.length - 2]?.id ?? "water",
          x: rect.x + rect.width / 2 + 84,
          y: rect.y + rect.height + 164,
        },
      );
      return;
    default:
      return;
  }
}

export function VisualSceneBuilder() {
  const baseScene = getVisualSceneDocument(BUILDER_SCENE_ID);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const didApplyQueryLayerRef = useRef(false);
  const [scene, setScene] = useState(() => cloneScene(baseScene!));
  const [selected, setSelected] = useState<BuilderSelection>({ kind: "landmark", index: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([
    selectionId({ kind: "landmark", index: 0 }),
  ]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const [paintState, setPaintState] = useState<PaintState | null>(null);
  const [canvasMode, setCanvasMode] = useState<BuilderCanvasMode>("buildings");
  const [focusMode, setFocusMode] = useState(true);
  const [groundToolMode, setGroundToolMode] = useState<GroundToolMode>("brush");
  const [roadToolMode, setRoadToolMode] = useState<RoadToolMode>("brush");
  const [terrainDisplayMode, setTerrainDisplayMode] = useState<TerrainDisplayMode>("render");
  const [terrainBrushKind, setTerrainBrushKind] = useState<VisualTerrainKind>("land");
  const [terrainBrushSize, setTerrainBrushSize] = useState(2);
  const [surfaceBrushKind, setSurfaceBrushKind] =
    useState<VisualSurfaceMaterialKind>("tiled_stone_road");
  const [surfaceBrushSize, setSurfaceBrushSize] = useState(2);
  const [stageZoom, setStageZoom] = useState(0.72);
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [importMode, setImportMode] = useState<BuilderImportMode>("json");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [moduleCopiedLabel, setModuleCopiedLabel] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [gameApplyLabel, setGameApplyLabel] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<string | null>(null);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [visibleGroups, setVisibleGroups] = useState<VisibleGroups>({
    anchors: false,
    fringe: false,
    labels: false,
    landmarks: true,
    modules: false,
    props: true,
    surfaceZones: false,
    water: false,
  });
  const [addState, setAddState] = useState<AddState>({
    fringeEdge: "north",
    fringeKind: "neighbor_facade",
    moduleKind: "awning",
    propClusterKind: "cafe_terrace",
    propKind: "lamp",
    surfaceKind: "main_street",
    waterTag: "water_surface",
  });

  useEffect(() => {
    if (!baseScene || typeof window === "undefined") {
      setHasHydratedDraft(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(BUILDER_STORAGE_KEY);
      if (stored) {
        const parsed = parseVisualSceneDocument(stored, baseScene!);
        setScene(parsed);
        setPersistenceStatus("Loaded local builder draft");
      } else {
        setPersistenceStatus("Using file scene");
      }
    } catch {
      setPersistenceStatus("Could not load saved builder draft");
    } finally {
      setHasHydratedDraft(true);
    }
  }, [baseScene]);

  useEffect(() => {
    if (!baseScene || !hasHydratedDraft || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(BUILDER_STORAGE_KEY, buildExportText(scene));
      setPersistenceStatus("Saved locally in this browser");
    } catch {
      setPersistenceStatus("Could not save local builder draft");
    }
  }, [baseScene, hasHydratedDraft, scene]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setPreviewTimeMs(performance.now());
    const timerId = window.setInterval(() => {
      setPreviewTimeMs(performance.now());
    }, 80);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (didApplyQueryLayerRef.current) {
      return;
    }

    const search = new URLSearchParams(window.location.search);
    const requestedLayer = search.get("layer");
    const focusParam = search.get("focus");
    if (
      requestedLayer === "ground" ||
      requestedLayer === "roads" ||
      requestedLayer === "buildings" ||
      requestedLayer === "details"
    ) {
      didApplyQueryLayerRef.current = true;
      setCanvasMode(requestedLayer);
      setSelected((currentSelected) => {
        const nextSelection = selectionVisibleInCanvasMode(scene, currentSelected, requestedLayer)
          ? currentSelected
          : defaultSelectionForCanvasMode(scene, requestedLayer) ?? currentSelected;
        setSelectedIds([selectionId(nextSelection)]);
        return nextSelection;
      });
    }

    if (focusParam === "0" || focusParam === "false" || focusParam === "off") {
      setFocusMode(false);
    }
  }, [scene]);

  useEffect(() => {
    const selectedId = selectionId(selected);
    const validIds = new Set(buildListItems(scene).map((item) => item.id));
    setSelectedIds((previous) => {
      const filtered = previous.filter((id) => validIds.has(id));
      if (filtered.length === 0) {
        return [selectedId];
      }
      return filtered.includes(selectedId) ? filtered : [selectedId];
    });
  }, [scene, selected]);

  if (!baseScene) {
    return <div>South Quay visual scene not found.</div>;
  }

  const builderItems = buildListItems(scene);
  const selectedVisibleInMode = selectionVisibleInCanvasMode(scene, selected, canvasMode);
  const focusRect =
    focusMode && selectedVisibleInMode ? getFocusRect(scene, selected) : null;
  const focusLocationId =
    focusMode && selectedVisibleInMode ? getSelectionLocationId(scene, selected) : null;
  const stageViewBox = getStageViewBox(scene, focusMode ? focusRect : null, stageZoom);
  const selectedMeta = selectedVisibleInMode ? describeSelection(scene, selected) : null;
  const terrainPreviewGrid = buildTerrainPreviewGrid(scene);
  const surfacePreviewGrid = buildSurfacePreviewGrid(scene);
  const previewDepth = getScenePreviewDepth(canvasMode);
  const scenePreviewActive = terrainDisplayMode === "render";
  const sceneDebugOverlayVisible =
    !scenePreviewActive ||
    (canvasMode === "ground" && groundToolMode === "select") ||
    (canvasMode === "roads" && roadToolMode === "select");
  const showSurfaceZoneOverlays =
    visibleGroups.surfaceZones &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "roads"));
  const showWaterOverlays =
    visibleGroups.water &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "ground"));
  const showFringeOverlays =
    visibleGroups.fringe &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "ground"));
  const showLandmarkOverlays =
    visibleGroups.landmarks &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "buildings"));
  const showModuleOverlays =
    visibleGroups.modules &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "buildings"));
  const showPropOverlays =
    visibleGroups.props &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "details"));
  const showLabelOverlays =
    visibleGroups.labels &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "details"));
  const showAnchorOverlays =
    visibleGroups.anchors &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "details"));
  const warnings = collectVisualSceneWarnings(scene);
  const visibleWarnings = warnings.slice(0, 3);
  const landmarkSelections = scene.landmarks.map((landmark, index) => ({
    label: landmark.locationId,
    selection: { kind: "landmark", index } as BuilderSelection,
    subtitle: landmark.style.replaceAll("-", " "),
  }));
  const roadSelections = scene.surfaceZones
    .map((zone, index) => ({ index, zone }))
    .filter(({ zone }) => ROAD_SURFACE_KINDS.has(zone.kind))
    .map(({ index, zone }) => ({
      label: SURFACE_KIND_LABELS[zone.kind],
      selection: { kind: "surfaceZone", index } as BuilderSelection,
      subtitle: zone.id,
    }));
  const groundSelections = [
    ...scene.surfaceZones
      .map((zone, index) => ({ index, zone }))
      .filter(({ zone }) => GROUND_SURFACE_KINDS.has(zone.kind))
      .map(({ index, zone }) => ({
        label: SURFACE_KIND_LABELS[zone.kind],
        selection: { kind: "surfaceZone", index } as BuilderSelection,
        subtitle: zone.id,
      })),
    ...scene.fringeZones.map((zone, index) => ({
      label: zone.kind.replaceAll("_", " "),
      selection: { kind: "fringeZone", index } as BuilderSelection,
      subtitle: `${zone.edge} edge`,
    })),
    ...scene.waterRegions.map((region, index) => ({
      label: region.tag.replaceAll("_", " "),
      selection: { kind: "waterRegion", index } as BuilderSelection,
      subtitle: region.id,
    })),
  ];
  const detailSelections = [
    ...scene.propClusters.map((cluster, index) => ({
      label: cluster.kind.replaceAll("_", " "),
      selection: { kind: "propCluster", index } as BuilderSelection,
      subtitle: cluster.locationId ?? cluster.id,
    })),
    ...scene.props.map((prop, index) => ({
      label: prop.kind,
      selection: { kind: "prop", index } as BuilderSelection,
      subtitle: `prop ${index + 1}`,
    })),
    ...scene.labels.map((label, index) => ({
      label: label.text,
      selection: { kind: "label", index } as BuilderSelection,
      subtitle: label.tone,
    })),
  ];
  const layerItems =
    canvasMode === "buildings"
      ? landmarkSelections
      : canvasMode === "roads"
        ? roadSelections
        : canvasMode === "ground"
          ? groundSelections
          : detailSelections;
  const showLayerItems =
    canvasMode === "ground"
      ? groundToolMode === "select"
      : canvasMode === "roads"
        ? roadToolMode === "select"
        : true;
  const selectedLandmark = selected.kind === "landmark" ? scene.landmarks[selected.index] ?? null : null;
  const selectedSurfaceZone =
    selected.kind === "surfaceZone" ? scene.surfaceZones[selected.index] ?? null : null;
  const selectedFringeZone =
    selected.kind === "fringeZone" ? scene.fringeZones[selected.index] ?? null : null;
  const selectedModule =
    selected.kind === "landmarkModule" ? scene.landmarkModules[selected.index] ?? null : null;
  const selectedCluster =
    selected.kind === "propCluster" ? scene.propClusters[selected.index] ?? null : null;
  const selectedProp = selected.kind === "prop" ? scene.props[selected.index] ?? null : null;
  const selectedWater =
    selected.kind === "waterRegion" ? scene.waterRegions[selected.index] ?? null : null;
  const selectedLabel = selected.kind === "label" ? scene.labels[selected.index] ?? null : null;
  const bottomDockTitle =
    canvasMode === "ground"
      ? "0. Land + Water Tools"
      : canvasMode === "roads"
        ? "1. Roads + Terrain Tools"
        : canvasMode === "buildings"
          ? "2. Building Tools"
          : "3. Detail Tools";
  const bottomDockCopy =
    canvasMode === "ground"
      ? "Shape the shoreline and landmass first, then build upward."
      : canvasMode === "roads"
        ? "Paint the town surface directly on top of the land layer."
        : canvasMode === "buildings"
          ? "Work on landmark placement and stamp quick kits without losing the canvas."
          : "Use the lower dock for finishing moves while the right rail handles the selected item.";
  const selectedSelections = builderItems
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => item.selection);
  const marqueeRect =
    marqueeState !== null ? normalizeRectFromPoints(marqueeState.start, marqueeState.current) : null;

  function setPrimarySelection(selection: BuilderSelection) {
    setSelected(selection);
    setSelectedIds([selectionId(selection)]);
  }

  function setSelectionGroup(selections: BuilderSelection[]) {
    if (selections.length === 0) {
      setSelectedIds([]);
      return;
    }

    setSelected(selections[0]);
    setSelectedIds(selections.map((selection) => selectionId(selection)));
  }

  function selectionIntersectsRect(selection: BuilderSelection, rect: VisualRect) {
    const selectionRect = getSelectionRect(scene, selection);
    if (selectionRect) {
      return rectsOverlap(selectionRect, rect);
    }

    const selectionPoint = getSelectionPoint(scene, selection);
    return selectionPoint ? pointInsideRect(selectionPoint, rect) : false;
  }

  function canMarqueeSelectCurrentLayer() {
    return (
      canvasMode === "buildings" ||
      canvasMode === "details" ||
      (canvasMode === "ground" && groundToolMode === "select") ||
      (canvasMode === "roads" && roadToolMode === "select")
    );
  }

  function mutateScene(mutator: (draft: VisualScene) => void) {
    setScene((previous) => {
      const draft = cloneScene(previous);
      mutator(draft);
      return draft;
    });
  }

  function scenePointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const bounds = svg.getBoundingClientRect();
    const scaleX = stageViewBox.width / bounds.width;
    const scaleY = stageViewBox.height / bounds.height;
    return {
      x: stageViewBox.x + (clientX - bounds.left) * scaleX,
      y: stageViewBox.y + (clientY - bounds.top) * scaleY,
    };
  }

  function snap(value: number) {
    return snapToGrid ? Math.round(value / 4) * 4 : value;
  }

  function applyCanvasMode(mode: BuilderCanvasMode) {
    setCanvasMode(mode);
    const nextSelection = selectionVisibleInCanvasMode(scene, selected, mode)
      ? selected
      : defaultSelectionForCanvasMode(scene, mode);
    if (nextSelection) {
      setPrimarySelection(nextSelection);
    } else {
      setSelectedIds([]);
      setFocusMode(false);
    }
    if (mode === "buildings") {
      setVisibleGroups({
        anchors: false,
        fringe: false,
        labels: false,
        landmarks: true,
        modules: true,
        props: false,
        surfaceZones: false,
        water: false,
      });
      return;
    }

    if (mode === "roads") {
      setVisibleGroups({
        anchors: false,
        fringe: false,
        labels: false,
        landmarks: false,
        modules: false,
        props: false,
        surfaceZones: true,
        water: false,
      });
      return;
    }

    if (mode === "ground") {
      setVisibleGroups({
        anchors: false,
        fringe: true,
        labels: false,
        landmarks: false,
        modules: false,
        props: false,
        surfaceZones: true,
        water: true,
      });
      return;
    }

    setVisibleGroups({
      anchors: true,
      fringe: false,
      labels: true,
      landmarks: true,
      modules: false,
      props: true,
      surfaceZones: false,
      water: false,
    });
  }

  function adjustStageZoom(delta: number) {
    setStageZoom((previous) => Math.max(0.25, Math.min(2.5, Number((previous + delta).toFixed(2)))));
  }

  function selectForEditing(selection: BuilderSelection, mode?: BuilderCanvasMode) {
    setPrimarySelection(selection);
    if (mode) {
      applyCanvasMode(mode);
    }
  }

  function createFreshTerrain(baseKind: VisualTerrainKind) {
    mutateScene((draft) => {
      draft.surfaceZones = [];
      draft.waterRegions = [];
      draft.fringeZones = [];
      draft.terrainDraft = {
        baseKind,
        cellSize: TERRAIN_CELL_SIZE,
        overrides: [],
      };
    });
    setCanvasMode("ground");
    setGroundToolMode("brush");
    setTerrainBrushKind(baseKind === "land" ? "water" : "land");
    setFocusMode(false);
  }

  function createFreshSurface(baseKind: VisualSurfaceMaterialKind) {
    mutateScene((draft) => {
      draft.surfaceDraft = {
        baseKind,
        cellSize: SURFACE_DRAFT_CELL_SIZE,
        overrides: [],
      };
    });
    setCanvasMode("roads");
    setRoadToolMode("brush");
    setSurfaceBrushKind(baseKind);
    setFocusMode(false);
  }

  function paintTerrainAtPoint(point: VisualPoint) {
    mutateScene((draft) => {
      if (!draft.terrainDraft) {
        return;
      }

      const terrain = draft.terrainDraft;
      const cellSize = terrain.cellSize;
      const maxCol = Math.max(0, Math.ceil(draft.width / cellSize) - 1);
      const maxRow = Math.max(0, Math.ceil(draft.height / cellSize) - 1);
      const centerCol = clamp(Math.floor(point.x / cellSize), 0, maxCol);
      const centerRow = clamp(Math.floor(point.y / cellSize), 0, maxRow);
      const radius = Math.max(0, terrainBrushSize - 1);
      const nextOverrides = new Map(
        terrain.overrides.map((cell) => [terrainCellKey(cell.col, cell.row), cell]),
      );

      for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
        for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
          if (row < 0 || col < 0 || row > maxRow || col > maxCol) {
            continue;
          }

          const key = terrainCellKey(col, row);
          if (terrainBrushKind === terrain.baseKind) {
            nextOverrides.delete(key);
          } else {
            nextOverrides.set(key, { col, kind: terrainBrushKind, row });
          }
        }
      }

      terrain.overrides = Array.from(nextOverrides.values()).sort((left, right) =>
        left.row === right.row ? left.col - right.col : left.row - right.row,
      );
    });
  }

  function startTerrainPaint(pointerId: number, point: VisualPoint) {
    paintTerrainAtPoint(point);
    setPaintState({ layer: "terrain", pointerId });
  }

  function paintSurfaceAtPoint(point: VisualPoint) {
    mutateScene((draft) => {
      if (!draft.surfaceDraft) {
        return;
      }

      const surface = draft.surfaceDraft;
      const cellSize = surface.cellSize;
      const maxCol = Math.max(0, Math.ceil(draft.width / cellSize) - 1);
      const maxRow = Math.max(0, Math.ceil(draft.height / cellSize) - 1);
      const centerCol = clamp(Math.floor(point.x / cellSize), 0, maxCol);
      const centerRow = clamp(Math.floor(point.y / cellSize), 0, maxRow);
      const radius = Math.max(0, surfaceBrushSize - 1);
      const nextOverrides = new Map(
        surface.overrides.map((cell) => [terrainCellKey(cell.col, cell.row), cell]),
      );

      for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
        for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
          if (row < 0 || col < 0 || row > maxRow || col > maxCol) {
            continue;
          }
          if (!surfaceCellAllowed(draft, cellSize, col, row)) {
            continue;
          }

          const key = terrainCellKey(col, row);
          if (surfaceBrushKind === surface.baseKind) {
            nextOverrides.delete(key);
          } else {
            nextOverrides.set(key, { col, kind: surfaceBrushKind, row });
          }
        }
      }

      surface.overrides = Array.from(nextOverrides.values()).sort((left, right) =>
        left.row === right.row ? left.col - right.col : left.row - right.row,
      );
    });
  }

  function startSurfacePaint(pointerId: number, point: VisualPoint) {
    paintSurfaceAtPoint(point);
    setPaintState({ layer: "surface", pointerId });
  }

  function surfaceZoneVisibleInCanvasMode(kind: VisualSurfaceZoneKind) {
    if (canvasMode === "roads") {
      return ROAD_SURFACE_KINDS.has(kind);
    }

    if (canvasMode === "ground") {
      return GROUND_SURFACE_KINDS.has(kind);
    }

    return canvasMode === "details" || canvasMode === "buildings";
  }

  function handleItemPointerDown(
    event: ReactPointerEvent<SVGElement>,
    selection: BuilderSelection,
  ) {
    event.stopPropagation();
    const point = scenePointFromClient(event.clientX, event.clientY);
    if (
      canvasMode === "roads" &&
      roadToolMode === "brush" &&
      scene.surfaceDraft
    ) {
      startSurfacePaint(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (
      canvasMode === "ground" &&
      groundToolMode === "brush" &&
      scene.terrainDraft
    ) {
      startTerrainPaint(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const selectionKey = selectionId(selection);
    const selectionsToDrag =
      selectedIds.includes(selectionKey) && selectedSelections.length > 0
        ? selectedSelections.filter((item) => selectionVisibleInCanvasMode(scene, item, canvasMode))
        : [selection];

    if (selectedIds.includes(selectionKey)) {
      setSelected(selection);
    } else {
      setPrimarySelection(selection);
    }

    setDragState({
      origins: selectionsToDrag
        .map((item) => {
          const itemRect = getSelectionRect(scene, item);
          const itemPoint = getSelectionPoint(scene, item);
          const origin = itemRect ? { ...itemRect } : itemPoint ? { ...itemPoint } : null;
          return origin ? { origin, selection: item } : null;
        })
        .filter((item): item is { origin: VisualPoint | VisualRect; selection: BuilderSelection } => item !== null),
      pointerId: event.pointerId,
      start: point,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStagePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (
      canvasMode === "roads" &&
      roadToolMode === "brush" &&
      scene.surfaceDraft
    ) {
      const point = scenePointFromClient(event.clientX, event.clientY);
      startSurfacePaint(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (
      canvasMode !== "ground" ||
      groundToolMode !== "brush" ||
      !scene.terrainDraft
    ) {
      if (!canMarqueeSelectCurrentLayer()) {
        return;
      }

      const point = scenePointFromClient(event.clientX, event.clientY);
      setMarqueeState({
        current: point,
        pointerId: event.pointerId,
        start: point,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const point = scenePointFromClient(event.clientX, event.clientY);
    startTerrainPaint(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStagePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (paintState && paintState.pointerId === event.pointerId) {
      const point = scenePointFromClient(event.clientX, event.clientY);
      if (paintState.layer === "terrain") {
        paintTerrainAtPoint(point);
      } else {
        paintSurfaceAtPoint(point);
      }
      return;
    }

    if (marqueeState && marqueeState.pointerId === event.pointerId) {
      const point = scenePointFromClient(event.clientX, event.clientY);
      setMarqueeState((previous) =>
        previous ? { ...previous, current: point } : previous,
      );
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const point = scenePointFromClient(event.clientX, event.clientY);
    const deltaX = point.x - dragState.start.x;
    const deltaY = point.y - dragState.start.y;

    mutateScene((draft) => {
      for (const item of dragState.origins) {
        const origin = item.origin;
        updateSelectionPosition(
          draft,
          item.selection,
          snap(origin.x + deltaX),
          snap(origin.y + deltaY),
        );
      }
    });
  }

  function endDrag(event?: ReactPointerEvent<SVGSVGElement>) {
    if (paintState && event && paintState.pointerId === event.pointerId) {
      svgRef.current?.releasePointerCapture(event.pointerId);
    }
    if (dragState && event && dragState.pointerId === event.pointerId) {
      svgRef.current?.releasePointerCapture(event.pointerId);
    }
    if (marqueeState && event && marqueeState.pointerId === event.pointerId) {
      svgRef.current?.releasePointerCapture(event.pointerId);
      const rect = normalizeRectFromPoints(marqueeState.start, marqueeState.current);
      if (rect.width > 6 || rect.height > 6) {
        const nextSelections = selectionsForCanvasMode(scene, canvasMode).filter((selection) =>
          selectionIntersectsRect(selection, rect),
        );
        if (nextSelections.length > 0) {
          setSelectionGroup(nextSelections);
        }
      }
    }
    setPaintState(null);
    setDragState(null);
    setMarqueeState(null);
  }

  function updateNumericField(field: keyof VisualRect | "x" | "y", value: string) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return;
    }

    mutateScene((draft) => {
      if (field === "x" || field === "y") {
        const point = getSelectionPoint(draft, selected);
        if (point) {
          updateSelectionPosition(
            draft,
            selected,
            field === "x" ? numeric : point.x,
            field === "y" ? numeric : point.y,
          );
          return;
        }

        const rect = getSelectionRect(draft, selected);
        if (rect) {
          updateSelectionPosition(
            draft,
            selected,
            field === "x" ? numeric : rect.x,
            field === "y" ? numeric : rect.y,
          );
        }
        return;
      }

      updateSelectionRectField(draft, selected, field, numeric);
    });
  }

  function updateStringField(field: string, value: string) {
    mutateScene((draft) => {
      switch (selected.kind) {
        case "landmark": {
          const item = draft.landmarks[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "locationId") item.locationId = value;
          if (field === "style") item.style = value as VisualSceneLandmarkStyle;
          return;
        }
        case "surfaceZone": {
          const item = draft.surfaceZones[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "kind") item.kind = value as VisualSurfaceZoneKind;
          if (field === "emphasis") item.emphasis = value as "low" | "medium" | "high";
          return;
        }
        case "fringeZone": {
          const item = draft.fringeZones[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "kind") item.kind = value as VisualFringeZoneKind;
          if (field === "edge") item.edge = value as VisualFringeZoneEdge;
          return;
        }
        case "landmarkModule": {
          const item = draft.landmarkModules[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "kind") item.kind = value as VisualLandmarkModuleKind;
          if (field === "locationId") item.locationId = value;
          if (field === "variant") item.variant = value;
          if (field === "text") item.text = value;
          return;
        }
        case "propCluster": {
          const item = draft.propClusters[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "kind") item.kind = value as VisualPropClusterKind;
          if (field === "locationId") item.locationId = value;
          return;
        }
        case "prop": {
          const item = draft.props[selected.index];
          if (!item) {
            return;
          }
          if (field === "kind") {
            draft.props[selected.index] = {
              ...item,
              kind: value as VisualScene["props"][number]["kind"],
            } as VisualScene["props"][number];
          }
          if (item.kind === "boat" && field === "waterRegionId") {
            item.waterRegionId = value;
          }
          return;
        }
        case "waterRegion": {
          const item = draft.waterRegions[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "tag") item.tag = value as VisualSceneWaterTag;
          return;
        }
        case "label": {
          const item = draft.labels[selected.index];
          if (!item) {
            return;
          }
          if (field === "text") item.text = value;
          if (field === "tone") item.tone = value as (typeof LABEL_TONES)[number];
          return;
        }
        default:
          return;
      }
    });
  }

  function updateExtendedNumberField(field: string, value: string) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return;
    }

    mutateScene((draft) => {
      switch (selected.kind) {
        case "landmarkModule": {
          const item = draft.landmarkModules[selected.index];
          if (item && field === "count") {
            item.count = numeric || undefined;
          }
          return;
        }
        case "prop": {
          const item = draft.props[selected.index];
          if (!item) {
            return;
          }
          if (field === "scale") item.scale = numeric;
          if (field === "rotation" && "rotation" in item) item.rotation = numeric;
          if (item.kind === "boat" && field === "bobAmount") item.bobAmount = numeric;
          return;
        }
        case "waterRegion": {
          const item = draft.waterRegions[selected.index];
          if (!item) {
            return;
          }
          if (field === "intensity") item.intensity = numeric;
          return;
        }
        default:
          return;
      }
    });
  }

  function updateColorField(field: "accentColor" | "baseColor" | "crestColor", value: string) {
    const parsed = parseColorHex(value);
    if (parsed === null) {
      return;
    }

    mutateScene((draft) => {
      if (selected.kind === "landmark" && field === "accentColor") {
        const item = draft.landmarks[selected.index];
        if (item) {
          item.accentColor = parsed;
        }
        return;
      }

      if (selected.kind === "waterRegion") {
        const item = draft.waterRegions[selected.index];
        if (!item) {
          return;
        }
        if (field === "baseColor") item.baseColor = parsed;
        if (field === "crestColor") item.crestColor = parsed;
      }
    });
  }

  function normalizeImportedSceneText(value: string) {
    if (importMode === "json") {
      return value;
    }

    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Module import must contain a scene object literal.");
    }
    return value.slice(start, end + 1);
  }

  async function copyExport() {
    const text = buildExportText(scene);
    await navigator.clipboard.writeText(text);
    setCopiedLabel("Scene snapshot copied");
    window.setTimeout(() => setCopiedLabel(null), 1400);
  }

  function applySceneToGame() {
    const didApply = saveVisualSceneRuntimeOverride(scene);
    setGameApplyLabel(
      didApply ? "Applied to local game" : "Could not apply to local game",
    );
    window.setTimeout(() => setGameApplyLabel(null), 1600);
  }

  function clearSceneFromGame() {
    const didClear = clearVisualSceneRuntimeOverride(scene.id);
    setGameApplyLabel(
      didClear ? "Game override cleared" : "Could not clear game override",
    );
    window.setTimeout(() => setGameApplyLabel(null), 1600);
  }

  function resetSceneToFile() {
    setScene(cloneScene(baseScene!));
    setPersistenceStatus("Reset to file scene");
  }

  async function copyModuleExport() {
    const text = buildModuleExportText(scene);
    await navigator.clipboard.writeText(text);
    setModuleCopiedLabel("Module source copied");
    window.setTimeout(() => setModuleCopiedLabel(null), 1400);
  }

  function applyImportedScene() {
    try {
      const parsed = parseVisualSceneDocument(
        normalizeImportedSceneText(importText),
        baseScene!,
      );
      setScene(parsed);
      setPrimarySelection({ kind: "landmark", index: 0 });
      setImportStatus("Imported scene snapshot");
      setPersistenceStatus("Imported scene and saved locally");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  function applyPreset(preset: BuilderPresetKind) {
    mutateScene((draft) => {
      applyPresetToScene(draft, preset, selected);
    });
  }

  function duplicateSelected() {
    mutateScene((draft) => {
      switch (selected.kind) {
        case "surfaceZone": {
          const source = draft.surfaceZones[selected.index];
          if (!source) {
            return;
          }
          draft.surfaceZones.push({
            ...source,
            id: `${source.id}-copy-${draft.surfaceZones.length + 1}`,
            rect: { ...source.rect, x: source.rect.x + 28, y: source.rect.y + 28 },
          });
          setPrimarySelection({ kind: "surfaceZone", index: draft.surfaceZones.length - 1 });
          return;
        }
        case "fringeZone": {
          const source = draft.fringeZones[selected.index];
          if (!source) {
            return;
          }
          draft.fringeZones.push({
            ...source,
            id: `${source.id}-copy-${draft.fringeZones.length + 1}`,
            rect: { ...source.rect, x: source.rect.x + 28, y: source.rect.y + 28 },
          });
          setPrimarySelection({ kind: "fringeZone", index: draft.fringeZones.length - 1 });
          return;
        }
        case "landmarkModule": {
          const source = draft.landmarkModules[selected.index];
          if (!source) {
            return;
          }
          draft.landmarkModules.push({
            ...source,
            id: `${source.id}-copy-${draft.landmarkModules.length + 1}`,
            rect: { ...source.rect, x: source.rect.x + 18, y: source.rect.y + 18 },
          });
          setPrimarySelection({ kind: "landmarkModule", index: draft.landmarkModules.length - 1 });
          return;
        }
        case "propCluster": {
          const source = draft.propClusters[selected.index];
          if (!source) {
            return;
          }
          draft.propClusters.push({
            ...source,
            id: `${source.id}-copy-${draft.propClusters.length + 1}`,
            points: source.points?.map((point) => ({ x: point.x + 24, y: point.y + 24 })),
            rect: { ...source.rect, x: source.rect.x + 24, y: source.rect.y + 24 },
          });
          setPrimarySelection({ kind: "propCluster", index: draft.propClusters.length - 1 });
          return;
        }
        case "prop": {
          const source = draft.props[selected.index];
          if (!source) {
            return;
          }
          draft.props.push({ ...source, x: source.x + 22, y: source.y + 22 });
          setPrimarySelection({ kind: "prop", index: draft.props.length - 1 });
          return;
        }
        case "waterRegion": {
          const source = draft.waterRegions[selected.index];
          if (!source) {
            return;
          }
          draft.waterRegions.push({
            ...source,
            id: `${source.id}-copy-${draft.waterRegions.length + 1}`,
            rect: { ...source.rect, x: source.rect.x + 28, y: source.rect.y + 28 },
          });
          setPrimarySelection({ kind: "waterRegion", index: draft.waterRegions.length - 1 });
          return;
        }
        case "label": {
          const source = draft.labels[selected.index];
          if (!source) {
            return;
          }
          draft.labels.push({ ...source, x: source.x + 22, y: source.y + 22 });
          setPrimarySelection({ kind: "label", index: draft.labels.length - 1 });
          return;
        }
        default:
          return;
      }
    });
  }

  function nextSelectionAfterDelete(
    draft: VisualScene,
    previous: BuilderSelection,
  ): BuilderSelection {
    switch (previous.kind) {
      case "landmark":
        if (draft.landmarks.length > 0) {
          return { kind: "landmark", index: Math.max(0, Math.min(previous.index, draft.landmarks.length - 1)) };
        }
        break;
      case "surfaceZone":
        if (draft.surfaceZones.length > 0) {
          return {
            kind: "surfaceZone",
            index: Math.max(0, Math.min(previous.index, draft.surfaceZones.length - 1)),
          };
        }
        break;
      case "fringeZone":
        if (draft.fringeZones.length > 0) {
          return {
            kind: "fringeZone",
            index: Math.max(0, Math.min(previous.index, draft.fringeZones.length - 1)),
          };
        }
        break;
      case "landmarkModule":
        if (draft.landmarkModules.length > 0) {
          return {
            kind: "landmarkModule",
            index: Math.max(0, Math.min(previous.index, draft.landmarkModules.length - 1)),
          };
        }
        break;
      case "propCluster":
        if (draft.propClusters.length > 0) {
          return {
            kind: "propCluster",
            index: Math.max(0, Math.min(previous.index, draft.propClusters.length - 1)),
          };
        }
        break;
      case "prop":
        if (draft.props.length > 0) {
          return { kind: "prop", index: Math.max(0, Math.min(previous.index, draft.props.length - 1)) };
        }
        break;
      case "waterRegion":
        if (draft.waterRegions.length > 0) {
          return {
            kind: "waterRegion",
            index: Math.max(0, Math.min(previous.index, draft.waterRegions.length - 1)),
          };
        }
        break;
      case "label":
        if (draft.labels.length > 0) {
          return { kind: "label", index: Math.max(0, Math.min(previous.index, draft.labels.length - 1)) };
        }
        break;
      default:
        break;
    }

    return draft.landmarks.length > 0 ? { kind: "landmark", index: 0 } : { kind: "playerSpawn" };
  }

  function deleteSelected() {
    const selectionsToDelete = (selectedSelections.length > 0 ? selectedSelections : [selected]).filter(
      (selection) => selectionVisibleInCanvasMode(scene, selection, canvasMode),
    );

    if (selectionsToDelete.length === 0) {
      return;
    }

    mutateScene((draft) => {
      const groupedSelections = new Map<BuilderSelection["kind"], BuilderSelection[]>();
      for (const selection of selectionsToDelete) {
        const bucket = groupedSelections.get(selection.kind) ?? [];
        bucket.push(selection);
        groupedSelections.set(selection.kind, bucket);
      }

      const indexesForKind = (kind: BuilderSelection["kind"]) =>
        (groupedSelections.get(kind) ?? [])
          .flatMap((selection) => ("index" in selection ? [selection.index] : []))
          .sort((left, right) => right - left);

      indexesForKind("landmark").forEach((index) => {
        draft.landmarks.splice(index, 1);
      });
      indexesForKind("surfaceZone").forEach((index) => {
        draft.surfaceZones.splice(index, 1);
      });
      indexesForKind("fringeZone").forEach((index) => {
        draft.fringeZones.splice(index, 1);
      });
      indexesForKind("landmarkModule").forEach((index) => {
        draft.landmarkModules.splice(index, 1);
      });
      indexesForKind("propCluster").forEach((index) => {
        draft.propClusters.splice(index, 1);
      });
      indexesForKind("prop").forEach((index) => {
        draft.props.splice(index, 1);
      });
      indexesForKind("waterRegion").forEach((index) => {
        draft.waterRegions.splice(index, 1);
      });
      indexesForKind("label").forEach((index) => {
        draft.labels.splice(index, 1);
      });

      const nextSelection =
        defaultSelectionForCanvasMode(draft, canvasMode) ??
        nextSelectionAfterDelete(draft, selected);
      setPrimarySelection(nextSelection);
    });
  }

  function addPrimitive(type: "surface" | "fringe" | "module" | "cluster" | "prop" | "water" | "label") {
    mutateScene((draft) => {
      const rect = createDefaultRect(draft);
      const point = createDefaultPoint(draft);

      if (type === "surface") {
        draft.surfaceZones.push({
          emphasis: "medium",
          id: `builder-surface-${draft.surfaceZones.length + 1}`,
          kind: addState.surfaceKind,
          rect,
        });
        setPrimarySelection({ kind: "surfaceZone", index: draft.surfaceZones.length - 1 });
        return;
      }

      if (type === "fringe") {
        draft.fringeZones.push({
          edge: addState.fringeEdge,
          id: `builder-fringe-${draft.fringeZones.length + 1}`,
          kind: addState.fringeKind,
          rect,
        });
        setPrimarySelection({ kind: "fringeZone", index: draft.fringeZones.length - 1 });
        return;
      }

      if (type === "module") {
        draft.landmarkModules.push({
          id: `builder-module-${draft.landmarkModules.length + 1}`,
          kind: addState.moduleKind,
          locationId: draft.landmarks[0]?.locationId ?? "tea-house",
          rect: { ...rect, width: 180, height: 68 },
          variant: "",
        });
        setPrimarySelection({ kind: "landmarkModule", index: draft.landmarkModules.length - 1 });
        return;
      }

      if (type === "cluster") {
        draft.propClusters.push({
          id: `builder-cluster-${draft.propClusters.length + 1}`,
          kind: addState.propClusterKind,
          locationId: draft.landmarks[0]?.locationId,
          points: [
            { x: point.x - 36, y: point.y },
            { x: point.x + 36, y: point.y },
          ],
          rect,
        });
        setPrimarySelection({ kind: "propCluster", index: draft.propClusters.length - 1 });
        return;
      }

      if (type === "prop") {
        if (addState.propKind === "boat") {
          draft.props.push({
            bobAmount: 4,
            kind: "boat",
            rotation: 0,
            scale: 1,
            waterRegionId: draft.waterRegions[0]?.id ?? "harbor-main-v2",
            x: point.x,
            y: point.y,
          });
        } else if (addState.propKind === "lamp") {
          draft.props.push({ kind: "lamp", scale: 1, x: point.x, y: point.y });
        } else {
          draft.props.push({ kind: addState.propKind, x: point.x, y: point.y });
        }
        setPrimarySelection({ kind: "prop", index: draft.props.length - 1 });
        return;
      }

      if (type === "water") {
        draft.waterRegions.push({
          baseColor: 0x2a6c8a,
          crestColor: 0xd8f7ff,
          id: `builder-water-${draft.waterRegions.length + 1}`,
          intensity: 0.8,
          rect,
          tag: addState.waterTag,
        });
        setPrimarySelection({ kind: "waterRegion", index: draft.waterRegions.length - 1 });
        return;
      }

      if (type === "label") {
        draft.labels.push({
          text: "New Label",
          tone: "landmark",
          x: point.x,
          y: point.y,
        });
        setPrimarySelection({ kind: "label", index: draft.labels.length - 1 });
      }
    });
  }

  function renderRect(
    selection: BuilderSelection,
    rect: VisualRect,
    color: string,
    label?: string,
  ) {
    const id = selectionId(selection);
    const active = selectionId(selected) === id;
    const groupSelected = selectedIds.includes(id);
    const relatedLocationId = getSelectionLocationId(scene, selection);
    const related =
      !active && !groupSelected && focusLocationId !== null && relatedLocationId === focusLocationId;
    const structural =
      selection.kind === "surfaceZone" ||
      selection.kind === "fringeZone" ||
      selection.kind === "waterRegion" ||
      selection.kind === "propCluster" ||
      selection.kind === "locationAnchorHighlight";
    const fillOpacity = active
      ? 0.2
      : groupSelected
        ? structural
          ? 0.12
          : 0.14
        : related
          ? structural
            ? 0.08
            : 0.1
          : structural
            ? 0.03
            : 0.05;
    const strokeOpacity = active ? 0.96 : groupSelected ? 0.72 : related ? 0.42 : 0.18;
    const strokeWidth = active ? 3 : groupSelected ? 2.4 : related ? 2 : 1.5;
    const labelVisible = active;
    const labelWidth = label ? Math.max(96, label.length * 9 + 18) : 0;
    return (
      <g key={id}>
        <rect
          className="builder-hit"
          fill={color}
          fillOpacity={fillOpacity}
          height={rect.height}
          onPointerDown={(event) => handleItemPointerDown(event, selection)}
          rx={rect.radius ?? 10}
          ry={rect.radius ?? 10}
          stroke={active ? "#f4d08e" : groupSelected ? "#e6c57b" : color}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        {label && labelVisible ? (
          <>
            <rect
              fill="rgba(10, 16, 20, 0.88)"
              height="24"
              pointerEvents="none"
              rx="10"
              ry="10"
              width={labelWidth}
              x={rect.x + 8}
              y={rect.y + 8}
            />
            <text
              fill="#f6edd8"
              fontFamily="SFMono-Regular, Menlo, monospace"
              fontSize="14"
              pointerEvents="none"
              x={rect.x + 18}
              y={rect.y + 25}
            >
              {label}
            </text>
          </>
        ) : null}
      </g>
    );
  }

  function renderPoint(
    selection: BuilderSelection,
    point: VisualPoint,
    color: string,
    label?: string,
  ) {
    const id = selectionId(selection);
    const active = selectionId(selected) === id;
    const groupSelected = selectedIds.includes(id);
    const relatedLocationId = getSelectionLocationId(scene, selection);
    const related =
      !active && !groupSelected && focusLocationId !== null && relatedLocationId === focusLocationId;
    const labelVisible = active;
    const labelWidth = label ? Math.max(88, label.length * 8 + 16) : 0;
    return (
      <g key={id}>
        <circle
          className="builder-hit"
          cx={point.x}
          cy={point.y}
          fill={active ? "#f4d08e" : groupSelected ? "#e6c57b" : color}
          fillOpacity={active ? 1 : groupSelected ? 0.9 : related ? 0.82 : 0.58}
          onPointerDown={(event) => handleItemPointerDown(event, selection)}
          r={active ? 9 : groupSelected ? 7 : related ? 6 : 5}
          stroke={active ? "#0d161b" : "rgba(12, 18, 22, 0.72)"}
          strokeWidth={active ? 3 : groupSelected ? 2.5 : 2}
        />
        {label && labelVisible ? (
          <>
            <rect
              fill="rgba(10, 16, 20, 0.88)"
              height="22"
              pointerEvents="none"
              rx="10"
              ry="10"
              width={labelWidth}
              x={point.x + 10}
              y={point.y - 24}
            />
            <text
              fill="#f6edd8"
              fontFamily="SFMono-Regular, Menlo, monospace"
              fontSize="13"
              pointerEvents="none"
              x={point.x + 18}
              y={point.y - 9}
            >
              {label}
            </text>
          </>
        ) : null}
      </g>
    );
  }

  function renderBuiltScenePreview(depth: number) {
    const legacySurfaceZonesToRender =
      !surfacePreviewGrid
        ? depth >= 1
          ? scene.surfaceZones
          : []
        : depth >= 2
          ? scene.surfaceZones.filter((zone) => !ROAD_SURFACE_KINDS.has(zone.kind))
          : [];

    return (
      <>
        {terrainPreviewGrid ? (
          renderTerrainPreview(scene, terrainPreviewGrid, previewTimeMs)
        ) : (
          <rect fill="#d7c9a7" height={scene.height} width={scene.width} x="0" y="0" />
        )}
        {depth >= 0 ? scene.fringeZones.map((zone, index) => renderFringeZonePreview(zone, index)) : null}
        {depth >= 1 ? (
          <>
            {surfacePreviewGrid ? renderSurfaceDraftPreview(surfacePreviewGrid) : null}
            {legacySurfaceZonesToRender.map((zone, index) =>
              renderSurfaceZonePreview(zone, index),
            )}
          </>
        ) : null}
        {depth >= 2 ? (
          <>
            {scene.landmarks.map((landmark, index) => renderLandmarkPreview(landmark, index))}
            {scene.landmarkModules.map((module, index) =>
              renderLandmarkModulePreview(module, index),
            )}
          </>
        ) : null}
        {depth >= 3 ? (
          <>
            {scene.propClusters.map((cluster, index) =>
              renderPropClusterPreview(cluster, index),
            )}
            {scene.props.map((prop, index) => renderPropPreview(prop, index))}
            {scene.labels.map((label, index) => (
              <text
                fill={
                  label.tone === "landmark"
                    ? "#324742"
                    : label.tone === "district"
                      ? "rgba(47, 63, 67, 0.72)"
                      : "rgba(70, 76, 79, 0.68)"
                }
                fontFamily="Iowan Old Style, Palatino Linotype, serif"
                fontSize={
                  label.tone === "landmark" ? "24" : label.tone === "district" ? "28" : "18"
                }
                fontWeight={label.tone === "landmark" ? "700" : "600"}
                key={`preview-label-${label.text}-${index}`}
                textAnchor="middle"
                x={label.x}
                y={label.y}
              >
                {label.text}
              </text>
            ))}
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="builder-shell">
      <aside className="builder-panel builder-panel-left">
        <div className="builder-section">
          <div className="builder-kicker">South Quay Builder</div>
          <h1 className="builder-title">Elementary Scene Builder</h1>
          <p className="builder-copy">
            Pick one place, isolate it, stamp a kit, then drag only the nearby pieces until the town reads clearly.
          </p>
        </div>

        <div className="builder-section">
          <div className="builder-section-title">Layers</div>
          <div className="builder-copy">
            Switch the canvas to the kind of thing you want to edit, then pick an item from that layer.
          </div>
          <div className="builder-mode-row">
            <button
              className={canvasMode === "ground" ? "is-active" : ""}
              onClick={() => applyCanvasMode("ground")}
              type="button"
            >
              0. Land + Water
            </button>
            <button
              className={canvasMode === "roads" ? "is-active" : ""}
              onClick={() => applyCanvasMode("roads")}
              type="button"
            >
              1. Roads + Terrain
            </button>
            <button
              className={canvasMode === "buildings" ? "is-active" : ""}
              onClick={() => applyCanvasMode("buildings")}
              type="button"
            >
              2. Buildings
            </button>
            <button
              className={canvasMode === "details" ? "is-active" : ""}
              onClick={() => applyCanvasMode("details")}
              type="button"
            >
              3. Additional Details
            </button>
          </div>
          <div className="builder-copy">
            {canvasMode === "buildings"
              ? "View the first two layers plus building masses and frontage."
              : canvasMode === "roads"
                ? "View land/water first, then paint roads, paving, grass, bushes, and trees on top."
                : canvasMode === "ground"
                  ? "Start with the base map: land, shoreline, quay edges, and water bands."
                  : "View the full stack with furniture, labels, anchors, and other finishing details."}
          </div>
          <div className="builder-copy">
            The edit controls for this layer live in the tool dock below the canvas so the stage stays central while you work.
          </div>
          <div className="builder-area-list">
            {showLayerItems &&
            layerItems.map((item) => (
              <button
                className={`builder-list-item ${
                  selectionId(selected) === selectionId(item.selection) ? "is-active" : ""
                }`}
                key={selectionId(item.selection)}
                onClick={() => {
                  selectForEditing(item.selection, canvasMode);
                  setFocusMode(true);
                }}
                type="button"
              >
                <div className="builder-list-title">{item.label}</div>
                <div className="builder-list-subtitle">{item.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        <details className="builder-section builder-details">
          <summary className="builder-details-summary">
            <div>
              <div className="builder-section-title">Advanced Authoring</div>
              <div className="builder-list-subtitle">Raw layers, primitives, and full scene inventory.</div>
            </div>
            <span className="builder-details-badge">Open</span>
          </summary>
          <div className="builder-details-body">
            <div className="builder-subsection">
              <div className="builder-section-title">Layers</div>
              {(
                [
                  ["surfaceZones", "Surface zones"],
                  ["water", "Water"],
                  ["fringe", "Fringe"],
                  ["landmarks", "Landmarks"],
                  ["modules", "Modules"],
                  ["props", "Props + clusters"],
                  ["labels", "Labels"],
                  ["anchors", "Anchors"],
                ] as const
              ).map(([key, label]) => (
                <label className="builder-toggle" key={key}>
                  <input
                    checked={visibleGroups[key]}
                    onChange={(event) =>
                      setVisibleGroups((previous) => ({
                        ...previous,
                        [key]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="builder-subsection">
              <div className="builder-section-title">Add Raw Items</div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      surfaceKind: event.target.value as VisualSurfaceZoneKind,
                    }))
                  }
                  value={addState.surfaceKind}
                >
                  {SURFACE_ZONE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("surface")} type="button">
                  Add Surface
                </button>
              </div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      fringeKind: event.target.value as VisualFringeZoneKind,
                    }))
                  }
                  value={addState.fringeKind}
                >
                  {FRINGE_ZONE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      fringeEdge: event.target.value as VisualFringeZoneEdge,
                    }))
                  }
                  value={addState.fringeEdge}
                >
                  {FRINGE_EDGES.map((edge) => (
                    <option key={edge} value={edge}>
                      {edge}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("fringe")} type="button">
                  Add Fringe
                </button>
              </div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      moduleKind: event.target.value as VisualLandmarkModuleKind,
                    }))
                  }
                  value={addState.moduleKind}
                >
                  {LANDMARK_MODULE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("module")} type="button">
                  Add Module
                </button>
              </div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      propClusterKind: event.target.value as VisualPropClusterKind,
                    }))
                  }
                  value={addState.propClusterKind}
                >
                  {PROP_CLUSTER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("cluster")} type="button">
                  Add Cluster
                </button>
              </div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      propKind: event.target.value as (typeof PROP_KINDS)[number],
                    }))
                  }
                  value={addState.propKind}
                >
                  {PROP_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("prop")} type="button">
                  Add Prop
                </button>
              </div>
              <div className="builder-palette-row">
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      waterTag: event.target.value as VisualSceneWaterTag,
                    }))
                  }
                  value={addState.waterTag}
                >
                  {WATER_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("water")} type="button">
                  Add Water
                </button>
              </div>
              <div className="builder-palette-row">
                <button onClick={() => addPrimitive("label")} type="button">
                  Add Label
                </button>
              </div>
            </div>

            <div className="builder-subsection builder-list-section">
              <div className="builder-section-title">Scene Inventory</div>
              <div className="builder-list">
                {builderItems.map((item) => (
                  <button
                    className={`builder-list-item ${selectionId(selected) === item.id ? "is-active" : ""}`}
                    key={item.id}
                    onClick={() => setPrimarySelection(item.selection)}
                    type="button"
                  >
                    <div className="builder-list-section-label">{item.section}</div>
                    <div className="builder-list-title">{item.label}</div>
                    <div className="builder-list-subtitle">{item.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>
      </aside>

      <main className="builder-stage-shell">
        <div className="builder-stage-header">
          <div>
            <div className="builder-kicker">Scene</div>
            <div className="builder-stage-title">{scene.id}</div>
            {persistenceStatus ? (
              <div className="builder-stage-status">{persistenceStatus}</div>
            ) : null}
          </div>
          <div className="builder-stage-actions">
            <button
              className={terrainDisplayMode === "render" ? "is-active" : ""}
              onClick={() => setTerrainDisplayMode("render")}
              type="button"
            >
              Scene Preview
            </button>
            <button
              className={terrainDisplayMode === "mask" ? "is-active" : ""}
              onClick={() => setTerrainDisplayMode("mask")}
              type="button"
            >
              Edit Layer
            </button>
            <button onClick={applySceneToGame} type="button">
              {gameApplyLabel ?? "Apply To Game"}
            </button>
            <button onClick={clearSceneFromGame} type="button">
              Clear Game Override
            </button>
            <button onClick={resetSceneToFile} type="button">
              Reset To File
            </button>
            <button onClick={copyExport} type="button">
              Copy Snapshot
            </button>
          </div>
        </div>
        <div className="builder-stage-card">
          <svg
            className="builder-stage"
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={endDrag}
            ref={svgRef}
            viewBox={`${stageViewBox.x} ${stageViewBox.y} ${stageViewBox.width} ${stageViewBox.height}`}
          >
            <rect fill="#0f181d" height={scene.height} width={scene.width} x="0" y="0" />
            {scenePreviewActive ? (
              <>
                {renderBuiltScenePreview(previewDepth)}
                {renderSelectionPreviewHighlight(selectedMeta)}
              </>
            ) : canvasMode === "roads" && scene.surfaceDraft ? (
              <>
                {terrainPreviewGrid ? (
                  renderTerrainPreview(scene, terrainPreviewGrid, previewTimeMs)
                ) : (
                  <rect fill="#d7c9a7" height={scene.height} width={scene.width} x="0" y="0" />
                )}
                {surfacePreviewGrid ? renderSurfaceDraftPreview(surfacePreviewGrid) : null}
              </>
            ) : canvasMode === "ground" && scene.terrainDraft ? (
              <>
                <rect
                  fill={terrainColor(scene.terrainDraft.baseKind, "base")}
                  height={scene.height}
                  width={scene.width}
                  x="0"
                  y="0"
                />
                {scene.terrainDraft.overrides.map((cell) => {
                  const rect = terrainCellRect(
                    scene,
                    scene.terrainDraft!.cellSize,
                    cell.col,
                    cell.row,
                  );
                  return (
                    <rect
                      fill={terrainColor(cell.kind, "override")}
                      height={rect.height}
                      key={`terrain-${cell.col}-${cell.row}`}
                      stroke="rgba(13, 19, 23, 0.14)"
                      strokeWidth="1"
                      width={rect.width}
                      x={rect.x}
                      y={rect.y}
                    />
                  );
                })}
              </>
            ) : null}

            {showGrid
              ? scene.projection.columnCenters.map((x, index) => (
                  <line
                    key={`col-${index}`}
                    stroke={scenePreviewActive ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)"}
                    strokeDasharray="6 8"
                    strokeWidth="2"
                    x1={x}
                    x2={x}
                    y1="0"
                    y2={scene.height}
                  />
                ))
              : null}
            {showGrid
              ? scene.projection.rowCenters.map((y, index) => (
                  <line
                    key={`row-${index}`}
                    stroke={scenePreviewActive ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)"}
                    strokeDasharray="6 8"
                    strokeWidth="2"
                    x1="0"
                    x2={scene.width}
                    y1={y}
                    y2={y}
                  />
                ))
              : null}

            {showSurfaceZoneOverlays
              ? scene.surfaceZones.map((zone, index) =>
                  surfaceZoneVisibleInCanvasMode(zone.kind) &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "surfaceZone", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "surfaceZone", index },
                        zone.rect,
                        "#70878f",
                        zone.kind,
                      )
                    : null,
                )
              : null}

            {showWaterOverlays
              ? scene.waterRegions.map((region, index) =>
                  canvasMode === "ground" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "waterRegion", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "waterRegion", index },
                        region.rect,
                        "#4f7380",
                        region.tag,
                      )
                    : null,
                )
              : null}

            {showFringeOverlays
              ? scene.fringeZones.map((zone, index) =>
                  canvasMode === "ground" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "fringeZone", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "fringeZone", index },
                        zone.rect,
                        "#676578",
                        `${zone.kind} (${zone.edge})`,
                      )
                    : null,
                )
              : null}

            {showLandmarkOverlays
              ? scene.landmarks.map((landmark, index) =>
                  (canvasMode === "buildings" || canvasMode === "details") &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "landmark", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "landmark", index },
                        landmark.rect,
                        "#c6b284",
                        landmark.locationId,
                      )
                    : null,
                )
              : null}

            {showModuleOverlays
              ? scene.landmarkModules.map((module, index) =>
                  (canvasMode === "buildings" || canvasMode === "details") &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "landmarkModule", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "landmarkModule", index },
                        module.rect,
                        "#8d8073",
                        module.kind,
                      )
                    : null,
                )
              : null}

            {showPropOverlays
              ? scene.propClusters.map((cluster, index) =>
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "propCluster", index },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "propCluster", index },
                        cluster.rect,
                        "#748d73",
                        cluster.kind,
                      )
                    : null,
                )
              : null}

            {showPropOverlays
              ? scene.props.map((prop, index) =>
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(scene, { kind: "prop", index }, focusRect, focusLocationId))
                    ? renderPoint(
                        { kind: "prop", index },
                        { x: prop.x, y: prop.y },
                        "#8eb2b3",
                        prop.kind,
                      )
                    : null,
                )
              : null}

            {showLabelOverlays
              ? scene.labels.map((label, index) =>
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(scene, { kind: "label", index }, focusRect, focusLocationId))
                    ? renderPoint(
                        { kind: "label", index },
                        { x: label.x, y: label.y },
                        "#d7c9a0",
                        label.text,
                      )
                    : null,
                )
              : null}

            {showAnchorOverlays
              ? canvasMode === "details" &&
                (!focusMode ||
                  scenePreviewActive ||
                  selectionInFocus(scene, { kind: "playerSpawn" }, focusRect, focusLocationId))
                    ? renderRect(
                        { kind: "playerSpawn" },
                        {
                          x: scene.playerSpawn.x - 12,
                          y: scene.playerSpawn.y - 12,
                          width: 24,
                          height: 24,
                          radius: 12,
                        },
                        "#d6c08d",
                        "",
                      )
                    : null
              : null}

            {showAnchorOverlays
              ? canvasMode === "details" &&
                (!focusMode ||
                  scenePreviewActive ||
                  selectionInFocus(scene, { kind: "playerSpawn" }, focusRect, focusLocationId))
                ? renderPoint(
                    { kind: "playerSpawn" },
                    scene.playerSpawn,
                    "#d6c08d",
                    "spawn",
                  )
                : null
              : null}

            {showAnchorOverlays
              ? Object.entries(scene.npcAnchors).map(([id, point]) =>
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { id, kind: "npcAnchor" },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderPoint({ id, kind: "npcAnchor" }, point, "#c79a75", id)
                    : null,
                )
              : null}

            {showAnchorOverlays
              ? Object.entries(scene.locationAnchors).map(([locationId, anchor]) =>
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "locationAnchorHighlight", locationId },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderRect(
                        { kind: "locationAnchorHighlight", locationId },
                        anchor.highlight,
                        "#ac9c72",
                        `${locationId} highlight`,
                      )
                    : null,
                )
              : null}

            {showAnchorOverlays
              ? Object.entries(scene.locationAnchors).flatMap(([locationId, anchor]) => [
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "locationAnchorPoint", locationId, pointKey: "door" },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "door" },
                        anchor.door,
                        "#c5967e",
                        `${locationId} door`,
                      )
                    : null,
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "locationAnchorPoint", locationId, pointKey: "frontage" },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "frontage" },
                        anchor.frontage,
                        "#8aac90",
                        `${locationId} frontage`,
                      )
                    : null,
                  canvasMode === "details" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(
                      scene,
                      { kind: "locationAnchorPoint", locationId, pointKey: "label" },
                      focusRect,
                      focusLocationId,
                    ))
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "label" },
                        anchor.label,
                        "#a6b6c8",
                        `${locationId} label`,
                      )
                    : null,
                  ...(anchor.npcStands ?? []).map((point, index) =>
                    canvasMode === "details" &&
                    (!focusMode ||
                      scenePreviewActive ||
                      selectionInFocus(
                        scene,
                        {
                          kind: "locationAnchorNpcStand",
                          locationId,
                          index,
                        },
                        focusRect,
                        focusLocationId,
                      ))
                      ? renderPoint(
                          {
                            kind: "locationAnchorNpcStand",
                            locationId,
                            index,
                          },
                          point,
                          "#cbb38a",
                          `${locationId} stand ${index + 1}`,
                        )
                      : null,
                  ),
                ])
              : null}
            {marqueeRect && (marqueeRect.width > 6 || marqueeRect.height > 6) ? (
              <rect
                fill="rgba(244, 208, 142, 0.12)"
                height={marqueeRect.height}
                pointerEvents="none"
                rx="14"
                ry="14"
                stroke="rgba(244, 208, 142, 0.92)"
                strokeDasharray="12 8"
                strokeWidth="3"
                width={marqueeRect.width}
                x={marqueeRect.x}
                y={marqueeRect.y}
              />
            ) : null}
          </svg>
        </div>
        <div className="builder-bottom-dock">
          <div className="builder-bottom-dock-header">
            <div>
              <div className="builder-section-title">{bottomDockTitle}</div>
              <div className="builder-list-subtitle">{bottomDockCopy}</div>
            </div>
            <div className="builder-stage-actions">
              <button onClick={duplicateSelected} type="button">
                Duplicate Selected
              </button>
              <button className="is-danger" onClick={deleteSelected} type="button">
                Delete Selected
              </button>
            </div>
          </div>

          {canvasMode === "ground" ? (
            <div className="builder-bottom-dock-grid">
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Base</div>
                <div className="builder-stage-actions">
                  <button onClick={() => createFreshTerrain("land")} type="button">
                    Fresh Land Base
                  </button>
                  <button onClick={() => createFreshTerrain("water")} type="button">
                    Fresh Water Base
                  </button>
                </div>
              </div>
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Tool</div>
                <div className="builder-stage-actions">
                  <button
                    className={groundToolMode === "brush" ? "is-active" : ""}
                    onClick={() => setGroundToolMode("brush")}
                    type="button"
                  >
                    Brush
                  </button>
                  <button
                    className={groundToolMode === "select" ? "is-active" : ""}
                    onClick={() => setGroundToolMode("select")}
                    type="button"
                  >
                    Select Areas
                  </button>
                </div>
              </div>
              <div className="builder-bottom-dock-group builder-bottom-dock-group-wide">
                <div className="builder-section-title">Paint</div>
                <div className="builder-chip-row">
                  <button
                    className={terrainBrushKind === "land" ? "is-active" : ""}
                    onClick={() => setTerrainBrushKind("land")}
                    type="button"
                  >
                    Paint Land
                  </button>
                  <button
                    className={terrainBrushKind === "water" ? "is-active" : ""}
                    onClick={() => setTerrainBrushKind("water")}
                    type="button"
                  >
                    Paint Water
                  </button>
                </div>
                <label className="builder-range builder-range-inline">
                  <span>Brush size {terrainBrushSize}x{terrainBrushSize}</span>
                  <input
                    max="5"
                    min="1"
                    onChange={(event) => setTerrainBrushSize(Number(event.target.value))}
                    step="1"
                    type="range"
                    value={terrainBrushSize}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {canvasMode === "roads" ? (
            <div className="builder-bottom-dock-grid">
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Base</div>
                <div className="builder-stage-actions">
                  <button onClick={() => createFreshSurface("tiled_stone_road")} type="button">
                    Fresh Stone Base
                  </button>
                  <button onClick={() => createFreshSurface("walkway")} type="button">
                    Fresh Walkway Base
                  </button>
                  <button onClick={() => createFreshSurface("grass")} type="button">
                    Fresh Grass Base
                  </button>
                </div>
              </div>
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Tool</div>
                <div className="builder-stage-actions">
                  <button
                    className={roadToolMode === "brush" ? "is-active" : ""}
                    onClick={() => setRoadToolMode("brush")}
                    type="button"
                  >
                    Brush
                  </button>
                  <button
                    className={roadToolMode === "select" ? "is-active" : ""}
                    onClick={() => setRoadToolMode("select")}
                    type="button"
                  >
                    Select Areas
                  </button>
                </div>
              </div>
              <div className="builder-bottom-dock-group builder-bottom-dock-group-wide">
                <div className="builder-section-title">Materials</div>
                <div className="builder-chip-row">
                  {SURFACE_MATERIAL_KINDS.map((kind) => (
                    <button
                      className={surfaceBrushKind === kind ? "is-active" : ""}
                      key={`dock-surface-${kind}`}
                      onClick={() => setSurfaceBrushKind(kind)}
                      type="button"
                    >
                      {SURFACE_MATERIAL_LABELS[kind]}
                    </button>
                  ))}
                </div>
                <label className="builder-range builder-range-inline">
                  <span>Brush size {surfaceBrushSize}x{surfaceBrushSize}</span>
                  <input
                    max="5"
                    min="1"
                    onChange={(event) => setSurfaceBrushSize(Number(event.target.value))}
                    step="1"
                    type="range"
                    value={surfaceBrushSize}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {canvasMode === "buildings" ? (
            <div className="builder-bottom-dock-grid">
              <div className="builder-bottom-dock-group builder-bottom-dock-group-wide">
                <div className="builder-section-title">Quick Kits</div>
                <div className="builder-chip-row">
                  {PRESET_KINDS.map((preset) => (
                    <button key={`dock-preset-${preset}`} onClick={() => applyPreset(preset)} type="button">
                      {preset.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {canvasMode === "details" ? (
            <div className="builder-bottom-dock-grid">
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Focus</div>
                <div className="builder-chip-row">
                  <button onClick={() => addPrimitive("prop")} type="button">
                    Add Prop
                  </button>
                  <button onClick={() => addPrimitive("cluster")} type="button">
                    Add Cluster
                  </button>
                  <button onClick={() => addPrimitive("label")} type="button">
                    Add Label
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="builder-bottom-dock-grid builder-bottom-dock-grid-secondary">
            <div className="builder-bottom-dock-group">
              <div className="builder-section-title">Canvas</div>
              <label className="builder-toggle">
                <input
                  checked={focusMode}
                  onChange={(event) => setFocusMode(event.target.checked)}
                  type="checkbox"
                />
                <span>Zoom to selection</span>
              </label>
              <label className="builder-toggle">
                <input checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} type="checkbox" />
                <span>Projection grid</span>
              </label>
              <label className="builder-toggle">
                <input
                  checked={snapToGrid}
                  onChange={(event) => setSnapToGrid(event.target.checked)}
                  type="checkbox"
                />
                <span>Snap drag to 4px</span>
              </label>
            </div>

            <div className="builder-bottom-dock-group">
              <div className="builder-section-title">Zoom</div>
              <label className="builder-range builder-range-inline">
                <span>Selection zoom {Math.round(stageZoom * 100)}%</span>
                <input
                  max="2.5"
                  min="0.25"
                  onChange={(event) => setStageZoom(Number(event.target.value))}
                  step="0.01"
                  type="range"
                  value={stageZoom}
                />
              </label>
              <div className="builder-stage-actions">
                <button onClick={() => adjustStageZoom(-0.2)} type="button">
                  Zoom Out
                </button>
                <button onClick={() => setStageZoom(0.72)} type="button">
                  Reset Zoom
                </button>
                <button onClick={() => adjustStageZoom(0.2)} type="button">
                  Zoom In
                </button>
              </div>
            </div>

            <div className="builder-bottom-dock-group builder-bottom-dock-group-wide">
              <div className={`builder-warning ${warnings.length === 0 ? "is-success" : ""}`}>
                <div className="builder-warning-title">
                  {warnings.length === 0
                    ? "scene validation clean"
                    : `${warnings.length} authoring warning${warnings.length === 1 ? "" : "s"}`}
                </div>
                {warnings.length === 0 ? (
                  <div className="builder-list-subtitle">No overlap or coverage issues right now.</div>
                ) : (
                  <div className="builder-warning-list">
                    {visibleWarnings.map((warning, index) => (
                      <div className="builder-list-subtitle" key={`${warning.code}-${index}`}>
                        {warning.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside className="builder-panel builder-panel-right">
        <div className="builder-section">
          <div className="builder-section-title">Selected</div>
          {selectedMeta ? (
            <>
              <div className="builder-copy">
                {focusLocationId
                  ? `Working on ${focusLocationId}. The stage zooms into it, and this preview keeps full-scene context.`
                  : "Refining the selected item."}
              </div>
              {focusRect ? (
                <div className="builder-focus-preview">
                  <svg viewBox={`0 0 ${scene.width} ${scene.height}`}>
                    <rect fill="#0f181d" height={scene.height} width={scene.width} x="0" y="0" />
                    {renderBuiltScenePreview(3)}
                    <rect
                      fill="none"
                      height={focusRect.height}
                      rx={focusRect.radius ?? 20}
                      ry={focusRect.radius ?? 20}
                      stroke="#f4d08e"
                      strokeWidth="8"
                      width={focusRect.width}
                      x={focusRect.x}
                      y={focusRect.y}
                    />
                  </svg>
                </div>
              ) : null}
              <div className="builder-inspector-title">{selectedMeta.title}</div>
              <div className="builder-inspector-subtitle">{selectedMeta.subtitle}</div>
              <div className="builder-fields">
                {selectedMeta.mode === "rect" ? (
                  <>
                    <label>
                      <span>X</span>
                      <input
                        onChange={(event) => updateNumericField("x", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.rect.x)}
                      />
                    </label>
                    <label>
                      <span>Y</span>
                      <input
                        onChange={(event) => updateNumericField("y", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.rect.y)}
                      />
                    </label>
                    <label>
                      <span>Width</span>
                      <input
                        onChange={(event) => updateNumericField("width", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.rect.width)}
                      />
                    </label>
                    <label>
                      <span>Height</span>
                      <input
                        onChange={(event) => updateNumericField("height", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.rect.height)}
                      />
                    </label>
                    <label>
                      <span>Radius</span>
                      <input
                        onChange={(event) => updateNumericField("radius", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.rect.radius ?? 0)}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>X</span>
                      <input
                        onChange={(event) => updateNumericField("x", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.point.x)}
                      />
                    </label>
                    <label>
                      <span>Y</span>
                      <input
                        onChange={(event) => updateNumericField("y", event.target.value)}
                        type="number"
                        value={Math.round(selectedMeta.point.y)}
                      />
                    </label>
                  </>
                )}
              </div>
              {selectedLandmark ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Landmark Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedLandmark.id}
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      onChange={(event) => updateStringField("locationId", event.target.value)}
                      type="text"
                      value={selectedLandmark.locationId}
                    />
                  </label>
                  <label>
                    <span>Style</span>
                    <select
                      onChange={(event) => updateStringField("style", event.target.value)}
                      value={selectedLandmark.style}
                    >
                      {LANDMARK_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Accent</span>
                    <input
                      onChange={(event) => updateColorField("accentColor", event.target.value)}
                      type="text"
                      value={formatColorHex(selectedLandmark.accentColor)}
                    />
                  </label>
                </div>
              ) : null}
              {selectedSurfaceZone ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Zone Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedSurfaceZone.id}
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      onChange={(event) => updateStringField("kind", event.target.value)}
                      value={selectedSurfaceZone.kind}
                    >
                      {SURFACE_ZONE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Emphasis</span>
                    <select
                      onChange={(event) => updateStringField("emphasis", event.target.value)}
                      value={selectedSurfaceZone.emphasis ?? "medium"}
                    >
                      {SURFACE_EMPHASES.map((emphasis) => (
                        <option key={emphasis} value={emphasis}>
                          {emphasis}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {selectedFringeZone ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Fringe Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedFringeZone.id}
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      onChange={(event) => updateStringField("kind", event.target.value)}
                      value={selectedFringeZone.kind}
                    >
                      {FRINGE_ZONE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Edge</span>
                    <select
                      onChange={(event) => updateStringField("edge", event.target.value)}
                      value={selectedFringeZone.edge}
                    >
                      {FRINGE_EDGES.map((edge) => (
                        <option key={edge} value={edge}>
                          {edge}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {selectedModule ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Module Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedModule.id}
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      onChange={(event) => updateStringField("locationId", event.target.value)}
                      type="text"
                      value={selectedModule.locationId}
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      onChange={(event) => updateStringField("kind", event.target.value)}
                      value={selectedModule.kind}
                    >
                      {LANDMARK_MODULE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Variant</span>
                    <input
                      onChange={(event) => updateStringField("variant", event.target.value)}
                      type="text"
                      value={selectedModule.variant ?? ""}
                    />
                  </label>
                  <label>
                    <span>Text</span>
                    <input
                      onChange={(event) => updateStringField("text", event.target.value)}
                      type="text"
                      value={selectedModule.text ?? ""}
                    />
                  </label>
                  <label>
                    <span>Count</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("count", event.target.value)}
                      type="number"
                      value={selectedModule.count ?? 0}
                    />
                  </label>
                </div>
              ) : null}
              {selectedCluster ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Cluster Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedCluster.id}
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      onChange={(event) => updateStringField("locationId", event.target.value)}
                      type="text"
                      value={selectedCluster.locationId ?? ""}
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      onChange={(event) => updateStringField("kind", event.target.value)}
                      value={selectedCluster.kind}
                    >
                      {PROP_CLUSTER_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {selectedProp ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Kind</span>
                    <select
                      onChange={(event) => updateStringField("kind", event.target.value)}
                      value={selectedProp.kind}
                    >
                      {PROP_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Scale</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("scale", event.target.value)}
                      step="0.05"
                      type="number"
                      value={selectedProp.scale ?? 1}
                    />
                  </label>
                  <label>
                    <span>Rotation</span>
                    <input
                      onChange={(event) =>
                        updateExtendedNumberField("rotation", event.target.value)
                      }
                      step="0.05"
                      type="number"
                      value={
                        "rotation" in selectedProp ? (selectedProp.rotation ?? 0) : 0
                      }
                    />
                  </label>
                  {selectedProp.kind === "boat" ? (
                    <>
                      <label>
                        <span>Boat Bob</span>
                        <input
                          onChange={(event) =>
                            updateExtendedNumberField("bobAmount", event.target.value)
                          }
                          type="number"
                          value={selectedProp.bobAmount ?? 0}
                        />
                      </label>
                      <label>
                        <span>Water Region</span>
                        <input
                          onChange={(event) =>
                            updateStringField("waterRegionId", event.target.value)
                          }
                          type="text"
                          value={selectedProp.waterRegionId}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
              {selectedWater ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Water Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedWater.id}
                    />
                  </label>
                  <label>
                    <span>Tag</span>
                    <select
                      onChange={(event) => updateStringField("tag", event.target.value)}
                      value={selectedWater.tag}
                    >
                      {WATER_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Intensity</span>
                    <input
                      onChange={(event) =>
                        updateExtendedNumberField("intensity", event.target.value)
                      }
                      step="0.05"
                      type="number"
                      value={selectedWater.intensity}
                    />
                  </label>
                  <label>
                    <span>Base Color</span>
                    <input
                      onChange={(event) => updateColorField("baseColor", event.target.value)}
                      type="text"
                      value={formatColorHex(selectedWater.baseColor)}
                    />
                  </label>
                  <label>
                    <span>Crest Color</span>
                    <input
                      onChange={(event) => updateColorField("crestColor", event.target.value)}
                      type="text"
                      value={formatColorHex(selectedWater.crestColor)}
                    />
                  </label>
                </div>
              ) : null}
              {selectedLabel ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Text</span>
                    <input
                      onChange={(event) => updateStringField("text", event.target.value)}
                      type="text"
                      value={selectedLabel.text}
                    />
                  </label>
                  <label>
                    <span>Tone</span>
                    <select
                      onChange={(event) => updateStringField("tone", event.target.value)}
                      value={selectedLabel.tone}
                    >
                      {LABEL_TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <div className="builder-copy">Select a primitive to inspect it.</div>
          )}
        </div>

        <details className="builder-section builder-details">
          <summary className="builder-details-summary">
            <div>
              <div className="builder-section-title">Snapshot Tools</div>
              <div className="builder-list-subtitle">Import and export the exact scene document the game uses.</div>
            </div>
            <span className="builder-details-badge">Open</span>
          </summary>
          <div className="builder-details-body">
            <div className="builder-subsection">
              <div className="builder-section-title">Import</div>
              <div className="builder-stage-actions">
                <button onClick={() => setImportMode("json")} type="button">
                  JSON
                </button>
                <button onClick={() => setImportMode("module")} type="button">
                  Module
                </button>
              </div>
              <div className="builder-copy">
                Paste a copied scene document back in, then apply it over the current file baseline.
              </div>
              <textarea
                className="builder-export"
                onChange={(event) => setImportText(event.target.value)}
                placeholder={
                  importMode === "json"
                    ? "{\n  \"id\": \"south-quay-v2\",\n  ...\n}"
                    : "const SOUTH_QUAY_V2_DOCUMENT = { ... } satisfies VisualSceneDocument;"
                }
                value={importText}
              />
              <button onClick={applyImportedScene} type="button">
                Apply Imported Scene
              </button>
              {importStatus ? <div className="builder-copy">{importStatus}</div> : null}
            </div>

            <div className="builder-subsection">
              <div className="builder-section-title">Export</div>
              <div className="builder-copy">
                Export the exact scene document the game consumes, or copy a ready-to-paste module for the dedicated scene file.
              </div>
              <textarea
                className="builder-export"
                readOnly
                value={importMode === "json" ? buildExportText(scene) : buildModuleExportText(scene)}
              />
              <div className="builder-stage-actions">
                <button onClick={copyExport} type="button">
                  {copiedLabel ?? "Copy Snapshot"}
                </button>
                <button onClick={copyModuleExport} type="button">
                  {moduleCopiedLabel ?? "Copy Module Source"}
                </button>
              </div>
            </div>
          </div>
        </details>
      </aside>

      <style jsx>{`
        .builder-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(272px, 296px) minmax(0, 1fr) minmax(300px, 328px);
          background:
            radial-gradient(circle at top left, rgba(197, 162, 106, 0.16), transparent 28%),
            linear-gradient(180deg, #1a2328, #10171b 60%, #0c1114);
          color: #efe5d2;
        }

        .builder-panel {
          border-right: 1px solid rgba(120, 138, 145, 0.16);
          background: rgba(13, 19, 23, 0.82);
          backdrop-filter: blur(12px);
          overflow: auto;
          padding: 18px 16px 22px;
        }

        .builder-panel-right {
          border-left: 1px solid rgba(120, 138, 145, 0.16);
          border-right: 0;
        }

        .builder-stage-shell {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 18px 16px;
          gap: 14px;
        }

        .builder-stage-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          border-radius: 22px;
          border: 1px solid rgba(124, 141, 146, 0.16);
          background: rgba(18, 25, 29, 0.78);
          padding: 14px 16px;
        }

        .builder-stage-title,
        .builder-title,
        .builder-inspector-title {
          font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
          font-size: 28px;
          line-height: 1.02;
          margin: 0;
        }

        .builder-stage-title {
          font-size: 22px;
        }

        .builder-stage-status {
          margin-top: 6px;
          color: rgba(214, 225, 229, 0.62);
          font-size: 13px;
          line-height: 1.35;
        }

        .builder-kicker,
        .builder-section-title,
        .builder-list-section-label {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 11px;
          color: rgba(214, 225, 229, 0.6);
        }

        .builder-copy,
        .builder-inspector-subtitle,
        .builder-list-subtitle {
          color: rgba(223, 229, 232, 0.72);
          font-size: 14px;
          line-height: 1.5;
        }

        .builder-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 24px;
          border: 1px solid rgba(124, 141, 146, 0.14);
          background: rgba(17, 24, 29, 0.78);
          padding: 16px;
          margin-bottom: 14px;
        }

        .builder-list-section {
          min-height: 0;
          flex: 1;
        }

        .builder-stage-card {
          min-height: 0;
          border-radius: 28px;
          border: 1px solid rgba(123, 139, 145, 0.14);
          background:
            linear-gradient(180deg, rgba(22, 29, 33, 0.96), rgba(10, 16, 20, 0.98)),
            rgba(10, 16, 20, 0.96);
          overflow: auto;
          padding: 18px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .builder-bottom-dock {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 24px;
          border: 1px solid rgba(123, 139, 145, 0.14);
          background: rgba(14, 20, 24, 0.92);
          padding: 14px 16px 16px;
        }

        .builder-bottom-dock-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .builder-bottom-dock-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .builder-bottom-dock-grid-secondary {
          grid-template-columns: minmax(220px, 280px) minmax(280px, 1fr);
        }

        .builder-bottom-dock-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-radius: 16px;
          border: 1px solid rgba(124, 141, 146, 0.12);
          background: rgba(12, 18, 22, 0.56);
          padding: 12px;
          min-width: 0;
        }

        .builder-bottom-dock-group-wide {
          grid-column: span 2;
        }

        .builder-stage {
          width: min(100%, 1120px);
          min-width: 0;
          height: auto;
          border-radius: 22px;
          background: #0e171c;
          touch-action: none;
          flex: 0 0 auto;
        }

        .builder-focus-preview {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(138, 154, 162, 0.18);
          background: rgba(11, 17, 21, 0.94);
        }

        .builder-focus-preview svg {
          width: 100%;
          aspect-ratio: 1.5 / 1;
          display: block;
          background: #091015;
        }

        .builder-hit {
          cursor: grab;
        }

        .builder-hit:active {
          cursor: grabbing;
        }

        .builder-range,
        .builder-fields label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
        }

        .builder-toggle {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          font-size: 14px;
          min-width: 0;
        }

        .builder-toggle input {
          flex: 0 0 auto;
          margin-top: 0;
        }

        .builder-toggle span {
          flex: 1 1 auto;
          min-width: 0;
          line-height: 1.4;
          white-space: normal;
        }

        .builder-range {
          align-items: flex-start;
          flex-direction: column;
        }

        .builder-range-inline {
          gap: 8px;
        }

        .builder-range input {
          width: 100%;
        }

        .builder-palette-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .builder-preset-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .builder-mode-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .builder-mode-row button {
          min-height: 54px;
          font-size: 12px;
        }

        .builder-mode-row button.is-active {
          border-color: rgba(214, 176, 112, 0.6);
          background: rgba(52, 64, 70, 0.95);
        }

        .builder-stage-actions button.is-active {
          border-color: rgba(214, 176, 112, 0.6);
          background: rgba(52, 64, 70, 0.95);
        }

        .builder-area-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 260px;
          overflow: auto;
        }

        .builder-warning-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .builder-warning {
          border-radius: 14px;
          border: 1px solid rgba(198, 150, 98, 0.18);
          background: rgba(42, 30, 20, 0.42);
          padding: 10px 12px;
        }

        .builder-warning.is-success {
          border-color: rgba(124, 174, 136, 0.24);
          background: rgba(22, 47, 31, 0.38);
        }

        .builder-warning-title {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: #f4cf93;
          margin-bottom: 4px;
        }

        .builder-warning.is-success .builder-warning-title {
          color: #9fd8ab;
        }

        .builder-stage-actions,
        .builder-palette-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .builder-stage-actions > * {
          min-width: 0;
        }

        .builder-chip-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .builder-chip-row button {
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .builder-landmark-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .builder-landmark-button {
          text-align: left;
          text-transform: none;
          letter-spacing: normal;
          padding: 12px;
          border-radius: 16px;
          background: rgba(22, 30, 34, 0.84);
        }

        .builder-landmark-button.is-active {
          border-color: rgba(214, 176, 112, 0.6);
          background: rgba(52, 64, 70, 0.95);
        }

        button,
        select,
        textarea,
        input:not([type="checkbox"]):not([type="range"]) {
          border-radius: 12px;
          border: 1px solid rgba(135, 151, 161, 0.18);
          background: rgba(25, 34, 40, 0.92);
          color: #efe5d2;
        }

        button {
          padding: 10px 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
        }

        button:hover {
          border-color: rgba(211, 174, 117, 0.48);
          background: rgba(41, 52, 58, 0.96);
        }

        .is-danger {
          color: #f3c0b7;
        }

        select,
        textarea,
        input:not([type="checkbox"]):not([type="range"]) {
          padding: 10px 12px;
          width: 100%;
        }

        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          padding: 0;
          margin: 0;
          flex: 0 0 18px;
          accent-color: #3b82f6;
        }

        input[type="range"] {
          width: 100%;
          padding: 0;
          margin: 0;
          background: transparent;
        }

        .builder-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 42vh;
          overflow: auto;
        }

        .builder-list-item {
          text-align: left;
          padding: 12px;
          border-radius: 16px;
          background: rgba(22, 30, 34, 0.84);
          text-transform: none;
          letter-spacing: normal;
          font-size: 13px;
        }

        .builder-list-item.is-active {
          border-color: rgba(214, 176, 112, 0.6);
          background: rgba(52, 64, 70, 0.95);
        }

        .builder-list-title {
          font-weight: 600;
          margin-top: 4px;
        }

        .builder-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .builder-fields-single {
          margin-top: 12px;
        }

        .builder-details {
          padding: 0;
          overflow: hidden;
        }

        .builder-details-summary {
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          padding: 16px;
        }

        .builder-details-summary::-webkit-details-marker {
          display: none;
        }

        .builder-details-badge {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: rgba(214, 225, 229, 0.58);
        }

        .builder-details[open] .builder-details-badge {
          color: #f4cf93;
        }

        .builder-details-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 0 16px 16px;
        }

        .builder-subsection {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid rgba(124, 141, 146, 0.12);
          padding-top: 14px;
        }

        .builder-export {
          min-height: 280px;
          resize: vertical;
          font-family: "SFMono-Regular", "Menlo", monospace;
          font-size: 12px;
          line-height: 1.45;
        }

        @media (max-width: 1220px) {
          .builder-shell {
            grid-template-columns: 1fr;
          }

          .builder-panel,
          .builder-panel-right {
            border: 0;
          }

          .builder-bottom-dock-grid {
            grid-template-columns: 1fr;
          }

          .builder-bottom-dock-grid-secondary {
            grid-template-columns: 1fr;
          }

          .builder-bottom-dock-group-wide {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
