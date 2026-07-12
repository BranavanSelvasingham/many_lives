import type {
  ObjectiveFocus,
  ObjectiveOutcomeState,
  ObjectiveOutcomeStatus,
  ObjectiveProgressState,
  ObjectiveSource,
  ObjectiveTrailItem,
  JobState,
  NpcState,
  PlayerObjective,
  StreetGameState,
} from "../street-sim/types.js";
import {
  formatScheduleMinute,
  resolveNpcSchedule,
} from "../street-sim/npcSchedule.js";
import {
  objectiveRouteCartProblemRouteScaffold,
  objectiveRouteCommittedJobRouteScaffold,
  objectiveRouteDefaultTextForFocus as objectiveRouteScaffoldDefaultTextForFocus,
  objectiveRouteExploreRouteScaffold,
  objectiveRouteHeadline as objectiveRouteScaffoldHeadline,
  objectiveRoutePeopleRouteScaffold,
  objectiveRouteProblemToolOutcomeEvaluation,
  objectiveRoutePumpProblemRouteScaffold,
  objectiveRouteRestRouteScaffold,
  objectiveRouteScaffoldAbsorbsConversationFocus,
  objectiveRouteScaffoldOutcomeEvaluation,
  objectiveRouteScaffoldRetainedRouteKey,
  objectiveRouteScaffoldRouteForRouteKey,
  objectiveRouteScaffoldRouteKeyForObjectiveText,
  objectiveRouteSettleRouteScaffold,
  objectiveRouteToolProblemRouteScaffold,
  objectiveRouteWorkRouteScaffold,
} from "./objectiveScaffolds.js";

interface ObjectiveRoute {
  key: string;
  focus: ObjectiveFocus;
  source: ObjectiveSource;
  steps: ObjectiveTrailItem[];
  outcomes: ObjectiveOutcomeDefinition[];
  terminal?: boolean;
  preferHeadlineText?: boolean;
}

interface ObjectiveOutcomeDefinition {
  id: string;
  label: string;
  urgency?: number;
  fallbackEvidence?: string;
  targetLocationId?: string;
  npcId?: string;
  actionId?: string;
}

interface BuildObjectiveOptions {
  text?: string;
  focus?: ObjectiveFocus;
  source?: ObjectiveSource;
  previous?: PlayerObjective;
}

type ObjectiveScores = Record<ObjectiveFocus, number>;
type WorkLead = "tea" | "yard";

interface ConversationObjectiveRoute {
  text: string;
  route: ObjectiveRoute;
}

interface ObjectiveOutcomeEvaluation {
  status: ObjectiveOutcomeStatus;
  blockers?: string[];
  evidence?: string;
}

const OBJECTIVE_TRAIL_LIMIT = 10;
const JOB_WINDOW_PRESSURE_MINUTES = 45;
const RECOVERY_ENERGY_THRESHOLD = 35;
const PROJECTED_STREET_MINUTES_PER_TILE = 1.5;

interface PeopleTarget {
  arrivalTotalMinutes: number;
  locationId: string;
  npc: NpcState;
}

function problemClosedByWorld(
  problem: ReturnType<typeof problemById>,
): boolean {
  return Boolean(
    problem &&
    (problem.status === "solved" ||
      problem.status === "resolved" ||
      problem.status === "expired"),
  );
}

function problemCleared(problem: ReturnType<typeof problemById>): boolean {
  return Boolean(
    problem && (problem.status === "solved" || problem.status === "resolved"),
  );
}

export function buildPlayerObjectiveState(
  world: StreetGameState,
  options: BuildObjectiveOptions = {},
): PlayerObjective | undefined {
  const previous = options.previous ?? world.player.objective;
  const explicitText = normalizeObjectiveText(options.text ?? "");
  const explicitFocus =
    options.focus ??
    (explicitText ? classifyObjective(explicitText) : undefined);
  const explicitSource = options.source ?? previous?.source ?? "dynamic";
  const conversationRoute =
    explicitSource === "manual" ? undefined : chooseConversationRoute(world);
  const retainedScaffoldRouteKey = previous
    ? objectiveRouteScaffoldRetainedRouteKey(world, previous)
    : undefined;
  const retainedScaffoldRoute =
    previous && retainedScaffoldRouteKey
      ? objectiveRouteScaffoldRouteForRouteKey({
          routeKey: retainedScaffoldRouteKey,
          source: previous.source,
          world,
        })
      : undefined;

  if (
    previous?.source === "manual" &&
    previous.focus === "people" &&
    explicitSource === "conversation" &&
    explicitText &&
    npcMentionedInText(world, previous.text)
  ) {
    const previousRoute = buildRouteForObjectiveText(
      world,
      previous.text,
      previous.focus,
      previous.source,
      previous,
    );
    if (!routeCompleted(world, previous.text, previousRoute)) {
      return composeObjective(world, previous.text, previousRoute, previous);
    }
  }

  if (
    previous &&
    explicitText &&
    explicitSource === "conversation" &&
    retainedScaffoldRoute &&
    objectiveRouteScaffoldAbsorbsConversationFocus(
      retainedScaffoldRoute.key,
      explicitFocus ?? classifyObjective(explicitText),
    )
  ) {
    return composeObjective(world, previous.text, retainedScaffoldRoute, previous);
  }

  if (explicitText) {
    const route = buildRouteForObjectiveText(
      world,
      explicitText,
      explicitFocus ?? classifyObjective(explicitText),
      explicitSource,
      previous,
    );
    return composeObjective(world, explicitText, route, previous);
  }

  if (
    previous &&
    retainedScaffoldRoute &&
    (!conversationRoute ||
      objectiveRouteScaffoldAbsorbsConversationFocus(
        retainedScaffoldRoute.key,
        conversationRoute.route.focus,
      ))
  ) {
    return composeObjective(world, previous.text, retainedScaffoldRoute, previous);
  }

  if (conversationRoute && routeHasWork(conversationRoute.route)) {
    if (
      !previous ||
      previous.source !== "manual" ||
      (previous.focus === conversationRoute.route.focus &&
        previous.routeKey === conversationRoute.route.key)
    ) {
      return composeObjective(
        world,
        conversationRoute.text,
        conversationRoute.route,
        previous,
      );
    }
  }

  if (previous) {
    const previousRoute = buildRouteForObjectiveText(
      world,
      previous.text,
      previous.focus,
      previous.source,
      previous,
    );
    const previousRouteCompleted = routeCompleted(
      world,
      previous.text,
      previousRoute,
    );
    if (previous.source === "manual" && previousRouteCompleted) {
      return composeObjective(world, previous.text, previousRoute, previous);
    }

    if (
      !previousRouteCompleted &&
      !shouldInterruptCurrentObjective(world, previous)
    ) {
      return composeObjective(world, previous.text, previousRoute, previous);
    }
  }

  const dynamicRoute = chooseDynamicRoute(world);
  return composeObjective(
    world,
    routeHeadline(dynamicRoute),
    dynamicRoute,
    previous,
  );
}

function composeObjective(
  world: StreetGameState,
  objectiveText: string,
  route: ObjectiveRoute,
  previous?: PlayerObjective,
): PlayerObjective | undefined {
  const displayObjectiveText = route.preferHeadlineText
    ? routeHeadline(route)
    : objectiveText;
  const completedTrail = buildCompletedTrail(world, previous, route.steps);
  const outcomes = buildObjectiveOutcomes(world, displayObjectiveText, route);
  const progress = buildProgress(outcomes, route.steps);
  const currentStep = route.steps.find((step) => !step.done) ?? route.steps[0];

  if (!currentStep && outcomes.length === 0) {
    return undefined;
  }

  const updatedAt = shouldUpdateObjective(
    previous,
    route,
    outcomes,
    progress,
    completedTrail,
  )
    ? world.currentTime
    : (previous?.updatedAt ?? world.currentTime);
  const createdAt =
    previous &&
    previous.routeKey === route.key &&
    previous.focus === route.focus
      ? previous.createdAt
      : (previous?.createdAt ?? world.currentTime);
  const id =
    previous &&
    previous.routeKey === route.key &&
    previous.focus === route.focus
      ? previous.id
      : `objective-${route.key}-${world.clock.totalMinutes}`;

  const objective: PlayerObjective = {
    id,
    text: displayObjectiveText,
    createdAt,
    updatedAt,
    focus: route.focus,
    source: route.source,
    routeKey: route.key,
    outcomes,
    trail: route.steps,
    completedTrail,
    progress,
  };

  if (
    progress.completed >= progress.total &&
    !route.terminal &&
    route.source !== "manual"
  ) {
    const nextRoute = chooseDynamicRoute(world, {
      routeKey: route.key,
      focus: route.focus,
    });

    if (nextRoute.key !== route.key || nextRoute.focus !== route.focus) {
      return composeObjective(
        world,
        routeHeadline(nextRoute),
        nextRoute,
        objective,
      );
    }
  }

  return objective;
}

