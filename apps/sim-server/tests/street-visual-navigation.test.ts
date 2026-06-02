import { describe, expect, it } from "vitest";
import { buildNpcPatrolRoute } from "../../many-lives-web/src/lib/street/navigation.js";
import {
  buildVisualNavigationSurface,
  resolveVisualRoute,
} from "../../many-lives-web/src/lib/street/visualNavigation.js";
import type {
  LocationState,
  MapTile,
  StreetGameState,
} from "../../many-lives-web/src/lib/street/types.js";

function tile(x: number, y: number, walkable = true): MapTile {
  return {
    kind: "lane",
    walkable,
    x,
    y,
  };
}

function location(): LocationState {
  return {
    backstory: "A test route for visual navigation.",
    closeHour: 24,
    context: "Fixture street.",
    description: "Fixture street.",
    entryX: 0,
    entryY: 1,
    height: 1,
    id: "test-lane",
    labelX: 2,
    labelY: 1,
    name: "Test Lane",
    neighborhood: "Fixture",
    openHour: 0,
    shortLabel: "Lane",
    type: "street",
    width: 5,
    x: 0,
    y: 1,
  };
}

describe("street visual navigation surface", () => {
  it("routes Rowan and NPC patrols around visual blocking rects", () => {
    const tiles = [
      tile(0, 0),
      tile(1, 0),
      tile(2, 0),
      tile(3, 0),
      tile(4, 0),
      tile(0, 1),
      tile(1, 1),
      tile(2, 1),
      tile(3, 1),
      tile(4, 1),
      tile(0, 2),
      tile(1, 2),
      tile(2, 2),
      tile(3, 2),
      tile(4, 2),
    ];
    const game = {
      map: {
        height: 3,
        tiles,
        width: 5,
      },
    } as unknown as StreetGameState;
    const visualScene = {
      landmarkModules: [],
      landmarks: [
        {
          accentColor: 0xffffff,
          id: "blocking-cafe",
          locationId: "test-lane",
          rect: {
            height: 60,
            radius: 0,
            width: 60,
            x: 70,
            y: 30,
          },
          style: "cafe",
        },
      ],
      projection: {
        columnCenters: [0, 40, 80, 120, 160, 200],
        rowCenters: [0, 40, 80, 120],
      },
    } as unknown as NonNullable<
      Parameters<typeof buildVisualNavigationSurface>[1]
    >;

    const surface = buildVisualNavigationSurface(game, visualScene);
    const blockedTile = surface.tiles.find((entry) => entry.x === 2 && entry.y === 1);

    expect(surface.blockedByVisualScene).toBe(1);
    expect(blockedTile?.walkable).toBe(false);

    const rowanRoute = resolveVisualRoute({
      blockedByVisualScene: surface.blockedByVisualScene,
      end: { x: 4, y: 1 },
      routeFinder: surface.routeFinder,
      start: { x: 0, y: 1 },
      visualScene,
      walkableRuntimePoints: surface.walkableRuntimePoints,
    });

    expect(rowanRoute.reachesDestination).toBe(true);
    expect(rowanRoute.diagnostics.legal).toBe(true);
    expect(rowanRoute.tilePath).not.toContainEqual({ x: 2, y: 1 });
    expect(rowanRoute.tilePath.length).toBeGreaterThan(3);

    const patrol = buildNpcPatrolRoute({
      findRoute: surface.routeFinder,
      location: location(),
      props: [],
      visualHints: [{ x: 100, y: 60 }],
      walkableRuntimePoints: surface.walkableRuntimePoints,
    });

    expect(patrol.diagnostics.routed).toBe(true);
    expect(patrol.diagnostics.unreachableSegments).toBe(0);
    expect(patrol.path).not.toContainEqual({ x: 2.5, y: 1.5 });
  });
});
