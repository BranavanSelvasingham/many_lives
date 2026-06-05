import type { SimulationEngine } from "../src/sim/engine.js";
import type { StreetGameState } from "../src/street-sim/types.js";

const STREET_SPACE_ID = "street:south-quay";

const exteriorApproachByLocationId: Record<string, { x: number; y: number }> = {
  "boarding-house": { x: 3, y: 9 },
  "tea-house": { x: 6, y: 4 },
  "repair-stall": { x: 16, y: 9 },
};

export async function exitToStreet(
  engine: SimulationEngine,
  world: StreetGameState,
) {
  if (world.activeSpaceId === STREET_SPACE_ID) {
    return world;
  }
  return engine.runCommand(world, {
    type: "act",
    actionId: `exit:${world.player.currentLocationId}`,
  });
}

export async function enterBuilding(
  engine: SimulationEngine,
  world: StreetGameState,
  locationId: "boarding-house" | "tea-house" | "repair-stall",
) {
  let nextWorld = await exitToStreet(engine, world);
  const approach = exteriorApproachByLocationId[locationId];

  if (
    nextWorld.player.currentLocationId !== locationId ||
    nextWorld.player.x !== approach.x ||
    nextWorld.player.y !== approach.y
  ) {
    nextWorld = await engine.runCommand(nextWorld, {
      type: "move_to",
      x: approach.x,
      y: approach.y,
    });
  }

  return engine.runCommand(nextWorld, {
    type: "act",
    actionId: `enter:${locationId}`,
  });
}

export async function enterMorrowHouse(
  engine: SimulationEngine,
  world: StreetGameState,
) {
  return enterBuilding(engine, world, "boarding-house");
}

export async function enterTeaHouse(
  engine: SimulationEngine,
  world: StreetGameState,
) {
  return enterBuilding(engine, world, "tea-house");
}

export async function enterRepairStall(
  engine: SimulationEngine,
  world: StreetGameState,
) {
  return enterBuilding(engine, world, "repair-stall");
}
