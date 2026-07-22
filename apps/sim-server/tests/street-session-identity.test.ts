import { describe, expect, it } from "vitest";
import { shouldSkipUrlCleanupGameReload } from "../../many-lives-web/src/lib/street/sessionIdentity.js";

describe("street session identity", () => {
  it("skips the URL cleanup reload for the game that is already active", () => {
    expect(
      shouldSkipUrlCleanupGameReload({
        activeGameId: "game-fresh",
        cleanupGameId: "game-fresh",
        explicitGameRequest: false,
        requestedGameId: "game-fresh",
      }),
    ).toBe(true);
    expect(
      shouldSkipUrlCleanupGameReload({
        activeGameId: "game-fresh",
        cleanupGameId: "game-fresh",
        explicitGameRequest: false,
        requestedGameId: null,
      }),
    ).toBe(true);
  });

  it("keeps explicit, different, and not-yet-loaded game requests", () => {
    expect(
      shouldSkipUrlCleanupGameReload({
        activeGameId: "game-fresh",
        cleanupGameId: "game-fresh",
        explicitGameRequest: true,
        requestedGameId: "game-fresh",
      }),
    ).toBe(false);
    expect(
      shouldSkipUrlCleanupGameReload({
        activeGameId: "game-fresh",
        cleanupGameId: "game-fresh",
        explicitGameRequest: false,
        requestedGameId: "game-saved",
      }),
    ).toBe(false);
    expect(
      shouldSkipUrlCleanupGameReload({
        activeGameId: null,
        cleanupGameId: "game-fresh",
        explicitGameRequest: false,
        requestedGameId: "game-fresh",
      }),
    ).toBe(false);
  });
});
