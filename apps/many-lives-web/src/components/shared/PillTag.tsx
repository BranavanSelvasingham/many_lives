import { cx, titleCase } from "@/lib/utils/format";

const toneClasses: Record<string, string> = {
  urgent: "bg-[#4b2c2f] text-[#f2dfd7] border-[#8e5458]",
  high: "bg-[#2e3238] text-[#ede2d2] border-[#676f79]",
  normal: "bg-[#23292f] text-[#d4cabd] border-[#525d67]",
  low: "bg-[#1b2127] text-[#b4ab9d] border-[#414b55]",
  access: "bg-[#352d1f] text-[#f0d39b] border-[#86663a]",
  momentum: "bg-[#243545] text-[#b8d3eb] border-[#4d708f]",
  signal: "bg-[#3b2a2f] text-[#efc1b8] border-[#8a555a]",
  integrity: "bg-[#263328] text-[#c5ddc8] border-[#607966]",
  risk: "bg-[#40282b] text-[#efb7b0] border-[#8a5359]",
  socialDebt: "bg-[#33272d] text-[#e7c6d2] border-[#7b5969]",
  rivalAttention: "bg-[#352a24] text-[#f0c89f] border-[#8b6242]",
  windowNarrowing: "bg-[#31271f] text-[#edcc98] border-[#856640]",
  social: "bg-[#1f2630] text-[#c2ccd8] border-[#4c5867]",
  opportunity: "bg-[#202a25] text-[#c9dccd] border-[#57715d]",
  interruption: "bg-[#302429] text-[#e0c4cd] border-[#6f505b]",
  status: "bg-[#1d252e] text-[#b7c6d6] border-[#51606f]",
  decision: "bg-[#2a2621] text-[#e5d3b6] border-[#6d5f49]",
  mock: "bg-[#25303a] text-[#cad2dd] border-[#5b6876]",
  backend: "bg-[#1c2328] text-[#aeb8bf] border-[#44515a]",
  none: "bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] border-[color:var(--border-subtle)]",
  muted: "bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)] border-[color:var(--border-subtle)]",
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
