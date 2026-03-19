import type { InboxTab } from "@/lib/types/game";
import { cx } from "@/lib/utils/format";
import { inboxTabs } from "@/lib/utils/priorities";

interface InboxTabsProps {
  activeTab: InboxTab;
  counts: Record<InboxTab, number>;
  onChange: (tab: InboxTab) => void;
}

export function InboxTabs({ activeTab, counts, onChange }: InboxTabsProps) {
  return (
    <div className="flex items-end gap-2 border-b border-[color:var(--border-subtle)]">
      {inboxTabs.map((tab) => {
        const isActive = tab === activeTab;
        const count = counts[tab];
        const label =
          count > 0 && tab !== "All" ? `${tab} (${count})` : tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cx(
              "border border-[color:var(--border-subtle)] px-4 py-2 text-[0.95rem] text-[color:var(--text-muted)]",
              isActive
                ? "border-b-[color:var(--surface-panel)] bg-[color:var(--surface-panel)] font-semibold text-[color:var(--text-main)]"
                : "bg-[color:var(--surface-overlay)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
