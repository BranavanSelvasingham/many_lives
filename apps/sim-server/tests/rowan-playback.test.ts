import { describe, expect, it } from "vitest";
import {
  alignRowanPlaybackWithGame,
  appendRowanPlaybackBeats,
  buildRowanRailViewModel,
  completeActiveRowanPlaybackBeat,
  createEmptyRowanPlaybackState,
  deriveRowanPlaybackBeats,
  isBlockingRowanPlayback,
  isBlockingRowanPlaybackForGame,
  startNextRowanPlaybackBeat,
  type RowanPlaybackBeat,
} from "../../many-lives-web/src/lib/street/rowanPlayback.js";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";
import { enterMorrowHouse, enterTeaHouse } from "./street-test-helpers.js";

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

  it("labels portal transitions as entering interiors instead of walking", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-enter-interior");
    const entered = await enterMorrowHouse(engine, world);

    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(entered));

    expect(beats.map((beat) => beat.kind)).not.toContain("move");
    expect(beats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "arrive",
          title: "Entered Morrow House",
        }),
      ]),
    );
  });

  it("derives thread open and landed beats from Rowan-led conversation flow", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-thread");
    world = await enterMorrowHouse(engine, world);
    const insideMorrow = await enterMorrowHouse(engine, world);
    const liveConversation = await engine.runCommand(insideMorrow, {
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
    world = await enterTeaHouse(engine, world);
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

    const started = await engine.runCommand(readyToWork, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    const counter = await engine.runCommand(started, {
      type: "act",
      actionId: "work:job-tea-shift",
    });
    const completed = await engine.runCommand(counter, {
      type: "act",
      actionId: "work:job-tea-shift",
    });

    const acceptedBeats = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(accepted),
    );
    const completedBeats = deriveRowanPlaybackBeats(
      asWebGame(counter),
      asWebGame(completed),
    );
    const startedBeats = deriveRowanPlaybackBeats(
      asWebGame(readyToWork),
      asWebGame(started),
    );

    expect(acceptedBeats.map((beat) => beat.kind)).toContain("action_start");
    expect(started.firstAfternoon?.teaShiftStage).toBe("rush");
    expect(startedBeats.map((beat) => beat.title)).toContain(
      "Lunch rush started",
    );
    expect(counter.firstAfternoon?.teaShiftStage).toBe("counter");
    expect(completedBeats.map((beat) => beat.kind)).toContain(
      "action_complete",
    );
  });

  it("surfaces an independent NPC resolution as a rail-visible city beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-city-beat");

    world = await engine.runCommand(world, {
      type: "move_to",
      x: 10,
      y: 7,
    });
    world = await engine.tick(world, 3);
    const activeCart = world.problems.find(
      (problem) => problem.id === "problem-cart",
    );
    if (activeCart) {
      activeCart.discovered = true;
    }
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "inspect:problem-cart",
    });

    const resolved = await engine.tick(world, 9);
    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(resolved));
    const cityBeat = beats.find((beat) => beat.kind === "city_beat");
    expect(cityBeat).toBeTruthy();

    expect(cityBeat).toMatchObject({
      detail: expect.stringContaining(
        "Nia cleared the jammed handcart before Quay Square spent the afternoon bent around it.",
      ),
      kind: "city_beat",
      title: "Nia cleared the square",
    });

    const playback = completeActiveRowanPlaybackBeat({
      activeBeat: cityBeat!,
      queuedBeats: [],
    });
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is watching the block move around him.",
      game: asWebGame(resolved),
      playback,
      quietStatusLabel: resolved.currentScene.title,
      watchMode: true,
    });

    expect(railView.justHappened).toMatchObject({
      detail: expect.stringContaining("Nia cleared the jammed handcart"),
      title: "Nia cleared the square",
      tone: "info",
    });
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

  it("does not let stale playback block the live simulation loop", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-stale-blocker");
    const staleMove: RowanPlaybackBeat = {
      blocking: true,
      detail: "Rowan was once crossing toward Kettle & Lamp.",
      durationMs: 4800,
      key: "move:stale-tea-house",
      kind: "move",
      locationId: "tea-house",
      title: "Walking to Kettle & Lamp",
      tone: "objective",
    };
    const playback = {
      activeBeat: staleMove,
      queuedBeats: [staleMove],
    };

    expect(isBlockingRowanPlayback(playback)).toBe(true);
    expect(isBlockingRowanPlaybackForGame(playback, asWebGame(world))).toBe(
      false,
    );
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

    expect(railView.now.title).toBe("A room for tonight");
    expect(railView.peekLabel).toBe("First morning in South Quay");
    expect(railView.statusLabel).toBe("Ready");
    expect(railView.next?.title).toBe("Ask Mara how to keep tonight's room.");

    const insideMorrow = await enterMorrowHouse(engine, world);
    const liveConversation = await engine.runCommand(insideMorrow, {
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

  it("shows the finish state once Rowan is already home and the first afternoon is done", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-home-rest");

    for (let step = 0; step < 24; step += 1) {
      world = await engine.runCommand(world, {
        type: "advance_objective",
        allowTimeSkip: true,
      });
      if (
        world.player.currentLocationId === "boarding-house" &&
        world.rowanAutonomy.label === "First afternoon complete"
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

    expect(railView.now.title).toBe("First afternoon complete");
    expect(railView.next).toBeNull();
  });

  it("does not promote stale Morrow standing trail hints after the Nia lead takes over", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-late-nia-trail");
    const currentObjective = world.player.objective as PlayerObjective;
    const staleStandingStep = {
      id: "settle-standing",
      title: "Build standing at Morrow House so the room stays mine.",
      detail:
        "Now that Rowan knows the terms, he needs to show up, help out, and make the house easier to run.",
      done: false,
      progress: "Standing 2/2",
      targetLocationId: "boarding-house",
    };

    world.currentTime = "Day 1, 15:50";
    world.clock.hour = 15;
    world.clock.minute = 50;
    world.clock.totalMinutes = 15 * 60 + 50;
    world.firstAfternoon = {
      completedAt: "Day 1, 15:24",
    };
    world.player.currentLocationId = "repair-stall";
    world.player.objective = {
      ...currentObjective,
      focus: "help",
      routeKey: "people-nia",
      source: "conversation",
      text: "Ask Nia where the block is about to jam before the square feels it.",
      outcomes: [
        {
          authority: "predicate",
          id: "nia-block-lead",
          label: "Ask Nia where the block is about to jam",
          npcId: "npc-nia",
          status: "open",
          urgency: 86,
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      trail: [staleStandingStep],
    };
    world.rowanAutonomy = {
      actionId: "exit:repair-stall",
      autoContinue: true,
      detail:
        "Rowan is done inside Mercer Repairs for now, so he steps back into South Quay: Jo's clue points toward Nia now, so Rowan needs South Quay before the block jam gets worse.",
      intent: {
        reason: "Rowan is at Mercer Repairs, so exit to South Quay is the useful next move.",
        signals: [
          "Goal: Ask Nia where the block is about to jam before the square feels it.",
        ],
      },
      key: "plan:people-nia:repair-stall:exit",
      label: "Exit to South Quay",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "market-square",
    };

    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is reading the live lead.",
      game: asWebGame(world),
      playback: createEmptyRowanPlaybackState(),
      quietStatusLabel: world.currentScene.title,
    });

    const lateRailText = [
      railView.peekLabel,
      railView.thought,
      railView.now.title,
      railView.now.detail,
      railView.next?.title,
      railView.next?.detail,
    ].join(" ");

    expect(lateRailText).toMatch(/Nia|South Quay|block|jam/i);
    expect(lateRailText).not.toMatch(
      /Build standing at Morrow House|room stays mine|tonight's bed/i,
    );

    world.player.objective = {
      ...currentObjective,
      focus: "settle",
      routeKey: "settle-core",
      source: "manual",
      text: "Keep tonight's room and improve Rowan's standing at Morrow House.",
      outcomes: [
        {
          authority: "predicate",
          id: "settle-standing",
          label: "Morrow House standing built",
          status: "open",
          targetLocationId: "boarding-house",
          urgency: 4,
        },
      ],
      progress: {
        completed: 0,
        label: "0/1 outcomes met",
        total: 1,
      },
      trail: [staleStandingStep],
    };
    const standingRailView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is reading the room terms.",
      game: asWebGame(world),
      playback: createEmptyRowanPlaybackState(),
      quietStatusLabel: world.currentScene.title,
    });

    expect(
      `${standingRailView.peekLabel} ${standingRailView.next?.title}`,
    ).toMatch(/Build standing at Morrow House so the room stays mine/i);
  });
});
