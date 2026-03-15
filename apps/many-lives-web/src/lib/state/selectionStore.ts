"use client";

import { create } from "zustand";

import type {
  GameState,
  InboxMessageView,
  InboxTab,
  RightPanelMode,
} from "@/lib/types/game";
import { filterInboxMessages } from "@/lib/utils/priorities";

interface SelectionState {
  selectedCharacterId: string | null;
  selectedMessageId: string | null;
  activeInboxTab: InboxTab;
  rightPanelMode: RightPanelMode;
  draftOverrideText: string;
  ruleComposerDraft: string;
  selectCharacter: (characterId: string) => void;
  selectMessage: (message: InboxMessageView) => void;
  setActiveInboxTab: (tab: InboxTab) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  setDraftOverrideText: (value: string) => void;
  setRuleComposerDraft: (value: string) => void;
  beginRuleFromMessage: (message: InboxMessageView) => void;
  clearMessageSelection: () => void;
  syncFromGame: (game: GameState) => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedCharacterId: null,
  selectedMessageId: null,
  activeInboxTab: "All",
  rightPanelMode: "message",
  draftOverrideText: "",
  ruleComposerDraft: "",
  selectCharacter: (characterId) =>
    set({
      selectedCharacterId: characterId,
      selectedMessageId: null,
      rightPanelMode: "character",
      draftOverrideText: "",
    }),
  selectMessage: (message) =>
    set({
      selectedCharacterId: message.characterId,
      selectedMessageId: message.id,
      rightPanelMode: "message",
      draftOverrideText: "",
    }),
  setActiveInboxTab: (tab) => set({ activeInboxTab: tab }),
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setDraftOverrideText: (value) => set({ draftOverrideText: value }),
  setRuleComposerDraft: (value) => set({ ruleComposerDraft: value }),
  beginRuleFromMessage: (message) =>
    set({
      selectedCharacterId: message.characterId,
      selectedMessageId: message.id,
      rightPanelMode: "rule",
      ruleComposerDraft: `When ${message.subject.toLowerCase()} appears, protect the most fragile commitment first.`,
    }),
  clearMessageSelection: () =>
    set({
      selectedMessageId: null,
      rightPanelMode: "character",
      draftOverrideText: "",
    }),
  syncFromGame: (game) => {
    const state = get();
    const allVisibleMessages = filterInboxMessages(
      game.inbox,
      "All",
      game.currentTimeIso,
    );
    const selectedMessageStillExists = allVisibleMessages.some(
      (message) => message.id === state.selectedMessageId,
    );
    const selectedCharacterStillExists = game.characters.some(
      (character) => character.id === state.selectedCharacterId,
    );

    if (state.selectedMessageId && !selectedMessageStillExists) {
      set({ selectedMessageId: null, draftOverrideText: "" });
    }

    if (state.selectedCharacterId && !selectedCharacterStillExists) {
      set({ selectedCharacterId: null });
    }

    const nextState = get();
    if (nextState.selectedMessageId || nextState.selectedCharacterId) {
      return;
    }

    if (allVisibleMessages.length > 0) {
      const [firstMessage] = allVisibleMessages;
      set({
        selectedMessageId: firstMessage.id,
        selectedCharacterId: firstMessage.characterId,
        rightPanelMode: "message",
      });
      return;
    }

    if (game.characters[0]) {
      set({
        selectedCharacterId: game.characters[0].id,
        rightPanelMode: "character",
      });
    }
  },
}));
