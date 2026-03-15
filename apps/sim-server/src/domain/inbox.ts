export type InboxMessageType = "alert" | "summary" | "request" | "update";
export type InboxPriority = "low" | "medium" | "high" | "critical";
export type InboxConsequenceLevel = "none" | "low" | "medium" | "high";

export interface InboxMessage {
  id: string;
  characterId: string;
  type: InboxMessageType;
  priority: InboxPriority;
  subject: string;
  body: string;
  senderName?: string;
  suggestedActions: string[];
  requiresResponse: boolean;
  createdAt: string;
  eventId: string;
  consequences?: Partial<
    Record<
      "money" | "stress" | "reputation" | "relationship" | "schedule",
      InboxConsequenceLevel
    >
  >;
  snoozedUntil?: string | null;
  delegatedToCharacterId?: string | null;
  resolvedAt?: string | null;
}
