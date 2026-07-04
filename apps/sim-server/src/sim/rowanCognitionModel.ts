import type {
  RowanAutonomyEffect,
  RowanAutonomyLayer,
  RowanAutonomyStepKind,
  StreetGameState,
} from "../street-sim/types.js";
import {
  objectiveRouteNotebookBeliefMatchesObjective,
  objectiveRouteNotebookBeliefScoreAdjustment,
  objectiveRouteNotebookBeliefs,
  objectiveRouteNotebookRecoveryPlanKind,
} from "./objectiveScaffolds.js";
import { rowanNotebookUsesRecoveryRestNeed } from "./rowanCognitionNarratives.js";

export type RowanNeedKey =
  | "shelter"
  | "income"
  | "belonging"
  | "orientation"
  | "rest";

export type RowanNeedStatus = "urgent" | "active" | "stable";
export type RowanBeliefConfidence = "possible" | "promising" | "confirmed";

export interface RowanNeed {
  key: RowanNeedKey;
  label: string;
  status: RowanNeedStatus;
  score: number;
  reason: string;
}

export interface RowanBelief {
  id: string;
  topic: "shelter" | "work" | "belonging" | "tool" | "help";
  text: string;
  confidence: RowanBeliefConfidence;
  source: string;
  npcId?: string;
  locationId?: string;
}

export interface RowanNextMove {
  text: string;
  rationale: string;
  effects?: RowanAutonomyEffect[];
  layer?: RowanAutonomyLayer;
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
  kind?: RowanAutonomyStepKind;
}

export interface RowanCognition {
  primaryNeed?: RowanNeed;
  needs: RowanNeed[];
  beliefs: RowanBelief[];
  nextMove?: RowanNextMove;
}

interface RowanCognitionSnapshot {
  primaryNeed?: RowanNeed;
  needs: RowanNeed[];
  beliefs: RowanBelief[];
  nextMove?: RowanNextMove;
}

export function buildRowanNeeds(world: StreetGameState): RowanNeed[] {
  const needs: RowanNeed[] = [];
  const money = world.player.money;
  const energy = world.player.energy;
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;
  const familiarPeople = world.npcs.filter((npc) => npc.trust >= 1).length;
  const knownPlaces = world.player.knownLocationIds.length;
  const activeJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const hasCompletedWork = world.jobs.some((job) => job.completed);
  const maraTopics = npcReplyTopics(world, "npc-mara");
  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const firstAfternoonSettled = Boolean(
    world.firstAfternoon?.completedAt || world.firstAfternoon?.fieldNote,
  );
  const hasRoomTerms =
    firstAfternoonSettled ||
    houseStanding >= 2 ||
    hasAnyTopic(maraTopics, ["home", "stay"]);

  needs.push({
    key: "shelter",
    label: "Keep a stable room",
    status: firstAfternoonSettled
      ? "stable"
      : houseStanding < 1 && !hasRoomTerms
        ? "urgent"
        : hasRoomTerms && houseStanding >= 2
          ? "stable"
          : "active",
    score: firstAfternoonSettled
      ? 16
      : houseStanding < 1 && !hasRoomTerms
        ? 92
        : hasRoomTerms && houseStanding >= 2
          ? 24
          : 68,
    reason: firstAfternoonSettled
      ? "Tonight's bed has evidence behind it; the next pressure is what Rowan does with that foothold."
      : hasRoomTerms
        ? "Rowan knows more about staying on, but still needs to make himself worth keeping."
        : "He still does not fully know what keeps tonight's bed from staying temporary.",
  });

  needs.push({
    key: "income",
    label: "Find steady income",
    status:
      activeJob || hasCompletedWork || money >= 20
        ? "stable"
        : money < 12
          ? "urgent"
          : "active",
    score:
      activeJob || hasCompletedWork || money >= 20 ? 28 : money < 12 ? 88 : 74,
    reason: activeJob
      ? "There is work in hand, so now it is about following through."
      : "Coins only buy Rowan a little breathing room if the next job does not materialize.",
  });

  needs.push({
    key: "belonging",
    label: "Stop feeling like a stranger",
    status:
      trustedPeople >= 2 ? "stable" : familiarPeople > 0 ? "active" : "urgent",
    score: trustedPeople >= 2 ? 20 : familiarPeople > 0 ? 58 : 72,
    reason:
      trustedPeople >= 2
        ? "A couple of people are starting to feel like real footholds."
        : "He still needs people who will remember him as more than a face passing through.",
  });

  needs.push({
    key: "orientation",
    label: "Learn how South Quay fits together",
    status:
      knownPlaces >= 4 ? "stable" : knownPlaces >= 3 ? "active" : "urgent",
    score: knownPlaces >= 4 ? 18 : knownPlaces >= 3 ? 46 : 62,
    reason:
      knownPlaces >= 4
        ? "The district is starting to make sense in pieces."
        : "He still needs a better mental map before every lead feels like a gamble.",
  });

  needs.push({
    key: "rest",
    label: "Keep enough energy to follow through",
    status: energy < 35 ? "urgent" : energy < 55 ? "active" : "stable",
    score: energy < 35 ? 96 : energy < 55 ? 48 : 12,
    reason:
      energy < 35
        ? "If Rowan keeps pushing at this energy, he will start making bad decisions."
        : "He can still act, but the day is starting to sit in his legs.",
  });

  return needs.sort((left, right) => right.score - left.score);
}

