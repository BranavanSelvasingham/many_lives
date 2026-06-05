import { describe, expect, it } from "vitest";
import { seedStreetGame } from "../src/street-sim/seedGame.js";
import type { MapTile, SpaceDefinition } from "../src/street-sim/types.js";

const REQUIRED_INTERIORS = [
  "interior:boarding-house",
  "interior:tea-house",
  "interior:repair-stall",
];

describe("street space definitions", () => {
  it("seeds the street and the three key interiors with walkable camera bounds", () => {
    const world = seedStreetGame("space-smoke");
    const spaces = world.spaces ?? [];

    expect(spaces.map((space) => space.id)).toEqual(
      expect.arrayContaining(["street:south-quay", ...REQUIRED_INTERIORS]),
    );

    for (const spaceId of REQUIRED_INTERIORS) {
      const space = findSpace(spaces, spaceId);
      expect(space.kind).toBe("interior");
      expect(space.width).toBeGreaterThan(4);
      expect(space.height).toBeGreaterThan(4);
      expect(space.tiles.some((tile) => tile.walkable)).toBe(true);
      expect(space.camera?.minZoom).toBeGreaterThan(0);
    }
  });

  it("gives every portal a valid reachable reverse portal", () => {
    const world = seedStreetGame("space-portals");
    const spaces = world.spaces ?? [];
    const portals = spaces.flatMap((space) => space.portals);

    for (const portal of portals) {
      const reverse = portals.find(
        (candidate) => candidate.id === portal.reversePortalId,
      );
      expect(reverse, portal.id).toBeDefined();
      expect(reverse?.reversePortalId).toBe(portal.id);
      expect(reverse?.fromSpaceId).toBe(portal.toSpaceId);
      expect(reverse?.toSpaceId).toBe(portal.fromSpaceId);

      const fromSpace = findSpace(spaces, portal.fromSpaceId);
      const toSpace = findSpace(spaces, portal.toSpaceId);
      expect(tileAt(fromSpace, portal.from.x, portal.from.y)?.walkable).toBe(
        true,
      );
      expect(tileAt(toSpace, portal.to.x, portal.to.y)?.walkable).toBe(true);
    }
  });

  it("keeps every NPC/action/portal anchor reachable from the room spawn", () => {
    const world = seedStreetGame("space-anchors");
    const interiors = (world.spaces ?? []).filter(
      (space) => space.kind === "interior",
    );

    for (const space of interiors) {
      const spawn =
        space.anchors.find((anchor) => anchor.kind === "spawn") ??
        space.tiles.find((tile) => tile.walkable);
      expect(spawn, space.id).toBeDefined();

      for (const anchor of space.anchors) {
        expect(
          routeReached(space.tiles, spawn!, anchor),
          `${space.id}:${anchor.id}`,
        ).toBe(true);
      }
    }
  });

  it("marks every solid furniture, wall, and counter footprint as non-walkable", () => {
    const world = seedStreetGame("space-solid-objects");
    const interiors = (world.spaces ?? []).filter(
      (space) => space.kind === "interior",
    );

    for (const space of interiors) {
      for (const object of space.objects.filter((entry) => entry.solid)) {
        for (let y = object.y; y < object.y + object.height; y += 1) {
          for (let x = object.x; x < object.x + object.width; x += 1) {
            expect(
              tileAt(space, x, y)?.walkable,
              `${space.id}:${object.id}:${x},${y}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});

function findSpace(spaces: SpaceDefinition[], spaceId: string) {
  const space = spaces.find((entry) => entry.id === spaceId);
  expect(space, spaceId).toBeDefined();
  return space!;
}

function tileAt(space: SpaceDefinition, x: number, y: number) {
  return space.tiles.find((tile) => tile.x === x && tile.y === y);
}

function routeReached(
  tiles: MapTile[],
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const walkable = new Set(
    tiles.filter((tile) => tile.walkable).map((tile) => `${tile.x},${tile.y}`),
  );
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;
  const queue = [start];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;
    if (currentKey === endKey) {
      return true;
    }

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const nextKey = `${next.x},${next.y}`;
      if (!walkable.has(nextKey) || visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      queue.push(next);
    }
  }

  return false;
}
