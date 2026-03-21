export class MemoryGameStore<TGame extends { id: string } = { id: string }> {
  private readonly games = new Map<string, TGame>();

  private nextGameNumber = 1;

  createGameId(): string {
    const id = `game-${this.nextGameNumber}`;
    this.nextGameNumber += 1;
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
