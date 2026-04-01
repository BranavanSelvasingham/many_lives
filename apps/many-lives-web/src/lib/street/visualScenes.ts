import type { StreetGameState } from "@/lib/street/types";
import { SOUTH_QUAY_V2_DOCUMENT } from "@/lib/street/visual-scene-documents/southQuayV2Document";

export type VisualSceneId = "south-quay-v1" | "south-quay-v2";

export const VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT =
  "many-lives:visual-scene-runtime-override";

export type VisualPoint = {
  x: number;
  y: number;
};

export type VisualRect = VisualPoint & {
  height: number;
  radius?: number;
  width: number;
};

export type VisualSceneLayer =
  | {
      height: number;
      id: "ground";
      kind: "solid";
      width: number;
      x: number;
      y: number;
    }
  | {
      id: "structures" | "props" | "labels" | "weather";
      kind: "objects";
    };

export type VisualSceneCloudKind =
  | "harbor-bank"
  | "storm-front"
  | "wispy";

export type VisualSceneWeatherKind =
  | "drizzle"
  | "mist"
  | "none"
  | "rain"
  | "storm";

export type VisualSceneWaterTag =
  | "moored_boat"
  | "shore_foam"
  | "water_surface";

export type VisualTerrainKind = "land" | "water";

export type VisualSurfaceMaterialKind =
  | "bushes"
  | "grass"
  | "paved_asphalt"
  | "tiled_stone_road"
  | "trees"
  | "walkway";

export type VisualSceneTerrainDraft = {
  baseKind: VisualTerrainKind;
  cellSize: number;
  overrides: Array<{
    col: number;
    kind: VisualTerrainKind;
    row: number;
  }>;
};

export type VisualSceneSurfaceDraft = {
  baseKind: VisualSurfaceMaterialKind;
  cellSize: number;
  overrides: Array<{
    col: number;
    kind: VisualSurfaceMaterialKind;
    row: number;
  }>;
};

export type VisualSceneLandmarkStyle =
  | "boarding-house"
  | "cafe"
  | "courtyard"
  | "dock"
  | "square"
  | "workshop"
  | "yard";

export type VisualSceneLocationAnchors = {
  door: VisualPoint;
  frontage: VisualPoint;
  highlight: VisualRect;
  label: VisualPoint;
  npcStands?: VisualPoint[];
};

export type VisualSceneLandmark = {
  accentColor: number;
  id: string;
  locationId: string;
  rect: VisualRect;
  style: VisualSceneLandmarkStyle;
};

export type VisualSceneProp =
  | {
      kind: "bench" | "planter" | "terrace-table";
      rotation?: number;
      scale?: number;
      x: number;
      y: number;
    }
  | {
      bobAmount?: number;
      kind: "boat";
      rotation?: number;
      scale?: number;
      waterRegionId: string;
      x: number;
      y: number;
    }
  | {
      kind: "lamp";
      scale?: number;
      x: number;
      y: number;
    };

export type VisualSurfaceZoneKind =
  | "courtyard_ground"
  | "deep_water"
  | "dock_apron"
  | "main_street"
  | "north_promenade"
  | "quay_wall"
  | "service_lane"
  | "square_border"
  | "square_center"
  | "west_lane";

export type VisualSurfaceZone = {
  emphasis?: "high" | "low" | "medium";
  id: string;
  kind: VisualSurfaceZoneKind;
  rect: VisualRect;
};

export type VisualFringeZoneEdge = "east" | "north" | "south" | "west";

export type VisualFringeZoneKind =
  | "alley_mouth"
  | "neighbor_facade"
  | "quay_continuation"
  | "side_street";

export type VisualFringeZone = {
  edge: VisualFringeZoneEdge;
  id: string;
  kind: VisualFringeZoneKind;
  rect: VisualRect;
};

export type VisualLandmarkModuleKind =
  | "awning"
  | "downspout"
  | "entry"
  | "roof_cap"
  | "service_bay"
  | "shutters"
  | "sign"
  | "stoop"
  | "terrace_rail"
  | "trim"
  | "wall_band"
  | "window_row";

