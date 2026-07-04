import { pathToFileURL } from "node:url";
import { MockAIProvider } from "../ai/mockProvider.js";
import { SimulationEngine } from "./engine.js";
import { objectiveRouteCompletionIdleCopy } from "./objectiveScaffolds.js";
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
  activeCityEvents: string[];
  autonomyKey: string;
  autonomyActionId?: string;
  autonomyLabel: string;
  autonomyLayer?: string;
  autonomyReason?: string;
  autonomySignals: string[];
  autonomyStep?: string;
  autonomyTarget?: string;
  autonomyTravelPhase?: string;
  availableActionIds: string[];
  completedJobIds: string[];
  money: number;
  energy: number;
  nextTrailActionId?: string;
  nextTrailNpcId?: string;
  nextTrailStepId?: string;
  nextTrailTargetLocationId?: string;
  openJobIds: string[];
  openProblemIds: string[];
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
  const maxSteps = options.maxSteps ?? 20;
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
    guardAgainstDuplicateTravelDecisionBeats(trace);
    guardCompletedJobsAreNotMissed(world, trace);

    if (isSuccessfulSmokeEndState(world)) {
      guardAgainstCannedAutonomy(trace);
      guardObjectiveAutonomyIsStateGrounded(trace);
      return { finalWorld: world, trace };
    }
  }

  throw new Error(
    [
      `Rowan loop smoke did not reach the expected first-afternoon finish within ${maxSteps} steps.`,
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
        entry.autonomyTravelPhase
          ? `travel=${entry.autonomyTravelPhase}`
          : undefined,
        entry.autonomyLabel,
        entry.autonomyActionId ? `action=${entry.autonomyActionId}` : undefined,
        entry.autonomyReason ? `why=${entry.autonomyReason}` : undefined,
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
  const nextTrailStep = world.player.objective?.trail.find(
    (step) => !step.done,
  );

  return {
    step,
    command,
    clock: `${String(world.clock.hour).padStart(2, "0")}:${String(world.clock.minute).padStart(2, "0")} ${world.clock.label}`,
    locationId: world.player.currentLocationId,
    objective: world.player.objective?.text,
    progress: world.player.objective?.progress.label,
    routeKey: world.player.objective?.routeKey,
    activeConversation: world.activeConversation?.npcId,
    activeCityEvents: world.cityEvents
      .filter((event) => event.status === "active")
      .map((event) => event.id),
    autonomyKey: world.rowanAutonomy.key,
    autonomyActionId: world.rowanAutonomy.actionId,
    autonomyLabel: world.rowanAutonomy.label,
    autonomyLayer: world.rowanAutonomy.layer,
    autonomyReason: world.rowanAutonomy.intent?.reason,
    autonomySignals: world.rowanAutonomy.intent?.signals ?? [],
    autonomyStep: world.rowanAutonomy.stepKind,
    autonomyTarget: world.rowanAutonomy.targetLocationId,
    autonomyTravelPhase: world.rowanAutonomy.travelPhase,
    availableActionIds: world.availableActions
      .filter((action) => !action.disabled)
      .map((action) => action.id),
    completedJobIds: world.jobs
      .filter((job) => job.completed)
      .map((job) => job.id),
    money: world.player.money,
    energy: world.player.energy,
    nextTrailActionId: nextTrailStep?.actionId,
    nextTrailNpcId: nextTrailStep?.npcId,
    nextTrailStepId: nextTrailStep?.id,
    nextTrailTargetLocationId: nextTrailStep?.targetLocationId,
    openJobIds: world.jobs
      .filter((job) => job.discovered && !job.completed && !job.missed)
      .map((job) => job.id),
    openProblemIds: world.problems
      .filter(
        (problem) => problem.discovered && problem.status === "active",
      )
      .map((problem) => problem.id),
  };
}

function guardAgainstDuplicateTravelDecisionBeats(
  trace: RowanLoopSmokeTraceEntry[],
): void {
  const current = trace[trace.length - 1];
  const previous = trace[trace.length - 2];
  if (!current || !previous) {
    return;
  }

  if (
    isUnmarkedTravelDecision(previous) &&
    isUnmarkedTravelDecision(current) &&
    previous.autonomyActionId === current.autonomyActionId &&
    previous.autonomyLabel === current.autonomyLabel &&
    previous.autonomyTarget === current.autonomyTarget &&
    previous.locationId === current.locationId &&
    previous.clock === current.clock
  ) {
    throw new Error(
      [
        "Rowan loop smoke repeated the same travel decision without route-progress carry-forward.",
        formatTrace(trace),
      ].join("\n"),
    );
  }
}

function isUnmarkedTravelDecision(entry: RowanLoopSmokeTraceEntry): boolean {
  return Boolean(
    entry.autonomyStep === "move" &&
      entry.autonomyActionId?.startsWith("move:") &&
      entry.autonomyTravelPhase !== "route-progress",
  );
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
    world.rowanAutonomy.intent?.reason,
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

function guardAgainstCannedAutonomy(trace: RowanLoopSmokeTraceEntry[]): void {
  const meaningfulEntries = trace.filter(
    (entry) => entry.autonomyStep && entry.autonomyStep !== "idle",
  );
  const reasons = new Set(
    meaningfulEntries
      .map((entry) => entry.autonomyReason?.trim())
      .filter((reason): reason is string => Boolean(reason)),
  );
  const signalCounts = meaningfulEntries.map(
    (entry) => entry.autonomySignals.length,
  );

  if (meaningfulEntries.length === 0) {
    throw new Error(`Rowan loop smoke saw no active autonomy steps.\n${formatTrace(trace)}`);
  }

  if (reasons.size < Math.min(3, meaningfulEntries.length)) {
    throw new Error(
      [
        "Rowan autonomy did not expose enough distinct state-based reasons.",
        formatTrace(trace),
      ].join("\n"),
    );
  }

  if (signalCounts.some((count) => count < 2)) {
    throw new Error(
      [
        "Rowan autonomy reasons need at least two state signals per active step.",
        formatTrace(trace),
      ].join("\n"),
    );
  }
}

function guardObjectiveAutonomyIsStateGrounded(
  trace: RowanLoopSmokeTraceEntry[],
): void {
  const objectiveEntries = trace.filter(
    (entry) =>
      entry.autonomyLayer === "objective" &&
      entry.autonomyStep &&
      entry.autonomyStep !== "idle" &&
      entry.autonomyStep !== "blocked",
  );

  if (objectiveEntries.length === 0) {
    throw new Error(
      `Rowan loop smoke saw no objective-layer autonomy.\n${formatTrace(trace)}`,
    );
  }

  const groundedEntries = objectiveEntries.filter(hasStateGroundingEvidence);
  if (groundedEntries.length < Math.min(3, objectiveEntries.length)) {
    throw new Error(
      [
        "Rowan objective autonomy is not sufficiently grounded in legal actions or evolving state.",
        formatTrace(trace),
      ].join("\n"),
    );
  }

  const unsupportedRouteMirrors = objectiveEntries.filter(
    (entry) =>
      mirrorsNextTrailStep(entry) && !hasStateGroundingEvidence(entry),
  );
  if (unsupportedRouteMirrors.length > 0) {
    throw new Error(
      [
        "Rowan objective autonomy is mirroring objective trail steps without state-derived evidence.",
        formatTrace(trace),
      ].join("\n"),
    );
  }
}

function hasStateGroundingEvidence(entry: RowanLoopSmokeTraceEntry): boolean {
  const selectedLegalAction = Boolean(
    entry.autonomyActionId &&
      entry.availableActionIds.includes(entry.autonomyActionId),
  );
  const liveWorldPressure =
    entry.activeCityEvents.length > 0 ||
    entry.openJobIds.length > 0 ||
    entry.openProblemIds.length > 0 ||
    entry.completedJobIds.length > 0;
  const stateSignals = entry.autonomySignals.filter((signal) =>
    /^(Here|Target|Person|Action|Timing|Resources|Commitment):/.test(signal),
  );

  return selectedLegalAction || liveWorldPressure || stateSignals.length >= 2;
}

function mirrorsNextTrailStep(entry: RowanLoopSmokeTraceEntry): boolean {
  if (!entry.nextTrailStepId) {
    return false;
  }

  return Boolean(
    (entry.autonomyActionId &&
      entry.autonomyActionId === entry.nextTrailActionId) ||
      (entry.autonomyTarget &&
        entry.autonomyTarget === entry.nextTrailTargetLocationId) ||
      (entry.autonomyStep === "talk" &&
        entry.autonomyTarget === entry.nextTrailTargetLocationId &&
        entry.nextTrailNpcId),
  );
}

function guardCompletedJobsAreNotMissed(
  world: StreetGameState,
  trace: RowanLoopSmokeTraceEntry[],
) {
  const invalidJobs = world.jobs.filter((job) => job.completed && job.missed);
  if (invalidJobs.length === 0) {
    return;
  }

  throw new Error(
    [
      `Completed jobs cannot also be missed: ${invalidJobs
        .map((job) => job.id)
        .join(", ")}.`,
      formatTrace(trace),
    ].join("\n"),
  );
}

function isSuccessfulSmokeEndState(world: StreetGameState): boolean {
  const teaShift = world.jobs.find((job) => job.id === "job-tea-shift");
  const completionIdleCopy = objectiveRouteCompletionIdleCopy(
    world,
    world.player.objective,
  );
  const objectiveProgress = world.player.objective?.progress;

  return Boolean(
    teaShift?.completed &&
    !teaShift.missed &&
    world.firstAfternoon?.fieldNote &&
    world.firstAfternoon?.completedAt &&
    world.clock.label === "Afternoon" &&
    world.player.currentLocationId === world.player.homeLocationId &&
    completionIdleCopy &&
    objectiveProgress &&
    objectiveProgress.completed >= objectiveProgress.total &&
    world.rowanAutonomy.stepKind === "idle" &&
    world.rowanAutonomy.label === completionIdleCopy.label,
  );
}

async function main(): Promise<void> {
  const result = await runRowanLoopSmoke();
  process.stdout.write("[many-lives] Rowan loop smoke passed.\n");
  process.stdout.write(`${formatTrace(result.trace)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `[many-lives] Rowan loop smoke failed: ${error.stack ?? error.message}\n`,
    );
    process.exit(1);
  });
}
