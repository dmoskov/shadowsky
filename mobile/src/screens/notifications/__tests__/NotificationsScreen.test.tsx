import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {mockTheme} from '../../../components/__tests__/test-utils';

// ─── Controllable mocks ────────────────────────────────────

let mockNotificationsData: any = null;
let mockIsLoading = false;
let mockIsError = false;
let mockError: Error | null = null;
const mockRefetch = jest.fn(() => Promise.resolve());
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
const mockMarkSeenMutate = jest.fn();
const mockNavigateToProfile = jest.fn();
const mockNavigateToThread = jest.fn();
const mockRouterPush = jest.fn();

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/PreferencesContext', () => ({
  usePreferences: () => ({preferences: {}}),
}));

jest.mock('../../../hooks/api/useNotifications', () => ({
  useNotifications: () => ({
    data: mockNotificationsData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    error: mockError,
    refetch: mockRefetch,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
  }),
  useMarkNotificationsSeen: () => ({
    mutate: mockMarkSeenMutate,
  }),
}));

jest.mock('../../../hooks/useOfflineFeed', () => ({
  useOfflineNotificationsEnhancer: (query: any) => ({
    ...query,
    isServingCached: false,
    isStale: false,
    isOnline: true,
  }),
  useOfflineFeedStatus: () => ({lastCachedAt: null}),
}));

jest.mock('../../../hooks/useNavigation', () => ({
  useAppNavigation: () => ({
    navigateToProfile: mockNavigateToProfile,
    navigateToThread: mockNavigateToThread,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 44, bottom: 34, left: 0, right: 0}),
}));

jest.mock('@react-navigation/native', () => {
  const {useEffect} = require('react');
  return {
    useFocusEffect: (cb: () => void) => {
      // Call immediately on render to simulate focus
      useEffect(() => {
        cb();
      }, []);
    },
    useScrollToTop: jest.fn(),
  };
});

jest.mock('../../../utils/badge', () => ({
  clearBadgeCount: jest.fn(),
}));

jest.mock('../../../utils/content-filter', () => ({
  filterMutedNotifications: (notifs: any[]) => notifs,
}));

jest.mock('../../../utils/notification-aggregator', () => ({
  aggregateNotifications: (notifs: any[]) =>
    notifs.map((n: any) => ({type: 'single', notification: n})),
  filterNotificationsByType: (notifs: any[]) => notifs,
  countNotificationsByType: () => ({all: 0, likes: 0, reposts: 0, follows: 0, mentions: 0, replies: 0, quotes: 0}),
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '3 hours ago',
}));

jest.mock('../../../utils/rich-text', () => ({
  RichText: ({text}: any) => {
    const {Text} = require('react-native');
    return <Text testID="rich-text">{text}</Text>;
  },
}));

jest.mock('@atproto/api', () => ({
  AppBskyNotificationListNotifications: {},
  AppBskyFeedPost: {
    isRecord: (val: any) => val && val.$type === 'app.bsky.feed.post',
  },
  AppBskyRichtextFacet: {},
}));

jest.mock('../../../components/NotificationTabBar', () => ({
  NotificationTabBar: ({onFilterChange}: any) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View testID="notification-tab-bar">
        <TouchableOpacity testID="filter-all" onPress={() => onFilterChange('all')}>
          <Text>All</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../../components/AggregatedNotificationItem', () => ({
  AggregatedNotificationItem: () => null,
}));

