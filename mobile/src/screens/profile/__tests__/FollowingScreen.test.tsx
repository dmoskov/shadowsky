import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Controllable mock state ──────────────────────────────

let mockFollowsData: any = undefined;
let mockIsLoading = true;
let mockError: any = null;
const mockFetchNextPage = jest.fn();
let mockHasNextPage = false;
let mockIsFetchingNextPage = false;
const mockRefetch = jest.fn();
let mockIsRefetching = false;

// ─── Module mocks ──────────────────────────────────────────

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    account: { handle: 'myhandle.bsky.social', did: 'did:plc:me' },
  }),
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useFollows: () => ({
    data: mockFollowsData,
    isLoading: mockIsLoading,
    error: mockError,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
    refetch: mockRefetch,
    isRefetching: mockIsRefetching,
  }),
}));

jest.mock('../../../components/Avatar', () => {
  const { View } = require('react-native');
  return {
    Avatar: (props: any) => <View testID="avatar" {...props} />,
  };
});

jest.mock('../../../components/FollowButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    FollowButton: (props: any) => (
      <TouchableOpacity testID={`follow-button-${props.did}`}>
        <Text>{props.isFollowing ? 'Following' : 'Follow'}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../../components/UserListSkeleton', () => {
  const { View } = require('react-native');
  return {
    UserListSkeleton: () => <View testID="user-list-skeleton" />,
  };
});

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

// ─── Import after mocks ───────────────────────────────────

import { FollowingScreen } from '../FollowingScreen';

// ─── Factories ─────────────────────────────────────────────

function makeFollowing(handle: string, displayName?: string) {
  return {
    did: `did:plc:${handle}`,
    handle: `${handle}.bsky.social`,
    displayName: displayName || handle,
    avatar: `https://example.com/${handle}.jpg`,
    description: `Bio for ${handle}`,
    labels: [],
    viewer: {},
  };
}

function makeFollowsPage(follows: any[]) {
  return { pages: [{ follows, cursor: 'cursor-1' }], pageParams: [undefined] };
}

// ─── Tests ────────────────────────────────────────────────

describe('FollowingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowsData = undefined;
    mockIsLoading = true;
    mockError = null;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
    mockIsRefetching = false;
  });

  // ─── Loading state ─────────────────────────────────────

  describe('loading state', () => {
    it('renders UserListSkeleton while loading', () => {
      mockIsLoading = true;
      mockFollowsData = undefined;

      const { getByTestId } = render(
        <FollowingScreen actor="alice.bsky.social" />
      );

      expect(getByTestId('user-list-skeleton')).toBeTruthy();
    });

    it('does not render skeleton when data is loaded', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([makeFollowing('alice', 'Alice')]);

      const { queryByTestId } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(queryByTestId('user-list-skeleton')).toBeNull();
    });
  });

  // ─── Data rendering ────────────────────────────────────

  describe('data rendering', () => {
    it('renders a list of followed users with display names and handles', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([
        makeFollowing('alice', 'Alice Wonder'),
        makeFollowing('bob', 'Bob Builder'),
      ]);

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByText('Alice Wonder')).toBeTruthy();
      expect(getByText('@alice.bsky.social')).toBeTruthy();
      expect(getByText('Bob Builder')).toBeTruthy();
      expect(getByText('@bob.bsky.social')).toBeTruthy();
    });

    it('renders bio descriptions for followed users', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([makeFollowing('alice', 'Alice')]);

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByText('Bio for alice')).toBeTruthy();
    });

    it('falls back to handle when displayName is missing', () => {
      mockIsLoading = false;
      const user = makeFollowing('carol');
      user.displayName = '';
      mockFollowsData = makeFollowsPage([user]);

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      // When displayName is empty, the component falls back to item.handle
      expect(getByText('carol.bsky.social')).toBeTruthy();
    });
  });

  // ─── Error state ───────────────────────────────────────

  describe('error state', () => {
    it('shows "Failed to load following" on error', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');
      mockFollowsData = undefined;

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByText('Failed to load following')).toBeTruthy();
    });
  });

  // ─── Empty state ───────────────────────────────────────

  describe('empty state', () => {
    it('shows "Not following anyone yet" when the list is empty', () => {
      mockIsLoading = false;
      mockError = null;
      mockFollowsData = makeFollowsPage([]);

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByText('Not following anyone yet')).toBeTruthy();
    });
  });

  // ─── Navigate to profile ──────────────────────────────

  describe('navigation', () => {
    it('calls onNavigateToProfile with the handle when a user is pressed', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([makeFollowing('alice', 'Alice')]);
      const onNavigateToProfile = jest.fn();

      const { getByText } = render(
        <FollowingScreen
          actor="someuser.bsky.social"
          onNavigateToProfile={onNavigateToProfile}
        />
      );

      fireEvent.press(getByText('Alice'));
      expect(onNavigateToProfile).toHaveBeenCalledWith('alice.bsky.social');
    });

    it('does not crash when onNavigateToProfile is not provided', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([makeFollowing('alice', 'Alice')]);

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(() => fireEvent.press(getByText('Alice'))).not.toThrow();
    });
  });

  // ─── Follow button visibility ─────────────────────────

  describe('follow button visibility', () => {
    it('renders a FollowButton for each followed user', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([
        makeFollowing('alice', 'Alice'),
        makeFollowing('bob', 'Bob'),
      ]);

      const { getByTestId } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByTestId('follow-button-did:plc:alice')).toBeTruthy();
      expect(getByTestId('follow-button-did:plc:bob')).toBeTruthy();
    });

    it('hides FollowButton for the current user (own profile in list)', () => {
      mockIsLoading = false;
      const ownUser = makeFollowing('me');
      ownUser.did = 'did:plc:me'; // matches the mocked auth account
      mockFollowsData = makeFollowsPage([
        ownUser,
        makeFollowing('alice', 'Alice'),
      ]);

      const { queryByTestId, getByTestId } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      // Own profile should not have a follow button
      expect(queryByTestId('follow-button-did:plc:me')).toBeNull();
      // Other users still have follow buttons
      expect(getByTestId('follow-button-did:plc:alice')).toBeTruthy();
    });
  });

  // ─── Render stability ─────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing when data is undefined', () => {
      mockIsLoading = false;
      mockFollowsData = undefined;

      expect(() =>
        render(<FollowingScreen actor="someuser.bsky.social" />)
      ).not.toThrow();
    });

    it('renders without crashing with multiple pages of data', () => {
      mockIsLoading = false;
      mockFollowsData = {
        pages: [
          { follows: [makeFollowing('alice', 'Alice')], cursor: 'cursor-1' },
          { follows: [makeFollowing('bob', 'Bob')], cursor: 'cursor-2' },
        ],
        pageParams: [undefined, 'cursor-1'],
      };

      const { getByText } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });

    it('renders consistently across multiple render cycles', () => {
      mockIsLoading = false;
      mockFollowsData = makeFollowsPage([
        makeFollowing('alice', 'Alice'),
        makeFollowing('bob', 'Bob'),
      ]);

      const { getByText, rerender } = render(
        <FollowingScreen actor="someuser.bsky.social" />
      );

      // Re-render with the same props
      rerender(<FollowingScreen actor="someuser.bsky.social" />);

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });
  });
});
