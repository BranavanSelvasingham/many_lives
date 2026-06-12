import type { MemoryEntry } from "./types.js";

export interface NpcNarrativeProfile {
  backstory: string;
  context: string;
  firstContactPrimer?: NpcFirstContactPrimer;
  objective: string;
  voice: string;
}

export interface NpcFirstContactPrimer {
  feed: string;
  memory: string;
}

export type NpcConversationResolutionPayload = {
  decision?: string;
  memoryKind?: MemoryEntry["kind"];
  memoryText?: string;
  npcImpression?: string;
  objectiveText?: string;
  summary?: string;
};

export type NpcConversationResolutionKey =
  | "mara-pump-needs-wrench"
  | "mara-pump-has-wrench"
  | "mara-live-tea-lead"
  | "mara-closed-lunch-yard-redirect"
  | "mara-closed-work-windows"
  | "ada-closed-lunch-yard-redirect"
  | "ada-closed-work-windows"
  | "ada-live-tea-shift"
  | "ada-live-yard-shift"
  | "jo-wrench-needed-for-pump"
  | "jo-has-wrench-for-pump"
  | "tomas-closed-yard-window"
  | "tomas-live-yard-shift"
  | "nia-live-cart-jam";

export const NPC_NARRATIVES: Record<string, NpcNarrativeProfile> = {
  "npc-mara": {
    backstory:
      "Mara runs Morrow House with a keeper's eye and a neighbor's patience. She notices who makes the house feel calmer after breakfast.",
    context:
      "New faces, shared chores, and little courtyard fixes all shape whether the house stays easy.",
    firstContactPrimer: {
      feed: "Mara gives you a measured look, like she's deciding whether you're here for a bed, for work, or just to stop feeling new.",
      memory:
        "Mara weighs newcomers by whether they settle in, pull their weight, or disappear.",
    },
    objective: "Keep Morrow House steady, safe, and pleasant to come back to.",
    voice:
      "gentle, house-minded, practical, and protective without getting heavy.",
  },
  "npc-ada": {
    backstory:
      "Ada owns Kettle & Lamp and keeps the tea room bright with clean tables, quick hands, and the sea breeze through the front door.",
    context: "Lunch is coming and she could use help before the cafe fills.",
    firstContactPrimer: {
      feed: "Ada glances over like the room is already filling, but there is still a little welcome in it.",
      memory:
        "Ada offers work when she thinks someone can keep the tea room easy through lunch.",
    },
    objective: "Keep Kettle & Lamp warm, bright, and welcoming through lunch.",
    voice:
      "quick, cafe-warm, efficient, and lightly teasing when the room allows it.",
  },
  "npc-jo": {
    backstory:
      "Jo runs Mercer Repairs and believes old tools deserve one more good afternoon if somebody treats them gently.",
    context:
      "The stall is quiet enough for dry jokes, small repairs, and one wrench waiting on the bench.",
    firstContactPrimer: {
      feed: "Jo looks up from the bench with the kind of patience that expects you to get to the point.",
      memory: "Jo prices things fairly enough that you notice.",
    },
    objective:
      "Keep honest repairs moving and make sure good tools find the right hands.",
    voice: "dry, exact, quietly amused, and allergic to fuss.",
  },
  "npc-tomas": {
    backstory:
      "Tomas foremans the freight yard with a sun-faded cap, practical habits, and a better mood when the cart lane stays clear.",
    context:
      "A short loading block is waiting, but the day is still allowed to stay pleasant.",
    firstContactPrimer: {
      feed: "Tomas glances at your shoulders, not your face, like talk only matters if it turns into labor.",
      memory:
        "Tomas thinks in loads, time windows, and whether you slow the rest of the yard down.",
    },
    objective: "Clear the yard without turning the afternoon sour.",
    voice: "direct, dry, practical, and more amused than mean.",
  },
  "npc-nia": {
    backstory:
      "Nia runs errands through South Quay by catching notices, rumors, cafe chatter, and little jams before anyone else bothers to name them.",
    context:
      "Quay Square and the pier are full of tiny details she enjoys catching first.",
    firstContactPrimer: {
      feed: "Nia watches the square while she talks to you, like she expects the next important detail to arrive mid-sentence.",
      memory:
        "Nia notices small jams before the whole block has to notice them.",
    },
    objective:
      "Stay ahead of what the block is about to notice and share good leads without making a scene.",
    voice: "breezy, quick, observant, and cheerfully nosy.",
  },
};

const NPC_CONVERSATION_RESOLUTIONS: Record<
  NpcConversationResolutionKey,
  NpcConversationResolutionPayload
