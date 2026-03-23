import type {
  ObjectiveFocus,
  ObjectiveProgressState,
  ObjectiveSource,
  ObjectiveTrailItem,
  JobState,
  PlayerObjective,
  StreetGameState,
} from "../street-sim/types.js";

interface ObjectiveRoute {
  key: string;
  focus: ObjectiveFocus;
  source: ObjectiveSource;
  steps: ObjectiveTrailItem[];
}

interface BuildObjectiveOptions {
  text?: string;
  focus?: ObjectiveFocus;
  source?: ObjectiveSource;
  previous?: PlayerObjective;
}

type ObjectiveScores = Record<ObjectiveFocus, number>;

const OBJECTIVE_TRAIL_LIMIT = 10;

export function buildPlayerObjectiveState(
  world: StreetGameState,
  options: BuildObjectiveOptions = {},
): PlayerObjective | undefined {
  const previous = options.previous ?? world.player.objective;
  const explicitText = normalizeObjectiveText(options.text ?? "");
  const explicitFocus = options.focus ?? (explicitText ? classifyObjective(explicitText) : undefined);
  const explicitSource = options.source ?? previous?.source ?? "dynamic";

  if (explicitText) {
    const route = buildRouteForObjectiveText(
      world,
      explicitText,
      explicitFocus ?? classifyObjective(explicitText),
      explicitSource,
    );
    return composeObjective(world, explicitText, route, previous);
  }

  if (previous) {
    const previousRoute = buildRouteForObjectiveText(
      world,
      previous.text,
      previous.focus,
      previous.source,
    );
    if (!routeCompleted(previousRoute) && !shouldInterruptCurrentObjective(world, previous)) {
      return composeObjective(world, previous.text, previousRoute, previous);
    }
  }

  const dynamicRoute = chooseDynamicRoute(world);
  return composeObjective(world, routeHeadline(dynamicRoute), dynamicRoute, previous);
}

function composeObjective(
  world: StreetGameState,
  objectiveText: string,
  route: ObjectiveRoute,
  previous?: PlayerObjective,
): PlayerObjective | undefined {
  const completedTrail = buildCompletedTrail(world, previous, route.steps);
  const progress = buildProgress(route.steps);
  const currentStep = route.steps.find((step) => !step.done) ?? route.steps[0];

  if (!currentStep) {
    return undefined;
  }

  const updatedAt = shouldUpdateObjective(previous, route, progress, completedTrail)
    ? world.currentTime
    : previous?.updatedAt ?? world.currentTime;
  const createdAt =
    previous && previous.routeKey === route.key && previous.focus === route.focus
      ? previous.createdAt
      : previous?.createdAt ?? world.currentTime;
  const id =
    previous && previous.routeKey === route.key && previous.focus === route.focus
      ? previous.id
      : `objective-${route.key}-${world.clock.totalMinutes}`;

  const objective: PlayerObjective = {
    id,
    text: objectiveText,
    createdAt,
    updatedAt,
    focus: route.focus,
    source: route.source,
    routeKey: route.key,
    trail: route.steps,
    completedTrail,
    progress,
  };

  if (progress.completed >= progress.total) {
    const nextRoute = chooseDynamicRoute(world, {
      routeKey: route.key,
      focus: route.focus,
    });

    if (nextRoute.key !== route.key || nextRoute.focus !== route.focus) {
      return composeObjective(world, routeHeadline(nextRoute), nextRoute, objective);
    }
  }

  return objective;
}

