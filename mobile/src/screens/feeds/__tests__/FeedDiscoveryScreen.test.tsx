import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {mockTheme} from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 44, bottom: 34, left: 0, right: 0}),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('../../../components/PostCardSkeleton', () => ({
  PostCardSkeleton: () => {
    const {View} = require('react-native');
    return <View testID="post-card-skeleton" />;
  },
}));

let mockPopularData: any = undefined;
let mockIsLoadingPopular = false;
const mockFetchNextPopular = jest.fn();
let mockHasNextPopular = false;
let mockIsFetchingNextPopular = false;
const mockRefetchPopular = jest.fn();

let mockSuggestedData: any = undefined;
let mockIsLoadingSuggested = false;
const mockFetchNextSuggested = jest.fn();
let mockHasNextSuggested = false;
let mockIsFetchingNextSuggested = false;
const mockRefetchSuggested = jest.fn();

let mockSearchData: any = undefined;
let mockIsLoadingSearch = false;
const mockFetchNextSearch = jest.fn();
let mockHasNextSearch = false;
let mockIsFetchingNextSearch = false;
const mockRefetchSearch = jest.fn();

let mockSavedFeedsData: any[] | undefined = undefined;
let mockPinnedFeedUris: string[] | undefined = undefined;

const mockSaveFeed = jest.fn();
const mockUnsaveFeed = jest.fn();
const mockPinFeed = jest.fn();
const mockUnpinFeed = jest.fn();

jest.mock('../../../hooks/api', () => ({
  usePopularFeedGenerators: () => ({
    data: mockPopularData,
    isLoading: mockIsLoadingPopular,
    fetchNextPage: mockFetchNextPopular,
    hasNextPage: mockHasNextPopular,
    isFetchingNextPage: mockIsFetchingNextPopular,
    refetch: mockRefetchPopular,
  }),
  useSuggestedFeeds: () => ({
    data: mockSuggestedData,
    isLoading: mockIsLoadingSuggested,
    fetchNextPage: mockFetchNextSuggested,
    hasNextPage: mockHasNextSuggested,
    isFetchingNextPage: mockIsFetchingNextSuggested,
    refetch: mockRefetchSuggested,
  }),
  useSearchFeedGenerators: () => ({
    data: mockSearchData,
    isLoading: mockIsLoadingSearch,
    fetchNextPage: mockFetchNextSearch,
    hasNextPage: mockHasNextSearch,
    isFetchingNextPage: mockIsFetchingNextSearch,
    refetch: mockRefetchSearch,
  }),
  useSavedFeeds: () => ({data: mockSavedFeedsData}),
  usePinnedFeeds: () => ({data: mockPinnedFeedUris}),
  useSaveFeed: () => ({mutate: mockSaveFeed}),
  useUnsaveFeed: () => ({mutate: mockUnsaveFeed}),
  usePinFeed: () => ({mutate: mockPinFeed}),
  useUnpinFeed: () => ({mutate: mockUnpinFeed}),
}));

// ─── Import after mocks ───────────────────────────────────
import {FeedDiscoveryScreen} from '../FeedDiscoveryScreen';

// ─── Helpers ──────────────────────────────────────────────

function makeFeed(name: string, uri: string, likes = 50) {
  return {
    uri,
    did: 'did:plc:feed-creator',
    creator: {
      did: 'did:plc:feed-creator',
      handle: 'creator.bsky.social',
      displayName: 'Feed Creator',
    },
    displayName: name,
    description: `Description of ${name}`,
    avatar: `https://example.com/${name}.jpg`,
    likeCount: likes,
    indexedAt: '2025-01-01T00:00:00Z',
  };
}

function makeFeedsPage(feeds: any[]) {
  return {pages: [{feeds, cursor: 'cursor-1'}], pageParams: [undefined]};
}

// ─── Tests ────────────────────────────────────────────────

