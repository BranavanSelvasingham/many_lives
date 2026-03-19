import { CharacterDetailView } from "@/components/characters/CharacterDetailView";
import { MessageDetailPanel } from "@/components/inbox/MessageDetailPanel";
import { PolicyPanel } from "@/components/policies/PolicyPanel";
import type { CharacterView, InboxMessageView, PolicySettings } from "@/lib/types/game";

interface RightPanelProps {
  mode: "message" | "character";
  character: CharacterView | null;
  message: InboxMessageView | null;
  characters: CharacterView[];
  draftOverrideText: string;
  ruleComposerDraft: string;
  isRuleComposerOpen: boolean;
  onCloseMessage: () => void;
  onOverrideChange: (value: string) => void;
  onResolveMessage: (messageId: string, actionId: string) => void;
  onSnoozeMessage: (messageId: string, minutes: number) => void;
  onDelegateMessage: (messageId: string, targetCharacterId: string) => void;
  onOpenRuleComposer: (message: InboxMessageView) => void;
  onCloseRuleComposer: () => void;
  onRuleComposerChange: (value: string) => void;
  onSaveRuleDraft: (message: InboxMessageView, draft: string) => void;
  onSavePolicy: (draft: PolicySettings) => void;
}

export function RightPanel({
  mode,
  character,
  message,
  characters,
  draftOverrideText,
  ruleComposerDraft,
  isRuleComposerOpen,
  onCloseMessage,
  onOverrideChange,
  onResolveMessage,
  onSnoozeMessage,
  onDelegateMessage,
  onOpenRuleComposer,
  onCloseRuleComposer,
  onRuleComposerChange,
  onSaveRuleDraft,
  onSavePolicy,
}: RightPanelProps) {
  if (mode === "message") {
    return (
      <MessageDetailPanel
        key={message?.id ?? "message-empty"}
        message={message}
        characters={characters}
        draftOverrideText={draftOverrideText}
        ruleComposerDraft={ruleComposerDraft}
        isRuleComposerOpen={isRuleComposerOpen}
        onClose={onCloseMessage}
        onOverrideChange={onOverrideChange}
        onSendDecision={onResolveMessage}
        onSnooze={onSnoozeMessage}
        onDelegate={onDelegateMessage}
        onOpenRuleComposer={onOpenRuleComposer}
        onCloseRuleComposer={onCloseRuleComposer}
        onRuleComposerChange={onRuleComposerChange}
        onSaveRuleDraft={onSaveRuleDraft}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <CharacterDetailView character={character} />
      <PolicyPanel key={character?.id ?? "no-character"} character={character} onSave={onSavePolicy} />
    </div>
  );
}
