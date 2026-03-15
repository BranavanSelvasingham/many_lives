import { useMemo, useState } from "react";

import { ActionButtonRow } from "@/components/shared/ActionButtonRow";
import { Card } from "@/components/shared/Card";
import { PillTag } from "@/components/shared/PillTag";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { CharacterView, InboxMessageView } from "@/lib/types/game";
import { titleCase } from "@/lib/utils/format";

interface MessageDetailPanelProps {
  message: InboxMessageView | null;
  characters: CharacterView[];
  draftOverrideText: string;
  onOverrideChange: (value: string) => void;
  onSendDecision: (messageId: string, actionId: string) => void;
  onSnooze: (messageId: string, minutes: number) => void;
  onDelegate: (messageId: string, targetCharacterId: string) => void;
  onTurnIntoRule: (message: InboxMessageView) => void;
}

export function MessageDetailPanel({
  message,
  characters,
  draftOverrideText,
  onOverrideChange,
  onSendDecision,
  onSnooze,
  onDelegate,
  onTurnIntoRule,
}: MessageDetailPanelProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [delegateTargetId, setDelegateTargetId] = useState<string>("");

  const delegateTargets = useMemo(
    () =>
      characters.filter((character) => character.id !== message?.characterId),
    [characters, message?.characterId],
  );

  if (!message) {
    return (
      <Card tone="panel">
        <SectionHeader eyebrow="Decision Surface" title="No Message Selected" />
      </Card>
    );
  }

  const actions = message.suggestedActions;
  const activeActionId = selectedActionId ?? actions[0]?.id ?? "";

  return (
    <Card tone="panel" className="space-y-5">
      <SectionHeader
        eyebrow="Decision Surface"
        title={message.subject}
        detail={message.senderName}
      />
      <div className="flex flex-wrap gap-2">
        <PillTag label={message.priority} tone={message.priority} />
        <PillTag label={message.type} tone={message.type} />
        {message.requiresResponse ? (
          <PillTag label="Needs response" tone="schedule" />
        ) : null}
      </div>
      <p className="text-sm leading-7 text-[color:var(--text-muted)]">
        {message.body}
      </p>
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
          Consequence preview
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(message.consequences).map(([key, value]) => (
            <PillTag
              key={key}
              label={`${titleCase(key)} ${value}`}
              tone={key}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
          Options
        </div>
        <ActionButtonRow
          actions={actions}
          selectedActionId={activeActionId}
          onSelect={setSelectedActionId}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
          Short override
        </label>
        <textarea
          value={draftOverrideText}
          onChange={(event) => onOverrideChange(event.target.value)}
          rows={3}
          className="w-full rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[color:var(--text-main)] outline-none placeholder:text-white/25"
          placeholder="Protect the handoff, but keep spend under control."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <select
          value={delegateTargetId}
          onChange={(event) => setDelegateTargetId(event.target.value)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
        >
          <option value="">Delegate to another life</option>
          {delegateTargets.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!delegateTargetId}
          onClick={() => onDelegate(message.id, delegateTargetId)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[color:var(--text-main)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delegate
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onSendDecision(message.id, activeActionId)}
          disabled={!activeActionId}
          className="rounded-full bg-[color:var(--accent-wheat)] px-4 py-2 text-sm font-semibold text-[#231a11] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send Decision
        </button>
        <button
          type="button"
          onClick={() => onSnooze(message.id, 30)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[color:var(--text-main)]"
        >
          Snooze 30m
        </button>
        <button
          type="button"
          onClick={() => onTurnIntoRule(message)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[color:var(--text-main)]"
        >
          Turn into Rule
        </button>
      </div>
    </Card>
  );
}
