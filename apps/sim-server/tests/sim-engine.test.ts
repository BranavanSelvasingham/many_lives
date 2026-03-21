import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";

describe("SimulationEngine street slice", () => {
  it("lets the player discover and complete a first paid shift", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-tea-shift");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 12,
      y: 5,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    world = await engine.tick(world, 1);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });

    expect(world.jobs.find((job) => job.id === "job-tea-shift")?.completed).toBe(
      true,
    );
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
      x: 18,
      y: 5,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "buy:item-wrench",
    });
    world = await engine.runCommand(world, {
      type: "move_to",
      x: 3,
      y: 11,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "solve:problem-pump",
    });

    expect(world.problems.find((problem) => problem.id === "problem-pump")?.status).toBe(
      "solved",
    );
    expect(world.player.inventory.some((item) => item.id === "item-wrench")).toBe(
      true,
    );
    expect(world.player.reputation.morrow_house).toBeGreaterThan(1);
  });
});
