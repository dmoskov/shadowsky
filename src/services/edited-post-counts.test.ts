import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelPendingRepair,
  clearRepairedCountsCache,
  getCachedRepairedCounts,
  getRepairedCounts,
  getRepairStats,
  invalidateRepairedCounts,
  mergeRepairedCounts,
} from "./edited-post-counts";

vi.mock("./rate-limiter", () => ({
  rateLimitedPostFetch: <T>(fn: () => Promise<T>) => fn(),
}));

const URI = "at://did:plc:me/app.bsky.feed.post/abc123";

function post(over: Partial<AppBskyFeedDefs.PostView> = {}, edited = true) {
  return {
    uri: URI,
    cid: "cid",
    author: { did: "did:plc:me", handle: "me.test" },
    record: {
      $type: "app.bsky.feed.post",
      text: "hi",
      createdAt: "2026-08-05T16:04:12.618Z",
      ...(edited ? { updatedAt: "2026-08-05T16:05:00.000Z" } : {}),
    },
    indexedAt: "2026-08-05T16:04:12.966Z",
    likeCount: 0,
    repostCount: 0,
    quoteCount: 0,
    ...over,
  } as AppBskyFeedDefs.PostView;
}

function stubAgent(counts = { likes: 3, reposts: 1, quotes: 2 }) {
  const getLikes = vi.fn().mockResolvedValue({
    data: { likes: new Array(counts.likes).fill({}) },
  });
  const getRepostedBy = vi.fn().mockResolvedValue({
    data: { repostedBy: new Array(counts.reposts).fill({}) },
  });
  const getQuotes = vi.fn().mockResolvedValue({
    data: { posts: new Array(counts.quotes).fill({}) },
  });
  const agent = {
    getLikes,
    getRepostedBy,
    app: { bsky: { feed: { getQuotes } } },
  };
  return {
    agent: agent as unknown as BskyAgent,
    getLikes,
    getRepostedBy,
    getQuotes,
  };
}

