import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../../components/__tests__/test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 44, bottom: 34, left: 0, right: 0}),
}));

const mockRouterPush = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useNavigation: () => ({
    setOptions: mockSetOptions,
  }),
}));

jest.mock('../../../components/PostCardSkeleton', () => ({
  PostCardSkeleton: () => {
    const {View} = require('react-native');
    return <View testID="post-card-skeleton" />;
  },
}));

jest.mock('react-native-draggable-flatlist', () => {
  const {View} = require('react-native');
  const DraggableFlatList = (props: any) => (
    <View testID="draggable-list">
      {props.data?.map((item: any, i: number) => (
        <View key={i}>
          {props.renderItem({item, drag: jest.fn(), isActive: false})}
        </View>
      ))}
    </View>
  );
  const ScaleDecorator = ({children}: any) => children;
  return {__esModule: true, default: DraggableFlatList, ScaleDecorator};
});

let mockSavedFeeds: any[] | undefined = undefined;
let mockIsLoading = true;
let mockIsError = false;
const mockRefetch = jest.fn();

let mockPinnedFeedUris: string[] | undefined = undefined;

const mockUnsaveFeed = jest.fn();
const mockPinFeed = jest.fn();
const mockUnpinFeed = jest.fn();
const mockReorderFeeds = jest.fn();

jest.mock('../../../hooks/api', () => ({
  useSavedFeeds: () => ({
    data: mockSavedFeeds,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
  }),
  usePinnedFeeds: () => ({data: mockPinnedFeedUris}),
  useUnsaveFeed: () => ({mutate: mockUnsaveFeed}),
  usePinFeed: () => ({mutate: mockPinFeed}),
  useUnpinFeed: () => ({mutate: mockUnpinFeed}),
  useReorderSavedFeeds: () => ({mutate: mockReorderFeeds}),
}));

// ─── Import after mocks ───────────────────────────────────
import {SavedFeedsScreen} from '../SavedFeedsScreen';

// ─── Helpers ──────────────────────────────────────────────

