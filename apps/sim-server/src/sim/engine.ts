import type { AIProvider } from "../ai/provider.js";
import { seedStreetGame } from "../street-sim/seedGame.js";
import type {
  ActionOption,
  ClockState,
  FeedEntry,
  JobState,
  LocationState,
  MemoryEntry,
  NpcState,
  ProblemState,
  SceneNote,
  StreetGameState,
} from "../street-sim/types.js";
import type { GameCommand } from "../types/api.js";

export const STEP_MINUTES = 30;

const BASE_DAY = "2026-03-21T00:00:00.000Z";

export class SimulationEngine {
  constructor(private readonly aiProvider: AIProvider) {}

  get providerName(): string {
    return this.aiProvider.name;
  }

  async createGame(gameId: string): Promise<StreetGameState> {
    const world = seedStreetGame(gameId);
    return refreshWorld(world);
  }

  async tick(world: StreetGameState, tickCount: number): Promise<StreetGameState> {
    const nextWorld = cloneWorld(world);

    for (let index = 0; index < tickCount; index += 1) {
      advanceWorld(nextWorld, STEP_MINUTES);
      addFeed(
        nextWorld,
        "info",
        "You let half an hour pass and watched the block keep rearranging itself.",
      );
    }

    return refreshWorld(nextWorld);
  }

  async runCommand(
    world: StreetGameState,
    command: GameCommand,
  ): Promise<StreetGameState> {
    const nextWorld = cloneWorld(world);

    switch (command.type) {
      case "move_to":
        movePlayer(nextWorld, command.x, command.y);
        break;
      case "act":
        performAction(nextWorld, command.actionId);
        break;
      case "wait":
        advanceWorld(nextWorld, command.minutes);
        addFeed(nextWorld, "info", "You stayed put long enough for the block to move around you.");
        break;
      case "update_policy":
        addFeed(
          nextWorld,
          "info",
          "This street slice has no policy layer yet. What matters is where you go and what you do there.",
        );
        break;
      default:
        break;
    }

    return refreshWorld(nextWorld);
  }
}

function cloneWorld(world: StreetGameState): StreetGameState {
  return structuredClone(world);
}

function refreshWorld(world: StreetGameState): StreetGameState {
  world.currentTime = isoFor(world.clock.totalMinutes);
  updateNpcLocations(world);
  updatePlayerLocation(world);
  resolvePassiveState(world);
  world.currentScene = buildScene(world);
  world.availableActions = buildAvailableActions(world);
  world.goals = buildGoals(world);
  world.summary = buildSummary(world);
  trimFeed(world);
  trimMemories(world);
  return world;
}

function advanceWorld(world: StreetGameState, minutes: number): void {
  const chunks = Math.max(1, Math.ceil(minutes / 15));
  const perChunk = Math.max(5, Math.round(minutes / chunks));

  for (let index = 0; index < chunks; index += 1) {
    world.clock.totalMinutes += perChunk;
    updateClock(world.clock);
    world.currentTime = isoFor(world.clock.totalMinutes);
    updateNpcLocations(world);
    updatePlayerLocation(world);
    resolvePassiveState(world);
  }
}

function movePlayer(world: StreetGameState, x: number, y: number): void {
  const targetTile = world.map.tiles.find(
    (tile) => tile.x === clamp(x, 0, world.map.width - 1) && tile.y === clamp(y, 0, world.map.height - 1),
  );

  if (!targetTile || !targetTile.walkable) {
    addFeed(world, "info", "That route is blocked or not worth taking.");
    return;
  }

  const distance =
    Math.abs(world.player.x - targetTile.x) + Math.abs(world.player.y - targetTile.y);

  if (distance === 0) {
    addFeed(world, "info", "You are already standing there.");
    return;
  }

  world.player.x = targetTile.x;
  world.player.y = targetTile.y;
  world.player.energy = clamp(world.player.energy - distance * 2, 18, 100);
  advanceWorld(world, distance * 5);

  const location = findLocationAt(world, targetTile.x, targetTile.y);

  if (location && !world.player.knownLocationIds.includes(location.id)) {
    world.player.knownLocationIds.push(location.id);
    remember(world, "place", `You found ${location.name}. ${location.description}`);
    addFeed(world, "memory", `You got your bearings at ${location.name}.`);
  } else if (location) {
    addFeed(world, "info", `You made your way to ${location.name}.`);
  } else {
    addFeed(world, "info", "You walked the lane and kept watching the district unfold.");
  }
}

