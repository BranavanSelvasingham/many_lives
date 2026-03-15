import type {
  InboxMessageView,
  InboxTab,
  MessageType,
  PolicySettings,
  PriorityLevel,
  RiskLevel,
} from "@/lib/types/game";

export const inboxTabs: InboxTab[] = [
  "All",
  "Urgent",
  "Waiting",
  "Reports",
  "Opportunities",
];

export const autonomyOptions: Array<{
  value: PolicySettings["autonomy"];
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const interruptOptions: Array<{
  value: PolicySettings["interruptWhen"];
  label: string;
}> = [
  { value: "always", label: "Always" },
  { value: "important_only", label: "Important only" },
  { value: "emergencies_only", label: "Emergencies only" },
];

export const priorityBiasOptions: Array<{
  value: PolicySettings["priorityBias"];
  label: string;
}> = [
  { value: "work", label: "Work" },
  { value: "family", label: "Family" },
  { value: "money", label: "Money" },
  { value: "health", label: "Health" },
  { value: "relationships", label: "Relationships" },
];

export const riskToleranceOptions: Array<{
  value: PolicySettings["riskTolerance"];
  label: string;
}> = [
  { value: "careful", label: "Careful" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" },
];

export const scheduleProtectionOptions: Array<{
  value: PolicySettings["scheduleProtection"];
  label: string;
}> = [
  { value: "strict", label: "Strict" },
  { value: "flexible", label: "Flexible" },
  { value: "opportunistic", label: "Opportunistic" },
];

export const reportingOptions: Array<{
  value: PolicySettings["reportingFrequency"];
  label: string;
}> = [
  { value: "minimal", label: "Minimal" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
];

export const sensitivityOptions: Array<{
  value: PolicySettings["escalationSensitivity"];
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

export const spendPresetOptions: Array<{
  value: PolicySettings["spendPreset"];
  label: string;
}> = [
  { value: "0", label: "$0" },
  { value: "50", label: "$50" },
  { value: "200", label: "$200" },
  { value: "custom", label: "Custom" },
];

export function priorityRank(priority: PriorityLevel) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    default:
      return 3;
  }
}

export function toneForPriority(
  priority: PriorityLevel | RiskLevel | MessageType,
) {
  return priority;
}

export function isVisibleMessage(
  message: Pick<InboxMessageView, "resolvedAt" | "snoozedUntil">,
  currentTimeIso: string,
) {
  if (message.resolvedAt) return false;
  if (!message.snoozedUntil) return true;
  return message.snoozedUntil <= currentTimeIso;
}

export function filterInboxMessages(
  messages: InboxMessageView[],
  tab: InboxTab,
  currentTimeIso: string,
) {
  return messages
    .filter((message) => isVisibleMessage(message, currentTimeIso))
    .filter((message) => {
      if (tab === "Urgent") return priorityRank(message.priority) <= 1;
      if (tab === "Waiting") return message.requiresResponse;
      if (tab === "Reports") return ["status", "social"].includes(message.type);
      if (tab === "Opportunities") return message.type === "opportunity";
      return true;
    })
    .sort((left, right) => {
      const rankDelta =
        priorityRank(left.priority) - priorityRank(right.priority);
      if (rankDelta !== 0) return rankDelta;
      return right.createdAtIso.localeCompare(left.createdAtIso);
    });
}
