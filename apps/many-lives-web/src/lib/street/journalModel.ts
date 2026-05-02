import type { StreetGameState } from "@/lib/street/types";

export type ObjectivePlanItem = {
  id: string;
  title: string;
  detail: string;
  progress?: string;
  done: boolean;
};

export type MemoryThread = {
  id: string;
  title: string;
  detail: string;
  priority: number;
};

export function buildObjectivePlanRows(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  if (game.player.objective?.trail?.length) {
    return game.player.objective.trail.map((item) => ({
      detail: item.detail ?? item.progress ?? "Active",
      done: Boolean(item.done),
      id: item.id,
      progress: item.progress,
      title: item.title,
    }));
  }

  return buildObjectivePlanItems(game, locationById);
}

export function buildObjectiveCompletionRows(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  if (game.player.objective?.completedTrail?.length) {
    return game.player.objective.completedTrail.map((item) => ({
      detail: item.detail ?? item.progress ?? "Done",
      done: true,
      id: item.id,
      progress: item.progress,
      title: item.title,
    }));
  }

  return buildObjectiveCompletedItems(game, locationById);
}

export function buildObjectiveSuggestions(game: StreetGameState) {
  const suggestions = new Set<string>();
  const activeJob = game.jobs.find(
    (job) => job.id === game.player.activeJobId && !job.completed,
  );
  const pumpProblem = game.problems.find(
    (problem) => problem.id === "problem-pump",
  );
  const cartProblem = game.problems.find(
    (problem) => problem.id === "problem-cart",
  );
  const hasWrench = game.player.inventory.some(
    (item) => item.id === "item-wrench",
  );
  const spokenNpcCount = new Set(
    game.conversations
      .filter((entry) => entry.speaker === "player")
      .map((entry) => entry.npcId),
  ).size;

  if (spokenNpcCount < game.npcs.length) {
    suggestions.add("Make the rounds and talk to everyone.");
  }

  if (activeJob) {
    suggestions.add(`Finish ${activeJob.title.toLowerCase()}.`);
  }

  if (
    pumpProblem?.discovered &&
    pumpProblem.status === "active" &&
    !hasWrench
  ) {
    suggestions.add("Buy a wrench and fix the pump.");
  } else if (pumpProblem?.discovered && pumpProblem.status === "active") {
    suggestions.add("Fix the pump in Morrow Yard.");
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    suggestions.add("Clear the jammed cart in the square.");
  }

  if (game.player.money < 18) {
    suggestions.add("Find steady income before tonight.");
  }

  if ((game.player.reputation.morrow_house ?? 0) < 2) {
    suggestions.add("Figure out where I can stay beyond tonight.");
  }

  if (game.player.knownLocationIds.length < 4) {
    suggestions.add("Learn the lanes and meet people.");
  }

  if (game.player.knownNpcIds.length < 3) {
    suggestions.add("Meet people who could become friends in South Quay.");
  }

  if (game.player.energy < 38) {
    suggestions.add("Get somewhere quiet and recover.");
  }

  suggestions.add("Get settled in Brackenport.");

  return Array.from(suggestions).slice(0, 5);
}

export function buildMemoryThreads(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): MemoryThread[] {
  const visibleJobs = game.jobs
    .filter(
      (job) => job.accepted || job.discovered || job.completed || job.missed,
    )
    .map((job) => ({
      detail: buildJobMemoryDetail(job, locationById.get(job.locationId)?.name),
      id: job.id,
      priority: job.accepted ? 4 : job.discovered ? 3 : job.completed ? 2 : 1,
      title: job.title,
    }));

  const visibleProblems = game.problems
    .filter((problem) => problem.discovered)
    .map((problem) => ({
      detail: buildProblemMemoryDetail(
        problem,
        locationById.get(problem.locationId)?.name,
      ),
      id: problem.id,
      priority:
        problem.status === "active"
          ? 5
          : problem.status === "solved"
            ? 2
            : problem.status === "expired"
              ? 1
              : 0,
      title: problem.title,
    }));

  return [...visibleProblems, ...visibleJobs]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);
}

