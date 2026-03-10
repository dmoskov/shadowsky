/**
 * Hook for managing scheduled posts
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  ScheduledPost,
  ScheduledPostInput,
  addScheduledPost,
  deleteScheduledPost,
  getScheduledPosts,
  updateScheduledPost,
} from "../services/scheduled-posts";

export function useScheduledPosts() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const loadPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedPosts = await getScheduledPosts();

      // Sort by scheduled time (earliest first)
      const sortedPosts = loadedPosts.sort(
        (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime(),
      );

      setPosts(sortedPosts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to load scheduled posts"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Re-sync from AT Proto when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          loadPosts();
        }
        appStateRef.current = nextState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [loadPosts]);

  const addPost = useCallback(
    async (input: ScheduledPostInput) => {
      try {
        const newPost = await addScheduledPost(input);
        await loadPosts(); // Reload to maintain sort order
        return newPost;
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Failed to add scheduled post");
      }
    },
    [loadPosts],
  );

  const updatePost = useCallback(
    async (
      id: string,
      updates: Partial<Pick<ScheduledPost, "text" | "scheduledTime">>,
    ) => {
      try {
        const updatedPost = await updateScheduledPost(id, updates);
        if (updatedPost) {
          await loadPosts(); // Reload to maintain sort order
        }
        return updatedPost;
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Failed to update scheduled post");
      }
    },
    [loadPosts],
  );

  const deletePost = useCallback(
    async (id: string) => {
      try {
        const success = await deleteScheduledPost(id);
        if (success) {
          await loadPosts();
        }
        return success;
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Failed to delete scheduled post");
      }
    },
    [loadPosts],
  );

  return {
    posts,
    isLoading,
    error,
    refetch: loadPosts,
    addPost,
    updatePost,
    deletePost,
  };
}
