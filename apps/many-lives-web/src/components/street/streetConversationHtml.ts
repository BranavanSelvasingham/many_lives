import { formatClock } from "@/components/street/streetFormatting";
import {
  buildNarrativePreview,
  escapeHtml,
  joinNarrativeFragments,
} from "@/components/street/streetOverlayHtml";
import { npcPersonalityProfile } from "@/lib/street/npcPersonality";
import type {
  ConversationEntry,
  NpcState,
  StreetGameState,
} from "@/lib/street/types";

type ConversationOverlaySnapshot = {
  busyLabel: string | null;
  game: StreetGameState | null;
};

type ConversationReplayViewState = {
  isReplaying: boolean;
  revealedEntryIds: string[];
  streamPauseActor: "npc" | "rowan" | null;
  streamQueue: string[];
  streamedWordCount: number;
  streamingEntryId: string | null;
};

function sentenceCaseFragment(text?: string) {
  const trimmed = text?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^([\s"'(\[]*)([a-z])/, (_match, prefix, firstLetter) =>
    `${prefix}${firstLetter.toUpperCase()}`,
  );
}

export function buildPeopleTabHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  currentObjectiveText: string;
  currentSummary: string;
  currentThought: string;
  npcs: NpcState[];
  selectedNpc: NpcState | null;
  snapshot: ConversationOverlaySnapshot;
  talkableNpcIds: Set<string>;
  tools: StreetGameState["player"]["inventory"];
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    currentObjectiveText,
    currentSummary,
    currentThought,
    npcs,
    selectedNpc,
    snapshot,
    talkableNpcIds,
    tools,
  } = options;
  const selectedPersonality = selectedNpc
    ? npcPersonalityProfile(selectedNpc)
    : null;
  const liveConversationNpcId = snapshot.game?.activeConversation?.npcId;
  const liveConversationSelected =
    Boolean(selectedNpc) && liveConversationNpcId === selectedNpc?.id;

  return `
    <div class="ml-focus-grid ${liveConversationSelected ? "is-live-conversation" : ""}">
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Rowan Model</div>
          <div class="ml-row-title" style="margin-top: 8px;">${escapeHtml(
            currentThought,
          )}</div>
          <div class="ml-row-copy">${escapeHtml(currentSummary)}</div>
          <div class="ml-row-copy">${escapeHtml(currentObjectiveText)}</div>
          <div class="ml-row-meta">${escapeHtml(
            tools.length > 0
              ? `Tools on hand: ${tools.map((item) => item.name).join(", ")}`
              : "No tools yet. Rowan is still relying on time, talk, and a little cash.",
          )}</div>
        </div>
        <div class="ml-card">
          <div class="ml-kicker">People Nearby</div>
          <div class="ml-people-grid" style="margin-top: 12px;">
            ${npcs
              .map((npc) => {
                const personality = npcPersonalityProfile(npc);
                const hasLiveThread = liveConversationNpcId === npc.id;
                return `
                <button
                  class="ml-person ${selectedNpc?.id === npc.id ? "is-active" : ""} ${
                    hasLiveThread ? "has-live-thread" : ""
                  }"
                  data-select-npc="${escapeHtml(npc.id)}"
                  type="button"
                >
                  <div class="ml-person-heading">
                    <div class="ml-person-name">${escapeHtml(npc.name)}</div>
                    ${
                      hasLiveThread
                        ? '<div class="ml-person-live-tag">Live</div>'
                        : ""
                    }
                  </div>
                  <div class="ml-person-meta">${escapeHtml(
                    `${personality.badge} • ${npc.known ? "known" : "unfamiliar"}`,
                  )}</div>
                  <div class="ml-row-copy" style="margin-top: 8px;">${escapeHtml(
                    personality.listLine,
                  )}</div>
                </button>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
      <div class="ml-focus-stack">
        ${
          selectedNpc
            ? `
            <div class="ml-card">
              <div class="ml-kicker">${escapeHtml(
                liveConversationSelected ? "Conversation Active" : "Person Card",
              )}</div>
              <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
                selectedNpc.name,
              )}</div>
              <div class="ml-row-copy" style="margin-top: 6px;">${escapeHtml(
                `${selectedPersonality?.badge ?? selectedNpc.role} • mood: ${selectedNpc.mood} • trust ${selectedNpc.trust}`,
              )}</div>
              <div class="ml-row-copy" style="margin-top: 10px;">${escapeHtml(
                selectedPersonality?.signature ??
                  "They already feel like they belong to this block.",
              )}</div>
              <div class="ml-row-copy" style="margin-top: 10px;">${escapeHtml(
                selectedNpc.summary,
              )}</div>
              <div class="ml-mini-grid" style="margin-top: 12px;">
                <div class="ml-row">
                  <div class="ml-row-meta">Current Objective</div>
                  <div class="ml-row-copy">${escapeHtml(
                    selectedNpc.currentObjective ||
                      "Still deciding what matters most right now.",
                  )}</div>
                </div>
                <div class="ml-row">
                  <div class="ml-row-meta">Current Concern</div>
                  <div class="ml-row-copy">${escapeHtml(
                    selectedNpc.currentConcern ||
                      selectedNpc.currentThought ||
                      "Still deciding how much to say to Rowan.",
                  )}</div>
                </div>
              </div>
              ${buildPeopleConversationStatusHtml({
                conversationDecision,
                conversationLines,
                conversationObjectiveText,
                conversationSummary,
                conversationUpdatedAt,
                isLiveConversation: liveConversationSelected,
                npc: selectedNpc,
                talkableNpcIds,
              })}
            </div>
          `
            : `
            <div class="ml-card">
              <div class="ml-kicker">Character Card</div>
              <div class="ml-row-copy" style="margin-top: 8px;">Pick someone from the block to pull their card into focus.</div>
            </div>
          `
        }
      </div>
    </div>
  `;
}

export function buildConversationPanelHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationLocationId?: string;
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  currentObjectiveText: string;
  currentThought: string;
  isLiveConversation: boolean;
  mode: "focus" | "rail";
  npc: NpcState;
  replay: ConversationReplayViewState;
  snapshot: ConversationOverlaySnapshot;
  startAction?: {
    id: string;
    label: string;
  };
  threadObjectiveStillCurrent?: boolean;
  talkableNpcIds: Set<string>;
  willCarryForward?: boolean;
  willAutostart?: boolean;
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationLocationId,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    currentObjectiveText,
    currentThought,
    isLiveConversation,
    mode,
    npc,
    replay,
    snapshot,
    startAction,
    threadObjectiveStillCurrent = false,
    talkableNpcIds,
    willCarryForward = false,
    willAutostart = false,
  } = options;
  const isRailMode = mode === "rail";
  const personality = npcPersonalityProfile(npc);
  const npcInitials = initialsForName(npc.name);
  const conversationLocation = conversationLocationId
    ? snapshot.game?.locations.find(
        (location) => location.id === conversationLocationId,
      )
    : undefined;
  const conversationTimestamp =
    conversationUpdatedAt ??
    conversationLines[conversationLines.length - 1]?.time;
  const conversationContext = [
    conversationLocation?.name,
    conversationTimestamp ? formatClock(conversationTimestamp) : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const revealedEntryIdSet = new Set(replay.revealedEntryIds);
  const effectiveTypingState = replay.streamPauseActor
    ? {
        actor: replay.streamPauseActor,
        label:
          replay.streamPauseActor === "npc"
            ? `${npc.name} is replying...`
            : "Rowan is replying...",
      }
    : null;
  const isTranscriptInMotion =
    Boolean(effectiveTypingState) ||
    Boolean(replay.streamingEntryId) ||
    replay.streamQueue.length > 0 ||
    replay.isReplaying;
  const transcriptEntries = isRailMode
    ? isLiveConversation
      ? conversationLines
      : conversationLines.slice(-2)
    : conversationLines.slice(-6);
  const visibleConversationEntries = isTranscriptInMotion
    ? transcriptEntries.filter(
        (entry) =>
          revealedEntryIdSet.has(entry.id) || entry.id === replay.streamingEntryId,
      )
    : transcriptEntries;
  const journalNoteVisible =
    conversationObjectiveText &&
    conversationObjectiveText !== conversationDecision &&
    !isRailMode &&
    threadObjectiveStillCurrent &&
    !isTranscriptInMotion;
  const threadShift =
    conversationDecision ||
    conversationObjectiveText ||
    conversationSummary ||
    "The conversation is still changing what Rowan knows.";
  const railThreadNote = buildNarrativePreview(
    joinNarrativeFragments([
      conversationDecision,
      journalNoteVisible ? conversationObjectiveText : undefined,
      !conversationDecision && !journalNoteVisible
        ? conversationSummary
        : undefined,
    ]),
    188,
  );
  const rowanThread =
    conversationObjectiveText || currentThought || currentObjectiveText;
  const railThreadText = sentenceCaseFragment(railThreadNote || threadShift);
  const railObjectiveText = sentenceCaseFragment(conversationObjectiveText);
  const npcThread =
    npc.currentConcern ||
    npc.currentObjective ||
    npc.currentThought ||
    "Still deciding how much to say to Rowan.";
  const canSpeak =
    talkableNpcIds.has(npc.id) && isLiveConversation && !isTranscriptInMotion;
  const canStartWithRowan =
    Boolean(startAction) &&
    talkableNpcIds.has(npc.id) &&
    conversationLines.length === 0;
  const isResolvedThread = !isLiveConversation && conversationLines.length > 0;

  return `
    <div class="ml-chat-shell ${isLiveConversation ? "is-live" : ""} ${
      isRailMode ? "is-rail" : ""
    }">
      <div class="ml-chat-header">
        <div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>
        <div class="ml-chat-head-copy">
          <div class="ml-chat-title">${escapeHtml(npc.name)}</div>
          <div class="ml-chat-subtitle">${escapeHtml(
            `${personality.badge}. ${personality.chatSubtitle}`,
          )}</div>
          ${
            conversationContext
              ? `<div class="ml-chat-context">${escapeHtml(conversationContext)}</div>`
              : ""
          }
          ${
            isTranscriptInMotion
              ? `<div class="ml-live-pill"><span class="ml-live-pill-dot"></span>Live Conversation</div>`
              : ""
          }
        </div>
      </div>
      ${
        isRailMode
          ? `
          <div class="ml-chat-rail-note">${escapeHtml(
            conversationLines.length > 0
              ? isResolvedThread
                ? joinNarrativeFragments([
                    "Conversation finished.",
                    railThreadText,
                    journalNoteVisible ? `Next: ${railObjectiveText}.` : undefined,
                  ])
                : joinNarrativeFragments([
                    railThreadText,
                    willCarryForward
                      ? "A next step is ready."
                      : "Conversation is active.",
                  ])
              : willAutostart
                ? `Rowan is about to talk with ${npc.name}.`
                : `If Rowan starts with ${npc.name}, the conversation will appear here.`,
          )}</div>
        `
          : `
          <div class="ml-chat-sim-strip">
            <div class="ml-chat-sim-card is-rowan">
              <div class="ml-chat-sim-label">Rowan</div>
              <div class="ml-chat-sim-copy">${escapeHtml(rowanThread)}</div>
            </div>
            <div class="ml-chat-sim-card">
              <div class="ml-chat-sim-label">${escapeHtml(npc.name)}</div>
              <div class="ml-chat-sim-copy">${escapeHtml(npcThread)}</div>
            </div>
            <div class="ml-chat-sim-card">
              <div class="ml-chat-sim-label">${
                isTranscriptInMotion
                  ? "Conversation"
                  : "Outcome"
              }</div>
              <div class="ml-chat-sim-copy">${escapeHtml(threadShift)}</div>
            </div>
          </div>
        `
      }
      ${
        !isRailMode && conversationSummary && !isTranscriptInMotion
          ? `
          <div class="ml-chat-summary">${escapeHtml(conversationSummary)}</div>
        `
          : ""
      }
      ${
        isRailMode && isResolvedThread
          ? `
          <div class="ml-chat-outcome">
            <div class="ml-chat-outcome-title">Conversation Finished</div>
            <div class="ml-chat-outcome-copy">${escapeHtml(threadShift)}</div>
          </div>
          ${
            journalNoteVisible
              ? `
              <div class="ml-chat-outcome">
                <div class="ml-chat-outcome-title">Next Step</div>
                <div class="ml-chat-outcome-copy">${escapeHtml(
                  conversationObjectiveText,
                )}</div>
              </div>
            `
              : ""
          }
        `
          : !isRailMode && conversationDecision && !isTranscriptInMotion
          ? `
          <div class="ml-chat-outcome">
            <div class="ml-chat-outcome-title">Conversation Result</div>
            <div class="ml-chat-outcome-copy">${escapeHtml(conversationDecision)}</div>
          </div>
        `
          : ""
      }
      ${
        !isRailMode && journalNoteVisible
          ? `
          <div class="ml-chat-outcome">
            <div class="ml-chat-outcome-title">Objective Update</div>
            <div class="ml-chat-outcome-copy">${escapeHtml(conversationObjectiveText)}</div>
          </div>
        `
          : ""
      }
      ${
        !isRailMode || conversationLines.length > 0 || effectiveTypingState
          ? `
          <div class="ml-chat-transcript" ${
            isRailMode ? "" : 'data-chat-transcript="true"'
          }>
            ${
              conversationLines.length === 0
                ? `<div class="ml-chat-empty">${escapeHtml(
                    `${npc.name} is here, but Rowan has not stepped into the conversation yet.`,
                  )}</div>`
                : visibleConversationEntries
                    .map((entry) => {
                      const isPlayer = entry.speaker === "player";
                      const displayText =
                        entry.id === replay.streamingEntryId
                          ? revealConversationText(
                              entry.text,
                              replay.streamedWordCount,
                            )
                          : entry.text;

                      return `
                        <div class="ml-chat-row ${isPlayer ? "is-player" : ""}">
                          <div class="ml-chat-stack ${isPlayer ? "is-player" : ""}">
                            ${
                              isPlayer
                                ? ""
                                : `<div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>`
                            }
                            <div class="ml-chat-bubble-wrap">
                              <div class="ml-chat-bubble ${isPlayer ? "is-player" : ""}">
                                ${escapeHtml(displayText)}${
                                  entry.id === replay.streamingEntryId
                                    ? '<span class="ml-chat-caret"></span>'
                                    : ""
                                }
                              </div>
                              <div class="ml-chat-meta ${isPlayer ? "is-player" : ""}">${escapeHtml(
                                `${isPlayer ? "Rowan" : entry.speakerName} • ${formatClock(entry.time)}`,
                              )}</div>
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join("")
            }
            ${
              effectiveTypingState
                ? `
                <div class="ml-chat-row ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                  <div class="ml-chat-stack ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                    ${
                      effectiveTypingState.actor === "rowan"
                        ? ""
                        : `<div class="ml-chat-avatar">${escapeHtml(npcInitials)}</div>`
                    }
                    <div class="ml-chat-bubble-wrap">
                      <div class="ml-chat-bubble ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">
                        <div class="ml-chat-typing">
                          <span class="ml-chat-dot"></span>
                          <span class="ml-chat-dot"></span>
                          <span class="ml-chat-dot"></span>
                        </div>
                      </div>
                      <div class="ml-chat-meta ${effectiveTypingState.actor === "rowan" ? "is-player" : ""}">${escapeHtml(
                        effectiveTypingState.label,
                      )}</div>
                    </div>
                  </div>
                </div>
              `
                : ""
            }
          </div>
        `
          : ""
      }
      ${
        canStartWithRowan && startAction
          ? `
          ${
            willAutostart
              ? `
              <div class="ml-chat-autopilot">
                <div class="ml-chat-autopilot-title">Rowan is starting the conversation</div>
                <div class="ml-chat-autopilot-copy">${escapeHtml(
                  `Give him a second to start talking with ${npc.name}.`,
                )}</div>
              </div>
            `
              : `
              <button
                class="ml-button"
                data-action-id="${escapeHtml(startAction.id)}"
                data-action-label="${escapeHtml(startAction.label)}"
                data-tone="high"
                ${snapshot.busyLabel ? "disabled" : ""}
                type="button"
              >
                <div class="ml-button-title">Start Conversation</div>
                <div class="ml-button-copy">${escapeHtml(
                  `Start talking with ${npc.name}.`,
                )}</div>
              </button>
            `
          }
        `
          : canSpeak
            ? `
            <div class="ml-chat-rail-note">${escapeHtml(
              "Rowan will keep the conversation moving from here.",
            )}</div>
          `
            : talkableNpcIds.has(npc.id) && isLiveConversation && isTranscriptInMotion
              ? `
            <div class="ml-chat-rail-note">${escapeHtml(
              "Wait for the current lines to finish. Rowan can answer after that.",
            )}</div>
          `
            : talkableNpcIds.has(npc.id)
              ? ""
              : `
            <div class="ml-chat-rail-note">${escapeHtml(
              `${npc.name} is not ready to talk right now.`,
            )}</div>
          `
      }
    </div>
  `;
}

