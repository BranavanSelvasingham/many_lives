import type {
  LocationState,
  MemoryEntry,
  NpcState,
  StreetGameState,
} from "../street-sim/types.js";
import { normalizeStreetVoice } from "./streetVoice.js";
import { getNpcNarrative } from "../street-sim/npcNarratives.js";
import { getMapLabelNarrative } from "../street-sim/placeNarratives.js";

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
      trail: Array<{
        id: string;
        title: string;
        detail?: string;
        progress?: string;
        timestamp?: string;
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
    currentThought?: string;
    money: number;
    energy: number;
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

export function buildStreetConversationContext(
  input: StreetDialogueRequest,
): StreetConversationContext {
  const npc = input.game.npcs.find((entry) => entry.id === input.npcId);
  const thread = buildConversationThread(input.game, input.npcId);
  const location = currentConversationLocation(input.game, npc, thread.locationId);
  const nearbyPlaces = buildNearbyPlaces(input.game, location);
  const nearbyLandmarks = buildNearbyLandmarks(input.game, location, nearbyPlaces);

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
            trail: input.game.player.objective.trail,
            completedTrail: input.game.player.objective.completedTrail.slice(-8),
          }
        : undefined,
      currentThought: input.game.player.currentThought,
      money: input.game.player.money,
      energy: input.game.player.energy,
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
  const teaJob = input.game.jobs.find((job) => job.id === "job-tea-shift");
  const yardJob = input.game.jobs.find((job) => job.id === "job-yard-shift");
  const pumpProblem = input.game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = input.game.problems.find((problem) => problem.id === "problem-cart");
  const hasWrench = input.game.player.inventory.some((item) => item.id === "item-wrench");
  const nearbyPlaceName = context.nearbyPlaces[0]?.name;

  switch (npc.id) {
    case "npc-mara":
      if (topics.has("pump") || (topics.has("help") && pumpProblem?.discovered)) {
        return {
          reply: pumpProblem?.status === "solved"
            ? chooseConversationLine(
                [
                  "You already did right by the house. Keep that habit.",
                  "That work held. Keep showing up like that.",
                  "You handled the yard. Don't waste the momentum.",
                ],
                context,
                "mara-pump-solved",
              )
            : chooseConversationLine(
              [
                  `Start with the pump in the yard. ${nearbyPlaceName ? "That place still needs a hand." : "Fix shared trouble and this house notices."}`,
                  "Start with the pump in the yard. That's the piece that matters.",
                  "The yard wants the pump fixed before anything else gets louder.",
                ],
                context,
                "mara-pump-help",
              ),
          followupThought: pickFollowupThought(
            [
              "Maybe you really will fix it.",
              "Let's see if he follows through.",
              "That sounded less like talk.",
            ],
            context,
            "mara-pump-followup",
          ),
        };
      }

      if (topics.has("work") || topics.has("money")) {
        return {
          reply: chooseConversationLine(
            [
              "If you need money, ask Ada at Kettle & Lamp before the lunch rush. If you want people here on your side, help where the house is stretched thin.",
              "Ada at Kettle & Lamp may have work if you get there before the room fills up.",
              "Work is around. You just have to ask before someone else gets it.",
            ],
            context,
            "mara-work",
          ),
          followupThought: pickFollowupThought(
            [
              "See whether Rowan moves on it.",
              "He can go ask Ada now.",
              "Let's see if he takes the hint.",
            ],
            context,
            "mara-work-followup",
          ),
        };
      }

      if (topics.has("home") || topics.has("rent")) {
        return {
          reply: chooseConversationLine(
            [
              "Pay on time, help when the house is stretched, and Morrow House stays livable.",
              "Pay your rent and pull your weight. That's how a room stays yours.",
              "A place like this keeps you if the money is honest and the burden isn't all yours.",
            ],
            context,
            "mara-home",
          ),
          followupThought: pickFollowupThought(
            [
              "House first, always.",
              "The house comes before charm.",
              "Keep the place from souring.",
            ],
            context,
            "mara-home-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "South Quay makes more sense once you do a few useful things in it. Start there.",
            "This district opens up once people see you pulling your weight.",
            "Keep your eyes open, stay useful, and the place starts to make sense.",
          ],
          context,
          "mara-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Still reading the new one.",
            "He'll need more than one conversation.",
            "Let's see where he walks next.",
          ],
          context,
          "mara-default-followup",
        ),
      };
    case "npc-ada":
      if (topics.has("work") || topics.has("money")) {
        if (!teaJob?.accepted && !teaJob?.completed) {
          return {
            reply: chooseConversationLine(
              [
                "I need hands for the noon rush. Clear cups, wipe tables, keep moving. I pay fourteen.",
                "I need help through lunch. Clear cups and keep the room moving. Fourteen if you can keep up.",
                "Lunch is about to hit. If you're steady, I can pay fourteen.",
              ],
              context,
              "ada-work-open",
            ),
            followupThought: pickFollowupThought(
              [
                "Need the room moving, not charming.",
                "I need speed more than manners.",
                "He should either help or move on.",
              ],
              context,
              "ada-work-open-followup",
            ),
          };
        }

        if (teaJob?.completed && !yardJob?.discovered) {
          return {
            reply: chooseConversationLine(
              [
                "You held up well enough here. Tomas in the yard may still need another back.",
                "You kept pace. Tomas at the yard may still need another back.",
                "You did fine here. The yard might be the next useful stop.",
              ],
              context,
              "ada-yard-handoff",
            ),
            followupThought: pickFollowupThought(
              [
                "Maybe Tomas can use Rowan next.",
                "He can go see Tomas now.",
                "The next stop is obvious enough.",
              ],
              context,
              "ada-yard-handoff-followup",
            ),
          };
        }
      }

      if (topics.has("gossip")) {
        return {
          reply: chooseConversationLine(
            [
              "Gossip costs a cup or a favor. Do something useful first, then ask again.",
              "Gossip costs a cup. Bring me something useful with it.",
              "If it's gossip, earn it. I don't stop the room for free stories.",
            ],
            context,
            "ada-gossip",
          ),
          followupThought: pickFollowupThought(
            [
              "Everybody wants the easy part.",
              "He can pay in effort first.",
              "Don't let the room drift.",
            ],
            context,
            "ada-gossip-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "If you're staying, stay useful. This room notices slow hands fast.",
            "If you're here, keep your hands useful.",
            "Slow hands stand out in a room like this.",
          ],
          context,
          "ada-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Keep the cups moving.",
            "I need the room working.",
            "No drifting now.",
          ],
          context,
          "ada-default-followup",
        ),
      };
    case "npc-jo":
      if (topics.has("tool") || topics.has("repair") || topics.has("pump")) {
        return {
          reply: hasWrench
            ? chooseConversationLine(
                [
                  "You've already got the wrench. The rest is in your wrists.",
                  "You have the wrench. Now use it like you mean it.",
                  "The wrench is the easy part. The hands are next.",
                ],
                context,
                "jo-tool-owned",
              )
            : chooseConversationLine(
            [
              `Old wrench, eight coins. It still turns what needs turning. ${context.scene.context}`,
              "Old wrench, eight coins. It still does the job if you do yours.",
                  "Eight coins gets you the wrench that matters.",
                ],
                context,
                "jo-tool-sell",
              ),
          followupThought: pickFollowupThought(
            [
              "That wrench should move today.",
              "He should buy it or leave it.",
              "This is the honest part.",
            ],
            context,
            "jo-tool-followup",
          ),
        };
      }

      if (topics.has("money") || topics.has("work")) {
        return {
          reply: chooseConversationLine(
            [
              nearbyPlaceName
                ? `I sell fixes, not wages. But the right tool can earn its money fast around ${nearbyPlaceName}.`
                : "I sell fixes, not wages. But the right tool can earn its money fast.",
              "I sell fixes. Wages come from work, not wishes.",
              "Money goes further when you spend it on the right tool.",
            ],
            context,
            "jo-money-work",
          ),
          followupThought: pickFollowupThought(
            [
              "Let's see if Rowan buys it.",
              "The point should be obvious.",
              "He needs to decide soon.",
            ],
            context,
            "jo-money-work-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "If it's bent, I say so. If it still works, I say that too.",
            "Most things here don't need romance. They need the right tool.",
            "I sell straight answers and repairs that hold.",
          ],
          context,
          "jo-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Tell the truth about the metal.",
            "Don't dress it up.",
            "Keep it honest.",
          ],
          context,
          "jo-default-followup",
        ),
      };
    case "npc-tomas":
      if (topics.has("work") || topics.has("money") || topics.has("yard")) {
        if (!yardJob?.accepted && !yardJob?.completed) {
          return {
            reply: chooseConversationLine(
              [
                "Short lift, hard work, twenty-four coins if you finish clean and on time. That's it.",
                "One loading block. Hard work. Twenty-four if you keep up and finish clean.",
                "The yard needs another back for a short run. Twenty-four if you do it right.",
              ],
              context,
              "tomas-yard-offer",
            ),
            followupThought: pickFollowupThought(
              [
                "Need another back, not a speech.",
                "He either lifts or he doesn't.",
                "No room for drifting here.",
              ],
              context,
              "tomas-yard-offer-followup",
            ),
          };
        }

        return {
          reply: chooseConversationLine(
            [
              `If you're here to work, work. If not, keep clear of the load path. ${context.scene.context}`,
              "If you're here to work, work. Otherwise stay out of the way.",
              "Keep the path clear if you want the yard to stay sane.",
            ],
            context,
            "tomas-work-active",
          ),
          followupThought: pickFollowupThought(
            [
              "No excuses, just the lift.",
              "Keep the load moving.",
              "Straight to the work.",
            ],
            context,
            "tomas-work-active-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "Talk if you want, but keep walking. The crates still need moving.",
            "You can ask on the way. I'm not stopping the yard for a chat.",
            "Words are fine. Just don't slow the lift.",
          ],
          context,
          "tomas-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Keep the yard moving.",
            "Work first, then words.",
            "Stay on the lift.",
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
              `Most rumors are hungry, not true. Watch which ones arrive with a place and an hour attached. ${context.scene.context}`,
              "Most rumors are hungry, not true. Watch the ones with a place and time attached.",
              "Rumors only matter when they arrive with details.",
            ],
            context,
            "nia-rumor",
          ),
          followupThought: pickFollowupThought(
            [
              "One of these rumors is real.",
              "Watch which one lands.",
              "Something here is useful.",
            ],
            context,
            "nia-rumor-followup",
          ),
        };
      }

      if (topics.has("cart") || topics.has("help")) {
        return {
          reply: cartProblem?.status === "solved"
            ? chooseConversationLine(
                [
                  "Square is breathing again. Somebody noticed in time.",
                  "That jam's gone. Good. The square can breathe now.",
                  "The square is loose again. Somebody moved before it got ugly.",
                ],
                context,
                "nia-cart-solved",
              )
            : chooseConversationLine(
              [
                  "That split-wheel cart will jam Quay Square once foot traffic picks up. Move it early and everybody gets on with the day.",
                  "That cart will jam the square if nobody moves it early.",
                  "Move the cart before the square gets busy.",
                ],
                context,
                "nia-cart-active",
              ),
          followupThought: pickFollowupThought(
            [
              "That cart needs moving before the rush.",
              "The square will jam if nobody acts.",
              "This is the kind of thing that spreads.",
            ],
            context,
            "nia-cart-followup",
          ),
        };
      }

      return {
        reply: chooseConversationLine(
          [
            "You learn this part of town by watching where people slow down.",
            "Watch where the traffic bunches up. That's where the real story is.",
            "If you pay attention to the slow spots, South Quay starts to explain itself.",
          ],
          context,
          "nia-default",
        ),
        followupThought: pickFollowupThought(
          [
            "Watch where the block backs up.",
            "The useful clue is always moving.",
            "Slow spots matter most.",
          ],
          context,
          "nia-default-followup",
        ),
      };
    default:
      return {
        reply: chooseConversationLine(
          [
            "Same as anybody else here: keep working and don't waste the day.",
            "If you need something, ask it plain.",
            "I'm just trying to get through the day in one piece.",
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

  return cleaned.slice(0, 220);
}

export function sanitizeThought(text: string): string {
  const cleaned = normalizeStreetVoice(text.replace(/\s+/g, " ").trim());
  if (!cleaned) {
    return "Keep moving.";
  }

  const words = cleaned.split(" ").slice(0, 12).join(" ");
  return words.slice(0, 84);
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

function normalizePlayerText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectTopics(text: string): Set<string> {
  const normalized = normalizePlayerText(text);
  const topics = new Set<string>();

  if (/\bwork\b|\bjob\b|\bshift\b|\bpaid\b|\bcoin\b|\bmoney\b|\bearn\b|\bincome\b/.test(normalized)) {
    topics.add("work");
    topics.add("money");
  }

  if (/\bhelp\b|\bfix\b|\brepair\b|\bsolve\b|\bhandle\b/.test(normalized)) {
    topics.add("help");
    topics.add("repair");
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

  if (/\brumou?r\b|\bgossip\b|\bhear\b|\bnews\b/.test(normalized)) {
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
    ...(objective?.trail.map((step) => step.title) ?? []),
    ...(objective?.trail.map((step) => step.detail ?? "") ?? []),
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
