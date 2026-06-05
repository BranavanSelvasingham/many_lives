import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import type { StreetGameState } from "../src/street-sim/types.js";

describe("street interior simulation", () => {
  it("rejects Ada interactions from outside, then allows them inside Kettle & Lamp", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-cafe");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    expect(world.activeSpaceId).toBe("street:south-quay");
    expect(world.availableActions.map((action) => action.id)).toContain(
      "enter:tea-house",
    );
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "talk:npc-ada",
    );

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    expect(world.activeConversation).toBeUndefined();

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "enter:tea-house",
    });
    expect(world.activeSpaceId).toBe("interior:tea-house");
    expect(world.player.currentLocationId).toBe("tea-house");
    expect(world.availableActions.map((action) => action.id)).toContain(
      "talk:npc-ada",
    );

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    expect(world.activeConversation?.npcId).toBe("npc-ada");
    expect(world.player).toMatchObject({ x: 7, y: 4 });
  });

  it("lets Rowan enter and exit Morrow House through validated portals", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-morrow");

    world = await enterLocation(engine, world, "boarding-house", 3, 9);
    expect(world.activeSpaceId).toBe("interior:boarding-house");
    expect(world.availableActions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["talk:npc-mara", "rest:home"]),
    );

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "rest:home",
    });
    expect(world.player).toMatchObject({ x: 3, y: 3 });

    world.jobs.find((job) => job.id === "job-tea-shift")!.completed = true;
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "reflect:first-afternoon",
    });
    expect(world.player).toMatchObject({ x: 7, y: 6 });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "exit:boarding-house",
    });
    expect(world.activeSpaceId).toBe("street:south-quay");
    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.availableActions.map((action) => action.id)).toContain(
      "enter:boarding-house",
    );
  });

  it("lets Rowan reach Jo and the wrench anchor only inside Mercer Repairs", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-repair");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 16,
      y: 9,
    });
    expect(world.availableActions.map((action) => action.id)).not.toContain(
      "buy:item-wrench",
    );

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "enter:repair-stall",
    });
    expect(world.activeSpaceId).toBe("interior:repair-stall");
    expect(world.availableActions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["talk:npc-jo", "buy:item-wrench"]),
    );

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "buy:item-wrench",
    });
    expect(world.player.inventory.map((item) => item.id)).toContain(
      "item-wrench",
    );
    expect(world.player).toMatchObject({ x: 7, y: 3 });
  });

  it("routes cafe work actions to Ada and the counter anchors", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-cafe-work-anchors");

    world = await enterLocation(engine, world, "tea-house", 6, 4);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });
    expect(world.player).toMatchObject({ x: 7, y: 4 });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });
    expect(world.player).toMatchObject({ x: 7, y: 4 });

    world.clock.totalMinutes = 12 * 60;
    world.clock.hour = 12;
    world.clock.minute = 0;
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    expect(world.player).toMatchObject({ x: 8, y: 3 });
    expect(world.firstAfternoon?.teaShiftStage).toBe("rush");
  });

  it("rejects direct actions when the action anchor is blocked", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-blocked-action-anchor");

    world = await enterLocation(engine, world, "tea-house", 6, 4);
    const teaHouse = world.spaces?.find(
      (space) => space.id === "interior:tea-house",
    );
    expect(teaHouse).toBeDefined();
    const adaTalkTile = teaHouse!.tiles.find(
      (tile) => tile.x === 7 && tile.y === 4,
    );
    expect(adaTalkTile).toBeDefined();
    adaTalkTile!.walkable = false;

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });

    expect(world.activeConversation).toBeUndefined();
    expect(world.player).toMatchObject({ x: 7, y: 8 });
    expect(world.feed.map((entry) => entry.text)).toContain(
      "You cannot reach that spot from here.",
    );
    expect(
      world.availableActions.find((action) => action.id === "talk:npc-ada"),
    ).toMatchObject({
      disabled: true,
      disabledReason: "You cannot reach that spot from here.",
    });
  });

  it("rejects invalid portal actions from the wrong active space", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("interior-invalid-portal");

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "exit:tea-house",
    });
    expect(world.activeSpaceId).toBe("street:south-quay");
    expect(
      world.feed.some((entry) => /not available from here/i.test(entry.text)),
    ).toBe(true);
  });
});

async function enterLocation(
  engine: SimulationEngine,
  world: StreetGameState,
  locationId: string,
  x: number,
  y: number,
) {
  let nextWorld = world;
  if (nextWorld.activeSpaceId !== "street:south-quay") {
    nextWorld = await engine.runCommand(nextWorld, {
      type: "act",
      actionId: `exit:${nextWorld.player.currentLocationId}`,
    });
  }

  nextWorld = await engine.runCommand(nextWorld, {
    type: "move_to",
    x,
    y,
  });
  return engine.runCommand(nextWorld, {
    type: "act",
    actionId: `enter:${locationId}`,
  });
}
