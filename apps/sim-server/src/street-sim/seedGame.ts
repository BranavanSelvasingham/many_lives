import { addLabel, createCityMap, paintRect } from "./mapBuilder.js";
import { getNpcNarrative } from "./npcNarratives.js";
import {
  CITY_NARRATIVE,
  DISTRICT_NARRATIVE,
  getLocationNarrative,
  getMapLabelNarrative,
} from "./placeNarratives.js";
import type {
  FeedEntry,
  JobState,
  LocationState,
  NpcState,
  ProblemState,
  StreetGameState,
} from "./types.js";

const SCENARIO_START = "2026-03-21T11:00:00.000Z";
const MAP_WIDTH = 24;
const MAP_HEIGHT = 18;
const CITY_NAME = "Brackenport";
const DISTRICT_NAME = "South Quay";
const SCENARIO_NAME = `${DISTRICT_NAME}, Day One`;
const ROWAN_BACKSTORY =
  "Rowan is new to Brackenport, with a bed at Morrow House for tonight and a few coins to get started. He is trying to turn that first foothold into a steady place to stay, reliable income, and a few real friends.";

const NEIGHBORHOODS = {
  morrowCourt: "Morrow Court",
  lanternRow: "Lantern Row",
  cooperSteps: "Cooper Steps",
  southQuay: DISTRICT_NAME,
  craneYard: "Crane Yard",
  pilgrimSteps: "Pilgrim Steps",
} as const;

export function seedStreetGame(gameId: string): StreetGameState {
  const locations = buildLocations();
  const map = buildMap();
  const feed: FeedEntry[] = [
    {
      id: "feed-1",
      time: SCENARIO_START,
      tone: "info",
      text: `Late morning in ${DISTRICT_NAME}, your first real day in ${CITY_NAME}. You have a bed at Morrow House for tonight, a few coins, and no real hold on the city yet.`,
    },
    {
      id: "feed-2",
      time: SCENARIO_START,
      tone: "memory",
      text: `Mara said ${DISTRICT_NAME} explains itself a little more every time you stop where people are already struggling instead of only asking where the money is.`,
    },
  ];

  return {
    id: gameId,
    scenarioName: SCENARIO_NAME,
    cityName: CITY_NAME,
    cityNarrative: CITY_NARRATIVE,
    districtName: DISTRICT_NAME,
    districtNarrative: DISTRICT_NARRATIVE,
    visualSceneId: "south-quay-v2",
    currentTime: SCENARIO_START,
    clock: {
      day: 1,
      hour: 11,
      minute: 0,
      totalMinutes: 11 * 60,
      label: "Late morning",
    },
    map,
    locations,
    player: {
      id: "player",
      name: "Rowan",
      backstory: ROWAN_BACKSTORY,
      x: 3,
      y: 9,
      currentLocationId: "boarding-house",
      homeLocationId: "boarding-house",
      money: 12,
      energy: 72,
      inventory: [],
      knownLocationIds: ["boarding-house", "courtyard"],
      knownNpcIds: ["npc-mara"],
      activeJobId: undefined,
      objective: {
        id: "objective-settle-seed",
        text: "Get settled in Brackenport: lock in a room, steady income, and a few real friends.",
        createdAt: SCENARIO_START,
        updatedAt: SCENARIO_START,
        focus: "settle",
        source: "seed",
        routeKey: "settle-core",
        trail: [],
        completedTrail: [],
        progress: {
          completed: 0,
          total: 0,
          label: "Nothing tracked yet",
        },
      },
      reputation: {
        morrow_house: 1,
        south_quay: 0,
        crane_yard: 0,
      },
      memories: [
        {
          id: "memory-1",
          time: SCENARIO_START,
          kind: "place",
          text: "You woke up at Morrow House with only tonight's bed certain, new enough to Brackenport that every lane still feels like a question and every face might matter.",
        },
      ],
    },
    npcs: buildNpcs(),
    jobs: buildJobs(),
    problems: buildProblems(),
    feed,
    conversations: [],
    conversationThreads: {},
    activeConversation: undefined,
    currentScene: {
      locationId: "boarding-house",
      title: "",
      description: "",
      context: "",
      backstory: "",
      people: [],
      notes: [],
    },
    availableActions: [],
    goals: [],
    rowanAutonomy: {
      autoContinue: false,
      detail: "Choose where Rowan should go or what he should do next.",
      key: "idle:seed",
      label: "Choose a direction",
      layer: "idle",
      mode: "idle",
      stepKind: "idle",
    },
    summary: "",
  };
}

