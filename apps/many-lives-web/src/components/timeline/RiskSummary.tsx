import { PillTag } from "@/components/shared/PillTag";
import type { GameState } from "@/lib/types/game";

interface RiskSummaryProps {
  risks: GameState["worldSummary"]["risks"];
}

export function RiskSummary({ risks }: RiskSummaryProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(risks).map(([key, value]) => (
        <PillTag key={key} label={`${key} ${value}`} tone={key} />
      ))}
    </div>
  );
}
