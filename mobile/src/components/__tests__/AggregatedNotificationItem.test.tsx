import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {mockTheme} from './test-utils';

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('expo-image', () => {
  const {View} = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

jest.mock('../../utils/rich-text', () => ({
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

// ─── Import after mocks ───────────────────────────────────
import {AggregatedNotificationItem} from '../AggregatedNotificationItem';

// ─── Notification factories ────────────────────────────────

function makeNotification(overrides: Record<string, any> = {}) {
  return {
    uri: `at://did:plc:notif/app.bsky.feed.like/${Math.random().toString(36).slice(2)}`,
    cid: 'bafyreinotif',
    author: {
      did: `did:plc:author${Math.random().toString(36).slice(2)}`,
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: 'https://example.com/avatar-alice.jpg',
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

function makeLikeNotifications(count: number) {
  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
  const handles = [
    'alice.bsky.social',
    'bob.bsky.social',
    'carol.bsky.social',
    'dave.bsky.social',
    'eve.bsky.social',
    'frank.bsky.social',
  ];
  return Array.from({length: count}, (_, i) =>
    makeNotification({
      author: {
        did: `did:plc:author${i}`,
        handle: handles[i] || `user${i}.bsky.social`,
        displayName: names[i] || `User ${i}`,
        avatar: `https://example.com/avatar${i}.jpg`,
      },
    }),
  );
}

function makeFollowNotifications(count: number) {
  return makeLikeNotifications(count).map(n => ({
    ...n,
    reason: 'follow',
    reasonSubject: undefined,
    record: {
      $type: 'app.bsky.graph.follow',
      subject: 'did:plc:me',
      createdAt: '2025-01-01T12:00:00.000Z',
    },
  }));
}

// ─── Tests ─────────────────────────────────────────────────
describe('AggregatedNotificationItem', () => {
  // ─── Basic Rendering ──────────────────────────────────────

  it('renders a single-user aggregated like notification', () => {
    const notifications = makeLikeNotifications(1);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('liked your post')).toBeTruthy();
    expect(getByText('2 hours ago')).toBeTruthy();
  });

  it('renders two-user summary with "and"', () => {
    const notifications = makeLikeNotifications(2);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('Alice and Bob')).toBeTruthy();
    expect(getByText('liked your post')).toBeTruthy();
  });

  it('renders 3+ user summary with count', () => {
    const notifications = makeLikeNotifications(4);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('Alice and 3 others')).toBeTruthy();
  });

  it('renders "1 other" for exactly 2 notifications with same count label', () => {
    // When count = 2 and uniqueUsers.length = 2, it uses "and" format
    // When count = 2 but uniqueUsers.length != 2, it shows "and 1 other"
    // Let's test with 2 notifications from 3+ unique users won't happen,
    // but 2 from same author + another would give count=2, unique=2
    // Actually, this edge case: with count=2 and uniqueUsers.length=2, the "and" path is taken
    // Let's check the "1 other" case by having count > uniqueUsers
    const notifications = [
      makeNotification({
        author: {did: 'did:plc:author0', handle: 'alice.bsky.social', displayName: 'Alice'},
      }),
      makeNotification({
        author: {did: 'did:plc:author0', handle: 'alice.bsky.social', displayName: 'Alice'},
      }),
    ];
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // count=2, uniqueUsers=1, so it takes the third branch: "Alice and 1 other"
    expect(getByText('Alice and 1 other')).toBeTruthy();
  });

  // ─── Reason Types ────────────────────────────────────────

  it('renders aggregated repost notification', () => {
    const notifications = makeLikeNotifications(3).map(n => ({
      ...n,
      reason: 'repost',
    }));
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="repost"
      />,
    );

    expect(getByText('reposted your post')).toBeTruthy();
  });

  it('renders aggregated follow notification', () => {
    const notifications = makeFollowNotifications(3);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="follow"
      />,
    );

    expect(getByText('followed you')).toBeTruthy();
  });

  it('renders aggregated quote notification', () => {
    const notifications = makeLikeNotifications(2).map(n => ({
      ...n,
      reason: 'quote',
    }));
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="quote"
      />,
    );

    expect(getByText('quoted your post')).toBeTruthy();
  });

  it('renders unknown reason with fallback action text', () => {
    const notifications = makeLikeNotifications(2).map(n => ({
      ...n,
      reason: 'unknown_type',
    }));
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="unknown_type"
      />,
    );

    expect(getByText('interacted with your post')).toBeTruthy();
  });

  // ─── Avatar Stack ─────────────────────────────────────────

  it('renders up to 3 avatars in the stack', () => {
    const notifications = makeLikeNotifications(3);
    const {getAllByTestId} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    const images = getAllByTestId('expo-image');
    expect(images.length).toBe(3);
  });

  it('shows +N indicator when more than 3 unique users', () => {
    const notifications = makeLikeNotifications(5);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('+2')).toBeTruthy();
  });

  it('deduplicates users in avatar stack', () => {
    // Two notifications from same author
    const sameAuthor = {
      did: 'did:plc:same',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: 'https://example.com/avatar.jpg',
    };
    const notifications = [
      makeNotification({author: sameAuthor}),
      makeNotification({author: sameAuthor}),
    ];
    const {getAllByTestId} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // Should only show 1 avatar (deduplicated by did)
    const images = getAllByTestId('expo-image');
    expect(images.length).toBe(1);
  });

  // ─── Unread Indicator ─────────────────────────────────────

  it('shows unread indicator when any notification is unread', () => {
    const notifications = [
      makeNotification({isRead: true, author: {did: 'did:plc:a1'}}),
      makeNotification({isRead: false, author: {did: 'did:plc:a2'}}),
    ];
    const {UNSAFE_root} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // The component renders unread indicator View when hasUnread is true
    // Verify the unread style is applied
    const mainContent = UNSAFE_root.findAll(
      node =>
        node.props?.style &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (s: any) => s && s.backgroundColor === mockTheme.colors.unreadBackground,
        ),
    );
    expect(mainContent.length).toBeGreaterThan(0);
  });

  it('does not show unread styling when all notifications are read', () => {
    const notifications = [
      makeNotification({isRead: true, author: {did: 'did:plc:a1'}}),
      makeNotification({isRead: true, author: {did: 'did:plc:a2'}}),
    ];
    const {UNSAFE_root} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // Verify unreadBackground style is NOT applied
    const mainContent = UNSAFE_root.findAll(
      node =>
        node.props?.style &&
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (s: any) => s && s.backgroundColor === mockTheme.colors.unreadBackground,
        ),
    );
    expect(mainContent.length).toBe(0);
  });

  // ─── Expand/Collapse ─────────────────────────────────────

  it('shows expand button when count > 1', () => {
    const notifications = makeLikeNotifications(3);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('Show all 3 notifications')).toBeTruthy();
  });

  it('does not show expand button for single notification', () => {
    const notifications = makeLikeNotifications(1);
    const {queryByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(queryByText(/Show all/)).toBeNull();
    expect(queryByText('Collapse')).toBeNull();
  });

  it('expands to show individual notifications on button press', () => {
    const notifications = makeLikeNotifications(3);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    fireEvent.press(getByText('Show all 3 notifications'));
    expect(getByText('Collapse')).toBeTruthy();
  });

  it('collapses back when Collapse is pressed', () => {
    const notifications = makeLikeNotifications(3);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // Expand
    fireEvent.press(getByText('Show all 3 notifications'));
    expect(getByText('Collapse')).toBeTruthy();

    // Collapse
    fireEvent.press(getByText('Collapse'));
    expect(getByText('Show all 3 notifications')).toBeTruthy();
  });

  // ─── Interactions ─────────────────────────────────────────

  it('calls onPress when the main area is tapped', () => {
    const onPress = jest.fn();
    const notifications = makeLikeNotifications(2);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
        onPress={onPress}
      />,
    );

    // Tap on the summary area
    fireEvent.press(getByText('liked your post'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // ─── User summary edge cases ──────────────────────────────

  it('falls back to @handle when displayName is missing', () => {
    const notifications = [
      makeNotification({
        author: {
          did: 'did:plc:noname',
          handle: 'noname.bsky.social',
          displayName: undefined,
        },
      }),
    ];
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('@noname.bsky.social')).toBeTruthy();
  });

  it('limits unique users to 5 in avatar stack', () => {
    const notifications = makeLikeNotifications(6);
    const {getAllByTestId} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    // uniqueUsers sliced to 5, but only first 3 show avatars
    const images = getAllByTestId('expo-image');
    expect(images.length).toBe(3);
    // +2 more shown
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );
    expect(getByText('+2')).toBeTruthy();
  });

  // ─── Timestamp ────────────────────────────────────────────

  it('displays the timestamp from the latest notification', () => {
    const notifications = makeLikeNotifications(2);
    const {getByText} = render(
      <AggregatedNotificationItem
        notifications={notifications as any}
        reason="like"
      />,
    );

    expect(getByText('2 hours ago')).toBeTruthy();
  });
});
