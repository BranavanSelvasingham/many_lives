import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENAI_TIMEOUT_MS,
  OPENAI_PLANNER_TOTAL_BUDGET_MS,
  OpenAIProvider,
} from "../src/ai/openaiProvider.js";
import type { StreetPlanningRequest } from "../src/ai/provider.js";
import {
  buildDeterministicStreetReply,
  generatedReplyLooksInvalid,
} from "../src/ai/streetDialogue.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";

describe("OpenAIProvider street fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps dialogue timeout separate from the bounded planner budget", () => {
    expect(DEFAULT_OPENAI_TIMEOUT_MS).toBe(25_000);
    expect(OPENAI_PLANNER_TOTAL_BUDGET_MS).toBe(6_000);
    expect(OPENAI_PLANNER_TOTAL_BUDGET_MS).toBeLessThan(
      DEFAULT_OPENAI_TIMEOUT_MS,
    );
  });

  it("falls back quickly when a live street reply times out", async () => {
    const game = seedStreetGame("game-openai-timeout");
    const input = {
      game,
      npcId: "npc-mara",
      playerText:
        "I'm Rowan. New here. Who might need an extra pair of hands before lunch gets busy?",
    };
    const deterministic = buildDeterministicStreetReply(input);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Request timed out", "AbortError"));
            });
          }),
      ),
    );

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      timeoutMs: 5,
    });
    const startedAt = Date.now();
    const result = await provider.generateStreetReply(input);

    expect(result).toEqual(deterministic);
    expect(provider.getCallLog()).toMatchObject([
      {
        status: "fallback",
        task: "generateStreetReply",
      },
    ]);
    expect(game.aiRuntime).toMatchObject({
      fallbackReasons: expect.arrayContaining([
        expect.stringMatching(/AbortError|timed out/i),
      ]),
      model: "gpt-5-nano",
      provider: "openai",
      status: "fallback",
      tasks: {
        generateStreetReply: {
          fallbacks: 1,
          lastStatus: "fallback",
        },
      },
      totalFallbacks: 1,
      totalSuccesses: 0,
    });
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it("rejects stagey or invented live dialogue details", () => {
    const game = seedStreetGame("game-openai-tone");

    expect(
      generatedReplyLooksInvalid(
        "Aye, grab the empty apron on the peg and fetch three tins from the prep shelf.",
        {
          game,
          npcId: "npc-ada",
          playerText:
            "I'm Rowan. I heard you might still need hands for lunch. Is there still room for me?",
        },
      ),
    ).toBe(true);
  });

  it("returns a constrained planner action when the model chooses an allowed action", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        output_text: JSON.stringify({
          actionId: "talk:npc-mara",
          confidence: 0.82,
          planKey: "plan:talk-mara",
          rationale: "Mara is here and can clarify the room before Rowan wanders.",
        }),
      }),
    );
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 50,
    });
    const planningRequest = buildPlanningRequest();
    const result = await provider.planStreetNextAction(planningRequest);

    expect(result).toEqual({
      actionId: "talk:npc-mara",
      confidence: 0.82,
      planKey: "plan:talk-mara",
      rationale: "Mara is here and can clarify the room before Rowan wanders.",
    });
    expect(provider.getCallLog()).toMatchObject([
      {
        model: "test-model",
        status: "success",
        task: "planStreetNextAction",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[url, init]] = fetchMock.mock.calls as unknown as Array<
      [string | URL | Request, RequestInit | undefined]
    >;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      reasoning: {
        effort: "minimal",
      },
    });
    expect(planningRequest.game.aiRuntime).toMatchObject({
      lastLiveCallAt: expect.any(String),
      model: "test-model",
      provider: "openai",
      status: "live",
      tasks: {
        planStreetNextAction: {
          lastStatus: "success",
          successes: 1,
        },
      },
      totalFallbacks: 0,
      totalSuccesses: 1,
    });
  });

  it("retries a transient 503 and records success when the retry passes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("temporary provider outage", {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          output_text: JSON.stringify({
            actionId: "talk:npc-mara",
            confidence: 0.83,
            planKey: "plan:talk-mara",
            rationale:
              "Mara is here and can clarify the room before Rowan wanders.",
          }),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
      retryDelayMs: 0,
      timeoutMs: 50,
    });
    const planningRequest = buildPlanningRequest();
    const result = await provider.planStreetNextAction(planningRequest);

    expect(result).toEqual({
      actionId: "talk:npc-mara",
      confidence: 0.83,
      planKey: "plan:talk-mara",
      rationale: "Mara is here and can clarify the room before Rowan wanders.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(provider.getCallLog()).toMatchObject([
      {
        status: "success",
        task: "planStreetNextAction",
      },
    ]);
    expect(planningRequest.game.aiRuntime).toMatchObject({
      fallbackReasons: [],
      status: "live",
      tasks: {
        planStreetNextAction: {
          fallbacks: 0,
          lastStatus: "success",
          successes: 1,
        },
      },
      totalFallbacks: 0,
      totalSuccesses: 1,
    });
  });

  it("does not retry non-transient OpenAI HTTP failures", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("bad request", {
        status: 400,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      retryDelayMs: 0,
      timeoutMs: 50,
    });
    const planningRequest = buildPlanningRequest();
    const result = await provider.planStreetNextAction(planningRequest);

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.getCallLog()).toMatchObject([
      {
        error: "OpenAIResponseError: OpenAI request failed with 400",
        status: "fallback",
        task: "planStreetNextAction",
      },
    ]);
    expect(planningRequest.game.aiRuntime).toMatchObject({
      fallbackReasons: ["OpenAIResponseError: OpenAI request failed with 400"],
      status: "fallback",
      tasks: {
        planStreetNextAction: {
          fallbacks: 1,
          lastFallbackReason:
            "OpenAIResponseError: OpenAI request failed with 400",
          lastStatus: "fallback",
        },
      },
      totalFallbacks: 1,
    });
  });

  it("aborts a stalled planner at the total budget and records one fallback", async () => {
    vi.useFakeTimers();
    const onCall = vi.fn();
    let lateResolve: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          lateResolve = resolve;
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Request aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      onCall,
      timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS,
    });
    const planningRequest = buildPlanningRequest();
    const startedAt = Date.now();
    const resultPromise = provider.planStreetNextAction(planningRequest);

    await vi.advanceTimersByTimeAsync(OPENAI_PLANNER_TOTAL_BUDGET_MS - 1);
    expect(provider.getCallLog()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(Date.now() - startedAt).toBe(OPENAI_PLANNER_TOTAL_BUDGET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
    expect(provider.getCallLog()).toEqual([
      {
        durationMs: OPENAI_PLANNER_TOTAL_BUDGET_MS,
        error:
          "OpenAIPlannerBudgetError: OpenAI planner exceeded its 6000ms total latency budget",
        gameId: planningRequest.game.id,
        model: "gpt-5-nano",
        status: "fallback",
        task: "planStreetNextAction",
      },
    ]);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(planningRequest.game.aiRuntime).toMatchObject({
      fallbackReasons: [
        "OpenAIPlannerBudgetError: OpenAI planner exceeded its 6000ms total latency budget",
      ],
      tasks: {
        planStreetNextAction: {
          fallbacks: 1,
          lastStatus: "fallback",
          successes: 0,
        },
      },
      totalFallbacks: 1,
      totalSuccesses: 0,
    });

    const runtimeAfterFallback = JSON.stringify(planningRequest.game.aiRuntime);
    lateResolve?.(
      plannerResponse({
        confidence: 0.99,
        rationale: "This completion arrived after the planner budget expired.",
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(provider.getCallLog()).toHaveLength(1);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(planningRequest.game.aiRuntime)).toBe(
      runtimeAfterFallback,
    );
  });

  it("bounds retry and aborts the second attempt when a 503 is followed by a stall", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    let lateResolve: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.signal) {
          signals.push(init.signal);
        }
        if (signals.length === 1) {
          return Promise.resolve(
            new Response("temporary provider outage", { status: 503 }),
          );
        }
        return new Promise<Response>((resolve, reject) => {
          lateResolve = resolve;
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Request aborted", "AbortError")),
            { once: true },
          );
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      retryCount: 2,
      retryDelayMs: 250,
      timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS,
    });
    const planningRequest = buildPlanningRequest();
    const startedAt = Date.now();
    const resultPromise = provider.planStreetNextAction(planningRequest);

    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(OPENAI_PLANNER_TOTAL_BUDGET_MS - 250);
    await expect(resultPromise).resolves.toBeNull();

    expect(Date.now() - startedAt).toBe(OPENAI_PLANNER_TOTAL_BUDGET_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(false);
    expect(signals[1]?.aborted).toBe(true);
    expect(provider.getCallLog()).toMatchObject([
      {
        durationMs: OPENAI_PLANNER_TOTAL_BUDGET_MS,
        error: expect.stringMatching(/total latency budget/),
        status: "fallback",
        task: "planStreetNextAction",
      },
    ]);
    expect(provider.getCallLog()).toHaveLength(1);
    expect(planningRequest.game.aiRuntime?.totalFallbacks).toBe(1);

    const runtimeAfterFallback = JSON.stringify(planningRequest.game.aiRuntime);
    lateResolve?.(plannerResponse());
    await Promise.resolve();
    await Promise.resolve();
    expect(provider.getCallLog()).toHaveLength(1);
    expect(JSON.stringify(planningRequest.game.aiRuntime)).toBe(
      runtimeAfterFallback,
    );
  });

  it("continues to use the longer request timeout for dialogue", async () => {
    vi.useFakeTimers();
    const game = seedStreetGame("game-openai-dialogue-budget-separation");
    const input = {
      game,
      npcId: "npc-mara",
      playerText: "What should I know before I head out?",
    };
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Request timed out", "AbortError")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      retryCount: 1,
      timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS,
    });
    const startedAt = Date.now();
    const resultPromise = provider.generateStreetReply(input);

    await vi.advanceTimersByTimeAsync(OPENAI_PLANNER_TOTAL_BUDGET_MS);
    expect(provider.getCallLog()).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(
      DEFAULT_OPENAI_TIMEOUT_MS - OPENAI_PLANNER_TOTAL_BUDGET_MS,
    );

    await expect(resultPromise).resolves.toEqual(
      buildDeterministicStreetReply(input),
    );
    expect(Date.now() - startedAt).toBe(DEFAULT_OPENAI_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.getCallLog()).toMatchObject([
      {
        status: "fallback",
        task: "generateStreetReply",
      },
    ]);
  });

  it("returns null when planner output is malformed or not allowed", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      timeoutMs: 50,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: "not json",
        }),
      ),
    );
    await expect(provider.planStreetNextAction(buildPlanningRequest())).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            actionId: "solve:problem-that-does-not-exist",
            confidence: 0.93,
            rationale: "Invent a shortcut.",
          }),
        }),
      ),
    );
    await expect(provider.planStreetNextAction(buildPlanningRequest())).resolves.toBeNull();
  });

  it("requires planKey when actionId is ambiguous", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      timeoutMs: 50,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            actionId: "exit:boarding-house",
            confidence: 0.93,
            rationale: "Leave the house, but without saying which plan this serves.",
          }),
        }),
      ),
    );
    await expect(
      provider.planStreetNextAction(buildAmbiguousPlanningRequest()),
    ).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            actionId: "exit:boarding-house",
            confidence: 0.94,
            planKey: "plan:exit-to-repair",
            rationale: "The pump pressure needs the repair-stall route.",
          }),
        }),
      ),
    );
    await expect(
      provider.planStreetNextAction(buildAmbiguousPlanningRequest()),
    ).resolves.toEqual({
      actionId: "exit:boarding-house",
      confidence: 0.94,
      planKey: "plan:exit-to-repair",
      rationale: "The pump pressure needs the repair-stall route.",
    });
  });

  it("records a skipped support-task call when live support tasks are disabled", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      timeoutMs: 50,
    });

    const game = seedStreetGame("game-openai-skipped");
    await provider.generateStreetThoughts(game);

    expect(provider.getCallLog()).toMatchObject([
      {
        status: "skipped",
        task: "generateStreetThoughts",
      },
    ]);
    expect(game.aiRuntime).toMatchObject({
      provider: "openai",
      status: "not_called",
      tasks: {
        generateStreetThoughts: {
          lastStatus: "skipped",
          skips: 1,
        },
      },
      totalSkips: 1,
    });
  });
});

