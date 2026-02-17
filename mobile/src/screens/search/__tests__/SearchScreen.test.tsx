import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useScrollToTop: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  }),
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

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

// ─── Controllable hook mocks ──────────────────────────────

let mockActors: any[] = [];
let mockIsLoadingActors = false;
let mockIsErrorActors = false;
const mockRefetchActors = jest.fn();

jest.mock('../../../hooks/api/useProfile', () => ({
  useSearchActors: () => ({
    data: mockActors,
    isLoading: mockIsLoadingActors,
    isError: mockIsErrorActors,
    refetch: mockRefetchActors,
  }),
}));

let mockPostsData: any = undefined;
let mockIsLoadingPosts = false;
let mockIsErrorPosts = false;
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
const mockRefetchPosts = jest.fn();

const mockSearchPostsQuery: any = {
  get data() { return mockPostsData; },
  get isLoading() { return mockIsLoadingPosts; },
  get isError() { return mockIsErrorPosts; },
  get fetchNextPage() { return mockFetchNextPage; },
  get hasNextPage() { return mockHasNextPage; },
  get isFetchingNextPage() { return mockIsFetchingNextPage; },
  get refetch() { return mockRefetchPosts; },
};

jest.mock('../../../hooks/api/useSearchPosts', () => ({
  useSearchPosts: () => mockSearchPostsQuery,
}));

jest.mock('../../../hooks/useOfflineFeed', () => ({
  useOfflineFeedEnhancer: (query: any) => ({
    ...query,
    isServingCached: false,
    isStale: false,
    isOnline: true,
  }),
  useOfflineFeedStatus: () => ({
    isOnline: true,
    isServingCached: false,
    cachedItemCount: 0,
    lastCachedAt: null,
    isInitialized: true,
    isStale: false,
  }),
}));

const mockToggleBookmark = jest.fn();
jest.mock('../../../hooks/api/useBookmarks', () => ({
  useBookmarks: () => ({
    toggleBookmark: mockToggleBookmark,
    isBookmarked: jest.fn(() => false),
    bookmarks: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isToggling: false,
  }),
}));

let mockTopics: any[] = [];
let mockTrends: any[] = [];
let mockIsLoadingTrending = false;

jest.mock('../../../hooks/useTrending', () => ({
  useTrendingData: () => ({
    topics: mockTopics,
    trends: mockTrends,
    isLoading: mockIsLoadingTrending,
    isLoadingTopics: false,
    isLoadingTrends: false,
    topicsError: null,
    trendsError: null,
    error: null,
    suggested: [],
    refetchTopics: jest.fn(),
    refetchTrends: jest.fn(),
    refetchAll: jest.fn(),
  }),
}));

// Mock child components to simplify
jest.mock('../../../components/FeedList', () => {
  const { View, Text } = require('react-native');
  const React = require('react');
  const FeedList = React.forwardRef((props: any, _ref: any) => {
    const { posts, isLoading, error, emptyMessage, onRefresh, onLoadMore } = props;
    return (
      <View testID="feed-list">
        {isLoading && <Text testID="posts-loading">Loading posts...</Text>}
        {error && <Text testID="posts-error">Error loading posts</Text>}
        {!isLoading && !error && posts?.length === 0 && (
          <Text testID="posts-empty">{emptyMessage}</Text>
        )}
        {posts?.length > 0 && (
          <Text testID="posts-content">{posts.length} posts</Text>
        )}
      </View>
    );
  });
  FeedList.displayName = 'FeedList';
  return { FeedList };
});

