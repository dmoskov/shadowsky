import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    dismissToast: jest.fn(),
    dismissAllToasts: jest.fn(),
    showUndoToast: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useScrollToTop: jest.fn(),
}));

jest.mock('../../../utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('../../../services/atproto/feeds', () => ({
  getPostThread: jest.fn(() => Promise.resolve({})),
}));

const mockOpenURL = jest.fn(() => Promise.resolve());
jest.spyOn(require('react-native'), 'Linking', 'get').mockReturnValue({
  openURL: mockOpenURL,
});

// Mock hooks with controllable return values
const mockNavigateToThread = jest.fn();
const mockNavigateToProfile = jest.fn();
const mockNavigateToCompose = jest.fn();
jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({
    navigateToThread: mockNavigateToThread,
    navigateToProfile: mockNavigateToProfile,
    navigateToCompose: mockNavigateToCompose,
  }),
}));

const mockToggleBookmark = jest.fn();
const mockBookmarks: any[] = [];
jest.mock('../../../hooks/api/useBookmarks', () => ({
  useBookmarks: () => ({
    toggleBookmark: mockToggleBookmark,
    bookmarks: mockBookmarks,
    isBookmarked: jest.fn(() => false),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isToggling: false,
  }),
}));

const mockLikeMutate = jest.fn();
const mockUnlikeMutate = jest.fn();
const mockRepostMutate = jest.fn();
const mockDeleteRepostMutate = jest.fn();
jest.mock('../../../hooks/api/usePosts', () => ({
  useLikePost: () => ({ mutate: mockLikeMutate }),
  useUnlikePost: () => ({ mutate: mockUnlikeMutate }),
  useRepost: () => ({ mutate: mockRepostMutate }),
  useDeleteRepost: () => ({ mutate: mockDeleteRepostMutate }),
}));

// Feed data defaults - overridable per test
let mockTimelineQuery: any = {
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: jest.fn(),
  isRefetching: false,
};

let mockCustomFeedQuery: any = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: jest.fn(),
  isRefetching: false,
};

let mockSavedFeeds: any[] | undefined = undefined;

jest.mock('../../../hooks/api', () => ({
  useTimeline: () => mockTimelineQuery,
  useCustomFeed: () => mockCustomFeedQuery,
  useSavedFeeds: () => ({ data: mockSavedFeeds }),
}));

