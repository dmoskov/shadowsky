import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must be declared before importing the hook) ---

const mockSearchPosts = vi.fn();

const mockAgent = {
  app: {
    bsky: {
      feed: {
        searchPosts: mockSearchPosts,
      },
    },
  },
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ agent: mockAgent })),
}));

// Mock useDebounce to return value immediately (no delay)
vi.mock("./useDebounce", () => ({
  useDebounce: vi.fn((value: string) => value),
}));

const mockDB = vi.hoisted(() => ({
  getSearchHistory: vi.fn().mockResolvedValue([]),
  addSearchEntry: vi.fn().mockResolvedValue(undefined),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  clearHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/search-history-db", () => ({
  getSearchHistoryDB: vi.fn().mockResolvedValue(mockDB),
}));

import { useSearch } from "./useSearch";

// --- Helpers ---

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

function makeMockPost(overrides: Record<string, unknown> = {}) {
  return {
    uri: "at://did:plc:author/app.bsky.feed.post/1",
    cid: "cid1",
    author: { did: "did:plc:author", handle: "author.bsky.social" },
    record: { text: "Test post", createdAt: new Date().toISOString() },
    indexedAt: new Date().toISOString(),
    likeCount: 5,
    repostCount: 2,
    replyCount: 1,
    labels: [],
    ...overrides,
  };
}

// --- Tests ---

describe("useSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockSearchPosts.mockResolvedValue({
      data: {
        posts: [makeMockPost()],
        cursor: undefined,
      },
    });

    mockDB.getSearchHistory.mockResolvedValue([]);
    mockDB.addSearchEntry.mockResolvedValue(undefined);
    mockDB.deleteEntry.mockResolvedValue(undefined);
    mockDB.clearHistory.mockResolvedValue(undefined);
  });

  it("returns correct initial state", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    expect(result.current.query).toBe("");
    expect(result.current.activeQuery).toBe("");
    expect(result.current.allPosts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sortOrder).toBe("latest");
    expect(result.current.fullSearchQuery).toBe("");
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isFetchingNextPage).toBe(false);
  });

  it("setQuery updates the query state", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setQuery("bluesky");
    });

    expect(result.current.query).toBe("bluesky");
  });

  it("executeSearch sets activeQuery and triggers the search", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.executeSearch("test query");
    });

    expect(result.current.activeQuery).toBe("test query");

    await waitFor(() => {
      expect(mockSearchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "test query",
          limit: 25,
          sort: "latest",
        }),
      );
    });
  });

  it("returns posts from API on successful search", async () => {
    const post = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/42",
    });
    mockSearchPosts.mockResolvedValue({
      data: { posts: [post], cursor: undefined },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.executeSearch("hello world");
    });

    await waitFor(() => {
      expect(result.current.allPosts).toHaveLength(1);
    });

    expect(result.current.allPosts[0].uri).toBe(
      "at://did:plc:author/app.bsky.feed.post/42",
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("filters posts by media type (images)", async () => {
    const imagePost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/img",
      embed: { $type: "app.bsky.embed.images#view", images: [] },
    });
    const textPost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/txt",
    });

    mockSearchPosts.mockResolvedValue({
      data: { posts: [imagePost, textPost], cursor: undefined },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    // Set the media type filter to images
    act(() => {
      result.current.setFilters((prev) => ({
        ...prev,
        mediaType: "images" as const,
      }));
    });

    act(() => {
      result.current.executeSearch("media search");
    });

    await waitFor(() => {
      expect(result.current.allPosts).toHaveLength(1);
    });

    expect(result.current.allPosts[0].uri).toBe(
      "at://did:plc:author/app.bsky.feed.post/img",
    );
  });

  it("filters posts by media type (text-only)", async () => {
    const imagePost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/img",
      embed: { $type: "app.bsky.embed.images#view", images: [] },
    });
    const textPost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/txt",
      embed: undefined,
    });

    mockSearchPosts.mockResolvedValue({
      data: { posts: [imagePost, textPost], cursor: undefined },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setFilters((prev) => ({
        ...prev,
        mediaType: "text-only" as const,
      }));
    });

    act(() => {
      result.current.executeSearch("text only search");
    });

    await waitFor(() => {
      expect(result.current.allPosts).toHaveLength(1);
    });

    expect(result.current.allPosts[0].uri).toBe(
      "at://did:plc:author/app.bsky.feed.post/txt",
    );
  });

  it("builds fullSearchQuery with filters applied", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setFilters((prev) => ({
        ...prev,
        fromUsers: ["alice.bsky.social"],
        language: "en",
        sinceDate: "2026-01-01",
        untilDate: "2026-02-01",
      }));
    });

    act(() => {
      result.current.executeSearch("climate");
    });

    await waitFor(() => {
      expect(result.current.fullSearchQuery).toContain("climate");
    });

    expect(result.current.fullSearchQuery).toContain("from:alice.bsky.social");
    expect(result.current.fullSearchQuery).toContain("lang:en");
    expect(result.current.fullSearchQuery).toContain("since:2026-01-01");
    expect(result.current.fullSearchQuery).toContain("until:2026-02-01");
  });

  it("handles search API errors", async () => {
    mockSearchPosts.mockRejectedValue(new Error("Network failure"));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.executeSearch("failing query");
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error!.message).toBe("Network failure");
    expect(result.current.allPosts).toEqual([]);
  });

  it("executeSearch uses the current query when called without arguments", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setQuery("implicit query");
    });

    act(() => {
      result.current.executeSearch();
    });

    expect(result.current.activeQuery).toBe("implicit query");
  });

  it("respects the sortOrder option and setSortOrder", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch({ sortOrder: "top" }), {
      wrapper,
    });

    expect(result.current.sortOrder).toBe("top");

    act(() => {
      result.current.executeSearch("sorted search");
    });

    await waitFor(() => {
      expect(mockSearchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ sort: "top" }),
      );
    });

    // Change sort order
    act(() => {
      result.current.setSortOrder("latest");
    });

    expect(result.current.sortOrder).toBe("latest");
  });

  it("filters posts by engagement thresholds", async () => {
    const popularPost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/popular",
      likeCount: 100,
      repostCount: 50,
      replyCount: 20,
    });
    const unpopularPost = makeMockPost({
      uri: "at://did:plc:author/app.bsky.feed.post/unpopular",
      likeCount: 1,
      repostCount: 0,
      replyCount: 0,
    });

    mockSearchPosts.mockResolvedValue({
      data: { posts: [popularPost, unpopularPost], cursor: undefined },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.setFilters((prev) => ({
        ...prev,
        engagement: { minLikes: 10, minReposts: 5, minReplies: 0 },
      }));
    });

    act(() => {
      result.current.executeSearch("engagement filter");
    });

    await waitFor(() => {
      expect(result.current.allPosts).toHaveLength(1);
    });

    expect(result.current.allPosts[0].uri).toBe(
      "at://did:plc:author/app.bsky.feed.post/popular",
    );
  });

  it("executeSearch does not set activeQuery for empty/whitespace input", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.executeSearch("   ");
    });

    expect(result.current.activeQuery).toBe("");
  });

  it("adds to search history when executeSearch is called", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSearch(), { wrapper });

    act(() => {
      result.current.executeSearch("history test");
    });

    await waitFor(() => {
      expect(mockDB.addSearchEntry).toHaveBeenCalledWith(
        "history test",
        expect.objectContaining({
          sort: "latest",
        }),
      );
    });
  });
});
