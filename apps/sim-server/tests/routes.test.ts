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

  it("creates, reads, ticks, and acts in the street slice", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/game/new",
      payload: {},
    });

    expect(createResponse.statusCode).toBe(200);
    const createdGame = createResponse.json().game;
    expect(createdGame.player.name).toBe("Rowan");
    expect(createdGame.locations.length).toBeGreaterThan(4);

    const stateResponse = await app.inject({
      method: "GET",
      url: `/game/${createdGame.id}/state`,
    });

    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().game.id).toBe(createdGame.id);

    const tickResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/tick`,
      payload: { minutes: 60 },
    });

    expect(tickResponse.statusCode).toBe(200);
    expect(tickResponse.json().game.clock.totalMinutes).toBe(
      createdGame.clock.totalMinutes + 60,
    );

    const moveResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/command`,
      payload: {
        type: "move_to",
        x: 12,
        y: 5,
      },
    });

    expect(moveResponse.statusCode).toBe(200);
    expect(moveResponse.json().game.player.currentLocationId).toBe("tea-house");

    const talkResponse = await app.inject({
      method: "POST",
      url: `/game/${createdGame.id}/command`,
      payload: {
        type: "act",
        actionId: "talk:npc-ada",
      },
    });

    expect(talkResponse.statusCode).toBe(200);
    expect(
      talkResponse
        .json()
        .game.jobs.find((job: { id: string }) => job.id === "job-tea-shift")
        ?.discovered,
    ).toBe(true);
  });
});