> = {
  "mara-pump-needs-wrench": {
    decision: "get to Mercer Repairs for a wrench, then come back to the pump.",
    memoryKind: "problem",
    memoryText:
      "Mara made it plain that fixing the pump would make the house easier for everyone.",
    objectiveText: "Buy a wrench and fix the pump.",
  },
  "mara-pump-has-wrench": {
    decision: "go straight back to Morrow Yard and put the wrench to the pump.",
    memoryKind: "problem",
    memoryText:
      "Mara keeps turning talk back toward the shared trouble that's already making the house tense.",
    objectiveText: "Fix the pump in Morrow Yard.",
  },
  "mara-live-tea-lead": {
    decision:
      "get to Kettle & Lamp before lunch gets busy and ask Ada for work.",
    memoryKind: "job",
    memoryText:
      "Mara trusts follow-through more than worry, and Ada is the nearest honest place to start.",
    objectiveText: "Get to Kettle & Lamp and ask Ada for work.",
  },
  "mara-closed-lunch-yard-redirect": {
    decision:
      "skip the closed lunch lead and ask Tomas while the yard window is still live.",
    memoryKind: "job",
    memoryText:
      "Mara did not pretend Ada's lunch window was still alive; she pointed Rowan toward Tomas instead.",
    objectiveText: "See if Tomas still needs another set of hands in the yard.",
    summary:
      "Mara closed the stale lunch lead and redirected Rowan toward the live yard window.",
  },
  "mara-closed-work-windows": {
    decision:
      "stop chasing closed work windows and return to Morrow House to take stock.",
    memoryKind: "job",
    memoryText:
      "Mara made it clear that today's easy work windows had moved on.",
    objectiveText: "Return to Morrow House and take stock.",
    summary:
      "Mara made the closed work window explicit instead of reopening a stale route.",
  },
  "ada-closed-lunch-yard-redirect": {
    decision:
      "skip the closed lunch lead and ask Tomas while the yard window is still live.",
    memoryKind: "job",
    memoryText:
      "Ada closed the lunch option instead of holding a stale shift open, then pointed Rowan toward the yard.",
    objectiveText: "See if Tomas still needs another set of hands in the yard.",
    summary:
      "Ada closed the stale lunch lead and redirected Rowan toward the live yard window.",
  },
  "ada-closed-work-windows": {
    decision:
      "stop chasing closed work windows and return to Morrow House to take stock.",
    memoryKind: "job",
    memoryText:
      "Ada made it plain that the cup-and-counter shift was already gone for today.",
    objectiveText: "Return to Morrow House and take stock.",
    summary:
      "Ada made the closed work window explicit instead of reopening a stale route.",
  },
  "ada-live-tea-shift": {
    decision:
      "stay with Ada and take the tea-house shift if the room still needs the hands.",
    memoryKind: "job",
    memoryText:
      "Ada made the noon shift sound simple, but only if you can keep up once the room gets hot.",
    objectiveText: "Take the cup-and-counter shift at Kettle & Lamp.",
  },
  "ada-live-yard-shift": {
    decision:
      "head to North Crane Yard and see if Tomas still needs another set of hands.",
    memoryKind: "job",
    memoryText:
      "Ada sent you onward because she thinks you might hold up outside her room too.",
    objectiveText: "See if Tomas still needs another set of hands in the yard.",
  },
  "jo-wrench-needed-for-pump": {
    decision:
      "decide whether Jo's wrench is worth the eight coins, then take it where it matters.",
    memoryKind: "self",
    memoryText:
      "Jo made the wrench feel less like a purchase and more like a decision about whether you'll actually use it.",
    objectiveText: "Buy a wrench and fix the pump.",
  },
  "jo-has-wrench-for-pump": {
    decision:
      "leave the stall and go use the wrench before the pump gets worse.",
    memoryKind: "problem",
    memoryText:
      "Jo made the repair feel plain: take the tool back and use it before the leak gets worse.",
    objectiveText: "Fix the pump in Morrow Yard.",
  },
  "tomas-closed-yard-window": {
    decision:
      "stop chasing closed work windows and return to Morrow House to take stock.",
    memoryKind: "job",
    memoryText:
      "Tomas did not reopen the loading block after the yard had already moved without Rowan.",
    objectiveText: "Return to Morrow House and take stock.",
    summary:
      "Tomas made the closed work window explicit instead of reopening a stale route.",
  },
  "tomas-live-yard-shift": {
    decision:
      "stay near the yard and take the loading shift if the pay and timing still work.",
    memoryKind: "job",
    memoryText:
      "Tomas was clear about the work: keep the lane open, move the crates, and finish on time.",
    objectiveText: "Take the freight yard lift before the window closes.",
  },
  "nia-live-cart-jam": {
    decision:
      "swing through Quay Square and clear the cart before the foot traffic swells.",
    memoryKind: "problem",
    memoryText:
      "Nia keeps seeing the small jams that become the whole block's problem if nobody moves first.",
    objectiveText: "Clear the jammed cart in Quay Square.",
  },
};

