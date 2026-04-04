"use client";

import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { SOUTH_QUAY_V2_DOCUMENT } from "@/lib/street/visual-scene-documents/southQuayV2Document";
import {
  clampSkyLayerTop,
  getNormalizedSkyLayerRect,
  getSkyLayerPhaseOffset,
} from "@/lib/street/skyLayers";
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
  type VisualLandmarkModule,
  type VisualSceneCloudKind,
  type VisualLandmarkModuleKind,
  type VisualPoint,
  type VisualPropCluster,
  type VisualPropClusterKind,
  type VisualRect,
  type VisualScene,
  type VisualSceneDocument,
  type VisualSceneId,
  type VisualSceneLandmarkStyle,
  type VisualSceneLocationAnchors,
  type VisualSceneWeatherKind,
  type VisualSurfaceMaterialKind,
  type VisualTerrainKind,
  type VisualSceneWaterTag,
  type VisualSurfaceZoneKind,
} from "@/lib/street/visualScenes";

const BUILDER_SCENE_ID: VisualSceneId = "south-quay-v2";
const SOURCE_READY_SCENE: VisualSceneDocument = SOUTH_QUAY_V2_DOCUMENT;

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

const CLOUD_KINDS: VisualSceneCloudKind[] = [
  "wispy",
  "harbor-bank",
  "storm-front",
];

const WEATHER_KINDS: VisualSceneWeatherKind[] = [
  "none",
  "mist",
  "drizzle",
  "rain",
  "storm",
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
  "dockyard_kit",
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
  weather: boolean;
};

type BuilderSelection =
  | { kind: "landmark"; index: number }
  | { kind: "surfaceZone"; index: number }
  | { kind: "fringeZone"; index: number }
  | { kind: "landmarkModule"; index: number }
  | { kind: "propCluster"; index: number }
  | { kind: "prop"; index: number }
  | { kind: "waterRegion"; index: number }
  | { kind: "skyLayer"; index: number }
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
  cloudKind: VisualSceneCloudKind;
  fringeEdge: VisualFringeZoneEdge;
  fringeKind: VisualFringeZoneKind;
  moduleKind: VisualLandmarkModuleKind;
  propClusterKind: VisualPropClusterKind;
  propKind: (typeof PROP_KINDS)[number];
  surfaceKind: VisualSurfaceZoneKind;
  waterTag: VisualSceneWaterTag;
  weatherKind: VisualSceneWeatherKind;
};

type BuilderPresetKind = (typeof PRESET_KINDS)[number];
type ReadyBuildingInventoryItem = {
  description: string;
  label: string;
  preset: BuilderPresetKind;
  selection: Extract<BuilderSelection, { kind: "landmark" }> | null;
  style: VisualSceneLandmarkStyle;
  targetLocationId: string;
};

type CloudInventoryPreset = {
  cloudKind: VisualSceneCloudKind;
  density: number;
  description: string;
  id: string;
  label: string;
  opacity: number;
  scale: number;
  speed: number;
  weather: VisualSceneWeatherKind;
};

type BuilderImportMode = "json" | "module";
type BuilderCanvasMode = "buildings" | "ground" | "roads" | "details" | "weather";
type GroundToolMode = "brush" | "select";
type RoadToolMode = "brush" | "select";
type TerrainDisplayMode = "mask" | "render";
type PaintState = {
  layer: "surface" | "terrain";
  pointerId: number;
};

const CLOUD_INVENTORY_PRESETS: CloudInventoryPreset[] = [
  {
    cloudKind: "wispy",
    density: 3.2,
    description: "Thin high clouds for a cleaner harbor sky with no weather.",
    id: "wispy-clear",
    label: "High Wisps",
    opacity: 0.38,
    scale: 0.92,
    speed: 18,
    weather: "none",
  },
  {
    cloudKind: "harbor-bank",
    density: 4.2,
    description: "Soft broad clouds that drift over the quay without bringing weather.",
    id: "harbor-bank-clear",
    label: "Harbor Bank",
    opacity: 0.5,
    scale: 1.08,
    speed: 14,
    weather: "none",
  },
  {
    cloudKind: "harbor-bank",
    density: 4.8,
    description: "Low marine cloud that rolls in with sea mist.",
    id: "sea-mist",
    label: "Sea Mist",
    opacity: 0.34,
    scale: 1.1,
    speed: 11,
    weather: "mist",
  },
  {
    cloudKind: "harbor-bank",
    density: 5.1,
    description: "A heavier cloud bank that starts a steady dockside rain.",
    id: "rain-bank",
    label: "Rain Bank",
    opacity: 0.48,
    scale: 1.14,
    speed: 17,
    weather: "rain",
  },
  {
    cloudKind: "storm-front",
    density: 5.8,
    description: "Dark industrial weather with a stronger storm trigger.",
    id: "storm-front",
    label: "Storm Front",
    opacity: 0.58,
    scale: 1.28,
    speed: 22,
    weather: "storm",
  },
];

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

const LANDMARK_STYLE_LABELS: Record<VisualSceneLandmarkStyle, string> = {
  "boarding-house": "boarding house",
  cafe: "cafe / restaurant",
  courtyard: "courtyard",
  dock: "dock",
  square: "square",
  workshop: "workshop",
  yard: "yard",
};

const PRESET_DEFAULT_LOCATION_BY_KIND: Record<BuilderPresetKind, string> = {
  boarding_frontage: "boarding-house",
  dockyard_kit: "freight-yard",
  eatery_frontage: "tea-house",
  harbor_edge_kit: "moss-pier",
  square_kit: "market-square",
  workshop_frontage: "repair-stall",
  yard_service_kit: "courtyard",
};

const PRESET_STYLE_BY_KIND: Record<BuilderPresetKind, VisualSceneLandmarkStyle> = {
  boarding_frontage: "boarding-house",
  dockyard_kit: "yard",
  eatery_frontage: "cafe",
  harbor_edge_kit: "dock",
  square_kit: "square",
  workshop_frontage: "workshop",
  yard_service_kit: "yard",
};

const PRESET_LABELS: Record<BuilderPresetKind, string> = {
  boarding_frontage: "Boarding House",
  dockyard_kit: "Dock Yard / Maintenance Yard",
  eatery_frontage: "Cafe / Restaurant",
  harbor_edge_kit: "Harbor Edge",
  square_kit: "Town Market Square",
  workshop_frontage: "Workshop",
  yard_service_kit: "Service Courtyard",
};

function titleCaseSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLandmarkDisplayLabel(landmark: VisualScene["landmarks"][number]) {
  if (landmark.style === "cafe") {
    return "Cafe / Restaurant";
  }
  if (landmark.locationId === "market-square") {
    return "Town Market Square";
  }
  if (landmark.locationId === "freight-yard") {
    return "Dock Yard / Maintenance Yard";
  }
  return titleCaseSlug(landmark.locationId);
}

function getLandmarkDisplaySubtitle(landmark: VisualScene["landmarks"][number]) {
  const styleLabel = LANDMARK_STYLE_LABELS[landmark.style] ?? landmark.style;
  return landmark.style === "cafe"
    ? `${landmark.locationId} • ${styleLabel}`
    : `${styleLabel} • ${landmark.locationId}`;
}

function getReadyBuildingDescription(preset: BuilderPresetKind) {
  switch (preset) {
    case "eatery_frontage":
      return "Fully assembled frontage with awning, terrace, and cafe sign.";
    case "boarding_frontage":
      return "Ready boarding-house frontage with stoop, windows, and top sign.";
    case "workshop_frontage":
      return "Ready workshop frontage with shutters and service bay.";
    case "square_kit":
      return "Town market square kit with plaza massing and public-space edges.";
    case "dockyard_kit":
      return "Dock yard / maintenance yard with gatehouse frontage, cargo storage, and service-bay character.";
    case "yard_service_kit":
      return "Service courtyard kit for the interior work yard.";
    case "harbor_edge_kit":
      return "Ready dock edge with quay wall, apron, and harbor frontage.";
    default:
      return "Fully assembled place kit ready to focus and edit.";
  }
}

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

function clonePointValue(point: VisualPoint): VisualPoint {
  return { ...point };
}

function cloneRectValue(rect: VisualRect): VisualRect {
  return { ...rect };
}

function cloneLocationAnchorsValue(
  anchors: VisualSceneLocationAnchors,
): VisualSceneLocationAnchors {
  return {
    door: clonePointValue(anchors.door),
    frontage: clonePointValue(anchors.frontage),
    highlight: cloneRectValue(anchors.highlight),
    label: clonePointValue(anchors.label),
    npcStands: anchors.npcStands?.map(clonePointValue),
  };
}

function translatePointValue(point: VisualPoint, deltaX: number, deltaY: number) {
  point.x += deltaX;
  point.y += deltaY;
}

function translateRectValue(rect: VisualRect, deltaX: number, deltaY: number) {
  rect.x += deltaX;
  rect.y += deltaY;
}

