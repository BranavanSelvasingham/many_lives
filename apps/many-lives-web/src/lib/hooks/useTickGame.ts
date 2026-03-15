"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tickGame } from "@/lib/api/gameApi";
import type { GameState } from "@/lib/types/game";

export function useTickGame(gameId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (minutes: number) => {
      const currentGame = queryClient.getQueryData<GameState>(["game", gameId]);
      return tickGame(gameId as string, minutes, currentGame);
    },
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });
}
