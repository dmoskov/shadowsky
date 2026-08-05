/**
 * Repairs the engagement counts displayed for *edited* posts.
 *
 * Editing a post requires delete+create at the same rkey (the AppView ignores
 * `putRecord`), and that zeroes the AppView's denormalized aggregate counters.
 * They then increment from zero on new events and never backfill, so
 * `likeCount` permanently undercounts by whatever existed at edit time.
 *
 * The underlying engagement is intact — it is keyed on the post's AT-URI, which
 * an edit preserves — so the listing endpoints (`getLikes`, `getRepostedBy`,
 * `getQuotes`) still return every liker, reposter and quoter. Counting those
 * rows recovers the true numbers. Other clients keep showing the stale
 * aggregate; we show the truth. See `packages/core/src/atproto/post-edit.ts`.
 *
 * ## Cost discipline
 *
 * Repair costs up to three extra requests per post, so it is deliberately not
 * automatic:
 *
 * - **Edited posts only.** Detected from the `updatedAt` stamp already present
 *   on the post view, so unedited posts — virtually all of them — cost nothing.
 * - **Caller opts in per post,** and feeds gate on visibility so only cards the
 *   user actually looks at are ever repaired.
 * - **Two requests in feeds, three on a focal post.** `quoteCount` is not
 *   rendered in the feed action bar, so feeds skip that request entirely.
 * - **Newest-first queue at low concurrency.** Requests beyond the concurrency
 *   cap queue rather than being dropped, and the queue drains LIFO: during a
 *   fast scroll the most recent request is the one nearest the viewport, so the
 *   work follows the user's attention instead of trailing behind it.
 * - **Cached** with a TTL, and **single-flighted** so concurrent renders of the
 *   same post share one in-flight request.
 * - **Rate limited** through the shared `postRateLimiter`, plus a global
 *   circuit breaker that stops all repair for a cooldown after a 429.
 * - **Capped at one page.** Beyond `PAGE_LIMIT` rows we stop and report
 *   `truncated`, rather than paginating through thousands of likes.
 */

import { postEdit } from "@bsky/core";
import type { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { rateLimitedPostFetch } from "./rate-limiter";

const logger = createLogger("EditedPostCounts");

/** One page only. Past this we report a floor rather than paginating. */
const PAGE_LIMIT = 100;

/** Repaired counts stay usable this long before we re-fetch. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** After a 429, stop repairing entirely for this long. */
const COOLDOWN_MS = 10 * 60 * 1000;

/** Repair is a cosmetic nicety; never let it saturate the request budget. */
const MAX_CONCURRENT = 2;

/**
 * Bound on pending repairs. A fast scroll through a feed of edited posts would
 * otherwise queue without limit; past this we discard the *oldest* pending
 * request, which is the one furthest from where the user is now looking.
 */
const MAX_QUEUE = 24;

/**
 * The minimum a post shape must expose to be repairable. Structural rather than
 * tied to `AppBskyFeedDefs.PostView`, so the app's own lighter `Post` type works
 * here too.
 */
export interface RepairablePost {
  uri: string;
  record?: unknown;
  likeCount?: number;
  repostCount?: number;
  quoteCount?: number;
}

export interface RepairedCounts {
  likeCount: number;
  repostCount: number;
  /** `null` when quotes were not measured, which is the case in feeds. */
  quoteCount: number | null;
  /** True when a listing hit `PAGE_LIMIT`, so counts are a floor, not exact. */
  truncated: boolean;
  fetchedAt: number;
}

export interface RepairOptions {
  /**
   * Fetch the quote count too. Off for feeds, where it is never displayed;
   * on for a focal post, whose action bar does show it.
   */
  includeQuotes?: boolean;
}

interface CacheEntry {
  counts: RepairedCounts;
  expiresAt: number;
}

interface QueuedRepair {
  uri: string;
  includeQuotes: boolean;
  start: () => void;
  /** Settles the waiting caller. Must be called on eviction or cancellation, or
   *  the caller's promise never resolves. */
  settle: (counts: RepairedCounts | null) => void;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<RepairedCounts | null>>();
const queue: QueuedRepair[] = [];
let activeCount = 0;
let cooldownUntil = 0;
let droppedForQueueLimit = 0;

function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  if (status === 429) return true;
  const message = (error as { message?: string }).message ?? "";
  return /rate limit/i.test(message);
}

/**
 * Read-through cache lookup. Synchronous, so render paths can use the repaired
 * numbers immediately on re-render without triggering a fetch.
 */
export function getCachedRepairedCounts(uri: string): RepairedCounts | null {
  const entry = cache.get(uri);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(uri);
    return null;
  }
  return entry.counts;
}

/** A cache entry only satisfies a caller that needs quotes if it measured them. */
function cacheSatisfies(
  counts: RepairedCounts,
  includeQuotes: boolean,
): boolean {
  return !includeQuotes || counts.quoteCount !== null;
}

/**
 * Count the rows the AppView still associates with this post.
 *
 * Returns `null` — meaning "show the aggregate as-is" — when the post was never
 * edited, when repair is in cooldown, when the queue is over its bound, or when
 * the requests fail. Repair is never worth an error surfaced to the user, so
 * failures degrade silently to Bluesky's own numbers.
 */
