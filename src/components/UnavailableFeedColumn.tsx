import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import type { Column } from "../types/column";

interface UnavailableFeedColumnProps {
  column: Column;
}

/**
 * A saved feed that no longer resolves — the generator was deleted, or the list
 * is gone or private. Shown instead of a column that would only ever fail to
 * load, with the one action that actually fixes it.
 */
export const UnavailableFeedColumn: React.FC<UnavailableFeedColumnProps> = ({
  column,
}) => {
  const { agent } = useAuth();
  const queryClient = useQueryClient();

  const removeFeed = useMutation({
    mutationFn: async () => {
      if (!agent || !column.savedFeedId) {
        throw new Error("Cannot remove this feed");
      }
      await agent.removeSavedFeeds([column.savedFeedId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-asph-text-tertiary" />
      <p className="text-sm font-medium text-asph-text-primary">
        This feed is unavailable
      </p>
      <p className="text-sm text-asph-text-tertiary">
        It has been deleted, or you no longer have access to it.
      </p>
      {column.data && (
        <p className="max-w-full break-all text-xs text-asph-text-tertiary">
          {column.data}
        </p>
      )}
      <button
        onClick={() => removeFeed.mutate()}
        disabled={removeFeed.isPending || !column.savedFeedId}
        className="touch-target-sm mt-1 rounded-md border border-asph-border-primary px-3 py-1.5 text-sm text-asph-text-secondary transition-colors hover:bg-asph-bg-hover disabled:opacity-50"
      >
        {removeFeed.isPending ? "Removing…" : "Remove from your feeds"}
      </button>
      {removeFeed.isError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {removeFeed.error instanceof Error
            ? removeFeed.error.message
            : "Failed to remove feed"}
        </p>
      )}
    </div>
  );
};

export default UnavailableFeedColumn;
