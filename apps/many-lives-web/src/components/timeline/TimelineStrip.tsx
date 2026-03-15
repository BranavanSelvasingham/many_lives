import { Card } from "@/components/shared/Card";
import { RiskSummary } from "@/components/timeline/RiskSummary";
import type { GameState } from "@/lib/types/game";

interface TimelineStripProps {
  game: GameState | null;
  busy: boolean;
  onNewGame: () => void;
  onTick: (minutes: number) => void;
}

export function TimelineStrip({
  game,
  busy,
  onNewGame,
  onTick,
}: TimelineStripProps) {
  const summary = game?.worldSummary;

  return (
    <Card tone="panel" className="space-y-4 rounded-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
            World strip
          </div>
          <div className="font-display text-2xl text-[color:var(--text-main)]">
            {game?.time ?? "No world loaded"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNewGame}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[color:var(--text-main)] disabled:opacity-40"
          >
            New Game
          </button>
          <button
            type="button"
            onClick={() => onTick(30)}
            disabled={busy || !game}
            className="rounded-full bg-[color:var(--accent-cyan)] px-4 py-2 text-sm font-semibold text-[#122023] disabled:opacity-40"
          >
            Tick 30m
          </button>
          <button
            type="button"
            onClick={() => onTick(120)}
            disabled={busy || !game}
            className="rounded-full bg-[color:var(--accent-wheat)] px-4 py-2 text-sm font-semibold text-[#231a11] disabled:opacity-40"
          >
            Tick 2h
          </button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-2">
          <div className="text-sm text-[color:var(--text-muted)]">
            {game?.summary ?? "Create a new game to start the day."}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[color:var(--text-main)]">
            <span>{summary?.urgentCount ?? 0} urgent</span>
            <span>{summary?.activeThreads ?? 0} active threads</span>
            <span>
              {game?.source === "mock" ? "Mock mode" : "Backend live"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Upcoming
          </div>
          <div className="mt-2 space-y-2 text-sm text-[color:var(--text-main)]">
            {summary?.upcomingObligations
              ?.slice(0, 3)
              .map((obligation) => (
                <div key={obligation}>{obligation}</div>
              )) ?? (
              <div className="text-[color:var(--text-muted)]">
                No immediate obligations.
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Global risks
          </div>
          <div className="mt-2">
            <RiskSummary
              risks={
                summary?.risks ?? {
                  money: "low",
                  relationship: "low",
                  health: "low",
                  schedule: "low",
                }
              }
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