function buildJobMemoryDetail(
  job: StreetGameState["jobs"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (job.completed) {
    return `I finished this at ${place} and got paid.`;
  }

  if (job.missed) {
    return `I let this slip at ${place}.`;
  }

  if (job.accepted) {
    if (job.deferredUntilMinutes !== undefined) {
      return `I'm still committed to this at ${place}, but I've pushed it back for a bit.`;
    }

    return `I'm committed to this at ${place}. It pays $${job.pay}.`;
  }

  return `I know this lead at ${place}. It pays $${job.pay}.`;
}

function buildProblemMemoryDetail(
  problem: StreetGameState["problems"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (problem.status === "solved") {
    return `I already handled this at ${place}.`;
  }

  if (problem.status === "expired") {
    return `I let this spread at ${place}.`;
  }

  if (problem.status === "active") {
    return `I can deal with this at ${place}. It pays $${problem.rewardMoney}.`;
  }

  return `I heard about this at ${place}.`;
}

function buildObjectiveCompletedItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  const completedItems: ObjectivePlanItem[] = [];
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2);
  const completedJobs = game.jobs.filter((job) => job.completed);
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  );

  for (const job of completedJobs) {
    completedItems.push({
      detail: `You followed through at ${
        locationById.get(job.locationId)?.name ?? "the job site"
      } and got paid.`,
      done: true,
      id: `completed-job-${job.id}`,
      progress: `+$${job.pay}`,
      title: `Finished ${job.title.toLowerCase()}`,
    });
  }

  for (const problem of solvedProblems) {
    completedItems.push({
      detail: `You handled this at ${
        locationById.get(problem.locationId)?.name ?? "the scene"
      } and made the block a little easier to live in.`,
      done: true,
      id: `completed-problem-${problem.id}`,
      progress:
        problem.rewardMoney > 0 ? `+$${problem.rewardMoney}` : undefined,
      title: `Solved ${problem.title.toLowerCase()}`,
    });
  }

  if (game.player.knownLocationIds.length >= 4) {
    completedItems.push({
      detail:
        "The district has stopped feeling like a blur. Rowan has enough of the lanes in his head to plan ahead.",
      done: true,
      id: "completed-lanes",
      progress: `${game.player.knownLocationIds.length} places known`,
      title: "Got the lay of South Quay",
    });
  }

  if (game.player.knownNpcIds.length >= 3) {
    completedItems.push({
      detail:
        "Rowan is no longer a stranger to just one face. A few locals know him well enough to place him.",
      done: true,
      id: "completed-locals",
      progress: `${game.player.knownNpcIds.length} people known`,
      title: "Made first introductions",
    });
  }

  if (trustedPeople.length >= 1) {
    completedItems.push({
      detail: `${trustedPeople[0]?.name ?? "Someone"} has started answering Rowan like he belongs in the conversation.`,
      done: true,
      id: "completed-trust",
      progress: `${trustedPeople.length} trusted`,
      title: "Earned some trust",
    });
  }

  if (game.player.money >= 20) {
    completedItems.push({
      detail:
        "Cash has started feeling like footing instead of the day's last few coins.",
      done: true,
      id: "completed-breathing-room",
      progress: `$${game.player.money} on hand`,
      title: "Built a little breathing room",
    });
  }

  return completedItems.slice(0, 8);
}

function buildObjectivePlanItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  const focus = game.player.objective?.focus ?? "settle";
  const activeJob = game.jobs.find(
    (job) =>
      job.id === game.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const discoveredJobs = game.jobs.filter((job) => job.discovered);
  const completedJobs = game.jobs.filter((job) => job.completed).length;
  const discoveredProblems = game.problems.filter(
    (problem) => problem.discovered,
  );
  const activeProblems = discoveredProblems.filter(
    (problem) => problem.status === "active",
  );
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  ).length;
  const knownPeople = game.player.knownNpcIds.length;
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2).length;
  const knownPlaces = game.player.knownLocationIds.length;
  const houseStanding = game.player.reputation.morrow_house ?? 0;
  const homeName =
    locationById.get(game.player.homeLocationId)?.name ?? "Morrow House";
  const hasWrench = game.player.inventory.some(
    (item) => item.id === "item-wrench",
  );
  const activeProblem = activeProblems[0];
  const activeJobLocation = activeJob
    ? locationById.get(activeJob.locationId)?.name
    : undefined;

  switch (focus) {
    case "work":
      return [
        {
          detail:
            discoveredJobs.length > 0
              ? "There is at least one real work lead on the block now."
              : "You still need to find out who is actually hiring today.",
          done: discoveredJobs.length > 0,
          id: "work-lead",
          progress: `${Math.min(discoveredJobs.length, 1)}/1 lead`,
          title: "Find paying work",
        },
        {
          detail: activeJob
            ? `You already have ${activeJob.title.toLowerCase()} lined up at ${activeJobLocation ?? "the job site"}.`
            : completedJobs > 0
              ? "You have already proved you can turn a lead into real work."
              : "You still need to lock one job in instead of only hearing about it.",
          done: Boolean(activeJob || completedJobs > 0),
          id: "work-commit",
          progress: activeJob || completedJobs > 0 ? "In hand" : "Not lined up",
          title: "Line up the next shift",
        },
        {
          detail:
            completedJobs > 0 || game.player.money >= 20
              ? "Money is starting to feel like footing, not just survival."
              : "The point is not only work. It is enough cash that the next move gets easier.",
          done: completedJobs > 0 || game.player.money >= 20,
          id: "work-money",
          progress: `$${game.player.money} on hand`,
          title: "Turn it into breathing room",
        },
      ];
    case "people":
      return [
        {
          detail:
            knownPeople >= 3
              ? "You know enough people now that the block has stopped feeling faceless."
              : "You still need to make yourself known to more than one or two people here.",
          done: knownPeople >= 3,
          id: "people-meet",
          progress: `${knownPeople}/3 people`,
          title: "Meet a few locals",
        },
        {
          detail:
            trustedPeople >= 1
              ? "At least one person is starting to answer you like you belong in the conversation."
              : "You still need one real conversation that turns into trust.",
          done: trustedPeople >= 1,
          id: "people-open-up",
          progress: `${Math.min(trustedPeople, 1)}/1 trust`,
          title: "Get someone to open up",
        },
        {
          detail:
            trustedPeople >= 2
              ? "A couple of people are starting to feel like they could become real friends."
              : "This is not just about names. It is about finding people you would actually return to.",
          done: trustedPeople >= 2,
          id: "people-friends",
          progress: `${trustedPeople}/2 trusted`,
          title: "Find people to come back to",
        },
      ];
    case "explore":
      return [
        {
          detail:
            knownPlaces >= 4
              ? "You know enough places now to move with some intention."
              : "You still need a better mental map of where this district opens up.",
          done: knownPlaces >= 4,
          id: "explore-places",
          progress: `${knownPlaces}/4 places`,
          title: "Learn the shape of the block",
        },
        {
          detail:
            knownPeople >= 2
              ? "You have started pairing places with the people who matter there."
              : "A map is not enough. You still need to connect those places to real people.",
          done: knownPeople >= 2,
          id: "explore-people",
          progress: `${knownPeople}/2 people`,
          title: "Meet people in it",
        },
        {
          detail:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0
              ? "The district has already given you at least one lead worth following."
              : "Learning the lanes should surface one job, problem, or useful opening.",
          done:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0,
          id: "explore-lead",
          progress:
            discoveredJobs.length > 0 ||
            activeProblems.length > 0 ||
            solvedProblems > 0
              ? "Lead found"
              : "Still looking",
          title: "Come away with one usable lead",
        },
      ];
    case "help":
      return [
        {
          detail:
            discoveredProblems.length > 0
              ? "You know what is actually wrong now, not just that something feels off."
              : "You still need to pin down what needs fixing and where it sits.",
          done: discoveredProblems.length > 0,
          id: "help-find",
          progress: `${Math.min(discoveredProblems.length, 1)}/1 problem`,
          title: "Find the problem clearly",
        },
        {
          detail: !activeProblem
            ? "Once the problem is clear, figure out whether it needs time, hands, or a tool."
            : activeProblem.requiredItemId
              ? hasWrench
                ? "You have the tool this fix has been waiting on."
                : "You know the fix needs a tool before your hands can finish it."
              : "You already have what you need to handle this.",
          done:
            Boolean(activeProblem) &&
            (!activeProblem.requiredItemId || hasWrench),
          id: "help-ready",
          progress: !activeProblem
            ? "Waiting on details"
            : activeProblem.requiredItemId
              ? hasWrench
                ? "Tool ready"
                : "Tool needed"
              : "Ready now",
          title: "Get what the fix needs",
        },
        {
          detail:
            solvedProblems > 0
              ? "You have already turned one local problem into proof that you can help."
              : "The last step is doing the work, not circling it.",
          done: solvedProblems > 0,
          id: "help-solve",
          progress: `${Math.min(solvedProblems, 1)}/1 solved`,
          title: "See it through",
        },
      ];
    case "tool":
      return [
        {
          detail:
            activeProblem?.requiredItemId || hasWrench
              ? "You know which tool would help."
              : "You still need to hear what tool would actually change the day.",
          done: Boolean(activeProblem?.requiredItemId || hasWrench),
          id: "tool-decide",
          progress:
            activeProblem?.requiredItemId || hasWrench
              ? "Clear enough"
              : "Still asking",
          title: "Figure out which tool matters",
        },
        {
          detail:
            game.player.money >= 8 || hasWrench
              ? "You have enough coin to stop this at talk and turn it into a purchase."
              : "You still need enough cash to buy the tool without wrecking your next move.",
          done: game.player.money >= 8 || hasWrench,
          id: "tool-money",
          progress: `$${game.player.money} / $8`,
          title: "Get the money together",
        },
        {
          detail: hasWrench
            ? "The tool is already in your hands now."
            : "You still need to go get it.",
          done: hasWrench,
          id: "tool-buy",
          progress: hasWrench ? "Owned" : "Not bought",
          title: "Buy the tool",
        },
      ];
    case "rest":
      return [
        {
          detail:
            game.player.currentLocationId === game.player.homeLocationId
              ? `You are already at ${homeName}, which gives rest a chance to count.`
              : `You need to get back to ${homeName} or another safe place before resting does much.`,
          done: game.player.currentLocationId === game.player.homeLocationId,
          id: "rest-safe",
          progress:
            game.player.currentLocationId === game.player.homeLocationId
              ? "In place"
              : "Still out",
          title: "Get somewhere you can actually stop",
        },
        {
          detail:
            game.player.energy >= 70
              ? "Your energy has already come back enough that the edge is off."
              : "You still need to actually stop long enough for recovery to happen.",
          done: game.player.energy >= 70,
          id: "rest-hour",
          progress: `${game.player.energy} energy`,
          title: "Rest for an hour",
        },
      ];
    case "settle":
    default:
      return [
        {
          detail: game.goals[0] ?? "You still need a real path to money.",
          done: Boolean(
            activeJob || completedJobs > 0 || discoveredJobs.length > 0,
          ),
          id: "settle-income",
          progress:
            activeJob || completedJobs > 0 || discoveredJobs.length > 0
              ? "Lead found"
              : "Still looking",
          title: "Find income",
        },
        {
          detail:
            game.goals[1] ?? `You still need better footing at ${homeName}.`,
          done: houseStanding >= 2,
          id: "settle-stay",
          progress: `${houseStanding}/2 footing`,
          title: "Make the bed situation less shaky",
        },
        {
          detail:
            game.goals[2] ??
            "You still need people who are more than passing faces.",
          done: trustedPeople >= 1 || knownPeople >= 3,
          id: "settle-people",
          progress: `${Math.max(trustedPeople, knownPeople)}/${trustedPeople > 0 ? 2 : 3}`,
          title: "Find people you might actually keep",
        },
        {
          detail:
            knownPlaces >= 4
              ? "The district is starting to feel like somewhere you can route yourself through."
              : "You still need a stronger read on where things are and what each place is good for.",
          done: knownPlaces >= 4,
          id: "settle-bearings",
          progress: `${knownPlaces}/4 places`,
          title: "Learn enough of the block to plan ahead",
        },
      ];
  }
}
