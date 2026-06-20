export type PassiveMissedJobNarrative = {
  feedText: string;
  npcMemoryText: string;
  playerMemoryText: string;
};

type IndependentNpcJobClosureNarrativeVariant = {
  npcMemoryText: string;
  playerFeedText?: string;
  playerMemoryText?: string;
};

export type IndependentNpcJobClosureNarrative =
  IndependentNpcJobClosureNarrativeVariant;

type JobNarrative = {
  independentNpcClosure?: {
    liveToRowan: IndependentNpcJobClosureNarrativeVariant;
    notLiveToRowan: IndependentNpcJobClosureNarrativeVariant;
  };
  passiveMiss?: PassiveMissedJobNarrative;
};

type JobNarrativeJobId = "job-tea-shift" | "job-yard-shift";

const JOB_NARRATIVES: Record<JobNarrativeJobId, JobNarrative> = {
  "job-tea-shift": {
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
