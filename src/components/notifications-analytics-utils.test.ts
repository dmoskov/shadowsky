import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { describe, expect, it } from "vitest";
import {
  buildNotificationActivity,
  type TimeRange,
} from "./notifications-analytics-utils";

type Notification = AppBskyNotificationListNotifications.Notification;

const NOW = new Date("2026-06-03T12:00:00.000Z");

function notif(partial: {
  reason: string;
  handle: string;
  did?: string;
  hoursAgo?: number;
}): Notification {
  const indexedAt = new Date(
    NOW.getTime() - (partial.hoursAgo ?? 1) * 60 * 60 * 1000,
  ).toISOString();
  return {
    uri: `at://${partial.did ?? partial.handle}/x/${indexedAt}`,
    cid: "cid",
    reason: partial.reason,
    isRead: false,
    indexedAt,
    author: {
      did: partial.did ?? `did:plc:${partial.handle}`,
      handle: partial.handle,
    },
    record: {},
  } as unknown as Notification;
}

describe("buildNotificationActivity", () => {
  it("produces the right number of buckets per time range", () => {
    const counts: Record<TimeRange, number> = {
      "1d": 12,
      "3d": 12,
      "7d": 7,
      "4w": 28,
    };
    (Object.keys(counts) as TimeRange[]).forEach((range) => {
      const res = buildNotificationActivity([], range, NOW);
      expect(res.buckets).toHaveLength(counts[range]);
    });
  });

  it("aggregates totals and per-type counts within range", () => {
    const notifications = [
      notif({ reason: "like", handle: "a", hoursAgo: 1 }),
      notif({ reason: "like", handle: "b", hoursAgo: 2 }),
      notif({ reason: "repost", handle: "a", hoursAgo: 3 }),
      notif({ reason: "follow", handle: "c", hoursAgo: 4 }),
      notif({ reason: "reply", handle: "a", hoursAgo: 5 }),
      notif({ reason: "mention", handle: "b", hoursAgo: 6 }),
    ];
    const res = buildNotificationActivity(notifications, "1d", NOW);

    expect(res.totalEngagement).toBe(6);
    const sum = (k: "likes" | "reposts" | "follows" | "replies" | "mentions") =>
      res.buckets.reduce((acc, b) => acc + b[k], 0);
    expect(sum("likes")).toBe(2);
    expect(sum("reposts")).toBe(1);
    expect(sum("follows")).toBe(1);
    expect(sum("replies")).toBe(1);
    expect(sum("mentions")).toBe(1);
    expect(res.buckets.reduce((a, b) => a + b.total, 0)).toBe(6);
  });

  it("excludes notifications older than the cutoff", () => {
    const notifications = [
      notif({ reason: "like", handle: "a", hoursAgo: 1 }),
      notif({ reason: "like", handle: "a", hoursAgo: 100 }), // outside 1d, inside 7d
    ];
    expect(
      buildNotificationActivity(notifications, "1d", NOW).totalEngagement,
    ).toBe(1);
    // both fall within 7d
    expect(
      buildNotificationActivity(notifications, "7d", NOW).totalEngagement,
    ).toBe(2);
  });

  it("ranks top users and counts unique users", () => {
    const notifications = [
      notif({ reason: "like", handle: "a" }),
      notif({ reason: "like", handle: "a" }),
      notif({ reason: "repost", handle: "a" }),
      notif({ reason: "like", handle: "b" }),
    ];
    const res = buildNotificationActivity(notifications, "1d", NOW);
    expect(res.topUsers[0]).toMatchObject({ handle: "a", count: 3 });
    expect(res.topUsers[1]).toMatchObject({ handle: "b", count: 1 });
    expect(res.uniqueUsers).toBe(2);
  });

  it("excludes starterpack-joined from top users", () => {
    const notifications = [
      notif({ reason: "starterpack-joined", handle: "spammer" }),
      notif({ reason: "starterpack-joined", handle: "spammer" }),
      notif({ reason: "like", handle: "real" }),
    ];
    const res = buildNotificationActivity(notifications, "1d", NOW);
    expect(res.topUsers.map((u) => u.handle)).not.toContain("spammer");
    expect(res.topUsers[0]).toMatchObject({ handle: "real", count: 1 });
  });

  it("handles an empty notification set without throwing", () => {
    const res = buildNotificationActivity([], "7d", NOW);
    expect(res.totalEngagement).toBe(0);
    expect(res.uniqueUsers).toBe(0);
    expect(res.topUsers).toEqual([]);
    expect(res.daySpan).toBeGreaterThanOrEqual(1);
  });
});
