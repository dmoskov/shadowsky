/**
 * Hook for using the offline mutation queue
 *
 * Provides:
 * - Queue status (pending count, processing state)
 * - Manual sync trigger
 * - Queue error handling
 */

import {useCallback, useEffect, useState} from 'react';
import {
  mutationQueue,
  type MutationQueueStats,
  type QueuedMutation,
} from '../services/mutation-queue';
import {getAtProtoClient} from '../services/atproto/client';

export interface UseMutationQueueReturn {
  // Queue statistics
  pendingCount: number;
  failedCount: number;
  isProcessing: boolean;

  // Queue operations
  enqueue: (
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'status'>
  ) => Promise<string>;
  retryFailed: () => Promise<void>;
  clearFailed: () => Promise<void>;

  // Queue state
  isInitialized: boolean;
}

export function useMutationQueue(): UseMutationQueueReturn {
  const [stats, setStats] = useState<MutationQueueStats>({
    pendingCount: 0,
    failedCount: 0,
    oldestAge: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize queue and set up executor
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await mutationQueue.init();

        if (!mounted) return;

        // Set up the mutation executor that uses the AT Proto client
        mutationQueue.setMutationExecutor(async (mutation: QueuedMutation) => {
          const client = getAtProtoClient();
          const agent = client.getAgent();

          const {type, targetUri, targetCid} = mutation;

          switch (type) {
            case 'like':
              if (!targetCid) {
                throw new Error('Missing CID for like mutation');
              }
              await agent.like(targetUri, targetCid);
              break;

            case 'unlike':
              await agent.deleteLike(targetUri);
              break;

            case 'repost':
              if (!targetCid) {
                throw new Error('Missing CID for repost mutation');
              }
              await agent.repost(targetUri, targetCid);
              break;

            case 'deleteRepost':
              await agent.deleteRepost(targetUri);
              break;

            case 'follow':
              await agent.follow(targetUri);
              break;

            case 'unfollow':
              await agent.deleteFollow(targetUri);
              break;

            default:
              throw new Error(`Unknown mutation type: ${type}`);
          }
        });

        // Update stats
        const initialStats = await mutationQueue.getStats();
        if (mounted) {
          setStats(initialStats);
          setIsInitialized(true);

          // Process any pending mutations
          if (initialStats.pendingCount > 0 && !mutationQueue.isQueueProcessing()) {
            mutationQueue.processQueue();
          }
        }
      } catch (error) {
        console.error('[useMutationQueue] Failed to initialize:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    if (!isInitialized) return;

    const updateStats = async () => {
      try {
        const newStats = await mutationQueue.getStats();
        const processing = mutationQueue.isQueueProcessing();
        setStats(newStats);
        setIsProcessing(processing);
      } catch (error) {
        console.error('[useMutationQueue] Failed to update stats:', error);
      }
    };

    const unsubscribe = mutationQueue.subscribe(updateStats);
    return unsubscribe;
  }, [isInitialized]);

  const enqueue = useCallback(
    async (
      mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'status'>
    ) => {
      return mutationQueue.enqueue(mutation);
    },
    []
  );

  const retryFailed = useCallback(async () => {
    await mutationQueue.retryFailed();
  }, []);

  const clearFailed = useCallback(async () => {
    await mutationQueue.clearFailed();
  }, []);

  return {
    pendingCount: stats.pendingCount,
    failedCount: stats.failedCount,
    isProcessing,
    enqueue,
    retryFailed,
    clearFailed,
    isInitialized,
  };
}