function shouldUpdateObjective(
  previous: PlayerObjective | undefined,
  route: ObjectiveRoute,
  outcomes: ObjectiveOutcomeState[],
  progress: ObjectiveProgressState,
  completedTrail: ObjectiveTrailItem[],
) {
  if (!previous) {
    return true;
  }

  if (previous.routeKey !== route.key) {
    return true;
  }

  if (previous.focus !== route.focus) {
    return true;
  }

  if (previous.source !== route.source) {
    return true;
  }

  if (
    previous.progress.completed !== progress.completed ||
    previous.progress.total !== progress.total
  ) {
    return true;
  }

  const previousOutcomes = previous.outcomes ?? [];
  if (previousOutcomes.length !== outcomes.length) {
    return true;
  }

  for (let index = 0; index < outcomes.length; index += 1) {
    const previousOutcome = previousOutcomes[index];
    const outcome = outcomes[index];
    if (
      !previousOutcome ||
      previousOutcome.id !== outcome.id ||
      previousOutcome.status !== outcome.status ||
      previousOutcome.authority !== outcome.authority ||
      previousOutcome.evidence !== outcome.evidence ||
      previousOutcome.blockers?.join("|") !== outcome.blockers?.join("|") ||
      previousOutcome.targetLocationId !== outcome.targetLocationId ||
      previousOutcome.npcId !== outcome.npcId ||
      previousOutcome.actionId !== outcome.actionId
    ) {
      return true;
    }
  }

  if (previous.completedTrail.length !== completedTrail.length) {
    return true;
  }

  return false;
}

function buildCompletedTrail(
  world: StreetGameState,
  previous: PlayerObjective | undefined,
  steps: ObjectiveTrailItem[],
) {
  const completed = previous?.completedTrail
    ? [...previous.completedTrail]
    : [];
  const completedIds = new Set(completed.map((item) => item.id));

  for (const step of steps) {
    if (!step.done || completedIds.has(step.id)) {
      continue;
    }

    completed.unshift({
      ...step,
      done: true,
      timestamp: world.currentTime,
    });
    completedIds.add(step.id);
  }

  return completed.slice(0, OBJECTIVE_TRAIL_LIMIT);
}

function buildObjectiveOutcomes(
  world: StreetGameState,
  objectiveText: string,
  route: ObjectiveRoute,
): ObjectiveOutcomeState[] {
  const definitions = route.outcomes;

  return definitions.map((definition, index) => {
    const evaluation =
      evaluateObjectiveOutcome(world, objectiveText, route, definition) ??
      outcomeEvaluation(false, {
        evidence: definition.fallbackEvidence,
      });

    return {
      id: definition.id,
      label: definition.label,
      status: evaluation.status,
      urgency: definition.urgency ?? definitions.length - index,
      authority: "predicate",
      blockers: evaluation.blockers,
      evidence: evaluation.evidence ?? definition.fallbackEvidence,
      targetLocationId: definition.targetLocationId,
      npcId: definition.npcId,
      actionId: definition.actionId,
    };
  });
}

function buildProgress(
  outcomes: ObjectiveOutcomeState[],
  fallbackSteps: ObjectiveTrailItem[],
): ObjectiveProgressState {
  if (outcomes.length > 0) {
    const completed = outcomes.filter(
      (outcome) => outcome.status === "met",
    ).length;
    return {
      completed,
      total: outcomes.length,
      label: `${completed}/${outcomes.length} outcomes met`,
    };
  }

  const completed = fallbackSteps.filter((step) => step.done).length;
  return {
    completed,
    total: fallbackSteps.length,
    label: `${completed}/${fallbackSteps.length} checked off`,
  };
}

function routeCompleted(
  world: StreetGameState,
  objectiveText: string,
  route: ObjectiveRoute,
) {
  const outcomes = buildObjectiveOutcomes(world, objectiveText, route);
  return (
    outcomes.length > 0 && outcomes.every((outcome) => outcome.status === "met")
  );
}

