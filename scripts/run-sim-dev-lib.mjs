export function shouldFallbackToPlain(result, { shuttingDown = false } = {}) {
  if (result.signal || shuttingDown || result.code === 0) {
    return false;
  }

  const stderrText = result.stderrText ?? "";

  return (
    stderrText.includes("EMFILE: too many open files, watch") ||
    (stderrText.includes("code: 'EMFILE'") &&
      stderrText.includes("syscall: 'watch'"))
  );
}

export function parseDotEnvText(text) {
  const values = {};

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

export function mergeDotEnvValues(baseEnv, dotEnvValues) {
  const merged = { ...baseEnv };

  for (const [key, value] of Object.entries(dotEnvValues)) {
    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }

  return merged;
}
