import { TimelineStrip } from "@/components/timeline/TimelineStrip";
import type { GameState } from "@/lib/types/game";

interface BottomBarProps {
  game: GameState | null;
  busy: boolean;
  onNewGame: () => void;
  onTick: (minutes: number) => void;
}

export function BottomBar(props: BottomBarProps) {
  return <TimelineStrip {...props} />;
}