function evaluateObjectiveOutcome(
  world: StreetGameState,
  objectiveText: string,
  route: ObjectiveRoute,
  definition: ObjectiveOutcomeDefinition,
): ObjectiveOutcomeEvaluation | undefined {
  const scaffoldEvaluation = objectiveRouteScaffoldOutcomeEvaluation({
    outcomeId: definition.id,
    routeKey: route.key,
    world,
  });

  if (scaffoldEvaluation) {
    return scaffoldEvaluation;
  }

  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const hasWrench = hasItem(world, "item-wrench");
  const toolTargetProblem = objectiveTargetProblem(world, objectiveText);
  const atHome = world.player.currentLocationId === world.player.homeLocationId;
  const problemToolEvaluation = objectiveRouteProblemToolOutcomeEvaluation(
    definition.id,
    {
      cartProblem: buildHelpProblemRouteState(
        cartProblem,
        cartProblem ? findLocation(world, cartProblem.locationId) : undefined,
        hasWrench,
      ),
      pumpProblem: buildHelpProblemRouteState(
        pumpProblem,
        pumpProblem ? findLocation(world, pumpProblem.locationId) : undefined,
        hasWrench,
      ),
      toolProblem: buildToolProblemRouteState(
        world,
        toolTargetProblem,
        toolTargetProblem
          ? findLocation(world, toolTargetProblem.locationId)
          : undefined,
        hasWrench,
      ),
    },
  );

  if (problemToolEvaluation) {
    return problemToolEvaluation;
  }

  switch (definition.id) {
    case "settle-terms": {
      const maraTopics = npcReplyTopics(world, "npc-mara");
      return outcomeEvaluation(
        (world.player.reputation.morrow_house ?? 0) >= 2 ||
          hasAnyTopic(maraTopics, ["home", "stay"]),
        {
          blockers: ["Rowan does not know the room terms yet."],
          evidence: `Morrow House standing ${world.player.reputation.morrow_house ?? 0}`,
        },
      );
    }
    case "settle-standing":
      return outcomeEvaluation(
        (world.player.reputation.morrow_house ?? 0) >= 2,
        {
          blockers: ["Morrow House does not see Rowan as dependable yet."],
          evidence: `Morrow House standing ${world.player.reputation.morrow_house ?? 0}`,
        },
      );
    case "settle-lead":
      return outcomeEvaluation(hasConfirmedWorkLead(world), {
        blockers: ["No work lead has been confirmed yet."],
      });
    case "settle-income":
      return outcomeEvaluation(hasCommittedOrCompletedJob(world), {
        blockers: ["Rowan has not committed to paid work yet."],
      });
    case "settle-people":
      return outcomeEvaluation(familiarNpcCount(world) >= 2, {
        blockers: ["Rowan does not have two real local connections yet."],
        evidence: `${familiarNpcCount(world)} familiar people`,
      });
    case "work-lead-tea":
    case "work-lead-yard": {
      const lead = definition.id === "work-lead-yard" ? "yard" : "tea";
      return outcomeEvaluation(confirmedWorkLeadFor(world, lead), {
        blockers: [`The ${lead} work lead is not confirmed yet.`],
      });
    }
    case "work-commit": {
      const leadJob = workLeadJob(world, route, objectiveText);
      const leadJobAtRisk = Boolean(leadJob && jobWindowAtRisk(world, leadJob));
      return outcomeEvaluation(
        Boolean(leadJob?.accepted || leadJob?.completed),
        {
          atRisk: leadJobAtRisk,
          blockers: leadJob?.missed
            ? [`${leadJob.title} was missed.`]
            : leadJobAtRisk
              ? [`${leadJob?.title ?? "The job"} closes soon.`]
              : [`${leadJob?.title ?? "The job"} has not been accepted yet.`],
          evidence: leadJob?.accepted
            ? `${leadJob.title} accepted.`
            : leadJobAtRisk && leadJob
              ? `${leadJob.title} window closes around ${formatHour(leadJob.endHour)}.`
              : undefined,
          failed: Boolean(leadJob?.missed && !leadJob.completed),
        },
      );
    }
    case "work-finish": {
      const leadJob = workLeadJob(world, route, objectiveText);
      const leadJobAtRisk = Boolean(leadJob && jobWindowAtRisk(world, leadJob));
      return outcomeEvaluation(Boolean(leadJob?.completed), {
        atRisk: leadJobAtRisk,
        blockers: leadJob?.missed
          ? [`${leadJob.title} was missed.`]
          : leadJobAtRisk
            ? [`${leadJob?.title ?? "The job"} is near closing.`]
            : [`${leadJob?.title ?? "The job"} is not finished yet.`],
        evidence: leadJob?.completed
          ? `${leadJob.title} completed.`
          : leadJobAtRisk && leadJob
            ? `${leadJob.title} window closes around ${formatHour(leadJob.endHour)}.`
            : undefined,
        failed: Boolean(leadJob?.missed && !leadJob.completed),
      });
    }
    case "work-pay":
      return outcomeEvaluation(
        world.player.money >= 20 || world.jobs.some((job) => job.completed),
        {
          blockers: ["Paid work has not turned into breathing room yet."],
          evidence: `$${world.player.money} on hand`,
        },
      );
    case "rest-return":
      return outcomeEvaluation(atHome, {
        blockers: ["Rowan is not somewhere familiar enough to rest."],
        evidence: world.player.currentLocationId,
      });
    case "rest-hour":
      return outcomeEvaluation(hasRecoveredEnoughToMove(world), {
        blockers: [
          hasRecentRest(world)
            ? "Rowan still does not have enough energy buffer to start the next commitment."
            : "Rowan has not rested recently.",
        ],
        evidence: `${world.player.energy} energy`,
      });
    case "people-talk": {
      const targetNpcId = definition.npcId;
      const targetNpc = targetNpcId ? npcById(world, targetNpcId) : undefined;
      const availabilityBlocker = targetNpc
        ? unavailableNpcObjectiveBlocker(world, targetNpc)
        : undefined;
      return outcomeEvaluation(
        targetNpcId
          ? countPlayerConversationsWithNpc(world, targetNpcId) > 0
          : familiarNpcCount(world) > 0,
        {
          blockers: [
            availabilityBlocker ??
              "Rowan has not started that local relationship yet.",
          ],
        },
      );
    }
    case "people-open":
      return outcomeEvaluation(familiarNpcCount(world) >= 1, {
        blockers: ["No local connection has opened up yet."],
        evidence: `${familiarNpcCount(world)} familiar people`,
      });
    case "people-friend":
      return outcomeEvaluation(trustedNpcCount(world) >= 2, {
        blockers: ["Rowan does not have two trusted local ties yet."],
        evidence: `${trustedNpcCount(world)} trusted people`,
      });
    case "explore-go":
      return outcomeEvaluation(
        Boolean(
          definition.targetLocationId &&
          world.player.knownLocationIds.includes(definition.targetLocationId),
        ),
        {
          blockers: ["The target place is not known yet."],
          evidence: definition.targetLocationId,
        },
      );
    case "explore-talk": {
      const targetPeople = definition.targetLocationId
        ? world.npcs.filter(
            (npc) => npc.currentLocationId === definition.targetLocationId,
          )
        : [];
      return outcomeEvaluation(
        targetPeople.some(
          (npc) => countPlayerConversationsWithNpc(world, npc.id) > 0,
        ),
        {
          blockers: ["Nobody at the explored place has explained it yet."],
          evidence: `${targetPeople.length} people nearby`,
        },
      );
    }
    case "explore-learn":
      return outcomeEvaluation(world.player.knownLocationIds.length >= 4, {
        blockers: ["South Quay still has too many unknown corners."],
        evidence: `${world.player.knownLocationIds.length} known places`,
      });
    default:
      break;
  }

  if (definition.id.startsWith("commitment-go-")) {
    const job = jobById(world, definition.id.replace("commitment-go-", ""));
    return outcomeEvaluation(
      Boolean(
        job?.completed || world.player.currentLocationId === job?.locationId,
      ),
      {
        blockers: [`Rowan is not at ${job?.title ?? "the job"} yet.`],
        evidence: world.player.currentLocationId,
      },
    );
  }

  if (definition.id.startsWith("commitment-window-")) {
    const job = jobById(world, definition.id.replace("commitment-window-", ""));
    const inWindow = Boolean(
      job &&
      currentHour(world) >= job.startHour &&
      currentHour(world) < job.endHour,
    );
    return outcomeEvaluation(Boolean(job?.completed || inWindow), {
      atRisk: Boolean(job && currentHour(world) >= job.endHour - 0.75),
      blockers: [`${job?.title ?? "The job"} is not open right now.`],
      evidence: inWindow ? "Shift window open." : undefined,
      failed: Boolean(job?.missed && !job.completed),
    });
  }

  if (definition.id.startsWith("commitment-finish-")) {
    const job = jobById(world, definition.id.replace("commitment-finish-", ""));
    return outcomeEvaluation(Boolean(job?.completed), {
      blockers: job?.missed
        ? [`${job.title} was missed.`]
        : [`${job?.title ?? "The job"} is not finished yet.`],
      evidence: job?.completed ? `${job.title} completed.` : undefined,
      failed: Boolean(job?.missed && !job.completed),
    });
  }

  return undefined;
}

function outcomeEvaluation(
  met: boolean,
  options: {
    atRisk?: boolean;
    blockers?: string[];
    evidence?: string;
    failed?: boolean;
  } = {},
): ObjectiveOutcomeEvaluation {
  if (met) {
    return {
      status: "met",
      evidence: options.evidence,
    };
  }

  if (options.failed) {
    return {
      status: "failed",
      blockers: options.blockers,
      evidence: options.evidence,
    };
  }

  if (options.atRisk) {
    return {
      status: "at_risk",
      blockers: options.blockers,
      evidence: options.evidence,
    };
  }

  return {
    status: options.blockers?.length ? "blocked" : "open",
    blockers: options.blockers,
    evidence: options.evidence,
  };
}

function workLeadJob(
  world: StreetGameState,
  route: ObjectiveRoute,
  objectiveText: string,
) {
  const lead =
    route.key === "work-yard" ||
    route.steps.some((step) => step.id === "work-lead-yard") ||
    /\btomas\b|\byard\b|\bcrane\b/.test(objectiveText.toLowerCase())
      ? "yard"
      : "tea";
  return lead === "yard"
    ? jobById(world, "job-yard-shift")
    : jobById(world, "job-tea-shift");
}

function objectiveTargetProblem(world: StreetGameState, objectiveText: string) {
  const normalized = objectiveText.toLowerCase();
  if (normalized.includes("cart")) {
    return problemById(world, "problem-cart");
  }

  if (normalized.includes("pump") || normalized.includes("wrench")) {
    return problemById(world, "problem-pump");
  }

  return (
    world.problems.find((problem) => problem.status === "active") ??
    world.problems[0]
  );
}

function shouldInterruptCurrentObjective(
  world: StreetGameState,
  previous: PlayerObjective,
) {
  if (previous.source === "manual") {
    const namedPeopleTarget =
      previous.focus === "people"
        ? npcMentionedInText(world, previous.text)
        : undefined;
    const feasibleNamedTarget = namedPeopleTarget
      ? feasiblePeopleTarget(world, namedPeopleTarget)
      : undefined;
    if (feasibleNamedTarget?.locationId === world.player.currentLocationId) {
      return false;
    }

    const scores = scoreObjectiveFocus(world);
    const restScore = scoreForFocus(scores, "rest");
    return !hasRecentRest(world) && world.player.energy < 35 && restScore >= 35;
  }

  const scores = scoreObjectiveFocus(world);
  const bestFocus = selectBestFocus(scores);
  const currentScore = scoreForFocus(scores, previous.focus);
  const bestScore = scoreForFocus(scores, bestFocus);
  const gap = bestScore - currentScore;

  if (bestFocus === previous.focus) {
    return false;
  }

  if (
    bestFocus === "rest" &&
    world.player.energy < 45 &&
    !hasRecentRest(world)
  ) {
    return true;
  }

  if (bestFocus === "work" && world.player.activeJobId === undefined) {
    return gap >= 12;
  }

  if (bestFocus === "help" || bestFocus === "tool") {
    return gap >= 8;
  }

  return gap >= 18;
}

