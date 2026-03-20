import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import type { CharacterView } from "@/lib/types/game";

interface CharacterDetailViewProps {
  character: CharacterView | null;
}

export function CharacterDetailView({ character }: CharacterDetailViewProps) {
  if (!character) {
    return (
      <Card tone="panel">
        <div className="text-[1rem] text-[color:var(--text-muted)]">
          No self selected
        </div>
      </Card>
    );
  }

  return (
    <Card tone="panel" className="space-y-4">
      <div className="border-b border-[color:var(--border-subtle)] pb-3">
        <div className="text-[1.1rem] font-semibold uppercase tracking-[0.03em] text-[color:var(--text-main)]">
          Self Detail
        </div>
      </div>
      <div>
        <div className="text-[1.15rem] font-medium text-[color:var(--text-main)]">
          {character.name}
        </div>
        <div className="mt-1 text-[0.95rem] text-[color:var(--text-muted)]">
          {character.subtitle}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <PillTag label={character.location} tone="muted" />
        <PillTag label={character.urgency} tone={character.urgency} />
      </div>
      <div className="grid gap-3 border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] p-4">
        <SummaryRow label="Current thread" value={character.currentTask} />
        <SummaryRow label="Next opening" value={character.nextObligation} />
        <SummaryRow label="Strain" value={`${Math.round(character.stress)}`} />
        <SummaryRow label="Focus" value={`${Math.round(character.energy)}`} />
        <SummaryRow label="Primary pulls" value={character.priorities.join(", ")} />
        <SummaryRow
          label="Recent signs"
          value={character.recentEvents.join(" • ")}
        />
      </div>
    </Card>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="grid gap-1 border-b border-[color:var(--border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <div className="text-[0.85rem] uppercase tracking-[0.04em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="text-[0.95rem] leading-6 text-[color:var(--text-main)]">
        {value}
      </div>
    </div>
  );
}
