import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";

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

    expect(world.problems.find((problem) => problem.id === "problem-pump")?.status).toBe(
      "solved",
    );
    expect(world.player.inventory.some((item) => item.id === "item-wrench")).toBe(
      true,
    );
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
});
