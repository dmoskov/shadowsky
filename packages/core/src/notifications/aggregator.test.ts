import { describe, expect, it } from "vitest";
import type { AppBskyNotificationListNotifications } from "@atproto/api";
import {
  aggregateNotifications,
  countNotificationsByType,
  filterNotificationsByType,
  filterProcessedNotifications,
} from "./aggregator";

type Notification = AppBskyNotificationListNotifications.Notification;

let seq = 0;

function makeNotification(
  reason: string,
  overrides: Partial<{
    did: string;
    indexedAt: string;
    reasonSubject: string;
    uri: string;
  }> = {},
): Notification {
  seq += 1;
  const did = overrides.did ?? `did:plc:user${seq}`;
  return {
    uri: overrides.uri ?? `at://${did}/app.bsky.feed.like/${seq}`,
    cid: `cid${seq}`,
    author: {
      did,
      handle: `user${seq}.bsky.social`,
      displayName: `User ${seq}`,
    },
    reason,
    reasonSubject: overrides.reasonSubject,
    record: {},
    isRead: false,
    indexedAt: overrides.indexedAt ?? "2026-06-01T12:00:00.000Z",
    labels: [],
  } as unknown as Notification;
}

const POST_URI = "at://did:plc:me/app.bsky.feed.post/xyz";

describe("aggregateNotifications", () => {
  it("aggregates 3+ likes on the same post into one group", () => {
    const likes = [
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
    ];
    const processed = aggregateNotifications(likes);
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({
      type: "aggregated",
      reason: "like",
      count: 3,
      targetPostUri: POST_URI,
    });
  });

  it("keeps fewer than 3 likes as singles", () => {
    const likes = [
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
    ];
    const processed = aggregateNotifications(likes);
    expect(processed).toHaveLength(2);
    expect(processed.every((p) => p.type === "single")).toBe(true);
  });

  it("aggregates follows at a lower threshold (2)", () => {
    const follows = [makeNotification("follow"), makeNotification("follow")];
    const processed = aggregateNotifications(follows);
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({
      type: "aggregated",
      reason: "follow",
      count: 2,
    });
  });

  it("does not group likes on different posts together", () => {
    const likes = [
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: "at://other/post/1" }),
    ];
    const processed = aggregateNotifications(likes);
    expect(processed).toHaveLength(3);
    expect(processed.every((p) => p.type === "single")).toBe(true);
  });

  it("never aggregates replies or mentions", () => {
    const items = [
      makeNotification("reply"),
      makeNotification("reply"),
      makeNotification("reply"),
      makeNotification("mention"),
    ];
    const processed = aggregateNotifications(items);
    expect(processed).toHaveLength(4);
    expect(processed.every((p) => p.type === "single")).toBe(true);
  });

  it("splits clusters separated by more than 24 hours", () => {
    const recent = ["12:00", "11:00", "10:00"].map((t) =>
      makeNotification("like", {
        reasonSubject: POST_URI,
        indexedAt: `2026-06-08T${t}:00.000Z`,
      }),
    );
    const stale = ["12:00", "11:00", "10:00"].map((t) =>
      makeNotification("like", {
        reasonSubject: POST_URI,
        indexedAt: `2026-06-01T${t}:00.000Z`,
      }),
    );
    const processed = aggregateNotifications([...recent, ...stale]);
    expect(processed).toHaveLength(2);
    expect(processed.every((p) => p.type === "aggregated")).toBe(true);
  });

  it("deduplicates users who triggered multiple notifications in a group", () => {
    const likes = [
      makeNotification("like", { reasonSubject: POST_URI, did: "did:plc:a" }),
      makeNotification("like", { reasonSubject: POST_URI, did: "did:plc:a" }),
      makeNotification("like", { reasonSubject: POST_URI, did: "did:plc:b" }),
    ];
    const processed = aggregateNotifications(likes);
    expect(processed).toHaveLength(1);
    const aggregated = processed[0];
    if (aggregated.type !== "aggregated") throw new Error("expected group");
    expect(aggregated.count).toBe(3);
    expect(aggregated.users).toHaveLength(2);
  });

  it("sorts newest-first across singles and groups", () => {
    const items = [
      makeNotification("reply", { indexedAt: "2026-06-05T00:00:00.000Z" }),
      makeNotification("like", {
        reasonSubject: POST_URI,
        indexedAt: "2026-06-07T00:00:00.000Z",
      }),
      makeNotification("like", {
        reasonSubject: POST_URI,
        indexedAt: "2026-06-07T01:00:00.000Z",
      }),
      makeNotification("like", {
        reasonSubject: POST_URI,
        indexedAt: "2026-06-07T02:00:00.000Z",
      }),
      makeNotification("reply", { indexedAt: "2026-06-09T00:00:00.000Z" }),
    ];
    const processed = aggregateNotifications(items);
    expect(processed).toHaveLength(3);
    expect(processed[0].type).toBe("single"); // 06-09 reply
    expect(processed[1].type).toBe("aggregated"); // 06-07 likes
    expect(processed[2].type).toBe("single"); // 06-05 reply
  });
});

describe("filterNotificationsByType", () => {
  it("filters by reason buckets", () => {
    const items = [
      makeNotification("like"),
      makeNotification("like-via-repost"),
      makeNotification("repost"),
      makeNotification("follow"),
      makeNotification("starterpack-joined"),
      makeNotification("reply"),
    ];
    expect(filterNotificationsByType(items, "all")).toHaveLength(6);
    expect(filterNotificationsByType(items, "likes")).toHaveLength(2);
    expect(filterNotificationsByType(items, "follows")).toHaveLength(2);
    expect(filterNotificationsByType(items, "replies")).toHaveLength(1);
  });
});

describe("filterProcessedNotifications", () => {
  it("filters both singles and aggregated groups", () => {
    const processed = aggregateNotifications([
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("like", { reasonSubject: POST_URI }),
      makeNotification("reply"),
    ]);
    expect(filterProcessedNotifications(processed, "likes")).toHaveLength(1);
    expect(filterProcessedNotifications(processed, "replies")).toHaveLength(1);
    expect(filterProcessedNotifications(processed, "all")).toHaveLength(2);
  });
});

describe("countNotificationsByType", () => {
  it("counts each bucket including via-repost variants", () => {
    const counts = countNotificationsByType([
      makeNotification("like"),
      makeNotification("like-via-repost"),
      makeNotification("repost-via-repost"),
      makeNotification("mention"),
      makeNotification("quote"),
    ]);
    expect(counts).toMatchObject({
      all: 5,
      likes: 2,
      reposts: 1,
      mentions: 1,
      quotes: 1,
      replies: 0,
      follows: 0,
    });
  });
});
