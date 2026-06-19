import type {
  LocationState,
  MemoryEntry,
  NpcState,
  ObjectiveOutcomeStatus,
  RowanAutonomyState,
  StreetGameState,
} from "../street-sim/types.js";
import { normalizeStreetVoice } from "./streetVoice.js";
import { getNpcNarrative } from "../street-sim/npcNarratives.js";
import { getMapLabelNarrative } from "../street-sim/placeNarratives.js";
import { buildRowanCognition } from "../sim/rowanCognition.js";
import {
  objectiveRouteConversationFallback,
  objectiveRouteFirstAfternoonWorkWindowDialogue,
  objectiveRouteJoMoneyWorkDialogue,
  objectiveRouteProblemDialogue,
} from "../sim/objectiveScaffolds.js";

export interface StreetDialogueRequest {
  game: StreetGameState;
  npcId: string;
  playerText: string;
}

export interface StreetDialogueResult {
  reply: string;
  followupThought?: string;
}

export interface StreetConversationContext {
  city: {
    name: string;
    context: string;
    backstory: string;
  };
  district: {
    name: string;
    context: string;
    backstory: string;
  };
  scene: {
    locationId?: string;
    name: string;
    type?: string;
    neighborhood?: string;
    description: string;
    context: string;
    backstory: string;
  };
  nearbyPlaces: Array<{
    id: string;
    name: string;
    type: string;
    neighborhood: string;
    description: string;
    context: string;
    backstory: string;
  }>;
  nearbyLandmarks: Array<{
    id: string;
    text: string;
    tone: "street" | "district" | "landmark";
    context?: string;
    backstory?: string;
    locationId?: string;
  }>;
  rowan: {
    name: string;
    backstory: string;
    objective: string;
    objectiveState?: {
      text: string;
      focus: string;
      routeKey: string;
      progress?: {
        completed: number;
        total: number;
        label: string;
      };
      outcomes: Array<{
        id: string;
        label: string;
        status: ObjectiveOutcomeStatus;
        urgency: number;
        blockers?: string[];
        evidence?: string;
        targetLocationId?: string;
        npcId?: string;
        actionId?: string;
      }>;
      trail: Array<{
        id: string;
        title: string;
        detail?: string;
        progress?: string;
        timestamp?: string;
        targetLocationId?: string;
        npcId?: string;
        actionId?: string;
        done?: boolean;
      }>;
      completedTrail: Array<{
        id: string;
        title: string;
        detail?: string;
        progress?: string;
        timestamp?: string;
        done?: boolean;
      }>;
    };
    availableActions: Array<{
      id: string;
      label: string;
      description: string;
      kind: string;
      matchesObjective?: boolean;
      disabled?: boolean;
      disabledReason?: string;
      targetLocationId?: string;
      targetAnchorId?: string;
      spaceId?: string;
    }>;
    autonomy: Pick<
      RowanAutonomyState,
      | "actionId"
      | "autoContinue"
      | "detail"
      | "intent"
      | "key"
      | "label"
      | "layer"
      | "mode"
      | "npcId"
      | "stepKind"
      | "targetLocationId"
    >;
    currentThought?: string;
    money: number;
    energy: number;
    cognition: ReturnType<typeof buildRowanCognition>;
    memories: Array<{
      id: string;
      kind: MemoryEntry["kind"];
      text: string;
    }>;
  };
  npc: {
    id: string;
    name: string;
    role: string;
    summary: string;
    narrative: ReturnType<typeof getNpcNarrative>;
    trust: number;
    openness: number;
    mood: string;
    currentObjective: string;
    currentConcern: string;
    currentThought?: string;
    lastSpokenLine?: string;
    memory: string[];
  };
  thread: {
    id: string;
    npcId: string;
    updatedAt: string;
    decision?: string;
    objectiveText?: string;
    summary?: string;
    turnCount: number;
    recentPlayerLines: Array<{
      id: string;
      time: string;
      speaker: "player";
      speakerName: string;
      text: string;
    }>;
    recentNpcLines: Array<{
      id: string;
      time: string;
      speaker: "npc";
      speakerName: string;
      text: string;
    }>;
    lines: Array<{
      id: string;
      time: string;
      speaker: "player" | "npc";
      speakerName: string;
      text: string;
    }>;
  };
  recentConversation: Array<{
    id: string;
    time: string;
    speaker: "player" | "npc";
    speakerName: string;
    text: string;
  }>;
  time: {
    day: number;
    hour: number;
    minute: number;
    label: string;
  };
}

type ConversationObjectiveOutcome =
  NonNullable<StreetConversationContext["rowan"]["objectiveState"]>["outcomes"][number];