function shouldUpdateObjective(
  previous: PlayerObjective | undefined,
  route: ObjectiveRoute,
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

  if (previous.progress.completed !== progress.completed || previous.progress.total !== progress.total) {
    return true;
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
  const completed = previous?.completedTrail ? [...previous.completedTrail] : [];
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

function buildProgress(steps: ObjectiveTrailItem[]): ObjectiveProgressState {
  const completed = steps.filter((step) => step.done).length;
  return {
    completed,
    total: steps.length,
    label: `${completed}/${steps.length} checked off`,
  };
}

function routeCompleted(route: ObjectiveRoute) {
  return route.steps.every((step) => step.done);
}

function shouldInterruptCurrentObjective(
  world: StreetGameState,
  previous: PlayerObjective,
) {
  if (previous.source === "manual") {
    const scores = scoreObjectiveFocus(world);
    const restScore = scoreForFocus(scores, "rest");
    return world.player.energy < 35 && restScore >= 35;
  }

  const scores = scoreObjectiveFocus(world);
  const bestFocus = selectBestFocus(scores);
  const currentScore = scoreForFocus(scores, previous.focus);
  const bestScore = scoreForFocus(scores, bestFocus);
  const gap = bestScore - currentScore;

  if (bestFocus === previous.focus) {
    return false;
  }

  if (bestFocus === "rest" && world.player.energy < 45) {
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

  const conversationRoute = chooseConversationRoute(world);
  if (conversationRoute && !isAvoidedRoute(conversationRoute, avoid) && routeHasWork(conversationRoute)) {
    return conversationRoute;
  }

  const scores = scoreObjectiveFocus(world);
  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);

  for (const [focus, score] of ranked) {
    if (score <= 0) {
      continue;
    }

    const route = buildRouteForFocus(world, focus as ObjectiveFocus, "dynamic");
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
): ObjectiveRoute {
  switch (focus) {
    case "work":
      return buildWorkRoute(world, source);
    case "help":
      return buildHelpRoute(world, source);
    case "tool":
      return buildToolRoute(world, source);
    case "rest":
      return buildRestRoute(world, source);
    case "people":
      return buildPeopleRoute(world, source);
    case "explore":
      return buildExploreRoute(world, source);
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
): ObjectiveRoute {
  switch (focus) {
    case "work":
      return buildWorkRoute(world, source, text);
    case "help":
      return buildHelpRoute(world, source, text);
    case "tool":
      return buildToolRoute(world, source, text);
    case "rest":
      return buildRestRoute(world, source, text);
    case "people":
      return buildPeopleRoute(world, source, text);
    case "explore":
      return buildExploreRoute(world, source, text);
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
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;
  const lead = chooseWorkLead(world, textHint);
  const hasTalkedToMara = countPlayerConversationsWithNpc(world, "npc-mara") > 0;

  return {
    key: "settle-core",
    focus: "settle",
    source,
    steps: [
      makeStep({
        id: "settle-room",
        title: hasTalkedToMara
          ? `Keep a room at ${home?.name ?? "Morrow House"} for tonight.`
          : "Talk to Mara about keeping a room tonight.",
        detail: hasTalkedToMara
          ? "The room matters because it keeps Rowan from starting from zero again tomorrow."
          : "Mara is the clearest person to ask about how staying works here.",
        progress: hasTalkedToMara
          ? `Standing ${world.player.reputation.morrow_house ?? 0}/2`
          : "Still need the talk",
        done: hasTalkedToMara || (world.player.reputation.morrow_house ?? 0) >= 2,
      }),
      makeStep({
        id: "settle-income",
        title:
          lead === "yard"
            ? "Get to North Crane Yard and ask Tomas for work."
            : "Get to Kettle & Lamp and ask Ada for work.",
        detail:
          lead === "yard"
            ? "North Crane Yard is the stronger lead for steady pay."
            : "Kettle & Lamp is the likeliest honest lead in South Quay.",
        progress:
          teaJob?.accepted || teaJob?.completed || yardJob?.accepted || yardJob?.completed
            ? "Work in hand"
            : teaJob?.discovered || yardJob?.discovered
              ? "Lead found"
              : "Still looking",
        done:
          world.player.activeJobId !== undefined ||
          Boolean(teaJob?.accepted || teaJob?.completed || yardJob?.accepted || yardJob?.completed),
      }),
      makeStep({
        id: "settle-people",
        title: "Make a few people feel like friends.",
        detail:
          trustedPeople >= 2
            ? "A couple of faces are starting to feel familiar enough to matter."
            : "Rowan still needs more than names if the city is going to feel like home.",
        progress: `${Math.min(world.player.knownNpcIds.length, 3)}/3 known`,
        done: trustedPeople >= 2 || world.player.knownNpcIds.length >= 3,
      }),
    ],
  };
}

function buildWorkRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const lead = chooseWorkLead(world, textHint);
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const leadNpc = lead === "yard" ? npcById(world, "npc-tomas") : npcById(world, "npc-ada");
  const leadLocation =
    lead === "yard" ? findLocation(world, "freight-yard") : findLocation(world, "tea-house");

  return {
    key: lead === "yard" ? "work-yard" : "work-tea",
    focus: "work",
    source,
    steps: [
      makeStep({
        id: lead === "yard" ? "work-ask-yard" : "work-ask-tea",
        title:
          lead === "yard"
            ? `Get to ${leadLocation?.name ?? "North Crane Yard"} and ask ${leadNpc?.name ?? "Tomas"} for work.`
            : `Get to ${leadLocation?.name ?? "Kettle & Lamp"} and ask ${leadNpc?.name ?? "Ada"} for work.`,
        detail:
          lead === "yard"
            ? "The yard is where the steadier money has been."
            : "The tea room is the clearest place to turn a conversation into coin.",
        progress:
          lead === "yard"
            ? yardJob?.accepted || yardJob?.completed
              ? "Lead taken"
              : yardJob?.discovered
                ? "Lead found"
                : "Still asking"
            : teaJob?.accepted || teaJob?.completed
              ? "Lead taken"
              : teaJob?.discovered
                ? "Lead found"
                : "Still asking",
        done:
          lead === "yard"
            ? countPlayerConversationsWithNpc(world, "npc-tomas") > 0 ||
              Boolean(yardJob?.accepted || yardJob?.completed)
            : countPlayerConversationsWithNpc(world, "npc-ada") > 0 ||
              Boolean(teaJob?.accepted || teaJob?.completed),
      }),
      makeStep({
        id: "work-commit",
        title:
          lead === "yard"
            ? "Take the freight-yard lift before the window closes."
            : "Take the cup-and-counter shift at Kettle & Lamp.",
        detail:
          lead === "yard"
            ? "The yard only stays open for work if Rowan moves in time."
            : "Ada likes speed more than speeches.",
        progress:
          world.player.activeJobId !== undefined
            ? "Committed"
            : lead === "yard"
              ? yardJob?.discovered
                ? "Waiting on Rowan"
                : "Still looking"
              : teaJob?.discovered
                ? "Waiting on Rowan"
                : "Still looking",
        done:
          world.player.activeJobId !== undefined ||
          Boolean(teaJob?.accepted || teaJob?.completed || yardJob?.accepted || yardJob?.completed),
      }),
      makeStep({
        id: "work-pay",
        title: "Turn the pay into breathing room.",
        detail:
          world.player.money >= 20 || world.jobs.some((job) => job.completed)
            ? "The day is starting to look more like footing than scrambling."
            : "Work only matters if it buys more than the next hour.",
        progress: `$${world.player.money} on hand`,
        done: world.player.money >= 20 || world.jobs.some((job) => job.completed),
      }),
    ],
  };
}

function buildCommittedJobRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  job: JobState,
): ObjectiveRoute {
  const location = findLocation(world, job.locationId);
  const atLocation = world.player.currentLocationId === job.locationId;
  const inWindow = currentHour(world) >= job.startHour && currentHour(world) < job.endHour;

  return {
    key: `commitment-${job.id}`,
    focus: "work",
    source,
    steps: [
      makeStep({
        id: `commitment-go-${job.id}`,
        title: `Get to ${location?.name ?? "the job site"} for ${job.title.toLowerCase()}.`,
        detail: "A live commitment should be the first thing Rowan can actually cash in.",
        progress: atLocation ? "On site" : "Still moving",
        done: atLocation || job.completed,
      }),
      makeStep({
        id: `commitment-window-${job.id}`,
        title: "Be there while the shift window is still open.",
        detail: "The block only keeps a shift open for so long.",
        progress: inWindow
          ? "Window open"
          : currentHour(world) < job.startHour
            ? "Waiting on the hour"
            : "Window slipping",
        done: inWindow || job.completed,
      }),
      makeStep({
        id: `commitment-finish-${job.id}`,
        title: `Finish ${job.title.toLowerCase()}.`,
        detail: "Following through is what turns a lead into standing.",
        progress: job.completed ? "Finished" : "Still committed",
        done: job.completed,
      }),
    ],
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
  const problem = isPumpLead ? pumpProblem : cartProblem ?? pumpProblem;
  const problemLocation = problem ? findLocation(world, problem.locationId) : undefined;

  if (problem?.id === "problem-cart") {
    return {
      key: "help-cart",
      focus: hasWrench ? "help" : "tool",
      source,
      steps: [
        makeStep({
          id: "help-cart-inspect",
          title: `Inspect the jammed cart in ${problemLocation?.name ?? "Quay Square"}.`,
          detail: "The wheel is already starting to catch on the square's traffic.",
          progress: problem.discovered ? "Problem seen" : "Still a rumor",
          done: problem.discovered,
        }),
        makeStep({
          id: "help-cart-solve",
          title: "Clear the cart before it snarls the square.",
          detail: "The square stays readable when somebody moves trouble before it spreads.",
          progress: problem.status === "solved" ? "Solved" : "Active",
          done: problem.status === "solved",
        }),
      ],
    };
  }

  return {
    key: hasWrench ? "help-pump" : "tool-pump",
    focus: hasWrench ? "help" : "tool",
    source,
    steps: [
      makeStep({
        id: "help-pump-inspect",
        title: `Inspect the pump in ${problemLocation?.name ?? "Morrow Yard"}.`,
        detail:
          problem?.discovered
            ? "Rowan knows enough to tell the leak is one bad turn away from a worse day."
            : "A closer look will tell Rowan whether this is his problem or just nearby trouble.",
        progress: problem?.discovered ? "Problem seen" : "Still a lead",
        done: Boolean(problem?.discovered),
      }),
      makeStep({
        id: "help-pump-tool",
        title: hasWrench ? "Bring the wrench back to the pump." : "Buy a wrench from Jo.",
        detail: hasWrench
          ? "The tool is in hand. The yard just needs Rowan to use it."
          : "Jo is the clearest place to turn loose coins into something useful.",
        progress: hasWrench ? "Tool in hand" : "No wrench yet",
        done: hasWrench,
      }),
      makeStep({
        id: "help-pump-fix",
        title: "Fix the leak before it spreads.",
        detail: "South Quay remembers the people who solve trouble before it gets loud.",
        progress: problem?.status === "solved" ? "Solved" : "Active",
        done: problem?.status === "solved",
      }),
    ],
  };
}

function buildToolRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const pumpProblem = problemById(world, "problem-pump");
  const cartProblem = problemById(world, "problem-cart");
  const target = pumpProblem?.discovered || normalizedIncludes(textHint, "pump")
    ? pumpProblem
    : cartProblem ?? pumpProblem;
  const targetLocation = target ? findLocation(world, target.locationId) : undefined;
  const hasWrench = hasItem(world, "item-wrench");

  return {
    key: target?.id === "problem-cart" ? "tool-cart" : "tool-wrench",
    focus: "tool",
    source,
    steps: [
      makeStep({
        id: "tool-buy",
        title: "Buy a wrench from Jo.",
        detail: "A tool is only a tool until it reaches the problem that needs it.",
        progress: hasWrench ? "Bought" : "Needed",
        done: hasWrench,
      }),
      makeStep({
        id: "tool-return",
        title: `Take it back to ${targetLocation?.name ?? "the trouble"}.`,
        detail: target
          ? `That is where ${target.title.toLowerCase()} is waiting.`
          : "Rowan still needs the right place before the tool matters.",
        progress: target?.discovered ? "Lead known" : "Lead unclear",
        done:
          hasWrench &&
          Boolean(
            target &&
              (world.player.currentLocationId === target.locationId ||
                target.status === "solved"),
          ),
      }),
      makeStep({
        id: "tool-use",
        title: "Use it before the trouble spreads.",
        detail: "A useful tool should end the problem, not just change the label on it.",
        progress: target?.status === "solved" ? "Solved" : "Active",
        done: target?.status === "solved",
      }),
    ],
  };
}

function buildRestRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const home = findLocation(world, world.player.homeLocationId);
  const atHome = world.player.currentLocationId === world.player.homeLocationId;
  return {
    key: "rest-home",
    focus: "rest",
    source,
    steps: [
      makeStep({
        id: "rest-return",
        title: `Get back to ${home?.name ?? "Morrow House"}.`,
        detail:
          normalizedIncludes(textHint, "rest")
            ? "The day is asking for a pause."
            : "Rowan needs somewhere familiar before the hour does any good.",
        progress: atHome ? "Home" : "Away",
        done: atHome,
      }),
      makeStep({
        id: "rest-hour",
        title: "Rest for an hour.",
        detail: "The point is to stop fighting the block long enough to get your legs back.",
        progress: world.player.energy >= 55 ? "Recovered" : `Energy ${world.player.energy}`,
        done: world.player.energy >= 55,
      }),
    ],
  };
}

function buildPeopleRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const target = nextUntalkedNpc(world) ?? world.npcs[0];
  const trustedPeople = world.npcs.filter((npc) => npc.trust >= 2).length;
  return {
    key: `people-${target?.id ?? "locals"}`,
    focus: "people",
    source,
    steps: [
      makeStep({
        id: "people-talk",
        title: target
          ? `Talk to ${target.name} and make a proper introduction.`
          : "Talk to someone new nearby.",
        detail:
          normalizedIncludes(textHint, "friend")
            ? "Rowan is looking for more than a name now."
            : "A real introduction makes the block feel less faceless.",
        progress: target ? `${countPlayerConversationsWithNpc(world, target.id)} chats` : "No target",
        done: target ? countPlayerConversationsWithNpc(world, target.id) > 0 : world.player.knownNpcIds.length > 0,
      }),
      makeStep({
        id: "people-learn",
        title: "Learn who actually matters here.",
        detail:
          world.player.knownNpcIds.length >= 3
            ? "Enough faces are starting to feel like the block has a pattern."
            : "The city is easier to read once a few names stick.",
        progress: `${world.player.knownNpcIds.length}/3 people`,
        done: world.player.knownNpcIds.length >= 3,
      }),
      makeStep({
        id: "people-friend",
        title: "Find one person I can come back to.",
        detail:
          trustedPeople >= 2
            ? "At least a couple of people are starting to feel like they could matter."
            : "Rowan still needs one person who feels like more than a surface conversation.",
        progress: `${trustedPeople}/2 trusted`,
        done: trustedPeople >= 2,
      }),
    ],
  };
}

function buildExploreRoute(
  world: StreetGameState,
  source: ObjectiveSource,
  textHint = "",
): ObjectiveRoute {
  const target = nextUnknownLocation(world) ?? world.locations[0];
  const hasVisitedTarget = target ? world.player.knownLocationIds.includes(target.id) : false;
  const targetPeople = target
    ? world.npcs.filter((npc) => npc.currentLocationId === target.id)
    : [];

  return {
    key: `explore-${target?.id ?? "district"}`,
    focus: "explore",
    source,
    steps: [
      makeStep({
        id: "explore-go",
        title: target
          ? `Walk to ${target.name} and see what it is for.`
          : "Walk to a corner you do not know yet.",
        detail:
          normalizedIncludes(textHint, "map") || normalizedIncludes(textHint, "learn")
            ? "Rowan is trying to make the district legible."
            : "A new corner is usually easier to understand once you stand in it.",
        progress: target ? `${hasVisitedTarget ? "Known" : "Unknown"} place` : "No target",
        done: hasVisitedTarget,
      }),
      makeStep({
        id: "explore-talk",
        title: targetPeople[0]
          ? `Talk to ${targetPeople[0].name} there.`
          : "Talk to whoever runs that corner.",
        detail:
          targetPeople.length > 0
            ? `${targetPeople[0].name} is the most likely person to explain the place.`
            : "Someone there should know what the corner is really for.",
        progress: `${targetPeople.length} people nearby`,
        done:
          targetPeople.length > 0 &&
          targetPeople.some((npc) => countPlayerConversationsWithNpc(world, npc.id) > 0),
      }),
      makeStep({
        id: "explore-learn",
        title: "Learn what the place is really for.",
        detail:
          world.player.knownLocationIds.length >= 4
            ? "The district is starting to feel like a place rather than a blur."
            : "Rowan still needs one more useful corner before the map starts making sense.",
        progress: `${world.player.knownLocationIds.length}/4 places`,
        done: world.player.knownLocationIds.length >= 4,
      }),
    ],
  };
}

function chooseConversationRoute(world: StreetGameState) {
  const threads = Object.values(world.conversationThreads ?? {})
    .filter((thread) => thread.objectiveText)
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""),
    );

  for (const thread of threads) {
    const route = buildRouteForObjectiveText(
      world,
      thread.objectiveText ?? "",
      classifyObjective(thread.objectiveText ?? ""),
      "conversation",
    );
    if (routeHasWork(route)) {
      return route;
    }
  }

  return undefined;
}

