export type PassiveMissedJobNarrative = {
  feedText: string;
  npcMemoryText: string;
  playerMemoryText: string;
};

type ActiveJobMemoryKind = "job" | "person";

export type ActiveJobStageNarrative = {
  feedText: string;
  memory?: {
    kind: ActiveJobMemoryKind;
    text: string;
  };
};

type ActiveJobCompletionNarrativeTemplate = {
  currentThought?: string;
  feedText: string;
  memoryText: string;
};

export type ActiveJobCompletionNarrative = {
  currentThought?: string;
  feedText: string;
  memoryText: string;
};

export type ActiveJobInterruptionNarrative = {
  feedText: string;
  memoryText: string;
};

export type YardWorkPumpConsequenceNarrative = {
  feedText: string;
  memoryText: string;
};

type IndependentNpcJobClosureNarrativeVariant = {
  npcMemoryText: string;
  playerFeedText?: string;
  playerMemoryText?: string;
};

export type IndependentNpcJobClosureNarrative =
  IndependentNpcJobClosureNarrativeVariant;

type JobNarrative = {
  activeWork?: {
    completion?: ActiveJobCompletionNarrativeTemplate;
    stages?: Record<string, ActiveJobStageNarrative>;
    yardWorkPumpConsequence?: YardWorkPumpConsequenceNarrative;
  };
  independentNpcClosure?: {
    liveToRowan: IndependentNpcJobClosureNarrativeVariant;
    notLiveToRowan: IndependentNpcJobClosureNarrativeVariant;
  };
  passiveMiss?: PassiveMissedJobNarrative;
};

type JobNarrativeJobId = "job-tea-shift" | "job-yard-shift";

type ActiveJobNarrativeFacts = {
  jobTitle: string;
  pay: number;
};

const GENERIC_ACTIVE_JOB_INTERRUPTION: ActiveJobCompletionNarrativeTemplate = {
  feedText:
    "Rowan kept {jobTitle} moving until the city changed around him; the work is still in hand.",
  memoryText:
    "Rowan started {jobTitle} before the window closed and still needs to finish it.",
};

const GENERIC_ACTIVE_JOB_COMPLETION: ActiveJobCompletionNarrativeTemplate = {
  feedText:
    "You finished {jobTitle} and earned ${pay}. The yard will remember you as someone who stayed until the load was done.",
  memoryText:
    "You finished {jobTitle} and took your pay while the block was still moving.",
};

const JOB_NARRATIVES: Record<JobNarrativeJobId, JobNarrative> = {
  "job-tea-shift": {
    activeWork: {
      completion: {
        currentThought:
          "That was tiring, but it turned an afternoon into proof. I should go back to Morrow House and let it land.",
        feedText:
          "Rowan finishes {jobTitle} and earns ${pay}. Ada says the room stayed easier because he kept up.",
        memoryText:
          "You finished {jobTitle} and took your pay while the block was still moving.",
      },
      stages: {
        counter: {
          feedText:
            "The rush crests. Rowan keeps the counter moving, catches a tray before it tips, and Ada gives one small nod that counts.",
          memory: {
            kind: "person",
            text: "Ada trusts steady hands more than big promises.",
          },
        },
        rush: {
          feedText:
            "Lunch starts to fill Kettle & Lamp. Rowan clears cups, wipes tables, and learns where Ada points before she has to say it twice.",
          memory: {
            kind: "job",
            text: "Rowan started the lunch rush at Kettle & Lamp by keeping the small things moving.",
          },
        },
      },
    },
    passiveMiss: {
      feedText:
        "Ada's lunch window moved on without Rowan; the room learned to solve the rush without him.",
      npcMemoryText:
        "Rowan let the lunch rush move on without committing steady hands.",
      playerMemoryText:
        "You missed Ada's lunch window, so that paid foothold is no longer waiting.",
    },
  },
  "job-yard-shift": {
    activeWork: {
      completion: {
        currentThought:
          "The yard paid, and now I need to look at what the house had to handle while I was here.",
        feedText:
          "You finished {jobTitle} and earned ${pay}. The yard will remember you as someone who stayed until the load was done.",
        memoryText:
          "You finished {jobTitle} and took your pay while the block was still moving.",
      },
      yardWorkPumpConsequence: {
        feedText:
          "Choosing the freight-yard lift paid Rowan, but it left the Morrow Yard pump for Mara to contain without him.",
        memoryText:
          "Rowan chose paid yard work while the pump was still live, so Mara contained the house strain herself.",
      },
    },
    independentNpcClosure: {
      liveToRowan: {
        npcMemoryText:
          "Tomas closed the loading block with his own crew after Rowan left the yard waiting.",
        playerFeedText:
          "Tomas got the North Crane Yard load out with his own crew; Rowan gets no pay or credit from that work.",
        playerMemoryText:
          "Tomas did not hold the freight yard load for Rowan; the work moved without him and closed that window.",
      },
      notLiveToRowan: {
        npcMemoryText:
          "Tomas closed the loading block with his own crew before Rowan ever came asking.",
      },
    },
    passiveMiss: {
      feedText:
        "North Crane Yard finished its loading block without Rowan, and Tomas has less reason to hold space for him next time.",
      npcMemoryText:
        "Rowan missed the loading block after the yard had already made room for him.",
      playerMemoryText:
        "You missed the freight yard loading block, closing that work window for the day.",
    },
  },
};

