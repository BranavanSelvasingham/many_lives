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

export function actionKindLabel(kind: ActionOption["kind"]) {
  switch (kind) {
    case "accept_job":
      return "take work";
    case "work_job":
      return "shift";
    case "inspect":
      return "look closer";
    case "solve":
      return "help";
    case "buy":
      return "trade";
    case "contribute":
      return "pull weight";
    case "rest":
      return "rest";
    case "talk":
    default:
      return "talk";
  }
}

export function jobStatusLabel(status: string) {
  switch (status) {
    case "done":
    case "completed":
      return "paid";
    case "accepted":
      return "taken";
    case "missed":
      return "slipped";
    case "open":
    default:
      return "available";
  }
}

export function problemStatusLabel(status: string) {
  switch (status) {
    case "solved":
      return "settled";
    case "expired":
      return "missed";
    case "active":
      return "brewing";
    default:
      return "quiet";
  }
}

export function reputationLabel(value: number) {
  if (value >= 4) {
    return "Part of the place";
  }

  if (value >= 3) {
    return "Asked for by name";
  }

  if (value >= 2) {
    return "Treated as useful";
  }

  if (value >= 1) {
    return "Recognized on sight";
  }

  return "Still a stranger";
}

export function districtSenseLabel(knownPlaces: number) {
  if (knownPlaces >= 5) {
    return "Know the block";
  }

  if (knownPlaces >= 3) {
    return "Learning lanes";
  }

  return "Still strange";
}

export function workReadLabel(completedJobs: number, activeJobId?: string) {
  if (completedJobs >= 2) {
    return "Pulling weight";
  }

  if (completedJobs >= 1) {
    return "Work behind you";
  }

  if (activeJobId) {
    return "Shift in hand";
  }

  return "Still looking";
}

export function standingReadLabel(
  solvedProblems: number,
  completedJobs: number,
) {
  const usefulMoments = solvedProblems + completedJobs;

  if (usefulMoments >= 2) {
    return "Known face";
  }

  if (usefulMoments >= 1) {
    return "Getting known";
  }

  return "Still new";
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

export function toFirstPersonText(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  const directMatch = exactFirstPersonRewrite(cleaned);
  if (directMatch) {
    return directMatch;
  }

  const rewritten = cleaned
    .replace(/\bYou're\b/g, "I'm")
    .replace(/\bYou've\b/g, "I've")
    .replace(/\bYou'll\b/g, "I'll")
    .replace(/\bYou'd\b/g, "I'd")
    .replace(/\bYou are\b/g, "I'm")
    .replace(/\bYou were\b/g, "I was")
    .replace(/\bYou have\b/g, "I have")
    .replace(/\bYou had\b/g, "I had")
    .replace(/\bYou do\b/g, "I do")
    .replace(/\bYou did\b/g, "I did")
    .replace(/\bYou can\b/g, "I can")
    .replace(/\bYou cannot\b/g, "I can't")
    .replace(/\bYou need\b/g, "I need")
    .replace(/\bYou stopped\b/g, "I stopped")
    .replace(/\bYou decided\b/g, "I decided")
    .replace(/\bYou let\b/g, "I let")
    .replace(/\bYou spent\b/g, "I spent")
    .replace(/\bYou bought\b/g, "I bought")
    .replace(/\bYou woke\b/g, "I woke")
    .replace(/\bYou found\b/g, "I found")
    .replace(/\bYou noticed\b/g, "I noticed")
    .replace(/\bYou finished\b/g, "I finished")
    .replace(/\bYou committed\b/g, "I committed")
    .replace(/\bYou\b/g, "I")
    .replace(/\byou're\b/g, "I'm")
    .replace(/\byou've\b/g, "I've")
    .replace(/\byou'll\b/g, "I'll")
    .replace(/\byou'd\b/g, "I'd")
    .replace(/\byour\b/g, "my")
    .replace(/\byours\b/g, "mine")
    .replace(/\bRowan is currently trying to\b/g, "I'm trying to")
    .replace(/\bRowan is\b/g, "I'm")
    .replace(/\bRowan's\b/g, "my");

  return imperativeToFirstPerson(rewritten);
}

function exactFirstPersonRewrite(text: string) {
  const normalized = text.replace(/[.!?]+$/, "");

  switch (normalized) {
    case "Need a wrench first":
      return "I need a wrench first.";
    case "Go fix that pump":
      return "I should go fix that pump.";
    case "That cart needs moving":
      return "I need to move that cart.";
    case "Need somewhere to stay beyond tonight":
      return "I need somewhere to stay beyond tonight.";
    case "Need a few people here who could become friends":
      return "I need to meet a few people I could actually befriend.";
    case "Need to learn these lanes":
      return "I need to learn these lanes.";
    case "Need to learn these lanes if I'm making a life here":
      return "I need to learn these lanes if I'm making a life here.";
    case "Need work before dark":
      return "I need to start bringing in money.";
    case "Need steadier income if I'm going to stay here":
      return "I need steadier income if I'm going to stay here.";
    case "Could use a proper sit-down":
      return "I could use a proper sit-down.";
    case "Don't blow this shift":
      return "I can't blow this shift.";
    case "Someone here needs a hand":
      return "I think someone here needs a hand.";
    case "One of these people could become mine":
      return "I think I could find a real friend here.";
    case "Need another pair of hands":
      return "I need another pair of hands.";
    case "Keep the cups moving":
      return "I need to keep the cups moving.";
    case "Move the load, not excuses":
      return "I need to move the load, not make excuses.";
    case "Need one more back today":
      return "I need one more back today.";
    case "Watch the boats, not the gulls":
      return "I need to watch the boats, not the gulls.";
    case "No clear direction yet. Rowan is still reading the block":
      return "I don't have a clear direction yet. I'm still getting my bearings.";
    default:
      return null;
  }
}

function imperativeToFirstPerson(text: string) {
  const patterns: Array<[RegExp, string]> = [
    [/^Find\b/i, "I need to find"],
    [/^Learn\b/i, "I need to learn"],
    [/^Get\b/i, "I need to get"],
    [/^Buy\b/i, "I should buy"],
    [/^Fix\b/i, "I should fix"],
    [/^Clear\b/i, "I should clear"],
    [/^Finish\b/i, "I need to finish"],
    [/^Go\b/i, "I should go"],
    [/^Move\b/i, "I need to move"],
    [/^Talk to\b/i, "I should talk to"],
    [/^Rest\b/i, "I should rest"],
    [/^Need\b/i, "I need"],
    [/^Could use\b/i, "I could use"],
    [/^Keep\b/i, "I need to keep"],
    [/^Watch\b/i, "I need to watch"],
    [/^Don't\b/i, "I can't"],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(text)) {
      return ensureSentence(text.replace(pattern, replacement));
    }
  }

  return ensureSentence(text);
}

function ensureSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
