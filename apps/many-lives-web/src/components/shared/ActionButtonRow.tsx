import type { InboxAction } from "@/lib/types/game";
import { cx } from "@/lib/utils/format";

interface ActionButtonRowProps {
  actions: InboxAction[];
  selectedActionId?: string | null;
  compact?: boolean;
  onSelect: (actionId: string) => void;
}

export function ActionButtonRow({
  actions,
  selectedActionId,
  compact = false,
  onSelect,
}: ActionButtonRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const isSelected = action.id === selectedActionId;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onSelect(action.id)}
            className={cx(
              "border px-3 py-2 text-left transition-colors",
              compact ? "text-[11px] font-medium" : "text-sm font-medium",
              isSelected
                ? "border-[color:var(--border-strong)] bg-[color:var(--surface-selected)] text-[color:var(--text-main)]"
                : "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)] hover:text-[color:var(--text-main)]",
            )}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
