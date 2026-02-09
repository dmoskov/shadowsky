/**
 * Hook for using the offline post queue
 *
 * Provides:
 * - Queue status (pending count, processing state, failed posts)
 * - Enqueue posts, replies, and DMs while offline
 * - Manual sync trigger
 * - Retry/discard failed posts
 * - Event handling for post success/failure
 */

import type { BskyAgent } from "@atproto/api";
import type { BlobRef } from "@atproto/lexicon";
import { debug } from "@bsky/shared";
import { useCallback, useEffect, useState } from "react";
import {
  offlinePostQueueDB,
  type PostQueueStats,
  type QueuedAttachment,
  type QueuedPost,
} from "../services/offline-post-queue-db";

export interface UseOfflinePostQueueReturn {
  // Queue statistics
  pendingCount: number;
  failedCount: number;
  isProcessing: boolean;
  byType: {
    post: number;
    reply: number;
    dm: number;
    quote: number;
  };

  // Queue operations
  enqueuePost: (
    text: string,
    options?: {
      attachments?: Array<{
        type: "image" | "video";
        mimeType: string;
        data: string;
        altText?: string;
      }>;
      facets?: QueuedPost["facets"];
      labels?: string[];
      langs?: string[];
      threadgate?: QueuedPost["threadgate"];
    },
  ) => Promise<string>;

  enqueueReply: (
    text: string,
    replyTo: {
      uri: string;
      cid: string;
      rootUri?: string;
      rootCid?: string;
    },
    options?: {
      attachments?: Array<{
        type: "image" | "video";
        mimeType: string;
        data: string;
        altText?: string;
      }>;
      facets?: QueuedPost["facets"];
      labels?: string[];
      langs?: string[];
    },
  ) => Promise<string>;

  enqueueQuotePost: (
    text: string,
    quotedPost: {
      uri: string;
      cid: string;
    },
    options?: {
      facets?: QueuedPost["facets"];
      labels?: string[];
      langs?: string[];
    },
  ) => Promise<string>;

  enqueueDM: (text: string, conversationId: string) => Promise<string>;

