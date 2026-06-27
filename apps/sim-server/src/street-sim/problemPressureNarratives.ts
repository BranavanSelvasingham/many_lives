export type ProblemEscalationStage = {
  atMinute: number;
  feedText: string;
  level: number;
  memoryText: string;
  urgency: number;
};

export type ProblemExpiryConsequenceNarrative = {
  discoveredFeedText: string;
  discoveredMemoryText: string;
  npcMemoryText: string;
};

export type IndependentProblemResolutionNarrative = {
  discoveredFeedText: string;
  discoveredMemoryText: string;
  npcMemoryText: string;
};

export type ActiveProblemInspectNarrative = {
  feedText: string;
};

type ActiveProblemSolveNarrativeTemplate = {
  feedText: string;
  memoryText: string;
};

export type ActiveProblemSolveNarrative = ActiveProblemSolveNarrativeTemplate;

type ProblemPressureNarrative = {
  activeAction?: {
    inspect?: ActiveProblemInspectNarrative;
    solve?: ActiveProblemSolveNarrativeTemplate;
  };
  escalationStages: ProblemEscalationStage[];
  expiry: ProblemExpiryConsequenceNarrative;
  independentResolution: IndependentProblemResolutionNarrative;
};

type ProblemPressureProblemId = "problem-cart" | "problem-pump";

type ActiveProblemNarrativeFacts = {
  rewardMoney: number;
};

const PROBLEM_PRESSURE_NARRATIVES: Record<
  ProblemPressureProblemId,
  ProblemPressureNarrative
> = {
  "problem-cart": {
    activeAction: {
      inspect: {
        feedText:
          "The split wheel on the handcart is already starting to jam foot traffic through the square.",
      },
      solve: {
        feedText:
          "You got the jammed handcart rolling again and the square paid you ${rewardMoney} to stop being in everybody's way.",
        memoryText:
          "You learned that even small street problems become reputation if you solve them before they spread.",
      },
    },
    escalationStages: [
      {
        atMinute: 14 * 60,
        feedText:
          "The jammed cart has started pinching the square instead of waiting politely at the edge.",
        level: 1,
        memoryText:
          "Quay Square's cart problem grew sharper while Rowan spent the hour elsewhere.",
        urgency: 4,
      },
      {
        atMinute: 16 * 60,
        feedText:
          "By late afternoon the cart jam is no longer a small nuisance; everyone crossing the square has to work around it.",
        level: 2,
        memoryText:
          "The square remembered that nobody moved on the cart before it became public friction.",
        urgency: 5,
      },
    ],
    expiry: {
      discoveredFeedText:
        "The handcart jam hardened into a square-wide nuisance before Rowan moved on it.",
      discoveredMemoryText:
        "The square remembered that the cart problem was left until it slowed everybody down.",
      npcMemoryText:
        "The square had to route itself around the jammed cart after nobody cleared it in time.",
    },
    independentResolution: {
      discoveredFeedText:
        "Nia got the jammed handcart rolling while Rowan was elsewhere; the square solved that one without him.",
      discoveredMemoryText:
        "The jammed cart did not wait for Rowan. Nia cleared it once the square pressure peaked.",
      npcMemoryText:
        "Nia cleared the handcart after the square got tired of bending around it.",
    },
  },
  "problem-pump": {
    activeAction: {
      inspect: {
        feedText:
          "Up close, the pump in Morrow Yard is one wrench-turn away from either a fix or a worse leak.",
      },
      solve: {
        feedText:
          "You tightened the pump in Morrow Yard, slowed the leak, and Mara pressed ${rewardMoney} into your hand before the stones flooded again.",
        memoryText:
          "Morrow House started to remember you as someone who fixes shared trouble instead of adding to it.",
      },
    },
    escalationStages: [
      {
        atMinute: 13 * 60,
        feedText:
          "The Morrow Yard pump has started spreading water across the stones while Rowan is elsewhere.",
        level: 1,
        memoryText:
          "The pump did not wait for Rowan's route; by early afternoon it had become harder to ignore.",
        urgency: 4,
      },
      {
        atMinute: 15 * 60,
        feedText:
          "The pump leak is turning house trouble into a shared headache before evening.",
        level: 2,
        memoryText:
          "Morrow House's pump problem kept worsening on its own while the day moved forward.",
        urgency: 5,
      },
    ],
    expiry: {
      discoveredFeedText:
        "By evening the Morrow Yard pump stopped being a small fix and became house strain Rowan has to live with.",
      discoveredMemoryText:
        "Ignoring the pump cost Rowan standing at Morrow House.",
      npcMemoryText:
        "The Morrow Yard pump was left until evening and turned into house strain.",
    },
    independentResolution: {
      discoveredFeedText:
        "Mara got the pump contained before evening, but Morrow House had to solve that strain without Rowan.",
      discoveredMemoryText:
        "The pump did not wait for Rowan's route. Mara contained it herself, and the house noticed.",
      npcMemoryText:
        "Mara contained the pump herself after the house waited as long as it could.",
    },
  },
};

function problemPressureNarrative(
  problemId: string,
): ProblemPressureNarrative | undefined {
  return (
    PROBLEM_PRESSURE_NARRATIVES as Partial<
      Record<string, ProblemPressureNarrative>
    >
  )[problemId];
}

function renderActiveProblemSolveNarrative(
  template: ActiveProblemSolveNarrativeTemplate,
  facts: ActiveProblemNarrativeFacts,
): ActiveProblemSolveNarrative {
  const render = (text: string) =>
    text.split("{rewardMoney}").join(String(facts.rewardMoney));

  return {
    feedText: render(template.feedText),
    memoryText: render(template.memoryText),
  };
}

export function activeProblemInspectNarrative(
  problemId: string,
): ActiveProblemInspectNarrative | undefined {
  return problemPressureNarrative(problemId)?.activeAction?.inspect;
}

export function activeProblemSolveNarrative(
  problemId: string,
  facts: ActiveProblemNarrativeFacts,
): ActiveProblemSolveNarrative | undefined {
  const narrative = problemPressureNarrative(problemId)?.activeAction?.solve;
  return narrative
    ? renderActiveProblemSolveNarrative(narrative, facts)
    : undefined;
}

export function problemEscalationStages(
  problemId: string,
): readonly ProblemEscalationStage[] {
  return problemPressureNarrative(problemId)?.escalationStages ?? [];
}

export function problemExpiryConsequenceNarrative(
  problemId: string,
): ProblemExpiryConsequenceNarrative | undefined {
  return problemPressureNarrative(problemId)?.expiry;
}

export function independentProblemResolutionNarrative(
  problemId: string,
): IndependentProblemResolutionNarrative | undefined {
  return problemPressureNarrative(problemId)?.independentResolution;
}
