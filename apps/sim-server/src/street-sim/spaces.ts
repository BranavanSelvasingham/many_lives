import type {
  CityMap,
  MapTile,
  SpaceAnchor,
  SpaceDefinition,
  SpaceObject,
  SpacePortal,
} from "./types.js";

export const STREET_SPACE_ID = "street:south-quay";
export const BOARDING_HOUSE_SPACE_ID = "interior:boarding-house";
export const TEA_HOUSE_SPACE_ID = "interior:tea-house";
export const REPAIR_STALL_SPACE_ID = "interior:repair-stall";

const INTERIOR_SPACE_BY_LOCATION_ID: Record<string, string> = {
  "boarding-house": BOARDING_HOUSE_SPACE_ID,
  "tea-house": TEA_HOUSE_SPACE_ID,
  "repair-stall": REPAIR_STALL_SPACE_ID,
};

export function interiorSpaceIdForLocation(
  locationId: string | undefined,
): string | undefined {
  return locationId ? INTERIOR_SPACE_BY_LOCATION_ID[locationId] : undefined;
}

export function defaultSpaceIdForLocation(locationId: string | undefined) {
  return interiorSpaceIdForLocation(locationId) ?? STREET_SPACE_ID;
}

export function buildStreetSpaces(map: CityMap): SpaceDefinition[] {
  return [
    {
      id: STREET_SPACE_ID,
      name: "South Quay",
      kind: "street",
      width: map.width,
      height: map.height,
      tiles: map.tiles,
      objects: [],
      anchors: [
        {
          id: "portal:enter:boarding-house",
          kind: "portal",
          label: "Morrow House door",
          actionId: "enter:boarding-house",
          x: 3,
          y: 9,
        },
        {
          id: "portal:enter:tea-house",
          kind: "portal",
          label: "Kettle & Lamp door",
          actionId: "enter:tea-house",
          x: 6,
          y: 4,
        },
        {
          id: "portal:enter:repair-stall",
          kind: "portal",
          label: "Mercer Repairs door",
          actionId: "enter:repair-stall",
          x: 16,
          y: 9,
        },
      ],
      portals: [
        {
          id: "portal-street-to-boarding-house",
          label: "Enter Morrow House",
          locationId: "boarding-house",
          actionId: "enter:boarding-house",
          reversePortalId: "portal-boarding-house-to-street",
          fromSpaceId: STREET_SPACE_ID,
          from: { x: 3, y: 9 },
          toSpaceId: BOARDING_HOUSE_SPACE_ID,
          to: { x: 6, y: 8 },
        },
        {
          id: "portal-street-to-tea-house",
          label: "Enter Kettle & Lamp",
          locationId: "tea-house",
          actionId: "enter:tea-house",
          reversePortalId: "portal-tea-house-to-street",
          fromSpaceId: STREET_SPACE_ID,
          from: { x: 6, y: 4 },
          toSpaceId: TEA_HOUSE_SPACE_ID,
          to: { x: 7, y: 8 },
        },
        {
          id: "portal-street-to-repair-stall",
          label: "Enter Mercer Repairs",
          locationId: "repair-stall",
          actionId: "enter:repair-stall",
          reversePortalId: "portal-repair-stall-to-street",
          fromSpaceId: STREET_SPACE_ID,
          from: { x: 16, y: 9 },
          toSpaceId: REPAIR_STALL_SPACE_ID,
          to: { x: 6, y: 7 },
        },
      ],
    },
    buildBoardingHouseSpace(),
    buildTeaHouseSpace(),
    buildRepairStallSpace(),
  ];
}

