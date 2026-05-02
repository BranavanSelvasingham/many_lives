import { describe, expect, it } from "vitest";
import {
  alignRowanPlaybackWithGame,
  appendRowanPlaybackBeats,
  buildRowanRailViewModel,
  completeActiveRowanPlaybackBeat,
  createEmptyRowanPlaybackState,
  deriveRowanPlaybackBeats,
  isBlockingRowanPlayback,
  startNextRowanPlaybackBeat,
  type RowanPlaybackBeat,
} from "../../many-lives-web/src/lib/street/rowanPlayback.js";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import type { StreetGameState } from "../src/street-sim/types.js";

function asWebGame(world: StreetGameState) {
  return world as unknown as import("../../many-lives-web/src/lib/street/types.js").StreetGameState;
}

describe("Rowan playback helpers", () => {
  it("derives move and arrival beats from a real location change", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-move");
    const moved = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });

    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(moved));

    expect(beats.map((beat) => beat.kind)).toEqual(
      expect.arrayContaining(["move", "arrive"]),
    );
    expect(beats[0]?.durationMs).toBeGreaterThanOrEqual(650);
  });

  it("labels movement from the actual destination instead of stale autonomy", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-move-target");
    const moved = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    const movedWithNextTarget = structuredClone(moved);
    movedWithNextTarget.rowanAutonomy = {
      ...movedWithNextTarget.rowanAutonomy,
      targetLocationId: "boarding-house",
    };

    const beats = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(movedWithNextTarget),
    );
    const moveBeat = beats.find((beat) => beat.kind === "move");

    expect(moveBeat?.title).toBe("Walking to Kettle & Lamp");
  });

  it("derives thread open and landed beats from Rowan-led conversation flow", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-thread");
    const liveConversation = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    const landed = await engine.runCommand(liveConversation, {
      type: "advance_objective",
      allowTimeSkip: false,
    });

    const openBeats = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(liveConversation),
    );
    const landedBeats = deriveRowanPlaybackBeats(
      asWebGame(liveConversation),
      asWebGame(landed),
    );

    expect(openBeats.map((beat) => beat.kind)).toContain("thread_open");
    expect(landedBeats.map((beat) => beat.kind)).toContain("thread_landed");
  });

  it("derives shift booking and completion beats from Ada's work loop", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-shift");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-ada",
    });

    const accepted = await engine.runCommand(world, {
      type: "act",
      actionId: "accept:job-tea-shift",
    });

    let readyToWork = accepted;
    while (readyToWork.clock.hour + readyToWork.clock.minute / 60 < 12) {
      readyToWork = await engine.tick(readyToWork, 1);
    }

    const completed = await engine.runCommand(readyToWork, {
      type: "act",
      actionId: "work:job-tea-shift",
    });

    const acceptedBeats = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(accepted),
    );
    const completedBeats = deriveRowanPlaybackBeats(
      asWebGame(readyToWork),
      asWebGame(completed),
    );

    expect(acceptedBeats.map((beat) => beat.kind)).toContain("action_start");
    expect(completedBeats.map((beat) => beat.kind)).toContain(
      "action_complete",
    );
  });

  it("keeps autoplay blocked until the queued beats are fully consumed", () => {
    const moveBeat: RowanPlaybackBeat = {
      blocking: true,
      detail: "Rowan is crossing the block.",
      durationMs: 650,
      key: "move:test",
      kind: "move",
      title: "Walking to Kettle & Lamp",
      tone: "objective",
    };
    const landedBeat: RowanPlaybackBeat = {
      blocking: true,
      detail: "Mara points Rowan toward Ada.",
      durationMs: 900,
      key: "thread-landed:test",
      kind: "thread_landed",
      title: "Thread landed with Mara",
      tone: "conversation",
    };

    let playback = appendRowanPlaybackBeats(createEmptyRowanPlaybackState(), [
      moveBeat,
      landedBeat,
    ]);
    expect(isBlockingRowanPlayback(playback)).toBe(true);

    playback = startNextRowanPlaybackBeat(playback);
    expect(playback.activeBeat?.kind).toBe("move");

    playback = completeActiveRowanPlaybackBeat(playback);
    expect(playback.lastCompletedBeat).toBeUndefined();
    expect(isBlockingRowanPlayback(playback)).toBe(true);

    playback = startNextRowanPlaybackBeat(playback);
    playback = completeActiveRowanPlaybackBeat(playback);

    expect(playback.lastCompletedBeat?.title).toBe("Thread landed with Mara");
    expect(isBlockingRowanPlayback(playback)).toBe(false);
  });

  it("drops playback beats that no longer match Rowan's current location", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-stale-location");
    const staleArrival: RowanPlaybackBeat = {
      blocking: true,
      detail: "Rowan reached Kettle & Lamp.",
      durationMs: 420,
      key: "arrive:stale-tea-house",
      kind: "arrive",
      locationId: "tea-house",
      title: "Arrived at Kettle & Lamp",
      tone: "info",
    };
    const playback = completeActiveRowanPlaybackBeat({
      activeBeat: staleArrival,
      queuedBeats: [staleArrival],
    });

    const aligned = alignRowanPlaybackWithGame(playback, asWebGame(world));
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is catching his breath.",
      game: asWebGame(world),
      playback,
      quietStatusLabel: world.currentScene.title,
    });

    expect(aligned.activeBeat).toBeUndefined();
    expect(aligned.queuedBeats).toHaveLength(0);
    expect(aligned.lastCompletedBeat).toBeUndefined();
    expect(railView.justHappened).toBeNull();
    expect(railView.now.title).not.toBe("Arrived at Kettle & Lamp");
  });

  it("builds a stripped rail model around now, next, and just happened", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-rail");
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is reading the district.",
      game: asWebGame(world),
      playback: createEmptyRowanPlaybackState(),
      quietStatusLabel: world.currentScene.title,
    });

    expect(railView.now.title).toBe(world.rowanAutonomy.label);
    expect(railView.next?.title).toBe("Lock in my stay at Morrow House.");

    const liveConversation = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    const liveRailView = buildRowanRailViewModel({
      conversationReplayActive: true,
      fallbackThought: "Rowan is reading Mara.",
      game: asWebGame(liveConversation),
      playback: createEmptyRowanPlaybackState(),
      quietStatusLabel: liveConversation.currentScene.title,
    });

    expect(liveRailView.useConversationTranscript).toBe(true);
    expect(liveRailView.statusLabel).toBe("Live conversation");
    expect(liveRailView.shouldAutoOpen).toBe(true);
  });

  it("drops the stale route headline once Rowan is already home and resting", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-home-rest");

    for (let step = 0; step < 12; step += 1) {
      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
      if (
        world.player.currentLocationId === "boarding-house" &&
        world.rowanAutonomy.actionId === "rest:home"
      ) {
        break;
      }
    }

    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is catching his breath.",
      game: asWebGame(world),
      playback: createEmptyRowanPlaybackState(),
      quietStatusLabel: world.currentScene.title,
    });

    expect(railView.now.title).toBe("Rest for an hour");
    expect(railView.next).toBeNull();
  });
});
