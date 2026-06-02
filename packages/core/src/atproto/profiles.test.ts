import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as profiles from "./profiles";

/**
 * Builds a minimal stub agent exposing only the methods the profile functions
 * call. Cast to BskyAgent for the call sites.
 */
function stubAgent(overrides: Record<string, unknown> = {}) {
  const agent = {
    session: { did: "did:plc:me" },
    getProfile: vi.fn().mockResolvedValue({ data: { did: "did:plc:x" } }),
    getProfiles: vi.fn().mockResolvedValue({ data: { profiles: [] } }),
    searchActors: vi
      .fn()
      .mockResolvedValue({ data: { actors: [{ did: "did:plc:found" }] } }),
    follow: vi.fn().mockResolvedValue({ uri: "at://follow/1", cid: "c" }),
    deleteFollow: vi.fn().mockResolvedValue(undefined),
    getFollowers: vi
      .fn()
      .mockResolvedValue({ data: { followers: [1], cursor: "next" } }),
    getFollows: vi
      .fn()
      .mockResolvedValue({ data: { follows: [1, 2], cursor: undefined } }),
    mute: vi.fn().mockResolvedValue(undefined),
    unmute: vi.fn().mockResolvedValue(undefined),
    app: {
      bsky: {
        graph: {
          block: {
            create: vi.fn().mockResolvedValue({ uri: "at://block/1" }),
            delete: vi.fn().mockResolvedValue(undefined),
          },
          getMutes: vi
            .fn()
            .mockResolvedValue({ data: { mutes: [], cursor: undefined } }),
          getBlocks: vi
            .fn()
            .mockResolvedValue({ data: { blocks: [], cursor: undefined } }),
        },
      },
    },
    ...overrides,
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core profiles", () => {
  it("getProfile passes the actor and returns response.data", async () => {
    const agent = stubAgent();
    const result = await profiles.getProfile(agent, "alice.test");
    expect(agent.getProfile).toHaveBeenCalledWith({ actor: "alice.test" });
    expect(result).toEqual({ did: "did:plc:x" });
  });

  it("getProfiles returns response.data", async () => {
    const agent = stubAgent();
    const result = await profiles.getProfiles(agent, ["a", "b"]);
    expect(agent.getProfiles).toHaveBeenCalledWith({ actors: ["a", "b"] });
    expect(result).toEqual({ profiles: [] });
  });

  it("searchActors returns the actors array", async () => {
    const agent = stubAgent();
    const result = await profiles.searchActors(agent, "query", 10);
    expect(agent.searchActors).toHaveBeenCalledWith({ q: "query", limit: 10 });
    expect(result).toEqual([{ did: "did:plc:found" }]);
  });

  it("followUser returns the follow response", async () => {
    const agent = stubAgent();
    const result = await profiles.followUser(agent, "did:plc:target");
    expect(agent.follow).toHaveBeenCalledWith("did:plc:target");
    expect(result.uri).toBe("at://follow/1");
  });

  it("getFollowers returns followers + cursor", async () => {
    const agent = stubAgent();
    const result = await profiles.getFollowers(agent, "alice.test");
    expect(result).toEqual({ followers: [1], cursor: "next" });
  });

  it("muteUser calls agent.mute", async () => {
    const agent = stubAgent();
    await profiles.muteUser(agent, "did:plc:x");
    expect(agent.mute).toHaveBeenCalledWith("did:plc:x");
  });

  it("blockUser creates a block record with the session repo", async () => {
    const agent = stubAgent();
    const result = await profiles.blockUser(agent, "did:plc:target");
    expect(agent.app.bsky.graph.block.create).toHaveBeenCalledWith(
      { repo: "did:plc:me" },
      expect.objectContaining({ subject: "did:plc:target" }),
    );
    expect(result.uri).toBe("at://block/1");
  });
});
