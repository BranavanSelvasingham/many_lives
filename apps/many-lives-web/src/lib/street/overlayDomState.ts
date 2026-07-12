export type OverlayRenderState = {
  activeFieldKey: string | null;
  commandRailNearBottom: boolean;
  commandRailScrollTop: number | null;
  commandRailWasCollapsed: boolean;
  fieldSelectionEnd: number | null;
  fieldSelectionStart: number | null;
  fieldValueByKey: Map<string, string>;
  focusedTagName: string | null;
  scrollIdentityByKey: Map<string, string>;
  scrollTopByKey: Map<string, number>;
  transcriptNearBottom: boolean;
  transcriptScrollTop: number | null;
};

export function isOverlayTextInputFocused(root: HTMLDivElement | null) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  if (!root || !root.contains(activeElement)) {
    return false;
  }

  return Boolean(
    activeElement.closest('input, textarea, [contenteditable="true"]'),
  );
}

export function isOverlayEventTarget(
  root: HTMLDivElement | null,
  target: EventTarget | null,
) {
  return target instanceof Node && Boolean(root?.contains(target));
}

export function captureOverlayRenderState(
  root: HTMLDivElement,
): OverlayRenderState {
  const activeElement = document.activeElement;
  const activeField =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
      ? activeElement
      : null;
  const fieldValueByKey = new Map<string, string>();
  const scrollIdentityByKey = new Map<string, string>();
  const scrollTopByKey = new Map<string, number>();
  const commandRail = root.querySelector<HTMLElement>(
    '[data-preserve-scroll="command-rail"]',
  );
  const transcript = root.querySelector<HTMLElement>(
    '[data-chat-transcript="true"]',
  );

  root
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("[data-overlay-field-key]")
    .forEach((field) => {
      const key = field.dataset.overlayFieldKey;
      if (key) {
        fieldValueByKey.set(key, field.value);
      }
    });

  root
    .querySelectorAll<HTMLElement>("[data-preserve-scroll]")
    .forEach((element) => {
      const key = element.dataset.preserveScroll;
      if (key) {
        scrollIdentityByKey.set(key, element.dataset.preserveScrollKey ?? "");
        scrollTopByKey.set(key, element.scrollTop);
      }
    });

  return {
    activeFieldKey:
      activeField && root.contains(activeField)
        ? (activeField.dataset.overlayFieldKey ?? null)
        : null,
    commandRailNearBottom: commandRail
      ? commandRail.scrollHeight -
          commandRail.scrollTop -
          commandRail.clientHeight <
        56
      : false,
    commandRailScrollTop: commandRail?.scrollTop ?? null,
    commandRailWasCollapsed: Boolean(
      root.querySelector(".ml-root.is-rail-collapsed"),
    ),
    fieldSelectionEnd: activeField?.selectionEnd ?? null,
    fieldSelectionStart: activeField?.selectionStart ?? null,
    fieldValueByKey,
    focusedTagName:
      activeElement instanceof HTMLElement && root.contains(activeElement)
        ? activeElement.tagName
        : null,
    scrollIdentityByKey,
    scrollTopByKey,
    transcriptNearBottom: transcript
      ? transcript.scrollHeight -
          transcript.scrollTop -
          transcript.clientHeight <
        48
      : false,
    transcriptScrollTop: transcript?.scrollTop ?? null,
  };
}

export function restoreOverlayRenderState(
  root: HTMLDivElement,
  state: OverlayRenderState,
) {
  root
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("[data-overlay-field-key]")
    .forEach((field) => {
      const key = field.dataset.overlayFieldKey;
      if (!key) {
        return;
      }

      const nextValue = state.fieldValueByKey.get(key);
      if (nextValue !== undefined && field.value !== nextValue) {
        field.value = nextValue;
      }
    });

  root
    .querySelectorAll<HTMLElement>("[data-preserve-scroll]")
    .forEach((element) => {
      const key = element.dataset.preserveScroll;
      if (!key) {
        return;
      }

      const previousIdentity = state.scrollIdentityByKey.get(key) ?? "";
      const nextIdentity = element.dataset.preserveScrollKey ?? "";
      if (previousIdentity !== nextIdentity) {
        return;
      }

      const nextScrollTop = state.scrollTopByKey.get(key);
      if (nextScrollTop !== undefined) {
        element.scrollTop = nextScrollTop;
      }
    });

  const commandRail = root.querySelector<HTMLElement>(
    '[data-preserve-scroll="command-rail"]',
  );
  if (commandRail) {
    const commandRailWasOpened =
      state.commandRailWasCollapsed &&
      Boolean(root.querySelector(".ml-root.is-rail-expanded"));
    const commandRailIdentityMatches =
      (state.scrollIdentityByKey.get("command-rail") ?? "") ===
      (commandRail.dataset.preserveScrollKey ?? "");
    if (commandRailWasOpened) {
      commandRail.scrollTop = 0;
    } else if (!commandRailIdentityMatches) {
      scrollCommandRailToDirective(commandRail);
    } else if (state.commandRailNearBottom) {
      commandRail.scrollTop = commandRail.scrollHeight;
    } else if (state.commandRailScrollTop !== null) {
      commandRail.scrollTop = Math.min(
        state.commandRailScrollTop,
        Math.max(commandRail.scrollHeight - commandRail.clientHeight, 0),
      );
    }
    ensureCommandRailDirectiveVisible(commandRail);
    ensureCommandRailConversationVisible(commandRail);
  }

  const transcript = root.querySelector<HTMLElement>(
    '[data-chat-transcript="true"]',
  );
  if (transcript) {
    if (state.transcriptNearBottom) {
      transcript.scrollTop = transcript.scrollHeight;
    } else if (state.transcriptScrollTop !== null) {
      transcript.scrollTop = Math.min(
        state.transcriptScrollTop,
        Math.max(transcript.scrollHeight - transcript.clientHeight, 0),
      );
    }
  }

  if (!state.activeFieldKey) {
    return;
  }

  const restoredField = root.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(`[data-overlay-field-key="${CSS.escape(state.activeFieldKey)}"]`);
  if (!restoredField) {
    return;
  }

  restoredField.focus({ preventScroll: true });
  if (
    state.fieldSelectionStart !== null &&
    state.fieldSelectionEnd !== null &&
    typeof restoredField.setSelectionRange === "function"
  ) {
    restoredField.setSelectionRange(
      state.fieldSelectionStart,
      state.fieldSelectionEnd,
    );
  }
}

