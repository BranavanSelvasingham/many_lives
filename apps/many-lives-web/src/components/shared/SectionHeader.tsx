import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  detail,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-[1.1rem] font-semibold uppercase tracking-[0.03em] text-[color:var(--text-main)]">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        {detail ? (
          <div className="text-xs text-[color:var(--text-muted)]">{detail}</div>
        ) : null}
        {action}
      </div>
    </div>
  );
}
