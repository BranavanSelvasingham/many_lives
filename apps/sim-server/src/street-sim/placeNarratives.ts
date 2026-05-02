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
    "Brackenport runs on tide tables, cafe bells, sun-warmed errands, and people who learn where they can be kind before the day gets busy.",
  backstory:
    "It grew around the water, then softened into a city of small squares, tea rooms, repair stalls, and seaside habits where practical favors travel as easily as gossip.",
};

export const DISTRICT_NARRATIVE: SettingNarrativeProfile = {
  context:
    "South Quay is where Brackenport slows down by the water. Tea, errands, repairs, room keys, gossip, and small favors all meet in a bright quay-side square.",
  backstory:
    "It began as service lanes for the docks and simple rooms for passing hands, then grew into a waterfront quarter where second chances are usually offered over a cup of tea.",
};

const DEFAULT_LOCATION_NARRATIVE: LocationNarrativeProfile = {
  description:
    "A small piece of South Quay doing its part in the day.",
  context:
    "People come through here because the square has a way of pulling errands into conversation.",
  backstory:
    "Like most places in South Quay, it started practical and slowly learned how to be pleasant too.",
};

const LOCATION_NARRATIVES: Record<string, LocationNarrativeProfile> = {
  "boarding-house": {
    description:
      "A narrow boarding house with warm stair rails, thin walls, and a keeper who notices who comes back tired but still rinses their cup.",
    context:
      "Morrow House is where people in South Quay try to make a temporary room feel a little more like home.",
    backstory:
      "It started as overflow rooms for dock hands and carters, then became a boarding house that stays steady through shared chores, paid rent, and gentle habits.",
  },
  "tea-house": {
    description:
      "A bright tea room facing the square, where gossip, lunch plates, small jobs, and favors all pass over the same counter.",
    context:
      "Kettle & Lamp keeps the district stitched together with warm cups, quick lunches, and practical little arrangements.",
    backstory:
      "It was built to feed and warm people coming off the lanes, and over time it turned into the kind of cafe where jobs, apologies, and warnings all arrive with tea.",
  },
  "repair-stall": {
    description:
      "A repair stall full of secondhand tools, bent brass, and little fixes laid out in the sea air.",
    context:
      "Mercer Repairs is where broken things come when replacing them feels wasteful and Jo is in the mood to help.",
    backstory:
      "The stall grew out of salvaged parts and stubborn workmanship, building a reputation on repairs that outlast the promise they were sold with.",
  },
  courtyard: {
    description:
      "Buckets, laundry lines, cracked stone, and a hand pump everyone has been politely ignoring.",
    context:
      "Morrow Yard is shared breathing room, laundry space, and morning coffee territory for the people living around it.",
    backstory:
      "It used to be a service yard for carts and coal, and now it carries the quieter labor of washing, hauling, waiting, and dealing with whatever the boarding house cannot keep indoors.",
  },
  "market-square": {
    description:
      "A stone square opening toward the water, with notices, carts, awnings, cafe chairs, and half-heard chances crossing all day.",
    context:
      "Quay Square is the district's public pulse, where opportunities and problems both become visible before lunch.",
    backstory:
      "It formed where the lanes widened enough for trading tables and public notices, and it stayed important because South Quay needs one place where everybody's version of the day collides in full view of the quay road.",
  },
  "freight-yard": {
    description:
      "Crates, ropes, handcarts, sun on the stones, and Tomas pretending he does not enjoy the sea breeze.",
    context:
      "North Crane Yard turns a short burst of labor into coin, preferably before the afternoon gets too sleepy.",
    backstory:
      "It expanded from a riverside loading patch into a busy workyard that answers to cargo schedules but still gets the same afternoon light as the cafe.",
  },
  "moss-pier": {
    description:
      "Wet planks, rope burns, gull noise, and low quay steps where boats rock close enough to make everyone speak softer.",
    context:
      "Pilgrim Slip is where the district feels the water most directly, with arrivals, departures, and rumors all coming in on the same breeze.",
    backstory:
      "It began as a practical unloading pier and kept its importance because small boats, side cargo, and unofficial errands still need somewhere less polished than the main docks or more formal quay walls.",
  },
};

const DEFAULT_LABEL_NARRATIVE: MapLabelNarrativeProfile = {
  context:
    "This part of the district carries its own habits, timing, and local memory.",
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
  "label-street-harbor-walk": {
    context:
      "Harbor Walk is where the square turns toward the river and the district starts to feel the pull of the slip.",
    backstory:
      "The name stuck once the market edge, quay road, and dock approach began reading as one continuous waterfront walk.",
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
