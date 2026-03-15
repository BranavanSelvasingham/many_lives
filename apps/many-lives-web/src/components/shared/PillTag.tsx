import { cx, titleCase } from "@/lib/utils/format";

const toneClasses: Record<string, string> = {
  urgent: "bg-[#5c221d] text-[#ffb4a8] border-[#914136]",
  high: "bg-[#5b3919] text-[#ffcb90] border-[#8c6232]",
  normal: "bg-[#1c3f49] text-[#9fe4eb] border-[#2f6067]",
  low: "bg-[#1d4931] text-[#9de3b7] border-[#326b48]",
  money: "bg-[#524417] text-[#f5dd8e] border-[#776329]",
  relationship: "bg-[#5c2441] text-[#f0b6d1] border-[#874566]",
  health: "bg-[#20463b] text-[#9fdec7] border-[#316e5d]",
  schedule: "bg-[#1c3f49] text-[#9fe4eb] border-[#2f6067]",
  social: "bg-[#44305b] text-[#cab1ec] border-[#665086]",
  opportunity: "bg-[#20463b] text-[#9fdec7] border-[#316e5d]",
  interruption: "bg-[#40322a] text-[#dfc5b2] border-[#68574a]",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        toneClasses[tone] ?? "border-white/10 bg-white/5 text-white/75",
        className,
      )}
    >
      {titleCase(label)}
    </span>
  );
}
