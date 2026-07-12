import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  closeChildProcess,
  waitForChildProcessReady,
} from "./visual-game-smoke-startup.mjs";

test("reports an early web child exit with captured logs", async () => {
  const logPath = path.join(
    tmpdir(),
    `manylives-visual-startup-${process.pid}-${Date.now()}.log`,
  );
  const child = spawn(
    process.execPath,
    [
      "-e",
      'process.stderr.write("listen EPERM: operation not permitted\\n"); process.exit(23)',
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const startedAt = Date.now();

  await assert.rejects(
    waitForChildProcessReady({
      baseUrl: "http://127.0.0.1:3011",
      checkReady: () => false,
      child,
      logPath,
      pollIntervalMs: 10,
      timeoutMs: 2_000,
    }),
    (error) => {
      assert.match(error.message, /code=23/);
      assert.match(error.message, /listen EPERM: operation not permitted/);
      assert.match(error.message, new RegExp(logPath.replaceAll("/", "\\/")));
      return true;
    },
  );

  assert.ok(
    Date.now() - startedAt < 1_000,
    "An exited child should fail well before the startup timeout.",
  );
  assert.match(
    await readFile(logPath, "utf8"),
    /listen EPERM: operation not permitted/,
  );
});

test("reports the last health error when a running child times out", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await assert.rejects(
      waitForChildProcessReady({
        baseUrl: "http://127.0.0.1:3012",
        checkReady: () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:3012");
        },
        child,
        pollIntervalMs: 10,
        timeoutMs: 50,
      }),
      (error) => {
        assert.match(error.message, /Timed out after 50ms/);
        assert.match(error.message, /connect ECONNREFUSED 127\.0\.0\.1:3012/);
        assert.match(error.message, /no child output captured/);
        return true;
      },
    );
  } finally {
    await closeChildProcess(child);
  }
});
