import type { AIProvider } from "../ai/provider.js";
import { buildDeterministicStreetThoughts } from "../ai/streetThoughts.js";
import { seedStreetGame } from "../street-sim/seedGame.js";
import { getNpcNarrative } from "../street-sim/npcNarratives.js";
import { buildPlayerObjectiveState, classifyObjective } from "./objectiveState.js";
import { buildRowanCognition } from "./rowanCognition.js";
import type {
  ActionOption,
  ClockState,
  ConversationEntry,
  ConversationThreadState,
  FeedEntry,
  JobState,
  LocationState,
  MemoryEntry,
  NpcState,
  ObjectiveFocus,
  ProblemState,
  SceneNote,
  StreetGameState,
} from "../street-sim/types.js";
import type { GameCommand } from "../types/api.js";

export const STEP_MINUTES = 30;

const BASE_DAY = "2026-03-21T00:00:00.000Z";

type ObjectivePlan = {
  score: number;
  rationale: string;
  targetLocationId?: string;
  actionId?: string;
  npcId?: string;
  speech?: string;
};

type ConversationResolution = {
  decision?: string;
  memoryKind?: MemoryEntry["kind"];
  memoryText?: string;
  objectiveText?: string;
};

type ThoughtRefreshMode = "full" | "deterministic";

export class SimulationEngine {
  constructor(private readonly aiProvider: AIProvider) {}

  get providerName(): string {
    return this.aiProvider.name;
  }

  async createGame(gameId: string): Promise<StreetGameState> {
    const world = seedStreetGame(gameId);
    return refreshWorld(world, this.aiProvider, { thoughtRefreshMode: "full" });
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

    return refreshWorld(nextWorld, this.aiProvider, { thoughtRefreshMode: "full" });
  }

  async runCommand(
    world: StreetGameState,
    command: GameCommand,
  ): Promise<StreetGameState> {
    const nextWorld = cloneWorld(world);
    let thoughtRefreshMode: ThoughtRefreshMode = "full";

    if (command.type !== "advance_objective") {
      clearPendingObjectiveMove(nextWorld);
    }

    if (command.type !== "speak") {
      clearActiveConversation(nextWorld);
    }

    switch (command.type) {
      case "move_to":
        movePlayer(nextWorld, command.x, command.y);
        thoughtRefreshMode = "deterministic";
        break;
      case "act":
        await performAction(nextWorld, command.actionId, this.aiProvider);
        break;
      case "wait":
        advanceWorld(nextWorld, command.minutes);
        thoughtRefreshMode = "deterministic";
        if (!command.silent) {
          addFeed(
            nextWorld,
            "info",
            "You stayed put long enough for the block to move around you.",
          );
        }
        break;
      case "update_policy":
        addFeed(
          nextWorld,
          "info",
          "This street slice has no policy layer yet. What matters is where you go and what you do there.",
        );
        break;
      case "set_objective":
        setObjective(nextWorld, command.text);
        break;
      case "speak":
        await speakToNpc(nextWorld, command.npcId, command.text, this.aiProvider);
        break;
      case "advance_objective":
        thoughtRefreshMode =
          (await advanceObjective(nextWorld, this.aiProvider, {
            allowTimeSkip: command.allowTimeSkip ?? true,
          })) ?? thoughtRefreshMode;
        break;
      default:
        break;
    }

    return refreshWorld(nextWorld, this.aiProvider, {
      thoughtRefreshMode,
    });
  }
}

function cloneWorld(world: StreetGameState): StreetGameState {
  return structuredClone(world);
}

async function refreshWorld(
  world: StreetGameState,
  aiProvider: AIProvider,
  options: { thoughtRefreshMode?: ThoughtRefreshMode } = {},
): Promise<StreetGameState> {
  const thoughtRefreshMode = options.thoughtRefreshMode ?? "full";
  world.conversations ??= [];
  world.conversationThreads ??= {};
  world.currentTime = isoFor(world.clock.totalMinutes);
  updateNpcLocations(world);
  updatePlayerLocation(world);
  resolvePassiveState(world);
  world.player.objective = buildPlayerObjectiveState(world, {
    previous: world.player.objective,
  });
  reconcilePendingObjectiveMove(world);
  syncNpcInnerState(world);
  world.currentScene = buildScene(world);
  world.availableActions = buildAvailableActions(world);
  world.goals = buildGoals(world);
  world.summary = buildSummary(world);
  await hydrateStreetThoughts(world, aiProvider, thoughtRefreshMode);
  trimFeed(world);
  trimMemories(world);
  trimConversations(world);
  return world;
}

