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
  remainingAutoplayDelayMs,
  ROWAN_PLAYBACK_TIMING_MS,
  ROWAN_WATCH_PRESENTATION_TIMING_MS,
  ROWAN_WATCH_URGENT_PROBLEM_TIMING_MS,
  rowanWatchAutonomyDelayForState,
  settleCompletedMovePlayback,
  startNextRowanPlaybackBeat,
  type RowanPlaybackBeat,
} from "../../many-lives-web/src/lib/street/rowanPlayback.js";
import { buildStreetBrowserProbeJson } from "../../many-lives-web/src/lib/street/browserProbe.js";
import { buildIndependentNpcActionRecords } from "../../many-lives-web/src/lib/street/independentNpcActions.js";
import { isObjectiveTrailStepPlayerFacingForPlayback } from "../../many-lives-web/src/lib/street/rowanPlaybackScaffolds.js";
import { MockAIProvider } from "../src/ai/mockProvider.js";
import { SimulationEngine } from "../src/sim/engine.js";
import {
  deriveOpeningWorldVariant,
  seedStreetGame,
} from "../src/street-sim/seedGame.js";
import type {
  PlayerObjective,
  StreetGameState,
} from "../src/street-sim/types.js";
import { enterMorrowHouse, enterTeaHouse } from "./street-test-helpers.js";

function asWebGame(world: StreetGameState) {
  return world as unknown as import("../../many-lives-web/src/lib/street/types.js").StreetGameState;
}

function setClock(
  world: StreetGameState,
  { hour, minute }: { hour: number; minute: number },
) {
  world.clock.hour = hour;
  world.clock.minute = minute;
  world.clock.totalMinutes = hour * 60 + minute;
  world.clock.label = hour >= 17 ? "Evening" : "Afternoon";
  world.currentTime = `2026-03-21T${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}:00.000Z`;
}

