export const SOUTH_QUAY_VISUAL_CONTRACT_SOURCE =
  "south-quay-v2-document" as const;

export const SOUTH_QUAY_VISUAL_CONTRACT_REVISION =
  "f6-f7-2026-07-11.1" as const;

export type SouthQuaySemanticLandmarkRole =
  | "boarding_house"
  | "civic_square"
  | "eatery"
  | "freight_yard"
  | "harbor_slip"
  | "service_yard"
  | "workshop";

export type SouthQuaySemanticAssetIntent =
  | "boarding_frontage"
  | "cast_iron_lamp"
  | "dock_edge"
  | "domestic_service_yard"
  | "eatery_frontage"
  | "freight_yard_frontage"
  | "harbor_mooring"
  | "menu_board"
  | "planter_box"
  | "quay_paving"
  | "row_boat"
  | "square_paving"
  | "terrace_table"
  | "workshop_frontage"
  | "workshop_stock";

export type SouthQuayLandmarkModuleKind =
  | "awning"
  | "downspout"
  | "entry"
  | "roof_cap"
  | "service_bay"
  | "shutters"
  | "sign"
  | "stoop"
  | "terrace_rail"
  | "trim"
  | "wall_band"
  | "window_row";

export type SouthQuayPropClusterKind =
  | "cafe_terrace"
  | "harbor_mooring"
  | "square_bench_pair"
  | "square_planter_pair"
  | "workshop_stock"
  | "yard_service";

export type SouthQuaySurfaceZoneKind =
  | "courtyard_ground"
  | "deep_water"
  | "dock_apron"
  | "main_street"
  | "north_promenade"
  | "quay_wall"
  | "service_lane"
  | "square_border"
  | "square_center"
  | "west_lane";

export type SouthQuayFringeZoneKind =
  | "alley_mouth"
  | "neighbor_facade"
  | "quay_continuation"
  | "side_street";

export type SouthQuayVisualContract = {
  fringeIntents: Array<{
    edge: "east" | "north" | "south" | "west";
    kind: SouthQuayFringeZoneKind;
    zoneId: string;
  }>;
  landmarkIntents: Array<{
    assetIntents: SouthQuaySemanticAssetIntent[];
    locationId: string;
    name: string;
    requiredClusterKinds: SouthQuayPropClusterKind[];
    requiredModuleKinds: SouthQuayLandmarkModuleKind[];
    role: SouthQuaySemanticLandmarkRole;
    routeEndpoint: "door" | "frontage";
  }>;
  revision: typeof SOUTH_QUAY_VISUAL_CONTRACT_REVISION;
  schemaVersion: 1;
  source: typeof SOUTH_QUAY_VISUAL_CONTRACT_SOURCE;
  surfaceIntents: Array<{
    kind: SouthQuaySurfaceZoneKind;
    zoneId: string;
  }>;
};

export type SouthQuayVisualContractDiagnostic = {
  code:
    | "contract-field-invalid"
    | "contract-reference-missing"
    | "contract-requirement-missing"
    | "contract-revision-mismatch"
    | "contract-source-mismatch";
  message: string;
  path: string;
};

type ContractLandmarkRecord = {
  locationId?: unknown;
  rect?: { height?: unknown; width?: unknown; x?: unknown; y?: unknown };
};

type ContractScene = {
  fringeZones?: Array<{ edge?: unknown; id?: unknown; kind?: unknown }>;
  id?: unknown;
  landmarkModules?: Array<{ kind?: unknown; locationId?: unknown }>;
  landmarks?: ContractLandmarkRecord[];
  locationAnchors?: Record<string, unknown>;
  propClusters?: Array<{ kind?: unknown; locationId?: unknown }>;
  surfaceZones?: Array<{ id?: unknown; kind?: unknown }>;
  visualContract?: unknown;
};

const REQUIRED_ROLE_BY_LOCATION = {
  "boarding-house": "boarding_house",
  courtyard: "service_yard",
  "freight-yard": "freight_yard",
  "market-square": "civic_square",
  "moss-pier": "harbor_slip",
  "repair-stall": "workshop",
  "tea-house": "eatery",
} as const satisfies Record<string, SouthQuaySemanticLandmarkRole>;

