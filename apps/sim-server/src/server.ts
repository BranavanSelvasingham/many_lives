import Fastify, { type FastifyInstance } from "fastify";
import { createAIProvider } from "./ai/provider.js";
import { registerGameRoutes } from "./routes/game.js";
import { registerHealthRoutes } from "./routes/health.js";
import type { StreetGameState } from "./street-sim/types.js";
import { SimulationEngine } from "./sim/engine.js";
import { MemoryGameStore } from "./storage/memoryStore.js";

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  const aiProvider = createAIProvider();
  const engine = new SimulationEngine(aiProvider);
  const store = new MemoryGameStore<StreetGameState>();

  registerHealthRoutes(app, engine.providerName);
  registerGameRoutes(app, { engine, store });

  return app;
}
