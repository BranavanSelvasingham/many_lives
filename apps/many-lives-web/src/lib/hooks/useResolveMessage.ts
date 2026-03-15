"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  delegateMessage,
  resolveMessage,
  snoozeMessage,
} from "@/lib/api/gameApi";
import type {
  DelegateMessageInput,
  GameState,
  ResolveMessageInput,
  SnoozeMessageInput,
} from "@/lib/types/game";

export function useResolveMessage(gameId: string | null) {
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async (input: ResolveMessageInput) => {
      const currentGame = queryClient.getQueryData<GameState>(["game", gameId]);
      return resolveMessage(gameId as string, input, currentGame);
    },
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (input: SnoozeMessageInput) => {
      const currentGame = queryClient.getQueryData<GameState>(["game", gameId]);
      return snoozeMessage(gameId as string, input, currentGame);
    },
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });

  const delegateMutation = useMutation({
    mutationFn: async (input: DelegateMessageInput) => {
      const currentGame = queryClient.getQueryData<GameState>(["game", gameId]);
      return delegateMessage(gameId as string, input, currentGame);
    },
    onSuccess: (game) => {
      queryClient.setQueryData(["game", game.gameId], game);
    },
  });

  return {
    resolveMessage: resolveMutation.mutateAsync,
    snoozeMessage: snoozeMutation.mutateAsync,
    delegateMessage: delegateMutation.mutateAsync,
    isPending:
      resolveMutation.isPending ||
      snoozeMutation.isPending ||
      delegateMutation.isPending,
  };
}
