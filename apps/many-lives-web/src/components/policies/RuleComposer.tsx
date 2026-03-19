import { cx } from "@/lib/utils/format";

interface RuleComposerProps {
  value: string;
  onChange: (value: string) => void;
  examples?: string[];
  title?: string;
  description?: string;
  saveLabel?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function RuleComposer({
  value,
  onChange,
  examples = [],
  title = "Set As Policy",
  description = "Turn this decision into a standing rule for future situations.",
  saveLabel = "Save Rule",
  onSave,
  onCancel,
}: RuleComposerProps) {
  return (
    <div className="space-y-3 border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] p-3">
      <div className="space-y-1">
        <div className="text-[0.95rem] font-medium text-[color:var(--text-main)]">
          {title}
        </div>
        <p className="text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
          {description}
        </p>
      </div>
      {examples.length > 0 ? (
        <div className="space-y-2">
          {examples.map((example) => {
            const isSelected = value === example;
            return (
              <button
                key={example}
                type="button"
                onClick={() => onChange(example)}
                className={cx(
                  "flex w-full items-center gap-3 border px-3 py-2 text-left text-[0.95rem] text-[color:var(--text-main)]",
                  isSelected
                    ? "border-[color:var(--border-strong)] bg-[color:var(--surface-selected)]"
                    : "border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]",
                )}
              >
                <span
                  className={cx(
                    "h-5 w-5 border",
                    isSelected
                      ? "border-[color:var(--border-strong)] bg-[color:var(--accent-steel)]"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]",
                  )}
                />
                <span>{example}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-3 text-[0.95rem] leading-6 text-[color:var(--text-main)] outline-none"
        placeholder="Ask only if family schedule is affected."
      />
      {onSave || onCancel ? (
        <div className="flex items-center justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)]"
            >
              Cancel
            </button>
          ) : null}
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              className="border border-[color:var(--border-subtle)] bg-[#e7e7e4] px-3 py-2 text-[0.95rem] font-medium text-[color:var(--text-main)]"
            >
              {saveLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
