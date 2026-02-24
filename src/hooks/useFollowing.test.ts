import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Define mock agent before vi.mock calls so the factory can reference it
const mockAgent = {
  app: {
    bsky: {
      graph: {
        getFollows: vi.fn(),
      },
    },
  },
};

// Mock useAuth to control session and agent per test
const mockUseAuth = vi.fn(() => ({
  session: { did: "did:plc:testuser123" } as { did: string } | null,
  agent: mockAgent as typeof mockAgent | null,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@bsky/shared", () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { useFollowing } from "./useFollowing";

// Helper to create a QueryClient wrapper with retry disabled
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useFollowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to authenticated state by default
    mockUseAuth.mockReturnValue({
      session: { did: "did:plc:testuser123" },
      agent: mockAgent,
    });
  });

  it("returns undefined data when not authenticated (no session/agent)", async () => {
    mockUseAuth.mockReturnValue({
      session: null,
      agent: null,
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    // The query should not fire, so data remains undefined
    await waitFor(() => {
      expect(result.current.data).toBeUndefined();
    });

    expect(mockAgent.app.bsky.graph.getFollows).not.toHaveBeenCalled();
  });

  it("does not fetch when session.did is missing (enabled=false)", async () => {
    mockUseAuth.mockReturnValue({
      session: null,
      agent: mockAgent,
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(result.current.data).toBeUndefined();
    expect(mockAgent.app.bsky.graph.getFollows).not.toHaveBeenCalled();
  });

  it("does not fetch when agent is missing (enabled=false)", async () => {
    mockUseAuth.mockReturnValue({
      session: { did: "did:plc:testuser123" },
      agent: null,
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(result.current.data).toBeUndefined();
    expect(mockAgent.app.bsky.graph.getFollows).not.toHaveBeenCalled();
  });

  it("fetches and returns following list as a Set on success", async () => {
    mockAgent.app.bsky.graph.getFollows.mockResolvedValue({
      data: {
        follows: [
          { did: "did:plc:user1", handle: "user1.bsky.social" },
          { did: "did:plc:user2", handle: "user2.bsky.social" },
          { did: "did:plc:user3", handle: "user3.bsky.social" },
        ],
        cursor: undefined,
      },
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeInstanceOf(Set);
    expect(result.current.data!.size).toBe(3);
    expect(result.current.data!.has("did:plc:user1")).toBe(true);
    expect(result.current.data!.has("did:plc:user2")).toBe(true);
    expect(result.current.data!.has("did:plc:user3")).toBe(true);

    expect(mockAgent.app.bsky.graph.getFollows).toHaveBeenCalledWith({
      actor: "did:plc:testuser123",
      limit: 100,
      cursor: undefined,
    });
  });

  it("handles pagination - fetches multiple pages when cursor is present", async () => {
    mockAgent.app.bsky.graph.getFollows
      .mockResolvedValueOnce({
        data: {
          follows: [
            { did: "did:plc:user1", handle: "user1.bsky.social" },
            { did: "did:plc:user2", handle: "user2.bsky.social" },
          ],
          cursor: "page2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          follows: [
            { did: "did:plc:user3", handle: "user3.bsky.social" },
            { did: "did:plc:user4", handle: "user4.bsky.social" },
          ],
          cursor: "page3",
        },
      })
      .mockResolvedValueOnce({
        data: {
          follows: [{ did: "did:plc:user5", handle: "user5.bsky.social" }],
          cursor: undefined,
        },
      });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // All three pages should have been fetched
    expect(mockAgent.app.bsky.graph.getFollows).toHaveBeenCalledTimes(3);

    // Verify cursor was passed correctly on subsequent calls
    expect(mockAgent.app.bsky.graph.getFollows).toHaveBeenNthCalledWith(1, {
      actor: "did:plc:testuser123",
      limit: 100,
      cursor: undefined,
    });
    expect(mockAgent.app.bsky.graph.getFollows).toHaveBeenNthCalledWith(2, {
      actor: "did:plc:testuser123",
      limit: 100,
      cursor: "page2",
    });
    expect(mockAgent.app.bsky.graph.getFollows).toHaveBeenNthCalledWith(3, {
      actor: "did:plc:testuser123",
      limit: 100,
      cursor: "page3",
    });

    // All 5 users from 3 pages should be in the result
    expect(result.current.data!.size).toBe(5);
    expect(result.current.data!.has("did:plc:user1")).toBe(true);
    expect(result.current.data!.has("did:plc:user5")).toBe(true);
  });

  it("returns a sorted/stable Set from useMemo", async () => {
    // Return DIDs in non-alphabetical order
    mockAgent.app.bsky.graph.getFollows.mockResolvedValue({
      data: {
        follows: [
          { did: "did:plc:zebra", handle: "zebra.bsky.social" },
          { did: "did:plc:apple", handle: "apple.bsky.social" },
          { did: "did:plc:mango", handle: "mango.bsky.social" },
        ],
        cursor: undefined,
      },
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Convert Set to array to verify ordering
    const didsArray = Array.from(result.current.data!);
    expect(didsArray).toEqual([
      "did:plc:apple",
      "did:plc:mango",
      "did:plc:zebra",
    ]);
  });

  it("handles API error gracefully", async () => {
    const apiError = new Error("Network request failed");
    mockAgent.app.bsky.graph.getFollows.mockRejectedValue(apiError);

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error!.message).toBe("Network request failed");
    expect(result.current.data).toBeUndefined();
  });

  it("deduplicates follows returned across pages", async () => {
    // Simulate a user appearing in multiple pages (unlikely but defensive)
    mockAgent.app.bsky.graph.getFollows
      .mockResolvedValueOnce({
        data: {
          follows: [
            { did: "did:plc:user1", handle: "user1.bsky.social" },
            { did: "did:plc:user2", handle: "user2.bsky.social" },
          ],
          cursor: "page2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          follows: [
            { did: "did:plc:user2", handle: "user2.bsky.social" },
            { did: "did:plc:user3", handle: "user3.bsky.social" },
          ],
          cursor: undefined,
        },
      });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // user2 appeared on both pages but should only be counted once
    expect(result.current.data!.size).toBe(3);
  });

  it("handles empty following list", async () => {
    mockAgent.app.bsky.graph.getFollows.mockResolvedValue({
      data: {
        follows: [],
        cursor: undefined,
      },
    });

    const { result } = renderHook(() => useFollowing(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeInstanceOf(Set);
    expect(result.current.data!.size).toBe(0);
  });
});
