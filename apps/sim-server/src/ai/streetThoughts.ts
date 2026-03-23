import type {
  NpcState,
  StreetGameState,
} from "../street-sim/types.js";
import { normalizeStreetVoice } from "./streetVoice.js";
import { getNpcNarrative } from "../street-sim/npcNarratives.js";

export interface StreetThoughtsResult {
  playerThought: string;
  npcThoughts: Record<string, string>;
}

export function buildDeterministicStreetThoughts(
  game: StreetGameState,
): StreetThoughtsResult {
  const playerThought = buildPlayerThought(game);
  const npcThoughts = Object.fromEntries(
    game.npcs.map((npc) => [npc.id, buildNpcThought(npc, game)]),
  );

  return {
    playerThought,
    npcThoughts,
  };
}

export function streetThoughtsCacheKey(game: StreetGameState): string {
  return JSON.stringify({
    scene: {
      day: game.clock.day,
      hour: game.clock.hour,
      timeBucket: Math.floor(game.clock.totalMinutes / 15),
      playerLocationId: game.player.currentLocationId ?? "street",
      objective: game.player.objective?.text ?? null,
      objectiveRouteKey: game.player.objective?.routeKey ?? null,
      objectiveProgress: game.player.objective?.progress?.label ?? null,
      objectiveTrail: game.player.objective?.trail?.map((item) => `${item.id}:${item.done ? 1 : 0}`) ?? [],
      completedObjectiveTrailCount: game.player.objective?.completedTrail?.length ?? 0,
      activeJobId: game.player.activeJobId ?? null,
      inventory: game.player.inventory.map((item) => item.id),
      knownLocationIds: [...game.player.knownLocationIds].sort(),
      moneyBand: resourceBand(game.player.money, [8, 20, 30]),
      energyBand: resourceBand(game.player.energy, [30, 50, 75]),
    },
    player: {
      backstory: game.player.backstory,
      currentThought: game.player.currentThought ?? null,
    },
    npcs: game.npcs.map((npc) => ({
      id: npc.id,
      locationId: npc.currentLocationId,
      known: npc.known,
      trust: npc.trust,
      trustBand: resourceBand(npc.trust, [1, 3, 5]),
      openness: npc.openness,
      mood: npc.mood,
      narrative: getNpcNarrative(npc.id),
      currentObjective: npc.currentObjective,
      currentConcern: npc.currentConcern,
      lastSpokenLine: npc.lastSpokenLine ?? null,
      lastInteractionAt: npc.lastInteractionAt ?? null,
    })),
    jobs: game.jobs.map((job) => ({
      id: job.id,
      discovered: job.discovered,
      accepted: job.accepted,
      completed: job.completed,
      missed: job.missed,
    })),
    problems: game.problems.map((problem) => ({
      id: problem.id,
      discovered: problem.discovered,
      status: problem.status,
    })),
    conversations: game.conversations.slice(-6).map((entry) => ({
      npcId: entry.npcId,
      speaker: entry.speaker,
      text: entry.text,
    })),
  });
}

function resourceBand(value: number, thresholds: number[]) {
  let band = 0;

  for (const threshold of thresholds) {
    if (value >= threshold) {
      band += 1;
    }
  }

  return band;
}

function buildPlayerThought(game: StreetGameState) {
  const nextObjectiveStep = game.player.objective?.trail.find((step) => !step.done);
  const nextObjectiveText = nextObjectiveStep?.title ?? game.player.objective?.text ?? "";
  const activeJob = game.jobs.find((job) => job.id === game.player.activeJobId);
  const pumpProblem = game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = game.problems.find((problem) => problem.id === "problem-cart");
  const hasWrench = game.player.inventory.some((item) => item.id === "item-wrench");

  if (activeJob && !activeJob.completed) {
    return "I can't blow this shift.";
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && !hasWrench) {
    return "I need a wrench first.";
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && hasWrench) {
    return "I should go fix that pump.";
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    return "I need to move that cart.";
  }

  if (game.player.energy < 38) {
    return "I could use a proper sit-down.";
  }

  if ((game.player.reputation.morrow_house ?? 0) < 2) {
    return "I need somewhere to stay beyond tonight.";
  }

  if (game.player.knownNpcIds.length < 3) {
    return "I need to meet a few people I could actually befriend.";
  }

  if (game.player.knownLocationIds.length < 4) {
    return "I need to learn these lanes if I'm making a life here.";
  }

  if (game.player.money < 18) {
    return "I need steadier income if I'm going to stay here.";
  }

  const planningThought = buildPlanningThought(game);
  if (planningThought) {
    return sanitizeThought(planningThought);
  }

  if (nextObjectiveText) {
    return sanitizeThought(firstPersonThought(nextObjectiveText));
  }

  return "I think I could find a real friend here.";
}

