import type {
  RowanAutonomyEffect,
  RowanAutonomyLayer,
  RowanAutonomyStepKind,
  StreetGameState,
} from "../street-sim/types.js";
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
  const beliefs: RowanBelief[] = [];
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

  if (firstAfternoonSettled) {
    beliefs.push({
      id: "belief-first-afternoon-field-note",
      topic: "help",
      text: "Ada has now seen Rowan ask directly, work through lunch, and record what changed; the opening room question is evidence, not the current plan.",
      confidence: world.firstAfternoon?.fieldNote ? "confirmed" : "promising",
      source: "First afternoon field note",
      locationId: "tea-house",
      npcId: "npc-ada",
    });
  }

  if (maraKnown) {
    beliefs.push({
      id: "belief-mara-room",
      topic: "shelter",
      text: "Mara is the person most likely to tell Rowan what keeps a room at Morrow House from turning temporary again.",
      confidence: hasAnyTopic(maraTopics, ["home", "stay"])
        ? "confirmed"
        : "promising",
      source: "Morrow House",
      npcId: "npc-mara",
      locationId: "boarding-house",
    });
  }

  if (teaJob?.discovered || adaKnown) {
    beliefs.push({
      id: "belief-ada-work",
      topic: "work",
      text: "Ada may have paid work at Kettle & Lamp if Rowan shows up before the lunch crowd fills the cafe.",
      confidence: hasAnyTopic(adaTopics, ["work"])
        ? "confirmed"
        : teaJob?.discovered
          ? "promising"
          : "possible",
      source: "Kettle & Lamp",
      npcId: "npc-ada",
      locationId: "tea-house",
    });
  }

  if (yardJob?.discovered || tomasKnown) {
    beliefs.push({
      id: "belief-tomas-work",
      topic: "work",
      text: "Tomas may have yard work when the freight window is open and Rowan sounds reliable enough to bother with.",
      confidence: hasAnyTopic(tomasTopics, ["work", "yard"])
        ? "confirmed"
        : yardJob?.discovered
          ? "promising"
          : "possible",
      source: "North Crane Yard",
      npcId: "npc-tomas",
      locationId: "freight-yard",
    });
  }

  if (joKnown) {
    beliefs.push({
      id: "belief-jo-tools",
      topic: "tool",
      text: "Jo is the clearest place to turn coins into the right tool when Rowan finally knows what he needs.",
      confidence: "promising",
      source: "Mercer Repairs",
      npcId: "npc-jo",
      locationId: "repair-stall",
    });
  }

  if (pumpProblem?.discovered) {
    beliefs.push({
      id: "belief-pump-standing",
      topic: "help",
      text:
        firstAfternoonSettled && pumpProblem.status === "active"
          ? "The Morrow Yard pump is now a live house problem, not background noise Rowan can keep treating as later."
          : "Fixing the pump in Morrow Yard could turn house trouble into proof that Rowan notices what needs doing.",
      confidence: pumpProblem.status === "solved" ? "confirmed" : "promising",
      source: "Morrow Yard",
      locationId: "courtyard",
    });
  }

  if (/\bnia\b|\bblock\b|\bjam\b|\bcart\b|\bsquare\b/.test(objectiveText)) {
    beliefs.push({
      id: "belief-nia-current-lead",
      topic: "help",
      text: "Jo's clue points Rowan toward Nia before the block jam turns into someone else's problem.",
      confidence: niaKnown ? "promising" : "possible",
      source: joKnown ? "Jo at Mercer Repairs" : "Current lead",
      npcId: "npc-nia",
    });
  }

  if (niaKnown) {
    beliefs.push({
      id: "belief-nia-people",
      topic: "belonging",
      text: "Nia seems like the kind of person who can explain who matters before Rowan wastes a whole afternoon guessing.",
      confidence: "possible",
      source: "South Quay",
      npcId: "npc-nia",
    });
  }

  return beliefs;
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
  const objectiveRouteKey = world.player.objective?.routeKey;
  const nextMove = cognition.nextMove;

  if (
    objectiveFocus === "rest" ||
    objectiveRouteKey === "rest-home" ||
    nextMove?.actionId === "rest:home" ||
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
  const direct =
    (context.nextMove?.npcId && belief.npcId === context.nextMove.npcId) ||
    (context.nextMove?.targetLocationId &&
      belief.locationId === context.nextMove.targetLocationId);
  const objectiveMatch = objectiveMatchesBelief(world, belief);
  const primaryNeedMatch =
    context.primaryNeedTopic !== undefined &&
    belief.topic === context.primaryNeedTopic;
  const firstAfternoonSettled = Boolean(world.firstAfternoon?.completedAt);
  const staleOpeningShelter =
    firstAfternoonSettled &&
    belief.topic === "shelter" &&
    world.player.objective?.routeKey !== "first-afternoon" &&
    world.player.objective?.focus !== "settle";

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
  if (staleOpeningShelter) {
    score -= 220;
  }
  if (
    firstAfternoonSettled &&
    belief.topic === "shelter" &&
    !direct &&
    !objectiveMatch
  ) {
    score -= 90;
  }

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

  switch (belief.topic) {
    case "help":
      if (belief.id === "belief-first-afternoon-field-note") {
        return /\bfirst afternoon\b|\bfield note\b|\brest\b|\brecover\b|\btake stock\b/.test(
          objectiveText,
        );
      }
      if (belief.id === "belief-pump-standing") {
        return /\bpump\b|\bleak\b|\bfix\b/.test(objectiveText);
      }
      return /\bblock\b|\bjam\b|\bcart\b|\bsquare\b|\bpump\b|\bfix\b|\bhelp\b/.test(
        objectiveText,
      );
    case "work":
      if (
        /\btomas\b|\byard\b|\bfreight\b|\bnorth crane\b/.test(objectiveText)
      ) {
        return belief.id === "belief-tomas-work";
      }
      if (
        /\bada\b|\bkettle\b|\bcafe\b|\btea\b|\bcup-and-counter\b/.test(
          objectiveText,
        )
      ) {
        return belief.id === "belief-ada-work";
      }
      return /\bwork\b|\bjob\b|\bshift\b|\bpay\b|\bincome\b/.test(
        objectiveText,
      );
    case "shelter":
      return /\broom\b|\bbed\b|\bstay\b|\bhouse\b|\bshelter\b/.test(
        objectiveText,
      );
    case "tool":
      return /\bwrench\b|\btool\b|\brepair\b/.test(objectiveText);
    case "belonging":
      return /\bperson\b|\bpeople\b|\bfriend\b|\btrust\b|\bknown\b/.test(
        objectiveText,
      );
    default:
      return false;
  }
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
