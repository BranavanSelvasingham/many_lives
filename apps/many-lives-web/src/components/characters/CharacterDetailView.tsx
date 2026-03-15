import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { StatBar } from "@/components/shared/StatBar";
import type { CharacterView } from "@/lib/types/game";

interface CharacterDetailViewProps {
  character: CharacterView | null;
}

export function CharacterDetailView({ character }: CharacterDetailViewProps) {
  if (!character) {
    return (
      <Card tone="panel">
        <SectionHeader eyebrow="Selected Life" title="No Character Selected" />
      </Card>
    );
  }

  return (
    <Card tone="panel" className="space-y-5">
      <SectionHeader
        eyebrow="Selected Life"
        title={character.name}
        detail={character.subtitle}
      />
      <div className="flex flex-wrap gap-2">
        <PillTag label={character.urgency} tone={character.urgency} />
        <PillTag label={character.location} tone="schedule" />
      </div>
      <div className="grid gap-3 text-sm text-[color:var(--text-muted)] sm:grid-cols-2">
        <div>
          <div className="text-[color:var(--text-dim)]">Current task</div>
          <div className="mt-1 text-[color:var(--text-main)]">
            {character.currentTask}
          </div>
        </div>
        <div>
          <div className="text-[color:var(--text-dim)]">Next obligation</div>
          <div className="mt-1 text-[color:var(--text-main)]">
            {character.nextObligation}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatBar
          label="Stress"
          value={character.stress}
          tone={character.urgency}
        />
        <StatBar label="Energy" value={character.energy} tone="normal" />
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Priorities
          </div>
          <div className="mt-2 space-y-2 text-[color:var(--text-main)]">
            {character.priorities.map((priority) => (
              <div key={priority}>{priority}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Recent
          </div>
          <div className="mt-2 space-y-2 text-[color:var(--text-main)]">
            {character.recentEvents.map((event) => (
              <div key={event}>{event}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3 text-sm text-[color:var(--text-muted)]">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
          Autonomy profile
        </div>
        <div className="mt-2 text-[color:var(--text-main)]">
          {character.autonomyProfile}
        </div>
      </div>
    </Card>
  );
}