export type VisualLandmarkModule = {
  count?: number;
  id: string;
  kind: VisualLandmarkModuleKind;
  locationId: string;
  rect: VisualRect;
  text?: string;
  variant?: string;
};

export type VisualPropClusterKind =
  | "cafe_terrace"
  | "harbor_mooring"
  | "square_bench_pair"
  | "square_planter_pair"
  | "workshop_stock"
  | "yard_service";

export type VisualPropCluster = {
  id: string;
  kind: VisualPropClusterKind;
  locationId?: string;
  points?: VisualPoint[];
  rect: VisualRect;
};

export type VisualSceneWaterRegion = {
  baseColor: number;
  crestColor: number;
  id: string;
  intensity: number;
  rect: VisualRect;
  tag: VisualSceneWaterTag;
};

export type VisualSceneProjection = {
  columnCenters: number[];
  rowCenters: number[];
};

export type VisualSceneSkyLayer = {
  cloudKind: VisualSceneCloudKind;
  density: number;
  id: string;
  opacity: number;
  rect: VisualRect;
  scale: number;
  speed: number;
  weather: VisualSceneWeatherKind;
};

export type VisualScene = {
  backgroundColor: string;
  fringeZones: VisualFringeZone[];
  id: VisualSceneId;
  labels: Array<{
    text: string;
    tone: "district" | "landmark" | "street";
    x: number;
    y: number;
  }>;
  landmarkModules: VisualLandmarkModule[];
  landmarks: VisualSceneLandmark[];
  layers: {
    ground: VisualSceneLayer;
    labels: VisualSceneLayer;
    props: VisualSceneLayer;
    structures: VisualSceneLayer;
    weather: VisualSceneLayer;
  };
  locationAnchors: Record<string, VisualSceneLocationAnchors>;
  npcAnchors: Record<string, VisualPoint>;
  playerSpawn: VisualPoint;
  projection: VisualSceneProjection;
  propClusters: VisualPropCluster[];
  props: VisualSceneProp[];
  referencePlate: {
    alpha: number;
    height: number;
    src: string;
    width: number;
    x: number;
    y: number;
  };
  skyLayers: VisualSceneSkyLayer[];
  surfaceZones: VisualSurfaceZone[];
  surfaceDraft?: VisualSceneSurfaceDraft;
  terrainDraft?: VisualSceneTerrainDraft;
  waterRegions: VisualSceneWaterRegion[];
  width: number;
  height: number;
};

export type VisualSceneDocument = VisualScene;

export type VisualSceneValidationWarning = {
  code:
    | "anchor-near-prop"
    | "boat-missing-water-region"
    | "edge-gap"
    | "landmark-overlap"
    | "missing-fringe-edge"
    | "missing-landmark-read"
    | "missing-required-landmark";
  message: string;
};

function getVisualSceneRuntimeOverrideStorageKey(sceneId: string) {
  return `many-lives.visual-scene-runtime.${sceneId}`;
}

function getVisualSceneRuntimeVersionStorageKey(sceneId: string) {
  return `many-lives.visual-scene-runtime-version.${sceneId}`;
}

const SOUTH_QUAY_COLUMNS = [
  126, 182, 240, 298, 364, 432, 500, 568, 636, 704, 776, 848, 920, 992, 1064,
  1140, 1216, 1292, 1368, 1444, 1520, 1596, 1672, 1748,
];

const SOUTH_QUAY_ROWS = [
  116, 166, 218, 270, 330, 392, 456, 520, 586, 654, 722, 790, 860, 930, 1002,
  1074, 1146, 1218,
];

const SOUTH_QUAY_WIDTH = 1872;
const SOUTH_QUAY_HEIGHT = 1320;
const SOUTH_QUAY_REFERENCE_SRC =
  "/assets/visual-scenes/south-quay-v1/reference-citymap.png";

const REQUIRED_SOUTH_QUAY_LANDMARKS = [
  "boarding-house",
  "courtyard",
  "freight-yard",
  "market-square",
  "moss-pier",
  "repair-stall",
  "tea-house",
] as const;

