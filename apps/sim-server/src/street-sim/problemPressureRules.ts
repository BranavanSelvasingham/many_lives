import {
  independentProblemResolutionNarrative,
  problemExpiryConsequenceNarrative,
  type IndependentProblemResolutionNarrative,
  type ProblemExpiryConsequenceNarrative,
} from "./problemPressureNarratives.js";
import type { NpcState, ProblemState, StreetGameState } from "./types.js";

type ProblemPressureProblemId = "problem-cart" | "problem-pump";
type ProblemPressureClock = Pick<StreetGameState["clock"], "day" | "totalMinutes">;
type ProblemPressureStatus = ProblemState["status"];
type ProblemPressureNpcLocator = (
  npcId: string,
) => Pick<NpcState, "currentLocationId" | "id"> | undefined;

export type ProblemPressureConsequenceNarrative =
  | IndependentProblemResolutionNarrative
  | ProblemExpiryConsequenceNarrative;

export type ProblemPressureEffectScope = "always" | "discovered";

export type ProblemPressureReputationAdjustment = {
  applyWhen: ProblemPressureEffectScope;
  delta: number;
  maximum: number;
  minimum: number;
  reputationId: string;
};

export type ProblemPressureNpcTrustAdjustment = {
  applyWhen: ProblemPressureEffectScope;
  delta: number;
  maximum: number;
  minimum: number;
  npcId: string;
};

export type ProblemPressureNpcMemoryRule = {
  applyWhen: ProblemPressureEffectScope;
  npcId: string;
};

export type ProblemPressureConsequenceRule = {
  npcMemories?: readonly ProblemPressureNpcMemoryRule[];
  npcTrustAdjustments?: readonly ProblemPressureNpcTrustAdjustment[];
  reputationAdjustments?: readonly ProblemPressureReputationAdjustment[];
};

export type ProblemPressureConsequenceResolution = {
  consequence: ProblemPressureConsequenceRule;
  narrative?: ProblemPressureConsequenceNarrative;
};

type ProblemPressurePassiveActivationRule = {
  atHour: number;
  fromStatus: Extract<ProblemPressureStatus, "hidden">;
  toStatus: Extract<ProblemPressureStatus, "active">;
};

type ProblemPressurePassiveExpiryRule = {
  atHour: number;
  consequence: ProblemPressureConsequenceRule;
  fromStatus: Extract<ProblemPressureStatus, "active">;
  toStatus: Extract<ProblemPressureStatus, "expired">;
};

type ProblemPressureIndependentResolutionRule = {
  atHour: number;
  consequence: ProblemPressureConsequenceRule;
  fromStatus: Extract<ProblemPressureStatus, "active">;
  minimumEscalationLevel: number;
  responsibleNpcId: string;
  responsibleNpcLocationId: string;
  toStatus: Extract<ProblemPressureStatus, "resolved">;
};

type ProblemPressureRule = {
  activation?: ProblemPressurePassiveActivationRule;
  expiry?: ProblemPressurePassiveExpiryRule;
  independentResolution?: ProblemPressureIndependentResolutionRule;
  problemId: ProblemPressureProblemId;
};

export type ProblemPressurePassiveActivation = ProblemPressurePassiveActivationRule & {
  problemId: ProblemPressureProblemId;
};

export type ProblemPressurePassiveExpiry = ProblemPressurePassiveExpiryRule &
  ProblemPressureConsequenceResolution & {
    problemId: ProblemPressureProblemId;
  };

export type ProblemPressureIndependentResolution =
  ProblemPressureIndependentResolutionRule &
    ProblemPressureConsequenceResolution & {
      problemId: ProblemPressureProblemId;
    };

