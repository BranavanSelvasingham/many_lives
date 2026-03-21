import type { Character } from "../../domain/character.js";
import type { CityAxis, CityCurrent } from "../../domain/city.js";
import type {
  ActiveIntent,
  InterpretationKind,
  InterpretationRecord,
} from "../../domain/intent.js";
import type {
  BeliefFrame,
  BeliefRecord,
  BeliefStatus,
  MemoryState,
} from "../../domain/memory.js";
import type { PerceivedSignal } from "../../domain/perception.js";
import type { RelationshipState } from "../../domain/relationship.js";
import type { WorldState } from "../../domain/world.js";
import {
  addSystemFlag,
  clamp,
  findMemoryState,
  findRelationshipsForCharacter,
  findSignalsForCharacter,
  hasSystemFlag,
  recordIntent,
  recordInterpretation,
} from "../worldState.js";

type InterpretationDraft = Omit<InterpretationRecord, "id">;

export function synchronizeInterpretationState(world: WorldState): void {
  for (const character of world.characters) {
    world.interpretations = world.interpretations.filter(
      (interpretation) => interpretation.characterId !== character.id,
    );
    world.activeIntents = world.activeIntents.filter(
      (intent) => intent.characterId !== character.id,
    );

    const memory = findMemoryState(world, character.id);
    const relationships = findRelationshipsForCharacter(world, character.id);
    const candidates = buildInterpretationCandidates(
      world,
      character,
      memory,
      relationships,
    )
      .sort(
        (left, right) =>
          scoreInterpretation(character, memory, right) -
          scoreInterpretation(character, memory, left),
      )
      .slice(0, 4);

    if (candidates.length === 0) {
      continue;
    }

    const stored = candidates.map((candidate) =>
      recordInterpretation(world, candidate),
    );

    stored.slice(0, 2).forEach((interpretation, index) => {
      const priority = scoreInterpretation(character, memory, interpretation);
      const intent = recordIntent(world, {
        characterId: character.id,
        kind: interpretation.kind,
        axis: interpretation.axis,
        source: interpretation.source,
        summary: summarizeIntent(character, interpretation),
        rationale: interpretation.rationale,
        priority,
        confidence: interpretation.confidence,
        createdAt: world.currentTime,
        sourceInterpretationId: interpretation.id,
        sourceSignalId: interpretation.sourceSignalId,
        sourceCurrentId: interpretation.sourceCurrentId,
        sourceRelationshipId: interpretation.sourceRelationshipId,
        sourceRivalId: interpretation.sourceRivalId,
        rank: index + 1,
      });

      if (memory && intent.rank === 1) {
        memory.beliefs = upsertBelief(
          memory.beliefs,
          intent,
          beliefTextFor(intent),
          world.currentTime,
        );
        memory.lastReflectionAt = world.currentTime;
      }
    });
  }

  applyCrossSelfFriction(world);
}

function buildInterpretationCandidates(
  world: WorldState,
  character: Character,
  memory: MemoryState | undefined,
  relationships: RelationshipState[],
): InterpretationDraft[] {
  const signalCandidates = findSignalsForCharacter(world, character.id)
    .slice(0, 4)
    .map((signal) => interpretationFromSignal(world, character, memory, signal));

  const visibleCurrentCandidates =
    signalCandidates.length > 0
      ? []
      : world.city.currents
          .filter(
            (current) =>
              current.status === "live" &&
              current.sensedByCharacterIds.includes(character.id),
          )
          .slice(0, 2)
          .map((current) =>
            interpretationFromVisibleCurrent(world, character, memory, current),
          );

  const pressureCandidates = [
    coherenceCandidate(character, memory, world),
    rivalryCandidate(character, world, relationships),
    entanglementCandidate(character, relationships, world.currentTime),
  ].filter((candidate): candidate is InterpretationDraft => candidate !== undefined);

  const candidates = [
    ...signalCandidates,
    ...visibleCurrentCandidates,
    ...pressureCandidates,
  ];

  return dedupeCandidates(candidates);
}

