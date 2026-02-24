import type { AppBskyFeedDefs } from "@atproto/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock setup ---

const mockAgent = {
  like: vi.fn(),
  deleteLike: vi.fn(),
  repost: vi.fn(),
  deleteRepost: vi.fn(),
};

const mockActionSync = {
  setActionPending: vi.fn(),
  setActionSynced: vi.fn(),
  setActionFailed: vi.fn(),
  setActionIdle: vi.fn(),
  getActionStatus: vi.fn(),
  getRetryFn: vi.fn(),
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ agent: mockAgent }),
}));

vi.mock("../contexts/ActionSyncContext", () => ({
  useActionSyncOptional: () => mockActionSync,
}));

vi.mock("../services/mutation-queue-db", () => ({
  mutationQueueDB: {
    init: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@bsky/shared", () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useOptimisticPosts } from "./useOptimisticPosts";

// --- Helpers ---

const POST_URI = "at://did:plc:test/app.bsky.feed.post/abc123";
const POST_CID = "bafyreiabc123";
const LIKE_URI = "at://did:plc:test/app.bsky.feed.like/xyz789";
const REPOST_URI = "at://did:plc:test/app.bsky.feed.repost/xyz789";

function makePost(
  overrides: Partial<AppBskyFeedDefs.PostView> = {},
): AppBskyFeedDefs.PostView {
  return {
    uri: POST_URI,
    cid: POST_CID,
    author: {
      did: "did:plc:test",
      handle: "test.bsky.social",
    } as AppBskyFeedDefs.PostView["author"],
    record: {},
    indexedAt: new Date().toISOString(),
    likeCount: 5,
    repostCount: 3,
    replyCount: 1,
    viewer: {},
    ...overrides,
  } as AppBskyFeedDefs.PostView;
}

interface TimelinePage {
  feed: Array<{ post?: AppBskyFeedDefs.PostView; [key: string]: unknown }>;
  cursor?: string;
}

interface TimelineData {
  pages: TimelinePage[];
  pageParams: unknown[];
}

function makeTimelineData(post: AppBskyFeedDefs.PostView): TimelineData {
  return {
    pages: [
      {
        feed: [{ post }],
        cursor: "cursor-1",
      },
    ],
    pageParams: [undefined],
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// --- Tests ---

describe("useOptimisticPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("likeMutation", () => {
    it("optimistically increments likeCount and confirms with server URI on success", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost();
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.like.mockResolvedValue({ uri: LIKE_URI });

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.likeMutation.mutate({ uri: POST_URI, cid: POST_CID });
      });

      // Wait for mutation to complete and verify the cache was updated
      await waitFor(() => {
        expect(result.current.likeMutation.isSuccess).toBe(true);
      });

      const finalData = queryClient.getQueryData<TimelineData>([
        "timeline",
        "home",
      ]);
      expect(finalData?.pages[0].feed[0].post?.likeCount).toBe(6);
      expect(finalData?.pages[0].feed[0].post?.viewer?.like).toBe(LIKE_URI);
      expect(finalData?.pages[0].feed[0].post?.likeCount).toBe(6);

      expect(mockAgent.like).toHaveBeenCalledWith(POST_URI, POST_CID);
      expect(mockActionSync.setActionPending).toHaveBeenCalledWith(
        "like",
        POST_URI,
      );
      expect(mockActionSync.setActionSynced).toHaveBeenCalledWith(
        "like",
        POST_URI,
      );
    });

    it("rolls back cache on non-network error", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({ likeCount: 10 });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.like.mockRejectedValue(new Error("Server error: 500"));

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.likeMutation.mutate({ uri: POST_URI, cid: POST_CID });
      });

      await waitFor(() => {
        expect(result.current.likeMutation.isError).toBe(true);
      });

      // Cache should be rolled back to original values
      const data = queryClient.getQueryData<TimelineData>(["timeline", "home"]);
      expect(data?.pages[0].feed[0].post?.likeCount).toBe(10);
      expect(data?.pages[0].feed[0].post?.viewer?.like).toBeUndefined();

      expect(mockActionSync.setActionFailed).toHaveBeenCalledWith(
        "like",
        POST_URI,
        expect.any(Function),
      );
    });
  });

  describe("unlikeMutation", () => {
    it("optimistically decrements likeCount and clears viewer.like on success", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({
        likeCount: 5,
        viewer: { like: LIKE_URI },
      });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.deleteLike.mockResolvedValue(undefined);

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.unlikeMutation.mutate({
          likeUri: LIKE_URI,
          postUri: POST_URI,
        });
      });

      // Verify optimistic update
      await waitFor(() => {
        const data = queryClient.getQueryData<TimelineData>([
          "timeline",
          "home",
        ]);
        expect(data?.pages[0].feed[0].post?.likeCount).toBe(4);
        expect(data?.pages[0].feed[0].post?.viewer?.like).toBeUndefined();
      });

      await waitFor(() => {
        expect(result.current.unlikeMutation.isSuccess).toBe(true);
      });

      expect(mockAgent.deleteLike).toHaveBeenCalledWith(LIKE_URI);
      expect(mockActionSync.setActionSynced).toHaveBeenCalledWith(
        "like",
        POST_URI,
      );
    });

    it("does not decrement likeCount below zero", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({ likeCount: 0, viewer: { like: LIKE_URI } });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.deleteLike.mockResolvedValue(undefined);

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.unlikeMutation.mutate({
          likeUri: LIKE_URI,
          postUri: POST_URI,
        });
      });

      await waitFor(() => {
        expect(result.current.unlikeMutation.isSuccess).toBe(true);
      });

      const data = queryClient.getQueryData<TimelineData>(["timeline", "home"]);
      expect(data?.pages[0].feed[0].post?.likeCount).toBe(0);
    });
  });

  describe("repostMutation", () => {
    it("optimistically increments repostCount and confirms with server URI on success", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({ repostCount: 3 });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.repost.mockResolvedValue({ uri: REPOST_URI });

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.repostMutation.mutate({ uri: POST_URI, cid: POST_CID });
      });

      // Wait for mutation to complete and verify server URI
      await waitFor(() => {
        expect(result.current.repostMutation.isSuccess).toBe(true);
      });

      const finalData = queryClient.getQueryData<TimelineData>([
        "timeline",
        "home",
      ]);
      expect(finalData?.pages[0].feed[0].post?.repostCount).toBe(4);
      expect(finalData?.pages[0].feed[0].post?.viewer?.repost).toBe(REPOST_URI);
      expect(finalData?.pages[0].feed[0].post?.repostCount).toBe(4);

      expect(mockAgent.repost).toHaveBeenCalledWith(POST_URI, POST_CID);
      expect(mockActionSync.setActionPending).toHaveBeenCalledWith(
        "repost",
        POST_URI,
      );
      expect(mockActionSync.setActionSynced).toHaveBeenCalledWith(
        "repost",
        POST_URI,
      );
    });

    it("rolls back cache on non-network error", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({ repostCount: 7 });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.repost.mockRejectedValue(new Error("Server error: 500"));

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.repostMutation.mutate({ uri: POST_URI, cid: POST_CID });
      });

      await waitFor(() => {
        expect(result.current.repostMutation.isError).toBe(true);
      });

      // Cache should be rolled back to original values
      const data = queryClient.getQueryData<TimelineData>(["timeline", "home"]);
      expect(data?.pages[0].feed[0].post?.repostCount).toBe(7);
      expect(data?.pages[0].feed[0].post?.viewer?.repost).toBeUndefined();

      expect(mockActionSync.setActionFailed).toHaveBeenCalledWith(
        "repost",
        POST_URI,
        expect.any(Function),
      );
    });
  });

  describe("unrepostMutation", () => {
    it("optimistically decrements repostCount and clears viewer.repost on success", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({
        repostCount: 3,
        viewer: { repost: REPOST_URI },
      });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.deleteRepost.mockResolvedValue(undefined);

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.unrepostMutation.mutate({
          repostUri: REPOST_URI,
          postUri: POST_URI,
        });
      });

      // Verify optimistic update
      await waitFor(() => {
        const data = queryClient.getQueryData<TimelineData>([
          "timeline",
          "home",
        ]);
        expect(data?.pages[0].feed[0].post?.repostCount).toBe(2);
        expect(data?.pages[0].feed[0].post?.viewer?.repost).toBeUndefined();
      });

      await waitFor(() => {
        expect(result.current.unrepostMutation.isSuccess).toBe(true);
      });

      expect(mockAgent.deleteRepost).toHaveBeenCalledWith(REPOST_URI);
      expect(mockActionSync.setActionSynced).toHaveBeenCalledWith(
        "repost",
        POST_URI,
      );
    });

    it("does not decrement repostCount below zero", async () => {
      const { wrapper, queryClient } = createWrapper();
      const post = makePost({
        repostCount: 0,
        viewer: { repost: REPOST_URI },
      });
      queryClient.setQueryData(["timeline", "home"], makeTimelineData(post));

      mockAgent.deleteRepost.mockResolvedValue(undefined);

      const { result } = renderHook(() => useOptimisticPosts(), { wrapper });

      act(() => {
        result.current.unrepostMutation.mutate({
          repostUri: REPOST_URI,
          postUri: POST_URI,
        });
      });

      await waitFor(() => {
        expect(result.current.unrepostMutation.isSuccess).toBe(true);
      });

      const data = queryClient.getQueryData<TimelineData>(["timeline", "home"]);
      expect(data?.pages[0].feed[0].post?.repostCount).toBe(0);
    });
  });
});
