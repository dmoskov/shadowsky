import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as lists from "./lists";

function stubAgent(overrides: { getList?: unknown } = {}) {
  const agent = {
    session: { did: "did:plc:me" },
    app: {
      bsky: {
        graph: {
          getLists: vi
            .fn()
            .mockResolvedValue({
              data: { lists: [{ uri: "l1" }], cursor: "c" },
            }),
          getList:
            overrides.getList ??
            vi.fn().mockResolvedValue({
              data: {
                list: { uri: "l1" },
                items: [{ subject: {} }],
                cursor: "c",
              },
            }),
        },
        feed: {
          getListFeed: vi
            .fn()
            .mockResolvedValue({ data: { feed: [{ id: 1 }], cursor: "c" } }),
        },
      },
    },
    com: {
      atproto: {
        repo: {
          createRecord: vi
            .fn()
            .mockResolvedValue({ data: { uri: "at://rec/1", cid: "cid" } }),
          deleteRecord: vi.fn().mockResolvedValue({}),
          putRecord: vi
            .fn()
            .mockResolvedValue({ data: { uri: "at://rec/1", cid: "cid" } }),
        },
      },
    },
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core lists", () => {
  it("getUserLists queries the session actor", async () => {
    const agent = stubAgent();
    const res = await lists.getUserLists(agent);
    expect(agent.app.bsky.graph.getLists).toHaveBeenCalledWith({
      actor: "did:plc:me",
      limit: 50,
      cursor: undefined,
    });
    expect(res).toEqual({ lists: [{ uri: "l1" }], cursor: "c" });
  });

  it("getList returns the list view", async () => {
    const agent = stubAgent();
    expect(await lists.getList(agent, "at://list/1")).toEqual({ uri: "l1" });
  });

  it("getList returns null on error", async () => {
    const agent = stubAgent({
      getList: vi.fn().mockRejectedValue(new Error("boom")),
    });
    expect(await lists.getList(agent, "at://list/1")).toBeNull();
  });

  it("createList writes a list record under the session repo", async () => {
    const agent = stubAgent();
    const res = await lists.createList(agent, "My List", "desc");
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: "did:plc:me",
        collection: "app.bsky.graph.list",
        record: expect.objectContaining({
          name: "My List",
          description: "desc",
        }),
      }),
    );
    expect(res).toEqual({ uri: "at://rec/1", cid: "cid" });
  });

  it("addUserToList writes a listitem record", async () => {
    const agent = stubAgent();
    await lists.addUserToList(agent, "at://list/1", "did:plc:friend");
    expect(agent.com.atproto.repo.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "app.bsky.graph.listitem",
        record: expect.objectContaining({
          subject: "did:plc:friend",
          list: "at://list/1",
        }),
      }),
    );
  });

  it("deleteList deletes by rkey from the URI", async () => {
    const agent = stubAgent();
    await lists.deleteList(agent, "at://did:plc:me/app.bsky.graph.list/abc123");
    expect(agent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "app.bsky.graph.list",
        rkey: "abc123",
      }),
    );
  });
});
