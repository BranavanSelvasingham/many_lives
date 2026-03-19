import Image from "next/image";

import type { CharacterView } from "@/lib/types/game";
import { avatarByCharacterId } from "@/lib/utils/mockData";

interface CharacterCardProps {
  character: CharacterView;
  selected: boolean;
  onSelect: (characterId: string) => void;
}

export function CharacterCard({
  character,
  selected,
  onSelect,
}: CharacterCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(character.id)}
      className={`grid w-full grid-cols-[72px_minmax(0,1fr)] items-center gap-4 border-b border-[color:var(--border-subtle)] px-4 py-4 text-left ${
        selected ? "bg-[color:var(--surface-selected)]" : "bg-[color:var(--surface-panel)]"
      }`}
    >
      <div className="flex h-[72px] w-[72px] items-center justify-center border border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)]">
        <Image
          src={
            avatarByCharacterId[character.id] ??
            "/placeholder-avatar-jordan.png"
          }
          alt={`${character.name} avatar`}
          width={56}
          height={56}
          className="h-14 w-14 object-cover grayscale"
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-[1rem] font-semibold text-[color:var(--text-main)]">
            {character.name}
          </div>
          {selected ? (
            <div className="h-4 w-20 border border-[color:var(--border-subtle)] bg-[#f5f5f1]">
              <div
                className="h-full bg-[#ead769]"
                style={{ width: `${Math.max(20, Math.min(100, character.stress))}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="mt-1 text-[0.95rem] text-[color:var(--text-muted)]">
          {character.location}
        </div>
        <div className="mt-2 truncate text-[0.95rem] text-[color:var(--text-main)]">
          {character.currentTask}
        </div>
      </div>
    </button>
  );
}