function performAction(world: StreetGameState, actionId: string): void {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "talk":
      if (targetId) {
        talkToNpc(world, targetId);
      }
      break;
    case "accept":
      if (targetId) {
        acceptJob(world, targetId);
      }
      break;
    case "work":
      if (targetId) {
        workJob(world, targetId);
      }
      break;
    case "buy":
      if (targetId) {
        buyItem(world, targetId);
      }
      break;
    case "solve":
      if (targetId) {
        solveProblem(world, targetId);
      }
      break;
    case "inspect":
      if (targetId) {
        inspectLead(world, targetId);
      }
      break;
    case "rest":
      restAtHome(world);
      break;
    default:
      addFeed(world, "info", "Nothing came of that.");
      break;
  }
}

function talkToNpc(world: StreetGameState, npcId: string): void {
  const npc = world.npcs.find((entry) => entry.id === npcId);
  if (!npc) {
    return;
  }

  const location = currentLocation(world);
  if (!location || npc.currentLocationId !== location.id) {
    addFeed(world, "info", `${npc.name} is not here right now.`);
    return;
  }

  npc.known = true;
  if (!world.player.knownNpcIds.includes(npc.id)) {
    world.player.knownNpcIds.push(npc.id);
  }

  switch (npc.id) {
    case "npc-mara":
      discoverProblem(world, "problem-pump");
      addFeed(
        world,
        "problem",
        "Mara points toward the pump in Morrow Yard. 'Fix that leak and the house remembers it,' she says.",
      );
      remember(world, "person", "Mara trusts people who solve house problems before they become house politics.");
      break;
    case "npc-ada":
      discoverJob(world, "job-tea-shift");
      if (jobById(world, "job-tea-shift")?.completed) {
        discoverJob(world, "job-yard-shift");
        addFeed(
          world,
          "job",
          "Ada jerks her chin toward the yard. 'Tomas pays better than I do if you can still lift after a shift.'",
        );
      } else {
        addFeed(
          world,
          "job",
          "Ada sizes you up and says she needs a steady pair of hands for the noon tea rush.",
        );
      }
      remember(world, "person", "Ada only offers work after she decides you can finish it without making her regret the chance.");
      break;
    case "npc-jo":
      addFeed(
        world,
        "info",
        "Jo taps a heavy wrench on the bench. 'Eight coins. It still turns what needs turning.'",
      );
      remember(world, "person", "Jo prices things fairly enough that you notice.");
      break;
    case "npc-tomas":
      discoverJob(world, "job-yard-shift");
      addFeed(
        world,
        "job",
        "Tomas glances at your shoulders, not your face. If you want yard work, he cares whether you finish the lift, not whether you talk pretty.",
      );
      remember(world, "person", "Tomas thinks in loads, time windows, and whether you slow the rest of the yard down.");
      break;
    case "npc-nia":
      discoverProblem(world, "problem-cart");
      addFeed(
        world,
        "problem",
        "Nia nods at a handcart with a split wheel. 'Someone clears that before the market swells, everybody breathes easier.'",
      );
      remember(world, "person", "Nia notices small jams before the whole block has to notice them.");
      break;
    default:
      break;
  }

  advanceWorld(world, 15);
}

function acceptJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (job.missed || job.completed) {
    addFeed(world, "info", `${job.title} is no longer on the table.`);
    return;
  }

  if (!job.discovered) {
    addFeed(world, "info", "You cannot commit to work you have not actually found yet.");
    return;
  }

  if (currentHour(world) >= job.endHour) {
    addFeed(world, "info", `You are too late for ${job.title.toLowerCase()}.`);
    job.missed = true;
    return;
  }

  if (world.player.activeJobId && world.player.activeJobId !== job.id) {
    addFeed(world, "info", "You are already carrying another commitment.");
    return;
  }

  job.accepted = true;
  world.player.activeJobId = job.id;
  addFeed(world, "job", `You took ${job.title.toLowerCase()}.`);
  remember(world, "job", `You committed to ${job.title.toLowerCase()} at ${findLocation(world, job.locationId)?.name}.`);
  advanceWorld(world, 10);
}

function workJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  const location = currentLocation(world);
  if (!location || location.id !== job.locationId) {
    addFeed(world, "info", "You need to be at the job site to do the work.");
    return;
  }

  if (!job.accepted) {
    addFeed(world, "info", "Nobody is paying you for this yet.");
    return;
  }

  if (job.completed || job.missed) {
    addFeed(world, "info", `${job.title} has already resolved.`);
    return;
  }

  if (currentHour(world) < job.startHour || currentHour(world) >= job.endHour) {
    addFeed(world, "info", "The shift window is wrong. Either you are early, or the work has moved on.");
    return;
  }

  if (world.player.energy < 28) {
    addFeed(world, "info", "You are too worn down to be useful on this shift.");
    return;
  }

  advanceWorld(world, job.durationMinutes);
  world.player.money += job.pay;
  world.player.energy = clamp(world.player.energy - 14, 12, 100);
  world.player.activeJobId = undefined;
  job.accepted = false;
  job.completed = true;

  const npc = npcById(world, job.giverNpcId);
  if (npc) {
    npc.trust += 1;
  }

  if (job.id === "job-tea-shift") {
    discoverJob(world, "job-yard-shift");
    addFeed(
      world,
      "job",
      `You finished ${job.title.toLowerCase()} and earned $${job.pay}. Ada points you toward Tomas at North Crane Yard for heavier work.`,
    );
  } else {
    addFeed(
      world,
      "job",
      `You finished ${job.title.toLowerCase()} and earned $${job.pay}. The yard will remember you as someone who stayed until the load was done.`,
    );
  }

  remember(world, "job", `You finished ${job.title.toLowerCase()} and took your pay while the block was still moving.`);
}

function buyItem(world: StreetGameState, itemId: string): void {
  const location = currentLocation(world);
  if (!location || location.id !== "repair-stall") {
    addFeed(world, "info", "You cannot buy that here.");
    return;
  }

  if (itemId !== "item-wrench") {
    return;
  }

  if (hasItem(world, itemId)) {
    addFeed(world, "info", "You already have the wrench.");
    return;
  }

  if (world.player.money < 8) {
    addFeed(world, "info", "You do not have enough money for Jo's wrench.");
    return;
  }

  world.player.money -= 8;
  world.player.inventory.push({
    id: "item-wrench",
    name: "Old wrench",
    description: "Heavy, scarred, and still solid enough to turn a stubborn fitting.",
  });
  addFeed(world, "info", "You bought an old wrench from Jo for $8.");
  remember(world, "self", "You spent scarce money on a tool because South Quay keeps rewarding people who can fix what others step around.");
  advanceWorld(world, 10);
}