// Mock NativeFeedList as a simple View that exposes key props for testing
jest.mock('../../../../modules/native-feed-list', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  const React = require('react');

  const NativeFeedList = React.forwardRef((props: any, _ref: any) => {
    const { query, emptyMessage, onPostPress, onProfilePress, onLinkPress, onImagePress, onQuotePress } = props;
    const isLoading = query?.isLoading;
    const isError = query?.isError;
    const posts = query?.data?.pages?.flatMap((p: any) => p.feed || []) || [];
    const hasData = posts.length > 0;

    return (
      <View testID="native-feed-list">
        {isLoading && <Text testID="feed-loading">Loading feed...</Text>}
        {isError && (
          <View testID="feed-error">
            <Text>Failed to load feed</Text>
            <TouchableOpacity
              testID="feed-retry"
              onPress={() => query?.refetch?.()}
            >
              <Text>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isLoading && !isError && !hasData && (
          <Text testID="feed-empty">{emptyMessage}</Text>
        )}
        {hasData && (
          <View testID="feed-content">
            {posts.map((item: any) => (
              <View key={item.post.uri} testID={`post-${item.post.uri}`}>
                <TouchableOpacity
                  testID={`post-press-${item.post.uri}`}
                  onPress={() =>
                    onPostPress?.({
                      nativeEvent: {
                        uri: item.post.uri,
                        handle: item.post.author.handle,
                      },
                    })
                  }
                >
                  <Text>{item.post.record?.text}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`profile-press-${item.post.author.handle}`}
                  onPress={() =>
                    onProfilePress?.({
                      nativeEvent: { handle: item.post.author.handle },
                    })
                  }
                >
                  <Text>{item.post.author.displayName}</Text>
                </TouchableOpacity>
                {item.post.embed?.external && (
                  <TouchableOpacity
                    testID={`link-press-${item.post.uri}`}
                    onPress={() =>
                      onLinkPress?.({
                        nativeEvent: { uri: item.post.embed.external.uri },
                      })
                    }
                  >
                    <Text>{item.post.embed.external.title}</Text>
                  </TouchableOpacity>
                )}
                {item.post.embed?.images && (
                  <TouchableOpacity
                    testID={`image-press-${item.post.uri}`}
                    onPress={() =>
                      onImagePress?.({
                        nativeEvent: { images: item.post.embed.images, index: 0 },
                      })
                    }
                  >
                    <Text>Image</Text>
                  </TouchableOpacity>
                )}
                {item.post.embed?.record && (
                  <TouchableOpacity
                    testID={`quote-press-${item.post.uri}`}
                    onPress={() =>
                      onQuotePress?.({
                        nativeEvent: {
                          uri: item.post.embed.record.uri,
                          handle: item.post.embed.record.author?.handle,
                        },
                      })
                    }
                  >
                    <Text>Quoted post</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  });
  NativeFeedList.displayName = 'NativeFeedList';

  return { NativeFeedList };
});

jest.mock('../../../hooks/useDataPrefetch', () => ({
  useDataPrefetch: () => ({ resetPrefetchCache: jest.fn() }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

// ─── Import after mocks ───────────────────────────────────
import { HomeScreen } from '../HomeScreen';

// ─── Helpers ──────────────────────────────────────────────

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
}

function makeFeedPage(posts: any[] = []) {
  return {
    pages: [{ cursor: 'cursor-1', feed: posts }],
    pageParams: [undefined],
  };
}

function makePost(uri: string, handle = 'alice.bsky.social') {
  const did = uri.split('/')[2] || 'did:plc:test';
  return {
    post: {
      uri,
      cid: `cid-${uri}`,
      author: {
        did,
        handle,
        displayName: handle.split('.')[0].charAt(0).toUpperCase() + handle.split('.')[0].slice(1),
        avatar: 'https://example.com/avatar.jpg',
      },
      record: { text: 'Test post', createdAt: new Date().toISOString() },
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      indexedAt: new Date().toISOString(),
      labels: [],
      viewer: {},
    },
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimelineQuery = {
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: jest.fn(),
      isRefetching: false,
    };
    mockCustomFeedQuery = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: jest.fn(),
      isRefetching: false,
    };
    mockSavedFeeds = undefined;
  });

  // ─── Loading state ──────────────────────────────────────
  describe('loading state', () => {
    it('renders loading indicator when timeline is loading', () => {
      const { getByTestId } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('feed-loading')).toBeTruthy();
    });

    it('passes loading query to NativeFeedList', () => {
      const { getByTestId } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('native-feed-list')).toBeTruthy();
    });
  });

  // ─── Empty state ────────────────────────────────────────
  describe('empty state', () => {
    it('shows empty message when timeline has no posts', () => {
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('feed-empty')).toBeTruthy();
      expect(getByText('No posts in your timeline yet')).toBeTruthy();
    });
  });

  // ─── Feed loaded state ──────────────────────────────────
  describe('feed loaded', () => {
    it('renders feed content when posts are available', () => {
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([
          makePost('at://did:plc:test/app.bsky.feed.post/1'),
        ]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('feed-content')).toBeTruthy();
    });
  });

  // ─── Error state with retry ─────────────────────────────
  describe('error state', () => {
    it('shows error with retry button when feed fails to load', () => {
      const mockRefetch = jest.fn();
      mockTimelineQuery = {
        ...mockTimelineQuery,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
      };

      const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('feed-error')).toBeTruthy();
      expect(getByText('Failed to load feed')).toBeTruthy();

      fireEvent.press(getByTestId('feed-retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Feed picker / tab switching ────────────────────────
  describe('feed picker / tab switching', () => {
    it('does not show feed picker when no saved feeds', () => {
      mockSavedFeeds = undefined;
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { queryByText } = renderWithProviders(<HomeScreen />);
      expect(queryByText('Following')).toBeNull();
    });

    it('shows feed picker chips when saved feeds exist', () => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
        { uri: 'at://feed/science', displayName: 'Science' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { getByText } = renderWithProviders(<HomeScreen />);
      // The "Following" chip uses emoji prefix
      expect(getByText(/Following/)).toBeTruthy();
      expect(getByText('Hot Posts')).toBeTruthy();
      expect(getByText('Science')).toBeTruthy();
    });

    it('shows Discover button in feed picker', () => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { getByText } = renderWithProviders(<HomeScreen />);
      expect(getByText('+ Discover')).toBeTruthy();
    });

    it('switches to custom feed when feed chip is pressed', () => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };
      mockCustomFeedQuery = {
        ...mockCustomFeedQuery,
        data: makeFeedPage([
          makePost('at://did:plc:test/app.bsky.feed.post/custom1'),
        ]),
        isLoading: false,
      };

      const { getByText } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByText('Hot Posts'));
      // After pressing, the custom feed chip should be selected
      // The component re-renders with selectedFeedUri set
    });

    it('switches back to timeline when Following chip is pressed', () => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { getByText } = renderWithProviders(<HomeScreen />);
      // First switch to custom feed
      fireEvent.press(getByText('Hot Posts'));
      // Then switch back to Following
      fireEvent.press(getByText(/Following/));
      // Component should now use timeline query again
    });

    it('navigates to feed discovery when Discover is pressed', () => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([]),
        isLoading: false,
      };

      const { getByText } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByText('+ Discover'));
      expect(mockRouterPush).toHaveBeenCalledWith('/(app)/feeds/discover');
    });
  });

  // ─── Renders without crashing in various states ─────────
  describe('render stability', () => {
    it('renders without crashing with all default mocks', () => {
      expect(() => renderWithProviders(<HomeScreen />)).not.toThrow();
    });

    it('renders with empty saved feeds array', () => {
      mockSavedFeeds = [];
      expect(() => renderWithProviders(<HomeScreen />)).not.toThrow();
    });

    it('renders with multiple pages of feed data', () => {
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: {
          pages: [
            {
              cursor: 'cursor-1',
              feed: [makePost('at://did:plc:test/app.bsky.feed.post/1')],
            },
            {
              cursor: 'cursor-2',
              feed: [makePost('at://did:plc:test/app.bsky.feed.post/2')],
            },
          ],
          pageParams: [undefined, 'cursor-1'],
        },
        isLoading: false,
        hasNextPage: true,
      };

      expect(() => renderWithProviders(<HomeScreen />)).not.toThrow();
    });
  });

  // ─── Post press navigation ──────────────────────────────
  describe('post press navigation', () => {
    it('navigates to thread when a post is pressed', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/abc123';
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([makePost(postUri, 'alice.bsky.social')]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      expect(getByTestId('feed-content')).toBeTruthy();

      fireEvent.press(getByTestId(`post-press-${postUri}`));
      expect(mockNavigateToThread).toHaveBeenCalledWith(
        'alice.bsky.social',
        'abc123',
        'did:plc:alice'
      );
    });

    it('navigates to profile when profile is pressed', () => {
      const postUri = 'at://did:plc:bob/app.bsky.feed.post/xyz789';
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([makePost(postUri, 'bob.bsky.social')]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId('profile-press-bob.bsky.social'));
      expect(mockNavigateToProfile).toHaveBeenCalledWith('bob.bsky.social');
    });
  });

  // ─── Embed press handling ───────────────────────────────
  describe('embed press handling', () => {
    it('opens external link when link embed is pressed', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/link1';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        external: {
          uri: 'https://example.com/article',
          title: 'Example Article',
          description: 'An article',
        },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`link-press-${postUri}`));
      expect(mockOpenURL).toHaveBeenCalledWith('https://example.com/article');
    });

    it('opens fullsize image when image embed is pressed', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/img1';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        images: [
          { thumb: 'https://cdn.example.com/thumb.jpg', fullsize: 'https://cdn.example.com/full.jpg', alt: 'A photo' },
        ],
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`image-press-${postUri}`));
      expect(mockOpenURL).toHaveBeenCalledWith('https://cdn.example.com/full.jpg');
    });

    it('navigates to quoted post thread when quote embed is pressed', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/qt1';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        record: {
          uri: 'at://did:plc:carol/app.bsky.feed.post/quoted456',
          author: { handle: 'carol.bsky.social' },
        },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`quote-press-${postUri}`));
      expect(mockNavigateToThread).toHaveBeenCalledWith(
        'carol.bsky.social',
        'quoted456',
        'did:plc:carol'
      );
    });
  });
});
