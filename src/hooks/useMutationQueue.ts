/**
 * Hook for using the offline mutation queue
 *
 * Provides:
 * - Queue status (pending count, processing state)
 * - Manual sync trigger
 * - Queue error handling
 */

import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useCallback, useEffect, useState } from "react";
import {
  mutationQueueDB,
  type MutationQueueStats,
  type MutationType,
  type QueuedMutation,
} from "../services/mutation-queue-db";

export interface UseMutationQueueReturn {
  // Queue statistics
  pendingCount: number;
  failedCount: number;
  isProcessing: boolean;

  // Queue operations
  enqueue: (
    type: MutationType,
    payload: Record<string, unknown>,
  ) => Promise<string>;
  triggerSync: () => Promise<void>;
  clearQueue: () => Promise<void>;

  // Queue state
  isOnline: boolean;
  isInitialized: boolean;
}

export function useMutationQueue(
  agent: BskyAgent | null,
): UseMutationQueueReturn {
  const [stats, setStats] = useState<MutationQueueStats>({
    pendingCount: 0,
    failedCount: 0,
    oldestMutation: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize queue and set up executor
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await mutationQueueDB.init();

        if (!mounted) return;

        // Set up the mutation executor that uses the agent
        mutationQueueDB.setMutationExecutor(
          async (mutation: QueuedMutation) => {
            if (!agent) {
              throw new Error("Not authenticated");
            }

            const { type, payload } = mutation;

            switch (type) {
              case "like":
                await agent.like(payload.uri as string, payload.cid as string);
                break;
              case "unlike":
                await agent.deleteLike(payload.likeUri as string);
                break;
              case "repost":
                await agent.repost(
                  payload.uri as string,
                  payload.cid as string,
                );
                break;
              case "unrepost":
                await agent.deleteRepost(payload.repostUri as string);
                break;
              case "follow":
                await agent.follow(payload.did as string);
                break;
              case "unfollow":
                await agent.deleteFollow(payload.followUri as string);
                break;
              default:
                throw new Error(`Unknown mutation type: ${type}`);
            }
          },
        );

        // Update stats
        const initialStats = await mutationQueueDB.getStats();
        if (mounted) {
          setStats(initialStats);
          setIsInitialized(true);

          // Process any pending mutations if online
          if (navigator.onLine && initialStats.pendingCount > 0) {
            mutationQueueDB.processQueue();
          }
        }
      } catch (error) {
        debug.error("Failed to initialize mutation queue:", error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [agent]);

  // Subscribe to queue changes
  useEffect(() => {
    if (!isInitialized) return;

    const updateStats = async () => {
      try {
        const newStats = await mutationQueueDB.getStats();
        setStats(newStats);
        setIsProcessing(mutationQueueDB.isQueueProcessing());
      } catch (error) {
        debug.error("Failed to update queue stats:", error);
      }
    };

    const unsubscribe = mutationQueueDB.subscribe(updateStats);
    return unsubscribe;
  }, [isInitialized]);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Queue will auto-process via the DB's own listener
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const enqueue = useCallback(
    async (type: MutationType, payload: Record<string, unknown>) => {
      return mutationQueueDB.enqueue(type, payload);
    },
    [],
  );

  const triggerSync = useCallback(async () => {
    await mutationQueueDB.triggerSync();
  }, []);

  const clearQueue = useCallback(async () => {
    await mutationQueueDB.clearAll();
  }, []);

  return {
    pendingCount: stats.pendingCount,
    failedCount: stats.failedCount,
    isProcessing,
    enqueue,
    triggerSync,
    clearQueue,
    isOnline,
    isInitialized,
  };
}
