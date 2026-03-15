import type { Character } from "../domain/character.js";
import type { EventRecord } from "../domain/event.js";
import type { InboxMessage } from "../domain/inbox.js";
import type { PolicySettings } from "../domain/policy.js";
import type { Task, TaskKind } from "../domain/task.js";
import type { WorldState } from "../domain/world.js";
import { addMinutes } from "./worldState.js";

const SCENARIO_START = "2026-03-16T12:00:00.000Z";

export function seedScenario(gameId: string): WorldState {
  const jordanPolicy: PolicySettings = {
    riskTolerance: 0.25,
    spendingLimit: 140,
    escalationThreshold: 3,
    reportingFrequency: "normal",
    priorityBias: "family",
  };

  const mayaPolicy: PolicySettings = {
    riskTolerance: 0.75,
    spendingLimit: 260,
    escalationThreshold: 4,
    reportingFrequency: "low",
    priorityBias: "health",
  };

  const leoPolicy: PolicySettings = {
    riskTolerance: 0.2,
    spendingLimit: 60,
    escalationThreshold: 2,
    reportingFrequency: "high",
    priorityBias: "work",
  };

  const characters: Character[] = [
    {
      id: "jordan",
      name: "Jordan",
      role: "office-worker-parent",
      homeLocation: "home",
      currentLocation: "home",
      energy: 72,
      stress: 38,
      cash: 120,
      activeTaskId: null,
      obligations: ["parenting", "office work", "school pickup"],
      scheduleSummary:
        "Balancing office meetings with school logistics and household errands.",
      policies: jordanPolicy,
    },
    {
      id: "maya",
      name: "Maya",
      role: "freelancer",
      homeLocation: "apartment",
      currentLocation: "apartment",
      energy: 64,
      stress: 46,
      cash: 210,
      activeTaskId: null,
      obligations: ["client deadlines", "cash flow", "self-care"],
      scheduleSummary:
        "Protecting freelance income while trying to keep a sustainable routine.",
      policies: mayaPolicy,
    },
    {
      id: "leo",
      name: "Leo",
      role: "student",
      homeLocation: "dorm",
      currentLocation: "dorm",
      energy: 58,
      stress: 41,
      cash: 48,
      activeTaskId: null,
      obligations: ["classes", "group work", "part-time job"],
      scheduleSummary:
        "A student day split between lab work, group deadlines, and a campus shift.",
      policies: leoPolicy,
    },
  ];

  const tasks: Task[] = [
    createTask({
      id: "task-jordan-dropoff",
      characterId: "jordan",
      title: "School drop-off",
      description: "Get Sam to school before homeroom starts.",
      kind: "family",
      location: "school",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 60,
      durationMinutes: 30,
      travelMinutes: 30,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-jordan-standup",
      characterId: "jordan",
      title: "Team standup",
      description: "Be present for the morning office standup.",
      kind: "work",
      location: "office",
      startOffsetMinutes: 90,
      dueOffsetMinutes: 120,
      durationMinutes: 30,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-jordan-budget",
      characterId: "jordan",
      title: "Budget review",
      description: "Finalize budget assumptions before the leadership review.",
      kind: "work",
      location: "office",
      startOffsetMinutes: 540,
      dueOffsetMinutes: 600,
      durationMinutes: 60,
      travelMinutes: 0,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-jordan-pickup",
      characterId: "jordan",
      title: "School pickup",
      description: "Pick up Sam before after-school fees kick in.",
      kind: "family",
      location: "school",
      startOffsetMinutes: 540,
      dueOffsetMinutes: 600,
      durationMinutes: 30,
      travelMinutes: 30,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-maya-revisions",
      characterId: "maya",
      title: "Client revisions",
      description: "Turn around requested homepage revisions.",
      kind: "work",
      location: "apartment",
      startOffsetMinutes: 60,
      dueOffsetMinutes: 180,
      durationMinutes: 90,
      travelMinutes: 0,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-maya-invoice",
      characterId: "maya",
      title: "Invoice follow-up",
      description: "Chase the late payment before cash gets tight.",
      kind: "money",
      location: "apartment",
      startOffsetMinutes: 300,
      dueOffsetMinutes: 420,
      durationMinutes: 30,
      travelMinutes: 0,
      importance: 3,
      mandatory: true,
    }),
    createTask({
      id: "task-maya-yoga",
      characterId: "maya",
      title: "Yoga class",
      description: "Take the studio class that helps reset stress levels.",
      kind: "health",
      location: "studio",
      startOffsetMinutes: 570,
      dueOffsetMinutes: 690,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 3,
      mandatory: false,
    }),
    createTask({
      id: "task-maya-rent",
      characterId: "maya",
      title: "Rent transfer",
      description: "Send rent before the nightly bank cutoff.",
      kind: "money",
      location: "apartment",
      startOffsetMinutes: 600,
      dueOffsetMinutes: 690,
      durationMinutes: 30,
      travelMinutes: 0,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-leo-lab",
      characterId: "leo",
      title: "Chemistry lab",
      description: "Make the mandatory lab session and finish the practical.",
      kind: "study",
      location: "science-lab",
      startOffsetMinutes: 0,
      dueOffsetMinutes: 150,
      durationMinutes: 120,
      travelMinutes: 30,
      importance: 5,
      mandatory: true,
    }),
    createTask({
      id: "task-leo-project",
      characterId: "leo",
      title: "Group project sync",
      description:
        "Meet the team in the library to land the presentation outline.",
      kind: "study",
      location: "library",
      startOffsetMinutes: 360,
      dueOffsetMinutes: 480,
      durationMinutes: 60,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-leo-shift",
      characterId: "leo",
      title: "Campus cafe shift",
      description: "Cover the evening shift to keep the job in good standing.",
      kind: "work",
      location: "campus-cafe",
      startOffsetMinutes: 600,
      dueOffsetMinutes: 780,
      durationMinutes: 150,
      travelMinutes: 30,
      importance: 4,
      mandatory: true,
    }),
    createTask({
      id: "task-leo-call",
      characterId: "leo",
      title: "Call mom",
      description: "Make the promised check-in call tonight.",
      kind: "family",
      location: "campus-cafe",
      startOffsetMinutes: 720,
      dueOffsetMinutes: 780,
      durationMinutes: 30,
      travelMinutes: 0,
      importance: 3,
      mandatory: true,
    }),
  ];

  const seededEvents: EventRecord[] = [
    {
      id: "event-1",
      characterId: "maya",
      type: "schedule_conflict",
      priority: "critical",
      title: "Maya has a delivery conflict",
      description:
        "A supplier delay is threatening Maya's client handoff window.",
      createdAt: addMinutes(SCENARIO_START, -10),
      relatedTaskId: "task-maya-revisions",
    },
    {
      id: "event-2",
      characterId: "jordan",
      type: "schedule_conflict",
      priority: "high",
      title: "Jordan sees pickup pressure later today",
      description:
        "Jordan is already worried that office work may collide with school pickup.",
      createdAt: addMinutes(SCENARIO_START, -5),
      relatedTaskId: "task-jordan-pickup",
    },
    {
      id: "event-3",
      characterId: "leo",
      type: "travel_delay",
      priority: "medium",
      title: "Leo's shuttle is running behind",
      description:
        "The bus to campus is unpredictable, which could cut into Leo's lab setup.",
      createdAt: addMinutes(SCENARIO_START, -15),
      relatedTaskId: "task-leo-lab",
    },
  ];

  const seededInbox: InboxMessage[] = [
    {
      id: "inbox-1",
      characterId: "maya",
      senderName: "Maya",
      type: "request",
      priority: "critical",
      subject: "Delivery Conflict",
      body: "The supplier is delayed by about two hours. If I wait, I may miss the client handoff window.",
      suggestedActions: [
        "Switch Vendor",
        "Wait 2h",
        "Reschedule Handoff",
        "Ask Jordan",
      ],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -10),
      eventId: "event-1",
      consequences: {
        money: "medium",
        stress: "low",
        reputation: "high",
        relationship: "none",
        schedule: "high",
      },
    },
    {
      id: "inbox-2",
      characterId: "jordan",
      senderName: "Jordan",
      type: "request",
      priority: "high",
      subject: "Pickup Coverage Question",
      body: "If the budget review spills, I may need backup for school pickup. I can adjust now if you want me to plan around family first.",
      suggestedActions: ["Protect Pickup", "Stay Flexible", "Ask Maya"],
      requiresResponse: true,
      createdAt: addMinutes(SCENARIO_START, -5),
      eventId: "event-2",
      consequences: {
        money: "none",
        stress: "medium",
        relationship: "medium",
        schedule: "high",
      },
    },
    {
      id: "inbox-3",
      characterId: "leo",
      senderName: "Leo",
      type: "update",
      priority: "medium",
      subject: "Late Bus to Campus",
      body: "The campus shuttle is dragging. I should still make lab, but I may lose setup time unless I improvise.",
      suggestedActions: ["Acknowledge", "Call a Rideshare"],
      requiresResponse: false,
      createdAt: addMinutes(SCENARIO_START, -15),
      eventId: "event-3",
      consequences: {
        money: "low",
        stress: "medium",
        schedule: "medium",
      },
    },
  ];

  return {
    id: gameId,
    scenarioId: "seed-busy-day",
    scenarioName: "Busy Day Prototype",
    currentTime: SCENARIO_START,
    tickCount: 0,
    summary:
      "Three lives are already in motion. Expect schedule conflicts, stress spikes, and inbox-worthy tradeoffs by late afternoon.",
    characters,
    tasks,
    events: seededEvents,
    inbox: seededInbox,
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
