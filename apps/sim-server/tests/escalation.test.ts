import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";

describe("World time pressure", () => {
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

  it("lets local problems expire if the block gets away from you", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-expiring-problems");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.tick(world, 14);

    expect(world.problems.find((problem) => problem.id === "problem-pump")?.status).toBe(
      "expired",
    );
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

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    world = await engine.tick(world, 4);

    expect(world.clock.totalMinutes).toBe(13 * 60);
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
      outcome: "worsened",
      progress: "missed",
      resolvedAt: "2026-03-21T17:00:00.000Z",
      status: "resolved",
      tone: "warning",
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
