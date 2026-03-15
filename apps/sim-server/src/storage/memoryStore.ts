import type { WorldState } from "../domain/world.js";
import { cloneWorldState } from "../sim/worldState.js";

export class MemoryGameStore {
  private readonly games = new Map<string, WorldState>();

  private nextGameNumber = 1;

  createGameId(): string {
    const id = `game-${this.nextGameNumber}`;
    this.nextGameNumber += 1;
    return id;
  }

  save(world: WorldState): WorldState {
    const clonedWorld = cloneWorldState(world);
    this.games.set(clonedWorld.id, clonedWorld);
    return cloneWorldState(clonedWorld);
  }

  get(gameId: string): WorldState | undefined {
    const world = this.games.get(gameId);
    return world ? cloneWorldState(world) : undefined;
  }

  // TODO: Swap this store for a persistent adapter once saves need to survive process restarts.
  has(gameId: string): boolean {
    return this.games.has(gameId);
  }
}
