import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as starterPacks from "./starter-packs";

function stubAgent() {
  const agent = {
    app: {
      bsky: {
        graph: {
          getStarterPack: vi
            .fn()
            .mockResolvedValue({ data: { starterPack: { uri: "sp1" } } }),
          getActorStarterPacks: vi.fn().mockResolvedValue({
            data: { starterPacks: [{ uri: "sp1" }], cursor: "c" },
          }),
        },
      },
    },
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core starter-packs", () => {
  it("getStarterPack returns the starterPack view", async () => {
    const agent = stubAgent();
    const res = await starterPacks.getStarterPack(agent, "at://sp/1");
    expect(agent.app.bsky.graph.getStarterPack).toHaveBeenCalledWith({
      starterPack: "at://sp/1",
    });
    expect(res).toEqual({ uri: "sp1" });
  });

  it("getActorStarterPacks returns {starterPacks,cursor} with limit 50", async () => {
    const agent = stubAgent();
    const res = await starterPacks.getActorStarterPacks(agent, "alice", "cur");
    expect(agent.app.bsky.graph.getActorStarterPacks).toHaveBeenCalledWith({
      actor: "alice",
      limit: 50,
      cursor: "cur",
    });
    expect(res).toEqual({ starterPacks: [{ uri: "sp1" }], cursor: "c" });
  });
});
