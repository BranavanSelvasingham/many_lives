import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { buildRowanCognition } from "../src/sim/rowanCognition.js";
import { runRowanLoopSmoke } from "../src/sim/rowanLoopSmoke.js";
import type { StreetGameState } from "../src/street-sim/types.js";

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
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });

    expect(
      world.jobs.find((job) => job.id === "job-tea-shift")?.completed,
    ).toBe(true);
    expect(world.player.money).toBeGreaterThan(12);
    expect(
      world.jobs.find((job) => job.id === "job-yard-shift")?.discovered,
    ).toBe(true);
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
    expect(world.rowanAutonomy.detail).not.toMatch(
      /prompt|context is specific|clear enough/i,
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
      autoContinue: true,
      layer: "objective",
      stepKind: "move",
      targetLocationId: "tea-house",
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

  it("lets advance objective continue an unresolved live conversation", async () => {
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

    expect(world.activeConversation?.npcId).toBe("npc-mara");
    expect(world.activeConversation?.objectiveText).toContain("Ada");
    expect(world.activeConversation?.objectiveText).toContain("Kettle & Lamp");
    expect(world.rowanAutonomy).toMatchObject({
      layer: "conversation",
      mode: "conversation",
      stepKind: "reflect",
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

  it("turns Mara's housing talk into the next Ada work beat Rowan can follow", async () => {
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
      autoContinue: true,
      layer: "objective",
      mode: "moving",
      stepKind: "move",
      targetLocationId: "tea-house",
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
    world = await engine.runCommand(world, {
      type: "advance_objective",
      allowTimeSkip: true,
    });

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
      hour: 13,
      label: "Afternoon",
    });
    expect(result.finalWorld.player.currentLocationId).toBe("boarding-house");
    expect(result.finalWorld.firstAfternoon?.completedAt).toBeDefined();
    expect(result.finalWorld.player.objective).toMatchObject({
      routeKey: "first-afternoon",
      progress: {
        completed: 5,
        total: 5,
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
