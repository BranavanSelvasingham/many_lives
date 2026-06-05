import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import type {
  StreetAutonomousLineRequest,
  StreetConversationInterpretationRequest,
  StreetPlanningRequest,
  StreetPlanningResult,
} from "../src/ai/provider.js";
import type { StreetDialogueRequest } from "../src/ai/streetDialogue.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { buildRowanCognition } from "../src/sim/rowanCognition.js";
import { runRowanLoopSmoke } from "../src/sim/rowanLoopSmoke.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";
import {
  enterMorrowHouse,
  enterRepairStall,
  enterTeaHouse,
  exitToStreet,
} from "./street-test-helpers.js";

class PlanningAIProvider extends MockAIProvider {
  override readonly name = "openai";
  readonly requests: StreetPlanningRequest[] = [];

  constructor(private readonly result: StreetPlanningResult | null) {
    super();
  }

  override async planStreetNextAction(input: StreetPlanningRequest) {
    this.requests.push(input);
    if (!this.result?.actionId || this.result.planKey) {
      return this.result;
    }

    const matchingAllowedActions = input.allowedActions.filter(
      (action) => action.actionId === this.result?.actionId,
    );
    if (matchingAllowedActions.length !== 1) {
      return this.result;
    }

    return {
      ...this.result,
      planKey: matchingAllowedActions[0].planKey,
    };
  }
}

class LiveDialogueAIProvider extends MockAIProvider {
  override readonly name = "openai";
  override readonly model = "test-live-dialogue";
  readonly autonomousLineRequests: StreetAutonomousLineRequest[] = [];
  readonly replyRequests: StreetDialogueRequest[] = [];

  override async generateStreetAutonomousLine(
    input: StreetAutonomousLineRequest,
  ) {
    this.autonomousLineRequests.push(input);
    return {
      speech: `Live ${input.npcId} ${input.purpose} line.`,
    };
  }

  override async generateStreetReply(input: StreetDialogueRequest) {
    this.replyRequests.push(input);
    const npcName =
      input.game.npcs.find((npc) => npc.id === input.npcId)?.name ?? "Someone";
    if (input.npcId === "npc-mara") {
      return {
        followupThought: "Mara is grounding the live lead.",
        reply:
          "Mara live reply for Rowan. Ask Ada at Kettle & Lamp before lunch work fills the room.",
      };
    }
    if (input.npcId === "npc-ada") {
      return {
        followupThought: "Ada is making the shift concrete.",
        reply:
          "Ada live reply for Rowan. Lunch needs steady hands at Kettle & Lamp and pays fourteen.",
      };
    }
    return {
      followupThought: `${npcName} is responding through the live provider.`,
      reply: `${npcName} live reply for Rowan.`,
    };
  }
}

class VagueMaraLiveAIProvider extends LiveDialogueAIProvider {
  readonly interpretationRequests: StreetConversationInterpretationRequest[] = [];

  override async generateStreetReply(input: StreetDialogueRequest) {
    this.replyRequests.push(input);
    if (input.npcId === "npc-mara") {
      return {
        followupThought: "Mara is being too vague.",
        reply:
          "The room can hold tonight. We will check you in properly when the evening settles.",
      };
    }

    return super.generateStreetReply(input);
  }

