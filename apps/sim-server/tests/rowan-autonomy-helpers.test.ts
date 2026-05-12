import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import {
  buildCommandRailPreserveScrollKey,
  buildResolvedConversationAutoContinueKey,
  buildObjectiveAutoContinueKey,
  estimateConversationPlaybackMs,
  resolveConversationAutostartPlan,
  resolvePendingConversationTarget,
  resolveRowanRailNpcSelection,
} from "../../many-lives-web/src/lib/street/rowanAutonomy.js";

describe("Rowan autonomy helper seams", () => {
  it("keeps pending conversation state aligned with the current source", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-pending-conversation-source");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    expect(
      resolvePendingConversationTarget({
        autonomyNpcId: world.rowanAutonomy.npcId ?? null,
        npcIds: world.npcs.map((npc) => npc.id),
        pendingNpcId: null,
        pendingSource: null,
        selectedNpcId: "npc-mara",
      }),
    ).toEqual({
      npcId: "npc-mara",
      source: "autonomy",
    });

    expect(
      resolvePendingConversationTarget({
        autonomyNpcId: null,
        npcIds: world.npcs.map((npc) => npc.id),
        pendingNpcId: "npc-mara",
        pendingSource: "autonomy",
        selectedNpcId: "npc-mara",
      }),
    ).toEqual({
      npcId: null,
      source: null,
    });

    expect(
      resolvePendingConversationTarget({
        autonomyNpcId: null,
        npcIds: world.npcs.map((npc) => npc.id),
        pendingNpcId: "npc-mara",
        pendingSource: "selection",
        selectedNpcId: "npc-mara",
      }),
    ).toEqual({
      npcId: "npc-mara",
      source: "selection",
    });
  });

  it("builds conversation autostart plans only for fresh, actionable beats", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-conversation-autostart-plan");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    expect(buildObjectiveAutoContinueKey(world)).toBe(
      `${world.id}:${world.rowanAutonomy.key}`,
    );

    expect(
      resolveConversationAutostartPlan({
        game: world,
        pendingNpcId: "npc-mara",
        pendingSource: "autonomy",
        selectedNpcId: "npc-mara",
      }),
    ).toMatchObject({
      autoStartKey: `${world.id}:${world.player.currentLocationId}:npc-mara:${world.rowanAutonomy.key}`,
      npcId: "npc-mara",
      source: "autonomy",
      talkActionId: "talk:npc-mara",
    });

    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });

    expect(
      resolveConversationAutostartPlan({
        game: world,
        pendingNpcId: "npc-mara",
        pendingSource: "selection",
        selectedNpcId: "npc-mara",
      }),
    ).toBeNull();
  });

  it("falls back safely when the client snapshot is missing rowan autonomy", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-conversation-autostart-fallback");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    const staleWorld = {
      ...world,
      rowanAutonomy: undefined,
    } as unknown as typeof world;

    expect(
      resolveConversationAutostartPlan({
        game: staleWorld,
        pendingNpcId: "npc-mara",
        pendingSource: "autonomy",
        selectedNpcId: "npc-mara",
      }),
    ).toMatchObject({
      autoStartKey: `${world.id}:${world.player.currentLocationId}:npc-mara:idle:fallback`,
      npcId: "npc-mara",
      source: "autonomy",
      talkActionId: "talk:npc-mara",
    });
  });

  it("retargets the rail to Rowan's live autonomy beat instead of a stale thread", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-rowan-rail-selection");

    world = await engine.runCommand(world, {
      type: "set_objective",
      text: "Talk to Mara about staying at Morrow House.",
    });

    expect(
      resolveRowanRailNpcSelection({
        game: world,
        selectedNpcId: "npc-ada",
      }),
    ).toBe("npc-mara");

    const selfDirectedWorld: typeof world = {
      ...world,
      rowanAutonomy: {
        ...world.rowanAutonomy,
        autoContinue: true,
        key: "plan:self-directed",
        label: "Head to Quay Square",
        mode: "moving",
        npcId: undefined,
      },
    };

    expect(
      resolveRowanRailNpcSelection({
        game: selfDirectedWorld,
        selectedNpcId: "npc-mara",
      }),
    ).toBe("npc-mara");
    expect(
      resolveRowanRailNpcSelection({
        game: selfDirectedWorld,
        preserveSelectedNpc: true,
        selectedNpcId: "npc-mara",
      }),
    ).toBe("npc-mara");
  });

  it("pins the most relevant finished thread when Rowan has moved on but the conversation still matters", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-rowan-rail-finished-thread");

    for (let index = 0; index < 16; index += 1) {
      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
      const teaShift = world.jobs.find((job) => job.id === "job-tea-shift");
      if (
        teaShift?.completed &&
        world.player.currentLocationId === "boarding-house" &&
        world.firstAfternoon?.completedAt
      ) {
        break;
      }
    }

    expect(world.player.currentLocationId).toBe("boarding-house");
    expect(world.rowanAutonomy.npcId).toBeUndefined();
    expect(resolveRowanRailNpcSelection({ game: world, selectedNpcId: null })).toBe(
      "npc-mara",
    );
  });

  it("keys conversation carry-forward and scroll identity off the current thread", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("game-rowan-rail-thread-keys");

    world = await engine.runCommand(world, {
      type: "speak",
      npcId: "npc-mara",
      text: "I need to keep my room here, and I need work today. Who should I ask?",
    });

    expect(buildResolvedConversationAutoContinueKey(world)).toContain(
      "conversation-thread-npc-mara",
    );
    expect(
      buildCommandRailPreserveScrollKey({
        game: world,
        selectedNpcId: "npc-mara",
      }),
    ).toContain("npc-mara");
  });

  it("accounts for the human-readable conversation playback before Rowan moves on", () => {
    expect(
      estimateConversationPlaybackMs(
        [
          {
            id: "a",
            npcId: "npc-mara",
            speaker: "player",
            speakerName: "Rowan",
            text: "Need room",
            time: "2026-03-21T11:00:00.000Z",
            threadId: "conversation-thread-npc-mara",
          },
          {
            id: "b",
            npcId: "npc-mara",
            speaker: "npc",
            speakerName: "Mara",
            text: "Earn it",
            time: "2026-03-21T11:00:00.000Z",
            threadId: "conversation-thread-npc-mara",
          },
          {
            id: "c",
            npcId: "npc-mara",
            speaker: "npc",
            speakerName: "Mara",
            text: "Show up steady",
            time: "2026-03-21T11:00:00.000Z",
            threadId: "conversation-thread-npc-mara",
          },
        ],
        {
          entrySettle: 90,
          firstEntryPause: 180,
          initialDelay: 80,
          npcWord: 26,
          playerWord: 22,
          sameSpeakerPause: 120,
          turnChangePause: 360,
        },
      ),
    ).toBe(1164);
  });
});
