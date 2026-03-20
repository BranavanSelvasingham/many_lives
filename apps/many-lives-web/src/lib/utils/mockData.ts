import type {
  CharacterView,
  CityState,
  GameResponse,
  GameState,
  InboxMessageView,
  PolicySettings,
  PriorityLevel,
  RawCharacter,
  RawEvent,
  RawInboxMessage,
  RawPolicySettings,
  RawWorldState,
  RiskLevel,
  SourceMode,
  WorldAxis,
} from "@/lib/types/game";
import { ascensionDeck, initialAscensionMessageIds } from "@/lib/utils/ascensionDeck";
import { clamp, formatClock, previewText } from "@/lib/utils/format";
import {
  filterInboxMessages,
  messageConsequenceScore,
  priorityRank,
} from "@/lib/utils/priorities";

const mockGames = new Map<string, GameState>();
const axisKeys: WorldAxis[] = ["access", "momentum", "signal", "integrity"];
const pressureKeys = [
  "risk",
  "socialDebt",
  "rivalAttention",
  "windowNarrowing",
] as const;
const cityKeys = [...axisKeys, ...pressureKeys] as const;
const BASE_TIME = "2026-03-16T20:00:00.000Z";
let mockCounter = 1;

type CityDelta = Partial<Record<(typeof cityKeys)[number], number>>;

export const avatarByCharacterId: Record<string, string> = {
  ivo: "/placeholder-avatar-jordan.png",
  sia: "/placeholder-avatar-maya.png",
  ren: "/placeholder-avatar-leo.png",
  vale: "/placeholder-avatar-maya.png",
};

const seedCityState: CityState = {
  access: 61,
  momentum: 57,
  signal: 45,
  integrity: 63,
  risk: 58,
  socialDebt: 34,
  rivalAttention: 54,
  windowNarrowing: 47,
  worldPulse: [
    "A patronage network is collapsing in public and closing in private.",
    "Private technology is surfacing before the city has rules for it.",
    "A cultural vacuum is opening while rival circles search for new anchors.",
  ],
  rivalStatus:
    "Rival movement detected across the velvet rooms and hidden circuits.",
};

export function cloneGame(game: GameState) {
  return structuredClone(game);
}

export function createMockGame() {
  const game = buildSeedGame(`mock-${mockCounter++}`);
  mockGames.set(game.gameId, cloneGame(game));
  return cloneGame(game);
}

export function getStoredMockGame(gameId: string) {
  const existing = mockGames.get(gameId);
  return existing ? cloneGame(existing) : null;
}

export function storeMockGame(game: GameState) {
  mockGames.set(game.gameId, cloneGame(game));
  return cloneGame(game);
}

export function ensureMockGame(gameId: string, fallback?: GameState) {
  return storeMockGame(cloneGame(ensureMockBase(gameId, fallback)));
}

export function buildPolicyPatchFromDraft(draft: PolicySettings) {
  let threshold = 4;

  if (draft.interruptWhen === "always") threshold = 2;
  if (draft.interruptWhen === "important_only") threshold = 3;
  if (draft.interruptWhen === "emergencies_only") threshold = 5;

  if (draft.escalationSensitivity === "high") threshold -= 1;
  if (draft.escalationSensitivity === "low") threshold += 1;

  if (draft.scheduleProtection === "strict") threshold -= 1;
  if (draft.scheduleProtection === "opportunistic") threshold += 1;

  return {
    spendingLimit: draft.spendWithoutAsking,
    priorityBias: draft.priorityBias,
    riskTolerance:
      draft.riskTolerance === "careful"
        ? 0.2
        : draft.riskTolerance === "aggressive"
          ? 0.8
          : draft.autonomy === "low"
            ? 0.35
            : draft.autonomy === "high"
              ? 0.7
              : 0.5,
    reportingFrequency:
      draft.reportingFrequency === "minimal"
        ? "low"
        : draft.reportingFrequency === "detailed"
          ? "high"
          : "normal",
    escalationThreshold: clamp(threshold, 1, 6),
  } as const;
}

export function mergePolicyDraft(
  game: GameState,
  characterId: string,
  draft: PolicySettings,
  source: SourceMode = game.source,
) {
  const nextGame = cloneGame(game);
  nextGame.source = source;
  nextGame.characters = nextGame.characters.map((character) =>
    character.id === characterId
      ? {
          ...character,
          policy: structuredClone(draft),
          autonomyProfile: describeAutonomyProfile(draft),
        }
      : character,
  );
  nextGame.worldSummary = buildWorldSummary(nextGame);
  return nextGame;
}

export function normalizeGameResponse(
  response: GameResponse,
  source: SourceMode,
) {
  return normalizeGameState(response.game, source);
}

