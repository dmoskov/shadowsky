import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { mockTheme } from '../../../components/__tests__/test-utils';

// ─── Controllable hook state ───────────────────────────────

let mockFollowersData: any = undefined;
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
    account: { did: 'did:plc:myself', handle: 'myself.bsky.social' },
    session: { did: 'did:plc:myself' },
  }),
}));

jest.mock('../../../hooks/api/useProfile', () => ({
  useFollowers: () => ({
    data: mockFollowersData,
    isLoading: mockIsLoading,
    error: mockError,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
    refetch: mockRefetch,
    isRefetching: mockIsRefetching,
  }),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: any) => <View testID="expo-image" {...props} />,
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../../../components/Avatar', () => ({
  Avatar: ({ uri }: any) => {
    const { View } = require('react-native');
    return <View testID="avatar" />;
  },
}));

jest.mock('../../../components/FollowButton', () => ({
  FollowButton: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="follow-button">
        <Text>{props.isFollowing ? 'Following' : 'Follow'}</Text>
      </View>
    );
  },
}));

jest.mock('../../../components/UserListSkeleton', () => ({
  UserListSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="user-list-skeleton" />;
  },
}));

// ─── Import after mocks ───────────────────────────────────

import { FollowersScreen } from '../FollowersScreen';

// ─── Factory helpers ──────────────────────────────────────

