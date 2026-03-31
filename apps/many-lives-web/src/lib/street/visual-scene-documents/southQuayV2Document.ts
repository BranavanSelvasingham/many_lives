import type {
  VisualLandmarkModuleKind,
  VisualPoint,
  VisualRect,
  VisualSceneDocument,
  VisualSceneLandmark,
  VisualSceneLocationAnchors,
} from "@/lib/street/visualScenes";

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

function moduleRect(
  bounds: VisualRect,
  x: number,
  y: number,
  width: number,
  height: number,
  radius?: number,
) {
  return box(bounds.x + x, bounds.y + y, width, height, radius);
}

const SOUTH_QUAY_V2_LANDMARK_RECTS = {
  "boarding-house": box(156, 428, 376, 304, 28),
  courtyard: box(146, 858, 360, 246, 26),
  "freight-yard": box(1270, 664, 300, 252, 24),
  "market-square": box(640, 562, 430, 352, 30),
  "moss-pier": box(1018, 1012, 650, 210, 16),
  "repair-stall": box(1188, 366, 282, 226, 24),
  "tea-house": box(248, 96, 384, 252, 26),
} as const;

const SOUTH_QUAY_V2_LANDMARKS: VisualSceneLandmark[] = [
  {
    accentColor: 0xd7bc79,
    id: "landmark-v2-tea-house",
    locationId: "tea-house",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["tea-house"],
    style: "cafe",
  },
  {
    accentColor: 0xa8c0cc,
    id: "landmark-v2-boarding-house",
    locationId: "boarding-house",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["boarding-house"],
    style: "boarding-house",
  },
  {
    accentColor: 0xd79c65,
    id: "landmark-v2-repair-stall",
    locationId: "repair-stall",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["repair-stall"],
    style: "workshop",
  },
  {
    accentColor: 0xe3d4b3,
    id: "landmark-v2-market-square",
    locationId: "market-square",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["market-square"],
    style: "square",
  },
  {
    accentColor: 0xc78c59,
    id: "landmark-v2-freight-yard",
    locationId: "freight-yard",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["freight-yard"],
    style: "yard",
  },
  {
    accentColor: 0xd0a170,
    id: "landmark-v2-moss-pier",
    locationId: "moss-pier",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS["moss-pier"],
    style: "dock",
  },
  {
    accentColor: 0xa7be96,
    id: "landmark-v2-courtyard",
    locationId: "courtyard",
    rect: SOUTH_QUAY_V2_LANDMARK_RECTS.courtyard,
    style: "courtyard",
  },
];

const SOUTH_QUAY_V2_LOCATION_ANCHORS: Record<string, VisualSceneLocationAnchors> = {
  "boarding-house": {
    door: point(344, 744),
    frontage: point(344, 724),
    highlight: box(151, 423, 386, 314, 28),
    label: point(344, 456),
    npcStands: [point(292, 788), point(404, 786)],
  },
  courtyard: {
    door: point(332, 904),
    frontage: point(332, 916),
    highlight: box(141, 853, 370, 256, 26),
    label: point(338, 1008),
    npcStands: [point(286, 962), point(382, 966)],
  },
  "freight-yard": {
    door: point(1286, 828),
    frontage: point(1254, 842),
    highlight: box(1265, 659, 310, 262, 24),
    label: point(1420, 800),
    npcStands: [point(1346, 860), point(1496, 888)],
  },
  "market-square": {
    door: point(856, 744),
    frontage: point(856, 744),
    highlight: box(635, 557, 440, 362, 30),
    label: point(856, 738),
    npcStands: [point(768, 742), point(944, 742), point(856, 806)],
  },
  "moss-pier": {
    door: point(1306, 1012),
    frontage: point(1306, 1070),
    highlight: box(1013, 1007, 660, 220, 16),
    label: point(1354, 1078),
    npcStands: [point(1448, 1080), point(1542, 1096)],
  },
  "repair-stall": {
    door: point(1328, 608),
    frontage: point(1320, 594),
    highlight: box(1183, 361, 292, 236, 24),
    label: point(1328, 392),
    npcStands: [point(1306, 634), point(1360, 628)],
  },
  "tea-house": {
    door: point(440, 354),
    frontage: point(440, 340),
    highlight: box(243, 91, 394, 262, 26),
    label: point(440, 118),
    npcStands: [point(388, 356), point(440, 352), point(494, 356)],
  },
};