function box(
  x: number,
  y: number,
  width: number,
  height: number,
  radius?: number,
): VisualRect {
  return radius === undefined ? { x, y, width, height } : { x, y, width, height, radius };
}

function point(x: number, y: number): VisualPoint {
  return { x, y };
}

const SOUTH_QUAY_V1_LANDMARKS: VisualSceneLandmark[] = [
  {
    accentColor: 0xd7bc79,
    id: "landmark-tea-house",
    locationId: "tea-house",
    rect: box(302, 136, 310, 210, 18),
    style: "cafe",
  },
  {
    accentColor: 0xa8c0cc,
    id: "landmark-boarding-house",
    locationId: "boarding-house",
    rect: box(206, 412, 304, 234, 18),
    style: "boarding-house",
  },
  {
    accentColor: 0xd79c65,
    id: "landmark-repair-stall",
    locationId: "repair-stall",
    rect: box(1128, 430, 232, 198, 16),
    style: "workshop",
  },
  {
    accentColor: 0xe3d4b3,
    id: "landmark-market-square",
    locationId: "market-square",
    rect: box(724, 628, 340, 270, 22),
    style: "square",
  },
  {
    accentColor: 0xc78c59,
    id: "landmark-freight-yard",
    locationId: "freight-yard",
    rect: box(1250, 652, 298, 260, 18),
    style: "yard",
  },
  {
    accentColor: 0xd0a170,
    id: "landmark-moss-pier",
    locationId: "moss-pier",
    rect: box(1094, 1008, 520, 170, 12),
    style: "dock",
  },
  {
    accentColor: 0xa7be96,
    id: "landmark-courtyard",
    locationId: "courtyard",
    rect: box(212, 830, 286, 220, 18),
    style: "courtyard",
  },
];

const SOUTH_QUAY_V1_LOCATION_ANCHORS: Record<string, VisualSceneLocationAnchors> = {
  "boarding-house": {
    door: point(360, 648),
    frontage: point(360, 622),
    highlight: box(201, 407, 314, 244, 18),
    label: point(360, 432),
    npcStands: [point(320, 646), point(394, 646)],
  },
  courtyard: {
    door: point(356, 822),
    frontage: point(356, 850),
    highlight: box(207, 825, 296, 230, 18),
    label: point(358, 944),
  },
  "freight-yard": {
    door: point(1254, 786),
    frontage: point(1224, 792),
    highlight: box(1245, 647, 308, 270, 18),
    label: point(1398, 772),
    npcStands: [point(1290, 808), point(1444, 842)],
  },
  "market-square": {
    door: point(890, 756),
    frontage: point(890, 756),
    highlight: box(719, 623, 350, 280, 24),
    label: point(892, 742),
    npcStands: [point(846, 744), point(934, 744), point(886, 802)],
  },
  "moss-pier": {
    door: point(1316, 1008),
    frontage: point(1316, 1032),
    highlight: box(1089, 1003, 530, 180, 12),
    label: point(1358, 1042),
    npcStands: [point(1452, 1040)],
  },
  "repair-stall": {
    door: point(1238, 630),
    frontage: point(1238, 618),
    highlight: box(1123, 425, 242, 208, 16),
    label: point(1232, 446),
    npcStands: [point(1224, 654)],
  },
  "tea-house": {
    door: point(470, 346),
    frontage: point(470, 332),
    highlight: box(297, 131, 320, 220, 18),
    label: point(470, 170),
    npcStands: [point(416, 360), point(518, 360)],
  },
};

const SOUTH_QUAY_V1_NPC_ANCHORS: Record<string, VisualPoint> = {
  "npc-ada": point(486, 360),
  "npc-jo": point(1226, 652),
  "npc-mara": point(324, 646),
  "npc-nia": point(1370, 1044),
  "npc-tomas": point(1482, 846),
};