function chooseDynamicRoute(
  world: StreetGameState,
  avoid?: {
    routeKey: string;
    focus: ObjectiveFocus;
  },
) {
  const activeJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  if (activeJob) {
    const route = buildCommittedJobRoute(world, "dynamic", activeJob);
    if (!isAvoidedRoute(route, avoid) && routeHasWork(route)) {
      return route;
    }
  }

  const firstAfternoonRoute = objectiveRouteScaffoldRouteForRouteKey({
    routeKey: "first-afternoon",
    source: "dynamic",
    world,
  });
  if (
    firstAfternoonRoute &&
    !world.firstAfternoon?.completedAt &&
    !isAvoidedRoute(firstAfternoonRoute, avoid) &&
    routeHasWork(firstAfternoonRoute)
  ) {
    return firstAfternoonRoute;
  }

  const conversationRoute = chooseConversationRoute(world);
  if (
    conversationRoute &&
    !isAvoidedRoute(conversationRoute.route, avoid) &&
    routeHasWork(conversationRoute.route)
  ) {
    return conversationRoute.route;
  }

  const scores = scoreObjectiveFocus(world);
  const ranked = Object.entries(scores).sort(
    (left, right) => right[1] - left[1],
  );

  for (const [focus, score] of ranked) {
    if (score <= 0) {
      continue;
    }

    const route = buildRouteForFocus(
      world,
      focus as ObjectiveFocus,
      "dynamic",
      world.player.objective,
    );
    if (!isAvoidedRoute(route, avoid) && routeHasWork(route)) {
      return route;
    }
  }

  if (world.player.knownLocationIds.length < 5) {
    const route = buildExploreRoute(world, "dynamic");
    if (routeHasWork(route)) {
      return route;
    }
  }

  if (world.player.knownNpcIds.length < 5) {
    const route = buildPeopleRoute(world, "dynamic");
    if (routeHasWork(route)) {
      return route;
    }
  }

  return buildSettleRoute(world, "dynamic");
}

function isAvoidedRoute(
  route: ObjectiveRoute,
  avoid?: {
    routeKey: string;
    focus: ObjectiveFocus;
  },
) {
  if (!avoid) {
    return false;
  }

  return route.key === avoid.routeKey && route.focus === avoid.focus;
}

function routeHasWork(route: ObjectiveRoute) {
  return route.steps.some((step) => !step.done);
}

function buildRouteForFocus(
  world: StreetGameState,
  focus: ObjectiveFocus,
  source: ObjectiveSource,
  previous?: PlayerObjective,
): ObjectiveRoute {
  switch (focus) {
    case "work":
      return buildWorkRoute(world, source);
    case "help":
      return buildHelpRoute(world, source);
    case "tool":
      return buildToolRoute(world, source);
    case "rest":
      return buildRestRoute(world, source, "", previous);
    case "people":
      return buildPeopleRoute(world, source);
    case "explore":
      return buildExploreRoute(world, source, "", previous);
    case "settle":
    case "custom":
    default:
      return buildSettleRoute(world, source);
  }
}

function buildRouteForObjectiveText(
  world: StreetGameState,
  text: string,
  focus: ObjectiveFocus,
  source: ObjectiveSource,
  previous?: PlayerObjective,
): ObjectiveRoute {
  const scaffoldRoute = objectiveRouteScaffoldRouteForRouteKey({
    routeKey: objectiveRouteScaffoldRouteKeyForObjectiveText({
      previous,
      source,
      text,
    }),
    source,
    world,
  });
  if (scaffoldRoute) {
    return scaffoldRoute;
  }

  switch (focus) {
    case "work":
      return buildWorkRoute(world, source, text);
    case "help":
      return buildHelpRoute(world, source, text);
    case "tool":
      return buildToolRoute(world, source, text);
    case "rest":
      return buildRestRoute(world, source, text, previous);
    case "people":
      return buildPeopleRoute(world, source, text);
    case "explore":
      return buildExploreRoute(world, source, text, previous);
    case "settle":
    case "custom":
    default:
      return buildSettleRoute(world, source, text);
  }
}

function buildSettleRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const home = findLocation(world, world.player.homeLocationId);
  const familiarPeople = familiarNpcCount(world);
  const lead = chooseWorkLead(world, textHint);
  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const hasTalkedToMara =
    countPlayerConversationsWithNpc(world, "npc-mara") > 0;
  const maraTopics = npcReplyTopics(world, "npc-mara");
  const hasStayTerms =
    houseStanding >= 2 || hasAnyTopic(maraTopics, ["home", "stay"]);
  const hasWorkLead = hasConfirmedWorkLead(world);
  const hasCommittedIncome = hasCommittedOrCompletedJob(world);
  const settleLeadNpcId = lead === "yard" ? "npc-tomas" : "npc-ada";
  const settleLeadLocationId = lead === "yard" ? "freight-yard" : "tea-house";
  const settleLeadJob = lead === "yard" ? yardJob : teaJob;
  const settlePeopleTarget = nextUntalkedNpc(world);
  const routeScaffold = objectiveRouteSettleRouteScaffold({
    anyLeadJobCompleted: Boolean(teaJob?.completed || yardJob?.completed),
    anyLeadJobDiscovered: Boolean(teaJob?.discovered || yardJob?.discovered),
    anyPlayerActiveJob: world.player.activeJobId !== undefined,
    familiarPeople,
    hasCommittedIncome,
    hasStayTerms,
    hasTalkedToMara,
    hasWorkLead,
    homeLocationId: home?.id,
    homeLocationName: home?.name,
    houseStanding,
    lead,
    leadJobAccepted: Boolean(settleLeadJob?.accepted),
    leadJobActive: world.player.activeJobId === settleLeadJob?.id,
    leadJobCompleted: Boolean(settleLeadJob?.completed),
    leadJobDiscovered: Boolean(settleLeadJob?.discovered),
    leadJobId: settleLeadJob?.id,
    leadJobLocationId: settleLeadJob?.locationId,
    leadJobMissed: Boolean(settleLeadJob?.missed),
    settleLeadLocationId,
    settleLeadNpcId,
    settlePeopleTargetId: settlePeopleTarget?.npc.id,
    settlePeopleTargetLocationId: settlePeopleTarget?.locationId,
  });

  return {
    key: "settle-core",
    focus: "settle",
    source,
    outcomes: routeScaffold.outcomes,
    steps: routeScaffold.steps.map(makeStep),
  };
}

function buildWorkRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const reconciledLead = staleNamedWorkLeadAlternate(world, textHint);
  const lead = reconciledLead ?? chooseWorkLead(world, textHint);
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const leadNpc =
    lead === "yard" ? npcById(world, "npc-tomas") : npcById(world, "npc-ada");
  const leadLocation =
    lead === "yard"
      ? findLocation(world, "freight-yard")
      : findLocation(world, "tea-house");
  const leadJob = lead === "yard" ? yardJob : teaJob;
  const routeScaffold = objectiveRouteWorkRouteScaffold({
    anyCompletedWork: world.jobs.some((job) => job.completed),
    lead,
    leadConfirmed: confirmedWorkLeadFor(world, lead),
    leadJobAccepted: Boolean(leadJob?.accepted),
    leadJobActive: world.player.activeJobId === leadJob?.id,
    leadJobAtRisk: jobWindowAtRisk(world, leadJob),
    leadJobCompleted: Boolean(leadJob?.completed),
    leadJobDiscovered: Boolean(leadJob?.discovered),
    leadJobId: leadJob?.id,
    leadJobMissed: Boolean(leadJob?.missed),
    leadLocationId: leadLocation?.id,
    leadLocationName: leadLocation?.name,
    leadNpcId: leadNpc?.id,
    leadNpcName: leadNpc?.name,
    playerMoney: world.player.money,
  });

  return {
    key: lead === "yard" ? "work-yard" : "work-tea",
    focus: "work",
    source,
    outcomes: routeScaffold.outcomes,
    steps: routeScaffold.steps.map(makeStep),
    preferHeadlineText: source !== "manual" || Boolean(reconciledLead),
  };
}

function buildCommittedJobRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  job: JobState,
): ObjectiveRoute {
  const location = findLocation(world, job.locationId);
  const atLocation = world.player.currentLocationId === job.locationId;
  const inWindow =
    currentHour(world) >= job.startHour && currentHour(world) < job.endHour;
  const jobOpen = !job.completed && !job.missed;
  const canWork = jobOpen && atLocation && inWindow;
  const routeScaffold = objectiveRouteCommittedJobRouteScaffold({
    atLocation,
    beforeWindow: currentHour(world) < job.startHour,
    canWork,
    inWindow,
    jobCompleted: job.completed,
    jobId: job.id,
    jobLocationId: location?.id,
    jobLocationName: location?.name,
    jobOpen,
    jobTitle: job.title,
    jobTitleLower: job.title.toLowerCase(),
  });

  return {
    key: `commitment-${job.id}`,
    focus: "work",
    source,
    outcomes: routeScaffold.outcomes,
    steps: routeScaffold.steps.map(makeStep),
  };
}

function buildHelpRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const hasWrench = hasItem(world, "item-wrench");
  const isPumpLead =
    normalizedIncludes(textHint, "pump") ||
    normalizedIncludes(textHint, "wrench") ||
    pumpProblem?.discovered ||
    false;
  const problem = isPumpLead ? pumpProblem : (cartProblem ?? pumpProblem);
  const problemLocation = problem
    ? findLocation(world, problem.locationId)
    : undefined;

  if (problem?.id === "problem-cart") {
    const scaffold = objectiveRouteCartProblemRouteScaffold(
      buildHelpProblemRouteState(problem, problemLocation, hasWrench),
    );
    return {
      key: "help-cart",
      focus: hasWrench ? "help" : "tool",
      source,
      outcomes: scaffold.outcomes,
      steps: scaffold.steps.map(makeStep),
    };
  }

  const scaffold = objectiveRoutePumpProblemRouteScaffold(
    buildHelpProblemRouteState(problem, problemLocation, hasWrench),
  );
  return {
    key: hasWrench ? "help-pump" : "tool-pump",
    focus: hasWrench ? "help" : "tool",
    source,
    outcomes: scaffold.outcomes,
    steps: scaffold.steps.map(makeStep),
  };
}

function buildHelpProblemRouteState(
  problem: ReturnType<typeof problemById>,
  problemLocation: ReturnType<typeof findLocation>,
  hasWrench: boolean,
) {
  return {
    hasWrench,
    problemActive: problem?.status === "active",
    problemClosed: problemClosedByWorld(problem),
    problemCleared: problemCleared(problem),
    problemDiscovered: Boolean(problem?.discovered),
    problemLocationId: problem?.locationId,
    problemLocationName: problemLocation?.name,
    problemStatus: problem?.status,
  };
}

function buildToolRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const target =
    pumpProblem?.discovered || normalizedIncludes(textHint, "pump")
      ? pumpProblem
      : (cartProblem ?? pumpProblem);
  const targetLocation = target
    ? findLocation(world, target.locationId)
    : undefined;
  const hasWrench = hasItem(world, "item-wrench");
  const scaffold = objectiveRouteToolProblemRouteScaffold(
    buildToolProblemRouteState(world, target, targetLocation, hasWrench),
  );

  return {
    key: target?.id === "problem-cart" ? "tool-cart" : "tool-wrench",
    focus: "tool",
    source,
    outcomes: scaffold.outcomes,
    steps: scaffold.steps.map(makeStep),
  };
}

function buildToolProblemRouteState(
  world: StreetGameState,
  target: ReturnType<typeof problemById>,
  targetLocation: ReturnType<typeof findLocation>,
  hasWrench: boolean,
) {
  const toolAtProblem =
    hasWrench &&
    Boolean(
      target &&
      (world.player.currentLocationId === target.locationId ||
        problemClosedByWorld(target)),
    );
  const problemOpen = Boolean(target && !problemClosedByWorld(target));

  return {
    hasWrench,
    targetCleared: problemCleared(target),
    targetDiscovered: Boolean(target?.discovered),
    targetId: target?.id,
    targetLocationId: target?.locationId,
    targetLocationName: targetLocation?.name,
    targetOpen: problemOpen,
    targetStatus: target?.status,
    targetTitle: target?.title,
    toolAtProblem,
  };
}

function buildRestRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
  _previous?: PlayerObjective,
): ObjectiveRoute {
  const home = findLocation(world, world.player.homeLocationId);
  const atHome = world.player.currentLocationId === world.player.homeLocationId;
  const restLanded = hasRecoveredEnoughToMove(world);
  const routeScaffold = objectiveRouteRestRouteScaffold({
    atHome,
    homeLocationId: home?.id,
    homeLocationName: home?.name,
    playerEnergy: world.player.energy,
    restLanded,
    restRequested: normalizedIncludes(textHint, "rest"),
  });
  return {
    key: "rest-home",
    focus: "rest",
    source,
    outcomes: routeScaffold.outcomes,
    steps: routeScaffold.steps.map(makeStep),
  };
}

function buildPeopleRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const target = choosePeopleTarget(world, source, textHint);
  const familiarPeople = familiarNpcCount(world);
  const trustedPeople = trustedNpcCount(world);
  const secondConnectionTarget =
    trustedPeople < 2 ? nextUntalkedNpc(world, target?.npc.id) : undefined;
  const targetConversationCount = target
    ? countPlayerConversationsWithNpc(world, target.npc.id)
    : familiarPeople > 0
      ? 1
      : 0;
  const scaffold = objectiveRoutePeopleRouteScaffold({
    familiarPeople,
    friendObjective: normalizedIncludes(textHint, "friend"),
    secondConnectionTargetId: secondConnectionTarget?.npc.id,
    secondConnectionTargetLocationId: secondConnectionTarget?.locationId,
    targetConversationCount,
    targetId: target?.npc.id,
    targetLocationId: target?.locationId,
    targetName: target?.npc.name,
    trustedPeople,
  });

  return {
    key: `people-${target?.npc.id ?? "locals"}`,
    focus: "people",
    source,
    outcomes: scaffold.outcomes,
    steps: scaffold.steps.map(makeStep),
  };
}

function buildExploreRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
  previous?: PlayerObjective,
): ObjectiveRoute {
  const target =
    activeExploreOutcomeTargetLocation(world, previous, textHint) ??
    chooseExploreTargetLocation(world, textHint);
  const hasVisitedTarget = target
    ? world.player.knownLocationIds.includes(target.id)
    : false;
  const targetPeople = target
    ? world.npcs.filter((npc) => npc.currentLocationId === target.id)
    : [];
  const targetGuide = target ? chooseExploreGuide(world, target.id) : undefined;
  const talkedAtTarget = target
    ? targetPeople.some(
        (npc) => countPlayerConversationsWithNpc(world, npc.id) > 0,
      )
    : false;
  const scaffold = objectiveRouteExploreRouteScaffold({
    hasVisitedTarget,
    knownLocationCount: world.player.knownLocationIds.length,
    mapKnowledgeObjective:
      normalizedIncludes(textHint, "map") ||
      normalizedIncludes(textHint, "learn"),
    talkedAtTarget,
    targetGuideId: targetGuide?.id,
    targetGuideName: targetGuide?.name,
    targetId: target?.id,
    targetName: target?.name,
    targetPeopleCount: targetPeople.length,
  });

  return {
    key: `explore-${target?.id ?? "district"}`,
    focus: "explore",
    source,
    outcomes: scaffold.outcomes,
    steps: scaffold.steps.map(makeStep),
  };
}

function chooseConversationRoute(
  world: StreetGameState,
): ConversationObjectiveRoute | undefined {
  const threads = Object.values(world.conversationThreads ?? {})
    .filter((thread) => thread.objectiveText)
    .sort((left, right) => compareConversationThreads(world, left, right));

  for (const thread of threads) {
    const text = normalizeObjectiveText(thread.objectiveText ?? "");
    const route = buildRouteForObjectiveText(
      world,
      text,
      classifyObjective(text),
      "conversation",
      world.player.objective,
    );
    if (routeHasWork(route)) {
      return {
        text,
        route,
      };
    }
  }

  return undefined;
}

function compareConversationThreads(
  world: StreetGameState,
  left: { npcId: string; updatedAt: string; lines: { id: string }[] },
  right: { npcId: string; updatedAt: string; lines: { id: string }[] },
) {
  const activeNpcId = world.activeConversation?.npcId;
  const leftIsActive = left.npcId === activeNpcId;
  const rightIsActive = right.npcId === activeNpcId;
  if (leftIsActive !== rightIsActive) {
    return Number(rightIsActive) - Number(leftIsActive);
  }

  const leftOrder = latestConversationLineOrder(left.lines);
  const rightOrder = latestConversationLineOrder(right.lines);
  if (leftOrder !== rightOrder) {
    return rightOrder - leftOrder;
  }

  return Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
}

