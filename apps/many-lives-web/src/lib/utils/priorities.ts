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
  "Pending",
  "Signals",
];

export const autonomyOptions: Array<{
  value: PolicySettings["autonomy"];
  label: string;
}> = [
  { value: "low", label: "Tight leash" },
  { value: "medium", label: "Shared control" },
  { value: "high", label: "Independent" },
];

export const interruptOptions: Array<{
  value: PolicySettings["interruptWhen"];
  label: string;
}> = [
  { value: "always", label: "Any decisive shift" },
  { value: "important_only", label: "High-leverage threads" },
  { value: "emergencies_only", label: "Only when coherence breaks" },
];

export const priorityBiasOptions: Array<{
  value: PolicySettings["priorityBias"];
  label: string;
}> = [
  { value: "access", label: "Access" },
  { value: "momentum", label: "Momentum" },
  { value: "signal", label: "Signal" },
  { value: "coherence", label: "Coherence" },
];

export const riskToleranceOptions: Array<{
  value: PolicySettings["riskTolerance"];
  label: string;
}> = [
  { value: "careful", label: "Measured" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Predatory" },
];

export const scheduleProtectionOptions: Array<{
  value: PolicySettings["scheduleProtection"];
  label: string;
}> = [
  { value: "strict", label: "Guard coherence" },
  { value: "flexible", label: "Stay fluid" },
  { value: "opportunistic", label: "Chase weak signals" },
];

export const reportingOptions: Array<{
  value: PolicySettings["reportingFrequency"];
  label: string;
}> = [
  { value: "minimal", label: "Sparse" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Constant signal" },
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
      if (tab === "Pending") return message.requiresResponse;
      if (tab === "Signals")
        return ["status", "social", "opportunity"].includes(message.type);
      return true;
    })
    .sort(compareMessages);
}

export function buildInboxTabCounts(
  messages: InboxMessageView[],
  currentTimeIso: string,
) {
  return Object.fromEntries(
    inboxTabs.map((tab) => [
      tab,
      filterInboxMessages(messages, tab, currentTimeIso).length,
    ]),
  ) as Record<InboxTab, number>;
}

export function findFirstUrgentMessage(
  messages: InboxMessageView[],
  currentTimeIso: string,
) {
  return filterInboxMessages(messages, "All", currentTimeIso).find(
    (message) => message.priority === "urgent",
  );
}

export function findDefaultMessage(
  messages: InboxMessageView[],
  currentTimeIso: string,
) {
  const visible = filterInboxMessages(messages, "All", currentTimeIso);
  const urgent = visible.find((message) => message.priority === "urgent");
  if (urgent) return urgent;
  return [...visible].sort(compareMessages)[0] ?? null;
}

export function messageConsequenceScore(message: InboxMessageView) {
  const weights = {
    access: 6,
    momentum: 5,
    signal: 5,
    coherence: 6,
    risk: 4,
    socialDebt: 4,
    rivalAttention: 5,
  } as const;

  return Object.entries(message.consequences).reduce((total, [key, value]) => {
    const level = riskWeight(value ?? "none");
    const weight = weights[key as keyof typeof weights] ?? 1;
    return total + level * weight;
  }, 0);
}

function compareMessages(left: InboxMessageView, right: InboxMessageView) {
  const rankDelta = priorityRank(left.priority) - priorityRank(right.priority);
  if (rankDelta !== 0) return rankDelta;

  const responseDelta =
    Number(right.requiresResponse) - Number(left.requiresResponse);
  if (responseDelta !== 0) return responseDelta;

  const consequenceDelta =
    messageConsequenceScore(right) - messageConsequenceScore(left);
  if (consequenceDelta !== 0) return consequenceDelta;

  return right.createdAtIso.localeCompare(left.createdAtIso);
}

function riskWeight(level: RiskLevel) {
  switch (level) {
    case "high":
      return 4;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}
