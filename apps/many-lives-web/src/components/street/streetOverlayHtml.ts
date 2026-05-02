import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import type {
  MemoryThread,
  ObjectivePlanItem,
} from "@/lib/street/journalModel";
import type { StreetGameState } from "@/lib/street/types";

type OverlayActiveTab = "actions" | "journal" | "mind" | "people";

type StreetOverlaySnapshot = {
  busyLabel: string | null;
  error: string | null;
  game: StreetGameState | null;
  loadingLabel: string;
};

export function buildLoadingHtml(
  snapshot: StreetOverlaySnapshot,
  width: number,
  height: number,
) {
  return `
    <style>
      .ml-loading-root {
        width: ${width}px;
        height: ${height}px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        pointer-events: none;
        font-family: "Avenir Next", "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
      }
      .ml-loading-card {
        width: min(680px, 100%);
        border-radius: 32px;
        border: 1px solid rgba(138, 151, 161, 0.22);
        background: linear-gradient(180deg, rgba(18, 26, 31, 0.94), rgba(12, 18, 23, 0.9));
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
        padding: 28px;
        pointer-events: auto;
        color: #edf2f5;
      }
      .ml-loading-kicker {
        font-size: 11px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.66);
      }
      .ml-loading-title {
        margin-top: 14px;
        font-size: 34px;
        line-height: 0.98;
        font-weight: 700;
      }
      .ml-loading-copy {
        margin-top: 12px;
        font-size: 16px;
        line-height: 1.7;
        color: rgba(219, 228, 233, 0.82);
      }
      .ml-loading-status {
        margin-top: 20px;
        border-radius: 22px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.08);
        padding: 16px 18px;
        font-size: 14px;
        line-height: 1.6;
      }
      .ml-loading-error {
        border-color: rgba(167, 105, 99, 0.28);
        background: rgba(167, 105, 99, 0.12);
      }
      .ml-loading-button {
        margin-top: 16px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
        padding: 10px 14px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        cursor: pointer;
      }
    </style>
    <div class="ml-loading-root">
      <div class="ml-loading-card">
        <div class="ml-loading-kicker">Brackenport • South Quay</div>
        <div class="ml-loading-title">Opening the district</div>
        <div class="ml-loading-copy">One person, one block, one day to start finding a place in the city.</div>
        <div class="ml-loading-status ${snapshot.error ? "ml-loading-error" : ""}">
          ${escapeHtml(snapshot.error ?? snapshot.loadingLabel)}
        </div>
        ${
          snapshot.error
            ? `<button class="ml-loading-button" data-reload="true" type="button">Try Again</button>`
            : ""
        }
      </div>
    </div>
  `;
}

export function buildRowanStoryCardHtml(
  kicker: string,
  card: {
    detail: string;
    title: string;
    tone: "conversation" | "info" | "objective";
  },
  primary = false,
) {
  return `
    <div
      class="ml-rowan-story-card ${primary ? "is-primary" : ""}"
      data-rowan-directive="${primary ? "true" : "false"}"
      data-tone="${escapeHtml(card.tone)}"
    >
      <div class="ml-kicker">${escapeHtml(kicker)}</div>
      <div class="ml-rowan-story-card-title">${escapeHtml(card.title)}</div>
      <div class="ml-rowan-story-card-copy">${escapeHtml(
        buildNarrativePreview(card.detail, primary ? 176 : 152),
      )}</div>
    </div>
  `;
}

export function buildTabButton(
  tab: OverlayActiveTab,
  active: boolean,
  className = "ml-tab",
) {
  return `
    <button
      class="${className} ${active ? "is-active" : ""}"
      data-tab="${tab}"
      aria-pressed="${active ? "true" : "false"}"
      type="button"
    >
      ${escapeHtml(tabLabel(tab))}
    </button>
  `;
}

