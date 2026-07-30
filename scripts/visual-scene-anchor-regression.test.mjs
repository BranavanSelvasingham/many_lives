import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TSX_LOADER = fileURLToPath(
  new URL(
    "../apps/sim-server/node_modules/tsx/dist/loader.mjs",
    import.meta.url,
  ),
);

const inspectionSource = String.raw`
  import * as visualScenesNamespace from "./apps/many-lives-web/src/lib/street/visualScenes.ts";
  import * as visualContractNamespace from "./apps/many-lives-web/src/lib/street/southQuayVisualContract.ts";

  const visualScenesModule =
    visualScenesNamespace.default ?? visualScenesNamespace;
  const visualContractModule =
    visualContractNamespace.default ?? visualContractNamespace;
  const {
    cloneVisualSceneDocument,
    collectVisualSceneWarnings,
    getVisualScene,
    getVisualSceneDocument,
  } = visualScenesModule;
  const {
    collectSouthQuayVisualContractDiagnostics,
    SOUTH_QUAY_VISUAL_CONTRACT_REVISION,
    SOUTH_QUAY_VISUAL_CONTRACT_SOURCE,
  } = visualContractModule;

  const authoredScene = getVisualSceneDocument("south-quay-v2");
  if (!authoredScene?.visualContract) {
    throw new Error("South Quay v2 did not expose its executable visual contract.");
  }

  const contract = authoredScene.visualContract;
  const byLocation = (items) => Object.fromEntries(
    contract.landmarkIntents.map((intent) => [
      intent.locationId,
      items
        .filter((item) => item.locationId === intent.locationId)
        .map((item) => item.kind)
        .sort(),
    ]),
  );
  const rectContainsPoint = (rect, point) =>
    Boolean(
      rect &&
      point &&
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  const rectContainsRect = (outer, inner) =>
    Boolean(
      outer &&
      inner &&
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  const secondaryLandmarkAlignment = [
    {
      clusterId: "courtyard-morrow-yard-service",
      locationId: "courtyard",
      surfaceId: "surface-morrow-yard",
    },
    {
      clusterId: "moss-pier-first-morning-mooring",
      locationId: "moss-pier",
      surfaceId: "surface-pilgrim-dock",
    },
  ].map(({ clusterId, locationId, surfaceId }) => {
    const intent = contract.landmarkIntents.find(
      (candidate) => candidate.locationId === locationId,
    );
    const landmark = authoredScene.landmarks.find(
      (candidate) => candidate.locationId === locationId,
    );
    const anchors = authoredScene.locationAnchors[locationId];
    const cluster = authoredScene.propClusters.find(
      (candidate) => candidate.id === clusterId,
    );
    const surface = authoredScene.surfaceZones.find(
      (candidate) => candidate.id === surfaceId,
    );
    const endpoint = anchors?.[intent?.routeEndpoint];
    return {
      clusterContained: rectContainsRect(landmark?.rect, cluster?.rect),
      endpointInsideLandmark: rectContainsPoint(landmark?.rect, endpoint),
      highlightContainsLandmark: rectContainsRect(
        anchors?.highlight,
        landmark?.rect,
      ),
      locationId,
      surfaceContained: rectContainsRect(landmark?.rect, surface?.rect),
    };
  });
  const eastChannelMooring = authoredScene.propClusters.find(
    (cluster) => cluster.id === "east-channel-mooring-bays",
  );
  const routeEndpoints = contract.landmarkIntents.map((intent) => {
    const anchors = authoredScene.locationAnchors[intent.locationId];
    const endpoint = anchors?.[intent.routeEndpoint];
    const highlight = anchors?.highlight;
    const aligned = Boolean(
      endpoint &&
      highlight &&
      endpoint.x >= highlight.x &&
      endpoint.x <= highlight.x + highlight.width &&
      endpoint.y >= highlight.y &&
      endpoint.y <= highlight.y + highlight.height
    );
    return {
      aligned,
      endpoint,
      locationId: intent.locationId,
      routeEndpoint: intent.routeEndpoint,
    };
  });

  const npcStandChecks = [
    ["npc-ada", "tea-house"],
    ["npc-jo", "repair-stall"],
    ["npc-tomas", "freight-yard"],
  ].map(([npcId, locationId]) => {
    const npc = authoredScene.npcAnchors[npcId];
    const stands = authoredScene.locationAnchors[locationId]?.npcStands ?? [];
    return {
      locationId,
      npcId,
      aligned: stands.some(
        (stand) => Math.hypot(stand.x - npc.x, stand.y - npc.y) < 1,
      ),
    };
  });

  const validOverride = cloneVisualSceneDocument(authoredScene);
  validOverride.backgroundColor = "#10242b";
  const storage = new Map([
    [
      "many-lives.visual-scene-runtime.south-quay-v2",
      JSON.stringify(validOverride),
    ],
  ]);
  globalThis.window = {
    dispatchEvent() {},
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      removeItem(key) {
        storage.delete(key);
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };

  const runtimeDiagnostics = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    runtimeDiagnostics.push(
      args
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value),
        )
        .join(" "),
    );
  };
  const validRuntimeScene = getVisualScene("south-quay-v2");

  const weakenedOverride = cloneVisualSceneDocument(authoredScene);
  weakenedOverride.visualContract.landmarkIntents =
    weakenedOverride.visualContract.landmarkIntents.map((intent) =>
      intent.locationId === "repair-stall"
        ? { ...intent, requiredModuleKinds: [] }
        : intent,
    );
  storage.set(
    "many-lives.visual-scene-runtime.south-quay-v2",
    JSON.stringify(weakenedOverride),
  );
  const weakenedRuntimeScene = getVisualScene("south-quay-v2");

  const invalidOverride = cloneVisualSceneDocument(authoredScene);
  invalidOverride.visualContract = {
    ...invalidOverride.visualContract,
    revision: "disconnected-runtime-plan",
  };
  storage.set(
    "many-lives.visual-scene-runtime.south-quay-v2",
    JSON.stringify(invalidOverride),
  );
  const runtimeScene = getVisualScene("south-quay-v2");
  console.warn = originalWarn;
  delete globalThis.window;

  console.log(JSON.stringify({
    authoredWarnings: collectVisualSceneWarnings(authoredScene),
    clusterKindsByLocation: byLocation(authoredScene.propClusters),
    contractDiagnostics: collectSouthQuayVisualContractDiagnostics(authoredScene),
    contractRevision: contract.revision,
    contractSource: contract.source,
    eastChannelMooring,
    expectedRevision: SOUTH_QUAY_VISUAL_CONTRACT_REVISION,
    expectedSource: SOUTH_QUAY_VISUAL_CONTRACT_SOURCE,
    fringeEdges: [...new Set(authoredScene.fringeZones.map((zone) => zone.edge))].sort(),
    fringeIds: authoredScene.fringeZones.map((zone) => zone.id).sort(),
    invalidOverrideFallback: runtimeScene === authoredScene,
    landmarkLocations: contract.landmarkIntents.map((intent) => intent.locationId).sort(),
    moduleKindsByLocation: byLocation(authoredScene.landmarkModules),
    npcStandChecks,
    routeEndpoints,
    runtimeDiagnostics,
    schemaVersion: contract.schemaVersion,
    secondaryLandmarkAlignment,
    surfaceIds: authoredScene.surfaceZones.map((zone) => zone.id).sort(),
    surfaceKinds: [...new Set(authoredScene.surfaceZones.map((zone) => zone.kind))].sort(),
    validOverrideAccepted:
      validRuntimeScene !== authoredScene &&
      validRuntimeScene?.backgroundColor === validOverride.backgroundColor &&
      validRuntimeScene?.visualContract?.revision === contract.revision,
    weakenedOverrideFallback: weakenedRuntimeScene === authoredScene,
  }));
`;

