import type {
  AIContext,
  AIProvider,
  EscalationSuggestion,
  GeneratedInboxMessage,
  StreetAutonomousLineRequest,
  StreetAutonomousLineResult,
  StreetConversationInterpretationRequest,
  StreetConversationInterpretationResult,
  StreetPlanningRequest,
  StreetPlanningResult,
} from "./provider.js";
import { MockAIProvider } from "./mockProvider.js";
import { buildClassifyEscalationPrompt } from "./prompts/classifyEscalation.js";
import { buildGenerateStreetAutonomousLinePrompt } from "./prompts/generateStreetAutonomousLine.js";
import { buildGenerateStreetReplyPrompt } from "./prompts/generateStreetReply.js";
import { buildGenerateStreetThoughtsPrompt } from "./prompts/generateStreetThoughts.js";
import { buildGenerateInboxMessagePrompt } from "./prompts/generateInboxMessage.js";
import { buildInterpretStreetConversationPrompt } from "./prompts/interpretStreetConversation.js";
import { buildPlanStreetNextActionPrompt } from "./prompts/planStreetNextAction.js";
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
import { normalizeStreetVoice } from "./streetVoice.js";
import {
  buildDeterministicStreetThoughts,
  sanitizeThought,
  streetThoughtsCacheKey,
  type StreetThoughtsResult,
} from "./streetThoughts.js";
import type {
  AIRuntimeState,
  AIRuntimeTask,
  StreetGameState,
} from "../street-sim/types.js";

export type OpenAIProviderTask =
  | "generateStreetAutonomousLine"
  | "generateStreetReply"
  | "generateStreetThoughts"
  | "interpretStreetConversation"
  | "planStreetNextAction";

export interface OpenAIProviderCallLogEntry {
  durationMs: number;
  error?: string;
  gameId?: string;
  model: string;
  status: "fallback" | "skipped" | "success";
  task: OpenAIProviderTask;
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  onCall?: (entry: OpenAIProviderCallLogEntry) => void;
  timeoutMs?: number;
}

export const DEFAULT_OPENAI_TIMEOUT_MS = 25_000;
const MAX_OPENAI_TIMEOUT_MS = 30_000;

export class OpenAIProvider implements AIProvider {
  private readonly fallback = new MockAIProvider();
  private readonly callLog: OpenAIProviderCallLogEntry[] = [];
  private readonly streetThoughtCache = new Map<string, StreetThoughtsResult>();
  private readonly streetReplyCache = new Map<string, StreetDialogueResult>();

  constructor(private readonly options: OpenAIProviderOptions = {}) {}

  get name(): string {
    return this.options.apiKey ? "openai" : "openai-fallback";
  }

  get model(): string {
    return this.modelName();
  }

  getCallLog(): OpenAIProviderCallLogEntry[] {
    return [...this.callLog];
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
    if (!shouldUseOpenAIForStreetSupportTasks()) {
      this.recordCall({
        durationMs: 0,
        error: "OPENAI_STREET_SUPPORT_TASKS is not enabled.",
        gameId: game.id,
        model: this.modelName(),
        status: "skipped",
        task: "generateStreetThoughts",
      }, game);
      return this.fallback.generateStreetThoughts(game);
    }

    const cacheKey = streetThoughtsCacheKey(game);
    const cached = this.streetThoughtCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = buildGenerateStreetThoughtsPrompt(game);

    const result = await this.callOpenAIOrFallback(
      "generateStreetThoughts",
      game,
      async () => {
        const output = await this.createTextResponse(prompt, 220);
        return normalizeStreetThoughts(output, game);
      },
      () => this.fallback.generateStreetThoughts(game),
    );

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
    const result = await this.callOpenAIOrFallback(
      "generateStreetReply",
      input.game,
      async () => {
        const output = await this.createTextResponse(prompt, 260);
        return normalizeStreetReply(output, input);
      },
      () => this.fallback.generateStreetReply(input),
    );

    this.streetReplyCache.set(cacheKey, result);
    return result;
  }