export function normalizeGameState(
  raw: RawWorldState | GameState,
  source: SourceMode,
) {
  if ("gameId" in raw && "worldSummary" in raw && "cityState" in raw) {
    return {
      ...cloneGame(raw),
      source,
      time: formatClock(raw.currentTimeIso || raw.time),
      worldSummary: buildWorldSummary(raw),
    };
  }

  const currentTimeIso = raw.currentTime;
  const characters = raw.characters.map((character) =>
    normalizeCharacter(character, raw),
  );
  const inbox = raw.inbox.map((message) => normalizeInboxMessage(message, raw));
  const cityState = raw.cityState
    ? structuredClone(raw.cityState)
    : inferCityState(raw, characters, inbox);

  const game: GameState = {
    gameId: raw.id,
    scenarioName: raw.scenarioName,
    time: formatClock(currentTimeIso),
    currentTimeIso,
    tickCount: raw.tickCount,
    summary: raw.summary,
    source,
    characters,
    inbox,
    cityState,
    worldSummary: {
      urgentCount: 0,
      activeThreads: 0,
      upcomingObligations: [],
      axes: {
        access: 0,
        momentum: 0,
        signal: 0,
        integrity: 0,
      },
      pressures: {
        risk: "low",
        socialDebt: "low",
        rivalAttention: "low",
        windowNarrowing: "low",
      },
      worldPulse: [],
      rivalStatus: "",
    },
  };

  game.worldSummary = buildWorldSummary(game, raw);
  return game;
}

export function tickMockGame(
  gameId: string,
  minutes: number,
  fallback?: GameState,
) {
  const base = ensureMockBase(gameId, fallback);
  const nextGame = cloneGame(base);
  const steps = Math.max(1, Math.round(minutes / 30));

  nextGame.source = "mock";
  nextGame.tickCount += steps;
  nextGame.currentTimeIso = addMinutes(nextGame.currentTimeIso, steps * 30);
  nextGame.time = formatClock(nextGame.currentTimeIso);

  nextGame.characters = nextGame.characters.map((character) => ({
    ...character,
    stress: clamp(character.stress + steps, 0, 100),
    energy: clamp(character.energy - steps, 0, 100),
    load: clamp(
      Math.round((character.stress + (100 - character.energy)) / 2),
      0,
      100,
    ),
  }));

  nextGame.cityState = {
    ...nextGame.cityState,
    momentum: clamp(nextGame.cityState.momentum + 1, 0, 100),
    integrity: clamp(nextGame.cityState.integrity - Math.ceil(steps / 2), 0, 100),
    risk: clamp(nextGame.cityState.risk + steps, 0, 100),
    rivalAttention: clamp(nextGame.cityState.rivalAttention + steps, 0, 100),
    windowNarrowing: clamp(nextGame.cityState.windowNarrowing + steps * 2, 0, 100),
    rivalStatus: rivalStatusFor(nextGame.cityState.rivalAttention + steps * 2),
  };

  spawnMockFollowups(nextGame);
  nextGame.summary = buildMockSummary(nextGame);
  nextGame.worldSummary = buildWorldSummary(nextGame);
  return storeMockGame(nextGame);
}

export function resolveMockMessage(
  gameId: string,
  messageId: string,
  actionId: string,
  overrideText = "",
  fallback?: GameState,
) {
  const nextGame = cloneGame(ensureMockBase(gameId, fallback));
  nextGame.source = "mock";

  const message = nextGame.inbox.find((item) => item.id === messageId);
  if (!message) {
    return storeMockGame(nextGame);
  }

  nextGame.inbox = nextGame.inbox.map((item) =>
    item.id === messageId
      ? {
          ...item,
          resolvedAt: nextGame.currentTimeIso,
          requiresResponse: false,
          snoozedUntil: null,
        }
      : item,
  );

  const character = nextGame.characters.find(
    (candidate) => candidate.id === message.characterId,
  );

  if (character) {
    applyCharacterOutcome(character, actionId);
  }

  applyCityOutcome(nextGame, message, actionId, overrideText);

  nextGame.summary = buildMockSummary(nextGame, actionId, overrideText);
  nextGame.worldSummary = buildWorldSummary(nextGame);
  return storeMockGame(nextGame);
}

export function snoozeMockMessage(
  gameId: string,
  messageId: string,
  durationMinutes: number,
  fallback?: GameState,
) {
  const nextGame = cloneGame(ensureMockBase(gameId, fallback));
  nextGame.source = "mock";
  nextGame.inbox = nextGame.inbox.map((message) =>
    message.id === messageId
      ? {
          ...message,
          snoozedUntil: addMinutes(nextGame.currentTimeIso, durationMinutes),
        }
      : message,
  );
  nextGame.cityState = {
    ...nextGame.cityState,
    momentum: clamp(nextGame.cityState.momentum - 2, 0, 100),
    windowNarrowing: clamp(nextGame.cityState.windowNarrowing + 2, 0, 100),
    rivalAttention: clamp(nextGame.cityState.rivalAttention + 1, 0, 100),
    rivalStatus: "Window narrowing while rival circles keep moving.",
  };
  nextGame.worldSummary = buildWorldSummary(nextGame);
  return storeMockGame(nextGame);
}

