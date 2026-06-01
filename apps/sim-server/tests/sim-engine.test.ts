import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import type {
  StreetPlanningRequest,
  StreetPlanningResult,
} from "../src/ai/provider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { buildRowanCognition } from "../src/sim/rowanCognition.js";
import { runRowanLoopSmoke } from "../src/sim/rowanLoopSmoke.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";

class PlanningAIProvider extends MockAIProvider {
  override readonly name = "openai";
  readonly requests: StreetPlanningRequest[] = [];

  constructor(private readonly result: StreetPlanningResult | null) {
    super();
  }

  override async planStreetNextAction(input: StreetPlanningRequest) {
    this.requests.push(input);
    return this.result;
  }
}

function expectCognitionToMirrorAutonomy(world: StreetGameState) {
  const nextMove = buildRowanCognition(world).nextMove;
  expect(nextMove).toMatchObject({
    actionId: world.rowanAutonomy.actionId,
    kind: world.rowanAutonomy.stepKind,
    layer: world.rowanAutonomy.layer,
    npcId: world.rowanAutonomy.npcId,
    rationale: world.rowanAutonomy.detail,
    targetLocationId: world.rowanAutonomy.targetLocationId,
    text: world.rowanAutonomy.label,
  });
  expect(nextMove?.effects ?? []).toEqual(world.rowanAutonomy.effects ?? []);
}

