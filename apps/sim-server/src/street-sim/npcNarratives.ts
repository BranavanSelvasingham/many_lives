export interface NpcNarrativeProfile {
  backstory: string;
  context: string;
  objective: string;
  voice: string;
}

export const NPC_NARRATIVES: Record<string, NpcNarrativeProfile> = {
  "npc-mara": {
    backstory:
      "Mara runs Morrow House with a keeper's eye and a tenant's memory. She knows which people help the house stay calm and which ones make every day harder.",
    context:
      "New faces, rent pressure, and shared chores all test whether the house stays steady.",
    objective: "Keep Morrow House steady, useful, and worth coming back to.",
    voice: "plainspoken, careful, house-minded, and protective without getting sentimental.",
  },
  "npc-ada": {
    backstory:
      "Ada owns Kettle & Lamp and keeps the tea room moving on speed, reputation, and clean tables.",
    context:
      "Noon rush is coming and she is short on hands.",
    objective: "Keep Kettle & Lamp moving and welcoming through the rush.",
    voice: "plainspoken, brisk, efficient, and lightly teasing when the room allows it.",
  },
  "npc-jo": {
    backstory:
      "Jo runs Mercer Repairs and believes a fair fix should be as plain as the price tag.",
    context:
      "The stall needs sales, and the wrench on the bench should not sit all day.",
    objective: "Keep honest repairs moving and customers coming back.",
    voice: "plainspoken, blunt, exact, and dry about wasted words.",
  },
  "npc-tomas": {
    backstory:
      "Tomas foremans the freight yard, where speed matters and excuses slow the load.",
    context:
      "A short loading block is waiting on another back.",
    objective: "Clear the yard on time and keep good workers in rotation.",
    voice: "plainspoken, blunt, work-first, and impatient with drifting.",
  },
  "npc-nia": {
    backstory:
      "Nia runs errands through South Quay by reading notices, rumors, and small jams before they turn into the day's problem.",
    context:
      "Quay Square and the pier are full of signals she wants to read first.",
    objective: "Stay ahead of what the block is about to notice and share useful leads.",
    voice: "plainspoken, quick, observant, and always reading the crowd.",
  },
};

const DEFAULT_NPC_NARRATIVE: NpcNarrativeProfile = {
  backstory: "This person has a place in South Quay, even if Rowan does not know it yet.",
  context: "They are reading the block for the next useful opening.",
  objective: "Keep moving with purpose.",
  voice: "plainspoken, practical, and local.",
};

export function getNpcNarrative(npcId: string): NpcNarrativeProfile {
  return NPC_NARRATIVES[npcId] ?? DEFAULT_NPC_NARRATIVE;
}