export function delegateMockMessage(
  gameId: string,
  messageId: string,
  targetCharacterId: string,
  fallback?: GameState,
) {
  const resolved = resolveMockMessage(
    gameId,
    messageId,
    "delegate_thread",
    "",
    fallback,
  );
  const nextGame = cloneGame(resolved);
  const target = nextGame.characters.find(
    (character) => character.id === targetCharacterId,
  );
  if (!target) {
    return storeMockGame(nextGame);
  }

  nextGame.inbox.unshift({
    id: `delegate-${targetCharacterId}-${nextGame.tickCount}`,
    characterId: target.id,
    senderName: target.name,
    type: "status",
    priority: "normal",
    subject: "Redirected Thread Accepted",
    body: `${target.name} will absorb the redirected opening and report back once the room stabilizes.`,
    preview: `${target.name} will absorb the redirected opening and report back once the room stabilizes.`,
    createdAt: formatClock(nextGame.currentTimeIso),
    createdAtIso: nextGame.currentTimeIso,
    requiresResponse: false,
    suggestedActions: [{ id: "acknowledge", label: "Acknowledge" }],
    consequences: {
      momentum: "medium",
      integrity: "medium",
    },
    tags: ["handoff", "redistribution"],
    followupHooks: ["Delegation buys reach now and coherence later only if the thread holds."],
  });

  nextGame.characters = nextGame.characters.map((character) =>
    character.id === target.id
      ? {
          ...character,
          stress: clamp(character.stress + 6, 0, 100),
          load: clamp(character.load + 4, 0, 100),
        }
      : character,
  );

  nextGame.cityState = {
    ...nextGame.cityState,
    momentum: clamp(nextGame.cityState.momentum + 2, 0, 100),
    integrity: clamp(nextGame.cityState.integrity - 3, 0, 100),
    socialDebt: clamp(nextGame.cityState.socialDebt + 2, 0, 100),
  };
  nextGame.summary = buildMockSummary(nextGame, "delegate_thread");
  nextGame.worldSummary = buildWorldSummary(nextGame);
  return storeMockGame(nextGame);
}

export function updateMockPolicy(
  gameId: string,
  characterId: string,
  draft: PolicySettings,
  fallback?: GameState,
) {
  const nextGame = mergePolicyDraft(
    ensureMockBase(gameId, fallback),
    characterId,
    draft,
    "mock",
  );
  nextGame.summary = buildMockSummary(nextGame);
  return storeMockGame(nextGame);
}

function ensureMockBase(gameId: string, fallback?: GameState) {
  const stored = mockGames.get(gameId);
  if (stored) return stored;
  if (fallback) {
    const shadow = cloneGame({ ...fallback, source: "mock" });
    mockGames.set(gameId, shadow);
    return shadow;
  }
  const seeded = buildSeedGame(gameId);
  mockGames.set(gameId, cloneGame(seeded));
  return seeded;
}

function normalizeCharacter(
  rawCharacter: RawCharacter,
  rawWorld: RawWorldState,
): CharacterView {
  const activeTask = rawWorld.tasks.find(
    (task) => task.id === rawCharacter.activeTaskId,
  );
  const nextTask = rawWorld.tasks
    .filter(
      (task) =>
        task.characterId === rawCharacter.id && task.status !== "completed",
    )
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))[0];
  const policy = normalizePolicy(rawCharacter.policies);

  return {
    id: rawCharacter.id,
    name: rawCharacter.name,
    role: formatRole(rawCharacter.role),
    subtitle: subtitleForRole(rawCharacter.role),
    currentTask: activeTask?.title ?? "Holding for the next opening",
    currentTaskEnds: activeTask ? formatClock(activeTask.dueAt) : "",
    location:
      rawCharacter.currentLocation || rawCharacter.homeLocation || "Unknown",
    stress: rawCharacter.stress,
    energy: rawCharacter.energy,
    cash: rawCharacter.cash,
    urgency: characterUrgency(rawCharacter, rawWorld),
    nextObligation: nextTask
      ? `${nextTask.title} at ${formatClock(nextTask.dueAt)}`
      : "No immediate opening locked",
    nextObligationSnippet:
      nextTask?.description ?? "The next decisive room has not hardened yet.",
    recentEvents: recentEvents(rawWorld.events, rawCharacter.id),
    priorities: characterPriorities(rawCharacter),
    autonomyProfile: describeAutonomyProfile(policy),
    policy,
    scheduleSummary: rawCharacter.scheduleSummary,
    load: clamp(
      Math.round((rawCharacter.stress + (100 - rawCharacter.energy)) / 2),
      0,
      100,
    ),
  };
}