const SOUTH_QUAY_V1: VisualScene = {
  backgroundColor: "#111d23",
  fringeZones: [],
  id: "south-quay-v1",
  labels: [
    { text: "South Quay", tone: "district", x: 936, y: 188 },
    { text: "Harbor Walk", tone: "street", x: 1018, y: 938 },
    { text: "Morrow Court", tone: "street", x: 318, y: 710 },
    { text: "Lantern Row", tone: "street", x: 812, y: 520 },
    { text: "Cooper Lane", tone: "street", x: 1176, y: 510 },
    { text: "Brackenport Docks", tone: "landmark", x: 1382, y: 1112 },
  ],
  landmarkModules: [],
  landmarks: SOUTH_QUAY_V1_LANDMARKS,
  layers: {
    ground: { height: SOUTH_QUAY_HEIGHT, id: "ground", kind: "solid", width: SOUTH_QUAY_WIDTH, x: 0, y: 0 },
    labels: { id: "labels", kind: "objects" },
    props: { id: "props", kind: "objects" },
    structures: { id: "structures", kind: "objects" },
    weather: { id: "weather", kind: "objects" },
  },
  locationAnchors: SOUTH_QUAY_V1_LOCATION_ANCHORS,
  npcAnchors: SOUTH_QUAY_V1_NPC_ANCHORS,
  playerSpawn: point(270, 638),
  projection: {
    columnCenters: SOUTH_QUAY_COLUMNS,
    rowCenters: SOUTH_QUAY_ROWS,
  },
  propClusters: [],
  props: [
    { kind: "lamp", scale: 1, x: 246, y: 286 },
    { kind: "lamp", scale: 1, x: 610, y: 300 },
    { kind: "lamp", scale: 1, x: 742, y: 356 },
    { kind: "lamp", scale: 1, x: 1004, y: 346 },
    { kind: "lamp", scale: 1, x: 1158, y: 350 },
    { kind: "lamp", scale: 1, x: 1312, y: 350 },
    { kind: "lamp", scale: 1, x: 648, y: 654 },
    { kind: "lamp", scale: 1, x: 1116, y: 654 },
    { kind: "lamp", scale: 1, x: 786, y: 930 },
    { kind: "lamp", scale: 1, x: 982, y: 930 },
    { kind: "bench", x: 822, y: 706 },
    { kind: "bench", rotation: Math.PI / 2, x: 882, y: 794 },
    { kind: "bench", x: 962, y: 706 },
    { kind: "planter", x: 760, y: 856 },
    { kind: "planter", x: 1020, y: 856 },
    { kind: "planter", x: 392, y: 384 },
    { kind: "planter", x: 558, y: 384 },
    { kind: "planter", x: 264, y: 1014 },
    { kind: "planter", x: 430, y: 1014 },
    { kind: "terrace-table", x: 378, y: 382 },
    { kind: "terrace-table", x: 454, y: 394 },
    { kind: "terrace-table", x: 530, y: 382 },
    {
      bobAmount: 5,
      kind: "boat",
      rotation: -0.12,
      scale: 1,
      waterRegionId: "harbor-main",
      x: 1296,
      y: 1160,
    },
    {
      bobAmount: 6,
      kind: "boat",
      rotation: 0.08,
      scale: 1.06,
      waterRegionId: "harbor-main",
      x: 1484,
      y: 1188,
    },
  ],
  referencePlate: {
    alpha: 0,
    height: 1024,
    src: SOUTH_QUAY_REFERENCE_SRC,
    width: 1536,
    x: 184,
    y: 120,
  },
  skyLayers: [],
  surfaceZones: [],
  waterRegions: [
    {
      baseColor: 0x2c6b87,
      crestColor: 0xd8f4fb,
      id: "harbor-main",
      intensity: 1,
      rect: box(980, 1102, 828, 218),
      tag: "water_surface",
    },
    {
      baseColor: 0xe9f5fb,
      crestColor: 0xffffff,
      id: "harbor-foam",
      intensity: 0.9,
      rect: box(998, 1098, 808, 26),
      tag: "shore_foam",
    },
  ],
  width: SOUTH_QUAY_WIDTH,
  height: SOUTH_QUAY_HEIGHT,
};