function solveProblem(world: StreetGameState, problemId: string): void {
  const problem = problemById(world, problemId);
  if (!problem) {
    return;
  }

  const location = currentLocation(world);
  if (!location || location.id !== problem.locationId) {
    addFeed(world, "info", "You need to be on-site to solve that.");
    return;
  }

  if (problem.status !== "active") {
    addFeed(world, "info", `${problem.title} is no longer waiting on you.`);
    return;
  }

  if (problem.requiredItemId && !hasItem(world, problem.requiredItemId)) {
    addFeed(world, "info", `You need the right tool before ${problem.title.toLowerCase()} becomes solvable.`);
    return;
  }

  if (problem.id === "problem-pump") {
    advanceWorld(world, 60);
    world.player.energy = clamp(world.player.energy - 10, 12, 100);
    world.player.money += problem.rewardMoney;
    world.player.reputation.morrow_house += 1;
    problem.status = "solved";
    addFeed(
      world,
      "problem",
      `You tightened the pump in Morrow Yard, slowed the leak, and Mara pressed $${problem.rewardMoney} into your hand before the stones flooded again.`,
    );
    remember(world, "problem", "Morrow House started to remember you as someone who fixes shared trouble instead of adding to it.");
    return;
  }

  if (problem.id === "problem-cart") {
    advanceWorld(world, 30);
    world.player.energy = clamp(world.player.energy - 8, 12, 100);
    world.player.money += problem.rewardMoney;
    world.player.reputation.south_quay += 1;
    problem.status = "solved";
    addFeed(
      world,
      "problem",
      `You got the jammed handcart rolling again and the square paid you $${problem.rewardMoney} to stop being in everybody's way.`,
    );
    remember(world, "problem", "You learned that even small street problems become reputation if you solve them before they spread.");
  }
}

function inspectLead(world: StreetGameState, targetId: string): void {
  if (targetId === "problem-pump") {
    discoverProblem(world, "problem-pump");
    addFeed(world, "problem", "Up close, the pump in Morrow Yard is one wrench-turn away from either a fix or a worse leak.");
  }

  if (targetId === "problem-cart") {
    discoverProblem(world, "problem-cart");
    addFeed(world, "problem", "The split wheel on the handcart is already starting to snag foot traffic through the square.");
  }

  advanceWorld(world, 10);
}

function restAtHome(world: StreetGameState): void {
  const location = currentLocation(world);
  if (!location || location.id !== world.player.homeLocationId) {
    addFeed(world, "info", "You need somewhere that is actually yours for an hour before rest does any good.");
    return;
  }

  const pumpSolved = problemById(world, "problem-pump")?.status === "solved";
  advanceWorld(world, 60);
  world.player.energy = clamp(world.player.energy + (pumpSolved ? 24 : 16), 12, 100);
  addFeed(
    world,
    "memory",
    pumpSolved
      ? "You rested in a quiet room at Morrow House and felt the hour actually land."
      : "You rested, but the house never quite stopped sounding busy and unfinished.",
  );
}

function resolvePassiveState(world: StreetGameState): void {
  const teaJob = jobById(world, "job-tea-shift");
  if (teaJob && !teaJob.completed && currentHour(world) >= teaJob.endHour) {
    teaJob.accepted = false;
    teaJob.missed = true;
    if (world.player.activeJobId === teaJob.id) {
      world.player.activeJobId = undefined;
    }
  }

  const yardJob = jobById(world, "job-yard-shift");
  if (yardJob && !yardJob.completed && currentHour(world) >= yardJob.endHour) {
    yardJob.accepted = false;
    yardJob.missed = true;
    if (world.player.activeJobId === yardJob.id) {
      world.player.activeJobId = undefined;
    }
  }

  const cartProblem = problemById(world, "problem-cart");
  if (cartProblem && cartProblem.status === "hidden" && currentHour(world) >= 12) {
    cartProblem.status = "active";
  }

  const pumpProblem = problemById(world, "problem-pump");
  if (
    pumpProblem &&
    pumpProblem.status === "active" &&
    currentHour(world) >= 18
  ) {
    pumpProblem.status = "expired";
  }

  if (
    cartProblem &&
    cartProblem.status === "active" &&
    currentHour(world) >= 17
  ) {
    cartProblem.status = "expired";
  }
}

function updateNpcLocations(world: StreetGameState): void {
  for (const npc of world.npcs) {
    const hour = currentHour(world);
    const stop =
      npc.schedule.find((entry) => hour >= entry.fromHour && hour < entry.toHour) ??
      npc.schedule[npc.schedule.length - 1];

    if (stop) {
      npc.currentLocationId = stop.locationId;
    }
  }
}