const evidence = JSON.parse(
  execFileSync(
    process.execPath,
    ["--import", TSX_LOADER, "--input-type=module", "--eval", inspectionSource],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  ),
);

test("South Quay v2 file scene executes the current contract without warnings", () => {
  assert.equal(evidence.contractSource, evidence.expectedSource);
  assert.equal(evidence.contractRevision, evidence.expectedRevision);
  assert.equal(evidence.schemaVersion, 1);
  assert.deepEqual(evidence.contractDiagnostics, []);
  assert.deepEqual(evidence.authoredWarnings, []);
});

test("South Quay v2 contract references every required authored visual intent", () => {
  assert.deepEqual(evidence.landmarkLocations, [
    "boarding-house",
    "courtyard",
    "freight-yard",
    "market-square",
    "moss-pier",
    "repair-stall",
    "tea-house",
  ]);
  assert.deepEqual(evidence.fringeEdges, ["east", "north", "south", "west"]);
  assert.ok(evidence.fringeIds.length >= 6);

  for (const kind of [
    "courtyard_ground",
    "deep_water",
    "dock_apron",
    "main_street",
    "quay_wall",
    "service_lane",
    "square_center",
  ]) {
    assert.ok(evidence.surfaceKinds.includes(kind), `missing surface ${kind}`);
  }

  for (const kind of [
    "roof_cap",
    "service_bay",
    "shutters",
    "sign",
    "wall_band",
  ]) {
    assert.ok(
      evidence.moduleKindsByLocation["repair-stall"].includes(kind),
      `Mercer Repairs is missing ${kind}`,
    );
  }
  assert.ok(
    evidence.clusterKindsByLocation["repair-stall"].includes("workshop_stock"),
  );
  assert.ok(evidence.clusterKindsByLocation.courtyard.includes("yard_service"));
  assert.ok(
    evidence.clusterKindsByLocation["moss-pier"].includes("harbor_mooring"),
  );
});

