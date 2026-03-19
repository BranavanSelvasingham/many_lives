import { InboxPanel } from "@/components/inbox/InboxPanel";
import type { InboxMessageView, InboxTab } from "@/lib/types/game";

interface CenterPanelProps {
  messages: InboxMessageView[];
  selectedMessageId: string | null;
  activeInboxTab: InboxTab;
  tabCounts: Record<InboxTab, number>;
  currentTimeIso: string;
  onTabChange: (tab: InboxTab) => void;
  onSelectMessage: (message: InboxMessageView) => void;
  onInlineResolve: (messageId: string, actionId: string) => void;
}

export function CenterPanel(props: CenterPanelProps) {
  return (
    <InboxPanel
      messages={props.messages}
      selectedMessageId={props.selectedMessageId}
      activeTab={props.activeInboxTab}
      tabCounts={props.tabCounts}
      currentTimeIso={props.currentTimeIso}
      onTabChange={props.onTabChange}
      onSelect={props.onSelectMessage}
      onInlineResolve={props.onInlineResolve}
    />
  );
}
