import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as threadgate from "./threadgate";

const POST_URI = "at://did:plc:me/app.bsky.feed.post/abc123";

function stubAgent(records: unknown[] = []) {
  const createRecord = vi
    .fn()
    .mockResolvedValue({ data: { uri: "at://tg/1", cid: "c" } });
  const putRecord = vi
    .fn()
    .mockResolvedValue({ data: { uri: "at://tg/1", cid: "c2" } });
  const deleteRecord = vi.fn().mockResolvedValue({});
  const listRecords = vi.fn().mockResolvedValue({ data: { records } });
  const agent = {
    session: { did: "did:plc:me" },
    com: {
      atproto: {
        repo: { createRecord, putRecord, deleteRecord, listRecords },
      },
    },
  };
  return {
    agent: agent as unknown as BskyAgent,
    createRecord,
    putRecord,
    deleteRecord,
    listRecords,
  };
}

describe("@bsky/core threadgate", () => {
  it("createThreadgate returns null for 'everyone' (no record written)", async () => {
    const { agent, createRecord } = stubAgent();
    const res = await threadgate.createThreadgate(agent, POST_URI, {
      permission: "everyone",
    });
    expect(res).toBeNull();
    expect(createRecord).not.toHaveBeenCalled();
  });

  it("createThreadgate writes a followingRule for 'following'", async () => {
    const { agent, createRecord } = stubAgent();
    await threadgate.createThreadgate(agent, POST_URI, {
      permission: "following",
    });
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "app.bsky.feed.threadgate",
        record: expect.objectContaining({
          post: POST_URI,
          allow: [{ $type: "app.bsky.feed.threadgate#followingRule" }],
        }),
      }),
    );
  });

  it("createThreadgate writes an empty allow array for 'none'", async () => {
    const { agent, createRecord } = stubAgent();
    await threadgate.createThreadgate(agent, POST_URI, { permission: "none" });
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ allow: [] }),
      }),
    );
  });

  it("updateThreadgate with 'everyone' deletes the record", async () => {
    const { agent, deleteRecord, putRecord } = stubAgent();
    const res = await threadgate.updateThreadgate(agent, POST_URI, "rk", {
      permission: "everyone",
    });
    expect(deleteRecord).toHaveBeenCalledWith({
      repo: "did:plc:me",
      collection: "app.bsky.feed.threadgate",
      rkey: "rk",
    });
    expect(putRecord).not.toHaveBeenCalled();
    expect(res).toBe(true);
  });

  it("updateThreadgate puts a mentionRule for 'mentioned'", async () => {
    const { agent, putRecord } = stubAgent();
    await threadgate.updateThreadgate(agent, POST_URI, "rk", {
      permission: "mentioned",
    });
    expect(putRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        rkey: "rk",
        record: expect.objectContaining({
          allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
        }),
      }),
    );
  });

  it("deleteThreadgate returns true on success, false on failure", async () => {
    const ok = stubAgent();
    expect(await threadgate.deleteThreadgate(ok.agent, "rk")).toBe(true);

    const fail = stubAgent();
    (fail.deleteRecord as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("nope"),
    );
    expect(await threadgate.deleteThreadgate(fail.agent, "rk")).toBe(false);
  });

  it("getThreadgate parses the matching post's record into settings", async () => {
    const { agent, listRecords } = stubAgent([
      {
        uri: "at://tg/other",
        cid: "c",
        value: {
          $type: "app.bsky.feed.threadgate",
          post: "at://did:plc:me/app.bsky.feed.post/other",
          allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
        },
      },
      {
        uri: "at://tg/match",
        cid: "c",
        value: {
          $type: "app.bsky.feed.threadgate",
          post: POST_URI,
          allow: [{ $type: "app.bsky.feed.threadgate#followingRule" }],
        },
      },
    ]);
    const res = await threadgate.getThreadgate(agent, POST_URI);
    expect(listRecords).toHaveBeenCalledWith({
      repo: "did:plc:me",
      collection: "app.bsky.feed.threadgate",
      limit: 100,
    });
    expect(res).toEqual({ permission: "following" });
  });

  it("getThreadgate returns null when no record matches the post", async () => {
    const { agent } = stubAgent([]);
    expect(await threadgate.getThreadgate(agent, POST_URI)).toBeNull();
  });

  it("canUserReply: true for everyone/none-settings, false for 'none'", async () => {
    const open = stubAgent([]); // no record -> everyone
    expect(await threadgate.canUserReply(open.agent, POST_URI, "u", "a")).toBe(
      true,
    );

    const closed = stubAgent([
      {
        uri: "at://tg/x",
        cid: "c",
        value: {
          $type: "app.bsky.feed.threadgate",
          post: POST_URI,
          allow: [],
        },
      },
    ]);
    expect(
      await threadgate.canUserReply(closed.agent, POST_URI, "u", "a"),
    ).toBe(false);
  });
});