export function buildRowanBeliefs(world: StreetGameState): RowanBelief[] {
  const maraKnown = world.player.knownNpcIds.includes("npc-mara");
  const adaKnown = world.player.knownNpcIds.includes("npc-ada");
  const joKnown = world.player.knownNpcIds.includes("npc-jo");
  const tomasKnown = world.player.knownNpcIds.includes("npc-tomas");
  const niaKnown = world.player.knownNpcIds.includes("npc-nia");
  const maraTopics = npcReplyTopics(world, "npc-mara");
  const adaTopics = npcReplyTopics(world, "npc-ada");
  const tomasTopics = npcReplyTopics(world, "npc-tomas");
  const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
  const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = world.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const objectiveText = world.player.objective?.text.toLowerCase() ?? "";
  const firstAfternoonSettled = Boolean(world.firstAfternoon?.completedAt);
  const objectiveSuggestsNiaLead =
    /\bnia\b|\bblock\b|\bjam\b|\bcart\b|\bsquare\b/.test(objectiveText);

  return objectiveRouteNotebookBeliefs({
    firstAfternoonFieldNoteRecorded: Boolean(world.firstAfternoon?.fieldNote),
    firstAfternoonSettled,
    knownNpcs: {
      ada: adaKnown,
      jo: joKnown,
      mara: maraKnown,
      nia: niaKnown,
      tomas: tomasKnown,
    },
    leads: {
      niaCurrentObjective: objectiveSuggestsNiaLead,
      pumpDiscovered: Boolean(pumpProblem?.discovered),
      teaJobDiscovered: Boolean(teaJob?.discovered),
      yardJobDiscovered: Boolean(yardJob?.discovered),
    },
    confidence: {
      adaWork: hasAnyTopic(adaTopics, ["work"])
        ? "confirmed"
        : teaJob?.discovered
          ? "promising"
          : "possible",
      firstAfternoonFieldNote: world.firstAfternoon?.fieldNote
        ? "confirmed"
        : "promising",
      maraRoom: hasAnyTopic(maraTopics, ["home", "stay"])
        ? "confirmed"
        : "promising",
      niaCurrentLead: niaKnown ? "promising" : "possible",
      pumpStanding:
        pumpProblem?.status === "solved" ? "confirmed" : "promising",
      tomasWork: hasAnyTopic(tomasTopics, ["work", "yard"])
        ? "confirmed"
        : yardJob?.discovered
          ? "promising"
          : "possible",
    },
    pumpStandingVariant:
      firstAfternoonSettled && pumpProblem?.status === "active"
        ? "active-house-problem"
        : "background-proof",
  });
}