const SOUTH_QUAY_V2: VisualSceneDocument = SOUTH_QUAY_V2_DOCUMENT;

const VISUAL_SCENES: Record<VisualSceneId, VisualScene> = {
  "south-quay-v1": SOUTH_QUAY_V1,
  "south-quay-v2": SOUTH_QUAY_V2,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeSceneDocument(
  baseScene: VisualSceneDocument,
  candidate: unknown,
): VisualSceneDocument {
  if (!isPlainRecord(candidate)) {
    throw new Error("Imported scene document must be a JSON object.");
  }

  const merged = {
    ...cloneVisualSceneDocument(baseScene),
    ...candidate,
  } as VisualSceneDocument;

  if (isPlainRecord(candidate.layers)) {
    merged.layers = {
      ...baseScene.layers,
      ...candidate.layers,
    } as VisualSceneDocument["layers"];
  }

  if (isPlainRecord(candidate.projection)) {
    merged.projection = {
      ...baseScene.projection,
      ...candidate.projection,
    } as VisualSceneDocument["projection"];
  }

  if (isPlainRecord(candidate.referencePlate)) {
    merged.referencePlate = {
      ...baseScene.referencePlate,
      ...candidate.referencePlate,
    } as VisualSceneDocument["referencePlate"];
  }

  return merged;
}

function assertSceneDocumentShape(scene: VisualSceneDocument) {
  if (typeof scene.id !== "string") {
    throw new Error("Scene document is missing an id.");
  }

  if (
    !Array.isArray(scene.landmarks) ||
    !Array.isArray(scene.surfaceZones) ||
    !Array.isArray(scene.skyLayers)
  ) {
    throw new Error("Scene document is missing required scene arrays.");
  }

  if (!scene.layers || !scene.projection || !scene.referencePlate) {
    throw new Error("Scene document is missing runtime metadata.");
  }
}

function expandRect(rect: VisualRect, padding: number): VisualRect {
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

function getPropSafetyRadius(prop: VisualSceneProp) {
  switch (prop.kind) {
    case "boat":
      return 38 * (prop.scale ?? 1);
    case "lamp":
      return 20 * (prop.scale ?? 1);
    case "bench":
      return 28 * (prop.scale ?? 1);
    case "planter":
      return 22 * (prop.scale ?? 1);
    case "terrace-table":
      return 24 * (prop.scale ?? 1);
    default:
      return 18;
  }
}

function mergeSegments(segments: Array<[number, number]>) {
  if (segments.length === 0) {
    return 0;
  }

  const sorted = [...segments].sort((left, right) => left[0] - right[0]);
  let [currentStart, currentEnd] = sorted[0];
  let covered = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    const [start, end] = sorted[index];
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }

    covered += currentEnd - currentStart;
    currentStart = start;
    currentEnd = end;
  }

  covered += currentEnd - currentStart;
  return covered;
}

function getEdgeCoverageRatio(scene: VisualSceneDocument, edge: VisualFringeZoneEdge) {
  const segments = scene.fringeZones
    .filter((zone) => zone.edge === edge)
    .map((zone) =>
      edge === "north" || edge === "south"
        ? [zone.rect.x, zone.rect.x + zone.rect.width]
        : [zone.rect.y, zone.rect.y + zone.rect.height],
    ) as Array<[number, number]>;

  const total = mergeSegments(segments);
  const span = edge === "north" || edge === "south" ? scene.width : scene.height;
  return span === 0 ? 0 : total / span;
}

function locationHasModuleKinds(
  scene: VisualSceneDocument,
  locationId: string,
  kinds: VisualLandmarkModuleKind[],
) {
  const moduleKinds = new Set(
    scene.landmarkModules
      .filter((module) => module.locationId === locationId)
      .map((module) => module.kind),
  );

  return kinds.every((kind) => moduleKinds.has(kind));
}

function locationHasClusterKind(
  scene: VisualSceneDocument,
  locationId: string,
  kind: VisualPropClusterKind,
) {
  return scene.propClusters.some(
    (cluster) => cluster.locationId === locationId && cluster.kind === kind,
  );
}