function buildPlanningThought(game: StreetGameState) {
  const nextObjectiveStep = game.player.objective?.trail.find((step) => !step.done);
  const objective = nextObjectiveStep?.title ?? game.player.objective?.text ?? "";
  const objectiveFocus = game.player.objective?.focus;
  const knownLocations = game.locations.filter((location) =>
    game.player.knownLocationIds.includes(location.id),
  );
  const knownNpcs = game.npcs.filter((npc) => game.player.knownNpcIds.includes(npc.id));
  const nextPlaces = knownLocations
    .filter((location) => location.id !== game.player.currentLocationId)
    .slice(0, 2)
    .map((location) => location.name);
  const nextPeople = knownNpcs.slice(0, 3).map((npc) => npc.name);

  const shouldPlan =
    objectiveFocus === "settle" ||
    objectiveFocus === "explore" ||
    objectiveFocus === "people" ||
    objectiveFocus === "work" ||
    objectiveFocus === "help" ||
    /\b(map|learn|explore|rounds|meet|people|lane|lanes|city|district|new|footing|settle|stay|room|friend|trust)\b/i.test(
      objective,
    );

  if (!shouldPlan) {
    return undefined;
  }

  if (objectiveFocus === "settle") {
    if (nextPlaces[0] && nextPeople[0]) {
      return `I should start at ${nextPlaces[0]}, then talk to ${nextPeople[0]} about getting settled here.`;
    }

    if (nextPeople[0]) {
      return `I should talk to ${nextPeople[0]} about how people get established here.`;
    }

    if (nextPlaces[0]) {
      return `I should start at ${nextPlaces[0]} and see what it opens up.`;
    }

    return "I should find income, a steadier room, and a few decent people.";
  }

  if (objectiveFocus === "work") {
    if (nextPlaces[0] && nextPeople[0]) {
      return `I should start at ${nextPlaces[0]}, then talk to ${nextPeople[0]} about work.`;
    }

    if (nextPeople[0]) {
      return `I should ask ${nextPeople[0]} where the work is.`;
    }

    return "I should map the block and look for paid work.";
  }

  if (objectiveFocus === "help") {
    if (nextPlaces[0] && nextPeople[0]) {
      return `I should check ${nextPlaces[0]}, then ask ${nextPeople[0]} what still needs a hand.`;
    }

    return "I should look for the problem people keep circling.";
  }

  if (nextPlaces.length >= 2 && nextPeople.length >= 2) {
    return `I should start at ${nextPlaces[0]}, then ${nextPlaces[1]}, and talk to ${nextPeople[0]} and ${nextPeople[1]}.`;
  }

  if (nextPlaces[0] && nextPeople[0]) {
    return `I should start at ${nextPlaces[0]}, then talk to ${nextPeople[0]}.`;
  }

  if (nextPeople.length >= 2) {
    return `I should talk to ${nextPeople[0]} and ${nextPeople[1]} before I decide more.`;
  }

  if (nextPlaces[0]) {
    return `I should start at ${nextPlaces[0]} and keep mapping South Quay.`;
  }

  return "I should map South Quay and make a few introductions.";
}