describe("edited-post-counts", () => {
  beforeEach(() => clearRepairedCountsCache());

  it("counts listing rows to recover the true numbers", async () => {
    const { agent } = stubAgent();
    const repaired = await getRepairedCounts(agent, post());

    expect(repaired).toMatchObject({
      likeCount: 3,
      repostCount: 1,
      quoteCount: 2,
      truncated: false,
    });
  });

  it("skips unedited posts entirely, costing zero requests", async () => {
    const { agent, getLikes, getRepostedBy, getQuotes } = stubAgent();
    const repaired = await getRepairedCounts(agent, post({}, false));

    expect(repaired).toBeNull();
    expect(getLikes).not.toHaveBeenCalled();
    expect(getRepostedBy).not.toHaveBeenCalled();
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("caches, so a second call makes no further requests", async () => {
    const { agent, getLikes } = stubAgent();
    await getRepairedCounts(agent, post());
    await getRepairedCounts(agent, post());

    expect(getLikes).toHaveBeenCalledTimes(1);
    expect(getCachedRepairedCounts(URI)).toMatchObject({ likeCount: 3 });
  });

  it("single-flights concurrent callers onto one request", async () => {
    const { agent, getLikes } = stubAgent();
    const [a, b, c] = await Promise.all([
      getRepairedCounts(agent, post()),
      getRepairedCounts(agent, post()),
      getRepairedCounts(agent, post()),
    ]);

    expect(getLikes).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("skips the quotes request in feed mode and marks quotes unmeasured", async () => {
    const { agent, getLikes, getRepostedBy, getQuotes } = stubAgent();
    const repaired = await getRepairedCounts(agent, post(), {
      includeQuotes: false,
    });

    expect(getLikes).toHaveBeenCalledTimes(1);
    expect(getRepostedBy).toHaveBeenCalledTimes(1);
    expect(getQuotes).not.toHaveBeenCalled();
    expect(repaired).toMatchObject({
      likeCount: 3,
      repostCount: 1,
      quoteCount: null,
    });
  });

  it("re-fetches when a feed-cached entry lacks the quotes a focal view needs", async () => {
    const { agent, getQuotes } = stubAgent();
    await getRepairedCounts(agent, post(), { includeQuotes: false });
    expect(getQuotes).not.toHaveBeenCalled();

    const full = await getRepairedCounts(agent, post(), {
      includeQuotes: true,
    });
    expect(getQuotes).toHaveBeenCalledTimes(1);
    expect(full?.quoteCount).toBe(2);
  });

  it("queues past the concurrency cap instead of dropping requests", async () => {
    // Gate every request so all repairs stay in flight simultaneously.
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { agent, getLikes } = stubAgent();
    getLikes.mockImplementation(async () => {
      await gate;
      return { data: { likes: [{}, {}, {}] } };
    });

    const uris = Array.from(
      { length: 6 },
      (_, i) => `at://did:plc:me/app.bsky.feed.post/q${i}`,
    );
    const pending = uris.map((uri) => getRepairedCounts(agent, post({ uri })));

    // Concurrency cap holds; the rest wait their turn rather than resolving null.
    const stats = getRepairStats();
    expect(stats.active).toBe(2);
    expect(stats.queued).toBe(4);
    expect(stats.droppedForQueueLimit).toBe(0);

    release();
    const results = await Promise.all(pending);
    expect(results.every((r) => r?.likeCount === 3)).toBe(true);
    expect(getLikes).toHaveBeenCalledTimes(6);
  });

  it("sheds the oldest pending repair once the queue is over its bound", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { agent, getLikes } = stubAgent();
    getLikes.mockImplementation(async () => {
      await gate;
      return { data: { likes: [{}] } };
    });

    // 2 run + 24 queue capacity, so the 27th forces an eviction.
    const pending = Array.from({ length: 27 }, (_, i) =>
      getRepairedCounts(
        agent,
        post({ uri: `at://did:plc:me/app.bsky.feed.post/f${i}` }),
      ),
    );

    expect(getRepairStats().queued).toBe(24);
    expect(getRepairStats().droppedForQueueLimit).toBeGreaterThan(0);

    release();
    const results = await Promise.all(pending);
    // The evicted (oldest) request resolves null rather than hanging forever.
    expect(results.filter((r) => r === null).length).toBeGreaterThan(0);
  });

  it("cancels a queued repair without touching one already in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { agent, getLikes } = stubAgent();
    getLikes.mockImplementation(async () => {
      await gate;
      return { data: { likes: [{}] } };
    });

    const queuedUri = "at://did:plc:me/app.bsky.feed.post/c2";
    const pending = [
      getRepairedCounts(
        agent,
        post({ uri: "at://did:plc:me/app.bsky.feed.post/c0" }),
      ),
      getRepairedCounts(
        agent,
        post({ uri: "at://did:plc:me/app.bsky.feed.post/c1" }),
      ),
      getRepairedCounts(agent, post({ uri: queuedUri })),
    ];

    expect(getRepairStats().queued).toBe(1);
    cancelPendingRepair(queuedUri);
    expect(getRepairStats().queued).toBe(0);

    release();
    await Promise.all([pending[0], pending[1]]);
    // Two in-flight requests ran; the cancelled one never issued any.
    expect(getLikes).toHaveBeenCalledTimes(2);
  });

  it("reports truncated when a listing fills its page", async () => {
    const { agent } = stubAgent({ likes: 100, reposts: 0, quotes: 0 });
    const repaired = await getRepairedCounts(agent, post());

    expect(repaired?.truncated).toBe(true);
    expect(repaired?.likeCount).toBe(100);
  });

  it("degrades to null on failure rather than surfacing an error", async () => {
    const { agent } = stubAgent();
    (agent.getLikes as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );

    await expect(getRepairedCounts(agent, post())).resolves.toBeNull();
  });

  it("stops repairing after a 429 and does not retry within the cooldown", async () => {
    const { agent, getLikes } = stubAgent();
    getLikes.mockRejectedValueOnce(
      Object.assign(new Error("Rate Limit Exceeded"), { status: 429 }),
    );

    expect(await getRepairedCounts(agent, post())).toBeNull();
    // Second post, still in cooldown: must not issue another request.
    const callsAfterFirst = getLikes.mock.calls.length;
    expect(
      await getRepairedCounts(
        agent,
        post({ uri: "at://did:plc:me/app.bsky.feed.post/other" }),
      ),
    ).toBeNull();
    expect(getLikes).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("invalidates a single post's cache", async () => {
    const { agent, getLikes } = stubAgent();
    await getRepairedCounts(agent, post());
    invalidateRepairedCounts(URI);
    await getRepairedCounts(agent, post());

    expect(getLikes).toHaveBeenCalledTimes(2);
  });

  describe("mergeRepairedCounts", () => {
    it("takes the higher of aggregate and repaired per counter", () => {
      const merged = mergeRepairedCounts(
        post({ likeCount: 5, repostCount: 0 }),
        {
          likeCount: 3,
          repostCount: 1,
          quoteCount: 2,
          truncated: false,
          fetchedAt: Date.now(),
        },
      );

      // Aggregate already led on likes (new engagement since the repair).
      expect(merged.likeCount).toBe(5);
      expect(merged.repostCount).toBe(1);
      expect(merged.quoteCount).toBe(2);
    });

    it("keeps referential identity when there is nothing to correct", () => {
      const original = post({ likeCount: 3, repostCount: 1, quoteCount: 2 });
      const merged = mergeRepairedCounts(original, {
        likeCount: 3,
        repostCount: 1,
        quoteCount: 2,
        truncated: false,
        fetchedAt: Date.now(),
      });

      expect(merged).toBe(original);
    });

    it("passes the post through unchanged with no repair", () => {
      const original = post();
      expect(mergeRepairedCounts(original, null)).toBe(original);
    });

    it("does not overwrite the quote aggregate when quotes were unmeasured", () => {
      const merged = mergeRepairedCounts(post({ quoteCount: 4 }), {
        likeCount: 9,
        repostCount: 0,
        quoteCount: null,
        truncated: false,
        fetchedAt: Date.now(),
      });
      expect(merged.quoteCount).toBe(4);
      expect(merged.likeCount).toBe(9);
    });

    it("leaves replyCount alone", () => {
      const merged = mergeRepairedCounts(post({ replyCount: 4 }), {
        likeCount: 9,
        repostCount: 0,
        quoteCount: 0,
        truncated: false,
        fetchedAt: Date.now(),
      });
      expect(merged.replyCount).toBe(4);
    });
  });
});
