import type { Character } from "../domain/character.js";
import type { EventRecord } from "../domain/event.js";
import type { InboxMessage } from "../domain/inbox.js";
import type { PolicySettings } from "../domain/policy.js";
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
    priorityBias: "integrity",
  };

  const characters: Character[] = [
    {
      id: "ivo",
      name: "Ivo",
      role: "architect",
      homeLocation: "vantage-annex",
      currentLocation: "vantage-annex",
      energy: 72,
      stress: 42,
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
      homeLocation: "glasshouse-floor",
      currentLocation: "glasshouse-floor",
      energy: 66,
      stress: 56,
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
      homeLocation: "velvet-district",
      currentLocation: "velvet-district",
      energy: 74,
      stress: 48,
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
      homeLocation: "north-undercroft",
      currentLocation: "north-undercroft",
      energy: 63,
      stress: 51,
      cash: 90,
      activeTaskId: null,
      obligations: ["rumors", "hidden floors", "uncatalogued futures"],
      scheduleSummary:
        "Following weird openings, unstable prototypes, and scenes that are still too early to name.",
      policies: valePolicy,
    },
  ];

  const tasks: Task[] = [
    createTask({
      id: "task-ivo-public-room",
      characterId: "ivo",
      title: "Public ascent room",
      description: "Secure position in the room that will shape tomorrow's visible hierarchy.",
      kind: "access",
      location: "glass-foyer",
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
      description: "Secure the machinery behind the visible city before the ledger closes.",
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
      description: "Reach the point where luxury, underground, and venture circuits touch.",
      kind: "access",
      location: "seam-room",
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
      description: "Reveal the work before it is safe while the room is still unstable enough to matter.",
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
      description: "Take the late-stage opening where careers sometimes begin by accident.",
      kind: "signal",
      location: "afterhours-room",
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
      description: "Cross into the room that never opens to newcomers before another circle claims it.",
      kind: "momentum",
      location: "velvet-window",
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
      description: "Stand in front of someone you had no right to meet and make it feel inevitable.",
      kind: "momentum",
      location: "private-balcony",
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
      description: "Move on the next scene before the city agrees it exists.",
      kind: "integrity",
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
      description: "Follow the stairwell into the room that may not exist tomorrow.",
      kind: "integrity",
      location: "hidden-floor",
      startOffsetMinutes: 210,
      dueOffsetMinutes: 330,
      durationMinutes: 60,
      travelMinutes: 45,
      importance: 4,
      mandatory: true,
    }),
  ];

  const seededEvents: EventRecord[] = [
    event("event-1", "ivo", "schedule_conflict", "high", "Ghost List", "A name vanished from a private guest ledger and left a usable gap."),
    event("event-2", "ivo", "schedule_conflict", "high", "Borrowed Key", "A gatekeeper offered temporary access in exchange for future alignment."),
    event("event-3", "ivo", "schedule_conflict", "high", "The Favor Ledger", "Your name surfaced in someone else's ledger of debts and protections."),
    event("event-4", "ivo", "schedule_conflict", "critical", "Double Presence", "Two decisive rooms expect a version of you tonight."),
    event("event-5", "ivo", "schedule_conflict", "high", "The Seam", "Luxury, underground, and venture circuits are touching in one place."),
    event("event-6", "sia", "stress_spike", "critical", "The Unfinished Debut", "The work can be revealed before it is safe, while attention is unstable."),
    event("event-7", "sia", "stress_spike", "medium", "The Better Mistake", "A flaw made the work feel alive and harder to tame."),
    event("event-8", "sia", "schedule_conflict", "high", "Afterhours Slot", "A late-stage opening appeared in a room where careers sometimes begin by accident."),
    event("event-9", "sia", "travel_delay", "high", "The Leak That Breathes", "A private fragment is already circulating among people with taste."),
    event("event-10", "sia", "schedule_conflict", "high", "Impossible Collaboration", "A bigger name wants inside the work."),
    event("event-11", "ren", "travel_delay", "critical", "Velvet Window", "A room that never opens to newcomers is open for a few minutes."),
    event("event-12", "ren", "schedule_conflict", "high", "Orbit Shift", "Someone everyone else circles is suddenly paying attention to you."),
    event("event-13", "ren", "stress_spike", "medium", "Public Recognition", "Someone introduced you as a legend larger than reality."),
    event("event-14", "ren", "schedule_conflict", "high", "Fracture in the Scene", "A key social constellation is splitting and wants your alignment."),
    event("event-15", "ren", "travel_delay", "high", "The Almost Impossible Introduction", "One impossible introduction is suddenly in reach."),
    event("event-16", "vale", "travel_delay", "high", "The Hidden Floor", "A stairwell opened to somewhere that may not exist tomorrow."),
    event("event-17", "vale", "travel_delay", "high", "Prototype in the Dark", "A private technology is surfacing in a room too ugly for cautious people."),
    event("event-18", "vale", "travel_delay", "high", "Rumor With Coordinates", "A long-running rumor just arrived with an actual place and time."),
    event("event-19", "vale", "stress_spike", "medium", "The Unlicensed Genius", "A brilliant unknown asked for twenty minutes off-grid."),
    event("event-20", "vale", "travel_delay", "high", "The Future With Bad Lighting", "An ugly room suddenly feels historically important."),
  ];

  const seededInbox: InboxMessage[] = [
    {
      id: "inbox-1",
      characterId: "ren",
      senderName: "Ren",
      type: "request",
      priority: "critical",
      subject: "Velvet Window",
      body: "A room that never opens to newcomers is open for a few minutes, and another circle is already moving toward it. If we enter first, they remember us as inevitable. If we arrive second, we become a flourish in someone else's ascent.",
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
    },
    {
      id: "inbox-2",
      characterId: "sia",
      senderName: "Sia",
      type: "request",
      priority: "critical",
      subject: "The Unfinished Debut",
      body: "I can reveal the work before it is safe, while attention is still unstable enough to take the wound. If it lands tonight, they will not be able to reorganize culture without accounting for us. If it misses, rivals inherit the void.",
      suggestedActions: ["Reveal It Now", "Bleed A Fragment", "Hold Until Tomorrow"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -14),
      eventId: "event-6",
      consequences: {
        signal: "high",
        momentum: "medium",
        integrity: "medium",
        rivalAttention: "high",
      },
      tags: ["debut", "cultural opening"],
      followupHooks: [
        "If it lands, bigger names will try to stand inside the signal.",
      ],
    },
    {
      id: "inbox-3",
      characterId: "ivo",
      senderName: "Ivo",
      type: "request",
      priority: "critical",
      subject: "Double Presence",
      body: "Two decisive rooms expect a version of us tonight. One shapes public ascent. The other shapes private power. We cannot inhabit both with equal force without straining coherence.",
      suggestedActions: ["Claim The Public Room", "Claim The Private Room", "Split The Network"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -16),
      eventId: "event-4",
      consequences: {
        access: "high",
        signal: "high",
        integrity: "high",
        rivalAttention: "medium",
      },
      tags: ["forked presence", "irreversible"],
      followupHooks: [
        "A split appearance may win both rooms and still leave no single self in control.",
      ],
    },
    {
      id: "inbox-4",
      characterId: "vale",
      senderName: "Vale",
      type: "request",
      priority: "high",
      subject: "Rumor With Coordinates",
      body: "A long-running rumor about the next scene just arrived with an actual place and time. If we move now, we may meet tomorrow before the city agrees it exists. If we stall, faster networks will claim authorship over the scene.",
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
    },
    {
      id: "inbox-5",
      characterId: "ren",
      senderName: "Ren",
      type: "request",
      priority: "high",
      subject: "Fracture in the Scene",
      body: "A key social constellation is splitting, and both sides want to know where we stand before dawn. One side controls the current invitations. The other may own the next era. Faster circles are already making promises.",
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
    },
  ];

  return {
    id: gameId,
    scenarioId: "ascension-window",
    scenarioName: "The Ascension Window",
    currentTime: SCENARIO_START,
    tickCount: 0,
    summary:
      "The city is reordering itself, and no one with only one life can shape what comes next. Spread yourself across decisive rooms, dangerous openings, and unrecoverable moments before your lives splinter into leverage, myth, or ruin.",
    characters,
    tasks,
    events: seededEvents,
    inbox: seededInbox,
    cityState: {
      access: 61,
      momentum: 57,
      signal: 45,
      integrity: 63,
      risk: 58,
      socialDebt: 34,
      rivalAttention: 54,
      windowNarrowing: 47,
      worldPulse: [
        "A patronage network is collapsing in public and closing in private.",
        "Private technology is surfacing before the city has rules for it.",
        "A cultural vacuum is opening while rival circles search for new anchors.",
      ],
      rivalStatus:
        "Rival movement detected across the velvet rooms and hidden circuits.",
    },
    systemFlags: [],
    counters: {
      event: seededEvents.length,
      inbox: seededInbox.length,
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
