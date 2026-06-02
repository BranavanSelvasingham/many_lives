import type {
  CityEventState,
  CityEventStatus,
  StreetGameState,
} from "./types.js";

const DAY_MINUTES = 24 * 60;
const SCENARIO_START = "2026-03-21T11:00:00.000Z";
const SCENARIO_START_MINUTE = 11 * 60;

type CityEventDefinition = Pick<
  CityEventState,
  | "id"
  | "kind"
  | "locationId"
  | "participants"
  | "startMinute"
  | "endMinute"
  | "title"
>;

type CityEventResolution = Pick<
  CityEventState,
  "outcome" | "progress" | "status" | "summary" | "tone" | "visibleLabel"
>;

const CITY_EVENT_DEFINITIONS: CityEventDefinition[] = [
  {
    id: "event-cafe-prep",
    kind: "cafe_prep",
    locationId: "tea-house",
    participants: ["npc-ada"],
    startMinute: 10 * 60,
    endMinute: 12 * 60,
    title: "Kettle & Lamp prep",
  },
  {
    id: "event-lunch-rush",
    kind: "lunch_rush",
    locationId: "tea-house",
    participants: ["npc-ada"],
    startMinute: 12 * 60,
    endMinute: 15 * 60,
    title: "Lunch rush",
  },
  {
    id: "event-market-crossing",
    kind: "market_crossing",
    locationId: "market-square",
    startMinute: 8 * 60,
    endMinute: 18 * 60,
    title: "Square foot traffic",
  },
  {
    id: "event-square-cart",
    kind: "square_cart",
    locationId: "market-square",
    startMinute: 12 * 60,
    endMinute: 17 * 60,
    title: "Jammed handcart",
  },
  {
    id: "event-yard-loading",
    kind: "yard_loading",
    locationId: "freight-yard",
    participants: ["npc-tomas"],
    startMinute: 13 * 60,
    endMinute: 17 * 60,
    title: "Freight yard loading",
  },
];

export function createInitialCityEvents(): CityEventState[] {
  return CITY_EVENT_DEFINITIONS.map((definition) =>
    buildCityEvent(definition, undefined, undefined),
  );
}

export function syncCityEvents(world: StreetGameState): void {
  const previousEvents = new Map(
    (world.cityEvents ?? []).map((event) => [event.id, event]),
  );

  world.cityEvents = CITY_EVENT_DEFINITIONS.map((definition) =>
    buildCityEvent(definition, world, previousEvents.get(definition.id)),
  );
}

function buildCityEvent(
  definition: CityEventDefinition,
  world?: StreetGameState,
  previous?: CityEventState,
): CityEventState {
  const resolved = resolveCityEvent(definition, world);
  const updatedAt =
    previous &&
    previous.status === resolved.status &&
    previous.progress === resolved.progress &&
    previous.outcome === resolved.outcome &&
    previous.tone === resolved.tone &&
    previous.summary === resolved.summary
      ? previous.updatedAt
      : (world?.currentTime ?? SCENARIO_START);
  const resolvedAt =
    resolved.status === "resolved"
      ? (previous?.resolvedAt ?? world?.currentTime ?? SCENARIO_START)
      : undefined;

  return {
    ...definition,
    ...resolved,
    resolvedAt,
    updatedAt,
  };
}

function resolveCityEvent(
  definition: CityEventDefinition,
  world?: StreetGameState,
): CityEventResolution {
  const minute = minuteOfDay(world);

  switch (definition.kind) {
    case "cafe_prep":
      return resolveCafePrep(definition, world, minute);
    case "lunch_rush":
      return resolveLunchRush(definition, world, minute);
    case "market_crossing": {
      const status = windowStatus(definition, minute);
      return {
        outcome: status === "resolved" ? "passed" : "pending",
        progress: "steady",
        status,
        summary:
          "Porters, neighbors, and lunch-bound regulars keep cutting across the square instead of leaving it empty.",
        tone: "info",
        visibleLabel: "Foot traffic",
      };
    }
    case "square_cart":
      return resolveSquareCart(definition, world, minute);
    case "yard_loading":
      return resolveYardLoading(definition, world, minute);
  }
}

function resolveCafePrep(
  definition: CityEventDefinition,
  world: StreetGameState | undefined,
  minute: number,
): CityEventResolution {
  const teaStage = world?.firstAfternoon?.teaShiftStage;
  const status =
    teaStage || minute >= definition.endMinute
      ? "resolved"
      : windowStatus(definition, minute);

  if (status === "active") {
    return {
      outcome: "pending",
      progress: "setting-up",
      status,
      summary:
        "Ada is stacking cups, towels, and table space before the noon room fills.",
      tone: "lead",
      visibleLabel: "Cafe prep",
    };
  }

  return {
    outcome: status === "resolved" ? "passed" : "pending",
    progress: status === "resolved" ? "handed-to-rush" : "waiting",
    status,
    summary:
      status === "resolved"
        ? "The setup work has turned into the lunch rush inside Kettle & Lamp."
        : "Kettle & Lamp is still quiet enough that the coming rush is only a pressure in the room.",
    tone: "info",
    visibleLabel: "Cafe prep",
  };
}

