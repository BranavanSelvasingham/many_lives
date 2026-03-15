import Image from "next/image";

import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import { StatBar } from "@/components/shared/StatBar";
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
    <Card
      tone={selected ? "selected" : "raised"}
      className="space-y-4"
      onClick={() => onSelect(character.id)}
    >
      <div className="flex items-start gap-3">
        <Image
          src={
            avatarByCharacterId[character.id] ??
            "/placeholder-avatar-jordan.png"
          }
          alt={`${character.name} avatar`}
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg text-[color:var(--text-main)]">
                {character.name}
              </div>
              <div className="text-sm text-[color:var(--text-muted)]">
                {character.subtitle}
              </div>
            </div>
            <PillTag label={character.urgency} tone={character.urgency} />
          </div>
          <div className="mt-3 text-sm text-[color:var(--text-main)]">
            <span className="text-[color:var(--text-dim)]">Now</span>{" "}
            {character.currentTask}
          </div>
          <div className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
            {character.nextObligationSnippet}
          </div>
        </div>
      </div>
      <StatBar
        label="Stress"
        value={character.stress}
        tone={character.urgency}
      />
    </Card>
  );
}
