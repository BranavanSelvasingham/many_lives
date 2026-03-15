import { CharacterList } from "@/components/characters/CharacterList";
import { Card } from "@/components/shared/Card";
import { StatBar } from "@/components/shared/StatBar";
import type { CharacterView } from "@/lib/types/game";

interface LeftRailProps {
  characters: CharacterView[];
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
}

export function LeftRail({
  characters,
  selectedCharacterId,
  onSelectCharacter,
}: LeftRailProps) {
  const averageStress =
    characters.length > 0
      ? characters.reduce((sum, character) => sum + character.stress, 0) /
        characters.length
      : 0;
  const averageLoad =
    characters.length > 0
      ? characters.reduce((sum, character) => sum + character.load, 0) /
        characters.length
      : 0;

  return (
    <div className="space-y-4">
      <CharacterList
        characters={characters}
        selectedCharacterId={selectedCharacterId}
        onSelect={onSelectCharacter}
      />
      <Card tone="panel" className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
          Pressure read
        </div>
        <StatBar label="Average stress" value={averageStress} tone="high" />
        <StatBar label="Attention load" value={averageLoad} tone="normal" />
      </Card>
    </div>
  );
}