function interpretationFromSignal(
  world: WorldState,
  character: Character,
  memory: MemoryState | undefined,
  signal: PerceivedSignal,
) : InterpretationDraft {
  const lowClarity = signal.clarity <= 4;
  const kind: InterpretationKind =
    signal.kind === "rival_trace"
      ? "counter_rival"
      : signal.axis === "coherence" &&
          (memory?.coherence ?? character.memoryCoherence) <= 56
        ? "protect_coherence"
        : lowClarity || signal.kind === "rumor_sharpened" || signal.kind === "tech_glimmer"
          ? "verify_signal"
          : "press_advantage";

  return {
    characterId: character.id,
    kind,
    axis: signal.axis,
    summary: summaryForSignalInterpretation(character, signal, kind),
    rationale: rationaleForSignalInterpretation(character, signal, kind),
    source: signal.source,
    confidence: clamp(Math.round(signal.clarity), 1, 10),
    urgency: clamp(Math.round(signal.strength), 1, 10),
    createdAt: world.currentTime,
    sourceSignalId: signal.id,
    sourceCurrentId: signal.currentId,
    tags: [...signal.tags, kind],
  };
}

function interpretationFromVisibleCurrent(
  world: WorldState,
  character: Character,
  memory: MemoryState | undefined,
  current: CityCurrent,
) : InterpretationDraft {
  const kind: InterpretationKind =
    current.axis === "coherence" &&
      (memory?.coherence ?? character.memoryCoherence) <= 58
      ? "protect_coherence"
      : current.visibility === "hidden" || current.exclusivity >= 6
        ? "verify_signal"
        : "press_advantage";

  return {
    characterId: character.id,
    kind,
    axis: current.axis,
    summary:
      kind === "verify_signal"
        ? `${character.name} thinks ${current.title.toLowerCase()} is real, but not fully legible yet.`
        : `${character.name} thinks ${current.title.toLowerCase()} should be pressed before the board hardens.`,
    rationale:
      kind === "verify_signal"
        ? `${current.title} is visible at the edge of the board, but its full shape still depends on who else arrives.`
        : `${current.title} is already live in the city and aligns with ${character.name}'s current read of the board.`,
    source: current.title,
    confidence: current.visibility === "open" ? 7 : 5,
    urgency: current.urgency,
    createdAt: world.currentTime,
    sourceCurrentId: current.id,
    tags: [...current.tags, kind, "seeded-current"],
  };
}

function coherenceCandidate(
  character: Character,
  memory: MemoryState | undefined,
  world: WorldState,
): InterpretationDraft | undefined {
  const coherence = memory?.coherence ?? character.memoryCoherence;

  if (coherence > 55 && character.stress < 74) {
    return undefined;
  }

  return {
    characterId: character.id,
    kind: "protect_coherence" as const,
    axis: "coherence" as const,
    summary: `${character.name} thinks reach is outrunning coherence.`,
    rationale:
      "Recent moves are beginning to contradict each other. If this keeps compounding, later wins will belong to different selves than the ones earning them.",
    source: "internal-coherence",
    confidence: 8,
    urgency: clamp(Math.round((100 - coherence + character.stress) / 12), 5, 10),
    createdAt: world.currentTime,
    tags: ["coherence", "strain", "internal"],
  };
}

function rivalryCandidate(
  character: Character,
  world: WorldState,
  relationships: RelationshipState[],
): InterpretationDraft | undefined {
  const rivalRelationship = relationships
    .filter((relationship) => relationship.targetType === "rival")
    .sort((left, right) => right.strain - left.strain)[0];

  if (world.cityState.rivalAttention < 55 && !rivalRelationship) {
    return undefined;
  }

  return {
    characterId: character.id,
    kind: "counter_rival" as const,
    axis: character.policies.priorityBias,
    summary: `${character.name} thinks another circle is moving early enough to change the board.`,
    rationale: rivalRelationship
      ? `${rivalRelationship.label} is pulling hard against ${character.name}'s current position. Leaving that pressure unanswered gives them the next layer of story control.`
      : "Rival pressure has crossed the point where waiting stops being patience and starts becoming cession.",
    source: rivalRelationship?.label ?? "rival-pressure",
    confidence: rivalRelationship ? 8 : 6,
    urgency: clamp(Math.round(world.cityState.rivalAttention / 10), 5, 10),
    createdAt: world.currentTime,
    sourceRelationshipId: rivalRelationship?.id,
    sourceRivalId:
      rivalRelationship?.targetType === "rival"
        ? rivalRelationship.targetId
        : undefined,
    tags: ["rival", "pressure", "timing"],
  };
}