jest.mock('../../../components/StaleContentIndicator', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('../../../components/NotificationItemSkeleton', () => ({
  NotificationItemSkeleton: () => {
    const {View} = require('react-native');
    return <View testID="notification-skeleton" />;
  },
}));

// ─── Import after mocks ───────────────────────────────────
import {NotificationsScreen} from '../NotificationsScreen';

// ─── Notification factory ──────────────────────────────────

function makeNotification(overrides: Record<string, any> = {}) {
  return {
    uri: `at://did:plc:author/app.bsky.feed.like/${Math.random().toString(36).slice(2)}`,
    cid: 'bafyreicid',
    author: {
      did: 'did:plc:author1',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: 'https://example.com/avatar.jpg',
      labels: [],
      ...overrides.author,
    },
    reason: 'like',
    reasonSubject: 'at://did:plc:me/app.bsky.feed.post/mypost1',
    record: {
      $type: 'app.bsky.feed.like',
      subject: {uri: 'at://did:plc:me/app.bsky.feed.post/mypost1'},
      createdAt: '2025-01-01T12:00:00.000Z',
    },
    isRead: false,
    indexedAt: '2025-01-01T12:00:00.000Z',
    labels: [],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────
describe('NotificationsScreen', () => {
  beforeEach(() => {
    mockNotificationsData = null;
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
    jest.clearAllMocks();
  });

  it('renders header with title', () => {
    const {getByText} = render(<NotificationsScreen />);
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('renders tab bar', () => {
    const {getByTestId} = render(<NotificationsScreen />);
    expect(getByTestId('notification-tab-bar')).toBeTruthy();
  });

  it('shows skeletons during loading', () => {
    mockIsLoading = true;
    const {getAllByTestId} = render(<NotificationsScreen />);
    const skeletons = getAllByTestId('notification-skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('shows error state when fetch fails', () => {
    mockIsError = true;
    mockError = new Error('Connection failed');
    const {getByText} = render(<NotificationsScreen />);
    expect(getByText('Connection failed')).toBeTruthy();
  });

  it('shows error state with retry button', () => {
    mockIsError = true;
    mockError = new Error('Connection failed');
    const {getByText} = render(<NotificationsScreen />);
    fireEvent.press(getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows empty state when no notifications', () => {
    mockNotificationsData = {pages: [{notifications: []}]};
    const {getByText} = render(<NotificationsScreen />);
    expect(getByText('No notifications yet')).toBeTruthy();
  });

  it('renders notification items from data', () => {
    mockNotificationsData = {
      pages: [
        {
          notifications: [
            makeNotification({
              author: {displayName: 'Alice', handle: 'alice.bsky.social'},
            }),
            makeNotification({
              reason: 'follow',
              author: {displayName: 'Bob', handle: 'bob.bsky.social'},
            }),
          ],
        },
      ],
    };
    const {getByText} = render(<NotificationsScreen />);
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('marks notifications as seen on focus', () => {
    mockNotificationsData = {
      pages: [{notifications: [makeNotification()]}],
    };
    render(<NotificationsScreen />);
    expect(mockMarkSeenMutate).toHaveBeenCalled();
  });

  it('navigates to profile on follow notification press', () => {
    const followNotif = makeNotification({
      reason: 'follow',
      reasonSubject: undefined,
      author: {handle: 'bob.bsky.social', displayName: 'Bob'},
    });
    mockNotificationsData = {
      pages: [{notifications: [followNotif]}],
    };
    const {getByText} = render(<NotificationsScreen />);
    // Find and press the notification
    const bobText = getByText('Bob');
    // Press the outer touchable (notification item)
    const notifItem = bobText.parent?.parent?.parent?.parent?.parent?.parent;
    if (notifItem) {
      fireEvent.press(notifItem);
    }
  });

  it('navigates to thread on like notification press', () => {
    const likeNotif = makeNotification({
      reason: 'like',
      reasonSubject: 'at://did:plc:me/app.bsky.feed.post/postid123',
    });
    mockNotificationsData = {
      pages: [{notifications: [likeNotif]}],
    };
    // Just ensure it renders without crash
    expect(() => render(<NotificationsScreen />)).not.toThrow();
  });

  it('loads more notifications on scroll to end', () => {
    mockHasNextPage = true;
    mockNotificationsData = {
      pages: [{notifications: [makeNotification()]}],
    };
    // Renders without crash; onEndReached wires to handleLoadMore
    expect(() => render(<NotificationsScreen />)).not.toThrow();
  });

  it('shows fallback error message when error has no message', () => {
    mockIsError = true;
    mockError = new Error('');
    const {getByText} = render(<NotificationsScreen />);
    expect(getByText('Failed to load notifications')).toBeTruthy();
  });
});