export function selectNotebookBelief(
  world: StreetGameState,
  cognition: RowanCognitionSnapshot,
) {
  const nextMove = cognition.nextMove;
  const primaryNeedTopic = topicForNeed(cognition.primaryNeed?.key);
  const confidenceScore: Record<RowanBeliefConfidence, number> = {
    confirmed: 3,
    possible: 1,
    promising: 2,
  };

  return [...cognition.beliefs].sort((left, right) => {
    return (
      notebookBeliefScore(world, right, {
        confidenceScore,
        nextMove,
        primaryNeedTopic,
      }) -
      notebookBeliefScore(world, left, {
        confidenceScore,
        nextMove,
        primaryNeedTopic,
      })
    );
  })[0];
}

export function selectNotebookNeed(
  world: StreetGameState,
  cognition: RowanCognitionSnapshot,
  belief?: RowanBelief,
) {
  const objectiveFocus = world.player.objective?.focus;
  const nextMove = cognition.nextMove;
  const recoveryPlanKind = objectiveRouteNotebookRecoveryPlanKind({
    actionId: nextMove?.actionId,
    world,
  });

  if (
    recoveryPlanKind === "post-afternoon" ||
    rowanNotebookUsesRecoveryRestNeed(world, nextMove)
  ) {
    return cognition.needs.find((need) => need.key === "rest");
  }

  if (objectiveFocus === "work") {
    return cognition.needs.find((need) => need.key === "income");
  }

  if (objectiveFocus === "help" || objectiveFocus === "tool") {
    return cognition.needs.find((need) => need.key === "orientation");
  }

  return needForBeliefTopic(cognition.needs, belief?.topic);
}

export function confidenceAdjective(confidence: RowanBeliefConfidence) {
  switch (confidence) {
    case "confirmed":
      return "confirmed";
    case "promising":
      return "promising";
    case "possible":
      return "possible";
    default:
      return "uncertain";
  }
}

export function confidenceLabel(confidence: RowanBeliefConfidence) {
  switch (confidence) {
    case "confirmed":
      return "Confirmed";
    case "promising":
      return "Promising";
    case "possible":
      return "Possible";
    default:
      return "Unsettled";
  }
}

export function needStatusLabel(status: RowanNeedStatus) {
  switch (status) {
    case "urgent":
      return "Urgent";
    case "active":
      return "Active";
    case "stable":
      return "Stable";
    default:
      return "Unsettled";
  }
}

export function uncertaintyForNeed(needKey?: RowanNeedKey) {
  switch (needKey) {
    case "belonging":
      return "Who will remember Rowan as more than a new face?";
    case "income":
      return "Which lead can turn into paid work before the day gets away?";
    case "orientation":
      return "Which place should Rowan understand before choosing badly?";
    case "rest":
      return "How far can Rowan push before tired choices get expensive?";
    case "shelter":
      return "What would make tonight's bed feel less temporary?";
    default:
      return undefined;
  }
}

function notebookBeliefScore(
  world: StreetGameState,
  belief: RowanBelief,
  context: {
    confidenceScore: Record<RowanBeliefConfidence, number>;
    nextMove?: RowanNextMove;
    primaryNeedTopic?: RowanBelief["topic"];
  },
) {
  const direct = Boolean(
    (context.nextMove?.npcId && belief.npcId === context.nextMove.npcId) ||
      (context.nextMove?.targetLocationId &&
        belief.locationId === context.nextMove.targetLocationId),
  );
  const objectiveMatch = objectiveMatchesBelief(world, belief);
  const primaryNeedMatch =
    context.primaryNeedTopic !== undefined &&
    belief.topic === context.primaryNeedTopic;
  const firstAfternoonSettled = Boolean(world.firstAfternoon?.completedAt);

  let score = context.confidenceScore[belief.confidence] * 10;
  if (direct) {
    score += 70;
  }
  if (objectiveMatch) {
    score += 180;
  }
  if (primaryNeedMatch) {
    score += 40;
  }
  score += objectiveRouteNotebookBeliefScoreAdjustment({
    beliefTopic: belief.topic,
    direct,
    firstAfternoonSettled,
    objectiveFocus: world.player.objective?.focus,
    objectiveMatch,
    objectiveRouteKey: world.player.objective?.routeKey,
  });

  return score;
}

