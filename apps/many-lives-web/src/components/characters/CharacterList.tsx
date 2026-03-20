import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CharacterCard } from "@/components/characters/CharacterCard";
import type { CharacterView } from "@/lib/types/game";

interface CharacterListProps {
  characters: CharacterView[];
  selectedCharacterId: string | null;
  onSelect: (characterId: string) => void;
}

export function CharacterList({
  characters,
  selectedCharacterId,
  onSelect,
}: CharacterListProps) {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Who"
        title="Selves in Motion"
        detail={`${characters.length} active`}
      />
      {characters.length === 0 ? (
        <EmptyState
          title="No lives loaded"
          body="Create a new run to start triaging the Ascension Window."
        />
      ) : (
        <div className="space-y-3">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              selected={character.id === selectedCharacterId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