function normalizeInboxMessage(
  rawMessage: RawInboxMessage,
  rawWorld: RawWorldState,
): InboxMessageView {
  const createdAtIso = rawMessage.createdAt;
  const senderName =
    rawMessage.senderName ??
    rawWorld.characters.find(
      (character) => character.id === rawMessage.characterId,
    )?.name ??
    "Unknown";
  const priority = normalizePriority(rawMessage.priority);
  const type = normalizeMessageType(
    rawMessage.type,
    rawMessage.requiresResponse,
  );

  return {
    id: rawMessage.id,
    characterId: rawMessage.characterId,
    senderName,
    type,
    priority,
    subject: rawMessage.subject,
    body: rawMessage.body,
    preview: previewText(rawMessage.body),
    createdAt: formatClock(createdAtIso),
    createdAtIso,
    requiresResponse: rawMessage.requiresResponse,
    suggestedActions: normalizeActions(rawMessage.suggestedActions),
    consequences: rawMessage.consequences ?? defaultConsequences(priority),
    tags: rawMessage.tags ?? [],
    followupHooks: rawMessage.followupHooks ?? [],
    snoozedUntil: rawMessage.snoozedUntil ?? null,
    delegatedToCharacterId: rawMessage.delegatedToCharacterId ?? undefined,
    resolvedAt: rawMessage.resolvedAt ?? null,
  };
}

function buildWorldSummary(game: GameState, rawWorld?: RawWorldState) {
  const visibleMessages = filterInboxMessages(
    game.inbox,
    "All",
    game.currentTimeIso,
  );
  const urgentCount = visibleMessages.filter(
    (message) => priorityRank(message.priority) <= 1,
  ).length;

  const upcomingObligations = visibleMessages.length
    ? [...visibleMessages]
        .sort((left, right) => messageConsequenceScore(right) - messageConsequenceScore(left))
        .slice(0, 3)
        .map((message) => message.subject)
    : rawWorld
      ? rawWorld.tasks
          .filter((task) => task.status !== "completed")
          .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
          .slice(0, 3)
          .map((task) => `${task.title} at ${formatClock(task.dueAt)}`)
      : game.characters
          .map((character) => character.nextObligation)
          .filter(Boolean)
          .slice(0, 3);

  return {
    urgentCount,
    activeThreads: visibleMessages.length,
    upcomingObligations,
    axes: {
      access: game.cityState.access,
      momentum: game.cityState.momentum,
      signal: game.cityState.signal,
      integrity: game.cityState.integrity,
    },
    pressures: {
      risk: pressureFromSources(game.cityState.risk, visibleMessages, "risk"),
      socialDebt: pressureFromSources(
        game.cityState.socialDebt,
        visibleMessages,
        "socialDebt",
      ),
      rivalAttention: pressureFromSources(
        game.cityState.rivalAttention,
        visibleMessages,
        "rivalAttention",
      ),
      windowNarrowing: levelFromValue(game.cityState.windowNarrowing),
    },
    worldPulse: game.cityState.worldPulse,
    rivalStatus: game.cityState.rivalStatus,
  };
}

function normalizePolicy(rawPolicy: RawPolicySettings): PolicySettings {
  const spendWithoutAsking = rawPolicy.spendingLimit;
  return {
    autonomy:
      rawPolicy.riskTolerance <= 0.3
        ? "low"
        : rawPolicy.riskTolerance >= 0.7
          ? "high"
          : "medium",
    spendWithoutAsking,
    spendPreset:
      spendWithoutAsking === 0
        ? "0"
        : spendWithoutAsking === 50
          ? "50"
          : spendWithoutAsking === 200
            ? "200"
            : "custom",
    interruptWhen:
      rawPolicy.escalationThreshold <= 2
        ? "always"
        : rawPolicy.escalationThreshold >= 5
          ? "emergencies_only"
          : "important_only",
    priorityBias: rawPolicy.priorityBias,
    riskTolerance:
      rawPolicy.riskTolerance <= 0.3
        ? "careful"
        : rawPolicy.riskTolerance >= 0.7
          ? "aggressive"
          : "balanced",
    scheduleProtection:
      rawPolicy.escalationThreshold <= 2
        ? "strict"
        : rawPolicy.escalationThreshold >= 5
          ? "opportunistic"
          : "flexible",
    reportingFrequency:
      rawPolicy.reportingFrequency === "high"
        ? "detailed"
        : rawPolicy.reportingFrequency === "low"
          ? "minimal"
          : "standard",
    escalationSensitivity:
      rawPolicy.escalationThreshold <= 2
        ? "high"
        : rawPolicy.escalationThreshold >= 5
          ? "low"
          : "normal",
    ruleSummary: standingRuleFor(rawPolicy.priorityBias),
  };
}

