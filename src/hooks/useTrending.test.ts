/**
 * Tests for useTrending hooks
 *
 * Coverage targets:
 * 1. useTrendingTopics: returns trending topics data on success
 * 2. useTrendingTopics: handles error state
 * 3. useTrendingTopics: respects enabled=false (doesn't fetch)
 * 4. useTrends: returns trends data on success
 * 5. useTrends: handles error state
 * 6. useTrendingData: combines both queries, returns loading/error states
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TrendingTopicsResponse,
  TrendsResponse,
} from "../services/trending-service";

vi.mock("../services/trending-service", () => ({
  getTrendingTopics: vi.fn(),
  getTrends: vi.fn(),
  TRENDING_CACHE_TTL: 5 * 60 * 1000,
}));

import { getTrendingTopics, getTrends } from "../services/trending-service";
import { useTrendingData, useTrendingTopics, useTrends } from "./useTrending";

const mockTopicsResponse: TrendingTopicsResponse = {
  topics: [
    { topic: "TypeScript", link: "https://bsky.app/search?q=TypeScript" },
    { topic: "React", link: "https://bsky.app/search?q=React" },
  ],
  suggested: [{ topic: "Vitest", link: "https://bsky.app/search?q=Vitest" }],
};

const mockTrendsResponse: TrendsResponse = {
  trends: [
    {
      topic: "ai",
      displayName: "Artificial Intelligence",
      link: "https://bsky.app/search?q=ai",
      startedAt: "2026-02-24T00:00:00Z",
      postCount: 5000,
      status: "hot",
      category: "Technology",
      actors: [
        {
          did: "did:plc:abc123",
          handle: "alice.bsky.social",
          displayName: "Alice",
        },
      ],
    },
    {
      topic: "open-source",
      displayName: "Open Source",
      link: "https://bsky.app/search?q=open-source",
      postCount: 2500,
    },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useTrending hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrendingTopics).mockResolvedValue(mockTopicsResponse);
    vi.mocked(getTrends).mockResolvedValue(mockTrendsResponse);
  });

  describe("useTrendingTopics", () => {
    it("returns trending topics data on success", async () => {
      const { result } = renderHook(() => useTrendingTopics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockTopicsResponse);
      expect(result.current.data?.topics).toHaveLength(2);
      expect(result.current.data?.suggested).toHaveLength(1);
      expect(getTrendingTopics).toHaveBeenCalledWith(10, undefined);
    });

    it("passes custom limit and viewer to the service", async () => {
      const { result } = renderHook(
        () => useTrendingTopics({ limit: 5, viewer: "did:plc:user123" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(getTrendingTopics).toHaveBeenCalledWith(5, "did:plc:user123");
    });

    it("handles error state", async () => {
      const error = new Error("Failed to fetch trending topics: 500");
      vi.mocked(getTrendingTopics).mockRejectedValue(error);

      const { result } = renderHook(() => useTrendingTopics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
      expect(result.current.data).toBeUndefined();
    });

    it("respects enabled=false and does not fetch", async () => {
      const { result } = renderHook(
        () => useTrendingTopics({ enabled: false }),
        { wrapper: createWrapper() },
      );

      // When enabled is false, the query should stay in idle/pending state
      // and never call the service function
      expect(result.current.fetchStatus).toBe("idle");
      expect(getTrendingTopics).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useTrends", () => {
    it("returns trends data on success", async () => {
      const { result } = renderHook(() => useTrends(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockTrendsResponse);
      expect(result.current.data?.trends).toHaveLength(2);
      expect(result.current.data?.trends[0].topic).toBe("ai");
      expect(result.current.data?.trends[0].actors).toHaveLength(1);
      expect(getTrends).toHaveBeenCalledWith(10);
    });

    it("passes custom limit to the service", async () => {
      const { result } = renderHook(() => useTrends({ limit: 3 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(getTrends).toHaveBeenCalledWith(3);
    });

    it("handles error state", async () => {
      const error = new Error("Failed to fetch trends: 503");
      vi.mocked(getTrends).mockRejectedValue(error);

      const { result } = renderHook(() => useTrends(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
      expect(result.current.data).toBeUndefined();
    });

    it("respects enabled=false and does not fetch", async () => {
      const { result } = renderHook(() => useTrends({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getTrends).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useTrendingData", () => {
    it("combines both queries and returns structured data on success", async () => {
      const { result } = renderHook(() => useTrendingData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trending topics data
      expect(result.current.topics).toEqual(mockTopicsResponse.topics);
      expect(result.current.suggested).toEqual(mockTopicsResponse.suggested);
      expect(result.current.isLoadingTopics).toBe(false);
      expect(result.current.topicsError).toBeNull();

      // Trends data
      expect(result.current.trends).toEqual(mockTrendsResponse.trends);
      expect(result.current.isLoadingTrends).toBe(false);
      expect(result.current.trendsError).toBeNull();

      // Combined state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Refetch functions should exist
      expect(typeof result.current.refetchTopics).toBe("function");
      expect(typeof result.current.refetchTrends).toBe("function");
      expect(typeof result.current.refetchAll).toBe("function");
    });

    it("returns empty arrays while loading", () => {
      // Make the service functions never resolve during this test
      vi.mocked(getTrendingTopics).mockReturnValue(new Promise(() => {}));
      vi.mocked(getTrends).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useTrendingData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.topics).toEqual([]);
      expect(result.current.suggested).toEqual([]);
      expect(result.current.trends).toEqual([]);
    });

    it("surfaces error from trending topics query", async () => {
      const topicsError = new Error("Topics API down");
      vi.mocked(getTrendingTopics).mockRejectedValue(topicsError);

      const { result } = renderHook(() => useTrendingData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.topicsError).toBeTruthy();
      });

      expect(result.current.topicsError).toBe(topicsError);
      expect(result.current.error).toBe(topicsError);
      // Trends should still succeed independently
      expect(result.current.trends).toEqual(mockTrendsResponse.trends);
      expect(result.current.trendsError).toBeNull();
    });

    it("surfaces error from trends query", async () => {
      const trendsError = new Error("Trends API down");
      vi.mocked(getTrends).mockRejectedValue(trendsError);

      const { result } = renderHook(() => useTrendingData(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.trendsError).toBeTruthy();
      });

      expect(result.current.trendsError).toBe(trendsError);
      // Topics should still succeed independently
      expect(result.current.topics).toEqual(mockTopicsResponse.topics);
      expect(result.current.topicsError).toBeNull();
      // Combined error should reflect the trends error
      expect(result.current.error).toBe(trendsError);
    });

    it("passes options through to underlying hooks", async () => {
      const { result } = renderHook(
        () => useTrendingData({ limit: 5, viewer: "did:plc:viewer1" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(getTrendingTopics).toHaveBeenCalledWith(5, "did:plc:viewer1");
      expect(getTrends).toHaveBeenCalledWith(5);
    });
  });
});
