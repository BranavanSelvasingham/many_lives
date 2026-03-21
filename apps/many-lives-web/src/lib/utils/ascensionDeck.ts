import type {
  CityState,
  ConsequenceCategory,
  InboxAction,
  MessageType,
  PriorityLevel,
  RiskLevel,
} from "@/lib/types/game";

type CityDelta = Partial<
  Pick<
    CityState,
    | "access"
    | "momentum"
    | "signal"
    | "coherence"
    | "risk"
    | "socialDebt"
    | "rivalAttention"
    | "windowNarrowing"
  >
>;

export interface DeckMessageSeed {
  id: string;
  characterId: string;
  senderName: string;
  type: MessageType;
  priority: PriorityLevel;
  subject: string;
  preview: string;
  body: string;
  createdOffsetMinutes: number;
  unlockAtTick: number;
  requiresResponse: boolean;
  suggestedActions: InboxAction[];
  consequences: Partial<Record<ConsequenceCategory, RiskLevel>>;
  tags?: string[];
  followupHooks?: string[];
  actionImpacts?: Record<string, CityDelta>;
}

function action(id: string, label: string): InboxAction {
  return { id, label };
}

export const initialAscensionMessageIds = [
  "velvet-window",
  "unfinished-debut",
  "double-presence",
  "rumor-with-coordinates",
  "fracture-in-the-scene",
] as const;

