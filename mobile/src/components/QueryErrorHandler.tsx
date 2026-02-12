/**
 * Component that connects React Query's global error handler to our error handling system
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useErrorHandler } from "../hooks/useErrorHandler";

export function QueryErrorHandler({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    // Set up global error handler for React Query
    const defaultOptions = queryClient.getDefaultOptions();

    // In React Query v5, global error handling is done via QueryCache/MutationCache
    // Set up mutation-level error handling through default mutation options
    queryClient.setDefaultOptions({
      ...defaultOptions,
      mutations: {
        ...defaultOptions.mutations,
        onError: (error: unknown) => {
          handleError(error, "Mutation Error");
        },
      },
    });

    // Cleanup on unmount
    return () => {
      queryClient.setDefaultOptions(defaultOptions);
    };
  }, [queryClient, handleError]);

  return <>{children}</>;
}
