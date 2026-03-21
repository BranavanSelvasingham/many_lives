import type { CityAxis, CityCurrent } from "../../domain/city.js";
import type { NewEvent } from "../../domain/event.js";
import type { WorldState } from "../../domain/world.js";
import { clamp } from "../worldState.js";

export function advanceCityState(world: WorldState): NewEvent[] {
  const events: NewEvent[] = [];

  for (const clock of world.city.clocks) {
    clock.progress = Math.min(clock.maxProgress, clock.progress + 1);
  }

  for (const rival of world.city.rivals) {
    rival.momentum = clamp(
      rival.momentum + 1 + (world.tickCount % 2 === 0 ? 1 : 0),
      0,
      100,
    );
    rival.threat = clamp(
      rival.threat + (rival.focus === dominantAxis(world) ? 2 : 1),
      0,
      100,
    );
  }

  for (const current of world.city.currents) {
    if (current.status === "forming" && world.tickCount >= 1) {
      current.status = "live";
    }

    if (
      current.status === "live" &&
      current.dissipatesAtTick !== undefined &&
      world.tickCount >= current.dissipatesAtTick &&
      !current.seizedByCharacterId
    ) {
      const rival = mostAlignedRival(world, current.axis);
      current.status = "claimed";
      current.lockedByRivalId = rival?.id;

      events.push({
        characterId: primaryCharacterIdForAxis(current.axis),
        type: "current_lost",
        priority: current.urgency >= 8 ? "critical" : "high",
        title: `${current.title} hardened elsewhere`,
        description: rival
          ? `${rival.name} moved first on ${current.title.toLowerCase()}, turning a live city current into someone else's leverage.`
          : `${current.title} hardened before one of your selves could translate it into position.`,
        createdAt: world.currentTime,
        metadata: {
          urgency: current.urgency,
        },
      });
    }
  }

  world.cityState.risk = clamp(world.cityState.risk + 1, 0, 100);
  world.cityState.rivalAttention = clamp(
    world.cityState.rivalAttention + 2,
    0,
    100,
  );
  world.cityState.windowNarrowing = clamp(
    world.cityState.windowNarrowing + 2,
    0,
    100,
  );
  world.cityState.momentum = clamp(
    world.cityState.momentum + (world.tickCount % 3 === 0 ? 1 : 0),
    0,
    100,
  );

  world.city.summaryLines = [
    `${world.city.name} is reordering itself under pressure from patronage collapse, emergent technology, and cultural vacancy.`,
    `${world.city.currents.filter((current) => current.status === "live").length} live currents are still shaping the map.`,
    `${world.city.rivals
      .slice()
      .sort((left, right) => right.threat - left.threat)[0]?.name ?? "Rival circles"} are moving faster than yesterday.`,
  ];

  if (world.tickCount > 0 && world.tickCount % 4 === 0) {
    events.push({
      characterId: primaryCharacterIdForAxis(dominantAxis(world)),
      type: "world_shift",
      priority: "high",
      title: "Window narrowing",
      description:
        "The Ascension Window is tightening. Rooms that felt merely volatile are now becoming irreversible.",
      createdAt: world.currentTime,
      metadata: {
        narrowing: world.cityState.windowNarrowing,
        rivalAttention: world.cityState.rivalAttention,
      },
    });
  }

  if (world.tickCount > 0 && world.tickCount % 3 === 0) {
    const rival = world.city.rivals
      .slice()
      .sort((left, right) => right.momentum - left.momentum)[0];

    if (rival) {
      events.push({
        characterId: primaryCharacterIdForAxis(rival.focus),
        type: "rival_advance",
        priority: rival.threat >= 70 ? "critical" : "high",
        title: `${rival.name} accelerated`,
        description: `${rival.name} is consolidating ${rival.focus} while the city is still unstable enough to be won.`,
        createdAt: world.currentTime,
        metadata: {
          threat: rival.threat,
          momentum: rival.momentum,
        },
      });
    }
  }

  world.cityState.worldPulse = [
    `${world.city.currents.filter((current) => current.status === "live").length} live currents beneath the city`,
    `${world.city.rivals.length} rival circles in motion`,
    `${world.city.clocks.map((clock) => `${clock.label} ${clock.progress}/${clock.maxProgress}`).join(" | ")}`,
  ];
  world.cityState.rivalStatus = `${world.city.rivals
    .slice()
    .sort((left, right) => right.threat - left.threat)[0]?.name ?? "A rival circle"} is pressing hardest through ${dominantAxis(world)}.`;

  return events;
}

function dominantAxis(world: WorldState): CityAxis {
  const ranked = (
    [
      ["access", world.cityState.access],
      ["momentum", world.cityState.momentum],
      ["signal", world.cityState.signal],
      ["coherence", world.cityState.coherence],
    ] satisfies Array<[CityAxis, number]>
  ).sort((left, right) => right[1] - left[1]);

  return ranked[0]?.[0] ?? "momentum";
}

function mostAlignedRival(world: WorldState, axis: CityAxis) {
  return world.city.rivals
    .filter((rival) => rival.focus === axis)
    .sort((left, right) => right.threat - left.threat)[0];
}

function primaryCharacterIdForAxis(axis: CityAxis): string {
  switch (axis) {
    case "access":
      return "ivo";
    case "signal":
      return "sia";
    case "coherence":
      return "vale";
    case "momentum":
    default:
      return "ren";
  }
}
