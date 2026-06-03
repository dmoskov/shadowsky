import type { BskyAgent } from "@atproto/api";
import { describe, expect, it, vi } from "vitest";
import * as notifications from "./notifications";

function stubAgent() {
  const agent = {
    app: {
      bsky: {
        notification: {
          listNotifications: vi.fn().mockResolvedValue({
            data: {
              notifications: [{ uri: "n1" }],
              cursor: "nc",
              seenAt: "2026-01-01T00:00:00Z",
            },
          }),
          getUnreadCount: vi.fn().mockResolvedValue({ data: { count: 7 } }),
          updateSeen: vi.fn().mockResolvedValue(undefined),
        },
      },
    },
  };
  return agent as unknown as BskyAgent;
}

describe("@bsky/core notifications", () => {
  it("getNotifications maps notifications/cursor/seenAt with default limit", async () => {
    const agent = stubAgent();
    const res = await notifications.getNotifications(agent);
    expect(agent.app.bsky.notification.listNotifications).toHaveBeenCalledWith({
      limit: 50,
      cursor: undefined,
      priority: undefined,
    });
    expect(res).toEqual({
      notifications: [{ uri: "n1" }],
      cursor: "nc",
      seenAt: "2026-01-01T00:00:00Z",
    });
  });

  it("getNotifications forwards limit, cursor and priority", async () => {
    const agent = stubAgent();
    await notifications.getNotifications(agent, {
      limit: 25,
      cursor: "abc",
      priority: true,
    });
    expect(agent.app.bsky.notification.listNotifications).toHaveBeenCalledWith({
      limit: 25,
      cursor: "abc",
      priority: true,
    });
  });

  it("getUnreadCount returns the count", async () => {
    const agent = stubAgent();
    expect(await notifications.getUnreadCount(agent)).toBe(7);
  });

  it("updateSeenNotifications passes an explicit seenAt", async () => {
    const agent = stubAgent();
    await notifications.updateSeenNotifications(agent, "2026-02-02T00:00:00Z");
    expect(agent.app.bsky.notification.updateSeen).toHaveBeenCalledWith({
      seenAt: "2026-02-02T00:00:00Z",
    });
  });

  it("updateSeenNotifications defaults seenAt to a timestamp", async () => {
    const agent = stubAgent();
    await notifications.updateSeenNotifications(agent);
    const arg = (agent.app.bsky.notification.updateSeen as any).mock
      .calls[0][0];
    expect(typeof arg.seenAt).toBe("string");
    expect(Number.isNaN(Date.parse(arg.seenAt))).toBe(false);
  });
});
