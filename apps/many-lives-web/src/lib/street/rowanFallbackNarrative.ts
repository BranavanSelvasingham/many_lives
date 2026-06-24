import type { MemoryThread } from "./journalModel";
import type { StreetGameState } from "./types";

export type RowanNotebookNarrativeModel = {
  belief: string;
  clue: string;
  confidence: string;
  plan: string;
  title: string;
  uncertainty: string;
};

export type FirstAfternoonFieldNoteKey = "mara-ada-lead" | "first-afternoon";

export const FIRST_AFTERNOON_OPENING_WATCH_COPY =
  "Rowan is stepping inside Morrow House to ask Mara.";

export const FIRST_AFTERNOON_OPENING_MANUAL_COPY =
  "Enter Morrow House and ask Mara.";

const FIRST_AFTERNOON_MARA_LEAD_WATCH_COPY =
  "Rowan is turning Mara's lead toward Kettle & Lamp.";

const FIRST_AFTERNOON_ACTIVE_CONVERSATION_COPY = {
  "npc-ada": {
    autoplay: "Let Ada answer whether the lunch shift is real.",
    manual: "Let Ada's answer land.",
  },
  "npc-mara": {
    autoplay: "Let Mara's lead about Ada and Kettle & Lamp land.",
    manual: "Let Mara's lead land.",
  },
} as const;

const FIRST_AFTERNOON_FIELD_NOTE_TITLES: Record<
  FirstAfternoonFieldNoteKey,
  string
> = {
  "first-afternoon": "First afternoon settled",
  "mara-ada-lead": "Mara's lead verified",
};

const FIRST_AFTERNOON_COMPLETION_CONTINUE_FALLBACK_COPY =
  "Close the field note, then weigh rest, the yard window, and the Morrow Yard pump.";

const FIRST_AFTERNOON_COMPLETION_WATCH_STATUS_FALLBACK_COPY =
  "Rowan is weighing the field note, then continuing automatically.";

