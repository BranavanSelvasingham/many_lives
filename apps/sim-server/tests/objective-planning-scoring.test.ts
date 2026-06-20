import { describe, expect, it } from "vitest";

import type { StreetPlanningObjectiveOutcome } from "../src/ai/provider.js";
import { scorePlanForDesiredOutcomes } from "../src/sim/objectivePlanningScoring.js";
import { seedStreetGame } from "../src/street-sim/seedGame.js";

function outcome(
  id: string,
  priority: number,
  metadata: Partial<StreetPlanningObjectiveOutcome> = {},
): StreetPlanningObjectiveOutcome {
  return {
    id,
    label: id,
    priority,
    status: "open",
    ...metadata,
  };
}

describe("objective planning desired-outcome scoring", () => {
  it("scores active commitments for active work, resumes, and waits", () => {
    const world = seedStreetGame("game-active-commitment-scoring");
    world.player.activeJobId = "job-tea-shift";

    expect(
      scorePlanForDesiredOutcomes(
        world,
        {
          actionId: "work:job-tea-shift",
          targetLocationId: "tea-house",
        },
        [outcome("active-commitment", 7)],
      ),
    ).toBe(21);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        {
          actionId: "resume:job-tea-shift",
          targetLocationId: "tea-house",
        },
        [outcome("active-commitment", 7)],
      ),
    ).toBe(14);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { waitUntilMinutes: world.clock.totalMinutes + 30 },
        [outcome("active-commitment", 7)],
      ),
    ).toBe(7);
  });

  it("keeps job-window scoring aligned with targeted action metadata", () => {
    const world = seedStreetGame("game-job-window-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        {
          actionId: "accept:job-yard-shift",
          targetLocationId: "freight-yard",
        },
        [
          outcome("job-window-job-yard-shift", 12, {
            actionId: "accept:job-yard-shift",
            targetLocationId: "freight-yard",
          }),
        ],
      ),
    ).toBe(414);
  });

  it("scores income plans for live work and work-lead conversations", () => {
    const world = seedStreetGame("game-income-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { actionId: "work:job-tea-shift", targetLocationId: "tea-house" },
        [outcome("income", 10)],
      ),
    ).toBe(26);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-ada", targetLocationId: "tea-house" },
        [outcome("income", 10)],
      ),
    ).toBe(14);
  });

  it("scores shelter stability through Mara and Morrow House", () => {
    const world = seedStreetGame("game-shelter-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-mara", targetLocationId: "boarding-house" },
        [outcome("shelter-stability", 9)],
      ),
    ).toBeCloseTo(16.2);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        {
          actionId: "contribute:boarding-house",
          targetLocationId: "boarding-house",
        },
        [outcome("shelter-stability", 9)],
      ),
    ).toBeCloseTo(22.5);
  });

  it("scores social anchors by known versus new local conversations", () => {
    const world = seedStreetGame("game-social-anchor-scoring");

    world.npcs.find((npc) => npc.id === "npc-ada")!.known = false;
    world.npcs.find((npc) => npc.id === "npc-mara")!.known = true;

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-ada", targetLocationId: "tea-house" },
        [outcome("social-anchors", 5)],
      ),
    ).toBe(9);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-mara", targetLocationId: "boarding-house" },
        [outcome("social-anchors", 5)],
      ),
    ).toBe(6);
  });

  it("scores useful help through direct problem actions and local help leads", () => {
    const world = seedStreetGame("game-help-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { actionId: "solve:problem-pump", targetLocationId: "courtyard" },
        [outcome("useful-help", 9)],
      ),
    ).toBeCloseTo(37.8);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-nia", targetLocationId: "market-square" },
        [outcome("useful-help", 9)],
      ),
    ).toBeCloseTo(8.1);
  });

  it("scores tool readiness through Jo, the repair stall, and buying the wrench", () => {
    const world = seedStreetGame("game-tool-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { actionId: "buy:item-wrench", targetLocationId: "repair-stall" },
        [outcome("tool-ready", 8)],
      ),
    ).toBeCloseTo(22.4);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { npcId: "npc-jo", targetLocationId: "repair-stall" },
        [outcome("tool-ready", 8)],
      ),
    ).toBeCloseTo(10.4);
  });

  it("scores recovery at home and unexplored map knowledge", () => {
    const world = seedStreetGame("game-recover-map-scoring");

    expect(
      scorePlanForDesiredOutcomes(
        world,
        { actionId: "rest:home", targetLocationId: "boarding-house" },
        [outcome("recover", 10)],
      ),
    ).toBe(27);
    expect(
      scorePlanForDesiredOutcomes(
        world,
        { targetLocationId: "tea-house" },
        [outcome("map-knowledge", 8)],
      ),
    ).toBeCloseTo(13.6);
  });
});