export function buildJournalTabHtml(options: {
  busyLabel: string | null;
  currentObjectiveText: string;
  game: StreetGameState;
  objectiveCompleted: ObjectivePlanItem[];
  objectivePlanItems: ObjectivePlanItem[];
  objectiveSuggestions: string[];
  recentFeed: StreetGameState["feed"];
}) {
  const {
    currentObjectiveText,
    game,
    objectiveCompleted,
    objectivePlanItems,
    objectiveSuggestions,
    recentFeed,
  } = options;

  return `
    <div class="ml-focus-grid">
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Objective</div>
          <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
            currentObjectiveText,
          )}</div>
          ${
            objectiveSuggestions.length > 0
              ? `
              <div class="ml-chip-row">
                ${objectiveSuggestions
                  .map(
                    (suggestion) => `
                    <div class="ml-chip" aria-disabled="true">
                      ${escapeHtml(suggestion)}
                    </div>
                  `,
                  )
                  .join("")}
              </div>
            `
              : ""
          }
        </div>
        <div class="ml-card">
          <div class="ml-kicker">Objective Trail</div>
          <div class="ml-list" style="margin-top: 12px;">
            ${
              objectivePlanItems.length > 0
                ? objectivePlanItems
                    .slice(0, 5)
                    .map(
                      (item) => `
                      <div class="ml-row">
                        <div class="ml-row-title">${escapeHtml(item.title)}</div>
                        <div class="ml-row-copy">${escapeHtml(item.detail)}</div>
                        ${
                          item.progress
                            ? `<div class="ml-row-meta">${escapeHtml(item.progress)}</div>`
                            : ""
                        }
                      </div>
                    `,
                    )
                    .join("")
                : `<div class="ml-row"><div class="ml-row-copy">No active objective checklist yet.</div></div>`
            }
          </div>
        </div>
      </div>
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Accomplishments And Feed</div>
          <div class="ml-list" style="margin-top: 12px;">
            ${objectiveCompleted
              .slice(0, 3)
              .map(
                (item) => `
                <div class="ml-row">
                  <div class="ml-row-title">${escapeHtml(item.title)}</div>
                  <div class="ml-row-copy">${escapeHtml(item.detail)}</div>
                  ${
                    item.progress
                      ? `<div class="ml-row-meta">${escapeHtml(item.progress)}</div>`
                      : ""
                  }
                </div>
              `,
              )
              .join("")}
            ${recentFeed
              .slice(0, 5)
              .map(
                (entry) => `
                <div class="ml-row">
                  <div class="ml-row-title">${escapeHtml(formatClock(entry.time))}</div>
                  <div class="ml-row-copy">${escapeHtml(entry.text)}</div>
                </div>
              `,
              )
              .join("")}
          </div>
          <div class="ml-row-copy" style="margin-top: 12px;">Known locations: ${escapeHtml(
            String(game.player.knownLocationIds.length),
          )} • known locals: ${escapeHtml(String(game.player.knownNpcIds.length))}</div>
        </div>
      </div>
    </div>
  `;
}

