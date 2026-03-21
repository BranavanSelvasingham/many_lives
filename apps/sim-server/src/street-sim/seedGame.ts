import { addLabel, createCityMap, paintRect } from "./mapBuilder.js";
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
      text: `Late morning in ${DISTRICT_NAME}, on the river side of ${CITY_NAME}. You know your room at Morrow House, the yard behind it, and not much else yet. Rent does not care.`,
    },
    {
      id: "feed-2",
      time: SCENARIO_START,
      tone: "memory",
      text: `Mara said ${DISTRICT_NAME} explains itself a little more every time you stop where people are already struggling.`,
    },
  ];

  return {
    id: gameId,
    scenarioName: SCENARIO_NAME,
    cityName: CITY_NAME,
    districtName: DISTRICT_NAME,
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
      x: 3,
      y: 5,
      currentLocationId: "boarding-house",
      homeLocationId: "boarding-house",
      money: 12,
      energy: 72,
      inventory: [],
      knownLocationIds: ["boarding-house", "courtyard"],
      knownNpcIds: ["npc-mara"],
      activeJobId: undefined,
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
          text: "You woke up in a rented room at Morrow House, still learning which lane leads where and which errands are really chances wearing work clothes.",
        },
      ],
    },
    npcs: buildNpcs(),
    jobs: buildJobs(),
    problems: buildProblems(),
    feed,
    currentScene: {
      locationId: "boarding-house",
      title: "",
      description: "",
      people: [],
      notes: [],
    },
    availableActions: [],
    goals: [],
    summary: "",
  };
}

function buildLocations(): LocationState[] {
  return [
    {
      id: "boarding-house",
      name: "Morrow House",
      shortLabel: "MH",
      type: "home",
      x: 1,
      y: 1,
      width: 5,
      height: 5,
      entryX: 3,
      entryY: 5,
      labelX: 3,
      labelY: 2,
      description:
        "A narrow boarding house with warm stair rails, thin walls, and a keeper who notices who returns tired and who returns useful.",
      neighborhood: NEIGHBORHOODS.morrowCourt,
      openHour: 0,
      closeHour: 24,
    },
    {
      id: "tea-house",
      name: "Kettle & Lamp",
      shortLabel: "KL",
      type: "eatery",
      x: 10,
      y: 1,
      width: 5,
      height: 5,
      entryX: 12,
      entryY: 5,
      labelX: 12,
      labelY: 2,
      description:
        "A cramped tea room where gossip, shift work, and favors all pass over the same counter.",
      neighborhood: NEIGHBORHOODS.lanternRow,
      openHour: 7,
      closeHour: 18,
    },
    {
      id: "repair-stall",
      name: "Mercer Repairs",
      shortLabel: "MR",
      type: "shop",
      x: 17,
      y: 2,
      width: 4,
      height: 4,
      entryX: 18,
      entryY: 5,
      labelX: 18,
      labelY: 2,
      description:
        "A repair stall full of secondhand tools, bent brass, and fixes that hold because Mercer says they do.",
      neighborhood: NEIGHBORHOODS.cooperSteps,
      openHour: 9,
      closeHour: 18,
    },
    {
      id: "courtyard",
      name: "Morrow Yard",
      shortLabel: "MY",
      type: "courtyard",
      x: 1,
      y: 10,
      width: 6,
      height: 4,
      entryX: 3,
      entryY: 11,
      labelX: 3,
      labelY: 10,
      description:
        "Buckets, laundry lines, cracked stone, and a hand pump everybody has been stepping around instead of fixing.",
      neighborhood: NEIGHBORHOODS.morrowCourt,
      openHour: 0,
      closeHour: 24,
    },
    {
      id: "market-square",
      name: "Quay Square",
      shortLabel: "SQ",
      type: "square",
      x: 10,
      y: 7,
      width: 5,
      height: 4,
      entryX: 12,
      entryY: 8,
      labelX: 12,
      labelY: 8,
      description:
        "The center of the district: notices, carts, fishmongers, arguments, and half-heard chances crossing all day.",
      neighborhood: NEIGHBORHOODS.southQuay,
      openHour: 6,
      closeHour: 21,
    },
    {
      id: "freight-yard",
      name: "North Crane Yard",
      shortLabel: "CYD",
      type: "workyard",
      x: 17,
      y: 7,
      width: 6,
      height: 5,
      entryX: 17,
      entryY: 9,
      labelX: 19,
      labelY: 8,
      description:
        "Crates, ropes, handcarts, and short tempers. If you want paid for your back, this is where backs get counted.",
      neighborhood: NEIGHBORHOODS.craneYard,
      openHour: 9,
      closeHour: 16,
    },
    {
      id: "moss-pier",
      name: "Pilgrim Slip",
      shortLabel: "PS",
      type: "pier",
      x: 17,
      y: 13,
      width: 6,
      height: 3,
      entryX: 18,
      entryY: 13,
      labelX: 19,
      labelY: 14,
      description:
        "Wet planks, rope burns, gull noise, and boats that smell like trade before they smell like fish.",
      neighborhood: NEIGHBORHOODS.pilgrimSteps,
      openHour: 6,
      closeHour: 20,
    },
  ];
}

