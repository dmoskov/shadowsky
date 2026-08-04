import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAgent = {
  getPreferences: vi.fn(),
  app: {
    bsky: {
      feed: { getFeedGenerators: vi.fn() },
      graph: { getList: vi.fn() },
    },
  },
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ agent: mockAgent }),
}));

import { useDeckFeeds } from "./useDeckFeeds";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const savedFeeds = [
  { id: "a", type: "timeline", value: "following", pinned: true },
  {
    id: "b",
    type: "feed",
    value: "at://did:plc:x/app.bsky.feed.generator/one",
    pinned: false,
  },
  {
    id: "c",
    type: "feed",
    value: "at://did:plc:x/app.bsky.feed.generator/two",
    pinned: true,
  },
  {
    id: "d",
    type: "list",
    value: "at://did:plc:x/app.bsky.graph.list/l1",
    pinned: false,
  },
];

function renderDeckFeeds(limit?: number) {
  return renderHook(() => useDeckFeeds(limit), { wrapper: createWrapper() });
}

describe("useDeckFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.getPreferences.mockResolvedValue({ savedFeeds });
    mockAgent.app.bsky.feed.getFeedGenerators.mockResolvedValue({
      data: {
        feeds: [
          {
            uri: "at://did:plc:x/app.bsky.feed.generator/one",
            displayName: "Feed One",
          },
          {
            uri: "at://did:plc:x/app.bsky.feed.generator/two",
            displayName: "Feed Two",
          },
        ],
      },
    });
    mockAgent.app.bsky.graph.getList.mockResolvedValue({
      data: { list: { name: "My List" } },
    });
  });

  it("puts pinned feeds first, keeping saved order within each group", async () => {
    const { result } = renderDeckFeeds();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.feeds.map((f) => f.title)).toEqual([
      "Following",
      "Feed Two",
      "Feed One",
      "My List",
    ]);
  });

  it("carries the saved feed id and value onto each column", async () => {
    const { result } = renderDeckFeeds();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.feeds[0]).toMatchObject({
      id: "feed:a",
      type: "feed",
      data: "following",
      savedFeedId: "a",
    });
  });

  it("shows only the first N feeds when a limit is set", async () => {
    const { result } = renderDeckFeeds(2);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.feeds.map((f) => f.title)).toEqual([
      "Following",
      "Feed Two",
    ]);
  });

  it("marks a feed unavailable when its generator does not resolve", async () => {
    mockAgent.app.bsky.feed.getFeedGenerators.mockResolvedValue({
      data: {
        feeds: [
          {
            uri: "at://did:plc:x/app.bsky.feed.generator/one",
            displayName: "Feed One",
          },
        ],
      },
    });

    const { result } = renderDeckFeeds();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const two = result.current.feeds.find((f) => f.savedFeedId === "c");
    expect(two?.unavailable).toBe(true);
    // The resolvable ones are untouched
    expect(
      result.current.feeds.find((f) => f.savedFeedId === "b")?.unavailable,
    ).toBe(false);
  });

  it("does not mark everything unavailable when the lookup itself fails", async () => {
    mockAgent.app.bsky.feed.getFeedGenerators.mockRejectedValue(
      new Error("network down"),
    );

    const { result } = renderDeckFeeds();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.feeds.filter((f) => f.unavailable).map((f) => f.title),
    ).toEqual([]);
  });

  it("marks a list unavailable when it cannot be resolved", async () => {
    mockAgent.app.bsky.graph.getList.mockRejectedValue(new Error("gone"));

    const { result } = renderDeckFeeds();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const list = result.current.feeds.find((f) => f.savedFeedId === "d");
    expect(list?.unavailable).toBe(true);
    expect(list?.title).toBe("List");
  });
});