  override async interpretStreetConversation(
    input: StreetConversationInterpretationRequest,
  ) {
    this.interpretationRequests.push(input);
    if (input.npcId === "npc-mara") {
      return {
        decision:
          "get to Kettle & Lamp before lunch gets busy and ask Ada for work.",
        memoryKind: "job" as const,
        memoryText:
          "Mara trusts follow-through more than worry, and Ada is the nearest honest place to start.",
        objectiveText: "Get to Kettle & Lamp and ask Ada for work.",
        summary: "Mara pointed Rowan to Ada's lunch work.",
      };
    }

    return super.interpretStreetConversation(input);
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

async function advanceUntil(
  engine: SimulationEngine,
  world: StreetGameState,
  predicate: (world: StreetGameState) => boolean,
  maxSteps = 12,
) {
  let nextWorld = world;
  for (let step = 0; step < maxSteps && !predicate(nextWorld); step += 1) {
    nextWorld = await engine.runCommand(nextWorld, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
  }
  return nextWorld;
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
    world = await enterTeaHouse(engine, world);
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
    const completedTeaJob = world.jobs.find(
      (job) => job.id === "job-tea-shift",
    );
    expect(completedTeaJob).toMatchObject({
      completed: true,
      missed: false,
    });
    expect(completedTeaJob).not.toHaveProperty("consequenceAppliedAt");
    expect(completedTeaJob).not.toHaveProperty("missedAt");
    expect(world.player.money).toBeGreaterThan(12);
    expect(world.player.memories.map((entry) => entry.text)).not.toContain(
      "You missed Ada's lunch window, so that paid foothold is no longer waiting.",
    );
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
    world = await enterTeaHouse(engine, world);
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
    expect(world.player).toMatchObject({
      spaceId: "interior:tea-house",
      x: 8,
      y: 3,
    });
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
    expect(world.player).toMatchObject({
      spaceId: "interior:tea-house",
      x: 7,
      y: 5,
    });
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
    expect(world.player).toMatchObject({
      spaceId: "interior:tea-house",
      x: 8,
      y: 3,
    });
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

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await enterRepairStall(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "buy:item-wrench",
    });
    world = await exitToStreet(engine, world);
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

  it("lets objective pursuit enter the room and open the planned conversation", async () => {
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
    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

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
    world = await enterMorrowHouse(engine, world);

    expect(world.rowanAutonomy.autoContinue).toBe(true);
    expect(world.rowanAutonomy.npcId).toBe("npc-mara");
    expect(world.rowanAutonomy.targetLocationId).toBe("boarding-house");
    expectCognitionToMirrorAutonomy(world);

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

    expect(world.activeConversation?.npcId).toBe("npc-mara");
  });

  it("keeps the first-afternoon rail copy player-facing", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-first-afternoon-copy");

    expect(world.rowanAutonomy).toMatchObject({
      actionId: "enter:boarding-house",
      autoContinue: true,
      label: "Enter Morrow House",
      stepKind: "act",
      targetLocationId: "boarding-house",
    });
    expect(world.rowanAutonomy.detail).toContain(
      "steps inside before acting",
    );
    expect(world.rowanAutonomy.intent).toMatchObject({
      reason:
        "Rowan is at Morrow House, so stepping inside is the useful next move.",
      signals: expect.arrayContaining([
        "Here: Morrow House",
        "Action: Enter Morrow House",
      ]),
    });
    expect(world.rowanAutonomy.intent?.reason).not.toMatch(
      /fits the current objective|current objective|belongs here/i,
    );
    expect(world.rowanAutonomy.detail).not.toMatch(
      /prompt|context is specific|clear enough/i,
    );
    expect(world.rowanAutonomy.detail).not.toMatch(/This step is ready now/i);
  });

  it("opens the first afternoon with room talk before the work lead", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-first-afternoon-opening");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

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

  it("describes the Ada lead as a street route from Morrow House", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-ada-route-copy");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );
    world = await advanceUntil(
      engine,
      world,
      (nextWorld) =>
        !nextWorld.activeConversation &&
        nextWorld.rowanAutonomy.actionId === "reflect:first-afternoon-plan",
      12,
    );

    const commitmentCopy = [
      world.rowanAutonomy.label,
      world.rowanAutonomy.detail,
      world.rowanAutonomy.intent?.reason,
      ...(world.rowanAutonomy.intent?.signals ?? []),
    ].join(" ");

    expect(commitmentCopy).toMatch(/Kettle & Lamp|street route|Ada/i);
    expect(commitmentCopy).not.toMatch(/Ask Ada.*at Morrow House/i);
    expect(commitmentCopy).not.toMatch(/Ada(?:'s)?[^.\n]{0,100}at Morrow House/i);
    expect(commitmentCopy).not.toMatch(/Ada work at Morrow House/i);

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) =>
        !nextWorld.activeConversation &&
        nextWorld.rowanAutonomy.targetLocationId === "tea-house",
      12,
    );

    const routeCopy = [
      world.rowanAutonomy.label,
      world.rowanAutonomy.detail,
      world.rowanAutonomy.intent?.reason,
      ...(world.rowanAutonomy.intent?.signals ?? []),
    ].join(" ");

    expect(routeCopy).toMatch(/Kettle & Lamp|street route|Ada/i);
    expect(routeCopy).not.toMatch(/Ask Ada.*at Morrow House/i);
    expect(routeCopy).not.toMatch(/Ada(?:'s)?[^.\n]{0,100}at Morrow House/i);
    expect(routeCopy).not.toMatch(/Ada work at Morrow House/i);
  });

  it("attempts live OpenAI-mode dialogue for first Mara and Ada conversations", async () => {
    const provider = new LiveDialogueAIProvider();
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-live-first-dialogue");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
      10,
    );

    expect(
      provider.autonomousLineRequests.some(
        (request) =>
          request.npcId === "npc-mara" && request.purpose === "opener",
      ),
    ).toBe(true);
    expect(
      provider.replyRequests.some((request) => request.npcId === "npc-mara"),
    ).toBe(true);
    expect(
      world.activeConversation?.lines.find((line) => line.speaker === "player")
        ?.text,
    ).toContain("Live npc-mara opener line.");
    expect(
      world.activeConversation?.lines.find((line) => line.speaker === "npc")
        ?.text,
    ).toContain("Mara live reply for Rowan.");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-ada",
      24,
    );

    expect(world.activeConversation?.npcId).toBe("npc-ada");
    expect(
      provider.autonomousLineRequests.some(
        (request) =>
          request.npcId === "npc-ada" && request.purpose === "opener",
      ),
    ).toBe(true);
    expect(
      provider.replyRequests.some((request) => request.npcId === "npc-ada"),
    ).toBe(true);
    expect(
      world.activeConversation?.lines.find((line) => line.speaker === "player")
        ?.text,
    ).toContain("Live npc-ada opener line.");
    expect(
      world.activeConversation?.lines.find((line) => line.speaker === "npc")
        ?.text,
    ).toContain("Ada live reply for Rowan.");
  });

  it("does not let vague Mara dialogue invisibly unlock the Ada lead", async () => {
    const provider = new VagueMaraLiveAIProvider();
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-vague-mara-evidence-gate");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
      10,
    );

    const maraLine = world.activeConversation?.lines.find(
      (line) => line.speaker === "npc",
    )?.text;
    expect(maraLine).toMatch(/Ada|Kettle & Lamp|lunch|work|shift/i);
    expect(world.aiRuntime?.totalFallbacks).toBeGreaterThan(0);
    expect(world.aiRuntime?.fallbackReasons.join(" ")).toMatch(
      /Ada lead/i,
    );

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) =>
        !nextWorld.activeConversation &&
        nextWorld.rowanAutonomy.targetLocationId === "tea-house",
      12,
    );

