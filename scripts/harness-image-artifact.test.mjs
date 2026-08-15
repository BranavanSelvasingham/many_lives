import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { inspectImageArtifact } from "./harness-image-artifact.mjs";

const GAMEPLAY_SCREENSHOT_EXPECTATIONS = {
  format: "png",
  minEntropy: 3.5,
  minHeight: 350,
  minWidth: 800,
};

test("accepts a detailed full-frame PNG even when it compresses below 100 KB", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-image-"));
  const screenshotPath = path.join(outputDir, "structured-frame.png");
  const width = 819;
  const height = 375;
  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const value = (x + Math.floor(y / 4)) % 256;
      pixels[offset] = value;
      pixels[offset + 1] = (value + 32) % 256;
      pixels[offset + 2] = (value + 64) % 256;
    }
  }

  await sharp(pixels, { raw: { channels: 3, height, width } })
    .png()
    .toFile(screenshotPath);

  const file = await readFile(screenshotPath);
  assert.ok(
    file.length < 100_000,
    `Fixture unexpectedly grew to ${file.length} bytes.`,
  );
  const evidence = await inspectImageArtifact(
    screenshotPath,
    GAMEPLAY_SCREENSHOT_EXPECTATIONS,
  );

  assert.equal(evidence.width, width);
  assert.equal(evidence.height, height);
  assert.ok(evidence.entropy >= GAMEPLAY_SCREENSHOT_EXPECTATIONS.minEntropy);
});

test("rejects a full-frame PNG that contains no meaningful rendered detail", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-image-"));
  const screenshotPath = path.join(outputDir, "blank-frame.png");

  await sharp({
    create: {
      background: "#111111",
      channels: 3,
      height: 375,
      width: 819,
    },
  })
    .png()
    .toFile(screenshotPath);

  await assert.rejects(
    inspectImageArtifact(screenshotPath, GAMEPLAY_SCREENSHOT_EXPECTATIONS),
    /lacks rendered detail/,
  );
});
