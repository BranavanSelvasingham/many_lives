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
              "rounded-full border px-3 py-2 text-left transition-colors",
              compact ? "text-xs font-medium" : "text-sm font-medium",
              isSelected
                ? "border-[color:var(--accent-cyan)] bg-[color:var(--surface-selected)] text-[color:var(--text-main)]"
                : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:border-white/20 hover:text-[color:var(--text-main)]",
            )}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