function buildLocations(): LocationState[] {
  return [
    {
      ...getLocationNarrative("boarding-house"),
      id: "boarding-house",
      name: "Morrow House",
      shortLabel: "MH",
      type: "home",
      x: 1,
      y: 6,
      width: 5,
      height: 3,
      entryX: 3,
      entryY: 9,
      labelX: 3.45,
      labelY: 6.6,
      neighborhood: NEIGHBORHOODS.morrowCourt,
      openHour: 0,
      closeHour: 24,
    },
    {
      ...getLocationNarrative("tea-house"),
      id: "tea-house",
      name: "Kettle & Lamp",
      shortLabel: "KL",
      type: "eatery",
      x: 4,
      y: 1,
      width: 4,
      height: 3,
      entryX: 6,
      entryY: 4,
      labelX: 6,
      labelY: 1.95,
      neighborhood: NEIGHBORHOODS.lanternRow,
      openHour: 7,
      closeHour: 18,
    },
    {
      ...getLocationNarrative("repair-stall"),
      id: "repair-stall",
      name: "Mercer Repairs",
      shortLabel: "MR",
      type: "shop",
      x: 15,
      y: 6,
      width: 3,
      height: 3,
      entryX: 16,
      entryY: 9,
      labelX: 16.5,
      labelY: 6.75,
      neighborhood: NEIGHBORHOODS.cooperSteps,
      openHour: 9,
      closeHour: 18,
    },
    {
      ...getLocationNarrative("courtyard"),
      id: "courtyard",
      name: "Morrow Yard",
      shortLabel: "MY",
      type: "courtyard",
      x: 1,
      y: 12,
      width: 5,
      height: 3,
      entryX: 3,
      entryY: 11,
      labelX: 3.2,
      labelY: 13.35,
      neighborhood: NEIGHBORHOODS.morrowCourt,
      openHour: 0,
      closeHour: 24,
    },
    {
      ...getLocationNarrative("market-square"),
      id: "market-square",
      name: "Quay Square",
      shortLabel: "SQ",
      type: "square",
      x: 10,
      y: 9,
      width: 5,
      height: 4,
      entryX: 12,
      entryY: 10,
      labelX: 12.5,
      labelY: 10.8,
      neighborhood: NEIGHBORHOODS.southQuay,
      openHour: 6,
      closeHour: 21,
    },
    {
      ...getLocationNarrative("freight-yard"),
      id: "freight-yard",
      name: "North Crane Yard",
      shortLabel: "CYD",
      type: "workyard",
      x: 18,
      y: 9,
      width: 5,
      height: 4,
      entryX: 18,
      entryY: 10,
      labelX: 20.4,
      labelY: 10.75,
      neighborhood: NEIGHBORHOODS.craneYard,
      openHour: 9,
      closeHour: 16,
    },
    {
      ...getLocationNarrative("moss-pier"),
      id: "moss-pier",
      name: "Pilgrim Slip",
      shortLabel: "PS",
      type: "pier",
      x: 15,
      y: 14,
      width: 9,
      height: 3,
      entryX: 18,
      entryY: 14,
      labelX: 19.45,
      labelY: 15.45,
      neighborhood: NEIGHBORHOODS.pilgrimSteps,
      openHour: 6,
      closeHour: 20,
    },
  ];
}

