import type { ReactNode } from "react";

import type { GameState } from "@/lib/types/game";
import { formatWorldTime } from "@/lib/utils/format";

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
  const nextObligation =
    summary?.upcomingObligations[0] ?? "No immediate obligation";

  return (
    <div className="overflow-x-auto border-t border-[color:var(--border-subtle)] pt-3">
      <div className="flex min-w-max items-stretch border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
        <StripBlock value={formatWorldTime(game?.currentTimeIso ?? "")} />
        <StripBlock value={`Urgent: ${summary?.urgentCount ?? 0}`} />
        <StripBlock value={`Threads: ${summary?.activeThreads ?? 0}`} />
        <StripBlock value={`Next: ${nextObligation}`} wide />
        <div className="flex items-center gap-2 border-l border-[color:var(--border-subtle)] px-3 py-2">
          {game?.source === "mock" ? (
            <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)]">
              Mock Mode
            </div>
          ) : null}
          <ControlButton disabled={busy} onClick={onNewGame}>
            New Game
          </ControlButton>
          <ControlButton disabled={busy || !game} onClick={() => onTick(30)}>
            ≪ Tick 30m
          </ControlButton>
          <ControlButton disabled={busy || !game} onClick={() => onTick(120)}>
            ≫ Tick 2h
          </ControlButton>
          <ControlButton disabled>▮▮</ControlButton>
        </div>
      </div>
    </div>
  );
}

interface StripBlockProps {
  value: string;
  wide?: boolean;
}

function StripBlock({ value, wide = false }: StripBlockProps) {
  return (
    <div
      className={`border-r border-[color:var(--border-subtle)] px-6 py-3 text-[1rem] text-[color:var(--text-main)] ${
        wide ? "min-w-[340px]" : "min-w-[160px]"
      }`}
    >
      {value || "No world loaded"}
    </div>
  );
}

interface ControlButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

function ControlButton({ children, disabled, onClick }: ControlButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-4 py-2 text-[1rem] text-[color:var(--text-main)] disabled:opacity-45"
    >
      {children}
    </button>
  );
}