const NEXT_NPC_OBJECTIVE_TEXT: Record<string, string> = {
  "npc-mara": "Ask Mara how to keep my room at Morrow House feeling settled.",
  "npc-ada": "Ask Ada if Kettle & Lamp needs steady hands today.",
  "npc-jo": "Find out what tool or repair Jo says matters before I spend coin.",
  "npc-tomas":
    "See if Tomas still needs another set of hands at North Crane Yard.",
  "npc-nia":
    "Ask Nia where the block is about to jam before the square feels it.",
};

const NPC_CONVERSATION_IMPRESSIONS: Record<string, string> = {
  "npc-ada": "Rowan might keep pace when the cafe fills up.",
  "npc-jo": "Rowan listened for the practical part instead of the shine.",
  "npc-tomas": "Rowan asked about the work clearly and stayed practical.",
  "npc-nia": "Rowan paid attention to where the block might jam up.",
};

const DEFAULT_NPC_NARRATIVE: NpcNarrativeProfile = {
  backstory:
    "This person has a place in South Quay, even if Rowan does not know it yet.",
  context: "They are watching the square for the next small opening.",
  objective: "Keep the day pleasant and moving.",
  voice: "casual, practical, and local.",
};

export function getNpcNarrative(npcId: string): NpcNarrativeProfile {
  return NPC_NARRATIVES[npcId] ?? DEFAULT_NPC_NARRATIVE;
}

export function getNpcFirstContactPrimer(
  npcId: string,
): NpcFirstContactPrimer | undefined {
  return NPC_NARRATIVES[npcId]?.firstContactPrimer;
}

export function buildNpcConversationResolution(
  key: NpcConversationResolutionKey,
  options: {
    shouldSharpenObjective: boolean;
  },
): NpcConversationResolutionPayload {
  return sharpenedResolution(
    NPC_CONVERSATION_RESOLUTIONS[key],
    options.shouldSharpenObjective,
  );
}

export function buildGenericClosedWorkWindowConversationResolution(options: {
  npcName: string;
  shouldSharpenObjective: boolean;
}): NpcConversationResolutionPayload {
  return {
    decision:
      "stop chasing closed work windows and return to Morrow House to take stock.",
    memoryKind: "job",
    memoryText:
      "The block did not keep paid work windows open just because Rowan asked late.",
    objectiveText: options.shouldSharpenObjective
      ? "Return to Morrow House and take stock."
      : undefined,
    summary: `${options.npcName} made the closed work window explicit instead of reopening a stale route.`,
  };
}

export function buildSocialNextNpcConversationResolution(options: {
  currentNpcName: string;
  nextNpcId: string;
  nextNpcName: string;
  shouldSharpenObjective: boolean;
  socialLoopObjective: boolean;
}): NpcConversationResolutionPayload {
  if (options.socialLoopObjective) {
    return {
      decision: `talk to ${options.nextNpcName} next.`,
      memoryKind: "person",
      memoryText: `${options.currentNpcName} gave the block a clearer shape and pointed you toward the next person.`,
      objectiveText: `Talk to ${options.nextNpcName} next.`,
    };
  }

  return {
    decision: `talk to ${options.nextNpcName} next while there is still time.`,
    memoryKind: "person",
    memoryText: `${options.currentNpcName} pointed Rowan toward the next person to talk to.`,
    objectiveText: options.shouldSharpenObjective
      ? NEXT_NPC_OBJECTIVE_TEXT[options.nextNpcId]
      : undefined,
  };
}

export function buildNpcConversationImpression(options: {
  npcId: string;
  nextMove: string;
  objectiveText: string;
}): string {
  if (options.npcId === "npc-mara") {
    return `Rowan sounded willing to ${objectiveClause(options.nextMove)}.`;
  }

  return (
    NPC_CONVERSATION_IMPRESSIONS[options.npcId] ??
    `Rowan stayed direct about wanting to ${objectiveClause(options.nextMove)}.`
  );
}

function sharpenedResolution(
  resolution: NpcConversationResolutionPayload,
  shouldSharpenObjective: boolean,
): NpcConversationResolutionPayload {
  if (shouldSharpenObjective) {
    return { ...resolution };
  }

  return {
    ...resolution,
    objectiveText: undefined,
  };
}

function objectiveClause(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "stay open to whatever the block puts in front of you";
  }

  const normalized = `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;

  return /[.!?]$/.test(normalized) ? normalized.slice(0, -1) : normalized;
}