function latestConversationLineOrder(lines: { id: string }[]) {
  const latestId = lines.at(-1)?.id ?? "";
  const match = /conversation-(\d+)-/.exec(latestId);
  return match ? Number(match[1]) : 0;
}

function chooseWorkLead(world: StreetGameState, textHint = ""): WorkLead {
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const activeJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const hint = textHint.toLowerCase();
  const hour = currentHour(world);

  if (activeJob?.id === "job-tea-shift") {
    return "tea" as const;
  }

  if (activeJob?.id === "job-yard-shift") {
    return "yard" as const;
  }

  const reconciledLead = staleNamedWorkLeadAlternate(world, hint);
  if (reconciledLead) {
    return reconciledLead;
  }

  if (hint.includes("ada") || hint.includes("tea") || hint.includes("kettle")) {
    return "tea" as const;
  }

  if (
    hint.includes("cook") ||
    hint.includes("counter") ||
    hint.includes("tables")
  ) {
    return "tea" as const;
  }

  if (hint.includes("tomas") || hint.includes("yard")) {
    return "yard" as const;
  }

  if (jobWindowAtRisk(world, yardJob)) {
    return "yard" as const;
  }

  if (jobWindowAtRisk(world, teaJob)) {
    return "tea" as const;
  }

  if (teaJob?.discovered && !teaJob.completed && !teaJob.missed) {
    return "tea" as const;
  }

  if (yardJob?.discovered && !yardJob.completed && !yardJob.missed) {
    return "yard" as const;
  }

  if (teaJob?.completed && !yardJob?.completed && !yardJob?.missed) {
    return "yard" as const;
  }

  if (hour >= 13) {
    return "yard" as const;
  }

  return "tea" as const;
}

function staleNamedWorkLeadAlternate(
  world: StreetGameState,
  textHint = "",
): WorkLead | undefined {
  const namedLead = namedWorkLead(textHint);
  if (!namedLead || !workLeadJobUnavailable(world, namedLead)) {
    return undefined;
  }

  const alternateLead: WorkLead = namedLead === "tea" ? "yard" : "tea";
  return liveAlternateWorkJobHasPressure(world, alternateLead)
    ? alternateLead
    : undefined;
}

function namedWorkLead(textHint: string): WorkLead | undefined {
  const hint = textHint.toLowerCase();
  if (!hint) {
    return undefined;
  }

  const namesTea =
    /\b(ada|kettle|tea[- ]?house|cup[- ]and[- ]counter|counter|apron|tray|booths?|tables?|rush)\b/.test(
      hint,
    );
  const namesYard =
    /\b(tomas|yard|freight|north crane|crane yard|gloves?|bays?|lift)\b/.test(
      hint,
    );

  if (namesTea === namesYard) {
    return undefined;
  }

  return namesYard ? "yard" : "tea";
}

function workLeadJobUnavailable(world: StreetGameState, lead: WorkLead) {
  const job =
    lead === "yard"
      ? jobById(world, "job-yard-shift")
      : jobById(world, "job-tea-shift");

  return Boolean(
    job &&
      !job.completed &&
      (job.missed || currentHour(world) >= job.endHour),
  );
}

function liveAlternateWorkJobHasPressure(
  world: StreetGameState,
  lead: WorkLead,
) {
  const job =
    lead === "yard"
      ? jobById(world, "job-yard-shift")
      : jobById(world, "job-tea-shift");

  return Boolean(
    job &&
      (job.discovered || job.accepted) &&
      !job.completed &&
      !job.missed &&
      currentHour(world) < job.endHour &&
      (job.accepted ||
        world.player.activeJobId === job.id ||
        jobWindowAtRisk(world, job)),
  );
}

function choosePeopleTarget(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
) {
  const namedTarget = npcMentionedInText(world, textHint);
  if (namedTarget && source !== "dynamic") {
    return retainedPeopleTarget(world, namedTarget);
  }

  return nextUntalkedNpc(world);
}

function chooseExploreTargetLocation(world: StreetGameState, textHint = "") {
  const hintedNpc = npcMentionedInText(world, textHint);
  if (hintedNpc) {
    return (
      findLocation(world, hintedNpc.currentLocationId) ??
      nextUnknownLocation(world) ??
      world.locations[0]
    );
  }

  return (
    locationMentionedInText(world, textHint) ??
    nextUnknownLocation(world) ??
    world.locations[0]
  );
}

function activeExploreOutcomeTargetLocation(
  world: StreetGameState,
  previous: PlayerObjective | undefined,
  textHint = "",
) {
  if (
    !previous ||
    previous.focus !== "explore" ||
    npcMentionedInText(world, textHint) ||
    locationMentionedInText(world, textHint)
  ) {
    return undefined;
  }

  const targetLocationId = previous.outcomes.find(
    (outcome) =>
      (outcome.id === "explore-go" || outcome.id === "explore-talk") &&
      outcome.status !== "met" &&
      outcome.targetLocationId,
  )?.targetLocationId;
  if (!targetLocationId) {
    return undefined;
  }

  return findLocation(world, targetLocationId);
}

function chooseExploreGuide(world: StreetGameState, locationId: string) {
  return world.npcs
    .filter((npc) => npc.currentLocationId === locationId)
    .sort((left, right) => {
      if (left.known !== right.known) {
        return Number(right.known) - Number(left.known);
      }

      return right.trust - left.trust;
    })[0];
}

function npcMentionedInText(world: StreetGameState, textHint = "") {
  const normalized = textHint.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return world.npcs.find((npc) => normalized.includes(npc.name.toLowerCase()));
}

function locationMentionedInText(world: StreetGameState, textHint = "") {
  const normalized = textHint.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return world.locations.find(
    (location) =>
      normalized.includes(location.name.toLowerCase()) ||
      normalized.includes(location.shortLabel.toLowerCase()),
  );
}

function nextUntalkedNpc(
  world: StreetGameState,
  currentNpcId?: string,
): PeopleTarget | undefined {
  return world.npcs
    .filter(
      (npc) =>
        npc.id !== currentNpcId &&
        countPlayerConversationsWithNpc(world, npc.id) === 0,
    )
    .map((npc) => feasiblePeopleTarget(world, npc))
    .filter((target): target is PeopleTarget => Boolean(target))
    .sort((left, right) => {
      if (left.arrivalTotalMinutes !== right.arrivalTotalMinutes) {
        return left.arrivalTotalMinutes - right.arrivalTotalMinutes;
      }

      return Number(right.npc.known) - Number(left.npc.known);
    })[0];
}

function retainedPeopleTarget(
  world: StreetGameState,
  npc: NpcState,
): PeopleTarget {
  const feasible = feasiblePeopleTarget(world, npc);
  if (feasible) {
    return feasible;
  }

  const schedule = resolveNpcSchedule(npc.schedule, world.clock.totalMinutes);
  return {
    arrivalTotalMinutes:
      schedule.nextOpening?.startTotalMinutes ?? Number.MAX_SAFE_INTEGER,
    locationId:
      schedule.nextOpening?.stop.locationId ?? npc.currentLocationId,
    npc,
  };
}

function feasiblePeopleTarget(
  world: StreetGameState,
  npc: NpcState,
): PeopleTarget | undefined {
  const now = world.clock.totalMinutes;
  const currentSchedule = resolveNpcSchedule(npc.schedule, now);
  const candidateLocationIds = new Set([
    npc.currentLocationId,
    ...npc.schedule.map((stop) => stop.locationId),
  ]);

  return [...candidateLocationIds]
    .map((locationId) => {
      const arrivalTotalMinutes =
        now + projectedMinutesToNpcLocation(world, npc, locationId);
      const arrivalSchedule = resolveNpcSchedule(
        npc.schedule,
        arrivalTotalMinutes,
      );
      const followsCurrentPressureLocation = Boolean(
        currentSchedule.active &&
          currentSchedule.active.stop.locationId !== npc.currentLocationId &&
          locationId === npc.currentLocationId &&
          arrivalSchedule.active?.stopIndex === currentSchedule.active.stopIndex,
      );
      if (
        !arrivalSchedule.active ||
        (arrivalSchedule.active.stop.locationId !== locationId &&
          !followsCurrentPressureLocation)
      ) {
        return undefined;
      }

      return { arrivalTotalMinutes, locationId, npc };
    })
    .filter((target): target is PeopleTarget => Boolean(target))
    .sort(
      (left, right) => left.arrivalTotalMinutes - right.arrivalTotalMinutes,
    )[0];
}

