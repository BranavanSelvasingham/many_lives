import type { Character } from "../../domain/character.js";
import type {
  CityAxis,
  CityCurrent,
} from "../../domain/city.js";
import type { EventRecord, NewEvent } from "../../domain/event.js";
import type { PerceivedSignalKind } from "../../domain/perception.js";
import type { WorldState } from "../../domain/world.js";
import {
  addSystemFlag,
  hasSystemFlag,
  recordPerceivedSignal,
} from "../worldState.js";

export function detectCharacterPerceptions(
  world: WorldState,
  character: Character,
): NewEvent[] {
  const events: NewEvent[] = [];
  const liveCurrents = world.city.currents
    .filter((current) => current.status === "live")
    .filter((current) => !current.sensedByCharacterIds.includes(character.id))
    .filter((current) => perceptionScore(character, current) >= current.exclusivity)
    .sort(
      (left, right) =>
        perceptionScore(character, right) - perceptionScore(character, left),
    )
    .slice(0, 1);

  for (const current of liveCurrents) {
    const kind = signalKindForCurrent(current);
    current.sensedByCharacterIds.push(character.id);

    const signal = recordPerceivedSignal(world, {
      characterId: character.id,
      kind,
      axis: current.axis,
      summary: summaryForCurrentSignal(world, character, current, kind),
      source: current.title,
      districtId: current.districtId,
      currentId: current.id,
      strength: current.urgency,
      clarity: perceptionScore(character, current),
      createdAt: world.currentTime,
      tags: [...current.tags, current.axis, kind],
    });

    events.push({
      characterId: character.id,
      type: eventTypeForSignalKind(kind),
      priority: current.urgency >= 8 ? "high" : "medium",
      title: titleForCurrentSignal(current, kind),
      description: signal.summary,
      createdAt: world.currentTime,
      metadata: {
        currentId: current.id,
        signalId: signal.id,
        urgency: current.urgency,
        clarity: signal.clarity,
      },
    });
  }

  const ambientSignal = buildAmbientSignal(world, character);
  if (ambientSignal) {
    const signal = recordPerceivedSignal(world, {
      characterId: character.id,
      kind: ambientSignal.kind,
      axis: ambientSignal.axis,
      summary: ambientSignal.description,
      source: ambientSignal.source,
      districtId: ambientSignal.districtId,
      strength: ambientSignal.strength,
      clarity: ambientSignal.clarity,
      createdAt: world.currentTime,
      tags: ambientSignal.tags,
    });

    events.push({
      characterId: character.id,
      type: eventTypeForSignalKind(ambientSignal.kind),
      priority: ambientSignal.priority,
      title: ambientSignal.title,
      description: ambientSignal.description,
      createdAt: world.currentTime,
      metadata: {
        signalId: signal.id,
        strength: ambientSignal.strength,
        clarity: ambientSignal.clarity,
      },
    });
  }

  return events;
}

function perceptionScore(character: Character, current: CityCurrent): number {
  let score = 0;

  if (current.axis === character.policies.priorityBias) {
    score += 4;
  }

  if (current.axis === roleAxis(character.role)) {
    score += 3;
  }

  if (character.traits.includes("intuitive")) {
    score += 1;
  }

  if (character.traits.includes("discreet") && current.visibility === "hidden") {
    score += 1;
  }

  if (character.values.includes("novelty") && current.visibility !== "open") {
    score += 1;
  }

  score += Math.round(character.policies.riskTolerance * 2);

  return score;
}

function roleAxis(role: Character["role"]): CityAxis {
  switch (role) {
    case "architect":
      return "access";
    case "signal":
      return "signal";
    case "threshold":
      return "coherence";
    case "gravity":
    default:
      return "momentum";
  }
}

function signalKindForCurrent(current: CityCurrent): PerceivedSignalKind {
  if (current.axis === "access") {
    return "contact_shift";
  }

  if (current.axis === "momentum") {
    return "threshold_shift";
  }

  if (current.axis === "signal") {
    return "scene_heat";
  }

  if (current.tags.includes("prototype")) {
    return "tech_glimmer";
  }

  return "rumor_sharpened";
}

function eventTypeForSignalKind(kind: PerceivedSignalKind): EventRecord["type"] {
  switch (kind) {
    case "contact_shift":
      return "contact_shift";
    case "threshold_shift":
      return "threshold_shift";
    case "rumor_sharpened":
      return "rumor_sharpened";
    case "rival_trace":
      return "rival_trace";
    case "scene_heat":
      return "scene_heat";
    case "tech_glimmer":
    default:
      return "tech_glimmer";
  }
}