test("invalid runtime scene override fails closed with explicit diagnostics", () => {
  assert.equal(evidence.invalidOverrideFallback, true);
  assert.ok(evidence.runtimeDiagnostics.length > 0);
  assert.match(
    evidence.runtimeDiagnostics.join("\n"),
    /validated authored scene/,
  );
  assert.match(
    evidence.runtimeDiagnostics.join("\n"),
    /contract-revision-mismatch/,
  );
  assert.equal(evidence.weakenedOverrideFallback, true);
  assert.match(
    evidence.runtimeDiagnostics.join("\n"),
    /Contract omitted required module service_bay/,
  );
});

test("contract-valid runtime scene override uses the same executable authority", () => {
  assert.equal(evidence.validOverrideAccepted, true);
});

test("contract route endpoints and named NPC stands stay aligned", () => {
  assert.ok(evidence.routeEndpoints.length >= 7);
  for (const endpoint of evidence.routeEndpoints) {
    assert.equal(
      endpoint.aligned,
      true,
      `${endpoint.locationId} ${endpoint.routeEndpoint} detached from landmark`,
    );
  }
  for (const check of evidence.npcStandChecks) {
    assert.equal(
      check.aligned,
      true,
      `${check.npcId} detached from ${check.locationId} stand`,
    );
  }
});

test("secondary landmark footprints contain their endpoints and authored props", () => {
  assert.deepEqual(evidence.secondaryLandmarkAlignment, [
    {
      clusterContained: true,
      endpointInsideLandmark: true,
      highlightContainsLandmark: true,
      locationId: "courtyard",
      surfaceContained: true,
    },
    {
      clusterContained: true,
      endpointInsideLandmark: true,
      highlightContainsLandmark: true,
      locationId: "moss-pier",
      surfaceContained: true,
    },
  ]);
});

test("Pilgrim Slip realignment preserves the authored east-channel mooring bays", () => {
  assert.deepEqual(evidence.eastChannelMooring?.rect, {
    height: 610,
    radius: 12,
    width: 192,
    x: 1576,
    y: 446,
  });
  assert.deepEqual(evidence.eastChannelMooring?.points, [
    { x: 1718, y: 488 },
    { x: 1718, y: 765 },
    { x: 1718, y: 1014 },
  ]);
});
