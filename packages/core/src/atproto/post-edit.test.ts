import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as postEdit from "./post-edit";

const DID = "did:plc:me";
const POST_URI = `at://${DID}/app.bsky.feed.post/abc123`;

/** A record as the repo would return it, with an image embed and a reply ref. */
const PRIOR_RECORD = {
  $type: "app.bsky.feed.post",
  text: "helo wrold",
  createdAt: "2026-08-05T16:04:12.618Z",
  langs: ["en"],
  facets: [{ index: { byteStart: 0, byteEnd: 4 }, features: [] }],
  tags: ["typo"],
  embed: {
    $type: "app.bsky.embed.images",
    images: [
      { alt: "pixel", image: { $type: "blob", ref: { $link: "bafkrei" } } },
    ],
  },
  reply: {
    root: { uri: "at://did:plc:other/app.bsky.feed.post/root", cid: "rootcid" },
    parent: { uri: "at://did:plc:other/app.bsky.feed.post/par", cid: "parcid" },
  },
};

function stubAgent(overrides: Record<string, unknown> = {}) {
  const applyWrites = vi.fn().mockResolvedValue({ data: {} });
  const getRecord = vi
    .fn()
    .mockResolvedValueOnce({ data: { cid: "oldcid", value: PRIOR_RECORD } })
    .mockResolvedValue({ data: { cid: "newcid", value: PRIOR_RECORD } });
  const agent = {
    session: { did: DID },
    com: { atproto: { repo: { applyWrites, getRecord, ...overrides } } },
  };
  return { agent: agent as unknown as BskyAgent, applyWrites, getRecord };
}

function postView(
  over: Partial<AppBskyFeedDefs.PostView> = {},
): AppBskyFeedDefs.PostView {
  return {
    uri: POST_URI,
    cid: "oldcid",
    author: { did: DID, handle: "me.test" },
    record: { ...PRIOR_RECORD },
    indexedAt: "2026-08-05T16:04:12.966Z",
    ...over,
  } as AppBskyFeedDefs.PostView;
}

/** Pull the create op out of an applyWrites call. */
function createOpOf(applyWrites: ReturnType<typeof vi.fn>) {
  const writes = applyWrites.mock.calls[0][0].writes;
  return writes.find((w: { $type: string }) => w.$type.endsWith("#create")) as {
    rkey: string;
    value: Record<string, unknown>;
  };
}