function advanceWorld(world: StreetGameState, minutes: number): void {
  const normalizedMinutes = Math.max(0, Math.round(minutes));

  if (normalizedMinutes === 0) {
    return;
  }

  let remainingMinutes = normalizedMinutes;

  while (remainingMinutes > 0) {
    const chunkMinutes = Math.min(remainingMinutes, 5);
    world.clock.totalMinutes += chunkMinutes;
    updateClock(world.clock);
    world.currentTime = isoFor(world.clock.totalMinutes);
    updateNpcLocations(world);
    updatePlayerLocation(world);
    resolvePassiveState(world);
    remainingMinutes -= chunkMinutes;
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

  const location = findLocationAt(world, targetTile.x, targetTile.y);
  world.player.currentLocationId = location?.id;

  if (location && !world.player.knownLocationIds.includes(location.id)) {
    world.player.knownLocationIds.push(location.id);
    remember(
      world,
      "place",
      `You found ${location.name}. ${location.description} ${location.context}`,
    );
    addFeed(world, "memory", `You got your bearings at ${location.name}.`);
  } else if (location) {
    addFeed(world, "info", `You made your way to ${location.name}.`);
  } else {
    addFeed(world, "info", "You walked the lane and kept watching the district unfold.");
  }
}

async function performAction(
  world: StreetGameState,
  actionId: string,
  aiProvider?: AIProvider,
): Promise<void> {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "talk":
      if (targetId && aiProvider) {
        await talkToNpc(world, targetId, aiProvider);
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
    case "defer":
      if (targetId) {
        deferJob(world, targetId);
      }
      break;
    case "resume":
      if (targetId) {
        resumeJob(world, targetId);
      }
      break;
    case "abandon":
      if (targetId) {
        abandonJob(world, targetId);
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

function isTimeSkippingAction(actionId: string) {
  const [kind] = actionId.split(":");
  return kind === "work" || kind === "solve" || kind === "rest";
}

function setLongActionThought(world: StreetGameState, actionId: string) {
  const [kind, targetId] = actionId.split(":");

  switch (kind) {
    case "work": {
      const job = targetId ? jobById(world, targetId) : undefined;
      world.player.currentThought = job
        ? `The ${job.title.toLowerCase()} is ready. I can start when you tell me to spend the time.`
        : "I'm ready to work when you want to let the time pass.";
      return;
    }
    case "solve": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      world.player.currentThought = problem
        ? `I'm ready to deal with ${problem.title.toLowerCase()} when you want to let the time pass.`
        : "I'm ready to deal with this once you're ready to spend the time.";
      return;
    }
    case "rest":
      world.player.currentThought =
        "I can stop and rest when you want to let the hour pass.";
      return;
    default:
      return;
  }
}

function setObjective(world: StreetGameState, text: string): void {
  const previous = world.player.objective?.text?.trim();
  const normalized = normalizeObjectiveText(text);

  clearPendingObjectiveMove(world);

  if (!normalized) {
    if (!previous) {
      addFeed(world, "info", "Rowan is already moving without a fixed direction.");
      return;
    }

    world.player.objective = undefined;
    addFeed(
      world,
      "memory",
      "You let go of the fixed objective for now and went back to reading the block moment by moment.",
    );
    remember(
      world,
      "self",
      "You stopped pushing one explicit objective and decided to stay more reactive to the block.",
    );
    return;
  }

  if (previous?.toLowerCase() === normalized.toLowerCase()) {
    addFeed(world, "info", `You are still steering Rowan toward: ${normalized}`);
    return;
  }

  world.player.objective = buildPlayerObjectiveState(world, {
    text: normalized,
    focus: classifyObjective(normalized),
    source: "manual",
    previous: world.player.objective,
  });
  addFeed(world, "memory", `You set Rowan's direction: ${normalized}`);
  remember(
    world,
    "self",
    `You decided that what matters right now is simple: ${normalized}`,
  );
}

function currentObjectiveDirective(world: StreetGameState) {
  const objective = world.player.objective;
  if (!objective) {
    return undefined;
  }

  const nextStep = objective.trail.find((step) => !step.done);
  const text = nextStep?.title ?? objective.text;

  return {
    text,
    focus: classifyObjective(text),
    routeKey: objective.routeKey,
  };
}

async function advanceObjective(
  world: StreetGameState,
  aiProvider: AIProvider,
  options: {
    allowTimeSkip?: boolean;
  } = {},
): Promise<ThoughtRefreshMode | void> {
  const allowTimeSkip = options.allowTimeSkip ?? true;
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    addFeed(
      world,
      "info",
      "Rowan has no clear direction yet. Set an objective first, then let him run with it.",
    );
    return;
  }

  syncNpcInnerState(world);

  const committedJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );

  if (committedJob) {
    const handledCommittedJob = handleCommittedJob(world, committedJob, {
      allowTimeSkip,
    });
    if (handledCommittedJob) {
      return handledCommittedJob === true ? undefined : handledCommittedJob;
    }
  }

  const plan = chooseObjectivePlan(world);
  if (!plan) {
    addFeed(
      world,
      "info",
      `Rowan keeps circling the objective, but the block has not given him a clean next move yet.`,
    );
    return;
  }

  const objectiveClauseText = objectiveClause(objective.text);
  const targetLocation =
    plan.targetLocationId !== undefined
      ? findLocation(world, plan.targetLocationId)
      : undefined;

  if (
    targetLocation &&
    world.player.currentLocationId !== targetLocation.id
  ) {
    if (
      !pendingObjectiveMoveMatches(
        world,
        objective.text,
        targetLocation.id,
        plan,
      )
    ) {
      queuePendingObjectiveMove(world, objective.text, plan, targetLocation.id);
      addFeed(
        world,
        "info",
        `Rowan slows for a beat and decides ${targetLocation.name} is the next place to try.`,
      );
      return "deterministic";
    }

    clearPendingObjectiveMove(world);
    addFeed(
      world,
      "info",
      `Rowan heads to ${targetLocation.name} to ${objectiveClauseText}.`,
    );
    movePlayer(world, targetLocation.entryX, targetLocation.entryY);
    syncNpcInnerState(world);
    world.player.currentThought = arrivalThought(world, plan, targetLocation.id);
    return "deterministic";
  }

  clearPendingObjectiveMove(world);

  if (plan.npcId && plan.speech) {
    await conductAutonomousConversation(
      world,
      plan.npcId,
      plan.speech,
      objective,
      aiProvider,
    );
    return;
  }

  if (plan.actionId) {
    if (!allowTimeSkip && isTimeSkippingAction(plan.actionId)) {
      setLongActionThought(world, plan.actionId);
      return;
    }

    await performAction(world, plan.actionId, aiProvider);
    return;
  }

  if (targetLocation) {
    addFeed(
      world,
      "info",
      `Rowan reaches ${targetLocation.name} and keeps reading the room for the next opening.`,
    );
    return;
  }

  addFeed(
    world,
    "info",
    `Rowan re-centers on the objective, but nothing immediate yields yet.`,
  );
}

function resolveConversationTarget(
  world: StreetGameState,
  npcId: string,
) {
  const npc = world.npcs.find((entry) => entry.id === npcId);
  if (!npc) {
    return undefined;
  }

  const location = currentLocation(world);
  if (!location || npc.currentLocationId !== location.id) {
    addFeed(world, "info", `${npc.name} is not here right now.`);
    return undefined;
  }

  return { npc, location };
}

function clearPendingObjectiveMove(world: StreetGameState) {
  world.player.pendingObjectiveMove = undefined;
}

function queuePendingObjectiveMove(
  world: StreetGameState,
  objectiveText: string,
  plan: ObjectivePlan,
  targetLocationId: string,
) {
  world.player.pendingObjectiveMove = {
    targetLocationId,
    objectiveText,
    rationale: plan.rationale,
    npcId: plan.npcId,
    actionId: plan.actionId,
    preparedAt: isoFor(world.clock.totalMinutes),
  };
}

function pendingObjectiveMoveMatches(
  world: StreetGameState,
  objectiveText: string,
  targetLocationId: string,
  plan: ObjectivePlan,
) {
  const pendingMove = world.player.pendingObjectiveMove;
  if (!pendingMove) {
    return false;
  }

  return (
    pendingMove.targetLocationId === targetLocationId &&
    pendingMove.objectiveText === objectiveText &&
    pendingMove.npcId === plan.npcId &&
    pendingMove.actionId === plan.actionId
  );
}

function reconcilePendingObjectiveMove(world: StreetGameState) {
  const pendingMove = world.player.pendingObjectiveMove;
  if (!pendingMove) {
    return;
  }

  const objective = currentObjectiveDirective(world);
  if (
    !objective ||
    pendingMove.objectiveText !== objective.text ||
    pendingMove.targetLocationId === world.player.currentLocationId
  ) {
    clearPendingObjectiveMove(world);
  }
}

function primeNpcConversation(world: StreetGameState, npc: NpcState) {
  ensureNpcKnown(world, npc);
  npc.lastInteractionAt = isoFor(world.clock.totalMinutes);

  if (countPlayerConversationsWithNpc(world, npc.id) > 0) {
    return;
  }

  switch (npc.id) {
    case "npc-mara":
      addFeed(
        world,
        "info",
        "Mara gives you a measured look, like she's deciding whether you're here for a bed, for work, or just to stop feeling new.",
      );
      rememberIfNew(
        world,
        "person",
        "Mara weighs newcomers by whether they settle in, pull their weight, or drift off.",
      );
      break;
    case "npc-ada":
      addFeed(
        world,
        "info",
        "Ada sizes you up like the room is already busy and you might still be useful if you keep your words short.",
      );
      rememberIfNew(
        world,
        "person",
        "Ada only offers work after she decides you can finish it without making her regret the chance.",
      );
      break;
    case "npc-jo":
      addFeed(
        world,
        "info",
        "Jo looks up from the bench with the kind of patience that expects you to get to the point.",
      );
      rememberIfNew(
        world,
        "person",
        "Jo prices things fairly enough that you notice.",
      );
      break;
    case "npc-tomas":
      addFeed(
        world,
        "info",
        "Tomas glances at your shoulders, not your face, like talk only matters if it turns into labor.",
      );
      rememberIfNew(
        world,
        "person",
        "Tomas thinks in loads, time windows, and whether you slow the rest of the yard down.",
      );
      break;
    case "npc-nia":
      addFeed(
        world,
        "info",
        "Nia is already half-reading the square while she talks to you, like she expects the next useful detail to arrive mid-sentence.",
      );
      rememberIfNew(
        world,
        "person",
        "Nia notices small jams before the whole block has to notice them.",
      );
      break;
    default:
      break;
  }
}

function fallbackConversationObjective(world: StreetGameState) {
  const text =
    world.player.objective?.text ??
    "Get settled in Brackenport: find a place to stay, steady income, and a few friends.";

  return {
    text,
    focus: classifyObjective(text),
    routeKey: world.player.objective?.routeKey ?? "settle-core",
  };
}

async function talkToNpc(
  world: StreetGameState,
  npcId: string,
  aiProvider: AIProvider,
): Promise<void> {
  const target = resolveConversationTarget(world, npcId);
  if (!target) {
    return;
  }

  const { npc, location } = target;
  primeNpcConversation(world, npc);
  const objective = currentObjectiveDirective(world) ?? fallbackConversationObjective(world);
  const opener = buildAutonomousSpeech(world, npc, objective);

  await conductAutonomousConversation(world, npc.id, opener, objective, aiProvider);
}

async function speakToNpc(
  world: StreetGameState,
  npcId: string,
  rawText: string,
  aiProvider: AIProvider,
): Promise<void> {
  const target = resolveConversationTarget(world, npcId);
  if (!target) {
    return;
  }

  const { npc, location } = target;
  const text = normalizeSpeechText(rawText);
  if (!text) {
    addFeed(world, "info", "Say something Rowan can actually put into words.");
    return;
  }

  primeNpcConversation(world, npc);
  const turn = await performConversationTurn(world, npc, location.id, text, aiProvider);

  if (turn.trustDelta > 0) {
    rememberIfNew(
      world,
      "person",
      `${npc.name} gave you a more open answer once you spoke plainly.`,
    );
  }

  setActiveConversation(world, npc, { locationId: location.id });
  addFeed(world, "info", `${npc.name}: ${turn.npcReply}`);
}

async function conductAutonomousConversation(
  world: StreetGameState,
  npcId: string,
  opener: string,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  aiProvider: AIProvider,
): Promise<void> {
  const npc = world.npcs.find((entry) => entry.id === npcId);
  if (!npc) {
    return;
  }

  const location = currentLocation(world);
  if (!location || npc.currentLocationId !== location.id) {
    addFeed(world, "info", `${npc.name} is not here right now.`);
    return;
  }

  const firstTurn = await performConversationTurn(
    world,
    npc,
    location.id,
    opener,
    aiProvider,
  );
  let trustOpened = firstTurn.trustDelta > 0;
  let closingReply = firstTurn.npcReply;
  const discussedTopics = new Set(firstTurn.topics);
  let resolution = deriveConversationResolution(
    world,
    npc,
    objective,
    closingReply,
    discussedTopics,
  );
  const followup = shouldAskAutonomousFollowup(
    world,
    npc,
    objective,
    closingReply,
    discussedTopics,
    resolution,
  )
    ? buildAutonomousContinuation(world, npc, objective, closingReply)
    : undefined;
  if (followup) {
    const secondTurn = await performConversationTurn(
      world,
      npc,
      location.id,
      followup,
      aiProvider,
    );
    trustOpened = trustOpened || secondTurn.trustDelta > 0;
    closingReply = secondTurn.npcReply;
    secondTurn.topics.forEach((topic) => {
      discussedTopics.add(topic);
    });

    resolution = deriveConversationResolution(
      world,
      npc,
      objective,
      closingReply,
      discussedTopics,
    );
  }

  if (trustOpened) {
    rememberIfNew(
      world,
      "person",
      `${npc.name} opened up a little once Rowan stayed direct and local.`,
    );
  }

  if (resolution.memoryKind && resolution.memoryText) {
    rememberIfNew(world, resolution.memoryKind, resolution.memoryText);
  }

  rememberNpcIfNew(
    npc,
    buildNpcConversationImpression(world, npc, objective, resolution),
  );
  setActiveConversation(world, npc, {
    decision: resolution.decision,
    locationId: location.id,
    objectiveText: resolution.objectiveText,
  });

  if (resolution.decision) {
    addFeed(
      world,
      "info",
      `After talking with ${npc.name}, Rowan leaves with a clear next move: ${resolution.decision}`,
    );
    return;
  }

  addFeed(
    world,
    "info",
    `Rowan and ${npc.name} trade a few direct words, then the block keeps moving.`,
  );
}

async function performConversationTurn(
  world: StreetGameState,
  npc: NpcState,
  locationId: string,
  rawText: string,
  aiProvider: AIProvider,
) {
  const text = normalizeSpeechText(rawText);
  if (!text) {
    return {
      npcReply: "I don't have much to add.",
      trustDelta: 0,
      topics: new Set<string>(),
    };
  }

  ensureNpcKnown(world, npc);
  recordConversation(world, {
    npcId: npc.id,
    speaker: "player",
    speakerName: world.player.name,
    text,
    locationId,
  });

  const topics = detectConversationTopics(text);
  applyConversationRevelations(world, npc, topics);
  const trustDelta = updateNpcTrustFromSpeech(npc, text, topics);
  const reply = await aiProvider.generateStreetReply({
    game: world,
    npcId: npc.id,
    playerText: text,
  });

  npc.lastSpokenLine = reply.reply;
  npc.lastInteractionAt = isoFor(world.clock.totalMinutes);
  if (reply.followupThought) {
    npc.currentThought = reply.followupThought;
  }

  recordConversation(world, {
    npcId: npc.id,
    speaker: "npc",
    speakerName: npc.name,
    text: reply.reply,
    locationId,
  });

  return {
    npcReply: reply.reply,
    trustDelta,
    topics,
  };
}

function handleCommittedJob(
  world: StreetGameState,
  job: JobState,
  options: {
    allowTimeSkip?: boolean;
  } = {},
) {
  const allowTimeSkip = options.allowTimeSkip ?? true;
  const location = findLocation(world, job.locationId);
  if (!location) {
    return false;
  }

  if (job.deferredUntilMinutes !== undefined) {
    if (world.clock.totalMinutes < job.deferredUntilMinutes) {
      world.player.currentThought = `I'm still committed to ${job.title.toLowerCase()}, but I'm letting it breathe until about ${formatClockAt(world, job.deferredUntilMinutes)}.`;
      return false;
    }

    job.deferredUntilMinutes = undefined;
  }

  if (world.player.currentLocationId !== job.locationId) {
    const objectiveText =
      currentObjectiveDirective(world)?.text ??
      `Keep ${job.title.toLowerCase()} from slipping.`;
    const jobTravelPlan: ObjectivePlan = {
      score: 0,
      rationale: `Get to ${location.name} before the ${job.title.toLowerCase()} slips.`,
      targetLocationId: location.id,
      actionId: `work:${job.id}`,
    };

    if (
      !pendingObjectiveMoveMatches(
        world,
        objectiveText,
        location.id,
        jobTravelPlan,
      )
    ) {
      queuePendingObjectiveMove(world, objectiveText, jobTravelPlan, location.id);
      addFeed(
        world,
        "info",
        `Rowan checks the hour and decides he should get to ${location.name} before the ${job.title.toLowerCase()} slips.`,
      );
      return "deterministic";
    }

    clearPendingObjectiveMove(world);
    addFeed(
      world,
      "info",
      `Rowan heads to ${location.name} to keep the ${job.title.toLowerCase()} from slipping.`,
    );
    movePlayer(world, location.entryX, location.entryY);
    return "deterministic";
  }

  if (currentHour(world) < job.startHour) {
    world.player.currentThought = `My shift at ${location.name} has not opened yet. I can wait here or fast-forward to it.`;
    return true;
  }

  if (currentHour(world) < job.endHour && world.player.energy >= 28) {
    if (!allowTimeSkip) {
      world.player.currentThought = `The shift at ${location.name} is open. I can start when you tell me to spend the time.`;
      return true;
    }

    workJob(world, job.id);
    return true;
  }

  if (world.player.energy < 28 && world.player.currentLocationId !== world.player.homeLocationId) {
    const home = findLocation(world, world.player.homeLocationId);
    if (home) {
      addFeed(
        world,
        "info",
        `Rowan backs off to Morrow House before he burns the shift on tired legs.`,
      );
      movePlayer(world, home.entryX, home.entryY);
      return true;
    }
  }

  return false;
}

function chooseObjectivePlan(world: StreetGameState): ObjectivePlan | undefined {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return undefined;
  }

  const candidates: ObjectivePlan[] = [];
  const currentLocationId = world.player.currentLocationId;
  const knownLocationIds = new Set(world.player.knownLocationIds);
  const leadLocationIds = new Set(knownLeadLocationIds(world));
  const candidateLocations = world.locations.filter(
    (location) =>
      location.id === currentLocationId ||
      knownLocationIds.has(location.id) ||
      leadLocationIds.has(location.id),
  );

  for (const location of candidateLocations) {
    const preview = previewWorldAtLocation(world, location.id);
    const actions = buildAvailableActions(preview);

    for (const action of actions) {
      if (!canAutoPlanAction(world, location.id, action, preview)) {
        continue;
      }

      if (action.disabled) {
        continue;
      }

      const score = scoreAutoActionForObjective(
        preview,
        action,
        objective.text,
        objective.focus,
      );
      if (score <= 0) {
        continue;
      }

      const distancePenalty =
        currentLocationId === location.id
          ? 0
          : distanceToLocation(world, location.id) * 0.75;
      const totalScore = score - distancePenalty;
      if (totalScore <= 0) {
        continue;
      }

      if (action.kind === "talk") {
        const npcId = extractActionTargetId(action.id);
        const npc = npcId ? npcById(preview, npcId) : undefined;
        if (!npc || !npcId) {
          continue;
        }

        candidates.push({
          score: totalScore,
          rationale: `Speak with ${npc.name} at ${location.name}.`,
          targetLocationId: location.id,
          npcId,
          speech: buildAutonomousSpeech(world, npc, objective),
        });
        continue;
      }

      candidates.push({
        score: totalScore,
        rationale: `${action.label} at ${location.name}.`,
        targetLocationId: location.id,
        actionId: action.id,
      });
    }
  }

  if (objective.focus === "explore") {
    for (const location of explorationFrontier(world)) {
      candidates.push({
        score: 8 - distanceToLocation(world, location.id) * 0.4,
        rationale: `Walk farther into the block and get your bearings.`,
        targetLocationId: location.id,
      });
    }
  }

  if (objective.focus === "settle") {
    for (const location of explorationFrontier(world)) {
      candidates.push({
        score: 7 - distanceToLocation(world, location.id) * 0.4,
        rationale: `Walk farther into the block and see whether it helps you get established.`,
        targetLocationId: location.id,
      });
    }
  }

  if (objective.focus === "rest" && world.player.currentLocationId !== world.player.homeLocationId) {
    const home = findLocation(world, world.player.homeLocationId);
    if (home) {
      candidates.push({
        score: 10,
        rationale: `Get back to ${home.name} and recover.`,
        targetLocationId: home.id,
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0];
}

function previewWorldAtLocation(
  world: StreetGameState,
  locationId: string,
) {
  const preview = cloneWorld(world);
  const location = findLocation(preview, locationId);
  if (!location) {
    return preview;
  }

  preview.player.x = location.entryX;
  preview.player.y = location.entryY;
  preview.player.currentLocationId = location.id;
  return preview;
}

function canAutoPlanAction(
  world: StreetGameState,
  locationId: string,
  action: ActionOption,
  preview: StreetGameState,
) {
  if (action.kind === "inspect" && locationId !== world.player.currentLocationId) {
    return false;
  }

  if (action.kind !== "talk") {
    return true;
  }

  const npcId = extractActionTargetId(action.id);
  const npc = npcId ? npcById(preview, npcId) : undefined;
  if (!npc) {
    return false;
  }

  return npc.known || locationId === world.player.currentLocationId;
}

function explorationFrontier(world: StreetGameState) {
  const knownLocationIds = new Set(world.player.knownLocationIds);

  return world.locations
    .filter((location) => !knownLocationIds.has(location.id))
    .map((location) => ({
      location,
      distanceFromPlayer: distanceToLocation(world, location.id),
      distanceFromKnown: nearestKnownLocationDistance(world, location.id),
    }))
    .sort((left, right) => {
      if (left.distanceFromKnown !== right.distanceFromKnown) {
        return left.distanceFromKnown - right.distanceFromKnown;
      }

      return left.distanceFromPlayer - right.distanceFromPlayer;
    })
    .slice(0, 3)
    .map((entry) => entry.location);
}

function knownLeadLocationIds(world: StreetGameState) {
  const leadLocationIds = new Set<string>();

  for (const job of world.jobs) {
    if (job.discovered) {
      leadLocationIds.add(job.locationId);
    }
  }

  for (const problem of world.problems) {
    if (problem.discovered) {
      leadLocationIds.add(problem.locationId);
    }
  }

  return [...leadLocationIds];
}

function nearestKnownLocationDistance(world: StreetGameState, locationId: string) {
  const knownLocationIds = world.player.knownLocationIds;
  if (knownLocationIds.length === 0) {
    return distanceToLocation(world, locationId);
  }

  return Math.min(
    ...knownLocationIds.map((knownLocationId) =>
      locationDistance(world, knownLocationId, locationId),
    ),
  );
}

function locationDistance(world: StreetGameState, fromLocationId: string, toLocationId: string) {
  const from = findLocation(world, fromLocationId);
  const to = findLocation(world, toLocationId);
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    Math.abs(from.entryX - to.entryX) +
    Math.abs(from.entryY - to.entryY)
  );
}

function distanceToLocation(world: StreetGameState, locationId: string) {
  const location = findLocation(world, locationId);
  if (!location) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    Math.abs(world.player.x - location.entryX) +
    Math.abs(world.player.y - location.entryY)
  );
}

function scoreAutoActionForObjective(
  world: StreetGameState,
  action: ActionOption,
  objectiveText: string,
  objectiveFocus: ObjectiveFocus,
) {
  let score = scoreActionForObjective(action, objectiveText, objectiveFocus) * 2;
  const targetId = extractActionTargetId(action.id);
  const targetJob =
    (action.kind === "accept_job" || action.kind === "work_job") && targetId
      ? jobById(world, targetId)
      : undefined;

  if (
    targetJob?.deferredUntilMinutes !== undefined &&
    world.clock.totalMinutes < targetJob.deferredUntilMinutes
  ) {
    return -40;
  }

  if (action.kind === "work_job") {
    score += 18;
  }

  if (action.kind === "accept_job") {
    score += 14;

    if (targetId) {
      const job = jobById(world, targetId);
      const giver = job ? npcById(world, job.giverNpcId) : undefined;
      if (
        job &&
        giver &&
        giver.currentLocationId === job.locationId &&
        countPlayerConversationsWithNpc(world, giver.id) === 0
      ) {
        score -= 22;
      }
    }
  }

  if (action.kind === "solve") {
    score += 16;
  }

  if (action.kind === "buy") {
    score += 12;
  }

  if (action.kind === "inspect") {
    score += objectiveFocus === "help" || objectiveFocus === "explore" ? 8 : 4;
  }

  if (action.kind === "rest") {
    score += world.player.energy < 40 || objectiveFocus === "rest" ? 14 : 0;
  }

  if (action.kind === "talk" && targetId) {
    score += scoreNpcForObjective(world, targetId, objectiveText, objectiveFocus);
  }

  if (world.player.activeJobId && targetId === world.player.activeJobId) {
    score += 30;
  }

  return score;
}

function scoreNpcForObjective(
  world: StreetGameState,
  npcId: string,
  objectiveText: string,
  objectiveFocus: ObjectiveFocus,
) {
  const normalized = objectiveText.toLowerCase();
  const npc = npcById(world, npcId);
  if (!npc) {
    return 0;
  }

  let score = 0;
  const playerConversationCount = countPlayerConversationsWithNpc(world, npcId);
  const uniqueNpcConversations = countUniqueNpcConversations(world);
  const minutesSinceConversation = minutesSinceLastNpcConversation(world, npc);

  if (playerConversationCount > 0 && minutesSinceConversation < 10) {
    return -40;
  }

  if (objectiveFocus === "work") {
    if (npcId === "npc-mara" || npcId === "npc-ada" || npcId === "npc-tomas") {
      score += 12;
    }
  }

  if (objectiveFocus === "settle") {
    if (npcId === "npc-mara") {
      score += 16;
    }

    if (npcId === "npc-ada" || npcId === "npc-nia") {
      score += 12;
    }

    if (npcId === "npc-tomas" || npcId === "npc-jo") {
      score += 8;
    }
  }

  if (objectiveFocus === "help") {
    if (npcId === "npc-mara" || npcId === "npc-nia" || npcId === "npc-jo") {
      score += 12;
    }
  }

  if (objectiveFocus === "tool" && npcId === "npc-jo") {
    score += 15;
  }

  if (objectiveFocus === "people" || objectiveFocus === "explore") {
    score += npc.known ? 6 : 10;
  }

  if (playerConversationCount === 0) {
    score += 18;

    if (
      uniqueNpcConversations < world.npcs.length &&
      (objectiveFocus === "work" ||
        objectiveFocus === "settle" ||
        objectiveFocus === "help" ||
        objectiveFocus === "explore" ||
        objectiveFocus === "people")
    ) {
      score += 10;
    }
  } else if (playerConversationCount === 1) {
    score += 4;
  }

  if (!npc.known) {
    score += 8;
  }

  if (minutesSinceConversation < 20) {
    score -= 18;
  } else if (minutesSinceConversation < 60) {
    score -= 8;
  } else if (minutesSinceConversation >= 180 && Number.isFinite(minutesSinceConversation)) {
    score += 5;
  }

  if (normalized.includes("pump") && (npcId === "npc-mara" || npcId === "npc-jo")) {
    score += 14;
  }

  if (normalized.includes("cart") && npcId === "npc-nia") {
    score += 14;
  }

  if (normalized.includes("wrench") && npcId === "npc-jo") {
    score += 16;
  }

  if (normalized.includes("work") && npcId === "npc-ada") {
    score += 10;
  }

  if (normalized.includes("yard") && npcId === "npc-tomas") {
    score += 12;
  }

  return score;
}

function buildAutonomousSpeech(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
) {
  const text = objective.text.toLowerCase();
  const playerConversationCount = countPlayerConversationsWithNpc(world, npc.id);
  const cognition = buildRowanCognition(world);
  const primaryNeed = cognition.primaryNeed?.key;
  const teaLeadKnown = cognition.beliefs.some((belief) => belief.id === "belief-ada-work");
  const yardLeadKnown = cognition.beliefs.some((belief) => belief.id === "belief-tomas-work");
  const lastNpcReply = [...world.conversations]
    .reverse()
    .find((entry) => entry.npcId === npc.id && entry.speaker === "npc")?.text
    .toLowerCase();

  if (playerConversationCount > 0) {
    const followup = buildAutonomousFollowup(
      world,
      npc.id,
      objective.focus,
      text,
      lastNpcReply,
    );
    if (followup) {
      return followup;
    }
  }

  switch (objective.focus) {
    case "settle":
      if (npc.id === "npc-mara") {
        if (primaryNeed === "shelter") {
          return "I'm Rowan. New in Brackenport. I've got tonight at Morrow House, but not much beyond that. What does somebody have to do to keep a room here?";
        }
        if (primaryNeed === "income") {
          return "I'm Rowan. New here. Who on this block actually needs hands before noon gets away from me?";
        }
        if (primaryNeed === "belonging") {
          return "I'm Rowan. New in Brackenport. Who around here is worth knowing properly if I don't want to stay a stranger?";
        }
        return "I'm Rowan. New in Brackenport. I'm trying to find a place to stay, steady income, and a few friends. Where should I start?";
      }
      if (npc.id === "npc-ada") {
        if (teaLeadKnown) {
          return "I'm Rowan. I heard the noon rush might still need hands. Is that still true?";
        }
        return "I'm new here and trying to start earning my keep. Need another pair of hands right now?";
      }
      if (npc.id === "npc-tomas") {
        if (yardLeadKnown) {
          return "I'm Rowan. I heard the yard might still need another back. Still true?";
        }
        return "I'm Rowan. New in town. If I want to start making steady money here, is the yard still short a back?";
      }
      if (npc.id === "npc-nia") {
        return "I'm new in South Quay. Who should I know if I don't want to stay a stranger for long?";
      }
      return "I'm new in Brackenport. I'm looking for a place to stay, steady income, and a few friends. Where do I begin?";
    case "work":
      if (npc.id === "npc-ada") {
        if (teaLeadKnown) {
          return "I'm Rowan. I heard you might still need hands for the rush. Is there still room for me?";
        }
        return "I'm Rowan. I'm trying to start bringing in money here. Do you need another pair of hands right now?";
      }
      if (npc.id === "npc-tomas") {
        if (yardLeadKnown) {
          return "I'm Rowan. I heard the yard might still be short a back. Still looking?";
        }
        return "I'm Rowan. I'm looking for work. Still need another back in the yard?";
      }
      return "I'm Rowan. I'm trying to start earning here. Where should I start on this block?";
    case "help":
      if (text.includes("pump")) {
        return npc.id === "npc-jo"
          ? "I'm trying to fix the pump. What tool actually gets it done?"
          : "I'm trying to sort out the leaking pump. What matters first?";
      }
      if (text.includes("cart")) {
        return "I heard the square is about to jam. What's actually wrong with the cart?";
      }
      return "I'm trying to be useful today. What trouble is about to spread if nobody steps in?";
    case "tool":
      return "I need the right tool for this. What would actually help me today?";
    case "rest":
      return "I'm running thin. Is there anything here that can't wait until I get my legs back?";
    case "explore":
      return "I'm still learning South Quay. What should I look at before I miss it?";
    case "people":
      return "Who on this block is worth meeting properly if I'm trying to find my footing?";
    default:
      break;
  }

  if (text.includes("wrench")) {
    return "I need a wrench today. What's the quickest honest way to get one?";
  }

  if (text.includes("pump")) {
    return "I need to fix the pump. What do I need to know before I start?";
  }

  return `I'm trying to ${objectiveClause(objective.text)}. Where should I push first?`;
}

function buildAutonomousFollowup(
  world: StreetGameState,
  npcId: string,
  objectiveFocus: ObjectiveFocus,
  objectiveText: string,
  lastNpcReply?: string,
) {
  const cognition = buildRowanCognition(world);
  const primaryNeed = cognition.primaryNeed?.key;
  const replyTopics = detectConversationTopics(lastNpcReply ?? "");

  if (objectiveFocus === "settle") {
    switch (npcId) {
      case "npc-mara":
        if (!replyTopics.has("home") && !replyTopics.has("stay")) {
          return "What does somebody have to do to keep a room here past the first night?";
        }
        if (!replyTopics.has("work")) {
          return "And if I need paid work quickly, who on this block is worth asking before noon?";
        }
        if (primaryNeed === "belonging" && !replyTopics.has("people")) {
          return "Who around here is worth knowing properly if I want to stop feeling new?";
        }
        return undefined;
      case "npc-ada":
        if (!replyTopics.has("work")) {
          return "Do you actually need hands, or am I already too late?";
        }
        return "If I help here, does that turn into something steady or just today's rush?";
      case "npc-jo":
        return "What does somebody new waste money on before he learns better?";
      case "npc-tomas":
        if (!replyTopics.has("work") && !replyTopics.has("yard")) {
          return "Does the yard actually still need hands, or am I chasing yesterday's opening?";
        }
        return "If I pull my weight in the yard, does that open anything steadier than today's coins?";
      case "npc-nia":
        return "Who actually makes South Quay feel less strange once you know them?";
      default:
        break;
    }
  }

  if (objectiveFocus === "work") {
    if (npcId === "npc-ada") {
      if (!replyTopics.has("work")) {
        return "Do you actually need hands, or should I keep moving?";
      }
      return /\bfourteen\b|\bpay\b|\bcoin\b|\bcoins\b/.test(lastNpcReply ?? "")
        ? "If I take it, what does the room need from me first?"
        : "What does it pay if I keep up?";
    }

    if (npcId === "npc-tomas") {
      if (!replyTopics.has("work") && !replyTopics.has("yard")) {
        return "Is the yard actually short a back, or am I too late?";
      }
      return "If I step into the yard, what's the pay and what kind of pace are you expecting from me?";
    }

    if (npcId === "npc-mara") {
        return "Who on this block actually follows through when work opens up?";
    }
  }

  if (objectiveFocus === "help") {
    if (objectiveText.includes("pump") && npcId === "npc-jo") {
      return "If I buy the wrench, what am I likely to get wrong at the pump?";
    }

    if (objectiveText.includes("pump") && npcId === "npc-mara") {
      return "If I fix the pump, what else around the house settles down with it?";
    }

    if (objectiveText.includes("cart") && npcId === "npc-nia") {
      return "When does that cart turn from nuisance into a real jam?";
    }
  }

  if (objectiveFocus === "explore" || objectiveFocus === "people") {
    switch (npcId) {
      case "npc-mara":
        return "What does somebody new usually misunderstand about this block?";
      case "npc-ada":
        return "Who here is worth meeting before the day folds up?";
      case "npc-jo":
        return "What kind of trouble usually walks in before the people do?";
      case "npc-tomas":
        return "Who in the yard actually decides whether somebody belongs there?";
      case "npc-nia":
        return "What should I notice if I'm trying to read this place properly?";
      default:
        break;
    }
  }

  return undefined;
}

function extractActionTargetId(actionId: string) {
  const parts = actionId.split(":");
  return parts.length > 1 ? parts[1] : undefined;
}

function acceptJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  const location = currentLocation(world);

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

  if (!location || location.id !== job.locationId) {
    addFeed(world, "info", "You need to be at the job site before you can commit to the work.");
    return;
  }

  if (world.player.activeJobId && world.player.activeJobId !== job.id) {
    addFeed(world, "info", "You are already carrying another commitment.");
    return;
  }

  job.accepted = true;
  job.deferredUntilMinutes = undefined;
  world.player.activeJobId = job.id;
  addFeed(world, "job", `You took ${job.title.toLowerCase()}.`);
  remember(world, "job", `You committed to ${job.title.toLowerCase()} at ${findLocation(world, job.locationId)?.name}.`);
}

function deferJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(world, "info", "There is no live commitment here to push back.");
    return;
  }

  const dayStartMinutes = (world.clock.day - 1) * 24 * 60;
  const lastUsefulMinute = dayStartMinutes + job.endHour * 60 - 15;
  const deferredUntil = Math.min(world.clock.totalMinutes + 60, lastUsefulMinute);

  if (deferredUntil <= world.clock.totalMinutes + 5) {
    addFeed(world, "info", `There is not enough room left to safely defer ${job.title.toLowerCase()}.`);
    return;
  }

  job.deferredUntilMinutes = deferredUntil;
  world.player.currentThought = `I'm keeping ${job.title.toLowerCase()} alive, but not until about ${formatClockAt(world, deferredUntil)}.`;
  addFeed(
    world,
    "info",
    `You keep ${job.title.toLowerCase()} in hand, but push it back until about ${formatClockAt(world, deferredUntil)}.`,
  );
  remember(
    world,
    "self",
    `You pushed ${job.title.toLowerCase()} back for a bit instead of dropping the commitment entirely.`,
  );
}

function abandonJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(world, "info", "There is no live commitment here to walk away from.");
    return;
  }

  job.accepted = false;
  job.missed = true;
  job.deferredUntilMinutes = undefined;
  world.player.activeJobId = undefined;
  addFeed(world, "job", `You walked away from ${job.title.toLowerCase()}.`);
  remember(
    world,
    "job",
    `You let ${job.title.toLowerCase()} go instead of bending the day around it.`,
  );
}

