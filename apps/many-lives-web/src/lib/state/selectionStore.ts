"use client";

import { create } from "zustand";

import type { GameState, InboxMessageView, InboxTab } from "@/lib/types/game";
import {
  filterInboxMessages,
  findDefaultMessage,
} from "@/lib/utils/priorities";

interface SelectionState {
  selectedCharacterId: string | null;
  selectedMessageId: string | null;
  activeInboxTab: InboxTab;
  draftOverrideText: string;
  ruleComposerDraft: string;
  isRuleComposerOpen: boolean;
  selectCharacter: (characterId: string) => void;
  selectMessage: (message: InboxMessageView) => void;
  setActiveInboxTab: (tab: InboxTab) => void;
  setDraftOverrideText: (value: string) => void;
  setRuleComposerDraft: (value: string) => void;
  openRuleComposer: (message: InboxMessageView) => void;
  closeRuleComposer: () => void;
  clearMessageSelection: () => void;
  syncFromGame: (game: GameState) => void;
}

function defaultRuleDraft(message: InboxMessageView) {
  return `When ${message.subject.toLowerCase()} opens a decisive room, pursue the gain without letting integrity collapse or rivals frame the story first.`;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedCharacterId: null,
  selectedMessageId: null,
  activeInboxTab: "All",
  draftOverrideText: "",
  ruleComposerDraft: "",
  isRuleComposerOpen: false,
  selectCharacter: (characterId) =>
    set({
      selectedCharacterId: characterId,
    }),
  selectMessage: (message) =>
    set((state) => ({
      selectedCharacterId: message.characterId,
      selectedMessageId: message.id,
      draftOverrideText:
        state.selectedMessageId === message.id ? state.draftOverrideText : "",
      isRuleComposerOpen:
        state.selectedMessageId === message.id ? state.isRuleComposerOpen : false,
      ruleComposerDraft:
        state.selectedMessageId === message.id && state.ruleComposerDraft
          ? state.ruleComposerDraft
          : defaultRuleDraft(message),
    })),
  setActiveInboxTab: (tab) => set({ activeInboxTab: tab }),
  setDraftOverrideText: (value) => set({ draftOverrideText: value }),
  setRuleComposerDraft: (value) => set({ ruleComposerDraft: value }),
  openRuleComposer: (message) =>
    set((state) => ({
      selectedCharacterId: message.characterId,
      selectedMessageId: message.id,
      isRuleComposerOpen: true,
      ruleComposerDraft:
        state.selectedMessageId === message.id && state.ruleComposerDraft
          ? state.ruleComposerDraft
          : defaultRuleDraft(message),
    })),
  closeRuleComposer: () => set({ isRuleComposerOpen: false }),
  clearMessageSelection: () =>
    set({
      selectedMessageId: null,
      draftOverrideText: "",
      isRuleComposerOpen: false,
    }),
  syncFromGame: (game) => {
    const state = get();
    const visibleMessages = filterInboxMessages(
      game.inbox,
      "All",
      game.currentTimeIso,
    );
    const selectedMessage = visibleMessages.find(
      (message) => message.id === state.selectedMessageId,
    );
    const selectedCharacterStillExists = game.characters.some(
      (character) => character.id === state.selectedCharacterId,
    );

    if (state.selectedMessageId && !selectedMessage) {
      set({
        selectedMessageId: null,
        draftOverrideText: "",
        isRuleComposerOpen: false,
      });
    }

    if (state.selectedCharacterId && !selectedCharacterStillExists) {
      set({ selectedCharacterId: null });
    }

    const nextState = get();
    if (nextState.selectedMessageId && !nextState.selectedCharacterId) {
      const messageMatch = visibleMessages.find(
        (message) => message.id === nextState.selectedMessageId,
      );
      if (messageMatch) {
        set({ selectedCharacterId: messageMatch.characterId });
      }
      return;
    }

    if (nextState.selectedMessageId || nextState.selectedCharacterId) {
      return;
    }

    const defaultMessage = findDefaultMessage(game.inbox, game.currentTimeIso);
    if (defaultMessage) {
      set({
        selectedMessageId: defaultMessage.id,
        selectedCharacterId: defaultMessage.characterId,
        ruleComposerDraft: defaultRuleDraft(defaultMessage),
      });
      return;
    }

    if (game.characters[0]) {
      set({
        selectedCharacterId: game.characters[0].id,
      });
    }
  },
}));