function chooseWorkLead(world: StreetGameState, textHint = "") {
  const teaJob = jobById(world, "job-tea-shift");
  const yardJob = jobById(world, "job-yard-shift");
  const hint = textHint.toLowerCase();
  const hasTalkedToAda = countPlayerConversationsWithNpc(world, "npc-ada") > 0;
  const hasTalkedToTomas = countPlayerConversationsWithNpc(world, "npc-tomas") > 0;
  const hour = currentHour(world);

  if (
    hint.includes("ada") ||
    hint.includes("tea") ||
    hasTalkedToAda ||
    (teaJob?.discovered && !teaJob.completed)
  ) {
    return "tea" as const;
  }

  if (
    hint.includes("tomas") ||
    hint.includes("yard") ||
    hasTalkedToTomas ||
    (yardJob?.discovered && !yardJob.completed)
  ) {
    return "yard" as const;
  }

  if (hour >= 12.5 && (yardJob?.discovered || hasTalkedToTomas)) {
    return "yard" as const;
  }

  return "tea" as const;
}

function nextUntalkedNpc(world: StreetGameState) {
  return world.npcs
    .filter((npc) => countPlayerConversationsWithNpc(world, npc.id) === 0)
    .sort((left, right) => {
      const leftDistance = distanceToLocation(world, left.currentLocationId);
      const rightDistance = distanceToLocation(world, right.currentLocationId);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return Number(right.known) - Number(left.known);
    })[0];
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

function nearestKnownLocationDistance(world: StreetGameState, locationId: string) {
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

  return Math.abs(world.player.x - location.entryX) + Math.abs(world.player.y - location.entryY);
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

function jobById(world: StreetGameState, jobId: string) {
  return world.jobs.find((entry) => entry.id === jobId);
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

function countPlayerConversationsWithNpc(world: StreetGameState, npcId: string) {
  return world.conversations.filter(
    (entry) => entry.npcId === npcId && entry.speaker === "player",
  ).length;
}

function normalizedIncludes(text: string, needle: string) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function detectTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b/.test(normalized)) {
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

  if (/\bmap\b|\blearn\b|\bexplore\b|\blane\b|\bdistrict\b|\bcity\b/.test(normalized)) {
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

  return {
    work:
      (activeJob ? 60 : 0) +
      ((teaJob?.discovered && !teaJob.completed) || (yardJob?.discovered && !yardJob.completed)
        ? 22
        : 0) +
      (world.player.money < 15 ? 14 : 0) +
      (topics.has("work") || topics.has("job") || topics.has("shift") ? 10 : 0) +
      (currentHour(world) < 17 ? 4 : 0),
    help:
      ((pumpProblem?.discovered || cartProblem?.discovered) &&
      (pumpProblem?.status === "active" || cartProblem?.status === "active")
        ? 34
        : 0) +
      (topics.has("help") || topics.has("fix") || topics.has("repair") ? 10 : 0) +
      (topics.has("pump") || topics.has("cart") ? 8 : 0),
    tool:
      ((pumpProblem?.discovered || cartProblem?.discovered) &&
      (pumpProblem?.requiredItemId || cartProblem?.requiredItemId) &&
      !hasWrench
        ? 42
        : 0) +
      (topics.has("tool") || topics.has("wrench") ? 10 : 0),
    rest:
      (world.player.energy < 35 ? 50 : 0) +
      (world.player.energy < 50 ? 18 : 0) +
      (world.player.currentLocationId !== world.player.homeLocationId && world.player.energy < 45
        ? 12
        : 0) +
      (currentHour(world) >= 20 || currentHour(world) < 6 ? 14 : 0),
    people:
      (world.player.knownNpcIds.length < 3 ? 16 : 0) +
      (trustedPeople < 2 ? 10 : 0) +
      (topics.has("people") || topics.has("friend") || topics.has("gossip")
        ? 8
        : 0),
    explore:
      (world.player.knownLocationIds.length < 4 ? 16 : 0) +
      (topics.has("learn") || topics.has("map") || topics.has("explore") ? 8 : 0),
    settle:
      ((world.player.reputation.morrow_house ?? 0) < 2 ? 14 : 0) +
      (world.player.money < 20 ? 10 : 0) +
      (world.player.knownNpcIds.length < 3 ? 8 : 0) +
      (topics.has("stay") || topics.has("home") || topics.has("room") ? 10 : 0),
    custom: 0,
  };
}

function selectBestFocus(scores: ObjectiveScores): ObjectiveFocus {
  const sorted = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  if (!sorted[0] || sorted[0][1] <= 0) {
    return "settle";
  }

  return sorted[0][0] as ObjectiveFocus;
}

function scoreForFocus(scores: ObjectiveScores, focus: ObjectiveFocus) {
  return scores[focus] ?? 0;
}

function classifyObjective(text: string): ObjectiveFocus {
  const normalized = text.toLowerCase();
  const hasWorkNeed = /(work|job|money|coin|earn|pay|shift|income)/.test(normalized);
  const hasHomeNeed = /(room|stay|home|bed|rent|lodg|shelter)/.test(normalized);
  const hasPeopleNeed = /(talk|meet|people|trust|introduce|ask|friend|friends|belong)/.test(
    normalized,
  );

  if (
    /\b(new in|new here|new to|footing|settle|belong|start over|make a life)\b/.test(
      normalized,
    ) ||
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
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function routeHeadline(route: ObjectiveRoute) {
  return route.steps.find((step) => !step.done)?.title ?? defaultObjectiveTextForFocus(route.focus);
}

function defaultObjectiveTextForFocus(focus: ObjectiveFocus) {
  switch (focus) {
    case "work":
      return "Find steady income before tonight.";
    case "help":
      return "Find the trouble worth stepping into and handle it.";
    case "tool":
      return "Get the right tool and use it where it matters.";
    case "rest":
      return "Recover enough to move cleanly again.";
    case "people":
      return "Meet people who could become real friends in South Quay.";
    case "explore":
      return "Learn the lanes and people of South Quay.";
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
