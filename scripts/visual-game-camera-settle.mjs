export function cameraScrollDistance(first, second) {
  return Math.hypot(
    (second?.scroll?.x ?? 0) - (first?.scroll?.x ?? 0),
    (second?.scroll?.y ?? 0) - (first?.scroll?.y ?? 0),
  );
}

function pointDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function hasFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function hasFiniteRectangle(rectangle) {
  return (
    hasFinitePoint(rectangle) &&
    Number.isFinite(rectangle?.height) &&
    Number.isFinite(rectangle?.width)
  );
}

function hasFiniteScrollRange(range) {
  return (
    Number.isFinite(range?.maxX) &&
    Number.isFinite(range?.maxY) &&
    Number.isFinite(range?.minX) &&
    Number.isFinite(range?.minY)
  );
}

function maxPairwiseDistance(values, distance) {
  let maxDistance = 0;
  for (let firstIndex = 0; firstIndex < values.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < values.length;
      secondIndex += 1
    ) {
      maxDistance = Math.max(
        maxDistance,
        distance(values[firstIndex], values[secondIndex]),
      );
    }
  }
  return maxDistance;
}

function stableProjectionSignature(probe) {
  return JSON.stringify({
    activeSpaceId: probe.activeSpaceId,
    activeSpaceKind: probe.activeSpaceKind,
    renderScale: probe.renderScale,
    sceneViewport: probe.sceneViewport,
    sceneViewportCss: probe.sceneViewportCss,
    scrollRange: probe.scrollRange,
  });
}

function latestRenderedWindow(probes, requiredSamples, minRenderedSpanMs) {
  for (
    let startIndex = probes.length - requiredSamples;
    startIndex >= 0;
    startIndex -= 1
  ) {
    const window = probes.slice(startIndex);
    const firstRenderedAtMs = window[0]?.renderedAtMs;
    const lastRenderedAtMs = window.at(-1)?.renderedAtMs;
    if (
      Number.isFinite(firstRenderedAtMs) &&
      Number.isFinite(lastRenderedAtMs) &&
      lastRenderedAtMs - firstRenderedAtMs >= minRenderedSpanMs
    ) {
      return window;
    }
  }
  return null;
}

function cameraProbeWindowDiagnostics(probes) {
  if (!probes?.length) {
    return null;
  }
  const finiteScrolls = probes.filter(
    (probe) =>
      Number.isFinite(probe?.scroll?.x) && Number.isFinite(probe?.scroll?.y),
  );
  const playerPoints = probes
    .map((probe) => probe?.playerWorldPoint)
    .filter(hasFinitePoint);
  const followPoints = probes
    .map((probe) => probe?.followWorldPoint)
    .filter(hasFinitePoint);
  const zooms = probes.map((probe) => probe?.zoom).filter(Number.isFinite);
  const renderedAt = probes
    .map((probe) => probe?.renderedAtMs)
    .filter(Number.isFinite);
  return {
    cameraDistance:
      finiteScrolls.length === probes.length
        ? Number(maxPairwiseDistance(finiteScrolls, cameraScrollDistance).toFixed(2))
        : null,
    draggingSamples: probes.filter((probe) => probe?.dragging === true).length,
    followDistance:
      followPoints.length === probes.length
        ? Number(maxPairwiseDistance(followPoints, pointDistance).toFixed(2))
        : null,
    playerDistance:
      playerPoints.length === probes.length
        ? Number(maxPairwiseDistance(playerPoints, pointDistance).toFixed(2))
        : null,
    projectionSignatures: new Set(probes.map(stableProjectionSignature)).size,
    renderedSpanMs:
      renderedAt.length === probes.length
        ? Number((renderedAt.at(-1) - renderedAt[0]).toFixed(2))
        : null,
    renderedTimestampsStrictlyIncrease: probes.every(
      (probe, index) =>
        index === 0 || probe.renderedAtMs > probes[index - 1].renderedAtMs,
    ),
    sampleCount: probes.length,
    zoomDelta:
      zooms.length === probes.length
        ? Number((Math.max(...zooms) - Math.min(...zooms)).toFixed(4))
        : null,
  };
}

