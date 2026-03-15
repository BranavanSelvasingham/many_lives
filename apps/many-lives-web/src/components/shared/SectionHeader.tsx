import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  detail?: ReactNode;
}

export function SectionHeader({ eyebrow, title, detail }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-xl tracking-tight text-[color:var(--text-main)]">
          {title}
        </h2>
      </div>
      {detail ? (
        <div className="text-sm text-[color:var(--text-muted)]">{detail}</div>
      ) : null}
    </div>
  );
}