function buildMap() {
  const map = createCityMap(MAP_WIDTH, MAP_HEIGHT, "roof", false);

  for (const laneRect of [
    { x: 0, y: 4, width: 24, height: 2 },
    { x: 6, y: 4, width: 2, height: 11 },
    { x: 8, y: 0, width: 2, height: 15 },
    { x: 15, y: 0, width: 2, height: 15 },
    { x: 0, y: 9, width: 10, height: 3 },
    { x: 8, y: 7, width: 10, height: 2 },
    { x: 9, y: 13, width: 15, height: 1 },
  ]) {
    paintRect(map, laneRect, "lane", {
      walkable: true,
      district: DISTRICT_NAME,
    });
  }
  paintRect(map, { x: 15, y: 14, width: 9, height: 3 }, "dock", {
    walkable: true,
    locationId: "moss-pier",
    district: NEIGHBORHOODS.pilgrimSteps,
  });
  paintRect(map, { x: 15, y: 17, width: 9, height: 1 }, "water", {
    walkable: false,
    district: NEIGHBORHOODS.pilgrimSteps,
  });
  paintRect(map, { x: 0, y: 16, width: 7, height: 2 }, "garden", {
    walkable: false,
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 1, y: 12, width: 5, height: 3 }, "courtyard", {
    walkable: true,
    locationId: "courtyard",
    district: NEIGHBORHOODS.morrowCourt,
  });
  paintRect(map, { x: 10, y: 9, width: 5, height: 4 }, "plaza", {
    walkable: true,
    locationId: "market-square",
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 18, y: 9, width: 5, height: 4 }, "workyard", {
    walkable: true,
    locationId: "freight-yard",
    district: NEIGHBORHOODS.craneYard,
  });

  for (const roofRect of [
    { x: 1, y: 6, width: 5, height: 3, locationId: "boarding-house" },
    { x: 4, y: 1, width: 4, height: 3, locationId: "tea-house" },
    { x: 15, y: 6, width: 3, height: 3, locationId: "repair-stall" },
    { x: 1, y: 1, width: 3, height: 2 },
    { x: 10, y: 1, width: 3, height: 3 },
    { x: 18, y: 1, width: 5, height: 4 },
    { x: 6, y: 6, width: 2, height: 3 },
    { x: 10, y: 6, width: 4, height: 2 },
    { x: 19, y: 6, width: 4, height: 2 },
    { x: 7, y: 14, width: 4, height: 2 },
    { x: 11, y: 14, width: 4, height: 2 },
  ]) {
    paintRect(map, roofRect, "roof", {
      walkable: false,
      locationId: roofRect.locationId,
      district: roofRect.x >= 15 ? NEIGHBORHOODS.pilgrimSteps : DISTRICT_NAME,
    });
  }

  paintRect(map, { x: 2, y: 9, width: 3, height: 1 }, "stoop", {
    walkable: true,
    locationId: "boarding-house",
    district: NEIGHBORHOODS.morrowCourt,
  });
  paintRect(map, { x: 5, y: 4, width: 2, height: 1 }, "stoop", {
    walkable: true,
    locationId: "tea-house",
    district: NEIGHBORHOODS.lanternRow,
  });
  paintRect(map, { x: 15, y: 9, width: 2, height: 1 }, "stoop", {
    walkable: true,
    locationId: "repair-stall",
    district: NEIGHBORHOODS.cooperSteps,
  });
  paintRect(map, { x: 2, y: 11, width: 2, height: 1 }, "stoop", {
    walkable: true,
    locationId: "courtyard",
    district: NEIGHBORHOODS.morrowCourt,
  });
  paintRect(map, { x: 17, y: 9, width: 1, height: 2 }, "stoop", {
    walkable: true,
    locationId: "freight-yard",
    district: NEIGHBORHOODS.craneYard,
  });

  addLabel(map, {
    ...getMapLabelNarrative("label-district-south-quay"),
    id: "label-district-south-quay",
    text: DISTRICT_NAME,
    x: 11.5,
    y: 0.35,
    tone: "district",
  });
  addLabel(map, {
    ...getMapLabelNarrative("label-street-harbor-walk"),
    id: "label-street-harbor-walk",
    text: "Harbor Walk",
    x: 13.4,
    y: 13.35,
    tone: "street",
    locationId: "market-square",
  });
  addLabel(map, {
    ...getMapLabelNarrative("label-landmark-riverside"),
    id: "label-landmark-riverside",
    text: `${CITY_NAME} Docks`,
    x: 19.55,
    y: 17.15,
    tone: "landmark",
    locationId: "moss-pier",
  });

  map.footprints = [
    {
      id: "footprint-top-west-small",
      kind: "building",
      x: 1.05,
      y: 1.05,
      width: 2.95,
      height: 2.05,
      roofStyle: "timber",
    },
    {
      id: "footprint-kettle-lamp",
      kind: "building",
      x: 4.05,
      y: 1.05,
      width: 3.95,
      height: 3.05,
      locationId: "tea-house",
      roofStyle: "plaster",
    },
    {
      id: "footprint-top-mid-hall",
      kind: "building",
      x: 10.05,
      y: 1.05,
      width: 2.95,
      height: 3.05,
      roofStyle: "slate",
    },
    {
      id: "footprint-top-east-hall",
      kind: "building",
      x: 18.05,
      y: 1.05,
      width: 4.95,
      height: 3.9,
      roofStyle: "slate",
    },
    {
      id: "footprint-morrow-house",
      kind: "building",
      x: 1.05,
      y: 6.05,
      width: 4.95,
      height: 3.05,
      locationId: "boarding-house",
      roofStyle: "slate",
    },
    {
      id: "footprint-west-arcade",
      kind: "building",
      x: 6.05,
      y: 6.05,
      width: 1.95,
      height: 3.05,
      roofStyle: "slate",
    },
    {
      id: "footprint-square-north-row",
      kind: "building",
      x: 10.05,
      y: 6.05,
      width: 3.95,
      height: 2.05,
      roofStyle: "plaster",
    },
    {
      id: "footprint-mercer-repairs",
      kind: "building",
      x: 15.05,
      y: 6.05,
      width: 2.95,
      height: 3.05,
      locationId: "repair-stall",
      roofStyle: "tin",
    },
    {
      id: "footprint-east-row-upper",
      kind: "building",
      x: 19.05,
      y: 6.05,
      width: 3.95,
      height: 2.05,
      roofStyle: "plaster",
    },
    {
      id: "footprint-morrow-yard",
      kind: "yard",
      x: 1.05,
      y: 12.05,
      width: 4.95,
      height: 3.05,
      locationId: "courtyard",
    },
    {
      id: "footprint-quay-square",
      kind: "market",
      x: 10.05,
      y: 9.05,
      width: 4.95,
      height: 3.95,
      locationId: "market-square",
    },
    {
      id: "footprint-north-crane-yard",
      kind: "yard",
      x: 18.05,
      y: 9.05,
      width: 4.95,
      height: 3.95,
      locationId: "freight-yard",
    },
    {
      id: "footprint-south-row-west",
      kind: "building",
      x: 7.05,
      y: 14.05,
      width: 3.95,
      height: 2.05,
      roofStyle: "timber",
    },
    {
      id: "footprint-south-row-east",
      kind: "building",
      x: 11.05,
      y: 14.05,
      width: 3.95,
      height: 2.05,
      roofStyle: "slate",
    },
    {
      id: "footprint-pilgrim-slip",
      kind: "dock",
      x: 15.05,
      y: 14.05,
      width: 8.9,
      height: 2.95,
      locationId: "moss-pier",
    },
    {
      id: "footprint-river",
      kind: "water",
      x: 15,
      y: 17,
      width: 9,
      height: 1,
    },
    {
      id: "footprint-green",
      kind: "garden",
      x: 0,
      y: 16,
      width: 7,
      height: 2,
    },
  ];

  map.doors = [
    {
      id: "door-morrow-house",
      locationId: "boarding-house",
      kind: "entry",
      x: 3.1,
      y: 8.65,
      width: 0.85,
      height: 0.35,
    },
    {
      id: "door-kettle-lamp",
      locationId: "tea-house",
      kind: "entry",
      x: 5.75,
      y: 3.65,
      width: 0.95,
      height: 0.35,
    },
    {
      id: "door-mercer-repairs",
      locationId: "repair-stall",
      kind: "entry",
      x: 15.95,
      y: 8.65,
      width: 0.9,
      height: 0.35,
    },
    {
      id: "door-morrow-yard",
      locationId: "courtyard",
      kind: "gate",
      x: 2.35,
      y: 11.8,
      width: 1.2,
      height: 0.25,
    },
    {
      id: "door-north-crane-yard",
      locationId: "freight-yard",
      kind: "gate",
      x: 17.92,
      y: 9.2,
      width: 0.25,
      height: 1.35,
    },
    {
      id: "door-pilgrim-slip",
      locationId: "moss-pier",
      kind: "service",
      x: 17.85,
      y: 13.8,
      width: 1.05,
      height: 0.25,
    },
  ];

  map.props = [
    { id: "prop-lamp-1", kind: "lamp", x: 1.3, y: 3.55, scale: 0.92 },
    { id: "prop-lamp-2", kind: "lamp", x: 8.55, y: 3.35, scale: 0.95 },
    { id: "prop-lamp-3", kind: "lamp", x: 14.45, y: 3.4, scale: 0.95 },
    { id: "prop-lamp-4", kind: "lamp", x: 20.55, y: 4.35, scale: 0.95 },
    { id: "prop-lamp-5", kind: "lamp", x: 7.35, y: 7.2, scale: 0.95 },
    { id: "prop-lamp-6", kind: "lamp", x: 9.25, y: 7.55, scale: 0.95 },
    { id: "prop-lamp-7", kind: "lamp", x: 15.25, y: 7.55, scale: 0.95 },
    { id: "prop-lamp-8", kind: "lamp", x: 8.45, y: 13.25, scale: 0.95 },
    { id: "prop-lamp-9", kind: "lamp", x: 16.95, y: 13.25, scale: 0.95 },
    { id: "prop-lamp-10", kind: "lamp", x: 22.3, y: 13.35, scale: 0.9 },
    { id: "prop-laundry", kind: "laundry", x: 4.5, y: 12.9, locationId: "courtyard", scale: 1.05 },
    { id: "prop-pump", kind: "pump", x: 2.55, y: 13.55, locationId: "courtyard", scale: 0.98 },
    { id: "prop-planter-tea-west", kind: "planter", x: 4.35, y: 4.25, locationId: "tea-house", scale: 0.92 },
    { id: "prop-planter-tea-east", kind: "planter", x: 7.45, y: 4.2, locationId: "tea-house", scale: 0.92 },
    { id: "prop-bench-square-north", kind: "bench", x: 12.35, y: 8.35, locationId: "market-square", scale: 0.92 },
    { id: "prop-bench-square-west", kind: "bench", x: 9.65, y: 11.05, locationId: "market-square", scale: 0.9, rotation: 90 },
    { id: "prop-bench-square-east", kind: "bench", x: 15.1, y: 11.05, locationId: "market-square", scale: 0.9, rotation: 90 },
    { id: "prop-bench-square-south", kind: "bench", x: 12.35, y: 12.85, locationId: "market-square", scale: 0.92 },
    { id: "prop-fountain-square", kind: "fountain", x: 12.45, y: 10.85, locationId: "market-square", scale: 1.08 },
    { id: "prop-planter-square-nw", kind: "planter", x: 10.45, y: 9.3, locationId: "market-square", scale: 0.9 },
    { id: "prop-planter-square-ne", kind: "planter", x: 14.55, y: 9.3, locationId: "market-square", scale: 0.9 },
    { id: "prop-planter-square-sw", kind: "planter", x: 10.45, y: 12.4, locationId: "market-square", scale: 0.9 },
    { id: "prop-planter-square-se", kind: "planter", x: 14.55, y: 12.4, locationId: "market-square", scale: 0.9 },
    { id: "prop-cart-lane", kind: "cart", x: 6.95, y: 8.3, scale: 0.92, rotation: -8 },
    { id: "prop-canopy-tea", kind: "canopy", x: 5.9, y: 4.1, locationId: "tea-house", scale: 0.98 },
    { id: "prop-crate-yard-1", kind: "crate", x: 18.75, y: 8.95, locationId: "freight-yard", scale: 1 },
    { id: "prop-crate-yard-2", kind: "crate", x: 20.95, y: 9.55, locationId: "freight-yard", scale: 1.08 },
    { id: "prop-barrel-yard", kind: "barrel", x: 21.7, y: 10.85, locationId: "freight-yard", scale: 0.95 },
    { id: "prop-cart-yard", kind: "cart", x: 19.9, y: 11.0, locationId: "freight-yard", scale: 1.05 },
    { id: "prop-crate-stall", kind: "crate", x: 15.15, y: 9.65, locationId: "repair-stall", scale: 0.88 },
    { id: "prop-barrel-stall", kind: "barrel", x: 17.25, y: 9.55, locationId: "repair-stall", scale: 0.88 },
    { id: "prop-crate-slip", kind: "crate", x: 18.35, y: 15.05, locationId: "moss-pier", scale: 0.98 },
    { id: "prop-barrel-slip", kind: "barrel", x: 20.95, y: 15.2, locationId: "moss-pier", scale: 0.98 },
    { id: "prop-bollard-1", kind: "bollard", x: 16.35, y: 16.15, locationId: "moss-pier", scale: 0.95 },
    { id: "prop-bollard-2", kind: "bollard", x: 19.2, y: 16.05, locationId: "moss-pier", scale: 0.95 },
    { id: "prop-bollard-3", kind: "bollard", x: 22.15, y: 16.1, locationId: "moss-pier", scale: 0.95 },
    { id: "prop-boat-slip-1", kind: "boat", x: 18.45, y: 17.45, locationId: "moss-pier", scale: 1.02 },
    { id: "prop-boat-slip-2", kind: "boat", x: 21.75, y: 17.5, locationId: "moss-pier", scale: 0.9 },
    { id: "prop-tree-green", kind: "tree", x: 2.05, y: 16.75, scale: 1.02 },
    { id: "prop-tree-green-2", kind: "tree", x: 4.65, y: 16.7, scale: 0.95 },
    { id: "prop-planter-green", kind: "planter", x: 6.3, y: 15.8, scale: 0.88 },
  ];

  return map;
}