function buildNpcThought(npc: NpcState, game: StreetGameState) {
  const narrative = getNpcNarrative(npc.id);
  const hour = game.clock.hour + game.clock.minute / 60;
  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const yardJob = game.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = game.problems.find((problem) => problem.id === "problem-cart");
  const playerHasWrench = game.player.inventory.some((item) => item.id === "item-wrench");
  const recentlySpoke = minutesSinceLastInteraction(game, npc) <= 25;
  const seed = thoughtSeed(game, npc);

  switch (npc.id) {
    case "npc-mara":
      if (recentlySpoke) {
        return rotatingThought(
          [
            "Maybe Rowan will actually follow through.",
            "Let's see if Rowan keeps the promise.",
            "He sounded useful. Now prove it.",
          ],
          seed,
        );
      }
      if (pumpProblem?.discovered && pumpProblem.status === "active") {
        return rotatingThought(
          [
            "That pump is making the yard sour.",
            "I need that pump sorted before supper.",
            "Water turns house trouble public fast.",
          ],
          seed,
        );
      }
      if (pumpProblem?.discovered && pumpProblem.status === "solved") {
        return rotatingThought(
          [
            "At least the yard is holding now.",
            "Good. That's one less house problem spreading.",
            "That fix bought the house some quiet.",
          ],
          seed,
        );
      }
      return hour < 12
        ? rotatingThought(
            [
              "Somebody's late on rent again.",
              "I can hear who came in honest tired.",
              "This house remembers every set of footsteps.",
            ],
            seed,
          )
        : rotatingThought(
            [
              "House still has a memory of people.",
              "Usefulness lasts longer than charm here.",
              "I need the house steady through tonight.",
            ],
            seed,
          );
    case "npc-ada":
      if (recentlySpoke) {
        return rotatingThought(
          [
            "Maybe Rowan can keep the room moving.",
            "We'll see if Rowan is all talk.",
            "If he comes back, he better keep pace.",
          ],
          seed,
        );
      }
      if (!teaJob?.accepted && hour < 12.25) {
        return rotatingThought(
          [
            "I need another pair of hands now.",
            "Noon is coming and I'm still short.",
            "One more steady set of hands would help.",
          ],
          seed,
        );
      }
      if (teaJob?.accepted && !teaJob.completed) {
        return rotatingThought(
          [
            "I need the cups moving, not speeches.",
            "Keep the room turning over, keep smiling.",
            "Noon punishes every slow hand in here.",
          ],
          seed,
        );
      }
      return rotatingThought(
        [
          "Noon rush is almost on top of me.",
          "The room always gets tighter before the rush.",
          "I need the kettle ahead of the crowd.",
        ],
        seed,
      );
    case "npc-jo":
      if (recentlySpoke) {
        return rotatingThought(
          [
            "He listened better than most customers.",
            "Let's see if Rowan uses the advice.",
            "If he buys the wrench, he means it.",
          ],
          seed,
        );
      }
      if (pumpProblem?.discovered && pumpProblem.status === "active" && !playerHasWrench) {
        return rotatingThought(
          [
            "That wrench should move before long.",
            "Somebody's going to need that wrench today.",
            "That pump leak is good for tool sales.",
          ],
          seed,
        );
      }
      return rotatingThought(
        [
          "Everything breaks eventually around here.",
          "You can hear bad metal before it shows.",
          "Most people want comfort, not the truth.",
        ],
        seed,
      );
    case "npc-tomas":
      if (recentlySpoke) {
        return rotatingThought(
          [
            "If Rowan shows up, keep him working.",
            "He sounded willing enough. We'll see.",
            "Talk is cheap. Lifting isn't.",
          ],
          seed,
        );
      }
      if (!yardJob?.accepted && hour < 13.5) {
        return rotatingThought(
          [
            "I need one more back today.",
            "The load is still a body short.",
            "This yard needs work, not excuses.",
          ],
          seed,
        );
      }
      if (yardJob?.accepted && !yardJob.completed) {
        return rotatingThought(
          [
            "I need the load moved, not excuses.",
            "If the crates are still sitting, talk failed.",
            "Keep the path clear and the lift steady.",
          ],
          seed,
        );
      }
      return rotatingThought(
        [
          "Weather won't lift these crates for me.",
          "The river never cares about our timing.",
          "If the carts slip, the whole yard backs up.",
        ],
        seed,
      );
    case "npc-nia":
      if (recentlySpoke) {
        return rotatingThought(
          [
            "Maybe Rowan sees the problem now.",
            "Let's see if Rowan catches it early.",
            "He might actually move before the crowd does.",
          ],
          seed,
        );
      }
      if (cartProblem?.discovered && cartProblem.status === "active") {
        return rotatingThought(
          [
            "That cart is going to jam the square.",
            "Somebody needs to move that cart early.",
            "That bad wheel is going to jam things up.",
          ],
          seed,
        );
      }
      return npc.currentLocationId === "moss-pier"
        ? rotatingThought(
            [
              "Watch the boats, not the gulls.",
              "The useful story comes off the boats first.",
              "The slip shows you tomorrow before noon does.",
            ],
            seed,
          )
        : rotatingThought(
            [
              "One rumor here is actually real.",
              "Watch where people start slowing down.",
              "The block always gives something away.",
            ],
            seed,
          );
    default:
      return sanitizeThought(
        firstPersonThought(
          npc.currentConcern ||
            narrative.context ||
            narrative.objective ||
            narrative.backstory.split(".")[0] ||
            "I need to keep moving.",
        ),
      );
  }
}

export function sanitizeThought(text: string) {
  const cleaned = normalizeStreetVoice(text.replace(/\s+/g, " ").trim());
  if (!cleaned) {
    return "Keep moving.";
  }

  const words = cleaned.split(" ").slice(0, 12).join(" ");
  return words.slice(0, 84);
}

function firstPersonThought(text: string) {
  return text
    .replace(/^Find\b/i, "I need to find")
    .replace(/^Learn\b/i, "I need to learn")
    .replace(/^Get\b/i, "I need to get")
    .replace(/^Buy\b/i, "I should buy")
    .replace(/^Fix\b/i, "I should fix")
    .replace(/^Clear\b/i, "I should clear")
    .replace(/^Finish\b/i, "I need to finish")
    .replace(/^Go\b/i, "I should go")
    .replace(/^Need\b/i, "I need")
    .replace(/^Could use\b/i, "I could use")
    .replace(/^Don't\b/i, "I can't");
}

function rotatingThought(options: string[], seed: number) {
  return sanitizeThought(options[Math.abs(seed) % options.length] ?? options[0] ?? "Keep moving.");
}

function thoughtSeed(game: StreetGameState, npc: NpcState) {
  return Math.floor(game.clock.totalMinutes / 12) + hashText(npc.id) + npc.trust * 7;
}

function minutesSinceLastInteraction(game: StreetGameState, npc: NpcState) {
  if (!npc.lastInteractionAt) {
    return Number.POSITIVE_INFINITY;
  }

  const currentTime = Date.parse(game.currentTime);
  const lastTime = Date.parse(npc.lastInteractionAt);
  if (Number.isNaN(currentTime) || Number.isNaN(lastTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((currentTime - lastTime) / 60000));
}

function hashText(text: string) {
  let hash = 0;

  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return hash;
}
