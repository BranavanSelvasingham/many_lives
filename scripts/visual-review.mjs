import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
export const DEFAULT_VISUAL_REVIEW_CONTRACT_PATH = path.join(
  ROOT,
  "docs/street/visual-review-contract.json",
);

const MATRIX_ROW_PATTERN = /^VQ-(?:0[1-9]|1[0-2])$/;
const VALID_SHOT_STATUSES = new Set(["finding", "pass"]);

export async function loadVisualReviewContract(
  contractPath = DEFAULT_VISUAL_REVIEW_CONTRACT_PATH,
) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  validateVisualReviewContract(contract);
  return contract;
}

export function validateVisualReviewContract(contract) {
  if (contract?.schemaVersion !== 1) {
    throw new Error("Visual review contract must use schemaVersion 1.");
  }
  if (!Array.isArray(contract.dimensions) || contract.dimensions.length === 0) {
    throw new Error("Visual review contract must define scoring dimensions.");
  }
  if (!Array.isArray(contract.shots) || contract.shots.length === 0) {
    throw new Error("Visual review contract must define required shots.");
  }
  if (
    !Number.isFinite(contract.minimumWeightedScore) ||
    contract.minimumWeightedScore < 1 ||
    contract.minimumWeightedScore > 5
  ) {
    throw new Error(
      "Visual review contract must define a minimumWeightedScore from 1 to 5.",
    );
  }
  assertUniqueStringList(
    contract.requiredViewportProfiles,
    "requiredViewportProfiles",
  );
  assertUniqueStringList(contract.automaticRejects, "automaticRejects");
  assertUniqueStringList(contract.groupOrder, "groupOrder");

  const dimensionIds = new Set();
  let totalWeight = 0;
  for (const dimension of contract.dimensions) {
    if (!dimension.id || dimensionIds.has(dimension.id)) {
      throw new Error(
        `Duplicate or missing visual review dimension: ${dimension.id}.`,
      );
    }
    dimensionIds.add(dimension.id);
    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      throw new Error(`Dimension ${dimension.id} must have a positive weight.`);
    }
    if (
      !Number.isFinite(dimension.minimumScore) ||
      dimension.minimumScore < 1 ||
      dimension.minimumScore > 5
    ) {
      throw new Error(
        `Dimension ${dimension.id} has an invalid minimum score.`,
      );
    }
    totalWeight += dimension.weight;
  }
  if (totalWeight !== 100) {
    throw new Error(
      `Visual review dimension weights must total 100, got ${totalWeight}.`,
    );
  }

  const groupIds = new Set(contract.groupOrder ?? []);
  const shotIds = new Set();
  const coveredRows = new Set();
  for (const shot of contract.shots) {
    if (!shot.id || shotIds.has(shot.id)) {
      throw new Error(`Duplicate or missing visual review shot: ${shot.id}.`);
    }
    shotIds.add(shot.id);
    if (!shot.file?.endsWith(".png")) {
      throw new Error(`Shot ${shot.id} must reference a PNG file.`);
    }
    if (!groupIds.has(shot.group)) {
      throw new Error(
        `Shot ${shot.id} references unknown group ${shot.group}.`,
      );
    }
    if (!Array.isArray(shot.matrixRows) || shot.matrixRows.length === 0) {
      throw new Error(
        `Shot ${shot.id} must map to at least one visual matrix row.`,
      );
    }
    for (const row of shot.matrixRows) {
      if (!MATRIX_ROW_PATTERN.test(row)) {
        throw new Error(
          `Shot ${shot.id} references invalid matrix row ${row}.`,
        );
      }
      coveredRows.add(row);
    }
  }

  for (let index = 1; index <= 12; index += 1) {
    const row = `VQ-${String(index).padStart(2, "0")}`;
    if (!coveredRows.has(row)) {
      throw new Error(`Visual review shots do not cover ${row}.`);
    }
  }
  if (contract.shots.filter((shot) => shot.comparison).length < 4) {
    throw new Error(
      "Visual review contract must nominate at least four comparison shots.",
    );
  }
}

