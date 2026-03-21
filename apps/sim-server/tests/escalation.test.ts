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
});
