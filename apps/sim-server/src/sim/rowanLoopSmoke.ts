import { pathToFileURL } from "node:url";
import { MockAIProvider } from "../ai/mockProvider.js";
import { SimulationEngine } from "./engine.js";
import type { StreetGameState } from "../street-sim/types.js";
import type { GameCommand } from "../types/api.js";

export interface RowanLoopSmokeTraceEntry {
  step: number;
  command: string;
  clock: string;
  locationId?: string;
  objective?: string;
  progress?: string;
  routeKey?: string;
  activeConversation?: string;
  autonomyKey: string;
  autonomyLabel: string;
  autonomyLayer?: string;
  autonomyStep?: string;
  autonomyTarget?: string;
  money: number;
  energy: number;
}

export interface RowanLoopSmokeResult {
  finalWorld: StreetGameState;
  trace: RowanLoopSmokeTraceEntry[];
}

interface RowanLoopSmokeOptions {
  gameId?: string;
  maxSteps?: number;
}

export async function runRowanLoopSmoke(
  options: RowanLoopSmokeOptions = {},
): Promise<RowanLoopSmokeResult> {
  const engine = new SimulationEngine(new MockAIProvider());
  let world = await engine.createGame(options.gameId ?? "rowan-loop-smoke");
  const maxSteps = options.maxSteps ?? 10;
  const trace = [buildTraceEntry(0, "create_game", world)];
  const seen = new Map<string, number>();

  for (let step = 1; step <= maxSteps; step += 1) {
    const command: GameCommand = {
      type: "advance_objective",
      allowTimeSkip: true,
    };
    world = await engine.runCommand(world, command);
    trace.push(buildTraceEntry(step, "advance_objective", world));
    guardAgainstStall(world, seen, step, trace);

    if (isSuccessfulSmokeEndState(world)) {
      return { finalWorld: world, trace };
    }
  }

  throw new Error(
    [
      `Rowan loop smoke did not reach the expected post-rest handoff within ${maxSteps} steps.`,
      formatTrace(trace),
    ].join("\n"),
  );
}

export function formatTrace(trace: RowanLoopSmokeTraceEntry[]): string {
  return trace
    .map((entry) =>
      [
        `${entry.step}. ${entry.command}`,
        entry.clock,
        entry.locationId ?? "no-location",
        entry.objective ?? "no-objective",
        entry.progress ?? "no-progress",
        `${entry.autonomyLayer ?? "no-layer"}/${entry.autonomyStep ?? "no-step"}`,
        entry.autonomyLabel,
        entry.autonomyTarget ? `target=${entry.autonomyTarget}` : undefined,
        entry.activeConversation
          ? `thread=${entry.activeConversation}`
          : undefined,
        `$${entry.money}`,
        `${entry.energy} energy`,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

function buildTraceEntry(
  step: number,
  command: string,
  world: StreetGameState,
): RowanLoopSmokeTraceEntry {
  return {
    step,
    command,
    clock: `${String(world.clock.hour).padStart(2, "0")}:${String(world.clock.minute).padStart(2, "0")} ${world.clock.label}`,
    locationId: world.player.currentLocationId,
    objective: world.player.objective?.text,
    progress: world.player.objective?.progress.label,
    routeKey: world.player.objective?.routeKey,
    activeConversation: world.activeConversation?.npcId,
    autonomyKey: world.rowanAutonomy.key,
    autonomyLabel: world.rowanAutonomy.label,
    autonomyLayer: world.rowanAutonomy.layer,
    autonomyStep: world.rowanAutonomy.stepKind,
    autonomyTarget: world.rowanAutonomy.targetLocationId,
    money: world.player.money,
    energy: world.player.energy,
  };
}

function guardAgainstStall(
  world: StreetGameState,
  seen: Map<string, number>,
  step: number,
  trace: RowanLoopSmokeTraceEntry[],
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
  ].join("|");
  const count = (seen.get(signature) ?? 0) + 1;
  seen.set(signature, count);

  if (count >= 2) {
    throw new Error(
      [
        `Rowan loop smoke repeated the same progression signature at step ${step}.`,
        formatTrace(trace),
      ].join("\n"),
    );
  }
}

function isSuccessfulSmokeEndState(world: StreetGameState): boolean {
  const teaShift = world.jobs.find((job) => job.id === "job-tea-shift");

  return Boolean(
    teaShift?.completed &&
      world.clock.hour >= 14 &&
      world.clock.label === "Afternoon" &&
      world.player.currentLocationId === world.player.homeLocationId &&
      world.player.objective?.routeKey !== "rest-home" &&
      world.rowanAutonomy.stepKind !== "wait" &&
      world.rowanAutonomy.targetLocationId !== world.player.homeLocationId,
  );
}

async function main(): Promise<void> {
  const result = await runRowanLoopSmoke();
  process.stdout.write("[many-lives] Rowan loop smoke passed.\n");
  process.stdout.write(`${formatTrace(result.trace)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `[many-lives] Rowan loop smoke failed: ${error.stack ?? error.message}\n`,
    );
    process.exit(1);
  });
}
