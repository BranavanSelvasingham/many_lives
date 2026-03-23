import type {
  LocationState,
  MapLabel,
  SettingNarrativeProfile,
} from "./types.js";

type LocationNarrativeProfile = Pick<
  LocationState,
  "description" | "context" | "backstory"
>;

type MapLabelNarrativeProfile = Pick<MapLabel, "context" | "backstory">;

export const CITY_NARRATIVE: SettingNarrativeProfile = {
  context:
    "Brackenport runs on tide tables, dock credit, and whoever can prove they are useful before the day closes in.",
  backstory:
    "It grew rich off river trade and warehouse money, then learned to keep the polished parts uphill while the working wards along the water carried the strain, the weather, and the hurry.",
};

export const DISTRICT_NARRATIVE: SettingNarrativeProfile = {
  context:
    "South Quay is where Brackenport's errands turn visible. Work, gossip, rent pressure, repairs, and dock spillover all meet here before the rest of the city pretends not to notice them.",
  backstory:
    "It began as service lanes for the docks and cheap rooms for transient hands, then hardened into a district where favors travel almost as reliably as wages and everybody learns who can keep a promise under pressure.",
};

const DEFAULT_LOCATION_NARRATIVE: LocationNarrativeProfile = {
  description:
    "A piece of South Quay still doing what the district needs from it.",
  context:
    "People come through here because the block still expects something from this place.",
  backstory:
    "Like most places in South Quay, it was shaped by work first and comfort second.",
};

const LOCATION_NARRATIVES: Record<string, LocationNarrativeProfile> = {
  "boarding-house": {
    description:
      "A narrow boarding house with warm stair rails, thin walls, and a keeper who notices who returns tired and who returns useful.",
    context:
      "Morrow House is where people in South Quay try to turn a temporary bed into something steadier than the day's luck.",
    backstory:
      "It started as overflow rooms for dock hands and carters, then became the kind of boarding house that survives by remembering who pays late, who helps out, and who keeps the place from tilting into chaos.",
  },
  "tea-house": {
    description:
      "A cramped tea room where gossip, shift work, and favors all pass over the same counter.",
    context:
      "Kettle & Lamp keeps the district stitched together between shifts, rumors, and small practical arrangements.",
    backstory:
      "It was built to feed and warm workers spilling out of the lanes, and over time it turned into one of those places where jobs, apologies, and warnings all get served in the same cup.",
  },
  "repair-stall": {
    description:
      "A repair stall full of secondhand tools, bent brass, and fixes that hold because Mercer says they do.",
    context:
      "Mercer Repairs is where broken things come when replacing them would cost more than the block can spare.",
    backstory:
      "The stall grew out of salvaged parts and stubborn workmanship, building a reputation on repairs that outlast the promise they were sold with.",
  },
  courtyard: {
    description:
      "Buckets, laundry lines, cracked stone, and a hand pump everybody has been stepping around instead of fixing.",
    context:
      "Morrow Yard is shared breathing room, work space, and trouble sink for the people living around it.",
    backstory:
      "It used to be a service yard for carts and coal, and now it carries the quieter labor of washing, hauling, waiting, and dealing with whatever the boarding house cannot keep indoors.",
  },
  "market-square": {
    description:
      "The center of the district: notices, carts, fishmongers, arguments, and half-heard chances crossing all day.",
    context:
      "Quay Square is the district's public pulse, where opportunities and problems both become visible fast.",
    backstory:
      "It formed where the lanes widened enough for trading tables and public notices, and it stayed important because South Quay needs one place where everybody's version of the day collides.",
  },
  "freight-yard": {
    description:
      "Crates, ropes, handcarts, and short tempers. If you want paid for your back, this is where backs get counted.",
    context:
      "North Crane Yard turns labor into wages in the bluntest possible way: by measuring what got moved before the light changed.",
    backstory:
      "It expanded from a riverside loading patch into a hard-run workyard that answers to cargo schedules more than to comfort, patience, or excuses.",
  },
  "moss-pier": {
    description:
      "Wet planks, rope burns, gull noise, and boats that smell like trade before they smell like fish.",
    context:
      "Pilgrim Slip is where the district feels the river most directly, with arrivals, departures, and rumors all coming in over the same water.",
    backstory:
      "It began as a practical unloading pier and kept its importance because small boats, side cargo, and unofficial errands still need somewhere less polished than the main docks.",
  },
};

const DEFAULT_LABEL_NARRATIVE: MapLabelNarrativeProfile = {
  context:
    "This part of the district carries its own habits, pressure, and local memory.",
  backstory:
    "The name stuck because people working here needed a way to mark what kind of street they were stepping into.",
};

const MAP_LABEL_NARRATIVES: Record<string, MapLabelNarrativeProfile> = {
  "label-district-south-quay": {
    context: DISTRICT_NARRATIVE.context,
    backstory: DISTRICT_NARRATIVE.backstory,
  },
  "label-street-copper-row": {
    context:
      "Lantern Row stays busy by catching the traffic between food, rooms, and whatever people need before the next shift.",
    backstory:
      "The name came from the lamps and windows that kept the row visible before dawn and after closing, making it one of the district's dependable through-lines.",
  },
  "label-street-fishbone": {
    context:
      "Cooper Lane is narrow, practical, and always moving somebody toward repairs, errands, or a quicker cut through the block.",
    backstory:
      "It picked up its name from the coopers and patchwork trades that used to crowd the lane, long before most of those shops folded into newer businesses.",
  },
  "label-street-gannet": {
    context:
      "Morrow Court feels residential only until you notice how much work, rent anxiety, and shared upkeep pass through it every hour.",
    backstory:
      "The court formed behind older boarding and service buildings, then slowly turned into a lived-in pocket where domestic life and labor never fully separated.",
  },
  "label-street-moss": {
    context:
      "Pilgrim Steps carries people toward the river, the slip, and whatever they are hoping to catch before it leaves.",
    backstory:
      "Its worn descent toward the water made it a natural route for workers, drifters, and cargo hands long before the paving ever matched the traffic.",
  },
  "label-landmark-riverside": {
    context:
      "The Brackenport docks are the city's visible engine, pulling labor, money, and weather straight into the streets around them.",
    backstory:
      "Everything around South Quay grew in relation to these docks, which made fortunes for merchants and long days for everybody else who kept the cargo moving.",
  },
};

export function getLocationNarrative(locationId: string): LocationNarrativeProfile {
  return LOCATION_NARRATIVES[locationId] ?? DEFAULT_LOCATION_NARRATIVE;
}

export function getMapLabelNarrative(labelId: string): MapLabelNarrativeProfile {
  return MAP_LABEL_NARRATIVES[labelId] ?? DEFAULT_LABEL_NARRATIVE;
}