function makeFeed(name: string, uri: string, likes = 100) {
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

// ─── Tests ────────────────────────────────────────────────

describe('SavedFeedsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSavedFeeds = undefined;
    mockIsLoading = true;
    mockIsError = false;
    mockPinnedFeedUris = undefined;
  });

  // ─── Loading state ─────────────────────────────────────
  describe('loading state', () => {
    it('shows 4 PostCardSkeleton while loading', () => {
      mockIsLoading = true;
      mockSavedFeeds = undefined;

      const {getAllByTestId} = render(<SavedFeedsScreen />);
      const skeletons = getAllByTestId('post-card-skeleton');
      expect(skeletons).toHaveLength(4);
    });

    it('does not show skeletons when data is loaded', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed('Tech News', 'at://did:plc:feed/app.bsky.feed.generator/1'),
      ];

      const {queryByTestId} = render(<SavedFeedsScreen />);
      expect(queryByTestId('post-card-skeleton')).toBeNull();
    });
  });

  // ─── Error state ───────────────────────────────────────
  describe('error state', () => {
    it('shows "Could not load feeds" when there is an error', () => {
      mockIsLoading = false;
      mockIsError = true;
      mockSavedFeeds = undefined;

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('Could not load feeds')).toBeTruthy();
    });

    it('shows "Pull down to retry" subtext in error state', () => {
      mockIsLoading = false;
      mockIsError = true;
      mockSavedFeeds = undefined;

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('Pull down to retry')).toBeTruthy();
    });
  });

  // ─── Empty state ───────────────────────────────────────
  describe('empty state', () => {
    it('shows "No saved feeds" when data is empty', () => {
      mockIsLoading = false;
      mockIsError = false;
      mockSavedFeeds = [];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('No saved feeds')).toBeTruthy();
    });

    it('shows discover subtext in empty state', () => {
      mockIsLoading = false;
      mockIsError = false;
      mockSavedFeeds = [];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(
        getByText('Visit the Discover tab to find and save feeds'),
      ).toBeTruthy();
    });
  });

  // ─── Feed cards rendering ─────────────────────────────
  describe('feed cards rendering', () => {
    it('renders feed display names', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
        makeFeed('Art Feed', 'at://did:plc:feed/app.bsky.feed.generator/art'),
      ];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('Tech News')).toBeTruthy();
      expect(getByText('Art Feed')).toBeTruthy();
    });

    it('renders creator handles with @ prefix', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('by @creator.bsky.social')).toBeTruthy();
    });

    it('renders like counts', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Popular Feed',
          'at://did:plc:feed/app.bsky.feed.generator/pop',
          1500,
        ),
      ];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText(/1,500/)).toBeTruthy();
      expect(getByText(/likes/)).toBeTruthy();
    });

    it('renders feed descriptions', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('Description of Tech News')).toBeTruthy();
    });
  });

  // ─── Header ────────────────────────────────────────────
  describe('header', () => {
    it('configures navigation header options', () => {
      mockIsLoading = false;
      mockSavedFeeds = [];

      render(<SavedFeedsScreen />);
      expect(mockSetOptions).toHaveBeenCalled();
    });

    it('configures navigation header during loading', () => {
      mockIsLoading = true;
      mockSavedFeeds = undefined;

      render(<SavedFeedsScreen />);
      expect(mockSetOptions).toHaveBeenCalled();
    });
  });

  // ─── Reorder button ────────────────────────────────────
  describe('reorder button', () => {
    it('sets headerRight with Reorder button when feeds exist', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      render(<SavedFeedsScreen />);
      // The component sets headerRight via navigation.setOptions
      const lastCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const headerRight = lastCall.headerRight;
      expect(headerRight).toBeDefined();
      // Render the headerRight component and check for Reorder text
      const {getByText} = render(headerRight());
      expect(getByText('Reorder')).toBeTruthy();
    });

    it('does not show Reorder button when no feeds exist', () => {
      mockIsLoading = false;
      mockSavedFeeds = [];

      render(<SavedFeedsScreen />);
      const lastCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const headerRight = lastCall.headerRight;
      // headerRight returns null when there are no feeds
      const result = headerRight();
      expect(result).toBeNull();
    });

    it('toggles to "Done" when Reorder is pressed', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      render(<SavedFeedsScreen />);
      // Get the headerRight renderer and press Reorder
      const firstCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const {getByText: getByTextFirst} = render(firstCall.headerRight());
      fireEvent.press(getByTextFirst('Reorder'));

      // After pressing, setOptions should be called again with "Done"
      const lastCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const {getByText} = render(lastCall.headerRight());
      expect(getByText('Done')).toBeTruthy();
    });

    it('calls reorderFeeds mutation when Done is pressed', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      render(<SavedFeedsScreen />);
      // Enter reorder mode
      const firstCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const {getByText: getByTextFirst} = render(firstCall.headerRight());
      fireEvent.press(getByTextFirst('Reorder'));

      // Exit reorder mode (saves order)
      const secondCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
      const {getByText: getByTextSecond} = render(secondCall.headerRight());
      fireEvent.press(getByTextSecond('Done'));

      expect(mockReorderFeeds).toHaveBeenCalledWith([
        'at://did:plc:feed/app.bsky.feed.generator/tech',
      ]);
    });
  });

  // ─── Pinned feeds ──────────────────────────────────────
  describe('pinned feeds', () => {
    it('shows pinned badge for pinned feeds', () => {
      mockIsLoading = false;
      const pinnedUri = 'at://did:plc:feed/app.bsky.feed.generator/pinned';
      mockSavedFeeds = [makeFeed('Pinned Feed', pinnedUri)];
      mockPinnedFeedUris = [pinnedUri];

      const {getAllByText} = render(<SavedFeedsScreen />);
      const pinnedElements = getAllByText(/Pinned/);
      expect(pinnedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show pinned badge for unpinned feeds', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Regular Feed',
          'at://did:plc:feed/app.bsky.feed.generator/regular',
        ),
      ];
      mockPinnedFeedUris = [];

      const {queryByText} = render(<SavedFeedsScreen />);
      expect(queryByText(/Pinned/)).toBeNull();
    });

    it('calls pinFeed when pin button is pressed on unpinned feed', () => {
      mockIsLoading = false;
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/unpin';
      mockSavedFeeds = [makeFeed('Unpinned Feed', feedUri)];
      mockPinnedFeedUris = [];

      const {getAllByText} = render(<SavedFeedsScreen />);
      // The pin button emoji
      const pinButtons = getAllByText('\uD83D\uDCCC');
      fireEvent.press(pinButtons[0]);
      expect(mockPinFeed).toHaveBeenCalledWith(feedUri);
    });

    it('calls unpinFeed when pin button is pressed on pinned feed', () => {
      mockIsLoading = false;
      const feedUri = 'at://did:plc:feed/app.bsky.feed.generator/pinned';
      mockSavedFeeds = [makeFeed('Pinned Feed', feedUri)];
      mockPinnedFeedUris = [feedUri];

      const {getAllByText} = render(<SavedFeedsScreen />);
      // The pin button emoji - first occurrence is the button, second is the badge
      const pinButtons = getAllByText('\uD83D\uDCCC');
      fireEvent.press(pinButtons[0]);
      expect(mockUnpinFeed).toHaveBeenCalledWith(feedUri);
    });
  });

  // ─── Close / remove button ──────────────────────────────
  describe('close button', () => {
    it('shows remove button on feed cards', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed(
          'Tech News',
          'at://did:plc:feed/app.bsky.feed.generator/tech',
        ),
      ];

      const {getAllByText} = render(<SavedFeedsScreen />);
      // Feed cards have a "✕" remove button
      const removeButtons = getAllByText('\u2715');
      expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render remove button when no feeds exist', () => {
      mockIsLoading = false;
      mockSavedFeeds = [];

      const {queryByText} = render(<SavedFeedsScreen />);
      // Without feeds, there are no remove buttons, so no "✕" at all
      expect(queryByText('\u2715')).toBeNull();
    });
  });

  // ─── Render stability ─────────────────────────────────
  describe('render stability', () => {
    it('renders without crashing in loading state', () => {
      mockIsLoading = true;
      mockSavedFeeds = undefined;
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('renders without crashing with empty data', () => {
      mockIsLoading = false;
      mockSavedFeeds = [];
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('renders without crashing with error state', () => {
      mockIsLoading = false;
      mockIsError = true;
      mockSavedFeeds = undefined;
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('renders without crashing with populated data', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed('Feed A', 'at://did:plc:feed/app.bsky.feed.generator/a'),
        makeFeed('Feed B', 'at://did:plc:feed/app.bsky.feed.generator/b'),
        makeFeed('Feed C', 'at://did:plc:feed/app.bsky.feed.generator/c'),
      ];
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('renders without crashing with pinned feeds data', () => {
      mockIsLoading = false;
      const uri = 'at://did:plc:feed/app.bsky.feed.generator/pinned';
      mockSavedFeeds = [makeFeed('Pinned', uri)];
      mockPinnedFeedUris = [uri];
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('handles undefined pinned feed uris gracefully', () => {
      mockIsLoading = false;
      mockSavedFeeds = [
        makeFeed('Feed', 'at://did:plc:feed/app.bsky.feed.generator/1'),
      ];
      mockPinnedFeedUris = undefined;
      expect(() => render(<SavedFeedsScreen />)).not.toThrow();
    });

    it('renders feed without description', () => {
      mockIsLoading = false;
      const feedNoDesc = {
        uri: 'at://did:plc:feed/app.bsky.feed.generator/nodesc',
        did: 'did:plc:feed-creator',
        creator: {
          did: 'did:plc:feed-creator',
          handle: 'creator.bsky.social',
          displayName: 'Feed Creator',
        },
        displayName: 'No Description Feed',
        avatar: 'https://example.com/avatar.jpg',
        likeCount: 50,
        indexedAt: '2025-01-01T00:00:00Z',
      };
      mockSavedFeeds = [feedNoDesc];

      const {getByText, queryByText} = render(<SavedFeedsScreen />);
      expect(getByText('No Description Feed')).toBeTruthy();
      expect(queryByText('Description of No Description Feed')).toBeNull();
    });

    it('renders feed without avatar using placeholder', () => {
      mockIsLoading = false;
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
      mockSavedFeeds = [feedNoAvatar];

      const {getByText} = render(<SavedFeedsScreen />);
      expect(getByText('No Avatar Feed')).toBeTruthy();
      // The placeholder shows the first character of the displayName
      expect(getByText('N')).toBeTruthy();
    });
  });
});
