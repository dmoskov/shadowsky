import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { TIMELINE_NEW_POST_EVENT } from "../hooks/useRealtimeUpdates";
import { rateLimitedFeedFetch } from "../services/rate-limiter";
import { createLogger } from "../utils/logger";
import { type FeedQueryData, type FeedType } from "./Home.types";
import { fetchFeedPage } from "./useHomeFeedQuery";

const logger = createLogger("useFeedFreshness");

// Cadence mirrors the official Bluesky client (social-app PostFeed):
// peek for new content every 60s, and gate any re-check (focus, realtime
// event) so it never runs more often than every 30s.
const POLL_FREQ_MS = 60_000;
const CHECK_LATEST_AFTER_MS = 30_000;

/**
 * "Peek, don't refetch" feed freshness detection, following the official
 * Bluesky client's pattern: feed content is never replaced underneath the
 * reader. Instead we periodically fetch a single newest post, compare it to
 * the top of the cached feed, and expose `hasNewPosts` so the UI can show a
 * "New posts" pill. The user pulls fresh content in via `refreshFeed`.
 *
 * Peeks run on an interval, when the tab becomes visible again, and (for
 * timeline feeds) when Jetstream reports a new post from a followed account.
 * The only automatic refetch is for an empty feed, where there is nothing
 * on screen to disturb.
 */
export function useFeedFreshness({
  feed,
  topPostUri,
  isReady,
}: {
  feed: FeedType;
  /** URI of the first post in the cached feed (unfiltered page 0 head) */
  topPostUri: string | undefined;
  /** Whether the feed query has settled (loaded without error) */
  isReady: boolean;
}) {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const [hasNewPosts, setHasNewPosts] = useState(false);

  const lastCheckRef = useRef(Date.now());
  const checkInFlightRef = useRef(false);
  const hasNewPostsRef = useRef(false);
  const topPostUriRef = useRef(topPostUri);
  const isReadyRef = useRef(isReady);
  hasNewPostsRef.current = hasNewPosts;
  topPostUriRef.current = topPostUri;
  isReadyRef.current = isReady;

  /**
   * Refresh from the top: trim the cache to a single page (like the official
   * client, rather than sequentially refetching every cached page) and
   * refetch. Clears the pill.
   */
  const refreshFeed = useCallback(async () => {
    setHasNewPosts(false);
    lastCheckRef.current = Date.now();
    queryClient.setQueryData<FeedQueryData>(["timeline", feed], (old) =>
      old && old.pages.length > 1
        ? {
            pages: old.pages.slice(0, 1),
            pageParams: old.pageParams.slice(0, 1),
          }
        : old,
    );
    await queryClient.invalidateQueries({ queryKey: ["timeline", feed] });
  }, [feed, queryClient]);

  const checkForNew = useCallback(async () => {
    if (
      !agent ||
      !isReadyRef.current ||
      hasNewPostsRef.current ||
      checkInFlightRef.current ||
      document.visibilityState === "hidden" ||
      !navigator.onLine
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_LATEST_AFTER_MS) return;
    lastCheckRef.current = now;
    checkInFlightRef.current = true;

    try {
      const response = await rateLimitedFeedFetch(() =>
        fetchFeedPage(agent, feed, { limit: 1 }),
      );
      const latestUri = response?.data?.feed?.[0]?.post?.uri;
      if (!latestUri) return;

      if (!topPostUriRef.current) {
        // Empty feed: nothing on screen to disturb, refresh directly
        await refreshFeed();
        return;
      }

      if (latestUri !== topPostUriRef.current) {
        setHasNewPosts(true);
      }
    } catch (error) {
      // Peeks are best-effort; the next interval will try again
      logger.warn(`Peek for new posts failed (${feed}):`, error);
    } finally {
      checkInFlightRef.current = false;
    }
  }, [agent, feed, refreshFeed]);

  // Reset the pill when the feed switches or its head actually changes
  // (any refresh path — pill, column refresh button — clears it for free).
  useEffect(() => {
    setHasNewPosts(false);
    lastCheckRef.current = Date.now();
  }, [feed, topPostUri]);

  // Peek on an interval while the tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      void checkForNew();
    }, POLL_FREQ_MS);
    return () => clearInterval(id);
  }, [checkForNew]);

  // Peek when the tab becomes visible again (the 30s gate in checkForNew
  // keeps quick tab flips free)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForNew();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkForNew]);

  // Jetstream fast path: a followed account just posted, so peek now instead
  // of waiting out the interval. Only meaningful for timeline feeds.
  useEffect(() => {
    if (feed !== "following" && feed !== "recent") return;
    const handleRealtimePost = () => {
      void checkForNew();
    };
    window.addEventListener(TIMELINE_NEW_POST_EVENT, handleRealtimePost);
    return () =>
      window.removeEventListener(TIMELINE_NEW_POST_EVENT, handleRealtimePost);
  }, [feed, checkForNew]);

  return { hasNewPosts, refreshFeed };
}
