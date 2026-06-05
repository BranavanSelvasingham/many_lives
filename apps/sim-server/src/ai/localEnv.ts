import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadLocalEnvFiles(): void {
  for (const filePath of localEnvPaths()) {
    if (!existsSync(filePath)) {
      continue;
    }

    const values = parseDotEnvText(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      process.env[key] ??= value;
    }
  }
}

function localEnvPaths(): string[] {
  const roots = [process.cwd(), path.resolve(process.cwd(), "../..")];
  const uniqueRoots = [...new Set(roots)];
  return uniqueRoots.flatMap((root) => [
    path.join(root, ".env"),
    path.join(root, ".env.local"),
    path.join(root, "apps/many-lives-web/.env.local"),
    path.join(root, "apps/sim-server/.env.local"),
  ]);
}

function parseDotEnvText(text: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}
