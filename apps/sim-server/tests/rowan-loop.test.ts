import { describe, expect, it } from "vitest";
import {
  ROWAN_LOOP_LAYER_ORDER,
  executeRowanLoopStep,
  resolveRowanLoopStep,
  rowanAutonomyFromLoopStep,
  type RowanLoopStep,
} from "../src/sim/rowanLoop.js";
import type { StreetGameState } from "../src/street-sim/types.js";

function step(overrides: Partial<RowanLoopStep> = {}): RowanLoopStep {
  return {
    autoContinue: true,
    detail: "Rowan can carry this beat.",
    key: "test-step",
    kind: "move",
    label: "Move somewhere useful",
    layer: "objective",
    targetLocationId: "tea-house",
    ...overrides,
  };
}

describe("Rowan loop primitives", () => {
  it("keeps the layer order explicit", () => {
    expect(ROWAN_LOOP_LAYER_ORDER).toEqual([
      "conversation",
      "pendingMove",
      "commitment",
      "objective",
    ]);
  });

  it("prioritizes live conversations before movement, commitments, and objectives", () => {
    const world = {} as StreetGameState;

    expect(
      resolveRowanLoopStep(world, {
        conversation: () => step({ key: "conversation", layer: "conversation" }),
        pendingMove: () => step({ key: "pending" }),
        commitment: () => step({ key: "commitment", layer: "commitment" }),
        objective: () => step({ key: "objective" }),
      }),
    ).toMatchObject({
      key: "conversation",
      layer: "conversation",
    });
  });

  it("falls through to the objective resolver when earlier layers have no work", () => {
    const world = {} as StreetGameState;

    expect(
      resolveRowanLoopStep(world, {
        conversation: () => undefined,
        pendingMove: () => undefined,
        commitment: () => undefined,
        objective: () => step({ key: "objective" }),
      }),
    ).toMatchObject({
      key: "objective",
      layer: "objective",
    });
  });

  it("projects loop steps into the UI-facing autonomy state in one place", () => {
    expect(
      rowanAutonomyFromLoopStep(
        step({
          actionId: "work:job-tea-shift",
          effects: ["thought"],
          key: "job-start:job-tea-shift",
          kind: "wait",
          label: "Hold for Cup-and-counter shift",
          layer: "commitment",
          targetLocationId: "tea-house",
        }),
      ),
    ).toMatchObject({
      actionId: "work:job-tea-shift",
      effects: ["thought"],
      key: "job-start:job-tea-shift",
      label: "Hold for Cup-and-counter shift",
      layer: "commitment",
      mode: "waiting",
      stepKind: "wait",
      targetLocationId: "tea-house",
    });
  });

  it("dispatches conversation talk separately from objective talk", () => {
    const calls: string[] = [];
    const handlers = {
      action: () => calls.push("action"),
      blocked: () => calls.push("blocked"),
      continueConversation: () => calls.push("continue"),
      idle: () => calls.push("idle"),
      move: () => calls.push("move"),
      observe: () => calls.push("observe"),
      openConversation: () => calls.push("open"),
      reflect: () => calls.push("reflect"),
    };

    executeRowanLoopStep(
      step({ kind: "talk", layer: "conversation" }),
      handlers,
    );
    executeRowanLoopStep(step({ kind: "talk", layer: "objective" }), handlers);

    expect(calls).toEqual(["continue", "open"]);
  });
});
