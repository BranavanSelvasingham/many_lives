"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BottomBar } from "@/components/layout/BottomBar";
import { CenterPanel } from "@/components/layout/CenterPanel";
import { LeftRail } from "@/components/layout/LeftRail";
import { RightPanel } from "@/components/layout/RightPanel";
import { PillTag } from "@/components/shared/PillTag";
import { useCreateGame } from "@/lib/hooks/useCreateGame";
import { useGameState } from "@/lib/hooks/useGameState";
import { useResolveMessage } from "@/lib/hooks/useResolveMessage";
import { useTickGame } from "@/lib/hooks/useTickGame";
import { useUpdatePolicy } from "@/lib/hooks/useUpdatePolicy";
import { useSelectionStore } from "@/lib/state/selectionStore";
import type {
  CharacterView,
  InboxMessageView,
  PolicySettings,
} from "@/lib/types/game";
import { buildPolicyPatchFromDraft } from "@/lib/utils/mockData";
import {
  buildInboxTabCounts,
  filterInboxMessages,
  findFirstUrgentMessage,
} from "@/lib/utils/priorities";

export function AppShell() {
  const [gameId, setGameId] = useState<string | null>(null);
  const createGameMutation = useCreateGame();
  const gameQuery = useGameState(gameId);
  const tickMutation = useTickGame(gameId);
  const resolveApi = useResolveMessage(gameId);
  const updatePolicyMutation = useUpdatePolicy(gameId);

  const {
    selectedCharacterId,
    selectedMessageId,
    activeInboxTab,
    draftOverrideText,
    ruleComposerDraft,
    isRuleComposerOpen,
    clearMessageSelection,
    closeRuleComposer,
    openRuleComposer,
    selectCharacter,
    selectMessage,
    setActiveInboxTab,
    setDraftOverrideText,
    setRuleComposerDraft,
    syncFromGame,
  } = useSelectionStore();

  const game = gameQuery.data ?? createGameMutation.data ?? null;

  useEffect(() => {
    if (gameId || createGameMutation.isPending) return;

    void createGameMutation.mutateAsync().then((nextGame) => {
      setGameId(nextGame.gameId);
    });
  }, [gameId, createGameMutation]);

  useEffect(() => {
    if (game) {
      syncFromGame(game);
    }
  }, [game, syncFromGame]);

  const allVisibleMessages = useMemo(
    () =>
      game ? filterInboxMessages(game.inbox, "All", game.currentTimeIso) : [],
    [game],
  );

  const visibleMessages = useMemo(
    () =>
      game
        ? filterInboxMessages(game.inbox, activeInboxTab, game.currentTimeIso)
        : [],
    [activeInboxTab, game],
  );

  const tabCounts = useMemo(
    () =>
      game
        ? buildInboxTabCounts(game.inbox, game.currentTimeIso)
        : {
            All: 0,
            Urgent: 0,
            Waiting: 0,
            Reports: 0,
          },
    [game],
  );

  const characters = useMemo(() => game?.characters ?? [], [game]);

  const selectedCharacter = useMemo<CharacterView | null>(
    () =>
      characters.find(
        (character) => character.id === selectedCharacterId,
      ) ?? null,
    [characters, selectedCharacterId],
  );

  const selectedMessage = useMemo<InboxMessageView | null>(
    () =>
      allVisibleMessages.find((message) => message.id === selectedMessageId) ??
      null,
    [allVisibleMessages, selectedMessageId],
  );

  const fallbackMessage = useMemo(
    () =>
      game ? findFirstUrgentMessage(game.inbox, game.currentTimeIso) ?? null : null,
    [game],
  );

  const fallbackCharacter = characters[0] ?? null;
  const messageCharacter =
    characters.find(
      (character) =>
        character.id ===
        (selectedMessage?.characterId ?? fallbackMessage?.characterId),
    ) ?? null;

  const rightPanelMode: "message" | "character" =
    selectedMessage || (!selectedCharacter && fallbackMessage)
      ? "message"
      : "character";
  const rightPanelMessage = selectedMessage ?? fallbackMessage;
  const rightPanelCharacter =
    selectedCharacter ??
    (rightPanelMode === "message" ? messageCharacter : fallbackCharacter);

  const busy =
    createGameMutation.isPending ||
    gameQuery.isFetching ||
    tickMutation.isPending ||
    resolveApi.isPending ||
    updatePolicyMutation.isPending;

  const createNewGame = () => {
    void createGameMutation.mutateAsync().then((nextGame) => {
      setGameId(nextGame.gameId);
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-[color:var(--bg-main)] text-[color:var(--text-main)]">
      <div className="mx-auto flex h-full max-w-[1540px] flex-col gap-4 px-3 py-3">
        <header className="relative flex flex-none items-center justify-end border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-4 py-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-center">
            <h1 className="font-display text-[2rem] font-semibold tracking-[0.01em] text-[color:var(--text-main)]">
              Many Lives
            </h1>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            {game?.source === "mock" ? (
              <PillTag label="Mock Mode" tone="mock" />
            ) : null}
            <TopBarIcon label="Mail">
              <MailGlyph />
            </TopBarIcon>
            <TopBarIcon label="Panels">
              <PanelsGlyph />
            </TopBarIcon>
            <TopBarIcon label="Close">
              <CloseGlyph />
            </TopBarIcon>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[22%_46%_32%]">
          <div className="min-h-0">
            <LeftRail
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={selectCharacter}
            />
          </div>
          <div className="min-h-0">
            <CenterPanel
              messages={visibleMessages}
              selectedMessageId={selectedMessageId}
              activeInboxTab={activeInboxTab}
              tabCounts={tabCounts}
              currentTimeIso={game?.currentTimeIso ?? new Date().toISOString()}
              onTabChange={setActiveInboxTab}
              onSelectMessage={selectMessage}
              onInlineResolve={async (messageId, actionId) => {
                if (!gameId) return;
                await resolveApi.resolveMessage({
                  messageId,
                  actionId,
                });
                clearMessageSelection();
              }}
            />
          </div>
          <div className="min-h-0 lg:col-span-2 xl:col-span-1">
            <RightPanel
              mode={rightPanelMode}
              character={rightPanelCharacter}
              message={rightPanelMessage}
              characters={characters}
              draftOverrideText={draftOverrideText}
              ruleComposerDraft={ruleComposerDraft}
              isRuleComposerOpen={isRuleComposerOpen}
              onCloseMessage={clearMessageSelection}
              onOverrideChange={setDraftOverrideText}
              onResolveMessage={async (messageId, actionId) => {
                if (!gameId) return;
                await resolveApi.resolveMessage({
                  messageId,
                  actionId,
                  overrideText: draftOverrideText,
                });
                clearMessageSelection();
                setDraftOverrideText("");
              }}
              onSnoozeMessage={async (messageId, minutes) => {
                if (!gameId) return;
                await resolveApi.snoozeMessage({
                  messageId,
                  durationMinutes: minutes,
                });
                clearMessageSelection();
              }}
              onDelegateMessage={async (messageId, targetCharacterId) => {
                if (!gameId) return;
                await resolveApi.delegateMessage({
                  messageId,
                  targetCharacterId,
                });
                clearMessageSelection();
              }}
              onOpenRuleComposer={openRuleComposer}
              onCloseRuleComposer={closeRuleComposer}
              onRuleComposerChange={setRuleComposerDraft}
              onSaveRuleDraft={async (message, draft) => {
                if (!gameId) return;
                const targetCharacter = characters.find(
                  (character) => character.id === message.characterId,
                );
                if (!targetCharacter) return;

                const nextDraft: PolicySettings = {
                  ...targetCharacter.policy,
                  ruleSummary: draft,
                };

                await updatePolicyMutation.mutateAsync({
                  characterId: targetCharacter.id,
                  policyPatch: buildPolicyPatchFromDraft(nextDraft),
                  draft: nextDraft,
                });
                closeRuleComposer();
              }}
              onSavePolicy={async (draft: PolicySettings) => {
                if (!gameId || !rightPanelCharacter) return;
                await updatePolicyMutation.mutateAsync({
                  characterId: rightPanelCharacter.id,
                  policyPatch: buildPolicyPatchFromDraft(draft),
                  draft,
                });
              }}
            />
          </div>
        </div>
        <div className="flex-none">
          <BottomBar
            game={game}
            busy={busy}
            onNewGame={createNewGame}
            onTick={(minutes) => {
              if (!gameId) return;
              void tickMutation.mutateAsync(minutes);
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface TopBarIconProps {
  label: string;
  children: ReactNode;
}

function TopBarIcon({ label, children }: TopBarIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] text-[color:var(--text-muted)]"
    >
      {children}
    </button>
  );
}

function MailGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="5" width="18" height="14" />
      <path d="M4 6l8 7 8-7" />
    </svg>
  );
}

function PanelsGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="4" y="4" width="10" height="16" />
      <rect x="14" y="8" width="6" height="12" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="4" y="4" width="16" height="16" />
      <path d="M8 8l8 8" />
      <path d="M16 8l-8 8" />
    </svg>
  );
}