describe("@bsky/core post-edit", () => {
  describe("getEditedAt / isEdited", () => {
    it("reads the non-lexicon updatedAt stamp", () => {
      expect(getEdited({ updatedAt: "2026-08-05T16:45:04.676Z" })).toBe(
        "2026-08-05T16:45:04.676Z",
      );
      expect(postEdit.isEdited({ updatedAt: "2026-08-05T16:45:04.676Z" })).toBe(
        true,
      );
    });

    it("treats a record with no stamp, or a junk stamp, as unedited", () => {
      expect(getEdited(PRIOR_RECORD)).toBeNull();
      expect(getEdited({ updatedAt: "" })).toBeNull();
      expect(getEdited({ updatedAt: 42 })).toBeNull();
      expect(getEdited(undefined)).toBeNull();
      expect(getEdited("not an object")).toBeNull();
      expect(postEdit.isEdited(PRIOR_RECORD)).toBe(false);
    });

    function getEdited(r: unknown) {
      return postEdit.getEditedAt(r);
    }
  });

  describe("canEditPost", () => {
    const justAfter = new Date("2026-08-05T16:05:00.000Z");
    const wayAfter = new Date("2026-08-05T17:00:00.000Z");

    it("allows the author inside the window and reports time left", () => {
      const res = postEdit.canEditPost({
        post: postView(),
        viewerDid: DID,
        now: justAfter,
      });
      expect(res.allowed).toBe(true);
      expect(res.remainingMs).toBeGreaterThan(0);
      expect(res.remainingMs).toBeLessThanOrEqual(postEdit.EDIT_WINDOW_MS);
    });

    it("refuses a non-author", () => {
      const res = postEdit.canEditPost({
        post: postView(),
        viewerDid: "did:plc:someone-else",
        now: justAfter,
      });
      expect(res).toEqual({
        allowed: false,
        reason: "not-author",
        remainingMs: 0,
      });
    });

    it("refuses once the window has passed", () => {
      const res = postEdit.canEditPost({
        post: postView(),
        viewerDid: DID,
        now: wayAfter,
      });
      expect(res.reason).toBe("window-expired");
      expect(res.remainingMs).toBe(0);
    });

    it("refuses with no session", () => {
      expect(
        postEdit.canEditPost({ post: postView(), viewerDid: undefined }).reason,
      ).toBe("no-session");
    });

    it("refuses when createdAt is missing or unparseable", () => {
      expect(
        postEdit.canEditPost({
          post: postView({ record: { text: "x" } }),
          viewerDid: DID,
        }).reason,
      ).toBe("not-a-post");
      expect(
        postEdit.canEditPost({
          post: postView({ record: { createdAt: "nonsense" } }),
          viewerDid: DID,
        }).reason,
      ).toBe("not-a-post");
    });

    it("measures the window from createdAt, so re-editing cannot extend it", () => {
      // An already-edited post keeps its original createdAt; a later updatedAt
      // must not buy more time.
      const edited = postView({
        record: {
          ...PRIOR_RECORD,
          updatedAt: "2026-08-05T16:58:00.000Z",
        },
      });
      expect(
        postEdit.canEditPost({ post: edited, viewerDid: DID, now: wayAfter })
          .reason,
      ).toBe("window-expired");
    });
  });

  describe("describeEditCost", () => {
    it("sums the engagement that will stop being counted", () => {
      const cost = postEdit.describeEditCost(
        postView({
          likeCount: 3,
          repostCount: 1,
          quoteCount: 0,
          replyCount: 2,
        }),
      );
      expect(cost.uncountedTotal).toBe(6);
      expect(cost.rewritesExistingQuotes).toBe(false);
    });

    it("flags quote rewriting separately from the counters", () => {
      const cost = postEdit.describeEditCost(postView({ quoteCount: 1 }));
      expect(cost.rewritesExistingQuotes).toBe(true);
    });

    it("treats absent aggregates as zero", () => {
      expect(postEdit.describeEditCost(postView()).uncountedTotal).toBe(0);
    });
  });

  describe("parseAtUri", () => {
    it("splits a well-formed URI", () => {
      expect(postEdit.parseAtUri(POST_URI)).toEqual({
        did: DID,
        collection: "app.bsky.feed.post",
        rkey: "abc123",
      });
    });

    it("rejects malformed URIs", () => {
      expect(postEdit.parseAtUri("at://did:plc:me/only-two")).toBeNull();
      expect(postEdit.parseAtUri("https://bsky.app/x")).toBeNull();
      expect(postEdit.parseAtUri("")).toBeNull();
    });
  });

  describe("editPostText", () => {
    it("issues delete+create at the same rkey in one applyWrites commit", async () => {
      const { agent, applyWrites } = stubAgent();
      await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
      });

      expect(applyWrites).toHaveBeenCalledTimes(1);
      const arg = applyWrites.mock.calls[0][0];
      expect(arg.repo).toBe(DID);
      expect(arg.validate).toBe(true);
      expect(arg.writes).toHaveLength(2);
      expect(arg.writes[0]).toEqual({
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.feed.post",
        rkey: "abc123",
      });
      expect(arg.writes[1].$type).toBe("com.atproto.repo.applyWrites#create");
      expect(arg.writes[1].rkey).toBe("abc123");
    });

    it("preserves createdAt, embeds, reply refs, langs and tags", async () => {
      const { agent, applyWrites } = stubAgent();
      await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
      });

      const { value } = createOpOf(applyWrites);
      expect(value.createdAt).toBe(PRIOR_RECORD.createdAt);
      expect(value.embed).toEqual(PRIOR_RECORD.embed);
      expect(value.reply).toEqual(PRIOR_RECORD.reply);
      expect(value.langs).toEqual(["en"]);
      expect(value.tags).toEqual(["typo"]);
      expect(value.text).toBe("hello world");
    });

    it("stamps updatedAt", async () => {
      const { agent, applyWrites } = stubAgent();
      const res = await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
        editedAt: "2026-08-05T17:00:00.000Z",
      });

      expect(createOpOf(applyWrites).value.updatedAt).toBe(
        "2026-08-05T17:00:00.000Z",
      );
      expect(res.editedAt).toBe("2026-08-05T17:00:00.000Z");
    });

    it("drops stale byte-indexed fields so old offsets cannot corrupt new text", async () => {
      const { agent, applyWrites } = stubAgent({
        getRecord: vi.fn().mockResolvedValue({
          data: {
            cid: "oldcid",
            value: { ...PRIOR_RECORD, entities: [{ index: {}, type: "link" }] },
          },
        }),
      });
      await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
      });

      const { value } = createOpOf(applyWrites);
      expect(value.facets).toBeUndefined();
      expect(value.entities).toBeUndefined();
    });

    it("applies freshly computed facets when supplied", async () => {
      const { agent, applyWrites } = stubAgent();
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://x.test" },
          ],
        },
      ];
      await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
        facets: facets as never,
      });

      expect(createOpOf(applyWrites).value.facets).toEqual(facets);
    });

    it("reads the prior record from the repo, not from a post view", async () => {
      // A putRecord-edited post has a repo copy that diverges from the AppView's;
      // rebuilding from a stale view would revert it.
      const { agent, getRecord } = stubAgent();
      await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
      });

      expect(getRecord).toHaveBeenCalledWith({
        repo: DID,
        collection: "app.bsky.feed.post",
        rkey: "abc123",
      });
    });

    it("returns the new cid so callers can re-pin strong references", async () => {
      const { agent } = stubAgent();
      const res = await postEdit.editPostText(agent, {
        uri: POST_URI,
        text: "hello world",
      });
      expect(res).toMatchObject({ uri: POST_URI, cid: "newcid" });
    });

    it("refuses to edit another account's post", async () => {
      const { agent, applyWrites } = stubAgent();
      await expect(
        postEdit.editPostText(agent, {
          uri: "at://did:plc:someone-else/app.bsky.feed.post/abc123",
          text: "nope",
        }),
      ).rejects.toThrow(/only the author/);
      expect(applyWrites).not.toHaveBeenCalled();
    });

    it("refuses a non-post collection", async () => {
      const { agent } = stubAgent();
      await expect(
        postEdit.editPostText(agent, {
          uri: `at://${DID}/app.bsky.feed.like/abc123`,
          text: "nope",
        }),
      ).rejects.toThrow(/expected app\.bsky\.feed\.post/);
    });

    it("refuses a malformed URI", async () => {
      const { agent } = stubAgent();
      await expect(
        postEdit.editPostText(agent, { uri: "not-a-uri", text: "nope" }),
      ).rejects.toThrow(/malformed URI/);
    });

    it("refuses without a session", async () => {
      const { agent } = stubAgent();
      (agent as { session?: unknown }).session = undefined;
      await expect(
        postEdit.editPostText(agent, { uri: POST_URI, text: "nope" }),
      ).rejects.toThrow(/not authenticated/);
    });
  });
});
