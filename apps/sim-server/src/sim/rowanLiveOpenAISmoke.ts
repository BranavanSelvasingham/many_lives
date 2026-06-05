import assert from "node:assert/strict";
import { loadLocalEnvFiles } from "../ai/localEnv.js";
import {
  DEFAULT_OPENAI_TIMEOUT_MS,
  OpenAIProvider,
} from "../ai/openaiProvider.js";
import { SimulationEngine } from "./engine.js";
import type { StreetGameState } from "../street-sim/types.js";
import type { GameCommand } from "../types/api.js";

loadLocalEnvFiles();

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  assert.ok(
    apiKey,
    "OPENAI_API_KEY is required. Add it to the shell env or local .env before running live:openai:rowan.",
  );

  const maxSteps = Number(process.env.MANY_LIVES_LIVE_ROWAN_STEPS ?? 8);
  const sessionCount = Math.max(
    1,
    Number(process.env.MANY_LIVES_LIVE_ROWAN_SESSIONS ?? 1),
  );
  const output: string[] = [];

  for (let sessionIndex = 1; sessionIndex <= sessionCount; sessionIndex += 1) {
    const provider = new OpenAIProvider({
      apiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      timeoutMs: Number(
        process.env.OPENAI_TIMEOUT_MS ?? DEFAULT_OPENAI_TIMEOUT_MS,
      ),
    });
    const session = await runLiveRowanSession({
      maxSteps,
      provider,
      sessionIndex,
    });
    output.push(...session.output);
  }

  process.stdout.write(
    [
      `[many-lives] Live Rowan OpenAI stability passed across ${sessionCount} session${sessionCount === 1 ? "" : "s"}.`,
      "",
      ...output,
      "",
    ].join("\n"),
  );
}

async function runLiveRowanSession({
  maxSteps,
  provider,
  sessionIndex,
}: {
  maxSteps: number;
  provider: OpenAIProvider;
  sessionIndex: number;
}) {
  const engine = new SimulationEngine(provider);
  const trace: Array<ReturnType<typeof traceEntry>> = [];
  const seen = new Map<string, number>();
  let world = await engine.createGame(
    `rowan-live-openai-${Date.now()}-${sessionIndex}`,
  );
  trace.push(traceEntry(0, "create_game", world));

  for (let step = 1; step <= maxSteps; step += 1) {
    const command: GameCommand = {
      allowTimeSkip: true,
      type: "advance_objective",
    };
    world = await engine.runCommand(world, command);
    trace.push(traceEntry(step, "advance_objective", world));
    guardAgainstRepeatedLiveState(world, seen, step, trace);

    if (world.player.objective?.progress.completed === world.player.objective?.progress.total) {
      break;
    }
  }

  const calls = provider.getCallLog();
  const plannerCalls = calls.filter(
    (entry) => entry.task === "planStreetNextAction",
  );
  const successfulPlannerCalls = plannerCalls.filter(
    (entry) => entry.status === "success",
  );
  const fallbacks = calls.filter((entry) => entry.status === "fallback");

  assert.ok(
    successfulPlannerCalls.length > 0,
    `Live Rowan session ${sessionIndex} did not complete any successful OpenAI planner calls.`,
  );
  assert.deepEqual(
    fallbacks,
    [],
    `Live Rowan session ${sessionIndex} fell back from OpenAI:\n${fallbacks
      .map((entry) => `${entry.task}: ${entry.error ?? "unknown error"}`)
      .join("\n")}`,
  );
  assert.ok(
    trace.some((entry) => entry.reason && entry.signals >= 2),
    `Live Rowan session ${sessionIndex} did not expose state-grounded autonomy reasons.`,
  );
  const mismatchedMoveActions = trace.filter(
    (entry) =>
      entry.stepKind === "move" &&
      entry.targetLocationId &&
      entry.actionId !== `move:${entry.targetLocationId}`,
  );
  assert.deepEqual(
    mismatchedMoveActions,
    [],
    [
      `Live Rowan session ${sessionIndex} exposed a future action as the current move action.`,
      ...mismatchedMoveActions.map(formatTraceEntry),
      "",
      ...trace.map(formatTraceEntry),
    ].join("\n"),
  );
  if (maxSteps >= 14) {
    assert.ok(
      longLiveOutcomeIsCoherent(world, trace),
      [
        `Long live Rowan session ${sessionIndex} did not stay coherent through the first afternoon.`,
        ...trace.map(formatTraceEntry),
      ].join("\n"),
    );
  }

  return {
    output: [
      `[many-lives] Live Rowan OpenAI session ${sessionIndex} passed.`,
      `plannerCalls=${plannerCalls.length}`,
      `plannerSuccesses=${successfulPlannerCalls.length}`,
      `fallbacks=${fallbacks.length}`,
      "",
      ...trace.map(formatTraceEntry),
      "",
    ],
  };
}

