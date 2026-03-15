import type { PropsWithChildren, ReactNode } from "react";

import { cx } from "@/lib/utils/format";

type CardTone = "panel" | "raised" | "selected" | "muted";

const toneClasses: Record<CardTone, string> = {
  panel: "border-white/10 bg-[color:var(--surface-panel)]",
  raised:
    "border-white/12 bg-[color:var(--surface-raised)] shadow-[0_18px_40px_rgba(4,8,13,0.2)]",
  selected:
    "border-[color:var(--accent-cyan)] bg-[color:var(--surface-selected)] shadow-[0_0_0_1px_rgba(126,196,201,0.35)]",
  muted: "border-white/8 bg-[color:var(--surface-muted)]",
};

interface CardProps extends PropsWithChildren {
  className?: string;
  tone?: CardTone;
  onClick?: () => void;
  header?: ReactNode;
}

export function Card({
  children,
  className,
  tone = "panel",
  onClick,
  header,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "rounded-[22px] border p-4 text-[color:var(--text-main)] transition-colors",
        onClick && "cursor-pointer hover:border-white/15 hover:bg-white/[0.03]",
        toneClasses[tone],
        className,
      )}
    >
      {header}
      {children}
    </div>
  );
}
