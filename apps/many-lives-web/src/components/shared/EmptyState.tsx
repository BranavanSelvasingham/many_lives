interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-4 py-10 text-center">
      <div className="font-display text-[1.05rem] text-[color:var(--text-main)]">
        {title}
      </div>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[color:var(--text-muted)]">
        {body}
      </p>
    </div>
  );
}