export function buildStreetConversationContext(
  input: StreetDialogueRequest,
): StreetConversationContext {
  const npc = input.game.npcs.find((entry) => entry.id === input.npcId);
  const thread = buildConversationThread(input.game, input.npcId);
  const location = currentConversationLocation(input.game, npc, thread.locationId);
  const nearbyPlaces = buildNearbyPlaces(input.game, location);
  const nearbyLandmarks = buildNearbyLandmarks(input.game, location, nearbyPlaces);
  const cognition = buildRowanCognition(input.game);

  return {
    city: {
      name: input.game.cityName,
      context: input.game.cityNarrative.context,
      backstory: input.game.cityNarrative.backstory,
    },
    district: {
      name: input.game.districtName,
      context: input.game.districtNarrative.context,
      backstory: input.game.districtNarrative.backstory,
    },
    scene: location
      ? {
          locationId: location.id,
          name: location.name,
          type: location.type,
          neighborhood: location.neighborhood,
          description: location.description,
          context: location.context,
          backstory: location.backstory,
        }
      : {
          name: input.game.districtName,
          description:
            "Brick, puddles, shop shutters, and people who look busy enough that you have to decide whether to stop them anyway.",
          context: input.game.districtNarrative.context,
          backstory: input.game.districtNarrative.backstory,
        },
    nearbyPlaces,
    nearbyLandmarks,
    rowan: {
      name: input.game.player.name,
      backstory: input.game.player.backstory,
      objective: input.game.player.objective?.text ?? "none",
      objectiveState: input.game.player.objective
        ? {
            text: input.game.player.objective.text,
            focus: input.game.player.objective.focus,
            routeKey: input.game.player.objective.routeKey,
            progress: input.game.player.objective.progress,
            outcomes: input.game.player.objective.outcomes,
            trail: input.game.player.objective.trail,
            completedTrail: input.game.player.objective.completedTrail.slice(-8),
          }
        : undefined,
      currentThought: input.game.player.currentThought,
      money: input.game.player.money,
      energy: input.game.player.energy,
      cognition,
      availableActions: input.game.availableActions.map((action) => ({
        id: action.id,
        label: action.label,
        description: action.description,
        kind: action.kind,
        matchesObjective: action.matchesObjective,
        disabled: action.disabled,
        disabledReason: action.disabledReason,
        targetLocationId: action.targetLocationId,
        targetAnchorId: action.targetAnchorId,
        spaceId: action.spaceId,
      })),
      autonomy: {
        actionId: input.game.rowanAutonomy.actionId,
        autoContinue: input.game.rowanAutonomy.autoContinue,
        detail: input.game.rowanAutonomy.detail,
        intent: input.game.rowanAutonomy.intent,
        key: input.game.rowanAutonomy.key,
        label: input.game.rowanAutonomy.label,
        layer: input.game.rowanAutonomy.layer,
        mode: input.game.rowanAutonomy.mode,
        npcId: input.game.rowanAutonomy.npcId,
        stepKind: input.game.rowanAutonomy.stepKind,
        targetLocationId: input.game.rowanAutonomy.targetLocationId,
      },
      memories: selectRelevantMemories(input.game, location, npc),
    },
    npc: npc
      ? {
          id: npc.id,
          name: npc.name,
          role: npc.role,
          summary: npc.summary,
          narrative: getNpcNarrative(npc.id),
          trust: npc.trust,
          openness: npc.openness,
          mood: npc.mood,
          currentObjective: npc.currentObjective,
          currentConcern: npc.currentConcern,
          currentThought: npc.currentThought,
          lastSpokenLine: npc.lastSpokenLine,
          memory: npc.memory.slice(0, 6),
        }
      : {
          id: input.npcId,
          name: "unknown",
          role: "unknown",
          summary: "",
          narrative: getNpcNarrative(input.npcId),
          trust: 0,
          openness: 0,
          mood: "unknown",
          currentObjective: "",
          currentConcern: "",
          memory: [],
        },
    thread,
    recentConversation: thread.lines.slice(-6),
    time: {
      day: input.game.clock.day,
      hour: input.game.clock.hour,
      minute: input.game.clock.minute,
      label: input.game.clock.label,
    },
  };
}

