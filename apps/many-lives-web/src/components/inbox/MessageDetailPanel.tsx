import { useMemo, useState, type ReactNode } from "react";

import { RuleComposer } from "@/components/policies/RuleComposer";
import type { CharacterView, InboxMessageView } from "@/lib/types/game";
import { titleCase } from "@/lib/utils/format";

interface MessageDetailPanelProps {
  message: InboxMessageView | null;
  characters: CharacterView[];
  draftOverrideText: string;
  ruleComposerDraft: string;
  isRuleComposerOpen: boolean;
  onClose: () => void;
  onOverrideChange: (value: string) => void;
  onSendDecision: (messageId: string, actionId: string) => void;
  onSnooze: (messageId: string, minutes: number) => void;
  onDelegate: (messageId: string, targetCharacterId: string) => void;
  onOpenRuleComposer: (message: InboxMessageView) => void;
  onCloseRuleComposer: () => void;
  onRuleComposerChange: (value: string) => void;
  onSaveRuleDraft: (message: InboxMessageView, draft: string) => void;
}

const consequenceOrder = [
  "money",
  "stress",
  "schedule",
  "reputation",
  "relationship",
] as const;

export function MessageDetailPanel({
  message,
  characters,
  draftOverrideText,
  ruleComposerDraft,
  isRuleComposerOpen,
  onClose,
  onOverrideChange,
  onSendDecision,
  onSnooze,
  onDelegate,
  onOpenRuleComposer,
  onCloseRuleComposer,
  onRuleComposerChange,
  onSaveRuleDraft,
}: MessageDetailPanelProps) {
  const [overrideActionId, setOverrideActionId] = useState<string>(
    message?.suggestedActions[0]?.id ?? "",
  );
  const [delegateTargetId, setDelegateTargetId] = useState<string>("");

  const delegateTargets = useMemo(
    () =>
      characters.filter((character) => character.id !== message?.characterId),
    [characters, message?.characterId],
  );

  if (!message) {
    return (
      <section className="flex h-full items-center justify-center border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-4 py-10 text-[0.95rem] text-[color:var(--text-muted)]">
        Select a thread to inspect its decision detail.
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]">
      <div className="flex flex-none items-center justify-between gap-4 border-b border-[color:var(--border-subtle)] px-5 py-4">
        <h2 className="text-[1.1rem] font-semibold uppercase tracking-[0.03em] text-[color:var(--text-main)]">
          Message Detail
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center text-[color:var(--text-muted)]"
          aria-label="Close message detail"
        >
          <CloseGlyph />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-4">
          <div className="border-b border-[color:var(--border-subtle)] pb-4">
            <div className="text-[1.15rem] font-medium text-[color:var(--text-main)]">
              {message.subject}
            </div>
          </div>
          <div className="text-[1.05rem] leading-8 text-[color:var(--text-main)]">
            {message.body}
          </div>
          <div className="border-t border-[color:var(--border-subtle)] pt-4">
            <div className="mb-2 text-[0.95rem] font-medium text-[color:var(--text-main)]">
              Consequence Summary
            </div>
            <div className="grid gap-2">
              {consequenceOrder
                .filter((key) => message.consequences[key])
                .map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[0.95rem]"
                  >
                    <span>{titleCase(key)}</span>
                    <span className="font-medium text-[color:var(--text-muted)]">
                      {titleCase(message.consequences[key] ?? "none")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div className="space-y-2">
            {message.suggestedActions.slice(0, 4).map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onSendDecision(message.id, action.id)}
                className="flex w-full items-center justify-center border border-[color:var(--border-subtle)] bg-[#e6e6e3] px-4 py-3 text-[1rem] font-medium text-[color:var(--text-main)]"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="border-t border-[color:var(--border-subtle)] pt-3">
            <LineAction label="Snooze">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSnooze(message.id, 30)}
                  className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-1.5 text-[0.95rem]"
                >
                  30m
                </button>
                <button
                  type="button"
                  onClick={() => onSnooze(message.id, 120)}
                  className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-1.5 text-[0.95rem]"
                >
                  2h
                </button>
              </div>
            </LineAction>
            <LineAction label="Delegate">
              <div className="flex items-center gap-2">
                <select
                  value={delegateTargetId}
                  onChange={(event) => setDelegateTargetId(event.target.value)}
                  className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-2 py-1.5 text-[0.95rem] outline-none"
                >
                  <option value="">Choose life</option>
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
                  className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-1.5 text-[0.95rem] disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </LineAction>
            <LineAction label="Set as Policy">
              <button
                type="button"
                onClick={() => onOpenRuleComposer(message)}
                className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-1.5 text-[0.95rem]"
              >
                Open
              </button>
            </LineAction>
          </div>
          {isRuleComposerOpen ? (
            <RuleComposer
              value={ruleComposerDraft}
              onChange={onRuleComposerChange}
              examples={[
                "Always switch vendors if delay > 1 hour.",
                "Never alert for minor delays.",
                "Ask only if family schedule is affected.",
              ]}
              onSave={() => onSaveRuleDraft(message, ruleComposerDraft)}
              onCancel={onCloseRuleComposer}
            />
          ) : null}
          <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] p-3">
            <div className="mb-2 text-[0.95rem] font-medium text-[color:var(--text-main)]">
              Custom Response
            </div>
            <div className="space-y-2">
              <select
                value={overrideActionId}
                onChange={(event) => setOverrideActionId(event.target.value)}
                className="w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] outline-none"
              >
                {message.suggestedActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
              <textarea
                value={draftOverrideText}
                onChange={(event) => onOverrideChange(event.target.value)}
                rows={2}
                className="w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] outline-none"
                placeholder="Custom Response..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!overrideActionId}
                  onClick={() => onSendDecision(message.id, overrideActionId)}
                  className="border border-[color:var(--border-subtle)] bg-[#e6e6e3] px-5 py-2 text-[1rem] font-medium text-[color:var(--text-main)] disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface LineActionProps {
  label: string;
  children: ReactNode;
}

function LineAction({ label, children }: LineActionProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] py-3 last:border-b-0">
      <div className="text-[1rem] text-[color:var(--text-main)]">{label}</div>
      {children}
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
