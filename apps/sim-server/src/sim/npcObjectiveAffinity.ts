import type { NpcState, ObjectiveFocus } from "../street-sim/types.js";

type NpcObjectiveAffinityNpc = Pick<NpcState, "id" | "known">;

export type NpcObjectiveAffinityContext = {
  allowImmediateFollowup: boolean;
  minutesSinceConversation: number;
  npc?: NpcObjectiveAffinityNpc;
  objectiveFocus: ObjectiveFocus;
  objectiveText: string;
  playerConversationCount: number;
  totalNpcCount: number;
  uniqueNpcConversations: number;
};

type NpcScoreTable = Partial<Record<string, number>>;

type ObjectiveTextAffinityRule = {
  id: string;
  matches: (normalizedObjectiveText: string) => boolean;
  npcScores: NpcScoreTable;
};

const NPC_FOCUS_AFFINITY_SCORES: Partial<
  Record<ObjectiveFocus, NpcScoreTable>
> = {
  work: {
    "npc-mara": 12,
    "npc-ada": 12,
    "npc-tomas": 12,
  },
  settle: {
    "npc-mara": 16,
    "npc-ada": 12,
    "npc-nia": 12,
    "npc-tomas": 8,
    "npc-jo": 8,
  },
  help: {
    "npc-mara": 12,
    "npc-nia": 12,
    "npc-jo": 12,
  },
  tool: {
    "npc-jo": 15,
  },
};

const POINTS_TO_ADA_PATTERN =
  /(ada|kettle|tea[- ]house|counter|apron|tray|booths?|tables?|rush)/;
const POINTS_TO_TOMAS_PATTERN =
  /(tomas|north crane|crane yard|gloves|bays?)/;

const OBJECTIVE_TEXT_AFFINITY_RULES: readonly ObjectiveTextAffinityRule[] = [
  {
    id: "pump",
    matches: (normalized) => normalized.includes("pump"),
    npcScores: {
      "npc-mara": 14,
      "npc-jo": 14,
    },
  },
  {
    id: "cart",
    matches: (normalized) => normalized.includes("cart"),
    npcScores: {
      "npc-nia": 14,
    },
  },
  {
    id: "wrench",
    matches: (normalized) => normalized.includes("wrench"),
    npcScores: {
      "npc-jo": 16,
    },
  },
  {
    id: "ada-work",
    matches: (normalized) =>
      normalized.includes("work") || POINTS_TO_ADA_PATTERN.test(normalized),
    npcScores: {
      "npc-ada": 10,
    },
  },
  {
    id: "tomas-yard",
    matches: (normalized) =>
      normalized.includes("yard") || POINTS_TO_TOMAS_PATTERN.test(normalized),
    npcScores: {
      "npc-tomas": 12,
    },
  },
];

export function scoreNpcForObjectiveAffinity(
  context: NpcObjectiveAffinityContext,
) {
  const npc = context.npc;
  if (!npc) {
    return 0;
  }

  const {
    allowImmediateFollowup,
    minutesSinceConversation,
    objectiveFocus,
    playerConversationCount,
    totalNpcCount,
    uniqueNpcConversations,
  } = context;
  const normalized = context.objectiveText.toLowerCase();

  if (
    playerConversationCount > 0 &&
    minutesSinceConversation < 10 &&
    !allowImmediateFollowup
  ) {
    return -40;
  }

  let score = scoreFocusAffinity(npc.id, objectiveFocus);

  if (objectiveFocus === "people" || objectiveFocus === "explore") {
    score += npc.known ? 6 : 10;
  }

  if (playerConversationCount === 0) {
    score += 18;

    if (
      uniqueNpcConversations < totalNpcCount &&
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
    score -= allowImmediateFollowup ? 4 : 18;
  } else if (minutesSinceConversation < 60) {
    score -= 8;
  } else if (
    minutesSinceConversation >= 180 &&
    Number.isFinite(minutesSinceConversation)
  ) {
    score += 5;
  }

  score += scoreObjectiveTextAffinity(npc.id, normalized);

  return score;
}

function scoreFocusAffinity(npcId: string, objectiveFocus: ObjectiveFocus) {
  return NPC_FOCUS_AFFINITY_SCORES[objectiveFocus]?.[npcId] ?? 0;
}

function scoreObjectiveTextAffinity(
  npcId: string,
  normalizedObjectiveText: string,
) {
  let score = 0;

  for (const rule of OBJECTIVE_TEXT_AFFINITY_RULES) {
    if (rule.matches(normalizedObjectiveText)) {
      score += rule.npcScores[npcId] ?? 0;
    }
  }

  return score;
}
