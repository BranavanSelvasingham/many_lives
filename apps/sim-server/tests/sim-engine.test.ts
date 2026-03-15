import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { addMinutes } from "../src/sim/worldState.js";

describe("SimulationEngine ticking", () => {
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
    const standupTask = nextWorld.tasks.find(
      (task) => task.id === "task-jordan-standup",
    );
    const missedStandup = nextWorld.events.find(
      (event) =>
        event.type === "obligation_missed" &&
        event.relatedTaskId === "task-jordan-standup",
    );

    expect(standupTask?.status).toBe("completed");
    expect(missedStandup).toBeUndefined();
  });

  it("keeps routine task progress out of the inbox", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-quiet-inbox");
    const initialInboxCount = world.inbox.length;

    const nextWorld = await engine.tick(world, 4);

    expect(nextWorld.inbox).toHaveLength(initialInboxCount);
  });
});
