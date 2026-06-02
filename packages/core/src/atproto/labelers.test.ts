import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as labelers from "./labelers";

const LABELERS_PREF = "app.bsky.actor.defs#labelersPref";

function stubAgent(opts: { preferences?: unknown[] } = {}) {
  const putPreferences = vi.fn().mockResolvedValue(undefined);
  const agent = {
    session: { did: "did:plc:me" },
    like: vi.fn().mockResolvedValue({ uri: "at://like/1", cid: "c" }),
    deleteLike: vi.fn().mockResolvedValue(undefined),
    app: {
      bsky: {
        actor: {
          getPreferences: vi.fn().mockResolvedValue({
            data: { preferences: opts.preferences ?? [] },
          }),
          putPreferences,
          searchActors: vi.fn().mockResolvedValue({
            data: { actors: [{ did: "did:plc:found" }] },
          }),
        },
        labeler: {
          getServices: vi.fn().mockResolvedValue({
            data: {
              views: [
                {
                  $type: "app.bsky.labeler.defs#labelerViewDetailed",
                  uri: "at://labeler/1",
                  cid: "c",
                  creator: { did: "did:plc:labeler", handle: "lab.test" },
                  likeCount: 3,
                  indexedAt: "2026-01-01",
                  policies: { labelValues: ["spam"] },
                },
              ],
            },
          }),
        },
        graph: {
          getLists: vi.fn().mockResolvedValue({
            data: {
              lists: [
                {
                  uri: "at://list/mod",
                  name: "Mods",
                  purpose: "app.bsky.graph.defs#modlist",
                  creator: { did: "did:plc:me", handle: "me.test" },
                },
                {
                  uri: "at://list/curate",
                  name: "Curate",
                  purpose: "app.bsky.graph.defs#curatelist",
                  creator: { did: "did:plc:me", handle: "me.test" },
                },
              ],
            },
          }),
        },
      },
    },
    _putPreferences: putPreferences,
  };
  return agent as unknown as BskyAgent & {
    _putPreferences: typeof putPreferences;
  };
}

describe("@bsky/core labelers", () => {
  it("getSubscribedLabelers reads the labelersPref", async () => {
    const agent = stubAgent({
      preferences: [
        { $type: LABELERS_PREF, labelers: [{ did: "l1" }, { did: "l2" }] },
      ],
    });
    const res = await labelers.getSubscribedLabelers(agent);
    expect(res).toEqual([{ did: "l1" }, { did: "l2" }]);
  });

  it("getSubscribedLabelers returns [] when no labelersPref", async () => {
    const agent = stubAgent({ preferences: [] });
    expect(await labelers.getSubscribedLabelers(agent)).toEqual([]);
  });

  it("subscribeToLabeler creates a labelersPref and saves it", async () => {
    const agent = stubAgent({ preferences: [] });
    await labelers.subscribeToLabeler(agent, "did:plc:new");
    const saved = (agent as any)._putPreferences.mock.calls[0][0].preferences;
    const pref = saved.find((p: any) => p.$type === LABELERS_PREF);
    expect(pref.labelers.some((l: any) => l.did === "did:plc:new")).toBe(true);
  });

  it("getLabelerInfo maps a detailed view incl. policies, overriding did", async () => {
    const agent = stubAgent();
    const info = await labelers.getLabelerInfo(agent, "did:plc:requested");
    expect(info).not.toBeNull();
    expect(info!.did).toBe("did:plc:requested");
    expect(info!.creator.handle).toBe("lab.test");
    expect(info!.policies).toEqual({ labelValues: ["spam"] });
  });

  it("likeLabeler returns the like uri", async () => {
    const agent = stubAgent();
    expect(await labelers.likeLabeler(agent, "at://l/1", "cid")).toBe(
      "at://like/1",
    );
  });

  it("getModerationLists returns only modlist-purpose lists", async () => {
    const agent = stubAgent();
    const mods = await labelers.getModerationLists(agent);
    expect(mods).toHaveLength(1);
    expect(mods[0].uri).toBe("at://list/mod");
  });
});
