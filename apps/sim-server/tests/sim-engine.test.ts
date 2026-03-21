import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { addMinutes } from "../src/sim/worldState.js";

describe("SimulationEngine ticking", () => {
  it("seeds derived commitments from relationships and world state", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-derived");

    expect(world.tasks.some((task) => task.dynamic)).toBe(true);
    expect(
      world.tasks.some((task) => task.sourceRelationshipId != null),
    ).toBe(true);
  });

  it("advances time by 30 minutes per tick", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-test");

    const nextWorld = await engine.tick(world, 1);

    expect(nextWorld.currentTime).toBe(addMinutes(world.currentTime, 30));
    expect(nextWorld.tickCount).toBe(1);
  });

  it("advances four ticks for a two hour jump", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-test");

    const nextWorld = await engine.tick(world, 4);

    expect(nextWorld.currentTime).toBe(addMinutes(world.currentTime, 120));
    expect(nextWorld.tickCount).toBe(4);
  });

  it("allows travel-heavy tasks to depart early enough to finish on time", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-travel");

    const nextWorld = await engine.tick(world, 4);
    const windowTask = nextWorld.tasks.find(
      (task) => task.id === "task-ren-velvet-window",
    );
    const missedWindow = nextWorld.events.find(
      (event) =>
        event.type === "obligation_missed" &&
        event.relatedTaskId === "task-ren-velvet-window",
    );

    expect(windowTask?.status).toBe("completed");
    expect(missedWindow).toBeUndefined();
  });

  it("keeps routine task progress out of the inbox", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-quiet-inbox");

    const nextWorld = await engine.tick(world, 4);

    const taskCompletedEventIds = new Set(
      nextWorld.events
        .filter((event) => event.type === "task_completed")
        .map((event) => event.id),
    );

    const progressMessages = nextWorld.inbox.filter((message) =>
      taskCompletedEventIds.has(message.eventId),
    );

    expect(progressMessages).toHaveLength(1);
    expect(progressMessages[0]?.characterId).toBe("sia");
  });

  it("records memory and attention outputs as the city advances", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-memory");

    const nextWorld = await engine.tick(world, 3);
    const ivoMemoryBefore =
      world.memories.find((memory) => memory.characterId === "ivo")?.episodes
        .length ?? 0;
    const ivoMemoryAfter =
      nextWorld.memories.find((memory) => memory.characterId === "ivo")
        ?.episodes.length ?? 0;

    expect(ivoMemoryAfter).toBeGreaterThan(ivoMemoryBefore);
    expect(nextWorld.attentionLog.length).toBeGreaterThan(
      world.attentionLog.length,
    );
  });
});
