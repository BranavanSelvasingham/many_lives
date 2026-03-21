import type { ActionOption, FeedEntry } from "@/lib/street/types";

export type MemoryEntryTone = "place" | "person" | "job" | "problem" | "self";

export function formatClock(isoTime: string) {
  const date = new Date(isoTime);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export function humanizeKey(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function noteTone(tone: "info" | "lead" | "warning") {
  switch (tone) {
    case "lead":
      return "border-[rgba(183,146,89,0.32)] bg-[rgba(183,146,89,0.08)] text-[color:var(--text-main)]";
    case "warning":
      return "border-[rgba(167,105,99,0.35)] bg-[rgba(167,105,99,0.12)] text-[color:var(--text-main)]";
    case "info":
    default:
      return "border-[color:var(--border-subtle)] bg-[rgba(18,24,29,0.84)] text-[color:var(--text-muted)]";
  }
}

export function actionTone(action: ActionOption) {
  if (action.disabled) {
    return "border-[rgba(67,74,81,0.65)] bg-[rgba(22,26,31,0.72)] opacity-70";
  }

  switch (action.emphasis) {
    case "high":
      return "border-[rgba(183,146,89,0.42)] bg-[rgba(183,146,89,0.08)] hover:bg-[rgba(183,146,89,0.14)]";
    case "medium":
      return "border-[rgba(91,110,124,0.42)] bg-[rgba(32,43,52,0.72)] hover:bg-[rgba(32,43,52,0.9)]";
    case "low":
    default:
      return "border-[color:var(--border-subtle)] bg-[rgba(18,24,29,0.78)] hover:bg-[rgba(20,27,33,0.96)]";
  }
}

export function statusTone(status: string) {
  switch (status) {
    case "done":
    case "solved":
    case "completed":
      return "border border-[rgba(183,146,89,0.4)] bg-[rgba(183,146,89,0.12)] text-[color:var(--text-main)]";
    case "accepted":
    case "open":
    case "active":
      return "border border-[rgba(91,110,124,0.42)] bg-[rgba(32,43,52,0.72)] text-[color:var(--text-main)]";
    case "missed":
    case "expired":
      return "border border-[rgba(167,105,99,0.4)] bg-[rgba(167,105,99,0.12)] text-[color:var(--text-main)]";
    default:
      return "border border-[color:var(--border-subtle)] bg-[rgba(18,24,29,0.84)] text-[color:var(--text-muted)]";
  }
}

export function logTone(tone: FeedEntry["tone"] | MemoryEntryTone) {
  switch (tone) {
    case "job":
      return "text-[color:var(--accent-brass)]";
    case "problem":
      return "text-[color:var(--accent-alert)]";
    case "memory":
    case "self":
    case "person":
    case "place":
      return "text-[color:var(--text-dim)]";
    case "info":
    default:
      return "text-[color:var(--text-muted)]";
  }
}
