import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { enterMorrowHouse, enterRepairStall } from "./street-test-helpers.js";

describe("Scene actions", () => {
  it("offers grounded actions based on the player's current place", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-actions");

    expect(
      world.availableActions.some((action) => action.id === "enter:boarding-house"),
    ).toBe(true);

    world = await enterMorrowHouse(engine, world);

    expect(
      world.availableActions.some((action) => action.id === "talk:npc-mara"),
    ).toBe(true);
    expect(
      world.availableActions.some((action) => action.id === "rest:home"),
    ).toBe(true);
  });

  it("changes available actions when the player reaches a new location", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-location-actions");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 16,
      y: 9,
    });

    expect(world.player.currentLocationId).toBe("repair-stall");
    expect(
      world.availableActions.some((action) => action.id === "enter:repair-stall"),
    ).toBe(true);

    world = await enterRepairStall(engine, world);

    expect(
      world.availableActions.some((action) => action.id === "talk:npc-jo"),
    ).toBe(true);
    expect(
      world.availableActions.some((action) => action.id === "buy:item-wrench"),
    ).toBe(true);
  });
});