function updatePlayerLocation(world: StreetGameState): void {
  const location = findLocationAt(world, world.player.x, world.player.y);
  world.player.currentLocationId = location?.id;
}

function buildScene(world: StreetGameState) {
  const location = currentLocation(world);
  const people = world.npcs
    .filter((npc) => npc.currentLocationId === location?.id)
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      known: npc.known,
    }));

  const notes: SceneNote[] = [];

  if (location) {
    notes.push({
      id: `note-open-${location.id}`,
      text: isLocationOpen(world, location)
        ? `${location.name} is active right now.`
        : `${location.name} is quiet or closed at this hour.`,
      tone: isLocationOpen(world, location) ? "info" : "warning",
    });
  }

  for (const job of world.jobs.filter((entry) => entry.locationId === location?.id && entry.discovered && !entry.completed && !entry.missed)) {
    notes.push({
      id: `note-job-${job.id}`,
      text: `${job.title} pays $${job.pay} between ${formatHour(job.startHour)} and ${formatHour(job.endHour)}.`,
      tone: "lead",
    });
  }

  for (const problem of world.problems.filter((entry) => entry.locationId === location?.id && entry.discovered && entry.status === "active")) {
    notes.push({
      id: `note-problem-${problem.id}`,
      text: problem.summary,
      tone: "warning",
    });
  }

  if (!location) {
    return {
      locationId: undefined,
      title: "South Quay Streets",
      description:
        "Brick, puddles, shop shutters, and people who look busy enough that you have to decide whether to stop them anyway.",
      people,
      notes,
    };
  }

  return {
    locationId: location.id,
    title: location.name,
    description: location.description,
    people,
    notes,
  };
}

function buildAvailableActions(world: StreetGameState): ActionOption[] {
  const location = currentLocation(world);
  const actions: ActionOption[] = [];

  if (location) {
    for (const npc of world.npcs.filter((entry) => entry.currentLocationId === location.id)) {
      actions.push({
        id: `talk:${npc.id}`,
        label: `Talk to ${npc.name}`,
        description: npc.summary,
        kind: "talk",
        emphasis: npc.known ? "low" : "medium",
      });
    }
  }

  for (const job of world.jobs.filter((entry) => entry.locationId === location?.id && entry.discovered && !entry.completed && !entry.missed)) {
    if (!job.accepted) {
      actions.push({
        id: `accept:${job.id}`,
        label: `Take ${job.title}`,
        description: `${job.summary} Pays $${job.pay}.`,
        kind: "accept_job",
        emphasis: "medium",
        disabled: currentHour(world) >= job.endHour,
        disabledReason: currentHour(world) >= job.endHour ? "The shift window is gone." : undefined,
      });
    } else {
      actions.push({
        id: `work:${job.id}`,
        label: `Work ${job.title}`,
        description: `${job.durationMinutes} minutes for $${job.pay}.`,
        kind: "work_job",
        emphasis: "high",
        disabled:
          currentHour(world) < job.startHour ||
          currentHour(world) >= job.endHour ||
          world.player.energy < 28,
        disabledReason:
          currentHour(world) < job.startHour
            ? "Too early for the shift."
            : currentHour(world) >= job.endHour
              ? "The shift has already slipped."
              : world.player.energy < 28
                ? "You are too drained for this work."
                : undefined,
      });
    }
  }

  for (const problem of world.problems.filter((entry) => entry.locationId === location?.id)) {
    if (!problem.discovered && problem.status === "active") {
      actions.push({
        id: `inspect:${problem.id}`,
        label: `Inspect ${problem.title.toLowerCase()}`,
        description: "Take a closer look before deciding whether it is yours to fix.",
        kind: "inspect",
        emphasis: "low",
      });
      continue;
    }

    if (problem.discovered && problem.status === "active") {
      actions.push({
        id: `solve:${problem.id}`,
        label: `Solve ${problem.title.toLowerCase()}`,
        description: problem.requiredItemId
          ? `${problem.summary} Needs the right tool.`
          : problem.summary,
        kind: "solve",
        emphasis: "high",
        disabled:
          problem.requiredItemId !== undefined &&
          !hasItem(world, problem.requiredItemId),
        disabledReason:
          problem.requiredItemId !== undefined &&
          !hasItem(world, problem.requiredItemId)
            ? "You do not have the right tool."
            : undefined,
      });
    }
  }

  if (location?.id === "repair-stall" && !hasItem(world, "item-wrench")) {
    actions.push({
      id: "buy:item-wrench",
      label: "Buy old wrench",
      description: "A solid tool for $8. Heavy, ugly, and exactly as useful as that sounds.",
      kind: "buy",
      emphasis: "medium",
      disabled: world.player.money < 8,
      disabledReason: world.player.money < 8 ? "You only have enough money to be thoughtful, not equipped." : undefined,
    });
  }

  if (location?.id === world.player.homeLocationId) {
    actions.push({
      id: "rest:home",
      label: "Rest for an hour",
      description: "Get off your feet and let the block keep moving without you for a bit.",
      kind: "rest",
      emphasis: "low",
    });
  }

  return actions;
}