function buildMap() {
  const map = createCityMap(MAP_WIDTH, MAP_HEIGHT, "roof", false);

  paintRect(map, { x: 0, y: 4, width: 21, height: 3 }, "lane", {
    walkable: true,
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 0, y: 7, width: 24, height: 3 }, "lane", {
    walkable: true,
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 7, y: 0, width: 3, height: 16 }, "lane", {
    walkable: true,
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 15, y: 7, width: 3, height: 9 }, "lane", {
    walkable: true,
    district: NEIGHBORHOODS.pilgrimSteps,
  });
  paintRect(map, { x: 16, y: 13, width: 8, height: 3 }, "dock", {
    walkable: true,
    district: NEIGHBORHOODS.pilgrimSteps,
  });
  paintRect(map, { x: 15, y: 16, width: 9, height: 2 }, "water", {
    walkable: false,
    district: NEIGHBORHOODS.pilgrimSteps,
  });
  paintRect(map, { x: 0, y: 16, width: 15, height: 2 }, "garden", {
    walkable: false,
    district: DISTRICT_NAME,
  });

  paintRect(map, { x: 2, y: 5, width: 3, height: 1 }, "stoop", {
    walkable: true,
    locationId: "boarding-house",
    district: NEIGHBORHOODS.morrowCourt,
  });
  paintRect(map, { x: 11, y: 5, width: 3, height: 1 }, "stoop", {
    walkable: true,
    locationId: "tea-house",
    district: NEIGHBORHOODS.lanternRow,
  });
  paintRect(map, { x: 17, y: 5, width: 3, height: 1 }, "stoop", {
    walkable: true,
    locationId: "repair-stall",
    district: NEIGHBORHOODS.cooperSteps,
  });
  paintRect(map, { x: 1, y: 10, width: 6, height: 4 }, "courtyard", {
    walkable: true,
    locationId: "courtyard",
    district: NEIGHBORHOODS.morrowCourt,
  });
  paintRect(map, { x: 10, y: 7, width: 5, height: 4 }, "plaza", {
    walkable: true,
    locationId: "market-square",
    district: DISTRICT_NAME,
  });
  paintRect(map, { x: 17, y: 7, width: 6, height: 5 }, "workyard", {
    walkable: true,
    locationId: "freight-yard",
    district: NEIGHBORHOODS.craneYard,
  });
  paintRect(map, { x: 17, y: 13, width: 6, height: 3 }, "dock", {
    walkable: true,
    locationId: "moss-pier",
    district: NEIGHBORHOODS.pilgrimSteps,
  });

  addLabel(map, {
    id: "label-district-south-quay",
    text: DISTRICT_NAME,
    x: 11.5,
    y: 0.4,
    tone: "district",
  });
  addLabel(map, {
    id: "label-street-copper-row",
    text: NEIGHBORHOODS.lanternRow,
    x: 12,
    y: 6.4,
    tone: "street",
  });
  addLabel(map, {
    id: "label-street-fishbone",
    text: "Cooper Lane",
    x: 8.4,
    y: 2.3,
    tone: "street",
  });
  addLabel(map, {
    id: "label-street-gannet",
    text: NEIGHBORHOODS.morrowCourt,
    x: 3.3,
    y: 9.3,
    tone: "street",
  });
  addLabel(map, {
    id: "label-street-moss",
    text: NEIGHBORHOODS.pilgrimSteps,
    x: 19,
    y: 12.3,
    tone: "street",
  });
  addLabel(map, {
    id: "label-landmark-riverside",
    text: `${CITY_NAME} Docks`,
    x: 19,
    y: 16.4,
    tone: "landmark",
  });

  map.footprints = [
    {
      id: "footprint-west-row-1",
      kind: "building",
      x: 0.1,
      y: 0.85,
      width: 0.9,
      height: 4.35,
      roofStyle: "timber",
    },
    {
      id: "footprint-morrow-house",
      kind: "building",
      x: 1.15,
      y: 1.15,
      width: 4.7,
      height: 3.55,
      locationId: "boarding-house",
      roofStyle: "slate",
    },
    {
      id: "footprint-kettle-lamp",
      kind: "building",
      x: 10.15,
      y: 1.15,
      width: 4.7,
      height: 3.55,
      locationId: "tea-house",
      roofStyle: "plaster",
    },
    {
      id: "footprint-east-row-1",
      kind: "building",
      x: 15.15,
      y: 0.85,
      width: 1.55,
      height: 4.25,
      roofStyle: "slate",
    },
    {
      id: "footprint-mercer-repairs",
      kind: "building",
      x: 17.1,
      y: 2.1,
      width: 3.9,
      height: 2.8,
      locationId: "repair-stall",
      roofStyle: "tin",
    },
    {
      id: "footprint-morrow-yard",
      kind: "yard",
      x: 1.05,
      y: 10.05,
      width: 5.9,
      height: 3.9,
      locationId: "courtyard",
    },
    {
      id: "footprint-quay-square",
      kind: "market",
      x: 10.1,
      y: 7.1,
      width: 4.8,
      height: 3.8,
      locationId: "market-square",
    },
    {
      id: "footprint-south-row-1",
      kind: "building",
      x: 8.15,
      y: 10.25,
      width: 1.55,
      height: 3.95,
      roofStyle: "timber",
    },
    {
      id: "footprint-south-row-2",
      kind: "building",
      x: 10.1,
      y: 11.15,
      width: 2.2,
      height: 2.85,
      roofStyle: "plaster",
    },
    {
      id: "footprint-south-row-3",
      kind: "building",
      x: 12.5,
      y: 11.35,
      width: 1.85,
      height: 2.55,
      roofStyle: "slate",
    },
    {
      id: "footprint-north-crane-yard",
      kind: "yard",
      x: 17.1,
      y: 7.1,
      width: 5.8,
      height: 4.8,
      locationId: "freight-yard",
    },
    {
      id: "footprint-east-warehouse",
      kind: "building",
      x: 22.35,
      y: 6.9,
      width: 1.25,
      height: 5.35,
      roofStyle: "tin",
    },
    {
      id: "footprint-dock-storehouse",
      kind: "building",
      x: 22.75,
      y: 12.85,
      width: 0.95,
      height: 2.95,
      roofStyle: "timber",
    },
    {
      id: "footprint-pilgrim-slip",
      kind: "dock",
      x: 16.2,
      y: 13.05,
      width: 7.7,
      height: 2.95,
      locationId: "moss-pier",
    },
    {
      id: "footprint-river",
      kind: "water",
      x: 15,
      y: 16,
      width: 9,
      height: 2,
    },
    {
      id: "footprint-green",
      kind: "garden",
      x: 0,
      y: 16,
      width: 15,
      height: 2,
    },
  ];

  map.doors = [
    {
      id: "door-morrow-house",
      locationId: "boarding-house",
      kind: "entry",
      x: 3.05,
      y: 4.55,
      width: 0.9,
      height: 0.4,
    },
    {
      id: "door-kettle-lamp",
      locationId: "tea-house",
      kind: "entry",
      x: 11.65,
      y: 4.55,
      width: 1,
      height: 0.4,
    },
    {
      id: "door-mercer-repairs",
      locationId: "repair-stall",
      kind: "entry",
      x: 18.15,
      y: 4.45,
      width: 0.9,
      height: 0.35,
    },
    {
      id: "door-morrow-yard",
      locationId: "courtyard",
      kind: "gate",
      x: 3.05,
      y: 9.85,
      width: 1.1,
      height: 0.25,
    },
    {
      id: "door-north-crane-yard",
      locationId: "freight-yard",
      kind: "gate",
      x: 16.95,
      y: 8.65,
      width: 0.3,
      height: 1.1,
    },
    {
      id: "door-pilgrim-slip",
      locationId: "moss-pier",
      kind: "service",
      x: 18.15,
      y: 12.85,
      width: 0.9,
      height: 0.3,
    },
  ];

  map.props = [
    { id: "prop-lamp-1", kind: "lamp", x: 6.8, y: 5.4, scale: 1 },
    { id: "prop-lamp-2", kind: "lamp", x: 9.8, y: 6.4, scale: 1 },
    { id: "prop-lamp-3", kind: "lamp", x: 15.6, y: 12.2, scale: 1 },
    { id: "prop-lamp-4", kind: "lamp", x: 1.2, y: 6.2, scale: 0.95 },
    { id: "prop-lamp-5", kind: "lamp", x: 22.4, y: 9.8, scale: 0.95 },
    { id: "prop-laundry", kind: "laundry", x: 4.9, y: 10.9, locationId: "courtyard", scale: 1.1 },
    { id: "prop-pump", kind: "pump", x: 2.8, y: 11.9, locationId: "courtyard", scale: 1 },
    { id: "prop-bench", kind: "bench", x: 11.2, y: 8.25, locationId: "market-square", scale: 1 },
    { id: "prop-cart-square", kind: "cart", x: 13.55, y: 9.25, locationId: "market-square", scale: 1 },
    { id: "prop-cart-lane", kind: "cart", x: 7.9, y: 5.5, scale: 0.95, rotation: -8 },
    { id: "prop-canopy-square", kind: "canopy", x: 10.8, y: 7.55, locationId: "market-square", scale: 1.15 },
    { id: "prop-canopy-tea", kind: "canopy", x: 13.35, y: 4.65, locationId: "tea-house", scale: 1 },
    { id: "prop-canopy-square-2", kind: "canopy", x: 13.7, y: 7.75, locationId: "market-square", scale: 1.05 },
    { id: "prop-bench-river", kind: "bench", x: 15.4, y: 14.4, scale: 0.95, rotation: 90 },
    { id: "prop-crate-yard-1", kind: "crate", x: 18.1, y: 8.15, locationId: "freight-yard", scale: 1 },
    { id: "prop-crate-yard-2", kind: "crate", x: 20.2, y: 9.35, locationId: "freight-yard", scale: 1.15 },
    { id: "prop-crate-stall", kind: "crate", x: 17.45, y: 5.1, locationId: "repair-stall", scale: 0.95 },
    { id: "prop-barrel-stall", kind: "barrel", x: 20.35, y: 5.2, locationId: "repair-stall", scale: 0.95 },
    { id: "prop-barrel-yard", kind: "barrel", x: 21.65, y: 8.2, locationId: "freight-yard", scale: 1 },
    { id: "prop-cart-yard", kind: "cart", x: 19.55, y: 10.65, locationId: "freight-yard", scale: 1.1 },
    { id: "prop-crate-slip", kind: "crate", x: 19.1, y: 13.75, locationId: "moss-pier", scale: 1 },
    { id: "prop-barrel-slip", kind: "barrel", x: 21.2, y: 14.15, locationId: "moss-pier", scale: 1 },
    { id: "prop-bollard-1", kind: "bollard", x: 17.35, y: 15.1, locationId: "moss-pier", scale: 1 },
    { id: "prop-bollard-2", kind: "bollard", x: 22.45, y: 15.1, locationId: "moss-pier", scale: 1 },
    { id: "prop-bollard-3", kind: "bollard", x: 19.9, y: 15.05, locationId: "moss-pier", scale: 0.95 },
    { id: "prop-tree-green", kind: "tree", x: 5.8, y: 16.9, scale: 1.1 },
    { id: "prop-tree-green-2", kind: "tree", x: 11.2, y: 16.8, scale: 0.95 },
  ];

  return map;
}

