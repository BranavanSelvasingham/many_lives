import { describe, expect, it } from "vitest";
import {
  buildNpcPatrolRoute,
  distanceBetween,
  type Point,
} from "../../many-lives-web/src/lib/street/navigation.js";
import {
  buildVisualNavigationSurface,
  projectVisualNavigationPoint,
  resolveVisualRoute,
} from "../../many-lives-web/src/lib/street/visualNavigation.js";
import { SOUTH_QUAY_V2_DOCUMENT } from "../../many-lives-web/src/lib/street/visual-scene-documents/southQuayV2Document.js";
import type {
  LocationState,
  MapTile,
  StreetGameState,
} from "../../many-lives-web/src/lib/street/types.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";

type VisualNavigationScene = NonNullable<
  Parameters<typeof buildVisualNavigationSurface>[1]
>;

const BLOCKED_SURFACE_KINDS = new Set(["bushes", "trees"]);
const ROUTE_OBSTACLE_SAMPLE_SPACING = 8;

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
    const blockedTile = surface.tiles.find(
      (entry) => entry.x === 2 && entry.y === 1,
    );

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

  it("routes Rowan around the square fountain centerpiece", () => {
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
          id: "blocking-square",
          locationId: "test-square",
          rect: {
            height: 40,
            radius: 0,
            width: 40,
            x: 80,
            y: 40,
          },
          style: "square",
        },
      ],
      projection: {
        columnCenters: [0, 40, 80, 120, 160, 200],
        rowCenters: [0, 40, 80, 120],
      },
    } as unknown as VisualNavigationScene;

    const surface = buildVisualNavigationSurface(game, visualScene);
    const fountainTile = surface.tiles.find(
      (entry) => entry.x === 2 && entry.y === 1,
    );

    expect(surface.blockedByVisualScene).toBe(1);
    expect(fountainTile?.walkable).toBe(false);

    const rowanRoute = resolveVisualRoute({
      blockedByVisualScene: surface.blockedByVisualScene,
      end: { x: 4, y: 1 },
      routeFinder: surface.routeFinder,
      start: { x: 0, y: 1 },
      visualScene,
      walkableRuntimePoints: surface.walkableRuntimePoints,
    });

    expect(rowanRoute.diagnostics.legal).toBe(true);
    expect(rowanRoute.diagnostics.visualObstaclesClear).toBe(true);
    expect(rowanRoute.tilePath).not.toContainEqual({ x: 2, y: 1 });
  });

  it("keeps South Quay Rowan and NPC routes on authored roads and openings", () => {
    const game = seedStreetGame("south-quay-visual-navigation");
    const visualScene = SOUTH_QUAY_V2_DOCUMENT as VisualNavigationScene;
    const surface = buildVisualNavigationSurface(game, visualScene);
    const routes = [
      ["home to cafe", { x: 3, y: 9 }, { x: 6, y: 4 }],
      ["cafe to home", { x: 6, y: 4 }, { x: 3, y: 9 }],
      ["home to square", { x: 3, y: 9 }, { x: 12, y: 10 }],
      ["square to freight yard", { x: 12, y: 10 }, { x: 18, y: 10 }],
      ["square to pier", { x: 12, y: 10 }, { x: 18, y: 14 }],
      ["home to repair stall", { x: 3, y: 9 }, { x: 15, y: 9 }],
      ["north square crossing", { x: 8, y: 5 }, { x: 13, y: 5 }],
    ] satisfies Array<[string, Point, Point]>;

    expect(surface.blockedByVisualScene).toBeGreaterThan(30);

    for (const [label, start, end] of routes) {
      const route = resolveVisualRoute({
        blockedByVisualScene: surface.blockedByVisualScene,
        end,
        routeFinder: surface.routeFinder,
        start,
        visualScene,
        walkableRuntimePoints: surface.walkableRuntimePoints,
      });

      expect(route.diagnostics.legal, label).toBe(true);
      expect(route.diagnostics.visualObstaclesClear, label).toBe(true);
      expect(route.reachesDestination, label).toBe(true);
      expect(route.worldPath.length, label).toBeGreaterThan(2);
      expectWorldPathToAvoidAuthoredObstacles(label, visualScene, route.worldPath);
    }

    const locations = new Map(game.locations.map((entry) => [entry.id, entry]));
    const doors = new Map(game.map.doors.map((door) => [door.locationId, door]));

    const patrolLocationIds = [
      "boarding-house",
      "tea-house",
      "market-square",
      "freight-yard",
      "moss-pier",
    ] as const;

    for (const locationId of patrolLocationIds) {
      const anchors = SOUTH_QUAY_V2_DOCUMENT.locationAnchors[locationId];
      const patrol = buildNpcPatrolRoute({
        door: doors.get(locationId),
        findRoute: surface.routeFinder,
        location: locations.get(locationId)!,
        props: game.map.props,
        visualHints: [
          ...(anchors?.npcStands ?? []),
          ...(anchors?.playerApproaches ?? []),
          anchors?.frontage,
        ].filter(isPresent),
        walkableRuntimePoints: surface.walkableRuntimePoints,
      });
      const worldPath = patrol.path.map((point) =>
        projectVisualNavigationPoint(visualScene, point),
      );

      expect(patrol.diagnostics.routed, locationId).toBe(true);
      expect(patrol.diagnostics.unreachableSegments, locationId).toBe(0);
      expectWorldPathToAvoidAuthoredObstacles(locationId, visualScene, worldPath);
    }
  });
});

function expectWorldPathToAvoidAuthoredObstacles(
  label: string,
  visualScene: VisualNavigationScene,
  worldPath: Point[],
) {
  const samples = sampleWorldPath(worldPath);
  const fountain = squareFountainRect(visualScene);
  const blockedSample = samples.find((sample) => {
    const surfaceKind = surfaceKindAtPoint(visualScene, sample);
    return (
      (surfaceKind && BLOCKED_SURFACE_KINDS.has(surfaceKind)) ||
      (fountain ? pointInsideRect(sample, fountain) : false)
    );
  });

  expect(blockedSample, label).toBeUndefined();
}

function sampleWorldPath(path: Point[]) {
  if (path.length <= 1) {
    return path;
  }

  const samples: Point[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const distance = distanceBetween(from, to);
    const steps = Math.max(1, Math.ceil(distance / ROUTE_OBSTACLE_SAMPLE_SPACING));

    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      samples.push({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      });
    }
  }

  return samples;
}

function surfaceKindAtPoint(
  visualScene: VisualNavigationScene,
  point: Point,
): string | null {
  const surface = visualScene.surfaceDraft;
  if (!surface) {
    return null;
  }

  const col = Math.floor(point.x / surface.cellSize);
  const row = Math.floor(point.y / surface.cellSize);
  const override = surface.overrides.find(
    (cell) => cell.col === col && cell.row === row,
  );

  return override?.kind ?? null;
}

function squareFountainRect(visualScene: VisualNavigationScene) {
  const square = visualScene.landmarks.find(
    (landmark) => landmark.style === "square",
  );
  if (!square) {
    return null;
  }

  const radius = Math.min(square.rect.width, square.rect.height) * 0.18 + 32;
  return {
    height: radius * 2,
    width: radius * 2,
    x: square.rect.x + square.rect.width / 2 - radius,
    y: square.rect.y + square.rect.height / 2 - radius,
  };
}

function pointInsideRect(point: Point, rect: { height: number; width: number; x: number; y: number }) {
  return !(
    point.x < rect.x ||
    point.y < rect.y ||
    point.x > rect.x + rect.width ||
    point.y > rect.y + rect.height
  );
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
