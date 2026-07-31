const REQUIRED_LANDMARKS = new Set(["morrow-yard", "pilgrim-slip"]);
const REQUIRED_INTERIORS = new Set(["tea-house", "repair-stall"]);

function fail(category, message, evidence) {
  throw new Error(
    `[VQ-10/${category}] ${message} Evidence: ${JSON.stringify(evidence)}.`,
  );
}

function rectEdges(rect) {
  if (!rect) {
    return null;
  }
  return {
    bottom: rect.bottom ?? rect.y + rect.height,
    left: rect.left ?? rect.x,
    right: rect.right ?? rect.x + rect.width,
    top: rect.top ?? rect.y,
  };
}

function rectClearance(firstRect, secondRect) {
  const first = rectEdges(firstRect);
  const second = rectEdges(secondRect);
  if (!first || !second) {
    return Number.NEGATIVE_INFINITY;
  }
  const overlapsX = first.left < second.right && first.right > second.left;
  const overlapsY = first.top < second.bottom && first.bottom > second.top;
  if (overlapsX) {
    return Math.max(second.top - first.bottom, first.top - second.bottom);
  }
  if (overlapsY) {
    return Math.max(second.left - first.right, first.left - second.right);
  }
  return Math.max(
    second.top - first.bottom,
    first.top - second.bottom,
    second.left - first.right,
    first.left - second.right,
  );
}

