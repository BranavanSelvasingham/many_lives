import type {
  AIContext,
  AIProvider,
  EscalationSuggestion,
  GeneratedInboxMessage,
  StreetAutonomousLineRequest,
  StreetAutonomousLineResult,
  StreetConversationInterpretationRequest,
  StreetConversationInterpretationResult,
} from "./provider.js";
import { MockAIProvider } from "./mockProvider.js";
import { buildClassifyEscalationPrompt } from "./prompts/classifyEscalation.js";
import { buildGenerateStreetAutonomousLinePrompt } from "./prompts/generateStreetAutonomousLine.js";
import { buildGenerateStreetReplyPrompt } from "./prompts/generateStreetReply.js";
import { buildGenerateStreetThoughtsPrompt } from "./prompts/generateStreetThoughts.js";
import { buildGenerateInboxMessagePrompt } from "./prompts/generateInboxMessage.js";
import { buildInterpretStreetConversationPrompt } from "./prompts/interpretStreetConversation.js";
import { buildProposeNextActionPrompt } from "./prompts/proposeNextAction.js";
import { buildSummarizeStatePrompt } from "./prompts/summarizeState.js";
import {
  buildDeterministicStreetReply,
  generatedReplyLooksInvalid,
  sanitizeDialogueReply,
  streetDialogueCacheKey,
  type StreetDialogueRequest,
  type StreetDialogueResult,
} from "./streetDialogue.js";
import {
  buildDeterministicStreetThoughts,
  sanitizeThought,
  streetThoughtsCacheKey,
  type StreetThoughtsResult,
} from "./streetThoughts.js";
import type { StreetGameState } from "../street-sim/types.js";

interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();
  private readonly streetThoughtCache = new Map<string, StreetThoughtsResult>();
  private readonly streetReplyCache = new Map<string, StreetDialogueResult>();

  constructor(private readonly options: OpenAIProviderOptions = {}) {}

  get name(): string {
    return this.options.apiKey ? "openai" : "openai-fallback";
  }

  async summarizeState(world: AIContext["world"]): Promise<string> {
    buildSummarizeStatePrompt(world);
    return this.callOrFallback(
      () => this.fallback.summarizeState(world),
      () => this.fallback.summarizeState(world),
    );
  }

  async classifyEscalation(context: AIContext): Promise<EscalationSuggestion> {
    buildClassifyEscalationPrompt(
      context.character,
      context.event,
      context.task,
    );
    return this.callOrFallback(
      () => this.fallback.classifyEscalation(context),
      () => this.fallback.classifyEscalation(context),
    );
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
    return this.callOrFallback(
      () => this.fallback.generateInboxMessage(context),
      () => this.fallback.generateInboxMessage(context),
    );
  }

  async proposeNextAction(context: AIContext): Promise<string[]> {
    buildProposeNextActionPrompt(
      context.character,
      context.event,
      context.task,
    );
    return this.callOrFallback(
      () => this.fallback.proposeNextAction(context),
      () => this.fallback.proposeNextAction(context),
    );
  }

  async generateStreetThoughts(
    game: StreetGameState,
  ): Promise<StreetThoughtsResult> {
    const cacheKey = streetThoughtsCacheKey(game);
    const cached = this.streetThoughtCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = buildGenerateStreetThoughtsPrompt(game);

    const result = await this.callOrFallback(async () => {
      const output = await this.createTextResponse(prompt, 220);
      return normalizeStreetThoughts(output, game);
    }, () => this.fallback.generateStreetThoughts(game));

    this.streetThoughtCache.set(cacheKey, result);
    return result;
  }

  async generateStreetReply(
    input: StreetDialogueRequest,
  ): Promise<StreetDialogueResult> {
    const cacheKey = streetDialogueCacheKey(input);
    const cached = this.streetReplyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = buildGenerateStreetReplyPrompt(input);
    const result = await this.callOrFallback(async () => {
      const output = await this.createTextResponse(prompt, 260);
      return normalizeStreetReply(output, input);
    }, () => this.fallback.generateStreetReply(input));

    this.streetReplyCache.set(cacheKey, result);
    return result;
  }

  async generateStreetAutonomousLine(
    input: StreetAutonomousLineRequest,
  ): Promise<StreetAutonomousLineResult> {
    const prompt = buildGenerateStreetAutonomousLinePrompt(input);

    return this.callOrFallback(async () => {
      const output = await this.createTextResponse(prompt, 120);
      return normalizeStreetAutonomousLine(output, input);
    }, () => this.fallback.generateStreetAutonomousLine(input));
  }

  async interpretStreetConversation(
    input: StreetConversationInterpretationRequest,
  ): Promise<StreetConversationInterpretationResult> {
    const prompt = buildInterpretStreetConversationPrompt(input);

    return this.callOrFallback(async () => {
      const output = await this.createTextResponse(prompt, 220);
      return normalizeStreetConversationInterpretation(output);
    }, () => this.fallback.interpretStreetConversation(input));
  }

  private async callOrFallback<T>(
    requestFactory: () => Promise<T>,
    fallbackFactory: () => Promise<T>,
  ): Promise<T> {
    if (!this.options.apiKey) {
      return fallbackFactory();
    }

    try {
      return await requestFactory();
    } catch {
      return fallbackFactory();
    }
  }

  private async createTextResponse(
    prompt: string,
    maxOutputTokens: number,
  ): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.model ?? "gpt-5-nano",
        input: prompt,
        reasoning: {
          effort: "minimal",
        },
        max_output_tokens: maxOutputTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const json = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };

    const outputText =
      json.output_text ??
      json.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text" || item.type === "text")
        .map((item) => item.text ?? "")
        .join("\n")
        .trim();

    if (!outputText) {
      throw new Error("OpenAI response did not include text output");
    }

    return outputText;
  }
}

