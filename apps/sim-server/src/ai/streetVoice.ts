export const STREET_VOICE_THEME_NAME = "working-port realism";

export const STREET_VOICE_THEME_SUMMARY =
  "Brackenport sounds like a contemporary working waterfront: plainspoken, practical, local, resilient, and quietly hopeful even under pressure.";

export function buildStreetVoicePromptLines() {
  return [
    `Shared city voice: ${STREET_VOICE_THEME_NAME}. ${STREET_VOICE_THEME_SUMMARY}`,
    "- All South Quay NPCs should sound like they grew up in the same port city, even when their jobs and temperaments differ.",
    "- Favor short, concrete, contemporary wording over ornate or literary phrasing.",
    "- Keep lines practical, direct, and grounded in work, rent, time pressure, weather, favors, and the block immediately around them.",
    "- Keep the emotional tone constructive: people can be blunt, but they should still sound like they believe something useful can be done next.",
    "- Avoid fatalistic or gloomy phrasing when a practical next step exists.",
    "- Keep the pace a little unhurried: one clear point at a time, with natural spoken pauses instead of rapid-fire exposition.",
    "- Aim for clear, normal, humane phrasing. Eloquent here means well-phrased and natural, not theatrical or ornate.",
    "- Do not use archaic, Dickensian, theatrical, faux-classic, or proverb-like phrasing.",
    "- Do not sound nostalgic, poetic, courtly, or like a period piece.",
    "- Small dry humor is fine. Big metaphors, speeches, and stylized flourishes are not.",
    "- Rowan is the exception: he is new to the city, so he can sound a little more openly searching, but still natural and respectful.",
    "- Do not use creepy, possessive, surveillance-like, or target-lock phrasing for people.",
  ];
}

const STREET_VOICE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\beyes on ([A-Z][A-Za-z'-]+) for\b/g, "talk to $1 about "],
  [/\babout a bed\b/gi, "about a room"],
  [/\bfor a bed\b/gi, "about a room"],
  [/\babout a room and ([A-Z][A-Za-z'-]+)\b/g, "about a room, then find $1"],
  [/\bcould become mine\b/gi, "could become a real friend"],
  [/\bbecome mine\b/gi, "become a real friend"],
  [/\bbefore the rush hardens\b/gi, "before the rush hits"],
  [/\bbefore the room hardens\b/gi, "before the room fills up"],
  [/\bthe room tells on slow hands fast\b/gi, "the room notices slow hands fast"],
  [/\bthe room tells on slow hands quicker than people think\b/gi, "the room notices slow hands quicker than people think"],
  [/\bthe block keeps telling on itself\b/gi, "the block keeps giving itself away"],
  [/\bthe block tells on itself\b/gi, "the block gives itself away"],
  [/\bthat's the whole song\b/gi, "that's it"],
  [/\bwill snag hard\b/gi, "will jam up"],
  [/\bwill snag\b/gi, "will jam"],
  [/\bbefore the swell\b/gi, "before the rush"],
  [/\bthe slip tells on tomorrow before noon does\b/gi, "the slip shows you tomorrow before noon does"],
];

export function normalizeStreetVoice(text: string): string {
  let normalized = text;

  for (const [pattern, replacement] of STREET_VOICE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}