const REQUIRED_ASSET_INTENTS_BY_LOCATION = {
  "boarding-house": ["boarding_frontage"],
  courtyard: ["domestic_service_yard"],
  "freight-yard": ["freight_yard_frontage"],
  "market-square": ["square_paving", "cast_iron_lamp", "planter_box"],
  "moss-pier": ["dock_edge", "harbor_mooring", "row_boat"],
  "repair-stall": ["workshop_frontage", "workshop_stock"],
  "tea-house": [
    "eatery_frontage",
    "terrace_table",
    "menu_board",
    "planter_box",
  ],
} as const satisfies Partial<
  Record<string, readonly SouthQuaySemanticAssetIntent[]>
>;

const REQUIRED_MODULE_KINDS_BY_LOCATION = {
  "boarding-house": ["entry", "stoop", "window_row"],
  "freight-yard": ["service_bay", "shutters", "sign"],
  "repair-stall": ["service_bay", "shutters", "sign"],
  "tea-house": ["awning", "entry", "sign", "terrace_rail", "window_row"],
} as const satisfies Partial<
  Record<string, readonly SouthQuayLandmarkModuleKind[]>
>;

const REQUIRED_CLUSTER_KINDS_BY_LOCATION = {
  courtyard: ["yard_service"],
  "market-square": ["square_bench_pair", "square_planter_pair"],
  "moss-pier": ["harbor_mooring"],
  "repair-stall": ["workshop_stock"],
  "tea-house": ["cafe_terrace"],
} as const satisfies Partial<
  Record<string, readonly SouthQuayPropClusterKind[]>
>;

const REQUIRED_SURFACE_KINDS = [
  "courtyard_ground",
  "deep_water",
  "dock_apron",
  "main_street",
  "quay_wall",
  "service_lane",
  "square_center",
] as const satisfies readonly SouthQuaySurfaceZoneKind[];

const REQUIRED_FRINGE_EDGES = ["east", "north", "south", "west"] as const;

export class SouthQuayVisualContractError extends Error {
  readonly diagnostics: SouthQuayVisualContractDiagnostic[];