function buildBoardingHouseSpace(): SpaceDefinition {
  return createInteriorSpace({
    id: BOARDING_HOUSE_SPACE_ID,
    name: "Morrow House",
    locationId: "boarding-house",
    width: 13,
    height: 10,
    objects: [
      ...wallObjects("boarding-house", 13, 10),
      {
        id: "boarding-house-front-desk",
        kind: "desk",
        label: "front desk",
        x: 2,
        y: 6,
        width: 3,
        height: 1,
        solid: true,
      },
      {
        id: "boarding-house-lounge-table",
        kind: "table",
        label: "lounge table",
        x: 5,
        y: 4,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "boarding-house-west-bed",
        kind: "bed",
        label: "bunk",
        x: 2,
        y: 2,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "boarding-house-east-bed",
        kind: "bed",
        label: "bunk",
        x: 8,
        y: 2,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "boarding-house-storage-shelf",
        kind: "shelf",
        label: "house stores",
        x: 10,
        y: 5,
        width: 1,
        height: 3,
        solid: true,
      },
      {
        id: "boarding-house-hearth-rug",
        kind: "rug",
        label: "worn rug",
        x: 5,
        y: 6,
        width: 3,
        height: 2,
        solid: false,
      },
    ],
    anchors: [
      {
        id: "spawn:boarding-house",
        kind: "spawn",
        label: "entry",
        x: 6,
        y: 8,
      },
      {
        id: "portal:exit:boarding-house",
        kind: "portal",
        label: "street door",
        actionId: "exit:boarding-house",
        x: 6,
        y: 8,
      },
      {
        id: "npc:npc-mara",
        kind: "npc",
        label: "Mara",
        npcId: "npc-mara",
        x: 4,
        y: 5,
      },
      {
        id: "action:talk:npc-mara",
        kind: "action",
        label: "talk with Mara",
        actionId: "talk:npc-mara",
        x: 5,
        y: 5,
      },
      {
        id: "action:contribute:boarding-house",
        kind: "action",
        label: "house chores",
        actionId: "contribute:boarding-house",
        x: 9,
        y: 6,
      },
      {
        id: "action:rest:home",
        kind: "action",
        label: "room",
        actionId: "rest:home",
        x: 3,
        y: 3,
      },
      {
        id: "action:reflect:first-afternoon",
        kind: "action",
        label: "take stock",
        actionId: "reflect:first-afternoon",
        x: 7,
        y: 6,
      },
      {
        id: "action:reflect:first-afternoon-plan",
        kind: "action",
        label: "weigh first move",
        actionId: "reflect:first-afternoon-plan",
        x: 7,
        y: 6,
      },
      {
        id: "action:reflect:first-afternoon-pump",
        kind: "action",
        label: "weigh the pump",
        actionId: "reflect:first-afternoon-pump",
        x: 7,
        y: 6,
      },
    ],
    portals: [
      {
        id: "portal-boarding-house-to-street",
        label: "Exit to South Quay",
        locationId: "boarding-house",
        actionId: "exit:boarding-house",
        reversePortalId: "portal-street-to-boarding-house",
        fromSpaceId: BOARDING_HOUSE_SPACE_ID,
        from: { x: 6, y: 8 },
        toSpaceId: STREET_SPACE_ID,
        to: { x: 3, y: 9 },
      },
    ],
  });
}

function buildTeaHouseSpace(): SpaceDefinition {
  return createInteriorSpace({
    id: TEA_HOUSE_SPACE_ID,
    name: "Kettle & Lamp",
    locationId: "tea-house",
    width: 14,
    height: 10,
    objects: [
      ...wallObjects("tea-house", 14, 10),
      {
        id: "tea-house-counter",
        kind: "counter",
        label: "service counter",
        x: 9,
        y: 2,
        width: 4,
        height: 1,
        solid: true,
      },
      {
        id: "tea-house-back-counter",
        kind: "counter",
        label: "back counter",
        x: 11,
        y: 3,
        width: 2,
        height: 2,
        solid: true,
      },
      {
        id: "tea-house-stove",
        kind: "stove",
        label: "kettle stove",
        x: 10,
        y: 6,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "tea-house-north-table",
        kind: "table",
        label: "window table",
        x: 3,
        y: 3,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "tea-house-middle-table",
        kind: "table",
        label: "middle table",
        x: 5,
        y: 5,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "tea-house-south-table",
        kind: "table",
        label: "corner table",
        x: 3,
        y: 7,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "tea-house-queue-rug",
        kind: "rug",
        label: "queue line",
        x: 7,
        y: 3,
        width: 1,
        height: 5,
        solid: false,
      },
    ],
    anchors: [
      {
        id: "spawn:tea-house",
        kind: "spawn",
        label: "entry",
        x: 7,
        y: 8,
      },
      {
        id: "portal:exit:tea-house",
        kind: "portal",
        label: "street door",
        actionId: "exit:tea-house",
        x: 7,
        y: 8,
      },
      {
        id: "npc:npc-ada",
        kind: "npc",
        label: "Ada",
        npcId: "npc-ada",
        x: 8,
        y: 4,
      },
      {
        id: "action:talk:npc-ada",
        kind: "action",
        label: "talk with Ada",
        actionId: "talk:npc-ada",
        x: 7,
        y: 4,
      },
      {
        id: "action:accept:job-tea-shift",
        kind: "action",
        label: "Ada's offer",
        actionId: "accept:job-tea-shift",
        x: 7,
        y: 4,
      },
      {
        id: "action:work:job-tea-shift",
        kind: "action",
        label: "counter shift",
        actionId: "work:job-tea-shift",
        x: 8,
        y: 3,
      },
      {
        id: "action:reflect:first-afternoon-compare",
        kind: "action",
        label: "compare leads",
        actionId: "reflect:first-afternoon-compare",
        x: 7,
        y: 5,
      },
    ],
    portals: [
      {
        id: "portal-tea-house-to-street",
        label: "Exit to South Quay",
        locationId: "tea-house",
        actionId: "exit:tea-house",
        reversePortalId: "portal-street-to-tea-house",
        fromSpaceId: TEA_HOUSE_SPACE_ID,
        from: { x: 7, y: 8 },
        toSpaceId: STREET_SPACE_ID,
        to: { x: 6, y: 4 },
      },
    ],
  });
}

