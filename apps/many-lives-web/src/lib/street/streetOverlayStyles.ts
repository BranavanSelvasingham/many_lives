type StreetOverlayStyleOptions = {
  compactRailBottomOffset: number;
  compactRailCollapsedHeight: number;
  compactRailExpandedHeight: number;
  compactRailWidth: number;
  dockFocusWidth: number;
  dockWidth: number;
  focusHeight: number;
  focusWidth: number;
  height: number;
  overlayInset: number;
  railMaxHeight: number;
  railWidth: number;
  width: number;
};

export function buildStreetOverlayStyle({
  compactRailBottomOffset,
  compactRailCollapsedHeight,
  compactRailExpandedHeight,
  compactRailWidth,
  dockFocusWidth,
  dockWidth,
  focusHeight,
  focusWidth,
  height,
  overlayInset,
  railMaxHeight,
  railWidth,
  width,
}: StreetOverlayStyleOptions) {
  return `
    <style>
      .ml-root {
        width: ${width}px;
        height: ${height}px;
        position: relative;
        box-sizing: border-box;
        color: #edf2f5;
        font-family: "Avenir Next", "Nunito Sans", ui-sans-serif, system-ui, sans-serif;
        pointer-events: none;
        overflow: hidden;
        --ml-inset: ${overlayInset}px;
        --ml-rail-width: ${Math.round(railWidth)}px;
        --ml-dock-width: ${Math.round(dockWidth)}px;
        --ml-dock-focus-width: ${Math.round(dockFocusWidth)}px;
        --ml-focus-width: ${Math.round(focusWidth)}px;
        --ml-focus-height: ${Math.round(focusHeight)}px;
        --ml-rail-max-height: ${Math.round(railMaxHeight)}px;
        --ml-compact-rail-bottom: ${Math.round(compactRailBottomOffset)}px;
        --ml-compact-rail-collapsed-height: ${Math.round(compactRailCollapsedHeight)}px;
        --ml-compact-rail-expanded-height: ${Math.round(compactRailExpandedHeight)}px;
        --ml-compact-rail-width: ${Math.round(compactRailWidth)}px;
      }
      .ml-root *,
      .ml-root *::before,
      .ml-root *::after {
        box-sizing: border-box;
      }
      .ml-map-edge-cues {
        position: absolute;
        z-index: 1;
        pointer-events: none;
        overflow: hidden;
      }
      .ml-map-edge-cue {
        position: absolute;
        opacity: 0;
        transition: opacity 160ms ease-out;
        pointer-events: none;
      }
      .ml-map-edge-cue::after {
        content: "";
        position: absolute;
        background: rgba(247, 222, 174, 0.92);
        box-shadow: 0 0 16px rgba(247, 222, 174, 0.54);
      }
      .ml-map-edge-cue.is-north,
      .ml-map-edge-cue.is-south {
        left: 18px;
        right: 18px;
        height: 44px;
      }
      .ml-map-edge-cue.is-west,
      .ml-map-edge-cue.is-east {
        top: 18px;
        bottom: 18px;
        width: 44px;
      }
      .ml-map-edge-cue.is-north {
        top: 0;
        background: linear-gradient(180deg, rgba(247, 222, 174, 0.2), rgba(247, 222, 174, 0));
      }
      .ml-map-edge-cue.is-south {
        bottom: 0;
        background: linear-gradient(0deg, rgba(247, 222, 174, 0.2), rgba(247, 222, 174, 0));
      }
      .ml-map-edge-cue.is-west {
        left: 0;
        background: linear-gradient(90deg, rgba(247, 222, 174, 0.22), rgba(247, 222, 174, 0));
      }
      .ml-map-edge-cue.is-east {
        right: 0;
        background: linear-gradient(270deg, rgba(247, 222, 174, 0.22), rgba(247, 222, 174, 0));
      }
      .ml-map-edge-cue.is-north::after,
      .ml-map-edge-cue.is-south::after {
        left: 0;
        right: 0;
        height: 2px;
      }
      .ml-map-edge-cue.is-west::after,
      .ml-map-edge-cue.is-east::after {
        top: 0;
        bottom: 0;
        width: 2px;
      }
      .ml-map-edge-cue.is-north::after {
        top: 0;
      }
      .ml-map-edge-cue.is-south::after {
        bottom: 0;
      }
      .ml-map-edge-cue.is-west::after {
        left: 0;
      }
      .ml-map-edge-cue.is-east::after {
        right: 0;
      }
      .ml-root:not(.is-collapsible-rail)::after {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 1;
        width: calc(var(--ml-rail-width) + var(--ml-inset) * 2 + 44px);
        pointer-events: none;
        background:
          linear-gradient(
            90deg,
            rgba(17, 29, 35, 0) 0%,
            rgba(17, 29, 35, 0.22) 12%,
            rgba(10, 18, 23, 0.78) 36%,
            rgba(8, 15, 20, 0.96) 100%
          );
        box-shadow: inset 1px 0 0 rgba(222, 235, 238, 0.07);
      }
      .ml-right-stack,
      .ml-dock {
        position: absolute;
        bottom: var(--ml-inset);
        z-index: 2;
      }
      .ml-time-pill {
        position: absolute;
        top: var(--ml-inset);
        left: var(--ml-inset);
        z-index: 3;
        pointer-events: none;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.32);
        background: rgba(9, 14, 19, 0.9);
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
        padding: 8px 10px;
        max-width: min(calc(100% - var(--ml-inset) * 2), 760px);
      }
      .ml-time-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(25, 34, 40, 0.74);
        padding: 6px 11px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(232, 238, 241, 0.84);
      }
      .ml-time-chip.is-core {
        border-color: rgba(205, 174, 115, 0.26);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
      }
      .ml-time-chip.is-core strong {
        font-size: 12px;
        letter-spacing: 0.18em;
        color: #f7e0b4;
      }
      .ml-time-chip.is-core em {
        font-style: normal;
        color: rgba(247, 227, 187, 0.74);
      }
      .ml-time-chip.is-metric {
        background: rgba(17, 24, 29, 0.82);
      }
      .ml-right-stack {
        right: var(--ml-inset);
        width: min(calc(100% - var(--ml-inset) * 2), var(--ml-rail-width));
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ml-root:not(.is-collapsible-rail) .ml-right-stack {
        top: calc(var(--ml-inset) + 52px);
        bottom: var(--ml-inset);
      }
      .ml-dock {
        left: var(--ml-inset);
        width: min(calc(100% - var(--ml-inset) * 2), var(--ml-dock-width));
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-panel {
        pointer-events: auto;
        border: 1px solid rgba(138, 151, 161, 0.22);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(12, 19, 24, 0.96), rgba(8, 13, 18, 0.93));
        box-shadow: 0 22px 46px rgba(0, 0, 0, 0.28);
      }
      .ml-rail-shell {
        min-width: 0;
        max-height: var(--ml-rail-max-height);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ml-rail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
      }
      .ml-rail-head-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-rail-heading-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .ml-rail-name {
        font-size: 28px;
        line-height: 0.98;
        font-weight: 700;
        color: rgba(247, 249, 250, 0.98);
      }
      .ml-rail-status {
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.1);
        padding: 6px 9px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.94);
      }
      .ml-rail-peek-label {
        margin-top: 10px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.62);
      }
      .ml-rail-thought {
        margin-top: 7px;
        font-size: 18px;
        line-height: 1.5;
        color: rgba(239, 243, 245, 0.96);
      }
      .ml-rail-toggle {
        flex-shrink: 0;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(28, 38, 45, 0.82);
        color: rgba(232, 238, 241, 0.9);
        padding: 10px 12px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-command-rail {
        min-width: 0;
        min-height: 0;
        flex: 1;
        overflow-y: auto;
        padding: 0 14px 14px;
        border-top: 1px solid rgba(138, 151, 161, 0.12);
        scrollbar-width: thin;
      }
      .ml-command-rail-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-top: 14px;
      }
      .ml-command-rail,
      .ml-focus-body,
      .ml-chat-transcript,
      .ml-rail-feed {
        scroll-behavior: auto;
      }
      .ml-command-rail::-webkit-scrollbar,
      .ml-focus-body::-webkit-scrollbar {
        width: 8px;
      }
      .ml-command-rail::-webkit-scrollbar-thumb,
      .ml-focus-body::-webkit-scrollbar-thumb {
        background: rgba(138, 151, 161, 0.24);
        border-radius: 999px;
      }
      .ml-dock-panel {
        padding: 12px 14px;
      }
      .ml-dock-identity {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 10px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.2);
        background:
          radial-gradient(circle at top left, rgba(205, 174, 115, 0.16), transparent 48%),
          linear-gradient(180deg, rgba(26, 33, 38, 0.9), rgba(14, 19, 24, 0.94));
        padding: 10px 12px;
      }
      .ml-dock-identity-copy {
        min-width: 0;
      }
      .ml-dock-identity-kicker {
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(236, 222, 184, 0.7);
      }
      .ml-dock-identity-name {
        margin-top: 4px;
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        color: rgba(252, 246, 230, 0.98);
      }
      .ml-dock-identity-badge {
        flex-shrink: 0;
        border-radius: 999px;
        border: 1px solid rgba(141, 208, 205, 0.28);
        background: rgba(31, 52, 55, 0.6);
        padding: 8px 10px;
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(214, 245, 243, 0.92);
      }
      .ml-kicker {
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(213, 224, 229, 0.66);
      }
      .ml-rowan-directive {
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.18);
        background: rgba(36, 30, 24, 0.56);
        padding: 13px 14px;
      }
      .ml-rowan-directive-title {
        margin-top: 7px;
        font-size: 20px;
        line-height: 1.16;
        font-weight: 700;
        color: rgba(247, 249, 250, 0.96);
      }
      .ml-rowan-directive-copy {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.58;
        color: rgba(220, 229, 233, 0.8);
      }
      .ml-rowan-directive-note {
        margin-top: 10px;
        border-left: 2px solid rgba(205, 174, 115, 0.28);
        padding-left: 10px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(235, 239, 241, 0.82);
      }
      .ml-rowan-story-card {
        border-radius: 18px;
        border: 1px solid rgba(162, 180, 189, 0.16);
        background: rgba(18, 24, 29, 0.78);
        padding: 13px 14px;
      }
      .ml-rowan-story-card.is-primary {
        border-color: rgba(205, 174, 115, 0.18);
        background: rgba(36, 30, 24, 0.56);
      }
      .ml-rowan-story-card[data-tone="conversation"] {
        border-color: rgba(121, 168, 215, 0.22);
      }
      .ml-rowan-story-card[data-tone="objective"] {
        border-color: rgba(205, 174, 115, 0.18);
      }
      .ml-rowan-story-card-title {
        margin-top: 7px;
        font-size: 18px;
        line-height: 1.18;
        font-weight: 700;
        color: rgba(247, 249, 250, 0.96);
      }
      .ml-rowan-story-card-copy {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.58;
        color: rgba(220, 229, 233, 0.8);
      }
      .ml-primary-action {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.32);
        background: linear-gradient(180deg, rgba(205, 174, 115, 0.18), rgba(127, 96, 52, 0.14));
        padding: 13px 14px;
        color: rgba(250, 239, 213, 0.98);
        cursor: pointer;
        text-align: left;
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
      }
      .ml-primary-action-label {
        font-size: 14px;
        line-height: 1.1;
        font-weight: 800;
      }
      .ml-primary-action-copy {
        font-size: 12px;
        line-height: 1.45;
        color: rgba(247, 227, 187, 0.78);
      }
      .ml-autoplay-note {
        border-radius: 16px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(20, 29, 34, 0.72);
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.48;
        color: rgba(219, 228, 233, 0.72);
      }
      .ml-rail-more {
        border-top: 1px solid rgba(138, 151, 161, 0.12);
        padding-top: 14px;
      }
      .ml-rail-more-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(20, 29, 34, 0.76);
        padding: 12px 13px;
        color: rgba(239, 243, 245, 0.94);
        cursor: pointer;
        text-align: left;
      }
      .ml-rail-more-copy {
        min-width: 0;
      }
      .ml-rail-more-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
      }
      .ml-rail-more-state {
        flex-shrink: 0;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.9);
      }
      .ml-rail-more-body {
        display: none;
        margin-top: 12px;
        flex-direction: column;
        gap: 12px;
      }
      .ml-rail-more.is-open .ml-rail-more-body {
        display: flex;
      }
      .ml-rail-context-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ml-rail-context-row {
        border-radius: 16px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(21, 30, 35, 0.72);
        padding: 11px 12px;
      }
      .ml-rail-context-row[data-tone="objective"] {
        border-color: rgba(205, 174, 115, 0.18);
        background: rgba(39, 34, 27, 0.54);
      }
      .ml-rail-context-row[data-tone="conversation"] {
        border-color: rgba(89, 165, 132, 0.2);
        background: rgba(19, 35, 33, 0.72);
      }
      .ml-rail-context-row[data-tone="problem"] {
        border-color: rgba(167, 105, 99, 0.24);
        background: rgba(44, 28, 31, 0.72);
      }
      .ml-rail-context-label {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.74);
      }
      .ml-rail-context-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
        color: rgba(239, 243, 245, 0.94);
      }
      .ml-rail-context-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(219, 228, 233, 0.78);
      }
      .ml-title {
        margin-top: 8px;
        font-size: 36px;
        line-height: 0.96;
        font-weight: 700;
      }
      .ml-copy {
        margin-top: 10px;
        max-width: 36ch;
        font-size: 16px;
        line-height: 1.42;
        color: rgba(229, 236, 239, 0.92);
      }
      .ml-badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .ml-badge {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.2);
        background: rgba(36, 46, 54, 0.72);
        padding: 7px 11px;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(231, 238, 241, 0.84);
      }
      .ml-badge.is-warm {
        border-color: rgba(205, 174, 115, 0.28);
        background: rgba(205, 174, 115, 0.1);
        color: rgba(241, 214, 160, 0.96);
      }
      .ml-badge.is-alert {
        border-color: rgba(167, 105, 99, 0.34);
        background: rgba(167, 105, 99, 0.12);
        color: rgba(246, 198, 193, 0.96);
      }
      .ml-player-meta {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(138, 151, 161, 0.14);
        font-size: 11px;
        line-height: 1.5;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(212, 221, 226, 0.64);
      }
      .ml-scene-card {
        border: 1px solid rgba(138, 151, 161, 0.18);
        border-radius: 22px;
        background: rgba(18, 28, 34, 0.72);
        padding: 14px;
      }
      .ml-scene-card + .ml-command-section {
        margin-top: 12px;
      }
      .ml-summary-card {
        padding: 16px;
        margin-bottom: 12px;
      }
      .ml-summary-title {
        margin-top: 8px;
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }
      .ml-summary-copy {
        margin-top: 10px;
        font-size: 15px;
        line-height: 1.42;
        color: rgba(229, 236, 239, 0.92);
      }
      .ml-rowan-log-card {
        margin-bottom: 12px;
        border-radius: 24px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background:
          radial-gradient(circle at top left, rgba(205, 174, 115, 0.14), transparent 34%),
          linear-gradient(180deg, rgba(18, 28, 34, 0.82), rgba(12, 19, 24, 0.94));
        padding: 16px;
      }
      .ml-rowan-log-title {
        margin-top: 8px;
        font-size: 28px;
        line-height: 1;
        font-weight: 700;
      }
      .ml-rowan-log-voice {
        margin-top: 10px;
        max-width: 18ch;
        font-size: 18px;
        line-height: 1.48;
        color: rgba(239, 243, 245, 0.96);
      }
      .ml-rowan-log-context {
        margin-top: 10px;
        max-width: 34ch;
        font-size: 13px;
        line-height: 1.58;
        color: rgba(216, 225, 229, 0.78);
      }
      .ml-rowan-flow {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-rowan-entry {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 10px;
      }
      .ml-rowan-entry-rail {
        position: relative;
        display: flex;
        justify-content: center;
      }
      .ml-rowan-entry-rail::before {
        content: "";
        position: absolute;
        top: 6px;
        bottom: -16px;
        width: 1px;
        background: rgba(138, 151, 161, 0.18);
      }
      .ml-rowan-entry:last-child .ml-rowan-entry-rail::before {
        display: none;
      }
      .ml-rowan-entry-dot {
        position: relative;
        z-index: 1;
        margin-top: 7px;
        height: 8px;
        width: 8px;
        border-radius: 999px;
        background: rgba(240, 207, 140, 0.94);
        box-shadow: 0 0 0 6px rgba(205, 174, 115, 0.08);
      }
      .ml-rowan-entry-body {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.16);
        background: rgba(24, 32, 38, 0.76);
        padding: 11px 12px;
      }
      .ml-rowan-entry-meta {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-rowan-entry-title {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 700;
        color: rgba(239, 243, 245, 0.95);
      }
      .ml-rowan-entry-copy {
        margin-top: 5px;
        font-size: 12px;
        line-height: 1.56;
        color: rgba(219, 228, 233, 0.78);
      }
      .ml-rowan-entry[data-tone="scene"] .ml-rowan-entry-dot,
      .ml-rowan-entry[data-tone="info"] .ml-rowan-entry-dot {
        background: rgba(148, 189, 212, 0.9);
        box-shadow: 0 0 0 6px rgba(69, 133, 214, 0.08);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-dot {
        background: rgba(137, 205, 175, 0.92);
        box-shadow: 0 0 0 6px rgba(89, 165, 132, 0.1);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-dot {
        background: rgba(232, 154, 145, 0.92);
        box-shadow: 0 0 0 6px rgba(167, 105, 99, 0.1);
      }
      .ml-rowan-entry[data-tone="memory"] .ml-rowan-entry-dot {
        background: rgba(210, 181, 235, 0.88);
        box-shadow: 0 0 0 6px rgba(168, 126, 205, 0.1);
      }
      .ml-rowan-entry[data-tone="objective"] .ml-rowan-entry-body,
      .ml-rowan-entry[data-tone="job"] .ml-rowan-entry-body {
        border-color: rgba(205, 174, 115, 0.2);
        background: rgba(39, 34, 27, 0.58);
      }
      .ml-rowan-entry[data-tone="scene"] .ml-rowan-entry-meta,
      .ml-rowan-entry[data-tone="info"] .ml-rowan-entry-meta {
        color: rgba(176, 206, 220, 0.74);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-body {
        border-color: rgba(89, 165, 132, 0.2);
        background: rgba(19, 35, 33, 0.76);
      }
      .ml-rowan-entry[data-tone="conversation"] .ml-rowan-entry-meta {
        color: rgba(177, 226, 204, 0.74);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-body {
        border-color: rgba(167, 105, 99, 0.24);
        background: rgba(44, 28, 31, 0.76);
      }
      .ml-rowan-entry[data-tone="problem"] .ml-rowan-entry-meta {
        color: rgba(239, 182, 176, 0.78);
      }
      .ml-rowan-entry[data-tone="memory"] .ml-rowan-entry-meta {
        color: rgba(219, 200, 238, 0.74);
      }
      .ml-summary-support {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(216, 225, 229, 0.72);
      }
      .ml-scene-title {
        margin-top: 8px;
        font-size: 20px;
        font-weight: 700;
      }
      .ml-scene-description {
        margin-top: 8px;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(216, 225, 229, 0.82);
      }
      .ml-note {
        margin-top: 10px;
        border-radius: 16px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.5;
        background: rgba(22, 31, 37, 0.84);
        border: 1px solid rgba(138, 151, 161, 0.16);
      }
      .ml-note[data-tone="lead"] {
        background: rgba(183, 146, 89, 0.1);
        border-color: rgba(183, 146, 89, 0.28);
      }
      .ml-note[data-tone="warning"] {
        background: rgba(167, 105, 99, 0.12);
        border-color: rgba(167, 105, 99, 0.28);
      }
      .ml-objective-card {
        margin-top: 14px;
      }
      .ml-dock-row,
      .ml-tab-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .ml-dock-row {
        margin-top: 10px;
      }
      .ml-tab,
      .ml-dock-button,
      .ml-focus-tab {
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.68);
        color: rgba(224, 232, 236, 0.88);
        padding: 8px 9px;
        border-radius: 999px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        text-align: center;
      }
      .ml-tab.is-active,
      .ml-dock-button.is-active,
      .ml-focus-tab.is-active {
        border-color: rgba(205, 174, 115, 0.28);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(241, 214, 160, 0.96);
      }
      .ml-tab:focus-visible,
      .ml-dock-button:focus-visible,
      .ml-focus-tab:focus-visible,
      .ml-button:focus-visible,
      .ml-person:focus-visible,
      .ml-chip:focus-visible,
      .ml-control:focus-visible,
      .ml-rail-more-toggle:focus-visible,
      .ml-rail-toggle:focus-visible,
      .ml-primary-action:focus-visible,
      .ml-submit:focus-visible,
      .ml-focus-close:focus-visible,
      .ml-loading-button:focus-visible {
        outline: 2px solid rgba(241, 214, 160, 0.92);
        outline-offset: 2px;
      }
      .ml-input:focus-visible {
        outline: 2px solid rgba(241, 214, 160, 0.76);
        outline-offset: 2px;
      }
      .ml-button {
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.84);
        padding: 12px 14px;
        text-align: left;
        color: #f0f4f6;
        cursor: pointer;
      }
      .ml-button[data-tone="high"] {
        border-color: rgba(183, 146, 89, 0.36);
        background: rgba(183, 146, 89, 0.1);
      }
      .ml-button[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-button-title {
        font-size: 14px;
        font-weight: 700;
      }
      .ml-button-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(219, 228, 233, 0.76);
      }
      .ml-people-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ml-person {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.82);
        padding: 12px;
        cursor: pointer;
        text-align: left;
        color: #eef3f5;
      }
      .ml-person.is-active {
        border-color: rgba(205, 174, 115, 0.32);
        background: rgba(183, 146, 89, 0.1);
      }
      .ml-person.has-live-thread {
        border-color: rgba(242, 201, 124, 0.3);
        box-shadow: inset 0 0 0 1px rgba(242, 201, 124, 0.08);
      }
      .ml-person-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ml-person-name {
        font-size: 13px;
        font-weight: 700;
      }
      .ml-person-live-tag {
        border-radius: 999px;
        border: 1px solid rgba(242, 201, 124, 0.22);
        background: rgba(242, 201, 124, 0.08);
        color: rgba(248, 223, 169, 0.96);
        padding: 4px 7px;
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .ml-person-meta {
        margin-top: 6px;
        font-size: 11px;
        line-height: 1.4;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(215, 224, 228, 0.66);
      }
      .ml-card {
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(17, 25, 31, 0.84);
        padding: 12px;
      }
      .ml-focus-body .ml-card {
        background: rgba(12, 19, 24, 0.8);
      }
      .ml-card-title {
        font-size: 17px;
        font-weight: 700;
      }
      .ml-mini-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ml-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ml-row {
        border-radius: 14px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(26, 34, 39, 0.82);
        padding: 9px 10px;
      }
      .ml-row-title {
        font-size: 12px;
        font-weight: 700;
      }
      .ml-row-copy {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.4;
        color: rgba(219, 228, 233, 0.76);
      }
      .ml-row-meta {
        margin-top: 6px;
        font-size: 10px;
        line-height: 1.45;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(215, 224, 228, 0.62);
      }
      .ml-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .ml-chip {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.72);
        color: rgba(232, 238, 241, 0.9);
        padding: 8px 10px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-chip[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-form {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }
      .ml-input {
        min-width: 0;
        flex: 1;
        border-radius: 12px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(10, 16, 20, 0.86);
        color: #f3f7f8;
        padding: 10px 11px;
        font-size: 12px;
      }
      .ml-submit {
        border-radius: 12px;
        border: 1px solid rgba(205, 174, 115, 0.24);
        background: rgba(205, 174, 115, 0.12);
        color: rgba(247, 227, 187, 0.96);
        padding: 10px 12px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-chat-shell {
        margin-top: 12px;
        border-radius: 22px;
        border: 1px solid rgba(205, 174, 115, 0.18);
        background: linear-gradient(180deg, rgba(16, 24, 29, 0.96), rgba(10, 15, 19, 0.98));
        padding: 12px;
      }
      .ml-chat-shell.is-rail {
        margin-top: 0;
        border-radius: 0;
        border-width: 1px 0 0;
        border-color: rgba(138, 151, 161, 0.12);
        background: none;
        padding: 16px 0 0;
      }
      .ml-chat-shell.is-live {
        border-color: rgba(241, 214, 160, 0.34);
        background: linear-gradient(180deg, rgba(17, 26, 32, 0.98), rgba(9, 15, 19, 1));
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(241, 214, 160, 0.08);
      }
      .ml-chat-shell.is-rail.is-live {
        box-shadow: none;
      }
      .ml-chat-header {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .ml-chat-avatar {
        display: flex;
        height: 36px;
        width: 36px;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.2);
        background: rgba(46, 56, 63, 0.88);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .ml-chat-head-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-chat-title {
        font-size: 17px;
        font-weight: 700;
      }
      .ml-chat-subtitle {
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.4;
        color: rgba(215, 224, 228, 0.66);
      }
      .ml-chat-context {
        margin-top: 6px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-live-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        border-radius: 999px;
        border: 1px solid rgba(205, 174, 115, 0.22);
        background: rgba(205, 174, 115, 0.08);
        padding: 6px 9px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(241, 214, 160, 0.94);
      }
      .ml-live-pill-dot {
        height: 7px;
        width: 7px;
        border-radius: 999px;
        background: rgba(241, 214, 160, 0.96);
        animation: mlPulse 1.15s ease-in-out infinite;
      }
      .ml-chat-sim-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .ml-chat-sim-card {
        border-radius: 16px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(22, 31, 37, 0.78);
        padding: 10px 11px;
      }
      .ml-chat-sim-card.is-rowan {
        border-color: rgba(69, 133, 214, 0.22);
        background: rgba(32, 54, 83, 0.42);
      }
      .ml-chat-sim-label {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(205, 174, 115, 0.76);
      }
      .ml-chat-sim-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(229, 236, 239, 0.9);
      }
      .ml-chat-transcript {
        max-height: 420px;
        min-height: 260px;
        margin-top: 12px;
        overflow-y: auto;
        padding-right: 4px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-chat-shell.is-live .ml-chat-transcript {
        max-height: 520px;
        min-height: 340px;
      }
      .ml-chat-shell.is-rail .ml-chat-transcript {
        max-height: none;
        min-height: 0;
        overflow: visible;
        padding-right: 0;
        gap: 12px;
      }
      .ml-chat-shell.is-rail.is-live .ml-chat-transcript {
        max-height: none;
        min-height: 0;
      }
      .ml-chat-row {
        display: flex;
      }
      .ml-chat-row.is-player {
        justify-content: flex-end;
      }
      .ml-chat-stack {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        max-width: 88%;
      }
      .ml-chat-stack.is-player {
        flex-direction: row-reverse;
      }
      .ml-chat-bubble-wrap {
        min-width: 0;
      }
      .ml-chat-bubble {
        border-radius: 22px;
        border-bottom-left-radius: 8px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(48, 58, 65, 0.92);
        padding: 11px 14px;
        font-size: 14px;
        line-height: 1.55;
        color: #edf3f6;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
      }
      .ml-chat-bubble.is-player {
        border-color: rgba(69, 133, 214, 0.26);
        border-bottom-left-radius: 22px;
        border-bottom-right-radius: 8px;
        background: linear-gradient(180deg, #2f95ff 0%, #0a84ff 100%);
        color: #ffffff;
      }
      .ml-chat-meta {
        margin-top: 4px;
        padding: 0 4px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(215, 224, 228, 0.58);
      }
      .ml-chat-meta.is-player {
        text-align: right;
      }
      .ml-chat-typing {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .ml-chat-dot {
        height: 8px;
        width: 8px;
        border-radius: 999px;
        background: rgba(237, 228, 212, 0.94);
        animation: mlDotPulse 0.96s ease-in-out infinite;
      }
      .ml-chat-dot:nth-child(2) {
        animation-delay: 0.12s;
      }
      .ml-chat-dot:nth-child(3) {
        animation-delay: 0.24s;
      }
      .ml-chat-caret {
        display: inline-block;
        height: 1.05em;
        width: 0.5ch;
        margin-left: 4px;
        border-radius: 999px;
        background: rgba(237, 228, 212, 0.78);
        vertical-align: -0.1em;
        animation: mlPulse 1s ease-in-out infinite;
      }
      .ml-chat-empty {
        border-radius: 18px;
        border: 1px dashed rgba(117, 128, 137, 0.22);
        padding: 14px;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(219, 228, 233, 0.72);
      }
      .ml-chat-outcome {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.22);
        background: rgba(205, 174, 115, 0.08);
        padding: 12px 14px;
      }
      .ml-chat-summary {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(138, 151, 161, 0.14);
        background: rgba(27, 36, 42, 0.76);
        padding: 12px 14px;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(224, 232, 236, 0.78);
      }
      .ml-chat-outcome-title {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(228, 191, 123, 0.92);
      }
      .ml-chat-outcome-copy {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.55;
      }
      .ml-chat-rail-note {
        margin-top: 10px;
        border-left: 2px solid rgba(205, 174, 115, 0.28);
        padding-left: 10px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(226, 233, 236, 0.8);
      }
      .ml-chat-shell.is-rail .ml-chat-empty {
        background: rgba(20, 29, 34, 0.72);
      }
      .ml-chat-shell.is-rail .ml-form {
        position: sticky;
        bottom: 0;
        z-index: 1;
        padding-top: 10px;
        background: linear-gradient(
          180deg,
          rgba(9, 14, 18, 0),
          rgba(9, 14, 18, 0.82) 24%,
          rgba(9, 14, 18, 0.98)
        );
      }
      .ml-chat-autopilot {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(205, 174, 115, 0.22);
        background: rgba(205, 174, 115, 0.08);
        padding: 12px 14px;
      }
      .ml-chat-autopilot-title {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(228, 191, 123, 0.92);
      }
      .ml-chat-autopilot-copy {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(241, 244, 245, 0.9);
      }
      @keyframes mlPulse {
        0%, 100% {
          opacity: 0.45;
          transform: scale(0.92);
        }
        50% {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes mlDotPulse {
        0%, 100% {
          opacity: 0.42;
          transform: translateY(0);
        }
        50% {
          opacity: 1;
          transform: translateY(-1px);
        }
      }
      .ml-command-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ml-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ml-control {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(32, 43, 50, 0.72);
        color: rgba(232, 238, 241, 0.9);
        padding: 9px 11px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-control[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ml-footer-copy {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.5;
        color: rgba(216, 225, 229, 0.78);
      }
      .ml-error {
        margin-top: 12px;
        border-radius: 18px;
        border: 1px solid rgba(167, 105, 99, 0.28);
        background: rgba(167, 105, 99, 0.12);
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.5;
        color: rgba(247, 213, 210, 0.96);
      }
      .ml-dock-copy {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.45;
        color: rgba(216, 225, 229, 0.74);
        text-align: center;
      }
      .ml-rail-feed {
        max-height: 156px;
        overflow-y: auto;
        padding-right: 2px;
      }
      .ml-inline-focus-window {
        width: min(var(--ml-dock-focus-width), calc(100vw - var(--ml-inset) * 2));
        min-width: min(540px, var(--ml-dock-focus-width));
        align-self: flex-start;
        max-height: min(var(--ml-focus-height), var(--ml-rail-max-height));
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ml-focus-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        padding: 20px 20px 15px;
        border-bottom: 1px solid rgba(138, 151, 161, 0.14);
        background: linear-gradient(180deg, rgba(22, 31, 37, 0.8), rgba(12, 19, 24, 0.56));
      }
      .ml-focus-copy {
        min-width: 0;
        flex: 1;
      }
      .ml-focus-title {
        margin-top: 8px;
        font-size: 30px;
        line-height: 1.02;
        font-weight: 700;
      }
      .ml-focus-copy .ml-footer-copy {
        margin-top: 10px;
        max-width: 60ch;
        line-height: 1.55;
      }
      .ml-focus-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ml-focus-nav {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .ml-focus-close {
        border-radius: 999px;
        border: 1px solid rgba(138, 151, 161, 0.18);
        background: rgba(24, 32, 38, 0.84);
        color: rgba(232, 238, 241, 0.9);
        padding: 9px 12px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .ml-focus-body {
        overflow-y: auto;
        padding: 18px 20px 20px;
      }
      .ml-focus-body .ml-card {
        padding: 14px;
      }
      .ml-focus-body .ml-row {
        padding: 11px 12px;
      }
      .ml-focus-body .ml-row-title {
        font-size: 13px;
      }
      .ml-focus-body .ml-row-copy {
        margin-top: 5px;
        font-size: 12px;
        line-height: 1.55;
      }
      .ml-focus-body .ml-list {
        gap: 10px;
      }
      .ml-focus-body .ml-mini-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
      }
      .ml-focus-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      .ml-focus-grid.is-live-conversation {
        grid-template-columns: minmax(260px, 0.76fr) minmax(0, 1.24fr);
      }
      .ml-focus-stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      @media (max-width: 1120px) {
        .ml-root {
          --ml-inset: 16px;
        }
        .ml-focus-grid {
          grid-template-columns: 1fr;
        }
        .ml-focus-grid.is-live-conversation {
          grid-template-columns: 1fr;
        }
        .ml-focus-header {
          flex-direction: column;
          align-items: stretch;
        }
        .ml-focus-controls {
          justify-content: space-between;
          align-items: center;
        }
        .ml-inline-focus-window {
          min-width: min(480px, var(--ml-dock-focus-width));
        }
      }
      @media (max-width: 960px) {
        .ml-root {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .ml-time-pill {
          position: static;
          align-self: flex-start;
          transform: none;
        }
        .ml-right-stack,
        .ml-dock {
          position: static;
          width: 100%;
          transform: none;
        }
        .ml-title {
          font-size: 24px;
        }
        .ml-copy {
          font-size: 14px;
        }
        .ml-command-rail,
        .ml-focus-body {
          max-height: min(52vh, var(--ml-rail-max-height));
          overflow-y: auto;
        }
        .ml-dock-row,
        .ml-tab-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .ml-mini-grid {
          grid-template-columns: 1fr;
        }
        .ml-people-grid {
          grid-template-columns: 1fr;
        }
        .ml-form {
          flex-direction: column;
        }
        .ml-chip-row,
        .ml-controls {
          gap: 6px;
        }
        .ml-inline-focus-window {
          min-width: 0;
          width: 100%;
          max-height: min(60vh, var(--ml-rail-max-height));
        }
      }
      @media (max-width: 560px) {
        .ml-root {
          padding: 0;
          display: block;
          overflow: hidden;
        }
        .ml-time-pill {
          position: absolute;
          top: max(var(--ml-inset), env(safe-area-inset-top));
          left: var(--ml-inset);
          z-index: 4;
          max-width: 100%;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 22px;
        }
        .ml-right-stack,
        .ml-dock {
          position: absolute;
          transform: none;
          width: auto;
          z-index: 3;
        }
        .ml-right-stack {
          right: var(--ml-inset);
          top: auto;
          bottom: calc(max(var(--ml-inset), env(safe-area-inset-bottom)) + 108px);
          width: min(48vw, 280px);
          max-width: calc(100% - var(--ml-inset) * 2);
          max-height: min(30vh, var(--ml-rail-max-height));
        }
        .ml-dock {
          left: var(--ml-inset);
          right: var(--ml-inset);
          bottom: max(var(--ml-inset), env(safe-area-inset-bottom));
        }
        .ml-time-chip {
          font-size: 9px;
          letter-spacing: 0.1em;
          padding: 5px 8px;
        }
        .ml-dock-panel {
          padding: 10px;
        }
        .ml-dock-copy {
          margin-top: 7px;
          text-align: left;
          font-size: 10px;
          line-height: 1.4;
        }
        .ml-inline-focus-window {
          width: 100%;
          max-height: min(52vh, var(--ml-rail-max-height));
        }
        .ml-focus-header {
          padding: 12px 12px 10px;
          gap: 10px;
        }
        .ml-focus-title {
          font-size: 24px;
          line-height: 1.06;
        }
        .ml-focus-copy .ml-footer-copy {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.45;
        }
        .ml-focus-controls {
          gap: 8px;
        }
        .ml-focus-nav {
          width: 100%;
          justify-content: flex-start;
        }
        .ml-focus-tab {
          flex: 1 1 calc(33.333% - 6px);
        }
        .ml-focus-body {
          padding: 12px;
        }
        .ml-focus-grid {
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .ml-focus-stack {
          gap: 10px;
        }
        .ml-right-stack {
          gap: 10px;
        }
        .ml-command-rail {
          max-height: 100%;
          padding: 8px;
        }
        .ml-command-rail > .ml-scene-card:not(.ml-summary-card) {
          display: none;
        }
        .ml-command-rail > .ml-summary-card {
          display: none;
        }
        .ml-command-rail > .ml-command-section:not(:first-of-type) {
          display: none;
        }
        .ml-scene-card {
          padding: 10px;
        }
        .ml-summary-card {
          padding: 12px;
          margin-bottom: 10px;
        }
        .ml-summary-title {
          font-size: 22px;
        }
        .ml-summary-copy {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-summary-support {
          display: none;
        }
        .ml-rowan-log-card {
          margin-bottom: 10px;
          padding: 12px;
        }
        .ml-rowan-log-title {
          font-size: 22px;
        }
        .ml-rowan-log-voice {
          margin-top: 8px;
          max-width: none;
          font-size: 14px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-rowan-log-context {
          margin-top: 8px;
          font-size: 11px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-rowan-flow {
          margin-top: 10px;
          gap: 8px;
        }
        .ml-rowan-entry:nth-of-type(n + 5) {
          display: none;
        }
        .ml-rowan-entry-body {
          padding: 10px;
        }
        .ml-rowan-entry-title {
          font-size: 13px;
        }
        .ml-rowan-entry-copy {
          font-size: 11px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-player-meta {
          display: none;
        }
        .ml-objective-card {
          margin-top: 9px;
        }
        .ml-objective-card .ml-row-copy {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-objective-card .ml-row-meta {
          display: none;
        }
        .ml-scene-title {
          font-size: 16px;
        }
        .ml-scene-description {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ml-command-section {
          gap: 8px;
        }
        .ml-button {
          padding: 10px 11px;
        }
        .ml-button-copy {
          display: none;
        }
      }
      @media (min-width: 481px) and (max-width: 760px) {
        .ml-right-stack {
          display: none;
        }
        .ml-dock {
          z-index: 4;
        }
      }
      @media (max-width: 430px) {
        .ml-right-stack {
          width: min(52vw, 250px);
        }
        .ml-time-pill {
          max-width: calc(100% - var(--ml-inset) * 2);
        }
        .ml-time-chip.is-core strong {
          font-size: 11px;
          letter-spacing: 0.14em;
        }
      }
      .ml-root.is-collapsible-rail {
        padding: 0;
        display: block;
        overflow: hidden;
      }
      .ml-root.is-collapsible-rail .ml-time-pill {
        position: absolute;
        top: max(var(--ml-inset), env(safe-area-inset-top));
        left: var(--ml-inset);
        z-index: 4;
        max-width: calc(100% - var(--ml-inset) * 2);
      }
      .ml-root.is-collapsible-rail .ml-dock {
        position: absolute;
        left: var(--ml-inset);
        right: var(--ml-inset);
        bottom: max(var(--ml-inset), env(safe-area-inset-bottom));
        width: auto;
        z-index: 4;
      }
      .ml-root.is-collapsible-rail .ml-dock-panel {
        padding: 10px;
      }
      .ml-root.is-collapsible-rail .ml-dock-panel > .ml-kicker,
      .ml-root.is-collapsible-rail .ml-dock-identity {
        display: none;
      }
      .ml-root.is-collapsible-rail .ml-dock-row {
        margin-top: 0;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
      }
      .ml-root.is-collapsible-rail .ml-dock-button {
        padding: 8px 7px;
        font-size: 9px;
        letter-spacing: 0.12em;
      }
      .ml-root.is-collapsible-rail .ml-dock-copy {
        margin-top: 8px;
        font-size: 10px;
        line-height: 1.35;
      }
      .ml-root.is-collapsible-rail .ml-right-stack {
        position: absolute;
        right: var(--ml-inset);
        bottom: calc(
          max(var(--ml-inset), env(safe-area-inset-bottom)) +
            var(--ml-compact-rail-bottom)
        );
        width: min(var(--ml-compact-rail-width), calc(100% - var(--ml-inset) * 2));
        max-width: calc(100% - var(--ml-inset) * 2);
        display: flex;
        z-index: 4;
      }
      .ml-root.is-collapsible-rail.is-phone-rail .ml-right-stack {
        left: var(--ml-inset);
        right: auto;
        width: min(360px, calc(100% - var(--ml-inset) * 2));
      }
      .ml-root.is-collapsible-rail.is-phone-rail .ml-dock {
        right: auto;
        width: min(360px, calc(100% - var(--ml-inset) * 2));
      }
      .ml-root.is-collapsible-rail.is-phone-rail .ml-time-chip.is-metric:last-child {
        display: none;
      }
      .ml-root.is-collapsible-rail .ml-rail-shell {
        width: 100%;
        max-height: var(--ml-compact-rail-expanded-height);
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-rail-shell {
        max-height: var(--ml-compact-rail-collapsed-height);
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-command-rail {
        flex: 0 0 0;
        max-height: 0;
        overflow: hidden;
        padding-top: 0;
        padding-bottom: 0;
        border-top-color: transparent;
      }
      .ml-root.is-collapsible-rail.is-rail-collapsed .ml-rail-thought {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ml-root.is-collapsible-rail .ml-rail-toggle {
        align-self: flex-start;
      }
      .ml-root.is-collapsible-rail .ml-rail-name {
        font-size: 24px;
      }
      .ml-root.is-collapsible-rail .ml-rail-thought {
        font-size: 16px;
      }
      .ml-root.is-collapsible-rail .ml-rowan-directive-title,
      .ml-root.is-collapsible-rail .ml-rowan-story-card-title {
        font-size: 18px;
      }
      .ml-root.is-collapsible-rail .ml-chat-bubble {
        font-size: 13px;
      }
      @media (max-height: 820px) and (min-width: 1081px) {
        .ml-player-panel,
        .ml-command-rail,
        .ml-dock-panel,
        .ml-inline-focus-window {
          border-radius: 20px;
        }
        .ml-title {
          font-size: 30px;
        }
      }
    </style>
`;
}
