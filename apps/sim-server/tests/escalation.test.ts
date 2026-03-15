import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/character.js";
import type { EventRecord } from "../src/domain/event.js";
import type { Task } from "../src/domain/task.js";
import type { WorldState } from "../src/domain/world.js";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import { evaluateEscalation } from "../src/sim/resolvers/escalationResolver.js";
import { detectStressEvents } from "../src/sim/resolvers/taskResolver.js";
import { seedScenario } from "../src/sim/seedScenario.js";

describe("Escalation behavior", () => {
  it("turns a missed obligation into an inbox escalation", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("game-escalation");

    const nextWorld = await engine.tick(world, 20);

    const missedEvent = nextWorld.events.find(
      (event) =>
        event.type === "obligation_missed" && event.characterId === "jordan",
    );

    expect(missedEvent).toBeDefined();

    const message = nextWorld.inbox.find(
      (entry) => entry.eventId === missedEvent?.id,
    );

    expect(message).toBeDefined();
    expect(message?.characterId).toBe("jordan");
    expect(
      message?.priority === "high" || message?.priority === "critical",
    ).toBe(true);
  });

  it("changes escalation frequency when policy settings change", () => {
    const world = seedScenario("game-policy");
    const baseCharacter = world.characters.find(
      (character) => character.id === "maya",
    ) as Character;
    const baseTask = world.tasks.find(
      (task) => task.id === "task-maya-rent",
    ) as Task;
    const event = buildMissedEvent(baseCharacter, baseTask, world);

    const conservativeCharacter: Character = {
      ...baseCharacter,
      stress: 40,
      energy: 55,
      policies: {
        ...baseCharacter.policies,
        riskTolerance: 0.95,
        escalationThreshold: 6,
        reportingFrequency: "low",
      },
    };

    const attentiveCharacter: Character = {
      ...baseCharacter,
      stress: 74,
      energy: 20,
      policies: {
        ...baseCharacter.policies,
        riskTolerance: 0.1,
        escalationThreshold: 2,
        reportingFrequency: "high",
      },
    };

    const conservativeDecision = evaluateEscalation({
      world,
      character: conservativeCharacter,
      event,
      task: baseTask,
    });

    const attentiveDecision = evaluateEscalation({
      world,
      character: attentiveCharacter,
      event,
      task: baseTask,
    });

    expect(conservativeDecision.shouldEscalate).toBe(false);
    expect(attentiveDecision.shouldEscalate).toBe(true);
    expect(attentiveDecision.score).toBeGreaterThan(conservativeDecision.score);
  });

  it("does not repeat stress alerts every tick without recovery", () => {
    const world = seedScenario("game-stress");
    const character = world.characters.find(
      (entry) => entry.id === "leo",
    ) as Character;

    character.stress = 84;
    world.tickCount = 1;
    const firstAlerts = detectStressEvents(world, world.currentTime);

    world.tickCount = 2;
    character.stress = 88;
    const repeatedAlerts = detectStressEvents(world, world.currentTime);

    world.tickCount = 3;
    character.stress = 65;
    detectStressEvents(world, world.currentTime);

    world.tickCount = 4;
    character.stress = 82;
    const recoveredAlerts = detectStressEvents(world, world.currentTime);

    expect(firstAlerts).toHaveLength(1);
    expect(repeatedAlerts).toHaveLength(0);
    expect(recoveredAlerts).toHaveLength(1);
  });
});

function buildMissedEvent(
  character: Character,
  task: Task,
  world: WorldState,
): EventRecord {
  return {
    id: "event-test",
    characterId: character.id,
    type: "obligation_missed",
    priority: "critical",
    title: `${character.name} missed ${task.title}`,
    description: `${task.title} slipped in ${world.scenarioName}.`,
    createdAt: world.currentTime,
    relatedTaskId: task.id,
  };
}
