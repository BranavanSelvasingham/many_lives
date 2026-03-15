"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGame } from "@/lib/api/gameApi";

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGame,
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });
}
