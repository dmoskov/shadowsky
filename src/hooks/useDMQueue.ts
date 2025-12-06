/**
 * Hook for optimistic DM sending with retry queue
 *
 * Provides:
 * - Optimistic message list with status indicators
 * - Send function that immediately shows message
 * - Retry functionality for failed messages
 * - Queue statistics
 */

import { debug } from "@bsky/shared";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { dmService, type DmMessage } from "../services/dm-service";
import {
  dmQueueDB,
  type DMQueueStats,
  type DMStatus,
  type OptimisticDM,
} from "../services/dm-queue";

export interface OptimisticMessage extends DmMessage {
  _localId?: string;
  _status?: DMStatus;
  _retryCount?: number;
  _lastError?: string;
  _isOptimistic?: boolean;
}

export interface UseDMQueueReturn {
  // Combined messages (server + optimistic)
  getOptimisticMessages: (
    serverMessages: DmMessage[],
    conversationId: string
  ) => OptimisticMessage[];

  // Send a new message optimistically
  sendMessage: (conversationId: string, text: string) => Promise<OptimisticDM>;

  // Retry a failed message
  retryMessage: (localId: string) => Promise<void>;

  // Queue statistics
  stats: DMQueueStats;

  // Queue state
  isProcessing: boolean;
  isInitialized: boolean;

  // Optimistic messages for a conversation
  optimisticMessages: Map<string, OptimisticDM[]>;
}

export function useDMQueue(): UseDMQueueReturn {
  const { session } = useAuth();
  const [stats, setStats] = useState<DMQueueStats>({
    pendingCount: 0,
    failedCount: 0,
    retryingCount: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<string, OptimisticDM[]>
  >(new Map());

  // Initialize queue and set up executor
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await dmQueueDB.init();

        if (!mounted) return;

        // Set up the message executor that actually sends DMs
        dmQueueDB.setMessageExecutor(async (dm: OptimisticDM) => {
          // Actually send the message via the DM service
          await dmService.sendMessage(dm.conversationId, dm.text);
          // The service doesn't return a message ID, so we return undefined
          return undefined;
        });

        // Load initial stats
        const initialStats = await dmQueueDB.getStats();
        if (mounted) {
          setStats(initialStats);
          setIsInitialized(true);

          // Process any pending messages if online
          if (navigator.onLine && initialStats.pendingCount > 0) {
            dmQueueDB.processQueue();
          }
        }
      } catch (error) {
        debug.error("Failed to initialize DM queue:", error);
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
        const newStats = await dmQueueDB.getStats();
        const processing = dmQueueDB.isQueueProcessing();
        setStats(newStats);
        setIsProcessing(processing);

        // Emit custom event for other listeners
        window.dispatchEvent(
          new CustomEvent("dm-queue-update", {
            detail: {
              pendingCount: newStats.pendingCount,
              failedCount: newStats.failedCount,
              isProcessing: processing,
            },
          })
        );
      } catch (error) {
        debug.error("Failed to update DM queue stats:", error);
      }
    };

    const unsubscribe = dmQueueDB.subscribe(updateStats);
    return unsubscribe;
  }, [isInitialized]);

  // Refresh optimistic messages for active conversations
  const refreshOptimisticMessages = useCallback(
    async (conversationId: string) => {
      if (!isInitialized) return;

      try {
        const messages =
          await dmQueueDB.getMessagesForConversation(conversationId);
        setOptimisticMessages((prev) => {
          const next = new Map(prev);
          if (messages.length > 0) {
            next.set(conversationId, messages);
          } else {
            next.delete(conversationId);
          }
          return next;
        });
      } catch (error) {
        debug.error("Failed to refresh optimistic messages:", error);
      }
    },
    [isInitialized]
  );

  // Subscribe to queue changes to refresh optimistic messages
  useEffect(() => {
    if (!isInitialized) return;

    const handleQueueUpdate = () => {
      // Refresh all tracked conversations
      optimisticMessages.forEach((_, conversationId) => {
        refreshOptimisticMessages(conversationId);
      });
    };

    const unsubscribe = dmQueueDB.subscribe(handleQueueUpdate);
    return unsubscribe;
  }, [isInitialized, optimisticMessages, refreshOptimisticMessages]);

  /**
   * Get combined server + optimistic messages for a conversation
   */
  const getOptimisticMessages = useCallback(
    (serverMessages: DmMessage[], conversationId: string): OptimisticMessage[] => {
      // Get optimistic messages for this conversation
      const optimistic = optimisticMessages.get(conversationId) || [];

      // Convert server messages to optimistic format
      const serverOptimistic: OptimisticMessage[] = serverMessages.map((msg) => ({
        ...msg,
        _isOptimistic: false,
      }));

      // Filter out optimistic messages that have been confirmed by server
      // (by checking if server has a message with similar text sent around the same time)
      const filteredOptimistic = optimistic.filter((opt) => {
        // Keep if status is still pending/retrying/failed
        if (opt._status !== "sent") {
          return true;
        }
        // If sent, it should be removed by the queue automatically
        return false;
      });

      // Convert optimistic to message format and merge
      const optimisticAsMessages: OptimisticMessage[] = filteredOptimistic.map(
        (opt) => ({
          id: opt._localId,
          rev: "optimistic",
          text: opt.text,
          sentAt: new Date(opt._createdAt).toISOString(),
          sender: {
            did: opt.senderDid,
          },
          _localId: opt._localId,
          _status: opt._status,
          _retryCount: opt._retryCount,
          _lastError: opt._lastError,
          _isOptimistic: true,
        })
      );

      // Merge and sort by time
      const combined = [...serverOptimistic, ...optimisticAsMessages];
      combined.sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );

      return combined;
    },
    [optimisticMessages]
  );

  /**
   * Send a message optimistically
   */
  const sendMessage = useCallback(
    async (conversationId: string, text: string): Promise<OptimisticDM> => {
      if (!session?.did) {
        throw new Error("Not authenticated");
      }

      const dm = await dmQueueDB.enqueue(conversationId, text, session.did);

      // Update local optimistic messages state
      setOptimisticMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(conversationId) || [];
        next.set(conversationId, [...existing, dm]);
        return next;
      });

      return dm;
    },
    [session?.did]
  );

  /**
   * Retry a failed message
   */
  const retryMessage = useCallback(async (localId: string): Promise<void> => {
    await dmQueueDB.retryMessage(localId);
  }, []);

  return {
    getOptimisticMessages,
    sendMessage,
    retryMessage,
    stats,
    isProcessing,
    isInitialized,
    optimisticMessages,
  };
}