function buildNpcs(): NpcState[] {
  const mara = getNpcNarrative("npc-mara");
  const ada = getNpcNarrative("npc-ada");
  const jo = getNpcNarrative("npc-jo");
  const tomas = getNpcNarrative("npc-tomas");
  const nia = getNpcNarrative("npc-nia");

  return [
    {
      id: "npc-mara",
      name: "Mara",
      role: "boarding keeper",
      summary: mara.backstory,
      narrative: mara,
      currentLocationId: "boarding-house",
      trust: 1,
      openness: 62,
      known: true,
      mood: "watchful",
      currentObjective: mara.objective,
      currentConcern: mara.context,
      memory: [`Told you ${DISTRICT_NAME} only opens once you start helping.`],
      schedule: [
        { locationId: "boarding-house", fromHour: 0, toHour: 8 },
        { locationId: "courtyard", fromHour: 8, toHour: 11 },
        { locationId: "boarding-house", fromHour: 11, toHour: 21 },
        { locationId: "courtyard", fromHour: 21, toHour: 24 },
      ],
    },
    {
      id: "npc-ada",
      name: "Ada",
      role: "tea house owner",
      summary: ada.backstory,
      narrative: ada,
      currentLocationId: "tea-house",
      trust: 0,
      openness: 50,
      known: false,
      mood: "brisk",
      currentObjective: ada.objective,
      currentConcern: ada.context,
      memory: [],
      schedule: [{ locationId: "tea-house", fromHour: 7, toHour: 18 }],
    },
    {
      id: "npc-jo",
      name: "Jo",
      role: "repairer",
      summary: jo.backstory,
      narrative: jo,
      currentLocationId: "repair-stall",
      trust: 0,
      openness: 44,
      known: false,
      mood: "dry",
      currentObjective: jo.objective,
      currentConcern: jo.context,
      memory: [],
      schedule: [{ locationId: "repair-stall", fromHour: 9, toHour: 18 }],
    },
    {
      id: "npc-tomas",
      name: "Tomas",
      role: "yard foreman",
      summary: tomas.backstory,
      narrative: tomas,
      currentLocationId: "freight-yard",
      trust: 0,
      openness: 34,
      known: false,
      mood: "busy",
      currentObjective: tomas.objective,
      currentConcern: tomas.context,
      memory: [],
      schedule: [{ locationId: "freight-yard", fromHour: 10, toHour: 15 }],
    },
    {
      id: "npc-nia",
      name: "Nia",
      role: "runner",
      summary: nia.backstory,
      narrative: nia,
      currentLocationId: "market-square",
      trust: 0,
      openness: 60,
      known: false,
      mood: "alert",
      currentObjective: nia.objective,
      currentConcern: nia.context,
      memory: [],
      schedule: [
        { locationId: "market-square", fromHour: 12, toHour: 16 },
        { locationId: "moss-pier", fromHour: 16, toHour: 19 },
      ],
    },
  ];
}

