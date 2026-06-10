import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedQueryData } from "./Home.types";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ agent: { mock: true } }),
}));

vi.mock("../services/rate-limiter", () => ({
  rateLimitedFeedFetch: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("./useHomeFeedQuery", () => ({
  fetchFeedPage: vi.fn(),
}));

import { fetchFeedPage } from "./useHomeFeedQuery";
import { useFeedFreshness } from "./useFeedFreshness";

const mockFetchFeedPage = vi.mocked(fetchFeedPage);

function peekResponse(uri: string | undefined) {
  return {
    data: { feed: uri ? [{ post: { uri } }] : [] },
  } as Awaited<ReturnType<typeof fetchFeedPage>>;
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useFeedFreshness", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockFetchFeedPage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderFreshness(topPostUri: string | undefined) {
    return renderHook(
      () =>
        useFeedFreshness({
          feed: "following",
          topPostUri,
          isReady: true,
        }),
      { wrapper: createWrapper(queryClient) },
    );
  }

  it("shows the pill when the feed head has changed upstream", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/2"));
    const { result } = renderFreshness("at://post/1");

    // Advance past the poll interval (and the 30s gate)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(mockFetchFeedPage).toHaveBeenCalledWith(
      expect.anything(),
      "following",
      { limit: 1 },
    );
    expect(result.current.hasNewPosts).toBe(true);
  });

  it("does not show the pill when the head is unchanged", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/1"));
    const { result } = renderFreshness("at://post/1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(mockFetchFeedPage).toHaveBeenCalled();
    expect(result.current.hasNewPosts).toBe(false);
  });

  it("stops peeking once the pill is showing", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/2"));
    const { result } = renderFreshness("at://post/1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);
    const callsAfterFirst = mockFetchFeedPage.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(mockFetchFeedPage.mock.calls.length).toBe(callsAfterFirst);
  });

  it("refreshFeed trims the cache to one page, refetches, and clears the pill", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/2"));
    queryClient.setQueryData<FeedQueryData>(["timeline", "following"], {
      pages: [
        { feed: [{ post: { uri: "at://post/1" } }] },
        { feed: [{ post: { uri: "at://post/0" } }] },
      ],
      pageParams: [undefined, "cursor-1"],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderFreshness("at://post/1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);

    await act(async () => {
      await result.current.refreshFeed();
    });

    expect(result.current.hasNewPosts).toBe(false);
    const data = queryClient.getQueryData<FeedQueryData>([
      "timeline",
      "following",
    ]);
    expect(data?.pages).toHaveLength(1);
    expect(data?.pageParams).toHaveLength(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["timeline", "following"],
    });
  });

  it("refreshes directly instead of showing a pill when the feed is empty", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/2"));
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderFreshness(undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(result.current.hasNewPosts).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["timeline", "following"],
    });
  });

  it("clears the pill when the cached head catches up (external refresh)", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/2"));
    const { result, rerender } = renderHook(
      ({ topPostUri }: { topPostUri: string }) =>
        useFeedFreshness({ feed: "following", topPostUri, isReady: true }),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { topPostUri: "at://post/1" },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.hasNewPosts).toBe(true);

    act(() => {
      rerender({ topPostUri: "at://post/2" });
    });
    expect(result.current.hasNewPosts).toBe(false);
  });

  it("gates rapid re-checks to once per 30 seconds", async () => {
    mockFetchFeedPage.mockResolvedValue(peekResponse("at://post/1"));
    renderFreshness("at://post/1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(mockFetchFeedPage).toHaveBeenCalledTimes(1);

    // A visibility flip right after the poll should be a no-op
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(mockFetchFeedPage).toHaveBeenCalledTimes(1);
  });
});