const SOUTH_QUAY_V2_NPC_ANCHORS: Record<string, VisualPoint> = {
  "npc-ada": point(440, 352),
  "npc-jo": point(1238, 674),
  "npc-mara": point(292, 788),
  "npc-nia": point(1448, 1080),
  "npc-tomas": point(1496, 888),
};

function buildModules(
  locationId: string,
  bounds: VisualRect,
  modules: Array<{
    count?: number;
    height: number;
    kind: VisualLandmarkModuleKind;
    radius?: number;
    text?: string;
    variant?: string;
    width: number;
    x: number;
    y: number;
  }>,
) {
  return modules.map((module, index) => ({
    count: module.count,
    id: `${locationId}-${module.kind}-${index + 1}`,
    kind: module.kind,
    locationId,
    rect: moduleRect(
      bounds,
      module.x,
      module.y,
      module.width,
      module.height,
      module.radius,
    ),
    text: module.text,
    variant: module.variant,
  }));
}

const SOUTH_QUAY_V2_DOCUMENT = {
  backgroundColor: "#111d23",
  fringeZones: [
    {
      edge: "north",
      id: "v2-north-facade-west",
      kind: "neighbor_facade",
      rect: box(116, 76, 528, 124, 18),
    },
    {
      edge: "north",
      id: "v2-north-facade-east",
      kind: "neighbor_facade",
      rect: box(706, 80, 836, 118, 18),
    },
    {
      edge: "west",
      id: "v2-west-alley",
      kind: "alley_mouth",
      rect: box(88, 210, 126, 786, 24),
    },
    {
      edge: "east",
      id: "v2-east-side-street",
      kind: "side_street",
      rect: box(1544, 164, 208, 886, 20),
    },
    {
      edge: "south",
      id: "v2-south-quay-west",
      kind: "quay_continuation",
      rect: box(118, 1090, 830, 150, 16),
    },
    {
      edge: "south",
      id: "v2-south-quay-east",
      kind: "quay_continuation",
      rect: box(948, 1028, 830, 210, 16),
    },
  ],
  id: "south-quay-v2",
  labels: [
    { text: "South Quay", tone: "district", x: 1010, y: 164 },
    { text: "Harbor Walk", tone: "street", x: 1108, y: 968 },
    { text: "Morrow Court", tone: "street", x: 300, y: 742 },
    { text: "Lantern Row", tone: "street", x: 810, y: 498 },
    { text: "Cooper Lane", tone: "street", x: 1198, y: 474 },
    { text: "Brackenport Docks", tone: "landmark", x: 1440, y: 1186 },
  ],
  landmarkModules: [
    ...buildModules("tea-house", SOUTH_QUAY_V2_LANDMARK_RECTS["tea-house"], [
      { height: 34, kind: "roof_cap", radius: 16, variant: "verdigris", width: 328, x: 28, y: 4 },
      { height: 102, kind: "wall_band", radius: 24, variant: "cafe-ivory", width: 384, x: 0, y: 28 },
      { height: 42, kind: "awning", variant: "green-cream", width: 316, x: 34, y: 106 },
      { height: 96, kind: "wall_band", radius: 18, variant: "walnut", width: 340, x: 22, y: 146 },
      { count: 2, height: 66, kind: "window_row", radius: 12, variant: "cafe-large", width: 348, x: 18, y: 154 },
      { height: 90, kind: "entry", radius: 14, variant: "arched", width: 68, x: 158, y: 150 },
      { height: 24, kind: "terrace_rail", radius: 8, variant: "cafe", width: 316, x: 34, y: 224 },
      { height: 34, kind: "sign", radius: 12, variant: "cafe", width: 220, x: 82, y: 28 },
      { height: 18, kind: "trim", radius: 8, variant: "warm-trim", width: 348, x: 18, y: 78 },
    ]),
    ...buildModules("boarding-house", SOUTH_QUAY_V2_LANDMARK_RECTS["boarding-house"], [
      { height: 36, kind: "roof_cap", radius: 20, variant: "slate", width: 376, x: 0, y: 0 },
      { height: 126, kind: "wall_band", radius: 20, variant: "boarding-upper", width: 348, x: 14, y: 44 },
      { height: 90, kind: "wall_band", radius: 18, variant: "boarding-lower", width: 336, x: 20, y: 172 },
      { count: 5, height: 64, kind: "window_row", radius: 10, variant: "boarding-upper", width: 300, x: 38, y: 60 },
      { count: 4, height: 58, kind: "window_row", radius: 10, variant: "boarding-lower", width: 280, x: 48, y: 144 },
      { height: 86, kind: "entry", radius: 12, variant: "house-door", width: 60, x: 158, y: 202 },
      { height: 28, kind: "stoop", radius: 10, variant: "boarding", width: 92, x: 142, y: 274 },
      { height: 176, kind: "downspout", radius: 4, variant: "slate", width: 10, x: 342, y: 58 },
      { height: 18, kind: "trim", radius: 8, variant: "house-band", width: 336, x: 20, y: 128 },
    ]),
    ...buildModules("repair-stall", SOUTH_QUAY_V2_LANDMARK_RECTS["repair-stall"], [
      { height: 38, kind: "roof_cap", radius: 20, variant: "iron", width: 282, x: 0, y: 0 },
      { height: 96, kind: "wall_band", radius: 18, variant: "workshop-stone", width: 262, x: 10, y: 44 },
      { height: 92, kind: "service_bay", radius: 14, variant: "workshop-bay", width: 234, x: 24, y: 146 },
      { count: 3, height: 36, kind: "shutters", radius: 8, variant: "workshop", width: 198, x: 42, y: 74 },
      { count: 2, height: 42, kind: "window_row", radius: 8, variant: "workshop-sidelights", width: 214, x: 34, y: 184 },
      { height: 32, kind: "sign", radius: 10, variant: "workshop", width: 150, x: 66, y: 24 },
      { height: 20, kind: "trim", radius: 8, variant: "industrial-band", width: 246, x: 18, y: 116 },
    ]),
    ...buildModules("freight-yard", SOUTH_QUAY_V2_LANDMARK_RECTS["freight-yard"], [
      { height: 34, kind: "roof_cap", radius: 12, variant: "timber", width: 264, x: 18, y: 10 },
      { height: 84, kind: "wall_band", radius: 16, variant: "yard-gatehouse", width: 260, x: 20, y: 52 },
      { height: 86, kind: "service_bay", radius: 12, variant: "yard-gate", width: 228, x: 36, y: 146 },
      { count: 3, height: 34, kind: "shutters", radius: 8, variant: "yard", width: 212, x: 44, y: 74 },
      { height: 30, kind: "sign", radius: 10, variant: "yard", width: 148, x: 76, y: 24 },
      { height: 18, kind: "trim", radius: 8, variant: "yard-band", width: 252, x: 24, y: 114 },
    ]),
  ],
  landmarks: SOUTH_QUAY_V2_LANDMARKS,
  layers: {
    ground: {
      height: SOUTH_QUAY_HEIGHT,
      id: "ground",
      kind: "solid",
      width: SOUTH_QUAY_WIDTH,
      x: 0,
      y: 0,
    },
    labels: { id: "labels", kind: "objects" },
    props: { id: "props", kind: "objects" },
    structures: { id: "structures", kind: "objects" },
  },
  locationAnchors: SOUTH_QUAY_V2_LOCATION_ANCHORS,
  npcAnchors: SOUTH_QUAY_V2_NPC_ANCHORS,
  playerSpawn: point(286, 778),
  projection: {
    columnCenters: SOUTH_QUAY_COLUMNS,
    rowCenters: SOUTH_QUAY_ROWS,
  },
  propClusters: [
    {
      id: "v2-cafe-terrace",
      kind: "cafe_terrace",
      locationId: "tea-house",
      points: [point(364, 418), point(452, 414), point(536, 418)],
      rect: box(328, 394, 248, 64, 14),
    },
    {
      id: "v2-square-benches-north",
      kind: "square_bench_pair",
      locationId: "market-square",
      points: [point(768, 676), point(1004, 676)],
      rect: box(736, 640, 304, 72, 10),
    },
    {
      id: "v2-square-benches-south",
      kind: "square_bench_pair",
      locationId: "market-square",
      points: [point(768, 828), point(1004, 828)],
      rect: box(736, 792, 304, 72, 10),
    },
    {
      id: "v2-square-planters-west",
      kind: "square_planter_pair",
      locationId: "market-square",
      points: [point(708, 666), point(708, 824)],
      rect: box(676, 648, 64, 200, 10),
    },
    {
      id: "v2-square-planters-east",
      kind: "square_planter_pair",
      locationId: "market-square",
      points: [point(1072, 666), point(1072, 824)],
      rect: box(1040, 648, 64, 200, 10),
    },
    {
      id: "v2-workshop-stock",
      kind: "workshop_stock",
      locationId: "repair-stall",
      points: [point(1148, 680), point(1188, 688), point(1330, 678)],
      rect: box(1128, 650, 244, 76, 10),
    },
    {
      id: "v2-yard-service",
      kind: "yard_service",
      locationId: "courtyard",
      points: [point(256, 964), point(350, 954), point(452, 978)],
      rect: box(184, 894, 286, 132, 14),
    },
    {
      id: "v2-harbor-mooring",
      kind: "harbor_mooring",
      locationId: "moss-pier",
      points: [
        point(1130, 1094),
        point(1260, 1118),
        point(1450, 1128),
        point(1588, 1108),
      ],
      rect: box(1060, 1048, 566, 126, 12),
    },
  ],
  props: [
    { kind: "lamp", scale: 1, x: 262, y: 292 },
    { kind: "lamp", scale: 1, x: 644, y: 292 },
    { kind: "lamp", scale: 1, x: 808, y: 352 },
    { kind: "lamp", scale: 1, x: 1036, y: 352 },
    { kind: "lamp", scale: 1, x: 1216, y: 352 },
    { kind: "lamp", scale: 1, x: 1400, y: 352 },
    { kind: "lamp", scale: 1, x: 716, y: 666 },
    { kind: "lamp", scale: 1, x: 1056, y: 666 },
    { kind: "lamp", scale: 1, x: 716, y: 846 },
    { kind: "lamp", scale: 1, x: 1056, y: 846 },
    { kind: "lamp", scale: 1, x: 580, y: 962 },
    { kind: "lamp", scale: 1, x: 1212, y: 964 },
    {
      bobAmount: 5,
      kind: "boat",
      rotation: -0.14,
      scale: 1.06,
      waterRegionId: "harbor-main-v2",
      x: 1288,
      y: 1176,
    },
    {
      bobAmount: 6,
      kind: "boat",
      rotation: 0.08,
      scale: 1.12,
      waterRegionId: "harbor-main-v2",
      x: 1506,
      y: 1200,
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
  surfaceZones: [
    {
      emphasis: "medium",
      id: "v2-north-promenade",
      kind: "north_promenade",
      rect: box(168, 174, 1380, 228, 18),
    },
    {
      emphasis: "medium",
      id: "v2-main-street",
      kind: "main_street",
      rect: box(144, 414, 1428, 256, 16),
    },
    {
      emphasis: "high",
      id: "v2-west-lane",
      kind: "west_lane",
      rect: box(148, 652, 436, 188, 16),
    },
    {
      emphasis: "medium",
      id: "v2-service-lane",
      kind: "service_lane",
      rect: box(1092, 410, 480, 286, 16),
    },
    {
      emphasis: "high",
      id: "v2-square-border",
      kind: "square_border",
      rect: box(650, 542, 480, 384, 30),
    },
    {
      emphasis: "high",
      id: "v2-square-center",
      kind: "square_center",
      rect: box(714, 606, 352, 256, 24),
    },
    {
      emphasis: "medium",
      id: "v2-courtyard-ground",
      kind: "courtyard_ground",
      rect: box(166, 842, 342, 252, 22),
    },
    {
      emphasis: "medium",
      id: "v2-dock-apron",
      kind: "dock_apron",
      rect: box(828, 922, 770, 118, 14),
    },
    {
      emphasis: "high",
      id: "v2-quay-wall",
      kind: "quay_wall",
      rect: box(1006, 1028, 692, 62, 8),
    },
    {
      emphasis: "high",
      id: "v2-deep-water",
      kind: "deep_water",
      rect: box(956, 1088, 824, 232),
    },
  ],
  waterRegions: [
    {
      baseColor: 0x2a6c8a,
      crestColor: 0xd8f7ff,
      id: "harbor-main-v2",
      intensity: 1,
      rect: box(958, 1088, 824, 232),
      tag: "water_surface",
    },
    {
      baseColor: 0xebf7fb,
      crestColor: 0xffffff,
      id: "harbor-foam-v2",
      intensity: 0.95,
      rect: box(986, 1076, 756, 24),
      tag: "shore_foam",
    },
  ],
  width: SOUTH_QUAY_WIDTH,
  height: SOUTH_QUAY_HEIGHT,
} satisfies VisualSceneDocument;

export { SOUTH_QUAY_V2_DOCUMENT };
