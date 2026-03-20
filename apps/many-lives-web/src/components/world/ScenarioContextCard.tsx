import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import { StatBar } from "@/components/shared/StatBar";
import type { GameState } from "@/lib/types/game";

interface ScenarioContextCardProps {
  game: GameState | null;
}

export function ScenarioContextCard({ game }: ScenarioContextCardProps) {
  if (!game) return null;

  return (
    <Card tone="panel" className="space-y-4 border-[color:var(--border-strong)]">
      <div className="space-y-2 border-b border-[color:var(--border-subtle)] pb-3">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
          Scenario
        </div>
        <div className="font-display text-[1.2rem] uppercase tracking-[0.08em] text-[color:var(--text-main)]">
          {game.scenarioName}
        </div>
        <p className="max-w-[44ch] text-[0.95rem] leading-6 text-[color:var(--text-muted)]">
          72 hours. The city is reordering itself. A few people will emerge
          central. The rest will become orbit.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatBar label="Access" value={game.worldSummary.axes.access} tone="access" />
        <StatBar
          label="Momentum"
          value={game.worldSummary.axes.momentum}
          tone="momentum"
        />
        <StatBar label="Signal" value={game.worldSummary.axes.signal} tone="signal" />
        <StatBar
          label="Integrity"
          value={game.worldSummary.axes.integrity}
          tone="integrity"
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <PillTag
            label={`Risk ${game.worldSummary.pressures.risk}`}
            tone={game.worldSummary.pressures.risk}
          />
          <PillTag
            label={`Social Debt ${game.worldSummary.pressures.socialDebt}`}
            tone="socialDebt"
          />
          <PillTag
            label={`Rival Attention ${game.worldSummary.pressures.rivalAttention}`}
            tone="rivalAttention"
          />
          <PillTag
            label={`Window ${game.worldSummary.pressures.windowNarrowing}`}
            tone="windowNarrowing"
          />
        </div>
        <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-3 text-[0.95rem] leading-6 text-[color:var(--text-main)]">
          {game.worldSummary.rivalStatus}
        </div>
      </div>
    </Card>
  );
}