export function cloneVisualSceneDocument<T extends VisualSceneDocument>(scene: T): T {
  return JSON.parse(JSON.stringify(scene)) as T;
}

export function serializeVisualSceneDocument(scene: VisualSceneDocument) {
  return JSON.stringify(scene, null, 2);
}

export function buildVisualSceneModuleSource(
  constantName: string,
  scene: VisualSceneDocument,
) {
  return [
    'import type { VisualSceneDocument } from "@/lib/street/visualScenes";',
    "",
    `const ${constantName} = ${serializeVisualSceneDocument(scene)} satisfies VisualSceneDocument;`,
    "",
    `export { ${constantName} };`,
    "",
  ].join("\n");
}

export function parseVisualSceneDocument(
  rawText: string,
  fallbackScene?: VisualSceneDocument,
) {
  const parsed = JSON.parse(rawText);
  const scene = fallbackScene ? mergeSceneDocument(fallbackScene, parsed) : (parsed as VisualSceneDocument);
  assertSceneDocumentShape(scene);
  return scene;
}

export function getVisualSceneDocument(sceneId?: string | null) {
  if (!sceneId) {
    return null;
  }

  return VISUAL_SCENES[sceneId as VisualSceneId] ?? null;
}

function getRuntimeVisualSceneOverride(sceneId?: string | null) {
  if (!sceneId || typeof window === "undefined") {
    return null;
  }

  const fallbackScene = getVisualSceneDocument(sceneId);
  const raw = window.localStorage.getItem(
    getVisualSceneRuntimeOverrideStorageKey(sceneId),
  );
  if (!raw) {
    return null;
  }

  try {
    return parseVisualSceneDocument(raw, fallbackScene ?? undefined);
  } catch {
    return null;
  }
}

export function getVisualSceneRuntimeRevision(sceneId?: string | null) {
  if (!sceneId || typeof window === "undefined") {
    return "file";
  }

  return (
    window.localStorage.getItem(
      getVisualSceneRuntimeVersionStorageKey(sceneId),
    ) ?? "file"
  );
}

export function saveVisualSceneRuntimeOverride(scene: VisualSceneDocument) {
  if (typeof window === "undefined") {
    return false;
  }

  const version = String(Date.now());
  window.localStorage.setItem(
    getVisualSceneRuntimeOverrideStorageKey(scene.id),
    serializeVisualSceneDocument(scene),
  );
  window.localStorage.setItem(
    getVisualSceneRuntimeVersionStorageKey(scene.id),
    version,
  );
  window.dispatchEvent(
    new CustomEvent(VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT, {
      detail: { sceneId: scene.id, version },
    }),
  );
  return true;
}

export function clearVisualSceneRuntimeOverride(sceneId: VisualSceneId) {
  if (typeof window === "undefined") {
    return false;
  }

  const version = String(Date.now());
  window.localStorage.removeItem(
    getVisualSceneRuntimeOverrideStorageKey(sceneId),
  );
  window.localStorage.setItem(
    getVisualSceneRuntimeVersionStorageKey(sceneId),
    version,
  );
  window.dispatchEvent(
    new CustomEvent(VISUAL_SCENE_RUNTIME_OVERRIDE_EVENT, {
      detail: { sceneId, version },
    }),
  );
  return true;
}

