import { requestJson } from "@/lib/api/client";
import type { GameStateResponse, StreetGameState } from "@/lib/street/types";

export const STREET_COMMAND_TIMEOUT_MS = 8_000;
export const STREET_RECOVERY_REQUEST_TIMEOUT_MS = 4_000;

type StreetRequestOperation = "command" | "create" | "load";

type StreetRequestOptions = {
  timeoutMs?: number;
};

export class StreetRequestTimeoutError extends Error {
  readonly operation: StreetRequestOperation;

  constructor(operation: StreetRequestOperation, timeoutMs: number) {
    super(`Street ${operation} request timed out after ${timeoutMs}ms.`);
    this.name = "StreetRequestTimeoutError";
    this.operation = operation;
  }
}

export function isStreetRequestTimeoutError(
  error: unknown,
): error is StreetRequestTimeoutError {
  return error instanceof StreetRequestTimeoutError;
}

async function requestStreetJson(
  path: string,
  init: RequestInit,
  operation: StreetRequestOperation,
  options: StreetRequestOptions = {},
) {
  const timeoutMs = options.timeoutMs;
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return requestJson<GameStateResponse>(path, init);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestJson<GameStateResponse>(path, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new StreetRequestTimeoutError(operation, timeoutMs);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestStreetCommand(
  gameId: string,
  command: Record<string, unknown>,
) {
  return requestStreetJson(
    `/game/${gameId}/command`,
    {
      method: "POST",
      body: JSON.stringify(command),
    },
    "command",
    { timeoutMs: STREET_COMMAND_TIMEOUT_MS },
  );
}

export async function createStreetGame(options: StreetRequestOptions = {}) {
  const response = await requestStreetJson(
    "/game/new",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    "create",
    options,
  );

  return response.game;
}

export async function loadStreetGame(
  gameId: string,
  options: StreetRequestOptions = {},
) {
  const response = await requestStreetJson(
    `/game/${gameId}/state`,
    {},
    "load",
    options,
  );
  return response.game;
}

export async function moveStreetPlayer(
  gameId: string,
  x: number,
  y: number,
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "move_to",
    x,
    y,
  });

  return response.game;
}

export async function actInStreetGame(
  gameId: string,
  actionId: string,
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "act",
    actionId,
  });

  return response.game;
}

export async function waitInStreetGame(
  gameId: string,
  minutes: number,
  options: {
    silent?: boolean;
  } = {},
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "wait",
    minutes,
    silent: options.silent,
  });

  return response.game;
}

export async function setStreetObjective(
  gameId: string,
  text: string,
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "set_objective",
    text,
  });

  return response.game;
}

export async function speakToStreetNpc(
  gameId: string,
  npcId: string,
  text: string,
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "speak",
    npcId,
    text,
  });

  return response.game;
}

export async function advanceStreetObjective(
  gameId: string,
  options: {
    allowTimeSkip?: boolean;
    confirmMove?: boolean;
  } = {},
): Promise<StreetGameState> {
  const response = await requestStreetCommand(gameId, {
    type: "advance_objective",
    allowTimeSkip: options.allowTimeSkip,
    confirmMove: options.confirmMove,
  });

  return response.game;
}
