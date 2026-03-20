import { CharacterCard } from "@/components/characters/CharacterCard";
import { EmptyState } from "@/components/shared/EmptyState";
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
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
      <div className="flex-none border-b border-[color:var(--border-subtle)] px-6 py-4">
        <h2 className="text-[1rem] font-medium uppercase tracking-[0.03em] text-[color:var(--text-main)]">
          Selves
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {characters.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No lives loaded"
              body="Create a new run to divide yourself across the Ascension Window."
            />
          </div>
        ) : (
          <div>
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                selected={character.id === selectedCharacterId}
                onSelect={onSelectCharacter}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