export function buildDeterministicStreetReply(
  input: StreetDialogueRequest,
): StreetDialogueResult {
  const context = buildStreetConversationContext(input);
  const npc = input.game.npcs.find((entry) => entry.id === input.npcId);
  if (!npc) {
    return {
      reply: "I have nothing for you right now.",
      followupThought: "That went nowhere.",
    };
  }

  const topics = detectTopics(input.playerText);
  const yardJob = input.game.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = input.game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = input.game.problems.find((problem) => problem.id === "problem-cart");
  const hasWrench = input.game.player.inventory.some((item) => item.id === "item-wrench");
  const nearbyPlaceName = context.nearbyPlaces[0]?.name;
  const currentNpcObjectiveOutcome = selectCurrentNpcObjectiveOutcome(context, npc.id);

  switch (npc.id) {
    case "npc-mara":
      if (topics.has("pump") || topics.has("help")) {
        return {
          reply: pumpProblem?.status === "solved"
            ? chooseConversationLine(
                [
                  "That's much nicer. Little fixes make a house feel easier to come home to.",
                  "That held. People notice when the morning runs smoother.",
                  "You handled the yard. Good. Have a breath before you go looking for the next thing.",
                ],
                context,
                "mara-pump-solved",
              )
            : chooseConversationLine(
                [
                  `Start with the pump in the yard. ${nearbyPlaceName ? "It's close, and everyone uses it." : "It is a small thing, but everyone feels it."}`,
                  "The yard pump has been leaking all morning. Take a look there if you want an easy way to help.",
                  "The pump in the yard needs fixing. It is not exciting, but the house will notice.",
                ],
                context,
                "mara-pump-help",
              ),
          followupThought: pickFollowupThought(
            [
              "That was a good ask.",
              "A small start is enough.",
              "He has somewhere simple to begin.",
            ],
            context,
            "mara-pump-followup",
          ),
        };
      }

      if (topics.has("work") || topics.has("money")) {
        const routeReply = objectiveRouteFirstAfternoonWorkWindowDialogue(
          input.game,
          input.game.player.objective,
          npc,
          "maraWork",
        );
        if (routeReply) {
          return buildRouteDialogueResult(routeReply, context);
        }
      }

      if (topics.has("home") || topics.has("rent")) {
        const routeReply = objectiveRouteFirstAfternoonWorkWindowDialogue(
          input.game,
          input.game.player.objective,
          npc,
          "maraHome",
        );
        if (routeReply) {
          return buildRouteDialogueResult(routeReply, context);
        }
      }

      if (currentNpcObjectiveOutcome && !topicsRequestSpecificLead(topics)) {
        return buildMaraCurrentObjectiveReply(currentNpcObjectiveOutcome, context);
      }

      const routeFallback = objectiveRouteConversationFallback(
        input.game,
        input.game.player.objective,
        npc,
      );
      if (routeFallback) {
        return {
          reply: chooseConversationLine(
            routeFallback.replyLines,
            context,
            routeFallback.choiceKey,
          ),
          followupThought: pickFollowupThought(
            routeFallback.followupThoughts,
            context,
            routeFallback.followupChoiceKey,
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "Take a slow lap of South Quay. Start with the places that are already open.",
            "Do one small useful thing and come back. That is usually enough to start.",
            "Keep your eyes open and ask plain questions. People here answer better that way.",
          ],
          context,
          "mara-default",
        ),
        followupThought: pickFollowupThought(
          [
            "He sounded less lost that time.",
            "Maybe the quay will be kind.",
            "One calm step, then another.",
          ],
          context,
          "mara-default-followup",
        ),
      };
    case "npc-ada":
      if (topics.has("work") || topics.has("money")) {
        const workWindowReply =
          objectiveRouteFirstAfternoonWorkWindowDialogue(
            input.game,
            input.game.player.objective,
            npc,
            "adaWork",
          );
        if (workWindowReply) {
          return buildRouteDialogueResult(workWindowReply, context);
        }

        const yardHandoffReply =
          objectiveRouteFirstAfternoonWorkWindowDialogue(
            input.game,
            input.game.player.objective,
            npc,
            "adaYardHandoff",
          );
        if (yardHandoffReply) {
          return buildRouteDialogueResult(yardHandoffReply, context);
        }
      }

      if (topics.has("gossip")) {
        return {
          reply: chooseConversationLine(
            [
              "Buy a cup and I will give you the short version.",
              "Gossip is better with tea. Terrible business model, lovely habit.",
              "If it is gossip, at least let me pour something warm while I say it.",
            ],
            context,
            "ada-gossip",
          ),
          followupThought: pickFollowupThought(
            [
              "Tea makes gossip civilized.",
              "Keep the room light.",
              "A cup buys a minute.",
            ],
            context,
            "ada-gossip-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "If you're staying, look for the table that needs clearing and start there.",
            "New hands are fine. Just ask once, then keep the cups moving.",
            "If you want to help, clear the nearest table and bring the cups to the counter.",
          ],
          context,
          "ada-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Keep the cups moving.",
            "Keep the room light.",
            "The room will teach him.",
          ],
          context,
          "ada-default-followup",
        ),
      };
    case "npc-jo":
      if (topics.has("tool") || topics.has("repair") || topics.has("pump")) {
        const routeReply = objectiveRouteProblemDialogue(
          input.game,
          input.game.player.objective,
          npc,
          hasWrench ? "joToolOwned" : "joToolSell",
        );
        if (routeReply) {
          return buildRouteDialogueResult(routeReply, context);
        }
      }

      if (topics.has("money") || topics.has("work")) {
        return buildRouteDialogueResult(
          objectiveRouteJoMoneyWorkDialogue({ nearbyPlaceName }),
          context,
        );
      }

      return {
        reply: chooseConversationLine(
          [
            "If it's bent, I say so. If it still has life in it, I say that too.",
            "Most things here need patience before they need replacing.",
            "I sell straight answers and small repairs. The opinions come free.",
          ],
          context,
          "jo-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Don't dress it up.",
            "Keep it easy.",
            "Say the plain thing.",
          ],
          context,
          "jo-default-followup",
        ),
      };
    case "npc-tomas":
      if (
        (topics.has("help") || topics.has("next_step")) &&
        yardJob?.discovered &&
        !yardJob.accepted &&
        !yardJob.completed &&
        !yardJob.missed
      ) {
        const workWindowReply =
          objectiveRouteFirstAfternoonWorkWindowDialogue(
            input.game,
            input.game.player.objective,
            npc,
            "tomasYardNextStep",
          );
        if (workWindowReply) {
          return buildRouteDialogueResult(workWindowReply, context);
        }
      }

      if (
        topics.has("work") ||
        topics.has("money") ||
        topics.has("yard") ||
        topics.has("next_step")
      ) {
        const workWindowReply =
          objectiveRouteFirstAfternoonWorkWindowDialogue(
            input.game,
            input.game.player.objective,
            npc,
            "tomasYardWork",
          );
        if (workWindowReply) {
          return buildRouteDialogueResult(workWindowReply, context);
        }

        return {
          reply: chooseConversationLine(
            [
              "If you're here to work, I can use you. If not, stand where the carts can get by.",
              "You can ask while we walk. The only rule is to keep the lane clear.",
              "Stay clear of the handcart lane and I will point you to the next crate.",
            ],
            context,
            "tomas-work-active",
          ),
          followupThought: pickFollowupThought(
            [
              "Keep the load moving.",
              "Simple work, simple day.",
              "Almost charming is enough.",
            ],
            context,
            "tomas-work-active-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "Ask while we walk. If you want to help, start by keeping the handcart lane clear.",
            "You can talk, just stay out of the cart lane. That is the useful thing right now.",
            "If you want the easiest first step, keep the path clear and I will point you at the next crate.",
          ],
          context,
          "tomas-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Keep the yard moving.",
            "Keep the lane clear.",
            "Simple enough.",
          ],
          context,
          "tomas-default-followup",
        ),
      };
    case "npc-nia":
      if (topics.has("rumor") || topics.has("gossip")) {
        return {
          reply: chooseConversationLine(
            [
              "The good rumors come with a place, an hour, and somebody who saw it happen.",
              "Most rumors are just noise. The useful ones come with details.",
              "Rumors only matter when they point somewhere you can actually check.",
            ],
            context,
            "nia-rumor",
          ),
          followupThought: pickFollowupThought(
            [
              "Time and place matter.",
              "Details over drama.",
              "That one has a breeze to it.",
            ],
            context,
            "nia-rumor-followup",
          ),
        };
      }

      if (topics.has("cart") || topics.has("help")) {
        const routeReply = objectiveRouteProblemDialogue(
          input.game,
          input.game.player.objective,
          npc,
          cartProblem?.status === "solved" ? "niaCartSolved" : "niaCartActive",
        );
        if (routeReply) {
          return buildRouteDialogueResult(routeReply, context);
        }
      }

      return {
        reply: chooseConversationLine(
          [
            "You learn this part of town by watching where people pause and who they listen to.",
            "Watch where traffic bunches up. Crowds show you where something wants a little help.",
            "Pay attention to the slow spots. South Quay usually explains itself there.",
          ],
          context,
          "nia-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Watch where people pause.",
            "The good clue is usually small.",
            "Slow spots give things away.",
          ],
          context,
          "nia-default-followup",
        ),
      };
    default:
      return {
        reply: chooseConversationLine(
          [
            "Same as anybody else here: take the day one cup at a time.",
            "If you need something, ask it plain.",
            "I'm just trying to keep the afternoon pleasant.",
          ],
          context,
          `${npc.id}-default`,
        ),
        followupThought: pickFollowupThought(
          [
            context.npc.narrative.objective || context.npc.narrative.backstory,
            context.npc.narrative.context,
            context.scene.context,
          ],
          context,
          `${npc.id}-default-followup`,
        ),
      };
  }
}