function normalizeStreetThoughts(
  rawText: string,
  game: StreetGameState,
): StreetThoughtsResult {
  const fallback = buildDeterministicStreetThoughts(game);
  const parsed = safeParseThoughtsJson(rawText);
  if (!parsed) {
    return fallback;
  }

  return {
    playerThought: sanitizeThought(parsed.playerThought ?? fallback.playerThought),
    npcThoughts: Object.fromEntries(
      game.npcs.map((npc) => [
        npc.id,
        sanitizeThought(parsed.npcThoughts?.[npc.id] ?? fallback.npcThoughts[npc.id]),
      ]),
    ),
  };
}

function normalizeStreetReply(
  rawText: string,
  input: StreetDialogueRequest,
): StreetDialogueResult {
  const fallback = buildDeterministicStreetReply(input);
  const npcName = input.game.npcs.find((npc) => npc.id === input.npcId)?.name;
  const parsed = safeParseStreetReplyJson(rawText);
  if (!parsed) {
    return fallback;
  }

  const candidateReply = parsed.reply ?? fallback.reply;
  if (generatedReplyLooksInvalid(candidateReply, input)) {
    return fallback;
  }

  return {
    reply: sanitizeDialogueReply(candidateReply, npcName),
    followupThought: sanitizeThought(
      parsed.followupThought ?? fallback.followupThought ?? "",
    ),
  };
}

function normalizeStreetAutonomousLine(
  rawText: string,
  input: StreetAutonomousLineRequest,
): StreetAutonomousLineResult {
  const fallbackSpeech =
    input.purpose === "followup"
      ? "What does that change for me right now?"
      : "I'm Rowan. I'm trying to get my feet under me here. What matters most right now?";
  const parsed = safeParseAutonomousLineJson(rawText);
  return {
    speech: sanitizeStreetSpeech(parsed?.speech ?? fallbackSpeech),
  };
}

function normalizeStreetConversationInterpretation(
  rawText: string,
): StreetConversationInterpretationResult {
  const parsed = safeParseConversationInterpretationJson(rawText);
  if (!parsed) {
    return {};
  }

  return {
    decision: sanitizeOptionalNarrativeField(parsed.decision),
    memoryKind: isMemoryKind(parsed.memoryKind) ? parsed.memoryKind : undefined,
    memoryText: sanitizeOptionalNarrativeField(parsed.memoryText),
    npcImpression: sanitizeOptionalNarrativeField(parsed.npcImpression),
    objectiveText: sanitizeOptionalNarrativeField(parsed.objectiveText),
    summary: sanitizeOptionalNarrativeField(parsed.summary),
  };
}

function safeParseThoughtsJson(rawText: string): {
  playerThought?: string;
  npcThoughts?: Record<string, string>;
} | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as {
      playerThought?: string;
      npcThoughts?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

function safeParseAutonomousLineJson(rawText: string): {
  speech?: string;
} | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as {
      speech?: string;
    };
  } catch {
    return null;
  }
}

function safeParseConversationInterpretationJson(rawText: string): {
  decision?: string;
  memoryKind?: string;
  memoryText?: string;
  npcImpression?: string;
  objectiveText?: string;
  summary?: string;
} | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as {
      decision?: string;
      memoryKind?: string;
      memoryText?: string;
      npcImpression?: string;
      objectiveText?: string;
      summary?: string;
    };
  } catch {
    return null;
  }
}

function sanitizeStreetSpeech(text: string) {
  return text.replace(/\s+/g, " ").trim().replace(/^"+|"+$/g, "").slice(0, 240);
}

function sanitizeOptionalNarrativeField(text?: string) {
  const normalized = text?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 280) : undefined;
}

function isMemoryKind(
  value?: string,
): value is StreetConversationInterpretationResult["memoryKind"] {
  return (
    value === "place" ||
    value === "person" ||
    value === "job" ||
    value === "problem" ||
    value === "self"
  );
}

function safeParseStreetReplyJson(rawText: string): {
  reply?: string;
  followupThought?: string;
} | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as {
      reply?: string;
      followupThought?: string;
    };
  } catch {
    return null;
  }
}
