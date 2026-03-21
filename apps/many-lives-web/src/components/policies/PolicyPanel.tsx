import { useMemo, useState } from "react";

import { Card } from "@/components/shared/Card";
import type { CharacterView, PolicySettings } from "@/lib/types/game";
import {
  interruptOptions,
  priorityBiasOptions,
  reportingOptions,
  riskToleranceOptions,
  scheduleProtectionOptions,
  sensitivityOptions,
  spendPresetOptions,
} from "@/lib/utils/priorities";

interface PolicyPanelProps {
  character: CharacterView | null;
  onSave: (draft: PolicySettings) => void;
}

export function PolicyPanel({ character, onSave }: PolicyPanelProps) {
  const [draft, setDraft] = useState<PolicySettings | null>(
    character ? structuredClone(character.policy) : null,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isDirty = useMemo(() => {
    if (!character || !draft) return false;
    return JSON.stringify(character.policy) !== JSON.stringify(draft);
  }, [character, draft]);

  if (!character || !draft) {
    return (
      <Card tone="panel">
        <div className="text-[1rem] text-[color:var(--text-muted)]">
          No policy context
        </div>
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
    <Card tone="panel" className="space-y-4">
      <div className="border-b border-[color:var(--border-subtle)] pb-3">
        <div className="text-[1.1rem] font-semibold uppercase tracking-[0.03em] text-[color:var(--text-main)]">
          Policy
        </div>
        <div className="mt-1 text-[0.92rem] text-[color:var(--text-muted)]">
          Shape how this self pursues live signals when you are not directly steering.
        </div>
      </div>
      <div className="grid gap-3">
        <SegmentedField
          label="Autonomy"
          value={draft.autonomy}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          onChange={(value) =>
            setField("autonomy", value as PolicySettings["autonomy"])
          }
        />
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <SelectField
            label="Commit resources"
            value={draft.spendPreset}
            options={spendPresetOptions}
            onChange={(value) => {
              const nextValue = value as PolicySettings["spendPreset"];
              setField("spendPreset", nextValue);
              if (nextValue !== "custom") {
                setField("spendWithoutAsking", Number(nextValue));
              }
            }}
          />
          <InputField
            label="Custom amount"
            disabled={draft.spendPreset !== "custom"}
            value={String(draft.spendWithoutAsking)}
            onChange={(value) => setField("spendWithoutAsking", Number(value))}
          />
        </div>
        <SelectField
          label="Escalate when"
          value={draft.interruptWhen}
          options={interruptOptions}
          onChange={(value) =>
            setField("interruptWhen", value as PolicySettings["interruptWhen"])
          }
        />
        <SelectField
          label="Primary pursuit"
          value={draft.priorityBias}
          options={priorityBiasOptions}
          onChange={(value) =>
            setField("priorityBias", value as PolicySettings["priorityBias"])
          }
        />
        <SelectField
          label="Risk appetite"
          value={draft.riskTolerance}
          options={riskToleranceOptions}
          onChange={(value) =>
            setField("riskTolerance", value as PolicySettings["riskTolerance"])
          }
        />
        <SelectField
          label="Protect this thread"
          value={draft.scheduleProtection}
          options={scheduleProtectionOptions}
          onChange={(value) =>
            setField(
              "scheduleProtection",
              value as PolicySettings["scheduleProtection"],
            )
          }
        />
        <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] p-3">
          <FieldLabel>Standing instinct</FieldLabel>
          <textarea
            value={draft.ruleSummary}
            onChange={(event) => setField("ruleSummary", event.target.value)}
            rows={2}
            className="mt-2 w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)] outline-none"
            placeholder="If access rises but coherence frays, slow the split before it becomes identity."
          />
        </div>
        <div className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.95rem] text-[color:var(--text-main)]"
          >
            <span>Secondary settings</span>
            <span className="text-[0.9rem] text-[color:var(--text-muted)]">
              {showAdvanced ? "Hide" : "Show"}
            </span>
          </button>
          {showAdvanced ? (
            <div className="grid gap-3 border-t border-[color:var(--border-subtle)] px-4 py-4">
              <SelectField
                label="Signal cadence"
                value={draft.reportingFrequency}
                options={reportingOptions}
                onChange={(value) =>
                  setField(
                    "reportingFrequency",
                    value as PolicySettings["reportingFrequency"],
                  )
                }
              />
              <SelectField
                label="Pressure sensitivity"
                value={draft.escalationSensitivity}
                options={sensitivityOptions}
                onChange={(value) =>
                  setField(
                    "escalationSensitivity",
                    value as PolicySettings["escalationSensitivity"],
                  )
                }
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.95rem] text-[color:var(--text-muted)]">
          {isDirty ? "Uncommitted changes" : "Policy is live"}
        </div>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="border border-[color:var(--border-subtle)] bg-[color:var(--button-primary)] px-4 py-2 text-[1rem] font-medium text-[color:var(--button-primary-text)]"
        >
          Commit
        </button>
      </div>
    </Card>
  );
}

interface SegmentedFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SegmentedField({
  label,
  value,
  options,
  onChange,
}: SegmentedFieldProps) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`border px-3 py-2 text-[0.95rem] ${
              option.value === value
                ? "border-[color:var(--border-strong)] bg-[color:var(--surface-selected)]"
                : "border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)] outline-none"
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

interface InputFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function InputField({ label, value, disabled, onChange }: InputFieldProps) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={0}
        step={10}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-3 py-2 text-[0.95rem] text-[color:var(--text-main)] outline-none disabled:opacity-40"
      />
    </div>
  );
}

interface FieldLabelProps {
  children: string;
}

function FieldLabel({ children }: FieldLabelProps) {
  return (
    <label className="text-[0.85rem] uppercase tracking-[0.04em] text-[color:var(--text-dim)]">
      {children}
    </label>
  );
}