function entanglementCandidate(
  character: Character,
  relationships: RelationshipState[],
  currentTime: string,
): InterpretationDraft | undefined {
  const strainedRelationship = relationships
    .filter(
      (relationship) =>
        relationship.targetType !== "player" &&
        relationship.strain + relationship.dependency >= 85,
    )
    .sort(
      (left, right) =>
        right.strain + right.dependency - (left.strain + left.dependency),
    )[0];

  if (!strainedRelationship) {
    return undefined;
  }

  return {
    characterId: character.id,
    kind: "manage_entanglement" as const,
    axis:
      strainedRelationship.targetType === "rival"
        ? "momentum"
        : character.policies.priorityBias,
    summary: `${character.name} thinks ${strainedRelationship.label} is starting to decide too much of the board.`,
    rationale: `${strainedRelationship.summary} The pull is now strong enough that ignoring it would still count as choosing.`,
    source: strainedRelationship.label,
    confidence: 7,
    urgency: clamp(
      Math.round((strainedRelationship.strain + strainedRelationship.dependency) / 18),
      5,
      10,
    ),
    createdAt: currentTime,
    sourceRelationshipId: strainedRelationship.id,
    sourceRivalId:
      strainedRelationship.targetType === "rival"
        ? strainedRelationship.targetId
        : undefined,
    tags: ["relationship", "entanglement", strainedRelationship.targetType],
  };
}