function buildPlanningRequest(): StreetPlanningRequest {
  const game = seedStreetGame("game-openai-planner");
  return {
    allowedActions: [
      {
        actionId: "talk:npc-mara",
        description: "Ask Mara about the room.",
        kind: "talk",
        label: "Talk to Mara",
        npcId: "npc-mara",
        planKey: "plan:talk-mara",
        targetLocationId: "boarding-house",
      },
      {
        actionId: "move:tea-house",
        description: "Walk to Kettle & Lamp.",
        kind: "move",
        label: "Head to Kettle & Lamp",
        planKey: "plan:move-tea-house",
        targetLocationId: "tea-house",
      },
    ],
    desiredOutcomes: [
      {
        id: "shelter-stability",
        label: "Keep tonight's room and improve Rowan's standing.",
        priority: 9,
        status: "open",
      },
    ],
    game,
    objective: {
      focus: "settle",
      routeKey: "first-afternoon",
      text: "Make Rowan's first afternoon count.",
    },
  };
}

function buildAmbiguousPlanningRequest(): StreetPlanningRequest {
  const request = buildPlanningRequest();
  return {
    ...request,
    allowedActions: [
      {
        actionId: "exit:boarding-house",
        description: "Step outside before heading to Ada.",
        kind: "exit",
        label: "Exit Morrow House",
        planKey: "plan:exit-to-ada",
        targetLocationId: "tea-house",
      },
      {
        actionId: "exit:boarding-house",
        description: "Step outside before heading to Mercer Repairs.",
        kind: "exit",
        label: "Exit Morrow House",
        planKey: "plan:exit-to-repair",
        targetLocationId: "repair-stall",
      },
    ],
  };
}

function plannerResponse(
  overrides: Partial<{
    actionId: string;
    confidence: number;
    planKey: string;
    rationale: string;
  }> = {},
): Response {
  return Response.json({
    output_text: JSON.stringify({
      actionId: "talk:npc-mara",
      confidence: 0.84,
      planKey: "plan:talk-mara",
      rationale: "Mara can clarify the room before Rowan goes farther.",
      ...overrides,
    }),
  });
}