function titleForCurrentSignal(
  current: CityCurrent,
  kind: PerceivedSignalKind,
): string {
  switch (kind) {
    case "contact_shift":
      return `${current.title} changed who gets answered`;
    case "threshold_shift":
      return `${current.title} is changing who gets through`;
    case "scene_heat":
      return `${current.title} is heating the room`;
    case "tech_glimmer":
      return `${current.title} is changing what seems possible`;
    case "rumor_sharpened":
    default:
      return `${current.title} just became more precise`;
  }
}

function summaryForCurrentSignal(
  world: WorldState,
  character: Character,
  current: CityCurrent,
  kind: PerceivedSignalKind,
): string {
  const district = districtNameFor(world, current.districtId);

  switch (kind) {
    case "contact_shift":
      return `${character.name} noticed the answer pattern changing around ${current.title.toLowerCase()} in ${district}. A contact who usually deflects is suddenly willing to place names more carefully.`;
    case "threshold_shift":
      return `${character.name} felt the threshold around ${current.title.toLowerCase()} changing in ${district}. The same room is beginning to admit different people for different reasons.`;
    case "scene_heat":
      return `${character.name} can feel scene heat gathering around ${current.title.toLowerCase()} in ${district}. What looked fringe an hour ago is starting to pull attention off-axis.`;
    case "tech_glimmer":
      return `${character.name} caught a glimmer around ${current.title.toLowerCase()} in ${district}. Something technical is changing the class of life that room might permit.`;
    case "rumor_sharpened":
    default:
      return `${character.name} saw the rumor around ${current.title.toLowerCase()} sharpen in ${district}. What was atmospheric now has coordinates, tone, and timing.`;
  }
}

function buildAmbientSignal(
  world: WorldState,
  character: Character,
):
  | {
      kind: PerceivedSignalKind;
      axis: CityAxis;
      title: string;
      description: string;
      source: string;
      districtId?: string;
      strength: number;
      clarity: number;
      priority: NewEvent["priority"];
      tags: string[];
    }
  | undefined {
  const bucket = Math.floor(world.tickCount / 2);
  const highestClock = world.city.clocks
    .slice()
    .sort((left, right) => right.danger - left.danger)[0];

  if (
    world.cityState.rivalAttention >= 50 &&
    !hasSystemFlag(world, `rival-trace:${character.id}:${bucket}`)
  ) {
    addSystemFlag(world, `rival-trace:${character.id}:${bucket}`);
    return {
      kind: "rival_trace",
      axis: character.policies.priorityBias,
      title: "Another circle is moving early",
      description: `${character.name} caught a rival trace before the room fully turned. Another network is arriving early enough to shape the story, not just benefit from it.`,
      source: "rival-network",
      strength: world.cityState.rivalAttention,
      clarity: 6,
      priority: world.cityState.rivalAttention >= 70 ? "high" : "medium",
      tags: ["rival", "timing", "pressure"],
    };
  }

  if (!highestClock) {
    return undefined;
  }

  if (
    highestClock.label.toLowerCase().includes("cultural") &&
    character.role === "signal" &&
    !hasSystemFlag(world, `scene-heat:${character.id}:${bucket}`)
  ) {
    addSystemFlag(world, `scene-heat:${character.id}:${bucket}`);
    return {
      kind: "scene_heat",
      axis: "signal",
      title: "The scene is leaning before it declares itself",
      description: `${character.name} can feel a room beginning to lean before anyone has publicly admitted the shift. Taste is aligning faster than the visible narrative.`,
      source: highestClock.label,
      strength: highestClock.danger,
      clarity: 5,
      priority: "medium",
      tags: ["scene", "culture", "temperature"],
    };
  }

  if (
    highestClock.label.toLowerCase().includes("tech") &&
    (character.role === "architect" || character.role === "threshold") &&
    !hasSystemFlag(world, `tech-glimmer:${character.id}:${bucket}`)
  ) {
    addSystemFlag(world, `tech-glimmer:${character.id}:${bucket}`);
    return {
      kind: "tech_glimmer",
      axis: character.role === "architect" ? "access" : "coherence",
      title: "A private capability is surfacing",
      description: `${character.name} picked up a technical glimmer before the room found stable language for it. If it is real, old assumptions about access and status are about to go stale.`,
      source: highestClock.label,
      strength: highestClock.danger,
      clarity: 5,
      priority: "medium",
      tags: ["technology", "prototype", "signal"],
    };
  }

  return undefined;
}

function districtNameFor(world: WorldState, districtId: string): string {
  return (
    world.city.districts.find((district) => district.id === districtId)?.name ??
    "the city"
  );
}
