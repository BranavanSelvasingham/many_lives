export type OverlayRenderState = {
  activeFieldKey: string | null;
  commandRailNearBottom: boolean;
  commandRailScrollTop: number | null;
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
    const commandRailIdentityMatches =
      (state.scrollIdentityByKey.get("command-rail") ?? "") ===
      (commandRail.dataset.preserveScrollKey ?? "");
    if (!commandRailIdentityMatches) {
      commandRail.scrollTop = 0;
    } else if (state.commandRailNearBottom) {
      commandRail.scrollTop = commandRail.scrollHeight;
    } else if (state.commandRailScrollTop !== null) {
      commandRail.scrollTop = Math.min(
        state.commandRailScrollTop,
        Math.max(commandRail.scrollHeight - commandRail.clientHeight, 0),
      );
    }
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