function traceEntry(step: number, command: string, world: StreetGameState) {
  return {
    actionId: world.rowanAutonomy.actionId,
    activeConversation: world.activeConversation?.npcId,
    clock: `${String(world.clock.hour).padStart(2, "0")}:${String(world.clock.minute).padStart(2, "0")} ${world.clock.label}`,
    command,
    energy: world.player.energy,
    label: world.rowanAutonomy.label,
    layer: world.rowanAutonomy.layer,
    locationId: world.player.currentLocationId,
    money: world.player.money,
    outcomes:
      world.player.objective?.progress.label ??
      `${world.player.objective?.progress.completed ?? 0}/${world.player.objective?.progress.total ?? 0}`,
    reason: world.rowanAutonomy.intent?.reason,
    signals: world.rowanAutonomy.intent?.signals.length ?? 0,
    step,
    stepKind: world.rowanAutonomy.stepKind,
    targetLocationId: world.rowanAutonomy.targetLocationId,
  };
}

function formatTraceEntry(entry: ReturnType<typeof traceEntry>): string {
  return [
    `${entry.step}. ${entry.command}`,
    entry.clock,
    entry.locationId ?? "no-location",
    entry.outcomes,
    `${entry.layer}/${entry.stepKind}`,
    entry.label,
    entry.actionId ? `action=${entry.actionId}` : undefined,
    entry.targetLocationId ? `target=${entry.targetLocationId}` : undefined,
    entry.reason ? `why=${entry.reason}` : undefined,
    entry.activeConversation ? `thread=${entry.activeConversation}` : undefined,
    `signals=${entry.signals}`,
    `$${entry.money}`,
    `${entry.energy} energy`,
  ]
    .filter(Boolean)
    .join(" | ");
}

function guardAgainstRepeatedLiveState(
  world: StreetGameState,
  seen: Map<string, number>,
  step: number,
  trace: Array<ReturnType<typeof traceEntry>>,
): void {
  const signature = [
    world.clock.totalMinutes,
    world.player.currentLocationId,
    world.player.objective?.id,
    world.player.objective?.progress.label,
    world.activeConversation?.threadId,
    world.activeConversation?.updatedAt,
    world.rowanAutonomy.key,
    world.rowanAutonomy.stepKind,
    world.rowanAutonomy.targetLocationId,
    world.rowanAutonomy.intent?.reason,
  ].join("|");
  const count = (seen.get(signature) ?? 0) + 1;
  seen.set(signature, count);

  assert.notEqual(
    count,
    2,
    [
      `Live Rowan session repeated the same progression signature at step ${step}.`,
      ...trace.map(formatTraceEntry),
    ].join("\n"),
  );
}

function longLiveOutcomeIsCoherent(
  world: StreetGameState,
  trace: Array<ReturnType<typeof traceEntry>>,
) {
  if (
    world.firstAfternoon?.completedAt &&
    world.player.objective?.progress.completed ===
      world.player.objective?.progress.total
  ) {
    return true;
  }

  const latest = trace[trace.length - 1];
  if (!latest || latest.stepKind === "blocked") {
    return false;
  }

  if (world.player.energy < 28) {
    return (
      latest.targetLocationId === world.player.homeLocationId ||
      latest.locationId === world.player.homeLocationId ||
      latest.actionId === "rest:home"
    );
  }

  return Boolean(latest.actionId || latest.targetLocationId);
}

void main().catch((error) => {
  process.stderr.write(
    `[many-lives] Live Rowan OpenAI session failed: ${error.stack ?? error.message}\n`,
  );
  process.exit(1);
});