const PROBLEM_PRESSURE_RULES: Record<ProblemPressureProblemId, ProblemPressureRule> = {
  "problem-cart": {
    activation: {
      atHour: 12,
      fromStatus: "hidden",
      toStatus: "active",
    },
    expiry: {
      atHour: 17,
      consequence: {
        npcMemories: [
          {
            applyWhen: "always",
            npcId: "npc-nia",
          },
        ],
        reputationAdjustments: [
          {
            applyWhen: "always",
            delta: -1,
            maximum: 10,
            minimum: 0,
            reputationId: "south_quay",
          },
        ],
      },
      fromStatus: "active",
      toStatus: "expired",
    },
    independentResolution: {
      atHour: 16.5,
      consequence: {
        npcMemories: [
          {
            applyWhen: "always",
            npcId: "npc-nia",
          },
        ],
      },
      fromStatus: "active",
      minimumEscalationLevel: 2,
      responsibleNpcId: "npc-nia",
      responsibleNpcLocationId: "market-square",
      toStatus: "resolved",
    },
    problemId: "problem-cart",
  },
  "problem-pump": {
    expiry: {
      atHour: 18,
      consequence: {
        npcMemories: [
          {
            applyWhen: "always",
            npcId: "npc-mara",
          },
        ],
        npcTrustAdjustments: [
          {
            applyWhen: "always",
            delta: -1,
            maximum: 10,
            minimum: 0,
            npcId: "npc-mara",
          },
        ],
        reputationAdjustments: [
          {
            applyWhen: "always",
            delta: -1,
            maximum: 10,
            minimum: 0,
            reputationId: "morrow_house",
          },
        ],
      },
      fromStatus: "active",
      toStatus: "expired",
    },
    independentResolution: {
      atHour: 17.5,
      consequence: {
        npcMemories: [
          {
            applyWhen: "always",
            npcId: "npc-mara",
          },
        ],
        npcTrustAdjustments: [
          {
            applyWhen: "discovered",
            delta: -1,
            maximum: 10,
            minimum: 0,
            npcId: "npc-mara",
          },
        ],
        reputationAdjustments: [
          {
            applyWhen: "discovered",
            delta: -1,
            maximum: 10,
            minimum: 0,
            reputationId: "morrow_house",
          },
        ],
      },
      fromStatus: "active",
      minimumEscalationLevel: 2,
      responsibleNpcId: "npc-mara",
      responsibleNpcLocationId: "courtyard",
      toStatus: "resolved",
    },
    problemId: "problem-pump",
  },
};

export function problemPressurePassiveActivation(
  problem: ProblemState,
  currentHour: number,
): ProblemPressurePassiveActivation | undefined {
  const rule = problemPressureRule(problem.id);
  const activation = rule?.activation;
  if (
    !rule ||
    !activation ||
    problem.status !== activation.fromStatus ||
    currentHour < activation.atHour
  ) {
    return undefined;
  }

  return {
    ...activation,
    problemId: rule.problemId,
  };
}

export function problemPressurePassiveExpiry(
  problem: ProblemState,
  currentHour: number,
): ProblemPressurePassiveExpiry | undefined {
  const rule = problemPressureRule(problem.id);
  const expiry = rule?.expiry;
  if (
    !rule ||
    !expiry ||
    problem.status !== expiry.fromStatus ||
    currentHour < expiry.atHour
  ) {
    return undefined;
  }

  return {
    ...expiry,
    narrative: problemExpiryConsequenceNarrative(rule.problemId),
    problemId: rule.problemId,
  };
}

export function problemPressureIndependentResolution({
  clock,
  findNpc,
  problem,
}: {
  clock: ProblemPressureClock;
  findNpc: ProblemPressureNpcLocator;
  problem: ProblemState;
}): ProblemPressureIndependentResolution | undefined {
  const rule = problemPressureRule(problem.id);
  const resolution = rule?.independentResolution;
  if (!rule || !resolution || problem.status !== resolution.fromStatus) {
    return undefined;
  }

  const resolutionMinute = totalMinutesForDayHour(clock.day, resolution.atHour);
  const npc = findNpc(resolution.responsibleNpcId);
  if (
    (problem.escalationLevel ?? 0) < resolution.minimumEscalationLevel ||
    clock.totalMinutes < resolutionMinute ||
    npc?.id !== resolution.responsibleNpcId ||
    npc.currentLocationId !== resolution.responsibleNpcLocationId
  ) {
    return undefined;
  }

  return {
    ...resolution,
    narrative: independentProblemResolutionNarrative(rule.problemId),
    problemId: rule.problemId,
  };
}

function problemPressureRule(problemId: string): ProblemPressureRule | undefined {
  return (
    PROBLEM_PRESSURE_RULES as Partial<Record<string, ProblemPressureRule>>
  )[problemId];
}

function totalMinutesForDayHour(day: number, hour: number): number {
  return Math.max(0, day - 1) * 24 * 60 + hour * 60;
}
