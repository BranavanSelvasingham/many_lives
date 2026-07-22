export function shouldSkipUrlCleanupGameReload({
  activeGameId,
  cleanupGameId,
  explicitGameRequest,
  requestedGameId,
}: {
  activeGameId: string | null;
  cleanupGameId: string | null;
  explicitGameRequest: boolean;
  requestedGameId: string | null;
}) {
  return Boolean(
    !explicitGameRequest &&
      cleanupGameId &&
      activeGameId === cleanupGameId &&
      (!requestedGameId || requestedGameId === cleanupGameId),
  );
}
