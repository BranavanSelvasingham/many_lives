import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import { ActionButtonRow } from "@/components/shared/ActionButtonRow";
import type { InboxMessageView } from "@/lib/types/game";

interface InboxItemCardProps {
  message: InboxMessageView;
  selected: boolean;
  onSelect: (message: InboxMessageView) => void;
  onInlineResolve: (messageId: string, actionId: string) => void;
}

export function InboxItemCard({
  message,
  selected,
  onSelect,
  onInlineResolve,
}: InboxItemCardProps) {
  const inlineActions = message.suggestedActions.slice(0, 3);

  return (
    <Card
      tone={selected ? "selected" : "raised"}
      className="space-y-4"
      onClick={() => onSelect(message)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[color:var(--text-main)]">
            {message.senderName}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            {message.createdAt}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <PillTag label={message.priority} tone={message.priority} />
          {message.requiresResponse ? (
            <PillTag label="Needs response" tone="schedule" />
          ) : null}
        </div>
      </div>
      <div>
        <div className="font-display text-xl text-[color:var(--text-main)]">
          {message.subject}
        </div>
        <div className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
          {message.preview}
        </div>
      </div>
      {inlineActions.length > 0 ? (
        <ActionButtonRow
          actions={inlineActions}
          compact
          onSelect={(actionId) => onInlineResolve(message.id, actionId)}
        />
      ) : null}
    </Card>
  );
}