export function buildMindTabHtml(options: {
  extraPeopleNames: string[];
  extraPlaceNames: string[];
  extraThreadTitles: string[];
  extraToolNames: string[];
  game: StreetGameState;
  memoryThreads: MemoryThread[];
  primaryPerson?: StreetGameState["npcs"][number];
  primaryPlace?: StreetGameState["locations"][number];
  primaryThread?: MemoryThread;
  primaryTool?: StreetGameState["player"]["inventory"][number];
}) {
  const {
    extraPeopleNames,
    extraPlaceNames,
    extraThreadTitles,
    extraToolNames,
    game,
    memoryThreads,
    primaryPerson,
    primaryPlace,
    primaryThread,
    primaryTool,
  } = options;

  return `
    <div class="ml-focus-stack">
      <div class="ml-card">
        <div class="ml-kicker">Working Memory</div>
        <div class="ml-mini-grid" style="margin-top: 12px;">
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryPlace?.name ?? "Still getting bearings",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryPlace
                ? buildKnownPlaceDetail(primaryPlace)
                : "The district is still mostly unmapped in Rowan's head.",
            )}</div>
            ${
              formatMemoryMeta(
                extraPlaceNames,
                game.player.knownLocationIds.length,
              )
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraPlaceNames,
                      game.player.knownLocationIds.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryPerson?.name ?? "No one sticking yet",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryPerson
                ? buildKnownPersonDetail(primaryPerson)
                : "No one has become a stable part of Rowan's mental map yet.",
            )}</div>
            ${
              formatMemoryMeta(extraPeopleNames, game.player.knownNpcIds.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraPeopleNames,
                      game.player.knownNpcIds.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryThread?.title ?? "Nothing urgent yet",
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryThread?.detail ??
                "No work or local trouble is really sticking yet.",
            )}</div>
            ${
              formatMemoryMeta(extraThreadTitles, memoryThreads.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(extraThreadTitles, memoryThreads.length) ??
                      "",
                  )}</div>`
                : ""
            }
          </div>
          <div class="ml-row">
            <div class="ml-row-title">${escapeHtml(
              primaryTool?.name ?? `$${game.player.money} on hand`,
            )}</div>
            <div class="ml-row-copy">${escapeHtml(
              primaryTool?.description ??
                cashReadLabel(game.player.money, game.player.energy),
            )}</div>
            ${
              primaryTool &&
              formatMemoryMeta(extraToolNames, game.player.inventory.length)
                ? `<div class="ml-row-meta">${escapeHtml(
                    formatMemoryMeta(
                      extraToolNames,
                      game.player.inventory.length,
                    ) ?? "",
                  )}</div>`
                : ""
            }
          </div>
        </div>
      </div>
      <div class="ml-card">
        <div class="ml-kicker">Journal</div>
        <div class="ml-list" style="margin-top: 12px;">
          ${
            game.player.memories.length === 0
              ? `<div class="ml-row"><div class="ml-row-copy">Nothing has stuck yet. Rowan needs to walk, talk, or act before the journal starts filling in.</div></div>`
              : game.player.memories
                  .slice(0, 6)
                  .map(
                    (memory) => `
                    <div class="ml-row">
                      <div class="ml-row-title">${escapeHtml(formatClock(memory.time))}</div>
                      <div class="ml-row-copy">${escapeHtml(
                        toFirstPersonText(memory.text),
                      )}</div>
                    </div>
                  `,
                  )
                  .join("")
          }
        </div>
      </div>
    </div>
  `;
}

export function joinNarrativeFragments(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function formatNameList(names: string[]) {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0]!;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function feedToneLabel(tone: StreetGameState["feed"][number]["tone"]) {
  switch (tone) {
    case "job":
      return "Work";
    case "problem":
      return "Problem";
    case "memory":
      return "Memory";
    case "info":
    default:
      return "Activity";
  }
}

export function buildNarrativePreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const firstSentenceBreak = normalized.indexOf(". ");
  if (firstSentenceBreak !== -1 && firstSentenceBreak + 1 <= maxLength) {
    return normalized.slice(0, firstSentenceBreak + 1).trim();
  }

  const clipped = normalized.slice(0, maxLength).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(maxLength * 0.55)
      ? clipped.slice(0, lastSpace)
      : clipped;

  return `${base.trimEnd()}...`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tabLabel(tab: OverlayActiveTab) {
  switch (tab) {
    case "people":
      return "Locals";
    case "journal":
      return "Journal";
    case "mind":
      return "Mind";
    default:
      return "World";
  }
}

function cashReadLabel(money: number, energy: number) {
  if (money < 8) {
    return "Cash is tight enough that the next useful move probably needs to pay.";
  }

  if (money < 20 && energy < 40) {
    return "Rowan can act, but does not have enough room to waste a tired step.";
  }

  if (money < 20) {
    return "There is enough for one modest purchase or a little breathing room.";
  }

  if (energy < 40) {
    return "Money can cover a need, but not the effort to brute-force the day.";
  }

  return "There is enough cash on hand to solve a problem instead of only chasing coin.";
}

function formatMemoryMeta(items: string[], total: number) {
  if (total <= 1 || items.length === 0) {
    return undefined;
  }

  const remaining = total - 1 - items.length;
  const base = items.join(" • ");

  if (remaining > 0) {
    return `${base} • +${remaining} more`;
  }

  return base;
}

function buildKnownPlaceDetail(location: StreetGameState["locations"][number]) {
  return `I know this as a ${location.type} in ${location.neighborhood}. ${location.context}`;
}

function buildKnownPersonDetail(person: StreetGameState["npcs"][number]) {
  const roleWithArticle = /^[aeiou]/i.test(person.role)
    ? `an ${person.role}`
    : `a ${person.role}`;
  const roleLine = `I know ${person.name} as ${roleWithArticle}.`;

  if (person.currentThought) {
    return `${roleLine} ${toFirstPersonText(person.currentThought)}`;
  }

  return `${roleLine} I remember that ${person.name} ${lowercaseFirst(trimPeriod(person.summary))}.`;
}

function lowercaseFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function trimPeriod(value: string) {
  return value.trim().replace(/[.?!]+$/g, "");
}