function narrativeCopy(value?: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function firstPresentNarrativeCopy(
  ...values: Array<string | null | undefined>
) {
  for (const value of values) {
    const copy = narrativeCopy(value);
    if (copy) {
      return copy;
    }
  }

  return null;
}

function rowanObjectiveNextCopy(game: StreetGameState) {
  return firstPresentNarrativeCopy(
    game.player.objective?.outcomes.find((outcome) => outcome.status !== "met")
      ?.label,
    game.player.objective?.progress?.label,
    game.player.objective?.text,
  );
}

function rowanAutonomyNextCopy(game: StreetGameState) {
  const autonomy = game.rowanAutonomy;
  return firstPresentNarrativeCopy(
    autonomy.intent?.reason,
    autonomy.detail !== autonomy.label ? autonomy.detail : null,
    autonomy.label,
  );
}

function rowanCognitionNextCopy(game: StreetGameState) {
  return firstPresentNarrativeCopy(
    game.rowanCognition?.notebook?.plan,
    game.rowanCognition?.nextMove?.text,
    game.rowanCognition?.nextMove?.rationale,
    game.rowanCognition?.notebook?.uncertainty,
  );
}

function firstAfternoonCompletionAuthorityCopy(game: StreetGameState) {
  return firstPresentNarrativeCopy(
    game.firstAfternoon?.fieldNote?.next,
    rowanCognitionNextCopy(game),
    rowanAutonomyNextCopy(game),
    rowanObjectiveNextCopy(game),
  );
}

export function buildFirstAfternoonOpeningMapAgencyDetail(
  firstAfternoonOpening: boolean,
) {
  return firstAfternoonOpening ? FIRST_AFTERNOON_OPENING_WATCH_COPY : null;
}

export function buildFirstAfternoonOpeningWatchContinueCopy(
  firstAfternoonOpening: boolean,
) {
  return firstAfternoonOpening ? FIRST_AFTERNOON_OPENING_WATCH_COPY : null;
}

export function buildFirstAfternoonOpeningManualContinueCopy(
  firstAfternoonOpening: boolean,
) {
  return firstAfternoonOpening ? FIRST_AFTERNOON_OPENING_MANUAL_COPY : null;
}

export function buildMaraLeadWatchContinueCopy({
  label,
}: {
  label: string;
}) {
  if (/kettle|cafe|ada/i.test(label)) {
    return FIRST_AFTERNOON_MARA_LEAD_WATCH_COPY;
  }

  return null;
}

export function buildFirstAfternoonActiveConversationContinueCopy({
  npcId,
  rowanAutoplayEnabled,
}: {
  npcId?: string;
  rowanAutoplayEnabled: boolean;
}) {
  if (
    npcId !== "npc-mara" &&
    npcId !== "npc-ada"
  ) {
    return null;
  }

  const copy = FIRST_AFTERNOON_ACTIVE_CONVERSATION_COPY[npcId];
  return rowanAutoplayEnabled ? copy.autoplay : copy.manual;
}

export function firstAfternoonFieldNoteTitle(
  key: FirstAfternoonFieldNoteKey,
) {
  return FIRST_AFTERNOON_FIELD_NOTE_TITLES[key];
}

export function firstAfternoonMaraAdaLeadFieldNoteNextCopy(
  game: StreetGameState,
  fallback: string,
) {
  const serverLeadNext = narrativeCopy(game.firstAfternoon?.leadFieldNote?.next);
  if (serverLeadNext) {
    return serverLeadNext;
  }

  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const stage = game.firstAfternoon?.teaShiftStage;
  if (game.firstAfternoon?.completedAt || game.firstAfternoon?.fieldNote) {
    return "The first afternoon is settled; rest at Morrow House, then weigh the yard work window against the Morrow Yard pump.";
  }

  if (teaJob?.completed || stage === "paid") {
    return "The shift paid. Return to Morrow House and take stock before the day scatters into another thread.";
  }

  if (stage === "counter") {
    return "Finish the counter pass, collect the pay, then let the work become a real field note.";
  }

  if (stage === "rush") {
    return "Keep the lunch rush moving: clear cups, watch the counter, and stay useful until Ada can pay.";
  }

  if (teaJob?.accepted || game.player.activeJobId === "job-tea-shift") {
    return "The shift is booked. Stay near Kettle & Lamp until lunch starts, then prove the lead with work.";
  }

  if (teaJob?.discovered) {
    return "Ada's offer is live: take the cup-and-counter shift, compare another real pressure, or deliberately walk away.";
  }

  return fallback;
}

export function buildFirstAfternoonCompletionContinueCopy(
  game: StreetGameState,
) {
  return (
    firstAfternoonCompletionAuthorityCopy(game) ??
    FIRST_AFTERNOON_COMPLETION_CONTINUE_FALLBACK_COPY
  );
}

export function buildFirstAfternoonCompletionWatchStatusCopy(
  game: StreetGameState,
) {
  return (
    firstAfternoonCompletionAuthorityCopy(game) ??
    FIRST_AFTERNOON_COMPLETION_WATCH_STATUS_FALLBACK_COPY
  );
}

export function buildRowanFallbackNotebookModel({
  game,
  primaryPerson,
  primaryPlace,
  primaryThread,
}: {
  game: StreetGameState;
  primaryPerson?: StreetGameState["npcs"][number];
  primaryPlace?: StreetGameState["locations"][number];
  primaryThread?: MemoryThread;
}): RowanNotebookNarrativeModel {
  if (game.rowanCognition?.notebook) {
    return {
      belief: game.rowanCognition.notebook.belief,
      clue: game.rowanCognition.notebook.clue,
      confidence: game.rowanCognition.notebook.confidence,
      plan: game.rowanCognition.notebook.plan,
      title: game.rowanCognition.notebook.title,
      uncertainty: game.rowanCognition.notebook.uncertainty,
    };
  }

  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const currentPlanHint =
    game.rowanAutonomy?.label ??
    game.player.objective?.outcomes.find((outcome) => outcome.status !== "met")
      ?.label;
  const completed = Boolean(game.firstAfternoon?.completedAt);
  const activeJob = game.player.activeJobId
    ? game.jobs.find((job) => job.id === game.player.activeJobId)
    : undefined;

  if (completed) {
    return {
      belief:
        "Tonight's bed holds, Ada has seen Rowan keep up, and the Morrow Yard pump is now a real local problem.",
      clue:
        game.firstAfternoon?.fieldNote?.memory ??
        "Kettle & Lamp now has a memory of Rowan following through.",
      confidence: "Earned.",
      plan:
        currentPlanHint ??
        "Rest at Morrow House, then weigh the yard work window against the Morrow Yard pump.",
      title: "A foothold, finally",
      uncertainty:
        "Whether the next useful move is paid yard work, the pump, or another current opening that changed while Rowan worked.",
    };
  }

  if (teaJob?.completed) {
    return {
      belief:
        "The lunch shift paid, and Ada has enough evidence to treat Rowan as useful.",
      clue: "Morrow House is still the safe place to return to before the day closes.",
      confidence: "Confirmed by work.",
      plan: currentPlanHint ?? "Head back to Morrow House and take stock.",
      title: "Paid work in the pocket",
      uncertainty:
        "What the earned money changes about tonight, and what Rowan should carry into tomorrow.",
    };
  }

  if (activeJob?.id === "job-tea-shift" || teaJob?.accepted) {
    return {
      belief:
        "Ada gave Rowan a real chance at lunch work, and the only proof that matters is keeping up.",
      clue: "Ada trusts steady hands more than big promises.",
      confidence: "Committed.",
      plan: currentPlanHint ?? "Keep Kettle & Lamp moving through lunch.",
      title: "In the rush now",
      uncertainty:
        "Whether Rowan can stay steady when the room gets hot and crowded.",
    };
  }

  if (game.firstAfternoon?.leadFieldNote) {
    return {
      belief:
        "Mara's lead is verified: Ada at Kettle & Lamp has real lunch work on the table.",
      clue: game.firstAfternoon.leadFieldNote.memory,
      confidence: "Confirmed by asking Ada directly.",
      plan:
        currentPlanHint ?? "Choose whether to take the cup-and-counter shift.",
      title: "Lead verified",
      uncertainty:
        "Whether Rowan should take the shift now, check another lead, return later, or keep exploring.",
    };
  }

  if (teaJob?.discovered || game.firstAfternoon?.planSettledAt) {
    return {
      belief:
        "Mara's lead points to Ada at Kettle & Lamp; lunch work is the best first bet.",
      clue:
        primaryPerson?.id === "npc-mara"
          ? "Mara says follow-through matters more than worry."
          : "Morrow House is safe to return to if Rowan brings back something real.",
      confidence: teaJob?.discovered ? "Confirmed lead." : "Unconfirmed.",
      plan: currentPlanHint ?? "Walk to Kettle & Lamp and ask Ada directly.",
      title: "A useful lead",
      uncertainty: "Does Ada actually need help today?",
    };
  }

  return {
    belief:
      primaryPlace?.id === "boarding-house"
        ? "Morrow House is tonight's foothold, but it is not yet something Rowan has earned."
        : "South Quay is still mostly unknown, and Rowan needs one reliable person to ask.",
    clue:
      primaryThread?.detail ??
      "The room at Morrow House is safe for tonight, but not a future by itself.",
    confidence: "Unconfirmed.",
    plan: currentPlanHint ?? "Ask the first useful question.",
    title: "First page of the morning",
    uncertainty: "Who can turn tonight's room into tomorrow's foothold?",
  };
}
