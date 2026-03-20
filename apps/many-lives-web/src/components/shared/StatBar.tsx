import { cx } from "@/lib/utils/format";

interface StatBarProps {
  label: string;
  value: number;
  tone?: string;
}

const toneClasses: Record<string, string> = {
  urgent: "bg-[#d8b867]",
  high: "bg-[#8f6f44]",
  normal: "bg-[#5b6673]",
  low: "bg-[#3d4650]",
  access: "bg-[#c4a15d]",
  momentum: "bg-[#7c9ab4]",
  signal: "bg-[#b77870]",
  integrity: "bg-[#6d8a72]",
};

export function StatBar({ label, value, tone = "normal" }: StatBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
        <span className="text-[color:var(--text-muted)]">
          {label}
        </span>
        <span className="font-medium text-[color:var(--text-main)]">
          {Math.round(value)}
        </span>
      </div>
      <div className="h-3 overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]">
        <div
          className={cx(
            "h-full transition-all",
            toneClasses[tone] ?? toneClasses.normal,
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
