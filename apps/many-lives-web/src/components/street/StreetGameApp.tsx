"use client";

import {
  useCallback,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { DistrictMap } from "@/components/street/DistrictMap";
import {
  ObjectiveTrail,
  type ObjectiveTrailItem,
} from "@/components/street/ObjectiveTrail";
import {
  ActionCard,
  LogRow,
  MutedLine,
  Panel,
  SceneNoteCard,
  StatPill,
} from "@/components/street/StreetUi";
import {
  formatClock,
  toFirstPersonText,
} from "@/components/street/streetFormatting";
import {
  actInStreetGame,
  advanceStreetObjective,
  createStreetGame,
  moveStreetPlayer,
  setStreetObjective,
  waitInStreetGame,
} from "@/lib/street/api";
import type {
  NpcState,
  StreetGameState,
} from "@/lib/street/types";

const MOVEMENT_FLUSH_DELAY_MS = 90;
const REALTIME_CLOCK_INTERVAL_MS = 1000;
const AUTO_OBJECTIVE_IDLE_MS = 5600;
const AUTO_OBJECTIVE_COOLDOWN_MS = 4600;
const AUTO_CONVERSATION_SETTLE_MS = 5200;
const POST_CONVERSATION_BREATH_MS = 1800;
const AUTO_SCENE_RETURN_MS = 1200;
const CONVERSATION_STREAM_FIRST_ENTRY_PAUSE_MS = 560;
const CONVERSATION_STREAM_INITIAL_DELAY_MS = 240;
const CONVERSATION_STREAM_PLAYER_WORD_DELAY_MS = 72;
const CONVERSATION_STREAM_NPC_WORD_DELAY_MS = 92;
const CONVERSATION_STREAM_SAME_SPEAKER_PAUSE_MS = 360;
const CONVERSATION_STREAM_TURN_CHANGE_PAUSE_MS = 1320;
const CONVERSATION_STREAM_ENTRY_SETTLE_MS = 260;
const STREET_SIM_BASE_DAY = "2026-03-21T00:00:00.000Z";

type Point = {
  x: number;
  y: number;
};

type ClockAnchor = {
  totalMinutes: number;
  appliedAtMs: number;
};

type ScenePanelMode = "scene" | "conversation";
type ConversationTypingState = {
  actor: "rowan" | "npc";
  npcId: string;
};
type ObjectivePlanItem = {
  id: string;
  title: string;
  detail: string;
  progress?: string;
  done: boolean;
};
type CharacterProfileSection = {
  label: string;
  value: string;
};
type CharacterProfile = {
  id: string;
  name: string;
  role: string;
  summary: string;
  locationLabel: string;
  statusLabel: string;
  tagLabel?: string;
  known?: boolean;
  isPlayer?: boolean;
  sections: CharacterProfileSection[];
};

function objectiveTrailStepToPlanItem(item: ObjectiveTrailItem): ObjectivePlanItem {
  return {
    id: item.id,
    title: item.title,
    detail: item.detail ?? "",
    progress: item.progress,
    done: Boolean(item.done),
  };
}

export function StreetGameApp() {
  const [game, setGame] = useState<StreetGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [optimisticPlayerPosition, setOptimisticPlayerPosition] =
    useState<Point | null>(null);
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("player");
  const [conversationNpcId, setConversationNpcId] = useState<string | null>(
    null,
  );
  const [conversationTypingState, setConversationTypingState] =
    useState<ConversationTypingState | null>(null);
  const [isConversationPanelOpen, setIsConversationPanelOpen] = useState(false);
  const [isCityOverlayOpen, setIsCityOverlayOpen] = useState(true);
  const [scenePanelMode, setScenePanelMode] = useState<ScenePanelMode>("scene");
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [lastConversationReplayCompletedAt, setLastConversationReplayCompletedAt] =
    useState(0);
  const gameRef = useRef<StreetGameState | null>(null);
  const movementTargetRef = useRef<Point | null>(null);
  const optimisticPlayerRef = useRef<Point | null>(null);
  const isMovementInFlightRef = useRef(false);
  const movementFlushTimerRef = useRef<number | null>(null);
  const lastUserInputAtRef = useRef(Date.now());
  const lastAutoAdvanceAtRef = useRef(0);
  const busyLabelRef = useRef<string | null>(null);
  const clockAnchorRef = useRef<ClockAnchor | null>(null);
  const requestSequenceRef = useRef(0);
  const lastAppliedRequestRef = useRef(0);
  const realtimeSyncInFlightRef = useRef(false);
  const lastAutoOpenedConversationIdRef = useRef<string | null>(null);
  const playedConversationReplaySignaturesRef = useRef<Set<string>>(new Set());

  const hasPendingMovement = useCallback(() => {
    return isMovementInFlightRef.current || Boolean(movementTargetRef.current);
  }, []);
  const activeConversationReplaySignature = game?.activeConversation
    ? buildConversationReplaySignature(game.activeConversation)
    : null;
  const hasPendingActiveConversationReplay = Boolean(
    activeConversationReplaySignature &&
      !playedConversationReplaySignaturesRef.current.has(
        activeConversationReplaySignature,
      ),
  );

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    optimisticPlayerRef.current = optimisticPlayerPosition;
  }, [optimisticPlayerPosition]);

  useEffect(() => {
    busyLabelRef.current = busyLabel;
  }, [busyLabel]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, REALTIME_CLOCK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setObjectiveDraft(game?.player.objective?.text ?? "");
  }, [game?.id, game?.player.objective?.text]);

  useEffect(() => {
    playedConversationReplaySignaturesRef.current.clear();
  }, [game?.id]);

  useEffect(() => {
    if (!game) {
      setConversationNpcId(null);
      return;
    }

    const availableTalkNpcIds = game.availableActions
      .map((action) => extractTalkNpcId(action.id))
      .filter(isPresent);

    if (
      conversationNpcId &&
      availableTalkNpcIds.includes(conversationNpcId)
    ) {
      return;
    }

    setConversationNpcId(availableTalkNpcIds[0] ?? null);
  }, [conversationNpcId, game]);

  useEffect(() => {
    if (game && game.availableActions.every((action) => !extractTalkNpcId(action.id))) {
      setIsConversationPanelOpen(false);
    }
  }, [game]);

  useEffect(() => {
    return () => {
      if (movementFlushTimerRef.current) {
        window.clearTimeout(movementFlushTimerRef.current);
      }
    };
  }, []);

  const nextRequestId = useCallback(() => {
    requestSequenceRef.current += 1;
    return requestSequenceRef.current;
  }, []);

  const applyGameUpdate = useCallback(
    (nextGame: StreetGameState, requestId?: number) => {
      if (
        requestId !== undefined &&
        requestId < lastAppliedRequestRef.current
      ) {
        return false;
      }

      if (requestId !== undefined) {
        lastAppliedRequestRef.current = requestId;
      }

      const now = Date.now();
      const currentLiveClock = gameRef.current
        ? deriveLiveClock(
            gameRef.current.clock,
            clockAnchorRef.current,
            now,
          )
        : nextGame.clock;
      gameRef.current = nextGame;
      clockAnchorRef.current = {
        totalMinutes: Math.max(
          nextGame.clock.totalMinutes,
          currentLiveClock.totalMinutes,
        ),
        appliedAtMs: now,
      };
      setClockNowMs(now);

      startTransition(() => {
        setGame(nextGame);
      });

      return true;
    },
    [],
  );

  const flushMovementQueue = useCallback(async () => {
    if (isMovementInFlightRef.current) {
      return;
    }

    const activeGame = gameRef.current;
    const target = movementTargetRef.current;
    if (!activeGame || !target) {
      return;
    }

    movementTargetRef.current = null;
    isMovementInFlightRef.current = true;
    const requestId = nextRequestId();

    try {
      const nextGame = await moveStreetPlayer(activeGame.id, target.x, target.y);
      applyGameUpdate(nextGame, requestId);

      if (!movementTargetRef.current) {
        setOptimisticPlayerPosition(null);
      }
    } catch (moveError) {
      movementTargetRef.current = null;
      setOptimisticPlayerPosition(null);
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Rowan lost the thread of that move.",
      );
    } finally {
      isMovementInFlightRef.current = false;

      if (movementTargetRef.current) {
        void flushMovementQueue();
      }
    }
  }, [applyGameUpdate, nextRequestId]);

  const scheduleMovementFlush = useCallback(() => {
    if (movementFlushTimerRef.current) {
      window.clearTimeout(movementFlushTimerRef.current);
    }

    movementFlushTimerRef.current = window.setTimeout(() => {
      movementFlushTimerRef.current = null;
      void flushMovementQueue();
    }, MOVEMENT_FLUSH_DELAY_MS);
  }, [flushMovementQueue]);

  const handleMovement = useCallback(async (x: number, y: number) => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current) {
      return;
    }

    const nextTile = findWalkableTile(
      activeGame,
      clamp(x, 0, activeGame.map.width - 1),
      clamp(y, 0, activeGame.map.height - 1),
    );

    if (!nextTile) {
      return;
    }

    const currentVisualPosition =
      optimisticPlayerRef.current ?? {
        x: activeGame.player.x,
        y: activeGame.player.y,
      };

    if (
      currentVisualPosition.x === nextTile.x &&
      currentVisualPosition.y === nextTile.y
    ) {
      return;
    }

    lastUserInputAtRef.current = Date.now();
    setError(null);
    setOptimisticPlayerPosition({
      x: nextTile.x,
      y: nextTile.y,
    });
    movementTargetRef.current = {
      x: nextTile.x,
      y: nextTile.y,
    };
    scheduleMovementFlush();
  }, [scheduleMovementFlush]);

  const runMovement = useCallback((deltaX: number, deltaY: number) => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current) {
      return;
    }

    const origin = optimisticPlayerRef.current ?? {
      x: activeGame.player.x,
      y: activeGame.player.y,
    };

    void handleMovement(origin.x + deltaX, origin.y + deltaY);
  }, [handleMovement]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!gameRef.current || busyLabelRef.current) {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault();
          void runMovement(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          event.preventDefault();
          void runMovement(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          event.preventDefault();
          void runMovement(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          event.preventDefault();
          void runMovement(1, 0);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runMovement]);

  const loadGame = useCallback(async () => {
    setError(null);
    setBusyLabel("Opening South Quay...");
    const requestId = nextRequestId();

    try {
      const nextGame = await createStreetGame();
      if (movementFlushTimerRef.current) {
        window.clearTimeout(movementFlushTimerRef.current);
        movementFlushTimerRef.current = null;
      }
      movementTargetRef.current = null;
      optimisticPlayerRef.current = null;
      setOptimisticPlayerPosition(null);
      lastUserInputAtRef.current = Date.now();
      applyGameUpdate(nextGame, requestId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not open the district.",
      );
    } finally {
      setBusyLabel(null);
    }
  }, [applyGameUpdate, nextRequestId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  const runWithBusy = useCallback(async (
    label: string,
    callback: () => Promise<void>,
  ): Promise<void> => {
    setError(null);
    setBusyLabel(label);

    try {
      await callback();
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Something in the district failed to update.",
      );
    } finally {
      setBusyLabel(null);
    }
  }, []);

  async function handleAction(actionId: string, label: string) {
    if (!game) {
      return;
    }

    lastUserInputAtRef.current = Date.now();

    const talkNpcId = extractTalkNpcId(actionId);
    if (talkNpcId) {
      await runWithBusy(`${label}...`, async () => {
        const requestId = nextRequestId();
        const nextGame = await actInStreetGame(game.id, actionId);
        applyGameUpdate(nextGame, requestId);
      });
      setConversationNpcId(talkNpcId);
      setIsConversationPanelOpen(false);
      setScenePanelMode("conversation");
      return;
    }

    await runWithBusy(`${label}...`, async () => {
      const requestId = nextRequestId();
      const nextGame = await actInStreetGame(game.id, actionId);
      applyGameUpdate(nextGame, requestId);
    });
  }

  async function handleObjectiveSubmit(rawText: string) {
    if (!game) {
      return;
    }

    const nextObjective = rawText.replace(/\s+/g, " ").trim();
    lastUserInputAtRef.current = Date.now();

    await runWithBusy("Refocusing Rowan...", async () => {
      const requestId = nextRequestId();
      const nextGame = await setStreetObjective(game.id, nextObjective);
      applyGameUpdate(nextGame, requestId);
    });
  }

  const handleAdvanceObjective = useCallback(async (
    label = "Letting Rowan pursue the objective...",
    options: {
      allowTimeSkip?: boolean;
    } = {},
  ) => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current) {
      return;
    }

    const nextConversationNpcId =
      activeGame.activeConversation?.npcId ?? conversationNpcId;
    if (nextConversationNpcId) {
      setConversationTypingState({
        actor: "rowan",
        npcId: nextConversationNpcId,
      });
    }

    try {
      await runWithBusy(label, async () => {
        const requestId = nextRequestId();
        const nextGame = await advanceStreetObjective(activeGame.id, options);
        applyGameUpdate(nextGame, requestId);
      });
    } finally {
      setConversationTypingState((current) =>
        current?.npcId === nextConversationNpcId ? null : current,
      );
    }
  }, [applyGameUpdate, conversationNpcId, nextRequestId, runWithBusy]);
  const handleAdvanceTime = useCallback(async (
    minutes: number,
    label: string,
  ) => {
    const activeGame = gameRef.current;
    if (!activeGame || busyLabelRef.current || minutes <= 0) {
      return;
    }

    lastUserInputAtRef.current = Date.now();

    await runWithBusy(label, async () => {
      const requestId = nextRequestId();
      const nextGame = await waitInStreetGame(activeGame.id, minutes);
      applyGameUpdate(nextGame, requestId);
    });
  }, [applyGameUpdate, nextRequestId, runWithBusy]);
  const handleConversationReplayComplete = useCallback((signature: string) => {
    playedConversationReplaySignaturesRef.current.add(signature);
    setLastConversationReplayCompletedAt(Date.now());
  }, []);

  useEffect(() => {
    if (
      !game?.player.objective ||
      busyLabel ||
      isConversationPanelOpen ||
      hasPendingActiveConversationReplay ||
      hasPendingMovement() ||
      objectiveDraft.replace(/\s+/g, " ").trim() !==
        (game.player.objective?.text ?? "")
    ) {
      return;
    }

    const now = Date.now();
    const isAutoConversationView =
      scenePanelMode === "conversation" && !isConversationPanelOpen;
    const userIdleRemaining = isAutoConversationView
      ? 0
      : AUTO_OBJECTIVE_IDLE_MS - (now - lastUserInputAtRef.current);
    const postConversationBreathRemaining = Math.max(
      0,
      POST_CONVERSATION_BREATH_MS - (now - lastConversationReplayCompletedAt),
    );
    const nextDelay =
      isAutoConversationView && !hasPendingActiveConversationReplay
        ? Math.max(postConversationBreathRemaining, 350)
        : Math.max(
            userIdleRemaining,
            AUTO_OBJECTIVE_COOLDOWN_MS - (now - lastAutoAdvanceAtRef.current),
            hasPendingActiveConversationReplay && game.activeConversation
              ? estimateConversationPlaybackMs(game.activeConversation.lines)
              : 0,
            postConversationBreathRemaining,
            350,
          );

    const timer = window.setTimeout(() => {
      if (
        !gameRef.current?.player.objective ||
        isConversationPanelOpen ||
        hasPendingActiveConversationReplay ||
        hasPendingMovement() ||
        busyLabel
      ) {
        return;
      }

      lastAutoAdvanceAtRef.current = Date.now();
      void handleAdvanceObjective(
        "Rowan reads the block and moves on his own...",
        {
          allowTimeSkip: false,
        },
      );
    }, nextDelay);

    return () => window.clearTimeout(timer);
  }, [
    busyLabel,
    game,
    hasPendingMovement,
    handleAdvanceObjective,
    hasPendingActiveConversationReplay,
    isConversationPanelOpen,
    lastConversationReplayCompletedAt,
    objectiveDraft,
    scenePanelMode,
  ]);

  useEffect(() => {
    if (
      !game ||
      busyLabel ||
      hasPendingMovement() ||
      realtimeSyncInFlightRef.current
    ) {
      return;
    }

    const anchor = clockAnchorRef.current;
    if (!anchor) {
      return;
    }

    const displayedClock = deriveLiveClock(game.clock, anchor, clockNowMs);
    const unsyncedWholeMinutes =
      displayedClock.totalMinutes - game.clock.totalMinutes;

    if (unsyncedWholeMinutes < 1) {
      return;
    }

    realtimeSyncInFlightRef.current = true;
    const requestId = nextRequestId();

    void waitInStreetGame(game.id, unsyncedWholeMinutes, {
      silent: true,
    })
      .then((nextGame) => {
        applyGameUpdate(nextGame, requestId);
      })
      .catch(() => {})
      .finally(() => {
        realtimeSyncInFlightRef.current = false;
      });
  }, [
    applyGameUpdate,
    busyLabel,
    clockNowMs,
    game,
    hasPendingMovement,
    nextRequestId,
  ]);

  useEffect(() => {
    if (isConversationPanelOpen) {
      setScenePanelMode("conversation");
    }
  }, [isConversationPanelOpen]);

  useEffect(() => {
    if (
      activeConversationReplaySignature &&
      activeConversationReplaySignature !== lastAutoOpenedConversationIdRef.current
    ) {
      lastAutoOpenedConversationIdRef.current = activeConversationReplaySignature;
      setScenePanelMode("conversation");
    }

    if (!activeConversationReplaySignature) {
      lastAutoOpenedConversationIdRef.current = null;
    }
  }, [activeConversationReplaySignature]);

  useEffect(() => {
    if (
      isConversationPanelOpen ||
      scenePanelMode !== "conversation" ||
      busyLabel ||
      hasPendingActiveConversationReplay
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setScenePanelMode("scene");
    }, AUTO_SCENE_RETURN_MS);

    return () => window.clearTimeout(timer);
  }, [
    busyLabel,
    hasPendingActiveConversationReplay,
    isConversationPanelOpen,
    scenePanelMode,
  ]);

  if (!game) {
    const loadingMessage = busyLabel ?? "Preparing the district...";

    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl rounded-[32px] border border-[rgba(134,145,154,0.22)] bg-[linear-gradient(180deg,rgba(31,40,46,0.94)_0%,rgba(21,29,34,0.9)_100%)] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.24)] sm:p-10">
          <div className="flex flex-wrap items-center gap-2 text-[0.74rem] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
            <span className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(42,52,59,0.62)] px-3 py-1.5">
              Brackenport
            </span>
            <span className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(42,52,59,0.62)] px-3 py-1.5">
              South Quay
            </span>
          </div>

          <div className="mt-5 font-display text-[2.4rem] leading-[0.96] text-[color:var(--text-main)] sm:text-[2.8rem]">
            Opening the district
          </div>
          <div className="mt-3 max-w-2xl text-[1rem] leading-7 text-[color:var(--text-muted)]">
            One person, one block, one day to start finding a place in the city.
          </div>

          <div className="mt-8 rounded-[26px] border border-[rgba(205,174,115,0.22)] bg-[linear-gradient(180deg,rgba(58,49,35,0.22)_0%,rgba(28,36,42,0.74)_100%)] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-3">
              {error ? (
                <div className="h-3 w-3 rounded-full bg-[rgba(167,105,99,0.92)]" />
              ) : (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(228,191,123,0.28)] border-t-[rgba(228,191,123,0.94)]" />
              )}
              <div className="text-[0.74rem] uppercase tracking-[0.2em] text-[rgba(228,191,123,0.92)]">
                {error ? "Load Interrupted" : "Loading Progress"}
              </div>
            </div>

            <div className="mt-4 text-[1.16rem] leading-8 font-medium text-[color:var(--text-main)]">
              {error ?? loadingMessage}
            </div>

            {!error ? (
              <>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[rgba(73,84,92,0.42)]">
                  <div className="h-full w-[38%] animate-pulse rounded-full bg-[linear-gradient(90deg,rgba(205,174,115,0.78)_0%,rgba(237,228,212,0.96)_100%)]" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <LoadingStage
                    detail="Street layout, buildings, and lanes."
                    label="Building the block"
                  />
                  <LoadingStage
                    detail="People, pressures, and local memory."
                    label="Placing the locals"
                  />
                  <LoadingStage
                    detail="Rowan's first read of the day."
                    label="Waking the scene"
                  />
                </div>
              </>
            ) : null}
          </div>

          {error ? (
            <button
              className="mt-6 rounded-full bg-[color:var(--button-primary)] px-5 py-3 text-[0.95rem] font-medium text-[color:var(--button-primary-text)]"
              onClick={() => {
                void loadGame();
              }}
              type="button"
            >
              Try Again
            </button>
          ) : (
            <div className="mt-4 text-[0.84rem] leading-6 text-[color:var(--text-dim)]">
              This should only take a few seconds.
            </div>
          )}
        </div>
      </main>
    );
  }

  const locationById = new Map(
    game.locations.map((location) => [location.id, location] as const),
  );
  const liveClock = deriveLiveClock(game.clock, clockAnchorRef.current, clockNowMs);
  const liveCurrentTime = isoForTotalMinutes(liveClock.totalMinutes);
  const npcById = new Map(game.npcs.map((npc) => [npc.id, npc] as const));
  const currentObjective =
    game.player.objective?.text ?? "No clear direction yet. Rowan is still reading the block.";
  const currentThought = toFirstPersonText(game.player.currentThought ?? currentObjective);
  const currentSummary = toFirstPersonText(game.summary);
  const activeJob = game.jobs.find(
    (job) =>
      job.id === game.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const activeJobLocation = activeJob
    ? locationById.get(activeJob.locationId)
    : undefined;
  const activeJobWorkAction = activeJob
    ? game.availableActions.find((action) => action.id === `work:${activeJob.id}`)
    : undefined;
  const activeJobDeferredUntilLabel =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > liveClock.totalMinutes
      ? formatClock(isoForTotalMinutes(activeJob.deferredUntilMinutes))
      : undefined;
  const activeJobStartTotalMinutes = activeJob
    ? totalMinutesForDayHour(liveClock.day, activeJob.startHour)
    : undefined;
  const upcomingCommitmentMinutes =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > liveClock.totalMinutes
      ? activeJob.deferredUntilMinutes
      : activeJobStartTotalMinutes !== undefined &&
          activeJobStartTotalMinutes > liveClock.totalMinutes
        ? activeJobStartTotalMinutes
        : undefined;
  const clockAdvanceOptions = buildClockAdvanceOptions({
    currentTotalMinutes: liveClock.totalMinutes,
    upcomingCommitmentMinutes,
  });
  const upcomingCommitmentLabel =
    activeJob?.deferredUntilMinutes !== undefined &&
    activeJob.deferredUntilMinutes > liveClock.totalMinutes
      ? `Deferred until about ${formatClock(
          isoForTotalMinutes(activeJob.deferredUntilMinutes),
        )}.`
      : activeJob &&
          activeJobStartTotalMinutes !== undefined &&
          activeJobStartTotalMinutes > liveClock.totalMinutes
        ? `${activeJob.title} starts at ${formatClock(
            isoForTotalMinutes(activeJobStartTotalMinutes),
          )}.`
        : undefined;
  const headerPreview = buildNarrativePreview(game.player.backstory, 160);
  const currentThoughtPreview = buildNarrativePreview(currentThought, 76);
  const currentSummaryPreview = buildNarrativePreview(currentSummary, 220);
  const activeCommitmentSummary = activeJob
    ? activeJobDeferredUntilLabel
      ? `Deferred until about ${activeJobDeferredUntilLabel}.`
      : `${activeJobLocation?.name ?? "Job site"} • pays $${activeJob.pay} • ${formatJobWindow(
          liveClock.day,
          activeJob.startHour,
          activeJob.endHour,
        )}`
    : undefined;
  const activeCommitmentDetail = activeJob
    ? activeJobDeferredUntilLabel
      ? `I'm still on the hook for this at ${activeJobLocation?.name ?? "the job site"}, but I've pushed it back until about ${activeJobDeferredUntilLabel}.`
      : `I'm committed to this at ${activeJobLocation?.name ?? "the job site"}. It pays $${activeJob.pay}, and the window runs ${formatJobWindow(liveClock.day, activeJob.startHour, activeJob.endHour)}.`
    : undefined;
  const objectiveSuggestions = buildObjectiveSuggestions(game);
  const hasObjectiveChanges =
    objectiveDraft.replace(/\s+/g, " ").trim() !==
    (game.player.objective?.text ?? "");
  const objectivePlanItems =
    game.player.objective?.trail?.length
      ? game.player.objective.trail.map(objectiveTrailStepToPlanItem)
      : buildObjectivePlanItems(game, locationById);
  const objectiveCompletedItems =
    game.player.objective?.completedTrail?.length
      ? game.player.objective.completedTrail
      : buildObjectiveCompletedItems(game, locationById);
  const rememberedPlaces = game.player.knownLocationIds
    .map((locationId) => locationById.get(locationId))
    .filter(isPresent)
    .slice(0, 6);
  const rememberedPeople = game.player.knownNpcIds
    .map((npcId) => npcById.get(npcId))
    .filter(isPresent)
    .slice(0, 4);
  const memoryThreads = buildMemoryThreads(game, locationById);
  const tools = game.player.inventory;
  const primaryPlace =
    (game.player.currentLocationId
      ? locationById.get(game.player.currentLocationId)
      : undefined) ?? rememberedPlaces[0];
  const primaryPerson = rememberedPeople[0];
  const primaryThread = memoryThreads[0];
  const primaryTool = tools[0];
  const extraPlaceNames = rememberedPlaces
    .filter((location) => location.id !== primaryPlace?.id)
    .slice(0, 2)
    .map((location) => location.name);
  const extraPeopleNames = rememberedPeople
    .filter((person) => person.id !== primaryPerson?.id)
    .slice(0, 2)
    .map((person) => person.name);
  const extraThreadTitles = memoryThreads
    .filter((thread) => thread.id !== primaryThread?.id)
    .slice(0, 2)
    .map((thread) => thread.title);
  const extraToolNames = tools
    .filter((item) => item.id !== primaryTool?.id)
    .slice(0, 2)
    .map((item) => item.name);
  const characterProfiles = buildCharacterProfiles({
    game,
    locationById,
    currentThought,
    currentSummary,
    activeCommitmentSummary,
  });
  const selectedCharacter =
    characterProfiles.find((profile) => profile.id === selectedCharacterId) ??
    characterProfiles[0];
  const talkOptions = game.availableActions
    .map((action) => {
      const npcId = extractTalkNpcId(action.id);
      if (!npcId) {
        return undefined;
      }

      return npcById.get(npcId);
    })
    .filter(isPresent);
  const activeConversationNpc =
    (conversationNpcId ? npcById.get(conversationNpcId) : undefined) ??
    talkOptions[0];
  const activeConversationThread = activeConversationNpc
    ? game.conversationThreads?.[activeConversationNpc.id] ??
      buildConversationThreadFallback(game, activeConversationNpc.id)
    : undefined;
  const recentConversation = activeConversationThread?.lines ?? [];
  const sceneConversation = game.activeConversation;
  const latestConversation = game.conversations.at(-1);
  const shouldShowConversationPanel =
    isConversationPanelOpen && talkOptions.length > 0 && Boolean(activeConversationNpc);
  const latestConversationAgeMinutes = latestConversation
    ? minutesBetweenIso(liveCurrentTime, latestConversation.time)
    : Number.POSITIVE_INFINITY;
  const fallbackConversationNpcId =
    latestConversationAgeMinutes <= 35 ? latestConversation?.npcId : undefined;
  const liveMapConversation =
    sceneConversation && hasPendingActiveConversationReplay
      ? sceneConversation
      : null;
  const mapConversationNpcId = liveMapConversation?.npcId;
  const mapConversationEntries = liveMapConversation?.lines;
  const scenePanelConversationNpcId =
    shouldShowConversationPanel
      ? activeConversationNpc?.id
      : sceneConversation?.npcId ?? fallbackConversationNpcId;
  const scenePanelConversationNpc = scenePanelConversationNpcId
    ? npcById.get(scenePanelConversationNpcId)
    : undefined;
  const scenePanelConversationEntries = shouldShowConversationPanel
    ? recentConversation
    : scenePanelConversationNpcId && sceneConversation?.npcId === scenePanelConversationNpcId
      ? sceneConversation.lines
      : scenePanelConversationNpcId
        ? game.conversationThreads?.[scenePanelConversationNpcId]?.lines ??
          buildConversationThreadFallback(game, scenePanelConversationNpcId).lines
        : [];
  const canSpeakToSceneConversationNpc = Boolean(
    scenePanelConversationNpc &&
      talkOptions.some((option) => option.id === scenePanelConversationNpc.id),
  );
  const hasScenePanelConversation = Boolean(
    scenePanelConversationNpc &&
      (scenePanelConversationEntries.length > 0 ||
        canSpeakToSceneConversationNpc ||
        shouldShowConversationPanel),
  );
  const isSceneConversationOpen = Boolean(
    scenePanelMode === "conversation" &&
      hasScenePanelConversation &&
      scenePanelConversationNpc,
  );
  const sceneConversationTypingState =
    scenePanelConversationNpc &&
    conversationTypingState?.npcId === scenePanelConversationNpc.id
      ? conversationTypingState
      : null;
  const sceneConversationBusyLabel =
    busyLabel && sceneConversationTypingState
      ? sceneConversationTypingState.actor === "npc"
        ? `${scenePanelConversationNpc?.name ?? "They"} is typing...`
        : `${game.player.name} is typing...`
      : null;
  const scenePanelConversationReplay =
    sceneConversation && scenePanelConversationNpcId === sceneConversation.npcId
      ? {
          signature: buildConversationReplaySignature(sceneConversation),
          entryIds: sceneConversation.lines.map((entry) => entry.id),
        }
      : null;
  const pendingScenePanelConversationReplay =
    scenePanelConversationReplay &&
    !playedConversationReplaySignaturesRef.current.has(
      scenePanelConversationReplay.signature,
    )
      ? scenePanelConversationReplay
      : null;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
      <div className="mx-auto max-w-[1560px] space-y-5">
        <header className="rounded-[32px] border border-[rgba(134,145,154,0.24)] bg-[linear-gradient(180deg,rgba(31,40,46,0.92)_0%,rgba(24,32,38,0.88)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.24)] sm:px-7 sm:py-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] xl:items-start">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[0.76rem] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
                <span className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(42,52,59,0.62)] px-3 py-1.5">
                  {game.cityName}
                </span>
                <span className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(42,52,59,0.62)] px-3 py-1.5">
                  {game.scenarioName}
                </span>
              </div>
              <div className="font-display text-[2.4rem] leading-[0.96] text-[color:var(--text-main)] sm:text-[2.7rem]">
                {game.player.name} in {game.districtName}
              </div>
              <div className="max-w-3xl text-[0.98rem] leading-7 text-[color:var(--text-muted)]">
                {headerPreview}
              </div>
              <details className="group max-w-3xl rounded-[22px] border border-[rgba(134,145,154,0.18)] bg-[rgba(21,29,34,0.46)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.76rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)] [&::-webkit-details-marker]:hidden">
                  <span>Context & Backstory</span>
                  <span className="rounded-full border border-[rgba(134,145,154,0.18)] bg-[rgba(42,52,59,0.5)] px-2.5 py-1 text-[0.64rem] tracking-[0.16em] text-[color:var(--text-main)]">
                    Expand
                  </span>
                </summary>
                <div className="space-y-3 border-t border-[rgba(134,145,154,0.14)] px-4 py-4">
                  <div className="text-[0.94rem] leading-7 text-[color:var(--text-muted)]">
                    {game.player.backstory}
                  </div>
                  <div className="text-[0.88rem] leading-6 text-[color:var(--text-dim)]">
                    {game.districtNarrative.context}
                  </div>
                  <div className="text-[0.82rem] leading-6 text-[rgba(198,205,209,0.62)]">
                    {game.cityName}: {game.cityNarrative.context}
                  </div>
                </div>
              </details>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatPill label="Day" value={String(liveClock.day)} />
              <TimeStatCard
                busy={Boolean(busyLabel)}
                nextBeatLabel={upcomingCommitmentLabel}
                onAdvance={handleAdvanceTime}
                options={clockAdvanceOptions}
                value={formatClock(liveCurrentTime)}
              />
              <StatPill label="Money" value={`$${game.player.money}`} />
              <StatPill label="Energy" value={String(game.player.energy)} />
            </div>
          </div>

          <div
            className={`mt-5 grid gap-4 ${
              activeJob
                ? "xl:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]"
                : ""
            }`}
          >
            <div className="rounded-[28px] border border-[rgba(205,174,115,0.28)] bg-[linear-gradient(180deg,rgba(58,49,35,0.28)_0%,rgba(39,46,52,0.82)_100%)] px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.18)]">
              <div className="text-[0.74rem] uppercase tracking-[0.22em] text-[rgba(228,191,123,0.92)]">
                Current Thought
              </div>
              <div className="mt-3 max-w-[34ch] text-[1.16rem] leading-7 font-medium text-[color:var(--text-main)] sm:text-[1.24rem]">
                {currentThoughtPreview}
              </div>
              <div className="mt-3 max-w-[92ch] text-[0.92rem] leading-6 text-[color:var(--text-muted)]">
                {currentSummaryPreview}
              </div>
              {currentThoughtPreview !== currentThought ||
              currentSummaryPreview !== currentSummary ? (
                <details className="group mt-3 rounded-[20px] border border-[rgba(205,174,115,0.16)] bg-[rgba(20,28,33,0.28)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(228,191,123,0.92)] [&::-webkit-details-marker]:hidden">
                    <span>Full Read</span>
                    <span className="rounded-full border border-[rgba(205,174,115,0.16)] bg-[rgba(205,174,115,0.08)] px-2.5 py-1 text-[0.62rem] tracking-[0.16em] text-[color:var(--text-main)]">
                      Expand
                    </span>
                  </summary>
                  <div className="border-t border-[rgba(205,174,115,0.12)] px-4 py-4">
                    {currentThoughtPreview !== currentThought ? (
                      <div className="mb-4">
                        <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(228,191,123,0.82)]">
                          Full Thought
                        </div>
                        <div className="mt-2 text-[1rem] leading-7 font-medium text-[color:var(--text-main)]">
                          {currentThought}
                        </div>
                      </div>
                    ) : null}
                    {currentSummaryPreview !== currentSummary ? (
                      <div>
                        <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(228,191,123,0.82)]">
                          Full Read
                        </div>
                        <div className="mt-2 text-[0.93rem] leading-7 text-[color:var(--text-muted)]">
                          {currentSummary}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>

            {activeJob ? (
              <div className="rounded-[24px] border border-[rgba(91,110,124,0.28)] bg-[rgba(27,35,41,0.84)] px-4 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.16)]">
                <div className="flex h-full flex-col gap-4">
                  <div className="min-w-0">
                    <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                      Current Commitment
                    </div>
                    <div className="mt-2 text-[1rem] font-medium text-[color:var(--text-main)] sm:text-[1.06rem]">
                      {activeJob.title}
                    </div>
                    {activeCommitmentSummary ? (
                      <div className="mt-2 text-[0.88rem] leading-6 text-[color:var(--text-muted)]">
                        {activeCommitmentSummary}
                      </div>
                    ) : null}
                    {activeCommitmentDetail &&
                    activeCommitmentSummary !== activeCommitmentDetail ? (
                      <details className="group mt-3 rounded-[18px] border border-[rgba(134,145,154,0.14)] bg-[rgba(20,28,33,0.24)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)] [&::-webkit-details-marker]:hidden">
                          <span>More about this</span>
                          <span className="rounded-full border border-[rgba(134,145,154,0.16)] bg-[rgba(42,52,59,0.46)] px-2.5 py-1 text-[0.6rem] tracking-[0.16em] text-[color:var(--text-main)]">
                            Expand
                          </span>
                        </summary>
                        <div className="border-t border-[rgba(134,145,154,0.12)] px-3 py-3 text-[0.86rem] leading-6 text-[color:var(--text-muted)]">
                          {activeCommitmentDetail}
                        </div>
                      </details>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[rgba(205,174,115,0.32)] bg-[rgba(205,174,115,0.1)] px-4 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-main)] transition hover:bg-[rgba(205,174,115,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={Boolean(busyLabel)}
                      onClick={() => {
                        if (activeJobDeferredUntilLabel) {
                          void handleAction(`resume:${activeJob.id}`, "Picking the shift back up");
                          return;
                        }

                        if (activeJobWorkAction && !activeJobWorkAction.disabled) {
                          void handleAction(activeJobWorkAction.id, activeJobWorkAction.label);
                          return;
                        }

                        void handleAdvanceObjective("Rowan moves on the commitment...", {
                          allowTimeSkip: false,
                        });
                      }}
                      type="button"
                    >
                      {activeJobDeferredUntilLabel
                        ? "Pick It Back Up"
                        : activeJobWorkAction && !activeJobWorkAction.disabled
                          ? "Work Now"
                          : "Go To Shift"}
                    </button>
                    {!activeJobDeferredUntilLabel ? (
                      <button
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.74)] px-4 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-main)] transition hover:bg-[rgba(51,61,68,0.82)] disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={Boolean(busyLabel)}
                        onClick={() => {
                          void handleAction(`defer:${activeJob.id}`, "Deferring the shift");
                        }}
                        type="button"
                      >
                        Defer 1h
                      </button>
                    ) : null}
                    <button
                      className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[rgba(167,105,99,0.28)] bg-[rgba(167,105,99,0.1)] px-4 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-main)] transition hover:bg-[rgba(167,105,99,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={Boolean(busyLabel)}
                      onClick={() => {
                        void handleAction(`abandon:${activeJob.id}`, "Walking away from the shift");
                      }}
                      type="button"
                    >
                      Walk Away
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(167,105,99,0.42)] bg-[rgba(167,105,99,0.14)] px-4 py-3 text-[0.92rem] text-[color:var(--text-main)]">
              {error}
            </div>
          ) : null}
        </header>

        <section className="space-y-5">
          <Panel
            title="Move Through The Block"
            subtitle="Read the scene, then step into the person, job, or problem that matters."
          >
            <div className="space-y-5">
              <div className="relative">
                <DistrictMap
                  activeConversationEntries={mapConversationEntries}
                  activeConversationNpcId={mapConversationNpcId}
                  busy={Boolean(busyLabel)}
                  game={game}
                  onTileClick={(x, y) => {
                    void handleMovement(x, y);
                  }}
                  playerPosition={optimisticPlayerPosition ?? undefined}
                />

                <div className="pointer-events-none absolute right-4 top-4 z-10 hidden w-full max-w-[380px] lg:block">
                  <div className="flex justify-end">
                    <button
                      className="pointer-events-auto inline-flex min-h-[40px] items-center justify-center rounded-full border border-[rgba(134,145,154,0.24)] bg-[rgba(20,28,33,0.86)] px-4 py-2 text-[0.76rem] uppercase tracking-[0.16em] text-[color:var(--text-main)] shadow-[0_16px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-[rgba(28,37,43,0.94)]"
                      onClick={() => {
                        setIsCityOverlayOpen((value) => !value);
                      }}
                      type="button"
                    >
                      {isCityOverlayOpen ? "Hide Scene Panel" : "Show Scene Panel"}
                    </button>
                  </div>

                  {isCityOverlayOpen ? (
                    <div className="pointer-events-auto mt-3 rounded-[28px] border border-[rgba(134,145,154,0.24)] bg-[linear-gradient(180deg,rgba(18,26,31,0.92)_0%,rgba(16,23,28,0.88)_100%)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-md">
                      <div className="space-y-4">
                        {isSceneConversationOpen &&
                        scenePanelConversationNpc ? (
                          <CompactConversationPanel
                            npc={scenePanelConversationNpc}
                            key={scenePanelConversationNpc.id}
                            onBackToScene={() => {
                              setScenePanelMode("scene");
                              setIsConversationPanelOpen(false);
                            }}
                            onSelectNpc={setConversationNpcId}
                            recentConversation={scenePanelConversationEntries}
                            replayEntryIds={
                              pendingScenePanelConversationReplay?.entryIds ?? []
                            }
                            replaySignature={
                              pendingScenePanelConversationReplay?.signature
                            }
                            onReplayComplete={handleConversationReplayComplete}
                            typingState={
                              sceneConversationBusyLabel &&
                              sceneConversationTypingState
                                ? {
                                    actor: sceneConversationTypingState.actor,
                                    label: sceneConversationBusyLabel,
                                  }
                                : null
                            }
                            talkOptions={talkOptions}
                            showBackToScene
                          />
                        ) : (
                          <SceneItemsContent
                            activeConversationNpcName={
                              hasScenePanelConversation
                                ? scenePanelConversationNpc?.name
                                : undefined
                            }
                            actions={game.availableActions}
                            busy={Boolean(busyLabel)}
                            currentScene={game.currentScene}
                            onAction={(actionId, label) => {
                              void handleAction(actionId, label);
                            }}
                            onOpenConversation={() => {
                              setScenePanelMode("conversation");
                              setIsConversationPanelOpen(true);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5 lg:hidden">
                <div className="rounded-[24px] border border-[rgba(134,145,154,0.22)] bg-[rgba(18,26,31,0.88)] px-4 py-4">
                  <div className="space-y-4">
                    {isSceneConversationOpen &&
                    scenePanelConversationNpc ? (
                      <CompactConversationPanel
                        npc={scenePanelConversationNpc}
                        key={scenePanelConversationNpc.id}
                        onBackToScene={() => {
                          setScenePanelMode("scene");
                          setIsConversationPanelOpen(false);
                        }}
                        onSelectNpc={setConversationNpcId}
                        recentConversation={scenePanelConversationEntries}
                        replayEntryIds={
                          pendingScenePanelConversationReplay?.entryIds ?? []
                        }
                        replaySignature={
                          pendingScenePanelConversationReplay?.signature
                        }
                        onReplayComplete={handleConversationReplayComplete}
                        typingState={
                          sceneConversationBusyLabel &&
                          sceneConversationTypingState
                            ? {
                                actor: sceneConversationTypingState.actor,
                                label: sceneConversationBusyLabel,
                              }
                            : null
                        }
                        showBackToScene
                        talkOptions={talkOptions}
                      />
                    ) : (
                      <SceneItemsContent
                        activeConversationNpcName={
                          hasScenePanelConversation
                            ? scenePanelConversationNpc?.name
                            : undefined
                        }
                        actions={game.availableActions}
                        busy={Boolean(busyLabel)}
                        currentScene={game.currentScene}
                        onAction={(actionId, label) => {
                          void handleAction(actionId, label);
                        }}
                        onOpenConversation={() => {
                          setScenePanelMode("conversation");
                          setIsConversationPanelOpen(true);
                        }}
                      />
                    )}
                  </div>
                </div>

              </div>
            </div>
          </Panel>

          <ObjectiveOverridePanel
            busy={Boolean(busyLabel)}
            hasObjectiveChanges={hasObjectiveChanges}
            currentObjective={game.player.objective?.text}
            objectiveDraft={objectiveDraft}
            objectiveSuggestions={objectiveSuggestions}
            onObjectiveChange={setObjectiveDraft}
            onObjectiveSubmit={() => {
              void handleObjectiveSubmit(objectiveDraft);
            }}
            onResetToCurrent={() => {
              setObjectiveDraft(game.player.objective?.text ?? "");
            }}
          />

          <ObjectiveTrail
            checklistItems={objectivePlanItems}
            completedItems={objectiveCompletedItems}
            objectiveText={
              game.player.objective?.text ??
              "No fixed objective yet. Rowan is still reading the block."
            }
            objectiveUpdatedAt={game.player.objective?.updatedAt}
            subtitle="A compact read of what Rowan is actively trying to solve and what he has already managed to pull off."
          />

          <CharacterCardsPanel
            characters={characterProfiles}
            onSelect={setSelectedCharacterId}
            selectedCharacterId={selectedCharacter?.id}
          />

          <Panel
            title="Working Memory"
            subtitle="What's sticking, and what I'm actually using to decide."
            contentClassName="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MindSnapshotCard
                detail={
                  primaryPlace
                    ? buildKnownPlaceDetail(primaryPlace)
                    : "The district is still mostly unmapped in my head."
                }
                label="Places"
                meta={formatMemoryMeta(extraPlaceNames, rememberedPlaces.length)}
                title={primaryPlace?.name ?? "Still getting my bearings"}
              />
              <MindSnapshotCard
                detail={
                  primaryPerson
                    ? buildKnownPersonDetail(primaryPerson)
                    : "No one has become a stable part of my mental map yet."
                }
                label="People"
                meta={formatMemoryMeta(extraPeopleNames, rememberedPeople.length)}
                title={primaryPerson?.name ?? "No one sticking yet"}
              />
              <MindSnapshotCard
                detail={
                  primaryThread
                    ? primaryThread.detail
                    : "No work or local trouble is really sticking yet."
                }
                label="Work & Trouble"
                meta={formatMemoryMeta(extraThreadTitles, memoryThreads.length)}
                title={primaryThread?.title ?? "Nothing urgent yet"}
              />
              <MindSnapshotCard
                detail={cashReadLabel(game.player.money, game.player.energy)}
                label="Cash"
                title={`$${game.player.money} on hand`}
              />
              <MindSnapshotCard
                detail={
                  primaryTool
                    ? primaryTool.description
                    : "No tools yet. I'm still working mostly with time, attention, and what I can afford."
                }
                label="Tools"
                meta={formatMemoryMeta(extraToolNames, tools.length)}
                title={primaryTool?.name ?? "No tools yet"}
              />
            </div>

            <div className="border-t border-[rgba(134,145,154,0.18)] pt-5">
              <div className="mb-3 text-[0.76rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                Journal
              </div>
              <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
                {game.player.memories.length === 0 ? (
                  <MutedLine text="Nothing has stuck yet. I need to walk, talk, or act before my journal starts filling in." />
                ) : (
                  game.player.memories.slice(0, 8).map((memory) => (
                    <LogRow
                      key={memory.id}
                      body={toFirstPersonText(memory.text)}
                      meta={formatClock(memory.time)}
                      tone={memory.kind}
                    />
                  ))
                )}
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function SceneItemsContent({
  activeConversationNpcName,
  busy,
  currentScene,
  actions,
  onAction,
  onOpenConversation,
}: {
  activeConversationNpcName?: string;
  busy: boolean;
  currentScene: StreetGameState["currentScene"];
  actions: StreetGameState["availableActions"];
  onAction: (actionId: string, label: string) => void;
  onOpenConversation: () => void;
}) {
  return (
    <div className="space-y-4">
      {activeConversationNpcName ? (
        <button
          className="w-full rounded-[20px] border border-[rgba(205,174,115,0.24)] bg-[rgba(205,174,115,0.08)] px-4 py-3 text-left transition hover:bg-[rgba(205,174,115,0.12)]"
          onClick={onOpenConversation}
          type="button"
        >
          <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[rgba(228,191,123,0.92)]">
            Conversation Live
          </div>
          <div className="mt-1 text-[0.94rem] leading-6 text-[color:var(--text-main)]">
            Keep talking with {activeConversationNpcName}.
          </div>
        </button>
      ) : null}

      <div className="rounded-[20px] border border-[rgba(134,145,154,0.16)] bg-[rgba(16,22,27,0.72)] px-4 py-4">
        <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
          Here Now
        </div>
        <div className="mt-2 text-[1rem] font-medium text-[color:var(--text-main)]">
          {currentScene.title}
        </div>
        <div className="mt-2 text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
          {currentScene.description}
        </div>
        {currentScene.people.length > 0 ? (
          <div className="mt-3 text-[0.78rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)]">
            With {currentScene.people.map((person) => person.name).join(", ")}
          </div>
        ) : null}
        {currentScene.notes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {currentScene.notes.slice(0, 3).map((note) => (
              <SceneNoteCard
                key={note.id}
                text={note.text}
                tone={note.tone}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
          What You Can Do
        </div>
        <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {actions.length === 0 ? (
            <MutedLine text="Nothing clear is available here. Move, wait, or keep looking." />
          ) : (
            actions.map((action) => (
              <ActionCard
                action={action}
                busy={busy}
                key={action.id}
                onRun={() => {
                  onAction(action.id, action.label);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CharacterCardsPanel({
  characters,
  selectedCharacterId,
  onSelect,
}: {
  characters: CharacterProfile[];
  selectedCharacterId?: string;
  onSelect: (characterId: string) => void;
}) {
  const selectedCharacter =
    characters.find((profile) => profile.id === selectedCharacterId) ??
    characters[0];

  return (
    <Panel
      title="Characters"
      subtitle="A quick read on who Rowan knows, what seems to drive them, and what is sticking about each person."
      contentClassName="space-y-5"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => {
          const selected = character.id === selectedCharacter?.id;

          return (
            <button
              className={`rounded-[24px] border px-4 py-4 text-left transition sm:px-5 ${
                selected
                  ? "border-[rgba(205,174,115,0.34)] bg-[rgba(205,174,115,0.08)] shadow-[0_18px_36px_rgba(0,0,0,0.14)]"
                  : "border-[rgba(134,145,154,0.2)] bg-[rgba(30,39,46,0.74)] hover:bg-[rgba(37,47,54,0.84)]"
              }`}
              key={character.id}
              onClick={() => {
                onSelect(character.id);
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CharacterPortrait
                    characterId={character.id}
                    isPlayer={character.isPlayer}
                    known={character.known ?? true}
                    name={character.name}
                    size="card"
                  />
                  <div className="min-w-0">
                    <div className="text-[1rem] font-medium text-[color:var(--text-main)]">
                      {character.name}
                    </div>
                    <div className="mt-1 text-[0.78rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                      {character.role}
                    </div>
                  </div>
                </div>
                {character.tagLabel ? (
                  <div className="rounded-full border border-[rgba(134,145,154,0.18)] bg-[rgba(41,50,57,0.72)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                    {character.tagLabel}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
                {character.summary}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)]">
                <span>{character.locationLabel}</span>
                <span className="text-[rgba(134,145,154,0.5)]">•</span>
                <span>{character.statusLabel}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCharacter ? (
        <div className="rounded-[26px] border border-[rgba(205,174,115,0.2)] bg-[linear-gradient(180deg,rgba(48,41,31,0.2)_0%,rgba(23,31,36,0.86)_100%)] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <CharacterPortrait
                characterId={selectedCharacter.id}
                isPlayer={selectedCharacter.isPlayer}
                known={selectedCharacter.known ?? true}
                name={selectedCharacter.name}
                size="detail"
              />
              <div>
                <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(228,191,123,0.92)]">
                  Selected Character
                </div>
                <div className="mt-2 text-[1.2rem] font-medium text-[color:var(--text-main)]">
                  {selectedCharacter.name}
                </div>
                <div className="mt-1 text-[0.82rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                  {selectedCharacter.role}
                </div>
              </div>
            </div>
            <div className="rounded-full border border-[rgba(134,145,154,0.18)] bg-[rgba(41,50,57,0.72)] px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--text-main)]">
              {selectedCharacter.statusLabel}
            </div>
          </div>

          <div className="mt-4 text-[0.95rem] leading-7 text-[color:var(--text-main)]">
            {selectedCharacter.summary}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selectedCharacter.sections.map((section) => (
              <div
                className="rounded-[22px] border border-[rgba(134,145,154,0.16)] bg-[rgba(18,25,30,0.66)] px-4 py-4"
                key={`${selectedCharacter.id}-${section.label}`}
              >
                <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  {section.label}
                </div>
                <div className="mt-3 text-[0.92rem] leading-7 text-[color:var(--text-main)]">
                  {section.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

type PortraitAppearance = {
  coat: string;
  accent: string;
  hair: string;
  face: string;
  cheek: string;
  eye: string;
  outline: string;
  hairStyle: "bun" | "scarf" | "cap" | "beard-cap" | "ponytail" | "cropped";
  faceStyle: "soft" | "wry" | "steady" | "stern" | "bright" | "guarded";
  accessory?: "apron" | "shawl" | "satchel" | "vest" | "scarf";
};

function CharacterPortrait({
  characterId,
  name,
  known,
  isPlayer = false,
  size,
}: {
  characterId: string;
  name: string;
  known: boolean;
  isPlayer?: boolean;
  size: "card" | "detail";
}) {
  const sizeClasses =
    size === "detail" ? "h-[84px] w-[84px]" : "h-14 w-14";
  const appearance = isPlayer
    ? playerPortraitAppearance()
    : portraitAppearanceForCharacter(characterId, known);

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[20px] border border-[rgba(134,145,154,0.22)] bg-[radial-gradient(circle_at_50%_28%,rgba(205,174,115,0.14)_0%,rgba(34,43,50,0.94)_70%)] shadow-[0_14px_28px_rgba(0,0,0,0.2)] ${sizeClasses}`}
      title={name}
    >
      <svg
        aria-hidden="true"
        className="h-full w-full"
        viewBox="0 0 64 64"
      >
        <defs>
          <linearGradient id={`portrait-bg-${characterId}`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(63,78,88,0.96)" />
            <stop offset="100%" stopColor="rgba(26,34,40,0.98)" />
          </linearGradient>
        </defs>
        <rect
          fill={`url(#portrait-bg-${characterId})`}
          height="64"
          rx="18"
          width="64"
          x="0"
          y="0"
        />
        <circle cx="32" cy="21" fill="rgba(228,191,123,0.1)" r="20" />
        <path
          d="M 17 56 Q 20 39 32 39 Q 44 39 47 56 L 47 64 L 17 64 Z"
          fill={appearance.coat}
          stroke={appearance.outline}
          strokeWidth="1.4"
        />
        <path
          d="M 24 40 Q 32 34 40 40 L 37 56 L 27 56 Z"
          fill={appearance.accent}
          opacity="0.92"
        />
        {renderPortraitAccessory(appearance)}
        <circle
          cx="32"
          cy="24"
          fill={appearance.face}
          r="11.4"
          stroke={appearance.outline}
          strokeWidth="1.45"
        />
        <circle cx="27.3" cy="27.1" fill={appearance.cheek} r="1.9" />
        <circle cx="36.7" cy="27.1" fill={appearance.cheek} r="1.9" />
        {renderPortraitHair(appearance)}
        {renderPortraitFace(appearance)}
      </svg>
    </div>
  );
}

function ObjectiveOverridePanel({
  currentObjective,
  objectiveDraft,
  objectiveSuggestions,
  hasObjectiveChanges,
  busy,
  onObjectiveChange,
  onObjectiveSubmit,
  onResetToCurrent,
}: {
  currentObjective?: string;
  objectiveDraft: string;
  objectiveSuggestions: string[];
  hasObjectiveChanges: boolean;
  busy: boolean;
  onObjectiveChange: (text: string) => void;
  onObjectiveSubmit: () => void;
  onResetToCurrent: () => void;
}) {
  const currentObjectiveText =
    currentObjective?.trim() ||
    "Rowan is still feeling out the block without a clear stated objective.";

  return (
    <Panel
      title="Objective Override"
      subtitle="Only step in here if you want to replace the objective Rowan is currently following."
    >
      <details className="group rounded-[24px] border border-[rgba(134,145,154,0.2)] bg-[rgba(18,25,30,0.72)] [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              Override Only
            </div>
            <div className="mt-1 text-[0.96rem] leading-6 text-[color:var(--text-main)]">
              Rowan already has a direction. Open this only if you want to push him onto a different one.
            </div>
          </div>
          <div className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.74)] px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-main)]">
            Open
          </div>
        </summary>

        <div className="space-y-5 border-t border-[rgba(134,145,154,0.16)] px-4 py-4 sm:px-5">
          <div className="rounded-[22px] border border-[rgba(205,174,115,0.18)] bg-[rgba(205,174,115,0.08)] px-4 py-4">
            <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(228,191,123,0.92)]">
              Rowan Is Currently Working Through
            </div>
            <div className="mt-3 text-[1rem] leading-7 text-[color:var(--text-main)]">
              {currentObjectiveText}
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onObjectiveSubmit();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-[0.76rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                Override With A New Objective
              </span>
              <textarea
                className="min-h-[118px] w-full rounded-[24px] border border-[rgba(134,145,154,0.24)] bg-[rgba(22,29,34,0.62)] px-4 py-4 text-[1rem] leading-7 text-[color:var(--text-main)] outline-none transition placeholder:text-[rgba(198,205,209,0.42)] focus:border-[rgba(228,191,123,0.55)] focus:bg-[rgba(22,29,34,0.78)]"
                disabled={busy}
                maxLength={80}
                onChange={(event) => {
                  onObjectiveChange(event.target.value);
                }}
                placeholder="If you want Rowan to change course, say it plainly here."
                value={objectiveDraft}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {objectiveSuggestions.map((suggestion) => (
                <button
                  className="rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(45,55,61,0.6)] px-3 py-1.5 text-[0.76rem] uppercase tracking-[0.14em] text-[color:var(--text-main)] transition hover:bg-[rgba(56,67,73,0.82)]"
                  key={suggestion}
                  onClick={() => {
                    onObjectiveChange(suggestion);
                  }}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[color:var(--button-primary)] px-5 py-2 text-[0.84rem] font-medium uppercase tracking-[0.16em] text-[color:var(--button-primary-text)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={busy || !hasObjectiveChanges}
                type="submit"
              >
                Override Objective
              </button>
              <button
                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.74)] px-5 py-2 text-[0.8rem] uppercase tracking-[0.18em] text-[color:var(--text-main)] transition hover:bg-[rgba(51,61,68,0.82)] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={busy || !hasObjectiveChanges}
                onClick={onResetToCurrent}
                type="button"
              >
                Use Current Objective
              </button>
            </div>
          </form>
        </div>
      </details>
    </Panel>
  );
}

function TimeStatCard({
  value,
  options,
  nextBeatLabel,
  busy,
  onAdvance,
}: {
  value: string;
  options: ClockAdvanceOption[];
  nextBeatLabel?: string;
  busy: boolean;
  onAdvance: (minutes: number, label: string) => void;
}) {
  return (
    <details className="group rounded-[22px] border border-[rgba(134,145,154,0.2)] bg-[linear-gradient(180deg,rgba(43,53,60,0.82)_0%,rgba(34,43,50,0.74)_100%)]">
      <summary className="flex min-h-[88px] cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="text-[0.72rem] uppercase tracking-[0.2em] text-[color:var(--text-dim)]">
            Time
          </div>
          <div className="mt-3 text-[1.06rem] leading-5 font-medium text-[color:var(--text-main)] sm:text-[1.12rem]">
            {value}
          </div>
          <div className="mt-2 text-[0.76rem] leading-5 text-[color:var(--text-dim)]">
            Forward only
          </div>
        </div>
        <span className="rounded-full border border-[rgba(134,145,154,0.18)] bg-[rgba(42,52,59,0.5)] px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--text-main)]">
          Advance
        </span>
      </summary>

      <div className="space-y-3 border-t border-[rgba(134,145,154,0.14)] px-4 py-3">
        <div className="text-[0.82rem] leading-6 text-[color:var(--text-muted)]">
          {nextBeatLabel ??
            "Move time forward when Rowan is waiting on the next useful beat."}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              className={`inline-flex min-h-[36px] items-center justify-center rounded-full border px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-55 ${
                option.kind === "target"
                  ? "border-[rgba(205,174,115,0.32)] bg-[rgba(205,174,115,0.1)] text-[color:var(--text-main)] hover:bg-[rgba(205,174,115,0.16)]"
                  : "border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.74)] text-[color:var(--text-main)] hover:bg-[rgba(51,61,68,0.82)]"
              }`}
              disabled={busy}
              key={option.key}
              onClick={() => {
                void onAdvance(option.minutes, option.busyLabel);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function extractTalkNpcId(actionId: string) {
  const [kind, targetId] = actionId.split(":");
  return kind === "talk" && targetId ? targetId : undefined;
}

function CompactConversationPanel({
  npc,
  talkOptions,
  recentConversation,
  decision,
  onSelectNpc,
  onBackToScene,
  showBackToScene = false,
  typingState,
  replaySignature,
  replayEntryIds = [],
  onReplayComplete,
}: {
  npc: NpcState;
  talkOptions: NpcState[];
  recentConversation: StreetGameState["conversations"];
  decision?: string;
  onSelectNpc: (npcId: string) => void;
  onBackToScene?: () => void;
  showBackToScene?: boolean;
  typingState?: {
    actor: "rowan" | "npc";
    label: string;
  } | null;
  replaySignature?: string;
  replayEntryIds?: string[];
  onReplayComplete?: (signature: string) => void;
}) {
  const npcInitials = initialsForName(npc.name);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const appliedReplaySignatureRef = useRef<string | null>(replaySignature ?? null);
  const initialReplayEntryIds =
    replaySignature && replayEntryIds.length > 0 ? replayEntryIds : [];
  const queuedEntryIdsRef = useRef<Set<string>>(new Set(initialReplayEntryIds));
  const [revealedEntryIds, setRevealedEntryIds] = useState<string[]>(() =>
    recentConversation
      .filter((entry) => !initialReplayEntryIds.includes(entry.id))
      .map((entry) => entry.id),
  );
  const [streamQueue, setStreamQueue] = useState<string[]>(initialReplayEntryIds);
  const [streamingEntryId, setStreamingEntryId] = useState<string | null>(null);
  const [streamedWordCount, setStreamedWordCount] = useState(0);
  const [streamPauseActor, setStreamPauseActor] = useState<
    "rowan" | "npc" | null
  >(null);
  const [isReplayingConversation, setIsReplayingConversation] = useState(
    initialReplayEntryIds.length > 0,
  );
  const revealedEntryIdSet = new Set(revealedEntryIds);

  useEffect(() => {
    if (
      !replaySignature ||
      replayEntryIds.length === 0 ||
      replaySignature === appliedReplaySignatureRef.current
    ) {
      return;
    }

    appliedReplaySignatureRef.current = replaySignature;
    queuedEntryIdsRef.current = new Set(replayEntryIds);

    const replayBaseRevealed = recentConversation
      .filter((entry) => !replayEntryIds.includes(entry.id))
      .map((entry) => entry.id);

    const timer = window.setTimeout(() => {
      setRevealedEntryIds(replayBaseRevealed);
      setStreamQueue(replayEntryIds);
      setStreamingEntryId(null);
      setStreamedWordCount(0);
      setStreamPauseActor(null);
      setIsReplayingConversation(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [recentConversation, replayEntryIds, replaySignature]);

  useEffect(() => {
    const revealedEntryIdsLookup = new Set(revealedEntryIds);
    const nextQueuedIds = recentConversation
      .filter(
        (entry) =>
          !revealedEntryIdsLookup.has(entry.id) &&
          !queuedEntryIdsRef.current.has(entry.id) &&
          entry.id !== streamingEntryId,
      )
      .map((entry) => entry.id);

    if (nextQueuedIds.length === 0) {
      return;
    }

    for (const entryId of nextQueuedIds) {
      queuedEntryIdsRef.current.add(entryId);
    }

    setStreamQueue((current) => [...current, ...nextQueuedIds]);
  }, [recentConversation, revealedEntryIds, streamingEntryId]);

  useEffect(() => {
    if (streamingEntryId || streamQueue.length === 0) {
      return;
    }

    const [nextEntryId, ...remainingEntryIds] = streamQueue;
    const nextEntry = nextEntryId
      ? recentConversation.find((entry) => entry.id === nextEntryId)
      : undefined;
    const previousSpeaker = nextEntryId
      ? findPreviousConversationSpeaker(recentConversation, nextEntryId)
      : undefined;
    const startDelay = conversationEntryStartDelayMs(
      previousSpeaker,
      nextEntry?.speaker,
    );
    const nextPauseActor =
      nextEntry && startDelay > 0
        ? conversationActorForSpeaker(nextEntry.speaker)
        : null;

    const pauseTimer =
      nextPauseActor !== null
        ? window.setTimeout(() => {
            setStreamPauseActor(nextPauseActor);
          }, 0)
        : null;

    const timer = window.setTimeout(() => {
      if (!nextEntryId) {
        return;
      }

      queuedEntryIdsRef.current.delete(nextEntryId);
      setStreamQueue(remainingEntryIds);
      setStreamingEntryId(nextEntryId);
      setStreamedWordCount(1);
      setStreamPauseActor(null);
    }, startDelay);

    return () => {
      if (pauseTimer !== null) {
        window.clearTimeout(pauseTimer);
      }
      window.clearTimeout(timer);
    };
  }, [recentConversation, streamQueue, streamingEntryId]);

  const streamingEntry = streamingEntryId
    ? recentConversation.find((entry) => entry.id === streamingEntryId)
    : undefined;

  useEffect(() => {
    if (!streamingEntry) {
      return;
    }

    const totalWords = splitConversationStreamWords(streamingEntry.text).length;
    if (totalWords <= 1 || streamedWordCount >= totalWords) {
      const timer = window.setTimeout(() => {
        setRevealedEntryIds((current) =>
          current.includes(streamingEntry.id)
            ? current
            : [...current, streamingEntry.id],
        );
        setStreamingEntryId(null);
        setStreamedWordCount(0);
      }, CONVERSATION_STREAM_ENTRY_SETTLE_MS);

      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setStreamedWordCount((current) =>
        Math.min(totalWords, current + 1),
      );
    }, conversationStreamDelayMs(streamingEntry.speaker, streamedWordCount));

    return () => window.clearTimeout(timer);
  }, [streamedWordCount, streamingEntry]);

  useEffect(() => {
    if (!isReplayingConversation || !replaySignature) {
      return;
    }

    const revealedEntryIdsLookup = new Set(revealedEntryIds);
    const hasPendingReplayEntry = replayEntryIds.some(
      (entryId) =>
        streamQueue.includes(entryId) ||
        streamingEntryId === entryId ||
        !revealedEntryIdsLookup.has(entryId),
    );

    if (hasPendingReplayEntry || streamPauseActor) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsReplayingConversation(false);
      onReplayComplete?.(replaySignature);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    isReplayingConversation,
    onReplayComplete,
    replayEntryIds,
    replaySignature,
    revealedEntryIds,
    streamPauseActor,
    streamQueue,
    streamingEntryId,
  ]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) {
      return;
    }

    transcript.scrollTop = transcript.scrollHeight;
  }, [
    recentConversation.length,
    revealedEntryIds.length,
    streamedWordCount,
    streamingEntryId,
    streamPauseActor,
    typingState,
  ]);

  const effectiveTypingState =
    typingState ??
    (streamPauseActor
      ? {
          actor: streamPauseActor,
          label:
            streamPauseActor === "npc"
              ? `${npc.name} is replying...`
              : "Rowan is replying...",
        }
      : null);
  const visibleConversationEntries = recentConversation
    .slice(-6)
    .filter(
      (entry) =>
        revealedEntryIdSet.has(entry.id) || entry.id === streamingEntryId,
    );
  const isTranscriptInMotion =
    Boolean(typingState) ||
    Boolean(streamPauseActor) ||
    Boolean(streamingEntryId) ||
    streamQueue.length > 0 ||
    isReplayingConversation;

  return (
    <div className="rounded-[22px] border border-[rgba(205,174,115,0.22)] bg-[rgba(14,20,24,0.92)] px-3 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.22)] sm:px-4 sm:py-4">
      <div className="flex items-start gap-3">
        {showBackToScene && onBackToScene ? (
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(33,41,47,0.7)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--text-main)] transition hover:bg-[rgba(43,52,58,0.84)]"
            onClick={onBackToScene}
            type="button"
          >
            <span aria-hidden="true" className="text-[0.9rem] leading-none">
              ‹
            </span>
            Back
          </button>
        ) : null}

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(134,145,154,0.22)] bg-[rgba(41,50,57,0.82)] text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-main)]">
            {npcInitials}
          </div>
          <div className="min-w-0">
            <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[rgba(228,191,123,0.92)]">
              Conversation
            </div>
            <div className="mt-1 text-[1rem] font-medium text-[color:var(--text-main)]">
              {npc.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.84rem] leading-5 text-[color:var(--text-muted)]">
              <span className="min-w-0 truncate">
                {npc.role}. {npc.currentConcern}
              </span>
              {isTranscriptInMotion ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(205,174,115,0.22)] bg-[rgba(205,174,115,0.08)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-[rgba(228,191,123,0.92)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(228,191,123,0.96)]" />
                  Live
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {decision && !isTranscriptInMotion ? (
        <div className="mt-3 rounded-[18px] border border-[rgba(205,174,115,0.22)] bg-[rgba(205,174,115,0.08)] px-4 py-3">
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[rgba(228,191,123,0.92)]">
            Conversation Outcome
          </div>
          <div className="mt-2 text-[0.9rem] leading-6 text-[color:var(--text-main)]">
            {decision}
          </div>
        </div>
      ) : null}

      {talkOptions.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {talkOptions.map((option) => (
            <button
              className={`rounded-full border px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] transition ${
                option.id === npc.id
                  ? "border-[rgba(205,174,115,0.4)] bg-[rgba(205,174,115,0.14)] text-[color:var(--text-main)]"
                  : "border-[rgba(134,145,154,0.22)] bg-[rgba(45,55,61,0.6)] text-[color:var(--text-main)] hover:bg-[rgba(56,67,73,0.82)]"
              }`}
              key={option.id}
              onClick={() => {
                onSelectNpc(option.id);
              }}
              type="button"
            >
              {option.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 rounded-[22px] border border-[rgba(134,145,154,0.16)] bg-[linear-gradient(180deg,rgba(20,28,33,0.96)_0%,rgba(12,18,22,0.98)_100%)]">
        <div
          className="max-h-[68vh] min-h-[420px] space-y-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
          ref={transcriptRef}
        >
          {recentConversation.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[rgba(117,128,137,0.22)] px-4 py-4 text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
              {npc.name} is here, but Rowan has not stepped into the conversation yet.
            </div>
          ) : (
            visibleConversationEntries.map((entry) => {
              const isPlayer = entry.speaker === "player";
              const displayText =
                entry.id === streamingEntryId
                  ? revealConversationText(entry.text, streamedWordCount)
                  : entry.text;

              return (
                <div
                  className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
                  key={entry.id}
                >
                  <div
                    className={`flex max-w-[88%] items-end gap-2 ${
                      isPlayer ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!isPlayer ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(56,66,73,0.9)] text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                        {npcInitials}
                      </div>
                    ) : null}
                    <div>
                      <div
                        className={`px-4 py-2.5 text-[0.92rem] leading-6 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
                          isPlayer
                            ? "rounded-[22px] rounded-br-[8px] bg-[linear-gradient(180deg,#2f95ff_0%,#0a84ff_100%)] text-white"
                            : "rounded-[22px] rounded-bl-[8px] border border-[rgba(134,145,154,0.18)] bg-[rgba(51,60,67,0.92)] text-[color:var(--text-main)]"
                        }`}
                      >
                        {displayText}
                        {entry.id === streamingEntryId ? (
                          <span className="ml-1 inline-block h-[1.05em] w-[0.5ch] animate-pulse rounded-full bg-[rgba(237,228,212,0.78)] align-[-0.12em]" />
                        ) : null}
                      </div>
                      <div
                        className={`mt-1 px-1 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)] ${
                          isPlayer ? "text-right" : "text-left"
                        }`}
                      >
                        {isPlayer ? "Rowan" : entry.speakerName} • {formatClock(entry.time)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {effectiveTypingState ? (
            <div
              className={`flex ${
                effectiveTypingState.actor === "rowan"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`flex max-w-[88%] items-end gap-2 ${
                  effectiveTypingState.actor === "rowan" ? "flex-row-reverse" : ""
                }`}
              >
                {effectiveTypingState.actor === "npc" ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(56,66,73,0.9)] text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                    {npcInitials}
                  </div>
                ) : null}
                <div>
                  <div
                    className={`px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
                      effectiveTypingState.actor === "rowan"
                        ? "rounded-[22px] rounded-br-[8px] bg-[linear-gradient(180deg,#2f95ff_0%,#0a84ff_100%)]"
                        : "rounded-[22px] rounded-bl-[8px] border border-[rgba(134,145,154,0.18)] bg-[rgba(51,60,67,0.92)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[rgba(237,228,212,0.94)] [animation-delay:-0.24s]" />
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[rgba(237,228,212,0.94)] [animation-delay:-0.12s]" />
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[rgba(237,228,212,0.94)]" />
                    </div>
                  </div>
                  <div
                    className={`mt-1 px-1 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)] ${
                      effectiveTypingState.actor === "rowan"
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {effectiveTypingState.label}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildObjectiveSuggestions(game: StreetGameState) {
  const suggestions = new Set<string>();
  const activeJob = game.jobs.find(
    (job) => job.id === game.player.activeJobId && !job.completed,
  );
  const pumpProblem = game.problems.find((problem) => problem.id === "problem-pump");
  const cartProblem = game.problems.find((problem) => problem.id === "problem-cart");
  const hasWrench = game.player.inventory.some((item) => item.id === "item-wrench");
  const spokenNpcCount = new Set(
    game.conversations
      .filter((entry) => entry.speaker === "player")
      .map((entry) => entry.npcId),
  ).size;

  if (spokenNpcCount < game.npcs.length) {
    suggestions.add("Make the rounds and talk to everyone.");
  }

  if (activeJob) {
    suggestions.add(`Finish ${activeJob.title.toLowerCase()}.`);
  }

  if (pumpProblem?.discovered && pumpProblem.status === "active" && !hasWrench) {
    suggestions.add("Buy a wrench and fix the pump.");
  } else if (pumpProblem?.discovered && pumpProblem.status === "active") {
    suggestions.add("Fix the pump in Morrow Yard.");
  }

  if (cartProblem?.discovered && cartProblem.status === "active") {
    suggestions.add("Clear the jammed cart in the square.");
  }

  if (game.player.money < 18) {
    suggestions.add("Find steady income before tonight.");
  }

  if ((game.player.reputation.morrow_house ?? 0) < 2) {
    suggestions.add("Figure out where I can stay beyond tonight.");
  }

  if (game.player.knownLocationIds.length < 4) {
    suggestions.add("Learn the lanes and meet people.");
  }

  if (game.player.knownNpcIds.length < 3) {
    suggestions.add("Meet people who could become friends in South Quay.");
  }

  if (game.player.energy < 38) {
    suggestions.add("Get somewhere quiet and recover.");
  }

  suggestions.add("Get settled in Brackenport.");

  return Array.from(suggestions).slice(0, 5);
}

function buildMemoryThreads(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
) {
  const visibleJobs = game.jobs
    .filter((job) => job.accepted || job.discovered || job.completed || job.missed)
    .map((job) => ({
      id: job.id,
      title: job.title,
      detail: buildJobMemoryDetail(job, locationById.get(job.locationId)?.name),
      priority: job.accepted ? 4 : job.discovered ? 3 : job.completed ? 2 : 1,
    }));

  const visibleProblems = game.problems
    .filter((problem) => problem.discovered)
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      detail: buildProblemMemoryDetail(
        problem,
        locationById.get(problem.locationId)?.name,
      ),
      priority:
        problem.status === "active"
          ? 5
          : problem.status === "solved"
            ? 2
            : problem.status === "expired"
              ? 1
              : 0,
    }));

  return [...visibleProblems, ...visibleJobs]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);
}

function cashReadLabel(money: number, energy: number) {
  if (money < 8) {
    return "Cash is tight enough that my next useful move probably needs to pay.";
  }

  if (money < 20 && energy < 40) {
    return "I can act, but I do not have enough room to waste a tired step.";
  }

  if (money < 20) {
    return "I have enough for one modest purchase or a little breathing room.";
  }

  if (energy < 40) {
    return "I can cover a need with money, but I do not have the energy to brute-force the day.";
  }

  return "I have enough cash on hand to solve a problem instead of only chasing coin.";
}

function formatMemoryMeta(items: string[], total: number) {
  if (total <= 1 || items.length === 0) {
    return undefined;
  }

  const remaining = total - 1 - items.length;
  const base = items.join(" • ");

  if (remaining > 0) {
    return `${base} • +${remaining} more`;
  }

  return base;
}

function buildNarrativePreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const firstSentenceBreak = normalized.indexOf(". ");
  if (firstSentenceBreak !== -1 && firstSentenceBreak + 1 <= maxLength) {
    return normalized.slice(0, firstSentenceBreak + 1).trim();
  }

  const clipped = normalized.slice(0, maxLength).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > Math.floor(maxLength * 0.55)
    ? clipped.slice(0, lastSpace)
    : clipped;

  return `${base.trimEnd()}...`;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function buildConversationThreadFallback(
  game: StreetGameState,
  npcId: string,
) {
  const lines = game.conversations
    .filter((entry) => entry.npcId === npcId)
    .slice(-12);

  return {
    id: `conversation-thread-${npcId}`,
    npcId,
    updatedAt: game.currentTime,
    lines,
  };
}

function buildKnownPlaceDetail(
  location: StreetGameState["locations"][number],
) {
  return `I know this as a ${location.type} in ${location.neighborhood}. ${location.context}`;
}

function buildKnownPersonDetail(person: StreetGameState["npcs"][number]) {
  const roleWithArticle = /^[aeiou]/i.test(person.role)
    ? `an ${person.role}`
    : `a ${person.role}`;
  const roleLine = `I know ${person.name} as ${roleWithArticle}.`;

  if (person.currentThought) {
    return `${roleLine} ${toFirstPersonText(person.currentThought)}`;
  }

  return `${roleLine} I remember that ${person.name} ${lowercaseFirst(trimPeriod(person.summary))}.`;
}

function buildCharacterProfiles({
  game,
  locationById,
  currentThought,
  currentSummary,
  activeCommitmentSummary,
}: {
  game: StreetGameState;
  locationById: Map<string, StreetGameState["locations"][number]>;
  currentThought: string;
  currentSummary: string;
  activeCommitmentSummary?: string;
}): CharacterProfile[] {
  const playerLocation =
    (game.player.currentLocationId
      ? locationById.get(game.player.currentLocationId)
      : undefined) ?? game.locations[0];
  const playerSections: CharacterProfileSection[] = [
    {
      label: "Backstory",
      value: game.player.backstory,
    },
    {
      label: "Current Objective",
      value:
        game.player.objective?.text ??
        "Rowan is still moving by feel without one fixed objective yet.",
    },
    {
      label: "Current Thought",
      value: currentThought,
    },
    {
      label: "What This Means Right Now",
      value: activeCommitmentSummary
        ? `${currentSummary} ${activeCommitmentSummary}`
        : currentSummary,
    },
  ];

  const profiles: CharacterProfile[] = [
    {
      id: "player",
      name: game.player.name,
      role: "new arrival",
      summary: buildNarrativePreview(game.player.backstory, 170),
      locationLabel: `At ${playerLocation?.name ?? "the street"}`,
      statusLabel:
        game.player.objective?.progress?.label ??
        `${game.player.knownNpcIds.length} people known`,
      tagLabel: "You",
      known: true,
      isPlayer: true,
      sections: playerSections,
    },
  ];

  for (const npc of game.npcs) {
    const location =
      locationById.get(npc.currentLocationId)?.name ?? "Somewhere in South Quay";
    const visibleNow = npc.currentLocationId === game.player.currentLocationId;
    const statusLabel = visibleNow
      ? "Here now"
      : npc.known
        ? "Known"
        : "Still distant";
    const narrativeBackstory =
      npc.narrative.backstory || npc.summary || `${npc.name} is still mostly a first impression.`;
    const objectiveRead =
      npc.currentObjective ||
      npc.narrative.objective ||
      "You do not yet have a clear read on what they are trying to get done.";
    const concernRead =
      npc.currentConcern ||
      npc.narrative.context ||
      "They still feel hard to read beyond the surface.";
    const memoryRead =
      npc.memory[0] ||
      npc.lastSpokenLine ||
      npc.currentThought ||
      `Nothing specific has stuck about ${npc.name} yet beyond the first impression.`;

    profiles.push({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      summary: buildNarrativePreview(
        npc.summary || `${npc.name} is still more role than person in Rowan's head.`,
        170,
      ),
      locationLabel: `At ${location}`,
      statusLabel,
      tagLabel: visibleNow ? "In scene" : npc.known ? "Known" : "Stranger",
      known: npc.known || visibleNow,
      sections: [
        {
          label: "Backstory",
          value: narrativeBackstory,
        },
        {
          label: "Objective",
          value: objectiveRead,
        },
        {
          label: "Current Concern",
          value: concernRead,
        },
        {
          label: "What Sticks",
          value: memoryRead,
        },
      ],
    });
  }

  return profiles;
}

function playerPortraitAppearance(): PortraitAppearance {
  return {
    coat: "rgba(191,152,93,0.98)",
    accent: "rgba(235,214,175,0.9)",
    hair: "rgba(122,91,55,0.98)",
    face: "rgba(245,235,219,0.98)",
    cheek: "rgba(223,179,160,0.35)",
    eye: "rgba(41,33,27,0.94)",
    outline: "rgba(250,239,219,0.7)",
    hairStyle: "cap",
    faceStyle: "steady",
    accessory: "satchel",
  };
}

function portraitAppearanceForCharacter(
  characterId: string,
  known: boolean,
): PortraitAppearance {
  const muted = !known;

  switch (characterId) {
    case "npc-mara":
      return {
        coat: muted ? "rgba(111,103,90,0.95)" : "rgba(131,112,88,0.98)",
        accent: muted ? "rgba(183,174,162,0.78)" : "rgba(219,206,183,0.92)",
        hair: muted ? "rgba(95,94,88,0.96)" : "rgba(124,121,111,0.98)",
        face: "rgba(191,132,102,0.98)",
        cheek: "rgba(223,170,150,0.34)",
        eye: "rgba(66,45,31,0.92)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "bun",
        faceStyle: "soft",
        accessory: "apron",
      };
    case "npc-ada":
      return {
        coat: muted ? "rgba(98,111,112,0.95)" : "rgba(86,119,118,0.98)",
        accent: muted ? "rgba(177,166,155,0.8)" : "rgba(220,191,160,0.92)",
        hair: muted ? "rgba(88,79,71,0.94)" : "rgba(109,71,48,0.98)",
        face: "rgba(228,187,153,0.98)",
        cheek: "rgba(231,189,169,0.28)",
        eye: "rgba(60,41,28,0.92)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "scarf",
        faceStyle: "wry",
        accessory: "shawl",
      };
    case "npc-jo":
      return {
        coat: muted ? "rgba(95,104,109,0.96)" : "rgba(89,103,113,0.98)",
        accent: muted ? "rgba(148,158,165,0.78)" : "rgba(178,190,198,0.88)",
        hair: muted ? "rgba(72,78,83,0.95)" : "rgba(59,64,67,0.98)",
        face: "rgba(159,108,84,0.98)",
        cheek: "rgba(196,141,121,0.22)",
        eye: "rgba(40,33,28,0.92)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "cap",
        faceStyle: "steady",
        accessory: "satchel",
      };
    case "npc-tomas":
      return {
        coat: muted ? "rgba(106,100,84,0.95)" : "rgba(119,104,74,0.98)",
        accent: muted ? "rgba(160,155,141,0.76)" : "rgba(190,176,133,0.9)",
        hair: muted ? "rgba(56,52,46,0.96)" : "rgba(41,36,32,0.98)",
        face: "rgba(104,69,49,0.99)",
        cheek: "rgba(163,108,86,0.18)",
        eye: "rgba(22,18,14,0.94)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "beard-cap",
        faceStyle: "stern",
        accessory: "vest",
      };
    case "npc-nia":
      return {
        coat: muted ? "rgba(90,107,99,0.95)" : "rgba(79,131,112,0.98)",
        accent: muted ? "rgba(167,180,166,0.78)" : "rgba(192,218,175,0.9)",
        hair: muted ? "rgba(72,58,45,0.95)" : "rgba(98,69,46,0.98)",
        face: "rgba(207,146,108,0.99)",
        cheek: "rgba(233,180,146,0.28)",
        eye: "rgba(56,35,22,0.92)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "ponytail",
        faceStyle: "bright",
        accessory: "scarf",
      };
    default:
      return {
        coat: muted ? "rgba(100,104,108,0.96)" : "rgba(110,100,82,0.98)",
        accent: muted ? "rgba(164,170,176,0.84)" : "rgba(196,178,143,0.9)",
        hair: muted ? "rgba(82,88,94,0.95)" : "rgba(67,57,45,0.98)",
        face: "rgba(205,158,121,0.98)",
        cheek: "rgba(222,176,159,0.3)",
        eye: "rgba(49,39,30,0.92)",
        outline: "rgba(19,24,28,0.9)",
        hairStyle: "cropped",
        faceStyle: "guarded",
      };
  }
}

function renderPortraitAccessory(appearance: PortraitAppearance) {
  switch (appearance.accessory) {
    case "apron":
      return (
        <path
          d="M 28 38 L 36 38 L 35 55 L 29 55 Z"
          fill="rgba(233,222,202,0.78)"
        />
      );
    case "shawl":
      return (
        <path
          d="M 21 38 Q 32 31 43 38 L 39 41 Q 32 39.5 25 41 Z"
          fill="rgba(208,183,147,0.88)"
          opacity="0.9"
        />
      );
    case "satchel":
      return (
        <>
          <path
            d="M 38 35 Q 34 40 34 55"
            fill="none"
            stroke="rgba(67,51,36,0.86)"
            strokeLinecap="round"
            strokeWidth="1.2"
          />
          <rect
            x="32"
            y="45"
            width="5"
            height="5"
            rx="1.4"
            fill="rgba(106,78,54,0.95)"
          />
        </>
      );
    case "vest":
      return (
        <path
          d="M 24 38 L 29 38 L 30 56 L 25 56 Z M 35 38 L 40 38 L 39 56 L 34 56 Z"
          fill="rgba(78,58,39,0.64)"
        />
      );
    case "scarf":
      return (
        <>
          <path
            d="M 23 38 Q 32 34 41 38 Q 37 41 32 41 Q 27 41 23 38 Z"
            fill="rgba(222,193,152,0.9)"
          />
          <path
            d="M 38 41 L 42 47"
            fill="none"
            stroke="rgba(222,193,152,0.9)"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </>
      );
    default:
      return null;
  }
}

function renderPortraitHair(appearance: PortraitAppearance) {
  switch (appearance.hairStyle) {
    case "bun":
      return (
        <>
          <circle cx="41" cy="14.5" fill={appearance.hair} r="3.3" />
          <path
            d="M 21 20 Q 24 12 32 12 Q 41 12 43 20 Q 37 16 32 16 Q 26 16 21 20 Z"
            fill={appearance.hair}
          />
        </>
      );
    case "scarf":
      return (
        <>
          <path
            d="M 19 18 Q 32 8 45 18 L 41 23 Q 32 20 23 23 Z"
            fill="rgba(205,148,95,0.98)"
          />
          <path
            d="M 41 21 Q 47 27 43 35"
            fill="none"
            stroke="rgba(205,148,95,0.98)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      );
    case "cap":
      return (
        <>
          <path
            d="M 19 20 Q 25 11 41 18 Q 38 23 22 22 Z"
            fill={appearance.hair}
          />
          <path
            d="M 40 20 Q 46 21 42 24"
            fill="none"
            stroke={appearance.hair}
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      );
    case "beard-cap":
      return (
        <>
          <path
            d="M 18 19 Q 24 10 41 18 Q 38 22 22 22 Z"
            fill={appearance.hair}
          />
          <path
            d="M 25 31 Q 32 37 39 31 Q 38 37 32 38 Q 26 37 25 31 Z"
            fill={appearance.hair}
          />
        </>
      );
    case "ponytail":
      return (
        <>
          <path
            d="M 20 20 Q 24 11 32 12 Q 41 12 43 19 Q 36 16 32 16 Q 27 16 20 20 Z"
            fill={appearance.hair}
          />
          <path
            d="M 42 18 Q 48 18 44 28"
            fill="none"
            stroke={appearance.hair}
            strokeLinecap="round"
            strokeWidth="2"
          />
        </>
      );
    default:
      return (
        <path
          d="M 20 20 Q 25 11 32 12 Q 40 12 44 20 Q 37 16 32 16 Q 27 16 20 20 Z"
          fill={appearance.hair}
        />
      );
  }
}

function renderPortraitFace(appearance: PortraitAppearance) {
  switch (appearance.faceStyle) {
    case "soft":
      return (
        <>
          <circle cx="28" cy="24" fill={appearance.eye} r="1.1" />
          <circle cx="36" cy="24" fill={appearance.eye} r="1.1" />
          <path
            d="M 27 31 Q 32 34 37 31"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1.1"
          />
        </>
      );
    case "wry":
      return (
        <>
          <path
            d="M 25 22 L 30 21"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1"
          />
          <path
            d="M 34 21 L 39 22"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1"
          />
          <ellipse cx="28" cy="24.5" fill={appearance.eye} rx="1.2" ry="1.4" />
          <ellipse cx="36" cy="24.5" fill={appearance.eye} rx="1.2" ry="1.4" />
          <path
            d="M 27 31 Q 33 33 38 29"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1.15"
          />
        </>
      );
    case "steady":
      return (
        <>
          <circle cx="28" cy="24.5" fill={appearance.eye} r="1.1" />
          <circle cx="36" cy="24.5" fill={appearance.eye} r="1.1" />
          <path
            d="M 27 31 Q 32 30 37 31"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1"
          />
        </>
      );
    case "stern":
      return (
        <>
          <path
            d="M 24 21 L 30 19.5"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1.2"
          />
          <path
            d="M 34 19.5 L 40 21"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1.2"
          />
          <circle cx="28" cy="24" fill={appearance.eye} r="1.15" />
          <circle cx="36" cy="24" fill={appearance.eye} r="1.15" />
          <path
            d="M 27 31 Q 32 29.5 37 31"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1"
          />
        </>
      );
    case "bright":
      return (
        <>
          <circle cx="28" cy="24" fill={appearance.eye} r="1.15" />
          <circle cx="36" cy="24" fill={appearance.eye} r="1.15" />
          <path
            d="M 26.5 30.5 Q 32 35 37.5 30.5"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1.15"
          />
        </>
      );
    default:
      return (
        <>
          <circle cx="28" cy="24.5" fill={appearance.eye} r="1.05" />
          <circle cx="36" cy="24.5" fill={appearance.eye} r="1.05" />
          <path
            d="M 27 31 Q 32 31.5 37 31"
            fill="none"
            stroke={appearance.eye}
            strokeLinecap="round"
            strokeWidth="1"
          />
        </>
      );
  }
}

function buildJobMemoryDetail(
  job: StreetGameState["jobs"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (job.completed) {
    return `I finished this at ${place} and got paid.`;
  }

  if (job.missed) {
    return `I let this slip at ${place}.`;
  }

  if (job.accepted) {
    if (job.deferredUntilMinutes !== undefined) {
      return `I'm still committed to this at ${place}, but I've pushed it back for a bit.`;
    }

    return `I'm committed to this at ${place}. It pays $${job.pay}.`;
  }

  return `I know this lead at ${place}. It pays $${job.pay}.`;
}

function buildProblemMemoryDetail(
  problem: StreetGameState["problems"][number],
  locationName?: string,
) {
  const place = locationName ?? "an unknown place";

  if (problem.status === "solved") {
    return `I already handled this at ${place}.`;
  }

  if (problem.status === "expired") {
    return `I let this spread at ${place}.`;
  }

  if (problem.status === "active") {
    return `I can deal with this at ${place}. It pays $${problem.rewardMoney}.`;
  }

  return `I heard about this at ${place}.`;
}

function trimPeriod(text: string) {
  return text.replace(/[.!?]+$/, "").trim();
}

function lowercaseFirst(text: string) {
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}

function splitConversationStreamWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function revealConversationText(text: string, wordCount: number) {
  const words = splitConversationStreamWords(text);
  if (words.length === 0) {
    return "";
  }

  return words.slice(0, Math.max(1, wordCount)).join(" ");
}

function conversationActorForSpeaker(
  speaker: StreetGameState["conversations"][number]["speaker"],
) {
  return speaker === "player" ? "rowan" : "npc";
}

function findPreviousConversationSpeaker(
  entries: StreetGameState["conversations"],
  entryId: string,
) {
  const nextIndex = entries.findIndex((entry) => entry.id === entryId);
  if (nextIndex <= 0) {
    return undefined;
  }

  return entries[nextIndex - 1]?.speaker;
}

function conversationEntryStartDelayMs(
  previousSpeaker:
    | StreetGameState["conversations"][number]["speaker"]
    | undefined,
  nextSpeaker:
    | StreetGameState["conversations"][number]["speaker"]
    | undefined,
) {
  if (!nextSpeaker) {
    return 0;
  }

  if (!previousSpeaker) {
    return CONVERSATION_STREAM_FIRST_ENTRY_PAUSE_MS;
  }

  if (previousSpeaker === nextSpeaker) {
    return CONVERSATION_STREAM_SAME_SPEAKER_PAUSE_MS;
  }

  return CONVERSATION_STREAM_TURN_CHANGE_PAUSE_MS;
}

function conversationWordDelayMs(
  speaker: StreetGameState["conversations"][number]["speaker"],
) {
  return speaker === "player"
    ? CONVERSATION_STREAM_PLAYER_WORD_DELAY_MS
    : CONVERSATION_STREAM_NPC_WORD_DELAY_MS;
}

function conversationStreamDelayMs(
  speaker: StreetGameState["conversations"][number]["speaker"],
  visibleWordCount: number,
) {
  const baseDelay = conversationWordDelayMs(speaker);

  if (visibleWordCount <= 1) {
    return CONVERSATION_STREAM_INITIAL_DELAY_MS + baseDelay;
  }

  return baseDelay;
}

function estimateConversationPlaybackMs(
  entries: StreetGameState["conversations"],
) {
  if (entries.length === 0) {
    return AUTO_CONVERSATION_SETTLE_MS;
  }

  let totalMs = 0;
  let previousSpeaker:
    | StreetGameState["conversations"][number]["speaker"]
    | undefined;

  for (const entry of entries) {
    totalMs += conversationEntryStartDelayMs(previousSpeaker, entry.speaker);

    const wordCount = splitConversationStreamWords(entry.text).length;
    if (wordCount > 1) {
      totalMs += CONVERSATION_STREAM_INITIAL_DELAY_MS;
      totalMs += (wordCount - 1) * conversationWordDelayMs(entry.speaker);
    }

    totalMs += CONVERSATION_STREAM_ENTRY_SETTLE_MS;
    previousSpeaker = entry.speaker;
  }

  return Math.max(AUTO_CONVERSATION_SETTLE_MS, totalMs + 900);
}

function buildConversationReplaySignature(
  activeConversation: NonNullable<StreetGameState["activeConversation"]>,
) {
  const lineIds = activeConversation.lines.map((entry) => entry.id).join("|");
  return `${activeConversation.threadId}:${activeConversation.updatedAt}:${lineIds}`;
}

function initialsForName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "??";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function findWalkableTile(game: StreetGameState, x: number, y: number) {
  return game.map.tiles.find((tile) => tile.x === x && tile.y === y && tile.walkable);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function minutesBetweenIso(laterIso: string, earlierIso: string) {
  const later = Date.parse(laterIso);
  const earlier = Date.parse(earlierIso);

  if (Number.isNaN(later) || Number.isNaN(earlier)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((later - earlier) / 60000));
}

function deriveLiveClock(
  clock: StreetGameState["clock"],
  anchor: ClockAnchor | null,
  nowMs: number,
) {
  if (!anchor) {
    return clock;
  }

  const elapsedWholeMinutes = Math.max(
    0,
    Math.floor((nowMs - anchor.appliedAtMs) / 60_000),
  );

  if (elapsedWholeMinutes === 0) {
    return clock;
  }

  return buildClockState(anchor.totalMinutes + elapsedWholeMinutes);
}

function buildClockState(totalMinutes: number): StreetGameState["clock"] {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const day = Math.floor(normalizedMinutes / (24 * 60)) + 1;
  const minuteOfDay = normalizedMinutes % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return {
    day,
    hour,
    minute,
    totalMinutes: normalizedMinutes,
    label: phaseForHour(hour),
  };
}

function phaseForHour(hour: number) {
  if (hour < 6) return "Pre-dawn";
  if (hour < 11) return "Morning";
  if (hour < 14) return "Late morning";
  if (hour < 18) return "Afternoon";
  if (hour < 22) return "Evening";
  return "Night";
}

function isoForTotalMinutes(totalMinutes: number) {
  const timestamp =
    new Date(STREET_SIM_BASE_DAY).getTime() + totalMinutes * 60_000;
  return new Date(timestamp).toISOString();
}

function formatJobWindow(day: number, startHour: number, endHour: number) {
  const dayOffsetMinutes = (day - 1) * 24 * 60;
  const start = formatClock(isoForTotalMinutes(dayOffsetMinutes + startHour * 60));
  const end = formatClock(isoForTotalMinutes(dayOffsetMinutes + endHour * 60));
  return `${start} to ${end}`;
}

type ClockAdvanceOption = {
  key: string;
  minutes: number;
  label: string;
  busyLabel: string;
  kind: "increment" | "target";
};

function totalMinutesForDayHour(day: number, hour: number) {
  return Math.max(0, day - 1) * 24 * 60 + hour * 60;
}

function buildClockAdvanceOptions({
  currentTotalMinutes,
  upcomingCommitmentMinutes,
}: {
  currentTotalMinutes: number;
  upcomingCommitmentMinutes?: number;
}): ClockAdvanceOption[] {
  const options: ClockAdvanceOption[] = [
    {
      key: "increment-5",
      minutes: 5,
      label: "+5m",
      busyLabel: "Letting five quiet minutes pass...",
      kind: "increment",
    },
    {
      key: "increment-15",
      minutes: 15,
      label: "+15m",
      busyLabel: "Letting fifteen quiet minutes pass...",
      kind: "increment",
    },
    {
      key: "increment-30",
      minutes: 30,
      label: "+30m",
      busyLabel: "Letting half an hour pass...",
      kind: "increment",
    },
  ];

  if (
    upcomingCommitmentMinutes !== undefined &&
    upcomingCommitmentMinutes > currentTotalMinutes
  ) {
    const minutesUntilCommitment =
      upcomingCommitmentMinutes - currentTotalMinutes;
    options.unshift({
      key: `target-${upcomingCommitmentMinutes}`,
      minutes: minutesUntilCommitment,
      label: `To ${formatClock(isoForTotalMinutes(upcomingCommitmentMinutes))}`,
      busyLabel: `Waiting until ${formatClock(
        isoForTotalMinutes(upcomingCommitmentMinutes),
      )}...`,
      kind: "target",
    });
  }

  const seenMinutes = new Set<number>();
  return options.filter((option) => {
    if (option.minutes <= 0 || seenMinutes.has(option.minutes)) {
      return false;
    }

    seenMinutes.add(option.minutes);
    return true;
  });
}

function MindSnapshotCard({
  label,
  title,
  detail,
  meta,
}: {
  label: string;
  title: string;
  detail: string;
  meta?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(134,145,154,0.2)] bg-[rgba(30,39,46,0.74)] px-4 py-4 sm:px-5">
      <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="mt-3 text-[1rem] font-medium text-[color:var(--text-main)]">
        {title}
      </div>
      <div className="mt-2 text-[0.9rem] leading-6 text-[color:var(--text-muted)]">
        {detail}
      </div>
      {meta ? (
        <div className="mt-3 text-[0.76rem] uppercase tracking-[0.14em] text-[color:var(--text-dim)]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function LoadingStage({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-[18px] border border-[rgba(134,145,154,0.18)] bg-[rgba(20,27,32,0.72)] px-4 py-3">
      <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
        {label}
      </div>
      <div className="mt-2 text-[0.86rem] leading-6 text-[color:var(--text-muted)]">
        {detail}
      </div>
    </div>
  );
}

function buildObjectiveCompletedItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectiveTrailItem[] {
  const completedItems: ObjectiveTrailItem[] = [];
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2);
  const completedJobs = game.jobs.filter((job) => job.completed);
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  );

  for (const job of completedJobs) {
    completedItems.push({
      id: `completed-job-${job.id}`,
      title: `Finished ${job.title.toLowerCase()}`,
      detail: `You followed through at ${
        locationById.get(job.locationId)?.name ?? "the job site"
      } and got paid.`,
      progress: `+$${job.pay}`,
      done: true,
    });
  }

  for (const problem of solvedProblems) {
    completedItems.push({
      id: `completed-problem-${problem.id}`,
      title: `Solved ${problem.title.toLowerCase()}`,
      detail: `You handled this at ${
        locationById.get(problem.locationId)?.name ?? "the scene"
      } and made the block a little easier to live in.`,
      progress: problem.rewardMoney > 0 ? `+$${problem.rewardMoney}` : undefined,
      done: true,
    });
  }

  if (game.player.knownLocationIds.length >= 4) {
    completedItems.push({
      id: "completed-lanes",
      title: "Got the lay of South Quay",
      detail:
        "The district has stopped feeling like a blur. Rowan has enough of the lanes in his head to plan ahead.",
      progress: `${game.player.knownLocationIds.length} places known`,
      done: true,
    });
  }

  if (game.player.knownNpcIds.length >= 3) {
    completedItems.push({
      id: "completed-locals",
      title: "Made first introductions",
      detail:
        "Rowan is no longer a stranger to just one face. A few locals know him well enough to place him.",
      progress: `${game.player.knownNpcIds.length} people known`,
      done: true,
    });
  }

  if (trustedPeople.length >= 1) {
    completedItems.push({
      id: "completed-trust",
      title: "Earned some trust",
      detail: `${trustedPeople[0]?.name ?? "Someone"} has started answering Rowan like he belongs in the conversation.`,
      progress: `${trustedPeople.length} trusted`,
      done: true,
    });
  }

  if (game.player.money >= 20) {
    completedItems.push({
      id: "completed-breathing-room",
      title: "Built a little breathing room",
      detail:
        "Cash has started feeling like footing instead of the day's last few coins.",
      progress: `$${game.player.money} on hand`,
      done: true,
    });
  }

  return completedItems.slice(0, 8);
}

function buildObjectivePlanItems(
  game: StreetGameState,
  locationById: Map<string, StreetGameState["locations"][number]>,
): ObjectivePlanItem[] {
  const focus = game.player.objective?.focus ?? "settle";
  const activeJob = game.jobs.find(
    (job) =>
      job.id === game.player.activeJobId &&
      job.accepted &&
      !job.completed &&
      !job.missed,
  );
  const discoveredJobs = game.jobs.filter((job) => job.discovered);
  const completedJobs = game.jobs.filter((job) => job.completed).length;
  const discoveredProblems = game.problems.filter((problem) => problem.discovered);
  const activeProblems = discoveredProblems.filter(
    (problem) => problem.status === "active",
  );
  const solvedProblems = game.problems.filter(
    (problem) => problem.status === "solved",
  ).length;
  const knownPeople = game.player.knownNpcIds.length;
  const trustedPeople = game.npcs.filter((npc) => npc.trust >= 2).length;
  const knownPlaces = game.player.knownLocationIds.length;
  const houseStanding = game.player.reputation.morrow_house ?? 0;
  const homeName =
    locationById.get(game.player.homeLocationId)?.name ?? "Morrow House";
  const hasWrench = game.player.inventory.some((item) => item.id === "item-wrench");
  const activeProblem = activeProblems[0];
  const activeJobLocation = activeJob
    ? locationById.get(activeJob.locationId)?.name
    : undefined;

  switch (focus) {
    case "work":
      return [
        {
          id: "work-lead",
          title: "Find paying work",
          detail:
            discoveredJobs.length > 0
              ? "There is at least one real work lead on the block now."
              : "You still need to find out who is actually hiring today.",
          progress: `${Math.min(discoveredJobs.length, 1)}/1 lead`,
          done: discoveredJobs.length > 0,
        },
        {
          id: "work-commit",
          title: "Line up the next shift",
          detail: activeJob
            ? `You already have ${activeJob.title.toLowerCase()} lined up at ${activeJobLocation ?? "the job site"}.`
            : completedJobs > 0
              ? "You have already proved you can turn a lead into real work."
              : "You still need to lock one job in instead of only hearing about it.",
          progress: activeJob || completedJobs > 0 ? "In hand" : "Not lined up",
          done: Boolean(activeJob || completedJobs > 0),
        },
        {
          id: "work-money",
          title: "Turn it into breathing room",
          detail:
            completedJobs > 0 || game.player.money >= 20
              ? "Money is starting to feel like footing, not just survival."
              : "The point is not only work. It is enough cash that the next move gets easier.",
          progress: `$${game.player.money} on hand`,
          done: completedJobs > 0 || game.player.money >= 20,
        },
      ];
    case "people":
      return [
        {
          id: "people-meet",
          title: "Meet a few locals",
          detail:
            knownPeople >= 3
              ? "You know enough people now that the block has stopped feeling faceless."
              : "You still need to make yourself known to more than one or two people here.",
          progress: `${knownPeople}/3 people`,
          done: knownPeople >= 3,
        },
        {
          id: "people-open-up",
          title: "Get someone to open up",
          detail:
            trustedPeople >= 1
              ? "At least one person is starting to answer you like you belong in the conversation."
              : "You still need one real conversation that turns into trust.",
          progress: `${Math.min(trustedPeople, 1)}/1 trust`,
          done: trustedPeople >= 1,
        },
        {
          id: "people-friends",
          title: "Find people to come back to",
          detail:
            trustedPeople >= 2
              ? "A couple of people are starting to feel like they could become real friends."
              : "This is not just about names. It is about finding people you would actually return to.",
          progress: `${trustedPeople}/2 trusted`,
          done: trustedPeople >= 2,
        },
      ];
    case "explore":
      return [
        {
          id: "explore-places",
          title: "Learn the shape of the block",
          detail:
            knownPlaces >= 4
              ? "You know enough places now to move with some intention."
              : "You still need a better mental map of where this district opens up.",
          progress: `${knownPlaces}/4 places`,
          done: knownPlaces >= 4,
        },
        {
          id: "explore-people",
          title: "Read the people in it",
          detail:
            knownPeople >= 2
              ? "You have started pairing places with the people who matter there."
              : "A map is not enough. You still need to connect those places to real people.",
          progress: `${knownPeople}/2 people`,
          done: knownPeople >= 2,
        },
        {
          id: "explore-lead",
          title: "Come away with one usable lead",
          detail:
            discoveredJobs.length > 0 || activeProblems.length > 0 || solvedProblems > 0
              ? "The district has already given you at least one thread worth following."
              : "Learning the lanes should surface one job, problem, or useful opening.",
          progress:
            discoveredJobs.length > 0 || activeProblems.length > 0 || solvedProblems > 0
              ? "Lead found"
              : "Still looking",
          done: discoveredJobs.length > 0 || activeProblems.length > 0 || solvedProblems > 0,
        },
      ];
    case "help":
      return [
        {
          id: "help-find",
          title: "Find the problem clearly",
          detail:
            discoveredProblems.length > 0
              ? "You know what is actually wrong now, not just that something feels off."
              : "You still need to pin down what needs fixing and where it sits.",
          progress: `${Math.min(discoveredProblems.length, 1)}/1 problem`,
          done: discoveredProblems.length > 0,
        },
        {
          id: "help-ready",
          title: "Get what the fix needs",
          detail:
            !activeProblem
              ? "Once the problem is clear, figure out whether it needs time, hands, or a tool."
              : activeProblem.requiredItemId
                ? hasWrench
                  ? "You have the tool this fix has been waiting on."
                  : "You know the fix needs a tool before your hands can finish it."
                : "You already have what you need to handle this.",
          progress:
            !activeProblem
              ? "Waiting on the read"
              : activeProblem.requiredItemId
                ? hasWrench
                  ? "Tool ready"
                  : "Tool needed"
                : "Ready now",
          done:
            Boolean(activeProblem) &&
            (!activeProblem.requiredItemId || hasWrench),
        },
        {
          id: "help-solve",
          title: "See it through",
          detail:
            solvedProblems > 0
              ? "You have already turned one local problem into proof that you can help."
              : "The last step is doing the work, not circling it.",
          progress: `${Math.min(solvedProblems, 1)}/1 solved`,
          done: solvedProblems > 0,
        },
      ];
    case "tool":
      return [
        {
          id: "tool-decide",
          title: "Figure out which tool matters",
          detail:
            activeProblem?.requiredItemId || hasWrench
              ? "You know the block is pointing you toward one concrete tool."
              : "You still need to hear what tool would actually change the day.",
          progress:
            activeProblem?.requiredItemId || hasWrench ? "Clear enough" : "Still asking",
          done: Boolean(activeProblem?.requiredItemId || hasWrench),
        },
        {
          id: "tool-money",
          title: "Get the money together",
          detail:
            game.player.money >= 8 || hasWrench
              ? "You have enough coin to stop this at talk and turn it into a purchase."
              : "You still need enough cash to buy the tool without wrecking your next move.",
          progress: `$${game.player.money} / $8`,
          done: game.player.money >= 8 || hasWrench,
        },
        {
          id: "tool-buy",
          title: "Buy the tool",
          detail:
            hasWrench
              ? "The tool is already in your hands now."
              : "You still need to go get it.",
          progress: hasWrench ? "Owned" : "Not bought",
          done: hasWrench,
        },
      ];
    case "rest":
      return [
        {
          id: "rest-safe",
          title: "Get somewhere you can actually stop",
          detail:
            game.player.currentLocationId === game.player.homeLocationId
              ? `You are already at ${homeName}, which gives rest a chance to count.`
              : `You need to get back to ${homeName} or another safe place before resting does much.`,
          progress:
            game.player.currentLocationId === game.player.homeLocationId
              ? "In place"
              : "Still out",
          done: game.player.currentLocationId === game.player.homeLocationId,
        },
        {
          id: "rest-hour",
          title: "Let the hour land",
          detail:
            game.player.energy >= 70
              ? "Your energy has already come back enough that the edge is off."
              : "You still need to actually stop long enough for recovery to happen.",
          progress: `${game.player.energy} energy`,
          done: game.player.energy >= 70,
        },
      ];
    case "settle":
    default:
      return [
        {
          id: "settle-income",
          title: "Find income",
          detail: game.goals[0] ?? "You still need a real path to money.",
          progress:
            activeJob || completedJobs > 0 || discoveredJobs.length > 0
              ? "Lead found"
              : "Still looking",
          done: Boolean(activeJob || completedJobs > 0 || discoveredJobs.length > 0),
        },
        {
          id: "settle-stay",
          title: "Make the bed situation less shaky",
          detail: game.goals[1] ?? `You still need better footing at ${homeName}.`,
          progress: `${houseStanding}/2 footing`,
          done: houseStanding >= 2,
        },
        {
          id: "settle-people",
          title: "Find people you might actually keep",
          detail: game.goals[2] ?? "You still need people who are more than passing faces.",
          progress: `${Math.max(trustedPeople, knownPeople)}/${trustedPeople > 0 ? 2 : 3}`,
          done: trustedPeople >= 1 || knownPeople >= 3,
        },
        {
          id: "settle-bearings",
          title: "Learn enough of the block to plan ahead",
          detail:
            knownPlaces >= 4
              ? "The district is starting to feel like somewhere you can route yourself through."
              : "You still need a stronger read on where things are and what each place is good for.",
          progress: `${knownPlaces}/4 places`,
          done: knownPlaces >= 4,
        },
      ];
  }
}
