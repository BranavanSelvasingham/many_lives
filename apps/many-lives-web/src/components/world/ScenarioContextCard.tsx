import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import type { GameState } from "@/lib/types/game";
import {
  describeBoardState,
  describeRivalMovement,
  describeWindowPressure,
  describeWindowTime,
} from "@/lib/utils/worldPresentation";

interface ScenarioContextCardProps {
  game: GameState | null;
}

export function ScenarioContextCard({ game }: ScenarioContextCardProps) {
  if (!game) return null;

  const windowTime = describeWindowTime(game);
  const boardState = describeBoardState(game);
  const windowPressure = describeWindowPressure(
    game.worldSummary.pressures.windowNarrowing,
  );
  const rivalMovement = describeRivalMovement(
    game.worldSummary.pressures.rivalAttention,
  );

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
        <ContextTile
          label="World Time"
          value={windowTime.clock}
          detail={`${windowTime.phase} · ${windowTime.detail}`}
        />
        <ContextTile
          label="Window"
          value={windowPressure}
          detail={`${windowTime.hoursRemaining}h remain in the active window.`}
        />
        <ContextTile
          label="Board"
          value={boardState}
          detail="These are the threads the city is forcing into view."
        />
        <ContextTile
          label="Rivals"
          value={rivalMovement}
          detail={game.worldSummary.rivalStatus}
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
        <div className="space-y-2 border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-3">
          {game.worldSummary.worldPulse.slice(0, 3).map((line) => (
            <div
              key={line}
              className="text-[0.92rem] leading-6 text-[color:var(--text-main)]"
            >
              {line}
            </div>
          ))}
        </div>
        <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-3 text-[0.95rem] leading-6 text-[color:var(--text-main)]">
          {game.worldSummary.rivalStatus}
        </div>
      </div>
    </Card>
  );
}

interface ContextTileProps {
  label: string;
  value: string;
  detail: string;
}

function ContextTile({ label, value, detail }: ContextTileProps) {
  return (
    <div className="space-y-1 border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-3">
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="text-[1rem] text-[color:var(--text-main)]">{value}</div>
      <div className="text-[0.82rem] leading-5 text-[color:var(--text-muted)]">
        {detail}
      </div>
    </div>
  );
}
