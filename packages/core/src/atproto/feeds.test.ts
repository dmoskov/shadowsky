import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as feeds from "./feeds";

function stubAgent() {
  const agent = {
    getTimeline: vi
      .fn()
      .mockResolvedValue({ data: { feed: [{ id: "t" }], cursor: "c1" } }),
    getAuthorFeed: vi
      .fn()
      .mockResolvedValue({ data: { feed: [{ id: "a" }], cursor: undefined } }),
    getActorLikes: vi
      .fn()
      .mockResolvedValue({ data: { feed: [{ id: "l" }], cursor: "c2" } }),
    getPostThread: vi
      .fn()
      .mockResolvedValue({ data: { thread: { post: { uri: "p" } } } }),
    app: {
      bsky: {
        feed: {
          getFeed: vi
            .fn()
            .mockResolvedValue({ data: { feed: [{ id: "f" }], cursor: "c3" } }),
          searchPosts: vi.fn().mockResolvedValue({
            data: { posts: [{ uri: "sp" }], cursor: "c4" },
          }),
        },
      },
    },
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core feeds", () => {
  it("getTimeline maps {feed,cursor} and defaults the limit", async () => {
    const agent = stubAgent();
    const result = await feeds.getTimeline(agent);
    expect(agent.getTimeline).toHaveBeenCalledWith({
      limit: 50,
      cursor: undefined,
    });
    expect(result).toEqual({ feed: [{ id: "t" }], cursor: "c1" });
  });

  it("getFeed forwards the feed URI + options", async () => {
    const agent = stubAgent();
    const result = await feeds.getFeed(agent, "at://feed/x", {
      limit: 10,
      cursor: "z",
    });
    expect(agent.app.bsky.feed.getFeed).toHaveBeenCalledWith({
      feed: "at://feed/x",
      limit: 10,
      cursor: "z",
    });
    expect(result.cursor).toBe("c3");
  });

  it("getAuthorFeed passes actor + filter", async () => {
    const agent = stubAgent();
    await feeds.getAuthorFeed(agent, "alice", {
      filter: "posts_with_media",
      limit: 20,
    });
    expect(agent.getAuthorFeed).toHaveBeenCalledWith({
      actor: "alice",
      limit: 20,
      cursor: undefined,
      filter: "posts_with_media",
    });
  });

  it("getActorLikes maps {feed,cursor}", async () => {
    const agent = stubAgent();
    const result = await feeds.getActorLikes(agent, "alice");
    expect(result).toEqual({ feed: [{ id: "l" }], cursor: "c2" });
  });

  it("getPostThread returns the thread union with depth/parentHeight", async () => {
    const agent = stubAgent();
    const thread = await feeds.getPostThread(agent, "at://post/1", 3, 10);
    expect(agent.getPostThread).toHaveBeenCalledWith({
      uri: "at://post/1",
      depth: 3,
      parentHeight: 10,
    });
    expect(thread).toEqual({ post: { uri: "p" } });
  });

  it("searchPosts wraps posts as feed items", async () => {
    const agent = stubAgent();
    const result = await feeds.searchPosts(agent, "cats", { sort: "latest" });
    expect(agent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
      expect.objectContaining({ q: "cats", sort: "latest", limit: 50 }),
    );
    expect(result.feed).toEqual([
      { post: { uri: "sp" }, reply: undefined, reason: undefined, feedContext: undefined },
    ]);
    expect(result.cursor).toBe("c4");
  });
});
