import { appendFileSync, writeFileSync } from "node:fs";
import { once } from "node:events";

const MAX_CAPTURED_LOG_CHARS = 12_000;

function childIsRunning(child) {
  return Boolean(
    child && child.exitCode === null && child.signalCode === null,
  );
}

async function stopChildProcess(child, signal, timeoutMs) {
  let timeout;
  try {
    const closed = once(child, "close").catch(() => undefined);
    signalChildProcess(child, signal);
    await Promise.race([
      closed,
      new Promise((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function signalChildProcess(child, signal) {
  if (!childIsRunning(child)) {
    return;
  }

  if (child.manyLivesKillGroup && child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {}
  }

  try {
    child.kill(signal);
  } catch {}
}

function destroyChildProcessStreams(child) {
  for (const stream of [
    child?.stdin,
    child?.stdout,
    child?.stderr,
    ...(child?.stdio ?? []),
  ]) {
    try {
      stream?.destroy?.();
    } catch {}
  }
}

export async function closeChildProcess(child) {
  if (!child) {
    return;
  }

  if (childIsRunning(child)) {
    await stopChildProcess(child, "SIGTERM", 1_500);
  }

  if (childIsRunning(child)) {
    await stopChildProcess(child, "SIGKILL", 1_500);
  }

  destroyChildProcessStreams(child);
}

function describeChildFailure({
  baseUrl,
  childError,
  exitCode,
  exitSignal,
  healthError,
  logPath,
  logs,
  timeoutMs,
}) {
  const details = [];
  if (childError) {
    details.push(`Spawn error: ${childError.message}`);
  } else if (exitCode !== null || exitSignal !== null) {
    details.push(
      `Child exited before becoming healthy (code=${String(exitCode)}, signal=${String(exitSignal)}).`,
    );
  } else {
    details.push(`Timed out after ${timeoutMs}ms.`);
  }

  if (healthError) {
    details.push(`Last health error: ${healthError.message}`);
  }
  if (logPath) {
    details.push(`Child log: ${logPath}`);
  }
  details.push(logs.trim() || "(no child output captured)");

  return `Local web app failed to start at ${baseUrl}.\n${details.join("\n")}`;
}

export async function waitForChildProcessReady({
  baseUrl,
  checkReady,
  child,
  logPath,
  pollIntervalMs = 250,
  timeoutMs,
}) {
  let childError = null;
  let exitCode = child.exitCode;
  let exitSignal = child.signalCode;
  let healthError = null;
  let logs = "";

  if (logPath) {
    writeFileSync(logPath, "", "utf8");
  }

  const appendLogs = (chunk) => {
    const text = chunk.toString();
    logs += text;
    if (logs.length > MAX_CAPTURED_LOG_CHARS) {
      logs = logs.slice(-MAX_CAPTURED_LOG_CHARS);
    }
    if (logPath) {
      appendFileSync(logPath, text, "utf8");
    }
  };

  child.stdout?.on("data", appendLogs);
  child.stderr?.on("data", appendLogs);
  child.once("error", (error) => {
    childError = error;
  });
  child.once("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (childError || exitCode !== null || exitSignal !== null) {
      throw new Error(
        describeChildFailure({
          baseUrl,
          childError,
          exitCode,
          exitSignal,
          healthError,
          logPath,
          logs,
          timeoutMs,
        }),
      );
    }

    try {
      if (await checkReady()) {
        return;
      }
    } catch (error) {
      healthError = error instanceof Error ? error : new Error(String(error));
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    describeChildFailure({
      baseUrl,
      childError,
      exitCode,
      exitSignal,
      healthError,
      logPath,
      logs,
      timeoutMs,
    }),
  );
}
