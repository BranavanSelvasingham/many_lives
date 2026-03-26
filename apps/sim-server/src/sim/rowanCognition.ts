import type { StreetGameState } from "../street-sim/types.js";

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
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
}

export interface RowanCognition {
  primaryNeed?: RowanNeed;
  needs: RowanNeed[];
  beliefs: RowanBelief[];
  nextMove?: RowanNextMove;
}

export function buildRowanCognition(world: StreetGameState): RowanCognition {
  const needs = buildRowanNeeds(world);
  const beliefs = buildRowanBeliefs(world);
  const nextMove = buildRowanNextMove(world);

  return {
    primaryNeed: needs[0],
    needs,
    beliefs,
    nextMove,
  };
}

function buildRowanNeeds(world: StreetGameState): RowanNeed[] {
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
  const hasRoomTerms = houseStanding >= 2 || hasAnyTopic(maraTopics, ["home", "stay"]);

  needs.push({
    key: "shelter",
    label: "Keep a stable room",
    status:
      houseStanding < 1 && !hasRoomTerms
        ? "urgent"
        : hasRoomTerms && houseStanding >= 2
          ? "stable"
          : "active",
    score:
      houseStanding < 1 && !hasRoomTerms
        ? 92
        : hasRoomTerms && houseStanding >= 2
          ? 24
          : 68,
    reason: hasRoomTerms
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
      activeJob || hasCompletedWork || money >= 20
        ? 28
        : money < 12
          ? 88
          : 74,
    reason: activeJob
      ? "There is work in hand, so now it is about following through."
      : "Coins only buy Rowan a little breathing room if the next job does not materialize.",
  });

  needs.push({
    key: "belonging",
    label: "Stop feeling like a stranger",
    status: trustedPeople >= 2 ? "stable" : familiarPeople > 0 ? "active" : "urgent",
    score: trustedPeople >= 2 ? 20 : familiarPeople > 0 ? 58 : 72,
    reason:
      trustedPeople >= 2
        ? "A couple of people are starting to feel like real footholds."
        : "He still needs people who will remember him as more than a face passing through.",
  });

  needs.push({
    key: "orientation",
    label: "Learn how South Quay fits together",
    status: knownPlaces >= 4 ? "stable" : knownPlaces >= 3 ? "active" : "urgent",
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

function buildRowanBeliefs(world: StreetGameState): RowanBelief[] {
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
  const pumpProblem = world.problems.find((problem) => problem.id === "problem-pump");

  if (maraKnown) {
    beliefs.push({
      id: "belief-mara-room",
      topic: "shelter",
      text: "Mara is the person most likely to tell Rowan what keeps a room at Morrow House from turning temporary again.",
      confidence: hasAnyTopic(maraTopics, ["home", "stay"]) ? "confirmed" : "promising",
      source: "Morrow House",
      npcId: "npc-mara",
      locationId: "boarding-house",
    });
  }

  if (teaJob?.discovered || adaKnown) {
    beliefs.push({
      id: "belief-ada-work",
      topic: "work",
      text: "Ada may have paid work at Kettle & Lamp if Rowan shows up before the room hardens around somebody else.",
      confidence: hasAnyTopic(adaTopics, ["work"]) ? "confirmed" : teaJob?.discovered ? "promising" : "possible",
      source: "Kettle & Lamp",
      npcId: "npc-ada",
      locationId: "tea-house",
    });
  }

  if (yardJob?.discovered || tomasKnown) {
    beliefs.push({
      id: "belief-tomas-work",
      topic: "work",
      text: "Tomas may have yard work when the freight window is open and Rowan sounds useful enough to bother with.",
      confidence: hasAnyTopic(tomasTopics, ["work", "yard"]) ? "confirmed" : yardJob?.discovered ? "promising" : "possible",
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
      text: "Fixing the pump in Morrow Yard could make Rowan look less temporary at Morrow House.",
      confidence: pumpProblem.status === "solved" ? "confirmed" : "promising",
      source: "Morrow Yard",
      locationId: "courtyard",
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

function buildRowanNextMove(world: StreetGameState): RowanNextMove | undefined {
  if (world.player.pendingObjectiveMove) {
    return {
      text: world.player.pendingObjectiveMove.objectiveText,
      rationale: world.player.pendingObjectiveMove.rationale,
      targetLocationId: world.player.pendingObjectiveMove.targetLocationId,
      npcId: world.player.pendingObjectiveMove.npcId,
      actionId: world.player.pendingObjectiveMove.actionId,
    };
  }

  const activeJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  if (activeJob) {
    const location = world.locations.find((entry) => entry.id === activeJob.locationId);
    const currentTotalMinutes = world.clock.totalMinutes;
    const startTotalMinutes = totalMinutesForDayHour(world.clock.day, activeJob.startHour);
    const endTotalMinutes = totalMinutesForDayHour(world.clock.day, activeJob.endHour);

    if (
      activeJob.deferredUntilMinutes !== undefined &&
      activeJob.deferredUntilMinutes > currentTotalMinutes
    ) {
      return {
        text: `Pick ${activeJob.title.toLowerCase()} back up when the defer window ends.`,
        rationale: `The commitment is still live, but Rowan intentionally pushed it back until about ${formatClockForCognition(activeJob.deferredUntilMinutes)}.`,
        targetLocationId: activeJob.locationId,
        actionId: `resume:${activeJob.id}`,
      };
    }

    if (world.player.currentLocationId !== activeJob.locationId) {
      return {
        text: `Get to ${location?.name ?? "the job site"} for ${activeJob.title.toLowerCase()}.`,
        rationale:
          currentTotalMinutes < startTotalMinutes
            ? `The commitment starts around ${formatClockForCognition(startTotalMinutes)}, so Rowan should already be moving toward it.`
            : `The commitment window is open now, so Rowan needs to get on site before it slips.`,
        targetLocationId: activeJob.locationId,
        actionId: `work:${activeJob.id}`,
      };
    }

    if (currentTotalMinutes < startTotalMinutes) {
      return {
        text: `Stay ready for ${activeJob.title.toLowerCase()}.`,
        rationale: `The shift has not opened yet, but Rowan is already where he needs to be when ${formatClockForCognition(startTotalMinutes)} hits.`,
        targetLocationId: activeJob.locationId,
        actionId: `work:${activeJob.id}`,
      };
    }

    if (currentTotalMinutes < endTotalMinutes) {
      return {
        text: `Start ${activeJob.title.toLowerCase()}.`,
        rationale: "The shift window is open now, so the next meaningful move is to work it.",
        targetLocationId: activeJob.locationId,
        actionId: `work:${activeJob.id}`,
      };
    }
  }

  const nextStep = world.player.objective?.trail.find((step) => !step.done);
  if (!nextStep) {
    return undefined;
  }

  return {
    text: nextStep.title,
    rationale: nextStep.detail ?? world.player.objective?.text ?? nextStep.title,
  };
}

function totalMinutesForDayHour(day: number, hour: number) {
  return Math.max(0, day - 1) * 24 * 60 + hour * 60;
}

function formatClockForCognition(totalMinutes: number) {
  const minuteOfDay = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bpay\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(normalized)) {
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

  if (/\brent\b|\broom\b|\bhome\b|\bhouse\b|\blodg|\bstay\b|\bbed\b/.test(normalized)) {
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

  if (/\bmap\b|\blearn\b|\bexplore\b|\blane\b|\bdistrict\b|\bcity\b/.test(normalized)) {
    topics.add("learn");
  }

  return topics;
}
