import type { Character } from "../domain/character.js";
import type { City } from "../domain/city.js";
import type { EventRecord } from "../domain/event.js";
import type { InboxMessage } from "../domain/inbox.js";
import type { MemoryState } from "../domain/memory.js";
import type { PolicySettings } from "../domain/policy.js";
import type { RelationshipState } from "../domain/relationship.js";
import type { Task, TaskKind } from "../domain/task.js";
import type { WorldState } from "../domain/world.js";
import { addMinutes } from "./worldState.js";

const SCENARIO_START = "2026-03-16T20:00:00.000Z";

export function seedScenario(gameId: string): WorldState {
  const ivoPolicy: PolicySettings = {
    riskTolerance: 0.6,
    spendingLimit: 200,
    escalationThreshold: 3,
    reportingFrequency: "low",
    priorityBias: "access",
  };

  const siaPolicy: PolicySettings = {
    riskTolerance: 0.8,
    spendingLimit: 50,
    escalationThreshold: 2,
    reportingFrequency: "high",
    priorityBias: "signal",
  };

  const renPolicy: PolicySettings = {
    riskTolerance: 0.55,
    spendingLimit: 200,
    escalationThreshold: 3,
    reportingFrequency: "normal",
    priorityBias: "momentum",
  };

  const valePolicy: PolicySettings = {
    riskTolerance: 0.75,
    spendingLimit: 50,
    escalationThreshold: 2,
    reportingFrequency: "normal",
    priorityBias: "coherence",
  };

  const city: City = {
    id: "glass-city",
    name: "Glass",
    premise:
      "A city caught in a rare Ascension Window, where patronage, technology, and cultural legitimacy are changing hands at once.",
    districts: [
      {
        id: "velvet-district",
        name: "Velvet District",
        kind: "elite social rooms",
        heat: 63,
        prestige: 88,
        summary:
          "Invitation-only salons, quiet loyalties, and public ascent disguised as taste.",
      },
      {
        id: "north-undercroft",
        name: "North Undercroft",
        kind: "hidden circuit",
        heat: 78,
        prestige: 34,
        summary:
          "Prototype rooms, unlicensed scenes, and rumors that arrive before language does.",
      },
      {
        id: "glasshouse-floor",
        name: "Glasshouse Floor",
        kind: "cultural signal plane",
        heat: 71,
        prestige: 72,
        summary:
          "Performance rooms where work can become myth or become a cautionary tale overnight.",
      },
      {
        id: "sealed-atrium",
        name: "Sealed Atrium",
        kind: "private leverage machinery",
        heat: 58,
        prestige: 85,
        summary:
          "The place where visible winners are quietly selected by people who never need to be seen.",
      },
    ],
    factions: [
      {
        id: "sable-collective",
        name: "Sable Collective",
        domain: "patronage",
        power: 67,
        openness: 31,
        summary:
          "An old patronage network losing coherence without losing its appetite to own outcomes.",
      },
      {
        id: "lattice-works",
        name: "Lattice Works",
        domain: "private technology",
        power: 74,
        openness: 42,
        summary:
          "A technology circle surfacing years of hidden work before the city has rules for it.",
      },
      {
        id: "afterlight-scene",
        name: "Afterlight Scene",
        domain: "culture",
        power: 59,
        openness: 66,
        summary:
          "A fragmented cultural sphere looking for its next unavoidable figure.",
      },
    ],
    currents: [
      {
        id: "current-velvet-window",
        title: "Velvet Window",
        summary:
          "A room that almost never opens to newcomers is open long enough to decide the next orbit map.",
        axis: "momentum",
        districtId: "velvet-district",
        factionIds: ["sable-collective"],
        urgency: 9,
        exclusivity: 6,
        visibility: "whispered",
        status: "live",
        sensedByCharacterIds: ["ren"],
        dissipatesAtTick: 2,
        tags: ["room", "orbit", "rival movement"],
      },
      {
        id: "current-unfinished-debut",
        title: "The Unfinished Debut",
        summary:
          "The work can be seen before it is safe, while the room is still unstable enough to matter.",
        axis: "signal",
        districtId: "glasshouse-floor",
        factionIds: ["afterlight-scene"],
        urgency: 9,
        exclusivity: 5,
        visibility: "open",
        status: "live",
        sensedByCharacterIds: ["sia"],
        dissipatesAtTick: 3,
        tags: ["debut", "cultural vacuum"],
      },
      {
        id: "current-double-presence",
        title: "Double Presence",
        summary:
          "Public ascent and private power are both expecting a version of you at once.",
        axis: "access",
        districtId: "sealed-atrium",
        factionIds: ["sable-collective", "lattice-works"],
        urgency: 10,
        exclusivity: 7,
        visibility: "hidden",
        status: "live",
        sensedByCharacterIds: ["ivo"],
        dissipatesAtTick: 2,
        tags: ["forked presence", "private leverage"],
      },
      {
        id: "current-rumor-coordinates",
        title: "Rumor With Coordinates",
        summary:
          "The next scene has a place and time now, but only for a few people who moved early enough.",
        axis: "coherence",
        districtId: "north-undercroft",
        factionIds: ["afterlight-scene", "lattice-works"],
        urgency: 8,
        exclusivity: 5,
        visibility: "hidden",
        status: "live",
        sensedByCharacterIds: ["vale"],
        dissipatesAtTick: 4,
        tags: ["early signal", "hidden circuit"],
      },
      {
        id: "current-seam",
        title: "The Seam",
        summary:
          "Luxury, underground, and venture circuits are touching in a way they only do before reordering.",
        axis: "access",
        districtId: "sealed-atrium",
        factionIds: ["sable-collective", "lattice-works", "afterlight-scene"],
        urgency: 7,
        exclusivity: 6,
        visibility: "hidden",
        status: "forming",
        sensedByCharacterIds: [],
        dissipatesAtTick: 6,
        tags: ["circuit overlap", "rare configuration"],
      },
      {
        id: "current-hidden-floor",
        title: "The Hidden Floor",
        summary:
          "A stairwell is leading somewhere that might not exist tomorrow.",
        axis: "coherence",
        districtId: "north-undercroft",
        factionIds: ["lattice-works"],
        urgency: 7,
        exclusivity: 4,
        visibility: "hidden",
        status: "forming",
        sensedByCharacterIds: [],
        dissipatesAtTick: 5,
        tags: ["threshold", "prototype"],
      },
    ],
    rivals: [
      {
        id: "rival-ivory-theory",
        name: "Ivory Theory",
        style: "clean institutional capture",
        focus: "access",
        momentum: 62,
        threat: 58,
        summary:
          "A polished network that turns private leverage into durable ownership.",
      },
      {
        id: "rival-marrow-index",
        name: "Marrow Index",
        style: "technical inevitability",
        focus: "signal",
        momentum: 54,
        threat: 61,
        summary:
          "A technology circle learning how to look cultural before anyone notices the transition.",
      },
      {
        id: "rival-bright-table",
        name: "Bright Table",
        style: "social gravity and selective invitations",
        focus: "momentum",
        momentum: 68,
        threat: 64,
        summary:
          "A social constellation that knows how to make one person seem central by excluding eight others.",
      },
    ],
    clocks: [
      {
        id: "clock-patronage-collapse",
        label: "Patronage collapse",
        progress: 2,
        maxProgress: 8,
        danger: 71,
      },
      {
        id: "clock-tech-surfacing",
        label: "Private tech surfacing",
        progress: 3,
        maxProgress: 8,
        danger: 67,
      },
      {
        id: "clock-cultural-vacuum",
        label: "Cultural vacuum",
        progress: 4,
        maxProgress: 8,
        danger: 74,
      },
    ],
    summaryLines: [
      "The city is reordering itself under active rival pressure.",
      "Several live currents are shaping the city at once, but no single self can cover the full board.",
      "Private technology, collapsing patronage, and cultural vacancy are overlapping in real time.",
    ],
  };

  const characters: Character[] = [
    {
      id: "ivo",
      name: "Ivo",
      role: "architect",
      traits: ["precise", "discreet", "systemic"],
      values: ["control", "leverage", "continuity"],
      ambitions: ["secure structural advantage", "shape ownership of the next order"],
      fears: ["becoming useful but hollow", "serving power without authorship"],
      standingInstincts: [
        "Trade openness for leverage when the room matters.",
        "Enter through quiet systems before visible invitations arrive.",
      ],
      attentionStyle:
        "Escalates late, but sharply, when access or hidden cost could rewire the future.",
      relationshipToPlayer: "trusted strategist",
      homeLocation: "sealed-atrium",
      currentLocation: "sealed-atrium",
      energy: 72,
      stress: 42,
      memoryCoherence: 68,
      cash: 380,
      activeTaskId: null,
      obligations: ["gatekeepers", "private rooms", "quiet leverage"],
      scheduleSummary:
        "Holding private access, overlapping rooms, and the machinery behind the visible city.",
      policies: ivoPolicy,
    },
    {
      id: "sia",
      name: "Sia",
      role: "signal",
      traits: ["intuitive", "aesthetic", "volatile"],
      values: ["authorship", "truth", "myth"],
      ambitions: ["become culturally unavoidable", "turn work into signal that defines an era"],
      fears: ["being diluted by collaboration", "stability purchased with irrelevance"],
      standingInstincts: [
        "Choose force over polish when the wound itself carries signal.",
        "Protect authorship even when bigger names offer acceleration.",
      ],
      attentionStyle:
        "Escalates when meaning, authorship, or the chance at myth is on the line.",
      relationshipToPlayer: "co-conspirator",
      homeLocation: "glasshouse-floor",
      currentLocation: "glasshouse-floor",
      energy: 66,
      stress: 56,
      memoryCoherence: 61,
      cash: 140,
      activeTaskId: null,
      obligations: ["unfinished work", "debut timing", "cultural myth"],
      scheduleSummary:
        "Balancing dangerous expression, live signal, and the chance to become unforgettable too early.",
      policies: siaPolicy,
    },
    {
      id: "ren",
      name: "Ren",
      role: "gravity",
      traits: ["social", "adaptive", "readable"],
      values: ["centrality", "timing", "chemistry"],
      ambitions: ["become the axis powerful people arrange around", "convert attention into allegiance"],
      fears: ["mistaking visibility for reality", "becoming decor in someone else's ascent"],
      standingInstincts: [
        "Move toward the people the future will bend around.",
        "Spend social debt only when it changes the map of orbit.",
      ],
      attentionStyle:
        "Escalates when timing, status, or allegiance starts moving faster than expected.",
      relationshipToPlayer: "operator who wants calibration",
      homeLocation: "velvet-district",
      currentLocation: "velvet-district",
      energy: 74,
      stress: 48,
      memoryCoherence: 65,
      cash: 260,
      activeTaskId: null,
      obligations: ["elite rooms", "orbit shifts", "allegiances"],
      scheduleSummary:
        "Reading chemistry, invitation, and factional motion while rivals rush the same rooms.",
      policies: renPolicy,
    },
    {
      id: "vale",
      name: "Vale",
      role: "threshold",
      traits: ["intuitive", "weird", "restless"],
      values: ["novelty", "destiny", "thresholds"],
      ambitions: ["find tomorrow before it has a name", "open the first door into the next city"],
      fears: ["beautiful dead ends", "chasing volatility until coherence breaks"],
      standingInstincts: [
        "Move first when the signal is weak but alive.",
        "Treat ugly rooms seriously when everyone else is dismissive.",
      ],
      attentionStyle:
        "Escalates when weak signals may become destiny, even if certainty is still low.",
      relationshipToPlayer: "scout who wants latitude",
      homeLocation: "north-undercroft",
      currentLocation: "north-undercroft",
      energy: 63,
      stress: 51,
      memoryCoherence: 58,
      cash: 90,
      activeTaskId: null,
      obligations: ["rumors", "hidden floors", "uncatalogued futures"],
      scheduleSummary:
        "Following fringe signals, unstable prototypes, and scenes that are still too early to name.",
      policies: valePolicy,
    },
  ];

  const memories: MemoryState[] = [
    createMemory(
      "ivo",
      68,
      [
        "A private guest ledger opened a gap where a missing name used to be.",
        "A gatekeeper offered access that smelled like future dependence.",
      ],
      [
        "The city is about to reorganize around hidden systems before visible winners are announced.",
      ],
    ),
    createMemory(
      "sia",
      61,
      [
        "A flaw in the work made it feel more alive than the finished version.",
        "A fragment is already circulating among people with taste.",
      ],
      [
        "If the work lands during the vacuum, culture will have to account for it.",
      ],
    ),
    createMemory(
      "ren",
      65,
      [
        "Someone who anchors the room has started paying closer attention than expected.",
        "A key social constellation is splitting and both sides want an answer fast.",
      ],
      [
        "Only two or three people will become central when the window closes.",
      ],
    ),
    createMemory(
      "vale",
      58,
      [
        "A long-running rumor about the next scene arrived with actual coordinates.",
        "An ugly room felt historically important before anyone could explain why.",
      ],
      [
        "If we are early enough, this stops looking like risk and starts looking like destiny.",
      ],
    ),
  ];

  const relationships: RelationshipState[] = [
    relationship(
      "rel-ivo-player",
      "ivo",
      "player",
      "player",
      "trusted strategist",
      76,
      61,
      32,
      18,
      "Ivo trusts the player's judgment when leverage and hidden cost collide.",
    ),
    relationship(
      "rel-sia-player",
      "sia",
      "player",
      "player",
      "co-conspirator",
      68,
      73,
      28,
      24,
      "Sia wants the player to protect signal without domesticating it.",
    ),
    relationship(
      "rel-ren-player",
      "ren",
      "player",
      "player",
      "calibration",
      71,
      66,
      37,
      21,
      "Ren checks against the player when room-reading starts turning into momentum.",
    ),
    relationship(
      "rel-vale-player",
      "vale",
      "player",
      "player",
      "latitude",
      63,
      69,
      26,
      27,
      "Vale wants the player to let strange signals breathe before shutting them down.",
    ),
    relationship(
      "rel-ivo-sable",
      "ivo",
      "faction",
      "sable-collective",
      "Sable Collective",
      58,
      42,
      56,
      39,
      "Ivo is inside the old patronage machinery, but that access comes with an owner-shaped shadow.",
    ),
    relationship(
      "rel-sia-afterlight",
      "sia",
      "faction",
      "afterlight-scene",
      "Afterlight Scene",
      64,
      77,
      48,
      38,
      "Sia has a real chance to define the scene, but the scene also wants to consume her authorship.",
    ),
    relationship(
      "rel-ren-bright-table",
      "ren",
      "rival",
      "rival-bright-table",
      "Bright Table",
      36,
      51,
      44,
      47,
      "Ren understands Bright Table's orbit logic well enough to exploit it and well enough to be threatened by it.",
    ),
    relationship(
      "rel-vale-lattice",
      "vale",
      "faction",
      "lattice-works",
      "Lattice Works",
      46,
      63,
      41,
      44,
      "Vale keeps finding tomorrow through rooms Lattice Works should not yet control.",
    ),
  ];

  const tasks: Task[] = [
    createTask({
      id: "task-ivo-public-room",
      characterId: "ivo",
      title: "Public ascent room",
      description:
        "Secure position in the room that will shape tomorrow's visible hierarchy.",
      kind: "access",
      location: "glasshouse-floor",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 120,
      durationMinutes: 60,
      travelMinutes: 15,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-ivo-private-room",
      characterId: "ivo",
      title: "Private power room",
      description:
        "Secure the machinery behind the visible city before the ledger closes.",
      kind: "access",
      location: "sealed-atrium",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 120,
      durationMinutes: 60,
      travelMinutes: 15,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-ivo-seam",
      characterId: "ivo",
      title: "The Seam",
      description:
        "Reach the point where luxury, underground, and venture circuits touch.",
      kind: "access",
      location: "sealed-atrium",
      startOffsetMinutes: 300,
      dueOffsetMinutes: 420,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-sia-debut",
      characterId: "sia",
      title: "The unfinished debut",
      description:
        "Reveal the work before it is safe while the room is still unstable enough to matter.",
      kind: "signal",
      location: "glasshouse-floor",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 90,
      durationMinutes: 60,
      travelMinutes: 0,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-sia-afterhours",
      characterId: "sia",
      title: "Afterhours slot",
      description:
        "Take the late-stage slot where careers sometimes begin by accident.",
      kind: "signal",
      location: "glasshouse-floor",
      startOffsetMinutes: 210,
      dueOffsetMinutes: 300,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 4,
      mandatory: false,
    }),
    createTask({
      id: "task-ren-velvet-window",
      characterId: "ren",
      title: "Velvet Window",
      description:
        "Cross into the room that never opens to newcomers before another circle claims it.",
      kind: "momentum",
      location: "velvet-district",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 120,
      durationMinutes: 30,
      travelMinutes: 30,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-ren-introduction",
      characterId: "ren",
      title: "Almost impossible introduction",
      description:
        "Stand in front of someone you had no right to meet and make it feel inevitable.",
      kind: "momentum",
      location: "velvet-district",
      startOffsetMinutes: 270,
      dueOffsetMinutes: 360,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-vale-rumor-run",
      characterId: "vale",
      title: "Rumor with coordinates",
      description:
        "Move on the next scene before the city agrees it exists.",
      kind: "coherence",
      location: "north-undercroft",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 120,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-vale-hidden-floor",
      characterId: "vale",
      title: "Hidden floor",
      description:
        "Follow the stairwell into the room that may not exist tomorrow.",
      kind: "coherence",
      location: "north-undercroft",
      startOffsetMinutes: 210,
      dueOffsetMinutes: 330,
      durationMinutes: 60,
      travelMinutes: 45,
      importance: 4,
      mandatory: true,
    }),
  ];

  const seededEvents: EventRecord[] = [
    event(
      "event-1",
      "ivo",
      "schedule_conflict",
      "high",
      "Ghost List",
      "A name vanished from a private guest ledger and left a usable gap.",
    ),
    event(
      "event-2",
      "ivo",
      "schedule_conflict",
      "high",
      "Borrowed Key",
      "A gatekeeper offered temporary access in exchange for future alignment.",
    ),
    event(
      "event-3",
      "ivo",
      "schedule_conflict",
      "high",
      "The Favor Ledger",
      "Your name surfaced in someone else's ledger of debts and protections.",
    ),
    event(
      "event-4",
      "ivo",
      "schedule_conflict",
      "critical",
      "Double Presence",
      "Two decisive rooms expect a version of you tonight.",
    ),
    event(
      "event-5",
      "ivo",
      "threshold_shift",
      "high",
      "The Seam",
      "Luxury, underground, and venture circuits are touching in one place.",
    ),
    event(
      "event-6",
      "sia",
      "stress_spike",
      "critical",
      "The Unfinished Debut",
      "The work can be revealed before it is safe, while attention is unstable.",
    ),
    event(
      "event-7",
      "sia",
      "stress_spike",
      "medium",
      "The Better Mistake",
      "A flaw made the work feel alive and harder to tame.",
    ),
    event(
      "event-8",
      "sia",
      "scene_heat",
      "high",
      "Afterhours Slot",
      "A late-stage slot appeared in a room where careers sometimes begin by accident.",
    ),
    event(
      "event-9",
      "sia",
      "rival_advance",
      "high",
      "The Leak That Breathes",
      "A private fragment is already circulating among people with taste.",
    ),
    event(
      "event-10",
      "sia",
      "schedule_conflict",
      "high",
      "Impossible Collaboration",
      "A bigger name wants inside the work.",
    ),
    event(
      "event-11",
      "ren",
      "threshold_shift",
      "critical",
      "Velvet Window",
      "A room that never opens to newcomers is open for a few minutes.",
    ),
    event(
      "event-12",
      "ren",
      "schedule_conflict",
      "high",
      "Orbit Shift",
      "Someone everyone else circles is suddenly paying attention to you.",
    ),
    event(
      "event-13",
      "ren",
      "stress_spike",
      "medium",
      "Public Recognition",
      "Someone introduced you as a legend larger than reality.",
    ),
    event(
      "event-14",
      "ren",
      "schedule_conflict",
      "high",
      "Fracture in the Scene",
      "A key social constellation is splitting and wants your alignment.",
    ),
    event(
      "event-15",
      "ren",
      "travel_delay",
      "high",
      "The Almost Impossible Introduction",
      "One impossible introduction is suddenly in reach.",
    ),
    event(
      "event-16",
      "vale",
      "threshold_shift",
      "high",
      "The Hidden Floor",
      "A stairwell opened to somewhere that may not exist tomorrow.",
    ),
    event(
      "event-17",
      "vale",
      "tech_glimmer",
      "high",
      "Prototype in the Dark",
      "A private technology is surfacing in a room too ugly for cautious people.",
    ),
    event(
      "event-18",
      "vale",
      "rumor_sharpened",
      "high",
      "Rumor With Coordinates",
      "A long-running rumor just arrived with an actual place and time.",
    ),
    event(
      "event-19",
      "vale",
      "stress_spike",
      "medium",
      "The Unlicensed Genius",
      "A brilliant unknown asked for twenty minutes off-grid.",
    ),
    event(
      "event-20",
      "vale",
      "scene_heat",
      "high",
      "The Future With Bad Lighting",
      "An ugly room suddenly feels historically important.",
    ),
  ];

  const seededInbox: InboxMessage[] = [
    {
      id: "inbox-1",
      characterId: "ren",
      senderName: "Ren",
      type: "request",
      priority: "critical",
      subject: "Velvet Window",
      body:
        "A room that never opens to newcomers is open for a few minutes, and another circle is already moving toward it. If we enter first, they remember us as inevitable. If we arrive second, we become a flourish in someone else's ascent.",
      suggestedActions: ["Enter First", "Send A Smaller Self", "Let It Pass"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -18),
      eventId: "event-11",
      consequences: {
        access: "high",
        momentum: "high",
        rivalAttention: "high",
      },
      tags: ["exclusive room", "rival movement"],
      followupHooks: [
        "If another circle claims the window, they control the introductions that follow.",
      ],
      attentionTier: "interrupt",
      escalationReason:
        "A decisive room is open briefly and rival movement is already underway.",
    },
    {
      id: "inbox-2",
      characterId: "sia",
      senderName: "Sia",
      type: "request",
      priority: "critical",
      subject: "The Unfinished Debut",
      body:
        "I can reveal the work before it is safe, while attention is still unstable enough to take the wound. If it lands tonight, they will not be able to reorganize culture without accounting for us. If it misses, rivals inherit the void.",
      suggestedActions: ["Reveal It Now", "Bleed A Fragment", "Hold Until Tomorrow"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -14),
      eventId: "event-6",
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
      attentionTier: "interrupt",
      escalationReason:
        "Signal, authorship, and the chance at myth are all exposed at once.",
    },
    {
      id: "inbox-3",
      characterId: "ivo",
      senderName: "Ivo",
      type: "request",
      priority: "critical",
      subject: "Double Presence",
      body:
        "Two decisive rooms expect a version of us tonight. One shapes public ascent. The other shapes private power. We cannot inhabit both with equal force without straining coherence.",
      suggestedActions: ["Claim The Public Room", "Claim The Private Room", "Split The Network"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -16),
      eventId: "event-4",
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
      attentionTier: "interrupt",
      escalationReason:
        "The structural upside is real, but so is the cost to coherence.",
    },
    {
      id: "inbox-4",
      characterId: "vale",
      senderName: "Vale",
      type: "request",
      priority: "high",
      subject: "Rumor With Coordinates",
      body:
        "A long-running rumor about the next scene just arrived with an actual place and time. If we move now, we may meet tomorrow before the city agrees it exists. If we stall, faster networks will claim authorship over the scene.",
      suggestedActions: ["Move Before It Is Named", "Verify The Source", "Feed It To Ren"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -12),
      eventId: "event-18",
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
      attentionTier: "message",
      escalationReason:
        "The signal is weak, but if it is real it changes what the city calls next.",
    },
    {
      id: "inbox-5",
      characterId: "ren",
      senderName: "Ren",
      type: "request",
      priority: "high",
      subject: "Fracture in the Scene",
      body:
        "A key social constellation is splitting, and both sides want to know where we stand before dawn. One side controls the current invitations. The other may own the next era. Faster circles are already making promises.",
      suggestedActions: ["Back The Rising Side", "Back The Entrenched Side", "Stay Uncommitted"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -7),
      eventId: "event-14",
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
      attentionTier: "message",
      escalationReason:
        "The room is deciding who becomes central and who becomes decor.",
    },
  ];

  return {
    id: gameId,
    scenarioId: "ascension-window",
    scenarioName: "The Ascension Window",
    currentTime: SCENARIO_START,
    tickCount: 0,
    summary:
      "The city is reordering itself, and no one with only one life can shape what comes next. Spread yourself across decisive rooms, dangerous shifts, and unrecoverable moments before your lives splinter into leverage, myth, or ruin.",
    city,
    characters,
    memories,
    relationships,
    perceivedSignals: [],
    tasks,
    events: seededEvents,
    inbox: seededInbox,
    attentionLog: seededInbox.map((message, index) => ({
      id: `notification-${index + 1}`,
      characterId: message.characterId,
      eventId: message.eventId,
      tier: message.attentionTier ?? "message",
      priority: message.priority,
      subject: message.subject,
      summary: message.body,
      createdAt: message.createdAt,
    })),
    cityState: {
      access: 61,
      momentum: 57,
      signal: 45,
      coherence: 63,
      risk: 58,
      socialDebt: 34,
      rivalAttention: 54,
      windowNarrowing: 47,
      worldPulse: [
        "A patronage network is collapsing in public and closing in private.",
        "Private technology is surfacing before the city has rules for it.",
        "A cultural vacuum is widening while rival circles search for new anchors.",
      ],
      rivalStatus:
        "Rival movement detected across the velvet rooms and hidden circuits.",
    },
    systemFlags: [],
    counters: {
      event: seededEvents.length,
      inbox: seededInbox.length,
      memory: memories.reduce((count, memory) => count + memory.episodes.length, 0),
      notification: seededInbox.length,
      signal: 0,
    },
  };
}

