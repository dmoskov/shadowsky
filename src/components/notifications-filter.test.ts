import type {
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
} from "@atproto/api";
import { describe, expect, it } from "vitest";
import { filterNotifications } from "./notifications-filter";

type Notification = AppBskyNotificationListNotifications.Notification;

function mkNotif(
  reason: string,
  opts: { uri?: string; reasonSubject?: string; did?: string } = {},
): Notification {
  return {
    uri: opts.uri ?? `at://post/${reason}`,
    cid: "cid",
    reason,
    reasonSubject: opts.reasonSubject,
    author: { did: opts.did ?? "did:plc:author", handle: "a.test" },
    record: {},
    isRead: false,
    indexedAt: new Date().toISOString(),
  } as unknown as Notification;
}

const never = () => false;

describe("filterNotifications", () => {
  it("returns [] for empty/undefined input", () => {
    expect(
      filterNotifications(undefined, undefined, "all", undefined, never),
    ).toEqual([]);
    expect(filterNotifications([], undefined, "all", undefined, never)).toEqual(
      [],
    );
  });

  it('keeps everything for "all"', () => {
    const notifs = [mkNotif("like"), mkNotif("follow"), mkNotif("reply")];
    expect(
      filterNotifications(notifs, undefined, "all", undefined, never),
    ).toHaveLength(3);
  });

  it("filters by reason", () => {
    const notifs = [mkNotif("like"), mkNotif("repost"), mkNotif("follow")];
    const likes = filterNotifications(
      notifs,
      undefined,
      "likes",
      undefined,
      never,
    );
    expect(likes).toHaveLength(1);
    expect(likes[0].reason).toBe("like");

    const follows = filterNotifications(
      notifs,
      undefined,
      "follows",
      undefined,
      never,
    );
    expect(follows.map((n) => n.reason)).toEqual(["follow"]);
  });

  it('"from-following" keeps only authors in the following set', () => {
    const notifs = [
      mkNotif("like", { did: "did:plc:friend" }),
      mkNotif("like", { did: "did:plc:stranger" }),
    ];
    const following = new Set(["did:plc:friend"]);
    const result = filterNotifications(
      notifs,
      undefined,
      "from-following",
      following,
      never,
    );
    expect(result).toHaveLength(1);
    expect(result[0].author.did).toBe("did:plc:friend");
  });

  it("removes notifications from muted threads", () => {
    const notifs = [mkNotif("reply", { uri: "at://post/1" })];
    const posts = [
      { uri: "at://post/1", record: {} },
    ] as unknown as AppBskyFeedDefs.PostView[];
    const isMuted = (uri: string) => uri === "at://post/1";
    expect(
      filterNotifications(notifs, posts, "all", undefined, isMuted),
    ).toEqual([]);
  });

  it('"images" with no posts loaded returns []', () => {
    const notifs = [mkNotif("like")];
    expect(filterNotifications(notifs, [], "images", undefined, never)).toEqual(
      [],
    );
  });
});