export async function getRepairedCounts(
  agent: BskyAgent,
  post: RepairablePost,
  options: RepairOptions = {},
): Promise<RepairedCounts | null> {
  const includeQuotes = options.includeQuotes ?? true;

  if (!postEdit.isEdited(post.record)) return null;

  const cached = getCachedRepairedCounts(post.uri);
  if (cached && cacheSatisfies(cached, includeQuotes)) return cached;

  const existing = inFlight.get(post.uri);
  if (existing) return existing;

  if (Date.now() < cooldownUntil) return null;

  const { uri } = post;
  const task = new Promise<RepairedCounts | null>((resolve) => {
    queue.push({
      uri,
      includeQuotes,
      settle: resolve,
      start: () => {
        activeCount++;
        fetchCounts(agent, uri, includeQuotes)
          .then(resolve)
          .finally(() => {
            activeCount--;
            inFlight.delete(uri);
            pump();
          });
      },
    });

    // Over the bound: shed the oldest pending request rather than the newest.
    while (queue.length > MAX_QUEUE) {
      const evicted = queue.shift();
      if (!evicted) break;
      droppedForQueueLimit++;
      inFlight.delete(evicted.uri);
      logger.log("Count repair queue full; dropped oldest pending repair", {
        uri: evicted.uri,
        droppedTotal: droppedForQueueLimit,
      });
      evicted.settle(null);
    }

    pump();
  });

  inFlight.set(uri, task);
  return task;
}

/** Drain newest-first, so queued work tracks where the user is looking now. */
function pump(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    queue.pop()?.start();
  }
}

/**
 * Withdraw a pending repair — used when a feed card scrolls away before its turn
 * comes up. A repair already in flight is left to finish and populate the cache;
 * cancelling it would waste the requests already spent.
 */
export function cancelPendingRepair(uri: string): void {
  const index = queue.findIndex((item) => item.uri === uri);
  if (index === -1) return;
  const [cancelled] = queue.splice(index, 1);
  inFlight.delete(uri);
  cancelled.settle(null);
}

async function fetchCounts(
  agent: BskyAgent,
  uri: string,
  includeQuotes: boolean,
): Promise<RepairedCounts | null> {
  try {
    // Sequential, not parallel: staggered requests through the shared limiter
    // are kinder than a simultaneous burst, and repair is never urgent.
    const likes = await rateLimitedPostFetch(() =>
      agent.getLikes({ uri, limit: PAGE_LIMIT }),
    );
    const reposts = await rateLimitedPostFetch(() =>
      agent.getRepostedBy({ uri, limit: PAGE_LIMIT }),
    );
    const quotes = includeQuotes
      ? await rateLimitedPostFetch(() =>
          agent.app.bsky.feed.getQuotes({ uri, limit: PAGE_LIMIT }),
        )
      : null;

    const likeCount = likes.data.likes.length;
    const repostCount = reposts.data.repostedBy.length;
    const quoteCount = quotes ? quotes.data.posts.length : null;

    const counts: RepairedCounts = {
      likeCount,
      repostCount,
      quoteCount,
      truncated:
        likeCount >= PAGE_LIMIT ||
        repostCount >= PAGE_LIMIT ||
        (quoteCount !== null && quoteCount >= PAGE_LIMIT),
      fetchedAt: Date.now(),
    };

    cache.set(uri, { counts, expiresAt: counts.fetchedAt + CACHE_TTL_MS });
    return counts;
  } catch (error) {
    if (isRateLimited(error)) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      logger.log("Rate limited; pausing count repair", {
        cooldownMinutes: COOLDOWN_MS / 60000,
      });
    } else {
      logger.log("Count repair failed; falling back to AppView aggregates", {
        uri,
        error,
      });
    }
    return null;
  }
}

/**
 * Overlay repaired counts on a post view, taking the higher of the two per
 * counter.
 *
 * The maximum is the right merge rather than a straight replacement: the
 * aggregate can legitimately lead a cached repair after new engagement, and a
 * truncated repair is only ever a floor. Reply count is left untouched — thread
 * views already know the real number for free.
 */
export function mergeRepairedCounts<T extends RepairablePost>(
  post: T,
  repaired: RepairedCounts | null,
): T {
  if (!repaired) return post;

  const likeCount = Math.max(post.likeCount ?? 0, repaired.likeCount);
  const repostCount = Math.max(post.repostCount ?? 0, repaired.repostCount);
  // Unmeasured quotes must not overwrite the aggregate with a phantom zero.
  const quoteCount =
    repaired.quoteCount === null
      ? (post.quoteCount ?? 0)
      : Math.max(post.quoteCount ?? 0, repaired.quoteCount);

  if (
    likeCount === (post.likeCount ?? 0) &&
    repostCount === (post.repostCount ?? 0) &&
    quoteCount === (post.quoteCount ?? 0)
  ) {
    return post; // Nothing to correct — keep referential identity for memo().
  }

  return { ...post, likeCount, repostCount, quoteCount };
}

/** Drop a post's cached repair, e.g. right after the viewer edits it. */
export function invalidateRepairedCounts(uri: string): void {
  cache.delete(uri);
}

/** Test seam / storage-settings hook. */
export function clearRepairedCountsCache(): void {
  cache.clear();
  inFlight.clear();
  for (const item of queue) item.settle(null);
  queue.length = 0;
  activeCount = 0;
  cooldownUntil = 0;
  droppedForQueueLimit = 0;
}

/** Diagnostics for the storage/debug settings panel. */
export function getRepairStats() {
  return {
    cached: cache.size,
    queued: queue.length,
    active: activeCount,
    droppedForQueueLimit,
    inCooldown: Date.now() < cooldownUntil,
  };
}
