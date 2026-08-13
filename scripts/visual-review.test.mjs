import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  createHumanAssessmentTemplate,
  generateVisualReviewArtifacts,
  loadVisualReviewContract,
  validateVisualReviewContract,
} from "./visual-review.mjs";

test("visual review contract is finite, weighted, and covers every matrix row", async () => {
  const contract = await loadVisualReviewContract();
  assert.equal(
    contract.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
    100,
  );
  assert.ok(contract.shots.length >= 20);
  assert.ok(contract.shots.filter((shot) => shot.comparison).length >= 4);
  assert.equal(contract.automaticRejects.length, 8);
  assert.equal(new Set(contract.requiredViewportProfiles).size, 10);
  assert.throws(
    () =>
      validateVisualReviewContract({
        ...structuredClone(contract),
        dimensions: contract.dimensions.map((dimension, index) => ({
          ...dimension,
          weight: index === 0 ? dimension.weight - 1 : dimension.weight,
        })),
      }),
    /weights must total 100/,
  );
});

test("visual review packet separates automatic evidence from human judgment", async () => {
  const contract = await loadVisualReviewContract();
  const root = await mkdtemp(path.join(tmpdir(), "many-lives-visual-review-"));
  const candidateDir = path.join(root, "candidate");
  const baselineDir = path.join(root, "baseline");
  const outputDir = path.join(root, "report");
  const comparedOutputDir = path.join(root, "compared-report");

  try {
    const png = await sharp({
      create: {
        background: "#6f7f72",
        channels: 4,
        height: 300,
        width: 400,
      },
    })
      .png()
      .toBuffer();
    await Promise.all([
      ...contract.shots.flatMap((shot) => [
        writeFixture(path.join(candidateDir, shot.file), png),
        writeFixture(path.join(baselineDir, shot.file), png),
      ]),
      writeFixture(
        path.join(candidateDir, "summary.json"),
        Buffer.from(`${JSON.stringify(passingSummary(contract), null, 2)}\n`),
      ),
    ]);

    const pending = await generateVisualReviewArtifacts({
      candidateDir,
      candidateRef: "candidate123",
      outputDir,
    });
    assert.equal(pending.automaticStatus, "passed");
    assert.equal(pending.humanStatus, "pending");
    assert.equal(pending.verdict, "HUMAN_REVIEW_REQUIRED");
    assert.ok(existsSync(pending.reviewDeckPath));
    assert.ok(existsSync(pending.scorecardPath));
    assert.ok(existsSync(pending.assessmentTemplatePath));
    const deckMetadata = await sharp(pending.reviewDeckPath).metadata();
    assert.ok(deckMetadata.width >= 1500);
    assert.ok(deckMetadata.height >= 1000);

    const assessment = passingAssessment(contract);
    const verified = await generateVisualReviewArtifacts({
      assessment,
      baselineDir,
      baselineRef: "baseline456",
      candidateDir,
      candidateRef: "candidate123",
      outputDir: comparedOutputDir,
      requireBaseline: true,
    });
    assert.equal(verified.automaticStatus, "passed");
    assert.equal(verified.humanStatus, "passed");
    assert.equal(verified.verdict, "VERIFIED_CANDIDATE");
    assert.ok(existsSync(verified.comparisonPath));
    const scorecard = JSON.parse(
      await readFile(verified.scorecardPath, "utf8"),
    );
    assert.equal(scorecard.human.weightedScore, 4);
    assert.equal(scorecard.coverage.available, contract.shots.length);
    const comparedShots = scorecard.shots.filter((shot) => shot.comparison);
    assert.ok(comparedShots.length >= 4);
    assert.ok(
      comparedShots.every(
        (shot) =>
          shot.delta.dimensionsMatch && shot.delta.changedPixelFraction === 0,
      ),
    );

    const comparisonShot = contract.shots.find((shot) => shot.comparison);
    const mismatchedPng = await sharp({
      create: {
        background: "#6f7f72",
        channels: 4,
        height: 300,
        width: 410,
      },
    })
      .png()
      .toBuffer();
    await writeFixture(
      path.join(baselineDir, comparisonShot.file),
      mismatchedPng,
    );
    const mismatched = await generateVisualReviewArtifacts({
      assessment,
      baselineDir,
      candidateDir,
      outputDir: path.join(root, "mismatched-report"),
      requireBaseline: true,
    });
    assert.equal(mismatched.automaticStatus, "failed");
    const mismatchedScorecard = JSON.parse(
      await readFile(mismatched.scorecardPath, "utf8"),
    );
    assert.equal(
      mismatchedScorecard.automated.checks.find(
        (check) => check.id === "matched-baseline",
      ).status,
      "failed",
    );
    await writeFixture(path.join(baselineDir, comparisonShot.file), png);

    await unlink(path.join(candidateDir, contract.shots[0].file));
    const rejected = await generateVisualReviewArtifacts({
      assessment,
      baselineDir,
      candidateDir,
      outputDir: path.join(root, "rejected-report"),
      requireBaseline: true,
    });
    assert.equal(rejected.automaticStatus, "failed");
    assert.equal(rejected.verdict, "AUTOMATED_REJECT");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function passingSummary(contract) {
  return {
    afterHoursNpcAvailability: {},
    authoredInteriorIdentity: {
      "repair-stall": {},
      "tea-house": {},
    },
    freshAutoplayStart: {
      advanced: {
        visibleDecisionArtifact: { status: "visible" },
        watchMode: { enabled: true },
      },
      screenshotPath: "fresh-autoplay-started.png",
    },
    interiorCamera: {
      mobileScreenshotPath: "interior-camera-mobile.png",
      screenshotPath: "interior-camera.png",
    },
    nextDevelopmentIndicatorDisabled: true,
    pageHealth: { status: "passed", unexpectedPageErrors: [] },
    results: contract.requiredViewportProfiles.map((name) => ({
      viewport: { name },
    })),
    screenshotPixelDiagnostics: [{ label: "desktop" }],
    secondaryLandmarkRouteIdentity: {
      courtyard: {},
      "moss-pier": {},
    },
    storedGameChoice: {
      desktopPromptScreenshotPath: "saved-run-prompt-desktop.png",
      freshGameId: "fresh-game",
      mobilePromptScreenshotPath: "saved-run-prompt-mobile.png",
      resumedGameId: "saved-game",
      seededGameId: "saved-game",
    },
    visualQualityRegression: {
      categories: ["major-composition-or-dropout"],
      status: "passed",
    },
    webBase: "http://127.0.0.1:3001",
  };
}

function passingAssessment(contract) {
  const assessment = createHumanAssessmentTemplate(contract);
  assessment.reviewer = "Visual QA";
  assessment.reviewedAt = "2026-08-13T00:00:00.000Z";
  for (const dimension of contract.dimensions) {
    assessment.dimensions[dimension.id] = {
      notes: "Reviewed against the contact sheet and runtime evidence.",
      score: 4,
    };
  }
  for (const shot of contract.shots) {
    assessment.shots[shot.id] = { notes: "No finding.", status: "pass" };
  }
  return assessment;
}

async function writeFixture(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}