  async generateStreetAutonomousLine(
    input: StreetAutonomousLineRequest,
  ): Promise<StreetAutonomousLineResult> {
    const prompt = buildGenerateStreetAutonomousLinePrompt(input);

    return this.callOpenAIOrFallback(
      "generateStreetAutonomousLine",
      input.game,
      async () => {
        const output = await this.createTextResponse(prompt, 120);
        return normalizeStreetAutonomousLine(output, input);
      },
      () => this.fallback.generateStreetAutonomousLine(input),
    );
  }

  async interpretStreetConversation(
    input: StreetConversationInterpretationRequest,
  ): Promise<StreetConversationInterpretationResult> {
    const prompt = buildInterpretStreetConversationPrompt(input);

    return this.callOpenAIOrFallback(
      "interpretStreetConversation",
      input.game,
      async () => {
        const output = await this.createTextResponse(prompt, 220);
        return normalizeStreetConversationInterpretation(output);
      },
      () => this.fallback.interpretStreetConversation(input),
    );
  }

  async planStreetNextAction(
    input: StreetPlanningRequest,
  ): Promise<StreetPlanningResult | null> {
    const prompt = buildPlanStreetNextActionPrompt(input);

    return this.callOpenAIOrFallback(
      "planStreetNextAction",
      input.game,
      async () => {
        const output = await this.createTextResponse(prompt, 160);
        return normalizeStreetPlanningResult(output, input);
      },
      () => this.fallback.planStreetNextAction(input),
    );
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

  private async callOpenAIOrFallback<T>(
    task: OpenAIProviderTask,
    game: StreetGameState | undefined,
    requestFactory: () => Promise<T>,
    fallbackFactory: () => Promise<T>,
  ): Promise<T> {
    if (!this.options.apiKey) {
      this.recordCall({
        durationMs: 0,
        error: "OPENAI_API_KEY is not configured.",
        gameId: game?.id,
        model: this.modelName(),
        status: "skipped",
        task,
      }, game);
      return fallbackFactory();
    }

    const startedAt = Date.now();
    try {
      const result = await requestFactory();
      this.recordCall({
        durationMs: Date.now() - startedAt,
        gameId: game?.id,
        model: this.modelName(),
        status: "success",
        task,
      }, game);
      return result;
    } catch (error) {
      this.recordCall({
        durationMs: Date.now() - startedAt,
        error: formatOpenAIError(error),
        gameId: game?.id,
        model: this.modelName(),
        status: "fallback",
        task,
      }, game);
      return fallbackFactory();
    }
  }

  private async createTextResponse(
    prompt: string,
    maxOutputTokens: number,
  ): Promise<string> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.requestTimeoutMs());

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelName(),
          input: prompt,
          reasoning: {
            effort: "minimal",
          },
          max_output_tokens: maxOutputTokens,
        }),
        signal: abortController.signal,
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private requestTimeoutMs(): number {
    return normalizeOpenAIRequestTimeoutMs(
      this.options.timeoutMs ?? Number(process.env.OPENAI_TIMEOUT_MS),
    );
  }

  private modelName(): string {
    return this.options.model ?? "gpt-5-nano";
  }

  private recordCall(
    entry: OpenAIProviderCallLogEntry,
    game?: StreetGameState,
  ): void {
    this.callLog.push(entry);
    if (game) {
      recordAIRuntimeCall(game, entry);
    }
    this.options.onCall?.(entry);
  }
}

const AI_RUNTIME_TASKS: AIRuntimeTask[] = [
  "generateStreetAutonomousLine",
  "generateStreetReply",
  "generateStreetThoughts",
  "interpretStreetConversation",
  "planStreetNextAction",
];

