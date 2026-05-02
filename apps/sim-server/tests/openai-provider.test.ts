import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../src/ai/openaiProvider.js";
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
});
