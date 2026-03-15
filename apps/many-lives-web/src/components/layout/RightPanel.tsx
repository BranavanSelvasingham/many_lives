import { CharacterDetailView } from "@/components/characters/CharacterDetailView";
import { MessageDetailPanel } from "@/components/inbox/MessageDetailPanel";
import { PolicyPanel } from "@/components/policies/PolicyPanel";
import type {
  CharacterView,
  InboxMessageView,
  PolicySettings,
  RightPanelMode,
} from "@/lib/types/game";

interface RightPanelProps {
  mode: RightPanelMode;
  character: CharacterView | null;
  message: InboxMessageView | null;
  characters: CharacterView[];
  draftOverrideText: string;
  ruleComposerDraft: string;
  onOverrideChange: (value: string) => void;
  onResolveMessage: (messageId: string, actionId: string) => void;
  onSnoozeMessage: (messageId: string, minutes: number) => void;
  onDelegateMessage: (messageId: string, targetCharacterId: string) => void;
  onTurnIntoRule: (message: InboxMessageView) => void;
  onRuleComposerChange: (value: string) => void;
  onSavePolicy: (draft: PolicySettings) => void;
}

export function RightPanel({
  mode,
  character,
  message,
  characters,
  draftOverrideText,
  ruleComposerDraft,
  onOverrideChange,
  onResolveMessage,
  onSnoozeMessage,
  onDelegateMessage,
  onTurnIntoRule,
  onRuleComposerChange,
  onSavePolicy,
}: RightPanelProps) {
  if (mode === "message" && message) {
    return (
      <MessageDetailPanel
        message={message}
        characters={characters}
        draftOverrideText={draftOverrideText}
        onOverrideChange={onOverrideChange}
        onSendDecision={onResolveMessage}
        onSnooze={onSnoozeMessage}
        onDelegate={onDelegateMessage}
        onTurnIntoRule={onTurnIntoRule}
      />
    );
  }

  return (
    <div className="space-y-4">
      <CharacterDetailView character={character} />
      <PolicyPanel
        key={`${character?.id ?? "no-character"}-${mode}`}
        character={character}
        ruleComposerDraft={ruleComposerDraft}
        showRuleComposer={mode === "rule"}
        onRuleComposerChange={onRuleComposerChange}
        onSave={onSavePolicy}
      />
    </div>
  );
}
