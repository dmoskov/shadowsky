import { useCallback } from "react";
import { useErrorHandler } from "../../hooks/useErrorHandler";

export interface StorageErrorManager {
  handleStorageError: (error: Error, action: string) => void;
}

/**
 * Hook to create an error manager for storage backends
 * This allows class-based storage backends to use the React-based error handling system
 */
export function useStorageErrorManager(): StorageErrorManager {
  const { handleError } = useErrorHandler({
    silent: false, // Show alerts for storage errors
  });

  const handleStorageError = useCallback(
    (error: Error, action: string) => {
      // Add context about storage operations
      const storageError = new Error(
        `Storage operation failed: ${action}. ${error.message}`,
      );
      storageError.stack = error.stack;
      // @ts-ignore - Error.cause is available in ES2022+
      storageError.cause = error;

      handleError(storageError, `storage_${action.replace(/\s+/g, "_")}`);
    },
    [handleError],
  );

  return {
    handleStorageError,
  };
}
