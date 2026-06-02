import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as postgate from "./postgate";

function stubAgent(overrides: Record<string, unknown> = {}) {
  const createRecord = vi
    .fn()
    .mockResolvedValue({ data: { uri: "at://pg/1", cid: "c" } });
  const deleteRecord = vi.fn().mockResolvedValue({});
  const agent = {
    session: { did: "did:plc:me" },
    com: {
      atproto: {
        repo: { createRecord, deleteRecord, ...overrides },
      },
    },
  };
  return { agent: agent as unknown as BskyAgent, createRecord, deleteRecord };
}

const POST_URI = "at://did:plc:me/app.bsky.feed.post/abc123";

describe("@bsky/core postgate", () => {
  it("createPostgate writes a disable-embedding record keyed by the post rkey", async () => {
    const { agent, createRecord } = stubAgent();
    const res = await postgate.createPostgate(agent, POST_URI);

    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: "did:plc:me",
        collection: "app.bsky.feed.postgate",
        rkey: "abc123",
        record: expect.objectContaining({
          $type: "app.bsky.feed.postgate",
          post: POST_URI,
          embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
        }),
      }),
    );
    expect(res).toEqual({ uri: "at://pg/1", cid: "c" });
  });

  it("createPostgate throws on a URI with no rkey", async () => {
    const { agent, createRecord } = stubAgent();
    await expect(postgate.createPostgate(agent, "")).rejects.toThrow(
      /cannot extract rkey/,
    );
    expect(createRecord).not.toHaveBeenCalled();
  });

  it("deletePostgate removes the record and returns true", async () => {
    const { agent, deleteRecord } = stubAgent();
    const ok = await postgate.deletePostgate(agent, POST_URI);

    expect(deleteRecord).toHaveBeenCalledWith({
      repo: "did:plc:me",
      collection: "app.bsky.feed.postgate",
      rkey: "abc123",
    });
    expect(ok).toBe(true);
  });

  it("deletePostgate returns false when the delete fails", async () => {
    const { agent } = stubAgent({
      deleteRecord: vi.fn().mockRejectedValue(new Error("boom")),
    });
    expect(await postgate.deletePostgate(agent, POST_URI)).toBe(false);
  });
});
