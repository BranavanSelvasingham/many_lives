import type { FastifyInstance } from "fastify";
import { STEP_MINUTES } from "../sim/engine.js";
import type { SimulationEngine } from "../sim/engine.js";
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
      return {
        game: deps.store.save(world),
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

    return { game: world };
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
    return {
      game: deps.store.save(nextWorld),
    };
  });

  app.post<{
    Params: { id: string };
    Body: GameCommand;
    Reply: GameStateResponse | { message: string };
  }>("/game/:id/command", async (request, reply) => {
    const world = deps.store.get(request.params.id);
    if (!world) {
      reply.code(404);
      return {
        message: `Game ${request.params.id} was not found.`,
      };
    }

    const nextWorld = await deps.engine.runCommand(world, request.body);
    return {
      game: deps.store.save(nextWorld),
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

    return {
      game: deps.store.save(nextWorld),
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