function buildSeedGame(gameId: string): GameState {
  const game: GameState = {
    gameId,
    scenarioName: "The Ascension Window",
    time: formatClock(BASE_TIME),
    currentTimeIso: BASE_TIME,
    tickCount: 0,
    summary:
      "The city is reordering itself, and no one with only one life can shape what comes next.",
    source: "mock",
    characters: [
      {
        id: "ivo",
        name: "Ivo",
        role: "The Architect",
        subtitle: "Secures structural advantage inside private machinery.",
        currentTask: "Holding the guest-ledger seam",
        currentTaskEnds: formatClock(addMinutes(BASE_TIME, 60)),
        location: "Vantage Annex",
        stress: 42,
        energy: 72,
        cash: 380,
        urgency: "high",
        nextObligation: `Ghost List at ${formatClock(addMinutes(BASE_TIME, 90))}`,
        nextObligationSnippet:
          "A private gap is open and will close the moment someone audits the room.",
        recentEvents: [
          "Borrowed access became available",
          "A patron ledger surfaced your name",
          "Two rooms asked for a version of you tonight",
        ],
        priorities: ["Access", "Leverage", "Control"],
        autonomyProfile:
          "High autonomy, high-value openings only, guard coherence",
        policy: {
          autonomy: "high",
          spendWithoutAsking: 200,
          spendPreset: "200",
          interruptWhen: "important_only",
          priorityBias: "access",
          riskTolerance: "balanced",
          scheduleProtection: "strict",
          reportingFrequency: "minimal",
          escalationSensitivity: "normal",
          ruleSummary:
            "Trade comfort for structural advantage, but never accept leverage you do not understand.",
        },
        scheduleSummary:
          "Moving through gatekeepers, hidden systems, and rooms that decide who gets written into the next order.",
        load: 35,
      },
      {
        id: "sia",
        name: "Sia",
        role: "The Signal",
        subtitle: "Turns your life into work the next era cannot ignore.",
        currentTask: "Tuning the unfinished debut",
        currentTaskEnds: formatClock(addMinutes(BASE_TIME, 45)),
        location: "Glasshouse rehearsal floor",
        stress: 56,
        energy: 66,
        cash: 140,
        urgency: "urgent",
        nextObligation: `Unfinished Debut at ${formatClock(addMinutes(BASE_TIME, 60))}`,
        nextObligationSnippet:
          "The work can go live before it is safe, while attention is still unstable.",
        recentEvents: [
          "A leak began breathing among tastemakers",
          "A bigger name asked into the work",
          "An afterhours slot opened out of nowhere",
        ],
        priorities: ["Signal", "Myth", "Originality"],
        autonomyProfile:
          "High autonomy, any decisive shift, chase openings",
        policy: {
          autonomy: "high",
          spendWithoutAsking: 50,
          spendPreset: "50",
          interruptWhen: "always",
          priorityBias: "signal",
          riskTolerance: "aggressive",
          scheduleProtection: "opportunistic",
          reportingFrequency: "detailed",
          escalationSensitivity: "high",
          ruleSummary:
            "If the work can wound the room into remembering us, do not sand it down for safety.",
        },
        scheduleSummary:
          "Moving between debut energy, leaking signal, and the danger of becoming unforgettable too early.",
        load: 45,
      },
      {
        id: "ren",
        name: "Ren",
        role: "The Gravity",
        subtitle: "Makes powerful people begin arranging themselves around you.",
        currentTask: "Reading the velvet room before the doors reset",
        currentTaskEnds: formatClock(addMinutes(BASE_TIME, 30)),
        location: "Velvet district antechamber",
        stress: 48,
        energy: 74,
        cash: 260,
        urgency: "urgent",
        nextObligation: `Velvet Window at ${formatClock(addMinutes(BASE_TIME, 30))}`,
        nextObligationSnippet:
          "A room that never opens to newcomers is open, but not for long.",
        recentEvents: [
          "A constellation began to split",
          "An impossible introduction came within reach",
          "Someone central looked at you twice",
        ],
        priorities: ["Momentum", "Orbit", "Invitation"],
        autonomyProfile:
          "Medium autonomy, high-value openings only, stay fluid",
        policy: {
          autonomy: "medium",
          spendWithoutAsking: 200,
          spendPreset: "200",
          interruptWhen: "important_only",
          priorityBias: "momentum",
          riskTolerance: "balanced",
          scheduleProtection: "flexible",
          reportingFrequency: "standard",
          escalationSensitivity: "normal",
          ruleSummary:
            "Do not collect attention. Convert it into orbit around the people the future will bend through.",
        },
        scheduleSummary:
          "Holding chemistry, status, and invitation at the exact moment rival circles are choosing sides.",
        load: 37,
      },
      {
        id: "vale",
        name: "Vale",
        role: "The Threshold",
        subtitle: "Finds the crack through which tomorrow enters the city.",
        currentTask: "Following a rumor with coordinates",
        currentTaskEnds: formatClock(addMinutes(BASE_TIME, 75)),
        location: "North tram undercroft",
        stress: 51,
        energy: 63,
        cash: 90,
        urgency: "high",
        nextObligation: `Hidden circuit at ${formatClock(addMinutes(BASE_TIME, 105))}`,
        nextObligationSnippet:
          "A hidden floor, a dark prototype, and an ugly room all point to the same emerging scene.",
        recentEvents: [
          "A rumor gained coordinates",
          "A stairwell opened where none should be",
          "The future started in a room with bad lighting",
        ],
        priorities: ["Thresholds", "Discovery", "Destiny"],
        autonomyProfile:
          "Medium autonomy, any decisive shift, chase openings",
        policy: {
          autonomy: "medium",
          spendWithoutAsking: 50,
          spendPreset: "50",
          interruptWhen: "always",
          priorityBias: "integrity",
          riskTolerance: "aggressive",
          scheduleProtection: "opportunistic",
          reportingFrequency: "standard",
          escalationSensitivity: "high",
          ruleSummary:
            "Go where tomorrow is leaking in, but do not let the strange thread tear the network apart.",
        },
        scheduleSummary:
          "Sampling rumors, fringe signals, and unstable openings before anyone has named the scene.",
        load: 44,
      },
    ],
    inbox: initialAscensionMessageIds.map((id) =>
      deckMessageToInbox(id, BASE_TIME),
    ),
    cityState: structuredClone(seedCityState),
    worldSummary: {
      urgentCount: 0,
      activeThreads: 0,
      upcomingObligations: [],
      axes: {
        access: 0,
        momentum: 0,
        signal: 0,
        integrity: 0,
      },
      pressures: {
        risk: "low",
        socialDebt: "low",
        rivalAttention: "low",
        windowNarrowing: "low",
      },
      worldPulse: [],
      rivalStatus: "",
    },
  };

  game.worldSummary = buildWorldSummary(game);
  return game;
}

