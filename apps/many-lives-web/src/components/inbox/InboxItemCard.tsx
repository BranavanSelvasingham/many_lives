import type { InboxMessageView } from "@/lib/types/game";
import { cx, formatTimeAgo } from "@/lib/utils/format";

interface InboxItemCardProps {
  message: InboxMessageView;
  selected: boolean;
  currentTimeIso: string;
  onSelect: (message: InboxMessageView) => void;
  onInlineResolve: (messageId: string, actionId: string) => void;
}

export function InboxItemCard({
  message,
  selected,
  currentTimeIso,
  onSelect,
  onInlineResolve,
}: InboxItemCardProps) {
  const quickAction = message.suggestedActions[0];

  return (
    <div
      className={cx(
        "border bg-[color:var(--surface-panel)] px-4 py-4",
        selected
          ? "border-[color:var(--border-strong)] bg-[color:var(--surface-selected)]"
          : "border-[color:var(--border-subtle)]",
      )}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onSelect(message)}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]">
            <ThreadGlyph />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[1rem] font-semibold text-[color:var(--text-main)]">
              {message.subject}
            </div>
            <div className="mt-1 text-[0.95rem] text-[color:var(--text-muted)]">
              {message.senderName} • {formatTimeAgo(message.createdAtIso, currentTimeIso)}
            </div>
            <div className="mt-1 truncate text-[0.95rem] text-[color:var(--text-muted)]">
              {message.preview}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center text-[color:var(--text-muted)]">
            {message.priority === "urgent" || message.requiresResponse ? (
              <AlertGlyph />
            ) : (
              <OpenGlyph />
            )}
          </div>
        </button>
        {quickAction ? (
          <button
            type="button"
            onClick={() => onInlineResolve(message.id, quickAction.id)}
            className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)]"
          >
            {quickAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ThreadGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5" y="4" width="14" height="16" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OpenGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="5" y="5" width="14" height="14" />
      <path d="M9 15l6-6" />
      <path d="M11 9h4v4" />
    </svg>
  );
}
