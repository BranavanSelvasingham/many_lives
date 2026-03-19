import { requestJson } from "@/lib/api/client";
import type {
  DelegateMessageInput,
  GameResponse,
  GameState,
  ResolveMessageInput,
  SnoozeMessageInput,
  UpdatePolicyInput,
} from "@/lib/types/game";
import {
  createMockGame,
  delegateMockMessage,
  getStoredMockGame,
  ensureMockGame,
  mergePolicyDraft,
  normalizeGameResponse,
  resolveMockMessage,
  snoozeMockMessage,
  storeMockGame,
  tickMockGame,
  updateMockPolicy,
} from "@/lib/utils/mockData";

export async function createGame() {
  try {
    const response = await requestJson<GameResponse>("/game/new", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return normalizeGameResponse(response, "backend");
  } catch {
    return createMockGame();
  }
}

export async function fetchGameState(gameId: string) {
  const storedMock = getStoredMockGame(gameId);
  if (storedMock?.source === "mock") {
    return storedMock;
  }

  try {
    const response = await requestJson<GameResponse>(`/game/${gameId}/state`);
    return normalizeGameResponse(response, "backend");
  } catch {
    return storedMock ?? ensureMockGame(gameId);
  }
}

export async function tickGame(
  gameId: string,
  minutes: number,
  currentGame?: GameState,
) {
  if (currentGame?.source === "mock") {
    return tickMockGame(gameId, minutes, currentGame);
  }

  try {
    const response = await requestJson<GameResponse>(`/game/${gameId}/tick`, {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
    return normalizeGameResponse(response, "backend");
  } catch {
    return tickMockGame(gameId, minutes, currentGame);
  }
}

export async function resolveMessage(
  gameId: string,
  input: ResolveMessageInput,
  currentGame?: GameState,
) {
  if (currentGame?.source === "mock") {
    return resolveMockMessage(
      gameId,
      input.messageId,
      input.actionId,
      input.overrideText,
      currentGame,
    );
  }

  try {
    const response = await requestJson<GameResponse>(
      `/game/${gameId}/command`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "resolve_inbox",
          messageId: input.messageId,
          actionId: input.actionId,
          overrideText: input.overrideText ?? "",
        }),
      },
    );
    return normalizeGameResponse(response, "backend");
  } catch {
    return resolveMockMessage(
      gameId,
      input.messageId,
      input.actionId,
      input.overrideText,
      currentGame,
    );
  }
}

export async function snoozeMessage(
  gameId: string,
  input: SnoozeMessageInput,
  currentGame?: GameState,
) {
  if (currentGame?.source === "mock") {
    return snoozeMockMessage(
      gameId,
      input.messageId,
      input.durationMinutes,
      currentGame,
    );
  }

  try {
    const response = await requestJson<GameResponse>(
      `/game/${gameId}/command`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "snooze_inbox",
          messageId: input.messageId,
          durationMinutes: input.durationMinutes,
        }),
      },
    );
    return normalizeGameResponse(response, "backend");
  } catch {
    return snoozeMockMessage(
      gameId,
      input.messageId,
      input.durationMinutes,
      currentGame,
    );
  }
}

export async function delegateMessage(
  gameId: string,
  input: DelegateMessageInput,
  currentGame?: GameState,
) {
  if (currentGame?.source === "mock") {
    return delegateMockMessage(
      gameId,
      input.messageId,
      input.targetCharacterId,
      currentGame,
    );
  }

  try {
    const response = await requestJson<GameResponse>(
      `/game/${gameId}/command`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "delegate_inbox",
          messageId: input.messageId,
          targetCharacterId: input.targetCharacterId,
        }),
      },
    );
    return normalizeGameResponse(response, "backend");
  } catch {
    return delegateMockMessage(
      gameId,
      input.messageId,
      input.targetCharacterId,
      currentGame,
    );
  }
}

export async function updatePolicy(
  gameId: string,
  input: UpdatePolicyInput,
  currentGame?: GameState,
) {
  if (currentGame?.source === "mock") {
    return updateMockPolicy(
      gameId,
      input.characterId,
      input.draft,
      currentGame,
    );
  }

  try {
    const response = await requestJson<GameResponse>(`/game/${gameId}/policy`, {
      method: "POST",
      body: JSON.stringify({
        characterId: input.characterId,
        policy: input.policyPatch,
      }),
    });
    return mergePolicyDraft(
      normalizeGameResponse(response, "backend"),
      input.characterId,
      input.draft,
      "backend",
    );
  } catch {
    const fallback = currentGame
      ? mergePolicyDraft(currentGame, input.characterId, input.draft, "mock")
      : updateMockPolicy(gameId, input.characterId, input.draft);
    return storeMockGame(fallback);
  }
}
