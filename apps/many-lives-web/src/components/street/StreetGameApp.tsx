"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { DistrictMap } from "@/components/street/DistrictMap";
import {
  ActionCard,
  ControlButton,
  InfoChip,
  LeadCard,
  LogRow,
  MutedLine,
  Panel,
  SceneNoteCard,
  StatPill,
  SubSection,
} from "@/components/street/StreetUi";
import { formatClock, humanizeKey } from "@/components/street/streetFormatting";
import {
  actInStreetGame,
  createStreetGame,
  moveStreetPlayer,
  waitInStreetGame,
} from "@/lib/street/api";
import type { StreetGameState } from "@/lib/street/types";

export function StreetGameApp() {
  const [game, setGame] = useState<StreetGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  useEffect(() => {
    void loadGame();
  }, []);

  const runMovement = useEffectEvent(async (x: number, y: number) => {
    if (!game || busyLabel) {
      return;
    }

    await runWithBusy("Walking the district...", async () => {
      const nextGame = await moveStreetPlayer(game.id, x, y);
      startTransition(() => {
        setGame(nextGame);
      });
    });
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!game || busyLabel) {
        return;
      }

      const { x, y } = game.player;

      switch (event.key) {
        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault();
          void runMovement(x, y - 1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          event.preventDefault();
          void runMovement(x, y + 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          event.preventDefault();
          void runMovement(x - 1, y);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          event.preventDefault();
          void runMovement(x + 1, y);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busyLabel, game, runMovement]);

  async function loadGame() {
    setError(null);
    setBusyLabel("Opening South Quay...");

    try {
      const nextGame = await createStreetGame();
      startTransition(() => {
        setGame(nextGame);
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not open the district.",
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function runWithBusy(
    label: string,
    callback: () => Promise<void>,
  ): Promise<void> {
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
  }

  async function handleAction(actionId: string, label: string) {
    if (!game) {
      return;
    }

    await runWithBusy(`${label}...`, async () => {
      const nextGame = await actInStreetGame(game.id, actionId);
      startTransition(() => {
        setGame(nextGame);
      });
    });
  }

  async function handleWait(minutes: number) {
    if (!game) {
      return;
    }

    await runWithBusy("Letting the district move...", async () => {
      const nextGame = await waitInStreetGame(game.id, minutes);
      startTransition(() => {
        setGame(nextGame);
      });
    });
  }

  if (!game) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-[28px] border border-[color:var(--border-subtle)] bg-[rgba(15,20,24,0.92)] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
          <div className="font-display text-[2rem] text-[color:var(--text-main)]">
            Many Lives
          </div>
          <div className="mt-2 text-[1rem] leading-7 text-[color:var(--text-muted)]">
            A smaller beginning: one person, one district, one day to start
            finding your place in Brackenport.
          </div>
          <div className="mt-6 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-muted)] px-4 py-3 text-[0.95rem] text-[color:var(--text-muted)]">
            {busyLabel ?? error ?? "Preparing the district..."}
          </div>
          <button
            className="mt-6 rounded-full bg-[color:var(--button-primary)] px-5 py-3 text-[0.95rem] font-medium text-[color:var(--button-primary-text)]"
            onClick={() => {
              void loadGame();
            }}
            type="button"
          >
            {error ? "Try Again" : "Enter South Quay"}
          </button>
        </div>
      </main>
    );
  }

  const locationById = Object.fromEntries(
    game.locations.map((location) => [location.id, location]),
  );
  const visibleJobs = game.jobs.filter(
    (job) => job.discovered || job.completed || job.missed,
  );
  const visibleProblems = game.problems.filter(
    (problem) => problem.discovered || problem.status !== "hidden",
  );
  const knownLocationCount = game.player.knownLocationIds.length;
  const solvedProblemCount = game.problems.filter(
    (problem) => problem.status === "solved",
  ).length;
  const completedJobCount = game.jobs.filter((job) => job.completed).length;
  const totalLocationCount = game.locations.length;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
      <div className="mx-auto max-w-[1660px] space-y-5">
        <header className="rounded-[32px] border border-[rgba(117,128,137,0.2)] bg-[linear-gradient(180deg,rgba(12,16,19,0.94)_0%,rgba(10,14,17,0.92)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.34)] sm:px-7 sm:py-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)] xl:items-end">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[0.76rem] uppercase tracking-[0.24em] text-[color:var(--text-dim)]">
                <span className="rounded-full border border-[rgba(117,128,137,0.2)] bg-[rgba(20,27,33,0.72)] px-3 py-1.5">
                  {game.cityName}
                </span>
                <span className="rounded-full border border-[rgba(117,128,137,0.2)] bg-[rgba(20,27,33,0.72)] px-3 py-1.5">
                  {game.scenarioName}
                </span>
              </div>
              <div className="font-display text-[2.4rem] leading-[0.96] text-[color:var(--text-main)] sm:text-[2.7rem]">
                Find your way in {game.districtName}
              </div>
              <div className="max-w-3xl text-[0.98rem] leading-7 text-[color:var(--text-muted)]">
                Learn the lanes. Find paid work. Notice the people and small
                problems that make a block start taking you seriously.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
              <StatPill label="Day" value={String(game.clock.day)} />
              <StatPill
                label="Time"
                value={`${String(game.clock.hour).padStart(2, "0")}:${String(
                  game.clock.minute,
                ).padStart(2, "0")}`}
              />
              <StatPill label="Money" value={`$${game.player.money}`} />
              <StatPill label="Energy" value={String(game.player.energy)} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
            <div className="rounded-[24px] border border-[rgba(117,128,137,0.2)] bg-[rgba(20,27,33,0.8)] px-5 py-4">
              <div className="text-[0.74rem] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
                District Read
              </div>
              <div className="mt-2 text-[0.96rem] leading-7 text-[color:var(--text-muted)]">
                {game.summary}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatPill
                label="Places Known"
                value={`${knownLocationCount}/${totalLocationCount}`}
              />
              <StatPill label="Jobs Done" value={String(completedJobCount)} />
              <StatPill
                label="Problems Solved"
                value={String(solvedProblemCount)}
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(167,105,99,0.5)] bg-[rgba(167,105,99,0.12)] px-4 py-3 text-[0.92rem] text-[color:var(--text-main)]">
              {error}
            </div>
          ) : null}
        </header>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.34fr)_minmax(400px,0.88fr)] xl:items-start">
          <section className="space-y-5">
            <Panel
              title="District Map"
              subtitle="Walk the lanes, use location markers to head for a doorway fast, and let the block reveal itself as you move."
            >
              <div className="space-y-5">
                <DistrictMap
                  busy={Boolean(busyLabel)}
                  game={game}
                  onTileClick={(x, y) => {
                    void runMovement(x, y);
                  }}
                />

                <div className="rounded-[24px] border border-[rgba(117,128,137,0.2)] bg-[rgba(16,22,27,0.72)] px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <ControlButton
                        label="Wait 30m"
                        onClick={() => {
                          void handleWait(30);
                        }}
                        quiet
                      />
                      <ControlButton
                        label="Wait 2h"
                        onClick={() => {
                          void handleWait(120);
                        }}
                        quiet
                      />
                    </div>

                    <div className="min-h-[42px] rounded-full border border-[rgba(117,128,137,0.22)] px-4 py-2 text-[0.78rem] uppercase tracking-[0.18em] text-[color:var(--text-dim)] lg:text-right">
                      {busyLabel ?? "The district keeps moving while you decide."}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-5 xl:grid-cols-2">
              <Panel
                className="h-full"
                title="Journal"
                subtitle="What Rowan is starting to remember."
              >
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {game.player.memories.slice(0, 6).map((memory) => (
                    <LogRow
                      key={memory.id}
                      body={memory.text}
                      meta={`${memory.kind} • ${formatClock(memory.time)}`}
                      tone={memory.kind}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                className="h-full"
                title="Street Feed"
                subtitle="The latest shifts on the block."
              >
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {game.feed.slice(0, 8).map((entry) => (
                    <LogRow
                      key={entry.id}
                      body={entry.text}
                      meta={formatClock(entry.time)}
                      tone={entry.tone}
                    />
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-5">
            <Panel
              title="Current Scene"
              subtitle={game.currentScene.title}
              contentClassName="space-y-5"
            >
              <div className="text-[0.97rem] leading-7 text-[color:var(--text-muted)]">
                {game.currentScene.description}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <SubSection title="People Here">
                  {game.currentScene.people.length === 0 ? (
                    <MutedLine text="Nobody nearby looks free to talk." />
                  ) : (
                    game.currentScene.people.map((person) => (
                      <InfoChip
                        key={person.id}
                        title={person.name}
                        detail={`${person.role}${person.known ? "" : " • new"}`}
                      />
                    ))
                  )}
                </SubSection>

                <SubSection title="What Stands Out">
                  {game.currentScene.notes.length === 0 ? (
                    <MutedLine text="Nothing here is pressing itself forward yet." />
                  ) : (
                    game.currentScene.notes.map((note) => (
                      <SceneNoteCard
                        key={note.id}
                        text={note.text}
                        tone={note.tone}
                      />
                    ))
                  )}
                </SubSection>
              </div>

              <SubSection title="What You Can Do">
                <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
                  {game.availableActions.length === 0 ? (
                    <MutedLine text="Nothing clear is available here. Move, wait, or keep looking." />
                  ) : (
                    game.availableActions.map((action) => (
                      <ActionCard
                        action={action}
                        busy={Boolean(busyLabel)}
                        key={action.id}
                        onRun={() => {
                          void handleAction(action.id, action.label);
                        }}
                      />
                    ))
                  )}
                </div>
              </SubSection>
            </Panel>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
              <Panel title="Goals" subtitle="Small aims that make the city legible.">
                <div className="space-y-3">
                  {game.goals.map((goal) => (
                    <div
                      className="rounded-[20px] border border-[rgba(117,128,137,0.2)] bg-[rgba(18,24,29,0.85)] px-4 py-3 text-[0.94rem] leading-6 text-[color:var(--text-muted)]"
                      key={goal}
                    >
                      {goal}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Pack & Standing"
                subtitle="What you can carry and what the district is beginning to think."
                contentClassName="space-y-5"
              >
                <SubSection title="Inventory">
                  {game.player.inventory.length === 0 ? (
                    <MutedLine text="Empty pockets except for your remaining cash." />
                  ) : (
                    game.player.inventory.map((item) => (
                      <InfoChip
                        key={item.id}
                        title={item.name}
                        detail={item.description}
                      />
                    ))
                  )}
                </SubSection>

                <SubSection title="Reputation">
                  {Object.entries(game.player.reputation).map(([key, value]) => (
                    <InfoChip
                      key={key}
                      title={humanizeKey(key)}
                      detail={`Standing ${value}`}
                    />
                  ))}
                </SubSection>
              </Panel>
            </div>

            <Panel title="Known Work" subtitle="Work gets clearer as you meet people.">
              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {visibleJobs.length === 0 ? (
                  <MutedLine text="No one has trusted you with work yet." />
                ) : (
                  visibleJobs.map((job) => (
                    <LeadCard
                      key={job.id}
                      title={job.title}
                      subtitle={`${locationById[job.locationId]?.name ?? "Unknown place"} • $${job.pay}`}
                      status={
                        job.completed
                          ? "done"
                          : job.missed
                            ? "missed"
                            : job.accepted
                              ? "accepted"
                              : "open"
                      }
                      body={job.summary}
                    />
                  ))
                )}
              </div>
            </Panel>

            <Panel
              title="Local Problems"
              subtitle="Trouble worth fixing before it spreads."
            >
              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {visibleProblems.length === 0 ? (
                  <MutedLine text="The block has not trusted you with its trouble yet." />
                ) : (
                  visibleProblems.map((problem) => (
                    <LeadCard
                      key={problem.id}
                      title={problem.title}
                      subtitle={`${locationById[problem.locationId]?.name ?? "Unknown place"} • reward $${problem.rewardMoney}`}
                      status={problem.status}
                      body={
                        problem.status === "solved"
                          ? problem.benefitIfSolved
                          : problem.status === "expired"
                            ? problem.consequenceIfIgnored
                            : problem.summary
                      }
                    />
                  ))
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