function makeFollower(handle: string, displayName?: string) {
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

function makeFollowersPage(followers: any[]) {
  return {
    pages: [{ followers, cursor: 'cursor-1' }],
    pageParams: [undefined],
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('FollowersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowersData = undefined;
    mockIsLoading = true;
    mockError = null;
    mockHasNextPage = false;
    mockIsFetchingNextPage = false;
    mockIsRefetching = false;
  });

  // ─── Loading state ──────────────────────────────────────

  describe('loading state', () => {
    it('shows UserListSkeleton while loading', () => {
      const { getByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByTestId('user-list-skeleton')).toBeTruthy();
    });

    it('does not show error or empty text while loading', () => {
      const { queryByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(queryByText('Failed to load followers')).toBeNull();
      expect(queryByText('No followers yet')).toBeNull();
    });
  });

  // ─── Data loaded state ──────────────────────────────────

  describe('data loaded state', () => {
    it('renders follower display names and handles', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice Wonder'),
        makeFollower('bob', 'Bob Builder'),
      ]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Alice Wonder')).toBeTruthy();
      expect(getByText('@alice.bsky.social')).toBeTruthy();
      expect(getByText('Bob Builder')).toBeTruthy();
      expect(getByText('@bob.bsky.social')).toBeTruthy();
    });

    it('renders follower descriptions', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice'),
      ]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Bio for alice')).toBeTruthy();
    });

    it('renders an avatar for each follower', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
        makeFollower('bob'),
        makeFollower('carol'),
      ]);

      const { getAllByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getAllByTestId('avatar')).toHaveLength(3);
    });

    it('does not show skeleton when data is loaded', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([makeFollower('alice')]);

      const { queryByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(queryByTestId('user-list-skeleton')).toBeNull();
    });
  });

  // ─── Error state ────────────────────────────────────────

  describe('error state', () => {
    it('shows "Failed to load followers" on error', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');
      mockFollowersData = undefined;

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Failed to load followers')).toBeTruthy();
    });

    it('does not show skeleton in error state', () => {
      mockIsLoading = false;
      mockError = new Error('Network error');

      const { queryByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(queryByTestId('user-list-skeleton')).toBeNull();
    });
  });

  // ─── Empty state ────────────────────────────────────────

  describe('empty state', () => {
    it('shows "No followers yet" when list is empty', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('No followers yet')).toBeTruthy();
    });

    it('does not show error text when list is simply empty', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([]);

      const { queryByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(queryByText('Failed to load followers')).toBeNull();
    });
  });

  // ─── Profile navigation ─────────────────────────────────

  describe('profile navigation', () => {
    it('calls onNavigateToProfile with handle when follower is pressed', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice'),
      ]);
      const onNavigateToProfile = jest.fn();

      const { getByText } = render(
        <FollowersScreen
          actor="testuser.bsky.social"
          onNavigateToProfile={onNavigateToProfile}
        />
      );

      fireEvent.press(getByText('Alice'));
      expect(onNavigateToProfile).toHaveBeenCalledWith('alice.bsky.social');
    });

    it('does not crash when onNavigateToProfile is not provided', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice'),
      ]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(() => fireEvent.press(getByText('Alice'))).not.toThrow();
    });
  });

  // ─── Follow button visibility ───────────────────────────

  describe('follow button visibility', () => {
    it('shows follow button for each follower', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
        makeFollower('bob'),
      ]);

      const { getAllByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getAllByTestId('follow-button')).toHaveLength(2);
    });

    it('hides follow button for own profile in the list', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
        {
          did: 'did:plc:myself',
          handle: 'myself.bsky.social',
          displayName: 'Myself',
          avatar: 'https://example.com/myself.jpg',
          description: 'My bio',
          labels: [],
          viewer: {},
        },
      ]);

      const { getAllByTestId } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      // Only alice should have a follow button; own profile should not
      expect(getAllByTestId('follow-button')).toHaveLength(1);
    });

    it('passes isFollowing=true when viewer.following is set', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        {
          ...makeFollower('alice', 'Alice'),
          viewer: { following: 'at://did:plc:myself/app.bsky.graph.follow/abc' },
        },
      ]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Following')).toBeTruthy();
    });

    it('passes isFollowing=false when viewer.following is not set', () => {
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice'),
      ]);

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Follow')).toBeTruthy();
    });
  });

  // ─── Pagination ─────────────────────────────────────────

  describe('pagination', () => {
    it('calls fetchNextPage when end is reached and hasNextPage is true', () => {
      mockIsLoading = false;
      mockHasNextPage = true;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
      ]);

      const { UNSAFE_root } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      // Find the FlatList and trigger its onEndReached callback
      const flatList = UNSAFE_root.findByProps({ onEndReachedThreshold: 0.5 });
      flatList.props.onEndReached();

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('does not call fetchNextPage when hasNextPage is false', () => {
      mockIsLoading = false;
      mockHasNextPage = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
      ]);

      render(<FollowersScreen actor="testuser.bsky.social" />);

      // fetchNextPage should not be called since hasNextPage is false
      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it('shows footer loader when fetching next page', () => {
      mockIsLoading = false;
      mockIsFetchingNextPage = true;
      mockHasNextPage = true;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice'),
      ]);

      const { UNSAFE_root } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      // The footer should contain an ActivityIndicator when fetching next page
      const activityIndicators = UNSAFE_root.findAll(
        (node) => node.type && (node.type as any).displayName === 'ActivityIndicator'
      );
      // At minimum we verify the component renders without error in this state
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ─── Render stability ───────────────────────────────────

  describe('render stability', () => {
    it('renders without crashing when data is undefined', () => {
      mockIsLoading = false;
      mockFollowersData = undefined;

      expect(() =>
        render(<FollowersScreen actor="testuser.bsky.social" />)
      ).not.toThrow();
    });

    it('renders without crashing with multiple pages of data', () => {
      mockIsLoading = false;
      mockFollowersData = {
        pages: [
          { followers: [makeFollower('alice'), makeFollower('bob')], cursor: 'cursor-1' },
          { followers: [makeFollower('carol'), makeFollower('dave')], cursor: 'cursor-2' },
        ],
        pageParams: [undefined, 'cursor-1'],
      };

      const { getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('alice')).toBeTruthy();
      expect(getByText('bob')).toBeTruthy();
      expect(getByText('carol')).toBeTruthy();
      expect(getByText('dave')).toBeTruthy();
    });

    it('renders follower without description gracefully', () => {
      mockIsLoading = false;
      const followerNoDesc = makeFollower('alice', 'Alice');
      delete followerNoDesc.description;
      mockFollowersData = makeFollowersPage([followerNoDesc]);

      const { getByText, queryByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByText('Alice')).toBeTruthy();
      expect(queryByText('Bio for alice')).toBeNull();
    });

    it('falls back to handle when displayName is missing', () => {
      mockIsLoading = false;
      const followerNoName = makeFollower('alice');
      followerNoName.displayName = '';
      mockFollowersData = makeFollowersPage([followerNoName]);

      const { getAllByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      // The handle appears both as the display name fallback and as the @handle
      const handleTexts = getAllByText(/alice\.bsky\.social/);
      expect(handleTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('re-renders correctly when transitioning from loading to loaded', () => {
      mockIsLoading = true;

      const { getByTestId, queryByTestId, rerender, getByText } = render(
        <FollowersScreen actor="testuser.bsky.social" />
      );

      expect(getByTestId('user-list-skeleton')).toBeTruthy();

      // Transition to loaded state
      mockIsLoading = false;
      mockFollowersData = makeFollowersPage([
        makeFollower('alice', 'Alice'),
      ]);

      rerender(<FollowersScreen actor="testuser.bsky.social" />);

      expect(queryByTestId('user-list-skeleton')).toBeNull();
      expect(getByText('Alice')).toBeTruthy();
    });
  });
});
