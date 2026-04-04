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

interface ConversationObjectiveRoute {
  text: string;
  route: ObjectiveRoute;
}

const OBJECTIVE_TRAIL_LIMIT = 10;

export function buildPlayerObjectiveState(
  world: StreetGameState,
  options: BuildObjectiveOptions = {},
): PlayerObjective | undefined {
  const previous = options.previous ?? world.player.objective;
  const explicitText = normalizeObjectiveText(options.text ?? "");
  const explicitFocus = options.focus ?? (explicitText ? classifyObjective(explicitText) : undefined);
  const explicitSource = options.source ?? previous?.source ?? "dynamic";
  const conversationRoute =
    explicitSource === "manual" ? undefined : chooseConversationRoute(world);

  if (explicitText) {
    const route = buildRouteForObjectiveText(
      world,
      explicitText,
      explicitFocus ?? classifyObjective(explicitText),
      explicitSource,
    );
    return composeObjective(world, explicitText, route, previous);
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
  if (
    conversationRoute &&
    !isAvoidedRoute(conversationRoute.route, avoid) &&
    routeHasWork(conversationRoute.route)
  ) {
    return conversationRoute.route;
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
  const familiarPeople = familiarNpcCount(world);
  const lead = chooseWorkLead(world, textHint);
  const houseStanding = world.player.reputation.morrow_house ?? 0;
  const hasTalkedToMara = countPlayerConversationsWithNpc(world, "npc-mara") > 0;
  const maraTopics = npcReplyTopics(world, "npc-mara");
  const hasStayTerms = houseStanding >= 2 || hasAnyTopic(maraTopics, ["home", "stay"]);
  const hasWorkLead = hasConfirmedWorkLead(world);
  const hasCommittedIncome = hasCommittedOrCompletedJob(world);

  return {
    key: "settle-core",
    focus: "settle",
    source,
    steps: [
      makeStep({
        id: "settle-terms",
        title: `Lock in my stay at ${home?.name ?? "Morrow House"}.`,
        detail: hasStayTerms
          ? "Mara has already laid out what keeps this room mine."
          : hasTalkedToMara
            ? "Mara can help, but Rowan still needs the exact room terms."
            : "Mara can walk Rowan through exactly what it takes to keep a room here.",
        progress: hasStayTerms
          ? "Terms clear"
          : hasTalkedToMara
            ? "Need exact terms"
            : "Talk to Mara",
        done: hasStayTerms,
      }),
      makeStep({
        id: "settle-standing",
        title: `Build standing at ${home?.name ?? "Morrow House"} so the room stays mine.`,
        detail:
          houseStanding >= 2
            ? "Morrow House is starting to see Rowan as dependable."
            : "Now that Rowan knows the terms, he needs to show up and follow through.",
        progress: `Standing ${houseStanding}/2`,
        done: houseStanding >= 2,
      }),
      makeStep({
        id: "settle-lead",
        title:
          lead === "yard"
            ? "Line up one solid work lead at North Crane Yard."
            : "Line up one solid work lead at Kettle & Lamp.",
        detail:
          lead === "yard"
            ? "The yard is a reliable place to turn effort into decent pay."
            : "The tea room is a strong place to turn conversation into work.",
        progress:
          hasWorkLead
            ? "Lead locked"
            : teaJob?.discovered || yardJob?.discovered
              ? "Lead spotted"
              : hasCommittedIncome
                ? "Work in hand"
                : "Looking",
        done: hasWorkLead,
      }),
      makeStep({
        id: "settle-income",
        title: "Turn that lead into steady pay.",
        detail:
          hasCommittedIncome
            ? "Real work is finally taking shape."
            : "A lead matters once Rowan commits and follows through.",
        progress:
          world.player.activeJobId !== undefined
            ? "Working"
            : teaJob?.completed || yardJob?.completed
              ? "Paid once"
              : hasWorkLead
                ? "Ready to commit"
                : "Looking",
        done: hasCommittedIncome,
      }),
      makeStep({
        id: "settle-people",
        title: "Build two real connections.",
        detail:
          familiarPeople >= 2
            ? "A couple of faces now feel like real allies."
            : "Rowan needs a few real connections to make this place feel like home.",
        progress: `${Math.min(familiarPeople, 2)}/2 real connections`,
        done: familiarPeople >= 2,
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
  const leadJob = lead === "yard" ? yardJob : teaJob;
  const anyCompletedWork = world.jobs.some((job) => job.completed);

  return {
    key: lead === "yard" ? "work-yard" : "work-tea",
    focus: "work",
    source,
    steps: [
      makeStep({
        id: lead === "yard" ? "work-lead-yard" : "work-lead-tea",
        title:
          lead === "yard"
            ? `Get a real work lead from ${leadNpc?.name ?? "Tomas"} at ${leadLocation?.name ?? "North Crane Yard"}.`
            : `Get a real work lead from ${leadNpc?.name ?? "Ada"} at ${leadLocation?.name ?? "Kettle & Lamp"}.`,
        detail:
          lead === "yard"
            ? "The yard only counts as a lead once Tomas puts actual work on the table."
            : "The tea room only counts as a lead once Ada makes the offer real.",
        progress: confirmedWorkLeadFor(world, lead)
          ? "Lead confirmed"
          : leadJob?.discovered
            ? "Heard about it"
            : "Still asking",
        done: confirmedWorkLeadFor(world, lead),
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
          leadJob?.accepted || world.player.activeJobId === leadJob?.id
            ? "Committed"
            : leadJob?.completed
              ? "Already worked"
              : leadJob?.discovered
                ? "Lead waiting"
                : "Still asking",
        done: Boolean(leadJob?.accepted || leadJob?.completed),
      }),
      makeStep({
        id: "work-finish",
        title:
          lead === "yard"
            ? "Finish the yard lift cleanly."
            : "Finish the tea-house shift cleanly.",
        detail:
          lead === "yard"
            ? "Following through matters as much as taking the lift."
            : "Finishing the rush matters more than saying yes to it.",
        progress: leadJob?.completed ? "Finished" : "Still ahead",
        done: Boolean(leadJob?.completed),
      }),
      makeStep({
        id: "work-pay",
        title: "Turn the pay into breathing room.",
        detail:
          world.player.money >= 20 || anyCompletedWork
            ? "The day is starting to look more like footing than scrambling."
            : "Work only matters if it buys more than the next hour.",
        progress: `$${world.player.money} on hand`,
        done: world.player.money >= 20 || anyCompletedWork,
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
  const familiarPeople = familiarNpcCount(world);
  const trustedPeople = trustedNpcCount(world);

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
        done:
          target
            ? countPlayerConversationsWithNpc(world, target.id) > 0
            : familiarPeople > 0,
      }),
      makeStep({
        id: "people-open",
        title: "Give somebody a reason to remember me well.",
        detail:
          familiarPeople > 0
            ? "At least one conversation has started to feel warmer than surface-level."
            : "A useful exchange should leave somebody a little more open than before.",
        progress: `${Math.min(familiarPeople, 1)}/1 person opened up`,
        done: familiarPeople >= 1,
      }),
      makeStep({
        id: "people-friend",
        title: "Come away with two people I can return to.",
        detail:
          trustedPeople >= 2
            ? "A couple of people are starting to feel like real footholds."
            : "Rowan still needs more than one good conversation if he's going to stop feeling dropped in.",
        progress: `${Math.min(trustedPeople, 2)}/2 trusted`,
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

function chooseConversationRoute(world: StreetGameState): ConversationObjectiveRoute | undefined {
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

function chooseWorkLead(world: StreetGameState, textHint = "") {
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

  if (hint.includes("ada") || hint.includes("tea")) {
    return "tea" as const;
  }

  if (hint.includes("cook") || hint.includes("counter") || hint.includes("tables")) {
    return "tea" as const;
  }

  if (hint.includes("tomas") || hint.includes("yard")) {
    return "yard" as const;
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
  return world.jobs.some((job) => job.discovered || job.accepted || job.completed);
}

function confirmedWorkLeadFor(world: StreetGameState, lead: "tea" | "yard") {
  const job = lead === "yard" ? jobById(world, "job-yard-shift") : jobById(world, "job-tea-shift");
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
  return world.player.activeJobId !== undefined || world.jobs.some((job) => job.accepted || job.completed);
}

function hasConfirmedWorkLead(world: StreetGameState) {
  return confirmedWorkLeadFor(world, "tea") || confirmedWorkLeadFor(world, "yard");
}

function normalizedIncludes(text: string, needle: string) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function detectTopics(text: string) {
  const normalized = text.toLowerCase();
  const topics = new Set<string>();

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bpay\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(normalized)) {
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

export function classifyObjective(text: string): ObjectiveFocus {
  const normalized = text.toLowerCase();
  const hasWorkNeed = /(work|job|money|coin|earn|pay|shift|income|kettle & lamp|tea[- ]house|north crane|counter|apron|tray|booths?|tables?|rush|gloves|bays?)/.test(
    normalized,
  );
  const hasHomeNeed = /(room|stay|home|house|bed|rent|lodg|shelter|tenant)/.test(normalized);
  const hasPeopleNeed = /(talk|meet|people|trust|introduce|friend|friends|belong)/.test(
    normalized,
  );
  const hasStabilityNeed = /(\bstanding\b|\breliable\b|\bdependable\b|follow through|follow-through|pull (my|your|their) weight|steady tenant)/.test(
    normalized,
  );

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
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/^"+|"+$/g, "");
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