function commandRailDirective(commandRail: HTMLElement) {
  return commandRail.querySelector<HTMLElement>(
    '[data-rowan-directive="true"]',
  );
}

function scrollCommandRailToDirective(commandRail: HTMLElement) {
  const directive = commandRailDirective(commandRail);
  if (!directive) {
    commandRail.scrollTop = 0;
    return;
  }

  const railRect = commandRail.getBoundingClientRect();
  const directiveRect = directive.getBoundingClientRect();
  commandRail.scrollTop = Math.max(
    commandRail.scrollTop + directiveRect.top - railRect.top - 10,
    0,
  );
}

function ensureCommandRailDirectiveVisible(commandRail: HTMLElement) {
  const directive = commandRailDirective(commandRail);
  if (!directive) {
    return;
  }

  const railRect = commandRail.getBoundingClientRect();
  const directiveRect = directive.getBoundingClientRect();
  const visibleHeight =
    Math.min(directiveRect.bottom, railRect.bottom) -
    Math.max(directiveRect.top, railRect.top);
  const minimumReadableHeight = Math.min(
    directiveRect.height,
    railRect.height,
    160,
  );
  if (
    directiveRect.top < railRect.top ||
    visibleHeight < minimumReadableHeight
  ) {
    scrollCommandRailToDirective(commandRail);
  }
}

function ensureCommandRailConversationVisible(commandRail: HTMLElement) {
  const rows = Array.from(
    commandRail.querySelectorAll<HTMLElement>(".ml-chat-row"),
  );
  const latestRow = rows.at(-1);
  if (!latestRow) {
    return;
  }

  const railRect = commandRail.getBoundingClientRect();
  const meaningfulRows = rows.filter(conversationRowHasSpokenText);
  const latestMeaningfulRow = meaningfulRows.at(-1) ?? latestRow;
  const latestRowIsTyping = latestRow !== latestMeaningfulRow;
  const preferredExchange = latestRowIsTyping
    ? [...meaningfulRows.slice(-2), latestRow]
    : meaningfulRows.slice(-2);
  const latestMeaningfulExchange =
    latestRowIsTyping && latestMeaningfulRow
      ? [latestMeaningfulRow, latestRow]
      : [latestMeaningfulRow];
  const preferredRect = rectForConversationElements(
    preferredExchange.length > 0 ? preferredExchange : [latestRow],
  );
  const latestMeaningfulRect = rectForConversationElements(
    latestMeaningfulExchange,
  );
  const latestRowRect = latestRow.getBoundingClientRect();
  const targetRect =
    preferredRect && rectFitsCommandRail(preferredRect, railRect)
      ? preferredRect
      : latestMeaningfulRect &&
          rectFitsCommandRail(latestMeaningfulRect, railRect)
        ? latestMeaningfulRect
        : latestRowRect;

  if (
    targetRect.bottom <= railRect.bottom - 8 &&
    targetRect.top >= railRect.top + 8
  ) {
    return;
  }

  let nextScrollTop = commandRail.scrollTop;
  if (targetRect.bottom > railRect.bottom - 8) {
    nextScrollTop += targetRect.bottom - railRect.bottom + 14;
  }
  if (targetRect.top < railRect.top + 8) {
    nextScrollTop += targetRect.top - railRect.top - 10;
  }

  commandRail.scrollTop = Math.max(nextScrollTop, 0);
}

function conversationRowHasSpokenText(row: HTMLElement) {
  return Boolean(
    row
      .querySelector<HTMLElement>(".ml-chat-bubble")
      ?.textContent?.replace(/\s+/g, " ")
      .trim(),
  );
}

function rectForConversationElements(elements: HTMLElement[]) {
  const rects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length === 0) {
    return null;
  }

  return {
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    height:
      Math.max(...rects.map((rect) => rect.bottom)) -
      Math.min(...rects.map((rect) => rect.top)),
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
    top: Math.min(...rects.map((rect) => rect.top)),
    width:
      Math.max(...rects.map((rect) => rect.right)) -
      Math.min(...rects.map((rect) => rect.left)),
  };
}

function rectFitsCommandRail(
  rect: DOMRect | ReturnType<typeof rectForConversationElements>,
  railRect: DOMRect,
) {
  return Boolean(rect && rect.height + 24 <= railRect.height);
}