function pointDistance(first, second) {
  if (
    !Number.isFinite(first?.x) ||
    !Number.isFinite(first?.y) ||
    !Number.isFinite(second?.x) ||
    !Number.isFinite(second?.y)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function normalizeDropoutComponent(component) {
  if (!component) {
    return null;
  }
  const edgeWidth =
    Number.isFinite(component.left) && Number.isFinite(component.right)
      ? component.right - component.left
      : null;
  const edgeHeight =
    Number.isFinite(component.top) && Number.isFinite(component.bottom)
      ? component.bottom - component.top
      : null;
  return {
    ...component,
    height:
      edgeHeight !== null && edgeHeight >= 0
        ? edgeHeight
        : Number.isFinite(component.height) && component.height >= 0
          ? component.height
          : Number.POSITIVE_INFINITY,
    width:
      edgeWidth !== null && edgeWidth >= 0
        ? edgeWidth
        : Number.isFinite(component.width) && component.width >= 0
          ? component.width
          : Number.POSITIVE_INFINITY,
  };
}

function compactCompositionProfile(diagnostic) {
  return {
    activeColorBins: diagnostic.activeColorBins,
    dominantColorFraction: diagnostic.dominantColorFraction,
    label: diagnostic.label,
    luminanceRange: diagnostic.luminanceRange,
    paleVoidFraction: diagnostic.paleVoidFraction ?? 0,
    region: diagnostic.region,
  };
}

export function createVisualQualityRegressionEvidence({
  fringeCompositionDiagnostics,
  interiorIdentityDiagnostics,
  results,
  screenshotPixelDiagnostics,
  secondaryLandmarkCompositionDiagnostics,
}) {
  return {
    composition: [
      ...fringeCompositionDiagnostics,
      ...secondaryLandmarkCompositionDiagnostics,
    ].map(compactCompositionProfile),
    dropouts: screenshotPixelDiagnostics.map((diagnostic) => ({
      component: diagnostic.largestNearBlackComponent,
      label: diagnostic.label,
      viewport: diagnostic.viewport,
    })),
    interiors: interiorIdentityDiagnostics.map((diagnostic) => ({
      activeColorBins: diagnostic.activeColorBins,
      detailTransitionFraction: diagnostic.detailTransitionFraction,
      dominantColorFraction: diagnostic.dominantColorFraction,
      fractions: diagnostic.fractions,
      label: diagnostic.label,
      luminanceRange: diagnostic.luminanceRange,
      role: diagnostic.role,
    })),
    landmarks: secondaryLandmarkCompositionDiagnostics.map((diagnostic) => ({
      activeColorBins: diagnostic.activeColorBins,
      coolUtilityFraction: diagnostic.coolUtilityFraction,
      label: diagnostic.label,
      region: diagnostic.region,
      warmDetailFraction: diagnostic.warmDetailFraction,
      waterMaterialFraction: diagnostic.waterMaterialFraction,
    })),
    overlays: results.map((result) => ({
      dock: result.page?.dockRoot,
      rail: result.page?.rightStack,
      viewport: result.viewport?.name,
    })),
    routes: results.map((result) => ({
      anchorLocationId: result.playerLocationGeometry?.anchorLocationId,
      anchorWorldPoint: result.playerLocationGeometry?.anchorWorldPoint,
      label: result.mapAgency?.target?.label,
      targetLocationId: result.mapAgency?.target?.locationId,
      targetWorldPoint: result.mapAgency?.target
        ? {
            x: result.mapAgency.target.x,
            y: result.mapAgency.target.y,
          }
        : null,
      viewport: result.viewport?.name,
    })),
    visualCues: results.map((result) => ({
      contextualCueCount:
        result.page?.visualHierarchy?.contextualCues?.length ?? 0,
      eventCueCount: result.eventCues?.length ?? 0,
      maximumNpcLabelLineCount: Math.max(
        0,
        ...(result.page?.visualHierarchy?.actorLabels?.npcs ?? []).map(
          (label) => label.lineCount ?? 0,
        ),
      ),
      persistentIdentityCount:
        result.page?.visualHierarchy?.persistentIdentityTreatments?.length ?? 0,
      scheduledCueCount: result.scheduledNpcVisualCues?.length ?? 0,
      viewport: result.viewport?.name,
    })),
  };
}

export function assertVisualQualityRegressionEvidence(evidence) {
  const landmarks = evidence?.landmarks ?? [];
  for (const region of REQUIRED_LANDMARKS) {
    const matches = landmarks.filter((entry) => entry.region === region);
    if (matches.length === 0) {
      fail(
        "landmark-identity-loss",
        `missing production pixel evidence for ${region}`,
        { availableRegions: landmarks.map((entry) => entry.region), region },
      );
    }
    for (const entry of matches) {
      const retainsIdentity =
        entry.activeColorBins >= 16 &&
        (region === "morrow-yard"
          ? entry.coolUtilityFraction >= 0.018 &&
            entry.warmDetailFraction >= 0.06
          : entry.warmDetailFraction >= 0.16 &&
            entry.waterMaterialFraction >= 0.08);
      if (!retainsIdentity) {
        fail(
          "landmark-identity-loss",
          `${entry.label ?? region} lost its authored material signature`,
          entry,
        );
      }
    }
  }

  const interiors = evidence?.interiors ?? [];
  for (const role of REQUIRED_INTERIORS) {
    const matches = interiors.filter((entry) => entry.role === role);
    if (matches.length === 0) {
      fail(
        "interior-identity-loss",
        `missing production pixel evidence for ${role}`,
        { availableRoles: interiors.map((entry) => entry.role), role },
      );
    }
    for (const entry of matches) {
      const sharedIdentity =
        entry.activeColorBins >= 12 &&
        entry.dominantColorFraction <= 0.58 &&
        entry.luminanceRange >= 58 &&
        entry.detailTransitionFraction >= 0.018;
      const roleIdentity =
        role === "tea-house"
          ? entry.fractions?.warmMaterial >= 0.16 &&
            entry.fractions?.goldAccent >= 0.01
          : entry.fractions?.coolMetal >= 0.18 &&
            entry.fractions?.rustAccent >= 0.008;
      if (!sharedIdentity || !roleIdentity) {
        fail(
          "interior-identity-loss",
          `${entry.label ?? role} lost its distinct authored room signature`,
          entry,
        );
      }
    }
  }

  const composition = evidence?.composition ?? [];
  if (composition.length < 2) {
    fail(
      "major-composition-or-dropout",
      "fewer than two production composition regions were measured",
      { profileCount: composition.length },
    );
  }
  for (const profile of composition) {
    if (
      profile.activeColorBins < 12 ||
      profile.dominantColorFraction > 0.58 ||
      profile.luminanceRange < 58 ||
      profile.paleVoidFraction > 0.22
    ) {
      fail(
        "major-composition-or-dropout",
        `${profile.label ?? profile.region} shows major palette or composition drift`,
        profile,
      );
    }
  }
  const dropouts = evidence?.dropouts ?? [];
  if (dropouts.length === 0) {
    fail(
      "major-composition-or-dropout",
      "no production screenshot dropout diagnostics were supplied",
      { dropoutCount: 0 },
    );
  }
  for (const dropout of dropouts) {
    const component = normalizeDropoutComponent(dropout.component);
    const viewport = dropout.viewport;
    const areaFraction =
      Number.isFinite(component?.area) &&
      viewport?.width > 0 &&
      viewport?.height > 0
        ? component.area / (viewport.width * viewport.height)
        : Number.POSITIVE_INFINITY;
    const permitted =
      component &&
      (areaFraction < 0.006 ||
        component.width < 24 ||
        component.height < 16);
    if (!permitted) {
      fail(
        "major-composition-or-dropout",
        `${dropout.label ?? "screenshot"} contains a major visual dropout`,
        { ...dropout, areaFraction, component },
      );
    }
  }

  const overlays = evidence?.overlays ?? [];
  if (overlays.length === 0) {
    fail("overlay-intersection", "no production overlay geometry was supplied", {
      overlayCount: 0,
    });
  }
  for (const overlay of overlays) {
    const clearance = rectClearance(overlay.rail, overlay.dock);
    if (clearance < 8) {
      fail(
        "overlay-intersection",
        `${overlay.viewport ?? "viewport"} rail and dock intersect or have insufficient clearance`,
        { ...overlay, clearance },
      );
    }
  }

  const visualCues = evidence?.visualCues ?? [];
  if (visualCues.length === 0) {
    fail("excessive-cue-noise", "no production cue hierarchy was supplied", {
      visualCueCount: 0,
    });
  }
  for (const cue of visualCues) {
    const totalContextualCues = cue.eventCueCount + cue.scheduledCueCount;
    if (
      cue.persistentIdentityCount > 1 ||
      cue.contextualCueCount > 1 ||
      cue.maximumNpcLabelLineCount > 1 ||
      cue.eventCueCount > 4 ||
      cue.scheduledCueCount > 4 ||
      totalContextualCues > 8
    ) {
      fail(
        "excessive-cue-noise",
        `${cue.viewport ?? "viewport"} contains stacked or excessive cue treatment`,
        { ...cue, totalContextualCues },
      );
    }
  }

  const routes = evidence?.routes ?? [];
  if (routes.length === 0) {
    fail(
      "route-label-detachment",
      "no production route-label attachment evidence was supplied",
      { routeCount: 0 },
    );
  }
  for (const route of routes) {
    const distance = pointDistance(
      route.targetWorldPoint,
      route.anchorWorldPoint,
    );
    if (
      !route.label ||
      route.targetLocationId !== route.anchorLocationId ||
      distance > 72
    ) {
      fail(
        "route-label-detachment",
        `${route.viewport ?? "viewport"} route label is detached from its authored destination`,
        { ...route, distance },
      );
    }
  }

  return {
    categories: [
      "landmark-identity-loss",
      "interior-identity-loss",
      "major-composition-or-dropout",
      "overlay-intersection",
      "excessive-cue-noise",
      "route-label-detachment",
    ],
    counts: {
      composition: composition.length,
      dropouts: dropouts.length,
      interiors: interiors.length,
      landmarks: landmarks.length,
      overlays: overlays.length,
      routes: routes.length,
      visualCues: visualCues.length,
    },
    status: "passed",
  };
}