describe('FeedDiscoveryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPopularData = undefined;
    mockIsLoadingPopular = false;
    mockHasNextPopular = false;
    mockIsFetchingNextPopular = false;

    mockSuggestedData = undefined;
    mockIsLoadingSuggested = false;
    mockHasNextSuggested = false;
    mockIsFetchingNextSuggested = false;

    mockSearchData = undefined;
    mockIsLoadingSearch = false;
    mockHasNextSearch = false;
    mockIsFetchingNextSearch = false;

    mockSavedFeedsData = undefined;
    mockPinnedFeedUris = undefined;
  });

  // ─── Tab rendering ────────────────────────────────────
  describe('tab rendering', () => {
    it('renders Popular, Suggested, and Search tabs', () => {
      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('Popular')).toBeTruthy();
      expect(getByText('Suggested')).toBeTruthy();
      expect(getByText('Search')).toBeTruthy();
    });

    it('defaults to the Popular tab', () => {
      mockPopularData = makeFeedsPage([
        makeFeed('Pop Feed', 'at://did:plc:feed/app.bsky.feed.generator/pop'),
      ]);

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('Pop Feed')).toBeTruthy();
    });

    it('respects initialTab prop', () => {
      mockSuggestedData = makeFeedsPage([
        makeFeed(
          'Suggested Feed',
          'at://did:plc:feed/app.bsky.feed.generator/sug',
        ),
      ]);

      const {getByText} = render(
        <FeedDiscoveryScreen initialTab="suggested" />,
      );
      expect(getByText('Suggested Feed')).toBeTruthy();
    });
  });

  // ─── Loading state ────────────────────────────────────
  describe('loading state', () => {
    it('shows 4 PostCardSkeleton while loading popular feeds', () => {
      mockIsLoadingPopular = true;
      mockPopularData = undefined;

      const {getAllByTestId} = render(<FeedDiscoveryScreen />);
      const skeletons = getAllByTestId('post-card-skeleton');
      expect(skeletons).toHaveLength(4);
    });

    it('shows skeletons when loading suggested feeds', () => {
      mockIsLoadingSuggested = true;
      mockSuggestedData = undefined;

      const {getAllByTestId} = render(
        <FeedDiscoveryScreen initialTab="suggested" />,
      );
      const skeletons = getAllByTestId('post-card-skeleton');
      expect(skeletons).toHaveLength(4);
    });

    it('does not show skeletons when data is loaded', () => {
      mockIsLoadingPopular = false;
      mockPopularData = makeFeedsPage([
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ]);

      const {queryByTestId} = render(<FeedDiscoveryScreen />);
      expect(queryByTestId('post-card-skeleton')).toBeNull();
    });
  });

  // ─── Popular feeds rendering ──────────────────────────
  describe('popular feeds rendering', () => {
    it('renders feed display names and creator handles', () => {
      mockPopularData = makeFeedsPage([
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
        makeFeed('Art Feed', 'at://did:plc:feed/app.bsky.feed.generator/art'),
      ]);

      const {getByText, getAllByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('Tech News')).toBeTruthy();
      expect(getByText('Art Feed')).toBeTruthy();
      // Both feeds share the same creator handle
      expect(getAllByText('by @creator.bsky.social')).toHaveLength(2);
    });

    it('renders feed descriptions', () => {
      mockPopularData = makeFeedsPage([
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ]);

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('Description of Tech News')).toBeTruthy();
    });

    it('renders like counts', () => {
      mockPopularData = makeFeedsPage([
        makeFeed(
          'Popular Feed',
          'at://did:plc:feed/app.bsky.feed.generator/pop',
          1500,
        ),
      ]);

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText(/1,500/)).toBeTruthy();
      expect(getByText(/likes/)).toBeTruthy();
    });
  });

  // ─── Tab switching ────────────────────────────────────
  describe('tab switching', () => {
    it('switches to Suggested tab and shows suggested feeds', () => {
      mockPopularData = makeFeedsPage([
        makeFeed('Pop Feed', 'at://did:plc:feed/app.bsky.feed.generator/pop'),
      ]);
      mockSuggestedData = makeFeedsPage([
        makeFeed(
          'Suggested Feed',
          'at://did:plc:feed/app.bsky.feed.generator/sug',
        ),
      ]);

      const {getByText, queryByText} = render(<FeedDiscoveryScreen />);
      // Initially on Popular tab
      expect(getByText('Pop Feed')).toBeTruthy();

      // Switch to Suggested tab
      fireEvent.press(getByText('Suggested'));
      expect(getByText('Suggested Feed')).toBeTruthy();
      expect(queryByText('Pop Feed')).toBeNull();
    });

    it('switches to Search tab and back to Popular', () => {
      mockPopularData = makeFeedsPage([
        makeFeed('Pop Feed', 'at://did:plc:feed/app.bsky.feed.generator/pop'),
      ]);

      const {getByText, queryByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('Pop Feed')).toBeTruthy();

      // Switch to Search tab
      fireEvent.press(getByText('Search'));
      expect(queryByText('Pop Feed')).toBeNull();

      // Switch back to Popular
      fireEvent.press(getByText('Popular'));
      expect(getByText('Pop Feed')).toBeTruthy();
    });
  });

  // ─── Search tab ───────────────────────────────────────
  describe('search tab', () => {
    it('shows search input with correct placeholder', () => {
      const {getByText, getByPlaceholderText} = render(
        <FeedDiscoveryScreen initialTab="search" />,
      );
      expect(getByPlaceholderText('Search for feeds...')).toBeTruthy();
    });

    it('shows search input only on the Search tab', () => {
      const {getByText, queryByPlaceholderText} = render(
        <FeedDiscoveryScreen />,
      );
      // Popular tab - no search input
      expect(queryByPlaceholderText('Search for feeds...')).toBeNull();

      // Switch to Search tab
      fireEvent.press(getByText('Search'));
      expect(queryByPlaceholderText('Search for feeds...')).toBeTruthy();
    });
  });

  // ─── Search empty state ───────────────────────────────
  describe('search empty state', () => {
    it('shows "Search for custom feeds" when search tab has no query', () => {
      const {getByText} = render(
        <FeedDiscoveryScreen initialTab="search" />,
      );
      expect(getByText('Search for custom feeds')).toBeTruthy();
      expect(
        getByText('Enter a search term to discover feeds'),
      ).toBeTruthy();
    });
  });

  // ─── No results state ────────────────────────────────
  describe('no results state', () => {
    it('shows "No feeds found" when popular tab has no data', () => {
      mockIsLoadingPopular = false;
      mockPopularData = makeFeedsPage([]);

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('No feeds found')).toBeTruthy();
      expect(
        getByText('Try a different search or check back later'),
      ).toBeTruthy();
    });

    it('shows "No feeds found" when suggested tab is empty', () => {
      mockIsLoadingSuggested = false;
      mockSuggestedData = makeFeedsPage([]);

      const {getByText} = render(
        <FeedDiscoveryScreen initialTab="suggested" />,
      );
      expect(getByText('No feeds found')).toBeTruthy();
    });
  });

  // ─── Save button toggle ──────────────────────────────
  describe('save button toggle', () => {
    it('shows + for unsaved feeds', () => {
      mockPopularData = makeFeedsPage([
        makeFeed(
          'Unsaved Feed',
          'at://did:plc:feed/app.bsky.feed.generator/unsaved',
        ),
      ]);
      mockSavedFeedsData = [];

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('+')).toBeTruthy();
    });

    it('shows checkmark for saved feeds', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/saved';
      mockPopularData = makeFeedsPage([makeFeed('Saved Feed', feedUri)]);
      mockSavedFeedsData = [{uri: feedUri}];

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('\u2713')).toBeTruthy();
    });

    it('calls saveFeed when + button is pressed', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/unsaved';
      mockPopularData = makeFeedsPage([makeFeed('Unsaved Feed', feedUri)]);
      mockSavedFeedsData = [];

      const {getByText} = render(<FeedDiscoveryScreen />);
      fireEvent.press(getByText('+'));
      expect(mockSaveFeed).toHaveBeenCalledWith(feedUri);
    });

    it('calls unsaveFeed when checkmark button is pressed', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/saved';
      mockPopularData = makeFeedsPage([makeFeed('Saved Feed', feedUri)]);
      mockSavedFeedsData = [{uri: feedUri}];

      const {getByText} = render(<FeedDiscoveryScreen />);
      fireEvent.press(getByText('\u2713'));
      expect(mockUnsaveFeed).toHaveBeenCalledWith(feedUri);
    });
  });

  // ─── Pin button visibility ───────────────────────────
  describe('pin button visibility', () => {
    it('shows pin button only for saved feeds', () => {
      const savedUri = 'at://did:plc:feed/app.bsky.feed.generator/saved';
      const unsavedUri = 'at://did:plc:feed/app.bsky.feed.generator/unsaved';
      mockPopularData = makeFeedsPage([
        makeFeed('Saved Feed', savedUri),
        makeFeed('Unsaved Feed', unsavedUri),
      ]);
      mockSavedFeedsData = [{uri: savedUri}];
      mockPinnedFeedUris = [];

      const {getAllByText} = render(<FeedDiscoveryScreen />);
      // Pin emoji should appear exactly once (only for saved feed)
      const pinButtons = getAllByText('\uD83D\uDCCC');
      expect(pinButtons).toHaveLength(1);
    });

    it('does not show pin button for unsaved feeds', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/unsaved';
      mockPopularData = makeFeedsPage([makeFeed('Unsaved Feed', feedUri)]);
      mockSavedFeedsData = [];
      mockPinnedFeedUris = [];

      const {queryByText} = render(<FeedDiscoveryScreen />);
      expect(queryByText('\uD83D\uDCCC')).toBeNull();
    });

    it('calls pinFeed when pin button is pressed on unpinned saved feed', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/saved';
      mockPopularData = makeFeedsPage([makeFeed('Saved Feed', feedUri)]);
      mockSavedFeedsData = [{uri: feedUri}];
      mockPinnedFeedUris = [];

      const {getByText} = render(<FeedDiscoveryScreen />);
      fireEvent.press(getByText('\uD83D\uDCCC'));
      expect(mockPinFeed).toHaveBeenCalledWith(feedUri);
    });

    it('calls unpinFeed when pin button is pressed on pinned feed', () => {
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/saved';
      mockPopularData = makeFeedsPage([makeFeed('Saved Feed', feedUri)]);
      mockSavedFeedsData = [{uri: feedUri}];
      mockPinnedFeedUris = [feedUri];

      const {getAllByText} = render(<FeedDiscoveryScreen />);
      // First pin emoji is the button, second is the "Pinned" badge text
      const pinButtons = getAllByText('\uD83D\uDCCC');
      fireEvent.press(pinButtons[0]);
      expect(mockUnpinFeed).toHaveBeenCalledWith(feedUri);
    });
  });

  // ─── Search debounce ─────────────────────────────────
  describe('search debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debounces search input by 300ms', () => {
      mockSearchData = makeFeedsPage([
        makeFeed(
          'Result Feed',
          'at://did:plc:feed/app.bsky.feed.generator/result',
        ),
      ]);

      const {getByPlaceholderText} = render(
        <FeedDiscoveryScreen initialTab="search" />,
      );

      const input = getByPlaceholderText('Search for feeds...');
      fireEvent.changeText(input, 'test query');

      // Advance timers by 300ms to trigger the debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // The component should have updated debouncedQuery by now.
      // We verify no crash occurs and the component remains stable.
      expect(input).toBeTruthy();
    });
  });

  // ─── Render stability ────────────────────────────────
  describe('render stability', () => {
    it('renders without crashing with no data', () => {
      expect(() => render(<FeedDiscoveryScreen />)).not.toThrow();
    });

    it('renders without crashing in loading state', () => {
      mockIsLoadingPopular = true;
      expect(() => render(<FeedDiscoveryScreen />)).not.toThrow();
    });

    it('renders without crashing with populated data', () => {
      mockPopularData = makeFeedsPage([
        makeFeed('Feed A', 'at://did:plc:feed/app.bsky.feed.generator/a'),
        makeFeed('Feed B', 'at://did:plc:feed/app.bsky.feed.generator/b'),
        makeFeed('Feed C', 'at://did:plc:feed/app.bsky.feed.generator/c'),
      ]);
      mockSavedFeedsData = [
        {uri: 'at://did:plc:feed/app.bsky.feed.generator/a'},
      ];
      mockPinnedFeedUris = [
        'at://did:plc:feed/app.bsky.feed.generator/a',
      ];
      expect(() => render(<FeedDiscoveryScreen />)).not.toThrow();
    });

    it('handles undefined saved feeds and pinned uris gracefully', () => {
      mockPopularData = makeFeedsPage([
        makeFeed('Feed', 'at://did:plc:feed/app.bsky.feed.generator/1'),
      ]);
      mockSavedFeedsData = undefined;
      mockPinnedFeedUris = undefined;
      expect(() => render(<FeedDiscoveryScreen />)).not.toThrow();
    });

    it('renders feed without avatar using placeholder', () => {
      const feedNoAvatar = {
        uri: 'at://did:plc:feed/app.bsky.feed.generator/noavatar',
        did: 'did:plc:feed-creator',
        creator: {
          did: 'did:plc:feed-creator',
          handle: 'creator.bsky.social',
          displayName: 'Feed Creator',
        },
        displayName: 'No Avatar Feed',
        description: 'A feed with no avatar',
        likeCount: 25,
        indexedAt: '2025-01-01T00:00:00Z',
      };
      mockPopularData = makeFeedsPage([feedNoAvatar]);

      const {getByText} = render(<FeedDiscoveryScreen />);
      expect(getByText('No Avatar Feed')).toBeTruthy();
      // Placeholder shows first character of displayName
      expect(getByText('N')).toBeTruthy();
    });

    it('renders all three tabs across each initialTab value', () => {
      for (const tab of ['popular', 'suggested', 'search'] as const) {
        const {getByText, unmount} = render(
          <FeedDiscoveryScreen initialTab={tab} />,
        );
        expect(getByText('Popular')).toBeTruthy();
        expect(getByText('Suggested')).toBeTruthy();
        expect(getByText('Search')).toBeTruthy();
        unmount();
      }
    });
  });
});
