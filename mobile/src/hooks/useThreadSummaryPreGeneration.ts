import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { useBookmarks } from "./api";
import { hasCachedSummary, cacheSummary } from "../services/thread-summary-cache";
import { generateThreadSummary } from "../services/ai-service";
import type { ThreadSummaryPost } from "../services/ai-service";
import { createLogger } from "../utils/logger";

const logger = createLogger("ThreadSummaryPreGen");

const MAX_PER_SESSION = 10;
const INITIAL_DELAY_MS = 5000;

/** Returns a promise that resolves after current interactions complete. */
function waitForIdle(): Promise<void> {
  return new Promise(resolve => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}

interface UseThreadSummaryPreGenerationOptions {
  enabled?: boolean;
}

export function useThreadSummaryPreGeneration({ enabled = true }: UseThreadSummaryPreGenerationOptions = {}) {
  const { bookmarks } = useBookmarks();
  const generatedCountRef = useRef(0);
  const hasStartedRef = useRef(false);
  const [isPreGenerating, setIsPreGenerating] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    if (!enabled || !bookmarks || bookmarks.length === 0 || hasStartedRef.current) return;
    hasStartedRef.current = true;

    let cancelled = false;

    const timer = setTimeout(async () => {
      // Wait until scroll/animations settle before starting work
      await waitForIdle();
      if (cancelled) return;

      // Find bookmarks with threads (5+ replies)
      const threadCandidates = bookmarks.filter(
        (b) => b.post && (b.post.replyCount || 0) >= 5,
      );

      if (threadCandidates.length === 0) return;

      setQueueSize(Math.min(threadCandidates.length, MAX_PER_SESSION));
      setIsPreGenerating(true);

      for (const bookmark of threadCandidates) {
        if (cancelled || generatedCountRef.current >= MAX_PER_SESSION) break;

        // Yield to the UI between each generation so we don't block scrolling
        await waitForIdle();
        if (cancelled) break;

        const post = bookmark.post!;
        const cacheKeyUri = `${post.uri}:tldr`;

        try {
          const cached = await hasCachedSummary(cacheKeyUri);
          if (cached) {
            setQueueSize((q) => Math.max(0, q - 1));
            continue;
          }

          const summaryPosts: ThreadSummaryPost[] = [
            {
              text: (post.record as { text?: string })?.text || "",
              author: post.author.displayName || post.author.handle,
              authorHandle: post.author.handle,
              likes: post.likeCount || 0,
              replies: post.replyCount || 0,
              reposts: post.repostCount || 0,
              uri: post.uri,
              depth: 0,
            },
          ];

          const result = await generateThreadSummary(summaryPosts, "tldr");
          await cacheSummary(cacheKeyUri, result);
          generatedCountRef.current++;
          setQueueSize((q) => Math.max(0, q - 1));
          logger.log(`Pre-generated summary for ${post.uri}`);
        } catch {
          setQueueSize((q) => Math.max(0, q - 1));
        }
      }

      if (!cancelled) {
        setIsPreGenerating(false);
      }
    }, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, bookmarks]);

  return { isPreGenerating, queueSize };
}
