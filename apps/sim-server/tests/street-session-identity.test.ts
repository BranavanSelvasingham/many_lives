import { describe, expect, it } from "vitest";
import {
  shouldReplaceMissingFreshGame,
  shouldSkipUrlCleanupGameReload,
} from "../../many-lives-web/src/lib/street/sessionIdentity.js";

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

  it("replaces a confirmed missing active fresh game at most once", () => {
    expect(
      shouldReplaceMissingFreshGame({
        activeGameId: "game-fresh",
        confirmedMissingGameId: "game-fresh",
        failedGameId: "game-fresh",
        identity: {
          gameId: "game-fresh",
          replacementAttempted: false,
          source: "fresh",
        },
      }),
    ).toBe(true);
    expect(
      shouldReplaceMissingFreshGame({
        activeGameId: "game-fresh",
        confirmedMissingGameId: "game-fresh",
        failedGameId: "game-fresh",
        identity: {
          gameId: "game-fresh",
          replacementAttempted: true,
          source: "fresh",
        },
      }),
    ).toBe(false);
  });

  it("never replaces explicit, stored, stale, or mismatched identities", () => {
    for (const source of ["explicit", "stored"] as const) {
      expect(
        shouldReplaceMissingFreshGame({
          activeGameId: "game-bound",
          confirmedMissingGameId: "game-bound",
          failedGameId: "game-bound",
          identity: {
            gameId: "game-bound",
            replacementAttempted: false,
            source,
          },
        }),
      ).toBe(false);
    }

    expect(
      shouldReplaceMissingFreshGame({
        activeGameId: "game-newer",
        confirmedMissingGameId: "game-fresh",
        failedGameId: "game-fresh",
        identity: {
          gameId: "game-fresh",
          replacementAttempted: false,
          source: "fresh",
        },
      }),
    ).toBe(false);
    expect(
      shouldReplaceMissingFreshGame({
        activeGameId: "game-fresh",
        confirmedMissingGameId: "game-fresh",
        failedGameId: "game-fresh",
        identity: null,
      }),
    ).toBe(false);
    expect(
      shouldReplaceMissingFreshGame({
        activeGameId: "game-fresh",
        confirmedMissingGameId: null,
        failedGameId: "game-fresh",
        identity: {
          gameId: "game-fresh",
          replacementAttempted: false,
          source: "fresh",
        },
      }),
    ).toBe(false);
  });
});
