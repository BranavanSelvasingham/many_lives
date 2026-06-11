import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { enterMorrowHouse, enterTeaHouse } from "./street-test-helpers.js";

describe("World time pressure", () => {
  function setClock(world: Awaited<ReturnType<SimulationEngine["createGame"]>>, {
    hour,
    minute,
  }: {
    hour: number;
    minute: number;
  }) {
    world.clock.hour = hour;
    world.clock.minute = minute;
    world.clock.totalMinutes = hour * 60 + minute;
    world.clock.label = hour >= 17 ? "Evening" : "Afternoon";
    world.currentTime = `2026-03-21T${String(hour).padStart(2, "0")}:${String(
      minute,
    ).padStart(2, "0")}:00.000Z`;
  }

  it("lets jobs expire if the player drifts past their window", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-expiring-jobs");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 12,
      y: 5,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.tick(world, 9);

    expect(world.jobs.find((job) => job.id === "job-tea-shift")?.missed).toBe(
      true,
    );
  });

  it("applies cascading consequences when a discovered job window is missed", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-missed-job-consequences");

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

    const teaJob = world.jobs.find((job) => job.id === "job-tea-shift");
    const ada = world.npcs.find((npc) => npc.id === "npc-ada");

    expect(teaJob).toMatchObject({
      accepted: false,
      completed: false,
      consequenceAppliedAt: expect.any(String),
      missed: true,
      missedAt: expect.any(String),
    });
    expect(world.player.activeJobId).toBeUndefined();
    expect(ada).toMatchObject({
      currentConcern:
        "Lunch already had to run without the hands Rowan could have offered.",
      mood: "cool",
    });
    expect(ada?.memory).toContain(
      "Rowan let the lunch rush move on without committing steady hands.",
    );
    expect(world.feed.map((entry) => entry.text)).toContain(
      "Ada's lunch window moved on without Rowan; the room learned to solve the rush without him.",
    );
    expect(world.player.memories.map((entry) => entry.text)).toContain(
      "You missed Ada's lunch window, so that paid foothold is no longer waiting.",
    );
  });

  it("lets local problems expire if the block gets away from you", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-expiring-problems");
    const mara = world.npcs.find((npc) => npc.id === "npc-mara");

    if (mara) {
      mara.schedule = [];
      mara.currentLocationId = "boarding-house";
    }
    world = await engine.tick(world, 14);

    expect(world.problems.find((problem) => problem.id === "problem-pump")?.status).toBe(
      "expired",
    );
  });

  it("applies NPC and reputation consequences when problems expire without Rowan", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-expired-problem-consequences");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    const mara = world.npcs.find((npc) => npc.id === "npc-mara");
    const startingStanding = world.player.reputation.morrow_house;

    if (pump) {
      pump.discovered = true;
    }
    if (mara) {
      mara.schedule = [];
      mara.currentLocationId = "boarding-house";
    }
    world = await engine.tick(world, 14);

    const expiredPump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );
    const expiredMara = world.npcs.find((npc) => npc.id === "npc-mara");

    expect(expiredPump).toMatchObject({
      consequenceAppliedAt: expect.any(String),
      expiredAt: expect.any(String),
      status: "expired",
    });
    expect(world.player.reputation.morrow_house).toBe(
      Math.max(0, startingStanding - 1),
    );
    expect(expiredMara).toMatchObject({
      currentConcern:
        "The pump is not a future worry anymore; the house is already paying for it.",
      mood: "strained",
    });
    expect(expiredMara?.memory).toContain(
      "The Morrow Yard pump was left until evening and turned into house strain.",
    );
    expect(world.feed.map((entry) => entry.text)).toContain(
      "By evening the Morrow Yard pump stopped being a small fix and became house strain Rowan has to live with.",
    );
  });

  it("lets Mara contain the pump independently before it expires", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-mara-resolves-pump");

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });

    const standingAfterDiscovery = world.player.reputation.morrow_house;
    const maraTrustAfterDiscovery =
      world.npcs.find((npc) => npc.id === "npc-mara")?.trust ?? 0;

    world = await engine.tick(world, 13);

    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    const mara = world.npcs.find((npc) => npc.id === "npc-mara");

    expect(world.clock.totalMinutes).toBe(17.5 * 60 + 3);
    expect(pump).toMatchObject({
      resolvedAt: "2026-03-21T17:33:00.000Z",
      resolvedByNpcId: "npc-mara",
      status: "resolved",
    });
    expect(world.player.reputation.morrow_house).toBe(
      Math.max(0, standingAfterDiscovery - 1),
    );
    expect(mara).toMatchObject({
      currentConcern:
        "The pump is contained, but the house had to handle it without Rowan.",
      mood: "guarded",
      trust: Math.max(0, maraTrustAfterDiscovery - 1),
    });
    expect(mara?.memory).toContain(
      "Mara contained the pump herself after the house waited as long as it could.",
    );
    expect(world.feed.map((entry) => entry.text)).toContain(
      "Mara got the pump contained before evening, but Morrow House had to solve that strain without Rowan.",
    );
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-pump",
    );
  });

  it("surfaces Mara's pump resolution during long work and lets Rowan finish started work", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-work-pauses-for-mara-pump");

    setClock(world, { hour: 16, minute: 50 });
    world.activeSpaceId = "street:south-quay";
    world.player.spaceId = "street:south-quay";
    world.player.currentLocationId = "freight-yard";
    world.player.x = 18;
    world.player.y = 10;
    world.player.energy = 80;
    world.player.activeJobId = "job-yard-shift";

    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.accepted = true;
      yardJob.discovered = true;
      yardJob.completed = false;
      yardJob.missed = false;
      yardJob.progressMinutes = undefined;
    }

    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.escalationLevel = 2;
      pump.status = "active";
      pump.urgency = 5;
    }

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-yard-shift",
    });

    expect(world.clock.totalMinutes).toBe(17.5 * 60);
    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      resolvedAt: "2026-03-21T17:30:00.000Z",
      resolvedByNpcId: "npc-mara",
      status: "resolved",
    });
    expect(world.jobs.find((job) => job.id === "job-yard-shift")).toMatchObject({
      accepted: true,
      completed: false,
      missed: false,
      progressMinutes: 40,
    });
    expect(world.player.activeJobId).toBe("job-yard-shift");
    expect(world.availableActions.map((action) => action.id)).toContain(
      "work:job-yard-shift",
    );
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-pump",
    );
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "work:job-yard-shift",
      label: "Finish Freight yard lift",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-yard-shift",
    });

    expect(world.jobs.find((job) => job.id === "job-yard-shift")).toMatchObject({
      completed: true,
      missed: false,
      progressMinutes: 90,
    });
    expect(world.player.activeJobId).toBeUndefined();
  });

  it("surfaces Mara's pump resolution during a long home rest", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-rest-pauses-for-mara-pump");

    setClock(world, { hour: 17, minute: 21 });
    world.activeSpaceId = "interior:boarding-house";
    world.player.spaceId = "interior:boarding-house";
    world.player.currentLocationId = "boarding-house";
    world.player.x = 7;
    world.player.y = 6;
    world.player.energy = 34;

    const pump = world.problems.find((problem) => problem.id === "problem-pump");
    if (pump) {
      pump.discovered = true;
      pump.escalationLevel = 2;
      pump.status = "active";
      pump.urgency = 5;
    }

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "rest:home",
    });

    expect(world.clock.totalMinutes).toBeGreaterThanOrEqual(17.5 * 60);
    expect(world.clock.totalMinutes).toBeLessThanOrEqual(17.5 * 60 + 10);
    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      resolvedByNpcId: "npc-mara",
      status: "resolved",
    });
    expect(world.player.energy).toBeGreaterThan(34);
    expect(world.availableActions.map((action) => action.id)).toContain("rest:home");
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-pump",
    );
  });

  it("moves NPCs toward live pressure instead of only following static schedules", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-pressure-npc-movement");

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.tick(world, 9);

    const mara = world.npcs.find((npc) => npc.id === "npc-mara");
    const maraScheduleLocation = mara?.schedule.find(
      (entry) =>
        world.clock.hour >= entry.fromHour && world.clock.hour < entry.toHour,
    )?.locationId;

    expect(
      world.problems.find((problem) => problem.id === "problem-pump"),
    ).toMatchObject({
      escalationLevel: 2,
      status: "active",
    });
    expect(maraScheduleLocation).toBe("boarding-house");
    expect(mara).toMatchObject({
      currentLocationId: "courtyard",
      currentObjective:
        "Get eyes on Morrow Yard before the pump turns house strain into rent talk.",
    });

    world = await engine.createGame("game-pressure-nia-movement");
    world = await engine.tick(world, 10);

    const nia = world.npcs.find((npc) => npc.id === "npc-nia");
    const niaScheduleLocation = nia?.schedule.find(
      (entry) =>
        world.clock.hour >= entry.fromHour && world.clock.hour < entry.toHour,
    )?.locationId;

    expect(
      world.problems.find((problem) => problem.id === "problem-cart"),
    ).toMatchObject({
      escalationLevel: 2,
      status: "active",
    });
    expect(niaScheduleLocation).toBe("moss-pier");
    expect(nia).toMatchObject({
      currentLocationId: "market-square",
      currentObjective:
        "Stay with Quay Square until the jam stops bending everybody's route.",
    });
  });

  it("lets NPCs resolve a live problem without crediting Rowan for the work", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-npc-resolves-cart");
    const startingMoney = world.player.money;
    const startingStanding = world.player.reputation.south_quay;

    world = await engine.tick(world, 11);

    const cart = world.problems.find((problem) => problem.id === "problem-cart");
    const nia = world.npcs.find((npc) => npc.id === "npc-nia");

    expect(world.clock.totalMinutes).toBe(16.5 * 60);
    expect(cart).toMatchObject({
      resolvedAt: "2026-03-21T16:30:00.000Z",
      resolvedByNpcId: "npc-nia",
      status: "resolved",
    });
    expect(nia?.memory).toContain(
      "Nia cleared the handcart after the square got tired of bending around it.",
    );
    expect(world.player.money).toBe(startingMoney);
    expect(world.player.reputation.south_quay).toBe(startingStanding);
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "solve:problem-cart",
    );
    expect(
      world.cityEvents.find((event) => event.id === "event-square-cart"),
    ).toMatchObject({
      outcome: "handled",
      progress: "cleared-by-local",
      status: "resolved",
    });
  });

  it("escalates discovered problems while Rowan spends time elsewhere", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-escalating-problems");
    const pump = world.problems.find((problem) => problem.id === "problem-pump");

    expect(pump?.escalationLevel).toBeUndefined();
    expect(pump).toMatchObject({
      status: "active",
      urgency: 3,
    });

    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.tick(world, 4);

    expect(world.clock.totalMinutes).toBe(13 * 60 + 3);
    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.problems.find((problem) => problem.id === "problem-pump")).toMatchObject({
      discovered: true,
      escalatedAt: world.currentTime,
      escalationLevel: 1,
      status: "active",
      urgency: 4,
    });
    expect(world.feed.map((entry) => entry.text)).toContain(
      "The Morrow Yard pump has started spreading water across the stones while Rowan is elsewhere.",
    );
    expect(world.player.memories.map((entry) => entry.text)).toContain(
      "The pump did not wait for Rowan's route; by early afternoon it had become harder to ignore.",
    );
  });

  it("lets hidden problems worsen as world state before Rowan discovers them", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-hidden-problem-pressure");

    world = await engine.tick(world, 6);

    expect(world.clock.totalMinutes).toBe(14 * 60);
    expect(world.problems.find((problem) => problem.id === "problem-cart")).toMatchObject({
      discovered: false,
      escalationLevel: 1,
      status: "active",
      urgency: 4,
    });
    expect(world.feed.map((entry) => entry.text)).not.toContain(
      "The jammed cart has started pinching the square instead of waiting politely at the edge.",
    );
  });

  it("records city event outcomes when Rowan ignores live windows", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-city-event-outcomes");

    world = await engine.tick(world, 12);

    expect(world.clock.totalMinutes).toBe(17 * 60);
    expect(
      world.cityEvents.find((event) => event.id === "event-cafe-prep"),
    ).toMatchObject({
      outcome: "passed",
      resolvedAt: "2026-03-21T12:00:00.000Z",
      status: "resolved",
    });
    expect(
      world.cityEvents.find((event) => event.id === "event-lunch-rush"),
    ).toMatchObject({
      outcome: "missed",
      progress: "missed",
      resolvedAt: "2026-03-21T15:00:00.000Z",
      status: "resolved",
      tone: "warning",
    });
    expect(
      world.cityEvents.find((event) => event.id === "event-square-cart"),
    ).toMatchObject({
      outcome: "handled",
      progress: "cleared-by-local",
      resolvedAt: "2026-03-21T16:30:00.000Z",
      status: "resolved",
      tone: "info",
    });
    expect(
      world.cityEvents.find((event) => event.id === "event-yard-loading"),
    ).toMatchObject({
      outcome: "missed",
      resolvedAt: "2026-03-21T17:00:00.000Z",
      status: "resolved",
      tone: "warning",
    });
  });
});