describe("SimulationEngine street slice", () => {
  it("lets the player discover and complete a first paid shift", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tea-shift");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    while (world.clock.hour + world.clock.minute / 60 < 12) {
      world = await engine.tick(world, 1);
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (world.jobs.find((job) => job.id === "job-tea-shift")?.completed) {
        break;
      }
      world = await engine.runCommand(world, {
        type: "act",
        actionId: "work:job-tea-shift",
      });
    }

    expect(
      world.jobs.find((job) => job.id === "job-tea-shift")?.completed,
    ).toBe(true);
    expect(world.player.money).toBeGreaterThan(12);
    expect(
      world.jobs.find((job) => job.id === "job-yard-shift")?.discovered,
    ).toBe(true);
  });

  it("plays the first tea shift as a few visible work beats", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tea-shift-stages");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    while (world.clock.hour + world.clock.minute / 60 < 12) {
      world = await engine.tick(world, 1);
    }
    expect(
      world.cityEvents.find((event) => event.id === "event-cafe-prep"),
    ).toMatchObject({
      status: "resolved",
    });
    expect(
      world.cityEvents.find((event) => event.id === "event-lunch-rush"),
    ).toMatchObject({
      status: "active",
      progress: "rush",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    expect(world.firstAfternoon?.teaShiftStage).toBe("rush");
    expect(world.player.currentThought).toBe(
      "The room is filling. Cups first, tables second, keep moving.",
    );
    expect(
      world.cityEvents.find((event) => event.id === "event-lunch-rush"),
    ).toMatchObject({
      status: "active",
      progress: "rush",
    });
    expect(
      world.currentScene.notes.some((note) =>
        note.text.includes("Kettle & Lamp"),
      ),
    ).toBe(true);
    expect(world.jobs.find((job) => job.id === "job-tea-shift")?.completed).toBe(
      false,
    );
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "work:job-tea-shift",
      label: "Keep the lunch rush moving",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    expect(world.firstAfternoon?.teaShiftStage).toBe("counter");
    expect(world.player.currentThought).toBe(
      "Ada is not watching every step now. That probably means I am keeping up.",
    );
    expect(
      world.cityEvents.find((event) => event.id === "event-lunch-rush"),
    ).toMatchObject({
      status: "active",
      progress: "counter",
    });
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "work:job-tea-shift",
      label: "Finish the cup-and-counter shift",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    expect(world.firstAfternoon?.teaShiftStage).toBe("paid");
    expect(world.jobs.find((job) => job.id === "job-tea-shift")?.completed).toBe(
      true,
    );
    expect(
      world.cityEvents.find((event) => event.id === "event-lunch-rush"),
    ).toMatchObject({
      status: "resolved",
      progress: "paid",
    });
    expect(world.player.money).toBeGreaterThan(12);
  });

  it("lets the player buy a tool and solve a neighborhood problem", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-pump");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 16,
      y: 9,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "buy:item-wrench",
    });
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 3,
      y: 13,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "solve:problem-pump",
    });

    expect(
      world.problems.find((problem) => problem.id === "problem-pump")?.status,
    ).toBe("solved");
    expect(
      world.player.inventory.some((item) => item.id === "item-wrench"),
    ).toBe(true);
    expect(world.player.reputation.morrow_house).toBeGreaterThan(1);
  });

  it("blocks movement to walkable tiles that are not actually reachable", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-unreachable-move");

    const island = world.map.tiles.find((tile) => tile.x === 0 && tile.y === 0);
    expect(island).toBeDefined();
    if (!island) {
      return;
    }

    island.walkable = true;
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 0,
      y: 0,
    });

    expect(world.player.x).toBe(3);
    expect(world.player.y).toBe(9);
  });

  it("spends clock time when movement crosses real distance", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-movement-time");
    const startMinutes = world.clock.totalMinutes;
    const startTime = world.currentTime;

    const moved = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });

    expect(moved.clock.totalMinutes).toBeGreaterThan(startMinutes);
    expect(moved.currentTime).not.toBe(startTime);
    expect(moved.player.currentLocationId).toBe("tea-house");
  });

  it("lets objective pursuit arrive and open the planned conversation in one beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-objective-conversation");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 8,
      y: 9,
    });
    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(
      world.activeConversation?.lines.some(
        (entry) => entry.speaker === "player",
      ),
    ).toBe(true);
  });

  it("surfaces rowan autonomy for a clear conversation beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-objective-autonomy");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 8,
      y: 9,
    });
    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    expect(world.rowanAutonomy.autoContinue).toBe(true);
    expect(world.rowanAutonomy.npcId).toBe("npc-mara");
    expect(world.rowanAutonomy.targetLocationId).toBe("boarding-house");
    expectCognitionToMirrorAutonomy(world);

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.activeConversation?.npcId).toBe("npc-mara");
  });

  it("keeps the first-afternoon rail copy player-facing", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-first-afternoon-copy");

    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      label: "Talk to Mara",
      stepKind: "talk",
      targetLocationId: "boarding-house",
    });
    expect(world.rowanAutonomy.detail).toContain(
      "Ask what the room costs",
    );
    expect(world.rowanAutonomy.intent).toMatchObject({
      reason:
        "Mara is here and matches the current objective, so Rowan can ask directly.",
      signals: expect.arrayContaining([
        "Here: Morrow House",
        "Person: Mara",
      ]),
    });
    expect(world.rowanAutonomy.detail).not.toMatch(
      /prompt|context is specific|clear enough/i,
    );
  });

  it("opens the first afternoon with room talk before the work lead", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-first-afternoon-opening");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    const playerLine = world.activeConversation?.lines.find(
      (entry) => entry.speaker === "player",
    );
    const maraLine = world.activeConversation?.lines.find(
      (entry) => entry.speaker === "npc",
    );

    expect(playerLine?.text).toMatch(/room|Morrow House|tonight/i);
    expect(playerLine?.text).not.toMatch(/hands|lunch|work lead/i);
    expect(maraLine?.text).toMatch(/Morrow House|room|Ada|Kettle & Lamp/i);
    expect(world.activeConversation?.objectiveText).toContain("Ada");
  });

  it("lets an OpenAI planner choose a validated objective action", async () => {
    const provider = new PlanningAIProvider({
      actionId: "rest:home",
      confidence: 0.91,
      rationale: "Rowan has energy to recover before choosing a lead.",
    });
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-ai-planner-valid");
    const startMinutes = world.clock.totalMinutes;

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toMatchObject({
      objective: {
        routeKey: "first-afternoon",
      },
    });
    expect(provider.requests[0].allowedActions.map((action) => action.actionId)).toContain(
      "rest:home",
    );
    expect(provider.requests[0].desiredOutcomes.map((outcome) => outcome.id)).toEqual(
      expect.arrayContaining(["shelter-stability", "income"]),
    );
    expect(world.activeConversation).toBeUndefined();
    expect(world.clock.totalMinutes).toBe(startMinutes + 60);
    expect(world.feed.map((entry) => entry.text)).toContain(
      "You rested, but the house never quite stopped sounding busy and unfinished.",
    );
  });

  it("falls back when an OpenAI planner chooses an invalid action", async () => {
    const provider = new PlanningAIProvider({
      actionId: "solve:problem-that-does-not-exist",
      confidence: 0.99,
      rationale: "Invent a shortcut.",
    });
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-ai-planner-invalid");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(provider.requests).toHaveLength(1);
    expect(world.activeConversation?.npcId).toBe("npc-mara");
  });

  it("falls back when an OpenAI planner is low confidence", async () => {
    const provider = new PlanningAIProvider({
      actionId: "rest:home",
      confidence: 0.24,
      rationale: "Maybe rest.",
    });
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-ai-planner-low-confidence");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(provider.requests).toHaveLength(1);
    expect(world.activeConversation?.npcId).toBe("npc-mara");
  });

  it("keeps no-OpenAI objective advance deterministic", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-no-ai-planner");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.activeConversation?.lines.find((line) => line.speaker === "player")?.text).toMatch(
      /room|Morrow House|tonight/i,
    );
  });

  it("exposes the first afternoon as competing live choices with a planner trace", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-first-afternoon-live-fork");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.availableActions.map((action) => action.id)).toEqual(
      expect.arrayContaining([
        "reflect:first-afternoon-plan",
        "reflect:first-afternoon-pump",
        "rest:home",
      ]),
    );
    expect(world.rowanAutonomy.planningTrace).toMatchObject({
      selectedActionId: expect.any(String),
    });
    expect(
      world.rowanAutonomy.planningTrace?.considered.map(
        (option) => option.actionId,
      ),
    ).toEqual(
      expect.arrayContaining([
        "reflect:first-afternoon-plan",
        "reflect:first-afternoon-pump",
      ]),
    );
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) => option.actionId === "reflect:first-afternoon-pump",
      ),
    ).toBe(true);
  });

  it("keeps Ada's verified offer as a fork instead of forcing immediate acceptance", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-post-ada-fork");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "reflect:first-afternoon-plan",
    });
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.firstAfternoon?.leadFieldNote).toBeDefined();
    expect(world.availableActions.map((action) => action.id)).toEqual(
      expect.arrayContaining([
        "accept:job-tea-shift",
        "reflect:first-afternoon-compare",
      ]),
    );
  });

  it("lets deterministic fallback choose objective outcomes over a scripted route hint", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-agent-outcome-over-route");
    const startMinutes = world.clock.totalMinutes;

    world.player.energy = 18;
    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      focus: "rest",
      routeKey: "scripted-test-route",
      source: "manual",
      text: "Rest until Rowan can think clearly.",
      trail: [
        {
          id: "scripted-wrong-next-step",
          title: "Talk to Ada even though Rowan is exhausted.",
          done: false,
          npcId: "npc-ada",
          targetLocationId: "tea-house",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 checked off",
        total: 1,
      },
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.clock.totalMinutes).toBe(startMinutes + 60);
    expect(world.feed.map((entry) => entry.text)).toContain(
      "You rested, but the house never quite stopped sounding busy and unfinished.",
    );
  });

  it("lets active problems outrank a scripted talk route", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-agent-problem-over-route");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");

    world.player.x = 3;
    world.player.y = 11;
    world.player.currentLocationId = "courtyard";
    world.player.inventory.push({
      id: "item-wrench",
      name: "Old wrench",
      description: "A tool for the pump.",
    });
    if (pump) {
      pump.discovered = true;
      pump.status = "active";
    }
    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      focus: "help",
      routeKey: "scripted-talk-route",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
      trail: [
        {
          id: "scripted-talk-instead-of-fix",
          title: "Ask Mara about the pump instead of using the wrench.",
          done: false,
          npcId: "npc-mara",
          targetLocationId: "boarding-house",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 checked off",
        total: 1,
      },
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      status: "solved",
    });
    expect(world.feed.map((entry) => entry.text)).toContain(
      "You tightened the pump in Morrow Yard, slowed the leak, and Mara pressed $12 into your hand before the stones flooded again.",
    );
  });

  it("lets a no-trail objective complete through legal actions and predicates", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-agent-no-trail-pump");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");

    world.player.x = 3;
    world.player.y = 11;
    world.player.currentLocationId = "courtyard";
    world.player.inventory.push({
      id: "item-wrench",
      name: "Old wrench",
      description: "A tool for the pump.",
    });
    if (pump) {
      pump.discovered = true;
      pump.status = "active";
    }
    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "help",
      outcomes: [],
      progress: {
        completed: 0,
        label: "0/0 no trail",
        total: 0,
      },
      routeKey: "help-pump",
      source: "manual",
      text: "Fix the pump in Morrow Yard before it spreads.",
      trail: [],
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      status: "solved",
    });
    expect(world.player.objective).toMatchObject({
      routeKey: "help-pump",
      progress: {
        completed: 3,
        total: 3,
      },
    });
    expect(world.player.objective?.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "help-pump-fix",
          status: "met",
        }),
      ]),
    );
  });

  it("lets Rowan resolve a manual conversation into a concrete next beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-manual-conversation-loop");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "I'm new here.",
    });

    const thread = world.conversationThreads["npc-mara"];
    expect(thread).toBeDefined();
    expect(
      thread?.lines.filter((entry) => entry.speaker === "player").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      thread?.lines.filter((entry) => entry.speaker === "npc").length,
    ).toBeGreaterThanOrEqual(1);
    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.activeConversation?.objectiveText).toContain("Ada");
    expect(world.activeConversation?.objectiveText).toContain("Kettle & Lamp");
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      layer: "conversation",
      stepKind: "reflect",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("hands a resolved conversation off into the next concrete objective beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-resolved-conversation-handoff");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "What do I need to do to keep a room here?",
    });

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      layer: "conversation",
      stepKind: "reflect",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      autoContinue: true,
      layer: "objective",
      stepKind: "act",
      targetLocationId: "boarding-house",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("lands a resolved conversation before taking the next action", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-smooth-conversation-landing");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    expect(world.activeConversation?.npcId).toBe("npc-mara");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    expect(world.activeConversation).toBeUndefined();
    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      autoContinue: true,
      layer: "objective",
      stepKind: "act",
      targetLocationId: "boarding-house",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    expect(world.firstAfternoon?.planSettledAt).toBeDefined();
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      layer: "objective",
      stepKind: "move",
      targetLocationId: "tea-house",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    expect(world.activeConversation?.npcId).toBe("npc-ada");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.jobs.find((job) => job.id === "job-tea-shift")?.accepted).toBe(
      false,
    );
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "accept:job-tea-shift",
      autoContinue: true,
      layer: "objective",
      stepKind: "act",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("executes a queued objective walk on the next continue", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-queued-objective-walk");

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      mode: "acting",
      targetLocationId: "boarding-house",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.rowanAutonomy).toMatchObject({
      mode: "moving",
      targetLocationId: "tea-house",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
      confirmMove: true,
    });

    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.activeConversation?.npcId).toBe("npc-ada");
  });

  it("lets advance objective leave an unresolved conversation on the next concrete beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-live-conversation-advance");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "I'm new here.",
    });

    const thread = world.conversationThreads["npc-mara"];
    const unresolvedLines = thread.lines.slice(0, 2);
    world.conversations = world.conversations.slice(0, 2);
    world.conversationThreads["npc-mara"] = {
      ...thread,
      decision: undefined,
      lines: unresolvedLines,
      objectiveText: undefined,
      summary: undefined,
      updatedAt: unresolvedLines.at(-1)?.time ?? world.currentTime,
    };
    world.activeConversation = {
      id: thread.id,
      threadId: thread.id,
      npcId: "npc-mara",
      locationId: "boarding-house",
      updatedAt: unresolvedLines.at(-1)?.time ?? world.currentTime,
      decision: undefined,
      objectiveText: undefined,
      lines: unresolvedLines,
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("keeps rowan cognition aligned once a conversation is live", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-live-conversation-autonomy");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });

    expect(world.rowanAutonomy).toMatchObject({
      layer: "conversation",
      mode: "conversation",
      stepKind: "reflect",
    });
    expect(world.rowanAutonomy.effects).toContain("memory");
    expectCognitionToMirrorAutonomy(world);
  });

  it("keeps rowan cognition aligned while holding for an accepted shift", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-hold-shift-autonomy");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });

    expect(world.rowanAutonomy).toMatchObject({
      actionId: "work:job-tea-shift",
      autoContinue: true,
      layer: "commitment",
      mode: "waiting",
      stepKind: "wait",
      targetLocationId: "tea-house",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("turns Mara's housing talk into a deliberate Ada plan Rowan can follow", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-mara-ada-handoff");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "I need to keep my room here, and I need work today. Who should I ask?",
    });

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.activeConversation?.objectiveText).toBe(
      "Get to Kettle & Lamp and ask Ada for work.",
    );

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 1,
      silent: true,
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      autoContinue: true,
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("completes Mara's Ada lead loop once Rowan has grounded evidence and a next choice", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-mara-ada-lead-loop");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Verify Mara's lead by walking to Kettle & Lamp, asking Ada about lunch work, and recording what Rowan learns.",
    });

    expect(world.player.objective).toMatchObject({
      focus: "work",
      routeKey: "mara-ada-lead",
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (
        world.player.objective?.progress.completed ===
          world.player.objective?.progress.total &&
        !world.activeConversation
      ) {
        break;
      }

      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
    }

    const teaShift = world.jobs.find((job) => job.id === "job-tea-shift");
    expect(world.player.currentLocationId).toBe("tea-house");
    expect(teaShift).toMatchObject({
      accepted: false,
      completed: false,
      discovered: true,
    });
    expect(world.firstAfternoon?.leadFieldNote).toMatchObject({
      evidence: expect.stringContaining("Asked Ada at Kettle & Lamp"),
      learned: expect.stringContaining("Mara's Kettle & Lamp lead is real"),
      next: expect.stringContaining("Choose whether to take"),
    });
    expect(world.firstAfternoon?.fieldNote).toBeUndefined();
    expect(
      world.availableActions.find(
        (action) => action.id === "accept:job-tea-shift",
      ),
    ).toMatchObject({
      label: "Take Cup-and-counter shift",
    });
    expect(world.player.objective).toMatchObject({
      routeKey: "mara-ada-lead",
      progress: {
        completed: 6,
        total: 6,
      },
    });
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: false,
      label: "Objective complete",
      stepKind: "idle",
    });
    expectCognitionToMirrorAutonomy(world);
  });

  it("surfaces explicit talk and reflection phases in Rowan's inner loop", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-rowan-loop-phases");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      layer: "objective",
      npcId: "npc-mara",
      stepKind: "talk",
    });
    expect(world.rowanAutonomy.effects).toEqual(["conversation"]);
    expectCognitionToMirrorAutonomy(world);

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "I need to keep my room here, and I need to know what it takes.",
    });

    expect(world.rowanAutonomy).toMatchObject({
      layer: "conversation",
      npcId: "npc-mara",
      stepKind: "reflect",
    });
    expect(world.rowanAutonomy.effects).toContain("objective");
    expectCognitionToMirrorAutonomy(world);
  });

  it("turns Morrow House standing into an executable house-chore beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-morrow-standing");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "What do I need to do to keep a room here?",
    });
    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Build standing at Morrow House so the room stays mine.",
    });

    expect(
      world.availableActions.find(
        (action) => action.id === "contribute:boarding-house",
      ),
    ).toMatchObject({
      kind: "contribute",
      label: "Handle house chores",
    });
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "contribute:boarding-house",
      autoContinue: true,
      layer: "objective",
      stepKind: "wait",
      targetLocationId: "boarding-house",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.reputation.morrow_house).toBeGreaterThanOrEqual(2);
    expect(world.player.objective?.progress.completed).toBeGreaterThan(0);
    expect(
      world.availableActions.find(
        (action) => action.id === "contribute:boarding-house",
      ),
    ).toBeUndefined();
  });

  it("keeps Mara's first Ada lead on the work track instead of collapsing back to settle", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-settle-work-lead");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Get settled in Brackenport: lock in a room, steady income, and a few real friends.",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.player.objective).toMatchObject({
      focus: "work",
      routeKey: "work-tea",
    });
    expect(world.player.objective?.trail.find((step) => !step.done)?.id).toBe(
      "work-lead-tea",
    );
  });

  it("follows a named social handoff instead of reopening the current thread", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-social-handoff");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Meet people and make the rounds.",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 1,
      silent: true,
    });

    expect(world.player.objective?.routeKey).toBe("people-npc-ada");
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      npcId: "npc-ada",
      targetLocationId: "tea-house",
    });
    expectCognitionToMirrorAutonomy(world);

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.activeConversation?.npcId).toBe("npc-ada");
  });

  it("starts exploration by moving Rowan into the new corner before talking", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-explore-route");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Explore the district and get your bearings.",
    });

    expect(world.player.objective?.routeKey).toBe("explore-tea-house");
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy.npcId).toBeUndefined();
    expectCognitionToMirrorAutonomy(world);

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      npcId: "npc-ada",
      targetLocationId: "tea-house",
    });
  });

  it("routes a wrench objective to Jo instead of reopening Mara", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tool-route");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "If I help with the pump, what do I need?",
    });
    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 1,
      silent: true,
    });

    expect(world.player.objective?.routeKey).toBe("tool-pump");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "buy:item-wrench",
      autoContinue: true,
      mode: "moving",
      targetLocationId: "repair-stall",
    });
    expect(world.rowanAutonomy.npcId).toBeUndefined();
    expectCognitionToMirrorAutonomy(world);

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.currentLocationId).toBe("repair-stall");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "buy:item-wrench",
      autoContinue: true,
      mode: "acting",
      targetLocationId: "repair-stall",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(
      world.player.inventory.some((item) => item.id === "item-wrench"),
    ).toBe(true);
  });

  it("lets objective pursuit carry through a pre-start shift without manual waiting", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-objective-work");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (world.jobs.find((job) => job.id === "job-tea-shift")?.completed) {
        break;
      }
      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
    }

    expect(
      world.jobs.find((job) => job.id === "job-tea-shift")?.completed,
    ).toBe(true);
    expect(world.player.money).toBeGreaterThan(12);
    expect(world.clock.hour + world.clock.minute / 60).toBeGreaterThanOrEqual(
      13,
    );
    expect(world.clock.label).toBe("Afternoon");
    expect(world.player.objective).toMatchObject({
      focus: "settle",
      routeKey: "first-afternoon",
    });
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "boarding-house",
    });
  });

  it("keeps the autonomous Rowan loop moving through the first work handoff", async () => {
    const result = await runRowanLoopSmoke({
      gameId: "game-rowan-loop-smoke",
    });
    const teaShift = result.finalWorld.jobs.find(
      (job) => job.id === "job-tea-shift",
    );

    expect(teaShift).toMatchObject({
      completed: true,
      discovered: true,
    });
    expect(result.finalWorld.clock).toMatchObject({
      hour: 15,
      label: "Afternoon",
    });
    expect(result.finalWorld.player.currentLocationId).toBe("boarding-house");
    expect(result.finalWorld.firstAfternoon?.completedAt).toBeDefined();
    expect(result.finalWorld.firstAfternoon?.fieldNote).toMatchObject({
      evidence: expect.stringContaining("Kettle & Lamp"),
      learned: expect.stringContaining("Ada"),
    });
    expect(result.finalWorld.firstAfternoon?.leadFieldNote).toMatchObject({
      evidence: expect.stringContaining("Asked Ada at Kettle & Lamp"),
      learned: expect.stringContaining("Mara's Kettle & Lamp lead is real"),
    });
    expect(
      result.finalWorld.cityEvents.find(
        (event) => event.id === "event-lunch-rush",
      ),
    ).toMatchObject({
      progress: "paid",
      status: "resolved",
    });
    expect(result.finalWorld.player.currentThought).toContain(
      "Tonight's bed holds",
    );
    expect(result.finalWorld.player.objective).toMatchObject({
      routeKey: "first-afternoon",
      progress: {
        completed: 8,
        total: 8,
      },
    });
    expect(result.finalWorld.rowanAutonomy).toMatchObject({
      autoContinue: false,
      label: "First afternoon complete",
      stepKind: "idle",
    });
    expect(result.trace.map((entry) => entry.activeConversation)).toContain(
      "npc-ada",
    );
  });
});
