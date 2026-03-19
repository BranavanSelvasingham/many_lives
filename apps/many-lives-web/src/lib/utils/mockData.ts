import type {
  CharacterView,
  GameResponse,
  GameState,
  InboxMessageView,
  PolicySettings,
  PriorityLevel,
  RawCharacter,
  RawEvent,
  RawInboxMessage,
  RawPolicySettings,
  RawTask,
  RawWorldState,
  RiskLevel,
  SourceMode,
} from "@/lib/types/game";
import {
  clamp,
  formatClock,
  previewText,
  toActionId,
} from "@/lib/utils/format";
import { filterInboxMessages, priorityRank } from "@/lib/utils/priorities";

const mockGames = new Map<string, GameState>();
let mockCounter = 1;

export const avatarByCharacterId: Record<string, string> = {
  jordan: "/placeholder-avatar-jordan.png",
  maya: "/placeholder-avatar-maya.png",
  leo: "/placeholder-avatar-leo.png",
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
    priorityBias:
      draft.priorityBias === "relationships" ? "family" : draft.priorityBias,
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
  if ("gameId" in raw && "worldSummary" in raw) {
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
    worldSummary: {
      urgentCount: 0,
      activeThreads: 0,
      upcomingObligations: [],
      risks: {
        money: "low",
        relationship: "low",
        health: "low",
        schedule: "low",
      },
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

  nextGame.inbox = nextGame.inbox.map((message) =>
    message.id === messageId
      ? {
          ...message,
          resolvedAt: nextGame.currentTimeIso,
          requiresResponse: false,
          snoozedUntil: null,
        }
      : message,
  );

  const message = nextGame.inbox.find((item) => item.id === messageId);
  if (message) {
    nextGame.characters = nextGame.characters.map((character) => {
      if (character.id !== message.characterId) return character;

      const cashDelta =
        actionId.includes("switch") ||
        actionId.includes("vendor") ||
        actionId.includes("cover")
          ? -40
          : 0;
      const stressDelta = actionId.includes("wait")
        ? 3
        : actionId.includes("cancel")
          ? 5
          : -6;

      return {
        ...character,
        cash: Math.max(0, character.cash + cashDelta),
        stress: clamp(character.stress + stressDelta, 0, 100),
      };
    });
  }

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
    "delegate",
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

  nextGame.inbox.push({
    id: `delegate-${targetCharacterId}-${nextGame.tickCount}`,
    characterId: target.id,
    senderName: target.name,
    type: "status",
    priority: "normal",
    subject: "Delegated Thread Accepted",
    body: `${target.name} will absorb the redirected work and report back after the next block.`,
    preview: `${target.name} will absorb the redirected work and report back after the next block.`,
    createdAt: formatClock(nextGame.currentTimeIso),
    createdAtIso: nextGame.currentTimeIso,
    requiresResponse: false,
    suggestedActions: [{ id: "acknowledge", label: "Acknowledge" }],
    consequences: {
      stress: "medium",
      schedule: "medium",
    },
  });

  nextGame.characters = nextGame.characters.map((character) =>
    character.id === target.id
      ? {
          ...character,
          stress: clamp(character.stress + 6, 0, 100),
        }
      : character,
  );

  nextGame.summary = buildMockSummary(nextGame, "delegate");
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
    subtitle: formatRole(rawCharacter.role),
    currentTask: activeTask?.title ?? "Reviewing the next block",
    currentTaskEnds: activeTask ? formatClock(activeTask.dueAt) : "",
    location:
      rawCharacter.currentLocation || rawCharacter.homeLocation || "Unknown",
    stress: rawCharacter.stress,
    energy: rawCharacter.energy,
    cash: rawCharacter.cash,
    urgency: characterUrgency(rawCharacter, rawWorld),
    nextObligation: nextTask
      ? `${nextTask.title} at ${formatClock(nextTask.dueAt)}`
      : "No immediate obligation",
    nextObligationSnippet: nextTask?.description ?? "No pressure queued",
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

  const upcomingObligations = rawWorld
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
    risks: {
      money: highestConsequence(
        visibleMessages,
        "money",
        rawWorld?.tasks,
        "money",
      ),
      relationship: highestConsequence(
        visibleMessages,
        "relationship",
        rawWorld?.tasks,
        "family",
      ),
      health: healthRisk(game.characters),
      schedule: scheduleRisk(visibleMessages, rawWorld?.tasks),
    },
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
    ruleSummary: "",
  };
}

function buildSeedGame(gameId: string): GameState {
  const baseTime = "2026-03-16T12:00:00.000Z";
  const game: GameState = {
    gameId,
    scenarioName: "Busy Day Prototype",
    time: formatClock(baseTime),
    currentTimeIso: baseTime,
    tickCount: 0,
    summary:
      "Three lives are already in motion. The inbox is where the unstable parts surface.",
    source: "mock",
    characters: [
      {
        id: "jordan",
        name: "Jordan",
        role: "Office worker parent",
        subtitle: "Office worker parent",
        currentTask: "Morning standup prep",
        currentTaskEnds: "12:30",
        location: "Home office",
        stress: 58,
        energy: 51,
        cash: 120,
        urgency: "high",
        nextObligation: "School pickup at 15:30",
        nextObligationSnippet:
          "Family logistics will collide with office time later today.",
        recentEvents: [
          "Slept lightly",
          "Manager asked for a tighter budget pass",
          "School reminder came in early",
        ],
        priorities: ["Family", "Job stability", "Health"],
        autonomyProfile:
          "Medium autonomy, important only interruption, strict schedule protection",
        policy: {
          autonomy: "medium",
          spendWithoutAsking: 140,
          spendPreset: "custom",
          interruptWhen: "important_only",
          priorityBias: "family",
          riskTolerance: "balanced",
          scheduleProtection: "strict",
          reportingFrequency: "standard",
          escalationSensitivity: "normal",
          ruleSummary: "Protect family commitments when work starts to sprawl.",
        },
        scheduleSummary:
          "Balancing office work with school logistics and household handoffs.",
        load: 53,
      },
      {
        id: "maya",
        name: "Maya",
        role: "Freelancer",
        subtitle: "Freelancer",
        currentTask: "Client handoff prep",
        currentTaskEnds: "13:00",
        location: "Studio apartment",
        stress: 62,
        energy: 57,
        cash: 230,
        urgency: "urgent",
        nextObligation: "Client handoff at 13:00",
        nextObligationSnippet: "The delivery thread is live right now.",
        recentEvents: [
          "Vendor slipped the schedule",
          "Cash flow is stable for now",
          "Client is waiting on assets",
        ],
        priorities: ["Work", "Money", "Health"],
        autonomyProfile:
          "High autonomy, emergencies only interruption, flexible schedule protection",
        policy: {
          autonomy: "high",
          spendWithoutAsking: 200,
          spendPreset: "200",
          interruptWhen: "emergencies_only",
          priorityBias: "money",
          riskTolerance: "aggressive",
          scheduleProtection: "flexible",
          reportingFrequency: "minimal",
          escalationSensitivity: "low",
          ruleSummary: "",
        },
        scheduleSummary:
          "Protecting client reputation without burning the whole day on one crisis.",
        load: 52,
      },
      {
        id: "leo",
        name: "Leo",
        role: "Student",
        subtitle: "Student",
        currentTask: "Campus commute",
        currentTaskEnds: "12:45",
        location: "Dorm stop",
        stress: 46,
        energy: 66,
        cash: 48,
        urgency: "normal",
        nextObligation: "Chemistry lab at 13:00",
        nextObligationSnippet: "Lab is still manageable if the commute holds.",
        recentEvents: [
          "Bus board is slipping",
          "Group project still quiet",
          "Shift starts tonight",
        ],
        priorities: ["School", "Work", "Relationships"],
        autonomyProfile:
          "Medium autonomy, important only interruption, flexible schedule protection",
        policy: {
          autonomy: "medium",
          spendWithoutAsking: 50,
          spendPreset: "50",
          interruptWhen: "important_only",
          priorityBias: "work",
          riskTolerance: "balanced",
          scheduleProtection: "flexible",
          reportingFrequency: "detailed",
          escalationSensitivity: "high",
          ruleSummary: "",
        },
        scheduleSummary:
          "Trying to keep school, a shift, and basic wellbeing from colliding.",
        load: 40,
      },
    ],
    inbox: [
      {
        id: "msg_1",
        characterId: "maya",
        senderName: "Maya",
        type: "decision",
        priority: "urgent",
        subject: "Delivery Conflict",
        body: "The supplier is delayed by about two hours. If I wait, I will likely miss the client handoff.",
        preview:
          "The supplier is delayed by about two hours. If I wait, I will likely miss the client handoff.",
        createdAt: formatClock("2026-03-16T11:50:00.000Z"),
        createdAtIso: "2026-03-16T11:50:00.000Z",
        requiresResponse: true,
        suggestedActions: [
          { id: "switch_vendor", label: "Switch Vendor" },
          { id: "wait_2h", label: "Wait 2h" },
          { id: "reschedule_handoff", label: "Reschedule Handoff" },
          { id: "ask_jordan", label: "Ask Jordan" },
        ],
        consequences: {
          money: "medium",
          stress: "low",
          reputation: "high",
          relationship: "none",
          schedule: "high",
        },
      },
      {
        id: "msg_2",
        characterId: "jordan",
        senderName: "Jordan",
        type: "decision",
        priority: "high",
        subject: "Pickup Coverage Question",
        body: "If the budget review slips this afternoon, I should lock the family plan now instead of hoping it works itself out.",
        preview:
          "If the budget review slips this afternoon, I should lock the family plan now instead of hoping it works itself out.",
        createdAt: formatClock("2026-03-16T11:55:00.000Z"),
        createdAtIso: "2026-03-16T11:55:00.000Z",
        requiresResponse: true,
        suggestedActions: [
          { id: "protect_pickup", label: "Protect Pickup" },
          { id: "stay_flexible", label: "Stay Flexible" },
          { id: "ask_maya", label: "Ask Maya" },
        ],
        consequences: {
          stress: "medium",
          relationship: "high",
          schedule: "medium",
        },
      },
      {
        id: "msg_3",
        characterId: "leo",
        senderName: "Leo",
        type: "status",
        priority: "normal",
        subject: "Late Bus to Campus",
        body: "The campus shuttle is drifting. I should still make lab, but setup time is getting thinner.",
        preview:
          "The campus shuttle is drifting. I should still make lab, but setup time is getting thinner.",
        createdAt: formatClock("2026-03-16T11:45:00.000Z"),
        createdAtIso: "2026-03-16T11:45:00.000Z",
        requiresResponse: false,
        suggestedActions: [
          { id: "acknowledge", label: "Acknowledge" },
          { id: "call_rideshare", label: "Call a Rideshare" },
        ],
        consequences: {
          money: "low",
          stress: "medium",
          schedule: "medium",
        },
      },
    ],
    worldSummary: {
      urgentCount: 0,
      activeThreads: 0,
      upcomingObligations: [],
      risks: {
        money: "low",
        relationship: "low",
        health: "low",
        schedule: "low",
      },
    },
  };

  game.worldSummary = buildWorldSummary(game);
  return game;
}

function buildMockSummary(game: GameState, actionId = "", overrideText = "") {
  let summary = "Attention is distributed across three unstable lives.";
  if (actionId) {
    summary += ` Last decision: ${actionId.replaceAll("_", " ")}.`;
  }
  if (overrideText) {
    summary += ` Override sent: ${overrideText}.`;
  }
  return summary;
}

function spawnMockFollowups(game: GameState) {
  if (
    game.tickCount >= 4 &&
    !game.inbox.some((message) => message.id === "msg_followup_maya")
  ) {
    game.inbox.push({
      id: "msg_followup_maya",
      characterId: "maya",
      senderName: "Maya",
      type: "decision",
      priority: "urgent",
      subject: "Client Window Is Closing",
      body: "I can still preserve the handoff if I spend extra and reroute now.",
      preview:
        "I can still preserve the handoff if I spend extra and reroute now.",
      createdAt: formatClock(game.currentTimeIso),
      createdAtIso: game.currentTimeIso,
      requiresResponse: true,
      suggestedActions: [
        { id: "approve_spend", label: "Approve Spend" },
        { id: "delay_handoff", label: "Delay Handoff" },
        { id: "ask_jordan", label: "Ask Jordan" },
      ],
      consequences: {
        money: "high",
        stress: "medium",
        reputation: "high",
        schedule: "high",
      },
    });
  }

  if (
    game.tickCount >= 8 &&
    !game.inbox.some((message) => message.id === "msg_followup_jordan")
  ) {
    game.inbox.push({
      id: "msg_followup_jordan",
      characterId: "jordan",
      senderName: "Jordan",
      type: "decision",
      priority: "high",
      subject: "Pickup Plan Needs Locking",
      body: "The calendar is getting tighter. If you want family protected, I should commit now.",
      preview:
        "The calendar is getting tighter. If you want family protected, I should commit now.",
      createdAt: formatClock(game.currentTimeIso),
      createdAtIso: game.currentTimeIso,
      requiresResponse: true,
      suggestedActions: [
        { id: "protect_pickup", label: "Protect Pickup" },
        { id: "stay_flexible", label: "Stay Flexible" },
      ],
      consequences: {
        relationship: "high",
        stress: "medium",
        schedule: "medium",
      },
    });
  }
}

function formatRole(role: string) {
  if (role === "office-worker-parent") return "Office worker parent";
  if (role === "freelancer") return "Freelancer";
  if (role === "student") return "Student";
  return role.replaceAll("-", " ");
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
  return "interruption";
}

function normalizeActions(rawActions: RawInboxMessage["suggestedActions"]) {
  return rawActions.map((action) =>
    typeof action === "string"
      ? { id: toActionId(action), label: action }
      : { id: action.id ?? toActionId(action.label), label: action.label },
  );
}

function defaultConsequences(priority: PriorityLevel) {
  if (priority === "urgent") {
    return { money: "medium", schedule: "high", stress: "medium" } as const;
  }
  if (priority === "high") {
    return { schedule: "medium", stress: "medium" } as const;
  }
  return { schedule: "low" } as const;
}

function describeAutonomyProfile(policy: PolicySettings) {
  return `${capitalize(policy.autonomy)} autonomy, ${policy.interruptWhen.replaceAll(
    "_",
    " ",
  )} interruption, ${capitalize(policy.scheduleProtection)} schedule protection`;
}

function characterPriorities(rawCharacter: RawCharacter) {
  const priorities = [
    rawCharacter.policies.priorityBias === "family"
      ? "Family"
      : capitalize(rawCharacter.policies.priorityBias),
  ];
  for (const obligation of rawCharacter.obligations) {
    const label = capitalize(obligation);
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
    : ["No major interruptions yet", "Routine still holding"];
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

  if (messagePriority && priorityRank(messagePriority) <= 1)
    return messagePriority;
  if (rawCharacter.stress >= 80) return "urgent";
  if (rawCharacter.stress >= 60) return "high";
  if (rawCharacter.energy <= 35) return "normal";
  return "low";
}

function healthRisk(characters: CharacterView[]): RiskLevel {
  if (
    characters.some(
      (character) => character.stress >= 80 || character.energy <= 30,
    )
  ) {
    return "high";
  }
  if (
    characters.some(
      (character) => character.stress >= 65 || character.energy <= 45,
    )
  ) {
    return "medium";
  }
  return "low";
}

function highestConsequence(
  messages: InboxMessageView[],
  key: keyof InboxMessageView["consequences"],
  rawTasks?: RawTask[],
  taskKind?: string,
): RiskLevel {
  const messageLevel = messages.reduce<RiskLevel>((best, message) => {
    const next = message.consequences[key] ?? "none";
    return riskRank(next) > riskRank(best) ? next : best;
  }, "none");

  if (messageLevel !== "none") return messageLevel;
  if (
    rawTasks?.some(
      (task) => task.kind === taskKind && task.status !== "completed",
    )
  ) {
    return "medium";
  }
  return "low";
}

function scheduleRisk(
  messages: InboxMessageView[],
  tasks?: RawTask[],
): RiskLevel {
  const consequenceLevel = messages.reduce<RiskLevel>((best, message) => {
    const next = message.consequences.schedule ?? "none";
    return riskRank(next) > riskRank(best) ? next : best;
  }, "none");

  if (consequenceLevel === "high" || consequenceLevel === "medium") {
    return consequenceLevel;
  }

  const activeMandatory =
    tasks?.filter((task) => task.mandatory && task.status !== "completed")
      .length ?? 0;
  if (activeMandatory >= 2) return "high";
  if (activeMandatory === 1) return "medium";
  return "low";
}

function riskRank(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function addMinutes(raw: string, minutes: number) {
  const next = new Date(raw);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