function buildMockSummary(game: GameState, actionId = "", overrideText = "") {
  let summary =
    "The city is reordering itself, and no one with only one life can shape what comes next.";

  if (actionId) {
    summary += ` Last directive: ${humanizeActionId(actionId)}.`;
  }

  if (overrideText) {
    summary += ` Custom directive sent: ${overrideText}.`;
  }

  summary += ` Access ${game.cityState.access}. Momentum ${game.cityState.momentum}. Signal ${game.cityState.signal}. Integrity ${game.cityState.integrity}.`;
  return summary;
}

function spawnMockFollowups(game: GameState) {
  const unlocked = ascensionDeck.filter(
    (seed) =>
      seed.unlockAtTick > 0 &&
      seed.unlockAtTick <= game.tickCount &&
      !game.inbox.some((message) => message.id === seed.id),
  );

  for (const seed of unlocked) {
    game.inbox.unshift(deckMessageToInbox(seed.id, game.currentTimeIso));
  }
}

function deckMessageToInbox(messageId: string, createdAtIso: string) {
  const seed = ascensionDeck.find((entry) => entry.id === messageId);
  if (!seed) {
    throw new Error(`Unknown deck message ${messageId}`);
  }

  const resolvedCreatedAtIso =
    createdAtIso === BASE_TIME
      ? addMinutes(BASE_TIME, seed.createdOffsetMinutes)
      : createdAtIso;

  return {
    id: seed.id,
    characterId: seed.characterId,
    senderName: seed.senderName,
    type: seed.type,
    priority: seed.priority,
    subject: seed.subject,
    body: seed.body,
    preview: seed.preview,
    createdAt: formatClock(resolvedCreatedAtIso),
    createdAtIso: resolvedCreatedAtIso,
    requiresResponse: seed.requiresResponse,
    suggestedActions: structuredClone(seed.suggestedActions),
    consequences: structuredClone(seed.consequences),
    tags: structuredClone(seed.tags ?? []),
    followupHooks: structuredClone(seed.followupHooks ?? []),
  } satisfies InboxMessageView;
}

function applyCharacterOutcome(character: CharacterView, actionId: string) {
  let stressDelta = -4;
  let energyDelta = -2;

  if (matchesAction(actionId, ["wait", "hold", "save", "verify", "watch"])) {
    stressDelta = -1;
    energyDelta = 1;
  } else if (
    matchesAction(actionId, [
      "split",
      "reveal",
      "enter",
      "take",
      "touch",
      "move",
      "claim",
      "back",
      "collaborate",
    ])
  ) {
    stressDelta = 2;
    energyDelta = -4;
  } else if (matchesAction(actionId, ["decline", "leave", "refuse", "deny"])) {
    stressDelta = -2;
    energyDelta = 1;
  }

  character.stress = clamp(character.stress + stressDelta, 0, 100);
  character.energy = clamp(character.energy + energyDelta, 0, 100);
  character.load = clamp(
    Math.round((character.stress + (100 - character.energy)) / 2),
    0,
    100,
  );
}

