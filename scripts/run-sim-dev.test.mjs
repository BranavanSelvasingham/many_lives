import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeDotEnvValues,
  parseDotEnvText,
  shouldFallbackToPlain,
} from "./run-sim-dev-lib.mjs";

test("falls back when watch mode hits the local file limit", () => {
  assert.equal(
    shouldFallbackToPlain({
      code: 1,
      signal: null,
      stderrText: "Error: EMFILE: too many open files, watch",
    }),
    true,
  );
});

test("falls back when the watcher reports EMFILE via syscall metadata", () => {
  assert.equal(
    shouldFallbackToPlain({
      code: 1,
      signal: null,
      stderrText: "code: 'EMFILE'\nsyscall: 'watch'",
    }),
    true,
  );
});

test("does not fall back after a clean exit", () => {
  assert.equal(
    shouldFallbackToPlain({
      code: 0,
      signal: null,
      stderrText: "Error: EMFILE: too many open files, watch",
    }),
    false,
  );
});

test("does not fall back while shutting down intentionally", () => {
  assert.equal(
    shouldFallbackToPlain(
      {
        code: 1,
        signal: null,
        stderrText: "Error: EMFILE: too many open files, watch",
      },
      { shuttingDown: true },
    ),
    false,
  );
});

test("does not fall back for unrelated errors", () => {
  assert.equal(
    shouldFallbackToPlain({
      code: 1,
      signal: null,
      stderrText: "Error: listen EADDRINUSE: address already in use 0.0.0.0:3000",
    }),
    false,
  );
});

test("parses simple dotenv values", () => {
  assert.deepEqual(
    parseDotEnvText(`
      # local config
      AI_PROVIDER=openai
      OPENAI_MODEL="gpt-5-mini"
      EMPTY=
    `),
    {
      AI_PROVIDER: "openai",
      EMPTY: "",
      OPENAI_MODEL: "gpt-5-mini",
    },
  );
});

test("dotenv values do not override explicit shell env", () => {
  assert.deepEqual(
    mergeDotEnvValues(
      {
        AI_PROVIDER: "mock",
      },
      {
        AI_PROVIDER: "openai",
        OPENAI_MODEL: "gpt-5-mini",
      },
    ),
    {
      AI_PROVIDER: "mock",
      OPENAI_MODEL: "gpt-5-mini",
    },
  );
});
