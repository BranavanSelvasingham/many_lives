import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";

describe("Inbox command handling", () => {
  it("resolves an inbox item and records the player response", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-inbox");
    const message = world.inbox[0];

    expect(message).toBeDefined();

    const nextWorld = await engine.runCommand(world, {
      type: "resolve_inbox",
      messageId: message.id,
      actionId: "switch_vendor",
    });

    const resolvedMessage = nextWorld.inbox.find(
      (entry) => entry.id === message.id,
    );
    const responseEvent = nextWorld.events.find(
      (event) => event.type === "player_response",
    );

    expect(resolvedMessage?.resolvedAt).toBe(nextWorld.currentTime);
    expect(resolvedMessage?.requiresResponse).toBe(false);
    expect(responseEvent).toBeDefined();
  });

  it("snoozes a message without resolving it", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-snooze");
    const message = world.inbox[0];

    const nextWorld = await engine.runCommand(world, {
      type: "snooze_inbox",
      messageId: message.id,
      durationMinutes: 30,
    });

    const snoozedMessage = nextWorld.inbox.find(
      (entry) => entry.id === message.id,
    );

    expect(snoozedMessage?.resolvedAt).toBeUndefined();
    expect(snoozedMessage?.snoozedUntil).toBeTruthy();
  });
});