function jobNarrative(jobId: string): JobNarrative | undefined {
  return (JOB_NARRATIVES as Partial<Record<string, JobNarrative>>)[jobId];
}

function renderActiveJobNarrative(
  template: ActiveJobCompletionNarrativeTemplate,
  facts: ActiveJobNarrativeFacts,
): ActiveJobCompletionNarrative {
  const render = (text: string) =>
    text
      .split("{jobTitle}")
      .join(facts.jobTitle.toLowerCase())
      .split("{pay}")
      .join(String(facts.pay));

  return {
    currentThought: template.currentThought
      ? render(template.currentThought)
      : undefined,
    feedText: render(template.feedText),
    memoryText: render(template.memoryText),
  };
}

export function activeJobStageNarrative(
  jobId: string,
  options: { stage: string | undefined },
): ActiveJobStageNarrative | undefined {
  if (!options.stage) {
    return undefined;
  }

  return jobNarrative(jobId)?.activeWork?.stages?.[options.stage];
}

export function activeJobInterruptionNarrative(
  _jobId: string,
  facts: ActiveJobNarrativeFacts,
): ActiveJobInterruptionNarrative {
  return renderActiveJobNarrative(GENERIC_ACTIVE_JOB_INTERRUPTION, facts);
}

export function activeJobCompletionNarrative(
  jobId: string,
  facts: ActiveJobNarrativeFacts,
): ActiveJobCompletionNarrative {
  return renderActiveJobNarrative(
    jobNarrative(jobId)?.activeWork?.completion ?? GENERIC_ACTIVE_JOB_COMPLETION,
    facts,
  );
}

export function yardWorkPumpConsequenceNarrative(
  jobId: string,
): YardWorkPumpConsequenceNarrative | undefined {
  return jobNarrative(jobId)?.activeWork?.yardWorkPumpConsequence;
}

export function passiveMissedJobNarrative(
  jobId: string,
): PassiveMissedJobNarrative | undefined {
  return jobNarrative(jobId)?.passiveMiss;
}

export function independentNpcJobClosureNarrative(
  jobId: string,
  options: { wasLiveToRowan: boolean },
): IndependentNpcJobClosureNarrative | undefined {
  const narrative = jobNarrative(jobId)?.independentNpcClosure;
  if (!narrative) {
    return undefined;
  }

  return options.wasLiveToRowan
    ? narrative.liveToRowan
    : narrative.notLiveToRowan;
}