function cameraProbeWindowIsStable(
  probes,
  { maxDistance, maxPointDistance, maxZoomDelta, minRenderedSpanMs },
) {
  const first = probes[0];
  const last = probes.at(-1);
  if (
    !first?.activeSpaceId ||
    !first?.activeSpaceKind ||
    !Number.isFinite(first?.renderedAtMs) ||
    !Number.isFinite(last?.renderedAtMs) ||
    last.renderedAtMs - first.renderedAtMs < minRenderedSpanMs
  ) {
    return false;
  }

  const signature = stableProjectionSignature(first);
  for (let index = 0; index < probes.length; index += 1) {
    const probe = probes[index];
    if (
      probe?.dragging === true ||
      stableProjectionSignature(probe) !== signature ||
      !Number.isFinite(probe?.renderedAtMs) ||
      (index > 0 && probe.renderedAtMs <= probes[index - 1].renderedAtMs) ||
      !Number.isFinite(probe?.scroll?.x) ||
      !Number.isFinite(probe?.scroll?.y) ||
      !Number.isFinite(probe?.zoom) ||
      !Number.isFinite(probe?.renderScale) ||
      !hasFiniteRectangle(probe?.sceneViewport) ||
      !hasFiniteRectangle(probe?.sceneViewportCss) ||
      !hasFiniteScrollRange(probe?.scrollRange) ||
      !hasFinitePoint(probe?.playerWorldPoint) ||
      !hasFinitePoint(probe?.followWorldPoint)
    ) {
      return false;
    }
  }

  return (
    maxPairwiseDistance(probes, cameraScrollDistance) <= maxDistance &&
    maxPairwiseDistance(
      probes.map((probe) => probe.playerWorldPoint),
      pointDistance,
    ) <= maxPointDistance &&
    maxPairwiseDistance(
      probes.map((probe) => probe.followWorldPoint),
      pointDistance,
    ) <= maxPointDistance &&
    Math.max(...probes.map((probe) => probe.zoom)) -
      Math.min(...probes.map((probe) => probe.zoom)) <=
      maxZoomDelta
  );
}

export function stableCameraProbeWindow(
  probes,
  {
    maxDistance = 2,
    maxPointDistance = 2,
    maxZoomDelta = 0.001,
    minRenderedSpanMs = 800,
    requiredSamples = 3,
  } = {},
) {
  const samples = probes ?? [];
  if (samples.length < requiredSamples) {
    return null;
  }

  const window = latestRenderedWindow(
    samples,
    requiredSamples,
    minRenderedSpanMs,
  );
  return window &&
    cameraProbeWindowIsStable(window, {
      maxDistance,
      maxPointDistance,
      maxZoomDelta,
      minRenderedSpanMs,
    })
    ? window
    : null;
}

export async function waitForStableCameraProbes({
  initialProbe = null,
  isEligible = () => true,
  maxDistance = 2,
  maxPointDistance = 2,
  maxZoomDelta = 0.001,
  minRenderedSpanMs = 800,
  now = Date.now,
  readProbe,
  requiredSamples = 3,
  timeoutMs,
  waitForFrame,
}) {
  const startedAt = now();
  const probes = [];
  let lastDrift = null;
  if (
    initialProbe &&
    isEligible(initialProbe) &&
    Number.isFinite(initialProbe.renderedAtMs)
  ) {
    probes.push(initialProbe);
  }

  while (now() - startedAt < timeoutMs) {
    await waitForFrame();
    let probe = null;
    try {
      probe = await readProbe();
    } catch {}
    if (!probe || !isEligible(probe)) {
      probes.length = 0;
      continue;
    }
    if (!Number.isFinite(probe.renderedAtMs)) {
      probes.length = 0;
      continue;
    }
    const previousProbe = probes.at(-1);
    if (
      previousProbe &&
      probe.renderedAtMs === previousProbe.renderedAtMs
    ) {
      continue;
    }
    if (previousProbe && probe.renderedAtMs < previousProbe.renderedAtMs) {
      probes.length = 0;
    }

    probes.push(probe);
    if (probes.length > 512) {
      probes.shift();
    }
    if (probes.length >= 2) {
      lastDrift = cameraScrollDistance(probes[0], probes.at(-1));
    }
    const stableWindow = stableCameraProbeWindow(probes, {
      maxDistance,
      maxPointDistance,
      maxZoomDelta,
      minRenderedSpanMs,
      requiredSamples,
    });
    if (stableWindow) {
      return {
        samples: stableWindow,
        settled: stableWindow[0],
        settledAgain: stableWindow.at(-1),
      };
    }
  }

  const latest = probes.at(-1) ?? null;
  const renderedSpanMs =
    probes.length >= 2 &&
    Number.isFinite(probes[0]?.renderedAtMs) &&
    Number.isFinite(latest?.renderedAtMs)
      ? latest.renderedAtMs - probes[0].renderedAtMs
      : null;
  const latestCandidate = latestRenderedWindow(
    probes,
    requiredSamples,
    minRenderedSpanMs,
  );
  throw new Error(
    `Timed out waiting for ${requiredSamples} stable camera frames spanning ${minRenderedSpanMs} rendered milliseconds within ${maxDistance} world pixels. Samples: ${probes.length}; rendered span: ${
      typeof renderedSpanMs === "number"
        ? renderedSpanMs.toFixed(1)
        : "unavailable"
    }; candidate diagnostics: ${JSON.stringify(
      cameraProbeWindowDiagnostics(latestCandidate),
    )}; last drift: ${
      typeof lastDrift === "number" ? lastDrift.toFixed(1) : "unavailable"
    }; latest probe: ${JSON.stringify(latest)}.`,
  );
}
