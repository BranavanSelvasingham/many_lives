interface EmptyStateProps {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <div className="font-display text-lg text-[color:var(--text-main)]">
        {title}
      </div>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[color:var(--text-muted)]">
        {body}
      </p>
    </div>
  );
}
