export interface NpcNarrativeProfile {
  backstory: string;
  context: string;
  objective: string;
  voice: string;
}

export const NPC_NARRATIVES: Record<string, NpcNarrativeProfile> = {
  "npc-mara": {
    backstory:
      "Mara runs Morrow House with a keeper's eye and a neighbor's patience. She notices who makes the house feel calmer after breakfast.",
    context:
      "New faces, shared chores, and little courtyard fixes all shape whether the house stays easy.",
    objective: "Keep Morrow House steady, safe, and pleasant to come back to.",
    voice: "gentle, house-minded, practical, and protective without getting heavy.",
  },
  "npc-ada": {
    backstory:
      "Ada owns Kettle & Lamp and keeps the tea room bright with clean tables, quick hands, and the sea breeze through the front door.",
    context:
      "Lunch is coming and she could use help before the cafe fills.",
    objective: "Keep Kettle & Lamp warm, bright, and welcoming through lunch.",
    voice: "quick, cafe-warm, efficient, and lightly teasing when the room allows it.",
  },
  "npc-jo": {
    backstory:
      "Jo runs Mercer Repairs and believes old tools deserve one more good afternoon if somebody treats them gently.",
    context:
      "The stall is quiet enough for dry jokes, small repairs, and one wrench waiting on the bench.",
    objective: "Keep honest repairs moving and make sure good tools find the right hands.",
    voice: "dry, exact, quietly amused, and allergic to fuss.",
  },
  "npc-tomas": {
    backstory:
      "Tomas foremans the freight yard with a sun-faded cap, practical habits, and a better mood when the cart lane stays clear.",
    context:
      "A short loading block is waiting, but the day is still allowed to stay pleasant.",
    objective: "Clear the yard without turning the afternoon sour.",
    voice: "direct, dry, practical, and more amused than mean.",
  },
  "npc-nia": {
    backstory:
      "Nia runs errands through South Quay by catching notices, rumors, cafe chatter, and little jams before anyone else bothers to name them.",
    context:
      "Quay Square and the pier are full of tiny details she enjoys catching first.",
    objective: "Stay ahead of what the block is about to notice and share good leads without making a scene.",
    voice: "breezy, quick, observant, and cheerfully nosy.",
  },
};

const DEFAULT_NPC_NARRATIVE: NpcNarrativeProfile = {
  backstory: "This person has a place in South Quay, even if Rowan does not know it yet.",
  context: "They are watching the square for the next small opening.",
  objective: "Keep the day pleasant and moving.",
  voice: "casual, practical, and local.",
};

export function getNpcNarrative(npcId: string): NpcNarrativeProfile {
  return NPC_NARRATIVES[npcId] ?? DEFAULT_NPC_NARRATIVE;
}
