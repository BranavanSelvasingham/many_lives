"use client";

import { useEffect, useMemo, useState } from "react";

import { BottomBar } from "@/components/layout/BottomBar";
import { CenterPanel } from "@/components/layout/CenterPanel";
import { LeftRail } from "@/components/layout/LeftRail";
import { RightPanel } from "@/components/layout/RightPanel";
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
import { filterInboxMessages } from "@/lib/utils/priorities";

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
    rightPanelMode,
    draftOverrideText,
    ruleComposerDraft,
    clearMessageSelection,
    beginRuleFromMessage,
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

  const visibleMessages = useMemo(
    () =>
      game
        ? filterInboxMessages(game.inbox, activeInboxTab, game.currentTimeIso)
        : [],
    [activeInboxTab, game],
  );

  const selectedCharacter = useMemo<CharacterView | null>(
    () =>
      game?.characters.find(
        (character) => character.id === selectedCharacterId,
      ) ?? null,
    [game, selectedCharacterId],
  );

  const selectedMessage = useMemo<InboxMessageView | null>(
    () =>
      game?.inbox.find((message) => message.id === selectedMessageId) ?? null,
    [game, selectedMessageId],
  );

  useEffect(() => {
    if (!game || !selectedMessageId || rightPanelMode !== "message") return;
    const stillVisible = visibleMessages.some(
      (message) => message.id === selectedMessageId,
    );
    if (!stillVisible) {
      clearMessageSelection();
    }
  }, [
    clearMessageSelection,
    game,
    rightPanelMode,
    selectedMessageId,
    visibleMessages,
  ]);

  const busy =
    createGameMutation.isPending ||
    gameQuery.isFetching ||
    tickMutation.isPending ||
    resolveApi.isPending ||
    updatePolicyMutation.isPending;

  return (
    <div className="min-h-screen bg-[color:var(--bg-main)] px-4 py-4 text-[color:var(--text-main)] sm:px-5 lg:px-6">
      <div className="mx-auto grid max-w-[1660px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <LeftRail
            characters={game?.characters ?? []}
            selectedCharacterId={selectedCharacterId}
            onSelectCharacter={selectCharacter}
          />
        </div>
        <div className="min-w-0">
          <CenterPanel
            messages={visibleMessages}
            selectedMessageId={selectedMessageId}
            activeInboxTab={activeInboxTab}
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
        <div className="min-w-0">
          <RightPanel
            mode={
              selectedMessage && rightPanelMode !== "rule"
                ? "message"
                : rightPanelMode
            }
            character={selectedCharacter}
            message={selectedMessage}
            characters={game?.characters ?? []}
            draftOverrideText={draftOverrideText}
            ruleComposerDraft={ruleComposerDraft}
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
            onTurnIntoRule={(message) => beginRuleFromMessage(message)}
            onRuleComposerChange={setRuleComposerDraft}
            onSavePolicy={async (draft: PolicySettings) => {
              if (!gameId || !selectedCharacter) return;
              await updatePolicyMutation.mutateAsync({
                characterId: selectedCharacter.id,
                policyPatch: buildPolicyPatchFromDraft(draft),
                draft: {
                  ...draft,
                  ruleSummary: ruleComposerDraft || draft.ruleSummary,
                },
              });
            }}
          />
        </div>
      </div>
      <div className="mx-auto mt-4 max-w-[1660px]">
        <BottomBar
          game={game}
          busy={busy}
          onNewGame={() => {
            void createGameMutation.mutateAsync().then((nextGame) => {
              setGameId(nextGame.gameId);
            });
          }}
          onTick={(minutes) => {
            if (!gameId) return;
            void tickMutation.mutateAsync(minutes);
          }}
        />
      </div>
    </div>
  );
}