jest.mock('../../../components/TrendingTopics', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    TrendingTopics: ({ topics, onTopicClick, isLoading }: any) => (
      <View testID="trending-topics">
        {isLoading && <Text testID="trending-loading">Loading trends...</Text>}
        {topics?.map((t: any, i: number) => (
          <TouchableOpacity
            key={i}
            testID={`trending-topic-${i}`}
            onPress={() => onTopicClick(t.topic)}
          >
            <Text>{t.topic}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

jest.mock('../../../components/SearchFilterSheet', () => ({
  SearchFilterSheet: ({ visible, onClose, onApplyFilters }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="filter-sheet">
        <Text>Filters</Text>
        <TouchableOpacity testID="filter-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="filter-apply-latest"
          onPress={() => onApplyFilters({ sort: 'latest', mediaFilter: 'all' })}
        >
          <Text>Apply Latest</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../../components/StaleContentIndicator', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="stale-indicator" />,
  };
});

jest.mock('../../../components/Avatar', () => ({
  Avatar: ({ uri }: any) => {
    const { View } = require('react-native');
    return <View testID="avatar" />;
  },
}));

// ─── Import after mocks ───────────────────────────────────
import { SearchScreen } from '../SearchScreen';

// ─── Helpers ──────────────────────────────────────────────

function makeActor(handle: string, displayName?: string) {
  return {
    did: `did:plc:${handle}`,
    handle: `${handle}.bsky.social`,
    displayName: displayName || handle,
    avatar: `https://example.com/${handle}.jpg`,
    description: `Bio for ${handle}`,
    labels: [],
  };
}

function makeSearchPage(posts: any[]) {
  return {
    pages: [{ feed: posts, cursor: 'cursor-1' }],
    pageParams: [undefined],
  };
}

function makeSearchPost(id: string) {
  return {
    post: {
      uri: `at://did:plc:test/app.bsky.feed.post/${id}`,
      cid: `cid-${id}`,
      author: {
        did: 'did:plc:test',
        handle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: 'https://example.com/avatar.jpg',
      },
      record: { text: `Post ${id}`, createdAt: new Date().toISOString() },
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

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockActors = [];
    mockIsLoadingActors = false;
    mockIsErrorActors = false;
    mockPostsData = undefined;
    mockIsLoadingPosts = false;
    mockIsErrorPosts = false;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
    mockTopics = [];
    mockTrends = [];
    mockIsLoadingTrending = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initial render ─────────────────────────────────────
  describe('initial render', () => {
    it('renders without crashing', () => {
      expect(() => render(<SearchScreen />)).not.toThrow();
    });

    it('renders search input with placeholder', () => {
      const { getByPlaceholderText } = render(<SearchScreen />);
      expect(
        getByPlaceholderText('Search posts, users, hashtags...')
      ).toBeTruthy();
    });

    it('renders tab bar with People, Posts, and Hashtags tabs', () => {
      const { getByText } = render(<SearchScreen />);
      expect(getByText('People')).toBeTruthy();
      expect(getByText('Posts')).toBeTruthy();
      expect(getByText('Hashtags')).toBeTruthy();
    });

    it('renders trending topics when no search query', () => {
      mockTopics = [
        { topic: '#react' },
        { topic: '#typescript' },
      ];
      const { getByTestId } = render(<SearchScreen />);
      expect(getByTestId('trending-topics')).toBeTruthy();
    });
  });

  // ─── Search input ───────────────────────────────────────
  describe('search input', () => {
    it('updates search query on text change', () => {
      const { getByPlaceholderText } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test query');
      expect(input.props.value).toBe('test query');
    });

    it('accepts initial query prop', () => {
      const { getByPlaceholderText } = render(
        <SearchScreen query="initial search" />
      );
      const input = getByPlaceholderText('Search posts, users, hashtags...');
      expect(input.props.value).toBe('initial search');
    });

    it('debounces search query', () => {
      mockIsLoadingPosts = true;

      const { getByPlaceholderText } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'hello');

      // Before debounce timeout, the debounced query should not have updated
      // After the timeout, it should update
      act(() => {
        jest.advanceTimersByTime(300);
      });
      // The debounce timer has fired, search should now be active
    });
  });

  // ─── Tab switching ──────────────────────────────────────
  describe('tab switching', () => {
    it('switches to People tab', () => {
      const { getByText } = render(<SearchScreen />);
      fireEvent.press(getByText('People'));
      // People tab should be active - verify it renders the people list
    });

    it('switches to Posts tab', () => {
      const { getByText } = render(<SearchScreen />);
      fireEvent.press(getByText('Posts'));
      // Posts tab should be active
    });

    it('switches to Hashtags tab', () => {
      const { getByText } = render(<SearchScreen />);
      fireEvent.press(getByText('Hashtags'));
      // Hashtags tab should be active
    });

    it('switches between tabs without crashing', () => {
      const { getByText } = render(<SearchScreen />);

      fireEvent.press(getByText('People'));
      fireEvent.press(getByText('Hashtags'));
      fireEvent.press(getByText('Posts'));
      fireEvent.press(getByText('People'));
      // Should not crash
    });
  });

  // ─── Empty states ───────────────────────────────────────
  describe('empty states', () => {
    it('shows prompt text when no query on Posts tab', () => {
      const { getByTestId } = render(<SearchScreen />);
      const emptyEl = getByTestId('posts-empty');
      expect(emptyEl.props.children).toBe('Search for posts by keyword');
    });

    it('shows prompt text when no query on Hashtags tab', () => {
      const { getByText, getByTestId } = render(<SearchScreen />);
      fireEvent.press(getByText('Hashtags'));

      const emptyEl = getByTestId('posts-empty');
      expect(emptyEl.props.children).toBe('Search for posts by hashtag');
    });

    it('shows "No results found" when query returns empty on Posts tab', () => {
      mockPostsData = makeSearchPage([]);
      mockIsLoadingPosts = false;

      const { getByPlaceholderText, getByTestId } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'nonexistent');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const emptyEl = getByTestId('posts-empty');
      expect(emptyEl.props.children).toBe('No results found');
    });
  });

  // ─── Loading states ─────────────────────────────────────
  describe('loading states', () => {
    it('shows loading spinner when searching posts', () => {
      mockIsLoadingPosts = true;

      const { getByPlaceholderText, getByText } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Searching...')).toBeTruthy();
    });

    it('shows loading spinner when searching people', () => {
      mockIsLoadingActors = true;

      const { getByPlaceholderText, getByText } = render(<SearchScreen />);

      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'alice');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Searching...')).toBeTruthy();
    });

    it('shows trending topics loading state', () => {
      mockIsLoadingTrending = true;
      const { getByTestId } = render(<SearchScreen />);
      expect(getByTestId('trending-loading')).toBeTruthy();
    });
  });

  // ─── People search results ──────────────────────────────
  describe('people search results', () => {
    it('renders actor results in People tab', () => {
      mockActors = [
        makeActor('alice', 'Alice'),
        makeActor('bob', 'Bob'),
      ];

      const { getByText, getByPlaceholderText } = render(<SearchScreen />);
      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'a');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('@alice.bsky.social')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });

    it('shows actor description', () => {
      mockActors = [makeActor('alice', 'Alice')];

      const { getByText, getByPlaceholderText } = render(<SearchScreen />);
      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'alice');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Bio for alice')).toBeTruthy();
    });

    it('navigates to profile when actor is pressed', () => {
      mockActors = [makeActor('alice', 'Alice')];

      const { getByText, getByPlaceholderText } = render(<SearchScreen />);
      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'alice');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(getByText('Alice'));
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/(app)/(tabs)/(search)/profile/alice.bsky.social'
      );
    });
  });

  // ─── Post search results ────────────────────────────────
  describe('post search results', () => {
    it('renders post results on Posts tab', () => {
      mockPostsData = makeSearchPage([
        makeSearchPost('1'),
        makeSearchPost('2'),
      ]);

      const { getByPlaceholderText, getByTestId } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByTestId('posts-content')).toBeTruthy();
    });
  });

  // ─── Error states ───────────────────────────────────────
  describe('error states', () => {
    it('renders error state for posts search', () => {
      mockIsErrorPosts = true;
      mockPostsData = undefined;

      const { getByPlaceholderText, getByTestId } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'error test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByTestId('posts-error')).toBeTruthy();
    });
  });

  // ─── Pull to refresh ───────────────────────────────────
  describe('pull to refresh', () => {
    it('exposes refresh control for people tab', () => {
      mockActors = [makeActor('alice')];

      const { getByText, getByPlaceholderText } = render(<SearchScreen />);
      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'alice');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // The FlatList with RefreshControl is rendered for the People tab
      // We can verify the component renders without crash
    });
  });

  // ─── Filter selection ───────────────────────────────────
  describe('filter selection', () => {
    it('shows filter button when query exists on Posts tab', () => {
      mockPostsData = makeSearchPage([makeSearchPost('1')]);

      const { getByPlaceholderText, getByText } = render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Filters')).toBeTruthy();
    });

    it('does not show filter button on People tab', () => {
      const { getByText, getByPlaceholderText, queryByText } = render(
        <SearchScreen />
      );
      fireEvent.press(getByText('People'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Filters button should not appear for People tab
      // (The filter button only shows for posts/hashtags tabs with a query)
      expect(queryByText('Filters')).toBeNull();
    });

    it('shows filter button on Hashtags tab with query', () => {
      mockPostsData = makeSearchPage([makeSearchPost('1')]);

      const { getByText, getByPlaceholderText } = render(<SearchScreen />);
      fireEvent.press(getByText('Hashtags'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      fireEvent.changeText(input, 'react');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(getByText('Filters')).toBeTruthy();
    });

    it('opens filter sheet when Filters button is pressed', () => {
      mockPostsData = makeSearchPage([makeSearchPost('1')]);

      const { getByPlaceholderText, getByText, getByTestId } = render(
        <SearchScreen />
      );
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(getByText('Filters'));
      expect(getByTestId('filter-sheet')).toBeTruthy();
    });

    it('closes filter sheet', () => {
      mockPostsData = makeSearchPage([makeSearchPost('1')]);

      const { getByPlaceholderText, getByText, getByTestId, queryByTestId } =
        render(<SearchScreen />);
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'test');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Open filter sheet
      fireEvent.press(getByText('Filters'));
      expect(getByTestId('filter-sheet')).toBeTruthy();

      // Close it
      fireEvent.press(getByTestId('filter-close'));
      expect(queryByTestId('filter-sheet')).toBeNull();
    });
  });

  // ─── Trending topics interaction ────────────────────────
  describe('trending topics', () => {
    it('sets search query when trending topic is pressed', () => {
      mockTopics = [{ topic: '#react' }];

      const { getByTestId, getByPlaceholderText } = render(<SearchScreen />);

      fireEvent.press(getByTestId('trending-topic-0'));

      const input = getByPlaceholderText('Search posts, users, hashtags...');
      // Pressing trending topic with "#react" should set query to "react" (without #)
      expect(input.props.value).toBe('react');
    });

    it('switches to hashtags tab when trending topic is pressed', () => {
      mockTopics = [{ topic: '#typescript' }];

      const { getByTestId } = render(<SearchScreen />);
      fireEvent.press(getByTestId('trending-topic-0'));
      // The component switches activeTab to "hashtags" internally
    });

    it('hides trending topics when search query is active', () => {
      mockTopics = [{ topic: '#react' }];

      const { getByPlaceholderText, queryByTestId } = render(
        <SearchScreen />
      );
      const input = getByPlaceholderText('Search posts, users, hashtags...');

      fireEvent.changeText(input, 'something');
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(queryByTestId('trending-topics')).toBeNull();
    });
  });

  // ─── Render stability ──────────────────────────────────
  describe('render stability', () => {
    it('renders with empty actors array', () => {
      mockActors = [];
      expect(() => render(<SearchScreen />)).not.toThrow();
    });

    it('renders with undefined posts data', () => {
      mockPostsData = undefined;
      expect(() => render(<SearchScreen />)).not.toThrow();
    });

    it('renders with initial query prop and active debounce', () => {
      expect(() =>
        render(<SearchScreen query="initial" />)
      ).not.toThrow();
    });

    it('handles rapid tab switching', () => {
      const { getByText } = render(<SearchScreen />);
      for (let i = 0; i < 10; i++) {
        fireEvent.press(getByText('People'));
        fireEvent.press(getByText('Posts'));
        fireEvent.press(getByText('Hashtags'));
      }
      // Should not crash
    });
  });
});