export function createHumanAssessmentTemplate(contract) {
  return {
    schemaVersion: 1,
    reviewer: null,
    reviewedAt: null,
    dimensions: Object.fromEntries(
      contract.dimensions.map((dimension) => [
        dimension.id,
        { notes: "", score: null },
      ]),
    ),
    shots: Object.fromEntries(
      contract.shots.map((shot) => [shot.id, { notes: "", status: "pending" }]),
    ),
    findings: [],
  };
}

export function evaluateHumanAssessment(contract, assessment) {
  if (!assessment) {
    return {
      status: "pending",
      weightedScore: null,
      reasons: ["No completed human art-direction assessment was supplied."],
    };
  }

  const reasons = [];
  let weightedTotal = 0;
  let scoredWeight = 0;
  for (const dimension of contract.dimensions) {
    const score = assessment.dimensions?.[dimension.id]?.score;
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      reasons.push(`${dimension.label} has no valid 1-5 score.`);
      continue;
    }
    weightedTotal += score * dimension.weight;
    scoredWeight += dimension.weight;
    if (score < dimension.minimumScore) {
      reasons.push(
        `${dimension.label} scored ${score}, below ${dimension.minimumScore}.`,
      );
    }
  }

  for (const shot of contract.shots) {
    const status = assessment.shots?.[shot.id]?.status;
    if (!VALID_SHOT_STATUSES.has(status)) {
      reasons.push(`${shot.title} has not been reviewed.`);
    } else if (status === "finding") {
      reasons.push(`${shot.title} has an unresolved visual finding.`);
    }
  }

  const openFindings = (assessment.findings ?? []).filter(
    (finding) =>
      finding.status !== "resolved" && finding.status !== "superseded",
  );
  if (openFindings.length > 0) {
    reasons.push(
      `${openFindings.length} recorded visual finding(s) remain open.`,
    );
  }
  if (!assessment.reviewer || !assessment.reviewedAt) {
    reasons.push(
      "Reviewer and reviewedAt are required for a completed assessment.",
    );
  }

  const weightedScore =
    scoredWeight === 100 ? Number((weightedTotal / 100).toFixed(2)) : null;
  if (weightedScore !== null && weightedScore < contract.minimumWeightedScore) {
    reasons.push(
      `Weighted score ${weightedScore} is below ${contract.minimumWeightedScore}.`,
    );
  }

  const incomplete = reasons.some(
    (reason) =>
      reason.includes("has no valid") ||
      reason.includes("has not been reviewed") ||
      reason.includes("Reviewer and reviewedAt"),
  );
  return {
    status: reasons.length === 0 ? "passed" : incomplete ? "pending" : "failed",
    weightedScore,
    reasons,
  };
}

