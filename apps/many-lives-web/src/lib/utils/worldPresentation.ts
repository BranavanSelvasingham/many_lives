import type { GameState, RiskLevel } from "@/lib/types/game";
import { formatWorldTime } from "@/lib/utils/format";

const WINDOW_DURATION_HOURS = 72;

export function describeWindowTime(game: GameState | null) {
  if (!game) {
    return {
      clock: "No world loaded",
      phase: "No scenario active",
      detail: "The window has not opened.",
      hoursRemaining: WINDOW_DURATION_HOURS,
    };
  }

  const elapsedMinutes = game.tickCount * 30;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingHours = Math.max(
    0,
    WINDOW_DURATION_HOURS - Math.ceil(elapsedMinutes / 60),
  );

  return {
    clock: formatWorldTime(game.currentTimeIso),
    phase: phaseForElapsed(elapsedHours),
    detail: `T+${elapsedHours}h · ${remainingHours}h remain`,
    hoursRemaining: remainingHours,
  };
}

export function describeWindowPressure(level: RiskLevel) {
  switch (level) {
    case "high":
      return "Closing fast";
    case "medium":
      return "Tightening";
    case "low":
      return "Open, but narrowing";
    case "none":
    default:
      return "Just opening";
  }
}

export function describeRivalMovement(level: RiskLevel) {
  switch (level) {
    case "high":
      return "Rivals are claiming ground";
    case "medium":
      return "Rivals are pressing";
    case "low":
      return "Rivals are testing the edges";
    case "none":
    default:
      return "Rivals are quiet";
  }
}

export function describeBoardState(game: GameState | null) {
  if (!game) {
    return "No live board";
  }

  const urgent = game.worldSummary.urgentCount;
  const threads = game.worldSummary.activeThreads;

  if (threads === 0) {
    return "No live asks";
  }

  if (urgent === 0) {
    return `${threads} live threads`;
  }

  return `${threads} live threads · ${urgent} urgent`;
}

function phaseForElapsed(elapsedHours: number) {
  if (elapsedHours < 12) {
    return "Opening Night";
  }

  if (elapsedHours < 24) {
    return "First Day";
  }

  if (elapsedHours < 48) {
    return "Middle Stretch";
  }

  if (elapsedHours < 72) {
    return "Closing Hours";
  }

  return "After the Window";
}