function projectedMinutesToNpcLocation(
  world: StreetGameState,
  npc: NpcState,
  locationId: string,
) {
  const distance = distanceToLocation(world, locationId);
  const stop = npc.schedule.find((entry) => entry.locationId === locationId);
  const interiorEntryMinutes = stop?.spaceId?.startsWith("interior:") ? 1 : 0;
  return Math.max(
    0,
    Math.ceil(distance * PROJECTED_STREET_MINUTES_PER_TILE) +
      interiorEntryMinutes,
  );
}

function unavailableNpcObjectiveBlocker(
  world: StreetGameState,
  npc: NpcState,
) {
  if (feasiblePeopleTarget(world, npc)) {
    return undefined;
  }

  const resolution = resolveNpcSchedule(npc.schedule, world.clock.totalMinutes);
  const nextOpening = resolution.nextOpening;
  if (!nextOpening) {
    return `${npc.name} has no scheduled opening Rowan can use.`;
  }

  const locationName =
    findLocation(world, nextOpening.stop.locationId)?.name ??
    nextOpening.stop.locationId;
  return `${npc.name} will not be available by the projected arrival. The next opening is ${formatScheduleMinute(nextOpening.startTotalMinutes)} at ${locationName}.`;
}

function nextUnknownLocation(world: StreetGameState) {
  const knownLocationIds = new Set(world.player.knownLocationIds);
  return world.locations
    .filter((location) => !knownLocationIds.has(location.id))
    .map((location) => ({
      location,
      distanceFromPlayer: distanceToLocation(world, location.id),
      distanceFromKnown: nearestKnownLocationDistance(world, location.id),
    }))
    .sort((left, right) => {
      if (left.distanceFromKnown !== right.distanceFromKnown) {
        return left.distanceFromKnown - right.distanceFromKnown;
      }

      return left.distanceFromPlayer - right.distanceFromPlayer;
    })[0]?.location;
}

function nearestKnownLocationDistance(
  world: StreetGameState,
  locationId: string,
) {
  if (world.player.knownLocationIds.length === 0) {
    return distanceToLocation(world, locationId);
  }

  return Math.min(
    ...world.player.knownLocationIds.map((knownLocationId) =>
      locationDistance(world, knownLocationId, locationId),
    ),
  );
}

function distanceToLocation(world: StreetGameState, locationId: string) {
  const location = findLocation(world, locationId);
  if (!location) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    Math.abs(world.player.x - location.entryX) +
    Math.abs(world.player.y - location.entryY)
  );
}

function locationDistance(
  world: StreetGameState,
  fromLocationId: string,
  toLocationId: string,
) {
  const from = findLocation(world, fromLocationId);
  const to = findLocation(world, toLocationId);
  if (!from || !to) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(from.entryX - to.entryX) + Math.abs(from.entryY - to.entryY);
}

function findLocation(world: StreetGameState, locationId: string) {
  return world.locations.find((entry) => entry.id === locationId);
}

function currentHour(world: StreetGameState) {
  return world.clock.hour + world.clock.minute / 60;
}

function formatHour(hour: number) {
  if (hour === 0) return "midnight";
  if (hour === 12) return "noon";
  if (hour > 12) return `${hour - 12}pm`;
  return `${hour}am`;
}

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
}

function jobWindowAtRisk(world: StreetGameState, job: JobState | undefined) {
  if (!job || job.completed || job.missed || !job.discovered) {
    return false;
  }

  const minutesRemaining =
    job.endHour * 60 - (world.clock.hour * 60 + world.clock.minute);
  return (
    minutesRemaining >= 0 && minutesRemaining <= JOB_WINDOW_PRESSURE_MINUTES
  );
}

function problemById(world: StreetGameState, problemId: string) {
  return world.problems.find((entry) => entry.id === problemId);
}

function npcById(world: StreetGameState, npcId: string) {
  return world.npcs.find((entry) => entry.id === npcId);
}

function hasItem(world: StreetGameState, itemId: string) {
  return world.player.inventory.some((entry) => entry.id === itemId);
}

function countPlayerConversationsWithNpc(
  world: StreetGameState,
  npcId: string,
) {
  return world.conversations.filter(
    (entry) => entry.npcId === npcId && entry.speaker === "player",
  ).length;
}

function npcReplyTopics(world: StreetGameState, npcId: string) {
  const topics = new Set<string>();

  for (const entry of world.conversations) {
    if (entry.npcId !== npcId || entry.speaker !== "npc") {
      continue;
    }

    for (const topic of detectTopics(entry.text)) {
      topics.add(topic);
    }
  }

  return topics;
}

function hasAnyTopic(topics: Set<string>, candidates: string[]) {
  return candidates.some((candidate) => topics.has(candidate));
}

function familiarNpcCount(world: StreetGameState) {
  return world.npcs.filter((npc) => npc.trust >= 1).length;
}

function trustedNpcCount(world: StreetGameState) {
  return world.npcs.filter((npc) => npc.trust >= 2).length;
}

function hasDiscoveredWorkLead(world: StreetGameState) {
  return world.jobs.some(
    (job) => job.discovered || job.accepted || job.completed,
  );
}

function confirmedWorkLeadFor(world: StreetGameState, lead: "tea" | "yard") {
  const job =
    lead === "yard"
      ? jobById(world, "job-yard-shift")
      : jobById(world, "job-tea-shift");
  const npcId = lead === "yard" ? "npc-tomas" : "npc-ada";
  const topics = npcReplyTopics(world, npcId);
  const requiredTopics = lead === "yard" ? ["work", "yard"] : ["work"];

  return Boolean(
    job?.accepted ||
    job?.completed ||
    (job?.discovered && hasAnyTopic(topics, requiredTopics)),
  );
}

function hasCommittedOrCompletedJob(world: StreetGameState) {
  return (
    world.player.activeJobId !== undefined ||
    world.jobs.some((job) => job.accepted || job.completed)
  );
}

function hasConfirmedWorkLead(world: StreetGameState) {
  return (
    confirmedWorkLeadFor(world, "tea") || confirmedWorkLeadFor(world, "yard")
  );
}

function normalizedIncludes(text: string, needle: string) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function detectTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (
    /\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bpay\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(
      normalized,
    )
  ) {
    topics.add("work");
  }

  if (/\bhelp\b|\bfix\b|\brepair\b|\bsolve\b|\bhandle\b/.test(normalized)) {
    topics.add("help");
  }

  if (/\bpump\b|\bleak\b/.test(normalized)) {
    topics.add("pump");
  }

  if (/\bwrench\b|\btool\b|\btools\b/.test(normalized)) {
    topics.add("tool");
  }

  if (/\brent\b|\broom\b|\bhome\b|\bhouse\b|\blodg|\bstay\b/.test(normalized)) {
    topics.add("home");
  }

  if (/\brumou?r\b|\bgossip\b|\bnews\b|\bhear\b/.test(normalized)) {
    topics.add("gossip");
  }

  if (/\bcart\b|\bsquare\b|\bmarket\b/.test(normalized)) {
    topics.add("cart");
  }

  if (/\byard\b|\bload\b|\bcrate\b|\bcrane\b/.test(normalized)) {
    topics.add("yard");
  }

  if (/\bpeople\b|\bmeet\b|\bfriend\b|\bfriends\b|\bwho\b/.test(normalized)) {
    topics.add("people");
  }

  if (
    /\bmap\b|\blearn\b|\bexplore\b|\blane\b|\bdistrict\b|\bcity\b/.test(
      normalized,
    )
  ) {
    topics.add("learn");
  }

  if (/\bstay\b|\bbed\b|\bhome\b|\broom\b|\bmorrow house\b/.test(normalized)) {
    topics.add("stay");
  }

  return topics;
}

function recentConversationTopics(world: StreetGameState) {
  const topics = new Set<string>();

  for (const entry of world.conversations.slice(-8)) {
    if (entry.speaker !== "player") {
      continue;
    }

    for (const topic of detectTopics(entry.text)) {
      topics.add(topic);
    }
  }

  return topics;
}

