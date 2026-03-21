import { requestJson } from "@/lib/api/client";
import type { GameStateResponse, StreetGameState } from "@/lib/street/types";

export async function createStreetGame() {
  const response = await requestJson<GameStateResponse>("/game/new", {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.game;
}

export async function moveStreetPlayer(
  gameId: string,
  x: number,
  y: number,
): Promise<StreetGameState> {
  const response = await requestJson<GameStateResponse>(`/game/${gameId}/command`, {
    method: "POST",
    body: JSON.stringify({
      type: "move_to",
      x,
      y,
    }),
  });

  return response.game;
}

export async function actInStreetGame(
  gameId: string,
  actionId: string,
): Promise<StreetGameState> {
  const response = await requestJson<GameStateResponse>(`/game/${gameId}/command`, {
    method: "POST",
    body: JSON.stringify({
      type: "act",
      actionId,
    }),
  });

  return response.game;
}

export async function waitInStreetGame(
  gameId: string,
  minutes: number,
): Promise<StreetGameState> {
  const response = await requestJson<GameStateResponse>(`/game/${gameId}/tick`, {
    method: "POST",
    body: JSON.stringify({
      minutes,
    }),
  });

  return response.game;
}