function getSourceReadyBuildingBundle(locationId: string) {
  const landmark = SOURCE_READY_SCENE.landmarks.find((item) => item.locationId === locationId);
  if (!landmark) {
    return null;
  }

  return {
    anchors: SOURCE_READY_SCENE.locationAnchors[locationId] ?? null,
    landmark,
    modules: SOURCE_READY_SCENE.landmarkModules.filter(
      (item): item is VisualLandmarkModule => item.locationId === locationId,
    ),
    propClusters: SOURCE_READY_SCENE.propClusters.filter(
      (item): item is VisualPropCluster => item.locationId === locationId,
    ),
  };
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
    case "skyLayer":
      return scene.skyLayers[selection.index]
        ? getNormalizedSkyLayerRect(scene.height, scene.skyLayers[selection.index].rect)
        : null;
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
    case "skyLayer": {
      const item = scene.skyLayers[selection.index];
      return item
        ? {
            mode: "rect" as const,
            rect: getNormalizedSkyLayerRect(scene.height, item.rect),
            subtitle: `${item.cloudKind} • ${item.weather}`,
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
    case "locationAnchorHighlight": {
      const anchor = scene.locationAnchors[selection.locationId];
      if (!anchor) {
        return null;
      }
      return {
        mode: "rect" as const,
        rect: anchor.highlight,
        subtitle: "location highlight",
        title: `${selection.locationId} highlight`,
      };
    }
    case "locationAnchorPoint": {
      const anchor = scene.locationAnchors[selection.locationId];
      if (!anchor) {
        return null;
      }
      return {
        mode: "point" as const,
        point: anchor[selection.pointKey],
        subtitle: `${selection.locationId} • ${selection.pointKey}`,
        title: `${selection.locationId} ${selection.pointKey}`,
      };
    }
    case "locationAnchorNpcStand": {
      const point = scene.locationAnchors[selection.locationId]?.npcStands?.[selection.index] ?? null;
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
      label: getLandmarkDisplayLabel(item),
      selection: { kind: "landmark", index } as BuilderSelection,
      section: "Landmarks",
      subtitle: `${getLandmarkDisplaySubtitle(item)} • ${countBuildingShapeSelections(scene, item.locationId)} shapes`,
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
    ...scene.skyLayers.map((item, index) => ({
      id: selectionId({ kind: "skyLayer", index }),
      label: item.id,
      selection: { kind: "skyLayer", index } as BuilderSelection,
      section: "Weather",
      subtitle: `${item.cloudKind} • ${item.weather}`,
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

function getBuildingShapeSelections(scene: VisualScene, locationId: string): BuilderSelection[] {
  const selections: BuilderSelection[] = [];
  const landmarkIndex = scene.landmarks.findIndex((item) => item.locationId === locationId);

  if (landmarkIndex >= 0) {
    selections.push({ kind: "landmark", index: landmarkIndex });
  }

  scene.landmarkModules.forEach((item, index) => {
    if (item.locationId === locationId) {
      selections.push({ kind: "landmarkModule", index });
    }
  });

  return selections;
}

function countBuildingShapeSelections(scene: VisualScene, locationId: string) {
  return getBuildingShapeSelections(scene, locationId).length;
}

function translateLocationAnchorsInPlace(
  anchors: VisualSceneLocationAnchors | undefined,
  deltaX: number,
  deltaY: number,
) {
  if (!anchors) {
    return;
  }

  anchors.door.x += deltaX;
  anchors.door.y += deltaY;
  anchors.frontage.x += deltaX;
  anchors.frontage.y += deltaY;
  anchors.label.x += deltaX;
  anchors.label.y += deltaY;
  anchors.highlight.x += deltaX;
  anchors.highlight.y += deltaY;
  anchors.npcStands?.forEach((point) => {
    point.x += deltaX;
    point.y += deltaY;
  });
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
        const landmark = draft.landmarks[selection.index];
        const deltaX = x - landmark.rect.x;
        const deltaY = y - landmark.rect.y;
        translateLocationAnchorsInPlace(
          draft.locationAnchors[landmark.locationId],
          deltaX,
          deltaY,
        );
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
    case "skyLayer":
      if (draft.skyLayers[selection.index]) {
        draft.skyLayers[selection.index].rect.x = x;
        draft.skyLayers[selection.index].rect.y = clampSkyLayerTop(draft.height, y);
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
      if (draft.locationAnchors[selection.locationId]) {
        draft.locationAnchors[selection.locationId].highlight.x = x;
        draft.locationAnchors[selection.locationId].highlight.y = y;
      }
      return;
    case "locationAnchorPoint":
      if (draft.locationAnchors[selection.locationId]) {
        draft.locationAnchors[selection.locationId][selection.pointKey] = { x, y };
      }
      return;
    case "locationAnchorNpcStand": {
      const anchor = draft.locationAnchors[selection.locationId];
      if (!anchor) {
        return;
      }
      const stands = anchor.npcStands ?? [];
      if (stands[selection.index]) {
        stands[selection.index] = { x, y };
        anchor.npcStands = stands;
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
  let rect: VisualRect | null = null;
  switch (selection.kind) {
    case "landmark":
      rect = draft.landmarks[selection.index]?.rect ?? null;
      break;
    case "surfaceZone":
      rect = draft.surfaceZones[selection.index]?.rect ?? null;
      break;
    case "fringeZone":
      rect = draft.fringeZones[selection.index]?.rect ?? null;
      break;
    case "landmarkModule":
      rect = draft.landmarkModules[selection.index]?.rect ?? null;
      break;
    case "propCluster":
      rect = draft.propClusters[selection.index]?.rect ?? null;
      break;
    case "waterRegion":
      rect = draft.waterRegions[selection.index]?.rect ?? null;
      break;
    case "skyLayer":
      rect = draft.skyLayers[selection.index]?.rect ?? null;
      break;
    case "locationAnchorHighlight":
      rect = draft.locationAnchors[selection.locationId]?.highlight ?? null;
      break;
    default:
      rect = null;
      break;
  }

  if (!rect) {
    return;
  }
  if (field === "radius") {
    rect.radius = value;
    return;
  }
  if (selection.kind === "skyLayer" && field === "y") {
    rect.y = clampSkyLayerTop(draft.height, value);
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

function sampleRectPoints(rect: VisualRect, columns = 3, rows = 3) {
  const points: VisualPoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        x: rect.x + ((column + 0.5) / columns) * rect.width,
        y: rect.y + ((row + 0.5) / rows) * rect.height,
      });
    }
  }
  return points;
}

function rectWithinScene(scene: VisualScene, rect: VisualRect) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= scene.width &&
    rect.y + rect.height <= scene.height
  );
}

function rectFitsLand(scene: VisualScene, rect: VisualRect) {
  if (!scene.terrainDraft) {
    return true;
  }
  return sampleRectPoints(rect).every((point) => getTerrainKindAtPoint(scene, point) === "land");
}

function rectAvoidsLandmarks(
  scene: VisualScene,
  rect: VisualRect,
  ignoreLocationId?: string,
) {
  return scene.landmarks.every((landmark) => {
    if (landmark.locationId === ignoreLocationId) {
      return true;
    }
    return !rectsOverlap(expandedRect(landmark.rect, 28), rect);
  });
}

function rectPlacementAllowed(
  scene: VisualScene,
  rect: VisualRect,
  ignoreLocationId?: string,
) {
  return rectWithinScene(scene, rect) && rectFitsLand(scene, rect) && rectAvoidsLandmarks(scene, rect, ignoreLocationId);
}

function buildPlacementRect(
  scene: VisualScene,
  templateRect: VisualRect,
  x: number,
  y: number,
): VisualRect {
  return {
    height: templateRect.height,
    radius: templateRect.radius,
    width: templateRect.width,
    x: clamp(Math.round(x / 4) * 4, 0, Math.max(0, scene.width - templateRect.width)),
    y: clamp(Math.round(y / 4) * 4, 0, Math.max(0, scene.height - templateRect.height)),
  };
}

function findSmartPlacementRect(
  scene: VisualScene,
  templateRect: VisualRect,
  preferredViewBox: VisualRect,
  ignoreLocationId?: string,
) {
  const step = 24;
  const margin = 24;
  const minX = clamp(
    Math.floor((preferredViewBox.x + margin) / step) * step,
    0,
    Math.max(0, scene.width - templateRect.width),
  );
  const maxX = clamp(
    Math.ceil((preferredViewBox.x + preferredViewBox.width - templateRect.width - margin) / step) * step,
    0,
    Math.max(0, scene.width - templateRect.width),
  );
  const minY = clamp(
    Math.floor((preferredViewBox.y + margin) / step) * step,
    0,
    Math.max(0, scene.height - templateRect.height),
  );
  const maxY = clamp(
    Math.ceil((preferredViewBox.y + preferredViewBox.height - templateRect.height - margin) / step) * step,
    0,
    Math.max(0, scene.height - templateRect.height),
  );
  const preferredRect = buildPlacementRect(
    scene,
    templateRect,
    preferredViewBox.x + preferredViewBox.width / 2 - templateRect.width / 2,
    preferredViewBox.y + preferredViewBox.height * 0.16,
  );
  let bestRect: VisualRect | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const candidate = buildPlacementRect(scene, templateRect, x, y);
      if (!rectPlacementAllowed(scene, candidate, ignoreLocationId)) {
        continue;
      }
      const score =
        Math.abs(candidate.x - preferredRect.x) +
        Math.abs(candidate.y - preferredRect.y) * 1.35;
      if (score < bestScore) {
        bestRect = candidate;
        bestScore = score;
      }
    }
  }

  return bestRect ?? preferredRect;
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
  const isDockyard = landmark.locationId === "freight-yard";
  const isTownSquare = landmark.locationId === "market-square" || landmark.style === "square";
  if (landmark.style === "courtyard") {
    return null;
  }
  const roofFill =
    landmark.style === "cafe"
      ? "#b08c66"
      : landmark.style === "boarding-house"
        ? "#89949c"
        : landmark.style === "workshop"
          ? "#5a6670"
          : landmark.style === "dock"
            ? "#8d6d47"
            : landmark.style === "yard"
              ? "#6d675d"
              : "#d6c7a9";
  const bodyFill =
    landmark.style === "cafe"
      ? "#f0e4cd"
      : landmark.style === "boarding-house"
        ? "#d8c7b6"
        : landmark.style === "workshop"
          ? "#9e8667"
          : landmark.style === "dock"
            ? "#866444"
            : landmark.style === "yard"
              ? "#7b776d"
              : "#ddd1b8";
  const lowerBand =
    landmark.style === "cafe"
      ? "#815d3f"
      : landmark.style === "boarding-house"
        ? "#a67961"
        : landmark.style === "workshop"
          ? "#6e5b46"
          : landmark.style === "dock"
            ? "#76563b"
            : landmark.style === "yard"
              ? "#4d4a45"
            : "#a99c7d";
  const roofHeight =
    landmark.style === "cafe"
      ? Math.max(24, Math.min(42, landmark.rect.height * 0.18))
      : Math.max(28, Math.min(56, landmark.rect.height * 0.24));
  const lowerBandHeight =
    landmark.style === "cafe"
      ? Math.max(26, landmark.rect.height * 0.16)
      : Math.max(40, landmark.rect.height * 0.22);
  const boardingSignWidth =
    landmark.style === "boarding-house" ? Math.min(228, landmark.rect.width - 112) : 0;
  const boardingSignX = landmark.rect.x + (landmark.rect.width - boardingSignWidth) / 2;
  const dockyardCargoWidth = isDockyard ? Math.max(78, landmark.rect.width * 0.28) : 0;
  const dockyardCargoHeight = isDockyard ? Math.max(104, landmark.rect.height * 0.5) : 0;
  const dockyardCargoX = landmark.rect.x + landmark.rect.width - dockyardCargoWidth - 38;
  const dockyardCargoY =
    landmark.rect.y + landmark.rect.height - lowerBandHeight - dockyardCargoHeight - 18;

  if (isTownSquare) {
    const inset = 22;
    const innerRect = {
      x: landmark.rect.x + inset,
      y: landmark.rect.y + inset,
      width: landmark.rect.width - inset * 2,
      height: landmark.rect.height - inset * 2,
    };
    const centerX = landmark.rect.x + landmark.rect.width / 2;
    const centerY = landmark.rect.y + landmark.rect.height / 2;
    const crossWidth = Math.max(54, landmark.rect.width * 0.16);
    const crossHeight = Math.max(54, landmark.rect.height * 0.16);
    const civicRadius = Math.min(landmark.rect.width, landmark.rect.height) * 0.18;

    return (
      <g key={`landmark-preview-${landmark.id}-${index}`}>
        <rect
          fill="#d7c7a6"
          height={landmark.rect.height}
          rx={landmark.rect.radius ?? 30}
          ry={landmark.rect.radius ?? 30}
          stroke="rgba(244, 234, 211, 0.28)"
          strokeWidth="4"
          width={landmark.rect.width}
          x={landmark.rect.x}
          y={landmark.rect.y}
        />
        <rect
          fill="#ccb993"
          height={innerRect.height}
          rx="24"
          ry="24"
          stroke="rgba(154, 128, 92, 0.18)"
          strokeDasharray="8 10"
          strokeWidth="3"
          width={innerRect.width}
          x={innerRect.x}
          y={innerRect.y}
        />
        <rect
          fill="#e7dcc3"
          height={innerRect.height - 62}
          rx="22"
          ry="22"
          width={crossWidth}
          x={centerX - crossWidth / 2}
          y={innerRect.y + 31}
        />
        <rect
          fill="#e7dcc3"
          height={crossHeight}
          rx="22"
          ry="22"
          width={innerRect.width - 62}
          x={innerRect.x + 31}
          y={centerY - crossHeight / 2}
        />
        <circle cx={centerX} cy={centerY} fill="#b8a17a" r={civicRadius + 26} />
        <circle cx={centerX} cy={centerY} fill="#e9dfcc" r={civicRadius + 16} />
        <circle cx={centerX} cy={centerY} fill="#a9b3b9" r={civicRadius} />
        <circle cx={centerX} cy={centerY} fill="#d8ecf5" r={civicRadius * 0.58} />
        <circle cx={centerX} cy={centerY - civicRadius * 0.16} fill="rgba(255,255,255,0.36)" r={civicRadius * 0.24} />
        <rect
          fill="#9c8760"
          height="16"
          rx="8"
          ry="8"
          width={innerRect.width - 84}
          x={innerRect.x + 42}
          y={innerRect.y + 26}
        />
        <rect
          fill="#9c8760"
          height="16"
          rx="8"
          ry="8"
          width={innerRect.width - 84}
          x={innerRect.x + 42}
          y={innerRect.y + innerRect.height - 42}
        />
        <rect
          fill="#9c8760"
          height={innerRect.height - 84}
          rx="8"
          ry="8"
          width="16"
          x={innerRect.x + 26}
          y={innerRect.y + 42}
        />
        <rect
          fill="#9c8760"
          height={innerRect.height - 84}
          rx="8"
          ry="8"
          width="16"
          x={innerRect.x + innerRect.width - 42}
          y={innerRect.y + 42}
        />
      </g>
    );
  }

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
        height={roofHeight}
        rx={landmark.rect.radius ?? 18}
        ry={landmark.rect.radius ?? 18}
        width={landmark.rect.width}
        x={landmark.rect.x}
        y={landmark.rect.y}
      />
      {landmark.style === "cafe" ? (
        <>
          <rect
            fill="rgba(255, 248, 233, 0.52)"
            height="10"
            rx="5"
            ry="5"
            width={landmark.rect.width - 84}
            x={landmark.rect.x + 42}
            y={landmark.rect.y + roofHeight + 12}
          />
          <rect
            fill="#f6eddc"
            height={Math.max(54, landmark.rect.height - roofHeight - lowerBandHeight - 28)}
            rx={Math.max(16, (landmark.rect.radius ?? 20) - 4)}
            ry={Math.max(16, (landmark.rect.radius ?? 20) - 4)}
            stroke="rgba(167, 134, 97, 0.18)"
            strokeWidth="3"
            width={landmark.rect.width - 34}
            x={landmark.rect.x + 17}
            y={landmark.rect.y + roofHeight + 18}
          />
          <rect
            fill="rgba(121, 88, 58, 0.12)"
            height="14"
            rx="7"
            ry="7"
            width={landmark.rect.width - 64}
            x={landmark.rect.x + 32}
            y={landmark.rect.y + landmark.rect.height - lowerBandHeight - 22}
          />
        </>
      ) : null}
      {landmark.style === "boarding-house" ? (
        <>
          <rect
            fill="#4d5961"
            height="34"
            rx="12"
            ry="12"
            stroke="#d5bd88"
            strokeWidth="3"
            width={boardingSignWidth}
            x={boardingSignX}
            y={landmark.rect.y + 12}
          />
          <rect
            fill="rgba(255, 255, 255, 0.1)"
            height="7"
            rx="3.5"
            ry="3.5"
            width={boardingSignWidth - 28}
            x={boardingSignX + 14}
            y={landmark.rect.y + 18}
          />
          <text
            fill="#f4ead2"
            fontFamily="Georgia, serif"
            fontSize="14"
            fontWeight="700"
            letterSpacing="1.7"
            textAnchor="middle"
            x={landmark.rect.x + landmark.rect.width / 2}
            y={landmark.rect.y + 35}
          >
            BOARDING HOUSE
          </text>
          <rect
            fill="#e3d7c9"
            height={Math.max(86, landmark.rect.height * 0.34)}
            rx="16"
            ry="16"
            stroke="rgba(122, 97, 78, 0.12)"
            strokeWidth="3"
            width={landmark.rect.width - 28}
            x={landmark.rect.x + 14}
            y={landmark.rect.y + roofHeight + 10}
          />
          <rect
            fill="#cfb9a5"
            height={Math.max(72, landmark.rect.height * 0.26)}
            rx="14"
            ry="14"
            stroke="rgba(117, 86, 66, 0.12)"
            strokeWidth="3"
            width={landmark.rect.width - 40}
            x={landmark.rect.x + 20}
            y={landmark.rect.y + landmark.rect.height - lowerBandHeight - Math.max(92, landmark.rect.height * 0.28)}
          />
        </>
      ) : null}
      {isDockyard ? (
        <>
          <rect
            fill="#8a8376"
            height={Math.max(64, landmark.rect.height * 0.28)}
            rx="14"
            ry="14"
            stroke="rgba(41, 38, 34, 0.16)"
            strokeWidth="3"
            width={landmark.rect.width - 34}
            x={landmark.rect.x + 17}
            y={landmark.rect.y + roofHeight + 18}
          />
          <rect
            fill="rgba(216, 204, 178, 0.2)"
            height="10"
            rx="5"
            ry="5"
            width={landmark.rect.width - 90}
            x={landmark.rect.x + 45}
            y={landmark.rect.y + roofHeight + 28}
          />
          <rect
            fill="#5a564f"
            height={Math.max(74, landmark.rect.height * 0.32)}
            rx="16"
            ry="16"
            stroke="rgba(232, 216, 187, 0.1)"
            strokeWidth="3"
            width={landmark.rect.width - 44}
            x={landmark.rect.x + 22}
            y={landmark.rect.y + landmark.rect.height - lowerBandHeight - Math.max(96, landmark.rect.height * 0.34)}
          />
          <rect
            fill="#c6923d"
            height="10"
            rx="5"
            ry="5"
            width={landmark.rect.width - 70}
            x={landmark.rect.x + 35}
            y={landmark.rect.y + landmark.rect.height - lowerBandHeight - 26}
          />
        </>
      ) : null}
      <rect
        fill={lowerBand}
        height={lowerBandHeight}
        rx="0"
        width={landmark.rect.width - 18}
        x={landmark.rect.x + 9}
        y={landmark.rect.y + landmark.rect.height - lowerBandHeight - 10}
      />
      {landmark.style === "cafe" ? (
        <rect
          fill="#6a4d35"
          height="12"
          rx="6"
          ry="6"
          width={landmark.rect.width - 54}
          x={landmark.rect.x + 27}
          y={landmark.rect.y + landmark.rect.height - 24}
        />
      ) : null}
      {isDockyard ? (
        <>
          <ellipse
            cx={dockyardCargoX + dockyardCargoWidth / 2}
            cy={dockyardCargoY + dockyardCargoHeight - 2}
            fill="rgba(12, 14, 15, 0.18)"
            rx={dockyardCargoWidth * 0.52}
            ry={Math.max(9, dockyardCargoHeight * 0.08)}
          />
          <rect
            fill="#65513b"
            height={Math.max(10, dockyardCargoHeight * 0.1)}
            rx="4"
            ry="4"
            width={dockyardCargoWidth * 0.84}
            x={dockyardCargoX + dockyardCargoWidth * 0.08}
            y={dockyardCargoY + dockyardCargoHeight - Math.max(16, dockyardCargoHeight * 0.14)}
          />
          <rect
            fill="#4e5961"
            height={dockyardCargoHeight * 0.54}
            rx="10"
            ry="10"
            stroke="rgba(240, 229, 203, 0.14)"
            strokeWidth="3"
            width={dockyardCargoWidth * 0.38}
            x={dockyardCargoX + dockyardCargoWidth * 0.54}
            y={dockyardCargoY + dockyardCargoHeight * 0.18}
          />
          <rect
            fill="rgba(255, 255, 255, 0.1)"
            height="8"
            rx="4"
            ry="4"
            width={dockyardCargoWidth * 0.24}
            x={dockyardCargoX + dockyardCargoWidth * 0.61}
            y={dockyardCargoY + dockyardCargoHeight * 0.24}
          />
          <line
            stroke="rgba(38, 42, 45, 0.44)"
            strokeWidth="3"
            x1={dockyardCargoX + dockyardCargoWidth * 0.64}
            x2={dockyardCargoX + dockyardCargoWidth * 0.64}
            y1={dockyardCargoY + dockyardCargoHeight * 0.22}
            y2={dockyardCargoY + dockyardCargoHeight * 0.68}
          />
          <line
            stroke="rgba(38, 42, 45, 0.44)"
            strokeWidth="3"
            x1={dockyardCargoX + dockyardCargoWidth * 0.79}
            x2={dockyardCargoX + dockyardCargoWidth * 0.79}
            y1={dockyardCargoY + dockyardCargoHeight * 0.22}
            y2={dockyardCargoY + dockyardCargoHeight * 0.68}
          />
          <rect
            fill="#866448"
            height={dockyardCargoHeight * 0.24}
            rx="9"
            ry="9"
            stroke="rgba(238, 220, 183, 0.12)"
            strokeWidth="3"
            width={dockyardCargoWidth * 0.44}
            x={dockyardCargoX + dockyardCargoWidth * 0.04}
            y={dockyardCargoY + dockyardCargoHeight * 0.52}
          />
          <rect
            fill="rgba(232, 205, 162, 0.16)"
            height="7"
            rx="3.5"
            ry="3.5"
            width={dockyardCargoWidth * 0.3}
            x={dockyardCargoX + dockyardCargoWidth * 0.1}
            y={dockyardCargoY + dockyardCargoHeight * 0.58}
          />
          <line
            stroke="rgba(88, 60, 37, 0.4)"
            strokeWidth="2.5"
            x1={dockyardCargoX + dockyardCargoWidth * 0.14}
            x2={dockyardCargoX + dockyardCargoWidth * 0.14}
            y1={dockyardCargoY + dockyardCargoHeight * 0.54}
            y2={dockyardCargoY + dockyardCargoHeight * 0.74}
          />
          <line
            stroke="rgba(88, 60, 37, 0.4)"
            strokeWidth="2.5"
            x1={dockyardCargoX + dockyardCargoWidth * 0.31}
            x2={dockyardCargoX + dockyardCargoWidth * 0.31}
            y1={dockyardCargoY + dockyardCargoHeight * 0.54}
            y2={dockyardCargoY + dockyardCargoHeight * 0.74}
          />
          <rect
            fill="#a17d53"
            height={dockyardCargoHeight * 0.18}
            rx="8"
            ry="8"
            stroke="rgba(248, 233, 200, 0.1)"
            strokeWidth="3"
            width={dockyardCargoWidth * 0.28}
            x={dockyardCargoX + dockyardCargoWidth * 0.18}
            y={dockyardCargoY + dockyardCargoHeight * 0.24}
          />
          <rect
            fill="#d1ab58"
            height="8"
            rx="4"
            ry="4"
            width={dockyardCargoWidth * 0.16}
            x={dockyardCargoX + dockyardCargoWidth * 0.22}
            y={dockyardCargoY + dockyardCargoHeight * 0.31}
          />
          {Array.from({ length: 5 }).map((_, stripeIndex) => {
            const stripeWidth = (landmark.rect.width - 110) / 5;
            return (
              <rect
                fill={stripeIndex % 2 === 0 ? "#d9a240" : "#2d2e30"}
                height="8"
                key={`yard-stripe-${landmark.id}-${stripeIndex}`}
                rx="4"
                ry="4"
                width={stripeWidth}
                x={landmark.rect.x + 55 + stripeIndex * stripeWidth}
                y={landmark.rect.y + landmark.rect.height - 18}
              />
            );
          })}
          <rect
            fill="#4c4841"
            height={landmark.rect.height - 26}
            rx="6"
            ry="6"
            width="10"
            x={landmark.rect.x + 22}
            y={landmark.rect.y + 12}
          />
          <rect
            fill="#4c4841"
            height={landmark.rect.height - 26}
            rx="6"
            ry="6"
            width="10"
            x={landmark.rect.x + landmark.rect.width - 32}
            y={landmark.rect.y + 12}
          />
        </>
      ) : null}
    </g>
  );
}

function renderLandmarkModulePreview(
  module: VisualScene["landmarkModules"][number],
  index: number,
) {
  const rect = module.rect;
  if (module.kind === "roof_cap") {
    const fill =
      module.variant === "verdigris"
        ? "#567365"
        : module.variant === "iron"
          ? "#53616b"
          : module.variant === "timber"
            ? "#80614a"
            : "#5d6870";
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill={fill}
          height={rect.height}
          rx={rect.radius ?? 12}
          ry={rect.radius ?? 12}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        {Array.from({
          length: Math.max(0, Math.floor((rect.width - 28) / 30)),
        }).map((_, ribIndex) => {
          const x = rect.x + 14 + ribIndex * 30;
          return (
            <line
              key={`roof-rib-${module.id}-${ribIndex}`}
              stroke="rgba(189, 166, 118, 0.18)"
              strokeWidth="2"
              x1={x}
              x2={x}
              y1={rect.y + 8}
              y2={rect.y + rect.height - 8}
            />
          );
        })}
      </g>
    );
  }

  if (module.kind === "wall_band") {
    const palette =
      module.variant === "cafe-ivory"
        ? { accent: "#c79268", base: "#e7ddbf" }
        : module.variant === "walnut"
          ? { accent: "#6f5039", base: "#8c684a" }
          : module.variant === "boarding-upper"
            ? { accent: "#b3765e", base: "#d0c2ab" }
            : module.variant === "boarding-lower"
              ? { accent: "#a26d58", base: "#c3b49b" }
              : module.variant === "workshop-stone"
                ? { accent: "#be8660", base: "#697883" }
                : module.variant === "yard-gatehouse"
                  ? { accent: "#70563f", base: "#8e785e" }
                  : { accent: "#aa7f61", base: "#d0c2ab" };
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill={palette.base}
          height={rect.height}
          rx={rect.radius ?? 16}
          ry={rect.radius ?? 16}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        <rect
          fill={palette.accent}
          height={Math.max(18, rect.height * 0.32)}
          width={Math.max(rect.width - 20, 0)}
          x={rect.x + 10}
          y={rect.y + rect.height * 0.45}
        />
      </g>
    );
  }

  if (module.kind === "awning") {
    const stripeCount = 8;
    const stripeWidth = rect.width / stripeCount;
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: stripeCount }).map((_, stripeIndex) => (
          <rect
            fill={stripeIndex % 2 === 0 ? "#42a474" : "#f3efe1"}
            height={rect.height}
            key={`awning-${module.id}-${stripeIndex}`}
            width={stripeWidth + 0.5}
            x={rect.x + stripeIndex * stripeWidth}
            y={rect.y}
          />
        ))}
        <rect
          fill="rgba(107, 80, 55, 0.34)"
          height="6"
          width={rect.width}
          x={rect.x}
          y={rect.y + rect.height - 6}
        />
      </g>
    );
  }

  if (module.kind === "entry") {
    const fill =
      module.variant === "house-door"
        ? "#71533f"
        : module.variant === "arched"
          ? "#6d4d39"
          : "#3e4d53";
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill={fill}
          height={rect.height}
          rx={rect.radius ?? 10}
          ry={rect.radius ?? 10}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        <rect
          fill="rgba(240, 222, 178, 0.12)"
          height={Math.max(rect.height * 0.36, 0)}
          rx="6"
          ry="6"
          width={Math.max(rect.width - 16, 0)}
          x={rect.x + 8}
          y={rect.y + 10}
        />
      </g>
    );
  }

  if (module.kind === "window_row") {
    const count = module.count ?? 3;
    const gap = 14;
    const unitWidth = Math.max((rect.width - gap * (count - 1)) / count, 18);
    const windowHeight = module.variant === "cafe-large" ? rect.height : rect.height - 10;

    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: count }).map((_, windowIndex) => {
          const x = rect.x + windowIndex * (unitWidth + gap);
          return (
            <g key={`window-${module.id}-${windowIndex}`}>
              <rect
                fill="rgba(240, 224, 180, 0.92)"
                height={windowHeight}
                rx="8"
                ry="8"
                width={unitWidth}
                x={x}
                y={rect.y + 4}
              />
              <rect
                fill="rgba(93, 69, 55, 0.22)"
                height={Math.max(windowHeight - 14, 0)}
                rx="6"
                ry="6"
                width={Math.max(unitWidth - 8, 0)}
                x={x + 4}
                y={rect.y + 8}
              />
            </g>
          );
        })}
      </g>
    );
  }

  if (module.kind === "terrace_rail") {
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill="#7a5b42"
          height="8"
          rx="4"
          ry="4"
          width={rect.width}
          x={rect.x}
          y={rect.y + rect.height / 2 - 4}
        />
        {Array.from({
          length: Math.max(0, Math.floor((rect.width - 24) / 26)),
        }).map((_, postIndex) => {
          const x = rect.x + 12 + postIndex * 26;
          return (
            <rect
              fill="#7a5b42"
              height={rect.height}
              key={`terrace-post-${module.id}-${postIndex}`}
              rx="2"
              ry="2"
              width="4"
              x={x}
              y={rect.y}
            />
          );
        })}
      </g>
    );
  }

  if (module.kind === "shutters") {
    const count = module.count ?? 2;
    const gap = 12;
    const shutterWidth = Math.max((rect.width - gap * (count - 1)) / count, 14);
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        {Array.from({ length: count }).map((_, shutterIndex) => {
          const x = rect.x + shutterIndex * (shutterWidth + gap);
          return (
            <g key={`shutter-${module.id}-${shutterIndex}`}>
              <rect
                fill="rgba(195, 203, 199, 0.95)"
                height={rect.height}
                rx="6"
                ry="6"
                width={shutterWidth}
                x={x}
                y={rect.y}
              />
              <rect
                fill="rgba(98, 115, 124, 0.18)"
                height="6"
                width={Math.max(shutterWidth - 8, 0)}
                x={x + 4}
                y={rect.y + 8}
              />
            </g>
          );
        })}
      </g>
    );
  }

  if (module.kind === "stoop") {
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill="#9d8a6d"
          height={rect.height}
          rx={rect.radius ?? 8}
          ry={rect.radius ?? 8}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        <rect
          fill="rgba(134, 111, 87, 0.9)"
          height="8"
          rx="4"
          ry="4"
          width={Math.max(rect.width - 20, 0)}
          x={rect.x + 10}
          y={rect.y + 8}
        />
      </g>
    );
  }

  if (module.kind === "service_bay") {
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill={module.variant === "yard-gate" ? "#6f5844" : "#35474f"}
          height={rect.height}
          rx={rect.radius ?? 10}
          ry={rect.radius ?? 10}
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        {Array.from({
          length: Math.max(0, Math.floor((rect.width - 24) / 26)),
        }).map((_, lineIndex) => {
          const x = rect.x + 12 + lineIndex * 26;
          return (
            <line
              key={`service-bay-line-${module.id}-${lineIndex}`}
              stroke="rgba(198, 168, 115, 0.22)"
              strokeWidth="2"
              x1={x}
              x2={x}
              y1={rect.y + 10}
              y2={rect.y + rect.height - 10}
            />
          );
        })}
      </g>
    );
  }

  if (module.kind === "sign") {
    const fill =
      module.variant === "cafe"
        ? "#384a3f"
        : module.variant === "workshop"
          ? "#3e4648"
          : module.variant === "yard"
            ? "#564638"
            : "#2f4240";
    return (
      <g key={`module-preview-${module.id}-${index}`}>
        <rect
          fill={fill}
          height={rect.height}
          rx={rect.radius ?? 10}
          ry={rect.radius ?? 10}
          stroke="rgba(215, 188, 121, 0.84)"
          strokeWidth="2"
          width={rect.width}
          x={rect.x}
          y={rect.y}
        />
        {module.variant === "cafe" ? (
          <text
            fill="#f7edd2"
            fontFamily="Georgia, serif"
            fontSize={Math.max(16, rect.height * 0.55)}
            fontWeight="700"
            letterSpacing="4"
            textAnchor="middle"
            x={rect.x + rect.width / 2}
            y={rect.y + rect.height / 2 + Math.max(4, rect.height * 0.12)}
          >
            CAFE
          </text>
        ) : null}
        {module.variant === "yard" ? (
          <text
            fill="#f0dfb8"
            fontFamily="Arial Black, Impact, sans-serif"
            fontSize={Math.max(12, rect.height * 0.44)}
            fontWeight="700"
            letterSpacing="2.2"
            textAnchor="middle"
            x={rect.x + rect.width / 2}
            y={rect.y + rect.height / 2 + Math.max(4, rect.height * 0.12)}
          >
            DOCK YARD
          </text>
        ) : null}
      </g>
    );
  }

  if (module.kind === "trim") {
    const fill =
      module.variant === "warm-trim"
        ? "#deb88f"
        : module.variant === "industrial-band"
          ? "#bc8d63"
          : module.variant === "yard-band"
            ? "#c89d74"
            : "#d0b48c";
    return (
      <rect
        fill={fill}
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 6}
        ry={rect.radius ?? 6}
        width={rect.width}
        x={rect.x}
        y={rect.y}
      />
    );
  }

  if (module.kind === "downspout") {
    return (
      <rect
        fill="rgba(83, 98, 106, 0.94)"
        height={rect.height}
        key={`module-preview-${module.id}-${index}`}
        rx={rect.radius ?? 4}
        ry={rect.radius ?? 4}
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
              <rect fill="rgba(39, 33, 26, 0.12)" height="10" rx="5" ry="5" width="56" x={point.x - 28} y={point.y + 8} />
              <rect fill="#8b6848" height="12" rx="5" ry="5" width="50" x={point.x - 25} y={point.y - 8} />
              <rect fill="#c9aa7d" height="4" rx="2" ry="2" width="42" x={point.x - 21} y={point.y - 5} />
              <line stroke="#5c4530" strokeWidth="3" x1={point.x - 18} x2={point.x - 18} y1={point.y + 2} y2={point.y + 15} />
              <line stroke="#5c4530" strokeWidth="3" x1={point.x + 18} x2={point.x + 18} y1={point.y + 2} y2={point.y + 15} />
            </g>
          );
        }

        if (cluster.kind === "square_planter_pair") {
          return (
            <g key={`cluster-point-${cluster.id}-${pointIndex}`}>
              <rect fill="#7a5c40" height="18" rx="6" ry="6" width="24" x={point.x - 12} y={point.y - 5} />
              <circle cx={point.x} cy={point.y - 12} fill="#658153" r="13" />
              <circle cx={point.x - 7} cy={point.y - 15} fill="#7c9a67" r="7" />
              <circle cx={point.x + 8} cy={point.y - 14} fill="#789561" r="6" />
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
      return 3;
    case "weather":
      return 4;
    default:
      return 4;
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
    case "weather":
      return selection.kind === "skyLayer";
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
    case "weather":
      if (scene.skyLayers.length > 0) {
        return { kind: "skyLayer", index: 0 };
      }
      return null;
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
    case "weather":
      return scene.skyLayers.map((_, index) => ({ kind: "skyLayer", index }) as BuilderSelection);
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

function isAnchorSelection(selection: BuilderSelection) {
  return (
    selection.kind === "playerSpawn" ||
    selection.kind === "npcAnchor" ||
    selection.kind === "locationAnchorHighlight" ||
    selection.kind === "locationAnchorPoint" ||
    selection.kind === "locationAnchorNpcStand"
  );
}

function groupedSelectionsForMode(
  scene: VisualScene,
  selection: BuilderSelection,
  mode: BuilderCanvasMode,
): BuilderSelection[] {
  if (mode !== "buildings") {
    return [selection];
  }

  const locationId = getSelectionLocationId(scene, selection);
  if (!locationId) {
    return [selection];
  }

  const grouped = getBuildingShapeSelections(scene, locationId);
  return grouped.length > 0 ? grouped : [selection];
}

function getLocationRenderRect(scene: VisualScene, locationId: string): VisualRect | null {
  const rects = [
    ...scene.landmarks
      .filter((item) => item.locationId === locationId)
      .map((item) => item.rect),
    ...scene.landmarkModules
      .filter((item) => item.locationId === locationId)
      .map((item) => item.rect),
  ];

  if (rects.length === 0) {
    return null;
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  const landmark = scene.landmarks.find((item) => item.locationId === locationId);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    radius: landmark?.rect.radius,
  };
}

function getFocusRect(scene: VisualScene, selection: BuilderSelection): VisualRect | null {
  const locationId = getSelectionLocationId(scene, selection);
  if (locationId) {
    const renderRect = getLocationRenderRect(scene, locationId);
    if (renderRect) {
      return expandedRect(renderRect, 54);
    }
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
  const targetLocationId =
    getSelectionLocationId(draft, selection) ?? PRESET_DEFAULT_LOCATION_BY_KIND[preset];
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
    case "dockyard_kit":
      pushModule("roof_cap", rect.x + 18, rect.y + 10, rect.width - 36, 34, {
        radius: 12,
        variant: "timber",
      });
      pushModule("wall_band", rect.x + 20, rect.y + 52, rect.width - 40, 84, {
        radius: 16,
        variant: "yard-gatehouse",
      });
      pushModule("service_bay", rect.x + 36, rect.y + 146, rect.width - 72, 86, {
        radius: 12,
        variant: "yard-gate",
      });
      pushModule("shutters", rect.x + 44, rect.y + 74, rect.width - 88, 34, {
        count: 3,
        radius: 8,
        variant: "yard",
      });
      pushModule("sign", rect.x + 76, rect.y + 24, rect.width - 152, 30, {
        radius: 10,
        variant: "yard",
      });
      pushModule("trim", rect.x + 24, rect.y + 114, rect.width - 48, 18, {
        radius: 8,
        variant: "yard-band",
      });
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
  const stageShellRef = useRef<HTMLElement | null>(null);
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
  const [coreSaveStatusLabel, setCoreSaveStatusLabel] = useState<string | null>(null);
  const [isSavingCoreScene, setIsSavingCoreScene] = useState(false);
  const [runtimeMirrorRevision, setRuntimeMirrorRevision] = useState(0);
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
    weather: false,
  });
  const [addState, setAddState] = useState<AddState>({
    cloudKind: "wispy",
    fringeEdge: "north",
    fringeKind: "neighbor_facade",
    moduleKind: "awning",
    propClusterKind: "cafe_terrace",
    propKind: "lamp",
    surfaceKind: "main_street",
    waterTag: "water_surface",
    weatherKind: "none",
  });

  const prepareSceneForGameSync = useCallback(
    (sourceScene: VisualSceneDocument) => {
      const nextScene = cloneScene(sourceScene);
      if (!baseScene) {
        return {
          repairedLocationIds: [] as string[],
          scene: nextScene,
        };
      }

      const repairedLocationIds: string[] = [];

      for (const landmark of baseScene.landmarks) {
        const locationId = landmark.locationId;
        let repaired = false;

        if (
          baseScene.locationAnchors[locationId] &&
          !(locationId in nextScene.locationAnchors)
        ) {
          nextScene.locationAnchors[locationId] = cloneLocationAnchorsValue(
            baseScene.locationAnchors[locationId],
          );
          repaired = true;
        }

        if (!nextScene.landmarks.some((item) => item.locationId === locationId)) {
          nextScene.landmarks.push({
            ...landmark,
            rect: cloneRectValue(landmark.rect),
          });
          repaired = true;
        }

        if (repaired) {
          repairedLocationIds.push(locationId);
        }
      }

      return {
        repairedLocationIds,
        scene: nextScene,
      };
    },
    [baseScene],
  );

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
        setPersistenceStatus(
          "Loaded local builder draft (core file stays unchanged until saved)",
        );
      } else {
        setPersistenceStatus("Using file scene (current core source)");
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
      const { repairedLocationIds, scene: gameSyncedScene } =
        prepareSceneForGameSync(scene);
      window.localStorage.setItem(BUILDER_STORAGE_KEY, buildExportText(scene));
      saveVisualSceneRuntimeOverride(gameSyncedScene);
      setPersistenceStatus(
        repairedLocationIds.length > 0
          ? `Saved local draft + runtime preview (${repairedLocationIds.join(", ")} restored). Save As Core Map to make this canonical.`
          : "Saved local draft + runtime preview. Save As Core Map to make this canonical.",
      );
    } catch {
      setPersistenceStatus("Could not save local builder draft");
    }
  }, [baseScene, hasHydratedDraft, prepareSceneForGameSync, scene]);

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
      requestedLayer === "details" ||
      requestedLayer === "weather"
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
  const selectedIsAnchor = isAnchorSelection(selected);
  const anchorFocusRect = selectedVisibleInMode ? getFocusRect(scene, selected) : null;
  const anchorFocusLocationId =
    selectedVisibleInMode && selectedIsAnchor ? getSelectionLocationId(scene, selected) : null;
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
    selectedIsAnchor &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "details"));
  const showWeatherOverlays =
    visibleGroups.weather &&
    (sceneDebugOverlayVisible || (scenePreviewActive && canvasMode === "weather"));
  const warnings = collectVisualSceneWarnings(scene);
  const visibleWarnings = warnings.slice(0, 3);
  const landmarkSelections = scene.landmarks.map((landmark, index) => ({
    label: getLandmarkDisplayLabel(landmark),
    selection: { kind: "landmark", index } as BuilderSelection,
    subtitle: `${countBuildingShapeSelections(scene, landmark.locationId)} shapes • ${getLandmarkDisplaySubtitle(landmark)}`,
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
  const weatherSelections = scene.skyLayers.map((layer, index) => ({
    label: layer.id,
    selection: { kind: "skyLayer", index } as BuilderSelection,
    subtitle: `${layer.cloudKind} • ${layer.weather}`,
  }));
  const layerItems =
    canvasMode === "buildings"
      ? landmarkSelections
      : canvasMode === "roads"
        ? roadSelections
        : canvasMode === "ground"
          ? groundSelections
          : canvasMode === "details"
            ? detailSelections
            : weatherSelections;
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
  const selectedSkyLayer =
    selected.kind === "skyLayer" ? scene.skyLayers[selected.index] ?? null : null;
  const selectedLabel = selected.kind === "label" ? scene.labels[selected.index] ?? null : null;
  const bottomDockTitle =
    canvasMode === "ground"
      ? "0. Land + Water Tools"
      : canvasMode === "roads"
        ? "1. Roads + Terrain Tools"
        : canvasMode === "buildings"
          ? "2. Building Tools"
          : canvasMode === "details"
            ? "3. Detail Tools"
            : "4. Clouds + Weather";
  const bottomDockCopy =
    canvasMode === "ground"
      ? "Shape the shoreline and landmass first, then build upward."
      : canvasMode === "roads"
        ? "Paint the town surface directly on top of the land layer."
        : canvasMode === "buildings"
          ? "Work on landmark placement and stamp quick kits without losing the canvas."
          : canvasMode === "details"
            ? "Use the lower dock for finishing moves while the right rail handles the selected item."
            : "Author moving sky bands and the weather they trigger before it reaches the live game.";
  const selectedSelections = builderItems
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => item.selection);
  const marqueeRect =
    marqueeState !== null ? normalizeRectFromPoints(marqueeState.start, marqueeState.current) : null;

  function setPrimarySelection(selection: BuilderSelection) {
    setSelected(selection);
    setSelectedIds([selectionId(selection)]);
  }

  function setSelectionGroupWithPrimary(
    primary: BuilderSelection,
    selections: BuilderSelection[],
  ) {
    const nextSelections = selections.length > 0 ? selections : [primary];
    setSelected(primary);
    setSelectedIds(Array.from(new Set(nextSelections.map((selection) => selectionId(selection)))));
  }

  function setSelectionGroup(selections: BuilderSelection[]) {
    if (selections.length === 0) {
      setSelectedIds([]);
      return;
    }

    setSelectionGroupWithPrimary(selections[0], selections);
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
        weather: false,
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
        weather: false,
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
        weather: false,
      });
      return;
    }

    if (mode === "weather") {
      setVisibleGroups({
        anchors: false,
        fringe: false,
        labels: false,
        landmarks: true,
        modules: false,
        props: false,
        surfaceZones: false,
        water: false,
        weather: true,
      });
      return;
    }

    setVisibleGroups({
      anchors: false,
      fringe: false,
      labels: true,
      landmarks: true,
      modules: false,
      props: true,
      surfaceZones: false,
      water: false,
      weather: false,
    });
  }

  function selectForEditing(selection: BuilderSelection, mode?: BuilderCanvasMode) {
    const nextMode = mode ?? canvasMode;
    const groupedSelections = groupedSelectionsForMode(scene, selection, nextMode);
    if (groupedSelections.length > 1) {
      setSelectionGroupWithPrimary(selection, groupedSelections);
    } else {
      setPrimarySelection(selection);
    }
    if (mode) {
      applyCanvasMode(mode);
    }
    if (nextMode === "details" && isAnchorSelection(selection)) {
      setVisibleGroups((previous) => ({
        ...previous,
        anchors: true,
      }));
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
    const groupedSelections = groupedSelectionsForMode(scene, selection, canvasMode);
    const selectionsToDrag =
      selectedIds.includes(selectionKey) && selectedSelections.length > 0
        ? selectedSelections.filter((item) => selectionVisibleInCanvasMode(scene, item, canvasMode))
        : groupedSelections.filter((item) => selectionVisibleInCanvasMode(scene, item, canvasMode));

    if (selectedIds.includes(selectionKey)) {
      setSelected(selection);
    } else {
      if (groupedSelections.length > 1) {
        setSelectionGroupWithPrimary(selection, groupedSelections);
      } else {
        setPrimarySelection(selection);
      }
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
        case "skyLayer": {
          const item = draft.skyLayers[selected.index];
          if (!item) {
            return;
          }
          if (field === "id") item.id = value;
          if (field === "cloudKind") item.cloudKind = value as VisualSceneCloudKind;
          if (field === "weather") item.weather = value as VisualSceneWeatherKind;
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
        case "skyLayer": {
          const item = draft.skyLayers[selected.index];
          if (!item) {
            return;
          }
          if (field === "opacity") item.opacity = numeric;
          if (field === "speed") item.speed = numeric;
          if (field === "density") item.density = numeric;
          if (field === "scale") item.scale = numeric;
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

  async function saveSceneAsCoreMap() {
    if (isSavingCoreScene) {
      return;
    }

    setIsSavingCoreScene(true);
    try {
      const { repairedLocationIds, scene: gameSyncedScene } =
        prepareSceneForGameSync(scene);
      const response = await fetch("/api/builder/visual-scene/core", {
        body: JSON.stringify({ scene: gameSyncedScene }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not save core map file.");
      }

      setPersistenceStatus("Saved core source file from builder scene");
      setCoreSaveStatusLabel(
        repairedLocationIds.length > 0
          ? `Core map saved (${repairedLocationIds.join(", ")} restored).`
          : "Core map saved.",
      );
    } catch (error) {
      setCoreSaveStatusLabel(
        error instanceof Error ? error.message : "Could not save core map file.",
      );
    } finally {
      setIsSavingCoreScene(false);
      window.setTimeout(() => setCoreSaveStatusLabel(null), 2400);
    }
  }

  function applySceneToGame() {
    const { repairedLocationIds, scene: gameSyncedScene } =
      prepareSceneForGameSync(scene);
    const didApply = saveVisualSceneRuntimeOverride(gameSyncedScene);
    setGameApplyLabel(
      didApply
        ? repairedLocationIds.length > 0
          ? "Applied to local game with required places restored"
          : "Applied to local game"
        : "Could not apply to local game",
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
    setPersistenceStatus("Reset to core file scene");
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
    case "skyLayer": {
          const source = draft.skyLayers[selected.index];
          if (!source) {
            return;
          }
          draft.skyLayers.push({
            ...source,
            id: `${source.id}-copy-${draft.skyLayers.length + 1}`,
            rect: { ...source.rect, x: source.rect.x + 18, y: clampSkyLayerTop(draft.height, source.rect.y) },
          });
          setPrimarySelection({ kind: "skyLayer", index: draft.skyLayers.length - 1 });
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
      case "skyLayer":
        if (draft.skyLayers.length > 0) {
          return {
            kind: "skyLayer",
            index: Math.max(0, Math.min(previous.index, draft.skyLayers.length - 1)),
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
      indexesForKind("skyLayer").forEach((index) => {
        draft.skyLayers.splice(index, 1);
      });
      indexesForKind("label").forEach((index) => {
        draft.labels.splice(index, 1);
      });

      const locationAnchorIdsToDelete = [
        ...(groupedSelections.get("locationAnchorHighlight") ?? []),
        ...(groupedSelections.get("locationAnchorPoint") ?? []),
        ...(groupedSelections.get("locationAnchorNpcStand") ?? []),
      ]
        .flatMap((selection) => ("locationId" in selection ? [selection.locationId] : []))
        .filter((locationId, index, array) => array.indexOf(locationId) === index);

      locationAnchorIdsToDelete.forEach((locationId) => {
        delete draft.locationAnchors[locationId];
      });

      const nextSelection =
        defaultSelectionForCanvasMode(draft, canvasMode) ??
        nextSelectionAfterDelete(draft, selected);
      setPrimarySelection(nextSelection);
    });
  }

  function clearDetailLayer() {
    const detailCount = scene.propClusters.length + scene.props.length + scene.labels.length;
    const fallbackSelection: BuilderSelection =
      scene.landmarks.length > 0 ? { kind: "landmark", index: 0 } : { kind: "playerSpawn" };
    if (detailCount === 0) {
      setSelected(fallbackSelection);
      setSelectedIds([selectionId(fallbackSelection)]);
      setFocusMode(false);
      setCanvasMode("buildings");
      setVisibleGroups({
        anchors: false,
        fringe: false,
        labels: false,
        landmarks: true,
        modules: true,
        props: false,
        surfaceZones: false,
        water: false,
        weather: false,
      });
      setPersistenceStatus("Additional details layer is already clear; NPCs stay in place");
      return;
    }

    mutateScene((draft) => {
      draft.propClusters = [];
      draft.props = [];
      draft.labels = [];
    });

    setCanvasMode("buildings");
    setVisibleGroups({
      anchors: false,
      fringe: false,
      labels: false,
      landmarks: true,
      modules: true,
      props: false,
      surfaceZones: false,
      water: false,
      weather: false,
    });
    setSelected(fallbackSelection);
    setSelectedIds([selectionId(fallbackSelection)]);
    setFocusMode(false);
    setPersistenceStatus(
      `Cleared ${detailCount} additional detail items and kept NPC anchors hidden`,
    );
  }

  function addPrimitive(
    type: "surface" | "fringe" | "module" | "cluster" | "prop" | "water" | "sky" | "label",
  ) {
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

      if (type === "sky") {
        const defaultWidth = Math.max(220, Math.round(draft.width * 0.42));
        draft.skyLayers.push({
          cloudKind: addState.cloudKind,
          density: 4,
          id: `builder-sky-${draft.skyLayers.length + 1}`,
          opacity: 0.48,
          rect: {
            x: 0,
            y: Math.round(draft.height * 0.05),
            width: defaultWidth,
            height: Math.max(120, Math.round(draft.height * 0.16)),
            radius: 20,
          },
          scale: 1,
          speed: 22,
          weather: addState.weatherKind,
        });
        setPrimarySelection({ kind: "skyLayer", index: draft.skyLayers.length - 1 });
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

  function renderSkyLayerPreview(
    layer: VisualScene["skyLayers"][number],
    index: number,
  ) {
    const beat = previewTimeMs / 1000;
    const skyRect = getNormalizedSkyLayerRect(scene.height, layer.rect);
    const bandX = Math.max(0, Math.min(skyRect.x, scene.width - 1));
    const bandWidth = Math.max(1, Math.min(skyRect.width, scene.width - bandX));
    const coverageWidth = Math.max(bandWidth, scene.width * 0.16);
    const cloudCount = Math.max(
      4,
      Math.round((coverageWidth / 240) * Math.max(layer.density, 1.2)),
    );
    const spacing = Math.max((coverageWidth + bandWidth * 0.14) / cloudCount, 140);
    const travelSpan = bandWidth + spacing * 3;
    const phaseOffset = getSkyLayerPhaseOffset(skyRect.x, scene.width, travelSpan);
    const drift =
      (((beat * layer.speed * 4 + phaseOffset) % travelSpan) + travelSpan) % travelSpan;
    const clipPathId = `sky-layer-clip-${layer.id}-${index}`;
    const palette =
      layer.cloudKind === "storm-front"
        ? {
            body: "rgba(115, 127, 143, 0.92)",
            edge: "rgba(197, 208, 220, 0.2)",
            haze: "rgba(96, 108, 120, 0.24)",
          }
        : layer.cloudKind === "harbor-bank"
          ? {
              body: "rgba(222, 232, 236, 0.86)",
              edge: "rgba(255, 255, 255, 0.24)",
              haze: "rgba(210, 224, 230, 0.18)",
            }
          : {
              body: "rgba(240, 245, 247, 0.78)",
              edge: "rgba(255, 255, 255, 0.28)",
              haze: "rgba(228, 236, 241, 0.14)",
            };
    const fallLength =
      layer.weather === "storm"
        ? Math.min(scene.height - skyRect.y, 360)
        : layer.weather === "rain"
          ? Math.min(scene.height - skyRect.y, 280)
          : layer.weather === "drizzle"
          ? Math.min(scene.height - skyRect.y, 180)
          : Math.min(scene.height - skyRect.y, skyRect.height + 80);
    const rainCount = Math.max(
      10,
      Math.round((bandWidth / 38) * (layer.weather === "storm" ? 1.6 : layer.weather === "rain" ? 1.15 : 0.7)),
    );

    return (
      <g key={`sky-layer-preview-${layer.id}-${index}`}>
        <defs>
          <clipPath id={clipPathId}>
            <rect
              height={Math.max(skyRect.height, 1)}
              rx={skyRect.radius ?? 20}
              ry={skyRect.radius ?? 20}
              width={bandWidth}
              x={bandX}
              y={skyRect.y}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipPathId})`}>
          {layer.weather === "mist" ? (
            <>
              <rect
                fill="rgba(238, 244, 246, 0.18)"
                height={skyRect.height + 70}
                rx={skyRect.radius ?? 20}
                ry={skyRect.radius ?? 20}
                width={bandWidth}
                x={bandX}
                y={skyRect.y}
              />
              <rect
                fill="rgba(214, 226, 230, 0.12)"
                height={skyRect.height + 110}
                width={bandWidth}
                x={bandX}
                y={skyRect.y + 18}
              />
            </>
          ) : null}
          {layer.weather === "drizzle" || layer.weather === "rain" || layer.weather === "storm"
            ? Array.from({ length: rainCount }).map((_, rainIndex) => {
                const x =
                  bandX +
                  (((rainIndex / rainCount) * bandWidth + (beat * layer.speed * 3) % 28) %
                    bandWidth);
                const y =
                  skyRect.y +
                  18 +
                  ((rainIndex * 17) % Math.max(skyRect.height - 14, 24));
                const slant = layer.weather === "storm" ? 18 : layer.weather === "rain" ? 14 : 10;
                const drop = layer.weather === "storm" ? 42 : layer.weather === "rain" ? 32 : 24;
                return (
                  <line
                    key={`sky-rain-${layer.id}-${rainIndex}`}
                    stroke={
                      layer.weather === "storm"
                        ? "rgba(212, 226, 236, 0.3)"
                        : "rgba(226, 236, 242, 0.24)"
                    }
                    strokeLinecap="round"
                    strokeWidth={layer.weather === "storm" ? 2.6 : 1.8}
                    x1={x}
                    x2={x - slant}
                    y1={y}
                    y2={Math.min(y + drop + fallLength * 0.2, scene.height)}
                  />
                );
              })
            : null}
          <rect
            fill={palette.haze}
            height={skyRect.height}
            rx={skyRect.radius ?? 18}
            ry={skyRect.radius ?? 18}
            width={bandWidth}
            x={bandX}
            y={skyRect.y}
          />
          {Array.from({ length: cloudCount + 3 }).map((_, cloudIndex) => {
            const wrappedX = ((cloudIndex * spacing + drift) % travelSpan) - spacing;
            const baseY =
              skyRect.y +
              skyRect.height * (0.18 + ((cloudIndex % 4) * 0.12)) +
              Math.sin(beat * 0.45 + cloudIndex * 0.9) * 6;
            const cloudScale =
              layer.scale *
              (layer.cloudKind === "storm-front" ? 1.28 : layer.cloudKind === "harbor-bank" ? 1.12 : 0.94) *
              (0.92 + (cloudIndex % 3) * 0.11);
            const cloudWidth = 118 * cloudScale;
            const cloudHeight = 36 * cloudScale;
            const cloudX = bandX + wrappedX;
            const alpha = Math.max(0.12, layer.opacity * (0.7 + (cloudIndex % 2) * 0.12));

            return (
              <g key={`sky-cloud-${layer.id}-${cloudIndex}`} opacity={alpha}>
                <ellipse
                  cx={cloudX + cloudWidth * 0.52}
                  cy={baseY + cloudHeight * 0.66}
                  fill="rgba(0,0,0,0.08)"
                  rx={cloudWidth * 0.46}
                  ry={cloudHeight * 0.24}
                />
                <ellipse
                  cx={cloudX + cloudWidth * 0.28}
                  cy={baseY + cloudHeight * 0.58}
                  fill={palette.body}
                  rx={cloudWidth * 0.24}
                  ry={cloudHeight * 0.42}
                  stroke={palette.edge}
                  strokeWidth="1.2"
                />
                <ellipse
                  cx={cloudX + cloudWidth * 0.52}
                  cy={baseY + cloudHeight * 0.42}
                  fill={palette.body}
                  rx={cloudWidth * 0.31}
                  ry={cloudHeight * 0.48}
                  stroke={palette.edge}
                  strokeWidth="1.2"
                />
                <ellipse
                  cx={cloudX + cloudWidth * 0.78}
                  cy={baseY + cloudHeight * 0.6}
                  fill={palette.body}
                  rx={cloudWidth * 0.26}
                  ry={cloudHeight * 0.38}
                  stroke={palette.edge}
                  strokeWidth="1.2"
                />
                <rect
                  fill={palette.body}
                  height={cloudHeight * 0.46}
                  rx={cloudHeight * 0.22}
                  ry={cloudHeight * 0.22}
                  width={cloudWidth * 0.66}
                  x={cloudX + cloudWidth * 0.18}
                  y={baseY + cloudHeight * 0.5}
                />
              </g>
            );
          })}
        </g>
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
            {(visibleGroups.weather || depth >= 4)
              ? scene.skyLayers.map((layer, index) =>
                  renderSkyLayerPreview(layer, index),
                )
              : null}
          </>
        ) : null}
      </>
    );
  }

  function inventoryColorForSection(section: string) {
    switch (section) {
      case "Landmarks":
        return "#c6b284";
      case "Modules":
        return "#9e8f80";
      case "Surface Zones":
        return "#718c96";
      case "Fringe":
        return "#6d6878";
      case "Water":
        return "#5b8699";
      case "Weather":
        return "#b8c4d6";
      case "Prop Clusters":
        return "#7d9568";
      case "Props":
        return "#8fb4b6";
      case "Labels":
        return "#d9c79f";
      case "Anchors":
        return "#c2ad88";
      default:
        return "#8fa0aa";
    }
  }

  function preferredCanvasModeForSelection(selection: BuilderSelection): BuilderCanvasMode {
    switch (selection.kind) {
      case "landmark":
      case "landmarkModule":
        return "buildings";
      case "surfaceZone": {
        const zone = scene.surfaceZones[selection.index];
        if (zone && ROAD_SURFACE_KINDS.has(zone.kind)) {
          return "roads";
        }
        return "ground";
      }
      case "fringeZone":
      case "waterRegion":
        return "ground";
      case "skyLayer":
        return "weather";
      default:
        return "details";
    }
  }

  function renderLandmarkInventoryVisual(style: VisualSceneLandmarkStyle) {
    const isCafe = style === "cafe";
    const roofColor =
      style === "cafe"
        ? "#4f745f"
        : style === "boarding-house"
          ? "#6f7d86"
          : style === "workshop"
            ? "#59656e"
            : style === "dock"
              ? "#846545"
              : "#7a8866";
    const bodyColor =
      style === "cafe"
        ? "#e7dcc2"
        : style === "boarding-house"
          ? "#d4c0aa"
          : style === "workshop"
            ? "#9a8568"
            : style === "dock"
              ? "#7f6145"
              : "#73825f";
    const trimColor = isCafe ? "#7d5a3b" : "#8d7a62";

    return (
      <svg viewBox="0 0 72 44">
        <rect
          fill="rgba(9, 14, 18, 0.76)"
          height="40"
          rx="10"
          ry="10"
          stroke="rgba(203, 214, 220, 0.1)"
          strokeWidth="1.2"
          width="68"
          x="2"
          y="2"
        />
        <ellipse cx="36" cy="33" fill="rgba(0,0,0,0.22)" rx="20" ry="3.2" />
        <rect
          fill={bodyColor}
          height="20"
          rx="5"
          ry="5"
          width="42"
          x="15"
          y="12"
        />
        <rect
          fill={roofColor}
          height="8"
          rx="4"
          ry="4"
          width="46"
          x="13"
          y="8"
        />
        {isCafe ? (
          <>
            <rect fill={trimColor} height="3" rx="1.5" ry="1.5" width="38" x="17" y="18" />
            {Array.from({ length: 6 }).map((_, index) => (
              <rect
                fill={index % 2 === 0 ? "#f2ebdd" : "#4ea273"}
                height="4"
                key={`inventory-cafe-stripe-${index}`}
                width="6.4"
                x={17 + index * 6.35}
                y="21"
              />
            ))}
            <rect fill={trimColor} height="11" rx="2" ry="2" width="8" x="32" y="20" />
            <rect fill="#efdeba" height="5" rx="1" ry="1" width="3.8" x="34.1" y="22" />
            <rect fill="#f4e9c9" height="6" rx="2" ry="2" width="9" x="20" y="21" />
            <rect fill="#f4e9c9" height="6" rx="2" ry="2" width="9" x="43" y="21" />
            <rect fill="#2f4a3f" height="5" rx="1.6" ry="1.6" width="18" x="27" y="10.4" />
            <text
              fill="#f7edd3"
              fontFamily="SFMono-Regular, Menlo, monospace"
              fontSize="3.6"
              fontWeight="700"
              letterSpacing="0.5"
              textAnchor="middle"
              x="36"
              y="14.2"
            >
              CAFE
            </text>
            <circle cx="20" cy="31.4" fill="#8f6a4a" r="2.4" />
            <circle cx="52" cy="31.4" fill="#8f6a4a" r="2.4" />
            <line stroke="#8f6a4a" strokeWidth="1.2" x1="20" x2="20" y1="31.4" y2="35.8" />
            <line stroke="#8f6a4a" strokeWidth="1.2" x1="52" x2="52" y1="31.4" y2="35.8" />
          </>
        ) : (
          <>
            <rect fill={trimColor} height="3.5" rx="1.8" ry="1.8" width="34" x="19" y="18" />
            <rect fill="#6f533d" height="10" rx="2" ry="2" width="8" x="32" y="21" />
            <rect fill="#ecd9b3" height="5" rx="1.8" ry="1.8" width="8" x="20.5" y="22" />
            <rect fill="#ecd9b3" height="5" rx="1.8" ry="1.8" width="8" x="43.5" y="22" />
          </>
        )}
      </svg>
    );
  }

  function renderReadyBuildingSceneVisual(item: ReadyBuildingInventoryItem) {
    const currentLandmark =
      item.selection && item.selection.kind === "landmark"
        ? scene.landmarks[item.selection.index] ?? null
        : null;
    const sourceBundle = getSourceReadyBuildingBundle(item.targetLocationId);
    const landmark = currentLandmark ?? sourceBundle?.landmark ?? null;
    const modules =
      currentLandmark !== null
        ? scene.landmarkModules.filter((entry) => entry.locationId === currentLandmark.locationId)
        : sourceBundle?.modules ?? [];

    if (!landmark) {
      return renderLandmarkInventoryVisual(item.style);
    }

    const previewWidth = 320;
    const previewHeight = 180;
    const padding = 22;
    const minX = Math.min(landmark.rect.x, ...modules.map((entry) => entry.rect.x));
    const minY = Math.min(landmark.rect.y, ...modules.map((entry) => entry.rect.y));
    const maxX = Math.max(
      landmark.rect.x + landmark.rect.width,
      ...modules.map((entry) => entry.rect.x + entry.rect.width),
    );
    const maxY = Math.max(
      landmark.rect.y + landmark.rect.height,
      ...modules.map((entry) => entry.rect.y + entry.rect.height),
    );
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const scale = Math.min(
      (previewWidth - padding * 2) / boundsWidth,
      (previewHeight - padding * 2) / boundsHeight,
    );
    const translateX = (previewWidth - boundsWidth * scale) / 2 - minX * scale;
    const translateY = (previewHeight - boundsHeight * scale) / 2 - minY * scale;

    return (
      <svg viewBox={`0 0 ${previewWidth} ${previewHeight}`}>
        <g transform={`translate(${translateX} ${translateY}) scale(${scale})`}>
          {renderLandmarkPreview(landmark, 0)}
          {modules.map((module, index) => renderLandmarkModulePreview(module, index))}
        </g>
      </svg>
    );
  }

  function renderCloudInventoryVisual(
    cloud: Pick<
      CloudInventoryPreset,
      "cloudKind" | "density" | "opacity" | "scale" | "weather"
    >,
    keyStem: string,
  ) {
    const previewWidth = 160;
    const previewHeight = 76;
    const cloudCount = Math.max(4, Math.round(cloud.density * 1.15));
    const palette =
      cloud.cloudKind === "storm-front"
        ? {
            body: "rgba(115, 127, 143, 0.92)",
            edge: "rgba(197, 208, 220, 0.22)",
            haze: "rgba(82, 95, 108, 0.22)",
            skyBottom: "#23303a",
            skyTop: "#3a4653",
          }
        : cloud.cloudKind === "harbor-bank"
          ? {
              body: "rgba(225, 234, 238, 0.88)",
              edge: "rgba(255, 255, 255, 0.22)",
              haze: "rgba(198, 215, 222, 0.18)",
              skyBottom: "#5c7383",
              skyTop: "#7d96a5",
            }
          : {
              body: "rgba(241, 246, 248, 0.82)",
              edge: "rgba(255, 255, 255, 0.24)",
              haze: "rgba(214, 226, 233, 0.14)",
              skyBottom: "#6f8797",
              skyTop: "#8ca5b1",
            };
    const gradientId = `builder-cloud-grad-${keyStem}`;

    return (
      <svg viewBox={`0 0 ${previewWidth} ${previewHeight}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={palette.skyTop} />
            <stop offset="100%" stopColor={palette.skyBottom} />
          </linearGradient>
        </defs>
        <rect fill={`url(#${gradientId})`} height={previewHeight} rx="12" ry="12" width={previewWidth} />
        <rect fill={palette.haze} height="30" rx="12" ry="12" width={previewWidth} y="8" />
        {cloud.weather === "mist" ? (
          <>
            <rect fill="rgba(237, 244, 247, 0.18)" height="34" width={previewWidth} y="20" />
            <rect fill="rgba(224, 234, 238, 0.12)" height="24" width={previewWidth} y="34" />
          </>
        ) : null}
        {cloud.weather === "drizzle" || cloud.weather === "rain" || cloud.weather === "storm"
          ? Array.from({
              length:
                cloud.weather === "storm" ? 18 : cloud.weather === "rain" ? 15 : 12,
            }).map((_, index) => {
              const x = (index / 18) * previewWidth + ((index * 7) % 10);
              const y = 22 + ((index * 11) % 18);
              const slant = cloud.weather === "storm" ? 9 : cloud.weather === "rain" ? 7 : 5;
              const drop = cloud.weather === "storm" ? 18 : cloud.weather === "rain" ? 14 : 10;
              return (
                <line
                  key={`cloud-rain-${keyStem}-${index}`}
                  stroke={
                    cloud.weather === "storm"
                      ? "rgba(222, 232, 238, 0.3)"
                      : "rgba(228, 236, 242, 0.22)"
                  }
                  strokeLinecap="round"
                  strokeWidth={cloud.weather === "storm" ? 1.8 : 1.2}
                  x1={x}
                  x2={x - slant}
                  y1={y}
                  y2={y + drop}
                />
              );
            })
          : null}
        {Array.from({ length: cloudCount }).map((_, index) => {
          const progress = index / Math.max(cloudCount - 1, 1);
          const cloudScale =
            cloud.scale *
            (cloud.cloudKind === "storm-front"
              ? 1.28
              : cloud.cloudKind === "harbor-bank"
                ? 1.1
                : 0.92) *
            (0.92 + (index % 3) * 0.1);
          const cloudWidth = 34 * cloudScale;
          const cloudHeight = 12 * cloudScale;
          const x = progress * (previewWidth - 24);
          const y = 14 + (index % 3) * 8;
          const alpha = Math.max(0.18, Math.min(cloud.opacity * (0.72 + (index % 2) * 0.12), 1));
          return (
            <g key={`cloud-shape-${keyStem}-${index}`} opacity={alpha}>
              <ellipse
                cx={x + cloudWidth * 0.52}
                cy={y + cloudHeight * 0.66}
                fill="rgba(0,0,0,0.08)"
                rx={cloudWidth * 0.44}
                ry={cloudHeight * 0.22}
              />
              <ellipse
                cx={x + cloudWidth * 0.28}
                cy={y + cloudHeight * 0.56}
                fill={palette.body}
                rx={cloudWidth * 0.24}
                ry={cloudHeight * 0.4}
                stroke={palette.edge}
                strokeWidth="0.7"
              />
              <ellipse
                cx={x + cloudWidth * 0.52}
                cy={y + cloudHeight * 0.42}
                fill={palette.body}
                rx={cloudWidth * 0.3}
                ry={cloudHeight * 0.46}
                stroke={palette.edge}
                strokeWidth="0.7"
              />
              <ellipse
                cx={x + cloudWidth * 0.78}
                cy={y + cloudHeight * 0.6}
                fill={palette.body}
                rx={cloudWidth * 0.25}
                ry={cloudHeight * 0.34}
                stroke={palette.edge}
                strokeWidth="0.7"
              />
              <rect
                fill={palette.body}
                height={cloudHeight * 0.4}
                rx={cloudHeight * 0.18}
                ry={cloudHeight * 0.18}
                width={cloudWidth * 0.66}
                x={x + cloudWidth * 0.18}
                y={y + cloudHeight * 0.5}
              />
            </g>
          );
        })}
      </svg>
    );
  }

  function renderInventoryVisual(item: BuilderListItem) {
    if (item.selection.kind === "landmark") {
      const landmark = scene.landmarks[item.selection.index];
      if (landmark) {
        return renderLandmarkInventoryVisual(landmark.style);
      }
    }

    if (item.selection.kind === "skyLayer") {
      const skyLayer = scene.skyLayers[item.selection.index];
      if (skyLayer) {
        return renderCloudInventoryVisual(skyLayer, skyLayer.id);
      }
    }

    const selection = describeSelection(scene, item.selection);
    const color = inventoryColorForSection(item.section);

    if (!selection) {
      return <span className="builder-inventory-empty">?</span>;
    }

    if (selection.mode === "rect") {
      const previewWidth = 66;
      const previewHeight = 38;
      const scale = Math.min(
        previewWidth / Math.max(selection.rect.width, 1),
        previewHeight / Math.max(selection.rect.height, 1),
        1,
      );
      const rectWidth = Math.max(10, Math.round(selection.rect.width * scale));
      const rectHeight = Math.max(8, Math.round(selection.rect.height * scale));
      const rectX = (72 - rectWidth) / 2;
      const rectY = (44 - rectHeight) / 2;
      const radius = Math.max(
        2,
        Math.min(10, Math.round((selection.rect.radius ?? 12) * scale)),
      );

      return (
        <svg viewBox="0 0 72 44">
          <rect
            fill="rgba(9, 14, 18, 0.76)"
            height="40"
            rx="10"
            ry="10"
            stroke="rgba(203, 214, 220, 0.1)"
            strokeWidth="1.2"
            width="68"
            x="2"
            y="2"
          />
          <rect
            fill={color}
            fillOpacity="0.26"
            height={rectHeight}
            rx={radius}
            ry={radius}
            stroke={color}
            strokeOpacity="0.9"
            strokeWidth="1.6"
            width={rectWidth}
            x={rectX}
            y={rectY}
          />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 72 44">
        <rect
          fill="rgba(9, 14, 18, 0.76)"
          height="40"
          rx="10"
          ry="10"
          stroke="rgba(203, 214, 220, 0.1)"
          strokeWidth="1.2"
          width="68"
          x="2"
          y="2"
        />
        <circle
          cx="36"
          cy="22"
          fill={color}
          r="8"
          stroke="rgba(9, 14, 18, 0.9)"
          strokeWidth="2"
        />
        <circle cx="36" cy="22" fill="#f4d08e" r="3.2" />
      </svg>
    );
  }

  function selectionIsCafeLandmark(selection: BuilderSelection) {
    if (selection.kind !== "landmark") {
      return false;
    }
    const landmark = scene.landmarks[selection.index];
    return landmark?.style === "cafe";
  }

  function addCloudInventoryPreset(preset: CloudInventoryPreset) {
    mutateScene((draft) => {
      const defaultWidth = Math.max(220, Math.round(draft.width * 0.42));
      const maxX = Math.max(draft.width - defaultWidth, 0);
      const xSeed = (draft.skyLayers.length * 176) % Math.max(maxX + 1, 1);
      draft.skyLayers.push({
        cloudKind: preset.cloudKind,
        density: preset.density,
        id: `${preset.id}-${draft.skyLayers.length + 1}`,
        opacity: preset.opacity,
        rect: {
          x: Math.round(xSeed),
          y: Math.round(draft.height * 0.05),
          width: defaultWidth,
          height: Math.max(120, Math.round(draft.height * 0.16)),
          radius: 20,
        },
        scale: preset.scale,
        speed: preset.speed,
        weather: preset.weather,
      });
      setPrimarySelection({ kind: "skyLayer", index: draft.skyLayers.length - 1 });
    });
    setPersistenceStatus(
      `${preset.label} added. Drag and resize it in weather mode to set the cloud band position and width.`,
    );
  }

  const readyBuildingItems: ReadyBuildingInventoryItem[] = PRESET_KINDS.map((preset) => {
    const targetLocationId = PRESET_DEFAULT_LOCATION_BY_KIND[preset];
    const landmarkIndex = scene.landmarks.findIndex((item) => item.locationId === targetLocationId);
    return {
      description: getReadyBuildingDescription(preset),
      label: PRESET_LABELS[preset],
      preset,
      selection:
        landmarkIndex >= 0
          ? ({ kind: "landmark", index: landmarkIndex } as Extract<
              BuilderSelection,
              { kind: "landmark" }
            >)
          : null,
      style: PRESET_STYLE_BY_KIND[preset],
      targetLocationId,
    };
  });
  const placedSkyLayerItems = builderItems.filter(
    (item): item is BuilderListItem & { selection: Extract<BuilderSelection, { kind: "skyLayer" }> } =>
      item.selection.kind === "skyLayer",
  );
  const sceneInventoryItems = builderItems.filter((item) => item.selection.kind !== "landmark");

  function renderInventoryCard(item: BuilderListItem) {
    const isCafeItem = selectionIsCafeLandmark(item.selection);
    const isActive = selectedIds.includes(item.id);

    return (
      <button
        className={`builder-inventory-card ${isActive ? "is-active" : ""} ${isCafeItem ? "is-cafe" : ""}`}
        key={`inventory-${item.id}`}
        onClick={() => {
          const targetMode = preferredCanvasModeForSelection(item.selection);
          selectForEditing(item.selection, targetMode);
          setFocusMode(true);
        }}
        type="button"
      >
        <div className="builder-inventory-visual">{renderInventoryVisual(item)}</div>
        <div className="builder-list-section-label">{item.section}</div>
        <div className="builder-list-title">{item.label}</div>
        <div className="builder-list-subtitle">{item.subtitle}</div>
      </button>
    );
  }

  function focusBuildingSelection(selection: BuilderSelection) {
    setCanvasMode("buildings");
    setVisibleGroups({
      anchors: false,
      fringe: false,
      labels: false,
      landmarks: true,
      modules: true,
      props: false,
      surfaceZones: false,
      water: false,
      weather: false,
    });
    const groupedSelections = groupedSelectionsForMode(scene, selection, "buildings");
    if (groupedSelections.length > 1) {
      setSelectionGroupWithPrimary(selection, groupedSelections);
    } else {
      setPrimarySelection(selection);
    }
    setFocusMode(true);
  }

  function scrollStageIntoView() {
    if (!stageShellRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      stageShellRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function syncReadyBuildingBundle(
    draft: VisualScene,
    preset: BuilderPresetKind,
    targetRect: VisualRect,
  ) {
    const targetLocationId = PRESET_DEFAULT_LOCATION_BY_KIND[preset];
    const sourceBundle = getSourceReadyBuildingBundle(targetLocationId);
    if (!sourceBundle) {
      return null;
    }

    let landmarkIndex = draft.landmarks.findIndex((item) => item.locationId === targetLocationId);
    if (landmarkIndex < 0) {
      const existingLandmarkIds = new Set(draft.landmarks.map((item) => item.id));
      const landmarkId = existingLandmarkIds.has(sourceBundle.landmark.id)
        ? nextSceneId(sourceBundle.landmark.id, existingLandmarkIds)
        : sourceBundle.landmark.id;
      draft.landmarks.push({
        ...sourceBundle.landmark,
        id: landmarkId,
        rect: cloneRectValue(targetRect),
      });
      landmarkIndex = draft.landmarks.length - 1;
    } else {
      draft.landmarks[landmarkIndex] = {
        ...draft.landmarks[landmarkIndex],
        accentColor: sourceBundle.landmark.accentColor,
        rect: cloneRectValue(targetRect),
        style: sourceBundle.landmark.style,
      };
    }

    const deltaX = targetRect.x - sourceBundle.landmark.rect.x;
    const deltaY = targetRect.y - sourceBundle.landmark.rect.y;

    draft.locationAnchors[targetLocationId] = sourceBundle.anchors
      ? (() => {
          const nextAnchors = cloneLocationAnchorsValue(sourceBundle.anchors);
          translatePointValue(nextAnchors.door, deltaX, deltaY);
          translatePointValue(nextAnchors.frontage, deltaX, deltaY);
          translatePointValue(nextAnchors.label, deltaX, deltaY);
          translateRectValue(nextAnchors.highlight, deltaX, deltaY);
          nextAnchors.npcStands?.forEach((point) => translatePointValue(point, deltaX, deltaY));
          return nextAnchors;
        })()
      : draft.locationAnchors[targetLocationId];

    draft.landmarkModules = [
      ...draft.landmarkModules.filter((item) => item.locationId !== targetLocationId),
      ...sourceBundle.modules.map((item) => ({
        ...item,
        rect: {
          ...item.rect,
          x: item.rect.x + deltaX,
          y: item.rect.y + deltaY,
        },
      })),
    ];

    draft.propClusters = [
      ...draft.propClusters.filter((item) => item.locationId !== targetLocationId),
      ...sourceBundle.propClusters.map((item) => ({
        ...item,
        points: item.points?.map((point) => ({
          x: point.x + deltaX,
          y: point.y + deltaY,
        })),
        rect: {
          ...item.rect,
          x: item.rect.x + deltaX,
          y: item.rect.y + deltaY,
        },
      })),
    ];

    return { kind: "landmark", index: landmarkIndex } as const;
  }

  function readyBuildingNeedsBundleSync(item: ReadyBuildingInventoryItem) {
    if (!item.selection || item.selection.kind !== "landmark") {
      return false;
    }
    const sourceBundle = getSourceReadyBuildingBundle(item.targetLocationId);
    if (!sourceBundle) {
      return false;
    }

    const currentModuleCount = scene.landmarkModules.filter(
      (entry) => entry.locationId === item.targetLocationId,
    ).length;
    const currentClusterCount = scene.propClusters.filter(
      (entry) => entry.locationId === item.targetLocationId,
    ).length;

    return (
      currentModuleCount < sourceBundle.modules.length ||
      currentClusterCount < sourceBundle.propClusters.length
    );
  }

  function placeReadyBuilding(preset: BuilderPresetKind) {
    const sourceBundle = getSourceReadyBuildingBundle(PRESET_DEFAULT_LOCATION_BY_KIND[preset]);
    if (!sourceBundle) {
      setPersistenceStatus(`Could not place ${PRESET_LABELS[preset]}.`);
      return;
    }

    let nextSelection: BuilderSelection | null = null;

    mutateScene((draft) => {
      const placementRect = findSmartPlacementRect(scene, sourceBundle.landmark.rect, stageViewBox);
      nextSelection = syncReadyBuildingBundle(draft, preset, placementRect);
    });

    if (!nextSelection) {
      setPersistenceStatus(`Could not place ${PRESET_LABELS[preset]}.`);
      return;
    }

    focusBuildingSelection(nextSelection);
    setPersistenceStatus(`${PRESET_LABELS[preset]} added to scene`);
  }

  function repositionReadyBuilding(
    preset: BuilderPresetKind,
    selection: Extract<BuilderSelection, { kind: "landmark" }>,
  ) {
    const landmark = scene.landmarks[selection.index];
    if (!landmark) {
      return;
    }

    const targetRect = findSmartPlacementRect(scene, landmark.rect, stageViewBox, landmark.locationId);
    if (targetRect.x === landmark.rect.x && targetRect.y === landmark.rect.y) {
      focusBuildingSelection(selection);
      setPersistenceStatus(`${PRESET_LABELS[preset]} is already lined up in the current work area`);
      return;
    }

    mutateScene((draft) => {
      syncReadyBuildingBundle(draft, preset, targetRect);
    });

    focusBuildingSelection(selection);
    setPersistenceStatus(`${PRESET_LABELS[preset]} moved into the current work area`);
  }

  function handleReadyBuildingSelect(item: ReadyBuildingInventoryItem) {
    scrollStageIntoView();

    const landmarkSelection = item.selection;

    if (landmarkSelection) {
      if (readyBuildingNeedsBundleSync(item)) {
        mutateScene((draft) => {
          const currentLandmark = draft.landmarks[landmarkSelection.index];
          if (!currentLandmark) {
            return;
          }
          syncReadyBuildingBundle(draft, item.preset, cloneRectValue(currentLandmark.rect));
        });
        focusBuildingSelection(landmarkSelection);
        setPersistenceStatus(`${item.label} rebuilt from the authored source bundle`);
        return;
      }
      if (
        selectionId(selected) === selectionId(landmarkSelection)
      ) {
        repositionReadyBuilding(item.preset, landmarkSelection);
        return;
      }
      focusBuildingSelection(landmarkSelection);
      return;
    }
    placeReadyBuilding(item.preset);
  }

  function renderReadyBuildingCard(item: ReadyBuildingInventoryItem) {
    const isCafeItem = item.style === "cafe";
    const isActive = item.selection ? selectedIds.includes(selectionId(item.selection)) : false;
    const badgeLabel = item.selection
      ? isActive
        ? "Click to Re-place"
        : "Click to Focus"
      : "Click to Place";

    return (
      <button
        className={`builder-inventory-card builder-building-card ${isActive ? "is-active" : ""} ${
          isCafeItem ? "is-cafe" : ""
        } ${item.selection ? "" : "is-unplaced"}`}
        key={`ready-building-${item.preset}`}
        onClick={() => handleReadyBuildingSelect(item)}
        type="button"
      >
        <div className="builder-inventory-visual is-building">
          {renderReadyBuildingSceneVisual(item)}
        </div>
        <div className="builder-inventory-badge">{badgeLabel}</div>
        <div className="builder-list-section-label">Ready Place</div>
        <div className="builder-list-title">{item.label}</div>
        <div className="builder-list-subtitle">{item.description}</div>
      </button>
    );
  }

  function renderCloudPresetCard(preset: CloudInventoryPreset) {
    const matchesSelectedSky =
      selectedSkyLayer?.cloudKind === preset.cloudKind &&
      selectedSkyLayer?.weather === preset.weather;
    return (
      <button
        className={`builder-inventory-card builder-weather-card ${matchesSelectedSky ? "is-active" : ""}`}
        key={`cloud-preset-${preset.id}`}
        onClick={() => addCloudInventoryPreset(preset)}
        type="button"
      >
        <div className="builder-inventory-visual builder-inventory-visual-weather">
          {renderCloudInventoryVisual(preset, preset.id)}
        </div>
        <div className="builder-inventory-badge">Add Cloud Band</div>
        <div className="builder-list-row">
          <strong>{preset.label}</strong>
        </div>
        <div className="builder-list-subtitle">{preset.description}</div>
      </button>
    );
  }

  function renderPlacedSkyLayerCard(
    item: BuilderListItem & { selection: Extract<BuilderSelection, { kind: "skyLayer" }> },
  ) {
    const layer = scene.skyLayers[item.selection.index];
    if (!layer) {
      return null;
    }
    const isActive = selectedIds.includes(item.id);
    return (
      <button
        className={`builder-inventory-card builder-weather-card ${isActive ? "is-active" : ""}`}
        key={`placed-sky-${item.id}`}
        onClick={() => selectForEditing(item.selection, "weather")}
        type="button"
      >
        <div className="builder-inventory-visual builder-inventory-visual-weather">
          {renderCloudInventoryVisual(layer, layer.id)}
        </div>
        <div className="builder-inventory-badge">Placed Band</div>
        <div className="builder-list-row">
          <strong>{item.label}</strong>
        </div>
        <div className="builder-list-subtitle">
          {layer.cloudKind} • {layer.weather} • speed {Math.round(layer.speed)}
        </div>
      </button>
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
            <button
              className={canvasMode === "weather" ? "is-active" : ""}
              onClick={() => applyCanvasMode("weather")}
              type="button"
            >
              4. Clouds + Weather
            </button>
          </div>
          <div className="builder-copy">
            {canvasMode === "buildings"
              ? "View the first two layers plus building masses and frontage."
              : canvasMode === "roads"
                ? "View land/water first, then paint roads, paving, grass, bushes, and trees on top."
                : canvasMode === "ground"
                  ? "Start with the base map: land, shoreline, quay edges, and water bands."
                  : canvasMode === "details"
                    ? "View the full stack with furniture, labels, and other finishing details. Anchor guides only surface when you edit them."
                    : "Author cloud bands with explicit position + width so the builder stays the source of truth."}
          </div>
          <div className="builder-copy">
            The edit controls for this layer live in the tool dock below the canvas so the stage stays central while you work.
          </div>
          <div className="builder-area-list">
            {showLayerItems &&
            layerItems.map((item) => (
              <button
                className={`builder-list-item ${
                  selectedIds.includes(selectionId(item.selection)) ? "is-active" : ""
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
                  ["weather", "Clouds + weather"],
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
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      cloudKind: event.target.value as VisualSceneCloudKind,
                    }))
                  }
                  value={addState.cloudKind}
                >
                  {CLOUD_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <select
                  onChange={(event) =>
                    setAddState((previous) => ({
                      ...previous,
                      weatherKind: event.target.value as VisualSceneWeatherKind,
                    }))
                  }
                  value={addState.weatherKind}
                >
                  {WEATHER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <button onClick={() => addPrimitive("sky")} type="button">
                  Add Sky Layer
                </button>
              </div>
              <div className="builder-palette-row">
                <button onClick={() => addPrimitive("label")} type="button">
                  Add Label
                </button>
              </div>
            </div>

          </div>
        </details>

        <details className="builder-section builder-details">
          <summary className="builder-details-summary">
            <div>
              <div className="builder-section-title">Game Renderer Mirror</div>
              <div className="builder-list-subtitle">
                This iframe uses the actual game renderer so builder edits can be verified against runtime visuals.
              </div>
            </div>
            <span className="builder-details-badge">Open</span>
          </summary>
          <div className="builder-details-body">
            <div className="builder-stage-actions">
              <button
                onClick={() => setRuntimeMirrorRevision((current) => current + 1)}
                type="button"
              >
                Refresh Mirror
              </button>
            </div>
            <iframe
              className="builder-runtime-mirror"
              loading="lazy"
              src={`/?builder-preview=1&from-builder=1&r=${runtimeMirrorRevision}`}
              title="Many Lives game renderer mirror"
            />
          </div>
        </details>
      </aside>

      <main className="builder-stage-shell" ref={stageShellRef}>
        <div className="builder-stage-header">
          <div>
            <div className="builder-kicker">Scene</div>
            <div className="builder-stage-title">{scene.id}</div>
            {persistenceStatus ? (
              <div className="builder-stage-status">{persistenceStatus}</div>
            ) : null}
            {coreSaveStatusLabel ? (
              <div className="builder-stage-status">{coreSaveStatusLabel}</div>
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
            <button disabled={isSavingCoreScene} onClick={saveSceneAsCoreMap} type="button">
              {isSavingCoreScene ? "Saving Core Map..." : "Save As Core Map"}
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
          <div className="builder-stage-frame">
            <label className="builder-stage-zoom" htmlFor="builder-stage-zoom">
              <span>Zoom {Math.round(stageZoom * 100)}%</span>
              <input
                id="builder-stage-zoom"
                max="2.5"
                min="0.25"
                onChange={(event) => setStageZoom(Number(event.target.value))}
                step="0.01"
                type="range"
                value={stageZoom}
              />
            </label>
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

            {showWeatherOverlays
              ? scene.skyLayers.map((layer, index) =>
                  canvasMode === "weather" &&
                  (!focusMode ||
                    scenePreviewActive ||
                    selectionInFocus(scene, { kind: "skyLayer", index }, focusRect, focusLocationId))
                    ? renderRect(
                        { kind: "skyLayer", index },
                        layer.rect,
                        "#bdc8d8",
                        `${layer.cloudKind} • ${layer.weather}`,
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
                selectionInFocus(
                  scene,
                  { kind: "playerSpawn" },
                  anchorFocusRect,
                  anchorFocusLocationId,
                )
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
                selectionInFocus(
                  scene,
                  { kind: "playerSpawn" },
                  anchorFocusRect,
                  anchorFocusLocationId,
                )
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
                  selectionInFocus(
                    scene,
                    { id, kind: "npcAnchor" },
                    anchorFocusRect,
                    anchorFocusLocationId,
                  )
                    ? renderPoint({ id, kind: "npcAnchor" }, point, "#c79a75", id)
                    : null,
                )
              : null}

            {showAnchorOverlays
              ? Object.entries(scene.locationAnchors).map(([locationId, anchor]) =>
                  canvasMode === "details" &&
                  selectionInFocus(
                    scene,
                    { kind: "locationAnchorHighlight", locationId },
                    anchorFocusRect,
                    anchorFocusLocationId,
                  )
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
                  selectionInFocus(
                    scene,
                    { kind: "locationAnchorPoint", locationId, pointKey: "door" },
                    anchorFocusRect,
                    anchorFocusLocationId,
                  )
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "door" },
                        anchor.door,
                        "#c5967e",
                        `${locationId} door`,
                      )
                    : null,
                  canvasMode === "details" &&
                  selectionInFocus(
                    scene,
                    { kind: "locationAnchorPoint", locationId, pointKey: "frontage" },
                    anchorFocusRect,
                    anchorFocusLocationId,
                  )
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "frontage" },
                        anchor.frontage,
                        "#8aac90",
                        `${locationId} frontage`,
                      )
                    : null,
                  canvasMode === "details" &&
                  selectionInFocus(
                    scene,
                    { kind: "locationAnchorPoint", locationId, pointKey: "label" },
                    anchorFocusRect,
                    anchorFocusLocationId,
                  )
                    ? renderPoint(
                        { kind: "locationAnchorPoint", locationId, pointKey: "label" },
                        anchor.label,
                        "#a6b6c8",
                        `${locationId} label`,
                      )
                    : null,
                  ...(anchor.npcStands ?? []).map((point, index) =>
                    canvasMode === "details" &&
                    selectionInFocus(
                      scene,
                      {
                        kind: "locationAnchorNpcStand",
                        locationId,
                        index,
                      },
                      anchorFocusRect,
                      anchorFocusLocationId,
                    )
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
                      {PRESET_LABELS[preset]}
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
              <div className="builder-bottom-dock-group">
                <div className="builder-section-title">Restart</div>
                <div className="builder-stage-actions">
                  <button className="is-danger" onClick={clearDetailLayer} type="button">
                    Clear Details Layer
                  </button>
                </div>
                <div className="builder-list-subtitle">
                  Removes props, clusters, and labels while keeping NPCs, anchors, spawn, and the structural map.
                </div>
              </div>
            </div>
          ) : null}

          <div className="builder-bottom-inventory">
            <div className="builder-bottom-inventory-header">
              <div>
                <div className="builder-section-title">Scene Inventory</div>
                <div className="builder-list-subtitle">
                  {canvasMode === "weather"
                    ? "Choose a cloud preset, then drag the placed band to set its loop position."
                    : "Assembled place kits first, then the rest of the authored scene pieces."}
                </div>
              </div>
              <div className="builder-list-subtitle">
                {canvasMode === "weather"
                  ? `${CLOUD_INVENTORY_PRESETS.length} cloud presets • ${placedSkyLayerItems.length} placed bands`
                  : `${readyBuildingItems.length} ready kits • ${sceneInventoryItems.length} scene pieces`}
              </div>
            </div>
            {canvasMode === "weather" ? (
              <>
                <div className="builder-inventory-section">
                  <div className="builder-bottom-inventory-header builder-bottom-inventory-header-tight">
                    <div>
                      <div className="builder-section-title">Cloud Library</div>
                      <div className="builder-list-subtitle">
                        One click adds a cloud band with its linked weather, ready to reposition.
                      </div>
                    </div>
                    <div className="builder-list-subtitle">{CLOUD_INVENTORY_PRESETS.length} presets</div>
                  </div>
                  <div className="builder-building-grid builder-weather-grid">
                    {CLOUD_INVENTORY_PRESETS.map((preset) => renderCloudPresetCard(preset))}
                  </div>
                </div>
                <div className="builder-inventory-section builder-inventory-section-divider">
                  <div className="builder-bottom-inventory-header builder-bottom-inventory-header-tight">
                    <div>
                      <div className="builder-section-title">Placed Sky Bands</div>
                      <div className="builder-list-subtitle">
                        These are the authored cloud bands already driving the live sky.
                      </div>
                    </div>
                    <div className="builder-list-subtitle">{placedSkyLayerItems.length} bands</div>
                  </div>
                  <div className="builder-building-grid builder-weather-grid">
                    {placedSkyLayerItems.map((item) => renderPlacedSkyLayerCard(item))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="builder-inventory-section">
                  <div className="builder-bottom-inventory-header builder-bottom-inventory-header-tight">
                    <div>
                      <div className="builder-section-title">Ready Places</div>
                      <div className="builder-list-subtitle">
                        Persistent place kits for buildings, squares, yards, and the harbor edge.
                      </div>
                    </div>
                    <div className="builder-list-subtitle">{readyBuildingItems.length} kits</div>
                  </div>
                  <div className="builder-building-grid">
                    {readyBuildingItems.map((item) => renderReadyBuildingCard(item))}
                  </div>
                </div>
                <div className="builder-inventory-section builder-inventory-section-divider">
                  <div className="builder-bottom-inventory-header builder-bottom-inventory-header-tight">
                    <div>
                      <div className="builder-section-title">Scene Pieces</div>
                      <div className="builder-list-subtitle">
                        Zones, props, labels, and supporting authored details.
                      </div>
                    </div>
                    <div className="builder-list-subtitle">{sceneInventoryItems.length} items</div>
                  </div>
                  <div className="builder-inventory-grid">
                    {sceneInventoryItems.map((item) => renderInventoryCard(item))}
                  </div>
                </div>
              </>
            )}
          </div>

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
              {selectedSkyLayer ? (
                <div className="builder-fields builder-fields-single">
                  <label>
                    <span>Sky Id</span>
                    <input
                      onChange={(event) => updateStringField("id", event.target.value)}
                      type="text"
                      value={selectedSkyLayer.id}
                    />
                  </label>
                  <label>
                    <span>Cloud Kind</span>
                    <select
                      onChange={(event) => updateStringField("cloudKind", event.target.value)}
                      value={selectedSkyLayer.cloudKind}
                    >
                      {CLOUD_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Triggered Weather</span>
                    <select
                      onChange={(event) => updateStringField("weather", event.target.value)}
                      value={selectedSkyLayer.weather}
                    >
                      {WEATHER_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Opacity</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("opacity", event.target.value)}
                      step="0.05"
                      type="number"
                      value={selectedSkyLayer.opacity}
                    />
                  </label>
                  <label>
                    <span>Speed</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("speed", event.target.value)}
                      step="1"
                      type="number"
                      value={selectedSkyLayer.speed}
                    />
                  </label>
                  <label>
                    <span>Density</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("density", event.target.value)}
                      step="0.5"
                      type="number"
                      value={selectedSkyLayer.density}
                    />
                  </label>
                  <label>
                    <span>Scale</span>
                    <input
                      onChange={(event) => updateExtendedNumberField("scale", event.target.value)}
                      step="0.05"
                      type="number"
                      value={selectedSkyLayer.scale}
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
                Export the exact scene document the game consumes, or copy a ready-to-paste module for the dedicated scene file. Use Save As Core Map in the stage toolbar to write directly to the core source file.
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

        .builder-stage-frame {
          position: relative;
          width: min(100%, 1120px);
          min-width: 0;
          flex: 0 0 auto;
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

        .builder-bottom-inventory {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-radius: 18px;
          border: 1px solid rgba(124, 141, 146, 0.14);
          background:
            radial-gradient(circle at top right, rgba(158, 177, 188, 0.07), transparent 45%),
            rgba(10, 16, 20, 0.74);
          padding: 12px;
        }

        .builder-bottom-inventory-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .builder-bottom-inventory-header-tight {
          gap: 8px;
        }

        .builder-inventory-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .builder-inventory-section-divider {
          padding-top: 4px;
          border-top: 1px solid rgba(122, 138, 145, 0.14);
        }

        .builder-building-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
        }

        .builder-weather-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .builder-inventory-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
          max-height: 268px;
          overflow: auto;
          padding-right: 4px;
        }

        .builder-inventory-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          text-transform: none;
          letter-spacing: normal;
          font-size: 13px;
          border-radius: 14px;
          padding: 10px;
          background: rgba(18, 25, 30, 0.9);
          border: 1px solid rgba(122, 138, 145, 0.18);
        }

        .builder-inventory-card:hover {
          border-color: rgba(206, 170, 113, 0.5);
          background: rgba(33, 43, 49, 0.95);
        }

        .builder-inventory-card.is-active {
          border-color: rgba(214, 176, 112, 0.64);
          background: rgba(50, 62, 68, 0.96);
        }

        .builder-inventory-card.is-cafe {
          border-color: rgba(214, 176, 112, 0.48);
          background:
            radial-gradient(circle at top right, rgba(212, 171, 103, 0.14), transparent 56%),
            rgba(24, 32, 37, 0.94);
        }

        .builder-building-card {
          min-height: 238px;
          padding: 14px;
          gap: 8px;
          background:
            linear-gradient(180deg, rgba(25, 34, 40, 0.96), rgba(15, 22, 27, 0.98)),
            rgba(18, 25, 30, 0.94);
        }

        .builder-building-card.is-cafe {
          grid-column: span 2;
          border-color: rgba(221, 182, 111, 0.58);
          background:
            radial-gradient(circle at top right, rgba(212, 171, 103, 0.18), transparent 54%),
            linear-gradient(180deg, rgba(34, 42, 36, 0.98), rgba(18, 25, 30, 0.98));
        }

        .builder-building-card.is-unplaced {
          border-style: dashed;
          border-color: rgba(136, 152, 160, 0.34);
        }

        .builder-weather-card {
          min-height: 196px;
          padding: 12px;
          gap: 8px;
          background:
            linear-gradient(180deg, rgba(22, 31, 37, 0.96), rgba(12, 18, 22, 0.96)),
            rgba(18, 25, 30, 0.94);
        }

        .builder-inventory-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 52px;
          border-radius: 10px;
          border: 1px solid rgba(122, 138, 145, 0.18);
          background:
            linear-gradient(180deg, rgba(18, 26, 31, 0.92), rgba(12, 18, 22, 0.9)),
            rgba(11, 17, 20, 0.9);
          overflow: hidden;
        }

        .builder-inventory-visual.is-building {
          height: 122px;
          border-color: rgba(158, 177, 188, 0.24);
          background:
            radial-gradient(circle at top center, rgba(104, 131, 120, 0.2), transparent 52%),
            linear-gradient(180deg, rgba(20, 30, 35, 0.94), rgba(10, 16, 20, 0.94));
        }

        .builder-building-card.is-cafe .builder-inventory-visual.is-building {
          height: 152px;
        }

        .builder-inventory-visual-weather {
          height: 88px;
          border-color: rgba(158, 177, 188, 0.22);
          background:
            linear-gradient(180deg, rgba(31, 44, 55, 0.92), rgba(17, 25, 31, 0.96)),
            rgba(13, 19, 22, 0.94);
        }

        .builder-inventory-visual svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .builder-inventory-empty {
          color: rgba(215, 226, 232, 0.7);
          font-size: 22px;
          line-height: 1;
        }

        .builder-inventory-badge {
          margin-top: 2px;
          align-self: flex-start;
          padding: 3px 7px;
          border-radius: 999px;
          border: 1px solid rgba(214, 176, 112, 0.46);
          color: rgba(249, 229, 189, 0.92);
          background: rgba(52, 41, 27, 0.74);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 9px;
          line-height: 1.2;
        }

        .builder-stage {
          width: 100%;
          min-width: 0;
          height: auto;
          border-radius: 22px;
          background: #0e171c;
          touch-action: none;
          flex: 0 0 auto;
        }

        .builder-stage-zoom {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: min(240px, calc(100% - 28px));
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(138, 154, 162, 0.22);
          background: rgba(11, 17, 21, 0.82);
          backdrop-filter: blur(14px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
        }

        .builder-stage-zoom span {
          font-size: 11px;
          line-height: 1.2;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(223, 229, 232, 0.78);
        }

        .builder-stage-zoom input {
          width: 100%;
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

        button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
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

        .builder-runtime-mirror {
          width: 100%;
          min-height: 360px;
          border-radius: 16px;
          border: 1px solid rgba(124, 141, 146, 0.24);
          background: #000;
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

          .builder-building-card.is-cafe {
            grid-column: span 1;
          }

          .builder-stage-zoom {
            top: 12px;
            right: 12px;
            width: min(220px, calc(100% - 24px));
          }
        }
      `}</style>
    </div>
  );
}