function buildGoals(world: StreetGameState): string[] {
  const solvedProblems = world.problems.filter((problem) => problem.status === "solved").length;
  const knownPlaces = world.player.knownLocationIds.length;

  return [
    moneyGoalLine(world.player.money),
    problemGoalLine(solvedProblems),
    placeGoalLine(knownPlaces),
  ];
}

function buildSummary(world: StreetGameState): string {
  const location = currentLocation(world);
  const completedJobs = world.jobs.filter((job) => job.completed).length;
  const solvedProblems = world.problems.filter((problem) => problem.status === "solved").length;
  const knownPlaces = world.player.knownLocationIds.length;

  return `${world.clock.label}, day ${world.clock.day}. You are at ${
    location?.name ?? "the street"
  } in ${location?.neighborhood ?? world.districtName}, ${describeMoney(world.player.money)}, and ${describeEnergy(
    world.player.energy,
  )}. ${describeDistrictSense(knownPlaces)} ${describeStanding(completedJobs, solvedProblems)}`;
}

function currentLocation(world: StreetGameState) {
  return world.player.currentLocationId
    ? findLocation(world, world.player.currentLocationId)
    : undefined;
}

function findLocation(world: StreetGameState, locationId: string) {
  return world.locations.find((entry) => entry.id === locationId);
}

function findLocationAt(world: StreetGameState, x: number, y: number) {
  const tile = world.map.tiles.find((entry) => entry.x === x && entry.y === y);
  if (!tile?.locationId) {
    return undefined;
  }

  return findLocation(world, tile.locationId);
}

function currentHour(world: StreetGameState) {
  return world.clock.hour + world.clock.minute / 60;
}

function isLocationOpen(world: StreetGameState, location: LocationState) {
  const hour = currentHour(world);
  if (location.openHour === 0 && location.closeHour === 24) {
    return true;
  }

  return hour >= location.openHour && hour < location.closeHour;
}

function discoverJob(world: StreetGameState, jobId: string) {
  const job = jobById(world, jobId);
  if (!job || job.discovered) {
    return;
  }

  job.discovered = true;
  remember(world, "job", `You found out about ${job.title.toLowerCase()}.`);
}

function discoverProblem(world: StreetGameState, problemId: string) {
  const problem = problemById(world, problemId);
  if (!problem || problem.discovered || problem.status !== "active") {
    return;
  }

  problem.discovered = true;
  remember(world, "problem", `You noticed ${problem.title.toLowerCase()}.`);
}

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
}

function problemById(world: StreetGameState, problemId: string) {
  return world.problems.find((entry) => entry.id === problemId);
}

