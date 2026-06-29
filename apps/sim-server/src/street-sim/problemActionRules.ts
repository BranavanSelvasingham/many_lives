import {
  activeProblemInspectNarrative,
  activeProblemSolveNarrative,
  type ActiveProblemInspectNarrative,
  type ActiveProblemSolveNarrative,
} from "./problemPressureNarratives.js";
import type { ProblemState } from "./types.js";

type ActiveProblemActionProblemId = "problem-cart" | "problem-pump";
type ActiveProblemStatus = ProblemState["status"];

export type ActiveProblemEnergyAdjustment = {
  delta: number;
  maximum: number;
  minimum: number;
};

export type ActiveProblemMoneyRewardRule = {
  source: "problemRewardMoney";
};

export type ActiveProblemReputationAdjustment = {
  delta: number;
  reputationId: string;
};

type ActiveProblemSolveRule = {
  durationMinutes: number;
  energy: ActiveProblemEnergyAdjustment;
  fromStatus: Extract<ActiveProblemStatus, "active">;
  moneyReward: ActiveProblemMoneyRewardRule;
  problemId: ActiveProblemActionProblemId;
  reputation: ActiveProblemReputationAdjustment;
  toStatus: Extract<ActiveProblemStatus, "solved">;
};

type ActiveProblemInspectRule = {
  discoverProblemId: ActiveProblemActionProblemId;
  problemId: ActiveProblemActionProblemId;
};

type ActiveProblemActionRule = {
  inspect: ActiveProblemInspectRule;
  solve: ActiveProblemSolveRule;
};

export type ActiveProblemSolveAction = Omit<
  ActiveProblemSolveRule,
  "moneyReward"
> & {
  moneyReward: number;
  narrative?: ActiveProblemSolveNarrative;
};

export type ActiveProblemInspectAction = ActiveProblemInspectRule & {
  narrative?: ActiveProblemInspectNarrative;
};

const PROBLEM_ACTION_RULES: Record<
  ActiveProblemActionProblemId,
  ActiveProblemActionRule
> = {
  "problem-cart": {
    inspect: {
      discoverProblemId: "problem-cart",
      problemId: "problem-cart",
    },
    solve: {
      durationMinutes: 30,
      energy: {
        delta: -8,
        maximum: 100,
        minimum: 12,
      },
      fromStatus: "active",
      moneyReward: {
        source: "problemRewardMoney",
      },
      problemId: "problem-cart",
      reputation: {
        delta: 1,
        reputationId: "south_quay",
      },
      toStatus: "solved",
    },
  },
  "problem-pump": {
    inspect: {
      discoverProblemId: "problem-pump",
      problemId: "problem-pump",
    },
    solve: {
      durationMinutes: 60,
      energy: {
        delta: -10,
        maximum: 100,
        minimum: 12,
      },
      fromStatus: "active",
      moneyReward: {
        source: "problemRewardMoney",
      },
      problemId: "problem-pump",
      reputation: {
        delta: 1,
        reputationId: "morrow_house",
      },
      toStatus: "solved",
    },
  },
};

export function activeProblemInspectAction(
  targetId: string,
): ActiveProblemInspectAction | undefined {
  const rule = problemActionRule(targetId)?.inspect;
  return rule
    ? {
        ...rule,
        narrative: activeProblemInspectNarrative(rule.problemId),
      }
    : undefined;
}

export function activeProblemSolveAction(
  problem: ProblemState,
): ActiveProblemSolveAction | undefined {
  const rule = problemActionRule(problem.id)?.solve;
  if (!rule || problem.status !== rule.fromStatus) {
    return undefined;
  }

  return {
    ...rule,
    moneyReward: problem.rewardMoney,
    narrative: activeProblemSolveNarrative(rule.problemId, {
      rewardMoney: problem.rewardMoney,
    }),
  };
}

function problemActionRule(
  problemId: string,
): ActiveProblemActionRule | undefined {
  return (
    PROBLEM_ACTION_RULES as Partial<Record<string, ActiveProblemActionRule>>
  )[problemId];
}