export function collectVisualSceneWarnings(
  scene: VisualSceneDocument,
): VisualSceneValidationWarning[] {
  const warnings: VisualSceneValidationWarning[] = [];

  for (const locationId of REQUIRED_SOUTH_QUAY_LANDMARKS) {
    if (!scene.landmarks.some((landmark) => landmark.locationId === locationId)) {
      warnings.push({
        code: "missing-required-landmark",
        message: `Missing landmark record for ${locationId}.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < scene.landmarks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < scene.landmarks.length; rightIndex += 1) {
      const left = scene.landmarks[leftIndex];
      const right = scene.landmarks[rightIndex];
      if (rectsOverlapWithPadding(left.rect, right.rect, 18)) {
        warnings.push({
          code: "landmark-overlap",
          message: `${left.locationId} and ${right.locationId} are too close together.`,
        });
      }
    }
  }

  for (const edge of ["north", "south", "east", "west"] as const) {
    const edgeZones = scene.fringeZones.filter((zone) => zone.edge === edge);
    if (edgeZones.length === 0) {
      warnings.push({
        code: "missing-fringe-edge",
        message: `Missing fringe coverage for the ${edge} edge.`,
      });
      continue;
    }

    const ratio = getEdgeCoverageRatio(scene, edge);
    const minimum = edge === "north" || edge === "south" ? 0.55 : 0.3;
    if (ratio < minimum) {
      warnings.push({
        code: "edge-gap",
        message: `The ${edge} edge still has visible dark/empty gaps.`,
      });
    }
  }

  const locationReadChecks: Array<{
    locationId: string;
    message: string;
    test: boolean;
  }> = [
    {
      locationId: "tea-house",
      message: "Kettle & Lamp is missing cafe frontage cues.",
      test:
        locationHasModuleKinds(scene, "tea-house", [
          "awning",
          "entry",
          "sign",
          "terrace_rail",
          "window_row",
        ]) && locationHasClusterKind(scene, "tea-house", "cafe_terrace"),
    },
    {
      locationId: "boarding-house",
      message: "Morrow House is missing boarding-house facade cues.",
      test:
        locationHasModuleKinds(scene, "boarding-house", [
          "entry",
          "stoop",
          "window_row",
        ]),
    },
    {
      locationId: "repair-stall",
      message: "Mercer Repairs is missing workshop frontage cues.",
      test:
        locationHasModuleKinds(scene, "repair-stall", [
          "service_bay",
          "shutters",
          "sign",
        ]) && locationHasClusterKind(scene, "repair-stall", "workshop_stock"),
    },
    {
      locationId: "market-square",
      message: "Quay Square still lacks square furniture reads.",
      test:
        locationHasClusterKind(scene, "market-square", "square_bench_pair") &&
        locationHasClusterKind(scene, "market-square", "square_planter_pair"),
    },
    {
      locationId: "courtyard",
      message: "Morrow Yard is missing service-yard cues.",
      test: locationHasClusterKind(scene, "courtyard", "yard_service"),
    },
    {
      locationId: "moss-pier",
      message: "Pilgrim Slip is missing harbor edge cues.",
      test:
        locationHasClusterKind(scene, "moss-pier", "harbor_mooring") &&
        scene.waterRegions.some((region) => region.tag === "water_surface"),
    },
  ];

  for (const check of locationReadChecks) {
    if (!check.test) {
      warnings.push({
        code: "missing-landmark-read",
        message: check.message,
      });
    }
  }

  const anchorPoints: Array<{ id: string; point: VisualPoint }> = [
    { id: "player spawn", point: scene.playerSpawn },
    ...Object.entries(scene.npcAnchors).map(([id, point]) => ({ id, point })),
  ];

  for (const { id, point } of anchorPoints) {
    const collidesWithCluster = scene.propClusters.some((cluster) =>
      pointInsideRect(point, expandRect(cluster.rect, 10)),
    );
    const collidesWithProp = scene.props.some(
      (prop) => Math.hypot(point.x - prop.x, point.y - prop.y) < getPropSafetyRadius(prop),
    );

    if (collidesWithCluster || collidesWithProp) {
      warnings.push({
        code: "anchor-near-prop",
        message: `${id} is landing inside or too close to furniture/props.`,
      });
    }
  }

  const waterRegionIds = new Set(scene.waterRegions.map((region) => region.id));
  for (const prop of scene.props) {
    if (prop.kind === "boat" && !waterRegionIds.has(prop.waterRegionId)) {
      warnings.push({
        code: "boat-missing-water-region",
        message: `Boat at ${Math.round(prop.x)},${Math.round(prop.y)} is missing a valid water region.`,
      });
    }
  }

  return warnings;
}

function interpolateAnchors(anchors: number[], value: number) {
  if (anchors.length === 0) {
    return 0;
  }

  if (anchors.length === 1) {
    return anchors[0];
  }

  if (value <= 0) {
    const firstGap = anchors[1] - anchors[0];
    return anchors[0] + value * firstGap;
  }

  if (value >= anchors.length - 1) {
    const lastIndex = anchors.length - 1;
    const lastGap = anchors[lastIndex] - anchors[lastIndex - 1];
    return anchors[lastIndex] + (value - lastIndex) * lastGap;
  }

  const lowerIndex = Math.floor(value);
  const upperIndex = Math.min(lowerIndex + 1, anchors.length - 1);
  const localProgress = value - lowerIndex;
  const lower = anchors[lowerIndex];
  const upper = anchors[upperIndex];
  return lower + (upper - lower) * localProgress;
}

export function getVisualScene(sceneId?: string | null) {
  return getRuntimeVisualSceneOverride(sceneId) ?? getVisualSceneDocument(sceneId);
}

export function projectVisualScenePoint(scene: VisualScene, point: VisualPoint) {
  return {
    x: interpolateAnchors(scene.projection.columnCenters, point.x),
    y: interpolateAnchors(scene.projection.rowCenters, point.y),
  };
}

export function resolveVisualSceneTargetTile(
  scene: VisualScene,
  game: StreetGameState,
  worldX: number,
  worldY: number,
) {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestTile: { x: number; y: number } | null = null;

  for (const tile of game.map.tiles) {
    if (!tile.walkable) {
      continue;
    }

    const point = projectVisualScenePoint(scene, {
      x: tile.x + 0.5,
      y: tile.y + 0.5,
    });
    const distance = Math.hypot(worldX - point.x, worldY - point.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTile = { x: tile.x, y: tile.y };
    }
  }

  return bestDistance <= 92 ? bestTile : null;
}

function rectsOverlapWithPadding(
  left: VisualRect,
  right: VisualRect,
  padding: number,
) {
  return !(
    left.x + left.width + padding <= right.x ||
    right.x + right.width + padding <= left.x ||
    left.y + left.height + padding <= right.y ||
    right.y + right.height + padding <= left.y
  );
}

export function validateVisualSceneAgainstGame(
  scene: VisualScene,
  game: StreetGameState,
) {
  const locationIds = new Set(game.locations.map((location) => location.id));

  for (const locationId of REQUIRED_SOUTH_QUAY_LANDMARKS) {
    if (!locationIds.has(locationId)) {
      throw new Error(`Visual scene ${scene.id} is missing sim location ${locationId}.`);
    }

    if (!(locationId in scene.locationAnchors)) {
      throw new Error(`Visual scene ${scene.id} is missing anchors for ${locationId}.`);
    }

    if (!scene.landmarks.some((landmark) => landmark.locationId === locationId)) {
      throw new Error(
        `Visual scene ${scene.id} is missing a landmark record for ${locationId}.`,
      );
    }
  }

  const projectedWalkableTiles = game.map.tiles.filter((tile) => tile.walkable);
  for (const tile of projectedWalkableTiles) {
    const projectedPoint = projectVisualScenePoint(scene, {
      x: tile.x + 0.5,
      y: tile.y + 0.5,
    });

    if (
      projectedPoint.x < 0 ||
      projectedPoint.y < 0 ||
      projectedPoint.x > scene.width ||
      projectedPoint.y > scene.height
    ) {
      throw new Error(
        `Walkable tile ${tile.x},${tile.y} projects outside scene ${scene.id}.`,
      );
    }
  }

  if (
    scene.layers.ground.kind !== "solid" ||
    scene.layers.ground.x !== 0 ||
    scene.layers.ground.y !== 0 ||
    scene.layers.ground.width < scene.width ||
    scene.layers.ground.height < scene.height
  ) {
    throw new Error(`Visual scene ${scene.id} does not fully cover its edges.`);
  }

  if (scene.id !== "south-quay-v2") {
    return;
  }
}
