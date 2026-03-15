import type {
  AIContext,
  AIProvider,
  EscalationSuggestion,
  GeneratedInboxMessage,
} from "./provider.js";
import { MockAIProvider } from "./mockProvider.js";
import { buildClassifyEscalationPrompt } from "./prompts/classifyEscalation.js";
import { buildGenerateInboxMessagePrompt } from "./prompts/generateInboxMessage.js";
import { buildProposeNextActionPrompt } from "./prompts/proposeNextAction.js";
import { buildSummarizeStatePrompt } from "./prompts/summarizeState.js";

interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly fallback = new MockAIProvider();

  constructor(private readonly options: OpenAIProviderOptions = {}) {}

  async summarizeState(world: AIContext["world"]): Promise<string> {
    buildSummarizeStatePrompt(world);
    return this.callOrFallback(() => this.fallback.summarizeState(world));
  }

  async classifyEscalation(context: AIContext): Promise<EscalationSuggestion> {
    buildClassifyEscalationPrompt(
      context.character,
      context.event,
      context.task,
    );
    return this.callOrFallback(() => this.fallback.classifyEscalation(context));
  }

  async generateInboxMessage(
    context: AIContext & {
      escalation: EscalationSuggestion;
      suggestedActions: string[];
    },
  ): Promise<GeneratedInboxMessage> {
    buildGenerateInboxMessagePrompt(
      context.character,
      context.event,
      context.task,
    );
    return this.callOrFallback(() =>
      this.fallback.generateInboxMessage(context),
    );
  }

  async proposeNextAction(context: AIContext): Promise<string[]> {
    buildProposeNextActionPrompt(
      context.character,
      context.event,
      context.task,
    );
    return this.callOrFallback(() => this.fallback.proposeNextAction(context));
  }

  private async callOrFallback<T>(
    fallbackFactory: () => Promise<T>,
  ): Promise<T> {
    if (!this.options.apiKey) {
      return fallbackFactory();
    }

    // TODO: Replace this stub with a real OpenAI Responses API call once live AI behavior is desired.
    // The prototype intentionally stays deterministic for now, even if a key is present.
    return fallbackFactory();
  }
}
