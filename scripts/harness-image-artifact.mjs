import sharp from "sharp";

export async function inspectImageArtifact(filePath, expectations = {}) {
  const image = sharp(filePath, { failOn: "error" });
  const metadata = await image.metadata();
  const stats = await sharp(filePath, { failOn: "error" }).stats();

  const evidence = {
    entropy: stats.entropy,
    format: metadata.format,
    height: metadata.height,
    width: metadata.width,
  };

  if (expectations.format && metadata.format !== expectations.format) {
    throw new Error(
      `Image artifact has format ${metadata.format ?? "unknown"}; expected ${expectations.format}: ${filePath}`,
    );
  }
  if ((metadata.width ?? 0) < (expectations.minWidth ?? 1)) {
    throw new Error(
      `Image artifact is too narrow (${metadata.width ?? 0}px); expected at least ${expectations.minWidth}px: ${filePath}`,
    );
  }
  if ((metadata.height ?? 0) < (expectations.minHeight ?? 1)) {
    throw new Error(
      `Image artifact is too short (${metadata.height ?? 0}px); expected at least ${expectations.minHeight}px: ${filePath}`,
    );
  }
  if (stats.entropy < (expectations.minEntropy ?? 0)) {
    throw new Error(
      `Image artifact lacks rendered detail (entropy ${stats.entropy.toFixed(3)}); expected at least ${expectations.minEntropy}: ${filePath}`,
    );
  }

  return evidence;
}
