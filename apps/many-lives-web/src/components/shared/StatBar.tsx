import { cx } from "@/lib/utils/format";

interface StatBarProps {
  label: string;
  value: number;
  tone?: string;
}

const toneClasses: Record<string, string> = {
  urgent: "bg-[#ff8e7a]",
  high: "bg-[#ffbf74]",
  normal: "bg-[#7ec4c9]",
  low: "bg-[#7dcc9b]",
};

export function StatBar({ label, value, tone = "normal" }: StatBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-[color:var(--text-muted)]">
        <span>{label}</span>
        <span className="font-medium text-[color:var(--text-main)]">
          {Math.round(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
        <div
          className={cx(
            "h-full rounded-full transition-all",
            toneClasses[tone] ?? toneClasses.normal,
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
