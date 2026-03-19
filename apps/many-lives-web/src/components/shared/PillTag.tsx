import { cx, titleCase } from "@/lib/utils/format";

const toneClasses: Record<string, string> = {
  urgent: "bg-[#f5f5f2] text-[#2f2f2b] border-[#7d7d78]",
  high: "bg-[#f6f6f3] text-[#2f2f2b] border-[#8c8c84]",
  normal: "bg-[#f9f9f6] text-[#44443f] border-[#b1b1ab]",
  low: "bg-[#fbfbf8] text-[#575750] border-[#c1c1bc]",
  money: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  relationship: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  health: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  schedule: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  reputation: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  social: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  opportunity: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  interruption: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  status: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  decision: "bg-[#f7f7f4] text-[#44443f] border-[#b1b1ab]",
  mock: "bg-[#f5f5f2] text-[#44443f] border-[#8c8c84]",
  backend: "bg-[#fbfbf8] text-[#575750] border-[#c1c1bc]",
  none: "bg-[#fbfbf8] text-[color:var(--text-dim)] border-[color:var(--border-subtle)]",
  muted: "bg-[#fbfbf8] text-[color:var(--text-muted)] border-[color:var(--border-subtle)]",
};

interface PillTagProps {
  label: string;
  tone?: string;
  className?: string;
}

export function PillTag({ label, tone = "normal", className }: PillTagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[2px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        toneClasses[tone] ??
          "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]",
        className,
      )}
    >
      {titleCase(label)}
    </span>
  );
}
