#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { generateVisualReviewArtifacts } from "./visual-review.mjs";

const candidateDir =
  readPathOption("--candidate") ?? process.env.MANY_LIVES_VISUAL_CHECK_DIR;
if (!candidateDir) {
  console.error(
    "Usage: corepack pnpm visual:review --candidate <evidence-dir> [--baseline <evidence-dir>] [--output <report-dir>] [--assessment <json>] [--require-baseline]",
  );
  process.exit(2);
}

const assessmentPath = readPathOption("--assessment");
const baselineDir = readPathOption("--baseline");
const outputDir =
  readPathOption("--output") ?? path.join(candidateDir, "visual-review");
const assessment = assessmentPath
  ? JSON.parse(await readFile(assessmentPath, "utf8"))
  : null;

try {
  const result = await generateVisualReviewArtifacts({
    assessment,
    baselineDir,
    baselineRef: readValueOption("--baseline-ref"),
    candidateDir,
    candidateRef: readValueOption("--candidate-ref"),
    outputDir,
    requireBaseline: process.argv.includes("--require-baseline"),
  });
  console.log(`[many-lives:visual-review] Verdict: ${result.verdict}`);
  console.log(`[many-lives:visual-review] Scorecard: ${result.scorecardPath}`);
  console.log(
    `[many-lives:visual-review] Review deck: ${result.reviewDeckPath}`,
  );
  if (result.comparisonPath) {
    console.log(
      `[many-lives:visual-review] Comparison: ${result.comparisonPath}`,
    );
  }
  console.log(`[many-lives:visual-review] Report: ${result.reportPath}`);

  if (result.automaticStatus === "failed" || result.humanStatus === "failed") {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `[many-lives:visual-review] Failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exitCode = 1;
}

function readValueOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function readPathOption(name) {
  const value = readValueOption(name);
  return value ? path.resolve(value) : null;
}
