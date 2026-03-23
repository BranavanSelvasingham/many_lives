import { NextResponse } from "next/server";
import type {
  CreateGameRequest,
  GameCommand,
  TickGameRequest,
  UpdatePolicyRequest,
} from "../../../../../sim-server/src/types/api";
import { STEP_MINUTES } from "../../../../../sim-server/src/sim/engine";
import { projectStreetGameForPlayer } from "../../../../../sim-server/src/street-sim/playerView";
import { getStreetRuntime } from "./runtime";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function notFoundResponse(id: string) {
  return json(
    {
      message: `Game ${id} was not found.`,
    },
    { status: 404 },
  );
}

export async function createGame(body?: CreateGameRequest) {
  void body;
  const { engine, store } = getStreetRuntime();
  const gameId = store.createGameId();
  const game = await engine.createGame(gameId);
  const savedGame = store.save(game);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function tickGame(id: string, body?: TickGameRequest) {
  const { engine, store } = getStreetRuntime();
  const existing = store.get(id);
  if (!existing) {
    return notFoundResponse(id);
  }

  const nextGame = await engine.tick(existing, normalizeTickCount(body));
  const savedGame = store.save(nextGame);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function runCommand(id: string, body: GameCommand) {
  const { engine, store } = getStreetRuntime();
  const existing = store.get(id);
  if (!existing) {
    return notFoundResponse(id);
  }

  const nextGame = await engine.runCommand(existing, body);
  const savedGame = store.save(nextGame);
  return json({
    game: projectStreetGameForPlayer(savedGame),
  });
}

export async function updatePolicy(id: string, body?: UpdatePolicyRequest) {
  return runCommand(id, {
    type: "update_policy",
    characterId: body?.characterId,
    policy: body?.policy,
  });
}

function normalizeTickCount(body: TickGameRequest = {}): number {
  if (body.ticks && body.ticks > 0) {
    return Math.max(1, Math.floor(body.ticks));
  }

  if (body.minutes && body.minutes > 0) {
    return Math.max(1, Math.round(body.minutes / STEP_MINUTES));
  }

  return 1;
}
