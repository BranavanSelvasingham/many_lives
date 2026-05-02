import { describe, expect, it } from "vitest";
import {
  createRouteFinder,
  pathDistance,
  routeReachesDestination,
  samplePathPoint,
} from "../../many-lives-web/src/lib/street/navigation.js";
import type { MapTile } from "../../many-lives-web/src/lib/street/types.js";

function tile(x: number, y: number, walkable = true): MapTile {
  return {
    kind: "lane",
    walkable,
    x,
    y,
  };
}

describe("street navigation helpers", () => {
  it("routes around blocked walkable-grid tiles", () => {
    const findRoute = createRouteFinder([
      tile(0, 0),
      tile(1, 0),
      tile(2, 0),
      tile(0, 1),
      tile(1, 1, false),
      tile(2, 1),
      tile(0, 2),
      tile(1, 2),
      tile(2, 2),
    ]);

    const route = findRoute({ x: 0, y: 1 }, { x: 2, y: 1 });

    expect(routeReachesDestination(route, { x: 2, y: 1 })).toBe(true);
    expect(route).not.toContainEqual({ x: 1, y: 1 });
  });

  it("samples and measures paths by geometric distance", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ];

    expect(pathDistance(path)).toBe(8);
    expect(samplePathPoint(path, 0.5)).toEqual({ x: 4, y: 0 });
  });
});
