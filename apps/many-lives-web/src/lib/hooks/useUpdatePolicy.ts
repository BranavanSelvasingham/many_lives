"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePolicy } from "@/lib/api/gameApi";
import type { GameState, UpdatePolicyInput } from "@/lib/types/game";

export function useUpdatePolicy(gameId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePolicyInput) => {
      const currentGame = queryClient.getQueryData<GameState>(["game", gameId]);
      return updatePolicy(gameId as string, input, currentGame);
    },
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });
}