  triggerSync: () => Promise<void>;
  retryPost: (id: string) => Promise<void>;
  discardPost: (id: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  getFailedPosts: () => Promise<QueuedPost[]>;

  // Queue state
  isOnline: boolean;
  isInitialized: boolean;
}

export function useOfflinePostQueue(
  agent: BskyAgent | null,
): UseOfflinePostQueueReturn {
  const [stats, setStats] = useState<PostQueueStats>({
    pendingCount: 0,
    failedCount: 0,
    oldestPost: null,
    byType: { post: 0, reply: 0, dm: 0, quote: 0 },
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize queue and set up executor
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await offlinePostQueueDB.init();

        if (!mounted) return;

        // Set up the post executor that uses the agent
        offlinePostQueueDB.setPostExecutor(async (post: QueuedPost) => {
          if (!agent) {
            throw new Error("Not authenticated");
          }

          const {
            type,
            text,
            replyTo,
            quotedPost,
            dmConversationId,
            facets,
            labels,
            langs,
            threadgate,
            attachments,
          } = post;

          // Handle DMs
          if (type === "dm" && dmConversationId) {
            // Use the chat proxy
            const chatProxy = agent.withProxy(
              "atproto_labeler",
              "did:plc:ar7c4by46qjdydhdevvrndac",
            );
            await chatProxy.chat.bsky.convo.sendMessage({
              convoId: dmConversationId,
              message: { text },
            });
            return;
          }

          // Upload attachments first
          const uploadedImages: Array<{ alt: string; image: BlobRef }> = [];
          if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
              if (attachment.type === "image") {
                // Convert base64 to Uint8Array
                const base64Data =
                  attachment.data.split(",")[1] || attachment.data;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                const response = await agent.uploadBlob(bytes, {
                  encoding: attachment.mimeType,
                });

                uploadedImages.push({
                  alt: attachment.altText || "",
                  image: response.data.blob,
                });
              }
            }
          }

          // Build post record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const postRecord: Record<string, any> = {
            text,
            createdAt: new Date().toISOString(),
          };

          if (facets) postRecord.facets = facets;
          if (langs) postRecord.langs = langs;
          if (labels && labels.length > 0) {
            postRecord.labels = {
              $type: "com.atproto.label.defs#selfLabels",
              values: labels.map((val) => ({ val })),
            };
          }

          // Handle reply
          if (type === "reply" && replyTo) {
            postRecord.reply = {
              root: {
                uri: replyTo.rootUri || replyTo.uri,
                cid: replyTo.rootCid || replyTo.cid,
              },
              parent: {
                uri: replyTo.uri,
                cid: replyTo.cid,
              },
            };
          }

          // Handle quote post
          if (type === "quote" && quotedPost) {
            postRecord.embed = {
              $type: "app.bsky.embed.record",
              record: {
                uri: quotedPost.uri,
                cid: quotedPost.cid,
              },
            };
          }

          // Handle images (only if not a quote post)
          if (uploadedImages.length > 0 && type !== "quote") {
            postRecord.embed = {
              $type: "app.bsky.embed.images",
              images: uploadedImages,
            };
          }

          // Create the post
          const result = await agent.post(postRecord);

          // Handle threadgate if present
          if (threadgate && result.uri) {
            const allow: Array<
              | { $type: "app.bsky.feed.threadgate#mentionRule" }
              | { $type: "app.bsky.feed.threadgate#followingRule" }
              | { $type: "app.bsky.feed.threadgate#listRule"; list: string }
            > = [];
            if (threadgate.allowMentioned) {
              allow.push({ $type: "app.bsky.feed.threadgate#mentionRule" });
            }
            if (threadgate.allowFollowing) {
              allow.push({ $type: "app.bsky.feed.threadgate#followingRule" });
            }
            if (threadgate.allowLists) {
              for (const listUri of threadgate.allowLists) {
                allow.push({
                  $type: "app.bsky.feed.threadgate#listRule",
                  list: listUri,
                });
              }
            }

            if (allow.length > 0) {
              const rkey = result.uri.split("/").pop();
              await agent.api.com.atproto.repo.createRecord({
                repo: agent.session?.did || "",
                collection: "app.bsky.feed.threadgate",
                rkey,
                record: {
                  $type: "app.bsky.feed.threadgate",
                  post: result.uri,
                  allow,
                  createdAt: new Date().toISOString(),
                },
              });
            }
          }
        });