function buildRepairStallSpace(): SpaceDefinition {
  return createInteriorSpace({
    id: REPAIR_STALL_SPACE_ID,
    name: "Mercer Repairs",
    locationId: "repair-stall",
    width: 12,
    height: 9,
    objects: [
      ...wallObjects("repair-stall", 12, 9),
      {
        id: "repair-stall-counter",
        kind: "counter",
        label: "parts counter",
        x: 2,
        y: 3,
        width: 4,
        height: 1,
        solid: true,
      },
      {
        id: "repair-stall-workbench",
        kind: "workbench",
        label: "workbench",
        x: 8,
        y: 2,
        width: 2,
        height: 2,
        solid: true,
      },
      {
        id: "repair-stall-shelf",
        kind: "shelf",
        label: "tools shelf",
        x: 9,
        y: 5,
        width: 1,
        height: 2,
        solid: true,
      },
      {
        id: "repair-stall-bench",
        kind: "bench",
        label: "waiting bench",
        x: 2,
        y: 6,
        width: 2,
        height: 1,
        solid: true,
      },
      {
        id: "repair-stall-oil-mat",
        kind: "rug",
        label: "oil mat",
        x: 6,
        y: 4,
        width: 2,
        height: 2,
        solid: false,
      },
    ],
    anchors: [
      {
        id: "spawn:repair-stall",
        kind: "spawn",
        label: "entry",
        x: 6,
        y: 7,
      },
      {
        id: "portal:exit:repair-stall",
        kind: "portal",
        label: "street door",
        actionId: "exit:repair-stall",
        x: 6,
        y: 7,
      },
      {
        id: "npc:npc-jo",
        kind: "npc",
        label: "Jo",
        npcId: "npc-jo",
        x: 6,
        y: 3,
      },
      {
        id: "action:talk:npc-jo",
        kind: "action",
        label: "talk with Jo",
        actionId: "talk:npc-jo",
        x: 6,
        y: 4,
      },
      {
        id: "action:buy:item-wrench",
        kind: "action",
        label: "old wrench",
        actionId: "buy:item-wrench",
        x: 7,
        y: 3,
      },
    ],
    portals: [
      {
        id: "portal-repair-stall-to-street",
        label: "Exit to South Quay",
        locationId: "repair-stall",
        actionId: "exit:repair-stall",
        reversePortalId: "portal-street-to-repair-stall",
        fromSpaceId: REPAIR_STALL_SPACE_ID,
        from: { x: 6, y: 7 },
        toSpaceId: STREET_SPACE_ID,
        to: { x: 16, y: 9 },
      },
    ],
  });
}

function createInteriorSpace({
  id,
  name,
  locationId,
  width,
  height,
  objects,
  anchors,
  portals,
}: {
  id: string;
  name: string;
  locationId: string;
  width: number;
  height: number;
  objects: SpaceObject[];
  anchors: SpaceAnchor[];
  portals: SpacePortal[];
}): SpaceDefinition {
  const solidObjects = objects.filter((object) => object.solid);
  const tiles: MapTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const blocked = solidObjects.some((object) =>
        pointInsideObject(x, y, object),
      );
      tiles.push({
        x,
        y,
        kind: blocked ? "wall" : "floor",
        walkable: !blocked,
        locationId,
      });
    }
  }

  return {
    id,
    name,
    kind: "interior",
    locationId,
    width,
    height,
    tiles,
    objects,
    anchors,
    portals,
    camera: {
      minZoom: 0.7,
      maxZoom: 1.75,
    },
  };
}

function wallObjects(prefix: string, width: number, height: number) {
  return [
    {
      id: `${prefix}-wall-north`,
      kind: "wall",
      x: 0,
      y: 0,
      width,
      height: 1,
      solid: true,
    },
    {
      id: `${prefix}-wall-south`,
      kind: "wall",
      x: 0,
      y: height - 1,
      width,
      height: 1,
      solid: true,
    },
    {
      id: `${prefix}-wall-west`,
      kind: "wall",
      x: 0,
      y: 0,
      width: 1,
      height,
      solid: true,
    },
    {
      id: `${prefix}-wall-east`,
      kind: "wall",
      x: width - 1,
      y: 0,
      width: 1,
      height,
      solid: true,
    },
  ] satisfies SpaceObject[];
}

function pointInsideObject(x: number, y: number, object: SpaceObject) {
  return (
    x >= object.x &&
    x < object.x + object.width &&
    y >= object.y &&
    y < object.y + object.height
  );
}
