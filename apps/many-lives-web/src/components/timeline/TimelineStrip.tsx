import type { ReactNode } from "react";

import type { GameState } from "@/lib/types/game";
import {
  describeBoardState,
  describeRivalMovement,
  describeWindowPressure,
  describeWindowTime,
} from "@/lib/utils/worldPresentation";

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
  const nextThread = summary?.upcomingObligations[0] ?? "No decisive thread locked";
  const windowTime = describeWindowTime(game);
  const boardState = describeBoardState(game);
  const windowPressure = describeWindowPressure(
    summary?.pressures.windowNarrowing ?? "low",
  );
  const rivalMovement = describeRivalMovement(
    summary?.pressures.rivalAttention ?? "low",
  );

  return (
    <div className="overflow-x-auto border-t border-[color:var(--border-subtle)] pt-3">
      <div className="flex min-w-max items-stretch border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
        <WorldTimeBlock
          phase={windowTime.phase}
          time={windowTime.clock}
          detail={windowTime.detail}
        />
        <StripBlock label="Window" value={windowPressure} detail={summary?.rivalStatus} />
        <StripBlock label="Board" value={boardState} detail="The city keeps moving while you decide." />
        <StripBlock label="Rivals" value={rivalMovement} detail={summary?.rivalStatus} />
        <StripBlock
          label="World Pulse"
          value={summary?.worldPulse[0] ?? "No world loaded"}
          wide
        />
        <StripBlock label="Next Thread" value={nextThread} wide />
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
  detail?: string;
  wide?: boolean;
}

function StripBlock({ label, value, detail, wide = false }: StripBlockProps) {
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
      {detail ? (
        <div className="max-w-[36ch] text-[0.82rem] leading-5 text-[color:var(--text-muted)]">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

interface WorldTimeBlockProps {
  phase: string;
  time: string;
  detail: string;
}

function WorldTimeBlock({ phase, time, detail }: WorldTimeBlockProps) {
  return (
    <div className="min-w-[250px] space-y-1 border-r border-[color:var(--border-subtle)] bg-[linear-gradient(135deg,rgba(196,164,124,0.16),rgba(16,18,21,0.2))] px-6 py-4">
      <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--accent-warm)]">
        {phase}
      </div>
      <div className="font-display text-[1.55rem] leading-none text-[color:var(--text-main)]">
        {time}
      </div>
      <div className="text-[0.9rem] text-[color:var(--text-muted)]">{detail}</div>
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
