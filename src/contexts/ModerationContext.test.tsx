import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModerationProvider, useModeration } from "./ModerationContext";

// Mock batchedStorage
const mockStorage = new Map<string, string>();

vi.mock("../services/storage/batched-local-storage", () => ({
  batchedStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
    }),
    clear: vi.fn(() => {
      mockStorage.clear();
    }),
  },
}));

// Import the mocked module
import { batchedStorage } from "../services/storage/batched-local-storage";

// Test wrapper
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ModerationProvider>{children}</ModerationProvider>;
  };
}

describe("ModerationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe("useModeration hook", () => {
    it("should throw error when used outside ModerationProvider", () => {
      expect(() => {
        renderHook(() => useModeration());
      }).toThrow("useModeration must be used within a ModerationProvider");
    });
  });

  describe("Initial State", () => {
    it("should start with empty sets when no data in localStorage", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutedUsers.size).toBe(0);
      expect(result.current.mutedThreads.size).toBe(0);
      expect(result.current.blockedUsers.size).toBe(0);
    });

    it("should load muted users from localStorage on mount", () => {
      const mutedUsersList = ["did:plc:user1", "did:plc:user2"];
      mockStorage.set("shadowsky_muted_users", JSON.stringify(mutedUsersList));

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutedUsers.size).toBe(2);
      expect(result.current.mutedUsers.has("did:plc:user1")).toBe(true);
      expect(result.current.mutedUsers.has("did:plc:user2")).toBe(true);
    });

    it("should load muted threads from localStorage on mount", () => {
      const mutedThreadsList = [
        "at://did:plc:user1/app.bsky.feed.post/thread1",
        "at://did:plc:user2/app.bsky.feed.post/thread2",
      ];
      mockStorage.set(
        "shadowsky_muted_threads",
        JSON.stringify(mutedThreadsList),
      );

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutedThreads.size).toBe(2);
      expect(
        result.current.mutedThreads.has(
          "at://did:plc:user1/app.bsky.feed.post/thread1",
        ),
      ).toBe(true);
      expect(
        result.current.mutedThreads.has(
          "at://did:plc:user2/app.bsky.feed.post/thread2",
        ),
      ).toBe(true);
    });

    it("should load blocked users from localStorage on mount", () => {
      const blockedUsersList = ["did:plc:blocked1", "did:plc:blocked2"];
      mockStorage.set(
        "shadowsky_blocked_users",
        JSON.stringify(blockedUsersList),
      );

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.blockedUsers.size).toBe(2);
      expect(result.current.blockedUsers.has("did:plc:blocked1")).toBe(true);
      expect(result.current.blockedUsers.has("did:plc:blocked2")).toBe(true);
    });

    it("should handle corrupted data in localStorage gracefully", () => {
      mockStorage.set("shadowsky_muted_users", "invalid json");
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutedUsers.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to load moderation data:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("User Muting", () => {
    it("should mute a user", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
      });

      expect(result.current.mutedUsers.has("did:plc:user1")).toBe(true);
      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
    });

    it("should unmute a user", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
      });

      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);

      act(() => {
        result.current.unmuteUser("did:plc:user1");
      });

      expect(result.current.isUserMuted("did:plc:user1")).toBe(false);
      expect(result.current.mutedUsers.has("did:plc:user1")).toBe(false);
    });

    it("should mute multiple users", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
        result.current.muteUser("did:plc:user2");
        result.current.muteUser("did:plc:user3");
      });

      expect(result.current.mutedUsers.size).toBe(3);
      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
      expect(result.current.isUserMuted("did:plc:user2")).toBe(true);
      expect(result.current.isUserMuted("did:plc:user3")).toBe(true);
    });

    it("should handle muting the same user multiple times", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
        result.current.muteUser("did:plc:user1");
        result.current.muteUser("did:plc:user1");
      });

      expect(result.current.mutedUsers.size).toBe(1);
      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
    });

    it("should persist muted users to localStorage", async () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
      });

      await waitFor(() => {
        expect(batchedStorage.setItem).toHaveBeenCalledWith(
          "shadowsky_muted_users",
          JSON.stringify(["did:plc:user1"]),
        );
      });
    });

    it("should handle storage errors when saving muted users", async () => {
      vi.mocked(batchedStorage.setItem).mockImplementationOnce(() => {
        throw new Error("Storage quota exceeded");
      });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to save muted users:",
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it("should return false for non-muted users", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isUserMuted("did:plc:notmuted")).toBe(false);
    });
  });

  describe("Thread Muting", () => {
    it("should mute a thread", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const threadUri = "at://did:plc:user1/app.bsky.feed.post/thread1";

      act(() => {
        result.current.muteThread(threadUri);
      });

      expect(result.current.mutedThreads.has(threadUri)).toBe(true);
      expect(result.current.isThreadMuted(threadUri)).toBe(true);
    });

    it("should unmute a thread", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const threadUri = "at://did:plc:user1/app.bsky.feed.post/thread1";

      act(() => {
        result.current.muteThread(threadUri);
      });

      expect(result.current.isThreadMuted(threadUri)).toBe(true);

      act(() => {
        result.current.unmuteThread(threadUri);
      });

      expect(result.current.isThreadMuted(threadUri)).toBe(false);
      expect(result.current.mutedThreads.has(threadUri)).toBe(false);
    });

    it("should mute multiple threads", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const thread1 = "at://did:plc:user1/app.bsky.feed.post/thread1";
      const thread2 = "at://did:plc:user2/app.bsky.feed.post/thread2";
      const thread3 = "at://did:plc:user3/app.bsky.feed.post/thread3";

      act(() => {
        result.current.muteThread(thread1);
        result.current.muteThread(thread2);
        result.current.muteThread(thread3);
      });

      expect(result.current.mutedThreads.size).toBe(3);
      expect(result.current.isThreadMuted(thread1)).toBe(true);
      expect(result.current.isThreadMuted(thread2)).toBe(true);
      expect(result.current.isThreadMuted(thread3)).toBe(true);
    });

    it("should persist muted threads to localStorage", async () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const threadUri = "at://did:plc:user1/app.bsky.feed.post/thread1";

      act(() => {
        result.current.muteThread(threadUri);
      });

      await waitFor(() => {
        expect(batchedStorage.setItem).toHaveBeenCalledWith(
          "shadowsky_muted_threads",
          JSON.stringify([threadUri]),
        );
      });
    });

    it("should handle storage errors when saving muted threads", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      // Mock setItem to throw on the second call (first is for muted users initialization, second is for muted threads)
      let callCount = 0;
      vi.mocked(batchedStorage.setItem).mockImplementation((key, value) => {
        if (key === "shadowsky_muted_threads") {
          throw new Error("Storage quota exceeded");
        }
        mockStorage.set(key, value);
      });

      const threadUri = "at://did:plc:user1/app.bsky.feed.post/thread1";

      act(() => {
        result.current.muteThread(threadUri);
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to save muted threads:",
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it("should return false for non-muted threads", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(
        result.current.isThreadMuted(
          "at://did:plc:user1/app.bsky.feed.post/notmuted",
        ),
      ).toBe(false);
    });
  });

  describe("User Blocking", () => {
    it("should block a user", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.blockUser("did:plc:user1");
      });

      expect(result.current.blockedUsers.has("did:plc:user1")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user1")).toBe(true);
    });

    it("should unblock a user", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.blockUser("did:plc:user1");
      });

      expect(result.current.isUserBlocked("did:plc:user1")).toBe(true);

      act(() => {
        result.current.unblockUser("did:plc:user1");
      });

      expect(result.current.isUserBlocked("did:plc:user1")).toBe(false);
      expect(result.current.blockedUsers.has("did:plc:user1")).toBe(false);
    });

    it("should block multiple users", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.blockUser("did:plc:user1");
        result.current.blockUser("did:plc:user2");
        result.current.blockUser("did:plc:user3");
      });

      expect(result.current.blockedUsers.size).toBe(3);
      expect(result.current.isUserBlocked("did:plc:user1")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user2")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user3")).toBe(true);
    });

    it("should persist blocked users to localStorage", async () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.blockUser("did:plc:user1");
      });

      await waitFor(() => {
        expect(batchedStorage.setItem).toHaveBeenCalledWith(
          "shadowsky_blocked_users",
          JSON.stringify(["did:plc:user1"]),
        );
      });
    });

    it("should handle storage errors when saving blocked users", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      // Mock setItem to throw only for blocked users
      vi.mocked(batchedStorage.setItem).mockImplementation((key, value) => {
        if (key === "shadowsky_blocked_users") {
          throw new Error("Storage quota exceeded");
        }
        mockStorage.set(key, value);
      });

      act(() => {
        result.current.blockUser("did:plc:user1");
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to save blocked users:",
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it("should return false for non-blocked users", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isUserBlocked("did:plc:notblocked")).toBe(false);
    });
  });

  describe("Combined Operations", () => {
    it("should handle muting and blocking the same user", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
        result.current.blockUser("did:plc:user1");
      });

      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user1")).toBe(true);
    });

    it("should maintain independence between muted and blocked users", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
        result.current.blockUser("did:plc:user2");
      });

      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user1")).toBe(false);

      expect(result.current.isUserMuted("did:plc:user2")).toBe(false);
      expect(result.current.isUserBlocked("did:plc:user2")).toBe(true);
    });

    it("should handle unblocking while still muted", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.muteUser("did:plc:user1");
        result.current.blockUser("did:plc:user1");
      });

      act(() => {
        result.current.unblockUser("did:plc:user1");
      });

      expect(result.current.isUserMuted("did:plc:user1")).toBe(true);
      expect(result.current.isUserBlocked("did:plc:user1")).toBe(false);
    });

    it("should load all types of moderation data from localStorage", () => {
      mockStorage.set(
        "shadowsky_muted_users",
        JSON.stringify(["did:plc:muted1"]),
      );
      mockStorage.set(
        "shadowsky_muted_threads",
        JSON.stringify(["at://did:plc:user1/app.bsky.feed.post/thread1"]),
      );
      mockStorage.set(
        "shadowsky_blocked_users",
        JSON.stringify(["did:plc:blocked1"]),
      );

      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutedUsers.size).toBe(1);
      expect(result.current.mutedThreads.size).toBe(1);
      expect(result.current.blockedUsers.size).toBe(1);

      expect(result.current.isUserMuted("did:plc:muted1")).toBe(true);
      expect(
        result.current.isThreadMuted(
          "at://did:plc:user1/app.bsky.feed.post/thread1",
        ),
      ).toBe(true);
      expect(result.current.isUserBlocked("did:plc:blocked1")).toBe(true);
    });
  });

  describe("Context Value Memoization", () => {
    it("should not re-render consumers unnecessarily", () => {
      const { result, rerender } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const initialContextValue = result.current;

      // Rerender without any state changes
      rerender();

      // Context value reference should remain the same due to useMemo
      expect(result.current).toBe(initialContextValue);
    });

    it("should update context value when state changes", () => {
      const { result } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const initialContextValue = result.current;

      act(() => {
        result.current.muteUser("did:plc:user1");
      });

      // Context value should be different after state change
      expect(result.current).not.toBe(initialContextValue);
    });
  });

  describe("Callback Stability", () => {
    it("should have stable callback references", () => {
      const { result, rerender } = renderHook(() => useModeration(), {
        wrapper: createWrapper(),
      });

      const initialMuteUser = result.current.muteUser;
      const initialUnmuteUser = result.current.unmuteUser;
      const initialMuteThread = result.current.muteThread;
      const initialUnmuteThread = result.current.unmuteThread;
      const initialBlockUser = result.current.blockUser;
      const initialUnblockUser = result.current.unblockUser;

      rerender();

      // Callbacks should maintain the same reference due to useCallback
      expect(result.current.muteUser).toBe(initialMuteUser);
      expect(result.current.unmuteUser).toBe(initialUnmuteUser);
      expect(result.current.muteThread).toBe(initialMuteThread);
      expect(result.current.unmuteThread).toBe(initialUnmuteThread);
      expect(result.current.blockUser).toBe(initialBlockUser);
      expect(result.current.unblockUser).toBe(initialUnblockUser);
    });
  });
});