function buildJobs(): JobState[] {
  return [
    {
      id: "job-tea-shift",
      title: "Cup-and-counter shift",
      summary:
        "Ada needs someone to clear cups, wipe tables, and keep noon from swallowing the room.",
      giverNpcId: "npc-ada",
      locationId: "tea-house",
      startHour: 12,
      endHour: 15,
      durationMinutes: 60,
      pay: 14,
      discovered: false,
      accepted: false,
      completed: false,
      missed: false,
    },
    {
      id: "job-yard-shift",
      title: "Freight yard lift",
      summary:
        "Tomas needs another set of hands for a short loading block before the river carts turn up.",
      giverNpcId: "npc-tomas",
      locationId: "freight-yard",
      startHour: 13,
      endHour: 17,
      durationMinutes: 90,
      pay: 24,
      discovered: false,
      accepted: false,
      completed: false,
      missed: false,
      unlockedBy: "job-tea-shift",
    },
  ];
}

function buildProblems(): ProblemState[] {
  return [
    {
      id: "problem-pump",
      title: "Leaking hand pump",
      summary:
        "The pump in Morrow Yard is spitting more water onto the stones than into the buckets.",
      locationId: "courtyard",
      status: "active",
      discovered: false,
      urgency: 3,
      rewardMoney: 12,
      requiredItemId: "item-wrench",
      consequenceIfIgnored:
        "If nobody fixes it by evening, Morrow Yard gets soggy and everyone starts the night grumbling.",
      benefitIfSolved:
        "If you fix it, Mara starts seeing Rowan as someone who notices small things.",
    },
    {
      id: "problem-cart",
      title: "Jammed handcart",
      summary:
        "A delivery handcart is going to jam the square once the lunch crowd drifts in.",
      locationId: "market-square",
      status: "hidden",
      discovered: false,
      urgency: 2,
      rewardMoney: 8,
      consequenceIfIgnored:
        "If nobody clears it, the square slows down and everyone gets mildly dramatic about it.",
      benefitIfSolved:
        "If you clear it early, people in the square notice that Rowan helps before a problem gets loud.",
    },
  ];
}