function buildNpcs(): NpcState[] {
  return [
    {
      id: "npc-mara",
      name: "Mara",
      role: "boarding keeper",
      summary:
        "Knows everybody's rent, everybody's business, and which two are the same problem.",
      currentLocationId: "boarding-house",
      trust: 1,
      known: true,
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
      summary:
        "Runs the Lamp hard, pays light, and remembers who can keep cups moving without dropping the room.",
      currentLocationId: "tea-house",
      trust: 0,
      known: false,
      memory: [],
      schedule: [{ locationId: "tea-house", fromHour: 7, toHour: 18 }],
    },
    {
      id: "npc-jo",
      name: "Jo",
      role: "repairer",
      summary:
        "Runs Mercer Repairs with blunt honesty. If a thing is bent, Jo says so before taking your coin.",
      currentLocationId: "repair-stall",
      trust: 0,
      known: false,
      memory: [],
      schedule: [{ locationId: "repair-stall", fromHour: 9, toHour: 18 }],
    },
    {
      id: "npc-tomas",
      name: "Tomas",
      role: "yard foreman",
      summary:
        "Pays for fast hands, steady backs, and no excuses about the weather.",
      currentLocationId: "freight-yard",
      trust: 0,
      known: false,
      memory: [],
      schedule: [{ locationId: "freight-yard", fromHour: 10, toHour: 15 }],
    },
    {
      id: "npc-nia",
      name: "Nia",
      role: "runner",
      summary:
        "Knows which notices matter and which can only afford to look important.",
      currentLocationId: "market-square",
      trust: 0,
      known: false,
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
        "Tomas needs an extra back for a short loading block before the river carts turn up.",
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
        "If nobody fixes it by evening, Morrow Yard floods and the house turns sour for the night.",
      benefitIfSolved:
        "If you fix it, Mara stops seeing you as another lodger-shaped expense.",
    },
    {
      id: "problem-cart",
      title: "Jammed handcart",
      summary:
        "A delivery handcart is going to snarl the square once the afternoon rush starts.",
      locationId: "market-square",
      status: "hidden",
      discovered: false,
      urgency: 2,
      rewardMoney: 8,
      consequenceIfIgnored:
        "If nobody clears it, the square slows down and people remember who only watched.",
      benefitIfSolved:
        "If you clear it early, the square starts treating you like a pair of useful hands instead of driftwood.",
    },
  ];
}