export const ascensionDeck: DeckMessageSeed[] = [
  {
    id: "ghost-list",
    characterId: "ivo",
    senderName: "Ivo",
    type: "opportunity",
    priority: "high",
    subject: "Ghost List",
    preview:
      "A private guest ledger lost a name an hour ago. I can slide us into the gap before anyone audits it.",
    body:
      "A private guest ledger lost a name an hour ago. I can slide one of us into the gap before anyone audits the room. If we appear there cleanly, doors open above our current class. If we are read as counterfeit, rival stewards will mark the network as decorative and shut future access.",
    createdOffsetMinutes: -42,
    unlockAtTick: 2,
    requiresResponse: true,
    suggestedActions: [
      action("enter_under_erasure", "Enter under erasure"),
      action("trace_the_removed_name", "Trace the removed name first"),
      action("leave_the_gap_empty", "Leave the gap empty"),
    ],
    consequences: {
      access: "high",
      coherence: "medium",
      rivalAttention: "medium",
    },
    tags: ["private access", "ledger breach"],
    followupHooks: [
      "If you take the gap, someone will eventually ask who you displaced.",
    ],
  },
  {
    id: "borrowed-key",
    characterId: "ivo",
    senderName: "Ivo",
    type: "decision",
    priority: "high",
    subject: "Borrowed Key",
    preview:
      "A gatekeeper can open a locked circuit for one night. The price is future alignment.",
    body:
      "A gatekeeper I trust exactly once can open a locked circuit for one night. We get the room, the list, and the names that decide who is admitted into the next order. The price is future alignment when the city finishes sorting itself. Useful now, expensive later.",
    createdOffsetMinutes: -34,
    unlockAtTick: 3,
    requiresResponse: true,
    suggestedActions: [
      action("accept_the_key", "Accept the key"),
      action("trade_for_partial_access", "Trade for partial access"),
      action("refuse_the_alignment", "Refuse the alignment"),
    ],
    consequences: {
      access: "high",
      socialDebt: "high",
      coherence: "medium",
    },
    tags: ["gatekeeper", "social debt"],
    followupHooks: [
      "If you borrow the key, the lender will claim a shape in your future.",
    ],
  },
  {
    id: "favor-ledger",
    characterId: "ivo",
    senderName: "Ivo",
    type: "social",
    priority: "normal",
    subject: "The Favor Ledger",
    preview:
      "Our name appears inside someone else's ledger of debts, protections, and future calls.",
    body:
      "Our name appears inside someone else's ledger of debts, protections, and future calls. That means we are already in motion inside a machine we did not build. We can accept the shelter and become legible to power, or cut free and lose a quiet layer of defense.",
    createdOffsetMinutes: -28,
    unlockAtTick: 6,
    requiresResponse: false,
    suggestedActions: [
      action("accept_the_cover", "Accept the cover"),
      action("audit_the_ledger", "Audit the ledger"),
      action("burn_the_entry", "Burn the entry"),
    ],
    consequences: {
      access: "medium",
      socialDebt: "high",
      risk: "medium",
    },
    tags: ["debt", "protection"],
    followupHooks: [
      "If you burn the entry, the protection vanishes before dawn.",
    ],
  },
  {
    id: "double-presence",
    characterId: "ivo",
    senderName: "Ivo",
    type: "decision",
    priority: "urgent",
    subject: "Double Presence",
    preview:
      "Two decisive rooms expect a version of us tonight. One shapes public ascent. The other shapes private power.",
    body:
      "Two decisive rooms expect a version of us tonight. One shapes public ascent and will decide who becomes visible by morning. The other shapes private power and will decide who gets written into the machinery behind the visible city. We cannot inhabit both with equal force without straining coherence. Choose the room, or split and pay in coherence.",
    createdOffsetMinutes: -16,
    unlockAtTick: 0,
    requiresResponse: true,
    suggestedActions: [
      action("claim_the_public_room", "Claim the public room"),
      action("claim_the_private_room", "Claim the private room"),
      action("split_the_network", "Split the network"),
    ],
    consequences: {
      access: "high",
      signal: "high",
      coherence: "high",
      rivalAttention: "medium",
    },
    tags: ["forked presence", "irreversible"],
    followupHooks: [
      "A split appearance may win both rooms and still leave no single self in control.",
    ],
    actionImpacts: {
      claim_the_public_room: {
        signal: 8,
        momentum: 4,
        access: 2,
        rivalAttention: 5,
        coherence: -3,
      },
      claim_the_private_room: {
        access: 8,
        momentum: 3,
        signal: 1,
        socialDebt: 4,
        coherence: -2,
      },
      split_the_network: {
        access: 5,
        signal: 5,
        momentum: 5,
        coherence: -8,
        risk: 4,
        rivalAttention: 4,
      },
    },
  },
  {
    id: "the-seam",
    characterId: "ivo",
    senderName: "Ivo",
    type: "opportunity",
    priority: "high",
    subject: "The Seam",
    preview:
      "Luxury, underground, and venture circuits are touching in one place. This only happens when a city is reorganizing.",
    body:
      "Luxury, underground, and venture circuits are touching unexpectedly in one place. This only happens when a city is reorganizing. If we arrive correctly, we stop being a guest and start becoming connective tissue. If we arrive wrong, we become visible to every network without belonging to any of them.",
    createdOffsetMinutes: -10,
    unlockAtTick: 8,
    requiresResponse: true,
    suggestedActions: [
      action("arrive_polished", "Arrive polished"),
      action("arrive_unannounced", "Arrive unannounced"),
      action("watch_from_outside", "Watch from outside"),
    ],
    consequences: {
      access: "high",
      momentum: "medium",
      rivalAttention: "high",
    },
    tags: ["venture seam", "hybrid room"],
    followupHooks: ["If the seam holds, tomorrow's patrons will be chosen there."],
  },
  {
    id: "unfinished-debut",
    characterId: "sia",
    senderName: "Sia",
    type: "decision",
    priority: "urgent",
    subject: "The Unfinished Debut",
    preview:
      "I can reveal the work before it is safe, while the city's attention is still unstable enough to take the wound.",
    body:
      "I can reveal the work before it is safe, while the city's attention is still unstable enough to take the wound. If it lands tonight, they will not be able to reorganize culture without accounting for us. If it misses, rivals inherit the void and call our timing vanity.",
    createdOffsetMinutes: -14,
    unlockAtTick: 0,
    requiresResponse: true,
    suggestedActions: [
      action("reveal_it_now", "Reveal it now"),
      action("bleed_a_fragment", "Bleed a fragment first"),
      action("hold_until_tomorrow", "Hold until tomorrow"),
    ],
    consequences: {
      signal: "high",
      momentum: "medium",
      coherence: "medium",
      rivalAttention: "high",
    },
    tags: ["debut", "cultural vacuum"],
    followupHooks: [
      "If it lands, bigger names will try to stand inside the signal.",
    ],
    actionImpacts: {
      reveal_it_now: {
        signal: 9,
        momentum: 3,
        rivalAttention: 6,
        coherence: -2,
      },
      bleed_a_fragment: {
        signal: 5,
        momentum: 2,
        coherence: -1,
        rivalAttention: 3,
      },
      hold_until_tomorrow: {
        coherence: 3,
        momentum: -4,
        signal: -2,
        windowNarrowing: 4,
      },
    },
  },
  {
    id: "better-mistake",
    characterId: "sia",
    senderName: "Sia",
    type: "decision",
    priority: "normal",
    subject: "The Better Mistake",
    preview:
      "A flaw in the work made it feel alive. We can keep the wound or refine it away.",
    body:
      "A flaw in the work made it feel alive. I can keep the wound and let it cut through the room, or refine it away and arrive safer. One version makes us memorable. The other makes us admissible. Those are not the same future.",
    createdOffsetMinutes: -24,
    unlockAtTick: 4,
    requiresResponse: true,
    suggestedActions: [
      action("keep_the_wound", "Keep the wound"),
      action("refine_the_surface", "Refine the surface"),
      action("let_the_room_decide", "Let the room decide"),
    ],
    consequences: {
      signal: "high",
      coherence: "medium",
      risk: "medium",
    },
    tags: ["artistic risk", "mythmaking"],
    followupHooks: ["The rough version creates devotion and enemies at the same speed."],
  },
  {
    id: "afterhours-slot",
    characterId: "sia",
    senderName: "Sia",
    type: "opportunity",
    priority: "high",
    subject: "Afterhours Slot",
    preview:
      "A late-stage slot appeared in a room where careers sometimes begin by accident and never return to normal.",
    body:
      "A late-stage slot appeared in a room where careers sometimes begin by accident and never return to normal. We can step into the breach with unfinished heat, or stay out and preserve the work for a cleaner debut. If we hesitate too long, another act takes the slot and writes us out of the myth.",
    createdOffsetMinutes: -31,
    unlockAtTick: 5,
    requiresResponse: true,
    suggestedActions: [
      action("take_the_slot", "Take the slot"),
      action("send_only_a_fragment", "Send only a fragment"),
      action("decline_with_style", "Decline with style"),
    ],
    consequences: {
      signal: "high",
      momentum: "high",
      rivalAttention: "medium",
    },
    tags: ["afterhours", "career break"],
  },
  {
    id: "leak-that-breathes",
    characterId: "sia",
    senderName: "Sia",
    type: "social",
    priority: "high",
    subject: "The Leak That Breathes",
    preview:
      "A private fragment is already moving among people with taste. It feels alive out there.",
    body:
      "A private fragment is already moving among people with taste. It feels alive out there, which means the work is beginning to circulate without our permissions attached. If we claim the leak, it becomes signal. If we deny it, someone else will narrate what it meant.",
    createdOffsetMinutes: -20,
    unlockAtTick: 7,
    requiresResponse: true,
    suggestedActions: [
      action("claim_the_leak", "Claim the leak"),
      action("feed_it_more", "Feed it more"),
      action("deny_and_contain", "Deny and contain"),
    ],
    consequences: {
      signal: "high",
      rivalAttention: "medium",
      coherence: "medium",
    },
    tags: ["leak", "circulation"],
  },
  {
    id: "impossible-collaboration",
    characterId: "sia",
    senderName: "Sia",
    type: "decision",
    priority: "high",
    subject: "Impossible Collaboration",
    preview:
      "A bigger name wants inside the work. They could multiply the signal or dissolve us into theirs.",
    body:
      "A bigger name wants inside the work. They could multiply the signal and move us into rooms we cannot currently breach, or dissolve our signature into a safer consensus. We either become undeniable together, or unrecognizable inside their gravity.",
    createdOffsetMinutes: -8,
    unlockAtTick: 9,
    requiresResponse: true,
    suggestedActions: [
      action("collaborate_publicly", "Collaborate publicly"),
      action("insist_on_authorship", "Insist on authorship"),
      action("keep_them_out", "Keep them out"),
    ],
    consequences: {
      signal: "high",
      access: "medium",
      coherence: "high",
    },
    tags: ["collaboration", "identity risk"],
  },
  {
    id: "velvet-window",
    characterId: "ren",
    senderName: "Ren",
    type: "opportunity",
    priority: "urgent",
    subject: "Velvet Window",
    preview:
      "A room that never opens to newcomers is open for a few minutes, and another circle is already moving toward it.",
    body:
      "A room that never opens to newcomers is open for a few minutes, and another circle is already moving toward it. If we cross the threshold first, powerful people start remembering us as inevitable. If we arrive second, we become a flourish in someone else's ascent.",
    createdOffsetMinutes: -18,
    unlockAtTick: 0,
    requiresResponse: true,
    suggestedActions: [
      action("enter_first", "Enter first"),
      action("send_a_smaller_self", "Send a smaller self"),
      action("let_it_pass", "Let it pass"),
    ],
    consequences: {
      access: "high",
      momentum: "high",
      rivalAttention: "high",
    },
    tags: ["exclusive room", "rival movement"],
    followupHooks: [
      "If another circle claims the window, they will control the introductions that follow.",
    ],
    actionImpacts: {
      enter_first: {
        access: 8,
        momentum: 7,
        rivalAttention: 5,
        coherence: -2,
      },
      send_a_smaller_self: {
        access: 4,
        momentum: 4,
        coherence: -1,
        rivalAttention: 2,
      },
      let_it_pass: {
        coherence: 2,
        momentum: -6,
        access: -4,
        windowNarrowing: 5,
      },
    },
  },
  {
    id: "orbit-shift",
    characterId: "ren",
    senderName: "Ren",
    type: "social",
    priority: "high",
    subject: "Orbit Shift",
    preview:
      "Someone everyone else circles is suddenly paying attention to us. That changes the room before we speak.",
    body:
      "Someone everyone else circles is suddenly paying attention to us. That changes the room before we speak. We can turn the attention into orbit, or we can overplay it and look like a creature of proximity instead of a future center.",
    createdOffsetMinutes: -11,
    unlockAtTick: 3,
    requiresResponse: true,
    suggestedActions: [
      action("convert_attention_into_orbit", "Convert attention into orbit"),
      action("play_it_cool", "Play it cool"),
      action("trade_on_their_name", "Trade on their name"),
    ],
    consequences: {
      momentum: "high",
      signal: "medium",
      coherence: "medium",
    },
    tags: ["status pivot", "attention"],
  },
  {
    id: "public-recognition",
    characterId: "ren",
    senderName: "Ren",
    type: "social",
    priority: "normal",
    subject: "Public Recognition",
    preview:
      "Someone just introduced us as a legend larger than our current reality.",
    body:
      "Someone just introduced us as a legend larger than our current reality. We can inhabit the larger silhouette and let the myth run ahead, or correct it and keep the network honest. One path multiplies reach. The other protects coherence.",
    createdOffsetMinutes: -6,
    unlockAtTick: 6,
    requiresResponse: true,
    suggestedActions: [
      action("inhabit_the_legend", "Inhabit the legend"),
      action("correct_the_story", "Correct the story"),
      action("redirect_the_praise", "Redirect the praise"),
    ],
    consequences: {
      signal: "high",
      momentum: "medium",
      coherence: "medium",
    },
    tags: ["myth", "reputation"],
  },
  {
    id: "fracture-in-the-scene",
    characterId: "ren",
    senderName: "Ren",
    type: "decision",
    priority: "high",
    subject: "Fracture in the Scene",
    preview:
      "A key social constellation is splitting, and both sides want to know where we stand before dawn.",
    body:
      "A key social constellation is splitting, and both sides want to know where we stand before dawn. One side controls the current invitations. The other may own the next era. If we choose too soon, we inherit their enemies. If we stall, both camps start building around faster people.",
    createdOffsetMinutes: -7,
    unlockAtTick: 0,
    requiresResponse: true,
    suggestedActions: [
      action("back_the_rising_side", "Back the rising side"),
      action("back_the_entrenched_side", "Back the entrenched side"),
      action("stay_uncommitted", "Stay uncommitted"),
    ],
    consequences: {
      momentum: "high",
      access: "medium",
      socialDebt: "high",
      rivalAttention: "medium",
    },
    tags: ["split alliance", "factional risk"],
    followupHooks: [
      "Another circle is already promising loyalty to whichever side survives the split.",
    ],
    actionImpacts: {
      back_the_rising_side: {
        momentum: 7,
        signal: 3,
        socialDebt: 4,
        rivalAttention: 3,
      },
      back_the_entrenched_side: {
        access: 6,
        momentum: 2,
        socialDebt: 5,
        coherence: -1,
      },
      stay_uncommitted: {
        coherence: 2,
        momentum: -5,
        rivalAttention: 4,
        windowNarrowing: 3,
      },
    },
  },
  {
    id: "almost-impossible-introduction",
    characterId: "ren",
    senderName: "Ren",
    type: "opportunity",
    priority: "high",
    subject: "The Almost Impossible Introduction",
    preview:
      "I can place one of us in front of someone we have had no right to meet. It only works once.",
    body:
      "I can place one of us in front of someone we have had no right to meet. It only works once and it will be remembered forever as either audacity or trespass. If we enter correctly, the city opens by one degree. If we miss, the refusal becomes public knowledge.",
    createdOffsetMinutes: -15,
    unlockAtTick: 8,
    requiresResponse: true,
    suggestedActions: [
      action("take_the_introduction", "Take the introduction"),
      action("send_ivo_instead", "Send Ivo instead"),
      action("save_the_shot", "Save the shot"),
    ],
    consequences: {
      access: "high",
      momentum: "medium",
      risk: "medium",
    },
    tags: ["elite intro", "one shot"],
  },
  {
    id: "hidden-floor",
    characterId: "vale",
    senderName: "Vale",
    type: "opportunity",
    priority: "high",
    subject: "The Hidden Floor",
    preview:
      "I found a stairwell that leads to something which may not exist tomorrow.",
    body:
      "I found a stairwell that leads to something which may not exist tomorrow. The people moving through it are either nobodies in a borrowed room or early witnesses to the next scene before it has language. If we go, we gamble attention on an uncatalogued future. If we do not, someone else names it first.",
    createdOffsetMinutes: -22,
    unlockAtTick: 4,
    requiresResponse: true,
    suggestedActions: [
      action("go_up_now", "Go up now"),
      action("mark_and_return", "Mark and return"),
      action("leave_it_unknown", "Leave it unknown"),
    ],
    consequences: {
      access: "medium",
      signal: "medium",
      risk: "high",
    },
    tags: ["hidden circuit", "threshold"],
  },
  {
    id: "prototype-in-the-dark",
    characterId: "vale",
    senderName: "Vale",
    type: "opportunity",
    priority: "high",
    subject: "Prototype in the Dark",
    preview:
      "Someone is demoing a technology that could change the class of life we can live.",
    body:
      "Someone is demoing a technology that could change the class of life we can live, and they are doing it in a room too ugly to attract anyone cautious. If it works, the city's hierarchy shifts around whoever touched it early. If it fails, we become witnesses to a very expensive hallucination.",
    createdOffsetMinutes: -25,
    unlockAtTick: 5,
    requiresResponse: true,
    suggestedActions: [
      action("touch_it_early", "Touch it early"),
      action("watch_the_demo", "Watch the demo"),
      action("walk_away", "Walk away"),
    ],
    consequences: {
      access: "medium",
      momentum: "high",
      risk: "high",
    },
    tags: ["private tech", "class shift"],
  },
  {
    id: "rumor-with-coordinates",
    characterId: "vale",
    senderName: "Vale",
    type: "opportunity",
    priority: "high",
    subject: "Rumor With Coordinates",
    preview:
      "A long-running rumor about the next scene just arrived with an actual place and time.",
    body:
      "A long-running rumor about the next scene just arrived with an actual place and time. Rumors are harmless until they acquire coordinates. If we move now, we may meet tomorrow before the city agrees it exists. If we stall, faster networks will claim authorship over the scene and call us latecomers.",
    createdOffsetMinutes: -12,
    unlockAtTick: 0,
    requiresResponse: true,
    suggestedActions: [
      action("move_before_it_is_named", "Move before it is named"),
      action("verify_the_source", "Verify the source"),
      action("feed_it_to_ren", "Feed it to Ren"),
    ],
    consequences: {
      access: "medium",
      momentum: "high",
      risk: "medium",
      rivalAttention: "medium",
    },
    tags: ["emerging scene", "early signal"],
    followupHooks: [
      "If the coordinates are real, the room will never again be this open.",
    ],
    actionImpacts: {
      move_before_it_is_named: {
        momentum: 8,
        access: 3,
        risk: 4,
        coherence: -2,
      },
      verify_the_source: {
        coherence: 3,
        momentum: -2,
        windowNarrowing: 2,
      },
      feed_it_to_ren: {
        momentum: 4,
        signal: 2,
        socialDebt: 2,
      },
    },
  },
  {
    id: "unlicensed-genius",
    characterId: "vale",
    senderName: "Vale",
    type: "decision",
    priority: "normal",
    subject: "The Unlicensed Genius",
    preview:
      "A brilliant unknown wants twenty minutes off-grid, no names, no recording.",
    body:
      "A brilliant unknown wants twenty minutes off-grid, no names, no recording. This is either the kind of meeting people mythologize later or a beautifully staged dead end. If we take it, nothing from the encounter will be legible except what we can carry back inside ourselves.",
    createdOffsetMinutes: -19,
    unlockAtTick: 7,
    requiresResponse: true,
    suggestedActions: [
      action("take_the_meeting", "Take the meeting"),
      action("bring_one_question", "Bring one question"),
      action("decline_the_mystery", "Decline the mystery"),
    ],
    consequences: {
      signal: "medium",
      coherence: "medium",
      risk: "medium",
    },
    tags: ["unknown talent", "off-grid"],
  },
  {
    id: "future-with-bad-lighting",
    characterId: "vale",
    senderName: "Vale",
    type: "status",
    priority: "high",
    subject: "The Future With Bad Lighting",
    preview:
      "I am in an ugly room and suddenly certain that something historically important is happening here.",
    body:
      "I am in an ugly room and suddenly certain that something historically important is happening here. Nothing about it looks prestigious yet, which is exactly why it is available. We can invest attention before anyone else recognizes the shape, or preserve polish and arrive after the naming is finished.",
    createdOffsetMinutes: -9,
    unlockAtTick: 10,
    requiresResponse: false,
    suggestedActions: [
      action("hold_the_room", "Hold the room"),
      action("call_the_others", "Call the others"),
      action("let_it_mature", "Let it mature"),
    ],
    consequences: {
      momentum: "high",
      signal: "medium",
      coherence: "medium",
    },
    tags: ["historical signal", "uncatalogued"],
  },
];
