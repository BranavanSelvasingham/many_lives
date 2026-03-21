import { MockAIProvider } from "../../../../../sim-server/src/ai/mockProvider";
import { SimulationEngine } from "../../../../../sim-server/src/sim/engine";
import type { StreetGameState } from "../../../../../sim-server/src/street-sim/types";
import { MemoryGameStore } from "../../../../../sim-server/src/storage/memoryStore";

declare global {
  // eslint-disable-next-line no-var
  var __manyLivesStreetRuntime:
    | {
        engine: SimulationEngine;
        store: MemoryGameStore<StreetGameState>;
      }
    | undefined;
}

function createRuntime() {
  return {
    engine: new SimulationEngine(new MockAIProvider()),
    store: new MemoryGameStore<StreetGameState>(),
  };
}

export function getStreetRuntime() {
  globalThis.__manyLivesStreetRuntime ??= createRuntime();
  return globalThis.__manyLivesStreetRuntime;
}