  constructor(diagnostics: SouthQuayVisualContractDiagnostic[]) {
    super(
      `South Quay visual contract failed: ${diagnostics
        .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
        .join("; ")}`,
    );
    this.name = "SouthQuayVisualContractError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDiagnostic(
  diagnostics: SouthQuayVisualContractDiagnostic[],
  diagnostic: SouthQuayVisualContractDiagnostic,
) {
  diagnostics.push(diagnostic);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function routeEndpointAligns(anchorRecord: unknown, routeEndpoint: unknown) {
  if (
    !isRecord(anchorRecord) ||
    (routeEndpoint !== "door" && routeEndpoint !== "frontage") ||
    !isRecord(anchorRecord[routeEndpoint]) ||
    !isRecord(anchorRecord.highlight)
  ) {
    return false;
  }

  const point = anchorRecord[routeEndpoint];
  const rect = anchorRecord.highlight;
  if (
    !isFiniteNumber(point.x) ||
    !isFiniteNumber(point.y) ||
    !isFiniteNumber(rect.x) ||
    !isFiniteNumber(rect.y) ||
    !isFiniteNumber(rect.width) ||
    !isFiniteNumber(rect.height)
  ) {
    return false;
  }

  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function collectSouthQuayVisualContractDiagnostics(
  scene: ContractScene,
): SouthQuayVisualContractDiagnostic[] {
  const diagnostics: SouthQuayVisualContractDiagnostic[] = [];
  const contract = scene.visualContract;

  if (!isRecord(contract)) {
    addDiagnostic(diagnostics, {
      code: "contract-field-invalid",
      message: "Missing executable visualContract object.",
      path: "visualContract",
    });
    return diagnostics;
  }

  if (contract.source !== SOUTH_QUAY_VISUAL_CONTRACT_SOURCE) {
    addDiagnostic(diagnostics, {
      code: "contract-source-mismatch",
      message: `Expected ${SOUTH_QUAY_VISUAL_CONTRACT_SOURCE}.`,
      path: "visualContract.source",
    });
  }

  if (contract.revision !== SOUTH_QUAY_VISUAL_CONTRACT_REVISION) {
    addDiagnostic(diagnostics, {
      code: "contract-revision-mismatch",
      message: `Expected ${SOUTH_QUAY_VISUAL_CONTRACT_REVISION}.`,
      path: "visualContract.revision",
    });
  }

  if (contract.schemaVersion !== 1) {
    addDiagnostic(diagnostics, {
      code: "contract-field-invalid",
      message: "Only schemaVersion 1 is executable.",
      path: "visualContract.schemaVersion",
    });
  }

  const landmarkIntents = Array.isArray(contract.landmarkIntents)
    ? contract.landmarkIntents.filter(isRecord)
    : [];
  const surfaceIntents = Array.isArray(contract.surfaceIntents)
    ? contract.surfaceIntents.filter(isRecord)
    : [];
  const fringeIntents = Array.isArray(contract.fringeIntents)
    ? contract.fringeIntents.filter(isRecord)
    : [];

  if (!Array.isArray(contract.landmarkIntents)) {
    addDiagnostic(diagnostics, {
      code: "contract-field-invalid",
      message: "landmarkIntents must be an array.",
      path: "visualContract.landmarkIntents",
    });
  }
  if (!Array.isArray(contract.surfaceIntents)) {
    addDiagnostic(diagnostics, {
      code: "contract-field-invalid",
      message: "surfaceIntents must be an array.",
      path: "visualContract.surfaceIntents",
    });
  }
  if (!Array.isArray(contract.fringeIntents)) {
    addDiagnostic(diagnostics, {
      code: "contract-field-invalid",
      message: "fringeIntents must be an array.",
      path: "visualContract.fringeIntents",
    });
  }

  for (const [locationId, requiredRole] of Object.entries(
    REQUIRED_ROLE_BY_LOCATION,
  )) {
    const intent = landmarkIntents.find(
      (candidate) => candidate.locationId === locationId,
    );
    const path = `visualContract.landmarkIntents.${locationId}`;
    if (!intent) {
      addDiagnostic(diagnostics, {
        code: "contract-requirement-missing",
        message: "Missing required landmark intent.",
        path,
      });
      continue;
    }

    if (intent.role !== requiredRole) {
      addDiagnostic(diagnostics, {
        code: "contract-field-invalid",
        message: `Expected semantic role ${requiredRole}.`,
        path: `${path}.role`,
      });
    }

    const landmark = scene.landmarks?.find(
      (candidate) => candidate.locationId === locationId,
    );
    if (!landmark) {
      addDiagnostic(diagnostics, {
        code: "contract-reference-missing",
        message: "Referenced landmark is absent from the active scene.",
        path,
      });
    }
    const anchorRecord = scene.locationAnchors?.[locationId];
    if (!anchorRecord) {
      addDiagnostic(diagnostics, {
        code: "contract-reference-missing",
        message: "Referenced route anchors are absent from the active scene.",
        path: `${path}.routeEndpoint`,
      });
    } else if (!routeEndpointAligns(anchorRecord, intent.routeEndpoint)) {
      addDiagnostic(diagnostics, {
        code: "contract-field-invalid",
        message:
          "Declared route endpoint is invalid or detached from the landmark.",
        path: `${path}.routeEndpoint`,
      });
    }

    const assetIntents = Array.isArray(intent.assetIntents)
      ? intent.assetIntents
      : [];
    for (const requiredAssetIntent of REQUIRED_ASSET_INTENTS_BY_LOCATION[
      locationId as keyof typeof REQUIRED_ASSET_INTENTS_BY_LOCATION
    ] ?? []) {
      if (!assetIntents.includes(requiredAssetIntent)) {
        addDiagnostic(diagnostics, {
          code: "contract-requirement-missing",
          message: `Missing semantic asset intent ${requiredAssetIntent}.`,
          path: `${path}.assetIntents`,
        });
      }
    }

    const requiredModuleKinds = Array.isArray(intent.requiredModuleKinds)
      ? intent.requiredModuleKinds
      : [];
    for (const requiredKind of REQUIRED_MODULE_KINDS_BY_LOCATION[
      locationId as keyof typeof REQUIRED_MODULE_KINDS_BY_LOCATION
    ] ?? []) {
      if (!requiredModuleKinds.includes(requiredKind)) {
        addDiagnostic(diagnostics, {
          code: "contract-requirement-missing",
          message: `Contract omitted required module ${requiredKind}.`,
          path: `${path}.requiredModuleKinds`,
        });
      }
    }
    for (const kind of requiredModuleKinds) {
      if (
        !scene.landmarkModules?.some(
          (module) => module.locationId === locationId && module.kind === kind,
        )
      ) {
        addDiagnostic(diagnostics, {
          code: "contract-reference-missing",
          message: `Required module ${String(kind)} is absent from the active scene.`,
          path: `${path}.requiredModuleKinds`,
        });
      }
    }

    const requiredClusterKinds = Array.isArray(intent.requiredClusterKinds)
      ? intent.requiredClusterKinds
      : [];
    for (const requiredKind of REQUIRED_CLUSTER_KINDS_BY_LOCATION[
      locationId as keyof typeof REQUIRED_CLUSTER_KINDS_BY_LOCATION
    ] ?? []) {
      if (!requiredClusterKinds.includes(requiredKind)) {
        addDiagnostic(diagnostics, {
          code: "contract-requirement-missing",
          message: `Contract omitted required cluster ${requiredKind}.`,
          path: `${path}.requiredClusterKinds`,
        });
      }
    }
    for (const kind of requiredClusterKinds) {
      if (
        !scene.propClusters?.some(
          (cluster) =>
            cluster.locationId === locationId && cluster.kind === kind,
        )
      ) {
        addDiagnostic(diagnostics, {
          code: "contract-reference-missing",
          message: `Required cluster ${String(kind)} is absent from the active scene.`,
          path: `${path}.requiredClusterKinds`,
        });
      }
    }
  }

  for (const requiredKind of REQUIRED_SURFACE_KINDS) {
    const intent = surfaceIntents.find(
      (candidate) => candidate.kind === requiredKind,
    );
    if (!intent || typeof intent.zoneId !== "string") {
      addDiagnostic(diagnostics, {
        code: "contract-requirement-missing",
        message: `Missing ${requiredKind} surface intent.`,
        path: "visualContract.surfaceIntents",
      });
      continue;
    }
    if (
      !scene.surfaceZones?.some(
        (zone) => zone.id === intent.zoneId && zone.kind === requiredKind,
      )
    ) {
      addDiagnostic(diagnostics, {
        code: "contract-reference-missing",
        message: `Surface zone ${intent.zoneId} is absent or has the wrong kind.`,
        path: `visualContract.surfaceIntents.${intent.zoneId}`,
      });
    }
  }

  for (const requiredEdge of REQUIRED_FRINGE_EDGES) {
    const intents = fringeIntents.filter(
      (candidate) => candidate.edge === requiredEdge,
    );
    if (intents.length === 0) {
      addDiagnostic(diagnostics, {
        code: "contract-requirement-missing",
        message: `Missing ${requiredEdge} fringe intent.`,
        path: "visualContract.fringeIntents",
      });
      continue;
    }

    for (const intent of intents) {
      if (typeof intent.zoneId !== "string") {
        addDiagnostic(diagnostics, {
          code: "contract-field-invalid",
          message: "Fringe intent must reference a zoneId.",
          path: "visualContract.fringeIntents",
        });
        continue;
      }
      if (
        !scene.fringeZones?.some(
          (zone) =>
            zone.id === intent.zoneId &&
            zone.edge === requiredEdge &&
            zone.kind === intent.kind,
        )
      ) {
        addDiagnostic(diagnostics, {
          code: "contract-reference-missing",
          message: `Fringe zone ${intent.zoneId} is absent or does not match its intent.`,
          path: `visualContract.fringeIntents.${intent.zoneId}`,
        });
      }
    }
  }

  return diagnostics;
}

export function assertSouthQuayVisualContract(
  scene: ContractScene,
): asserts scene is ContractScene & {
  visualContract: SouthQuayVisualContract;
} {
  const diagnostics = collectSouthQuayVisualContractDiagnostics(scene);
  if (diagnostics.length > 0) {
    throw new SouthQuayVisualContractError(diagnostics);
  }
}

export function getSouthQuayLandmarkIntent(
  scene: { visualContract?: SouthQuayVisualContract },
  locationId: string,
) {
  return (
    scene.visualContract?.landmarkIntents.find(
      (intent) => intent.locationId === locationId,
    ) ?? null
  );
}