function dedupeCandidates(candidates: InterpretationDraft[]): InterpretationDraft[] {
  const seen = new Set<string>();
  const deduped: InterpretationDraft[] = [];

  for (const candidate of candidates) {
    const key =
      candidate.sourceSignalId ??
      candidate.sourceRelationshipId ??
      `${candidate.kind}:${candidate.source}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function scoreInterpretation(
  character: Character,
  memory: MemoryState | undefined,
  interpretation: {
    kind: InterpretationKind;
    axis: CityAxis;
    confidence: number;
    urgency: number;
    source: string;
    sourceCurrentId?: string;
    sourceSignalId?: string;
    sourceRelationshipId?: string;
    sourceRivalId?: string;
  },
) {
  const coherence = memory?.coherence ?? character.memoryCoherence;
  const normalizedSource = interpretation.source.toLowerCase();
  const matchingBelief = memory?.beliefs.find(
    (belief) =>
      (interpretation.sourceCurrentId !== undefined &&
        belief.sourceCurrentId === interpretation.sourceCurrentId) ||
      (interpretation.sourceSignalId !== undefined &&
        belief.sourceSignalId === interpretation.sourceSignalId) ||
      (interpretation.sourceRelationshipId !== undefined &&
        belief.sourceRelationshipId === interpretation.sourceRelationshipId) ||
      (interpretation.sourceRivalId !== undefined &&
        belief.sourceRivalId === interpretation.sourceRivalId) ||
      belief.source.toLowerCase() === normalizedSource ||
      belief.belief.toLowerCase().includes(normalizedSource),
  );

  let score = interpretation.urgency + interpretation.confidence;

  if (interpretation.axis === character.policies.priorityBias) {
    score += 3;
  }

  if (interpretation.axis === roleAxis(character.role)) {
    score += 2;
  }

  if (matchingBelief) {
    score += Math.round(matchingBelief.confidence * 3);

    switch (matchingBelief.status) {
      case "confirmed":
        score += 3;
        break;
      case "held":
        score += 1;
        break;
      case "disproven":
        score -= 5;
        break;
      case "speculative":
      default:
        break;
    }
  }

  switch (character.role) {
    case "architect":
      if (
        interpretation.kind === "press_advantage" &&
        interpretation.axis === "access"
      ) {
        score += 3;
      }
      break;
    case "signal":
      if (interpretation.axis === "signal") {
        score += 3;
      }
      if (interpretation.kind === "verify_signal") {
        score += 1;
      }
      break;
    case "gravity":
      if (
        interpretation.kind === "counter_rival" ||
        interpretation.axis === "momentum"
      ) {
        score += 3;
      }
      break;
    case "threshold":
      if (
        interpretation.kind === "verify_signal" ||
        interpretation.axis === "coherence"
      ) {
        score += 3;
      }
      break;
  }

  if (interpretation.kind === "protect_coherence") {
    score += Math.max(0, Math.round((60 - coherence) / 3));
  }

  if (character.standingInstincts.some((instinct) => /move first/i.test(instinct))) {
    if (
      interpretation.kind === "press_advantage" ||
      interpretation.kind === "verify_signal"
    ) {
      score += 1;
    }
  }

  if (
    character.standingInstincts.some((instinct) => /protect/i.test(instinct)) &&
    interpretation.kind === "protect_coherence"
  ) {
    score += 1;
  }

  return score;
}

function summarizeIntent(
  character: Character,
  interpretation: {
    kind: InterpretationKind;
    source: string;
    axis: CityAxis;
  },
) {
  const source = humanizeSource(interpretation.source, interpretation.axis);

  switch (interpretation.kind) {
    case "verify_signal":
      return `${character.name} wants to verify ${source} before committing too hard.`;
    case "counter_rival":
      return `${character.name} wants to counter rival movement before it hardens.`;
    case "manage_entanglement":
      return `${character.name} wants to manage the pull around ${source}.`;
    case "protect_coherence":
      return `${character.name} wants to protect coherence before the selves shear apart.`;
    case "press_advantage":
    default:
      return `${character.name} wants to press ${source} into real position.`;
  }
}

function summaryForSignalInterpretation(
  character: Character,
  signal: PerceivedSignal,
  kind: InterpretationKind,
) {
  switch (kind) {
    case "verify_signal":
      return `${character.name} thinks ${signal.source.toLowerCase()} matters, but its shape is not stable enough to trust at face value.`;
    case "counter_rival":
      return `${character.name} thinks the signal around ${signal.source.toLowerCase()} is already carrying rival fingerprints.`;
    case "protect_coherence":
      return `${character.name} thinks ${signal.source.toLowerCase()} could pull the network out of coherence if pushed badly.`;
    case "press_advantage":
    default:
      return `${character.name} thinks ${signal.source.toLowerCase()} should be converted into position before the city adjusts.`;
  }
}

function rationaleForSignalInterpretation(
  character: Character,
  signal: PerceivedSignal,
  kind: InterpretationKind,
) {
  switch (kind) {
    case "verify_signal":
      return `${signal.summary} ${character.name} does not think the city has agreed on what this means yet.`;
    case "counter_rival":
      return `${signal.summary} Another circle is already close enough to author the next reading of the room.`;
    case "protect_coherence":
      return `${signal.summary} The upside is real, but so is the chance that different selves begin telling incompatible stories about why it matters.`;
    case "press_advantage":
    default:
      return `${signal.summary} The pattern is legible enough now that waiting would mostly benefit someone else.`;
  }
}

function beliefSubjectFor(intent: ActiveIntent) {
  switch (intent.kind) {
    case "protect_coherence":
      return "coherence";
    case "counter_rival":
      return "rival";
    case "manage_entanglement":
      return `relationship:${intent.sourceRelationshipId ?? intent.sourceRivalId ?? intent.axis}`;
    case "verify_signal":
    case "press_advantage":
    default:
      return `intent:${intent.sourceCurrentId ?? intent.sourceSignalId ?? intent.axis}`;
  }
}

function beliefTextFor(intent: ActiveIntent) {
  switch (intent.kind) {
    case "verify_signal":
      return roleBeliefText(
        intent,
        "This thread is live, but its real shape is still obscured. Moving too hard now could hand someone else the category.",
        "This thread is alive, but not fully ripe. Premature force could make the room remember the wrong thing.",
        "This threshold is open, but the hierarchy inside it is still unstable. Entering badly would make us decorative.",
        "This signal matters, but it may still be a mirage wearing coordinates.",
      );
    case "counter_rival":
      return roleBeliefText(
        intent,
        "Another circle is moving early enough to own the structure beneath the visible outcome.",
        "Another circle is close to narrating this thread before we do.",
        "Another circle is arriving early enough to decide who becomes central.",
        "Another circle is close enough to rename this signal before the city does.",
      );
    case "manage_entanglement":
      return roleBeliefText(
        intent,
        "One relationship is starting to determine too much of the machinery and needs handling.",
        "One relationship is starting to consume authorship rather than support it.",
        "One relationship is turning orbit into dependence.",
        "One relationship is deciding too much of which futures we can still touch.",
      );
    case "protect_coherence":
      return roleBeliefText(
        intent,
        "Reach is outrunning coherence. Structural wins earned like this may not remain ours.",
        "Reach is outrunning coherence. We may become unforgettable and still stop feeling singular.",
        "Reach is outrunning coherence. Too many rooms are asking for different versions of us.",
        "Reach is outrunning coherence. Too many futures are active at once for one self-story to hold.",
      );
    case "press_advantage":
    default:
      return roleBeliefText(
        intent,
        "This thread is legible enough to convert into leverage now.",
        "This thread can still be forced into cultural fact if pressed now.",
        "This thread can still shift the orbit map if claimed now.",
        "This thread is early enough to become destiny instead of rumor if entered now.",
      );
  }
}

function roleBeliefText(
  intent: ActiveIntent,
  architect: string,
  signal: string,
  gravity: string,
  threshold: string,
) {
  if (intent.axis === "access") {
    return architect;
  }

  if (intent.axis === "signal") {
    return signal;
  }

  if (intent.axis === "momentum") {
    return gravity;
  }

  return threshold;
}

function upsertBelief(
  beliefs: BeliefRecord[],
  intent: ActiveIntent,
  belief: string,
  createdAt: string,
) {
  const subject = beliefSubjectFor(intent);
  const existing = beliefs.find((entry) => entry.subject === subject);

  if (existing) {
    existing.belief = belief;
    existing.confidence = clamp(existing.confidence + 0.03, 0, 1);
    existing.frame = beliefFrameFor(intent.kind);
    existing.source = humanizeSource(intent.source, intent.axis);
    existing.lastUpdatedAt = createdAt;
    existing.sourceCurrentId = intent.sourceCurrentId;
    existing.sourceSignalId = intent.sourceSignalId;
    existing.sourceRelationshipId = intent.sourceRelationshipId;
    existing.sourceRivalId = intent.sourceRivalId;
    return beliefs;
  }

  return [
    {
      id: `belief-${subject}`,
      subject,
      belief,
      confidence: 0.58,
      status: defaultBeliefStatusFor(intent.kind),
      frame: beliefFrameFor(intent.kind),
      source: humanizeSource(intent.source, intent.axis),
      lastUpdatedAt: createdAt,
      sourceCurrentId: intent.sourceCurrentId,
      sourceSignalId: intent.sourceSignalId,
      sourceRelationshipId: intent.sourceRelationshipId,
      sourceRivalId: intent.sourceRivalId,
    },
    ...beliefs,
  ].slice(0, 12);
}

function beliefFrameFor(kind: InterpretationKind): BeliefFrame {
  switch (kind) {
    case "verify_signal":
      return "verify";
    case "counter_rival":
      return "counter";
    case "manage_entanglement":
      return "entanglement";
    case "protect_coherence":
      return "stabilize";
    case "press_advantage":
    default:
      return "claim";
  }
}

function defaultBeliefStatusFor(kind: InterpretationKind): BeliefStatus {
  switch (kind) {
    case "verify_signal":
      return "speculative";
    case "counter_rival":
    case "manage_entanglement":
    case "protect_coherence":
    case "press_advantage":
    default:
      return "held";
  }
}

function applyCrossSelfFriction(world: WorldState) {
  applySharedSubjectFriction(world);
  applyStrategicFriction(world);
}

function applySharedSubjectFriction(world: WorldState) {
  const intentsBySource = new Map<string, ActiveIntent[]>();

  for (const intent of world.activeIntents.filter((entry) => entry.rank === 1)) {
    const sourceKey =
      intent.sourceCurrentId ??
      intent.sourceRelationshipId ??
      intent.sourceRivalId;

    if (!sourceKey) {
      continue;
    }

    intentsBySource.set(sourceKey, [
      ...(intentsBySource.get(sourceKey) ?? []),
      intent,
    ]);
  }

  for (const [sourceKey, intents] of intentsBySource.entries()) {
    if (intents.length < 2 || !hasConflictingReads(intents)) {
      continue;
    }

    const flag = `friction:source:${sourceKey}:${Math.floor(world.tickCount / 4)}`;
    if (hasSystemFlag(world, flag)) {
      continue;
    }

    addSystemFlag(world, flag);
    applyFriction(world, intents, 2, `Conflicting read around ${sourceKey}`);
  }
}

function applyStrategicFriction(world: WorldState) {
  const dominantIntents = world.activeIntents.filter((intent) => intent.rank === 1);
  const coherenceIntent = dominantIntents.find(
    (intent) => intent.kind === "protect_coherence",
  );
  const aggressiveIntents = dominantIntents.filter((intent) =>
    intent.kind === "press_advantage" || intent.kind === "counter_rival",
  );

  if (!coherenceIntent || aggressiveIntents.length < 2) {
    return;
  }

  const flag = `friction:strategy:${Math.floor(world.tickCount / 4)}`;
  if (hasSystemFlag(world, flag)) {
    return;
  }

  addSystemFlag(world, flag);
  applyFriction(
    world,
    [coherenceIntent, ...aggressiveIntents],
    1,
    "Conflicting strategic reads across the selves",
  );
}

function hasConflictingReads(intents: ActiveIntent[]) {
  const kinds = new Set(intents.map((intent) => intent.kind));

  return (
    (kinds.has("press_advantage") || kinds.has("counter_rival")) &&
    (kinds.has("verify_signal") ||
      kinds.has("protect_coherence") ||
      kinds.has("manage_entanglement"))
  );
}

function applyFriction(
  world: WorldState,
  intents: ActiveIntent[],
  penalty: number,
  threadLabel: string,
) {
  const touchedCharacters = new Set(intents.map((intent) => intent.characterId));

  for (const characterId of touchedCharacters) {
    const memory = findMemoryState(world, characterId);
    const character = world.characters.find((entry) => entry.id === characterId);

    if (!memory || !character) {
      continue;
    }

    memory.coherence = clamp(memory.coherence - penalty, 0, 100);
    memory.unresolvedThreads = uniqueThreads([
      threadLabel,
      ...memory.unresolvedThreads,
    ]).slice(0, 8);
    character.memoryCoherence = memory.coherence;

    for (const belief of memory.beliefs) {
      if (
        intents.some((intent) =>
          belief.subject === beliefSubjectFor(intent) ||
          belief.subject.endsWith(intent.axis),
        )
      ) {
        belief.confidence = clamp(belief.confidence - 0.05, 0, 1);
      }
    }
  }

  world.cityState.coherence = clamp(world.cityState.coherence - penalty, 0, 100);
}

function uniqueThreads(threads: string[]) {
  return Array.from(new Set(threads));
}

function humanizeSource(source: string, axis: CityAxis) {
  const normalized = source.trim();

  if (normalized.length === 0) {
    return axis;
  }

  if (normalized === "internal-coherence") {
    return "internal coherence";
  }

  if (normalized === "rival-pressure") {
    return "rival pressure";
  }

  if (normalized === "rival-network") {
    return "rival network";
  }

  return normalized;
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