export async function generateVisualReviewArtifacts({
  assessment = null,
  baselineDir = null,
  baselineRef = null,
  candidateDir,
  candidateRef,
  contractPath = DEFAULT_VISUAL_REVIEW_CONTRACT_PATH,
  outputDir = path.join(candidateDir, "visual-review"),
  requireBaseline = false,
  summary = null,
  summaryPath = path.join(candidateDir, "summary.json"),
}) {
  const contract = await loadVisualReviewContract(contractPath);
  const runtimeSummary =
    summary ?? JSON.parse(await readFile(summaryPath, "utf8"));
  const resolvedCandidateRef =
    candidateRef ?? process.env.GITHUB_SHA ?? "working-tree";
  await mkdir(outputDir, { recursive: true });

  const inspectedShots = await Promise.all(
    contract.shots.map(async (shot) => {
      const candidate = await inspectShot(candidateDir, shot.file);
      const baseline = baselineDir
        ? await inspectShot(baselineDir, shot.file)
        : null;
      return { ...shot, baseline, candidate };
    }),
  );
  const shots = await Promise.all(
    inspectedShots.map(async (shot) => ({
      ...shot,
      delta:
        baselineDir && shot.comparison
          ? await compareMatchedShots(shot.baseline, shot.candidate)
          : null,
    })),
  );
  const automaticChecks = evaluateAutomaticChecks({
    baselineDir,
    contract,
    requireBaseline,
    runtimeSummary,
    shots,
  });
  const automatedStatus = automaticChecks.every(
    (check) => check.status === "passed",
  )
    ? "passed"
    : "failed";
  const humanReview = evaluateHumanAssessment(contract, assessment);
  const verdict =
    automatedStatus === "failed"
      ? "AUTOMATED_REJECT"
      : humanReview.status === "passed"
        ? "VERIFIED_CANDIDATE"
        : humanReview.status === "failed"
          ? "CHANGES_REQUIRED"
          : "HUMAN_REVIEW_REQUIRED";

  const scorecard = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    contract: path.relative(ROOT, contractPath),
    candidate: {
      directory: candidateDir,
      ref: resolvedCandidateRef,
      webBase: runtimeSummary.webBase ?? null,
    },
    baseline: baselineDir
      ? { directory: baselineDir, ref: baselineRef ?? "unspecified" }
      : null,
    verdict,
    automated: { status: automatedStatus, checks: automaticChecks },
    human: humanReview,
    coverage: {
      available: shots.filter((shot) => shot.candidate.available).length,
      required: shots.length,
      matrixRows: [...new Set(shots.flatMap((shot) => shot.matrixRows))].sort(),
      viewportProfiles: [...new Set(shots.map((shot) => shot.viewport))].sort(),
    },
    dimensions: contract.dimensions,
    shots,
  };

  const scorecardPath = path.join(outputDir, "scorecard.json");
  const assessmentTemplatePath = path.join(
    outputDir,
    "assessment-template.json",
  );
  const reportPath = path.join(outputDir, "review.md");
  const reviewDeckPath = path.join(outputDir, "review-deck.png");
  const comparisonPath = baselineDir
    ? path.join(outputDir, "comparison-deck.png")
    : null;

  await Promise.all([
    writeFile(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8"),
    writeFile(
      assessmentTemplatePath,
      `${JSON.stringify(createHumanAssessmentTemplate(contract), null, 2)}\n`,
      "utf8",
    ),
    writeFile(reportPath, renderMarkdownReport(scorecard), "utf8"),
    renderContactSheet({
      baselineRef,
      candidateRef: resolvedCandidateRef,
      mode: "candidate",
      outputPath: reviewDeckPath,
      shots,
      title: contract.title,
    }),
    comparisonPath
      ? renderContactSheet({
          baselineRef: baselineRef ?? "baseline",
          candidateRef: resolvedCandidateRef,
          mode: "comparison",
          outputPath: comparisonPath,
          shots: shots.filter((shot) => shot.comparison),
          title: `${contract.title} / matched comparison`,
        })
      : Promise.resolve(),
  ]);

  return {
    assessmentTemplatePath,
    automaticStatus: automatedStatus,
    comparisonPath,
    humanStatus: humanReview.status,
    reportPath,
    reviewDeckPath,
    scorecardPath,
    verdict,
  };
}