    const copy = [
      world.rowanAutonomy.label,
      world.rowanAutonomy.detail,
      world.rowanAutonomy.intent?.reason,
    ].join(" ");
    expect(copy).toMatch(/Ada|Kettle & Lamp|lunch|work/i);
    expect(provider.interpretationRequests.length).toBeGreaterThan(0);
  });

  it("lets an OpenAI planner choose a validated objective action", async () => {
    const provider = new PlanningAIProvider({
      actionId: "talk:npc-mara",
      confidence: 0.91,
      rationale: "Rowan should ask Mara what the room actually costs.",
    });
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-ai-planner-valid");
    world = await enterMorrowHouse(engine, world);

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
      "talk:npc-mara",
    );
    expect(
      provider.requests[0].allowedActions.every((action) => action.planKey),
    ).toBe(true);
    expect(new Set(provider.requests[0].allowedActions.map((action) => action.planKey)).size).toBe(
      provider.requests[0].allowedActions.length,
    );
    expect(
      provider.requests[0].allowedActions.find(
        (action) => action.actionId === "talk:npc-mara",
      ),
    ).toMatchObject({
      matchedOutcomeId: expect.any(String),
      planKey: expect.any(String),
      pressureKind: expect.any(String),
    });
    expect(provider.requests[0].allowedActions.map((action) => action.actionId)).not.toContain(
      "rest:home",
    );
    expect(provider.requests[0].desiredOutcomes.map((outcome) => outcome.id)).toEqual(
      expect.arrayContaining(["shelter-stability", "income"]),
    );
    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.rowanAutonomy).toMatchObject({
      npcId: "npc-mara",
      targetLocationId: "boarding-house",
    });
  });

  it("exposes travel-first plans to the planner as move actions", async () => {
    const provider = new PlanningAIProvider({
      actionId: "move:tea-house",
      confidence: 0.92,
      rationale: "The work lead is elsewhere, so Rowan should walk there first.",
    });
    const engine = new SimulationEngine(provider);
    let world = await engine.createGame("game-ai-planner-travel-first");

    for (let step = 0; step < 5; step += 1) {
      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: false,
      });
    }

    expect(provider.requests.length).toBeGreaterThan(0);
    const badTravelActions = provider.requests.flatMap((request) =>
      request.allowedActions.filter(
        (action) =>
          action.targetLocationId &&
          action.targetLocationId !== request.game.player.currentLocationId &&
          action.actionId !== `move:${action.targetLocationId}` &&
          action.kind !== "enter" &&
          action.kind !== "exit",
      ),
    );
    expect(badTravelActions).toEqual([]);
    expect(
      provider.requests.some((request) =>
        request.allowedActions.some(
          (action) =>
            action.actionId === "move:tea-house" ||
            action.actionId === "exit:boarding-house",
        ),
      ),
    ).toBe(true);
    if (world.rowanAutonomy.stepKind === "move") {
      expect(world.rowanAutonomy.actionId).toBe(
        `move:${world.rowanAutonomy.targetLocationId}`,
      );
    }
  });

  it("does not let the live planner skip required first-afternoon predicate actions", async () => {
    const setupEngine = new SimulationEngine(new MockAIProvider());
    let world = await setupEngine.createGame("game-ai-planner-predicate-action");

    world = await advanceUntil(
      setupEngine,
      world,
      (nextWorld) =>
        nextWorld.rowanAutonomy.actionId === "reflect:first-afternoon-plan",
    );

    expect(world.firstAfternoon?.planSettledAt).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      targetLocationId: "boarding-house",
    });

    const provider = new PlanningAIProvider({
      actionId: "reflect:first-afternoon-pump",
      confidence: 0.96,
      rationale: "Try to take the pump fork before the Ada plan is committed.",
    });
    const liveEngine = new SimulationEngine(provider);

    world = await liveEngine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    const plannerRequest = provider.requests[provider.requests.length - 1];
    const allowedActionIds =
      plannerRequest?.allowedActions.map((action) => action.actionId) ?? [];
    expect(allowedActionIds).toContain("reflect:first-afternoon-plan");
    expect(allowedActionIds).not.toContain("move:tea-house");
    expect(allowedActionIds).not.toContain("reflect:first-afternoon-pump");
    expect(world.firstAfternoon?.planSettledAt).toBeDefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "exit:boarding-house",
      targetLocationId: "tea-house",
    });
  });

  it("keeps the live planner on Ada after the first-afternoon plan is selected", async () => {
    const setupEngine = new SimulationEngine(new MockAIProvider());
    let world = await setupEngine.createGame("game-ai-planner-ada-plan");

    world = await advanceUntil(
      setupEngine,
      world,
      (nextWorld) =>
        nextWorld.rowanAutonomy.actionId === "reflect:first-afternoon-plan",
    );
    world = await setupEngine.runCommand(world, {
      type: "act",
      actionId: "reflect:first-afternoon-plan",
    });

    expect(world.firstAfternoon?.planSettledAt).toBeDefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "exit:boarding-house",
      targetLocationId: "tea-house",
    });

    const provider = new PlanningAIProvider({
      actionId: "move:repair-stall",
      confidence: 0.98,
      rationale: "Try to route to repairs instead of verifying Ada's lead.",
    });
    const liveEngine = new SimulationEngine(provider);

    world = await liveEngine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    const plannerRequest = provider.requests[provider.requests.length - 1];
    const allowedActionIds =
      plannerRequest?.allowedActions.map((action) => action.actionId) ?? [];
    expect(allowedActionIds).toContain("exit:boarding-house");
    expect(allowedActionIds).not.toContain("move:repair-stall");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "move:tea-house",
      targetLocationId: "tea-house",
    });
  });

  it("does not expose stale Ada talk to the live planner after the paid shift", async () => {
    const setupEngine = new SimulationEngine(new MockAIProvider());
    let world = await setupEngine.createGame("game-ai-planner-post-shift-home");

    for (let step = 0; step < 14; step += 1) {
      const teaShift = world.jobs.find((job) => job.id === "job-tea-shift");
      if (
        teaShift?.completed &&
        world.player.currentLocationId === "tea-house" &&
        world.rowanAutonomy.targetLocationId === "boarding-house"
      ) {
        break;
      }

      world = await setupEngine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
    }

    expect(world.jobs.find((job) => job.id === "job-tea-shift")).toMatchObject({
      completed: true,
    });
    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.firstAfternoon?.completedAt).toBeUndefined();
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "exit:tea-house",
      targetLocationId: "boarding-house",
    });
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.escalationLevel = 2;
      pump.status = "active";
      pump.urgency = 5;
    }

    const provider = new PlanningAIProvider({
      actionId: "talk:npc-ada",
      confidence: 0.97,
      rationale: "Try to reopen Ada instead of landing the afternoon.",
    });
    const liveEngine = new SimulationEngine(provider);

    world = await liveEngine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    const plannerRequest = provider.requests[provider.requests.length - 1];
    const allowedActionIds =
      plannerRequest?.allowedActions.map((action) => action.actionId) ?? [];
    expect(allowedActionIds).toContain("exit:tea-house");
    expect(allowedActionIds).not.toContain("talk:npc-ada");
    expect(allowedActionIds).not.toContain("move:courtyard");
    expect(world.activeConversation?.npcId).not.toBe("npc-ada");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "move:boarding-house",
      mode: "moving",
      targetLocationId: "boarding-house",
    });
  });

  it("blocks immediate shift acceptance when Rowan is too drained to work", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-low-energy-shift-accept");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await enterTeaHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 125,
      silent: true,
    });
    world.player.energy = 18;
    world.activeConversation = undefined;
    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    expect(world.availableActions.find(
      (action) => action.id === "accept:job-tea-shift",
    )).toMatchObject({
      disabled: true,
      disabledReason: "You are too drained for work that starts now.",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });

    expect(world.jobs.find((job) => job.id === "job-tea-shift")).toMatchObject({
      accepted: false,
    });
    expect(world.feed.map((entry) => entry.text)).toContain(
      "You are too drained for work that starts now.",
    );
  });

  it("routes first-afternoon low-energy recovery home instead of reopening Ada", async () => {
    const setupEngine = new SimulationEngine(new MockAIProvider());
    let world = await setupEngine.createGame("game-low-energy-recovery-plan");

    world = await advanceUntil(
      setupEngine,
      world,
      (nextWorld) => Boolean(nextWorld.firstAfternoon?.planSettledAt),
    );
    expect(world.firstAfternoon?.planSettledAt).toBeDefined();

    world = await setupEngine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await enterTeaHouse(setupEngine, world);
    world = await setupEngine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await setupEngine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });
    world = await setupEngine.runCommand(world, {
      type: "wait",
      minutes: 125,
      silent: true,
    });
    world.player.energy = 18;
    world.activeConversation = undefined;
    world = await setupEngine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    const provider = new PlanningAIProvider({
      actionId: "talk:npc-ada",
      confidence: 0.97,
      rationale: "Try to keep talking instead of recovering.",
    });
    const liveEngine = new SimulationEngine(provider);

    world = await liveEngine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    const plannerRequest = provider.requests[provider.requests.length - 1];
    const allowedActionIds =
      plannerRequest?.allowedActions.map((action) => action.actionId) ?? [];
    if (plannerRequest) {
      expect(allowedActionIds).toContain("exit:tea-house");
      expect(allowedActionIds).not.toEqual(
        expect.arrayContaining([
          "accept:job-tea-shift",
          "reflect:first-afternoon-compare",
          "talk:npc-ada",
        ]),
      );
    }
    expect(world.activeConversation?.npcId).not.toBe("npc-ada");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "move:boarding-house",
      mode: "moving",
      targetLocationId: "boarding-house",
    });
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
    expect(world.activeSpaceId).toBe("interior:boarding-house");
    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy.npcId).toBe("npc-mara");
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
    expect(world.activeSpaceId).toBe("interior:boarding-house");
    expect(world.activeConversation).toBeUndefined();
    expect(world.rowanAutonomy.npcId).toBe("npc-mara");
  });

  it("keeps no-OpenAI objective advance deterministic", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-no-ai-planner");

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.activeConversation?.lines.find((line) => line.speaker === "player")?.text).toMatch(
      /room|Morrow House|tonight/i,
    );
  });

  it("ignores a stale trail target when live state exposes the right opening action", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-stale-trail-vs-live-opening");

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      trail: [
        {
          id: "stale-ada-route",
          title: "Ask Ada before checking the room.",
          detail:
            "This stale route hint points away from the live legal opener.",
          done: false,
          npcId: "npc-ada",
          targetLocationId: "tea-house",
        },
        ...((world.player.objective as PlayerObjective).trail ?? []),
      ],
    };

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(
      world.activeConversation?.lines.find((line) => line.speaker === "player")
        ?.text,
    ).toMatch(/room|Morrow House|tonight/i);
  });

  it("exposes the first afternoon as competing live choices with a planner trace", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-first-afternoon-live-fork");

    world = await enterMorrowHouse(engine, world);
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
      selectedPlanKey: expect.any(String),
      selectedPressureKind: expect.any(String),
      selectedTargetLocationId: expect.any(String),
    });
    expect(
      world.rowanAutonomy.planningTrace?.considered.every((option) => option.planKey),
    ).toBe(true);
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
    expect(
      world.rowanAutonomy.planningTrace?.considered.find(
        (option) => option.status === "selected",
      ),
    ).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      matchedOutcomeId: "first-afternoon-choose-move",
      planKey: world.rowanAutonomy.planningTrace?.selectedPlanKey,
      pressureKind: "predicate",
    });
  });

  it("branches the same seeded objective through generic live pressure", async () => {
    const buildPostMaraWorld = async (gameId: string) => {
      const engine = new SimulationEngine(new MockAIProvider());
      let world = await engine.createGame(gameId);

      world = await enterMorrowHouse(engine, world);
      world = await engine.runCommand(world, {
        type: "act",
        actionId: "talk:npc-mara",
      });

      return { engine, world };
    };

    const predicateSetup = await buildPostMaraWorld(
      "game-pressure-branch-predicate",
    );
    let predicateWorld = await predicateSetup.engine.runCommand(
      predicateSetup.world,
      {
        type: "advance_objective",
        allowTimeSkip: false,
      },
    );
    expect(
      predicateWorld.rowanAutonomy.planningTrace?.considered.find(
        (option) => option.status === "selected",
      ),
    ).toMatchObject({
      actionId: "reflect:first-afternoon-plan",
      matchedOutcomeId: "first-afternoon-choose-move",
      pressureKind: "predicate",
    });

    const recoverySetup = await buildPostMaraWorld("game-pressure-branch-energy");
    recoverySetup.world.player.energy = 18;
    recoverySetup.world.activeConversation = undefined;
    let recoveryWorld = await recoverySetup.engine.runCommand(
      recoverySetup.world,
      {
        type: "advance_objective",
        allowTimeSkip: false,
      },
    );
    expect(
      recoveryWorld.rowanAutonomy.planningTrace?.considered.find(
        (option) => option.status === "selected",
      ),
    ).toMatchObject({
      actionId: "rest:home",
      pressureId: "energy:recover",
      pressureKind: "energy",
    });

    const toolSetup = await buildPostMaraWorld("game-pressure-branch-tool");
    const pump = toolSetup.world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
    toolSetup.world.player.money = 26;
    toolSetup.world.player.energy = 60;
    toolSetup.world.player.knownLocationIds = [
      ...new Set([
        ...toolSetup.world.player.knownLocationIds,
        "repair-stall",
      ]),
    ];
    toolSetup.world.player.knownNpcIds = [
      ...new Set([...toolSetup.world.player.knownNpcIds, "npc-jo"]),
    ];
    toolSetup.world.activeConversation = undefined;
    if (pump) {
      pump.discovered = true;
      pump.escalationLevel = 2;
      pump.status = "active";
      pump.urgency = 5;
    }

    const toolWorld = await toolSetup.engine.runCommand(toolSetup.world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });
    const selectedToolOption =
      toolWorld.rowanAutonomy.planningTrace?.considered.find(
        (option) => option.status === "selected",
      );
    expect(selectedToolOption).toMatchObject({
      pressureKind: "tool",
      pressureId: "tool:item-wrench:problem-pump",
      targetLocationId: "repair-stall",
    });
    expect(toolWorld.rowanAutonomy.targetLocationId).toBe("repair-stall");
  });

  it("projects destination follow-up steps without executing them before arrival", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-short-horizon-destination-trace");

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
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
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      stepKind: "move",
      targetLocationId: "tea-house",
    });

    const nextSteps = world.rowanAutonomy.planningTrace?.nextSteps ?? [];
    expect(nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "move",
          targetLocationId: "tea-house",
        }),
        expect.objectContaining({
          actionId: "talk:npc-ada",
          kind: "talk",
          legal: true,
          npcId: "npc-ada",
          targetLocationId: "tea-house",
        }),
      ]),
    );
    expect(
      nextSteps.some((step) =>
        step.validation.includes("fresh simulator validation"),
      ),
    ).toBe(true);
    expect(world.activeConversation?.npcId).not.toBe("npc-ada");
    expectCognitionToMirrorAutonomy(world);
  });

  it("keeps Ada's verified offer as a fork instead of forcing immediate acceptance", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-post-ada-fork");

    world = await enterMorrowHouse(engine, world);
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
    world = await enterTeaHouse(engine, world);
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
    world = await enterMorrowHouse(engine, world);
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
    expect(world.clock.totalMinutes).toBe(startMinutes + 62);
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

  it("lets escalated live pressure redirect a stale home route to a legal tool plan", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-agent-pressure-over-home-route");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");

    world.player.x = 6;
    world.player.y = 4;
    world.player.currentLocationId = "tea-house";
    world.player.money = 26;
    world.player.energy = 60;
    world.player.knownLocationIds = [
      ...new Set([
        ...world.player.knownLocationIds,
        "tea-house",
        "repair-stall",
      ]),
    ];
    world.player.knownNpcIds = [
      ...new Set([...world.player.knownNpcIds, "npc-jo"]),
    ];
    world.firstAfternoon = {
      leadFieldNote: {
        createdAt: world.currentTime,
        evidence: "Ada already confirmed the work and Rowan completed it.",
        learned: "The cafe work lead is no longer the open question.",
        memory: "Ada has already seen Rowan follow through.",
        next: "Take stock unless live pressure changes the plan.",
      },
      planSettledAt: world.currentTime,
      teaShiftStage: "paid",
    };
    world.conversations.push({
      id: "conversation-ada-pressure-test",
      locationId: "tea-house",
      npcId: "npc-ada",
      speaker: "player",
      speakerName: "Rowan",
      text: "I finished the shift. I need to decide what matters now.",
      threadId: "thread-ada-pressure-test",
      time: world.currentTime,
    });
    if (teaJob) {
      teaJob.discovered = true;
      teaJob.accepted = true;
      teaJob.completed = true;
    }
    if (pump) {
      pump.discovered = true;
      pump.escalatedAt = world.currentTime;
      pump.escalationLevel = 2;
      pump.status = "active";
      pump.urgency = 5;
    }
    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "settle",
      outcomes: [],
      progress: {
        completed: 0,
        label: "0/1 checked off",
        total: 1,
      },
      routeKey: "first-afternoon",
      source: "manual",
      text: "Return to Morrow House and take stock.",
      trail: [
        {
          id: "stale-home-route",
          title: "Go home and ignore the pump pressure.",
          done: false,
          actionId: "reflect:first-afternoon",
          targetLocationId: "boarding-house",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    expect(world.rowanAutonomy).toMatchObject({
      actionId: "move:repair-stall",
      autoContinue: true,
      layer: "objective",
      targetLocationId: "repair-stall",
    });
    expect(world.rowanAutonomy.detail).toContain("escalating");
    expect(world.rowanAutonomy.planningTrace).toMatchObject({
      selectedActionId: "move:repair-stall",
      selectedPlanKey: expect.any(String),
      selectedPressureId: expect.stringMatching(/^tool:/),
      selectedLabel: "Head to Mercer Repairs",
      selectedTargetLocationId: "repair-stall",
    });
    const nextSteps = world.rowanAutonomy.planningTrace?.nextSteps ?? [];
    expect(nextSteps.length).toBeGreaterThanOrEqual(3);
    expect(nextSteps.every((step) => step.legal)).toBe(true);
    expect(nextSteps.map((step) => step.actionId)).toEqual(
      expect.arrayContaining(["buy:item-wrench", "solve:problem-pump"]),
    );
    expect(nextSteps.map((step) => step.targetLocationId)).toEqual(
      expect.arrayContaining(["repair-stall", "courtyard"]),
    );
    expect(
      nextSteps.some((step) =>
        step.validation.includes("simulator must validate"),
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) => option.targetLocationId === "boarding-house",
      ),
    ).toBe(true);

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.pendingObjectiveMove).toMatchObject({
      actionId: "move:repair-stall",
      targetLocationId: "repair-stall",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.player.currentLocationId).toBe("repair-stall");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "enter:repair-stall",
      autoContinue: true,
      targetLocationId: "repair-stall",
    });

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

    expect(world.activeSpaceId).toBe("interior:repair-stall");
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "buy:item-wrench",
      autoContinue: true,
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
          id: "pump-solved",
          status: "met",
        }),
      ]),
    );
  });

  it("lets Rowan resolve a manual conversation into a concrete next beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-manual-conversation-loop");

    world = await enterMorrowHouse(engine, world);
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

    world = await enterMorrowHouse(engine, world);
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

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );
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
      stepKind: "act",
      targetLocationId: "tea-house",
    });

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-ada",
    );
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

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) =>
        nextWorld.rowanAutonomy.actionId === "reflect:first-afternoon-plan",
    );

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
      mode: "acting",
      targetLocationId: "tea-house",
    });

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-ada",
    );

    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.activeConversation?.npcId).toBe("npc-ada");
  });

  it("lets advance objective leave an unresolved conversation on the next concrete beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-live-conversation-advance");

    world = await enterMorrowHouse(engine, world);
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

    world = await enterMorrowHouse(engine, world);
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
    world = await enterTeaHouse(engine, world);
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

    world = await enterMorrowHouse(engine, world);
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

  it("closes Ada's missed lunch option and redirects to a live yard lead", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-ada-closes-missed-lunch");

    world = await engine.tick(world, 9);
    expect(
      world.jobs.find((job) => job.id === "job-tea-shift")?.missed,
    ).toBe(true);

    const teaHouse = world.locations.find((location) => location.id === "tea-house");
    expect(teaHouse).toBeDefined();
    if (!teaHouse) {
      return;
    }

    world = await engine.runCommand(world, {
      type: "move_to",
      x: teaHouse.entryX,
      y: teaHouse.entryY,
    });
    world = await enterTeaHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-ada",
      text: "Do you still need work today?",
    });

    const adaReply = world.activeConversation?.lines
      .filter((line) => line.speaker === "npc")
      .at(-1)?.text;
    expect(adaReply).toMatch(/lunch already moved on|missed my useful window|cup-and-counter work is gone/i);
    expect(world.jobs.find((job) => job.id === "job-yard-shift")).toMatchObject({
      discovered: true,
      missed: false,
    });
    expect(world.activeConversation?.objectiveText).toBe(
      "See if Tomas still needs another set of hands in the yard.",
    );
    expect(world.activeConversation?.objectiveText).not.toMatch(
      /cup-and-counter|Kettle & Lamp/i,
    );
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "accept:job-tea-shift",
    );
    expectCognitionToMirrorAutonomy(world);
  });

  it("closes Tomas's missed yard option instead of reopening stale work", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tomas-closes-missed-yard");

    world = await engine.tick(world, 13);
    expect(
      world.jobs.find((job) => job.id === "job-yard-shift")?.missed,
    ).toBe(true);

    const freightYard = world.locations.find(
      (location) => location.id === "freight-yard",
    );
    expect(freightYard).toBeDefined();
    if (!freightYard) {
      return;
    }

    world = await engine.runCommand(world, {
      type: "move_to",
      x: freightYard.entryX,
      y: freightYard.entryY,
    });
    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-tomas",
      text: "Still need work in the yard?",
    });

    const tomasReply = world.activeConversation?.lines
      .filter((line) => line.speaker === "npc")
      .at(-1)?.text;
    expect(tomasReply).toMatch(/loading block already moved|too late|work is done/i);
    expect(world.activeConversation?.objectiveText).toBe(
      "Return to Morrow House and take stock.",
    );
    expect(world.activeConversation?.objectiveText).not.toMatch(
      /freight yard lift|loading shift|take the freight/i,
    );
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "accept:job-yard-shift",
    );
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

    for (let attempt = 0; attempt < 12; attempt += 1) {
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
      next: expect.stringContaining("Ada's offer is now a live choice"),
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
      actionId: "enter:boarding-house",
      autoContinue: true,
      layer: "objective",
      stepKind: "act",
    });

    world = await enterMorrowHouse(engine, world);

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

    world = await enterMorrowHouse(engine, world);
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
    expect(world.player.objective).toMatchObject({
      routeKey: "settle-core",
      outcomes: expect.arrayContaining([
        expect.objectContaining({
          actionId: "contribute:boarding-house",
          authority: "predicate",
          id: "settle-standing",
          targetLocationId: "boarding-house",
        }),
      ]),
    });
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "contribute:boarding-house",
      autoContinue: true,
      layer: "objective",
      stepKind: "wait",
      targetLocationId: "boarding-house",
    });

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

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
    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-mara",
    );

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
    world = await enterMorrowHouse(engine, world);
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
      actionId: "exit:boarding-house",
      autoContinue: true,
      mode: "acting",
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy.npcId).toBeUndefined();
    expectCognitionToMirrorAutonomy(world);

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.activeConversation?.npcId === "npc-ada",
    );

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
      actionId: "enter:tea-house",
      autoContinue: true,
      mode: "acting",
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy.npcId).toBeUndefined();
  });

  it("ignores a poisoned explore trail target when choosing the next place from live state", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-explore-poisoned-trail");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Explore the district and get your bearings.",
    });
    expect(world.player.objective?.routeKey).toBe("explore-tea-house");

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      routeKey: "explore-freight-yard",
      trail: [
        {
          id: "explore-go",
          title: "Ignore the nearest unknown place and walk to the freight yard.",
          detail:
            "This poisoned trail target should remain explanatory scaffolding, not planner authority.",
          done: false,
          targetLocationId: "freight-yard",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    expect(world.player.objective?.routeKey).toBe("explore-tea-house");
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy.targetLocationId).not.toBe("freight-yard");
    expectCognitionToMirrorAutonomy(world);
  });

  it("lets open objective predicate targets outrank poisoned route keys", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-predicate-target-over-route-key");

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "explore",
      outcomes: [
        {
          id: "predicate-tea-house-visit",
          label: "Stand in Kettle & Lamp and learn what opens there.",
          status: "open",
          urgency: 12,
          blockers: ["Rowan has not visited the live predicate target yet."],
          targetLocationId: "tea-house",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "explore-freight-yard",
      source: "manual",
      text: "Explore the district and get your bearings.",
      trail: [
        {
          id: "poisoned-route-key-step",
          title: "Follow the stale route key to the freight yard.",
          detail:
            "This route scaffold contradicts the open predicate target and should lose.",
          done: false,
          targetLocationId: "freight-yard",
        },
      ],
    };
    world.activeConversation = undefined;

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.player.pendingObjectiveMove).toMatchObject({
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "tea-house",
    });
    expect(world.rowanAutonomy.targetLocationId).not.toBe("freight-yard");
    expect(
      world.rowanAutonomy.planningTrace?.considered.some(
        (option) =>
          option.status === "selected" &&
          option.targetLocationId === "tea-house",
      ),
    ).toBe(true);
    expectCognitionToMirrorAutonomy(world);
  });

  it("prevents stale route-key scoring from outranking an explicit predicate target", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-predicate-target-over-work-route");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Verify Tomas's yard opening from current world state.",
    });
    world.activeConversation = undefined;
    world.conversations = [];
    world.conversationThreads = {};

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "work",
      outcomes: [
        {
          id: "predicate-yard-visit",
          label: "Reach North Crane Yard and verify the live yard opening.",
          status: "open",
          urgency: 1,
          blockers: ["The yard opening has not been verified from live state."],
          targetLocationId: "freight-yard",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "work-tea",
      source: "manual",
      text: "Verify Tomas's yard opening from current world state.",
      trail: [
        {
          id: "poisoned-work-tea-step",
          title: "Go to Kettle & Lamp instead.",
          detail:
            "This stale route key and trail hint contradict the explicit predicate target.",
          done: false,
          targetLocationId: "tea-house",
        },
      ],
    };
    world.activeConversation = undefined;

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.player.pendingObjectiveMove).toMatchObject({
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy.targetLocationId).not.toBe("tea-house");
    expect(
      world.rowanAutonomy.planningTrace?.considered.some(
        (option) =>
          option.status === "selected" &&
          option.targetLocationId === "freight-yard",
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) => option.targetLocationId === "tea-house",
      ),
    ).toBe(true);
    expectCognitionToMirrorAutonomy(world);
  });

  it("lets urgent discovered job windows outrank stale route hints", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-urgent-job-over-stale-route");
    const teaHouse = world.locations.find((location) => location.id === "tea-house");
    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");

    expect(teaHouse).toBeDefined();
    expect(yardJob).toBeDefined();
    if (!teaHouse || !yardJob) {
      return;
    }

    world.player.x = teaHouse.entryX;
    world.player.y = teaHouse.entryY;
    world.player.currentLocationId = teaHouse.id;
    world.player.knownLocationIds = [
      ...new Set([
        ...world.player.knownLocationIds,
        "tea-house",
        "freight-yard",
        "boarding-house",
      ]),
    ];
    world.clock.totalMinutes = 16 * 60 + 30;
    world.clock.hour = 16;
    world.clock.minute = 30;
    world.clock.label = "Afternoon";
    yardJob.discovered = true;
    world.activeConversation = undefined;

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "settle",
      outcomes: [
        {
          id: "stale-go-home",
          label: "Go home even though live work is closing.",
          status: "open",
          urgency: 8,
          authority: "predicate",
          blockers: ["This stale objective target should lose to live pressure."],
          targetLocationId: "boarding-house",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "first-afternoon",
      source: "manual",
      text: "Go home and take stock.",
      trail: [
        {
          id: "stale-home-route",
          title: "Go home and ignore the closing yard lift.",
          detail: "This stale route hint should not override live job pressure.",
          done: false,
          targetLocationId: "boarding-house",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.player.pendingObjectiveMove).toMatchObject({
      actionId: "move:freight-yard",
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "move:freight-yard",
      autoContinue: true,
      mode: "moving",
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy.targetLocationId).not.toBe("boarding-house");
    expect(
      world.rowanAutonomy.planningTrace?.considered.some(
        (option) =>
          option.status === "selected" &&
          option.actionId === "move:freight-yard" &&
          option.pressureId === "job:job-yard-shift" &&
          option.pressureKind === "job",
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.nextSteps.some(
        (step) => step.actionId === "accept:job-yard-shift",
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) => option.targetLocationId === "boarding-house",
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.outcomes.some(
        (outcome) => outcome.id === "job-window-job-yard-shift",
      ),
    ).toBe(true);
    expectCognitionToMirrorAutonomy(world);
  });

  it("rejects stale predicate actions when live world state makes them illegal", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-stale-predicate-action-rejected");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await enterTeaHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    world = await engine.tick(world, 10);

    expect(
      world.jobs.find((job) => job.id === "job-tea-shift")?.missed,
    ).toBe(true);

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "work",
      outcomes: [
        {
          id: "predicate-complete-tea-shift",
          label: "Complete Ada's cup-and-counter shift.",
          status: "open",
          urgency: 5,
          authority: "predicate",
          actionId: "work:job-tea-shift",
          blockers: ["The live job window may already be closed."],
          targetLocationId: "tea-house",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "work-tea",
      source: "manual",
      text: "Earn paid work at Kettle & Lamp.",
      trail: [
        {
          id: "stale-work-action",
          title: "Work Ada's shift even though the window passed.",
          detail:
            "This stale objective action should be audited against live legality.",
          done: false,
          actionId: "work:job-tea-shift",
          targetLocationId: "tea-house",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "work:job-tea-shift",
    );
    expect(world.rowanAutonomy.planningTrace?.selectedActionId).not.toBe(
      "work:job-tea-shift",
    );
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) =>
          option.actionId === "work:job-tea-shift" &&
          option.reason?.includes("no longer legal"),
      ),
    ).toBe(true);
  });

  it("rejects stale solve hints after an NPC resolves the problem first", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-npc-resolution-rejects-stale-solve");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 10,
      y: 7,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "inspect:problem-cart",
    });
    world = await engine.tick(world, 11);

    expect(world.problems.find((problem) => problem.id === "problem-cart")).toMatchObject({
      resolvedByNpcId: "npc-nia",
      status: "resolved",
    });

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "help",
      outcomes: [
        {
          id: "predicate-clear-cart",
          label: "Clear the jammed handcart.",
          status: "open",
          urgency: 5,
          authority: "predicate",
          actionId: "solve:problem-cart",
          blockers: ["The cart must still be a legal live problem."],
          targetLocationId: "market-square",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "help-cart",
      source: "manual",
      text: "Clear the jammed cart in Quay Square.",
      trail: [
        {
          id: "stale-cart-solve",
          title: "Solve the cart after Nia already cleared it.",
          detail:
            "This stale route hint must lose to the current legal action surface.",
          done: false,
          actionId: "solve:problem-cart",
          targetLocationId: "market-square",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-cart",
    );
    expect(world.rowanAutonomy.planningTrace?.selectedActionId).not.toBe(
      "solve:problem-cart",
    );
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) =>
          option.actionId === "solve:problem-cart" &&
          option.reason?.includes("no longer legal"),
      ),
    ).toBe(true);
  });

  it("rebuilds stale pump solve hints as complete after Mara contains the pump", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-mara-resolution-rejects-stale-pump");

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.tick(world, 13);
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 3,
      y: 11,
    });

    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      resolvedByNpcId: "npc-mara",
      status: "resolved",
    });

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "help",
      outcomes: [
        {
          id: "predicate-fix-pump",
          label: "Fix the leaking pump.",
          status: "open",
          urgency: 5,
          authority: "predicate",
          actionId: "solve:problem-pump",
          blockers: ["The pump must still be a legal live problem."],
          targetLocationId: "courtyard",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "help-pump",
      source: "manual",
      text: "Fix the leaking pump in Morrow Yard.",
      trail: [
        {
          id: "stale-pump-solve",
          title: "Solve the pump after Mara already contained it.",
          detail:
            "This stale route hint must lose to the current legal action surface.",
          done: false,
          actionId: "solve:problem-pump",
          targetLocationId: "courtyard",
        },
      ],
    };

    world = await engine.runCommand(world, {
      type: "wait",
      minutes: 0,
      silent: true,
    });

    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-pump",
    );
    expect(world.player.objective).toMatchObject({
      progress: {
        completed: 3,
        total: 3,
      },
    });
    expect(world.player.objective?.trail.flatMap((step) => step.actionId ?? [])).not.toContain(
      "solve:problem-pump",
    );
    expect(world.rowanAutonomy.planningTrace?.selectedActionId).not.toBe(
      "solve:problem-pump",
    );
    expect(world.rowanAutonomy).toMatchObject({
      label: "Objective complete",
      stepKind: "idle",
    });
  });

  it("keeps explicit predicate authority when route hints mirror the predicate target", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-mirrored-trail-still-predicate");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Verify Tomas's yard opening from current world state.",
    });
    world.activeConversation = undefined;
    world.conversations = [];
    world.conversationThreads = {};

    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      completedTrail: [],
      focus: "work",
      outcomes: [
        {
          id: "predicate-yard-visit",
          label: "Reach North Crane Yard and verify the live yard opening.",
          status: "open",
          urgency: 9,
          blockers: ["The yard opening has not been verified from live state."],
          targetLocationId: "freight-yard",
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      routeKey: "work-tea",
      source: "manual",
      text: "Verify Tomas's yard opening from current world state.",
      trail: [
        {
          id: "predicate-yard-visit",
          title: "Debug hint: go to the yard.",
          detail:
            "This hint happens to mirror the predicate, but it must not be the authority switch.",
          done: false,
          targetLocationId: "freight-yard",
        },
      ],
    };
    world.activeConversation = undefined;

    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    expect(world.player.pendingObjectiveMove).toMatchObject({
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy).toMatchObject({
      autoContinue: true,
      mode: "moving",
      targetLocationId: "freight-yard",
    });
    expect(world.rowanAutonomy.targetLocationId).not.toBe("tea-house");
    expect(
      world.rowanAutonomy.planningTrace?.considered.some(
        (option) =>
          option.status === "selected" &&
          option.targetLocationId === "freight-yard",
      ),
    ).toBe(true);
    expect(
      world.rowanAutonomy.planningTrace?.rejected.some(
        (option) => option.targetLocationId === "tea-house",
      ),
    ).toBe(true);
    expectCognitionToMirrorAutonomy(world);
  });

  it("routes a wrench objective to Jo instead of reopening Mara", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tool-route");

    world = await enterMorrowHouse(engine, world);
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
      actionId: "exit:boarding-house",
      autoContinue: true,
      mode: "acting",
      targetLocationId: "repair-stall",
    });
    expect(world.rowanAutonomy.npcId).toBeUndefined();
    expectCognitionToMirrorAutonomy(world);

    world = await advanceUntil(
      engine,
      world,
      (nextWorld) => nextWorld.rowanAutonomy.actionId === "buy:item-wrench",
    );

    expect(world.player.currentLocationId).toBe("repair-stall");
    expect(world.activeSpaceId).toBe("interior:repair-stall");
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
    world = await enterTeaHouse(engine, world);
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
      actionId: "exit:tea-house",
      autoContinue: true,
      mode: "acting",
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
    expect(result.finalWorld.clock.label).toBe("Afternoon");
    expect(result.finalWorld.clock.totalMinutes).toBeGreaterThanOrEqual(15 * 60);
    expect(result.finalWorld.clock.totalMinutes).toBeLessThanOrEqual(17 * 60);
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