describe("Rowan playback helpers", () => {
  it("exposes browser-local presentation timing and visible transcript streaming", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-probe-presentation-clock");
    world = await enterMorrowHouse(engine, world);
    world = await engine.runCommand(world, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    expect(world.activeConversation).toBeDefined();

    const playback = createEmptyRowanPlaybackState();
    const railView = buildRowanRailViewModel({
      conversationReplayActive: true,
      fallbackThought: "Rowan is listening to Mara.",
      game: asWebGame(world),
      playback,
      quietStatusLabel: world.currentScene.title,
      watchMode: true,
    });
    const probe = JSON.parse(
      buildStreetBrowserProbeJson({
        activeConversation: world.activeConversation,
        game: asWebGame(world),
        rowanRail: railView,
        snapshot: {
          conversationReplay: {
            isReplaying: true,
            revealedEntryIds: ["line-1"],
            streamedWordCount: 7,
            streamingEntryId: "line-2",
          },
          rowanPlayback: playback,
          rowanWatchModeEnabled: true,
        },
      }),
    );

    expect(probe.timing.appMonotonicMs).toEqual(
      probe.timing.wallMonotonicMs,
    );
    expect(probe.activeConversation.replay).toEqual({
      isReplaying: true,
      revealedEntryCount: 1,
      streamedWordCount: 7,
      streamingEntryId: "line-2",
    });

    const quietRail = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is listening to Mara.",
      game: asWebGame(world),
      playback,
      quietStatusLabel: world.currentScene.title,
      watchMode: false,
    });
    const hiddenReplayProbe = JSON.parse(
      buildStreetBrowserProbeJson({
        activeConversation: world.activeConversation,
        game: asWebGame(world),
        rowanRail: {
          ...quietRail,
          useConversationTranscript: false,
        },
        snapshot: {
          conversationReplay: {
            isReplaying: true,
            revealedEntryIds: ["line-1"],
            streamedWordCount: 8,
            streamingEntryId: "line-2",
          },
          rowanPlayback: playback,
          rowanWatchModeEnabled: false,
        },
      }),
    );
    expect(hiddenReplayProbe.activeConversation.replay).toBeNull();
  });

  it("tightens watch pacing only while Rowan is equipped for a live problem", () => {
    const world = seedStreetGame("rowan-playback-equipped-problem");
    const pump = world.problems.find(
      (problem) => problem.id === "problem-pump",
    );

    expect(pump).toBeDefined();
    expect(rowanWatchAutonomyDelayForState(asWebGame(world))).toBe(
      ROWAN_WATCH_PRESENTATION_TIMING_MS.autonomyDelay,
    );

    pump!.discovered = true;
    pump!.status = "active";
    world.player.inventory.push({
      description: "A solid old wrench.",
      id: pump!.requiredItemId!,
      name: "Old wrench",
    });

    expect(rowanWatchAutonomyDelayForState(asWebGame(world))).toBe(
      ROWAN_WATCH_URGENT_PROBLEM_TIMING_MS,
    );

    world.player.energy = 12;
    expect(rowanWatchAutonomyDelayForState(asWebGame(world)).moving).toBe(
      ROWAN_WATCH_URGENT_PROBLEM_TIMING_MS.drainedMoving,
    );

    pump!.status = "solved";
    expect(rowanWatchAutonomyDelayForState(asWebGame(world))).toBe(
      ROWAN_WATCH_PRESENTATION_TIMING_MS.autonomyDelay,
    );
  });

  it("derives move and arrival beats from a real location change", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-move-ordinary");
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
    const world = await engine.createGame(
      "rowan-playback-enter-interior-ordinary",
    );
    const entered = await enterMorrowHouse(engine, world);

    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(entered));

    expect(beats.map((beat) => beat.kind)).not.toContain("move");
    expect(beats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blocking: false,
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

    const watchAcceptedBeats = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(accepted),
      { watchMode: true },
    );
    const watchStartedBeats = deriveRowanPlaybackBeats(
      asWebGame(readyToWork),
      asWebGame(started),
      { watchMode: true },
    );
    const watchCompletedBeats = deriveRowanPlaybackBeats(
      asWebGame(counter),
      asWebGame(completed),
      { watchMode: true },
    );

    expect(
      acceptedBeats.find((beat) => beat.kind === "action_start")?.durationMs,
    ).toBe(ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap);
    expect(
      startedBeats.find((beat) => beat.kind === "action_start")?.durationMs,
    ).toBe(ROWAN_PLAYBACK_TIMING_MS.minimumAutoplayGap);
    expect(
      completedBeats.find((beat) => beat.kind === "action_complete")
        ?.durationMs,
    ).toBe(ROWAN_PLAYBACK_TIMING_MS.postActionCompletePause);
    expect(
      watchAcceptedBeats.find((beat) => beat.kind === "action_start")
        ?.durationMs,
    ).toBe(ROWAN_WATCH_PRESENTATION_TIMING_MS.semanticCard);
    expect(
      watchStartedBeats.find((beat) => beat.kind === "action_start")
        ?.durationMs,
    ).toBe(ROWAN_WATCH_PRESENTATION_TIMING_MS.semanticCard);
    expect(
      watchCompletedBeats.find((beat) => beat.kind === "action_complete")
        ?.durationMs,
    ).toBe(ROWAN_WATCH_PRESENTATION_TIMING_MS.durableCard);

    const rushBeat = watchStartedBeats.find(
      (beat) => beat.key.startsWith("tea-shift-stage:rush:"),
    );
    expect(rushBeat).toBeTruthy();
    expect(
      alignRowanPlaybackWithGame(
        { activeBeat: rushBeat, queuedBeats: rushBeat ? [rushBeat] : [] },
        asWebGame(started),
      ).activeBeat,
    ).toBe(rushBeat);
    const alignedWithCompletedShift = alignRowanPlaybackWithGame(
      { activeBeat: rushBeat, queuedBeats: rushBeat ? [rushBeat] : [] },
      asWebGame(completed),
    );
    expect(alignedWithCompletedShift.activeBeat).toBeUndefined();
    expect(alignedWithCompletedShift.queuedBeats).toHaveLength(0);
  });

  it("uses a watch-only movement profile without changing manual defaults", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-watch-move");
    const moved = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });

    const manualMove = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(moved),
    ).find((beat) => beat.kind === "move");
    const watchMove = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(moved),
      { watchMode: true },
    ).find((beat) => beat.kind === "move");

    expect(manualMove?.durationMs).toBeLessThanOrEqual(4_800);
    expect(watchMove?.durationMs).toBeGreaterThan(manualMove?.durationMs ?? 0);
    expect(watchMove?.durationMs).toBeLessThanOrEqual(
      ROWAN_WATCH_PRESENTATION_TIMING_MS.movementMax,
    );
    expect(ROWAN_WATCH_PRESENTATION_TIMING_MS).toMatchObject({
      autonomyDelay: {
        acting: 10_000,
        conversation: 10_800,
        moving: 6_000,
        waiting: 9_800,
      },
      durableCard: 3_400,
      movementPerTile: 420,
      semanticCard: 2_800,
      timePassageCard: 4_500,
    });
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
    const cityBeat = beats.find(
      (beat) => beat.kind === "city_beat" && beat.title === "Nia cleared the square",
    );
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

  it("surfaces Tomas closing yard loading as independent local action evidence", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-yard-city-beat");

    setClock(world, { hour: 16, minute: 30 });
    world.activeSpaceId = "interior:boarding-house";
    world.player.spaceId = "interior:boarding-house";
    world.player.currentLocationId = "boarding-house";

    const yardJob = world.jobs.find((job) => job.id === "job-yard-shift");
    if (yardJob) {
      yardJob.discovered = true;
      yardJob.accepted = false;
      yardJob.completed = false;
      yardJob.missed = false;
    }

    const cart = world.problems.find((problem) => problem.id === "problem-cart");
    if (cart) {
      cart.status = "solved";
    }

    const closed = await engine.runCommand(world, {
      type: "wait",
      minutes: 60,
      silent: true,
    });

    const records = buildIndependentNpcActionRecords(asWebGame(closed));
    const yardAction = records.find(
      (action) => action.actionKind === "job_closure",
    );

    expect(yardAction).toMatchObject({
      actionKind: "job_closure",
      actorName: "Tomas",
      actorNpcId: "npc-tomas",
      afterStatus: "closed",
      beforeStatus: "open",
      closedAt: "2026-03-21T17:00:00.000Z",
      jobId: "job-yard-shift",
      jobTitle: "Freight yard lift",
      locationId: "freight-yard",
      occurredAt: "2026-03-21T17:00:00.000Z",
      subjectId: "job-yard-shift",
      subjectTitle: "Freight yard lift",
    });
    expect(yardAction?.playerFacingSummary).toContain(
      "Tomas got the North Crane Yard load out with his own crew",
    );
    expect(yardAction?.playerFacingSummary).not.toMatch(
      /\bjob-yard-shift|jobId|problemId|resolverNpcId|actorNpcId\b/i,
    );

    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(closed));
    const cityBeat = beats.find((beat) => beat.kind === "city_beat");

    expect(cityBeat).toMatchObject({
      detail: expect.stringContaining(
        "Tomas got the North Crane Yard load out with his own crew",
      ),
      kind: "city_beat",
      locationId: "freight-yard",
      title: "Tomas closed the yard load",
    });

    const playback = completeActiveRowanPlaybackBeat({
      activeBeat: cityBeat!,
      queuedBeats: [],
    });
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is watching the block move around him.",
      game: asWebGame(closed),
      playback,
      quietStatusLabel: closed.currentScene.title,
      watchMode: true,
    });

    expect(railView.justHappened).toMatchObject({
      detail: expect.stringContaining("Tomas got the North Crane Yard load out"),
      title: "Tomas closed the yard load",
      tone: "info",
    });

    const probe = JSON.parse(
      buildStreetBrowserProbeJson({
        activeConversation: closed.activeConversation,
        game: asWebGame(closed),
        rowanRail: railView,
        snapshot: {
          rowanPlayback: playback,
          rowanWatchModeEnabled: true,
        },
      }),
    );

    expect(probe.independentNpcSurface).toMatchObject({
      actionKind: "job_closure",
      actorName: "Tomas",
      afterStatus: "closed",
      beforeStatus: "open",
      closedAt: "2026-03-21T17:00:00.000Z",
      detail: expect.stringContaining("Tomas got the North Crane Yard load out"),
      jobId: "job-yard-shift",
      locationId: "freight-yard",
      slot: "just_happened",
      title: "Tomas closed the yard load",
    });
    expect(
      `${probe.independentNpcSurface.title} ${probe.independentNpcSurface.detail}`,
    ).not.toMatch(
      /\bjob-yard-shift|jobId|problemId|resolverNpcId|actorNpcId\b/i,
    );
  });

  it("keeps Rowan's active autonomy in Now while an active city beat is separately visible", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    let world = await engine.createGame("rowan-playback-active-city-beat");

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
    const cityBeat = deriveRowanPlaybackBeats(
      asWebGame(world),
      asWebGame(resolved),
    ).find(
      (beat) => beat.kind === "city_beat" && beat.title === "Nia cleared the square",
    );
    expect(cityBeat).toBeTruthy();

    const rowanActing = structuredClone(resolved);
    rowanActing.firstAfternoon = {
      ...rowanActing.firstAfternoon,
      planSettledAt: "Day 1, 10:00",
    };
    rowanActing.rowanAutonomy = {
      ...rowanActing.rowanAutonomy,
      actionId: "work:job-yard-shift",
      autoContinue: true,
      detail:
        "Rowan is finishing the freight yard lift before the load window closes.",
      intent: {
        reason:
          "The yard job is still legal now, so Rowan should finish the lift before checking anything else.",
        signals: ["Action: Finish Freight yard lift"],
      },
      key: "plan:test:yard-lift",
      label: "Finish Freight yard lift",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "freight-yard",
    };
    const playback = {
      activeBeat: cityBeat!,
      queuedBeats: [],
    };
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is watching the block move around him.",
      game: asWebGame(rowanActing),
      playback,
      quietStatusLabel: rowanActing.currentScene.title,
      watchMode: true,
    });

    expect(isBlockingRowanPlaybackForGame(playback, asWebGame(rowanActing))).toBe(
      true,
    );
    expect(railView.now).toMatchObject({
      detail: expect.stringContaining("finishing the freight yard lift"),
      title: "Finish Freight yard lift",
      tone: "objective",
    });
    expect(railView.justHappened).toMatchObject({
      detail: expect.stringContaining("Nia cleared the jammed handcart"),
      title: "Nia cleared the square",
      tone: "info",
    });
    expect(railView.statusLabel).toBe("City beat");
    expect(railView.shouldAutoOpen).toBe(true);

    const probe = JSON.parse(
      buildStreetBrowserProbeJson({
        activeConversation: rowanActing.activeConversation,
        game: asWebGame(rowanActing),
        rowanRail: railView,
        snapshot: {
          rowanPlayback: playback,
          rowanWatchModeEnabled: true,
        },
      }),
    );

    expect(probe.rail.now).toBe("Finish Freight yard lift");
    expect(probe.rail.justHappened).toBe("Nia cleared the square");
    expect(probe.independentNpcSurface).toMatchObject({
      detail: expect.stringContaining("Nia cleared the jammed handcart"),
      playerFacingSummary: expect.stringContaining(
        "Nia cleared the jammed handcart",
      ),
      problemId: "problem-cart",
      slot: "just_happened",
      title: "Nia cleared the square",
    });
  });

  it("keeps opening carry-forward probe relevance tied to state and selected action", () => {
    const world = seedStreetGame("rowan-playback-opening-carry-forward");
    world.player.objective = {
      ...(world.player.objective as PlayerObjective),
      routeKey: "renamed-opening-route",
    };
    world.rowanAutonomy = {
      ...world.rowanAutonomy,
      actionId: "enter:boarding-house",
      autoContinue: true,
      detail: "Rowan can step inside Morrow House and make the room concrete.",
      key: "opening:enter-boarding-house",
      label: "Enter Morrow House",
      layer: "objective",
      mode: "acting",
      stepKind: "act",
      targetLocationId: "boarding-house",
    };

    const playback = createEmptyRowanPlaybackState();
    const railView = buildRowanRailViewModel({
      conversationReplayActive: false,
      fallbackThought: "Rowan is getting the first room settled.",
      game: asWebGame(world),
      playback,
      quietStatusLabel: world.currentScene.title,
      watchMode: true,
    });
    const probe = JSON.parse(
      buildStreetBrowserProbeJson({
        activeConversation: world.activeConversation,
        game: asWebGame(world),
        rowanRail: railView,
        snapshot: {
          rowanPlayback: playback,
          rowanWatchModeEnabled: true,
        },
      }),
    );

    expect(probe.openingActionCarryForward).toMatchObject({
      requiredVisibleInput: false,
      selectedActionId: "enter:boarding-house",
      status: "queued",
    });
  });

  it("keeps pre-known pump facts from superseding the current opening action", async () => {
    const gameId = "game-2";
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame(gameId);
    const buildProbe = (game: StreetGameState) => {
      const playback = createEmptyRowanPlaybackState();
      const railView = buildRowanRailViewModel({
        conversationReplayActive: false,
        fallbackThought: "Rowan is getting the first room settled.",
        game: asWebGame(game),
        playback,
        quietStatusLabel: game.currentScene.title,
        watchMode: true,
      });

      return JSON.parse(
        buildStreetBrowserProbeJson({
          activeConversation: game.activeConversation,
          game: asWebGame(game),
          rowanRail: railView,
          snapshot: {
            rowanPlayback: playback,
            rowanWatchModeEnabled: true,
          },
        }),
      );
    };

    expect(deriveOpeningWorldVariant(gameId)).toBe("noticed-pump");
    expect(world.firstAfternoon?.approachesKnownAt).toBe(world.currentTime);
    expect(world.rowanAutonomy).toMatchObject({
      actionId: "enter:boarding-house",
      targetLocationId: "boarding-house",
    });

    const openingProbe = buildProbe(world);
    expect(openingProbe.openingActionCarryForward).toMatchObject({
      completionEvidence: ["first-afternoon-approaches-known"],
      phase: "opening_queued",
      progressedBeyondOpening: false,
      requiredVisibleInput: false,
      selectedActionId: "enter:boarding-house",
      status: "queued",
      supersededBy: null,
      targetLocationId: "boarding-house",
    });

    const progressed = structuredClone(world);
    progressed.rowanAutonomy = {
      ...progressed.rowanAutonomy,
      actionId: "talk:npc-mara",
      label: "Talk to Mara",
      mode: "acting",
      stepKind: "talk",
      targetLocationId: "boarding-house",
    };
    expect(buildProbe(progressed).openingActionCarryForward).toMatchObject({
      phase: "superseded_by_autoplay_progress",
      progressedBeyondOpening: true,
      supersededBy: {
        actionId: "talk:npc-mara",
        targetLocationId: "boarding-house",
      },
    });

    const consequenceReached = structuredClone(world);
    consequenceReached.firstAfternoon = {
      ...consequenceReached.firstAfternoon,
      consequence: {
        achievedAt: consequenceReached.currentTime,
        evidence: "The leaking pump is repaired.",
        id: "problem-pump",
        kind: "local-problem",
        label: "Leaking hand pump solved",
      },
    };
    expect(
      buildProbe(consequenceReached).openingActionCarryForward,
    ).toMatchObject({
      completionEvidence: expect.arrayContaining([
        "first-afternoon-consequence-local-problem",
      ]),
      phase: "superseded_by_autoplay_progress",
      progressedBeyondOpening: true,
    });
  });

  it("exposes pressure-moved NPCs directly in the browser world-pressure probe", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const buildProbe = (world: StreetGameState) => {
      const railView = buildRowanRailViewModel({
        conversationReplayActive: Boolean(world.activeConversation),
        fallbackThought: "Rowan is reading the city pressure.",
        game: asWebGame(world),
        playback: createEmptyRowanPlaybackState(),
        quietStatusLabel: world.currentScene.title,
        watchMode: true,
      });

      return JSON.parse(
        buildStreetBrowserProbeJson({
          activeConversation: world.activeConversation,
          game: asWebGame(world),
          rowanRail: railView,
          snapshot: {
            rowanWatchModeEnabled: true,
          },
        }),
      );
    };

    let maraWorld = await engine.createGame("rowan-probe-pressure-mara");
    maraWorld = await enterMorrowHouse(engine, maraWorld);
    maraWorld = await engine.runCommand(maraWorld, {
      type: "act",
      actionId: "talk:npc-mara",
    });
    maraWorld = await engine.tick(maraWorld, 9);

    const maraProbe = buildProbe(maraWorld);
    const maraMove = maraProbe.worldPressure.npcPressureMoves.find(
      (npc: { id: string }) => npc.id === "npc-mara",
    );

    expect(
      Object.prototype.hasOwnProperty.call(
        maraProbe.worldPressure,
        "npcPressureMoves",
      ),
    ).toBe(true);
    expect(
      maraProbe.worldPressure.npcSchedules.find(
        (npc: { id: string }) => npc.id === "npc-mara",
      ),
    ).toMatchObject({
      currentLocationId: "courtyard",
      currentScheduleLocationId: "boarding-house",
    });
    expect(maraMove).toMatchObject({
      currentConcern: expect.any(String),
      currentLocationId: "courtyard",
      currentScheduleLocationId: "boarding-house",
      id: "npc-mara",
      mood: expect.any(String),
    });
    expect(maraMove.currentConcern.length).toBeGreaterThan(0);

    let niaWorld = await engine.createGame("rowan-probe-pressure-nia");
    niaWorld = await engine.tick(niaWorld, 10);

    const niaProbe = buildProbe(niaWorld);
    const niaMove = niaProbe.worldPressure.npcPressureMoves.find(
      (npc: { id: string }) => npc.id === "npc-nia",
    );

    expect(
      niaProbe.worldPressure.npcSchedules.find(
        (npc: { id: string }) => npc.id === "npc-nia",
      ),
    ).toMatchObject({
      currentLocationId: "market-square",
      currentScheduleLocationId: "moss-pier",
    });
    expect(niaMove).toMatchObject({
      currentConcern: expect.any(String),
      currentLocationId: "market-square",
      currentScheduleLocationId: "moss-pier",
      id: "npc-nia",
      mood: expect.any(String),
    });
    expect(niaMove.currentConcern.length).toBeGreaterThan(0);
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

  it("keeps arrival context visible without blocking the next autonomous beat", () => {
    const arrivalBeat: RowanPlaybackBeat = {
      blocking: false,
      detail: "Rowan entered Kettle & Lamp.",
      durationMs: 420,
      key: "space:test:street:tea-house",
      kind: "arrive",
      locationId: "tea-house",
      title: "Entered Kettle & Lamp",
      tone: "info",
    };
    const playback = startNextRowanPlaybackBeat(
      appendRowanPlaybackBeats(createEmptyRowanPlaybackState(), [arrivalBeat]),
    );

    expect(playback.activeBeat).toBe(arrivalBeat);
    expect(isBlockingRowanPlayback(playback)).toBe(false);
  });

  it("settles move playback when the visual route has already arrived", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-settled-route");
    const moved = await engine.runCommand(world, {
      type: "move_to",
      x: 6,
      y: 4,
    });
    const beats = deriveRowanPlaybackBeats(asWebGame(world), asWebGame(moved));
    const playback = startNextRowanPlaybackBeat(
      appendRowanPlaybackBeats(createEmptyRowanPlaybackState(), beats),
    );

    expect(playback.activeBeat?.kind).toBe("move");
    expect(isBlockingRowanPlayback(playback)).toBe(true);

    const settled = settleCompletedMovePlayback(
      playback,
      asWebGame(moved),
    );

    expect(settled.activeBeat).toBeUndefined();
    expect(settled.lastCompletedBeat).toBeUndefined();
    expect(settled.queuedBeats.every((beat) => beat.kind !== "move")).toBe(
      true,
    );
    expect(isBlockingRowanPlayback(settled)).toBe(false);
  });

  it("keeps an autoplay dwell on a fixed deadline across playback updates", () => {
    expect(remainingAutoplayDelayMs(3_400, 1_000, 1_420)).toBe(2_980);
    expect(remainingAutoplayDelayMs(3_400, 1_000, 4_500)).toBe(0);
    expect(remainingAutoplayDelayMs(3_400, null, 4_500)).toBe(3_400);
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

  it("classifies a long positive-energy time jump at home as a rest beat", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-home-rest-beat");
    const beforeRest = structuredClone(world);
    beforeRest.player.currentLocationId = "boarding-house";
    beforeRest.player.energy = 31;

    const afterRest = structuredClone(beforeRest);
    afterRest.clock.totalMinutes += 60;
    afterRest.clock.hour += 1;
    afterRest.currentTime = "Day 1, 10:00";
    afterRest.player.energy = 43;

    const beats = deriveRowanPlaybackBeats(
      asWebGame(beforeRest),
      asWebGame(afterRest),
    );

    expect(beats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "rest",
          locationId: "boarding-house",
          title: "Rest complete",
        }),
      ]),
    );
  });

  it("does not classify a long positive-energy time jump away from home as rest", async () => {
    const engine = new SimulationEngine(new MockAIProvider());
    const world = await engine.createGame("rowan-playback-away-time-jump");
    const beforeJump = structuredClone(world);
    beforeJump.player.currentLocationId = "tea-house";
    beforeJump.player.energy = 31;

    const afterJump = structuredClone(beforeJump);
    afterJump.clock.totalMinutes += 60;
    afterJump.clock.hour += 1;
    afterJump.currentTime = "Day 1, 10:00";
    afterJump.player.energy = 43;

    const beats = deriveRowanPlaybackBeats(
      asWebGame(beforeJump),
      asWebGame(afterJump),
    );
    const watchBeats = deriveRowanPlaybackBeats(
      asWebGame(beforeJump),
      asWebGame(afterJump),
      { watchMode: true },
    );

    expect(beats.map((beat) => beat.kind)).not.toContain("rest");
    expect(beats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "time_passed",
          title: "Time passed",
        }),
      ]),
    );
    expect(
      watchBeats.find((beat) => beat.kind === "time_passed")?.durationMs,
    ).toBe(ROWAN_WATCH_PRESENTATION_TIMING_MS.timePassageCard);
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
    const liveNiaStep = {
      id: "ask-nia-block-jam",
      title: "Ask Nia where the block is about to jam.",
      detail:
        "The live lead points to South Quay and the square before the cart turns into the whole block's problem.",
      done: false,
      progress: "Nia lead 0/1",
      targetLocationId: "market-square",
    };

    expect(
      isObjectiveTrailStepPlayerFacingForPlayback({
        objective: {
          ...currentObjective,
          routeKey: "people-nia",
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
        },
        step: staleStandingStep,
      }),
    ).toBe(false);
    expect(
      isObjectiveTrailStepPlayerFacingForPlayback({
        objective: {
          ...currentObjective,
          routeKey: "people-nia",
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
        },
        step: liveNiaStep,
      }),
    ).toBe(true);

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
      trail: [staleStandingStep, liveNiaStep],
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
    expect(railView.next?.title).toBe("Ask Nia where the block is about to jam.");
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