function resolveLunchRush(
  definition: CityEventDefinition,
  world: StreetGameState | undefined,
  minute: number,
): CityEventResolution {
  const teaJob = world?.jobs.find((job) => job.id === "job-tea-shift");
  const teaStage = world?.firstAfternoon?.teaShiftStage;

  if (teaJob?.missed) {
    return {
      outcome: "missed",
      progress: "missed",
      status: "resolved",
      summary:
        "The lunch room moved on without Rowan, and Ada has no reason to count on him today.",
      tone: "warning",
      visibleLabel: "Rush missed",
    };
  }

  if (teaStage === "paid" || teaJob?.completed) {
    return {
      outcome: "handled",
      progress: "paid",
      status: "resolved",
      summary:
        "The rush is easing because Rowan kept cups, tables, and the counter moving long enough to get paid.",
      tone: "lead",
      visibleLabel: "Rush handled",
    };
  }

  if (teaStage === "counter") {
    return {
      outcome: "pending",
      progress: "counter",
      status: "active",
      summary:
        "Kettle & Lamp is still hot with lunch traffic, but Ada is trusting Rowan with the counter rhythm now.",
      tone: "lead",
      visibleLabel: "Counter pass",
    };
  }

  if (teaStage === "rush" || teaJob?.accepted) {
    return {
      outcome: "pending",
      progress: "rush",
      status: "active",
      summary:
        "Tables are filling at Kettle & Lamp, and Rowan has to prove he can keep the small tasks moving.",
      tone: "lead",
      visibleLabel: "Lunch rush",
    };
  }

  const status = windowStatus(definition, minute);
  return {
    outcome: status === "resolved" ? "missed" : "pending",
    progress: status === "active" ? "open" : "waiting",
    status,
    summary:
      status === "active"
        ? "The lunch room is filling now; Ada needs help before the counter starts slipping."
        : "The noon rush is close enough that Kettle & Lamp already feels braced for it.",
    tone: status === "active" ? "lead" : "info",
    visibleLabel: "Lunch rush",
  };
}

function resolveSquareCart(
  definition: CityEventDefinition,
  world: StreetGameState | undefined,
  minute: number,
): CityEventResolution {
  const cartProblem = world?.problems.find(
    (problem) => problem.id === "problem-cart",
  );

  if (cartProblem?.status === "solved") {
    return {
      outcome: "handled",
      progress: "rolling",
      status: "resolved",
      summary:
        "The handcart is rolling again, and the square has room for people to pass.",
      tone: "info",
      visibleLabel: "Cart cleared",
    };
  }

  if (cartProblem?.status === "expired") {
    return {
      outcome: "worsened",
      progress: "missed",
      status: "resolved",
      summary:
        "The jammed cart already made the square harder to cross before anyone fixed it.",
      tone: "warning",
      visibleLabel: "Cart jam passed",
    };
  }

  const status =
    cartProblem?.status === "active"
      ? "active"
      : windowStatus(definition, minute);

  if (status === "active") {
    return {
      outcome: "pending",
      progress: "jammed",
      status,
      summary:
        "A delivery handcart is pinching foot traffic through Quay Square before it turns into a bigger nuisance.",
      tone: "warning",
      visibleLabel: "Cart jam",
    };
  }

  return {
    outcome: status === "resolved" ? "passed" : "pending",
    progress: "approaching",
    status,
    summary:
      "A loaded handcart is waiting near the square, still only a small problem if someone notices early.",
    tone: "info",
    visibleLabel: "Cart waiting",
  };
}

function resolveYardLoading(
  definition: CityEventDefinition,
  world: StreetGameState | undefined,
  minute: number,
): CityEventResolution {
  const yardJob = world?.jobs.find((job) => job.id === "job-yard-shift");

  if (yardJob?.completed) {
    return {
      outcome: "handled",
      progress: "loaded",
      status: "resolved",
      summary:
        "The yard load is done cleanly, and Tomas has one less reason to doubt Rowan.",
      tone: "lead",
      visibleLabel: "Load done",
    };
  }

  if (yardJob?.missed) {
    return {
      outcome: "missed",
      progress: "missed",
      status: "resolved",
      summary:
        "The loading block moved without Rowan; Tomas has no reason to hold today's work open.",
      tone: "warning",
      visibleLabel: "Yard missed",
    };
  }

  if (yardJob?.accepted) {
    return {
      outcome: "pending",
      progress: "committed",
      status: "active",
      summary:
        "The freight yard has a live loading block, and Tomas is expecting Rowan to show up.",
      tone: "lead",
      visibleLabel: "Yard work",
    };
  }

  const status = windowStatus(definition, minute);
  return {
    outcome: status === "resolved" ? "passed" : "pending",
    progress: yardJob?.discovered ? "posted" : "background",
    status,
    summary: yardJob?.discovered
      ? "Tomas has a loading block posted at North Crane Yard for someone who can keep a promise."
      : "The freight yard keeps moving in the background, still more rumor than opportunity to Rowan.",
    tone: yardJob?.discovered && status === "active" ? "lead" : "info",
    visibleLabel: "Yard loading",
  };
}

function windowStatus(
  definition: Pick<CityEventState, "startMinute" | "endMinute">,
  minute: number,
): CityEventStatus {
  if (minute < definition.startMinute) {
    return "upcoming";
  }

  if (minute < definition.endMinute) {
    return "active";
  }

  return "resolved";
}

function minuteOfDay(world?: StreetGameState) {
  return world
    ? ((world.clock.totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
    : SCENARIO_START_MINUTE;
}