function applyCityOutcome(
  game: GameState,
  message: InboxMessageView,
  actionId: string,
  overrideText: string,
) {
  const seed = ascensionDeck.find((entry) => entry.id === message.id);
  const delta: CityDelta =
    (seed?.actionImpacts?.[actionId] as CityDelta | undefined) ??
    genericActionImpact(actionId);

  for (const key of cityKeys) {
    if (delta[key] == null) continue;
    game.cityState[key] = clamp(game.cityState[key] + (delta[key] ?? 0), 0, 100);
  }

  if (overrideText) {
    game.cityState.signal = clamp(game.cityState.signal + 1, 0, 100);
  }

  if (message.consequences.risk) {
    game.cityState.risk = clamp(
      game.cityState.risk - riskScore(message.consequences.risk),
      0,
      100,
    );
  }

  game.cityState.rivalStatus = rivalStatusFor(game.cityState.rivalAttention);
}

function genericActionImpact(actionId: string): CityDelta {
  if (matchesAction(actionId, ["claim", "enter", "take", "move", "convert"])) {
    return {
      access: 4,
      momentum: 4,
      integrity: -1,
      rivalAttention: 2,
    };
  }

  if (matchesAction(actionId, ["reveal", "feed", "inhabit", "collaborate"])) {
    return {
      signal: 5,
      momentum: 2,
      rivalAttention: 3,
      integrity: -1,
    };
  }

  if (matchesAction(actionId, ["verify", "refine", "correct", "save"])) {
    return {
      integrity: 3,
      momentum: -1,
    };
  }

  if (matchesAction(actionId, ["decline", "leave", "deny", "refuse"])) {
    return {
      integrity: 2,
      access: -2,
      signal: -1,
      windowNarrowing: 2,
    };
  }

  if (matchesAction(actionId, ["wait", "hold", "watch"])) {
    return {
      integrity: 1,
      momentum: -2,
      rivalAttention: 1,
    };
  }

  return {
    momentum: 1,
  };
}

function formatRole(role: string) {
  if (role === "architect") return "The Architect";
  if (role === "signal") return "The Signal";
  if (role === "gravity") return "The Gravity";
  if (role === "threshold") return "The Threshold";
  return role.replaceAll("-", " ");
}

function subtitleForRole(role: string) {
  if (role === "architect")
    return "Secures structural advantage through quiet leverage.";
  if (role === "signal")
    return "Creates the work the next era cannot ignore.";
  if (role === "gravity")
    return "Turns attention into orbit and allegiance.";
  if (role === "threshold")
    return "Finds tomorrow while it is still deniable.";
  return formatRole(role);
}

function normalizePriority(
  priority: RawInboxMessage["priority"],
): PriorityLevel {
  if (priority === "critical") return "urgent";
  if (priority === "high") return "high";
  if (priority === "medium") return "normal";
  return "low";
}

function normalizeMessageType(
  type: RawInboxMessage["type"],
  requiresResponse: boolean,
) {
  if (requiresResponse) return "decision";
  if (type === "update") return "status";
  if (type === "summary") return "social";
  if (type === "alert") return "interruption";
  return "opportunity";
}

function normalizeActions(rawActions: RawInboxMessage["suggestedActions"]) {
  return rawActions.map((action) =>
    typeof action === "string"
      ? { id: action.toLowerCase().replaceAll(/\s+/g, "_"), label: action }
      : {
          id: action.id ?? action.label.toLowerCase().replaceAll(/\s+/g, "_"),
          label: action.label,
        },
  );
}

function defaultConsequences(priority: PriorityLevel) {
  if (priority === "urgent") {
    return {
      momentum: "high",
      integrity: "medium",
      rivalAttention: "medium",
    } as const;
  }
  if (priority === "high") {
    return {
      momentum: "medium",
      risk: "medium",
    } as const;
  }
  return { momentum: "low" } as const;
}

function describeAutonomyProfile(policy: PolicySettings) {
  const interruptLabel =
    policy.interruptWhen === "always"
      ? "any decisive shift"
      : policy.interruptWhen === "important_only"
        ? "high-value openings only"
        : "coherence breaks only";
  const scheduleLabel =
    policy.scheduleProtection === "strict"
      ? "guard coherence"
      : policy.scheduleProtection === "opportunistic"
        ? "chase openings"
        : "stay fluid";

  return `${capitalize(policy.autonomy)} autonomy, ${interruptLabel}, ${scheduleLabel}`;
}

function characterPriorities(rawCharacter: RawCharacter) {
  const priorities = [capitalize(rawCharacter.policies.priorityBias)];
  for (const obligation of rawCharacter.obligations) {
    const label = capitalize(obligation.replaceAll("-", " "));
    if (!priorities.includes(label)) priorities.push(label);
    if (priorities.length >= 3) break;
  }
  return priorities;
}