        // Update stats
        const initialStats = await offlinePostQueueDB.getStats();
        if (mounted) {
          setStats(initialStats);
          setIsInitialized(true);

          // Process any pending posts if online
          if (navigator.onLine && initialStats.pendingCount > 0) {
            offlinePostQueueDB.processQueue();
          }
        }
      } catch (error) {
        debug.error("Failed to initialize offline post queue:", error);
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
        const newStats = await offlinePostQueueDB.getStats();
        const processing = offlinePostQueueDB.isQueueProcessing();
        setStats(newStats);
        setIsProcessing(processing);

        // Emit custom event for OfflineIndicator and other listeners
        window.dispatchEvent(
          new CustomEvent("offline-post-queue-update", {
            detail: {
              pendingCount: newStats.pendingCount,
              failedCount: newStats.failedCount,
              isProcessing: processing,
              byType: newStats.byType,
            },
          }),
        );
      } catch (error) {
        debug.error("Failed to update post queue stats:", error);
      }
    };

    const unsubscribe = offlinePostQueueDB.subscribe(updateStats);
    return unsubscribe;
  }, [isInitialized]);

  // Listen for post success/failure events
  useEffect(() => {
    const handlePostSuccess = (event: CustomEvent) => {
      debug.log("Offline post succeeded:", event.detail);
    };

    const handlePostFailure = (event: CustomEvent) => {
      debug.warn("Offline post failed:", event.detail);
    };

    window.addEventListener(
      "offline-post-success",
      handlePostSuccess as EventListener,
    );
    window.addEventListener(
      "offline-post-failure",
      handlePostFailure as EventListener,
    );

    return () => {
      window.removeEventListener(
        "offline-post-success",
        handlePostSuccess as EventListener,
      );
      window.removeEventListener(
        "offline-post-failure",
        handlePostFailure as EventListener,
      );
    };
  }, []);

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

  const enqueuePost = useCallback(
    async (
      text: string,
      options?: {
        attachments?: Array<{
          type: "image" | "video";
          mimeType: string;
          data: string;
          altText?: string;
        }>;
        facets?: QueuedPost["facets"];
        labels?: string[];
        langs?: string[];
        threadgate?: QueuedPost["threadgate"];
      },
    ) => {
      const attachments: QueuedAttachment[] | undefined =
        options?.attachments?.map((a) => ({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: a.type,
          mimeType: a.mimeType,
          data: a.data,
          altText: a.altText,
          status: "pending" as const,
          retryCount: 0,
        }));

      return offlinePostQueueDB.enqueue("post", {
        text,
        attachments,
        facets: options?.facets,
        labels: options?.labels,
        langs: options?.langs,
        threadgate: options?.threadgate,
      });
    },
    [],
  );

  const enqueueReply = useCallback(
    async (
      text: string,
      replyTo: {
        uri: string;
        cid: string;
        rootUri?: string;
        rootCid?: string;
      },
      options?: {
        attachments?: Array<{
          type: "image" | "video";
          mimeType: string;
          data: string;
          altText?: string;
        }>;
        facets?: QueuedPost["facets"];
        labels?: string[];
        langs?: string[];
      },
    ) => {
      const attachments: QueuedAttachment[] | undefined =
        options?.attachments?.map((a) => ({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: a.type,
          mimeType: a.mimeType,
          data: a.data,
          altText: a.altText,
          status: "pending" as const,
          retryCount: 0,
        }));

      return offlinePostQueueDB.enqueue("reply", {
        text,
        replyTo,
        attachments,
        facets: options?.facets,
        labels: options?.labels,
        langs: options?.langs,
      });
    },
    [],
  );

  const enqueueQuotePost = useCallback(
    async (
      text: string,
      quotedPost: {
        uri: string;
        cid: string;
      },
      options?: {
        facets?: QueuedPost["facets"];
        labels?: string[];
        langs?: string[];
      },
    ) => {
      return offlinePostQueueDB.enqueue("quote", {
        text,
        quotedPost,
        facets: options?.facets,
        labels: options?.labels,
        langs: options?.langs,
      });
    },
    [],
  );

  const enqueueDM = useCallback(
    async (text: string, conversationId: string) => {
      return offlinePostQueueDB.enqueue("dm", {
        text,
        dmConversationId: conversationId,
      });
    },
    [],
  );

  const triggerSync = useCallback(async () => {
    await offlinePostQueueDB.triggerSync();
  }, []);

  const retryPost = useCallback(async (id: string) => {
    await offlinePostQueueDB.retryPost(id);
  }, []);

  const discardPost = useCallback(async (id: string) => {
    await offlinePostQueueDB.discardPost(id);
  }, []);

  const clearQueue = useCallback(async () => {
    await offlinePostQueueDB.clearAll();
  }, []);

  const getFailedPosts = useCallback(async () => {
    const all = await offlinePostQueueDB.getAllPosts();
    return all.filter((p) => p.status === "failed");
  }, []);

  return {
    pendingCount: stats.pendingCount,
    failedCount: stats.failedCount,
    isProcessing,
    byType: stats.byType,
    enqueuePost,
    enqueueReply,
    enqueueQuotePost,
    enqueueDM,
    triggerSync,
    retryPost,
    discardPost,
    clearQueue,
    getFailedPosts,
    isOnline,
    isInitialized,
  };
}
