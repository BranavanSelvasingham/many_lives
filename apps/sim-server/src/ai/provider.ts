import type { Character } from "../domain/character.js";
import type { EventRecord } from "../domain/event.js";
import type { InboxMessageType, InboxPriority } from "../domain/inbox.js";
import type { StreetGameState } from "../street-sim/types.js";
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
}

export function createAIProvider(
  providerName = process.env.AI_PROVIDER ?? "mock",
): AIProvider {
  if (providerName === "openai") {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
    });
  }

  return new MockAIProvider();
}
