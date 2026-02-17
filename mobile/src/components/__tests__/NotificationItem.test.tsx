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
  formatDistanceToNow: () => '5 minutes ago',
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
import {NotificationItem} from '../NotificationItem';

// ─── Notification factories ────────────────────────────────

function makeNotification(overrides: Record<string, any> = {}) {
  return {
    uri: 'at://did:plc:notif/app.bsky.feed.like/abc',
    cid: 'bafyreinotif',
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

function makeReplyNotification(overrides: Record<string, any> = {}) {
  return makeNotification({
    reason: 'reply',
    reasonSubject: undefined,
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Great post! I agree with this.',
      createdAt: '2025-01-01T12:00:00.000Z',
    },
    ...overrides,
  });
}

function makeMentionNotification(overrides: Record<string, any> = {}) {
  return makeNotification({
    reason: 'mention',
    reasonSubject: undefined,
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Hey @me.bsky.social check this out!',
      createdAt: '2025-01-01T12:00:00.000Z',
    },
    ...overrides,
  });
}

function makeFollowNotification(overrides: Record<string, any> = {}) {
  return makeNotification({
    reason: 'follow',
    reasonSubject: undefined,
    record: {
      $type: 'app.bsky.graph.follow',
      subject: 'did:plc:me',
      createdAt: '2025-01-01T12:00:00.000Z',
    },
    ...overrides,
  });
}

