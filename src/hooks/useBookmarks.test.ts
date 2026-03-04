import type { AppBskyFeedDefs } from "@atproto/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the bookmark service before importing the hook
vi.mock("../services/bookmark-service-v2", () => ({
  bookmarkServiceV2: {
    toggleBookmark: vi.fn().mockResolvedValue(true),
    getBookmarkedPosts: vi.fn().mockResolvedValue([]),
    getBookmarkCount: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({
    showToast: vi.fn().mockReturnValue("toast-1"),
    showUndoToast: vi.fn().mockReturnValue("toast-1"),
    dismissToast: vi.fn(),
    dismissAllToasts: vi.fn(),
    getQueueStats: vi.fn().mockReturnValue({ visible: 0, queued: 0, total: 0 }),
    updateQueueConfig: vi.fn(),
  }),
}));

import { bookmarkServiceV2 } from "../services/bookmark-service-v2";
import { useBookmarks } from "./useBookmarks";

// Helper to create a minimal PostView-like object for testing
function createMockPost(uri: string): AppBskyFeedDefs.PostView {
  return {
    uri,
    cid: `cid-${uri}`,
    record: {},
    author: {
      did: "did:plc:test",
      handle: "test.bsky.social",
      displayName: "Test User",
      labels: [],
    },
    indexedAt: new Date().toISOString(),
    labels: [],
  } as unknown as AppBskyFeedDefs.PostView;
}

// Creates a QueryClientProvider wrapper for renderHook
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useBookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bookmarkServiceV2.toggleBookmark).mockResolvedValue(true);
    vi.mocked(bookmarkServiceV2.getBookmarkedPosts).mockResolvedValue([]);
    vi.mocked(bookmarkServiceV2.getBookmarkCount).mockResolvedValue(0);
  });

  it("isBookmarked returns false for unknown URIs", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });

    expect(result.current.isBookmarked("at://unknown/post/1")).toBe(false);
    expect(result.current.isBookmarked("at://unknown/post/2")).toBe(false);
  });

  it("toggleBookmark calls bookmarkServiceV2.toggleBookmark", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const mockPost = createMockPost("at://did:plc:test/app.bsky.feed.post/1");

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    await waitFor(() => {
      expect(bookmarkServiceV2.toggleBookmark).toHaveBeenCalledWith(mockPost);
    });
  });

  it("toggleBookmark optimistically flips isBookmarked immediately", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const postUri = "at://did:plc:test/app.bsky.feed.post/2";
    const mockPost = createMockPost(postUri);

    // Initially not bookmarked
    expect(result.current.isBookmarked(postUri)).toBe(false);

    // Create a deferred promise so the mutation stays pending
    let resolveToggle!: (value: boolean) => void;
    vi.mocked(bookmarkServiceV2.toggleBookmark).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveToggle = resolve;
        }),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // Optimistic update should have flipped it to true before the service resolves
    await waitFor(() => {
      expect(result.current.isBookmarked(postUri)).toBe(true);
    });

    // Now resolve the mutation
    await act(async () => {
      resolveToggle(true);
    });
  });

  it("toggleBookmark reverts optimistic update on error", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const postUri = "at://did:plc:test/app.bsky.feed.post/3";
    const mockPost = createMockPost(postUri);

    // Initially not bookmarked
    expect(result.current.isBookmarked(postUri)).toBe(false);

    // Use a deferred rejection so we can observe the optimistic state
    let rejectToggle!: (error: Error) => void;
    vi.mocked(bookmarkServiceV2.toggleBookmark).mockImplementation(
      () =>
        new Promise<boolean>((_, reject) => {
          rejectToggle = reject;
        }),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // Optimistic update should flip it to true
    await waitFor(() => {
      expect(result.current.isBookmarked(postUri)).toBe(true);
    });

    // Now reject the mutation
    await act(async () => {
      rejectToggle(new Error("Network error"));
    });

    // After mutation settles with error, it should revert back to false
    await waitFor(() => {
      expect(result.current.isBookmarked(postUri)).toBe(false);
    });
  });

  it("getSyncStatus returns 'idle' for posts with no pending operations", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });

    expect(
      result.current.getSyncStatus("at://did:plc:test/app.bsky.feed.post/99"),
    ).toBe("idle");
  });

  it("isToggling reflects mutation pending state", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const mockPost = createMockPost("at://did:plc:test/app.bsky.feed.post/4");

    // Initially not toggling
    expect(result.current.isToggling).toBe(false);

    // Hold the mutation open
    let resolveToggle!: (value: boolean) => void;
    vi.mocked(bookmarkServiceV2.toggleBookmark).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveToggle = resolve;
        }),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // While mutation is in flight, isToggling should be true
    await waitFor(() => {
      expect(result.current.isToggling).toBe(true);
    });

    // Resolve the mutation
    await act(async () => {
      resolveToggle(true);
    });

    // After mutation settles, isToggling should be false
    await waitFor(() => {
      expect(result.current.isToggling).toBe(false);
    });
  });

  it("getSyncStatus transitions to 'pending' during toggle", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const postUri = "at://did:plc:test/app.bsky.feed.post/5";
    const mockPost = createMockPost(postUri);

    // Hold the mutation open
    let resolveToggle!: (value: boolean) => void;
    vi.mocked(bookmarkServiceV2.toggleBookmark).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveToggle = resolve;
        }),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // Sync status should become "pending" once the mutation's onMutate fires
    await waitFor(() => {
      expect(result.current.getSyncStatus(postUri)).toBe("pending");
    });

    // Resolve the mutation
    await act(async () => {
      resolveToggle(true);
    });

    // After success, sync status should transition to "synced"
    await waitFor(() => {
      expect(result.current.getSyncStatus(postUri)).toBe("synced");
    });
  });

  it("getSyncStatus transitions to 'failed' on error", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const postUri = "at://did:plc:test/app.bsky.feed.post/6";
    const mockPost = createMockPost(postUri);

    vi.mocked(bookmarkServiceV2.toggleBookmark).mockRejectedValue(
      new Error("Server error"),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // After error, sync status should become "failed"
    await waitFor(() => {
      expect(result.current.getSyncStatus(postUri)).toBe("failed");
    });
  });

  it("getRetryFn returns undefined for posts with no failed operations", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });

    expect(
      result.current.getRetryFn("at://did:plc:test/app.bsky.feed.post/99"),
    ).toBeUndefined();
  });

  it("getRetryFn returns a function after a failed toggle", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    const postUri = "at://did:plc:test/app.bsky.feed.post/7";
    const mockPost = createMockPost(postUri);

    vi.mocked(bookmarkServiceV2.toggleBookmark).mockRejectedValue(
      new Error("Failed"),
    );

    act(() => {
      result.current.toggleBookmark(mockPost);
    });

    // After the mutation fails, getRetryFn should return a function
    await waitFor(() => {
      expect(result.current.getRetryFn(postUri)).toBeTypeOf("function");
    });
  });
});
