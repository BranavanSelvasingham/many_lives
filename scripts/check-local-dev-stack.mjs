const checks = [
  {
    label: "web",
    url: "http://127.0.0.1:3001",
    verify: async (response) => response.ok,
  },
  {
    label: "sim",
    url: "http://127.0.0.1:3000/health",
    verify: async (response) => {
      const payload = await response.json();
      return payload.status === "ok";
    },
  },
  {
    label: "web proxy",
    url: "http://127.0.0.1:3001/sim/health",
    verify: async (response) => {
      const payload = await response.json();
      return payload.status === "ok";
    },
  },
];

async function runCheck({ label, url, verify }) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    const ok = await verify(response);
    if (!ok) {
      throw new Error(
        `${label} check failed for ${url} with status ${response.status}`,
      );
    }

    return `${label}: ok`;
  } catch (error) {
    const detail = error?.cause?.message ?? error?.message ?? String(error);
    throw new Error(`${label} check failed for ${url}: ${detail}`);
  }
}

async function main() {
  const results = await Promise.allSettled(checks.map(runCheck));
  const failures = results.filter((result) => result.status === "rejected");

  for (const result of results) {
    if (result.status === "fulfilled") {
      process.stdout.write(`[many-lives] ${result.value}\n`);
      continue;
    }

    process.stderr.write(
      `[many-lives] ${result.reason?.message ?? String(result.reason)}\n`,
    );
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(
    `[many-lives] Local dev health check failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
