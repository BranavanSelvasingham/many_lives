import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../src/ai/openaiProvider.js";
import type { StreetPlanningRequest } from "../src/ai/provider.js";
import {
  buildDeterministicStreetReply,
  generatedReplyLooksInvalid,
} from "../src/ai/streetDialogue.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";

describe("OpenAIProvider street fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({
            actionId: "talk:npc-mara",
            confidence: 0.82,
            rationale: "Mara is here and can clarify the room before Rowan wanders.",
          }),
        }),
      ),
    );

    const provider = new OpenAIProvider({
      apiKey: "test-key",
      timeoutMs: 50,
    });
    const result = await provider.planStreetNextAction(buildPlanningRequest());

    expect(result).toEqual({
      actionId: "talk:npc-mara",
      confidence: 0.82,
      rationale: "Mara is here and can clarify the room before Rowan wanders.",
    });
  });

  it("returns null when the planner times out", async () => {
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
    const result = await provider.planStreetNextAction(buildPlanningRequest());

    expect(result).toBeNull();
    expect(Date.now() - startedAt).toBeLessThan(500);
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
        targetLocationId: "boarding-house",
      },
      {
        actionId: "move:tea-house",
        description: "Walk to Kettle & Lamp.",
        kind: "move",
        label: "Head to Kettle & Lamp",
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
