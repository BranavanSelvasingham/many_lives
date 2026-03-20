import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { InboxTabs } from "@/components/inbox/InboxTabs";
import { InboxItemCard } from "@/components/inbox/InboxItemCard";
import type { InboxMessageView, InboxTab } from "@/lib/types/game";

interface InboxPanelProps {
  messages: InboxMessageView[];
  selectedMessageId: string | null;
  activeTab: InboxTab;
  tabCounts: Record<InboxTab, number>;
  currentTimeIso: string;
  onTabChange: (tab: InboxTab) => void;
  onSelect: (message: InboxMessageView) => void;
  onInlineResolve: (messageId: string, actionId: string) => void;
}

export function InboxPanel({
  messages,
  selectedMessageId,
  activeTab,
  tabCounts,
  currentTimeIso,
  onTabChange,
  onSelect,
  onInlineResolve,
}: InboxPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
      <div className="flex-none border-b border-[color:var(--border-subtle)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.1rem] font-semibold uppercase tracking-[0.03em] text-[color:var(--text-main)]">
            Attention Feed
          </h2>
          <div className="flex items-center gap-2 text-[color:var(--text-muted)]">
            <HeaderIcon label="Comments">
              <CommentGlyph />
            </HeaderIcon>
            <HeaderIcon label="More">
              <DotsGlyph />
            </HeaderIcon>
          </div>
        </div>
        <div className="mt-4">
          <InboxTabs
            activeTab={activeTab}
            counts={tabCounts}
            onChange={onTabChange}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <EmptyState
            title={`No ${activeTab.toLowerCase()} threads right now`}
            body="Advance the window or shift filters to surface another decisive thread."
          />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <InboxItemCard
                key={message.id}
                message={message}
                selected={message.id === selectedMessageId}
                currentTimeIso={currentTimeIso}
                onSelect={onSelect}
                onInlineResolve={onInlineResolve}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface HeaderIconProps {
  label: string;
  children: ReactNode;
}

function HeaderIcon({ label, children }: HeaderIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]"
    >
      {children}
    </button>
  );
}

function CommentGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 5h16v10H9l-5 4V5z" />
    </svg>
  );
}

function DotsGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="6" width="18" height="12" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
