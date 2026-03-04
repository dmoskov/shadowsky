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

const mockOpenLink = jest.fn(() => Promise.resolve());
jest.mock('../../../utils/browser', () => ({
  openLink: (...args: any[]) => mockOpenLink(...args),
}));

const mockOpenLightbox = jest.fn();
const mockCloseLightbox = jest.fn();
jest.mock('../../../contexts/LightboxContext', () => ({
  useLightbox: () => ({
    openLightbox: mockOpenLightbox,
    closeLightbox: mockCloseLightbox,
    state: { visible: false, images: [], index: 0, sourceLayout: null },
  }),
}));

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

// Mock NativeFeedList imperative methods
const mockScrollToTop = jest.fn();
const mockRefresh = jest.fn();

// Mock NativeFeedList as a simple View that exposes key props for testing
jest.mock('../../../../modules/native-feed-list', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  const React = require('react');

  const NativeFeedList = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToTop: mockScrollToTop,
      refresh: mockRefresh,
    }));
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
                {item.post.embed?.images && item.post.embed.images.map((img: any, imgIdx: number) => (
                  <TouchableOpacity
                    key={imgIdx}
                    testID={`image-press-${imgIdx}-${item.post.uri}`}
                    onPress={() =>
                      onImagePress?.({
                        nativeEvent: { images: item.post.embed.images, index: imgIdx },
                      })
                    }
                  >
                    <Text>{img.alt || 'Image'}</Text>
                  </TouchableOpacity>
                ))}
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
    mockScrollToTop.mockClear();
    mockRefresh.mockClear();
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

  // ─── Feed chip tap-to-scroll / double-tap-to-refresh ────
  describe('feed chip tap-to-scroll and double-tap-to-refresh', () => {
    beforeEach(() => {
      mockSavedFeeds = [
        { uri: 'at://feed/hot', displayName: 'Hot Posts' },
      ];
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([
          makePost('at://did:plc:test/app.bsky.feed.post/1'),
        ]),
        isLoading: false,
      };
    });

    it('scrolls to top when tapping the already-selected feed chip', () => {
      // useEffect auto-selects first saved feed (Hot Posts), so it's already active
      const { getByText } = renderWithProviders(<HomeScreen />);

      // Tap Hot Posts — already active, so scrolls to top
      fireEvent.press(getByText('Hot Posts'));
      expect(mockScrollToTop).toHaveBeenCalledTimes(1);
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('refreshes feed on double-tap of active feed chip', () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)  // first tap on active → scroll to top
        .mockReturnValueOnce(1200); // second tap within 400ms → double tap → refresh

      const { getByText } = renderWithProviders(<HomeScreen />);
      // First tap on already-active Hot Posts → scroll to top
      fireEvent.press(getByText('Hot Posts'));
      // Second tap within 400ms → double tap → scroll to top + refresh
      fireEvent.press(getByText('Hot Posts'));

      expect(mockScrollToTop).toHaveBeenCalledTimes(2);
      expect(mockRefresh).toHaveBeenCalledTimes(1);

      jest.restoreAllMocks();
    });

    it('does not scroll/refresh when switching to a different feed', () => {
      // Hot Posts is auto-selected; switch to Following (null)
      const { getByText } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByText(/Following/));
      expect(mockScrollToTop).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
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

  // ─── Link embed press ───────────────────────────────────
  describe('link embed press', () => {
    it('opens in-app browser for external URL', () => {
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
      expect(mockOpenLink).toHaveBeenCalledWith('https://example.com/article', mockTheme.colors);
    });

    it('does not call openLink when no link embed exists', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/nolink';
      const post = makePost(postUri, 'alice.bsky.social');
      // No embed at all
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId, queryByTestId } = renderWithProviders(<HomeScreen />);
      // Post body tap navigates to thread, not openLink
      fireEvent.press(getByTestId(`post-press-${postUri}`));
      expect(mockOpenLink).not.toHaveBeenCalled();
      expect(queryByTestId(`link-press-${postUri}`)).toBeNull();
    });

    it('handles HTTPS and HTTP links', () => {
      const httpsUri = 'at://did:plc:alice/app.bsky.feed.post/https1';
      const httpUri = 'at://did:plc:alice/app.bsky.feed.post/http1';
      const httpsPost = makePost(httpsUri, 'alice.bsky.social');
      httpsPost.post.embed = {
        external: { uri: 'https://secure.example.com', title: 'HTTPS', description: '' },
      };
      const httpPost = makePost(httpUri, 'bob.bsky.social');
      httpPost.post.embed = {
        external: { uri: 'http://legacy.example.com', title: 'HTTP', description: '' },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([httpsPost, httpPost]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`link-press-${httpsUri}`));
      expect(mockOpenLink).toHaveBeenCalledWith('https://secure.example.com', mockTheme.colors);

      fireEvent.press(getByTestId(`link-press-${httpUri}`));
      expect(mockOpenLink).toHaveBeenCalledWith('http://legacy.example.com', mockTheme.colors);
    });
  });

  // ─── Image embed press ─────────────────────────────────
  describe('image embed press', () => {
    it('opens lightbox for single image with correct data', () => {
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
      fireEvent.press(getByTestId(`image-press-0-${postUri}`));
      expect(mockOpenLightbox).toHaveBeenCalledWith(
        [{ thumb: 'https://cdn.example.com/thumb.jpg', fullsize: 'https://cdn.example.com/full.jpg', alt: 'A photo' }],
        0,
      );
    });

    it('opens lightbox at correct index for multi-image post', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/multi';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        images: [
          { thumb: 'https://cdn.example.com/t1.jpg', fullsize: 'https://cdn.example.com/f1.jpg', alt: 'First' },
          { thumb: 'https://cdn.example.com/t2.jpg', fullsize: 'https://cdn.example.com/f2.jpg', alt: 'Second' },
          { thumb: 'https://cdn.example.com/t3.jpg', fullsize: 'https://cdn.example.com/f3.jpg', alt: 'Third' },
        ],
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      // Tap the 2nd image (index 1)
      fireEvent.press(getByTestId(`image-press-1-${postUri}`));
      expect(mockOpenLightbox).toHaveBeenCalledWith(
        [
          { thumb: 'https://cdn.example.com/t1.jpg', fullsize: 'https://cdn.example.com/f1.jpg', alt: 'First' },
          { thumb: 'https://cdn.example.com/t2.jpg', fullsize: 'https://cdn.example.com/f2.jpg', alt: 'Second' },
          { thumb: 'https://cdn.example.com/t3.jpg', fullsize: 'https://cdn.example.com/f3.jpg', alt: 'Third' },
        ],
        1,
      );
    });

    it('passes all image metadata (thumb, fullsize, alt) to lightbox', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/meta';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        images: [
          { thumb: 'https://thumb.url/a', fullsize: 'https://full.url/a', alt: 'Alt text for image A' },
          { thumb: 'https://thumb.url/b', fullsize: 'https://full.url/b', alt: '' },
        ],
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`image-press-0-${postUri}`));
      const lightboxImages = mockOpenLightbox.mock.calls[0][0];
      expect(lightboxImages).toHaveLength(2);
      expect(lightboxImages[0]).toEqual({ thumb: 'https://thumb.url/a', fullsize: 'https://full.url/a', alt: 'Alt text for image A' });
      expect(lightboxImages[1]).toEqual({ thumb: 'https://thumb.url/b', fullsize: 'https://full.url/b', alt: '' });
    });

    it('does not render image press targets when post has no images', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/noimgs';
      const post = makePost(postUri, 'alice.bsky.social');
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { queryByTestId } = renderWithProviders(<HomeScreen />);
      expect(queryByTestId(`image-press-0-${postUri}`)).toBeNull();
    });
  });

  // ─── Quote embed press ─────────────────────────────────
  describe('quote embed press', () => {
    it('navigates to quoted post thread with correct handle/postId/DID', () => {
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
        'did:plc:carol',
      );
    });

    it('navigates correctly when quoted author differs from parent author', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/qt2';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        record: {
          uri: 'at://did:plc:dave/app.bsky.feed.post/davepost',
          author: { handle: 'dave.bsky.social' },
        },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`quote-press-${postUri}`));
      // Should navigate to dave's post, not alice's
      expect(mockNavigateToThread).toHaveBeenCalledWith(
        'dave.bsky.social',
        'davepost',
        'did:plc:dave',
      );
    });
  });

  // ─── Mixed embed interactions ──────────────────────────
  describe('mixed embed interactions', () => {
    it('image tap opens lightbox, link tap opens browser on same post', () => {
      // Post with both images and external link (Bluesky supports this via recordWithMedia)
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/mixed1';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        images: [
          { thumb: 'https://cdn.example.com/t.jpg', fullsize: 'https://cdn.example.com/f.jpg', alt: 'Photo' },
        ],
        external: {
          uri: 'https://blog.example.com',
          title: 'Blog',
          description: '',
        },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);

      fireEvent.press(getByTestId(`image-press-0-${postUri}`));
      expect(mockOpenLightbox).toHaveBeenCalledTimes(1);
      expect(mockOpenLink).not.toHaveBeenCalled();

      fireEvent.press(getByTestId(`link-press-${postUri}`));
      expect(mockOpenLink).toHaveBeenCalledWith('https://blog.example.com', mockTheme.colors);
      expect(mockOpenLightbox).toHaveBeenCalledTimes(1); // still 1
    });

    it('post body tap navigates to thread even when embeds are present', () => {
      const postUri = 'at://did:plc:alice/app.bsky.feed.post/embedpost';
      const post = makePost(postUri, 'alice.bsky.social');
      post.post.embed = {
        external: {
          uri: 'https://example.com',
          title: 'Link',
          description: '',
        },
      };
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([post]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`post-press-${postUri}`));
      expect(mockNavigateToThread).toHaveBeenCalledWith('alice.bsky.social', 'embedpost', 'did:plc:alice');
      expect(mockOpenLink).not.toHaveBeenCalled();
    });

    it('pressing different posts triggers navigation with correct post data', () => {
      const uri1 = 'at://did:plc:alice/app.bsky.feed.post/p1';
      const uri2 = 'at://did:plc:bob/app.bsky.feed.post/p2';
      mockTimelineQuery = {
        ...mockTimelineQuery,
        data: makeFeedPage([
          makePost(uri1, 'alice.bsky.social'),
          makePost(uri2, 'bob.bsky.social'),
        ]),
        isLoading: false,
      };

      const { getByTestId } = renderWithProviders(<HomeScreen />);
      fireEvent.press(getByTestId(`post-press-${uri1}`));
      expect(mockNavigateToThread).toHaveBeenCalledWith('alice.bsky.social', 'p1', 'did:plc:alice');

      fireEvent.press(getByTestId(`post-press-${uri2}`));
      expect(mockNavigateToThread).toHaveBeenCalledWith('bob.bsky.social', 'p2', 'did:plc:bob');
    });
  });
});