interface TaskSeed {
  id: string;
  characterId: string;
  title: string;
  description: string;
  kind: TaskKind;
  location: string;
  startOffsetMinutes: number;
  dueOffsetMinutes: number;
  durationMinutes: number;
  travelMinutes: number;
  importance: number;
  mandatory: boolean;
}

function createTask(seed: TaskSeed): Task {
  return {
    id: seed.id,
    characterId: seed.characterId,
    title: seed.title,
    description: seed.description,
    kind: seed.kind,
    location: seed.location,
    startAt: addMinutes(SCENARIO_START, seed.startOffsetMinutes),
    dueAt: addMinutes(SCENARIO_START, seed.dueOffsetMinutes),
    durationMinutes: seed.durationMinutes,
    progressMinutes: 0,
    travelMinutes: seed.travelMinutes,
    travelProgressMinutes: 0,
    status: "pending",
    importance: seed.importance,
    mandatory: seed.mandatory,
    createdBy: "scenario",
  };
}

function createMemory(
  characterId: string,
  coherence: number,
  episodes: string[],
  beliefs: string[],
): MemoryState {
  return {
    characterId,
    coherence,
    episodes: episodes.map((summary, index) => ({
      id: `memory-seed-${characterId}-${index + 1}`,
      eventId: `seed-${characterId}-${index + 1}`,
      createdAt: addMinutes(SCENARIO_START, -(index + 1) * 45),
      summary,
      tone: index === 0 ? "opportunity" : "warning",
      weight: 3,
      tags: [characterId, "seed"],
    })),
    beliefs: beliefs.map((belief, index) => ({
      id: `belief-seed-${characterId}-${index + 1}`,
      subject: index === 0 ? "world" : `belief-${index + 1}`,
      belief,
      confidence: 0.72,
      lastConfirmedAt: addMinutes(SCENARIO_START, -(index + 1) * 30),
    })),
    unresolvedThreads: episodes.slice(0, 2),
  };
}

function relationship(
  id: string,
  sourceCharacterId: string,
  targetType: RelationshipState["targetType"],
  targetId: string,
  label: string,
  trust: number,
  affinity: number,
  dependency: number,
  strain: number,
  summary: string,
): RelationshipState {
  return {
    id,
    sourceCharacterId,
    targetType,
    targetId,
    label,
    trust,
    affinity,
    dependency,
    strain,
    summary,
    lastUpdatedAt: SCENARIO_START,
  };
}

function event(
  id: string,
  characterId: string,
  type: EventRecord["type"],
  priority: EventRecord["priority"],
  title: string,
  description: string,
): EventRecord {
  return {
    id,
    characterId,
    type,
    priority,
    title,
    description,
    createdAt: SCENARIO_START,
  };
}
