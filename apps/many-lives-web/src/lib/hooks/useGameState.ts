"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchGameState } from "@/lib/api/gameApi";

export function useGameState(gameId: string | null) {
  return useQuery({
    queryKey: ["game", gameId],
    queryFn: () => fetchGameState(gameId as string),
    enabled: Boolean(gameId),
  });
}
