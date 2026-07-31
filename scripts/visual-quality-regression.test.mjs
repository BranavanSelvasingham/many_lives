import assert from "node:assert/strict";
import test from "node:test";

import {
  assertVisualQualityRegressionEvidence,
  createVisualQualityRegressionEvidence,
} from "./visual-quality-regression.mjs";

const baseResult = {
  eventCues: [{ cue: "cafe" }, { cue: "square" }, { cue: "quay" }],
  mapAgency: {
    target: {
      label: "Next: Morrow House",
      locationId: "boarding-house",
      x: 222,
      y: 584,
    },
  },
  page: {
    dockRoot: { height: 54, width: 358, x: 16, y: 775 },
    rightStack: { height: 144, width: 358, x: 16, y: 620 },
    visualHierarchy: {
      actorLabels: { npcs: [{ lineCount: 1 }, { lineCount: 1 }] },
      contextualCues: ["route-target"],
      persistentIdentityTreatments: ["you-label"],
    },
  },
  playerLocationGeometry: {
    anchorLocationId: "boarding-house",
    anchorWorldPoint: { x: 222, y: 584 },
  },
  scheduledNpcVisualCues: [{}, {}, {}],
  viewport: { height: 844, name: "mobile", width: 390 },
};

function controlEvidence() {
  return createVisualQualityRegressionEvidence({
    fringeCompositionDiagnostics: [
      {
        activeColorBins: 24,
        dominantColorFraction: 0.34,
        label: "north fringe",
        luminanceRange: 92,
        paleVoidFraction: 0.01,
        region: "north-fringe",
      },
      {
        activeColorBins: 22,
        dominantColorFraction: 0.31,
        label: "west lot",
        luminanceRange: 88,
        paleVoidFraction: 0.02,
        region: "west-open-lot",
      },
    ],
    interiorIdentityDiagnostics: [
      {
        activeColorBins: 23,
        detailTransitionFraction: 0.036,
        dominantColorFraction: 0.334,
        fractions: {
          coolMetal: 0.013,
          darkHardware: 0.508,
          goldAccent: 0.382,
          rustAccent: 0.481,
          warmMaterial: 0.513,
        },
        label: "Kettle & Lamp interior desktop",
        luminanceRange: 117.4,
        role: "tea-house",
      },
      {
        activeColorBins: 20,
        detailTransitionFraction: 0.038,
        dominantColorFraction: 0.439,
        fractions: {
          coolMetal: 0.853,
          darkHardware: 0.612,
          goldAccent: 0.003,
          rustAccent: 0.022,
          warmMaterial: 0.027,
        },
        label: "Mercer Repairs interior desktop",
        luminanceRange: 102.3,
        role: "repair-stall",
      },
    ],
    results: [structuredClone(baseResult)],
    screenshotPixelDiagnostics: [
      {
        label: "mobile initial",
        largestNearBlackComponent: {
          area: 180,
          bottom: 112,
          left: 20,
          right: 35,
          top: 100,
        },
        viewport: { height: 844, name: "mobile", width: 390 },
      },
    ],
    secondaryLandmarkCompositionDiagnostics: [
      {
        activeColorBins: 51,
        coolUtilityFraction: 0.036,
        dominantColorFraction: 0.315,
        label: "Morrow Yard",
        luminanceRange: 160.9,
        paleVoidFraction: 0.007,
        region: "morrow-yard",
        warmDetailFraction: 0.518,
        waterMaterialFraction: 0,
      },
      {
        activeColorBins: 57,
        coolUtilityFraction: 0.038,
        dominantColorFraction: 0.204,
        label: "Pilgrim Slip",
        luminanceRange: 130.8,
        paleVoidFraction: 0,
        region: "pilgrim-slip",
        warmDetailFraction: 0.651,
        waterMaterialFraction: 0.15,
      },
    ],
  });
}

const degradationCases = [
  {
    category: "landmark-identity-loss",
    degrade(evidence) {
      evidence.landmarks.find(
        (entry) => entry.region === "morrow-yard",
      ).coolUtilityFraction = 0;
    },
  },
  {
    category: "interior-identity-loss",
    degrade(evidence) {
      evidence.interiors.find(
        (entry) => entry.role === "tea-house",
      ).fractions.warmMaterial = 0;
    },
  },
  {
    category: "major-composition-or-dropout",
    degrade(evidence) {
      evidence.composition[0].dominantColorFraction = 0.99;
    },
  },
  {
    category: "overlay-intersection",
    degrade(evidence) {
      evidence.overlays[0].dock = {
        height: 80,
        width: 358,
        x: 16,
        y: 700,
      };
    },
  },
  {
    category: "excessive-cue-noise",
    degrade(evidence) {
      evidence.visualCues[0].contextualCueCount = 3;
    },
  },
  {
    category: "route-label-detachment",
    degrade(evidence) {
      evidence.routes[0].targetWorldPoint.x += 180;
    },
  },
];

test("VQ-10 control fixture passes every production-path invariant", () => {
  const result = assertVisualQualityRegressionEvidence(controlEvidence());
  assert.equal(result.status, "passed");
  assert.deepEqual(result.counts, {
    composition: 4,
    dropouts: 1,
    interiors: 2,
    landmarks: 2,
    overlays: 1,
    routes: 1,
    visualCues: 1,
  });
});

test("VQ-10 permits a production-shaped tall narrow over-area component", () => {
  const evidence = controlEvidence();
  evidence.dropouts[0].component = {
    area: 4_000,
    bottom: 500,
    left: 20,
    right: 30,
    top: 100,
  };
  assert.equal(
    assertVisualQualityRegressionEvidence(evidence).status,
    "passed",
  );
});

test("VQ-10 rejects a production-shaped broad visual dropout", () => {
  const evidence = controlEvidence();
  evidence.dropouts[0].component = {
    area: 36_000,
    bottom: 280,
    left: 20,
    right: 220,
    top: 100,
  };
  assert.throws(
    () => assertVisualQualityRegressionEvidence(evidence),
    (error) => {
      assert.match(
        error.message,
        /\[VQ-10\/major-composition-or-dropout\].*major visual dropout/,
      );
      assert.match(error.message, /"width":200/);
      assert.match(error.message, /"height":180/);
      return true;
    },
  );
});

for (const fixture of degradationCases) {
  test(`VQ-10 rejects ${fixture.name ?? fixture.category}`, () => {
    const evidence = controlEvidence();
    fixture.degrade(evidence);
    assert.throws(
      () => assertVisualQualityRegressionEvidence(evidence),
      new RegExp(`\\[VQ-10/${fixture.category}\\]`),
    );
  });
}
