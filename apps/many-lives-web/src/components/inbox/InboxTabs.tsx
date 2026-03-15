import type { InboxTab } from "@/lib/types/game";
import { inboxTabs } from "@/lib/utils/priorities";
import { cx } from "@/lib/utils/format";

interface InboxTabsProps {
  activeTab: InboxTab;
  onChange: (tab: InboxTab) => void;
}

export function InboxTabs({ activeTab, onChange }: InboxTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {inboxTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cx(
            "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
            tab === activeTab
              ? "border-[color:var(--accent-cyan)] bg-[color:var(--surface-selected)] text-[color:var(--text-main)]"
              : "border-white/10 bg-white/[0.03] text-[color:var(--text-dim)] hover:border-white/20 hover:text-[color:var(--text-main)]",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