function buildPeopleConversationStatusHtml(options: {
  conversationDecision?: string;
  conversationLines: ConversationEntry[];
  conversationObjectiveText?: string;
  conversationSummary?: string;
  conversationUpdatedAt?: string;
  isLiveConversation: boolean;
  npc: NpcState;
  talkableNpcIds: Set<string>;
}) {
  const {
    conversationDecision,
    conversationLines,
    conversationObjectiveText,
    conversationSummary,
    conversationUpdatedAt,
    isLiveConversation,
    npc,
    talkableNpcIds,
  } = options;
  const threadRead =
    conversationDecision ||
    conversationObjectiveText ||
    conversationSummary ||
    (talkableNpcIds.has(npc.id)
      ? `Rowan can start talking with ${npc.name} from the main log whenever you're ready.`
      : `${npc.name} is not ready to talk right now.`);

  return `
    <div class="ml-card" style="margin-top: 12px;">
      <div class="ml-kicker">${
        isLiveConversation ? "Live In Rowan Log" : "Conversation"
      }</div>
      <div class="ml-row-copy" style="margin-top: 8px;">${escapeHtml(
        isLiveConversation
          ? `The conversation with ${npc.name} is active in Rowan's log on the main rail.`
          : threadRead,
      )}</div>
      ${
        conversationLines.length > 0 && conversationUpdatedAt
          ? `<div class="ml-row-meta">${escapeHtml(
              `Last update • ${formatClock(conversationUpdatedAt)}`,
            )}</div>`
          : ""
      }
    </div>
  `;
}

function splitConversationStreamWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function revealConversationText(text: string, wordCount: number) {
  const words = splitConversationStreamWords(text);
  if (words.length === 0) {
    return "";
  }

  return words.slice(0, Math.max(1, wordCount)).join(" ");
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