function objectiveMatchesBelief(world: StreetGameState, belief: RowanBelief) {
  const objectiveText = world.player.objective?.text.toLowerCase() ?? "";
  if (!objectiveText) {
    return false;
  }

  const npcName = belief.npcId
    ? world.npcs.find((npc) => npc.id === belief.npcId)?.name.toLowerCase()
    : undefined;
  const locationName = belief.locationId
    ? world.locations
        .find((location) => location.id === belief.locationId)
        ?.name.toLowerCase()
    : undefined;

  if (npcName && objectiveText.includes(npcName)) {
    return true;
  }

  if (locationName && objectiveText.includes(locationName)) {
    return true;
  }

  if (belief.source && objectiveText.includes(belief.source.toLowerCase())) {
    return true;
  }

  return objectiveRouteNotebookBeliefMatchesObjective({
    beliefId: belief.id,
    beliefTopic: belief.topic,
    objectiveText,
  });
}

function topicForNeed(
  needKey?: RowanNeedKey,
): RowanBelief["topic"] | undefined {
  switch (needKey) {
    case "belonging":
      return "belonging";
    case "income":
      return "work";
    case "shelter":
      return "shelter";
    default:
      return undefined;
  }
}

function needForBeliefTopic(needs: RowanNeed[], topic?: RowanBelief["topic"]) {
  const needKey = needKeyForTopic(topic);
  return needKey ? needs.find((need) => need.key === needKey) : undefined;
}

function needKeyForTopic(
  topic?: RowanBelief["topic"],
): RowanNeedKey | undefined {
  switch (topic) {
    case "belonging":
      return "belonging";
    case "shelter":
      return "shelter";
    case "work":
      return "income";
    case "help":
    case "tool":
      return "orientation";
    default:
      return undefined;
  }
}

function npcReplyTopics(world: StreetGameState, npcId: string) {
  const topics = new Set<string>();

  for (const entry of world.conversations) {
    if (entry.npcId !== npcId || entry.speaker !== "npc") {
      continue;
    }

    for (const topic of detectTopics(entry.text)) {
      topics.add(topic);
    }
  }

  return topics;
}

function hasAnyTopic(topics: Set<string>, candidates: string[]) {
  return candidates.some((candidate) => topics.has(candidate));
}

function detectTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (
    /\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bpay\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(
      normalized,
    )
  ) {
    topics.add("work");
  }

  if (/\bhelp\b|\bfix\b|\brepair\b|\bsolve\b|\bhandle\b/.test(normalized)) {
    topics.add("help");
  }

  if (/\bpump\b|\bleak\b/.test(normalized)) {
    topics.add("pump");
  }

  if (/\bwrench\b|\btool\b|\btools\b/.test(normalized)) {
    topics.add("tool");
  }

  if (
    /\brent\b|\broom\b|\bhome\b|\bhouse\b|\blodg|\bstay\b|\bbed\b/.test(
      normalized,
    )
  ) {
    topics.add("home");
    topics.add("stay");
  }

  if (/\bcart\b|\bsquare\b|\bmarket\b/.test(normalized)) {
    topics.add("cart");
  }

  if (/\byard\b|\bload\b|\bcrate\b|\bcrane\b/.test(normalized)) {
    topics.add("yard");
  }

  if (/\bpeople\b|\bmeet\b|\bfriend\b|\bfriends\b|\bwho\b/.test(normalized)) {
    topics.add("people");
  }

  if (
    /\bmap\b|\blearn\b|\bexplore\b|\blane\b|\bdistrict\b|\bcity\b/.test(
      normalized,
    )
  ) {
    topics.add("learn");
  }

  return topics;
}
