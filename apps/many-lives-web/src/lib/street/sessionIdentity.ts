export type StreetSessionIdentity = {
  gameId: string;
  replacementAttempted: boolean;
  source: "explicit" | "fresh" | "stored";
};

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

export function shouldReplaceMissingFreshGame({
  activeGameId,
  confirmedMissingGameId,
  failedGameId,
  identity,
}: {
  activeGameId: string | null;
  confirmedMissingGameId: string | null;
  failedGameId: string;
  identity: StreetSessionIdentity | null;
}) {
  return Boolean(
    identity &&
      identity.source === "fresh" &&
      !identity.replacementAttempted &&
      identity.gameId === failedGameId &&
      confirmedMissingGameId === failedGameId &&
      activeGameId === failedGameId,
  );
}
