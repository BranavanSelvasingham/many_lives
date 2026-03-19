import type { PropsWithChildren, ReactNode } from "react";

import { cx } from "@/lib/utils/format";

type CardTone = "panel" | "raised" | "selected" | "muted";

const toneClasses: Record<CardTone, string> = {
  panel: "border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]",
  raised: "border-[color:var(--border-subtle)] bg-[color:var(--surface-raised)]",
  selected:
    "border-[color:var(--border-strong)] bg-[color:var(--surface-selected)]",
  muted: "border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)]",
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
        "rounded-[2px] border p-4 text-[color:var(--text-main)] transition-[border-color,background-color]",
        onClick &&
          "cursor-pointer hover:bg-[color:var(--surface-muted)]",
        toneClasses[tone],
        className,
      )}
    >
      {header}
      {children}
    </div>
  );
}