function evaluateAutomaticChecks({
  baselineDir,
  contract,
  requireBaseline,
  runtimeSummary,
  shots,
}) {
  const viewportNames = new Set(
    (runtimeSummary.results ?? []).map((result) => result.viewport?.name),
  );
  const stored = runtimeSummary.storedGameChoice ?? {};
  const routes = runtimeSummary.secondaryLandmarkRouteIdentity ?? {};
  const missingShots = shots
    .filter((shot) => !shot.candidate.available)
    .map((shot) => shot.file);
  const checks = [
    check(
      "required-shot-coverage",
      missingShots.length === 0,
      missingShots.length === 0
        ? `${shots.length}/${shots.length} required PNGs are present and readable.`
        : `Missing or unreadable: ${missingShots.join(", ")}.`,
    ),
    check(
      "visual-regression",
      runtimeSummary.visualQualityRegression?.status === "passed",
      runtimeSummary.visualQualityRegression?.status === "passed"
        ? `VQ-10 passed ${runtimeSummary.visualQualityRegression.categories?.length ?? 0} reject categories.`
        : "The production visual-regression evidence did not pass.",
    ),
    check(
      "viewport-coverage",
      contract.requiredViewportProfiles.every((name) =>
        viewportNames.has(name),
      ),
      `${viewportNames.size}/${contract.requiredViewportProfiles.length} required viewport profiles captured.`,
    ),
    check(
      "fresh-autoplay",
      Boolean(
        runtimeSummary.freshAutoplayStart?.screenshotPath &&
        runtimeSummary.freshAutoplayStart?.advanced?.visibleDecisionArtifact &&
        runtimeSummary.freshAutoplayStart?.advanced?.watchMode?.enabled,
      ),
      "Fresh watch mode must visibly advance with a decision artifact and no click gate.",
    ),
    check(
      "saved-run-continuity",
      Boolean(
        stored.seededGameId &&
        stored.seededGameId === stored.resumedGameId &&
        stored.freshGameId &&
        stored.freshGameId !== stored.seededGameId &&
        stored.desktopPromptScreenshotPath &&
        stored.mobilePromptScreenshotPath,
      ),
      "Saved identity must resume exactly; Start New must produce a distinct identity on desktop and phone.",
    ),
    check(
      "route-continuity",
      Boolean(routes.courtyard && routes["moss-pier"]),
      "Morrow Yard and Pilgrim Slip route/arrival evidence must both be present.",
    ),
    check(
      "interior-identity",
      Boolean(
        runtimeSummary.interiorCamera?.screenshotPath &&
        runtimeSummary.interiorCamera?.mobileScreenshotPath &&
        runtimeSummary.authoredInteriorIdentity?.["tea-house"] &&
        runtimeSummary.authoredInteriorIdentity?.["repair-stall"],
      ),
      "Morrow House, Kettle & Lamp, and Mercer Repairs must retain desktop/mobile identity evidence.",
    ),
    check(
      "page-health",
      Boolean(
        (runtimeSummary.pageHealth?.status === "passed" ||
          runtimeSummary.visualQualityRegression?.status === "passed") &&
        (runtimeSummary.screenshotPixelDiagnostics?.length ?? 0) > 0,
      ),
      "The browser run must finish without runtime contamination and with pixel diagnostics.",
    ),
  ];
  const implementedRejects = checks.map((result) => result.id).sort();
  const contractedRejects = [...contract.automaticRejects].sort();
  if (JSON.stringify(implementedRejects) !== JSON.stringify(contractedRejects)) {
    throw new Error(
      `Visual review automatic reject implementation does not match the contract. Contract: ${contractedRejects.join(", ")}; implementation: ${implementedRejects.join(", ")}.`,
    );
  }
  if (requireBaseline) {
    const unmatchedBaselineShots = shots
      .filter(
        (shot) =>
          shot.comparison &&
          (!shot.baseline?.available || shot.delta?.dimensionsMatch !== true),
      )
      .map((shot) => shot.file);
    checks.push(
      check(
        "matched-baseline",
        Boolean(baselineDir) && unmatchedBaselineShots.length === 0,
        unmatchedBaselineShots.length === 0 && baselineDir
          ? "All representative comparison shots have a same-dimension baseline and candidate."
          : `Matched baseline missing or dimensionally inconsistent: ${unmatchedBaselineShots.join(", ") || "baseline directory"}.`,
      ),
    );
  }
  return checks;
}

function check(id, passed, evidence) {
  return { evidence, id, status: passed ? "passed" : "failed" };
}

function assertUniqueStringList(value, name) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`Visual review contract ${name} must be a unique string list.`);
  }
}