function npcById(world: StreetGameState, npcId: string) {
  return world.npcs.find((entry) => entry.id === npcId);
}

function addFeed(
  world: StreetGameState,
  tone: FeedEntry["tone"],
  text: string,
) {
  world.feed.unshift({
    id: `feed-${world.feed.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    tone,
    text,
  });
}

function remember(
  world: StreetGameState,
  kind: MemoryEntry["kind"],
  text: string,
) {
  world.player.memories.unshift({
    id: `memory-${world.player.memories.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    kind,
    text,
  });
}

function trimFeed(world: StreetGameState) {
  world.feed = world.feed.slice(0, 18);
}

function trimMemories(world: StreetGameState) {
  world.player.memories = world.player.memories.slice(0, 18);
}

function hasItem(world: StreetGameState, itemId: string) {
  return world.player.inventory.some((entry) => entry.id === itemId);
}

function updateClock(clock: ClockState) {
  clock.day = Math.floor(clock.totalMinutes / (24 * 60)) + 1;
  const minuteOfDay = clock.totalMinutes % (24 * 60);
  clock.hour = Math.floor(minuteOfDay / 60);
  clock.minute = minuteOfDay % 60;
  clock.label = phaseForHour(clock.hour);
}

function phaseForHour(hour: number) {
  if (hour < 6) return "Pre-dawn";
  if (hour < 11) return "Morning";
  if (hour < 14) return "Late morning";
  if (hour < 18) return "Afternoon";
  if (hour < 22) return "Evening";
  return "Night";
}

function isoFor(totalMinutes: number) {
  const timestamp = new Date(BASE_DAY).getTime() + totalMinutes * 60_000;
  return new Date(timestamp).toISOString();
}

function formatHour(hour: number) {
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  if (hour > 12) return `${hour - 12}pm`;
  return `${hour}am`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function moneyGoalLine(money: number) {
  if (money >= 30) {
    return "You have enough coin on you that tonight no longer feels immediate.";
  }

  if (money >= 20) {
    return "You can breathe a little, but you still need steadier money before night.";
  }

  return "Find enough paid work that tonight stops feeling sharp.";
}

function problemGoalLine(solvedProblems: number) {
  if (solvedProblems >= 1) {
    return "Someone on the block has a reason to remember your help.";
  }

  return "Find one local problem worth stepping into.";
}

function placeGoalLine(knownPlaces: number) {
  if (knownPlaces >= 5) {
    return "South Quay is starting to feel like a place you can cross without guessing.";
  }

  if (knownPlaces >= 3) {
    return "Keep walking until the district starts to hold together in your head.";
  }

  return "Learn enough of the lanes that you stop feeling newly dropped here.";
}

function describeMoney(money: number) {
  if (money >= 30) {
    return "with enough coin in your pocket to breathe a little";
  }

  if (money >= 15) {
    return "with a modest stack of coins in your pocket";
  }

  if (money >= 8) {
    return "with a few coins left to work with";
  }

  return "with barely enough coin to feel comfortable";
}

function describeEnergy(energy: number) {
  if (energy >= 75) {
    return "still steady on your feet";
  }

  if (energy >= 50) {
    return "feeling the day, but not bent by it";
  }

  if (energy >= 30) {
    return "starting to feel the drag in your legs";
  }

  return "running on tired legs";
}

function describeDistrictSense(knownPlaces: number) {
  if (knownPlaces >= 5) {
    return "The lanes of South Quay are starting to make sense.";
  }

  if (knownPlaces >= 3) {
    return "A few corners of South Quay are beginning to stick in your head.";
  }

  return "South Quay still feels bigger than what you know of it.";
}

function describeStanding(completedJobs: number, solvedProblems: number) {
  const usefulMoments = completedJobs + solvedProblems;

  if (usefulMoments >= 2) {
    return "People are beginning to treat you like you belong here.";
  }

  if (usefulMoments >= 1) {
    return "A few people have started to remember you for something useful.";
  }

  return "Most of the block is still trying to place your face.";
}
