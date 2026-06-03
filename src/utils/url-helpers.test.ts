import { describe, expect, it } from "vitest";
import {
  atUriToBskyUrl,
  constructAtUri,
  getBskyProfileUrl,
  getNotificationUrl,
  parseBskyUrl,
} from "./url-helpers";

describe("getBskyProfileUrl", () => {
  it("builds a profile path and strips a leading @", () => {
    expect(getBskyProfileUrl("alice.bsky.social")).toBe(
      "/profile/alice.bsky.social",
    );
    expect(getBskyProfileUrl("@alice.bsky.social")).toBe(
      "/profile/alice.bsky.social",
    );
  });
});

describe("atUriToBskyUrl", () => {
  const did = "did:plc:abc";
  it("maps a feed post to a thread URL", () => {
    expect(
      atUriToBskyUrl(`at://${did}/app.bsky.feed.post/rkey1`, "alice"),
    ).toBe("/thread/alice/rkey1");
  });

  it("maps reposts and likes to the profile", () => {
    expect(atUriToBskyUrl(`at://${did}/app.bsky.feed.repost/x`, "@alice")).toBe(
      "/profile/alice",
    );
    expect(atUriToBskyUrl(`at://${did}/app.bsky.feed.like/x`, "alice")).toBe(
      "/profile/alice",
    );
  });

  it("returns null for missing args or malformed URIs", () => {
    expect(atUriToBskyUrl("", "alice")).toBeNull();
    expect(atUriToBskyUrl(`at://${did}/app.bsky.feed.post/x`, "")).toBeNull();
    expect(atUriToBskyUrl("not-a-uri", "alice")).toBeNull();
  });
});

describe("parseBskyUrl", () => {
  it("parses handle-based post URLs", () => {
    expect(parseBskyUrl("https://bsky.app/profile/alice.test/post/rk")).toEqual(
      { handle: "alice.test", postId: "rk" },
    );
  });

  it("parses DID-based post URLs", () => {
    expect(
      parseBskyUrl("https://bsky.app/profile/did:plc:abc/post/rk"),
    ).toEqual({ did: "did:plc:abc", postId: "rk" });
  });

  it("accepts relative URLs and strips query/hash from the post id", () => {
    expect(parseBskyUrl("/profile/alice/post/rk?foo=1")).toEqual({
      handle: "alice",
      postId: "rk",
    });
  });

  it("returns null for empty or non-matching URLs", () => {
    expect(parseBskyUrl("")).toBeNull();
    expect(parseBskyUrl("https://example.com/foo")).toBeNull();
  });
});

describe("constructAtUri", () => {
  it("builds a feed.post AT URI", () => {
    expect(constructAtUri("did:plc:abc", "rk")).toBe(
      "at://did:plc:abc/app.bsky.feed.post/rk",
    );
  });
});

describe("getNotificationUrl", () => {
  const author = { handle: "actor.test" };
  const did = "did:plc:abc";

  it("follow -> follower's profile", () => {
    expect(getNotificationUrl({ reason: "follow", uri: "", author })).toBe(
      "/profile/actor.test",
    );
  });

  it("like/repost -> post URL when post author handle is known", () => {
    const uri = `at://${did}/app.bsky.feed.post/rk`;
    expect(
      getNotificationUrl({ reason: "like", uri, author }, "poster.test"),
    ).toBe("/thread/poster.test/rk");
  });

  it("like/repost -> actor profile when no post author handle", () => {
    const uri = `at://${did}/app.bsky.feed.post/rk`;
    expect(getNotificationUrl({ reason: "repost", uri, author })).toBe(
      "/profile/actor.test",
    );
  });

  it("reply/mention/quote -> the author's new post", () => {
    const uri = `at://${did}/app.bsky.feed.post/rk`;
    for (const reason of ["reply", "mention", "quote"]) {
      expect(getNotificationUrl({ reason, uri, author })).toBe(
        "/thread/actor.test/rk",
      );
    }
  });
});