// ─── Tests ─────────────────────────────────────────────────
describe('NotificationItem', () => {
  it('renders a like notification', () => {
    const notification = makeNotification();
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText('Alice')).toBeTruthy();
    expect(getByText(/liked your post/)).toBeTruthy();
    expect(getByText('5 minutes ago')).toBeTruthy();
  });

  it('renders a repost notification', () => {
    const notification = makeNotification({reason: 'repost'});
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText(/reposted your post/)).toBeTruthy();
  });

  it('renders a follow notification', () => {
    const notification = makeFollowNotification();
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText(/followed you/)).toBeTruthy();
  });

  it('renders a reply notification with post text preview', () => {
    const notification = makeReplyNotification();
    const {getByTestId} = render(
      <NotificationItem notification={notification as any} />,
    );

    // RichText renders the reply text
    const richText = getByTestId('rich-text');
    expect(richText.props.children).toBe(
      'Great post! I agree with this.',
    );
  });

  it('renders a mention notification with post text', () => {
    const notification = makeMentionNotification();
    const {getByTestId} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByTestId('rich-text').props.children).toBe(
      'Hey @me.bsky.social check this out!',
    );
  });

  it('renders a quote notification', () => {
    const notification = makeNotification({
      reason: 'quote',
      reasonSubject: undefined,
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Interesting take on this topic',
        createdAt: '2025-01-01T12:00:00.000Z',
      },
    });
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText(/quoted your post/)).toBeTruthy();
  });

  it('renders unknown notification type with fallback', () => {
    const notification = makeNotification({reason: 'unknown_type'});
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText(/sent a notification/)).toBeTruthy();
  });

  it('shows "Tap to view post" for likes without post text', () => {
    const notification = makeNotification({
      reason: 'like',
      reasonSubject: 'at://did:plc:me/app.bsky.feed.post/mypost1',
      record: {
        $type: 'app.bsky.feed.like',
        subject: {uri: 'at://did:plc:me/app.bsky.feed.post/mypost1'},
        createdAt: '2025-01-01T12:00:00.000Z',
      },
    });
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText('Tap to view post')).toBeTruthy();
  });

  it('shows unread indicator for unread notifications', () => {
    const notification = makeNotification({isRead: false});
    const {getByLabelText} = render(
      <NotificationItem notification={notification as any} />,
    );

    const item = getByLabelText(/Unread notification/);
    expect(item).toBeTruthy();
  });

  it('does not show unread indicator for read notifications', () => {
    const notification = makeNotification({isRead: true});
    const {getByLabelText} = render(
      <NotificationItem notification={notification as any} />,
    );

    const item = getByLabelText(/Read notification/);
    expect(item).toBeTruthy();
  });

  it('falls back to handle when displayName is missing', () => {
    const notification = makeNotification({
      author: {displayName: undefined, handle: 'bob.bsky.social'},
    });
    const {getAllByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    // Handle appears in both the display name slot and @handle
    const bobs = getAllByText(/bob\.bsky\.social/);
    expect(bobs.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Interactions ────────────────────────────────────────

  it('calls onPress when notification is tapped', () => {
    const onPress = jest.fn();
    const notification = makeNotification();
    const {getByLabelText} = render(
      <NotificationItem notification={notification as any} onPress={onPress} />,
    );

    const item = getByLabelText(/liked your post/);
    fireEvent.press(item);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onProfilePress when avatar is tapped', () => {
    const onProfilePress = jest.fn();
    const notification = makeNotification();
    const {getByLabelText} = render(
      <NotificationItem
        notification={notification as any}
        onProfilePress={onProfilePress}
      />,
    );

    const profileButton = getByLabelText(/View profile of Alice/);
    fireEvent.press(profileButton);
    expect(onProfilePress).toHaveBeenCalledWith('alice.bsky.social');
  });

  // ─── Accessibility ──────────────────────────────────────

  it('has correct accessibility label for like notification', () => {
    const notification = makeNotification();
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    // First button is the outer TouchableOpacity (notification container)
    const buttons = getAllByRole('button');
    const outerButton = buttons[0];
    expect(outerButton.props.accessibilityLabel).toContain('Alice');
    expect(outerButton.props.accessibilityLabel).toContain('liked your post');
    expect(outerButton.props.accessibilityLabel).toContain('5 minutes ago');
    expect(outerButton.props.accessibilityLabel).toContain('Unread notification');
  });

  it('has correct accessibility hint', () => {
    const notification = makeNotification();
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    // First button is the outer TouchableOpacity
    const buttons = getAllByRole('button');
    expect(buttons[0].props.accessibilityHint).toBe(
      'Double tap to view notification details',
    );
  });

  it('includes post preview in accessibility label for replies', () => {
    const notification = makeReplyNotification();
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    const buttons = getAllByRole('button');
    expect(buttons[0].props.accessibilityLabel).toContain(
      'Post: Great post! I agree with this.',
    );
  });

  it('marks read status in accessibility label for read notifications', () => {
    const notification = makeNotification({isRead: true});
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    const buttons = getAllByRole('button');
    expect(buttons[0].props.accessibilityLabel).toContain('Read notification');
    expect(buttons[0].props.accessibilityLabel).not.toContain(
      'Unread notification',
    );
  });

  // ─── Edge cases ──────────────────────────────────────────

  it('renders without crash when no onPress or onProfilePress provided', () => {
    const notification = makeNotification();
    expect(() =>
      render(<NotificationItem notification={notification as any} />),
    ).not.toThrow();
  });

  it('renders author @handle below display name', () => {
    const notification = makeNotification({
      author: {handle: 'alice.bsky.social', displayName: 'Alice'},
    });
    const {getByText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByText('@alice.bsky.social')).toBeTruthy();
  });

  it('does not show post preview or tap hint for follows', () => {
    const notification = makeFollowNotification();
    const {queryByText, queryByTestId} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(queryByText('Tap to view post')).toBeNull();
    expect(queryByTestId('rich-text')).toBeNull();
  });

  it('renders avatar with correct accessibility label', () => {
    const notification = makeNotification();
    const {getByLabelText} = render(
      <NotificationItem notification={notification as any} />,
    );

    expect(getByLabelText("Alice's avatar")).toBeTruthy();
  });

  it('does not call onProfilePress when avatar pressed without handler', () => {
    const notification = makeNotification();
    const {getByLabelText} = render(
      <NotificationItem notification={notification as any} />,
    );

    // Should not throw when pressed without handler
    const profileButton = getByLabelText(/View profile of Alice/);
    expect(() => fireEvent.press(profileButton)).not.toThrow();
  });

  it('applies unread background style for unread notifications', () => {
    const notification = makeNotification({isRead: false});
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    const outerButton = getAllByRole('button')[0];
    // accessibilityState.selected = true for unread
    expect(outerButton.props.accessibilityState).toEqual({selected: true});
  });

  it('does not apply selected state for read notifications', () => {
    const notification = makeNotification({isRead: true});
    const {getAllByRole} = render(
      <NotificationItem notification={notification as any} />,
    );

    const outerButton = getAllByRole('button')[0];
    expect(outerButton.props.accessibilityState).toEqual({selected: false});
  });
});
