import type { FastifyInstance } from "fastify";
import { STEP_MINUTES } from "../sim/engine.js";
import type { SimulationEngine } from "../sim/engine.js";
import { projectStreetGameForPlayer } from "../street-sim/playerView.js";
import type { StreetGameState } from "../street-sim/types.js";
import type { MemoryGameStore } from "../storage/memoryStore.js";
import type {
  CreateGameRequest,
  GameCommand,
  GameStateResponse,
  TickGameRequest,
  UpdatePolicyRequest,
} from "../types/api.js";

interface GameRouteDependencies {
  engine: SimulationEngine;
  store: MemoryGameStore<StreetGameState>;
}

export function registerGameRoutes(
  app: FastifyInstance,
  deps: GameRouteDependencies,
): void {
  app.post<{ Body: CreateGameRequest; Reply: GameStateResponse }>(
    "/game/new",
    async () => {
      const gameId = deps.store.createGameId();
      const world = await deps.engine.createGame(gameId);
      const savedWorld = deps.store.save(world);
      return {
        game: projectStreetGameForPlayer(savedWorld),
      };
    },
  );

  app.get<{
    Params: { id: string };
    Reply: GameStateResponse | { message: string };
  }>("/game/:id/state", async (request, reply) => {
    const world = deps.store.get(request.params.id);
    if (!world) {
      reply.code(404);
      return {
        message: `Game ${request.params.id} was not found.`,
      };
    }

    return { game: projectStreetGameForPlayer(world) };
  });

  app.post<{
    Params: { id: string };
    Body: TickGameRequest;
    Reply: GameStateResponse | { message: string };
  }>("/game/:id/tick", async (request, reply) => {
    const world = deps.store.get(request.params.id);
    if (!world) {
      reply.code(404);
      return {
        message: `Game ${request.params.id} was not found.`,
      };
    }

    const nextWorld = await deps.engine.tick(
      world,
      normalizeTickCount(request.body),
    );
    const savedWorld = deps.store.save(nextWorld);
    return {
      game: projectStreetGameForPlayer(savedWorld),
    };
  });

  app.post<{
    Params: { id: string };
    Body: GameCommand;
    Reply: GameStateResponse | { message: string };
  }>("/game/:id/command", async (request, reply) => {
    if (isPublicFreeTextCommand(request.body) && !allowPublicFreeTextCommands()) {
      reply.code(403);
      return {
        message: "Free-text commands are disabled on this public build.",
      };
    }

    const world = deps.store.get(request.params.id);
    if (!world) {
      reply.code(404);
      return {
        message: `Game ${request.params.id} was not found.`,
      };
    }

    const nextWorld = await deps.engine.runCommand(world, request.body);
    const savedWorld = deps.store.save(nextWorld);
    return {
      game: projectStreetGameForPlayer(savedWorld),
    };
  });

  app.post<{
    Params: { id: string };
    Body: UpdatePolicyRequest;
    Reply: GameStateResponse | { message: string };
  }>("/game/:id/policy", async (request, reply) => {
    const world = deps.store.get(request.params.id);
    if (!world) {
      reply.code(404);
      return {
        message: `Game ${request.params.id} was not found.`,
      };
    }

    const nextWorld = await deps.engine.runCommand(world, {
      type: "update_policy",
      characterId: request.body.characterId,
      policy: request.body.policy,
    });
    const savedWorld = deps.store.save(nextWorld);

    return {
      game: projectStreetGameForPlayer(savedWorld),
    };
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

function isPublicFreeTextCommand(command: GameCommand | undefined) {
  return command?.type === "speak" || command?.type === "set_objective";
}

function allowPublicFreeTextCommands() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.SIM_ALLOW_FREE_TEXT_COMMANDS === "true"
  );
}
