export type SouthQuayReferenceCallout = {
  id: string;
  label: string;
  normalizedBounds: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  notes: string[];
};

export type SouthQuayZoneId =
  | "north-row"
  | "main-street"
  | "quay-square"
  | "yard-edge"
  | "waterfront";

export type SouthQuayLandmarkId =
  | "tea-house"
  | "boarding-house"
  | "repair-stall"
  | "market-square"
  | "freight-yard"
  | "moss-pier"
  | "courtyard";

export type SouthQuayAssetIntent =
  | "boarding_frontage"
  | "cast_iron_lamp"
  | "dock_edge"
  | "eatery_frontage"
  | "menu_board"
  | "planter_box"
  | "quay_paving"
  | "row_boat"
  | "square_paving"
  | "terrace_table"
  | "workshop_frontage";

export interface SouthQuayLandmarkPlan {
  id: SouthQuayLandmarkId;
  mapFootprint: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  mustAvoid: string[];
  mustReadAs: string;
  mustShow: string[];
  name: string;
  primaryZone: SouthQuayZoneId;
}

export interface SouthQuayZonePlan {
  id: SouthQuayZoneId;
  notes: string[];
  read: string;
}

export const SOUTH_QUAY_VISUAL_PLAN = {
  definitionOfDone: [
    "Landmarks read by purpose before label.",
    "The center reads as a civic square.",
    "The south edge reads as a dock and water boundary.",
    "Fringe space reads as neighboring town fabric instead of darkness.",
    "Lamps, tables, benches, and planters remain legible at gameplay zoom.",
  ],
  deliveryOrder: [
    "Replace renderer-first guessing with authored zone and landmark constraints.",
    "Use the zone plan to rebuild footprints, streets, square, and waterfront relationships.",
    "Map semantic asset intents to Kenney tiles and custom overlays.",
    "Only then do style tuning, animation tuning, and label polish.",
  ],
  edgeTreatment: {
    east: "Neighbor blocks and side-street continuation, not empty roof void.",
    north: "Additional town mass and rooflines behind the primary play street.",
    south: "Dock edge, quay timber, boats, and animated water.",
    west: "Domestic/service block continuation and secondary frontage mass.",
  },
  landmarkPlan: [
    {
      id: "tea-house",
      mapFootprint: { height: 3, width: 4, x: 4, y: 1 },
      mustAvoid: ["generic storefront", "roof-only silhouette", "empty frontage"],
      mustReadAs: "European cafe / restaurant",
      mustShow: [
        "outdoor tables",
        "menu board",
        "warm windows",
        "awning",
        "planted frontage",
        "visible entry",
      ],
      name: "Kettle & Lamp",
      primaryZone: "north-row",
    },
    {
      id: "boarding-house",
      mapFootprint: { height: 3, width: 5, x: 1, y: 6 },
      mustAvoid: ["retail cues", "terrace dining", "oversized signage"],
      mustReadAs: "modest boarding house",
      mustShow: ["stoop", "domestic window rhythm", "keeper-facing threshold"],
      name: "Morrow House",
      primaryZone: "main-street",
    },
    {
      id: "repair-stall",
      mapFootprint: { height: 3, width: 3, x: 15, y: 6 },
      mustAvoid: ["residential rhythm", "cafe furniture"],
      mustReadAs: "repair workshop",
      mustShow: ["service frontage", "tools or stock outside", "sturdier material language"],
      name: "Mercer Repairs",
      primaryZone: "main-street",
    },
    {
      id: "market-square",
      mapFootprint: { height: 4, width: 5, x: 10, y: 9 },
      mustAvoid: ["empty plot read", "yard clutter"],
      mustReadAs: "civic square",
      mustShow: ["paving field", "benches", "lamps", "planters", "central focal point"],
      name: "Quay Square",
      primaryZone: "quay-square",
    },
    {
      id: "freight-yard",
      mapFootprint: { height: 4, width: 5, x: 18, y: 9 },
      mustAvoid: ["polished civic language", "residential cues"],
      mustReadAs: "working yard",
      mustShow: ["service gate", "crates", "cart traffic", "rougher ground"],
      name: "North Crane Yard",
      primaryZone: "yard-edge",
    },
    {
      id: "moss-pier",
      mapFootprint: { height: 3, width: 9, x: 15, y: 14 },
      mustAvoid: ["featureless brown slab", "hard cutoff at map edge"],
      mustReadAs: "dock / harbor edge",
      mustShow: ["timber edge", "bollards", "boats", "water motion", "mooring hardware"],
      name: "Pilgrim Slip",
      primaryZone: "waterfront",
    },
    {
      id: "courtyard",
      mapFootprint: { height: 3, width: 5, x: 1, y: 12 },
      mustAvoid: ["plaza symmetry", "retail frontage"],
      mustReadAs: "domestic service yard",
      mustShow: ["pump", "laundry", "enclosed utility space"],
      name: "Morrow Yard",
      primaryZone: "yard-edge",
    },
  ] satisfies SouthQuayLandmarkPlan[],
  reference: {
    localImagePath: "/Users/branavan/Downloads/image-citymap.png",
    title: "Brackenport waterfront town reference",
    translationNote:
      "Translate the composition language and landmark readability, not the exact named places.",
  },
  referenceCallouts: [
    {
      id: "ref-header",
      label: "Town identity header",
      normalizedBounds: { h: 0.13, w: 0.23, x: 0.0, y: 0.0 },
      notes: ["Clear district naming.", "Strong framing but not huge HUD intrusion."],
    },
    {
      id: "ref-cafe",
      label: "Upper-left cafe block",
      normalizedBounds: { h: 0.2, w: 0.18, x: 0.2, y: 0.08 },
      notes: ["Restaurant read from facade alone.", "Terrace and awning matter more than label."],
    },
    {
      id: "ref-square",
      label: "Central civic square",
      normalizedBounds: { h: 0.2, w: 0.18, x: 0.43, y: 0.42 },
      notes: ["This is the compositional anchor.", "Paving and furniture define the center."],
    },
    {
      id: "ref-workshop",
      label: "Mid-right workshop frontage",
      normalizedBounds: { h: 0.15, w: 0.14, x: 0.56, y: 0.32 },
      notes: ["Service character is visible in the building frontage.", "Should not read as cafe or home."],
    },
    {
      id: "ref-waterfront",
      label: "Lower harbor edge",
      normalizedBounds: { h: 0.22, w: 0.36, x: 0.54, y: 0.58 },
      notes: ["The town meets water with a real edge condition.", "Dock hardware and boats sell the space."],
    },
    {
      id: "ref-town-fringe",
      label: "Off-center surrounding blocks",
      normalizedBounds: { h: 0.78, w: 0.98, x: 0.01, y: 0.05 },
      notes: [
        "Off-map space still reads as town fabric.",
        "No area feels like undefined negative space.",
      ],
    },
  ] satisfies SouthQuayReferenceCallout[],
  semanticAssetIntent: [
    "eatery_frontage",
    "boarding_frontage",
    "workshop_frontage",
    "square_paving",
    "quay_paving",
    "dock_edge",
    "cast_iron_lamp",
    "terrace_table",
    "menu_board",
    "planter_box",
    "row_boat",
  ] satisfies SouthQuayAssetIntent[],
  streetscapeRules: [
    "Street lamps must read as cast-iron lamp posts, not dots or stubs.",
    "Outdoor seating must read as dining furniture, not generic props.",
    "Square benches and planters should align to the square edges.",
    "Waterfront detail should accumulate toward the south edge.",
    "Roof tiles at the fringe should imply adjacent buildings, not darkness.",
  ],
  zonePlan: [
    {
      id: "north-row",
      notes: ["Cafe frontage plus neighboring civic/commercial mass.", "Should frame the town from above."],
      read: "secondary town row",
    },
    {
      id: "main-street",
      notes: ["Primary promenade tying the west lodging side to the east workshop side."],
      read: "shared main street",
    },
    {
      id: "quay-square",
      notes: ["Civic center and compositional anchor of the district."],
      read: "town square",
    },
    {
      id: "yard-edge",
      notes: ["Service and work spillover live here."],
      read: "back-of-house / labor edge",
    },
    {
      id: "waterfront",
      notes: ["The town terminates against dock and harbor conditions here."],
      read: "quay and water boundary",
    },
  ] satisfies SouthQuayZonePlan[],
} as const;

