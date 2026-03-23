import { createAIProvider } from "../../../../../sim-server/src/ai/provider";
import { SimulationEngine } from "../../../../../sim-server/src/sim/engine";
import type { StreetGameState } from "../../../../../sim-server/src/street-sim/types";
import { MemoryGameStore } from "../../../../../sim-server/src/storage/memoryStore";

declare global {
  var __manyLivesStreetRuntime:
    | {
        engine: SimulationEngine;
        store: MemoryGameStore<StreetGameState>;
      }
    | undefined;
}

function createRuntime() {
  return {
    engine: new SimulationEngine(createAIProvider()),
    store: new MemoryGameStore<StreetGameState>(),
  };
}

export function getStreetRuntime() {
  globalThis.__manyLivesStreetRuntime ??= createRuntime();
  return globalThis.__manyLivesStreetRuntime;
}
