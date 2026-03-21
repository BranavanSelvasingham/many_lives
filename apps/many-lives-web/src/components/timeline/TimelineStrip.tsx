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
  const nextOpening = summary?.upcomingObligations[0] ?? "No decisive opening locked";

  return (
    <div className="overflow-x-auto border-t border-[color:var(--border-subtle)] pt-3">
      <div className="flex min-w-max items-stretch border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
        <StripBlock label="World Time" value={formatWorldTime(game?.currentTimeIso ?? "")} />
        <StripBlock label="Access" value={`${summary?.axes.access ?? 0}`} />
        <StripBlock label="Momentum" value={`${summary?.axes.momentum ?? 0}`} />
        <StripBlock label="Signal" value={`${summary?.axes.signal ?? 0}`} />
        <StripBlock label="Coherence" value={`${summary?.axes.coherence ?? 0}`} />
        <StripBlock
          label="Rival Pressure"
          value={summary?.rivalStatus ?? "No world loaded"}
          wide
        />
        <StripBlock label="Next Opening" value={nextOpening} wide />
        <div className="flex items-center gap-2 border-l border-[color:var(--border-subtle)] px-3 py-2">
          {game?.source === "mock" ? (
            <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)]">
              Mock Mode
            </div>
          ) : null}
          <ControlButton disabled={busy} onClick={onNewGame}>
            New Run
          </ControlButton>
          <ControlButton disabled={busy || !game} onClick={() => onTick(30)}>
            Advance 30m
          </ControlButton>
          <ControlButton disabled={busy || !game} onClick={() => onTick(120)}>
            Advance 2h
          </ControlButton>
          <ControlButton disabled>Hold</ControlButton>
        </div>
      </div>
    </div>
  );
}

interface StripBlockProps {
  label: string;
  value: string;
  wide?: boolean;
}

function StripBlock({ label, value, wide = false }: StripBlockProps) {
  return (
    <div
      className={`space-y-1 border-r border-[color:var(--border-subtle)] px-6 py-3 ${
        wide ? "min-w-[340px]" : "min-w-[160px]"
      }`}
    >
      <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="text-[1rem] text-[color:var(--text-main)]">
        {value || "No world loaded"}
      </div>
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