export function streetDialogueCacheKey(
  input: StreetDialogueRequest,
): string {
  const context = buildStreetConversationContext(input);

  return JSON.stringify({
    npcId: input.npcId,
    playerText: normalizePlayerText(input.playerText),
    timeBucket: Math.floor(input.game.clock.totalMinutes / 15),
    context,
  });
}

export function sanitizeDialogueReply(text: string, npcName?: string): string {
  const cleaned = normalizeNpcSelfReference(
    normalizeStreetVoice(text.replace(/\s+/g, " ").trim()),
    npcName,
  );
  if (!cleaned) {
    return "I don't have much to add.";
  }

  const maxChars = 320;
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const withinLimit = cleaned.slice(0, maxChars).trimEnd();
  const sentenceEndings = [...withinLimit.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentenceEnding = sentenceEndings.at(-1)?.index;
  if (
    typeof lastSentenceEnding === "number" &&
    lastSentenceEnding >= Math.floor(maxChars * 0.55)
  ) {
    return withinLimit.slice(0, lastSentenceEnding + 1).trimEnd();
  }

  const lastSpace = withinLimit.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(maxChars * 0.7)
      ? withinLimit.slice(0, lastSpace)
      : withinLimit;
  const trimmedBase = base.replace(/[.,!?;:]+$/, "").trimEnd();
  return `${trimmedBase || withinLimit}...`;
}

export function sanitizeThought(text: string): string {
  const cleaned = normalizeStreetVoice(text.replace(/\s+/g, " ").trim());
  if (!cleaned) {
    return "Keep moving.";
  }

  const words = cleaned.split(" ").filter(Boolean);
  const limitedWords = words.slice(0, 12);
  const wordLimited = limitedWords.join(" ");
  const hitWordLimit = limitedWords.length < words.length;

  if (wordLimited.length <= 84 && !hitWordLimit) {
    return wordLimited;
  }

  const charLimited = wordLimited.slice(0, 84).trimEnd();
  const lastSpace = charLimited.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(charLimited.length * 0.55)
      ? charLimited.slice(0, lastSpace)
      : charLimited;
  const trimmedBase = base.replace(/[.,!?;:]+$/, "").trimEnd();

  return `${trimmedBase || charLimited.replace(/[.,!?;:]+$/, "").trimEnd()}...`;
}

export function generatedReplyLooksInvalid(
  text: string,
  input: StreetDialogueRequest,
): boolean {
  const normalized = normalizeText(text);
  if (!normalized) {
    return true;
  }

  const npcName = input.game.npcs.find((npc) => npc.id === input.npcId)?.name;
  const normalizedNpcName = npcName ? normalizeText(npcName) : "";

  if (
    /\b(i am|i'm|im)\s+rowan\b/.test(normalized) ||
    /\bmy name is rowan\b/.test(normalized)
  ) {
    return true;
  }

  if (generatedReplyHasToneDrift(normalized)) {
    return true;
  }

  if (normalizedNpcName) {
    const npcNamePattern = new RegExp(`\\b${escapeRegExp(normalizedNpcName)}\\b`, "i");
    if (npcNamePattern.test(normalized)) {
      return true;
    }
  }

  const plannerTexts = collectPlannerReferenceTexts(input);
  const soundsDirectiveLike = /^(talk|ask|tell|show|see|get|go|head|stay|keep|leave|swing|decide|finish|buy|fix|clear|make|take)\b/.test(
    normalized,
  );
  if (
    soundsDirectiveLike &&
    plannerTexts.some(
      (candidate) => overlapRatio(normalized, normalizeText(candidate)) >= 0.68,
    )
  ) {
    return true;
  }

  return false;
}

function generatedReplyHasToneDrift(normalized: string): boolean {
  return [
    /\baye\b/,
    /\blass(?:ie)?\b/,
    /\bladdie\b/,
    /\bye\b/,
    /\bempty apron\b/,
    /\bsun tables?\b/,
    /\bprep shelf\b/,
    /\bfetch(?:ing)?\b.*\btins?\b/,
    /\bgrab(?:bing)?\b.*\bpeg\b/,
    /\bkeep an eye on the bell\b/,
  ].some((pattern) => pattern.test(normalized));
}

function normalizePlayerText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function selectCurrentNpcObjectiveOutcome(
  context: StreetConversationContext,
  npcId: string,
): ConversationObjectiveOutcome | undefined {
  return context.rowan.objectiveState?.outcomes
    .filter(
      (outcome) =>
        outcome.status === "open" &&
        outcome.npcId === npcId &&
        !outcome.id.startsWith("first-afternoon"),
    )
    .sort((left, right) => right.urgency - left.urgency)[0];
}

function topicsRequestSpecificLead(topics: Set<string>): boolean {
  return [
    "cart",
    "gossip",
    "help",
    "money",
    "pump",
    "repair",
    "rumor",
    "tool",
    "work",
    "yard",
  ].some((topic) => topics.has(topic));
}

function buildMaraCurrentObjectiveReply(
  outcome: ConversationObjectiveOutcome,
  context: StreetConversationContext,
): StreetDialogueResult {
  const normalizedLabel = normalizeText(
    `${outcome.label} ${outcome.evidence ?? ""} ${(outcome.blockers ?? []).join(" ")}`,
  );
  const isRoomStanding =
    /\broom\b|\bmorrow house\b|\bstable\b|\bstanding\b|\bbed\b|\bstay\b/.test(
      normalizedLabel,
    );

  return {
    reply: chooseConversationLine(
      isRoomStanding
        ? [
            "Keeping the room is less dramatic than finding it. Pay when you say you will, be kind in the shared spaces, and do one useful thing before the day gets away from you.",
            "A room turns steady when you make the house easier to wake up in. Keep your word, keep the shared spaces kind, and notice what needs doing.",
            "Morrow House keeps people who are plain with their money and useful without making a ceremony of it.",
          ]
        : [
            "Start with the question that is true right here. Ask it plainly, then use the answer you actually get.",
            "Do the thing you can verify from this room first. The rest can wait until the answer is real.",
            "If that is the question in front of you, do not chase an old errand. Ask it here and let the answer change the next step.",
          ],
      context,
      isRoomStanding ? "mara-current-room-objective" : "mara-current-objective",
    ),
    followupThought: pickFollowupThought(
      isRoomStanding
        ? [
            "The room has terms.",
            "Make the house easier.",
            "That answer fits now.",
          ]
        : [
            "Ask what is true here.",
            "Use the live answer.",
            "Do not chase old hints.",
          ],
      context,
      isRoomStanding
        ? "mara-current-room-objective-followup"
        : "mara-current-objective-followup",
    ),
  };
}

function buildRouteDialogueResult(
  routeReply: {
    choiceKey: string;
    followupChoiceKey: string;
    followupThoughts: string[];
    replyLines: string[];
  },
  context: StreetConversationContext,
): StreetDialogueResult {
  return {
    reply: chooseConversationLine(
      routeReply.replyLines,
      context,
      routeReply.choiceKey,
    ),
    followupThought: pickFollowupThought(
      routeReply.followupThoughts,
      context,
      routeReply.followupChoiceKey,
    ),
  };
}

function detectTopics(text: string): Set<string> {
  const normalized = normalizePlayerText(text);
  const topics = new Set<string>();

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b|\bhands?\b|\bhire\b|\bhiring\b/.test(normalized)) {
    topics.add("work");
    topics.add("money");
  }

  if (
    /\bhelp\b|\bfix\b|\brepair\b|\bsolve\b|\bhandle\b|\banything i can do\b|\bwhat needs doing\b|\bneed doing\b|\bchores?\b/.test(
      normalized,
    )
  ) {
    topics.add("help");
  }

  if (/\bfix\b|\brepair\b|\bsolve\b|\bhandle\b|\bpump\b|\bleak\b/.test(normalized)) {
    topics.add("repair");
  }

  if (
    /\bwhat\b.*\b(first|next|start)\b|\bwhere\b.*\b(start|begin)\b|\beasiest\b.*\b(first|start|begin|helpful)\b|\bdo first\b|\bstart with\b|\bbegin with\b/.test(
      normalized,
    )
  ) {
    topics.add("next_step");
  }

  if (/\bpump\b|\bleak\b/.test(normalized)) {
    topics.add("pump");
  }

  if (/\bwrench\b|\btool\b|\btools\b/.test(normalized)) {
    topics.add("tool");
  }

  if (/\brent\b|\broom\b|\bhome\b|\bhouse\b|\bstay\b|\blodg/.test(normalized)) {
    topics.add("home");
    topics.add("rent");
  }

  if (/\brumou?rs?\b|\bgossip\b|\bhear\b|\bnews\b/.test(normalized)) {
    topics.add("rumor");
    topics.add("gossip");
  }

  if (/\bcart\b|\bsquare\b|\bmarket\b/.test(normalized)) {
    topics.add("cart");
  }

  if (/\byard\b|\bcrane\b|\bload\b|\bcrate\b/.test(normalized)) {
    topics.add("yard");
  }

  return topics;
}

function currentConversationLocation(
  game: StreetGameState,
  npc: NpcState | undefined,
  threadLocationId?: string,
) {
  const locationById = new Map(
    game.locations.map((location) => [location.id, location] as const),
  );

  return threadLocationId
    ? locationById.get(threadLocationId)
    : npc?.currentLocationId
    ? locationById.get(npc.currentLocationId)
    : game.player.currentLocationId
      ? locationById.get(game.player.currentLocationId)
      : undefined;
}

function buildConversationThread(
  game: StreetGameState,
  npcId: string,
) {
  const threadId = threadIdForNpc(npcId);
  const existing = game.conversationThreads?.[npcId];
  if (existing) {
    return {
      id: existing.id,
      npcId: existing.npcId,
      updatedAt: existing.updatedAt,
      locationId: existing.locationId,
      decision: existing.decision,
      objectiveText: existing.objectiveText,
      summary: existing.summary,
      turnCount: existing.lines.length,
      recentPlayerLines: existing.lines
        .filter((entry) => entry.speaker === "player")
        .slice(-3)
        .map((entry) => ({
          id: entry.id,
          time: entry.time,
          speaker: "player" as const,
          speakerName: entry.speakerName,
          text: entry.text,
        })),
      recentNpcLines: existing.lines
        .filter((entry) => entry.speaker === "npc")
        .slice(-3)
        .map((entry) => ({
          id: entry.id,
          time: entry.time,
          speaker: "npc" as const,
          speakerName: entry.speakerName,
          text: entry.text,
        })),
      lines: existing.lines.slice(-8).map((entry) => ({
        id: entry.id,
        time: entry.time,
        speaker: entry.speaker,
        speakerName: entry.speakerName,
        text: entry.text,
      })),
    };
  }

  const recentEntries = game.conversations
    .filter((entry) => entry.npcId === npcId)
    .slice(-8);
  const recentConversation = recentEntries.map((entry) => ({
      id: entry.id,
      time: entry.time,
      speaker: entry.speaker,
      speakerName: entry.speakerName,
      text: entry.text,
    }));

  return {
    id: threadId,
    npcId,
    updatedAt: game.currentTime,
    locationId: recentEntries[recentEntries.length - 1]?.locationId,
    turnCount: recentConversation.length,
    recentPlayerLines: recentConversation
      .filter((entry) => entry.speaker === "player")
      .slice(-3)
      .map((entry) => ({
        id: entry.id,
        time: entry.time,
        speaker: "player" as const,
        speakerName: entry.speakerName,
        text: entry.text,
      })),
    recentNpcLines: recentConversation
      .filter((entry) => entry.speaker === "npc")
      .slice(-3)
      .map((entry) => ({
        id: entry.id,
        time: entry.time,
        speaker: "npc" as const,
        speakerName: entry.speakerName,
        text: entry.text,
      })),
    lines: recentConversation,
  };
}

function buildNearbyPlaces(
  game: StreetGameState,
  currentLocation: LocationState | undefined,
) {
  if (!currentLocation) {
    return [];
  }

  return game.locations
    .filter(
      (location) =>
        location.id === currentLocation.id ||
        location.neighborhood === currentLocation.neighborhood,
    )
    .slice(0, 4)
    .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
      neighborhood: location.neighborhood,
      description: location.description,
      context: location.context,
      backstory: location.backstory,
    }));
}

