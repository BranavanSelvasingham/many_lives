import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { InboxTabs } from "@/components/inbox/InboxTabs";
import { InboxItemCard } from "@/components/inbox/InboxItemCard";
import type { InboxMessageView, InboxTab } from "@/lib/types/game";

interface InboxPanelProps {
  messages: InboxMessageView[];
  selectedMessageId: string | null;
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  onSelect: (message: InboxMessageView) => void;
  onInlineResolve: (messageId: string, actionId: string) => void;
}

export function InboxPanel({
  messages,
  selectedMessageId,
  activeTab,
  onTabChange,
  onSelect,
  onInlineResolve,
}: InboxPanelProps) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="What"
        title="Attention Feed"
        detail={`${messages.length} visible`}
      />
      <InboxTabs activeTab={activeTab} onChange={onTabChange} />
      {messages.length === 0 ? (
        <EmptyState
          title="Nothing is asking right now"
          body={`The ${activeTab.toLowerCase()} filter is quiet. Advance time or inspect a life directly.`}
        />
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <InboxItemCard
              key={message.id}
              message={message}
              selected={message.id === selectedMessageId}
              onSelect={onSelect}
              onInlineResolve={onInlineResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
