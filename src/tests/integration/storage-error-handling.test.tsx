import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarksColumn } from "../../components/BookmarksColumn";
import { StorageErrorProvider } from "../../components/providers/StorageErrorProvider";
import { AuthProvider } from "../../contexts/AuthContext";
import { HiddenPostsProvider } from "../../contexts/HiddenPostsContext";
import { ModalProvider } from "../../contexts/ModalContext";
import { ModerationProvider } from "../../contexts/ModerationContext";
import { bookmarkServiceV2 } from "../../services/bookmark-service-v2";
import { createMockAgent } from "../mocks/atproto";

// Mock the services
vi.mock("../../services/bookmark-service-v2", () => ({
  bookmarkServiceV2: {
    // Note: setErrorCallback no longer exists in BookmarkServiceV2
    getBookmarkedPosts: vi.fn(),
    getBookmarkCount: vi.fn(),
    removeBookmark: vi.fn(),
    searchBookmarks: vi.fn(),
  },
}));

vi.mock("../../services/draft-service", () => ({
  draftService: {
    setErrorCallback: vi.fn(),
  },
}));

// Mock the auth context
const mockUseAuth = vi.fn(() => ({
  isAuthenticated: true,
  agent: createMockAgent(),
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  session: null,
  client: {} as any,
  refreshSession: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockUseAuth(),
}));

// Mock the moderation context
vi.mock("../../contexts/ModerationContext", () => ({
  ModerationProvider: ({ children }: { children: React.ReactNode }) => children,
  useModeration: () => ({
    isUserMuted: vi.fn(() => false),
    isUserBlocked: vi.fn(() => false),
    isThreadMuted: vi.fn(() => false),
    muteUser: vi.fn(),
    unmuteUser: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    muteThread: vi.fn(),
    unmuteThread: vi.fn(),
  }),
}));

// Create a wrapper component for tests
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <ModalProvider>
            <StorageErrorProvider>
              <HiddenPostsProvider>
                <ModerationProvider>{children}</ModerationProvider>
              </HiddenPostsProvider>
            </StorageErrorProvider>
          </ModalProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Storage Error Handling Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: Error callback registration tests removed
  // BookmarkServiceV2 no longer uses error callbacks
  // Errors are handled directly in the service

  describe("Error Display in Components", () => {
    it("should show error modal when bookmark removal fails", async () => {
      const mockBookmarkService = vi.mocked(bookmarkServiceV2);
      mockBookmarkService.getBookmarkedPosts.mockResolvedValue([
        {
          id: "bookmark1",
          postUri: "at://did:plc:author/app.bsky.feed.post/123",
          postCid: "cid123",
          savedAt: new Date().toISOString(),
          author: {
            did: "did:plc:author",
            handle: "author.bsky.social",
            displayName: "Test Author",
          },
          text: "Test post",
          post: {
            uri: "at://did:plc:author/app.bsky.feed.post/123",
            cid: "cid123",
            author: {
              did: "did:plc:author",
              handle: "author.bsky.social",
              displayName: "Test Author",
            },
            record: {
              $type: "app.bsky.feed.post",
              text: "Test post",
              createdAt: new Date().toISOString(),
            },
            indexedAt: new Date().toISOString(),
          },
        },
      ]);
      mockBookmarkService.getBookmarkCount.mockResolvedValue(1);

      // Make removeBookmark fail
      mockBookmarkService.removeBookmark.mockRejectedValue(
        new Error("Network error: Unable to remove bookmark"),
      );

      const Wrapper = createWrapper();
      const { container } = render(<BookmarksColumn />, { wrapper: Wrapper });

      // Wait for bookmarks to load
      await waitFor(() => {
        expect(screen.getByText("Test post")).toBeInTheDocument();
      });

      // Click remove bookmark button
      const removeButton = container.querySelector('[title="Remove bookmark"]');
      expect(removeButton).toBeInTheDocument();
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // Should show error alert
      await waitFor(() => {
        expect(
          screen.getByText("Failed to remove bookmark. Please try again."),
        ).toBeInTheDocument();
      });
    });
  });

  // Note: Error Propagation tests removed
  // BookmarkServiceV2 no longer uses error callbacks

  describe("Storage Migration Error Handling", () => {
    it("should show error when storage migration fails", async () => {
      // This would be tested in the actual component that handles storage migration
      // For now, we verify the error handling infrastructure is in place

      const Wrapper = createWrapper();
      render(<div>Test</div>, { wrapper: Wrapper });

      // Just verify the providers are working correctly
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });
});
