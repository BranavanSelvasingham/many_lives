import type { Character } from "../domain/character.js";
import type { EventRecord } from "../domain/event.js";
import type { InboxMessageType, InboxPriority } from "../domain/inbox.js";
import type {
  MemoryEntry,
  ObjectiveFocus,
  StreetGameState,
} from "../street-sim/types.js";
import type { Task } from "../domain/task.js";
import type { WorldState } from "../domain/world.js";
import { MockAIProvider } from "./mockProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";
import type {
  StreetDialogueRequest,
  StreetDialogueResult,
} from "./streetDialogue.js";
import type { StreetThoughtsResult } from "./streetThoughts.js";

export interface AIContext {
  world: WorldState;
  character: Character;
  event: EventRecord;
  task?: Task;
}

export interface EscalationSuggestion {
  shouldEscalate: boolean;
  priority: InboxPriority;
  rationale: string;
}

export interface GeneratedInboxMessage {
  type: InboxMessageType;
  priority: InboxPriority;
  subject: string;
  body: string;
  suggestedActions: string[];
  requiresResponse: boolean;
}

export interface StreetAutonomousLineRequest {
  game: StreetGameState;
  lastNpcReply?: string;
  npcId: string;
  objective: {
    focus: ObjectiveFocus;
    routeKey: string;
    text: string;
  };
  purpose: "opener" | "followup";
}

export interface StreetAutonomousLineResult {
  speech: string;
}

export interface StreetConversationInterpretationRequest {
  closingReply: string;
  discussedTopics: string[];
  game: StreetGameState;
  npcId: string;
  objective: {
    focus: ObjectiveFocus;
    routeKey: string;
    text: string;
  };
}

export interface StreetConversationInterpretationResult {
  decision?: string;
  memoryKind?: MemoryEntry["kind"];
  memoryText?: string;
  npcImpression?: string;
  objectiveText?: string;
  summary?: string;
}

export interface AIProvider {
  readonly name: string;
  summarizeState(world: WorldState): Promise<string>;
  classifyEscalation(context: AIContext): Promise<EscalationSuggestion>;
  generateInboxMessage(
    context: AIContext & {
      escalation: EscalationSuggestion;
      suggestedActions: string[];
    },
  ): Promise<GeneratedInboxMessage>;
  proposeNextAction(context: AIContext): Promise<string[]>;
  generateStreetThoughts(game: StreetGameState): Promise<StreetThoughtsResult>;
  generateStreetReply(
    input: StreetDialogueRequest,
  ): Promise<StreetDialogueResult>;
  generateStreetAutonomousLine(
    input: StreetAutonomousLineRequest,
  ): Promise<StreetAutonomousLineResult>;
  interpretStreetConversation(
    input: StreetConversationInterpretationRequest,
  ): Promise<StreetConversationInterpretationResult>;
}

export function createAIProvider(
  providerName = process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "mock"),
): AIProvider {
  if (providerName === "openai") {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    });
  }

  return new MockAIProvider();
}
