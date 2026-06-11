import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import type {
  MemoryThread,
  ObjectivePlanItem,
} from "@/lib/street/journalModel";
import type { RowanVisibleDecisionArtifact } from "@/lib/street/rowanDecisionArtifact";
import { STREET_RELEASE_INFO } from "@/lib/street/streetReleaseNotes";
import type { StreetGameState } from "@/lib/street/types";

type OverlayActiveTab = "actions" | "journal" | "mind" | "people";

type StreetOverlaySnapshot = {
  busyLabel: string | null;
  error: string | null;
  game: StreetGameState | null;
  loadingLabel: string;
  storedGameId?: string | null;
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
      .ml-loading-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }
      .ml-loading-actions .ml-loading-button {
        margin-top: 0;
      }
      .ml-loading-button.is-primary {
        background: rgba(205, 174, 115, 0.18);
        color: rgba(255, 239, 205, 0.98);
      }
      .ml-loading-button.is-secondary {
        border-color: rgba(138, 151, 161, 0.22);
        background: rgba(28, 38, 45, 0.78);
        color: rgba(232, 238, 241, 0.9);
      }
    </style>
    <div class="ml-loading-root">
      <div class="ml-loading-card">
        <div class="ml-loading-kicker">Brackenport • South Quay</div>
        <div class="ml-loading-title">${
          snapshot.storedGameId ? "Continue Rowan's run?" : "Opening the district"
        }</div>
        <div class="ml-loading-copy">${
          snapshot.storedGameId
            ? "This browser has a saved run. Continue where Rowan left off, or start a fresh first afternoon."
            : "One person, one block, one day to start finding a place in the city."
        }</div>
        <div class="ml-loading-status ${snapshot.error ? "ml-loading-error" : ""}">
          ${escapeHtml(
            snapshot.error ??
              (snapshot.storedGameId
                ? "Saved run found on this device."
                : snapshot.loadingLabel),
          )}
        </div>
        ${
          snapshot.storedGameId
            ? `<div class="ml-loading-actions">
                ${
                  snapshot.error
                    ? ""
                    : `<button class="ml-loading-button is-primary" data-resume-stored-game="true" type="button">Continue Saved Run</button>`
                }
                <button class="ml-loading-button is-secondary" data-start-new-game="true" type="button">Start New Run</button>
              </div>`
            : ""
        }
        ${
          snapshot.error && !snapshot.storedGameId
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
    decisionArtifact?: RowanVisibleDecisionArtifact | null;
    detail: string;
    planningTrace?: StreetGameState["rowanAutonomy"]["planningTrace"];
    reason?: string;
    signals?: string[];
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
      ${card.decisionArtifact ? buildVisibleDecisionArtifactHtml(card.decisionArtifact) : ""}
      <div class="ml-rowan-story-card-copy">${escapeHtml(
        buildNarrativePreview(card.detail, primary ? 176 : 152),
      )}</div>
      ${
        primary && card.reason
          ? `<div class="ml-rowan-story-card-reason">
              <span>Why now</span>
              ${escapeHtml(buildNarrativePreview(card.reason, 156))}
            </div>`
          : ""
      }
      ${
        primary && card.signals?.length
          ? `<div class="ml-rowan-signal-row">
              ${card.signals
                .slice(0, 3)
                .map(
                  (signal) =>
                    `<span class="ml-rowan-signal">${escapeHtml(
                      buildNarrativePreview(signal, 54),
                    )}</span>`,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

export function buildVisibleDecisionArtifactHtml(
  artifact: RowanVisibleDecisionArtifact,
) {
  const considered = artifact.considered.slice(0, 3);
  const passedOver = artifact.passedOver.slice(0, 2);
  const constraints = artifact.constraints.slice(0, 3);

  return `
    <div
      class="ml-decision-artifact"
      data-visible-decision-artifact="true"
      data-decision-source="${escapeHtml(artifact.sourceSummary)}"
    >
      <div class="ml-decision-head">
        <span>Rowan weighs</span>
        <strong>${escapeHtml(buildNarrativePreview(artifact.sourceSummary, 36))}</strong>
      </div>
      <div class="ml-decision-grid">
        <div class="ml-decision-line">
          <span>Aim</span>
          <p>${escapeHtml(buildNarrativePreview(artifact.objective, 112))}</p>
        </div>
        <div class="ml-decision-line">
          <span>Choice</span>
          <p>${escapeHtml(buildNarrativePreview(artifact.selectedAction, 84))}</p>
        </div>
      </div>
      ${
        artifact.nextCheck
          ? `<div class="ml-decision-next-check">
              <span>Next check</span>
              ${escapeHtml(buildNarrativePreview(artifact.nextCheck, 118))}
            </div>`
          : ""
      }
      ${
        constraints.length
          ? `<div class="ml-decision-chip-row" aria-label="Relevant constraints">
              <strong>Signals</strong>
              ${constraints
                .map(
                  (constraint) =>
                    `<span>${escapeHtml(buildNarrativePreview(constraint, 62))}</span>`,
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="ml-decision-rationale">
        <span>Why this</span>
        ${escapeHtml(buildNarrativePreview(artifact.rationale, 132))}
      </div>
      ${
        considered.length
          ? `<div class="ml-decision-options">
              <span>Options</span>
              ${considered
                .map(
                  (option) =>
                    `<em>${escapeHtml(buildNarrativePreview(option, 58))}</em>`,
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        passedOver.length
          ? `<div class="ml-decision-passed-over">
              <span>Passed over</span>
              ${passedOver
                .map(
                  (option) =>
                    `<em>${escapeHtml(buildNarrativePreview(option, 64))}</em>`,
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="ml-decision-backing">${escapeHtml(
        buildNarrativePreview(artifact.backingSummary, 96),
      )}</div>
    </div>
  `;
}

export function buildReleaseInfoHtml(open: boolean) {
  return `
    <div class="ml-release-widget ${open ? "is-open" : ""}" data-release-widget="true">
      <button
        class="ml-release-button"
        data-toggle-release-info="true"
        aria-controls="ml-release-panel"
        aria-expanded="${open ? "true" : "false"}"
        aria-label="Show Many Lives release notes"
        title="Release notes"
        type="button"
      >
        <span aria-hidden="true">i</span>
      </button>
      ${
        open
          ? `
          <div
            id="ml-release-panel"
            class="ml-release-panel"
            data-release-info-panel="true"
            role="dialog"
            aria-modal="false"
            aria-labelledby="ml-release-title"
          >
            <div class="ml-release-panel-head">
              <div>
                <div class="ml-kicker">Release</div>
                <div class="ml-release-title" id="ml-release-title">Many Lives ${escapeHtml(
                  STREET_RELEASE_INFO.version,
                )}</div>
              </div>
              <button
                class="ml-release-close"
                data-close-release-info="true"
                aria-label="Close release notes"
                title="Close release notes"
                type="button"
              >
                &times;
              </button>
            </div>
            <div class="ml-release-build">
              <span>${escapeHtml(STREET_RELEASE_INFO.source)}</span>
              <span>${escapeHtml(STREET_RELEASE_INFO.build)}</span>
            </div>
            <div class="ml-release-feature-list">
              ${STREET_RELEASE_INFO.features
                .map(
                  (feature) => `
                  <div class="ml-release-feature">
                    <div class="ml-release-feature-title">${escapeHtml(
                      feature.title,
                    )}</div>
                    <div class="ml-release-feature-copy">${escapeHtml(
                      feature.body,
                    )}</div>
                  </div>
                `,
                )
                .join("")}
            </div>
          </div>
        `
          : ""
      }
    </div>
  `;
}

export function buildCompactVisibleDecisionArtifactHtml(
  artifact: RowanVisibleDecisionArtifact,
) {
  const considered = artifact.considered[0];
  const signals = artifact.constraints.slice(0, 2).join("; ");

  return `
    <div
      class="ml-decision-artifact is-compact"
      data-visible-decision-artifact="true"
      data-decision-source="${escapeHtml(artifact.sourceSummary)}"
    >
      <div class="ml-decision-head">
        <span>Rowan weighs</span>
        <strong>${escapeHtml(buildNarrativePreview(artifact.sourceSummary, 30))}</strong>
      </div>
      <div class="ml-decision-compact-copy">
        <span>Aim: ${escapeHtml(buildNarrativePreview(artifact.objective, 54))}</span>
        ${
          signals
            ? `<span>Signals: ${escapeHtml(buildNarrativePreview(signals, 58))}</span>`
            : ""
        }
        <span>Choice: ${escapeHtml(buildNarrativePreview(artifact.selectedAction, 42))}</span>
        <span>Why this: ${escapeHtml(buildNarrativePreview(artifact.rationale, 64))}</span>
        ${
          artifact.nextCheck
            ? `<span>Next check: ${escapeHtml(buildNarrativePreview(artifact.nextCheck, 62))}</span>`
            : ""
        }
        ${
          considered
            ? `<span>Options: ${escapeHtml(buildNarrativePreview(considered, 42))}</span>`
            : ""
        }
      </div>
    </div>
  `;
}

export function buildPlanningTraceHtml(
  trace?: StreetGameState["rowanAutonomy"]["planningTrace"],
) {
  if (!trace || trace.considered.length === 0) {
    return "";
  }

  const selected =
    trace.selectedLabel ??
    trace.considered.find((option) => option.status === "selected")?.label;
  const considered = trace.considered.slice(0, 3);
  const rejected = trace.rejected.slice(0, 2);
  const blockers = trace.blockers.slice(0, 2);

  return `
    <div class="ml-planner-trace">
      <div class="ml-planner-trace-head">
        <span>Planner trace</span>
        ${selected ? `<strong>${escapeHtml(buildNarrativePreview(selected, 48))}</strong>` : ""}
      </div>
      <div class="ml-planner-trace-list">
        ${considered
          .map(
            (option) => `
              <div class="ml-planner-trace-option" data-status="${escapeHtml(
                option.status,
              )}">
                <span>${escapeHtml(buildNarrativePreview(option.label, 44))}</span>
                <em>${escapeHtml(buildNarrativePreview(option.rationale, 72))}</em>
              </div>
            `,
          )
          .join("")}
      </div>
      ${
        rejected.length || blockers.length
          ? `<div class="ml-planner-trace-foot">
              ${rejected
                .map(
                  (option) =>
                    `<span>Rejected: ${escapeHtml(
                      buildNarrativePreview(option.label, 36),
                    )}</span>`,
                )
                .join("")}
              ${blockers
                .map(
                  (blocker) =>
                    `<span>Blocked: ${escapeHtml(
                      buildNarrativePreview(blocker, 44),
                    )}</span>`,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

export function buildRuntimeDebugHtml(game: StreetGameState) {
  const aiRuntime = game.aiRuntime;
  const trace = game.rowanAutonomy.planningTrace;

  if (!aiRuntime && !trace) {
    return "";
  }

  const aiLabel = aiRuntime
    ? aiRuntime.status === "live"
      ? "AI: Live"
      : aiRuntime.status === "fallback"
        ? "AI: Fallback"
        : "AI: Not called"
    : "AI: Not called";
  const aiTone = aiRuntime?.status === "live"
    ? "live"
    : aiRuntime?.status === "fallback"
      ? "fallback"
      : "quiet";
  const callSummary = aiRuntime
    ? `${aiRuntime.totalSuccesses} live • ${aiRuntime.totalFallbacks} fallback • ${aiRuntime.totalSkips} skipped`
    : "No AI runtime evidence on this session yet.";
  const activeTasks = aiRuntime
    ? Object.entries(aiRuntime.tasks)
        .filter(([, summary]) =>
          Boolean(summary.successes || summary.fallbacks || summary.skips),
        )
        .slice(0, 4)
    : [];

  return `
    <div class="ml-debug-panel">
      <div class="ml-kicker">Debug</div>
      <div class="ml-ai-runtime" data-ai-status="${escapeHtml(aiTone)}">
        <div class="ml-ai-runtime-title">${escapeHtml(aiLabel)}</div>
        <div class="ml-ai-runtime-copy">${escapeHtml(callSummary)}</div>
        ${
          aiRuntime?.fallbackReasons.length
            ? `<div class="ml-ai-runtime-copy is-warning">${escapeHtml(
                buildNarrativePreview(aiRuntime.fallbackReasons[0]!, 132),
              )}</div>`
            : ""
        }
        ${
          activeTasks.length
            ? `<div class="ml-ai-task-grid">
                ${activeTasks
                  .map(
                    ([task, summary]) => `
                      <span>${escapeHtml(task)}: ${escapeHtml(
                        `${summary.successes}/${summary.fallbacks}/${summary.skips}`,
                      )}</span>
                    `,
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
      ${buildPlanningTraceHtml(trace) || buildEmptyPlanningTraceHtml()}
    </div>
  `;
}

function buildEmptyPlanningTraceHtml() {
  return `
    <div class="ml-planner-trace">
      <div class="ml-planner-trace-head">
        <span>Planner trace</span>
        <strong>No trace for this beat</strong>
      </div>
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
  recentFeed,
} = options;
  const fieldNoteHtml = buildFirstAfternoonFieldNoteHtml(game, {
    compactAfterFirst: true,
  });

  return `
    ${fieldNoteHtml}
    <div class="ml-focus-grid">
      <div class="ml-focus-stack">
        <div class="ml-card">
          <div class="ml-kicker">Objective</div>
          <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
            currentObjectiveText,
          )}</div>
        </div>
        <div class="ml-card">
          <div class="ml-kicker">Objective Outcomes</div>
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
                : `<div class="ml-row"><div class="ml-row-copy">No active objective outcomes yet.</div></div>`
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
  const notebook = buildRowanNotebookModel({
    game,
    primaryPerson,
    primaryPlace,
    primaryThread,
  });
  const cityPulseItems = buildCityPulseItems(game);

  return `
    <div class="ml-focus-stack">
      <div class="ml-card ml-notebook-card">
        <div class="ml-kicker">Rowan's Notebook</div>
        <div class="ml-card-title" style="margin-top: 8px;">${escapeHtml(
          notebook.title,
        )}</div>
        <div class="ml-notebook-grid">
          <div class="ml-notebook-line">
            <div class="ml-row-meta">Current Belief</div>
            <div class="ml-row-copy">${escapeHtml(notebook.belief)}</div>
          </div>
          <div class="ml-notebook-line">
            <div class="ml-row-meta">Current Plan</div>
            <div class="ml-row-copy">${escapeHtml(notebook.plan)}</div>
          </div>
          <div class="ml-notebook-line">
            <div class="ml-row-meta">Confidence</div>
            <div class="ml-row-copy">${escapeHtml(notebook.confidence)}</div>
          </div>
          <div class="ml-notebook-line">
            <div class="ml-row-meta">Remembered Clue</div>
            <div class="ml-row-copy">${escapeHtml(notebook.clue)}</div>
          </div>
          <div class="ml-notebook-line is-wide">
            <div class="ml-row-meta">Next Uncertainty</div>
            <div class="ml-row-copy">${escapeHtml(notebook.uncertainty)}</div>
          </div>
        </div>
      </div>
      <div class="ml-card" data-city-pulse="true">
        <div class="ml-kicker">City Pulse</div>
        <div class="ml-card-title" style="margin-top: 8px;">South Quay is moving</div>
        <div class="ml-list" style="margin-top: 12px;">
          ${
            cityPulseItems.length > 0
              ? cityPulseItems
                  .map(
                    (item) => `
                    <div class="ml-row">
                      <div class="ml-row-title">${escapeHtml(item.title)}</div>
                      <div class="ml-row-copy">${escapeHtml(item.detail)}</div>
                      ${
                        item.meta
                          ? `<div class="ml-row-meta">${escapeHtml(item.meta)}</div>`
                          : ""
                      }
                    </div>
                  `,
                  )
                  .join("")
              : `<div class="ml-row"><div class="ml-row-copy">The block is quiet for the moment, but Rowan is still watching for work, trouble, and people on the move.</div></div>`
          }
        </div>
      </div>
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

export function buildFirstAfternoonFieldNoteHtml(
  game: StreetGameState,
  options: { compactAfterFirst?: boolean } = {},
) {
  const notes = [
    {
      key: "mara-ada-lead",
      note: game.firstAfternoon?.leadFieldNote,
      title: "Mara's lead verified",
    },
    {
      key: "first-afternoon",
      note: game.firstAfternoon?.fieldNote,
      title: "First afternoon settled",
    },
  ].filter((entry) => entry.note);

  if (notes.length === 0) {
    return "";
  }

  const cardsHtml = notes
    .map(({ key, note, title }, index) => {
      const compact = Boolean(options.compactAfterFirst && index > 0);
      const nextLabel = fieldNoteNextLabel(game, key);
      const nextCopy = fieldNoteNextCopy(game, key, note!.next);

      return `
    <div class="ml-field-note-card ${compact ? "is-compact" : ""}" data-field-note="${escapeHtml(key)}">
      <div class="ml-field-note-stamp">Field Note • ${escapeHtml(
        formatClock(note!.createdAt),
      )}</div>
      <div class="ml-field-note-title">${escapeHtml(title)}</div>
      ${
        compact
          ? `<div class="ml-field-note-compact-copy">${escapeHtml(note!.learned)}</div>`
          : `<div class="ml-field-note-grid">
        <div class="ml-field-note-line">
          <div class="ml-row-meta">Learned</div>
          <div class="ml-row-copy">${escapeHtml(note!.learned)}</div>
        </div>
        <div class="ml-field-note-line">
          <div class="ml-row-meta">Evidence</div>
          <div class="ml-row-copy">${escapeHtml(note!.evidence)}</div>
        </div>
        <div class="ml-field-note-line" data-field-note-next-row="${escapeHtml(key)}">
          <div class="ml-row-meta" data-field-note-next-label="${escapeHtml(key)}">${escapeHtml(
            nextLabel,
          )}</div>
          <div class="ml-row-copy">${escapeHtml(nextCopy)}</div>
        </div>
        <div class="ml-field-note-line">
          <div class="ml-row-meta">Memory Created</div>
          <div class="ml-row-copy">${escapeHtml(note!.memory)}</div>
        </div>
      </div>`
      }
    </div>
  `;
    })
    .join("");

  return `<div class="ml-field-note-ledger">${cardsHtml}</div>`;
}

function fieldNoteNextLabel(game: StreetGameState, key: string) {
  return isHistoricalFieldNoteNext(game, key) ? "At The Time" : "Next";
}

function isHistoricalFieldNoteNext(game: StreetGameState, key: string) {
  if (key === "first-afternoon") {
    return Boolean(game.firstAfternoon?.fieldNote);
  }

  if (key === "mara-ada-lead") {
    return Boolean(
      game.firstAfternoon?.completedAt || game.firstAfternoon?.fieldNote,
    );
  }

  return false;
}

function fieldNoteNextCopy(
  game: StreetGameState,
  key: string,
  fallback: string,
) {
  if (key !== "mara-ada-lead") {
    return fallback;
  }

  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const stage = game.firstAfternoon?.teaShiftStage;
  if (game.firstAfternoon?.completedAt || game.firstAfternoon?.fieldNote) {
    return "The first afternoon is settled; rest at Morrow House, then weigh the yard work window against the Morrow Yard pump.";
  }

  if (teaJob?.completed || stage === "paid") {
    return "The shift paid. Return to Morrow House and take stock before the day scatters into another thread.";
  }

  if (stage === "counter") {
    return "Finish the counter pass, collect the pay, then let the work become a real field note.";
  }

  if (stage === "rush") {
    return "Keep the lunch rush moving: clear cups, watch the counter, and stay useful until Ada can pay.";
  }

  if (teaJob?.accepted || game.player.activeJobId === "job-tea-shift") {
    return "The shift is booked. Stay near Kettle & Lamp until lunch starts, then prove the lead with work.";
  }

  if (teaJob?.discovered) {
    return "Ada's offer is live: take the cup-and-counter shift, compare another real pressure, or deliberately walk away.";
  }

  return fallback;
}

function buildRowanNotebookModel({
  game,
  primaryPerson,
  primaryPlace,
  primaryThread,
}: {
  game: StreetGameState;
  primaryPerson?: StreetGameState["npcs"][number];
  primaryPlace?: StreetGameState["locations"][number];
  primaryThread?: MemoryThread;
}) {
  if (game.rowanCognition?.notebook) {
    return {
      belief: game.rowanCognition.notebook.belief,
      clue: game.rowanCognition.notebook.clue,
      confidence: game.rowanCognition.notebook.confidence,
      plan: game.rowanCognition.notebook.plan,
      title: game.rowanCognition.notebook.title,
      uncertainty: game.rowanCognition.notebook.uncertainty,
    };
  }

  const teaJob = game.jobs.find((job) => job.id === "job-tea-shift");
  const currentPlanHint =
    game.rowanAutonomy?.label ??
    game.player.objective?.outcomes.find((outcome) => outcome.status !== "met")
      ?.label;
  const completed = Boolean(game.firstAfternoon?.completedAt);
  const activeJob = game.player.activeJobId
    ? game.jobs.find((job) => job.id === game.player.activeJobId)
    : undefined;

  if (completed) {
    return {
      belief:
        "Tonight's bed holds, Ada has seen Rowan keep up, and the Morrow Yard pump is now a real local problem.",
      clue:
        game.firstAfternoon?.fieldNote?.memory ??
        "Kettle & Lamp now has a memory of Rowan following through.",
      confidence: "Earned.",
      plan:
        currentPlanHint ??
        "Rest at Morrow House, then weigh the yard work window against the Morrow Yard pump.",
      title: "A foothold, finally",
      uncertainty:
        "Whether the next useful move is paid yard work, the pump, or another live pressure that changed while Rowan worked.",
    };
  }

  if (teaJob?.completed) {
    return {
      belief:
        "The lunch shift paid, and Ada has enough evidence to treat Rowan as useful.",
      clue: "Morrow House is still the safe place to return to before the day closes.",
      confidence: "Confirmed by work.",
      plan: currentPlanHint ?? "Head back to Morrow House and take stock.",
      title: "Paid work in the pocket",
      uncertainty:
        "What the earned money changes about tonight, and what Rowan should carry into tomorrow.",
    };
  }

  if (activeJob?.id === "job-tea-shift" || teaJob?.accepted) {
    return {
      belief:
        "Ada gave Rowan a real chance at lunch work, and the only proof that matters is keeping up.",
      clue: "Ada trusts steady hands more than big promises.",
      confidence: "Committed.",
      plan: currentPlanHint ?? "Keep Kettle & Lamp moving through lunch.",
      title: "In the rush now",
      uncertainty:
        "Whether Rowan can stay steady when the room gets hot and crowded.",
    };
  }

  if (game.firstAfternoon?.leadFieldNote) {
    return {
      belief:
        "Mara's lead is verified: Ada at Kettle & Lamp has real lunch work on the table.",
      clue: game.firstAfternoon.leadFieldNote.memory,
      confidence: "Confirmed by asking Ada directly.",
      plan:
        currentPlanHint ?? "Choose whether to take the cup-and-counter shift.",
      title: "Lead verified",
      uncertainty:
        "Whether Rowan should take the shift now, check another lead, return later, or keep exploring.",
    };
  }

  if (teaJob?.discovered || game.firstAfternoon?.planSettledAt) {
    return {
      belief:
        "Mara's lead points to Ada at Kettle & Lamp; lunch work is the best first bet.",
      clue:
        primaryPerson?.id === "npc-mara"
          ? "Mara says follow-through matters more than worry."
          : "Morrow House is safe to return to if Rowan brings back something real.",
      confidence: teaJob?.discovered ? "Confirmed lead." : "Unconfirmed.",
      plan:
        currentPlanHint ?? "Walk to Kettle & Lamp and ask Ada directly.",
      title: "A useful lead",
      uncertainty: "Does Ada actually need help today?",
    };
  }

  return {
    belief:
      primaryPlace?.id === "boarding-house"
        ? "Morrow House is tonight's foothold, but it is not yet something Rowan has earned."
        : "South Quay is still mostly unknown, and Rowan needs one reliable person to ask.",
    clue:
      primaryThread?.detail ??
      "The room at Morrow House is safe for tonight, but not a future by itself.",
    confidence: "Unconfirmed.",
    plan: currentPlanHint ?? "Ask the first useful question.",
    title: "First page of the morning",
    uncertainty: "Who can turn tonight's room into tomorrow's foothold?",
  };
}

type CityPulseItem = {
  detail: string;
  id: string;
  meta?: string;
  priority: number;
  title: string;
};

function buildCityPulseItems(game: StreetGameState): CityPulseItem[] {
  const locationById = new Map(
    game.locations.map((location) => [location.id, location]),
  );
  const currentTotalMinutes = game.clock.totalMinutes;
  const dayOffsetMinutes = Math.max(0, game.clock.day - 1) * 24 * 60;
  const currentHour = game.clock.hour + game.clock.minute / 60;

  const eventItems = (game.cityEvents ?? [])
    .filter((event) => event.status === "active" || event.status === "upcoming")
    .map((event): CityPulseItem => {
      const startsIn = Math.max(
        0,
        dayOffsetMinutes + event.startMinute - currentTotalMinutes,
      );
      const endsIn = Math.max(
        0,
        dayOffsetMinutes + event.endMinute - currentTotalMinutes,
      );
      const place = locationById.get(event.locationId)?.name ?? "South Quay";
      const timing =
        event.status === "active"
          ? `active for ${formatMinutesRemaining(endsIn)}`
          : `starts in ${formatMinutesRemaining(startsIn)}`;
      const priority =
        event.status === "active"
          ? event.tone === "warning"
            ? 70
            : event.tone === "lead"
              ? 62
              : 48
          : startsIn <= 90
            ? 42
            : 22;

      return {
        detail: buildNarrativePreview(event.summary, 140),
        id: `event-${event.id}`,
        meta: `${place} • ${timing}`,
        priority,
        title: event.visibleLabel || event.title,
      };
    });

  const problemItems = (game.problems ?? [])
    .filter(
      (problem) =>
        problem.discovered &&
        (problem.status === "active" || problem.status === "expired"),
    )
    .map((problem): CityPulseItem => {
      const place = locationById.get(problem.locationId)?.name ?? "the block";
      const escalated = (problem.escalationLevel ?? 0) > 0;

      return {
        detail: escalated
          ? `${buildNarrativePreview(
              problem.summary,
              110,
            )} It has already started getting worse.`
          : buildNarrativePreview(problem.summary, 140),
        id: `problem-${problem.id}`,
        meta:
          problem.status === "expired"
            ? `${place} • already worsened`
            : `${place} • still needs handling`,
        priority: problem.status === "active" ? 82 : 50,
        title: problem.title,
      };
    });

  const jobItems = (game.jobs ?? [])
    .filter(
      (job) =>
        (job.accepted || job.discovered) && !job.completed && !job.missed,
    )
    .map((job): CityPulseItem => {
      const startTotal = dayOffsetMinutes + Math.round(job.startHour * 60);
      const endTotal = dayOffsetMinutes + Math.round(job.endHour * 60);
      const inWindow =
        currentTotalMinutes >= startTotal && currentTotalMinutes < endTotal;
      const startsIn = Math.max(0, startTotal - currentTotalMinutes);
      const endsIn = Math.max(0, endTotal - currentTotalMinutes);
      const place = locationById.get(job.locationId)?.name ?? "a job site";

      return {
        detail: buildNarrativePreview(job.summary, 140),
        id: `job-${job.id}`,
        meta: inWindow
          ? `${place} • open for ${formatMinutesRemaining(endsIn)}`
          : `${place} • opens in ${formatMinutesRemaining(startsIn)}`,
        priority: job.accepted ? 78 : inWindow ? 68 : 46,
        title: job.accepted ? `${job.title} is committed` : job.title,
      };
    });

  const npcItems = (game.npcs ?? [])
    .filter((npc) => npc.known || game.player.knownNpcIds.includes(npc.id))
    .flatMap((npc): CityPulseItem[] => {
      const nextStop = npc.schedule
        .filter((entry) => entry.fromHour > currentHour)
        .sort((left, right) => left.fromHour - right.fromHour)[0];
      if (!nextStop) {
        return [];
      }

      const startsIn = Math.max(
        0,
        Math.round((nextStop.fromHour - currentHour) * 60),
      );
      if (startsIn > 120 || nextStop.locationId === npc.currentLocationId) {
        return [];
      }

      const currentPlace =
        locationById.get(npc.currentLocationId)?.name ?? "nearby";
      const nextPlace = locationById.get(nextStop.locationId)?.name;
      if (!nextPlace) {
        return [];
      }

      return [
        {
          detail: `${npc.name} is still ${lowercaseFirst(
            trimPeriod(npc.currentConcern),
          )}.`,
          id: `npc-${npc.id}-${nextStop.locationId}`,
          meta: `${currentPlace} now • ${nextPlace} in ${formatMinutesRemaining(
            startsIn,
          )}`,
          priority: startsIn <= 45 ? 44 : 30,
          title: `${npc.name} may move soon`,
        },
      ];
    });

  return [...problemItems, ...jobItems, ...eventItems, ...npcItems]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 5);
}

function formatMinutesRemaining(minutes: number) {
  if (minutes <= 0) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainder} min`;
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
      return "Notebook";
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
