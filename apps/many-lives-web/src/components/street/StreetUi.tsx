import type { ReactNode } from "react";

import type { ActionOption, FeedEntry } from "@/lib/street/types";

import {
  actionTone,
  logTone,
  noteTone,
  statusTone,
  type MemoryEntryTone,
} from "./streetFormatting";

export function Panel({
  title,
  subtitle,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={`rounded-[30px] border border-[color:var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,23,28,0.96)_0%,rgba(12,17,21,0.94)_100%)] px-5 py-5 shadow-[0_24px_72px_rgba(0,0,0,0.28)] sm:px-6 ${
        className ?? ""
      }`}
    >
      <div className="border-b border-[rgba(111,122,130,0.22)] pb-4">
        <div className="text-[0.8rem] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-2 max-w-[62ch] text-[1rem] leading-7 text-[color:var(--text-main)]">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className={`pt-4 ${contentClassName ?? ""}`}>{children}</div>
    </section>
  );
}

export function SubSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-[22px] border border-[rgba(117,128,137,0.2)] bg-[linear-gradient(180deg,rgba(24,31,37,0.9)_0%,rgba(17,24,29,0.82)_100%)] px-4 py-3">
      <div className="text-[0.72rem] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="mt-3 text-[1.16rem] font-medium text-[color:var(--text-main)]">
        {value}
      </div>
    </div>
  );
}

export function ActionCard({
  action,
  onRun,
  busy,
}: {
  action: ActionOption;
  onRun: () => void;
  busy: boolean;
}) {
  return (
    <button
      className={`w-full rounded-[24px] border px-4 py-4 text-left transition sm:px-5 ${actionTone(
        action,
      )}`}
      disabled={busy || action.disabled}
      onClick={onRun}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="text-[1rem] font-medium text-[color:var(--text-main)]">
            {action.label}
          </div>
          <div className="text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
            {action.description}
          </div>
          {action.disabledReason ? (
            <div className="text-[0.82rem] uppercase tracking-[0.16em] text-[color:var(--accent-alert)]">
              {action.disabledReason}
            </div>
          ) : null}
        </div>
        <div className="rounded-full border border-[color:var(--border-subtle)] px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
          {action.kind.replace("_", " ")}
        </div>
      </div>
    </button>
  );
}

export function LeadCard({
  title,
  subtitle,
  body,
  status,
}: {
  title: string;
  subtitle: string;
  body: string;
  status: string;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(117,128,137,0.2)] bg-[rgba(18,24,29,0.84)] px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[1rem] font-medium text-[color:var(--text-main)]">
            {title}
          </div>
          <div className="mt-1 text-[0.84rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
            {subtitle}
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] ${statusTone(
            status,
          )}`}
        >
          {status.replace("_", " ")}
        </div>
      </div>
      <div className="mt-3 text-[0.92rem] leading-6 text-[color:var(--text-muted)]">
        {body}
      </div>
    </div>
  );
}

export function InfoChip({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[20px] border border-[rgba(117,128,137,0.2)] bg-[rgba(18,24,29,0.82)] px-4 py-3">
      <div className="text-[0.92rem] font-medium text-[color:var(--text-main)]">
        {title}
      </div>
      <div className="mt-1.5 text-[0.86rem] leading-6 text-[color:var(--text-muted)]">
        {detail}
      </div>
    </div>
  );
}

export function LogRow({
  body,
  meta,
  tone,
}: {
  body: string;
  meta: string;
  tone: FeedEntry["tone"] | MemoryEntryTone;
}) {
  return (
    <div className="rounded-[22px] border border-[rgba(117,128,137,0.2)] bg-[rgba(18,24,29,0.84)] px-4 py-3 sm:px-5">
      <div className="text-[0.92rem] leading-6 text-[color:var(--text-main)]">
        {body}
      </div>
      <div className={`mt-2 text-[0.78rem] uppercase tracking-[0.16em] ${logTone(tone)}`}>
        {meta}
      </div>
    </div>
  );
}

export function MutedLine({ text }: { text: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[rgba(117,128,137,0.22)] px-4 py-3 text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

export function ControlButton({
  label,
  onClick,
  quiet = false,
}: {
  label: string;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      className={`inline-flex min-h-[42px] items-center justify-center rounded-full px-4 py-2 text-[0.8rem] uppercase tracking-[0.18em] transition ${
        quiet
          ? "border border-[rgba(117,128,137,0.22)] bg-[rgba(18,24,29,0.82)] text-[color:var(--text-main)] hover:bg-[rgba(24,32,39,0.92)]"
          : "bg-[color:var(--button-primary)] text-[color:var(--button-primary-text)] hover:brightness-[1.04]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function SceneNoteCard({
  tone,
  text,
}: {
  tone: "info" | "lead" | "warning";
  text: string;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-3 text-[0.92rem] leading-6 ${noteTone(
        tone,
      )}`}
    >
      {text}
    </div>
  );
}