function buildNearbyLandmarks(
  game: StreetGameState,
  currentLocation: LocationState | undefined,
  nearbyPlaces: Array<{ id: string }>,
) {
  const nearbyPlaceIds = new Set(nearbyPlaces.map((place) => place.id));
  return game.map.labels
    .filter(
      (label) =>
        label.locationId !== undefined &&
        (nearbyPlaceIds.has(label.locationId) ||
          label.locationId === currentLocation?.id),
    )
    .slice(0, 4)
    .map((label) => ({
      id: label.id,
      text: label.text,
      tone: label.tone,
      context: label.context ?? getMapLabelNarrative(label.id).context,
      backstory: label.backstory ?? getMapLabelNarrative(label.id).backstory,
      locationId: label.locationId,
    }));
}

function selectRelevantMemories(
  game: StreetGameState,
  location: LocationState | undefined,
  npc: NpcState | undefined,
) {
  const contextWords = [
    location?.name,
    location?.neighborhood,
    npc?.name,
    npc?.role,
    game.player.objective?.text,
    game.cityName,
    game.districtName,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return game.player.memories
    .map((memory) => ({
      memory,
      score:
        (contextWords.some((word) => memory.text.toLowerCase().includes(word)) ? 2 : 0) +
        (memory.kind === "place" ? 1 : 0) +
        (memory.kind === "person" ? 1 : 0) +
        (memory.kind === "problem" ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ memory }) => ({
      id: memory.id,
      kind: memory.kind,
      text: memory.text,
    }));
}

function threadIdForNpc(npcId: string) {
  return `conversation-thread-${npcId}`;
}

function chooseConversationLine(
  options: string[],
  context: StreetConversationContext,
  salt: string,
) {
  if (options.length === 0) {
    return "I don't have much to add.";
  }

  const recentNpcLines = context.thread.recentNpcLines.map((entry) => entry.text);
  const historyText = recentNpcLines.map(normalizeText).join(" ");
  const scored = options.map((option, index) => {
    const candidate = sanitizeDialogueReply(option, context.npc.name);
    const normalizedCandidate = normalizeText(candidate);
    const overlapPenalty = repeatedWordPenalty(normalizedCandidate, historyText);
    const exactRepeatPenalty = recentNpcLines.some(
      (entry) => normalizeText(entry) === normalizedCandidate,
    )
      ? 9
      : 0;
    const turnSeed = hashText(`${context.thread.id}:${salt}:${index}:${context.thread.turnCount}`);
    const tieBreak = (turnSeed % 11) / 100;

    return {
      candidate,
      score: -overlapPenalty - exactRepeatPenalty + tieBreak,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.candidate ?? sanitizeDialogueReply(options[0], context.npc.name);
}

function normalizeNpcSelfReference(text: string, npcName?: string) {
  if (!npcName) {
    return text;
  }

  const escapedName = escapeRegExp(npcName);

  return text
    .replace(new RegExp(`\\b${escapedName} is\\b`, "g"), "I am")
    .replace(new RegExp(`\\b${escapedName} was\\b`, "g"), "I was")
    .replace(new RegExp(`\\b${escapedName} has\\b`, "g"), "I have")
    .replace(new RegExp(`\\b${escapedName} had\\b`, "g"), "I had")
    .replace(new RegExp(`\\b${escapedName} needs\\b`, "g"), "I need")
    .replace(new RegExp(`\\b${escapedName} need\\b`, "g"), "I need")
    .replace(new RegExp(`\\b${escapedName} wants\\b`, "g"), "I want")
    .replace(new RegExp(`\\b${escapedName} want\\b`, "g"), "I want")
    .replace(new RegExp(`\\b${escapedName} keeps\\b`, "g"), "I keep")
    .replace(new RegExp(`\\b${escapedName} keep\\b`, "g"), "I keep")
    .replace(new RegExp(`\\b${escapedName} knows\\b`, "g"), "I know")
    .replace(new RegExp(`\\b${escapedName} know\\b`, "g"), "I know")
    .replace(new RegExp(`\\b${escapedName} can\\b`, "g"), "I can")
    .replace(new RegExp(`\\b${escapedName} can't\\b`, "g"), "I can't")
    .replace(new RegExp(`\\b${escapedName} will\\b`, "g"), "I will")
    .replace(new RegExp(`\\b${escapedName} won't\\b`, "g"), "I won't")
    .replace(new RegExp(`\\b${escapedName} should\\b`, "g"), "I should")
    .replace(new RegExp(`\\b${escapedName} does\\b`, "g"), "I do")
    .replace(new RegExp(`\\b${escapedName} doesn't\\b`, "g"), "I don't")
    .replace(new RegExp(`\\b${escapedName}'s\\b`, "g"), "my")
    .replace(/\bI am am\b/g, "I am")
    .replace(/\bI have have\b/g, "I have")
    .replace(/\bI need need\b/g, "I need")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectPlannerReferenceTexts(input: StreetDialogueRequest) {
  const objective = input.game.player.objective;
  const references = [
    objective?.text,
    ...(objective?.outcomes.map((outcome) => outcome.label) ?? []),
    ...(objective?.outcomes.map((outcome) => outcome.evidence ?? "") ?? []),
    ...(objective?.outcomes.flatMap((outcome) => outcome.blockers ?? []) ?? []),
    input.game.rowanAutonomy.intent?.reason,
    input.game.rowanAutonomy.detail,
    input.game.rowanAutonomy.planningTrace?.selectedLabel,
    ...(objective?.completedTrail.map((step) => step.title) ?? []),
  ];

  const thread = input.game.conversationThreads?.[input.npcId];
  if (thread) {
    references.push(thread.decision, thread.objectiveText, thread.summary);
  }

  return references
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());
}

function overlapRatio(left: string, right: string) {
  const leftWords = new Set(left.split(/\s+/).filter(Boolean));
  const rightWords = new Set(right.split(/\s+/).filter(Boolean));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftWords.size, rightWords.size);
}

function pickFollowupThought(
  options: string[],
  context: StreetConversationContext,
  salt: string,
) {
  if (options.length === 0) {
    return sanitizeThought("Keep moving.");
  }

  const recentThoughts = [
    ...context.thread.recentNpcLines.map((entry) => entry.text),
    ...context.thread.recentPlayerLines.map((entry) => entry.text),
  ].map((entry) => normalizeText(entry));
  const scored = options.map((option, index) => {
    const candidate = sanitizeThought(option);
    const normalizedCandidate = normalizeText(candidate);
    const overlapPenalty = repeatedWordPenalty(normalizedCandidate, recentThoughts.join(" "));
    const exactRepeatPenalty = recentThoughts.some(
      (entry) => entry === normalizedCandidate,
    )
      ? 7
      : 0;
    const turnSeed = hashText(`${context.thread.id}:${salt}:${index}:${context.thread.turnCount}`);
    const tieBreak = (turnSeed % 13) / 100;

    return {
      candidate,
      score: -overlapPenalty - exactRepeatPenalty + tieBreak,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.candidate ?? sanitizeThought(options[0]);
}

function repeatedWordPenalty(candidate: string, historyText: string) {
  if (!candidate || !historyText) {
    return 0;
  }

  const candidateWords = contentWords(candidate);
  const historyWords = new Set(contentWords(historyText));
  let overlap = 0;

  for (const word of candidateWords) {
    if (historyWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap * 2;
}

function contentWords(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function hashText(text: string) {
  let hash = 0;

  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return hash;
}

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "about",
  "there",
  "their",
  "what",
  "when",
  "where",
  "should",
  "could",
  "would",
  "have",
  "will",
  "your",
  "into",
  "then",
  "them",
  "they",
  "keep",
  "need",
  "just",
  "still",
  "more",
  "some",
  "only",
  "onto",
  "here",
  "does",
  "did",
  "for",
  "the",
  "and",
  "you",
  "are",
  "not",
  "but",
  "out",
  "who",
  "why",
  "how",
  "all",
  "any",
  "too",
  "far",
]);
