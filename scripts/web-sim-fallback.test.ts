import assert from "node:assert/strict";
import test from "node:test";

import {
  allowInProcessSimFallback,
  createGame,
  loadGameState,
} from "../apps/many-lives-web/src/app/sim/_server/http";
import { GET as getSimHealth } from "../apps/many-lives-web/src/app/sim/health/route";
import { requestJson } from "../apps/many-lives-web/src/lib/api/client";

function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("allowInProcessSimFallback defaults on in development and respects explicit disable", async () => {
  await withEnv(
    {
      MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: undefined,
      NODE_ENV: "development",
    },
    () => {
      assert.equal(allowInProcessSimFallback(), true);
    },
  );

  await withEnv(
    {
      MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "false",
      NODE_ENV: "development",
    },
    () => {
      assert.equal(allowInProcessSimFallback(), false);
    },
  );
});

test("sim health falls back to the in-process runtime when the external sim is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
  };

  try {
    await withEnv(
      {
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
        MANY_LIVES_API_BASE_URL: "http://127.0.0.1:3000",
        NODE_ENV: "development",
      },
      async () => {
        const response = await getSimHealth();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.status, "ok");
        assert.equal(body.source, "in-process-fallback");
        assert.match(body.externalError, /Could not reach sim server/i);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("game creation falls back to the in-process runtime when the external sim is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
  };

  try {
    await withEnv(
      {
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
        MANY_LIVES_API_BASE_URL: "http://127.0.0.1:3000",
        NODE_ENV: "development",
      },
      async () => {
        const response = await createGame();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.ok(body.game);
        assert.equal(body.game.id.startsWith("game-"), true);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("in-process state fallback returns the player projection", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
  };

  try {
    await withEnv(
      {
        MANY_LIVES_ALLOW_IN_PROCESS_SIM_FALLBACK: "1",
        MANY_LIVES_API_BASE_URL: "http://127.0.0.1:3000",
        NODE_ENV: "development",
      },
      async () => {
        const createdResponse = await createGame();
        const createdBody = await createdResponse.json();
        const stateResponse = await loadGameState(createdBody.game.id);
        assert.equal(stateResponse.status, 200);

        const stateBody = await stateResponse.json();
        assert.ok(stateBody.game);
        assert.equal(
          stateBody.game.problems.every(
            (problem: { discovered: boolean }) => problem.discovered,
          ),
          true,
        );
        assert.equal(
          stateBody.game.jobs.every(
            (job: {
              accepted: boolean;
              completed: boolean;
              discovered: boolean;
              missed: boolean;
            }) =>
              job.discovered || job.accepted || job.completed || job.missed,
          ),
          true,
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("web API client unwraps structured error messages instead of raw JSON", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: "Game game-missing was not found.",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 404,
      },
    );

  try {
    await assert.rejects(
      requestJson("/game/game-missing/state"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Game game-missing was not found.");
        assert.doesNotMatch(error.message, /^\s*\{/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("web API client preserves plain text errors for diagnostics", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("backend unavailable", {
      status: 502,
    });

  try {
    await assert.rejects(requestJson("/health"), {
      message: "backend unavailable",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
