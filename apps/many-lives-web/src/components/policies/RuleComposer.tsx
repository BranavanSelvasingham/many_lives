interface RuleComposerProps {
  value: string;
  onChange: (value: string) => void;
}

export function RuleComposer({ value, onChange }: RuleComposerProps) {
  return (
    <div className="space-y-2 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
        Rule composer
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-[16px] border border-white/10 bg-[color:var(--surface-panel)] px-3 py-3 text-sm leading-6 text-[color:var(--text-main)] outline-none placeholder:text-white/25"
        placeholder="When delivery conflicts threaten reputation, preserve the handoff before optimizing cost."
      />
    </div>
  );
}