function recentEvents(events: RawEvent[], characterId: string) {
  const entries = events
    .filter((event) => event.characterId === characterId)
    .slice(-3)
    .reverse()
    .map((event) => event.title);

  return entries.length > 0
    ? entries
    : ["No decisive openings yet", "The city is still rearranging itself"];
}

function characterUrgency(
  rawCharacter: RawCharacter,
  rawWorld: RawWorldState,
): PriorityLevel {
  const messagePriority = rawWorld.inbox
    .filter(
      (message) =>
        message.characterId === rawCharacter.id && message.resolvedAt == null,
    )
    .map((message) => normalizePriority(message.priority))
    .sort((left, right) => priorityRank(left) - priorityRank(right))[0];

  if (messagePriority && priorityRank(messagePriority) <= 1) {
    return messagePriority;
  }
  if (rawCharacter.stress >= 80) return "urgent";
  if (rawCharacter.stress >= 60) return "high";
  if (rawCharacter.energy <= 35) return "normal";
  return "low";
}

function inferCityState(
  rawWorld: RawWorldState,
  characters: CharacterView[],
  inbox: InboxMessageView[],
): CityState {
  const unresolved = filterInboxMessages(inbox, "All", rawWorld.currentTime);
  const accessPressure = riskRank(highestConsequence(unresolved, "access"));
  const signalPressure = riskRank(highestConsequence(unresolved, "signal"));
  const riskPressure = riskRank(highestConsequence(unresolved, "risk"));
  const debtPressure = riskRank(highestConsequence(unresolved, "socialDebt"));
  const rivalPressure = riskRank(
    highestConsequence(unresolved, "rivalAttention"),
  );
  const values = {
    access: 42 + accessPressure * 6,
    momentum: 40 + unresolved.length * 2,
    signal: 36 + signalPressure * 7,
    integrity:
      72 -
      Math.round(
        characters.reduce((sum, character) => sum + character.stress, 0) /
          Math.max(1, characters.length) /
          2,
      ),
    risk: 34 + riskPressure * 8,
    socialDebt: 22 + debtPressure * 8,
    rivalAttention: 28 + rivalPressure * 9,
    windowNarrowing: 36 + Math.min(18, rawWorld.tickCount * 2),
  };

  return {
    ...Object.fromEntries(
      [...axisKeys, ...pressureKeys].map((key) => [
        key,
        clamp(values[key], 0, 100),
      ]),
    ),
    worldPulse: [
      "Power, culture, and technology are changing hands at once.",
      "Rival circles are searching for figures to anchor themselves to.",
      "A hidden circuit is briefly accessible.",
    ],
    rivalStatus: rivalStatusFor(values.rivalAttention),
  } as CityState;
}

function standingRuleFor(axis: WorldAxis) {
  switch (axis) {
    case "access":
      return "Enter cleanly or do not enter at all.";
    case "momentum":
      return "Do not let the room cool while the city is choosing.";
    case "signal":
      return "Make work they cannot reorganize around without naming us.";
    case "integrity":
      return "Protect coherence before brilliance turns into fragmentation.";
  }
}

function pressureFromSources(
  baseValue: number,
  messages: InboxMessageView[],
  key: keyof InboxMessageView["consequences"],
): RiskLevel {
  const messagePressure = highestConsequence(messages, key);
  const basePressure = levelFromValue(baseValue);
  return riskRank(messagePressure) > riskRank(basePressure)
    ? messagePressure
    : basePressure;
}

function highestConsequence(
  messages: InboxMessageView[],
  key: keyof InboxMessageView["consequences"],
) {
  return messages.reduce<RiskLevel>((best, message) => {
    const next = message.consequences[key] ?? "none";
    return riskRank(next) > riskRank(best) ? next : best;
  }, "none");
}

function levelFromValue(value: number): RiskLevel {
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  if (value >= 15) return "low";
  return "none";
}

function riskScore(level: RiskLevel) {
  if (level === "high") return 6;
  if (level === "medium") return 3;
  if (level === "low") return 1;
  return 0;
}

function riskRank(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function rivalStatusFor(rivalAttention: number) {
  if (rivalAttention >= 75) {
    return "Another circle is claiming openings before the room can cool.";
  }
  if (rivalAttention >= 50) {
    return "Rival movement detected around the same decisive rooms.";
  }
  return "Rivals are watching, but they have not yet fixed the story.";
}

function matchesAction(actionId: string, tokens: string[]) {
  const normalized = actionId.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function humanizeActionId(actionId: string) {
  return actionId.replaceAll("_", " ").replaceAll("-", " ");
}

function addMinutes(raw: string, minutes: number) {
  const next = new Date(raw);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