function scoreObjectiveFocus(world: StreetGameState): ObjectiveScores {
  const recentRest = hasRecentRest(world);
  const needsRecoveryBuffer = !hasRecoveredEnoughToMove(world);
  const topics = recentConversationTopics(world);
  const activeJob = world.jobs.find(
    (job) =>
      job.id === world.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const hasWrench = hasItem(world, "item-wrench");
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;
  const activeProblemNeedsTool = [pumpProblem, cartProblem].some(
    (problem) =>
      problem?.discovered &&
      problem.status === "active" &&
      problem.requiredItemId &&
      !hasWrench,
  );
  const urgentJobPressure = [teaJob, yardJob].reduce(
    (pressure, job) => Math.max(pressure, jobWindowAtRisk(world, job) ? 24 : 0),
    0,
  );

  return {
    work:
      (activeJob ? 60 : 0) +
      ((teaJob?.discovered && !teaJob.completed && !teaJob.missed) ||
      (yardJob?.discovered && !yardJob.completed && !yardJob.missed)
        ? 22
        : 0) +
      urgentJobPressure +
      (world.player.money < 15 ? 14 : 0) +
      (topics.has("work") || topics.has("job") || topics.has("shift")
        ? 10
        : 0) +
      (currentHour(world) < 17 ? 4 : 0),
    help:
      ((pumpProblem?.discovered || cartProblem?.discovered) &&
      (pumpProblem?.status === "active" || cartProblem?.status === "active")
        ? 34
        : 0) +
      (topics.has("help") || topics.has("fix") || topics.has("repair")
        ? 10
        : 0) +
      (topics.has("pump") || topics.has("cart") ? 8 : 0),
    tool:
      (activeProblemNeedsTool ? 42 : 0) +
      (topics.has("tool") || topics.has("wrench") ? 10 : 0),
    rest:
      (needsRecoveryBuffer && world.player.energy < RECOVERY_ENERGY_THRESHOLD
        ? 50
        : 0) +
      (needsRecoveryBuffer && world.player.energy < 50 ? 18 : 0) +
      (!recentRest &&
      world.player.currentLocationId !== world.player.homeLocationId &&
      world.player.energy < 45
        ? 12
        : 0) +
      (recentRest && world.player.energy < 22 ? 20 : 0) +
      (currentHour(world) >= 20 || currentHour(world) < 6 ? 14 : 0),
    people:
      (world.player.knownNpcIds.length < 3 ? 16 : 0) +
      (trustedPeople < 2 ? 10 : 0) +
      (topics.has("people") || topics.has("friend") || topics.has("gossip")
        ? 8
        : 0),
    explore:
      (world.player.knownLocationIds.length < 4 ? 16 : 0) +
      (topics.has("learn") || topics.has("map") || topics.has("explore")
        ? 8
        : 0),
    settle:
      ((world.player.reputation.morrow_house ?? 0) < 2 ? 14 : 0) +
      (world.player.money < 20 ? 10 : 0) +
      (world.player.knownNpcIds.length < 3 ? 8 : 0) +
      (topics.has("stay") || topics.has("home") || topics.has("room") ? 10 : 0),
    custom: 0,
  };
}

function hasRecentRest(world: StreetGameState) {
  const minutesSinceRest = minutesSinceTimestamp(
    world,
    world.player.lastRestAt,
  );
  return minutesSinceRest !== null && minutesSinceRest < 120;
}

function hasRecoveredEnoughToMove(world: StreetGameState) {
  return (
    hasRecentRest(world) && world.player.energy >= RECOVERY_ENERGY_THRESHOLD
  );
}

function minutesSinceTimestamp(world: StreetGameState, timestamp?: string) {
  if (!timestamp) {
    return null;
  }

  const diffMs =
    new Date(world.currentTime).getTime() - new Date(timestamp).getTime();
  return Math.max(0, Math.round(diffMs / 60_000));
}

function selectBestFocus(scores: ObjectiveScores): ObjectiveFocus {
  const sorted = Object.entries(scores).sort(
    (left, right) => right[1] - left[1],
  );
  if (!sorted[0] || sorted[0][1] <= 0) {
    return "settle";
  }

  return sorted[0][0] as ObjectiveFocus;
}

function scoreForFocus(scores: ObjectiveScores, focus: ObjectiveFocus) {
  return scores[focus] ?? 0;
}

export function classifyObjective(text: string): ObjectiveFocus {
  const normalized = text.toLowerCase();
  const hasWorkNeed =
    /(work|job|money|coin|earn|pay|shift|income|kettle & lamp|tea[- ]house|north crane|counter|apron|tray|booths?|tables?|rush|gloves|bays?)/.test(
      normalized,
    );
  const hasConcreteHousingNeed =
    /(stay|home|house|bed|rent|lodg|shelter|tenant|morrow house)/.test(
      normalized,
    ) ||
    /\bkeep (my|the) room\b|\broom (here|tonight|to stay|at)\b/.test(
      normalized,
    ) ||
    (/\broom\b/.test(normalized) && !/\broom for\b/.test(normalized));
  const pointsToSpecificWorkLead =
    hasWorkNeed &&
    /(ada|kettle & lamp|tea[- ]house|north crane|crane yard|tomas|yard|counter|apron|tray|booths?|tables?|rush|gloves|bays?)/.test(
      normalized,
    );
  const hasHomeNeed = hasConcreteHousingNeed;
  const hasPeopleNeed =
    /(talk|meet|people|trust|introduce|friend|friends|belong)/.test(normalized);
  const hasStabilityNeed =
    /(\bstanding\b|\breliable\b|\bdependable\b|follow through|follow-through|pull (my|your|their) weight|steady tenant)/.test(
      normalized,
    );

  if (pointsToSpecificWorkLead && !hasConcreteHousingNeed) {
    return "work";
  }

  if (
    /\bnia\b/.test(normalized) &&
    /\b(ask|talk|meet|block|jam|cart|square)\b/.test(normalized)
  ) {
    return "people";
  }

  if (
    hasHomeNeed &&
    /\b(keep|lock in|secure|find out|what it takes|terms?|mine|stay)\b/.test(
      normalized,
    )
  ) {
    return "settle";
  }

  if (
    /\b(new in|new here|new to|footing|settle|belong|start over|make a life)\b/.test(
      normalized,
    ) ||
    hasStabilityNeed ||
    (hasWorkNeed && (hasHomeNeed || hasPeopleNeed)) ||
    (hasHomeNeed && hasPeopleNeed)
  ) {
    return "settle";
  }

  if (hasWorkNeed) {
    return "work";
  }

  if (/(learn|explore|walk|lanes|district|map|bearings)/.test(normalized)) {
    return "explore";
  }

  if (/(help|fix|solve|repair|problem|pump|cart)/.test(normalized)) {
    return "help";
  }

  if (/(rest|recover|sleep|sit|energy|tired)/.test(normalized)) {
    return "rest";
  }

  if (/(buy|tool|wrench)/.test(normalized)) {
    return "tool";
  }

  if (hasPeopleNeed) {
    return "people";
  }

  return "custom";
}

function normalizeObjectiveText(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"+|"+$/g, "");
  const maxChars = 140;
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const withinLimit = cleaned.slice(0, maxChars).trimEnd();
  const lastSpace = withinLimit.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(maxChars * 0.7)
      ? withinLimit.slice(0, lastSpace)
      : withinLimit;
  return `${base.replace(/["'.,!?;:]+$/g, "").trimEnd()}...`;
}

function routeHeadline(route: ObjectiveRoute) {
  if (
    route.key === "first-afternoon" &&
    route.steps.every((step) => step.done)
  ) {
    return "First afternoon complete.";
  }

  if (route.key === "first-afternoon") {
    return "Make Rowan's first afternoon count: understand the room, earn a little money, and end with a real foothold.";
  }

  const scaffoldHeadline = objectiveRouteScaffoldHeadline(route.key);
  if (scaffoldHeadline) {
    return scaffoldHeadline;
  }

  return defaultObjectiveTextForFocus(route.focus);
}

function defaultObjectiveTextForFocus(focus: ObjectiveFocus) {
  const scaffoldDefault = objectiveRouteScaffoldDefaultTextForFocus(focus);
  if (scaffoldDefault) {
    return scaffoldDefault;
  }

  switch (focus) {
    case "work":
      return "Find steady income before tonight.";
    case "help":
      return "Find the trouble worth stepping into and handle it.";
    case "tool":
      return "Get the right tool and use it where it matters.";
    case "settle":
      return "Get settled in Brackenport: find a place to stay, steady income, and a few friends.";
    case "custom":
    default:
      return "Get settled in Brackenport.";
  }
}

function makeStep(step: ObjectiveTrailItem): ObjectiveTrailItem {
  return step;
}