function recordAIRuntimeCall(
  game: StreetGameState,
  entry: OpenAIProviderCallLogEntry,
) {
  const runtime = ensureAIRuntime(game, entry.model);
  const task = runtime.tasks[entry.task];
  const now = new Date().toISOString();

  task.lastStatus = entry.status;
  task.lastUpdatedAt = now;
  runtime.lastUpdatedAt = now;

  if (entry.status === "success") {
    task.successes += 1;
    runtime.totalSuccesses += 1;
    runtime.lastLiveCallAt = now;
    runtime.status = "live";
  } else if (entry.status === "fallback") {
    const reason = redactFallbackReason(entry.error);
    task.fallbacks += 1;
    task.lastFallbackReason = reason;
    runtime.totalFallbacks += 1;
    runtime.status = runtime.totalSuccesses > 0 ? "live" : "fallback";
    if (reason) {
      runtime.fallbackReasons = [reason, ...runtime.fallbackReasons]
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 5);
    }
  } else {
    task.skips += 1;
    runtime.totalSkips += 1;
    runtime.status =
      runtime.totalSuccesses > 0
        ? "live"
        : runtime.totalFallbacks > 0
          ? "fallback"
          : "not_called";
  }
}

function ensureAIRuntime(
  game: StreetGameState,
  model: string,
): AIRuntimeState {
  if (!game.aiRuntime) {
    game.aiRuntime = {
      fallbackReasons: [],
      model,
      provider: "openai",
      status: "not_called",
      tasks: Object.fromEntries(
        AI_RUNTIME_TASKS.map((task) => [
          task,
          {
            fallbacks: 0,
            skips: 0,
            successes: 0,
          },
        ]),
      ) as AIRuntimeState["tasks"],
      totalFallbacks: 0,
      totalSkips: 0,
      totalSuccesses: 0,
    };
  }

  game.aiRuntime.model = model;
  game.aiRuntime.provider = "openai";
  return game.aiRuntime;
}

function redactFallbackReason(reason: string | undefined) {
  if (!reason) {
    return "OpenAI request fell back.";
  }

  return reason
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-[redacted]")
    .slice(0, 180);
}

function formatOpenAIError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 300);
  }

  return String(error).slice(0, 300);
}

function normalizeOpenAIRequestTimeoutMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.round(value), 1), MAX_OPENAI_TIMEOUT_MS);
}

function shouldUseOpenAIForStreetSupportTasks(): boolean {
  return process.env.OPENAI_STREET_SUPPORT_TASKS === "1";
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

function normalizeStreetPlanningResult(
  rawText: string,
  input: StreetPlanningRequest,
): StreetPlanningResult | null {
  const parsed = safeParseStreetPlanningJson(rawText);
  if (!parsed) {
    return null;
  }

  const parsedActionId =
    typeof parsed.actionId === "string" ? parsed.actionId.trim() : undefined;
  const parsedPlanKey =
    typeof parsed.planKey === "string" ? parsed.planKey.trim() : undefined;
  const allowedAction = parsedPlanKey
    ? input.allowedActions.find((action) => action.planKey === parsedPlanKey)
    : parsedActionId
      ? uniqueAllowedActionForActionId(input.allowedActions, parsedActionId)
      : undefined;

  if (!allowedAction) {
    return null;
  }

  if (parsedActionId && parsedActionId !== allowedAction.actionId) {
    return null;
  }

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(Math.max(parsed.confidence, 0), 1)
      : 0;
  const rationale = sanitizeOptionalNarrativeField(parsed.rationale) ?? "";

  return {
    actionId: allowedAction.actionId,
    confidence,
    planKey: allowedAction.planKey,
    rationale,
  };
}

function uniqueAllowedActionForActionId(
  allowedActions: StreetPlanningRequest["allowedActions"],
  actionId: string,
) {
  const matches = allowedActions.filter((action) => action.actionId === actionId);
  return matches.length === 1 ? matches[0] : undefined;
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

function safeParseStreetPlanningJson(rawText: string): {
  actionId?: string;
  confidence?: number;
  planKey?: string;
  rationale?: string;
} | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as {
      actionId?: string;
      confidence?: number;
      planKey?: string;
      rationale?: string;
    };
  } catch {
    return null;
  }
}

function sanitizeStreetSpeech(text: string) {
  return normalizeStreetVoice(text)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"+|"+$/g, "")
    .slice(0, 240);
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
