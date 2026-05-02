import { randomUUID } from "node:crypto";

export class MemoryGameStore<TGame extends { id: string } = { id: string }> {
  private readonly games = new Map<string, TGame>();

  createGameId(): string {
    let id: string;
    do {
      id = `game-${randomUUID()}`;
    } while (this.games.has(id));

    return id;
  }

  save(world: TGame): TGame {
    const clonedWorld = structuredClone(world);
    this.games.set(clonedWorld.id, clonedWorld);
    return structuredClone(clonedWorld);
  }

  get(gameId: string): TGame | undefined {
    const world = this.games.get(gameId);
    return world ? structuredClone(world) : undefined;
  }

  has(gameId: string): boolean {
    return this.games.has(gameId);
  }
}
