import { useMemo, useState } from "react";

import { Card } from "@/components/shared/Card";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { RuleComposer } from "@/components/policies/RuleComposer";
import type { CharacterView, PolicySettings } from "@/lib/types/game";
import {
  autonomyOptions,
  interruptOptions,
  priorityBiasOptions,
  reportingOptions,
  riskToleranceOptions,
  scheduleProtectionOptions,
  sensitivityOptions,
  spendPresetOptions,
} from "@/lib/utils/priorities";
import { formatCurrencyLimit } from "@/lib/utils/format";

interface PolicyPanelProps {
  character: CharacterView | null;
  ruleComposerDraft: string;
  showRuleComposer: boolean;
  onRuleComposerChange: (value: string) => void;
  onSave: (draft: PolicySettings) => void;
}

export function PolicyPanel({
  character,
  ruleComposerDraft,
  showRuleComposer,
  onRuleComposerChange,
  onSave,
}: PolicyPanelProps) {
  const initialDraft = useMemo(
    () =>
      character
        ? {
            ...character.policy,
            ruleSummary: showRuleComposer
              ? ruleComposerDraft || character.policy.ruleSummary
              : character.policy.ruleSummary,
          }
        : null,
    [character, ruleComposerDraft, showRuleComposer],
  );
  const [draft, setDraft] = useState<PolicySettings | null>(initialDraft);

  if (!character || !draft) {
    return (
      <Card tone="panel">
        <SectionHeader eyebrow="Standing Direction" title="No Policy Context" />
      </Card>
    );
  }

  const setField = <K extends keyof PolicySettings>(
    key: K,
    value: PolicySettings[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  return (
    <Card tone="panel" className="space-y-5">
      <SectionHeader
        eyebrow="Standing Direction"
        title={`${character.name}'s Policy`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <PolicySelect
          label="Autonomy"
          value={draft.autonomy}
          onChange={(value) =>
            setField("autonomy", value as PolicySettings["autonomy"])
          }
          options={autonomyOptions}
        />
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Spend without asking
          </label>
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <select
              value={draft.spendPreset}
              onChange={(event) => {
                const nextValue = event.target
                  .value as PolicySettings["spendPreset"];
                setField("spendPreset", nextValue);
                if (nextValue !== "custom") {
                  setField("spendWithoutAsking", Number(nextValue));
                }
              }}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-main)]"
            >
              {spendPresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={10}
              disabled={draft.spendPreset !== "custom"}
              value={draft.spendWithoutAsking}
              onChange={(event) =>
                setField("spendWithoutAsking", Number(event.target.value))
              }
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-main)] disabled:opacity-40"
            />
          </div>
          <div className="text-xs text-[color:var(--text-muted)]">
            Current limit: {formatCurrencyLimit(draft.spendWithoutAsking)}
          </div>
        </div>
        <PolicySelect
          label="Interrupt me when"
          value={draft.interruptWhen}
          onChange={(value) =>
            setField("interruptWhen", value as PolicySettings["interruptWhen"])
          }
          options={interruptOptions}
        />
        <PolicySelect
          label="Priority bias"
          value={draft.priorityBias}
          onChange={(value) =>
            setField("priorityBias", value as PolicySettings["priorityBias"])
          }
          options={priorityBiasOptions}
        />
        <PolicySelect
          label="Risk tolerance"
          value={draft.riskTolerance}
          onChange={(value) =>
            setField("riskTolerance", value as PolicySettings["riskTolerance"])
          }
          options={riskToleranceOptions}
        />
        <PolicySelect
          label="Schedule protection"
          value={draft.scheduleProtection}
          onChange={(value) =>
            setField(
              "scheduleProtection",
              value as PolicySettings["scheduleProtection"],
            )
          }
          options={scheduleProtectionOptions}
        />
        <PolicySelect
          label="Reporting frequency"
          value={draft.reportingFrequency}
          onChange={(value) =>
            setField(
              "reportingFrequency",
              value as PolicySettings["reportingFrequency"],
            )
          }
          options={reportingOptions}
        />
        <PolicySelect
          label="Escalation sensitivity"
          value={draft.escalationSensitivity}
          onChange={(value) =>
            setField(
              "escalationSensitivity",
              value as PolicySettings["escalationSensitivity"],
            )
          }
          options={sensitivityOptions}
        />
      </div>
      {showRuleComposer ? (
        <RuleComposer
          value={ruleComposerDraft || draft.ruleSummary}
          onChange={(value) => {
            setField("ruleSummary", value);
            onRuleComposerChange(value);
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="rounded-full bg-[color:var(--accent-cyan)] px-4 py-2 text-sm font-semibold text-[#122023]"
        >
          Save Policy
        </button>
        <div className="text-sm text-[color:var(--text-muted)]">
          Standing rules shape how often this life surfaces issues and how
          aggressively it self-directs.
        </div>
      </div>
    </Card>
  );
}

interface PolicySelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function PolicySelect({ label, value, options, onChange }: PolicySelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