function resumeJob(world: StreetGameState, jobId: string): void {
  const job = jobById(world, jobId);
  if (!job) {
    return;
  }

  if (!job.accepted || world.player.activeJobId !== job.id) {
    addFeed(world, "info", "There is no paused commitment here to pick back up.");
    return;
  }

  if (job.deferredUntilMinutes === undefined) {
    addFeed(world, "info", `${job.title} is already live in Rowan's head.`);
    return;
  }

  job.deferredUntilMinutes = undefined;
  addFeed(world, "info", `You pull ${job.title.toLowerCase()} back to the front of Rowan's day.`);
  remember(
    world,
    "self",
    `You brought ${job.title.toLowerCase()} back to the front instead of letting it wait any longer.`,
  );
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
  job.deferredUntilMinutes = undefined;

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
  const activeJob =
    world.player.activeJobId !== undefined
      ? jobById(world, world.player.activeJobId)
      : undefined;
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

  if (
    activeJob &&
    activeJob.accepted &&
    !activeJob.completed &&
    !activeJob.missed &&
    activeJob.locationId !== location?.id
  ) {
    const jobLocation = findLocation(world, activeJob.locationId);
    notes.push({
      id: `note-commitment-${activeJob.id}`,
      text:
        activeJob.deferredUntilMinutes !== undefined &&
        activeJob.deferredUntilMinutes > world.clock.totalMinutes
          ? `You're still committed to ${activeJob.title.toLowerCase()} at ${
              jobLocation?.name ?? "the job site"
            }, but you've pushed it back until about ${formatClockAt(
              world,
              activeJob.deferredUntilMinutes,
            )}.`
          : `You're still committed to ${activeJob.title.toLowerCase()} at ${
              jobLocation?.name ?? "the job site"
            }.`,
      tone: "lead",
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
      context: world.districtNarrative.context,
      backstory: world.districtNarrative.backstory,
      people,
      notes,
    };
  }

  return {
    locationId: location.id,
    title: location.name,
    description: location.description,
    context: location.context,
    backstory: location.backstory,
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
        description: npc.currentConcern || npc.summary,
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

  return prioritizeActionsForObjective(world, actions);
}

function buildGoals(world: StreetGameState): string[] {
  const completedJobs = world.jobs.filter((job) => job.completed).length;
  const knownPeople = world.player.knownNpcIds.length;
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;

  return [
    jobGoalLine(world.player.money, completedJobs, world.player.activeJobId),
    roomGoalLine(world),
    peopleGoalLine(knownPeople, trustedPeople),
  ];
}

function buildSummary(world: StreetGameState): string {
  const location = currentLocation(world);
  const completedJobs = world.jobs.filter((job) => job.completed).length;
  const solvedProblems = world.problems.filter((problem) => problem.status === "solved").length;
  const knownPlaces = world.player.knownLocationIds.length;
  const objective = world.player.objective;
  const nextObjectiveStep = objective?.trail.find((step) => !step.done);
  const activeJob =
    world.player.activeJobId !== undefined
      ? jobById(world, world.player.activeJobId)
      : undefined;

  const objectiveTail = objective
    ? ` I'm still trying to ${objectiveClause(objective.text)}.`
    : "";
  const nextStepTail = nextObjectiveStep
    ? ` Right now the next thing is to ${objectiveClause(nextObjectiveStep.title)}.`
    : "";
  const objectiveProgressTail = objective?.progress
    ? ` ${objective.progress.label}.`
    : "";
  const commitmentTail =
    activeJob && activeJob.accepted && !activeJob.completed && !activeJob.missed
      ? activeJob.deferredUntilMinutes !== undefined &&
        activeJob.deferredUntilMinutes > world.clock.totalMinutes
        ? ` I'm still committed to ${activeJob.title.toLowerCase()} at ${
            findLocation(world, activeJob.locationId)?.name ?? "the job site"
          }, but I've pushed it back until about ${formatClockAt(
            world,
            activeJob.deferredUntilMinutes,
          )}.`
        : world.player.currentLocationId === activeJob.locationId &&
            currentHour(world) >= activeJob.startHour &&
            currentHour(world) < activeJob.endHour
          ? ` The shift window is open right now at ${
              findLocation(world, activeJob.locationId)?.name ?? "the job site"
            }, so that comes first.`
          : currentHour(world) < activeJob.startHour
            ? ` I've already committed to ${activeJob.title.toLowerCase()} at ${
                findLocation(world, activeJob.locationId)?.name ?? "the job site"
              }, and it starts around ${formatHour(activeJob.startHour)}.`
            : currentHour(world) >= activeJob.startHour &&
                currentHour(world) < activeJob.endHour
              ? ` I've already committed to ${activeJob.title.toLowerCase()} at ${
                  findLocation(world, activeJob.locationId)?.name ?? "the job site"
                }, and the window is open now.`
        : ` I've already committed to ${activeJob.title.toLowerCase()} at ${
            findLocation(world, activeJob.locationId)?.name ?? "the job site"
          }, so that comes first until it resolves.`
      : "";

  return `${world.clock.label}, day ${world.clock.day}. I'm new to ${
    world.cityName
  }, and at ${
    location?.name ?? "the street"
  } in ${location?.neighborhood ?? world.districtName}, ${describeMoney(world.player.money)}, and ${describeEnergy(
    world.player.energy,
  )}. ${describeDistrictSense(knownPlaces)} ${describeStanding(completedJobs, solvedProblems)}${objectiveTail}${nextStepTail}${objectiveProgressTail}${commitmentTail}`;
}

function syncNpcInnerState(world: StreetGameState) {
  const hour = currentHour(world);
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const cartProblem = problemById(world, "problem-cart");
  const pumpProblem = problemById(world, "problem-pump");
  const playerHasWrench = hasItem(world, "item-wrench");

  for (const npc of world.npcs) {
    const narrative = getNpcNarrative(npc.id);

    switch (npc.id) {
      case "npc-mara":
        npc.currentObjective = narrative.objective;
        npc.currentConcern = pumpProblem?.discovered && pumpProblem.status === "active"
          ? "That pump is turning house trouble public."
          : hour < 12
            ? "Keep the house from slipping into rent talk."
            : "Decide whether this newcomer means strain, help, or maybe a future here.";
        npc.mood =
          pumpProblem?.discovered && pumpProblem.status === "active" ? "watchful" : "measured";
        npc.openness = clamp(npc.openness || 58, 36, 92);
        break;
      case "npc-ada":
        npc.currentObjective = narrative.objective;
        npc.currentConcern = teaJob?.accepted && !teaJob.completed
          ? "The room needs speed, not apologies."
          : hour < 12.5
            ? narrative.context
            : "Keep the room from falling behind the cups.";
        npc.mood = teaJob?.accepted && !teaJob.completed ? "brisk" : "pressed";
        npc.openness = clamp(npc.openness || 50, 30, 88);
        break;
      case "npc-jo":
        npc.currentObjective = narrative.objective;
        npc.currentConcern =
          pumpProblem?.discovered && pumpProblem.status === "active" && !playerHasWrench
            ? "That wrench should leave the bench before dusk."
            : narrative.context;
        npc.mood = "blunt";
        npc.openness = clamp(npc.openness || 44, 22, 82);
        break;
      case "npc-tomas":
        npc.currentObjective = narrative.objective;
        npc.currentConcern = yardJob?.accepted && !yardJob.completed
          ? "That lift needs finishing clean."
          : hour < 14
            ? narrative.context
            : "Keep the yard from slowing to somebody else's pace.";
        npc.mood = "hard-edged";
        npc.openness = clamp(npc.openness || 34, 18, 74);
        break;
      case "npc-nia":
        npc.currentObjective = narrative.objective;
        npc.currentConcern = cartProblem?.status === "active"
          ? "That jam in Quay Square is about to become everybody's problem."
          : npc.currentLocationId === "moss-pier"
            ? "Watch what comes off the boats before the story gets retold."
            : narrative.context;
        npc.mood = "alert";
        npc.openness = clamp(npc.openness || 60, 34, 94);
        break;
      default:
        npc.currentObjective ||= narrative.objective;
        npc.currentConcern ||= narrative.context;
        npc.summary ||= narrative.backstory;
        npc.mood ||= "steady";
        npc.openness = clamp(npc.openness || 50, 20, 90);
        break;
    }
  }
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

function ensureNpcKnown(world: StreetGameState, npc: NpcState) {
  npc.known = true;
  if (!world.player.knownNpcIds.includes(npc.id)) {
    world.player.knownNpcIds.push(npc.id);
  }
}

function recordConversation(
  world: StreetGameState,
  entry: Omit<ConversationEntry, "id" | "time" | "threadId">,
) {
  world.conversations ??= [];
  world.conversationThreads ??= {};
  const thread = ensureConversationThread(world, entry.npcId, entry.locationId);
  world.conversations.push({
    id: `conversation-${world.conversations.length + 1}-${world.clock.totalMinutes}`,
    time: isoFor(world.clock.totalMinutes),
    ...entry,
    threadId: thread.id,
  });

  thread.updatedAt = isoFor(world.clock.totalMinutes);
  thread.locationId = entry.locationId ?? thread.locationId;
  thread.lines = world.conversations
    .filter((conversation) => conversation.npcId === entry.npcId)
    .slice(-12);
  world.conversationThreads[entry.npcId] = thread;
}

function countPlayerConversationsWithNpc(world: StreetGameState, npcId: string) {
  return world.conversations.filter(
    (entry) => entry.npcId === npcId && entry.speaker === "player",
  ).length;
}

function countUniqueNpcConversations(world: StreetGameState) {
  return new Set(
    world.conversations
      .filter((entry) => entry.speaker === "player")
      .map((entry) => entry.npcId),
  ).size;
}

function minutesSinceLastNpcConversation(world: StreetGameState, npc: NpcState) {
  const lastInteraction = npc.lastInteractionAt;
  if (!lastInteraction) {
    return Number.POSITIVE_INFINITY;
  }

  const currentTime = Date.parse(world.currentTime);
  const lastTime = Date.parse(lastInteraction);
  if (Number.isNaN(currentTime) || Number.isNaN(lastTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((currentTime - lastTime) / 60000));
}

function clearActiveConversation(world: StreetGameState) {
  world.activeConversation = undefined;
}

function setActiveConversation(
  world: StreetGameState,
  npc: NpcState,
  options: {
    decision?: string;
    locationId?: string;
    objectiveText?: string;
  } = {},
) {
  const thread = ensureConversationThread(world, npc.id, options.locationId);
  const lines = thread.lines.slice(-6);
  if (lines.length === 0) {
    world.activeConversation = undefined;
    return;
  }

  world.activeConversation = {
    id: thread.id,
    threadId: thread.id,
    npcId: npc.id,
    locationId: options.locationId,
    updatedAt: thread.updatedAt,
    decision: options.decision,
    objectiveText: options.objectiveText,
    lines,
  };

  thread.decision = options.decision;
  thread.objectiveText = options.objectiveText;
  thread.summary = options.decision ?? options.objectiveText ?? thread.summary;
  thread.updatedAt = isoFor(world.clock.totalMinutes);
  thread.locationId = options.locationId ?? thread.locationId;
  world.conversationThreads[npc.id] = thread;
}

function ensureConversationThread(
  world: StreetGameState,
  npcId: string,
  locationId?: string,
): ConversationThreadState {
  world.conversationThreads ??= {};
  const existing = world.conversationThreads[npcId];
  if (existing) {
    return existing;
  }

  const threadId = threadIdForNpc(npcId);
  const lines = world.conversations
    .filter((entry) => entry.npcId === npcId)
    .slice(-12);

  const thread: ConversationThreadState = {
    id: threadId,
    npcId,
    updatedAt: world.currentTime,
    locationId,
    lines,
  };

  world.conversationThreads[npcId] = thread;
  return thread;
}

function threadIdForNpc(npcId: string) {
  return `conversation-thread-${npcId}`;
}

function buildAutonomousContinuation(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
) {
  const specific = buildAutonomousFollowup(
    world,
    npc.id,
    objective.focus,
    objective.text.toLowerCase(),
    lastNpcReply.toLowerCase(),
  );
  if (specific) {
    return specific;
  }

  const nextNpc = nextUntalkedNpc(world, npc.id);

  switch (objective.focus) {
    case "settle":
      return nextNpc
        ? "Who should I see after you if I'm trying to get my feet under me here?"
        : "What would stop me from still feeling new by tonight?";
    case "work":
      return "So if the money isn't right here, where do I put my feet next?";
    case "help":
      return "What needs doing first if I want to help instead of hover?";
    case "tool":
      return "If I spend the coin, what does it actually unlock for me?";
    case "explore":
    case "people":
      return nextNpc
        ? `Who should I go see after you if I'm making the rounds properly?`
        : "What am I still not reading right on this block?";
    case "rest":
      return "What can wait until I've got my legs back under me?";
    default:
      return "So where does that leave me right now?";
  }
}

function shouldAskAutonomousFollowup(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
  discussedTopics: Set<string>,
  initialResolution: ConversationResolution,
) {
  if (shouldForceAutonomousFollowup(world, npc, objective, lastNpcReply)) {
    return true;
  }

  if (initialResolution.decision || initialResolution.objectiveText) {
    return false;
  }

  if (objective.focus === "people" || objective.focus === "explore") {
    return Boolean(nextUntalkedNpc(world, npc.id));
  }

  if (discussedTopics.size === 0) {
    return true;
  }

  return /\b(maybe|depends|not sure|hard to say|ask around|look around|see who|could|might)\b/.test(
    lastNpcReply.toLowerCase(),
  );
}

function shouldForceAutonomousFollowup(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  lastNpcReply: string,
) {
  if (countPlayerConversationsWithNpc(world, npc.id) !== 1) {
    return false;
  }

  if (
    objective.focus !== "settle" &&
    objective.focus !== "work" &&
    objective.focus !== "help"
  ) {
    return false;
  }

  return Boolean(
    buildAutonomousFollowup(
      world,
      npc.id,
      objective.focus,
      objective.text.toLowerCase(),
      lastNpcReply.toLowerCase(),
    ),
  );
}

function deriveConversationResolution(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  closingReply: string,
  discussedTopics: Set<string>,
): ConversationResolution {
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const hasWrench = hasItem(world, "item-wrench");
  const nextNpc = nextUntalkedNpc(world, npc.id);
  const socialLoopObjective =
    objective.focus === "people" ||
    objective.focus === "explore" ||
    /\beveryone\b|\bmake the rounds\b|\bmeet people\b|\btalk to everyone\b/.test(
      objective.text.toLowerCase(),
    );
  const shouldSharpenObjective = !socialLoopObjective;
  const normalizedObjective = objective.text.toLowerCase();
  const objectiveAboutPump = /\bpump\b|\bleak\b|\bwrench\b/.test(normalizedObjective);
  const discussedPump = discussedTopics.has("pump") || objectiveAboutPump;

  if (socialLoopObjective && nextNpc) {
    return {
      decision: `talk to ${nextNpc.name} next and keep the rounds going.`,
      memoryKind: "person",
      memoryText: `${npc.name} gave the block a clearer shape, but you're still not done making the rounds.`,
    };
  }

  switch (npc.id) {
    case "npc-mara":
      if (
        discussedPump &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active" &&
        !hasWrench
      ) {
        return {
          decision: "get to Mercer Repairs for a wrench, then come back to the pump.",
          memoryKind: "problem",
          memoryText:
            "Talking with Mara made it plain that fixing the pump is the fastest way to stop looking like you're only passing through.",
          objectiveText: shouldSharpenObjective
            ? "Buy a wrench and fix the pump."
            : undefined,
        };
      }

      if (
        discussedPump &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active" &&
        hasWrench
      ) {
        return {
          decision: "go straight back to Morrow Yard and put the wrench to the pump.",
          memoryKind: "problem",
          memoryText:
            "Mara keeps turning talk back toward the shared trouble that's already making the house tense.",
          objectiveText: shouldSharpenObjective
            ? "Fix the pump in Morrow Yard."
            : undefined,
        };
      }

      if (teaJob?.discovered && !teaJob.accepted && !teaJob.completed) {
        return {
          decision: "get to Kettle & Lamp before the rush hardens and ask Ada for work.",
          memoryKind: "job",
          memoryText:
            "Mara reads usefulness in who follows through, not who sounds hungry.",
          objectiveText: shouldSharpenObjective
            ? "Get to Kettle & Lamp and ask Ada for work."
            : undefined,
        };
      }
      break;
    case "npc-ada":
      if (teaJob?.discovered && !teaJob.accepted && !teaJob.completed) {
        return {
          decision: "stay with Ada and take the tea-house shift if the room still needs the hands.",
          memoryKind: "job",
          memoryText:
            "Ada made the noon shift sound simple, but only if you can keep up once the room gets hot.",
          objectiveText: shouldSharpenObjective
            ? "Take the cup-and-counter shift at Kettle & Lamp."
            : undefined,
        };
      }

      if (yardJob?.discovered && !yardJob.accepted && !yardJob.completed) {
        return {
          decision: "head to North Crane Yard and see if Tomas still needs another back.",
          memoryKind: "job",
          memoryText:
            "Ada points you onward only after deciding you won't embarrass the chance in front of her.",
          objectiveText: shouldSharpenObjective
            ? "See if Tomas still needs another back in the yard."
            : undefined,
        };
      }
      break;
    case "npc-jo":
      if (
        discussedPump &&
        !hasWrench &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active"
      ) {
        return {
          decision: "decide whether Jo's wrench is worth the eight coins, then take it where it matters.",
          memoryKind: "self",
          memoryText:
            "Jo made the wrench feel less like a purchase and more like a decision about whether you'll actually use it.",
          objectiveText: shouldSharpenObjective
            ? "Buy a wrench and fix the pump."
            : undefined,
        };
      }

      if (
        discussedPump &&
        hasWrench &&
        pumpProblem?.discovered &&
        pumpProblem.status === "active"
      ) {
        return {
          decision: "leave the stall and go use the wrench before the pump gets worse.",
          memoryKind: "problem",
          memoryText:
            "Jo stripped the problem down to the part that still needs your hands, not more talk.",
          objectiveText: shouldSharpenObjective
            ? "Fix the pump in Morrow Yard."
            : undefined,
        };
      }
      break;
    case "npc-tomas":
      if (yardJob?.discovered && !yardJob.accepted && !yardJob.completed) {
        return {
          decision: "stay near the yard and take the lift if the pay and timing still stand.",
          memoryKind: "job",
          memoryText:
            "Tomas only hears the point of a conversation once it starts sounding like labor.",
          objectiveText: shouldSharpenObjective
            ? "Take the freight yard lift before the window closes."
            : undefined,
        };
      }
      break;
    case "npc-nia":
      if (cartProblem?.discovered && cartProblem.status === "active") {
        return {
          decision: "swing through Quay Square and clear the cart before the foot traffic swells.",
          memoryKind: "problem",
          memoryText:
            "Nia keeps seeing the small jams that become the whole block's problem if nobody moves first.",
          objectiveText: shouldSharpenObjective
            ? "Clear the jammed cart in Quay Square."
            : undefined,
        };
      }
      break;
    default:
      break;
  }

  if (nextNpc) {
    return {
      decision: `keep moving and talk to ${nextNpc.name} before the next opening goes stale.`,
      memoryKind: "person",
      memoryText: `${npc.name} helped narrow the district down to the next useful face.`,
    };
  }

  return {
    decision: `keep moving with ${closingReply.toLowerCase()}`,
    memoryKind: "self",
    memoryText: "The conversation gave you a clearer feel for where to lean next, even if it didn't hand you the whole answer.",
  };
}

function rememberNpcIfNew(npc: NpcState, text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || npc.memory.includes(normalized)) {
    return;
  }

  npc.memory.unshift(normalized);
  npc.memory = npc.memory.slice(0, 6);
}

function buildNpcConversationImpression(
  world: StreetGameState,
  npc: NpcState,
  objective: { text: string; focus: ObjectiveFocus; routeKey: string },
  resolution: ConversationResolution,
) {
  const nextMove = resolution.objectiveText ?? resolution.decision ?? objective.text;
  switch (npc.id) {
    case "npc-mara":
      return `Rowan sounded willing to ${objectiveClause(nextMove)}.`;
    case "npc-ada":
      return `Rowan might actually keep pace if the room turns hot.`;
    case "npc-jo":
      return `Rowan listened for the useful part instead of the shine.`;
    case "npc-tomas":
      return `Rowan kept the talk close to work and timing.`;
    case "npc-nia":
      return `Rowan paid attention to where the block is about to snag.`;
    default:
      return `Rowan stayed direct about wanting to ${objectiveClause(nextMove)}.`;
  }
}

function nextUntalkedNpc(world: StreetGameState, currentNpcId?: string) {
  return world.npcs
    .filter(
      (npc) =>
        npc.id !== currentNpcId &&
        countPlayerConversationsWithNpc(world, npc.id) === 0,
    )
    .sort((left, right) => {
      const leftDistance = distanceToLocation(world, left.currentLocationId);
      const rightDistance = distanceToLocation(world, right.currentLocationId);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return Number(right.known) - Number(left.known);
    })[0];
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function detectConversationTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(normalized)) {
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

  if (/\brent\b|\broom\b|\bhome\b|\bhouse\b|\blodg|\bstay\b/.test(normalized)) {
    topics.add("home");
  }

  if (/\brumou?r\b|\bgossip\b|\bnews\b|\bhear\b/.test(normalized)) {
    topics.add("gossip");
  }

  if (/\bcart\b|\bsquare\b|\bmarket\b/.test(normalized)) {
    topics.add("cart");
  }

  if (/\byard\b|\bload\b|\bcrate\b|\bcrane\b/.test(normalized)) {
    topics.add("yard");
  }

  if (/\bplease\b|\bthanks\b|\bthank you\b|\bappreciate\b/.test(normalized)) {
    topics.add("polite");
  }

  if (/\bstupid\b|\buseless\b|\bidiot\b|\bshut up\b/.test(normalized)) {
    topics.add("rude");
  }

  return topics;
}

function applyConversationRevelations(
  world: StreetGameState,
  npc: NpcState,
  topics: Set<string>,
) {
  switch (npc.id) {
    case "npc-mara":
      if (topics.has("pump")) {
        discoverProblem(world, "problem-pump");
        rememberIfNew(
          world,
          "person",
          "Mara keeps measuring usefulness in terms of what gets fixed for everybody, not what sounds impressive.",
        );
      }
      if (topics.has("work")) {
        discoverJob(world, "job-tea-shift");
      }
      break;
    case "npc-ada":
      if (topics.has("work")) {
        discoverJob(world, "job-tea-shift");
        if (jobById(world, "job-tea-shift")?.completed) {
          discoverJob(world, "job-yard-shift");
        }
      }
      rememberIfNew(
        world,
        "person",
        "Ada keeps listening for whether you will actually keep up once the room turns hot.",
      );
      break;
    case "npc-jo":
      if (topics.has("pump")) {
        discoverProblem(world, "problem-pump");
      }
      rememberIfNew(
        world,
        "person",
        "Jo speaks like tools should explain themselves if you are paying attention.",
      );
      break;
    case "npc-tomas":
      if (topics.has("work") || topics.has("yard")) {
        discoverJob(world, "job-yard-shift");
      }
      rememberIfNew(
        world,
        "person",
        "Tomas has no patience for style points if the load is still sitting there.",
      );
      break;
    case "npc-nia":
      if (topics.has("cart") || topics.has("help") || topics.has("gossip")) {
        discoverProblem(world, "problem-cart");
      }
      rememberIfNew(
        world,
        "person",
        "Nia watches for the small jams that reveal where the whole block is about to snag.",
      );
      break;
    default:
      break;
  }
}

function updateNpcTrustFromSpeech(
  npc: NpcState,
  text: string,
  topics: Set<string>,
) {
  const normalized = text.toLowerCase();
  let delta = 0;

  if (topics.has("polite")) {
    delta += 1;
  }

  if (
    (npc.id === "npc-mara" && (topics.has("help") || topics.has("pump") || topics.has("home"))) ||
    (npc.id === "npc-ada" && topics.has("work")) ||
    (npc.id === "npc-jo" && (topics.has("tool") || topics.has("pump"))) ||
    (npc.id === "npc-tomas" && (topics.has("work") || topics.has("yard"))) ||
    (npc.id === "npc-nia" && (topics.has("cart") || topics.has("gossip")))
  ) {
    delta += 1;
  }

  if (normalized.includes("need") || normalized.includes("trying to")) {
    delta += 0;
  }

  if (topics.has("rude")) {
    delta -= 1;
  }

  if (delta !== 0) {
    npc.trust = clamp(npc.trust + delta, 0, 5);
    npc.openness = clamp(npc.openness + delta * 5, 18, 96);
  }

  return delta;
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

function rememberIfNew(
  world: StreetGameState,
  kind: MemoryEntry["kind"],
  text: string,
) {
  if (world.player.memories.some((entry) => entry.kind === kind && entry.text === text)) {
    return;
  }

  remember(world, kind, text);
}

function trimFeed(world: StreetGameState) {
  world.feed = world.feed.slice(0, 18);
}

function trimMemories(world: StreetGameState) {
  world.player.memories = world.player.memories.slice(0, 18);
}

function trimConversations(world: StreetGameState) {
  world.conversations = world.conversations.slice(-24);
  world.conversationThreads = Object.fromEntries(
    Object.entries(world.conversationThreads ?? {}).map(([npcId, thread]) => [
      npcId,
      {
        ...thread,
        lines: thread.lines.slice(-12),
      },
    ]),
  );

  if (world.activeConversation) {
    const thread = world.conversationThreads[world.activeConversation.npcId];
    if (thread) {
      world.activeConversation = {
        ...world.activeConversation,
        updatedAt: thread.updatedAt,
        locationId: thread.locationId ?? world.activeConversation.locationId,
        decision: thread.decision ?? world.activeConversation.decision,
        objectiveText: thread.objectiveText ?? world.activeConversation.objectiveText,
        lines: thread.lines.slice(-6),
      };
    }
  }
}

async function hydrateStreetThoughts(
  world: StreetGameState,
  aiProvider: AIProvider,
  thoughtRefreshMode: ThoughtRefreshMode,
) {
  const thoughts =
    thoughtRefreshMode === "deterministic"
      ? buildDeterministicStreetThoughts(world)
      : await aiProvider.generateStreetThoughts(world);
  world.player.currentThought = thoughts.playerThought;

  for (const npc of world.npcs) {
    npc.currentThought = thoughts.npcThoughts[npc.id] ?? npc.currentThought;
  }
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

function formatClockAt(world: StreetGameState, totalMinutes: number) {
  const dayStartMinutes = (world.clock.day - 1) * 24 * 60;
  const minuteOfDay = Math.max(0, totalMinutes - dayStartMinutes) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function arrivalThought(
  world: StreetGameState,
  plan: ObjectivePlan,
  locationId: string,
) {
  const location = findLocation(world, locationId);
  if (!location) {
    return world.player.currentThought;
  }

  if (plan.npcId) {
    const npc = npcById(world, plan.npcId);
    return npc
      ? `I'm at ${location.name} now. I should see whether ${npc.name} actually has a minute for me.`
      : `I'm at ${location.name} now. I should read the room before I push any harder.`;
  }

  if (!plan.actionId) {
    return `I'm at ${location.name} now. I should read the room before I decide what this place is really good for.`;
  }

  const [kind, targetId] = plan.actionId.split(":");
  switch (kind) {
    case "accept": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job
        ? `I'm at ${location.name} now. I should see whether ${job.title.toLowerCase()} is still on the table.`
        : `I'm at ${location.name} now. I should see whether the work is still there.`;
    }
    case "work": {
      const job = targetId ? jobById(world, targetId) : undefined;
      return job
        ? `I'm where ${job.title.toLowerCase()} happens. I should steady myself before I start the shift.`
        : `I'm at the job site now. I should steady myself before I start.`;
    }
    case "solve": {
      const problem = targetId ? problemById(world, targetId) : undefined;
      return problem
        ? `I'm at ${location.name} now. I can deal with ${problem.title.toLowerCase()} once I know this is the right moment.`
        : `I'm at ${location.name} now. I should make sure this is the moment to step in.`;
    }
    case "inspect":
      return `I'm at ${location.name} now. I should look closer before I decide what to do with this lead.`;
    default:
      return `I'm at ${location.name} now. I should read the room before I commit to the next move.`;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function jobGoalLine(money: number, completedJobs: number, activeJobId?: string) {
  if (completedJobs >= 2 || money >= 30) {
    return "You've started proving you can build some real income here.";
  }

  if (activeJobId) {
    return "Hold onto the work in front of you and turn it into something steadier.";
  }

  if (money >= 20) {
    return "You've bought yourself a little time, but you still need steadier income.";
  }

  return "Find steady income before the city decides you're only passing through.";
}

function roomGoalLine(world: StreetGameState) {
  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const home = findLocation(world, world.player.homeLocationId);

  if (houseStanding >= 3) {
    return `${home?.name ?? "This place"} is starting to feel like somewhere you could actually stay awhile.`;
  }

  if (houseStanding >= 1) {
    return `Stay useful enough that ${home?.name ?? "this place"} still has a bed for you tonight.`;
  }

  return "Make sure tonight ends with somewhere to sleep, not another scramble.";
}

function peopleGoalLine(knownPeople: number, trustedPeople: number) {
  if (trustedPeople >= 2) {
    return "A couple of people are starting to feel like real friends instead of faces on the block.";
  }

  if (knownPeople >= 3) {
    return "Keep showing up until the block stops treating you like a stranger.";
  }

  return "Meet people who might become friends instead of just learning your name.";
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

function prioritizeActionsForObjective(
  world: StreetGameState,
  actions: ActionOption[],
) {
  const objective = currentObjectiveDirective(world);
  if (!objective) {
    return actions;
  }

  const scored = actions.map((action, index) => {
    const score = scoreActionForObjective(action, objective.text, objective.focus);

    return {
      action: {
        ...action,
        matchesObjective: score > 0,
      },
      index,
      score,
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (emphasisWeight(right.action.emphasis) !== emphasisWeight(left.action.emphasis)) {
      return emphasisWeight(right.action.emphasis) - emphasisWeight(left.action.emphasis);
    }

    return left.index - right.index;
  });

  return scored.map((entry) => entry.action);
}

function scoreActionForObjective(
  action: ActionOption,
  text: string,
  focus: ObjectiveFocus,
) {
  const normalized = text.toLowerCase();
  let score = 0;

  switch (focus) {
    case "settle":
      if (
        action.kind === "talk" ||
        action.kind === "accept_job" ||
        action.kind === "work_job" ||
        action.kind === "inspect"
      ) {
        score += 5;
      }
      break;
    case "work":
      if (action.kind === "accept_job" || action.kind === "work_job") {
        score += 5;
      }
      break;
    case "explore":
      if (action.kind === "talk" || action.kind === "inspect") {
        score += 4;
      }
      break;
    case "help":
      if (action.kind === "solve" || action.kind === "inspect") {
        score += 5;
      }
      break;
    case "rest":
      if (action.kind === "rest") {
        score += 6;
      }
      break;
    case "tool":
      if (action.kind === "buy") {
        score += 6;
      }
      break;
    case "people":
      if (action.kind === "talk") {
        score += 5;
      }
      break;
    default:
      break;
  }

  if (/(work|job|money|coin|earn|pay|shift|income)/.test(normalized)) {
    if (action.kind === "accept_job" || action.kind === "work_job") {
      score += 4;
    }
  }

  if (/(learn|explore|walk|lanes|district|map|bearings)/.test(normalized)) {
    if (action.kind === "talk" || action.kind === "inspect") {
      score += 3;
    }
  }

  if (/(help|fix|solve|repair|problem|pump|cart)/.test(normalized)) {
    if (action.kind === "solve" || action.kind === "inspect") {
      score += 4;
    }
  }

  if (/(rest|recover|sleep|sit|energy|tired)/.test(normalized)) {
    if (action.kind === "rest") {
      score += 5;
    }
  }

  if (/(buy|tool|wrench)/.test(normalized)) {
    if (action.kind === "buy") {
      score += 5;
    }
  }

  if (/(talk|meet|people|trust|introduce|ask|friend|friends)/.test(normalized)) {
    if (action.kind === "talk") {
      score += 4;
    }
  }

  if (/(room|stay|home|bed|shelter|belong|new here|new in|settle|get settled|footing|friend|friends|trust)/.test(normalized)) {
    if (
      action.kind === "talk" ||
      action.kind === "accept_job" ||
      action.kind === "work_job" ||
      action.kind === "inspect"
    ) {
      score += 3;
    }
  }

  if (normalized.includes("pump") && action.id.includes("problem-pump")) {
    score += 5;
  }

  if (normalized.includes("cart") && action.id.includes("problem-cart")) {
    score += 5;
  }

  if (normalized.includes("wrench") && action.id.includes("item-wrench")) {
    score += 5;
  }

  if (normalized.includes("tea") && action.id.includes("job-tea-shift")) {
    score += 5;
  }

  if (normalized.includes("yard") && action.id.includes("job-yard-shift")) {
    score += 5;
  }

  return score;
}

function emphasisWeight(emphasis: ActionOption["emphasis"]) {
  switch (emphasis) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function normalizeObjectiveText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

function objectiveClause(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "stay open to whatever the block puts in front of you";
  }

  const normalized = `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;

  return /[.!?]$/.test(normalized)
    ? normalized.slice(0, -1)
    : normalized;
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
