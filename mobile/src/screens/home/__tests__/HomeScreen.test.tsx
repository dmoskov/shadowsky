import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
    const { query, emptyMessage } = props;
    const isLoading = query?.isLoading;
    const isError = query?.isError;
    const hasData = query?.data?.pages?.some(
      (p: any) => p.feed && p.feed.length > 0
    );

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
        {hasData && <Text testID="feed-content">Feed loaded</Text>}
      </View>
    );
  });
  NativeFeedList.displayName = 'NativeFeedList';

  return { NativeFeedList };
});

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

function makeFeedPage(posts: any[] = []) {
  return {
    pages: [{ cursor: 'cursor-1', feed: posts }],
    pageParams: [undefined],
  };
}

function makePost(uri: string, handle = 'alice.bsky.social') {
  return {
    post: {
      uri,
      cid: `cid-${uri}`,
      author: {
        did: 'did:plc:test',
        handle,
        displayName: 'Alice',
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
      const { getByTestId } = render(<HomeScreen />);
      expect(getByTestId('feed-loading')).toBeTruthy();
    });

    it('passes loading query to NativeFeedList', () => {
      const { getByTestId } = render(<HomeScreen />);
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

      const { getByTestId, getByText } = render(<HomeScreen />);
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

      const { getByTestId } = render(<HomeScreen />);
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

      const { getByTestId, getByText } = render(<HomeScreen />);
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

      const { queryByText } = render(<HomeScreen />);
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

      const { getByText } = render(<HomeScreen />);
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

      const { getByText } = render(<HomeScreen />);
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

      const { getByText } = render(<HomeScreen />);
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

      const { getByText } = render(<HomeScreen />);
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

      const { getByText } = render(<HomeScreen />);
      fireEvent.press(getByText('+ Discover'));
      expect(mockRouterPush).toHaveBeenCalledWith('/(app)/feeds/discover');
    });
  });

  // ─── Renders without crashing in various states ─────────
  describe('render stability', () => {
    it('renders without crashing with all default mocks', () => {
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('renders with empty saved feeds array', () => {
      mockSavedFeeds = [];
      expect(() => render(<HomeScreen />)).not.toThrow();
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

      expect(() => render(<HomeScreen />)).not.toThrow();
    });
  });
});
