import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  cancelPendingRepair,
  getCachedRepairedCounts,
  getRepairedCounts,
  mergeRepairedCounts,
  type RepairablePost,
  type RepairedCounts,
} from "../services/edited-post-counts";
import { useHasBeenVisible } from "./useHasBeenVisible";

export interface UseRepairedPostCountsOptions {
  /** Set false to hold off entirely — e.g. until the card is on screen. */
  enabled?: boolean;
  /**
   * Measure quotes too. Leave off in feeds, whose action bar never shows a quote
   * count, to save a request per post.
   */
  includeQuotes?: boolean;
}

/**
 * Show the true engagement counts for an edited post.
 *
 * Editing a post zeroes the AppView's aggregate counters permanently, so an
 * edited post reads as 0 likes in every client even though the likes are still
 * attached. This recounts them from the listing endpoints and returns a post
 * with the corrected numbers; unedited posts are returned untouched, with zero
 * requests and no state updates.
 *
 * For feed rows prefer `useFeedRepairedPostCounts`, which adds visibility gating.
 */
export function useRepairedPostCounts<T extends RepairablePost>(
  post: T | undefined,
  options: UseRepairedPostCountsOptions = {},
): T | undefined {
  const { enabled = true, includeQuotes = true } = options;
  const { agent } = useAuth();
  const [repaired, setRepaired] = useState<RepairedCounts | null>(() =>
    post ? getCachedRepairedCounts(post.uri) : null,
  );

  const uri = post?.uri;

  useEffect(() => {
    if (!enabled || !agent || !post || !uri) return;

    // Serve a warm cache without a state update on the first render.
    const cached = getCachedRepairedCounts(uri);
    if (cached) {
      setRepaired(cached);
      return;
    }

    let cancelled = false;
    void getRepairedCounts(agent, post, { includeQuotes }).then((counts) => {
      if (!cancelled && counts) setRepaired(counts);
    });

    return () => {
      cancelled = true;
      // Withdraw if it never started; an in-flight repair is left to finish and
      // warm the cache for the next render of this post.
      cancelPendingRepair(uri);
    };
    // Keyed on the URI, not the post object: feed refreshes hand us a new object
    // for the same post, and re-running on that would defeat the cache.
  }, [agent, uri, enabled, includeQuotes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!post) return post;
  return mergeRepairedCounts(post, repaired);
}

/**
 * Feed-row variant: repairs only once the card is actually on screen.
 *
 * Attach the returned `ref` to the card's outer element. Nothing is requested
 * for a post the user scrolls past too fast to see, and quotes are skipped since
 * the feed action bar does not display them — so a visible edited post costs two
 * requests, and an unedited one costs nothing.
 */
export function useFeedRepairedPostCounts<
  T extends RepairablePost,
  E extends Element = HTMLElement,
>(post: T | undefined) {
  // 0px margin: only cards genuinely in view, unlike the pre-emptive default
  // used for deck columns.
  const { ref, hasBeenVisible } = useHasBeenVisible<E>("0px");
  const repairedPost = useRepairedPostCounts(post, {
    enabled: hasBeenVisible,
    includeQuotes: false,
  });

  return { ref, post: repairedPost };
}
