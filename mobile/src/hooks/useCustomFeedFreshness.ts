/**
 * Peek-based freshness detection for custom feeds, mirroring the official
 * Bluesky client (and this repo's web useFeedFreshness): fetch a single
 * newest post from the selected feed generator on an interval, compare it
 * to the cached feed head, and signal `hasNewPosts` for the "New posts"
 * pill. Feed content is never refetched underneath the reader.
 *
 * Only used for custom feeds — the Following timeline gets its (free,
 * faster) signal from Jetstream events instead (see JetstreamContext).
 */

import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getFeed } from "../services/atproto/feeds";
import { createLogger } from "../utils/logger";

const logger = createLogger("useCustomFeedFreshness");

// Official-client cadence (social-app PostFeed): peek every 60s, and gate
// any re-check (focus, foreground) to at most once every 30s
const POLL_FREQ_MS = 60_000;
const CHECK_LATEST_AFTER_MS = 30_000;

export function useCustomFeedFreshness({
  feedUri,
  topPostUri,
  isReady,
}: {
  /** Selected custom feed URI, or null when on the Following timeline */
  feedUri: string | null;
  /** URI of the first post in the cached feed (unfiltered head) */
  topPostUri: string | undefined;
  /** Whether the feed query has settled (loaded without error) */
  isReady: boolean;
}) {
  const isScreenFocused = useIsFocused();
  const [hasNewPosts, setHasNewPosts] = useState(false);

  const lastCheckRef = useRef(Date.now());
  const checkInFlightRef = useRef(false);
  const hasNewPostsRef = useRef(false);
  const topPostUriRef = useRef(topPostUri);
  const isReadyRef = useRef(isReady);
  const isScreenFocusedRef = useRef(isScreenFocused);
  // Tracked via the AppState listener below; AppState.currentState is not
  // read directly because its shape differs across RN versions/test envs
  const isAppActiveRef = useRef(true);
  hasNewPostsRef.current = hasNewPosts;
  topPostUriRef.current = topPostUri;
  isReadyRef.current = isReady;
  isScreenFocusedRef.current = isScreenFocused;

  const checkForNew = useCallback(async () => {
    if (
      !feedUri ||
      !isReadyRef.current ||
      hasNewPostsRef.current ||
      checkInFlightRef.current ||
      !isScreenFocusedRef.current ||
      !isAppActiveRef.current
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_LATEST_AFTER_MS) return;
    lastCheckRef.current = now;
    checkInFlightRef.current = true;

    try {
      const response = await getFeed(feedUri, { limit: 1 });
      const latestUri = response?.feed?.[0]?.post?.uri;
      if (!latestUri) return;
      if (latestUri !== topPostUriRef.current) {
        setHasNewPosts(true);
      }
    } catch (error) {
      // Peeks are best-effort; the next interval will try again
      logger.log(`Peek for new posts failed (${feedUri}):`, error);
    } finally {
      checkInFlightRef.current = false;
    }
  }, [feedUri]);

  // Reset the signal when the feed switches or its head actually changes
  // (any refresh path — pill tap, pull-to-refresh — clears it for free)
  useEffect(() => {
    setHasNewPosts(false);
    lastCheckRef.current = Date.now();
  }, [feedUri, topPostUri]);

  // Peek on an interval while a custom feed is selected
  useEffect(() => {
    if (!feedUri) return;
    const id = setInterval(() => {
      void checkForNew();
    }, POLL_FREQ_MS);
    return () => clearInterval(id);
  }, [feedUri, checkForNew]);

  // Track app foreground state and peek on return to foreground (the 30s
  // gate in checkForNew keeps quick app switches free)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        isAppActiveRef.current = state === "active";
        if (state === "active") {
          void checkForNew();
        }
      },
    );
    return () => subscription.remove();
  }, [checkForNew]);

  const clearNewPosts = useCallback(() => {
    setHasNewPosts(false);
    lastCheckRef.current = Date.now();
  }, []);

  return { hasNewPosts, clearNewPosts };
}
