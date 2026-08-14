import assert from "node:assert/strict";
import test from "node:test";

import {
  assertVisualQualityRegressionEvidence,
  createVisualQualityRegressionEvidence,
} from "./visual-quality-regression.mjs";
import { assertCollapsedRailCopyReadable } from "./visual-game-smoke.mjs";

const compactTallViewport = { height: 1041, width: 669 };

function readableCompactRailLayout(lineCount) {
  return {
    clientHeight: 30,
    clientWidth: 240,
    fullyVisible: true,
    lineClamp: "none",
    lineCount,
    overflowX: "visible",
    overflowY: "visible",
    scrollHeight: 30,
    scrollWidth: 240,
    textOverflow: "clip",
    whiteSpace: lineCount === 1 ? "nowrap" : "normal",
  };
}

function readableCompactRailPage() {
  return {
    railCopy: {
      kicker: "Many Lives • Living-world sim",
      kickerLayout: readableCompactRailLayout(1),
      peek: "South Quay • Watching Rowan",
      peekLayout: readableCompactRailLayout(1),
      thought: "Rowan is stepping inside Morrow House to ask Mara.",
      thoughtLayout: readableCompactRailLayout(2),
    },
    railState: "collapsed",
  };
}

test("compact collapsed rail accepts complete visible copy", () => {
  assert.doesNotThrow(() =>
    assertCollapsedRailCopyReadable(
      readableCompactRailPage(),
      compactTallViewport,
      "compact DPR 2",
    ),
  );
});

test("compact collapsed rail rejects CSS ellipsis and clipped thought geometry", () => {
  const ellipsized = readableCompactRailPage();
  ellipsized.railCopy.kickerLayout.textOverflow = "ellipsis";
  assert.throws(
    () =>
      assertCollapsedRailCopyReadable(
        ellipsized,
        compactTallViewport,
        "compact DPR 2",
      ),
    /uses CSS ellipsis/,
  );

  const clipped = readableCompactRailPage();
  clipped.railCopy.thoughtLayout = {
    ...clipped.railCopy.thoughtLayout,
    fullyVisible: false,
    scrollHeight: 48,
  };
  assert.throws(
    () =>
      assertCollapsedRailCopyReadable(
        clipped,
        compactTallViewport,
        "compact DPR 2",
      ),
    /is clipped or overflows/,
  );
});

test("compact collapsed rail rejects authored and mid-sentence truncation", () => {
  const authoredEllipsis = readableCompactRailPage();
  authoredEllipsis.railCopy.thought = "Rowan is stepping inside...";
  assert.throws(
    () =>
      assertCollapsedRailCopyReadable(
        authoredEllipsis,
        compactTallViewport,
        "compact DPR 2",
      ),
    /contains authored truncation/,
  );

  const incomplete = readableCompactRailPage();
  incomplete.railCopy.thought = "Rowan is stepping inside Morrow House";
  assert.throws(
    () =>
      assertCollapsedRailCopyReadable(
        incomplete,
        compactTallViewport,
        "compact DPR 2",
      ),
    /ends mid-sentence/,
  );
});

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
        activeColorBins: 26,
        detailTransitionFraction: 0.041,
        dominantColorFraction: 0.312,
        fractions: {
          coolMetal: 0.018,
          darkHardware: 0.246,
          domesticTextile: 0.092,
          goldAccent: 0.024,
          rustAccent: 0.211,
          warmMaterial: 0.438,
        },
        label: "Morrow House interior mobile",
        luminanceRange: 124.2,
        role: "boarding-house",
      },
      {
        activeColorBins: 23,
        detailTransitionFraction: 0.036,
        dominantColorFraction: 0.334,
        fractions: {
          coolMetal: 0.013,
          darkHardware: 0.508,
          domesticTextile: 0.009,
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
          domesticTextile: 0.031,
          goldAccent: 0.003,
          rustAccent: 0.022,
          warmMaterial: 0.027,
        },
        label: "Mercer Repairs interior desktop",
        luminanceRange: 102.3,
        role: "repair-stall",
      },
    ],
    interiorActorVisibilityDiagnostics: [
      {
        actors: {
          mara: {
            bounds: {
              bottom: 321,
              height: 81,
              left: 28,
              right: 88,
              top: 240,
              width: 60,
            },
            clearance: 24,
            requiredMargin: 20,
            unobscured: true,
          },
          portal: {
            clearance: 36.75,
            requiredMargin: 24,
            unobscured: true,
          },
          rowan: {
            bounds: {
              bottom: 326,
              height: 92,
              left: 105,
              right: 173,
              top: 234,
              width: 68,
            },
            clearance: 28,
            requiredMargin: 20,
            unobscured: true,
          },
        },
        playerWorldPoint: { x: 356, y: 396 },
        relevantActorId: "npc-mara",
        role: "boarding-house",
        stateId: "entrance",
        viewport: "mobile",
      },
      {
        actors: {
          mara: {
            bounds: {
              bottom: 321,
              height: 81,
              left: 30,
              right: 90,
              top: 240,
              width: 60,
            },
            clearance: 22,
            requiredMargin: 20,
            unobscured: true,
          },
          portal: {
            clearance: 38,
            requiredMargin: 24,
            unobscured: true,
          },
          rowan: {
            bounds: {
              bottom: 326,
              height: 92,
              left: 98,
              right: 166,
              top: 234,
              width: 68,
            },
            clearance: 30,
            requiredMargin: 20,
            unobscured: true,
          },
        },
        playerWorldPoint: { x: 316, y: 276 },
        relevantActorId: "npc-mara",
        role: "boarding-house",
        stateId: "near-mara",
        viewport: "mobile",
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
    name: "boarding-house identity loss",
    degrade(evidence) {
      evidence.interiors.find(
        (entry) => entry.role === "boarding-house",
      ).fractions.domesticTextile = 0;
    },
  },
  {
    category: "interior-identity-loss",
    name: "tea-house identity loss",
    degrade(evidence) {
      evidence.interiors.find(
        (entry) => entry.role === "tea-house",
      ).fractions.warmMaterial = 0;
    },
  },
  {
    category: "interior-actor-visibility",
    name: "relevant interior actor bounds clearance",
    degrade(evidence) {
      evidence.interiorActors[0].relevantActorClearance = 8;
    },
  },
  {
    category: "interior-actor-visibility",
    name: "alternate-state Mara bounds clearance",
    degrade(evidence) {
      evidence.interiorActors.find(
        (entry) => entry.stateId === "near-mara",
      ).relevantActorClearance = -24.59;
    },
  },
  {
    category: "interior-actor-visibility",
    name: "alternate-state capture coverage",
    degrade(evidence) {
      evidence.interiorActors = evidence.interiorActors.filter(
        (entry) => entry.stateId === "entrance",
      );
    },
  },
  {
    category: "interior-actor-visibility",
    name: "player actor bounds evidence",
    degrade(evidence) {
      evidence.interiorActors[0].playerBounds.right =
        evidence.interiorActors[0].playerBounds.left + 1;
    },
  },
  {
    category: "interior-actor-visibility",
    name: "interior portal visibility",
    degrade(evidence) {
      evidence.interiorActors[0].portalVisible = false;
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
    interiorActors: 2,
    interiors: 3,
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
