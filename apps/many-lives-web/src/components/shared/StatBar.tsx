import { cx } from "@/lib/utils/format";

interface StatBarProps {
  label: string;
  value: number;
  tone?: string;
}

const toneClasses: Record<string, string> = {
  urgent: "bg-[#e3d06f]",
  high: "bg-[#dbdbd4]",
  normal: "bg-[#c9c9c3]",
  low: "bg-[#d9d9d3]",
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
      <div className="h-3 overflow-hidden border border-[color:var(--border-subtle)] bg-[#f4f4f1]">
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