async function inspectShot(directory, filename) {
  const filePath = path.join(directory, filename);
  if (!existsSync(filePath)) {
    return { available: false, filePath, reason: "missing" };
  }
  try {
    const buffer = await readFile(filePath);
    const metadata = await sharp(buffer).metadata();
    if (metadata.format !== "png" || !metadata.width || !metadata.height) {
      return { available: false, filePath, reason: "not-readable-png" };
    }
    if (metadata.width < 320 || metadata.height < 240) {
      return {
        available: false,
        filePath,
        height: metadata.height,
        reason: "undersized-png",
        width: metadata.width,
      };
    }
    return {
      available: true,
      bytes: buffer.length,
      filePath,
      height: metadata.height,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      width: metadata.width,
    };
  } catch (error) {
    return {
      available: false,
      filePath,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function compareMatchedShots(baseline, candidate) {
  if (!baseline?.available || !candidate?.available) {
    return { dimensionsMatch: false, reason: "missing-evidence" };
  }
  if (
    baseline.width !== candidate.width ||
    baseline.height !== candidate.height
  ) {
    return {
      baseline: { height: baseline.height, width: baseline.width },
      candidate: { height: candidate.height, width: candidate.width },
      dimensionsMatch: false,
      reason: "dimension-mismatch",
    };
  }

  const [baselinePixels, candidatePixels] = await Promise.all([
    sharp(baseline.filePath).removeAlpha().raw().toBuffer(),
    sharp(candidate.filePath).removeAlpha().raw().toBuffer(),
  ]);
  let changedPixels = 0;
  let maximumChannelDelta = 0;
  let totalChannelDelta = 0;
  for (let index = 0; index < baselinePixels.length; index += 3) {
    const red = Math.abs(baselinePixels[index] - candidatePixels[index]);
    const green = Math.abs(
      baselinePixels[index + 1] - candidatePixels[index + 1],
    );
    const blue = Math.abs(
      baselinePixels[index + 2] - candidatePixels[index + 2],
    );
    const pixelMaximum = Math.max(red, green, blue);
    if (pixelMaximum >= 12) changedPixels += 1;
    maximumChannelDelta = Math.max(maximumChannelDelta, pixelMaximum);
    totalChannelDelta += red + green + blue;
  }
  const pixelCount = baseline.width * baseline.height;
  return {
    changedPixelFraction: Number((changedPixels / pixelCount).toFixed(5)),
    dimensionsMatch: true,
    maximumChannelDelta,
    meanChannelDelta: Number(
      (totalChannelDelta / (pixelCount * 3)).toFixed(3),
    ),
    threshold: 12,
  };
}

async function renderContactSheet({
  baselineRef,
  candidateRef,
  mode,
  outputPath,
  shots,
  title,
}) {
  const comparison = mode === "comparison";
  const columns = comparison ? 2 : 3;
  const cardWidth = comparison ? 780 : 520;
  const cardHeight = comparison ? 380 : 370;
  const gap = 20;
  const margin = 28;
  const headerHeight = 96;
  const rows = Math.ceil(shots.length / columns);
  const width = margin * 2 + columns * cardWidth + (columns - 1) * gap;
  const height =
    headerHeight + margin + rows * cardHeight + (rows - 1) * gap + margin;
  const composites = [
    {
      input: svgBuffer(width, headerHeight, [
        textSvg(title, 30, 44, 28, "#f2f5f7", 700),
        textSvg(
          comparison
            ? `Before ${shortRef(baselineRef)}  /  After ${shortRef(candidateRef)}`
            : `Candidate ${shortRef(candidateRef)}  /  ${shots.length} required review states`,
          30,
          74,
          15,
          "#9eabb3",
          500,
        ),
      ]),
      left: 0,
      top: 0,
    },
  ];

  for (const [index, shot] of shots.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = margin + column * (cardWidth + gap);
    const top = headerHeight + margin + row * (cardHeight + gap);
    const deltaLabel = comparison
      ? shot.delta?.dimensionsMatch
        ? ` / CHANGED ${(shot.delta.changedPixelFraction * 100).toFixed(2)}% / MEAN DELTA ${shot.delta.meanChannelDelta}`
        : " / UNMATCHED EVIDENCE"
      : "";
    composites.push({
      input: svgBuffer(cardWidth, cardHeight, [
        `<rect width="${cardWidth}" height="${cardHeight}" rx="8" fill="#141c21" stroke="#314047"/>`,
        textSvg(shot.title, 18, 30, 17, "#f2f5f7", 700),
        textSvg(
          `${shot.group.toUpperCase()}  /  ${shot.viewport}  /  ${shot.matrixRows.join(", ")}${deltaLabel}`,
          18,
          53,
          11,
          "#91a1aa",
          600,
        ),
      ]),
      left,
      top,
    });
    if (comparison) {
      await addImagePanel({
        composites,
        height: 274,
        image: shot.baseline,
        label: `BEFORE ${shortRef(baselineRef)}`,
        left: left + 16,
        top: top + 76,
        width: 364,
      });
      await addImagePanel({
        composites,
        height: 274,
        image: shot.candidate,
        label: `AFTER ${shortRef(candidateRef)}`,
        left: left + 400,
        top: top + 76,
        width: 364,
      });
    } else {
      await addImagePanel({
        composites,
        height: 280,
        image: shot.candidate,
        label: shot.state.toUpperCase(),
        left: left + 16,
        top: top + 70,
        width: cardWidth - 32,
      });
    }
  }

  await sharp({
    create: {
      background: "#0b1216",
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function addImagePanel({
  composites,
  height,
  image,
  label,
  left,
  top,
  width,
}) {
  composites.push({
    input: svgBuffer(width, 24, [
      `<rect width="${width}" height="24" fill="#202b31"/>`,
      textSvg(label, 9, 17, 10, "#c9d2d7", 700),
    ]),
    left,
    top,
  });
  if (!image?.available) {
    composites.push({
      input: svgBuffer(width, height - 24, [
        `<rect width="${width}" height="${height - 24}" fill="#351f23"/>`,
        textSvg("MISSING EVIDENCE", 18, 42, 16, "#ffbac3", 700),
      ]),
      left,
      top: top + 24,
    });
    return;
  }
  const rendered = await sharp(image.filePath)
    .resize({
      background: "#0a1014",
      fit: "contain",
      height: height - 24,
      width,
    })
    .png()
    .toBuffer();
  composites.push({ input: rendered, left, top: top + 24 });
}

function renderMarkdownReport(scorecard) {
  const lines = [
    `# ${scorecard.verdict}`,
    "",
    `- Candidate: \`${scorecard.candidate.ref}\``,
    `- Baseline: ${scorecard.baseline ? `\`${scorecard.baseline.ref}\`` : "not supplied"}`,
    `- Evidence: \`${scorecard.candidate.directory}\``,
    `- Automated gate: **${scorecard.automated.status.toUpperCase()}**`,
    `- Human review: **${scorecard.human.status.toUpperCase()}**`,
    `- Coverage: ${scorecard.coverage.available}/${scorecard.coverage.required} required shots`,
    "",
    "## Automatic Reject Gates",
    "",
    "| Gate | Status | Evidence |",
    "| --- | --- | --- |",
    ...scorecard.automated.checks.map(
      (checkResult) =>
        `| ${checkResult.id} | ${checkResult.status.toUpperCase()} | ${escapeMarkdown(checkResult.evidence)} |`,
    ),
    "",
    "## Human Art-Direction Scorecard",
    "",
    "Scores use 1=broken, 3=acceptable but unfinished, 4=polished, 5=exceptional.",
    "",
    "| Dimension | Weight | Minimum | Score | Prompt |",
    "| --- | ---: | ---: | ---: | --- |",
    ...scorecard.dimensions.map(
      (dimension) =>
        `| ${dimension.label} | ${dimension.weight}% | ${dimension.minimumScore} | - | ${escapeMarkdown(dimension.prompt)} |`,
    ),
    "",
    "## Shot Coverage",
    "",
    "| Group | Shot | Viewport | Matrix | Candidate | Baseline | Delta diagnostic |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...scorecard.shots.map(
      (shot) =>
        `| ${shot.group} | ${shot.title} | ${shot.viewport} | ${shot.matrixRows.join(", ")} | ${shot.candidate.available ? "PASS" : "MISSING"} | ${shot.baseline ? (shot.baseline.available ? "PASS" : "MISSING") : "N/A"} | ${renderDeltaDiagnostic(shot.delta)} |`,
    ),
    "",
    "## Review Rule",
    "",
    "An automatic failure rejects the candidate regardless of aesthetic score. A candidate becomes VERIFIED_CANDIDATE only after every required shot is reviewed, no finding remains open, each dimension meets its minimum, and the weighted score is at least 4.0. Production verification still requires exact-SHA deployment and live evidence.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function svgBuffer(width, height, children) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${children.join("")}</svg>`,
  );
}

function textSvg(text, x, y, size, color, weight) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0">${escapeXml(text)}</text>`;
}

function shortRef(ref) {
  if (!ref) return "UNSPECIFIED";
  return String(ref).slice(0, 10).toUpperCase();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderDeltaDiagnostic(delta) {
  if (!delta) return "N/A";
  if (!delta.dimensionsMatch) return `UNMATCHED (${delta.reason})`;
  return `${(delta.changedPixelFraction * 100).toFixed(2)}% changed at >=${delta.threshold}; mean channel ${delta.meanChannelDelta}`;
}
