import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

describe("HTTP routes", () => {
  const app = buildServer();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports health", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      aiProvider: "mock",
    });
  });

  it("creates, reads, ticks, and commands a game", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/game/new",
      payload: {},
    });

    expect(createResponse.statusCode).toBe(200);
    const createdGame = createResponse.json().game;
    expect(createdGame.inbox.length).toBeGreaterThan(0);

    const stateResponse = await app.inject({
      method: "GET",
      url: `/game/${createdGame.id}/state`,
    });

    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().game.id).toBe(createdGame.id);

    const tickResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/tick`,
      payload: { minutes: 600 },
    });

    expect(tickResponse.statusCode).toBe(200);
    const tickedGame = tickResponse.json().game;
    expect(tickedGame.tickCount).toBe(20);

    const firstOpenMessage = tickedGame.inbox.find(
      (message: { resolvedAt?: string | null }) => message.resolvedAt == null,
    );

    if (!firstOpenMessage) {
      throw new Error(
        "Expected at least one inbox message after ticking the sim.",
      );
    }

    const commandResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/command`,
      payload: {
        type: "resolve_inbox",
        messageId: firstOpenMessage.id,
      },
    });

    expect(commandResponse.statusCode).toBe(200);
    const resolvedGame = commandResponse.json().game;
    const resolvedMessage = resolvedGame.inbox.find(
      (message: { id: string }) => message.id === firstOpenMessage.id,
    );

    expect(resolvedMessage?.resolvedAt).toBeTruthy();

    const policyResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/policy`,
      payload: {
        characterId: "jordan",
        policy: {
          spendingLimit: 50,
        },
      },
    });

    expect(policyResponse.statusCode).toBe(200);
    expect(
      policyResponse
        .json()
        .game.characters.find(
          (character: { id: string }) => character.id === "jordan",
        )?.policies.spendingLimit,
    ).toBe(50);
  });
});
