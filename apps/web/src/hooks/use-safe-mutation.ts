"use client";
import { useRef } from "react";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
export function useSafeMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
  const locked = useRef(false);
  const mutation = useMutation({
    ...options,
    onSuccess: async (data, variables, context, mutationContext) => {
      await options.onSuccess?.(data, variables, context, mutationContext);
    },
    onError: (error, variables, context, mutationContext) => {
      if (options.onError)
        options.onError(error, variables, context, mutationContext);
      else
        toast.error(
          error instanceof Error
            ? error.message
            : "Action failed. Please retry.",
        );
    },
    onSettled: async (data, error, variables, context, mutationContext) => {
      try {
        await options.onSettled?.(
          data,
          error,
          variables,
          context,
          mutationContext,
        );
      } finally {
        locked.current = false;
      }
    },
  });
  return {
    ...mutation,
    mutate: ((...args: Parameters<typeof mutation.mutate>) => {
      if (locked.current) return;
      locked.current = true;
      mutation.mutate(...args);
    }) as typeof mutation.mutate,
    mutateAsync: (async (...args: Parameters<typeof mutation.mutateAsync>) => {
      if (locked.current) throw new Error("An action is already running");
      locked.current = true;
      return mutation.mutateAsync(...args);
    }) as typeof mutation.mutateAsync,
  };
}
