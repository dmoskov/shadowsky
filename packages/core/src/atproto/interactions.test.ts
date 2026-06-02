import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as interactions from "./interactions";

function stubAgent() {
  const agent = {
    like: vi.fn().mockResolvedValue({ uri: "at://like/1", cid: "c" }),
    deleteLike: vi.fn().mockResolvedValue(undefined),
    repost: vi.fn().mockResolvedValue({ uri: "at://repost/1", cid: "c" }),
    deleteRepost: vi.fn().mockResolvedValue(undefined),
    deletePost: vi.fn().mockResolvedValue(undefined),
    getLikes: vi
      .fn()
      .mockResolvedValue({ data: { likes: [1, 2], cursor: "lc" } }),
    getRepostedBy: vi
      .fn()
      .mockResolvedValue({ data: { repostedBy: [1], cursor: undefined } }),
    app: {
      bsky: {
        feed: {
          getQuotes: vi.fn().mockResolvedValue({
            data: { posts: [{ uri: "q" }], cursor: "qc" },
          }),
        },
      },
    },
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core interactions", () => {
  it("likePost / unlikePost", async () => {
    const agent = stubAgent();
    const res = await interactions.likePost(agent, "at://post/1", "cid1");
    expect(agent.like).toHaveBeenCalledWith("at://post/1", "cid1");
    expect(res.uri).toBe("at://like/1");

    await interactions.unlikePost(agent, "at://like/1");
    expect(agent.deleteLike).toHaveBeenCalledWith("at://like/1");
  });

  it("repost / deleteRepost", async () => {
    const agent = stubAgent();
    const res = await interactions.repost(agent, "at://post/1", "cid1");
    expect(agent.repost).toHaveBeenCalledWith("at://post/1", "cid1");
    expect(res.uri).toBe("at://repost/1");

    await interactions.deleteRepost(agent, "at://repost/1");
    expect(agent.deleteRepost).toHaveBeenCalledWith("at://repost/1");
  });

  it("deletePost", async () => {
    const agent = stubAgent();
    await interactions.deletePost(agent, "at://post/1");
    expect(agent.deletePost).toHaveBeenCalledWith("at://post/1");
  });

  it("getLikes returns {likes,cursor} with limit 50", async () => {
    const agent = stubAgent();
    const res = await interactions.getLikes(agent, "at://post/1");
    expect(agent.getLikes).toHaveBeenCalledWith({
      uri: "at://post/1",
      limit: 50,
      cursor: undefined,
    });
    expect(res).toEqual({ likes: [1, 2], cursor: "lc" });
  });

  it("getRepostedBy returns {repostedBy,cursor}", async () => {
    const agent = stubAgent();
    const res = await interactions.getRepostedBy(agent, "at://post/1", "cur");
    expect(res).toEqual({ repostedBy: [1], cursor: undefined });
  });

  it("getQuotes returns {posts,cursor}", async () => {
    const agent = stubAgent();
    const res = await interactions.getQuotes(agent, "at://post/1");
    expect(res).toEqual({ posts: [{ uri: "q" }], cursor: "qc" });
  });
});
